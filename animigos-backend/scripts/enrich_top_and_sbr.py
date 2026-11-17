import os
import sys
import django
import json
import time
import urllib.request
import re
from pathlib import Path

BASE_DIR = Path(r"D:\Codigos\Animigos2\animigos-backend")
sys.path.insert(0, str(BASE_DIR))
os.chdir(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.cache import cache
from django.db.models import Q
from animes.models import Anime, AnimeRecommendation

def clean_html(raw_html):
    if not raw_html:
        return ""
    clean = re.sub(r'<br\s*/?>', '\n', raw_html)
    clean = re.sub(r'<.*?>', '', clean)
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    return clean.strip()

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
    'cowboys': 'Adventure',
    'gore': 'Horror',
    'body horror': 'Horror',
    'cosmic horror': 'Horror',
}

SEASON_NAMES = {
    'FALL': 'Fall',
    'SPRING': 'Spring',
    'SUMMER': 'Summer',
    'WINTER': 'Winter',
}

def query_anilist_batch(mal_ids):
    query = """
    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(idMal_in: $ids, type: ANIME) {
          id
          idMal
          title { romaji english native }
          season
          seasonYear
          startDate { year month day }
          episodes
          duration
          status
          format
          description
          studios {
            nodes {
              name
              isAnimationStudio
            }
          }
          genres
          tags {
            name
            category
            rank
            isMediaSpoiler
            isGeneralSpoiler
          }
          coverImage { extraLarge large medium }
          bannerImage
          recommendations(sort: RATING_DESC, perPage: 8) {
            nodes {
              rating
              mediaRecommendation {
                idMal
                title { romaji english }
              }
            }
          }
        }
      }
    }
    """
    req = urllib.request.Request(
        'https://graphql.anilist.co',
        data=json.dumps({'query': query, 'variables': {'ids': mal_ids}}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'Animigos/1.0'}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        res = json.loads(r.read().decode('utf-8'))
        return res.get('data', {}).get('Page', {}).get('media', [])

def query_anilist_single_search(title):
    clean_title = (
        title.split('Part')[0]
        .split('Season')[0]
        .split('2nd')[0]
        .split('3rd')[0]
        .split('4th')[0]
        .split(':')[0]
        .strip()
    )
    if len(clean_title) < 3:
        clean_title = title
    query = """
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        idMal
        title { romaji english native }
        season
        seasonYear
        startDate { year month day }
        episodes
        duration
        status
        format
        description
        studios {
          nodes {
            name
            isAnimationStudio
          }
        }
        genres
        tags {
          name
          category
          rank
          isMediaSpoiler
          isGeneralSpoiler
        }
        coverImage { extraLarge large medium }
        bannerImage
        recommendations(sort: RATING_DESC, perPage: 8) {
          nodes {
            rating
            mediaRecommendation {
              idMal
              title { romaji english }
            }
          }
        }
      }
    }
    """
    req = urllib.request.Request(
        'https://graphql.anilist.co',
        data=json.dumps({'query': query, 'variables': {'search': clean_title}}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'Animigos/1.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read().decode('utf-8'))
            return res.get('data', {}).get('Media')
    except Exception:
        return None

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

def enrich_anime_record(anime: Anime, media: dict) -> bool:
    updated = False

    # 1. Season & Season Year
    raw_season = media.get('season')
    if raw_season and (not anime.season or anime.season.strip() == ''):
        anime.season = SEASON_NAMES.get(raw_season.upper(), raw_season.capitalize())
        updated = True

    s_year = media.get('seasonYear')
    start_date = media.get('startDate') or {}
    if not s_year and start_date.get('year'):
        s_year = start_date['year']

    if s_year and not anime.season_year:
        anime.season_year = int(s_year)
        updated = True

    # If season is still empty but we have month, infer season
    if (not anime.season or anime.season.strip() == '') and start_date.get('month'):
        m = start_date['month']
        if m in (1, 2, 3): anime.season = 'Winter'
        elif m in (4, 5, 6): anime.season = 'Spring'
        elif m in (7, 8, 9): anime.season = 'Summer'
        elif m in (10, 11, 12): anime.season = 'Fall'
        updated = True

    # 2. Episodes & Duration
    eps = media.get('episodes')
    if eps and anime.episodes is None:
        anime.episodes = int(eps)
        updated = True
    elif anime.episodes is None and (media.get('format') == 'MOVIE' or anime.type == 'Movie'):
        anime.episodes = 1
        updated = True

    dur = media.get('duration')
    if dur and (anime.duration is None or anime.duration == 0):
        anime.duration = float(dur)
        updated = True

    # 3. Type / Format
    fmt = media.get('format')
    if fmt and (not anime.type or anime.type == '' or anime.type == 'TV'):
        if fmt == 'MOVIE':
            anime.type = 'Movie'
            updated = True
        elif fmt in ('OVA', 'ONA', 'SPECIAL'):
            anime.type = fmt
            updated = True

    # 4. Status
    st = media.get('status')
    if st and st != anime.status:
        # If anime is not yet released or releasing
        if st in ('NOT_YET_RELEASED', 'RELEASING'):
            anime.status = st
            updated = True

    # 5. Studios
    studios_nodes = media.get('studios', {}).get('nodes', [])
    if studios_nodes and (not anime.studio or anime.studio.strip() == ''):
        anim_studios = [s['name'] for s in studios_nodes if s.get('isAnimationStudio') and s.get('name')]
        chosen = anim_studios[0] if anim_studios else studios_nodes[0].get('name')
        if chosen:
            anime.studio = chosen[:100]
            updated = True

    # 6. Titles
    titles = media.get('title') or {}
    eng = titles.get('english')
    if eng and (not anime.title_english or anime.title_english.strip() == ''):
        anime.title_english = eng[:300]
        updated = True
    native = titles.get('native')
    if native and (not anime.title_japanese or anime.title_japanese.strip() == ''):
        anime.title_japanese = native[:300]
        updated = True

    # 7. Synopsis
    clean_desc = clean_html(media.get('description'))
    if clean_desc and (not anime.synopsis or 'Importado desde Top MyAnimeList' in anime.synopsis or len(anime.synopsis) < 40):
        anime.synopsis = clean_desc
        updated = True

    # 8. Genres & Tags
    ani_genres = media.get('genres', []) or []
    ani_tags = media.get('tags', []) or []

    current_genres = list(anime.genres) if isinstance(anime.genres, list) else []
    for g in ani_genres:
        if g not in current_genres:
            current_genres.append(g)

    clean_tags = list(anime.tags_data) if isinstance(anime.tags_data, list) and anime.tags_data else []
    seen_tags = {t.get('name', '').lower() for t in clean_tags}

    for t in sorted(ani_tags, key=lambda x: x.get('rank', 0), reverse=True):
        tname = t.get('name', '').strip()
        lname = tname.lower()
        if not lname or lname in seen_tags:
            continue
        seen_tags.add(lname)
        spoiler = bool(t.get('isMediaSpoiler') or t.get('isGeneralSpoiler'))
        clean_tags.append({
            'name': tname,
            'category': t.get('category', ''),
            'rank': int(t.get('rank', 0)),
            'spoiler': spoiler,
        })
        if len(clean_tags) >= 22:
            break

    for t in clean_tags:
        if t.get('spoiler'):
            continue
        tl = t['name'].lower()
        tr = t['rank']
        if tl in TAG_TO_GENRE_PROMOTION and tr >= 60:
            promoted = TAG_TO_GENRE_PROMOTION[tl]
            if promoted not in current_genres:
                current_genres.append(promoted)

    if current_genres != anime.genres:
        anime.genres = current_genres
        updated = True

    if clean_tags and clean_tags != anime.tags_data:
        anime.tags_data = clean_tags
        updated = True

    new_cache = build_tags_cache(current_genres, clean_tags)
    if new_cache and new_cache != anime.tags_cache:
        anime.tags_cache = new_cache
        updated = True

    # 9. Images
    cover = media.get('coverImage') or {}
    new_img = cover.get('extraLarge') or cover.get('large') or cover.get('medium')
    if new_img and (not anime.image_url or anime.image_url == '' or 'justwatch' in anime.image_url):
        anime.image_url = new_img
        updated = True

    new_banner = media.get('bannerImage')
    if new_banner and (not anime.banner_url or anime.banner_url == ''):
        anime.banner_url = new_banner
        updated = True

    # 10. Recommendations
    recs = media.get('recommendations', {}).get('nodes', []) or []
    for r in recs:
        target_media = r.get('mediaRecommendation')
        if not target_media:
            continue
        target_mid = target_media.get('idMal')
        if not target_mid or target_mid == anime.mal_id:
            continue
        target_anime = Anime.objects.filter(mal_id=target_mid).first()
        if target_anime:
            strength_val = max(5, int(r.get('rating') or 10))
            AnimeRecommendation.objects.update_or_create(
                source=anime,
                target=target_anime,
                defaults={'strength': strength_val}
            )

    return updated

def main():
    print("=== INICIANDO ENRIQUECIMIENTO DE METADATOS Y RECOMENDACIONES ===")

    # 1. Candidatos: Steel Ball Run + Animes de alto impacto con datos faltantes
    sbr = Anime.objects.filter(mal_id=61469)
    top_score = Anime.objects.filter(score__gte=8.0).filter(
        Q(tags_data=[]) | Q(synopsis='Importado desde Top MyAnimeList.') | Q(season_year__isnull=True) | Q(studio='')
    )
    top_ranked = Anime.objects.filter(rank__lte=1500).filter(
        Q(tags_data=[]) | Q(synopsis='Importado desde Top MyAnimeList.') | Q(season_year__isnull=True) | Q(studio='')
    )
    recent_missing = Anime.objects.filter(
        Q(season_year__gte=2024) | Q(status='NOT_YET_RELEASED') | Q(status='RELEASING')
    ).filter(
        Q(tags_data=[]) | Q(genres=[]) | Q(synopsis='Importado desde Top MyAnimeList.') | Q(studio='')
    )

    candidates_qs = (sbr | top_score | top_ranked | recent_missing).distinct()
    candidates = list(candidates_qs.order_by('-score')[:350])
    print(f"Total candidatos seleccionados para enriquecer: {len(candidates)}")

    mal_map = {a.mal_id: a for a in candidates}
    mal_ids = list(mal_map.keys())

    batch_size = 40
    total_matched = 0
    total_updated = 0
    not_matched_ids = []

    for i in range(0, len(mal_ids), batch_size):
        chunk = mal_ids[i:i + batch_size]
        print(f"Lote {i // batch_size + 1}/{(len(mal_ids) + batch_size - 1) // batch_size} ({len(chunk)} IDs)...")
        try:
            media_items = query_anilist_batch(chunk)
            matched_in_chunk = set()
            for media in media_items:
                mid = media.get('idMal')
                if mid and mid in mal_map:
                    anime = mal_map[mid]
                    matched_in_chunk.add(mid)
                    if enrich_anime_record(anime, media):
                        anime.save()
                        total_updated += 1
                    total_matched += 1

            for mid in chunk:
                if mid not in matched_in_chunk:
                    not_matched_ids.append(mid)

            time.sleep(0.8)
        except Exception as e:
            print(f"  Error en lote: {e}")
            time.sleep(2.0)

    print(f"\n[Fase 1] Matches por idMal: {total_matched} / {len(mal_ids)}")
    print(f"[Fase 1] Animes actualizados: {total_updated}")

    # Fase 2: Búsqueda por título para los no emparejados (máximo 50)
    print(f"\n[Fase 2] Búsqueda por título para {min(len(not_matched_ids), 60)} animes...")
    fallback_count = 0
    for mid in not_matched_ids[:60]:
        anime = mal_map[mid]
        try:
            time.sleep(0.5)
            media = query_anilist_single_search(anime.title)
            if media:
                if enrich_anime_record(anime, media):
                    anime.save()
                    fallback_count += 1
        except Exception:
            pass

    print(f"[Fase 2] Animes actualizados por título: {fallback_count}")

    # Fase 3: Conexiones de Franquicia JoJo específicas para Steel Ball Run
    sbr_anime = Anime.objects.filter(mal_id=61469).first()
    if sbr_anime:
        jojo_parts = Anime.objects.filter(title__icontains='JoJo').exclude(mal_id=61469).order_by('-score')[:6]
        for part in jojo_parts:
            AnimeRecommendation.objects.update_or_create(
                source=sbr_anime,
                target=part,
                defaults={'strength': 35}
            )
            # Y bidireccional
            AnimeRecommendation.objects.update_or_create(
                source=part,
                target=sbr_anime,
                defaults={'strength': 25}
            )
        print("Recomendaciones de franquicia JoJo sincronizadas para Steel Ball Run.")

    # Fase 4: Limpieza de caché
    cache.clear()
    print("=== ENRIQUECIMIENTO COMPLETADO EXITOSAMENTE ===")

if __name__ == '__main__':
    main()
