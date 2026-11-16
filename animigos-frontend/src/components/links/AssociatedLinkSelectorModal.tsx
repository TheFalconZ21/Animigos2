import React, { useEffect, useState, useMemo } from 'react'
import {
    X,
    Play,
    Pencil,
    ArrowLeft,
    ExternalLink,
    Copy,
    Check,
    RotateCcw,
    Globe,
    Layers,
} from 'lucide-react'
import {
    useAssociatedLinks,
    buildAssociatedAnimeUrl,
    cleanAnimeTitleForSlug,
    getAnimeOverrideKey,
    EVENT_OPEN_LINK_SELECTOR,
    type OpenLinkSelectorPayload,
    type LinkSlotConfig,
    type AnimeLinkOverride,
    type NameSeparator,
    type SectionSeparator,
    type SuffixSeparator,
    type TitleLanguage,
} from '../../hooks/useAssociatedLinks'

export const AssociatedLinkSelectorModal: React.FC = () => {
    const {
        settings,
        updateSlot,
        saveAnimeOverride,
    } = useAssociatedLinks()

    const [targetAnime, setTargetAnime] = useState<OpenLinkSelectorPayload | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [editingSlotId, setEditingSlotId] = useState<number | null>(null)

    // Estado local para edición de formulario en vivo
    const [formSlotName, setFormSlotName] = useState('')
    const [formDomain, setFormDomain] = useState('')
    const [formIntermediate, setFormIntermediate] = useState('')
    const [formSectionSep, setFormSectionSep] = useState<SectionSeparator>('barra')
    const [formNameSep, setFormNameSep] = useState<NameSeparator>('guion')
    const [formTitleLang, setFormTitleLang] = useState<TitleLanguage>('japones')
    const [formSuffix, setFormSuffix] = useState('')
    const [formSuffixSep, setFormSuffixSep] = useState<SuffixSeparator>('guion')
    const [formCustomSlug, setFormCustomSlug] = useState('')
    const [formCustomUrl, setFormCustomUrl] = useState('')
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const customEvent = e as CustomEvent<OpenLinkSelectorPayload>
            if (customEvent.detail) {
                setTargetAnime(customEvent.detail)
                setEditingSlotId(null)
                setIsOpen(true)
            }
        }
        window.addEventListener(EVENT_OPEN_LINK_SELECTOR, handleOpen)
        return () => window.removeEventListener(EVENT_OPEN_LINK_SELECTOR, handleOpen)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editingSlotId !== null) {
                    setEditingSlotId(null)
                } else {
                    setIsOpen(false)
                }
            }
        }
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen, editingSlotId])

    const animeKey = useMemo(() => {
        return targetAnime ? getAnimeOverrideKey(targetAnime) : ''
    }, [targetAnime])

    // Cargar datos en el formulario cuando se selecciona un slot para editar
    useEffect(() => {
        if (editingSlotId === null) return
        const slot = settings.slots.find((s) => s.id === editingSlotId)
        if (!slot) return

        const override = settings.animeOverrides?.[animeKey]?.[slot.id]

        setFormSlotName(slot.name || `Perfil ${slot.id}`)
        setFormDomain(slot.domain || '')
        setFormIntermediate(
            override?.intermediateTerm !== undefined ? override.intermediateTerm : (slot.intermediateTerm || '')
        )
        setFormSectionSep(override?.sectionSeparator || slot.sectionSeparator || 'barra')
        setFormNameSep(override?.nameSeparator || slot.nameSeparator || 'guion')
        setFormTitleLang(override?.titleLanguage || slot.titleLanguage || 'japones')
        setFormSuffix(
            override?.customSuffix !== undefined ? override.customSuffix : (slot.suffix || '')
        )
        setFormSuffixSep(override?.suffixSeparator || slot.suffixSeparator || 'guion')
        setFormCustomSlug(override?.customSlug || '')
        setFormCustomUrl(override?.customUrl || '')
        setCopied(false)
    }, [editingSlotId, settings.slots, settings.animeOverrides, animeKey])

    // Cálculo dinámico de la URL de previsualización en tiempo real durante la edición (Hook incondicional)
    const editingSlot = editingSlotId !== null ? settings.slots.find((s) => s.id === editingSlotId) : null

    const previewUrl = useMemo(() => {
        if (!editingSlot || !targetAnime) return '#'
        const draftSlot: LinkSlotConfig = {
            ...editingSlot,
            name: formSlotName,
            domain: formDomain,
            intermediateTerm: formIntermediate,
            sectionSeparator: formSectionSep,
            nameSeparator: formNameSep,
            suffixSeparator: formSuffixSep,
            suffix: formSuffix,
            titleLanguage: formTitleLang,
        }
        const draftOverride: AnimeLinkOverride = {
            customSlug: formCustomSlug.trim() ? formCustomSlug.trim() : undefined,
            customSuffix: formSuffix,
            customUrl: formCustomUrl.trim() ? formCustomUrl.trim() : undefined,
            intermediateTerm: formIntermediate,
            nameSeparator: formNameSep,
            sectionSeparator: formSectionSep,
            suffixSeparator: formSuffixSep,
            titleLanguage: formTitleLang,
        }
        return buildAssociatedAnimeUrl(targetAnime, draftSlot, draftOverride)
    }, [
        editingSlot,
        targetAnime,
        formSlotName,
        formDomain,
        formIntermediate,
        formSectionSep,
        formNameSep,
        formSuffixSep,
        formSuffix,
        formTitleLang,
        formCustomSlug,
        formCustomUrl,
    ])

    // Condición de salida temprana (DESPUÉS de todos los hooks de React)
    if (!isOpen || !targetAnime) return null

    const animeDisplayName = targetAnime.title || targetAnime.titleEnglish || targetAnime.title_english || 'Anime'

    // Cálculo del slug automático por defecto para este anime
    const defaultTitleForSlug = formTitleLang === 'ingles'
        ? (targetAnime.titleEnglish || targetAnime.title_english || targetAnime.title || '')
        : (targetAnime.title || targetAnime.titleEnglish || targetAnime.title_english || '')
    const defaultAutoSlug = cleanAnimeTitleForSlug(defaultTitleForSlug, formNameSep)

    const handleSelectSlot = (slot: LinkSlotConfig) => {
        if (!slot.domain || !slot.domain.trim()) return
        const override = settings.animeOverrides?.[animeKey]?.[slot.id]
        const url = buildAssociatedAnimeUrl(targetAnime, slot, override)
        if (url && url !== '#') {
            window.open(url, '_blank', 'noopener,noreferrer')
        }
        setIsOpen(false)
    }

    const handleSaveEdit = (openAfterSave: boolean = false) => {
        if (!editingSlot) return

        // 1. Actualizar configuración global del slot
        updateSlot(editingSlot.id, {
            name: formSlotName.trim() || `Perfil ${editingSlot.id}`,
            domain: formDomain.trim(),
            intermediateTerm: formIntermediate.trim(),
            sectionSeparator: formSectionSep,
            nameSeparator: formNameSep,
            suffixSeparator: formSuffixSep,
            suffix: formSuffix.trim(),
            titleLanguage: formTitleLang,
        })

        // 2. Comprobar si hay ajustes específicos o cambios puntuales para este anime
        const isCustomSlug = Boolean(formCustomSlug.trim() && formCustomSlug.trim() !== defaultAutoSlug)
        const isCustomUrl = Boolean(formCustomUrl.trim())
        const isCustomSuffix = formSuffix.trim() !== (editingSlot.suffix || '')
        const isCustomInter = formIntermediate.trim() !== (editingSlot.intermediateTerm || '')

        const shouldSaveOverride = isCustomSlug || isCustomUrl || isCustomSuffix || isCustomInter

        if (shouldSaveOverride) {
            saveAnimeOverride(targetAnime, editingSlot.id, {
                customSlug: formCustomSlug.trim() || undefined,
                customSuffix: formSuffix.trim(),
                customUrl: formCustomUrl.trim() || undefined,
                intermediateTerm: formIntermediate.trim(),
                nameSeparator: formNameSep,
                sectionSeparator: formSectionSep,
                suffixSeparator: formSuffixSep,
                titleLanguage: formTitleLang,
            })
        } else {
            saveAnimeOverride(targetAnime, editingSlot.id, null)
        }

        if (openAfterSave && previewUrl && previewUrl !== '#') {
            window.open(previewUrl, '_blank', 'noopener,noreferrer')
            setIsOpen(false)
            setEditingSlotId(null)
        } else {
            setEditingSlotId(null)
        }
    }

    const handleCopyUrl = async () => {
        if (!previewUrl || previewUrl === '#') return
        try {
            await navigator.clipboard.writeText(previewUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // fallback
        }
    }

    const handleTestLiveUrl = () => {
        if (!previewUrl || previewUrl === '#') return
        window.open(previewUrl, '_blank', 'noopener,noreferrer')
    }

    return (
        <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 animate-fade-in"
            style={{
                zIndex: 1060,
                background: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(10px)',
            }}
            onClick={() => {
                if (editingSlotId !== null) {
                    setEditingSlotId(null)
                } else {
                    setIsOpen(false)
                }
            }}
        >
            <div
                className="rounded-4 p-4 position-relative border transition-all"
                style={{
                    width: '100%',
                    maxWidth: editingSlotId !== null ? '620px' : '540px',
                    background: 'linear-gradient(180deg, #161622 0%, #0d0d15 100%)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(168, 85, 247, 0.12)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ========================================================
                    VISTA A: CUADRÍCULA 2x4 DE SELECCIÓN CON ICONOS DE LÁPIZ
                   ======================================================== */}
                {editingSlotId === null ? (
                    <div>
                        {/* Cabecera minimalista con botón cerrar y botón editar activo */}
                        <div className="position-absolute top-0 end-0 m-3 d-flex align-items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setEditingSlotId(settings.activeSlotId || 1)}
                                className="p-1 rounded-circle border-0 d-flex align-items-center justify-content-center"
                                style={{
                                    width: 28,
                                    height: 28,
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                title="Editar enlace asociado activo"
                                aria-label="Editar enlace asociado activo"
                            >
                                <Pencil size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-circle border-0 d-flex align-items-center justify-content-center"
                                style={{
                                    width: 28,
                                    height: 28,
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                aria-label="Cerrar selector"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="mb-3.5 pe-5">
                            <div className="d-flex align-items-center gap-1.5 mb-1">
                                <Play size={13} fill="currentColor" style={{ color: 'var(--perfil-acento, #a855f7)' }} />
                                <span className="small fw-bold text-white" style={{ fontSize: '0.86rem', letterSpacing: '0.02em' }}>
                                    Selecciona un enlace asociado
                                </span>
                            </div>
                            <div className="text-truncate font-mono" style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.74rem' }}>
                                {animeDisplayName}
                            </div>
                        </div>

                        {/* Cuadrícula de 8 opciones: 2 filas x 4 columnas */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '10px',
                            }}
                        >
                            {settings.slots.map((slot) => {
                                const hasDomain = Boolean(slot.domain && slot.domain.trim())
                                const slotName = slot.name && slot.name.trim() ? slot.name : `Perfil ${slot.id}`
                                const hasOverride = Boolean(settings.animeOverrides?.[animeKey]?.[slot.id])

                                return (
                                    <div
                                        key={slot.id}
                                        className="position-relative"
                                        style={{ height: '66px' }}
                                    >
                                        <button
                                            type="button"
                                            disabled={!hasDomain}
                                            onClick={() => handleSelectSlot(slot)}
                                            title={hasDomain ? `Abrir con ${slotName}` : `${slotName} (Sin configurar — Haz clic en el lápiz para editarlo)`}
                                            className="w-100 h-100 p-2 d-flex align-items-center justify-content-center text-center transition-all"
                                            style={{
                                                borderRadius: '11px',
                                                background: hasDomain
                                                    ? 'rgba(255, 255, 255, 0.04)'
                                                    : 'rgba(255, 255, 255, 0.015)',
                                                border: hasDomain
                                                    ? hasOverride
                                                        ? '1px solid rgba(168, 85, 247, 0.45)'
                                                        : '1px solid rgba(255, 255, 255, 0.09)'
                                                    : '1px dashed rgba(255, 255, 255, 0.05)',
                                                color: hasDomain ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
                                                cursor: hasDomain ? 'pointer' : 'default',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                lineHeight: 1.25,
                                                overflow: 'hidden',
                                                wordBreak: 'break-word',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (hasDomain) {
                                                    e.currentTarget.style.borderColor = 'var(--perfil-acento, #a855f7)'
                                                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.14)'
                                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 85, 247, 0.22)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (hasDomain) {
                                                    e.currentTarget.style.borderColor = hasOverride
                                                        ? 'rgba(168, 85, 247, 0.45)'
                                                        : 'rgba(255, 255, 255, 0.09)'
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                                                    e.currentTarget.style.transform = 'translateY(0)'
                                                    e.currentTarget.style.boxShadow = 'none'
                                                }
                                            }}
                                        >
                                            <span className="text-truncate px-1" style={{ maxWidth: '82%' }}>
                                                {slotName}
                                            </span>
                                        </button>

                                        {/* Icono de lápiz para editar cosas puntuales de este enlace */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingSlotId(slot.id)
                                            }}
                                            className="position-absolute top-0 end-0 m-1 rounded-circle border-0 d-flex align-items-center justify-content-center"
                                            style={{
                                                width: 20,
                                                height: 20,
                                                background: hasOverride
                                                    ? 'rgba(168, 85, 247, 0.28)'
                                                    : 'rgba(255, 255, 255, 0.06)',
                                                color: hasOverride
                                                    ? 'var(--perfil-acento, #c084fc)'
                                                    : 'rgba(255, 255, 255, 0.55)',
                                                cursor: 'pointer',
                                                transition: 'all 0.16s ease',
                                                zIndex: 3,
                                            }}
                                            title={hasOverride ? `Editar ${slotName} (Tiene ajustes personalizados para este anime)` : `Editar ${slotName}`}
                                            aria-label={`Editar ${slotName}`}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--perfil-acento, #a855f7)'
                                                e.currentTarget.style.color = '#ffffff'
                                                e.currentTarget.style.transform = 'scale(1.15)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = hasOverride
                                                    ? 'rgba(168, 85, 247, 0.28)'
                                                    : 'rgba(255, 255, 255, 0.06)'
                                                e.currentTarget.style.color = hasOverride
                                                    ? 'var(--perfil-acento, #c084fc)'
                                                    : 'rgba(255, 255, 255, 0.55)'
                                                e.currentTarget.style.transform = 'scale(1)'
                                            }}
                                        >
                                            <Pencil size={10} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    /* ========================================================
                        VISTA B: EDITOR PUNTUAL DEL ENLACE ASOCIADO SELECCIONADO
                       ======================================================== */
                    <div className="animate-fade-in">
                        {/* Cabecera del Editor */}
                        <div
                            className="d-flex align-items-center justify-content-between mb-3 pb-2.5 border-bottom"
                            style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
                        >
                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setEditingSlotId(null)}
                                    className="p-1 rounded-circle border-0 d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        color: 'rgba(255, 255, 255, 0.75)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                    title="Volver a los 8 slots"
                                    aria-label="Volver"
                                >
                                    <ArrowLeft size={15} />
                                </button>
                                <div className="text-truncate">
                                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                        <Pencil size={13} style={{ color: 'var(--perfil-acento, #a855f7)' }} />
                                        <span className="fw-bold text-white" style={{ fontSize: '0.88rem' }}>
                                            Editar Enlace Asociado
                                        </span>
                                        <span
                                            className="badge rounded-pill"
                                            style={{
                                                background: 'rgba(168, 85, 247, 0.18)',
                                                color: 'var(--perfil-acento, #c084fc)',
                                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                                fontSize: '0.68rem',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Slot #{editingSlotId}
                                        </span>
                                    </div>
                                    <div className="text-truncate font-mono" style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.72rem' }}>
                                        {animeDisplayName}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-circle border-0 d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                    width: 28,
                                    height: 28,
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    cursor: 'pointer',
                                }}
                                aria-label="Cerrar selector"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Visor de URL Dinámica en Vivo */}
                        <div
                            className="p-3 rounded-3 mb-3 border position-relative"
                            style={{
                                background: 'rgba(0, 0, 0, 0.45)',
                                borderColor: 'rgba(168, 85, 247, 0.35)',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-1.5 flex-wrap gap-2">
                                <span
                                    className="text-uppercase fw-bold d-inline-flex align-items-center gap-1"
                                    style={{ fontSize: '0.66rem', letterSpacing: '0.06em', color: 'var(--perfil-acento, #a855f7)' }}
                                >
                                    <span>⚡ Resultado en Vivo para este Anime</span>
                                </span>
                                <div className="d-flex align-items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleCopyUrl}
                                        className="btn btn-sm py-0.5 px-2 rounded-2 border-0 d-inline-flex align-items-center gap-1"
                                        style={{
                                            fontSize: '0.68rem',
                                            background: 'rgba(255, 255, 255, 0.07)',
                                            color: copied ? '#4ade80' : 'rgba(255, 255, 255, 0.8)',
                                            cursor: 'pointer',
                                        }}
                                        title="Copiar URL generada"
                                    >
                                        {copied ? <Check size={11} /> : <Copy size={11} />}
                                        <span>{copied ? 'Copiado' : 'Copiar'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleTestLiveUrl}
                                        disabled={!previewUrl || previewUrl === '#'}
                                        className="btn btn-sm py-0.5 px-2.5 rounded-2 border-0 d-inline-flex align-items-center gap-1 fw-bold"
                                        style={{
                                            fontSize: '0.68rem',
                                            background: 'var(--perfil-acento, #a855f7)',
                                            color: '#ffffff',
                                            cursor: previewUrl && previewUrl !== '#' ? 'pointer' : 'not-allowed',
                                        }}
                                        title="Probar en una nueva pestaña"
                                    >
                                        <ExternalLink size={11} />
                                        <span>Probar ↗</span>
                                    </button>
                                </div>
                            </div>
                            <div
                                className="font-mono text-break"
                                style={{
                                    fontSize: '0.76rem',
                                    color: '#f3e8ff',
                                    wordBreak: 'break-all',
                                }}
                            >
                                {previewUrl !== '#' ? (
                                    previewUrl
                                ) : (
                                    <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontStyle: 'italic' }}>
                                        Ingresa un dominio para generar la ruta completa
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Formulario de Modificaciones Puntuales */}
                        <div className="d-flex flex-column gap-3">
                            {/* Fila 1: Nombre del Perfil y Dominio General */}
                            <div className="row g-2">
                                <div className="col-12 col-sm-4">
                                    <label className="form-label small fw-semibold text-white mb-1" style={{ fontSize: '0.74rem' }}>
                                        Nombre de la Tarjeta
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            fontSize: '0.78rem',
                                            borderRadius: '8px',
                                        }}
                                        value={formSlotName}
                                        onChange={(e) => setFormSlotName(e.target.value)}
                                        placeholder={`Perfil ${editingSlotId}`}
                                    />
                                </div>
                                <div className="col-12 col-sm-8">
                                    <label className="form-label small fw-semibold text-white mb-1 d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                                        <Globe size={12} style={{ color: 'var(--perfil-acento, #a855f7)' }} />
                                        <span>Dominio General</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            fontSize: '0.78rem',
                                            borderRadius: '8px',
                                        }}
                                        value={formDomain}
                                        onChange={(e) => setFormDomain(e.target.value)}
                                        placeholder="ej: www.animigos.app, tioanime.com"
                                    />
                                </div>
                            </div>

                            {/* Fila 2: Término Intermedio + Separador de Secciones */}
                            <div className="row g-2">
                                <div className="col-12 col-sm-7">
                                    <label className="form-label small fw-semibold text-white mb-1" style={{ fontSize: '0.74rem' }}>
                                        Término Intermedio (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            fontSize: '0.78rem',
                                            borderRadius: '8px',
                                        }}
                                        value={formIntermediate}
                                        onChange={(e) => setFormIntermediate(e.target.value)}
                                        placeholder="ej: anime, series, ver (o vacío)"
                                    />
                                </div>
                                <div className="col-12 col-sm-5">
                                    <label className="form-label small fw-semibold text-white mb-1" style={{ fontSize: '0.74rem' }}>
                                        Separador de Secciones
                                    </label>
                                    <div className="d-flex gap-1">
                                        {[
                                            { id: 'barra', label: '/' },
                                            { id: 'guion', label: '-' },
                                            { id: 'ninguna', label: 'Ø' },
                                        ].map((sep) => {
                                            const isSelected = formSectionSep === sep.id
                                            return (
                                                <button
                                                    key={sep.id}
                                                    type="button"
                                                    onClick={() => setFormSectionSep(sep.id as SectionSeparator)}
                                                    className="flex-grow-1 py-1 px-2 border text-center transition-all"
                                                    style={{
                                                        borderRadius: '7px',
                                                        background: isSelected ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                                                        borderColor: isSelected ? 'var(--perfil-acento, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
                                                        color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                                                        fontSize: '0.76rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {sep.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Fila 3: Personalización del Nombre / Slug del Anime para este sitio */}
                            <div className="p-2.5 rounded-3 border" style={{ background: 'rgba(255, 255, 255, 0.02)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                                <div className="d-flex align-items-center justify-content-between mb-1.5 flex-wrap gap-1">
                                    <label className="form-label small fw-semibold text-white mb-0 d-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                                        <Layers size={12} style={{ color: 'var(--perfil-acento, #a855f7)' }} />
                                        <span>Nombre / Slug del Anime en este Sitio</span>
                                    </label>
                                    {formCustomSlug.trim() && formCustomSlug.trim() !== defaultAutoSlug && (
                                        <button
                                            type="button"
                                            onClick={() => setFormCustomSlug('')}
                                            className="btn btn-sm py-0 px-1.5 border-0 d-inline-flex align-items-center gap-1"
                                            style={{ fontSize: '0.66rem', color: 'var(--perfil-acento, #c084fc)', background: 'transparent' }}
                                            title="Restablecer al slug generado automáticamente"
                                        >
                                            <RotateCcw size={10} />
                                            <span>Restablecer automático</span>
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    className="form-control form-control-sm text-white font-mono mb-2"
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.35)',
                                        borderColor: formCustomSlug ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.12)',
                                        fontSize: '0.76rem',
                                        borderRadius: '8px',
                                    }}
                                    value={formCustomSlug || defaultAutoSlug}
                                    onChange={(e) => setFormCustomSlug(e.target.value)}
                                    placeholder={defaultAutoSlug}
                                />
                                <div className="row g-2">
                                    <div className="col-6">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.55)' }}>
                                                Separación:
                                            </span>
                                        </div>
                                        <div className="d-flex gap-1">
                                            {[
                                                { id: 'guion', label: '-' },
                                                { id: 'guion_bajo', label: '_' },
                                                { id: 'ninguna', label: 'Ø' },
                                            ].map((sep) => {
                                                const isSelected = formNameSep === sep.id
                                                return (
                                                    <button
                                                        key={sep.id}
                                                        type="button"
                                                        onClick={() => setFormNameSep(sep.id as NameSeparator)}
                                                        className="flex-grow-1 py-0.5 px-1.5 border text-center transition-all"
                                                        style={{
                                                            borderRadius: '6px',
                                                            background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                                            borderColor: isSelected ? 'var(--perfil-acento, #a855f7)' : 'rgba(255, 255, 255, 0.08)',
                                                            color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {sep.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.55)' }}>
                                                Título base:
                                            </span>
                                        </div>
                                        <div className="d-flex gap-1">
                                            {[
                                                { id: 'japones', label: 'Jap' },
                                                { id: 'ingles', label: 'Eng' },
                                            ].map((lang) => {
                                                const isSelected = formTitleLang === lang.id
                                                return (
                                                    <button
                                                        key={lang.id}
                                                        type="button"
                                                        onClick={() => setFormTitleLang(lang.id as TitleLanguage)}
                                                        className="flex-grow-1 py-0.5 px-1.5 border text-center transition-all"
                                                        style={{
                                                            borderRadius: '6px',
                                                            background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                                            borderColor: isSelected ? 'var(--perfil-acento, #a855f7)' : 'rgba(255, 255, 255, 0.08)',
                                                            color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {lang.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Fila 4: Terminación del Sitio + Separador */}
                            <div className="row g-2">
                                <div className="col-12 col-sm-7">
                                    <label className="form-label small fw-semibold text-white mb-1" style={{ fontSize: '0.74rem' }}>
                                        Terminación / Sufijo (ej: capitulo, sub-espanol)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            fontSize: '0.78rem',
                                            borderRadius: '8px',
                                        }}
                                        value={formSuffix}
                                        onChange={(e) => setFormSuffix(e.target.value)}
                                        placeholder="ej: chapter-6, sub-espanol (o vacío)"
                                    />
                                </div>
                                <div className="col-12 col-sm-5">
                                    <label className="form-label small fw-semibold text-white mb-1" style={{ fontSize: '0.74rem' }}>
                                        Separador de Terminación
                                    </label>
                                    <div className="d-flex gap-1">
                                        {[
                                            { id: 'guion', label: '-' },
                                            { id: 'barra', label: '/' },
                                            { id: 'punto', label: '.' },
                                            { id: 'ninguna', label: 'Ø' },
                                        ].map((sep) => {
                                            const isSelected = formSuffixSep === sep.id
                                            return (
                                                <button
                                                    key={sep.id}
                                                    type="button"
                                                    onClick={() => setFormSuffixSep(sep.id as SuffixSeparator)}
                                                    className="flex-grow-1 py-1 px-1.5 border text-center transition-all"
                                                    style={{
                                                        borderRadius: '7px',
                                                        background: isSelected ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                                                        borderColor: isSelected ? 'var(--perfil-acento, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
                                                        color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                                                        fontSize: '0.74rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {sep.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Fila 5: URL Directa Exclusiva (Opcional, para casos especiales) */}
                            <div>
                                <label className="form-label small fw-semibold text-white mb-1 d-flex align-items-center justify-content-between" style={{ fontSize: '0.72rem' }}>
                                    <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                        ¿El sitio tiene una URL única/irregular? Escríbela completa (opcional):
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm text-white font-mono"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        borderColor: formCustomUrl ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                                        fontSize: '0.74rem',
                                        borderRadius: '8px',
                                    }}
                                    value={formCustomUrl}
                                    onChange={(e) => setFormCustomUrl(e.target.value)}
                                    placeholder="ej: https://sitio.com/ver-directo/frieren-especial-1"
                                />
                            </div>
                        </div>

                        {/* Botones de Acción al pie */}
                        <div
                            className="d-flex align-items-center justify-content-between gap-2 mt-4 pt-3 border-top flex-wrap"
                            style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
                        >
                            <button
                                type="button"
                                onClick={() => setEditingSlotId(null)}
                                className="btn btn-sm px-3 py-1.5 border-0 text-white"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                }}
                            >
                                Cancelar
                            </button>

                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSaveEdit(false)}
                                    className="btn btn-sm px-3 py-1.5 text-white fw-semibold border"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        borderColor: 'rgba(255, 255, 255, 0.16)',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px',
                                    }}
                                >
                                    Guardar Cambios
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveEdit(true)}
                                    disabled={!previewUrl || previewUrl === '#'}
                                    className="btn btn-sm px-3.5 py-1.5 text-white fw-bold border-0 d-inline-flex align-items-center gap-1.5 shadow"
                                    style={{
                                        background: 'var(--perfil-acento, #a855f7)',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                                    }}
                                >
                                    <span>Guardar y Abrir</span>
                                    <ExternalLink size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
