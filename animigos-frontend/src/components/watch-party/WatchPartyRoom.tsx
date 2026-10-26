import React, { useState, useEffect, useRef } from 'react'
import {
    Users,
    Tv,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    Clock,
    Plus,
    Copy,
    Check,
    MessageSquare,
    Send,
    Radio,
    Sparkles,
    RefreshCw,
    ShieldAlert,
    PartyPopper,
    Share2,
    CalendarPlus,
} from 'lucide-react'
import { useWatchParty } from '../../hooks/useWatchParty'
import {
    fetchRoomByCode,
    selectWinningAnimeApi,
} from '../../services/watchPartyApi'
import { useAuth } from '../../context/AuthContext'

const QUICK_EMOJIS = ['🍿', '🎉', '🔥', '👏', '😱', '❤️']

export const WatchPartyRoom: React.FC = () => {
    const { user } = useAuth()
    const [roomCodeInput, setRoomCodeInput] = useState('')
    const [currentRoomId, setCurrentRoomId] = useState<string>('')
    const [copied, setCopied] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [scheduleDate, setScheduleDate] = useState('')
    const [scheduleNotes, setScheduleNotes] = useState('')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoadingRoom, setIsLoadingRoom] = useState(false)

    const chatScrollRef = useRef<HTMLDivElement>(null)

    // Si el usuario está autenticado, usar su nombre y token
    const userName = user?.display_name || user?.username || 'Invitado'
    const userToken = user ? `user_${user.id}` : 'guest_anon'

    // Cargar sala por código inicial si viene en URL hash o buscar una sala por defecto
    useEffect(() => {
        const hash = window.location.hash
        const match = hash.match(/sala[=/]([a-zA-Z0-9_-]+)/i)
        const initialCode = match ? match[1] : ''

        if (initialCode) {
            handleJoinByCode(initialCode)
        } else {
            // Intentar cargar la primera sala disponible del backend para demostración inmediata
            fetchFirstAvailableRoom()
        }
    }, [])

    const fetchFirstAvailableRoom = async () => {
        setIsLoadingRoom(true)
        try {
            const res = await fetch('/api/groups/lists/')
            if (res.ok) {
                const data = await res.json()
                const rooms = Array.isArray(data) ? data : data.results || []
                if (rooms.length > 0) {
                    setCurrentRoomId(rooms[0].id)
                }
            }
        } catch (e) {
            console.error('Error cargando lista de salas:', e)
        } finally {
            setIsLoadingRoom(false)
        }
    }

    const handleJoinByCode = async (codeToJoin?: string) => {
        const code = (codeToJoin || roomCodeInput).trim().toUpperCase()
        if (!code) return
        setErrorMessage(null)
        setIsLoadingRoom(true)
        try {
            const foundRoom = await fetchRoomByCode(code)
            setCurrentRoomId(foundRoom.id)
            setRoomCodeInput('')
            window.location.hash = `#sala/${foundRoom.invite_code}`
        } catch (e: any) {
            setErrorMessage(e.message || 'No se encontró una sala con ese código')
        } finally {
            setIsLoadingRoom(false)
        }
    }

    // Hook principal de tiempo real
    const {
        connectionStatus,
        latencyMs,
        room,
        chatMessages,
        floatingReactions,
        updateMyProgress,
        setGroupTarget,
        scheduleSession,
        sendChat,
        sendReaction,
        refreshRoom,
    } = useWatchParty({
        roomId: currentRoomId,
        userName,
        userToken,
        enabled: Boolean(currentRoomId),
    })

    // Scroll automático del chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
        }
    }, [chatMessages])

    const handleCopyInvite = () => {
        if (!room) return
        const inviteUrl = `${window.location.origin}/#sala/${room.invite_code}`
        navigator.clipboard.writeText(inviteUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSendChatSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!chatInput.trim()) return
        sendChat(chatInput)
        setChatInput('')
    }

    const handleSaveSchedule = (e: React.FormEvent) => {
        e.preventDefault()
        scheduleSession(scheduleDate || null, scheduleNotes)
        setShowScheduleModal(false)
    }

    const handleSelectWinnerCandidate = async (animeId: number) => {
        if (!currentRoomId) return
        try {
            await selectWinningAnimeApi(currentRoomId, animeId)
            refreshRoom()
        } catch (e) {
            console.error('Error seleccionando anime ganador:', e)
        }
    }

    // Buscar información del miembro actual en la sala
    const currentMember = room?.members?.find(
        (m) => m.guest_token === userToken || m.guest_name === userName
    )
    const myWatched = currentMember?.episodes_watched || 0
    const groupTarget = room?.current_episode || 1
    const totalEpisodes = room?.selected_anime?.episodes || 12

    // Cálculo de zona libre de spoilers: el capítulo de la persona más atrasada
    const minWatchedInGroup = room?.members && room.members.length > 0
        ? Math.min(...room.members.map((m) => m.episodes_watched))
        : 0

    // Porcentaje de avance de la meta del grupo
    const groupProgressPercent = Math.min(100, Math.round((groupTarget / totalEpisodes) * 100))

    return (
        <div className="container-fluid py-4 px-md-5" style={{ minHeight: '88vh' }}>
            {/* Header de la Sala & Controles Rápidos */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-3 border-bottom border-dark">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge bg-primary text-uppercase px-2 py-1" style={{ fontSize: '0.7rem' }}>
                            Watch Party & Conteo Grupal
                        </span>
                        {/* Indicador de Conexión en Tiempo Real */}
                        <span
                            className={`badge d-flex align-items-center gap-1.5 px-2.5 py-1 ${
                                connectionStatus === 'connected'
                                    ? 'bg-success text-white'
                                    : connectionStatus === 'reconnecting'
                                    ? 'bg-warning text-dark'
                                    : 'bg-secondary text-white'
                            }`}
                            style={{ fontSize: '0.72rem' }}
                        >
                            <Radio size={12} className={connectionStatus === 'connected' ? 'text-white' : ''} />
                            {connectionStatus === 'connected'
                                ? `EN VIVO ${latencyMs !== null ? `(${latencyMs}ms)` : ''}`
                                : connectionStatus === 'reconnecting'
                                ? 'RECONECTANDO...'
                                : 'DESCONECTADO'}
                        </span>
                    </div>

                    <h1 className="h3 text-white fw-bold mb-1">
                        {room ? room.name : 'Coordinación de Anime con Amigos'}
                    </h1>
                    <p className="text-secondary small mb-0">
                        {room?.description || 'Organicen qué ver juntos y lleven el conteo de capítulos para que nadie se quede atrás.'}
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Código de Invitación */}
                    {room && (
                        <div
                            className="d-flex align-items-center gap-2 px-3 py-2 rounded-2"
                            style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
                        >
                            <Share2 size={16} className="text-primary" />
                            <span className="text-secondary small">Código:</span>
                            <span className="text-white fw-mono fw-bold">{room.invite_code}</span>
                            <button
                                type="button"
                                onClick={handleCopyInvite}
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 py-0 px-2"
                                title="Copiar link de invitación"
                            >
                                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                <span style={{ fontSize: '0.75rem' }}>{copied ? 'Copiado' : 'Copiar'}</span>
                            </button>
                        </div>
                    )}

                    {/* Unirse por código */}
                    <div className="d-flex gap-1">
                        <input
                            type="text"
                            placeholder="CÓDIGO DE SALA"
                            value={roomCodeInput}
                            onChange={(e) => setRoomCodeInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                            className="form-control form-control-sm text-uppercase font-mono bg-dark text-white border-secondary"
                            style={{ width: 140 }}
                        />
                        <button
                            type="button"
                            onClick={() => handleJoinByCode()}
                            disabled={isLoadingRoom || !roomCodeInput.trim()}
                            className="btn btn-sm btn-primary"
                        >
                            Unirme
                        </button>
                    </div>

                    {/* Botón Refrescar */}
                    <button
                        type="button"
                        onClick={refreshRoom}
                        className="btn btn-sm btn-outline-secondary"
                        title="Refrescar estado de la sala"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="alert alert-danger py-2 px-3 small d-flex justify-content-between align-items-center">
                    <span>{errorMessage}</span>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setErrorMessage(null)} />
                </div>
            )}

            {/* Layout Principal: 8 columnas contenido y 4 columnas Chat & Actividad */}
            <div className="row g-4">
                {/* Columna Izquierda: Coordinación, Seguimiento de Capítulos y Anime */}
                <div className="col-12 col-lg-8 d-flex flex-column gap-4">
                    {/* Tarjeta del Anime Seleccionado o Aviso de Votación */}
                    {room?.selected_anime ? (
                        <div
                            className="p-3 p-md-4 rounded-3 d-flex flex-column flex-sm-row gap-4 align-items-center align-items-sm-start"
                            style={{
                                backgroundColor: '#111',
                                border: '1px solid #282828',
                                background: 'linear-gradient(135deg, rgba(255,107,0,0.07) 0%, rgba(17,17,17,0.95) 100%)',
                            }}
                        >
                            <img
                                src={room.selected_anime.image_url}
                                alt={room.selected_anime.title}
                                className="rounded-3 shadow-lg object-fit-cover"
                                style={{ width: 120, height: 170, flexShrink: 0 }}
                            />
                            <div className="flex-grow-1">
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5">
                                        Anime Activo del Grupo
                                    </span>
                                    {room.selected_anime.score && (
                                        <span className="text-warning small fw-semibold">
                                            ★ {room.selected_anime.score} / 10
                                        </span>
                                    )}
                                    <span className="text-secondary small">
                                        • {totalEpisodes} Capítulos en total
                                    </span>
                                </div>
                                <h2 className="h4 text-white fw-bold mb-2">{room.selected_anime.title}</h2>
                                <p className="text-secondary small mb-3 line-clamp-3">
                                    {room.selected_anime.synopsis || 'Disfruten de esta serie juntos. Cada miembro puede marcar su avance para coordinar la siguiente sesión.'}
                                </p>

                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    <span className="text-white small fw-semibold">
                                        Progreso de la serie:
                                    </span>
                                    <div className="progress flex-grow-1" style={{ height: 10, maxWidth: 220, backgroundColor: '#222' }}>
                                        <div
                                            className="progress-bar bg-primary"
                                            role="progressbar"
                                            style={{ width: `${groupProgressPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-primary fw-mono small fw-bold">
                                        Cap {groupTarget} de {totalEpisodes} ({groupProgressPercent}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Si no hay anime seleccionado todavía: Fase de Elección / Votación */
                        <div
                            className="p-4 rounded-3 text-center"
                            style={{ backgroundColor: '#141414', border: '1px dashed #3A3A3A' }}
                        >
                            <Tv size={36} className="text-primary mb-2 opacity-75" />
                            <h3 className="h5 text-white fw-bold mb-1">Aún no han seleccionado un anime para ver</h3>
                            <p className="text-secondary small mb-3">
                                Voten por los candidatos postulados para calcular el consenso grupal y decidir qué serie comenzarán a ver.
                            </p>
                            {room?.candidates && room.candidates.length > 0 ? (
                                <div className="row g-3 text-start mt-2">
                                    {room.candidates.map((cand) => (
                                        <div key={cand.id} className="col-12 col-md-6">
                                            <div
                                                className="p-3 rounded-2 h-100 d-flex gap-3 align-items-center"
                                                style={{ backgroundColor: '#1B1B1B', border: '1px solid #333' }}
                                            >
                                                <img
                                                    src={cand.image_url}
                                                    alt={cand.title}
                                                    className="rounded-1 object-fit-cover"
                                                    style={{ width: 50, height: 70 }}
                                                />
                                                <div className="flex-grow-1 overflow-hidden">
                                                    <h4 className="text-white small fw-bold mb-1 text-truncate">{cand.title}</h4>
                                                    <div className="text-secondary small mb-2">
                                                        Interés: <span className="text-warning fw-bold">{cand.avg_interest}/10</span> ({cand.votes_count} votos)
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectWinnerCandidate(cand.anime_id)}
                                                        className="btn btn-xs btn-outline-primary py-0.5 px-2"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        Elegir como Ganador
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-secondary small fst-italic">No hay candidatos nominados todavía.</p>
                            )}
                        </div>
                    )}

                    {/* Meta Grupal y Próxima Sesión */}
                    <div
                        className="p-3 p-md-4 rounded-3 d-flex flex-column gap-3"
                        style={{ backgroundColor: '#121212', border: '1px solid #242424' }}
                    >
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div className="d-flex align-items-center gap-2">
                                <Sparkles size={18} className="text-primary" />
                                <span className="text-white fw-bold">Meta del Grupo & Sesión de Visualización</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5"
                            >
                                <CalendarPlus size={14} />
                                <span>Agendar Próxima Sesión</span>
                            </button>
                        </div>

                        <div className="row g-3 align-items-center">
                            {/* Meta del Grupo Actual */}
                            <div className="col-12 col-md-6">
                                <div
                                    className="p-3 rounded-2 d-flex justify-content-between align-items-center"
                                    style={{ backgroundColor: '#181818', border: '1px solid #2B2B2B' }}
                                >
                                    <div>
                                        <span className="text-secondary small d-block mb-1">Capítulo Objetivo del Grupo</span>
                                        <div className="d-flex align-items-baseline gap-2">
                                            <span className="text-white h3 fw-bold mb-0 font-mono">Capítulo {groupTarget}</span>
                                            <span className="text-secondary small font-mono">/ {totalEpisodes}</span>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setGroupTarget(Math.max(1, groupTarget - 1))}
                                            disabled={groupTarget <= 1}
                                            className="btn btn-sm btn-outline-secondary px-2"
                                            title="Retroceder meta"
                                        >
                                            -1
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGroupTarget(groupTarget + 1)}
                                            className="btn btn-sm btn-primary px-3 fw-bold"
                                            title="Avanzar meta al siguiente capítulo"
                                        >
                                            +1 Siguiente
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Próxima Sesión Agendada */}
                            <div className="col-12 col-md-6">
                                <div
                                    className="p-3 rounded-2 h-100 d-flex flex-column justify-content-center"
                                    style={{ backgroundColor: '#181818', border: '1px solid #2B2B2B' }}
                                >
                                    <span className="text-secondary small d-flex align-items-center gap-1 mb-1">
                                        <Calendar size={13} className="text-warning" />
                                        Próxima Reunión / Watch Party:
                                    </span>
                                    {room?.next_session_date ? (
                                        <div>
                                            <div className="text-white fw-bold d-flex align-items-center gap-1">
                                                <Clock size={14} className="text-primary" />
                                                {new Date(room.next_session_date).toLocaleString('es-ES', {
                                                    weekday: 'short',
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                            {room.session_notes && (
                                                <div className="text-secondary small mt-1 text-truncate">
                                                    💬 {room.session_notes}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-secondary small fst-italic">
                                            Sin fecha fijada. ¡Haz clic en agendar para definir día y hora!
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ALERTA DE CATCH-UP: ¿Quiénes deben ponerse al día? */}
                    {room?.catchup_members && room.catchup_members.length > 0 ? (
                        <div
                            className="p-3 rounded-3 d-flex flex-column gap-2"
                            style={{
                                backgroundColor: 'rgba(255, 170, 0, 0.08)',
                                border: '1px solid rgba(255, 170, 0, 0.3)',
                            }}
                        >
                            <div className="d-flex align-items-center gap-2 text-warning fw-bold">
                                <AlertTriangle size={18} />
                                <span>¡Faltan por ponerse al día con el Capítulo {groupTarget}!</span>
                            </div>
                            <p className="text-secondary small mb-2">
                                Para que todos puedan disfrutar juntos la próxima sesión sin spoilers, estos amigos necesitan ver los capítulos pendientes:
                            </p>
                            <div className="d-flex flex-wrap gap-2">
                                {room.catchup_members.map((cm) => (
                                    <div
                                        key={cm.id}
                                        className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-2"
                                        style={{ backgroundColor: '#1C160B', border: '1px solid #4A3510' }}
                                    >
                                        <span className="text-white fw-semibold small">{cm.guest_name}</span>
                                        <span className="badge bg-warning text-dark font-mono" style={{ fontSize: '0.72rem' }}>
                                            {cm.episodes_behind} {cm.episodes_behind === 1 ? 'cap pendiente' : 'caps pendientes'}
                                        </span>
                                        <span className="text-secondary small font-mono">
                                            (va en el cap {cm.episodes_watched})
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div
                            className="p-3 rounded-3 d-flex align-items-center gap-2.5 text-success"
                            style={{
                                backgroundColor: 'rgba(25, 135, 84, 0.08)',
                                border: '1px solid rgba(25, 135, 84, 0.25)',
                            }}
                        >
                            <PartyPopper size={20} />
                            <span className="small fw-semibold">
                                ¡Excelente! Todos los miembros de la sala están al día con la meta del grupo (Capítulo {groupTarget}).
                            </span>
                        </div>
                    )}

                    {/* Mi Control Rápido de Progreso Personal */}
                    <div
                        className="p-3 p-md-4 rounded-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3"
                        style={{
                            backgroundColor: '#161616',
                            border: '1px solid #2E2E2E',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div>
                            <span className="text-secondary small text-uppercase fw-semibold mb-1 d-block">
                                Tu Progreso Individual ({userName})
                            </span>
                            <div className="d-flex align-items-center gap-3">
                                <span className="h3 text-white fw-bold mb-0 font-mono">
                                    Capítulo {myWatched}
                                </span>
                                <span
                                    className={`badge px-2.5 py-1 ${
                                        myWatched >= groupTarget
                                            ? myWatched > groupTarget
                                                ? 'bg-info text-dark'
                                                : 'bg-success text-white'
                                            : 'bg-warning text-dark'
                                    }`}
                                >
                                    {myWatched >= groupTarget
                                        ? myWatched > groupTarget
                                            ? '🚀 Adelantado'
                                            : '✅ Al día'
                                        : `⚠️ Atrasado por ${groupTarget - myWatched} caps`}
                                </span>
                            </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => updateMyProgress(Math.max(0, myWatched - 1))}
                                disabled={myWatched <= 0}
                                className="btn btn-sm btn-outline-secondary px-2.5"
                                title="Desmarcar capítulo anterior"
                            >
                                -1
                            </button>
                            <button
                                type="button"
                                onClick={() => updateMyProgress(myWatched + 1)}
                                className="btn btn-primary d-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
                            >
                                <Plus size={16} />
                                <span>¡Ya vi el Capítulo {myWatched + 1}!</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Miembros y Estado de Avance */}
                    <div
                        className="rounded-3 overflow-hidden"
                        style={{ backgroundColor: '#121212', border: '1px solid #242424' }}
                    >
                        <div className="p-3 border-bottom border-dark d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                                <Users size={16} className="text-primary" />
                                <span className="text-white fw-semibold small">
                                    Conteo de Capítulos por Miembro ({room?.members?.length || 0})
                                </span>
                            </div>
                            <span className="text-secondary small font-mono">
                                Meta: Cap {groupTarget}
                            </span>
                        </div>

                        <div className="p-3 d-flex flex-column gap-2.5">
                            {room?.members && room.members.length > 0 ? (
                                room.members.map((member) => {
                                    const percent = Math.min(100, Math.round((member.episodes_watched / totalEpisodes) * 100))
                                    const isMe = member.guest_token === userToken || member.guest_name === userName

                                    return (
                                        <div
                                            key={member.id}
                                            className="p-3 rounded-2 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2"
                                            style={{
                                                backgroundColor: isMe ? '#1A1A1A' : '#151515',
                                                border: isMe ? '1px solid rgba(255,107,0,0.3)' : '1px solid #222',
                                            }}
                                        >
                                            <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 160 }}>
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white font-mono"
                                                    style={{
                                                        width: 34,
                                                        height: 34,
                                                        backgroundColor: isMe ? '#FF6B00' : '#2A2A2A',
                                                        fontSize: '0.85rem',
                                                    }}
                                                >
                                                    {member.guest_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <span className="text-white fw-semibold small">
                                                            {member.guest_name}
                                                        </span>
                                                        {isMe && <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>Tú</span>}
                                                        {member.role === 'owner' && (
                                                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                                                                Anfitrión
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                                                        {member.last_active_at ? 'Activo recientemente' : 'En la sala'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Barra y conteo individual */}
                                            <div className="flex-grow-1 mx-sm-3 d-flex align-items-center gap-2" style={{ maxWidth: 240 }}>
                                                <div className="progress flex-grow-1" style={{ height: 6, backgroundColor: '#262626' }}>
                                                    <div
                                                        className={`progress-bar ${
                                                            member.sync_status === 'atrasado'
                                                                ? 'bg-warning'
                                                                : 'bg-success'
                                                        }`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <span className="text-secondary small font-mono" style={{ fontSize: '0.75rem', width: 65 }}>
                                                    {member.episodes_watched}/{totalEpisodes}
                                                </span>
                                            </div>

                                            {/* Badge de sincronización */}
                                            <div>
                                                {member.sync_status === 'al_dia' && (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                                                        <CheckCircle2 size={12} />
                                                        <span>Al día (Cap {member.episodes_watched})</span>
                                                    </span>
                                                )}
                                                {member.sync_status === 'atrasado' && (
                                                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                                                        <AlertTriangle size={12} />
                                                        <span>Atrasado (-{member.episodes_behind})</span>
                                                    </span>
                                                )}
                                                {member.sync_status === 'adelantado' && (
                                                    <span className="badge bg-info-subtle text-info border border-info-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                                                        <span>🚀 Adelantado (Cap {member.episodes_watched})</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center text-secondary py-3 small">
                                    No hay miembros registrados aún. Comparte el código de la sala con tus amigos.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Chat en Tiempo Real y Reacciones Flotantes */}
                <div className="col-12 col-lg-4">
                    <div
                        className="rounded-3 d-flex flex-column overflow-hidden position-relative"
                        style={{
                            backgroundColor: '#0D0D0D',
                            border: '1px solid #242424',
                            height: '680px',
                        }}
                    >
                        {/* Overlay de Reacciones Flotantes */}
                        <div
                            className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none overflow-hidden z-2"
                            style={{ pointerEvents: 'none' }}
                        >
                            {floatingReactions.map((r) => (
                                <span
                                    key={r.id}
                                    className="position-absolute"
                                    style={{
                                        left: `${r.xPos}%`,
                                        bottom: '60px',
                                        fontSize: '2rem',
                                        animation: 'floatUp 2.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
                                    }}
                                >
                                    {r.emoji}
                                </span>
                            ))}
                        </div>

                        {/* Cabecera del Chat */}
                        <div className="p-3 border-bottom border-dark d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                                <MessageSquare size={16} className="text-primary" />
                                <span className="text-white fw-semibold small">Chat & Coordinación</span>
                            </div>
                            <div className="text-secondary small font-mono d-flex align-items-center gap-1">
                                <Users size={13} />
                                <span>{room?.members_count || 1} online</span>
                            </div>
                        </div>

                        {/* Aviso de Spoilers */}
                        <div
                            className="px-3 py-1.5 d-flex align-items-center gap-2 border-bottom border-dark"
                            style={{ backgroundColor: 'rgba(255,255,255,0.02)', fontSize: '0.72rem' }}
                        >
                            <ShieldAlert size={13} className="text-warning flex-shrink-0" />
                            <span className="text-secondary">
                                Zona libre de spoilers hasta el <strong className="text-white">Capítulo {minWatchedInGroup}</strong> (el más atrasado).
                            </span>
                        </div>

                        {/* Mensajes del Chat */}
                        <div
                            ref={chatScrollRef}
                            className="flex-grow-1 p-3 overflow-y-auto d-flex flex-column gap-2"
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            {chatMessages.length === 0 ? (
                                <div className="text-center my-auto text-secondary small font-mono">
                                    <MessageSquare size={28} className="mx-auto mb-2 opacity-25" />
                                    <span>¡Sé el primero en saludar o coordinar la sesión!</span>
                                </div>
                            ) : (
                                chatMessages.map((msg) => {
                                    const isSelf = msg.sender === userName
                                    const isSys = msg.sender === 'Sistema'

                                    if (isSys) {
                                        return (
                                            <div
                                                key={msg.id}
                                                className="text-center small font-mono py-1 px-2 rounded-1 text-secondary"
                                                style={{ fontSize: '0.72rem', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                                            >
                                                {msg.text}
                                            </div>
                                        )
                                    }

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`d-flex flex-column ${isSelf ? 'align-items-end' : 'align-items-start'}`}
                                        >
                                            <div className="d-flex align-items-baseline gap-1.5 mb-0.5">
                                                <span
                                                    className="fw-semibold text-white font-mono"
                                                    style={{ fontSize: '0.72rem', color: isSelf ? '#FF6B00' : '#A0A0A0' }}
                                                >
                                                    {msg.sender}
                                                </span>
                                                <span className="text-secondary" style={{ fontSize: '0.62rem' }}>
                                                    {new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <div
                                                className="py-1.5 px-3 rounded-2 text-white small"
                                                style={{
                                                    backgroundColor: isSelf ? '#FF6B00' : '#1C1C1C',
                                                    border: isSelf ? 'none' : '1px solid #2B2B2B',
                                                    maxWidth: '85%',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {msg.text}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Barra de Reacciones Rápidas */}
                        <div className="px-3 py-1.5 border-top border-dark d-flex justify-content-between align-items-center">
                            <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                                Reaccionar:
                            </span>
                            <div className="d-flex gap-1">
                                {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => sendReaction(emoji)}
                                        className="btn btn-sm btn-dark p-1 border-0"
                                        style={{ fontSize: '1rem', lineHeight: 1 }}
                                        title={`Enviar reacción ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Formulario de Envío de Chat */}
                        <form onSubmit={handleSendChatSubmit} className="p-2.5 border-top border-dark d-flex gap-2 bg-black">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                maxLength={250}
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim()}
                                className="btn btn-sm btn-primary d-flex align-items-center px-3"
                            >
                                <Send size={14} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Modal para Agendar Próxima Sesión */}
            {showScheduleModal && (
                <div
                    className="modal d-block"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content bg-dark text-white border border-secondary shadow-lg">
                            <div className="modal-header border-secondary">
                                <h5 className="modal-title h6 d-flex align-items-center gap-2">
                                    <Calendar className="text-primary" size={18} />
                                    Agendar Próxima Sesión Grupal
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowScheduleModal(false)}
                                />
                            </div>
                            <form onSubmit={handleSaveSchedule}>
                                <div className="modal-body d-flex flex-column gap-3">
                                    <div>
                                        <label className="form-label small text-secondary">Fecha y Hora de la Sesión</label>
                                        <input
                                            type="datetime-local"
                                            value={scheduleDate}
                                            onChange={(e) => setScheduleDate(e.target.value)}
                                            className="form-control bg-black text-white border-secondary"
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label small text-secondary">
                                            Notas o Acuerdos (ej. Canal de Discord, capítulos a ver)
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={scheduleNotes}
                                            onChange={(e) => setScheduleNotes(e.target.value)}
                                            placeholder="Ej: Nos juntamos en Discord a las 21:00. Veremos capítulos 5 y 6."
                                            className="form-control bg-black text-white border-secondary"
                                            maxLength={200}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer border-secondary">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setShowScheduleModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-sm btn-primary">
                                        Guardar y Notificar a la Sala
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos para animación de emojis flotantes */}
            <style>{`
                @keyframes floatUp {
                    0% {
                        transform: translateY(0) scale(0.6);
                        opacity: 0;
                    }
                    15% {
                        transform: translateY(-20px) scale(1.2);
                        opacity: 1;
                    }
                    80% {
                        opacity: 0.9;
                    }
                    100% {
                        transform: translateY(-380px) scale(0.9);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    )
}
export default WatchPartyRoom
