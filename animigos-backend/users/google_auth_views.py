import ipaddress
import os
import re
import requests
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Profile
from .serializers import ProfileSerializer

GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

VALID_GENDERS = {
    '',
    'female',
    'male',
    'non_binary',
    'other',
    'prefer_not_to_say',
}

# Mapeo ISO-2 -> Nombre legible en español para headers de Vercel / Cloudflare
ISO_COUNTRY_NAMES = {
    'CL': 'Chile',
    'MX': 'México',
    'AR': 'Argentina',
    'CO': 'Colombia',
    'PE': 'Perú',
    'ES': 'España',
    'US': 'Estados Unidos',
    'VE': 'Venezuela',
    'EC': 'Ecuador',
    'UY': 'Uruguay',
    'PY': 'Paraguay',
    'BO': 'Bolivia',
    'CR': 'Costa Rica',
    'PA': 'Panamá',
    'GT': 'Guatemala',
    'DO': 'República Dominicana',
    'HN': 'Honduras',
    'SV': 'El Salvador',
    'NI': 'Nicaragua',
    'BR': 'Brasil',
    'CA': 'Canadá',
    'JP': 'Japón',
    'GB': 'Reino Unido',
    'FR': 'Francia',
    'DE': 'Alemania',
    'IT': 'Italia',
    'PT': 'Portugal',
}


def _extract_client_ip(request) -> str:
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return (request.META.get('REMOTE_ADDR') or '').strip()


def _is_public_ip(ip_str: str) -> bool:
    if not ip_str:
        return False
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        return not (ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved or ip_obj.is_multicast)
    except ValueError:
        return False


def detect_geo_from_request(request, browser_timezone: str = '') -> dict:
    """
    Detecta país, región, ciudad aproximada y zona horaria sin permisos invasivos:
    1) Headers de Edge (Vercel / Cloudflare) si están presentes.
    2) Lookup liviano por IP pública con caché de 24h.
    3) Fallback de zona horaria del navegador.
    """
    tz_fallback = (browser_timezone or '').strip()[:64]
    vercel_cc = (
        request.META.get('HTTP_X_VERCEL_IP_COUNTRY')
        or request.META.get('HTTP_CF_IPCOUNTRY')
        or ''
    ).strip().upper()
    vercel_city = (request.META.get('HTTP_X_VERCEL_IP_CITY') or '').strip()
    vercel_region = (request.META.get('HTTP_X_VERCEL_IP_COUNTRY_REGION') or '').strip()
    vercel_tz = (request.META.get('HTTP_X_VERCEL_IP_TIMEZONE') or '').strip()

    if vercel_cc and vercel_cc not in ('XX', 'T1'):
        return {
            'country': ISO_COUNTRY_NAMES.get(vercel_cc, vercel_cc),
            'country_code': vercel_cc,
            'region': vercel_region[:100],
            'city': vercel_city[:100],
            'timezone_name': (vercel_tz or tz_fallback)[:64],
        }

    client_ip = _extract_client_ip(request)
    if _is_public_ip(client_ip):
        cache_key = f'geo_ip_v1:{client_ip}'
        cached = cache.get(cache_key)
        if cached is not None:
            if not cached.get('timezone_name') and tz_fallback:
                cached = {**cached, 'timezone_name': tz_fallback}
            return cached
        try:
            resp = requests.get(
                f'http://ip-api.com/json/{client_ip}',
                params={'fields': 'status,country,countryCode,regionName,city,timezone', 'lang': 'es'},
                timeout=2.5,
            )
            if resp.status_code == 200:
                payload = resp.json()
                if payload.get('status') == 'success':
                    cc = str(payload.get('countryCode') or '').upper()
                    result = {
                        'country': ISO_COUNTRY_NAMES.get(cc) or str(payload.get('country') or '')[:80],
                        'country_code': cc,
                        'region': str(payload.get('regionName') or '')[:100],
                        'city': str(payload.get('city') or '')[:100],
                        'timezone_name': (str(payload.get('timezone') or '') or tz_fallback)[:64],
                    }
                    cache.set(cache_key, result, 60 * 60 * 24)
                    return result
        except requests.RequestException:
            pass

    return {
        'country': '',
        'country_code': '',
        'region': '',
        'city': '',
        'timezone_name': tz_fallback,
    }


def apply_detected_geo_to_profile(profile: Profile, geo: dict) -> None:
    """Completa ubicación aproximada en Profile si aún no está definida."""
    updated_fields = []
    if geo.get('country') and not profile.country:
        profile.country = geo['country'][:80]
        updated_fields.append('country')
    if geo.get('region') and not profile.region:
        profile.region = geo['region'][:100]
        updated_fields.append('region')
    if geo.get('city') and not profile.city:
        profile.city = geo['city'][:100]
        updated_fields.append('city')
    if geo.get('timezone_name') and not profile.timezone_name:
        profile.timezone_name = geo['timezone_name'][:64]
        updated_fields.append('timezone_name')
    if updated_fields:
        profile.save(update_fields=updated_fields)


