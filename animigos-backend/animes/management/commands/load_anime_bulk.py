import os
import csv
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from animes.models import Anime

class Command(BaseCommand):
    help = 'Carga masiva de alta velocidad de animes en la base de datos (PostgreSQL/SQLite) usando bulk_create'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Número máximo de animes a importar (0 = todos los del dataset)'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Tamaño del lote para inserción masiva (default: 1000)'
        )

    def handle(self, *args, **options):
        limit = options['limit']
        batch_size = options['batch_size']

        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        csv_path = base_dir / 'anime_dataset_2018_2026' / 'csv' / 'anime_master_catalogo.csv'

        if not csv_path.exists():
            self.stderr.write(self.style.ERROR(f"No se encontró el dataset en: {csv_path}"))
            return

        self.stdout.write(f"Iniciando carga masiva desde {csv_path.name}...")
        start_time = time.time()

        objects_batch = []
        seen_ids = set()
        total_inserted = 0

        update_fields = [
            'title', 'title_english', 'title_japanese', 'synopsis',
            'image_url', 'banner_url', 'score', 'scored_by',
            'episodes', 'duration', 'season_year', 'season',
            'studio', 'status', 'type', 'genres'
        ]

        with open(csv_path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)

            for index, row in enumerate(reader):
                if limit and total_inserted + len(objects_batch) >= limit:
                    break

                try:
                    mal_id_str = (row.get('mal_id') or row.get('\ufeffmal_id') or '').strip()
                    if not mal_id_str:
                        continue
                    mal_id = int(float(mal_id_str))
                except (ValueError, TypeError):
                    continue

                if mal_id in seen_ids:
                    continue
                seen_ids.add(mal_id)

                title = (row.get('title_userPreferred') or row.get('title_romaji') or '').strip() or f"Anime #{mal_id}"
                title_english = (row.get('title_english') or '').strip()
                title_japanese = (row.get('title_native') or '').strip()
                synopsis = (row.get('description_text') or '').strip()
                image_url = (row.get('coverImage_large') or row.get('coverImage_extraLarge') or '').strip()
                banner_url = (row.get('bannerImage') or '').strip()

                score = None
                for score_field in ['mean_score_mal_2026', 'score_2026', 'score_2024']:
                    val = row.get(score_field, '').strip()
                    if val:
                        try:
                            score = round(float(val), 2)
                            break
                        except ValueError:
                            pass

                scored_by = 0
                members_str = row.get('members_2026', '').strip()
                if members_str:
                    try:
                        scored_by = int(float(members_str))
                    except ValueError:
                        pass

                episodes = None
                ep_str = row.get('episodes', '').strip()
                if ep_str:
                    try:
                        episodes = int(float(ep_str))
                    except ValueError:
                        pass

                duration = None
                dur_str = row.get('duration', '').strip()
                if dur_str:
                    try:
                        duration = round(float(dur_str), 2)
                    except ValueError:
                        pass

                season_year = None
                year_str = row.get('seasonYear') or row.get('startDate_year') or ''
                if year_str.strip():
                    try:
                        season_year = int(float(year_str.strip()))
                    except ValueError:
                        pass

                season = (row.get('season') or '').strip().capitalize()
                studio = (row.get('estudio_principal') or '').strip()
                status = (row.get('status') or 'FINISHED').strip()
                type_val = (row.get('format') or row.get('type') or 'TV').strip()

                genres_raw = row.get('generos_2026', '').strip()
                genres = [g.strip() for g in genres_raw.split(',') if g.strip()] if genres_raw else []

                anime_obj = Anime(
                    mal_id=mal_id,
                    title=title,
                    title_english=title_english,
                    title_japanese=title_japanese,
                    synopsis=synopsis,
                    image_url=image_url,
                    banner_url=banner_url,
                    score=score,
                    scored_by=scored_by,
                    episodes=episodes,
                    duration=duration,
                    season_year=season_year,
                    season=season,
                    studio=studio,
                    status=status,
                    type=type_val,
                    genres=genres
                )
                objects_batch.append(anime_obj)

                if len(objects_batch) >= batch_size:
                    Anime.objects.bulk_create(
                        objects_batch,
                        batch_size=batch_size,
                        update_conflicts=True,
                        update_fields=update_fields,
                        unique_fields=['mal_id']
                    )
                    total_inserted += len(objects_batch)
                    objects_batch.clear()
                    self.stdout.write(f"  -> Progreso: {total_inserted} animes insertados/actualizados...")

            if objects_batch:
                Anime.objects.bulk_create(
                    objects_batch,
                    batch_size=batch_size,
                    update_conflicts=True,
                    update_fields=update_fields,
                    unique_fields=['mal_id']
                )
                total_inserted += len(objects_batch)
                objects_batch.clear()

        elapsed = round(time.time() - start_time, 2)
        self.stdout.write(
            self.style.SUCCESS(
                f"FINALIZADO: {total_inserted} animes cargados en PostgreSQL en {elapsed} segundos!"
            )
        )
