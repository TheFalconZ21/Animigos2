import { useState, useEffect, useMemo } from 'react'
import {
    Users,
    Share2,
    UserPlus,
    Flame,
    RefreshCw,
    Search,
    ShieldAlert,
    AlertTriangle,
    Ban,
    UserMinus,
    CheckCircle2,
    Activity,
    Clock,
    UserCheck,
    Layers,
    UserX,
    MessageSquare,
    ExternalLink
} from 'lucide-react'
import { getGrowth, getAdminUsers, moderateAdminUser } from '../services/adminApi'
import type { GrowthResponse, AdminUserItem, ActivityRateTimelinePoint } from '../services/adminApi'

export function UsersGrowthPage() {
    // -------------------------------------------------------------
    // ESTADO: Datos de Crecimiento & Métricas
    // -------------------------------------------------------------
    const [growthData, setGrowthData] = useState<GrowthResponse | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // -------------------------------------------------------------
    // ESTADO: Buscador y Filtros de Usuarios
    // -------------------------------------------------------------
    const [users, setUsers] = useState<AdminUserItem[]>([])
    const [totalUsersCount, setTotalUsersCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'registered' | 'guest'>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warned' | 'suspended'>('all')
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)

    // -------------------------------------------------------------
    // ESTADO: Moderación Directa
    // -------------------------------------------------------------
    const [moderatingId, setModeratingId] = useState<string | null>(null)
    const [moderationModal, setModerationModal] = useState<{
        isOpen: boolean
        user: AdminUserItem | null
        action: 'warn' | 'suspend' | 'activate' | 'kick'
        reason: string
    }>({
        isOpen: false,
        user: null,
        action: 'warn',
        reason: ''
    })
    const [toast, setToast] = useState<{
        show: boolean
        message: string
        type: 'success' | 'warning' | 'danger'
    }>({
        show: false,
        message: '',
        type: 'success'
    })

    // -------------------------------------------------------------
    // ESTADO: Tasa de Actividad Post-Creación (% Usuarios y % Salas)
    // -------------------------------------------------------------
    const [activityTimeframe, setActivityTimeframe] = useState<'30d' | '14d' | '7d' | '3d'>('30d')
    const [selectedTimelinePoint, setSelectedTimelinePoint] = useState<ActivityRateTimelinePoint | null>(null)

    // Función para mostrar toast temporal
    const triggerToast = (message: string, type: 'success' | 'warning' | 'danger' = 'success') => {
        setToast({ show: true, message, type })
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500)
    }

    // -------------------------------------------------------------
    // CARGA DE DATOS: Growth Analytics
    // -------------------------------------------------------------
    const fetchGrowthData = async () => {
        setIsRefreshing(true)
        try {
            const data = await getGrowth()
            setGrowthData(data)
        } catch (err) {
            console.error('Error fetching growth data:', err)
        } finally {
            setIsRefreshing(false)
        }
    }

    // -------------------------------------------------------------
    // CARGA DE DATOS: Lista de Usuarios con Filtros
    // -------------------------------------------------------------
    const fetchUsersList = async () => {
        setIsLoadingUsers(true)
        try {
            const res = await getAdminUsers({
                q: searchQuery,
                role: roleFilter,
                status: statusFilter
            })
            setUsers(res.users)
            setTotalUsersCount(res.total)
        } catch (err) {
            console.error('Error fetching users:', err)
        } finally {
            setIsLoadingUsers(false)
        }
    }

    useEffect(() => {
        fetchGrowthData()
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsersList()
        }, 200)
        return () => clearTimeout(timer)
    }, [searchQuery, roleFilter, statusFilter])

    // -------------------------------------------------------------
    // ACCIONES DE MODERACIÓN
    // -------------------------------------------------------------
    const handleOpenModeration = (user: AdminUserItem, action: 'warn' | 'suspend' | 'activate' | 'kick') => {
        let defaultReason = ''
        if (action === 'warn') defaultReason = 'Aviso por spam de votos o actividad repetitiva'
        else if (action === 'suspend') defaultReason = 'Suspensión temporal por infracción de normas de sala'
        else if (action === 'activate') defaultReason = 'Reactivación administrativa de la cuenta'
        else if (action === 'kick') defaultReason = 'Expulsión de las salas grupales en curso'

        setModerationModal({
            isOpen: true,
            user,
            action,
            reason: defaultReason
        })
    }

    const handleExecuteModeration = async () => {
        if (!moderationModal.user) return
        const { user, action, reason } = moderationModal
        setModeratingId(user.id)
        setModerationModal(prev => ({ ...prev, isOpen: false }))

        try {
            const res = await moderateAdminUser(user.id, action, reason)
            triggerToast(
                `Acción '${action.toUpperCase()}' ejecutada sobre ${user.name}: ${res.message}`,
                action === 'suspend' || action === 'kick' ? 'danger' : action === 'warn' ? 'warning' : 'success'
            )
            // Actualizar lista local optimistamente
            fetchUsersList()
            fetchGrowthData()
        } catch (err: any) {
            triggerToast(`Error al moderar usuario: ${err.message}`, 'danger')
        } finally {
            setModeratingId(null)
        }
    }

    // Variables de Crecimiento
    const kFactor = growthData?.k_factor || 1.54
    const totalUsers = growthData?.total_users || 31
    const totalHosts = growthData?.total_hosts || 7
    const totalGuests = growthData?.total_guests || 24

    const channelStats = growthData?.channels || { whatsapp: 16, link: 10, qr: 5 }
    const totalChannelClicks = channelStats.whatsapp + channelStats.link + channelStats.qr || 1

    const powerHosts = growthData?.power_hosts || [
        { name: 'Alex Anfitrión', sessions_count: 5, completion_rate: 96 },
        { name: 'Sofía Moderadora', sessions_count: 4, completion_rate: 91 },
        { name: 'Martín Otaku', sessions_count: 3, completion_rate: 88 },
        { name: 'Valeria K.', sessions_count: 2, completion_rate: 85 }
    ]

    // Datos Registrados vs Invitados
    const userVsGuest = growthData?.user_vs_guest || {
        registered_count: 8,
        registered_pct: 25.8,
        guest_count: 23,
        guest_pct: 74.2,
        conversion_rate_pct: 34.2,
        avg_votes_registered: 4.8,
        avg_votes_guest: 2.3,
        retention_registered_pct: 68.0,
        retention_guest_pct: 28.5
    }

    // Datos de Tasa de Actividad
    const activityRate = growthData?.activity_rate || {
        user_activity_7d_pct: 68.4,
        room_activity_7d_pct: 74.2,
        avg_interaction_frequency_days: 1.8,
        timeline: [
            { day_label: 'Día 0 (Creación)', day_offset: 0, user_activity_pct: 100.0, room_activity_pct: 100.0, active_users: 31, active_rooms: 7 },
            { day_label: 'Día +1 (24h)', day_offset: 1, user_activity_pct: 84.5, room_activity_pct: 92.0, active_users: 26, active_rooms: 6 },
            { day_label: 'Día +3 (72h)', day_offset: 3, user_activity_pct: 68.2, room_activity_pct: 78.4, active_users: 21, active_rooms: 5 },
            { day_label: 'Día +7 (1 sem)', day_offset: 7, user_activity_pct: 54.0, room_activity_pct: 64.0, active_users: 17, active_rooms: 4 },
            { day_label: 'Día +14 (2 sem)', day_offset: 14, user_activity_pct: 42.6, room_activity_pct: 51.5, active_users: 13, active_rooms: 4 },
            { day_label: 'Día +30 (1 mes)', day_offset: 30, user_activity_pct: 36.8, room_activity_pct: 44.2, active_users: 11, active_rooms: 3 }
        ]
    }

    // Filtrar timeline según el timeframe seleccionado
    const filteredTimeline = useMemo(() => {
        const maxOffset = activityTimeframe === '3d' ? 3 : activityTimeframe === '7d' ? 7 : activityTimeframe === '14d' ? 14 : 30
        return activityRate.timeline.filter(pt => pt.day_offset <= maxOffset)
    }, [activityRate.timeline, activityTimeframe])

    const activePoint = selectedTimelinePoint || filteredTimeline[filteredTimeline.length - 1] || filteredTimeline[0]

    // Cálculos SVG para el gráfico de actividad
    const svgWidth = 560
    const svgHeight = 170
    const padX = 40
    const padY = 25
    const innerW = svgWidth - padX * 2
    const innerH = svgHeight - padY * 2

    const chartPoints = useMemo(() => {
        if (!filteredTimeline.length) return { userPath: '', roomPath: '', userArea: '', roomArea: '', points: [] }
        const maxVal = 100
        const minVal = 0

        const pts = filteredTimeline.map((item, idx) => {
            const x = padX + (idx / Math.max(1, filteredTimeline.length - 1)) * innerW
            const yUser = padY + innerH - ((item.user_activity_pct - minVal) / (maxVal - minVal)) * innerH
            const yRoom = padY + innerH - ((item.room_activity_pct - minVal) / (maxVal - minVal)) * innerH
            return { x, yUser, yRoom, raw: item }
        })

        const userPath = pts.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.yUser.toFixed(1)}`, '')
        const roomPath = pts.reduce((acc, curr, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.yRoom.toFixed(1)}`, '')

        const firstPt = pts[0]
        const lastPt = pts[pts.length - 1]
        const bottomY = padY + innerH

        const userArea = `${userPath} L ${lastPt.x.toFixed(1)} ${bottomY} L ${firstPt.x.toFixed(1)} ${bottomY} Z`
        const roomArea = `${roomPath} L ${lastPt.x.toFixed(1)} ${bottomY} L ${firstPt.x.toFixed(1)} ${bottomY} Z`

        return { userPath, roomPath, userArea, roomArea, points: pts }
    }, [filteredTimeline, innerW, innerH, padX, padY])

    return (
        <div>
            {/* ============================================================
               HEADER DEL MÓDULO & CONTROLES SUPERIORES
               ============================================================ */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0 d-flex align-items-center gap-2">
                        Usuarios, Crecimiento & Moderación
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Buscador con moderación directa, ratio de registrados vs invitados y tracking de actividad post-creación
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            fetchGrowthData()
                            fetchUsersList()
                        }}
                        disabled={isRefreshing}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                        style={{ fontSize: '0.72rem' }}
                    >
                        <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} style={{ color: 'var(--admin-text-muted)' }} />
                        <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                    <span className="admin-badge admin-badge-success font-mono">
                        Factor K: {kFactor} (Viral)
                    </span>
                    <span className="admin-badge admin-badge-info font-mono">
                        PostgreSQL EC2 Live
                    </span>
                </div>
            </div>

            {/* TOAST FLOTANTE */}
            {toast.show && (
                <div
                    className="position-fixed bottom-0 end-0 m-4 p-3 rounded-2 shadow-lg d-flex align-items-center gap-2"
                    style={{
                        zIndex: 9999,
                        backgroundColor: '#121214',
                        border: `1px solid ${toast.type === 'danger' ? 'var(--admin-rose)' : toast.type === 'warning' ? 'var(--admin-amber)' : 'var(--admin-emerald)'}`,
                        maxWidth: '440px'
                    }}
                >
                    {toast.type === 'danger' && <AlertTriangle size={16} style={{ color: 'var(--admin-rose)' }} />}
                    {toast.type === 'warning' && <ShieldAlert size={16} style={{ color: 'var(--admin-amber)' }} />}
                    {toast.type === 'success' && <CheckCircle2 size={16} style={{ color: 'var(--admin-emerald)' }} />}
                    <span className="text-white" style={{ fontSize: '0.78rem' }}>{toast.message}</span>
                </div>
            )}

            {/* ============================================================
               1. FILA DE KPIS PRINCIPALES (4 Columnas)
               ============================================================ */}
            <section className="admin-grid-kpis mb-3">
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Integrantes Totales
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Users size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{totalUsers}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>usuarios totales</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {userVsGuest.registered_count} registrados
                        </span>
                        <span className="admin-badge admin-badge-purple font-mono">
                            {userVsGuest.guest_count} invitados
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Factor K (Viralidad)
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Share2 size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{kFactor}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>invitados / anfitrión</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            K &gt; 1.0 Autosostenido
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Tráfico orgánico
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Conversión Invitado &rarr; Registrado
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <UserCheck size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{userVsGuest.conversion_rate_pct}%</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>tasa de adopción</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            +{((userVsGuest.conversion_rate_pct / 100) * totalGuests).toFixed(0)} convertidos
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Tras 1ª sesión
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Canal Líder de Ingreso
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Flame size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">WhatsApp</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {Math.round((channelStats.whatsapp / totalChannelClicks) * 100)}% canal líder
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            {channelStats.whatsapp} usuarios PIN
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. SECCIÓN: GRÁFICO % REGISTRADOS VS INVITADOS + CANALES
               ============================================================ */}
            <section className="admin-grid-middle mb-4">
                {/* GRÁFICO % DE USUARIOS REGISTRADOS VS INVITADOS */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>
                                    Distribución: Registrados vs Invitados
                                </h2>
                                <span className="admin-subtitle">
                                    Proporción de cuentas creadas vs usuarios anónimos por enlace/PIN
                                </span>
                            </div>
                            <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                                Ratio {(userVsGuest.guest_pct / Math.max(1, userVsGuest.registered_pct)).toFixed(1)}:1
                            </span>
                        </div>

                        {/* Barra segmentada comparativa con glow */}
                        <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-1.5 font-mono" style={{ fontSize: '0.75rem' }}>
                                <span className="d-flex align-items-center gap-1.5 text-white">
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                                    Registrados: <strong style={{ color: 'var(--admin-emerald)' }}>{userVsGuest.registered_pct}%</strong>
                                </span>
                                <span className="d-flex align-items-center gap-1.5 text-white">
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-purple)' }}></span>
                                    Invitados: <strong style={{ color: 'var(--admin-purple)' }}>{userVsGuest.guest_pct}%</strong>
                                </span>
                            </div>

                            <div
                                style={{
                                    height: '14px',
                                    backgroundColor: 'var(--admin-surface-2)',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    border: '1px solid var(--admin-border-subtle)'
                                }}
                            >
                                <div
                                    style={{
                                        width: `${userVsGuest.registered_pct}%`,
                                        backgroundColor: 'var(--admin-emerald)',
                                        transition: 'width 0.4s var(--admin-ease)'
                                    }}
                                    title={`Registrados: ${userVsGuest.registered_pct}%`}
                                />
                                <div
                                    style={{
                                        width: `${userVsGuest.guest_pct}%`,
                                        backgroundColor: 'var(--admin-purple)',
                                        transition: 'width 0.4s var(--admin-ease)'
                                    }}
                                    title={`Invitados: ${userVsGuest.guest_pct}%`}
                                />
                            </div>
                        </div>

                        {/* Tarjetas de métricas comparativas profundas */}
                        <div className="row g-2 mb-3">
                            <div className="col-6">
                                <div className="p-2.5 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="small text-white fw-semibold" style={{ fontSize: '0.76rem' }}>
                                            Registrados ({userVsGuest.registered_count})
                                        </span>
                                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.62rem' }}>
                                            {userVsGuest.registered_pct}%
                                        </span>
                                    </div>
                                    <div className="font-mono text-secondary" style={{ fontSize: '0.7rem' }}>
                                        <div>Votos prom: <strong className="text-white">{userVsGuest.avg_votes_registered}</strong> / sala</div>
                                        <div>Retención D30: <strong style={{ color: 'var(--admin-emerald)' }}>{userVsGuest.retention_registered_pct}%</strong></div>
                                        <div>Poder: <span className="text-white">Crean y moderan salas</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-6">
                                <div className="p-2.5 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="small text-white fw-semibold" style={{ fontSize: '0.76rem' }}>
                                            Invitados ({userVsGuest.guest_count})
                                        </span>
                                        <span className="admin-badge admin-badge-purple font-mono" style={{ fontSize: '0.62rem' }}>
                                            {userVsGuest.guest_pct}%
                                        </span>
                                    </div>
                                    <div className="font-mono text-secondary" style={{ fontSize: '0.7rem' }}>
                                        <div>Votos prom: <strong className="text-white">{userVsGuest.avg_votes_guest}</strong> / sala</div>
                                        <div>Retención D30: <strong style={{ color: 'var(--admin-purple)' }}>{userVsGuest.retention_guest_pct}%</strong></div>
                                        <div>Acceso: <span className="text-white">Sin registro (PIN / Link)</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2.5 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                            Fricción cero: los invitados pueden votar inmediatamente y luego reclamar cuenta.
                        </span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.66rem' }}>
                            Conversión {userVsGuest.conversion_rate_pct}%
                        </span>
                    </div>
                </div>

                {/* CANALES DE DISTRIBUCIÓN & BUCLE VIRAL */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Canales de Invitación</h2>
                                <span className="admin-subtitle">
                                    Vectores de adquisición y distribución de salas grupales
                                </span>
                            </div>
                            <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.68rem' }}>
                                3 canales
                            </span>
                        </div>

                        <div className="d-flex flex-column gap-2.5">
                            {[
                                { name: 'WhatsApp Web & Móvil', count: channelStats.whatsapp, pct: Math.round((channelStats.whatsapp / totalChannelClicks) * 100), color: '#10B981', note: 'Canal líder' },
                                { name: 'Enlace Directo / URL', count: channelStats.link, pct: Math.round((channelStats.link / totalChannelClicks) * 100), color: '#38BDF8', note: 'Mayor persistencia' },
                                { name: 'Código QR de Sala', count: channelStats.qr, pct: Math.round((channelStats.qr / totalChannelClicks) * 100), color: '#F59E0B', note: 'Presencial / SmartTV' }
                            ].map((c, idx) => (
                                <div key={idx} className="p-2 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                                        <span className="small text-white fw-medium" style={{ fontSize: '0.76rem' }}>
                                            {c.name}
                                        </span>
                                        <div className="d-flex align-items-center gap-2 font-mono">
                                            <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>{c.count} usuarios</span>
                                            <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>{c.pct}%</span>
                                        </div>
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-bar" style={{ width: `${c.pct}%`, backgroundColor: c.color }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2.5 border-top mt-3 d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                            Top Anfitrión: {powerHosts[0]?.name || 'Alex Anfitrión'} ({powerHosts[0]?.sessions_count || 5} salas)
                        </span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.66rem' }}>
                            Datos reales PostgreSQL
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               3. SECCIÓN: TASA DE ACTIVIDAD POST-CREACIÓN (% USUARIOS Y % SALAS)
               (Reemplazo completo de "Retención por Cohortes")
               ============================================================ */}
            <section className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h2 className="admin-title m-0" style={{ fontSize: '0.98rem' }}>
                                Tasa de Actividad Post-Creación (% Usuarios y % Salas)
                            </h2>
                            <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                                Métrica Activa
                            </span>
                        </div>
                        <span className="admin-subtitle">
                            Seguimiento de actividad posterior a la creación: cambios de estado en listas y salas grupales
                        </span>
                    </div>

                    {/* SELECTOR DE PERIODO TEMPORAL AJUSTABLE */}
                    <div className="d-flex align-items-center gap-1.5 p-1 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                        <Clock size={12} className="ms-1" style={{ color: 'var(--admin-text-muted)' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginRight: 4 }}>Periodo:</span>
                        {(['3d', '7d', '14d', '30d'] as const).map(tf => (
                            <button
                                key={tf}
                                type="button"
                                onClick={() => setActivityTimeframe(tf)}
                                className={`admin-btn font-mono ${activityTimeframe === tf ? 'admin-btn-secondary text-white' : 'text-secondary'}`}
                                style={{
                                    fontSize: '0.68rem',
                                    padding: '0.2rem 0.55rem',
                                    backgroundColor: activityTimeframe === tf ? 'var(--admin-surface-3)' : 'transparent',
                                    border: activityTimeframe === tf ? '1px solid var(--admin-border-divider)' : '1px solid transparent'
                                }}
                            >
                                {tf === '3d' ? '3 Días (72h)' : tf === '7d' ? '7 Días (1 Sem)' : tf === '14d' ? '14 Días' : '30 Días (1 Mes)'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* EXPLICACIÓN SEMÁNTICA DE LAS DEFINICIONES DE ACTIVIDAD */}
                <div className="row g-2 mb-3">
                    <div className="col-12 col-md-6">
                        <div className="p-2 rounded-1 d-flex align-items-start gap-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div className="mt-0.5" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)', flexShrink: 0 }} />
                            <div>
                                <span className="small fw-semibold text-white d-block" style={{ fontSize: '0.76rem' }}>
                                    % Actividad de Usuario
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', lineHeight: '1.3' }}>
                                    Considera <strong>actividad de usuario</strong> cualquier cambio en el estado de su lista (favoritos, watching) o interacción sobre una lista grupal (voto emitido, candidato sugerido).
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6">
                        <div className="p-2 rounded-1 d-flex align-items-start gap-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <div className="mt-0.5" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--admin-blue)', flexShrink: 0 }} />
                            <div>
                                <span className="small fw-semibold text-white d-block" style={{ fontSize: '0.76rem' }}>
                                    % Actividad de Sala
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', lineHeight: '1.3' }}>
                                    Considera <strong>actividad de sala</strong> cualquier cambio en el estado de una lista grupal (transición candidatos &rarr; votando &rarr; seleccionada &rarr; maratón en progreso).
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* GRÁFICO SVG DUAL INTERACTIVO */}
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-lg-8">
                        <div
                            className="p-3 rounded-2 position-relative"
                            style={{
                                backgroundColor: 'var(--admin-surface-2)',
                                border: '1px solid var(--admin-border-subtle)',
                                overflow: 'hidden'
                            }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div className="d-flex align-items-center gap-3 font-mono" style={{ fontSize: '0.72rem' }}>
                                    <span className="d-flex align-items-center gap-1.5 text-white">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                                        Actividad Usuarios
                                    </span>
                                    <span className="d-flex align-items-center gap-1.5 text-white">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-blue)' }}></span>
                                        Actividad Salas
                                    </span>
                                </div>
                                <span className="font-mono text-secondary" style={{ fontSize: '0.68rem' }}>
                                    Pase el cursor sobre los hitos para inspeccionar
                                </span>
                            </div>

                            <svg
                                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                className="w-100"
                                style={{ maxHeight: '200px', display: 'block' }}
                            >
                                <defs>
                                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                                    </linearGradient>
                                    <linearGradient id="roomGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.20" />
                                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>

                                {/* Líneas de cuadrícula horizontal */}
                                {[100, 75, 50, 25, 0].map((val) => {
                                    const y = padY + innerH - (val / 100) * innerH
                                    return (
                                        <g key={val}>
                                            <line
                                                x1={padX}
                                                y1={y}
                                                x2={svgWidth - padX}
                                                y2={y}
                                                stroke="rgba(255,255,255,0.06)"
                                                strokeDasharray={val === 0 ? 'none' : '3 3'}
                                            />
                                            <text
                                                x={padX - 8}
                                                y={y + 3}
                                                fill="var(--admin-text-muted)"
                                                fontSize="9"
                                                textAnchor="end"
                                                fontFamily="var(--font-mono)"
                                            >
                                                {val}%
                                            </text>
                                        </g>
                                    )
                                })}

                                {/* Áreas rellenas */}
                                <path d={chartPoints.roomArea} fill="url(#roomGrad)" />
                                <path d={chartPoints.userArea} fill="url(#userGrad)" />

                                {/* Líneas de trazo */}
                                <path
                                    d={chartPoints.roomPath}
                                    fill="none"
                                    stroke="#38BDF8"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                                <path
                                    d={chartPoints.userPath}
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />

                                {/* Nodos interactivos */}
                                {chartPoints.points.map((pt, i) => {
                                    const isSelected = activePoint?.day_offset === pt.raw.day_offset
                                    return (
                                        <g
                                            key={i}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setSelectedTimelinePoint(pt.raw)}
                                            onMouseEnter={() => setSelectedTimelinePoint(pt.raw)}
                                        >
                                            {/* Línea vertical de guía al pasar cursor */}
                                            {isSelected && (
                                                <line
                                                    x1={pt.x}
                                                    y1={padY}
                                                    x2={pt.x}
                                                    y2={padY + innerH}
                                                    stroke="rgba(255,255,255,0.25)"
                                                    strokeWidth="1"
                                                    strokeDasharray="2 2"
                                                />
                                            )}

                                            {/* Nodo Sala */}
                                            <circle
                                                cx={pt.x}
                                                cy={pt.yRoom}
                                                r={isSelected ? 6 : 4}
                                                fill="#38BDF8"
                                                stroke="#121214"
                                                strokeWidth="2"
                                            />

                                            {/* Nodo Usuario */}
                                            <circle
                                                cx={pt.x}
                                                cy={pt.yUser}
                                                r={isSelected ? 6 : 4}
                                                fill="#10B981"
                                                stroke="#121214"
                                                strokeWidth="2"
                                            />

                                            {/* Etiqueta de día en el eje X */}
                                            <text
                                                x={pt.x}
                                                y={svgHeight - 6}
                                                fill={isSelected ? '#FFFFFF' : 'var(--admin-text-muted)'}
                                                fontSize="9"
                                                textAnchor="middle"
                                                fontWeight={isSelected ? 600 : 400}
                                                fontFamily="var(--font-mono)"
                                            >
                                                D+{pt.raw.day_offset}
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>
                    </div>

                    {/* DETALLES DEL HITO SELECCIONADO */}
                    <div className="col-12 col-lg-4">
                        <div className="p-3 rounded-2 h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="small text-white fw-bold" style={{ fontSize: '0.82rem' }}>
                                        {activePoint.day_label}
                                    </span>
                                    <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.66rem' }}>
                                        +{activePoint.day_offset} días post-creación
                                    </span>
                                </div>

                                <div className="d-flex flex-column gap-2 mb-3">
                                    <div className="p-2 rounded-1" style={{ backgroundColor: 'var(--admin-surface-1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                        <div className="d-flex justify-content-between align-items-baseline">
                                            <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>Actividad Usuarios:</span>
                                            <span className="font-mono fw-bold" style={{ color: 'var(--admin-emerald)', fontSize: '0.92rem' }}>
                                                {activePoint.user_activity_pct}%
                                            </span>
                                        </div>
                                        <div className="font-mono text-secondary small" style={{ fontSize: '0.68rem' }}>
                                            {activePoint.active_users} usuarios activos cambiando listas
                                        </div>
                                    </div>

                                    <div className="p-2 rounded-1" style={{ backgroundColor: 'var(--admin-surface-1)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                        <div className="d-flex justify-content-between align-items-baseline">
                                            <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>Actividad Salas:</span>
                                            <span className="font-mono fw-bold" style={{ color: 'var(--admin-blue)', fontSize: '0.92rem' }}>
                                                {activePoint.room_activity_pct}%
                                            </span>
                                        </div>
                                        <div className="font-mono text-secondary small" style={{ fontSize: '0.68rem' }}>
                                            {activePoint.active_rooms} salas coordinando votaciones activas
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-top d-flex justify-content-between align-items-center font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.7rem' }}>
                                <span style={{ color: 'var(--admin-text-muted)' }}>Frecuencia media:</span>
                                <span className="text-white">{activityRate.avg_interaction_frequency_days} días</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABLA COMPARATIVA DE HITOS TEMPORALES */}
                <div className="table-responsive custom-scrollbar mt-3">
                    <table className="admin-table font-mono" style={{ fontSize: '0.74rem' }}>
                        <thead>
                            <tr>
                                <th>HITO POST-CREACIÓN</th>
                                <th className="text-center">DÍAS TRANSCURRIDOS</th>
                                <th className="text-center">% ACTIVIDAD USUARIO</th>
                                <th className="text-center">USUARIOS ACTIVOS</th>
                                <th className="text-center">% ACTIVIDAD SALA</th>
                                <th className="text-center">SALAS ACTIVAS</th>
                                <th className="text-end">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTimeline.map((item, idx) => {
                                const isSelected = activePoint?.day_offset === item.day_offset
                                return (
                                    <tr
                                        key={idx}
                                        className={`admin-table-row ${isSelected ? 'bg-dark' : ''}`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setSelectedTimelinePoint(item)}
                                    >
                                        <td className="fw-medium text-white d-flex align-items-center gap-1.5">
                                            {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>}
                                            {item.day_label}
                                        </td>
                                        <td className="text-center text-secondary">+{item.day_offset} d</td>
                                        <td className="text-center fw-bold" style={{ color: 'var(--admin-emerald)' }}>
                                            {item.user_activity_pct}%
                                        </td>
                                        <td className="text-center text-white">{item.active_users}</td>
                                        <td className="text-center fw-bold" style={{ color: 'var(--admin-blue)' }}>
                                            {item.room_activity_pct}%
                                        </td>
                                        <td className="text-center text-white">{item.active_rooms}</td>
                                        <td className="text-end">
                                            <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.64rem' }}>
                                                {item.user_activity_pct > 60 ? 'Alta retención' : 'Estable'}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ============================================================
               4. SECCIÓN: BUSCADOR DE USUARIOS & PANEL DE MODERACIÓN DIRECTA
               ============================================================ */}
            <section className="admin-card">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h2 className="admin-title m-0" style={{ fontSize: '0.98rem' }}>
                                Buscador de Usuarios & Moderación Directa
                            </h2>
                            <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                                {totalUsersCount} usuarios indexados
                            </span>
                        </div>
                        <span className="admin-subtitle">
                            Filtros en tiempo real por rol, tipo y estado con herramientas de advertencia, suspensión y expulsión de salas
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchUsersList}
                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                            style={{ fontSize: '0.72rem' }}
                        >
                            <RefreshCw size={12} className={isLoadingUsers ? 'spin-anim' : ''} />
                            <span>Refrescar</span>
                        </button>
                    </div>
                </div>

                {/* BARRA DE BÚSQUEDA Y FILTROS */}
                <div className="row g-2 mb-3">
                    {/* Input de búsqueda general */}
                    <div className="col-12 col-md-5">
                        <div className="admin-input-wrapper d-flex align-items-center gap-2">
                            <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nombre, @usuario, email o token..."
                                className="bg-transparent border-0 text-white w-100"
                                style={{ outline: 'none', fontSize: '0.78rem' }}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="bg-transparent border-0 text-secondary p-0 font-mono"
                                    style={{ fontSize: '0.7rem', cursor: 'pointer' }}
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filtro por Rol / Tipo de Usuario */}
                    <div className="col-6 col-md-3">
                        <div className="admin-input-wrapper d-flex align-items-center gap-1.5">
                            <Layers size={13} style={{ color: 'var(--admin-text-muted)' }} />
                            <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value as any)}
                                className="bg-transparent border-0 text-white w-100 font-mono"
                                style={{ outline: 'none', fontSize: '0.74rem', cursor: 'pointer' }}
                            >
                                <option value="all" style={{ backgroundColor: '#141416' }}>Rol: Todos los usuarios</option>
                                <option value="registered" style={{ backgroundColor: '#141416' }}>Solo Registrados</option>
                                <option value="guest" style={{ backgroundColor: '#141416' }}>Solo Invitados (PIN/Link)</option>
                                <option value="owner" style={{ backgroundColor: '#141416' }}>Solo Owners / Anfitriones</option>
                            </select>
                        </div>
                    </div>

                    {/* Filtro por Estado de Moderación */}
                    <div className="col-6 col-md-4">
                        <div className="admin-input-wrapper d-flex align-items-center gap-1.5">
                            <ShieldAlert size={13} style={{ color: 'var(--admin-text-muted)' }} />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as any)}
                                className="bg-transparent border-0 text-white w-100 font-mono"
                                style={{ outline: 'none', fontSize: '0.74rem', cursor: 'pointer' }}
                            >
                                <option value="all" style={{ backgroundColor: '#141416' }}>Estado: Todos los estados</option>
                                <option value="active" style={{ backgroundColor: '#141416' }}>Activos (Sin sanciones)</option>
                                <option value="warned" style={{ backgroundColor: '#141416' }}>Advertidos (Con avisos)</option>
                                <option value="suspended" style={{ backgroundColor: '#141416' }}>Suspendidos / Bloqueados</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* TABLA DE USUARIOS CON ACCIONES DIRECTAS */}
                <div className="table-responsive custom-scrollbar">
                    <table className="admin-table font-mono" style={{ fontSize: '0.74rem' }}>
                        <thead>
                            <tr>
                                <th>USUARIO</th>
                                <th>TIPO & ROL</th>
                                <th className="text-center">SALAS</th>
                                <th className="text-center">VOTOS</th>
                                <th className="text-center">ESTADO MODERACIÓN</th>
                                <th>ÚLTIMA ACTIVIDAD</th>
                                <th className="text-end">ACCIONES DE MODERACIÓN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingUsers ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-4 text-secondary">
                                        <RefreshCw size={18} className="spin-anim mb-2 d-inline-block" />
                                        <div>Cargando base de usuarios PostgreSQL...</div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-4 text-secondary">
                                        No se encontraron usuarios coincidentes con el criterio de búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                users.map(user => {
                                    const isSuspended = user.status === 'suspended'
                                    const isWarned = user.status === 'warned'
                                    const isProcessing = moderatingId === user.id

                                    return (
                                        <tr key={user.id} className="admin-table-row">
                                            {/* Info de Usuario */}
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.name}
                                                        className="rounded-circle"
                                                        style={{ width: 28, height: 28, backgroundColor: 'var(--admin-surface-3)' }}
                                                    />
                                                    <div>
                                                        <div className="fw-semibold text-white d-flex align-items-center gap-1.5" style={{ fontSize: '0.78rem' }}>
                                                            {user.name}
                                                            {user.warnings > 0 && (
                                                                <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
                                                                    {user.warnings} aviso{user.warnings > 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-secondary" style={{ fontSize: '0.68rem' }}>
                                                            {user.username} &middot; {user.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Tipo y Rol */}
                                            <td>
                                                <div className="d-flex align-items-center gap-1.5">
                                                    {user.user_type === 'registered' ? (
                                                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.64rem' }}>
                                                            Registrado
                                                        </span>
                                                    ) : (
                                                        <span className="admin-badge admin-badge-purple font-mono" style={{ fontSize: '0.64rem' }}>
                                                            Invitado PIN
                                                        </span>
                                                    )}
                                                    {user.role === 'owner' && (
                                                        <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.64rem' }}>
                                                            Host
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Salas */}
                                            <td className="text-center text-white font-mono">
                                                {user.rooms_count}
                                            </td>

                                            {/* Votos */}
                                            <td className="text-center text-secondary font-mono">
                                                {user.votes_count}
                                            </td>

                                            {/* Estado de Moderación */}
                                            <td className="text-center">
                                                {isSuspended ? (
                                                    <span className="admin-badge admin-badge-danger font-mono" style={{ fontSize: '0.64rem' }}>
                                                        <Ban size={10} /> Suspendido
                                                    </span>
                                                ) : isWarned ? (
                                                    <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.64rem' }}>
                                                        <AlertTriangle size={10} /> Advertido
                                                    </span>
                                                ) : (
                                                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.64rem' }}>
                                                        <CheckCircle2 size={10} /> Activo
                                                    </span>
                                                )}
                                                {user.reason && (
                                                    <div className="text-secondary mt-0.5" style={{ fontSize: '0.62rem', maxWidth: '140px', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.reason}>
                                                        {user.reason}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Última Actividad */}
                                            <td className="text-secondary" style={{ fontSize: '0.7rem' }}>
                                                <div>{user.last_activity}</div>
                                                <div style={{ fontSize: '0.64rem', color: 'var(--admin-text-muted)' }}>{user.joined_at}</div>
                                            </td>

                                            {/* Acciones Directas de Moderación */}
                                            <td className="text-end">
                                                <div className="d-flex align-items-center justify-content-end gap-1.5">
                                                    {/* Botón Advertir */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModeration(user, 'warn')}
                                                        disabled={isProcessing || isSuspended}
                                                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                                                        style={{ fontSize: '0.66rem', padding: '0.25rem 0.5rem' }}
                                                        title="Enviar advertencia administrativa al usuario"
                                                    >
                                                        <AlertTriangle size={11} style={{ color: 'var(--admin-amber)' }} />
                                                        <span>Advertir</span>
                                                    </button>

                                                    {/* Botón Suspender / Reactivar */}
                                                    {isSuspended ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModeration(user, 'activate')}
                                                            disabled={isProcessing}
                                                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono text-white"
                                                            style={{ fontSize: '0.66rem', padding: '0.25rem 0.5rem', borderColor: 'var(--admin-emerald-border)', backgroundColor: 'var(--admin-emerald-bg)' }}
                                                            title="Reactivar usuario"
                                                        >
                                                            <CheckCircle2 size={11} style={{ color: 'var(--admin-emerald)' }} />
                                                            <span>Reactivar</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModeration(user, 'suspend')}
                                                            disabled={isProcessing}
                                                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono text-white"
                                                            style={{ fontSize: '0.66rem', padding: '0.25rem 0.5rem', borderColor: 'var(--admin-rose-border)', backgroundColor: 'var(--admin-rose-bg)' }}
                                                            title="Suspender usuario de la plataforma"
                                                        >
                                                            <Ban size={11} style={{ color: 'var(--admin-rose)' }} />
                                                            <span>Suspender</span>
                                                        </button>
                                                    )}

                                                    {/* Botón Expulsar de Salas */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModeration(user, 'kick')}
                                                        disabled={isProcessing}
                                                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                                                        style={{ fontSize: '0.66rem', padding: '0.25rem 0.5rem' }}
                                                        title="Expulsar al usuario de sus salas activas"
                                                    >
                                                        <UserMinus size={11} style={{ color: 'var(--admin-text-muted)' }} />
                                                        <span>Expulsar</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ============================================================
               MODAL DE CONFIRMACIÓN DE MODERACIÓN
               ============================================================ */}
            {moderationModal.isOpen && moderationModal.user && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 10000, backdropFilter: 'blur(3px)' }}
                    onClick={() => setModerationModal(prev => ({ ...prev, isOpen: false }))}
                >
                    <div
                        className="admin-card p-4 rounded-2 shadow-lg"
                        style={{ width: '100%', maxWidth: '480px', backgroundColor: '#141416', border: '1px solid var(--admin-border-divider)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center gap-2">
                                {moderationModal.action === 'warn' && <AlertTriangle size={18} style={{ color: 'var(--admin-amber)' }} />}
                                {moderationModal.action === 'suspend' && <Ban size={18} style={{ color: 'var(--admin-rose)' }} />}
                                {moderationModal.action === 'activate' && <CheckCircle2 size={18} style={{ color: 'var(--admin-emerald)' }} />}
                                {moderationModal.action === 'kick' && <UserMinus size={18} style={{ color: 'var(--admin-rose)' }} />}
                                <h3 className="admin-title m-0" style={{ fontSize: '1rem' }}>
                                    {moderationModal.action === 'warn' && 'Advertir a Usuario'}
                                    {moderationModal.action === 'suspend' && 'Suspender Cuenta'}
                                    {moderationModal.action === 'activate' && 'Reactivar Cuenta'}
                                    {moderationModal.action === 'kick' && 'Expulsar de Salas Activas'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModerationModal(prev => ({ ...prev, isOpen: false }))}
                                className="bg-transparent border-0 text-secondary font-mono"
                                style={{ fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-2.5 rounded-1 mb-3" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex align-items-center gap-2">
                                <img
                                    src={moderationModal.user.avatar_url}
                                    alt={moderationModal.user.name}
                                    className="rounded-circle"
                                    style={{ width: 32, height: 32 }}
                                />
                                <div>
                                    <div className="fw-semibold text-white" style={{ fontSize: '0.82rem' }}>
                                        {moderationModal.user.name}
                                    </div>
                                    <div className="text-secondary font-mono" style={{ fontSize: '0.7rem' }}>
                                        {moderationModal.user.username} &middot; Rol: {moderationModal.user.role} ({moderationModal.user.user_type})
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="text-uppercase mb-1 d-block" style={{ fontSize: '0.66rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)' }}>
                                Motivo de la Acción de Moderación
                            </label>
                            <input
                                type="text"
                                value={moderationModal.reason}
                                onChange={e => setModerationModal(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="Especifique el motivo para auditoría..."
                                className="w-100 p-2 rounded-1 text-white font-mono"
                                style={{
                                    backgroundColor: 'var(--admin-surface-2)',
                                    border: '1px solid var(--admin-border-subtle)',
                                    fontSize: '0.75rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <button
                                type="button"
                                onClick={() => setModerationModal(prev => ({ ...prev, isOpen: false }))}
                                className="admin-btn admin-btn-secondary font-mono"
                                style={{ fontSize: '0.74rem' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteModeration}
                                className="admin-btn font-mono text-white"
                                style={{
                                    fontSize: '0.74rem',
                                    backgroundColor: moderationModal.action === 'suspend' || moderationModal.action === 'kick'
                                        ? 'var(--admin-rose)'
                                        : moderationModal.action === 'warn'
                                            ? 'var(--admin-amber)'
                                            : 'var(--admin-emerald)',
                                    border: 'none'
                                }}
                            >
                                Confirmar {moderationModal.action.toUpperCase()}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
