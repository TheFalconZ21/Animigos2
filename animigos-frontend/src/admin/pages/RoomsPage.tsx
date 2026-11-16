import { useState, useEffect, useMemo } from 'react'
import {
    Tv,
    Clock,
    Users,
    RefreshCw,
    Search,
    Trash2,
    CheckCircle2,
    ChevronRight,
    Plus,
    PlayCircle,
    PauseCircle,
    Eye,
    Sparkles
} from 'lucide-react'
import {
    getRooms,
    moderateRoom,
    getRoomsCleanupPolicy,
    saveRoomsCleanupPolicy,
    runRoomsCleanup,
    createAdminRoom
} from '../services/adminApi'
import type { RoomItem, RoomsCleanupPolicy } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type RoomsSubView = 'directory' | 'room-inspector' | 'cleanup-policy' | 'create-room'

export function RoomsPage() {
    const [rooms, setRooms] = useState<RoomItem[]>([])
    const [unfilteredTotal, setUnfilteredTotal] = useState<number>(0)
    const [, setLoading] = useState<boolean>(true)
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

    // Sub-vista activa (Nivel 2)
    const [activeSubView, setActiveSubView] = useAdminSubView<RoomsSubView>()
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null)

    // Filtros del Directorio en Sub-Vista
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [statusFilter, setStatusFilter] = useState<string>('')

    // Estado de Creación de Sala en Sub-Vista
    const [newRoomData, setNewRoomData] = useState({
        name: '',
        host_name: 'Admin Host',
        status: 'voting'
    })
    const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false)

    // Estado de Política de Limpieza en Sub-Vista
    const [cleanupPolicy, setCleanupPolicy] = useState<RoomsCleanupPolicy>({
        enabled: false,
        inactivity_threshold_days: 7,
        target_status: 'abandoned',
        min_members_protected: 3,
        frequency: 'daily'
    })
    const [matchingCleanupRooms, setMatchingCleanupRooms] = useState<RoomItem[]>([])
    const [isSavingPolicy, setIsSavingPolicy] = useState<boolean>(false)
    const [isRunningCleanup, setIsRunningCleanup] = useState<boolean>(false)

    // Toast ejecutivo
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'warning' | 'danger' }>({
        show: false,
        message: '',
        type: 'success'
    })

    const showFeedback = (message: string, type: 'success' | 'warning' | 'danger' = 'success') => {
        setToast({ show: true, message, type })
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3800)
    }

    const fetchRoomsData = async () => {
        try {
            const res = await getRooms()
            setRooms(res.rooms)
            setUnfilteredTotal(res.unfiltered_total ?? res.total)
        } catch (err) {
            console.error('Error loading rooms:', err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    const fetchCleanupPolicyData = async () => {
        try {
            const res = await getRoomsCleanupPolicy()
            setCleanupPolicy(res.policy)
            setMatchingCleanupRooms(res.matching_rooms || [])
        } catch (err) {
            console.error('Error loading cleanup policy:', err)
        }
    }

    useEffect(() => {
        fetchRoomsData()
        fetchCleanupPolicyData()
    }, [])

    // Segmentos para el Donut Protagonista
    const donutSegments = useMemo(() => {
        const total = rooms.length || 1
        const votingCount = rooms.filter(r => r.status === 'voting').length
        const candidatesCount = rooms.filter(r => r.status === 'candidates').length
        const selectedCount = rooms.filter(r => r.status === 'selected' || r.status === 'completed').length
        const otherCount = rooms.filter(r => !['voting', 'candidates', 'selected', 'completed'].includes(r.status)).length

        const size = 210
        const strokeWidth = 26
        const radius = (size - strokeWidth) / 2
        const center = size / 2
        const circumference = 2 * Math.PI * radius

        const raw = [
            {
                id: 'voting',
                label: 'En Votación Activa',
                count: votingCount,
                pct: rooms.length > 0 ? Math.round((votingCount / total) * 100) : 0,
                color: '#F59E0B',
                desc: 'Miembros emitiendo votos en tiempo real',
                agingNote: `${votingCount} salas en fase`
            },
            {
                id: 'candidates',
                label: 'Postulando Candidatos',
                count: candidatesCount,
                pct: rooms.length > 0 ? Math.round((candidatesCount / total) * 100) : 0,
                color: '#38BDF8',
                desc: 'Configurando pool de animes o esperando amigos',
                agingNote: `${candidatesCount} salas en fase`
            },
            {
                id: 'selected',
                label: 'Consenso Alcanzado',
                count: selectedCount,
                pct: rooms.length > 0 ? Math.round((selectedCount / total) * 100) : 0,
                color: '#10B981',
                desc: 'Anime ganador determinado por el algoritmo',
                agingNote: `${selectedCount} salas resueltas`
            },
            {
                id: 'empty',
                label: 'Inactivas / Candidatas a Purga',
                count: otherCount,
                pct: rooms.length > 0 ? Math.round((otherCount / total) * 100) : 0,
                color: '#64748B',
                desc: 'Salas abandonadas sin quórum reciente',
                agingNote: `${matchingCleanupRooms.length} elegibles para purga`
            }
        ]

        let acc = 0
        const arcs = raw.map(seg => {
            const frac = total > 0 ? seg.count / total : 0
            const strokeDasharray = `${frac * circumference} ${circumference}`
            const strokeDashoffset = -(acc * circumference)
            acc += frac
            return { ...seg, strokeDasharray, strokeDashoffset }
        })

        return { size, strokeWidth, radius, center, total: rooms.length, votingCount, candidatesCount, selectedCount, otherCount, arcs }
    }, [rooms])

    const filteredRooms = useMemo(() => {
        return rooms.filter(r => {
            if (statusFilter) {
                if (statusFilter === 'selected' && r.status !== 'selected' && r.status !== 'completed') return false
                if (statusFilter !== 'selected' && r.status !== statusFilter) return false
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const hostName = r.members?.[0]?.name || ''
                if (!r.name.toLowerCase().includes(q) && !r.invite_code.toLowerCase().includes(q) && !hostName.toLowerCase().includes(q)) {
                    return false
                }
            }
            return true
        })
    }, [rooms, statusFilter, searchQuery])

    const selectedRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0] || null

    const handleModerateAction = async (roomId: string, action: 'pause' | 'resume' | 'force_select' | 'reset_votes' | 'delete' | 'ping') => {
        try {
            const res = await moderateRoom(roomId, action)
            showFeedback(res.message, action === 'delete' ? 'danger' : 'success')
            await fetchRoomsData()
            if (action === 'delete' && selectedRoomId === roomId) {
                setActiveSubView('directory')
            }
        } catch (err: any) {
            showFeedback(err.message || 'Error al moderar sala', 'danger')
        }
    }

    const handleCreateRoomSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoomData.name.trim()) return
        setIsCreatingRoom(true)
        try {
            const res = await createAdminRoom(newRoomData)
            showFeedback(res.message || `Sala "${newRoomData.name}" creada exitosamente`, 'success')
            setNewRoomData({ name: '', host_name: 'Admin Host', status: 'voting' })
            await fetchRoomsData()
            setActiveSubView('directory')
        } catch (err: any) {
            showFeedback(err.message || 'Error al crear sala', 'danger')
        } finally {
            setIsCreatingRoom(false)
        }
    }

    const handleSaveCleanup = async () => {
        setIsSavingPolicy(true)
        try {
            const res = await saveRoomsCleanupPolicy(cleanupPolicy)
            setCleanupPolicy(res.policy)
            showFeedback('Política de limpieza actualizada en AWS PostgreSQL', 'success')
            await fetchCleanupPolicyData()
        } catch (err: any) {
            showFeedback(err.message || 'Error al guardar política', 'danger')
        } finally {
            setIsSavingPolicy(false)
        }
    }

    const handleExecuteCleanup = async () => {
        setIsRunningCleanup(true)
        try {
            const res = await runRoomsCleanup()
            showFeedback(res.message, 'warning')
            await fetchRoomsData()
            await fetchCleanupPolicyData()
        } catch (err: any) {
            showFeedback(err.message || 'Error al ejecutar purga', 'danger')
        } finally {
            setIsRunningCleanup(false)
        }
    }

    const subViewOptions: SubViewOption<RoomsSubView>[] = [
        { id: 'directory', label: 'Directorio de Salas', badge: `${rooms.length}` },
        { id: 'room-inspector', label: 'Inspector de Sala' },
        { id: 'cleanup-policy', label: 'Política de Purga', badge: `${matchingCleanupRooms.length}` },
        { id: 'create-room', label: '+ Crear Sala' }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Salas & Votación"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {/* SUB-VISTA 1: DIRECTORIO OPERATIVO DE SALAS */}
                {activeSubView === 'directory' && (
                    <div className="admin-card flex-grow-1 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                <div>
                                    <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                        Explorador y Moderación de Salas ({filteredRooms.length})
                                    </h2>
                                    <span className="admin-subtitle">
                                        Haz clic en cualquier sala para abrir su Inspector de Quórum o aplica acciones rápidas
                                    </span>
                                </div>

                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    <div className="admin-input-wrapper d-flex align-items-center gap-2">
                                        <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar sala, código o host..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-transparent border-0 text-white"
                                            style={{ fontSize: '0.8rem', outline: 'none', width: 200 }}
                                        />
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {[
                                            { id: '', label: 'Todas' },
                                            { id: 'voting', label: 'En Votación' },
                                            { id: 'candidates', label: 'Candidatos' },
                                            { id: 'selected', label: 'Consenso' }
                                        ].map(st => (
                                            <button
                                                key={st.id}
                                                type="button"
                                                onClick={() => setStatusFilter(st.id)}
                                                className={`admin-subview-pill ${statusFilter === st.id ? 'active' : ''}`}
                                            >
                                                {st.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                <table className="table table-dark table-hover m-0 align-middle" style={{ fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                            <th>SALA / PIN</th>
                                            <th>ANFITRIÓN</th>
                                            <th>FASE ACTUAL</th>
                                            <th className="text-center">QUÓRUM & VOTOS</th>
                                            <th>ANIME GANADOR / POOL</th>
                                            <th className="text-end">ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRooms.map(room => (
                                            <tr key={room.id} className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                                <td>
                                                    <div className="fw-semibold text-white">{room.name}</div>
                                                    <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
                                                        PIN: {room.invite_code} • {room.created_display || room.created_at}
                                                    </span>
                                                </td>
                                                <td className="text-white">{room.members?.[0]?.name || 'Host'}</td>
                                                <td>
                                                    {room.status === 'voting' && <span className="admin-badge admin-badge-warning">En Votación</span>}
                                                    {room.status === 'candidates' && <span className="admin-badge admin-badge-info">Candidatos</span>}
                                                    {(room.status === 'selected' || room.status === 'completed') && <span className="admin-badge admin-badge-success">Consenso</span>}
                                                    {!['voting', 'candidates', 'selected', 'completed'].includes(room.status) && <span className="admin-badge admin-badge-neutral">{room.status}</span>}
                                                </td>
                                                <td className="text-center font-mono">
                                                    <span className="text-white fw-bold">{room.members_count}</span> miembros • <span style={{ color: 'var(--admin-focus)' }}>{room.votes_count} votos</span>
                                                </td>
                                                <td>
                                                    {room.selected_anime?.title ? (
                                                        <span style={{ color: 'var(--admin-emerald)', fontWeight: 600 }}>🏆 {room.selected_anime.title}</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--admin-text-secondary)' }}>{room.candidates_count} animes propuestos</span>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-inline-flex align-items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedRoomId(room.id)
                                                                setActiveSubView('room-inspector')
                                                            }}
                                                            className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Inspeccionar</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleModerateAction(room.id, 'delete')}
                                                            className="admin-btn admin-btn-secondary text-danger"
                                                            title="Eliminar sala"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                            <span>Mostrando {filteredRooms.length} de {unfilteredTotal} salas totales</span>
                            <button
                                type="button"
                                onClick={() => setActiveSubView('create-room')}
                                className="admin-btn d-inline-flex align-items-center gap-1.5"
                                style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                            >
                                <Plus size={14} />
                                <span>Nueva Sala</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 2: INSPECTOR DETALLADO DE SALA */}
                {activeSubView === 'room-inspector' && selectedRoom && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <span className="admin-badge admin-badge-info font-mono mb-2">PIN: {selectedRoom.invite_code}</span>
                                        <h2 className="admin-title m-0" style={{ fontSize: '1.25rem' }}>{selectedRoom.name}</h2>
                                        <p className="admin-subtitle m-0 mt-1">
                                            Anfitrión: <strong className="text-white">{selectedRoom.members?.[0]?.name || 'Host'}</strong> • Creada: {selectedRoom.created_display || selectedRoom.created_at}
                                        </p>
                                    </div>
                                    <span className="admin-badge admin-badge-success">{selectedRoom.status.toUpperCase()}</span>
                                </div>

                                <div className="row g-3 mb-4">
                                    <div className="col-4">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <span className="admin-kpi-kicker">Miembros</span>
                                            <div className="admin-kpi-value mt-1">{selectedRoom.members_count}</div>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <span className="admin-kpi-kicker">Candidatos</span>
                                            <div className="admin-kpi-value mt-1">{selectedRoom.candidates_count}</div>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <span className="admin-kpi-kicker">Votos Emitidos</span>
                                            <div className="admin-kpi-value mt-1" style={{ color: 'var(--admin-focus)' }}>{selectedRoom.votes_count}</div>
                                        </div>
                                    </div>
                                </div>

                                <h3 className="admin-title mb-2.5" style={{ fontSize: '0.95rem' }}>
                                    Estado del Candidato Principal y Selección
                                </h3>
                                <div className="d-flex flex-column gap-2">
                                    {selectedRoom.selected_anime?.title && (
                                        <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-emerald)' }}>
                                            <span className="text-white fw-semibold">🏆 Ganador: {selectedRoom.selected_anime.title}</span>
                                            <span className="admin-badge admin-badge-success font-mono">Score: {selectedRoom.selected_anime.score || 9.1}</span>
                                        </div>
                                    )}
                                    {selectedRoom.top_candidate?.title && (
                                        <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <span className="text-white fw-medium">Líder en Votación: {selectedRoom.top_candidate.title}</span>
                                            <span className="font-mono" style={{ color: 'var(--admin-focus)' }}>Score: {selectedRoom.top_candidate.score}</span>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                        <span style={{ color: 'var(--admin-text-secondary)' }}>Porcentaje de Quórum completado</span>
                                        <strong className="font-mono text-white">{selectedRoom.quorum_percentage}%</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-top d-flex flex-wrap gap-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <button
                                    type="button"
                                    onClick={() => handleModerateAction(selectedRoom.id, 'force_select')}
                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1.5 text-white"
                                >
                                    <CheckCircle2 size={14} style={{ color: 'var(--admin-emerald)' }} />
                                    <span>Forzar Consenso</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModerateAction(selectedRoom.id, 'pause')}
                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1.5"
                                >
                                    <PauseCircle size={14} />
                                    <span>Pausar Sala</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModerateAction(selectedRoom.id, 'resume')}
                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1.5"
                                >
                                    <PlayCircle size={14} />
                                    <span>Reanudar</span>
                                </button>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.95rem' }}>
                                    Participantes en Sala ({selectedRoom.members?.length || 0})
                                </h3>
                                <div className="d-flex flex-column gap-2">
                                    {(selectedRoom.members || []).map((m, i) => (
                                        <div key={i} className="admin-decision-item d-flex justify-content-between align-items-center">
                                            <div>
                                                <div className="text-white fw-medium" style={{ fontSize: '0.84rem' }}>{m.name}</div>
                                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>{m.role}</span>
                                            </div>
                                            <span className="admin-badge admin-badge-info">{m.channel}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 3: POLÍTICA DE LIMPIEZA Y PURGA PROGRAMADA */}
                {activeSubView === 'cleanup-policy' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <span className="admin-badge admin-badge-warning mb-2">MANTENIMIENTO DE BASE DE DATOS</span>
                                <h2 className="admin-title mb-1" style={{ fontSize: '1.25rem' }}>
                                    Política de Purga de Salas Inactivas
                                </h2>
                                <p className="admin-subtitle mb-4">
                                    Automatiza la liberación de salas estancadas preservando siempre el historial de consensos logrados
                                </p>

                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <label className="admin-kpi-kicker d-block mb-2">Días de Inactividad para Purga</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={90}
                                                value={cleanupPolicy.inactivity_threshold_days}
                                                onChange={(e) => setCleanupPolicy({ ...cleanupPolicy, inactivity_threshold_days: Number(e.target.value) })}
                                                className="form-control bg-dark text-white border-secondary font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <label className="admin-kpi-kicker d-block mb-2">Mínimo de Miembros Protegidos</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={cleanupPolicy.min_members_protected}
                                                onChange={(e) => setCleanupPolicy({ ...cleanupPolicy, min_members_protected: Number(e.target.value) })}
                                                className="form-control bg-dark text-white border-secondary font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                <button
                                    type="button"
                                    onClick={handleSaveCleanup}
                                    disabled={isSavingPolicy}
                                    className="admin-btn admin-btn-secondary text-white"
                                >
                                    {isSavingPolicy ? 'Guardando...' : 'Guardar Configuración'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteCleanup}
                                    disabled={isRunningCleanup}
                                    className="admin-btn d-inline-flex align-items-center gap-1.5"
                                    style={{ backgroundColor: 'var(--admin-amber)', color: '#090B10', fontWeight: 600 }}
                                >
                                    <Trash2 size={14} />
                                    <span>{isRunningCleanup ? 'Purgando...' : `Ejecutar Purga (${matchingCleanupRooms.length} elegibles)`}</span>
                                </button>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.95rem' }}>Protección de Datos</h3>
                                <p className="admin-subtitle">
                                    Las salas con anime ganador seleccionado quedan blindadas para preservar las métricas históricas del algoritmo.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 4: CREACIÓN DE NUEVA SALA */}
                {activeSubView === 'create-room' && (
                    <div className="admin-card" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
                        <h2 className="admin-title mb-1" style={{ fontSize: '1.2rem' }}>Crear Nueva Sala de Consenso</h2>
                        <p className="admin-subtitle mb-4">Instancia una sala oficial directamente en PostgreSQL para pruebas o eventos de comunidad</p>

                        <form onSubmit={handleCreateRoomSubmit} className="d-flex flex-column gap-3">
                            <div>
                                <label className="admin-kpi-kicker d-block mb-1.5">Nombre de la Sala</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. Maratón Cyberpunk Viernes"
                                    value={newRoomData.name}
                                    onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div>
                                <label className="admin-kpi-kicker d-block mb-1.5">Anfitrión Asignado</label>
                                <input
                                    type="text"
                                    required
                                    value={newRoomData.host_name}
                                    onChange={(e) => setNewRoomData({ ...newRoomData, host_name: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="d-flex justify-content-end gap-2 pt-2">
                                <button type="button" onClick={() => setActiveSubView(null)} className="admin-btn admin-btn-secondary">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingRoom}
                                    className="admin-btn"
                                    style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                                >
                                    {isCreatingRoom ? 'Creando...' : 'Instanciar Sala'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    const activeArc = donutSegments.arcs.find(a => a.id === (focusedSegmentId || 'voting')) || donutSegments.arcs[0]

    return (
        <div className="admin-viewport-shell">
            {toast.show && (
                <div className="admin-correlative-bridge">
                    <span className="text-white">{toast.message}</span>
                </div>
            )}

            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                        Salas de Consenso & Votación en Vivo
                    </h1>
                    <p className="admin-subtitle m-0 mt-1">
                        Distribución operativa de salas por etapa, detección de estancamiento y moderación de quórum
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubView('create-room')}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <Plus size={14} />
                        <span>Nueva Sala</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsRefreshing(true)
                            fetchRoomsData()
                        }}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setStatusFilter('voting')
                        setActiveSubView('directory')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">En Votación Activa</span>
                        <span className="admin-badge admin-badge-warning font-mono">En Vivo</span>
                    </div>
                    <div className="admin-kpi-value my-1">{donutSegments.votingCount}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ver salas votando</span>
                            <ChevronRight size={13} />
                        </span>
                        <Tv size={15} style={{ color: 'var(--admin-amber)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setStatusFilter('selected')
                        setActiveSubView('directory')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Consenso Alcanzado</span>
                        <span className="admin-badge admin-badge-success font-mono">Resueltas</span>
                    </div>
                    <div className="admin-kpi-value my-1">{donutSegments.selectedCount}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Auditar ganadores</span>
                            <ChevronRight size={13} />
                        </span>
                        <CheckCircle2 size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setStatusFilter('')
                        setActiveSubView('directory')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Total Salas Registradas</span>
                        <span className="admin-badge admin-badge-info font-mono">PostgreSQL</span>
                    </div>
                    <div className="admin-kpi-value my-1">{unfilteredTotal || rooms.length}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Abrir directorio completo</span>
                            <ChevronRight size={13} />
                        </span>
                        <Users size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('cleanup-policy')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Candidatas a Purga</span>
                        <span className="admin-badge admin-badge-neutral font-mono">{cleanupPolicy.inactivity_threshold_days}d inact.</span>
                    </div>
                    <div className="admin-kpi-value my-1">{matchingCleanupRooms.length}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Configurar limpieza</span>
                            <ChevronRight size={13} />
                        </span>
                        <Clock size={15} style={{ color: 'var(--admin-text-secondary)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Donut Maestro de Fases + Cruce de Envejecimiento */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Distribución de Salas por Fase Operativa
                            </h2>
                            <span className="admin-badge admin-badge-info">Donut Interactivo</span>
                        </div>

                        <div className="row align-items-center g-4 my-1">
                            <div className="col-12 col-md-5 d-flex justify-content-center">
                                <div className="position-relative" style={{ width: donutSegments.size, height: donutSegments.size }}>
                                    <svg
                                        width={donutSegments.size}
                                        height={donutSegments.size}
                                        viewBox={`0 0 ${donutSegments.size} ${donutSegments.size}`}
                                        style={{ transform: 'rotate(-90deg)' }}
                                    >
                                        <circle
                                            cx={donutSegments.center}
                                            cy={donutSegments.center}
                                            r={donutSegments.radius}
                                            fill="transparent"
                                            stroke="var(--admin-surface-3)"
                                            strokeWidth={donutSegments.strokeWidth}
                                        />
                                        {donutSegments.arcs.map(arc => {
                                            const isHovered = focusedSegmentId === arc.id
                                            return (
                                                <circle
                                                    key={arc.id}
                                                    cx={donutSegments.center}
                                                    cy={donutSegments.center}
                                                    r={donutSegments.radius}
                                                    fill="transparent"
                                                    stroke={arc.color}
                                                    strokeWidth={isHovered ? donutSegments.strokeWidth + 5 : donutSegments.strokeWidth}
                                                    strokeDasharray={arc.strokeDasharray}
                                                    strokeDashoffset={arc.strokeDashoffset}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.22s var(--admin-ease)',
                                                        opacity: focusedSegmentId && !isHovered ? 0.35 : 1
                                                    }}
                                                    onMouseEnter={() => setFocusedSegmentId(arc.id)}
                                                    onClick={() => {
                                                        setStatusFilter(arc.id === 'empty' ? '' : arc.id)
                                                        setActiveSubView('directory')
                                                    }}
                                                />
                                            )
                                        })}
                                    </svg>
                                    <div className="position-absolute top-50 start-50 translate-middle text-center pointer-events-none">
                                        <span className="admin-kpi-value d-block">{activeArc.count}</span>
                                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.72rem', fontWeight: 600 }}>
                                            {activeArc.pct}% DEL TOTAL
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-md-7">
                                <div className="d-flex flex-column gap-2.5">
                                    {donutSegments.arcs.map(seg => {
                                        const isFocused = focusedSegmentId === seg.id
                                        return (
                                            <div
                                                key={seg.id}
                                                onMouseEnter={() => setFocusedSegmentId(seg.id)}
                                                onClick={() => {
                                                    setStatusFilter(seg.id === 'empty' ? '' : seg.id)
                                                    setActiveSubView('directory')
                                                }}
                                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                                                style={{
                                                    borderColor: isFocused ? seg.color : 'var(--admin-border-subtle)'
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2.5">
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
                                                    <div>
                                                        <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>{seg.label}</div>
                                                        <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>{seg.desc}</div>
                                                    </div>
                                                </div>
                                                <div className="text-end font-mono">
                                                    <span className="text-white fw-bold" style={{ fontSize: '0.92rem' }}>{seg.count}</span>
                                                    <div style={{ color: seg.color, fontSize: '0.75rem' }}>{seg.pct}%</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>Cruce de Salud: <strong className="text-white">{donutSegments.selectedCount} salas</strong> alcanzaron acuerdo sin intervención</span>
                        <span className="font-mono">Tiempo Real WebSockets</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Decisiones (Fase x Aging) */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                CRUCE: FASE × ENVEJECIMIENTO
                            </span>
                            <span className="admin-badge admin-badge-neutral font-mono">{activeArc.agingNote}</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            {activeArc.label}
                        </h3>
                        <p className="admin-subtitle mb-3">
                            {activeArc.desc}. Audita las salas más recientes o interviene aquellas que superan el umbral de espera.
                        </p>

                        <div className="d-flex flex-column gap-2 mb-3">
                            {rooms.slice(0, 3).map(r => (
                                <div
                                    key={r.id}
                                    onClick={() => {
                                        setSelectedRoomId(r.id)
                                        setActiveSubView('room-inspector')
                                    }}
                                    className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                                >
                                    <div>
                                        <div className="text-white fw-semibold" style={{ fontSize: '0.82rem' }}>{r.name}</div>
                                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.74rem' }}>
                                            Host: {r.members?.[0]?.name || 'Host'} • {r.members_count} miembros
                                        </span>
                                    </div>
                                    <span className="admin-kpi-drill-pill">
                                        <span>Inspeccionar</span>
                                        <ChevronRight size={13} />
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-2.5 rounded-2 d-flex align-items-start gap-2" style={{ backgroundColor: 'var(--admin-focus-bg)', border: '1px solid var(--admin-focus-border)' }}>
                            <Sparkles size={15} style={{ color: 'var(--admin-focus)', flexShrink: 0, marginTop: 2 }} />
                            <span style={{ color: 'var(--admin-text-primary)', fontSize: '0.78rem' }}>
                                Haz clic en cualquier sala para abrir su <strong>Inspector de Quórum</strong> en Sub-Vista dedicada.
                            </span>
                        </div>
                    </div>

                    <div className="d-flex flex-column gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter('')
                                setActiveSubView('directory')
                            }}
                            className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                            style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                        >
                            <span>Abrir Directorio Completo de Salas</span>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
