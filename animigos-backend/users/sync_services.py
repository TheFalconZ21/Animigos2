"""
Servicios de Sincronización Externa de Animigos:
- MyAnimeList (OAuth2 + PKCE, pull de lista y auto-push de progreso)
- AniList (OAuth2 GraphQL, importación por usuario público y auto-push SaveMediaListEntry)
- Extensión de Navegador (auto-tracking de episodios vistos en Crunchyroll y Netflix)
- Importador de historial NetflixViewingHistory.csv
"""
import csv
import io
import os
import re
import secrets
import threading
import urllib.parse
from datetime import timedelta

import requests
from django.db.models import Q
from django.utils import timezone

from animes.models import Anime
from core.utils.db_resilience import run_with_db_retry
from .models import Profile, UserAnimeEntry, UserPreferences

MAL_AUTH_URL = 'https://myanimelist.net/v1/oauth2/authorize'
MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token'
MAL_API_BASE = 'https://api.myanimelist.net/v2'

ANILIST_AUTH_URL = 'https://anilist.co/api/v2/oauth/authorize'
ANILIST_TOKEN_URL = 'https://anilist.co/api/v2/oauth/token'
ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co'

MAL_TO_ANIMIGOS_STATUS = {
    'watching': 'viendo',
    'completed': 'visto',
    'plan_to_watch': 'pendiente',
    'on_hold': 'pendiente',
    'dropped': 'dropeado',
}

ANIMIGOS_TO_MAL_STATUS = {
    'viendo': 'watching',
    'visto': 'completed',
    'pendiente': 'plan_to_watch',
    'esperando': 'plan_to_watch',
    'dropeado': 'dropped',
}

ANILIST_TO_ANIMIGOS_STATUS = {
    'CURRENT': 'viendo',
    'REPEATING': 'viendo',
    'COMPLETED': 'visto',
    'PLANNING': 'pendiente',
    'PAUSED': 'pendiente',
    'DROPPED': 'dropeado',
}

ANIMIGOS_TO_ANILIST_STATUS = {
    'viendo': 'CURRENT',
    'visto': 'COMPLETED',
    'pendiente': 'PLANNING',
    'esperando': 'PLANNING',
    'dropeado': 'DROPPED',
}


def get_frontend_base_url() -> str:
    return os.environ.get('FRONTEND_URL', 'https://www.animigos.app').rstrip('/')


def get_backend_base_url() -> str:
    return os.environ.get('BACKEND_PUBLIC_URL', 'https://api.animigos.app').rstrip('/')


def _get_or_create_prefs(user) -> UserPreferences:
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={'display_name': user.first_name or user.username},
    )
    prefs, _ = UserPreferences.objects.get_or_create(profile=profile)
    return prefs


def _read_sync_state(prefs: UserPreferences) -> dict:
    ps = prefs.privacy_settings if isinstance(prefs.privacy_settings, dict) else {}
    sync = ps.get('external_sync')
    return dict(sync) if isinstance(sync, dict) else {}


def _save_sync_state(prefs: UserPreferences, sync_state: dict) -> None:
    def _write():
        prefs.refresh_from_db()
        ps = dict(prefs.privacy_settings) if isinstance(prefs.privacy_settings, dict) else {}
        ps['external_sync'] = sync_state
        prefs.privacy_settings = ps
        prefs.save(update_fields=['privacy_settings'])

    run_with_db_retry(_write)


