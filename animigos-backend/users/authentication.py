from rest_framework.authentication import SessionAuthentication
from django.contrib.sessions.models import Session
from django.contrib.auth.models import User
from django.utils import timezone

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Autenticación de sesión para el BFF de Animigos.
    1. Valida la cookie de sesión HttpOnly sin bloquear por CSRF en llamadas de API REST SPA.
    2. Como resiliencia cross-site (cuando localhost y 127.0.0.1 difieren de origen en dev),
       soporta la clave de sesión enviada en los headers 'X-Session-Id' o 'Authorization: Bearer <session_key>'.
    """
    def enforce_csrf(self, request):
        return

    def authenticate(self, request):
        # 1. Intentar autenticación estándar por cookie de sesión
        user_auth_tuple = super().authenticate(request)
        if user_auth_tuple is not None:
            return user_auth_tuple

        # 2. Resiliencia cross-site: extraer clave de sesión de headers
        session_key = (
            request.headers.get('X-Session-Id') or
            request.META.get('HTTP_X_SESSION_ID')
        )
        if not session_key:
            auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                session_key = auth_header[7:].strip()
            elif auth_header.startswith('Session '):
                session_key = auth_header[8:].strip()

        if not session_key:
            return None

        try:
            from django.conf import settings
            from importlib import import_module
            engine = import_module(settings.SESSION_ENGINE)
            session_store = engine.SessionStore(session_key=session_key)
            data = session_store.load()
            user_id = data.get('_auth_user_id')
            if not user_id:
                return None

            user = User.objects.filter(pk=user_id, is_active=True).first()
            if not user:
                return None

            request.session = session_store
            return (user, None)
        except Exception:
            return None
