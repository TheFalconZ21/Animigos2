import React, { useEffect, useState } from 'react'
import { CheckCircle2, Flag, Loader2, ShieldAlert } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import {
    submitContentReport,
    type ReportCategory,
    type ReportContentType,
} from '../../services/reportsApi'
import { useAuth } from '../../context/AuthContext'

export interface ReportTarget {
    contentType: ReportContentType
    reportedUsername: string
    targetId?: string
    targetExcerpt?: string
    contextLabel?: string
}

interface ReportDialogProps {
    target: ReportTarget | null
    onClose: () => void
}

const REPORT_CATEGORIES: { id: ReportCategory; label: string; desc: string }[] = [
    {
        id: 'toxicity',
        label: 'Actitud ofensiva / Acoso',
        desc: 'Insultos, lenguaje abusivo, ataques personales o conducta hostil.',
    },
    {
        id: 'spoilers',
        label: 'Spoilers sin aviso',
        desc: 'Revela trama importante sin marcarlo como spoiler.',
    },
    {
        id: 'spam',
        label: 'Spam / Enlaces sospechosos',
        desc: 'Publicidad no deseada, enlaces maliciosos o mensajes repetitivos.',
    },
    {
        id: 'other',
        label: 'Otro motivo',
        desc: 'Cualquier otra situación que afecte a la comunidad.',
    },
]

export const ReportDialog: React.FC<ReportDialogProps> = ({ target, onClose }) => {
    const { isAuthenticated } = useAuth()
    const [category, setCategory] = useState<ReportCategory>('toxicity')
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    useEffect(() => {
        if (target) {
            setCategory('toxicity')
            setReason('')
            setError(null)
            setSuccessMsg(null)
        }
    }, [target])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!target) return

        if (!isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            onClose()
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            const res = await submitContentReport({
                content_type: target.contentType,
                category,
                reason: reason.trim() || REPORT_CATEGORIES.find((c) => c.id === category)?.label || 'Reporte de conducta ofensiva',
                reported_username: target.reportedUsername,
                target_id: target.targetId,
                target_excerpt: target.targetExcerpt,
                context_label: target.contextLabel,
            })
            setSuccessMsg(res.message)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo enviar el reporte.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialogo
            abierto={Boolean(target)}
            onCerrar={onClose}
            etiqueta="Reportar contenido o conducta"
            ancho={500}
        >
            {target && (
                <form onSubmit={handleSubmit}>
                    <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                        <div>
                            <span className="ml-eyebrow text-danger">MODERACIÓN COMUNITARIA</span>
                            <h3 className="h5 fw-bold text-white mt-1 mb-1 d-flex align-items-center gap-2">
                                <Flag size={17} className="text-danger" />
                                <span>Reportar contenido ofensivo</span>
                            </h3>
                            <p className="small text-secondary mb-0">
                                Tu reporte es confidencial y llegará directamente al panel de moderación de Animigos.
                            </p>
                        </div>

                        {/* Resumen del elemento reportado */}
                        <div
                            className="p-2.5 rounded-3 d-flex flex-column gap-1"
                            style={{
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.22)',
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between gap-2 small">
                                <span className="fw-semibold text-white">
                                    Usuario: <span className="text-danger">@{target.reportedUsername.replace(/^@/, '')}</span>
                                </span>
                                {target.contextLabel && (
                                    <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {target.contextLabel}
                                    </span>
                                )}
                            </div>
                            {target.targetExcerpt && (
                                <p
                                    className="small text-secondary mb-0 fst-italic"
                                    style={{
                                        fontSize: '0.78rem',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    “{target.targetExcerpt}”
                                </p>
                            )}
                        </div>

                        {successMsg ? (
                            <div
                                className="p-3 rounded-3 d-flex align-items-start gap-2.5"
                                style={{
                                    background: 'rgba(52, 211, 153, 0.09)',
                                    border: '1px solid rgba(52, 211, 153, 0.3)',
                                }}
                            >
                                <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-0.5" />
                                <div className="small text-white">{successMsg}</div>
                            </div>
                        ) : (
                            <>
                                {/* Categorías */}
                                <div className="d-flex flex-column gap-1.5">
                                    <span className="ml-label mb-0">Motivo del reporte</span>
                                    {REPORT_CATEGORIES.map((cat) => {
                                        const active = category === cat.id
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategory(cat.id)}
                                                className="text-start p-2.5 rounded-3 d-flex flex-column gap-0.5"
                                                style={{
                                                    background: active
                                                        ? 'rgba(239, 68, 68, 0.12)'
                                                        : 'rgba(255, 255, 255, 0.025)',
                                                    border: active
                                                        ? '1px solid rgba(239, 68, 68, 0.45)'
                                                        : '1px solid rgba(255, 255, 255, 0.08)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <span className="small fw-semibold text-white">{cat.label}</span>
                                                <span className="small text-secondary" style={{ fontSize: '0.73rem' }}>
                                                    {cat.desc}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Detalle adicional */}
                                <div>
                                    <label className="ml-label" htmlFor="report-reason-input">
                                        Detalles adicionales (opcional)
                                    </label>
                                    <textarea
                                        id="report-reason-input"
                                        className="ml-input w-100"
                                        rows={3}
                                        maxLength={600}
                                        placeholder="Describe brevemente qué ocurrió para ayudarnos a revisarlo..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        style={{ resize: 'vertical', minHeight: '72px' }}
                                    />
                                </div>

                                {error && (
                                    <div className="small text-danger d-flex align-items-center gap-1.5" role="alert">
                                        <ShieldAlert size={14} />
                                        <span>{error}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <footer className="ml-dialog-pie justify-content-end gap-2">
                        {successMsg ? (
                            <button type="button" className="ml-btn ml-btn-acento" onClick={onClose}>
                                Entendido
                            </button>
                        ) : (
                            <>
                                <button type="button" className="ml-btn ml-btn-fantasma" onClick={onClose} disabled={submitting}>
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="ml-btn d-inline-flex align-items-center gap-1.5"
                                    disabled={submitting}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.18)',
                                        borderColor: 'rgba(239, 68, 68, 0.48)',
                                        color: '#fca5a5',
                                    }}
                                >
                                    {submitting ? (
                                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <Flag size={14} />
                                    )}
                                    <span>{submitting ? 'Enviando...' : 'Enviar reporte'}</span>
                                </button>
                            </>
                        )}
                    </footer>
                </form>
            )}
        </Dialogo>
    )
}
