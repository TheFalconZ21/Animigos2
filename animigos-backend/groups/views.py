from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import (
    SharedList,
    SharedListMember,
    SharedListCandidate,
    SharedListVote,
    SharedListWatchingAnime,
    SharedListAnimeParticipation,
)
from users.models import UserAnimeEntry
from animes.models import Anime
from .serializers import (
    SharedListSerializer,
    SharedListMemberSerializer,
    SharedListCandidateSerializer,
    SharedListVoteSerializer,
    SharedListWatchingAnimeSerializer,
    SharedListAnimeParticipationSerializer,
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
            profile_id = getattr(getattr(user, 'profile', None), 'id', '')
            user_filter = (
                Q(members__guest_token=f"user_{user.id}") |
                Q(members__guest_token=str(user.id)) |
                Q(members__guest_name=user.username)
            )
            if profile_id:
                user_filter |= Q(members__guest_token=f"user_{profile_id}") | Q(members__guest_token=str(profile_id))
            if display_name:
                user_filter |= Q(members__guest_name=display_name)
            return qs.filter(user_filter).distinct()

        if token:
            return qs.filter(members__guest_token=token).distinct()

        return qs.none()

    def _is_owner(self, shared_list, request) -> bool:
        """Verifica si el usuario actual autenticado o poseedor del guest_token es el creador/anfitrión de la sala."""
        user = request.user
        token = (
            request.data.get('guest_token')
            or request.query_params.get('token')
            or request.query_params.get('guest_token')
        )

        if user and user.is_authenticated:
            profile_id = getattr(getattr(user, 'profile', None), 'id', '')
            owner_filter = (
                Q(guest_token=f"user_{user.id}") |
                Q(guest_token=str(user.id)) |
                Q(guest_name=user.username)
            )
            if profile_id:
                owner_filter |= Q(guest_token=f"user_{profile_id}") | Q(guest_token=str(profile_id))
            display_name = getattr(getattr(user, 'profile', None), 'display_name', '')
            if display_name:
                owner_filter |= Q(guest_name=display_name)
            if token:
                owner_filter |= Q(guest_token=token)

            if shared_list.members.filter(role='owner').filter(owner_filter).exists():
                return True

        if token:
            return shared_list.members.filter(role='owner', guest_token=token).exists()

        return False

    def create(self, request, *args, **kwargs):
        import urllib.parse
        name = request.data.get('name', 'Sala de Anime con Amigos')
        description = request.data.get('description', '')
        user = request.user

        guest_token = request.data.get('guest_token', '').strip()

        if user.is_authenticated:
            creator_name = getattr(getattr(user, 'profile', None), 'display_name', None) or user.username
            profile_id = getattr(getattr(user, 'profile', None), 'id', None)
            if not guest_token:
                guest_token = f"user_{profile_id}" if profile_id else f"user_{user.id}"
        else:
            creator_name = request.data.get('creator_name', 'Creador')

        creator_name = urllib.parse.unquote_plus(creator_name)
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
        import urllib.parse
        shared_list = self.get_object()
        user = request.user
        guest_token = request.data.get('guest_token', '').strip()

        if user.is_authenticated:
            guest_name = getattr(getattr(user, 'profile', None), 'display_name', None) or user.username
            profile_id = getattr(getattr(user, 'profile', None), 'id', None)
            if not guest_token:
                guest_token = f"user_{profile_id}" if profile_id else f"user_{user.id}"
        else:
            guest_name = request.data.get('guest_name', '').strip()

        guest_name = urllib.parse.unquote_plus(guest_name)

        if not guest_name:
            return Response({'error': 'guest_name es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        # Si ya existe un miembro con ese token o nombre en esta sala, no duplicarlo
        member = SharedListMember.objects.filter(
            shared_list=shared_list
        ).filter(
            Q(guest_token=guest_token) | Q(guest_name__iexact=guest_name)
        ).first()

        if not member:
            # Validar límite máximo de miembros
            current_count = shared_list.members.count()
            if current_count >= shared_list.max_members:
                return Response(
                    {'error': f'La sala ha alcanzado el límite máximo de miembros ({shared_list.max_members}).'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            member = SharedListMember.objects.create(
                shared_list=shared_list,
                guest_name=guest_name,
                guest_token=guest_token,
                role='member'
            )
            created = True
        else:
            created = False
            if guest_token and member.guest_token != guest_token:
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
        """
        Marca o desmarca un anime para ver en grupo (Solo el creador).
        Soporta múltiples animes activos simultáneos.
        Si hay al menos 1 activo, la sala pasa a 'watching' ('Viendo').
        Si no queda ninguno activo, la sala pasa a 'deciding' ('Decidiendo').
        """
        shared_list = self.get_object()

        if not self._is_owner(shared_list, request):
            return Response(
                {'error': 'Solo el creador de la sala puede seleccionar animes para ver en grupo.'},
                status=status.HTTP_403_FORBIDDEN
            )

        mal_id = request.data.get('anime_id')
        action_type = request.data.get('action', 'toggle')  # 'add', 'remove', 'toggle'

        if not mal_id:
            return Response({'error': 'anime_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        anime = get_object_or_404(Anime, mal_id=mal_id)

        watching_entry = SharedListWatchingAnime.objects.filter(shared_list=shared_list, anime=anime).first()

        if action_type == 'remove' or (action_type == 'toggle' and watching_entry and watching_entry.is_active):
            if watching_entry:
                watching_entry.is_active = False
                watching_entry.save(update_fields=['is_active'])
        else:
            if not watching_entry:
                watching_entry = SharedListWatchingAnime.objects.create(
                    shared_list=shared_list,
                    anime=anime,
                    current_episode=1,
                    is_active=True
                )
            else:
                watching_entry.is_active = True
                watching_entry.save(update_fields=['is_active'])

            # Registrar al creador automáticamente como participante
            owner_member = shared_list.members.filter(role='owner').first()
            if owner_member:
                SharedListAnimeParticipation.objects.get_or_create(
                    watching_anime=watching_entry,
                    member=owner_member,
                    defaults={'is_participating': True, 'episodes_watched': 0}
                )
                if request.user.is_authenticated:
                    UserAnimeEntry.objects.get_or_create(
                        user=request.user,
                        anime=anime,
                        defaults={'status': 'viendo', 'episodes_watched': 0}
                    )

        # Actualizar estado de la sala
        active_animes = shared_list.watching_animes.filter(is_active=True)
        if active_animes.exists():
            shared_list.status = 'watching'
            shared_list.selected_anime = active_animes.first().anime
            shared_list.current_episode = active_animes.first().current_episode
        else:
            shared_list.status = 'deciding'
            shared_list.selected_anime = None
        shared_list.save(update_fields=['status', 'selected_anime', 'current_episode', 'updated_at'])

        # Notificar por WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': self.get_serializer(shared_list).data,
                        }
                    }
                )
        except Exception:
            pass

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def join_anime(self, request, pk=None):
        """
        Un integrante selecciona 'Participar' en un anime en maratón activa.
        Para usuarios autenticados, registra automáticamente el anime en 'Mi Lista' en estado 'viendo'.
        Para invitados sin cuenta, permite acceder al tracker propio del anime en la sala.
        """
        shared_list = self.get_object()
        watching_anime_id = request.data.get('watching_anime_id')
        anime_id = request.data.get('anime_id')
        guest_token = request.data.get('guest_token', '').strip()
        guest_name = request.data.get('guest_name', '').strip()

        watching_anime = None
        if watching_anime_id:
            watching_anime = get_object_or_404(SharedListWatchingAnime, id=watching_anime_id, shared_list=shared_list, is_active=True)
        elif anime_id:
            watching_anime = get_object_or_404(SharedListWatchingAnime, shared_list=shared_list, anime__mal_id=anime_id, is_active=True)
        else:
            return Response({'error': 'watching_anime_id o anime_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        # Identificar al miembro en la sala
        member = None
        user = request.user
        if user.is_authenticated:
            profile_id = getattr(getattr(user, 'profile', None), 'id', '')
            member = shared_list.members.filter(
                Q(guest_token=f"user_{user.id}") |
                Q(guest_token=str(user.id)) |
                Q(guest_name=user.username) |
                (Q(guest_token=f"user_{profile_id}") if profile_id else Q()) |
                (Q(guest_name=getattr(user.profile, 'display_name', '')) if hasattr(user, 'profile') else Q())
            ).first()

        if not member and guest_token:
            member = shared_list.members.filter(guest_token=guest_token).first()
        if not member and guest_name:
            import urllib.parse
            clean_name = urllib.parse.unquote_plus(guest_name)
            member = shared_list.members.filter(Q(guest_name__iexact=clean_name) | Q(guest_name__iexact=guest_name)).first()

        if not member:
            return Response({'error': 'Miembro no encontrado en la sala grupal.'}, status=status.HTTP_404_NOT_FOUND)

        # Registrar o activar participación
        participation, created = SharedListAnimeParticipation.objects.get_or_create(
            watching_anime=watching_anime,
            member=member,
            defaults={'is_participating': True, 'episodes_watched': 0}
        )
        if not created and not participation.is_participating:
            participation.is_participating = True
            participation.save(update_fields=['is_participating', 'last_updated_at'])

        # Si el usuario tiene cuenta registrada, añadir/sincronizar con 'Mi Lista'
        if user.is_authenticated:
            user_entry = UserAnimeEntry.objects.filter(user=user, anime=watching_anime.anime).first()
            if not user_entry:
                UserAnimeEntry.objects.create(
                    user=user,
                    anime=watching_anime.anime,
                    status='viendo',
                    episodes_watched=participation.episodes_watched
                )
            else:
                if user_entry.status != 'viendo':
                    user_entry.status = 'viendo'
                    user_entry.save(update_fields=['status'])
                if user_entry.episodes_watched > participation.episodes_watched:
                    participation.episodes_watched = user_entry.episodes_watched
                    participation.save(update_fields=['episodes_watched'])

        # Notificar por WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': self.get_serializer(shared_list).data,
                        }
                    }
                )
        except Exception:
            pass

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def update_anime_progress(self, request, pk=None):
        """Actualiza el progreso de capítulos vistos de un miembro en un anime específico."""
        shared_list = self.get_object()
        watching_anime_id = request.data.get('watching_anime_id')
        episodes_watched = request.data.get('episodes_watched')
        guest_token = request.data.get('guest_token', '').strip()
        guest_name = request.data.get('guest_name', '').strip()

        if watching_anime_id is None or episodes_watched is None:
            return Response({'error': 'watching_anime_id y episodes_watched son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            episodes_watched = max(0, int(episodes_watched))
        except (ValueError, TypeError):
            return Response({'error': 'episodes_watched debe ser un número entero válido'}, status=status.HTTP_400_BAD_REQUEST)

        watching_anime = get_object_or_404(SharedListWatchingAnime, id=watching_anime_id, shared_list=shared_list)

        # Identificar miembro
        user = request.user
        member = None
        if user.is_authenticated:
            profile_id = getattr(getattr(user, 'profile', None), 'id', '')
            member = shared_list.members.filter(
                Q(guest_token=f"user_{user.id}") |
                Q(guest_token=str(user.id)) |
                Q(guest_name=user.username) |
                (Q(guest_token=f"user_{profile_id}") if profile_id else Q()) |
                (Q(guest_name=getattr(user.profile, 'display_name', '')) if hasattr(user, 'profile') else Q())
            ).first()

        if not member and guest_token:
            member = shared_list.members.filter(guest_token=guest_token).first()
        if not member and guest_name:
            import urllib.parse
            clean_name = urllib.parse.unquote_plus(guest_name)
            member = shared_list.members.filter(Q(guest_name__iexact=clean_name) | Q(guest_name__iexact=guest_name)).first()

        if not member:
            return Response({'error': 'Miembro no encontrado en la sala grupal.'}, status=status.HTTP_404_NOT_FOUND)

        # Actualizar participación en este anime
        part, _ = SharedListAnimeParticipation.objects.get_or_create(
            watching_anime=watching_anime,
            member=member,
            defaults={'is_participating': True, 'episodes_watched': episodes_watched}
        )
        part.episodes_watched = episodes_watched
        part.is_participating = True
        part.save(update_fields=['episodes_watched', 'is_participating', 'last_updated_at'])

        # Sincronizar en Mi Lista personal si está autenticado
        if user.is_authenticated:
            user_entry, _ = UserAnimeEntry.objects.get_or_create(
                user=user,
                anime=watching_anime.anime,
                defaults={'status': 'viendo', 'episodes_watched': episodes_watched}
            )
            user_entry.episodes_watched = episodes_watched
            total_eps = watching_anime.anime.episodes
            if total_eps and episodes_watched >= total_eps:
                user_entry.status = 'visto'
            else:
                user_entry.status = 'viendo'
            user_entry.save(update_fields=['episodes_watched', 'status'])

        # Notificar por WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': self.get_serializer(shared_list).data,
                        }
                    }
                )
        except Exception:
            pass

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def set_anime_target(self, request, pk=None):
        """Actualiza la meta de capítulo de la sala para un anime específico (Solo Creador)."""
        shared_list = self.get_object()

        if not self._is_owner(shared_list, request):
            return Response({'error': 'Solo el creador puede modificar la meta del anime.'}, status=status.HTTP_403_FORBIDDEN)

        watching_anime_id = request.data.get('watching_anime_id')
        episode = request.data.get('episode')

        if not watching_anime_id or episode is None:
            return Response({'error': 'watching_anime_id y episode son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ep_val = max(1, int(episode))
        except (ValueError, TypeError):
            return Response({'error': 'episode debe ser un entero positivo'}, status=status.HTTP_400_BAD_REQUEST)

        watching_anime = get_object_or_404(SharedListWatchingAnime, id=watching_anime_id, shared_list=shared_list)
        watching_anime.current_episode = ep_val
        watching_anime.save(update_fields=['current_episode'])

        # Notificar por WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': self.get_serializer(shared_list).data,
                        }
                    }
                )
        except Exception:
            pass

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

    @action(detail=True, methods=['post', 'patch'])
    def update_settings(self, request, pk=None):
        """Actualiza los ajustes de la sala (criterios de postulación y límite de miembros)."""
        shared_list = self.get_object()

        if not self._is_owner(shared_list, request):
            return Response(
                {'error': 'Solo el creador o anfitrión de la lista grupal puede modificar sus ajustes.'},
                status=status.HTTP_403_FORBIDDEN
            )

        updated_fields = ['updated_at']

        if 'max_members' in request.data:
            try:
                max_m = int(request.data['max_members'])
                if max_m < 2 or max_m > 100:
                    return Response(
                        {'error': 'La cantidad máxima de miembros debe estar entre 2 y 100.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                shared_list.max_members = max_m
                updated_fields.append('max_members')
            except (ValueError, TypeError):
                return Response({'error': 'max_members debe ser un entero válido.'}, status=status.HTTP_400_BAD_REQUEST)

        if 'criteria_data' in request.data:
            criteria = request.data['criteria_data']
            if isinstance(criteria, dict):
                shared_list.criteria_data = criteria
                updated_fields.append('criteria_data')

        if 'name' in request.data and request.data['name'].strip():
            shared_list.name = request.data['name'].strip()
            updated_fields.append('name')

        if 'description' in request.data:
            shared_list.description = request.data['description'].strip()
            updated_fields.append('description')

        shared_list.save(update_fields=updated_fields)

        # Difundir por WebSocket a la sala
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': self.get_serializer(shared_list).data,
                        }
                    }
                )
        except Exception:
            pass

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post'])
    def invite_friend(self, request, pk=None):
        """
        Permite al creador de la sala invitar directamente a uno de sus amigos de Animigos.
        Lo incorpora a la lista grupal, le envía una notificación accionable y actualiza la sala por WebSocket.
        """
        from django.contrib.auth.models import User
        from users.models import Friendship, Profile
        from users.views import _push_user_notification

        shared_list = self.get_object()

        if not self._is_owner(shared_list, request):
            return Response(
                {'error': 'Solo el creador de la sala puede invitar amigos directamente.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = request.user
        if not user or not user.is_authenticated:
            return Response(
                {'error': 'Debes iniciar sesión para invitar a tus amigos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        friend_id = request.data.get('friend_id')
        friend_username = str(request.data.get('friend_username') or '').strip().lstrip('@')

        target_user = None
        if friend_id is not None:
            try:
                target_user = User.objects.filter(id=int(friend_id)).select_related('profile').first()
            except (ValueError, TypeError):
                target_user = None
        if not target_user and friend_username:
            target_user = User.objects.filter(username__iexact=friend_username).select_related('profile').first()

        if not target_user:
            return Response({'error': 'No se encontró al amigo seleccionado.'}, status=status.HTTP_404_NOT_FOUND)

        if not Friendship.objects.filter(user=user, friend=target_user).exists():
            return Response(
                {'error': 'Solo puedes invitar directamente a usuarios que estén en tu lista de amigos.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_prof, _ = Profile.objects.get_or_create(
            user=target_user,
            defaults={'display_name': target_user.first_name or target_user.username},
        )
        friend_display = target_prof.display_name or target_user.first_name or target_user.username
        friend_token = f"user_{target_prof.id}" if getattr(target_prof, 'id', None) else f"user_{target_user.id}"

        existing_member = shared_list.members.filter(
            Q(guest_token=friend_token)
            | Q(guest_token=f"user_{target_user.id}")
            | Q(guest_name__iexact=friend_display)
            | Q(guest_name__iexact=target_user.username)
        ).first()

        already_in_room = existing_member is not None
        if not already_in_room:
            current_count = shared_list.members.count()
            if current_count >= shared_list.max_members:
                return Response(
                    {'error': f'La sala ha alcanzado el límite máximo de miembros ({shared_list.max_members}).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            SharedListMember.objects.create(
                shared_list=shared_list,
                guest_name=friend_display,
                guest_token=friend_token,
                role='member',
                invite_channel='friend_invite',
            )

        sender_prof = getattr(user, 'profile', None)
        sender_display = (sender_prof and sender_prof.display_name) or user.first_name or user.username
        sender_avatar = (sender_prof and sender_prof.avatar_url) or ''

        _push_user_notification(
            target_user,
            {
                'type': 'room_invitation',
                'from_username': user.username,
                'from_display_name': sender_display,
                'from_avatar': sender_avatar,
                'room_id': str(shared_list.id),
                'room_name': shared_list.name,
                'invite_code': shared_list.invite_code,
                'message': f'te invitó a la lista grupal "{shared_list.name}".',
            },
        )

        serialized_room = self.get_serializer(shared_list).data

        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': serialized_room,
                        },
                    },
                )
                if not already_in_room:
                    async_to_sync(channel_layer.group_send)(
                        f"room_{shared_list.id}",
                        {
                            'type': 'broadcast_event',
                            'event': {
                                'type': 'chat_message',
                                'sender': 'Sistema',
                                'text': f'🎉 {friend_display} fue invitado a la sala por {sender_display}.',
                            },
                        },
                    )
        except Exception:
            pass

        return Response(
            {
                'message': (
                    f'Notificación reenviada a {friend_display} (ya es miembro de la sala).'
                    if already_in_room
                    else f'¡{friend_display} fue invitado y agregado a "{shared_list.name}"!'
                ),
                'already_in_room': already_in_room,
                'room': serialized_room,
            },
            status=status.HTTP_200_OK if already_in_room else status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def kick_member(self, request, pk=None):
        """Expulsa a un integrante de la sala grupal. Solo accesible por el creador."""
        shared_list = self.get_object()

        if not self._is_owner(shared_list, request):
            return Response(
                {'error': 'Solo el creador de la sala puede expulsar integrantes.'},
                status=status.HTTP_403_FORBIDDEN
            )

        member_id = request.data.get('member_id')
        if not member_id:
            return Response({'error': 'member_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        member = get_object_or_404(SharedListMember, id=member_id, shared_list=shared_list)

        if member.role == 'owner':
            return Response({'error': 'No es posible expulsar al creador de la sala.'}, status=status.HTTP_400_BAD_REQUEST)

        # Eliminar votos asociados a este miembro si los tuviera
        if member.guest_token:
            SharedListVote.objects.filter(candidate__shared_list=shared_list, voter_id=member.guest_token).delete()

        kicked_name = member.guest_name
        member.delete()

        # Notificar por WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': self.get_serializer(shared_list).data,
                        }
                    }
                )
                async_to_sync(channel_layer.group_send)(
                    f"room_{shared_list.id}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'chat_message',
                            'sender': 'Sistema',
                            'text': f'🚫 {kicked_name} ha sido expulsado de la sala.',
                        }
                    }
                )
        except Exception:
            pass

        return Response(self.get_serializer(shared_list).data)

    @action(detail=True, methods=['post', 'delete'])
    def dissolve(self, request, pk=None):
        """Disuelve permanentemente la lista grupal. Solo accesible por el creador."""
        shared_list = self.get_object()

        if not self._is_owner(shared_list, request):
            return Response(
                {'error': 'Solo el creador de la sala puede disolver la lista grupal.'},
                status=status.HTTP_403_FORBIDDEN
            )

        room_id_str = str(shared_list.id)

        # Notificar a los miembros que la sala fue disuelta
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"room_{room_id_str}",
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_dissolved',
                            'message': 'Esta sala grupal ha sido disuelta por su creador.',
                        }
                    }
                )
        except Exception:
            pass

        shared_list.delete()
        return Response({'success': True, 'message': 'Sala disuelta exitosamente.'}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Elimina la sala grupal con verificación estricta de rol de creador."""
        shared_list = self.get_object()
        if not self._is_owner(shared_list, request):
            return Response(
                {'error': 'Solo el creador de la sala puede disolver la lista grupal.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return self.dissolve(request, *args, **kwargs)

