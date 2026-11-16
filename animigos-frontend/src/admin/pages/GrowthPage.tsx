import { useState, useEffect, useMemo } from 'react'
import {
    TrendingUp,
    Share2,
    RefreshCw,
    Layers,
    ListPlus,
    ChevronRight
} from 'lucide-react'
import { getGrowth } from '../services/adminApi'
import type { GrowthResponse } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type GrowthSubView = 'cohorts-matrix' | 'channels-viral' | 'daily-dynamism'

interface DailyGrowthPoint {
    date: string
    newUsers: number
    invitationsSent: number
    listAdditions: number
    ratingsPlaced: number
    roomsCreated: number
    roomsDeleted: number
}

export function GrowthPage() {
    const [growthData, setGrowthData] = useState<GrowthResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [timeframe, setTimeframe] = useState<'30d' | '14d' | '7d'>('14d')
    const [selectedPointIndex, setSelectedPointIndex] = useState<number>(9)

    // Sub-Vista Activa
    const [activeSubView, setActiveSubView] = useAdminSubView<GrowthSubView>()

    const fetchGrowth = () => {
        setIsLoading(true)
        getGrowth()
            .then((data: GrowthResponse) => setGrowthData(data))
            .catch((err: unknown) => console.error('Error fetching growth metrics:', err))
            .finally(() => setIsLoading(false))
    }

    useEffect(() => {
        fetchGrowth()
    }, [])

    const fullTimeline: DailyGrowthPoint[] = useMemo(() => {
        if (growthData?.daily_timeline && growthData.daily_timeline.length > 0) {
            return growthData.daily_timeline
        }
        return [
            { date: 'Hoy', newUsers: 0, invitationsSent: 0, listAdditions: 0, ratingsPlaced: 0, roomsCreated: 0, roomsDeleted: 0 }
        ]
    }, [growthData])

    const visibleTimeline = useMemo(() => {
        if (timeframe === '7d') return fullTimeline.slice(-7)
        if (timeframe === '14d') return fullTimeline.slice(-14)
        return fullTimeline
    }, [fullTimeline, timeframe])

    const svgWidth = 720
    const svgHeight = 245
    const pad = { top: 24, right: 28, bottom: 34, left: 44 }
    const chartW = svgWidth - pad.left - pad.right
    const chartH = svgHeight - pad.top - pad.bottom
    const minUsers = 0
    const maxUsers = Math.max(5, ...visibleTimeline.map(p => p.newUsers))

    const points = useMemo(() => {
        return visibleTimeline.map((pt, i) => {
            const x = pad.left + (visibleTimeline.length > 1 ? (i / (visibleTimeline.length - 1)) * chartW : chartW / 2)
            const normY = Math.max(0, Math.min(1, (pt.newUsers - minUsers) / Math.max(1, maxUsers - minUsers)))
            const y = pad.top + chartH - normY * chartH
            return { ...pt, x, y }
        })
    }, [visibleTimeline, chartW, chartH, maxUsers])

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaD = points.length > 0
        ? `${pathD} L ${points[points.length - 1].x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`
        : ''

    const totalNewUsersPeriod = fullTimeline.reduce((acc, p) => acc + p.newUsers, 0)
    const totalInvitationsPeriod = fullTimeline.reduce((acc, p) => acc + p.invitationsSent, 0)
    const totalListAdditionsPeriod = fullTimeline.reduce((acc, p) => acc + p.listAdditions, 0)
    const totalRatingsPeriod = fullTimeline.reduce((acc, p) => acc + p.ratingsPlaced, 0)
    const totalRoomsCreatedPeriod = fullTimeline.reduce((acc, p) => acc + p.roomsCreated, 0)
    const kFactor = growthData?.k_factor ?? 0

    const chWhatsapp = growthData?.channels?.whatsapp ?? 0
    const chLink = growthData?.channels?.link ?? 0
    const chQr = growthData?.channels?.qr ?? 0
    const totalChannelShares = chWhatsapp + chLink + chQr
    const pctWhatsapp = totalChannelShares > 0 ? Math.round((chWhatsapp / totalChannelShares) * 100) : 0
    const pctLink = totalChannelShares > 0 ? Math.round((chLink / totalChannelShares) * 100) : 0
    const pctQr = totalChannelShares > 0 ? Math.max(0, 100 - pctWhatsapp - pctLink) : 0

    const subViewOptions: SubViewOption<GrowthSubView>[] = [
        { id: 'cohorts-matrix', label: 'Retención de Cohortes (W0-W4)', badge: `${growthData?.cohorts?.length || 0}` },
        { id: 'channels-viral', label: 'Canales de Invitación & Viralidad', badge: `K=${kFactor}` },
        { id: 'daily-dynamism', label: 'Dinamismo en Listas & Notas' }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Crecimiento & Adopción"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {/* SUB-VISTA 1: MATRIZ DE RETENCIÓN DE COHORTES */}
                {activeSubView === 'cohorts-matrix' && (
                    <div className="admin-card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.15rem' }}>
                                    Matriz de Retención de Cohortes por Semana de Incorporación
                                </h2>
                                <p className="admin-subtitle m-0 mt-0.5">
                                    Porcentaje de usuarios que continúan votando en salas o actualizando su agenda en semanas sucesivas
                                </p>
                            </div>
                            <span className="admin-badge admin-badge-success font-mono">{growthData?.total_users ?? 0} usuarios</span>
                        </div>

                        {(!growthData?.cohorts || growthData.cohorts.length === 0) ? (
                            <div className="p-4 text-center rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>
                                Aún no hay semanas históricas suficientes en PostgreSQL para construir cohortes multianuales. Total usuarios actuales: <strong className="text-white">{growthData?.total_users ?? 0}</strong>.
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-dark table-borderless m-0 align-middle" style={{ fontSize: '0.84rem' }}>
                                    <thead>
                                        <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                            <th>COHORTE DE ALTA</th>
                                            <th className="text-center">SEMANA 0</th>
                                            <th className="text-center">SEMANA 1</th>
                                            <th className="text-center">SEMANA 2</th>
                                            <th className="text-center">SEMANA 3</th>
                                            <th className="text-center">SEMANA 4</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono">
                                        {growthData.cohorts.map((c, i) => (
                                            <tr key={i} className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                                <td className="text-white fw-semibold" style={{ fontFamily: 'var(--font-sans)' }}>{c.cohort}</td>
                                                <td className="text-center fw-bold" style={{ color: 'var(--admin-emerald)' }}>{c.w0}%</td>
                                                <td className="text-center" style={{ color: c.w1 ? 'var(--admin-emerald)' : 'var(--admin-text-muted)' }}>
                                                    {c.w1 !== null ? `${c.w1}%` : '—'}
                                                </td>
                                                <td className="text-center" style={{ color: c.w2 ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }}>
                                                    {c.w2 !== null ? `${c.w2}%` : '—'}
                                                </td>
                                                <td className="text-center" style={{ color: c.w3 ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }}>
                                                    {c.w3 !== null ? `${c.w3}%` : '—'}
                                                </td>
                                                <td className="text-center" style={{ color: c.w4 ? 'var(--admin-emerald)' : 'var(--admin-text-muted)', fontWeight: 700 }}>
                                                    {c.w4 !== null ? `${c.w4}%` : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* SUB-VISTA 2: CANALES DE INVITACIÓN Y VIRALIDAD */}
                {activeSubView === 'channels-viral' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <span className="admin-badge admin-badge-info mb-2">COEFICIENTE VIRAL K = {kFactor}</span>
                                <h2 className="admin-title mb-1" style={{ fontSize: '1.2rem' }}>
                                    Rendimiento por Canal de Invitación ({totalChannelShares} Miembros en Salas)
                                </h2>
                                <p className="admin-subtitle mb-4">
                                    Distribución real de los miembros registrados según su canal de ingreso en PostgreSQL
                                </p>

                                <div className="d-flex flex-column gap-3">
                                    {[
                                        { channel: 'WhatsApp Direct Share', count: chWhatsapp, pct: pctWhatsapp, color: 'var(--admin-emerald)', desc: 'Miembros que ingresaron mediante enlace de WhatsApp.' },
                                        { channel: 'Enlace Copiado (Web / Link)', count: chLink, pct: pctLink, color: 'var(--admin-focus)', desc: 'Miembros que ingresaron mediante enlace directo o PIN.' },
                                        { channel: 'Código QR Presencial', count: chQr, pct: pctQr, color: 'var(--admin-amber)', desc: 'Miembros que escanearon código QR de sala.' }
                                    ].map((ch, idx) => (
                                        <div key={idx} className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-1.5">
                                                <strong className="text-white" style={{ fontSize: '0.88rem' }}>{ch.channel}</strong>
                                                <div className="font-mono">
                                                    <span className="text-white fw-bold me-2">{ch.pct}%</span>
                                                    <span className="admin-badge admin-badge-neutral">{ch.count} miembros</span>
                                                </div>
                                            </div>
                                            <div className="w-100 rounded overflow-hidden mb-1.5" style={{ height: 8, backgroundColor: 'var(--admin-surface-3)' }}>
                                                <div style={{ width: `${ch.pct}%`, height: '100%', backgroundColor: ch.color }} />
                                            </div>
                                            <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>{ch.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.98rem' }}>Ciclo de Vida de Salas (Últimos 14d)</h3>
                                <div className="admin-decision-item mb-2.5">
                                    <div className="d-flex justify-content-between font-mono">
                                        <span className="text-white">Salas creadas en periodo</span>
                                        <strong style={{ color: 'var(--admin-emerald)' }}>{totalRoomsCreatedPeriod} salas</strong>
                                    </div>
                                </div>
                                <div className="admin-decision-item">
                                    <div className="d-flex justify-content-between font-mono">
                                        <span className="text-white">Anfitriones activos</span>
                                        <strong style={{ color: 'var(--admin-focus)' }}>{growthData?.total_hosts ?? 0} hosts</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 3: DINAMISMO DIARIO EN LISTAS Y NOTAS */}
                {activeSubView === 'daily-dynamism' && (
                    <div className="row g-3">
                        <div className="col-12 col-md-6">
                            <div className="admin-card h-100">
                                <h3 className="admin-title mb-1" style={{ fontSize: '1.05rem' }}>Adiciones a "Mi Lista" y Agenda</h3>
                                <p className="admin-subtitle mb-3">Actividad real en listas personales (últimos 14 días)</p>
                                <div className="admin-kpi-value mb-2" style={{ color: 'var(--admin-focus)' }}>{totalListAdditionsPeriod} animes</div>
                                <p className="admin-subtitle">
                                    Títulos añadidos por usuarios registrados a sus listas personales en PostgreSQL.
                                </p>
                            </div>
                        </div>
                        <div className="col-12 col-md-6">
                            <div className="admin-card h-100">
                                <h3 className="admin-title mb-1" style={{ fontSize: '1.05rem' }}>Calificaciones & Votos Emitidos</h3>
                                <p className="admin-subtitle mb-3">Volumen real de votos y notas (últimos 14 días)</p>
                                <div className="admin-kpi-value mb-2" style={{ color: 'var(--admin-emerald)' }}>{totalRatingsPeriod} registros</div>
                                <p className="admin-subtitle">
                                    Suma de votos emitidos en salas grupales y calificaciones guardadas en Mi Lista.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    const safeIdx = Math.min(selectedPointIndex, points.length - 1)
    const activePt = points[safeIdx] || points[points.length - 1]

    return (
        <div className="admin-viewport-shell">
            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <div className="d-flex align-items-center gap-2.5">
                        <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                            Crecimiento, Viralidad & Retención de Cohortes
                        </h1>
                        <span className="admin-badge admin-badge-success font-mono">K = {kFactor}</span>
                    </div>
                    <p className="admin-subtitle m-0 mt-1">
                        Evolución diaria de nuevas altas, efectividad de enlaces de invitación y lealtad semanal
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubView('cohorts-matrix')}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <Layers size={14} />
                        <span>Matriz de Cohortes</span>
                    </button>
                    <button
                        type="button"
                        onClick={fetchGrowth}
                        disabled={isLoading}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('channels-viral')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Nuevas Altas (Periodo)</span>
                        <span className="admin-badge admin-badge-success font-mono">En Vivo</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">+{totalNewUsersPeriod}</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>usuarios</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Canales de adquisición</span>
                            <ChevronRight size={13} />
                        </span>
                        <TrendingUp size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('channels-viral')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Invitaciones Emitidas</span>
                        <span className="admin-badge admin-badge-info font-mono">Salas</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{totalInvitationsPeriod}</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>miembros unidos</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>WhatsApp vs Link vs QR</span>
                            <ChevronRight size={13} />
                        </span>
                        <Share2 size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('daily-dynamism')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Dinamismo en Listas</span>
                        <span className="admin-badge admin-badge-neutral font-mono">Mi Lista</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{totalListAdditionsPeriod}</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>animes guardados</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ver actividad diaria</span>
                            <ChevronRight size={13} />
                        </span>
                        <ListPlus size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('cohorts-matrix')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Audiencia Total</span>
                        <span className="admin-badge admin-badge-success">PostgreSQL</span>
                    </div>
                    <div className="admin-kpi-value my-1">{growthData?.total_users ?? 0}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Abrir Matriz de Cohortes</span>
                            <ChevronRight size={13} />
                        </span>
                        <Layers size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Curva de Adquisición Diaria + Inspector de Fecha y Canales */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Curva de Incorporación Diaria & Tracción Viral
                            </h2>
                            <div className="admin-subview-switcher">
                                {(['30d', '14d', '7d'] as const).map(tf => (
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
                                    <linearGradient id="growthCurveGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.30" />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {[0, Math.round(maxUsers / 2), maxUsers].map(val => {
                                    const normY = (val - minUsers) / Math.max(1, maxUsers - minUsers)
                                    const y = pad.top + chartH - normY * chartH
                                    return (
                                        <g key={val}>
                                            <line x1={pad.left} y1={y} x2={svgWidth - pad.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                            <text x={pad.left - 10} y={y + 4} fill="var(--admin-text-muted)" fontSize="11" fontFamily="monospace" textAnchor="end">
                                                +{val}
                                            </text>
                                        </g>
                                    )
                                })}

                                <path d={areaD} fill="url(#growthCurveGrad)" />
                                <path d={pathD} fill="none" stroke="var(--admin-emerald)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

                                {points.map((pt, i) => {
                                    const isSel = safeIdx === i
                                    return (
                                        <g
                                            key={pt.date}
                                            style={{ cursor: 'pointer' }}
                                            onMouseEnter={() => setSelectedPointIndex(i)}
                                            onClick={() => setActiveSubView('channels-viral')}
                                        >
                                            {isSel && (
                                                <line x1={pt.x} y1={pad.top} x2={pt.x} y2={pad.top + chartH} stroke="rgba(16, 185, 129, 0.35)" strokeDasharray="3 3" />
                                            )}
                                            <circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={isSel ? 6.5 : 4.5}
                                                fill={isSel ? '#FFFFFF' : 'var(--admin-emerald)'}
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
                                                {pt.date}
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>Total de ingresos en ventana: <strong className="text-white">+{totalNewUsersPeriod} usuarios</strong></span>
                        <span className="font-mono" style={{ color: 'var(--admin-emerald)' }}>Factor K: {kFactor}</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Jornada Seleccionada × Viralidad */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                DESGLOSE DE JORNADA • {activePt?.date}
                            </span>
                            <span className="admin-badge admin-badge-success font-mono">+{activePt?.newUsers ?? 0} altas</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            Tracción y Conversión del Día
                        </h3>
                        <p className="admin-subtitle mb-3">
                            Durante el <strong className="text-white">{activePt?.date}</strong> se registraron <strong className="text-white font-mono">{activePt?.invitationsSent ?? 0} miembros en salas</strong> y se crearon <strong className="text-white font-mono">{activePt?.roomsCreated ?? 0} salas</strong>.
                        </p>

                        <div className="d-flex flex-column gap-2.5">
                            <div
                                onClick={() => setActiveSubView('channels-viral')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Canales: WhatsApp ({pctWhatsapp}%) · Link ({pctLink}%)</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        {totalChannelShares} ingresos totales por canal
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('daily-dynamism')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Actividad de Catálogo y Notas</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        +{activePt?.listAdditions ?? 0} a listas • +{activePt?.ratingsPlaced ?? 0} calificaciones
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('cohorts-matrix')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Matriz de Cohortes (W0 a W4)</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        {growthData?.total_users ?? 0} usuarios totales registrados
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setActiveSubView('cohorts-matrix')}
                        className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <span>Explorar Retención de Cohortes</span>
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
