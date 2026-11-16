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
    MessageSquare,
    Globe,
    Play,
    ExternalLink,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { useThemeAccent, OPCIONES_ACENTO } from '../../hooks/useThemeAccent'
import {
    useAssociatedLinks,
    buildAssociatedAnimeUrl,
    type AssociatedLinksConfig,
    type NameSeparator,
    type SectionSeparator,
    type SuffixSeparator,
} from '../../hooks/useAssociatedLinks'
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
    defaultTab?: 'general' | 'perfil' | 'privacidad' | 'links'
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
    const [activeTab, setActiveTab] = useState<'general' | 'perfil' | 'privacidad' | 'links'>(defaultTab)

    // Estado Perfil
    const [name, setName] = useState(initialName || '')
    const [bio, setBio] = useState(initialBio || '')
    const [avatarUrl, setAvatarUrl] = useState(initialAvatar || '')
    const [socials, setSocials] = useState<SocialLinks>(initialSocials || {})

    // Estado Privacidad
    const [privacy, setPrivacy] = useState<PrivacyConfig>(initialPrivacy)

    // Estado Links Asociados
    const { config: storedLinksConfig, updateConfig: updateLinksConfig } = useAssociatedLinks()
    const [linksConfig, setLinksConfig] = useState<AssociatedLinksConfig>(storedLinksConfig)
    const [testAnime, setTestAnime] = useState('Sousou no Frieren')

    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setName(initialName || '')
        setBio(initialBio || '')
        setAvatarUrl(initialAvatar || '')
        setSocials(initialSocials || {})
        setPrivacy(initialPrivacy)
        setLinksConfig(storedLinksConfig)
        setActiveTab(defaultTab)
    }, [initialName, initialBio, initialAvatar, initialSocials, initialPrivacy, storedLinksConfig, defaultTab, open])

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
            updateLinksConfig(linksConfig)
            onClose()
        } catch (err) {
            console.error('Error guardando configuración:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const livePreviewUrl = buildAssociatedAnimeUrl(testAnime, linksConfig)

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Configuración de Perfil y Plataforma" ancho={660}>
            <form onSubmit={handleSubmit} className="p-4 d-flex flex-column gap-3.5">
                {/* Cabecera del modal */}
                <div>
                    <span className="ml-eyebrow">CONFIGURACIÓN GENERAL · ANIMIGOS</span>
                    <h3 className="h5 fw-bold text-white mb-1">Configuración de Usuario</h3>
                    <p className="small mb-0" style={{ color: 'var(--perfil-text-muted)' }}>
                        Personaliza tu tema, datos de perfil, privacidad y los links asociados para reproducción directa de animes.
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
                        className={`flex-grow-1 py-1.5 px-2 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold transition-all ${
                            activeTab === 'general' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'general' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'general' ? '#080808' : undefined,
                            fontSize: '0.78rem',
                        }}
                    >
                        <Palette size={13} />
                        <span>Paleta y Tema</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('perfil')}
                        className={`flex-grow-1 py-1.5 px-2 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold transition-all ${
                            activeTab === 'perfil' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'perfil' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'perfil' ? '#080808' : undefined,
                            fontSize: '0.78rem',
                        }}
                    >
                        <User size={13} />
                        <span>Datos de Perfil</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('privacidad')}
                        className={`flex-grow-1 py-1.5 px-2 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold transition-all ${
                            activeTab === 'privacidad' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'privacidad' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'privacidad' ? '#080808' : undefined,
                            fontSize: '0.78rem',
                        }}
                    >
                        <ShieldCheck size={13} />
                        <span>Privacidad</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('links')}
                        className={`flex-grow-1 py-1.5 px-2 rounded-2 btn btn-sm border-0 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold transition-all ${
                            activeTab === 'links' ? 'text-white shadow-sm' : 'text-secondary'
                        }`}
                        style={{
                            background: activeTab === 'links' ? 'var(--perfil-acento)' : 'transparent',
                            color: activeTab === 'links' ? '#080808' : undefined,
                            fontSize: '0.78rem',
                        }}
                    >
                        <LinkIcon size={13} />
                        <span>Links Asociados</span>
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
                                        <div key={opcion.id} className="col-6 col-sm-4">
                                            <button
                                                type="button"
                                                onClick={() => setAcentoModo(opcion.id)}
                                                className={`w-100 p-2.5 border text-start d-flex align-items-center gap-2.5 transition-all ${
                                                    isSelected ? 'border-primary' : ''
                                                }`}
                                                style={{
                                                    borderRadius: 12,
                                                    background: isSelected
                                                        ? 'var(--perfil-acento-soft)'
                                                        : 'var(--perfil-card-2)',
                                                    borderColor: isSelected
                                                        ? 'var(--perfil-acento)'
                                                        : 'var(--perfil-border)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <span
                                                    className="rounded-circle flex-shrink-0"
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        background: opcion.color,
                                                        boxShadow: `0 0 10px ${opcion.color}88`,
                                                    }}
                                                />
                                                <span
                                                    className="small text-truncate"
                                                    style={{
                                                        color: isSelected ? '#ffffff' : 'var(--perfil-text-muted)',
                                                        fontWeight: isSelected ? 700 : 500,
                                                        fontSize: '0.76rem',
                                                    }}
                                                >
                                                    {opcion.label}
                                                </span>
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
                        {/* Selector de Avatar con Previews */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center justify-content-between mb-2">
                                <span className="d-inline-flex align-items-center gap-1.5">
                                    <ImageIcon size={15} style={{ color: 'var(--perfil-acento)' }} />
                                    <span>Foto de Perfil / Avatar</span>
                                </span>
                                {onOpenAvatarPicker && (
                                    <button
                                        type="button"
                                        onClick={onOpenAvatarPicker}
                                        className="btn btn-link p-0 text-decoration-none small"
                                        style={{ color: 'var(--perfil-acento)', fontSize: '0.74rem' }}
                                    >
                                        Explorar Catálogo Completo ↗
                                    </button>
                                )}
                            </label>

                            <div className="d-flex align-items-center gap-3 p-3 rounded-3 border" style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}>
                                <img
                                    src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                    alt="Preview"
                                    className="rounded-circle border"
                                    style={{
                                        width: 54,
                                        height: 54,
                                        objectFit: 'cover',
                                        borderColor: 'var(--perfil-acento)',
                                    }}
                                />
                                <div className="flex-grow-1">
                                    <div className="small fw-semibold text-white mb-1.5" style={{ fontSize: '0.75rem' }}>
                                        Presets Rápidos:
                                    </div>
                                    <div className="d-flex flex-wrap gap-1.5">
                                        {PRESET_AVATARS.map((av) => (
                                            <button
                                                key={av.label}
                                                type="button"
                                                onClick={() => setAvatarUrl(av.url)}
                                                className="btn btn-sm py-0.5 px-2 rounded-pill"
                                                style={{
                                                    background: avatarUrl === av.url ? 'var(--perfil-acento)' : 'rgba(255, 255, 255, 0.05)',
                                                    color: avatarUrl === av.url ? '#080808' : 'var(--perfil-text-muted)',
                                                    fontSize: '0.72rem',
                                                    border: '1px solid var(--perfil-border)',
                                                }}
                                            >
                                                {av.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Nombre a Mostrar */}
                        <div>
                            <label className="form-label small fw-semibold text-white mb-1">Nombre Visible / Alias</label>
                            <input
                                type="text"
                                className="form-control form-control-sm text-white"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    borderColor: 'var(--perfil-border)',
                                    fontSize: '0.82rem',
                                }}
                                placeholder="Tu nombre en Animigos"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={30}
                                required
                            />
                        </div>

                        {/* Biografía */}
                        <div>
                            <label className="form-label small fw-semibold text-white mb-1">Biografía / Presentación</label>
                            <textarea
                                className="form-control form-control-sm text-white"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    borderColor: 'var(--perfil-border)',
                                    fontSize: '0.82rem',
                                    resize: 'none',
                                }}
                                rows={2}
                                placeholder="Escribe un estado o frase que te identifique..."
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={160}
                            />
                            <div className="text-end small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.7rem' }}>
                                {bio.length}/160 caracteres
                            </div>
                        </div>

                        {/* Redes Sociales y Enlaces */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                                <LinkIcon size={14} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Redes Sociales Vinculadas</span>
                            </label>
                            <div className="row g-2">
                                <div className="col-6">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', fontSize: '0.76rem' }}
                                        placeholder="Usuario MyAnimeList"
                                        value={socials.mal || ''}
                                        onChange={(e) => setSocials({ ...socials, mal: e.target.value })}
                                    />
                                </div>
                                <div className="col-6">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', fontSize: '0.76rem' }}
                                        placeholder="Usuario AniList"
                                        value={socials.anilist || ''}
                                        onChange={(e) => setSocials({ ...socials, anilist: e.target.value })}
                                    />
                                </div>
                                <div className="col-6">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', fontSize: '0.76rem' }}
                                        placeholder="Tag Discord (ej: luffy#1234)"
                                        value={socials.discord || ''}
                                        onChange={(e) => setSocials({ ...socials, discord: e.target.value })}
                                    />
                                </div>
                                <div className="col-6">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm text-white"
                                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', fontSize: '0.76rem' }}
                                        placeholder="Perfil X / Twitter"
                                        value={socials.twitter || ''}
                                        onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
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
                                    <Eye size={18} />
                                </div>
                                <div>
                                    <div className="text-white fw-semibold small">Lista de Anime Pública</div>
                                    <div
                                        className="small"
                                        style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}
                                    >
                                        Cualquier usuario puede ver tus animes y notas
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`perfil-pill-toggle ${privacy.isListPublic ? 'is-on' : ''}`}
                                onClick={() => setPrivacy({ ...privacy, isListPublic: !privacy.isListPublic })}
                                aria-label="Alternar lista pública"
                            >
                                <span className="perfil-pill-handle" />
                            </button>
                        </div>

                        {/* 2. Estadísticas de Visionado */}
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

                        {/* 3. Recepción de Recomendaciones Directas */}
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
                                        color:
                                            privacy.allowRecommendations !== false
                                                ? 'var(--perfil-acento)'
                                                : 'var(--perfil-text-dim)',
                                    }}
                                >
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <div className="text-white fw-semibold small">Permitir Recomendaciones Directas</div>
                                    <div
                                        className="small"
                                        style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}
                                    >
                                        {privacy.allowRecommendations !== false
                                            ? 'Otros usuarios pueden recomendarte animes desde tu perfil'
                                            : 'Nadie puede enviarte recomendaciones directas'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`perfil-pill-toggle ${privacy.allowRecommendations !== false ? 'is-on' : ''}`}
                                onClick={() =>
                                    setPrivacy({
                                        ...privacy,
                                        allowRecommendations: privacy.allowRecommendations === false,
                                    })
                                }
                                aria-label="Alternar recepción de recomendaciones"
                            >
                                <span className="perfil-pill-handle" />
                            </button>
                        </div>

                        {/* 4. Permisos de Comentarios en el Muro */}
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
                                                className={`w-100 p-2.5 border text-center transition-all ${
                                                    isSelected ? 'border-primary' : ''
                                                }`}
                                                style={{
                                                    borderRadius: 12,
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

                {/* CONTENIDO TAB 4: Links Asociados (Estructura Modular Generalizada) */}
                {activeTab === 'links' && (
                    <div className="d-flex flex-column gap-3 animate-fade-in">
                        {/* Toggle de activación general */}
                        <div className="perfil-switch-wrap mb-0">
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
                                        color: linksConfig.enabled ? 'var(--perfil-acento)' : 'var(--perfil-text-dim)',
                                    }}
                                >
                                    <Play size={17} fill="currentColor" />
                                </div>
                                <div>
                                    <div className="text-white fw-semibold small">Activar Botón de Enlace Externo ("Ver")</div>
                                    <div className="small" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}>
                                        Muestra el botón "Ver" en cada anime para navegar a la estructura personalizada que configures
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`perfil-pill-toggle ${linksConfig.enabled ? 'is-on' : ''}`}
                                onClick={() => setLinksConfig({ ...linksConfig, enabled: !linksConfig.enabled })}
                                aria-label="Alternar links asociados"
                            >
                                <span className="perfil-pill-handle" />
                            </button>
                        </div>

                        {/* 1. Dominio General */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                <Globe size={14} style={{ color: 'var(--perfil-acento)' }} />
                                <span>1. Dominio General</span>
                            </label>
                            <div className="position-relative">
                                <input
                                    type="text"
                                    className="form-control form-control-sm text-white"
                                    style={{
                                        background: 'var(--perfil-card-2)',
                                        borderColor: 'var(--perfil-border)',
                                        fontSize: '0.82rem',
                                        paddingLeft: '2.1rem',
                                    }}
                                    placeholder="ej: www.monoschinos.st, tusitio.com, crunchyroll.com..."
                                    value={linksConfig.domain}
                                    onChange={(e) => setLinksConfig({ ...linksConfig, domain: e.target.value })}
                                />
                                <Globe
                                    size={14}
                                    className="position-absolute text-secondary"
                                    style={{ left: 10, top: '50%', transform: 'translateY(-50%)' }}
                                />
                            </div>
                            <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.7rem' }}>
                                Dirección o servidor web principal al que apuntarán los enlaces.
                            </div>
                        </div>

                        {/* 2. Término Intermedio y Separador de Secciones */}
                        <div className="row g-2">
                            <div className="col-7">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span className="ml-eyebrow mb-0" style={{ fontSize: '0.7rem' }}>2. TÉRMINO INTERMEDIO (OPCIONAL)</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm text-white"
                                    style={{
                                        background: 'var(--perfil-card-2)',
                                        borderColor: 'var(--perfil-border)',
                                        fontSize: '0.82rem',
                                    }}
                                    placeholder="ej: anime, series, ver (o vacío)"
                                    value={linksConfig.intermediateTerm || ''}
                                    onChange={(e) => setLinksConfig({ ...linksConfig, intermediateTerm: e.target.value })}
                                />
                                <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.7rem' }}>
                                    Ruta o categoría intermedia antes del nombre.
                                </div>
                            </div>

                            <div className="col-5">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span className="ml-eyebrow mb-0" style={{ fontSize: '0.7rem' }}>SEPARADOR DE SECCIONES</span>
                                </label>
                                <div className="d-flex gap-1.5">
                                    {[
                                        { id: 'barra' as SectionSeparator, label: 'Barra (/)', short: '/' },
                                        { id: 'guion' as SectionSeparator, label: 'Guión (-)', short: '-' },
                                        { id: 'ninguna' as SectionSeparator, label: 'Ninguna', short: 'Ø' },
                                    ].map((opt) => {
                                        const isSelected = (linksConfig.sectionSeparator || 'barra') === opt.id
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setLinksConfig({ ...linksConfig, sectionSeparator: opt.id })}
                                                className={`flex-grow-1 p-2 border text-center transition-all ${
                                                    isSelected ? 'border-primary' : ''
                                                }`}
                                                style={{
                                                    borderRadius: 8,
                                                    background: isSelected
                                                        ? 'var(--perfil-acento-soft)'
                                                        : 'var(--perfil-card-2)',
                                                    borderColor: isSelected
                                                        ? 'var(--perfil-acento)'
                                                        : 'var(--perfil-border)',
                                                    cursor: 'pointer',
                                                }}
                                                title={opt.label}
                                            >
                                                <div
                                                    className="small fw-bold"
                                                    style={{ color: isSelected ? '#ffffff' : 'var(--perfil-text-muted)', fontSize: '0.75rem' }}
                                                >
                                                    {opt.short}
                                                </div>
                                                <div
                                                    className="text-truncate"
                                                    style={{ color: 'var(--perfil-text-dim)', fontSize: '0.62rem' }}
                                                >
                                                    {opt.id}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 3. Separación de Nombre del Anime */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                <span className="ml-eyebrow mb-0" style={{ fontSize: '0.7rem' }}>3. SEPARACIÓN DE NOMBRE DEL ANIME</span>
                            </label>
                            <div className="row g-2">
                                {[
                                    {
                                        id: 'guion' as NameSeparator,
                                        label: 'Guión (-)',
                                        example: 'ej: sousou-no-frieren',
                                    },
                                    {
                                        id: 'ninguna' as NameSeparator,
                                        label: 'Ninguna',
                                        example: 'ej: sousounofrieren',
                                    },
                                ].map((opt) => {
                                    const isSelected = (linksConfig.nameSeparator || 'guion') === opt.id
                                    return (
                                        <div key={opt.id} className="col-6">
                                            <button
                                                type="button"
                                                onClick={() => setLinksConfig({ ...linksConfig, nameSeparator: opt.id })}
                                                className={`w-100 p-2.5 border text-start transition-all ${
                                                    isSelected ? 'border-primary' : ''
                                                }`}
                                                style={{
                                                    borderRadius: 10,
                                                    background: isSelected
                                                        ? 'var(--perfil-acento-soft)'
                                                        : 'var(--perfil-card-2)',
                                                    borderColor: isSelected
                                                        ? 'var(--perfil-acento)'
                                                        : 'var(--perfil-border)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div
                                                    className="small fw-bold"
                                                    style={{ color: isSelected ? '#ffffff' : 'var(--perfil-text-muted)' }}
                                                >
                                                    {opt.label}
                                                </div>
                                                <div
                                                    className="text-truncate"
                                                    style={{ color: 'var(--perfil-text-dim)', fontSize: '0.7rem' }}
                                                >
                                                    {opt.example}
                                                </div>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 4. Terminación Única y su Separador */}
                        <div className="row g-2">
                            <div className="col-7">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span className="ml-eyebrow mb-0" style={{ fontSize: '0.7rem' }}>4. TERMINACIÓN ÚNICA DEL SITIO (OPCIONAL)</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm text-white"
                                    style={{
                                        background: 'var(--perfil-card-2)',
                                        borderColor: 'var(--perfil-border)',
                                        fontSize: '0.82rem',
                                    }}
                                    placeholder="ej: sub-espanol, hd, online (o vacío)"
                                    value={linksConfig.suffix || ''}
                                    onChange={(e) => setLinksConfig({ ...linksConfig, suffix: e.target.value })}
                                />
                                <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.68rem' }}>
                                    Sufijo final. Si prefieres que la terminación sea el capítulo, puedes escribirlo aquí.
                                </div>
                            </div>

                            <div className="col-5">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span className="ml-eyebrow mb-0" style={{ fontSize: '0.7rem' }}>SEPARADOR DE TERMINACIÓN</span>
                                </label>
                                <div className="d-flex gap-1">
                                    {[
                                        { id: 'guion' as SuffixSeparator, label: 'Guión (-)', short: '-' },
                                        { id: 'barra' as SuffixSeparator, label: 'Barra (/)', short: '/' },
                                        { id: 'punto' as SuffixSeparator, label: 'Punto (.)', short: '.' },
                                        { id: 'ninguna' as SuffixSeparator, label: 'Ninguno', short: 'Ø' },
                                    ].map((opt) => {
                                        const isSelected = (linksConfig.suffixSeparator || 'guion') === opt.id
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setLinksConfig({ ...linksConfig, suffixSeparator: opt.id })}
                                                className={`flex-grow-1 p-2 border text-center transition-all ${
                                                    isSelected ? 'border-primary' : ''
                                                }`}
                                                style={{
                                                    borderRadius: 8,
                                                    background: isSelected
                                                        ? 'var(--perfil-acento-soft)'
                                                        : 'var(--perfil-card-2)',
                                                    borderColor: isSelected
                                                        ? 'var(--perfil-acento)'
                                                        : 'var(--perfil-border)',
                                                    cursor: 'pointer',
                                                }}
                                                title={opt.label}
                                            >
                                                <div
                                                    className="small fw-bold"
                                                    style={{ color: isSelected ? '#ffffff' : 'var(--perfil-text-muted)', fontSize: '0.75rem' }}
                                                >
                                                    {opt.short}
                                                </div>
                                                <div
                                                    className="text-truncate"
                                                    style={{ color: 'var(--perfil-text-dim)', fontSize: '0.62rem' }}
                                                >
                                                    {opt.id}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 5. Simulador / Live Preview en Tiempo Real */}
                        <div
                            className="p-3 rounded-3 border"
                            style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                borderColor: 'var(--perfil-border)',
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small fw-bold text-white d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.78rem' }}>
                                    <Sparkles size={13} style={{ color: 'var(--perfil-acento)' }} />
                                    <span>Simulador en Vivo · Probar Enlace Generado</span>
                                </span>
                                <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                    dominio + intermedio + nombre + terminación
                                </span>
                            </div>

                            {/* Input de prueba: solo anime */}
                            <div className="mb-2.5">
                                <label className="text-secondary small mb-1" style={{ fontSize: '0.68rem' }}>
                                    Anime de prueba:
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm text-white"
                                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', fontSize: '0.76rem' }}
                                    value={testAnime}
                                    onChange={(e) => setTestAnime(e.target.value)}
                                    placeholder="ej: Sousou no Frieren"
                                />
                            </div>

                            {/* Caja de Enlace Generado */}
                            <div
                                className="d-flex align-items-center justify-content-between p-2.5 rounded-2 border"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    borderColor: 'color-mix(in srgb, var(--perfil-acento) 35%, var(--perfil-border))',
                                }}
                            >
                                <div className="text-truncate me-2">
                                    <div className="small font-mono text-truncate" style={{ color: 'var(--perfil-acento)', fontSize: '0.75rem' }}>
                                        {livePreviewUrl !== '#' ? livePreviewUrl : 'Configura un dominio arriba para generar la ruta'}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    disabled={livePreviewUrl === '#'}
                                    onClick={() => livePreviewUrl !== '#' && window.open(livePreviewUrl, '_blank', 'noopener,noreferrer')}
                                    className="btn btn-sm d-inline-flex align-items-center gap-1 flex-shrink-0"
                                    style={{
                                        background: livePreviewUrl !== '#' ? 'var(--perfil-acento)' : 'rgba(255, 255, 255, 0.1)',
                                        color: livePreviewUrl !== '#' ? '#080808' : 'rgba(255, 255, 255, 0.3)',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        borderRadius: 6,
                                        padding: '0.25rem 0.6rem',
                                    }}
                                    title="Abrir enlace de prueba en una nueva pestaña"
                                >
                                    <span>Probar</span>
                                    <ExternalLink size={11} />
                                </button>
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
