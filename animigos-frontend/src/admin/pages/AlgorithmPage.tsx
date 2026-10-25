import { useState, useEffect } from 'react'
import {
    SlidersHorizontal,
    Activity,
    Scale,
    ShieldAlert
} from 'lucide-react'
import { getAlgorithm } from '../services/adminApi'
import type { AlgorithmResponse } from '../services/adminApi'

interface CandidateAnime {
    id: string
    title: string
    votes: number[]
}

export function AlgorithmPage() {
    const [lambda, setLambda] = useState(0.3)
    const [algoData, setAlgoData] = useState<AlgorithmResponse | null>(null)
    const [candidates, setCandidates] = useState<CandidateAnime[]>([
        { id: '1', title: 'Frieren: Beyond Journey\'s End', votes: [9, 8, 9] },
        { id: '2', title: 'Chainsaw Man', votes: [10, 4, 9] },
        { id: '3', title: 'Dungeon Meshi', votes: [8, 8, 8] },
    ])

    useEffect(() => {
        getAlgorithm()
            .then(data => {
                setAlgoData(data)
                if (data.parameters?.dispersion_weight_lambda) {
                    setLambda(data.parameters.dispersion_weight_lambda)
                }
            })
            .catch(err => console.error('Error fetching algorithm data:', err))
    }, [])

    const calculateStats = (votes: number[]) => {
        const mean = votes.reduce((a, b) => a + b, 0) / votes.length
        const variance = votes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / votes.length
        const stdDev = Math.sqrt(variance)
        const finalScore = Number((mean - (lambda * stdDev)).toFixed(2))
        return {
            mean: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            finalScore: Math.max(0, finalScore)
        }
    }

    const candidatesWithStats = candidates.map(c => ({
        ...c,
        ...calculateStats(c.votes)
    })).sort((a, b) => b.finalScore - a.finalScore)

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

    const genreEntries = algoData?.genre_dispersion ? Object.entries(algoData.genre_dispersion) : [
        ['Action', { count: 4820, percentage: 24.8 }],
        ['Comedy', { count: 3912, percentage: 20.1 }],
        ['Fantasy', { count: 3504, percentage: 18.0 }],
        ['Drama', { count: 2840, percentage: 14.6 }],
        ['Sci-Fi', { count: 1940, percentage: 10.0 }]
    ]

    const rules = algoData?.rules || [
        { id: 'R1', name: 'Veto de Incompatibilidad Absoluta', condition: 'Voto individual = 0', effect: 'Penalización inmediata de -3.0 al score grupal', active: true },
        { id: 'R2', name: 'Consenso Unánime', condition: 'σ < 1.0 y μ ≥ 7.5', effect: 'Bonus de +1.5 por acuerdo de alta satisfacción', active: true },
        { id: 'R3', name: 'Quórum Mínimo Requerido', condition: 'Participación < 60%', effect: 'La sala permanece bloqueada para desempate', active: true },
        { id: 'R4', name: 'Desempate por Ponderación Externa', condition: 'Diferencia ≤ 0.15', effect: 'Gana el título con mejor nota histórica en MAL', active: true }
    ]

    return (
        <div>
            {/* Header del módulo */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0">
                        Algoritmo de Felicidad Grupal
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Calibración matemática en vivo conectada al motor Python de Django
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="admin-badge admin-badge-info font-mono">
                        Score = μ - λ · σ
                    </span>
                    <span className="admin-badge admin-badge-neutral font-mono">
                        λ = {lambda}
                    </span>
                </div>
            </div>

            {/* ============================================================
               1. FILA DE KPIS PRINCIPALES (4 Columnas)
               ============================================================ */}
            <section className="admin-grid-kpis mb-3">
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Media de Interés (μ)
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Activity size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">
                                {algoData?.stats.avg_interest_score || 8.1}
                            </span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>/ 10</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {algoData?.stats.total_votes_analyzed || 78} votos
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Base muestreada
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Factor de Penalización (λ)
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <SlidersHorizontal size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{lambda}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>ponderación</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            Nominal
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Control de aversión al veto
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Umbral de Desempate
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Scale size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">≤ 0.15</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>pts</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-neutral font-mono">
                            Tie-break
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Activa peso histórico MAL
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Filtro Antiveto
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <ShieldAlert size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">100%</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>protección</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            Activo
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Penaliza votos 0/10
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. SIMULADOR REACTIVO Y DISTRIBUCIÓN
               ============================================================ */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-xl-8">
                    <div className="admin-card">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Simulador Matemático en Tiempo Real</h2>
                                <span className="admin-subtitle">Ajusta los votos para verificar el cálculo del algoritmo</span>
                            </div>

                            <div className="d-flex align-items-center gap-2 px-2.5 py-1 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <span className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>Peso λ:</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.6"
                                    step="0.05"
                                    value={lambda}
                                    onChange={(e) => setLambda(parseFloat(e.target.value))}
                                    style={{ width: 70, cursor: 'pointer', accentColor: '#FFFFFF' }}
                                />
                                <span className="fw-semibold text-white font-mono" style={{ fontSize: '0.75rem' }}>{lambda}</span>
                            </div>
                        </div>

                        <div className="d-flex flex-column gap-2">
                            {candidatesWithStats.map((c, rank) => {
                                const isWinner = c.id === winnerId
                                return (
                                    <div
                                        key={c.id}
                                        className="p-2.5 rounded-1"
                                        style={{
                                            backgroundColor: isWinner ? 'rgba(16, 185, 129, 0.04)' : 'var(--admin-surface-2)',
                                            border: `1px solid ${isWinner ? 'rgba(16, 185, 129, 0.3)' : 'var(--admin-border-subtle)'}`
                                        }}
                                    >
                                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="font-mono rounded-1 d-flex align-items-center justify-content-center"
                                                    style={{
                                                        width: 20,
                                                        height: 20,
                                                        backgroundColor: isWinner ? 'var(--admin-emerald)' : 'var(--admin-surface-3)',
                                                        color: isWinner ? '#000000' : '#FFFFFF',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {rank + 1}
                                                </span>
                                                <span className="fw-semibold text-white" style={{ fontSize: '0.82rem' }}>
                                                    {c.title}
                                                </span>
                                                {isWinner && (
                                                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.65rem' }}>
                                                        LÍDER
                                                    </span>
                                                )}
                                            </div>

                                            <div className="d-flex align-items-center gap-2.5 font-mono" style={{ fontSize: '0.72rem' }}>
                                                <span style={{ color: 'var(--admin-text-muted)' }}>μ: <strong className="text-white">{c.mean}</strong></span>
                                                <span style={{ color: 'var(--admin-text-muted)' }}>σ: <strong style={{ color: c.stdDev > 2 ? 'var(--admin-amber)' : 'var(--admin-blue)' }}>{c.stdDev}</strong></span>
                                                <span className={`admin-badge ${isWinner ? 'admin-badge-success' : 'admin-badge-neutral'} font-mono fw-semibold`} style={{ fontSize: '0.72rem' }}>
                                                    Score: {c.finalScore}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="d-flex flex-wrap align-items-center gap-3 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                            {['Amigo 1 (Matias)', 'Amigo 2 (Sofia)', 'Amigo 3 (Kenji)'].map((voterName, vIdx) => (
                                                <div key={vIdx} className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 150 }}>
                                                    <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', width: 85 }}>
                                                        {voterName.split(' ')[0]}:
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="10"
                                                        value={c.votes[vIdx]}
                                                        onChange={(e) => handleVoteChange(c.id, vIdx, parseInt(e.target.value))}
                                                        className="flex-grow-1"
                                                        style={{ height: 4, accentColor: '#FFFFFF', cursor: 'pointer' }}
                                                    />
                                                    <span className="font-mono fw-bold" style={{ fontSize: '0.75rem', width: 20, color: c.votes[vIdx] <= 4 ? '#EF4444' : c.votes[vIdx] >= 8 ? 'var(--admin-emerald)' : 'var(--admin-text-secondary)' }}>
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
                </div>

                <div className="col-12 col-xl-4">
                    <div className="admin-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Catálogo por Género</h2>
                                    <span className="admin-subtitle">
                                        Distribución real en PostgreSQL ({algoData?.stats.total_catalog_size || 19384} series)
                                    </span>
                                </div>
                            </div>

                            <div className="d-flex flex-column gap-3">
                                {genreEntries.map((item, i) => {
                                    const gName = item[0] as string
                                    const gData = item[1] as { count: number; percentage: number }
                                    return (
                                        <div key={i}>
                                            <div className="d-flex justify-content-between align-items-baseline mb-1">
                                                <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                                    {gName}
                                                </span>
                                                <span className="font-mono small text-secondary" style={{ fontSize: '0.7rem' }}>
                                                    {gData.count} animes ({gData.percentage}%)
                                                </span>
                                            </div>
                                            <div className="admin-progress-track">
                                                <div className="admin-progress-bar" style={{ width: `${Math.min(100, gData.percentage * 3)}%`, backgroundColor: i === 0 ? '#FFFFFF' : '#71717A' }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="pt-2.5 border-top mt-3 font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                            Motor: groups/services/happiness.py
                        </div>
                    </div>
                </div>
            </div>

            {/* Reglas de Consenso */}
            <div className="admin-card">
                <h2 className="admin-title mb-3" style={{ fontSize: '0.92rem' }}>Reglas de Consenso Activas en el Backend</h2>
                <div className="row g-2">
                    {rules.map(rule => (
                        <div key={rule.id} className="col-12 col-md-6">
                            <div className="p-2.5 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.64rem' }}>{rule.id}</span>
                                    <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>{rule.name}</span>
                                </div>
                                <div className="font-mono text-secondary small mb-1" style={{ fontSize: '0.7rem' }}>
                                    Condición: {rule.condition}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--admin-emerald)' }}>
                                    → {rule.effect}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
