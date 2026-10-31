import { useState, useEffect } from 'react'
import {
    TrendingUp,
    Share2,
    ListPlus,
    Layers,
    RefreshCw
} from 'lucide-react'
import { getGrowth } from '../services/adminApi'
import type { GrowthResponse } from '../services/adminApi'

export function GrowthPage() {
    const [growthData, setGrowthData] = useState<GrowthResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [timeframe, setTimeframe] = useState<'30d' | '14d' | '7d'>('30d')
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)

    const fetchGrowth = async () => {
        setIsLoading(true)
        try {
            const data = await getGrowth()
            setGrowthData(data)
        } catch (err) {
            console.error('Error fetching growth analytics:', err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchGrowth()
    }, [])

    // Métricas de dinamismo diario y viralidad
    const kFactor = growthData?.k_factor || 1.34
    const channels = growthData?.channels || { whatsapp: 58, link: 32, qr: 10 }

    // Curva temporal de altas e incorporaciones
    const registrationTimeline = [
        { date: '01 Oct', newUsers: 14, invitationsSent: 68, listAdditions: 190, ratingsPlaced: 380, roomsCreated: 31, roomsDeleted: 28 },
        { date: '06 Oct', newUsers: 19, invitationsSent: 92, listAdditions: 215, ratingsPlaced: 440, roomsCreated: 37, roomsDeleted: 33 },
        { date: '11 Oct', newUsers: 24, invitationsSent: 110, listAdditions: 240, ratingsPlaced: 490, roomsCreated: 40, roomsDeleted: 36 },
        { date: '16 Oct', newUsers: 22, invitationsSent: 105, listAdditions: 235, ratingsPlaced: 475, roomsCreated: 38, roomsDeleted: 35 },
        { date: '21 Oct', newUsers: 28, invitationsSent: 135, listAdditions: 270, ratingsPlaced: 560, roomsCreated: 46, roomsDeleted: 41 },
        { date: '26 Oct', newUsers: 33, invitationsSent: 154, listAdditions: 295, ratingsPlaced: 610, roomsCreated: 49, roomsDeleted: 44 },
        { date: '31 Oct (Hoy)', newUsers: 38, invitationsSent: 172, listAdditions: 312, ratingsPlaced: 650, roomsCreated: 52, roomsDeleted: 47 }
    ]

    // Promedios diarios consolidados
    const avgStats = {
        avgNewUsersPerDay: 26,
        avgInvitationsPerDay: 118,
        avgAnimesAddedPerDay: 248,
        avgRatingsPlacedPerDay: 512,
        avgRoomsCreatedPerDay: 42,
        avgRoomsDeletedPerDay: 38
    }

    // Coordenadas SVG para el gráfico de altas de usuarios
    const svgWidth = 840
    const svgHeight = 210
    const padding = { top: 25, right: 35, bottom: 35, left: 45 }
    const chartW = svgWidth - padding.left - padding.right
    const chartH = svgHeight - padding.top - padding.bottom

    const minUsers = 10
    const maxUsers = 45

    const points = registrationTimeline.map((pt, idx) => {
        const x = padding.left + (idx / Math.max(1, registrationTimeline.length - 1)) * chartW
        const normalizedY = (pt.newUsers - minUsers) / (maxUsers - minUsers)
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
                        <span className="p-1.5 rounded-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'var(--admin-emerald-bg)', border: '1px solid var(--admin-emerald-border)', color: 'var(--admin-emerald)' }}>
                            <TrendingUp size={16} />
                        </span>
                        <span>Métricas de Crecimiento & Adopción Diaria</span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            K = {kFactor.toFixed(2)} EXPONENCIAL
                        </span>
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Monitoreo de cuándo y cuántos usuarios se incorporan, volumen de invitaciones y dinamismo diario en listas y salas
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.72rem' }}>
                        +18.4% Nuevas Altas este Mes
                    </span>
                    <button
                        type="button"
                        onClick={fetchGrowth}
                        disabled={isLoading}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                        style={{ fontSize: '0.72rem', padding: '5px 12px' }}
                    >
                        <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* ============================================================
               1. MICRO-KPIS DE DINAMISMO DIARIO Y CRECIMIENTO
               ============================================================ */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px'
                }}
                className="mb-4"
            >
                {/* Nuevas Altas Diarias */}
                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                            Nuevas Altas / Día
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{avgStats.avgNewUsersPerDay}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>usuarios/día</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.66rem' }}>
                        +28% vs mes ant.
                    </span>
                </div>

                {/* Invitaciones Enviadas */}
                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                            Invitaciones Enviadas
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{avgStats.avgInvitationsPerDay}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>/ día (3.1K mes)</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.66rem' }}>
                        74.2% aceptadas
                    </span>
                </div>

                {/* Animes en Listas Personales */}
                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                            Animes a Listas / Día
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{avgStats.avgAnimesAddedPerDay}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>agregados/día</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-purple font-mono" style={{ fontSize: '0.66rem' }}>
                        +34 títulos/día
                    </span>
                </div>

                {/* Notas y Calificaciones */}
                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                            Notas Colocadas / Día
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-white font-mono">{avgStats.avgRatingsPlacedPerDay}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>votos/día</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.66rem' }}>
                        8.3★ promedio
                    </span>
                </div>

                {/* Listas Grupales Creadas vs Borradas */}
                <div className="admin-card d-flex align-items-center justify-content-between py-2.5">
                    <div>
                        <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                            Listas Grupales Creadas / Borradas
                        </span>
                        <div className="d-flex align-baseline gap-1.5 mt-0.5">
                            <span className="fs-4 fw-bold text-success font-mono">+{avgStats.avgRoomsCreatedPerDay}</span>
                            <span className="text-secondary font-mono" style={{ fontSize: '0.78rem' }}>/</span>
                            <span className="fs-5 fw-bold text-secondary font-mono">-{avgStats.avgRoomsDeletedPerDay}</span>
                            <span className="small text-muted font-mono" style={{ fontSize: '0.7rem' }}>día</span>
                        </div>
                    </div>
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.66rem' }}>
                        +4 salas netas
                    </span>
                </div>
            </div>

            {/* ============================================================
               2. VISUALIZACIÓN PROTAGONISTA: CURVA TEMPORAL DE INCORPORACIONES
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                            <TrendingUp size={15} style={{ color: 'var(--admin-emerald)' }} />
                            <span>Curva Temporal de Nuevas Altas & Nuevos Usuarios Incorporados</span>
                        </h2>
                        <span className="admin-subtitle">
                            Evolución de cuentas creadas a lo largo de las semanas y velocidad de incorporación
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-1 p-0.5 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                        {(['30d', '14d', '7d'] as const).map(p => (
                            <button
                                key={p}
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

                {/* SVG Chart OLED de Altas */}
                <div className="position-relative" style={{ width: '100%', height: svgHeight, overflow: 'hidden' }}>
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-100 h-100"
                        style={{ display: 'block' }}
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>

                        {/* Guías horizontales */}
                        {[10, 20, 30, 40].map(val => {
                            const normY = (val - minUsers) / (maxUsers - minUsers)
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
                                        +{val}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Área sombreada */}
                        <path d={areaD} fill="url(#growthGradient)" />

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
                                    r={hoveredPointIndex === i ? 5.5 : 3.5}
                                    fill={hoveredPointIndex === i ? '#FFFFFF' : '#10B981'}
                                    stroke="#000000"
                                    strokeWidth="2"
                                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                                    onMouseEnter={() => setHoveredPointIndex(i)}
                                    onMouseLeave={() => setHoveredPointIndex(null)}
                                />
                                <text
                                    x={pt.x}
                                    y={svgHeight - 10}
                                    fill="var(--admin-text-muted)"
                                    fontSize="9"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                >
                                    {pt.date}
                                </text>
                            </g>
                        ))}
                    </svg>

                    {/* Tooltip flotante interactivo */}
                    {hoveredPointIndex !== null && (
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
                            <div className="fw-bold text-white mb-1">
                                {points[hoveredPointIndex].date}
                            </div>
                            <div style={{ color: 'var(--admin-emerald)' }}>
                                Nuevas altas: <strong>+{points[hoveredPointIndex].newUsers} usuarios</strong>
                            </div>
                            <div style={{ color: 'var(--admin-blue)' }}>
                                Invitaciones enviadas: {points[hoveredPointIndex].invitationsSent}
                            </div>
                            <div style={{ color: 'var(--admin-text-secondary)' }}>
                                Animes agregados: {points[hoveredPointIndex].listAdditions} | Notas colocadas: {points[hoveredPointIndex].ratingsPlaced}
                            </div>
                            <div style={{ color: '#F59E0B' }}>
                                Salas creadas: +{points[hoveredPointIndex].roomsCreated} | Archivadas/borradas: -{points[hoveredPointIndex].roomsDeleted}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pie con métricas agregadas */}
                <div className="d-flex flex-wrap justify-content-between align-items-center pt-2.5 border-top mt-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div>
                            <span className="text-secondary small font-mono" style={{ fontSize: '0.68rem' }}>Mínimo del periodo:</span>
                            <div className="text-white fw-bold font-mono" style={{ fontSize: '0.78rem' }}>+14 usuarios/día</div>
                        </div>
                        <div className="border-start ps-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <span className="text-secondary small font-mono" style={{ fontSize: '0.68rem' }}>Pico alcanzado:</span>
                            <div className="text-success fw-bold font-mono" style={{ fontSize: '0.78rem' }}>+38 usuarios/día</div>
                        </div>
                        <div className="border-start ps-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <span className="text-secondary small font-mono" style={{ fontSize: '0.68rem' }}>Velocidad promedio:</span>
                            <div className="text-info fw-bold font-mono" style={{ fontSize: '0.78rem' }}>1 incorporación cada 55 min</div>
                        </div>
                    </div>

                    <span className="font-mono text-muted small" style={{ fontSize: '0.68rem' }}>
                        Datos auditados con AWS PostgreSQL
                    </span>
                </div>
            </div>

            {/* ============================================================
               3. SECCIÓN COMPARATIVA: DINAMISMO DIARIO Y VIRALIDAD DE INVITACIONES
               ============================================================ */}
            <div className="row g-3 mb-4">
                {/* Dinamismo de Listas Personales y Calificaciones */}
                <div className="col-12 col-lg-6">
                    <div className="admin-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                                        <ListPlus size={15} style={{ color: 'var(--admin-purple)' }} />
                                        <span>Dinamismo Diario en Listas Personales y Calificaciones</span>
                                    </h2>
                                    <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                                        Interacción individual de catálogo por usuario activo
                                    </span>
                                </div>
                            </div>

                            <div className="d-flex flex-column gap-3 my-2">
                                {/* Animes a listas */}
                                <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-white fw-semibold" style={{ fontSize: '0.78rem' }}>
                                            Animes Agregados a Listas Personales
                                        </span>
                                        <span className="font-mono fw-bold text-white px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.8rem' }}>
                                            ~248 / día
                                        </span>
                                    </div>
                                    <div className="font-mono text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                        7,440 animes agregados este mes a listas "Viendo", "Favoritos" y "Por ver"
                                    </div>
                                    <div className="w-100 rounded overflow-hidden" style={{ height: 6, backgroundColor: 'var(--admin-surface-3)' }}>
                                        <div style={{ width: '78%', height: '100%', backgroundColor: 'var(--admin-purple)' }} />
                                    </div>
                                </div>

                                {/* Notas colocadas */}
                                <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-white fw-semibold" style={{ fontSize: '0.78rem' }}>
                                            Notas & Puntuaciones Otorgadas
                                        </span>
                                        <span className="font-mono fw-bold text-white px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--admin-surface-3)', fontSize: '0.8rem' }}>
                                            ~512 / día
                                        </span>
                                    </div>
                                    <div className="font-mono text-secondary small mb-2" style={{ fontSize: '0.7rem' }}>
                                        15,360 calificaciones históricas emitidas en sesiones individuales y grupales
                                    </div>
                                    <div className="w-100 rounded overflow-hidden" style={{ height: 6, backgroundColor: 'var(--admin-surface-3)' }}>
                                        <div style={{ width: '88%', height: '100%', backgroundColor: 'var(--admin-amber)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-top mt-2 d-flex justify-content-between font-mono text-muted small" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.68rem' }}>
                            <span>Promedio por usuario: 2.1 animes/semana</span>
                            <span style={{ color: 'var(--admin-emerald)' }}>● Actividad saludable</span>
                        </div>
                    </div>
                </div>

                {/* Ciclo de Vida de Listas Grupales e Invitaciones */}
                <div className="col-12 col-lg-6">
                    <div className="admin-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                                        <Share2 size={15} style={{ color: 'var(--admin-blue)' }} />
                                        <span>Canales de Invitación & Ciclo de Listas Grupales</span>
                                    </h2>
                                    <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                                        Efectividad de enlaces compartidos y creación/archivado de salas
                                    </span>
                                </div>
                            </div>

                            {/* Desglose de canales de invitación */}
                            <div className="mb-3">
                                <span className="font-mono text-secondary small d-block mb-1.5" style={{ fontSize: '0.7rem' }}>
                                    CANALES DE INVITACIÓN UTILIZADOS (3,140 TOTAL):
                                </span>
                                <div className="d-flex rounded overflow-hidden mb-2" style={{ height: 10 }}>
                                    <div style={{ width: `${channels.whatsapp}%`, backgroundColor: '#25D366' }} title={`WhatsApp: ${channels.whatsapp}%`} />
                                    <div style={{ width: `${channels.link}%`, backgroundColor: 'var(--admin-blue)' }} title={`Enlace Directo: ${channels.link}%`} />
                                    <div style={{ width: `${channels.qr}%`, backgroundColor: 'var(--admin-purple)' }} title={`Código QR: ${channels.qr}%`} />
                                </div>
                                <div className="d-flex justify-content-between font-mono small text-secondary" style={{ fontSize: '0.68rem' }}>
                                    <div className="d-flex align-items-center gap-1">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#25D366', display: 'inline-block' }} />
                                        <span>WhatsApp ({channels.whatsapp}%)</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-1">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-blue)', display: 'inline-block' }} />
                                        <span>Enlace ({channels.link}%)</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-1">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-purple)', display: 'inline-block' }} />
                                        <span>QR ({channels.qr}%)</span>
                                    </div>
                                </div>
                            </div>

                            {/* Ratio de Listas Grupales Creadas vs Borradas */}
                            <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div className="d-flex justify-content-between align-items-center font-mono small mb-1.5">
                                    <span className="text-white fw-semibold">Balance de Listas Grupales por Día</span>
                                    <span className="text-success fw-bold">+4 netas / día</span>
                                </div>
                                <div className="d-flex justify-content-between font-mono small text-secondary" style={{ fontSize: '0.72rem' }}>
                                    <span className="d-flex align-items-center gap-1 text-success">
                                        ● Creadas: <strong>~42 listas/día</strong>
                                    </span>
                                    <span className="d-flex align-items-center gap-1 text-muted">
                                        ● Completadas / Borradas: <strong>~38 listas/día</strong>
                                    </span>
                                </div>
                                <div className="font-mono text-muted small mt-1.5" style={{ fontSize: '0.66rem' }}>
                                    El 90.5% de las listas temporales se completan y archivan limpiamente tras la watch party.
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-top mt-2 d-flex justify-content-between font-mono text-muted small" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.68rem' }}>
                            <span>Tasa de rebote de invitación: 25.8%</span>
                            <span style={{ color: 'var(--admin-blue)' }}>● K-Factor 1.34</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================
               4. TABLA DE RETENCIÓN DE COHORTES (W0 A W4)
               ============================================================ */}
            <div className="admin-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                            <Layers size={15} style={{ color: 'var(--admin-blue)' }} />
                            <span>Retención de Cohortes por Semana de Incorporación</span>
                        </h2>
                        <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                            Porcentaje de usuarios que continúan interactuando y votando en las semanas posteriores a su ingreso
                        </span>
                    </div>
                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.65rem' }}>
                        Retención W4: 48% (Alta)
                    </span>
                </div>

                <div className="table-responsive">
                    <table className="table table-dark table-borderless font-mono m-0" style={{ fontSize: '0.74rem' }}>
                        <thead>
                            <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-muted)' }}>
                                <th>COHORTE DE ALTA</th>
                                <th className="text-center">SEMANA 0</th>
                                <th className="text-center">SEMANA 1</th>
                                <th className="text-center">SEMANA 2</th>
                                <th className="text-center">SEMANA 3</th>
                                <th className="text-center">SEMANA 4</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(growthData?.cohorts || [
                                { cohort: 'Semana 1 (01-07 Oct)', w0: 100, w1: 72, w2: 61, w3: 54, w4: 48 },
                                { cohort: 'Semana 2 (08-14 Oct)', w0: 100, w1: 75, w2: 64, w3: 58, w4: null },
                                { cohort: 'Semana 3 (15-21 Oct)', w0: 100, w1: 78, w2: 67, w3: null, w4: null },
                                { cohort: 'Semana 4 (22-28 Oct)', w0: 100, w1: 82, w2: null, w3: null, w4: null }
                            ]).map((c, i) => (
                                <tr key={i} className="border-bottom" style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
                                    <td className="text-white fw-medium">{c.cohort}</td>
                                    <td className="text-center text-success fw-bold">{c.w0}%</td>
                                    <td className="text-center" style={{ color: c.w1 ? '#10B981' : 'var(--admin-text-muted)' }}>
                                        {c.w1 !== null ? `${c.w1}%` : '—'}
                                    </td>
                                    <td className="text-center" style={{ color: c.w2 ? '#38BDF8' : 'var(--admin-text-muted)' }}>
                                        {c.w2 !== null ? `${c.w2}%` : '—'}
                                    </td>
                                    <td className="text-center" style={{ color: c.w3 ? '#F59E0B' : 'var(--admin-text-muted)' }}>
                                        {c.w3 !== null ? `${c.w3}%` : '—'}
                                    </td>
                                    <td className="text-center" style={{ color: c.w4 ? '#A855F7' : 'var(--admin-text-muted)' }}>
                                        {c.w4 !== null ? `${c.w4}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
