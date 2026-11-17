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
    Sparkles,
} from 'lucide-react'
import {
    useAssociatedLinks,
    buildAssociatedAnimeUrl,
    getAnimeOverrideKey,
    EVENT_OPEN_LINK_SELECTOR,
    type OpenLinkSelectorPayload,
    type LinkSlotConfig,
} from '../../hooks/useAssociatedLinks'
import { useAuth } from '../../context/AuthContext'

export const AssociatedLinkSelectorModal: React.FC = () => {
    const { isAuthenticated } = useAuth()
    const {
        settings,
        saveAnimeExactUrl,
        getAnimeExactUrl,
        getAnimeUrl,
    } = useAssociatedLinks()

    const [targetAnime, setTargetAnime] = useState<OpenLinkSelectorPayload | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [editingSlotId, setEditingSlotId] = useState<number | null>(null)

    // Estado local para el ajuste al milímetro de la URL exacta
    const [customUrlInput, setCustomUrlInput] = useState('')
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const handleOpen = (e: Event) => {
            if (!isAuthenticated) {
                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                dialog?.showModal()
                return
            }
            const customEvent = e as CustomEvent<OpenLinkSelectorPayload>
            if (customEvent.detail) {
                setTargetAnime(customEvent.detail)
                setEditingSlotId(null)
                setIsOpen(true)
            }
        }
        window.addEventListener(EVENT_OPEN_LINK_SELECTOR, handleOpen)
        return () => window.removeEventListener(EVENT_OPEN_LINK_SELECTOR, handleOpen)
    }, [isAuthenticated])

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

    const editingSlot = useMemo(() => {
        return editingSlotId !== null
            ? settings.slots.find((s) => s.id === editingSlotId) || null
            : null
    }, [editingSlotId, settings.slots])

    // URL generada por defecto según la plantilla general del slot
    const defaultTemplateUrl = useMemo(() => {
        if (!targetAnime || !editingSlot) return '#'
        return buildAssociatedAnimeUrl(targetAnime, editingSlot)
    }, [targetAnime, editingSlot])

    // Sincronizar el input con la URL exacta guardada o la generada por la plantilla
    useEffect(() => {
        if (editingSlotId === null || !targetAnime) return
        const savedExact = getAnimeExactUrl(targetAnime, editingSlotId)
        if (savedExact && savedExact.trim()) {
            setCustomUrlInput(savedExact.trim())
        } else {
            setCustomUrlInput(defaultTemplateUrl !== '#' ? defaultTemplateUrl : '')
        }
        setCopied(false)
    }, [editingSlotId, targetAnime, getAnimeExactUrl, defaultTemplateUrl])

    // Condición de salida temprana incondicional DESPUÉS de todos los hooks de React
    if (!isOpen || !targetAnime || !isAuthenticated) return null

    const animeDisplayName = targetAnime.title || targetAnime.titleEnglish || targetAnime.title_english || 'Anime'

    const handleSelectSlot = (slot: LinkSlotConfig) => {
        const effectiveUrl = getAnimeUrl(targetAnime, slot.id)
        if (effectiveUrl && effectiveUrl !== '#') {
            window.open(effectiveUrl, '_blank', 'noopener,noreferrer')
        }
        setIsOpen(false)
    }

    const handleCopyUrl = async () => {
        if (!customUrlInput || !customUrlInput.trim()) return
        try {
            await navigator.clipboard.writeText(customUrlInput.trim())
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // fallback
        }
    }

    const handleTestUrl = () => {
        const trimmed = (customUrlInput || '').trim()
        if (!trimmed) return
        const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
            ? trimmed
            : `https://${trimmed}`
        window.open(fullUrl, '_blank', 'noopener,noreferrer')
    }

    const handleSaveExactUrl = (openAfterSave: boolean = false) => {
        if (!editingSlot) return
        const trimmed = (customUrlInput || '').trim()

        // Si la URL ingresada es idéntica a la plantilla por defecto o está vacía, no hace falta override
        if (!trimmed || trimmed === defaultTemplateUrl) {
            saveAnimeExactUrl(targetAnime, editingSlot.id, null)
        } else {
            const formatted = trimmed.startsWith('http://') || trimmed.startsWith('https://')
                ? trimmed
                : `https://${trimmed}`
            saveAnimeExactUrl(targetAnime, editingSlot.id, formatted)
        }

        if (openAfterSave && trimmed) {
            const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
                ? trimmed
                : `https://${trimmed}`
            window.open(fullUrl, '_blank', 'noopener,noreferrer')
            setIsOpen(false)
            setEditingSlotId(null)
        } else {
            setEditingSlotId(null)
        }
    }

    const handleResetToTemplate = () => {
        setCustomUrlInput(defaultTemplateUrl !== '#' ? defaultTemplateUrl : '')
    }

    const isSlotCurrentlyOverridden = editingSlot
        ? Boolean(settings.animeOverrides?.[animeKey]?.[editingSlot.id]?.customUrl)
        : false

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
                    maxWidth: editingSlotId !== null ? '580px' : '540px',
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
                                title="Ajustar enlace activo al milímetro"
                                aria-label="Ajustar enlace activo"
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
                                const hasExactOverride = Boolean(settings.animeOverrides?.[animeKey]?.[slot.id]?.customUrl)
                                const hasDomain = Boolean(slot.domain && slot.domain.trim()) || hasExactOverride
                                const slotName = slot.name && slot.name.trim() ? slot.name : `Perfil ${slot.id}`

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
                                            title={
                                                hasExactOverride
                                                    ? `Abrir con ${slotName} (Ajustado al milímetro para este anime)`
                                                    : hasDomain
                                                        ? `Abrir con ${slotName}`
                                                        : `${slotName} (Sin configurar — Haz clic en el lápiz para ajustar enlace)`
                                            }
                                            className="w-100 h-100 p-2 d-flex flex-column align-items-center justify-content-center text-center transition-all"
                                            style={{
                                                borderRadius: '11px',
                                                background: hasDomain
                                                    ? 'rgba(255, 255, 255, 0.04)'
                                                    : 'rgba(255, 255, 255, 0.015)',
                                                border: hasExactOverride
                                                    ? '1px solid rgba(168, 85, 247, 0.55)'
                                                    : hasDomain
                                                        ? '1px solid rgba(255, 255, 255, 0.09)'
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
                                                    e.currentTarget.style.borderColor = hasExactOverride
                                                        ? 'rgba(168, 85, 247, 0.55)'
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
                                            {hasExactOverride && (
                                                <span
                                                    className="d-inline-flex align-items-center gap-1 font-mono mt-0.5"
                                                    style={{
                                                        fontSize: '0.62rem',
                                                        color: 'var(--perfil-acento, #c084fc)',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    • Ajustado
                                                </span>
                                            )}
                                        </button>

                                        {/* Icono de lápiz para editar el enlace al milímetro */}
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
                                                background: hasExactOverride
                                                    ? 'rgba(168, 85, 247, 0.3)'
                                                    : 'rgba(255, 255, 255, 0.06)',
                                                color: hasExactOverride
                                                    ? 'var(--perfil-acento, #c084fc)'
                                                    : 'rgba(255, 255, 255, 0.55)',
                                                cursor: 'pointer',
                                                transition: 'all 0.16s ease',
                                                zIndex: 3,
                                            }}
                                            title={
                                                hasExactOverride
                                                    ? `Ajustar enlace de ${slotName} (Tiene ajuste al milímetro activo)`
                                                    : `Ajustar enlace de ${slotName} al milímetro para este anime`
                                            }
                                            aria-label={`Ajustar enlace de ${slotName}`}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--perfil-acento, #a855f7)'
                                                e.currentTarget.style.color = '#ffffff'
                                                e.currentTarget.style.transform = 'scale(1.15)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = hasExactOverride
                                                    ? 'rgba(168, 85, 247, 0.3)'
                                                    : 'rgba(255, 255, 255, 0.06)'
                                                e.currentTarget.style.color = hasExactOverride
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
                        VISTA B: AJUSTE FINO DEL ENLACE AL MILÍMETRO (EXCLUSIVO)
                       ======================================================== */
                    <div className="animate-fade-in">
                        {/* Cabecera del Ajuste Fino */}
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
                                            Ajuste Fino de Enlace
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
                                            Slot #{editingSlotId} · {editingSlot?.name || `Perfil ${editingSlotId}`}
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

                        {/* Mensaje Informativo de Alcance Exclusivo */}
                        <div
                            className="p-2.5 rounded-3 mb-3 border d-flex align-items-start gap-2"
                            style={{
                                background: 'rgba(168, 85, 247, 0.06)',
                                borderColor: 'rgba(168, 85, 247, 0.22)',
                            }}
                        >
                            <Sparkles size={14} style={{ color: 'var(--perfil-acento, #c084fc)', flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '0.73rem', lineHeight: 1.4, color: 'rgba(255, 255, 255, 0.75)' }}>
                                <strong className="text-white">Ajuste exclusivo para este anime:</strong> Modifica el enlace tal cual es para adaptarlo a la URL exacta que requiere este sitio. Los cambios se guardarán <span style={{ color: 'var(--perfil-acento, #c084fc)' }}>únicamente para este anime</span>, sin alterar la plantilla general ni otros enlaces.
                            </div>
                        </div>

                        {/* Estado actual del enlace */}
                        <div className="d-flex align-items-center justify-content-between mb-1.5 px-0.5">
                            <label className="form-label small fw-semibold text-white mb-0 d-flex align-items-center gap-1.5" style={{ fontSize: '0.76rem' }}>
                                <Globe size={13} style={{ color: 'var(--perfil-acento, #a855f7)' }} />
                                <span>Enlace Tal Cual Es (Editable al Milímetro):</span>
                            </label>
                            {isSlotCurrentlyOverridden ? (
                                <span className="badge rounded-pill" style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', fontSize: '0.64rem', border: '1px solid rgba(74, 222, 128, 0.3)' }}>
                                    ✓ Ajuste al milímetro activo
                                </span>
                            ) : (
                                <span className="badge rounded-pill" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.64rem' }}>
                                    Plantilla por defecto
                                </span>
                            )}
                        </div>

                        {/* Campo de Texto Principal: El Enlace Tal Cual Es */}
                        <div className="mb-2">
                            <textarea
                                rows={2}
                                className="form-control form-control-sm text-white font-mono"
                                style={{
                                    background: 'rgba(0, 0, 0, 0.45)',
                                    borderColor: customUrlInput.trim() !== defaultTemplateUrl ? 'var(--perfil-acento, #a855f7)' : 'rgba(255, 255, 255, 0.15)',
                                    fontSize: '0.80rem',
                                    borderRadius: '10px',
                                    lineHeight: 1.45,
                                    resize: 'none',
                                    boxShadow: customUrlInput.trim() !== defaultTemplateUrl ? '0 0 14px rgba(168, 85, 247, 0.18)' : 'none',
                                }}
                                value={customUrlInput}
                                onChange={(e) => setCustomUrlInput(e.target.value)}
                                placeholder="https://tudominio.com/anime/frieren-sub-espanol"
                                autoFocus
                            />
                        </div>

                        {/* Barra de Herramientas Rápidas debajo del enlace */}
                        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleTestUrl}
                                    disabled={!customUrlInput.trim()}
                                    className="btn btn-sm py-1 px-2.5 rounded-2 border-0 d-inline-flex align-items-center gap-1 fw-bold"
                                    style={{
                                        fontSize: '0.72rem',
                                        background: 'var(--perfil-acento, #a855f7)',
                                        color: '#ffffff',
                                        cursor: customUrlInput.trim() ? 'pointer' : 'not-allowed',
                                    }}
                                    title="Probar en una nueva pestaña"
                                >
                                    <ExternalLink size={12} />
                                    <span>Probar Enlace ↗</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCopyUrl}
                                    disabled={!customUrlInput.trim()}
                                    className="btn btn-sm py-1 px-2.5 rounded-2 border-0 d-inline-flex align-items-center gap-1"
                                    style={{
                                        fontSize: '0.72rem',
                                        background: 'rgba(255, 255, 255, 0.07)',
                                        color: copied ? '#4ade80' : 'rgba(255, 255, 255, 0.8)',
                                        cursor: 'pointer',
                                    }}
                                    title="Copiar URL al portapapeles"
                                >
                                    {copied ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                                </button>
                            </div>

                            {/* Botón para restablecer al enlace original de la plantilla */}
                            {customUrlInput.trim() !== defaultTemplateUrl && defaultTemplateUrl !== '#' && (
                                <button
                                    type="button"
                                    onClick={handleResetToTemplate}
                                    className="btn btn-sm py-0.5 px-2 border-0 d-inline-flex align-items-center gap-1"
                                    style={{
                                        fontSize: '0.68rem',
                                        color: 'rgba(255, 255, 255, 0.55)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                    }}
                                    title="Volver al enlace que genera la plantilla general de este slot"
                                >
                                    <RotateCcw size={11} />
                                    <span>Restablecer plantilla</span>
                                </button>
                            )}
                        </div>

                        {/* Botones de Acción al pie */}
                        <div
                            className="d-flex align-items-center justify-content-between gap-2 pt-3 border-top flex-wrap"
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
                                    onClick={() => handleSaveExactUrl(false)}
                                    className="btn btn-sm px-3 py-1.5 text-white fw-semibold border"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        borderColor: 'rgba(255, 255, 255, 0.16)',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px',
                                    }}
                                    title="Guardar este enlace exclusivamente para este anime"
                                >
                                    Guardar Ajuste Fino
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveExactUrl(true)}
                                    disabled={!customUrlInput.trim()}
                                    className="btn btn-sm px-3.5 py-1.5 text-white fw-bold border-0 d-inline-flex align-items-center gap-1.5 shadow"
                                    style={{
                                        background: 'var(--perfil-acento, #a855f7)',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                                    }}
                                    title="Guardar ajuste y abrir inmediatamente"
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
export default AssociatedLinkSelectorModal
