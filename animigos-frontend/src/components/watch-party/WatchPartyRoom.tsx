import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
    Users,
    Plus,
    Share2,
    Check,
    CheckCircle2,
    AlertTriangle,
    ChevronLeft,
    SlidersHorizontal,
    Radio,
    Send,
    MessageSquare,
    Trophy,
    Target,
    ShieldAlert,
    BarChart3,
    List,
    ThumbsUp,
    CalendarPlus,
    LogOut,
    Loader2,
    Crown,
} from 'lucide-react'
import { useWatchParty } from '../../hooks/useWatchParty'
import {
    fetchAllRooms,
    fetchRoomByCode,
    fetchRoomById,
    createRoomApi,
    selectWinningAnimeApi,
    type RoomSummary,
} from '../../services/watchPartyApi'
import { useAuth } from '../../context/AuthContext'
import { useCatalogSearch } from '../../hooks/useCatalog'
import type { ApiAnimeData } from '../../services/userListApi'
import { Dialogo } from '../mi-lista/piezas'
import '../mi-lista/mi-lista.css'
import './watch-party.css'

const QUICK_EMOJIS = ['🍿', '🎉', '🔥', '👏', '😱', '❤️']

export const WatchPartyRoom: React.FC = () => {
    const { user } = useAuth()
    const userName = user?.display_name || user?.username || 'Invitado'
    const userToken = user ? `user_${user.id}` : 'guest_anon'

    // Estado de vista: 'dashboard' (ver todas las listas) o 'sala' (ver una sala específica)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [roomsList, setRoomsList] = useState<RoomSummary[]>([])
    const [isLoadingRooms, setIsLoadingRooms] = useState(false)

    // Pestaña activa dentro de la sala
    const [roomTab, setRoomTab] = useState<'votacion' | 'grafico' | 'tracker'>('votacion')
    const [chartMode, setChartMode] = useState<'matriz' | 'apilado' | 'radar'>('matriz')

    // Valores locales de sliders de votación por candidato { [candidateId]: number }
    const [localVotes, setLocalVotes] = useState<Record<string, number>>({})

    // Modales
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newRoomName, setNewRoomName] = useState('')
    const [newRoomDesc, setNewRoomDesc] = useState('')

    const [showNominateModal, setShowNominateModal] = useState(false)
    const [nominateSearch, setNominateSearch] = useState('')

    const [showCriteriaModal, setShowCriteriaModal] = useState(false)
    const [criteriaDuration, setCriteriaDuration] = useState('1-28 caps')
    const [criteriaGenres, setCriteriaGenres] = useState('Sci-Fi, Fantasía, Misterio')
    const [criteriaYears, setCriteriaYears] = useState('2010-2026')

    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [scheduleDate, setScheduleDate] = useState('')
    const [scheduleNotes, setScheduleNotes] = useState('')

    // Mensajes y chat
    const [copiedCode, setCopiedCode] = useState<string | null>(null)
    const [chatInput, setChatInput] = useState('')
    const chatScrollRef = useRef<HTMLDivElement>(null)

    // Cargar listas al iniciar
    useEffect(() => {
        loadRooms()
    }, [])

    // Soporte de navegación por hash: #sala/<codigo>
    useEffect(() => {
        const hash = window.location.hash
        const match = hash.match(/sala[=/]([a-zA-Z0-9_-]+)/i)
        const initialCode = match ? match[1] : ''

        if (initialCode) {
            handleOpenByCode(initialCode)
        }
    }, [])

    const loadRooms = async () => {
        setIsLoadingRooms(true)
        try {
            const data = await fetchAllRooms()
            setRoomsList(data)
        } catch (e) {
            console.error('Error cargando listas:', e)
        } finally {
            setIsLoadingRooms(false)
        }
    }

    const handleOpenByCode = async (code: string) => {
        try {
            const room = code.includes('-') ? await fetchRoomById(code) : await fetchRoomByCode(code)
            setSelectedRoomId(room.id)
            window.location.hash = `#sala/${room.invite_code}`
        } catch (e) {
            console.error('No se pudo encontrar la sala por código:', e)
        }
    }

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoomName.trim()) return
        try {
            const newRoom = await createRoomApi({
                name: newRoomName.trim(),
                description: newRoomDesc.trim(),
                creator_name: userName,
                guest_token: userToken,
            })
            setShowCreateModal(false)
            setNewRoomName('')
            setNewRoomDesc('')
            await loadRooms()
            setSelectedRoomId(newRoom.id)
            window.location.hash = `#sala/${newRoom.invite_code}`
        } catch (e) {
            console.error('Error creando sala:', e)
        }
    }

    // Hook principal de tiempo real para la sala seleccionada
    const {
        connectionStatus,
        latencyMs,
        room,
        chatMessages,
        floatingReactions,
        updateMyProgress,
        setGroupTarget,
        scheduleSession,
        voteCandidate,
        nominateCandidate,
        sendChat,
        sendReaction,
    } = useWatchParty({ roomId: selectedRoomId || '', userName, userToken })

    // Sincronizar votos guardados del usuario en el estado de sliders locales
    useEffect(() => {
        if (room?.candidates) {
            const initialMap: Record<string, number> = {}
            room.candidates.forEach((cand) => {
                const existingVote = cand.votes?.find((v) => (v.voter_name || (v as any).guest_name) === userName)
                initialMap[cand.id] = existingVote ? (existingVote.interest_score ?? (existingVote as any).score ?? 5) : 5
            })
            setLocalVotes(initialMap)
        }
    }, [room?.candidates, userName])

    // Scroll automático en el chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
        }
    }, [chatMessages])

    const handleCopy = (code: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        const fullUrl = `${window.location.origin}/#sala/${code}`
        navigator.clipboard.writeText(fullUrl)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 2500)
    }

    // Búsqueda de animes en catálogo general para postular
    const { data: catalogResults = [], isLoading: isSearchingCatalog } = useCatalogSearch(nominateSearch)

    const handleNominateAnime = async (animeId: number) => {
        try {
            await nominateCandidate(animeId)
            setShowNominateModal(false)
            setNominateSearch('')
        } catch (e) {
            console.error('Error al postular anime:', e)
        }
    }

    const handleSendVote = (candidateId: string) => {
        const score = localVotes[candidateId] ?? 5
        voteCandidate(candidateId, score)
    }

    const handleConfirmAllVotes = () => {
        if (!room?.candidates) return
        room.candidates.forEach((cand) => {
            const score = localVotes[cand.id] ?? 5
            voteCandidate(cand.id, score)
        })
    }

    // Cálculos y Métricas del Algoritmo de Felicidad
    const candidates = useMemo(() => {
        if (!room?.candidates) return []
        return [...room.candidates].sort((a, b) => {
            const scoreA = a.happiness_result?.final_score ?? a.avg_interest ?? 0
            const scoreB = b.happiness_result?.final_score ?? b.avg_interest ?? 0
            return scoreB - scoreA
        })
    }, [room?.candidates])

    const topCandidate = candidates[0] || null

    const avgDispersion = useMemo(() => {
        if (!candidates.length) return '0.0'
        const dispersions = candidates
            .map((c) => c.happiness_result?.interest_dispersion ?? 0)
            .filter((d) => d > 0)
        if (!dispersions.length) return '0.8'
        const avg = dispersions.reduce((a, b) => a + b, 0) / dispersions.length
        return avg.toFixed(1)
    }, [candidates])

    const avgQuorum = useMemo(() => {
        if (!room?.members?.length || !candidates.length) return 100
        const totalExpected = room.members.length * candidates.length
        let totalVotes = 0
        candidates.forEach((c) => {
            totalVotes += c.votes?.length || 0
        })
        const pct = Math.min(100, Math.round((totalVotes / Math.max(1, totalExpected)) * 100))
        return pct > 0 ? pct : 100
    }, [room?.members, candidates])

    const myWatched = useMemo(() => {
        const member = room?.members?.find((m) => m.guest_name === userName)
        return member?.episodes_watched || 0
    }, [room?.members, userName])

    const groupTarget = (room as any)?.target_episode || room?.current_episode || 1
    const totalEpisodes = (room as any)?.winning_anime?.episodes || room?.selected_anime?.episodes || 24
    const totalMembers = room?.members?.length || 1

    // ==============================================================
    // VISTA 1: DASHBOARD DE LISTAS COMPARTIDAS (SIN CARD DE TÍTULO)
    // ==============================================================
    if (!selectedRoomId) {
        return (
            <div className="ml-root wp-root py-4 px-3 px-md-5">
                <div className="container" style={{ maxWidth: '1200px' }}>
                    {/* Header Principal sin Card */}
                    <header className="wp-header-clean">
                        <span className="ml-eyebrow">COORDINACIÓN GRUPAL · ANIMIGOS</span>
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-1">
                            <div>
                                <h1 className="ml-titulo">Listas Compartidas</h1>
                                <p className="ml-sub mb-0">
                                    Coordina decisiones con tu grupo. Postulen animes, voten su interés de <strong>0 a 10</strong> y el <strong>Algoritmo de Felicidad</strong> elegirá la opción con mayor consenso.
                                </p>
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(true)}
                                    className="ml-btn ml-btn-acento"
                                >
                                    <Plus size={16} />
                                    <span>Crear Nueva Lista Compartida</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Grilla de Salas Compartidas (2 Columnas, Compactas y Ordenadas) */}
                    {isLoadingRooms ? (
                        <div className="text-center py-5">
                            <Loader2 size={30} className="text-secondary mb-2" style={{ animation: 'spin 1s linear infinite' }} />
                            <p className="small" style={{ color: 'var(--wp-text-dim)' }}>Cargando tus salas compartidas...</p>
                        </div>
                    ) : roomsList.length === 0 ? (
                        <div
                            className="text-center py-5 p-4 rounded-4"
                            style={{ background: 'var(--wp-surface)', border: '1px dashed var(--wp-border)' }}
                        >
                            <Users size={36} className="mb-3 text-secondary opacity-50" />
                            <h3 className="h5 fw-bold text-white mb-2">No tienes salas compartidas todavía</h3>
                            <p className="small mb-4" style={{ color: 'var(--wp-text-muted)' }}>
                                Crea una lista para coordinar maratones con tus amigos y encontrar qué ver juntos.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="ml-btn ml-btn-acento"
                            >
                                <Plus size={16} />
                                <span>Crear mi primera sala</span>
                            </button>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {roomsList.map((r) => {
                                const statusLabel =
                                    r.status === 'voting'
                                        ? 'Votación en curso'
                                        : r.status === 'candidates'
                                        ? 'Candidatos abiertos'
                                        : r.status === 'watching'
                                        ? 'Viendo en grupo'
                                        : 'Completado'

                                return (
                                    <div key={r.id} className="col-12 col-lg-6">
                                        <div className="wp-room-card">
                                            {/* Fila Superior: Badge de Estado y Miembros */}
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <span className="wp-chip">
                                                    {statusLabel}
                                                </span>
                                                <span className="small d-flex align-items-center gap-1" style={{ color: 'var(--wp-text-dim)' }}>
                                                    <Users size={13} />
                                                    <span>{r.members?.length || r.members_count || 1} integrantes</span>
                                                </span>
                                            </div>

                                            {/* Título y Descripción */}
                                            <div className="mb-3">
                                                <h3 className="h6 fw-bold text-white mb-1">{r.name}</h3>
                                                <p className="small mb-0 text-truncate" style={{ color: 'var(--wp-text-muted)', lineHeight: 1.5 }}>
                                                    {r.description || 'Grupo de maratón y coordinación semanal entre amigos.'}
                                                </p>
                                            </div>

                                            {/* Fila de Código y Copiar Enlace */}
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="small" style={{ color: 'var(--wp-text-dim)', fontSize: '0.78rem' }}>Código:</span>
                                                    <span className="wp-code-box font-mono fw-bold text-white">
                                                        {r.invite_code}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCopy(r.invite_code, e)}
                                                    className="ml-btn ml-btn-sm"
                                                    style={{ fontSize: '0.76rem' }}
                                                >
                                                    {copiedCode === r.invite_code ? <Check size={12} className="text-success" /> : <Share2 size={12} />}
                                                    <span>{copiedCode === r.invite_code ? 'Copiado' : 'Copiar Enlace'}</span>
                                                </button>
                                            </div>

                                            {/* Acciones de Tarjeta: Entrar y Abandonar */}
                                            <div className="d-flex align-items-center justify-content-between gap-2 pt-1 border-top" style={{ borderColor: 'var(--wp-border)' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRoomId(r.id)
                                                        window.location.hash = `#sala/${r.invite_code}`
                                                    }}
                                                    className="wp-btn-pill-primary flex-grow-1 justify-content-center"
                                                >
                                                    <span>Entrar a la Sala de Votación</span>
                                                    <span>→</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    className="wp-btn-pill-danger"
                                                    title="Abandonar esta sala"
                                                >
                                                    <LogOut size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Crear Nueva Lista */}
                <Dialogo
                    abierto={showCreateModal}
                    onCerrar={() => setShowCreateModal(false)}
                    etiqueta="Crear Nueva Lista Compartida"
                    ancho={480}
                >
                    <form onSubmit={handleCreateRoom}>
                        <div className="p-4 d-flex flex-column gap-3">
                            <div>
                                <h3 className="h6 fw-bold text-white mb-1">Crear Nueva Lista Compartida</h3>
                                <p className="small mb-0" style={{ color: 'var(--wp-text-muted)' }}>
                                    Crea una sala para que tus amigos postulen y voten animes con el Algoritmo de Felicidad.
                                </p>
                            </div>

                            <div>
                                <label className="form-label small fw-semibold text-white">Nombre de la Sala</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Anime de los Viernes 🍿"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    className="form-control bg-black text-white border-secondary"
                                    required
                                />
                            </div>

                            <div>
                                <label className="form-label small fw-semibold text-white">Descripción / Objetivo</label>
                                <textarea
                                    rows={3}
                                    placeholder="Ej: Grupo de maratón semanal entre amigos."
                                    value={newRoomDesc}
                                    onChange={(e) => setNewRoomDesc(e.target.value)}
                                    className="form-control bg-black text-white border-secondary"
                                />
                            </div>
                        </div>

                        <div className="p-3 border-top border-dark d-flex justify-content-end gap-2">
                            <button
                                type="button"
                                className="ml-btn ml-btn-fantasma ml-btn-sm"
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancelar
                            </button>
                            <button type="submit" className="ml-btn ml-btn-acento ml-btn-sm">
                                Crear Lista
                            </button>
                        </div>
                    </form>
                </Dialogo>
            </div>
        )
    }

    // ==============================================================
    // VISTA 2 & 3: SALA SELECCIONADA (SIN CARD EN EL TÍTULO)
    // ==============================================================
    return (
        <div className="ml-root wp-root py-4 px-3 px-md-5">
            <div className="container" style={{ maxWidth: '1240px' }}>
                {/* Botón de Retorno Limpio */}
                <button
                    type="button"
                    onClick={() => {
                        setSelectedRoomId(null)
                        window.location.hash = ''
                    }}
                    className="ml-btn ml-btn-fantasma ml-btn-sm mb-3"
                >
                    <ChevronLeft size={15} />
                    <span>Volver a Listas Compartidas</span>
                </button>

                {/* Encabezado Limpio sin Card */}
                <header className="wp-header-clean mb-4">
                    {/* Fila Superior: Badges de Estado Socket y Miembros */}
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span className="ml-eyebrow">SALA DE VOTACIÓN · CÓDIGO {room?.invite_code || ''}</span>
                        <span className="wp-chip wp-chip-active">
                            <Radio size={11} className={connectionStatus === 'connected' ? 'text-success' : ''} />
                            <span>
                                {connectionStatus === 'connected'
                                    ? `En Vivo (${latencyMs ?? 15}ms)`
                                    : 'Reconectando...'}
                            </span>
                        </span>
                        <span className="wp-chip">
                            <Users size={12} />
                            <span>{totalMembers} integrantes</span>
                        </span>
                    </div>

                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-4">
                        <div className="flex-grow-1">
                            <h1 className="ml-titulo">{room?.name || 'Anime de los Viernes 🍿'}</h1>
                            <p className="ml-sub mb-2">
                                Ajusta tu puntuación por slider (<strong>0 a 10</strong>) y presiona <strong>Votar</strong> para actualizar el ranking en vivo.
                            </p>

                            {/* Criterios del Grupo */}
                            <div className="d-flex flex-wrap align-items-center gap-1.5 mt-2">
                                <span className="small text-secondary fw-semibold me-1">Criterios:</span>
                                <span className="ml-tag font-mono">🍇 {criteriaDuration}</span>
                                <span className="ml-tag">{criteriaGenres}</span>
                                <span className="ml-tag font-mono">{criteriaYears}</span>
                            </div>
                        </div>

                        {/* Botones de Acción de Cabecera */}
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowNominateModal(true)}
                                className="ml-btn ml-btn-acento"
                            >
                                <Plus size={15} />
                                <span>Postular Anime</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowCriteriaModal(true)}
                                className="ml-btn"
                            >
                                <SlidersHorizontal size={14} />
                                <span>Criterios Ideales</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleCopy(room?.invite_code || '')}
                                className="ml-btn"
                            >
                                <Share2 size={14} />
                                <span>{copiedCode === room?.invite_code ? 'Copiado' : 'Invitar Amigos'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedRoomId(null)
                                    window.location.hash = ''
                                }}
                                className="ml-btn ml-btn-fantasma ml-peligro"
                                title="Abandonar sala"
                            >
                                <LogOut size={14} />
                                <span>Salir</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Barra de Pestañas estilo "Mi Lista" (.ml-tabs) */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                    <div className="ml-tabs mb-0">
                        <button
                            type="button"
                            className="ml-tab"
                            aria-selected={roomTab === 'votacion'}
                            onClick={() => setRoomTab('votacion')}
                        >
                            <List size={15} />
                            <span>Lista de Votación</span>
                            <span className="ml-tab-num">{candidates.length}</span>
                        </button>

                        <button
                            type="button"
                            className="ml-tab"
                            aria-selected={roomTab === 'grafico'}
                            onClick={() => setRoomTab('grafico')}
                        >
                            <BarChart3 size={15} />
                            <span>Gráfico & Análisis de Felicidad</span>
                        </button>

                        <button
                            type="button"
                            className="ml-tab"
                            aria-selected={roomTab === 'tracker'}
                            onClick={() => setRoomTab('tracker')}
                        >
                            <Target size={15} />
                            <span>Conteo de Capítulos & Sesión</span>
                        </button>
                    </div>

                    {/* Acción rápida de votar todos si está en pestaña de votación */}
                    {roomTab === 'votacion' && candidates.length > 0 && (
                        <button
                            type="button"
                            onClick={handleConfirmAllVotes}
                            className="ml-btn ml-btn-sm"
                        >
                            <Check size={14} className="text-success" />
                            <span>Confirmar Todos mis Votos</span>
                        </button>
                    )}
                </div>

                {/* ==============================================================
                    PESTAÑA 1: LISTA DE VOTACIÓN (RANKING POR FELICIDAD GRUPAL)
                   ============================================================== */}
                {roomTab === 'votacion' && (
                    <div>
                        {candidates.length === 0 ? (
                            <div
                                className="p-5 text-center rounded-4"
                                style={{ background: 'var(--wp-surface)', border: '1px dashed var(--wp-border)' }}
                            >
                                <p style={{ color: 'var(--wp-text-muted)' }}>Aún no hay animes postulados en esta lista.</p>
                                <button
                                    type="button"
                                    onClick={() => setShowNominateModal(true)}
                                    className="ml-btn ml-btn-acento"
                                >
                                    <Plus size={16} />
                                    <span>Postular el primer anime</span>
                                </button>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2.5">
                                {candidates.map((cand, index) => {
                                    const rankNum = index + 1
                                    const myVoteScore = localVotes[cand.id] ?? 5
                                    const happinessScore = cand.happiness_result?.final_score ?? cand.avg_interest ?? 10
                                    const dispersion = cand.happiness_result?.interest_dispersion ?? 0.8
                                    const isPolarized = dispersion >= 2.0
                                    const isConsensusWinner = rankNum === 1 && !isPolarized

                                    const explanation =
                                        cand.happiness_result?.explanations?.[0] ||
                                        (isPolarized
                                            ? 'Opiniones divididas entre el grupo (polarizado).'
                                            : 'Interés parejo y alto consenso entre los integrantes.')

                                    return (
                                        <div key={cand.id} className="wp-candidate-row">
                                            {/* Posición / Ranking */}
                                            <div className="d-flex align-items-center justify-content-center" style={{ width: 28 }}>
                                                {rankNum === 1 ? (
                                                    <Crown size={20} className="text-warning" />
                                                ) : (
                                                    <span className="wp-rank-indicator">
                                                        #{rankNum}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Poster Thumbnail Compacto */}
                                            <img
                                                src={cand.image_url}
                                                alt={cand.title}
                                                className="wp-candidate-poster-compact"
                                            />

                                            {/* Columna Central: Información, Consenso y Slider */}
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                {/* Título y Metadata */}
                                                <div className="d-flex flex-wrap align-items-baseline gap-2 mb-1">
                                                    <strong className="text-white text-truncate" style={{ fontSize: '0.98rem' }}>
                                                        {cand.title}
                                                    </strong>
                                                    <span className="small" style={{ color: 'var(--wp-text-dim)', fontSize: '0.75rem' }}>
                                                        ★ {cand.score || '9.0'} MAL · {cand.episodes || 24} eps · por {cand.suggested_by}
                                                    </span>
                                                </div>

                                                {/* Etiqueta de Consenso */}
                                                <div className="mb-2">
                                                    <span
                                                        className={`wp-consenso-tag ${
                                                            isConsensusWinner
                                                                ? 'tag-ganador'
                                                                : isPolarized
                                                                ? 'tag-polarizado'
                                                                : ''
                                                        }`}
                                                    >
                                                        {isConsensusWinner && '👑 '}
                                                        {isPolarized && '⚡ '}
                                                        {explanation}
                                                    </span>
                                                </div>

                                                {/* Slider de Puntuación (0 a 10) */}
                                                <div className="d-flex flex-column flex-md-row align-items-md-center gap-2.5">
                                                    <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '340px' }}>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={10}
                                                            step={0.5}
                                                            value={myVoteScore}
                                                            onChange={(e) =>
                                                                setLocalVotes((prev) => ({
                                                                    ...prev,
                                                                    [cand.id]: parseFloat(e.target.value),
                                                                }))
                                                            }
                                                            className="wp-slider-track"
                                                        />
                                                    </div>

                                                    {/* Score Box y Botón Votar */}
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="wp-score-box">
                                                            Tu voto: <strong>{myVoteScore.toFixed(1).replace('.', ',')}</strong> / 10
                                                        </span>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendVote(cand.id)}
                                                            className="ml-btn ml-btn-sm"
                                                            title="Guardar voto para este anime"
                                                        >
                                                            <ThumbsUp size={12} />
                                                            <span>Votar</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tarjeta de Felicidad Grupal (Derecha) */}
                                            <div className="wp-happiness-pill d-flex flex-column align-items-center justify-content-center">
                                                <span className="small fw-bold text-uppercase d-block" style={{ fontSize: '0.65rem', color: '#fbbf24', letterSpacing: '0.05em' }}>
                                                    FELICIDAD
                                                </span>
                                                <div className="h5 fw-bold mb-0 text-white font-mono">
                                                    {Number(happinessScore).toFixed(0)} <span style={{ fontSize: '0.75rem', color: 'var(--wp-text-dim)' }}>/ 10</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (room) {
                                                            await selectWinningAnimeApi(room.id, cand.anime_id)
                                                            setRoomTab('tracker')
                                                        }
                                                    }}
                                                    className="btn btn-link text-decoration-none p-0 mt-1"
                                                    style={{ fontSize: '0.7rem', color: 'var(--wp-acento)' }}
                                                >
                                                    Ver en Grupo →
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ==============================================================
                    PESTAÑA 2: GRÁFICO & ANÁLISIS DE FELICIDAD
                   ============================================================== */}
                {roomTab === 'grafico' && (
                    <div className="d-flex flex-column gap-3">
                        {/* 3 Tarjetas Métricas Superiores */}
                        <div className="row g-3">
                            <div className="col-12 col-md-4">
                                <div className="wp-metric-card h-100">
                                    <div className="wp-metric-icon text-warning">
                                        <Trophy size={20} />
                                    </div>
                                    <div>
                                        <span className="small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: 'var(--wp-text-dim)', letterSpacing: '0.08em' }}>
                                            MEJOR OPCIÓN GRUPAL
                                        </span>
                                        <strong className="text-white d-block text-truncate" style={{ maxWidth: '190px', fontSize: '0.92rem' }}>
                                            {topCandidate ? topCandidate.title : 'Sin candidatos'}
                                        </strong>
                                        <span className="small font-mono fw-bold" style={{ color: '#fbbf24', fontSize: '0.78rem' }}>
                                            {topCandidate?.happiness_result?.final_score || 10} / 10 pts
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-md-4">
                                <div className="wp-metric-card h-100">
                                    <div className="wp-metric-icon" style={{ color: 'var(--wp-acento)' }}>
                                        <Target size={20} />
                                    </div>
                                    <div>
                                        <span className="small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: 'var(--wp-text-dim)', letterSpacing: '0.08em' }}>
                                            DISPERSIÓN PROMEDIO
                                        </span>
                                        <strong className="text-white d-block font-mono" style={{ fontSize: '1rem' }}>
                                            ±{avgDispersion} SD
                                        </strong>
                                        <span className="small" style={{ color: 'var(--wp-text-muted)', fontSize: '0.75rem' }}>
                                            Nivel de acuerdo en votos
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-md-4">
                                <div className="wp-metric-card h-100">
                                    <div className="wp-metric-icon text-success">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <span className="small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: 'var(--wp-text-dim)', letterSpacing: '0.08em' }}>
                                            QUÓRUM DEL GRUPO
                                        </span>
                                        <strong className="text-white d-block font-mono" style={{ fontSize: '1rem' }}>
                                            {avgQuorum}%
                                        </strong>
                                        <span className="small" style={{ color: 'var(--wp-text-muted)', fontSize: '0.75rem' }}>
                                            Participación activa
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Visualizador de Felicidad Grupal (Matriz 2D) */}
                        <div className="wp-matrix-container">
                            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--wp-border)' }}>
                                <div>
                                    <div className="d-flex align-items-center gap-2 mb-0.5">
                                        <BarChart3 size={16} style={{ color: 'var(--wp-acento)' }} />
                                        <h3 className="h6 fw-bold text-white mb-0">Matriz de Decisión 2D</h3>
                                    </div>
                                    <p className="small mb-0" style={{ color: 'var(--wp-text-dim)', fontSize: '0.78rem' }}>
                                        Eje X: Consenso (Baja Dispersión) · Eje Y: Ganas del Grupo (0 a 10)
                                    </p>
                                </div>

                                <div className="ml-tabs mb-0 p-1" style={{ gap: '0.2rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setChartMode('matriz')}
                                        className={`ml-tab py-1 px-2.5 ${chartMode === 'matriz' ? 'active' : ''}`}
                                        aria-selected={chartMode === 'matriz'}
                                        style={{ fontSize: '0.78rem' }}
                                    >
                                        Matriz 2D
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartMode('apilado')}
                                        className={`ml-tab py-1 px-2.5 ${chartMode === 'apilado' ? 'active' : ''}`}
                                        aria-selected={chartMode === 'apilado'}
                                        style={{ fontSize: '0.78rem' }}
                                    >
                                        Desglose Apilado
                                    </button>
                                </div>
                            </div>

                            {/* Canvas / SVG de la Matriz de Decisión 2D */}
                            <div
                                className="position-relative rounded-3 overflow-hidden"
                                style={{
                                    height: '340px',
                                    background: '#090d15',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                }}
                            >
                                {/* Cuadrantes Rotulados */}
                                <div
                                    className="wp-quadrant-badge"
                                    style={{
                                        top: '12px',
                                        left: '12px',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        borderColor: 'rgba(245, 158, 11, 0.3)',
                                        color: '#fbbf24',
                                    }}
                                >
                                    ⚡ AMOR U ODIO (POLARIZADO)
                                </div>

                                <div
                                    className="wp-quadrant-badge"
                                    style={{
                                        top: '12px',
                                        right: '12px',
                                        background: 'rgba(52, 211, 153, 0.1)',
                                        borderColor: 'rgba(52, 211, 153, 0.3)',
                                        color: '#34d399',
                                    }}
                                >
                                    👑 GANADOR SEGURO
                                </div>

                                {/* Líneas de división de cuadrantes */}
                                <div
                                    className="position-absolute"
                                    style={{
                                        top: 0,
                                        bottom: 0,
                                        left: '50%',
                                        width: 1,
                                        background: 'rgba(255, 255, 255, 0.06)',
                                    }}
                                />
                                <div
                                    className="position-absolute"
                                    style={{
                                        left: 0,
                                        right: 0,
                                        top: '50%',
                                        height: 1,
                                        background: 'rgba(255, 255, 255, 0.06)',
                                    }}
                                />

                                {/* Renderizado de Candidatos en el Espacio 2D */}
                                {candidates.map((cand, idx) => {
                                    const mean = cand.happiness_result?.interest_mean ?? cand.avg_interest ?? 7.5
                                    const disp = cand.happiness_result?.interest_dispersion ?? 1.2

                                    const yPercent = Math.max(18, Math.min(82, 100 - (mean / 10) * 100))
                                    const consensusVal = Math.max(0, 10 - disp * 2.5)
                                    const xPercent = Math.max(15, Math.min(85, (consensusVal / 10) * 100))

                                    return (
                                        <div
                                            key={cand.id}
                                            className="position-absolute d-flex flex-column align-items-center"
                                            style={{
                                                left: `${xPercent}%`,
                                                top: `${yPercent}%`,
                                                transform: 'translate(-50%, -50%)',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s ease',
                                                zIndex: 3,
                                            }}
                                            title={`${cand.title} — Ganas: ${mean.toFixed(1)}, Dispersión: ±${disp.toFixed(2)}`}
                                        >
                                            <div className="position-relative">
                                                <img
                                                    src={cand.image_url}
                                                    alt={cand.title}
                                                    className="rounded-circle shadow"
                                                    style={{
                                                        width: 38,
                                                        height: 38,
                                                        objectFit: 'cover',
                                                        border: idx === 0 ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.3)',
                                                    }}
                                                />
                                                <span
                                                    className="position-absolute bottom-0 end-0 badge rounded-pill"
                                                    style={{
                                                        background: idx === 0 ? '#fbbf24' : '#1e293b',
                                                        color: idx === 0 ? '#000000' : '#ffffff',
                                                        fontSize: '0.6rem',
                                                        padding: '0.12rem 0.3rem',
                                                    }}
                                                >
                                                    #{idx + 1}
                                                </span>
                                            </div>
                                            <span
                                                className="small text-truncate mt-1 px-1 rounded"
                                                style={{
                                                    maxWidth: '110px',
                                                    fontSize: '0.66rem',
                                                    background: 'rgba(0,0,0,0.7)',
                                                    color: '#ffffff',
                                                }}
                                            >
                                                {cand.title}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==============================================================
                    PESTAÑA 3: CONTEO DE CAPÍTULOS & SESIÓN (WATCH PARTY TRACKER)
                   ============================================================== */}
                {roomTab === 'tracker' && (
                    <div className="row g-3">
                        {/* Columna Izquierda: Conteo y Ponerse al Día */}
                        <div className="col-12 col-lg-8 d-flex flex-column gap-3">
                            {/* Alerta de Catch-up: Quiénes faltan por ponerse al día */}
                            {room?.catchup_members && room.catchup_members.length > 0 ? (
                                <div
                                    className="p-3 rounded-3 d-flex flex-column gap-2"
                                    style={{
                                        background: 'rgba(245, 158, 11, 0.08)',
                                        border: '1px solid rgba(245, 158, 11, 0.25)',
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-2 text-warning fw-bold small">
                                        <AlertTriangle size={15} />
                                        <span>Faltan por ponerse al día con el Capítulo {groupTarget}:</span>
                                    </div>
                                    <div className="d-flex flex-wrap gap-2">
                                        {room.catchup_members.map((cm) => (
                                            <span
                                                key={cm.id}
                                                className="wp-chip"
                                                style={{ background: '#1c1710', color: '#fef08a', borderColor: '#4a3510' }}
                                            >
                                                <strong>{cm.guest_name}</strong>: {cm.episodes_behind} caps pendientes (en cap {cm.episodes_watched})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="p-3 rounded-3 d-flex align-items-center gap-2 text-success small fw-semibold"
                                    style={{
                                        background: 'rgba(52, 211, 153, 0.08)',
                                        border: '1px solid rgba(52, 211, 153, 0.25)',
                                    }}
                                >
                                    <CheckCircle2 size={16} />
                                    <span>¡Excelente! Todo el grupo está al día con el Capítulo {groupTarget}.</span>
                                </div>
                            )}

                            {/* Tarjeta de Progreso Personal (1 Click) */}
                            <div
                                className="p-3 rounded-3 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3"
                                style={{ background: 'var(--wp-surface)', border: '1px solid var(--wp-border)' }}
                            >
                                <div>
                                    <span className="small text-uppercase fw-bold d-block mb-1" style={{ color: 'var(--wp-text-dim)', fontSize: '0.7rem' }}>
                                        Tu Progreso ({userName})
                                    </span>
                                    <div className="d-flex align-items-baseline gap-2">
                                        <span className="h5 fw-bold text-white mb-0 font-mono">Capítulo {myWatched}</span>
                                        <span className="small" style={{ color: 'var(--wp-text-muted)' }}>de {totalEpisodes}</span>
                                        <span
                                            className="badge rounded-pill ms-2"
                                            style={{
                                                background: myWatched >= groupTarget ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                color: myWatched >= groupTarget ? '#34d399' : '#fbbf24',
                                                fontSize: '0.7rem',
                                            }}
                                        >
                                            {myWatched >= groupTarget ? 'Al día' : `Atrasado (-${groupTarget - myWatched})`}
                                        </span>
                                    </div>
                                </div>

                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateMyProgress(Math.max(0, myWatched - 1))}
                                        disabled={myWatched <= 0}
                                        className="ml-btn ml-btn-sm"
                                    >
                                        -1
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateMyProgress(myWatched + 1)}
                                        className="ml-btn ml-btn-acento ml-btn-sm"
                                    >
                                        <Plus size={14} />
                                        <span>¡Ya vi el Cap {myWatched + 1}!</span>
                                    </button>
                                </div>
                            </div>

                            {/* Meta del Grupo y Próxima Sesión */}
                            <div
                                className="p-3 rounded-3 d-flex justify-content-between align-items-center"
                                style={{ background: 'var(--wp-surface)', border: '1px solid var(--wp-border)' }}
                            >
                                <div>
                                    <span className="small fw-bold text-uppercase d-block mb-0.5" style={{ color: 'var(--wp-text-dim)', fontSize: '0.68rem' }}>
                                        META GRUPAL ACTUAL
                                    </span>
                                    <strong className="text-white font-mono h6 mb-0">Capítulo {groupTarget} de {totalEpisodes}</strong>
                                </div>
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setGroupTarget(groupTarget + 1)}
                                        className="ml-btn ml-btn-sm"
                                    >
                                        Avanzar Meta (+1)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowScheduleModal(true)}
                                        className="ml-btn ml-btn-sm"
                                    >
                                        <CalendarPlus size={13} />
                                        <span>Agendar Sesión</span>
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Miembros con su progreso */}
                            <div
                                className="rounded-3 overflow-hidden"
                                style={{ background: 'var(--wp-surface)', border: '1px solid var(--wp-border)' }}
                            >
                                <div className="p-3 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--wp-border)' }}>
                                    <span className="small fw-bold text-white">Conteo por Miembro ({totalMembers})</span>
                                    <span className="small font-mono" style={{ color: 'var(--wp-text-dim)', fontSize: '0.78rem' }}>Meta: Cap {groupTarget}</span>
                                </div>

                                <div className="p-3 d-flex flex-column gap-2">
                                    {room?.members?.map((m, idx) => (
                                        <div
                                            key={m.id}
                                            className="p-2 rounded-2 d-flex justify-content-between align-items-center"
                                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)' }}
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="small font-mono text-secondary" style={{ fontSize: '0.75rem' }}>0{idx + 1}</span>
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white font-mono"
                                                    style={{ width: 26, height: 26, background: '#1e293b', fontSize: '0.72rem' }}
                                                >
                                                    {m.guest_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="small fw-semibold text-white">{m.guest_name}</span>
                                            </div>

                                            <div className="d-flex align-items-center gap-2.5">
                                                <span className="small font-mono" style={{ color: 'var(--wp-text-muted)', fontSize: '0.78rem' }}>
                                                    {m.episodes_watched} / {totalEpisodes} caps
                                                </span>
                                                <span
                                                    className="badge rounded-pill"
                                                    style={{
                                                        background: m.sync_status === 'atrasado' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                                                        color: m.sync_status === 'atrasado' ? '#fbbf24' : '#34d399',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    {m.sync_status === 'atrasado' ? `Atrasado (-${m.episodes_behind})` : 'Al día'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Chat en Tiempo Real */}
                        <div className="col-12 col-lg-4">
                            <div
                                className="rounded-3 d-flex flex-column overflow-hidden position-relative"
                                style={{
                                    background: 'var(--wp-surface)',
                                    border: '1px solid var(--wp-border)',
                                    height: '520px',
                                }}
                            >
                                {/* Overlay de Reacciones Flotantes */}
                                <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none overflow-hidden z-2">
                                    {floatingReactions.map((r) => (
                                        <span
                                            key={r.id}
                                            className="position-absolute"
                                            style={{
                                                left: `${r.xPos}%`,
                                                bottom: '60px',
                                                fontSize: '1.6rem',
                                                animation: 'floatUp 2.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
                                            }}
                                        >
                                            {r.emoji}
                                        </span>
                                    ))}
                                </div>

                                {/* Cabecera del Chat */}
                                <div className="p-2.5 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--wp-border)' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <MessageSquare size={14} style={{ color: 'var(--wp-acento)' }} />
                                        <span className="small fw-bold text-white">Chat de la Sala</span>
                                    </div>
                                    <span className="small" style={{ color: 'var(--wp-text-dim)', fontSize: '0.72rem' }}>
                                        {totalMembers} online
                                    </span>
                                </div>

                                {/* Aviso de Spoilers */}
                                <div
                                    className="px-2.5 py-1.5 d-flex align-items-center gap-1.5"
                                    style={{ background: 'var(--wp-surface-2)', borderBottom: '1px solid var(--wp-border)', fontSize: '0.7rem' }}
                                >
                                    <ShieldAlert size={12} className="text-warning" />
                                    <span style={{ color: 'var(--wp-text-muted)' }}>
                                        Libre de spoilers hasta Cap <strong>{groupTarget}</strong>
                                    </span>
                                </div>

                                {/* Mensajes del Chat */}
                                <div
                                    ref={chatScrollRef}
                                    className="flex-grow-1 p-2.5 overflow-y-auto d-flex flex-column gap-2"
                                    style={{ scrollBehavior: 'smooth' }}
                                >
                                    {chatMessages.length === 0 ? (
                                        <div className="text-center my-auto small" style={{ color: 'var(--wp-text-dim)', fontSize: '0.78rem' }}>
                                            Escribe un mensaje para coordinar la maratón
                                        </div>
                                    ) : (
                                        chatMessages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`d-flex flex-column ${msg.sender === userName ? 'align-items-end' : 'align-items-start'}`}
                                            >
                                                <span className="small font-mono mb-0.5" style={{ fontSize: '0.65rem', color: 'var(--wp-text-dim)' }}>
                                                    {msg.sender}
                                                </span>
                                                <div
                                                    className="py-1 px-2.5 rounded-2 small"
                                                    style={{
                                                        background: msg.sender === userName ? '#ffffff' : 'var(--wp-surface-2)',
                                                        color: msg.sender === userName ? '#000000' : '#ffffff',
                                                        maxWidth: '85%',
                                                        fontSize: '0.8rem',
                                                    }}
                                                >
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Reacciones Rápidas */}
                                <div className="px-2.5 py-1.5 d-flex justify-content-between align-items-center border-top" style={{ borderColor: 'var(--wp-border)' }}>
                                    <span className="small" style={{ fontSize: '0.68rem', color: 'var(--wp-text-dim)' }}>Reaccionar:</span>
                                    <div className="d-flex gap-1">
                                        {QUICK_EMOJIS.map((em) => (
                                            <button
                                                key={em}
                                                type="button"
                                                onClick={() => sendReaction(em)}
                                                className="btn btn-sm btn-dark p-0.5 border-0"
                                                style={{ fontSize: '0.85rem' }}
                                            >
                                                {em}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Input del Chat */}
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        if (chatInput.trim()) {
                                            sendChat(chatInput)
                                            setChatInput('')
                                        }
                                    }}
                                    className="p-2 border-top d-flex gap-2"
                                    style={{ borderColor: 'var(--wp-border)' }}
                                >
                                    <input
                                        type="text"
                                        placeholder="Escribe un mensaje..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        className="form-control form-control-sm bg-black text-white border-secondary"
                                        style={{ fontSize: '0.8rem' }}
                                    />
                                    <button type="submit" className="ml-btn ml-btn-acento ml-btn-sm py-1 px-2.5">
                                        <Send size={12} />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==============================================================
                    MODALES DE LA SALA
                   ============================================================== */}
                {/* Modal Postular Anime */}
                <Dialogo
                    abierto={showNominateModal}
                    onCerrar={() => setShowNominateModal(false)}
                    etiqueta="Postular Anime a la Sala"
                    ancho={520}
                >
                    <div className="p-4 d-flex flex-column gap-3">
                        <div>
                            <h3 className="h6 fw-bold text-white mb-1">Postular Anime a la Votación</h3>
                            <p className="small mb-0" style={{ color: 'var(--wp-text-muted)' }}>
                                Busca en el catálogo y postúlalo para que el grupo lo vote.
                            </p>
                        </div>

                        <div className="position-relative">
                            <input
                                type="text"
                                placeholder="Busca por título en el catálogo..."
                                value={nominateSearch}
                                onChange={(e) => setNominateSearch(e.target.value)}
                                className="form-control bg-black text-white border-secondary"
                            />
                            {isSearchingCatalog && (
                                <Loader2 size={16} className="position-absolute end-0 top-50 translate-middle-y me-3 text-secondary spinner-border-sm" />
                            )}
                        </div>

                        <div className="d-flex flex-column gap-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
                            {catalogResults.map((anime: ApiAnimeData) => (
                                <div
                                    key={anime.mal_id}
                                    className="p-2 rounded-2 d-flex align-items-center justify-content-between gap-3"
                                    style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)' }}
                                >
                                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                                        <img
                                            src={anime.image_url}
                                            alt={anime.title}
                                            className="rounded"
                                            style={{ width: 36, height: 50, objectFit: 'cover' }}
                                        />
                                        <div className="overflow-hidden">
                                            <strong className="d-block text-white small text-truncate">{anime.title}</strong>
                                            <span className="small text-secondary font-mono" style={{ fontSize: '0.72rem' }}>
                                                ★ {anime.score || '8.5'} · {anime.episodes || 24} eps
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleNominateAnime(anime.mal_id)}
                                        className="ml-btn ml-btn-acento ml-btn-sm text-nowrap"
                                    >
                                        Postular
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </Dialogo>

                {/* Modal Criterios Ideales */}
                <Dialogo
                    abierto={showCriteriaModal}
                    onCerrar={() => setShowCriteriaModal(false)}
                    etiqueta="Criterios Ideales del Grupo"
                    ancho={460}
                >
                    <div className="p-4 d-flex flex-column gap-3">
                        <div>
                            <h3 className="h6 fw-bold text-white mb-1">Criterios Ideales del Grupo</h3>
                            <p className="small mb-0" style={{ color: 'var(--wp-text-muted)' }}>
                                Define los filtros preferidos de duración, géneros y años para esta maratón.
                            </p>
                        </div>

                        <div>
                            <label className="form-label small text-white fw-semibold">Duración de Capítulos</label>
                            <input
                                type="text"
                                value={criteriaDuration}
                                onChange={(e) => setCriteriaDuration(e.target.value)}
                                className="form-control bg-black text-white border-secondary"
                            />
                        </div>

                        <div>
                            <label className="form-label small text-white fw-semibold">Géneros Preferidos</label>
                            <input
                                type="text"
                                value={criteriaGenres}
                                onChange={(e) => setCriteriaGenres(e.target.value)}
                                className="form-control bg-black text-white border-secondary"
                            />
                        </div>

                        <div>
                            <label className="form-label small text-white fw-semibold">Rango de Años</label>
                            <input
                                type="text"
                                value={criteriaYears}
                                onChange={(e) => setCriteriaYears(e.target.value)}
                                className="form-control bg-black text-white border-secondary"
                            />
                        </div>

                        <div className="d-flex justify-content-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCriteriaModal(false)}
                                className="ml-btn ml-btn-acento ml-btn-sm"
                            >
                                Guardar Criterios
                            </button>
                        </div>
                    </div>
                </Dialogo>

                {/* Modal Agendar Próxima Sesión */}
                <Dialogo
                    abierto={showScheduleModal}
                    onCerrar={() => setShowScheduleModal(false)}
                    etiqueta="Agendar Próxima Sesión"
                    ancho={460}
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            scheduleSession(scheduleDate || null, scheduleNotes)
                            setShowScheduleModal(false)
                        }}
                    >
                        <div className="p-4 d-flex flex-column gap-3">
                            <div>
                                <h3 className="h6 fw-bold text-white mb-1">Agendar Próxima Reunión</h3>
                                <p className="small mb-0" style={{ color: 'var(--wp-text-muted)' }}>
                                    Acuerden fecha, hora y notas para la próxima sesión de anime.
                                </p>
                            </div>

                            <div>
                                <label className="form-label small text-white fw-semibold">Fecha y Hora</label>
                                <input
                                    type="datetime-local"
                                    value={scheduleDate}
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="form-control bg-black text-white border-secondary"
                                />
                            </div>

                            <div>
                                <label className="form-label small text-white fw-semibold">Notas / Plataforma</label>
                                <textarea
                                    rows={3}
                                    value={scheduleNotes}
                                    onChange={(e) => setScheduleNotes(e.target.value)}
                                    placeholder="Ej: Nos vemos en Discord a las 21:00 hs. Veremos capítulos 4 y 5."
                                    className="form-control bg-black text-white border-secondary"
                                />
                            </div>

                            <div className="d-flex justify-content-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowScheduleModal(false)}
                                    className="ml-btn ml-btn-fantasma ml-btn-sm"
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="ml-btn ml-btn-acento ml-btn-sm">
                                    Agendar Sesión
                                </button>
                            </div>
                        </div>
                    </form>
                </Dialogo>
            </div>
        </div>
    )
}

export default WatchPartyRoom
