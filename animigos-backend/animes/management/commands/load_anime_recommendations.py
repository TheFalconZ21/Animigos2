import csv
import time
import os
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from animes.models import Anime, AnimeRecommendation

class Command(BaseCommand):
    help = "Carga las recomendaciones cruzadas desde anime_recommendations.csv."

    def handle(self, *args, **options):
        possible_paths = [
            Path(__file__).resolve().parent.parent / 'data' / 'anime_recommendations.csv',
            Path(settings.BASE_DIR) / 'animes' / 'data' / 'anime_recommendations.csv',
            Path(os.getcwd()) / 'animes' / 'data' / 'anime_recommendations.csv',
        ]
        csv_path = None
        for p in possible_paths:
            if p.exists():
                csv_path = p
                break

        if not csv_path:
            self.stderr.write(self.style.ERROR("No se encontró anime_recommendations.csv."))
            return

        valid_ids = set(Anime.objects.values_list('mal_id', flat=True))
        self.stdout.write(f"Cargando recomendaciones desde {csv_path.name}...")
        start_time = time.time()

        batch = []
        batch_size = 5000
        total_created = 0
        seen_pairs = set()

        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    src = int(row['source_id'])
                    tgt = int(row['target_id'])
                    strength = int(row['strength'])
                except (ValueError, KeyError):
                    continue

                if src not in valid_ids or tgt not in valid_ids:
                    continue

                pair = (src, tgt)
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)

                batch.append(AnimeRecommendation(source_id=src, target_id=tgt, strength=strength))

                if len(batch) >= batch_size:
                    AnimeRecommendation.objects.bulk_create(batch, ignore_conflicts=True)
                    total_created += len(batch)
                    batch.clear()

        if batch:
            AnimeRecommendation.objects.bulk_create(batch, ignore_conflicts=True)
            total_created += len(batch)

        elapsed = round(time.time() - start_time, 2)
        self.stdout.write(self.style.SUCCESS(
            f"Recomendaciones cargadas: {total_created:,} registros en {elapsed}s."
        ))
