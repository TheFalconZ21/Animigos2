import csv
import sys
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.cache import cache
from animes.models import Anime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


# Mapeo de tags de AniList que enriquecen directamente la lista de géneros principales
TAG_TO_GENRE_PROMOTION = {
    'isekai': 'Isekai',
    'cyberpunk': 'Cyberpunk',
    'real robot': 'Mecha',
    'super robot': 'Mecha',
    'space': 'Space',
    'vampire': 'Vampire',
    'samurai': 'Samurai',
    'martial arts': 'Martial Arts',
    'military': 'Military',
    'historical': 'Historical',
    'parody': 'Parody',
    'school': 'School',
    'psychological': 'Psychological',
    'idol': 'Music',
    'musical theater': 'Music',
    'band': 'Music',
    'mythology': 'Mythology',
    'detective': 'Mystery',
    'revenge': 'Drama',
    'tragedy': 'Drama',
    'coming of age': 'Drama',
    'gore': 'Horror',
    'body horror': 'Horror',
    'cosmic horror': 'Horror',
}

CATEGORY_TO_FALLBACK_GENRE = {
    'theme-action': 'Action',
    'theme-adventure': 'Adventure',
    'theme-comedy': 'Comedy',
    'theme-drama': 'Drama',
    'theme-fantasy': 'Fantasy',
    'theme-romance': 'Romance',
    'theme-sci-fi': 'Sci-Fi',
    'theme-sci-fi-mecha': 'Mecha',
    'theme-slice of life': 'Slice of Life',
    'theme-arts': 'Music',
    'theme-game': 'Game',
}


