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
    ThumbsUp,
    CalendarPlus,
    LogOut,
    Loader2,
    Crown,
    Search,
    Tv,
    Sparkles,
    Smile,
} from 'lucide-react'
import { useWatchParty } from '../../hooks/useWatchParty'
import {
    fetchAllRooms,
    fetchRoomByCode,
    fetchRoomById,
    createRoomApi,
    joinRoomApi,
    selectWinningAnimeApi,
    type RoomSummary,
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
    const [roomTab, setRoomTab] = useState<'votacion' | 'analisis' | 'sesion' | 'chat'>('sesion')
    const [chartMode, setChartMode] = useState<'matriz' | 'apilado'>('matriz')

    // Valores locales de sliders de votación por candidato
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
            const data = await fetchAllRooms(userToken)
            setRoomsList(data)
        } catch (e) {
            console.error('Error cargando listas:', e)
        } finally {
            setIsLoadingRooms(false)
        }
    }

    const handleSearchOrJoinByCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        const code = searchCodeInput.trim().toUpperCase()
        if (!code) return
        setIsSearchingCode(true)
        setSearchCodeError(null)
        try {
            const room = await fetchRoomByCode(code)
            try {
                await joinRoomApi(room.id, userName, userToken)
            } catch (joinErr) {
                console.warn('Registro de membresía al unirse:', joinErr)
            }
            await loadRooms()
            setSearchCodeInput('')
            setSelectedRoomId(room.id)
            window.location.hash = `#sala/${room.invite_code}`
        } catch (err: any) {
            setSearchCodeError(err.message || 'No se encontró ninguna lista grupal con el código ingresado')
        } finally {
            setIsSearchingCode(false)
        }
    }

    const handleOpenByCode = async (code: string) => {
        try {
            const room = code.includes('-') ? await fetchRoomById(code) : await fetchRoomByCode(code)
            try {
                await joinRoomApi(room.id, userName, userToken)
            } catch (joinErr) {
                console.warn('Registro de membresía:', joinErr)
            }
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

    // Sincronizar votos del usuario en sliders locales
    useEffect(() => {
        if (room?.candidates) {
            const initialMap: Record<string, number> = {}
            room.candidates.forEach((cand) => {
                const existingVote = cand.votes?.find((v) => cleanUserName(v.voter_name || (v as any).guest_name) === userName)
                initialMap[cand.id] = existingVote ? (existingVote.interest_score ?? (existingVote as any).score ?? 5) : 5
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

    // ==============================================================
    // DESCRIPCIONES AMIGABLES (CERO VALORES TÉCNICOS INTERNOS)
    // ==============================================================
    const dispersionDesc = useMemo(() => {
        if (!candidates.length) return 'Comenzando votación'
        const dispersions = candidates
            .map((c) => c.happiness_result?.interest_dispersion ?? 0)
            .filter((d) => d > 0)
        const avg = dispersions.length ? dispersions.reduce((a, b) => a + b, 0) / dispersions.length : 0.8

        if (avg <= 1.0) return 'Mayoría en sintonía'
        if (avg <= 1.8) return 'Gustos divididos'
        return 'Alta dispersión de gustos'
    }, [candidates])

    const quorumDesc = useMemo(() => {
        if (!room?.members?.length || !candidates.length) return 'Todos al día'
        const totalExpected = room.members.length * candidates.length
        let totalVotes = 0
        candidates.forEach((c) => {
            totalVotes += c.votes?.length || 0
        })
        const pct = Math.min(100, Math.round((totalVotes / Math.max(1, totalExpected)) * 100))

        if (pct >= 80) return 'Participación total'
        if (pct >= 40) return 'Votación activa'
        return 'Baja participación'
    }, [room?.members, candidates])

    const myWatched = useMemo(() => {
        const member = room?.members?.find((m) => cleanUserName(m.guest_name) === userName)
        return member?.episodes_watched || 0
    }, [room?.members, userName])

    const groupTarget = (room as any)?.target_episode || room?.current_episode || 1
    const totalEpisodes = activeMarathonAnime?.episodes || 24
    const totalMembers = room?.members?.length || 1

    // Miembros que faltan por ponerse al día (con nombres decodificados)
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
                className="ml-root wp-root py-4 px-3 px-md-5"
                style={{ '--ml-acento': acento, '--wp-acento': acento } as React.CSSProperties}
            >
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <header className="wp-lobby-header">
                        <div>
                            <span className="ml-eyebrow">
                                <Users size={14} className="me-1" />
                                COORDINACIÓN GRUPAL · WATCH PARTY
                            </span>
                            <h1 className="ml-titulo mt-1 mb-1">Listas Grupales</h1>
                            <p className="ml-sub mb-0">
                                Organiza qué ver con tus amigos. Postulen candidatos, voten en sintonía y mantengan el ritmo de su maratón juntos.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="ml-btn ml-btn-acento"
                        >
                            <Plus size={16} />
                            <span>Crear Lista Grupal</span>
                        </button>
                    </header>

                    {/* Barra de Búsqueda / Código */}
                    <form onSubmit={handleSearchOrJoinByCode} className="wp-join-bar">
                        <div className="d-flex align-items-center gap-2 flex-grow-1 px-3">
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
                            className="ml-btn ml-btn-acento text-nowrap"
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
                        <div className="small text-danger mb-3 d-flex align-items-center gap-1.5 px-1">
                            <ShieldAlert size={14} />
                            <span>{searchCodeError}</span>
                        </div>
                    )}

                    {/* Grilla de Salas con Bordes Redondeados */}
                    {isLoadingRooms ? (
                        <div className="text-center py-5">
                            <Loader2 size={30} className="text-secondary mb-2" style={{ animation: 'spin 1s linear infinite' }} />
                            <p className="small text-secondary">Cargando tus listas grupales...</p>
                        </div>
                    ) : roomsList.length === 0 ? (
                        <div
                            className="text-center py-5 p-4 rounded-4"
                            style={{ background: 'var(--wp-surface)', border: '1px dashed var(--wp-border)', borderRadius: '22px' }}
                        >
                            <Users size={40} className="mb-3 text-secondary opacity-50" />
                            <h3 className="h6 fw-bold text-white mb-2">No tienes listas grupales activas</h3>
                            <p className="small mb-4 text-secondary" style={{ maxWidth: '440px', margin: '0 auto' }}>
                                Crea un grupo para que todos voten animes y sintonicen sus maratones semanales sin discusiones.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="ml-btn ml-btn-acento"
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
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <span className="wp-pill-badge is-live">
                                                    <Radio size={11} />
                                                    <span>{statusLabel}</span>
                                                </span>
                                                <span className="small text-secondary d-flex align-items-center gap-1">
                                                    <Users size={13} />
                                                    <span>{r.members?.length || r.members_count || 1} amigos</span>
                                                </span>
                                            </div>

                                            <h3 className="h6 fw-bold text-white mb-1">{r.name}</h3>
                                            <p className="small text-secondary mb-3 text-truncate" style={{ fontSize: '0.84rem' }}>
                                                {r.description || 'Grupo para maratón y coordinación de anime.'}
                                            </p>
                                        </div>

                                        <div>
                                            <div className="d-flex justify-content-between align-items-center mb-3 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
                                                <span className="small font-mono text-white fw-bold" style={{ letterSpacing: '0.05em' }}>
                                                    CÓDIGO: {r.invite_code}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCopy(r.invite_code, e)}
                                                    className="ml-btn ml-btn-fantasma ml-btn-sm"
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
                                                className="ml-btn ml-btn-acento w-100 justify-content-center"
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
                    <form onSubmit={handleCreateRoom} className="p-4 d-flex flex-column gap-3">
                        <div>
                            <h3 className="h6 fw-bold text-white mb-1">Crear Nueva Lista Grupal</h3>
                            <p className="small text-secondary mb-0">
                                Una sala privada donde tus amigos pueden sugerir animes y votarlos en tiempo real.
                            </p>
                        </div>

                        <div>
                            <label className="form-label small fw-semibold text-white">Nombre del Grupo / Maratón</label>
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
                            <label className="form-label small fw-semibold text-white">Objetivo o Notas (Opcional)</label>
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
    // VISTA 2: SALA FIT-TO-VIEWPORT (CERO SCROLL EXTERIOR + SUB-VISTAS)
    // ==============================================================
    return (
        <div
            className="ml-root wp-root px-3 px-md-4"
            style={{ '--ml-acento': acento, '--wp-acento': acento } as React.CSSProperties}
        >
            <div className="container-fluid wp-viewport-room" style={{ maxWidth: '1360px' }}>
                {/* 1. Cabecera Redondeada y Limpia */}
                <header className="wp-room-header">
                    <div className="wp-room-header-left">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedRoomId(null)
                                window.location.hash = '#listas'
                            }}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
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
                            className="ml-btn ml-btn-acento ml-btn-sm"
                        >
                            <Plus size={14} />
                            <span>Postular Anime</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowCriteriaModal(true)}
                            className="ml-btn ml-btn-sm"
                            title="Criterios del Grupo"
                        >
                            <SlidersHorizontal size={13} />
                            <span>Criterios</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleCopy(room?.invite_code || '')}
                            className="ml-btn ml-btn-sm"
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

                {/* 2. Cinta de KPIs Descriptivos (UNA SOLA LÍNEA, LENGUAJE HUMANO) */}
                <div className="wp-kpi-strip">
                    <div className="wp-kpi-pill is-gold">
                        <Trophy size={14} />
                        <span>Favorito:</span>
                        <strong>{topCandidate ? topCandidate.title : 'Por definir'}</strong>
                    </div>

                    <div className="wp-kpi-divider" />

                    <div className="wp-kpi-pill is-accent">
                        <Target size={14} />
                        <span>Sintonía:</span>
                        <strong>{dispersionDesc}</strong>
                    </div>

                    <div className="wp-kpi-divider" />

                    <div className="wp-kpi-pill is-success">
                        <Sparkles size={14} />
                        <span>Quórum:</span>
                        <strong>{quorumDesc}</strong>
                    </div>

                    <div className="wp-kpi-divider" />

                    <div className="wp-kpi-pill">
                        <Users size={14} />
                        <span>Grupo:</span>
                        <strong>{totalMembers} integrantes</strong>
                    </div>

                    <div className="wp-kpi-divider" />

                    <div className="wp-kpi-pill">
                        <Tv size={14} style={{ color: '#60a5fa' }} />
                        <span>Meta de Maratón:</span>
                        <strong>Capítulo {groupTarget} de {totalEpisodes}</strong>
                    </div>
                </div>

                {/* 3. Barra de Sub-vistas y Acciones */}
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
                            <span>Votación</span>
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

                    {/* Acciones contextuales */}
                    <div>
                        {roomTab === 'votacion' && candidates.length > 0 && (
                            <button
                                type="button"
                                onClick={handleConfirmAllVotes}
                                className="ml-btn ml-btn-sm"
                            >
                                <Check size={13} className="text-success" />
                                <span>Confirmar todos mis votos</span>
                            </button>
                        )}

                        {roomTab === 'sesion' && (
                            <button
                                type="button"
                                onClick={() => setShowScheduleModal(true)}
                                className="ml-btn ml-btn-sm"
                            >
                                <CalendarPlus size={13} />
                                <span>Agendar Sesión</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 4. Panel de Sub-vista Activa */}
                <div className="wp-subview-pane">
                    {/* ==============================================================
                        SUB-VISTA: SESIÓN & TRACKER (HERMOSO, CÁLIDO, PARA USUARIOS)
                       ============================================================== */}
                    {roomTab === 'sesion' && (
                        <div className="wp-tracker-container">
                            {/* Panel Izquierdo: Hero del Anime y Tu Progreso */}
                            <div className="wp-tracker-card">
                                {/* Hero del anime en maratón */}
                                {activeMarathonAnime ? (
                                    <div className="wp-marathon-hero">
                                        <img
                                            src={activeMarathonAnime.image_url}
                                            alt={activeMarathonAnime.title}
                                            className="wp-marathon-poster"
                                        />
                                        <div className="wp-marathon-info">
                                            <span className="small text-secondary fw-semibold d-block mb-1" style={{ fontSize: '0.72rem' }}>
                                                EN MARATÓN GRUPAL
                                            </span>
                                            <h3 className="h6 fw-bold text-white mb-1 text-truncate">{activeMarathonAnime.title}</h3>
                                            <span className="small text-secondary font-mono d-block mb-2">
                                                ★ {activeMarathonAnime.score || '8.5'} · {totalEpisodes} episodios
                                            </span>
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="wp-pill-badge is-live" style={{ fontSize: '0.72rem' }}>
                                                    <Tv size={12} />
                                                    <span>Capítulo {groupTarget} de {totalEpisodes}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="p-3 text-center rounded-3"
                                        style={{ background: 'var(--wp-surface-2)', border: '1px dashed var(--wp-border)' }}
                                    >
                                        <Tv size={28} className="text-secondary opacity-50 mb-1" />
                                        <p className="small text-secondary mb-0">Aún no se ha seleccionado anime para ver en grupo.</p>
                                    </div>
                                )}

                                {/* Sintonía de los amigos (Catch-up amigable) */}
                                {cleanCatchupMembers.length > 0 ? (
                                    <div className="wp-group-sync-card has-catchup">
                                        <Clock size={16} className="flex-shrink-0 text-warning" />
                                        <div className="small">
                                            <div className="fw-semibold text-warning mb-1">
                                                Amigos poniéndose al día con el Cap {groupTarget}:
                                            </div>
                                            <div className="d-flex flex-wrap gap-1.5">
                                                {cleanCatchupMembers.map((cm) => (
                                                    <span
                                                        key={cm.id}
                                                        className="wp-pill-badge"
                                                        style={{ background: '#1c1710', color: '#fef08a', borderColor: '#4a3510' }}
                                                    >
                                                        {cm.guest_name}: {cm.episodes_behind} caps pendientes
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="wp-group-sync-card is-synced">
                                        <CheckCircle2 size={16} className="flex-shrink-0 text-success" />
                                        <div className="small fw-semibold text-success">
                                            ✨ ¡Todos van al día con el Capítulo {groupTarget}! Listos para el siguiente.
                                        </div>
                                    </div>
                                )}

                                {/* Caja de Tu Progreso con Stepper Amigable */}
                                <div className="wp-progress-box">
                                    <div>
                                        <span className="small text-secondary fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.68rem' }}>
                                            TU PROGRESO ({userName})
                                        </span>
                                        <div className="d-flex align-items-baseline gap-2">
                                            <span className="h5 fw-bold text-white mb-0 font-mono">
                                                Capítulo {myWatched}
                                            </span>
                                            <span className="small text-secondary">de {totalEpisodes}</span>
                                            <span
                                                className="badge ms-1"
                                                style={{
                                                    background: myWatched >= groupTarget ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                                    color: myWatched >= groupTarget ? '#34d399' : '#fbbf24',
                                                    borderRadius: '999px',
                                                    padding: '0.2rem 0.6rem',
                                                }}
                                            >
                                                {myWatched >= groupTarget ? 'Al día' : `Faltan ${groupTarget - myWatched}`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateMyProgress(Math.max(0, myWatched - 1))}
                                            disabled={myWatched <= 0}
                                            className="wp-stepper-btn"
                                            title="Retroceder 1 capítulo"
                                        >
                                            -
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => updateMyProgress(myWatched + 1)}
                                            className="wp-btn-catchup"
                                        >
                                            <Plus size={14} />
                                            <span>¡Vi el Cap {myWatched + 1}!</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Meta de la Sala */}
                                <div className="d-flex justify-content-between align-items-center p-3 rounded-3" style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '16px' }}>
                                    <div>
                                        <span className="small text-secondary fw-bold text-uppercase d-block mb-0.5" style={{ fontSize: '0.68rem' }}>
                                            META DE LA SALA
                                        </span>
                                        <strong className="text-white font-mono h6 mb-0">Capítulo {groupTarget} de {totalEpisodes}</strong>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setGroupTarget(groupTarget + 1)}
                                        className="ml-btn ml-btn-sm"
                                    >
                                        <span>Avanzar Meta (+1)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Panel Derecho: Lista de Amigos Integrantes */}
                            <div className="wp-tracker-card">
                                <div className="d-flex justify-content-between align-items-center pb-2 border-bottom" style={{ borderColor: 'var(--wp-border)' }}>
                                    <span className="small fw-bold text-white">Amigos en la Sala ({totalMembers})</span>
                                    <span className="small text-secondary font-mono">Meta: Cap {groupTarget}</span>
                                </div>

                                <div className="wp-members-scroll">
                                    {room?.members?.map((m) => {
                                        const cleanName = cleanUserName(m.guest_name)
                                        const isBehind = m.sync_status === 'atrasado' || m.episodes_watched < groupTarget

                                        return (
                                            <div key={m.id} className="wp-member-card">
                                                <div className="d-flex align-items-center gap-2.5">
                                                    <div className="wp-member-avatar">
                                                        {cleanName.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="small fw-semibold text-white d-block">{cleanName}</span>
                                                        <span className="small text-secondary font-mono" style={{ fontSize: '0.74rem' }}>
                                                            {m.episodes_watched} de {totalEpisodes} episodios
                                                        </span>
                                                    </div>
                                                </div>

                                                <span
                                                    className="wp-pill-badge"
                                                    style={{
                                                        background: isBehind ? 'rgba(251, 191, 36, 0.12)' : 'rgba(52, 211, 153, 0.12)',
                                                        borderColor: isBehind ? 'rgba(251, 191, 36, 0.3)' : 'rgba(52, 211, 153, 0.3)',
                                                        color: isBehind ? '#fbbf24' : '#34d399',
                                                    }}
                                                >
                                                    {isBehind ? `Atrasado (-${groupTarget - m.episodes_watched})` : 'Al día'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==============================================================
                        SUB-VISTA: VOTACIÓN DE ANIMES
                       ============================================================== */}
                    {roomTab === 'votacion' && (
                        <div className="wp-candidates-scroll">
                            {candidates.length === 0 ? (
                                <div
                                    className="p-5 text-center rounded-4 my-auto"
                                    style={{ background: 'var(--wp-surface)', border: '1px dashed var(--wp-border)', borderRadius: '22px' }}
                                >
                                    <p className="text-secondary mb-3">Aún no hay animes postulados en esta lista grupal.</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowNominateModal(true)}
                                        className="ml-btn ml-btn-acento"
                                    >
                                        <Plus size={15} />
                                        <span>Postular el primer anime</span>
                                    </button>
                                </div>
                            ) : (
                                candidates.map((cand, index) => {
                                    const rankNum = index + 1
                                    const myVoteScore = localVotes[cand.id] ?? 5
                                    const happinessScore = cand.happiness_result?.final_score ?? cand.avg_interest ?? 10
                                    const dispersion = cand.happiness_result?.interest_dispersion ?? 0.8
                                    const isPolarized = dispersion >= 2.0
                                    const isConsensusWinner = rankNum === 1 && !isPolarized

                                    const explanation =
                                        cand.happiness_result?.explanations?.[0] ||
                                        (isPolarized
                                            ? 'Opiniones divididas en el grupo'
                                            : 'Alto consenso y agrado parejo entre amigos')

                                    return (
                                        <div key={cand.id} className="wp-cand-card">
                                            <div className={`wp-cand-rank ${rankNum === 1 ? 'is-top' : ''}`}>
                                                {rankNum === 1 ? <Crown size={18} className="text-warning" /> : `#${rankNum}`}
                                            </div>

                                            <img
                                                src={cand.image_url}
                                                alt={cand.title}
                                                className="wp-cand-poster"
                                            />

                                            <div className="wp-cand-info">
                                                <div className="wp-cand-title-row">
                                                    <span className="wp-cand-title">{cand.title}</span>
                                                    <span className="wp-cand-meta">
                                                        ★ {cand.score || '8.5'} · {cand.episodes || 24} eps · por {cleanUserName(cand.suggested_by)}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span
                                                        className={`wp-cand-consenso ${
                                                            isConsensusWinner ? 'is-winner' : isPolarized ? 'is-polar' : ''
                                                        }`}
                                                    >
                                                        {isConsensusWinner && '👑 '}
                                                        {isPolarized && '⚡ '}
                                                        {explanation}
                                                    </span>
                                                </div>

                                                <div className="wp-cand-slider-row">
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
                                                        className="wp-slider"
                                                    />

                                                    <span className="wp-vote-score-pill">
                                                        Tu voto: <strong>{myVoteScore.toFixed(1).replace('.', ',')}</strong> / 10
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendVote(cand.id)}
                                                        className="ml-btn ml-btn-sm"
                                                        title="Guardar voto"
                                                    >
                                                        <ThumbsUp size={12} />
                                                        <span>Votar</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="wp-cand-happiness">
                                                <span className="wp-cand-hap-label">SINTONÍA</span>
                                                <span className="wp-cand-hap-val">{Number(happinessScore).toFixed(0)}</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (room) {
                                                            await selectWinningAnimeApi(room.id, cand.anime_id)
                                                            setRoomTab('sesion')
                                                        }
                                                    }}
                                                    className="wp-cand-btn-win"
                                                >
                                                    Elegir para Maratón →
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* ==============================================================
                        SUB-VISTA: MATRIZ 2D & ANÁLISIS
                       ============================================================== */}
                    {roomTab === 'analisis' && (
                        <div className="wp-matrix-pane">
                            <div className="wp-matrix-header">
                                <div>
                                    <h3 className="h6 fw-bold text-white mb-0">Mapa de Gustos Grupales</h3>
                                    <span className="small text-secondary" style={{ fontSize: '0.78rem' }}>
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
                                <div className="wp-matrix-canvas">
                                    <div className="wp-quad-badge wp-quad-winner">👑 GANADOR SEGURO (EN SINTONÍA)</div>
                                    <div className="wp-quad-badge wp-quad-polar">⚡ AMOR U ODIO (DIVIDIDO)</div>
                                    <div className="wp-quad-badge wp-quad-meh">💤 POCO INTERÉS</div>
                                    <div className="wp-quad-badge wp-quad-niche">🎯 JOYA OCULTA</div>

                                    <div className="wp-matrix-axis-x" />
                                    <div className="wp-matrix-axis-y" />

                                    {candidates.map((cand, idx) => {
                                        const mean = cand.happiness_result?.interest_mean ?? cand.avg_interest ?? 7.5
                                        const disp = cand.happiness_result?.interest_dispersion ?? 1.2

                                        const yPercent = Math.max(16, Math.min(84, 100 - (mean / 10) * 100))
                                        const consensusVal = Math.max(0, 10 - disp * 2.5)
                                        const xPercent = Math.max(16, Math.min(84, (consensusVal / 10) * 100))

                                        return (
                                            <div
                                                key={cand.id}
                                                className="wp-matrix-pin"
                                                style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                                                title={`${cand.title} — Interés de grupo`}
                                            >
                                                <div className="position-relative">
                                                    <img
                                                        src={cand.image_url}
                                                        alt={cand.title}
                                                        className="wp-pin-img"
                                                        style={{
                                                            border: idx === 0 ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.35)',
                                                        }}
                                                    />
                                                    <span
                                                        className="wp-pin-badge"
                                                        style={{
                                                            background: idx === 0 ? '#fbbf24' : '#1e293b',
                                                            color: idx === 0 ? '#000000' : '#ffffff',
                                                        }}
                                                    >
                                                        #{idx + 1}
                                                    </span>
                                                </div>
                                                <span className="wp-pin-label">{cand.title}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="wp-candidates-scroll">
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
                        SUB-VISTA: CHAT EN VIVO SOCIAL & MODERNO
                       ============================================================== */}
                    {roomTab === 'chat' && (
                        <div className="wp-chat-container">
                            {/* Reacciones Flotantes Animadas */}
                            {floatingReactions.map((r) => (
                                <span
                                    key={r.id}
                                    className="wp-float-reaction"
                                    style={{ left: `${r.xPos}%` }}
                                >
                                    {r.emoji}
                                </span>
                            ))}

                            <div className="wp-chat-header">
                                <div className="d-flex align-items-center gap-2">
                                    <MessageSquare size={16} style={{ color: 'var(--wp-acento)' }} />
                                    <span className="small fw-bold text-white">Sala de Chat</span>
                                    <span className="wp-pill-badge is-live" style={{ fontSize: '0.7rem' }}>
                                        {totalMembers} amigos
                                    </span>
                                </div>

                                <div className="wp-chat-spoiler-capsule">
                                    <ShieldAlert size={13} />
                                    <span>Libre de spoilers hasta Cap. {groupTarget}</span>
                                </div>
                            </div>

                            <div ref={chatScrollRef} className="wp-chat-stream">
                                {chatMessages.length === 0 ? (
                                    <div className="text-center my-auto small text-secondary">
                                        <Smile size={28} className="text-secondary opacity-40 mb-2" />
                                        <p className="mb-0">¡Sé el primero en escribir para coordinar la maratón!</p>
                                    </div>
                                ) : (
                                    chatMessages.map((msg) => {
                                        const cleanSender = cleanUserName(msg.sender)
                                        const isMine = cleanSender === userName

                                        return (
                                            <div
                                                key={msg.id}
                                                className={isMine ? 'wp-bubble-user' : 'wp-bubble-friend'}
                                            >
                                                <div className="wp-msg-author">
                                                    {cleanSender}
                                                </div>
                                                <div>{msg.text}</div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Reacciones con Emojis */}
                            <div className="wp-chat-emojis-bar">
                                <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>Reacciones:</span>
                                <div className="d-flex gap-1.5">
                                    {QUICK_EMOJIS.map((em) => (
                                        <button
                                            key={em}
                                            type="button"
                                            onClick={() => sendReaction(em)}
                                            className="wp-emoji-btn"
                                        >
                                            {em}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Input Pill Redondeado */}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    if (chatInput.trim()) {
                                        sendChat(chatInput)
                                        setChatInput('')
                                    }
                                }}
                                className="wp-chat-input-row"
                            >
                                <input
                                    type="text"
                                    placeholder="Escribe un mensaje para el grupo..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    className="wp-input-pill"
                                />
                                <button type="submit" className="wp-send-circle-btn" title="Enviar mensaje">
                                    <Send size={15} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            {/* ==============================================================
                MODALES REDONDEADOS
               ============================================================== */}
            {/* Modal Postular Anime */}
            <Dialogo
                abierto={showNominateModal}
                onCerrar={() => setShowNominateModal(false)}
                etiqueta="Postular Anime a la Sala"
                ancho={500}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <h3 className="h6 fw-bold text-white mb-1">Postular Anime</h3>
                        <p className="small text-secondary mb-0">
                            Busca un anime en el catálogo para sumarlo a la lista de candidatos.
                        </p>
                    </div>

                    <div className="position-relative">
                        <input
                            type="text"
                            placeholder="Buscar por título..."
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
                                        className="rounded"
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
                            Filtros de referencia acordados para esta selección.
                        </p>
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold">Duración de Capítulos</label>
                        <input
                            type="text"
                            value={criteriaDuration}
                            onChange={(e) => setCriteriaDuration(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold">Géneros Preferidos</label>
                        <input
                            type="text"
                            value={criteriaGenres}
                            onChange={(e) => setCriteriaGenres(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold">Rango de Años</label>
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
                        <label className="form-label small text-white fw-semibold">Fecha y Hora</label>
                        <input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="form-control text-white"
                            style={{ background: 'var(--wp-surface-2)', border: '1px solid var(--wp-border)', borderRadius: '12px' }}
                        />
                    </div>

                    <div>
                        <label className="form-label small text-white fw-semibold">Notas / Plataforma</label>
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
