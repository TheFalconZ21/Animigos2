import os
import sys
from pathlib import Path

# Configurar path del proyecto
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib import admin
from django.apps import apps

def main():
    app_labels = ['animes', 'groups', 'users', 'auth']
    all_models = []
    for label in app_labels:
        app_config = apps.get_app_config(label)
        all_models.extend(app_config.get_models())

    registry = admin.site._registry
    total = len(all_models)
    registered = [m for m in all_models if m in registry]
    active_count = len(registered)

    print("=" * 70)
    print("      AUDITORIA DE CONTENEDORES CRUD (DJANGO ADMIN)")
    print("=" * 70)
    print(f"Total de entidades en base de datos: {total}")
    print(f"Contenedores CRUD registrados:       {active_count} de {total} ({(active_count/total)*100:.0f}%)")
    print("-" * 70)

    for m in all_models:
        is_reg = m in registry
        status = "✓ ACTIVO" if is_reg else "✗ FALTANTE"
        admin_class = registry[m].__class__.__name__ if is_reg else "Sin Registrar"
        print(f"[{status:^10}] {m._meta.app_label:<8} > {m.__name__:<30} (Clase: {admin_class})")

    print("=" * 70)
    if active_count == total:
        print("✓ Cobertura total: Todas las entidades poseen su contenedor CRUD.")
    else:
        print(f"⚠ Faltan {total - active_count} entidades por registrar en admin.py.")
    print("=" * 70)

if __name__ == '__main__':
    main()