def get_user_sync_status(user) -> dict:
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    mal = sync.get('mal') if isinstance(sync.get('mal'), dict) else {}
    anilist = sync.get('anilist') if isinstance(sync.get('anilist'), dict) else {}
    ext = sync.get('extension') if isinstance(sync.get('extension'), dict) else {}

    return {
        'mal': {
            'configured': bool(os.environ.get('MAL_CLIENT_ID', '').strip()),
            'connected': bool(mal.get('connected') and mal.get('access_token')),
            'username': mal.get('username') or '',
            'auto_push': bool(mal.get('auto_push', True)),
            'last_synced_at': mal.get('last_synced_at'),
        },
        'anilist': {
            'configured': bool(
                os.environ.get('ANILIST_CLIENT_ID', '').strip()
                and os.environ.get('ANILIST_CLIENT_SECRET', '').strip()
            ),
            'connected': bool(anilist.get('connected') and (anilist.get('access_token') or anilist.get('username'))),
            'has_oauth': bool(anilist.get('access_token')),
            'username': anilist.get('username') or '',
            'auto_push': bool(anilist.get('auto_push', True)),
            'last_synced_at': anilist.get('last_synced_at'),
        },
        'extension': {
            'has_token': bool(ext.get('api_token')),
            'api_token': ext.get('api_token') or '',
            'last_event_at': ext.get('last_event_at'),
            'last_source': ext.get('last_source') or '',
            'last_anime_title': ext.get('last_anime_title') or '',
            'last_episode': ext.get('last_episode'),
        },
    }


# ---------------------------------------------------------------------------
# 1. MYANIMELIST OAUTH2 (PKCE) & SINCRONIZACIÓN
# ---------------------------------------------------------------------------

def build_mal_auth_url(user) -> tuple[str | None, str | None]:
    client_id = os.environ.get('MAL_CLIENT_ID', '').strip()
    if not client_id:
        return None, (
            'MAL_CLIENT_ID no está configurado en el servidor (.env). '
            'Registra una app en https://myanimelist.net/apiconfig y configura MAL_CLIENT_ID y MAL_CLIENT_SECRET.'
        )

    redirect_uri = os.environ.get(
        'MAL_REDIRECT_URI',
        f'{get_backend_base_url()}/api/users/integrations/mal/callback/',
    ).strip()

    # MAL API v2 soporta PKCE con method='plain' y verifier de 43-128 caracteres URL-safe
    code_verifier = secrets.token_urlsafe(64)[:96]
    state = f"{user.id}:{secrets.token_urlsafe(24)}"

    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    sync['mal_oauth_pending'] = {
        'state': state,
        'code_verifier': code_verifier,
        'redirect_uri': redirect_uri,
        'created_at': timezone.now().isoformat(),
    }
    _save_sync_state(prefs, sync)

    params = urllib.parse.urlencode({
        'response_type': 'code',
        'client_id': client_id,
        'code_challenge': code_verifier,
        'code_challenge_method': 'plain',
        'state': state,
        'redirect_uri': redirect_uri,
    })
    return f'{MAL_AUTH_URL}?{params}', None


def exchange_mal_code(user, code: str, state: str) -> tuple[bool, str]:
    client_id = os.environ.get('MAL_CLIENT_ID', '').strip()
    client_secret = os.environ.get('MAL_CLIENT_SECRET', '').strip()
    if not client_id:
        return False, 'MAL_CLIENT_ID no configurado.'

    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    pending = sync.get('mal_oauth_pending') or {}
    if not pending or pending.get('state') != state:
        return False, 'Estado OAuth inválido o expirado.'

    payload = {
        'client_id': client_id,
        'grant_type': 'authorization_code',
        'code': code,
        'code_verifier': pending.get('code_verifier', ''),
        'redirect_uri': pending.get('redirect_uri', ''),
    }
    if client_secret:
        payload['client_secret'] = client_secret

    resp = requests.post(MAL_TOKEN_URL, data=payload, timeout=15)
    if resp.status_code != 200:
        return False, f'MyAnimeList rechazó el intercambio de token ({resp.status_code}).'

    token_data = resp.json()
    access_token = token_data.get('access_token', '')
    refresh_token = token_data.get('refresh_token', '')
    expires_in = int(token_data.get('expires_in') or 2592000)

    me_resp = requests.get(
        f'{MAL_API_BASE}/users/@me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=12,
    )
    mal_username = me_resp.json().get('name', '') if me_resp.status_code == 200 else ''

    sync.pop('mal_oauth_pending', None)
    sync['mal'] = {
        'connected': True,
        'username': mal_username,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_at': (timezone.now() + timedelta(seconds=expires_in)).isoformat(),
        'auto_push': True,
        'last_synced_at': timezone.now().isoformat(),
    }
    _save_sync_state(prefs, sync)
    return True, f'Cuenta de MyAnimeList ({mal_username}) vinculada correctamente.'


