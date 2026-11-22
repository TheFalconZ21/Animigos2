"""
Endpoints REST para Integraciones Externas y Auto-Tracking de Animigos:
- MyAnimeList OAuth2 + PKCE (connect, callback, sync, disconnect)
- AniList OAuth2 GraphQL + importación pública por @usuario (connect, callback, sync, disconnect)
- Extensión de Navegador (token de sincronización y registro automático de episodios de Crunchyroll/Netflix)
- Importador de historial NetflixViewingHistory.csv
"""
import urllib.parse

from django.contrib.auth.models import User
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import sync_services


def _resolve_user_from_oauth_state(state: str):
    if not state or ':' not in state:
        return None
    raw_uid = state.split(':', 1)[0]
    try:
        uid = int(raw_uid)
    except (ValueError, TypeError):
        return None
    return User.objects.filter(id=uid, is_active=True).first()


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def integrations_status_view(request):
    """
    GET: Devuelve el estado de vinculación de MyAnimeList, AniList y Extensión de Navegador.
    PATCH: Permite actualizar preferencias de auto_push (mal_auto_push, anilist_auto_push).
    """
    if request.method == 'PATCH':
        prefs = sync_services._get_or_create_prefs(request.user)
        sync = sync_services._read_sync_state(prefs)
        changed = False
        if 'mal_auto_push' in request.data and isinstance(sync.get('mal'), dict):
            sync['mal']['auto_push'] = bool(request.data['mal_auto_push'])
            changed = True
        if 'anilist_auto_push' in request.data and isinstance(sync.get('anilist'), dict):
            sync['anilist']['auto_push'] = bool(request.data['anilist_auto_push'])
            changed = True
        if changed:
            sync_services._save_sync_state(prefs, sync)

    return Response(sync_services.get_user_sync_status(request.user))


