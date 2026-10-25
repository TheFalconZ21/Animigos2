import uuid
import secrets
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from animes.models import Anime

def generate_invite_code():
    return secrets.token_hex(4).upper()

class SharedList(models.Model):
    STATUS_CHOICES = [
        ('candidates', 'Postulación de Candidatos'),
        ('voting', 'Votación Abierta'),
        ('selected', 'Anime Seleccionado'),
        ('watching', 'Viendo en Grupo'),
        ('completed', 'Completado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='voting')
    invite_code = models.CharField(max_length=20, unique=True, default=generate_invite_code, db_index=True)
    selected_anime = models.ForeignKey(Anime, null=True, blank=True, on_delete=models.SET_NULL, related_name='selected_in_groups')
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
