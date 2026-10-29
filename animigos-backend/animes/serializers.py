from rest_framework import serializers
from .models import Anime, AnimeRecommendation, AnimeScoreHistory

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
            'tags_data',
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
        return []

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if getattr(instance, 'synopsis_es', None):
            data['synopsis'] = instance.synopsis_es
        return data

class AnimeRecommendationSerializer(serializers.ModelSerializer):
    target = AnimeSerializer(read_only=True)

    class Meta:
        model = AnimeRecommendation
        fields = ['id', 'target', 'strength']


class AnimeScoreHistorySerializer(serializers.ModelSerializer):
    period_label = serializers.SerializerMethodField()

    class Meta:
        model = AnimeScoreHistory
        fields = [
            'id',
            'year',
            'month',
            'recorded_at',
            'period_label',
            'score',
            'scored_by',
            'members',
            'rank',
            'popularity',
            'favorites',
        ]

    def get_period_label(self, obj):
        if obj.month and obj.month != 1:
            month_names = {
                1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
                7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
            }
            m_abbr = month_names.get(obj.month, f"{obj.month:02d}")
            return f"{m_abbr} {obj.year}"
        return str(obj.year)

