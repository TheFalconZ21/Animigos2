import os
import csv
import time
from pathlib import Path
from decimal import Decimal
from django.core.management.base import BaseCommand
from animes.models import Anime

class Command(BaseCommand):
    help = 'Carga masiva de alta velocidad de animes en la base de datos usando bulk_create'

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
            default=2000,
            help='Tamaño del lote para inserción masiva (default: 2000)'
        )

    def handle(self, *args, **options):
        limit = options['limit']
        batch_size = options['batch_size']

        possible_paths = [
            Path(__file__).resolve().parent.parent / 'data' / 'full_catalog_30k.csv',
            Path(os.getcwd()) / 'animes' / 'data' / 'full_catalog_30k.csv',
            Path(__file__).resolve().parent.parent / 'data' / 'anime_master_catalogo.csv',
            Path(__file__).resolve().parent.parent.parent.parent.parent / 'anime_dataset_2018_2026' / 'csv' / 'anime_master_catalogo.csv',
            Path(__file__).resolve().parent.parent.parent.parent / 'anime_dataset_2018_2026' / 'csv' / 'anime_master_catalogo.csv',
            Path(os.getcwd()) / 'animes' / 'data' / 'anime_master_catalogo.csv',
        ]
        csv_path = None
        for p in possible_paths:
            if p.exists():
                csv_path = p
                break

        if not csv_path or not csv_path.exists():
            self.stderr.write(self.style.ERROR("No se encontró el dataset en ninguna de las rutas posibles."))
            return

        is_30k_format = 'full_catalog_30k' in csv_path.name
        self.stdout.write(f"Iniciando carga masiva desde {csv_path.name} (formato 30k: {is_30k_format})...")
        start_time = time.time()

        objects_batch = []
        seen_ids = set()
        total_inserted = 0

        update_fields = [
            'title', 'title_english', 'title_japanese', 'synopsis', 'synopsis_es',
            'image_url', 'banner_url', 'score', 'scored_by', 'popularity', 'rank',
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

                if is_30k_format:
                    title = row.get('title') or f"Anime #{mal_id}"
                    title_english = (row.get('title_english') or '').strip()
                    title_japanese = (row.get('title_japanese') or '').strip()
                    synopsis = (row.get('synopsis') or '').strip()
                    synopsis_es = (row.get('synopsis_es') or '').strip()
                    image_url = (row.get('image_url') or '').strip()
                    banner_url = (row.get('banner_url') or '').strip()
                    
                    score = None
                    if row.get('score'):
                        try:
                            score = round(float(row['score']), 2)
                        except ValueError:
                            pass
                            
                    scored_by = 0
                    if row.get('scored_by'):
                        try:
                            scored_by = int(float(row['scored_by']))
                        except ValueError:
                            pass

                    popularity = None
                    if row.get('popularity'):
                        try:
                            popularity = int(float(row['popularity']))
                        except ValueError:
                            pass

                    rank = None
                    if row.get('rank'):
                        try:
                            rank = int(float(row['rank']))
                        except ValueError:
                            pass

                    episodes = None
                    if row.get('episodes'):
                        try:
                            episodes = int(float(row['episodes']))
                        except ValueError:
                            pass

                    duration = None
                    if row.get('duration'):
                        try:
                            duration = round(float(row['duration']), 2)
                        except ValueError:
                            pass

                    season_year = None
                    if row.get('season_year'):
                        try:
                            season_year = int(float(row['season_year']))
                        except ValueError:
                            pass

                    season = (row.get('season') or '').strip().capitalize()
                    studio = (row.get('studio') or '').strip()
                    status = (row.get('status') or 'FINISHED').strip()
                    type_val = (row.get('type') or 'TV').strip()
                    genres_str = (row.get('genres') or '').strip()
                    genres = [g.strip() for g in genres_str.split(',') if g.strip()] if genres_str else []

                else:
                    title = (row.get('title_userPreferred') or row.get('title_romaji') or '').strip() or f"Anime #{mal_id}"
                    title_english = (row.get('title_english') or '').strip()
                    title_japanese = (row.get('title_native') or '').strip()
                    synopsis = (row.get('description_text') or '').strip()
                    synopsis_es = ''
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

                    if mal_id in (63209, 63208, 63207, 62251, 60234) or (score is not None and score >= 9.0 and scored_by < 200):
                        score = None

                    popularity = None
                    rank = None

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
                    synopsis_es=synopsis_es,
                    image_url=image_url,
                    banner_url=banner_url,
                    score=score,
                    scored_by=scored_by,
                    popularity=popularity,
                    rank=rank,
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
                    self.stdout.write(f"  -> Progreso: {total_inserted} animes cargados...")

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
                f"FINALIZADO: {total_inserted} animes cargados en la base de datos en {elapsed} segundos!"
            )
        )
