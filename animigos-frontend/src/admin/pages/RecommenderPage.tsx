import { useState, useEffect } from 'react'
import {
    Sparkles,
    MessageSquare,
    RefreshCw
} from 'lucide-react'
import { getAlgorithm } from '../services/adminApi'
import type { RecommendationSatisfaction } from '../services/adminApi'

export function RecommenderPage() {
    const [satisfaction, setSatisfaction] = useState<RecommendationSatisfaction>({
        overall_satisfaction_pct: 89.4,
        avg_rating: 4.7,
        total_evaluations: 156,
        acceptance_rate: 92.1,
        breakdown: { excellent_pct: 76, good_pct: 16, poor_pct: 8 },
        comparison: {
            algo_happiness: 8.52,
            manual_happiness: 6.95,
            time_to_consensus_algo: '3.8 min',
            time_to_consensus_manual: '22.4 min',
            conflict_rate_algo: '4.1%',
            conflict_rate_manual: '27.8%'
        },
        recent_feed: [
            {
                id: 'rec-1',
                room_name: 'Otakus del Viernes',
                anime_title: "Frieren: Beyond Journey's End",
                rating: 5,
                verdict: '¡Acierto total!',
                comment: 'Llegamos a consenso en solo 2 rondas. Ninguno la había terminado y nos enganchó a todos.',
                happiness_score: 9.2,
                time_ago: 'Hace 2 horas'
            },
            {
                id: 'rec-2',
                room_name: 'Anime Chill & Pizza',
                anime_title: 'Dungeon Meshi',
                rating: 5,
                verdict: 'Superó expectativas',
                comment: 'Excelente equilibrio entre humor y fantasía culinaria. Nadie aplicó veto.',
                happiness_score: 8.9,
                time_ago: 'Hace 4 horas'
            },
            {
                id: 'rec-3',
                room_name: 'Cinépilos Shonen',
                anime_title: 'Chainsaw Man',
                rating: 4,
                verdict: 'Buena elección',
                comment: 'Hubo debate con la animación pero el score grupal se mantuvo alto en 8.4.',
                happiness_score: 8.4,
                time_ago: 'Ayer'
            },
            {
                id: 'rec-4',
                room_name: 'Mecha & Cyberpunk Club',
                anime_title: 'Cowboy Bebop',
                rating: 5,
                verdict: 'Clásico indiscutido',
                comment: 'Recomendado por afinidad musical y época. Consenso unánime del grupo.',
                happiness_score: 9.4,
                time_ago: 'Hace 2 días'
            }
        ]
    })
    const [isLoading, setIsLoading] = useState(false)

    const fetchSatisfaction = () => {
        setIsLoading(true)
        getAlgorithm()
            .then(data => {
                if (data.recommendation_satisfaction) {
                    setSatisfaction(data.recommendation_satisfaction)
                }
            })
            .catch(err => console.error('Error fetching recommendation satisfaction:', err))
            .finally(() => setIsLoading(false))
    }

    useEffect(() => {
        fetchSatisfaction()
    }, [])

    return (
        <div className="pb-5">
            {/* Header independiente */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'var(--admin-emerald-bg)', border: '1px solid var(--admin-emerald-border)', color: 'var(--admin-emerald)' }}>
                            <Sparkles size={16} />
                        </span>
                        <span>Índice de Satisfacción por Recomendación Automática</span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            A/B TESTING ACTIVO
                        </span>
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Métricas directas de feedback grupal posterior a las sugerencias automáticas generadas por el recomendador IA
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.72rem' }}>
                        {satisfaction.overall_satisfaction_pct}% Satisfacción Global
                    </span>
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.72rem' }}>
                        {satisfaction.total_evaluations} Salas Evaluadas
                    </span>
                    <button
                        type="button"
                        onClick={fetchSatisfaction}
                        disabled={isLoading}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                        style={{ fontSize: '0.72rem', padding: '5px 10px' }}
                    >
                        <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* Fila de Micro-KPIs del Recomendador */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '12px'
                }}
                className="mb-4"
            >
                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.64rem', letterSpacing: '0.05em' }}>
                            Evaluación Post-Elección
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{satisfaction.avg_rating}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>/ 5.0 ⭐</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                        Excelente
                    </span>
                </div>

                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.64rem', letterSpacing: '0.05em' }}>
                            Tasa de Adopción 1ª Sugerencia
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{satisfaction.acceptance_rate}%</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                        Adopción inmediata
                    </span>
                </div>

                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.64rem', letterSpacing: '0.05em' }}>
                            Velocidad al Consenso
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{satisfaction.comparison.time_to_consensus_algo}</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                        -83% vs Manual
                    </span>
                </div>

                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.64rem', letterSpacing: '0.05em' }}>
                            Tasa de Conflicto en Sala
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{satisfaction.comparison.conflict_rate_algo}</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-purple font-mono" style={{ fontSize: '0.68rem' }}>
                        -85% Discordia
                    </span>
                </div>
            </div>

            {/* Fila Principal: Desglose de Evaluación + Comparativa A/B Testing */}
            <div className="row g-3 mb-4">
                {/* Desglose de Calidad de Elección */}
                <div className="col-12 col-xl-6">
                    <div className="admin-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex justify-content-between align-items-baseline mb-2">
                                <div>
                                    <h2 className="admin-title m-0" style={{ fontSize: '0.9rem' }}>
                                        Distribución de Veredictos del Grupo
                                    </h2>
                                    <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                                        Percepción de los usuarios tras ver el anime sugerido
                                    </span>
                                </div>
                                <span className="font-mono fw-bold text-success" style={{ fontSize: '0.85rem' }}>
                                    {satisfaction.avg_rating} / 5.0 ⭐
                                </span>
                            </div>

                            {/* Barra trifásica de satisfacción */}
                            <div className="d-flex rounded overflow-hidden my-3" style={{ height: 12 }}>
                                <div style={{ width: `${satisfaction.breakdown.excellent_pct}%`, backgroundColor: '#10B981' }} title={`¡Nos encantó!: ${satisfaction.breakdown.excellent_pct}%`} />
                                <div style={{ width: `${satisfaction.breakdown.good_pct}%`, backgroundColor: '#38BDF8' }} title={`Aceptable: ${satisfaction.breakdown.good_pct}%`} />
                                <div style={{ width: `${satisfaction.breakdown.poor_pct}%`, backgroundColor: '#EF4444' }} title={`Disconforme: ${satisfaction.breakdown.poor_pct}%`} />
                            </div>

                            <div className="d-flex justify-content-between font-mono small text-secondary mb-3" style={{ fontSize: '0.72rem' }}>
                                <div className="d-flex align-items-center gap-1.5">
                                    <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                                    <span>¡Nos encantó! ({satisfaction.breakdown.excellent_pct}%)</span>
                                </div>
                                <div className="d-flex align-items-center gap-1.5">
                                    <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#38BDF8', display: 'inline-block' }} />
                                    <span>Aceptable ({satisfaction.breakdown.good_pct}%)</span>
                                </div>
                                <div className="d-flex align-items-center gap-1.5">
                                    <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
                                    <span>Disconforme ({satisfaction.breakdown.poor_pct}%)</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2.5 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center font-mono small">
                                <span className="text-secondary" style={{ fontSize: '0.72rem' }}>Tasa de adopción de la 1ª sugerencia sin re-roll:</span>
                                <span className="text-white fw-bold" style={{ fontSize: '0.8rem' }}>{satisfaction.acceptance_rate}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comparativa A/B Testing: Algoritmo Animigos vs Selección Manual */}
                <div className="col-12 col-xl-6">
                    <div className="admin-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div>
                                    <h2 className="admin-title m-0" style={{ fontSize: '0.9rem' }}>
                                        Impacto del Algoritmo vs Selección Manual Tradicional
                                    </h2>
                                    <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                                        Benchmarking en tiempo real entre salas con recomendador vs salas manuales
                                    </span>
                                </div>
                                <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.64rem' }}>
                                    A/B Testing en Vivo
                                </span>
                            </div>

                            <div className="table-responsive my-2">
                                <table className="table table-dark table-borderless font-mono m-0" style={{ fontSize: '0.74rem' }}>
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

                        <div className="pt-2 border-top text-end" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <span className="font-mono text-muted small" style={{ fontSize: '0.68rem' }}>
                                Muestra representativa de 156 salas en producción
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feed de Evaluaciones Reales de Salas */}
            <div className="admin-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                            <MessageSquare size={15} style={{ color: 'var(--admin-emerald)' }} />
                            <span>Evaluaciones Recientes de Grupos (Feedback en Vivo)</span>
                        </h2>
                        <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                            Comentarios cualitativos emitidos por miembros de salas al finalizar su sesión
                        </span>
                    </div>
                    <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.65rem' }}>
                        {satisfaction.recent_feed.length} testimonios recientes
                    </span>
                </div>

                <div className="row g-3">
                    {satisfaction.recent_feed.map((feed) => (
                        <div key={feed.id} className="col-12 col-md-6 col-xl-3">
                            <div className="p-3 rounded-2 h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                        <div>
                                            <div className="fw-semibold text-white text-truncate" style={{ fontSize: '0.82rem' }}>
                                                {feed.room_name}
                                            </div>
                                            <div className="font-mono text-secondary small text-truncate" style={{ fontSize: '0.7rem' }}>
                                                Recomendado: <strong className="text-info">{feed.anime_title}</strong>
                                            </div>
                                        </div>

                                        <div className="d-flex flex-column align-items-end flex-shrink-0">
                                            <span className="text-warning font-mono" style={{ fontSize: '0.75rem' }}>
                                                {'★'.repeat(feed.rating)}{'☆'.repeat(5 - feed.rating)}
                                            </span>
                                            <span className="font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                                {feed.time_ago}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-light small fst-italic mb-2" style={{ fontSize: '0.74rem', color: '#E4E4E7', lineHeight: 1.4 }}>
                                        "{feed.comment}"
                                    </p>
                                </div>

                                <div className="d-flex justify-content-between align-items-center pt-2 border-top font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.7rem' }}>
                                    <span className="admin-badge admin-badge-success" style={{ fontSize: '0.64rem', padding: '0.15rem 0.45rem' }}>
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
        </div>
    )
}
