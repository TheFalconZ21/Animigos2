import os
import sys
import django
import csv
import json
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.chdir(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from animes.models import Anime

def main():
    start_time = time.time()
    csv_path = BASE_DIR / 'animes' / 'data' / 'full_catalog_30k.csv'
    temp_path = BASE_DIR / 'animes' / 'data' / 'full_catalog_30k_new.csv'

    fields = [
        'mal_id', 'title', 'title_english', 'title_japanese',
        'synopsis', 'synopsis_es', 'image_url', 'banner_url',
        'score', 'scored_by', 'popularity', 'rank',
        'episodes', 'duration', 'season_year', 'season',
        'studio', 'status', 'type', 'genres',
        'tags_data', 'tags_cache', 'release_date', 'relations_data'
    ]

    total_count = Anime.objects.count()
    print(f"Exportando {total_count} animes desde la base de datos local a CSV temporal...")

    with open(temp_path, mode='w', encoding='utf-8-sig', newline='', errors='replace') as f:
        writer = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()

        batch_size = 2000
        processed = 0

        qs = Anime.objects.all().order_by('mal_id')
        for anime in qs.iterator(chunk_size=batch_size):
            row = {
                'mal_id': anime.mal_id,
                'title': anime.title or '',
                'title_english': anime.title_english or '',
                'title_japanese': anime.title_japanese or '',
                'synopsis': anime.synopsis or '',
                'synopsis_es': anime.synopsis_es or '',
                'image_url': anime.image_url or '',
                'banner_url': anime.banner_url or '',
                'score': str(anime.score) if anime.score is not None else '',
                'scored_by': anime.scored_by if anime.scored_by is not None else 0,
                'popularity': anime.popularity if anime.popularity is not None else '',
                'rank': anime.rank if anime.rank is not None else '',
                'episodes': anime.episodes if anime.episodes is not None else '',
                'duration': str(anime.duration) if anime.duration is not None else '',
                'season_year': anime.season_year if anime.season_year is not None else '',
                'season': anime.season or '',
                'studio': anime.studio or '',
                'status': anime.status or 'FINISHED',
                'type': anime.type or 'TV',
                'genres': json.dumps(anime.genres, ensure_ascii=False) if isinstance(anime.genres, list) else (anime.genres or ''),
                'tags_data': json.dumps(anime.tags_data, ensure_ascii=False) if isinstance(anime.tags_data, list) else (anime.tags_data or ''),
                'tags_cache': anime.tags_cache or '',
                'release_date': anime.release_date.strftime('%Y-%m-%d') if anime.release_date else '',
                'relations_data': json.dumps(anime.relations_data, ensure_ascii=False) if isinstance(anime.relations_data, list) else (anime.relations_data or '')
            }
            writer.writerow(row)
            processed += 1
            if processed % 5000 == 0:
                print(f"  Exportados: {processed}/{total_count}...")

    # Reemplazar archivo original
    if temp_path.exists():
        if csv_path.exists():
            csv_path.unlink()
        temp_path.rename(csv_path)

    elapsed = round(time.time() - start_time, 2)
    print(f"EXPORTACIÓN COMPLETADA: {processed} registros exportados a {csv_path.name} en {elapsed}s.")

if __name__ == '__main__':
    main()
