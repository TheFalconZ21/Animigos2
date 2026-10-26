"""
Enrutamiento de WebSockets para Salas y Watch Parties en Tiempo Real (Pilar 3 de AGENTS.md).
"""

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/rooms/(?P<room_id>[0-9a-fA-F-]+)/?$', consumers.RoomConsumer.as_asgi()),
]
