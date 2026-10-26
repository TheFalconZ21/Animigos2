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
import { Dialogo } from '../mi-lista/piezas'
import '../mi-lista/mi-lista.css'

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
    const caughtUpCount = (room?.members || []).filter((m) => m.episodes_watched >= groupTarget).length
    const behindCount = (room?.catchup_members || []).length

    return (
        <div className="ml-root container-fluid py-4 px-md-5" style={{ minHeight: '88vh' }}>
            {/* Header con estética de "Mi lista" y Ficha tipo Tomo Manga */}
            <header className="ml-header align-items-center">
                <div className="ml-header-info">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span className="ml-eyebrow">COORDINACIÓN GRUPAL · WATCH PARTY</span>
                        
                        {/* Chip de Estado en Vivo */}
                        <span
                            className="ml-chip d-inline-flex align-items-center gap-1.5"
                            style={{
                                borderColor: connectionStatus === 'connected' ? 'rgba(52, 211, 153, 0.4)' : undefined,
                                background: connectionStatus === 'connected' ? 'rgba(52, 211, 153, 0.12)' : undefined,
                                color: connectionStatus === 'connected' ? '#34d399' : '#fbbf24',
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.65rem',
                            }}
                        >
                            <Radio size={12} className={connectionStatus === 'connected' ? 'text-success' : ''} />
                            {connectionStatus === 'connected'
                                ? `EN VIVO ${latencyMs !== null ? `(${latencyMs}ms)` : ''}`
                                : connectionStatus === 'reconnecting'
                                ? 'RECONECTANDO...'
                                : 'DESCONECTADO'}
                        </span>
                    </div>

                    <h1 className="ml-titulo" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
                        {room ? room.name : 'Coordinación con Amigos'}
                    </h1>
                    <p className="ml-sub">
                        {room?.description || 'Organicen qué ver juntos y lleven el conteo de capítulos para que nadie se quede atrás.'}
                    </p>

                    {/* Acciones de Cabecera: Código de Sala y Buscar */}
                    <div className="ml-header-acciones mt-3">
                        {room && (
                            <button
                                type="button"
                                onClick={handleCopyInvite}
                                className="ml-btn ml-btn-sm d-flex align-items-center gap-2"
                                title="Copiar enlace de invitación"
                            >
                                <Share2 size={13} style={{ color: 'var(--ml-acento)' }} />
                                <span>Código: <strong>{room.invite_code}</strong></span>
                                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                <span className="text-secondary small">{copied ? '¡Copiado!' : 'Copiar'}</span>
                            </button>
                        )}

                        <div className="d-flex gap-1.5 align-items-center">
                            <input
                                type="text"
                                placeholder="CÓDIGO DE SALA"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                                className="ml-input text-uppercase font-mono"
                                style={{ width: 140, padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => handleJoinByCode()}
                                disabled={isLoadingRoom || !roomCodeInput.trim()}
                                className="ml-btn ml-btn-sm ml-btn-acento"
                            >
                                Unirme
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={refreshRoom}
                            className="ml-icon-btn"
                            title="Refrescar estado de la sala"
                        >
                            <RefreshCw size={15} />
                        </button>
                    </div>
                </div>

                {/* Ficha de la Sala (Estilo lomo manga de Mi Lista) */}
                <aside className="ml-ficha-lista">
                    <div className="ml-ficha-lista-cuerpo">
                        <div className="ml-ficha-encabezado">
                            <div>
                                <span className="ml-eyebrow">OBJETIVO DEL GRUPO</span>
                                <div className="mt-1">
                                    <strong>Capítulo {groupTarget}</strong> de {totalEpisodes}
                                </div>
                            </div>
                            <div className="ml-ficha-porcentaje">
                                {groupProgressPercent}
                                <small>%</small>
                            </div>
                        </div>

                        {/* Barra de progreso de la sala */}
                        <div className="ml-barra-estados my-2">
                            <span
                                style={{
                                    flexGrow: groupProgressPercent,
                                    background: 'var(--ml-acento)',
                                }}
                                title={`Capítulo ${groupTarget} de ${totalEpisodes}`}
                            />
                            <span
                                style={{
                                    flexGrow: Math.max(0, 100 - groupProgressPercent),
                                    background: 'var(--ml-borde-fuerte)',
                                }}
                            />
                        </div>

                        {/* Leyenda de la Ficha */}
                        <ul className="ml-leyenda">
                            <li>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                                Al día: <strong>{caughtUpCount}</strong>
                            </li>
                            <li>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
                                Atrasados: <strong>{behindCount}</strong>
                            </li>
                            <li>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ml-acento)' }} />
                                Total: <strong>{room?.members_count || 1}</strong>
                            </li>
                        </ul>

                        <div className="ml-ficha-pie">
                            <span className="text-secondary small">
                                {behindCount > 0
                                    ? `⚠️ Hay ${behindCount} ${behindCount === 1 ? 'persona que debe' : 'personas que deben'} ponerse al día.`
                                    : '✨ ¡Todo el grupo va exactamente al día!'}
                            </span>
                        </div>
                    </div>

                    <div className="ml-lomo">SALA</div>
                </aside>
            </header>

            {errorMessage && (
                <div
                    className="p-3 mb-4 d-flex justify-content-between align-items-center"
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--ml-radio)',
                        color: '#f87171',
                    }}
                >
                    <span>{errorMessage}</span>
                    <button
                        type="button"
                        className="ml-icon-btn ml-peligro"
                        onClick={() => setErrorMessage(null)}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Layout Principal: 8 columnas contenido y 4 columnas Chat */}
            <div className="row g-4 mt-1">
                {/* Columna Izquierda: Coordinación, Seguimiento de Capítulos y Anime */}
                <div className="col-12 col-lg-8 d-flex flex-column gap-4">
                    {/* Tarjeta del Anime Activo del Grupo */}
                    {room?.selected_anime ? (
                        <div
                            className="p-3 p-md-4 rounded-3 d-flex flex-column flex-sm-row gap-4 align-items-center align-items-sm-start"
                            style={{
                                background: 'var(--ml-superficie)',
                                border: '1px solid var(--ml-acento-borde)',
                                borderRadius: '18px',
                            }}
                        >
                            <img
                                src={room.selected_anime.image_url}
                                alt={room.selected_anime.title}
                                className="rounded-3 shadow-sm object-fit-cover"
                                style={{ width: 110, height: 160, flexShrink: 0, border: '1px solid var(--ml-borde)' }}
                            />
                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                    <span
                                        className="ml-chip"
                                        style={{
                                            background: 'var(--ml-acento-suave)',
                                            color: 'var(--ml-acento)',
                                            borderColor: 'var(--ml-acento-borde)',
                                            fontSize: '0.72rem',
                                            padding: '0.15rem 0.6rem',
                                        }}
                                    >
                                        Anime Activo del Grupo
                                    </span>
                                    {room.selected_anime.score && (
                                        <span className="small fw-semibold" style={{ color: '#fbbf24' }}>
                                            ★ {room.selected_anime.score} / 10
                                        </span>
                                    )}
                                    <span className="small" style={{ color: 'var(--ml-texto-3)' }}>
                                        • {totalEpisodes} Capítulos totales
                                    </span>
                                </div>

                                <h2 className="h4 fw-bold mb-2 text-white">{room.selected_anime.title}</h2>
                                <p className="small mb-3" style={{ color: 'var(--ml-texto-2)', lineHeight: 1.5 }}>
                                    {room.selected_anime.synopsis || 'Disfruten de esta serie juntos. Cada miembro puede marcar su avance para coordinar la siguiente sesión.'}
                                </p>

                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    <span className="small fw-semibold" style={{ color: 'var(--ml-texto)' }}>
                                        Avance grupal:
                                    </span>
                                    <div
                                        className="flex-grow-1 rounded-pill overflow-hidden"
                                        style={{ height: 8, maxWidth: 220, background: 'var(--ml-superficie-2)' }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${groupProgressPercent}%`,
                                                background: 'var(--ml-acento)',
                                                borderRadius: 999,
                                                transition: 'width 0.4s var(--ml-ease)',
                                            }}
                                        />
                                    </div>
                                    <span className="small fw-mono fw-bold" style={{ color: 'var(--ml-acento)' }}>
                                        Cap {groupTarget} de {totalEpisodes} ({groupProgressPercent}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Si no hay anime seleccionado todavía: Fase de Nominación & Votación */
                        <div
                            className="p-4 text-center"
                            style={{
                                background: 'var(--ml-superficie)',
                                border: '1px dashed var(--ml-borde-fuerte)',
                                borderRadius: '18px',
                            }}
                        >
                            <Tv size={36} style={{ color: 'var(--ml-acento)', opacity: 0.8 }} className="mb-2" />
                            <h3 className="h5 fw-bold mb-1 text-white">Aún no han seleccionado un anime para ver</h3>
                            <p className="small mb-3" style={{ color: 'var(--ml-texto-2)' }}>
                                Voten por los candidatos postulados para calcular el consenso grupal y decidir qué serie comenzarán a ver.
                            </p>
                            {room?.candidates && room.candidates.length > 0 ? (
                                <div className="row g-3 text-start mt-2">
                                    {room.candidates.map((cand) => (
                                        <div key={cand.id} className="col-12 col-md-6">
                                            <div
                                                className="p-3 d-flex gap-3 align-items-center"
                                                style={{
                                                    background: 'var(--ml-superficie-2)',
                                                    border: '1px solid var(--ml-borde)',
                                                    borderRadius: '12px',
                                                }}
                                            >
                                                <img
                                                    src={cand.image_url}
                                                    alt={cand.title}
                                                    className="object-fit-cover rounded-2"
                                                    style={{ width: 48, height: 68 }}
                                                />
                                                <div className="flex-grow-1 overflow-hidden">
                                                    <h4 className="small fw-bold mb-1 text-truncate text-white">{cand.title}</h4>
                                                    <div className="small mb-2" style={{ color: 'var(--ml-texto-3)' }}>
                                                        Interés: <strong style={{ color: '#fbbf24' }}>{cand.avg_interest}/10</strong> ({cand.votes_count} votos)
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectWinnerCandidate(cand.anime_id)}
                                                        className="ml-btn ml-btn-sm ml-btn-acento"
                                                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                                    >
                                                        Elegir como Ganador
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="ml-vacio py-2">
                                    <div className="ml-kaomoji">(・_・;)</div>
                                    No hay candidatos nominados todavía en la sala.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Meta Grupal y Próxima Sesión */}
                    <div
                        className="p-3 p-md-4 d-flex flex-column gap-3"
                        style={{
                            background: 'var(--ml-superficie)',
                            border: '1px solid var(--ml-borde)',
                            borderRadius: '18px',
                        }}
                    >
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div className="d-flex align-items-center gap-2">
                                <Sparkles size={17} style={{ color: 'var(--ml-acento)' }} />
                                <span className="fw-bold text-white small">Meta del Grupo & Sesión de Visualización</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                            >
                                <CalendarPlus size={14} />
                                <span>Agendar Próxima Sesión</span>
                            </button>
                        </div>

                        <div className="row g-3 align-items-center">
                            {/* Meta del Grupo Actual */}
                            <div className="col-12 col-md-6">
                                <div
                                    className="p-3 d-flex justify-content-between align-items-center"
                                    style={{
                                        background: 'var(--ml-superficie-2)',
                                        border: '1px solid var(--ml-borde)',
                                        borderRadius: '12px',
                                    }}
                                >
                                    <div>
                                        <span className="ml-label mb-1">Capítulo Objetivo del Grupo</span>
                                        <div className="d-flex align-items-baseline gap-2">
                                            <span className="h3 fw-bold mb-0 text-white font-mono">Capítulo {groupTarget}</span>
                                            <span className="small font-mono" style={{ color: 'var(--ml-texto-3)' }}>/ {totalEpisodes}</span>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setGroupTarget(Math.max(1, groupTarget - 1))}
                                            disabled={groupTarget <= 1}
                                            className="ml-btn ml-btn-sm px-2.5"
                                            title="Retroceder meta"
                                        >
                                            -1
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGroupTarget(groupTarget + 1)}
                                            className="ml-btn ml-btn-sm ml-btn-acento px-3 fw-bold"
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
                                    className="p-3 h-100 d-flex flex-column justify-content-center"
                                    style={{
                                        background: 'var(--ml-superficie-2)',
                                        border: '1px solid var(--ml-borde)',
                                        borderRadius: '12px',
                                    }}
                                >
                                    <span className="ml-label mb-1 d-flex align-items-center gap-1">
                                        <Calendar size={13} style={{ color: '#fbbf24' }} />
                                        Próxima Reunión / Watch Party:
                                    </span>
                                    {room?.next_session_date ? (
                                        <div>
                                            <div className="fw-bold d-flex align-items-center gap-1 text-white">
                                                <Clock size={14} style={{ color: 'var(--ml-acento)' }} />
                                                {new Date(room.next_session_date).toLocaleString('es-ES', {
                                                    weekday: 'short',
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                            {room.session_notes && (
                                                <div className="small mt-1 text-truncate" style={{ color: 'var(--ml-texto-2)' }}>
                                                    💬 {room.session_notes}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="small fst-italic" style={{ color: 'var(--ml-texto-3)' }}>
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
                                background: 'rgba(251, 191, 36, 0.08)',
                                border: '1px solid rgba(251, 191, 36, 0.28)',
                                borderRadius: '16px',
                            }}
                        >
                            <div className="d-flex align-items-center gap-2 fw-bold" style={{ color: '#fbbf24' }}>
                                <AlertTriangle size={18} />
                                <span>¡Faltan por ponerse al día con el Capítulo {groupTarget}!</span>
                            </div>
                            <p className="small mb-2" style={{ color: 'var(--ml-texto-2)' }}>
                                Para que todos disfruten juntos la próxima sesión sin spoilers, estos amigos necesitan ver los capítulos pendientes:
                            </p>
                            <div className="d-flex flex-wrap gap-2">
                                {room.catchup_members.map((cm) => (
                                    <div
                                        key={cm.id}
                                        className="ml-chip d-flex align-items-center gap-2"
                                        style={{
                                            background: '#19150f',
                                            borderColor: 'rgba(251, 191, 36, 0.35)',
                                            color: '#fef08a',
                                            padding: '0.4rem 0.8rem',
                                        }}
                                    >
                                        <strong className="text-white">{cm.guest_name}</strong>
                                        <span
                                            style={{
                                                background: 'rgba(251, 191, 36, 0.2)',
                                                color: '#fbbf24',
                                                borderRadius: 6,
                                                padding: '0.1rem 0.4rem',
                                                fontSize: '0.72rem',
                                                fontFamily: 'monospace',
                                            }}
                                        >
                                            {cm.episodes_behind} {cm.episodes_behind === 1 ? 'cap pendiente' : 'caps pendientes'}
                                        </span>
                                        <span className="small text-secondary font-mono">
                                            (va en el cap {cm.episodes_watched})
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div
                            className="p-3 d-flex align-items-center gap-2.5"
                            style={{
                                background: 'rgba(52, 211, 153, 0.08)',
                                border: '1px solid rgba(52, 211, 153, 0.25)',
                                borderRadius: '16px',
                                color: '#34d399',
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
                        className="p-3 p-md-4 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3"
                        style={{
                            background: 'var(--ml-superficie-2)',
                            border: '1px solid var(--ml-borde-fuerte)',
                            borderRadius: '18px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div>
                            <span className="ml-label mb-1">Tu Progreso Individual ({userName})</span>
                            <div className="d-flex align-items-center gap-3">
                                <span className="h3 fw-bold mb-0 text-white font-mono">
                                    Capítulo {myWatched}
                                </span>
                                <span
                                    className="ml-chip"
                                    style={{
                                        background:
                                            myWatched >= groupTarget
                                                ? myWatched > groupTarget
                                                    ? 'rgba(167, 139, 250, 0.15)'
                                                    : 'rgba(52, 211, 153, 0.15)'
                                                : 'rgba(251, 191, 36, 0.15)',
                                        borderColor:
                                            myWatched >= groupTarget
                                                ? myWatched > groupTarget
                                                    ? 'rgba(167, 139, 250, 0.4)'
                                                    : 'rgba(52, 211, 153, 0.4)'
                                                : 'rgba(251, 191, 36, 0.4)',
                                        color:
                                            myWatched >= groupTarget
                                                ? myWatched > groupTarget
                                                    ? '#a78bfa'
                                                    : '#34d399'
                                                : '#fbbf24',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                    }}
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
                                className="ml-btn ml-btn-sm px-3"
                                title="Desmarcar capítulo anterior"
                            >
                                -1
                            </button>
                            <button
                                type="button"
                                onClick={() => updateMyProgress(myWatched + 1)}
                                className="ml-btn ml-btn-acento d-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
                            >
                                <Plus size={16} />
                                <span>¡Ya vi el Capítulo {myWatched + 1}!</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Miembros (Conteo por Miembro con estilo de Mi Lista) */}
                    <div
                        className="rounded-3 overflow-hidden"
                        style={{
                            background: 'var(--ml-superficie)',
                            border: '1px solid var(--ml-borde)',
                            borderRadius: '18px',
                        }}
                    >
                        <div
                            className="p-3 d-flex justify-content-between align-items-center"
                            style={{ borderBottom: '1px solid var(--ml-borde)' }}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <Users size={16} style={{ color: 'var(--ml-acento)' }} />
                                <span className="fw-semibold small text-white">
                                    Conteo de Capítulos por Miembro ({room?.members?.length || 0})
                                </span>
                            </div>
                            <span className="small font-mono" style={{ color: 'var(--ml-texto-3)' }}>
                                Meta grupal: Cap {groupTarget}
                            </span>
                        </div>

                        <div className="p-3 d-flex flex-column gap-2">
                            {room?.members && room.members.length > 0 ? (
                                room.members.map((member, index) => {
                                    const percent = Math.min(100, Math.round((member.episodes_watched / totalEpisodes) * 100))
                                    const isMe = member.guest_token === userToken || member.guest_name === userName

                                    return (
                                        <div
                                            key={member.id}
                                            className="p-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2"
                                            style={{
                                                background: isMe ? 'var(--ml-superficie-2)' : '#0d0d12',
                                                border: isMe ? '1px solid var(--ml-acento-borde)' : '1px solid var(--ml-borde)',
                                                borderRadius: '12px',
                                            }}
                                        >
                                            <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 160 }}>
                                                <span className="ml-posicion">
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white font-mono"
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        backgroundColor: isMe ? 'var(--ml-acento)' : '#26262e',
                                                        color: isMe ? '#0b0b0f' : '#fff',
                                                        fontSize: '0.8rem',
                                                    }}
                                                >
                                                    {member.guest_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <span className="fw-semibold small text-white">
                                                            {member.guest_name}
                                                        </span>
                                                        {isMe && (
                                                            <span
                                                                className="badge"
                                                                style={{
                                                                    fontSize: '0.65rem',
                                                                    background: 'var(--ml-acento-suave)',
                                                                    color: 'var(--ml-acento)',
                                                                }}
                                                            >
                                                                Tú
                                                            </span>
                                                        )}
                                                        {member.role === 'owner' && (
                                                            <span
                                                                className="badge"
                                                                style={{
                                                                    fontSize: '0.65rem',
                                                                    background: 'rgba(251, 191, 36, 0.2)',
                                                                    color: '#fbbf24',
                                                                }}
                                                            >
                                                                Anfitrión
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--ml-texto-3)' }}>
                                                        {member.last_active_at ? 'Activo recientemente' : 'En la sala'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Barra y conteo individual */}
                                            <div className="flex-grow-1 mx-sm-3 d-flex align-items-center gap-2" style={{ maxWidth: 240 }}>
                                                <div
                                                    className="rounded-pill overflow-hidden flex-grow-1"
                                                    style={{ height: 6, background: '#1c1c24' }}
                                                >
                                                    <div
                                                        style={{
                                                            width: `${percent}%`,
                                                            height: '100%',
                                                            background:
                                                                member.sync_status === 'atrasado'
                                                                    ? '#fbbf24'
                                                                    : 'var(--ml-acento)',
                                                            borderRadius: 999,
                                                        }}
                                                    />
                                                </div>
                                                <span className="small font-mono" style={{ fontSize: '0.75rem', width: 65, color: 'var(--ml-texto-3)' }}>
                                                    {member.episodes_watched}/{totalEpisodes}
                                                </span>
                                            </div>

                                            {/* Badge de sincronización */}
                                            <div>
                                                {member.sync_status === 'al_dia' && (
                                                    <span
                                                        className="ml-chip d-inline-flex align-items-center gap-1"
                                                        style={{
                                                            background: 'rgba(52, 211, 153, 0.1)',
                                                            borderColor: 'rgba(52, 211, 153, 0.3)',
                                                            color: '#34d399',
                                                            fontSize: '0.75rem',
                                                            padding: '0.2rem 0.55rem',
                                                        }}
                                                    >
                                                        <CheckCircle2 size={12} />
                                                        <span>Al día (Cap {member.episodes_watched})</span>
                                                    </span>
                                                )}
                                                {member.sync_status === 'atrasado' && (
                                                    <span
                                                        className="ml-chip d-inline-flex align-items-center gap-1"
                                                        style={{
                                                            background: 'rgba(251, 191, 36, 0.1)',
                                                            borderColor: 'rgba(251, 191, 36, 0.3)',
                                                            color: '#fbbf24',
                                                            fontSize: '0.75rem',
                                                            padding: '0.2rem 0.55rem',
                                                        }}
                                                    >
                                                        <AlertTriangle size={12} />
                                                        <span>Atrasado (-{member.episodes_behind})</span>
                                                    </span>
                                                )}
                                                {member.sync_status === 'adelantado' && (
                                                    <span
                                                        className="ml-chip d-inline-flex align-items-center gap-1"
                                                        style={{
                                                            background: 'rgba(167, 139, 250, 0.1)',
                                                            borderColor: 'rgba(167, 139, 250, 0.3)',
                                                            color: '#a78bfa',
                                                            fontSize: '0.75rem',
                                                            padding: '0.2rem 0.55rem',
                                                        }}
                                                    >
                                                        <span>🚀 Adelantado (Cap {member.episodes_watched})</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="ml-vacio py-3">
                                    <div className="ml-kaomoji">(・_・;)</div>
                                    No hay miembros registrados aún. Comparte el código de la sala con tus amigos.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Chat en Tiempo Real y Reacciones Flotantes */}
                <div className="col-12 col-lg-4">
                    <div
                        className="d-flex flex-column overflow-hidden position-relative"
                        style={{
                            background: 'var(--ml-superficie)',
                            border: '1px solid var(--ml-borde)',
                            borderRadius: '18px',
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
                        <div
                            className="p-3 d-flex justify-content-between align-items-center"
                            style={{ borderBottom: '1px solid var(--ml-borde)' }}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <MessageSquare size={16} style={{ color: 'var(--ml-acento)' }} />
                                <span className="fw-semibold small text-white">Chat & Coordinación</span>
                            </div>
                            <div className="small font-mono d-flex align-items-center gap-1" style={{ color: 'var(--ml-texto-3)' }}>
                                <Users size={13} />
                                <span>{room?.members_count || 1} online</span>
                            </div>
                        </div>

                        {/* Aviso de Spoilers */}
                        <div
                            className="px-3 py-1.5 d-flex align-items-center gap-2"
                            style={{
                                background: 'var(--ml-superficie-2)',
                                borderBottom: '1px solid var(--ml-borde)',
                                fontSize: '0.72rem',
                            }}
                        >
                            <ShieldAlert size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                            <span style={{ color: 'var(--ml-texto-2)' }}>
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
                                <div className="text-center my-auto small font-mono" style={{ color: 'var(--ml-texto-3)' }}>
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
                                                className="text-center small font-mono py-1 px-2 rounded-2"
                                                style={{
                                                    fontSize: '0.72rem',
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    color: 'var(--ml-texto-3)',
                                                }}
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
                                                    className="fw-semibold font-mono"
                                                    style={{
                                                        fontSize: '0.72rem',
                                                        color: isSelf ? 'var(--ml-acento)' : 'var(--ml-texto-2)',
                                                    }}
                                                >
                                                    {msg.sender}
                                                </span>
                                                <span style={{ fontSize: '0.62rem', color: 'var(--ml-texto-3)' }}>
                                                    {new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <div
                                                className="py-1.5 px-3 rounded-3 small"
                                                style={{
                                                    backgroundColor: isSelf ? 'var(--ml-acento)' : 'var(--ml-superficie-2)',
                                                    color: isSelf ? '#0b0b0f' : 'var(--ml-texto)',
                                                    border: isSelf ? 'none' : '1px solid var(--ml-borde)',
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
                        <div
                            className="px-3 py-1.5 d-flex justify-content-between align-items-center"
                            style={{ borderTop: '1px solid var(--ml-borde)', background: 'var(--ml-superficie-2)' }}
                        >
                            <span style={{ fontSize: '0.7rem', color: 'var(--ml-texto-3)' }}>
                                Reaccionar:
                            </span>
                            <div className="d-flex gap-1">
                                {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => sendReaction(emoji)}
                                        className="ml-icon-btn"
                                        style={{ width: 28, height: 28, fontSize: '0.95rem' }}
                                        title={`Enviar reacción ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Formulario de Envío de Chat */}
                        <form
                            onSubmit={handleSendChatSubmit}
                            className="p-2.5 d-flex gap-2"
                            style={{ borderTop: '1px solid var(--ml-borde)', background: 'var(--ml-superficie)' }}
                        >
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="ml-input flex-grow-1"
                                maxLength={250}
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim()}
                                className="ml-btn ml-btn-acento d-flex align-items-center px-3"
                            >
                                <Send size={14} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Modal para Agendar Próxima Sesión con Diálogo de Mi Lista */}
            <Dialogo
                abierto={showScheduleModal}
                onCerrar={() => setShowScheduleModal(false)}
                etiqueta="Agendar Próxima Sesión"
                ancho={500}
            >
                <form onSubmit={handleSaveSchedule}>
                    <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                        <div>
                            <span className="ml-eyebrow">SESIÓN DE VISUALIZACIÓN</span>
                            <h2 className="h4 text-white mt-1 mb-1">Agendar Próxima Reunión</h2>
                            <p className="small" style={{ color: 'var(--ml-texto-2)' }}>
                                Acuerden fecha, hora y plataforma para ver juntos los siguientes episodios.
                            </p>
                        </div>

                        <div>
                            <label className="ml-label">Fecha y Hora de la Sesión</label>
                            <input
                                type="datetime-local"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="ml-input w-100"
                            />
                        </div>

                        <div>
                            <label className="ml-label">
                                Notas o Acuerdos (ej. Canal de Discord, capítulos a ver)
                            </label>
                            <textarea
                                rows={3}
                                value={scheduleNotes}
                                onChange={(e) => setScheduleNotes(e.target.value)}
                                placeholder="Ej: Nos juntamos en Discord a las 21:00. Veremos capítulos 5 y 6."
                                className="ml-input w-100"
                                maxLength={200}
                            />
                        </div>
                    </div>

                    <footer className="ml-dialog-pie">
                        <button
                            type="button"
                            className="ml-btn ml-btn-fantasma"
                            onClick={() => setShowScheduleModal(false)}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="ml-btn ml-btn-acento">
                            Guardar y Notificar a la Sala
                        </button>
                    </footer>
                </form>
            </Dialogo>

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
