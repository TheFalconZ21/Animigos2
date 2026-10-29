from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
import xml.etree.ElementTree as ET
import time
import urllib.request
import json
from pathlib import Path
from django.conf import settings
from animes.models import Anime
from .models import Profile, UserPreferences, UserAnimeFolder, UserAnimeEntry, Friendship
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
        return Response({
            'message': 'Usuario registrado exitosamente',
            'authenticated': True,
            'session_id': request.session.session_key,
            'user': ProfileSerializer(profile).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """
    Inicia sesión con credenciales de usuario (soporta username o correo electrónico).
    Establece la sesión segura y retorna el perfil asociado.
    """
    username_or_email = request.data.get('username') or request.data.get('email')
    password = request.data.get('password')

    if not username_or_email or not password:
        return Response({'error': 'Usuario o correo y contraseña requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    # Resolución dual insensible a mayúsculas y espacios: si se ingresó un correo o usuario
    target_username = username_or_email.strip()
    if '@' in username_or_email:
        user_by_email = User.objects.filter(email__iexact=target_username).first()
        if user_by_email:
            target_username = user_by_email.username
    else:
        user_by_uname = User.objects.filter(username__iexact=target_username).first()
        if user_by_uname:
            target_username = user_by_uname.username

    user = authenticate(request, username=target_username, password=password)
    if user is not None:
        login(request, user)
        request.session.save()
        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={'display_name': user.first_name or user.username}
        )
        return Response({
            'message': 'Sesión iniciada correctamente',
            'authenticated': True,
            'session_id': request.session.session_key,
            'user': ProfileSerializer(profile).data
        }, status=status.HTTP_200_OK)

    return Response({'error': 'Credenciales inválidas. Verifica tu usuario y contraseña.'}, status=status.HTTP_401_UNAUTHORIZED)


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
            'user': ProfileSerializer(profile).data
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

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_my_list_view(request):
    """
    GET: Lista completa de animes del usuario autenticado con carpetas, tags y estadísticas.
    POST: Agrega un nuevo anime a la lista personal del usuario autenticado.
    Zero Trust: Estrictamente aislado por cuenta de usuario.
    """
    user = request.user

    if request.method == 'GET':
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
                'average_score': avg_score,
                'percent_completed': round((visto_count / total_count * 100)) if total_count > 0 else 0
            }
        })

    elif request.method == 'POST':
        mal_id = request.data.get('mal_id') or request.data.get('anime_id')
        if not mal_id:
            return Response({'error': 'mal_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        anime = Anime.objects.filter(mal_id=mal_id).first()
        if not anime:
            return Response({'error': f'Anime con mal_id {mal_id} no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        status_val = request.data.get('status', 'pendiente')
        score_val = request.data.get('score')
        episodes_val = request.data.get('episodes_watched', 0)
        is_fav = bool(request.data.get('is_favorite', False))
        folder_id = request.data.get('folder_id')
        tags_val = request.data.get('tags', [])
        notes_val = request.data.get('notes', '')

        folder = None
        if folder_id:
            folder = UserAnimeFolder.objects.filter(id=folder_id, user=user).first()

        entry, created = UserAnimeEntry.objects.update_or_create(
            user=user,
            anime=anime,
            defaults={
                'status': status_val,
                'score': score_val if score_val else None,
                'episodes_watched': episodes_val,
                'is_favorite': is_fav,
                'folder': folder,
                'tags': tags_val if isinstance(tags_val, list) else [],
                'notes': notes_val
            }
        )

        return Response(UserAnimeEntrySerializer(entry).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_my_list_entry_detail_view(request, entry_id):
    """
    PATCH: Actualiza nota, estado, episodios, favorito, carpeta, tags o notas de un anime del usuario.
    DELETE: Elimina el anime de la lista del usuario.
    """
    user = request.user
    entry = get_object_or_404(UserAnimeEntry.objects.select_related('anime', 'folder'), id=entry_id, user=user)

    if request.method == 'DELETE':
        entry.delete()
        return Response({'message': 'Anime eliminado de tu lista correctamente'})

    elif request.method == 'PATCH':
        if 'status' in request.data:
            entry.status = request.data['status']
        if 'score' in request.data:
            val = request.data['score']
            entry.score = val if val else None
        if 'episodes_watched' in request.data:
            entry.episodes_watched = max(0, int(request.data['episodes_watched']))
        if 'is_favorite' in request.data:
            entry.is_favorite = bool(request.data['is_favorite'])
        if 'notes' in request.data:
            entry.notes = request.data['notes']
        if 'tags' in request.data:
            entry.tags = request.data['tags'] if isinstance(request.data['tags'], list) else []
        if 'folder_id' in request.data:
            fid = request.data['folder_id']
            entry.folder = UserAnimeFolder.objects.filter(id=fid, user=user).first() if fid else None

        entry.save()
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
    Retorna el catálogo completo de 835 avatares optimizados en WebP,
    agrupados por series de anime (74 categorías).
    Permite filtrado opcional por 'search' o 'category'.
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

    if not search_query and not category_slug:
        return Response({
            'total_categories': len(_CACHED_PRESET_AVATARS),
            'total_avatars': sum(c.get('count', 0) for c in _CACHED_PRESET_AVATARS),
            'categories': _CACHED_PRESET_AVATARS
        })

    filtered_categories = []
    for cat in _CACHED_PRESET_AVATARS:
        if category_slug and cat.get('slug') != category_slug:
            continue

        matched_avatars = []
        cat_name_matches = search_query and search_query in cat.get('name', '').lower()

        for av in cat.get('avatars', []):
            if not search_query or cat_name_matches or search_query in av.get('name', '').lower():
                matched_avatars.append(av)

        if matched_avatars:
            filtered_categories.append({
                'slug': cat.get('slug'),
                'name': cat.get('name'),
                'count': len(matched_avatars),
                'avatars': matched_avatars
            })

    return Response({
        'total_categories': len(filtered_categories),
        'total_avatars': sum(c.get('count', 0) for c in filtered_categories),
        'categories': filtered_categories
    })


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_friends_view(request, friend_id=None):
    """
    Gestiona la lista de amigos del usuario autenticado:
    - GET: Obtiene la lista completa de amigos con su avatar, nombre y estadísticas.
    - POST: Agrega un nuevo amigo mediante su username o correo electrónico.
    - DELETE: Elimina a un amigo por su ID de usuario.
    """
    user = request.user

    if request.method == 'GET':
        friendships = Friendship.objects.filter(user=user).select_related('friend', 'friend__profile')
        friends_data = []
        for f in friendships:
            fr = f.friend
            prof = getattr(fr, 'profile', None)
            anime_count = UserAnimeEntry.objects.filter(user=fr).count()
            friends_data.append({
                'id': fr.id,
                'username': fr.username,
                'display_name': (prof and prof.display_name) or fr.first_name or fr.username,
                'avatar_url': (prof and prof.avatar_url) or '',
                'bio': (prof and prof.bio) or '',
                'anime_count': anime_count,
                'created_at': f.created_at.isoformat(),
            })
        return Response({'friends': friends_data, 'total': len(friends_data)})

    elif request.method == 'POST':
        query = request.data.get('username_or_email') or request.data.get('username') or request.data.get('email')
        if not query or not str(query).strip():
            return Response({'error': 'Debes ingresar un nombre de usuario o correo electrónico.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_query = str(query).strip()
        if '@' in clean_query and not clean_query.startswith('@'):
            target_user = User.objects.filter(email__iexact=clean_query).first()
        else:
            clean_uname = clean_query.lstrip('@')
            target_user = (
                User.objects.filter(username__iexact=clean_uname).first()
                or User.objects.filter(profile__display_name__iexact=clean_uname).first()
            )

        if not target_user:
            return Response({'error': f'No se encontró ningún usuario con "{clean_query}".'}, status=status.HTTP_404_NOT_FOUND)

        if target_user.id == user.id:
            return Response({'error': 'No puedes agregarte a ti mismo como amigo.'}, status=status.HTTP_400_BAD_REQUEST)

        # Crear amistad bidireccional
        _, created_self = Friendship.objects.get_or_create(user=user, friend=target_user)
        Friendship.objects.get_or_create(user=target_user, friend=user)

        prof = getattr(target_user, 'profile', None)
        sender_prof = getattr(user, 'profile', None)

        if created_self:
            try:
                import uuid
                from django.utils import timezone
                target_prof_obj, _ = Profile.objects.get_or_create(
                    user=target_user,
                    defaults={'display_name': target_user.first_name or target_user.username}
                )
                target_prefs, _ = UserPreferences.objects.get_or_create(profile=target_prof_obj)
                ps = dict(target_prefs.privacy_settings) if isinstance(target_prefs.privacy_settings, dict) else {}
                notifs = list(ps.get('notifications', [])) if isinstance(ps.get('notifications'), list) else []
                notifs.insert(0, {
                    'id': str(uuid.uuid4()),
                    'type': 'friend_added',
                    'from_username': user.username,
                    'from_display_name': (sender_prof and sender_prof.display_name) or user.first_name or user.username,
                    'from_avatar': (sender_prof and sender_prof.avatar_url) or '',
                    'message': 'te agregó a su lista de amigos en Animigos.',
                    'created_at': timezone.now().isoformat(),
                    'read': False,
                })
                ps['notifications'] = notifs[:40]
                target_prefs.privacy_settings = ps
                target_prefs.save(update_fields=['privacy_settings'])
            except Exception:
                pass

        return Response({
            'message': f'¡Ahora eres amigo de {prof.display_name if prof else target_user.username}!',
            'friend': {
                'id': target_user.id,
                'username': target_user.username,
                'display_name': (prof and prof.display_name) or target_user.first_name or target_user.username,
                'avatar_url': (prof and prof.avatar_url) or '',
                'bio': (prof and prof.bio) or '',
                'anime_count': UserAnimeEntry.objects.filter(user=target_user).count(),
            }
        }, status=status.HTTP_201_CREATED)

    elif request.method == 'DELETE':
        target_id = friend_id or request.data.get('friend_id')
        if not target_id:
            return Response({'error': 'ID de amigo requerido'}, status=status.HTTP_400_BAD_REQUEST)

        Friendship.objects.filter(user=user, friend_id=target_id).delete()
        Friendship.objects.filter(user_id=target_id, friend=user).delete()
        return Response({'message': 'Amigo eliminado correctamente'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def suggested_friends_view(request):
    """
    Retorna usuarios registrados en la comunidad que aún no son amigos del usuario autenticado.
    Soporta filtro opcional ?q= para el buscador propio del modal de Agregar Amigos.
    """
    user = request.user
    q = (request.query_params.get('q') or '').strip().lstrip('@')
    existing_friend_ids = set(Friendship.objects.filter(user=user).values_list('friend_id', flat=True))
    existing_friend_ids.add(user.id)

    qs = User.objects.exclude(id__in=existing_friend_ids).select_related('profile')
    if q:
        from django.db.models import Q
        qs = qs.filter(
            Q(username__icontains=q)
            | Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(profile__display_name__icontains=q)
        )

    candidates = qs[:16]
    results = []
    for c in candidates:
        prof = getattr(c, 'profile', None)
        results.append({
            'id': c.id,
            'username': c.username,
            'display_name': (prof and prof.display_name) or c.first_name or c.username,
            'avatar_url': (prof and prof.avatar_url) or '',
            'bio': (prof and prof.bio) or '',
            'anime_count': UserAnimeEntry.objects.filter(user=c).count(),
        })
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
    }


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

    # Amigos del usuario visitado
    friendships = Friendship.objects.filter(user=target_user).select_related('friend', 'friend__profile')
    friends_data = []
    for f in friendships:
        fr = f.friend
        f_prof = getattr(fr, 'profile', None)
        friends_data.append({
            'id': fr.id,
            'username': fr.username,
            'display_name': (f_prof and f_prof.display_name) or fr.first_name or fr.username,
            'avatar_url': (f_prof and f_prof.avatar_url) or '',
            'bio': (f_prof and f_prof.bio) or '',
            'anime_count': UserAnimeEntry.objects.filter(user=fr).count(),
            'created_at': f.created_at.isoformat(),
        })

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
                UserAnimeEntry.objects.filter(user=target_user, status__in=['pendiente', 'dropeado'])
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

    return Response({
        'user': ProfileSerializer(profile).data,
        'privacy': privacy,
        'socials': ps.get('socials', {}) if isinstance(ps.get('socials'), dict) else {},
        'flag_url': ps.get('flag_url', None),
        'lateral_config': ps.get('lateral_config', None),
        'friends': friends_data,
        'entries': entries_data if (is_self or privacy['isListPublic'] or privacy['showStats']) else [],
        'folders': folders_data if (is_self or privacy['isListPublic']) else [],
        'tags': tags_list if (is_self or privacy['isListPublic']) else [],
        'taste_analytics': taste_analytics,
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

    anime = Anime.objects.filter(mal_id=anime_id).first() or Anime.objects.filter(id=anime_id).first()
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
@permission_classes([IsAuthenticated])
def user_notifications_view(request):
    """
    GET: Retorna la bandeja de notificaciones accionables del usuario autenticado.
    PATCH: Marca una notificación como leída, la descarta, o marca todas como leídas.
    """
    import uuid
    from django.utils import timezone

    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={'display_name': request.user.first_name or request.user.username}
    )
    prefs, _ = UserPreferences.objects.get_or_create(profile=profile)
    ps = dict(prefs.privacy_settings) if isinstance(prefs.privacy_settings, dict) else {}

    if 'notifications' not in ps or not isinstance(ps.get('notifications'), list):
        # Inicializamos con una notificación de ejemplo accionable si es la primera vez
        sample_anime = Anime.objects.order_by('-score').first()
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




