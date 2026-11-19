"""
Django settings for Animigos backend project.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Cargar variables de entorno desde .env si existe
load_dotenv(BASE_DIR.parent / '.env')
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-animigos-dev-key-change-in-production')

DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = ['*'] if DEBUG else os.getenv('DJANGO_ALLOWED_HOSTS', '*').split(',')


# Application definition

INSTALLED_APPS = [
    # Daphne debe ser el primero para tomar control de runserver y soportar WebSockets
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Librerías de terceros
    'channels',
    'rest_framework',
    'corsheaders',

    # Aplicaciones del proyecto Animigos
    'animes.apps.AnimesConfig',
    'groups.apps.GroupsConfig',
    'users.apps.UsersConfig',
]

import importlib.util

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    *(
        ['whitenoise.middleware.WhiteNoiseMiddleware']
        if importlib.util.find_spec('whitenoise') is not None
        else []
    ),
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # Debe ir antes de CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.PartitionedCookiesMiddleware',
]

# Proxy reverso HTTPS (Nginx / AWS ALB / Render)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

REDIS_URL = os.environ.get('REDIS_URL', '').strip()

if REDIS_URL and importlib.util.find_spec('channels_redis') is not None:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.pubsub.RedisPubSubChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }


# Database
# En producción (DJANGO_DEBUG=False o REQUIRE_POSTGRES=True) se exige PostgreSQL sin fallback silencioso a SQLite.
# En desarrollo local (DJANGO_DEBUG=True), si PostgreSQL no responde, conmuta a SQLite local (db.sqlite3 con WAL).
import socket
import urllib.parse

db_url = os.getenv('DATABASE_URL')
pg_host = os.getenv('POSTGRES_HOST')
pg_port = os.getenv('POSTGRES_PORT', '5432')
pg_db = os.getenv('POSTGRES_DB')
pg_user = os.getenv('POSTGRES_USER', 'postgres')
pg_password = os.getenv('POSTGRES_PASSWORD', '')
pg_sslmode = os.getenv('POSTGRES_SSLMODE', '').strip()

if db_url:
    try:
        parsed_db = urllib.parse.urlparse(db_url)
        if parsed_db.hostname:
            pg_host = parsed_db.hostname
        if parsed_db.port:
            pg_port = str(parsed_db.port)
        if parsed_db.path and parsed_db.path != '/':
            pg_db = parsed_db.path.lstrip('/')
        if parsed_db.username:
            pg_user = parsed_db.username
        if parsed_db.password:
            pg_password = parsed_db.password
        query_params = urllib.parse.parse_qs(parsed_db.query)
        if not pg_sslmode and 'sslmode' in query_params:
            pg_sslmode = query_params['sslmode'][0]
    except Exception:
        pass

def _check_db_reachable(host, port):
    try:
        with socket.create_connection((host, int(port)), timeout=4.0):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

REQUIRE_POSTGRES = os.getenv('REQUIRE_POSTGRES', 'False').lower() in ('true', '1', 'yes')
ALLOW_SQLITE_FALLBACK = os.getenv(
    'ALLOW_SQLITE_FALLBACK',
    'True' if (DEBUG and not REQUIRE_POSTGRES) else 'False',
).lower() in ('true', '1', 'yes')

use_postgres = bool(pg_db and pg_host) and (
    not ALLOW_SQLITE_FALLBACK or _check_db_reachable(pg_host, pg_port)
)

if use_postgres:
    pg_options = {}
    if pg_sslmode:
        pg_options['sslmode'] = pg_sslmode
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': pg_db,
            'USER': pg_user,
            'PASSWORD': pg_password,
            'HOST': pg_host,
            'PORT': pg_port,
            'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': pg_options,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'OPTIONS': {
                'timeout': 30,
            },
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
LANGUAGE_CODE = 'es-es'
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (User uploads and Preset Avatars)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'users.authentication.CsrfExemptSessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 24,
    'DEFAULT_RENDERER_CLASSES': (
        [
            'rest_framework.renderers.JSONRenderer',
            'rest_framework.renderers.BrowsableAPIRenderer',
        ]
        if DEBUG
        else [
            'rest_framework.renderers.JSONRenderer',
        ]
    ),
}

# CORS Configuration (Permitir conexión desde el Frontend React/Vite en local, Vercel y dominio animigos.app)
_extra_cors = [o.strip() for o in os.getenv('EXTRA_CORS_ORIGINS', '').split(',') if o.strip()]
_extra_csrf = [o.strip() for o in os.getenv('EXTRA_CSRF_ORIGINS', '').split(',') if o.strip()]

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'https://animigos.app',
    'https://www.animigos.app',
    'https://api.animigos.app',
    'http://34.231.198.115',
    'http://34.231.198.115:80',
    'http://34.231.198.115:8000',
    'http://34.231.198.115:5173',
    *_extra_cors,
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://(localhost|127\.0\.0\.1):(517[0-9]|3000)$",
    r"^https://.*\.vercel\.app$",
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'https://animigos.app',
    'https://www.animigos.app',
    'https://api.animigos.app',
    'https://*.vercel.app',
    'https://*.onrender.com',
    'http://34.231.198.115',
    'http://34.231.198.115:80',
    'http://34.231.198.115:8000',
    'http://34.231.198.115:5173',
    *_extra_csrf,
]

CORS_ALLOW_CREDENTIALS = True

from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-session-id',
    'x-guest-token',
    'x-auth-token',
]

# Session & Security Cookies (Pilar 2.3 de la Directiva de Arquitectura)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 1209600  # 14 días de persistencia de sesión
SESSION_SAVE_EVERY_REQUEST = True

# Si el backend corre en api.animigos.app y el frontend en www.animigos.app,
# SESSION_COOKIE_DOMAIN=.animigos.app habilita cookies first-party (SameSite=Lax; Secure=True).
_cookie_domain = os.getenv('SESSION_COOKIE_DOMAIN', '').strip() or None
if _cookie_domain:
    SESSION_COOKIE_DOMAIN = _cookie_domain
    CSRF_COOKIE_DOMAIN = _cookie_domain

if os.environ.get('RENDER') or not DEBUG:
    _default_samesite = 'Lax' if _cookie_domain else 'None'
    SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', _default_samesite)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = os.getenv('CSRF_COOKIE_SAMESITE', _default_samesite)
    CSRF_COOKIE_SECURE = True
else:
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SECURE = False

# Caching Layer (Pilar 4.1 y 4.3 de la Directiva de Arquitectura: Proxy & Caché Intermedia)
if REDIS_URL and importlib.util.find_spec('redis') is not None:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'TIMEOUT': 300,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'animigos-local-cache',
            'TIMEOUT': 300,
        }
    }

