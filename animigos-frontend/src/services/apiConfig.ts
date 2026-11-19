/**
 * Normaliza la URL base de la API garantizando el prefijo /api.
 * Si en Vercel se configuró 'https://api.animigos.app' (sin /api),
 * añade /api automáticamente para evitar errores 404.
 */
export function getApiBaseUrl(): string {
    const raw = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
    if (raw.endsWith('/api')) return raw
    return `${raw}/api`
}

/**
 * Resuelve la URL base para WebSockets (Watch Parties en tiempo real):
 * 1. Usa VITE_WS_URL si está configurada explícitamente (ej. wss://api.animigos.app).
 * 2. Deriva wss:// o ws:// desde VITE_API_URL cuando apunta a un host absoluto.
 * 3. En desarrollo local (VITE_API_URL relativo '/api'), usa window.location.host
 *    (enrutado por el proxy /ws de Vite hacia Daphne 127.0.0.1:8000).
 */
export function getWsBaseUrl(): string {
    const explicitWs = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/+$/, '')
    if (explicitWs) {
        return explicitWs.replace(/\/ws\/?$/, '')
    }

    const rawApi = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
    if (/^https?:\/\//i.test(rawApi)) {
        const origin = rawApi.replace(/\/api$/i, '')
        const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1')
        if (origin.startsWith('https://') || (typeof window !== 'undefined' && window.location.protocol === 'https:' && !isLocal)) {
            return origin.replace(/^https?:\/\//i, 'wss://')
        }
        return origin.replace(/^http:\/\//i, 'ws://')
    }

    if (typeof window !== 'undefined') {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${proto}//${window.location.host}`
    }
    return 'ws://127.0.0.1:8000'
}

export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWsBaseUrl()

