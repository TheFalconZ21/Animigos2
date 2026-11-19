import os
import sys
import django
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.chdir(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from animes.models import Anime, AnimeRecommendation
from django.db.models import Q

DELIMITERS = [
    ' Movie:',
    ' Movie 2:',
    ' Movie 3:',
    ' Movie 4:',
    ' Movie',
    ' 2nd Season',
    ' 3rd Season',
    ' 4th Season',
    ' 5th Season',
    ' Season 2',
    ' Season 3',
    ' Season 4',
    ' Part 2',
    ' Part 3',
    ' Part 4',
    ' Part 6',
    ' Part 7',
    ': Kanketsu-hen',
    ': Saishuushou',
]

def build_tags_cache(genres, tags_data, is_sequel=False):
    tokens = []
    for g in genres:
        gl = str(g).lower().strip()
        if gl and gl not in tokens:
            tokens.append(gl)
    for t in tags_data:
        if not t.get('spoiler'):
            tl = str(t.get('name', '')).lower().strip()
            if tl and tl not in tokens:
                tokens.append(tl)
    if is_sequel:
        tokens.append('_is_sequel_')
    return '|' + '|'.join(tokens) + '|' if tokens else ''

def main():
    qs = Anime.objects.filter(
        Q(tags_data=[]) | Q(synopsis='Importado desde Top MyAnimeList.') | Q(studio='') | Q(season_year__isnull=True)
    )
    print(f"Candidatos para herencia de franquicia: {qs.count()}")
    updated_count = 0

    for a in qs:
        title = a.title
        base_title = None
        for delim in DELIMITERS:
            if delim in title:
                base_title = title.split(delim)[0].strip()
                break

        if not base_title and ':' in title:
            base_title = title.split(':')[0].strip()

        if not base_title or len(base_title) < 4:
            continue

        parent = (
            Anime.objects.filter(title__istartswith=base_title)
            .exclude(mal_id=a.mal_id)
            .exclude(studio='')
            .exclude(genres=[])
            .exclude(tags_data=[])
            .order_by('-score')
            .first()
        )

        if not parent:
            continue

        modified = False
        if (not a.studio or a.studio == '') and parent.studio:
            a.studio = parent.studio
            modified = True
        if (not a.genres or len(a.genres) == 0) and parent.genres:
            a.genres = list(parent.genres)
            modified = True
        if (not a.tags_data or len(a.tags_data) == 0) and parent.tags_data:
            a.tags_data = list(parent.tags_data)
            modified = True
        if not a.season and parent.season:
            a.season = parent.season
            modified = True
        if not a.season_year and parent.season_year:
            # Si es secuela sin año, heredar o tomar año cercano
            a.season_year = parent.season_year + 1 if parent.season_year else 2026
            modified = True
        if ('Importado desde Top MyAnimeList' in a.synopsis or not a.synopsis) and parent.synopsis and 'Importado' not in parent.synopsis:
            a.synopsis = f"{title}. Continuación y parte de la aclamada saga de {parent.title}.\n\n{parent.synopsis[:300]}..."
            modified = True

        if modified:
            a.tags_cache = build_tags_cache(a.genres, a.tags_data, is_sequel=True)
            a.save()
            updated_count += 1

            # Vincular en AnimeRecommendation
            AnimeRecommendation.objects.update_or_create(
                source=a,
                target=parent,
                defaults={'strength': 30}
            )
            AnimeRecommendation.objects.update_or_create(
                source=parent,
                target=a,
                defaults={'strength': 20}
            )

    print(f"Herencia completada. Animes actualizados: {updated_count}")

if __name__ == '__main__':
    main()
