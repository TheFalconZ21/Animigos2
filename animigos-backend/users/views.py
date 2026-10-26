from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
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
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        profile_serializer = ProfileSerializer(user.profile)
        return Response({
            'message': 'Usuario registrado exitosamente',
            'user': profile_serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """
    Inicia sesión con credenciales de usuario.
    """
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Usuario y contraseña requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        profile_serializer = ProfileSerializer(user.profile)
        return Response({
            'message': 'Sesión iniciada correctamente',
            'user': profile_serializer.data
        }, status=status.HTTP_200_OK)
    
    return Response({'error': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_user(request):
    logout(request)
    return Response({'message': 'Sesión cerrada correctamente'})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_user(request):
    """
    Retorna el perfil del usuario actual (o demo si no está autenticado).
    """
    if request.user.is_authenticated:
        return Response(ProfileSerializer(request.user.profile).data)
    
    # Si no está logueado, retornar perfil anfitrión demo
    first_user = User.objects.first()
    if first_user and hasattr(first_user, 'profile'):
        return Response(ProfileSerializer(first_user.profile).data)

    return Response({'authenticated': False, 'message': 'No hay sesión activa'})


@api_view(['PATCH'])
@permission_classes([AllowAny])
def update_profile(request):
    """
    Actualiza datos de perfil (nombre, avatar, bio, anime favorito).
    """
    user = request.user if request.user.is_authenticated else User.objects.first()
    if not user or not hasattr(user, 'profile'):
        return Response({'error': 'No se encontró perfil para actualizar'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProfileSerializer(user.profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([AllowAny])
def update_preferences(request):
    """
    Actualiza preferencias del usuario para el recomendador (géneros favoritos, vetos, experiencia).
    """
    user = request.user if request.user.is_authenticated else User.objects.first()
    if not user or not hasattr(user, 'profile') or not hasattr(user.profile, 'preferences'):
        return Response({'error': 'No se encontraron preferencias para actualizar'}, status=status.HTTP_404_NOT_FOUND)

    serializer = UserPreferencesSerializer(user.profile.preferences, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------------------------------------------
# SECCIÓN: MI LISTA (PERSONAL ANIME LIST & FOLDERS)
# -------------------------------------------------------------

def _get_target_user(request):
    if request.user.is_authenticated:
        return request.user
    first_user = User.objects.first()
    if not first_user:
        first_user = User.objects.create_user(username='otaku_demo', email='demo@animigos.cl')
    return first_user


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
