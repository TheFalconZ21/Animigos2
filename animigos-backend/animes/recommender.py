import math
import re
import logging
from typing import List, Dict, Any, Set, Optional
from django.db.models import Q
from .models import Anime, AnimeRecommendation
from .tmdb_service import TMDB_TO_ANIME_GENRES

logger = logging.getLogger(__name__)

# Regex estricto anti-secuelas para títulos en Romaji e Inglés
SEQUEL_TITLE_REGEX = re.compile(
    r'(?:'
    r'Season\s*[2-9]|'
    r'\b[2-9](?:nd|rd|th)\s+Season|'
    r'\bPart\s*[2-9]\b|'
    r'\bPart\s*(?:II|III|IV|V)\b|'
    r'\bCour\s*[2-9]\b|'
    r'Final\s*Season|'
    r'\b(?:2nd|3rd|4th)\s+(?:Stage|Series|Attack|Raid)\b|'
    r'(?<!Part\s)\b(?:II|III|IV)\b(?:\s*:|\s*$)|'
    r':\s*(?:Second|Third|Fourth)\s+|'
    r'Shippuuden|Shippuden|'
    r'Zoku\s+'
    r')',
    re.IGNORECASE
)

# Equivalencias semánticas entre Tropos del Test y Tags oficiales de AniList
TROPE_TO_ANILIST_TAGS: Dict[str, List[str]] = {
    'power_scaling': ['Shounen', 'Super Power', 'Martial Arts', 'Cultivation', 'Tournament', 'Swordplay'],
    'enemies_lovers': ['Enemies to Lovers', 'Tsundere', 'Heterosexual', 'Love Triangle', 'Kuudere'],
    'mastermind': ['Anti-Hero', 'Battle Royale', 'Conspiracy', 'Politics', 'Crime', 'Detective', 'Gambling', 'Philosophy'],
    'time_travel': ['Time Manipulation', 'Time Skip', 'Alternate Universe', 'Cosmic Horror', 'Deja Vu'],
    'antihero': ['Anti-Hero', 'Revenge', 'Crime', 'Noir', 'Assassins', 'Gangs', 'Mafia', 'Morally Ambiguous'],
    'slice_cozy': ['Iyashikei', 'Cute Girls Doing Cute Things', 'Food', 'Rural', 'Outdoor', 'Family Life', 'Episodic'],
    'dark_fantasy': ['Dark Fantasy', 'Gore', 'Tragedy', 'Demons', 'Survival', 'Body Horror', 'Post-Apocalyptic'],
    'psychological_twist': ['Psychological', 'Plot Twist', 'Denpa', 'Memory Manipulation', 'Philosophy', 'Thriller', 'Mystery'],
}

# Equivalencias semánticas entre Keywords/Temas de Películas (TMDb) y Tags de AniList
TMDB_KEYWORD_TO_ANILIST_TAGS: Dict[str, List[str]] = {
    'sueño': ['Memory Manipulation', 'Surreal Comedy', 'Denpa', 'Philosophy', 'Alternate Universe'],
    'dream': ['Memory Manipulation', 'Surreal Comedy', 'Denpa', 'Philosophy', 'Alternate Universe'],
    'subconsciente': ['Memory Manipulation', 'Philosophy', 'Psychological'],
    'cyberpunk': ['Cyberpunk', 'Artificial Intelligence', 'Dystopian', 'Cyborg', 'Augmented Reality'],
    'androide': ['Artificial Intelligence', 'Cyborg', 'Robots', 'Philosophy', 'Cyberpunk'],
    'robot': ['Robots', 'Real Robot', 'Super Robot', 'Artificial Intelligence'],
    'distopía': ['Dystopian', 'Post-Apocalyptic', 'Cyberpunk', 'Survival', 'Conspiracy'],
    'dystopia': ['Dystopian', 'Post-Apocalyptic', 'Cyberpunk', 'Survival', 'Conspiracy'],
    'espacio': ['Space', 'Space Opera', 'Aliens', 'Time Manipulation'],
    'space': ['Space', 'Space Opera', 'Aliens', 'Time Manipulation'],
    'tiempo': ['Time Manipulation', 'Alternate Universe', 'Tragedy'],
    'time': ['Time Manipulation', 'Alternate Universe', 'Tragedy'],
    'simulación': ['Virtual World', 'Artificial Intelligence', 'Cyberpunk', 'Philosophy'],
    'realidad virtual': ['Virtual World', 'Video Games', 'Augmented Reality', 'Cyberpunk'],
    'identidad': ['Philosophy', 'Memory Manipulation', 'Dissociative Identities', 'Primarily Adult Cast'],
    'investigación': ['Detective', 'Crime', 'Noir', 'Conspiracy', 'Police'],
    'detective': ['Detective', 'Crime', 'Noir', 'Police', 'Episodic'],
    'crimen': ['Crime', 'Mafia', 'Gangs', 'Noir', 'Assassins', 'Anti-Hero'],
    'crime': ['Crime', 'Mafia', 'Gangs', 'Noir', 'Assassins', 'Anti-Hero'],
    'venganza': ['Revenge', 'Anti-Hero', 'Tragedy', 'Assassins'],
    'revenge': ['Revenge', 'Anti-Hero', 'Tragedy', 'Assassins'],
    'conspiración': ['Conspiracy', 'Politics', 'Espionage', 'Thriller'],
    'guerra': ['War', 'Military', 'Politics', 'Tragedy', 'Historical'],
    'war': ['War', 'Military', 'Politics', 'Tragedy', 'Historical'],
    'supervivencia': ['Survival', 'Post-Apocalyptic', 'Battle Royale', 'Death Game'],
    'psicológico': ['Psychological', 'Philosophy', 'Tragedy', 'Denpa'],
    'nihilismo': ['Philosophy', 'Anti-Hero', 'Tragedy', 'Noir'],
}


