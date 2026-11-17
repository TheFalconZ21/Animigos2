from django.contrib import admin
from django.contrib.auth.models import Permission
from .models import Profile, UserPreferences, UserAnimeFolder, UserAnimeEntry, Friendship

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'content_type', 'codename')
    search_fields = ('name', 'codename')
    list_filter = ('content_type',)
    list_per_page = 25

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'display_name', 'favorite_anime', 'created_at')
    search_fields = ('user__username', 'display_name', 'user__email')
    ordering = ('-created_at',)
    list_per_page = 25

@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ('profile', 'experience_level', 'onboarding_completed', 'preferred_duration', 'updated_at')
    list_filter = ('experience_level', 'onboarding_completed')
    search_fields = ('profile__display_name', 'profile__user__username')
    list_per_page = 25

@admin.register(UserAnimeFolder)
class UserAnimeFolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'updated_at')
    search_fields = ('name', 'user__username')
    list_filter = ('created_at',)
    ordering = ('name',)
    list_per_page = 25

@admin.register(UserAnimeEntry)
class UserAnimeEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'anime', 'status', 'score', 'episodes_watched', 'is_favorite', 'folder', 'updated_at')
    list_filter = ('status', 'is_favorite', 'score')
    search_fields = ('user__username', 'anime__title', 'notes')
    ordering = ('-updated_at',)
    list_per_page = 25

@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ('user', 'friend', 'created_at')
    search_fields = ('user__username', 'friend__username')
    ordering = ('-created_at',)
    list_per_page = 25
