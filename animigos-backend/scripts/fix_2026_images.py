import os
import sys
import django
import json
import time
import urllib.request
import urllib.parse

# Setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from animes.models import Anime

def main():
    animes = list(Anime.objects.filter(image_url__contains='justwatch'))
    print(f"Total animes to fix: {len(animes)}")

    mal_ids = [a.mal_id for a in animes]

    def fetch_anilist_by_ids(ids):
        query = """
        query ($ids: [Int]) {
          Page(page: 1, perPage: 50) {
            media(idMal_in: $ids, type: ANIME) {
              idMal
              title { romaji english }
              coverImage { extraLarge large medium }
              bannerImage
            }
          }
        }
        """
        req = urllib.request.Request(
            'https://graphql.anilist.co',
            data=json.dumps({'query': query, 'variables': {'ids': ids}}).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'User-Agent': 'Animigos/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            res = json.loads(r.read().decode('utf-8'))
            return res.get('data', {}).get('Page', {}).get('media', [])

    def search_anilist_by_title(title):
        clean_title = title.split('Part')[0].split('Season')[0].split('2nd')[0].strip()
        query = """
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            idMal
            title { romaji english }
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
        except Exception as e:
            return None

    # Fetch in batches of 35
    all_media = {}
    for i in range(0, len(mal_ids), 30):
        batch = mal_ids[i:i+30]
        try:
            items = fetch_anilist_by_ids(batch)
            for it in items:
                if it.get('idMal'):
                    all_media[it['idMal']] = it
            time.sleep(1)
        except Exception as e:
            print(f"Error fetching batch {i}: {e}")

    print(f"Direct idMal matches: {len(all_media)} / {len(animes)}")

    updated_count = 0
    for a in animes:
        media = all_media.get(a.mal_id)
        if not media:
            # Try searching by title
            time.sleep(0.6)
            media = search_anilist_by_title(a.title)
            if media:
                print(f"Found by title: {a.title} -> {media.get('title', {}).get('romaji')}")

        if media:
            cover = (media.get('coverImage') or {})
            img = cover.get('extraLarge') or cover.get('large') or cover.get('medium')
            banner = media.get('bannerImage')

            if img:
                a.image_url = img
                if banner and hasattr(a, 'banner_url'):
                    a.banner_url = banner
                a.save(update_fields=['image_url'] + (['banner_url'] if banner and hasattr(a, 'banner_url') else []))
                updated_count += 1
                print(f"OK [{a.mal_id}] {a.title} -> {img[:60]}...")
            else:
                print(f"NO IMG [{a.mal_id}] {a.title}")
        else:
            print(f"NOT FOUND [{a.mal_id}] {a.title}")

    print(f"Finished! Successfully updated: {updated_count} / {len(animes)}")

if __name__ == '__main__':
    main()
