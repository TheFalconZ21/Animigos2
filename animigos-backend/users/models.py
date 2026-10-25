import uuid
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from animes.models import Anime

class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)
    avatar_url = models.TextField(
        blank=True,
        default='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    )
    bio = models.TextField(
        blank=True,
        default='¡Hola! Estoy usando Animigos para coordinar animes con mis amigos 🍿'
    )
    favorite_anime = models.ForeignKey(
        Anime,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='favorited_by_profiles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil de Usuario"
        verbose_name_plural = "Perfiles de Usuario"
        ordering = ['-created_at']

    def __str__(self):
        return f"Perfil de {self.display_name or self.user.username}"


class UserPreferences(models.Model):
    EXPERIENCE_CHOICES = [
        ('beginner', 'Principiante'),
        ('intermediate', 'Intermedio'),
        ('expert', 'Otaku Experto'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name='preferences')
    onboarding_completed = models.BooleanField(default=False)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_CHOICES, default='intermediate')
    favorite_genres = models.JSONField(
        default=list,
        help_text="Lista de géneros preferidos: ['Action', 'Comedy', 'Sci-Fi']"
    )
    disliked_genres = models.JSONField(
        default=list,
        help_text="Géneros vetados o que no desea ver: ['Horror', 'Ecchi']"
    )
    preferred_duration = models.CharField(
        max_length=30,
        blank=True,
        default='12-24',
        help_text="Duración ideal en episodios ('12', '12-24', 'peliculas', 'largos')"
    )
    privacy_settings = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Preferencias de Usuario"
        verbose_name_plural = "Preferencias de Usuarios"

    def __str__(self):
        return f"Preferencias de {self.profile.display_name or self.profile.user.username}"


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        profile = Profile.objects.create(
            user=instance,
            display_name=instance.first_name or instance.username
        )
        UserPreferences.objects.create(profile=profile)
