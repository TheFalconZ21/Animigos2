import { useState, useEffect, useCallback } from 'react'

export type NameSeparator = 'guion' | 'guion_bajo' | 'ninguna'
export type SectionSeparator = 'barra' | 'guion' | 'ninguna'
export type SuffixSeparator = 'guion' | 'barra' | 'punto' | 'ninguna'

export interface LinkSlotConfig {
    id: number // 1 al 8
    name: string // ej: "Perfil 1"
    enabled: boolean
    domain: string
    intermediateTerm: string
    sectionSeparator: SectionSeparator
    nameSeparator: NameSeparator
    suffixSeparator: SuffixSeparator
    suffix: string
}

export interface AssociatedLinksSettings {
    globalEnabled: boolean
    activeSlotId: number // 1 al 8
    slots: LinkSlotConfig[]
}

export type AssociatedLinksConfig = LinkSlotConfig

export const TOTAL_SLOTS = 8

export function createDefaultSlot(id: number, name?: string): LinkSlotConfig {
    return {
        id,
        name: name || `Perfil ${id}`,
        enabled: true,
        domain: id === 1 ? 'www.animigos.app' : '',
        intermediateTerm: id === 1 ? 'serie' : '',
        sectionSeparator: 'barra',
        nameSeparator: 'guion',
        suffixSeparator: 'barra',
        suffix: id === 1 ? 'chapter-6' : '',
    }
}

export function createDefaultSettings(): AssociatedLinksSettings {
    return {
        globalEnabled: true,
        activeSlotId: 1,
        slots: Array.from({ length: TOTAL_SLOTS }, (_, i) => createDefaultSlot(i + 1)),
    }
}

export const STORAGE_KEY_ASSOCIATED_SETTINGS = 'animigos_associated_links_settings'
export const STORAGE_KEY_LEGACY_CONFIG = 'animigos_associated_links_config'
export const EVENT_ASSOCIATED_LINKS_UPDATED = 'animigos_associated_links_updated'

/**
 * Normaliza y formatea el nombre del anime según la separación configurada.
 * Soporta guion (-), guion bajo (_) y ninguna.
 */
export function cleanAnimeTitleForSlug(title: string, separator: NameSeparator = 'guion'): string {
    if (!title) return ''
    const normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

    if (separator === 'guion') {
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    } else if (separator === 'guion_bajo') {
        return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    } else {
        return normalized.replace(/[^a-z0-9]+/g, '')
    }
}

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
 */
export function buildAssociatedAnimeUrl(
    title: string,
    config?: Partial<LinkSlotConfig>
): string {
    if (!config) return '#'
    const rawDomain = (config.domain || '').trim().replace(/\/+$/, '')
    if (!rawDomain) return '#'

    let domainWithScheme = rawDomain
    if (!domainWithScheme.startsWith('http://') && !domainWithScheme.startsWith('https://')) {
        domainWithScheme = `https://${domainWithScheme}`
    }

    const sectionChar = getSectionChar(config.sectionSeparator || 'barra')
    const suffixChar = getSuffixChar(config.suffixSeparator || 'guion')

    const animeSlug = cleanAnimeTitleForSlug(title, config.nameSeparator || 'guion')
    const rawInter = (config.intermediateTerm || '').trim().replace(/^\/+|\/+$/g, '')

    let rawSuffix = (config.suffix || '').trim()
    if (rawSuffix.startsWith('-') || rawSuffix.startsWith('/') || rawSuffix.startsWith('.')) {
        rawSuffix = rawSuffix.substring(1).trim()
    }

    let animePart = ''
    if (animeSlug) {
        if (rawSuffix) {
            animePart = `${animeSlug}${suffixChar}${rawSuffix}`
        } else {
            animePart = animeSlug
        }
    } else if (rawSuffix) {
        animePart = rawSuffix
    }

    let path = ''
    if (rawInter && animePart) {
        path = `${rawInter}${sectionChar}${animePart}`
    } else if (rawInter) {
        path = rawInter
    } else if (animePart) {
        path = animePart
    }

    if (!path) {
        return domainWithScheme
    }

    if (sectionChar === '/') {
        return `${domainWithScheme}/${path}`
    }

    return `${domainWithScheme}${sectionChar}${path}`
}

