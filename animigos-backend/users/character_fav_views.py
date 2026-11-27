from django.contrib.auth.models import User
from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import UserFavoriteCharacter


def serialize_user_favorite_characters(target_user) -> list[dict]:
    """
    Devuelve la lista de personajes favoritos de `target_user`, enriquecida con el conteo
    reactivo de favoritos en la base de datos de Animigos + los favoritos globales base.
    """
    if not target_user:
        return []
    favs = list(UserFavoriteCharacter.objects.filter(user=target_user).order_by('created_at'))
    if not favs:
        return []

    char_ids = [f.character_id for f in favs]
    counts_qs = (
        UserFavoriteCharacter.objects.filter(character_id__in=char_ids)
        .values('character_id')
        .annotate(total=Count('id'))
    )
    counts_map = {row['character_id']: row['total'] for row in counts_qs}

    result = []
    for f in favs:
        animigos_count = counts_map.get(f.character_id, 1)
        base_fav = max(0, int(f.base_favourites or 0))
        result.append({
            'id': str(f.id),
            'character_id': f.character_id,
            'name': f.character_name,
            'native_name': f.character_native,
            'image_url': f.character_image,
            'role_display': f.role_display or 'Principal',
            'anime_mal_id': f.anime_mal_id,
            'anime_title': f.anime_title,
            'base_favourites': base_fav,
            'animigos_favourites': animigos_count,
            'favourites': base_fav + animigos_count,
            'is_favourite': True,
            'created_at': f.created_at.isoformat(),
        })
    return result


@api_view(['GET'])
@permission_classes([AllowAny])
def list_favorite_characters_view(request):
    """
    GET /api/users/favorite-characters/?username=<optional>
    Lista los personajes favoritos del usuario autenticado o del usuario consultado por `username`.
    """
    username = (request.query_params.get('username') or '').strip().lstrip('@')
    if username:
        target_user = User.objects.filter(username__iexact=username).first()
        if not target_user:
            return Response({'results': []})
        return Response({'results': serialize_user_favorite_characters(target_user)})

    if not request.user or not request.user.is_authenticated:
        return Response({'results': []})

    return Response({'results': serialize_user_favorite_characters(request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_favorite_character_view(request):
    """
    POST /api/users/favorite-characters/toggle/
    Agrega o quita un personaje de los favoritos del usuario autenticado en PostgreSQL
    y devuelve el nuevo estado y conteo total reactivo de favoritos del personaje.
    """
    data = request.data or {}
    raw_cid = data.get('character_id') or data.get('id')
    try:
        character_id = int(raw_cid)
    except (TypeError, ValueError):
        return Response(
            {'error': 'character_id es requerido y debe ser numérico.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing = UserFavoriteCharacter.objects.filter(
        user=request.user,
        character_id=character_id,
    ).first()

    base_fav_raw = data.get('base_favourites', data.get('favourites', 0))
    try:
        base_fav = max(0, int(base_fav_raw or 0))
    except (TypeError, ValueError):
        base_fav = 0

    if existing:
        stored_base = max(base_fav, int(existing.base_favourites or 0))
        existing.delete()
        is_favourite = False
    else:
        name = str(data.get('character_name') or data.get('name') or 'Personaje').strip()[:255]
        native = str(data.get('character_native') or data.get('native_name') or '').strip()[:255]
        image_url = str(data.get('character_image') or data.get('image_url') or '').strip()
        role_display = str(data.get('role_display') or 'Principal').strip()[:80]
        anime_title = str(data.get('anime_title') or '').strip()[:300]
        raw_mal = data.get('anime_mal_id') or data.get('mal_id')
        try:
            anime_mal_id = int(raw_mal) if raw_mal else None
        except (TypeError, ValueError):
            anime_mal_id = None

        created = UserFavoriteCharacter.objects.create(
            user=request.user,
            character_id=character_id,
            character_name=name,
            character_native=native,
            character_image=image_url,
            role_display=role_display,
            anime_mal_id=anime_mal_id,
            anime_title=anime_title,
            base_favourites=base_fav,
        )
        stored_base = created.base_favourites
        is_favourite = True

    animigos_count = UserFavoriteCharacter.objects.filter(character_id=character_id).count()
    # Si hay otros registros en BD con base_favourites mayor, usar el máximo conocido
    if stored_base == 0:
        other_rec = (
            UserFavoriteCharacter.objects.filter(character_id=character_id)
            .order_by('-base_favourites')
            .first()
        )
        if other_rec:
            stored_base = int(other_rec.base_favourites or 0)

    total_favourites = stored_base + animigos_count

    return Response({
        'character_id': character_id,
        'is_favourite': is_favourite,
        'base_favourites': stored_base,
        'animigos_favourites': animigos_count,
        'favourites': total_favourites,
        'results': serialize_user_favorite_characters(request.user),
    })
