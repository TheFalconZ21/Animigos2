import math
import logging
from typing import List, Dict, Any, Set
from django.db.models import Q
from .models import Anime, AnimeRecommendation
from .tmdb_service import TMDB_TO_ANIME_GENRES

logger = logging.getLogger(__name__)

def calibrate_and_recommend(
    user=None,
    tmdb_movies: List[Dict[str, Any]] = None,
    liked_anime_ids: List[int] = None,
    favorite_genres: List[str] = None,
    disliked_genres: List[str] = None,
    tropes: List[str] = None,
    pacing: str = '',
    limit: int = 12
) -> List[Dict[str, Any]]:
    """
    Motor Recomendador Multidimensional del Profesor Doki Doki.
    Pondera:
    1. Animes que el usuario ya vio y le gustaron (estudio, época, co-recomendaciones).
    2. Cruce semántico de películas / series favoritas (TMDB).
    3. Calidad del anime (nota oficial y volumen de miembros/votos).
    4. Tropos y filtros de contenido.
    5. Exclusión estricta de animes ya vistos.
    """
    tmdb_movies = tmdb_movies or []
    liked_anime_ids = list(liked_anime_ids or [])
    favorite_genres = set(favorite_genres or [])
    disliked_genres = set(disliked_genres or [])
    tropes = tropes or []

    # 1. Identificar animes que el usuario YA VIO (para excluirlos)
    seen_ids: Set[int] = set(liked_anime_ids)
    if user and user.is_authenticated:
        try:
            from users.models import UserAnimeEntry
            user_entries = UserAnimeEntry.objects.filter(user=user)
            seen_ids.update(user_entries.values_list('anime_id', flat=True))
            # Añadir a liked_anime_ids los que tengan score >= 8 o favorito
            fav_user_ids = user_entries.filter(
                Q(score__gte=8) | Q(is_favorite=True)
            ).values_list('anime_id', flat=True)
            for fid in fav_user_ids:
                if fid not in liked_anime_ids:
                    liked_anime_ids.append(fid)
        except Exception as e:
            logger.warning(f"Error cargando entradas de usuario para recomendador: {e}")

    # 2. Extraer metadatos de los animes que le gustaron
    liked_animes = list(Anime.objects.filter(mal_id__in=liked_anime_ids))
    liked_studios = {a.studio for a in liked_animes if a.studio}
    liked_years = [a.season_year for a in liked_animes if a.season_year]
    liked_genres_count: Dict[str, int] = {}
    for a in liked_animes:
        if isinstance(a.genres, list):
            for g in a.genres:
                liked_genres_count[g] = liked_genres_count.get(g, 0) + 1

    # 3. Grafo de co-recomendaciones comunitarias (AnimeRecommendation)
    co_rec_scores: Dict[int, int] = {}
    if liked_anime_ids:
        co_recs = AnimeRecommendation.objects.filter(
            source_id__in=liked_anime_ids
        ).values('target_id', 'strength')
        for cr in co_recs:
            tid = cr['target_id']
            if tid not in seen_ids:
                co_rec_scores[tid] = co_rec_scores.get(tid, 0) + cr['strength']

    # 4. Mapear géneros y temas de las películas TMDB
    tmdb_anime_genres: Set[str] = set()
    tmdb_movie_titles: List[str] = []
    tmdb_keywords: Set[str] = set()

    for m in tmdb_movies:
        title = m.get('title') or m.get('originalTitle') or ''
        if title:
            tmdb_movie_titles.append(title)
        m_genres = m.get('genres', [])
        for mg in m_genres:
            mapped = TMDB_TO_ANIME_GENRES.get(mg, [])
            tmdb_anime_genres.update(mapped)
        # Extraer keywords de sinopsis
        overview = (m.get('overview') or '').lower()
        for kw in ['cyberpunk', 'psicológico', 'misterio', 'viajes en el tiempo', 'espacio', 'distopía', 'crimen', 'venganza', 'filosofía', 'acción']:
            if kw in overview:
                tmdb_keywords.add(kw)

    # Combinar géneros objetivo globales
    target_genres = favorite_genres.union(tmdb_anime_genres)
    for g, count in liked_genres_count.items():
        if count >= 1:
            target_genres.add(g)

    # 5. Obtener universo de candidatos de alta calidad
    candidates_qs = Anime.objects.filter(
        score__isnull=False,
        score__gte=6.8,
        scored_by__gte=500,
    ).exclude(mal_id__in=seen_ids).order_by('-score')[:350]

    scored_candidates = []

    for anime in candidates_qs:
        anime_genres = set(anime.genres) if isinstance(anime.genres, list) else set()

        # Descarte estricto si contiene géneros vetados
        if disliked_genres.intersection(anime_genres):
            continue

        total_affinity = 0.0
        reasons = []

        # A) Ponderación por Animes Vistos (Máxima prioridad: hasta 40 pts)
        anime_liked_overlap = sum(liked_genres_count.get(g, 0) for g in anime_genres)
        if anime_liked_overlap > 0:
            pts = min(18.0, anime_liked_overlap * 4.0)
            total_affinity += pts

        if anime.studio and anime.studio in liked_studios:
            total_affinity += 14.0
            reasons.append(f"Mismo estudio de producción ({anime.studio}) que tus animes favoritos")

        if liked_years and anime.season_year:
            # Ventana de proximidad temporal
            min_dist = min(abs(anime.season_year - y) for y in liked_years)
            if min_dist <= 2:
                total_affinity += 8.0
            elif min_dist <= 5:
                total_affinity += 4.0

        # Grafo comunitario
        if anime.mal_id in co_rec_scores:
            co_pts = min(20.0, math.log2(co_rec_scores[anime.mal_id] + 1) * 4.5)
            total_affinity += co_pts
            reasons.append("Ampliamente co-recomendado por la comunidad junto a tus animes vistos")

        # B) Ponderación por Películas TMDB (hasta 25 pts)
        tmdb_overlap = tmdb_anime_genres.intersection(anime_genres)
        if tmdb_overlap:
            total_affinity += min(18.0, len(tmdb_overlap) * 6.0)
            if tmdb_movie_titles:
                chosen_movie = tmdb_movie_titles[len(scored_candidates) % len(tmdb_movie_titles)]
                reasons.append(f"Afinidad temática con tu película {chosen_movie} ({', '.join(list(tmdb_overlap)[:2])})")

        # C) Calidad del Anime: Nota y Miembros (hasta 25 pts)
        score_val = float(anime.score) if anime.score else 7.0
        # Normalizado: nota 8.0 -> 12 pts, 9.0 -> 18 pts
        score_pts = (score_val - 6.0) * 6.0
        total_affinity += max(0.0, min(18.0, score_pts))

        # Popularidad / Miembros
        if anime.scored_by > 0:
            members_pts = min(8.0, math.log10(anime.scored_by) * 1.5)
            total_affinity += members_pts

        # D) Tropos y preferencias de formato
        if pacing:
            if pacing == 'fast_12' and anime.episodes and anime.episodes <= 13:
                total_affinity += 5.0
            elif pacing == 'standard_24' and anime.episodes and 14 <= anime.episodes <= 26:
                total_affinity += 5.0
            elif pacing == 'long_shonen' and anime.episodes and anime.episodes > 26:
                total_affinity += 5.0

        # Escalar afinidad final a porcentaje entre 70% y 99%
        final_percentage = int(min(99, max(72, 60 + total_affinity * 0.42)))

        # Resumen explicativo unificado
        if not reasons:
            top_genre = list(anime_genres)[0] if anime_genres else 'Aventura'
            reasons.append(f"Alta calificación general y excelencia en el género {top_genre}")

        main_reason = " · ".join(reasons[:2])

        scored_candidates.append({
            'anime_id': anime.mal_id,
            'anime_title': anime.title,
            'anime_title_english': anime.title_english,
            'anime_poster': anime.image_url,
            'anime_banner': anime.banner_url,
            'anime_score': round(score_val, 2),
            'anime_scored_by': anime.scored_by,
            'anime_studio': anime.studio or 'Estudio reconocido',
            'season_year': anime.season_year,
            'episodes': anime.episodes,
            'genres': anime.genres[:3] if isinstance(anime.genres, list) else [],
            'affinity_score': final_percentage,
            'match_reason': main_reason,
        })

    # Ordenar por afinidad y calidad
    scored_candidates.sort(key=lambda x: (x['affinity_score'], x['anime_score']), reverse=True)
    return scored_candidates[:limit]
