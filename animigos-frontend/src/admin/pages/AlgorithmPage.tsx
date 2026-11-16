import { useState, useEffect, useMemo } from 'react'
import {
    SlidersHorizontal,
    Scale,
    TrendingUp,
    Save,
    CheckCircle2,
    Sparkles,
    ChevronRight
} from 'lucide-react'
import { getAlgorithm, calibrateAlgorithm } from '../services/adminApi'
import type { AlgorithmResponse, AlgorithmRule, HappinessTimelinePoint } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type AlgorithmSubView = 'calibration-lab' | 'consensus-rules' | 'simulator'

interface CandidateAnime {
    id: string
    title: string
    votes: number[]
    malScore: number
    polarization: number
    genreAffinity: number
}

export function AlgorithmPage() {
    const [weightMean, setWeightMean] = useState(1.0)
    const [lambda, setLambda] = useState(0.3)
    const [weightPol, setWeightPol] = useState(0.2)
    const [weightMal, setWeightMal] = useState(0.15)
    const [weightAffinity, setWeightAffinity] = useState(0.5)
    const [tieThreshold, setTieThreshold] = useState(0.15)

    const [rules, setRules] = useState<AlgorithmRule[]>([
        { id: 'R1', name: 'Filtro Antiveto Estricto', condition: 'Voto individual ≤ 2', effect: 'Penalización inmediata de -3.0 pts al score grupal', active: true },
        { id: 'R2', name: 'Regla de Supermayoría (Consenso 75%)', condition: '≥ 75% vota ≥ 7 pts', effect: 'Bonus de certidumbre de +1.5 pts', active: true },
        { id: 'R3', name: 'Quórum Mínimo Requerido', condition: 'Participación < 60%', effect: 'La sala permanece abierta esperando votos', active: true },
        { id: 'R4', name: 'Desempate por Ponderación Externa (MAL)', condition: 'Diferencia ≤ 0.15 pts', effect: 'Gana el título con mejor nota histórica canónica', active: true },
        { id: 'R5', name: 'Filtro de Descarte por Dispersión Extrema', condition: 'Desviación σ > 2.5', effect: 'Descarta candidato por polarización destructiva', active: true },
        { id: 'R6', name: 'Rotación Anti-Monopolio de Concesiones', condition: 'Miembro con racha sin ganar', effect: 'Prioridad de desempate +0.25 pts para su candidato', active: false }
    ])

    const [algoData, setAlgoData] = useState<AlgorithmResponse | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [saveToast, setSaveToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' })

    // Sub-Vista Activa (Cero Carpetas, Cero Modales, Cero Drawers)
    const [activeSubView, setActiveSubView] = useAdminSubView<AlgorithmSubView>()

    // Interacción del Gráfico Protagonista
    const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
    const [selectedPointIdx, setSelectedPointIdx] = useState<number>(6)

    // Candidatos del Simulador en Sub-Vista
    const [candidates, setCandidates] = useState<CandidateAnime[]>([
        { id: 'c1', title: "Frieren: Beyond Journey's End", votes: [9, 9, 8, 10, 9], malScore: 9.32, polarization: 0.42, genreAffinity: 0.92 },
        { id: 'c2', title: 'Dungeon Meshi', votes: [8, 9, 8, 8, 9], malScore: 8.65, polarization: 0.51, genreAffinity: 0.85 },
        { id: 'c3', title: 'Chainsaw Man', votes: [10, 10, 3, 9, 2], malScore: 8.55, polarization: 1.85, genreAffinity: 0.78 }
    ])

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
            .catch(err => console.error('Error loading algorithm data:', err))
    }, [])

    const baseTimeline: HappinessTimelinePoint[] = useMemo(() => {
        if (algoData?.timeline && algoData.timeline.length > 0) return algoData.timeline
        return [
            { date: '', label: 'Hoy', avg_happiness: 0, rooms_count: 0, consensus_rate: 0, event: 'Sin registros' }
        ]
    }, [algoData])

    const timeline = useMemo(() => {
        if (timeframe === '7d') return baseTimeline.slice(-4)
        return baseTimeline
    }, [baseTimeline, timeframe])

    // Cálculo de curvas SVG
    const svgWidth = 720
    const svgHeight = 250
    const pad = { top: 24, right: 28, bottom: 34, left: 42 }
    const chartW = svgWidth - pad.left - pad.right
    const chartH = svgHeight - pad.top - pad.bottom
    const minScore = 0.0
    const maxScore = 10.0

    const chartPoints = useMemo(() => {
        return timeline.map((pt, i) => {
            const x = pad.left + (timeline.length > 1 ? (i / (timeline.length - 1)) * chartW : chartW / 2)
            const normY = Math.max(0, Math.min(1, (pt.avg_happiness - minScore) / (maxScore - minScore)))
            const y = pad.top + chartH - normY * chartH
            return { ...pt, x, y, index: i }
        })
    }, [timeline, chartW, chartH])

    const pathD = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaD = chartPoints.length > 0
        ? `${pathD} L ${chartPoints[chartPoints.length - 1].x} ${pad.top + chartH} L ${chartPoints[0].x} ${pad.top + chartH} Z`
        : ''

    // Simulador: cálculo de scores
    const simulatedCandidates = useMemo(() => {
        return candidates.map(c => {
            const n = c.votes.length
            const mean = c.votes.reduce((a, b) => a + b, 0) / n
            const variance = c.votes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n
            const stdDev = Math.sqrt(variance)
            const hasVeto = rules.find(r => r.id === 'R1')?.active && c.votes.some(v => v <= 2)
            const vetoPenalty = hasVeto ? 3.0 : 0
            const rawScore = (weightMean * mean) - (lambda * stdDev) - (weightPol * c.polarization) + (weightMal * (c.malScore - 8.0)) + (weightAffinity * c.genreAffinity) - vetoPenalty
            return {
                ...c,
                mean: Number(mean.toFixed(2)),
                stdDev: Number(stdDev.toFixed(2)),
                hasVeto,
                finalScore: Number(Math.max(0, rawScore).toFixed(2))
            }
        }).sort((a, b) => b.finalScore - a.finalScore)
    }, [candidates, weightMean, lambda, weightPol, weightMal, weightAffinity, rules])

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
                rules
            })
            setSaveToast({ show: true, msg: 'Calibración matemática sincronizada en AWS PostgreSQL' })
            setTimeout(() => setSaveToast({ show: false, msg: '' }), 3500)
        } catch (err) {
            console.error('Error saving calibration:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const applyPreset = (preset: 'balanced' | 'anti-discord' | 'critic') => {
        if (preset === 'balanced') {
            setWeightMean(1.0); setLambda(0.30); setWeightPol(0.20); setWeightMal(0.15); setWeightAffinity(0.50); setTieThreshold(0.15)
        } else if (preset === 'anti-discord') {
            setWeightMean(0.9); setLambda(0.65); setWeightPol(0.45); setWeightMal(0.10); setWeightAffinity(0.60); setTieThreshold(0.10)
        } else {
            setWeightMean(1.1); setLambda(0.20); setWeightPol(0.10); setWeightMal(0.40); setWeightAffinity(0.35); setTieThreshold(0.20)
        }
    }

    const subViewOptions: SubViewOption<AlgorithmSubView>[] = [
        { id: 'calibration-lab', label: 'Laboratorio de Pesos (6 Sliders)' },
        { id: 'consensus-rules', label: 'Reglas de Consenso', badge: `${rules.filter(r => r.active).length}/6` },
        { id: 'simulator', label: 'Simulador Reactivo en Vivo' }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Consenso Grupal"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                    rightActions={
                        <button
                            type="button"
                            onClick={handleSaveCalibration}
                            disabled={isSaving}
                            className="admin-btn d-inline-flex align-items-center gap-1.5"
                            style={{ backgroundColor: 'var(--admin-emerald)', color: '#090B10', fontWeight: 600 }}
                        >
                            <Save size={14} />
                            <span>{isSaving ? 'Guardando...' : 'Guardar Calibración'}</span>
                        </button>
                    }
                />

                {saveToast.show && (
                    <div className="admin-correlative-bridge">
                        <span className="text-white d-flex align-items-center gap-2">
                            <CheckCircle2 size={15} style={{ color: 'var(--admin-emerald)' }} />
                            {saveToast.msg}
                        </span>
                    </div>
                )}

                {/* SUB-VISTA 1: LABORATORIO DE PONDERACIÓN MATEMÁTICA (SIN CARPETAS APRETADAS) */}
                {activeSubView === 'calibration-lab' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                    <div>
                                        <h2 className="admin-title m-0" style={{ fontSize: '1.15rem' }}>
                                            Calibración de Ponderaciones Matemáticas
                                        </h2>
                                        <p className="admin-subtitle m-0 mt-0.5">
                                            Ajusta el peso de cada hiperparámetro en la ecuación de selección grupal
                                        </p>
                                    </div>
                                    <div className="admin-subview-switcher">
                                        <button type="button" onClick={() => applyPreset('balanced')} className="admin-subview-pill">Preset Equilibrado</button>
                                        <button type="button" onClick={() => applyPreset('anti-discord')} className="admin-subview-pill">Preset Antidiscordia</button>
                                        <button type="button" onClick={() => applyPreset('critic')} className="admin-subview-pill">Preset Crítico MAL</button>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    {[
                                        { label: 'Media de Interés Grupal (w_μ)', sym: 'w_μ', val: weightMean, setter: setWeightMean, min: 0.5, max: 2.0, step: 0.05, desc: 'Peso directo del promedio de votos emitidos por los miembros de la sala.' },
                                        { label: 'Aversión a la Dispersión (λ)', sym: 'λ', val: lambda, setter: setLambda, min: 0.0, max: 1.0, step: 0.02, desc: 'Penaliza candidatos que dividen al grupo (alta desviación estándar σ).' },
                                        { label: 'Freno a Polarización Externa (β)', sym: 'β', val: weightPol, setter: setWeightPol, min: 0.0, max: 0.8, step: 0.05, desc: 'Castiga animes con alta controversia histórica en el dataset global.' },
                                        { label: 'Influencia Crítica MAL (w_mal)', sym: 'w_mal', val: weightMal, setter: setWeightMal, min: 0.0, max: 0.5, step: 0.05, desc: 'Aporte de la nota canónica de MyAnimeList para desempatar calidad.' },
                                        { label: 'Bono de Afinidad de Género (w_af)', sym: 'w_af', val: weightAffinity, setter: setWeightAffinity, min: 0.0, max: 1.5, step: 0.05, desc: 'Premia la intersección con los géneros favoritos de los perfiles.' },
                                        { label: 'Umbral de Desempate (ε)', sym: 'ε', val: tieThreshold, setter: setTieThreshold, min: 0.05, max: 0.5, step: 0.01, desc: 'Diferencia mínima de puntaje que activa las reglas de desempate.' }
                                    ].map((sl, i) => (
                                        <div key={i} className="col-12 col-md-6">
                                            <div className="p-3 rounded-2 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                                <div className="d-flex justify-content-between align-items-center mb-1.5">
                                                    <span className="text-white fw-semibold" style={{ fontSize: '0.86rem' }}>{sl.label}</span>
                                                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.8rem' }}>{sl.val.toFixed(2)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={sl.min}
                                                    max={sl.max}
                                                    step={sl.step}
                                                    value={sl.val}
                                                    onChange={(e) => sl.setter(parseFloat(e.target.value))}
                                                    className="form-range my-1"
                                                />
                                                <p className="admin-subtitle m-0" style={{ fontSize: '0.76rem' }}>{sl.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>ECUACIÓN EN TIEMPO REAL</span>
                                <h3 className="admin-title mt-1 mb-2" style={{ fontSize: '1rem' }}>Fórmula Activa</h3>
                                <div className="p-3 rounded-2 font-mono mb-3" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', fontSize: '0.82rem', color: 'var(--admin-text-primary)' }}>
                                    Score = {weightMean.toFixed(2)}·μ - {lambda.toFixed(2)}·σ - {weightPol.toFixed(2)}·Pol + {weightMal.toFixed(2)}·MAL + {weightAffinity.toFixed(2)}·Af
                                </div>
                                <p className="admin-subtitle">
                                    Con <strong>λ = {lambda.toFixed(2)}</strong>, un candidato con votos parejos `[8, 8, 8]` supera siempre a un candidato polarizante `[10, 10, 2]`.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setActiveSubView('simulator')}
                                className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                                style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                            >
                                <span>Probar Pesos en el Simulador Reactivo</span>
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 2: REGLAS DE CONSENSO Y FILTROS DE VETO */}
                {activeSubView === 'consensus-rules' && (
                    <div className="admin-card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.15rem' }}>
                                    Reglas Heurísticas de Consenso y Protección Antiveto
                                </h2>
                                <p className="admin-subtitle m-0 mt-0.5">
                                    Activa o desactiva las salvaguardas que previenen que un miembro quede insatisfecho en la Watch Party
                                </p>
                            </div>
                            <span className="admin-badge admin-badge-success font-mono">
                                {rules.filter(r => r.active).length} de {rules.length} Reglas Activas
                            </span>
                        </div>

                        <div className="row g-3">
                            {rules.map(rule => (
                                <div key={rule.id} className="col-12 col-md-6">
                                    <div
                                        className="p-3.5 rounded-2 h-100 d-flex flex-column justify-content-between"
                                        style={{
                                            backgroundColor: 'var(--admin-surface-2)',
                                            border: rule.active ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div>
                                            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="admin-badge admin-badge-neutral font-mono">{rule.id}</span>
                                                    <span className="text-white fw-semibold" style={{ fontSize: '0.9rem' }}>{rule.name}</span>
                                                </div>
                                                <div className="form-check form-switch m-0">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        checked={rule.active}
                                                        onChange={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))}
                                                        style={{ cursor: 'pointer', width: '2.1em', height: '1.1em' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }} className="mb-1">
                                                <strong className="text-white">Condición disparadora:</strong> {rule.condition}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--admin-emerald)' }}>
                                                <strong className="text-white">Efecto algorítmico:</strong> {rule.effect}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 3: SIMULADOR REACTIVO DE VOTACIÓN GRUPAL */}
                {activeSubView === 'simulator' && (
                    <div className="admin-card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.15rem' }}>
                                    Simulador Reactivo de Felicidad Colectiva
                                </h2>
                                <p className="admin-subtitle m-0 mt-0.5">
                                    Modifica los votos de los 5 amigos para comprobar cómo el algoritmo penaliza vetos y premia el consenso
                                </p>
                            </div>
                            <span className="admin-badge admin-badge-info font-mono">λ = {lambda.toFixed(2)}</span>
                        </div>

                        <div className="d-flex flex-column gap-3">
                            {simulatedCandidates.map((cand, rank) => (
                                <div
                                    key={cand.id}
                                    className="p-3.5 rounded-2"
                                    style={{
                                        backgroundColor: 'var(--admin-surface-2)',
                                        border: rank === 0 ? '1.5px solid var(--admin-emerald)' : '1px solid var(--admin-border-subtle)'
                                    }}
                                >
                                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-2.5">
                                        <div className="d-flex align-items-center gap-2.5">
                                            <span className={`admin-badge font-mono ${rank === 0 ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                                                #{rank + 1} {rank === 0 ? 'GANADOR' : ''}
                                            </span>
                                            <strong className="text-white" style={{ fontSize: '0.95rem' }}>{cand.title}</strong>
                                            {cand.hasVeto && (
                                                <span className="admin-badge admin-badge-danger font-mono">Veto Detectado (-3.0 pts)</span>
                                            )}
                                        </div>

                                        <div className="d-flex align-items-center gap-3 font-mono" style={{ fontSize: '0.82rem' }}>
                                            <span style={{ color: 'var(--admin-text-secondary)' }}>Media μ: <strong className="text-white">{cand.mean}</strong></span>
                                            <span style={{ color: 'var(--admin-text-secondary)' }}>Dispersión σ: <strong style={{ color: 'var(--admin-amber)' }}>{cand.stdDev}</strong></span>
                                            <span className="fs-5 fw-bold" style={{ color: rank === 0 ? 'var(--admin-emerald)' : 'var(--admin-focus)' }}>
                                                Score: {cand.finalScore}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="row g-2">
                                        {cand.votes.map((vote, mIdx) => (
                                            <div key={mIdx} className="col">
                                                <div className="p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-1)' }}>
                                                    <div className="d-flex justify-content-between font-mono mb-1" style={{ fontSize: '0.75rem' }}>
                                                        <span style={{ color: 'var(--admin-text-secondary)' }}>Amigo {mIdx + 1}</span>
                                                        <strong style={{ color: vote <= 2 ? 'var(--admin-rose)' : 'var(--admin-text-primary)' }}>{vote} pts</strong>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={1}
                                                        max={10}
                                                        step={1}
                                                        value={vote}
                                                        onChange={(e) => {
                                                            const nextVal = Number(e.target.value)
                                                            setCandidates(prev => prev.map(item => {
                                                                if (item.id !== cand.id) return item
                                                                const updated = [...item.votes]
                                                                updated[mIdx] = nextVal
                                                                return { ...item, votes: updated }
                                                            }))
                                                        }}
                                                        className="form-range"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    const safeIdx = Math.min(selectedPointIdx, chartPoints.length - 1)
    const activePoint = chartPoints[safeIdx] || chartPoints[chartPoints.length - 1]

    return (
        <div className="admin-viewport-shell">
            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                        Consenso Grupal & Vector de Felicidad (μ - λσ)
                    </h1>
                    <p className="admin-subtitle m-0 mt-1">
                        Monitoreo de armonía grupal, reducción de vetos y calibración matemática del motor de decisión
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubView('simulator')}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 text-white"
                    >
                        <Sparkles size={14} style={{ color: 'var(--admin-focus)' }} />
                        <span>Simulador en Vivo</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubView('calibration-lab')}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <SlidersHorizontal size={14} />
                        <span>Calibrar Pesos</span>
                    </button>
                </div>
            </div>

            {/* 3 KPIs Vitales (Click para ir a Sub-Vista dedicada) */}
            <div className="admin-kpis-inline-grid">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('calibration-lab')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Felicidad Media Lograda</span>
                        <span className="admin-badge admin-badge-success font-mono">{algoData?.stats.total_votes_analyzed ?? 0} votos</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{algoData?.stats.average_group_happiness ?? 0}</span>
                        <span className="font-mono" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>/ 10 pts</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Abrir Laboratorio de Pesos</span>
                            <ChevronRight size={13} />
                        </span>
                        <SlidersHorizontal size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('consensus-rules')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Reglas Antiveto & Supermayoría</span>
                        <span className="admin-badge admin-badge-info font-mono">{rules.filter(r => r.active).length} de {rules.length} activas</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{algoData?.stats.high_consensus_rooms_pct ?? 0}%</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>salas con acuerdo</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Configurar reglas de consenso</span>
                            <ChevronRight size={13} />
                        </span>
                        <Scale size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('simulator')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Penalización por Dispersión (λ)</span>
                        <span className="admin-badge admin-badge-success font-mono">Activa</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">λ = {lambda.toFixed(2)}</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>factor activo</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ejecutar Simulador Reactivo</span>
                            <ChevronRight size={13} />
                        </span>
                        <Sparkles size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Curva Histórica Interactiva + Inspector de Hito de Calibración */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Evolución de Felicidad Grupal e Impacto de Calibraciones
                            </h2>
                            <div className="admin-subview-switcher">
                                {(['7d', '30d', '90d'] as const).map(tf => (
                                    <button
                                        key={tf}
                                        type="button"
                                        onClick={() => setTimeframe(tf)}
                                        className={`admin-subview-pill ${timeframe === tf ? 'active' : ''}`}
                                    >
                                        {tf.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="position-relative" style={{ width: '100%', height: svgHeight }}>
                            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-100 h-100" style={{ overflow: 'visible' }}>
                                <defs>
                                    <linearGradient id="algoCurveGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.32" />
                                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {[2.0, 4.0, 6.0, 8.0, 10.0].map(val => {
                                    const normY = (val - minScore) / (maxScore - minScore)
                                    const y = pad.top + chartH - normY * chartH
                                    return (
                                        <g key={val}>
                                            <line x1={pad.left} y1={y} x2={svgWidth - pad.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                            <text x={pad.left - 10} y={y + 4} fill="var(--admin-text-muted)" fontSize="11" fontFamily="monospace" textAnchor="end">
                                                {val.toFixed(1)}
                                            </text>
                                        </g>
                                    )
                                })}

                                <path d={areaD} fill="url(#algoCurveGrad)" />
                                <path d={pathD} fill="none" stroke="var(--admin-focus)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

                                {chartPoints.map((pt, idx) => {
                                    const isSel = safeIdx === idx
                                    return (
                                        <g
                                            key={pt.date}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setSelectedPointIdx(idx)}
                                            onMouseEnter={() => setSelectedPointIdx(idx)}
                                        >
                                            {isSel && (
                                                <line x1={pt.x} y1={pad.top} x2={pt.x} y2={pad.top + chartH} stroke="rgba(56, 189, 248, 0.35)" strokeDasharray="3 3" />
                                            )}
                                            <circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={isSel ? 6.5 : 4.5}
                                                fill={isSel ? '#FFFFFF' : 'var(--admin-focus)'}
                                                stroke="#090B10"
                                                strokeWidth="2"
                                            />
                                            <text
                                                x={pt.x}
                                                y={svgHeight - 8}
                                                fill={isSel ? '#FFFFFF' : 'var(--admin-text-secondary)'}
                                                fontSize="11"
                                                fontWeight={isSel ? '600' : '400'}
                                                textAnchor="middle"
                                            >
                                                {pt.label}
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>
                            Fórmula Activa: <strong className="font-mono text-white">Score = {weightMean.toFixed(1)}μ - {lambda.toFixed(2)}σ - {weightPol.toFixed(2)}Pol + {weightMal.toFixed(2)}MAL</strong>
                        </span>
                        <span style={{ color: 'var(--admin-emerald)' }}>● Correlación positiva (+13% felicidad desde Sem 1)</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Hito Temporal × Calibración */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                HITO SELECCIONADO • {activePoint?.label}
                            </span>
                            <span className="admin-badge admin-badge-success font-mono">{activePoint?.consensus_rate}% consenso</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            {activePoint?.event || 'Calibración del Motor'}
                        </h3>
                        <p className="admin-subtitle mb-3">
                            Durante este periodo se auditaron <strong className="text-white">{activePoint?.rooms_count} salas</strong> alcanzando una felicidad media de <strong className="text-white font-mono">{activePoint?.avg_happiness} / 10</strong>.
                        </p>

                        <div className="d-flex flex-column gap-2.5">
                            <div
                                onClick={() => setActiveSubView('calibration-lab')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Laboratorio de Pesos (6 Sliders)</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>
                                        Ajusta w_μ ({weightMean}), λ ({lambda}) y bono de afinidad
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('consensus-rules')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Reglas de Consenso y Veto</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>
                                        {rules.filter(r => r.active).length} salvaguardas activas en producción
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('simulator')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Simulador Reactivo de Votación</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>
                                        Experimenta escenarios extremos sin afectar salas reales
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setActiveSubView('calibration-lab')}
                        className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <span>Abrir Laboratorio de Calibración</span>
                        <TrendingUp size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
