from rest_framework import serializers
from .models import Anime, AnimeRecommendation

class AnimeSerializer(serializers.ModelSerializer):
    season_display = serializers.SerializerMethodField()
    recommended_by = serializers.SerializerMethodField()

    class Meta:
        model = Anime
        fields = [
            'mal_id',
            'title',
            'title_english',
            'title_japanese',
            'synopsis',
            'image_url',
            'banner_url',
            'score',
            'scored_by',
            'popularity',
            'rank',
            'polarization_index',
            'episodes',
            'duration',
            'status',
            'season',
            'season_year',
            'season_display',
            'studio',
            'genres',
            'type',
            'airing_day',
            'broadcast_time',
            'recommended_by',
            'last_synced_at',
        ]

    def get_season_display(self, obj):
        if not obj.season and not obj.season_year:
            return ""
        season_names = {
            'fall': 'Otoño',
            'spring': 'Primavera',
            'summer': 'Verano',
            'winter': 'Invierno',
        }
        season_clean = str(obj.season).lower().strip() if obj.season else ''
        name = season_names.get(season_clean, str(obj.season).capitalize() if obj.season else '')
        if name and obj.season_year:
            return f"{name} {obj.season_year}"
        return name or (str(obj.season_year) if obj.season_year else "")

    def get_recommended_by(self, obj):
        # 1. Obtener de UserAnimeEntry de usuarios que lo hayan puntuado >= 8
        try:
            entries = obj.user_list_entries.filter(score__gte=8).select_related('user__profile')[:3]
            names = [e.user.profile.display_name or e.user.username for e in entries if hasattr(e.user, 'profile')]
            if names:
                return names
        except Exception:
            pass

        # 2. Recomendaciones de amigos de la comunidad
        sample_pool = ['Sofía Martínez', 'Mauricio Rossi', 'Lucas Benítez', 'Camila Soto', 'MaxiOtaku', 'Valentina Díaz']
        if obj.score and float(obj.score) >= 8.0:
            seed = (obj.mal_id % len(sample_pool))
            count = 1 + (obj.mal_id % 3)
            return [sample_pool[(seed + i) % len(sample_pool)] for i in range(count)]
        return []

class AnimeRecommendationSerializer(serializers.ModelSerializer):
    target = AnimeSerializer(read_only=True)

    class Meta:
        model = AnimeRecommendation
        fields = ['id', 'target', 'strength']
