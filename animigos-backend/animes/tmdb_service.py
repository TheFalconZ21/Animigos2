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
from .models import Anime, ExternalReferenceMedia

TMDB_API_KEY = getattr(settings, 'TMDB_API_KEY', '') or os.getenv('TMDB_API_KEY', '')

# Mapeo oficial de géneros TMDB -> Géneros de Anime en Animigos
TMDB_TO_ANIME_GENRES = {
    'Ciencia ficción': ['Sci-Fi', 'Psychological'],
    'Science Fiction': ['Sci-Fi', 'Psychological'],
    'Sci-Fi & Fantasy': ['Sci-Fi', 'Fantasy', 'Supernatural'],
    'Misterio': ['Mystery', 'Psychological', 'Suspense'],
    'Mystery': ['Mystery', 'Psychological', 'Suspense'],
    'Suspense': ['Thriller', 'Psychological', 'Mystery'],
    'Thriller': ['Thriller', 'Psychological', 'Suspense'],
    'Acción': ['Action', 'Adventure'],
    'Action': ['Action', 'Adventure'],
    'Action & Adventure': ['Action', 'Adventure', 'Fantasy'],
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
    'Crime': ['Mystery', 'Suspense', 'Psychological'],
    'Romance': ['Romance', 'Drama'],
    'Bélica': ['Military', 'Action'],
    'War': ['Military', 'Action'],
    'War & Politics': ['Military', 'Historical', 'Drama'],
    'Historia': ['Historical', 'Drama'],
    'History': ['Historical', 'Drama'],
    'Música': ['Music', 'Drama'],
    'Music': ['Music', 'Drama'],
    'Western': ['Action', 'Adventure', 'Historical'],
    'Soap': ['Drama', 'Romance', 'Slice of Life'],
    'Family': ['Kids', 'Slice of Life', 'Fantasy'],
    'Kids': ['Kids', 'Slice of Life', 'Fantasy'],
    'Documentary': ['Historical', 'Drama'],
    'Documental': ['Historical', 'Drama'],
    'Reality': ['Comedy', 'Slice of Life'],
    'Talk': ['Slice of Life'],
}

