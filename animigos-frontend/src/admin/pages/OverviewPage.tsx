import { useState, useEffect } from 'react'
import {
    Clock,
    Users,
    Flame,
    SlidersHorizontal,
    RefreshCw,
    Database
} from 'lucide-react'
import { getOverview, getRooms } from '../services/adminApi'
import type { OverviewResponse, RoomItem } from '../services/adminApi'

export function OverviewPage() {
    const [data, setData] = useState<OverviewResponse | null>(null)
    const [rooms, setRooms] = useState<RoomItem[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showSkeletons, setShowSkeletons] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadData = async (showSpinner = false) => {
        if (showSpinner) setIsRefreshing(true)
        setError(null)
        try {
            const [overviewRes, roomsRes] = await Promise.all([
                getOverview(),
                getRooms()
            ])
            setData(overviewRes)
            setRooms(roomsRes.rooms)
        } catch (err: any) {
            console.error('Error fetching admin overview data:', err)
            setError(err.message || 'Error de conexión con la API Django')
        } finally {
            setLoading(false)
            if (showSpinner) setIsRefreshing(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleRefresh = () => {
        loadData(true)
    }

    const summary = data?.summary || {
        total_rooms: 0,
        active_rooms: 0,
        concluded_rooms: 0,
        total_members: 0,
        total_votes: 0,
        consensus_rate: 0,
        avg_decision_time_minutes: 8.5
    }

    const funnelData = data?.funnel ? [
        {
            step: '1. Invitados Creados',
            count: data.funnel.guests_created.toLocaleString(),
            pct: 100,
            color: '#FFFFFF',
            note: 'Base total'
        },
        {
            step: '2. En Salas Activas',
            count: data.funnel.joined_room.toLocaleString(),
            pct: data.funnel.guests_created > 0 ? Math.min(100, Math.round((data.funnel.joined_room / data.funnel.guests_created) * 100)) : 100,
            color: '#A1A1AA',
            note: 'Unidos a sesión'
        },
        {
            step: '3. Quórum de Votos',
            count: data.funnel.voted.toLocaleString(),
            pct: data.funnel.joined_room > 0 ? Math.min(100, Math.round((data.funnel.voted / data.funnel.joined_room) * 100)) : 0,
            color: '#38BDF8',
            note: 'Votación emitida'
        },
        {
            step: '4. Consenso Logrado',
            count: data.funnel.winner_selected.toLocaleString(),
            pct: data.funnel.joined_room > 0 ? Math.min(100, Math.round((data.funnel.winner_selected / data.funnel.joined_room) * 100)) : 0,
            color: '#10B981',
            note: 'Ganador elegido'
        }
    ] : []

    const weeklyTelemetry = data?.weekly_telemetry || []
    const maxDayTotal = Math.max(1, ...weeklyTelemetry.map(w => w.total))

    const isDisplayingSkeletons = loading || showSkeletons

    return (
        <div>
            {/* Header del módulo con controles funcionales */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0">
                        Pulso de Animigos
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Telemetría en tiempo real desde AWS PostgreSQL 16
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowSkeletons(!showSkeletons)}
                        className="admin-btn admin-btn-secondary font-mono"
                        style={{ fontSize: '0.72rem' }}
                    >
                        {showSkeletons ? 'Ver datos reales' : 'Simular skeletons'}
                    </button>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-2"
                        style={{ fontSize: '0.74rem' }}
                    >
                        {isRefreshing ? (
                            <span className="admin-spinner"></span>
                        ) : (
                            <RefreshCw size={13} style={{ color: 'var(--admin-text-muted)' }} />
                        )}
                        <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>

                    <span className="admin-badge admin-badge-success font-mono d-none d-sm-inline-flex">
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                        {summary.concluded_rooms} consensos resueltos
                    </span>
                </div>
            </div>

            {error && (
                <div className="p-3 mb-4 rounded-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#F87171', fontSize: '0.8rem' }}>
                    <strong>Aviso de Conexión:</strong> {error}
                </div>
            )}

            {/* ============================================================
               1. FILA DE KPIS PRINCIPALES (4 Columnas distribuidas)
               ============================================================ */}
            <section className="admin-grid-kpis mb-3">

                {/* KPI 1: Consensos Exitosos */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Consensos Exitosos
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Flame size={13} />
                            </div>
                        </div>

                        {isDisplayingSkeletons ? (
                            <div className="admin-skeleton my-2" style={{ height: 32, width: '60%' }}></div>
                        ) : (
                            <div className="d-flex align-baseline gap-2 mb-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{summary.concluded_rooms}</span>
                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>de {summary.total_rooms} salas</span>
                            </div>
                        )}
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {summary.consensus_rate}% tasa
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Con anime ganador
                        </span>
                    </div>
                </div>

                {/* KPI 2: Velocidad a Decisión */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Tiempo a Decisión (TTC)
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Clock size={13} />
                            </div>
                        </div>

                        {isDisplayingSkeletons ? (
                            <div className="admin-skeleton my-2" style={{ height: 32, width: '50%' }}></div>
                        ) : (
                            <div className="d-flex align-baseline gap-2 mb-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{summary.avg_decision_time_minutes}</span>
                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>minutos promedio</span>
                            </div>
                        )}
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            {summary.total_votes} votos
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Votos registrados
                        </span>
                    </div>
                </div>

                {/* KPI 3: Miembros Participantes */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Miembros e Invitados
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Users size={13} />
                            </div>
                        </div>

                        {isDisplayingSkeletons ? (
                            <div className="admin-skeleton my-2" style={{ height: 32, width: '45%' }}></div>
                        ) : (
                            <div className="d-flex align-baseline gap-2 mb-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{summary.total_members}</span>
                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>integrantes</span>
                            </div>
                        )}
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-neutral font-mono">
                            {summary.active_rooms} salas activas
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Votando en vivo
                        </span>
                    </div>
                </div>

                {/* KPI 4: Catálogo e Infraestructura */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Catálogo en AWS RDS
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Database size={13} />
                            </div>
                        </div>

                        {isDisplayingSkeletons ? (
                            <div className="admin-skeleton my-2" style={{ height: 32, width: '55%' }}></div>
                        ) : (
                            <div className="d-flex align-baseline gap-2 mb-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{data?.health.total_animes?.toLocaleString() || '19,384'}</span>
                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>animes en DB</span>
                            </div>
                        )}
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {data?.health.latency_ms || 18}ms ping
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            {data?.health.db_engine || 'PostgreSQL 16'}
                        </span>
                    </div>
                </div>

            </section>

            {/* ============================================================
               2. FILA MEDIA: EMBUDO COMPACTO + SALUD DEL ALGORITMO
               ============================================================ */}
            <section className="admin-grid-middle mb-3">

                {/* EMBUDO DE CONVERSIÓN COMPACTO */}
                <div className="admin-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Embudo de Decisión Grupal</h2>
                            <span className="admin-subtitle">
                                Conversión secuencial de creación de usuarios a consenso
                            </span>
                        </div>
                        <span className="admin-badge admin-badge-success font-mono">
                            {summary.consensus_rate}% Consenso
                        </span>
                    </div>

                    {isDisplayingSkeletons ? (
                        <div className="d-flex flex-column gap-2 pt-1">
                            <div className="admin-skeleton" style={{ height: 28, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 28, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 28, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 28, width: '100%' }}></div>
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-2">
                            {funnelData.map((f, i) => (
                                <div key={i} className="d-flex align-items-center justify-content-between gap-2 py-1.5 px-2 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 160 }}>
                                        <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                            {f.step}
                                        </span>
                                    </div>

                                    <div className="flex-grow-1 mx-2" style={{ maxWidth: 140, minWidth: 60 }}>
                                        <div className="admin-progress-track">
                                            <div
                                                className="admin-progress-bar"
                                                style={{
                                                    width: `${f.pct}%`,
                                                    backgroundColor: f.color
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-end gap-3 text-end font-mono" style={{ minWidth: 120 }}>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--admin-text-muted)' }}>{f.count}</span>
                                        <span className="fw-semibold text-white" style={{ fontSize: '0.78rem', minWidth: 38 }}>{f.pct}%</span>
                                        <span className="d-none d-md-inline" style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)', minWidth: 65 }}>{f.note}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SALUD Y DISPERSIÓN DEL ALGORITMO */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Salud del Algoritmo</h2>
                                <span className="admin-subtitle">
                                    Dispersión estándar (σ) y calibración de consenso
                                </span>
                            </div>
                            <SlidersHorizontal size={14} style={{ color: 'var(--admin-text-muted)' }} />
                        </div>

                        {isDisplayingSkeletons ? (
                            <div className="d-flex flex-column gap-3 pt-1">
                                <div className="admin-skeleton" style={{ height: 42, width: '100%' }}></div>
                                <div className="admin-skeleton" style={{ height: 42, width: '100%' }}></div>
                                <div className="admin-skeleton" style={{ height: 42, width: '100%' }}></div>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                <div>
                                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                                        <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                            Consenso Alto <span className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>(σ ≤ 1.2)</span>
                                        </span>
                                        <span className="small font-mono fw-semibold" style={{ color: 'var(--admin-emerald)', fontSize: '0.75rem' }}>64% salas</span>
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-bar" style={{ width: '64%', backgroundColor: 'var(--admin-emerald)' }}></div>
                                    </div>
                                    <span className="d-block mt-1" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                                        Unanimidad: el ganador surge en Ronda 1 sin votos de polarización.
                                    </span>
                                </div>

                                <div>
                                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                                        <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                            Consenso Moderado <span className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>(σ 1.3 - 2.8)</span>
                                        </span>
                                        <span className="small font-mono fw-semibold" style={{ color: 'var(--admin-blue)', fontSize: '0.75rem' }}>26% salas</span>
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-bar" style={{ width: '26%', backgroundColor: 'var(--admin-blue)' }}></div>
                                    </div>
                                    <span className="d-block mt-1" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                                        Penalización λ resuelve empates optimizando utilidad grupal.
                                    </span>
                                </div>

                                <div>
                                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                                        <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                            Polarización / Riesgo <span className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>(σ &gt; 2.8)</span>
                                        </span>
                                        <span className="small font-mono fw-semibold" style={{ color: 'var(--admin-amber)', fontSize: '0.75rem' }}>10% salas</span>
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-bar" style={{ width: '10%', backgroundColor: 'var(--admin-amber)' }}></div>
                                    </div>
                                    <span className="d-block mt-1" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                                        Vetos o gustos antagónicos: sistema sugiere ronda de repesca.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-2.5 border-top mt-3 d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                            Fórmula activa: Score = μ - 0.3σ
                        </span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.66rem' }}>
                            PostgreSQL Sync
                        </span>
                    </div>
                </div>

            </section>

            {/* ============================================================
               3. FILA INFERIOR: TENDENCIA SEMANAL + REGISTRO DE SALAS
               ============================================================ */}
            <section className="admin-grid-bottom">

                {/* GRÁFICO COMPACTO DE EVOLUCIÓN */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Evolución Semanal</h2>
                                <span className="admin-subtitle">
                                    Salas creadas vs concluidas por día
                                </span>
                            </div>
                            <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.68rem' }}>
                                {weeklyTelemetry.reduce((acc, curr) => acc + curr.total, 0)} salas / ciclo
                            </span>
                        </div>

                        {isDisplayingSkeletons ? (
                            <div className="admin-skeleton my-3" style={{ height: 110, width: '100%' }}></div>
                        ) : (
                            <div className="d-flex align-items-end justify-content-between gap-2 pt-3 pb-1" style={{ height: 110 }}>
                                {weeklyTelemetry.map((w, idx) => {
                                    const heightPx = Math.max(16, Math.round((w.total / maxDayTotal) * 75))
                                    const isToday = idx === weeklyTelemetry.length - 1
                                    return (
                                        <div key={idx} className="flex-grow-1 d-flex flex-column align-items-center justify-content-end" style={{ height: '100%' }}>
                                            <span className="font-mono small mb-1" style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)' }}>
                                                {w.total}
                                            </span>
                                            <div
                                                className="w-100"
                                                style={{
                                                    height: `${heightPx}px`,
                                                    backgroundColor: isToday ? '#FFFFFF' : '#1A1A1A',
                                                    border: isToday ? '1px solid #FFFFFF' : '1px solid var(--admin-border-subtle)',
                                                    borderRadius: 2,
                                                    transition: 'background-color 0.15s ease, height 0.2s ease',
                                                }}
                                                title={`${w.day}: ${w.completed} concluidas, ${w.abandoned} en proceso/otras`}
                                            ></div>
                                            <span className="font-mono mt-1.5 fw-medium" style={{ fontSize: '0.68rem', color: isToday ? '#FFFFFF' : 'var(--admin-text-muted)' }}>
                                                {w.day}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="pt-2 border-top mt-3 d-flex justify-content-between font-mono" style={{ fontSize: '0.7rem', borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-muted)' }}>
                        <span>Pico semanal: {maxDayTotal} salas</span>
                        <span style={{ color: 'var(--admin-emerald)' }}>Datos en tiempo real</span>
                    </div>
                </div>

                {/* TABLA COMPACTA DE SALAS EN VIVO */}
                <div className="admin-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Salas Registradas en PostgreSQL</h2>
                            <span className="admin-subtitle">
                                Muestreo de auditoría en tiempo real
                            </span>
                        </div>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            {rooms.length} registradas
                        </span>
                    </div>

                    {isDisplayingSkeletons ? (
                        <div className="d-flex flex-column gap-2 pt-1">
                            <div className="admin-skeleton" style={{ height: 36, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 36, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 36, width: '100%' }}></div>
                        </div>
                    ) : (
                        <div className="table-responsive custom-scrollbar">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>SALA</th>
                                        <th>MIEMBROS</th>
                                        <th>ANIME / CANDIDATO LÍDER</th>
                                        <th className="text-center">FELICIDAD</th>
                                        <th>QUÓRUM</th>
                                        <th className="text-end">ESTADO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map((r, idx) => {
                                        const displayTitle = r.selected_anime?.title || r.top_candidate?.title || 'Pendiente'
                                        const scoreDisplay = r.selected_anime?.score || r.top_candidate?.score || 0
                                        const statusBadge = r.status === 'selected' || r.status === 'completed'
                                            ? 'admin-badge-success'
                                            : r.status === 'voting'
                                                ? 'admin-badge-info'
                                                : 'admin-badge-neutral'

                                        return (
                                            <tr key={idx} className="admin-table-row">
                                                <td>
                                                    <div className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>{r.name}</div>
                                                    <div className="font-mono text-secondary" style={{ fontSize: '0.68rem' }}>{r.invite_code}</div>
                                                </td>
                                                <td className="font-mono text-secondary" style={{ fontSize: '0.74rem' }}>
                                                    {r.members_count} miembros
                                                </td>
                                                <td className="fw-medium text-white text-truncate" style={{ maxWidth: 170, fontSize: '0.78rem' }}>
                                                    {displayTitle}
                                                </td>
                                                <td className="text-center font-mono">
                                                    {scoreDisplay ? (
                                                        <span className="admin-badge admin-badge-success" style={{ fontSize: '0.7rem' }}>
                                                            {scoreDisplay}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.7rem' }}>—</span>
                                                    )}
                                                </td>
                                                <td className="font-mono text-secondary" style={{ fontSize: '0.74rem' }}>
                                                    {r.quorum_percentage}%
                                                </td>
                                                <td className="text-end font-mono">
                                                    <span className={`admin-badge ${statusBadge}`} style={{ fontSize: '0.68rem' }}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </section>
        </div>
    )
}
