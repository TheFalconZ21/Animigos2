from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
from animes.models import Anime
from .serializers import (
    SharedListSerializer,
    SharedListMemberSerializer,
    SharedListCandidateSerializer,
    SharedListVoteSerializer,
)

class SharedListViewSet(viewsets.ModelViewSet):
    """
    API endpoint para gestionar salas de votación grupal (Listas Compartidas).
    Aislado por pertenencia de usuario (Zero Trust).
    """
    serializer_class = SharedListSerializer

    def get_queryset(self):
        qs = SharedList.objects.all().prefetch_related('members', 'candidates__votes', 'candidates__anime')
        user = self.request.user
        token = self.request.query_params.get('token')

        if user.is_authenticated:
            display_name = getattr(getattr(user, 'profile', None), 'display_name', '')
            user_filter = (
                Q(members__guest_token=f"user_{user.id}") |
                Q(members__guest_token=str(user.id)) |
                Q(members__guest_name=user.username)
            )
            if display_name:
                user_filter |= Q(members__guest_name=display_name)
            return qs.filter(user_filter).distinct()

        if token:
            return qs.filter(members__guest_token=token).distinct()

        return qs.none()

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', 'Sala de Anime con Amigos')
        description = request.data.get('description', '')
        user = request.user

        if user.is_authenticated:
            creator_name = getattr(getattr(user, 'profile', None), 'display_name', None) or user.username
            guest_token = f"user_{user.id}"
        else:
            creator_name = request.data.get('creator_name', 'Creador')
            guest_token = request.data.get('guest_token', '')

        shared_list = SharedList.objects.create(name=name, description=description)
        
        # Registrar al creador como miembro 'owner'
        SharedListMember.objects.create(
            shared_list=shared_list,
            guest_name=creator_name,
            guest_token=guest_token,
            role='owner'
        )

        serializer = self.get_serializer(shared_list)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def by_code(self, request):
        """Busca una sala usando su código de invitación (abierto para que cualquiera pueda unirse)."""
        code = request.query_params.get('code', '').strip().upper()
        if not code:
            return Response({'error': 'Parámetro code requerido'}, status=status.HTTP_400_BAD_REQUEST)

        shared_list = get_object_or_404(
            SharedList.objects.prefetch_related('members', 'candidates__votes', 'candidates__anime'),
            invite_code=code
        )
        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Une a un usuario/invitado a la sala."""
        shared_list = self.get_object()
        user = request.user

        if user.is_authenticated:
            guest_name = getattr(getattr(user, 'profile', None), 'display_name', None) or user.username
            guest_token = f"user_{user.id}"
        else:
            guest_name = request.data.get('guest_name', '').strip()
            guest_token = request.data.get('guest_token', '').strip()

        if not guest_name:
            return Response({'error': 'guest_name es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        # Si ya existe un miembro con ese token o nombre en esta sala, no duplicarlo
        member = SharedListMember.objects.filter(
            shared_list=shared_list
        ).filter(
            Q(guest_token=guest_token) | Q(guest_name=guest_name)
        ).first()

        if not member:
            member = SharedListMember.objects.create(
                shared_list=shared_list,
                guest_name=guest_name,
                guest_token=guest_token,
                role='member'
            )
            created = True
        else:
            created = False
            if guest_token and not member.guest_token:
                member.guest_token = guest_token
                member.save(update_fields=['guest_token'])

        return Response(SharedListMemberSerializer(member).data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def nominate(self, request, pk=None):
        """Postula un anime como candidato para la votación grupal."""
        shared_list = self.get_object()
        mal_id = request.data.get('anime_id') or request.data.get('mal_id')
        suggested_by = request.data.get('suggested_by', 'Anónimo')

        if not mal_id:
            return Response({'error': 'anime_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        anime = get_object_or_404(Anime, mal_id=mal_id)

        if SharedListCandidate.objects.filter(shared_list=shared_list, anime=anime).exists():
            return Response({'error': 'Este anime ya fue postulado a la sala'}, status=status.HTTP_400_BAD_REQUEST)

        candidate = SharedListCandidate.objects.create(
            shared_list=shared_list,
            anime=anime,
            suggested_by=suggested_by
        )

        return Response(SharedListCandidateSerializer(candidate).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        """Emite o actualiza un voto de interés (0 a 10) para un candidato."""
        shared_list = self.get_object()
        candidate_id = request.data.get('candidate_id')
        voter_id = request.data.get('voter_id')
        voter_name = request.data.get('voter_name', 'Invitado')
        interest_score = request.data.get('interest_score')

        if candidate_id is None or voter_id is None or interest_score is None:
            return Response({'error': 'candidate_id, voter_id y interest_score son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            score_val = int(interest_score)
            if score_val < 0 or score_val > 10:
                raise ValueError()
        except ValueError:
            return Response({'error': 'interest_score debe ser un entero entre 0 y 10'}, status=status.HTTP_400_BAD_REQUEST)

        candidate = get_object_or_404(SharedListCandidate, id=candidate_id, shared_list=shared_list)

        vote, created = SharedListVote.objects.update_or_create(
            candidate=candidate,
            voter_id=voter_id,
            defaults={
                'voter_name': voter_name,
                'interest_score': score_val
            }
        )

        return Response(SharedListVoteSerializer(vote).data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def select_winner(self, request, pk=None):
        """Marca un anime como ganador de la sala e inicia fase de visualización grupal."""
        shared_list = self.get_object()
        mal_id = request.data.get('anime_id')
        anime = get_object_or_404(Anime, mal_id=mal_id)

        shared_list.selected_anime = anime
        shared_list.status = 'watching'
        shared_list.save(update_fields=['selected_anime', 'status', 'updated_at'])

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def update_my_progress(self, request, pk=None):
        """Actualiza el progreso de capítulos vistos de un miembro en la sala."""
        shared_list = self.get_object()
        guest_token = request.data.get('guest_token', '').strip()
        guest_name = request.data.get('guest_name', '').strip()
        episodes_watched = request.data.get('episodes_watched')

        if episodes_watched is None:
            return Response({'error': 'episodes_watched es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            episodes_watched = max(0, int(episodes_watched))
        except (ValueError, TypeError):
            return Response({'error': 'episodes_watched debe ser un número entero válido'}, status=status.HTTP_400_BAD_REQUEST)

        member = None
        if guest_token:
            member = shared_list.members.filter(guest_token=guest_token).first()
        if not member and guest_name:
            member = shared_list.members.filter(guest_name=guest_name).first()

        if not member:
            member = SharedListMember.objects.create(
                shared_list=shared_list,
                guest_token=guest_token,
                guest_name=guest_name or 'Miembro',
                role='member',
                episodes_watched=episodes_watched
            )
        else:
            member.episodes_watched = episodes_watched
            member.save(update_fields=['episodes_watched', 'last_active_at'])

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def set_group_episode(self, request, pk=None):
        """Actualiza la meta del capítulo en el que va la sala."""
        shared_list = self.get_object()
        episode = request.data.get('episode')
        if episode is None:
            return Response({'error': 'episode es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ep_val = max(1, int(episode))
        except (ValueError, TypeError):
            return Response({'error': 'episode debe ser un entero positivo'}, status=status.HTTP_400_BAD_REQUEST)

        shared_list.current_episode = ep_val
        if shared_list.status in ('selected', 'voting'):
            shared_list.status = 'watching'
        shared_list.save(update_fields=['current_episode', 'status', 'updated_at'])

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def schedule_session(self, request, pk=None):
        """Agenda la fecha/hora y acuerdos para la próxima sesión grupal."""
        shared_list = self.get_object()
        next_session_date = request.data.get('next_session_date')
        session_notes = request.data.get('session_notes', '')

        shared_list.next_session_date = next_session_date or None
        shared_list.session_notes = session_notes
        shared_list.save(update_fields=['next_session_date', 'session_notes', 'updated_at'])

        return Response(self.get_serializer(shared_list).data)

