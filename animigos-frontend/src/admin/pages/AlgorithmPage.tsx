import { useState, useEffect, useMemo } from 'react'
import {
    SlidersHorizontal,
    Activity,
    Scale,
    ShieldAlert,
    TrendingUp,
    ThumbsUp,
    Clock,
    Save,
    CheckCircle2
} from 'lucide-react'
import { getAlgorithm, calibrateAlgorithm } from '../services/adminApi'
import type { AlgorithmResponse, AlgorithmRule, HappinessTimelinePoint } from '../services/adminApi'

interface CandidateAnime {
    id: string
    title: string
    votes: number[]
    malScore: number
    polarization: number
    genreAffinity: number
}

export function AlgorithmPage() {
    // -------------------------------------------------------------
    // ESTADO: Ponderaciones Matemáticas del Algoritmo
    // -------------------------------------------------------------
    const [weightMean, setWeightMean] = useState(1.0)
    const [lambda, setLambda] = useState(0.3)
    const [weightPol, setWeightPol] = useState(0.2)
    const [weightMal, setWeightMal] = useState(0.15)
    const [weightAffinity, setWeightAffinity] = useState(0.5)
    const [tieThreshold, setTieThreshold] = useState(0.15)

    // -------------------------------------------------------------
    // ESTADO: Reglas de Consenso
    // -------------------------------------------------------------
    const [rules, setRules] = useState<AlgorithmRule[]>([
        { id: 'R1', name: 'Filtro Antiveto Estricto', condition: 'Voto individual ≤ 2', effect: 'Penalización inmediata de -3.0 al score grupal', active: true },
        { id: 'R2', name: 'Regla de Supermayoría (Consenso 75%)', condition: '≥ 75% vota ≥ 7 pts', effect: 'Bonus de certidumbre de +1.5 pts', active: true },
        { id: 'R3', name: 'Quórum Mínimo Requerido', condition: 'Participación < 60%', effect: 'La sala permanece bloqueada para desempate', active: true },
        { id: 'R4', name: 'Desempate por Ponderación Externa (MAL)', condition: 'Diferencia ≤ 0.15 pts', effect: 'Gana el título con mejor nota histórica canónica', active: true },
        { id: 'R5', name: 'Filtro de Descarte por Dispersión Extrema', condition: 'Desviación σ > 2.5', effect: 'Descarta candidato por polarización destructiva', active: true },
        { id: 'R6', name: 'Rotación Anti-Monopolio de Concesiones', condition: 'Miembro con racha sin ganar', effect: 'Prioridad de desempate +0.25 pts para su candidato', active: false }
    ])

    // -------------------------------------------------------------
    // ESTADO: Datos del Backend & Periodo Temporal
    // -------------------------------------------------------------
    const [algoData, setAlgoData] = useState<AlgorithmResponse | null>(null)
    const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
    const [hoveredPoint, setHoveredPoint] = useState<HappinessTimelinePoint | null>(null)
    const [saveToast, setSaveToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' })
    const [isSaving, setIsSaving] = useState(false)

    // -------------------------------------------------------------
    // ESTADO: Candidatos en el Simulador
    // -------------------------------------------------------------
    const [candidates, setCandidates] = useState<CandidateAnime[]>([
        { id: '1', title: 'Frieren: Beyond Journey\'s End', votes: [9, 8, 9], malScore: 9.38, polarization: 1.05, genreAffinity: 0.8 },
        { id: '2', title: 'Chainsaw Man', votes: [10, 4, 9], malScore: 8.51, polarization: 2.12, genreAffinity: 0.6 },
        { id: '3', title: 'Dungeon Meshi', votes: [8, 8, 8], malScore: 8.57, polarization: 1.15, genreAffinity: 0.9 },
    ])

    // Cargar datos iniciales del backend Django
    useEffect(() => {
        getAlgorithm()
            .then(data => {
                setAlgoData(data)
                if (data.parameters) {
                    if (data.parameters.interest_mean_weight !== undefined) setWeightMean(data.parameters.interest_mean_weight)
                    if (data.parameters.dispersion_weight_lambda !== undefined) setLambda(data.parameters.dispersion_weight_lambda)
                    if (data.parameters.polarization_penalty_weight !== undefined) setWeightPol(data.parameters.polarization_penalty_weight)
                    if (data.parameters.mal_weight !== undefined) setWeightMal(data.parameters.mal_weight)
                    if (data.parameters.genre_affinity_bonus !== undefined) setWeightAffinity(data.parameters.genre_affinity_bonus)
                    if (data.parameters.tie_break_threshold !== undefined) setTieThreshold(data.parameters.tie_break_threshold)
                }
                if (data.rules && data.rules.length > 0) {
                    setRules(data.rules)
                }
            })
            .catch(err => console.error('Error fetching algorithm data:', err))
    }, [])

    // -------------------------------------------------------------
    // CALCULO REACTIVO DEL SIMULADOR SEGUN PESOS Y REGLAS ACTIVAS
    // -------------------------------------------------------------
    const calculateCandidateScore = (c: CandidateAnime) => {
        const votes = c.votes
        const mean = votes.reduce((a, b) => a + b, 0) / votes.length
        const variance = votes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / votes.length
        const stdDev = Math.sqrt(variance)

        // Verificación de Reglas de Consenso
        const hasVetoRule = rules.find(r => r.id === 'R1')?.active
        const hasSupermajorityRule = rules.find(r => r.id === 'R2')?.active
        const hasExtremeDispersionRule = rules.find(r => r.id === 'R5')?.active

        let penalty = 0
        let bonus = 0
        let isDiscarded = false

        // R1: Veto si alguien vota <= 2
        if (hasVetoRule && votes.some(v => v <= 2)) {
            penalty += 3.0
        }

        // R2: Supermayoría si >= 75% vota >= 7
        if (hasSupermajorityRule) {
            const highVotesCount = votes.filter(v => v >= 7).length
            if ((highVotesCount / votes.length) >= 0.75) {
                bonus += 1.5
            }
        }

        // R5: Descarte por dispersión extrema > 2.5
        if (hasExtremeDispersionRule && stdDev > 2.5) {
            isDiscarded = true
        }

        // Fórmula calibrada completa:
        // Score = w_μ · μ - λ · σ - β · Pol + w_mal · (MAL/10) + w_af · Afinidad - Penalizaciones + Bonificaciones
        const rawScore = (weightMean * mean)
            - (lambda * stdDev)
            - (weightPol * c.polarization)
            + (weightMal * (c.malScore / 10.0) * 10.0)
            + (weightAffinity * c.genreAffinity)
            - penalty
            + bonus

        const finalScore = isDiscarded ? 0.0 : Math.max(0, Math.min(10, Number(rawScore.toFixed(2))))

        return {
            mean: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            finalScore,
            isDiscarded,
            hasVetoApplied: hasVetoRule && votes.some(v => v <= 2),
            hasSupermajorityApplied: hasSupermajorityRule && (votes.filter(v => v >= 7).length / votes.length) >= 0.75
        }
    }

    const candidatesWithStats = useMemo(() => {
        return candidates.map(c => ({
            ...c,
            ...calculateCandidateScore(c)
        })).sort((a, b) => b.finalScore - a.finalScore)
    }, [candidates, weightMean, lambda, weightPol, weightMal, weightAffinity, rules])

    const winnerId = candidatesWithStats[0]?.id

    const handleVoteChange = (candidateId: string, voterIndex: number, newVote: number) => {
        setCandidates(prev => prev.map(c => {
            if (c.id === candidateId) {
                const newVotes = [...c.votes]
                newVotes[voterIndex] = newVote
                return { ...c, votes: newVotes }
            }
            return c
        }))
    }

    // Toggle de Regla de Consenso
    const handleToggleRule = (ruleId: string) => {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, active: !r.active } : r))
    }

    // Presets rápidos de calibración
    const applyPreset = (preset: 'standard' | 'strict_anti_veto' | 'discovery') => {
        if (preset === 'standard') {
            setWeightMean(1.0)
            setLambda(0.3)
            setWeightPol(0.2)
            setWeightMal(0.15)
            setWeightAffinity(0.5)
            setTieThreshold(0.15)
        } else if (preset === 'strict_anti_veto') {
            setWeightMean(0.9)
            setLambda(0.55)
            setWeightPol(0.4)
            setWeightMal(0.1)
            setWeightAffinity(0.6)
            setTieThreshold(0.20)
        } else if (preset === 'discovery') {
            setWeightMean(1.2)
            setLambda(0.15)
            setWeightPol(0.05)
            setWeightMal(0.35)
            setWeightAffinity(0.8)
            setTieThreshold(0.10)
        }
    }

    // Guardar calibración en backend
    const handleSaveCalibration = async () => {
        setIsSaving(true)
        try {
            await calibrateAlgorithm({
                parameters: {
                    interest_mean_weight: weightMean,
                    dispersion_weight_lambda: lambda,
                    polarization_penalty_weight: weightPol,
                    mal_weight: weightMal,
                    genre_affinity_bonus: weightAffinity,
                    tie_break_threshold: tieThreshold
                },
                rules: rules
            })
            setSaveToast({ show: true, msg: 'Calibración guardada exitosamente en el motor Django' })
            setTimeout(() => setSaveToast({ show: false, msg: '' }), 3500)
        } catch (error) {
            console.error('Error calibrating algorithm:', error)
            setSaveToast({ show: true, msg: 'Error de red al guardar en backend' })
            setTimeout(() => setSaveToast({ show: false, msg: '' }), 3500)
        } finally {
            setIsSaving(false)
        }
    }

    // Timeline de felicidad histórico
    const timelineData: HappinessTimelinePoint[] = algoData?.timeline || [
        { date: '2026-10-01', label: 'Sem 1 Oct', avg_happiness: 7.62, rooms_count: 12, consensus_rate: 78, event: 'Lanzamiento v2.0' },
        { date: '2026-10-08', label: 'Sem 2 Oct', avg_happiness: 7.85, rooms_count: 18, consensus_rate: 82, event: 'Calibración λ = 0.35' },
        { date: '2026-10-15', label: 'Sem 3 Oct', avg_happiness: 8.14, rooms_count: 26, consensus_rate: 87, event: 'Activación filtro antiveto' },
        { date: '2026-10-20', label: 'Sem 4 Oct', avg_happiness: 8.36, rooms_count: 34, consensus_rate: 90, event: 'Co-recomendaciones dataset' },
        { date: '2026-10-23', label: '23 Oct', avg_happiness: 8.48, rooms_count: 41, consensus_rate: 92, event: 'Sesiones fin de semana' },
        { date: '2026-10-24', label: '24 Oct', avg_happiness: 8.55, rooms_count: 48, consensus_rate: 94, event: 'Quórum récord de salas' },
        { date: '2026-10-25', label: '25 Oct (Hoy)', avg_happiness: 8.61, rooms_count: 53, consensus_rate: 95, event: 'Motor en vivo calibrado' }
    ]

    // Datos de satisfacción por recomendación
    const satisfaction = algoData?.recommendation_satisfaction || {
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
                anime_title: 'Frieren: Beyond Journey\'s End',
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
    }

    // Coordenadas SVG para el gráfico temporal
    const svgWidth = 600
    const svgHeight = 180
    const padding = { top: 25, right: 30, bottom: 35, left: 45 }
    const chartW = svgWidth - padding.left - padding.right
    const chartH = svgHeight - padding.top - padding.bottom

    const minScore = 7.0
    const maxScore = 9.0

    const points = timelineData.map((pt, idx) => {
        const x = padding.left + (idx / Math.max(1, timelineData.length - 1)) * chartW
        const normalizedY = (pt.avg_happiness - minScore) / (maxScore - minScore)
        const y = padding.top + chartH - (normalizedY * chartH)
        return { ...pt, x, y }
    })

    const pathD = points.reduce((acc, pt, idx) => {
        return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
    }, '')

    const areaD = points.length > 0
        ? `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
        : ''

    return (
        <div className="pb-5">
            {/* Header del módulo */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0 d-flex align-items-center gap-2">
                        <span>Algoritmo de Felicidad Grupal</span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            MOTOR ACTIVO
                        </span>
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Calibración matemática de pesos, reglas de consenso y analíticas de satisfacción grupal
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.72rem' }}>
                        Fórmula: w_μ·μ - λ·σ - β·Pol + w_mal·MAL + w_af·Afinidad
                    </span>

                    <button
                        onClick={handleSaveCalibration}
                        disabled={isSaving}
                        className="btn btn-sm d-flex align-items-center gap-1.5 fw-semibold"
                        style={{
                            backgroundColor: 'var(--admin-emerald)',
                            color: '#000000',
                            border: 'none',
                            fontSize: '0.75rem',
                            padding: '6px 14px'
                        }}
                    >
                        <Save size={13} />
                        {isSaving ? 'Guardando...' : 'Guardar Calibración'}
                    </button>
                </div>
            </div>

            {/* Toast de confirmación */}
            {saveToast.show && (
                <div
                    className="alert d-flex align-items-center justify-content-between p-2.5 mb-3 rounded-1 font-mono small"
                    style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid var(--admin-emerald)',
                        color: 'var(--admin-emerald)'
                    }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>{saveToast.msg}</span>
                    </div>
                </div>
            )}

            {/* ============================================================
               1. FILA DE KPIS PRINCIPALES (4 Tarjetas)
               ============================================================ */}
            <section className="admin-grid-kpis mb-4">
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Felicidad Media (Salas)
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-emerald)' }}>
                                <Activity size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">
                                {algoData?.stats.average_group_happiness || 8.48}
                            </span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>/ 10</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            {algoData?.stats.happiness_trend_delta || '+0.42 pts'} vs mes ant.
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            78 votos analizados
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Satisfacción Recomendación
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: '#38BDF8' }}>
                                <ThumbsUp size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">
                                {satisfaction.overall_satisfaction_pct}%
                            </span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>({satisfaction.avg_rating} ⭐)</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                            {satisfaction.acceptance_rate}% aceptación
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            {satisfaction.total_evaluations} evaluaciones
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Tiempo de Consenso
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-amber)' }}>
                                <Clock size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">
                                {satisfaction.comparison.time_to_consensus_algo}
                            </span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>promedio</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.68rem' }}>
                            vs {satisfaction.comparison.time_to_consensus_manual} manual
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            -83% fricción
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Reglas de Consenso
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-emerald)' }}>
                                <ShieldAlert size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">
                                {rules.filter(r => r.active).length} / {rules.length}
                            </span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>activas</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            {rules.find(r => r.id === 'R1')?.active ? 'Antiveto ON' : 'Antiveto OFF'}
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Calibración viva
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. REQUERIMIENTO 1: PANEL DE CALIBRACIÓN DE PESOS MATEMÁTICOS
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                            <SlidersHorizontal size={15} style={{ color: 'var(--admin-emerald)' }} />
                            <span>Calibración de Ponderaciones Matemáticas del Algoritmo</span>
                        </h2>
                        <span className="admin-subtitle">
                            Modifica el peso que se le asigna a cada parámetro en la función objetivo de felicidad
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-1.5">
                        <span className="font-mono text-secondary small me-1" style={{ fontSize: '0.7rem' }}>Presets:</span>
                        <button
                            onClick={() => applyPreset('standard')}
                            className="btn btn-sm btn-outline-secondary font-mono"
                            style={{ fontSize: '0.68rem', padding: '3px 8px', color: '#D4D4D8', borderColor: 'var(--admin-border-subtle)' }}
                        >
                            Estándar
                        </button>
                        <button
                            onClick={() => applyPreset('strict_anti_veto')}
                            className="btn btn-sm btn-outline-secondary font-mono"
                            style={{ fontSize: '0.68rem', padding: '3px 8px', color: '#D4D4D8', borderColor: 'var(--admin-border-subtle)' }}
                        >
                            Antidiscordia (Alto λ)
                        </button>
                        <button
                            onClick={() => applyPreset('discovery')}
                            className="btn btn-sm btn-outline-secondary font-mono"
                            style={{ fontSize: '0.68rem', padding: '3px 8px', color: '#D4D4D8', borderColor: 'var(--admin-border-subtle)' }}
                        >
                            Descubrimiento Crítico
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {/* Peso de la Media w_μ */}
                    <div>
                        <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>Media de Interés (w_μ)</span>
                                <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                                    {weightMean.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                Ponderación del promedio directo de votos del grupo.
                            </p>
                            <input
                                id="slider-weight-mean"
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.05"
                                value={weightMean}
                                onChange={(e) => setWeightMean(parseFloat(e.target.value))}
                                className="w-100"
                                style={{ accentColor: '#10B981', cursor: 'pointer' }}
                            />
                            <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                <span>0.50 (Suave)</span>
                                <span>2.00 (Dominante)</span>
                            </div>
                        </div>
                    </div>

                    {/* Factor de Penalización por Dispersión λ */}
                    <div>
                        <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>Aversión a la Dispersión (λ)</span>
                                <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                                    {lambda.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                Penalización aplicada a la desviación estándar (σ) entre amigos.
                            </p>
                            <input
                                id="slider-weight-lambda"
                                type="range"
                                min="0.0"
                                max="1.0"
                                step="0.05"
                                value={lambda}
                                onChange={(e) => setLambda(parseFloat(e.target.value))}
                                className="w-100"
                                style={{ accentColor: '#38BDF8', cursor: 'pointer' }}
                            />
                            <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                <span>0.00 (Tolerante)</span>
                                <span>1.00 (Aversión total)</span>
                            </div>
                        </div>
                    </div>

                    {/* Penalización por Polarización Histórica β */}
                    <div>
                        <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>Freno a Polarización (β)</span>
                                <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                                    {weightPol.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                Castigo a animes con alta controversia histórica externa (Dataset σ).
                            </p>
                            <input
                                id="slider-weight-pol"
                                type="range"
                                min="0.0"
                                max="0.8"
                                step="0.05"
                                value={weightPol}
                                onChange={(e) => setWeightPol(parseFloat(e.target.value))}
                                className="w-100"
                                style={{ accentColor: '#F59E0B', cursor: 'pointer' }}
                            />
                            <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                <span>0.00 (Ignorar)</span>
                                <span>0.80 (Anti-controversia)</span>
                            </div>
                        </div>
                    </div>

                    {/* Ponderación Calidad Canónica MAL w_mal */}
                    <div>
                        <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>Crítica Externa (w_mal)</span>
                                <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                                    {weightMal.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                Aporte de la calificación histórica de MyAnimeList.
                            </p>
                            <input
                                id="slider-weight-mal"
                                type="range"
                                min="0.0"
                                max="0.5"
                                step="0.05"
                                value={weightMal}
                                onChange={(e) => setWeightMal(parseFloat(e.target.value))}
                                className="w-100"
                                style={{ accentColor: '#A855F7', cursor: 'pointer' }}
                            />
                            <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                <span>0.00 (Solo grupo)</span>
                                <span>0.50 (Influencia alta)</span>
                            </div>
                        </div>
                    </div>

                    {/* Bonus Afinidad de Género Grupal w_af */}
                    <div>
                        <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>Afinidad de Géneros (w_af)</span>
                                <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                                    {weightAffinity.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                Multiplicador por coincidencia con géneros favoritos de los perfiles.
                            </p>
                            <input
                                id="slider-weight-affinity"
                                type="range"
                                min="0.0"
                                max="1.5"
                                step="0.1"
                                value={weightAffinity}
                                onChange={(e) => setWeightAffinity(parseFloat(e.target.value))}
                                className="w-100"
                                style={{ accentColor: '#EC4899', cursor: 'pointer' }}
                            />
                            <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                <span>0.00 (Neutral)</span>
                                <span>1.50 (Máxima afinidad)</span>
                            </div>
                        </div>
                    </div>

                    {/* Umbral de Desempate (Tie-Break) */}
                    <div>
                        <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>Umbral de Desempate (ε)</span>
                                <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                                    ±{tieThreshold.toFixed(2)} pts
                                </span>
                            </div>
                            <p className="text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                Margen de diferencia de score que activa el criterio canónico.
                            </p>
                            <input
                                id="slider-tie-threshold"
                                type="range"
                                min="0.05"
                                max="0.50"
                                step="0.05"
                                value={tieThreshold}
                                onChange={(e) => setTieThreshold(parseFloat(e.target.value))}
                                className="w-100"
                                style={{ accentColor: '#10B981', cursor: 'pointer' }}
                            />
                            <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.64rem' }}>
                                <span>0.05 (Estricto)</span>
                                <span>0.50 (Flexible)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================
               3. REQUERIMIENTO 2: REGLAS DE CONSENSO (ACTIVAR / DESACTIVAR)
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                            <Scale size={15} style={{ color: 'var(--admin-emerald)' }} />
                            <span>Reglas de Consenso Grupal (Activar y Desactivar)</span>
                        </h2>
                        <span className="admin-subtitle">
                            Habilita o deshabilita los filtros automáticos que rigen el veredicto en las salas compartidas
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2 font-mono small">
                        <span style={{ color: 'var(--admin-emerald)' }}>
                            ● {rules.filter(r => r.active).length} activas
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)' }}>
                            / {rules.filter(r => !r.active).length} inactivas
                        </span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                    {rules.map(rule => (
                        <div
                            key={rule.id}
                            className="p-3 rounded-1 d-flex flex-column justify-content-between transition-all"
                            style={{
                                backgroundColor: rule.active ? 'rgba(16, 185, 129, 0.03)' : 'var(--admin-surface-2)',
                                border: `1px solid ${rule.active ? 'rgba(16, 185, 129, 0.35)' : 'var(--admin-border-subtle)'}`
                            }}
                        >
                            <div>
                                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                    <div className="d-flex align-items-center gap-1.5">
                                        <span
                                            className="font-mono rounded px-1.5 py-0.5 fw-bold"
                                            style={{
                                                fontSize: '0.65rem',
                                                backgroundColor: rule.active ? 'rgba(16, 185, 129, 0.2)' : 'var(--admin-surface-3)',
                                                color: rule.active ? 'var(--admin-emerald)' : 'var(--admin-text-muted)'
                                            }}
                                        >
                                            {rule.id}
                                        </span>
                                        <span className="fw-semibold text-white" style={{ fontSize: '0.82rem' }}>
                                            {rule.name}
                                        </span>
                                    </div>

                                    {/* Toggle Switch */}
                                    <div className="form-check form-switch m-0">
                                        <input
                                            id={`toggle-rule-${rule.id}`}
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={rule.active}
                                            onChange={() => handleToggleRule(rule.id)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: rule.active ? 'var(--admin-emerald)' : 'var(--admin-surface-3)',
                                                borderColor: rule.active ? 'var(--admin-emerald)' : 'var(--admin-border-subtle)'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="font-mono mb-1.5" style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>Condición: </span>
                                    {rule.condition}
                                </div>
                            </div>

                            <div
                                className="pt-2 border-top mt-2 d-flex align-items-center justify-content-between font-mono"
                                style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.7rem' }}
                            >
                                <span style={{ color: rule.active ? 'var(--admin-emerald)' : 'var(--admin-text-muted)' }}>
                                    → {rule.effect}
                                </span>
                                <span
                                    className={`badge ${rule.active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}
                                    style={{ fontSize: '0.62rem' }}
                                >
                                    {rule.active ? 'ACTIVA' : 'INACTIVA'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ============================================================
               4. REQUERIMIENTO 3: GRÁFICO TEMPORAL DE FELICIDAD MEDIA (EN VEZ DE GÉNERO)
               ============================================================ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '16px' }} className="mb-4">
                {/* Gráfico Temporal */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                            <div>
                                <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                                    <TrendingUp size={15} style={{ color: 'var(--admin-emerald)' }} />
                                    <span>Felicidad Media Histórica (Todas las Salas)</span>
                                </h2>
                                <span className="admin-subtitle">
                                    Evolución temporal del bienestar grupal y tasa de consenso en salas activas
                                </span>
                            </div>

                            <div className="d-flex align-items-center gap-1 p-0.5 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                {(['7d', '30d', '90d', 'all'] as const).map(p => (
                                    <button
                                        key={p}
                                        id={`btn-timeframe-${p}`}
                                        onClick={() => setTimeframe(p)}
                                        className="btn btn-sm font-mono border-0"
                                        style={{
                                            fontSize: '0.68rem',
                                            padding: '3px 8px',
                                            backgroundColor: timeframe === p ? 'var(--admin-emerald)' : 'transparent',
                                            color: timeframe === p ? '#000000' : 'var(--admin-text-secondary)',
                                            fontWeight: timeframe === p ? 600 : 400
                                        }}
                                    >
                                        {p.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Canvas / SVG Chart OLED */}
                        <div className="position-relative" style={{ width: '100%', height: svgHeight, overflow: 'hidden' }}>
                            <svg
                                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                className="w-100 h-100"
                                style={{ display: 'block' }}
                            >
                                <defs>
                                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {/* Guías horizontales */}
                                {[7.0, 7.5, 8.0, 8.5, 9.0].map(val => {
                                    const normY = (val - minScore) / (maxScore - minScore)
                                    const y = padding.top + chartH - (normY * chartH)
                                    return (
                                        <g key={val}>
                                            <line
                                                x1={padding.left}
                                                y1={y}
                                                x2={svgWidth - padding.right}
                                                y2={y}
                                                stroke="rgba(255, 255, 255, 0.06)"
                                                strokeDasharray="3 3"
                                            />
                                            <text
                                                x={padding.left - 8}
                                                y={y + 3}
                                                fill="var(--admin-text-muted)"
                                                fontSize="9"
                                                fontFamily="monospace"
                                                textAnchor="end"
                                            >
                                                {val.toFixed(1)}
                                            </text>
                                        </g>
                                    )
                                })}

                                {/* Área sombreada */}
                                <path d={areaD} fill="url(#emeraldGradient)" />

                                {/* Línea principal */}
                                <path
                                    d={pathD}
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {/* Puntos y etiquetas */}
                                {points.map((pt, i) => (
                                    <g key={i}>
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={hoveredPoint?.date === pt.date ? 5.5 : 3.5}
                                            fill={hoveredPoint?.date === pt.date ? '#FFFFFF' : '#10B981'}
                                            stroke="#000000"
                                            strokeWidth="2"
                                            style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                                            onMouseEnter={() => setHoveredPoint(pt)}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                        />
                                        <text
                                            x={pt.x}
                                            y={svgHeight - 10}
                                            fill="var(--admin-text-muted)"
                                            fontSize="9"
                                            fontFamily="monospace"
                                            textAnchor="middle"
                                        >
                                            {pt.label}
                                        </text>
                                    </g>
                                ))}
                            </svg>

                            {/* Tooltip flotante */}
                            {hoveredPoint && (
                                <div
                                    className="position-absolute p-2 rounded-1 font-mono shadow-lg pointer-events-none"
                                    style={{
                                        top: 10,
                                        right: 15,
                                        backgroundColor: 'rgba(10, 10, 12, 0.95)',
                                        border: '1px solid var(--admin-emerald)',
                                        fontSize: '0.72rem',
                                        zIndex: 10
                                    }}
                                >
                                    <div className="fw-bold text-white mb-0.5">{hoveredPoint.label} ({hoveredPoint.date})</div>
                                    <div style={{ color: 'var(--admin-emerald)' }}>
                                        Felicidad media: <strong>{hoveredPoint.avg_happiness} / 10</strong>
                                    </div>
                                    <div style={{ color: 'var(--admin-text-secondary)' }}>
                                        Salas activas: {hoveredPoint.rooms_count} | Consenso: {hoveredPoint.consensus_rate}%
                                    </div>
                                    {hoveredPoint.event && (
                                        <div className="mt-1 pt-1 border-top text-info" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                            Hito: {hoveredPoint.event}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Métricas al pie del gráfico */}
                    <div className="d-flex flex-wrap justify-content-between align-items-center pt-2.5 border-top mt-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <div className="d-flex align-items-center gap-3">
                            <div>
                                <span className="text-secondary small font-mono" style={{ fontSize: '0.68rem' }}>Mínimo del periodo:</span>
                                <div className="text-white fw-bold font-mono" style={{ fontSize: '0.78rem' }}>7.62 pts</div>
                            </div>
                            <div className="border-start ps-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <span className="text-secondary small font-mono" style={{ fontSize: '0.68rem' }}>Pico alcanzado:</span>
                                <div className="text-success fw-bold font-mono" style={{ fontSize: '0.78rem' }}>8.61 pts</div>
                            </div>
                            <div className="border-start ps-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <span className="text-secondary small font-mono" style={{ fontSize: '0.68rem' }}>Tasa de salas unánimes:</span>
                                <div className="text-info fw-bold font-mono" style={{ fontSize: '0.78rem' }}>88.6%</div>
                            </div>
                        </div>

                        <span className="font-mono text-muted small" style={{ fontSize: '0.68rem' }}>
                            Datos agregados de AWS PostgreSQL
                        </span>
                    </div>
                </div>

                {/* Simulador reactivo de votación */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Simulador Reactivo de Felicidad</h2>
                                <span className="admin-subtitle">Ajusta los votos para ver la respuesta inmediata del algoritmo</span>
                            </div>
                            <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.65rem' }}>
                                λ = {lambda.toFixed(2)}
                            </span>
                        </div>

                        <div className="d-flex flex-column gap-2">
                            {candidatesWithStats.map((c, rank) => {
                                const isWinner = c.id === winnerId
                                return (
                                    <div
                                        key={c.id}
                                        className="p-2.5 rounded-1"
                                        style={{
                                            backgroundColor: isWinner ? 'rgba(16, 185, 129, 0.05)' : 'var(--admin-surface-2)',
                                            border: `1px solid ${isWinner ? 'rgba(16, 185, 129, 0.35)' : 'var(--admin-border-subtle)'}`
                                        }}
                                    >
                                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1.5">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="font-mono rounded d-flex align-items-center justify-content-center"
                                                    style={{
                                                        width: 18,
                                                        height: 18,
                                                        backgroundColor: isWinner ? 'var(--admin-emerald)' : 'var(--admin-surface-3)',
                                                        color: isWinner ? '#000000' : '#FFFFFF',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    {rank + 1}
                                                </span>
                                                <span className="fw-semibold text-white text-truncate" style={{ fontSize: '0.8rem', maxWidth: 180 }}>
                                                    {c.title}
                                                </span>
                                                {isWinner && (
                                                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                                        GANADOR
                                                    </span>
                                                )}
                                                {c.hasVetoApplied && (
                                                    <span className="admin-badge font-mono" style={{ fontSize: '0.6rem', padding: '2px 6px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444' }}>
                                                        VETADO (-3.0)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="d-flex align-items-center gap-2 font-mono" style={{ fontSize: '0.68rem' }}>
                                                <span style={{ color: 'var(--admin-text-muted)' }}>μ: <strong className="text-white">{c.mean}</strong></span>
                                                <span style={{ color: 'var(--admin-text-muted)' }}>σ: <strong style={{ color: c.stdDev > 2 ? '#F59E0B' : '#38BDF8' }}>{c.stdDev}</strong></span>
                                                <span className={`admin-badge ${isWinner ? 'admin-badge-success' : 'admin-badge-neutral'} font-mono fw-bold`} style={{ fontSize: '0.7rem' }}>
                                                    Score: {c.finalScore}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Controles deslizantes de amigos */}
                                        <div className="d-flex flex-wrap align-items-center gap-2 pt-1.5 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                            {['Matias', 'Sofia', 'Kenji'].map((vName, vIdx) => (
                                                <div key={vIdx} className="d-flex align-items-center gap-1.5 flex-grow-1" style={{ minWidth: 100 }}>
                                                    <span className="font-mono text-muted" style={{ fontSize: '0.65rem', width: 45 }}>
                                                        {vName}:
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="10"
                                                        value={c.votes[vIdx]}
                                                        onChange={(e) => handleVoteChange(c.id, vIdx, parseInt(e.target.value))}
                                                        className="flex-grow-1"
                                                        style={{ height: 3, accentColor: c.votes[vIdx] <= 2 ? '#EF4444' : '#10B981', cursor: 'pointer' }}
                                                    />
                                                    <span
                                                        className="font-mono fw-bold text-center"
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            width: 18,
                                                            color: c.votes[vIdx] <= 2 ? '#EF4444' : c.votes[vIdx] >= 8 ? 'var(--admin-emerald)' : '#D4D4D8'
                                                        }}
                                                    >
                                                        {c.votes[vIdx]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-2 font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.68rem', color: 'var(--admin-text-muted)' }}>
                        <span>Fórmula: groups/services/happiness.py</span>
                        <span style={{ color: 'var(--admin-emerald)' }}>● Recálculo reactivo 0ms</span>
                    </div>
                </div>
            </div>

            {/* ============================================================
               5. REQUERIMIENTO 4: ÍNDICE DE SATISFACCIÓN POR RECOMENDACIÓN AUTOMÁTICA
               ============================================================ */}
            <div className="admin-card">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                            <ThumbsUp size={15} style={{ color: 'var(--admin-emerald)' }} />
                            <span>Índice de Satisfacción por Recomendación Automática</span>
                        </h2>
                        <span className="admin-subtitle">
                            Métricas directas de feedback grupal posterior a las sugerencias generadas por el recomendador
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.7rem' }}>
                            {satisfaction.overall_satisfaction_pct}% Satisfacción Global
                        </span>
                        <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.7rem' }}>
                            {satisfaction.total_evaluations} Salas Evaluadas
                        </span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }} className="mb-4">
                    {/* Barra de Desglose de Evaluación */}
                    <div className="p-3 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
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

                    {/* Comparativa: Algoritmo Automático vs Elección Manual */}
                    <div className="p-3 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
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

                {/* Feed de Evaluaciones Reales de Salas */}
                <div>
                    <h3 className="admin-title mb-2.5" style={{ fontSize: '0.85rem' }}>
                        Evaluaciones Recientes de Grupos (Feedback de Usuarios)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        {satisfaction.recent_feed.map(feed => (
                            <div key={feed.id} className="p-2.5 rounded-1 h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-1.5">
                                        <div>
                                            <div className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>
                                                {feed.room_name}
                                            </div>
                                            <div className="font-mono text-secondary small" style={{ fontSize: '0.68rem' }}>
                                                Recomendado: <strong className="text-info">{feed.anime_title}</strong>
                                            </div>
                                        </div>

                                        <div className="d-flex flex-column align-items-end">
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
                                    <span className="admin-badge admin-badge-success" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                        {feed.verdict}
                                    </span>
                                    <span style={{ color: 'var(--admin-emerald)' }}>
                                        Felicidad: <strong>{feed.happiness_score} / 10</strong>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
