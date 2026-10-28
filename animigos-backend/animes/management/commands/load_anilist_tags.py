import csv
import sys
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from animes.models import Anime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


class Command(BaseCommand):
    help = (
        'Enriquece el catalogo de animes con los tags ponderados de AniList '
        '(anime_tags.csv) y marcas de preludio/secuela (anime_relaciones.csv).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-rank',
            type=int,
            default=45,
            help='Relevancia minima del tag (0-100) para incluirlo (default: 45)',
        )
        parser.add_argument(
            '--max-tags',
            type=int,
            default=18,
            help='Maximo de tags por anime (default: 18)',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=2000,
            help='Tamano de lote para bulk_update (default: 2000)',
        )

    def handle(self, *args, **options):
        min_rank = options['min_rank']
        max_tags = options['max_tags']
        batch_size = options['batch_size']

        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        atributos_dir = base_dir / 'anime_dataset_2018_2026' / 'csv' / 'atributos'
        tags_csv = atributos_dir / 'anime_tags.csv'
        rel_csv = atributos_dir / 'anime_relaciones.csv'

        if not tags_csv.exists():
            self.stderr.write(self.style.ERROR(f"No se encontro {tags_csv}"))
            return

        start_t = time.time()
        self.stdout.write(self.style.NOTICE("[1/3] Leyendo relaciones de secuelas desde anime_relaciones.csv..."))

        sequel_mal_ids = set()
        if rel_csv.exists():
            with open(rel_csv, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        rel_type = (row.get('relation_type') or '').strip().upper()
                        type_to = (row.get('type_to') or '').strip().upper()
                        fmt_to = (row.get('format_to') or '').strip().upper()
                        # Si un anime tiene un PREQUEL que es ANIME (TV/MOVIE/ONA/OVA), entonces este anime es una secuela
                        if rel_type == 'PREQUEL' and type_to == 'ANIME' and fmt_to in ('TV', 'MOVIE', 'ONA', 'OVA', 'TV_SHORT'):
                            mid = int(float(row['mal_id_from']))
                            sequel_mal_ids.add(mid)
                    except (ValueError, TypeError, KeyError):
                        continue

        self.stdout.write(self.style.SUCCESS(f"  -> Detectadas {len(sequel_mal_ids)} secuelas oficiales por grafo de relaciones."))

        self.stdout.write(self.style.NOTICE(f"[2/3] Procesando tags ponderados desde {tags_csv.name} (min_rank={min_rank})..."))
        tags_by_mal = {}
        total_rows = 0

        with open(tags_csv, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                total_rows += 1
                try:
                    if str(row.get('is_adult', '')).lower() == 'true':
                        continue
                    if str(row.get('is_general_spoiler', '')).lower() == 'true':
                        continue

                    rank = int(float(row.get('rank') or 0))
                    if rank < min_rank:
                        continue

                    mid = int(float(row['mal_id']))
                    tag_name = (row.get('tag') or '').strip()
                    if not tag_name:
                        continue

                    category = (row.get('category') or 'Theme').strip()
                    is_spoiler = str(row.get('is_media_spoiler', '')).lower() == 'true'

                    if mid not in tags_by_mal:
                        tags_by_mal[mid] = []

                    tags_by_mal[mid].append({
                        'name': tag_name,
                        'category': category,
                        'rank': rank,
                        'spoiler': is_spoiler,
                    })
                except (ValueError, TypeError, KeyError):
                    continue

        self.stdout.write(self.style.NOTICE(f"[3/3] Actualizando base de datos ({len(tags_by_mal)} animes con tags)..."))

        all_animes = list(Anime.objects.all().only('mal_id', 'tags_data', 'tags_cache', 'genres'))
        to_update = []

        for anime in all_animes:
            mid = anime.mal_id
            raw_tags = tags_by_mal.get(mid, [])
            is_seq = mid in sequel_mal_ids

            if not raw_tags and not is_seq:
                continue

            # Ordenar por rank descendiente y deduplicar por nombre
            seen_names = set()
            clean_tags = []
            for t in sorted(raw_tags, key=lambda x: x['rank'], reverse=True):
                lname = t['name'].lower()
                if lname not in seen_names:
                    seen_names.add(lname)
                    clean_tags.append(t)
                    if len(clean_tags) >= max_tags:
                        break

            # Construir tags_cache indexable
            cache_tokens = [t['name'].lower() for t in clean_tags if not t.get('spoiler')]
            if isinstance(anime.genres, list):
                for g in anime.genres:
                    gl = str(g).lower().strip()
                    if gl and gl not in cache_tokens:
                        cache_tokens.append(gl)
            if is_seq:
                cache_tokens.append('_is_sequel_')

            anime.tags_data = clean_tags
            anime.tags_cache = '|' + '|'.join(cache_tokens) + '|' if cache_tokens else ''
            to_update.append(anime)

        if to_update:
            Anime.objects.bulk_update(to_update, ['tags_data', 'tags_cache'], batch_size=batch_size)

        elapsed = time.time() - start_t
        self.stdout.write(self.style.SUCCESS(
            f"[OK] Enriquecimiento completado: {len(to_update)} animes actualizados de {total_rows} filas de tags en {elapsed:.2f}s."
        ))

