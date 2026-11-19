import os
import sys
import django
import html
import json
import re
import time
import urllib.request
import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.chdir(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection, transaction
from django.core.cache import cache
from django.utils import timezone
from animes.models import Anime, AnimeScoreHistory

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
UNRATED_ANIME_IDS = {63209, 63208, 63207, 62251, 60234}
PAGES_TOTAL = 40  # 40 páginas * 50 = 2.000 títulos
DELAY_SECONDS = 1.2

def fetch_top_page(offset: int, retries: int = 3) -> list[dict]:
    url = f"https://myanimelist.net/topanime.php?limit={offset}"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=14) as resp:
                page_html = resp.read().decode('utf-8', errors='replace')
                break
        except Exception as e:
            if attempt < retries - 1:
                wait_t = (attempt + 1) * 3
                print(f"    [!] Error en offset={offset} ({e}), reintentando en {wait_t}s...")
                time.sleep(wait_t)
            else:
                print(f"    [X] Falló definitivamente offset={offset}: {e}")
                return []

    results = []
    rows = page_html.split('<tr class="ranking-list">')
    for r in rows[1:]:
        aid_m = re.search(r'href="https://myanimelist\.net/anime/(\d+)/', r)
        if not aid_m:
            continue
        aid = int(aid_m.group(1))

        rank_m = re.search(r'class="[^"]*top-anime-rank-text[^"]*">(\d+)</span>', r)
        title_m = re.search(r'class="[^"]*anime_ranking_h3"><a[^>]*>([^<]+)</a>', r) or re.search(r'alt="Anime:\s*([^"]+)"', r)
        score_m = re.search(r'class="[^"]*score-label[^"]*">([0-9\.]+)</span>', r)
        mem_m = re.search(r'([\d,]+)\s+members', r)
        img_m = re.search(r'<img[^>]+(?:data-src|src)="([^"]+)"', r)
        type_m = re.search(r'<div class="information[^>]*>\s*([A-Za-z0-9_ -]+?)(?:\s*\(|\s*<)', r)

        rank = int(rank_m.group(1)) if rank_m else None
        title = html.unescape(title_m.group(1).strip()) if title_m else f"Anime #{aid}"

        score = None
        if score_m:
            try:
                s_val = float(score_m.group(1))
                if s_val > 0:
                    score = round(s_val, 2)
            except ValueError:
                pass

        members = 0
        if mem_m:
            try:
                members = int(mem_m.group(1).replace(',', ''))
            except ValueError:
                pass

        img_url = ''
        if img_m:
            raw_img = img_m.group(1).strip()
            img_url = re.sub(r'/r/\d+x\d+/', '/', raw_img).split('?')[0]

        series_type = type_m.group(1).strip() if type_m else 'TV'
        if aid in UNRATED_ANIME_IDS:
            score = None

        results.append({
            'mal_id': aid,
            'title': title,
            'rank': rank,
            'score': score,
            'members': members,
            'image_url': img_url,
            'type': series_type,
        })
    return results

