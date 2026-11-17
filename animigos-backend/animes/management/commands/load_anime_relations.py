import json
import time
import os
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from animes.models import Anime

class Command(BaseCommand):
    help = "Carga las relaciones de franquicias (precuelas, secuelas, spin-offs...) desde anime_relations_master.json."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Sobrescribir relations_data incluso si el anime ya tiene relaciones pobladas.',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        possible_paths = [
            Path(__file__).resolve().parent.parent.parent / 'data' / 'anime_relations_master.json',
            Path(settings.BASE_DIR) / 'animes' / 'data' / 'anime_relations_master.json',
            Path(os.getcwd()) / 'animes' / 'data' / 'anime_relations_master.json',
        ]
        json_path = None
        for p in possible_paths:
            if p.exists():
                json_path = p
                break

        if not json_path:
            self.stderr.write(self.style.ERROR("No se encontró animes/data/anime_relations_master.json."))
            return

        self.stdout.write(f"Cargando relaciones maestras desde {json_path.name}...")
        start_time = time.time()

        with open(json_path, 'r', encoding='utf-8') as f:
            relations_dict = json.load(f)

        valid_mids = set(Anime.objects.values_list('mal_id', flat=True))
        if not force:
            already_populated = set(
                Anime.objects.exclude(relations_data=[])
                .exclude(relations_data__isnull=True)
                .values_list('mal_id', flat=True)
            )
        else:
            already_populated = set()

        batch = []
        batch_size = 1000
        total_updated = 0

        for mid_str, rels in relations_dict.items():
            try:
                mid = int(mid_str)
            except ValueError:
                continue

            if mid not in valid_mids or (not force and mid in already_populated):
                continue

            batch.append(Anime(mal_id=mid, relations_data=rels))

            if len(batch) >= batch_size:
                Anime.objects.bulk_update(batch, ['relations_data'])
                total_updated += len(batch)
                batch.clear()

        if batch:
            Anime.objects.bulk_update(batch, ['relations_data'])
            total_updated += len(batch)

        elapsed = round(time.time() - start_time, 2)
        self.stdout.write(self.style.SUCCESS(
            f"Relaciones maestras sincronizadas: {total_updated:,} animes actualizados en {elapsed}s."
        ))