def is_sequel_anime(anime: Anime) -> bool:
    """
    Determina de forma estricta si un anime es una secuela, temporada 2+ o parte posterior.
    Combina el marcador relacional oficial de AniList ('|_is_sequel_|') con análisis regex de títulos.
    """
    if anime.tags_cache and '|_is_sequel_|' in anime.tags_cache:
        return True
    if anime.title and SEQUEL_TITLE_REGEX.search(anime.title):
        return True
    if anime.title_english and SEQUEL_TITLE_REGEX.search(anime.title_english):
        return True
    return False


def calibrate_and_recommend(
    user=None,
    tmdb_movies: Optional[List[Dict[str, Any]]] = None,
    liked_anime_ids: Optional[List[int]] = None,
    favorite_genres: Optional[List[str]] = None,
    disliked_genres: Optional[List[str]] = None,
    tropes: Optional[List[str]] = None,
    pacing: str = '',
    preferred_format: str = '',
    preferred_genre: str = '',
    reference_work: Optional[Dict[str, Any]] = None,
    netflix_mode: bool = False,
    exclude_ids: Optional[List[int]] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Motor Recomendador Híbrido (Contenido + Tags Ponderados AniList + Proyección TMDb).
    Garantiza:
    - Exclusión estricta de animes ya vistos o en la lista del usuario.
    - Exclusión estricta de secuelas (temporadas 2+, partes 2+, preludios requeridos).
    - Soporte de filtros dinámicos ('sorprendeme', formato específico o género/tag específico).
    - Retorno exacto de Top-N alternativas con explicabilidad detallada.
    """
    tmdb_movies = list(tmdb_movies or [])
    liked_anime_ids = [int(x) for x in (liked_anime_ids or []) if str(x).isdigit()]
    favorite_genres = set(favorite_genres or [])
    disliked_genres = set(disliked_genres or [])
    tropes = list(tropes or [])
    extra_exclude = {int(x) for x in (exclude_ids or []) if str(x).isdigit()}

    # 1. Si el usuario está autenticado, enriquecer con sus preferencias persistidas y su lista
    seen_ids: Set[int] = set(liked_anime_ids) | extra_exclude
    if user and getattr(user, 'is_authenticated', False):
        try:
            from users.models import UserAnimeEntry, UserPreferences
            user_entries = UserAnimeEntry.objects.filter(user=user)
            seen_ids.update(user_entries.values_list('anime_id', flat=True))

            # Animes con nota >= 8 o marcados como favoritos nutren el perfil positivo
            fav_user_ids = user_entries.filter(
                Q(score__gte=8) | Q(is_favorite=True)
            ).values_list('anime_id', flat=True)
            for fid in fav_user_ids:
                if fid not in liked_anime_ids:
                    liked_anime_ids.append(fid)

            # Cargar preferencias guardadas si el payload viene vacío
            if hasattr(user, 'profile'):
                pref = UserPreferences.objects.filter(profile=user.profile).first()
                if pref:
                    if not favorite_genres and pref.favorite_genres:
                        favorite_genres.update(pref.favorite_genres)
                    if not disliked_genres and pref.disliked_genres:
                        disliked_genres.update(pref.disliked_genres)
                    if not pacing and pref.preferred_duration:
                        pacing = pref.preferred_duration
                    p_meta = pref.privacy_settings or {}
                    if not tmdb_movies and p_meta.get('tmdb_movies'):
                        tmdb_movies = p_meta['tmdb_movies']
                    if not tropes and p_meta.get('tropes'):
                        tropes = p_meta['tropes']
                    for saved_id in p_meta.get('liked_anime_ids', []):
                        try:
                            sid = int(saved_id)
                            seen_ids.add(sid)
                            if sid not in liked_anime_ids:
                                liked_anime_ids.append(sid)
                        except (ValueError, TypeError):
                            pass
        except Exception as e:
            logger.warning(f"Error cargando datos de usuario en recomendador: {e}")

    # 2. Construir el vector de pesos de Tags y Géneros del usuario
    liked_animes = list(
        Anime.objects.filter(mal_id__in=liked_anime_ids).only(
            'mal_id', 'title', 'studio', 'season_year', 'genres', 'tags_data'
        )
    )
    liked_studios = {a.studio for a in liked_animes if a.studio}
    liked_years = [a.season_year for a in liked_animes if a.season_year]
    seen_title_prefixes = [
        a.title.lower().strip()
        for a in liked_animes
        if a.title and len(a.title.strip()) >= 5
    ]

    # Mapa de afinidad por género
    genre_weights: Dict[str, float] = {g: 10.0 for g in favorite_genres}
    # Mapa de afinidad por Tag de AniList (nombre_lower -> peso acumulado)
    user_tag_weights: Dict[str, float] = {}
    user_tag_display: Dict[str, str] = {}

    for a in liked_animes:
        if isinstance(a.genres, list):
            for g in a.genres:
                genre_weights[g] = genre_weights.get(g, 0.0) + 6.0
        if isinstance(a.tags_data, list):
            for t in a.tags_data:
                if t.get('spoiler'):
                    continue
                t_name = t.get('name', '').strip()
                t_rank = float(t.get('rank') or 60)
                if t_name:
                    tl = t_name.lower()
                    user_tag_display[tl] = t_name
                    user_tag_weights[tl] = user_tag_weights.get(tl, 0.0) + (t_rank / 10.0)

    # Añadir tags derivados de los tropos elegidos en el cuestionario
    for tr in tropes:
        for mapped_tag in TROPE_TO_ANILIST_TAGS.get(tr, []):
            tl = mapped_tag.lower()
            user_tag_display[tl] = mapped_tag
            user_tag_weights[tl] = user_tag_weights.get(tl, 0.0) + 12.0

    # 3. Mapear películas Live-Action (TMDb) a géneros y tags granulares de AniList
    tmdb_movie_titles: List[str] = []
    tmdb_target_tags: Set[str] = set()
    tmdb_target_genres: Set[str] = set()

    for m in tmdb_movies:
        title = m.get('title') or m.get('original_title') or m.get('originalTitle') or ''
        if title:
            tmdb_movie_titles.append(title)
        for mg in m.get('genres', []):
            for ag in TMDB_TO_ANIME_GENRES.get(mg, []):
                tmdb_target_genres.add(ag)
                genre_weights[ag] = genre_weights.get(ag, 0.0) + 5.0

        # Keywords explícitas + escaneo de sinopsis
        raw_kws = list(m.get('keywords', []))
        overview_text = (m.get('overview') or '').lower()
        for kw_key, mapped_tags in TMDB_KEYWORD_TO_ANILIST_TAGS.items():
            if kw_key in overview_text or kw_key in [str(k).lower() for k in raw_kws]:
                for mt in mapped_tags:
                    mtl = mt.lower()
                    tmdb_target_tags.add(mtl)
                    user_tag_display[mtl] = mt
                    user_tag_weights[mtl] = user_tag_weights.get(mtl, 0.0) + 9.5

    # 4. Grafo de co-recomendaciones comunitarias
    co_rec_scores: Dict[int, int] = {}
    if liked_anime_ids:
        co_recs = AnimeRecommendation.objects.filter(
            source_id__in=liked_anime_ids
        ).values('target_id', 'strength')
        for cr in co_recs:
            tid = cr['target_id']
            if tid not in seen_ids:
                co_rec_scores[tid] = co_rec_scores.get(tid, 0) + cr['strength']

    # 4B. Procesar Referencia Puntual ingresada por el usuario en el Recomendador
    ref_title: str = ''
    ref_genres: Set[str] = set()
    ref_tags: Dict[str, str] = {}
    ref_co_recs: Dict[int, int] = {}
    ref_studio: str = ''

    if isinstance(reference_work, dict) and reference_work.get('title'):
        ref_title = str(reference_work.get('title', '')).strip()
        ref_kind = str(reference_work.get('kind', 'movie')).lower()

        if ref_kind == 'anime' and reference_work.get('mal_id'):
            try:
                ref_mal_id = int(reference_work['mal_id'])
                seen_ids.add(ref_mal_id)
                ref_anime_obj = Anime.objects.filter(mal_id=ref_mal_id).only(
                    'mal_id', 'title', 'studio', 'genres', 'tags_data'
                ).first()
                if ref_anime_obj:
                    ref_title = ref_anime_obj.title or ref_title
                    if len(ref_title) >= 5:
                        seen_title_prefixes.append(ref_title.lower().strip())
                    if ref_anime_obj.studio:
                        ref_studio = ref_anime_obj.studio
                    if isinstance(ref_anime_obj.genres, list):
                        for g in ref_anime_obj.genres:
                            ref_genres.add(g)
                    if isinstance(ref_anime_obj.tags_data, list):
                        for t in ref_anime_obj.tags_data:
                            if not t.get('spoiler') and t.get('name'):
                                ref_tags[t['name'].lower()] = t['name']

                    for cr in AnimeRecommendation.objects.filter(source_id=ref_mal_id).values('target_id', 'strength'):
                        tid = cr['target_id']
                        if tid not in seen_ids:
                            ref_co_recs[tid] = ref_co_recs.get(tid, 0) + cr['strength']
            except (ValueError, TypeError):
                pass
        else:
            # Película o Serie de Cine/TV puntual
            for mg in reference_work.get('genres', []):
                for ag in TMDB_TO_ANIME_GENRES.get(mg, [mg]):
                    ref_genres.add(ag)
            ref_ov = (str(reference_work.get('overview', '')) + ' ' + ref_title).lower()
            for kw_key, mapped_tags in TMDB_KEYWORD_TO_ANILIST_TAGS.items():
                if kw_key in ref_ov:
                    for mt in mapped_tags:
                        ref_tags[mt.lower()] = mt

    # 5. Filtrado de Universo de Candidatos en Base de Datos
    candidates_qs = (
        Anime.objects.filter(score__isnull=False, score__gte=6.8, scored_by__gte=500)
        .exclude(mal_id__in=seen_ids)
        .exclude(tags_cache__contains='|_is_sequel_|')
    )

    # Si hay una referencia puntual, exigir que el candidato comparta relación temática con la referencia
    if ref_title and (ref_genres or ref_tags or ref_co_recs):
        ref_q = Q()
        for rg in list(ref_genres)[:4]:
            ref_q |= Q(genres__icontains=rg)
        for rt_low in list(ref_tags.keys())[:5]:
            ref_q |= Q(tags_cache__icontains=f"|{rt_low}|")
        if ref_co_recs:
            ref_q |= Q(mal_id__in=list(ref_co_recs.keys())[:40])
        if ref_q:
            filtered_by_ref = candidates_qs.filter(ref_q)
            if filtered_by_ref.exists():
                candidates_qs = filtered_by_ref

    # Aplicar filtro de Formato si no es 'sorprendeme'
    fmt_clean = (preferred_format or '').strip()
    if fmt_clean and fmt_clean.lower() not in ('sorprendeme', 'sorpréndeme', 'todos', 'all', ''):
        format_map = {
            'movie': 'Movie',
            'pelicula': 'Movie',
            'película': 'Movie',
            'tv': 'TV',
            'serie': 'TV',
            'ova': 'OVA',
            'ona': 'ONA',
            'special': 'Special',
            'especial': 'Special',
        }
        mapped_fmt = format_map.get(fmt_clean.lower(), fmt_clean)
        candidates_qs = candidates_qs.filter(type__iexact=mapped_fmt)
    elif pacing == 'movies':
        # Si en el test eligió películas y dejó "Sorpréndeme", damos prioridad suave en el scoring pero no bloqueamos si cambia filtro
        pass

    # Aplicar filtro de Género / Preferencia específica si no es 'sorprendeme'
    genre_clean = (preferred_genre or '').strip()
    if genre_clean and genre_clean.lower() not in ('sorprendeme', 'sorpréndeme', 'todos', 'all', ''):
        candidates_qs = candidates_qs.filter(
            Q(genres__icontains=genre_clean) |
            Q(tags_cache__icontains=f"|{genre_clean.lower()}|")
        )

    # Tomar los mejores 450 candidatos que cumplen los filtros base para scoring híbrido profundo
    candidates_list = list(candidates_qs.order_by('-score', '-scored_by')[:450])

    scored_candidates = []

    for anime in candidates_list:
        # Filtro estricto anti-secuelas por título + relación
        if is_sequel_anime(anime):
            continue

        # Evitar spin-offs o películas de una franquicia que el usuario ya vio
        cand_title_lower = (anime.title or '').lower().strip()
        if any(cand_title_lower.startswith(pref + ':') or cand_title_lower.startswith(pref + ' ') for pref in seen_title_prefixes):
            continue

        anime_genres = set(anime.genres) if isinstance(anime.genres, list) else set()

        # Descarte estricto de géneros vetados (salvo que el usuario haya pedido explícitamente ese género en el selector)
        if disliked_genres.intersection(anime_genres):
            if not genre_clean or genre_clean not in disliked_genres:
                continue

        total_affinity = 0.0
        reasons: List[str] = []
        matched_tags_for_card: List[Dict[str, Any]] = []

        # A) Similitud por Tags Granulares Ponderados de AniList (hasta 38 pts)
        tag_score_acc = 0.0
        top_matched_tag_names: List[str] = []
        tmdb_matched_tag_names: List[str] = []
        ref_matched_features: List[str] = []

        if isinstance(anime.tags_data, list):
            for t in anime.tags_data:
                if t.get('spoiler'):
                    continue
                t_name = t.get('name', '')
                tl = t_name.lower()
                t_rank = float(t.get('rank') or 60) / 100.0  # 0.45 a 1.0

                if len(matched_tags_for_card) < 5:
                    matched_tags_for_card.append({
                        'name': t_name,
                        'category': t.get('category', 'Theme'),
                        'rank': int(t.get('rank') or 60),
                    })

                if tl in ref_tags:
                    total_affinity += 12.0 * t_rank
                    if len(ref_matched_features) < 3:
                        ref_matched_features.append(t_name)

                if tl in user_tag_weights:
                    contribution = user_tag_weights[tl] * t_rank * 0.55
                    tag_score_acc += contribution
                    if len(top_matched_tag_names) < 3:
                        top_matched_tag_names.append(t_name)
                    if tl in tmdb_target_tags and len(tmdb_matched_tag_names) < 2:
                        tmdb_matched_tag_names.append(t_name)

        total_affinity += min(38.0, tag_score_acc)

        # A2) Similitud directa con la Referencia Puntual ingresada por el usuario
        if ref_title:
            shared_ref_g = list(ref_genres.intersection(anime_genres))
            if shared_ref_g:
                total_affinity += min(22.0, len(shared_ref_g) * 8.5)
                for sg in shared_ref_g[:2]:
                    if sg not in ref_matched_features:
                        ref_matched_features.append(sg)
            if anime.mal_id in ref_co_recs:
                total_affinity += min(24.0, math.log2(ref_co_recs[anime.mal_id] + 1) * 6.0)
            if ref_studio and anime.studio == ref_studio:
                total_affinity += 8.0
            if ref_matched_features or anime.mal_id in ref_co_recs:
                feat_txt = ', '.join(ref_matched_features[:3]) if ref_matched_features else 'temática y narrativa'
                reasons.append(f"Parecido a '{ref_title}' ({feat_txt}) + afín a tu perfil")

        # B) Similitud por Géneros y Preferencia Activa (hasta 20 pts)
        genre_pts = sum(genre_weights.get(g, 0.0) for g in anime_genres) * 0.65
        if genre_clean and genre_clean.lower() not in ('sorprendeme', 'sorpréndeme', ''):
            # Bonus por cumplir explícitamente la preferencia activa
            genre_pts += 8.0
        total_affinity += min(20.0, genre_pts)

        # C) Co-recomendaciones comunitarias y Estudio (hasta 22 pts)
        if anime.mal_id in co_rec_scores:
            co_pts = min(14.0, math.log2(co_rec_scores[anime.mal_id] + 1) * 3.8)
            total_affinity += co_pts
            if not netflix_mode:
                reasons.append("Altamente co-recomendado por quienes vieron tus favoritos")

        if anime.studio and anime.studio in liked_studios:
            total_affinity += 8.0
            if not netflix_mode:
                reasons.append(f"Producido por {anime.studio}, estudio de tus obras favoritas")

        # D) Explicación por cruce de Películas TMDb (Estilo Netflix) y Tags
        if netflix_mode and tmdb_movie_titles:
            chosen_movie = tmdb_movie_titles[anime.mal_id % len(tmdb_movie_titles)]
            shared_movie_feats = tmdb_matched_tag_names + list(tmdb_target_genres.intersection(anime_genres))
            feat_str = ', '.join(shared_movie_feats[:3]) if shared_movie_feats else 'su atmósfera y ritmo'
            reasons.insert(0, f"Porque te gustó '{chosen_movie}': comparte {feat_str}")
        elif tmdb_matched_tag_names and tmdb_movie_titles:
            chosen_movie = tmdb_movie_titles[anime.mal_id % len(tmdb_movie_titles)]
            reasons.append(
                f"Conecta con tu gusto por '{chosen_movie}' a través de {', '.join(tmdb_matched_tag_names)}"
            )
        elif top_matched_tag_names:
            reasons.append(
                f"Encaja con tu perfil por sus tropos: {', '.join(top_matched_tag_names[:3])}"
            )

        # E) Ritmo / Duración (Pacing)
        if pacing:
            if pacing == 'fast_12' and anime.episodes and 1 <= anime.episodes <= 13:
                total_affinity += 5.0
            elif pacing in ('deep_24', 'standard_24') and anime.episodes and 14 <= anime.episodes <= 30:
                total_affinity += 5.0
            elif pacing == 'movies' and (anime.type or '').lower() == 'movie':
                total_affinity += 6.0

        # F) Calidad objetiva y Consenso (Score + Miembros, hasta 20 pts)
        score_val = float(anime.score) if anime.score else 7.2
        score_pts = max(0.0, min(14.0, (score_val - 6.5) * 5.2))
        members_pts = min(6.0, math.log10(max(10, anime.scored_by)) * 1.1)
        total_affinity += score_pts + members_pts

        # Proximidad temporal suave
        if liked_years and anime.season_year:
            min_dist = min(abs(anime.season_year - y) for y in liked_years)
            if min_dist <= 3:
                total_affinity += 3.0

        # Escalar a porcentaje de afinidad realista (74% a 99%)
        final_percentage = int(min(99, max(74, round(62 + total_affinity * 0.45))))

        if not reasons:
            g_list = list(anime_genres)[:2]
            g_str = ', '.join(g_list) if g_list else 'su género'
            reasons.append(f"Obra sobresaliente en {g_str} con ★ {score_val:.2f} de consenso")

        scored_candidates.append({
            'anime_id': anime.mal_id,
            'anime_title': anime.title,
            'anime_title_english': anime.title_english,
            'synopsis': anime.synopsis,
            'anime_poster': anime.image_url,
            'anime_banner': anime.banner_url,
            'anime_score': round(score_val, 2),
            'anime_scored_by': anime.scored_by,
            'anime_studio': anime.studio or 'Estudio reconocido',
            'season_year': anime.season_year,
            'episodes': anime.episodes,
            'type': anime.type or 'TV',
            'genres': anime.genres[:4] if isinstance(anime.genres, list) else [],
            'tags': matched_tags_for_card,
            'affinity_score': final_percentage,
            'match_reason': ' · '.join(reasons[:2]),
            '_raw_score': (final_percentage, round(total_affinity, 3), score_val),
        })

    # Ordenar por afinidad descendente y nota
    scored_candidates.sort(key=lambda x: x['_raw_score'], reverse=True)

    # Limpiar campo interno y entregar exactamente `limit` (por defecto 5)
    final_results = []
    for item in scored_candidates[:limit]:
        item.pop('_raw_score', None)
        final_results.append(item)

    return final_results


def build_user_taste_analytics(
    user=None,
    liked_anime_ids: Optional[List[int]] = None,
    favorite_genres: Optional[List[str]] = None,
    tropes: Optional[List[str]] = None,
    tmdb_movies: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Construye el Perfil Analítico y Matriz/Grafo de Co-ocurrencia de Gustos del Usuario.
    Retorna:
    - nodes: Nodos ponderados (Géneros y Tags granulares) para el Grafo de Red.
    - links: Aristas de co-ocurrencia entre tags/géneros con los animes que los conectan.
    - top_combinations: Pares de tags/géneros más recurrentes para el Heatmap/Tarjetas.
    - archetype: Arquetipo personalizado del usuario.
    """
    liked_ids: List[int] = [int(x) for x in (liked_anime_ids or []) if str(x).isdigit()]
    fav_genres: List[str] = list(favorite_genres or [])
    user_tropes: List[str] = list(tropes or [])
    movies: List[Dict[str, Any]] = list(tmdb_movies or [])

    if user and getattr(user, 'is_authenticated', False):
        try:
            from users.models import UserAnimeEntry, UserPreferences
            entries = UserAnimeEntry.objects.filter(user=user).filter(
                Q(score__gte=7) | Q(is_favorite=True) | Q(status__in=['visto', 'viendo'])
            )
            for aid in entries.values_list('anime_id', flat=True):
                if aid not in liked_ids:
                    liked_ids.append(aid)

            if hasattr(user, 'profile'):
                pref = UserPreferences.objects.filter(profile=user.profile).first()
                if pref:
                    if not fav_genres and pref.favorite_genres:
                        fav_genres = list(pref.favorite_genres)
                    p_meta = pref.privacy_settings or {}
                    if not user_tropes and p_meta.get('tropes'):
                        user_tropes = list(p_meta.get('tropes', []))
                    if not movies and p_meta.get('tmdb_movies'):
                        movies = list(p_meta.get('tmdb_movies', []))
                    for sid in p_meta.get('liked_anime_ids', []):
                        try:
                            if int(sid) not in liked_ids:
                                liked_ids.append(int(sid))
                        except (ValueError, TypeError):
                            pass
        except Exception as e:
            logger.warning(f"Error en build_user_taste_analytics: {e}")

    animes = list(
        Anime.objects.filter(mal_id__in=liked_ids).only('mal_id', 'title', 'genres', 'tags_data')
    )

    # Contabilizar frecuencia y peso de cada etiqueta (Géneros + Top Tags de cada anime)
    node_stats: Dict[str, Dict[str, Any]] = {}
    pair_counts: Dict[tuple, Dict[str, Any]] = {}

    def register_token(name: str, category: str, weight_add: float, anime_title: str = ''):
        key = name.strip()
        if not key:
            return
        if key not in node_stats:
            node_stats[key] = {
                'id': key,
                'label': key,
                'category': category,
                'weight': 0.0,
                'count': 0,
                'sample_animes': [],
            }
        node_stats[key]['weight'] += weight_add
        node_stats[key]['count'] += 1
        if anime_title and anime_title not in node_stats[key]['sample_animes'] and len(node_stats[key]['sample_animes']) < 4:
            node_stats[key]['sample_animes'].append(anime_title)

    # 1. Procesar animes vistos/favoritos del usuario
    for anime in animes:
        tokens_in_anime: List[str] = []
        if isinstance(anime.genres, list):
            for g in anime.genres[:3]:
                register_token(g, 'Genre', 14.0, anime.title)
                tokens_in_anime.append(g)

        if isinstance(anime.tags_data, list):
            for t in anime.tags_data[:5]:
                if t.get('spoiler'):
                    continue
                t_name = t.get('name', '').strip()
                t_rank = float(t.get('rank') or 70)
                t_cat = (t.get('category') or 'Theme').split('-')[0]
                if t_name and t_name not in tokens_in_anime:
                    register_token(t_name, t_cat, t_rank * 0.16, anime.title)
                    tokens_in_anime.append(t_name)

        # Registrar co-ocurrencia entre pares del mismo anime
        unique_tokens = sorted(set(tokens_in_anime))
        for i in range(len(unique_tokens)):
            for j in range(i + 1, len(unique_tokens)):
                pair = (unique_tokens[i], unique_tokens[j])
                if pair not in pair_counts:
                    pair_counts[pair] = {'weight': 0, 'shared_animes': []}
                pair_counts[pair]['weight'] += 1
                if anime.title not in pair_counts[pair]['shared_animes'] and len(pair_counts[pair]['shared_animes']) < 3:
                    pair_counts[pair]['shared_animes'].append(anime.title)

    # 2. Reforzar con géneros y tropos declarados en el test (resuelve Cold Start)
    declared_tokens: List[str] = []
    for g in fav_genres:
        register_token(g, 'Genre', 18.0)
        declared_tokens.append(g)

    for tr in user_tropes:
        for mt in TROPE_TO_ANILIST_TAGS.get(tr, [])[:2]:
            register_token(mt, 'Theme', 15.0)
            declared_tokens.append(mt)

    for m in movies:
        m_title = m.get('title') or 'Película favorita'
        movie_tokens: List[str] = []
        for mg in m.get('genres', [])[:3]:
            for ag in TMDB_TO_ANIME_GENRES.get(mg, [])[:2]:
                register_token(ag, 'Genre', 11.0, f"TMDb: {m_title}")
                declared_tokens.append(ag)
                movie_tokens.append(ag)
        m_text = f"{m_title} {m.get('overview', '')} {' '.join(m.get('keywords', []) or [])}".lower()
        for kw, mapped_tags in TMDB_KEYWORD_TO_ANILIST_TAGS.items():
            if kw in m_text:
                for mt in mapped_tags[:2]:
                    register_token(mt, 'Theme', 12.0, f"TMDb: {m_title}")
                    declared_tokens.append(mt)
                    movie_tokens.append(mt)
        unique_m_tokens = sorted(set(movie_tokens))
        for i in range(len(unique_m_tokens)):
            for j in range(i + 1, len(unique_m_tokens)):
                pair = (unique_m_tokens[i], unique_m_tokens[j])
                if pair not in pair_counts:
                    pair_counts[pair] = {'weight': 0, 'shared_animes': []}
                pair_counts[pair]['weight'] += 1
                ref_label = f"TMDb: {m_title}"
                if ref_label not in pair_counts[pair]['shared_animes'] and len(pair_counts[pair]['shared_animes']) < 3:
                    pair_counts[pair]['shared_animes'].append(ref_label)

    unique_decl = sorted(set(declared_tokens))
    for i in range(len(unique_decl)):
        for j in range(i + 1, len(unique_decl)):
            pair = (unique_decl[i], unique_decl[j])
            if pair not in pair_counts:
                pair_counts[pair] = {'weight': 0, 'shared_animes': ['Preferencia de Test']}
            pair_counts[pair]['weight'] += 1

    # Seleccionar Top 14 nodos más fuertes para mantener un grafo limpio y legible
    top_nodes = sorted(node_stats.values(), key=lambda x: x['weight'], reverse=True)[:14]
    allowed_ids = {n['id'] for n in top_nodes}

    # Normalizar pesos de 30 a 100
    max_w = max((n['weight'] for n in top_nodes), default=1.0)
    for n in top_nodes:
        n['normalized_weight'] = int(round(35 + (n['weight'] / max_w) * 65))
        n['weight'] = round(n['weight'], 1)

    # Filtrar aristas entre los nodos seleccionados
    links = []
    for (src, tgt), info in sorted(pair_counts.items(), key=lambda item: item[1]['weight'], reverse=True):
        if src in allowed_ids and tgt in allowed_ids:
            links.append({
                'source': src,
                'target': tgt,
                'strength': info['weight'],
                'shared_animes': info['shared_animes'],
            })

    links = links[:28]

    # Top 6 combinaciones recurrentes para tarjetas analíticas
    top_combinations = []
    for lk in links[:6]:
        affinity_pct = min(98, 72 + lk['strength'] * 6)
        top_combinations.append({
            'pair': f"{lk['source']} + {lk['target']}",
            'source': lk['source'],
            'target': lk['target'],
            'count': lk['strength'],
            'affinity_pct': affinity_pct,
            'examples': lk['shared_animes'],
        })

    # Determinar Arquetipo del usuario según sus 3 nodos principales
    top_3_labels = [n['label'] for n in top_nodes[:3]]
    if top_3_labels:
        archetype_title = f"Explorador de {' & '.join(top_3_labels[:2])}"
        archetype_desc = (
            f"Tus patrones de consumo convergen hacia historias con fuerte presencia de "
            f"{', '.join(top_3_labels)}, priorizando narrativas con identidad propia y alta cohesión temática."
        )
    else:
        archetype_title = "Explorador Multidimensional"
        archetype_desc = "Completa o amplía tu test de calibración para descubrir las correlaciones de tu ADN de anime."

    return {
        'nodes': top_nodes,
        'links': links,
        'top_combinations': top_combinations,
        'archetype': {
            'title': archetype_title,
            'description': archetype_desc,
            'dominant_tags': top_3_labels,
            'analyzed_works_count': len(animes),
        },
    }
