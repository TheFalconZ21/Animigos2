from rest_framework import serializers
from .models import Anime

class AnimeSerializer(serializers.ModelSerializer):
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
            'episodes',
            'duration',
            'status',
            'season',
            'season_year',
            'studio',
            'genres',
            'type',
            'airing_day',
            'broadcast_time',
            'last_synced_at',
        ]
