from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, UserPreferences, UserAnimeFolder, UserAnimeEntry
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
    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)
    is_superuser = serializers.BooleanField(source='user.is_superuser', read_only=True)
    favorite_anime_detail = AnimeSerializer(source='favorite_anime', read_only=True)
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id',
            'username',
            'email',
            'is_staff',
            'is_superuser',
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


class UserAnimeFolderSerializer(serializers.ModelSerializer):
    entries_count = serializers.SerializerMethodField()
    average_score = serializers.SerializerMethodField()
    covers = serializers.SerializerMethodField()

    class Meta:
        model = UserAnimeFolder
        fields = [
            'id',
            'name',
            'entries_count',
            'average_score',
            'covers',
            'created_at',
            'updated_at'
        ]

    def get_entries_count(self, obj):
        return obj.entries.count()

    def get_average_score(self, obj):
        entries_with_score = obj.entries.filter(score__isnull=False)
        if not entries_with_score.exists():
            return None
        scores = [e.score for e in entries_with_score]
        return round(sum(scores) / len(scores), 1)

    def get_covers(self, obj):
        entries = obj.entries.select_related('anime').all()[:4]
        return [e.anime.image_url for e in entries if e.anime.image_url]


class UserAnimeEntrySerializer(serializers.ModelSerializer):
    anime = AnimeSerializer(read_only=True)
    mal_id = serializers.IntegerField(source='anime.mal_id', read_only=True)
    folder_id = serializers.UUIDField(source='folder.id', read_only=True, allow_null=True)
    folder_name = serializers.CharField(source='folder.name', read_only=True, allow_null=True)

    class Meta:
        model = UserAnimeEntry
        fields = [
            'id',
            'mal_id',
            'status',
            'score',
            'episodes_watched',
            'is_favorite',
            'folder_id',
            'folder_name',
            'tags',
            'notes',
            'anime',
            'created_at',
            'updated_at',
        ]

