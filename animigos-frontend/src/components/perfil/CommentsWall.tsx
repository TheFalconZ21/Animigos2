import React, { useState, useEffect } from 'react'
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
    Users,
    Loader2,
} from 'lucide-react'
import type { ProfileComment } from './perfil-types'
import {
    fetchProfileComments,
    postProfileComment,
    toggleLikeProfileComment,
    replyProfileComment,
    deleteProfileComment,
} from '../../services/friendsApi'
import { resolveMediaUrl } from '../../utils/mediaUrl'

interface CommentsWallProps {
    targetUsername: string
    isProfileOwner?: boolean
    isFriendOfOwner?: boolean
    currentUser: {
        id: string
        name: string
        username: string
        avatar: string
    }
    allowComments?: 'everyone' | 'friends' | 'none'
    initialComments?: ProfileComment[]
}

const DEFAULT_AVATAR =
    '/media/avatars/crunchyroll_classic_collection/classic-hime-avatar-1.webp'

export const CommentsWall: React.FC<CommentsWallProps> = ({
    targetUsername,
    isProfileOwner = true,
    isFriendOfOwner = false,
    currentUser,
    allowComments = 'everyone',
    initialComments,
}) => {
    const [comments, setComments] = useState<ProfileComment[]>(initialComments || [])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [serverCanComment, setServerCanComment] = useState<boolean | undefined>(undefined)

    const isAuthenticated = Boolean(currentUser.username && currentUser.id !== 'guest')

    useEffect(() => {
        if (!targetUsername) {
            setComments([])
            return
        }
        let cancelled = false
        setLoading(true)
        setErrorMsg(null)
        fetchProfileComments(targetUsername)
            .then((res) => {
                if (!cancelled) {
                    setComments(res.comments)
                    if (typeof res.can_comment === 'boolean') {
                        setServerCanComment(res.can_comment)
                    }
                }
            })
            .catch(() => {
                if (!cancelled && initialComments) {
                    setComments(initialComments)
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [targetUsername, currentUser.id, isFriendOfOwner])

    const [activeTab, setActiveTab] = useState<'escribir' | 'preview'>('escribir')
    const [commentText, setCommentText] = useState('')
    const [hasSpoilerChecked, setHasSpoilerChecked] = useState(false)
    const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({})

    // Estado para respuesta anidada
    const [replyingToId, setReplyingToId] = useState<string | null>(null)
    const [replyText, setReplyText] = useState('')
    const [replyLoadingId, setReplyLoadingId] = useState<string | null>(null)

    const canVisitorPost =
        allowComments !== 'none' &&
        isAuthenticated &&
        (serverCanComment !== undefined
            ? serverCanComment
            : isProfileOwner || allowComments === 'everyone' || (allowComments === 'friends' && isFriendOfOwner))

    const insertFormatting = (prefix: string, suffix: string = '') => {
        setCommentText((prev) => `${prev}${prefix}texto${suffix}`)
    }

    const addEmoji = (emoji: string) => {
        setCommentText((prev) => `${prev} ${emoji} `)
    }

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!commentText.trim() || !targetUsername || submitting) return

        setSubmitting(true)
        setErrorMsg(null)
        try {
            const res = await postProfileComment(targetUsername, {
                content: commentText.trim(),
                hasSpoiler: hasSpoilerChecked || commentText.includes('[spoiler]'),
            })
            setComments(res.comments)
            setCommentText('')
            setHasSpoilerChecked(false)
            setActiveTab('escribir')
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'No se pudo publicar el comentario.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleLike = async (commentId: string) => {
        if (!isAuthenticated || !targetUsername) return
        try {
            const updated = await toggleLikeProfileComment(targetUsername, commentId)
            setComments(updated)
        } catch (err) {
            console.error('Error al dar me gusta:', err)
        }
    }

    const handleDelete = async (commentId: string) => {
        if (!targetUsername) return
        try {
            const updated = await deleteProfileComment(targetUsername, commentId)
            setComments(updated)
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el comentario.')
        }
    }

    const handleSendReply = async (commentId: string) => {
        if (!replyText.trim() || !targetUsername || replyLoadingId) return
        setReplyLoadingId(commentId)
        setErrorMsg(null)
        try {
            const updated = await replyProfileComment(targetUsername, commentId, replyText.trim())
            setComments(updated)
            setReplyText('')
            setReplyingToId(null)
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar la respuesta.')
        } finally {
            setReplyLoadingId(null)
        }
    }

    const renderFormattedContent = (content: string, commentId: string) => {
        const parts = content.split(/(\[spoiler\].*?\[\/spoiler\])/gi)

        return parts.map((part, index) => {
            if (part.toLowerCase().startsWith('[spoiler]') && part.toLowerCase().endsWith('[/spoiler]')) {
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
                    {allowComments === 'friends'
                        ? 'Solo amigos pueden comentar'
                        : allowComments === 'none'
                        ? 'Comentarios cerrados'
                        : 'Abierto a la comunidad'}
                </span>
            </div>

            {errorMsg && (
                <div
                    className="small p-2.5 rounded-3 mb-3 text-danger bg-danger-subtle border border-danger"
                    style={{ fontSize: '0.78rem' }}
                >
                    {errorMsg}
                </div>
            )}

            {/* Estado de permisos para publicar en el muro */}
            {allowComments === 'none' ? (
                <div
                    className="p-4 rounded-3 text-center my-3"
                    style={{ background: 'var(--perfil-card-2)', border: '1px dashed var(--perfil-border)' }}
                >
                    <Lock size={20} className="mb-2 text-secondary" />
                    <div className="small fw-semibold text-white">Los comentarios están desactivados</div>
                    <div className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                        El dueño del perfil restringió las publicaciones en su muro.
                    </div>
                </div>
            ) : !isAuthenticated ? (
                <div
                    className="p-4 rounded-3 text-center my-3"
                    style={{ background: 'var(--perfil-card-2)', border: '1px dashed var(--perfil-border)' }}
                >
                    <Lock size={20} className="mb-2 text-secondary" />
                    <div className="small fw-semibold text-white">Inicia sesión para comentar</div>
                    <div className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                        Necesitas una cuenta activa en Animigos para dejar mensajes en el muro de @{targetUsername}.
                    </div>
                </div>
            ) : !canVisitorPost && allowComments === 'friends' ? (
                <div
                    className="p-4 rounded-3 text-center my-3"
                    style={{ background: 'var(--perfil-card-2)', border: '1px dashed var(--perfil-border)' }}
                >
                    <Users size={20} className="mb-2" style={{ color: 'var(--perfil-acento)' }} />
                    <div className="small fw-semibold text-white">Muro exclusivo para amigos</div>
                    <div className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                        Solo los amigos confirmados de <strong>@{targetUsername}</strong> pueden publicar comentarios en su muro.
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
                            placeholder={
                                isProfileOwner
                                    ? 'Deja un mensaje en tu muro, recomienda una joya oculta o coordina una watch party...'
                                    : `Déjale un comentario en el muro a @${targetUsername}...`
                            }
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
                        <label
                            className="d-flex align-items-center gap-1.5 text-secondary small user-select-none"
                            style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                        >
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
                                disabled={!commentText.trim() || submitting}
                                className="ml-btn ml-btn-acento ml-btn-sm py-1 px-3 d-inline-flex align-items-center gap-1.5"
                            >
                                {submitting ? (
                                    <Loader2 size={13} className="spinner-border spinner-border-sm" />
                                ) : (
                                    <Send size={13} />
                                )}
                                <span>{submitting ? 'Publicando...' : 'Publicar Comentario'}</span>
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Feed de Comentarios */}
            <div className="d-flex flex-column gap-2 mt-2">
                {loading && comments.length === 0 ? (
                    <div className="text-center py-4 text-secondary small">
                        <Loader2 size={18} className="spinner-border me-2" />
                        <span>Cargando comentarios del muro...</span>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-4 text-secondary small">
                        Aún no hay comentarios en este muro. ¡Sé el primero en dejar una huella! 🍿
                    </div>
                ) : (
                    comments.map((c) => {
                        const canDelete =
                            isProfileOwner ||
                            c.authorId === currentUser.id ||
                            (c.authorUsername &&
                                currentUser.username &&
                                c.authorUsername.toLowerCase() === currentUser.username.toLowerCase())

                        return (
                            <div key={c.id} className="perfil-comment-item">
                                <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                                    <div
                                        className="d-flex align-items-center gap-2.5"
                                        style={{ cursor: c.authorUsername ? 'pointer' : 'default' }}
                                        onClick={() => {
                                            if (c.authorUsername) {
                                                window.location.hash = `#perfil/${encodeURIComponent(c.authorUsername)}`
                                            }
                                        }}
                                    >
                                        <img
                                            src={resolveMediaUrl(c.authorAvatar || DEFAULT_AVATAR)}
                                            crossOrigin="anonymous"
                                            alt={c.authorName}
                                            className="rounded-circle"
                                            style={{
                                                width: 34,
                                                height: 34,
                                                objectFit: 'cover',
                                                border: '1px solid var(--perfil-border)',
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.src = resolveMediaUrl(DEFAULT_AVATAR)
                                            }}
                                        />
                                        <div>
                                            <div className="d-flex align-items-center gap-1.5">
                                                <span className="small fw-bold text-white">{c.authorName}</span>
                                                <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                                    @{c.authorUsername}
                                                </span>
                                                {c.authorBadge && (
                                                    <span
                                                        className="badge rounded-pill bg-dark border border-secondary-subtle small py-0.5 px-2"
                                                        style={{ fontSize: '0.66rem' }}
                                                    >
                                                        {c.authorBadge}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                                {c.createdAt}
                                            </span>
                                        </div>
                                    </div>

                                    {canDelete && (
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
                                    {c.hasSpoiler && !c.content.toLowerCase().includes('[spoiler]')
                                        ? renderFormattedContent(`[spoiler]${c.content}[/spoiler]`, c.id)
                                        : renderFormattedContent(c.content, c.id)}
                                </div>

                                {/* Acciones del comentario (Like / Responder) */}
                                <div
                                    className="d-flex align-items-center gap-3 pt-1 border-top"
                                    style={{ borderColor: 'var(--perfil-border)' }}
                                >
                                    <button
                                        type="button"
                                        disabled={!isAuthenticated}
                                        onClick={() => handleLike(c.id)}
                                        className={`btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 small ${
                                            c.isLiked ? 'text-danger' : 'text-secondary'
                                        }`}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        <Heart size={13} fill={c.isLiked ? 'currentColor' : 'none'} />
                                        <span>{c.likes}</span>
                                    </button>

                                    {canVisitorPost && (
                                        <button
                                            type="button"
                                            onClick={() => setReplyingToId(replyingToId === c.id ? null : c.id)}
                                            className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 small text-secondary"
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            <CornerDownRight size={13} />
                                            <span>Responder</span>
                                        </button>
                                    )}
                                </div>

                                {/* Formulario de Respuesta Rápida */}
                                {replyingToId === c.id && canVisitorPost && (
                                    <div
                                        className="mt-2.5 pt-2 border-top d-flex gap-2"
                                        style={{ borderColor: 'var(--perfil-border)' }}
                                    >
                                        <input
                                            type="text"
                                            className="cat-search-control flex-grow-1"
                                            placeholder={`Responder a @${c.authorUsername}...`}
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleSendReply(c.id)
                                                }
                                            }}
                                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSendReply(c.id)}
                                            disabled={!replyText.trim() || replyLoadingId === c.id}
                                            className="ml-btn ml-btn-acento ml-btn-sm py-1 px-2.5"
                                        >
                                            {replyLoadingId === c.id ? (
                                                <Loader2 size={12} className="spinner-border spinner-border-sm" />
                                            ) : (
                                                <Send size={12} />
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Respuestas anidadas */}
                                {c.replies && c.replies.length > 0 && (
                                    <div
                                        className="mt-2.5 ps-3 border-start ms-2 d-flex flex-column gap-2"
                                        style={{ borderColor: 'var(--perfil-border-strong)' }}
                                    >
                                        {c.replies.map((r) => (
                                            <div key={r.id} className="d-flex align-items-start gap-2 pt-1">
                                                <img
                                                    src={resolveMediaUrl(r.authorAvatar || DEFAULT_AVATAR)}
                                                    crossOrigin="anonymous"
                                                    alt={r.authorName}
                                                    className="rounded-circle"
                                                    style={{ width: 22, height: 22, objectFit: 'cover' }}
                                                    onError={(e) => {
                                                        e.currentTarget.src = resolveMediaUrl(DEFAULT_AVATAR)
                                                    }}
                                                />
                                                <div className="flex-grow-1">
                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <span
                                                            className="small fw-bold text-white"
                                                            style={{ fontSize: '0.75rem' }}
                                                        >
                                                            {r.authorName}
                                                        </span>
                                                        <span
                                                            className="small text-secondary"
                                                            style={{ fontSize: '0.68rem' }}
                                                        >
                                                            {r.createdAt}
                                                        </span>
                                                    </div>
                                                    <div className="small text-white" style={{ fontSize: '0.78rem' }}>
                                                        {r.content}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
