import React, { useState } from 'react'
import {
    Bold,
    Italic,
    EyeOff,
    Send,
    Heart,
    MessageSquare,
    Trash2,
    CornerDownRight,
    Lock,
} from 'lucide-react'
import type { ProfileComment, ProfileCommentReply } from './perfil-types'

interface CommentsWallProps {
    currentUser: {
        id: string
        name: string
        username: string
        avatar: string
    }
    allowComments?: 'everyone' | 'friends' | 'none'
    initialComments?: ProfileComment[]
}

const DEFAULT_COMMENTS: ProfileComment[] = []

export const CommentsWall: React.FC<CommentsWallProps> = ({
    currentUser,
    allowComments = 'everyone',
    initialComments = DEFAULT_COMMENTS,
}) => {
    const storageKey = `animigos_perfil_comments_${currentUser.id || 'guest'}`
    const [comments, setComments] = useState<ProfileComment[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            return saved ? JSON.parse(saved) : (initialComments.length ? initialComments : [])
        } catch {
            return initialComments.length ? initialComments : []
        }
    })

    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey)
            setComments(saved ? JSON.parse(saved) : (initialComments.length ? initialComments : []))
        } catch {
            setComments(initialComments.length ? initialComments : [])
        }
    }, [storageKey])

    const [activeTab, setActiveTab] = useState<'escribir' | 'preview'>('escribir')
    const [commentText, setCommentText] = useState('')
    const [hasSpoilerChecked, setHasSpoilerChecked] = useState(false)
    const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({})

    // Estado para respuesta anidada
    const [replyingToId, setReplyingToId] = useState<string | null>(null)
    const [replyText, setReplyText] = useState('')

    const saveComments = (newComments: ProfileComment[]) => {
        setComments(newComments)
        try {
            localStorage.setItem(storageKey, JSON.stringify(newComments))
        } catch {
            // ignore
        }
    }

    const insertFormatting = (prefix: string, suffix: string = '') => {
        setCommentText((prev) => `${prev}${prefix}texto${suffix}`)
    }

    const addEmoji = (emoji: string) => {
        setCommentText((prev) => `${prev} ${emoji} `)
    }

    const handlePostComment = (e: React.FormEvent) => {
        e.preventDefault()
        if (!commentText.trim()) return

        const newComment: ProfileComment = {
            id: `c_${Date.now()}`,
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorUsername: currentUser.username,
            authorAvatar: currentUser.avatar,
            authorBadge: 'Miembro VIP ⚡',
            content: commentText.trim(),
            hasSpoiler: hasSpoilerChecked || commentText.includes('[spoiler]'),
            createdAt: 'Hace un momento',
            likes: 0,
            isLiked: false,
            replies: [],
        }

        saveComments([newComment, ...comments])
        setCommentText('')
        setHasSpoilerChecked(false)
        setActiveTab('escribir')
    }

    const handleLike = (commentId: string) => {
        const updated = comments.map((c) => {
            if (c.id === commentId) {
                const isLiked = !c.isLiked
                return {
                    ...c,
                    isLiked,
                    likes: isLiked ? c.likes + 1 : Math.max(0, c.likes - 1),
                }
            }
            return c
        })
        saveComments(updated)
    }

    const handleDelete = (commentId: string) => {
        const updated = comments.filter((c) => c.id !== commentId)
        saveComments(updated)
    }

    const handleSendReply = (commentId: string) => {
        if (!replyText.trim()) return
        const newReply: ProfileCommentReply = {
            id: `r_${Date.now()}`,
            authorName: currentUser.name,
            authorUsername: currentUser.username,
            authorAvatar: currentUser.avatar,
            content: replyText.trim(),
            createdAt: 'Hace un momento',
        }

        const updated = comments.map((c) => {
            if (c.id === commentId) {
                return {
                    ...c,
                    replies: [...(c.replies || []), newReply],
                }
            }
            return c
        })
        saveComments(updated)
        setReplyText('')
        setReplyingToId(null)
    }

    const renderFormattedContent = (content: string, commentId: string) => {
        // Detecta [spoiler]...[/spoiler]
        const parts = content.split(/(\[spoiler\].*?\[\/spoiler\])/gi)

        return parts.map((part, index) => {
            if (part.startsWith('[spoiler]') && part.endsWith('[/spoiler]')) {
                const hiddenText = part.replace(/^\[spoiler\]/i, '').replace(/\[\/spoiler\]$/i, '')
                const isRevealed = revealedSpoilers[`${commentId}_${index}`]

                if (isRevealed) {
                    return (
                        <span key={index} className="text-warning fw-semibold px-1 rounded bg-warning-subtle">
                            {hiddenText}
                        </span>
                    )
                }

                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() =>
                            setRevealedSpoilers((prev) => ({
                                ...prev,
                                [`${commentId}_${index}`]: true,
                            }))
                        }
                        className="perfil-spoiler-box d-inline-flex align-items-center gap-1.5 border-0 text-white my-1"
                        title="Haz clic para ver el spoiler"
                    >
                        <EyeOff size={13} style={{ color: 'var(--perfil-pink)' }} />
                        <span className="small text-danger fw-semibold">Contiene spoiler · Clic para revelar</span>
                    </button>
                )
            }
            return <span key={index}>{part}</span>
        })
    }

    return (
        <div className="perfil-comments-card">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <span className="ml-eyebrow">COMUNIDAD & FEED SOCIAL</span>
                    <h4 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                        <MessageSquare size={17} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Muro de Comentarios ({comments.length})</span>
                    </h4>
                </div>
                <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                    Comentarios en tiempo real
                </span>
            </div>

            {/* Si los comentarios están deshabilitados */}
            {allowComments === 'none' ? (
                <div className="p-4 rounded-3 text-center my-3" style={{ background: 'var(--perfil-card-2)', border: '1px dashed var(--perfil-border)' }}>
                    <Lock size={20} className="mb-2 text-secondary" />
                    <div className="small fw-semibold text-white">Los comentarios están desactivados</div>
                    <div className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                        El dueño del perfil restringió las publicaciones en su muro.
                    </div>
                </div>
            ) : (
                /* Caja de Redacción */
                <form onSubmit={handlePostComment} className="perfil-comment-box">
                    <div className="perfil-comment-tabs">
                        <button
                            type="button"
                            className={`perfil-comment-tab-btn ${activeTab === 'escribir' ? 'active' : ''}`}
                            onClick={() => setActiveTab('escribir')}
                        >
                            Escribir
                        </button>
                        <button
                            type="button"
                            className={`perfil-comment-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('preview')}
                        >
                            Vista Previa
                        </button>

                        {/* Barra de herramientas */}
                        {activeTab === 'escribir' && (
                            <div className="perfil-toolbar">
                                <button
                                    type="button"
                                    onClick={() => insertFormatting('**', '**')}
                                    className="perfil-toolbar-btn"
                                    title="Negrita (**texto**)"
                                >
                                    <Bold size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => insertFormatting('*', '*')}
                                    className="perfil-toolbar-btn"
                                    title="Cursiva (*texto*)"
                                >
                                    <Italic size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => insertFormatting('[spoiler]', '[/spoiler]')}
                                    className="perfil-toolbar-btn"
                                    title="Etiqueta Spoiler ([spoiler]...[/spoiler])"
                                >
                                    <EyeOff size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addEmoji('🍿')}
                                    className="perfil-toolbar-btn"
                                    title="Emoji palomitas"
                                >
                                    🍿
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addEmoji('🔥')}
                                    className="perfil-toolbar-btn"
                                    title="Emoji fuego"
                                >
                                    🔥
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addEmoji('❤️')}
                                    className="perfil-toolbar-btn"
                                    title="Emoji corazón"
                                >
                                    ❤️
                                </button>
                            </div>
                        )}
                    </div>

                    {activeTab === 'escribir' ? (
                        <textarea
                            className="perfil-comment-textarea"
                            rows={3}
                            placeholder="Deja un mensaje en el perfil, recomienda una joya oculta o coordina una watch party..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            maxLength={500}
                        />
                    ) : (
                        <div className="perfil-comment-preview">
                            {commentText ? (
                                renderFormattedContent(commentText, 'preview')
                            ) : (
                                <span className="text-secondary small fst-italic">Nada para previsualizar aún.</span>
                            )}
                        </div>
                    )}

                    <div className="perfil-comment-footer">
                        <label className="d-flex align-items-center gap-1.5 text-secondary small user-select-none" style={{ cursor: 'pointer', fontSize: '0.75rem' }}>
                            <input
                                type="checkbox"
                                checked={hasSpoilerChecked}
                                onChange={(e) => setHasSpoilerChecked(e.target.checked)}
                            />
                            <span>Marcar todo como spoiler</span>
                        </label>

                        <div className="d-flex align-items-center gap-3">
                            <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                {commentText.length}/500
                            </span>
                            <button
                                type="submit"
                                disabled={!commentText.trim()}
                                className="ml-btn ml-btn-acento ml-btn-sm py-1 px-3 d-inline-flex align-items-center gap-1.5"
                            >
                                <Send size={13} />
                                <span>Publicar Comentario</span>
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Feed de Comentarios */}
            <div className="d-flex flex-column gap-2 mt-2">
                {comments.length === 0 ? (
                    <div className="text-center py-4 text-secondary small">
                        Aún no hay comentarios en este muro. ¡Sé el primero en dejar una huella! 🍿
                    </div>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="perfil-comment-item">
                            <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                                <div className="d-flex align-items-center gap-2.5">
                                    <img
                                        src={c.authorAvatar}
                                        alt={c.authorName}
                                        className="rounded-circle"
                                        style={{ width: 34, height: 34, objectFit: 'cover', border: '1px solid var(--perfil-border)' }}
                                    />
                                    <div>
                                        <div className="d-flex align-items-center gap-1.5">
                                            <span className="small fw-bold text-white">{c.authorName}</span>
                                            <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                                @{c.authorUsername}
                                            </span>
                                            {c.authorBadge && (
                                                <span className="badge rounded-pill bg-dark border border-secondary-subtle small py-0.5 px-2" style={{ fontSize: '0.66rem' }}>
                                                    {c.authorBadge}
                                                </span>
                                            )}
                                        </div>
                                        <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                            {c.createdAt}
                                        </span>
                                    </div>
                                </div>

                                {c.authorId === currentUser.id && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(c.id)}
                                        className="btn btn-link text-secondary p-1"
                                        title="Eliminar comentario"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Contenido del comentario con soporte de spoilers */}
                            <div className="small text-white mb-2 ps-1">
                                {renderFormattedContent(c.content, c.id)}
                            </div>

                            {/* Acciones del comentario (Like / Responder) */}
                            <div className="d-flex align-items-center gap-3 pt-1 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                                <button
                                    type="button"
                                    onClick={() => handleLike(c.id)}
                                    className={`btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 small ${c.isLiked ? 'text-danger' : 'text-secondary'}`}
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    <Heart size={13} fill={c.isLiked ? 'currentColor' : 'none'} />
                                    <span>{c.likes}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setReplyingToId(replyingToId === c.id ? null : c.id)}
                                    className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 small text-secondary"
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    <CornerDownRight size={13} />
                                    <span>Responder</span>
                                </button>
                            </div>

                            {/* Formulario de Respuesta Rápida */}
                            {replyingToId === c.id && (
                                <div className="mt-2.5 pt-2 border-top d-flex gap-2" style={{ borderColor: 'var(--perfil-border)' }}>
                                    <input
                                        type="text"
                                        className="cat-search-control flex-grow-1"
                                        placeholder={`Responder a @${c.authorUsername}...`}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSendReply(c.id)}
                                        disabled={!replyText.trim()}
                                        className="ml-btn ml-btn-acento ml-btn-sm py-1 px-2.5"
                                    >
                                        <Send size={12} />
                                    </button>
                                </div>
                            )}

                            {/* Respuestas anidadas */}
                            {c.replies && c.replies.length > 0 && (
                                <div className="mt-2.5 ps-3 border-start ms-2 d-flex flex-column gap-2" style={{ borderColor: 'var(--perfil-border-strong)' }}>
                                    {c.replies.map((r) => (
                                        <div key={r.id} className="d-flex align-items-start gap-2 pt-1">
                                            <img
                                                src={r.authorAvatar}
                                                alt={r.authorName}
                                                className="rounded-circle"
                                                style={{ width: 22, height: 22, objectFit: 'cover' }}
                                            />
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-1.5">
                                                    <span className="small fw-bold text-white" style={{ fontSize: '0.75rem' }}>{r.authorName}</span>
                                                    <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>{r.createdAt}</span>
                                                </div>
                                                <div className="small text-white" style={{ fontSize: '0.78rem' }}>{r.content}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
