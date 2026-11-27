import time
import uuid
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Profile, SocialPost, UserPreferences


def _format_relative_es(dt) -> str:
    if not dt:
        return 'Ahora mismo'
    diff = max(0, int((timezone.now() - dt).total_seconds()))
    if diff < 60:
        return 'Ahora mismo'
    mins = diff // 60
    if mins < 60:
        return f'Hace {mins} min'
    hours = mins // 60
    if hours < 24:
        return f'Hace {hours} h'
    days = hours // 24
    if days == 1:
        return 'Ayer'
    if days < 30:
        return f'Hace {days} días'
    months = days // 30
    return f'Hace {months} mes' if months == 1 else f'Hace {months} meses'


def _build_author_dict(user: User) -> dict:
    profile = getattr(user, 'profile', None)
    return {
        'id': str(user.id),
        'nombre': (profile.display_name if profile and profile.display_name else '') or user.first_name or user.username,
        'usuario': user.username,
        'avatarUrl': (profile.avatar_url if profile and profile.avatar_url else ''),
    }


def _serialize_social_post(post: SocialPost, current_user: User | None) -> dict:
    uid_str = str(current_user.id) if (current_user and current_user.is_authenticated) else None
    liked_by = post.liked_by if isinstance(post.liked_by, list) else []
    poll_votes = post.poll_votes if isinstance(post.poll_votes, dict) else {}
    payload = dict(post.payload) if isinstance(post.payload, dict) else {}
    replies = list(post.replies) if isinstance(post.replies, list) else []

    data = {
        'id': post.id,
        'tipo': post.post_type,
        'autor': _build_author_dict(post.author),
        'creadoHace': _format_relative_es(post.created_at),
        'created_at_ts': int(post.created_at.timestamp()) if post.created_at else int(time.time()),
        'agradecimientos': len(liked_by),
        'agradecidoPorMi': bool(uid_str and uid_str in [str(x) for x in liked_by]),
        'respuestas': replies,
    }

    if post.post_type in ('recomendacion_directa', 'recomendacion_general'):
        rec = dict(payload.get('recomendacion') or {})
        rec['paraMi'] = bool(
            post.post_type == 'recomendacion_directa'
            and current_user
            and current_user.is_authenticated
            and post.recipient_id == current_user.id
        )
        data['recomendacion'] = rec
    elif post.post_type == 'busco_anime':
        data['busqueda'] = payload.get('busqueda') or {}
    elif post.post_type == 'encuesta':
        enc = dict(payload.get('encuesta') or {})
        opciones = [dict(o) for o in (enc.get('opciones') or [])]
        # Recalcular conteo real de votos desde poll_votes + votos base si existían
        vote_counts: dict[str, int] = {}
        for _, voted_opt in poll_votes.items():
            vote_counts[str(voted_opt)] = vote_counts.get(str(voted_opt), 0) + 1
        for o in opciones:
            oid = str(o.get('id') or '')
            if poll_votes:
                o['votos'] = vote_counts.get(oid, 0)
            else:
                o['votos'] = int(o.get('votos') or 0)
        enc['opciones'] = opciones
        enc['miVoto'] = poll_votes.get(uid_str) if uid_str else None
        data['encuesta'] = enc
    elif post.post_type == 'invitacion_sala':
        data['invitacion'] = payload.get('invitacion') or {}
    elif post.post_type == 'hito':
        data['hito'] = payload.get('hito') or {}

    return data


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def social_feed_view(request):
    """
    GET: Devuelve las publicaciones del Tablón Social compartidas en PostgreSQL.
         - Publicaciones públicas (recomendacion_general, busco_anime, encuesta, invitacion_sala, hito)
           son visibles para todos los usuarios/amigos.
         - Recomendaciones directas (recomendacion_directa) son visibles para el autor y el destinatario.
    POST: Crea una nueva publicación (o sincroniza publicaciones locales previas del usuario).
    """
    if request.method == 'GET':
        qs = SocialPost.objects.select_related('author', 'author__profile', 'recipient')
        if request.user and request.user.is_authenticated:
            qs = qs.filter(
                ~Q(post_type='recomendacion_directa')
                | Q(author=request.user)
                | Q(recipient=request.user)
            )
        else:
            qs = qs.exclude(post_type='recomendacion_directa')

        posts = list(qs.order_by('-created_at')[:80])
        serialized = [_serialize_social_post(p, request.user) for p in posts]
        return Response({'results': serialized})

    # POST requiere usuario autenticado
    if not request.user or not request.user.is_authenticated:
        return Response({'error': 'Debes iniciar sesión para publicar en El Tablón.'}, status=status.HTTP_401_UNAUTHORIZED)

    body = request.data or {}
    post_type = str(body.get('tipo') or 'recomendacion_general').strip()
    client_id = str(body.get('id') or '').strip()[:64]
    post_id = client_id if client_id else f"act-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"

    # Si ya existe (por sincronización de localStorage), devolverlo sin duplicar
    existing = SocialPost.objects.filter(id=post_id).first()
    if existing:
        return Response(_serialize_social_post(existing, request.user), status=status.HTTP_200_OK)

    recipient_user = None
    destinatario_raw = str(body.get('destinatarioId') or '').strip().lstrip('@')
    if destinatario_raw:
        recipient_user = User.objects.filter(username__iexact=destinatario_raw).first()

    payload = {}
    if post_type in ('recomendacion_directa', 'recomendacion_general'):
        payload['recomendacion'] = body.get('recomendacion') or {}
    elif post_type == 'busco_anime':
        payload['busqueda'] = body.get('busqueda') or {}
    elif post_type == 'encuesta':
        payload['encuesta'] = body.get('encuesta') or {}
    elif post_type == 'invitacion_sala':
        payload['invitacion'] = body.get('invitacion') or {}
    elif post_type == 'hito':
        payload['hito'] = body.get('hito') or {}

    initial_votes = {}
    if post_type == 'encuesta':
        enc = payload.get('encuesta') or {}
        if enc.get('miVoto'):
            initial_votes[str(request.user.id)] = str(enc['miVoto'])

    post = SocialPost.objects.create(
        id=post_id,
        author=request.user,
        recipient=recipient_user,
        post_type=post_type,
        payload=payload,
        liked_by=[str(request.user.id)] if body.get('agradecidoPorMi') else [],
        poll_votes=initial_votes,
        replies=body.get('respuestas') if isinstance(body.get('respuestas'), list) else [],
    )

    # Si esta recomendación responde a un post "busco_anime" (respuestaAId), anexarla al post padre en PostgreSQL
    respuesta_a_id = str(body.get('respuestaAId') or '').strip()
    if respuesta_a_id and post_type in ('recomendacion_directa', 'recomendacion_general'):
        parent = SocialPost.objects.filter(id=respuesta_a_id).first()
        if parent:
            rec_data = payload.get('recomendacion') or {}
            parent_replies = list(parent.replies) if isinstance(parent.replies, list) else []
            nueva_resp = {
                'id': f"resp-{int(time.time() * 1000)}-{uuid.uuid4().hex[:5]}",
                'autor': _build_author_dict(request.user),
                'nota': rec_data.get('nota') or '',
                'anime': rec_data.get('anime'),
                'creadoHace': 'Ahora mismo',
            }
            parent.replies = [nueva_resp, *parent_replies]
            parent.save(update_fields=['replies'])

    # Si tiene destinatario directo, despachar también notificación a su bandeja si no se envió aún
    if recipient_user and recipient_user.id != request.user.id and post_type == 'recomendacion_directa':
        try:
            rec_data = payload.get('recomendacion') or {}
            anime_obj = rec_data.get('anime') or {}
            target_prof, _ = Profile.objects.get_or_create(user=recipient_user)
            target_prefs, _ = UserPreferences.objects.get_or_create(profile=target_prof)
            ps = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
            notifs = list(ps.get('notifications', [])) if isinstance(ps.get('notifications'), list) else []
            sender_info = _build_author_dict(request.user)
            notifs.insert(0, {
                'id': str(uuid.uuid4()),
                'type': 'anime_recommendation',
                'from_username': sender_info['usuario'],
                'from_display_name': sender_info['nombre'],
                'from_avatar': sender_info['avatarUrl'],
                'anime_id': anime_obj.get('malId'),
                'anime_title': anime_obj.get('titulo') or 'Anime',
                'anime_poster': anime_obj.get('imagenUrl') or '',
                'message': rec_data.get('nota') or '¡Te recomiendo este anime!',
                'created_at': timezone.now().isoformat(),
                'read': False,
            })
            ps['notifications'] = notifs[:60]
            target_prefs.privacy_settings = ps
            target_prefs.save(update_fields=['privacy_settings', 'updated_at'])
        except Exception:
            pass

    return Response(_serialize_social_post(post, request.user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def social_post_vote_view(request, post_id: str):
    """Registra el voto de un usuario en una encuesta del Tablón Social en PostgreSQL."""
    post = SocialPost.objects.select_related('author', 'author__profile').filter(id=post_id, post_type='encuesta').first()
    if not post:
        return Response({'error': 'Encuesta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    opcion_id = str((request.data or {}).get('opcionId') or '').strip()
    if not opcion_id:
        return Response({'error': 'Opción requerida.'}, status=status.HTTP_400_BAD_REQUEST)

    votes = dict(post.poll_votes) if isinstance(post.poll_votes, dict) else {}
    uid_str = str(request.user.id)
    votes[uid_str] = opcion_id
    post.poll_votes = votes
    post.save(update_fields=['poll_votes'])

    return Response(_serialize_social_post(post, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def social_post_thank_view(request, post_id: str):
    """Alterna el agradecimiento/like de un usuario sobre una publicación del Tablón Social."""
    post = SocialPost.objects.select_related('author', 'author__profile').filter(id=post_id).first()
    if not post:
        return Response({'error': 'Publicación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    liked = [str(x) for x in (post.liked_by if isinstance(post.liked_by, list) else [])]
    uid_str = str(request.user.id)
    if uid_str in liked:
        liked = [x for x in liked if x != uid_str]
    else:
        liked.append(uid_str)
    post.liked_by = liked
    post.save(update_fields=['liked_by'])

    return Response(_serialize_social_post(post, request.user))
