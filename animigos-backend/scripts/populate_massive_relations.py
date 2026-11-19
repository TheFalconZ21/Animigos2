import os
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
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

GRAPHQL_BATCH_QUERY = """
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

def fetch_batch_from_anilist(ids_batch: list[int], max_retries: int = 3) -> dict[int, list[dict]]:
    """Consulta en lote hasta 50 IDs de MyAnimeList a AniList GraphQL con rate-limiting y reintentos."""
    payload = json.dumps({
        'query': GRAPHQL_BATCH_QUERY,
        'variables': {'ids': ids_batch}
    }).encode('utf-8')

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
            with urllib.request.urlopen(req, timeout=12) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                media_list = res_data.get('data', {}).get('Page', {}).get('media', [])
                results = {}

                for m in media_list:
                    mid = m.get('idMal')
                    if not mid:
                        continue

                    edges = m.get('relations', {}).get('edges', [])
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
                    results[mid] = rels

                return results

        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = 2
                try:
                    retry_after = int(e.headers.get('Retry-After', 2) or 2)
                except Exception:
                    pass
                wait_time = max(retry_after, 2) + 1.0
                print(f"  [HTTP 429 Rate Limit] Esperando {wait_time}s antes de reintentar...")
                time.sleep(wait_time)
            else:
                print(f"  [HTTP {e.code}] Error en lote de {len(ids_batch)} IDs: {e}")
                time.sleep(1.5)
        except Exception as e:
            print(f"  [Error de Red] {e}. Reintentando ({attempt + 1}/{max_retries})...")
            time.sleep(2.0)

    return {}


def process_batches(id_list: list[int], pass_label: str) -> tuple[int, set[int]]:
    """Procesa una lista de IDs en lotes de 50, actualiza DB y recolecta IDs descubiertos."""
    batch_size = 50
    total_ids = len(id_list)
    total_batches = (total_ids + batch_size - 1) // batch_size
    discovered_ids = set()
    updated_animes = 0

    print(f"\n=== {pass_label}: {total_ids} animes en {total_batches} lotes ===")
    start_time = time.time()

    for b_idx in range(0, total_ids, batch_size):
        chunk = id_list[b_idx:b_idx + batch_size]
        batch_num = (b_idx // batch_size) + 1
        
        results = fetch_batch_from_anilist(chunk)
        
        # Guardar en base de datos
        animes_to_update = []
        for mid in chunk:
            rels = results.get(mid)
            if rels is not None and len(rels) > 0:
                animes_to_update.append(Anime(mal_id=mid, relations_data=rels))
                for r in rels:
                    rel_mid = r.get('mal_id')
                    if rel_mid:
                        discovered_ids.add(rel_mid)

        if animes_to_update:
            Anime.objects.bulk_update(animes_to_update, ['relations_data'])
            updated_animes += len(animes_to_update)

        print(f"[{batch_num}/{total_batches}] {len(animes_to_update)}/{len(chunk)} animes con relaciones guardadas. (Total acumulado: {updated_animes})")
        
        # Pausa respetuosa de rate-limit (~75 peticiones/min)
        time.sleep(0.75)

    elapsed = round(time.time() - start_time, 2)
    print(f"=== {pass_label} finalizada: {updated_animes} animes actualizados en {elapsed}s ===")
    return updated_animes, discovered_ids


def export_relations_master():
    """Exporta todas las relaciones de la base de datos a un JSON maestro estructurado."""
    data_dir = BASE_DIR / 'animes' / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    json_path = data_dir / 'anime_relations_master.json'

    print(f"\nExportando relaciones maestras a {json_path}...")
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

    file_size_kb = round(json_path.stat().st_size / 1024, 2)
    print(f"=== EXPORTACIÓN EXITOSA ===")
    print(f"- Total animes con relaciones: {len(relations_dict):,}")
    print(f"- Total aristas de relación: {total_links:,}")
    print(f"- Tamaño del archivo: {file_size_kb} KB ({round(file_size_kb / 1024, 2)} MB)")
    print(f"- Ubicación: {json_path}")


def main():
    print("==================================================================")
    print("   ANIMIGOS: POBLADO MASIVO Y CLAUSURA DE GRAFO DE RELACIONES     ")
    print("==================================================================")

    # 1. Identificar Semillas: Top 2,000 + Años 2023–2026
    top2000_ids = set(
        Anime.objects.filter(score__isnull=False, scored_by__gte=100)
        .order_by('-score')[:2000]
        .values_list('mal_id', flat=True)
    )
    recent_ids = set(
        Anime.objects.filter(season_year__in=[2023, 2024, 2025, 2026])
        .values_list('mal_id', flat=True)
    )

    seed_union = top2000_ids.union(recent_ids)
    already_done = set(
        Anime.objects.filter(mal_id__in=seed_union)
        .exclude(relations_data=[])
        .exclude(relations_data__isnull=True)
        .values_list('mal_id', flat=True)
    )
    pending_seeds = sorted(list(seed_union - already_done))

    print(f"Total semillas objetivo: {len(seed_union)} animes")
    print(f"Semillas ya con relaciones: {len(already_done)} animes")
    print(f"Semillas pendientes a consultar: {len(pending_seeds)} animes")

    # 2. PASADA 1: Procesar Semillas
    updated_p1, discovered_from_seeds = process_batches(pending_seeds, "PASADA 1: Semillas Principales")

    # 3. PASADA 2: Clausura Transitiva de Franquicias (Nodos descubiertos)
    all_db_mids = set(Anime.objects.values_list('mal_id', flat=True))
    valid_discovered = discovered_from_seeds.intersection(all_db_mids)
    
    done_after_p1 = set(
        Anime.objects.filter(mal_id__in=valid_discovered)
        .exclude(relations_data=[])
        .exclude(relations_data__isnull=True)
        .values_list('mal_id', flat=True)
    )
    pending_discovered = sorted(list(valid_discovered - done_after_p1))
    print(f"\nNodos descubiertos en el grafo: {len(discovered_from_seeds)}")
    print(f"Nodos existentes en catálogo DB pendientes: {len(pending_discovered)}")

    if pending_discovered:
        updated_p2, _ = process_batches(pending_discovered, "PASADA 2: Clausura Transitiva de Franquicias")
    else:
        print("No hay nodos huérfanos pendientes de clausura.")

    # 4. EXPORTAR JSON MAESTRO
    export_relations_master()


if __name__ == '__main__':
    main()
