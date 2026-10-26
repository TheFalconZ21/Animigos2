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
    CACHE_PREFIX_STUDIOS
)
from core.utils.cache import cached_api_response, build_cache_key


class AnimeCatalogPagination(PageNumberPagination):
    """Paginación para el catálogo: 50 animes a la vez por requerimiento de diseño."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class AnimeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint para consultar el catálogo de animes.
    Soporta búsqueda por texto, filtrado por género, estudio, año, temporada,
    formato, nota mínima, no secuelas, no en mi lista, recomendadas por amigos,
    ordenación por defecto por nota descendiente y caché intermedia.
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
        qs = super().get_queryset()
        params = self.request.query_params

        q = params.get('q')
        genre = params.get('genre')
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

        # 1. Búsqueda por texto (título, título inglés, estudio)
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(title_english__icontains=q) |
                Q(studio__icontains=q)
            )

        # 2. Filtro por Género
        if genre and genre.lower() not in ('todos', 'todos los géneros', 'todos los generos', 'all'):
            qs = qs.filter(genres__icontains=genre)

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

        # 9. Filtro No Secuelas (excluye temporadas 2+, partes 2+, etc.)
        if no_sequels and str(no_sequels).lower() in ('true', '1', 'yes'):
            qs = qs.exclude(
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

        # 11. Filtro Recomendadas por Amigos
        if recommended_by_friends and str(recommended_by_friends).lower() in ('true', '1', 'yes'):
            qs = qs.filter(
                Q(user_list_entries__score__gte=8) |
                Q(score__gte=8.0)
            ).distinct()

        # 12. Ordenación (por defecto Nota MAL descendiente con desempate por miembros)
        ordering_param = params.get('ordering', '-score')
        if not ordering_param or ordering_param in ('-score', '-score_mal'):
            if not q and not min_score:
                qs = qs.filter(scored_by__gte=100).order_by('-score', '-scored_by')
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

    @action(detail=False, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_MEDIUM, prefix=CACHE_PREFIX_TOP_ANIMES)
    def top(self, request):
        """Devuelve los mejores animes por puntuación (en caché por 30 minutos)."""
        limit = int(request.query_params.get('limit', 50))
        top_animes = Anime.objects.filter(score__isnull=False, scored_by__gte=500).order_by('-score', '-scored_by')[:limit]
        serializer = self.get_serializer(top_animes, many=True)
        return Response(serializer.data)

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

