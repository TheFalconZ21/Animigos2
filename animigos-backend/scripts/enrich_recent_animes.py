import os
import sys
import django
import json
import time
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.cache import cache
from animes.models import Anime

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
          episodes
          duration
          status
          format
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

def search_anilist_by_title(title):
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
        title { romaji english }
        season
        seasonYear
        episodes
        duration
        status
        format
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

def enrich_anime(anime, media, is_fallback=False):
    updated = False
    
    # 1. Temporada
    raw_season = media.get('season')
    if raw_season and (not anime.season or anime.season.strip() == ''):
        anime.season = raw_season.capitalize()
        updated = True
        
    s_year = media.get('seasonYear')
    if s_year and (not anime.season_year):
        anime.season_year = int(s_year)
        updated = True
        
    # 2. Episodios
    eps = media.get('episodes')
    if eps and anime.episodes is None and not is_fallback:
        anime.episodes = int(eps)
        updated = True
    elif anime.episodes is None and (media.get('format') == 'MOVIE' or anime.type == 'Movie'):
        anime.episodes = 1
        updated = True
        
    # Duración
    dur = media.get('duration')
    if dur and (anime.duration is None or anime.duration == 0):
        anime.duration = float(dur)
        updated = True
        
    # Tipo/Formato
    fmt = media.get('format')
    if fmt and (not anime.type or anime.type == '' or anime.type == 'TV'):
        if fmt == 'MOVIE':
            anime.type = 'Movie'
            updated = True
        elif fmt in ('OVA', 'ONA', 'SPECIAL'):
            anime.type = fmt
            updated = True
            
    # 3. Estudio
    studios_nodes = media.get('studios', {}).get('nodes', [])
    if studios_nodes and (not anime.studio or anime.studio.strip() == ''):
        anim_studios = [s['name'] for s in studios_nodes if s.get('isAnimationStudio') and s.get('name')]
        chosen_studio = anim_studios[0] if anim_studios else studios_nodes[0].get('name')
        if chosen_studio:
            anime.studio = chosen_studio[:100]
            updated = True
            
    # 4. Título en inglés
    eng_title = media.get('title', {}).get('english')
    if eng_title and (not anime.title_english or anime.title_english.strip() == ''):
        anime.title_english = eng_title[:300]
        updated = True
        
    # 5. Géneros y Tags
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
        
    # 6. Imágenes
    cover = media.get('coverImage') or {}
    new_img = cover.get('extraLarge') or cover.get('large') or cover.get('medium')
    if new_img and (not anime.image_url or anime.image_url == '' or 'justwatch' in anime.image_url):
        anime.image_url = new_img
        updated = True
        
    new_banner = media.get('bannerImage')
    if new_banner and (not anime.banner_url or anime.banner_url == ''):
        anime.banner_url = new_banner
        updated = True
        
    return updated

def inherit_from_franchise_parents():
    """Hereda estudio y géneros para secuelas/partes si aún están vacíos"""
    missing_animes = Anime.objects.filter(
        django.db.models.Q(season_year__gte=2025) | django.db.models.Q(status='RELEASING')
    ).filter(
        django.db.models.Q(studio='') | django.db.models.Q(genres=[]) | django.db.models.Q(tags_data=[])
    )
    
    inherited_count = 0
    for a in missing_animes:
        # Detectar prefijo base de franquicia
        title = a.title
        for delimiter in (' 2nd Season', ' 3rd Season', ' 4th Season', ' Season 2', ' Season 3', ' Part 2', ' Part 3', ' Movie:'):
            if delimiter in title:
                base_title = title.split(delimiter)[0].strip()
                parent = (
                    Anime.objects.filter(title__istartswith=base_title)
                    .exclude(mal_id=a.mal_id)
                    .exclude(studio='')
                    .exclude(genres=[])
                    .first()
                )
                if parent:
                    modified = False
                    if (not a.studio or a.studio == '') and parent.studio:
                        a.studio = parent.studio
                        modified = True
                    if (not a.genres or not a.genres) and parent.genres:
                        a.genres = list(parent.genres)
                        modified = True
                    if (not a.tags_data or not a.tags_data) and parent.tags_data:
                        a.tags_data = list(parent.tags_data)
                        modified = True
                    if not a.season and parent.season:
                        a.season = parent.season
                        modified = True
                    if modified:
                        a.tags_cache = build_tags_cache(a.genres, a.tags_data, is_sequel=True)
                        a.save()
                        inherited_count += 1
                        break
                        
    return inherited_count

def main():
    print("=== INICIANDO ENRIQUECIMIENTO DE METADATOS (2025-2026 Y EN EMISIÓN) ===")
    
    candidates = list(
        Anime.objects.filter(
            django.db.models.Q(season_year__gte=2025) | django.db.models.Q(status='RELEASING')
        ).filter(
            django.db.models.Q(genres=[]) |
            django.db.models.Q(studio='') |
            django.db.models.Q(season='') |
            django.db.models.Q(tags_data=[]) |
            django.db.models.Q(episodes__isnull=True)
        )
    )
    
    print(f"Total animes a procesar con AniList GraphQL: {len(candidates)}")
    mal_map = {a.mal_id: a for a in candidates}
    mal_ids = list(mal_map.keys())
    
    batch_size = 40
    total_matched = 0
    total_updated = 0
    not_matched_ids = []
    
    for i in range(0, len(mal_ids), batch_size):
        chunk = mal_ids[i:i + batch_size]
        print(f"Procesando lote {i // batch_size + 1} / {(len(mal_ids) + batch_size - 1) // batch_size} ({len(chunk)} IDs)...")
        try:
            media_items = query_anilist_batch(chunk)
            matched_in_chunk = set()
            for media in media_items:
                mid = media.get('idMal')
                if mid and mid in mal_map:
                    anime = mal_map[mid]
                    matched_in_chunk.add(mid)
                    if enrich_anime(anime, media):
                        anime.save()
                        total_updated += 1
                    total_matched += 1
                    
            for mid in chunk:
                if mid not in matched_in_chunk:
                    not_matched_ids.append(mid)
                    
            time.sleep(1.0)
        except Exception as e:
            print(f"Error en lote {i}: {e}")
            time.sleep(2.0)
            
    print(f"\n[Fase 1] Matches directos por idMal: {total_matched} / {len(mal_ids)}")
    print(f"[Fase 1] Animes actualizados: {total_updated}")
    
    # Fase 2: Para los no encontrados directamente, búsqueda por título
    print(f"\n[Fase 2] Intentando búsqueda por título para {min(len(not_matched_ids), 120)} animes...")
    fallback_updated = 0
    for mid in not_matched_ids[:120]:
        anime = mal_map[mid]
        try:
            time.sleep(0.6)
            media = search_anilist_by_title(anime.title)
            if media:
                if enrich_anime(anime, media, is_fallback=True):
                    anime.save()
                    fallback_updated += 1
        except Exception as e:
            pass
            
    print(f"[Fase 2] Animes actualizados por título: {fallback_updated}")
    
    # Fase 3: Herencia de franquicia para secuelas/partes que queden
    print("\n[Fase 3] Aplicando herencia de franquicia a secuelas/partes pendientes...")
    inherited = inherit_from_franchise_parents()
    print(f"[Fase 3] Animes enriquecidos por franquicia: {inherited}")
    
    cache.clear()
    print("\n=== ENRIQUECIMIENTO COMPLETADO Y CACHÉ LIMPIADA ===")

if __name__ == '__main__':
    main()
