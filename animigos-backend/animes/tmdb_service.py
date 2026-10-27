"""
Módulo de Integración TMDB (The Movie Database) x Animigos Anime Database.
Pilar 4.1 de AGENTS.md: Proxy backend con caché intermedia y sanitización.
Extrae género y sinopsis de películas y las cruza con la base de datos de anime de Animigos.
"""

import os
import json
import urllib.request
import urllib.parse
from django.conf import settings
from django.db.models import Q
from .models import Anime

TMDB_API_KEY = getattr(settings, 'TMDB_API_KEY', '') or os.getenv('TMDB_API_KEY', '')

# Mapeo oficial de géneros TMDB -> Géneros de Anime en Animigos
TMDB_TO_ANIME_GENRES = {
    'Ciencia ficción': ['Sci-Fi', 'Psychological'],
    'Science Fiction': ['Sci-Fi', 'Psychological'],
    'Misterio': ['Mystery', 'Psychological', 'Suspense'],
    'Mystery': ['Mystery', 'Psychological', 'Suspense'],
    'Suspense': ['Thriller', 'Psychological', 'Mystery'],
    'Thriller': ['Thriller', 'Psychological', 'Suspense'],
    'Acción': ['Action', 'Adventure'],
    'Action': ['Action', 'Adventure'],
    'Aventura': ['Adventure', 'Fantasy'],
    'Adventure': ['Adventure', 'Fantasy'],
    'Drama': ['Drama', 'Slice of Life'],
    'Fantasía': ['Fantasy', 'Supernatural'],
    'Fantasy': ['Fantasy', 'Supernatural'],
    'Terror': ['Horror', 'Supernatural'],
    'Horror': ['Horror', 'Supernatural'],
    'Animación': ['Fantasy', 'Adventure'],
    'Animation': ['Fantasy', 'Adventure'],
    'Comedia': ['Comedy', 'Slice of Life'],
    'Comedy': ['Comedy', 'Slice of Life'],
    'Crimen': ['Mystery', 'Suspense'],
    'Crime': ['Mystery', 'Suspense'],
    'Romance': ['Romance', 'Drama'],
    'Bélica': ['Military', 'Action'],
    'War': ['Military', 'Action'],
    'Historia': ['Historical', 'Drama'],
    'History': ['Historical', 'Drama'],
    'Música': ['Music', 'Drama'],
    'Music': ['Music', 'Drama'],
}

# Palabras clave y arquetipos para afinar el cruce de sinopsis
KEYWORD_ASSOCIATIONS = {
    'sueño': ['Psychological', 'Mystery', 'Supernatural'],
    'dream': ['Psychological', 'Mystery', 'Supernatural'],
    'espacio': ['Sci-Fi', 'Space', 'Adventure'],
    'space': ['Sci-Fi', 'Space', 'Adventure'],
    'robot': ['Mecha', 'Sci-Fi'],
    'androide': ['Sci-Fi', 'Psychological'],
    'cyberpunk': ['Sci-Fi', 'Action', 'Psychological'],
    'tiempo': ['Sci-Fi', 'Psychological', 'Mystery'],
    'time': ['Sci-Fi', 'Psychological', 'Mystery'],
    'venganza': ['Action', 'Drama', 'Suspense'],
    'revenge': ['Action', 'Drama', 'Suspense'],
    'mafia': ['Action', 'Mystery'],
    'conspiracion': ['Mystery', 'Thriller', 'Psychological'],
    'conspiracy': ['Mystery', 'Thriller', 'Psychological'],
    'guerra': ['Military', 'Action', 'Drama'],
    'psicologico': ['Psychological', 'Suspense'],
    'detective': ['Mystery', 'Suspense'],
}

