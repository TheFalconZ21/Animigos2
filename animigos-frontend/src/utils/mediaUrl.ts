import { API_BASE_URL } from '../services/apiConfig'

/**
 * Resuelve URLs relativas de multimedia (como /media/avatars/...)
 * hacia el backend host de producción o desarrollo.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
    if (!url) return ''
    const trimmed = url.trim()
    if (!trimmed) return ''
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:')
    ) {
        return trimmed
    }
    if (trimmed.startsWith('/media/')) {
        const backendOrigin = API_BASE_URL.replace(/\/api\/?$/, '')
        return `${backendOrigin}${trimmed}`
    }
    return trimmed
}

