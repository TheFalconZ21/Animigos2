"""
WebSocket Consumer para Coordinación Grupal y Watch Parties (Pilar 3 de AGENTS.md).
El propósito central de la plataforma Animigos es:
1. Coordinar qué anime ver entre todos (votación grupal / consenso de felicidad).
2. Llevar un conteo exacto de los capítulos vistos por cada miembro del grupo.
3. Facilitar que quienes no estuvieron en la sesión anterior se puedan poner al día rápidamente.
4. Programar próximas reuniones/sesiones grupales (Discord, en persona, streaming, etc.).
5. Chat y reacciones en tiempo real libre de spoilers.
"""

import time
from typing import Dict, Any, Optional
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import SharedList, SharedListMember, SharedListCandidate, SharedListVote
from animes.models import Anime
from .services.happiness import calculate_happiness_score


class RoomConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_id: Optional[str] = None
        self.room_group_name: Optional[str] = None
        self.user_name: str = "Invitado"
        self.user_token: str = ""
        # Throttling / Rate limiting
        self.last_chat_timestamps: list[float] = []
        self.last_reaction_timestamps: list[float] = []

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f"room_{self.room_id}"

        # Parsear query params (token y name)
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = dict(qp.split('=', 1) for qp in query_string.split('&') if '=' in qp)
        self.user_name = params.get('name', 'Invitado')
        self.user_token = params.get('token', '')

        # Validar si la sala existe en la base de datos
        room_data = await self.get_room_summary(self.room_id)
        if not room_data:
            await self.close(code=4004)
            return

        # Registrar o actualizar último acceso del miembro
        await self.register_or_touch_member(self.room_id, self.user_name, self.user_token)

        # Unirse al grupo de difusión de la sala
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Enviar estado inicial de la sala al cliente conectado
        updated_room = await self.get_room_summary(self.room_id)
        await self.send_json({
            'type': 'room_init',
            'room': updated_room,
            'server_time': time.time(),
            'message': f'Conectado en tiempo real a la sala {updated_room.get("name")}'
        })

        # Notificar a los demás miembros de la sala
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'broadcast_event',
                'event': {
                    'type': 'member_joined',
                    'member_name': self.user_name,
                    'timestamp': time.time(),
                    'room': updated_room,
                }
            }
        )

    async def disconnect(self, close_code):
        if self.room_group_name:
            # Notificar salida al grupo
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'member_left',
                        'member_name': self.user_name,
                        'timestamp': time.time(),
                    }
                }
            )
            # Salir del grupo
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive_json(self, content: Dict[str, Any]):
        action = content.get('action') or content.get('type')
        now = time.time()

        # 1. Heartbeat y medición de latencia
        if action == 'ping':
            await self.send_json({
                'type': 'pong',
                'client_time': content.get('client_time'),
                'server_time': now,
            })
            return

        # 2. Solicitud de sincronización de estado de sala y miembros
        if action == 'sync_request':
            room_data = await self.get_room_summary(self.room_id)
            await self.send_json({
                'type': 'sync_response',
                'room': room_data,
                'server_time': now,
            })
            return

        # 3. Votación de candidatos en tiempo real (Algoritmo de Felicidad)
        if action == 'vote_anime':
            candidate_id = content.get('candidate_id')
            score = int(content.get('interest_score', 5))
            voter_id = content.get('voter_id') or self.user_token or self.user_name
            voter_name = content.get('voter_name') or self.user_name
            await self.vote_candidate_db(candidate_id, score, voter_id, voter_name)
            room_data = await self.get_room_summary(self.room_id)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'room_state_updated',
                        'room': room_data,
                        'server_time': now,
                    }
                }
            )
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'chat_message',
                        'sender': 'Sistema',
                        'text': f'⭐ {voter_name} votó {score}/10 en una opción.',
                        'timestamp': now,
                    }
                }
            )
            return

        # 4. Postular un anime a la votación en tiempo real
        if action == 'nominate_anime':
            mal_id = int(content.get('anime_id') or content.get('mal_id', 0))
            if mal_id > 0:
                await self.nominate_anime_db(self.room_id, mal_id, self.user_name)
                room_data = await self.get_room_summary(self.room_id)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'room_state_updated',
                            'room': room_data,
                            'server_time': now,
                        }
                    }
                )
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'broadcast_event',
                        'event': {
                            'type': 'chat_message',
                            'sender': 'Sistema',
                            'text': f'✨ {self.user_name} postuló un nuevo anime para votar.',
                            'timestamp': now,
                        }
                    }
                )
            return

        # 5. Actualización de capítulos vistos por un miembro (Conteo individual)
        if action == 'update_progress':
            episodes_watched = max(0, int(content.get('episodes_watched', 0)))
            await self.update_member_progress_db(self.room_id, self.user_name, self.user_token, episodes_watched)
            room_data = await self.get_room_summary(self.room_id)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'member_progress_updated',
                        'member_name': self.user_name,
                        'episodes_watched': episodes_watched,
                        'room': room_data,
                        'server_time': now,
                    }
                }
            )
            # Notificación del sistema en el chat
            target = room_data.get('current_episode', 1)
            msg_text = f'✅ {self.user_name} completó el capítulo {episodes_watched}.'
            if episodes_watched >= target:
                msg_text += ' ¡Está al día con el grupo! 🎉'
            else:
                behind = target - episodes_watched
                msg_text += f' (Atrasado por {behind} {"capítulo" if behind == 1 else "capítulos"}).'

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'chat_message',
                        'sender': 'Sistema',
                        'text': msg_text,
                        'timestamp': now,
                    }
                }
            )
            return

        # 6. Actualización del objetivo/capítulo grupal (Meta del grupo)
        if action == 'set_group_target':
            target_ep = max(1, int(content.get('episode', 1)))
            await self.set_group_target_db(self.room_id, target_ep)
            room_data = await self.get_room_summary(self.room_id)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'group_target_updated',
                        'current_episode': target_ep,
                        'updated_by': self.user_name,
                        'room': room_data,
                        'server_time': now,
                    }
                }
            )
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'chat_message',
                        'sender': 'Sistema',
                        'text': f'🎯 Nueva meta grupal: Capítulo {target_ep}. ¡Revisen la lista para ver quién debe ponerse al día!',
                        'timestamp': now,
                    }
                }
            )
            return

        # 7. Programar próxima sesión grupal
        if action == 'schedule_session':
            next_date = content.get('next_session_date')
            notes = str(content.get('session_notes', '')).strip()
            await self.schedule_session_db(self.room_id, next_date, notes)
            room_data = await self.get_room_summary(self.room_id)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'session_scheduled',
                        'room': room_data,
                        'server_time': now,
                    }
                }
            )
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'chat_message',
                        'sender': 'Sistema',
                        'text': f'📅 Próxima sesión actualizada. Notas: {notes or "Sin notas"}',
                        'timestamp': now,
                    }
                }
            )
            return

        # 8. Chat en vivo con Rate Limiting (Pilar 3.2: máx 5 mensajes en 2s)
        if action == 'chat_message':
            text = str(content.get('text', '')).strip()[:300]
            if not text:
                return

            self.last_chat_timestamps = [t for t in self.last_chat_timestamps if now - t < 2.0]
            if len(self.last_chat_timestamps) >= 5:
                await self.send_json({
                    'type': 'rate_limit_exceeded',
                    'message': 'Estás enviando mensajes demasiado rápido. Espera un segundo.'
                })
                return

            self.last_chat_timestamps.append(now)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'chat_message',
                        'sender': self.user_name,
                        'text': text,
                        'timestamp': now,
                    }
                }
            )
            return

        # 9. Reacciones animadas con Rate Limiting (máx 8 reacciones en 3s)
        if action == 'reaction':
            emoji = str(content.get('emoji', '❤️'))[:10]
            self.last_reaction_timestamps = [t for t in self.last_reaction_timestamps if now - t < 3.0]
            if len(self.last_reaction_timestamps) >= 8:
                return

            self.last_reaction_timestamps.append(now)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'reaction',
                        'sender': self.user_name,
                        'emoji': emoji,
                        'timestamp': now,
                    }
                }
            )
            return

        # 10. Actualización general de la sala (votos, candidatos, anime seleccionado)
        if action == 'room_refresh':
            room_data = await self.get_room_summary(self.room_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'room_state_updated',
                        'room': room_data,
                        'server_time': now,
                    }
                }
            )
            return

    async def broadcast_event(self, event):
        """Manejador para difundir eventos a través del Channel Layer."""
        await self.send_json(event['event'])

    # -------------------------------------------------------------
    # Métodos Auxiliares de Persistencia y Consulta
    # -------------------------------------------------------------

    @sync_to_async
    def register_or_touch_member(self, room_id: str, guest_name: str, guest_token: str):
        try:
            room = SharedList.objects.get(id=room_id)
            member = None
            if guest_token:
                member = room.members.filter(guest_token=guest_token).first()
            if not member and guest_name:
                member = room.members.filter(guest_name=guest_name).first()

            if not member:
                SharedListMember.objects.create(
                    shared_list=room,
                    guest_token=guest_token,
                    guest_name=guest_name or 'Miembro',
                    role='guest'
                )
            else:
                member.guest_name = guest_name
                member.save(update_fields=['guest_name', 'last_active_at'])
        except Exception:
            pass

    @sync_to_async
    def vote_candidate_db(self, candidate_id: str, score: int, voter_id: str, voter_name: str):
        try:
            candidate = SharedListCandidate.objects.get(id=candidate_id)
            SharedListVote.objects.update_or_create(
                candidate=candidate,
                voter_id=voter_id,
                defaults={
                    'voter_name': voter_name,
                    'interest_score': max(0, min(10, score))
                }
            )
            return True
        except Exception:
            return False

    @sync_to_async
    def nominate_anime_db(self, room_id: str, mal_id: int, suggested_by: str):
        try:
            room = SharedList.objects.get(id=room_id)
            anime = Anime.objects.get(mal_id=mal_id)
            if not SharedListCandidate.objects.filter(shared_list=room, anime=anime).exists():
                SharedListCandidate.objects.create(
                    shared_list=room,
                    anime=anime,
                    suggested_by=suggested_by
                )
            return True
        except Exception:
            return False

    @sync_to_async
    def update_member_progress_db(self, room_id: str, guest_name: str, guest_token: str, episodes_watched: int):
        try:
            room = SharedList.objects.get(id=room_id)
            member = None
            if guest_token:
                member = room.members.filter(guest_token=guest_token).first()
            if not member and guest_name:
                member = room.members.filter(guest_name=guest_name).first()

            if not member:
                SharedListMember.objects.create(
                    shared_list=room,
                    guest_token=guest_token,
                    guest_name=guest_name or 'Miembro',
                    role='member',
                    episodes_watched=episodes_watched
                )
            else:
                member.episodes_watched = episodes_watched
                member.save(update_fields=['episodes_watched', 'last_active_at'])
            return True
        except Exception:
            return False

    @sync_to_async
    def set_group_target_db(self, room_id: str, episode: int):
        try:
            room = SharedList.objects.get(id=room_id)
            room.current_episode = episode
            if room.status in ('selected', 'voting'):
                room.status = 'watching'
            room.save(update_fields=['current_episode', 'status', 'updated_at'])
            return True
        except Exception:
            return False

    @sync_to_async
    def schedule_session_db(self, room_id: str, next_session_date: Optional[str], session_notes: str):
        try:
            room = SharedList.objects.get(id=room_id)
            room.next_session_date = next_session_date or None
            room.session_notes = session_notes
            room.save(update_fields=['next_session_date', 'session_notes', 'updated_at'])
            return True
        except Exception:
            return False

    @sync_to_async
    def get_room_summary(self, room_id: str) -> Optional[Dict[str, Any]]:
        try:
            room = SharedList.objects.select_related('selected_anime').prefetch_related(
                'members', 'candidates__votes', 'candidates__anime'
            ).get(id=room_id)
        except SharedList.DoesNotExist:
            return None

        total_members_count = room.members.count()
        candidates_data = []
        for c in room.candidates.all():
            votes = list(c.votes.all())
            scores = [v.interest_score for v in votes]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
            votes_data = [
                {
                    "voter_id": v.voter_id,
                    "voter_name": v.voter_name,
                    "interest_score": v.interest_score,
                }
                for v in votes
            ]
            happiness = calculate_happiness_score(
                votes=votes_data,
                mal_score=float(c.anime.score) if c.anime.score else None,
                mal_scored_by=c.anime.scored_by,
                title=c.anime.title,
                total_members_count=total_members_count if total_members_count > 0 else 4,
                episodes_count=c.anime.episodes or 24
            )

            candidates_data.append({
                'id': str(c.id),
                'anime_id': c.anime.mal_id,
                'title': c.anime.title,
                'image_url': c.anime.image_url,
                'score': float(c.anime.score) if c.anime.score is not None else None,
                'episodes': c.anime.episodes,
                'avg_interest': avg_score,
                'votes_count': len(votes),
                'suggested_by': c.suggested_by,
                'votes': [
                    {
                        'id': str(v.id),
                        'voter_id': v.voter_id,
                        'voter_name': v.voter_name,
                        'interest_score': v.interest_score,
                    }
                    for v in votes
                ],
                'happiness_result': happiness,
            })

        # Ordenar candidatos según el Ranking por Felicidad Grupal descendente
        candidates_data.sort(
            key=lambda x: (
                x.get('happiness_result', {}).get('final_score', 0.0),
                x.get('avg_interest', 0.0)
            ),
            reverse=True
        )

        target_ep = room.current_episode
        members_data = []
        catchup_data = []
        for m in room.members.all():
            behind = max(0, target_ep - m.episodes_watched)
            if m.episodes_watched > target_ep:
                status_str = 'adelantado'
            elif m.episodes_watched == target_ep:
                status_str = 'al_dia'
            else:
                status_str = 'atrasado'

            member_dict = {
                'id': str(m.id),
                'guest_name': m.guest_name,
                'guest_token': m.guest_token,
                'role': m.role,
                'episodes_watched': m.episodes_watched,
                'episodes_behind': behind,
                'sync_status': status_str,
                'last_active_at': m.last_active_at.isoformat() if m.last_active_at else None,
            }
            members_data.append(member_dict)
            if behind > 0:
                catchup_data.append({
                    'id': str(m.id),
                    'guest_name': m.guest_name,
                    'episodes_watched': m.episodes_watched,
                    'episodes_behind': behind,
                })

        return {
            'id': str(room.id),
            'name': room.name,
            'description': room.description,
            'status': room.status,
            'invite_code': room.invite_code,
            'current_episode': room.current_episode,
            'next_session_date': room.next_session_date.isoformat() if room.next_session_date else None,
            'session_notes': room.session_notes,
            'members_count': room.members.count(),
            'members': members_data,
            'catchup_members': catchup_data,
            'candidates': candidates_data,
            'selected_anime': {
                'mal_id': room.selected_anime.mal_id,
                'title': room.selected_anime.title,
                'image_url': room.selected_anime.image_url,
                'score': float(room.selected_anime.score) if room.selected_anime.score is not None else None,
                'episodes': room.selected_anime.episodes,
                'synopsis': room.selected_anime.synopsis[:300] if room.selected_anime.synopsis else '',
            } if room.selected_anime else None
        }
