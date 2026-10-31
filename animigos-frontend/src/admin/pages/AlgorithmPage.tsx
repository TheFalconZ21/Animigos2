import { useState, useEffect, useMemo } from 'react'
import {
    SlidersHorizontal,
    Scale,
    TrendingUp,
    Save,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Info,
    Sparkles,
    X,
    Maximize2
} from 'lucide-react'
import { getAlgorithm, calibrateAlgorithm } from '../services/adminApi'
import type { AlgorithmResponse, AlgorithmRule, HappinessTimelinePoint } from '../services/adminApi'
import { AdminDrilldownDrawer } from '../components/AdminDrilldownDrawer'

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
    // ESTADO: Datos del Backend & UI Interactivo
    // -------------------------------------------------------------
    const [algoData, setAlgoData] = useState<AlgorithmResponse | null>(null)
    const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
    const [hoveredPoint, setHoveredPoint] = useState<HappinessTimelinePoint | null>(null)
    const [saveToast, setSaveToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' })
    const [isSaving, setIsSaving] = useState(false)
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

    // Estados independientes para las 2 carpetas comprimidas en la misma fila
    const [isWeightsExpanded, setIsWeightsExpanded] = useState(false)
    const [isRulesExpanded, setIsRulesExpanded] = useState(false)

    // Tooltip de información para sliders & popup de simulador
    const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null)
    const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false)

    // -------------------------------------------------------------
    // ESTADO: Candidatos en el Simulador
    // -------------------------------------------------------------
    const [candidates, setCandidates] = useState<CandidateAnime[]>([
        { id: '1', title: "Frieren: Beyond Journey's End", votes: [9, 8, 9], malScore: 9.38, polarization: 1.05, genreAffinity: 0.8 },
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
    // CÁLCULO REACTIVO DEL SIMULADOR SEGÚN PESOS Y REGLAS ACTIVAS
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

        // R1: Veto si alguien vota ≤ 2
        if (hasVetoRule && votes.some(v => v <= 2)) {
            penalty += 3.0
        }

        // R2: Supermayoría si ≥ 75% vota ≥ 7
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

        // Fórmula calibrada completa
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

    // Datos de satisfacción tomados para los micro-KPIs superiores
    const satisfaction = algoData?.recommendation_satisfaction || {
        overall_satisfaction_pct: 89.4,
        acceptance_rate: 92.1
    }

    // Coordenadas SVG para el gráfico temporal (full width)
    const svgWidth = 840
    const svgHeight = 210
    const padding = { top: 25, right: 35, bottom: 35, left: 45 }
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

    // Helper renderizador para sliders comprimidos con tooltip modal/popover (i)
    const renderSliderWithInfo = (
        id: string,
        label: string,
        code: string,
        val: number,
        setVal: (n: number) => void,
        min: number,
        max: number,
        step: number,
        minLabel: string,
        maxLabel: string,
        accentColor: string,
        description: string,
        displayDecimals: number = 2
    ) => {
        const isTooltipOpen = activeTooltipId === id
        return (
            <div className="p-2.5 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="d-flex align-items-center gap-1.5 position-relative">
                        <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>
                            {label} <span className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>({code})</span>
                        </span>
                        <button
                            type="button"
                            aria-label={`Información sobre ${label}`}
                            className="btn p-0 border-0 d-inline-flex align-items-center text-secondary"
                            style={{ cursor: 'pointer', lineHeight: 1 }}
                            onClick={(e) => {
                                e.stopPropagation()
                                setActiveTooltipId(isTooltipOpen ? null : id)
                            }}
                            onMouseEnter={() => setActiveTooltipId(id)}
                            onMouseLeave={() => setActiveTooltipId(null)}
                        >
                            <Info size={13} style={{ color: isTooltipOpen ? 'var(--admin-emerald)' : 'var(--admin-text-muted)' }} />
                        </button>

                        {isTooltipOpen && (
                            <div
                                className="position-absolute p-2 rounded shadow-lg font-sans"
                                style={{
                                    bottom: '125%',
                                    left: 0,
                                    minWidth: 220,
                                    maxWidth: 270,
                                    backgroundColor: '#18181B',
                                    border: '1px solid var(--admin-border-divider)',
                                    color: '#E4E4E7',
                                    fontSize: '0.7rem',
                                    zIndex: 120,
                                    lineHeight: 1.35,
                                    pointerEvents: 'none',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                                }}
                            >
                                <div className="fw-semibold text-white mb-0.5">{label}</div>
                                {description}
                            </div>
                        )}
                    </div>

                    <span className="font-mono fw-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.75rem' }}>
                        {val.toFixed(displayDecimals)}
                    </span>
                </div>

                <input
                    id={`slider-${id}`}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => setVal(parseFloat(e.target.value))}
                    className="w-100 my-1"
                    style={{ accentColor, cursor: 'pointer', height: 4 }}
                />
                <div className="d-flex justify-content-between font-mono text-muted" style={{ fontSize: '0.62rem' }}>
                    <span>{minLabel}</span>
                    <span>{maxLabel}</span>
                </div>
            </div>
        )
    }

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
               1. MICRO-KPIS CURADOS (En la misma fila manteniendo responsividad)
               ============================================================ */}
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
                            Felicidad Media
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{algoData?.stats.average_group_happiness || 8.48}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>/ 10</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                        {algoData?.stats.happiness_trend_delta || '+0.42'} vs mes ant.
                    </span>
                </div>

                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.64rem', letterSpacing: '0.05em' }}>
                            Satisfacción de Recomendación
                        </span>
                        <span className="fs-4 fw-bold text-white font-mono">{satisfaction.overall_satisfaction_pct}%</span>
                    </div>
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                        Alta afinidad
                    </span>
                </div>

                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.64rem', letterSpacing: '0.05em' }}>
                            Tasa de Consenso en Ronda 1
                        </span>
                        <span className="fs-4 fw-bold text-white font-mono">{satisfaction.acceptance_rate}%</span>
                    </div>
                    <span className="admin-badge admin-badge-purple font-mono" style={{ fontSize: '0.68rem' }}>
                        Sin desempate
                    </span>
                </div>
            </div>

            {/* ============================================================
               2. VISUALIZACIÓN PROTAGONISTA: GRÁFICO TEMPORAL DE FELICIDAD
                  (Por sobre la configuración del algoritmo - Ref Imagen 3 y 4)
               ============================================================ */}
            <div className="admin-card mb-4">
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

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsSimulatorModalOpen(true)}
                            className="admin-btn d-flex align-items-center gap-1.5 font-mono"
                            style={{
                                backgroundColor: 'var(--admin-emerald-bg)',
                                border: '1px solid var(--admin-emerald-border)',
                                color: 'var(--admin-emerald)',
                                fontSize: '0.74rem',
                                padding: '5px 12px'
                            }}
                        >
                            <Sparkles size={13} />
                            <span>Lanzar Simulador Reactivo</span>
                        </button>

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
                </div>

                {/* Canvas / SVG Chart OLED */}
                <div className="position-relative" style={{ width: '100%', height: svgHeight, overflow: 'hidden' }}>
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-100 h-100"
                        style={{ display: 'block' }}
                        preserveAspectRatio="none"
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

            {/* ============================================================
               3. BARRA DE ACCIÓN: FÓRMULA Y GUARDAR CALIBRACIÓN
                  (Ubicada sobre las carpetas - Ref Imagen 4)
               ============================================================ */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.74rem', padding: '6px 14px' }}>
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
                        padding: '7px 16px',
                        borderRadius: 'var(--radius-md)'
                    }}
                >
                    <Save size={14} />
                    {isSaving ? 'Guardando...' : 'Guardar Calibración'}
                </button>
            </div>

            {/* ============================================================
               4. DOS CARPETAS DE CONFIGURACIÓN EN LA MISMA FILA
                  (Carpeta 1: Calibración y Ponderación Matemática
                   Carpeta 2: Reglas de Consenso - Ref Imagen 1 y 4)
               ============================================================ */}
            <div className="row g-3 mb-4">
                {/* CARPETA 1: Calibración y Ponderación Matemática */}
                <div className="col-12 col-xl-6">
                    <div className="admin-card p-0 overflow-hidden h-100" style={{ border: '1px solid var(--admin-border-subtle)' }}>
                        <div
                            className="d-flex flex-wrap justify-content-between align-items-center px-3.5 py-2.5"
                            style={{
                                backgroundColor: 'var(--admin-surface-2)',
                                cursor: 'pointer',
                                borderBottom: isWeightsExpanded ? '1px solid var(--admin-border-subtle)' : 'none',
                                userSelect: 'none'
                            }}
                            onClick={() => setIsWeightsExpanded(!isWeightsExpanded)}
                        >
                            <div className="d-flex align-items-center gap-2.5">
                                <div
                                    className="d-flex align-items-center justify-content-center rounded"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        backgroundColor: 'var(--admin-surface-3)',
                                        border: '1px solid var(--admin-border-subtle)',
                                        color: 'var(--admin-emerald)'
                                    }}
                                >
                                    <SlidersHorizontal size={14} />
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-1.5">
                                        <span className="fw-semibold text-white" style={{ fontSize: '0.84rem' }}>
                                            Calibración y Ponderación Matemática
                                        </span>
                                        <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.6rem' }}>
                                            {isWeightsExpanded ? 'Expandido' : 'Comprimido (Carpeta)'}
                                        </span>
                                    </div>
                                    <span className="admin-subtitle" style={{ fontSize: '0.68rem' }}>
                                        Ponderaciones matemáticas (6 sliders con tooltip informativo)
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                                style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsWeightsExpanded(!isWeightsExpanded)
                                }}
                            >
                                {isWeightsExpanded ? (
                                    <>
                                        <ChevronUp size={12} />
                                        <span>Comprimir</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={12} />
                                        <span>Abrir Configuración</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Contenido de Carpeta 1 */}
                        {isWeightsExpanded && (
                            <div className="p-3">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-2.5 pb-2 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span className="admin-subtitle font-mono" style={{ fontSize: '0.68rem' }}>Presets automáticos:</span>
                                    <div className="d-flex align-items-center gap-1 font-mono">
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('standard')}
                                            className="btn btn-sm btn-outline-secondary font-mono"
                                            style={{ fontSize: '0.64rem', padding: '2px 6px', color: '#D4D4D8', borderColor: 'var(--admin-border-subtle)' }}
                                        >
                                            Estándar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('strict_anti_veto')}
                                            className="btn btn-sm btn-outline-secondary font-mono"
                                            style={{ fontSize: '0.64rem', padding: '2px 6px', color: '#D4D4D8', borderColor: 'var(--admin-border-subtle)' }}
                                        >
                                            Antidiscordia
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyPreset('discovery')}
                                            className="btn btn-sm btn-outline-secondary font-mono"
                                            style={{ fontSize: '0.64rem', padding: '2px 6px', color: '#D4D4D8', borderColor: 'var(--admin-border-subtle)' }}
                                        >
                                            Crítico
                                        </button>
                                    </div>
                                </div>

                                <div className="row g-2">
                                    <div className="col-12 col-sm-6">
                                        {renderSliderWithInfo('weight-mean', 'Media de Interés', 'w_μ', weightMean, setWeightMean, 0.5, 2.0, 0.05, '0.50 (Suave)', '2.00 (Dominante)', '#10B981', 'Ponderación del promedio directo de votos del grupo.')}
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        {renderSliderWithInfo('lambda', 'Aversión a la Dispersión', 'λ', lambda, setLambda, 0.0, 1.0, 0.02, '0.00 (Tolerante)', '1.00 (Aversión total)', '#38BDF8', 'Penalización aplicada a la desviación estándar (σ) entre amigos.')}
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        {renderSliderWithInfo('weight-pol', 'Freno a Polarización', 'β', weightPol, setWeightPol, 0.0, 0.8, 0.05, '0.00 (Ignorar)', '0.80 (Anti-controversia)', '#F59E0B', 'Castigo a animes con alta controversia histórica externa (Dataset σ).')}
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        {renderSliderWithInfo('weight-mal', 'Crítica Externa', 'w_mal', weightMal, setWeightMal, 0.0, 0.5, 0.05, '0.00 (Solo grupo)', '0.50 (Influencia alta)', '#A855F7', 'Aporte de la calificación histórica canónica de MyAnimeList.')}
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        {renderSliderWithInfo('weight-aff', 'Afinidad de Géneros', 'w_af', weightAffinity, setWeightAffinity, 0.0, 1.5, 0.05, '0.00 (Neutral)', '1.50 (Máxima afinidad)', '#EC4899', 'Multiplicador por coincidencia con géneros favoritos de los perfiles.')}
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        {renderSliderWithInfo('tie-thresh', 'Umbral de Desempate', 'ε', tieThreshold, setTieThreshold, 0.05, 0.5, 0.01, '0.05 (Estricto)', '0.50 (Flexible)', '#14B8A6', 'Margen de diferencia de score que activa el criterio canónico de desempate.')}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* CARPETA 2: Reglas de Consenso */}
                <div className="col-12 col-xl-6">
                    <div className="admin-card p-0 overflow-hidden h-100" style={{ border: '1px solid var(--admin-border-subtle)' }}>
                        <div
                            className="d-flex flex-wrap justify-content-between align-items-center px-3.5 py-2.5"
                            style={{
                                backgroundColor: 'var(--admin-surface-2)',
                                cursor: 'pointer',
                                borderBottom: isRulesExpanded ? '1px solid var(--admin-border-subtle)' : 'none',
                                userSelect: 'none'
                            }}
                            onClick={() => setIsRulesExpanded(!isRulesExpanded)}
                        >
                            <div className="d-flex align-items-center gap-2.5">
                                <div
                                    className="d-flex align-items-center justify-content-center rounded"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        backgroundColor: 'var(--admin-surface-3)',
                                        border: '1px solid var(--admin-border-subtle)',
                                        color: 'var(--admin-emerald)'
                                    }}
                                >
                                    <Scale size={14} />
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-1.5">
                                        <span className="fw-semibold text-white" style={{ fontSize: '0.84rem' }}>
                                            Reglas de Consenso
                                        </span>
                                        <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.6rem' }}>
                                            {isRulesExpanded ? 'Expandido' : 'Comprimido (Carpeta)'}
                                        </span>
                                    </div>
                                    <span className="admin-subtitle" style={{ fontSize: '0.68rem' }}>
                                        Filtros de salas ({rules.filter(r => r.active).length} activas / {rules.filter(r => !r.active).length} inactivas)
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                                style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsRulesExpanded(!isRulesExpanded)
                                }}
                            >
                                {isRulesExpanded ? (
                                    <>
                                        <ChevronUp size={12} />
                                        <span>Comprimir</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={12} />
                                        <span>Abrir Reglas</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Contenido de Carpeta 2 */}
                        {isRulesExpanded && (
                            <div className="p-3">
                                <div className="row g-2">
                                    {rules.map(rule => (
                                        <div key={rule.id} className="col-12 col-sm-6">
                                            <div
                                                className="p-2.5 rounded-1 h-100 d-flex flex-column justify-content-between transition-all"
                                                style={{
                                                    backgroundColor: rule.active ? 'rgba(16, 185, 129, 0.04)' : 'var(--admin-surface-2)',
                                                    border: `1px solid ${rule.active ? 'rgba(16, 185, 129, 0.35)' : 'var(--admin-border-subtle)'}`
                                                }}
                                            >
                                                <div>
                                                    <div className="d-flex justify-content-between align-items-start gap-1 mb-1">
                                                        <div className="d-flex align-items-center gap-1 overflow-hidden">
                                                            <span
                                                                className="font-mono rounded px-1.5 py-0.5 fw-bold flex-shrink-0"
                                                                style={{
                                                                    fontSize: '0.62rem',
                                                                    backgroundColor: rule.active ? 'rgba(16, 185, 129, 0.2)' : 'var(--admin-surface-3)',
                                                                    color: rule.active ? 'var(--admin-emerald)' : 'var(--admin-text-muted)'
                                                                }}
                                                            >
                                                                {rule.id}
                                                            </span>
                                                            <span className="fw-semibold text-white text-truncate" style={{ fontSize: '0.74rem' }} title={rule.name}>
                                                                {rule.name}
                                                            </span>
                                                        </div>

                                                        <div className="form-check form-switch m-0 flex-shrink-0">
                                                            <input
                                                                id={`toggle-rule-${rule.id}`}
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                checked={rule.active}
                                                                onChange={() => handleToggleRule(rule.id)}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    backgroundColor: rule.active ? 'var(--admin-emerald)' : 'var(--admin-surface-3)',
                                                                    borderColor: rule.active ? 'var(--admin-emerald)' : 'var(--admin-border-subtle)',
                                                                    width: '1.8em',
                                                                    height: '0.95em'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="font-mono mb-1 text-truncate" style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)' }} title={rule.condition}>
                                                        <span style={{ color: 'var(--admin-text-muted)' }}>Condición: </span>
                                                        {rule.condition}
                                                    </div>
                                                </div>

                                                <div
                                                    className="pt-1.5 border-top mt-1 d-flex align-items-center justify-content-between font-mono"
                                                    style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.64rem' }}
                                                >
                                                    <span className="text-truncate me-1" style={{ color: rule.active ? 'var(--admin-emerald)' : 'var(--admin-text-muted)' }} title={rule.effect}>
                                                        → {rule.effect}
                                                    </span>
                                                    <span
                                                        className={`badge ${rule.active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}
                                                        style={{ fontSize: '0.58rem', padding: '2px 4px' }}
                                                    >
                                                        {rule.active ? 'ACTIVA' : 'INACTIVA'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================================
               5. POP-UP MODAL: SIMULADOR REACTIVO DE FELICIDAD
               ============================================================ */}
            {isSimulatorModalOpen && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.78)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 1050
                    }}
                    onClick={() => setIsSimulatorModalOpen(false)}
                >
                    <div
                        className="admin-card w-100 p-4"
                        style={{
                            maxWidth: 860,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            border: '1px solid var(--admin-border-divider)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-start mb-3 pb-2.5 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="p-1.5 rounded-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'var(--admin-emerald-bg)', border: '1px solid var(--admin-emerald-border)', color: 'var(--admin-emerald)' }}>
                                        <Sparkles size={16} />
                                    </span>
                                    <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                        Simulador Reactivo de Felicidad Grupal
                                    </h2>
                                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.65rem' }}>
                                        λ = {lambda.toFixed(2)}
                                    </span>
                                </div>
                                <span className="admin-subtitle d-block mt-1">
                                    Ajusta en tiempo real los votos de los miembros del grupo para observar el impacto inmediato del algoritmo.
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-link text-muted p-1"
                                onClick={() => setIsSimulatorModalOpen(false)}
                                aria-label="Cerrar Simulador"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Listado de candidatos */}
                        <div className="d-flex flex-column gap-2.5 mb-3">
                            {candidatesWithStats.map((c, rank) => {
                                const isWinner = c.id === winnerId
                                return (
                                    <div
                                        key={c.id}
                                        className="p-3 rounded-2"
                                        style={{
                                            backgroundColor: isWinner ? 'rgba(16, 185, 129, 0.05)' : 'var(--admin-surface-2)',
                                            border: `1px solid ${isWinner ? 'rgba(16, 185, 129, 0.35)' : 'var(--admin-border-subtle)'}`
                                        }}
                                    >
                                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="font-mono rounded d-flex align-items-center justify-content-center"
                                                    style={{
                                                        width: 22,
                                                        height: 22,
                                                        backgroundColor: isWinner ? 'var(--admin-emerald)' : 'var(--admin-surface-3)',
                                                        color: isWinner ? '#000000' : '#FFFFFF',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    {rank + 1}
                                                </span>
                                                <span className="fw-semibold text-white text-truncate" style={{ fontSize: '0.85rem', maxWidth: 220 }}>
                                                    {c.title}
                                                </span>
                                                {isWinner && (
                                                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
                                                        GANADOR
                                                    </span>
                                                )}
                                                {c.hasVetoApplied && (
                                                    <span className="admin-badge font-mono" style={{ fontSize: '0.62rem', padding: '2px 8px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444' }}>
                                                        VETADO (-3.0)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="d-flex align-items-center gap-2 font-mono" style={{ fontSize: '0.72rem' }}>
                                                <span style={{ color: 'var(--admin-text-muted)' }}>μ: <strong className="text-white">{c.mean}</strong></span>
                                                <span style={{ color: 'var(--admin-text-muted)' }}>σ: <strong style={{ color: c.stdDev > 2 ? '#F59E0B' : '#38BDF8' }}>{c.stdDev}</strong></span>
                                                <span className={`admin-badge ${isWinner ? 'admin-badge-success' : 'admin-badge-neutral'} font-mono fw-bold`} style={{ fontSize: '0.72rem' }}>
                                                    Score: {c.finalScore}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCandidateId(c.id)
                                                    }}
                                                    className="btn btn-sm btn-outline-secondary p-1 font-mono text-white d-flex align-items-center gap-1"
                                                    style={{ fontSize: '0.65rem', borderColor: 'var(--admin-border-subtle)' }}
                                                    title="Ver desglose matemático completo"
                                                >
                                                    <Maximize2 size={11} />
                                                    <span>Desglose</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Controles deslizantes de amigos */}
                                        <div className="d-flex flex-wrap align-items-center gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                            {['Matias', 'Sofia', 'Kenji'].map((vName, vIdx) => (
                                                <div key={vIdx} className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 120 }}>
                                                    <span className="font-mono text-muted" style={{ fontSize: '0.7rem', width: 48 }}>
                                                        {vName}:
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="10"
                                                        value={c.votes[vIdx]}
                                                        onChange={(e) => handleVoteChange(c.id, vIdx, parseInt(e.target.value))}
                                                        className="flex-grow-1"
                                                        style={{ height: 4, accentColor: c.votes[vIdx] <= 2 ? '#EF4444' : '#10B981', cursor: 'pointer' }}
                                                    />
                                                    <span
                                                        className="font-mono fw-bold text-center"
                                                        style={{
                                                            fontSize: '0.78rem',
                                                            width: 22,
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

                        <div className="d-flex justify-content-between align-items-center pt-2.5 border-top font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                            <span>Fórmula de consenso: groups/services/happiness.py</span>
                            <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                onClick={() => setIsSimulatorModalOpen(false)}
                            >
                                Cerrar Simulador
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DRAWER LATERAL DE DRILL-DOWN MATEMÁTICO */}
            <AdminDrilldownDrawer
                isOpen={!!selectedCandidateId}
                onClose={() => setSelectedCandidateId(null)}
                title={candidatesWithStats.find(c => c.id === selectedCandidateId)?.title || 'Desglose del Candidato'}
                subtitle="Inspección detallada de la función de utilidad colectiva y penalizaciones σ"
                badgeText={candidatesWithStats.find(c => c.id === selectedCandidateId)?.id === winnerId ? 'Ganador de la Sala' : 'Candidato'}
                badgeType={candidatesWithStats.find(c => c.id === selectedCandidateId)?.id === winnerId ? 'success' : 'neutral'}
            >
                {(() => {
                    const c = candidatesWithStats.find(cand => cand.id === selectedCandidateId)
                    if (!c) return null
                    return (
                        <div className="d-flex flex-column gap-3.5">
                            {/* Score Final y Fórmula */}
                            <div className="p-3 rounded-2 text-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <span className="admin-subtitle text-uppercase font-mono" style={{ fontSize: '0.68rem' }}>Score de Utilidad Colectiva</span>
                                <div className="fs-1 fw-bold text-white font-mono my-1">{c.finalScore}</div>
                                <span className="font-mono text-muted small" style={{ fontSize: '0.72rem' }}>
                                    Fórmula: ({c.mean} × {weightMean.toFixed(2)}) - ({c.stdDev} × {lambda.toFixed(2)}) + ({c.genreAffinity} × {weightAffinity.toFixed(2)})
                                </span>
                            </div>

                            {/* Votos individuales de los miembros */}
                            <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="fw-semibold text-white" style={{ fontSize: '0.82rem' }}>Votos Individuales de la Sala</span>
                                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.64rem' }}>{c.votes.length} participantes</span>
                                </div>
                                <div className="d-flex gap-2">
                                    {c.votes.map((v, i) => (
                                        <div key={i} className="flex-grow-1 p-2 rounded text-center" style={{ backgroundColor: 'var(--admin-surface-3)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <span className="admin-subtitle d-block" style={{ fontSize: '0.66rem' }}>Miembro {i+1}</span>
                                            <span className="fs-5 fw-bold font-mono text-white">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Factores Matemáticos Clave */}
                            <div className="d-flex flex-column gap-2">
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="text-secondary small">Media Aritmética (μ):</span>
                                    <span className="font-mono text-white fw-bold">{c.mean} pts</span>
                                </div>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="text-secondary small">Dispersión Estándar (σ):</span>
                                    <span className="font-mono fw-bold" style={{ color: c.stdDev > 2 ? '#F59E0B' : '#38BDF8' }}>{c.stdDev}</span>
                                </div>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="text-secondary small">Puntaje Canónico MAL:</span>
                                    <span className="font-mono text-white">{c.malScore} / 10</span>
                                </div>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="text-secondary small">Afinidad de Género Grupal:</span>
                                    <span className="font-mono text-emerald" style={{ color: 'var(--admin-emerald)' }}>+{(c.genreAffinity * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Alerta si tiene veto aplicado */}
                            {c.hasVetoApplied && (
                                <div className="p-3 rounded-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171' }}>
                                    <strong>Filtro Antiveto Activado:</strong> Un participante votó ≤ 2, aplicando una deducción punitiva de -3.0 pts para proteger la armonía de la sala.
                                </div>
                            )}
                        </div>
                    )
                })()}
            </AdminDrilldownDrawer>
        </div>
    )
}
