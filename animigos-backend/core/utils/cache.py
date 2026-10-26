"""
Utilidades de Caché Intermedia y Proxy (Pilar 4.1 y 4.3 de la Directiva de Arquitectura).
Provee generación determinista de claves de caché y decorador para endpoints de DRF.
"""

import hashlib
import json
from functools import wraps
from typing import Any, Callable, Dict, Optional
from django.core.cache import cache
from rest_framework.response import Response


def build_cache_key(prefix: str, params: Optional[Dict[str, Any]] = None) -> str:
    """
    Genera una clave de caché unívoca y normalizada ordenando los parámetros
    y aplicando hash criptográfico MD5 para evitar claves excesivamente largas.
    """
    if not params:
        return f"{prefix}:all"

    # Filtrar parámetros nulos y ordenar alfabéticamente
    clean_items = sorted((str(k), str(v)) for k, v in params.items() if v is not None and str(v).strip() != "")
    if not clean_items:
        return f"{prefix}:all"

    serialized = json.dumps(clean_items, separators=(',', ':'))
    digest = hashlib.md5(serialized.encode('utf-8')).hexdigest()
    return f"{prefix}:{digest}"


def cached_api_response(timeout: int = 300, prefix: str = "api"):
    """
    Decorador para acciones de ViewSet / API views de Django REST Framework.
    Almacena en caché el payload serializado (`response.data`) y añade la cabecera
    HTTP `X-Cache-Status` ('HIT' o 'MISS') para observabilidad estricta.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            # Obtener parámetros de consulta y parámetros de URL (pk, etc.)
            query_dict = dict(request.query_params.items())
            if kwargs:
                for k, v in kwargs.items():
                    query_dict[f"arg_{k}"] = str(v)

            cache_key = build_cache_key(f"{prefix}:{func.__name__}", query_dict)
            cached_data = cache.get(cache_key)

            if cached_data is not None:
                hit_response = Response(cached_data)
                hit_response['X-Cache-Status'] = 'HIT'
                hit_response['X-Cache-Key'] = cache_key
                return hit_response

            response = func(self, request, *args, **kwargs)

            # Solo cachear respuestas exitosas (200 OK)
            if response.status_code == 200 and hasattr(response, 'data'):
                cache.set(cache_key, response.data, timeout=timeout)
                response['X-Cache-Status'] = 'MISS'
                response['X-Cache-Key'] = cache_key

            return response
        return wrapper
    return decorator


def invalidate_cache_pattern(pattern: str) -> None:
    """
    Elimina claves de caché según patrón. Compatible con Redis o LocMemCache.
    """
    try:
        # Si el backend de caché soporta delete_pattern (ej. django-redis)
        if hasattr(cache, 'delete_pattern'):
            cache.delete_pattern(pattern)
        else:
            # En LocMemCache se limpia la clave directa o limpia completa si corresponde
            cache.delete(pattern)
    except Exception:
        pass
