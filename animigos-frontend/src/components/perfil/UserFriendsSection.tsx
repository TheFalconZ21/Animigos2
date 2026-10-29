import React, { useState, useEffect } from 'react'
import {
    Users,
    UserPlus,
    Search,
    Film,
    Sparkles,
    X,
    UserMinus,
    Tv,
    Loader2,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import {
    fetchFriends,
    addFriend,
    removeFriend,
    fetchSuggestedFriends,
    type FriendUser,
} from '../../services/friendsApi'
import { resolveMediaUrl } from '../../utils/mediaUrl'

interface UserFriendsSectionProps {
    currentUserUsername?: string
    readOnly?: boolean
    initialFriends?: FriendUser[]
    onSelectUserProfile?: (username: string) => void
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'

export const UserFriendsSection: React.FC<UserFriendsSectionProps> = ({
    currentUserUsername,
    readOnly = false,
    initialFriends,
    onSelectUserProfile,
}) => {
    const [friends, setFriends] = useState<FriendUser[]>(initialFriends || [])
    const [suggested, setSuggested] = useState<FriendUser[]>([])
    const [loading, setLoading] = useState(!readOnly)

    const navigateToUserProfile = (uname: string) => {
        if (!uname) return
        if (onSelectUserProfile) {
            onSelectUserProfile(uname)
        } else {
            window.location.hash = `#perfil/${encodeURIComponent(uname)}`
        }
    }

    // Filtro rápido local de "Mis Amigos" (input izquierdo)
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
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

    // Cargar amigos y sugerencias principales
    const loadFriendsData = async () => {
        try {
            setLoading(true)
            const [friendsRes, suggestedRes] = await Promise.all([
                fetchFriends().catch(() => []),
                fetchSuggestedFriends().catch(() => []),
            ])
            setFriends(friendsRes)
            setSuggested(suggestedRes)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (readOnly && initialFriends) {
            setFriends(initialFriends)
            fetchSuggestedFriends()
                .then((res) => setSuggested(res))
                .catch(() => setSuggested([]))
            setLoading(false)
            return
        }
        loadFriendsData()
    }, [currentUserUsername, readOnly, initialFriends])

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
    }, [isAddModalOpen, modalSearchInput, friends.length])

    const handleAddFriend = async (targetQuery: string, closeModalOnSuccess = false) => {
        if (!targetQuery.trim()) return
        setAddLoading(true)
        setFeedbackMsg(null)
        try {
            const res = await addFriend(targetQuery.trim())
            setFeedbackMsg({ text: res.message || '¡Amigo agregado con éxito!', isError: false })
            await loadFriendsData()
            if (closeModalOnSuccess) {
                setTimeout(() => {
                    setFeedbackMsg(null)
                    setModalSearchInput('')
                    setIsAddModalOpen(false)
                }, 1200)
            } else {
                setTimeout(() => setFeedbackMsg(null), 2500)
            }
        } catch (err: any) {
            setFeedbackMsg({ text: err.message || 'Error al agregar amigo.', isError: true })
        } finally {
            setAddLoading(false)
        }
    }

    const handleRemoveFriend = async (id: number, name: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${name} de tus amigos?`)) return
        setActionLoadingId(id)
        try {
            await removeFriend(id)
            setFriends((prev) => prev.filter((f) => f.id !== id))
            await loadFriendsData()
        } catch (e) {
            console.error('Error eliminando amigo:', e)
        } finally {
            setActionLoadingId(null)
        }
    }

    const filteredFriends = friends.filter((f) => {
        const q = searchQuery.toLowerCase().trim()
        if (!q) return true
        return (
            f.display_name.toLowerCase().includes(q) ||
            f.username.toLowerCase().includes(q) ||
            (f.bio && f.bio.toLowerCase().includes(q))
        )
    })

    // 4 amigos a la izquierda + 2 sugerencias a la derecha (según imagen referencial 2)
    const topFriends = filteredFriends.slice(0, 4)
    const topSuggested = suggested.slice(0, 2)

    return (
        <div className="perfil-friends-container">
            {/* 1. Cabecera Principal: Icono + Mis Amigos + Contador + Subtítulo */}
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
                    <div className="d-flex align-items-center gap-2">
                        <h2 className="h6 fw-bold text-white ms-4 mb-0" style={{ fontSize: '1.02rem' }}>
                            Mis Amigos
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
                    </div>
                    <p className="small ms-4 mb-0 text-secondary" style={{ fontSize: '0.78rem' }}>
                        Compañeros para ver anime, coordinar maratones y compartir listas.
                    </p>
                </div>
            </div>

            {/* 2. Layout Dividido: Izquierda (Mis Amigos - 4 cols) | Derecha (Sugerencias - 2 cols) */}
            <div className="perfil-friends-split-layout">
                {/* ==================== BLOQUE IZQUIERDO: MIS AMIGOS ==================== */}
                <div className="perfil-friends-left-zone">
                    {/* Barra de control superior: Input de filtro rápido a la izquierda + Botones a la derecha */}
                    <div className="perfil-friends-toolbar">
                        <div className="perfil-friends-filter-input-wrap">
                            <Search size={14} className="perfil-friends-filter-icon" />
                            <input
                                type="text"
                                placeholder="Buscar amigos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="perfil-friends-filter-input"
                                aria-label="Filtrar mis amigos rápidamente"
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
                                title="Ver todos los amigos"
                            >
                                VER MAS
                            </button>
                        </div>
                    </div>

                    {/* Grilla de 4 tarjetas de amigos */}
                    {loading ? (
                        <div className="text-center py-4">
                            <Loader2 size={20} className="spinner-border text-secondary" />
                        </div>
                    ) : topFriends.length > 0 ? (
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
                    ) : (
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
                                    ? `No se encontraron amigos que coincidan con "${searchQuery}".`
                                    : 'Aún no tienes amigos agregados. ¡Usa el botón "Agregar Amigo" o conecta con las sugerencias!'}
                            </span>
                        </div>
                    )}
                </div>

                {/* ==================== BLOQUE DERECHO: SUGERENCIAS ==================== */}
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
                            title="Ver todas las sugerencias de la comunidad"
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
                                                {!readOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleAddFriend(sug.username)
                                                        }}
                                                        className="perfil-friend-quick-add-btn"
                                                        title={`Agregar a ${sug.display_name} como amigo`}
                                                    >
                                                        <UserPlus size={13} />
                                                    </button>
                                                )}
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
                                        <span className="perfil-friend-list-count">
                                            <Film size={11} style={{ color: 'var(--perfil-acento)', flexShrink: 0 }} />
                                            <span className="text-truncate">{sug.anime_count || 0} en su lista</span>
                                        </span>
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
                MODAL 1: AGREGAR AMIGO (CON SU PROPIO BUSCADOR DE USUARIOS)
               ========================================================================= */}
            <Dialogo
                abierto={isAddModalOpen}
                onCerrar={() => setIsAddModalOpen(false)}
                etiqueta="Agregar Amigo"
                ancho={560}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">CONECTAR CON LA COMUNIDAD</span>
                        <h3 className="h5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                            <Sparkles size={16} style={{ color: 'var(--perfil-acento)' }} />
                            <span>Agregar Amigo</span>
                        </h3>
                        <p className="small mb-0 text-secondary" style={{ fontSize: '0.78rem' }}>
                            Busca usuarios de Animigos por su nombre, <strong>@usuario</strong> o correo electrónico.
                        </p>
                    </div>

                    {/* Buscador propio del modal */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleAddFriend(modalSearchInput, true)
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
                            <span>{addLoading ? 'Conectando...' : 'Conectar'}</span>
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
                                : 'Usuarios sugeridos para conectar'}
                        </div>

                        {modalSearchLoading ? (
                            <div className="text-center py-3">
                                <Loader2 size={18} className="spinner-border text-secondary" />
                            </div>
                        ) : modalSearchResults.length > 0 ? (
                            <div className="row g-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {modalSearchResults.map((u) => (
                                    <div key={u.id} className="col-12 col-sm-6">
                                        <div
                                            className="p-2.5 rounded-3 border d-flex align-items-center justify-content-between gap-2"
                                            style={{
                                                background: 'var(--perfil-card-2)',
                                                borderColor: 'var(--perfil-border)',
                                            }}
                                        >
                                            <div className="d-flex align-items-center gap-2 min-w-0">
                                                <img
                                                    src={resolveMediaUrl(u.avatar_url) || DEFAULT_AVATAR}
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
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={addLoading}
                                                onClick={() => handleAddFriend(u.username, false)}
                                                className="perfil-friends-add-pill-btn py-1 px-2.5 flex-shrink-0"
                                                style={{ fontSize: '0.72rem' }}
                                            >
                                                <UserPlus size={12} />
                                                <span>Agregar</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                className="p-3 rounded-3 text-center border text-secondary small"
                                style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                            >
                                No se encontraron usuarios con ese criterio. Puedes ingresar su @usuario o correo exacto arriba y presionar "Conectar".
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
                MODAL 2: TODOS MIS AMIGOS
               ========================================================================= */}
            <Dialogo
                abierto={isAllFriendsModalOpen}
                onCerrar={() => setIsAllFriendsModalOpen(false)}
                etiqueta="Todos Mis Amigos"
                ancho={580}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div className="d-flex align-items-center justify-content-between">
                        <div>
                            <span className="ml-eyebrow">COMUNIDAD & AMISTAD</span>
                            <h3 className="h5 fw-bold text-white mb-0">Mis Amigos ({friends.length})</h3>
                        </div>
                    </div>

                    <div className="row g-2 mt-1" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        {friends.map((f) => (
                            <div key={f.id} className="col-12 col-sm-6">
                                <div
                                    className="p-2.5 rounded-3 border d-flex align-items-center justify-content-between gap-2"
                                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                                >
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
                                            href="#sala"
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
                                                {actionLoadingId === f.id ? (
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
                MODAL 3: TODAS LAS SUGERENCIAS
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
                            Conecta con otros otakus para compartir listas y crear salas juntos.
                        </p>
                    </div>

                    <div className="row g-2 mt-1" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        {suggested.map((sug) => (
                            <div key={sug.id} className="col-12 col-sm-6">
                                <div
                                    className="p-2.5 rounded-3 border d-flex align-items-center justify-content-between gap-2"
                                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                                >
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
                                        </div>
                                    </div>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddFriend(sug.username)
                                                setIsAllSuggestionsModalOpen(false)
                                            }}
                                            className="perfil-friends-add-pill-btn py-1 px-2.5 flex-shrink-0"
                                            style={{ fontSize: '0.74rem' }}
                                        >
                                            <UserPlus size={12} />
                                            <span>Agregar</span>
                                        </button>
                                    )}
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
