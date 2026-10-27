import os
import json
import re
from pathlib import Path
from PIL import Image

def clean_display_name(folder_name: str) -> str:
    """Convierte nombres de carpetas con guiones bajos en nombres limpios para el usuario."""
    clean = folder_name.replace('_', ' ')
    # Reemplazos específicos comunes
    replacements = {
        'S1': 'Temporada 1',
        'S2': 'Temporada 2',
        'S3': 'Temporada 3',
        'S4': 'Temporada 4',
        'Season 3': 'Temporada 3',
        'Season 4': 'Temporada 4',
        'Castillo Infinito I': 'Castillo Infinito',
        'Mas alla del final del viaje': 'Más allá del final del viaje',
        'Me enamore de la villana': 'Me enamoré de la villana',
        'Hell s Paradise': "Hell's Paradise",
        'Let s Play': "Let's Play",
        'Tamon s B-side': "Tamon's B-side",
        'The World s Finest Assassin': "The World's Finest Assassin",
        'So I m a Spider So What': "So I'm a Spider, So What?",
    }
    for old, new in replacements.items():
        clean = clean.replace(old, new)
    return clean.strip()

def clean_avatar_name(file_stem: str) -> str:
    """Extrae un nombre legible de personaje a partir del nombre del archivo."""
    # Ej: 31-somali-and-the-forest-spirit-golem -> Golem
    # Ej: frieren_fern-avatar-1 -> Fern (1)
    name = re.sub(r'^\d+-', '', file_stem)
    name = name.replace('-avatar-', ' ').replace('_avatar_', ' ').replace('-avatar', '').replace('_avatar', '')
    name = name.replace('_', ' ').replace('-', ' ').title()
    return name.strip()

def optimize_avatars():
    base_dir = Path(__file__).resolve().parent.parent.parent
    src_dir = base_dir / 'Avatars'
    media_dir = base_dir / 'animigos-backend' / 'media' / 'avatars'
    media_dir.mkdir(parents=True, exist_ok=True)

    print(f"Buscando avatares en: {src_dir}")
    print(f"Destino optimizado: {media_dir}")

    total_converted = 0
    total_original_bytes = 0
    total_new_bytes = 0

    catalog = []

    # Recorrer carpetas de series
    subdirs = sorted([d for d in src_dir.iterdir() if d.is_dir()])

    for folder in subdirs:
        folder_name = folder.name
        display_category = clean_display_name(folder_name)
        category_slug = re.sub(r'[^a-zA-Z0-9_-]', '_', folder_name).lower()

        target_folder = media_dir / category_slug
        target_folder.mkdir(parents=True, exist_ok=True)

        avatars_in_category = []
        image_files = sorted([f for f in folder.iterdir() if f.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp']])

        for img_path in image_files:
            try:
                orig_size = img_path.stat().st_size
                total_original_bytes += orig_size

                dest_filename = f"{img_path.stem}.webp"
                dest_path = target_folder / dest_filename

                # Optimizar imagen a WebP 256x256
                with Image.open(img_path) as im:
                    # Convertir a RGBA si tiene transparencia, sino RGB
                    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
                        im = im.convert('RGBA')
                    else:
                        im = im.convert('RGB')

                    # Redimensionar conservando proporción con max 256x256
                    im.thumbnail((256, 256), Image.Resampling.LANCZOS)
                    im.save(dest_path, 'WEBP', quality=85, method=6)

                new_size = dest_path.stat().st_size
                total_new_bytes += new_size
                total_converted += 1

                avatar_id = f"{category_slug}_{img_path.stem}"
                avatar_display_name = clean_avatar_name(img_path.stem)
                web_url = f"/media/avatars/{category_slug}/{dest_filename}"

                avatars_in_category.append({
                    "id": avatar_id,
                    "name": avatar_display_name,
                    "category": display_category,
                    "category_slug": category_slug,
                    "url": web_url
                })
            except Exception as e:
                print(f"Error procesando {img_path.name}: {e}")

        if avatars_in_category:
            catalog.append({
                "slug": category_slug,
                "name": display_category,
                "count": len(avatars_in_category),
                "avatars": avatars_in_category
            })

    # Guardar catálogo JSON
    catalog_path = media_dir / 'preset_avatars.json'
    with open(catalog_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    orig_mb = total_original_bytes / (1024 * 1024)
    new_mb = total_new_bytes / (1024 * 1024)
    saved_percent = ((orig_mb - new_mb) / orig_mb * 100) if orig_mb > 0 else 0

    print("\n--- RESUMEN DE OPTIMIZACIÓN ---")
    print(f"Total imágenes convertidas a WebP: {total_converted}")
    print(f"Total categorías de series: {len(catalog)}")
    print(f"Tamaño original: {orig_mb:.2f} MB")
    print(f"Nuevo tamaño optimizado: {new_mb:.2f} MB")
    print(f"Ahorro de espacio y ancho de banda: {saved_percent:.1f}%")
    print(f"Catálogo JSON generado en: {catalog_path}")

if __name__ == '__main__':
    optimize_avatars()