class Command(BaseCommand):
    help = (
        'Enriquece el catalogo de animes con los tags ponderados de AniList '
        '(anime_tags.csv), generos (anime_generos_2026.csv) y marcas de secuela (anime_relaciones.csv).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-rank',
            type=int,
            default=40,
            help='Relevancia minima del tag (0-100) para incluirlo (default: 40)',
        )
        parser.add_argument(
            '--max-tags',
            type=int,
            default=22,
            help='Maximo de tags por anime (default: 22)',
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
        gen_csv = atributos_dir / 'anime_generos_2026.csv'

        if not tags_csv.exists():
            self.stderr.write(self.style.ERROR(f"No se encontro {tags_csv}"))
            return

        start_t = time.time()
        self.stdout.write(self.style.NOTICE("[1/4] Leyendo relaciones de secuelas desde anime_relaciones.csv..."))

        sequel_mal_ids = set()
        if rel_csv.exists():
            with open(rel_csv, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        rel_type = (row.get('relation_type') or '').strip().upper()
                        type_to = (row.get('type_to') or '').strip().upper()
                        fmt_to = (row.get('format_to') or '').strip().upper()
                        # Solo consideramos precuela real si fue una serie TV completa o pelicula principal, nunca un OVA/especial/corto
                        if rel_type == 'PREQUEL' and type_to == 'ANIME' and fmt_to in ('TV', 'MOVIE'):
                            mid = int(float(row['mal_id_from']))
                            sequel_mal_ids.add(mid)
                    except (ValueError, TypeError, KeyError):
                        continue

        self.stdout.write(self.style.SUCCESS(f"  -> Detectadas {len(sequel_mal_ids)} secuelas oficiales."))

        self.stdout.write(self.style.NOTICE("[2/4] Leyendo generos oficiales desde anime_generos_2026.csv..."))
        csv_genres_by_mal = {}
        if gen_csv.exists():
            with open(gen_csv, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        mid = int(float(row['mal_id']))
                        g = (row.get('genre') or '').strip()
                        if g:
                            csv_genres_by_mal.setdefault(mid, []).append(g)
                    except (ValueError, TypeError, KeyError):
                        continue

        self.stdout.write(self.style.NOTICE(f"[3/4] Procesando tags ponderados desde {tags_csv.name} (min_rank={min_rank})..."))
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

        self.stdout.write(self.style.NOTICE("[4/4] Enriqueciendo generos y reconstruyendo indice de taxonomia en todos los animes..."))

        all_animes = list(Anime.objects.all().only('mal_id', 'title', 'title_english', 'type', 'tags_data', 'tags_cache', 'genres'))
        to_update = []
        categorized_empty = 0
        isekai_count = 0

        for anime in all_animes:
            mid = anime.mal_id
            raw_tags = tags_by_mal.get(mid, [])
            is_seq = mid in sequel_mal_ids

            # 1. Consolidar lista de géneros base
            current_genres = list(anime.genres) if isinstance(anime.genres, list) else []
            for cg in csv_genres_by_mal.get(mid, []):
                if cg not in current_genres:
                    current_genres.append(cg)

            # 2. Ordenar y deduplicar tags de AniList
            seen_names = set()
            clean_tags = []
            for t in sorted(raw_tags, key=lambda x: x['rank'], reverse=True):
                lname = t['name'].lower()
                if lname not in seen_names:
                    seen_names.add(lname)
                    clean_tags.append(t)
                    if len(clean_tags) >= max_tags:
                        break

            # Si no había tags en CSV pero ya tenía tags_data en DB, conservarlos
            if not clean_tags and isinstance(anime.tags_data, list) and anime.tags_data:
                clean_tags = anime.tags_data

            # 3. Promover tags temáticos clave a géneros (ej: Isekai, Mecha, Cyberpunk, etc.)
            for t in clean_tags:
                if t.get('spoiler'):
                    continue
                t_lower = str(t.get('name', '')).lower().strip()
                t_rank = int(t.get('rank') or 0)
                if t_lower == 'isekai' and t_rank >= 45:
                    if 'Isekai' not in current_genres:
                        current_genres.append('Isekai')
                elif t_lower in TAG_TO_GENRE_PROMOTION and t_rank >= 68:
                    promoted = TAG_TO_GENRE_PROMOTION[t_lower]
                    if promoted not in current_genres:
                        current_genres.append(promoted)

            # Heurística por título para obras con "Isekai" explícito en el título
            title_combined = f"{anime.title or ''} {anime.title_english or ''}".lower()
            if 'isekai' in title_combined:
                if 'Isekai' not in current_genres:
                    current_genres.append('Isekai')
                if not any(str(t.get('name', '')).lower() == 'isekai' for t in clean_tags):
                    clean_tags.insert(0, {'name': 'Isekai', 'category': 'Theme-Fantasy', 'rank': 85, 'spoiler': False})

            # 4. Si el anime seguía sin géneros, inferir de las categorías de sus tags o de su formato
            if not current_genres:
                for t in clean_tags:
                    cat_lower = str(t.get('category', '')).lower().strip()
                    if cat_lower in CATEGORY_TO_FALLBACK_GENRE:
                        fg = CATEGORY_TO_FALLBACK_GENRE[cat_lower]
                        if fg not in current_genres:
                            current_genres.append(fg)
                if not current_genres and str(anime.type or '').upper() == 'MUSIC':
                    current_genres.append('Music')
                if current_genres:
                    categorized_empty += 1

            if 'Isekai' in current_genres:
                isekai_count += 1

            # 5. Construir tags_cache indexable (incluyendo TANTO genres COMO tags_data en minúsculas)
            cache_tokens = []
            for g in current_genres:
                gl = str(g).lower().strip()
                if gl and gl not in cache_tokens:
                    cache_tokens.append(gl)

            for t in clean_tags:
                if not t.get('spoiler'):
                    tl = str(t.get('name', '')).lower().strip()
                    if tl and tl not in cache_tokens:
                        cache_tokens.append(tl)

            if is_seq:
                cache_tokens.append('_is_sequel_')

            new_cache = '|' + '|'.join(cache_tokens) + '|' if cache_tokens else ''

            if (
                anime.genres != current_genres
                or anime.tags_data != clean_tags
                or anime.tags_cache != new_cache
            ):
                anime.genres = current_genres
                anime.tags_data = clean_tags
                anime.tags_cache = new_cache
                to_update.append(anime)

        if to_update:
            Anime.objects.bulk_update(to_update, ['genres', 'tags_data', 'tags_cache'], batch_size=batch_size)

        cache.clear()
        elapsed = time.time() - start_t
        self.stdout.write(self.style.SUCCESS(
            f"[OK] Enriquecimiento completado en {elapsed:.2f}s: {len(to_update)} animes actualizados, "
            f"{isekai_count} animes catalogados con Isekai, {categorized_empty} animes sin genero recuperados."
        ))
