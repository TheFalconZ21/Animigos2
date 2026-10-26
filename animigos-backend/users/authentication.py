from rest_framework.authentication import SessionAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Autenticación de sesión para el BFF de Animigos.
    Valida la cookie de sesión HttpOnly sin bloquear por CSRF en llamadas de API REST SPA,
    manteniendo estricto control de sesiones autenticadas según el Pilar de Seguridad 2.1.
    """
    def enforce_csrf(self, request):
        return
