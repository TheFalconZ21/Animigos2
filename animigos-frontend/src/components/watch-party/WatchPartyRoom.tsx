/**
 * Sala de Votación y Watch Party en Tiempo Real (Pilar 3 de AGENTS.md).
 * Orquestado por useWatchParty (WebSocket autoritativo, Daphne y Django Channels).
 */

import { useState, useEffect, useRef } from 'react'
import {
    Play,
    Pause,
    RotateCcw,
    Users,
    Send,
    Smile,
    Check,
    Sparkles,
    Tv,
    Copy,
    MessageSquare,
} from 'lucide-react'
import { useWatchParty } from '../../hooks/useWatchParty'
import { useAuth } from '../../context/AuthContext'

const REACTION_EMOJIS = ['❤️', '🔥', '😱', '🍿', '👏', '✨', '😭', '🎉']

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function WatchPartyRoom() {
    const { user } = useAuth()
    const [activeRoomId, setActiveRoomId] = useState<string>('')
    const [availableRooms, setAvailableRooms] = useState<any[]>([])
    const [joinCodeInput, setJoinCodeInput] = useState<string>('')
    const [newRoomName, setNewRoomName] = useState<string>('')
    const [copied, setCopied] = useState<boolean>(false)
    const [chatInput, setChatInput] = useState<string>('')
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Cargar lista de salas disponibles desde el backend REST
    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/groups/', { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                const results = Array.isArray(data) ? data : data.results || []
                setAvailableRooms(results)
                if (results.length > 0 && !activeRoomId) {
                    setActiveRoomId(results[0].id)
                }
            })
            .catch((err) => console.error('Error al cargar salas:', err))
    }, [])

    const {
        room,
        playback,
        displayTime,
        connectionStatus,
        latencyMs,
        chatMessages,
        floatingReactions,
        play,
        pause,
        seek,
        changeEpisode,
        sendChat,
        sendReaction,
        refreshRoom,
    } = useWatchParty({
        roomId: activeRoomId,
        userName: user?.display_name || user?.username || 'Invitado',
        userToken: user?.id || 'guest-token',
        enabled: Boolean(activeRoomId),
    })

    // Scroll automático del chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    const handleCopyInvite = () => {
        if (!room) return
        navigator.clipboard.writeText(room.invite_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoomName.trim()) return

        try {
            const res = await fetch('http://127.0.0.1:8000/api/groups/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: newRoomName.trim(),
                    creator_name: user?.display_name || user?.username || 'Anfitrión',
                }),
            })
            if (res.ok) {
                const nuevaSala = await res.json()
                setAvailableRooms((prev) => [nuevaSala, ...prev])
                setActiveRoomId(nuevaSala.id)
                setNewRoomName('')
            }
        } catch (err) {
            console.error('Error al crear sala:', err)
        }
    }

    const handleJoinByCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!joinCodeInput.trim()) return

        try {
            const res = await fetch(
                `http://127.0.0.1:8000/api/groups/by_code/?code=${encodeURIComponent(joinCodeInput.trim())}`,
                { credentials: 'include' }
            )
            if (res.ok) {
                const sala = await res.json()
                setActiveRoomId(sala.id)
                setJoinCodeInput('')
            } else {
                alert('No se encontró una sala con ese código.')
            }
        } catch (err) {
            console.error('Error al unirse por código:', err)
        }
    }

    const handleVoteCandidate = async (candidateId: string, score: number) => {
        if (!activeRoomId) return
        try {
            await fetch(`http://127.0.0.1:8000/api/groups/${activeRoomId}/vote/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    candidate_id: candidateId,
                    voter_name: user?.display_name || user?.username || 'Invitado',
                    interest_score: score,
                }),
            })
            refreshRoom()
        } catch (err) {
            console.error('Error al emitir voto:', err)
        }
    }

    const animeActual = room?.selected_anime || {
        mal_id: 1,
        title: 'Cowboy Bebop (Sesión Sincronizada)',
        image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg',
        episodes: 26,
    }

    const totalDuracion = 1440 // 24 minutos estándar por episodio en segundos
    const progresoPorcentaje = Math.min(100, (displayTime / totalDuracion) * 100)

    return (
        <div className="container-fluid px-3 px-lg-5 py-4" style={{ minHeight: '85vh' }}>
            {/* Cabecera Superior: Selector de Sala & Estado en Tiempo Real */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 pb-3 mb-4 border-bottom border-dark">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span
                            className="badge d-inline-flex align-items-center gap-1.5 px-2.5 py-1 text-white font-mono"
                            style={{
                                backgroundColor:
                                    connectionStatus === 'connected'
                                        ? 'rgba(16, 185, 129, 0.2)'
                                        : connectionStatus === 'reconnecting'
                                        ? 'rgba(245, 158, 11, 0.2)'
                                        : 'rgba(239, 68, 68, 0.2)',
                                border:
                                    connectionStatus === 'connected'
                                        ? '1px solid #10B981'
                                        : connectionStatus === 'reconnecting'
                                        ? '1px solid #F59E0B'
                                        : '1px solid #EF4444',
                                fontSize: '0.72rem',
                            }}
                        >
                            <span
                                style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    backgroundColor:
                                        connectionStatus === 'connected'
                                            ? '#10B981'
                                            : connectionStatus === 'reconnecting'
                                            ? '#F59E0B'
                                            : '#EF4444',
                                    animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none',
                                }}
                            />
                            {connectionStatus === 'connected'
                                ? `EN VIVO ${latencyMs !== null ? `(${latencyMs}ms)` : ''}`
                                : connectionStatus === 'reconnecting'
                                ? 'RECONECTANDO...'
                                : 'DESCONECTADO'}
                        </span>
                        <span className="text-secondary small font-mono">
                            Daphne WebSocket / Channels v4
                        </span>
                    </div>
                    <h2 className="text-white fw-bold mb-0" style={{ fontSize: '1.5rem' }}>
                        {room?.name || 'Sala de Watch Party'}
                    </h2>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Selector de salas activas */}
                    {availableRooms.length > 0 && (
                        <select
                            className="form-select form-select-sm bg-dark text-white border-secondary font-mono"
                            style={{ width: 'auto', minWidth: 200, fontSize: '0.8rem' }}
                            value={activeRoomId}
                            onChange={(e) => setActiveRoomId(e.target.value)}
                            aria-label="Seleccionar sala activa"
                        >
                            {availableRooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name} [{r.invite_code}]
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Copiar código de sala */}
                    {room && (
                        <button
                            type="button"
                            onClick={handleCopyInvite}
                            className="btn btn-outline-light btn-sm d-flex align-items-center gap-1.5 font-mono"
                            style={{ fontSize: '0.8rem' }}
                            title="Copiar código de invitación"
                        >
                            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                            <span>Código: {room.invite_code}</span>
                        </button>
                    )}

                    {/* Formulario rápido para unirse con código */}
                    <form onSubmit={handleJoinByCode} className="d-flex align-items-center gap-1">
                        <input
                            type="text"
                            placeholder="CÓDIGO"
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                            className="form-control form-control-sm bg-dark text-white border-secondary font-mono text-center"
                            style={{ width: 90, fontSize: '0.8rem' }}
                            maxLength={8}
                        />
                        <button type="submit" className="btn btn-primary btn-sm px-2.5">
                            Unirse
                        </button>
                    </form>
                </div>
            </div>

            {/* Layout Principal: Reproductor Sincronizado + Chat & Votación */}
            <div className="row g-4">
                {/* Columna Izquierda: Reproductor de Watch Party Autoritativo */}
                <div className="col-12 col-lg-8">
                    <div
                        className="position-relative rounded-3 overflow-hidden shadow-lg border border-dark"
                        style={{
                            backgroundColor: '#050505',
                            aspectRatio: '16/9',
                            maxHeight: '65vh',
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
                                    className="position-absolute fs-1"
                                    style={{
                                        left: `${r.xPos}%`,
                                        bottom: '20px',
                                        animation: 'floatUp 2.8s ease-out forwards',
                                        userSelect: 'none',
                                    }}
                                >
                                    {r.emoji}
                                </span>
                            ))}
                        </div>

                        {/* Lienzo / Pantalla Simulada del Anime */}
                        <div
                            className="w-100 h-100 d-flex flex-column justify-content-center align-items-center position-relative"
                            style={{
                                backgroundImage: `radial-gradient(circle at center, rgba(14, 165, 233, 0.12), rgba(0, 0, 0, 0.88)), url(${animeActual.image_url})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                            }}
                        >
                            <div className="text-center p-4 z-1" style={{ maxWidth: 560 }}>
                                <div className="badge bg-primary bg-opacity-75 font-mono mb-2 px-3 py-1 text-uppercase">
                                    Episodio {playback.episode} · {playback.is_playing ? 'Reproduciendo en Grupo' : 'En Pausa'}
                                </div>
                                <h3 className="text-white fw-bold mb-2 text-shadow">{animeActual.title}</h3>
                                <p className="text-white-50 small mb-0 font-mono">
                                    Control Server-Authoritative · Anfitrión: {playback.host_name}
                                </p>
                            </div>

                            {/* Botón flotante central de Play/Pause */}
                            <button
                                type="button"
                                onClick={() => (playback.is_playing ? pause() : play())}
                                className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center shadow-lg border-0 z-1"
                                style={{
                                    width: 68,
                                    height: 68,
                                    backgroundColor: playback.is_playing ? '#e8508f' : '#38bdf8',
                                    transition: 'transform 0.15s ease',
                                }}
                            >
                                {playback.is_playing ? <Pause size={30} fill="#FFFFFF" /> : <Play size={30} fill="#FFFFFF" className="ms-1" />}
                            </button>
                        </div>

                        {/* Barra Inferior de Control de Reproducción */}
                        <div
                            className="position-absolute bottom-0 start-0 w-100 p-3 z-3"
                            style={{
                                background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                            }}
                        >
                            {/* Barra de progreso interactiva (Seek autoritativo) */}
                            <div
                                className="progress mb-2 cursor-pointer position-relative"
                                style={{ height: 6, backgroundColor: 'rgba(255, 255, 255, 0.2)', cursor: 'pointer' }}
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const clickX = e.clientX - rect.left
                                    const ratio = clickX / rect.width
                                    seek(ratio * totalDuracion)
                                }}
                            >
                                <div
                                    className="progress-bar"
                                    style={{
                                        width: `${progresoPorcentaje}%`,
                                        backgroundColor: '#38bdf8',
                                        transition: 'width 0.2s linear',
                                    }}
                                />
                            </div>

                            <div className="d-flex justify-content-between align-items-center text-white small">
                                <div className="d-flex align-items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => (playback.is_playing ? pause() : play())}
                                        className="btn btn-link text-white p-0"
                                    >
                                        {playback.is_playing ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => seek(0)}
                                        className="btn btn-link text-secondary p-0"
                                        title="Reiniciar desde 00:00"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <span className="font-mono" style={{ fontSize: '0.78rem' }}>
                                        {formatTime(displayTime)} / {formatTime(totalDuracion)}
                                    </span>
                                </div>

                                <div className="d-flex align-items-center gap-3">
                                    <div className="d-flex align-items-center gap-1.5">
                                        <span className="text-secondary small font-mono">Episodio:</span>
                                        <select
                                            className="form-select form-select-sm bg-dark text-white border-0 py-0 ps-2 pe-4 font-mono"
                                            style={{ fontSize: '0.75rem', width: 'auto' }}
                                            value={playback.episode}
                                            onChange={(e) => changeEpisode(Number(e.target.value))}
                                            aria-label="Seleccionar episodio"
                                        >
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <option key={i + 1} value={i + 1}>
                                                    Ep. {i + 1}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className="admin-badge admin-badge-neutral font-mono d-none d-sm-inline">
                                        {playback.speed}x Velocidad
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Botones de Reacción Rápida (Emojis en Vivo) */}
                    <div className="d-flex align-items-center justify-content-between gap-2 mt-3 p-2.5 rounded-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <span className="text-secondary small d-flex align-items-center gap-1.5 font-mono">
                            <Smile size={16} /> Reacciones en vivo:
                        </span>
                        <div className="d-flex gap-1.5">
                            {REACTION_EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => sendReaction(emoji)}
                                    className="btn btn-sm btn-dark border-0 p-1.5 fs-5 hover-lift"
                                    style={{ backgroundColor: 'transparent' }}
                                    title={`Reaccionar con ${emoji}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sección de Votación y Candidatos en Vivo */}
                    <div className="mt-4 p-3.5 rounded-3" style={{ backgroundColor: '#0D0D0D', border: '1px solid #1F1F1F' }}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                                    <Sparkles size={18} className="text-warning" /> Votación Grupal y Quórum en Vivo
                                </h5>
                                <p className="text-secondary small mb-0">
                                    Los votos actualizan el consenso y felicidad grupal en tiempo real vía WebSockets
                                </p>
                            </div>
                            <span className="badge bg-secondary font-mono">
                                {room?.candidates?.length || 0} postulados
                            </span>
                        </div>

                        {room?.candidates && room.candidates.length > 0 ? (
                            <div className="row g-3">
                                {room.candidates.map((c) => (
                                    <div key={c.id} className="col-12 col-md-6">
                                        <div
                                            className="p-3 rounded-2 h-100 d-flex gap-3 align-items-center"
                                            style={{ backgroundColor: '#141414', border: '1px solid #262626' }}
                                        >
                                            <img
                                                src={c.image_url}
                                                alt={c.title}
                                                className="rounded-1 object-fit-cover shadow-sm"
                                                style={{ width: 56, height: 78 }}
                                            />
                                            <div className="flex-grow-1 min-w-0">
                                                <h6 className="text-white text-truncate fw-semibold mb-1" style={{ fontSize: '0.9rem' }}>
                                                    {c.title}
                                                </h6>
                                                <div className="d-flex align-items-center gap-2 text-secondary small font-mono mb-2">
                                                    <span>Nota: ⭐ {c.avg_interest}/10</span>
                                                    <span>&middot;</span>
                                                    <span>{c.votes_count} votos</span>
                                                </div>
                                                <div className="d-flex gap-1">
                                                    {[1, 5, 8, 10].map((nota) => (
                                                        <button
                                                            key={nota}
                                                            type="button"
                                                            onClick={() => handleVoteCandidate(c.id, nota)}
                                                            className="btn btn-outline-secondary btn-sm py-0 px-2 font-mono"
                                                            style={{ fontSize: '0.7rem' }}
                                                        >
                                                            +{nota}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-secondary small">
                                <Tv size={28} className="mb-2 opacity-50" />
                                <p className="mb-0">No hay candidatos en votación activa en esta sala.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Chat en Tiempo Real */}
                <div className="col-12 col-lg-4">
                    <div
                        className="rounded-3 d-flex flex-column overflow-hidden border border-dark"
                        style={{ backgroundColor: '#0D0D0D', height: '650px' }}
                    >
                        {/* Cabecera del Chat */}
                        <div className="p-3 border-bottom border-dark d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                                <MessageSquare size={16} className="text-primary" />
                                <span className="text-white fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    Chat de la Sala
                                </span>
                            </div>
                            <div className="text-secondary small font-mono d-flex align-items-center gap-1">
                                <Users size={14} />
                                <span>{room?.members_count || 1} miembros</span>
                            </div>
                        </div>

                        {/* Lista de Mensajes con Scroll */}
                        <div className="flex-grow-1 p-3 overflow-y-auto d-flex flex-column gap-2.5">
                            {chatMessages.length === 0 ? (
                                <div className="text-center my-auto text-secondary small font-mono">
                                    <MessageSquare size={32} className="mx-auto mb-2 opacity-25" />
                                    <span>¡Sé el primero en enviar un mensaje!</span>
                                </div>
                            ) : (
                                chatMessages.map((msg) => {
                                    const isSelf = msg.sender === (user?.display_name || user?.username || 'Invitado')
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
                                            <span
                                                className="text-secondary small font-mono mb-0.5"
                                                style={{ fontSize: '0.68rem' }}
                                            >
                                                {msg.sender}
                                            </span>
                                            <div
                                                className="py-1.5 px-3 rounded-3"
                                                style={{
                                                    maxWidth: '85%',
                                                    backgroundColor: isSelf ? '#38bdf8' : '#1F1F1F',
                                                    color: isSelf ? '#000000' : '#FFFFFF',
                                                    fontSize: '0.84rem',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {msg.text}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input de Chat */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                if (chatInput.trim()) {
                                    sendChat(chatInput)
                                    setChatInput('')
                                }
                            }}
                            className="p-2.5 border-top border-dark d-flex gap-2"
                        >
                            <input
                                type="text"
                                placeholder="Escribe un mensaje en la sala..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                style={{ fontSize: '0.82rem' }}
                                maxLength={300}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary btn-sm px-3 d-flex align-items-center justify-content-center"
                                disabled={!chatInput.trim()}
                            >
                                <Send size={15} />
                            </button>
                        </form>
                    </div>

                    {/* Crear nueva sala */}
                    <div className="mt-3 p-3 rounded-2" style={{ backgroundColor: '#0D0D0D', border: '1px solid #1F1F1F' }}>
                        <h6 className="text-white small fw-bold mb-2">Crear nueva Sala de Anime</h6>
                        <form onSubmit={handleCreateRoom} className="d-flex gap-2">
                            <input
                                type="text"
                                placeholder="Nombre de la sala..."
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                style={{ fontSize: '0.8rem' }}
                            />
                            <button type="submit" className="btn btn-outline-light btn-sm text-nowrap">
                                Crear Sala
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Animación CSS para reacciones flotantes */}
            <style>{`
                @keyframes floatUp {
                    0% {
                        opacity: 1;
                        transform: translateY(0) scale(0.8);
                    }
                    50% {
                        opacity: 0.9;
                        transform: translateY(-120px) scale(1.2);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-240px) scale(1);
                    }
                }
                .hover-lift {
                    transition: transform 0.15s ease;
                }
                .hover-lift:hover {
                    transform: scale(1.25);
                }
            `}</style>
        </div>
    )
}