def _generate_unique_username(email: str, name: str) -> str:
    base = (email.split('@')[0] if '@' in email else name) or 'otaku'
    slug = re.sub(r'[^a-zA-Z0-9_]+', '_', base.lower()).strip('_')[:24] or 'otaku'
    candidate = slug
    suffix = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f'{slug}_{suffix}'
        suffix += 1
    return candidate


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth_view(request):
    """
    Inicia sesión o registra una cuenta con Google Sign-In básico (openid email profile).
    Verifica el ID Token JWT de Google, vincula o crea la cuenta, detecta ubicación por IP
    e inicia la sesión segura de Animigos.
    """
    credential = str((request.data or {}).get('credential') or '').strip()
    browser_tz = str((request.data or {}).get('timezone_name') or '').strip()

    if not credential:
        return Response({'error': 'Token de Google requerido.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        verify_resp = requests.get(
            GOOGLE_TOKENINFO_URL,
            params={'id_token': credential},
            timeout=8,
        )
    except requests.RequestException:
        return Response(
            {'error': 'No se pudo contactar con Google para verificar tu cuenta. Intenta de nuevo.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if verify_resp.status_code != 200:
        return Response(
            {'error': 'La credencial de Google no es válida o expiró.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token_data = verify_resp.json()
    expected_client_id = (os.getenv('GOOGLE_CLIENT_ID') or '').strip()
    token_aud = str(token_data.get('aud') or '').strip()
    if expected_client_id and token_aud != expected_client_id:
        return Response(
            {'error': 'El token de Google no corresponde a esta aplicación.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    email = str(token_data.get('email') or '').strip().lower()
    email_verified = str(token_data.get('email_verified') or '').lower() == 'true'
    google_sub = str(token_data.get('sub') or '').strip()
    full_name = str(token_data.get('name') or '').strip()
    picture = str(token_data.get('picture') or '').strip()

    if not email or not email_verified or not google_sub:
        return Response(
            {'error': 'Tu cuenta de Google debe tener un correo electrónico verificado.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    geo = detect_geo_from_request(request, browser_timezone=browser_tz)
    is_new_user = False

    profile = Profile.objects.select_related('user').filter(google_sub=google_sub).first()
    if profile:
        user = profile.user
    else:
        user = User.objects.filter(email__iexact=email).first()
        if user:
            profile, _ = Profile.objects.get_or_create(
                user=user,
                defaults={'display_name': full_name or user.username},
            )
            if not profile.google_sub:
                profile.google_sub = google_sub
                profile.save(update_fields=['google_sub'])
        else:
            is_new_user = True
            username = _generate_unique_username(email, full_name)
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=full_name[:150],
            )
            user.set_unusable_password()
            user.save(update_fields=['password'])
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.google_sub = google_sub
            if full_name:
                profile.display_name = full_name[:100]
            if picture:
                profile.avatar_url = picture
            profile.save(update_fields=['google_sub', 'display_name', 'avatar_url'])

    if not user.is_active:
        return Response(
            {'error': 'Tu cuenta ha sido suspendida por un administrador. Contacta a soporte si crees que es un error.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    apply_detected_geo_to_profile(profile, geo)

    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.session.save()

    return Response(
        {
            'message': '¡Cuenta creada con Google!' if is_new_user else '¡Sesión iniciada con Google!',
            'authenticated': True,
            'is_new_user': is_new_user,
            'session_id': request.session.session_key,
            'detected_geo': geo,
            'user': ProfileSerializer(profile, context={'request': request}).data,
        },
        status=status.HTTP_201_CREATED if is_new_user else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def detect_user_geo_view(request):
    """Devuelve país, ciudad aproximada y zona horaria detectados por IP."""
    browser_tz = str(request.query_params.get('tz') or '').strip()
    geo = detect_geo_from_request(request, browser_timezone=browser_tz)
    return Response(geo)


@api_view(['POST', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_demographics_view(request):
    """Guarda los datos demográficos voluntarios (país, año de nacimiento, género) o marca omitido."""
    profile, _ = Profile.objects.get_or_create(user=request.user)
    data = request.data or {}
    skipped = bool(data.get('skipped', False))

    updated_fields = ['demographics_prompted']
    profile.demographics_prompted = True

    if not skipped:
        if 'country' in data:
            profile.country = str(data.get('country') or '').strip()[:80]
            updated_fields.append('country')

        if 'timezone_name' in data and data.get('timezone_name'):
            profile.timezone_name = str(data.get('timezone_name') or '').strip()[:64]
            updated_fields.append('timezone_name')

        if 'gender' in data:
            g = str(data.get('gender') or '').strip().lower()
            if g in VALID_GENDERS:
                profile.gender = g
                updated_fields.append('gender')

        if 'birth_year' in data:
            raw_year = data.get('birth_year')
            if raw_year in (None, ''):
                profile.birth_year = None
                updated_fields.append('birth_year')
            else:
                try:
                    yr = int(raw_year)
                    if 1930 <= yr <= 2020:
                        profile.birth_year = yr
                        updated_fields.append('birth_year')
                except (TypeError, ValueError):
                    pass

    profile.save(update_fields=list(dict.fromkeys(updated_fields)))
    return Response({
        'message': 'Preferencias guardadas.' if not skipped else 'Paso omitido.',
        'user': ProfileSerializer(profile, context={'request': request}).data,
    })
