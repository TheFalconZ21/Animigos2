from collections import Counter
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count
from django.core.cache import cache

from .models import Anime, AnimeRecommendation
from .serializers import AnimeSerializer, AnimeRecommendationSerializer, AnimeScoreHistorySerializer
from core.constants import (
    CACHE_TTL_SHORT,
    CACHE_TTL_MEDIUM,
    CACHE_TTL_LONG,
    CACHE_PREFIX_CATALOG,
    CACHE_PREFIX_TOP_ANIMES,
    CACHE_PREFIX_RECOMMENDATIONS,
    CACHE_PREFIX_STUDIOS,
    CACHE_PREFIX_SCHEDULE,
    CACHE_PREFIX_UPCOMING,
)
from core.utils.cache import cached_api_response, build_cache_key
from core.services.fuentes_externas import obtener_horario_semanal, obtener_proximos_lanzamientos


class AnimeCatalogPagination(PageNumberPagination):
    """Paginación para el catálogo: 50 animes a la vez por requerimiento de diseño."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class AnimeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint para consultar el catálogo de animes.
    Soporta búsqueda por texto, filtrado multi-género y multi-taxonomía de AniList (intersección AND),
    estudio, año, temporada, formato, nota mínima, no secuelas, no en mi lista,
    recomendadas por amigos, ordenación por defecto por nota descendiente y caché intermedia.
    Pilar 4.1 y 4.3 de la Directiva de Arquitectura.
    """
    queryset = Anime.objects.all()
    serializer_class = AnimeSerializer
    pagination_class = AnimeCatalogPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'title_english', 'studio', 'genres']
    ordering_fields = ['score', 'popularity', 'rank', 'season_year', 'polarization_index', 'title']
    ordering = ['-score']

    def get_queryset(self):
        if Anime.objects.count() < 10000:
            try:
                from django.core.management import call_command
                call_command('load_anime_bulk')
                call_command('seed_initial_data')
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error auto-seeding initial animes: {e}")
        qs = super().get_queryset()
        params = self.request.query_params

        q = params.get('q')
        genre = params.get('genre') or params.get('genres')
        tags_param = params.get('tags') or params.get('taxonomies') or params.get('tag')
        studio = params.get('studio')
        year = params.get('year')
        season_param = params.get('season') or params.get('temporada')
        min_score = params.get('min_score') or params.get('minScore')
        format_param = params.get('format') or params.get('type') or params.get('formato')
        status_param = params.get('status')
        no_sequels = params.get('no_sequels') or params.get('noSequels')
        not_in_my_list = params.get('not_in_my_list') or params.get('notInMyList')
        recommended_by_friends = params.get('recommended_by_friends') or params.get('recommendedByFriends')
        exclude_ids_param = params.get('exclude_ids')

        # 1. Búsqueda por texto (título, título inglés, título japonés, estudio)
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(title_english__icontains=q) |
                Q(title_japanese__icontains=q) |
                Q(studio__icontains=q)
            )

        # 2. Filtro Multi-Género y Multi-Taxonomía de AniList (Intersección AND: debe cumplir TODOS los seleccionados)
        combined_terms = []
        if genre:
            for g in str(genre).split(','):
                g_clean = g.strip()
                if g_clean and g_clean.lower() not in ('todos', 'todos los géneros', 'todos los generos', 'all'):
                    if g_clean not in combined_terms:
                        combined_terms.append(g_clean)

        if tags_param:
            for t in str(tags_param).split(','):
                t_clean = t.strip()
                if t_clean and t_clean.lower() not in ('todos', 'todas', 'all'):
                    if t_clean not in combined_terms:
                        combined_terms.append(t_clean)

        for term in combined_terms:
            term_lower = term.lower()
            qs = qs.filter(
                Q(tags_cache__icontains=f"|{term_lower}|") |
                Q(genres__icontains=term)
            )

        # 3. Filtro por Estudio
        if studio and studio.lower() not in ('todos', 'todos los estudios', 'all'):
            qs = qs.filter(studio__iexact=studio)

        # 4. Filtro por Año
        if year and year.lower() not in ('todos', 'todos los años', 'todos los anos', 'all'):
            try:
                qs = qs.filter(season_year=int(year))
            except ValueError:
                pass

        # 5. Filtro por Temporada
        if season_param and season_param.lower() not in ('todas', 'todas las temporadas', 'all'):
            season_map = {
                'otono': 'fall',
                'otoño': 'fall',
                'fall': 'fall',
                'primavera': 'spring',
                'spring': 'spring',
                'verano': 'summer',
                'summer': 'summer',
                'invierno': 'winter',
                'winter': 'winter',
            }
            season_norm = season_map.get(season_param.lower(), season_param.lower())
            qs = qs.filter(season__iexact=season_norm)

        # 6. Filtro por Nota Mínima
        if min_score and min_score.lower() not in ('todas', 'todas las notas', 'all'):
            try:
                qs = qs.filter(score__gte=float(min_score))
            except ValueError:
                pass

        # 7. Filtro por Formato (TV/Serie, Película/Movie, OVA, etc.)
        if format_param and format_param.lower() not in ('todos', 'todos los formatos', 'all'):
            format_map = {
                'pelicula': 'Movie',
                'película': 'Movie',
                'movie': 'Movie',
                'serie': 'TV',
                'tv': 'TV',
                'tv_short': 'TV_SHORT',
                'ova': 'OVA',
                'ona': 'ONA',
                'special': 'Special',
                'especial': 'Special',
            }
            fmt_norm = format_map.get(format_param.lower(), format_param)
            qs = qs.filter(type__iexact=fmt_norm)

        # 8. Filtro por Estado
        if status_param and status_param.lower() not in ('todos', 'all'):
            qs = qs.filter(status__iexact=status_param)

        # 9. Filtro No Secuelas (excluye temporadas 2+, partes 2+, y marca _is_sequel_)
        if no_sequels and str(no_sequels).lower() in ('true', '1', 'yes'):
            qs = qs.exclude(
                Q(tags_cache__icontains='|_is_sequel_|') |
                Q(title__icontains=' 2nd') |
                Q(title__icontains=' 3rd') |
                Q(title__icontains=' 4th') |
                Q(title__icontains='Season 2') |
                Q(title__icontains='Season 3') |
                Q(title__icontains='Season 4') |
                Q(title__icontains='Part 2') |
                Q(title__icontains='Part 3') |
                Q(title__icontains='Part II') |
                Q(title__icontains=' II') |
                Q(title__icontains=' III') |
                Q(title__icontains='Final Season') |
                Q(title__icontains='STAGE') |
                Q(title_english__icontains='Season 2') |
                Q(title_english__icontains='Season 3') |
                Q(title_english__icontains='Part 2')
            )

        # 10. Filtro No en Mi Lista
        if not_in_my_list and str(not_in_my_list).lower() in ('true', '1', 'yes'):
            if self.request.user.is_authenticated:
                qs = qs.exclude(user_list_entries__user=self.request.user)
            if exclude_ids_param:
                try:
                    ids = [int(x.strip()) for x in exclude_ids_param.split(',') if x.strip().isdigit()]
                    if ids:
                        qs = qs.exclude(mal_id__in=ids)
                except Exception:
                    pass


        # 12. Ordenación (por defecto Nota MAL descendiente con desempate por miembros)
        ordering_param = params.get('ordering', '-score')
        if not ordering_param or ordering_param in ('-score', '-score_mal'):
            if not q and not min_score:
                qs = qs.filter(Q(scored_by__gte=100) | Q(rank__isnull=False)).order_by('-score', '-scored_by')
            else:
                qs = qs.order_by('-score', '-scored_by')
        elif ordering_param == 'score':
            qs = qs.order_by('score', 'scored_by')
        elif ordering_param == '-popularity':
            qs = qs.order_by('-scored_by', '-score')
        elif ordering_param == '-season_year':
            qs = qs.order_by('-season_year', '-score')
        elif ordering_param == 'title':
            qs = qs.order_by('title')
        else:
            qs = qs.order_by(ordering_param)

        return qs

    def list(self, request, *args, **kwargs):
        """
        Listado paginado y filtrable con caché intermedia (Pilar 4.1).
        """
        query_dict = dict(request.query_params.items())
        cache_key = build_cache_key(f"{CACHE_PREFIX_CATALOG}:list", query_dict)
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            hit_res = Response(cached_data)
            hit_res['X-Cache-Status'] = 'HIT'
            hit_res['X-Cache-Key'] = cache_key
            return hit_res

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200 and hasattr(response, 'data'):
            cache.set(cache_key, response.data, timeout=CACHE_TTL_SHORT)
            response['X-Cache-Status'] = 'MISS'
            response['X-Cache-Key'] = cache_key
        return response

    @action(detail=False, methods=['get', 'post'], url_path='sync_catalog')
    def sync_catalog(self, request):
        """Carga masivamente los 30,000+ animes, tags, historial temporal y recomendaciones."""
        import logging
        from django.core.management import call_command
        call_command('load_anime_bulk')
        try:
            call_command('load_anime_history')
        except Exception as e:
            logging.error(f"Error cargando anime history: {e}")
        try:
            call_command('load_anime_recommendations')
        except Exception as e:
            logging.error(f"Error cargando anime recommendations: {e}")
        try:
            call_command('seed_initial_data')
        except Exception as e:
            logging.error(f"Error seeding initial data: {e}")
        from animes.models import AnimeScoreHistory, AnimeRecommendation
        return Response({
            'status': 'success',
            'total_animes': Anime.objects.count(),
            'total_history': AnimeScoreHistory.objects.count(),
            'total_recommendations': AnimeRecommendation.objects.count(),
            'message': 'Catálogo maestro, tags, historial y recomendaciones sincronizados completamente.',
        })

    @action(detail=False, methods=['get', 'post'], url_path='sync-catalog')
    def sync_catalog_hyphen(self, request):
        return self.sync_catalog(request)

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_MEDIUM, prefix=CACHE_PREFIX_TOP_ANIMES)
    def top(self, request):
        """Devuelve los mejores animes por puntuación (en caché por 30 minutos)."""
        limit = int(request.query_params.get('limit', 50))
        top_animes = Anime.objects.filter(score__isnull=False, scored_by__gte=500).order_by('-score', '-scored_by')[:limit]
        serializer = self.get_serializer(top_animes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_MEDIUM, prefix=CACHE_PREFIX_SCHEDULE)
    def schedule(self, request):
        """
        Episodios que se emiten en los próximos 7 días (proxy de AniList con caché de 30 min).
        """
        try:
            return Response(obtener_horario_semanal())
        except Exception:
            return Response([])

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_LONG, prefix=CACHE_PREFIX_UPCOMING)
    def upcoming(self, request):
        """
        Series nuevas, temporadas y películas que se estrenan en los próximos 90 días.
        """
        try:
            return Response(obtener_proximos_lanzamientos())
        except Exception:
            return Response([])

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_LONG, prefix='genres')
    def genres(self, request):
        """Devuelve lista de géneros únicos presentes en el catálogo."""
        genres_set = set()
        for anime in Anime.objects.exclude(genres=[]).only('genres'):
            if anime.genres and isinstance(anime.genres, list):
                genres_set.update(anime.genres)
        return Response(sorted(list(genres_set)))

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_LONG, prefix='taxonomies_v1')
    def taxonomies(self, request):
        """
        Devuelve el catálogo completo de Géneros y Media Tags de AniList (con su categoría y conteo)
        para el selector multi-filtro del Catálogo.
        """
        genre_counter = Counter()
        tag_counter = Counter()
        tag_categories = {}

        for anime in Anime.objects.only('genres', 'tags_data').iterator(chunk_size=2500):
            if isinstance(anime.genres, list):
                for g in anime.genres:
                    if g:
                        genre_counter[str(g).strip()] += 1
            if isinstance(anime.tags_data, list):
                for t in anime.tags_data:
                    if isinstance(t, dict) and not t.get('spoiler'):
                        t_name = str(t.get('name', '')).strip()
                        if t_name:
                            tag_counter[t_name] += 1
                            if t_name not in tag_categories:
                                raw_cat = str(t.get('category', 'Theme'))
                                if raw_cat.lower().startswith('cast'):
                                    norm_cat = 'Cast'
                                elif raw_cat.lower().startswith('setting'):
                                    norm_cat = 'Setting'
                                elif raw_cat.lower().startswith('demographic') or raw_cat.lower().startswith('technical'):
                                    norm_cat = 'Demographic'
                                else:
                                    norm_cat = 'Theme'
                                tag_categories[t_name] = norm_cat

        genres_list = [
            {'name': name, 'category': 'Genre', 'count': count}
            for name, count in sorted(genre_counter.items(), key=lambda x: (-x[1], x[0]))
            if count >= 2
        ]

        tags_list = [
            {
                'name': name,
                'category': tag_categories.get(name, 'Theme'),
                'count': count,
            }
            for name, count in tag_counter.most_common(220)
            if count >= 3
        ]

        return Response({
            'genres': genres_list,
            'tags': tags_list,
        })

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_LONG, prefix='years')
    def years(self, request):
        """Devuelve lista de años disponibles en el catálogo."""
        years = (
            Anime.objects.exclude(season_year__isnull=True)
            .values_list('season_year', flat=True)
            .distinct()
            .order_by('-season_year')
        )
        return Response(list(years))

    @action(detail=True, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_MEDIUM, prefix=CACHE_PREFIX_RECOMMENDATIONS)
    def recommendations(self, request, pk=None):
        """Devuelve las mejores recomendaciones cruzadas para este anime."""
        anime = self.get_object()
        limit = int(request.query_params.get('limit', 12))
        recoms = (
            AnimeRecommendation.objects.filter(source=anime)
            .select_related('target')
            .order_by('-strength')[:limit]
        )
        serializer = AnimeRecommendationSerializer(recoms, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_LONG, prefix=CACHE_PREFIX_STUDIOS)
    def studios(self, request):
        """Devuelve lista agregada de estudios con cantidad de animes."""
        studios_data = (
            Anime.objects.exclude(studio='')
            .values('studio')
            .annotate(count=Count('mal_id'))
            .order_by('-count')[:50]
        )
        return Response(list(studios_data))

    @action(detail=True, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_LONG, prefix='anime_history')
    def history(self, request, pk=None):
        """Devuelve la evolución temporal histórica y mensual de la nota del anime."""
        anime = self.get_object()
        history_qs = anime.score_history.all().order_by('recorded_at')
        serializer = AnimeScoreHistorySerializer(history_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='tmdb-search')
    def tmdb_search(self, request):
        """
        Busca películas y series en el catálogo indexado de TMDB (ExternalReferenceMedia).
        Pilar 4.1 de AGENTS.md: Proxy backend seguro y de alto rendimiento.
        """
        from .tmdb_service import search_tmdb_movies
        q = request.query_params.get('q', '')
        media_type = request.query_params.get('type') or request.query_params.get('media_type', 'all')
        try:
            limit = int(request.query_params.get('limit', 15))
        except (ValueError, TypeError):
            limit = 15
        results = search_tmdb_movies(q, media_type=media_type, limit=limit)
        return Response(results)

    @action(detail=False, methods=['post'], url_path='tmdb-recommendations')
    def tmdb_recommendations(self, request):
        """
        Cruza las películas de TMDB ingresadas por el usuario con el catálogo
        de animes de Animigos para generar recomendaciones de alta afinidad.
        """
        from .tmdb_service import cross_reference_tmdb_movies_with_anime
        movies = request.data.get('movies', [])
        recoms = cross_reference_tmdb_movies_with_anime(movies)
        return Response(recoms)

    @action(detail=False, methods=['post'], url_path='calibrate-recommendations')
    def calibrate_recommendations(self, request):
        """
        Calibrador y Recomendador Híbrido del Profesor Doki Doki.
        """
        from .recommender import calibrate_and_recommend
        data = request.data or {}
        tmdb_movies = data.get('tmdb_movies', [])
        liked_anime_ids = data.get('liked_anime_ids', [])
        favorite_genres = data.get('favorite_genres', [])
        disliked_genres = data.get('disliked_genres', [])
        tropes = data.get('tropes', [])
        pacing = data.get('pacing', '')
        preferred_format = data.get('preferred_format', '') or data.get('format', '')
        preferred_genre = data.get('preferred_genre', '') or data.get('genre', '')
        preferred_year_min_raw = data.get('preferred_year_min') or data.get('year_min') or data.get('min_year')
        preferred_year_min = None
        if preferred_year_min_raw is not None and str(preferred_year_min_raw).isdigit():
            preferred_year_min = int(preferred_year_min_raw)

        preferred_year_max_raw = data.get('preferred_year_max') or data.get('year_max') or data.get('max_year')
        preferred_year_max = None
        if preferred_year_max_raw is not None and str(preferred_year_max_raw).isdigit():
            preferred_year_max = int(preferred_year_max_raw)
        exclude_ids = data.get('exclude_ids', [])
        try:
            limit = max(1, min(15, int(data.get('limit', 5))))
        except (ValueError, TypeError):
            limit = 5

        if request.user and request.user.is_authenticated and (
            favorite_genres or liked_anime_ids or tmdb_movies or tropes
        ):
            try:
                from users.models import UserPreferences, UserAnimeEntry
                pref, _ = UserPreferences.objects.get_or_create(profile=request.user.profile)
                pref.onboarding_completed = True
                pref.favorite_genres = favorite_genres
                pref.disliked_genres = disliked_genres
                pref.preferred_duration = pacing
                p_settings = pref.privacy_settings or {}
                p_settings['tmdb_movies'] = tmdb_movies
                p_settings['liked_anime_ids'] = liked_anime_ids
                p_settings['tropes'] = tropes
                pref.privacy_settings = p_settings
                pref.save()

                for mal_id in liked_anime_ids:
                    try:
                        anime_obj = Anime.objects.filter(mal_id=mal_id).first()
                        if anime_obj:
                            UserAnimeEntry.objects.get_or_create(
                                user=request.user,
                                anime=anime_obj,
                                defaults={'status': 'visto', 'score': 9, 'is_favorite': True}
                            )
                    except Exception:
                        pass
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Error sincronizando preferencias de calibración: {e}")

        reference_work = data.get('reference_work')
        netflix_mode = bool(data.get('netflix_mode', False))

        recommendations = calibrate_and_recommend(
            user=request.user if request.user.is_authenticated else None,
            tmdb_movies=tmdb_movies,
            liked_anime_ids=liked_anime_ids,
            favorite_genres=favorite_genres,
            disliked_genres=disliked_genres,
            tropes=tropes,
            pacing=pacing,
            preferred_format=preferred_format,
            preferred_genre=preferred_genre,
            preferred_year_min=preferred_year_min,
            preferred_year_max=preferred_year_max,
            reference_work=reference_work,
            netflix_mode=netflix_mode,
            exclude_ids=exclude_ids,
            limit=limit,
        )
        return Response(recommendations)

    @action(detail=False, methods=['get', 'post'], url_path='taste-analytics')
    def taste_analytics(self, request):
        """
        Retorna el Perfil Analítico de Gustos del Usuario.
        """
        from .recommender import build_user_taste_analytics
        data = request.data if request.method == 'POST' and request.data else {}
        analytics = build_user_taste_analytics(
            user=request.user if request.user.is_authenticated else None,
            liked_anime_ids=data.get('liked_anime_ids', []),
            favorite_genres=data.get('favorite_genres', []),
            tropes=data.get('tropes', []),
            tmdb_movies=data.get('tmdb_movies', []),
        )
        return Response(analytics)

    @action(detail=False, methods=['get'], url_path='test-search')
    def test_search(self, request):
        """
        Buscador optimizado para el paso de 'Animes que ya viste' en el calibrador.
        """
        q = request.query_params.get('q', '').strip()
        if not q or len(q) < 2:
            top_animes = Anime.objects.filter(
                score__gte=8.2, scored_by__gte=50000
            ).order_by('-score')[:12]
        else:
            top_animes = Anime.objects.filter(
                Q(title__icontains=q) | Q(title_english__icontains=q)
            ).order_by('-score', '-scored_by')[:12]

        results = [
            {
                'mal_id': a.mal_id,
                'title': a.title,
                'title_english': a.title_english,
                'image_url': a.image_url,
                'score': float(a.score) if a.score else 0.0,
                'season_year': a.season_year,
                'studio': a.studio,
                'genres': a.genres[:3] if isinstance(a.genres, list) else [],
            }
            for a in top_animes
        ]
        return Response(results)