function loadPersistedSettings(): AssociatedLinksSettings {
    if (typeof window === 'undefined') return createDefaultSettings()
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ASSOCIATED_SETTINGS)
        if (raw) {
            const parsed = JSON.parse(raw)
            const defaults = createDefaultSettings()
            const slots = defaults.slots.map((defSlot) => {
                const found = parsed.slots?.find((s: LinkSlotConfig) => s.id === defSlot.id)
                return found ? { ...defSlot, ...found } : defSlot
            })
            return {
                globalEnabled: parsed.globalEnabled ?? defaults.globalEnabled,
                activeSlotId: parsed.activeSlotId || defaults.activeSlotId,
                slots,
            }
        }

        // Migración de configuración previa si existía
        const legacy = localStorage.getItem(STORAGE_KEY_LEGACY_CONFIG)
        if (legacy) {
            const parsedLegacy = JSON.parse(legacy)
            const defaults = createDefaultSettings()
            defaults.slots[0] = { ...defaults.slots[0], ...parsedLegacy, id: 1 }
            defaults.globalEnabled = parsedLegacy.enabled ?? true
            return defaults
        }
    } catch {
        // fallback
    }
    return createDefaultSettings()
}

/**
 * Hook para gestionar los 8 perfiles de links asociados y la selección activa.
 */
export function useAssociatedLinks() {
    const [settings, setSettingsState] = useState<AssociatedLinksSettings>(loadPersistedSettings)

    useEffect(() => {
        const handleSync = () => {
            setSettingsState(loadPersistedSettings())
        }

        window.addEventListener(EVENT_ASSOCIATED_LINKS_UPDATED, handleSync)
        window.addEventListener('storage', handleSync)
        return () => {
            window.removeEventListener(EVENT_ASSOCIATED_LINKS_UPDATED, handleSync)
            window.removeEventListener('storage', handleSync)
        }
    }, [])

    const persistSettings = useCallback((newSettings: AssociatedLinksSettings) => {
        setSettingsState(newSettings)
        try {
            localStorage.setItem(STORAGE_KEY_ASSOCIATED_SETTINGS, JSON.stringify(newSettings))
            // Mantener sincronizado el key legacy con el slot activo para retrocompatibilidad
            const active = newSettings.slots.find((s) => s.id === newSettings.activeSlotId) || newSettings.slots[0]
            if (active) {
                localStorage.setItem(STORAGE_KEY_LEGACY_CONFIG, JSON.stringify(active))
            }
            window.dispatchEvent(new CustomEvent(EVENT_ASSOCIATED_LINKS_UPDATED, { detail: newSettings }))
        } catch (err) {
            console.error('Error persistiendo settings de links asociados:', err)
        }
    }, [])

    const updateSlot = useCallback(
        (slotId: number, slotChanges: Partial<LinkSlotConfig>) => {
            const nextSlots = settings.slots.map((s) => (s.id === slotId ? { ...s, ...slotChanges } : s))
            persistSettings({ ...settings, slots: nextSlots })
        },
        [settings, persistSettings]
    )

    const setActiveSlotId = useCallback(
        (slotId: number) => {
            if (slotId < 1 || slotId > TOTAL_SLOTS) return
            persistSettings({ ...settings, activeSlotId: slotId })
        },
        [settings, persistSettings]
    )

    const updateGlobalEnabled = useCallback(
        (enabled: boolean) => {
            persistSettings({ ...settings, globalEnabled: enabled })
        },
        [settings, persistSettings]
    )

    const updateConfig = useCallback(
        (activeChanges: Partial<LinkSlotConfig>) => {
            updateSlot(settings.activeSlotId, activeChanges)
        },
        [settings.activeSlotId, updateSlot]
    )

    const activeSlot: LinkSlotConfig =
        settings.slots.find((s) => s.id === settings.activeSlotId) || settings.slots[0]

    const getAnimeUrl = useCallback(
        (title: string, slotId?: number) => {
            const targetSlot = slotId ? settings.slots.find((s) => s.id === slotId) : activeSlot
            return buildAssociatedAnimeUrl(title, targetSlot || activeSlot)
        },
        [settings.slots, activeSlot]
    )

    const openAnimeLink = useCallback(
        (title: string, e?: React.MouseEvent, slotId?: number) => {
            if (e) {
                e.stopPropagation()
                e.preventDefault()
            }
            const targetSlot = slotId ? settings.slots.find((s) => s.id === slotId) : activeSlot
            const url = buildAssociatedAnimeUrl(title, targetSlot || activeSlot)
            if (url && url !== '#') {
                window.open(url, '_blank', 'noopener,noreferrer')
            }
        },
        [settings.slots, activeSlot]
    )

    return {
        settings,
        slots: settings.slots,
        activeSlot,
        activeSlotId: settings.activeSlotId,
        config: activeSlot,
        updateSlot,
        setActiveSlotId,
        updateGlobalEnabled,
        updateConfig,
        persistSettings,
        getAnimeUrl,
        openAnimeLink,
        isEnabled: settings.globalEnabled && activeSlot.enabled && !!activeSlot.domain,
    }
}
