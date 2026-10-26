"""
ASGI configuration for Animigos project.
Routes standard HTTP traffic to Django ASGI and WebSocket traffic to Channels consumers.
Pilar 3 de AGENTS.md: Coordinación en Tiempo Real y Watch Parties.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import groups.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            groups.routing.websocket_urlpatterns
        )
    ),
})
