import React, { useState } from 'react'
import { Check, Image as ImageIcon, Link as LinkIcon, User } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import type { SocialLinks } from './perfil-types'

const PRESET_AVATARS = [
    { label: 'Spike', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    { label: 'Luffy / Shonen', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150' },
    { label: 'Cyberpunk Girl', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150' },
    { label: 'Mecha Pilot', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' },
    { label: 'Neon Samurai', url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=150' },
    { label: 'Misterio / Noir', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
]

interface EditProfileModalProps {
    open: boolean
    onClose: () => void
    initialName: string
    initialBio: string
    initialAvatar: string
    initialSocials: SocialLinks
    onSave: (data: {
        displayName: string
        bio: string
        avatarUrl: string
        socials: SocialLinks
    }) => Promise<void>
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
    open,
    onClose,
    initialName,
    initialBio,
    initialAvatar,
    initialSocials,
    onSave,
}) => {
    const [name, setName] = useState(initialName)
    const [bio, setBio] = useState(initialBio)
    const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
    const [socials, setSocials] = useState<SocialLinks>(initialSocials)
    const [isSaving, setIsSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            await onSave({
                displayName: name.trim(),
                bio: bio.trim(),
                avatarUrl: avatarUrl.trim(),
                socials,
            })
            onClose()
        } catch (err) {
            console.error('Error al guardar perfil:', err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Editar Perfil" ancho={540}>
            <form onSubmit={handleSubmit} className="p-4 d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">IDENTIDAD · ANIMIGOS</span>
                    <h3 className="h5 fw-bold text-white mb-1">Editar Perfil</h3>
                    <p className="small mb-0" style={{ color: 'var(--perfil-text-muted)' }}>
                        Personaliza tu presencia en la plataforma, tus redes y tu avatar.
                    </p>
                </div>

                {/* Selector de Avatar */}
                <div>
                    <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                        <ImageIcon size={14} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Foto de Perfil / Avatar</span>
                    </label>
                    <div className="d-flex align-items-center gap-3 mb-2">
                        <img
                            src={avatarUrl || initialAvatar}
                            alt="Previsualización"
                            className="rounded-circle"
                            style={{
                                width: '56px',
                                height: '56px',
                                objectFit: 'cover',
                                border: '2px solid var(--perfil-acento)',
                            }}
                            onError={(e) => {
                                e.currentTarget.src = initialAvatar
                            }}
                        />
                        <div className="flex-grow-1">
                            <input
                                type="url"
                                className="cat-search-control w-100"
                                placeholder="URL de imagen personalizada (https://...)"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                            />
                        </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2 pt-1">
                        {PRESET_AVATARS.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => setAvatarUrl(p.url)}
                                className="btn p-0 border-0"
                                title={p.label}
                                style={{
                                    opacity: avatarUrl === p.url ? 1 : 0.6,
                                    transform: avatarUrl === p.url ? 'scale(1.1)' : 'none',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <img
                                    src={p.url}
                                    alt={p.label}
                                    className="rounded-circle"
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        objectFit: 'cover',
                                        border: avatarUrl === p.url ? '2px solid var(--perfil-acento)' : '1px solid var(--perfil-border)',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Nombre para mostrar */}
                <div>
                    <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                        <User size={14} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Nombre para Mostrar</span>
                    </label>
                    <input
                        type="text"
                        required
                        className="cat-search-control w-100"
                        placeholder="Ej. Shinji Ikari"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={50}
                    />
                </div>

                {/* Biografía */}
                <div>
                    <label className="form-label small fw-semibold text-white mb-1.5">Biografía Corta</label>
                    <textarea
                        className="cat-search-control w-100"
                        rows={3}
                        placeholder="Cuéntale a tus amigos qué animes te gustan o qué estás viendo..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={240}
                        style={{ resize: 'none' }}
                    />
                    <div className="text-end small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.72rem' }}>
                        {bio.length}/240 caracteres
                    </div>
                </div>

                {/* Redes Sociales */}
                <div>
                    <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                        <LinkIcon size={14} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Enlaces y Redes Sociales</span>
                    </label>
                    <div className="row g-2">
                        <div className="col-6">
                            <input
                                type="text"
                                className="cat-search-control w-100"
                                placeholder="Usuario MyAnimeList"
                                value={socials.mal || ''}
                                onChange={(e) => setSocials({ ...socials, mal: e.target.value })}
                                style={{ fontSize: '0.78rem', padding: '0.4rem 0.65rem' }}
                            />
                        </div>
                        <div className="col-6">
                            <input
                                type="text"
                                className="cat-search-control w-100"
                                placeholder="Usuario AniList"
                                value={socials.anilist || ''}
                                onChange={(e) => setSocials({ ...socials, anilist: e.target.value })}
                                style={{ fontSize: '0.78rem', padding: '0.4rem 0.65rem' }}
                            />
                        </div>
                        <div className="col-6">
                            <input
                                type="text"
                                className="cat-search-control w-100"
                                placeholder="Discord Tag (#1234)"
                                value={socials.discord || ''}
                                onChange={(e) => setSocials({ ...socials, discord: e.target.value })}
                                style={{ fontSize: '0.78rem', padding: '0.4rem 0.65rem' }}
                            />
                        </div>
                        <div className="col-6">
                            <input
                                type="text"
                                className="cat-search-control w-100"
                                placeholder="Twitter / X (@usuario)"
                                value={socials.twitter || ''}
                                onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                                style={{ fontSize: '0.78rem', padding: '0.4rem 0.65rem' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="d-flex justify-content-end gap-2 pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                    <button type="button" onClick={onClose} className="ml-btn ml-btn-fantasma ml-btn-sm">
                        Cancelar
                    </button>
                    <button type="submit" disabled={isSaving || !name.trim()} className="ml-btn ml-btn-acento ml-btn-sm">
                        <Check size={14} />
                        <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                </div>
            </form>
        </Dialogo>
    )
}
