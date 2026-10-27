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

interface UserFriendsSectionProps {
    currentUserUsername?: string
}

export const UserFriendsSection: React.FC<UserFriendsSectionProps> = ({ currentUserUsername }) => {
    const [friends, setFriends] = useState<FriendUser[]>([])
    const [suggested, setSuggested] = useState<FriendUser[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isAllFriendsModalOpen, setIsAllFriendsModalOpen] = useState(false)
    const [isAllSuggestionsModalOpen, setIsAllSuggestionsModalOpen] = useState(false)
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

    // Primeros 5 amigos para la fila compacta
    const topFriends = filteredFriends.slice(0, 5)
    // Primeras 5 sugerencias para la fila compacta
    const topSuggested = suggested.slice(0, 5)

    return (
        <div className="perfil-friends-container">
            {/* 1. Cabecera conforme al boceto */}
            <div className="mb-3">
                {/* Fila 1: Icono + Título + Badge + Subtítulo */}
                <div className="d-flex align-items-center gap-2.5">
                    <div
                        className="rounded-3 p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--perfil-acento) 18%, transparent)',
                            color: 'var(--perfil-acento)',
                            width: '36px',
                            height: '36px',
                        }}
                    >
                        <Users size={18} />
                    </div>
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h2 className="h6 fw-bold text-white mb-0" style={{ fontSize: '0.98rem' }}>
                                Mis Amigos
                            </h2>
                            <span
                                className="badge rounded-pill px-2 py-0.5"
                                style={{
                                    background: 'color-mix(in srgb, var(--perfil-acento) 22%, transparent)',
                                    color: 'var(--perfil-acento)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                }}
                            >
                                {friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}
                            </span>
                        </div>
                        <p className="small mb-0 text-secondary" style={{ fontSize: '0.76rem' }}>
                            Compañeros para ver anime, coordinar maratones y compartir listas.
                        </p>
                    </div>
                </div>

                {/* Fila 2: Buscador + Botón Agregar Amigo */}
                <div className="d-flex align-items-center gap-2 mt-2.5">
                    <div className="position-relative" style={{ width: '220px' }}>
                        <Search
                            size={13}
                            className="position-absolute start-0 top-50 translate-middle-y ms-2.5 text-secondary"
                        />
                        <input
                            type="text"
                            placeholder="Buscar amigos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="cat-search-control w-100 ps-4 py-1"
                            style={{ fontSize: '0.76rem' }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen((v) => !v)}
                        className="btn btn-sm d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                        style={{
                            background: 'var(--perfil-acento)',
                            color: '#080808',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                        }}
                    >
                        <UserPlus size={13} />
                        <span>Agregar Amigo</span>
                    </button>
                </div>
            </div>

            {/* Panel desplegable de Agregar Amigo */}
            {isAddModalOpen && (
                <div
                    className="p-3 rounded-3 mb-3 border animate-fade-in"
                    style={{
                        background: 'var(--perfil-card-2)',
                        borderColor: 'var(--perfil-acento)',
                        boxShadow: '0 4px 20px color-mix(in srgb, var(--perfil-acento) 15%, transparent)',
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="small fw-semibold text-white d-flex align-items-center gap-1.5" style={{ fontSize: '0.78rem' }}>
                            <Sparkles size={13} style={{ color: 'var(--perfil-acento)' }} />
                            Conectar con un usuario de Animigos
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="btn p-0 text-secondary border-0"
                        >
                            <X size={14} />
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
                            className="cat-search-control flex-grow-1 py-1"
                            style={{ fontSize: '0.78rem' }}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={addLoading || !newFriendInput.trim()}
                            className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '0.76rem' }}
                        >
                            {addLoading ? <Loader2 size={13} className="spinner-border spinner-border-sm" /> : <UserPlus size={13} />}
                            <span>{addLoading ? 'Conectando...' : 'Agregar'}</span>
                        </button>
                    </form>

                    {feedbackMsg && (
                        <div
                            className={`small mt-2 p-1.5 rounded-2 ${
                                feedbackMsg.isError ? 'text-danger bg-danger-subtle' : 'text-success bg-success-subtle'
                            }`}
                            style={{ fontSize: '0.74rem' }}
                        >
                            {feedbackMsg.text}
                        </div>
                    )}
                </div>
            )}

            {/* 2. Tira Compacta: MIS AMIGOS */}
            {loading ? (
                <div className="text-center py-3">
                    <Loader2 size={20} className="spinner-border text-secondary" />
                </div>
            ) : topFriends.length > 0 ? (
                <div className="perfil-friends-strip mb-3">
                    {topFriends.map((friend) => (
                        <div key={friend.id} className="perfil-friend-compact-card">
                            <div className="d-flex align-items-start gap-2 min-w-0">
                                {/* Avatar con punto verde de estado */}
                                <div className="position-relative flex-shrink-0">
                                    <img
                                        src={
                                            friend.avatar_url ||
                                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                        }
                                        alt={friend.display_name}
                                        className="rounded-circle"
                                        style={{ width: '38px', height: '38px', objectFit: 'cover' }}
                                        onError={(e) => {
                                            e.currentTarget.src =
                                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                        }}
                                    />
                                    <span
                                        className="position-absolute bottom-0 end-0 rounded-circle border border-dark"
                                        style={{ width: '8px', height: '8px', backgroundColor: '#10b981' }}
                                        title="En línea"
                                    />
                                </div>

                                {/* Textos: Nombre, @username, Bio */}
                                <div className="min-w-0 flex-grow-1">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span
                                            className="fw-bold text-white text-truncate d-block"
                                            style={{ fontSize: '0.78rem' }}
                                            title={friend.display_name}
                                        >
                                            {friend.display_name}
                                        </span>
                                    </div>
                                    <span
                                        className="text-secondary font-mono text-truncate d-block"
                                        style={{ fontSize: '0.68rem', color: '#9ca3af' }}
                                    >
                                        @{friend.username}
                                    </span>
                                    <span
                                        className="text-truncate d-block"
                                        style={{ fontSize: '0.68rem', color: 'var(--perfil-text-dim)', lineHeight: 1.2 }}
                                        title={friend.bio || '¡Hola! Estoy usando Animigos'}
                                    >
                                        {friend.bio || '¡Hola! Estoy usando Animigos'}
                                    </span>
                                </div>
                            </div>

                            {/* Footer: Icono de lista */}
                            <div
                                className="d-flex align-items-center justify-content-between pt-1 border-top"
                                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                            >
                                <span
                                    className="d-inline-flex align-items-center gap-1.5"
                                    style={{ fontSize: '0.68rem', color: '#9ca3af' }}
                                >
                                    <Film size={11} style={{ color: 'var(--perfil-acento)' }} />
                                    <span>{friend.anime_count || 0} en su lista</span>
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Botón Card: VER MÁS */}
                    <div
                        className="perfil-friend-vermas-card"
                        onClick={() => setIsAllFriendsModalOpen(true)}
                        role="button"
                        tabIndex={0}
                        title="Ver todos los amigos y opciones"
                    >
                        <div className="position-absolute top-0 end-0 p-2">
                            <Users size={13} className="text-secondary opacity-40" />
                        </div>
                        <div className="perfil-friend-vermas-btn">
                            VER MAS
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    className="p-3 rounded-3 text-center mb-3 border"
                    style={{ background: '#14141a', borderColor: 'rgba(255,255,255,0.06)' }}
                >
                    <span className="small text-secondary" style={{ fontSize: '0.76rem' }}>
                        {searchQuery
                            ? 'No se encontraron amigos con ese criterio.'
                            : 'Aún no tienes amigos agregados. ¡Conecta con otros usuarios o revisa las sugerencias abajo!'}
                    </span>
                </div>
            )}

            {/* 3. Tira Compacta: SUGERENCIAS */}
            {suggested.length > 0 && (
                <div>
                    <h3
                        className="fw-bold text-white text-uppercase tracking-wider mb-2"
                        style={{ fontSize: '0.8rem', letterSpacing: '0.8px' }}
                    >
                        SUGERENCIAS
                    </h3>

                    <div className="perfil-friends-strip">
                        {topSuggested.map((sug) => (
                            <div key={sug.id} className="perfil-friend-compact-card">
                                <div className="d-flex align-items-start gap-2 min-w-0">
                                    {/* Avatar con punto verde */}
                                    <div className="position-relative flex-shrink-0">
                                        <img
                                            src={
                                                sug.avatar_url ||
                                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                            }
                                            alt={sug.display_name}
                                            className="rounded-circle"
                                            style={{ width: '38px', height: '38px', objectFit: 'cover' }}
                                        />
                                        <span
                                            className="position-absolute bottom-0 end-0 rounded-circle border border-dark"
                                            style={{ width: '8px', height: '8px', backgroundColor: '#10b981' }}
                                            title="En línea"
                                        />
                                    </div>

                                    {/* Textos: Nombre, @username, Bio */}
                                    <div className="min-w-0 flex-grow-1">
                                        <div className="d-flex align-items-center justify-content-between">
                                            <span
                                                className="fw-bold text-white text-truncate d-block"
                                                style={{ fontSize: '0.78rem' }}
                                                title={sug.display_name}
                                            >
                                                {sug.display_name}
                                            </span>
                                            {/* Botón rápido para agregar */}
                                            <button
                                                type="button"
                                                onClick={() => handleAddFriend(sug.username)}
                                                className="btn p-0 text-secondary border-0 ms-1 flex-shrink-0"
                                                title={`Agregar a ${sug.display_name} como amigo`}
                                                style={{ opacity: 0.6 }}
                                            >
                                                <UserPlus size={13} />
                                            </button>
                                        </div>
                                        <span
                                            className="text-secondary font-mono text-truncate d-block"
                                            style={{ fontSize: '0.68rem', color: '#9ca3af' }}
                                        >
                                            @{sug.username}
                                        </span>
                                        <span
                                            className="text-truncate d-block"
                                            style={{ fontSize: '0.68rem', color: 'var(--perfil-text-dim)', lineHeight: 1.2 }}
                                            title={sug.bio || '¡Hola! Estoy usando Animigos'}
                                        >
                                            {sug.bio || '¡Hola! Estoy usando Animigos'}
                                        </span>
                                    </div>
                                </div>

                                {/* Footer: Icono de lista */}
                                <div
                                    className="d-flex align-items-center justify-content-between pt-1 border-top"
                                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <span
                                        className="d-inline-flex align-items-center gap-1.5"
                                        style={{ fontSize: '0.68rem', color: '#9ca3af' }}
                                    >
                                        <Film size={11} style={{ color: 'var(--perfil-acento)' }} />
                                        <span>{sug.anime_count || 0} en su lista</span>
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Botón Card: VER MÁS Sugerencias */}
                        <div
                            className="perfil-friend-vermas-card"
                            onClick={() => setIsAllSuggestionsModalOpen(true)}
                            role="button"
                            tabIndex={0}
                            title="Ver todas las sugerencias de la comunidad"
                        >
                            <div className="position-absolute top-0 end-0 p-2">
                                <UserPlus size={13} className="text-secondary opacity-40" />
                            </div>
                            <div className="perfil-friend-vermas-btn">
                                VER MAS
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Completo: Todos mis amigos */}
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
                                    <div className="d-flex align-items-center gap-2 min-w-0">
                                        <img
                                            src={f.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                            alt=""
                                            className="rounded-circle flex-shrink-0"
                                            style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                                        />
                                        <div className="min-w-0">
                                            <div className="small fw-bold text-white text-truncate">{f.display_name}</div>
                                            <div className="small text-secondary font-mono text-truncate" style={{ fontSize: '0.72rem' }}>
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
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="d-flex justify-content-end pt-2 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
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

            {/* Modal Completo: Todas las Sugerencias */}
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
                                    <div className="d-flex align-items-center gap-2 min-w-0">
                                        <img
                                            src={sug.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                            alt=""
                                            className="rounded-circle flex-shrink-0"
                                            style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                                        />
                                        <div className="min-w-0">
                                            <div className="small fw-bold text-white text-truncate">{sug.display_name}</div>
                                            <div className="small text-secondary font-mono text-truncate" style={{ fontSize: '0.72rem' }}>
                                                @{sug.username}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleAddFriend(sug.username)
                                            setIsAllSuggestionsModalOpen(false)
                                        }}
                                        className="btn btn-sm py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1 flex-shrink-0"
                                        style={{
                                            background: 'var(--perfil-acento)',
                                            color: '#080808',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        <UserPlus size={12} />
                                        <span>Agregar</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="d-flex justify-content-end pt-2 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
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
