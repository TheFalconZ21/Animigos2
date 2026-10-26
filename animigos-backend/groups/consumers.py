"""
WebSocket Consumer para Coordinación en Tiempo Real y Watch Parties (Pilar 3 de AGENTS.md).
Implementa:
- Patrón Server-Authoritative para sincronización de reproducción y timestamp.
- Detección de desconexión y heartbeat (ping/pong con cálculo de latencia).
- Rate limiting / Throttling por socket para chat y reacciones.
- Actualización reactiva de quórum y votos grupales.
"""

import time
from typing import Dict, Any, Optional
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache
from .models import SharedList, SharedListMember, SharedListCandidate


def get_playback_cache_key(room_id: str) -> str:
    return f"room_playback_{room_id}"


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

        # Unirse al grupo de difusión de la sala
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Obtener o inicializar estado de reproducción autoritativo del servidor
        playback_state = await self.get_or_create_playback(self.room_id, room_data)

        # Enviar estado de inicialización al cliente conectado
        await self.send_json({
            'type': 'room_init',
            'room': room_data,
            'playback': playback_state,
            'server_time': time.time(),
            'message': f'Conectado en tiempo real a la sala {room_data.get("name")}'
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

        # 2. Solicitud de sincronización de estado autoritativo
        if action == 'sync_request':
            room_data = await self.get_room_summary(self.room_id)
            playback_state = await self.get_authoritative_playback(self.room_id)
            await self.send_json({
                'type': 'sync_response',
                'room': room_data,
                'playback': playback_state,
                'server_time': now,
            })
            return

        # 3. Acciones de Reproducción Autoritativa (Server-Authoritative Pattern - Pilar 3.1)
        if action in ('request_play', 'request_pause', 'request_seek', 'request_episode'):
            updated_playback = await self.handle_playback_action(action, content)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'broadcast_event',
                    'event': {
                        'type': 'playback_state',
                        'playback': updated_playback,
                        'server_time': now,
                        'triggered_by': self.user_name,
                    }
                }
            )
            return

        # 4. Chat en vivo con Rate Limiting (Pilar 3.2: máx 5 mensajes en 2s)
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

        # 5. Reacciones animadas con Rate Limiting (máx 8 reacciones en 3s)
        if action == 'reaction':
            emoji = str(content.get('emoji', '❤️'))[:10]
            self.last_reaction_timestamps = [t for t in self.last_reaction_timestamps if now - t < 3.0]
            if len(self.last_reaction_timestamps) >= 8:
                return  # Ignorar silenciosamente flooding de emojis

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

        # 6. Actualización de votos / quórum en vivo
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
    # Métodos Auxiliares de Lógica de Negocio y Persistencia
    # -------------------------------------------------------------

    @sync_to_async
    def get_room_summary(self, room_id: str) -> Optional[Dict[str, Any]]:
        try:
            room = SharedList.objects.select_related('selected_anime').prefetch_related(
                'members', 'candidates__votes', 'candidates__anime'
            ).get(id=room_id)
        except SharedList.DoesNotExist:
            return None

        candidates_data = []
        for c in room.candidates.all():
            votes = list(c.votes.all())
            scores = [v.interest_score for v in votes]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
            candidates_data.append({
                'id': str(c.id),
                'anime_id': c.anime.mal_id,
                'title': c.anime.title,
                'image_url': c.anime.image_url,
                'score': float(c.anime.score) if c.anime.score is not None else None,
                'avg_interest': avg_score,
                'votes_count': len(votes),
                'suggested_by': c.suggested_by,
            })

        return {
            'id': str(room.id),
            'name': room.name,
            'description': room.description,
            'status': room.status,
            'invite_code': room.invite_code,
            'members_count': room.members.count(),
            'candidates': candidates_data,
            'selected_anime': {
                'mal_id': room.selected_anime.mal_id,
                'title': room.selected_anime.title,
                'image_url': room.selected_anime.image_url,
                'score': float(room.selected_anime.score) if room.selected_anime.score is not None else None,
                'episodes': room.selected_anime.episodes,
            } if room.selected_anime else None
        }

    async def get_or_create_playback(self, room_id: str, room_data: Dict[str, Any]) -> Dict[str, Any]:
        cache_key = get_playback_cache_key(room_id)
        playback = cache.get(cache_key)
        if not playback:
            playback = {
                'is_playing': False,
                'current_time': 0.0,
                'last_sync_timestamp': time.time(),
                'episode': 1,
                'speed': 1.0,
                'host_name': self.user_name,
                'total_duration': (room_data.get('selected_anime') or {}).get('episodes', 24) * 1440,
            }
            cache.set(cache_key, playback, timeout=86400)
        return playback

    async def get_authoritative_playback(self, room_id: str) -> Dict[str, Any]:
        cache_key = get_playback_cache_key(room_id)
        playback = cache.get(cache_key) or {
            'is_playing': False,
            'current_time': 0.0,
            'last_sync_timestamp': time.time(),
            'episode': 1,
            'speed': 1.0,
            'host_name': self.user_name,
        }

        # Si estaba reproduciendo, calcular el tiempo transcurrido en el servidor
        if playback.get('is_playing'):
            elapsed = (time.time() - playback.get('last_sync_timestamp', time.time())) * playback.get('speed', 1.0)
            playback['current_time'] = round(playback.get('current_time', 0.0) + elapsed, 2)
            playback['last_sync_timestamp'] = time.time()
            cache.set(cache_key, playback, timeout=86400)

        return playback

    async def handle_playback_action(self, action: str, content: Dict[str, Any]) -> Dict[str, Any]:
        cache_key = get_playback_cache_key(self.room_id)
        playback = await self.get_authoritative_playback(self.room_id)
        now = time.time()

        if action == 'request_play':
            playback['is_playing'] = True
            playback['last_sync_timestamp'] = now
            if 'time' in content:
                playback['current_time'] = max(0.0, float(content['time']))

        elif action == 'request_pause':
            playback['is_playing'] = False
            playback['last_sync_timestamp'] = now
            if 'time' in content:
                playback['current_time'] = max(0.0, float(content['time']))

        elif action == 'request_seek':
            playback['current_time'] = max(0.0, float(content.get('time', 0.0)))
            playback['last_sync_timestamp'] = now

        elif action == 'request_episode':
            playback['episode'] = max(1, int(content.get('episode', 1)))
            playback['current_time'] = 0.0
            playback['last_sync_timestamp'] = now

        cache.set(cache_key, playback, timeout=86400)
        return playback