def pull_mal_list(user) -> dict:
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    mal = sync.get('mal') if isinstance(sync.get('mal'), dict) else {}
    access_token = mal.get('access_token')
    if not access_token:
        raise ValueError('No tienes una cuenta de MyAnimeList vinculada.')

    headers = {'Authorization': f'Bearer {access_token}'}
    url = f'{MAL_API_BASE}/users/@me/animelist?fields=list_status&limit=1000&nsfw=true'
    items = []
    pages = 0

    while url and pages < 10:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 401:
            raise ValueError('Tu sesión de MyAnimeList expiró. Vuelve a vincular tu cuenta.')
        if resp.status_code != 200:
            raise ValueError(f'Error consultando MyAnimeList ({resp.status_code}).')
        data = resp.json()
        items.extend(data.get('data') or [])
        url = (data.get('paging') or {}).get('next')
        pages += 1

    mal_ids = [int(it['node']['id']) for it in items if it.get('node', {}).get('id')]
    anime_map = {a.mal_id: a for a in Anime.objects.filter(mal_id__in=mal_ids)}

    created_count = 0
    updated_count = 0
    not_found_count = 0

    def _upsert():
        nonlocal created_count, updated_count, not_found_count
        for it in items:
            node = it.get('node') or {}
            ls = it.get('list_status') or {}
            mid = node.get('id')
            anime = anime_map.get(mid)
            if not anime:
                not_found_count += 1
                continue
            mapped_status = MAL_TO_ANIMIGOS_STATUS.get(ls.get('status', ''), 'pendiente')
            raw_score = ls.get('score') or 0
            score_val = int(raw_score) if 1 <= int(raw_score) <= 10 else None
            eps_val = max(0, int(ls.get('num_episodes_watched') or 0))

            _, created = UserAnimeEntry.objects.update_or_create(
                user=user,
                anime=anime,
                defaults={
                    'status': mapped_status,
                    'score': score_val,
                    'episodes_watched': eps_val,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

    run_with_db_retry(_upsert)

    mal['last_synced_at'] = timezone.now().isoformat()
    sync['mal'] = mal
    _save_sync_state(prefs, sync)

    return {
        'provider': 'mal',
        'total_remote': len(items),
        'created': created_count,
        'updated': updated_count,
        'not_found': not_found_count,
        'message': f'Sincronización con MyAnimeList completada: {created_count} nuevos, {updated_count} actualizados.',
    }


def push_entry_to_mal(user, entry: UserAnimeEntry) -> None:
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    mal = sync.get('mal') if isinstance(sync.get('mal'), dict) else {}
    access_token = mal.get('access_token')
    if not (mal.get('connected') and access_token and mal.get('auto_push', True)):
        return

    payload = {
        'status': ANIMIGOS_TO_MAL_STATUS.get(entry.status, 'watching'),
        'num_watched_episodes': max(0, int(entry.episodes_watched or 0)),
    }
    if entry.score is not None and 1 <= int(entry.score) <= 10:
        payload['score'] = int(entry.score)

    try:
        requests.patch(
            f'{MAL_API_BASE}/anime/{entry.anime.mal_id}/my_list_status',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data=payload,
            timeout=10,
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 2. ANILIST GRAPHQL OAUTH2 + IMPORTACIÓN POR USUARIO PÚBLICO
# ---------------------------------------------------------------------------

def build_anilist_auth_url(user) -> tuple[str | None, str | None]:
    client_id = os.environ.get('ANILIST_CLIENT_ID', '').strip()
    client_secret = os.environ.get('ANILIST_CLIENT_SECRET', '').strip()
    if not client_id or not client_secret:
        return None, (
            'ANILIST_CLIENT_ID / ANILIST_CLIENT_SECRET no están configurados en el servidor (.env). '
            'Puedes igualmente sincronizar tu lista pública de AniList ingresando tu nombre de usuario.'
        )

    redirect_uri = os.environ.get(
        'ANILIST_REDIRECT_URI',
        f'{get_backend_base_url()}/api/users/integrations/anilist/callback/',
    ).strip()
    state = f"{user.id}:{secrets.token_urlsafe(24)}"

    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    sync['anilist_oauth_pending'] = {
        'state': state,
        'redirect_uri': redirect_uri,
        'created_at': timezone.now().isoformat(),
    }
    _save_sync_state(prefs, sync)

    params = urllib.parse.urlencode({
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'state': state,
    })
    return f'{ANILIST_AUTH_URL}?{params}', None


def exchange_anilist_code(user, code: str, state: str) -> tuple[bool, str]:
    client_id = os.environ.get('ANILIST_CLIENT_ID', '').strip()
    client_secret = os.environ.get('ANILIST_CLIENT_SECRET', '').strip()
    if not client_id or not client_secret:
        return False, 'ANILIST_CLIENT_ID / ANILIST_CLIENT_SECRET no configurados.'

    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    pending = sync.get('anilist_oauth_pending') or {}
    if not pending or pending.get('state') != state:
        return False, 'Estado OAuth de AniList inválido o expirado.'

    resp = requests.post(
        ANILIST_TOKEN_URL,
        json={
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': pending.get('redirect_uri', ''),
            'code': code,
        },
        headers={'Accept': 'application/json'},
        timeout=15,
    )
    if resp.status_code != 200:
        return False, f'AniList rechazó el intercambio de token ({resp.status_code}).'

    token_data = resp.json()
    access_token = token_data.get('access_token', '')
    expires_in = int(token_data.get('expires_in') or 31536000)

    viewer_resp = requests.post(
        ANILIST_GRAPHQL_URL,
        json={'query': 'query { Viewer { id name } }'},
        headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'},
        timeout=12,
    )
    viewer = (viewer_resp.json().get('data') or {}).get('Viewer') or {} if viewer_resp.status_code == 200 else {}

    sync.pop('anilist_oauth_pending', None)
    sync['anilist'] = {
        'connected': True,
        'user_id': viewer.get('id'),
        'username': viewer.get('name') or '',
        'access_token': access_token,
        'expires_at': (timezone.now() + timedelta(seconds=expires_in)).isoformat(),
        'auto_push': True,
        'last_synced_at': timezone.now().isoformat(),
    }
    _save_sync_state(prefs, sync)
    return True, f"Cuenta de AniList ({viewer.get('name', '')}) vinculada correctamente."


def pull_anilist_list(user, public_username: str | None = None) -> dict:
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    anilist = sync.get('anilist') if isinstance(sync.get('anilist'), dict) else {}
    access_token = anilist.get('access_token')
    target_username = (public_username or anilist.get('username') or '').strip().lstrip('@')
    target_user_id = anilist.get('user_id') if not public_username else None

    if not target_username and not target_user_id:
        raise ValueError('Ingresa tu nombre de usuario de AniList o vincula tu cuenta por OAuth2.')

    query = """
    query ($userId: Int, $userName: String) {
      MediaListCollection(userId: $userId, userName: $userName, type: ANIME) {
        user { id name }
        lists {
          entries {
            status
            score(format: POINT_10)
            progress
            media {
              id
              idMal
              title { romaji english }
            }
          }
        }
      }
    }
    """
    variables = {'userId': target_user_id} if target_user_id else {'userName': target_username}
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'

    resp = requests.post(
        ANILIST_GRAPHQL_URL,
        json={'query': query, 'variables': variables},
        headers=headers,
        timeout=20,
    )
    if resp.status_code != 200:
        raise ValueError(f'No se pudo consultar AniList (HTTP {resp.status_code}). Verifica el nombre de usuario.')

    payload = resp.json()
    if payload.get('errors'):
        msg = payload['errors'][0].get('message', 'Error en AniList GraphQL')
        raise ValueError(f'AniList: {msg}')

    collection = (payload.get('data') or {}).get('MediaListCollection') or {}
    al_user = collection.get('user') or {}
    lists = collection.get('lists') or []

    all_entries = []
    for lst in lists:
        all_entries.extend(lst.get('entries') or [])

    mal_ids = [
        int(e['media']['idMal'])
        for e in all_entries
        if e.get('media') and e['media'].get('idMal')
    ]
    anime_map = {a.mal_id: a for a in Anime.objects.filter(mal_id__in=mal_ids)}

    created_count = 0
    updated_count = 0
    not_found_count = 0

    def _upsert():
        nonlocal created_count, updated_count, not_found_count
        seen_mal = set()
        for e in all_entries:
            media = e.get('media') or {}
            mid = media.get('idMal')
            if not mid or mid in seen_mal:
                continue
            seen_mal.add(mid)
            anime = anime_map.get(mid)
            if not anime:
                not_found_count += 1
                continue

            mapped_status = ANILIST_TO_ANIMIGOS_STATUS.get(e.get('status', ''), 'pendiente')
            raw_score = e.get('score') or 0
            score_val = int(round(float(raw_score))) if float(raw_score) >= 1 else None
            if score_val is not None:
                score_val = max(1, min(10, score_val))
            eps_val = max(0, int(e.get('progress') or 0))

            _, created = UserAnimeEntry.objects.update_or_create(
                user=user,
                anime=anime,
                defaults={
                    'status': mapped_status,
                    'score': score_val,
                    'episodes_watched': eps_val,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

    run_with_db_retry(_upsert)

    anilist['connected'] = True
    anilist['username'] = al_user.get('name') or target_username
    if al_user.get('id'):
        anilist['user_id'] = al_user.get('id')
    anilist['last_synced_at'] = timezone.now().isoformat()
    sync['anilist'] = anilist
    _save_sync_state(prefs, sync)

    return {
        'provider': 'anilist',
        'username': anilist['username'],
        'total_remote': len(all_entries),
        'created': created_count,
        'updated': updated_count,
        'not_found': not_found_count,
        'message': f"Sincronización con AniList (@{anilist['username']}) completada: {created_count} nuevos, {updated_count} actualizados.",
    }


def push_entry_to_anilist(user, entry: UserAnimeEntry) -> None:
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    anilist = sync.get('anilist') if isinstance(sync.get('anilist'), dict) else {}
    access_token = anilist.get('access_token')
    if not (anilist.get('connected') and access_token and anilist.get('auto_push', True)):
        return

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    try:
        resolve_resp = requests.post(
            ANILIST_GRAPHQL_URL,
            json={
                'query': 'query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }',
                'variables': {'idMal': entry.anime.mal_id},
            },
            headers=headers,
            timeout=10,
        )
        media_id = ((resolve_resp.json().get('data') or {}).get('Media') or {}).get('id')
        if not media_id:
            return

        mutation = """
        mutation ($mediaId: Int!, $progress: Int!, $status: MediaListStatus!, $scoreRaw: Int) {
          SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status, scoreRaw: $scoreRaw) {
            id
            progress
            status
          }
        }
        """
        variables = {
            'mediaId': int(media_id),
            'progress': max(0, int(entry.episodes_watched or 0)),
            'status': ANIMIGOS_TO_ANILIST_STATUS.get(entry.status, 'CURRENT'),
        }
        if entry.score is not None and 1 <= int(entry.score) <= 10:
            variables['scoreRaw'] = int(entry.score) * 10

        requests.post(
            ANILIST_GRAPHQL_URL,
            json={'query': mutation, 'variables': variables},
            headers=headers,
            timeout=10,
        )
    except Exception:
        pass


def sync_entry_to_linked_providers_async(user, entry: UserAnimeEntry) -> None:
    """
    Envía en segundo plano la actualización de episodios/estado a MAL y AniList
    si el usuario los tiene vinculados con OAuth2 y auto_push activo.
    """
    def _worker():
        try:
            push_entry_to_mal(user, entry)
        except Exception:
            pass
        try:
            push_entry_to_anilist(user, entry)
        except Exception:
            pass

    threading.Thread(target=_worker, daemon=True).start()


# ---------------------------------------------------------------------------
# 3. EXTENSIÓN DE NAVEGADOR (CRUNCHYROLL & NETFLIX AUTO-TRACKING)
# ---------------------------------------------------------------------------

def generate_extension_sync_token(user) -> str:
    token = f"animigos_sync_{secrets.token_urlsafe(32)}"
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    ext = sync.get('extension') if isinstance(sync.get('extension'), dict) else {}
    ext['api_token'] = token
    ext['enabled'] = True
    ext['updated_at'] = timezone.now().isoformat()
    sync['extension'] = ext
    _save_sync_state(prefs, sync)
    return token


def resolve_user_by_extension_token(token: str):
    clean = str(token or '').strip()
    if not clean or not clean.startswith('animigos_sync_'):
        return None
    for prefs in UserPreferences.objects.select_related('profile__user').all():
        sync = _read_sync_state(prefs)
        ext = sync.get('extension') if isinstance(sync.get('extension'), dict) else {}
        if ext.get('api_token') == clean:
            return prefs.profile.user
    return None


def _clean_streaming_title(raw_title: str) -> str:
    t = str(raw_title or '').strip()
    # Quitar sufijos comunes de Crunchyroll / Netflix
    t = re.sub(r'\s*[-–|]\s*(Crunchyroll|Netflix).*$', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*\((Dub|Sub|Spanish|Español|Latino|Subtitulado)\).*$', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*:\s*(Season|Temporada|Part|Parte)\s*\d+.*$', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s+(Episode|Episodio|Cap[íi]tulo|Ep\.?)\s*\d+.*$', '', t, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', t).strip()


def _match_anime_by_title(user, raw_title: str) -> Anime | None:
    clean = _clean_streaming_title(raw_title)
    if len(clean) < 2:
        return None

    # 1. Priorizar animes que ya están en la lista del usuario
    user_entry = (
        UserAnimeEntry.objects.filter(user=user)
        .select_related('anime')
        .filter(
            Q(anime__title__iexact=clean)
            | Q(anime__title_english__iexact=clean)
            | Q(anime__title__icontains=clean)
            | Q(anime__title_english__icontains=clean)
        )
        .first()
    )
    if user_entry:
        return user_entry.anime

    # 2. Match exacto en catálogo maestro (30k animes)
    exact = (
        Anime.objects.filter(
            Q(title__iexact=clean) | Q(title_english__iexact=clean) | Q(title_japanese__iexact=clean)
        )
        .order_by('-scored_by', '-score')
        .first()
    )
    if exact:
        return exact

    # 3. Match parcial ordenado por popularidad (members)
    partial = (
        Anime.objects.filter(Q(title__icontains=clean) | Q(title_english__icontains=clean))
        .order_by('-scored_by', '-score')
        .first()
    )
    return partial


def record_streaming_progress(user, source: str, raw_title: str, episode: int) -> dict:
    ep_num = max(1, int(episode or 1))
    anime = _match_anime_by_title(user, raw_title)
    if not anime:
        return {
            'matched': False,
            'message': f'No se encontró coincidencia en el catálogo de Animigos para "{raw_title}".',
        }

    def _upsert_progress():
        existing = UserAnimeEntry.objects.filter(user=user, anime=anime).first()
        new_eps = max(ep_num, existing.episodes_watched if existing else 0)
        if anime.episodes and new_eps >= anime.episodes:
            new_status = 'visto'
            new_eps = anime.episodes
        else:
            new_status = 'viendo'

        entry, created = UserAnimeEntry.objects.update_or_create(
            user=user,
            anime=anime,
            defaults={
                'status': new_status,
                'episodes_watched': new_eps,
            },
        )
        return entry, created

    entry, created = run_with_db_retry(_upsert_progress)

    # Guardar telemetría de último evento de la extensión
    prefs = _get_or_create_prefs(user)
    sync = _read_sync_state(prefs)
    ext = sync.get('extension') if isinstance(sync.get('extension'), dict) else {}
    ext['last_event_at'] = timezone.now().isoformat()
    ext['last_source'] = source
    ext['last_anime_title'] = anime.title
    ext['last_episode'] = entry.episodes_watched
    sync['extension'] = ext
    _save_sync_state(prefs, sync)

    # Sincronizar en cascada con MAL / AniList si el usuario los vinculó
    sync_entry_to_linked_providers_async(user, entry)

    return {
        'matched': True,
        'created': created,
        'source': source,
        'mal_id': anime.mal_id,
        'anime_title': anime.title,
        'episodes_watched': entry.episodes_watched,
        'episodes_total': anime.episodes,
        'status': entry.status,
        'message': f'Progreso actualizado: {anime.title} — Cap. {entry.episodes_watched}',
    }


# ---------------------------------------------------------------------------
# 4. IMPORTADOR DE HISTORIAL DE NETFLIX (NetflixViewingHistory.csv)
# ---------------------------------------------------------------------------

def import_netflix_viewing_history_csv(user, csv_text: str) -> dict:
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        raise ValueError('El archivo CSV está vacío o no tiene encabezados válidos.')

    # Detectar columna de título (Netflix usa "Title" en inglés o "Título" en español)
    title_col = next(
        (f for f in reader.fieldnames if f and f.strip().lower() in ('title', 'título', 'titulo')),
        reader.fieldnames[0],
    )

    series_episodes: dict[str, set[str]] = {}
    for row in reader:
        raw = str(row.get(title_col) or '').strip()
        if not raw:
            continue
        # Formato típico de Netflix: "Vinland Saga: Season 1: Episode 4" o "Spirited Away"
        parts = [p.strip() for p in raw.split(':')]
        base_title = _clean_streaming_title(parts[0])
        if len(base_title) < 2:
            continue
        series_episodes.setdefault(base_title, set()).add(raw)

    created_count = 0
    updated_count = 0
    matched_titles = []
    skipped_non_anime = 0

    # Limitar a 400 series únicas para mantener respuesta rápida
    for base_title, ep_rows in list(series_episodes.items())[:400]:
        anime = (
            Anime.objects.filter(Q(title__iexact=base_title) | Q(title_english__iexact=base_title))
            .order_by('-scored_by', '-score')
            .first()
        )
        if not anime:
            skipped_non_anime += 1
            continue

        watched_count = len(ep_rows)
        if anime.episodes and watched_count >= anime.episodes:
            new_status = 'visto'
            watched_count = anime.episodes
        elif anime.type == 'Movie' or (anime.episodes == 1):
            new_status = 'visto'
            watched_count = 1
        else:
            new_status = 'viendo'

        def _save_one():
            existing = UserAnimeEntry.objects.filter(user=user, anime=anime).first()
            final_eps = max(watched_count, existing.episodes_watched if existing else 0)
            final_status = 'visto' if (anime.episodes and final_eps >= anime.episodes) else new_status
            _, was_created = UserAnimeEntry.objects.update_or_create(
                user=user,
                anime=anime,
                defaults={
                    'status': final_status,
                    'episodes_watched': final_eps,
                },
            )
            return was_created

        was_created = run_with_db_retry(_save_one)
        if was_created:
            created_count += 1
        else:
            updated_count += 1
        matched_titles.append(anime.title)

    return {
        'total_titles_scanned': len(series_episodes),
        'matched_animes': len(matched_titles),
        'created': created_count,
        'updated': updated_count,
        'skipped_non_anime': skipped_non_anime,
        'sample_titles': matched_titles[:8],
        'message': (
            f'Historial de Netflix procesado: {created_count} animes nuevos, '
            f'{updated_count} actualizados ({skipped_non_anime} títulos no-anime omitidos).'
        ),
    }
