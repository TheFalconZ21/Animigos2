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
    Settings,
    UserPlus,
    UserMinus,
    Trash2,
    AlertTriangle,
    Lock,
    X,
} from 'lucide-react'
import { useWatchParty } from '../../hooks/useWatchParty'
import {
    fetchAllRooms,
    fetchRoomByCode,
    createRoomApi,
    joinRoomApi,
    selectWinningAnimeApi,
    joinWatchingAnimeApi,
    updateAnimeProgressApi,
    setAnimeTargetApi,
    updateRoomSettingsApi,
    kickRoomMemberApi,
    inviteFriendToRoomApi,
    dissolveRoomApi,
    type RoomSummary,
    type RoomMember,
    type WatchingAnimeItem,
} from '../../services/watchPartyApi'
import { fetchFriends, type FriendUser } from '../../services/friendsApi'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { useAuth } from '../../context/AuthContext'
import { buildShareableUrl, getCurrentPath, navigate, subscribeNavigation } from '../../utils/navigation'
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

    // Anime seleccionado para tracker detallado en maratón
    const [selectedWatchingAnimeId, setSelectedWatchingAnimeId] = useState<string | null>(null)
    const [isJoiningAnime, setIsJoiningAnime] = useState(false)
    const [participationFeedback, setParticipationFeedback] = useState<string | null>(null)

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

    // Modal de Ajustes (reemplaza modal de criterios suelto)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [settingsTab, setSettingsTab] = useState<'criterios' | 'sala'>('criterios')
    const [criteriaDuration, setCriteriaDuration] = useState('1-28 caps')
    const [criteriaGenres, setCriteriaGenres] = useState('Sci-Fi, Fantasía, Misterio')
    const [criteriaYears, setCriteriaYears] = useState('2010-2026')
    const [criteriaFormat, setCriteriaFormat] = useState('Cualquiera')
    const [criteriaMinScore, setCriteriaMinScore] = useState('7.0')
    const [roomMaxMembers, setRoomMaxMembers] = useState(10)
    const [isSavingSettings, setIsSavingSettings] = useState(false)
    const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
    const [memberToKick, setMemberToKick] = useState<RoomMember | null>(null)
    const [isKickingMember, setIsKickingMember] = useState(false)
    const [showDissolveConfirm, setShowDissolveConfirm] = useState(false)
    const [isDissolving, setIsDissolving] = useState(false)

    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [scheduleDate, setScheduleDate] = useState('')
    const [scheduleNotes, setScheduleNotes] = useState('')

    // Modal para que el creador de la sala invite a sus amigos de Animigos
    const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false)
    const [myFriends, setMyFriends] = useState<FriendUser[]>([])
    const [loadingMyFriends, setLoadingMyFriends] = useState(false)
    const [inviteFriendQuery, setInviteFriendQuery] = useState('')
    const [invitingFriendId, setInvitingFriendId] = useState<number | null>(null)
    const [inviteFeedback, setInviteFeedback] = useState<{ text: string; isError: boolean } | null>(null)

    // Mensajes y chat
    const [copiedCode, setCopiedCode] = useState<string | null>(null)
    const [chatInput, setChatInput] = useState('')
    const chatScrollRef = useRef<HTMLDivElement>(null)

    // Cargar listas al iniciar o al cambiar el usuario/token
    useEffect(() => {
        loadRooms()
    }, [userToken])

    // Soporte de navegación por rutas limpias: /sala/<codigo> o /sala / /listas
    useEffect(() => {
        const handleRouteChange = () => {
            const path = getCurrentPath()
            const match = path.match(/^\/sala\/([a-zA-Z0-9_-]+)/i)
            const initialCode = match ? match[1] : ''

            if (initialCode) {
                handleOpenByCode(initialCode)
            } else if (path === '/sala' || path === '/listas' || path === '/votacion') {
                setSelectedRoomId(null)
            }
        }

        handleRouteChange()
        return subscribeNavigation(handleRouteChange)
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
            navigate(`/sala/${created.invite_code}`)
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
                navigate(`/sala/${joined.invite_code}`)
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
        setRoom,
        chatMessages,
        floatingReactions,
        scheduleSession,
        voteCandidate,
        nominateCandidate,
        sendChat,
        sendReaction,
    } = useWatchParty({ roomId: selectedRoomId || '', userName, userToken })

    // Determinar si el usuario actual es el creador/anfitrión de la sala
    const isOwner = useMemo(() => {
        if (!room?.members) return false
        return (
            room.members.some(
                (m) =>
                    m.role === 'owner' &&
                    (m.guest_token === userToken ||
                        (user && (m.guest_name === user.username || m.guest_name === user.display_name)))
            ) || (room.members.length === 1 && room.members[0].guest_token === userToken)
        )
    }, [room?.members, userToken, user])

    // Sincronizar ajustes de la sala cuando se carga o actualiza la sala
    useEffect(() => {
        if (room) {
            if (room.criteria_data) {
                if (room.criteria_data.duration) setCriteriaDuration(room.criteria_data.duration)
                if (room.criteria_data.genres) setCriteriaGenres(room.criteria_data.genres)
                if (room.criteria_data.years) setCriteriaYears(room.criteria_data.years)
                if (room.criteria_data.format) setCriteriaFormat(room.criteria_data.format)
                if (room.criteria_data.min_score) setCriteriaMinScore(room.criteria_data.min_score)
            }
            if (room.max_members) {
                setRoomMaxMembers(room.max_members)
            }
        }
    }, [room?.id, room?.criteria_data, room?.max_members])

    // Guardar criterios de postulación
    const handleSaveCriteria = async () => {
        if (!room) return
        setIsSavingSettings(true)
        setSettingsFeedback(null)
        try {
            const updated = await updateRoomSettingsApi(room.id, {
                criteria_data: {
                    duration: criteriaDuration,
                    genres: criteriaGenres,
                    years: criteriaYears,
                    format: criteriaFormat,
                    min_score: criteriaMinScore,
                },
                guest_token: userToken,
            })
            setRoom(updated)
            setSettingsFeedback('✓ Criterios guardados correctamente.')
            setTimeout(() => setSettingsFeedback(null), 3500)
        } catch (e: any) {
            setSettingsFeedback(`❌ Error: ${e.message || 'No se pudieron guardar los criterios'}`)
        } finally {
            setIsSavingSettings(false)
        }
    }

    // Guardar límite máximo de miembros
    const handleSaveMaxMembers = async () => {
        if (!room) return
        setIsSavingSettings(true)
        setSettingsFeedback(null)
        try {
            const updated = await updateRoomSettingsApi(room.id, {
                max_members: Number(roomMaxMembers),
                guest_token: userToken,
            })
            setRoom(updated)
            setSettingsFeedback(`✓ Capacidad máxima actualizada a ${roomMaxMembers} miembros.`)
            setTimeout(() => setSettingsFeedback(null), 3500)
        } catch (e: any) {
            setSettingsFeedback(`❌ Error: ${e.message || 'No se pudo actualizar el límite'}`)
        } finally {
            setIsSavingSettings(false)
        }
    }

    // Expulsar a un integrante
    const handleKickMember = async (member: RoomMember) => {
        if (!room) return
        setIsKickingMember(true)
        try {
            const updated = await kickRoomMemberApi(room.id, member.id, userToken)
            setRoom(updated)
            setMemberToKick(null)
            setSettingsFeedback(`✓ ${cleanUserName(member.guest_name)} ha sido expulsado de la sala.`)
            setTimeout(() => setSettingsFeedback(null), 3500)
        } catch (e: any) {
            setSettingsFeedback(`❌ Error: ${e.message || 'No se pudo expulsar al integrante'}`)
        } finally {
            setIsKickingMember(false)
        }
    }

    // Abrir modal para invitar amigos de Animigos a la sala (Solo Creador)
    const handleOpenInviteFriendsModal = async () => {
        setShowInviteFriendsModal(true)
        setInviteFeedback(null)
        setInviteFriendQuery('')
        if (!user) return
        setLoadingMyFriends(true)
        try {
            const list = await fetchFriends()
            setMyFriends(list)
        } catch {
            setMyFriends([])
        } finally {
            setLoadingMyFriends(false)
        }
    }

    // Invitar directamente a un amigo a la sala grupal
    const handleInviteFriendToRoom = async (friend: FriendUser) => {
        if (!room || invitingFriendId !== null) return
        setInvitingFriendId(friend.id)
        setInviteFeedback(null)
        try {
            const res = await inviteFriendToRoomApi(
                room.id,
                { friend_id: friend.id, friend_username: friend.username },
                userToken
            )
            if (res.room) {
                setRoom(res.room)
            }
            setInviteFeedback({
                text: res.message || `¡${friend.display_name} fue invitado a la sala!`,
                isError: false,
            })
        } catch (err: unknown) {
            setInviteFeedback({
                text: err instanceof Error ? err.message : 'No se pudo invitar al amigo.',
                isError: true,
            })
        } finally {
            setInvitingFriendId(null)
        }
    }

    // Disolver la lista grupal (con confirmación)
    const handleDissolveRoom = async () => {
        if (!room) return
        setIsDissolving(true)
        try {
            await dissolveRoomApi(room.id, userToken)
            setShowDissolveConfirm(false)
            setShowSettingsModal(false)
            setSelectedRoomId(null)
            navigate('/listas')
            await loadRooms()
        } catch (e: any) {
            alert(e.message || 'No se pudo disolver la sala grupal')
        } finally {
            setIsDissolving(false)
        }
    }

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
        const fullUrl = buildShareableUrl(`/sala/${code}`)
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

    // Animes activos en maratón grupal
    const activeWatchingAnimes = useMemo(() => {
        return room?.watching_animes?.filter((w) => w.is_active) || []
    }, [room?.watching_animes])

    // Estado binario de la sala: 'Decidiendo' o 'Viendo'
    const isDeciding = useMemo(() => {
        return activeWatchingAnimes.length === 0 || room?.status === 'deciding'
    }, [activeWatchingAnimes.length, room?.status])

    // Ajuste de pestaña automática cuando la sala está en 'Decidiendo'
    useEffect(() => {
        if (room) {
            const active = room.watching_animes?.filter((w) => w.is_active) || []
            if (active.length === 0 || room.status === 'deciding') {
                setRoomTab('votacion')
            }
        }
    }, [room?.id])

    useEffect(() => {
        if (isDeciding && roomTab === 'sesion') {
            setRoomTab('votacion')
        }
    }, [isDeciding, roomTab])

    // Anime en visualización activa dentro de Sesión & Tracker
    const currentWatchingAnime: WatchingAnimeItem | null = useMemo(() => {
        if (activeWatchingAnimes.length === 0) return null
        if (selectedWatchingAnimeId) {
            const found = activeWatchingAnimes.find((w) => w.id === selectedWatchingAnimeId)
            if (found) return found
        }
        if (activeWatchingAnimes.length === 1) {
            return activeWatchingAnimes[0]
        }
        return null
    }, [activeWatchingAnimes, selectedWatchingAnimeId])

    // Participación del usuario actual en el anime en visualización
    const myParticipationCurrent = useMemo(() => {
        if (!currentWatchingAnime?.participations) return null
        return (
            currentWatchingAnime.participations.find(
                (p) =>
                    (p.guest_token && p.guest_token === userToken) ||
                    cleanUserName(p.guest_name).toLowerCase() === userName.toLowerCase()
            ) || null
        )
    }, [currentWatchingAnime, userToken, userName])

    const isParticipatingCurrent = !!myParticipationCurrent?.is_participating
    const myWatchedCurrent = myParticipationCurrent?.episodes_watched ?? 0
    const groupTargetCurrent = currentWatchingAnime?.current_episode || 1
    const totalEpisodesCurrent = currentWatchingAnime?.episodes_total || currentWatchingAnime?.anime?.episodes || 24

    // Acciones de Maratón y Tracker
    const handleJoinAnime = async (watchingAnimeId?: string, animeId?: number) => {
        if (!room) return
        setIsJoiningAnime(true)
        setParticipationFeedback(null)
        try {
            const updated = await joinWatchingAnimeApi(room.id, {
                watching_anime_id: watchingAnimeId,
                anime_id: animeId,
                guest_token: userToken,
                guest_name: userName,
            })
            setRoom(updated)
            setParticipationFeedback('✓ ¡Te has sumado a la maratón! El anime se agregó a tu lista personal en "Viendo".')
            setTimeout(() => setParticipationFeedback(null), 4000)
        } catch (e: any) {
            setParticipationFeedback(`❌ Error: ${e.message || 'No se pudo unir a la maratón'}`)
            setTimeout(() => setParticipationFeedback(null), 4000)
        } finally {
            setIsJoiningAnime(false)
        }
    }

    const handleUpdateAnimeProgress = async (watchingAnimeId: string, episodesWatched: number) => {
        if (!room) return
        try {
            const updated = await updateAnimeProgressApi(room.id, {
                watching_anime_id: watchingAnimeId,
                episodes_watched: episodesWatched,
                guest_token: userToken,
                guest_name: userName,
            })
            setRoom(updated)
        } catch (e: any) {
            console.error('Error al actualizar avance:', e)
        }
    }

    const handleSetAnimeTarget = async (watchingAnimeId: string, episode: number) => {
        if (!room) return
        try {
            const updated = await setAnimeTargetApi(room.id, {
                watching_anime_id: watchingAnimeId,
                episode,
                guest_token: userToken,
            })
            setRoom(updated)
        } catch (e: any) {
            console.error('Error al actualizar meta:', e)
        }
    }

    const handleToggleWatchingAnime = async (animeId: number) => {
        if (!room) return
        try {
            const updated = await selectWinningAnimeApi(room.id, animeId, 'toggle', userToken)
            setRoom(updated)
            const active = updated.watching_animes?.filter((w) => w.is_active) || []
            if (active.length > 0) {
                setRoomTab('sesion')
                if (active.length === 1) {
                    setSelectedWatchingAnimeId(active[0].id)
                } else {
                    setSelectedWatchingAnimeId(null)
                }
            }
        } catch (e: any) {
            alert(e.message || 'No se pudo actualizar el anime de maratón')
        }
    }

    // Miembros de la sala ordenados y deduplicados
    const roomMembers = useMemo(() => {
        if (!room?.members) return []
        const seen = new Set<string>()
        const list = [...room.members]
            .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0))
            .filter((m) => {
                const key = cleanUserName(m.guest_name).toLowerCase().trim()
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
        return list.map((m) => ({
            ...m,
            cleanName: cleanUserName(m.guest_name),
        }))
    }, [room?.members])

    const totalMembers = roomMembers.length || 1

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

    const groupTarget = currentWatchingAnime?.current_episode || room?.current_episode || 1
    const totalEpisodes = currentWatchingAnime?.episodes_total || totalEpisodesCurrent || 24

    // Miembros que faltan por ponerse al día en el anime activo
    const currentAnimeCatchup = useMemo(() => {
        if (!currentWatchingAnime?.participations) return []
        return currentWatchingAnime.participations
            .filter((p) => p.is_participating && p.episodes_watched < groupTargetCurrent)
            .map((p) => ({
                ...p,
                cleanName: cleanUserName(p.guest_name),
                behind: groupTargetCurrent - p.episodes_watched,
            }))
    }, [currentWatchingAnime, groupTargetCurrent])

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
                                const isRoomWatching =
                                    r.status === 'watching' ||
                                    (r.watching_animes && r.watching_animes.some((w) => w.is_active))
                                const statusLabel = isRoomWatching ? 'Viendo' : 'Decidiendo'

                                return (
                                    <div key={r.id} className="wp-room-card">
                                        <div>
                                            <div className="wp-room-card-header">
                                                <span
                                                    className={`wp-pill-badge ${isRoomWatching ? 'is-live' : ''} wp-status-badge`}
                                                    style={{
                                                        background: isRoomWatching ? 'rgba(52, 211, 153, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                                                        color: isRoomWatching ? '#34d399' : '#facc15',
                                                        borderColor: isRoomWatching ? 'rgba(52, 211, 153, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                                                    }}
                                                >
                                                    <Radio size={10} className="wp-status-icon" />
                                                    <span>{statusLabel}</span>
                                                </span>
                                                <span className="small text-secondary d-flex align-items-center gap-1.5">
                                                    <Users size={12} />
                                                    <span>{r.members?.length || r.members_count || 1} amigos</span>
                                                </span>
                                            </div>

                                            <h3 className="wp-room-card-title">{r.name}</h3>
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
                                                    navigate(`/sala/${r.invite_code}`)
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
                                navigate('/listas')
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

                        <span
                            className={`wp-pill-badge ${!isDeciding ? 'is-live' : ''}`}
                            style={{
                                background: !isDeciding ? 'rgba(52, 211, 153, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                                color: !isDeciding ? '#34d399' : '#facc15',
                                borderColor: !isDeciding ? 'rgba(52, 211, 153, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                            }}
                        >
                            <Tv size={11} />
                            <span>{isDeciding ? 'Decidiendo' : 'Viendo'}</span>
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

                        {isOwner && user && (
                            <button
                                type="button"
                                onClick={handleOpenInviteFriendsModal}
                                className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                                style={{
                                    borderColor: 'color-mix(in srgb, var(--wp-accent, #a78bfa) 45%, transparent)',
                                    background: 'color-mix(in srgb, var(--wp-accent, #a78bfa) 14%, transparent)',
                                    color: '#ffffff',
                                }}
                                title="Invitar amigos de Animigos a esta lista grupal (Solo Creador)"
                            >
                                <UserPlus size={13} />
                                <span>Invitar Amigos</span>
                            </button>
                        )}

                        {isOwner && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSettingsTab('criterios')
                                    setShowSettingsModal(true)
                                }}
                                className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                                title="Ajustes de la Sala Grupal (Solo Creador)"
                            >
                                <Settings size={13} />
                                <span>Ajustes</span>
                            </button>
                        )}

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
                                navigate('/listas')
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
                        onClick={() => !isDeciding && setRoomTab('sesion')}
                        className={`wp-kpi-pill ${isDeciding ? 'opacity-60' : ''}`}
                        title={isDeciding ? 'Se habilitará al elegir un anime ganador' : 'Ir a Sesión Tracker para ver avance de maratón'}
                        disabled={isDeciding}
                    >
                        <Tv size={14} style={{ color: '#60a5fa' }} />
                        <span>{isDeciding ? 'Fase:' : 'Meta de Maratón:'}</span>
                        <strong>
                            {isDeciding
                                ? 'Decidiendo anime'
                                : currentWatchingAnime
                                    ? `Capítulo ${groupTargetCurrent} de ${totalEpisodesCurrent}`
                                    : `${activeWatchingAnimes.length} animes en maratón`}
                        </strong>
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
                            className={`wp-tab ${roomTab === 'sesion' ? 'active' : ''} ${isDeciding ? 'is-disabled' : ''}`}
                            aria-selected={roomTab === 'sesion'}
                            onClick={() => {
                                if (isDeciding) return
                                setRoomTab('sesion')
                            }}
                            title={
                                isDeciding
                                    ? 'Se habilitará al elegir un anime para ver en grupo (Fase Decidiendo)'
                                    : 'Sesión & Tracker'
                            }
                        >
                            {isDeciding ? <Lock size={13} className="text-secondary" /> : <Target size={14} />}
                            <span>Sesión & Tracker</span>
                            {isDeciding ? (
                                <span className="wp-tab-badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--wp-text-dim)' }}>
                                    Bloqueado
                                </span>
                            ) : activeWatchingAnimes.length > 1 ? (
                                <span className="wp-tab-badge">{activeWatchingAnimes.length}</span>
                            ) : null}
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
                    {/* CASO A: Sala en estado Decidiendo (Sesión & Tracker Bloqueado) */}
                    {roomTab === 'sesion' && isDeciding && (
                        <div className="wp-tracker-unified-card">
                            <div
                                className="p-5 text-center rounded-4"
                                style={{
                                    background: 'var(--wp-surface-2)',
                                    border: '1px dashed var(--wp-border)',
                                    borderRadius: 'var(--wp-radio-lg)',
                                }}
                            >
                                <Lock size={36} className="text-secondary opacity-50 mb-3 mx-auto" />
                                <h3 className="h6 fw-bold text-white mb-2">Fase de Decisión: Sesión & Tracker bloqueado</h3>
                                <p className="small text-secondary mb-4 mx-auto" style={{ maxWidth: '520px' }}>
                                    Esta sala grupal se encuentra en estado <strong>Decidiendo</strong>. Cuando el dueño de la sala seleccione al menos un anime ganador en la pestaña de votación, la sala pasará al estado <strong>Viendo</strong> y se habilitará el tracker y la línea de tiempo de episodios.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setRoomTab('votacion')}
                                    className="ml-btn ml-btn-acento d-flex align-items-center gap-2 mx-auto"
                                >
                                    <List size={15} />
                                    <span>Ir a Votación de Animes →</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CASO B: Sala en Viendo con Múltiples Animes (Menú Selector de Anime) */}
                    {roomTab === 'sesion' && !isDeciding && activeWatchingAnimes.length > 1 && !selectedWatchingAnimeId && (
                        <div className="wp-tracker-unified-card">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                <div>
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <span className="small text-secondary fw-semibold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                                            Maratones Activas en Simultáneo
                                        </span>
                                        <span className="wp-pill-badge is-live" style={{ fontSize: '0.7rem' }}>
                                            <Tv size={11} />
                                            <span>{activeWatchingAnimes.length} animes en grupo</span>
                                        </span>
                                    </div>
                                    <h2 className="h5 fw-bold text-white mb-0.5">Elige qué anime deseas seguir</h2>
                                    <p className="small text-secondary mb-0">
                                        Selecciona un anime para ver su línea de tiempo, sincronizar tus episodios o participar en la maratón.
                                    </p>
                                </div>
                            </div>

                            {/* Toast feedback de participación */}
                            {participationFeedback && (
                                <div
                                    className="p-2.5 mb-3 rounded-3 text-center small fw-semibold"
                                    style={{
                                        background: 'rgba(52, 211, 153, 0.15)',
                                        color: '#34d399',
                                        border: '1px solid rgba(52, 211, 153, 0.3)',
                                    }}
                                >
                                    {participationFeedback}
                                </div>
                            )}

                            {/* Grilla de Animes en Maratón */}
                            <div className="wp-watching-animes-grid">
                                {activeWatchingAnimes.map((wItem) => {
                                    const anime = wItem.anime
                                    const myPart = wItem.participations?.find(
                                        (p) =>
                                            (p.guest_token && p.guest_token === userToken) ||
                                            cleanUserName(p.guest_name).toLowerCase() === userName.toLowerCase()
                                    )
                                    const isPart = !!myPart?.is_participating
                                    const myEps = myPart?.episodes_watched ?? 0
                                    const totalEps = wItem.episodes_total || anime.episodes || 24

                                    return (
                                        <div key={wItem.id} className="wp-watching-anime-card">
                                            <img
                                                src={anime.image_url}
                                                alt={anime.title}
                                                className="wp-watching-card-poster"
                                            />
                                            <div className="wp-watching-card-content">
                                                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                                    <span className="wp-pill-badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                                                        <Tv size={10} />
                                                        <span>Meta: Cap {wItem.current_episode} de {totalEps}</span>
                                                    </span>
                                                    <span className="small text-secondary d-flex align-items-center gap-1 font-mono" style={{ fontSize: '0.72rem' }}>
                                                        <Users size={11} />
                                                        <span>{wItem.participants_count || wItem.participations?.filter((p) => p.is_participating).length || 0} amigos</span>
                                                    </span>
                                                </div>

                                                <h3 className="wp-watching-card-title" title={anime.title}>
                                                    {anime.title}
                                                </h3>

                                                <div className="d-flex align-items-center gap-2 small text-secondary font-mono mb-3" style={{ fontSize: '0.75rem' }}>
                                                    <span className="text-warning d-flex align-items-center gap-0.5">
                                                        <Star size={11} /> {anime.score || '8.5'}
                                                    </span>
                                                    <span>·</span>
                                                    <span>{totalEps} eps</span>
                                                    <span>·</span>
                                                    {isPart ? (
                                                        <span className="text-success fw-semibold">
                                                            ✓ Viendo (Cap {myEps})
                                                        </span>
                                                    ) : (
                                                        <span className="text-secondary">Sin participar</span>
                                                    )}
                                                </div>

                                                <div className="d-flex align-items-center gap-2 mt-auto">
                                                    {!isPart && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleJoinAnime(wItem.id, anime.mal_id)}
                                                            disabled={isJoiningAnime}
                                                            className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5 flex-grow-1 justify-content-center"
                                                            title="Unirse a la maratón y agregar a 'Mi Lista' en Viendo"
                                                        >
                                                            <Plus size={13} />
                                                            <span>Participar</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedWatchingAnimeId(wItem.id)}
                                                        className={`ml-btn ${isPart ? 'ml-btn-acento' : 'ml-btn-fantasma'} ml-btn-sm d-flex align-items-center gap-1.5 ${isPart ? 'w-100' : ''} justify-content-center`}
                                                    >
                                                        <span>Abrir Tracker</span>
                                                        <span>→</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* CASO C: Sala en Viendo con Tracker Específico Seleccionado */}
                    {roomTab === 'sesion' && !isDeciding && currentWatchingAnime && (
                        <div className="wp-tracker-unified-card">
                            {/* Si hay múltiples animes viendo, botón para regresar al selector */}
                            {activeWatchingAnimes.length > 1 && (
                                <div className="mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedWatchingAnimeId(null)}
                                        className="ml-btn ml-btn-fantasma ml-btn-sm d-flex align-items-center gap-1.5"
                                        style={{ fontSize: '0.78rem' }}
                                    >
                                        <ChevronLeft size={14} />
                                        <span>← Ver todos los animes en maratón ({activeWatchingAnimes.length})</span>
                                    </button>
                                </div>
                            )}

                            {/* Banner de Invitación a Participar (si no está participando aún) */}
                            {!isParticipatingCurrent && (
                                <div
                                    className="p-3 mb-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                                    style={{
                                        background: 'rgba(234, 179, 8, 0.1)',
                                        border: '1px solid rgba(234, 179, 8, 0.25)',
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <Sparkles size={16} className="text-warning flex-shrink-0" />
                                        <span className="small text-white">
                                            <strong>¿Te sumas a ver este anime?</strong> Haz click en "Participar" para sincronizar tus capítulos. Si estás registrado, se añadirá automáticamente a tu lista personal en <em>"Viendo"</em>.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleJoinAnime(currentWatchingAnime.id, currentWatchingAnime.anime.mal_id)}
                                        disabled={isJoiningAnime}
                                        className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5"
                                    >
                                        <Check size={14} />
                                        <span>Participar en este Anime</span>
                                    </button>
                                </div>
                            )}

                            {/* Toast feedback de participación */}
                            {participationFeedback && (
                                <div
                                    className="p-2.5 mb-3 rounded-3 text-center small fw-semibold"
                                    style={{
                                        background: 'rgba(52, 211, 153, 0.15)',
                                        color: '#34d399',
                                        border: '1px solid rgba(52, 211, 153, 0.3)',
                                    }}
                                >
                                    {participationFeedback}
                                </div>
                            )}

                            {/* Hero Banner del Anime en Maratón */}
                            <div className="wp-marathon-header-banner">
                                <img
                                    src={currentWatchingAnime.anime.image_url}
                                    alt={currentWatchingAnime.anime.title}
                                    className="wp-marathon-poster-thumb"
                                />
                                <div className="wp-marathon-meta-block">
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <span className="small text-secondary fw-semibold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                                            Anime en Maratón Grupal
                                        </span>
                                        <span className="wp-pill-badge is-live" style={{ fontSize: '0.7rem' }}>
                                            <Tv size={11} />
                                            <span>Meta actual: Cap {groupTargetCurrent} de {totalEpisodesCurrent}</span>
                                        </span>
                                        {isParticipatingCurrent && (
                                            <span className="wp-pill-badge" style={{ fontSize: '0.7rem', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
                                                <Check size={10} />
                                                <span>Participando (Cap {myWatchedCurrent})</span>
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="h5 fw-bold text-white mb-1">{currentWatchingAnime.anime.title}</h2>
                                    <div className="d-flex align-items-center gap-3 text-secondary small font-mono">
                                        <span className="d-flex align-items-center gap-1 text-warning">
                                            <Star size={13} /> {currentWatchingAnime.anime.score || '8.5'}
                                        </span>
                                        <span>·</span>
                                        <span>{totalEpisodesCurrent} capítulos estimados</span>
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
                                    {isParticipatingCurrent ? (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateAnimeProgress(currentWatchingAnime.id, myWatchedCurrent + 1)}
                                            disabled={myWatchedCurrent >= totalEpisodesCurrent}
                                            className="wp-btn-catchup d-flex align-items-center gap-1.5"
                                        >
                                            <Plus size={15} />
                                            <span>¡Vi el Cap {myWatchedCurrent + 1}!</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleJoinAnime(currentWatchingAnime.id, currentWatchingAnime.anime.mal_id)}
                                            disabled={isJoiningAnime}
                                            className="wp-btn-catchup d-flex align-items-center gap-1.5"
                                        >
                                            <Plus size={15} />
                                            <span>Participar</span>
                                        </button>
                                    )}

                                    {isOwner && (
                                        <button
                                            type="button"
                                            onClick={() => handleSetAnimeTarget(currentWatchingAnime.id, groupTargetCurrent + 1)}
                                            className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5"
                                            title="Avanzar la meta de maratón del grupo al siguiente episodio"
                                        >
                                            <span>Avanzar Meta (+1)</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Línea de Tiempo Dinámica de Capítulos según el anime */}
                            <div className="wp-timeline-box">
                                <div className="wp-timeline-header">
                                    <div className="d-flex align-items-center gap-2">
                                        <Layers size={16} style={{ color: 'var(--wp-acento)' }} />
                                        <span className="fw-bold text-white small">Línea de Tiempo de Capítulos ({totalEpisodesCurrent} eps)</span>
                                        <span className="small text-secondary font-mono">
                                            (Haz click en un capítulo para sincronizar tu avance)
                                        </span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = (airingEpisodesAvailable ?? totalEpisodesCurrent) + 1
                                                setAiringEpisodesAvailable(next)
                                            }}
                                            className="ml-btn ml-btn-fantasma ml-btn-sm d-flex align-items-center gap-1"
                                            title="Si la serie está en emisión, agrega el capítulo estrenado esta semana"
                                        >
                                            <Plus size={12} />
                                            <span>+ Sumar capítulo emitido</span>
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
                                                    width: `${Math.min(100, (Math.max(groupTargetCurrent, myWatchedCurrent) / Math.max(1, totalEpisodesCurrent)) * 100)}%`,
                                                }}
                                            />
                                        </div>

                                        {/* Hito Cap 0 / Inicio */}
                                        <div
                                            className="wp-timeline-milestone"
                                            onClick={() => handleUpdateAnimeProgress(currentWatchingAnime.id, 0)}
                                            title="Punto de partida (Capítulo 0)"
                                        >
                                            {/* Participantes en 0 */}
                                            {currentWatchingAnime.participations?.filter((p) => p.is_participating && p.episodes_watched === 0).length > 0 && (
                                                <div className="wp-milestone-users-stack">
                                                    {currentWatchingAnime.participations
                                                        .filter((p) => p.is_participating && p.episodes_watched === 0)
                                                        .map((p) => {
                                                            const cleanName = cleanUserName(p.guest_name)
                                                            const isMine = cleanName === userName || (userToken && p.guest_token === userToken)
                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    className={`wp-milestone-user-pin ${isMine ? 'is-mine' : ''}`}
                                                                    title={`${cleanName} (Inicio / 0 eps)`}
                                                                >
                                                                    {cleanName.slice(0, 2).toUpperCase()}
                                                                </div>
                                                            )
                                                        })}
                                                </div>
                                            )}
                                            <div className={`wp-milestone-node ${myWatchedCurrent >= 0 ? 'is-watched' : ''}`}>
                                                0
                                            </div>
                                            <span className="wp-milestone-label">Inicio</span>
                                        </div>

                                        {/* Hitos dinámicos para cada capítulo disponible de este anime */}
                                        {Array.from({ length: totalEpisodesCurrent }, (_, i) => i + 1).map((ep) => {
                                            const isWatchedByMe = myWatchedCurrent >= ep
                                            const isTarget = groupTargetCurrent === ep
                                            const isFuture = ep > (airingEpisodesAvailable ?? totalEpisodesCurrent)

                                            // Participantes posicionados exactamente en este capítulo
                                            const usersAtThisEp =
                                                currentWatchingAnime.participations?.filter(
                                                    (p) => p.is_participating && p.episodes_watched === ep
                                                ) || []

                                            return (
                                                <div
                                                    key={ep}
                                                    className={`wp-timeline-milestone ${isTarget ? 'is-active' : ''}`}
                                                    onClick={() => !isFuture && handleUpdateAnimeProgress(currentWatchingAnime.id, ep)}
                                                    title={`Capítulo ${ep}${isTarget ? ' (Meta actual del grupo)' : ''}`}
                                                >
                                                    {usersAtThisEp.length > 0 && (
                                                        <div className="wp-milestone-users-stack">
                                                            {usersAtThisEp.map((p) => {
                                                                const cleanName = cleanUserName(p.guest_name)
                                                                const isBehind = p.episodes_watched < groupTargetCurrent
                                                                const isMine = cleanName === userName || (userToken && p.guest_token === userToken)
                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        className={`wp-milestone-user-pin ${isMine ? 'is-mine' : ''} ${isBehind ? 'is-behind' : ''}`}
                                                                        title={`${cleanName} en Cap ${ep}${isBehind ? ' (Atrasado)' : ' (Al día)'}`}
                                                                    >
                                                                        {cleanName.slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

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
                                        {currentAnimeCatchup.length > 0 ? (
                                            <>
                                                <Clock size={16} className="text-warning flex-shrink-0" />
                                                <span className="small text-warning">
                                                    Poniéndose al día con la meta (Cap {groupTargetCurrent}):{' '}
                                                    <strong>
                                                        {currentAnimeCatchup.map((c) => `${c.cleanName} (-${c.behind})`).join(', ')}
                                                    </strong>
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                                                <span className="small text-success fw-semibold">
                                                    ✨ ¡Todos los participantes están al día con la meta actual!
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        <span className="small text-secondary">
                                            {isParticipatingCurrent ? (
                                                <>Tu avance: <strong>Cap {myWatchedCurrent}</strong> de {totalEpisodesCurrent}</>
                                            ) : (
                                                <span className="text-secondary opacity-75">No estás participando aún</span>
                                            )}
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

                                                        {/* 5. Acción (Solo el Creador puede coronar animes para maratón) */}
                                                        <td style={{ textAlign: 'right' }}>
                                                            {(() => {
                                                                const isWatchingCand = activeWatchingAnimes.some(
                                                                    (w) => w.anime_id === cand.anime_id
                                                                )

                                                                if (isOwner) {
                                                                    if (isWatchingCand) {
                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleToggleWatchingAnime(cand.anime_id)}
                                                                                className="ml-btn ml-btn-sm d-flex align-items-center gap-1.5 ms-auto"
                                                                                style={{
                                                                                    background: 'rgba(52, 211, 153, 0.15)',
                                                                                    borderColor: 'rgba(52, 211, 153, 0.4)',
                                                                                    color: '#34d399',
                                                                                    fontSize: '0.78rem',
                                                                                }}
                                                                                title="Anime activo en maratón. Haz click para desmarcar de la maratón grupal"
                                                                            >
                                                                                <Check size={12} />
                                                                                <span>Viendo (Quitar)</span>
                                                                            </button>
                                                                        )
                                                                    }
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleWatchingAnime(cand.anime_id)}
                                                                            className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5 ms-auto"
                                                                            style={{ fontSize: '0.78rem' }}
                                                                            title="Elegir este anime como ganador / añadir a maratón grupal"
                                                                        >
                                                                            <Crown size={12} />
                                                                            <span>Elegir para Ver</span>
                                                                        </button>
                                                                    )
                                                                }

                                                                if (isWatchingCand) {
                                                                    return (
                                                                        <span
                                                                            className="wp-pill-badge is-live ms-auto"
                                                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                                                        >
                                                                            <Check size={11} />
                                                                            <span>En Maratón</span>
                                                                        </span>
                                                                    )
                                                                }

                                                                return (
                                                                    <span className="small text-secondary font-mono d-block text-end" style={{ fontSize: '0.75rem' }}>
                                                                        Candidato
                                                                    </span>
                                                                )
                                                            })()}
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

            {/* Modal de Ajustes de la Sala Grupal (Solo Creador/Anfitrión) */}
            <Dialogo
                abierto={showSettingsModal}
                onCerrar={() => {
                    setShowSettingsModal(false)
                    setMemberToKick(null)
                    setShowDissolveConfirm(false)
                    setSettingsFeedback(null)
                }}
                etiqueta="Ajustes de la Sala Grupal"
                ancho={520}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <h3 className="h6 fw-bold text-white mb-0.5">Ajustes de la Lista Grupal</h3>
                            <p className="small text-secondary mb-0">
                                Gestiona los criterios de postulación y la administración de la sala.
                            </p>
                        </div>
                    </div>

                    {/* Selector de Subvistas de Ajustes */}
                    <div className="wp-settings-nav">
                        <button
                            type="button"
                            onClick={() => {
                                setSettingsTab('criterios')
                                setSettingsFeedback(null)
                            }}
                            className={`wp-settings-tab-btn ${settingsTab === 'criterios' ? 'active' : ''}`}
                        >
                            <SlidersHorizontal size={13} />
                            <span>Criterios</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSettingsTab('sala')
                                setSettingsFeedback(null)
                            }}
                            className={`wp-settings-tab-btn ${settingsTab === 'sala' ? 'active' : ''}`}
                        >
                            <Users size={13} />
                            <span>Sala y Miembros ({roomMembers.length})</span>
                        </button>
                    </div>

                    {settingsFeedback && (
                        <div
                            className={`small p-2.5 rounded-3 d-flex align-items-center gap-2 ${
                                settingsFeedback.startsWith('✓')
                                    ? 'text-success bg-success-subtle border border-success'
                                    : 'text-danger bg-danger-subtle border border-danger'
                            }`}
                            style={{ fontSize: '0.8rem' }}
                        >
                            {settingsFeedback.startsWith('✓') ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            <span>{settingsFeedback}</span>
                        </div>
                    )}

                    {/* SUBVISTA 1: CRITERIOS */}
                    {settingsTab === 'criterios' && (
                        <div className="d-flex flex-column gap-3">
                            <p className="small text-secondary mb-0" style={{ fontSize: '0.82rem' }}>
                                Configura qué tipos de animes se deben postular para que los miembros sigan esta guía al nominar.
                            </p>

                            <div>
                                <label className="form-label small text-white fw-semibold mb-1">
                                    Duración de Capítulos
                                </label>
                                <input
                                    type="text"
                                    value={criteriaDuration}
                                    onChange={(e) => setCriteriaDuration(e.target.value)}
                                    placeholder="Ej: 1-13 caps, 1-28 caps, Series cortas"
                                    className="form-control text-white wp-input"
                                />
                            </div>

                            <div>
                                <label className="form-label small text-white fw-semibold mb-1">
                                    Géneros Preferidos / Permitidos
                                </label>
                                <input
                                    type="text"
                                    value={criteriaGenres}
                                    onChange={(e) => setCriteriaGenres(e.target.value)}
                                    placeholder="Ej: Sci-Fi, Fantasía, Romance, Misterio"
                                    className="form-control text-white wp-input"
                                />
                            </div>

                            <div className="row g-2">
                                <div className="col-6">
                                    <label className="form-label small text-white fw-semibold mb-1">
                                        Rango de Años
                                    </label>
                                    <input
                                        type="text"
                                        value={criteriaYears}
                                        onChange={(e) => setCriteriaYears(e.target.value)}
                                        placeholder="Ej: 2010-2026 o Clásicos"
                                        className="form-control text-white wp-input"
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label small text-white fw-semibold mb-1">
                                        Formato Permitido
                                    </label>
                                    <select
                                        value={criteriaFormat}
                                        onChange={(e) => setCriteriaFormat(e.target.value)}
                                        className="form-select text-white wp-input"
                                    >
                                        <option value="Cualquiera">Cualquier formato</option>
                                        <option value="TV">Series TV</option>
                                        <option value="Movie">Películas</option>
                                        <option value="OVA">OVAs / Especiales</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="form-label small text-white fw-semibold mb-1">
                                    Nota Mínima Sugerida (MyAnimeList)
                                </label>
                                <select
                                    value={criteriaMinScore}
                                    onChange={(e) => setCriteriaMinScore(e.target.value)}
                                    className="form-select text-white wp-input"
                                >
                                    <option value="0">Cualquier puntuación</option>
                                    <option value="7.0">7.0 o superior</option>
                                    <option value="7.5">7.5 o superior (Recomendado)</option>
                                    <option value="8.0">8.0 o superior (Obras maestras)</option>
                                </select>
                            </div>

                            <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowSettingsModal(false)}
                                    className="ml-btn ml-btn-fantasma ml-btn-sm"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCriteria}
                                    disabled={isSavingSettings}
                                    className="ml-btn ml-btn-acento ml-btn-sm d-flex align-items-center gap-1.5"
                                >
                                    {isSavingSettings ? <Loader2 size={13} className="wp-spinner" /> : <Check size={13} />}
                                    <span>Guardar Criterios</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SUBVISTA 2: SALA */}
                    {settingsTab === 'sala' && (
                        <div className="d-flex flex-column gap-3">
                            {/* Límite Máximo de Miembros */}
                            <div className="wp-settings-section">
                                <label className="form-label small text-white fw-semibold mb-1">
                                    Límite de Miembros Máximo
                                </label>
                                <p className="small text-secondary mb-2" style={{ fontSize: '0.78rem' }}>
                                    Define la cantidad máxima de integrantes permitidos en la sala grupal.
                                </p>
                                <div className="d-flex align-items-center gap-2">
                                    <input
                                        type="number"
                                        min={2}
                                        max={100}
                                        value={roomMaxMembers}
                                        onChange={(e) => setRoomMaxMembers(Math.max(2, Math.min(100, parseInt(e.target.value, 10) || 2)))}
                                        className="form-control text-white wp-input"
                                        style={{ width: '90px' }}
                                    />
                                    <span className="small text-secondary">
                                        ({roomMembers.length} de {roomMaxMembers} cupos ocupados)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleSaveMaxMembers}
                                        disabled={isSavingSettings}
                                        className="ml-btn ml-btn-acento ml-btn-sm ms-auto d-flex align-items-center gap-1.5"
                                    >
                                        {isSavingSettings ? <Loader2 size={13} className="wp-spinner" /> : <Check size={13} />}
                                        <span>Guardar Cupo</span>
                                    </button>
                                </div>
                            </div>

                            {/* Gestión de Integrantes & Expulsiones */}
                            <div className="wp-settings-section">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <label className="form-label small text-white fw-semibold mb-0">
                                        Integrantes de la Sala ({roomMembers.length})
                                    </label>
                                    {user && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowSettingsModal(false)
                                                handleOpenInviteFriendsModal()
                                            }}
                                            className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1 py-1 px-2.5"
                                            style={{ fontSize: '0.73rem' }}
                                        >
                                            <UserPlus size={12} />
                                            <span>Invitar Amigos</span>
                                        </button>
                                    )}
                                </div>

                                <div className="wp-members-manage-list">
                                    {roomMembers.map((m) => {
                                        const isMemberOwner = m.role === 'owner'
                                        return (
                                            <div key={m.id} className="wp-member-manage-row">
                                                <div className="d-flex align-items-center gap-2.5 min-w-0">
                                                    <div className="wp-member-avatar-badge">
                                                        {cleanUserName(m.guest_name).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="d-flex align-items-center gap-1.5">
                                                            <span className="small text-white fw-semibold text-truncate">
                                                                {cleanUserName(m.guest_name)}
                                                            </span>
                                                            {isMemberOwner && (
                                                                <span className="wp-badge-owner">
                                                                    <Crown size={10} /> Creador
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="small text-secondary d-block" style={{ fontSize: '0.72rem' }}>
                                                            Cap. {m.episodes_watched} • {m.sync_status === 'al_dia' ? 'Al día' : `${m.episodes_behind} atrasado`}
                                                        </span>
                                                    </div>
                                                </div>

                                                {!isMemberOwner && (
                                                    <div>
                                                        {memberToKick?.id === m.id ? (
                                                            <div className="d-flex align-items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleKickMember(m)}
                                                                    disabled={isKickingMember}
                                                                    className="ml-btn ml-btn-sm text-danger"
                                                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                                                    title="Confirmar expulsión"
                                                                >
                                                                    {isKickingMember ? <Loader2 size={11} className="wp-spinner" /> : 'Confirmar'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setMemberToKick(null)}
                                                                    className="ml-btn ml-btn-fantasma ml-btn-sm"
                                                                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setMemberToKick(m)}
                                                                className="ml-btn ml-btn-fantasma ml-btn-sm text-danger d-flex align-items-center gap-1"
                                                                style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
                                                                title={`Expulsar a ${cleanUserName(m.guest_name)}`}
                                                            >
                                                                <UserMinus size={12} />
                                                                <span>Expulsar</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Zona de Peligro: Disolver Sala */}
                            <div className="wp-danger-zone">
                                <div className="d-flex align-items-start gap-2.5">
                                    <ShieldAlert size={18} className="text-danger flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h4 className="small fw-bold text-white mb-1">Zona de Peligro</h4>
                                        <p className="small text-secondary mb-2" style={{ fontSize: '0.78rem' }}>
                                            Disolver esta lista grupal borrará definitivamente las votaciones, historial de chat y expulsará a todos los integrantes.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowDissolveConfirm(true)}
                                            className="ml-btn ml-btn-sm text-danger d-flex align-items-center gap-1.5"
                                            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)' }}
                                        >
                                            <Trash2 size={13} />
                                            <span>Disolver Lista Grupal</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Dialogo>

            {/* Modal de Confirmación para Disolver la Sala */}
            <Dialogo
                abierto={showDissolveConfirm}
                onCerrar={() => setShowDissolveConfirm(false)}
                etiqueta="Confirmar Disolución de Sala"
                ancho={420}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
                            style={{ width: '42px', height: '42px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
                        >
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h3 className="h6 fw-bold text-white mb-1">¿Disolver esta Lista Grupal?</h3>
                            <p className="small text-secondary mb-0">
                                Esta acción es <strong className="text-white">irreversible</strong>. Se eliminará permanentemente la sala <span className="text-white fw-bold">"{room?.name}"</span> y todos sus datos.
                            </p>
                        </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--wp-border)' }}>
                        <button
                            type="button"
                            onClick={() => setShowDissolveConfirm(false)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                            disabled={isDissolving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleDissolveRoom}
                            disabled={isDissolving}
                            className="ml-btn ml-btn-sm text-white d-flex align-items-center gap-1.5"
                            style={{ background: '#dc2626', borderColor: '#dc2626' }}
                        >
                            {isDissolving ? <Loader2 size={13} className="wp-spinner" /> : <Trash2 size={13} />}
                            <span>Sí, Disolver Sala</span>
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

            {/* Modal para Invitar Amigos de Animigos a la Lista Grupal (Solo Creador) */}
            <Dialogo
                abierto={showInviteFriendsModal}
                onCerrar={() => setShowInviteFriendsModal(false)}
                etiqueta="Invitar Amigos a la Sala"
                ancho={520}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">ANFITRIÓN DE LISTA GRUPAL</span>
                        <h3 className="h6 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                            <UserPlus size={16} style={{ color: 'var(--wp-accent, #a78bfa)' }} />
                            <span>Invitar Amigos a "{room?.name}"</span>
                        </h3>
                        <p className="small text-secondary mb-0" style={{ fontSize: '0.78rem' }}>
                            Selecciona a tus amigos para sumarlos directamente a esta sala y enviarles una notificación con acceso directo.
                        </p>
                    </div>

                    {/* Código rápido por si también quiere copiarlo */}
                    {room?.invite_code && (
                        <div
                            className="d-flex align-items-center justify-content-between gap-2 p-2.5 rounded-3"
                            style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="small">
                                <span className="text-secondary">Código de invitación: </span>
                                <strong className="text-white font-mono">{room.invite_code}</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(room.invite_code)}
                                className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
                                style={{ fontSize: '0.74rem' }}
                            >
                                {copiedCode === room.invite_code ? <Check size={12} /> : <Share2 size={12} />}
                                <span>{copiedCode === room.invite_code ? 'Enlace copiado' : 'Copiar enlace'}</span>
                            </button>
                        </div>
                    )}

                    {/* Buscador local entre amigos */}
                    {myFriends.length > 0 && (
                        <div className="position-relative">
                            <Search
                                size={14}
                                className="position-absolute text-secondary"
                                style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }}
                            />
                            <input
                                type="text"
                                placeholder="Filtrar mis amigos..."
                                value={inviteFriendQuery}
                                onChange={(e) => setInviteFriendQuery(e.target.value)}
                                className="form-control text-white wp-input"
                                style={{ paddingLeft: 34, paddingRight: inviteFriendQuery ? 32 : 12, fontSize: '0.82rem' }}
                            />
                            {inviteFriendQuery && (
                                <button
                                    type="button"
                                    onClick={() => setInviteFriendQuery('')}
                                    className="btn btn-sm p-0 text-secondary border-0 position-absolute"
                                    style={{ right: 12, top: '50%', transform: 'translateY(-50%)' }}
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    )}

                    {inviteFeedback && (
                        <div
                            className={`small p-2.5 rounded-3 d-flex align-items-center gap-2 ${
                                inviteFeedback.isError
                                    ? 'text-danger bg-danger-subtle border border-danger'
                                    : 'text-success bg-success-subtle border border-success'
                            }`}
                            style={{ fontSize: '0.78rem' }}
                        >
                            {inviteFeedback.isError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                            <span>{inviteFeedback.text}</span>
                        </div>
                    )}

                    {/* Lista de amigos del creador */}
                    <div
                        className="d-flex flex-column gap-2"
                        style={{ maxHeight: '320px', overflowY: 'auto' }}
                    >
                        {loadingMyFriends ? (
                            <div className="text-center py-4 text-secondary small">
                                <Loader2 size={18} className="wp-spinner me-2" />
                                <span>Cargando tu lista de amigos...</span>
                            </div>
                        ) : myFriends.length === 0 ? (
                            <div
                                className="p-3 rounded-3 text-center text-secondary small"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                Aún no tienes amigos confirmados en tu perfil. Puedes agregarlos desde{' '}
                                <a
                                    href="/perfil"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setShowInviteFriendsModal(false)
                                        navigate('/perfil')
                                    }}
                                    className="text-white fw-semibold"
                                >
                                    Mi Perfil → Amigos
                                </a>{' '}
                                o compartir el código <strong className="text-white">{room?.invite_code}</strong>.
                            </div>
                        ) : (
                            myFriends
                                .filter((f) => {
                                    const q = inviteFriendQuery.trim().toLowerCase()
                                    if (!q) return true
                                    return (
                                        f.display_name.toLowerCase().includes(q) ||
                                        f.username.toLowerCase().includes(q)
                                    )
                                })
                                .map((friend) => {
                                    const isAlreadyMember = roomMembers.some(
                                        (m) =>
                                            m.guest_token === `user_${friend.id}` ||
                                            m.cleanName.toLowerCase() === friend.display_name.toLowerCase() ||
                                            m.cleanName.toLowerCase() === friend.username.toLowerCase()
                                    )
                                    const isInvitingThis = invitingFriendId === friend.id

                                    return (
                                        <div
                                            key={friend.id}
                                            className="d-flex align-items-center justify-content-between gap-2 p-2.5 rounded-3"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(255, 255, 255, 0.07)',
                                            }}
                                        >
                                            <div className="d-flex align-items-center gap-2.5 min-w-0">
                                                <img
                                                    src={
                                                        resolveMediaUrl(friend.avatar_url) ||
                                                        resolveMediaUrl(
                                                            '/media/avatars/crunchyroll_classic_collection/classic-hime-avatar-1.webp'
                                                        )
                                                    }
                                                    crossOrigin="anonymous"
                                                    alt={friend.display_name}
                                                    className="rounded-circle flex-shrink-0"
                                                    style={{ width: 38, height: 38, objectFit: 'cover' }}
                                                />
                                                <div className="min-w-0">
                                                    <div className="small fw-bold text-white text-truncate">
                                                        {friend.display_name}
                                                    </div>
                                                    <div
                                                        className="small text-secondary font-mono text-truncate"
                                                        style={{ fontSize: '0.72rem' }}
                                                    >
                                                        @{friend.username}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={isInvitingThis}
                                                onClick={() => handleInviteFriendToRoom(friend)}
                                                className={`ml-btn ml-btn-sm d-inline-flex align-items-center gap-1.5 flex-shrink-0 ${
                                                    isAlreadyMember ? 'ml-btn-fantasma' : 'ml-btn-acento'
                                                }`}
                                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                                                title={
                                                    isAlreadyMember
                                                        ? 'Ya está en la sala · Clic para reenviar notificación'
                                                        : `Invitar a ${friend.display_name} a la sala`
                                                }
                                            >
                                                {isInvitingThis ? (
                                                    <Loader2 size={13} className="wp-spinner" />
                                                ) : isAlreadyMember ? (
                                                    <Check size={13} />
                                                ) : (
                                                    <UserPlus size={13} />
                                                )}
                                                <span>{isAlreadyMember ? 'En la sala' : 'Invitar'}</span>
                                            </button>
                                        </div>
                                    )
                                })
                        )}
                    </div>

                    <div
                        className="d-flex justify-content-end pt-2 border-top"
                        style={{ borderColor: 'var(--wp-border)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setShowInviteFriendsModal(false)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Dialogo>
        </div>
    )
}

export default WatchPartyRoom
