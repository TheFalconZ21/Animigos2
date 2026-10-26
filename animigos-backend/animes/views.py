from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from django.core.cache import cache

from .models import Anime, AnimeRecommendation
from .serializers import AnimeSerializer, AnimeRecommendationSerializer
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


class AnimeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint para consultar el catálogo de animes.
    Soporta búsqueda por texto, filtrado por género, estudio, año, ordenación y caché intermedia.
    Pilar 4.1 y 4.3 de la Directiva de Arquitectura.
    """
    queryset = Anime.objects.all()
    serializer_class = AnimeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'title_english', 'studio', 'genres']
    ordering_fields = ['score', 'popularity', 'rank', 'season_year', 'polarization_index']
    ordering = ['-score']

    def get_queryset(self):
        qs = super().get_queryset()
        genre = self.request.query_params.get('genre')
        studio = self.request.query_params.get('studio')
        year = self.request.query_params.get('year')
        status_param = self.request.query_params.get('status')
        q = self.request.query_params.get('q')

        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(title_english__icontains=q) |
                Q(studio__icontains=q)
            )

        if genre:
            # En SQLite/PostgreSQL JSONField busca coincidencias
            qs = qs.filter(genres__icontains=genre)

        if studio:
            qs = qs.filter(studio__iexact=studio)

        if year:
            try:
                qs = qs.filter(season_year=int(year))
            except ValueError:
                pass

        if status_param:
            qs = qs.filter(status__iexact=status_param)

        return qs

    def list(self, request, *args, **kwargs):
        """
        Listado paginado y filtrable con caché intermedia (Pilar 4.1).
        Primera llamada: 'X-Cache-Status: MISS' -> guarda en caché.
        Siguientes llamadas idénticas: 'X-Cache-Status: HIT' -> respuesta instantánea en memoria.
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
        """Devuelve los mejores 24 animes por puntuación (en caché por 30 minutos)."""
        top_animes = Anime.objects.filter(score__isnull=False).order_by('-score')[:24]
        serializer = self.get_serializer(top_animes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    @cached_api_response(timeout=CACHE_TTL_MEDIUM, prefix=CACHE_PREFIX_RECOMMENDATIONS)
    def recommendations(self, request, pk=None):
        """Devuelve las mejores recomendaciones cruzadas para este anime (en caché por 30 minutos)."""
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
        """Devuelve lista agregada de estudios con cantidad de animes (en caché por 24 horas)."""
        studios_data = (
            Anime.objects.exclude(studio='')
            .values('studio')
            .annotate(count=Count('mal_id'))
            .order_by('-count')[:30]
        )
        return Response(list(studios_data))
