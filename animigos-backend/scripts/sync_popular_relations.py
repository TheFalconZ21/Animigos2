import os
import sys
import django
import json
import time
import urllib.request
from pathlib import Path

BASE_DIR = Path(r"D:\Codigos\Animigos2\animigos-backend")
sys.path.insert(0, str(BASE_DIR))
os.chdir(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from animes.models import Anime
from core.services.fuentes_externas import obtener_relaciones_anime

POPULAR_FRANCHISE_KEYWORDS = [
    'Fate/',
    'JoJo',
    'Shingeki no Kyojin',
    'Bleach',
    'Sousou no Frieren',
    'Jujutsu Kaisen',
    'Kimetsu no Yaiba',
    'Monogatari',
    'Steins;Gate',
    'Gintama',
    'Code Geass',
    'Sword Art Online',
    'Kaguya-sama',
    'Re:Zero',
    'Mushoku Tensei',
    '[Oshi no Ko]',
    'Kusuriya no Hitorigoto',
    'Fullmetal Alchemist',
    'Hunter x Hunter',
    'Boku no Hero Academia',
    'Vinland Saga',
    'Dorohedoro',
    'Chainsaw Man',
    'Spy x Family',
    'Mahoutsukai no Yoru',
    'Witch on the Holy Night',
    'Steel Ball Run',
]

def main():
    print("=== SINCRONIZANDO RELACIONES DE FRANQUICIAS PRINCIPALES ===")

    # Candidatos: animes de franquicias populares O top 100 por nota O 2025-2026
    qs = Anime.objects.none()
    for kw in POPULAR_FRANCHISE_KEYWORDS:
        qs = qs | Anime.objects.filter(title__icontains=kw)

    top_animes = Anime.objects.filter(score__gte=8.5)
    candidates = list((qs | top_animes).filter(relations_data=[]).distinct()[:150])

    print(f"Total animes a sincronizar relaciones: {len(candidates)}")

    updated_count = 0
    for idx, anime in enumerate(candidates, 1):
        try:
            rels = obtener_relaciones_anime(anime.mal_id)
            if rels:
                anime.relations_data = rels
                anime.save(update_fields=['relations_data'])
                updated_count += 1
                print(f"[{idx}/{len(candidates)}] {anime.title}: {len(rels)} relaciones sincronizadas.")
            else:
                print(f"[{idx}/{len(candidates)}] {anime.title}: sin relaciones.")
            time.sleep(0.4)
        except Exception as e:
            print(f"Error con {anime.mal_id}: {e}")
            time.sleep(1.0)

    print(f"\n=== Sincronización completada. {updated_count} animes actualizados. ===")

if __name__ == '__main__':
    main()
