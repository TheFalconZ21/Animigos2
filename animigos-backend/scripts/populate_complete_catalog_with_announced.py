import os
import sys
import json
import time
import re
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(r"D:\Codigos\Animigos2\animigos-backend")
sys.path.insert(0, str(BASE_DIR))
os.chdir(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from animes.models import Anime

ANILIST_URL = 'https://graphql.anilist.co'
USER_AGENT = 'Animigos-DataIngest/2.0 (Mozilla/5.0 Windows NT 10.0; Win64; x64)'

RELATION_TYPE_NAMES = {
    'ADAPTATION': 'Adaptación',
    'PREQUEL': 'Precuela',
    'SEQUEL': 'Secuela',
    'PARENT': 'Historia principal',
    'SIDE_STORY': 'Historia paralela',
    'CHARACTER': 'Especial de personajes',
    'SUMMARY': 'Resumen',
    'ALTERNATIVE': 'Versión alternativa',
    'SPIN_OFF': 'Spin-off',
    'OTHER': 'Otro',
    'COMPILATION': 'Compilación',
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

PRIORIDAD_ORDEN = {
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

def parse_relations_edges(edges: list[dict]) -> list[dict]:
    rels = []
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

        rels.append({
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
            'priority': PRIORIDAD_ORDEN.get(r_type, 99),
        })

    rels.sort(key=lambda r: (r['priority'], r['season_year'] or 9999))
    return rels


def post_graphql(query: str, variables: dict, max_retries: int = 4) -> dict:
    payload = json.dumps({'query': query, 'variables': variables}).encode('utf-8')
    req = urllib.request.Request(
        ANILIST_URL,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT
        },
        method='POST'
    )

    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=14) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = 2
                try:
                    retry_after = int(e.headers.get('Retry-After', 2) or 2)
                except Exception:
                    pass
                wait_time = max(retry_after, 2) + 1.5
                print(f"  [HTTP 429 Rate Limit] Esperando {wait_time}s antes de reintentar...", flush=True)
                time.sleep(wait_time)
            else:
                print(f"  [HTTP {e.code}] Error: {e}", flush=True)
                time.sleep(1.5)
        except Exception as e:
            print(f"  [Error de Red] {e}. Reintentando ({attempt + 1}/{max_retries})...", flush=True)
            time.sleep(2.0)

    return {}


# -----------------------------------------------------------------------------
# PASO 1: Ingesta de Animes Anunciados / Futuros (NOT_YET_RELEASED)
# -----------------------------------------------------------------------------
QUERY_ANNOUNCED = """
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, countryOfOrigin: "JP", sort: [POPULARITY_DESC]) {
      id
      idMal
      title { romaji english native }
      format
      episodes
      duration
      description
      popularity
      coverImage { large extraLarge }
      bannerImage
      startDate { year month day }
      season
      seasonYear
      genres
      studios { nodes { name isAnimationStudio } }
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
}
"""

def sync_announced_animes(max_pages: int = 10) -> set[int]:
    """Ingesta los animes anunciados y no emitidos, creando registros y guardando sus relaciones."""
    print("\n" + "="*70)
    print(" PASO 1: INGESTA DE ANIMES ANUNCIADOS Y PRÓXIMOS (NOT_YET_RELEASED)")
    print("="*70, flush=True)

    discovered_mids = set()
    total_saved = 0

    for page in range(1, max_pages + 1):
        print(f"Consultando página {page}/{max_pages} de animes anunciados...", flush=True)
        res = post_graphql(QUERY_ANNOUNCED, {'page': page})
        page_data = res.get('data', {}).get('Page', {})
        media_list = page_data.get('media', [])
        if not media_list:
            break

        for m in media_list:
            mid = m.get('idMal') or (10000000 + m['id'])
            titulos = m.get('title') or {}
            romaji = (titulos.get('romaji') or titulos.get('english') or 'Anime Futuro').strip()
            eng = (titulos.get('english') or '').strip()
            native = (titulos.get('native') or '').strip()

            raw_desc = m.get('description') or ''
            clean_desc = re.sub(r'<[^>]+>', '', raw_desc).strip()

            cover = m.get('coverImage') or {}
            img_url = cover.get('extraLarge') or cover.get('large') or ''
            banner = m.get('bannerImage') or ''

            fmt = m.get('format') or 'TV'
            type_map = {'MOVIE': 'Movie', 'TV_SHORT': 'TV', 'SPECIAL': 'Special'}
            mapped_type = type_map.get(fmt, fmt)

            studios_nodes = (m.get('studios') or {}).get('nodes') or []
            anim_studios = [s['name'] for s in studios_nodes if s.get('isAnimationStudio') and s.get('name')]
            chosen_studio = anim_studios[0] if anim_studios else (studios_nodes[0].get('name') if studios_nodes else '')

            ani_genres = m.get('genres') or []
            fecha = m.get('startDate') or {}
            f_date = None
            if fecha.get('year') and fecha.get('month') and fecha.get('day'):
                try:
                    from datetime import date
                    f_date = date(fecha['year'], fecha['month'], fecha['day'])
                except Exception:
                    pass

            season_str = (m.get('season') or '').capitalize()
            season_yr = m.get('seasonYear') or fecha.get('year') or 2026

            edges = m.get('relations', {}).get('edges', [])
            rels = parse_relations_edges(edges)

            anime, created = Anime.objects.get_or_create(
                mal_id=mid,
                defaults={
                    'title': romaji,
                    'title_english': eng,
                    'title_japanese': native,
                    'synopsis': clean_desc[:4000],
                    'image_url': img_url,
                    'banner_url': banner,
                    'type': mapped_type,
                    'episodes': m.get('episodes'),
                    'duration': float(m.get('duration') or 24),
                    'status': 'NOT_YET_RELEASED',
                    'season': season_str,
                    'season_year': season_yr,
                    'studio': chosen_studio[:100],
                    'genres': ani_genres,
                    'release_date': f_date,
                    'relations_data': rels,
                }
            )

            mod = False
            if not created:
                if anime.status != 'NOT_YET_RELEASED':
                    anime.status = 'NOT_YET_RELEASED'
                    mod = True
                if rels and len(rels) > len(anime.relations_data or []):
                    anime.relations_data = rels
                    mod = True
                if banner and not anime.banner_url:
                    anime.banner_url = banner
                    mod = True
                if img_url and not anime.image_url:
                    anime.image_url = img_url
                    mod = True
                if season_yr and not anime.season_year:
                    anime.season_year = season_yr
                    mod = True
                if f_date and anime.release_date != f_date:
                    anime.release_date = f_date
                    mod = True
                if mod:
                    anime.save()

            total_saved += 1
            for r in rels:
                if r.get('mal_id'):
                    discovered_mids.add(r['mal_id'])

        print(f"  Página {page}: {len(media_list)} animes procesados. Total acumulado: {total_saved}", flush=True)
        if not page_data.get('pageInfo', {}).get('hasNextPage'):
            break
        time.sleep(0.75)

    print(f"Paso 1 completado: {total_saved} animes anunciados sincronizados con relaciones.", flush=True)
    return discovered_mids


# -----------------------------------------------------------------------------
# PASO 2: Poblado de Relaciones del Resto del Catálogo en Lotes
# -----------------------------------------------------------------------------
QUERY_BATCH_RELATIONS = """
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(idMal_in: $ids, type: ANIME) {
      id
      idMal
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
}
"""

def sync_remaining_catalog(extra_discovered: set[int] = None):
    print("\n" + "="*70)
    print(" PASO 2: POBLADO MASIVO DE RELACIONES EN TODO EL CATÁLOGO (BATCHING)")
    print("="*70, flush=True)

    pending_qs = (
        Anime.objects.filter(relations_data=[])
        .order_by('-scored_by', '-score', '-season_year')
        .values_list('mal_id', flat=True)
    )
    all_pending = list(pending_qs)
    total_pending = len(all_pending)
    batch_size = 50
    total_batches = (total_pending + batch_size - 1) // batch_size

    print(f"Total animes sin relaciones en DB: {total_pending:,} en {total_batches} lotes", flush=True)
    start_time = time.time()
    updated_count = 0
    discovered_all = set(extra_discovered or set())

    for b_idx in range(0, total_pending, batch_size):
        chunk = all_pending[b_idx:b_idx + batch_size]
        batch_num = (b_idx // batch_size) + 1

        res = post_graphql(QUERY_BATCH_RELATIONS, {'ids': chunk})
        media_list = res.get('data', {}).get('Page', {}).get('media', [])
        results_map = {}

        for m in media_list:
            mid = m.get('idMal')
            if not mid:
                continue
            edges = m.get('relations', {}).get('edges', [])
            rels = parse_relations_edges(edges)
            results_map[mid] = rels
            for r in rels:
                if r.get('mal_id'):
                    discovered_all.add(r['mal_id'])

        animes_to_update = []
        for mid in chunk:
            rels = results_map.get(mid)
            if rels is not None and len(rels) > 0:
                animes_to_update.append(Anime(mal_id=mid, relations_data=rels))

        if animes_to_update:
            Anime.objects.bulk_update(animes_to_update, ['relations_data'])
            updated_count += len(animes_to_update)

        if batch_num % 10 == 0 or batch_num == total_batches:
            elapsed = round(time.time() - start_time, 1)
            pct = round((batch_num / total_batches) * 100, 1)
            print(f"[{batch_num}/{total_batches}] ({pct}%) {updated_count:,} animes con relaciones guardadas ({elapsed}s transcurridos)", flush=True)

        # Exportar checkpoint cada 50 lotes (2,500 animes)
        if batch_num % 50 == 0:
            export_relations_master(silent=True)

        time.sleep(0.75)

    elapsed_total = round(time.time() - start_time, 2)
    print(f"\nPaso 2 finalizado: {updated_count:,} animes con relaciones pobladas en {elapsed_total}s.", flush=True)
    return discovered_all


# -----------------------------------------------------------------------------
# PASO 3: Exportar Dataset Maestro
# -----------------------------------------------------------------------------
def export_relations_master(silent: bool = False):
    data_dir = BASE_DIR / 'animes' / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    json_path = data_dir / 'anime_relations_master.json'

    qs = Anime.objects.exclude(relations_data=[]).exclude(relations_data__isnull=True).values('mal_id', 'relations_data')
    relations_dict = {}
    total_links = 0
    for row in qs:
        mid_str = str(row['mal_id'])
        rels = row['relations_data']
        relations_dict[mid_str] = rels
        total_links += len(rels)

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(relations_dict, f, ensure_ascii=False, indent=None, separators=(',', ':'))

    if not silent:
        file_size_kb = round(json_path.stat().st_size / 1024, 2)
        print("\n" + "="*70)
        print(" EXPORTACIÓN DE DATASET MAESTRO (anime_relations_master.json)")
        print("="*70)
        print(f"- Total animes con relaciones: {len(relations_dict):,}")
        print(f"- Total aristas de conexión: {total_links:,}")
        print(f"- Tamaño del archivo: {file_size_kb:,} KB ({round(file_size_kb / 1024, 2)} MB)")
        print(f"- Ubicación: {json_path}", flush=True)


def main():
    print("==================================================================")
    print(" ANIMIGOS: POBLADO TOTAL DEL CATÁLOGO + ANIMES ANUNCIADOS Y FUTUROS")
    print("==================================================================", flush=True)

    # 1. Animes Anunciados (NOT_YET_RELEASED: Dandadan S3, Frieren S3, Alya S2, Dungeon Meshi S2, etc.)
    discovered_from_announced = sync_announced_animes(max_pages=10)

    # 2. Poblado del Resto del Catálogo (100% de animes sin relaciones)
    sync_remaining_catalog(extra_discovered=discovered_from_announced)

    # 3. Exportación Final Consolidada
    export_relations_master(silent=False)


if __name__ == '__main__':
    main()
