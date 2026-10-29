/**
 * Normaliza la URL base de la API garantizando el prefijo /api
 * Si en Vercel se configuró 'https://animigos-backend-oee1.onrender.com' (sin /api),
 * añade /api automáticamente para evitar errores 404.
 */
export function getApiBaseUrl(): string {
    const raw = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
    if (raw.endsWith('/api')) return raw
    return `${raw}/api`
}

export const API_BASE_URL = getApiBaseUrl()