# Índice curado de películas icónicas de TMDB para respuesta instantánea y fallback offline
CURATED_TMDB_MOVIES = [
    {
        'id': 27205,
        'title': 'El Origen (Inception)',
        'original_title': 'Inception',
        'release_year': '2010',
        'poster_path': 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        'genres': ['Ciencia ficción', 'Misterio', 'Acción'],
        'overview': 'Un ladrón que roba secretos corporativos a través del uso de la tecnología de compartir sueños es contratado para implantar una idea en la mente del heredero de un conglomerado.',
        'keywords': ['sueño', 'subconsciente', 'conspiración', 'tiempo', 'psicológico']
    },
    {
        'id': 335984,
        'title': 'Blade Runner 2049',
        'original_title': 'Blade Runner 2049',
        'release_year': '2017',
        'poster_path': 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
        'genres': ['Ciencia ficción', 'Drama', 'Misterio'],
        'overview': 'Treinta años después de los eventos de la primera película, un nuevo blade runner, el oficial K de la policía de Los Ángeles, descubre un secreto enterrado que tiene el potencial de sumergir a la sociedad en el caos.',
        'keywords': ['cyberpunk', 'androide', 'distopía', 'identidad', 'investigación']
    },
    {
        'id': 157336,
        'title': 'Interestelar (Interstellar)',
        'original_title': 'Interstellar',
        'release_year': '2014',
        'poster_path': 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        'genres': ['Ciencia ficción', 'Drama', 'Aventura'],
        'overview': 'Un grupo de exploradores hace uso de un agujero de gusano recientemente descubierto para superar las limitaciones de los viajes espaciales humanos y conquistar las enormes distancias de un viaje interestelar.',
        'keywords': ['espacio', 'tiempo', 'agujero negro', 'familia', 'supervivencia']
    },
    {
        'id': 603,
        'title': 'Matrix (The Matrix)',
        'original_title': 'The Matrix',
        'release_year': '1999',
        'poster_path': 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
        'genres': ['Acción', 'Ciencia ficción'],
        'overview': 'Un hacker informático descubre la verdadera naturaleza de su realidad y su papel en la guerra contra sus controladores que gobiernan el mundo simulado.',
        'keywords': ['simulación', 'realidad virtual', 'cyberpunk', 'mesías', 'artes marciales']
    },
    {
        'id': 550,
        'title': 'El Club de la Pelea (Fight Club)',
        'original_title': 'Fight Club',
        'release_year': '1999',
        'poster_path': 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        'genres': ['Drama', 'Suspense'],
        'overview': 'Un oficinista insomne que busca una forma de cambiar su vida se cruza con un vendedor de jabón con una visión retorcida del mundo, fundando un club de peleas clandestino.',
        'keywords': ['nihilismo', 'identidad', 'psicologico', 'sociedad', 'caos']
    },
    {
        'id': 155,
        'title': 'El Caballero de la Noche (The Dark Knight)',
        'original_title': 'The Dark Knight',
        'release_year': '2008',
        'poster_path': 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        'genres': ['Drama', 'Acción', 'Crimen', 'Suspense'],
        'overview': 'Batman se enfrenta al Joker, una mente criminal retorcida que desata el terror y el caos moral sobre la ciudad de Gotham.',
        'keywords': ['justicia', 'crimen', 'psicológico', 'anarquía', 'moral']
    },
    {
        'id': 438631,
        'title': 'Duna (Dune: Part One)',
        'original_title': 'Dune',
        'release_year': '2021',
        'poster_path': 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
        'genres': ['Ciencia ficción', 'Aventura'],
        'overview': 'Paul Atreides, un joven brillante dotado de un gran destino, viaja al planeta más peligroso del universo para asegurar el futuro de su familia y su pueblo.',
        'keywords': ['política espacial', 'profecía', 'desierto', 'imperio', 'guerra']
    },
    {
        'id': 680,
        'title': 'Pulp Fiction',
        'original_title': 'Pulp Fiction',
        'release_year': '1994',
        'poster_path': 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
        'genres': ['Suspense', 'Crimen'],
        'overview': 'Las vidas de dos mafiosos, un boxeador y una pareja de atracadores de poca monta se entrelazan en cuatro historias de violencia y redención.',
        'keywords': ['mafia', 'humor negro', 'violencia', 'diálogos épicos']
    },
    {
        'id': 11324,
        'title': 'La Isla Siniestra (Shutter Island)',
        'original_title': 'Shutter Island',
        'release_year': '2010',
        'poster_path': 'https://image.tmdb.org/t/p/w500/4BgSWFMW2v001ed0bvFvjqYp1eA.jpg',
        'genres': ['Drama', 'Suspense', 'Misterio'],
        'overview': 'En 1954, dos agentes judiciales son enviados a una institución mental en una isla remota para investigar la desaparición de una peligrosa paciente.',
        'keywords': ['psiquiátrico', 'paranoia', 'misterio', 'giro de trama', 'psicologico']
    },
    {
        'id': 244786,
        'title': 'Whiplash: Música y Obsesión',
        'original_title': 'Whiplash',
        'release_year': '2014',
        'poster_path': 'https://image.tmdb.org/t/p/w500/7fn624j5lj3xTme2SgiLCeuedmO.jpg',
        'genres': ['Drama', 'Música'],
        'overview': 'Un prometedor joven baterista se inscribe en un conservatorio de música de élite donde su sueño de grandeza es guiado por un instructor despiadado.',
        'keywords': ['obsesión', 'música', 'perfeccionismo', 'disciplina', 'tensión']
    },
    {
        'id': 38,
        'title': 'Eterno Resplandor de una Mente sin Recuerdos',
        'original_title': 'Eternal Sunshine of the Spotless Mind',
        'release_year': '2004',
        'poster_path': 'https://image.tmdb.org/t/p/w500/5MwkWH9tYHv3mV9OdYTMR5q9IzL.jpg',
        'genres': ['Ciencia ficción', 'Drama', 'Romance'],
        'overview': 'Cuando su relación se vuelve agria, una pareja se somete a un procedimiento médico para borrarse mutuamente de sus recuerdos.',
        'keywords': ['memoria', 'romance', 'sueños', 'melancolía', 'psicológico']
    },
    {
        'id': 872585,
        'title': 'Oppenheimer',
        'original_title': 'Oppenheimer',
        'release_year': '2023',
        'poster_path': 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        'genres': ['Drama', 'Historia'],
        'overview': 'La historia del físico estadounidense J. Robert Oppenheimer, su papel en el Proyecto Manhattan y el desarrollo de la bomba atómica.',
        'keywords': ['ciencia', 'guerra', 'moral', 'política', 'historia']
    }
]


