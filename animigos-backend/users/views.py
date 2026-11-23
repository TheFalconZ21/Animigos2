from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, F, Count
from django.utils import timezone
import xml.etree.ElementTree as ET
import time
import urllib.request
import json
from pathlib import Path
from django.conf import settings
import uuid
from animes.models import Anime
from core.services.fuentes_externas import obtener_estado_emision_animes
from core.utils.db_resilience import run_with_db_retry
from .models import Profile, UserPreferences, UserAnimeFolder, UserAnimeEntry, Friendship, FriendRequest
from .serializers import (
    ProfileSerializer,
    UserPreferencesSerializer,
    UserRegistrationSerializer,
    UserAnimeFolderSerializer,
    UserAnimeEntrySerializer,
)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    Registra una nueva cuenta de usuario y crea automáticamente su perfil y preferencias.
    Inicia la sesión segura mediante cookies HttpOnly en el cliente.
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        request.session.save()
        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={'display_name': user.first_name or user.username}
        )
        from .google_auth_views import detect_geo_from_request, apply_detected_geo_to_profile
        browser_tz = str(request.data.get('timezone_name') or '').strip()
        detected_geo = detect_geo_from_request(request, browser_timezone=browser_tz)
        apply_detected_geo_to_profile(profile, detected_geo)
        return Response({
            'message': 'Usuario registrado exitosamente',
            'authenticated': True,
            'is_new_user': True,
            'detected_geo': detected_geo,
            'session_id': request.session.session_key,
            'user': ProfileSerializer(profile, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """
    Inicia sesión con credenciales de usuario (soporta username o correo electrónico).
    Establece la sesión segura y retorna el perfil asociado.
    Valida usuarios mediante resolución multi-criterio (email, username, alias institucional)
    y resiliencia exhaustiva para teclados virtuales / móviles (espacios, autocapitalización).
    """
    raw_user_input = request.data.get('username') or request.data.get('email') or ''
    raw_password = request.data.get('password') or ''

    # Limpieza de espacios y caracteres invisibles o de control (zero-width space, BOM, tabs, newlines)
    clean_user = str(raw_user_input).strip().strip('\ufeff\u200b\r\n\t')
    clean_password = str(raw_password)

    if not clean_user or not clean_password:
        return Response({'error': 'Usuario o correo y contraseña requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Generación de variantes de contraseña (exacta primero para evitar PBKDF2 innecesarios)
    password_variants = []
    def add_pw_variant(pw):
        if pw and pw not in password_variants:
            password_variants.append(pw)

    add_pw_variant(clean_password)
    trimmed_pw = clean_password.strip().strip('\ufeff\u200b\r\n\t')
    add_pw_variant(trimmed_pw)
    if trimmed_pw:
        # Caso autocapitalización móvil: 'Villarroel123' -> 'villarroel123'
        add_pw_variant(trimmed_pw[0].lower() + trimmed_pw[1:])
        # Caso primera letra mayúscula: 'villarroel123' -> 'Villarroel123'
        add_pw_variant(trimmed_pw[0].upper() + trimmed_pw[1:])
        # Caso todo minúsculas
        add_pw_variant(trimmed_pw.lower())

    authenticated_user = None

    def _try_authenticate_candidates(users_list):
        for cand_user in users_list:
            for pw_var in password_variants:
                if cand_user.check_password(pw_var):
                    return cand_user
        return None

    # 2. Camino rápido: una sola query exacta por email o username (cubre >95% de logins)
    exact_candidates = list(
        User.objects.filter(Q(email__iexact=clean_user) | Q(username__iexact=clean_user))[:5]
    )
    authenticated_user = _try_authenticate_candidates(exact_candidates)

    # 3. Fallback tolerante (solo si la coincidencia exacta no resolvió): una sola query por prefijo
    if not authenticated_user:
        exact_ids = [u.pk for u in exact_candidates]
        if '@' in clean_user:
            email_prefix, email_domain = clean_user.split('@', 1)
            email_prefix = email_prefix.strip()
            email_domain = email_domain.strip()
            fallback_q = (
                Q(username__iexact=email_prefix)
                | Q(username__istartswith=email_prefix)
                | Q(email__istartswith=email_prefix, email__iendswith=email_domain)
            )
        else:
            fallback_q = Q(username__istartswith=clean_user) | Q(email__istartswith=clean_user)

        fallback_candidates = list(
            User.objects.filter(fallback_q).exclude(pk__in=exact_ids)[:5]
        )
        authenticated_user = _try_authenticate_candidates(fallback_candidates)

    # 4. Último fallback: autenticación estándar de Django
    if not authenticated_user:
        fallback_usernames = [clean_user]
        if '@' in clean_user:
            prefix = clean_user.split('@', 1)[0].strip()
            if prefix and prefix not in fallback_usernames:
                fallback_usernames.append(prefix)
        for uname in fallback_usernames:
            authenticated_user = authenticate(request, username=uname, password=trimmed_pw or clean_password)
            if authenticated_user:
                break

    # 5. Validación final del usuario autenticado y establecimiento de sesión
    if authenticated_user is not None:
        if not authenticated_user.is_active:
            return Response(
                {'error': 'Tu cuenta se encuentra inactiva. Contacta a un administrador.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not hasattr(authenticated_user, 'backend') or not authenticated_user.backend:
            authenticated_user.backend = 'django.contrib.auth.backends.ModelBackend'

        login(request, authenticated_user)
        request.session.save()

        profile, _ = Profile.objects.get_or_create(
            user=authenticated_user,
            defaults={'display_name': authenticated_user.first_name or authenticated_user.username}
        )

        return Response({
            'message': 'Sesión iniciada correctamente',
            'authenticated': True,
            'session_id': request.session.session_key,
            'user': ProfileSerializer(profile, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    return Response(
        {'error': 'Credenciales inválidas. Verifica tu usuario y contraseña.'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_user(request):
    """
    Cierra la sesión activa del usuario y limpia la cookie de sesión.
    """
    logout(request)
    return Response({'message': 'Sesión cerrada correctamente', 'authenticated': False})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_user(request):
    """
    Retorna el perfil del usuario actual si está autenticado.
    Principio Zero Trust (Pilar 2.1): No asume identidad demo si el cliente no está autenticado.
    """
    if request.user.is_authenticated:
        profile, _ = Profile.objects.get_or_create(
            user=request.user,
            defaults={'display_name': request.user.first_name or request.user.username}
        )
        return Response({
            'authenticated': True,
            'session_id': getattr(request.session, 'session_key', None),
            'user': ProfileSerializer(profile, context={'request': request}).data
        })

    return Response({
        'authenticated': False,
        'user': None
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """
    Actualiza datos de perfil (nombre, avatar, bio, anime favorito) del usuario autenticado.
    Zero Trust: Requiere autenticación estricta (HTTP 401 si no hay sesión).
    """
    profile = get_object_or_404(Profile, user=request.user)
    serializer = ProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_preferences(request):
    """
    Actualiza preferencias del usuario para el recomendador y privacidad.
    Zero Trust: Requiere autenticación estricta y preserva claves existentes en privacy_settings.
    """
    profile = get_object_or_404(Profile, user=request.user)
    preferences, _ = UserPreferences.objects.get_or_create(profile=profile)

    mutable_data = dict(request.data)
    if 'privacy_settings' in mutable_data and isinstance(mutable_data['privacy_settings'], dict):
        existing_ps = preferences.privacy_settings if isinstance(preferences.privacy_settings, dict) else {}
        merged_ps = {**existing_ps, **mutable_data['privacy_settings']}
        mutable_data['privacy_settings'] = merged_ps

    serializer = UserPreferencesSerializer(preferences, data=mutable_data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------------------------------------------
# SECCIÓN: MI LISTA (PERSONAL ANIME LIST & FOLDERS)
# -------------------------------------------------------------

def verificar_estrenos_usuario(user):
    """
    Revisa las entradas del usuario con estado 'esperando'.
    Si el anime ya se estrenó oficialmente (fecha de estreno alcanzada o estado RELEASING/FINISHED con fecha de estreno <= hoy),
    cambia automáticamente su estado a 'pendiente' y genera una notificación en la bandeja
    (que alimenta el Tablón Social).
    """
    import uuid
    from django.utils import timezone
    hoy = timezone.now().date()

    entradas_esperando = UserAnimeEntry.objects.filter(
        user=user,
        status='esperando'
    ).select_related('anime')

    if not entradas_esperando.exists():
        return 0

    estrenados_count = 0
    nuevas_notifs = []

    for entry in entradas_esperando:
        anime = entry.anime
        ya_estreno = False

        if anime.release_date and anime.release_date <= hoy:
            ya_estreno = True
        elif anime.status in ['RELEASING', 'FINISHED'] and (not anime.release_date or anime.release_date <= hoy):
            ya_estreno = True

        if ya_estreno:
            entry.status = 'pendiente'
            entry.save(update_fields=['status', 'updated_at'])
            estrenados_count += 1

            nuevas_notifs.append({
                'id': str(uuid.uuid4()),
                'type': 'anime_release',
                'from_username': 'calendario_oficial',
                'from_display_name': 'Calendario Oficial',
                'from_avatar': '',
                'anime_id': anime.mal_id,
                'anime_title': anime.title,
                'anime_poster': anime.image_url or '',
                'message': f'¡"{anime.title}" se ha estrenado oficialmente! Tu seguimiento cambió automáticamente de "Esperando su estreno" a "Pendiente".',
                'created_at': timezone.now().isoformat(),
                'read': False,
            })

    if nuevas_notifs:
        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={'display_name': user.first_name or user.username}
        )
        prefs, _ = UserPreferences.objects.get_or_create(profile=profile)
        ps = dict(prefs.privacy_settings) if isinstance(prefs.privacy_settings, dict) else {}
        notifs = list(ps.get('notifications', [])) if isinstance(ps.get('notifications'), list) else []

        existentes_anime_ids = {n.get('anime_id') for n in notifs if n.get('type') == 'anime_release'}
        for nn in nuevas_notifs:
            if nn['anime_id'] not in existentes_anime_ids:
                notifs.insert(0, nn)

        ps['notifications'] = notifs[:50]
        prefs.privacy_settings = ps
        prefs.save(update_fields=['privacy_settings'])

    return estrenados_count


def _is_valid_uuid(val):
    if not val:
        return False
    try:
        uuid.UUID(str(val).strip())
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_my_list_view(request):
    """
    GET: Lista completa de animes del usuario autenticado con carpetas, tags y estadísticas.
    POST: Agrega un nuevo anime a la lista personal del usuario autenticado.
    Zero Trust: Estrictamente aislado por cuenta de usuario.
    """
    try:
        user = request.user

        if request.method == 'GET':
            verificar_estrenos_usuario(user)

            entries_qs = (
                UserAnimeEntry.objects.filter(user=user)
                .select_related('anime', 'folder')
                .order_by('-updated_at')
            )
            folders_qs = UserAnimeFolder.objects.filter(user=user).prefetch_related('entries__anime')

            total_count = entries_qs.count()
            visto_count = entries_qs.filter(status='visto').count()
            viendo_count = entries_qs.filter(status='viendo').count()
            pendiente_count = entries_qs.filter(status='pendiente').count()
            dropeado_count = entries_qs.filter(status='dropeado').count()
            esperando_count = entries_qs.filter(status='esperando').count()

            scores = [e.score for e in entries_qs if e.score is not None]
            avg_score = round(sum(scores) / len(scores), 1) if scores else None

            tag_counts = {}
            for entry in entries_qs:
                for tag in (entry.tags or []):
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
            tags_list = [{'tag': k, 'count': v} for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])]

            return Response({
                'entries': UserAnimeEntrySerializer(entries_qs, many=True).data,
                'folders': UserAnimeFolderSerializer(folders_qs, many=True).data,
                'tags': tags_list,
                'stats': {
                    'total': total_count,
                    'visto': visto_count,
                    'viendo': viendo_count,
                    'pendiente': pendiente_count,
                    'dropeado': dropeado_count,
                    'esperando': esperando_count,
                    'average_score': avg_score,
                    'percent_completed': round((visto_count / total_count * 100)) if total_count > 0 else 0
                }
            })

        elif request.method == 'POST':
            raw_mal_id = request.data.get('mal_id') or request.data.get('anime_id')
            if not raw_mal_id:
                return Response({'error': 'mal_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                mal_id = int(raw_mal_id)
            except (ValueError, TypeError):
                return Response({'error': 'mal_id debe ser un número entero'}, status=status.HTTP_400_BAD_REQUEST)

            anime = Anime.objects.filter(mal_id=mal_id).first()
            if not anime:
                # Resiliencia: si el cliente proporciona datos mínimos del anime (ej. desde calendario, búsqueda o franquicia)
                anime_meta = request.data.get('anime') if isinstance(request.data.get('anime'), dict) else {}
                title = (request.data.get('title') or anime_meta.get('title') or '').strip()
                if title:
                    image_url = (request.data.get('image_url') or anime_meta.get('image_url') or '').strip()
                    episodes = request.data.get('episodes') or anime_meta.get('episodes')
                    anime, _ = run_with_db_retry(
                        lambda: Anime.objects.get_or_create(
                            mal_id=mal_id,
                            defaults={
                                'title': title,
                                'image_url': image_url,
                                'episodes': int(episodes) if (episodes and str(episodes).isdigit()) else None,
                                'status': anime_meta.get('status', 'UNKNOWN'),
                            },
                        )
                    )
                else:
                    return Response({'error': f'Anime con mal_id {mal_id} no encontrado en el catálogo'}, status=status.HTTP_404_NOT_FOUND)

            status_val = str(request.data.get('status', 'pendiente')).strip().lower()
            valid_statuses = [c[0] for c in UserAnimeEntry.STATUS_CHOICES]
            if status_val not in valid_statuses:
                status_val = 'pendiente'

            score_val = request.data.get('score')
            try:
                score_val = int(score_val) if score_val is not None and score_val != '' else None
                if score_val is not None and (score_val < 1 or score_val > 10):
                    score_val = None
            except (ValueError, TypeError):
                score_val = None

            try:
                episodes_val = max(0, int(request.data.get('episodes_watched', 0)))
            except (ValueError, TypeError):
                episodes_val = 0

            is_fav = bool(request.data.get('is_favorite', False))
            folder_id = request.data.get('folder_id')
            tags_val = request.data.get('tags', [])
            notes_val = str(request.data.get('notes', '') or '')

            folder = None
            if folder_id and _is_valid_uuid(folder_id):
                folder = UserAnimeFolder.objects.filter(id=folder_id, user=user).first()

            entry, created = run_with_db_retry(
                lambda: UserAnimeEntry.objects.update_or_create(
                    user=user,
                    anime=anime,
                    defaults={
                        'status': status_val,
                        'score': score_val,
                        'episodes_watched': episodes_val,
                        'is_favorite': is_fav,
                        'folder': folder,
                        'tags': tags_val if isinstance(tags_val, list) else [],
                        'notes': notes_val
                    }
                )
            )

            try:
                from .sync_services import sync_entry_to_linked_providers_async
                sync_entry_to_linked_providers_async(user, entry)
            except Exception:
                pass

            return Response(UserAnimeEntrySerializer(entry).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Error inesperado en user_my_list_view: {e}")
        return Response({'error': f'Error al procesar tu lista: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_my_list_entry_detail_view(request, entry_id):
    """
    PATCH: Actualiza nota, estado, episodios, favorito, carpeta, tags o notas de un anime del usuario.
    DELETE: Elimina el anime de la lista del usuario.
    """
    user = request.user
    if not _is_valid_uuid(entry_id):
        return Response({'error': 'ID de entrada no válido'}, status=status.HTTP_404_NOT_FOUND)

    entry = get_object_or_404(UserAnimeEntry.objects.select_related('anime', 'folder'), id=entry_id, user=user)

    if request.method == 'DELETE':
        run_with_db_retry(entry.delete)
        return Response({'message': 'Anime eliminado de tu lista correctamente'})

    elif request.method == 'PATCH':
        if 'status' in request.data:
            st = str(request.data['status']).strip().lower()
            if st in [c[0] for c in UserAnimeEntry.STATUS_CHOICES]:
                entry.status = st
        if 'score' in request.data:
            val = request.data['score']
            try:
                entry.score = int(val) if val is not None and val != '' else None
                if entry.score is not None and (entry.score < 1 or entry.score > 10):
                    entry.score = None
            except (ValueError, TypeError):
                entry.score = None
        if 'episodes_watched' in request.data:
            try:
                entry.episodes_watched = max(0, int(request.data['episodes_watched']))
            except (ValueError, TypeError):
                pass
        if 'is_favorite' in request.data:
            entry.is_favorite = bool(request.data['is_favorite'])
        if 'notes' in request.data:
            entry.notes = str(request.data['notes'] or '')
        if 'tags' in request.data:
            entry.tags = request.data['tags'] if isinstance(request.data['tags'], list) else []
        if 'folder_id' in request.data:
            fid = request.data['folder_id']
            entry.folder = UserAnimeFolder.objects.filter(id=fid, user=user).first() if (fid and _is_valid_uuid(fid)) else None

        run_with_db_retry(entry.save)
        try:
            from .sync_services import sync_entry_to_linked_providers_async
            sync_entry_to_linked_providers_async(user, entry)
        except Exception:
            pass
        return Response(UserAnimeEntrySerializer(entry).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_my_list_folders_view(request):
    """
    POST: Crea una nueva carpeta personal.
    """
    user = request.user
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'El nombre de la carpeta es requerido'}, status=status.HTTP_400_BAD_REQUEST)

    folder, created = UserAnimeFolder.objects.get_or_create(user=user, name=name)
    return Response(UserAnimeFolderSerializer(folder).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_my_list_folder_detail_view(request, folder_id):
    """
    PATCH: Renombra una carpeta del usuario autenticado.
    DELETE: Elimina la carpeta (los animes permanecen en la lista).
    """
    user = request.user
    if not _is_valid_uuid(folder_id):
        return Response({'error': 'ID de carpeta no válido'}, status=status.HTTP_404_NOT_FOUND)

    folder = get_object_or_404(UserAnimeFolder, id=folder_id, user=user)

    if request.method == 'DELETE':
        folder.delete()
        return Response({'message': 'Carpeta eliminada correctamente'})

    elif request.method == 'PATCH':
        name = request.data.get('name', '').strip()
        if name:
            folder.name = name
            folder.save(update_fields=['name', 'updated_at'])
        return Response(UserAnimeFolderSerializer(folder).data)



@api_view(['GET'])
@permission_classes([AllowAny])
def user_agenda_view(request):
    """
    Agenda de Tareas Pendientes (Pilar 1.2 y 2.1 de AGENTS.md):
    Devuelve los animes en emisión que el usuario está siguiendo,
    ordenados según capítulos de retraso (mayor retraso primero).
    Sirve como contador interactivo de capítulos para saber en cuál va y cuántos faltan para estar al día.
    """
    user = request.user
    items = []
    user_mal_ids = set()

    hoy = timezone.now().date()
    ahora_unix = int(timezone.now().timestamp())
    all_user_mal_ids = set()

    if user.is_authenticated:
        try:
            verificar_estrenos_usuario(user)
        except Exception:
            pass

        # Traer animes activos que el usuario está siguiendo (viendo, pendiente)
        entries_qs = (
            UserAnimeEntry.objects.filter(user=user)
            .exclude(status__in=['dropeado', 'visto', 'esperando'])
            .select_related('anime')
        )
        user_mal_ids = set(entries_qs.values_list('anime__mal_id', flat=True))
        all_user_mal_ids = set(UserAnimeEntry.objects.filter(user=user).values_list('anime__mal_id', flat=True))

        mal_ids = list(user_mal_ids)
        airing_data = obtener_estado_emision_animes(mal_ids)

        for entry in entries_qs:
            anime = entry.anime
            info = airing_data.get(anime.mal_id, {})

            # Determinar si el anime es en emisión o de temporada reciente
            is_releasing_db = (anime.status == 'RELEASING')
            is_releasing_live = (info.get('status') == 'RELEASING')
            has_next_airing = bool(info.get('next_airing_at') and info['next_airing_at'] > ahora_unix)
            has_episodes_out = (info.get('latest_episode') or 0) > 0
            is_seasonal = bool(
                (anime.season_year and anime.season_year >= (hoy.year - 1))
                or (anime.release_date and anime.release_date >= hoy.replace(year=hoy.year - 1))
            )

            # Si es un anime terminado antiguo y no está en emisión ni tiene estrenos futuros, omitir
            if anime.status == 'FINISHED' and not is_releasing_live and not is_seasonal and not has_next_airing:
                continue

            # Si aún no tiene estreno confirmado y es futuro lejano (> 90 días) sin capítulos
            if anime.status in ('NOT_YET_RELEASED', 'NOT_YET_AIRED') and not has_next_airing and not has_episodes_out:
                import datetime
                if anime.release_date and anime.release_date > (hoy + datetime.timedelta(days=90)):
                    continue

            # Auto-actualizar estado en DB si AniList o la fecha confirman emisión
            if anime.status in ('NOT_YET_RELEASED', 'NOT_YET_AIRED') and (is_releasing_live or (anime.release_date and anime.release_date <= hoy)):
                anime.status = 'RELEASING'
                try:
                    anime.save(update_fields=['status'])
                except Exception:
                    pass

            latest_ep = info.get('latest_episode')
            if latest_ep is None or latest_ep == 0:
                if (anime.release_date and anime.release_date <= hoy) or is_releasing_db or is_releasing_live:
                    latest_ep = anime.episodes or 1
                else:
                    latest_ep = 0

            episodes_watched = entry.episodes_watched or 0
            episodes_behind = max(0, latest_ep - episodes_watched)
            is_up_to_date = (episodes_behind == 0)
            progress_pct = min(100, round((episodes_watched / latest_ep) * 100)) if latest_ep > 0 else (0 if episodes_watched == 0 else 100)
            duration_num = int(anime.duration) if (anime.duration and anime.duration > 0) else 24

            items.append({
                'entry_id': str(entry.id),
                'mal_id': anime.mal_id,
                'title': anime.title,
                'title_english': anime.title_english or anime.title,
                'image_url': anime.image_url,
                'banner_url': anime.banner_url or anime.image_url,
                'user_status': entry.status,
                'episodes_watched': episodes_watched,
                'latest_episode': latest_ep,
                'total_episodes': info.get('total_episodes') or anime.episodes,
                'episodes_behind': episodes_behind,
                'is_up_to_date': is_up_to_date,
                'progress_percent': progress_pct,
                'duration': duration_num,
                'next_airing_at': info.get('next_airing_at'),
                'next_episode': info.get('next_episode'),
                'score': float(entry.score) if entry.score else None,
                'is_favorite': entry.is_favorite,
            })

        # Ordenar por capítulos de atraso descendente (mayor retraso primero)
        items.sort(key=lambda x: (-x['episodes_behind'], x['title']))

    # Animes en emisión sugeridos (top popular por scored_by que ya estén al aire)
    suggested_qs = (
        Anime.objects.filter(status='RELEASING')
        .exclude(status='NOT_YET_RELEASED')
        .order_by('-scored_by', 'popularity')[:25]
        .values(
            'mal_id', 'title', 'title_english', 'image_url', 'banner_url',
            'score', 'scored_by', 'episodes', 'synopsis', 'synopsis_es', 'genres', 'duration', 'release_date'
        )
    )
    sugg_ids = [s['mal_id'] for s in suggested_qs]
    sugg_airing = obtener_estado_emision_animes(sugg_ids)

    suggested_items = []
    for s in suggested_qs:
        mid = s['mal_id']
        info = sugg_airing.get(mid, {})
        # Descartar los que aún no se estrenan
        if (
            info.get('status') == 'NOT_YET_RELEASED'
            or (s.get('release_date') and s['release_date'] > hoy and (info.get('latest_episode') or 0) == 0)
        ):
            continue
        latest_ep = info.get('latest_episode')
        if latest_ep is None:
            latest_ep = s['episodes'] or 1
        synopsis_text = s['synopsis_es'] or s['synopsis'] or ''
        genres_list = s['genres'] if isinstance(s['genres'], list) else []
        dur_val = int(s['duration']) if (s['duration'] and s['duration'] > 0) else 24

        suggested_items.append({
            'mal_id': mid,
            'title': s['title'],
            'title_english': s['title_english'] or s['title'],
            'image_url': s['image_url'],
            'banner_url': s['banner_url'] or s['image_url'],
            'synopsis': synopsis_text,
            'genres': genres_list,
            'duration': dur_val,
            'score': float(s['score']) if s['score'] else 0.0,
            'scored_by': s['scored_by'],
            'latest_episode': latest_ep,
            'total_episodes': info.get('total_episodes') or s['episodes'],
            'next_airing_at': info.get('next_airing_at'),
            'next_episode': info.get('next_episode'),
            'in_user_list': mid in all_user_mal_ids
        })
        if len(suggested_items) >= 15:
            break

    total_series = len(items)
    total_behind = sum(x['episodes_behind'] for x in items)
    up_to_date_count = sum(1 for x in items if x['is_up_to_date'])
    behind_count = sum(1 for x in items if not x['is_up_to_date'])
    estimated_minutes = sum(x['episodes_behind'] * x.get('duration', 24) for x in items)

    return Response({
        'summary': {
            'total_series': total_series,
            'total_episodes_behind': total_behind,
            'behind_count': behind_count,
            'estimated_minutes': estimated_minutes,
            'up_to_date_count': up_to_date_count,
        },
        'items': items,
        'suggested_airing': suggested_items,
        'is_authenticated': user.is_authenticated
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_mal_xml_view(request):
    """
    Importa la lista personal de anime a partir del archivo oficial animelist.xml de MyAnimeList.
    - Cumple Pilares 2.1 y 2.2 de AGENTS.md (Zero Trust y Validación de Backend).
    - Tasa de consultas ultra-conservadora: animes desconocidos se crean de inmediato como
      placeholders locales con los metadatos del XML, y se enriquecen con MyAnimeList/Jikan
      con un tope estricto de máximo 5 títulos y un delay de 1.5s entre peticiones para prevenir
      bloqueos por rate limit.
    """
    user = request.user

    file_obj = request.FILES.get('file')
    raw_xml = request.data.get('xml_content')

    if file_obj:
        try:
            content = file_obj.read().decode('utf-8', errors='replace')
        except Exception as e:
            return Response({'error': f'No se pudo leer el archivo XML: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    elif raw_xml:
        content = raw_xml
    else:
        return Response({'error': 'Debes enviar un archivo XML en el campo "file" o contenido en "xml_content"'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        return Response({'error': f'El archivo no tiene un formato XML válido: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    anime_nodes = root.findall('anime')
    if not anime_nodes:
        return Response({'error': 'No se encontraron registros de anime (<anime>) en el archivo XML.'}, status=status.HTTP_400_BAD_REQUEST)

    STATUS_MAP = {
        'completed': 'visto',
        'watching': 'viendo',
        'on-hold': 'pendiente',
        'dropped': 'dropeado',
        'plan to watch': 'pendiente',
        'plantowatch': 'pendiente',
    }

    parsed_entries = []
    mal_ids_set = set()

    for node in anime_nodes:
        aid_node = node.find('series_animedb_id')
        if aid_node is None or not aid_node.text:
            continue
        try:
            mal_id = int(aid_node.text.strip())
        except ValueError:
            continue

        title_node = node.find('series_title')
        title = title_node.text.strip() if (title_node is not None and title_node.text) else f"Anime #{mal_id}"

        type_node = node.find('series_type')
        series_type = type_node.text.strip() if (type_node is not None and type_node.text) else 'TV'

        ep_node = node.find('series_episodes')
        episodes = None
        if ep_node is not None and ep_node.text:
            try:
                episodes = int(ep_node.text.strip())
            except ValueError:
                pass

        st_node = node.find('my_status')
        st_raw = (st_node.text.strip().lower() if (st_node is not None and st_node.text) else 'completed')
        status_val = STATUS_MAP.get(st_raw, 'pendiente')

        sc_node = node.find('my_score')
        score_val = None
        if sc_node is not None and sc_node.text:
            try:
                sc_int = int(sc_node.text.strip())
                if 1 <= sc_int <= 10:
                    score_val = sc_int
            except ValueError:
                pass

        ep_watched_node = node.find('my_watched_episodes')
        ep_watched = 0
        if ep_watched_node is not None and ep_watched_node.text:
            try:
                ep_watched = max(0, int(ep_watched_node.text.strip()))
            except ValueError:
                pass

        comments_node = node.find('my_comments')
        notes_val = comments_node.text.strip() if (comments_node is not None and comments_node.text) else ''

        tags_node = node.find('my_tags')
        tags_list = []
        if tags_node is not None and tags_node.text:
            raw_tags = [t.strip() for t in tags_node.text.split(',') if t.strip()]
            tags_list = [t if t.startswith('#') else f"#{t}" for t in raw_tags][:5]

        is_fav = (score_val == 10) or any('fav' in t.lower() for t in tags_list)

        parsed_entries.append({
            'mal_id': mal_id,
            'title': title,
            'series_type': series_type,
            'episodes': episodes,
            'status': status_val,
            'score': score_val,
            'episodes_watched': ep_watched,
            'notes': notes_val,
            'tags': tags_list,
            'is_favorite': is_fav,
        })
        mal_ids_set.add(mal_id)

    # 1. Obtener animes existentes en nuestra BD
    existing_animes = {a.mal_id: a for a in Anime.objects.filter(mal_id__in=mal_ids_set)}
    
    # 2. Animes faltantes: registrar inmediatamente con metadatos del XML para que no falle la importación
    new_animes_created = 0
    missing_animes_to_enrich = []
    for entry in parsed_entries:
        aid = entry['mal_id']
        if aid not in existing_animes:
            new_anime = Anime.objects.create(
                mal_id=aid,
                title=entry['title'],
                type=entry['series_type'] or 'TV',
                episodes=entry['episodes'],
                synopsis='Importado automáticamente desde MyAnimeList.',
                image_url='https://cdn.myanimelist.net/images/anime/placeholder.jpg',
            )
            existing_animes[aid] = new_anime
            missing_animes_to_enrich.append(aid)
            new_animes_created += 1

    # 3. Enriquecimiento ultra-conservador: máx 5 títulos con delay 1.5s
    enriched_count = 0
    if missing_animes_to_enrich:
        to_lookup = missing_animes_to_enrich[:5]
        for aid in to_lookup:
            time.sleep(1.5)  # Delay conservador para respetar rate limits
            try:
                req = urllib.request.Request(
                    f"https://api.jikan.moe/v4/anime/{aid}",
                    headers={'User-Agent': 'Animigos/2.0 (Anime Platform; respectful client)'}
                )
                with urllib.request.urlopen(req, timeout=4) as resp:
                    if resp.status == 200:
                        j_data = json.loads(resp.read().decode('utf-8')).get('data', {})
                        if j_data:
                            target_anime = existing_animes.get(aid)
                            if target_anime:
                                img = (j_data.get('images', {}).get('jpg', {}).get('large_image_url')
                                       or j_data.get('images', {}).get('jpg', {}).get('image_url'))
                                if img:
                                    target_anime.image_url = img
                                syn = j_data.get('synopsis')
                                if syn:
                                    target_anime.synopsis = syn
                                studios = j_data.get('studios', [])
                                if studios:
                                    target_anime.studio = studios[0].get('name', '')
                                genres = [g.get('name') for g in j_data.get('genres', []) if g.get('name')]
                                if genres:
                                    target_anime.genres = genres
                                target_anime.save(update_fields=['image_url', 'synopsis', 'studio', 'genres'])
                                enriched_count += 1
            except Exception:
                # Si falla o MyAnimeList/Jikan limita la cuota, salir silenciosamente sin interrumpir la importación
                break

    # 4. Guardar las entradas del usuario de forma atómica
    created_count = 0
    updated_count = 0

    with transaction.atomic():
        for entry in parsed_entries:
            aid = entry['mal_id']
            anime_obj = existing_animes.get(aid)
            if not anime_obj:
                continue

            obj, was_created = UserAnimeEntry.objects.update_or_create(
                user=user,
                anime=anime_obj,
                defaults={
                    'status': entry['status'],
                    'score': entry['score'],
                    'episodes_watched': entry['episodes_watched'],
                    'is_favorite': entry['is_favorite'],
                    'tags': entry['tags'],
                    'notes': entry['notes']
                }
            )
            if was_created:
                created_count += 1
            else:
                updated_count += 1

    return Response({
        'success': True,
        'total_parsed': len(parsed_entries),
        'imported': created_count + updated_count,
        'created': created_count,
        'updated': updated_count,
        'new_animes_registered': new_animes_created,
        'enriched_count': enriched_count,
        'message': f"¡Listo! Se procesaron {len(parsed_entries)} animes ({created_count} añadidos, {updated_count} actualizados)."
    }, status=status.HTTP_200_OK)


# -------------------------------------------------------------
# SECCIÓN: AVATARES PREDEFINIDOS (CATÁLOGO OPTIMIZADO)
# -------------------------------------------------------------

_CACHED_PRESET_AVATARS = None

@api_view(['GET'])
@permission_classes([AllowAny])
def get_preset_avatars(request):
    """
    Retorna el catálogo de avatares optimizados en WebP agrupados por series/lotes de anime.
    - ?summary=true: Retorna solo 1 avatar representativo (preview_avatar) por cada anime/lote
      para evitar cargar los ~845 avatares de golpe en la vista inicial.
    - ?category=<slug>: Retorna todos los avatares del anime/lote seleccionado.
    - ?search=<texto>: Filtra lotes y avatares por nombre de serie o personaje.
    """
    global _CACHED_PRESET_AVATARS

    if _CACHED_PRESET_AVATARS is None:
        catalog_path = Path(settings.MEDIA_ROOT) / 'avatars' / 'preset_avatars.json'
        if catalog_path.exists():
            try:
                with open(catalog_path, 'r', encoding='utf-8') as f:
                    _CACHED_PRESET_AVATARS = json.load(f)
            except Exception:
                _CACHED_PRESET_AVATARS = []
        else:
            _CACHED_PRESET_AVATARS = []

    search_query = request.query_params.get('search', '').strip().lower()
    category_slug = request.query_params.get('category', '').strip().lower()
    summary_only = request.query_params.get('summary', '').strip().lower() in ('1', 'true', 'yes')

    total_all_categories = len(_CACHED_PRESET_AVATARS)
    total_all_avatars = sum(c.get('count', len(c.get('avatars', []))) for c in _CACHED_PRESET_AVATARS)

    if summary_only and not category_slug and not search_query:
        summary_categories = []
        for cat in _CACHED_PRESET_AVATARS:
            avatars_list = cat.get('avatars', [])
            first_avatar = avatars_list[0] if avatars_list else None
            summary_categories.append({
                'slug': cat.get('slug'),
                'name': cat.get('name'),
                'count': cat.get('count', len(avatars_list)),
                'preview_avatar': first_avatar,
                'avatars': [first_avatar] if first_avatar else [],
            })
        return Response({
            'total_categories': total_all_categories,
            'total_avatars': total_all_avatars,
            'summary': True,
            'categories': summary_categories,
        })

    if not search_query and not category_slug:
        return Response({
            'total_categories': total_all_categories,
            'total_avatars': total_all_avatars,
            'summary': False,
            'categories': _CACHED_PRESET_AVATARS,
        })

    filtered_categories = []
    for cat in _CACHED_PRESET_AVATARS:
        if category_slug and str(cat.get('slug', '')).lower() != category_slug:
            continue

        avatars_list = cat.get('avatars', [])
        matched_avatars = []
        cat_name_matches = search_query and search_query in cat.get('name', '').lower()

        for av in avatars_list:
            if not search_query or cat_name_matches or search_query in av.get('name', '').lower():
                matched_avatars.append(av)

        if matched_avatars:
            first_avatar = matched_avatars[0]
            filtered_categories.append({
                'slug': cat.get('slug'),
                'name': cat.get('name'),
                'count': len(matched_avatars),
                'preview_avatar': first_avatar,
                'avatars': [first_avatar] if (summary_only and not category_slug) else matched_avatars,
            })

    return Response({
        'total_categories': len(filtered_categories),
        'total_avatars': sum(c.get('count', 0) for c in filtered_categories),
        'summary': bool(summary_only and not category_slug),
        'categories': filtered_categories,
    })


def _push_user_notification(target_user, notif_payload: dict) -> None:
    """Agrega una notificación a las preferencias del usuario destinatario."""
    try:
        target_prof_obj, _ = Profile.objects.get_or_create(
            user=target_user,
            defaults={'display_name': target_user.first_name or target_user.username}
        )
        target_prefs, _ = UserPreferences.objects.get_or_create(profile=target_prof_obj)
        ps = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
        notifs = list(ps.get('notifications', [])) if isinstance(ps.get('notifications'), list) else []
        notifs.insert(0, {
            'id': str(uuid.uuid4()),
            'created_at': timezone.now().isoformat(),
            'read': False,
            **notif_payload,
        })
        ps['notifications'] = notifs[:40]
        target_prefs.privacy_settings = ps
        target_prefs.save(update_fields=['privacy_settings'])
    except Exception:
        pass


def _compute_mutual_friends_map(user, candidate_ids: list[int]) -> dict[int, int]:
    """Calcula en una sola query cuántos amigos en común tiene `user` con cada candidato."""
    if not candidate_ids or not user or not user.is_authenticated:
        return {}
    my_friend_ids = set(Friendship.objects.filter(user=user).values_list('friend_id', flat=True))
    if not my_friend_ids:
        return {}
    rows = (
        Friendship.objects.filter(user_id__in=candidate_ids, friend_id__in=my_friend_ids)
        .values('user_id')
        .annotate(mutual_count=Count('friend_id', distinct=True))
    )
    return {row['user_id']: row['mutual_count'] for row in rows}


def _compute_anime_counts_map(user_ids: list[int]) -> dict[int, int]:
    """Obtiene en una sola query el conteo de animes en lista para un conjunto de usuarios."""
    if not user_ids:
        return {}
    rows = (
        UserAnimeEntry.objects.filter(user_id__in=user_ids)
        .values('user_id')
        .annotate(total=Count('id'))
    )
    return {row['user_id']: row['total'] for row in rows}


def _serialize_social_user(user_obj, anime_counts: dict[int, int], mutual_counts: dict[int, int], extra: dict | None = None) -> dict:
    prof = getattr(user_obj, 'profile', None)
    data = {
        'id': user_obj.id,
        'username': user_obj.username,
        'display_name': (prof and prof.display_name) or user_obj.first_name or user_obj.username,
        'avatar_url': (prof and prof.avatar_url) or '',
        'bio': (prof and prof.bio) or '',
        'anime_count': anime_counts.get(user_obj.id, 0),
        'mutual_friends_count': mutual_counts.get(user_obj.id, 0),
    }
    if extra:
        data.update(extra)
    return data


def _resolve_target_user(raw_query: str):
    clean_query = str(raw_query).strip()
    if '@' in clean_query and not clean_query.startswith('@'):
        return User.objects.filter(email__iexact=clean_query).select_related('profile').first()
    clean_uname = clean_query.lstrip('@')
    return (
        User.objects.filter(username__iexact=clean_uname).select_related('profile').first()
        or User.objects.filter(profile__display_name__iexact=clean_uname).select_related('profile').first()
    )


def _create_or_accept_friend_request(sender, target_user) -> tuple[dict, int]:
    """
    Crea una solicitud de amistad pendiente de `sender` hacia `target_user`.
    Si `target_user` ya tenía una solicitud pendiente hacia `sender`, se acepta automáticamente.
    """
    if target_user.id == sender.id:
        return {'error': 'No puedes enviarte una solicitud de amistad a ti mismo.'}, status.HTTP_400_BAD_REQUEST

    target_prof = getattr(target_user, 'profile', None)
    target_name = (target_prof and target_prof.display_name) or target_user.first_name or target_user.username
    sender_prof = getattr(sender, 'profile', None)
    sender_name = (sender_prof and sender_prof.display_name) or sender.first_name or sender.username
    sender_avatar = (sender_prof and sender_prof.avatar_url) or ''

    # 1. ¿Ya son amigos?
    if Friendship.objects.filter(user=sender, friend=target_user).exists():
        return {
            'error': f'Ya eres amigo de {target_name}.',
            'friendship_status': 'friends',
        }, status.HTTP_400_BAD_REQUEST

    anime_counts = _compute_anime_counts_map([target_user.id])
    mutual_counts = _compute_mutual_friends_map(sender, [target_user.id])

    # 2. ¿El otro usuario ya nos envió una solicitud pendiente? -> Aceptación mutua inmediata
    reverse_req = FriendRequest.objects.filter(
        from_user=target_user,
        to_user=sender,
        status='pending',
    ).first()
    if reverse_req:
        def _accept_reverse():
            reverse_req.status = 'accepted'
            reverse_req.save(update_fields=['status', 'updated_at'])
            Friendship.objects.get_or_create(user=sender, friend=target_user)
            Friendship.objects.get_or_create(user=target_user, friend=sender)
        run_with_db_retry(_accept_reverse)

        _push_user_notification(target_user, {
            'type': 'friend_accepted',
            'from_username': sender.username,
            'from_display_name': sender_name,
            'from_avatar': sender_avatar,
            'message': 'aceptó tu solicitud de amistad en Animigos.',
        })
        return {
            'message': f'¡Solicitud aceptada! Ahora eres amigo de {target_name}.',
            'friendship_status': 'friends',
            'accepted': True,
            'friend': _serialize_social_user(target_user, anime_counts, mutual_counts),
        }, status.HTTP_201_CREATED

    # 3. ¿Ya existe una solicitud enviada por nosotros?
    existing_req = FriendRequest.objects.filter(from_user=sender, to_user=target_user).first()
    if existing_req and existing_req.status == 'pending':
        return {
            'message': f'Ya tienes una solicitud pendiente con {target_name}.',
            'friendship_status': 'pending_sent',
            'request_id': str(existing_req.id),
            'request': _serialize_social_user(
                target_user,
                anime_counts,
                mutual_counts,
                {'request_id': str(existing_req.id), 'created_at': existing_req.created_at.isoformat()},
            ),
        }, status.HTTP_200_OK

    # 4. Crear o reactivar solicitud pendiente
    def _save_request():
        if existing_req:
            existing_req.status = 'pending'
            existing_req.created_at = timezone.now()
            existing_req.save(update_fields=['status', 'created_at', 'updated_at'])
            return existing_req
        return FriendRequest.objects.create(from_user=sender, to_user=target_user, status='pending')

    req_obj = run_with_db_retry(_save_request)

    _push_user_notification(target_user, {
        'type': 'friend_request',
        'from_username': sender.username,
        'from_display_name': sender_name,
        'from_avatar': sender_avatar,
        'request_id': str(req_obj.id),
        'message': 'te envió una solicitud de amistad en Animigos.',
    })

    return {
        'message': f'Solicitud de amistad enviada a {target_name}.',
        'friendship_status': 'pending_sent',
        'request_id': str(req_obj.id),
        'request': _serialize_social_user(
            target_user,
            anime_counts,
            mutual_counts,
            {'request_id': str(req_obj.id), 'created_at': req_obj.created_at.isoformat()},
        ),
    }, status.HTTP_201_CREATED


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_friends_view(request, friend_id=None):
    """
    Gestiona amigos y solicitudes del usuario autenticado:
    - GET: Retorna amigos confirmados + solicitudes entrantes y salientes pendientes.
    - POST: Envía una solicitud de amistad (o acepta automáticamente si existía una inversa).
    - DELETE: Elimina a un amigo por su ID de usuario.
    """
    user = request.user

    if request.method == 'GET':
        friendships = list(
            Friendship.objects.filter(user=user).select_related('friend', 'friend__profile')
        )
        incoming_qs = list(
            FriendRequest.objects.filter(to_user=user, status='pending')
            .select_related('from_user', 'from_user__profile')
            .order_by('-created_at')
        )
        outgoing_qs = list(
            FriendRequest.objects.filter(from_user=user, status='pending')
            .select_related('to_user', 'to_user__profile')
            .order_by('-created_at')
        )

        all_user_ids = list({
            *(f.friend_id for f in friendships),
            *(r.from_user_id for r in incoming_qs),
            *(r.to_user_id for r in outgoing_qs),
        })
        anime_counts = _compute_anime_counts_map(all_user_ids)
        mutual_counts = _compute_mutual_friends_map(user, all_user_ids)

        friends_data = [
            _serialize_social_user(
                f.friend,
                anime_counts,
                mutual_counts,
                {'created_at': f.created_at.isoformat()},
            )
            for f in friendships
        ]
        incoming_data = [
            _serialize_social_user(
                r.from_user,
                anime_counts,
                mutual_counts,
                {'request_id': str(r.id), 'created_at': r.created_at.isoformat()},
            )
            for r in incoming_qs
        ]
        outgoing_data = [
            _serialize_social_user(
                r.to_user,
                anime_counts,
                mutual_counts,
                {'request_id': str(r.id), 'created_at': r.created_at.isoformat()},
            )
            for r in outgoing_qs
        ]

        return Response({
            'friends': friends_data,
            'incoming_requests': incoming_data,
            'outgoing_requests': outgoing_data,
            'pending_count': len(incoming_data),
            'total': len(friends_data),
        })

    elif request.method == 'POST':
        query = request.data.get('username_or_email') or request.data.get('username') or request.data.get('email')
        if not query or not str(query).strip():
            return Response({'error': 'Debes ingresar un nombre de usuario o correo electrónico.'}, status=status.HTTP_400_BAD_REQUEST)

        target_user = _resolve_target_user(query)
        if not target_user:
            return Response({'error': f'No se encontró ningún usuario con "{str(query).strip()}".'}, status=status.HTTP_404_NOT_FOUND)

        payload, code = _create_or_accept_friend_request(user, target_user)
        return Response(payload, status=code)

    elif request.method == 'DELETE':
        target_id = friend_id or request.data.get('friend_id')
        if not target_id:
            return Response({'error': 'ID de amigo requerido'}, status=status.HTTP_400_BAD_REQUEST)

        def _delete_friendship():
            Friendship.objects.filter(user=user, friend_id=target_id).delete()
            Friendship.objects.filter(user_id=target_id, friend=user).delete()
            FriendRequest.objects.filter(
                Q(from_user=user, to_user_id=target_id) | Q(from_user_id=target_id, to_user=user)
            ).delete()

        run_with_db_retry(_delete_friendship)
        return Response({'message': 'Amigo eliminado correctamente'}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_friend_requests_view(request):
    """
    GET: Lista solicitudes de amistad entrantes y salientes pendientes.
    POST: Envía una nueva solicitud de amistad por username, email o user_id.
    """
    user = request.user
    if request.method == 'GET':
        incoming_qs = list(
            FriendRequest.objects.filter(to_user=user, status='pending')
            .select_related('from_user', 'from_user__profile')
            .order_by('-created_at')
        )
        outgoing_qs = list(
            FriendRequest.objects.filter(from_user=user, status='pending')
            .select_related('to_user', 'to_user__profile')
            .order_by('-created_at')
        )
        all_ids = list({*(r.from_user_id for r in incoming_qs), *(r.to_user_id for r in outgoing_qs)})
        anime_counts = _compute_anime_counts_map(all_ids)
        mutual_counts = _compute_mutual_friends_map(user, all_ids)
        return Response({
            'incoming_requests': [
                _serialize_social_user(
                    r.from_user,
                    anime_counts,
                    mutual_counts,
                    {'request_id': str(r.id), 'created_at': r.created_at.isoformat()},
                )
                for r in incoming_qs
            ],
            'outgoing_requests': [
                _serialize_social_user(
                    r.to_user,
                    anime_counts,
                    mutual_counts,
                    {'request_id': str(r.id), 'created_at': r.created_at.isoformat()},
                )
                for r in outgoing_qs
            ],
        })

    raw_uid = request.data.get('user_id')
    target_user = None
    if raw_uid is not None:
        try:
            target_user = User.objects.filter(id=int(raw_uid)).select_related('profile').first()
        except (ValueError, TypeError):
            target_user = None
    if not target_user:
        query = request.data.get('username_or_email') or request.data.get('username') or request.data.get('email')
        if not query or not str(query).strip():
            return Response({'error': 'Debes indicar el usuario al que deseas enviar la solicitud.'}, status=status.HTTP_400_BAD_REQUEST)
        target_user = _resolve_target_user(query)
        if not target_user:
            return Response({'error': f'No se encontró ningún usuario con "{str(query).strip()}".'}, status=status.HTTP_404_NOT_FOUND)

    payload, code = _create_or_accept_friend_request(user, target_user)
    return Response(payload, status=code)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_friend_request_view(request, request_id):
    """
    Acepta o rechaza una solicitud de amistad recibida (Zero Trust: solo el destinatario).
    Body: { "action": "accept" | "reject" }
    """
    user = request.user
    req_obj = get_object_or_404(
        FriendRequest.objects.select_related('from_user', 'from_user__profile'),
        id=request_id,
        to_user=user,
    )
    if req_obj.status != 'pending':
        return Response({'error': 'Esta solicitud ya fue procesada.'}, status=status.HTTP_400_BAD_REQUEST)

    action = str(request.data.get('action', '')).strip().lower()
    if action not in ('accept', 'reject'):
        return Response({'error': 'Acción inválida. Usa "accept" o "reject".'}, status=status.HTTP_400_BAD_REQUEST)

    sender = req_obj.from_user
    sender_prof = getattr(sender, 'profile', None)
    sender_name = (sender_prof and sender_prof.display_name) or sender.first_name or sender.username

    if action == 'accept':
        def _accept():
            req_obj.status = 'accepted'
            req_obj.save(update_fields=['status', 'updated_at'])
            Friendship.objects.get_or_create(user=user, friend=sender)
            Friendship.objects.get_or_create(user=sender, friend=user)
            FriendRequest.objects.filter(from_user=user, to_user=sender, status='pending').update(status='accepted')

        run_with_db_retry(_accept)

        me_prof = getattr(user, 'profile', None)
        _push_user_notification(sender, {
            'type': 'friend_accepted',
            'from_username': user.username,
            'from_display_name': (me_prof and me_prof.display_name) or user.first_name or user.username,
            'from_avatar': (me_prof and me_prof.avatar_url) or '',
            'message': 'aceptó tu solicitud de amistad en Animigos.',
        })

        anime_counts = _compute_anime_counts_map([sender.id])
        mutual_counts = _compute_mutual_friends_map(user, [sender.id])
        return Response({
            'message': f'¡Ahora eres amigo de {sender_name}!',
            'friendship_status': 'friends',
            'friend': _serialize_social_user(sender, anime_counts, mutual_counts),
        }, status=status.HTTP_200_OK)

    def _reject():
        req_obj.status = 'rejected'
        req_obj.save(update_fields=['status', 'updated_at'])

    run_with_db_retry(_reject)
    return Response({
        'message': f'Solicitud de {sender_name} rechazada.',
        'friendship_status': 'none',
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cancel_friend_request_view(request, request_id):
    """
    Permite cancelar una solicitud enviada (from_user) o descartar una recibida (to_user).
    """
    user = request.user
    req_obj = FriendRequest.objects.filter(
        Q(id=request_id) & (Q(from_user=user) | Q(to_user=user))
    ).first()
    if not req_obj:
        return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    run_with_db_retry(req_obj.delete)
    return Response({
        'message': 'Solicitud cancelada correctamente.',
        'friendship_status': 'none',
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def suggested_friends_view(request):
    """
    Retorna sugerencias de usuarios ordenadas por número de AMIGOS EN COMÚN (descendente),
    con desempate por actividad (animes en su lista).
    Soporta filtro opcional ?q= para el buscador del modal de Agregar Amigos.
    """
    user = request.user
    q = (request.query_params.get('q') or '').strip().lstrip('@')
    existing_friend_ids = set(Friendship.objects.filter(user=user).values_list('friend_id', flat=True))
    existing_friend_ids.add(user.id)

    qs = User.objects.filter(is_active=True).exclude(id__in=existing_friend_ids).select_related('profile')
    if q:
        qs = qs.filter(
            Q(username__icontains=q)
            | Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(profile__display_name__icontains=q)
        )

    candidates = list(qs[:120])
    candidate_ids = [c.id for c in candidates]
    mutual_counts = _compute_mutual_friends_map(user, candidate_ids)
    anime_counts = _compute_anime_counts_map(candidate_ids)

    # Mapear solicitudes pendientes existentes para reflejar estado exacto en UI
    sent_map = {
        r.to_user_id: str(r.id)
        for r in FriendRequest.objects.filter(from_user=user, to_user_id__in=candidate_ids, status='pending')
    }
    received_map = {
        r.from_user_id: str(r.id)
        for r in FriendRequest.objects.filter(to_user=user, from_user_id__in=candidate_ids, status='pending')
    }

    # Ordenar primero por mayor número de amigos en común, luego por animes en lista
    candidates.sort(
        key=lambda c: (
            -mutual_counts.get(c.id, 0),
            -anime_counts.get(c.id, 0),
            c.username.lower(),
        )
    )

    results = []
    for c in candidates[:20]:
        if c.id in sent_map:
            f_status = 'pending_sent'
            req_id = sent_map[c.id]
        elif c.id in received_map:
            f_status = 'pending_received'
            req_id = received_map[c.id]
        else:
            f_status = 'none'
            req_id = None

        results.append(
            _serialize_social_user(
                c,
                anime_counts,
                mutual_counts,
                {
                    'friendship_status': f_status,
                    'request_id': req_id,
                },
            )
        )
    return Response({'suggested': results})


# -------------------------------------------------------------
# SECCIÓN: PERFILES PÚBLICOS, RECOMENDACIONES DIRECTAS Y NOTIFICACIONES
# -------------------------------------------------------------

def _extract_user_privacy_dict(preferences_obj):
    ps = preferences_obj.privacy_settings if (preferences_obj and isinstance(preferences_obj.privacy_settings, dict)) else {}
    nested_priv = ps.get('privacy') if isinstance(ps.get('privacy'), dict) else {}
    return {
        'isListPublic': bool(nested_priv.get('isListPublic', ps.get('isListPublic', True))),
        'showStats': bool(nested_priv.get('showStats', ps.get('showStats', True))),
        'allowComments': str(nested_priv.get('allowComments', ps.get('allowComments', 'everyone'))),
        'allowRecommendations': bool(nested_priv.get('allowRecommendations', ps.get('allowRecommendations', True))),
        'participateInRanking': bool(nested_priv.get('participateInRanking', ps.get('participateInRanking', False))),
    }


def _can_user_comment_on_wall(target_user, privacy_dict: dict, actor_user) -> tuple[bool, str]:
    """
    Evalúa según la privacidad del dueño del muro ('everyone', 'friends', 'none')
    si `actor_user` tiene permiso para publicar comentarios o respuestas.
    """
    allow_mode = str(privacy_dict.get('allowComments', 'everyone')).strip().lower()
    if allow_mode == 'none':
        return False, 'Este usuario ha desactivado los comentarios en su muro.'

    if not actor_user or not actor_user.is_authenticated:
        return False, 'Debes iniciar sesión para publicar comentarios en un muro.'

    if actor_user.id == target_user.id:
        return True, ''

    if allow_mode == 'friends':
        if not Friendship.objects.filter(user=target_user, friend=actor_user).exists():
            return False, f'Solo los amigos de @{target_user.username} pueden comentar en su muro.'

    return True, ''


def _get_hydrated_wall_comments(preferences_obj, viewer_user=None) -> list[dict]:
    """
    Hidrata la lista de comentarios del muro con los nombres y avatares vigentes
    de sus autores en una sola consulta SQL, calculando likes e isLiked para `viewer_user`.
    """
    ps = preferences_obj.privacy_settings if (preferences_obj and isinstance(preferences_obj.privacy_settings, dict)) else {}
    raw_comments = ps.get('wall_comments')
    if not isinstance(raw_comments, list) or not raw_comments:
        return []

    usernames = set()
    for c in raw_comments:
        if isinstance(c, dict):
            uname = str(c.get('authorUsername') or '').strip()
            if uname:
                usernames.add(uname)
            for r in (c.get('replies') or []):
                if isinstance(r, dict):
                    runame = str(r.get('authorUsername') or '').strip()
                    if runame:
                        usernames.add(runame)

    users_map = {}
    if usernames:
        for u in User.objects.filter(username__in=usernames).select_related('profile'):
            prof = getattr(u, 'profile', None)
            users_map[u.username.lower()] = {
                'id': str(u.id),
                'name': (prof and prof.display_name) or u.first_name or u.username,
                'avatar': (prof and prof.avatar_url) or '',
            }

    viewer_id_str = str(viewer_user.id) if (viewer_user and viewer_user.is_authenticated) else None
    hydrated = []

    for c in raw_comments:
        if not isinstance(c, dict):
            continue
        c_uname = str(c.get('authorUsername') or '').strip()
        u_info = users_map.get(c_uname.lower(), {})
        liked_by = [str(x) for x in (c.get('liked_by') or []) if x is not None]
        raw_likes = c.get('likes', 0)
        likes_count = len(liked_by) if 'liked_by' in c else (int(raw_likes) if isinstance(raw_likes, int) else 0)

        hydrated_replies = []
        for r in (c.get('replies') or []):
            if not isinstance(r, dict):
                continue
            r_uname = str(r.get('authorUsername') or '').strip()
            ru_info = users_map.get(r_uname.lower(), {})
            hydrated_replies.append({
                'id': str(r.get('id') or ''),
                'authorId': str(r.get('authorId') or ru_info.get('id') or ''),
                'authorName': ru_info.get('name') or r.get('authorName') or r_uname or 'Usuario',
                'authorUsername': r_uname,
                'authorAvatar': ru_info.get('avatar') or r.get('authorAvatar') or '',
                'content': str(r.get('content') or ''),
                'createdAt': str(r.get('createdAt') or 'Reciente'),
            })

        hydrated.append({
            'id': str(c.get('id') or ''),
            'authorId': str(c.get('authorId') or u_info.get('id') or ''),
            'authorName': u_info.get('name') or c.get('authorName') or c_uname or 'Usuario',
            'authorUsername': c_uname,
            'authorAvatar': u_info.get('avatar') or c.get('authorAvatar') or '',
            'authorBadge': c.get('authorBadge') or 'Miembro Animigos 🍿',
            'content': str(c.get('content') or ''),
            'hasSpoiler': bool(c.get('hasSpoiler', False)),
            'createdAt': str(c.get('createdAt') or 'Reciente'),
            'likes': likes_count,
            'isLiked': bool(viewer_id_str and viewer_id_str in liked_by),
            'replies': hydrated_replies,
        })

    return hydrated


@api_view(['GET'])
@permission_classes([AllowAny])
def public_user_profile_view(request, username):
    """
    Retorna la vista de perfil público de otro usuario (modo visita / solo lectura),
    respetando estrictamente sus configuraciones de privacidad (isListPublic, showStats,
    allowComments, allowRecommendations).
    """
    clean_uname = str(username or '').strip().lstrip('@')
    target_user = User.objects.filter(username__iexact=clean_uname).first()
    if not target_user:
        return Response({'error': f'El usuario @{clean_uname} no existe.'}, status=status.HTTP_404_NOT_FOUND)

    profile, _ = Profile.objects.get_or_create(
        user=target_user,
        defaults={'display_name': target_user.first_name or target_user.username}
    )
    preferences, _ = UserPreferences.objects.get_or_create(profile=profile)
    ps = preferences.privacy_settings if isinstance(preferences.privacy_settings, dict) else {}
    privacy = _extract_user_privacy_dict(preferences)

    is_self = bool(request.user and request.user.is_authenticated and request.user.id == target_user.id)

    # Estado de amistad y amigos en común con el visitante autenticado
    friendship_status = 'none'
    friend_request_id = None
    mutual_friends_count = 0
    if request.user and request.user.is_authenticated and not is_self:
        if Friendship.objects.filter(user=request.user, friend=target_user).exists():
            friendship_status = 'friends'
        else:
            pending_req = FriendRequest.objects.filter(
                Q(from_user=request.user, to_user=target_user)
                | Q(from_user=target_user, to_user=request.user),
                status='pending',
            ).first()
            if pending_req:
                friend_request_id = str(pending_req.id)
                friendship_status = (
                    'pending_sent'
                    if pending_req.from_user_id == request.user.id
                    else 'pending_received'
                )
        mutual_friends_count = _compute_mutual_friends_map(
            request.user, [target_user.id]
        ).get(target_user.id, 0)

    # Amigos del usuario visitado (sin N+1 en conteo de animes)
    friendships = list(
        Friendship.objects.filter(user=target_user).select_related('friend', 'friend__profile')
    )
    friend_ids = [f.friend_id for f in friendships]
    anime_counts = _compute_anime_counts_map(friend_ids)
    mutual_for_friends = (
        _compute_mutual_friends_map(request.user, friend_ids)
        if (request.user and request.user.is_authenticated)
        else {}
    )
    friends_data = [
        _serialize_social_user(
            f.friend,
            anime_counts,
            mutual_for_friends,
            {'created_at': f.created_at.isoformat()},
        )
        for f in friendships
    ]

    entries_data = []
    folders_data = []
    tags_list = []

    if is_self or privacy['isListPublic'] or privacy['showStats']:
        entries_qs = (
            UserAnimeEntry.objects.filter(user=target_user)
            .select_related('anime', 'folder')
            .order_by('-updated_at')
        )
        entries_data = UserAnimeEntrySerializer(entries_qs, many=True).data
        if is_self or privacy['isListPublic']:
            folders_qs = UserAnimeFolder.objects.filter(user=target_user).prefetch_related('entries__anime')
            folders_data = UserAnimeFolderSerializer(folders_qs, many=True).data
            tag_counts = {}
            for entry in entries_qs:
                for tag in (entry.tags or []):
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
            tags_list = [{'tag': k, 'count': v} for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])]

    taste_analytics = None
    if is_self or privacy['showStats']:
        try:
            from animes.recommender import build_taste_analytics_matrix
            liked_ids = list(ps.get('liked_anime_ids', [])) if isinstance(ps.get('liked_anime_ids'), list) else []
            fav_ids = list(
                UserAnimeEntry.objects.filter(user=target_user, status='visto')
                .values_list('anime__mal_id', flat=True)[:25]
            )
            raw_combined = list(dict.fromkeys([int(x) for x in (liked_ids + fav_ids) if x]))
            pending_or_dropped = set(
                UserAnimeEntry.objects.filter(user=target_user, status__in=['pendiente', 'dropeado', 'esperando'])
                .values_list('anime__mal_id', flat=True)
            )
            combined_ids = [aid for aid in raw_combined if aid not in pending_or_dropped]
            taste_payload = {
                'tmdb_movies': ps.get('tmdb_movies', []) if isinstance(ps.get('tmdb_movies'), list) else [],
                'liked_anime_ids': combined_ids,
                'tropes': ps.get('tropes', []) if isinstance(ps.get('tropes'), list) else [],
            }
            taste_analytics = build_taste_analytics_matrix(taste_payload)
        except Exception:
            taste_analytics = None

    can_comment, _ = _can_user_comment_on_wall(target_user, privacy, request.user)

    from .ranking_views import compute_single_user_watch_hours
    total_watch_hours = compute_single_user_watch_hours(target_user.id) if (is_self or privacy['showStats']) else 0

    return Response({
        'user': ProfileSerializer(profile, context={'request': request}).data,
        'privacy': privacy,
        'socials': ps.get('socials', {}) if isinstance(ps.get('socials'), dict) else {},
        'flag_url': ps.get('flag_url', None),
        'lateral_config': ps.get('lateral_config', None),
        'friends': friends_data,
        'friendship_status': friendship_status,
        'friend_request_id': friend_request_id,
        'mutual_friends_count': mutual_friends_count,
        'comments': _get_hydrated_wall_comments(preferences, request.user),
        'can_comment': can_comment,
        'entries': entries_data if (is_self or privacy['isListPublic'] or privacy['showStats']) else [],
        'folders': folders_data if (is_self or privacy['isListPublic']) else [],
        'tags': tags_list if (is_self or privacy['isListPublic']) else [],
        'taste_analytics': taste_analytics,
        'total_watch_hours': total_watch_hours,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def recommend_anime_to_user_view(request, username):
    """
    Envía una recomendación directa de anime a otro usuario si su privacidad
    (allowRecommendations) lo permite, generando una notificación accionable.
    """
    import uuid
    from django.utils import timezone

    clean_uname = str(username or '').strip().lstrip('@')
    target_user = User.objects.filter(username__iexact=clean_uname).first()
    if not target_user:
        return Response({'error': f'El usuario @{clean_uname} no existe.'}, status=status.HTTP_404_NOT_FOUND)

    target_profile, _ = Profile.objects.get_or_create(
        user=target_user,
        defaults={'display_name': target_user.first_name or target_user.username}
    )
    target_prefs, _ = UserPreferences.objects.get_or_create(profile=target_profile)
    privacy = _extract_user_privacy_dict(target_prefs)

    if not privacy.get('allowRecommendations', True) and target_user.id != request.user.id:
        return Response(
            {'error': 'Este usuario ha desactivado la recepción de recomendaciones directas en su privacidad.'},
            status=status.HTTP_403_FORBIDDEN
        )

    anime_id = request.data.get('anime_id') or request.data.get('mal_id')
    if not anime_id:
        return Response({'error': 'Debes seleccionar un anime para recomendar.'}, status=status.HTTP_400_BAD_REQUEST)

    anime = Anime.objects.filter(mal_id=anime_id).first()
    if not anime:
        return Response({'error': 'No se encontró el anime seleccionado.'}, status=status.HTTP_404_NOT_FOUND)

    message = str(request.data.get('message') or '').strip()[:280]
    sender_prof = getattr(request.user, 'profile', None)
    sender_display = (sender_prof and sender_prof.display_name) or request.user.first_name or request.user.username
    sender_avatar = (sender_prof and sender_prof.avatar_url) or ''

    ps = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
    notifs = list(ps.get('notifications', [])) if isinstance(ps.get('notifications'), list) else []

    notif_item = {
        'id': str(uuid.uuid4()),
        'type': 'anime_recommendation',
        'from_username': request.user.username,
        'from_display_name': sender_display,
        'from_avatar': sender_avatar,
        'anime_id': anime.mal_id,
        'anime_title': anime.title,
        'anime_poster': anime.image_url or '',
        'message': message or f'¡Te recomiendo ver {anime.title}! Seguro encaja con tus gustos.',
        'created_at': timezone.now().isoformat(),
        'read': False,
    }
    notifs.insert(0, notif_item)
    ps['notifications'] = notifs[:40]
    target_prefs.privacy_settings = ps
    target_prefs.save(update_fields=['privacy_settings'])

    return Response({
        'success': True,
        'message': f'¡Recomendación de "{anime.title}" enviada a {target_profile.display_name or target_user.username}!',
        'notification': notif_item,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([AllowAny])
def user_notifications_view(request):
    """
    GET: Retorna la bandeja de notificaciones accionables del usuario autenticado.
    Si el usuario es anónimo o su sesión expiró, devuelve lista vacía con 200 OK.
    PATCH: Marca una notificación como leída, la descarta, o marca todas como leídas.
    """
    if not request.user.is_authenticated:
        if request.method == 'PATCH':
            return Response({'error': 'No autenticado'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({'notifications': [], 'unread_count': 0}, status=status.HTTP_200_OK)

    import uuid
    from django.utils import timezone

    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={'display_name': request.user.first_name or request.user.username}
    )
    prefs, _ = UserPreferences.objects.get_or_create(profile=profile)
    verificar_estrenos_usuario(request.user)
    prefs.refresh_from_db()
    ps = dict(prefs.privacy_settings) if isinstance(prefs.privacy_settings, dict) else {}

    if 'notifications' not in ps or not isinstance(ps.get('notifications'), list):
        # Inicializamos con una notificación de ejemplo accionable si es la primera vez
        sample_anime = Anime.objects.filter(score__isnull=False).order_by(F('score').desc(nulls_last=True)).first()
        sample_friend = (
            User.objects.exclude(id=request.user.id).select_related('profile').first()
        )
        initial_notifs = []
        if sample_anime:
            from_uname = sample_friend.username if sample_friend else 'profesor_doki'
            from_dname = (
                (sample_friend.profile.display_name if (sample_friend and hasattr(sample_friend, 'profile') and sample_friend.profile.display_name) else None)
                or (sample_friend.username if sample_friend else 'Profesor Doki Doki')
            )
            from_av = (
                sample_friend.profile.avatar_url
                if (sample_friend and hasattr(sample_friend, 'profile') and sample_friend.profile.avatar_url)
                else ''
            )
            initial_notifs.append({
                'id': str(uuid.uuid4()),
                'type': 'anime_recommendation',
                'from_username': from_uname,
                'from_display_name': from_dname,
                'from_avatar': from_av,
                'anime_id': sample_anime.mal_id,
                'anime_title': sample_anime.title,
                'anime_poster': sample_anime.image_url or '',
                'message': f'¡Te recomendó ver "{sample_anime.title}"! Agrégalo a tu lista si te llama la atención.',
                'created_at': timezone.now().isoformat(),
                'read': False,
            })
        ps['notifications'] = initial_notifs
        prefs.privacy_settings = ps
        prefs.save(update_fields=['privacy_settings'])

    notifs = list(ps.get('notifications', []))

    if request.method == 'GET':
        unread_count = sum(1 for n in notifs if not n.get('read'))
        return Response({
            'notifications': notifs,
            'unread_count': unread_count,
        })

    elif request.method == 'PATCH':
        action = request.data.get('action', 'mark_read')
        notif_id = request.data.get('notification_id')

        if action == 'mark_all_read':
            for n in notifs:
                n['read'] = True
        elif action == 'dismiss' and notif_id:
            notifs = [n for n in notifs if n.get('id') != notif_id]
        elif action == 'mark_read' and notif_id:
            for n in notifs:
                if n.get('id') == notif_id:
                    n['read'] = True

        ps['notifications'] = notifs
        prefs.privacy_settings = ps
        prefs.save(update_fields=['privacy_settings'])
        unread_count = sum(1 for n in notifs if not n.get('read'))
        return Response({
            'notifications': notifs,
            'unread_count': unread_count,
        })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def profile_wall_comments_view(request, username):
    """
    GET: Retorna los comentarios del muro de `@username` junto con su configuración `allowComments` y `can_comment`.
    POST: Publica un nuevo comentario en el muro de `@username`, validando estrictamente la privacidad
          ('everyone', 'friends', 'none') en el servidor (Zero Trust).
    """
    import uuid

    clean_uname = str(username or '').strip().lstrip('@')
    target_user = User.objects.filter(username__iexact=clean_uname).select_related('profile').first()
    if not target_user:
        return Response({'error': f'El usuario @{clean_uname} no existe.'}, status=status.HTTP_404_NOT_FOUND)

    target_profile, _ = Profile.objects.get_or_create(
        user=target_user,
        defaults={'display_name': target_user.first_name or target_user.username},
    )
    target_prefs, _ = UserPreferences.objects.get_or_create(profile=target_profile)
    privacy = _extract_user_privacy_dict(target_prefs)
    can_comment, deny_reason = _can_user_comment_on_wall(target_user, privacy, request.user)

    if request.method == 'GET':
        return Response({
            'comments': _get_hydrated_wall_comments(target_prefs, request.user),
            'allow_comments': privacy['allowComments'],
            'can_comment': can_comment,
        })

    if not request.user or not request.user.is_authenticated:
        return Response(
            {'error': 'Debes iniciar sesión para comentar en este muro.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not can_comment:
        return Response(
            {'error': deny_reason or 'No tienes permiso para comentar en este muro.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    content = str(request.data.get('content') or '').strip()[:500]
    if not content:
        return Response({'error': 'El comentario no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)

    has_spoiler = bool(request.data.get('hasSpoiler') or ('[spoiler]' in content.lower()))
    actor_prof = getattr(request.user, 'profile', None)
    actor_name = (actor_prof and actor_prof.display_name) or request.user.first_name or request.user.username
    actor_avatar = (actor_prof and actor_prof.avatar_url) or ''
    now_str = timezone.now().strftime('%d/%m/%Y %H:%M')

    new_comment = {
        'id': f"c_{uuid.uuid4().hex[:12]}",
        'authorId': str(request.user.id),
        'authorName': actor_name,
        'authorUsername': request.user.username,
        'authorAvatar': actor_avatar,
        'authorBadge': 'Otaku Veterano 🍿',
        'content': content,
        'hasSpoiler': has_spoiler,
        'createdAt': now_str,
        'liked_by': [],
        'likes': 0,
        'replies': [],
    }

    def _save_comment():
        target_prefs.refresh_from_db()
        ps = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
        existing = list(ps.get('wall_comments', [])) if isinstance(ps.get('wall_comments'), list) else []
        existing.insert(0, new_comment)
        ps['wall_comments'] = existing[:100]
        target_prefs.privacy_settings = ps
        target_prefs.save(update_fields=['privacy_settings'])

    run_with_db_retry(_save_comment)

    if target_user.id != request.user.id:
        _push_user_notification(
            target_user,
            {
                'type': 'profile_comment',
                'comment_id': new_comment['id'],
                'from_username': request.user.username,
                'from_display_name': actor_name,
                'from_avatar': actor_avatar,
                'message': f'dejó un comentario en tu muro: "{content[:90]}"',
            },
        )

    return Response(
        {
            'comments': _get_hydrated_wall_comments(target_prefs, request.user),
            'allow_comments': privacy['allowComments'],
            'can_comment': True,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_wall_comment_detail_view(request, username, comment_id):
    """
    POST:
      - action='like': Alterna el like del usuario autenticado sobre el comentario.
      - action='reply': Publica una respuesta anidada (respetando la privacidad `allowComments` del dueño del muro).
    DELETE:
      - Elimina el comentario si quien lo solicita es el autor del comentario, el dueño del muro o un administrador.
    """
    import uuid

    clean_uname = str(username or '').strip().lstrip('@')
    target_user = User.objects.filter(username__iexact=clean_uname).select_related('profile').first()
    if not target_user:
        return Response({'error': f'El usuario @{clean_uname} no existe.'}, status=status.HTTP_404_NOT_FOUND)

    target_profile, _ = Profile.objects.get_or_create(
        user=target_user,
        defaults={'display_name': target_user.first_name or target_user.username},
    )
    target_prefs, _ = UserPreferences.objects.get_or_create(profile=target_profile)
    privacy = _extract_user_privacy_dict(target_prefs)
    cid = str(comment_id or '').strip()

    if request.method == 'DELETE':
        ps = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
        existing = list(ps.get('wall_comments', [])) if isinstance(ps.get('wall_comments'), list) else []
        target_comment = next((c for c in existing if isinstance(c, dict) and str(c.get('id')) == cid), None)
        if not target_comment:
            return Response({'error': 'Comentario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        is_comment_author = (
            str(target_comment.get('authorId')) == str(request.user.id)
            or str(target_comment.get('authorUsername', '')).lower() == request.user.username.lower()
        )
        is_wall_owner = target_user.id == request.user.id
        if not (is_comment_author or is_wall_owner or request.user.is_staff):
            return Response(
                {'error': 'No tienes permiso para eliminar este comentario.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        def _delete_comment():
            target_prefs.refresh_from_db()
            ps_inner = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
            curr = list(ps_inner.get('wall_comments', [])) if isinstance(ps_inner.get('wall_comments'), list) else []
            ps_inner['wall_comments'] = [c for c in curr if not (isinstance(c, dict) and str(c.get('id')) == cid)]
            # Si existía una notificación pendiente asociada a este comentario eliminado, limpiarla también
            notifs = list(ps_inner.get('notifications', [])) if isinstance(ps_inner.get('notifications'), list) else []
            if notifs:
                ps_inner['notifications'] = [
                    n for n in notifs
                    if not (
                        isinstance(n, dict)
                        and n.get('type') == 'profile_comment'
                        and (
                            str(n.get('comment_id') or '') == cid
                            or (
                                not n.get('comment_id')
                                and str(n.get('from_username') or '').lower()
                                == str(target_comment.get('authorUsername') or '').lower()
                                and str(target_comment.get('content') or '')[:40]
                                in str(n.get('message') or '')
                            )
                        )
                    )
                ]
            target_prefs.privacy_settings = ps_inner
            target_prefs.save(update_fields=['privacy_settings'])

        run_with_db_retry(_delete_comment)
        return Response({'comments': _get_hydrated_wall_comments(target_prefs, request.user)})

    action_type = str(request.data.get('action') or 'like').strip().lower()

    if action_type == 'like':
        uid_str = str(request.user.id)

        def _toggle_like():
            target_prefs.refresh_from_db()
            ps_inner = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
            curr = list(ps_inner.get('wall_comments', [])) if isinstance(ps_inner.get('wall_comments'), list) else []
            for c in curr:
                if isinstance(c, dict) and str(c.get('id')) == cid:
                    liked_by = [str(x) for x in (c.get('liked_by') or []) if x is not None]
                    if uid_str in liked_by:
                        liked_by = [x for x in liked_by if x != uid_str]
                    else:
                        liked_by.append(uid_str)
                    c['liked_by'] = liked_by
                    c['likes'] = len(liked_by)
                    break
            ps_inner['wall_comments'] = curr
            target_prefs.privacy_settings = ps_inner
            target_prefs.save(update_fields=['privacy_settings'])

        run_with_db_retry(_toggle_like)
        return Response({'comments': _get_hydrated_wall_comments(target_prefs, request.user)})

    if action_type == 'reply':
        can_comment, deny_reason = _can_user_comment_on_wall(target_user, privacy, request.user)
        if not can_comment:
            return Response(
                {'error': deny_reason or 'No tienes permiso para responder en este muro.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        reply_content = str(request.data.get('content') or '').strip()[:400]
        if not reply_content:
            return Response({'error': 'La respuesta no puede estar vacía.'}, status=status.HTTP_400_BAD_REQUEST)

        actor_prof = getattr(request.user, 'profile', None)
        actor_name = (actor_prof and actor_prof.display_name) or request.user.first_name or request.user.username
        actor_avatar = (actor_prof and actor_prof.avatar_url) or ''
        now_str = timezone.now().strftime('%d/%m/%Y %H:%M')

        new_reply = {
            'id': f"r_{uuid.uuid4().hex[:12]}",
            'authorId': str(request.user.id),
            'authorName': actor_name,
            'authorUsername': request.user.username,
            'authorAvatar': actor_avatar,
            'content': reply_content,
            'createdAt': now_str,
        }

        def _save_reply():
            target_prefs.refresh_from_db()
            ps_inner = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
            curr = list(ps_inner.get('wall_comments', [])) if isinstance(ps_inner.get('wall_comments'), list) else []
            for c in curr:
                if isinstance(c, dict) and str(c.get('id')) == cid:
                    replies = list(c.get('replies') or [])
                    replies.append(new_reply)
                    c['replies'] = replies[:50]
                    break
            ps_inner['wall_comments'] = curr
            target_prefs.privacy_settings = ps_inner
            target_prefs.save(update_fields=['privacy_settings'])

        run_with_db_retry(_save_reply)
        return Response({'comments': _get_hydrated_wall_comments(target_prefs, request.user)}, status=status.HTTP_201_CREATED)

    return Response({'error': 'Acción no soportada.'}, status=status.HTTP_400_BAD_REQUEST)




