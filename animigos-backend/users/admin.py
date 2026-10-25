from django.contrib import admin
from .models import Profile, UserPreferences

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'display_name', 'favorite_anime', 'created_at')
    search_fields = ('user__username', 'display_name', 'user__email')

@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ('profile', 'experience_level', 'onboarding_completed', 'updated_at')
    list_filter = ('experience_level', 'onboarding_completed')