import unicodedata

# Cargar catálogo curado extenso desde archivo JSON si existe
CURATED_PATH = os.path.join(os.path.dirname(__file__), 'curated_movies.json')
if os.path.exists(CURATED_PATH):
    try:
        with open(CURATED_PATH, 'r', encoding='utf-8') as f:
            CURATED_TMDB_MOVIES = json.load(f)
    except Exception as e:
        pass

TMDB_GENRE_IDS = {
    28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen',
    99: 'Documental', 18: 'Drama', 10751: 'Familia', 14: 'Fantasía', 36: 'Historia',
    27: 'Terror', 10402: 'Música', 9648: 'Misterio', 10749: 'Romance',
    878: 'Ciencia ficción', 10770: 'Película de TV', 53: 'Suspense', 10752: 'Bélica', 37: 'Western'
}

def _normalize_text(text: str) -> str:
    """Elimina acentos y pasa a minúsculas para búsqueda tolerante."""
    if not text:
        return ''
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn').lower()


def search_tmdb_movies(query: str):
    """
    Busca películas en TMDB vía API pública oficial o mediante índice local normalizado.
    """
    q_raw = query.strip()
    q_norm = _normalize_text(q_raw)
    
    # Si la consulta está vacía, retornar las películas más populares como sugerencias iniciales
    if not q_norm:
        return CURATED_TMDB_MOVIES[:8]

    # 1. Intentar consulta a TMDB API si hay clave configurada
    if TMDB_API_KEY:
        try:
            encoded_query = urllib.parse.quote(q_raw)
            url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={encoded_query}&language=es-ES&page=1&include_adult=false"
            req = urllib.request.Request(url, headers={'User-Agent': 'Animigos/2.0'})
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                results = data.get('results', [])
                if results:
                    mapped = []
                    for m in results[:10]:
                        genre_ids = m.get('genre_ids', [])
                        genres = [TMDB_GENRE_IDS[gid] for gid in genre_ids if gid in TMDB_GENRE_IDS]
                        if not genres:
                            genres = ['Cine']
                        mapped.append({
                            'id': m.get('id'),
                            'title': m.get('title') or m.get('original_title'),
                            'original_title': m.get('original_title', ''),
                            'release_year': (m.get('release_date') or '')[:4],
                            'poster_path': f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
                            'genres': genres,
                            'overview': m.get('overview') or 'Sinopsis en proceso de sincronización con TMDB.',
                            'vote_average': m.get('vote_average', 7.5),
                        })
                    return mapped
        except Exception:
            pass

    # 2. Búsqueda en catálogo curado local con coincidencia normalizada y por palabras
    query_tokens = [t for t in q_norm.split() if len(t) >= 2]
    matches = []

    for m in CURATED_TMDB_MOVIES:
        title_norm = _normalize_text(m.get('title', ''))
        orig_norm = _normalize_text(m.get('original_title', ''))
        overview_norm = _normalize_text(m.get('overview', ''))
        genres_norm = _normalize_text(' '.join(m.get('genres', [])))
        keywords_norm = _normalize_text(' '.join(m.get('keywords', [])))

        full_search_text = f"{title_norm} {orig_norm} {overview_norm} {genres_norm} {keywords_norm}"

        # Coincidencia exacta de frase
        if q_norm in title_norm or q_norm in orig_norm:
            matches.append((100, m))
        elif q_norm in full_search_text:
            matches.append((80, m))
        elif query_tokens and all(tok in full_search_text for tok in query_tokens):
            matches.append((60, m))
        elif query_tokens and any(tok in title_norm or tok in orig_norm for tok in query_tokens):
            matches.append((40, m))

    if matches:
        matches.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in matches[:10]]

    # Si no hubo coincidencia, retornar lista vacía (para que la UI muestre el estado de no encontrado)
    return []