# Palabras clave y arquetipos de Películas y Series de TV para afinar el cruce temático
KEYWORD_ASSOCIATIONS = {
    # Ciencia ficción, Espacio y Cyberpunk
    'sueño': ['Psychological', 'Mystery', 'Supernatural'],
    'dream': ['Psychological', 'Mystery', 'Supernatural'],
    'espacio': ['Sci-Fi', 'Space', 'Adventure'],
    'space': ['Sci-Fi', 'Space', 'Adventure'],
    'robot': ['Mecha', 'Sci-Fi'],
    'androide': ['Sci-Fi', 'Psychological'],
    'android': ['Sci-Fi', 'Psychological'],
    'cyberpunk': ['Sci-Fi', 'Action', 'Psychological'],
    'tiempo': ['Sci-Fi', 'Psychological', 'Mystery'],
    'time': ['Sci-Fi', 'Psychological', 'Mystery'],
    'time travel': ['Sci-Fi', 'Psychological', 'Mystery'],
    'viaje en el tiempo': ['Sci-Fi', 'Psychological', 'Mystery'],
    'dystopia': ['Sci-Fi', 'Psychological', 'Drama'],
    'distopía': ['Sci-Fi', 'Psychological', 'Drama'],
    'distopia': ['Sci-Fi', 'Psychological', 'Drama'],
    'artificial intelligence': ['Sci-Fi', 'Psychological'],
    'inteligencia artificial': ['Sci-Fi', 'Psychological'],
    'alien': ['Sci-Fi', 'Action', 'Horror'],
    'extraterrestre': ['Sci-Fi', 'Action', 'Horror'],
    'multiverso': ['Sci-Fi', 'Supernatural', 'Action'],
    'multiverse': ['Sci-Fi', 'Supernatural', 'Action'],
    'dimension': ['Sci-Fi', 'Mystery'],
    'dimensión': ['Sci-Fi', 'Mystery'],

    # Crimen, Mafia, Drogas y Thriller Policial (ej: Breaking Bad, Peaky Blinders, The Wire, Narcos)
    'mafia': ['Action', 'Mystery', 'Suspense'],
    'cartel': ['Action', 'Mystery', 'Drama', 'Suspense'],
    'cártel': ['Action', 'Mystery', 'Drama', 'Suspense'],
    'droga': ['Drama', 'Mystery', 'Suspense'],
    'drug': ['Drama', 'Mystery', 'Suspense'],
    'meth': ['Drama', 'Mystery', 'Suspense'],
    'metanfetamina': ['Drama', 'Mystery', 'Suspense'],
    'gang': ['Action', 'Drama', 'Suspense'],
    'gangster': ['Action', 'Drama', 'Suspense'],
    'pandilla': ['Action', 'Drama', 'Suspense'],
    'corrupcion': ['Mystery', 'Suspense', 'Drama'],
    'corruption': ['Mystery', 'Suspense', 'Drama'],
    'police': ['Mystery', 'Suspense', 'Action'],
    'policia': ['Mystery', 'Suspense', 'Action'],
    'detective': ['Mystery', 'Suspense', 'Psychological'],
    'investigacion': ['Mystery', 'Suspense', 'Psychological'],
    'investigation': ['Mystery', 'Suspense', 'Psychological'],
    'asesino': ['Mystery', 'Suspense', 'Psychological'],
    'serial killer': ['Mystery', 'Suspense', 'Psychological'],
    'asesinato': ['Mystery', 'Suspense'],
    'murder': ['Mystery', 'Suspense'],
    'venganza': ['Action', 'Drama', 'Suspense'],
    'revenge': ['Action', 'Drama', 'Suspense'],
    'conspiracion': ['Mystery', 'Thriller', 'Psychological'],
    'conspiracy': ['Mystery', 'Thriller', 'Psychological'],
    'espionaje': ['Mystery', 'Action', 'Suspense'],
    'espionage': ['Mystery', 'Action', 'Suspense'],
    'spy': ['Action', 'Mystery', 'Suspense'],
    'espía': ['Action', 'Mystery', 'Suspense'],

    # Fantasía Épica, Reinos, Dinastías y Política (ej: Game of Thrones, House of the Dragon, Vikings, The Witcher)
    'kingdom': ['Fantasy', 'Adventure', 'Action', 'Historical'],
    'reino': ['Fantasy', 'Adventure', 'Action', 'Historical'],
    'throne': ['Fantasy', 'Drama', 'Historical', 'Action'],
    'trono': ['Fantasy', 'Drama', 'Historical', 'Action'],
    'medieval': ['Fantasy', 'Historical', 'Action'],
    'dragon': ['Fantasy', 'Adventure', 'Action'],
    'dragón': ['Fantasy', 'Adventure', 'Action'],
    'sword': ['Action', 'Adventure', 'Fantasy'],
    'espada': ['Action', 'Adventure', 'Fantasy'],
    'viking': ['Action', 'Historical', 'Adventure'],
    'vikingo': ['Action', 'Historical', 'Adventure'],
    'empire': ['Historical', 'Action', 'Drama', 'Military'],
    'imperio': ['Historical', 'Action', 'Drama', 'Military'],
    'emperor': ['Historical', 'Drama', 'Fantasy'],
    'emperador': ['Historical', 'Drama', 'Fantasy'],
    'dynasty': ['Historical', 'Drama', 'Action'],
    'dinastia': ['Historical', 'Drama', 'Action'],
    'guerra': ['Military', 'Action', 'Drama'],
    'war': ['Military', 'Action', 'Drama'],
    'knight': ['Action', 'Fantasy', 'Historical'],
    'caballero': ['Action', 'Fantasy', 'Historical'],

    # Misterio, Sobrenatural, Portales y Desapariciones (ej: Dark, Stranger Things, Lost)
    'missing': ['Mystery', 'Suspense', 'Drama'],
    'desaparecido': ['Mystery', 'Suspense', 'Drama'],
    'supernatural': ['Supernatural', 'Mystery', 'Fantasy'],
    'sobrenatural': ['Supernatural', 'Mystery', 'Fantasy'],
    'paranormal': ['Supernatural', 'Horror', 'Mystery'],
    'monster': ['Supernatural', 'Horror', 'Action'],
    'monstruo': ['Supernatural', 'Horror', 'Action'],
    'curse': ['Supernatural', 'Horror', 'Fantasy'],
    'maldicion': ['Supernatural', 'Horror', 'Fantasy'],
    'demon': ['Supernatural', 'Fantasy', 'Action'],
    'demonio': ['Supernatural', 'Fantasy', 'Action'],
    'magic': ['Fantasy', 'Supernatural'],
    'magia': ['Fantasy', 'Supernatural'],
    'witch': ['Fantasy', 'Supernatural', 'Mystery'],
    'bruja': ['Fantasy', 'Supernatural', 'Mystery'],

    # Supervivencia, Apocalipsis y Zombis (ej: The Walking Dead, The Last of Us)
    'zombie': ['Horror', 'Supernatural', 'Action'],
    'zombi': ['Horror', 'Supernatural', 'Action'],
    'apocalypse': ['Sci-Fi', 'Horror', 'Drama', 'Action'],
    'apocalipsis': ['Sci-Fi', 'Horror', 'Drama', 'Action'],
    'post-apocalyptic': ['Sci-Fi', 'Drama', 'Action'],
    'postapocalíptico': ['Sci-Fi', 'Drama', 'Action'],
    'survival': ['Action', 'Drama', 'Suspense'],
    'supervivencia': ['Action', 'Drama', 'Suspense'],
    'virus': ['Sci-Fi', 'Mystery', 'Drama'],
    'infection': ['Horror', 'Sci-Fi', 'Drama'],
    'infeccion': ['Horror', 'Sci-Fi', 'Drama'],

    # Superhéroes y Vigilantes (ej: Spider-Man, The Boys, Daredevil, Invincible)
    'superhero': ['Action', 'Sci-Fi', 'Supernatural'],
    'superheroe': ['Action', 'Sci-Fi', 'Supernatural'],
    'superheroes': ['Action', 'Sci-Fi', 'Supernatural'],
    'superhéroes': ['Action', 'Sci-Fi', 'Supernatural'],
    'spiderman': ['Action', 'Sci-Fi', 'Supernatural', 'Comedy'],
    'spider-man': ['Action', 'Sci-Fi', 'Supernatural', 'Comedy'],
    'spider': ['Action', 'Sci-Fi', 'Supernatural'],
    'marvel': ['Action', 'Sci-Fi', 'Supernatural'],
    'avengers': ['Action', 'Sci-Fi', 'Supernatural'],
    'vigilante': ['Action', 'Suspense', 'Drama'],
    'superpower': ['Action', 'Supernatural'],
    'superpoder': ['Action', 'Supernatural'],
    'mutant': ['Action', 'Sci-Fi', 'Supernatural'],
    'mutante': ['Action', 'Sci-Fi', 'Supernatural'],

    # Psicológico, Juegos Mentales y Filosofía (ej: Mindhunter, Hannibal, Dexter)
    'psicologico': ['Psychological', 'Suspense', 'Drama'],
    'psychological': ['Psychological', 'Suspense', 'Drama'],
    'mind game': ['Psychological', 'Suspense', 'Mystery'],
    'juegos mentales': ['Psychological', 'Suspense', 'Mystery'],
    'strategy': ['Psychological', 'Action', 'Military'],
    'estrategia': ['Psychological', 'Action', 'Military'],
    'chess': ['Psychological', 'Drama'],
    'ajedrez': ['Psychological', 'Drama'],
    'paranoia': ['Psychological', 'Suspense'],
    'identidad': ['Psychological', 'Drama'],
    'identity': ['Psychological', 'Drama'],
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


def search_tmdb_movies(query: str, media_type: str = 'all', limit: int = 15):
    """
    Busca películas y series en la base de datos local ExternalReferenceMedia (72k+ títulos indexados),
    con soporte de filtro por media_type ('all', 'movie', 'tv') y ordenamiento por relevancia y votos.
    Pilar 2.1 (Zero Trust) y Pilar 4.1 (Proxy y Caché Intermedia en Backend).
    """
    q_raw = query.strip()
    limit = max(1, min(limit or 15, 30))

    # 1. Búsqueda principal en base de datos PostgreSQL local (ExternalReferenceMedia)
    try:
        qs = ExternalReferenceMedia.objects.all()
        if media_type in ('movie', 'tv'):
            qs = qs.filter(media_type=media_type)

        if not q_raw:
            # Sugerencias principales por defecto (obras más votadas y populares)
            top_records = qs.order_by('-vote_count', '-popularity')[:limit]
            if top_records.exists():
                return [
                    {
                        'id': m.tmdb_id,
                        'media_type': m.media_type,
                        'title': m.title,
                        'original_title': m.original_title,
                        'release_year': m.release_year,
                        'poster_path': m.poster_path,
                        'backdrop_path': m.backdrop_path,
                        'genres': m.genres if isinstance(m.genres, list) else [],
                        'overview': m.overview,
                        'vote_average': float(m.vote_average) if m.vote_average is not None else None,
                        'vote_count': m.vote_count,
                        'number_of_seasons': m.number_of_seasons,
                        'number_of_episodes': m.number_of_episodes,
                    }
                    for m in top_records
                ]
        else:
            # Búsqueda por texto en título u original_title
            words = [w for w in q_raw.split() if len(w) >= 2]
            name_q = Q(title__icontains=q_raw) | Q(original_title__icontains=q_raw)
            if words:
                word_sub_q = Q()
                for w in words:
                    word_sub_q &= (Q(title__icontains=w) | Q(original_title__icontains=w))
                name_q |= word_sub_q

            db_matches = qs.filter(name_q).order_by('-vote_count', '-popularity')[:limit]
            if db_matches.exists():
                return [
                    {
                        'id': m.tmdb_id,
                        'media_type': m.media_type,
                        'title': m.title,
                        'original_title': m.original_title,
                        'release_year': m.release_year,
                        'poster_path': m.poster_path,
                        'backdrop_path': m.backdrop_path,
                        'genres': m.genres if isinstance(m.genres, list) else [],
                        'overview': m.overview,
                        'vote_average': float(m.vote_average) if m.vote_average is not None else None,
                        'vote_count': m.vote_count,
                        'number_of_seasons': m.number_of_seasons,
                        'number_of_episodes': m.number_of_episodes,
                    }
                    for m in db_matches
                ]
    except Exception as e:
        # Si la tabla aún no estuviese disponible, fallback controlado
        pass

    q_norm = _normalize_text(q_raw)
    
    # Si la consulta está vacía y DB no devolvió nada, fallback a catálogo curado
    if not q_norm:
        return CURATED_TMDB_MOVIES[:8]

    # 2. Fallback a TMDB API externa si hay clave configurada
    if TMDB_API_KEY:
        try:
            encoded_query = urllib.parse.quote(q_raw)
            endpoint = 'search/tv' if media_type == 'tv' else ('search/movie' if media_type == 'movie' else 'search/multi')
            url = f"https://api.themoviedb.org/3/{endpoint}?api_key={TMDB_API_KEY}&query={encoded_query}&language=es-ES&page=1&include_adult=false"
            req = urllib.request.Request(url, headers={'User-Agent': 'Animigos/2.0'})
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                results = data.get('results', [])
                if results:
                    mapped = []
                    for m in results[:limit]:
                        m_type = m.get('media_type') or ('tv' if 'first_air_date' in m else 'movie')
                        if media_type in ('movie', 'tv') and m_type != media_type:
                            continue
                        genre_ids = m.get('genre_ids', [])
                        genres = [TMDB_GENRE_IDS[gid] for gid in genre_ids if gid in TMDB_GENRE_IDS]
                        if not genres:
                            genres = ['Cine'] if m_type == 'movie' else ['Serie']
                        date_str = m.get('release_date') or m.get('first_air_date') or ''
                        mapped.append({
                            'id': m.get('id'),
                            'media_type': m_type,
                            'title': m.get('title') or m.get('name') or m.get('original_title') or m.get('original_name'),
                            'original_title': m.get('original_title') or m.get('original_name', ''),
                            'release_year': date_str[:4],
                            'poster_path': f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
                            'genres': genres,
                            'overview': m.get('overview') or 'Sinopsis en proceso de sincronización con TMDB.',
                            'vote_average': m.get('vote_average', 7.5),
                        })
                    if mapped:
                        return mapped
        except Exception:
            pass

    # 3. Búsqueda en catálogo curado estático de emergencia
    query_tokens = [t for t in q_norm.split() if len(t) >= 2]
    matches = []

    for m in CURATED_TMDB_MOVIES:
        title_norm = _normalize_text(m.get('title', ''))
        orig_norm = _normalize_text(m.get('original_title', ''))
        overview_norm = _normalize_text(m.get('overview', ''))
        genres_norm = _normalize_text(' '.join(m.get('genres', [])))
        keywords_norm = _normalize_text(' '.join(m.get('keywords', [])))

        full_search_text = f"{title_norm} {orig_norm} {overview_norm} {genres_norm} {keywords_norm}"

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
        return [m for _, m in matches[:limit]]

    return []


def cross_reference_tmdb_movies_with_anime(selected_movies: list):
    """
    Cruza los géneros, temas y sinopsis de las películas y series de TMDB ingresadas
    con la base de datos de animes de Animigos para generar recomendaciones de alta afinidad.
    Pilar 4.1 de AGENTS.md: Proxy y enriquecimiento con base indexada local.
    """
    if not selected_movies:
        return []

    target_genres = set()
    movie_titles = []
    keywords_found = set()

    for m in selected_movies:
        title = m.get('title') or m.get('original_title') or 'Obra'
        movie_titles.append(title)

        genres = list(m.get('genres') or [])
        overview = str(m.get('overview') or '')

        # Si faltan metadatos, autohidratar desde ExternalReferenceMedia
        if not genres or len(overview) < 20:
            m_id = m.get('id')
            ext_item = None
            if m_id:
                ext_item = ExternalReferenceMedia.objects.filter(tmdb_id=m_id).first()
            if not ext_item and title:
                ext_item = ExternalReferenceMedia.objects.filter(
                    Q(title__iexact=title) | Q(original_title__iexact=title)
                ).first()
            if ext_item:
                if not genres and ext_item.genres:
                    genres = ext_item.genres
                if not overview and ext_item.overview:
                    overview = ext_item.overview

        # Mapear géneros de TMDB a Anime
        for g in genres:
            if g in TMDB_TO_ANIME_GENRES:
                target_genres.update(TMDB_TO_ANIME_GENRES[g])

        # Extraer palabras clave de la sinopsis y título
        search_blob = f"{overview} {title}".lower()
        for kw, assoc_genres in KEYWORD_ASSOCIATIONS.items():
            if kw in search_blob:
                keywords_found.add(kw)
                target_genres.update(assoc_genres)

    if not target_genres:
        target_genres = {'Psychological', 'Sci-Fi', 'Action', 'Mystery', 'Drama'}

    # Consultar animes de alta puntuación en la base de datos de Animigos
    # Excluyendo secuelas automáticas para que las recomendaciones sean obras maestras introductorias
    animes_qs = (
        Anime.objects.filter(score__gte=7.4, scored_by__gte=500)
        .exclude(tags_cache__contains='|_is_sequel_|')
        .order_by('-score')[:100]
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

    recommendations.sort(key=lambda r: r['affinity_score'], reverse=True)
    return recommendations
