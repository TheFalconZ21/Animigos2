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
    """Compatibilidad: retorna (characters, streaming)."""
    chars, streaming, _ = obtener_personajes_streaming_y_staff_anime(mal_id)
    return chars, streaming


STAFF_ROLE_TRANSLATIONS = [
    ('Original Creator', 'Autor Original / Mangaka', 'author'),
    ('Original Story', 'Historia Original', 'author'),
    ('Original Character Design', 'Diseño Original de Personajes', 'author'),
    ('Chief Director', 'Director General', 'direction'),
    ('Series Director', 'Director de Serie', 'direction'),
    ('Episode Director', 'Director de Episodio', 'direction'),
    ('Sound Director', 'Director de Sonido', 'music'),
    ('Art Director', 'Director de Arte', 'art_animation'),
    ('Chief Animation Director', 'Director Jefe de Animación', 'art_animation'),
    ('Animation Director', 'Director de Animación', 'art_animation'),
    ('Director of Photography', 'Director de Fotografía', 'art_animation'),
    ('Assistant Director', 'Asistente de Dirección', 'direction'),
    ('Director', 'Director', 'direction'),
    ('Executive Producer', 'Productor Ejecutivo', 'production'),
    ('Chief Producer', 'Productor Jefe', 'production'),
    ('Animation Producer', 'Productor de Animación', 'production'),
    ('Associate Producer', 'Productor Asociado', 'production'),
    ('Producer', 'Productor', 'production'),
    ('Planning', 'Planificación / Producción', 'production'),
    ('Series Composition', 'Composición de Serie', 'direction'),
    ('Script', 'Guion', 'direction'),
    ('Screenplay', 'Guion', 'direction'),
    ('Storyboard', 'Storyboard', 'direction'),
    ('Character Design', 'Diseño de Personajes', 'art_animation'),
    ('Music', 'Música / Banda Sonora', 'music'),
    ('Theme Song Performance', 'Intérprete Tema Musical (OP/ED)', 'music'),
    ('Theme Song Composition', 'Composición Tema Musical', 'music'),
    ('Theme Song Lyrics', 'Letra Tema Musical', 'music'),
    ('Theme Song Arrangement', 'Arreglo Tema Musical', 'music'),
    ('Sound Effects', 'Efectos de Sonido', 'music'),
    ('Key Animation', 'Animación Clave', 'art_animation'),
    ('Color Design', 'Diseño de Color', 'art_animation'),
    ('Editing', 'Edición', 'production'),
]

OCCUPATION_TRANSLATIONS = {
    'Voice Actor': 'Actor / Actriz de Voz (Seiyuu)',
    'Mangaka': 'Mangaka / Autor Original',
    'Director': 'Director/a',
    'Producer': 'Productor/a',
    'Animator': 'Animador/a',
    'Singer': 'Cantante / Intérprete',
    'Musician': 'Músico / Compositor',
    'Composer': 'Compositor/a',
    'Illustrator': 'Ilustrador/a',
    'Writer': 'Guionista / Escritor/a',
    'Screenwriter': 'Guionista',
    'Character Designer': 'Diseñador/a de Personajes',
    'Sound Director': 'Director/a de Sonido',
}


def _translate_staff_role(raw_role: str) -> tuple[str, str]:
    """Traduce un rol de staff de AniList al español y devuelve (role_display, category)."""
    if not raw_role:
        return 'Staff de Producción', 'other'
    role_clean = raw_role.strip()
    # Extraer sufijos entre paréntesis como (eps 1-12) o (OP, ED)
    paren_suffix = ''
    m_paren = re.search(r'(\([^)]+\))$', role_clean)
    if m_paren:
        paren_suffix = ' ' + m_paren.group(1)
        base_role = role_clean[:m_paren.start()].strip()
    else:
        base_role = role_clean

    for eng_key, es_label, cat in STAFF_ROLE_TRANSLATIONS:
        if base_role.lower() == eng_key.lower() or base_role.lower().startswith(eng_key.lower()):
            return f"{es_label}{paren_suffix}", cat

    for eng_key, es_label, cat in STAFF_ROLE_TRANSLATIONS:
        if eng_key.lower() in base_role.lower():
            return f"{es_label}{paren_suffix}", cat

    return role_clean, 'other'


