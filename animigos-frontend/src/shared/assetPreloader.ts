/**
 * Precarga silenciosa en segundo plano (non-blocking) para assets críticos de la plataforma.
 * Se ejecuta únicamente cuando el hilo principal queda libre (requestIdleCallback)
 * y respeta la preferencia de ahorro de datos del navegador.
 */

interface NetworkInformationLike {
    saveData?: boolean
    effectiveType?: string
}

const CORE_IDLE_ASSETS: readonly string[] = [
    '/logo-cat-white.png',
    '/logo2-cat-white.png',
    '/profesor-doki/explicando.webp',
    '/profesor-doki/tranquilo.webp',
    '/profesor-doki/emocionado_feliz.webp',
    '/profesor-doki/pensando.webp',
]

let preloaded = false

export function scheduleIdleAssetPreload(): void {
    if (preloaded || typeof window === 'undefined') return
    preloaded = true

    const nav = navigator as Navigator & { connection?: NetworkInformationLike }
    if (nav.connection?.saveData) return
    if (nav.connection?.effectiveType === '2g' || nav.connection?.effectiveType === 'slow-2g') {
        return
    }

    const warmCache = () => {
        for (const url of CORE_IDLE_ASSETS) {
            const img = new Image()
            img.decoding = 'async'
            img.src = url
        }
    }

    const idleCallback = (window as Window & {
        requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number
    }).requestIdleCallback

    if (typeof idleCallback === 'function') {
        idleCallback(warmCache, { timeout: 4000 })
    } else {
        globalThis.setTimeout(warmCache, 1800)
    }
}
