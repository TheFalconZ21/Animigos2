import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './profesor-doki.css'

export type DokiExpression =
    | 'tranquilo'
    | 'emocionado_serio'
    | 'emocionado_triste'
    | 'sorprendido'
    | 'preocupado'
    | 'pensando'
    | 'cansado'
    | 'emocionado_feliz'
    | 'sonrojado'
    | 'explicando'
    | 'risa'
    | 'celebracion'
    | 'six_seven'
    | 'comiendo'
    | 'cantando'
    | 'idea_encontrada'
    | 'shock'
    | 'aprobacion'

export interface DokiExpressionMeta {
    label: string
    file: string
    row: number
    col: number
    sheet: 'final1' | 'final2'
}

export const DOKI_EXPRESSIONS: Record<DokiExpression, DokiExpressionMeta> = {
    tranquilo: { label: 'Tranquilo', file: '/profesor-doki/tranquilo.webp', row: 1, col: 1, sheet: 'final1' },
    emocionado_serio: { label: 'Determinado', file: '/profesor-doki/emocionado_serio.webp', row: 1, col: 2, sheet: 'final1' },
    emocionado_triste: { label: 'Conmovido', file: '/profesor-doki/emocionado_triste.webp', row: 1, col: 3, sheet: 'final1' },
    sorprendido: { label: 'Sorprendido', file: '/profesor-doki/sorprendido.webp', row: 2, col: 1, sheet: 'final1' },
    preocupado: { label: 'Preocupado', file: '/profesor-doki/preocupado.webp', row: 2, col: 2, sheet: 'final1' },
    pensando: { label: 'Analizando', file: '/profesor-doki/pensando.webp', row: 2, col: 3, sheet: 'final1' },
    cansado: { label: 'Agotado', file: '/profesor-doki/cansado.webp', row: 3, col: 1, sheet: 'final1' },
    emocionado_feliz: { label: 'Entusiasmado', file: '/profesor-doki/emocionado_feliz.webp', row: 3, col: 2, sheet: 'final1' },
    sonrojado: { label: 'Sonrojado', file: '/profesor-doki/sonrojado.webp', row: 3, col: 3, sheet: 'final1' },
    explicando: { label: 'Explicando', file: '/profesor-doki/explicando.webp', row: 1, col: 1, sheet: 'final2' },
    risa: { label: 'Riendo', file: '/profesor-doki/risa.webp', row: 1, col: 2, sheet: 'final2' },
    celebracion: { label: 'Celebrando', file: '/profesor-doki/celebracion.webp', row: 1, col: 3, sheet: 'final2' },
    six_seven: { label: 'Modo Experto', file: '/profesor-doki/six_seven.webp', row: 2, col: 1, sheet: 'final2' },
    comiendo: { label: 'Palomitas listas', file: '/profesor-doki/comiendo.webp', row: 2, col: 2, sheet: 'final2' },
    cantando: { label: 'Tarareando OST', file: '/profesor-doki/cantando.webp', row: 2, col: 3, sheet: 'final2' },
    idea_encontrada: { label: '¡Eureka!', file: '/profesor-doki/idea_encontrada.webp', row: 3, col: 1, sheet: 'final2' },
    shock: { label: '¡En Shock!', file: '/profesor-doki/shock.webp', row: 3, col: 2, sheet: 'final2' },
    aprobacion: { label: 'Aprobación Total', file: '/profesor-doki/aprobacion.webp', row: 3, col: 3, sheet: 'final2' },
}

export interface DokiTipItem {
    expression: DokiExpression
    text: React.ReactNode
}

interface ProfesorDokiProps {
    expression?: DokiExpression
    dialogue?: React.ReactNode
    title?: string
    badgeText?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
    align?: 'left' | 'center' | 'compact'
    onPrevTip?: () => void
    onNextTip?: () => void
    actions?: React.ReactNode
}

export const ProfesorDoki: React.FC<ProfesorDokiProps> = ({
    expression = 'explicando',
    dialogue,
    title = 'Profesor Doki Doki',
    badgeText,
    size = 'md',
    className = '',
    align = 'left',
    onPrevTip,
    onNextTip,
    actions,
}) => {
    const meta = DOKI_EXPRESSIONS[expression] || DOKI_EXPRESSIONS.explicando

    const sizeClass = {
        sm: 'doki-size-sm',
        md: 'doki-size-md',
        lg: 'doki-size-lg',
        xl: 'doki-size-xl',
    }[size]

    return (
        <div className={`doki-container doki-align-${align} ${className}`}>
            <div className={`doki-avatar-wrap ${sizeClass}`}>
                <img
                    key={meta.file}
                    src={meta.file}
                    alt={title}
                    className="doki-avatar-img"
                    onError={(e) => {
                        e.currentTarget.src = meta.file.replace('.webp', '.png')
                    }}
                />
            </div>

            {dialogue && (
                <div className="doki-dialogue-bubble">
                    <div className="doki-dialogue-header">
                        <div className="d-flex align-items-center">
                            <span className="doki-dialogue-title">{title}</span>
                            {badgeText && (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill ms-2" style={{ fontSize: '0.72rem' }}>
                                    {badgeText}
                                </span>
                            )}
                        </div>

                        {(onPrevTip || onNextTip) && (
                            <div className="doki-arrow-controls">
                                {onPrevTip && (
                                    <button
                                        type="button"
                                        className="doki-arrow-btn"
                                        onClick={onPrevTip}
                                        aria-label="Anterior diálogo"
                                        title="Anterior"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                )}
                                {onNextTip && (
                                    <button
                                        type="button"
                                        className="doki-arrow-btn"
                                        onClick={onNextTip}
                                        aria-label="Siguiente diálogo"
                                        title="Siguiente"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="doki-dialogue-content">{dialogue}</div>

                    {actions && <div className="doki-dialogue-actions mt-3">{actions}</div>}
                </div>
            )}
        </div>
    )
}
