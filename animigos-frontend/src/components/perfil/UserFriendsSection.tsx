import React, { useState, useEffect, useCallback } from 'react'
import { navigate } from '../../utils/navigation'
import {
    Users,
    UserPlus,
    UserCheck,
    Search,
    Film,
    Sparkles,
    X,
    Check,
    Clock,
    UserMinus,
    Tv,
    Loader2,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import {
    fetchFriendsOverview,
    sendFriendRequest,
    respondFriendRequest,
    cancelFriendRequest,
    removeFriend,
    fetchSuggestedFriends,
    type FriendUser,
    type FriendRequestItem,
} from '../../services/friendsApi'
import { resolveMediaUrl } from '../../utils/mediaUrl'

interface UserFriendsSectionProps {
    currentUserUsername?: string
    readOnly?: boolean
    initialFriends?: FriendUser[]
    onSelectUserProfile?: (username: string) => void
    onFriendsSummaryChange?: (summary: { friendsCount: number; pendingRequestsCount: number }) => void
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'

const formatMutualLabel = (count?: number): string => {
    const n = count || 0
    return n === 1 ? '1 amigo en común' : `${n} amigos en común`
}

export const UserFriendsSection: React.FC<UserFriendsSectionProps> = ({
    currentUserUsername,
    readOnly = false,
    initialFriends,
    onSelectUserProfile,
    onFriendsSummaryChange,
}) => {
    const [friends, setFriends] = useState<FriendUser[]>(initialFriends || [])
    const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([])
    const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([])
    const [suggested, setSuggested] = useState<FriendUser[]>([])
    const [loading, setLoading] = useState(!readOnly)

    const navigateToUserProfile = (uname: string) => {
        if (!uname) return
        if (onSelectUserProfile) {
            onSelectUserProfile(uname)
        } else {
            navigate(`/perfil/${encodeURIComponent(uname)}`)
        }
    }

    // Filtro rápido local de "Mis Amigos" (aplica a solicitudes y amigos)
    const [searchQuery, setSearchQuery] = useState('')

    // Modales
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isAllFriendsModalOpen, setIsAllFriendsModalOpen] = useState(false)
    const [isAllSuggestionsModalOpen, setIsAllSuggestionsModalOpen] = useState(false)

    // Buscador propio dentro del modal de "Agregar Amigo"
    const [modalSearchInput, setModalSearchInput] = useState('')
    const [modalSearchResults, setModalSearchResults] = useState<FriendUser[]>([])
    const [modalSearchLoading, setModalSearchLoading] = useState(false)
    const [addLoading, setAddLoading] = useState(false)
    const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null)
    const [inlineFeedback, setInlineFeedback] = useState<{ text: string; isError: boolean } | null>(null)
    const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)

    const showInlineToast = (text: string, isError = false) => {
        setInlineFeedback({ text, isError })
        window.setTimeout(() => {
            setInlineFeedback((prev) => (prev?.text === text ? null : prev))
        }, 3200)
    }

    // Cargar amigos, solicitudes pendientes y sugerencias ordenadas por amigos en común
    const loadFriendsData = useCallback(async () => {
        try {
            setLoading(true)
            const [overviewRes, suggestedRes] = await Promise.all([
                fetchFriendsOverview().catch(() => ({
                    friends: [],
                    incoming_requests: [],
                    outgoing_requests: [],
                    pending_count: 0,
                    total: 0,
                })),
                fetchSuggestedFriends().catch(() => []),
            ])
            setFriends(overviewRes.friends)
            setIncomingRequests(overviewRes.incoming_requests)
            setOutgoingRequests(overviewRes.outgoing_requests)
            setSuggested(suggestedRes)
            onFriendsSummaryChange?.({
                friendsCount: overviewRes.friends.length,
                pendingRequestsCount: overviewRes.incoming_requests.length,
            })
        } finally {
            setLoading(false)
        }
    }, [onFriendsSummaryChange])

    useEffect(() => {
        if (readOnly && initialFriends) {
            setFriends(initialFriends)
            setIncomingRequests([])
            setOutgoingRequests([])
            fetchSuggestedFriends()
                .then((res) => setSuggested(res))
                .catch(() => setSuggested([]))
            setLoading(false)
            return
        }
        loadFriendsData()
    }, [currentUserUsername, readOnly, initialFriends, loadFriendsData])

    // Búsqueda reactiva dentro del modal de "Agregar Amigo"
    useEffect(() => {
        if (!isAddModalOpen) return
        let cancelled = false
        const timer = setTimeout(async () => {
            setModalSearchLoading(true)
            try {
                const res = await fetchSuggestedFriends(modalSearchInput)
                if (!cancelled) setModalSearchResults(res)
            } catch {
                if (!cancelled) setModalSearchResults([])
            } finally {
                if (!cancelled) setModalSearchLoading(false)
            }
        }, 220)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [isAddModalOpen, modalSearchInput, friends.length, outgoingRequests.length, incomingRequests.length])

    const handleSendRequest = async (targetQuery: string, closeModalOnSuccess = false, key?: string) => {
        if (!targetQuery.trim()) return
        if (key) setActionLoadingKey(key)
        setAddLoading(true)
        setFeedbackMsg(null)
        try {
            const res = await sendFriendRequest(targetQuery.trim())
            const msg = res.message || 'Solicitud de amistad enviada.'
            if (isAddModalOpen) {
                setFeedbackMsg({ text: msg, isError: false })
            } else {
                showInlineToast(msg, false)
            }
            await loadFriendsData()
            if (closeModalOnSuccess) {
                setTimeout(() => {
                    setFeedbackMsg(null)
                    setModalSearchInput('')
                    setIsAddModalOpen(false)
                }, 1200)
            } else if (isAddModalOpen) {
                setTimeout(() => setFeedbackMsg(null), 2600)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al enviar la solicitud de amistad.'
            if (isAddModalOpen) {
                setFeedbackMsg({ text: message, isError: true })
            } else {
                showInlineToast(message, true)
            }
        } finally {
            setAddLoading(false)
            if (key) setActionLoadingKey(null)
        }
    }

    const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
        const key = `${action}:${requestId}`
        setActionLoadingKey(key)
        try {
            const res = await respondFriendRequest(requestId, action)
            showInlineToast(
                res.message || (action === 'accept' ? '¡Solicitud aceptada!' : 'Solicitud rechazada.'),
                false
            )
            await loadFriendsData()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo procesar la solicitud.'
            showInlineToast(message, true)
        } finally {
            setActionLoadingKey(null)
        }
    }

    const handleCancelRequest = async (requestId: string) => {
        const key = `cancel:${requestId}`
        setActionLoadingKey(key)
        try {
            const res = await cancelFriendRequest(requestId)
            showInlineToast(res.message || 'Solicitud cancelada.', false)
            await loadFriendsData()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo cancelar la solicitud.'
            showInlineToast(message, true)
        } finally {
            setActionLoadingKey(null)
        }
    }

    const handleRemoveFriend = async (id: number, name: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${name} de tus amigos?`)) return
        const key = `remove:${id}`
        setActionLoadingKey(key)
        try {
            await removeFriend(id)
            setFriends((prev) => prev.filter((f) => f.id !== id))
            await loadFriendsData()
        } catch (e) {
            console.error('Error eliminando amigo:', e)
        } finally {
            setActionLoadingKey(null)
        }
    }

    const q = searchQuery.toLowerCase().trim()

    const filteredIncoming = incomingRequests.filter((req) => {
        if (!q) return true
        return (
            req.display_name.toLowerCase().includes(q) ||
            req.username.toLowerCase().includes(q) ||
            (req.bio && req.bio.toLowerCase().includes(q))
        )
    })

    const filteredFriends = friends.filter((f) => {
        if (!q) return true
        return (
            f.display_name.toLowerCase().includes(q) ||
            f.username.toLowerCase().includes(q) ||
            (f.bio && f.bio.toLowerCase().includes(q))
        )
    })

    const visibleIncoming = !readOnly ? filteredIncoming.slice(0, 4) : []
    const topFriends = filteredFriends.slice(0, 4)
    const topSuggested = suggested.slice(0, 2)

    const renderSuggestionFooter = (sug: FriendUser) => {
        if ((sug.mutual_friends_count || 0) > 0) {
            return (
                <span className="perfil-friend-list-count perfil-friend-mutual-badge">
                    <Users size={11} style={{ color: 'var(--perfil-acento)', flexShrink: 0 }} />
                    <span className="text-truncate">{formatMutualLabel(sug.mutual_friends_count)}</span>
                </span>
            )
        }
        return (
            <span className="perfil-friend-list-count">
                <Film size={11} style={{ color: 'var(--perfil-acento)', flexShrink: 0 }} />
                <span className="text-truncate">{sug.anime_count || 0} en su lista</span>
            </span>
        )
    }

    const renderSuggestionActionButton = (sug: FriendUser, compactIconOnly = false) => {
        if (readOnly) return null
        const status = sug.friendship_status || 'none'
        const sendKey = `send:${sug.id}`
        const acceptKey = sug.request_id ? `accept:${sug.request_id}` : ''
        const cancelKey = sug.request_id ? `cancel:${sug.request_id}` : ''
        const isBusy =
            actionLoadingKey === sendKey ||
            (acceptKey !== '' && actionLoadingKey === acceptKey) ||
            (cancelKey !== '' && actionLoadingKey === cancelKey)

        if (status === 'pending_sent') {
            if (compactIconOnly) {
                return (
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (sug.request_id) handleCancelRequest(sug.request_id)
                        }}
                        className="perfil-friend-quick-add-btn is-pending"
                        title="Solicitud enviada · Haz clic para cancelar"
                    >
                        {isBusy ? <Loader2 size={12} className="spinner-border spinner-border-sm" /> : <Clock size={13} />}
                    </button>
                )
            }
            return (
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                        if (sug.request_id) handleCancelRequest(sug.request_id)
                    }}
                    className="perfil-friend-req-btn-ghost py-1 px-2.5 flex-shrink-0"
                    style={{ fontSize: '0.72rem' }}
                    title="Cancelar solicitud enviada"
                >
                    <Clock size={12} />
                    <span>Enviada</span>
                </button>
            )
        }

        if (status === 'pending_received' && sug.request_id) {
            if (compactIconOnly) {
                return (
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => {
                            e.stopPropagation()
                            handleRespondRequest(sug.request_id!, 'accept')
                        }}
                        className="perfil-friend-quick-add-btn is-incoming"
                        title={`Aceptar solicitud de ${sug.display_name}`}
                    >
                        {isBusy ? <Loader2 size={12} className="spinner-border spinner-border-sm" /> : <UserCheck size={13} />}
                    </button>
                )
            }
            return (
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRespondRequest(sug.request_id!, 'accept')}
                    className="perfil-friends-add-pill-btn py-1 px-2.5 flex-shrink-0"
                    style={{ fontSize: '0.72rem' }}
                >
                    <Check size={12} />
                    <span>Aceptar</span>
                </button>
            )
        }

        if (compactIconOnly) {
            return (
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                        e.stopPropagation()
                        handleSendRequest(sug.username, false, sendKey)
                    }}
                    className="perfil-friend-quick-add-btn"
                    title={`Enviar solicitud de amistad a ${sug.display_name}`}
                >
                    {isBusy ? <Loader2 size={12} className="spinner-border spinner-border-sm" /> : <UserPlus size={13} />}
                </button>
            )
        }

        return (
            <button
                type="button"
                disabled={addLoading || isBusy}
                onClick={() => handleSendRequest(sug.username, false, sendKey)}
                className="perfil-friends-add-pill-btn py-1 px-2.5 flex-shrink-0"
                style={{ fontSize: '0.72rem' }}
            >
                <UserPlus size={12} />
                <span>Solicitar</span>
            </button>
        )
    }

    return (
        <div className="perfil-friends-container">
            {/* 1. Cabecera Principal: Icono + Mis Amigos + Contadores + Subtítulo */}
            <div className="d-flex align-items-center gap-2.5 mb-3">
                <div
                    className="rounded-3 p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--perfil-acento) 18%, transparent)',
                        color: 'var(--perfil-acento)',
                        width: '38px',
                        height: '38px',
                    }}
                >
                    <Users size={18} />
                </div>
                <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <h2 className="h6 fw-bold text-white ms-4 mb-0" style={{ fontSize: '1.02rem' }}>
                            {readOnly ? 'Amigos' : 'Mis Amigos'}
                        </h2>
                        <span
                            className="badge rounded-pill px-2.5 py-0.5"
                            style={{
                                background: 'color-mix(in srgb, var(--perfil-acento) 22%, transparent)',
                                color: 'var(--perfil-acento)',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                            }}
                        >
                            {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
                        </span>
                        {!readOnly && incomingRequests.length > 0 && (
                            <span className="perfil-friends-requests-counter-pill">
                                <UserPlus size={11} />
                                <span>
                                    {incomingRequests.length}{' '}
                                    {incomingRequests.length === 1 ? 'solicitud' : 'solicitudes'}
                                </span>
                            </span>
                        )}
                    </div>
                    <p className="small ms-4 mb-0 text-secondary" style={{ fontSize: '0.78rem' }}>
                        Compañeros para ver anime, coordinar maratones y compartir listas.
                    </p>
                </div>
            </div>

            {inlineFeedback && (
                <div
                    className={`perfil-friends-toast mb-3 ${inlineFeedback.isError ? 'is-error' : ''}`}
                    role="status"
                >
                    <span>{inlineFeedback.text}</span>
                    <button
                        type="button"
                        onClick={() => setInlineFeedback(null)}
                        className="perfil-friends-filter-clear"
                        aria-label="Cerrar aviso"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* 2. Layout Dividido: Izquierda (Solicitudes primero + Mis Amigos) | Derecha (Sugerencias por amigos en común) */}
            <div className="perfil-friends-split-layout">
                {/* ==================== BLOQUE IZQUIERDO: SOLICITUDES + MIS AMIGOS ==================== */}
                <div className="perfil-friends-left-zone">
                    {/* Barra de control superior: Input de filtro rápido a la izquierda + Botones a la derecha */}
                    <div className="perfil-friends-toolbar">
                        <div className="perfil-friends-filter-input-wrap">
                            <Search size={14} className="perfil-friends-filter-icon" />
                            <input
                                type="text"
                                placeholder={
                                    !readOnly && incomingRequests.length > 0
                                        ? 'Buscar solicitudes o amigos...'
                                        : 'Buscar amigos...'
                                }
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="perfil-friends-filter-input"
                                aria-label="Filtrar solicitudes y amigos rápidamente"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="perfil-friends-filter-clear"
                                    aria-label="Limpiar filtro"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <div className="perfil-friends-toolbar-actions">
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFeedbackMsg(null)
                                        setModalSearchInput('')
                                        setIsAddModalOpen(true)
                                    }}
                                    className="perfil-friends-add-pill-btn"
                                >
                                    <UserPlus size={14} />
                                    <span>Agregar Amigo</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setIsAllFriendsModalOpen(true)}
                                className="perfil-friends-vermas-header-btn"
                                title="Ver todas las solicitudes y amigos"
                            >
                                VER MAS
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-4">
                            <Loader2 size={20} className="spinner-border text-secondary" />
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-3">
                            {/* PRIMERO: SOLICITUDES DE AMISTAD RECIBIDAS (solo en el perfil propio) */}
                            {!readOnly && visibleIncoming.length > 0 && (
                                <div className="perfil-friends-requests-block">
                                    <div className="perfil-friends-sublabel">
                                        <span className="perfil-friends-sublabel-dot" />
                                        <span>
                                            Solicitudes de amistad ({filteredIncoming.length})
                                        </span>
                                        {filteredIncoming.length > 4 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsAllFriendsModalOpen(true)}
                                                className="perfil-friends-sublabel-more"
                                            >
                                                Ver todas
                                            </button>
                                        )}
                                    </div>

                                    <div className="perfil-friends-grid-4">
                                        {visibleIncoming.map((req) => {
                                            const isAccepting = actionLoadingKey === `accept:${req.request_id}`
                                            const isRejecting = actionLoadingKey === `reject:${req.request_id}`
                                            const isBusy = isAccepting || isRejecting
                                            return (
                                                <div
                                                    key={req.request_id}
                                                    className="perfil-friend-compact-card perfil-friend-request-card"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => navigateToUserProfile(req.username)}
                                                    title={`Visitar el perfil de ${req.display_name} (@${req.username})`}
                                                >
                                                    <div className="perfil-friend-card-top">
                                                        <div className="position-relative flex-shrink-0">
                                                            <img
                                                                src={resolveMediaUrl(req.avatar_url) || DEFAULT_AVATAR}
                                                                crossOrigin="anonymous"
                                                                alt={req.display_name}
                                                                className="perfil-friend-avatar"
                                                                onError={(e) => {
                                                                    e.currentTarget.src = DEFAULT_AVATAR
                                                                }}
                                                            />
                                                            <span
                                                                className="perfil-friend-request-dot"
                                                                title="Solicitud pendiente"
                                                            />
                                                        </div>

                                                        <div className="perfil-friend-card-info">
                                                            <span
                                                                className="perfil-friend-name"
                                                                title={req.display_name}
                                                            >
                                                                {req.display_name}
                                                            </span>
                                                            <span className="perfil-friend-handle">
                                                                @{req.username}
                                                            </span>
                                                            <span className="perfil-friend-bio">
                                                                {(req.mutual_friends_count || 0) > 0
                                                                    ? formatMutualLabel(req.mutual_friends_count)
                                                                    : 'Quiere ser tu amigo'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className="perfil-friend-request-actions"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => handleRespondRequest(req.request_id, 'accept')}
                                                            className="perfil-friend-req-btn-accept"
                                                            title={`Aceptar solicitud de ${req.display_name}`}
                                                        >
                                                            {isAccepting ? (
                                                                <Loader2 size={11} className="spinner-border spinner-border-sm" />
                                                            ) : (
                                                                <Check size={12} />
                                                            )}
                                                            <span>Aceptar</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => handleRespondRequest(req.request_id, 'reject')}
                                                            className="perfil-friend-req-btn-reject"
                                                            title={`Rechazar solicitud de ${req.display_name}`}
                                                            aria-label={`Rechazar solicitud de ${req.display_name}`}
                                                        >
                                                            {isRejecting ? (
                                                                <Loader2 size={11} className="spinner-border spinner-border-sm" />
                                                            ) : (
                                                                <X size={12} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* SEGUNDO: AMIGOS CONFIRMADOS */}
                            {!readOnly && visibleIncoming.length > 0 && topFriends.length > 0 && (
                                <div className="perfil-friends-sublabel is-muted">
                                    <span>Tus amigos ({filteredFriends.length})</span>
                                </div>
                            )}

                            {topFriends.length > 0 ? (
                                <div className="perfil-friends-grid-4">
                                    {topFriends.map((friend) => (
                                        <div
                                            key={friend.id}
                                            className="perfil-friend-compact-card"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => navigateToUserProfile(friend.username)}
                                            title={`Visitar el perfil de ${friend.display_name} (@${friend.username})`}
                                        >
                                            <div className="perfil-friend-card-top">
                                                <div className="position-relative flex-shrink-0">
                                                    <img
                                                        src={resolveMediaUrl(friend.avatar_url) || DEFAULT_AVATAR}
                                                        crossOrigin="anonymous"
                                                        alt={friend.display_name}
                                                        className="perfil-friend-avatar"
                                                        onError={(e) => {
                                                            e.currentTarget.src = DEFAULT_AVATAR
                                                        }}
                                                    />
                                                    <span
                                                        className="perfil-friend-online-dot"
                                                        title="En línea"
                                                    />
                                                </div>

                                                <div className="perfil-friend-card-info">
                                                    <span
                                                        className="perfil-friend-name"
                                                        title={friend.display_name}
                                                    >
                                                        {friend.display_name}
                                                    </span>
                                                    <span className="perfil-friend-handle">
                                                        @{friend.username}
                                                    </span>
                                                    <span
                                                        className="perfil-friend-bio"
                                                        title={friend.bio || '¡Hola! Estoy usando Animigos'}
                                                    >
                                                        {friend.bio || '¡Hola! Estoy usando Animigos'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="perfil-friend-card-footer">
                                                <span className="perfil-friend-list-count">
                                                    <Film size={11} style={{ color: 'var(--perfil-acento)', flexShrink: 0 }} />
                                                    <span className="text-truncate">{friend.anime_count || 0} en su lista</span>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : visibleIncoming.length === 0 ? (
                                <div
                                    className="p-3 rounded-3 text-center border d-flex align-items-center justify-content-center"
                                    style={{
                                        background: '#14141a',
                                        borderColor: 'rgba(255,255,255,0.06)',
                                        minHeight: '112px',
                                    }}
                                >
                                    <span className="small text-secondary" style={{ fontSize: '0.76rem' }}>
                                        {searchQuery
                                            ? `No se encontraron amigos ni solicitudes que coincidan con "${searchQuery}".`
                                            : readOnly
                                                ? 'Este usuario aún no tiene amigos agregados.'
                                                : 'Aún no tienes amigos agregados. ¡Envía una solicitud con "Agregar Amigo" o conecta con las sugerencias!'}
                                    </span>
                                </div>
                            ) : (
                                <div
                                    className="px-3 py-2 rounded-3 text-center border"
                                    style={{
                                        background: '#14141a',
                                        borderColor: 'rgba(255,255,255,0.05)',
                                    }}
                                >
                                    <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                        Acepta una solicitud arriba para sumar tu primer amigo a esta lista.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ==================== BLOQUE DERECHO: SUGERENCIAS POR AMIGOS EN COMÚN ==================== */}
                <div className="perfil-friends-right-zone">
                    <div className="perfil-friends-toolbar">
                        <h3
                            className="fw-bold text-white text-uppercase mb-0"
                            style={{ fontSize: '0.8rem', letterSpacing: '0.8px' }}
                        >
                            SUGERENCIAS
                        </h3>

                        <button
                            type="button"
                            onClick={() => setIsAllSuggestionsModalOpen(true)}
                            className="perfil-friends-vermas-header-btn"
                            title="Ver todas las sugerencias ordenadas por amigos en común"
                        >
                            VER MAS
                        </button>
                    </div>

                    {topSuggested.length > 0 ? (
                        <div className="perfil-friends-grid-2">
                            {topSuggested.map((sug) => (
                                <div
                                    key={sug.id}
                                    className="perfil-friend-compact-card"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigateToUserProfile(sug.username)}
                                    title={`Visitar el perfil de ${sug.display_name} (@${sug.username})`}
                                >
                                    <div className="perfil-friend-card-top">
                                        <div className="position-relative flex-shrink-0">
                                            <img
                                                src={resolveMediaUrl(sug.avatar_url) || DEFAULT_AVATAR}
                                                crossOrigin="anonymous"
                                                alt={sug.display_name}
                                                className="perfil-friend-avatar"
                                                onError={(e) => {
                                                    e.currentTarget.src = DEFAULT_AVATAR
                                                }}
                                            />
                                            <span
                                                className="perfil-friend-online-dot"
                                                title="En línea"
                                            />
                                        </div>

                                        <div className="perfil-friend-card-info">
                                            <div className="d-flex align-items-center justify-content-between gap-1">
                                                <span
                                                    className="perfil-friend-name"
                                                    title={sug.display_name}
                                                >
                                                    {sug.display_name}
                                                </span>
                                                {renderSuggestionActionButton(sug, true)}
                                            </div>
                                            <span className="perfil-friend-handle">
                                                @{sug.username}
                                            </span>
                                            <span
                                                className="perfil-friend-bio"
                                                title={sug.bio || '¡Hola! Estoy usando Animigos'}
                                            >
                                                {sug.bio || '¡Hola! Estoy usando Animigos'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="perfil-friend-card-footer">
                                        {renderSuggestionFooter(sug)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            className="p-3 rounded-3 text-center border d-flex align-items-center justify-content-center"
                            style={{
                                background: '#14141a',
                                borderColor: 'rgba(255,255,255,0.06)',
                                minHeight: '112px',
                            }}
                        >
                            <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                No hay nuevas sugerencias por ahora.
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================================
                MODAL 1: ENVIAR SOLICITUD DE AMISTAD (CON BUSCADOR DE USUARIOS)
               ========================================================================= */}
            <Dialogo
                abierto={isAddModalOpen}
                onCerrar={() => setIsAddModalOpen(false)}
                etiqueta="Agregar Amigo"
                ancho={560}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">SOLICITUD DE AMISTAD</span>
                        <h3 className="h5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                            <Sparkles size={16} style={{ color: 'var(--perfil-acento)' }} />
                            <span>Agregar Amigo</span>
                        </h3>
                        <p className="small mb-0 text-secondary" style={{ fontSize: '0.78rem' }}>
                            Busca usuarios de Animigos por su nombre, <strong>@usuario</strong> o correo para enviarles una solicitud de amistad.
                        </p>
                    </div>

                    {/* Buscador propio del modal */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleSendRequest(modalSearchInput, true)
                        }}
                        className="d-flex gap-2"
                    >
                        <div className="perfil-friends-filter-input-wrap flex-grow-1" style={{ maxWidth: 'none' }}>
                            <Search size={14} className="perfil-friends-filter-icon" />
                            <input
                                type="text"
                                data-autofocus
                                placeholder="Buscar por @usuario, nombre o correo (ej: @otaku_fan)..."
                                value={modalSearchInput}
                                onChange={(e) => setModalSearchInput(e.target.value)}
                                className="perfil-friends-filter-input"
                            />
                            {modalSearchInput && (
                                <button
                                    type="button"
                                    onClick={() => setModalSearchInput('')}
                                    className="perfil-friends-filter-clear"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={addLoading || !modalSearchInput.trim()}
                            className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5 px-3"
                        >
                            {addLoading ? (
                                <Loader2 size={14} className="spinner-border spinner-border-sm" />
                            ) : (
                                <UserPlus size={14} />
                            )}
                            <span>{addLoading ? 'Enviando...' : 'Enviar'}</span>
                        </button>
                    </form>

                    {feedbackMsg && (
                        <div
                            className={`small p-2 rounded-2 ${feedbackMsg.isError
                                ? 'text-danger bg-danger-subtle'
                                : 'text-success bg-success-subtle'
                                }`}
                            style={{ fontSize: '0.76rem' }}
                        >
                            {feedbackMsg.text}
                        </div>
                    )}

                    {/* Resultados en vivo del buscador del modal */}
                    <div>
                        <div
                            className="small fw-bold text-uppercase text-secondary mb-2"
                            style={{ fontSize: '0.7rem', letterSpacing: '0.06em' }}
                        >
                            {modalSearchInput.trim()
                                ? `Resultados para "${modalSearchInput.trim()}"`
                                : 'Sugeridos por amigos en común'}
                        </div>

                        {modalSearchLoading ? (
                            <div className="text-center py-3">
                                <Loader2 size={18} className="spinner-border text-secondary" />
                            </div>
                        ) : modalSearchResults.length > 0 ? (
                            <div className="row g-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {modalSearchResults.map((u) => (
                                    <div key={u.id} className="col-12 col-sm-6">
                                        <div className="perfil-modal-inner-card d-flex align-items-center justify-content-between gap-2">
                                            <div
                                                className="d-flex align-items-center gap-2 min-w-0"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setIsAddModalOpen(false)
                                                    navigateToUserProfile(u.username)
                                                }}
                                            >
                                                <img
                                                    src={resolveMediaUrl(u.avatar_url) || DEFAULT_AVATAR}
                                                    crossOrigin="anonymous"
                                                    alt=""
                                                    className="rounded-circle flex-shrink-0"
                                                    style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                                                    onError={(e) => {
                                                        e.currentTarget.src = DEFAULT_AVATAR
                                                    }}
                                                />
                                                <div className="min-w-0">
                                                    <div className="small fw-bold text-white text-truncate">
                                                        {u.display_name}
                                                    </div>
                                                    <div
                                                        className="small text-secondary font-mono text-truncate"
                                                        style={{ fontSize: '0.72rem' }}
                                                    >
                                                        @{u.username}
                                                    </div>
                                                    {(u.mutual_friends_count || 0) > 0 && (
                                                        <div
                                                            className="small text-truncate"
                                                            style={{
                                                                fontSize: '0.68rem',
                                                                color: 'var(--perfil-acento)',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {formatMutualLabel(u.mutual_friends_count)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {renderSuggestionActionButton(u, false)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                className="p-3 rounded-3 text-center border text-secondary small"
                                style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                            >
                                No se encontraron usuarios con ese criterio. Puedes ingresar su @usuario o correo exacto arriba y presionar "Enviar".
                            </div>
                        )}
                    </div>

                    <div
                        className="d-flex justify-content-end pt-2 border-top"
                        style={{ borderColor: 'var(--perfil-border)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Dialogo>

            {/* =========================================================================
                MODAL 2: TODAS LAS SOLICITUDES Y TODOS MIS AMIGOS
               ========================================================================= */}
            <Dialogo
                abierto={isAllFriendsModalOpen}
                onCerrar={() => setIsAllFriendsModalOpen(false)}
                etiqueta="Solicitudes y Amigos"
                ancho={600}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <span className="ml-eyebrow">COMUNIDAD & AMISTAD</span>
                            <h3 className="h5 fw-bold text-white mb-0">
                                {readOnly ? `Amigos (${friends.length})` : `Mis Amigos (${friends.length})`}
                            </h3>
                        </div>
                        {!readOnly && incomingRequests.length > 0 && (
                            <span className="perfil-friends-requests-counter-pill">
                                <UserPlus size={11} />
                                <span>
                                    {incomingRequests.length}{' '}
                                    {incomingRequests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
                                </span>
                            </span>
                        )}
                    </div>

                    <div className="d-flex flex-column gap-3" style={{ maxHeight: '440px', overflowY: 'auto' }}>
                        {/* Solicitudes entrantes PRIMERO dentro del modal */}
                        {!readOnly && incomingRequests.length > 0 && (
                            <div>
                                <div className="perfil-friends-sublabel mb-2">
                                    <span className="perfil-friends-sublabel-dot" />
                                    <span>Solicitudes recibidas ({incomingRequests.length})</span>
                                </div>
                                <div className="row g-2">
                                    {incomingRequests.map((req) => {
                                        const isBusy =
                                            actionLoadingKey === `accept:${req.request_id}` ||
                                            actionLoadingKey === `reject:${req.request_id}`
                                        return (
                                            <div key={req.request_id} className="col-12 col-sm-6">
                                                <div className="perfil-modal-inner-card perfil-friend-request-card d-flex align-items-center justify-content-between gap-2">
                                                    <div
                                                        className="d-flex align-items-center gap-2 min-w-0"
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => {
                                                            setIsAllFriendsModalOpen(false)
                                                            navigateToUserProfile(req.username)
                                                        }}
                                                    >
                                                        <img
                                                            src={resolveMediaUrl(req.avatar_url) || DEFAULT_AVATAR}
                                                            crossOrigin="anonymous"
                                                            alt=""
                                                            className="rounded-circle flex-shrink-0"
                                                            style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                                                            onError={(e) => {
                                                                e.currentTarget.src = DEFAULT_AVATAR
                                                            }}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="small fw-bold text-white text-truncate">
                                                                {req.display_name}
                                                            </div>
                                                            <div
                                                                className="small text-secondary font-mono text-truncate"
                                                                style={{ fontSize: '0.72rem' }}
                                                            >
                                                                @{req.username}
                                                            </div>
                                                            {(req.mutual_friends_count || 0) > 0 && (
                                                                <div
                                                                    className="small text-truncate"
                                                                    style={{
                                                                        fontSize: '0.67rem',
                                                                        color: 'var(--perfil-acento)',
                                                                    }}
                                                                >
                                                                    {formatMutualLabel(req.mutual_friends_count)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => handleRespondRequest(req.request_id, 'accept')}
                                                            className="perfil-friend-req-btn-accept"
                                                            style={{ padding: '0.28rem 0.55rem' }}
                                                            title="Aceptar solicitud"
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isBusy}
                                                            onClick={() => handleRespondRequest(req.request_id, 'reject')}
                                                            className="perfil-friend-req-btn-reject"
                                                            style={{ padding: '0.28rem 0.5rem' }}
                                                            title="Rechazar solicitud"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Amigos confirmados */}
                        <div>
                            {!readOnly && (incomingRequests.length > 0 || outgoingRequests.length > 0) && (
                                <div className="perfil-friends-sublabel is-muted mb-2">
                                    <span>Amigos confirmados ({friends.length})</span>
                                </div>
                            )}

                            {friends.length > 0 ? (
                                <div className="row g-2">
                                    {friends.map((f) => (
                                        <div key={f.id} className="col-12 col-sm-6">
                                            <div className="perfil-modal-inner-card d-flex align-items-center justify-content-between gap-2">
                                                <div
                                                    className="d-flex align-items-center gap-2 min-w-0"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        setIsAllFriendsModalOpen(false)
                                                        navigateToUserProfile(f.username)
                                                    }}
                                                    title={`Visitar perfil de @${f.username}`}
                                                >
                                                    <img
                                                        src={resolveMediaUrl(f.avatar_url) || DEFAULT_AVATAR}
                                                        crossOrigin="anonymous"
                                                        alt=""
                                                        className="rounded-circle flex-shrink-0"
                                                        style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.currentTarget.src = DEFAULT_AVATAR
                                                        }}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="small fw-bold text-white text-truncate">{f.display_name}</div>
                                                        <div
                                                            className="small text-secondary font-mono text-truncate"
                                                            style={{ fontSize: '0.72rem' }}
                                                        >
                                                            @{f.username}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                                                    <a
                                                        href="/sala"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            navigate('/sala')
                                                        }}
                                                        className="btn btn-sm p-1 px-2 rounded-2"
                                                        style={{
                                                            background: 'var(--perfil-acento-soft)',
                                                            color: 'var(--perfil-acento)',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                        }}
                                                        title="Invitar a sala"
                                                    >
                                                        <Tv size={12} />
                                                    </a>
                                                    {!readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveFriend(f.id, f.display_name)}
                                                            className="btn btn-sm p-1 text-secondary opacity-60 border-0"
                                                            title="Eliminar amigo"
                                                        >
                                                            {actionLoadingKey === `remove:${f.id}` ? (
                                                                <Loader2 size={13} className="spinner-border spinner-border-sm" />
                                                            ) : (
                                                                <UserMinus size={13} />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    className="p-3 rounded-3 text-center border text-secondary small"
                                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                                >
                                    Aún no hay amigos confirmados en esta lista.
                                </div>
                            )}
                        </div>

                        {/* Solicitudes enviadas pendientes */}
                        {!readOnly && outgoingRequests.length > 0 && (
                            <div>
                                <div className="perfil-friends-sublabel is-muted mb-2">
                                    <span>Solicitudes enviadas ({outgoingRequests.length})</span>
                                </div>
                                <div className="row g-2">
                                    {outgoingRequests.map((req) => (
                                        <div key={req.request_id} className="col-12 col-sm-6">
                                            <div className="perfil-modal-inner-card d-flex align-items-center justify-content-between gap-2">
                                                <div
                                                    className="d-flex align-items-center gap-2 min-w-0"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        setIsAllFriendsModalOpen(false)
                                                        navigateToUserProfile(req.username)
                                                    }}
                                                >
                                                    <img
                                                        src={resolveMediaUrl(req.avatar_url) || DEFAULT_AVATAR}
                                                        crossOrigin="anonymous"
                                                        alt=""
                                                        className="rounded-circle flex-shrink-0"
                                                        style={{ width: '34px', height: '34px', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.currentTarget.src = DEFAULT_AVATAR
                                                        }}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="small fw-bold text-white text-truncate">
                                                            {req.display_name}
                                                        </div>
                                                        <div
                                                            className="small text-secondary font-mono text-truncate"
                                                            style={{ fontSize: '0.7rem' }}
                                                        >
                                                            @{req.username}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={actionLoadingKey === `cancel:${req.request_id}`}
                                                    onClick={() => handleCancelRequest(req.request_id)}
                                                    className="perfil-friend-req-btn-ghost py-1 px-2 flex-shrink-0"
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    <X size={11} />
                                                    <span>Cancelar</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div
                        className="d-flex justify-content-end pt-2 border-top"
                        style={{ borderColor: 'var(--perfil-border)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setIsAllFriendsModalOpen(false)}
                            className="ml-btn ml-btn-acento ml-btn-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Dialogo>

            {/* =========================================================================
                MODAL 3: TODAS LAS SUGERENCIAS (ORDENADAS POR AMIGOS EN COMÚN)
               ========================================================================= */}
            <Dialogo
                abierto={isAllSuggestionsModalOpen}
                onCerrar={() => setIsAllSuggestionsModalOpen(false)}
                etiqueta="Sugerencias de la Comunidad"
                ancho={580}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">EXPLORAR COMUNIDAD</span>
                        <h3 className="h5 fw-bold text-white mb-0">Miembros Sugeridos de Animigos</h3>
                        <p className="small mb-0 text-secondary" style={{ fontSize: '0.76rem' }}>
                            Ordenados según la cantidad de amigos en común contigo para facilitar tus conexiones.
                        </p>
                    </div>

                    <div className="row g-2 mt-1" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        {suggested.map((sug) => (
                            <div key={sug.id} className="col-12 col-sm-6">
                                <div className="perfil-modal-inner-card d-flex align-items-center justify-content-between gap-2">
                                    <div
                                        className="d-flex align-items-center gap-2 min-w-0"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setIsAllSuggestionsModalOpen(false)
                                            navigateToUserProfile(sug.username)
                                        }}
                                        title={`Visitar perfil de @${sug.username}`}
                                    >
                                        <img
                                            src={resolveMediaUrl(sug.avatar_url) || DEFAULT_AVATAR}
                                            crossOrigin="anonymous"
                                            alt=""
                                            className="rounded-circle flex-shrink-0"
                                            style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                                            onError={(e) => {
                                                e.currentTarget.src = DEFAULT_AVATAR
                                            }}
                                        />
                                        <div className="min-w-0">
                                            <div className="small fw-bold text-white text-truncate">
                                                {sug.display_name}
                                            </div>
                                            <div
                                                className="small text-secondary font-mono text-truncate"
                                                style={{ fontSize: '0.72rem' }}
                                            >
                                                @{sug.username}
                                            </div>
                                            <div
                                                className="small text-truncate"
                                                style={{
                                                    fontSize: '0.68rem',
                                                    color:
                                                        (sug.mutual_friends_count || 0) > 0
                                                            ? 'var(--perfil-acento)'
                                                            : 'var(--perfil-text-dim)',
                                                    fontWeight: (sug.mutual_friends_count || 0) > 0 ? 600 : 400,
                                                }}
                                            >
                                                {(sug.mutual_friends_count || 0) > 0
                                                    ? formatMutualLabel(sug.mutual_friends_count)
                                                    : `${sug.anime_count || 0} en su lista`}
                                            </div>
                                        </div>
                                    </div>
                                    {renderSuggestionActionButton(sug, false)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        className="d-flex justify-content-end pt-2 border-top"
                        style={{ borderColor: 'var(--perfil-border)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setIsAllSuggestionsModalOpen(false)}
                            className="ml-btn ml-btn-acento ml-btn-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Dialogo>
        </div>
    )
}
