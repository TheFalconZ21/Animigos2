import React, { useState } from 'react'
import { Check, Eye, Lock, MessageSquare, ShieldCheck } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import type { PrivacyConfig } from './perfil-types'

interface PrivacySettingsModalProps {
    open: boolean
    onClose: () => void
    initialConfig: PrivacyConfig
    onSave: (config: PrivacyConfig) => Promise<void>
}

export const PrivacySettingsModal: React.FC<PrivacySettingsModalProps> = ({
    open,
    onClose,
    initialConfig,
    onSave,
}) => {
    const [config, setConfig] = useState<PrivacyConfig>(initialConfig)
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            await onSave(config)
            onClose()
        } catch (err) {
            console.error('Error al guardar privacidad:', err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Configuración de Privacidad" ancho={500}>
            <form onSubmit={handleSubmit} className="p-4 d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">SEGURIDAD & VISIBILIDAD</span>
                    <h3 className="h5 fw-bold text-white mb-1">Configuración de Privacidad</h3>
                    <p className="small mb-0" style={{ color: 'var(--perfil-text-muted)' }}>
                        Controla quién puede ver tu colección, tus métricas de visionado y publicar en tu muro.
                    </p>
                </div>

                {/* 1. Visibilidad de Mi Lista */}
                <div className="perfil-switch-wrap">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: config.isListPublic ? 'var(--perfil-green)' : 'var(--perfil-text-dim)',
                            }}
                        >
                            {config.isListPublic ? <Eye size={18} /> : <Lock size={18} />}
                        </div>
                        <div>
                            <div className="text-white fw-semibold small">Lista de Anime Pública</div>
                            <div className="small" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}>
                                {config.isListPublic
                                    ? 'Cualquier usuario puede ver tus animes y notas'
                                    : 'Solo tú puedes ver tu colección de animes'}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={`perfil-pill-toggle ${config.isListPublic ? 'is-on' : ''}`}
                        onClick={() => setConfig({ ...config, isListPublic: !config.isListPublic })}
                        aria-label="Alternar visibilidad de lista"
                    >
                        <span className="perfil-pill-handle" />
                    </button>
                </div>

                {/* 2. Visibilidad de Estadísticas */}
                <div className="perfil-switch-wrap">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: config.showStats ? 'var(--perfil-acento)' : 'var(--perfil-text-dim)',
                            }}
                        >
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <div className="text-white fw-semibold small">Mostrar Estadísticas de Visionado</div>
                            <div className="small" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}>
                                Horas totales, nota promedio y gráfico de distribución en tu perfil.
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className={`perfil-pill-toggle ${config.showStats ? 'is-on' : ''}`}
                        onClick={() => setConfig({ ...config, showStats: !config.showStats })}
                        aria-label="Alternar visibilidad de estadísticas"
                    >
                        <span className="perfil-pill-handle" />
                    </button>
                </div>

                {/* 3. Permisos de Comentarios */}
                <div className="perfil-switch-wrap flex-column align-items-start gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <MessageSquare size={16} style={{ color: 'var(--perfil-pink)' }} />
                        <span className="text-white fw-semibold small">¿Quién puede comentar en tu perfil?</span>
                    </div>
                    <div className="d-flex gap-1.5 w-100 pt-1">
                        {[
                            { id: 'everyone', label: 'Todos' },
                            { id: 'friends', label: 'Solo Amigos' },
                            { id: 'none', label: 'Nadie (Desactivado)' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setConfig({ ...config, allowComments: opt.id as any })}
                                className={`flex-grow-1 py-1.5 px-2 rounded-2 border text-nowrap small fw-semibold`}
                                style={{
                                    fontSize: '0.75rem',
                                    background: config.allowComments === opt.id ? 'var(--perfil-acento-soft)' : 'transparent',
                                    borderColor: config.allowComments === opt.id ? 'var(--perfil-acento)' : 'var(--perfil-border)',
                                    color: config.allowComments === opt.id ? '#ffffff' : 'var(--perfil-text-muted)',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Acciones */}
                <div className="d-flex justify-content-end gap-2 pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                    <button type="button" onClick={onClose} className="ml-btn ml-btn-fantasma ml-btn-sm">
                        Cerrar
                    </button>
                    <button type="submit" disabled={isSaving} className="ml-btn ml-btn-acento ml-btn-sm">
                        <Check size={14} />
                        <span>{isSaving ? 'Guardando...' : 'Aplicar Preferencias'}</span>
                    </button>
                </div>
            </form>
        </Dialogo>
    )
}
