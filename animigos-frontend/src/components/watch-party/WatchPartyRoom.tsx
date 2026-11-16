import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
    Users,
    Plus,
    Share2,
    Check,
    CheckCircle2,
    Clock,
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
    LogOut,
    Loader2,
    Crown,
    Search,
    Tv,
    Sparkles,
    Smile,
    Calendar,
    Star,
    Layers,
} from 'lucide-react'
import { useWatchParty } from '../../hooks/useWatchParty'
import {
    fetchAllRooms,
    fetchRoomByCode,
    createRoomApi,
    joinRoomApi,
    selectWinningAnimeApi,
    type RoomSummary,
    type RoomMember,
} from '../../services/watchPartyApi'
import { useAuth } from '../../context/AuthContext'
import { useCatalogSearch } from '../../hooks/useCatalog'
import type { ApiAnimeData } from '../../services/userListApi'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { Dialogo } from '../mi-lista/piezas'
import '../mi-lista/mi-lista.css'
import './watch-party.css'

const QUICK_EMOJIS = ['🍿', '🎉', '🔥', '👏', '😱', '❤️']

/** Decodifica nombres codificados en URL (ej: "M.+Falc%C3%B3n" -> "M. Falcón") */
function cleanUserName(name: string): string {
    if (!name) return 'Invitado'
    try {
        return decodeURIComponent(name.replace(/\+/g, ' '))
    } catch {
        return name.replace(/\+/g, ' ')
    }
}

