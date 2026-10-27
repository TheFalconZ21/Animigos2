from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import CACHE_PREFIX_NEWS, CACHE_TTL_MEDIUM
from core.services.fuentes_externas import obtener_noticias
from core.utils.cache import cached_api_response


class NewsView(APIView):
    """
    GET /api/news/ — Noticias de anime de Anmo Sugoi y Ramen Para Dos.
    Proxy de sus RSS con caché de 30 minutos (Pilar 4.1): el navegador nunca los consulta directo.
    """
    authentication_classes: list = []
    permission_classes: list = []

    @cached_api_response(timeout=CACHE_TTL_MEDIUM, prefix=CACHE_PREFIX_NEWS)
    def get(self, request):
        try:
            return Response(obtener_noticias())
        except Exception:
            return Response(
                {'detail': 'No se pudieron obtener las noticias. Inténtalo más tarde.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
