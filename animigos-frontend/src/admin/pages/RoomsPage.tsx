import { useState, useEffect, useMemo } from 'react'
import {
    Tv,
    Clock,
    Users,
    AlertCircle,
    BellRing,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Trash2,
    PauseCircle,
    PlayCircle,
    CheckCircle2,
    RotateCcw,
    ShieldAlert,
    Calendar,
    Flame,
    Zap,
    X,
    AlertTriangle,
    Layers,
    Vote,
    ChevronDown,
    ChevronUp,
    Eye
} from 'lucide-react'
import {
    getRooms,
    moderateRoom,
    getRoomsCleanupPolicy,
    saveRoomsCleanupPolicy,
    runRoomsCleanup
} from '../services/adminApi'
import type { RoomItem, RoomsCleanupPolicy, RoomsFilterParams } from '../services/adminApi'

export function RoomsPage() {
    // -------------------------------------------------------------
    // ESTADO: Datos de Salas y KPIs
    // -------------------------------------------------------------
    const [rooms, setRooms] = useState<RoomItem[]>([])
    const [unfilteredTotal, setUnfilteredTotal] = useState<number>(0)
    const [loading, setLoading] = useState<boolean>(true)
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [isDetailPopupOpen, setIsDetailPopupOpen] = useState<boolean>(false)

    // -------------------------------------------------------------
    // ESTADO: Búsquedas Específicas & Filtros
    // -------------------------------------------------------------
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [filterPhase, setFilterPhase] = useState<string>('all')
    const [membersFilter, setMembersFilter] = useState<string>('all')
    const [inactivityFilter, setInactivityFilter] = useState<string>('all')
    const [createdFilter, setCreatedFilter] = useState<string>('all')
    const [quorumFilter, setQuorumFilter] = useState<string>('all')
    const [votesFilter, setVotesFilter] = useState<string>('all')
    const [candidatesFilter, setCandidatesFilter] = useState<string>('all')
    const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false)

    // -------------------------------------------------------------
    // ESTADO: Política de Limpieza Programada
    // -------------------------------------------------------------
    const [showCleanupConfig, setShowCleanupConfig] = useState<boolean>(false)
    const [cleanupPolicy, setCleanupPolicy] = useState<RoomsCleanupPolicy>({
        enabled: true,
        inactivity_threshold_days: 14,
        target_status: 'all_inactive',
        min_members_protected: 6,
        frequency: 'Diaria automática (04:00 UTC)'
    })
    const [matchingRooms, setMatchingRooms] = useState<any[]>([])
    const [isSavingPolicy, setIsSavingPolicy] = useState<boolean>(false)
    const [isRunningCleanup, setIsRunningCleanup] = useState<boolean>(false)

    // -------------------------------------------------------------
    // ESTADO: Moderación Directa y Notificaciones Toast
    // -------------------------------------------------------------
    const [moderatingRoomId, setModeratingRoomId] = useState<string | null>(null)
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean
        room: RoomItem | null
        action: 'pause' | 'resume' | 'force_select' | 'reset_votes' | 'delete' | 'ping'
        reason: string
    }>({
        isOpen: false,
        room: null,
        action: 'pause',
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

    const triggerToast = (message: string, type: 'success' | 'warning' | 'danger' = 'success') => {
        setToast({ show: true, message, type })
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000)
    }

    // -------------------------------------------------------------
    // CARGA DE DATOS: Salas con Filtros Específicos
    // -------------------------------------------------------------
    const fetchRoomsData = async () => {
        setLoading(true)
        try {
            const params: RoomsFilterParams = {
                q: searchQuery,
                phase: filterPhase,
                members: membersFilter,
                inactivity: inactivityFilter,
                created: createdFilter,
                quorum: quorumFilter,
                votes: votesFilter,
                candidates: candidatesFilter
            }
            const data = await getRooms(params)
            setRooms(data.rooms)
            if (data.unfiltered_total !== undefined) {
                setUnfilteredTotal(data.unfiltered_total)
            }
            if (data.cleanup_policy) {
                setCleanupPolicy(data.cleanup_policy)
            }
            if (data.rooms.length > 0) {
                if (selectedRoomId && !data.rooms.some(r => r.id === selectedRoomId)) {
                    setSelectedRoomId(null)
                    setIsDetailPopupOpen(false)
                }
            } else {
                setSelectedRoomId(null)
                setIsDetailPopupOpen(false)
            }
        } catch (err) {
            console.error('Error fetching rooms:', err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    // -------------------------------------------------------------
    // CARGA DE DATOS: Política de Limpieza Programada
    // -------------------------------------------------------------
    const fetchCleanupPolicyData = async () => {
        try {
            const data = await getRoomsCleanupPolicy()
            setCleanupPolicy(data.policy)
            setMatchingRooms(data.matching_rooms || [])
        } catch (err) {
            console.error('Error fetching cleanup policy:', err)
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRoomsData()
        }, 150)
        return () => clearTimeout(timer)
    }, [
        searchQuery,
        filterPhase,
        membersFilter,
        inactivityFilter,
        createdFilter,
        quorumFilter,
        votesFilter,
        candidatesFilter
    ])

    useEffect(() => {
        fetchCleanupPolicyData()
    }, [])

    // Contar filtros activos
    const activeFiltersCount = useMemo(() => {
        let count = 0
        if (searchQuery.trim()) count++
        if (filterPhase !== 'all') count++
        if (membersFilter !== 'all') count++
        if (inactivityFilter !== 'all') count++
        if (createdFilter !== 'all') count++
        if (quorumFilter !== 'all') count++
        if (votesFilter !== 'all') count++
        if (candidatesFilter !== 'all') count++
        return count
    }, [
        searchQuery,
        filterPhase,
        membersFilter,
        inactivityFilter,
        createdFilter,
        quorumFilter,
        votesFilter,
        candidatesFilter
    ])

    const handleResetFilters = () => {
        setSearchQuery('')
        setFilterPhase('all')
        setMembersFilter('all')
        setInactivityFilter('all')
        setCreatedFilter('all')
        setQuorumFilter('all')
        setVotesFilter('all')
        setCandidatesFilter('all')
    }

    // -------------------------------------------------------------
    // ACCIONES DE MODERACIÓN DE SALA
    // -------------------------------------------------------------
    const handleOpenModerate = (room: RoomItem, action: 'pause' | 'resume' | 'force_select' | 'reset_votes' | 'delete' | 'ping') => {
        let defaultReason = ''
        if (action === 'pause') defaultReason = 'Pausa preventiva para revisión administrativa'
        else if (action === 'resume') defaultReason = 'Reanudación tras verificación de quórum'
        else if (action === 'force_select') defaultReason = 'Resolución forzada por consenso líder'
        else if (action === 'reset_votes') defaultReason = 'Reinicio de votos para nueva ronda de votación'
        else if (action === 'delete') defaultReason = 'Eliminación manual por solicitud o incumplimiento'
        else if (action === 'ping') defaultReason = 'Pulso de quórum'

        setConfirmModal({
            isOpen: true,
            room,
            action,
            reason: defaultReason
        })
    }

    const handleExecuteModeration = async () => {
        if (!confirmModal.room) return
        const { room, action, reason } = confirmModal
        setModeratingRoomId(room.id)
        setConfirmModal(prev => ({ ...prev, isOpen: false }))

        try {
            const res = await moderateRoom(room.id, action, reason)
            triggerToast(res.message, action === 'delete' ? 'danger' : action === 'pause' ? 'warning' : 'success')
            if (action === 'delete') {
                setIsDetailPopupOpen(false)
                setSelectedRoomId(null)
            }
            fetchRoomsData()
            fetchCleanupPolicyData()
        } catch (err: any) {
            triggerToast(`Error al ejecutar acción: ${err.message}`, 'danger')
        } finally {
            setModeratingRoomId(null)
        }
    }

    // Cerrar modales con tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (confirmModal.isOpen) {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }))
                } else if (isDetailPopupOpen) {
                    setIsDetailPopupOpen(false)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [confirmModal.isOpen, isDetailPopupOpen])

    // Guardar Política de Limpieza Programada
    const handleSaveCleanupPolicy = async (updated: Partial<RoomsCleanupPolicy>) => {
        setIsSavingPolicy(true)
        try {
            const res = await saveRoomsCleanupPolicy(updated)
            setCleanupPolicy(res.policy)
            setMatchingRooms(res.matching_rooms || [])
            triggerToast('Política de depuración programada actualizada en PostgreSQL.', 'success')
        } catch (err: any) {
            triggerToast(`Error al guardar política: ${err.message}`, 'danger')
        } finally {
            setIsSavingPolicy(false)
        }
    }

    // Ejecutar Purga Manual Inmediata
    const handleTriggerCleanupRun = async () => {
        if (!window.confirm(`¿Confirmas la eliminación inmediata de todas las salas que superen ${cleanupPolicy.inactivity_threshold_days} días de inactividad?`)) {
            return
        }
        setIsRunningCleanup(true)
        try {
            const res = await runRoomsCleanup()
            triggerToast(res.message, res.purged_count > 0 ? 'warning' : 'info' as any)
            fetchRoomsData()
            fetchCleanupPolicyData()
        } catch (err: any) {
            triggerToast(`Error al ejecutar limpieza: ${err.message}`, 'danger')
        } finally {
            setIsRunningCleanup(false)
        }
    }

    // KPIs calculados
    const activeCount = rooms.filter(r => ['voting', 'candidates', 'watching'].includes(r.status)).length
    const concludedCount = rooms.filter(r => ['selected', 'completed'].includes(r.status)).length
    const totalMembers = rooms.reduce((acc, r) => acc + r.members_count, 0)
    const avgQuorum = rooms.length > 0 ? Math.round(rooms.reduce((acc, r) => acc + r.quorum_percentage, 0) / rooms.length) : 0

    const selectedRoom = rooms.find(r => r.id === selectedRoomId) || null

    return (
        <div>
            {/* ============================================================
               HEADER DEL MÓDULO & CONTROLES SUPERIORES
               ============================================================ */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0 d-flex align-items-center gap-2">
                        Salas, Votaciones & Moderación
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Búsquedas multicriterio, moderación directa del ciclo de votación y política de eliminación por inactividad
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsRefreshing(true)
                            fetchRoomsData()
                            fetchCleanupPolicyData()
                        }}
                        disabled={isRefreshing}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                        style={{ fontSize: '0.72rem' }}
                    >
                        <RefreshCw size={12} className={isRefreshing ? 'spin-anim' : ''} style={{ color: 'var(--admin-text-muted)' }} />
                        <span>Actualizar</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowCleanupConfig(!showCleanupConfig)}
                        className={`admin-btn font-mono d-flex align-items-center gap-1.5 ${showCleanupConfig ? 'text-white' : 'admin-btn-secondary'}`}
                        style={{
                            fontSize: '0.72rem',
                            backgroundColor: showCleanupConfig ? 'var(--admin-surface-3)' : undefined,
                            borderColor: showCleanupConfig ? 'var(--admin-amber-border)' : undefined,
                            color: showCleanupConfig ? 'var(--admin-amber)' : undefined
                        }}
                    >
                        <Trash2 size={12} style={{ color: 'var(--admin-amber)' }} />
                        <span>Limpieza Programada</span>
                        {matchingRooms.length > 0 && (
                            <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
                                {matchingRooms.length}
                            </span>
                        )}
                    </button>

                    <span className="admin-badge admin-badge-success font-mono">
                        {unfilteredTotal} salas registradas
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
                        maxWidth: '460px'
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
                                Salas en Curso
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Tv size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{activeCount}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>fase activa</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            {concludedCount} concluidas
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Con ganador fijado
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Quórum Promedio
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Clock size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{avgQuorum}%</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>participación real</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            Nominal
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Calculado en PostgreSQL
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Total Integrantes
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Users size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{totalMembers}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>en salas filtradas</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-neutral font-mono">
                            ~{rooms.length > 0 ? (totalMembers / rooms.length).toFixed(1) : 0} por sala
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Densidad grupal
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Estado de Limpieza
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <AlertCircle size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{matchingRooms.length}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>salas inactivas</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className={`admin-badge ${cleanupPolicy.enabled ? 'admin-badge-success' : 'admin-badge-neutral'} font-mono`}>
                            {cleanupPolicy.enabled ? 'Purga Activa' : 'Pausada'}
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Umbral: &gt; {cleanupPolicy.inactivity_threshold_days} días
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. PANEL DE CONFIGURACIÓN DE ELIMINACIÓN PROGRAMADA (Colapsable)
               ============================================================ */}
            {showCleanupConfig && (
                <section className="admin-card mb-4" style={{ border: '1px solid var(--admin-amber-border)', backgroundColor: '#141416' }}>
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <Trash2 size={16} style={{ color: 'var(--admin-amber)' }} />
                                <h2 className="admin-title m-0" style={{ fontSize: '0.96rem' }}>
                                    Configuración de Eliminación Programada de Salas Inactivas
                                </h2>
                                <span className={`admin-badge ${cleanupPolicy.enabled ? 'admin-badge-warning' : 'admin-badge-neutral'} font-mono`} style={{ fontSize: '0.66rem' }}>
                                    {cleanupPolicy.enabled ? 'Automatización Activada' : 'Desactivada'}
                                </span>
                            </div>
                            <span className="admin-subtitle">
                                Establece el umbral de días sin votos ni actividad tras el cual las salas abandonadas son purgadas automáticamente
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                onClick={handleTriggerCleanupRun}
                                disabled={isRunningCleanup || matchingRooms.length === 0}
                                className="admin-btn font-mono d-flex align-items-center gap-1.5 text-white"
                                style={{
                                    fontSize: '0.72rem',
                                    backgroundColor: 'var(--admin-rose)',
                                    border: 'none',
                                    opacity: matchingRooms.length === 0 ? 0.5 : 1
                                }}
                            >
                                <Flame size={12} />
                                <span>{isRunningCleanup ? 'Purgando...' : `Purgar ${matchingRooms.length} salas ahora`}</span>
                            </button>
                        </div>
                    </div>

                    <div className="row g-3">
                        {/* Configuración del Umbral */}
                        <div className="col-12 col-md-4">
                            <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <label className="text-uppercase text-secondary fw-semibold d-block mb-1.5" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                                    Umbral de Inactividad (Días)
                                </label>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <input
                                        type="range"
                                        min={1}
                                        max={60}
                                        value={cleanupPolicy.inactivity_threshold_days}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 14
                                            setCleanupPolicy(prev => ({ ...prev, inactivity_threshold_days: val }))
                                        }}
                                        className="w-100"
                                        style={{ accentColor: 'var(--admin-amber)' }}
                                    />
                                    <span className="fs-5 fw-bold text-white font-mono" style={{ minWidth: 42 }}>
                                        {cleanupPolicy.inactivity_threshold_days}d
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-1 mb-3">
                                    {[3, 7, 14, 30, 45].map(days => (
                                        <button
                                            key={days}
                                            type="button"
                                            onClick={() => {
                                                setCleanupPolicy(prev => ({ ...prev, inactivity_threshold_days: days }))
                                                handleSaveCleanupPolicy({ inactivity_threshold_days: days })
                                            }}
                                            className="admin-btn admin-btn-secondary font-mono"
                                            style={{
                                                fontSize: '0.64rem',
                                                padding: '0.15rem 0.45rem',
                                                borderColor: cleanupPolicy.inactivity_threshold_days === days ? 'var(--admin-amber)' : undefined,
                                                color: cleanupPolicy.inactivity_threshold_days === days ? '#FFFFFF' : undefined
                                            }}
                                        >
                                            {days} días
                                        </button>
                                    ))}
                                </div>

                                <div className="d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>Purga Automática:</span>
                                    <label className="d-flex align-items-center gap-1.5 cursor-pointer m-0">
                                        <input
                                            type="checkbox"
                                            checked={cleanupPolicy.enabled}
                                            onChange={e => {
                                                const en = e.target.checked
                                                setCleanupPolicy(prev => ({ ...prev, enabled: en }))
                                                handleSaveCleanupPolicy({ enabled: en })
                                            }}
                                            style={{ accentColor: 'var(--admin-emerald)' }}
                                        />
                                        <span className="font-mono text-white" style={{ fontSize: '0.72rem' }}>
                                            {cleanupPolicy.enabled ? 'Habilitada' : 'Deshabilitada'}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Filtro Objetivo y Protección */}
                        <div className="col-12 col-md-4">
                            <div className="p-3 rounded-1 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <label className="text-uppercase text-secondary fw-semibold d-block mb-1.5" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                                    Alcance de Salas a Purgar
                                </label>
                                <select
                                    value={cleanupPolicy.target_status}
                                    onChange={e => {
                                        const val = e.target.value
                                        setCleanupPolicy(prev => ({ ...prev, target_status: val }))
                                        handleSaveCleanupPolicy({ target_status: val })
                                    }}
                                    className="admin-input-wrapper w-100 text-white font-mono mb-2"
                                    style={{ fontSize: '0.74rem', cursor: 'pointer' }}
                                >
                                    <option value="all_inactive" style={{ backgroundColor: '#141416' }}>Cualquier sala sin actividad &gt; umbral</option>
                                    <option value="abandoned_only" style={{ backgroundColor: '#141416' }}>Solo abandonadas en votación/postulación</option>
                                    <option value="concluded_only" style={{ backgroundColor: '#141416' }}>Solo concluidas con anime ya elegido</option>
                                </select>

                                <label className="text-uppercase text-secondary fw-semibold d-block mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                                    Protección de Salas Populares
                                </label>
                                <div className="text-secondary mb-2" style={{ fontSize: '0.7rem' }}>
                                    Proteger y no eliminar salas con $\ge$ <strong>{cleanupPolicy.min_members_protected} miembros</strong> registrados.
                                </div>
                                <div className="font-mono text-secondary" style={{ fontSize: '0.68rem' }}>
                                    Frecuencia: {cleanupPolicy.frequency} &middot; Última ejecución: {cleanupPolicy.last_run || 'Hoy 04:00'}
                                </div>
                            </div>
                        </div>

                        {/* Previsualización de Impacto (Dry Run) */}
                        <div className="col-12 col-md-4">
                            <div className="p-3 rounded-1 h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <label className="text-uppercase text-secondary fw-semibold m-0" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                                            Previsualización (Dry-Run)
                                        </label>
                                        <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.62rem' }}>
                                            {matchingRooms.length} candidatas
                                        </span>
                                    </div>
                                    <p className="text-secondary mb-2" style={{ fontSize: '0.7rem' }}>
                                        Salas que cumplen los criterios de eliminación por inactividad:
                                    </p>

                                    {matchingRooms.length === 0 ? (
                                        <div className="p-2 rounded-1 text-center font-mono" style={{ backgroundColor: 'var(--admin-surface-1)', color: 'var(--admin-emerald)', fontSize: '0.72rem' }}>
                                            ✓ Ninguna sala supera los {cleanupPolicy.inactivity_threshold_days}d de inactividad
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column gap-1 custom-scrollbar" style={{ maxHeight: '110px', overflowY: 'auto' }}>
                                            {matchingRooms.map((mr, i) => (
                                                <div key={i} className="d-flex justify-content-between align-items-center p-1.5 rounded-1 font-mono" style={{ backgroundColor: 'var(--admin-surface-1)', fontSize: '0.68rem' }}>
                                                    <span className="text-white text-truncate" style={{ maxWidth: '140px' }}>{mr.name}</span>
                                                    <span style={{ color: 'var(--admin-rose)' }}>Inactiva: {mr.inactive_days}d</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 border-top mt-2 d-flex justify-content-end" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveCleanupPolicy({})}
                                        disabled={isSavingPolicy}
                                        className="admin-btn admin-btn-secondary font-mono"
                                        style={{ fontSize: '0.7rem' }}
                                    >
                                        {isSavingPolicy ? 'Guardando...' : 'Guardar Política'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ============================================================
               3. PANEL DE BÚSQUEDA ESPECÍFICA & FILTROS DE SALAS
               ============================================================ */}
            <section className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h2 className="admin-title m-0" style={{ fontSize: '0.98rem' }}>
                                Explorador & Filtros Específicos de Salas
                            </h2>
                            <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                                Mostrando {rooms.length} de {unfilteredTotal} salas
                            </span>
                        </div>
                        <span className="admin-subtitle">
                            Búsquedas paramétricas por miembros, inactividad, antigüedad, quórum, votos y candidatos
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {activeFiltersCount > 0 && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono text-secondary"
                                style={{ fontSize: '0.7rem' }}
                            >
                                <X size={12} />
                                <span>Limpiar filtros ({activeFiltersCount})</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                            style={{ fontSize: '0.72rem' }}
                        >
                            <SlidersHorizontal size={12} />
                            <span>{showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}</span>
                            {showAdvancedFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    </div>
                </div>

                {/* FILA 1: BÚSQUEDA GENERAL + FASE + MIEMBROS + INACTIVIDAD */}
                <div className="row g-2 mb-2">
                    {/* Búsqueda de Texto General */}
                    <div className="col-12 col-md-4">
                        <div className="admin-input-wrapper d-flex align-items-center gap-2">
                            <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nombre, PIN, anime o miembro..."
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

                    {/* Filtro por Fase de Ciclo de Vida */}
                    <div className="col-6 col-md-2">
                        <div className="admin-input-wrapper d-flex align-items-center gap-1">
                            <Tv size={12} style={{ color: 'var(--admin-text-muted)' }} />
                            <select
                                value={filterPhase}
                                onChange={e => setFilterPhase(e.target.value)}
                                className="bg-transparent border-0 text-white w-100 font-mono"
                                style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                                <option value="all" style={{ backgroundColor: '#141416' }}>Fase: Todas</option>
                                <option value="voting" style={{ backgroundColor: '#141416' }}>Votación Abierta</option>
                                <option value="candidates" style={{ backgroundColor: '#141416' }}>Postulación Candidatos</option>
                                <option value="selected" style={{ backgroundColor: '#141416' }}>Consenso Alcanzado</option>
                                <option value="completed" style={{ backgroundColor: '#141416' }}>Completadas</option>
                            </select>
                        </div>
                    </div>

                    {/* Filtro: Por Número de Miembros */}
                    <div className="col-6 col-md-3">
                        <div className="admin-input-wrapper d-flex align-items-center gap-1">
                            <Users size={12} style={{ color: 'var(--admin-text-muted)' }} />
                            <select
                                value={membersFilter}
                                onChange={e => setMembersFilter(e.target.value)}
                                className="bg-transparent border-0 text-white w-100 font-mono"
                                style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                                <option value="all" style={{ backgroundColor: '#141416' }}>Miembros: Cualquier cantidad</option>
                                <option value="1-2" style={{ backgroundColor: '#141416' }}>1 a 2 miembros (Dúos)</option>
                                <option value="3-5" style={{ backgroundColor: '#141416' }}>3 a 5 miembros (Medianos)</option>
                                <option value="6+" style={{ backgroundColor: '#141416' }}>&ge; 6 miembros (Grupos grandes)</option>
                            </select>
                        </div>
                    </div>

                    {/* Filtro: Por Tiempo de Inactividad */}
                    <div className="col-12 col-md-3">
                        <div className="admin-input-wrapper d-flex align-items-center gap-1">
                            <Clock size={12} style={{ color: 'var(--admin-text-muted)' }} />
                            <select
                                value={inactivityFilter}
                                onChange={e => setInactivityFilter(e.target.value)}
                                className="bg-transparent border-0 text-white w-100 font-mono"
                                style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                                <option value="all" style={{ backgroundColor: '#141416' }}>Inactividad: Cualquier tiempo</option>
                                <option value="1h" style={{ backgroundColor: '#141416' }}>Inactiva &gt; 1 hora</option>
                                <option value="24h" style={{ backgroundColor: '#141416' }}>Inactiva &gt; 24 horas (1 día)</option>
                                <option value="3d" style={{ backgroundColor: '#141416' }}>Inactiva &gt; 3 días</option>
                                <option value="7d" style={{ backgroundColor: '#141416' }}>Inactiva &gt; 7 días (1 sem)</option>
                                <option value="14d" style={{ backgroundColor: '#141416' }}>Inactiva &gt; 14 días (2 sem)</option>
                                <option value="30d" style={{ backgroundColor: '#141416' }}>Inactiva &gt; 30 días (Crítica)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* FILA 2: FILTROS AVANZADOS (CREACIÓN, QUÓRUM, VOTOS, CANDIDATOS) */}
                {showAdvancedFilters && (
                    <div className="row g-2 pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        {/* Filtro: Por Tiempo desde Creación */}
                        <div className="col-6 col-md-3">
                            <div className="admin-input-wrapper d-flex align-items-center gap-1">
                                <Calendar size={12} style={{ color: 'var(--admin-text-muted)' }} />
                                <select
                                    value={createdFilter}
                                    onChange={e => setCreatedFilter(e.target.value)}
                                    className="bg-transparent border-0 text-white w-100 font-mono"
                                    style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                    <option value="all" style={{ backgroundColor: '#141416' }}>Creación: Cualquier fecha</option>
                                    <option value="today" style={{ backgroundColor: '#141416' }}>Creada hoy (&lt; 24h)</option>
                                    <option value="3d" style={{ backgroundColor: '#141416' }}>Últimos 3 días (&le; 3d)</option>
                                    <option value="7d" style={{ backgroundColor: '#141416' }}>Última semana (&le; 7d)</option>
                                    <option value="30d" style={{ backgroundColor: '#141416' }}>Último mes (&le; 30d)</option>
                                    <option value="older_30d" style={{ backgroundColor: '#141416' }}>Antiguas (&gt; 30d)</option>
                                </select>
                            </div>
                        </div>

                        {/* Filtro: Por % de Quórum */}
                        <div className="col-6 col-md-3">
                            <div className="admin-input-wrapper d-flex align-items-center gap-1">
                                <Zap size={12} style={{ color: 'var(--admin-text-muted)' }} />
                                <select
                                    value={quorumFilter}
                                    onChange={e => setQuorumFilter(e.target.value)}
                                    className="bg-transparent border-0 text-white w-100 font-mono"
                                    style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                    <option value="all" style={{ backgroundColor: '#141416' }}>Quórum: Cualquier %</option>
                                    <option value="0" style={{ backgroundColor: '#141416' }}>Sin quórum (0%)</option>
                                    <option value="low" style={{ backgroundColor: '#141416' }}>Quórum bajo (&lt; 50%)</option>
                                    <option value="mid" style={{ backgroundColor: '#141416' }}>Quórum medio (50% a 99%)</option>
                                    <option value="full" style={{ backgroundColor: '#141416' }}>Quórum completo (100%)</option>
                                </select>
                            </div>
                        </div>

                        {/* Filtro: Por Número de Votos */}
                        <div className="col-6 col-md-3">
                            <div className="admin-input-wrapper d-flex align-items-center gap-1">
                                <Vote size={12} style={{ color: 'var(--admin-text-muted)' }} />
                                <select
                                    value={votesFilter}
                                    onChange={e => setVotesFilter(e.target.value)}
                                    className="bg-transparent border-0 text-white w-100 font-mono"
                                    style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                    <option value="all" style={{ backgroundColor: '#141416' }}>Votos: Cualquier total</option>
                                    <option value="0" style={{ backgroundColor: '#141416' }}>0 votos (Sin participación)</option>
                                    <option value="1-5" style={{ backgroundColor: '#141416' }}>1 a 5 votos emitidos</option>
                                    <option value="6-15" style={{ backgroundColor: '#141416' }}>6 a 15 votos emitidos</option>
                                    <option value="16+" style={{ backgroundColor: '#141416' }}>&ge; 16 votos (Alta actividad)</option>
                                </select>
                            </div>
                        </div>

                        {/* Filtro: Por Número de Candidatos */}
                        <div className="col-6 col-md-3">
                            <div className="admin-input-wrapper d-flex align-items-center gap-1">
                                <Layers size={12} style={{ color: 'var(--admin-text-muted)' }} />
                                <select
                                    value={candidatesFilter}
                                    onChange={e => setCandidatesFilter(e.target.value)}
                                    className="bg-transparent border-0 text-white w-100 font-mono"
                                    style={{ outline: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                    <option value="all" style={{ backgroundColor: '#141416' }}>Candidatos: Cualquier cantidad</option>
                                    <option value="0" style={{ backgroundColor: '#141416' }}>0 candidatos (Vacía)</option>
                                    <option value="1-2" style={{ backgroundColor: '#141416' }}>1 a 2 candidatos postulados</option>
                                    <option value="3-5" style={{ backgroundColor: '#141416' }}>3 a 5 candidatos</option>
                                    <option value="6+" style={{ backgroundColor: '#141416' }}>&ge; 6 candidatos (Catálogo amplio)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ============================================================
               4. MONITOR DE SALAS EN VIVO Y PANEL DE MODERACIÓN DIRECTA
               ============================================================ */}
            <div className="row g-3 mb-4">
                {/* LISTADO DE SALAS CON ACCIONES */}
                <div className="col-12">
                    <div className="admin-card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.94rem' }}>
                                    Sesiones Activas & Moderación
                                </h2>
                                <span className="admin-subtitle">
                                    Haz clic en una sala o en "Auditar" para abrir el panel de auditoría y moderación en un pop-up
                                </span>
                            </div>

                            <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.68rem' }}>
                                {rooms.length} resultados
                            </span>
                        </div>

                        {loading ? (
                            <div className="d-flex flex-column gap-2">
                                <div className="admin-skeleton" style={{ height: 60, width: '100%' }}></div>
                                <div className="admin-skeleton" style={{ height: 60, width: '100%' }}></div>
                                <div className="admin-skeleton" style={{ height: 60, width: '100%' }}></div>
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="text-center py-5 text-secondary font-mono" style={{ fontSize: '0.8rem' }}>
                                <AlertTriangle size={24} className="mb-2 d-inline-block text-warning" />
                                <div>No se encontraron salas que coincidan con los criterios de búsqueda.</div>
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="admin-btn admin-btn-secondary mt-2 font-mono"
                                    style={{ fontSize: '0.72rem' }}
                                >
                                    Restablecer todos los filtros
                                </button>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {rooms.map(room => {
                                    const isSelected = room.id === selectedRoomId
                                    const isProcessing = moderatingRoomId === room.id
                                    const candidateTitle = room.selected_anime?.title || room.top_candidate?.title || 'Sin candidatos'
                                    const scoreDisplay = room.selected_anime?.score || room.top_candidate?.score || 0

                                    return (
                                        <div
                                            key={room.id}
                                            onClick={() => {
                                                setSelectedRoomId(room.id)
                                                setIsDetailPopupOpen(true)
                                            }}
                                            className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-2.5 rounded-1 cursor-pointer"
                                            style={{
                                                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'var(--admin-surface-2)',
                                                border: isSelected ? '1px solid #FFFFFF' : '1px solid var(--admin-border-subtle)',
                                                cursor: 'pointer',
                                                transition: 'all 150ms ease'
                                            }}
                                        >
                                            {/* Info de Sala */}
                                            <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="fw-semibold text-white" style={{ fontSize: '0.82rem' }}>
                                                        {room.name}
                                                    </span>
                                                    <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.64rem' }}>
                                                        {room.invite_code}
                                                    </span>
                                                    {room.is_locked && (
                                                        <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.6rem' }}>
                                                            Pausada
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-secondary small font-mono mt-0.5 d-flex align-items-center gap-2" style={{ fontSize: '0.68rem' }}>
                                                    <span><strong>{room.members_count}</strong> miembros</span>
                                                    <span>&middot;</span>
                                                    <span><strong>{room.candidates_count}</strong> candidatos</span>
                                                    <span>&middot;</span>
                                                    <span><strong>{room.votes_count}</strong> votos</span>
                                                    <span>&middot;</span>
                                                    <span style={{ color: room.inactivity_days && room.inactivity_days > 7 ? 'var(--admin-amber)' : 'var(--admin-text-muted)' }}>
                                                        {room.last_activity_display}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Candidato líder & Quórum */}
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="d-none d-md-block" style={{ minWidth: 130 }}>
                                                    <div className="text-white text-truncate" style={{ maxWidth: 130, fontSize: '0.74rem' }}>
                                                        {candidateTitle}
                                                    </div>
                                                    <div className="font-mono text-secondary" style={{ fontSize: '0.66rem' }}>
                                                        Score: {scoreDisplay ? `${scoreDisplay.toFixed(1)}/10` : '—'}
                                                    </div>
                                                </div>

                                                <div style={{ width: 75 }}>
                                                    <div className="d-flex justify-content-between font-mono" style={{ fontSize: '0.64rem', color: 'var(--admin-text-muted)' }}>
                                                        <span>Quórum</span>
                                                        <span>{room.quorum_percentage}%</span>
                                                    </div>
                                                    <div className="admin-progress-track mt-0.5">
                                                        <div
                                                            className="admin-progress-bar"
                                                            style={{
                                                                width: `${room.quorum_percentage}%`,
                                                                backgroundColor: room.quorum_percentage >= 80 ? 'var(--admin-emerald)' : 'var(--admin-blue)'
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* Botones Rápidos de Moderación */}
                                                <div className="d-flex align-items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    {/* Abrir Pop-up de Auditoría */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedRoomId(room.id)
                                                            setIsDetailPopupOpen(true)
                                                        }}
                                                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono p-1 px-2"
                                                        title="Abrir menú de auditoría y moderación en pop-up"
                                                    >
                                                        <Eye size={13} style={{ color: 'var(--admin-blue)' }} />
                                                        <span style={{ fontSize: '0.68rem' }} className="d-none d-sm-inline">Auditar</span>
                                                    </button>

                                                    {/* Pausar / Reanudar */}
                                                    {room.status === 'voting' && !room.is_locked ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModerate(room, 'pause')}
                                                            disabled={isProcessing}
                                                            className="admin-btn admin-btn-secondary p-1"
                                                            title="Pausar votación en esta sala"
                                                        >
                                                            <PauseCircle size={13} style={{ color: 'var(--admin-amber)' }} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModerate(room, 'resume')}
                                                            disabled={isProcessing}
                                                            className="admin-btn admin-btn-secondary p-1"
                                                            title="Reanudar votación abierta"
                                                        >
                                                            <PlayCircle size={13} style={{ color: 'var(--admin-emerald)' }} />
                                                        </button>
                                                    )}

                                                    {/* Forzar Selección si hay candidatos */}
                                                    {room.status !== 'selected' && room.status !== 'completed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModerate(room, 'force_select')}
                                                            disabled={isProcessing || room.candidates_count === 0}
                                                            className="admin-btn admin-btn-secondary p-1"
                                                            title="Forzar selección del candidato líder"
                                                        >
                                                            <CheckCircle2 size={13} style={{ color: 'var(--admin-blue)' }} />
                                                        </button>
                                                    )}

                                                    {/* Eliminar sala */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModerate(room, 'delete')}
                                                        disabled={isProcessing}
                                                        className="admin-btn admin-btn-secondary p-1"
                                                        title="Eliminar sala permanentemente"
                                                    >
                                                        <Trash2 size={13} style={{ color: 'var(--admin-rose)' }} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================================
               POP UP MODAL: AUDITORÍA & MODERACIÓN DE SALA / LISTA
               ============================================================ */}
            {isDetailPopupOpen && selectedRoom && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.82)',
                        zIndex: 9990,
                        backdropFilter: 'blur(6px)'
                    }}
                    onClick={() => setIsDetailPopupOpen(false)}
                >
                    <div
                        className="admin-card p-4 rounded-2 shadow-lg custom-scrollbar d-flex flex-column justify-content-between"
                        style={{
                            width: '100%',
                            maxWidth: '580px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            backgroundColor: '#121214',
                            border: '1px solid var(--admin-border-divider)',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.08)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div>
                            {/* Cabecera del Pop Up */}
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <ShieldAlert size={14} style={{ color: 'var(--admin-blue)' }} />
                                    <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                        Auditoría & Moderación de Sala
                                    </span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className={`admin-badge ${selectedRoom.status === 'voting' ? 'admin-badge-success' : selectedRoom.status === 'selected' ? 'admin-badge-info' : 'admin-badge-neutral'} font-mono`} style={{ fontSize: '0.64rem' }}>
                                        {selectedRoom.status}
                                    </span>
                                    {selectedRoom.is_locked && (
                                        <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.6rem' }}>
                                            Pausada
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsDetailPopupOpen(false)}
                                        className="bg-transparent border-0 text-secondary p-1 d-flex align-items-center justify-content-center rounded-circle"
                                        style={{ cursor: 'pointer', width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.06)', transition: 'background-color 150ms ease' }}
                                        title="Cerrar pop up (Esc)"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="fw-bold text-white mb-1" style={{ fontSize: '1.05rem' }}>
                                {selectedRoom.name}
                            </h3>
                            <p className="text-secondary mb-3" style={{ fontSize: '0.74rem' }}>
                                {selectedRoom.description || 'Sala de votación grupal creada en Animigos.'}
                            </p>

                            {/* Métricas Técnicas */}
                            <div className="p-2.5 mb-3 rounded-1 font-mono" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', fontSize: '0.72rem' }}>
                                <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>CÓDIGO DE ENLACE:</span>
                                    <span className="text-white fw-bold">{selectedRoom.invite_code}</span>
                                </div>
                                <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>PARTICIPANTES:</span>
                                    <span className="text-white">{selectedRoom.members_count} miembros</span>
                                </div>
                                <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>CANDIDATOS:</span>
                                    <span className="text-white">{selectedRoom.candidates_count} postulados</span>
                                </div>
                                <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>VOTOS EMITIDOS:</span>
                                    <span className="text-white">{selectedRoom.votes_count} votos ({selectedRoom.quorum_percentage}% quórum)</span>
                                </div>
                                <div className="d-flex justify-content-between py-1 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>ÚLTIMA ACTIVIDAD:</span>
                                    <span style={{ color: selectedRoom.inactivity_days && selectedRoom.inactivity_days > 7 ? 'var(--admin-amber)' : 'var(--admin-emerald)' }}>
                                        {selectedRoom.last_activity_display}
                                    </span>
                                </div>
                                <div className="d-flex justify-content-between py-1" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span style={{ color: 'var(--admin-text-muted)' }}>CREADA HACE:</span>
                                    <span className="text-white">{selectedRoom.created_display || selectedRoom.created_at.slice(0, 10)}</span>
                                </div>
                            </div>

                            {/* Candidato Ganador o Líder */}
                            {selectedRoom.selected_anime ? (
                                <div className="p-2.5 mb-3 rounded-1" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <span className="text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '0.64rem', color: 'var(--admin-emerald)' }}>
                                        Anime Ganador (Consenso)
                                    </span>
                                    <div className="fw-bold text-white" style={{ fontSize: '0.82rem' }}>
                                        {selectedRoom.selected_anime.title}
                                    </div>
                                </div>
                            ) : selectedRoom.top_candidate ? (
                                <div className="p-2.5 mb-3 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                    <span className="text-uppercase fw-semibold d-block mb-1 text-secondary" style={{ fontSize: '0.64rem' }}>
                                        Candidato Líder Provisional
                                    </span>
                                    <div className="fw-semibold text-white" style={{ fontSize: '0.8rem' }}>
                                        {selectedRoom.top_candidate.title}
                                    </div>
                                    <div className="font-mono text-secondary small" style={{ fontSize: '0.68rem' }}>
                                        Score: {selectedRoom.top_candidate.score ? selectedRoom.top_candidate.score.toFixed(2) : 0}/10
                                    </div>
                                </div>
                            ) : null}

                            {/* Miembros */}
                            <div className="mb-3">
                                <span className="text-uppercase text-secondary fw-semibold d-block mb-1.5" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>
                                    Miembros en la Sala ({selectedRoom.members.length})
                                </span>
                                <div className="d-flex flex-wrap gap-1">
                                    {selectedRoom.members.map((m, i) => (
                                        <span key={i} className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.66rem' }}>
                                            {m.role === 'owner' ? '★ ' : ''}{m.name} ({m.channel})
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Barra de Acciones de Moderación */}
                            <div>
                                <span className="text-uppercase text-secondary fw-semibold d-block mb-1.5" style={{ fontSize: '0.66rem', letterSpacing: '0.04em' }}>
                                    Acciones de Moderación de Sala
                                </span>
                                <div className="d-grid gap-1.5">
                                    {/* Pausar / Reanudar Votación */}
                                    {selectedRoom.status === 'voting' && !selectedRoom.is_locked ? (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModerate(selectedRoom, 'pause')}
                                            className="admin-btn admin-btn-secondary d-flex align-items-center justify-content-center gap-1.5 font-mono"
                                            style={{ fontSize: '0.72rem' }}
                                        >
                                            <PauseCircle size={13} style={{ color: 'var(--admin-amber)' }} />
                                            <span>Pausar Votación</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModerate(selectedRoom, 'resume')}
                                            className="admin-btn admin-btn-secondary d-flex align-items-center justify-content-center gap-1.5 font-mono"
                                            style={{ fontSize: '0.72rem' }}
                                        >
                                            <PlayCircle size={13} style={{ color: 'var(--admin-emerald)' }} />
                                            <span>Reanudar Votación</span>
                                        </button>
                                    )}

                                    {/* Forzar Selección */}
                                    {selectedRoom.status !== 'selected' && selectedRoom.status !== 'completed' && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModerate(selectedRoom, 'force_select')}
                                            disabled={selectedRoom.candidates_count === 0}
                                            className="admin-btn admin-btn-secondary d-flex align-items-center justify-content-center gap-1.5 font-mono"
                                            style={{ fontSize: '0.72rem' }}
                                        >
                                            <CheckCircle2 size={13} style={{ color: 'var(--admin-blue)' }} />
                                            <span>Forzar Consenso Ganador</span>
                                        </button>
                                    )}

                                    {/* Reiniciar Votos */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModerate(selectedRoom, 'reset_votes')}
                                        disabled={selectedRoom.votes_count === 0}
                                        className="admin-btn admin-btn-secondary d-flex align-items-center justify-content-center gap-1.5 font-mono"
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        <RotateCcw size={13} style={{ color: 'var(--admin-text-muted)' }} />
                                        <span>Reiniciar Votos de Sala</span>
                                    </button>

                                    {/* Pulso / Ping */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModerate(selectedRoom, 'ping')}
                                        className="admin-btn admin-btn-secondary d-flex align-items-center justify-content-center gap-1.5 font-mono"
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        <BellRing size={13} style={{ color: 'var(--admin-emerald)' }} />
                                        <span>Emitir Pulso WebSocket / Ping</span>
                                    </button>

                                    {/* Eliminar Sala */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenModerate(selectedRoom, 'delete')}
                                        className="admin-btn font-mono d-flex align-items-center justify-content-center gap-1.5 text-white"
                                        style={{ fontSize: '0.72rem', backgroundColor: 'var(--admin-rose-bg)', border: '1px solid var(--admin-rose-border)', color: 'var(--admin-rose)' }}
                                    >
                                        <Trash2 size={13} />
                                        <span>Eliminar Sala Definitivamente</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-top mt-3 font-mono d-flex justify-content-between align-items-center" style={{ fontSize: '0.68rem', borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-muted)' }}>
                            <span>UUID: {selectedRoom.id.slice(0, 18)}...</span>
                            <span>PostgreSQL Live</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================
               MODAL DE CONFIRMACIÓN DE MODERACIÓN
               ============================================================ */}
            {confirmModal.isOpen && confirmModal.room && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 10000, backdropFilter: 'blur(3px)' }}
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                >
                    <div
                        className="admin-card p-4 rounded-2 shadow-lg"
                        style={{ width: '100%', maxWidth: '480px', backgroundColor: '#141416', border: '1px solid var(--admin-border-divider)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center gap-2">
                                {confirmModal.action === 'pause' && <PauseCircle size={18} style={{ color: 'var(--admin-amber)' }} />}
                                {confirmModal.action === 'resume' && <PlayCircle size={18} style={{ color: 'var(--admin-emerald)' }} />}
                                {confirmModal.action === 'force_select' && <CheckCircle2 size={18} style={{ color: 'var(--admin-blue)' }} />}
                                {confirmModal.action === 'reset_votes' && <RotateCcw size={18} style={{ color: 'var(--admin-amber)' }} />}
                                {confirmModal.action === 'delete' && <Trash2 size={18} style={{ color: 'var(--admin-rose)' }} />}
                                {confirmModal.action === 'ping' && <BellRing size={18} style={{ color: 'var(--admin-emerald)' }} />}
                                <h3 className="admin-title m-0" style={{ fontSize: '1rem' }}>
                                    {confirmModal.action === 'pause' && 'Pausar Votación de Sala'}
                                    {confirmModal.action === 'resume' && 'Reanudar Votación'}
                                    {confirmModal.action === 'force_select' && 'Forzar Consenso Ganador'}
                                    {confirmModal.action === 'reset_votes' && 'Reiniciar Votos de Sala'}
                                    {confirmModal.action === 'delete' && 'Eliminar Sala Permanentemente'}
                                    {confirmModal.action === 'ping' && 'Emitir Pulso WebSocket'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="bg-transparent border-0 text-secondary font-mono"
                                style={{ fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-2.5 rounded-1 mb-3" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="fw-semibold text-white mb-0.5" style={{ fontSize: '0.84rem' }}>
                                {confirmModal.room.name}
                            </div>
                            <div className="text-secondary font-mono" style={{ fontSize: '0.7rem' }}>
                                PIN: {confirmModal.room.invite_code} &middot; {confirmModal.room.members_count} miembros &middot; {confirmModal.room.votes_count} votos
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="text-uppercase mb-1 d-block" style={{ fontSize: '0.66rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)' }}>
                                Motivo de la Acción de Moderación
                            </label>
                            <input
                                type="text"
                                value={confirmModal.reason}
                                onChange={e => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
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
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
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
                                    backgroundColor: confirmModal.action === 'delete'
                                        ? 'var(--admin-rose)'
                                        : confirmModal.action === 'pause' || confirmModal.action === 'reset_votes'
                                            ? 'var(--admin-amber)'
                                            : 'var(--admin-emerald)',
                                    border: 'none'
                                }}
                            >
                                Confirmar {confirmModal.action.toUpperCase()}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
