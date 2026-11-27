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
        default='/media/avatars/crunchyroll_classic_collection/classic-hime-avatar-1.webp'
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
    # Vinculación Google Sign-In (openid email profile)
    google_sub = models.CharField(max_length=128, blank=True, null=True, unique=True)
    # Datos demográficos y de ubicación (opcionales/voluntarios + detección automática por IP)
    country = models.CharField(max_length=80, blank=True, default='')
    region = models.CharField(max_length=100, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    timezone_name = models.CharField(max_length=64, blank=True, default='')
    birth_year = models.PositiveSmallIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=32, blank=True, default='')
    demographics_prompted = models.BooleanField(default=False)
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
        ('dropeado', 'Dropeado'),
        ('esperando', 'Esperando su estreno'),
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


class FriendRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('accepted', 'Aceptada'),
        ('rejected', 'Rechazada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_friend_requests')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_friend_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Solicitud de Amistad"
        verbose_name_plural = "Solicitudes de Amistad"
        constraints = [
            models.UniqueConstraint(fields=['from_user', 'to_user'], name='unique_friend_request_pair')
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.from_user.username} -> {self.to_user.username} [{self.status}]"


class ContentReport(models.Model):
    """Reporte de contenido o conducta ofensiva enviado por un usuario para revisión en Moderación."""
    CONTENT_TYPE_CHOICES = [
        ('profile_wall', 'Comentario en Muro'),
        ('chat_message', 'Mensaje en Chat Grupal'),
        ('recommendation', 'Recomendación'),
        ('suggestion', 'Sugerencia / Búsqueda'),
        ('poll', 'Encuesta'),
        ('other', 'Otro'),
    ]

    CATEGORY_CHOICES = [
        ('toxicity', 'Conducta ofensiva / Acoso'),
        ('spoilers', 'Spoilers sin etiqueta'),
        ('spam', 'Spam / Contenido inapropiado'),
        ('other', 'Otro'),
    ]

    SEVERITY_CHOICES = [
        ('high', 'Alta'),
        ('medium', 'Media'),
        ('low', 'Baja'),
    ]

    STATUS_CHOICES = [
        ('open', 'Abierto'),
        ('resolved', 'Resuelto'),
        ('dismissed', 'Descartado'),
    ]

    reporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submitted_reports',
    )
    reported_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_reports',
    )
    reported_username = models.CharField(max_length=150, blank=True, default='')
    content_type = models.CharField(max_length=32, choices=CONTENT_TYPE_CHOICES, default='other')
    category = models.CharField(max_length=24, choices=CATEGORY_CHOICES, default='toxicity')
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default='high')
    reason = models.TextField(blank=True, default='')
    target_id = models.CharField(max_length=120, blank=True, default='')
    target_excerpt = models.TextField(blank=True, default='')
    context_label = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_reports',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report #{self.id} [{self.content_type}/{self.category}] by {self.reporter.username} ({self.status})"


class SocialPost(models.Model):
    """
    Publicación persistente en El Tablón Social (recomendaciones, pedidos de sugerencia,
    encuestas e invitaciones) compartida en tiempo real entre amigos y comunidad en PostgreSQL.
    """
    POST_TYPE_CHOICES = [
        ('recomendacion_directa', 'Recomendación Directa'),
        ('recomendacion_general', 'Recomendación General'),
        ('busco_anime', 'Pide Sugerencias'),
        ('encuesta', 'Encuesta'),
        ('invitacion_sala', 'Invitación a Sala'),
        ('hito', 'Logro'),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='social_posts',
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_social_posts',
    )
    post_type = models.CharField(max_length=32, choices=POST_TYPE_CHOICES, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    liked_by = models.JSONField(default=list, blank=True)
    poll_votes = models.JSONField(default=dict, blank=True)
    replies = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"SocialPost {self.id} [{self.post_type}] by {self.author.username}"


class UserFavoriteCharacter(models.Model):
    """
    Personajes favoritos marcados por cada usuario en Animigos.
    Se exhiben debajo del Hall of Fame en el perfil y suman reactivamente
    a la popularidad (conteo de favoritos) de cada personaje en la plataforma.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='favorite_characters',
    )
    character_id = models.IntegerField(db_index=True, help_text="ID del personaje en AniList")
    character_name = models.CharField(max_length=255)
    character_native = models.CharField(max_length=255, blank=True, default='')
    character_image = models.TextField(blank=True, default='')
    role_display = models.CharField(max_length=80, blank=True, default='Principal')
    anime_mal_id = models.IntegerField(null=True, blank=True, db_index=True)
    anime_title = models.CharField(max_length=300, blank=True, default='')
    base_favourites = models.IntegerField(default=0, help_text="Favoritos globales base de AniList")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Personaje Favorito de Usuario"
        verbose_name_plural = "Personajes Favoritos de Usuarios"
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'character_id'],
                name='unique_user_favorite_character',
            )
        ]

    def __str__(self):
        return f"{self.user.username} ♥ {self.character_name} ({self.character_id})"

