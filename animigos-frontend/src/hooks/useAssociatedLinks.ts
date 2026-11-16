import { useState, useEffect, useCallback } from 'react'

export type TitleLanguage = 'japones' | 'ingles'
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
    titleLanguage?: TitleLanguage
}

export interface AnimeLinkOverride {
    customSlug?: string
    customSuffix?: string
    customUrl?: string
    intermediateTerm?: string
    nameSeparator?: NameSeparator
    sectionSeparator?: SectionSeparator
    suffixSeparator?: SuffixSeparator
    titleLanguage?: TitleLanguage
}

export interface AssociatedLinksSettings {
    globalEnabled: boolean
    activeSlotId: number // 1 al 8
    slots: LinkSlotConfig[]
    animeOverrides?: Record<string, Record<number, AnimeLinkOverride>> // animeKey -> slotId -> override
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
        titleLanguage: 'japones',
    }
}

export function createDefaultSettings(): AssociatedLinksSettings {
    return {
        globalEnabled: true,
        activeSlotId: 1,
        slots: Array.from({ length: TOTAL_SLOTS }, (_, i) => createDefaultSlot(i + 1)),
        animeOverrides: {},
    }
}

export const STORAGE_KEY_ASSOCIATED_SETTINGS = 'animigos_associated_links_settings'
export const STORAGE_KEY_LEGACY_CONFIG = 'animigos_associated_links_config'
export const EVENT_ASSOCIATED_LINKS_UPDATED = 'animigos_associated_links_updated'
export const EVENT_OPEN_LINK_SELECTOR = 'animigos_open_link_selector'

export interface OpenLinkSelectorPayload {
    title: string
    titleEnglish?: string
    title_english?: string
}

export function requestOpenLinkSelector(anime: string | OpenLinkSelectorPayload) {
    if (typeof window === 'undefined') return
    const payload: OpenLinkSelectorPayload =
        typeof anime === 'string'
            ? { title: anime }
            : anime
    window.dispatchEvent(new CustomEvent(EVENT_OPEN_LINK_SELECTOR, { detail: payload }))
}

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

export function getAnimeOverrideKey(anime: string | OpenLinkSelectorPayload | null | undefined): string {
    if (!anime) return ''
    const raw = typeof anime === 'string' ? anime : (anime.title || anime.titleEnglish || anime.title_english || '')
    return cleanAnimeTitleForSlug(raw, 'guion')
}

/**
 * Construye la URL completa según la fórmula:
 * dominio + término intermedio + nombre anime + terminación
 * Permite superponer personalizaciones específicas por anime (AnimeLinkOverride).
 */
