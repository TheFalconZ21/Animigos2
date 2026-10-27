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
import {
    fetchFriends,
    addFriend,
    removeFriend,
    fetchSuggestedFriends,
    type FriendUser,
} from '../../services/friendsApi'

interface UserFriendsSectionProps {
    currentUserUsername?: string
}

export const UserFriendsSection: React.FC<UserFriendsSectionProps> = ({ currentUserUsername }) => {
    const [friends, setFriends] = useState<FriendUser[]>([])
    const [suggested, setSuggested] = useState<FriendUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [newFriendInput, setNewFriendInput] = useState('')
    const [addLoading, setAddLoading] = useState(false)
    const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null)
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

    // Cargar amigos y sugerencias
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
        loadFriendsData()
    }, [currentUserUsername])

    const handleAddFriend = async (targetQuery: string) => {
        if (!targetQuery.trim()) return
        setAddLoading(true)
        setFeedbackMsg(null)
        try {
            const res = await addFriend(targetQuery.trim())
            setFeedbackMsg({ text: res.message || '¡Amigo agregado con éxito!', isError: false })
            setNewFriendInput('')
            // Recargar datos
            await loadFriendsData()
            setTimeout(() => {
                setFeedbackMsg(null)
                setIsAddModalOpen(false)
            }, 1800)
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

    return (
        <div className="perfil-card p-4 rounded-4 mb-4 border" style={{ borderColor: 'var(--perfil-border)', background: 'var(--perfil-card)' }}>
            {/* Cabecera de la sección */}
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                <div className="d-flex align-items-center gap-2.5">
                    <div
                        className="rounded-3 p-2 d-flex align-items-center justify-content-center"
                        style={{ background: 'color-mix(in srgb, var(--perfil-acento) 16%, transparent)', color: 'var(--perfil-acento)' }}
                    >
                        <Users size={22} />
                    </div>
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h2 className="h5 fw-bold text-white mb-0">Mis Amigos</h2>
                            <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold"
                                style={{
                                    background: 'color-mix(in srgb, var(--perfil-acento) 20%, transparent)',
                                    color: 'var(--perfil-acento)',
                                    border: '1px solid color-mix(in srgb, var(--perfil-acento) 40%, transparent)',
                                    fontSize: '0.74rem',
                                }}
                            >
                                {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
                            </span>
                        </div>
                        <p className="small mb-0 mt-0.5" style={{ color: 'var(--perfil-text-muted)' }}>
                            Compañeros para ver anime, coordinar maratones y compartir listas.
                        </p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    {/* Búsqueda rápida */}
                    <div className="position-relative" style={{ minWidth: '180px' }}>
                        <Search
                            size={14}
                            className="position-absolute start-0 top-50 translate-middle-y ms-2.5 text-secondary"
                        />
                        <input
                            type="text"
                            placeholder="Buscar amigos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="cat-search-control w-100 ps-4 py-1.5"
                            style={{ fontSize: '0.8rem' }}
                        />
                    </div>

                    {/* Botón Agregar Amigo */}
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen((v) => !v)}
                        className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                        title="Agregar nuevo amigo"
                    >
                        <UserPlus size={14} />
                        <span>Agregar Amigo</span>
                    </button>
                </div>
            </div>

            {/* Panel desplegable: Agregar Amigo */}
            {isAddModalOpen && (
                <div
                    className="p-3 rounded-3 mb-4 border animate-fade-in"
                    style={{
                        background: 'var(--perfil-card-2)',
                        borderColor: 'var(--perfil-acento)',
                        boxShadow: '0 4px 20px color-mix(in srgb, var(--perfil-acento) 15%, transparent)',
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="small fw-semibold text-white d-flex align-items-center gap-1.5">
                            <Sparkles size={14} style={{ color: 'var(--perfil-acento)' }} />
                            Conectar con un amigo en Animigos
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="btn p-0 text-secondary border-0"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleAddFriend(newFriendInput)
                        }}
                        className="d-flex gap-2"
                    >
                        <input
                            type="text"
                            placeholder="Ingresa el @usuario o correo (ej: @otaku_fan o amigo@animigos.cl)..."
                            value={newFriendInput}
                            onChange={(e) => setNewFriendInput(e.target.value)}
                            className="cat-search-control flex-grow-1"
                            style={{ fontSize: '0.82rem' }}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={addLoading || !newFriendInput.trim()}
                            className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                        >
                            {addLoading ? <Loader2 size={14} className="spinner-border spinner-border-sm" /> : <UserPlus size={14} />}
                            <span>{addLoading ? 'Conectando...' : 'Agregar'}</span>
                        </button>
                    </form>

                    {feedbackMsg && (
                        <div
                            className={`small mt-2 p-2 rounded-2 ${
                                feedbackMsg.isError ? 'text-danger bg-danger-subtle' : 'text-success bg-success-subtle'
                            }`}
                        >
                            {feedbackMsg.text}
                        </div>
                    )}
                </div>
            )}

            {/* Grid de Amigos */}
            {loading ? (
                <div className="text-center py-5">
                    <Loader2 size={28} className="spinner-border text-secondary" />
                    <p className="small text-secondary mt-2">Cargando lista de amigos...</p>
                </div>
            ) : filteredFriends.length > 0 ? (
                <div className="row g-3">
                    {filteredFriends.map((friend) => (
                        <div key={friend.id} className="col-12 col-md-6 col-lg-4">
                            <div
                                className="h-100 p-3 rounded-3 d-flex flex-column justify-content-between border position-relative"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    borderColor: 'var(--perfil-border)',
                                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                                }}
                            >
                                <div className="d-flex align-items-start gap-3">
                                    {/* Avatar con status online */}
                                    <div className="position-relative flex-shrink-0">
                                        <img
                                            src={friend.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                            alt={friend.display_name}
                                            className="rounded-circle"
                                            style={{
                                                width: '46px',
                                                height: '46px',
                                                objectFit: 'cover',
                                                border: '2px solid var(--perfil-border)',
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.src =
                                                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                            }}
                                        />
                                        <span
                                            className="position-absolute bottom-0 end-0 rounded-circle border border-dark"
                                            style={{
                                                width: '10px',
                                                height: '10px',
                                                backgroundColor: '#10b981',
                                            }}
                                            title="En línea"
                                        />
                                    </div>

                                    {/* Datos del amigo */}
                                    <div className="flex-grow-1 min-w-0">
                                        <div className="d-flex align-items-center justify-content-between gap-1">
                                            <h4 className="small fw-bold text-white mb-0 text-truncate">
                                                {friend.display_name}
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFriend(friend.id, friend.display_name)}
                                                className="btn btn-sm p-1 text-secondary opacity-50 border-0"
                                                title="Eliminar de amigos"
                                            >
                                                {actionLoadingId === friend.id ? (
                                                    <Loader2 size={13} className="spinner-border spinner-border-sm" />
                                                ) : (
                                                    <UserMinus size={13} />
                                                )}
                                            </button>
                                        </div>
                                        <span className="small font-mono text-secondary d-block text-truncate" style={{ fontSize: '0.74rem' }}>
                                            @{friend.username}
                                        </span>
                                        {friend.bio && (
                                            <p
                                                className="small mb-2 mt-1 text-truncate-2"
                                                style={{ color: 'var(--perfil-text-muted)', fontSize: '0.75rem', lineHeight: 1.3 }}
                                            >
                                                {friend.bio}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Acciones y Animes en lista */}
                                <div className="d-flex align-items-center justify-content-between pt-2.5 mt-2 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                                    <span className="small d-inline-flex align-items-center gap-1 text-secondary" style={{ fontSize: '0.72rem' }}>
                                        <Film size={12} style={{ color: 'var(--perfil-acento)' }} />
                                        <span>{friend.anime_count} en su lista</span>
                                    </span>
                                    <a
                                        href="#sala"
                                        className="btn btn-sm py-0.5 px-2 rounded-2 d-inline-flex align-items-center gap-1"
                                        style={{
                                            background: 'color-mix(in srgb, var(--perfil-acento) 12%, transparent)',
                                            color: 'var(--perfil-acento)',
                                            border: '1px solid color-mix(in srgb, var(--perfil-acento) 30%, transparent)',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                        }}
                                        title="Invitar a una Watch Party"
                                    >
                                        <Tv size={12} />
                                        <span>Invitar a Sala</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Estado sin amigos o sin coincidencias de búsqueda */
                <div className="text-center py-4 px-3 rounded-3 border" style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}>
                    <Users size={36} className="text-secondary opacity-40 mb-2" />
                    <h3 className="h6 fw-bold text-white mb-1">
                        {searchQuery ? 'No se encontraron amigos con esa búsqueda' : 'Aún no tienes amigos agregados'}
                    </h3>
                    <p className="small text-secondary mb-3" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        {searchQuery
                            ? 'Prueba buscando con otro nombre o borra el filtro para ver toda tu lista.'
                            : 'Agrega amigos para coordinar Watch Parties, ver recomendaciones personalizadas y compartir listas grupales.'}
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                    >
                        <UserPlus size={14} />
                        <span>Buscar y Agregar Amigos</span>
                    </button>
                </div>
            )}

            {/* Sugerencias de la comunidad para agregar con 1 clic */}
            {suggested.length > 0 && (
                <div className="mt-4 pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                    <div className="d-flex align-items-center gap-2 mb-3">
                        <Sparkles size={15} style={{ color: 'var(--perfil-acento)' }} />
                        <h3 className="small fw-bold text-white text-uppercase tracking-wider mb-0" style={{ fontSize: '0.78rem' }}>
                            Miembros Sugeridos de Animigos
                        </h3>
                    </div>
                    <div className="row g-2">
                        {suggested.slice(0, 4).map((sug) => (
                            <div key={sug.id} className="col-12 col-sm-6 col-lg-3">
                                <div
                                    className="p-2.5 rounded-3 d-flex align-items-center justify-content-between gap-2 border"
                                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                                >
                                    <div className="d-flex align-items-center gap-2 min-w-0">
                                        <img
                                            src={sug.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                            alt={sug.display_name}
                                            className="rounded-circle flex-shrink-0"
                                            style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                        />
                                        <div className="min-w-0">
                                            <div className="small fw-semibold text-white text-truncate" style={{ fontSize: '0.78rem' }}>
                                                {sug.display_name}
                                            </div>
                                            <div className="small text-secondary text-truncate font-mono" style={{ fontSize: '0.7rem' }}>
                                                @{sug.username}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddFriend(sug.username)}
                                        className="btn btn-sm p-1 px-2 rounded-pill d-inline-flex align-items-center gap-1 flex-shrink-0"
                                        style={{
                                            background: 'color-mix(in srgb, var(--perfil-acento) 18%, transparent)',
                                            color: 'var(--perfil-acento)',
                                            border: '1px solid color-mix(in srgb, var(--perfil-acento) 35%, transparent)',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                        }}
                                        title="Agregar a mis amigos"
                                    >
                                        <UserPlus size={12} />
                                        <span>Agregar</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