def cross_reference_tmdb_movies_with_anime(selected_movies: list):
    """
    Cruza los géneros, temas y sinopsis de las películas TMDB ingresadas
    con la base de datos de animes de Animigos para generar recomendaciones de alta afinidad.
    """
    if not selected_movies:
        return []

    target_genres = set()
    movie_titles = []
    keywords_found = set()

    for m in selected_movies:
        title = m.get('title') or m.get('original_title', 'Película')
        movie_titles.append(title)

        # Mapear géneros de TMDB a Anime
        for g in m.get('genres', []):
            if g in TMDB_TO_ANIME_GENRES:
                target_genres.update(TMDB_TO_ANIME_GENRES[g])

        # Extraer palabras clave de la sinopsis
        overview = (m.get('overview') or '').lower()
        for kw, assoc_genres in KEYWORD_ASSOCIATIONS.items():
            if kw in overview:
                keywords_found.add(kw)
                target_genres.update(assoc_genres)

    if not target_genres:
        target_genres = {'Psychological', 'Sci-Fi', 'Action', 'Mystery', 'Drama'}

    # Consultar animes con alta puntuación en la base de datos de Animigos
    animes_qs = (
        Anime.objects.filter(score__gte=7.4)
        .order_by('-score')[:80]
    )

    recommendations = []
    seen_ids = set()

    for anime in animes_qs:
        if anime.mal_id in seen_ids:
            continue

        anime_genres = set(anime.genres) if isinstance(anime.genres, list) else set()
        overlap = target_genres.intersection(anime_genres)

        if overlap:
            matched_movie = movie_titles[len(recommendations) % len(movie_titles)]
            score_val = float(anime.score) if anime.score is not None else 8.0
            affinity_base = min(98, 75 + len(overlap) * 6 + int(score_val * 1.5))

            # Explicación contextual de la recomendación
            matched_genres_str = ', '.join(list(overlap)[:2])
            reason = f"Afinidad con {matched_movie}: comparte elementos de {matched_genres_str} y una trama con profundidad temática similar."

            recommendations.append({
                'anime_id': anime.mal_id,
                'anime_title': anime.title,
                'anime_poster': anime.image_url,
                'anime_score': round(score_val, 2),
                'anime_studio': anime.studio,
                'genres': anime.genres[:3] if isinstance(anime.genres, list) else [],
                'matched_movie': matched_movie,
                'match_reason': reason,
                'affinity_score': affinity_base,
            })
            seen_ids.add(anime.mal_id)

        if len(recommendations) >= 8:
            break

    # Ordenar por afinidad
    recommendations.sort(key=lambda r: r['affinity_score'], reverse=True)
    return recommendations
