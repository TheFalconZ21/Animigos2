from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, UserPreferences
from animes.serializers import AnimeSerializer

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = [
            'id',
            'onboarding_completed',
            'experience_level',
            'favorite_genres',
            'disliked_genres',
            'preferred_duration',
            'privacy_settings',
            'updated_at'
        ]


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    favorite_anime_detail = AnimeSerializer(source='favorite_anime', read_only=True)
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id',
            'username',
            'email',
            'display_name',
            'avatar_url',
            'bio',
            'favorite_anime',
            'favorite_anime_detail',
            'preferences',
            'created_at',
            'updated_at'
        ]


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    display_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'display_name']

    def create(self, validated_data):
        display_name = validated_data.pop('display_name', '')
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()

        if display_name and hasattr(user, 'profile'):
            user.profile.display_name = display_name
            user.profile.save(update_fields=['display_name'])

        return user
