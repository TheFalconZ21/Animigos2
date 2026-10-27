import React from 'react'
import { Sparkles, Brain, CheckCircle2, ArrowRight } from 'lucide-react'
import { ProfesorDoki } from '../doki/ProfesorDoki'
import type { TasteTestAnswers } from './perfil-types'

interface TasteTestBannerProps {
    answers: TasteTestAnswers
    onOpenWizard: () => void
}

export const TasteTestBanner: React.FC<TasteTestBannerProps> = ({ answers, onOpenWizard }) => {
    const isCalibrated = answers.calibratedPercentage >= 90

    return (
        <div className="perfil-taste-card">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4 position-relative z-1">
                <div className="flex-grow-1" style={{ maxWidth: '680px' }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: 'var(--perfil-acento-soft)',
                                border: '1px solid var(--perfil-acento-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--perfil-acento)',
                            }}
                        >
                            <Brain size={15} />
                        </div>
                        <span className="ml-eyebrow">RECOMENDADOR NEURONAL · PROFESOR DOKI DOKI</span>
                        {isCalibrated ? (
                            <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2 py-1 small d-inline-flex align-items-center gap-1">
                                <CheckCircle2 size={11} /> Calibrado
                            </span>
                        ) : (
                            <span className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 small">
                                Calibración Pendiente
                            </span>
                        )}
                    </div>

                    <h3 className="h4 fw-bold text-white mb-2">
                        {isCalibrated
                            ? 'Tu Perfil de Gustos está Calibrado al 100%'
                            : `Perfil de Afinidad Calibrado al ${answers.calibratedPercentage}%`}
                    </h3>

                    {/* Speech bubble del Profesor Doki Doki */}
                    <ProfesorDoki
                        size="sm"
                        expression={isCalibrated ? 'aprobacion' : 'explicando'}
                        dialogue={
                            isCalibrated
                                ? <span>¡Excelente! Ya sinteticé el ADN de tus <strong>{answers.likedAnimeIds?.length || 2} animes vistos</strong> y tus <strong>películas de TMDB</strong> para darte recomendaciones de alta precisión.</span>
                                : <span>¡Konnichiwa! Aún no completas tu test. Cuéntame qué <strong>películas</strong> y <strong>animes ya viste</strong> para calibrar tu feed.</span>
                        }
                        className="my-2"
                        align="compact"
                    />

                    {/* Barra de progreso de calibración */}
                    <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="perfil-taste-progress-bar flex-grow-1">
                            <div
                                className="perfil-taste-progress-fill"
                                style={{ width: `${answers.calibratedPercentage}%` }}
                            />
                        </div>
                        <span className="small font-mono fw-bold text-white" style={{ minWidth: 42 }}>
                            {answers.calibratedPercentage}%
                        </span>
                    </div>

                    {/* Chips de gustos actuales */}
                    <div className="d-flex flex-wrap align-items-center gap-1.5">
                        <span className="small text-secondary fw-semibold me-1" style={{ fontSize: '0.72rem' }}>
                            Afinidades activas:
                        </span>
                        {answers.favoriteGenres.slice(0, 3).map((g) => (
                            <span key={g} className="perfil-chip-taste">
                                🍿 {g}
                            </span>
                        ))}
                        {answers.tropes.slice(0, 2).map((t) => (
                            <span key={t} className="perfil-chip-taste">
                                ⚡ {t.replace(/_/g, ' ')}
                            </span>
                        ))}
                        {answers.contentFilters.slice(0, 1).map((f) => (
                            <span key={f} className="perfil-chip-taste" style={{ borderColor: 'var(--perfil-cyan-soft)' }}>
                                🛡️ {f.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Botón CTA destacado */}
                <div className="d-flex flex-column align-items-lg-end gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onOpenWizard}
                        className="ml-btn ml-btn-acento px-3 py-2 d-inline-flex align-items-center gap-2"
                        style={{
                            boxShadow: '0 0 20px var(--perfil-acento-glow)',
                            fontSize: '0.86rem',
                        }}
                    >
                        <Sparkles size={16} />
                        <span>{isCalibrated ? 'Recalibrar con Profesor Doki Doki' : 'Iniciar Test de Calibración'}</span>
                        <ArrowRight size={14} />
                    </button>
                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                        Toma menos de 2 minutos · Guiado paso a paso
                    </span>
                </div>
            </div>
        </div>
    )
}
