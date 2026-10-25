from django.contrib import admin
from .models import Anime

@admin.register(Anime)
class AnimeAdmin(admin.ModelAdmin):
    list_display = ('mal_id', 'title', 'studio', 'score', 'season_year', 'episodes', 'status')
    list_filter = ('status', 'season_year', 'type')
    search_fields = ('title', 'title_english', 'studio')
    ordering = ('-score',)
    list_per_page = 25
