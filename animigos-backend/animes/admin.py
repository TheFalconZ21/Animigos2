from django.contrib import admin
from .models import Anime, AnimeRecommendation, AnimeScoreHistory, ExternalReferenceMedia

@admin.register(Anime)
class AnimeAdmin(admin.ModelAdmin):
    list_display = ('mal_id', 'title', 'studio', 'score', 'season_year', 'episodes', 'status')
    list_filter = ('status', 'season_year', 'type')
    search_fields = ('title', 'title_english', 'studio')
    ordering = ('-score',)
    list_per_page = 25

@admin.register(AnimeScoreHistory)
class AnimeScoreHistoryAdmin(admin.ModelAdmin):
    list_display = ('anime', 'year', 'month', 'score', 'scored_by', 'members', 'rank', 'recorded_at')
    list_filter = ('year', 'month')
    search_fields = ('anime__title', 'anime__mal_id')
    ordering = ('-recorded_at',)
    list_per_page = 25

@admin.register(AnimeRecommendation)
class AnimeRecommendationAdmin(admin.ModelAdmin):
    list_display = ('source', 'target', 'strength', 'created_at')
    search_fields = ('source__title', 'target__title')
    ordering = ('-strength',)
    list_per_page = 25

@admin.register(ExternalReferenceMedia)
class ExternalReferenceMediaAdmin(admin.ModelAdmin):
    list_display = ('title', 'media_type', 'release_year', 'vote_average', 'vote_count', 'popularity', 'created_at')
    list_filter = ('media_type', 'release_year')
    search_fields = ('title', 'original_title', 'tmdb_id')
    ordering = ('-popularity',)
    list_per_page = 25
