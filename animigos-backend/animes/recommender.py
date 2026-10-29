import math
import re
import logging
from typing import List, Dict, Any, Set, Optional
from django.db.models import Q
from .models import Anime, AnimeRecommendation, ExternalReferenceMedia
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

# Equivalencias semánticas entre Keywords/Temas de Películas y Series (TMDb) y Tags de AniList
TMDB_KEYWORD_TO_ANILIST_TAGS: Dict[str, List[str]] = {
    # Ciencia ficción, Espacio y Cyberpunk
    'sueño': ['Memory Manipulation', 'Surreal Comedy', 'Denpa', 'Philosophy', 'Alternate Universe'],
    'dream': ['Memory Manipulation', 'Surreal Comedy', 'Denpa', 'Philosophy', 'Alternate Universe'],
    'subconsciente': ['Memory Manipulation', 'Philosophy', 'Psychological'],
    'cyberpunk': ['Cyberpunk', 'Artificial Intelligence', 'Dystopian', 'Cyborg', 'Augmented Reality'],
    'androide': ['Artificial Intelligence', 'Cyborg', 'Robots', 'Philosophy', 'Cyberpunk'],
    'robot': ['Robots', 'Real Robot', 'Super Robot', 'Artificial Intelligence'],
    'distopía': ['Dystopian', 'Post-Apocalyptic', 'Cyberpunk', 'Survival', 'Conspiracy'],
    'distopia': ['Dystopian', 'Post-Apocalyptic', 'Cyberpunk', 'Survival', 'Conspiracy'],
    'dystopia': ['Dystopian', 'Post-Apocalyptic', 'Cyberpunk', 'Survival', 'Conspiracy'],
    'espacio': ['Space', 'Space Opera', 'Aliens', 'Time Manipulation'],
    'space': ['Space', 'Space Opera', 'Aliens', 'Time Manipulation'],
    'tiempo': ['Time Manipulation', 'Alternate Universe', 'Tragedy'],
    'time': ['Time Manipulation', 'Alternate Universe', 'Tragedy'],
    'time travel': ['Time Manipulation', 'Alternate Universe', 'Time Skip'],
    'viaje en el tiempo': ['Time Manipulation', 'Alternate Universe', 'Time Skip'],
    'time loop': ['Time Manipulation', 'Tragedy', 'Mystery', 'Alternate Universe'],
    'bucle temporal': ['Time Manipulation', 'Tragedy', 'Mystery', 'Alternate Universe'],
    'mind-bending': ['Psychological', 'Plot Twist', 'Philosophy', 'Cosmic Horror'],
    'generations': ['Family Life', 'Time Skip', 'Historical', 'Mystery'],
    'generaciones': ['Family Life', 'Time Skip', 'Historical', 'Mystery'],
    'upside down': ['Alternate Universe', 'Cosmic Horror', 'Supernatural'],
    'laboratory': ['Sci-Fi', 'Conspiracy', 'Artificial Intelligence'],
    'laboratorio': ['Sci-Fi', 'Conspiracy', 'Artificial Intelligence'],
    'simulación': ['Virtual World', 'Artificial Intelligence', 'Cyberpunk', 'Philosophy'],
    'realidad virtual': ['Virtual World', 'Video Games', 'Augmented Reality', 'Cyberpunk'],
    'identidad': ['Philosophy', 'Memory Manipulation', 'Dissociative Identities', 'Primarily Adult Cast'],
    'alien': ['Aliens', 'Cosmic Horror', 'Space', 'Supernatural'],
    'extraterrestre': ['Aliens', 'Cosmic Horror', 'Space', 'Supernatural'],
    'portal': ['Isekai', 'Alternate Universe', 'Dimensional Travel', 'Magic'],
    'multiverso': ['Alternate Universe', 'Time Manipulation', 'Sci-Fi'],
    'multiverse': ['Alternate Universe', 'Time Manipulation', 'Sci-Fi'],

    # Crimen, Mafia, Drogas y Cárteles (ej: Breaking Bad, Narcos, Peaky Blinders, The Wire)
    'investigación': ['Detective', 'Crime', 'Noir', 'Conspiracy', 'Police'],
    'investigation': ['Detective', 'Crime', 'Noir', 'Conspiracy', 'Police'],
    'detective': ['Detective', 'Crime', 'Noir', 'Police', 'Episodic'],
    'crimen': ['Crime', 'Mafia', 'Gangs', 'Noir', 'Assassins', 'Anti-Hero'],
    'crime': ['Crime', 'Mafia', 'Gangs', 'Noir', 'Assassins', 'Anti-Hero'],
    'mafia': ['Mafia', 'Gangs', 'Crime', 'Noir', 'Underworld', 'Anti-Hero'],
    'cartel': ['Crime', 'Mafia', 'Drugs', 'Anti-Hero', 'Gangs', 'Tragedy'],
    'cártel': ['Crime', 'Mafia', 'Drugs', 'Anti-Hero', 'Gangs', 'Tragedy'],
    'droga': ['Drugs', 'Crime', 'Anti-Hero', 'Tragedy', 'Noir'],
    'drug': ['Drugs', 'Crime', 'Anti-Hero', 'Tragedy', 'Noir'],
    'meth': ['Drugs', 'Crime', 'Anti-Hero', 'Tragedy'],
    'metanfetamina': ['Drugs', 'Crime', 'Anti-Hero', 'Tragedy'],
    'gang': ['Gangs', 'Delinquents', 'Crime', 'Mafia', 'Action'],
    'pandilla': ['Gangs', 'Delinquents', 'Crime', 'Mafia', 'Action'],
    'corrupción': ['Politics', 'Crime', 'Conspiracy', 'Noir'],
    'corruption': ['Politics', 'Crime', 'Conspiracy', 'Noir'],
    'police': ['Police', 'Detective', 'Crime', 'Noir'],
    'policía': ['Police', 'Detective', 'Crime', 'Noir'],
    'serial killer': ['Serial Killer', 'Psychological', 'Detective', 'Noir', 'Tragedy'],
    'asesino en serie': ['Serial Killer', 'Psychological', 'Detective', 'Noir', 'Tragedy'],
    'venganza': ['Revenge', 'Anti-Hero', 'Tragedy', 'Assassins'],
    'revenge': ['Revenge', 'Anti-Hero', 'Tragedy', 'Assassins'],
    'conspiración': ['Conspiracy', 'Politics', 'Espionage', 'Thriller'],
    'conspiracy': ['Conspiracy', 'Politics', 'Espionage', 'Thriller'],
    'espionaje': ['Espionage', 'Conspiracy', 'Politics', 'Assassins'],
    'espionage': ['Espionage', 'Conspiracy', 'Politics', 'Assassins'],

    # Fantasía Épica, Reinos, Dinastías y Política (ej: Game of Thrones, House of the Dragon, Vikings, The Witcher)
    'throne': ['Royalty', 'Politics', 'War', 'Dark Fantasy', 'Medieval', 'Tragedy'],
    'trono': ['Royalty', 'Politics', 'War', 'Dark Fantasy', 'Medieval', 'Tragedy'],
    'kingdom': ['Medieval', 'Royalty', 'War', 'Politics', 'Swordplay', 'Fantasy'],
    'reino': ['Medieval', 'Royalty', 'War', 'Politics', 'Swordplay', 'Fantasy'],
    'medieval': ['Medieval', 'Swordplay', 'Historical', 'War', 'Dark Fantasy'],
    'dragon': ['Dragons', 'Dark Fantasy', 'Magic', 'Swordplay'],
    'dragón': ['Dragons', 'Dark Fantasy', 'Magic', 'Swordplay'],
    'viking': ['Vikings', 'Historical', 'Revenge', 'War', 'Swordplay', 'Primarily Adult Cast'],
    'vikingo': ['Vikings', 'Historical', 'Revenge', 'War', 'Swordplay', 'Primarily Adult Cast'],
    'empire': ['Politics', 'War', 'Military', 'Historical', 'Royalty'],
    'imperio': ['Politics', 'War', 'Military', 'Historical', 'Royalty'],
    'dynasty': ['Historical', 'Politics', 'Royalty', 'Family Life'],
    'dinastía': ['Historical', 'Politics', 'Royalty', 'Family Life'],
    'guerra': ['War', 'Military', 'Politics', 'Tragedy', 'Historical'],
    'war': ['War', 'Military', 'Politics', 'Tragedy', 'Historical'],
    'magic': ['Magic', 'Fantasy', 'Witch', 'Supernatural'],
    'magia': ['Magic', 'Fantasy', 'Witch', 'Supernatural'],
    'witch': ['Witch', 'Magic', 'Dark Fantasy', 'Supernatural'],
    'bruja': ['Witch', 'Magic', 'Dark Fantasy', 'Supernatural'],

    # Misterio, Sobrenatural, Desapariciones y Horror Cósmico (ej: Dark, Stranger Things, Lost)
    'missing': ['Mystery', 'Plot Twist', 'Cosmic Horror', 'Rural', 'Family Life'],
    'desaparecido': ['Mystery', 'Plot Twist', 'Cosmic Horror', 'Rural', 'Family Life'],
    'supernatural': ['Supernatural', 'Urban Fantasy', 'Cosmic Horror', 'Demons'],
    'sobrenatural': ['Supernatural', 'Urban Fantasy', 'Cosmic Horror', 'Demons'],
    'monster': ['Monsters', 'Body Horror', 'Dark Fantasy', 'Survival'],
    'monstruo': ['Monsters', 'Body Horror', 'Dark Fantasy', 'Survival'],
    'curse': ['Curse', 'Supernatural', 'Dark Fantasy', 'Tragedy'],
    'maldición': ['Curse', 'Supernatural', 'Dark Fantasy', 'Tragedy'],

    # Supervivencia, Apocalipsis y Zombis (ej: The Walking Dead, The Last of Us)
    'supervivencia': ['Survival', 'Post-Apocalyptic', 'Battle Royale', 'Death Game'],
    'survival': ['Survival', 'Post-Apocalyptic', 'Battle Royale', 'Death Game'],
    'zombie': ['Zombie', 'Post-Apocalyptic', 'Survival', 'Horror', 'Gore'],
    'zombi': ['Zombie', 'Post-Apocalyptic', 'Survival', 'Horror', 'Gore'],
    'apocalypse': ['Post-Apocalyptic', 'Dystopian', 'Survival', 'Tragedy'],
    'apocalipsis': ['Post-Apocalyptic', 'Dystopian', 'Survival', 'Tragedy'],
    'virus': ['Post-Apocalyptic', 'Survival', 'Tragedy', 'Body Horror'],

    # Superhéroes, Cómics y Vigilantes (ej: Spider-Man, Batman, Superman, Iron Man, The Boys, Avengers)
    'superhero': ['Superhero', 'Super Power', 'Urban Fantasy', 'Urban'],
    'superhéroe': ['Superhero', 'Super Power', 'Urban Fantasy', 'Urban'],
    'superheroes': ['Superhero', 'Super Power', 'Urban Fantasy', 'Urban'],
    'superhéroes': ['Superhero', 'Super Power', 'Urban Fantasy', 'Urban'],
    'spiderman': ['Superhero', 'Super Power', 'School', 'Urban Fantasy', 'Urban', 'Male Protagonist'],
    'spider-man': ['Superhero', 'Super Power', 'School', 'Urban Fantasy', 'Urban', 'Male Protagonist'],
    'spider': ['Superhero', 'Super Power', 'Urban Fantasy', 'Urban'],
    'peter parker': ['Superhero', 'Super Power', 'School', 'Male Protagonist'],
    'batman': ['Superhero', 'Vigilante', 'Detective', 'Noir', 'Crime', 'Primarily Adult Cast'],
    'superman': ['Superhero', 'Super Power', 'Aliens', 'Male Protagonist'],
    'iron man': ['Superhero', 'Super Power', 'Cyborg', 'Robots'],
    'avengers': ['Superhero', 'Super Power', 'Ensemble Cast', 'Urban Fantasy'],
    'vengadores': ['Superhero', 'Super Power', 'Ensemble Cast', 'Urban Fantasy'],
    'marvel': ['Superhero', 'Super Power', 'Urban Fantasy', 'Action'],
    'dc comics': ['Superhero', 'Super Power', 'Urban Fantasy', 'Action'],
    'superpower': ['Super Power', 'Superhero', 'Urban Fantasy'],
    'superpoder': ['Super Power', 'Superhero', 'Urban Fantasy'],
    'superpoderes': ['Super Power', 'Superhero', 'Urban Fantasy'],
    'vigilante': ['Anti-Hero', 'Crime', 'Noir', 'Revenge', 'Police', 'Vigilante'],
    'tokusatsu': ['Tokusatsu', 'Henshin', 'Superhero'],
    'kamen rider': ['Tokusatsu', 'Henshin', 'Superhero'],

    # Psicológico, Nihilismo y Juegos Mentales
    'psicológico': ['Psychological', 'Philosophy', 'Tragedy', 'Denpa', 'Plot Twist'],
    'psychological': ['Psychological', 'Philosophy', 'Tragedy', 'Denpa', 'Plot Twist'],
    'nihilismo': ['Philosophy', 'Anti-Hero', 'Tragedy', 'Noir'],
    'mind game': ['Philosophy', 'Psychological', 'Plot Twist', 'Gambling'],
    'juegos mentales': ['Philosophy', 'Psychological', 'Plot Twist', 'Gambling'],
    'estrategia': ['Military', 'Politics', 'Philosophy', 'War'],
    'strategy': ['Military', 'Politics', 'Philosophy', 'War'],
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
    preferred_year_min: Optional[int] = None,
    preferred_year_max: Optional[int] = None,
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

    # 3. Mapear películas y series Live-Action (TMDb) a géneros y tags granulares de AniList
    tmdb_movie_titles: List[str] = []
    tmdb_target_tags: Set[str] = set()
    tmdb_target_genres: Set[str] = set()

    for m in tmdb_movies:
        title = m.get('title') or m.get('original_title') or m.get('originalTitle') or ''
        if title:
            tmdb_movie_titles.append(title)

        genres_pool = list(m.get('genres', []))
        overview_text = str(m.get('overview') or '')
        raw_kws = list(m.get('keywords', []))

        # Autohidratar desde ExternalReferenceMedia si faltan datos en el payload
        if (not genres_pool or len(overview_text) < 20) and title:
            ext_m = ExternalReferenceMedia.objects.filter(
                Q(title__iexact=title) | Q(original_title__iexact=title)
            ).first()
            if ext_m:
                if not genres_pool and ext_m.genres:
                    genres_pool = ext_m.genres
                if len(overview_text) < 20 and ext_m.overview:
                    overview_text = ext_m.overview
                if not raw_kws and ext_m.keywords:
                    raw_kws = ext_m.keywords

        for mg in genres_pool:
            for ag in TMDB_TO_ANIME_GENRES.get(mg, []):
                tmdb_target_genres.add(ag)
                genre_weights[ag] = genre_weights.get(ag, 0.0) + 5.0

        search_blob = f"{overview_text} {title}".lower()
        for kw_key, mapped_tags in TMDB_KEYWORD_TO_ANILIST_TAGS.items():
            is_matched = False
            if len(kw_key) <= 5:
                if re.search(r'\b' + re.escape(kw_key) + r'\b', search_blob):
                    is_matched = True
            else:
                if kw_key in search_blob:
                    is_matched = True

            if not is_matched and raw_kws:
                for k in raw_kws:
                    kl = str(k).lower()
                    if kw_key == kl or (len(kw_key) > 5 and kw_key in kl):
                        is_matched = True
                        break

            if is_matched:
                for mt in mapped_tags:
                    mtl = mt.lower()
                    tmdb_target_tags.add(mtl)
                    user_tag_display[mtl] = mt
                    w_boost = 16.0 if mtl == 'superhero' else 9.5
                    user_tag_weights[mtl] = user_tag_weights.get(mtl, 0.0) + w_boost

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
            ext_obj = None
            if ref_title:
                ext_obj = ExternalReferenceMedia.objects.filter(
                    Q(title__iexact=ref_title) | Q(original_title__iexact=ref_title)
                ).first()

                # Búsqueda tolerante a variaciones de título (ej: 'spiderman' -> 'Spider-Man')
                if not ext_obj:
                    norm_clean = re.sub(r'[^a-zA-Z0-9]', '', ref_title.lower())
                    ext_obj = (
                        ExternalReferenceMedia.objects.filter(
                            Q(title__icontains=ref_title) |
                            Q(original_title__icontains=ref_title) |
                            Q(title__icontains=ref_title.replace('-', ' '))
                        ).order_by('-vote_count').first()
                    )
                    if not ext_obj and len(norm_clean) >= 4:
                        for top_m in ExternalReferenceMedia.objects.filter(title__icontains=ref_title[:4]).order_by('-vote_count')[:40]:
                            top_clean = re.sub(r'[^a-zA-Z0-9]', '', top_m.title.lower())
                            if norm_clean in top_clean or top_clean in norm_clean:
                                ext_obj = top_m
                                break

            genres_pool = list(reference_work.get('genres', []))
            if ext_obj and ext_obj.genres and not genres_pool:
                genres_pool = ext_obj.genres

            for mg in genres_pool:
                for ag in TMDB_TO_ANIME_GENRES.get(mg, [mg]):
                    ref_genres.add(ag)

            overview_text = str(reference_work.get('overview', ''))
            if ext_obj and ext_obj.overview and len(overview_text) < 20:
                overview_text = ext_obj.overview

            ref_ov = f"{overview_text} {ref_title}".lower()
            for kw_key, mapped_tags in TMDB_KEYWORD_TO_ANILIST_TAGS.items():
                is_matched = False
                if len(kw_key) <= 5:
                    if re.search(r'\b' + re.escape(kw_key) + r'\b', ref_ov):
                        is_matched = True
                else:
                    if kw_key in ref_ov:
                        is_matched = True

                if is_matched:
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

    # Aplicar filtro de Rango de Años (desde / hasta)
    if preferred_year_min is not None:
        try:
            y_min = int(preferred_year_min)
            if y_min >= 1900:
                candidates_qs = candidates_qs.filter(season_year__gte=y_min)
        except (ValueError, TypeError):
            pass

    if preferred_year_max is not None:
        try:
            y_max = int(preferred_year_max)
            if y_max >= 1900:
                candidates_qs = candidates_qs.filter(season_year__lte=y_max)
        except (ValueError, TypeError):
            pass

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
                    if tl == 'superhero':
                        total_affinity += 28.0 * t_rank
                        if 'Superhero' not in ref_matched_features:
                            ref_matched_features.insert(0, 'Superhero')
                    elif tl == 'super power':
                        total_affinity += 18.0 * t_rank
                        if 'Super Power' not in ref_matched_features:
                            ref_matched_features.append('Super Power')
                    else:
                        total_affinity += 14.0 * t_rank
                        if len(ref_matched_features) < 3 and t_name not in ref_matched_features:
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
            'synopsis': getattr(anime, 'synopsis_es', None) or anime.synopsis,
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

    user_scores_by_mal: Dict[int, float] = {}
    if user and getattr(user, 'is_authenticated', False):
        try:
            from users.models import UserAnimeEntry, UserPreferences
            # EXCLUSIÓN ESTRICTA: Solo animes que como mínimo hayan sido 'vistos' (o 'viendo' con episodios vistos)
            # Los animes en estado 'pendiente' o 'dropeado' no deben ser tomados en cuenta en el perfil analítico
            watched_entries = UserAnimeEntry.objects.filter(
                user=user,
                status__in=['visto', 'viendo']
            ).exclude(
                status='viendo', episodes_watched=0
            ).select_related('anime')

            for entry_obj in watched_entries:
                aid = entry_obj.anime_id
                if entry_obj.score is not None and entry_obj.score > 0:
                    user_scores_by_mal[aid] = float(entry_obj.score)
                elif entry_obj.is_favorite:
                    user_scores_by_mal[aid] = 9.0
                elif entry_obj.anime and entry_obj.anime.score:
                    user_scores_by_mal[aid] = float(entry_obj.anime.score)

                if aid not in liked_ids:
                    liked_ids.append(aid)

            # Excluir explícitamente cualquier anime que esté en 'pendiente' o 'dropeado'
            pending_or_dropped_ids = set(
                UserAnimeEntry.objects.filter(
                    user=user,
                    status__in=['pendiente', 'dropeado']
                ).values_list('anime_id', flat=True)
            )
            liked_ids = [aid for aid in liked_ids if aid not in pending_or_dropped_ids]

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
                            sid_int = int(sid)
                            if sid_int not in liked_ids and sid_int not in pending_or_dropped_ids:
                                liked_ids.append(sid_int)
                        except (ValueError, TypeError):
                            pass
        except Exception as e:
            logger.warning(f"Error en build_user_taste_analytics: {e}")

    animes = list(
        Anime.objects.filter(mal_id__in=liked_ids).only('mal_id', 'title', 'score', 'genres', 'tags_data')
    )

    # Contabilizar frecuencia, relevancia (rank) y nota media de cada etiqueta y de cada par
    node_stats: Dict[str, Dict[str, Any]] = {}
    pair_counts: Dict[tuple, Dict[str, Any]] = {}

    def register_token(
        name: str,
        category: str,
        weight_add: float,
        anime_title: str = '',
        score_val: float = 8.2,
        tag_rank: float = 80.0,
    ):
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
                'scores': [],
                'ranks': [],
                'sample_animes': [],
            }
        node_stats[key]['weight'] += weight_add
        node_stats[key]['count'] += 1
        if score_val and score_val > 0:
            node_stats[key]['scores'].append(float(score_val))
        if tag_rank and tag_rank > 0:
            node_stats[key]['ranks'].append(float(tag_rank))
        if anime_title and anime_title not in node_stats[key]['sample_animes'] and len(node_stats[key]['sample_animes']) < 5:
            node_stats[key]['sample_animes'].append(anime_title)

    # 1. Procesar animes vistos/favoritos del usuario priorizando Media Tags de AniList
    for anime in animes:
        tokens_in_anime: List[str] = []
        a_score = user_scores_by_mal.get(
            anime.mal_id,
            float(anime.score) if anime.score else 8.2
        )

        if isinstance(anime.tags_data, list):
            for t in anime.tags_data[:10]:
                if t.get('spoiler'):
                    continue
                t_name = t.get('name', '').strip()
                t_rank = float(t.get('rank') or 70)
                t_cat = (t.get('category') or 'Theme').split('-')[0]
                if t_name and t_name not in tokens_in_anime:
                    register_token(t_name, t_cat, t_rank * 0.18, anime.title, a_score, t_rank)
                    tokens_in_anime.append(t_name)

        if isinstance(anime.genres, list):
            for g in anime.genres[:3]:
                if g not in tokens_in_anime:
                    register_token(g, 'Genre', 12.0, anime.title, a_score, 85.0)
                    tokens_in_anime.append(g)

        # Registrar co-ocurrencia entre pares del mismo anime junto con la nota dada
        unique_tokens = sorted(set(tokens_in_anime))
        for i in range(len(unique_tokens)):
            for j in range(i + 1, len(unique_tokens)):
                pair = (unique_tokens[i], unique_tokens[j])
                if pair not in pair_counts:
                    pair_counts[pair] = {'weight': 0, 'scores': [], 'shared_animes': []}
                pair_counts[pair]['weight'] += 1
                if a_score and a_score > 0:
                    pair_counts[pair]['scores'].append(float(a_score))
                if anime.title not in pair_counts[pair]['shared_animes'] and len(pair_counts[pair]['shared_animes']) < 4:
                    pair_counts[pair]['shared_animes'].append(anime.title)

    # 2. Reforzar con géneros y tropos declarados en el test (resuelve Cold Start)
    declared_tokens: List[str] = []
    for g in fav_genres:
        register_token(g, 'Genre', 16.0, 'Calibrador de Gustos', 8.8, 88.0)
        declared_tokens.append(g)

    for tr in user_tropes:
        for mt in TROPE_TO_ANILIST_TAGS.get(tr, [])[:3]:
            register_token(mt, 'Theme', 15.0, 'Calibrador de Gustos', 8.8, 86.0)
            declared_tokens.append(mt)

    for m in movies:
        m_title = m.get('title') or 'Película favorita'
        m_vote = float(m.get('voteAverage') or m.get('vote_average') or 8.5)
        movie_tokens: List[str] = []
        for mg in m.get('genres', [])[:3]:
            for ag in TMDB_TO_ANIME_GENRES.get(mg, [])[:2]:
                register_token(ag, 'Genre', 10.0, f"TMDb: {m_title}", m_vote, 82.0)
                declared_tokens.append(ag)
                movie_tokens.append(ag)
        m_text = f"{m_title} {m.get('overview', '')} {' '.join(m.get('keywords', []) or [])}".lower()
        for kw, mapped_tags in TMDB_KEYWORD_TO_ANILIST_TAGS.items():
            if kw in m_text:
                for mt in mapped_tags[:3]:
                    register_token(mt, 'Theme', 13.0, f"TMDb: {m_title}", m_vote, 85.0)
                    declared_tokens.append(mt)
                    movie_tokens.append(mt)
        unique_m_tokens = sorted(set(movie_tokens))
        for i in range(len(unique_m_tokens)):
            for j in range(i + 1, len(unique_m_tokens)):
                pair = (unique_m_tokens[i], unique_m_tokens[j])
                if pair not in pair_counts:
                    pair_counts[pair] = {'weight': 0, 'scores': [], 'shared_animes': []}
                pair_counts[pair]['weight'] += 1
                pair_counts[pair]['scores'].append(m_vote)
                ref_label = f"TMDb: {m_title}"
                if ref_label not in pair_counts[pair]['shared_animes'] and len(pair_counts[pair]['shared_animes']) < 4:
                    pair_counts[pair]['shared_animes'].append(ref_label)

    unique_decl = sorted(set(declared_tokens))
    for i in range(len(unique_decl)):
        for j in range(i + 1, len(unique_decl)):
            pair = (unique_decl[i], unique_decl[j])
            if pair not in pair_counts:
                pair_counts[pair] = {'weight': 0, 'scores': [8.6], 'shared_animes': ['Preferencia de Perfil']}
            pair_counts[pair]['weight'] += 1
            if not pair_counts[pair]['scores']:
                pair_counts[pair]['scores'].append(8.6)

    # Calcular mean_score, avg_rank e is_main_tag en cada nodo
    for n in node_stats.values():
        sc_list = n.pop('scores', [])
        rk_list = n.pop('ranks', [])
        n['mean_score'] = round(sum(sc_list) / len(sc_list), 2) if sc_list else 8.2
        n['avg_rank'] = int(round(sum(rk_list) / len(rk_list))) if rk_list else 78
        n['is_main_tag'] = bool(n['avg_rank'] >= 75 or n['category'] == 'Genre')

    # Seleccionar hasta 22 nodos diversos (priorizando Media Tags de AniList + Géneros)
    all_sorted_nodes = sorted(
        node_stats.values(),
        key=lambda x: (x['category'] != 'Genre', x['weight'] * (x['mean_score'] / 8.0)),
        reverse=True,
    )
    top_nodes = all_sorted_nodes[:20]
    allowed_ids = {n['id'] for n in top_nodes}

    # Normalizar pesos de 35 a 100
    max_w = max((n['weight'] for n in top_nodes), default=1.0)
    for n in top_nodes:
        n['normalized_weight'] = int(round(35 + (n['weight'] / max_w) * 65))
        n['weight'] = round(n['weight'], 1)

    # Filtrar aristas entre los nodos seleccionados incluyendo mean_score de la combinación
    links = []
    for (src, tgt), info in sorted(
        pair_counts.items(),
        key=lambda item: (item[1]['weight'], sum(item[1]['scores']) / max(1, len(item[1]['scores']))),
        reverse=True,
    ):
        if src in allowed_ids and tgt in allowed_ids:
            sc_list = info.get('scores', [])
            pair_mean = round(sum(sc_list) / len(sc_list), 2) if sc_list else 8.2
            links.append({
                'source': src,
                'target': tgt,
                'strength': info['weight'],
                'mean_score': pair_mean,
                'shared_animes': info['shared_animes'],
            })

    links = links[:55]

    # Top 8 combinaciones recurrentes con sinergia de Nota Media + Cantidad
    top_combinations = []
    for lk in links[:8]:
        pair_mean = lk.get('mean_score', 8.2)
        affinity_pct = min(99, int(round((pair_mean / 10.0) * 78 + min(21, lk['strength'] * 5))))
        top_combinations.append({
            'pair': f"{lk['source']} + {lk['target']}",
            'source': lk['source'],
            'target': lk['target'],
            'count': lk['strength'],
            'mean_score': pair_mean,
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