# ---------------------------------------------------------------------------
# MyAnimeList OAuth2 + PKCE
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mal_connect_view(request):
    auth_url, err = sync_services.build_mal_auth_url(request.user)
    if err or not auth_url:
        return Response({'error': err or 'No se pudo iniciar OAuth con MyAnimeList.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'auth_url': auth_url})


@api_view(['GET'])
@permission_classes([AllowAny])
def mal_callback_view(request):
    frontend = sync_services.get_frontend_base_url()
    code = (request.GET.get('code') or '').strip()
    state = (request.GET.get('state') or '').strip()
    error = (request.GET.get('error') or '').strip()

    if error or not code or not state:
        reason = urllib.parse.quote(error or 'missing_params')
        return redirect(f'{frontend}/?sync=mal_error&reason={reason}#perfil')

    user = _resolve_user_from_oauth_state(state)
    if not user:
        return redirect(f'{frontend}/?sync=mal_error&reason=invalid_state#perfil')

    ok, detail = sync_services.exchange_mal_code(user, code, state)
    if not ok:
        reason = urllib.parse.quote(detail[:160])
        return redirect(f'{frontend}/?sync=mal_error&reason={reason}#perfil')

    # Sincronización inicial automática tras vincular
    try:
        sync_services.pull_mal_list(user)
    except Exception:
        pass

    return redirect(f'{frontend}/?sync=mal_ok#perfil')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mal_sync_view(request):
    try:
        result = sync_services.pull_mal_list(request.user)
        return Response(result)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response(
            {'error': f'Error al sincronizar con MyAnimeList: {str(exc)}'},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mal_disconnect_view(request):
    prefs = sync_services._get_or_create_prefs(request.user)
    sync = sync_services._read_sync_state(prefs)
    sync.pop('mal', None)
    sync.pop('mal_oauth_pending', None)
    sync_services._save_sync_state(prefs, sync)
    return Response({'ok': True, 'status': sync_services.get_user_sync_status(request.user)})


# ---------------------------------------------------------------------------
# AniList OAuth2 + Public Username Import
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anilist_connect_view(request):
    auth_url, err = sync_services.build_anilist_auth_url(request.user)
    if err or not auth_url:
        return Response({'error': err or 'No se pudo iniciar OAuth con AniList.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'auth_url': auth_url})


@api_view(['GET'])
@permission_classes([AllowAny])
def anilist_callback_view(request):
    frontend = sync_services.get_frontend_base_url()
    code = (request.GET.get('code') or '').strip()
    state = (request.GET.get('state') or '').strip()
    error = (request.GET.get('error') or '').strip()

    if error or not code or not state:
        reason = urllib.parse.quote(error or 'missing_params')
        return redirect(f'{frontend}/?sync=anilist_error&reason={reason}#perfil')

    user = _resolve_user_from_oauth_state(state)
    if not user:
        return redirect(f'{frontend}/?sync=anilist_error&reason=invalid_state#perfil')

    ok, detail = sync_services.exchange_anilist_code(user, code, state)
    if not ok:
        reason = urllib.parse.quote(detail[:160])
        return redirect(f'{frontend}/?sync=anilist_error&reason={reason}#perfil')

    try:
        sync_services.pull_anilist_list(user)
    except Exception:
        pass

    return redirect(f'{frontend}/?sync=anilist_ok#perfil')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anilist_sync_view(request):
    public_username = (request.data.get('username') or '').strip() or None
    try:
        result = sync_services.pull_anilist_list(request.user, public_username=public_username)
        return Response(result)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        return Response(
            {'error': f'Error al sincronizar con AniList: {str(exc)}'},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anilist_disconnect_view(request):
    prefs = sync_services._get_or_create_prefs(request.user)
    sync = sync_services._read_sync_state(prefs)
    sync.pop('anilist', None)
    sync.pop('anilist_oauth_pending', None)
    sync_services._save_sync_state(prefs, sync)
    return Response({'ok': True, 'status': sync_services.get_user_sync_status(request.user)})


# ---------------------------------------------------------------------------
# Extensión de Navegador (Crunchyroll & Netflix Auto-Tracking)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extension_token_view(request):
    """Genera o regenera el token personal X-Animigos-Sync-Token para la extensión."""
    token = sync_services.generate_extension_sync_token(request.user)
    return Response({
        'token': token,
        'status': sync_services.get_user_sync_status(request.user),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def extension_track_view(request):
    """
    Recibe eventos de episodio visto desde la extensión de navegador (Crunchyroll / Netflix).
    Autenticación Zero Trust: valida X-Animigos-Sync-Token o sesión autenticada.
    """
    user = request.user if (request.user and request.user.is_authenticated) else None
    if user is None:
        token = (
            request.headers.get('X-Animigos-Sync-Token')
            or request.META.get('HTTP_X_ANIMIGOS_SYNC_TOKEN')
            or (request.data.get('sync_token') if isinstance(request.data, dict) else '')
            or ''
        ).strip()
        user = sync_services.resolve_user_by_extension_token(token)

    if user is None:
        return Response(
            {'error': 'Token de sincronización inválido o ausente.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    source = str(request.data.get('source', '') or '').strip().lower()
    if source not in ('crunchyroll', 'netflix'):
        return Response(
            {'error': 'Fuente no soportada. Usa "crunchyroll" o "netflix".'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    raw_title = str(request.data.get('title', '') or '').strip()
    if not raw_title or len(raw_title) > 250:
        return Response(
            {'error': 'Título de anime inválido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        episode = int(request.data.get('episode', 1))
    except (ValueError, TypeError):
        return Response(
            {'error': 'Número de episodio inválido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    episode = max(1, min(episode, 5000))

    result = sync_services.record_streaming_progress(user, source, raw_title, episode)
    if not result.get('matched'):
        return Response(result, status=status.HTTP_200_OK)
    return Response(result, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Importador de Historial NetflixViewingHistory.csv
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def import_netflix_csv_view(request):
    """
    Importa el archivo NetflixViewingHistory.csv descargado desde
    netflix.com/viewingactivity y actualiza los animes coincidentes en Mi Lista.
    """
    csv_text = ''
    uploaded = request.FILES.get('file')
    if uploaded is not None:
        if uploaded.size > 10 * 1024 * 1024:
            return Response(
                {'error': 'El archivo CSV supera el límite de 10 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw_bytes = uploaded.read()
        try:
            csv_text = raw_bytes.decode('utf-8-sig')
        except UnicodeDecodeError:
            csv_text = raw_bytes.decode('latin-1', errors='replace')
    elif isinstance(request.data, dict) and request.data.get('csv_text'):
        csv_text = str(request.data.get('csv_text'))

    if not csv_text.strip():
        return Response(
            {'error': 'Adjunta tu archivo NetflixViewingHistory.csv.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = sync_services.import_netflix_viewing_history_csv(request.user, csv_text)
        return Response(result)
    except Exception as exc:
        return Response(
            {'error': f'Error al procesar el CSV de Netflix: {str(exc)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )
