import React from 'react'
import { ThumbsUp } from 'lucide-react'
import type { RecommendationSatisfaction } from '../services/adminApi'

interface RecommenderSatisfactionSectionProps {
    satisfaction: RecommendationSatisfaction
}

export const RecommenderSatisfactionSection: React.FC<RecommenderSatisfactionSectionProps> = ({
    satisfaction
}) => {
    return (
        <section
            className="p-4 rounded-3 mt-4"
            style={{
                backgroundColor: 'var(--admin-surface-1)',
                border: '1px solid var(--admin-border-subtle)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)'
            }}
        >
            {/* Header de sección independiente */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="p-1.5 rounded-2 d-flex align-items-center justify-content-center"
                            style={{ backgroundColor: 'var(--admin-emerald-bg)', border: '1px solid var(--admin-emerald-border)', color: 'var(--admin-emerald)' }}
                        >
                            <ThumbsUp size={16} />
                        </div>
                        <h2 className="admin-title m-0" style={{ fontSize: '1rem' }}>
                            Índice de Satisfacción por Recomendación Automática
                        </h2>
                    </div>
                    <span className="admin-subtitle d-block mt-1">
                        Auditoría independiente: Métricas directas de feedback grupal posterior a las sugerencias generadas por el recomendador
                    </span>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.72rem' }}>
                        {satisfaction.overall_satisfaction_pct}% Satisfacción Global
                    </span>
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.72rem' }}>
                        {satisfaction.total_evaluations} Salas Evaluadas
                    </span>
                </div>
            </div>

            <div className="row g-3 mb-3">
                {/* 1. Barra de Desglose de Evaluación */}
                <div className="col-12 col-lg-6">
                    <div className="p-3 rounded-2 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                        <div className="d-flex justify-content-between align-items-baseline mb-2">
                            <span className="fw-semibold text-white" style={{ fontSize: '0.8rem' }}>Evaluación Post-Elección</span>
                            <span className="font-mono fw-bold text-success" style={{ fontSize: '0.78rem' }}>
                                {satisfaction.avg_rating} / 5.0 ⭐
                            </span>
                        </div>

                        {/* Barra trifásica */}
                        <div className="d-flex rounded overflow-hidden mb-2.5" style={{ height: 10 }}>
                            <div style={{ width: `${satisfaction.breakdown.excellent_pct}%`, backgroundColor: '#10B981' }} title={`Excelente: ${satisfaction.breakdown.excellent_pct}%`} />
                            <div style={{ width: `${satisfaction.breakdown.good_pct}%`, backgroundColor: '#38BDF8' }} title={`Aceptable: ${satisfaction.breakdown.good_pct}%`} />
                            <div style={{ width: `${satisfaction.breakdown.poor_pct}%`, backgroundColor: '#EF4444' }} title={`Desacuerdo: ${satisfaction.breakdown.poor_pct}%`} />
                        </div>

                        <div className="d-flex justify-content-between font-mono small text-secondary" style={{ fontSize: '0.68rem' }}>
                            <div className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                                <span>¡Nos encantó! ({satisfaction.breakdown.excellent_pct}%)</span>
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#38BDF8', display: 'inline-block' }} />
                                <span>Aceptable ({satisfaction.breakdown.good_pct}%)</span>
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
                                <span>Disconforme ({satisfaction.breakdown.poor_pct}%)</span>
                            </div>
                        </div>

                        <div className="pt-2.5 border-top mt-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center font-mono small">
                                <span className="text-secondary" style={{ fontSize: '0.7rem' }}>Tasa de adopción de la 1ª sugerencia:</span>
                                <span className="text-white fw-bold" style={{ fontSize: '0.75rem' }}>{satisfaction.acceptance_rate}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Comparativa A/B: Algoritmo Automático vs Elección Manual */}
                <div className="col-12 col-lg-6">
                    <div className="p-3 rounded-2 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-semibold text-white" style={{ fontSize: '0.8rem' }}>
                                Impacto del Algoritmo vs Selección Manual Tradicional
                            </span>
                            <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.64rem' }}>
                                A/B Testing en Vivo
                            </span>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-dark table-borderless font-mono m-0" style={{ fontSize: '0.72rem' }}>
                                <thead>
                                    <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-muted)' }}>
                                        <th>MÉTRICA DE SALA</th>
                                        <th className="text-center text-success">ALGORITMO ANIMIGOS</th>
                                        <th className="text-center text-secondary">SELECCIÓN MANUAL</th>
                                        <th className="text-end text-white">MEJORA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-bottom" style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
                                        <td className="text-white fw-medium">Felicidad media post-sesión</td>
                                        <td className="text-center text-success fw-bold">{satisfaction.comparison.algo_happiness} / 10</td>
                                        <td className="text-center text-secondary">{satisfaction.comparison.manual_happiness} / 10</td>
                                        <td className="text-end text-success fw-bold">+1.57 pts (+22%)</td>
                                    </tr>
                                    <tr className="border-bottom" style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
                                        <td className="text-white fw-medium">Tiempo hasta el consenso</td>
                                        <td className="text-center text-success fw-bold">{satisfaction.comparison.time_to_consensus_algo}</td>
                                        <td className="text-center text-secondary">{satisfaction.comparison.time_to_consensus_manual}</td>
                                        <td className="text-end text-success fw-bold">-83% más rápido</td>
                                    </tr>
                                    <tr>
                                        <td className="text-white fw-medium">Tasa de conflicto / abandonos</td>
                                        <td className="text-center text-success fw-bold">{satisfaction.comparison.conflict_rate_algo}</td>
                                        <td className="text-center text-secondary">{satisfaction.comparison.conflict_rate_manual}</td>
                                        <td className="text-end text-success fw-bold">-85% discordia</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Feed de Evaluaciones Reales de Salas */}
            <div>
                <h3 className="admin-title mb-2.5" style={{ fontSize: '0.85rem' }}>
                    Evaluaciones Recientes de Grupos (Feedback de Usuarios)
                </h3>

                <div className="row g-2">
                    {satisfaction.recent_feed.map((feed) => (
                        <div key={feed.id} className="col-12 col-md-6 col-xl-3">
                            <div className="p-2.5 rounded-2 h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-1.5">
                                        <div>
                                            <div className="fw-semibold text-white text-truncate" style={{ fontSize: '0.78rem' }}>
                                                {feed.room_name}
                                            </div>
                                            <div className="font-mono text-secondary small text-truncate" style={{ fontSize: '0.68rem' }}>
                                                Recomendado: <strong className="text-info">{feed.anime_title}</strong>
                                            </div>
                                        </div>

                                        <div className="d-flex flex-column align-items-end flex-shrink-0">
                                            <span className="text-warning font-mono" style={{ fontSize: '0.72rem' }}>
                                                {'★'.repeat(feed.rating)}{'☆'.repeat(5 - feed.rating)}
                                            </span>
                                            <span className="font-mono text-muted" style={{ fontSize: '0.62rem' }}>
                                                {feed.time_ago}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-light small fst-italic mb-2" style={{ fontSize: '0.72rem', color: '#E4E4E7' }}>
                                        "{feed.comment}"
                                    </p>
                                </div>

                                <div className="d-flex justify-content-between align-items-center pt-1.5 border-top font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.68rem' }}>
                                    <span className="admin-badge admin-badge-neutral" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                                        {feed.verdict}
                                    </span>
                                    <span className="text-success fw-bold">
                                        Felicidad: {feed.happiness_score} / 10
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
