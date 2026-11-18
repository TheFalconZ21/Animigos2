import logging
from rest_framework.authentication import SessionAuthentication
from django.contrib.auth.models import User

logger = logging.getLogger('animigos.auth')


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Autenticación de sesión de alta resiliencia para el BFF de Animigos.
    1. Valida la sesión HttpOnly sin bloquear por CSRF en llamadas de API REST SPA (enforce_csrf bypass).
    2. Resiliencia cross-site y fallback anti-bloqueo de cookies de terceros:
       Soporta la clave de sesión enviada en los headers:
       - 'X-Session-Id'
       - 'X-Auth-Token'
       - 'Authorization: Bearer <session_key>' / 'Authorization: Session <session_key>'
       - Fallback directo a la cookie 'sessionid' en caso de que AuthenticationMiddleware haya omitido la carga.
    3. Auto-sanación de sesiones: Si el hash de autenticación difiere pero el usuario está activo,
       re-sincroniza el hash en la sesión activa para evitar deslogueos espurios.
    4. Provee authenticate_header para que DRF devuelva HTTP 401 (Unauthorized) en lugar de HTTP 403 (Forbidden).
    """

    def enforce_csrf(self, request):
        return

    def authenticate_header(self, request):
        return 'Session realm="api"'

    def authenticate(self, request):
        # 1. Intentar autenticación estándar por cookie de sesión
        user_auth_tuple = super().authenticate(request)
        if user_auth_tuple is not None:
            return user_auth_tuple

        # 2. Resiliencia cross-site: extraer clave de sesión de múltiples fuentes
        session_key = (
            request.headers.get('X-Session-Id') or
            request.META.get('HTTP_X_SESSION_ID') or
            request.headers.get('X-Auth-Token') or
            request.META.get('HTTP_X_AUTH_TOKEN')
        )

        if not session_key:
            auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header:
                parts = auth_header.strip().split()
                if len(parts) == 2 and parts[0].lower() in ('bearer', 'session', 'token'):
                    session_key = parts[1].strip()
                elif len(parts) == 1:
                    session_key = parts[0].strip()

        # Fallback a cookie directa si AuthenticationMiddleware no autenticó al usuario
        if not session_key:
            session_key = request.COOKIES.get('sessionid')

        if not session_key:
            return None

        # 3. Cargar y validar la sesión desde el motor configurado
        try:
            from django.conf import settings
            from importlib import import_module
            engine = import_module(settings.SESSION_ENGINE)
            session_store = engine.SessionStore(session_key=session_key)
            data = session_store.load()

            user_id = data.get('_auth_user_id')
            if not user_id:
                logger.debug("Sesión %s... no contiene _auth_user_id válido.", session_key[:8] if session_key else '')
                return None

            user = User.objects.filter(pk=user_id, is_active=True).first()
            if not user:
                logger.warning("Usuario con id %s de sesión %s no encontrado o inactivo.", user_id, session_key[:8])
                return None

            # 4. Auto-sanación: si el hash difiere (ej. despliegue previo o reseteo de salt),
            # actualizarlo en la sesión para evitar que Django la descarte en requests posteriores.
            current_auth_hash = user.get_session_auth_hash()
            if data.get('_auth_user_hash') != current_auth_hash:
                session_store['_auth_user_hash'] = current_auth_hash
                session_store.save()
                logger.info("Sesión %s... re-sincronizada con el hash actual del usuario %s.", session_key[:8], user.username)

            request.session = session_store
            request.user = user
            return (user, None)

        except Exception as e:
            logger.exception("Error inesperado en CsrfExemptSessionAuthentication al procesar sesión: %s", e)
            return None
