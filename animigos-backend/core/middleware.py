from django.conf import settings

class PartitionedCookiesMiddleware:
    """
    Inyecta el atributo 'Partitioned' en las cookies SameSite=None y Secure (estándar CHIPS:
    Cookies Having Independent Partitioned State).
    Esto elimina las advertencias de cookies de terceros en navegadores modernos (Chrome, Firefox, Edge)
    cuando el frontend y el backend operan en dominios cruzados (cross-site).
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # 1. Manejo de recursos multimedia y estáticos (evitar bloqueos ORB/CORB cross-origin)
        if request.path.startswith('/media/') or request.path.startswith('/static/'):
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response['Cross-Origin-Resource-Policy'] = 'cross-origin'
            if 'Cross-Origin-Opener-Policy' in response:
                del response['Cross-Origin-Opener-Policy']
            if 'X-Frame-Options' in response:
                del response['X-Frame-Options']

        # 2. Solo aplicable cuando las cookies operan en modo cross-site (SameSite=None)
        cookie_samesite = getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Lax')
        if str(cookie_samesite).lower() != 'none':
            return response

        for name in ('sessionid', 'csrftoken'):
            if name in response.cookies:
                morsel = response.cookies[name]
                if morsel.get('samesite', '').lower() == 'none' and morsel.get('secure'):
                    orig_output = morsel.OutputString
                    def make_patched(orig):
                        def patched(attrs=None):
                            val = orig(attrs)
                            if '; Partitioned' not in val:
                                val += '; Partitioned'
                            return val
                        return patched
                    morsel.OutputString = make_patched(orig_output)

        return response
