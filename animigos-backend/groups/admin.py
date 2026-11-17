from django.contrib import admin
from .models import (
    SharedList,
    SharedListMember,
    SharedListCandidate,
    SharedListVote,
    SharedListWatchingAnime,
    SharedListAnimeParticipation,
)

class SharedListMemberInline(admin.TabularInline):
    model = SharedListMember
    extra = 0

class SharedListCandidateInline(admin.TabularInline):
    model = SharedListCandidate
    extra = 0

class SharedListWatchingAnimeInline(admin.TabularInline):
    model = SharedListWatchingAnime
    extra = 0

@admin.register(SharedList)
class SharedListAdmin(admin.ModelAdmin):
    list_display = ('name', 'invite_code', 'status', 'selected_anime', 'current_episode', 'max_members', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'invite_code')
    inlines = [SharedListMemberInline, SharedListCandidateInline, SharedListWatchingAnimeInline]
    list_per_page = 25

@admin.register(SharedListMember)
class SharedListMemberAdmin(admin.ModelAdmin):
    list_display = ('guest_name', 'role', 'shared_list', 'episodes_watched', 'guest_token', 'joined_at')
    list_filter = ('role', 'joined_at')
    search_fields = ('guest_name', 'guest_token', 'shared_list__name')
    list_per_page = 25

@admin.register(SharedListCandidate)
class SharedListCandidateAdmin(admin.ModelAdmin):
    list_display = ('anime', 'shared_list', 'suggested_by', 'added_at')
    list_filter = ('added_at',)
    search_fields = ('anime__title', 'shared_list__name')
    list_per_page = 25

@admin.register(SharedListVote)
class SharedListVoteAdmin(admin.ModelAdmin):
    list_display = ('voter_name', 'interest_score', 'candidate', 'voted_at')
    list_filter = ('interest_score', 'voted_at')
    search_fields = ('voter_name', 'candidate__anime__title')
    list_per_page = 25

@admin.register(SharedListWatchingAnime)
class SharedListWatchingAnimeAdmin(admin.ModelAdmin):
    list_display = ('anime', 'shared_list', 'current_episode', 'is_active', 'started_at')
    list_filter = ('is_active', 'started_at')
    search_fields = ('anime__title', 'shared_list__name')
    list_per_page = 25

@admin.register(SharedListAnimeParticipation)
class SharedListAnimeParticipationAdmin(admin.ModelAdmin):
    list_display = ('member', 'watching_anime', 'episodes_watched', 'is_participating', 'last_updated_at')
    list_filter = ('is_participating', 'last_updated_at')
    search_fields = ('member__guest_name', 'watching_anime__anime__title')
    list_per_page = 25
