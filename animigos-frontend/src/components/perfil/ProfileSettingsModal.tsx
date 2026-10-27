import React, { useState, useEffect } from 'react'
import {
    Check,
    Palette,
    User,
    Link as LinkIcon,
    Image as ImageIcon,
    Sparkles,
    ShieldCheck,
    Eye,
    Lock,
    MessageSquare,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { useThemeAccent, OPCIONES_ACENTO } from '../../hooks/useThemeAccent'
import type { SocialLinks, PrivacyConfig } from './perfil-types'

const PRESET_AVATARS = [
    { label: 'Spike', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
    { label: 'Luffy / Shonen', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150' },
    { label: 'Cyberpunk Girl', url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150' },
    { label: 'Mecha Pilot', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' },
    { label: 'Neon Samurai', url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=150' },
    { label: 'Misterio / Noir', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
]

export interface ProfileSettingsModalProps {
    open: boolean
    onClose: () => void
    initialName: string
    initialBio: string
    initialAvatar: string
    initialSocials: SocialLinks
    initialPrivacy: PrivacyConfig
    onSaveProfile: (data: {
        displayName: string
        bio: string
        avatarUrl: string
        socials: SocialLinks
    }) => Promise<void>
    onSavePrivacy: (config: PrivacyConfig) => Promise<void>
    onOpenAvatarPicker?: () => void
    defaultTab?: 'general' | 'perfil' | 'privacidad'
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
    open,
    onClose,
    initialName = '',
    initialBio = '',
    initialAvatar = '',
    initialSocials = {},
    initialPrivacy,
    onSaveProfile,
    onSavePrivacy,
    onOpenAvatarPicker,
    defaultTab = 'general',
}) => {
    const { acentoModo, setAcentoModo } = useThemeAccent()
    const [activeTab, setActiveTab] = useState<'general' | 'perfil' | 'privacidad'>(defaultTab)

    // Estado Perfil
    const [name, setName] = useState(initialName || '')
    const [bio, setBio] = useState(initialBio || '')
    const [avatarUrl, setAvatarUrl] = useState(initialAvatar || '')
    const [socials, setSocials] = useState<SocialLinks>(initialSocials || {})

    // Estado Privacidad
    const [privacy, setPrivacy] = useState<PrivacyConfig>(initialPrivacy)

    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setName(initialName || '')
        setBio(initialBio || '')
        setAvatarUrl(initialAvatar || '')
        setSocials(initialSocials || {})
        setPrivacy(initialPrivacy)
        setActiveTab(defaultTab)
    }, [initialName, initialBio, initialAvatar, initialSocials, initialPrivacy, defaultTab, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        try {
            await Promise.all([
                onSaveProfile({
                    displayName: (name || '').trim(),
                    bio: (bio || '').trim(),
                    avatarUrl: (avatarUrl || '').trim(),
                    socials: socials || {},
                }),
                onSavePrivacy(privacy),
            ])
            onClose()
        } catch (err) {
            console.error('Error guardando configuración:', err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Configuración de Perfil y Plataforma" ancho={620}>
            <form onSubmit={handleSubmit} className="p-4 d-flex flex-column gap-3.5">
                {/* Cabecera del modal */}
                <div>
                    <span className="ml-eyebrow">CONFIGURACIÓN GENERAL · ANIMIGOS</span>
                    <h3 className="h5 fw-bold text-white mb-1">Configuración de Usuario</h3>
                    <p className="small mb-0" style={{ color: 'var(--perfil-text-muted)' }}>
                        Administra el color de acento de la plataforma, tus datos de perfil y la privacidad de tu cuenta.
                    </p>
                </div>

                {/* Tabs de navegación */}
                <div
                    className="d-flex p-1 rounded-3 border"
                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                >
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`flex-grow-1 py-1.5 px-3 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-2 fw-semibold transition-all ${
                            activeTab === 'general' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'general' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'general' ? '#080808' : undefined,
                            fontSize: '0.8rem',
                        }}
                    >
                        <Palette size={14} />
                        <span>Paleta y Tema</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('perfil')}
                        className={`flex-grow-1 py-1.5 px-3 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-2 fw-semibold transition-all ${
                            activeTab === 'perfil' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'perfil' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'perfil' ? '#080808' : undefined,
                            fontSize: '0.8rem',
                        }}
                    >
                        <User size={14} />
                        <span>Datos de Perfil</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('privacidad')}
                        className={`flex-grow-1 py-1.5 px-3 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-2 fw-semibold transition-all ${
                            activeTab === 'privacidad' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'privacidad' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'privacidad' ? '#080808' : undefined,
                            fontSize: '0.8rem',
                        }}
                    >
                        <ShieldCheck size={14} />
                        <span>Privacidad</span>
                    </button>
                </div>

                {/* CONTENIDO TAB 1: Paleta y Tema */}
                {activeTab === 'general' && (
                    <div className="d-flex flex-column gap-3 animate-fade-in">
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                                <Palette size={15} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Color de Acento de la Plataforma</span>
                            </label>
                            <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.78rem' }}>
                                Personaliza el color con el que se iluminan botones, badges, gráficos y la interfaz en toda tu sesión.
                            </p>

                            <div className="row g-2">
                                {OPCIONES_ACENTO.map((opcion) => {
                                    const isSelected = acentoModo === opcion.id
                                    return (
                                        <div key={opcion.id} className="col-12 col-sm-6">
                                            <button
                                                type="button"
                                                onClick={() => setAcentoModo(opcion.id)}
                                                className={`w-100 p-2.5 rounded-3 border d-flex align-items-center justify-content-between text-start transition-all`}
                                                style={{
                                                    background: isSelected
                                                        ? 'var(--perfil-acento-soft)'
                                                        : 'var(--perfil-card-2)',
                                                    borderColor: isSelected
                                                        ? (opcion.color || 'var(--perfil-acento)')
                                                        : 'var(--perfil-border)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2.5">
                                                    <span
                                                        className="rounded-circle flex-shrink-0"
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            backgroundColor: opcion.color || 'var(--perfil-acento)',
                                                            border: '2px solid rgba(255,255,255,0.4)',
                                                            boxShadow: isSelected
                                                                ? `0 0 10px ${opcion.color}`
                                                                : 'none',
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="small fw-bold text-white">
                                                            {opcion.label}
                                                        </div>
                                                        <div
                                                            className="small"
                                                            style={{
                                                                color: 'var(--perfil-text-dim)',
                                                                fontSize: '0.72rem',
                                                            }}
                                                        >
                                                            {opcion.id === 'auto'
                                                                ? 'Reactivo al género principal'
                                                                : opcion.color}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <Check
                                                        size={16}
                                                        style={{ color: opcion.color || 'var(--perfil-acento)' }}
                                                    />
                                                )}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* CONTENIDO TAB 2: Datos de Perfil */}
                {activeTab === 'perfil' && (
                    <div className="d-flex flex-column gap-3 animate-fade-in">
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

                            <div className="d-flex flex-wrap gap-2 pt-1 mb-2">
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
                                                border:
                                                    avatarUrl === p.url
                                                        ? '2px solid var(--perfil-acento)'
                                                        : '1px solid var(--perfil-border)',
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>

                            {onOpenAvatarPicker && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose()
                                        onOpenAvatarPicker()
                                    }}
                                    className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2 py-1.5 rounded-3 border"
                                    style={{
                                        backgroundColor: 'rgba(167, 139, 250, 0.12)',
                                        borderColor: 'var(--perfil-acento)',
                                        color: 'var(--perfil-acento)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                    }}
                                >
                                    <Sparkles size={14} />
                                    <span>Explorar Catálogo Oficial (+800 Avatares de Anime)</span>
                                </button>
                            )}
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
                                rows={2}
                                placeholder="Cuéntale a tus amigos qué animes te gustan o qué estás viendo..."
                                value={bio || ''}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={240}
                                style={{ resize: 'none' }}
                            />
                        </div>

                        {/* Redes Sociales */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
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
                    </div>
                )}

                {/* CONTENIDO TAB 3: Privacidad */}
                {activeTab === 'privacidad' && (
                    <div className="d-flex flex-column gap-3 animate-fade-in">
                        {/* 1. Visibilidad de Mi Lista */}
                        <div className="perfil-switch-wrap">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: privacy.isListPublic
                                            ? 'var(--perfil-green)'
                                            : 'var(--perfil-text-dim)',
                                    }}
                                >
                                    {privacy.isListPublic ? <Eye size={18} /> : <Lock size={18} />}
                                </div>
                                <div>
                                    <div className="text-white fw-semibold small">Lista de Anime Pública</div>
                                    <div
                                        className="small"
                                        style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}
                                    >
                                        {privacy.isListPublic
                                            ? 'Cualquier usuario puede ver tus animes y notas'
                                            : 'Solo tú puedes ver tu colección de animes'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`perfil-pill-toggle ${privacy.isListPublic ? 'is-on' : ''}`}
                                onClick={() => setPrivacy({ ...privacy, isListPublic: !privacy.isListPublic })}
                                aria-label="Alternar visibilidad de lista"
                            >
                                <span className="perfil-pill-handle" />
                            </button>
                        </div>

                        {/* 2. Visibilidad de Estadísticas */}
                        <div className="perfil-switch-wrap">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: privacy.showStats
                                            ? 'var(--perfil-acento)'
                                            : 'var(--perfil-text-dim)',
                                    }}
                                >
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <div className="text-white fw-semibold small">Mostrar Estadísticas de Visionado</div>
                                    <div
                                        className="small"
                                        style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}
                                    >
                                        Distribución de géneros, formato y radar de compatibilidad
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`perfil-pill-toggle ${privacy.showStats ? 'is-on' : ''}`}
                                onClick={() => setPrivacy({ ...privacy, showStats: !privacy.showStats })}
                                aria-label="Alternar estadísticas"
                            >
                                <span className="perfil-pill-handle" />
                            </button>
                        </div>

                        {/* 3. Permisos de Comentarios en el Muro */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                                <MessageSquare size={14} style={{ color: 'var(--perfil-acento)' }} />
                                <span>¿Quién puede publicar en tu muro de perfil?</span>
                            </label>
                            <div className="row g-2">
                                {[
                                    { id: 'everyone', label: 'Toda la Comunidad' },
                                    { id: 'friends', label: 'Solo Mis Amigos' },
                                    { id: 'none', label: 'Nadie (Desactivar)' },
                                ].map((opt) => {
                                    const isSelected = privacy.allowComments === opt.id
                                    return (
                                        <div key={opt.id} className="col-4">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPrivacy({
                                                        ...privacy,
                                                        allowComments: opt.id as 'everyone' | 'friends' | 'none',
                                                    })
                                                }
                                                className={`w-100 p-2.5 rounded-3 border text-center transition-all ${
                                                    isSelected ? 'border-primary' : ''
                                                }`}
                                                style={{
                                                    background: isSelected
                                                        ? 'var(--perfil-acento-soft)'
                                                        : 'var(--perfil-card-2)',
                                                    borderColor: isSelected
                                                        ? 'var(--perfil-acento)'
                                                        : 'var(--perfil-border)',
                                                    color: isSelected ? '#ffffff' : 'var(--perfil-text-muted)',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Acciones del formulario */}
                <div
                    className="d-flex justify-content-end gap-2 pt-3 border-top"
                    style={{ borderColor: 'var(--perfil-border)' }}
                >
                    <button type="button" onClick={onClose} className="ml-btn ml-btn-fantasma ml-btn-sm">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !name.trim()}
                        className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                    >
                        <Check size={14} />
                        <span>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</span>
                    </button>
                </div>
            </form>
        </Dialogo>
    )
}