def obtener_personajes_streaming_y_staff_anime(mal_id: int) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Obtiene en una sola consulta a AniList GraphQL:
    1) Lista de personajes (principales y secundarios), su descripción, atributos,
       actores de voz / seiyuu (todos los idiomas disponibles) y animeografía.
    2) Plataformas legales de streaming donde está disponible el anime.
    3) Autores originales (mangakas), directores, productores, compositores y trabajadores conocidos.
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
        staff(sort: [RELEVANCE, ID], perPage: 25) {
          edges {
            role
            node {
              id
              name {
                full
                native
              }
              languageV2
              primaryOccupations
              image {
                large
                medium
              }
            }
          }
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
            return [], [], []

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

        # 3. Procesar Staff (Autores / Mangakas, Directores, Productores, Compositores, Diseñadores...)
        staff_edges = (media.get('staff') or {}).get('edges') or []
        staff_by_id: dict[int, dict] = {}
        cat_priority = {'author': 1, 'direction': 2, 'production': 3, 'music': 4, 'art_animation': 5, 'other': 6}
        for s_edge in staff_edges:
            s_node = s_edge.get('node') or {}
            s_id = s_node.get('id')
            if not s_id:
                continue
            raw_role = (s_edge.get('role') or 'Staff').strip()
            role_es, cat = _translate_staff_role(raw_role)
            s_names = s_node.get('name') or {}
            s_full = s_names.get('full') or 'Staff'
            s_native = s_names.get('native') or ''
            s_imgs = s_node.get('image') or {}
            s_img = s_imgs.get('large') or s_imgs.get('medium') or ''
            occupations = [
                OCCUPATION_TRANSLATIONS.get(occ, occ)
                for occ in (s_node.get('primaryOccupations') or [])
                if occ
            ]

            if s_id in staff_by_id:
                existing = staff_by_id[s_id]
                if role_es not in existing['roles_list']:
                    existing['roles_list'].append(role_es)
                    existing['role_display'] = ' · '.join(existing['roles_list'][:3])
                if cat_priority.get(cat, 9) < existing['priority']:
                    existing['priority'] = cat_priority.get(cat, 9)
                    existing['category'] = cat
            else:
                staff_by_id[s_id] = {
                    'id': s_id,
                    'name': s_full,
                    'native_name': s_native,
                    'role': raw_role,
                    'role_display': role_es,
                    'roles_list': [role_es],
                    'category': cat,
                    'occupations': occupations[:3],
                    'image_url': s_img,
                    'priority': cat_priority.get(cat, 9),
                }

        staff_list = sorted(staff_by_id.values(), key=lambda x: x['priority'])
        for item in staff_list:
            item.pop('roles_list', None)
            item.pop('priority', None)

        return characters_list, streaming_list, staff_list
    except Exception:
        return [], [], []


def _extract_social_and_wiki_links(raw_desc: str, full_name: str, native_name: str, site_url: str = '') -> tuple[list[dict], dict]:
    """
    Extrae redes sociales oficiales (X/Twitter, Instagram, YouTube, TikTok, Pixiv, Blog, Sitio Oficial)
    desde el markdown de AniList + consulta rápida a Wikipedia/Wikidata para obtener el artículo enciclopédico.
    """
    social_links: list[dict] = []
    seen_urls: set[str] = set()
    wiki_info: dict = {'url': '', 'title': '', 'lang': 'es', 'is_direct': False}

    def add_social(platform: str, label: str, url: str, color: str, handle: str = ''):
        u_clean = url.strip()
        if not u_clean.startswith(('http://', 'https://')):
            return
        key = u_clean.lower().rstrip('/')
        if key in seen_urls:
            return
        seen_urls.add(key)
        social_links.append({
            'platform': platform,
            'label': label,
            'url': u_clean,
            'color': color,
            'handle': handle,
        })

    # 1. Extraer enlaces markdown [etiqueta](url) del texto original de AniList
    if raw_desc:
        md_links = re.findall(r'\[([^\]]+)\]\((https?://[^)\s]+)\)', raw_desc)
        for label, url in md_links:
            u_low = url.lower()
            lbl_clean = label.strip().strip(':')
            if 'wikipedia.org/wiki/' in u_low:
                if not wiki_info['url'] or 'es.wikipedia.org' in u_low:
                    lang = 'es' if 'es.wikipedia' in u_low else ('ja' if 'ja.wikipedia' in u_low else 'en')
                    wiki_info = {
                        'url': url,
                        'title': full_name,
                        'lang': lang,
                        'is_direct': True,
                    }
                continue
            if 'twitter.com/' in u_low or 'x.com/' in u_low:
                m_h = re.search(r'(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)', url)
                handle = f"@{m_h.group(1)}" if m_h else lbl_clean
                add_social('twitter', 'X / Twitter', url, '#1DA1F2', handle)
            elif 'instagram.com/' in u_low:
                m_h = re.search(r'instagram\.com/([A-Za-z0-9_.]+)', url)
                handle = f"@{m_h.group(1)}" if m_h else lbl_clean
                add_social('instagram', 'Instagram', url, '#E1306C', handle)
            elif 'youtube.com/' in u_low or 'youtu.be/' in u_low:
                add_social('youtube', 'YouTube', url, '#FF0000', lbl_clean or 'Canal Oficial')
            elif 'tiktok.com/' in u_low:
                add_social('tiktok', 'TikTok', url, '#00F2FE', lbl_clean)
            elif 'pixiv.net/' in u_low:
                add_social('pixiv', 'Pixiv', url, '#0096FA', lbl_clean or 'Portafolio')
            elif 'facebook.com/' in u_low:
                add_social('facebook', 'Facebook', url, '#1877F2', lbl_clean)
            elif 'twitch.tv/' in u_low:
                add_social('twitch', 'Twitch', url, '#9146FF', lbl_clean)
            elif any(b in u_low for b in ('ameblo.jp', 'lineblog.me', 'note.com', 'blogspot.', 'fc2.com')):
                add_social('blog', lbl_clean or 'Blog Oficial', url, '#10B981')
            elif 'anilist.co' not in u_low and 'myanimelist.net' not in u_low:
                add_social('website', lbl_clean or 'Sitio Oficial / Agencia', url, '#a855f7')

    # 2. Consultar Wikipedia (ES -> EN -> JA) + Wikidata para artículo enciclopédico y redes sociales oficiales
    wikidata_qid = ''
    for lang, search_term in [('es', full_name), ('en', full_name), ('ja', native_name)]:
        if wiki_info['is_direct'] and wiki_info['lang'] == 'es' and wikidata_qid:
            break
        if not search_term:
            continue
        try:
            q_enc = urllib.parse.quote(search_term)
            api_url = (
                f"https://{lang}.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item"
                f"&generator=search&gsrsearch={q_enc}&gsrlimit=1&format=json"
            )
            data = _get_json(api_url, timeout=2)
            pages = ((data.get('query') or {}).get('pages')) or {}
            if pages:
                page_obj = next(iter(pages.values()))
                title = page_obj.get('title') or ''
                qid = (page_obj.get('pageprops') or {}).get('wikibase_item') or ''
                name_tokens = [t.lower() for t in re.split(r'\s+', search_term) if len(t) > 2]
                if title and (not name_tokens or any(tok in title.lower() for tok in name_tokens)):
                    if qid and not wikidata_qid:
                        wikidata_qid = qid
                    page_url = f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                    if not wiki_info['is_direct']:
                        wiki_info = {
                            'url': page_url,
                            'title': title,
                            'lang': lang,
                            'is_direct': True,
                        }
                    if wiki_info['is_direct'] and wikidata_qid:
                        break
        except Exception:
            pass

    # 3. Si obtuvimos el Q-ID de Wikidata, extraer redes sociales oficiales verificadas (P2002 Twitter/X, P2003 Instagram, P2397 YouTube, P7085 TikTok, P856 Web Oficial)
    if wikidata_qid:
        try:
            wd_url = f"https://www.wikidata.org/w/api.php?action=wbgetentities&ids={wikidata_qid}&props=claims|sitelinks&format=json"
            wd_data = _get_json(wd_url, timeout=2)
            entity = ((wd_data.get('entities') or {}).get(wikidata_qid)) or {}
            claims = entity.get('claims') or {}
            sitelinks = entity.get('sitelinks') or {}

            # Si hay artículo en Wikipedia en español en Wikidata, priorizarlo
            if 'eswiki' in sitelinks and sitelinks['eswiki'].get('title'):
                es_title = sitelinks['eswiki']['title']
                wiki_info = {
                    'url': f"https://es.wikipedia.org/wiki/{urllib.parse.quote(es_title.replace(' ', '_'))}",
                    'title': es_title,
                    'lang': 'es',
                    'is_direct': True,
                }

            def get_claim_str(prop_id: str) -> str:
                prop_list = claims.get(prop_id) or []
                for cl in prop_list:
                    val = (((cl.get('mainsnak') or {}).get('datavalue') or {}).get('value'))
                    if isinstance(val, str) and val.strip():
                        return val.strip()
                return ''

            tw_user = get_claim_str('P2002')
            if tw_user and not any(s['platform'] == 'twitter' for s in social_links):
                add_social('twitter', 'X / Twitter', f"https://x.com/{tw_user}", '#1DA1F2', f"@{tw_user}")

            ig_user = get_claim_str('P2003')
            if ig_user and not any(s['platform'] == 'instagram' for s in social_links):
                add_social('instagram', 'Instagram', f"https://www.instagram.com/{ig_user}/", '#E1306C', f"@{ig_user}")

            yt_chan = get_claim_str('P2397')
            if yt_chan and not any(s['platform'] == 'youtube' for s in social_links):
                add_social('youtube', 'YouTube', f"https://www.youtube.com/channel/{yt_chan}", '#FF0000', 'Canal Oficial')

            tt_user = get_claim_str('P7085')
            if tt_user and not any(s['platform'] == 'tiktok' for s in social_links):
                add_social('tiktok', 'TikTok', f"https://www.tiktok.com/@{tt_user}", '#00F2FE', f"@{tt_user}")

            web_url = get_claim_str('P856')
            if web_url and not any(s['platform'] == 'website' for s in social_links):
                add_social('website', 'Sitio Oficial / Agencia', web_url, '#a855f7')
        except Exception:
            pass

    # Fallback garantizado a Wikipedia si la búsqueda directa no respondió a tiempo
    if not wiki_info['url']:
        q_wiki = urllib.parse.quote(full_name or native_name)
        wiki_info = {
            'url': f"https://es.wikipedia.org/w/index.php?search={q_wiki}",
            'title': full_name,
            'lang': 'es',
            'is_direct': False,
        }

    # Añadir ficha de AniList si está disponible
    if site_url:
        add_social('anilist', 'Ficha en AniList', site_url, '#02A9FF')

    return social_links, wiki_info


def obtener_detalle_staff(staff_id: int) -> dict | None:
    """
    Obtiene la ficha dedicada de un actor de voz / seiyuu, mangaka / autor, director,
    productor o trabajador de anime desde AniList GraphQL + Wikipedia.
    Incluye biografía traducida al español, redes sociales, enlace a Wikipedia,
    personajes interpretados (doblaje/seiyuu) y obras donde ha trabajado o tiene autoría.
    """
    from django.core.cache import cache
    cache_key = f"staff_detail_v2_{staff_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    consulta = """
    query ($id: Int) {
      Staff(id: $id) {
        id
        name {
          full
          native
          alternative
        }
        languageV2
        image {
          large
          medium
        }
        description
        primaryOccupations
        gender
        dateOfBirth {
          year
          month
          day
        }
        dateOfDeath {
          year
          month
          day
        }
        age
        yearsActive
        homeTown
        bloodType
        favourites
        siteUrl
        characterMedia(sort: [POPULARITY_DESC], perPage: 48) {
          edges {
            characterRole
            characters {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
            }
            node {
              id
              idMal
              type
              format
              seasonYear
              averageScore
              title {
                romaji
                english
              }
              coverImage {
                large
                medium
              }
            }
          }
        }
        staffMedia(sort: [POPULARITY_DESC], perPage: 48) {
          edges {
            staffRole
            node {
              id
              idMal
              type
              format
              seasonYear
              averageScore
              title {
                romaji
                english
              }
              coverImage {
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
        respuesta = _post_json(ANILIST_URL, {'query': consulta, 'variables': {'id': staff_id}})
        staff = respuesta.get('data', {}).get('Staff')
        if not staff:
            return None

        names = staff.get('name') or {}
        full_name = names.get('full') or 'Staff'
        native_name = names.get('native') or ''
        alt_names = [a.strip() for a in (names.get('alternative') or []) if a and a.strip()]
        imgs = staff.get('image') or {}
        image_url = imgs.get('large') or imgs.get('medium') or ''
        raw_desc = staff.get('description') or ''
        site_url = staff.get('siteUrl') or ''

        # Extraer redes sociales y enlace a Wikipedia antes de limpiar el markdown
        social_links, wiki_info = _extract_social_and_wiki_links(raw_desc, full_name, native_name, site_url)

        clean_desc = _clean_character_description(raw_desc)
        desc_es = _translate_description_es(clean_desc) if clean_desc else ''

        occupations_raw = staff.get('primaryOccupations') or []
        occupations = [OCCUPATION_TRANSLATIONS.get(o, o) for o in occupations_raw if o]

        dob = staff.get('dateOfBirth') or {}
        birthday_parts = [str(dob[k]) for k in ('day', 'month', 'year') if dob.get(k)]
        birthday = '/'.join(birthday_parts) if len(birthday_parts) >= 2 else (str(dob.get('year')) if dob.get('year') else '')

        years_active_raw = staff.get('yearsActive') or []
        years_active = ''
        if len(years_active_raw) == 1 and years_active_raw[0]:
            years_active = f"{years_active_raw[0]} – Presente"
        elif len(years_active_raw) >= 2 and years_active_raw[0]:
            years_active = f"{years_active_raw[0]} – {years_active_raw[1] or 'Presente'}"

        lang = staff.get('languageV2') or ''
        lang_display = VOICE_LANG_NAMES.get(lang, lang)

        # 1. Roles de Doblaje / Seiyuu (characterMedia)
        voice_works: list[dict] = []
        seen_vw: set[tuple] = set()
        c_edges = ((staff.get('characterMedia') or {}).get('edges')) or []
        for edge in c_edges:
            m_node = edge.get('node') or {}
            mal_id = m_node.get('idMal')
            if not mal_id:
                continue
            m_titles = m_node.get('title') or {}
            m_cover = m_node.get('coverImage') or {}
            c_role = edge.get('characterRole') or 'MAIN'
            chars = edge.get('characters') or []
            char_obj = chars[0] if chars else {}
            c_id = char_obj.get('id')
            c_names = char_obj.get('name') or {}
            c_imgs = char_obj.get('image') or {}
            vw_key = (mal_id, c_id or 0)
            if vw_key in seen_vw:
                continue
            seen_vw.add(vw_key)
            avg_score = m_node.get('averageScore')
            voice_works.append({
                'mal_id': mal_id,
                'anime_title': m_titles.get('romaji') or m_titles.get('english') or 'Anime',
                'anime_image': m_cover.get('large') or m_cover.get('medium') or '',
                'format': FORMAT_NAMES.get(m_node.get('format') or 'TV', m_node.get('format') or 'TV'),
                'season_year': m_node.get('seasonYear'),
                'score': round(avg_score / 10.0, 2) if avg_score else None,
                'character_id': c_id,
                'character_name': c_names.get('full') or 'Personaje',
                'character_native': c_names.get('native') or '',
                'character_image': c_imgs.get('large') or c_imgs.get('medium') or '',
                'character_role': CHARACTER_ROLE_NAMES.get(c_role, 'Principal'),
            })

        # 2. Obras de Autoría (Mangaka) y Producción / Dirección / Staff (staffMedia)
        staff_works_by_key: dict[tuple, dict] = {}
        s_edges = ((staff.get('staffMedia') or {}).get('edges')) or []
        for edge in s_edges:
            m_node = edge.get('node') or {}
            mal_id = m_node.get('idMal')
            anilist_media_id = m_node.get('id')
            if not mal_id and not anilist_media_id:
                continue
            media_type = m_node.get('type') or 'ANIME'
            raw_role = (edge.get('staffRole') or 'Staff').strip()
            role_es, cat = _translate_staff_role(raw_role)
            m_titles = m_node.get('title') or {}
            m_cover = m_node.get('coverImage') or {}
            avg_score = m_node.get('averageScore')
            fmt = m_node.get('format') or ('MANGA' if media_type == 'MANGA' else 'TV')
            w_key = (media_type, mal_id or anilist_media_id)

            if w_key in staff_works_by_key:
                existing = staff_works_by_key[w_key]
                if role_es not in existing['roles_list']:
                    existing['roles_list'].append(role_es)
                    existing['role_display'] = ' · '.join(existing['roles_list'][:3])
                if cat == 'author':
                    existing['is_authorship'] = True
            else:
                is_auth = cat == 'author' or media_type == 'MANGA' or 'story' in raw_role.lower() or 'art' in raw_role.lower() or 'creator' in raw_role.lower()
                staff_works_by_key[w_key] = {
                    'mal_id': mal_id if media_type == 'ANIME' else None,
                    'media_type': media_type,
                    'title': m_titles.get('romaji') or m_titles.get('english') or 'Obra',
                    'image_url': m_cover.get('large') or m_cover.get('medium') or '',
                    'format': 'Manga / Obra Original' if media_type == 'MANGA' else FORMAT_NAMES.get(fmt, fmt),
                    'season_year': m_node.get('seasonYear'),
                    'score': round(avg_score / 10.0, 2) if avg_score else None,
                    'role': raw_role,
                    'role_display': role_es,
                    'roles_list': [role_es],
                    'is_authorship': is_auth,
                }

        production_works = list(staff_works_by_key.values())
        for pw in production_works:
            pw.pop('roles_list', None)

        result = {
            'id': staff.get('id'),
            'name': full_name,
            'native_name': native_name,
            'alternative_names': alt_names[:5],
            'language': lang,
            'language_display': lang_display,
            'image_url': image_url,
            'occupations': occupations,
            'gender': str(staff.get('gender') or '').strip(),
            'age': str(staff.get('age') or '').strip(),
            'birthday': birthday,
            'hometown': str(staff.get('homeTown') or '').strip(),
            'blood_type': str(staff.get('bloodType') or '').strip(),
            'years_active': years_active,
            'favourites': staff.get('favourites') or 0,
            'description': clean_desc,
            'description_es': desc_es,
            'wikipedia': wiki_info,
            'social_links': social_links,
            'voice_works': voice_works,
            'production_works': production_works,
        }
        cache.set(cache_key, result, timeout=60 * 60 * 24 * 7)
        return result
    except Exception:
        return None


