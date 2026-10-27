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

TIMEOUT_SEGUNDOS = 12
USER_AGENT = 'Animigos/1.0 (+https://animigos.app)'

# ---------------------------------------------------------------------------
# Horario de emisión (AniList)
# ---------------------------------------------------------------------------

ANILIST_URL = 'https://graphql.anilist.co'
POPULARIDAD_MINIMA = 4000  # Evita llenar el calendario de títulos muy minoritarios
FORMATOS_VALIDOS = {'TV', 'TV_SHORT', 'ONA'}
MAX_PAGINAS = 10

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


def _post_json(url: str, cuerpo: dict) -> dict:
    datos = json.dumps(cuerpo).encode('utf-8')
    peticion = urllib.request.Request(
        url,
        data=datos,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': USER_AGENT},
        method='POST',
    )
    with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
        return json.loads(respuesta.read().decode('utf-8'))


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


# ---------------------------------------------------------------------------
# Próximos lanzamientos (series nuevas, temporadas y películas)
# ---------------------------------------------------------------------------

POPULARIDAD_MINIMA_LANZAMIENTO = 2000
FORMATOS_LANZAMIENTO = {'TV', 'TV_SHORT', 'ONA', 'MOVIE', 'OVA', 'SPECIAL'}
MAX_PAGINAS_LANZAMIENTOS = 4

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
      popularity
      title { romaji english }
      coverImage { large }
      startDate { year month day }
      studios(isMain: true) { nodes { name } }
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
            lanzamientos.append({
                'id': media['id'],
                'mal_id': media['idMal'],
                'title': titulos['english'] or titulos['romaji'],
                'title_romaji': titulos['romaji'],
                'image_url': media['coverImage']['large'],
                'format': media['format'],
                'episodes': media['episodes'],
                'studio': estudios[0]['name'] if estudios else None,
                'release_date': f"{fecha['year']:04d}-{fecha['month']:02d}-{fecha['day']:02d}",
                'popularity': media['popularity'] or 0,
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
