import { API_BASE_URL } from '../services/apiConfig'

/**
 * Resuelve URLs relativas de multimedia (como /media/avatars/...)
 * hacia el backend host de producción o desarrollo.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
    if (!url) return ''
    let trimmed = url.trim()
    if (!trimmed) return ''

    // Normalizar URLs http hacia https en producción para evitar avisos de Mixed Content
    if (trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
        trimmed = trimmed.replace('http://', 'https://')
    }

    if (
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:')
    ) {
        return trimmed
    }
    if (trimmed.startsWith('/media/')) {
        let backendOrigin = API_BASE_URL.replace(/\/api\/?$/, '')
        if (backendOrigin.startsWith('http://') && !backendOrigin.includes('localhost') && !backendOrigin.includes('127.0.0.1')) {
            backendOrigin = backendOrigin.replace('http://', 'https://')
        }
        return `${backendOrigin}${trimmed}`
    }
    return trimmed
}