export function buildAssociatedAnimeUrl(
    anime: string | OpenLinkSelectorPayload,
    config?: Partial<LinkSlotConfig>,
    override?: AnimeLinkOverride | null
): string {
    if (!config) return '#'

    // Si hay una URL completa personalizada para este anime, usarla directamente
    if (override?.customUrl && override.customUrl.trim()) {
        const trimmed = override.customUrl.trim()
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed
        }
        return `https://${trimmed}`
    }

    const effectiveConfig: Partial<LinkSlotConfig> = {
        ...config,
        intermediateTerm: override?.intermediateTerm !== undefined ? override.intermediateTerm : config.intermediateTerm,
        sectionSeparator: override?.sectionSeparator || config.sectionSeparator,
        nameSeparator: override?.nameSeparator || config.nameSeparator,
        suffixSeparator: override?.suffixSeparator || config.suffixSeparator,
        suffix: override?.customSuffix !== undefined ? override.customSuffix : config.suffix,
        titleLanguage: override?.titleLanguage || config.titleLanguage,
    }

    const rawDomain = (effectiveConfig.domain || '').trim().replace(/\/+$/, '')
    if (!rawDomain) return '#'

    let domainWithScheme = rawDomain
    if (!domainWithScheme.startsWith('http://') && !domainWithScheme.startsWith('https://')) {
        domainWithScheme = `https://${domainWithScheme}`
    }

    const sectionChar = getSectionChar(effectiveConfig.sectionSeparator || 'barra')
    const suffixChar = getSuffixChar(effectiveConfig.suffixSeparator || 'guion')
    const lang = effectiveConfig.titleLanguage || 'japones'

    let rawTitle = ''
    if (typeof anime === 'string') {
        rawTitle = anime
    } else if (anime && typeof anime === 'object') {
        if (lang === 'ingles') {
            rawTitle = anime.titleEnglish || anime.title_english || anime.title || ''
        } else {
            rawTitle = anime.title || anime.titleEnglish || anime.title_english || ''
        }
    }

    const animeSlug =
        override?.customSlug !== undefined && override.customSlug.trim() !== ''
            ? override.customSlug.trim()
            : cleanAnimeTitleForSlug(rawTitle, effectiveConfig.nameSeparator || 'guion')

    const rawInter = (effectiveConfig.intermediateTerm || '').trim().replace(/^\/+|\/+$/g, '')

    let rawSuffix = (effectiveConfig.suffix || '').trim()
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
                animeOverrides: parsed.animeOverrides || {},
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

    const saveAnimeOverride = useCallback(
        (anime: string | OpenLinkSelectorPayload, slotId: number, override: AnimeLinkOverride | null) => {
            const animeKey = getAnimeOverrideKey(anime)
            if (!animeKey || slotId < 1 || slotId > TOTAL_SLOTS) return

            const nextOverrides = { ...(settings.animeOverrides || {}) }
            if (!override || Object.keys(override).length === 0) {
                if (nextOverrides[animeKey]) {
                    delete nextOverrides[animeKey][slotId]
                    if (Object.keys(nextOverrides[animeKey]).length === 0) {
                        delete nextOverrides[animeKey]
                    }
                }
            } else {
                nextOverrides[animeKey] = {
                    ...(nextOverrides[animeKey] || {}),
                    [slotId]: override,
                }
            }
            persistSettings({ ...settings, animeOverrides: nextOverrides })
        },
        [settings, persistSettings]
    )

    const getAnimeOverride = useCallback(
        (anime: string | OpenLinkSelectorPayload, slotId: number): AnimeLinkOverride | undefined => {
            const animeKey = getAnimeOverrideKey(anime)
            if (!animeKey) return undefined
            return settings.animeOverrides?.[animeKey]?.[slotId]
        },
        [settings.animeOverrides]
    )

    const getAnimeUrl = useCallback(
        (anime: string | OpenLinkSelectorPayload, slotId?: number) => {
            const targetSlot = slotId ? settings.slots.find((s) => s.id === slotId) : activeSlot
            const finalSlot = targetSlot || activeSlot
            const animeKey = getAnimeOverrideKey(anime)
            const override = settings.animeOverrides?.[animeKey]?.[finalSlot.id]
            return buildAssociatedAnimeUrl(anime, finalSlot, override)
        },
        [settings.slots, settings.animeOverrides, activeSlot]
    )

    const openAnimeLink = useCallback(
        (anime: string | OpenLinkSelectorPayload, e?: React.MouseEvent, slotId?: number) => {
            if (e) {
                e.stopPropagation()
                e.preventDefault()
            }
            if (slotId !== undefined) {
                const targetSlot = settings.slots.find((s) => s.id === slotId) || activeSlot
                const animeKey = getAnimeOverrideKey(anime)
                const override = settings.animeOverrides?.[animeKey]?.[targetSlot.id]
                const url = buildAssociatedAnimeUrl(anime, targetSlot, override)
                if (url && url !== '#') {
                    window.open(url, '_blank', 'noopener,noreferrer')
                }
                return
            }
            // Por defecto, abrir el modal de selección de los 8 slots
            requestOpenLinkSelector(anime)
        },
        [settings.slots, settings.animeOverrides, activeSlot]
    )

    const hasAnyConfiguredSlot = settings.slots.some(
        (s) => s.enabled && Boolean(s.domain && s.domain.trim())
    )

    const isEnabled = settings.globalEnabled && hasAnyConfiguredSlot

    return {
        settings,
        slots: settings.slots,
        activeSlot,
        activeSlotId: settings.activeSlotId,
        config: {
            ...activeSlot,
            domain: activeSlot.domain || (hasAnyConfiguredSlot ? 'configured' : ''),
        },
        updateSlot,
        setActiveSlotId,
        updateGlobalEnabled,
        updateConfig,
        persistSettings,
        saveAnimeOverride,
        getAnimeOverride,
        getAnimeUrl,
        openAnimeLink,
        isEnabled,
    }
}
