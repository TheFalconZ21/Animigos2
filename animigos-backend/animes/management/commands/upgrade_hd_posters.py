"""
Comando de gestión Django para mejorar la resolución de afiches y banners del Top N animes
usando la API GraphQL oficial de AniList en lotes de 50 (coverImage.extraLarge + bannerImage).

Uso:
    python manage.py upgrade_hd_posters --limit 2000
    python manage.py upgrade_hd_posters --limit 100 --dry-run
"""
import time
import requests
from django.core.management.base import BaseCommand
from django.db.models import F

from animes.models import Anime

ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co'

QUERY_BATCH = """
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      bannerImage
      coverImage {
        extraLarge
        large
      }
    }
  }
}
"""


class Command(BaseCommand):
    help = 'Actualiza image_url (extraLarge) y banner_url del Top N animes más populares desde AniList.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=2000,
            help='Cantidad máxima de animes del Top a procesar (por defecto: 2000).',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Tamaño de lote GraphQL (máximo 50 en AniList).',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=0.75,
            help='Pausa en segundos entre lotes para respetar el rate-limit de AniList.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simula el proceso sin escribir cambios en la base de datos.',
        )

    def handle(self, *args, **options):
        limit = max(1, int(options['limit']))
        batch_size = max(1, min(50, int(options['batch_size'])))
        delay = max(0.2, float(options['delay']))
        dry_run = bool(options['dry_run'])

        qs = (
            Anime.objects.exclude(mal_id__isnull=True)
            .order_by(F('scored_by').desc(nulls_last=True), F('popularity').asc(nulls_last=True), F('score').desc(nulls_last=True))[:limit]
        )
        animes = list(qs)
        total = len(animes)
        if total == 0:
            self.stdout.write(self.style.WARNING('No se encontraron animes en la base de datos.'))
            return

        self.stdout.write(
            self.style.NOTICE(
                f'Iniciando mejora de afiches HD para Top {total} animes '
                f'(lotes de {batch_size}, dry_run={dry_run})...'
            )
        )

        updated_covers = 0
        updated_banners = 0
        batches_ok = 0
        batches_err = 0

        for start in range(0, total, batch_size):
            chunk = animes[start:start + batch_size]
            by_mal_id = {a.mal_id: a for a in chunk}
            ids = list(by_mal_id.keys())

            data = self._fetch_batch(ids)
            if data is None:
                batches_err += 1
                continue

            batches_ok += 1
            media_list = data.get('data', {}).get('Page', {}).get('media') or []
            to_update = []

            for m in media_list:
                mal_id = m.get('idMal')
                anime_obj = by_mal_id.get(mal_id)
                if not anime_obj:
                    continue

                cover = m.get('coverImage') or {}
                best_cover = (cover.get('extraLarge') or cover.get('large') or '').strip()
                best_banner = (m.get('bannerImage') or '').strip()

                changed = False
                if best_cover and best_cover != (anime_obj.image_url or '').strip():
                    anime_obj.image_url = best_cover
                    updated_covers += 1
                    changed = True

                if best_banner and best_banner != (anime_obj.banner_url or '').strip():
                    anime_obj.banner_url = best_banner
                    updated_banners += 1
                    changed = True

                if changed:
                    to_update.append(anime_obj)

            if to_update and not dry_run:
                Anime.objects.bulk_update(to_update, ['image_url', 'banner_url'])

            processed = min(start + batch_size, total)
            if processed % 250 == 0 or processed == total:
                self.stdout.write(
                    f'Progreso: {processed}/{total} · covers HD: {updated_covers} · banners HD: {updated_banners}'
                )

            if processed < total:
                time.sleep(delay)

        mode_label = '[DRY-RUN] ' if dry_run else ''
        self.stdout.write(
            self.style.SUCCESS(
                f'{mode_label}Completado: {batches_ok} lotes OK ({batches_err} errores) · '
                f'{updated_covers} portadas actualizadas a extraLarge · {updated_banners} banners actualizados.'
            )
        )

    def _fetch_batch(self, ids: list[int], retries: int = 3) -> dict | None:
        for attempt in range(retries):
            try:
                resp = requests.post(
                    ANILIST_GRAPHQL_URL,
                    json={'query': QUERY_BATCH, 'variables': {'ids': ids, 'perPage': len(ids)}},
                    headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
                    timeout=20,
                )
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get('Retry-After', '15'))
                    self.stdout.write(self.style.WARNING(f'Rate limit AniList (429). Esperando {retry_after}s...'))
                    time.sleep(retry_after + 1)
                    continue
                self.stdout.write(self.style.WARNING(f'AniList devolvió HTTP {resp.status_code} (intento {attempt + 1})'))
            except requests.RequestException as exc:
                self.stdout.write(self.style.WARNING(f'Error de red AniList: {exc} (intento {attempt + 1})'))
            time.sleep(2 * (attempt + 1))
        return None
