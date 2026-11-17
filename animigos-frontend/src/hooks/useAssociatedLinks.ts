import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAuthHeaders } from '../services/authApi'

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
        domain: '',
        intermediateTerm: '',
        sectionSeparator: 'barra',
        nameSeparator: 'guion',
        suffixSeparator: 'barra',
        suffix: '',
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

export function getAssociatedLinksStorageKey(userId?: string | null): string {
    if (!userId) {
        return 'animigos_associated_links_guest'
    }
    return `animigos_associated_links_user_${userId}`
}

export async function syncAssociatedLinksToBackend(settings: AssociatedLinksSettings): Promise<void> {
    try {
        const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
        const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`
        await fetch(`${API_BASE_URL}/users/me/preferences/`, {
            method: 'PATCH',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({
                privacy_settings: {
                    associated_links_settings: settings,
                },
            }),
        })
    } catch (e) {
        console.warn('No se pudo sincronizar los enlaces asociados con el backend:', e)
    }
}

export function loadPersistedSettings(
    userId?: string | null,
    backendSettings?: AssociatedLinksSettings | null
): AssociatedLinksSettings {
    if (typeof window === 'undefined') return createDefaultSettings()

    // 1. Invitado sin sesión activa: NUNCA cargar datos de cuentas de usuario ni la clave global compartida
    if (!userId) {
        try {
            const guestRaw = localStorage.getItem('animigos_associated_links_guest')
            if (guestRaw) {
                const parsed = JSON.parse(guestRaw)
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
        } catch {
            // fallback
        }
        return createDefaultSettings()
    }

    // 2. Revisar localStorage privado de este usuario (fuente de verdad local más reciente)
    try {
        const userKey = getAssociatedLinksStorageKey(userId)
        const raw = localStorage.getItem(userKey)
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

        // 3. Si no hay nada en localStorage para este usuario en este navegador, hidratar desde backendSettings
        if (backendSettings && Array.isArray(backendSettings.slots) && backendSettings.slots.length > 0) {
            const defaults = createDefaultSettings()
            const slots = defaults.slots.map((defSlot) => {
                const found = backendSettings.slots?.find((s: LinkSlotConfig) => s.id === defSlot.id)
                return found ? { ...defSlot, ...found } : defSlot
            })
            const hydrated: AssociatedLinksSettings = {
                globalEnabled: backendSettings.globalEnabled ?? defaults.globalEnabled,
                activeSlotId: backendSettings.activeSlotId || defaults.activeSlotId,
                slots,
                animeOverrides: backendSettings.animeOverrides || {},
            }
            try {
                localStorage.setItem(userKey, JSON.stringify(hydrated))
            } catch {
                // ignore
            }
            return hydrated
        }

        // 4. Migración segura de configuración global compartida previa hacia esta cuenta autenticada
        const legacy = localStorage.getItem(STORAGE_KEY_ASSOCIATED_SETTINGS)
        if (legacy) {
            const parsedLegacy = JSON.parse(legacy)
            const defaults = createDefaultSettings()
            const slots = defaults.slots.map((defSlot) => {
                const found = parsedLegacy.slots?.find((s: LinkSlotConfig) => s.id === defSlot.id)
                return found ? { ...defSlot, ...found } : defSlot
            })
            const migrated: AssociatedLinksSettings = {
                globalEnabled: parsedLegacy.globalEnabled ?? defaults.globalEnabled,
                activeSlotId: parsedLegacy.activeSlotId || defaults.activeSlotId,
                slots,
                animeOverrides: parsedLegacy.animeOverrides || {},
            }
            // Guardar bajo el usuario activo y purgar la clave global para que no se filtre a invitados
            localStorage.setItem(userKey, JSON.stringify(migrated))
            localStorage.removeItem(STORAGE_KEY_ASSOCIATED_SETTINGS)
            localStorage.removeItem(STORAGE_KEY_LEGACY_CONFIG)

            // Sincronizar de inmediato al backend en la cuenta del usuario
            syncAssociatedLinksToBackend(migrated).catch(() => {})

            return migrated
        }
    } catch {
        // fallback
    }

    return createDefaultSettings()
}

/**
 * Hook para gestionar los 8 perfiles de links asociados y la selección activa.
 * Aislado estrictamente por usuario autenticado (Zero Trust).
 */
export function useAssociatedLinks() {
    const { user, isAuthenticated } = useAuth()
    const backendSettings = user?.preferences?.privacy_settings?.associated_links_settings as AssociatedLinksSettings | undefined

    const [settings, setSettingsState] = useState<AssociatedLinksSettings>(() =>
        loadPersistedSettings(user?.id, backendSettings)
    )

    useEffect(() => {
        const loaded = loadPersistedSettings(user?.id, backendSettings)
        setSettingsState(loaded)
    }, [user?.id, backendSettings])

    useEffect(() => {
        const handleSync = (e: Event) => {
            const customEvent = e as CustomEvent<AssociatedLinksSettings>
            if (customEvent && customEvent.detail && Array.isArray(customEvent.detail.slots)) {
                setSettingsState(customEvent.detail)
                return
            }
            setSettingsState(loadPersistedSettings(user?.id, backendSettings))
        }

        window.addEventListener(EVENT_ASSOCIATED_LINKS_UPDATED, handleSync)
        window.addEventListener('storage', handleSync)
        return () => {
            window.removeEventListener(EVENT_ASSOCIATED_LINKS_UPDATED, handleSync)
            window.removeEventListener('storage', handleSync)
        }
    }, [user?.id, backendSettings])

    const persistSettings = useCallback(
        (newSettings: AssociatedLinksSettings) => {
            setSettingsState(newSettings)
            const storageKey = getAssociatedLinksStorageKey(user?.id)
            try {
                localStorage.setItem(storageKey, JSON.stringify(newSettings))
                const active = newSettings.slots.find((s) => s.id === newSettings.activeSlotId) || newSettings.slots[0]
                if (active) {
                    localStorage.setItem(`animigos_associated_links_config_${user?.id || 'guest'}`, JSON.stringify(active))
                }
                // Limpiar claves legacy para evitar filtraciones globales
                localStorage.removeItem(STORAGE_KEY_ASSOCIATED_SETTINGS)
                localStorage.removeItem(STORAGE_KEY_LEGACY_CONFIG)

                window.dispatchEvent(new CustomEvent(EVENT_ASSOCIATED_LINKS_UPDATED, { detail: newSettings }))
            } catch (err) {
                console.error('Error persistiendo settings de links asociados:', err)
            }

            // Sincronizar con el backend si el usuario está autenticado
            if (user?.id) {
                syncAssociatedLinksToBackend(newSettings).catch((err) => {
                    console.error('Error sincronizando links asociados con backend:', err)
                })
            }
        },
        [user?.id]
    )

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
                    const slotMap = { ...nextOverrides[animeKey] }
                    delete slotMap[slotId]
                    if (Object.keys(slotMap).length === 0) {
                        delete nextOverrides[animeKey]
                    } else {
                        nextOverrides[animeKey] = slotMap
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

    const saveAnimeExactUrl = useCallback(
        (anime: string | OpenLinkSelectorPayload, slotId: number, exactUrl: string | null) => {
            const animeKey = getAnimeOverrideKey(anime)
            if (!animeKey || slotId < 1 || slotId > TOTAL_SLOTS) return

            const nextOverrides = { ...(settings.animeOverrides || {}) }
            const trimmed = (exactUrl || '').trim()

            if (!trimmed) {
                if (nextOverrides[animeKey]) {
                    const slotMap = { ...nextOverrides[animeKey] }
                    delete slotMap[slotId]
                    if (Object.keys(slotMap).length === 0) {
                        delete nextOverrides[animeKey]
                    } else {
                        nextOverrides[animeKey] = slotMap
                    }
                }
            } else {
                nextOverrides[animeKey] = {
                    ...(nextOverrides[animeKey] || {}),
                    [slotId]: {
                        customUrl: trimmed,
                    },
                }
            }
            persistSettings({ ...settings, animeOverrides: nextOverrides })
        },
        [settings, persistSettings]
    )

    const getAnimeExactUrl = useCallback(
        (anime: string | OpenLinkSelectorPayload, slotId: number): string | undefined => {
            const animeKey = getAnimeOverrideKey(anime)
            if (!animeKey) return undefined
            return settings.animeOverrides?.[animeKey]?.[slotId]?.customUrl
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
            if (!isAuthenticated) {
                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                dialog?.showModal()
                return
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
        [settings.slots, settings.animeOverrides, activeSlot, isAuthenticated]
    )

    const hasAnyConfiguredSlot = settings.slots.some(
        (s) => s.enabled && Boolean(s.domain && s.domain.trim())
    )

    const isEnabled = Boolean(isAuthenticated && settings.globalEnabled && hasAnyConfiguredSlot)

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
        saveAnimeExactUrl,
        getAnimeExactUrl,
        getAnimeUrl,
        openAnimeLink,
        isEnabled,
    }
}
