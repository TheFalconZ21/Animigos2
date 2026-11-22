/**
 * Helper liviano de navegación SPA basada en History API (rutas limpias).
 * Soporta retrocompatibilidad automática desde URLs antiguas con #hash.
 */

export const NAVIGATE_EVENT = 'animigos:navigate'

/**
 * Normaliza una ruta de aplicación a formato limpio con barra inicial (sin #).
 * Ejemplos:
 * - "#catalogo" -> "/catalogo"
 * - "/perfil/Alonso/" -> "/perfil/Alonso"
 * - "" o "#" o "/" -> "/"
 */
export function normalizeAppPath(raw: string): string {
    let clean = (raw || '').trim()
    if (!clean || clean === '#' || clean === '#/' || clean === '/') {
        return '/'
    }
    if (clean.startsWith('#')) {
        clean = clean.slice(1)
    }
    // Separar query string si viene embebida
    const qIdx = clean.indexOf('?')
    const pathPart = qIdx >= 0 ? clean.slice(0, qIdx) : clean
    const queryPart = qIdx >= 0 ? clean.slice(qIdx) : ''

    let normalizedPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
        normalizedPath = normalizedPath.slice(0, -1)
    }
    if (normalizedPath === '/landing') {
        normalizedPath = '/'
    }
    return `${normalizedPath}${queryPart}`
}

/**
 * Si el usuario llega con un enlace antiguo con #hash (ej. /#anime/52991 o /#sala/ABC),
 * lo convierte silenciosamente a ruta limpia con history.replaceState.
 */
export function upgradeLegacyHashIfPresent(): void {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || hash === '#') return

    // Solo migrar si estamos en la raíz o si el hash parece una ruta de la app
    const normalized = normalizeAppPath(hash)
    const currentSearch = window.location.search || ''
    const nextUrl = normalized.includes('?')
        ? normalized
        : `${normalized}${currentSearch}`

    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(null, '', nextUrl)
    }
}

/**
 * Devuelve el pathname limpio actual (sin barra final excepto "/").
 */
export function getCurrentPath(): string {
    if (typeof window === 'undefined') return '/'
    upgradeLegacyHashIfPresent()
    const raw = window.location.pathname || '/'
    if (raw.length > 1 && raw.endsWith('/')) {
        return raw.slice(0, -1)
    }
    return raw
}

/**
 * Navega a una ruta limpia usando History API y notifica a los suscriptores.
 */
export function navigate(target: string, options?: { replace?: boolean }): void {
    if (typeof window === 'undefined') return
    const next = normalizeAppPath(target)
    const currentFull = `${window.location.pathname}${window.location.search}`

    if (next !== currentFull || window.location.hash) {
        if (options?.replace) {
            window.history.replaceState(null, '', next)
        } else {
            window.history.pushState(null, '', next)
        }
    }
    window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

/**
 * Construye una URL absoluta compartible con ruta limpia.
 */
export function buildShareableUrl(path: string): string {
    const clean = normalizeAppPath(path)
    if (typeof window === 'undefined') return clean
    return `${window.location.origin}${clean}`
}

/**
 * Se suscribe a cambios de ruta (pushState, replaceState, botón atrás/adelante y hashchange legacy).
 */
export function subscribeNavigation(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {}
    const onHash = () => {
        upgradeLegacyHashIfPresent()
        listener()
    }
    window.addEventListener(NAVIGATE_EVENT, listener)
    window.addEventListener('popstate', listener)
    window.addEventListener('hashchange', onHash)
    return () => {
        window.removeEventListener(NAVIGATE_EVENT, listener)
        window.removeEventListener('popstate', listener)
        window.removeEventListener('hashchange', onHash)
    }
}
