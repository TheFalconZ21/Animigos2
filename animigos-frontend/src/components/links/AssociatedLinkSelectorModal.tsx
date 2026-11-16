import React, { useEffect, useState } from 'react'
import { X, Play } from 'lucide-react'
import {
    useAssociatedLinks,
    buildAssociatedAnimeUrl,
    EVENT_OPEN_LINK_SELECTOR,
    type OpenLinkSelectorPayload,
    type LinkSlotConfig,
} from '../../hooks/useAssociatedLinks'

export const AssociatedLinkSelectorModal: React.FC = () => {
    const { settings } = useAssociatedLinks()
    const [targetAnime, setTargetAnime] = useState<OpenLinkSelectorPayload | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const handleOpen = (e: Event) => {
            const customEvent = e as CustomEvent<OpenLinkSelectorPayload>
            if (customEvent.detail) {
                setTargetAnime(customEvent.detail)
                setIsOpen(true)
            }
        }
        window.addEventListener(EVENT_OPEN_LINK_SELECTOR, handleOpen)
        return () => window.removeEventListener(EVENT_OPEN_LINK_SELECTOR, handleOpen)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false)
        }
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen])

    if (!isOpen || !targetAnime) return null

    const handleSelectSlot = (slot: LinkSlotConfig) => {
        if (!slot.domain || !slot.domain.trim()) return
        const url = buildAssociatedAnimeUrl(targetAnime, slot)
        if (url && url !== '#') {
            window.open(url, '_blank', 'noopener,noreferrer')
        }
        setIsOpen(false)
    }

    const animeDisplayName = targetAnime.title || targetAnime.titleEnglish || targetAnime.title_english || 'Anime'

    return (
        <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 animate-fade-in"
            style={{
                zIndex: 1060,
                background: 'rgba(0, 0, 0, 0.76)',
                backdropFilter: 'blur(8px)',
            }}
            onClick={() => setIsOpen(false)}
        >
            <div
                className="rounded-4 p-4 position-relative border transition-all"
                style={{
                    width: '100%',
                    maxWidth: '540px',
                    background: 'linear-gradient(180deg, #161622 0%, #0d0d15 100%)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(168, 85, 247, 0.1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Botón cerrar */}
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="position-absolute top-0 end-0 m-3 p-1 rounded-circle border-0 d-flex align-items-center justify-content-center"
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

                {/* Cabecera minimalista */}
                <div className="mb-3.5 pe-4">
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

                        return (
                            <button
                                key={slot.id}
                                type="button"
                                disabled={!hasDomain}
                                onClick={() => handleSelectSlot(slot)}
                                title={hasDomain ? `Abrir con ${slotName}` : `${slotName} (Sin configurar)`}
                                className="p-2 d-flex align-items-center justify-content-center text-center transition-all"
                                style={{
                                    height: '66px',
                                    borderRadius: '11px',
                                    background: hasDomain
                                        ? 'rgba(255, 255, 255, 0.04)'
                                        : 'rgba(255, 255, 255, 0.015)',
                                    border: hasDomain
                                        ? '1px solid rgba(255, 255, 255, 0.09)'
                                        : '1px dashed rgba(255, 255, 255, 0.05)',
                                    color: hasDomain ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
                                    cursor: hasDomain ? 'pointer' : 'not-allowed',
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
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)'
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.boxShadow = 'none'
                                    }
                                }}
                            >
                                <span className="text-truncate px-1" style={{ maxWidth: '100%' }}>
                                    {slotName}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
