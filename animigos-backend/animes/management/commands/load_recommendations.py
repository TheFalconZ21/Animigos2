import csv
import math
import sys
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from animes.models import Anime, AnimeRecommendation

# Ensure safe printing on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

class Command(BaseCommand):
    help = 'Carga el grafo de co-recomendaciones entre animes y calcula el indice de polarizacion'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-polarization',
            action='store_true',
            help='Saltar el calculo de polarizacion'
        )
        parser.add_argument(
            '--skip-recommendations',
            action='store_true',
            help='Saltar la carga de recomendaciones'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=3000,
            help='Tamano de lote para bulk operations (default: 3000)'
        )

    def handle(self, *args, **options):
        skip_pol = options['skip_polarization']
        skip_rec = options['skip_recommendations']
        batch_size = options['batch_size']

        base_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
        dataset_dir = base_dir / 'anime_dataset_2018_2026' / 'csv'

        # =====================================================================
        # 1. CALCULO DE INDICE DE POLARIZACION
        # =====================================================================
        if not skip_pol:
            dist_csv = dataset_dir / 'atributos' / 'anime_distribucion_score.csv'
            if dist_csv.exists():
                self.stdout.write(self.style.NOTICE("[1/2] Calculando indice de polarizacion desde anime_distribucion_score.csv..."))
                start_pol = time.time()

                # Agrupar scores por anime
                data_by_mal = {}
                with open(dist_csv, mode='r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    for r in reader:
                        try:
                            mid = int(float(r['mal_id']))
                            score = float(r['score_anilist']) / 10.0
                            amount = int(float(r['amount']))
                            if mid not in data_by_mal:
                                data_by_mal[mid] = []
                            data_by_mal[mid].append((score, amount))
                        except (ValueError, TypeError, KeyError):
                            continue

                # Calcular desviacion estandar (polarizacion)
                animes_to_update = []
                existing_animes = {a.mal_id: a for a in Anime.objects.all()}

                for mid, scores in data_by_mal.items():
                    anime = existing_animes.get(mid)
                    if not anime:
                        continue
                    total_n = sum(amt for _, amt in scores)
                    if total_n < 5:
                        anime.polarization_index = 0.00
                    else:
                        mean = sum(s * amt for s, amt in scores) / total_n
                        variance = sum(amt * ((s - mean) ** 2) for s, amt in scores) / total_n
                        anime.polarization_index = round(math.sqrt(variance), 2)
                    animes_to_update.append(anime)

                if animes_to_update:
                    Anime.objects.bulk_update(
                        animes_to_update,
                        ['polarization_index'],
                        batch_size=batch_size
                    )
                    elapsed = time.time() - start_pol
                    self.stdout.write(self.style.SUCCESS(
                        f"[OK] Indice de polarizacion actualizado para {len(animes_to_update)} animes en {elapsed:.2f}s"
                    ))
            else:
                self.stderr.write(self.style.WARNING(f"Archivo no encontrado: {dist_csv}"))

        # =====================================================================
        # 2. CARGA DEL GRAFO DE CO-RECOMENDACIONES
        # =====================================================================
        if not skip_rec:
            dim_csv = dataset_dir / 'dim' / 'anime.csv'
            recom_csv = dataset_dir / 'atributos' / 'anime_recomendaciones.csv'

            if not dim_csv.exists() or not recom_csv.exists():
                self.stderr.write(self.style.ERROR("Faltan archivos necesarios en el dataset"))
                return

            self.stdout.write(self.style.NOTICE("[2/2] Construyendo grafo de co-recomendaciones..."))
            start_rec = time.time()

            # Mapeo AniList -> MAL
            anilist_to_mal = {}
            with open(dim_csv, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    aid = r.get('id')
                    mid = r.get('mal_id')
                    if aid and mid and aid.strip() and mid.strip():
                        try:
                            anilist_to_mal[aid.strip()] = int(float(mid.strip()))
                        except ValueError:
                            pass

            self.stdout.write(f"Mapeo AniList -> MAL cargado ({len(anilist_to_mal)} referencias)")

            existing_mal_ids = set(Anime.objects.values_list('mal_id', flat=True))
            edges = {}  # (source_id, target_id) -> max_strength

            with open(recom_csv, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    try:
                        source_id = int(float(r['mal_id_from']))
                        raw_to = r.get('anilist_id_to')
                        if not raw_to or not raw_to.strip():
                            continue
                        aid = str(int(float(raw_to)))
                        target_id = anilist_to_mal.get(aid)

                        if not target_id or source_id == target_id:
                            continue

                        if source_id not in existing_mal_ids or target_id not in existing_mal_ids:
                            continue

                        strength = int(float(r.get('rating', 1)))
                        pair = (source_id, target_id)
                        if pair not in edges or strength > edges[pair]:
                            edges[pair] = strength
                    except Exception:
                        continue

            self.stdout.write(f"Aristas unicas validas listas para importar: {len(edges)}")

            # Limpiar recomendaciones previas si se desea recargar en limpio
            AnimeRecommendation.objects.all().delete()

            recom_batch = []
            total_saved = 0

            for (src, tgt), str_val in edges.items():
                recom_batch.append(
                    AnimeRecommendation(
                        source_id=src,
                        target_id=tgt,
                        strength=str_val
                    )
                )
                if len(recom_batch) >= batch_size:
                    AnimeRecommendation.objects.bulk_create(recom_batch, batch_size=batch_size, ignore_conflicts=True)
                    total_saved += len(recom_batch)
                    recom_batch = []
                    self.stdout.write(f"  Guardadas {total_saved} de {len(edges)} recomendaciones...", ending='\r')

            if recom_batch:
                AnimeRecommendation.objects.bulk_create(recom_batch, batch_size=batch_size, ignore_conflicts=True)
                total_saved += len(recom_batch)

            elapsed_rec = time.time() - start_rec
            self.stdout.write(self.style.SUCCESS(
                f"\n[OK] Total de {total_saved} co-recomendaciones guardadas exitosamente en {elapsed_rec:.2f}s"
            ))