def main():
    print("=" * 70)
    print("🚀 SINCRONIZACIÓN Y ACTUALIZACIÓN TOP 2.000 MYANIMELIST")
    print("=" * 70)
    print(f"Meta: {PAGES_TOTAL} páginas (2.000 animes) | Delay: {DELAY_SECONDS}s por página")

    today = datetime.date.today()
    recorded_date = datetime.date(today.year, today.month, 1)

    existing_animes = {a.mal_id: a for a in Anime.objects.all()}
    print(f"Catálogo actual cargado en memoria: {len(existing_animes):,} animes.")

    updated_count = 0
    created_count = 0
    history_count = 0
    all_extracted_items = []

    t_start = time.time()

    for page_idx in range(PAGES_TOTAL):
        offset = page_idx * 50
        print(f"--> [Página {page_idx + 1}/{PAGES_TOTAL}] Consultando offset {offset}...")
        items = fetch_top_page(offset)
        if not items:
            print(f"    [Advertencia] No se obtuvieron resultados en página {page_idx + 1}.")
            time.sleep(DELAY_SECONDS)
            continue

        all_extracted_items.extend(items)

        with transaction.atomic():
            for it in items:
                aid = it['mal_id']
                anime = existing_animes.get(aid)

                if anime:
                    updated_fields = []
                    # Actualizar score
                    if it['score'] is not None and anime.score != it['score']:
                        anime.score = it['score']
                        updated_fields.append('score')
                    # Actualizar rank
                    if it['rank'] is not None and anime.rank != it['rank']:
                        anime.rank = it['rank']
                        updated_fields.append('rank')
                    # Actualizar miembros (scored_by)
                    if it['members'] > 0 and anime.scored_by != it['members']:
                        anime.scored_by = it['members']
                        updated_fields.append('scored_by')
                    # Actualizar imagen si faltaba
                    if it['image_url'] and (not anime.image_url or 'placeholder' in anime.image_url):
                        anime.image_url = it['image_url']
                        updated_fields.append('image_url')

                    if updated_fields:
                        anime.last_synced_at = timezone.now()
                        updated_fields.append('last_synced_at')
                        anime.save(update_fields=updated_fields)
                        updated_count += 1
                else:
                    # Crear anime si no existía en el catálogo
                    anime = Anime.objects.create(
                        mal_id=aid,
                        title=it['title'],
                        score=it['score'],
                        rank=it['rank'],
                        scored_by=it['members'],
                        type=it['type'],
                        image_url=it['image_url'] or 'https://cdn.myanimelist.net/images/anime/placeholder.jpg',
                        synopsis='Importado desde Top MyAnimeList.',
                    )
                    existing_animes[aid] = anime
                    created_count += 1

                # Actualizar o registrar en historial mensual
                AnimeScoreHistory.objects.update_or_create(
                    anime=anime,
                    recorded_at=recorded_date,
                    defaults={
                        'year': today.year,
                        'month': today.month,
                        'score': anime.score,
                        'scored_by': anime.scored_by,
                        'members': anime.scored_by,
                        'rank': anime.rank,
                    }
                )
                history_count += 1

        print(f"    ✓ {len(items)} animes procesados. Acumulado actualizados: {updated_count}, creados: {created_count}")
        time.sleep(DELAY_SECONDS)

    t_fetch_end = time.time()
    print("\n" + "=" * 70)
    print(f"✨ Ingesta completada en {round(t_fetch_end - t_start, 1)}s.")
    print(f"  - Total animes procesados del Top: {len(all_extracted_items)}")
    print(f"  - Animes existentes actualizados con nuevos valores: {updated_count}")
    print(f"  - Nuevos animes agregados al catálogo: {created_count}")
    print(f"  - Puntos de historial registrados: {history_count}")

    # Recalcular ranking de popularidad en toda la base de datos
    print("\n🔄 Recalculando ranking de popularidad (popularity) en base a los nuevos miembros...")
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('''
                UPDATE animes_anime
                SET popularity = sub.new_rank
                FROM (
                    SELECT mal_id, ROW_NUMBER() OVER (ORDER BY scored_by DESC, score DESC) AS new_rank
                    FROM animes_anime
                ) AS sub
                WHERE animes_anime.mal_id = sub.mal_id
            ''')
            print(f"✓ {cursor.rowcount:,} registros de popularidad reordenados.")

    # Purgar caché
    print("🧹 Invalidando caché global del catálogo...")
    cache.clear()
    print("✓ Caché purgada.")

    # Muestra de verificación de títulos destacados
    print("\n📊 Muestra de verificación tras la actualización:")
    test_titles = [
        'Sousou no Frieren',
        'Steins;Gate',
        'Fullmetal Alchemist: Brotherhood',
        'Shingeki no Kyojin',
        'Re:Zero kara Hajimeru Isekai Seikatsu 4th Season',
        'Hunter x Hunter (2011)',
        'Bleach: Sennen Kessen-hen',
        'Gintama',
        'Kimi no Na wa.'
    ]
    for title_query in test_titles:
        a = Anime.objects.filter(title__icontains=title_query).first()
        if a:
            print(f"  • {a.title}: Score={a.score} | Rank=#{a.rank} | Miembros={a.scored_by:,} | PopRank=#{a.popularity}")

    print("\n✅ Proceso finalizado con éxito.")

if __name__ == '__main__':
    main()
