import csv
import datetime
import os
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from animes.models import Anime, AnimeScoreHistory


YEAR_TO_DATE = {
    2018: datetime.date(2018, 2, 1),
    2019: datetime.date(2019, 1, 1),
    2020: datetime.date(2020, 1, 1),
    2021: datetime.date(2021, 1, 1),
    2022: datetime.date(2022, 7, 1),
    2023: datetime.date(2023, 8, 1),
    2024: datetime.date(2024, 5, 1),
    2025: datetime.date(2025, 1, 1),
    2026: datetime.date(2026, 2, 1),
}

UNRATED_ANIME_IDS = {63209, 63208, 63207, 62251, 60234}


class Command(BaseCommand):
    help = "Carga el panel histórico temporal de calificaciones (2018-2026) en AnimeScoreHistory."

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv',
            type=str,
            default='',
            help='Ruta al archivo CSV de histórico'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Eliminar historial existente antes de importar'
        )

    def handle(self, *args, **options):
        csv_path_arg = options['csv']
        clear = options['clear']

        possible_paths = []
        if csv_path_arg:
            possible_paths.append(Path(csv_path_arg))

        possible_paths.extend([
            Path(__file__).resolve().parent.parent / 'data' / 'anime_score_history.csv',
            Path(settings.BASE_DIR) / 'animes' / 'data' / 'anime_score_history.csv',
            Path(os.getcwd()) / 'animes' / 'data' / 'anime_score_history.csv',
            Path(settings.BASE_DIR) / '..' / 'anime_dataset_2018_2026' / 'csv' / 'anime_master_panel_temporal.csv',
            Path(__file__).resolve().parent.parent.parent.parent.parent / 'anime_dataset_2018_2026' / 'csv' / 'anime_master_panel_temporal.csv',
        ])

        csv_path = None
        for p in possible_paths:
            if p and p.exists():
                csv_path = p
                break

        if not csv_path:
            self.stderr.write(self.style.ERROR("No se encontró ningún archivo CSV de histórico temporal."))
            return

        if clear:
            self.stdout.write("Limpiando registros previos de AnimeScoreHistory...")
            AnimeScoreHistory.objects.all().delete()

        self.stdout.write("Consultando catálogo de animes existentes...")
        valid_anime_ids = set(Anime.objects.values_list('mal_id', flat=True))
        self.stdout.write(f"Animes disponibles en BD: {len(valid_anime_ids):,}")

        is_clean_format = 'anime_score_history' in csv_path.name
        self.stdout.write(f"Leyendo panel histórico desde {csv_path.name} (formato limpio: {is_clean_format})...")

        start_time = time.time()
        history_batch = []
        batch_size = 5000
        total_created = 0
        seen_keys = set()

        with open(csv_path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if is_clean_format:
                    aid_str = row.get('anime_id') or ''
                    ano_str = row.get('year') or ''
                    month_str = row.get('month') or ''
                    rec_date_str = row.get('recorded_at') or ''
                    if not aid_str or not ano_str:
                        continue
                    try:
                        aid = int(float(aid_str))
                        ano = int(float(ano_str))
                    except (ValueError, TypeError):
                        continue

                    if aid not in valid_anime_ids:
                        continue

                    try:
                        month = int(float(month_str)) if month_str and month_str.lower() != 'none' else None
                    except ValueError:
                        month = None

                    try:
                        rec_date = datetime.date.fromisoformat(rec_date_str) if rec_date_str else YEAR_TO_DATE.get(ano, datetime.date(ano, 1, 1))
                    except ValueError:
                        rec_date = YEAR_TO_DATE.get(ano, datetime.date(ano, 1, 1))

                    dedup_key = (aid, rec_date)
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)

                    score = None
                    raw_score = (row.get('score') or '').strip()
                    if raw_score and raw_score.lower() != 'none':
                        try:
                            score = round(float(raw_score), 2)
                        except ValueError:
                            pass

                    scored_by = 0
                    sb_str = (row.get('scored_by') or '').strip()
                    if sb_str and sb_str.lower() != 'none':
                        try:
                            scored_by = int(float(sb_str))
                        except ValueError:
                            pass

                    members = 0
                    mem_str = (row.get('members') or '').strip()
                    if mem_str and mem_str.lower() != 'none':
                        try:
                            members = int(float(mem_str))
                        except ValueError:
                            pass

                    rank = None
                    rank_str = (row.get('rank') or '').strip()
                    if rank_str and rank_str.lower() != 'none':
                        try:
                            rank = int(float(rank_str))
                        except ValueError:
                            pass

                    popularity = None
                    pop_str = (row.get('popularity') or '').strip()
                    if pop_str and pop_str.lower() != 'none':
                        try:
                            popularity = int(float(pop_str))
                        except ValueError:
                            pass

                    favorites = None
                    fav_str = (row.get('favorites') or '').strip()
                    if fav_str and fav_str.lower() != 'none':
                        try:
                            favorites = int(float(fav_str))
                        except ValueError:
                            pass

                else:
                    ano_str = row.get('ano') or row.get('\ufeffano')
                    aid_str = row.get('anime_id') or row.get('mal_id')

                    if not ano_str or not aid_str:
                        continue

                    try:
                        ano = int(float(ano_str))
                        aid = int(float(aid_str))
                    except (ValueError, TypeError):
                        continue

                    if aid not in valid_anime_ids:
                        continue

                    rec_date = YEAR_TO_DATE.get(ano, datetime.date(ano, 1, 1))
                    month = rec_date.month
                    dedup_key = (aid, rec_date)
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)

                    score = None
                    raw_score = row.get('score', '').strip()
                    if raw_score and raw_score.lower() != 'nan':
                        try:
                            s_val = float(raw_score)
                            if s_val > 0:
                                score = round(s_val, 2)
                        except ValueError:
                            pass

                    scored_by = 0
                    sb_str = row.get('scored_by', '').strip()
                    if sb_str and sb_str.lower() != 'nan':
                        try:
                            scored_by = int(float(sb_str))
                        except ValueError:
                            pass

                    if aid in UNRATED_ANIME_IDS or (score is not None and score >= 9.0 and scored_by < 200):
                        score = None

                    members = 0
                    mem_str = row.get('members', '').strip()
                    if mem_str and mem_str.lower() != 'nan':
                        try:
                            members = int(float(mem_str))
                        except ValueError:
                            pass

                    rank = None
                    rank_str = row.get('rank', '').strip()
                    if rank_str and rank_str.lower() != 'nan':
                        try:
                            rank = int(float(rank_str))
                        except ValueError:
                            pass

                    popularity = None
                    pop_str = row.get('popularity', '').strip()
                    if pop_str and pop_str.lower() != 'nan':
                        try:
                            popularity = int(float(pop_str))
                        except ValueError:
                            pass

                    favorites = None
                    fav_str = row.get('favorites', '').strip()
                    if fav_str and fav_str.lower() != 'nan':
                        try:
                            favorites = int(float(fav_str))
                        except ValueError:
                            pass

                history_batch.append(
                    AnimeScoreHistory(
                        anime_id=aid,
                        year=ano,
                        month=month,
                        recorded_at=rec_date,
                        score=score,
                        scored_by=scored_by,
                        members=members,
                        rank=rank,
                        popularity=popularity,
                        favorites=favorites,
                    )
                )

                if len(history_batch) >= batch_size:
                    AnimeScoreHistory.objects.bulk_create(history_batch, ignore_conflicts=True)
                    total_created += len(history_batch)
                    self.stdout.write(f"  -> {total_created:,} registros importados...")
                    history_batch.clear()

        if history_batch:
            AnimeScoreHistory.objects.bulk_create(history_batch, ignore_conflicts=True)
            total_created += len(history_batch)

        cache.clear()
        elapsed = round(time.time() - start_time, 2)
        self.stdout.write(self.style.SUCCESS(
            f"Histórico temporal cargado exitosamente: {total_created:,} registros importados en {elapsed}s."
        ))