export const WatchPartyRoom: React.FC = () => {
    const { acento } = useThemeAccent()
    const { user } = useAuth()
    const rawUserName = user?.display_name || user?.username || 'Invitado'
    const userName = cleanUserName(rawUserName)
    const userToken = user ? `user_${user.id}` : 'guest_anon'

    // Estado de vista: 'dashboard' o 'sala'
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [roomsList, setRoomsList] = useState<RoomSummary[]>([])
    const [isLoadingRooms, setIsLoadingRooms] = useState(false)

    // Búsqueda / unirse por código de lista grupal
    const [searchCodeInput, setSearchCodeInput] = useState('')
    const [searchCodeError, setSearchCodeError] = useState<string | null>(null)
    const [isSearchingCode, setIsSearchingCode] = useState(false)

    // Sub-vistas dentro de la sala
    const [roomTab, setRoomTab] = useState<'sesion' | 'votacion' | 'analisis' | 'chat'>('sesion')
    const [chartMode, setChartMode] = useState<'matriz' | 'apilado'>('matriz')

    // Valores locales de sliders de votación por candidato
    const [localVotes, setLocalVotes] = useState<Record<string, number>>({})
    const [voteFeedback, setVoteFeedback] = useState<string | null>(null)

    // Miembro seleccionado para ver su tarjeta de usuario (popover/modal)
    const [selectedMemberCard, setSelectedMemberCard] = useState<RoomMember | null>(null)

    // Adaptabilidad a series en emisión: episodios emitidos disponibles
    const [airingEpisodesAvailable, setAiringEpisodesAvailable] = useState<number | null>(null)

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

    // Cargar listas al iniciar o al cambiar el usuario/token
    useEffect(() => {
        loadRooms()
    }, [userToken])

    // Soporte de navegación por hash: #sala/<codigo> o #sala / #listas
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash
            const match = hash.match(/sala[=/]([a-zA-Z0-9_-]+)/i)
            const initialCode = match ? match[1] : ''

            if (initialCode) {
                handleOpenByCode(initialCode)
            } else if (hash === '#sala' || hash === '#listas' || hash === '#votacion') {
                setSelectedRoomId(null)
            }
        }

        handleHashChange()
        window.addEventListener('hashchange', handleHashChange)
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [])

    const loadRooms = async () => {
        setIsLoadingRooms(true)
        try {
            const rooms = await fetchAllRooms(userToken)
            setRoomsList(rooms)
        } catch (e) {
            console.error('Error cargando listas grupales:', e)
        } finally {
            setIsLoadingRooms(false)
        }
    }

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoomName.trim()) return

        try {
            const created = await createRoomApi({
                name: newRoomName.trim(),
                description: newRoomDesc.trim(),
                creator_name: userName,
                guest_token: userToken,
            })
            setRoomsList((prev) => [created, ...prev])
            setSelectedRoomId(created.id)
            setShowCreateModal(false)
            setNewRoomName('')
            setNewRoomDesc('')
            window.location.hash = `#sala/${created.invite_code}`
        } catch (e) {
            console.error('Error creando lista grupal:', e)
        }
    }

    const handleOpenByCode = async (code: string) => {
        try {
            const found = await fetchRoomByCode(code)
            if (found) {
                setSelectedRoomId(found.id)
            }
        } catch (e) {
            console.error('Error buscando sala por código hash:', e)
        }
    }

    const handleSearchOrJoinByCode = async (e: React.FormEvent) => {
        e.preventDefault()
        const cleanCode = searchCodeInput.trim().toUpperCase()
        if (!cleanCode) return

        setIsSearchingCode(true)
        setSearchCodeError(null)

        try {
            const joined = await joinRoomApi(cleanCode, userName, userToken)
            if (joined) {
                setSelectedRoomId(joined.id)
                window.location.hash = `#sala/${joined.invite_code}`
                setSearchCodeInput('')
                loadRooms()
            } else {
                setSearchCodeError('No encontramos una lista grupal con ese código.')
            }
        } catch (err: any) {
            setSearchCodeError(err.message || 'Código de lista inválido o no encontrado.')
        } finally {
            setIsSearchingCode(false)
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

    // Sincronizar votos del usuario en mapa local
    useEffect(() => {
        if (room?.candidates) {
            const initialMap: Record<string, number> = {}
            room.candidates.forEach((cand) => {
                const existingVote = cand.votes?.find(
                    (v) => cleanUserName(v.voter_name || (v as any).guest_name) === userName
                )
                initialMap[cand.id] = existingVote
                    ? (existingVote.interest_score ?? (existingVote as any).score ?? 5)
                    : 5
            })
            setLocalVotes(initialMap)
        }
    }, [room?.candidates, userName])

    // Scroll automático del chat interno
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

    // Búsqueda en catálogo para nominación
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

    const handleVoteScoreChange = (candidateId: string, score: number) => {
        setLocalVotes((prev) => ({ ...prev, [candidateId]: score }))
        voteCandidate(candidateId, score)
        setVoteFeedback(`¡Nota ${score.toFixed(1)} guardada!`)
        setTimeout(() => setVoteFeedback(null), 2000)
    }

    // Candidatos ordenados por mayor agrado grupal
    const candidates = useMemo(() => {
        if (!room?.candidates) return []
        return [...room.candidates].sort((a, b) => {
            const scoreA = a.happiness_result?.final_score ?? a.avg_interest ?? 0
            const scoreB = b.happiness_result?.final_score ?? b.avg_interest ?? 0
            return scoreB - scoreA
        })
    }, [room?.candidates])

    const topCandidate = candidates[0] || null

    // Anime seleccionado o primer candidato para la sesión de maratón
    const activeMarathonAnime = useMemo(() => {
        if ((room as any)?.winning_anime) {
            return (room as any).winning_anime
        }
        if (room?.selected_anime) {
            return room.selected_anime
        }
        if (topCandidate) {
            return {
                title: topCandidate.title,
                image_url: topCandidate.image_url,
                episodes: topCandidate.episodes || 24,
                score: topCandidate.score || 8.5,
            }
        }
        return null
    }, [room, topCandidate])

    const totalMembers = room?.members?.length || 1

    // Miembros de la sala ordenados
    const roomMembers = useMemo(() => {
        if (!room?.members) return []
        return [...room.members].map((m) => ({
            ...m,
            cleanName: cleanUserName(m.guest_name),
        }))
    }, [room?.members])

    // Sintonía y quórum amigables
    const dispersionDesc = useMemo(() => {
        if (!candidates.length) return 'Sin votos aún'
        const dispersions = candidates
            .map((c) => c.happiness_result?.interest_dispersion ?? 0)
            .filter((d) => d > 0)
        const avg = dispersions.length ? dispersions.reduce((a, b) => a + b, 0) / dispersions.length : 0.8

        if (avg <= 1.0) return 'Alta sintonía'
        if (avg <= 1.8) return 'Gustos divididos'
        return 'Dispersión alta'
    }, [candidates])

    const quorumDesc = useMemo(() => {
        if (!room?.members?.length || !candidates.length) return 'Todo listo'
        const totalExpected = room.members.length * candidates.length
        let totalVotes = 0
        candidates.forEach((c) => {
            totalVotes += c.votes?.length || 0
        })
        const pct = Math.min(100, Math.round((totalVotes / Math.max(1, totalExpected)) * 100))

        if (pct >= 80) return '100% quórum'
        if (pct >= 40) return `${pct}% votado`
        return `${pct}% quórum`
    }, [room?.members, candidates])

    const myWatched = useMemo(() => {
        const member = room?.members?.find((m) => cleanUserName(m.guest_name) === userName)
        return member?.episodes_watched || 0
    }, [room?.members, userName])

    const groupTarget = (room as any)?.target_episode || room?.current_episode || 1
    const totalEpisodesRaw = activeMarathonAnime?.episodes || 24
    
    // Si la serie está en emisión, los capítulos disponibles pueden variar semana a semana
    const totalEpisodes = airingEpisodesAvailable !== null ? airingEpisodesAvailable : Math.min(totalEpisodesRaw, 24)

    // Miembros que faltan por ponerse al día
    const cleanCatchupMembers = useMemo(() => {
        if (!room?.catchup_members) return []
        return room.catchup_members.map((cm) => ({
            ...cm,
            guest_name: cleanUserName(cm.guest_name),
        }))
    }, [room?.catchup_members])

    // ==============================================================
    // VISTA 1: DASHBOARD / LOBBY (CUANDO NO HAY SALA SELECCIONADA)
    // ==============================================================
    if (!selectedRoomId) {
        return (
            <div
                className="wp-root py-4 px-3 px-md-5"
                style={{ '--wp-acento': acento, '--ml-acento': acento } as React.CSSProperties}
            >
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <header className="wp-lobby-header">
                        <div>
                            <span className="ml-eyebrow d-flex align-items-center gap-1.5 mb-1.5">
                                <Users size={14} />
                                <span>COORDINACIÓN GRUPAL · WATCH PARTY</span>
                            </span>
                            <h1 className="ml-titulo mt-1 mb-2">Listas Grupales</h1>
                            <p className="ml-sub mb-0" style={{ maxWidth: '640px' }}>
                                Organiza qué ver con tus amigos. Postulen candidatos, comparen notas por usuario en tiempo real y sigan la maratón juntos sin discusiones.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="ml-btn ml-btn-acento d-flex align-items-center gap-2"
                        >
                            <Plus size={16} />
                            <span>Crear Lista Grupal</span>
                        </button>
                    </header>

                    {/* Barra de Búsqueda / Código */}
                    <form onSubmit={handleSearchOrJoinByCode} className="wp-join-bar">
                        <div className="d-flex align-items-center gap-2.5 flex-grow-1 px-3">
                            <Search size={16} style={{ color: 'var(--wp-text-dim)' }} />
                            <input
                                type="text"
                                className="bg-transparent border-0 text-white w-100"
                                style={{ outline: 'none', fontSize: '0.9rem' }}
                                placeholder="Buscar o unirte mediante código de sala (ej: 83B80802)..."
                                value={searchCodeInput}
                                onChange={(e) => setSearchCodeInput(e.target.value.toUpperCase())}
                                maxLength={16}
                            />
                        </div>
                        <button
                            type="submit"
                            className="ml-btn ml-btn-acento text-nowrap d-flex align-items-center gap-2"
                            disabled={!searchCodeInput.trim() || isSearchingCode}
                        >
                            {isSearchingCode ? (
                                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Search size={15} />
                            )}
                            <span>Unirse a la Lista</span>
                        </button>
                    </form>
                    {searchCodeError && (
                        <div className="small text-danger mb-3 d-flex align-items-center gap-2 px-1">
                            <ShieldAlert size={14} />
                            <span>{searchCodeError}</span>
                        </div>
                    )}

                    {/* Grilla de Salas */}
                    {isLoadingRooms ? (
                        <div className="text-center py-5">
                            <Loader2 size={30} className="text-secondary mb-2" style={{ animation: 'spin 1s linear infinite' }} />
                            <p className="small text-secondary">Cargando tus listas grupales...</p>
                        </div>
                    ) : roomsList.length === 0 ? (
                        <div
                            className="text-center py-5 p-4 rounded-4"
                            style={{
                                background: 'var(--wp-surface)',
                                border: '1px dashed var(--wp-border)',
                                borderRadius: 'var(--wp-radio-lg)',
                            }}
                        >
                            <Users size={40} className="mb-3 text-secondary opacity-50" />
                            <h3 className="h6 fw-bold text-white mb-2">No tienes listas grupales activas</h3>
                            <p className="small mb-4 text-secondary" style={{ maxWidth: '440px', margin: '0 auto' }}>
                                Crea un grupo para que todos voten animes y sintonicen sus maratones semanales sin discusiones.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="ml-btn ml-btn-acento d-flex align-items-center gap-2 mx-auto"
                            >
                                <Plus size={16} />
                                <span>Crear mi primera lista</span>
                            </button>
                        </div>
                    ) : (
                        <div className="wp-rooms-grid">
                            {roomsList.map((r) => {
                                const statusLabel =
                                    r.status === 'voting'
                                        ? 'Votación abierta'
                                        : r.status === 'candidates'
                                            ? 'Postulación'
                                            : r.status === 'watching'
                                                ? 'Viendo en grupo'
                                                : 'Completado'

                                return (
                                    <div key={r.id} className="wp-room-card">
                                        <div>
                                            <div className="d-flex justify-content-between align-items-center mb-2.5">
                                                <span className="wp-pill-badge is-live">
                                                    <Radio size={11} />
                                                    <span>{statusLabel}</span>
                                                </span>
                                                <span className="small text-secondary d-flex align-items-center gap-1.5">
                                                    <Users size={13} />
                                                    <span>{r.members?.length || r.members_count || 1} amigos</span>
                                                </span>
                                            </div>

                                            <h3 className="h6 fw-bold text-white mb-1.5">{r.name}</h3>
                                            <p className="small text-secondary mb-3 text-truncate" style={{ fontSize: '0.85rem' }}>
                                                {r.description || 'Grupo para maratón y coordinación de anime.'}
                                            </p>
                                        </div>

                                        <div>
                                            <div
                                                className="d-flex justify-content-between align-items-center mb-3 pt-2.5 border-top"
                                                style={{ borderColor: 'var(--wp-border)' }}
                                            >
                                                <span className="small font-mono text-white fw-bold" style={{ letterSpacing: '0.05em' }}>
                                                    CÓDIGO: {r.invite_code}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCopy(r.invite_code, e)}
                                                    className="ml-btn ml-btn-fantasma ml-btn-sm d-flex align-items-center gap-1.5"
                                                    style={{ fontSize: '0.75rem' }}
                                                >
                                                    {copiedCode === r.invite_code ? <Check size={12} className="text-success" /> : <Share2 size={12} />}
                                                    <span>{copiedCode === r.invite_code ? 'Copiado' : 'Copiar enlace'}</span>
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRoomId(r.id)
                                                    window.location.hash = `#sala/${r.invite_code}`
                                                }}
                                                className="ml-btn ml-btn-acento w-100 justify-content-center d-flex align-items-center gap-2"
                                            >
                                                <span>Entrar a la Sala</span>
                                                <span>→</span>
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Crear Sala */}
                <Dialogo
                    abierto={showCreateModal}
                    onCerrar={() => setShowCreateModal(false)}
                    etiqueta="Crear Nueva Lista Grupal"
                    ancho={480}
                >
                    <form onSubmit={handleCreateRoom} className="p-4 d-flex flex-column gap-3.5">
                        <div>
                            <h3 className="h6 fw-bold text-white mb-1">Crear Nueva Lista Grupal</h3>
                            <p className="small text-secondary mb-0">
                                Una sala privada donde tus amigos pueden sugerir animes y votarlos en tiempo real.
                            </p>
                        </div>

                        <div>
                            <label className="form-label small fw-semibold text-white mb-1">Nombre del Grupo / Maratón</label>
                            <input
                                type="text"
                                placeholder="Ej: Anime de los Viernes 🍿"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                className="form-control text-white"
                                style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                                required
                            />
                        </div>

                        <div>
                            <label className="form-label small fw-semibold text-white mb-1">Objetivo o Notas (Opcional)</label>
                            <textarea
                                rows={2}
                                placeholder="Ej: Buscamos un Shonen o Seinen de 12 a 24 episodios."
                                value={newRoomDesc}
                                onChange={(e) => setNewRoomDesc(e.target.value)}
                                className="form-control text-white"
                                style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                            />
                        </div>

                        <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
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
    // VISTA 2: SALA FIT Y FLUIDA (SIN SCROLL DOBLE + SUB-VISTAS)
    // ==============================================================
    return (
        <div
            className="wp-root px-3 px-md-4 py-3"
            style={{ '--wp-acento': acento, '--ml-acento': acento } as React.CSSProperties}
        >
            <div className="wp-viewport-room">
                {/* 1. Cabecera Redondeada y Limpia */}
                <header className="wp-room-header">
                    <div className="wp-room-header-left">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedRoomId(null)
                                window.location.hash = '#listas'
                            }}
                            className="ml-btn ml-btn-fantasma ml-btn-sm d-flex align-items-center gap-1.5"
                            title="Volver a listas"
                        >
                            <ChevronLeft size={16} />
                            <span>Listas</span>
                        </button>

                        <h1 className="wp-room-title">{room?.name || 'Lista Grupal'}</h1>

                        <span className="wp-pill-badge is-live">
                            <Radio size={11} className={connectionStatus === 'connected' ? 'text-success' : 'text-warning'} />
                            <span>{connectionStatus === 'connected' ? `En vivo (${latencyMs ?? 15}ms)` : 'Reconectando'}</span>
                        </span>

                        <span className="wp-pill-badge">
                            <Users size={12} />
                            <span>{totalMembers} amigos</span>
                        </span>
                    </div>

                    <div className="wp-room-header-actions">
                        <button
                            type="button"
                            onClick={() => setShowNominateModal(true)}
                            className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5"
                        >
                            <Plus size={14} />
                            <span>Postular Anime</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowCriteriaModal(true)}
                            className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                            title="Criterios del Grupo"
                        >
                            <SlidersHorizontal size={13} />
                            <span>Criterios</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleCopy(room?.invite_code || '')}
                            className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                            title="Copiar enlace de invitación"
                        >
                            <Share2 size={13} />
                            <span>{copiedCode === room?.invite_code ? 'Copiado' : room?.invite_code || 'Invitar'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedRoomId(null)
                                window.location.hash = '#listas'
                            }}
                            className="ml-btn ml-btn-fantasma ml-btn-sm text-danger"
                            title="Salir de la sala"
                        >
                            <LogOut size={13} />
                        </button>
                    </div>
                </header>

                {/* 2. Cinta de KPIs Interactivos (Conducen reactivamente a la subvista especializada) */}
                <div className="wp-kpi-strip" role="region" aria-label="Resumen de la lista grupal">
                    <button
                        type="button"
                        onClick={() => setRoomTab('votacion')}
                        className="wp-kpi-pill is-gold"
                        title="Ver detalles del anime candidato favorito"
                    >
                        <Trophy size={14} />
                        <span>Favorito:</span>
                        <strong>{topCandidate ? topCandidate.title : 'Por definir'}</strong>
                    </button>

                    <div className="wp-kpi-divider" />

                    <button
                        type="button"
                        onClick={() => setRoomTab('analisis')}
                        className="wp-kpi-pill is-accent"
                        title="Ver matriz de sintonía y dispersión de gustos"
                    >
                        <Target size={14} />
                        <span>Sintonía:</span>
                        <strong>{dispersionDesc}</strong>
                    </button>

                    <div className="wp-kpi-divider" />

                    <button
                        type="button"
                        onClick={() => setRoomTab('votacion')}
                        className="wp-kpi-pill is-success"
                        title="Ver quórum y votos emitidos por usuario"
                    >
                        <Sparkles size={14} />
                        <span>Quórum:</span>
                        <strong>{quorumDesc}</strong>
                    </button>

                    <div className="wp-kpi-divider" />

                    <button
                        type="button"
                        onClick={() => {
                            if (roomMembers.length > 0) setSelectedMemberCard(roomMembers[0])
                        }}
                        className="wp-kpi-pill"
                        title="Ver tarjeta de integrantes de la sala"
                    >
                        <Users size={14} />
                        <span>Grupo:</span>
                        <strong>{totalMembers} amigos</strong>
                    </button>

                    <div className="wp-kpi-divider" />

                    <button
                        type="button"
                        onClick={() => setRoomTab('sesion')}
                        className="wp-kpi-pill"
                        title="Ir a Sesión Tracker para ver avance de maratón"
                    >
                        <Tv size={14} style={{ color: '#60a5fa' }} />
                        <span>Meta de Maratón:</span>
                        <strong>Capítulo {groupTarget} de {totalEpisodes}</strong>
                    </button>
                </div>

                {/* Feedback Toast de Votación */}
                {voteFeedback && (
                    <div
                        className="py-1.5 px-3 rounded-pill text-center mx-auto small fw-bold"
                        style={{
                            background: 'rgba(52, 211, 153, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            animation: 'wp-fade-in 0.2s ease',
                        }}
                    >
                        {voteFeedback}
                    </div>
                )}

                {/* 3. Barra de Sub-vistas (Redondeadas y Cómodas) */}
                <div className="wp-subview-nav">
                    <div className="wp-tabs">
                        <button
                            type="button"
                            className={`wp-tab ${roomTab === 'sesion' ? 'active' : ''}`}
                            aria-selected={roomTab === 'sesion'}
                            onClick={() => setRoomTab('sesion')}
                        >
                            <Target size={14} />
                            <span>Sesión & Tracker</span>
                        </button>

                        <button
                            type="button"
                            className={`wp-tab ${roomTab === 'votacion' ? 'active' : ''}`}
                            aria-selected={roomTab === 'votacion'}
                            onClick={() => setRoomTab('votacion')}
                        >
                            <List size={14} />
                            <span>Votación de Animes</span>
                            <span className="wp-tab-badge">{candidates.length}</span>
                        </button>

                        <button
                            type="button"
                            className={`wp-tab ${roomTab === 'analisis' ? 'active' : ''}`}
                            aria-selected={roomTab === 'analisis'}
                            onClick={() => setRoomTab('analisis')}
                        >
                            <BarChart3 size={14} />
                            <span>Matriz de Decisión</span>
                        </button>

                        <button
                            type="button"
                            className={`wp-tab ${roomTab === 'chat' ? 'active' : ''}`}
                            aria-selected={roomTab === 'chat'}
                            onClick={() => setRoomTab('chat')}
                        >
                            <MessageSquare size={14} />
                            <span>Chat en Vivo</span>
                            {chatMessages.length > 0 && (
                                <span className="wp-tab-badge">{chatMessages.length}</span>
                            )}
                        </button>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {roomTab === 'sesion' && (
                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                            >
                                <Calendar size={13} />
                                <span>Agendar Sesión</span>
                            </button>
                        )}
                        {roomTab === 'votacion' && (
                            <button
                                type="button"
                                onClick={() => setShowNominateModal(true)}
                                className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5"
                            >
                                <Plus size={13} />
                                <span>Postular Anime</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 4. Panel de Sub-vista Activa */}
                <div className="wp-subview-pane">
                    {/* ==============================================================
                        SUB-VISTA 1: SESIÓN & TRACKER (LÍNEA DE TIEMPO CON HITOS)
                       ============================================================== */}
                    {roomTab === 'sesion' && (
                        <div className="wp-tracker-unified-card">
                            {/* Hero Banner del Anime en Maratón */}
                            {activeMarathonAnime ? (
                                <div className="wp-marathon-header-banner">
                                    <img
                                        src={activeMarathonAnime.image_url}
                                        alt={activeMarathonAnime.title}
                                        className="wp-marathon-poster-thumb"
                                    />
                                    <div className="wp-marathon-meta-block">
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className="small text-secondary fw-semibold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                                                Anime en Maratón Grupal
                                            </span>
                                            <span className="wp-pill-badge is-live" style={{ fontSize: '0.7rem' }}>
                                                <Tv size={11} />
                                                <span>Meta actual: Cap {groupTarget} de {totalEpisodes}</span>
                                            </span>
                                        </div>
                                        <h2 className="h5 fw-bold text-white mb-1">{activeMarathonAnime.title}</h2>
                                        <div className="d-flex align-items-center gap-3 text-secondary small font-mono">
                                            <span className="d-flex align-items-center gap-1 text-warning">
                                                <Star size={13} /> {activeMarathonAnime.score || '8.5'}
                                            </span>
                                            <span>·</span>
                                            <span>{totalEpisodesRaw} capítulos estimados</span>
                                            {airingEpisodesAvailable !== null && (
                                                <>
                                                    <span>·</span>
                                                    <span className="text-info">🟢 En emisión: {airingEpisodesAvailable} emitidos</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Acciones de progreso y meta */}
                                    <div className="wp-marathon-controls ms-auto">
                                        <button
                                            type="button"
                                            onClick={() => updateMyProgress(myWatched + 1)}
                                            className="wp-btn-catchup d-flex align-items-center gap-1.5"
                                        >
                                            <Plus size={15} />
                                            <span>¡Vi el Cap {myWatched + 1}!</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setGroupTarget(groupTarget + 1)}
                                            className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                                            title="Avanzar la meta de maratón del grupo al siguiente episodio"
                                        >
                                            <span>Avanzar Meta (+1)</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="p-4 text-center rounded-4"
                                    style={{ background: 'var(--wp-surface-2)', border: '1px dashed var(--wp-border)' }}
                                >
                                    <Tv size={32} className="text-secondary opacity-50 mb-2" />
                                    <h3 className="h6 fw-bold text-white mb-1">No hay anime seleccionado para la maratón</h3>
                                    <p className="small text-secondary mb-3">Voten por sus candidatos para coronar al ganador de la sala.</p>
                                    <button
                                        type="button"
                                        onClick={() => setRoomTab('votacion')}
                                        className="ml-btn ml-btn-acento ml-btn-sm"
                                    >
                                        Ir a Votación de Animes →
                                    </button>
                                </div>
                            )}

                            {/* Línea de Tiempo de Capítulos como Hitos */}
                            <div className="wp-timeline-box">
                                <div className="wp-timeline-header">
                                    <div className="d-flex align-items-center gap-2">
                                        <Layers size={16} style={{ color: 'var(--wp-acento)' }} />
                                        <span className="fw-bold text-white small">Línea de Tiempo de Capítulos</span>
                                        <span className="small text-secondary font-mono">
                                            (Haz click en un capítulo para sincronizar tu avance)
                                        </span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        {/* Adaptabilidad a series en emisión */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = (airingEpisodesAvailable ?? totalEpisodes) + 1
                                                setAiringEpisodesAvailable(next)
                                            }}
                                            className="ml-btn ml-btn-fantasma ml-btn-sm d-flex align-items-center gap-1"
                                            title="Si la serie está en emisión, agrega el capítulo estrenado esta semana"
                                        >
                                            <Plus size={12} />
                                            <span>+ Sumar capítulo emitido esta semana</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Pista Horizontal de Hitos con Avatares */}
                                <div className="wp-timeline-scroll">
                                    <div className="wp-timeline-track">
                                        {/* Barra conectora con progreso visual */}
                                        <div className="wp-timeline-line">
                                            <div
                                                className="wp-timeline-line-progress"
                                                style={{
                                                    width: `${Math.min(100, (Math.max(groupTarget, myWatched) / Math.max(1, totalEpisodes)) * 100)}%`,
                                                }}
                                            />
                                        </div>

                                        {/* Hito Cap 0 / Inicio */}
                                        <div
                                            className="wp-timeline-milestone"
                                            onClick={() => updateMyProgress(0)}
                                            title="Punto de partida (Capítulo 0)"
                                        >
                                            {/* Usuarios que aún no inician */}
                                            {roomMembers.filter((m) => m.episodes_watched === 0).length > 0 && (
                                                <div className="wp-milestone-users-stack">
                                                    {roomMembers
                                                        .filter((m) => m.episodes_watched === 0)
                                                        .map((m) => (
                                                            <div
                                                                key={m.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setSelectedMemberCard(m)
                                                                }}
                                                                className={`wp-milestone-user-pin ${m.cleanName === userName ? 'is-mine' : ''} ${m.sync_status === 'atrasado' ? 'is-behind' : ''}`}
                                                                title={`${m.cleanName} (Inicio / 0 eps)`}
                                                            >
                                                                {m.cleanName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                            <div className={`wp-milestone-node ${myWatched >= 0 ? 'is-watched' : ''}`}>
                                                0
                                            </div>
                                            <span className="wp-milestone-label">Inicio</span>
                                        </div>

                                        {/* Hitos para cada capítulo disponible */}
                                        {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
                                            const isWatchedByMe = myWatched >= ep
                                            const isTarget = groupTarget === ep
                                            const isFuture = ep > (airingEpisodesAvailable ?? totalEpisodesRaw)

                                            // Usuarios posicionados exactamente en este capítulo
                                            const usersAtThisEp = roomMembers.filter((m) => m.episodes_watched === ep)

                                            return (
                                                <div
                                                    key={ep}
                                                    className={`wp-timeline-milestone ${isTarget ? 'is-active' : ''}`}
                                                    onClick={() => !isFuture && updateMyProgress(ep)}
                                                    title={`Capítulo ${ep}${isTarget ? ' (Meta actual del grupo)' : ''}`}
                                                >
                                                    {/* Avatares de los usuarios sobre este hito */}
                                                    {usersAtThisEp.length > 0 && (
                                                        <div className="wp-milestone-users-stack">
                                                            {usersAtThisEp.map((m) => {
                                                                const isBehind = m.episodes_watched < groupTarget
                                                                const isMine = m.cleanName === userName
                                                                return (
                                                                    <div
                                                                        key={m.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setSelectedMemberCard(m)
                                                                        }}
                                                                        className={`wp-milestone-user-pin ${isMine ? 'is-mine' : ''} ${isBehind ? 'is-behind' : ''}`}
                                                                        title={`${m.cleanName} está en el Cap ${ep}${isBehind ? ' (Atrasado)' : ' (Al día)'}`}
                                                                    >
                                                                        {m.cleanName.slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Nodo del Hito */}
                                                    <div
                                                        className={`wp-milestone-node ${isWatchedByMe ? 'is-watched' : ''} ${isTarget ? 'is-target' : ''} ${isFuture ? 'is-future' : ''}`}
                                                    >
                                                        {isWatchedByMe && !isTarget ? <Check size={14} /> : ep}
                                                    </div>

                                                    <span className="wp-milestone-label">
                                                        {isTarget ? `🎯 Meta ${ep}` : `Cap ${ep}`}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Banner de Sintonía Grupal */}
                                <div className="d-flex align-items-center justify-content-between p-3 rounded-3" style={{ background: 'var(--wp-surface-3)', border: '1px solid var(--wp-border)' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        {cleanCatchupMembers.length > 0 ? (
                                            <>
                                                <Clock size={16} className="text-warning flex-shrink-0" />
                                                <span className="small text-warning">
                                                    Poniéndose al día con la meta (Cap {groupTarget}):{' '}
                                                    <strong>
                                                        {cleanCatchupMembers.map((c) => `${c.guest_name} (-${c.episodes_behind})`).join(', ')}
                                                    </strong>
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                                                <span className="small text-success fw-semibold">
                                                    ✨ ¡Todos los amigos están sincronizados con la meta actual!
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        <span className="small text-secondary">
                                            Tu avance: <strong>Cap {myWatched}</strong> de {totalEpisodes}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==============================================================
                        SUB-VISTA 2: VOTACIÓN DE ANIMES (TABLA FILAS POR ANIME Y COLUMNAS POR USUARIO)
                       ============================================================== */}
                    {roomTab === 'votacion' && (
                        <div className="wp-voting-matrix-card">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div>
                                    <h3 className="h6 fw-bold text-white mb-0.5">Matriz Comparativa de Votos</h3>
                                    <p className="small text-secondary mb-0">
                                        Cada columna representa a un integrante. Pasa el cursor o haz click sobre un icono para ver la tarjeta del usuario.
                                    </p>
                                </div>

                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowNominateModal(true)}
                                        className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        <span>Postular Anime</span>
                                    </button>
                                </div>
                            </div>

                            {candidates.length === 0 ? (
                                <div
                                    className="p-5 text-center rounded-4 my-auto"
                                    style={{ background: 'var(--wp-surface-2)', border: '1px dashed var(--wp-border)' }}
                                >
                                    <List size={36} className="text-secondary opacity-40 mb-2" />
                                    <p className="text-secondary mb-3">Aún no hay animes postulados en esta lista grupal.</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowNominateModal(true)}
                                        className="ml-btn ml-btn-acento d-flex align-items-center gap-1.5 mx-auto"
                                    >
                                        <Plus size={15} />
                                        <span>Postular el primer anime</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="wp-matrix-table-wrap">
                                    <table className="wp-matrix-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                                                <th>Anime Candidato</th>
                                                {/* Columna por cada Usuario de la sala */}
                                                {roomMembers.map((m) => (
                                                    <th key={m.id} style={{ width: '90px', textAlign: 'center' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedMemberCard(m)}
                                                            className="wp-user-th-btn"
                                                            title={`Click para ver perfil de ${m.cleanName} (${m.role})`}
                                                        >
                                                            <div className={`wp-user-avatar-circle ${m.role === 'owner' ? 'is-owner' : ''}`}>
                                                                {m.cleanName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                        </button>
                                                    </th>
                                                ))}
                                                <th style={{ width: '130px', textAlign: 'center' }}>Sintonía</th>
                                                <th style={{ width: '150px', textAlign: 'right' }}>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {candidates.map((cand, index) => {
                                                const rankNum = index + 1
                                                const happinessScore = cand.happiness_result?.final_score ?? cand.avg_interest ?? 10
                                                const dispersion = cand.happiness_result?.interest_dispersion ?? 0.8
                                                const isPolarized = dispersion >= 2.0
                                                const isConsensusWinner = rankNum === 1 && !isPolarized

                                                return (
                                                    <tr key={cand.id}>
                                                        {/* 1. Ranking */}
                                                        <td style={{ textAlign: 'center' }}>
                                                            {rankNum === 1 ? (
                                                                <Crown size={18} className="text-warning mx-auto" />
                                                            ) : (
                                                                <span className="font-mono text-secondary fw-bold">#{rankNum}</span>
                                                            )}
                                                        </td>

                                                        {/* 2. Anime */}
                                                        <td>
                                                            <div className="d-flex align-items-center gap-3">
                                                                <img
                                                                    src={cand.image_url}
                                                                    alt={cand.title}
                                                                    style={{
                                                                        width: '42px',
                                                                        height: '60px',
                                                                        objectFit: 'cover',
                                                                        borderRadius: '8px',
                                                                        border: '1px solid var(--wp-border)',
                                                                        flexShrink: 0,
                                                                    }}
                                                                />
                                                                <div className="overflow-hidden">
                                                                    <strong className="d-block text-white text-truncate" style={{ maxWidth: '280px' }}>
                                                                        {cand.title}
                                                                    </strong>
                                                                    <span className="small text-secondary font-mono d-block" style={{ fontSize: '0.75rem' }}>
                                                                        ★ {cand.score || '8.5'} · {cand.episodes || 24} eps · por {cleanUserName(cand.suggested_by)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* 3. Columna con la nota para cada usuario */}
                                                        {roomMembers.map((m) => {
                                                            const isMe = m.cleanName === userName
                                                            // Buscar voto de este usuario
                                                            const userVote = cand.votes?.find(
                                                                (v) => cleanUserName(v.voter_name || (v as any).guest_name) === m.cleanName
                                                            )
                                                            const score = isMe
                                                                ? (localVotes[cand.id] ?? userVote?.interest_score ?? null)
                                                                : userVote?.interest_score ?? null

                                                            const scoreClass =
                                                                score === null
                                                                    ? 'none'
                                                                    : score >= 8
                                                                        ? 'high'
                                                                        : score >= 6
                                                                            ? 'mid'
                                                                            : 'low'

                                                            return (
                                                                <td key={m.id} className="wp-vote-score-cell">
                                                                    {isMe ? (
                                                                        <div className="d-flex flex-column align-items-center gap-1">
                                                                            <input
                                                                                type="range"
                                                                                min={0}
                                                                                max={10}
                                                                                step={0.5}
                                                                                value={score ?? 5}
                                                                                onChange={(e) => handleVoteScoreChange(cand.id, parseFloat(e.target.value))}
                                                                                className="wp-slider"
                                                                                style={{ width: '64px', height: '4px' }}
                                                                                title="Ajusta tu nota para este anime"
                                                                            />
                                                                            <span className={`wp-score-badge ${scoreClass}`}>
                                                                                {score !== null ? score.toFixed(1).replace('.', ',') : '-'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span
                                                                            className={`wp-score-badge ${scoreClass}`}
                                                                            title={`${m.cleanName}: ${score !== null ? `${score} pts` : 'Aún no ha votado'}`}
                                                                        >
                                                                            {score !== null ? score.toFixed(1).replace('.', ',') : '-'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            )
                                                        })}

                                                        {/* 4. Sintonía Grupal */}
                                                        <td style={{ textAlign: 'center' }}>
                                                            <div className="d-flex flex-column align-items-center gap-1">
                                                                <strong className="h6 mb-0 text-white font-mono">
                                                                    {Number(happinessScore).toFixed(0)}%
                                                                </strong>
                                                                <span
                                                                    className={`wp-pill-badge ${isConsensusWinner ? 'is-live' : ''}`}
                                                                    style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}
                                                                >
                                                                    {isConsensusWinner ? '👑 Favorito' : isPolarized ? '⚡ Dividido' : 'En sintonía'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 5. Acción */}
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    if (room) {
                                                                        await selectWinningAnimeApi(room.id, cand.anime_id)
                                                                        setRoomTab('sesion')
                                                                    }
                                                                }}
                                                                className="ml-btn ml-btn-acento ml-btn-sm"
                                                                title="Seleccionar este anime como el oficial para la maratón grupal"
                                                            >
                                                                <span>Elegir</span>
                                                                <span>→</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==============================================================
                        SUB-VISTA 3: MATRIZ DE DECISIÓN (2D & APILADO)
                       ============================================================== */}
                    {roomTab === 'analisis' && (
                        <div className="wp-voting-matrix-card">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div>
                                    <h3 className="h6 fw-bold text-white mb-0.5">Mapa 2D de Gustos Grupales</h3>
                                    <span className="small text-secondary" style={{ fontSize: '0.8rem' }}>
                                        Eje horizontal: Sintonía de grupo · Eje vertical: Ganas de verlo
                                    </span>
                                </div>

                                <div className="d-flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setChartMode('matriz')}
                                        className={`ml-btn ml-btn-sm ${chartMode === 'matriz' ? 'ml-btn-acento' : 'ml-btn-fantasma'}`}
                                    >
                                        Mapa 2D
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartMode('apilado')}
                                        className={`ml-btn ml-btn-sm ${chartMode === 'apilado' ? 'ml-btn-acento' : 'ml-btn-fantasma'}`}
                                    >
                                        Lista Resumen
                                    </button>
                                </div>
                            </div>

                            {chartMode === 'matriz' ? (
                                <div
                                    className="position-relative rounded-4 p-4"
                                    style={{
                                        minHeight: '340px',
                                        background: 'var(--wp-surface-2)',
                                        border: '1px solid var(--wp-border)',
                                        borderRadius: 'var(--wp-radio)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div className="position-absolute top-0 start-0 m-3 small fw-bold text-success opacity-75">
                                        👑 GANADOR SEGURO (EN SINTONÍA)
                                    </div>
                                    <div className="position-absolute top-0 end-0 m-3 small fw-bold text-warning opacity-75">
                                        ⚡ AMOR U ODIO (DIVIDIDO)
                                    </div>
                                    <div className="position-absolute bottom-0 start-0 m-3 small fw-bold text-secondary opacity-75">
                                        💤 POCO INTERÉS
                                    </div>
                                    <div className="position-absolute bottom-0 end-0 m-3 small fw-bold text-info opacity-75">
                                        🎯 JOYA OCULTA
                                    </div>

                                    {/* Ejes */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '3%',
                                            right: '3%',
                                            height: '1px',
                                            background: 'var(--wp-border)',
                                        }}
                                    />
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: '5%',
                                            bottom: '5%',
                                            width: '1px',
                                            background: 'var(--wp-border)',
                                        }}
                                    />

                                    {candidates.map((cand, idx) => {
                                        const mean = cand.happiness_result?.interest_mean ?? cand.avg_interest ?? 7.5
                                        const disp = cand.happiness_result?.interest_dispersion ?? 1.2

                                        const yPercent = Math.max(16, Math.min(84, 100 - (mean / 10) * 100))
                                        const consensusVal = Math.max(0, 10 - disp * 2.5)
                                        const xPercent = Math.max(16, Math.min(84, (consensusVal / 10) * 100))

                                        return (
                                            <div
                                                key={cand.id}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${xPercent}%`,
                                                    top: `${yPercent}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    zIndex: 2,
                                                }}
                                                title={`${cand.title} — Interés ${mean.toFixed(1)} / 10`}
                                            >
                                                <img
                                                    src={cand.image_url}
                                                    alt={cand.title}
                                                    style={{
                                                        width: 36,
                                                        height: 50,
                                                        borderRadius: '6px',
                                                        border: idx === 0 ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.4)',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                                                    }}
                                                />
                                                <span className="d-block small text-white text-truncate mt-1" style={{ maxWidth: '80px', fontSize: '0.72rem' }}>
                                                    {cand.title}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {candidates.map((cand, idx) => {
                                        const mean = cand.happiness_result?.interest_mean ?? cand.avg_interest ?? 7.5
                                        return (
                                            <div
                                                key={cand.id}
                                                className="p-3 rounded-3 d-flex justify-content-between align-items-center"
                                                style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '14px' }}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <span className="fw-bold text-white font-mono">#{idx + 1}</span>
                                                    <img
                                                        src={cand.image_url}
                                                        alt={cand.title}
                                                        style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: '8px' }}
                                                    />
                                                    <div>
                                                        <strong className="text-white d-block">{cand.title}</strong>
                                                        <span className="small text-secondary">
                                                            {cand.votes?.length || 0} votos registrados
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="wp-pill-badge is-live">
                                                    Promedio: {mean.toFixed(1)} / 10
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==============================================================
                        SUB-VISTA 4: CHAT EN VIVO SOCIAL
                       ============================================================== */}
                    {roomTab === 'chat' && (
                        <div className="wp-voting-matrix-card position-relative overflow-hidden">
                            {/* Reacciones Flotantes Animadas */}
                            {floatingReactions.map((r) => (
                                <span
                                    key={r.id}
                                    style={{
                                        position: 'absolute',
                                        bottom: '70px',
                                        left: `${r.xPos}%`,
                                        fontSize: '1.6rem',
                                        pointerEvents: 'none',
                                        zIndex: 10,
                                        animation: 'wp-fade-in 1.5s ease-out forwards',
                                    }}
                                >
                                    {r.emoji}
                                </span>
                            ))}
                            <div className="d-flex align-items-center justify-content-between pb-2 border-bottom" style={{ borderColor: 'var(--wp-border)' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <MessageSquare size={16} style={{ color: 'var(--wp-acento)' }} />
                                    <span className="small fw-bold text-white">Chat en Tiempo Real</span>
                                    <span className="wp-pill-badge is-live" style={{ fontSize: '0.7rem' }}>
                                        {totalMembers} amigos en línea
                                    </span>
                                </div>

                                <span className="small text-secondary font-mono" style={{ fontSize: '0.75rem' }}>
                                    Libre de spoilers hasta Cap. {groupTarget}
                                </span>
                            </div>

                            {/* Stream de Mensajes */}
                            <div
                                ref={chatScrollRef}
                                className="d-flex flex-column gap-2 overflow-y-auto p-2"
                                style={{ maxHeight: '380px', minHeight: '260px' }}
                            >
                                {chatMessages.length === 0 ? (
                                    <div className="text-center my-auto small text-secondary">
                                        <Smile size={30} className="text-secondary opacity-40 mb-2" />
                                        <p className="mb-0">¡Sé el primero en enviar un mensaje para coordinar la maratón!</p>
                                    </div>
                                ) : (
                                    chatMessages.map((msg) => {
                                        const cleanSender = cleanUserName(msg.sender)
                                        const isMine = cleanSender === userName

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`p-2.5 rounded-3 d-flex flex-column ${
                                                    isMine ? 'align-self-end text-white' : 'align-self-start text-white'
                                                }`}
                                                style={{
                                                    maxWidth: '75%',
                                                    background: isMine ? 'var(--wp-surface-3)' : 'var(--wp-surface-2)',
                                                    border: '1px solid var(--wp-border)',
                                                    borderRadius: '14px',
                                                }}
                                            >
                                                <div className="small fw-bold text-secondary mb-0.5" style={{ fontSize: '0.72rem' }}>
                                                    {cleanSender}
                                                </div>
                                                <div style={{ fontSize: '0.88rem' }}>{msg.text}</div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Reacciones Rápidas */}
                            <div className="d-flex align-items-center gap-1.5 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
                                <span className="small text-secondary me-1" style={{ fontSize: '0.75rem' }}>Reacciones:</span>
                                {QUICK_EMOJIS.map((em) => (
                                    <button
                                        key={em}
                                        type="button"
                                        onClick={() => sendReaction(em)}
                                        className="ml-btn ml-btn-fantasma ml-btn-sm"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '1rem' }}
                                    >
                                        {em}
                                    </button>
                                ))}
                            </div>

                            {/* Input para Enviar */}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    if (chatInput.trim()) {
                                        sendChat(chatInput)
                                        setChatInput('')
                                    }
                                }}
                                className="d-flex align-items-center gap-2 mt-1"
                            >
                                <input
                                    type="text"
                                    placeholder="Escribe un mensaje para el grupo..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    className="form-control text-white"
                                    style={{
                                        background: 'var(--wp-surface-2)',
                                        border: '1px solid var(--wp-border)',
                                        borderRadius: 'var(--wp-radio-pill)',
                                    }}
                                />
                                <button type="submit" className="ml-btn ml-btn-acento rounded-circle p-2" title="Enviar">
                                    <Send size={15} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {/* ==============================================================
                MODALES Y TARJETA POPOVER DE USUARIO
               ============================================================== */}
            {/* Modal Tarjeta de Usuario (Al clickear un icono de usuario en la matriz) */}
            <Dialogo
                abierto={selectedMemberCard !== null}
                onCerrar={() => setSelectedMemberCard(null)}
                etiqueta="Perfil de Amigo en la Sala"
                ancho={420}
            >
                {selectedMemberCard && (
                    <div className="p-4 d-flex flex-column gap-3.5">
                        <div className="wp-user-popover-header">
                            <div className="wp-user-popover-avatar-lg">
                                {cleanUserName(selectedMemberCard.guest_name).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="h6 fw-bold text-white mb-0.5">
                                    {cleanUserName(selectedMemberCard.guest_name)}
                                </h3>
                                <span className="wp-pill-badge" style={{ fontSize: '0.72rem' }}>
                                    {selectedMemberCard.role === 'owner' ? '👑 Anfitrión' : '👤 Integrante'}
                                </span>
                            </div>
                        </div>

                        <div className="p-3 rounded-3" style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="small text-secondary">Progreso en la maratón:</span>
                                <strong className="text-white font-mono">
                                    Capítulo {selectedMemberCard.episodes_watched} de {totalEpisodes}
                                </strong>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="small text-secondary">Estado de sincronización:</span>
                                <span
                                    className="wp-pill-badge"
                                    style={{
                                        fontSize: '0.72rem',
                                        background:
                                            selectedMemberCard.episodes_watched >= groupTarget
                                                ? 'rgba(52, 211, 153, 0.12)'
                                                : 'rgba(251, 191, 36, 0.12)',
                                        color: selectedMemberCard.episodes_watched >= groupTarget ? '#34d399' : '#fbbf24',
                                        borderColor: selectedMemberCard.episodes_watched >= groupTarget ? '#34d399' : '#fbbf24',
                                    }}
                                >
                                    {selectedMemberCard.episodes_watched >= groupTarget
                                        ? '✨ Al día con la sala'
                                        : `⏳ Atrasado (-${groupTarget - selectedMemberCard.episodes_watched} caps)`}
                                </span>
                            </div>
                        </div>

                        <div className="d-flex justify-content-end pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedMemberCard(null)}
                                className="ml-btn ml-btn-acento ml-btn-sm"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )}
            </Dialogo>

            {/* Modal Postular Anime */}
            <Dialogo
                abierto={showNominateModal}
                onCerrar={() => setShowNominateModal(false)}
                etiqueta="Postular Anime a la Sala"
                ancho={500}
            >
                <div className="p-4 d-flex flex-column gap-3.5">
                    <div>
                        <h3 className="h6 fw-bold text-white mb-1">Postular Anime a la Lista</h3>
                        <p className="small text-secondary mb-0">
                            Busca un anime en el catálogo para sumarlo como fila de candidatos a votar.
                        </p>
                    </div>

                    <div className="position-relative">
                        <input
                            type="text"
                            placeholder="Buscar por título (ej: Frieren, Vinland)..."
                            value={nominateSearch}
                            onChange={(e) => setNominateSearch(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                        {isSearchingCatalog && (
                            <Loader2 size={16} className="position-absolute end-0 top-50 translate-middle-y me-3 text-secondary spinner-border-sm" />
                        )}
                    </div>

                    <div className="d-flex flex-column gap-2 overflow-y-auto" style={{ maxHeight: '280px' }}>
                        {catalogResults.map((anime: ApiAnimeData) => (
                            <div
                                key={anime.mal_id}
                                className="p-2.5 rounded-3 d-flex align-items-center justify-content-between gap-3"
                                style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '14px' }}
                            >
                                <div className="d-flex align-items-center gap-2.5 overflow-hidden">
                                    <img
                                        src={anime.image_url}
                                        alt={anime.title}
                                        style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                    <div className="overflow-hidden">
                                        <strong className="d-block text-white small text-truncate">{anime.title}</strong>
                                        <span className="small text-secondary font-mono" style={{ fontSize: '0.74rem' }}>
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
                etiqueta="Criterios Ideales"
                ancho={440}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <h3 className="h6 fw-bold text-white mb-1">Criterios de la Maratón</h3>
                        <p className="small text-secondary mb-0">
                            Filtros de referencia acordados para la votación de la sala.
                        </p>
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold mb-1">Duración de Capítulos</label>
                        <input
                            type="text"
                            value={criteriaDuration}
                            onChange={(e) => setCriteriaDuration(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold mb-1">Géneros Preferidos</label>
                        <input
                            type="text"
                            value={criteriaGenres}
                            onChange={(e) => setCriteriaGenres(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold mb-1">Rango de Años</label>
                        <input
                            type="text"
                            value={criteriaYears}
                            onChange={(e) => setCriteriaYears(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
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

            {/* Modal Agendar Sesión */}
            <Dialogo
                abierto={showScheduleModal}
                onCerrar={() => setShowScheduleModal(false)}
                etiqueta="Agendar Próxima Sesión"
                ancho={440}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        scheduleSession(scheduleDate || null, scheduleNotes)
                        setShowScheduleModal(false)
                    }}
                    className="p-4 d-flex flex-column gap-3"
                >
                    <div>
                        <h3 className="h6 fw-bold text-white mb-1">Agendar Próxima Sesión</h3>
                        <p className="small text-secondary mb-0">
                            Coordina día, hora y notas para ver los siguientes capítulos juntos.
                        </p>
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold mb-1">Fecha y Hora</label>
                        <input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold mb-1">Notas / Plataforma</label>
                        <textarea
                            rows={3}
                            value={scheduleNotes}
                            onChange={(e) => setScheduleNotes(e.target.value)}
                            placeholder="Ej: Nos conectamos por Discord a las 21:00 hs para ver capítulos 4 y 5."
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
                        <button
                            type="button"
                            onClick={() => setShowScheduleModal(false)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="ml-btn ml-btn-acento ml-btn-sm">
                            Guardar Sesión
                        </button>
                    </div>
                </form>
            </Dialogo>
        </div>
    )
}

export default WatchPartyRoom
