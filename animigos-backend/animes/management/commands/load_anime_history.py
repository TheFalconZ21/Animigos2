import csv
import datetime
import os
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
            default=os.path.join(settings.BASE_DIR, '..', 'anime_dataset_2018_2026', 'csv', 'anime_master_panel_temporal.csv'),
            help='Ruta al archivo anime_master_panel_temporal.csv'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Eliminar historial existente antes de importar'
        )

    def handle(self, *args, **options):
        csv_path = options['csv']
        clear = options['clear']

        if not os.path.exists(csv_path):
            self.stderr.write(self.style.ERROR(f"No se encontró el archivo CSV en: {csv_path}"))
            return

        if clear:
            self.stdout.write("Limpiando registros previos de AnimeScoreHistory...")
            AnimeScoreHistory.objects.all().delete()

        self.stdout.write("Consultando catálogo de animes existentes...")
        valid_anime_ids = set(Anime.objects.values_list('mal_id', flat=True))
        self.stdout.write(f"Animes disponibles en BD: {len(valid_anime_ids):,}")

        self.stdout.write(f"Leyendo panel histórico desde: {csv_path}...")
        history_batch = []
        batch_size = 5000
        total_created = 0
        seen_keys = set()

        with open(csv_path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
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
                dedup_key = (aid, rec_date)
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                # Puntuación y votantes
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

                # Sanitización de quórum y animes no calificados oficialmente
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
                        month=rec_date.month,
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
        self.stdout.write(self.style.SUCCESS(
            f"Histórico temporal cargado exitosamente. Total registros en BD: {AnimeScoreHistory.objects.count():,}"
        ))
