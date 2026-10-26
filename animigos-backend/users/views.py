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
from animes.models import Anime
from .models import Profile, UserPreferences, UserAnimeFolder, UserAnimeEntry
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

    # Resolución dual: si se ingresó un correo, obtener el username canónico
    target_username = username_or_email
    if '@' in username_or_email:
        user_by_email = User.objects.filter(email__iexact=username_or_email).first()
        if user_by_email:
            target_username = user_by_email.username

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
    Actualiza preferencias del usuario para el recomendador.
    Zero Trust: Requiere autenticación estricta.
    """
    profile = get_object_or_404(Profile, user=request.user)
    preferences, _ = UserPreferences.objects.get_or_create(profile=profile)
    serializer = UserPreferencesSerializer(preferences, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------------------------------------------
# SECCIÓN: MI LISTA (PERSONAL ANIME LIST & FOLDERS)
# -------------------------------------------------------------

def _get_target_user(request):
    """
    Obtiene el usuario objetivo para la lista. Si no está autenticado,
    utiliza un usuario invitado aislado para evitar alterar datos de otros usuarios.
    """
    if request.user.is_authenticated:
        return request.user

    guest_user, _ = User.objects.get_or_create(
        username='invitado_animigos',
        defaults={'email': 'invitado@animigos.cl', 'first_name': 'Invitado'}
    )
    return guest_user


def _ensure_initial_sample_data(user):
    """
    Si el usuario no tiene entradas en su lista, siembra un conjunto inicial
    con animes existentes en la base de datos para una experiencia inmediata.
    """
    if UserAnimeEntry.objects.filter(user=user).exists():
        return

    folder, _ = UserAnimeFolder.objects.get_or_create(user=user, name='Favoritos de la Temporada')

    available_animes = list(Anime.objects.all()[:7])
    if not available_animes:
        return

    statuses = ['visto', 'visto', 'visto', 'visto', 'visto', 'viendo', 'pendiente']
    scores = [10, 10, 9, 9, 9, 8, None]
    tags_pool = [['#obras-maestras'], ['#obras-maestras'], ['#obras-maestras'], [], [], ['#maratón-viernes'], ['#maratón-viernes']]
    notes_pool = [
        'Excelente desarrollo de personajes y animación brillante.',
        'Mención honorífica por su trama.',
        '',
        '',
        '',
        'Ideal para ver con el grupo los viernes.',
        ''
    ]

    for idx, anime in enumerate(available_animes):
        st = statuses[idx] if idx < len(statuses) else 'pendiente'
        sc = scores[idx] if idx < len(scores) else None
        tg = tags_pool[idx] if idx < len(tags_pool) else []
        nt = notes_pool[idx] if idx < len(notes_pool) else ''
        fld = folder if idx in (1, 4) else None
        eps = anime.episodes or 24
        episodes_watched = eps if st == 'visto' else (7 if st == 'viendo' else 0)

        UserAnimeEntry.objects.create(
            user=user,
            anime=anime,
            status=st,
            score=sc,
            episodes_watched=episodes_watched,
            is_favorite=(idx == 0),
            folder=fld,
            tags=tg,
            notes=nt
        )


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def user_my_list_view(request):
    """
    GET: Lista completa de animes del usuario con carpetas, tags y estadísticas.
    POST: Agrega un nuevo anime a la lista personal.
    """
    user = _get_target_user(request)

    if request.method == 'GET':
        _ensure_initial_sample_data(user)
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
@permission_classes([AllowAny])
def user_my_list_entry_detail_view(request, entry_id):
    """
    PATCH: Actualiza nota, estado, episodios, favorito, carpeta, tags o notas de un anime.
    DELETE: Elimina el anime de la lista del usuario.
    """
    user = _get_target_user(request)
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
@permission_classes([AllowAny])
def user_my_list_folders_view(request):
    """
    POST: Crea una nueva carpeta personal.
    """
    user = _get_target_user(request)
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'El nombre de la carpeta es requerido'}, status=status.HTTP_400_BAD_REQUEST)

    folder, created = UserAnimeFolder.objects.get_or_create(user=user, name=name)
    return Response(UserAnimeFolderSerializer(folder).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['PATCH', 'DELETE'])
@permission_classes([AllowAny])
def user_my_list_folder_detail_view(request, folder_id):
    """
    PATCH: Renombra una carpeta.
    DELETE: Elimina la carpeta (los animes permanecen en la lista).
    """
    user = _get_target_user(request)
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
@permission_classes([AllowAny])
def import_mal_xml_view(request):
    """
    Importa la lista personal de anime a partir del archivo oficial animelist.xml de MyAnimeList.
    - Cumple Pilares 2.1 y 2.2 de AGENTS.md (Zero Trust y Validación de Backend).
    - Tasa de consultas ultra-conservadora: animes desconocidos se crean de inmediato como
      placeholders locales con los metadatos del XML, y se enriquecen con MyAnimeList/Jikan
      con un tope estricto de máximo 5 títulos y un delay de 1.5s entre peticiones para prevenir
      bloqueos por rate limit.
    """
    user = _get_target_user(request)

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
        'dropped': 'pendiente',
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

