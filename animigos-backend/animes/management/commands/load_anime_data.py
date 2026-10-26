import os
import csv
from pathlib import Path
from django.core.management.base import BaseCommand
from animes.models import Anime

class Command(BaseCommand):
    help = 'Carga animes del dataset anime_master_catalogo.csv en la base de datos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=150,
            help='Número máximo de animes a importar (default: 150 para arranque ágil)'
        )
        parser.add_argument(
            '--file',
            type=str,
            default=None,
            help='Ruta personalizada al archivo CSV de catálogo'
        )

    def handle(self, *args, **options):
        limit = options['limit']
        file_path = options['file']

        if not file_path:
            # Buscar en el directorio de datasets de Animigos2
            base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
            file_path = base_dir / 'anime_dataset_2018_2026' / 'csv' / 'anime_master_catalogo.csv'

        csv_path = Path(file_path)
        if not csv_path.exists():
            self.stderr.write(self.style.ERROR(f"No se encontró el archivo de dataset en: {csv_path}"))
            return

        self.stdout.write(f"Iniciando importación desde: {csv_path.name} (Límite: {limit} registros)...")

        created_count = 0
        updated_count = 0

        with open(csv_path, mode='r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            
            for index, row in enumerate(reader):
                if index >= limit:
                    break

                try:
                    mal_id_str = (row.get('mal_id') or row.get('\ufeffmal_id') or '').strip()
                    if not mal_id_str:
                        continue
                    mal_id = int(float(mal_id_str))
                except (ValueError, TypeError):
                    continue

                title = (row.get('title_userPreferred') or row.get('title_romaji') or '').strip()
                if not title:
                    title = f"Anime #{mal_id}"

                title_english = (row.get('title_english') or '').strip()
                title_japanese = (row.get('title_native') or '').strip()
                synopsis = (row.get('description_text') or '').strip()

                image_url = (row.get('coverImage_large') or row.get('coverImage_extraLarge') or '').strip()
                banner_url = (row.get('bannerImage') or '').strip()

                # Score: preferir score_2026 o mean_score_mal_2026
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

                # Animes sin nota oficial en MyAnimeList
                if mal_id in (63209, 63208, 63207, 62251, 60234) or (score is not None and score >= 9.0 and scored_by < 200):
                    score = None

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

                # Géneros
                genres_raw = row.get('generos_2026', '').strip()
                genres = [g.strip() for g in genres_raw.split(',') if g.strip()] if genres_raw else []

                obj, created = Anime.objects.update_or_create(
                    mal_id=mal_id,
                    defaults={
                        'title': title,
                        'title_english': title_english,
                        'title_japanese': title_japanese,
                        'synopsis': synopsis,
                        'image_url': image_url,
                        'banner_url': banner_url,
                        'score': score,
                        'scored_by': scored_by,
                        'episodes': episodes,
                        'duration': duration,
                        'season_year': season_year,
                        'season': season,
                        'studio': studio,
                        'status': status,
                        'type': type_val,
                        'genres': genres,
                    }
                )

                if created:
                    created_count += 1
                else:
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Importación completada con éxito: {created_count} animes creados, {updated_count} actualizados."
            )
        )
