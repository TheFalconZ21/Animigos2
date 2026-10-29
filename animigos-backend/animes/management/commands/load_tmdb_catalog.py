import csv
import sys
import time
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand
from animes.models import ExternalReferenceMedia

class Command(BaseCommand):
    help = "Carga e indexa películas y series de los datasets de TMDB para el recomendador"

    def add_arguments(self, parser):
        parser.add_argument(
            '--movies-path',
            type=str,
            default=r"D:\Codigos\Visualizacion\dataset peliculas\TMDB_movie_dataset_v11.csv",
            help="Ruta al archivo CSV de películas de TMDB"
        )
        parser.add_argument(
            '--series-path',
            type=str,
            default=r"D:\Codigos\Visualizacion\dataset series\TMDB_tv_dataset_v3.csv",
            help="Ruta al archivo CSV de series de TMDB"
        )
        parser.add_argument(
            '--min-votes-movie',
            type=int,
            default=15,
            help="Votos mínimos para incluir una película (elimina ruido y títulos oscuros)"
        )
        parser.add_argument(
            '--min-votes-tv',
            type=int,
            default=10,
            help="Votos mínimos para incluir una serie de TV"
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=2000,
            help="Tamaño de lote para bulk_create"
        )

    def handle(self, *args, **options):
        movies_path = options['movies_path']
        series_path = options['series_path']
        min_votes_movie = options['min_votes_movie']
        min_votes_tv = options['min_votes_tv']
        batch_size = options['batch_size']

        start_time = time.time()
        self.stdout.write(self.style.NOTICE("Iniciando ingesta de catálogo TMDB (Fase 1)..."))

        # Aumentar límite de tamaño de campo CSV para descripciones o keywords largas
        csv.field_size_limit(10 * 1024 * 1024)

        # -------------------------------------------------------------
        # 1. CARGA DE PELÍCULAS
        # -------------------------------------------------------------
        self.stdout.write(f"Procesando películas desde {movies_path} (mínimo {min_votes_movie} votos)...")
        movies_created = 0
        batch = []

        try:
            with open(movies_path, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('adult') in ['True', 'true', True]:
                        continue

                    title = (row.get('title') or '').strip()
                    poster = (row.get('poster_path') or '').strip()
                    if not title or not poster:
                        continue

                    try:
                        raw_vc = row.get('vote_count', 0)
                        vc = int(float(raw_vc or 0))
                    except (ValueError, TypeError):
                        vc = 0

                    if vc < min_votes_movie:
                        continue

                    try:
                        raw_id = row.get('id', 0)
                        tmdb_id = int(float(raw_id or 0))
                    except (ValueError, TypeError):
                        continue

                    try:
                        raw_va = row.get('vote_average', 0)
                        va = round(Decimal(str(raw_va or 0)), 2)
                    except (InvalidOperation, ValueError, TypeError):
                        va = None

                    try:
                        raw_pop = row.get('popularity', 0)
                        pop = round(Decimal(str(raw_pop or 0)), 3)
                    except (InvalidOperation, ValueError, TypeError):
                        pop = Decimal(0)

                    rel_date = (row.get('release_date') or '').strip()
                    year = rel_date[:4] if len(rel_date) >= 4 and rel_date[:4].isdigit() else ''

                    genres_raw = row.get('genres', '') or ''
                    genres_list = [g.strip() for g in genres_raw.split(',') if g.strip()]

                    keywords_raw = row.get('keywords', '') or ''
                    keywords_list = [k.strip() for k in keywords_raw.split(',') if k.strip()]

                    poster_url = f"https://image.tmdb.org/t/p/w500{poster}" if poster.startswith('/') else poster
                    backdrop = (row.get('backdrop_path') or '').strip()
                    backdrop_url = f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop.startswith('/') else backdrop

                    overview = (row.get('overview') or '').strip()
                    orig_title = (row.get('original_title') or '').strip()

                    obj = ExternalReferenceMedia(
                        tmdb_id=tmdb_id,
                        media_type='movie',
                        title=title[:400],
                        original_title=orig_title[:400],
                        release_year=year,
                        poster_path=poster_url,
                        backdrop_path=backdrop_url,
                        vote_average=va,
                        vote_count=vc,
                        popularity=pop,
                        overview=overview,
                        genres=genres_list,
                        keywords=keywords_list[:30],
                    )
                    batch.append(obj)

                    if len(batch) >= batch_size:
                        ExternalReferenceMedia.objects.bulk_create(batch, ignore_conflicts=True)
                        movies_created += len(batch)
                        batch = []
                        if movies_created % 10000 == 0:
                            self.stdout.write(f"  -> {movies_created:,} películas indexadas...")

            if batch:
                ExternalReferenceMedia.objects.bulk_create(batch, ignore_conflicts=True)
                movies_created += len(batch)
                batch = []

            self.stdout.write(self.style.SUCCESS(f"Películas indexadas con éxito: {movies_created:,}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error procesando películas: {e}"))

        # -------------------------------------------------------------
        # 2. CARGA DE SERIES DE TV
        # -------------------------------------------------------------
        self.stdout.write(f"Procesando series desde {series_path} (mínimo {min_votes_tv} votos)...")
        series_created = 0
        batch = []

        try:
            with open(series_path, 'r', encoding='utf-8', errors='replace') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('adult') in ['True', 'true', True]:
                        continue

                    title = (row.get('name') or '').strip()
                    poster = (row.get('poster_path') or '').strip()
                    if not title or not poster:
                        continue

                    try:
                        raw_vc = row.get('vote_count', 0)
                        vc = int(float(raw_vc or 0))
                    except (ValueError, TypeError):
                        vc = 0

                    if vc < min_votes_tv:
                        continue

                    try:
                        raw_id = row.get('id', 0)
                        tmdb_id = int(float(raw_id or 0))
                    except (ValueError, TypeError):
                        continue

                    try:
                        raw_va = row.get('vote_average', 0)
                        va = round(Decimal(str(raw_va or 0)), 2)
                    except (InvalidOperation, ValueError, TypeError):
                        va = None

                    try:
                        raw_pop = row.get('popularity', 0)
                        pop = round(Decimal(str(raw_pop or 0)), 3)
                    except (InvalidOperation, ValueError, TypeError):
                        pop = Decimal(0)

                    first_air = (row.get('first_air_date') or '').strip()
                    year = first_air[:4] if len(first_air) >= 4 and first_air[:4].isdigit() else ''

                    genres_raw = row.get('genres', '') or ''
                    genres_list = [g.strip() for g in genres_raw.split(',') if g.strip()]

                    seasons = None
                    try:
                        if row.get('number_of_seasons'):
                            seasons = int(float(row.get('number_of_seasons')))
                    except (ValueError, TypeError):
                        pass

                    episodes = None
                    try:
                        if row.get('number_of_episodes'):
                            episodes = int(float(row.get('number_of_episodes')))
                    except (ValueError, TypeError):
                        pass

                    poster_url = f"https://image.tmdb.org/t/p/w500{poster}" if poster.startswith('/') else poster
                    backdrop = (row.get('backdrop_path') or '').strip()
                    backdrop_url = f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop.startswith('/') else backdrop

                    overview = (row.get('overview') or '').strip()
                    orig_title = (row.get('original_name') or '').strip()

                    obj = ExternalReferenceMedia(
                        tmdb_id=tmdb_id,
                        media_type='tv',
                        title=title[:400],
                        original_title=orig_title[:400],
                        release_year=year,
                        poster_path=poster_url,
                        backdrop_path=backdrop_url,
                        vote_average=va,
                        vote_count=vc,
                        popularity=pop,
                        overview=overview,
                        genres=genres_list,
                        keywords=[],
                        number_of_seasons=seasons,
                        number_of_episodes=episodes,
                    )
                    batch.append(obj)

                    if len(batch) >= batch_size:
                        ExternalReferenceMedia.objects.bulk_create(batch, ignore_conflicts=True)
                        series_created += len(batch)
                        batch = []
                        if series_created % 5000 == 0:
                            self.stdout.write(f"  -> {series_created:,} series indexadas...")

            if batch:
                ExternalReferenceMedia.objects.bulk_create(batch, ignore_conflicts=True)
                series_created += len(batch)
                batch = []

            self.stdout.write(self.style.SUCCESS(f"Series indexadas con éxito: {series_created:,}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error procesando series: {e}"))

        total_in_db = ExternalReferenceMedia.objects.count()
        total_movies = ExternalReferenceMedia.objects.filter(media_type='movie').count()
        total_tv = ExternalReferenceMedia.objects.filter(media_type='tv').count()
        elapsed = round(time.time() - start_time, 1)

        self.stdout.write(self.style.SUCCESS(
            f"\n¡Fase 1 completada exitosamente en {elapsed}s!\n"
            f"Total registros en Base de Datos: {total_in_db:,}\n"
            f"  - Películas: {total_movies:,}\n"
            f"  - Series de TV: {total_tv:,}\n"
        ))

