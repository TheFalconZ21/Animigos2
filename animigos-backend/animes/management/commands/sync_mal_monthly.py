import datetime
import html
import json
import re
import time
import urllib.request
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from animes.models import Anime, AnimeScoreHistory

UNRATED_ANIME_IDS = {63209, 63208, 63207, 62251, 60234}
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'


class Command(BaseCommand):
    help = "Sincroniza mensualmente notas y animes nuevos desde MyAnimeList de forma conservadora."

    def add_arguments(self, parser):
        parser.add_argument(
            '--scope',
            type=str,
            default='seasonal',
            choices=['seasonal', 'top', 'full'],
            help='Alcance de sincronización: seasonal (temporada actual y próxima), top (mejores animes), full (ambos)'
        )
        parser.add_argument(
            '--pages',
            type=int,
            default=2,
            help='Cantidad de páginas del Top Anime a consultar (50 títulos por página, default: 2 = 100 títulos. Usa 0 para sincronizar todo el ranking disponible en MAL)'
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=2.0,
            help='Pausa en segundos entre peticiones HTTP para evitar bloqueos por rate limit (default: 2.0s)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Modo simulación: consulta sin guardar cambios en la base de datos'
        )

    def handle(self, *args, **options):
        scope = options['scope']
        pages = options['pages']
        delay = options['delay']
        dry_run = options['dry_run']

        today = datetime.date.today()
        # Fecha de referencia del corte mensual (primer día del mes corriente)
        recorded_date = datetime.date(today.year, today.month, 1)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"=== Sincronización Mensual MyAnimeList [{recorded_date.strftime('%B %Y')}] ==="
        ))
        self.stdout.write(f"Alcance: {scope} | Delay entre peticiones: {delay}s | Modo Dry-Run: {dry_run}")

        total_animes_created = 0
        total_animes_updated = 0
        total_history_recorded = 0

        existing_animes = {a.mal_id: a for a in Anime.objects.all()}
        self.stdout.write(f"Animes actualmente en catálogo: {len(existing_animes):,}")

        # -------------------------------------------------------------
        # 1. Sincronización de Animes de Temporada (Descubrimiento de nuevos animes)
        # -------------------------------------------------------------
        if scope in ('seasonal', 'full'):
            seasonal_urls = [
                ('Temporada Actual', 'https://myanimelist.net/anime/season'),
                ('Próxima Temporada', 'https://myanimelist.net/anime/season/later')
            ]

            for season_label, url in seasonal_urls:
                self.stdout.write(f"\nConsultando {season_label} desde {url}...")
                cards = self._fetch_season_page(url)
                self.stdout.write(f"  -> {len(cards)} títulos extraídos.")

                for card in cards:
                    mal_id = card['mal_id']
                    score_val = card['score']

                    # Sanitización de quórum y animes no calificados
                    if mal_id in UNRATED_ANIME_IDS:
                        score_val = None

                    anime = existing_animes.get(mal_id)
                    if not anime:
                        if not dry_run:
                            anime = Anime.objects.create(
                                mal_id=mal_id,
                                title=card['title'],
                                type=card['type'] or 'TV',
                                episodes=card['episodes'],
                                score=score_val,
                                synopsis=card['synopsis'] or 'Sin sinopsis disponible.',
                                image_url=card['image_url'] or '',
                                studio=card['studio'] or '',
                                genres=card['genres'] or [],
                                status='RELEASING' if 'Actual' in season_label else 'NOT_YET_AIRED',
                                season_year=today.year,
                            )
                            existing_animes[mal_id] = anime
                        total_animes_created += 1
                        safe_title = card['title'].encode('ascii', 'replace').decode('ascii')
                        self.stdout.write(self.style.SUCCESS(f"  [NUEVO] #{mal_id}: {safe_title}"))
                    else:
                        if not dry_run:
                            updated_fields = []
                            if score_val is not None and anime.score != score_val:
                                anime.score = score_val
                                updated_fields.append('score')
                            if card['image_url'] and (not anime.image_url or 'placeholder' in anime.image_url):
                                anime.image_url = card['image_url']
                                updated_fields.append('image_url')
                            if card['studio'] and not anime.studio:
                                anime.studio = card['studio']
                                updated_fields.append('studio')
                            if card['genres'] and not anime.genres:
                                anime.genres = card['genres']
                                updated_fields.append('genres')

                            if updated_fields:
                                anime.last_synced_at = timezone.now()
                                updated_fields.append('last_synced_at')
                                anime.save(update_fields=updated_fields)
                                total_animes_updated += 1

                    # Registrar corte mensual en AnimeScoreHistory
                    if not dry_run and anime:
                        AnimeScoreHistory.objects.update_or_create(
                            anime=anime,
                            recorded_at=recorded_date,
                            defaults={
                                'year': today.year,
                                'month': today.month,
                                'score': score_val,
                                'scored_by': anime.scored_by or 0,
                                'members': anime.popularity or 0,
                                'rank': anime.rank,
                                'popularity': anime.popularity,
                            }
                        )
                        total_history_recorded += 1

                # Delay conservador entre páginas
                time.sleep(delay)

        # -------------------------------------------------------------
        # 2. Sincronización de Top Anime (Refresco de notas consolidadas)
        # -------------------------------------------------------------
        if scope in ('top', 'full'):
            desc_pages = f"{pages} páginas ({pages * 50:,} animes)" if pages > 0 else "todo el catálogo disponible en MyAnimeList"
            self.stdout.write(f"\nConsultando Top Anime de MyAnimeList ({desc_pages})...")
            page_idx = 0
            while True:
                if pages > 0 and page_idx >= pages:
                    break

                offset = page_idx * 50
                url = f"https://myanimelist.net/topanime.php?limit={offset}"
                self.stdout.write(f"  Página {page_idx + 1} (offset={offset})...")

                top_items = self._fetch_top_page(url)
                if not top_items:
                    self.stdout.write(self.style.WARNING(f"  -> No se encontraron más animes en offset={offset}. Fin del ranking en MyAnimeList."))
                    break

                for item in top_items:
                    mal_id = item['mal_id']
                    score_val = item['score']
                    rank_val = item['rank']

                    if mal_id in UNRATED_ANIME_IDS:
                        score_val = None

                    anime = existing_animes.get(mal_id)
                    if anime:
                        if not dry_run:
                            anime.score = score_val
                            anime.rank = rank_val
                            anime.last_synced_at = timezone.now()
                            anime.save(update_fields=['score', 'rank', 'last_synced_at'])
                            total_animes_updated += 1

                            AnimeScoreHistory.objects.update_or_create(
                                anime=anime,
                                recorded_at=recorded_date,
                                defaults={
                                    'year': today.year,
                                    'month': today.month,
                                    'score': score_val,
                                    'scored_by': anime.scored_by,
                                    'members': anime.popularity or 0,
                                    'rank': rank_val,
                                    'popularity': anime.popularity,
                                }
                            )
                            total_history_recorded += 1
                    else:
                        # Si no estaba en BD, crearlo
                        if not dry_run:
                            anime = Anime.objects.create(
                                mal_id=mal_id,
                                title=item['title'],
                                score=score_val,
                                rank=rank_val,
                                synopsis='Importado desde Top MyAnimeList.',
                                image_url='https://cdn.myanimelist.net/images/anime/placeholder.jpg',
                            )
                            existing_animes[mal_id] = anime
                            total_animes_created += 1

                            AnimeScoreHistory.objects.update_or_create(
                                anime=anime,
                                recorded_at=recorded_date,
                                defaults={
                                    'year': today.year,
                                    'month': today.month,
                                    'score': score_val,
                                    'rank': rank_val,
                                }
                            )
                            total_history_recorded += 1

                page_idx += 1
                time.sleep(delay)

        if not dry_run:
            cache.clear()

        self.stdout.write(self.style.SUCCESS(
            f"\nSincronización mensual finalizada con éxito:"
            f"\n  - Nuevos animes descubiertos e importados: {total_animes_created}"
            f"\n  - Animes existentes actualizados: {total_animes_updated}"
            f"\n  - Cortes mensuales registrados en historial: {total_history_recorded}"
            f"\n  - Caché del catálogo invalidada."
        ))

    def _fetch_season_page(self, url):
        """Descarga y parsea la página de temporada de MyAnimeList."""
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=12) as resp:
                page_html = resp.read().decode('utf-8', errors='replace')
        except Exception as e:
            self.stderr.write(f"Error al descargar {url}: {e}")
            return []

        results = []
        cards = page_html.split('<div class="js-anime-category-producer seasonal-anime')
        for c in cards[1:]:
            aid_m = re.search(r'href="https://myanimelist.net/anime/(\d+)/', c)
            title_m = re.search(r'class="link-title">([^<]+)</a>', c)
            score_m = re.search(r'<span title="Score"[^>]*>([0-9\.]+)</span>', c)
            img_m = re.search(r'(?:data-src|src)="([^"]+)"', c)
            syn_m = re.search(r'<p class="preline">([^<]+)</p>', c)
            studio_m = re.search(r'<span class="producer"><a[^>]*>([^<]+)</a>', c)
            genre_m = re.findall(r'<span class="genre"><a[^>]*>([^<]+)</a>', c)
            type_m = re.search(r'<span class="source">.*?</span>\s*-\s*(\w+)', c, re.DOTALL)

            if not aid_m or not title_m:
                continue

            aid = int(aid_m.group(1))
            title = html.unescape(title_m.group(1).strip())
            score = None
            if score_m:
                try:
                    s_val = float(score_m.group(1))
                    if s_val > 0:
                        score = round(s_val, 2)
                except ValueError:
                    pass

            img = img_m.group(1).strip() if img_m else ''
            syn = syn_m.group(1).strip() if syn_m else ''
            studio = studio_m.group(1).strip() if studio_m else ''
            genres = [g.strip() for g in genre_m if g.strip()]
            series_type = type_m.group(1).strip() if type_m else 'TV'

            results.append({
                'mal_id': aid,
                'title': title,
                'score': score,
                'image_url': img,
                'synopsis': syn,
                'studio': studio,
                'genres': genres,
                'type': series_type,
                'episodes': None,
            })

        return results

    def _fetch_top_page(self, url):
        """Descarga y parsea la página de Top Anime de MyAnimeList."""
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=12) as resp:
                page_html = resp.read().decode('utf-8', errors='replace')
        except Exception as e:
            self.stderr.write(f"Error al descargar {url}: {e}")
            return []

        results = []
        rows = page_html.split('<tr class="ranking-list">')
        for r in rows[1:]:
            aid_m = re.search(r'href="https://myanimelist.net/anime/(\d+)/', r)
            title_m = re.search(r'alt="Anime:\s*([^"]+)"', r)
            score_m = re.search(r'class="text on score-label[^>]*>([0-9\.]+)</span>', r)
            rank_m = re.search(r'class="[^"]*top-anime-rank-text[^"]*">(\d+)</span>', r)

            if not aid_m:
                continue

            aid = int(aid_m.group(1))
            title = title_m.group(1).strip() if title_m else f"Anime #{aid}"
            score = None
            if score_m:
                try:
                    s_val = float(score_m.group(1))
                    if s_val > 0:
                        score = round(s_val, 2)
                except ValueError:
                    pass

            rank = None
            if rank_m:
                try:
                    rank = int(rank_m.group(1))
                except ValueError:
                    pass

            results.append({
                'mal_id': aid,
                'title': title,
                'score': score,
                'rank': rank,
            })

        return results
