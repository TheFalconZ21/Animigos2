"""
Ranking Global y de Amigos de Animigos + Estadísticas de Distribución Normal.
Calcula las horas totales vistas con la misma fórmula exacta que AnimeTimeWatchedView
(solo estados 'visto' y 'viendo', duración real del anime o fallback 24 min).
"""
import math
import statistics

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Friendship, Profile, UserAnimeEntry


def _entry_minutes_and_episodes(entry_status: str, episodes_watched: int | None, anime_episodes: int | None, anime_duration: int | None) -> tuple[int, int]:
    ep_duration = anime_duration if (anime_duration and anime_duration > 0) else 24
    if entry_status == 'visto':
        eps = anime_episodes or episodes_watched or 12
    else:
        eps = episodes_watched or (1 if entry_status == 'viendo' else 0)
    eps = max(0, int(eps))
    return eps * ep_duration, eps


def compute_user_watch_stats(user_ids: list[int] | None = None) -> dict[int, dict[str, int]]:
    """
    Calcula { total_minutes, total_hours, total_episodes, animes_completed } por user_id
    en una sola consulta ligera (sin N+1).
    """
    qs = UserAnimeEntry.objects.filter(status__in=['visto', 'viendo'])
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)

    rows = qs.values_list(
        'user_id',
        'status',
        'episodes_watched',
        'anime__episodes',
        'anime__duration',
    )

    agg: dict[int, dict[str, int]] = {}
    for uid, st, ep_w, a_eps, a_dur in rows:
        mins, eps = _entry_minutes_and_episodes(st, ep_w, a_eps, a_dur)
        bucket = agg.get(uid)
        if bucket is None:
            bucket = {
                'total_minutes': 0,
                'total_hours': 0,
                'total_episodes': 0,
                'animes_completed': 0,
            }
            agg[uid] = bucket
        bucket['total_minutes'] += mins
        bucket['total_episodes'] += eps
        if st == 'visto':
            bucket['animes_completed'] += 1

    for bucket in agg.values():
        bucket['total_hours'] = round(bucket['total_minutes'] / 60)

    return agg


def compute_single_user_watch_hours(user_id: int) -> int:
    stats = compute_user_watch_stats([user_id])
    return stats.get(user_id, {}).get('total_hours', 0)


def _get_friend_ids(user) -> set[int]:
    if not user or not user.is_authenticated:
        return set()
    pairs = Friendship.objects.filter(Q(user=user) | Q(friend=user)).values_list('user_id', 'friend_id')
    ids: set[int] = set()
    for u_id, f_id in pairs:
        if u_id != user.id:
            ids.add(u_id)
        if f_id != user.id:
            ids.add(f_id)
    return ids


@api_view(['GET'])
@permission_classes([AllowAny])
def user_ranking_view(request):
    """
    GET /api/users/ranking/?scope=all|friends
    Devuelve el ranking de usuarios ordenados por horas totales vistas,
    junto con parámetros de distribución normal (media, desviación estándar,
    mediana) y la posición/percentil/Z-score del usuario autenticado.
    """
    scope = (request.GET.get('scope') or 'all').strip().lower()
    if scope not in ('all', 'friends'):
        scope = 'all'

    is_auth = bool(request.user and request.user.is_authenticated)
    if scope == 'friends' and not is_auth:
        return Response(
            {'error': 'Inicia sesión para ver el ranking de tus amigos.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    friend_ids = _get_friend_ids(request.user) if is_auth else set()

    users_qs = User.objects.filter(is_active=True).select_related('profile')
    if scope == 'friends':
        allowed_ids = friend_ids | {request.user.id}
        users_qs = users_qs.filter(id__in=allowed_ids)

    users_list = list(users_qs)
    user_ids = [u.id for u in users_list]
    stats_map = compute_user_watch_stats(user_ids)

    entries = []
    for u in users_list:
        try:
            prof = u.profile
        except Profile.DoesNotExist:
            prof = None

        st = stats_map.get(u.id, {})
        total_hours = int(st.get('total_hours', 0))
        total_episodes = int(st.get('total_episodes', 0))
        animes_completed = int(st.get('animes_completed', 0))

        entries.append({
            'user_id': u.id,
            'username': u.username,
            'display_name': (prof.display_name if prof and prof.display_name else u.first_name or u.username),
            'avatar_url': (prof.avatar_url if prof and prof.avatar_url else '/media/avatars/crunchyroll_classic_collection/classic-hime-avatar-1.webp'),
            'total_hours': total_hours,
            'total_episodes': total_episodes,
            'animes_completed': animes_completed,
            'is_friend': u.id in friend_ids,
            'is_current_user': is_auth and u.id == request.user.id,
        })

    # Ordenar por horas descendente, luego episodios descendente, luego username ascendente
    entries.sort(key=lambda item: (-item['total_hours'], -item['total_episodes'], item['username'].lower()))

    for idx, item in enumerate(entries, start=1):
        item['rank'] = idx

    hours_values = [item['total_hours'] for item in entries]
    total_users = len(hours_values)

    if total_users > 0:
        mean_hours = round(sum(hours_values) / total_users, 2)
        median_hours = round(float(statistics.median(hours_values)), 2)
        variance = sum((x - mean_hours) ** 2 for x in hours_values) / total_users
        std_dev_hours = round(math.sqrt(variance), 2)
        min_hours = min(hours_values)
        max_hours = max(hours_values)
    else:
        mean_hours = 0.0
        median_hours = 0.0
        std_dev_hours = 0.0
        min_hours = 0
        max_hours = 0

    current_user_summary = None
    if is_auth:
        me = next((item for item in entries if item['is_current_user']), None)
        if me is not None and total_users > 0:
            my_hours = me['total_hours']
            below_or_equal = sum(1 for h in hours_values if h <= my_hours)
            percentile = round((below_or_equal / total_users) * 100, 1)
            top_percent = round((me['rank'] / total_users) * 100, 1)
            z_score = round((my_hours - mean_hours) / std_dev_hours, 2) if std_dev_hours > 0 else 0.0
            current_user_summary = {
                'rank': me['rank'],
                'total_hours': my_hours,
                'total_episodes': me['total_episodes'],
                'animes_completed': me['animes_completed'],
                'percentile': percentile,
                'top_percent': top_percent,
                'z_score': z_score,
            }

    return Response({
        'scope': scope,
        'ranking': entries,
        'distribution': {
            'total_users': total_users,
            'mean_hours': mean_hours,
            'std_dev_hours': std_dev_hours,
            'median_hours': median_hours,
            'min_hours': min_hours,
            'max_hours': max_hours,
        },
        'current_user': current_user_summary,
    })
