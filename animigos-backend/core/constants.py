"""
Constantes Canónicas del Proyecto Animigos (Pilar 1.1 y 4.1 de la Directiva de Arquitectura).
Valores compartidos para control de caché, políticas de expiración y límites de proxy.
"""

# Tiempos de Expiración de Caché en Segundos (TTL)
CACHE_TTL_VERY_SHORT = 60          # 1 minuto: datos de alta volatilidad (p. ej. salas en vivo)
CACHE_TTL_SHORT = 300              # 5 minutos: listados y búsquedas de catálogo
CACHE_TTL_MEDIUM = 1800            # 30 minutos: tops, recomendaciones y clasificaciones
CACHE_TTL_LONG = 86400             # 24 horas: metadatos estáticos (estudios, géneros)

# Prefijos canónicos de claves de caché
CACHE_PREFIX_CATALOG = 'animigos:catalog'
CACHE_PREFIX_TOP_ANIMES = 'animigos:top'
CACHE_PREFIX_RECOMMENDATIONS = 'animigos:recomms'
CACHE_PREFIX_STUDIOS = 'animigos:studios'
CACHE_PREFIX_ROOMS = 'animigos:rooms'
