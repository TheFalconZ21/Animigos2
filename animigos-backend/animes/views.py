from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Count
from .models import Anime
from .serializers import AnimeSerializer

class AnimeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint para consultar el catálogo de animes.
    Soporta búsqueda por texto, filtrado por género, estudio, año y ordenación.
    """
    queryset = Anime.objects.all()
    serializer_class = AnimeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'title_english', 'studio', 'genres']
    ordering_fields = ['score', 'popularity', 'rank', 'season_year']
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

    @action(detail=False, methods=['get'])
    def top(self, request):
        """Devuelve los mejores 24 animes por puntuación."""
        top_animes = Anime.objects.filter(score__isnull=False).order_by('-score')[:24]
        serializer = self.get_serializer(top_animes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def studios(self, request):
        """Devuelve lista agregada de estudios con cantidad de animes."""
        studios_data = (
            Anime.objects.exclude(studio='')
            .values('studio')
            .annotate(count=Count('mal_id'))
            .order_by('-count')[:30]
        )
        return Response(studios_data)
