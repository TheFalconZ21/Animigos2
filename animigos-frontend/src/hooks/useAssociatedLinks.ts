import { useState, useEffect, useCallback } from 'react'

export type NameSeparator = 'guion' | 'ninguna'
export type ChapterSeparator = 'barra' | 'guion' | 'ninguna'

export interface AssociatedLinksConfig {
    enabled: boolean
    domain: string
    nameSeparator: NameSeparator
    chapterSeparator: ChapterSeparator
}

export const DEFAULT_ASSOCIATED_LINKS_CONFIG: AssociatedLinksConfig = {
    enabled: true,
    domain: 'crunchyroll.com',
    nameSeparator: 'guion',
    chapterSeparator: 'barra',
}

export const PRESET_DOMAINS = [
    { id: 'crunchyroll', label: 'Crunchyroll', domain: 'crunchyroll.com', chapterSep: 'barra' as ChapterSeparator },
    { id: 'myanimelist', label: 'MyAnimeList', domain: 'myanimelist.net', chapterSep: 'barra' as ChapterSeparator },
    { id: 'animeflv', label: 'AnimeFLV', domain: 'animeflv.net', chapterSep: 'guion' as ChapterSeparator },
    { id: 'jkanime', label: 'JKAnime', domain: 'jkanime.net', chapterSep: 'barra' as ChapterSeparator },
    { id: 'monoschinos', label: 'MonosChinos', domain: 'monoschinos2.com', chapterSep: 'barra' as ChapterSeparator },
]

export const STORAGE_KEY_ASSOCIATED_LINKS = 'animigos_associated_links_config'
export const EVENT_ASSOCIATED_LINKS_UPDATED = 'animigos_associated_links_updated'

/**
 * Normaliza y formatea el nombre del anime según la separación configurada.
 */
export function cleanAnimeTitleForSlug(title: string, separator: NameSeparator = 'guion'): string {
    if (!title) return ''
    // Normalizar a caracteres base (elimina acentos, diéresis, etc.)
    const normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

    if (separator === 'guion') {
        // Reemplazar espacios y caracteres no alfanuméricos por un guion
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    } else {
        // separator === 'ninguna': eliminar espacios y símbolos, unir todo
        return normalized.replace(/[^a-z0-9]+/g, '')
    }
}

/**
 * Construye la URL completa según la configuración establecida por el usuario:
 * dominio general + nombre del anime (separado o junto) + capítulo elegido (unión establecida).
 */
export function buildAssociatedAnimeUrl(
    title: string,
    episode?: number | string | null,
    config: AssociatedLinksConfig = DEFAULT_ASSOCIATED_LINKS_CONFIG
): string {
    const rawDomain = (config.domain || '').trim().replace(/\/+$/, '')
    if (!rawDomain) return '#'

    // Asegurar que el dominio tenga esquema (https://)
    let domainWithScheme = rawDomain
    if (!domainWithScheme.startsWith('http://') && !domainWithScheme.startsWith('https://')) {
        domainWithScheme = `https://${domainWithScheme}`
    }

    const animeSlug = cleanAnimeTitleForSlug(title, config.nameSeparator)
    if (!animeSlug) return domainWithScheme

    const parsedEp = episode !== null && episode !== undefined && Number(episode) > 0 ? Number(episode) : null

    // Si no hay capítulo especificado, apuntar a la ficha/página del anime
    if (parsedEp === null) {
        return `${domainWithScheme}/${animeSlug}`
    }

    // Unir slug con capítulo según la separación de capítulos
    let pathPart = ''
    switch (config.chapterSeparator) {
        case 'barra':
            pathPart = `${animeSlug}/${parsedEp}`
            break
        case 'guion':
            pathPart = `${animeSlug}-${parsedEp}`
            break
        case 'ninguna':
            pathPart = `${animeSlug}${parsedEp}`
            break
        default:
            pathPart = `${animeSlug}/${parsedEp}`
            break
    }

    return `${domainWithScheme}/${pathPart}`
}

/**
 * Hook para consumir y actualizar la configuración de links asociados en cualquier componente.
 */
export function useAssociatedLinks() {
    const [config, setConfigState] = useState<AssociatedLinksConfig>(() => {
        if (typeof window === 'undefined') return DEFAULT_ASSOCIATED_LINKS_CONFIG
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ASSOCIATED_LINKS)
            if (raw) {
                const parsed = JSON.parse(raw)
                return { ...DEFAULT_ASSOCIATED_LINKS_CONFIG, ...parsed }
            }
        } catch {
            // fallback si el JSON es inválido
        }
        return DEFAULT_ASSOCIATED_LINKS_CONFIG
    })

    useEffect(() => {
        const handleSync = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY_ASSOCIATED_LINKS)
                if (raw) {
                    setConfigState({ ...DEFAULT_ASSOCIATED_LINKS_CONFIG, ...JSON.parse(raw) })
                }
            } catch {
                // fallback
            }
        }

        window.addEventListener(EVENT_ASSOCIATED_LINKS_UPDATED, handleSync)
        window.addEventListener('storage', handleSync)
        return () => {
            window.removeEventListener(EVENT_ASSOCIATED_LINKS_UPDATED, handleSync)
            window.removeEventListener('storage', handleSync)
        }
    }, [])

    const updateConfig = useCallback((newConfig: Partial<AssociatedLinksConfig>) => {
        setConfigState((prev) => {
            const next = { ...prev, ...newConfig }
            try {
                localStorage.setItem(STORAGE_KEY_ASSOCIATED_LINKS, JSON.stringify(next))
                window.dispatchEvent(new CustomEvent(EVENT_ASSOCIATED_LINKS_UPDATED, { detail: next }))
            } catch (err) {
                console.error('Error guardando configuración de links asociados:', err)
            }
            return next
        })
    }, [])

    const getAnimeUrl = useCallback(
        (title: string, episode?: number | string | null) => {
            return buildAssociatedAnimeUrl(title, episode, config)
        },
        [config]
    )

    const openAnimeLink = useCallback(
        (title: string, episode?: number | string | null, e?: React.MouseEvent) => {
            if (e) {
                e.stopPropagation()
                e.preventDefault()
            }
            const url = buildAssociatedAnimeUrl(title, episode, config)
            if (url && url !== '#') {
                window.open(url, '_blank', 'noopener,noreferrer')
            }
        },
        [config]
    )

    return {
        config,
        updateConfig,
        getAnimeUrl,
        openAnimeLink,
        isEnabled: config.enabled,
    }
}
