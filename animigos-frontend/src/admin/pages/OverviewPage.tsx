import { useState, useEffect } from 'react'
import {
    Clock,
    Flame,
    RefreshCw,
    Database,
    ChevronRight,
    Sparkles,
    SlidersHorizontal
} from 'lucide-react'
import { getOverview, getRooms } from '../services/adminApi'
import type { OverviewResponse, RoomItem } from '../services/adminApi'
import { AdminDrilldownDrawer } from '../components/AdminDrilldownDrawer'

interface FunnelStepInfo {
    id: string
    title: string
    shortDesc: string
    count: number
    pct: number
    color: string
    conversionFromPrev: string
    bottleneckAnalysis: string
    roomsInStage: RoomItem[]
    operationalTip: string
}

export function OverviewPage() {
    const [data, setData] = useState<OverviewResponse | null>(null)
    const [rooms, setRooms] = useState<RoomItem[]>([])
    const [, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Estado del Drill-down interactivo
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
    const [hoveredStepId, setHoveredStepId] = useState<string | null>(null)

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

    const summary = data?.summary || {
        total_rooms: 0,
        active_rooms: 0,
        concluded_rooms: 0,
        total_members: 0,
        total_votes: 0,
        consensus_rate: 0,
        avg_decision_time_minutes: 8.5
    }

    // Estructura enriquecida del Embudo Interactivo con salas asociadas a cada fase
    const funnelSteps: FunnelStepInfo[] = [
        {
            id: 'guests',
            title: '1. Invitados Creados',
            shortDesc: 'Base de usuarios que crearon sesión o entraron por enlace de invitación',
            count: data?.funnel?.guests_created || 0,
            pct: 100,
            color: '#A1A1AA',
            conversionFromPrev: '100%',
            bottleneckAnalysis: 'El 100% de los visitantes crea una sesión anónima segura o token de invitado sin fricción.',
            roomsInStage: rooms.filter(r => r.status === 'watching'),
            operationalTip: 'Verifica la latencia de creación de token de sesión si la conversión inicial disminuye.'
        },
        {
            id: 'joined',
            title: '2. Unidos a Salas Activas',
            shortDesc: 'Invitados que ingresaron el código PIN o link directo y figuran en el quórum',
            count: data?.funnel?.joined_room || 0,
            pct: data?.funnel?.guests_created ? Math.min(100, Math.round((data.funnel.joined_room / data.funnel.guests_created) * 100)) : 100,
            color: '#38BDF8',
            conversionFromPrev: data?.funnel?.guests_created ? `${Math.min(100, Math.round((data.funnel.joined_room / data.funnel.guests_created) * 100))}%` : '100%',
            bottleneckAnalysis: 'Usuarios sincronizados en salas. Si un usuario no se une a una sala en los primeros 3 minutos, suele abandonar.',
            roomsInStage: rooms.filter(r => r.status === 'candidates'),
            operationalTip: 'Asegura que el código de sala PIN de 4 dígitos sea visible y fácil de copiar en móviles.'
        },
        {
            id: 'voted',
            title: '3. Quórum de Votos Emitido',
            shortDesc: 'Participantes que completaron la votación sobre los animes candidatos',
            count: data?.funnel?.voted || 0,
            pct: data?.funnel?.joined_room ? Math.min(100, Math.round((data.funnel.voted / data.funnel.joined_room) * 100)) : 0,
            color: '#F59E0B',
            conversionFromPrev: data?.funnel?.joined_room ? `${Math.round((data.funnel.voted / data.funnel.joined_room) * 100)}% de los unidos` : '0%',
            bottleneckAnalysis: 'Fase de decisión. Los empates en 2da ronda o retrasos en emitir voto generan fricción temporal.',
            roomsInStage: rooms.filter(r => r.status === 'voting'),
            operationalTip: 'Revisa las salas con quórum incompleto para disparar notificaciones o recordatorios automáticos.'
        },
        {
            id: 'winner',
            title: '4. Consenso Logrado (Ganador)',
            shortDesc: 'Salas que cerraron con anime elegido por el algoritmo de felicidad colectiva',
            count: data?.funnel?.winner_selected || 0,
            pct: data?.funnel?.joined_room ? Math.min(100, Math.round((data.funnel.winner_selected / data.funnel.joined_room) * 100)) : 0,
            color: '#10B981',
            conversionFromPrev: `${summary.consensus_rate}% de tasa global`,
            bottleneckAnalysis: 'Resultado final óptimo: la fórmula Score = μ - 0.3σ determinó un título ganador aceptado unánimemente.',
            roomsInStage: rooms.filter(r => r.status === 'selected' || r.status === 'completed'),
            operationalTip: 'Las salas en este estado pasan automáticamente a la Watch Party para reproducción sincronizada.'
        }
    ]

    const selectedStep = funnelSteps.find(s => s.id === selectedStepId) || null

    return (
        <div className="d-flex flex-column gap-4">
            {/* Cabecera con selector contextual y sincronización */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                    <h1 className="admin-title m-0" style={{ fontSize: '1.25rem' }}>
                        Embudo de Decisión Grupal
                    </h1>
                    <p className="admin-subtitle m-0 mt-0.5">
                        Una visualización protagonista: analiza la pérdida o retención en cada fase del consenso
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        {isRefreshing ? (
                            <span className="admin-spinner"></span>
                        ) : (
                            <RefreshCw size={13} style={{ color: 'var(--admin-text-muted)' }} />
                        )}
                        <span>{isRefreshing ? 'Actualizando...' : 'Refrescar'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#F87171', fontSize: '0.8rem' }}>
                    <strong>Aviso:</strong> {error}
                </div>
            )}

            {/* Micro-KPIs Curados (Solo 3 métricas vitales sin ruido visual) */}
            <div className="row g-3">
                <div className="col-12 col-md-4">
                    <div className="admin-card d-flex align-items-center justify-content-between py-3">
                        <div>
                            <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.06em' }}>
                                Tasa de Consenso
                            </span>
                            <div className="d-flex align-baseline gap-2 mt-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{summary.consensus_rate}%</span>
                                <span className="font-mono small" style={{ color: 'var(--admin-emerald)', fontSize: '0.72rem' }}>
                                    {summary.concluded_rooms} resueltas
                                </span>
                            </div>
                        </div>
                        <div className="p-2 rounded-2" style={{ backgroundColor: 'var(--admin-emerald-bg)', border: '1px solid var(--admin-emerald-border)', color: 'var(--admin-emerald)' }}>
                            <Flame size={18} />
                        </div>
                    </div>
                </div>

                <div className="col-12 col-md-4">
                    <div className="admin-card d-flex align-items-center justify-content-between py-3">
                        <div>
                            <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.06em' }}>
                                Velocidad a Decisión (TTC)
                            </span>
                            <div className="d-flex align-baseline gap-2 mt-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{summary.avg_decision_time_minutes}m</span>
                                <span className="font-mono text-muted small" style={{ fontSize: '0.72rem' }}>
                                    promedio grupal
                                </span>
                            </div>
                        </div>
                        <div className="p-2 rounded-2" style={{ backgroundColor: 'var(--admin-blue-bg)', border: '1px solid var(--admin-blue-border)', color: 'var(--admin-blue)' }}>
                            <Clock size={18} />
                        </div>
                    </div>
                </div>

                <div className="col-12 col-md-4">
                    <div className="admin-card d-flex align-items-center justify-content-between py-3">
                        <div>
                            <span className="admin-subtitle d-block text-uppercase" style={{ fontSize: '0.66rem', letterSpacing: '0.06em' }}>
                                Catálogo en AWS PostgreSQL
                            </span>
                            <div className="d-flex align-baseline gap-2 mt-1">
                                <span className="fs-3 fw-bold text-white lh-1 font-mono">{data?.health.total_animes?.toLocaleString() || '30,777'}</span>
                                <span className="font-mono small" style={{ color: 'var(--admin-emerald)', fontSize: '0.72rem' }}>
                                    {data?.health.latency_ms || 14}ms ping
                                </span>
                            </div>
                        </div>
                        <div className="p-2 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                            <Database size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================
               EL GRÁFICO PROTAGONISTA INTERACTIVO (1 Visualización Central)
               ============================================================ */}
            <div className="admin-chart-stage">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Arquitectura de Flujo: De Visitante a Anime Ganador
                            </h2>
                            <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.65rem' }}>
                                Click para Drill-down
                            </span>
                        </div>
                        <p className="admin-subtitle m-0 mt-1">
                            Haz clic en cualquiera de las 4 fases para abrir el desglose de salas, causas de abandono y métricas en profundidad.
                        </p>
                    </div>

                    <div className="font-mono small text-secondary" style={{ fontSize: '0.74rem' }}>
                        Muestra: <span className="text-white fw-bold">{summary.total_members} usuarios</span> en {summary.total_rooms} salas
                    </div>
                </div>

                {/* Escenario del Embudo Interactivo */}
                <div className="d-flex flex-column gap-3 py-2">
                    {funnelSteps.map((step, idx) => {
                        const isHovered = hoveredStepId === step.id
                        const isSelected = selectedStepId === step.id
                        const isDimmed = (hoveredStepId && !isHovered) || (selectedStepId && !isSelected)

                        return (
                            <div
                                key={step.id}
                                onClick={() => setSelectedStepId(step.id)}
                                onMouseEnter={() => setHoveredStepId(step.id)}
                                onMouseLeave={() => setHoveredStepId(null)}
                                className={`admin-chart-interactive-node p-3 rounded-2 ${isDimmed ? 'dimmed' : ''} ${isSelected ? 'active-focus' : ''}`}
                                style={{
                                    backgroundColor: isSelected ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                    border: isSelected ? `1.5px solid ${step.color}` : '1px solid var(--admin-border-subtle)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-2">
                                    <div className="d-flex align-items-center gap-2.5">
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center text-black fw-bold font-mono"
                                            style={{
                                                width: 24,
                                                height: 24,
                                                backgroundColor: step.color,
                                                fontSize: '0.72rem'
                                            }}
                                        >
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <span className="fw-semibold text-white d-block" style={{ fontSize: '0.88rem' }}>
                                                {step.title}
                                            </span>
                                            <span className="admin-subtitle d-none d-md-block" style={{ fontSize: '0.72rem' }}>
                                                {step.shortDesc}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-center gap-4 text-end">
                                        <div>
                                            <span className="font-mono fs-5 fw-bold text-white d-block lh-1">
                                                {step.count.toLocaleString()}
                                            </span>
                                            <span className="font-mono text-muted small" style={{ fontSize: '0.68rem' }}>
                                                {idx === 0 ? 'Visitantes base' : `${step.pct}% conversión`}
                                            </span>
                                        </div>

                                        <div
                                            className="d-flex align-items-center justify-content-center rounded-circle"
                                            style={{
                                                width: 28,
                                                height: 28,
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                color: isHovered || isSelected ? '#FFFFFF' : 'var(--admin-text-muted)',
                                                border: '1px solid var(--admin-border-subtle)'
                                            }}
                                        >
                                            <ChevronRight size={15} />
                                        </div>
                                    </div>
                                </div>

                                {/* Barra de Proporción y Progresión Visual */}
                                <div className="admin-progress-track" style={{ height: 6 }}>
                                    <div
                                        className="admin-progress-bar"
                                        style={{
                                            width: `${step.pct}%`,
                                            backgroundColor: step.color
                                        }}
                                    ></div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center mt-2 font-mono" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                                    <span>Salas en esta fase: <strong className="text-white">{step.roomsInStage.length}</strong></span>
                                    <span style={{ color: step.color }}>{step.conversionFromPrev}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Pie del Gráfico Protagonista con sugerencia de acción */}
                <div className="mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                    <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                        💡 <strong>Sugerencia Pedagógica:</strong> Haz clic en <em>"3. Quórum de Votos Emitido"</em> para auditar salas que sufren retrasos antes del desempate.
                    </span>
                    <span className="font-mono admin-badge admin-badge-neutral" style={{ fontSize: '0.68rem' }}>
                        Fórmula: μ - 0.3σ
                    </span>
                </div>
            </div>

            {/* ============================================================
               DRILL-DOWN CONTEXTUAL (DRAWER LATERAL DE NIVEL 2)
               ============================================================ */}
            <AdminDrilldownDrawer
                isOpen={!!selectedStep}
                onClose={() => setSelectedStepId(null)}
                title={selectedStep?.title || 'Detalle del Paso'}
                subtitle={selectedStep?.shortDesc}
                badgeText={`${selectedStep?.count.toLocaleString()} registros (${selectedStep?.pct}%)`}
                badgeType={selectedStep?.id === 'winner' ? 'success' : 'info'}
            >
                {selectedStep && (
                    <div className="d-flex flex-column gap-3.5">
                        {/* Diagnóstico del cuello de botella */}
                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex align-items-center gap-2 mb-1.5 text-white fw-semibold" style={{ fontSize: '0.82rem' }}>
                                <Sparkles size={15} style={{ color: selectedStep.color }} />
                                <span>Diagnóstico de Telemetría</span>
                            </div>
                            <p className="admin-subtitle m-0" style={{ fontSize: '0.78rem', lineHeight: 1.45 }}>
                                {selectedStep.bottleneckAnalysis}
                            </p>
                        </div>

                        {/* Recomendación operativa */}
                        <div className="p-3 rounded-2" style={{ backgroundColor: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <div className="d-flex align-items-center gap-2 mb-1 text-info fw-semibold font-mono" style={{ fontSize: '0.74rem' }}>
                                <SlidersHorizontal size={13} />
                                <span>RECOMENDACIÓN DE ARQUITECTURA</span>
                            </div>
                            <p className="m-0 text-white" style={{ fontSize: '0.76rem', lineHeight: 1.4 }}>
                                {selectedStep.operationalTip}
                            </p>
                        </div>

                        {/* Salas filtradas en este paso específico */}
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="admin-title m-0" style={{ fontSize: '0.88rem' }}>
                                    Salas en esta etapa ({selectedStep.roomsInStage.length})
                                </span>
                                <span className="font-mono small text-muted" style={{ fontSize: '0.7rem' }}>
                                    PostgreSQL Live
                                </span>
                            </div>

                            {selectedStep.roomsInStage.length === 0 ? (
                                <div className="text-center py-4 text-muted small border rounded-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    No hay salas activas estancadas en esta fase actualmente.
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {selectedStep.roomsInStage.map((room) => {
                                        const displayTitle = room.selected_anime?.title || room.top_candidate?.title || 'Pendiente'
                                        return (
                                            <div
                                                key={room.id}
                                                className="p-2.5 rounded-2 d-flex align-items-center justify-content-between gap-2"
                                                style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}
                                            >
                                                <div className="overflow-hidden">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="fw-semibold text-white text-truncate" style={{ fontSize: '0.8rem' }}>
                                                            {room.name}
                                                        </span>
                                                        <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.62rem' }}>
                                                            {room.invite_code}
                                                        </span>
                                                    </div>
                                                    <span className="d-block text-secondary small text-truncate mt-0.5" style={{ fontSize: '0.72rem' }}>
                                                        {displayTitle} • {room.members_count} miembros
                                                    </span>
                                                </div>

                                                <div className="text-end font-mono flex-shrink-0">
                                                    <span className="admin-badge admin-badge-info" style={{ fontSize: '0.66rem' }}>
                                                        {room.quorum_percentage}% quórum
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </AdminDrilldownDrawer>
        </div>
    )
}
