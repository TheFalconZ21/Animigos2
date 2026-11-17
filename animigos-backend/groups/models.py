import uuid
import secrets
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from animes.models import Anime

def generate_invite_code():
    return secrets.token_hex(4).upper()

class SharedList(models.Model):
    STATUS_CHOICES = [
        ('deciding', 'Decidiendo'),
        ('watching', 'Viendo'),
        # Compatibilidad histórica
        ('voting', 'Decidiendo'),
        ('candidates', 'Decidiendo'),
        ('selected', 'Viendo'),
        ('completed', 'Completado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='deciding')
    invite_code = models.CharField(max_length=20, unique=True, default=generate_invite_code, db_index=True)
    selected_anime = models.ForeignKey(Anime, null=True, blank=True, on_delete=models.SET_NULL, related_name='selected_in_groups')
    current_episode = models.PositiveIntegerField(default=1, help_text="Capítulo objetivo en el que va el grupo")
    max_members = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(2), MaxValueValidator(100)],
        help_text="Cantidad máxima de miembros permitidos en la sala"
    )
    criteria_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Criterios acordados para postulación (duración, géneros, años, etc.)"
    )
    next_session_date = models.DateTimeField(null=True, blank=True, help_text="Fecha y hora de la próxima reunión")
    session_notes = models.TextField(blank=True, default='', help_text="Notas o acuerdos de la sesión")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Lista Compartida"
        verbose_name_plural = "Listas Compartidas (Salas)"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} [{self.invite_code}]"


class SharedListMember(models.Model):
    ROLE_CHOICES = [
        ('owner', 'Creador / Moderador'),
        ('member', 'Miembro Registrado'),
        ('guest', 'Invitado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shared_list = models.ForeignKey(SharedList, on_delete=models.CASCADE, related_name='members')
    guest_token = models.CharField(max_length=100, blank=True, default='')
    guest_name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    invite_channel = models.CharField(max_length=30, blank=True, default='link')
    episodes_watched = models.PositiveIntegerField(default=0, help_text="Capítulo hasta el que ha visto este miembro")
    last_active_at = models.DateTimeField(auto_now=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Miembro de Sala"
        verbose_name_plural = "Miembros de Sala"
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.guest_name} ({self.role}) - {self.shared_list.name}"


class SharedListCandidate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shared_list = models.ForeignKey(SharedList, on_delete=models.CASCADE, related_name='candidates')
    anime = models.ForeignKey(Anime, on_delete=models.CASCADE, related_name='candidate_entries')
    suggested_by = models.CharField(max_length=100, blank=True, default='Anónimo')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Candidato de Sala"
        verbose_name_plural = "Candidatos de Sala"
        constraints = [
            models.UniqueConstraint(fields=['shared_list', 'anime'], name='unique_candidate_per_list')
        ]
        ordering = ['added_at']

    def __str__(self):
        return f"{self.anime.title} en {self.shared_list.name}"


class SharedListVote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(SharedListCandidate, on_delete=models.CASCADE, related_name='votes')
    voter_id = models.CharField(max_length=100, help_text="ID de usuario o token de invitado")
    voter_name = models.CharField(max_length=100)
    interest_score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Ganas de ver el anime (escala de 0 a 10)"
    )
    voted_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Voto de Interés"
        verbose_name_plural = "Votos de Interés"
        constraints = [
            models.UniqueConstraint(fields=['candidate', 'voter_id'], name='unique_vote_per_candidate_voter')
        ]
        ordering = ['-voted_at']

    def __str__(self):
        return f"{self.voter_name} votó {self.interest_score}/10 por {self.candidate.anime.title}"


class SharedListWatchingAnime(models.Model):
    """
    Animes actualmente seleccionados por el creador para ver en maratón grupal.
    Permite múltiples animes simultáneos en una misma sala.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shared_list = models.ForeignKey(SharedList, on_delete=models.CASCADE, related_name='watching_animes')
    anime = models.ForeignKey(Anime, on_delete=models.CASCADE, related_name='watching_in_groups')
    current_episode = models.PositiveIntegerField(default=1, help_text="Meta grupal de capítulo para este anime")
    is_active = models.BooleanField(default=True, help_text="Si este anime sigue en maratón activa")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Anime en Maratón"
        verbose_name_plural = "Animes en Maratón"
        constraints = [
            models.UniqueConstraint(fields=['shared_list', 'anime'], name='unique_watching_anime_per_list')
        ]
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.anime.title} en {self.shared_list.name} (Cap {self.current_episode})"


class SharedListAnimeParticipation(models.Model):
    """
    Participación de un miembro en un anime específico que la sala está viendo en simultáneo.
    Rastrea si el miembro eligió 'Participar' y sus capítulos vistos en este anime.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    watching_anime = models.ForeignKey(SharedListWatchingAnime, on_delete=models.CASCADE, related_name='participations')
    member = models.ForeignKey(SharedListMember, on_delete=models.CASCADE, related_name='anime_participations')
    episodes_watched = models.PositiveIntegerField(default=0, help_text="Capítulos vistos por este miembro en este anime")
    is_participating = models.BooleanField(default=True, help_text="Si el miembro ha aceptado participar en este anime")
    joined_at = models.DateTimeField(auto_now_add=True)
    last_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Participación en Anime Grupal"
        verbose_name_plural = "Participaciones en Anime Grupal"
        constraints = [
            models.UniqueConstraint(fields=['watching_anime', 'member'], name='unique_member_per_watching_anime')
        ]
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.member.guest_name} en {self.watching_anime.anime.title} (Cap {self.episodes_watched})"
