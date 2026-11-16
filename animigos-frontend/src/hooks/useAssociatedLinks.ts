import { useState, useEffect, useCallback } from 'react'

export type NameSeparator = 'guion' | 'ninguna'
export type SectionSeparator = 'barra' | 'guion' | 'ninguna'
export type SuffixSeparator = 'guion' | 'barra' | 'punto' | 'ninguna'

export interface AssociatedLinksConfig {
    enabled: boolean
    domain: string
    intermediateTerm: string
    sectionSeparator: SectionSeparator
    nameSeparator: NameSeparator
    suffixSeparator: SuffixSeparator
    suffix: string
}

export const DEFAULT_ASSOCIATED_LINKS_CONFIG: AssociatedLinksConfig = {
    enabled: true,
    domain: '',
    intermediateTerm: '',
    sectionSeparator: 'barra',
    nameSeparator: 'guion',
    suffixSeparator: 'guion',
    suffix: '',
}

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
 * Obtiene el carácter correspondiente a un separador de sección.
 */
function getSectionChar(sep: SectionSeparator): string {
    switch (sep) {
        case 'barra':
            return '/'
        case 'guion':
            return '-'
        case 'ninguna':
            return ''
        default:
            return '/'
    }
}

/**
 * Obtiene el carácter correspondiente a un separador de sufijo.
 */
function getSuffixChar(sep: SuffixSeparator): string {
    switch (sep) {
        case 'guion':
            return '-'
        case 'barra':
            return '/'
        case 'punto':
            return '.'
        case 'ninguna':
            return ''
        default:
            return '-'
    }
}

/**
 * Construye la URL completa según la fórmula:
 * dominio + término intermedio + nombre anime + terminación
 * (sin ningún tipo de vinculación automática con capítulos ni sitios predefinidos).
 */
export function buildAssociatedAnimeUrl(
    title: string,
    config: AssociatedLinksConfig = DEFAULT_ASSOCIATED_LINKS_CONFIG
): string {
    const rawDomain = (config.domain || '').trim().replace(/\/+$/, '')
    if (!rawDomain) return '#'

    // Asegurar esquema seguro (https://) si no tiene protocolo
    let domainWithScheme = rawDomain
    if (!domainWithScheme.startsWith('http://') && !domainWithScheme.startsWith('https://')) {
        domainWithScheme = `https://${domainWithScheme}`
    }

    const sectionChar = getSectionChar(config.sectionSeparator || 'barra')
    const suffixChar = getSuffixChar(config.suffixSeparator || 'guion')

    // 1. Slug del anime
    const animeSlug = cleanAnimeTitleForSlug(title, config.nameSeparator || 'guion')

    // 2. Término intermedio limpio (remover barras sobrantes en los extremos)
    const rawInter = (config.intermediateTerm || '').trim().replace(/^\/+|\/+$/g, '')

    // 3. Terminación única limpia (remover separador si el usuario lo tipeó al inicio por error)
    let rawSuffix = (config.suffix || '').trim()
    if (rawSuffix.startsWith('-') || rawSuffix.startsWith('/') || rawSuffix.startsWith('.')) {
        rawSuffix = rawSuffix.substring(1).trim()
    }

    // 4. Construcción del bloque de anime + terminación
    let animePart = ''
    if (animeSlug) {
        if (rawSuffix) {
            animePart = `${animeSlug}${suffixChar}${rawSuffix}`
        } else {
            animePart = animeSlug
        }
    } else if (rawSuffix) {
        // En caso de que no haya título pero sí terminación
        animePart = rawSuffix
    }

    // 5. Unir con término intermedio
    let path = ''
    if (rawInter && animePart) {
        path = `${rawInter}${sectionChar}${animePart}`
    } else if (rawInter) {
        path = rawInter
    } else if (animePart) {
        path = animePart
    }

    // 6. Unir con dominio
    if (!path) {
        return domainWithScheme
    }

    if (sectionChar === '/') {
        return `${domainWithScheme}/${path}`
    }

    return `${domainWithScheme}${sectionChar}${path}`
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
        (title: string) => {
            return buildAssociatedAnimeUrl(title, config)
        },
        [config]
    )

    const openAnimeLink = useCallback(
        (title: string, e?: React.MouseEvent) => {
            if (e) {
                e.stopPropagation()
                e.preventDefault()
            }
            const url = buildAssociatedAnimeUrl(title, config)
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
