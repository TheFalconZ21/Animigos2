import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
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


class UserAnimeFolder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='anime_folders')
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Carpeta de Anime"
        verbose_name_plural = "Carpetas de Anime"
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_user_folder_name')
        ]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class UserAnimeEntry(models.Model):
    STATUS_CHOICES = [
        ('visto', 'Visto'),
        ('viendo', 'Viendo'),
        ('pendiente', 'Pendiente'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='anime_list_entries')
    anime = models.ForeignKey(Anime, on_delete=models.CASCADE, related_name='user_list_entries')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendiente', db_index=True)
    score = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="Calificación personal del usuario (1 a 10)"
    )
    episodes_watched = models.PositiveIntegerField(default=0)
    is_favorite = models.BooleanField(default=False, db_index=True)
    folder = models.ForeignKey(
        UserAnimeFolder,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='entries'
    )
    tags = models.JSONField(
        default=list, blank=True,
        help_text="Lista de etiquetas personalizadas: ['#lloré', '#soundtrack-10']"
    )
    notes = models.TextField(blank=True, default='', help_text="Comentario o reseña personal")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Entrada de Mi Lista"
        verbose_name_plural = "Entradas de Mi Lista"
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'anime'], name='unique_user_anime_list_entry')
        ]

    def __str__(self):
        return f"{self.user.username} - {self.anime.title} [{self.status}]"


class Friendship(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships')
    friend = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_of')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Amistad"
        verbose_name_plural = "Amistades"
        constraints = [
            models.UniqueConstraint(fields=['user', 'friend'], name='unique_friendship')
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} <-> {self.friend.username}"
