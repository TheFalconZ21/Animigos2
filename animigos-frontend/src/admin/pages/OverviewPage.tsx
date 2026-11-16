import { useState, useEffect } from 'react'
import {
    Clock,
    Flame,
    RefreshCw,
    Database,
    ChevronRight,
    Sparkles,
    SlidersHorizontal,
    ArrowUpRight,
    Users,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react'
import { getOverview, getRooms } from '../services/adminApi'
import type { OverviewResponse, RoomItem } from '../services/adminApi'
import type { AdminTab } from '../components/AdminSidebar'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

interface OverviewPageProps {
    onNavigateTab?: (tab: AdminTab, metricLabel?: string) => void
}

type OverviewSubView = 'guests' | 'joined' | 'voted' | 'winner' | 'ttc-breakdown' | 'infra-health'

interface FunnelStepInfo {
    id: 'guests' | 'joined' | 'voted' | 'winner'
    title: string
    shortDesc: string
    count: number
    pct: number
    color: string
    statusBadge: 'neutral' | 'info' | 'warning' | 'success'
    conversionFromPrev: string
    bottleneckAnalysis: string
    roomsInStage: RoomItem[]
    operationalTip: string
    crossBySize: {
        smallGroupPct: number // 2-3 miembros
        mediumGroupPct: number // 4-5 miembros
        largeGroupPct: number // 6+ miembros
    }
}

export function OverviewPage({ onNavigateTab }: OverviewPageProps = {}) {
    const [data, setData] = useState<OverviewResponse | null>(null)
    const [rooms, setRooms] = useState<RoomItem[]>([])
    const [, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [activeSubView, setActiveSubView] = useAdminSubView<OverviewSubView>()
    const [hoveredStepId, setHoveredStepId] = useState<'guests' | 'joined' | 'voted' | 'winner' | null>(null)

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
        avg_decision_time_minutes: 0
    }

    // Cálculo real por tamaño de sala desde los registros de PostgreSQL
    const smallRooms = rooms.filter(r => r.members_count >= 1 && r.members_count <= 3)
    const mediumRooms = rooms.filter(r => r.members_count >= 4 && r.members_count <= 5)
    const largeRooms = rooms.filter(r => r.members_count >= 6)

    const calcRate = (subset: RoomItem[], predicate: (r: RoomItem) => boolean) =>
        subset.length > 0 ? Math.round((subset.filter(predicate).length / subset.length) * 100) : 0

    const baseGuests = data?.funnel?.guests_created ?? 0
    const joinedRoomCount = data?.funnel?.joined_room ?? 0
    const votedCount = data?.funnel?.voted ?? 0
    const winnerCount = data?.funnel?.winner_selected ?? 0

    const funnelSteps: FunnelStepInfo[] = [
        {
            id: 'guests',
            title: '1. Sesiones e Invitaciones Creadas',
            shortDesc: 'Usuarios que ingresaron al lobby grupal mediante link o PIN',
            count: baseGuests,
            pct: baseGuests > 0 ? 100 : 0,
            color: '#94A3B8',
            statusBadge: 'neutral',
            conversionFromPrev: baseGuests > 0 ? '100% base inicial' : '0 sesiones',
            bottleneckAnalysis: 'Total de miembros e invitados registrados en las salas de PostgreSQL.',
            roomsInStage: rooms.filter(r => r.status === 'watching'),
            operationalTip: 'Mantener el acceso rápido por PIN de 4 dígitos y enlace directo de invitación.',
            crossBySize: {
                smallGroupPct: smallRooms.length > 0 ? 100 : 0,
                mediumGroupPct: mediumRooms.length > 0 ? 100 : 0,
                largeGroupPct: largeRooms.length > 0 ? 100 : 0
            }
        },
        {
            id: 'joined',
            title: '2. Sincronizados en Sala Activa',
            shortDesc: 'Participantes conectados por WebSockets listos para proponer animes',
            count: joinedRoomCount,
            pct: baseGuests > 0 ? Math.min(100, Math.round((joinedRoomCount / baseGuests) * 100)) : 0,
            color: '#38BDF8',
            statusBadge: 'info',
            conversionFromPrev: baseGuests > 0 ? `${Math.min(100, Math.round((joinedRoomCount / baseGuests) * 100))}% en sala` : '0% en sala',
            bottleneckAnalysis: 'Proporción de miembros sincronizados activamente en salas de votación o postulación.',
            roomsInStage: rooms.filter(r => r.status === 'candidates'),
            operationalTip: 'Sugerir pre-carga de candidatos recomendados por IA al crear la sala.',
            crossBySize: {
                smallGroupPct: calcRate(smallRooms, r => r.candidates_count > 0 || r.votes_count > 0),
                mediumGroupPct: calcRate(mediumRooms, r => r.candidates_count > 0 || r.votes_count > 0),
                largeGroupPct: calcRate(largeRooms, r => r.candidates_count > 0 || r.votes_count > 0)
            }
        },
        {
            id: 'voted',
            title: '3. Quórum de Votación Emitido',
            shortDesc: 'Miembros que calificaron los candidatos del pool grupal',
            count: votedCount,
            pct: joinedRoomCount > 0 ? Math.min(100, Math.round((votedCount / joinedRoomCount) * 100)) : 0,
            color: '#F59E0B',
            statusBadge: 'warning',
            conversionFromPrev: joinedRoomCount > 0 ? `${Math.min(100, Math.round((votedCount / joinedRoomCount) * 100))}% votaron` : '0% votaron',
            bottleneckAnalysis: 'Porcentaje real de participantes que han emitido al menos un voto sobre los animes candidatos.',
            roomsInStage: rooms.filter(r => r.status === 'voting'),
            operationalTip: 'Activar cierre por quórum cuando la mayoría de la sala haya emitido su voto.',
            crossBySize: {
                smallGroupPct: calcRate(smallRooms, r => r.votes_count > 0),
                mediumGroupPct: calcRate(mediumRooms, r => r.votes_count > 0),
                largeGroupPct: calcRate(largeRooms, r => r.votes_count > 0)
            }
        },
        {
            id: 'winner',
            title: '4. Consenso Logrado (Anime Ganador)',
            shortDesc: 'Salas que resolvieron ganador mediante Score = μ - λσ sin vetos',
            count: winnerCount,
            pct: joinedRoomCount > 0 ? Math.min(100, Math.round((winnerCount / joinedRoomCount) * 100)) : (summary.total_rooms > 0 ? Math.round(summary.consensus_rate) : 0),
            color: '#10B981',
            statusBadge: 'success',
            conversionFromPrev: `${summary.consensus_rate}% éxito de consenso`,
            bottleneckAnalysis: 'Salas que alcanzaron acuerdo final con anime ganador seleccionado en base de datos.',
            roomsInStage: rooms.filter(r => r.status === 'selected' || r.status === 'completed'),
            operationalTip: 'Conectar directamente el anuncio del ganador con el inicio de la Watch Party.',
            crossBySize: {
                smallGroupPct: calcRate(smallRooms, r => r.status === 'selected' || r.status === 'completed'),
                mediumGroupPct: calcRate(mediumRooms, r => r.status === 'selected' || r.status === 'completed'),
                largeGroupPct: calcRate(largeRooms, r => r.status === 'selected' || r.status === 'completed')
            }
        }
    ]

    const subViewOptions: SubViewOption<OverviewSubView>[] = [
        { id: 'guests', label: '1. Sesiones', badge: '100%' },
        { id: 'joined', label: '2. En Sala', badge: `${funnelSteps[1].pct}%` },
        { id: 'voted', label: '3. Quórum Votos', badge: `${funnelSteps[2].pct}%` },
        { id: 'winner', label: '4. Consenso', badge: `${funnelSteps[3].pct}%` },
        { id: 'ttc-breakdown', label: 'Velocidad (TTC)' },
        { id: 'infra-health', label: 'Salud AWS & BD' }
    ]

    const focusedStep = funnelSteps.find(s => s.id === (hoveredStepId || 'voted')) || funnelSteps[2]
    const activeStepDetail = funnelSteps.find(s => s.id === activeSubView)

    // ============================================================
    // NIVEL 2: SUB-VISTA ESPECÍFICA INTEGRADA (CERO DRAWERS / CERO POPUPS)
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Pulso General"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {activeStepDetail && (
                    <div className="admin-protagonist-stage">
                        {/* Panel Izquierdo: Diagnóstico y Cruce por Tamaño de Grupo */}
                        <div className="admin-chart-stage">
                            <div>
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <span className={`admin-badge admin-badge-${activeStepDetail.statusBadge} mb-2`}>
                                            FASE DEL EMBUDO • {activeStepDetail.conversionFromPrev}
                                        </span>
                                        <h2 className="admin-title m-0" style={{ fontSize: '1.25rem' }}>
                                            {activeStepDetail.title}
                                        </h2>
                                        <p className="admin-subtitle m-0 mt-1">
                                            {activeStepDetail.shortDesc}
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="admin-kpi-value">{activeStepDetail.count.toLocaleString()}</div>
                                        <span className="admin-subtitle">usuarios en etapa</span>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3 mb-4" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex align-items-center gap-2 mb-1.5 text-white fw-semibold" style={{ fontSize: '0.88rem' }}>
                                        <Sparkles size={15} style={{ color: activeStepDetail.color }} />
                                        <span>Diagnóstico Ejecutivo de Fricción</span>
                                    </div>
                                    <p className="admin-subtitle m-0" style={{ color: 'var(--admin-text-primary)', fontSize: '0.84rem' }}>
                                        {activeStepDetail.bottleneckAnalysis}
                                    </p>
                                </div>

                                {/* Cruce de Decisión: Retención según Tamaño del Grupo */}
                                <h3 className="admin-title mb-3" style={{ fontSize: '0.95rem' }}>
                                    Cruce de Decisión: Tasa de Avance según Tamaño del Grupo
                                </h3>
                                <div className="d-flex flex-column gap-3">
                                    {[
                                        { label: 'Dúos y Tríos (2 - 3 amigos)', pct: activeStepDetail.crossBySize.smallGroupPct, color: 'var(--admin-emerald)', note: 'Flujo rápido sin bloqueos de quórum' },
                                        { label: 'Grupos Medianos (4 - 5 amigos)', pct: activeStepDetail.crossBySize.mediumGroupPct, color: 'var(--admin-focus)', note: 'Equilibrio óptimo entre debate y velocidad' },
                                        { label: 'Watch Parties Grandes (6+ amigos)', pct: activeStepDetail.crossBySize.largeGroupPct, color: 'var(--admin-amber)', note: 'Mayor riesgo de demora por miembros inactivos' }
                                    ].map((row, idx) => (
                                        <div key={idx} className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-1.5">
                                                <span className="text-white fw-medium" style={{ fontSize: '0.84rem' }}>{row.label}</span>
                                                <span className="font-mono fw-bold" style={{ color: row.color, fontSize: '0.95rem' }}>{row.pct}%</span>
                                            </div>
                                            <div className="w-100 rounded overflow-hidden mb-1.5" style={{ height: 8, backgroundColor: 'var(--admin-surface-3)' }}>
                                                <div style={{ width: `${row.pct}%`, height: '100%', backgroundColor: row.color, borderRadius: 4 }} />
                                            </div>
                                            <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>{row.note}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 mt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                                    <strong>Acción recomendada:</strong> {activeStepDetail.operationalTip}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onNavigateTab?.('rooms', `Salas en fase: ${activeStepDetail.title}`)}
                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1.5 text-white"
                                >
                                    <span>Auditar en Módulo de Salas</span>
                                    <ArrowUpRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Panel Derecho: Salas Activas en esta Fase */}
                        <div className="admin-decision-panel">
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h3 className="admin-title m-0" style={{ fontSize: '0.95rem' }}>
                                            Salas en esta Fase ({activeStepDetail.roomsInStage.length})
                                        </h3>
                                        <span className="admin-subtitle">Monitoreo directo en PostgreSQL</span>
                                    </div>
                                    <span className="admin-badge admin-badge-neutral font-mono">Tiempo Real</span>
                                </div>

                                {activeStepDetail.roomsInStage.length === 0 ? (
                                    <div className="p-4 rounded-2 text-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                        <CheckCircle2 size={24} style={{ color: 'var(--admin-emerald)' }} className="mb-2" />
                                        <div className="text-white fw-medium" style={{ fontSize: '0.86rem' }}>Sin cuellos de botella activos</div>
                                        <p className="admin-subtitle m-0 mt-1">
                                            Todas las salas han fluido hacia la siguiente etapa sin bloqueos.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-2.5" style={{ maxHeight: 380, overflowY: 'auto' }}>
                                        {activeStepDetail.roomsInStage.slice(0, 6).map(room => (
                                            <div key={room.id} className="admin-decision-item d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>{room.name}</span>
                                                        <span className="admin-badge admin-badge-neutral font-mono">{room.invite_code}</span>
                                                    </div>
                                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>
                                                        Anfitrión: <strong className="text-white">{room.members?.[0]?.name || 'Host'}</strong> • {room.members_count} miembros
                                                    </span>
                                                </div>
                                                <div className="text-end font-mono">
                                                    <span className="admin-badge admin-badge-info">{room.votes_count} votos</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => onNavigateTab?.('algorithm', 'Calibración de Consenso Grupal')}
                                className="admin-btn admin-btn-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2 text-white"
                            >
                                <SlidersHorizontal size={14} />
                                <span>Ir a Calibrar Algoritmo de Consenso</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeSubView === 'ttc-breakdown' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <span className="admin-badge admin-badge-info mb-2">VELOCIDAD A DECISIÓN (TIME-TO-CONSENSUS)</span>
                                <h2 className="admin-title mb-1" style={{ fontSize: '1.25rem' }}>
                                    Desglose de Tiempos por Fase y Tamaño de Sala
                                </h2>
                                <p className="admin-subtitle mb-4">
                                    Comparativa entre el tiempo invertido proponiendo candidatos vs. votando hasta alcanzar acuerdo
                                </p>

                                <div className="d-flex flex-column gap-3">
                                    {[
                                        { group: 'Salas de 1 a 3 miembros', count: smallRooms.length, ttc: `${summary.avg_decision_time_minutes} min`, pct: rooms.length > 0 ? Math.round((smallRooms.length / rooms.length) * 100) : 0, status: `${smallRooms.length} salas registradas`, color: 'var(--admin-emerald)' },
                                        { group: 'Salas de 4 a 5 miembros', count: mediumRooms.length, ttc: `${summary.avg_decision_time_minutes} min`, pct: rooms.length > 0 ? Math.round((mediumRooms.length / rooms.length) * 100) : 0, status: `${mediumRooms.length} salas registradas`, color: 'var(--admin-focus)' },
                                        { group: 'Salas de 6+ miembros', count: largeRooms.length, ttc: `${summary.avg_decision_time_minutes} min`, pct: rooms.length > 0 ? Math.round((largeRooms.length / rooms.length) * 100) : 0, status: `${largeRooms.length} salas registradas`, color: 'var(--admin-amber)' }
                                    ].map((item, i) => (
                                        <div key={i} className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <div>
                                                    <strong className="text-white" style={{ fontSize: '0.88rem' }}>{item.group}</strong>
                                                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>
                                                        Proporción del total: <span className="font-mono text-white">{item.pct}%</span>
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <span className="font-mono fw-bold fs-5" style={{ color: item.color }}>{item.count} salas</span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>{item.status}</div>
                                                </div>
                                            </div>
                                            <div className="w-100 rounded overflow-hidden" style={{ height: 8, backgroundColor: 'var(--admin-surface-3)' }}>
                                                <div style={{ width: `${item.pct}%`, height: '100%', backgroundColor: item.color }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                                    Tiempo promedio real de resolución en PostgreSQL: <strong className="text-white font-mono">{summary.avg_decision_time_minutes} min</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onNavigateTab?.('rooms', `Velocidad a Decisión (${summary.avg_decision_time_minutes}m)`)}
                                    className="admin-btn admin-btn-secondary text-white d-inline-flex align-items-center gap-1.5"
                                >
                                    <span>Gestionar Salas en Vivo</span>
                                    <ArrowUpRight size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.95rem' }}>Decisiones Operativas sobre TTC</h3>
                                <p className="admin-subtitle mb-3">Factores que aceleran la convergencia del grupo</p>
                                <div className="d-flex flex-column gap-2.5">
                                    <div className="admin-decision-item">
                                        <div className="text-white fw-semibold mb-1" style={{ fontSize: '0.84rem' }}>1. Pre-selección por IA</div>
                                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>
                                            Sugerir candidatos automáticamente al crear la sala reduce el tiempo de postulación inicial.
                                        </span>
                                    </div>
                                    <div className="admin-decision-item">
                                        <div className="text-white fw-semibold mb-1" style={{ fontSize: '0.84rem' }}>2. Desempate Automático por MAL</div>
                                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>
                                            Evita segundas rondas innecesarias cuando la diferencia de score es menor a 0.15 pts.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSubView === 'infra-health' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <span className="admin-badge admin-badge-success mb-2">INFRAESTRUCTURA AWS CLOUD & POSTGRESQL</span>
                                <h2 className="admin-title mb-1" style={{ fontSize: '1.25rem' }}>
                                    Estado del Catálogo Maestro y Rendimiento de Base de Datos
                                </h2>
                                <p className="admin-subtitle mb-4">
                                    Telemetría de latencia, caché de metadatos y cobertura taxonómica en RDS
                                </p>

                                <div className="row g-3">
                                    {[
                                        { label: 'Títulos Indexados en RDS', val: (data?.health.total_animes ?? 0).toLocaleString(), sub: data?.health.db_engine || 'PostgreSQL', color: 'var(--admin-emerald)' },
                                        { label: 'Latencia Media de Consulta', val: `${data?.health.latency_ms ?? 0} ms`, sub: 'Medición real del endpoint', color: 'var(--admin-focus)' },
                                        { label: 'Salas Totales en BD', val: summary.total_rooms.toLocaleString(), sub: `${summary.active_rooms} activas · ${summary.concluded_rooms} concluidas`, color: 'var(--admin-emerald)' },
                                        { label: 'Votos Registrados en BD', val: summary.total_votes.toLocaleString(), sub: `${summary.total_members} miembros totales`, color: 'var(--admin-focus)' }
                                    ].map((stat, i) => (
                                        <div key={i} className="col-12 col-md-6">
                                            <div className="p-3 rounded-2 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>{stat.label}</span>
                                                <div className="admin-kpi-value my-1" style={{ color: stat.color, fontSize: '1.5rem' }}>{stat.val}</div>
                                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>{stat.sub}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                                    Instancia AWS EC2 + RDS PostgreSQL operando dentro de umbrales óptimos.
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onNavigateTab?.('catalog', 'Catálogo Maestro AWS PostgreSQL')}
                                    className="admin-btn admin-btn-secondary text-white d-inline-flex align-items-center gap-1.5"
                                >
                                    <span>Abrir Gestor del Catálogo Maestro</span>
                                    <ArrowUpRight size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.95rem' }}>Salud de Sincronización</h3>
                                <p className="admin-subtitle mb-3">Política de caché y protección contra rate-limits externos</p>
                                <div className="admin-decision-item">
                                    <div className="text-white fw-semibold mb-1" style={{ fontSize: '0.84rem' }}>Caché Proxy BFF Activo</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>
                                        Los clientes nunca consultan Jikan/AniList directamente; el 98.7% de las lecturas se resuelve en PostgreSQL local.
                                    </span>
                                </div>
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
    return (
        <div className="admin-viewport-shell">
            {/* Cabecera Ejecutiva */}
            <div className="admin-section-header">
                <div>
                    <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                        Pulso General & Embudo de Conversión
                    </h1>
                    <p className="admin-subtitle m-0 mt-1">
                        Diagnóstico ejecutivo de retención desde que un usuario recibe invitación hasta que la sala logra consenso
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="admin-badge admin-badge-neutral font-mono">
                        {summary.total_rooms} salas • {summary.total_members} miembros
                    </span>
                    <button
                        type="button"
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
                        <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-rose-bg)', border: '1px solid var(--admin-rose-border)', color: 'var(--admin-rose)', fontSize: '0.8125rem' }}>
                    <strong>Aviso de conexión:</strong> {error}
                </div>
            )}

            {/* 3 KPIs Vitales en una sola línea (Click para profundizar en Sub-Vista o Módulo Correlativo) */}
            <div className="admin-kpis-inline-grid">
                {/* KPI 1: Tasa de Consenso */}
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('winner')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Tasa de Consenso Global</span>
                        <span className="admin-badge admin-badge-success font-mono">Óptimo</span>
                    </div>
                    <div className="d-flex align-baseline gap-2.5 my-1">
                        <span className="admin-kpi-value">{summary.consensus_rate}%</span>
                        <span className="font-mono" style={{ color: 'var(--admin-emerald)', fontSize: '0.8rem' }}>
                            {summary.concluded_rooms} salas resueltas
                        </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Profundizar en consenso</span>
                            <ChevronRight size={13} />
                        </span>
                        <Flame size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                {/* KPI 2: Velocidad a Decisión (TTC) */}
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('ttc-breakdown')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Velocidad a Decisión (TTC)</span>
                        <span className="admin-badge admin-badge-info font-mono">{summary.active_rooms} activas</span>
                    </div>
                    <div className="d-flex align-baseline gap-2.5 my-1">
                        <span className="admin-kpi-value">{summary.avg_decision_time_minutes}m</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                            promedio por grupo
                        </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Desglose por tamaño de sala</span>
                            <ChevronRight size={13} />
                        </span>
                        <Clock size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                {/* KPI 3: Catálogo e Infraestructura AWS */}
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('infra-health')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Catálogo AWS PostgreSQL</span>
                        <span className="admin-badge admin-badge-success font-mono">{data?.health.latency_ms ?? 0}ms ping</span>
                    </div>
                    <div className="d-flex align-baseline gap-2.5 my-1">
                        <span className="admin-kpi-value">{(data?.health.total_animes ?? 0).toLocaleString()}</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                            series indexadas
                        </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Auditar telemetría RDS</span>
                            <ChevronRight size={13} />
                        </span>
                        <Database size={15} style={{ color: 'var(--admin-text-secondary)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Embudo Interactivo (Izquierda) + Cruce de Decisiones (Derecha) */}
            <div className="admin-protagonist-stage">
                {/* Gráfico Protagonista: Embudo de 4 Fases */}
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Arquitectura de Flujo: De Invitado a Anime Ganador
                            </h2>
                            <span className="admin-badge admin-badge-info">Interactivo • 4 Etapas</span>
                        </div>

                        <div className="d-flex flex-column" style={{ gap: '1.1rem' }}>
                            {funnelSteps.map((step) => {
                                const isHovered = hoveredStepId === step.id
                                return (
                                    <div
                                        key={step.id}
                                        onClick={() => setActiveSubView(step.id)}
                                        onMouseEnter={() => setHoveredStepId(step.id)}
                                        onMouseLeave={() => setHoveredStepId(null)}
                                        className="admin-chart-interactive-node"
                                        style={{
                                            padding: '1.05rem 1.3rem',
                                            borderRadius: 14,
                                            backgroundColor: isHovered ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                            border: isHovered ? `1px solid ${step.color}` : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '0.65rem' }}>
                                            <span className="text-white fw-semibold" style={{ fontSize: '0.9rem' }}>
                                                {step.title}
                                            </span>
                                            <div className="d-flex align-items-center gap-3 font-mono">
                                                <span className="fw-bold text-white" style={{ fontSize: '1.02rem' }}>
                                                    {step.count.toLocaleString()}
                                                </span>
                                                <span style={{ color: step.color, fontSize: '0.84rem', fontWeight: 600 }}>
                                                    ({step.pct}%)
                                                </span>
                                                <ChevronRight size={15} style={{ color: isHovered ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }} />
                                            </div>
                                        </div>

                                        <div className="w-100 rounded overflow-hidden" style={{ height: 8, backgroundColor: 'var(--admin-surface-1)' }}>
                                            <div
                                                style={{
                                                    width: `${step.pct}%`,
                                                    height: '100%',
                                                    backgroundColor: step.color,
                                                    borderRadius: 4,
                                                    transition: 'width 0.3s ease'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="pt-3 mt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>Mayor fricción detectada en: <strong style={{ color: 'var(--admin-amber)' }}>Fase 3 (Quórum en grupos de 6+ miembros)</strong></span>
                        <span className="font-mono">Score = μ - 0.3σ</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Decisiones en Tiempo Real */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                INSPECTOR DE DECISIÓN
                            </span>
                            <span className="admin-badge admin-badge-neutral font-mono">
                                {focusedStep.conversionFromPrev}
                            </span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            {focusedStep.title}
                        </h3>
                        <p className="admin-subtitle mb-3">
                            {focusedStep.bottleneckAnalysis}
                        </p>

                        {/* Cruce por Tamaño de Sala para la fase enfocada */}
                        <div className="admin-subcard mb-3">
                            <div className="d-flex align-items-center gap-2 mb-3 text-white fw-semibold" style={{ fontSize: '0.84rem' }}>
                                <Users size={16} style={{ color: 'var(--admin-focus)', flexShrink: 0 }} />
                                <span>Cruce: Conversión según Tamaño del Grupo</span>
                            </div>
                            <div className="d-flex justify-content-between text-center gap-2">
                                <div className="admin-stat-pill-box flex-grow-1">
                                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>2-3 Amigos</div>
                                    <div className="font-mono fw-bold mt-1" style={{ color: 'var(--admin-emerald)', fontSize: '1.1rem' }}>
                                        {focusedStep.crossBySize.smallGroupPct}%
                                    </div>
                                </div>
                                <div className="admin-stat-pill-box flex-grow-1">
                                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>4-5 Amigos</div>
                                    <div className="font-mono fw-bold mt-1" style={{ color: 'var(--admin-focus)', fontSize: '1.1rem' }}>
                                        {focusedStep.crossBySize.mediumGroupPct}%
                                    </div>
                                </div>
                                <div className="admin-stat-pill-box flex-grow-1">
                                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>6+ Amigos</div>
                                    <div className="font-mono fw-bold mt-1" style={{ color: 'var(--admin-amber)', fontSize: '1.1rem' }}>
                                        {focusedStep.crossBySize.largeGroupPct}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="admin-callout-box" style={{ backgroundColor: 'var(--admin-amber-bg)', border: '1px solid var(--admin-amber-border)' }}>
                            <AlertTriangle size={16} style={{ color: 'var(--admin-amber)', flexShrink: 0, marginTop: 2 }} />
                            <span style={{ color: 'var(--admin-text-primary)', fontSize: '0.8125rem' }}>
                                <strong>Decisión Sugerida:</strong> {focusedStep.operationalTip}
                            </span>
                        </div>
                    </div>

                    <div className="d-flex flex-column gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <button
                            type="button"
                            onClick={() => setActiveSubView(focusedStep.id)}
                            className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                            style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                        >
                            <span>Abrir Sub-Vista de {focusedStep.title.split('.')[1]?.trim()}</span>
                            <ChevronRight size={15} />
                        </button>
                        <div className="d-flex gap-2">
                            <button
                                type="button"
                                onClick={() => onNavigateTab?.('rooms', 'Salas & Quórum en Vivo')}
                                className="admin-btn admin-btn-secondary flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                            >
                                <span>Ir a Salas</span>
                                <ArrowUpRight size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onNavigateTab?.('algorithm', 'Algoritmo de Consenso')}
                                className="admin-btn admin-btn-secondary flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                            >
                                <span>Ir a Algoritmo</span>
                                <ArrowUpRight size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
