import json
import os
from pathlib import Path
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from users.models import Profile, UserPreferences, Friendship

class Command(BaseCommand):
    help = "Puebla la base de datos con los usuarios de desarrollo, perfiles y amistades iniciales."

    def handle(self, *args, **options):
        possible_paths = [
            Path(__file__).resolve().parent.parent / 'data' / 'seed_users_data.json',
            Path(os.getcwd()) / 'users' / 'data' / 'seed_users_data.json',
        ]
        json_path = None
        for p in possible_paths:
            if p.exists():
                json_path = p
                break

        if not json_path:
            self.stderr.write(self.style.ERROR("No se encontró seed_users_data.json."))
            return

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 1. Users
        created_users = 0
        user_map = {}
        for u in data.get('users', []):
            user, created = User.objects.get_or_create(
                username=u['username'],
                defaults={
                    'email': u['email'],
                    'first_name': u.get('first_name', ''),
                    'last_name': u.get('last_name', ''),
                    'is_staff': u.get('is_staff', False),
                    'is_superuser': u.get('is_superuser', False),
                    'is_active': u.get('is_active', True),
                }
            )
            # Asegurar la contraseña cifrada
            if created or user.password != u['password']:
                user.password = u['password']
                user.email = u['email']
                user.is_staff = u.get('is_staff', False)
                user.is_superuser = u.get('is_superuser', False)
                user.save()
            user_map[u['id']] = user
            if created:
                created_users += 1

        self.stdout.write(f"Usuarios sincronizados: {len(user_map)} (creados: {created_users}).")

        # 2. Profiles
        for p in data.get('profiles', []):
            user = user_map.get(p['user_id']) or User.objects.filter(pk=p['user_id']).first()
            if not user:
                continue
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.display_name = p.get('display_name') or user.username
            profile.avatar_url = p.get('avatar_url', '')
            profile.bio = p.get('bio', '')
            fav_id = p.get('favorite_anime_id')
            if fav_id:
                try:
                    from animes.models import Anime
                    if Anime.objects.filter(pk=fav_id).exists():
                        profile.favorite_anime_id = fav_id
                except Exception:
                    pass
            profile.save()

        # 3. Preferences
        for pr in data.get('preferences', []):
            # Encontrar el perfil
            try:
                profile = Profile.objects.filter(pk=pr['profile_id']).first()
                if not profile:
                    continue
                pref, _ = UserPreferences.objects.get_or_create(profile=profile)
                pref.onboarding_completed = pr.get('onboarding_completed', True)
                pref.experience_level = pr.get('experience_level', 'intermedio')
                pref.favorite_genres = pr.get('favorite_genres', [])
                pref.disliked_genres = pr.get('disliked_genres', [])
                pref.preferred_duration = pr.get('preferred_duration', '')
                pref.privacy_settings = pr.get('privacy_settings', {})
                pref.save()
            except Exception:
                pass

        # 4. Friendships
        for fr in data.get('friendships', []):
            try:
                u1 = user_map.get(fr['user_id']) or User.objects.filter(pk=fr['user_id']).first()
                u2 = user_map.get(fr['friend_id']) or User.objects.filter(pk=fr['friend_id']).first()
                if u1 and u2 and u1 != u2:
                    Friendship.objects.get_or_create(user=u1, friend=u2)
            except Exception:
                pass

        self.stdout.write(self.style.SUCCESS("Base de datos de usuarios poblada exitosamente."))

