import { useState, useEffect } from 'react'
import {
    Tv,
    Clock,
    Users,
    AlertCircle,
    BellRing,
    RefreshCw
} from 'lucide-react'
import { getRooms, pingRoom } from '../services/adminApi'
import type { RoomItem } from '../services/adminApi'

export function RoomsPage() {
    const [filterPhase, setFilterPhase] = useState<string>('all')
    const [rooms, setRooms] = useState<RoomItem[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [pingingRoomId, setPingingRoomId] = useState<string | null>(null)
    const [pingMessage, setPingMessage] = useState<string | null>(null)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

    const fetchRoomsData = async () => {
        setLoading(true)
        try {
            const data = await getRooms(filterPhase)
            setRooms(data.rooms)
            if (data.rooms.length > 0 && !selectedRoomId) {
                setSelectedRoomId(data.rooms[0].id)
            }
        } catch (err) {
            console.error('Error fetching rooms:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRoomsData()
    }, [filterPhase])

    const handlePing = async (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation()
        setPingingRoomId(roomId)
        setPingMessage(null)
        try {
            const res = await pingRoom(roomId)
            setPingMessage(res.message)
            setTimeout(() => setPingMessage(null), 4000)
        } catch (err: any) {
            setPingMessage('Error al emitir ping')
        } finally {
            setPingingRoomId(null)
        }
    }

    const activeCount = rooms.filter(r => ['voting', 'candidates', 'watching'].includes(r.status)).length
    const concludedCount = rooms.filter(r => ['selected', 'completed'].includes(r.status)).length
    const totalMembers = rooms.reduce((acc, r) => acc + r.members_count, 0)
    const avgQuorum = rooms.length > 0 ? Math.round(rooms.reduce((acc, r) => acc + r.quorum_percentage, 0) / rooms.length) : 0

    const selectedRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0]

    return (
        <div>
            {/* Header del módulo */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0">
                        Salas & Sesiones de Votación
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Supervisión técnica de quórum, desempates y ciclo de vida de salas en PostgreSQL
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchRoomsData}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-2"
                        style={{ fontSize: '0.74rem' }}
                    >
                        <RefreshCw size={13} style={{ color: 'var(--admin-text-muted)' }} />
                        <span>Actualizar</span>
                    </button>
                    <span className="admin-badge admin-badge-success font-mono">
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                        {rooms.length} salas registradas
                    </span>
                </div>
            </div>

            {pingMessage && (
                <div className="p-2 mb-3 rounded-1 font-mono d-flex align-items-center gap-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34D399', fontSize: '0.76rem' }}>
                    <BellRing size={13} />
                    <span>{pingMessage}</span>
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
                                Salas Activas
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Tv size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{activeCount}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>en votación/postulación</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            {concludedCount} concluidas
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Con ganador
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
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>participación</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            Nominal
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Métrica en vivo
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
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>usuarios en salas</span>
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
                                Estado de Conexión
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <AlertCircle size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">100%</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>uptime</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            Sincronizado
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            AWS EC2 PostgreSQL
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. MONITOR DE SALAS EN VIVO Y DETALLE DE QUÓRUM
               ============================================================ */}
            <div className="row g-3 mb-4">
                {/* LISTADO DE SALAS */}
                <div className="col-12 col-xl-8">
                    <div className="admin-card">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Sesiones Activas</h2>
                                <span className="admin-subtitle">Filtrar por estado del ciclo de vida</span>
                            </div>

                            <div className="d-flex gap-1">
                                {[
                                    { key: 'all', label: 'Todas' },
                                    { key: 'voting', label: 'Votación' },
                                    { key: 'candidates', label: 'Candidatos' },
                                    { key: 'concluded', label: 'Concluidas' }
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        type="button"
                                        onClick={() => setFilterPhase(f.key)}
                                        className={`admin-btn ${filterPhase === f.key ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="d-flex flex-column gap-2">
                                <div className="admin-skeleton" style={{ height: 50, width: '100%' }}></div>
                                <div className="admin-skeleton" style={{ height: 50, width: '100%' }}></div>
                                <div className="admin-skeleton" style={{ height: 50, width: '100%' }}></div>
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="text-center py-4 text-secondary font-mono" style={{ fontSize: '0.8rem' }}>
                                No se encontraron salas en esta fase.
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {rooms.map(room => {
                                    const isSelected = room.id === selectedRoomId
                                    const isPinging = pingingRoomId === room.id
                                    const candidateTitle = room.selected_anime?.title || room.top_candidate?.title || 'Sin candidatos'
                                    const scoreDisplay = room.selected_anime?.score || room.top_candidate?.score || 0

                                    return (
                                        <div
                                            key={room.id}
                                            onClick={() => setSelectedRoomId(room.id)}
                                            className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-2.5 rounded-1 cursor-pointer"
                                            style={{
                                                backgroundColor: isSelected ? '#141414' : 'var(--admin-surface-2)',
                                                border: isSelected ? '1px solid #FFFFFF' : '1px solid var(--admin-border-subtle)',
                                                cursor: 'pointer',
                                                transition: 'all 150ms ease'
                                            }}
                                        >
                                            <div style={{ minWidth: 200 }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="fw-semibold text-white" style={{ fontSize: '0.8rem' }}>
                                                        {room.name}
                                                    </span>
                                                    <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.64rem' }}>
                                                        {room.invite_code}
                                                    </span>
                                                </div>
                                                <div className="text-secondary small font-mono mt-0.5" style={{ fontSize: '0.68rem' }}>
                                                    {room.members_count} miembros · {room.candidates_count} candidatos · {room.votes_count} votos
                                                </div>
                                            </div>

                                            <div className="d-flex align-items-center gap-3">
                                                <div className="d-none d-md-block" style={{ minWidth: 140 }}>
                                                    <div className="text-white text-truncate" style={{ maxWidth: 140, fontSize: '0.74rem' }}>
                                                        {candidateTitle}
                                                    </div>
                                                    <div className="font-mono text-secondary" style={{ fontSize: '0.66rem' }}>
                                                        Score: {scoreDisplay || '—'}/10
                                                    </div>
                                                </div>

                                                <div style={{ width: 80 }}>
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

                                                <button
                                                    type="button"
                                                    onClick={(e) => handlePing(e, room.id)}
                                                    disabled={isPinging}
                                                    className="admin-btn admin-btn-secondary font-mono d-flex align-items-center gap-1.5"
                                                    style={{ fontSize: '0.68rem', padding: '0.22rem 0.5rem' }}
                                                    title="Enviar pulso WebSocket / Ping de quórum"
                                                >
                                                    {isPinging ? (
                                                        <span className="admin-spinner"></span>
                                                    ) : (
                                                        <BellRing size={11} />
                                                    )}
                                                    <span>{isPinging ? 'Enviando...' : 'Ping'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* DETALLE DE SALA SELECCIONADA */}
                <div className="col-12 col-xl-4">
                    <div className="admin-card h-100 d-flex flex-column justify-content-between">
                        {selectedRoom ? (
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                        Detalle de Auditoría
                                    </span>
                                    <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.64rem' }}>
                                        {selectedRoom.status}
                                    </span>
                                </div>

                                <h3 className="fw-bold text-white mb-1" style={{ fontSize: '0.95rem' }}>
                                    {selectedRoom.name}
                                </h3>
                                <p className="text-secondary mb-3" style={{ fontSize: '0.74rem' }}>
                                    {selectedRoom.description || 'Sala de votación grupal creada en Animigos.'}
                                </p>

                                <div className="p-2 mb-3 rounded-1 font-mono" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', fontSize: '0.72rem' }}>
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
                                    <div className="d-flex justify-content-between py-1" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                        <span style={{ color: 'var(--admin-text-muted)' }}>VOTOS EMITIDOS:</span>
                                        <span className="text-white">{selectedRoom.votes_count} votos</span>
                                    </div>
                                </div>

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

                                {selectedRoom.selected_anime && (
                                    <div className="p-2.5 rounded-1" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <span className="text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '0.64rem', color: 'var(--admin-emerald)' }}>
                                            Anime Ganador (Consenso)
                                        </span>
                                        <div className="fw-bold text-white" style={{ fontSize: '0.82rem' }}>
                                            {selectedRoom.selected_anime.title}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-5 text-secondary font-mono" style={{ fontSize: '0.78rem' }}>
                                Selecciona una sala para ver la auditoría
                            </div>
                        )}

                        <div className="pt-2 border-top mt-3 font-mono" style={{ fontSize: '0.68rem', borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-muted)' }}>
                            ID: {selectedRoom?.id.slice(0, 18)}...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
