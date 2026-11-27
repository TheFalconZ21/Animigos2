"""
Proxy de fuentes externas para el Tablón (Pilar 4.1 de la Directiva de Arquitectura).

El navegador nunca consulta estas fuentes directamente: el backend las pide,
las limpia y las guarda en caché (ver los endpoints en animes/views.py y core/views.py).

- Horario de emisión: API GraphQL pública de AniList (airingSchedules).
- Próximos lanzamientos: AniList (anime NOT_YET_RELEASED con fecha confirmada).
- Noticias: Anmo Sugoi y Ramen Para Dos (API pública de WordPress, con el RSS como respaldo).

Solo usa la librería estándar (urllib, xml.etree, html) para no agregar dependencias.
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import TypedDict
from xml.etree import ElementTree

TIMEOUT_SEGUNDOS = 5
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

# ---------------------------------------------------------------------------
# Horario de emisión (AniList)
# ---------------------------------------------------------------------------

ANILIST_URL = 'https://graphql.anilist.co'
POPULARIDAD_MINIMA = 4000  # Evita llenar el calendario de títulos muy minoritarios
FORMATOS_VALIDOS = {'TV', 'TV_SHORT', 'ONA'}
MAX_PAGINAS = 3

CONSULTA_HORARIO = """
query ($desde: Int, $hasta: Int, $pagina: Int) {
  Page(page: $pagina, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $desde, airingAt_lesser: $hasta, sort: TIME) {
      id
      airingAt
      episode
      media {
        id
        idMal
        isAdult
        format
        countryOfOrigin
        popularity
        episodes
        title { romaji english }
        coverImage { large }
      }
    }
  }
}
"""


class Emision(TypedDict):
    id: int
    anilist_id: int
    mal_id: int | None
    title: str
    title_romaji: str
    image_url: str
    episode: int
    total_episodes: int | None
    airing_at: int  # Marca de tiempo Unix (UTC): el frontend la muestra en la hora local
    popularity: int


def _post_json(url: str, cuerpo: dict, reintentos: int = 2) -> dict:
    datos = json.dumps(cuerpo).encode('utf-8')
    peticion = urllib.request.Request(
        url,
        data=datos,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': USER_AGENT},
        method='POST',
    )
    for intento in range(reintentos + 1):
        try:
            with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
                return json.loads(respuesta.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429 and intento < reintentos:
                try:
                    retry_after = int(e.headers.get('Retry-After', 2) or 2)
                except (ValueError, TypeError):
                    retry_after = 2
                time.sleep(max(1, retry_after) + 0.5)
                continue
            raise


def obtener_horario_semanal(dias: int = 7) -> list[Emision]:
    """Episodios japoneses (no adultos) desde ayer hasta `dias` días después.
    Se pide un día extra hacia atrás porque el backend no conoce la zona horaria del
    usuario: así "hoy" llega completo y el frontend agrupa por día local."""
    ahora = int(time.time())
    desde = ahora - 86400
    hasta = ahora + dias * 86400
    emisiones: list[Emision] = []

    for pagina in range(1, MAX_PAGINAS + 1):
        respuesta = _post_json(ANILIST_URL, {
            'query': CONSULTA_HORARIO,
            'variables': {'desde': desde, 'hasta': hasta, 'pagina': pagina},
        })
        page = respuesta['data']['Page']
        for item in page['airingSchedules']:
            media = item['media']
            if (
                media['isAdult']
                or media['countryOfOrigin'] != 'JP'
                or media['format'] not in FORMATOS_VALIDOS
                or (media['popularity'] or 0) < POPULARIDAD_MINIMA
            ):
                continue
            titulos = media['title']
            emisiones.append({
                'id': item['id'],
                'anilist_id': media['id'],
                'mal_id': media['idMal'],
                'title': titulos['english'] or titulos['romaji'],
                'title_romaji': titulos['romaji'],
                'image_url': media['coverImage']['large'],
                'episode': item['episode'],
                'total_episodes': media['episodes'],
                'airing_at': item['airingAt'],
                'popularity': media['popularity'] or 0,
            })
        if not page['pageInfo']['hasNextPage']:
            break
        time.sleep(0.4)  # AniList limita a ~90 peticiones por minuto

    return emisiones


def obtener_estado_emision_animes(mal_ids: list[int]) -> dict[int, dict]:
    """
    Consulta AniList (con caché en memoria / Redis) para obtener el último episodio emitido
    y el horario del próximo episodio para una lista de IDs de MyAnimeList.
    Devuelve: {mal_id: {'latest_episode': int, 'next_airing_at': int | None, 'next_episode': int | None, 'total_episodes': int | None, 'status': str}}
    """
    if not mal_ids:
        return {}

    from django.core.cache import cache
    resultados: dict[int, dict] = {}
    faltantes: list[int] = []

    # 1. Revisar caché para cada ID
    for mid in mal_ids:
        cached = cache.get(f'airing_info_{mid}')
        if cached:
            resultados[mid] = cached
        else:
            faltantes.append(mid)

    if not faltantes:
        return resultados

    consulta = """
    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(idMal_in: $ids, type: ANIME) {
          id
          idMal
          status
          episodes
          nextAiringEpisode {
            episode
            airingAt
          }
          airingSchedule(notYetAired: false, perPage: 1) {
            nodes {
              episode
              airingAt
            }
          }
        }
      }
    }
    """
    # Procesar en lotes de 50
    for i in range(0, len(faltantes), 50):
        lote = faltantes[i:i + 50]
        try:
            resp = _post_json(ANILIST_URL, {
                'query': consulta,
                'variables': {'ids': lote}
            })
            items = resp.get('data', {}).get('Page', {}).get('media', [])
            encontrados_lote = set()
            for m in items:
                mid = m.get('idMal')
                if not mid:
                    continue
                encontrados_lote.add(mid)
                next_ep = m.get('nextAiringEpisode')
                sched = m.get('airingSchedule', {}).get('nodes', [])
                if next_ep and next_ep.get('episode'):
                    latest = max(0, next_ep['episode'] - 1)
                    next_airing = next_ep.get('airingAt')
                    next_num = next_ep.get('episode')
                elif sched and sched[0].get('episode'):
                    latest = sched[0]['episode']
                    next_airing = None
                    next_num = latest + 1 if m.get('status') == 'RELEASING' else None
                else:
                    latest = m.get('episodes') or 1
                    next_airing = None
                    next_num = None

                info = {
                    'latest_episode': latest,
                    'next_airing_at': next_airing,
                    'next_episode': next_num,
                    'total_episodes': m.get('episodes'),
                    'status': m.get('status') or 'RELEASING'
                }
                resultados[mid] = info
                cache.set(f'airing_info_{mid}', info, timeout=900)  # 15 minutos

            for mid in lote:
                if mid not in encontrados_lote:
                    fallback_info = {
                        'latest_episode': 1,
                        'next_airing_at': None,
                        'next_episode': None,
                        'total_episodes': None,
                        'status': 'RELEASING'
                    }
                    resultados[mid] = fallback_info
                    cache.set(f'airing_info_{mid}', fallback_info, timeout=300)

        except Exception:
            for mid in lote:
                if mid not in resultados:
                    resultados[mid] = {
                        'latest_episode': 1,
                        'next_airing_at': None,
                        'next_episode': None,
                        'total_episodes': None,
                        'status': 'RELEASING'
                    }

    return resultados


# ---------------------------------------------------------------------------
# Próximos lanzamientos (series nuevas, temporadas y películas)
# ---------------------------------------------------------------------------

POPULARIDAD_MINIMA_LANZAMIENTO = 2000
FORMATOS_LANZAMIENTO = {'TV', 'TV_SHORT', 'ONA', 'MOVIE', 'OVA', 'SPECIAL'}
MAX_PAGINAS_LANZAMIENTOS = 2

CONSULTA_LANZAMIENTOS = """
query ($desde: FuzzyDateInt, $hasta: FuzzyDateInt, $pagina: Int) {
  Page(page: $pagina, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, countryOfOrigin: "JP",
          startDate_greater: $desde, startDate_lesser: $hasta, sort: [START_DATE]) {
      id
      idMal
      format
      episodes
      duration
      description
      popularity
      title { romaji english native }
      coverImage { large extraLarge }
      bannerImage
      startDate { year month day }
      season
      seasonYear
      genres
      tags { name category rank isMediaSpoiler isGeneralSpoiler }
      studios { nodes { name isAnimationStudio } }
    }
  }
}
"""


class Lanzamiento(TypedDict):
    id: int
    mal_id: int | None
    title: str
    title_romaji: str
    image_url: str
    format: str
    episodes: int | None
    studio: str | None
    release_date: str  # "AAAA-MM-DD"
    popularity: int
    synopsis: str | None
    genres: list[str]
    season: str | None
    year: int | None


def _guardar_anime_catalogo(media: dict, fecha: dict) -> int | None:
    try:
        from animes.models import Anime
        from datetime import date
        mid = media.get('idMal') or (10000000 + media['id'])
        f_date = date(fecha['year'], fecha['month'], fecha['day'])

        titulos = media.get('title') or {}
        title_romaji = (titulos.get('romaji') or titulos.get('english') or 'Anime').strip()
        title_eng = (titulos.get('english') or '').strip()
        title_jp = (titulos.get('native') or '').strip()

        raw_desc = media.get('description') or ''
        clean_desc = _texto_plano(raw_desc, limite=3000)

        cover = media.get('coverImage') or {}
        img_url = cover.get('extraLarge') or cover.get('large') or ''
        banner = media.get('bannerImage') or ''

        fmt = media.get('format') or 'TV'
        type_map = {'MOVIE': 'Movie', 'TV_SHORT': 'TV', 'SPECIAL': 'Special'}
        mapped_type = type_map.get(fmt, fmt)

        studios_nodes = (media.get('studios') or {}).get('nodes') or []
        anim_studios = [s['name'] for s in studios_nodes if s.get('isAnimationStudio') and s.get('name')]
        chosen_studio = anim_studios[0] if anim_studios else (studios_nodes[0].get('name') if studios_nodes else '')

        ani_genres = media.get('genres') or []
        ani_tags = media.get('tags') or []
        clean_tags = []
        seen = set()
        for t in sorted(ani_tags, key=lambda x: x.get('rank', 0), reverse=True):
            tname = (t.get('name') or '').strip()
            tl = tname.lower()
            if not tl or tl in seen:
                continue
            seen.add(tl)
            clean_tags.append({
                'name': tname,
                'category': t.get('category', 'Theme'),
                'rank': int(t.get('rank', 0)),
                'spoiler': bool(t.get('isMediaSpoiler') or t.get('isGeneralSpoiler'))
            })
            if len(clean_tags) >= 20:
                break

        tokens = [g.lower() for g in ani_genres if g]
        for ct in clean_tags:
            if not ct.get('spoiler'):
                tl = ct['name'].lower()
                if tl not in tokens:
                    tokens.append(tl)
        tags_cache_str = '|' + '|'.join(tokens) + '|' if tokens else ''

        raw_season = media.get('season')
        season_str = raw_season.capitalize() if raw_season else ''
        if not season_str and fecha.get('month'):
            m = fecha['month']
            if m in (1, 2, 3):
                season_str = 'Winter'
            elif m in (4, 5, 6):
                season_str = 'Spring'
            elif m in (7, 8, 9):
                season_str = 'Summer'
            elif m in (10, 11, 12):
                season_str = 'Fall'
        season_yr = media.get('seasonYear') or fecha.get('year')

        from core.utils.db_resilience import run_with_db_retry

        anime = Anime.objects.filter(mal_id=mid).first()
        if anime is None:
            anime, _ = run_with_db_retry(
                lambda: Anime.objects.get_or_create(
                    mal_id=mid,
                    defaults={
                        'title': title_romaji,
                        'title_english': title_eng,
                        'title_japanese': title_jp,
                        'synopsis': clean_desc,
                        'image_url': img_url,
                        'banner_url': banner,
                        'type': mapped_type,
                        'episodes': media.get('episodes') or (1 if fmt == 'MOVIE' else None),
                        'duration': float(media.get('duration') or 24),
                        'status': 'NOT_YET_RELEASED',
                        'season': season_str,
                        'season_year': season_yr,
                        'studio': chosen_studio[:100],
                        'genres': ani_genres,
                        'tags_data': clean_tags,
                        'tags_cache': tags_cache_str,
                        'release_date': f_date,
                    },
                ),
                max_retries=2,
            )
        else:
            changed_fields: list[str] = []
            if anime.release_date != f_date:
                anime.release_date = f_date
                changed_fields.append('release_date')
            if not anime.studio and chosen_studio:
                anime.studio = chosen_studio[:100]
                changed_fields.append('studio')
            if not anime.title_english and title_eng:
                anime.title_english = title_eng
                changed_fields.append('title_english')
            if (not anime.genres or anime.genres == []) and ani_genres:
                anime.genres = ani_genres
                changed_fields.append('genres')
            if (not anime.tags_data or anime.tags_data == []) and clean_tags:
                anime.tags_data = clean_tags
                anime.tags_cache = tags_cache_str
                changed_fields.extend(['tags_data', 'tags_cache'])
            if not anime.synopsis and clean_desc:
                anime.synopsis = clean_desc
                changed_fields.append('synopsis')
            if not anime.season and season_str:
                anime.season = season_str
                changed_fields.append('season')
            if not anime.season_year and season_yr:
                anime.season_year = season_yr
                changed_fields.append('season_year')
            if changed_fields:
                run_with_db_retry(
                    lambda: anime.save(update_fields=changed_fields),
                    max_retries=2,
                )
        return mid
    except Exception:
        return media.get('idMal')


def obtener_proximos_lanzamientos(dias: int = 90) -> list[Lanzamiento]:
    """Anime japonés que se estrena en los próximos `dias` días con fecha exacta confirmada."""
    hoy = datetime.now(timezone.utc)
    hasta = datetime.fromtimestamp(hoy.timestamp() + dias * 86400, timezone.utc)
    lanzamientos: list[Lanzamiento] = []

    for pagina in range(1, MAX_PAGINAS_LANZAMIENTOS + 1):
        respuesta = _post_json(ANILIST_URL, {
            'query': CONSULTA_LANZAMIENTOS,
            'variables': {
                'desde': int(hoy.strftime('%Y%m%d')),
                'hasta': int(hasta.strftime('%Y%m%d')),
                'pagina': pagina,
            },
        })
        page = respuesta['data']['Page']
        for media in page['media']:
            fecha = media['startDate']
            # Solo fechas completas: "2027" sin mes ni día no sirve para un calendario
            if not (fecha['year'] and fecha['month'] and fecha['day']):
                continue
            if media['format'] not in FORMATOS_LANZAMIENTO or (media['popularity'] or 0) < POPULARIDAD_MINIMA_LANZAMIENTO:
                continue
            titulos = media['title']
            estudios = media['studios']['nodes']
            resolved_mid = _guardar_anime_catalogo(media, fecha)

            season_names = {'FALL': 'Otoño', 'SPRING': 'Primavera', 'SUMMER': 'Verano', 'WINTER': 'Invierno'}
            raw_season = media.get('season') or ''
            season_es = season_names.get(raw_season.upper(), raw_season.capitalize() if raw_season else None)
            if not season_es and fecha.get('month'):
                m = fecha['month']
                if m in (1, 2, 3):
                    season_es = 'Invierno'
                elif m in (4, 5, 6):
                    season_es = 'Primavera'
                elif m in (7, 8, 9):
                    season_es = 'Verano'
                elif m in (10, 11, 12):
                    season_es = 'Otoño'
            season_yr = media.get('seasonYear') or fecha.get('year')

            lanzamientos.append({
                'id': media['id'],
                'mal_id': resolved_mid,
                'title': titulos['english'] or titulos['romaji'],
                'title_romaji': titulos['romaji'],
                'image_url': media['coverImage']['large'],
                'format': media['format'],
                'episodes': media['episodes'],
                'studio': estudios[0]['name'] if estudios else None,
                'release_date': f"{fecha['year']:04d}-{fecha['month']:02d}-{fecha['day']:02d}",
                'popularity': media['popularity'] or 0,
                'synopsis': _texto_plano(media.get('description') or '', limite=300),
                'genres': media.get('genres') or [],
                'season': season_es,
                'year': season_yr,
            })
        if not page['pageInfo']['hasNextPage']:
            break
        time.sleep(0.4)

    return sorted(lanzamientos, key=lambda l: (l['release_date'], -l['popularity']))


# ---------------------------------------------------------------------------
# Noticias (RSS)
# ---------------------------------------------------------------------------

FUENTES = {
    'anmo': 'https://anmosugoi.com',
    'ramen': 'https://ramenparados.com',
}
NOTICIAS_POR_FUENTE = 10
TIMEOUT_WORDPRESS = 25  # La API de Anmo Sugoi es lenta; el resultado queda en caché 30 min
# Anmo Sugoi publica cada nota también en otros idiomas (/en/, /fr/, /pt/...): solo queremos español
_RE_RUTA_OTRO_IDIOMA = re.compile(r'^https?://[^/]+/[a-z]{2}/')
NS_CONTENIDO = '{http://purl.org/rss/1.0/modules/content/}encoded'

_RE_ETIQUETAS = re.compile(r'<[^>]+>')
_RE_IMAGEN = re.compile(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', re.IGNORECASE)


class Noticia(TypedDict):
    id: str
    source: str
    title: str
    summary: str
    link: str
    category: str
    image_url: str | None
    published_at: int | None  # Marca de tiempo Unix


def _texto_plano(fragmento_html: str, limite: int = 220) -> str:
    """Quita etiquetas y entidades HTML: el frontend recibe solo texto (prevención XSS)."""
    texto = html.unescape(_RE_ETIQUETAS.sub(' ', fragmento_html or ''))
    texto = re.sub(r'\s+', ' ', texto).strip()
    texto = re.sub(r'The post .* appeared first on .*$', '', texto).strip()
    return texto if len(texto) <= limite else texto[:limite].rsplit(' ', 1)[0] + '…'


def _get_json(url: str, timeout: int = TIMEOUT_SEGUNDOS) -> list | dict:
    peticion = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
        return json.loads(respuesta.read().decode('utf-8'))


def _leer_wordpress(fuente: str, base: str) -> list[Noticia]:
    """Ambos sitios usan WordPress: su API pública trae imagen destacada, categoría y fecha."""
    url = (
        f'{base}/wp-json/wp/v2/posts?per_page=30'
        '&_embed=wp:featuredmedia,wp:term&_fields=id,date_gmt,link,title,excerpt,_links,_embedded'
    )
    noticias: list[Noticia] = []
    for post in _get_json(url, timeout=TIMEOUT_WORDPRESS):
        enlace = post.get('link', '')
        if not enlace.startswith(('http://', 'https://')) or _RE_RUTA_OTRO_IDIOMA.match(enlace):
            continue
        embebido = post.get('_embedded', {})
        media = (embebido.get('wp:featuredmedia') or [{}])[0]
        tamanos = media.get('media_details', {}).get('sizes', {})
        imagen = next(
            (tamanos[t]['source_url'] for t in ('medium_large', 'large', 'medium') if t in tamanos),
            media.get('source_url'),
        )
        categorias = (embebido.get('wp:term') or [[]])[0]
        try:
            publicado = int(datetime.fromisoformat(post['date_gmt']).replace(tzinfo=timezone.utc).timestamp())
        except (KeyError, TypeError, ValueError):
            publicado = None
        noticias.append({
            'id': f"{fuente}-{post['id']}",
            'source': fuente,
            'title': html.unescape(post.get('title', {}).get('rendered', '')).strip(),
            'summary': _texto_plano(post.get('excerpt', {}).get('rendered', '')),
            'link': enlace,
            'category': html.unescape(categorias[0]['name']) if categorias else '',
            'image_url': imagen if isinstance(imagen, str) and imagen.startswith('https://') else None,
            'published_at': publicado,
        })
        if len(noticias) >= NOTICIAS_POR_FUENTE:
            break
    return noticias


def _leer_rss(fuente: str, base: str) -> list[Noticia]:
    """Respaldo si la API de WordPress no responde (el RSS no trae imágenes)."""
    peticion = urllib.request.Request(f'{base}/feed/', headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
        raiz = ElementTree.fromstring(respuesta.read())

    noticias: list[Noticia] = []
    for i, item in enumerate(raiz.iter('item')):
        if i >= NOTICIAS_POR_FUENTE:
            break
        enlace = (item.findtext('link') or '').strip()
        if not enlace.startswith(('http://', 'https://')):
            continue
        contenido = item.findtext(NS_CONTENIDO) or ''
        descripcion = item.findtext('description') or ''
        imagen = _RE_IMAGEN.search(contenido) or _RE_IMAGEN.search(descripcion)
        fecha = item.findtext('pubDate')
        try:
            publicado = int(parsedate_to_datetime(fecha).timestamp()) if fecha else None
        except (TypeError, ValueError):
            publicado = None
        noticias.append({
            'id': f'{fuente}-{i}',
            'source': fuente,
            'title': html.unescape(item.findtext('title') or '').strip(),
            'summary': _texto_plano(descripcion or contenido),
            'link': enlace,
            'category': html.unescape(item.findtext('category') or ''),
            'image_url': imagen.group(1) if imagen else None,
            'published_at': publicado,
        })
    return noticias


def obtener_noticias() -> list[Noticia]:
    """Noticias de todas las fuentes, de la más reciente a la más antigua.
    Si una fuente falla, se devuelven las de las demás; si fallan todas, se lanza el error."""
    def leer_fuente(fuente: str, base: str) -> tuple[list[Noticia], list[Exception]]:
        errores: list[Exception] = []
        for lector in (_leer_wordpress, _leer_rss):
            try:
                return lector(fuente, base), errores
            except Exception as error:  # noqa: BLE001 - una fuente caída no debe tumbar las demás
                errores.append(error)
        return [], errores

    # Las fuentes se leen en paralelo para que la espera sea la de la más lenta, no la suma
    with ThreadPoolExecutor(max_workers=len(FUENTES)) as ejecutor:
        resultados = list(ejecutor.map(lambda par: leer_fuente(*par), FUENTES.items()))

    noticias = [n for lista, _ in resultados for n in lista]
    errores = [e for _, lista in resultados for e in lista]
    if not noticias and errores:
        raise errores[0]
    return sorted(noticias, key=lambda n: n['published_at'] or 0, reverse=True)


RELATION_TYPE_NAMES = {
    'PREQUEL': 'Precuela',
    'SEQUEL': 'Secuela',
    'PARENT': 'Historia principal',
    'SIDE_STORY': 'Historia paralela',
    'SPIN_OFF': 'Spin-off',
    'ALTERNATIVE': 'Ambientación alternativa',
    'SUMMARY': 'Resumen / Recap',
    'CHARACTER': 'Historia de personaje',
    'OTHER': 'Relacionado',
    'COMPILATION': 'Recopilación',
    'CONTAINS': 'Contiene',
}

FORMAT_NAMES = {
    'TV': 'TV',
    'TV_SHORT': 'TV Corto',
    'MOVIE': 'Película',
    'SPECIAL': 'Especial',
    'OVA': 'OVA',
    'ONA': 'ONA',
    'MUSIC': 'Musical',
}


def obtener_relaciones_anime(mal_id: int) -> list[dict]:
    """Obtiene las obras relacionadas (precuelas, secuelas, spin-offs...) de AniList GraphQL."""
    consulta = """
    query ($id: Int) {
      Media(idMal: $id, type: ANIME) {
        id
        relations {
          edges {
            relationType
            node {
              id
              idMal
              type
              format
              status
              seasonYear
              title { romaji english native }
              coverImage { large medium }
            }
          }
        }
      }
    }
    """
    try:
        respuesta = _post_json(ANILIST_URL, {'query': consulta, 'variables': {'id': mal_id}})
        media = respuesta.get('data', {}).get('Media')
        if not media:
            return []
        edges = media.get('relations', {}).get('edges', [])
        relaciones: list[dict] = []
        prioridad_orden = {
            'PREQUEL': 1,
            'SEQUEL': 2,
            'PARENT': 3,
            'SIDE_STORY': 4,
            'SPIN_OFF': 5,
            'ALTERNATIVE': 6,
            'SUMMARY': 7,
            'CHARACTER': 8,
            'COMPILATION': 9,
            'OTHER': 10,
        }

        for e in edges:
            node = e.get('node') or {}
            if node.get('type') != 'ANIME':
                continue
            r_type = e.get('relationType') or 'OTHER'
            titles = node.get('title') or {}
            romaji = titles.get('romaji') or ''
            eng = titles.get('english') or ''
            cover = node.get('coverImage') or {}
            img = cover.get('large') or cover.get('medium') or ''
            fmt = node.get('format') or 'TV'

            relaciones.append({
                'relation_type': r_type,
                'relation_type_display': RELATION_TYPE_NAMES.get(r_type, r_type.replace('_', ' ').capitalize()),
                'format': fmt,
                'format_display': FORMAT_NAMES.get(fmt, fmt),
                'mal_id': node.get('idMal'),
                'anilist_id': node.get('id'),
                'title': romaji or eng or 'Anime relacionado',
                'title_english': eng,
                'image_url': img,
                'season_year': node.get('seasonYear'),
                'status': node.get('status'),
                'priority': prioridad_orden.get(r_type, 99),
            })

        return sorted(relaciones, key=lambda r: (r['priority'], r['season_year'] or 9999))
    except Exception:
        return []


CHARACTER_ROLE_NAMES = {
    'MAIN': 'Principal',
    'SUPPORTING': 'Secundario',
    'BACKGROUND': 'Secundario',
}

VOICE_LANG_NAMES = {
    'Japanese': 'Japonés (Seiyuu)',
    'Spanish': 'Español (Doblaje)',
    'English': 'Inglés (Doblaje)',
    'Portuguese': 'Portugués',
    'French': 'Francés',
    'German': 'Alemán',
    'Italian': 'Italiano',
    'Korean': 'Coreano',
    'Chinese': 'Chino',
}

KNOWN_STREAMING_SITES = {
    'Crunchyroll': {'color': '#F47521'},
    'Netflix': {'color': '#E50914'},
    'Disney Plus': {'color': '#113CCF'},
    'Amazon Prime Video': {'color': '#00A8E1'},
    'HIDIVE': {'color': '#00AEEF'},
    'Hulu': {'color': '#1CE783'},
    'Max': {'color': '#002BE7'},
    'HBO Max': {'color': '#5822B4'},
    'YouTube': {'color': '#FF0000'},
    'Bilibili': {'color': '#00A1D6'},
    'Apple TV': {'color': '#A2AAAD'},
}


def _clean_character_description(raw_desc: str) -> str:
    """
    Limpia el markdown de AniList conservando bloques de spoiler (~!texto!~ -> [spoiler]texto[/spoiler])
    y atributos clave al inicio.
    """
    if not raw_desc:
        return ''
    text = html.unescape(raw_desc)
    # Convertir spoilers de AniList ~! ... !~ a [spoiler]...[/spoiler]
    text = re.sub(r'~!([\s\S]*?)!~', r'[spoiler]\1[/spoiler]', text)
    # Limpiar etiquetas HTML residuales y links markdown [texto](url) -> texto
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</?[^>]+>', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Limpiar negritas/cursivas markdown excesivas en encabezados tipo __Age:__
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    return text.strip()


def _translate_description_es(text: str) -> str:
    """Traduce la biografía del personaje al español preservando etiquetas [spoiler]...[/spoiler]."""
    if not text:
        return ''
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source='auto', target='es')
        parts = re.split(r'(\[spoiler\][\s\S]*?\[/spoiler\])', text)
        translated_parts = []
        for part in parts:
            if not part.strip():
                translated_parts.append(part)
                continue
            if part.startswith('[spoiler]') and part.endswith('[/spoiler]'):
                inner = part[len('[spoiler]'):-len('[/spoiler]')].strip()
                if inner:
                    tr_inner = translator.translate(inner[:4500]) or inner
                    translated_parts.append(f'[spoiler]{tr_inner}[/spoiler]')
                else:
                    translated_parts.append('')
            else:
                tr_part = translator.translate(part[:4500]) or part
                translated_parts.append(tr_part)
        return '\n\n'.join(p.strip() for p in translated_parts if p.strip())
    except Exception:
        return text


def obtener_personajes_y_streaming_anime(mal_id: int) -> tuple[list[dict], list[dict]]:
    """
    Obtiene en una sola consulta a AniList GraphQL:
    1) Lista de personajes (principales y secundarios), su descripción, atributos,
       actores de voz / seiyuu (todos los idiomas disponibles) y animeografía.
    2) Plataformas legales de streaming donde está disponible el anime.
    """
    consulta = """
    query ($id: Int) {
      Media(idMal: $id, type: ANIME) {
        id
        externalLinks {
          id
          url
          site
          type
          language
          color
          icon
        }
        characters(sort: [ROLE, RELEVANCE, ID], perPage: 24) {
          edges {
            role
            node {
              id
              name {
                full
                native
                alternative
              }
              image {
                large
                medium
              }
              description
              gender
              age
              bloodType
              dateOfBirth {
                month
                day
              }
              favourites
              media(type: ANIME, sort: POPULARITY_DESC, perPage: 6) {
                edges {
                  characterRole
                  node {
                    id
                    idMal
                    title {
                      romaji
                      english
                    }
                    coverImage {
                      large
                      medium
                    }
                    format
                    seasonYear
                    score: averageScore
                  }
                }
              }
            }
            voiceActors(sort: [RELEVANCE, ID]) {
              id
              name {
                full
                native
              }
              languageV2
              image {
                large
                medium
              }
            }
          }
        }
      }
    }
    """
    try:
        respuesta = _post_json(ANILIST_URL, {'query': consulta, 'variables': {'id': mal_id}})
        media = respuesta.get('data', {}).get('Media')
        if not media:
            return [], []

        # 1. Procesar plataformas legales de streaming
        raw_links = media.get('externalLinks') or []
        streaming_list: list[dict] = []
        seen_sites: set[str] = set()
        for link in raw_links:
            site = (link.get('site') or '').strip()
            url = (link.get('url') or '').strip()
            l_type = (link.get('type') or '').upper()
            if not site or not url:
                continue
            if l_type != 'STREAMING' and site not in KNOWN_STREAMING_SITES:
                continue
            site_key = site.lower()
            if site_key in seen_sites:
                continue
            seen_sites.add(site_key)
            default_color = KNOWN_STREAMING_SITES.get(site, {}).get('color', '#a78bfa')
            streaming_list.append({
                'site': site,
                'url': url,
                'language': link.get('language') or '',
                'color': link.get('color') or default_color,
                'icon': link.get('icon') or '',
            })

        # 2. Procesar personajes y sus actores de voz / seiyuu
        char_edges = (media.get('characters') or {}).get('edges') or []
        characters_list: list[dict] = []
        for edge in char_edges:
            node = edge.get('node') or {}
            char_id = node.get('id')
            if not char_id:
                continue
            role_raw = edge.get('role') or 'SUPPORTING'
            names = node.get('name') or {}
            full_name = names.get('full') or 'Personaje'
            native_name = names.get('native') or ''
            alt_names = [a for a in (names.get('alternative') or []) if a and a.strip()]
            imgs = node.get('image') or {}
            char_img = imgs.get('large') or imgs.get('medium') or ''
            raw_desc = _clean_character_description(node.get('description') or '')
            dob = node.get('dateOfBirth') or {}
            birthday = f"{dob['day']}/{dob['month']}" if dob.get('day') and dob.get('month') else ''

            # Actores de voz / Seiyuu (priorizando Japonés primero, luego Español, Inglés y otros)
            lang_priority = {'Japanese': 1, 'Spanish': 2, 'English': 3}
            raw_vas = edge.get('voiceActors') or []
            voice_actors: list[dict] = []
            seen_va: set[tuple] = set()
            for va in raw_vas:
                va_id = va.get('id')
                va_names = va.get('name') or {}
                va_full = va_names.get('full') or ''
                lang = va.get('languageV2') or 'Japanese'
                if not va_full:
                    continue
                va_key = (va_id or va_full, lang)
                if va_key in seen_va:
                    continue
                seen_va.add(va_key)
                va_img_obj = va.get('image') or {}
                voice_actors.append({
                    'id': va_id,
                    'name': va_full,
                    'native_name': va_names.get('native') or '',
                    'language': lang,
                    'language_display': VOICE_LANG_NAMES.get(lang, lang),
                    'image_url': va_img_obj.get('large') or va_img_obj.get('medium') or '',
                    'priority': lang_priority.get(lang, 9),
                })
            voice_actors.sort(key=lambda x: x['priority'])

            # Animeografía del personaje
            media_edges = ((node.get('media') or {}).get('edges')) or []
            animeography: list[dict] = []
            for me in media_edges:
                m_node = me.get('node') or {}
                if not m_node.get('idMal'):
                    continue
                m_titles = m_node.get('title') or {}
                m_cover = m_node.get('coverImage') or {}
                c_role = me.get('characterRole') or 'MAIN'
                animeography.append({
                    'mal_id': m_node.get('idMal'),
                    'title': m_titles.get('romaji') or m_titles.get('english') or 'Anime',
                    'image_url': m_cover.get('large') or m_cover.get('medium') or '',
                    'role': CHARACTER_ROLE_NAMES.get(c_role, 'Principal'),
                    'format': m_node.get('format') or 'TV',
                    'season_year': m_node.get('seasonYear'),
                })

            characters_list.append({
                'id': char_id,
                'name': full_name,
                'native_name': native_name,
                'alternative_names': alt_names[:4],
                'role': role_raw,
                'role_display': CHARACTER_ROLE_NAMES.get(role_raw, 'Secundario'),
                'image_url': char_img,
                'description': raw_desc,
                'description_es': '',
                'age': str(node.get('age') or '').strip(),
                'gender': str(node.get('gender') or '').strip(),
                'blood_type': str(node.get('bloodType') or '').strip(),
                'birthday': birthday,
                'favourites': node.get('favourites') or 0,
                'voice_actors': voice_actors,
                'animeography': animeography,
            })

        return characters_list, streaming_list
    except Exception:
        return [], []

