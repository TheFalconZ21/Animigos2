from django.contrib import admin
from .models import SharedList, SharedListMember, SharedListCandidate, SharedListVote

class SharedListMemberInline(admin.TabularInline):
    model = SharedListMember
    extra = 0

class SharedListCandidateInline(admin.TabularInline):
    model = SharedListCandidate
    extra = 0

@admin.register(SharedList)
class SharedListAdmin(admin.ModelAdmin):
    list_display = ('name', 'invite_code', 'status', 'selected_anime', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'invite_code')
    inlines = [SharedListMemberInline, SharedListCandidateInline]

@admin.register(SharedListCandidate)
class SharedListCandidateAdmin(admin.ModelAdmin):
    list_display = ('anime', 'shared_list', 'suggested_by', 'added_at')
    list_filter = ('added_at',)
    search_fields = ('anime__title', 'shared_list__name')

@admin.register(SharedListVote)
class SharedListVoteAdmin(admin.ModelAdmin):
    list_display = ('voter_name', 'interest_score', 'candidate', 'voted_at')
    list_filter = ('interest_score', 'voted_at')
    search_fields = ('voter_name', 'candidate__anime__title')
