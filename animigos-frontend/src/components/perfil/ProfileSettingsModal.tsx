import React, { useState, useEffect, useRef } from 'react'
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
    cleanAnimeTitleForSlug,
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

type ActiveLinkField = 'domain' | 'intermediate' | 'sectionSeparator' | 'name' | 'suffixSeparator' | 'suffix' | null

const FIELD_COLORS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    domain: {
        label: 'Dominio General',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.22)',
        border: 'rgba(56, 189, 248, 0.65)',
    },
    sectionSeparator: {
        label: 'Separador de Secciones',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.25)',
        border: 'rgba(251, 191, 36, 0.75)',
    },
    intermediate: {
        label: 'Término Intermedio',
        color: '#34d399',
        bg: 'rgba(52, 211, 153, 0.22)',
        border: 'rgba(52, 211, 153, 0.65)',
    },
    name: {
        label: 'Nombre del Anime',
        color: '#c084fc',
        bg: 'rgba(192, 132, 252, 0.22)',
        border: 'rgba(192, 132, 252, 0.65)',
    },
    suffixSeparator: {
        label: 'Separador de Terminación',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.25)',
        border: 'rgba(245, 158, 11, 0.75)',
    },
    suffix: {
        label: 'Terminación Única',
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.22)',
        border: 'rgba(244, 63, 94, 0.65)',
    },
}

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
    const [activeField, setActiveField] = useState<ActiveLinkField>(null)

    // Refs para enfocar inputs al interactuar con el enlace de ejemplo
    const domainInputRef = useRef<HTMLInputElement>(null)
    const intermediateInputRef = useRef<HTMLInputElement>(null)
    const suffixInputRef = useRef<HTMLInputElement>(null)
    const testAnimeInputRef = useRef<HTMLInputElement>(null)

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

                        {/* PANEL SUPERIOR: Guía Visual Interactiva de Ejemplo + Resultado Dinámico */}
                        {(() => {
                            const rawInter = (linksConfig.intermediateTerm || '').trim().replace(/^\/+|\/+$/g, '')
                            const rawSuffix = (linksConfig.suffix || '').trim().replace(/^[-/.]+/, '')
                            const animeSlug = cleanAnimeTitleForSlug(testAnime || 'Sousou no Frieren', linksConfig.nameSeparator || 'guion')
                            const domainClean = linksConfig.domain
                                ? linksConfig.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
                                : ''

                            const sectionChar =
                                linksConfig.sectionSeparator === 'guion'
                                    ? '-'
                                    : linksConfig.sectionSeparator === 'ninguna'
                                    ? ''
                                    : '/'
                            const suffixChar =
                                linksConfig.suffixSeparator === 'barra'
                                    ? '/'
                                    : linksConfig.suffixSeparator === 'punto'
                                    ? '.'
                                    : linksConfig.suffixSeparator === 'ninguna'
                                    ? ''
                                    : '-'

                            const getExampleSegmentStyle = (field: ActiveLinkField) => {
                                if (!field) return {}
                                const meta = FIELD_COLORS[field]
                                const isActive = activeField === field
                                return {
                                    color: isActive ? '#ffffff' : meta.color,
                                    background: isActive ? meta.bg : 'rgba(255, 255, 255, 0.04)',
                                    border: isActive ? `1px solid ${meta.border}` : '1px solid rgba(255, 255, 255, 0.08)',
                                    boxShadow: isActive ? `0 0 12px ${meta.color}66` : 'none',
                                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                    fontWeight: isActive ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                }
                            }

                            const getDynamicSegmentStyle = (field: ActiveLinkField, isFilled: boolean) => {
                                if (!field) return {}
                                const meta = FIELD_COLORS[field]
                                const isActive = activeField === field
                                return {
                                    color: isActive ? '#ffffff' : isFilled ? meta.color : 'rgba(255, 255, 255, 0.35)',
                                    background: isActive ? meta.bg : 'transparent',
                                    border: isActive ? `1px solid ${meta.border}` : '1px solid transparent',
                                    boxShadow: isActive ? `0 0 10px ${meta.color}55` : 'none',
                                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                    fontWeight: isActive || isFilled ? 600 : 400,
                                    fontStyle: !isFilled ? 'italic' : 'normal',
                                    cursor: 'pointer',
                                    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                }
                            }

                            return (
                                <div
                                    className="p-3 rounded-3 border"
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(16, 16, 24, 0.95) 0%, rgba(8, 8, 14, 0.95) 100%)',
                                        borderColor: activeField ? FIELD_COLORS[activeField]?.border || 'var(--perfil-border)' : 'var(--perfil-border)',
                                        boxShadow: activeField ? `0 4px 20px ${FIELD_COLORS[activeField]?.color}22` : 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {/* Cabecera del visualizador */}
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span className="small fw-bold text-white d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.74rem' }}>
                                            <Sparkles size={13} style={{ color: activeField ? FIELD_COLORS[activeField]?.color : 'var(--perfil-acento)' }} />
                                            <span>Guía Visual Interactiva de Estructura</span>
                                        </span>
                                        {activeField ? (
                                            <span
                                                className="badge rounded-pill px-2 py-0.5 animate-fade-in"
                                                style={{
                                                    fontSize: '0.67rem',
                                                    fontWeight: 600,
                                                    background: FIELD_COLORS[activeField].bg,
                                                    color: FIELD_COLORS[activeField].color,
                                                    border: `1px solid ${FIELD_COLORS[activeField].border}`,
                                                }}
                                            >
                                                Modificando: {FIELD_COLORS[activeField].label}
                                            </span>
                                        ) : (
                                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                                Haz clic en cualquier campo para ver qué parte modifica
                                            </span>
                                        )}
                                    </div>

                                    {/* 1. DOMINIO DE EJEMPLO DE REFERENCIA */}
                                    <div className="mb-2.5">
                                        <div className="small mb-1 text-secondary" style={{ fontSize: '0.68rem' }}>
                                            Estructura de ejemplo:
                                        </div>
                                        <div
                                            className="p-2 rounded-2 border d-flex flex-wrap align-items-center gap-1 font-mono"
                                            style={{
                                                background: 'rgba(0, 0, 0, 0.55)',
                                                borderColor: 'rgba(255, 255, 255, 0.08)',
                                                fontSize: '0.78rem',
                                            }}
                                        >
                                            <span
                                                onClick={() => { setActiveField('domain'); domainInputRef.current?.focus() }}
                                                style={getExampleSegmentStyle('domain')}
                                                title="Dominio General: www.animigos.app (Clic para editar)"
                                            >
                                                www.animigos.app
                                            </span>
                                            <span
                                                onClick={() => setActiveField('sectionSeparator')}
                                                style={getExampleSegmentStyle('sectionSeparator')}
                                                title="Separador de secciones: /"
                                            >
                                                /
                                            </span>
                                            <span
                                                onClick={() => { setActiveField('intermediate'); intermediateInputRef.current?.focus() }}
                                                style={getExampleSegmentStyle('intermediate')}
                                                title="Término Intermedio: serie (Clic para editar)"
                                            >
                                                serie
                                            </span>
                                            <span
                                                onClick={() => setActiveField('sectionSeparator')}
                                                style={getExampleSegmentStyle('sectionSeparator')}
                                                title="Separador de secciones: /"
                                            >
                                                /
                                            </span>
                                            <span
                                                onClick={() => { setActiveField('name'); testAnimeInputRef.current?.focus() }}
                                                style={getExampleSegmentStyle('name')}
                                                title="Nombre del anime: sousou-no-frieren (Clic para editar)"
                                            >
                                                sousou-no-frieren
                                            </span>
                                            <span
                                                onClick={() => setActiveField('suffixSeparator')}
                                                style={getExampleSegmentStyle('suffixSeparator')}
                                                title="Separador de terminación: /"
                                            >
                                                /
                                            </span>
                                            <span
                                                onClick={() => { setActiveField('suffix'); suffixInputRef.current?.focus() }}
                                                style={getExampleSegmentStyle('suffix')}
                                                title="Terminación única: chapter-6 (Clic para editar)"
                                            >
                                                chapter-6
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. LINK DINÁMICO (RESULTADO FINAL EN TIEMPO REAL) */}
                                    <div>
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                                Tu enlace dinámico (resultado final en tiempo real):
                                            </span>
                                            <span className="small" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.65rem' }}>
                                                {livePreviewUrl !== '#' ? 'Enlace listo' : 'Esperando dominio'}
                                            </span>
                                        </div>
                                        <div
                                            className="d-flex align-items-center justify-content-between p-2 rounded-2 border font-mono"
                                            style={{
                                                background: 'rgba(0, 0, 0, 0.65)',
                                                borderColor: activeField ? FIELD_COLORS[activeField]?.border || 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.1)',
                                                fontSize: '0.78rem',
                                                transition: 'border-color 0.2s ease',
                                            }}
                                        >
                                            <div className="text-truncate me-2 d-flex flex-wrap align-items-center gap-0.5">
                                                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>https://</span>

                                                {/* Dominio Dinámico */}
                                                <span
                                                    onClick={() => { setActiveField('domain'); domainInputRef.current?.focus() }}
                                                    style={getDynamicSegmentStyle('domain', !!domainClean)}
                                                    title="Dominio actual"
                                                >
                                                    {domainClean || 'animigos.app'}
                                                </span>

                                                {/* Separador 1 */}
                                                {(rawInter || activeField === 'intermediate' || animeSlug) && sectionChar && (
                                                    <span
                                                        onClick={() => setActiveField('sectionSeparator')}
                                                        style={getDynamicSegmentStyle('sectionSeparator', true)}
                                                    >
                                                        {sectionChar}
                                                    </span>
                                                )}

                                                {/* Intermedio Dinámico */}
                                                {(rawInter || activeField === 'intermediate') && (
                                                    <span
                                                        onClick={() => { setActiveField('intermediate'); intermediateInputRef.current?.focus() }}
                                                        style={getDynamicSegmentStyle('intermediate', !!rawInter)}
                                                        title="Término intermedio actual"
                                                    >
                                                        {rawInter || '<intermedio>'}
                                                    </span>
                                                )}

                                                {/* Separador 2 (si hay intermedio y anime) */}
                                                {rawInter && animeSlug && sectionChar && (
                                                    <span
                                                        onClick={() => setActiveField('sectionSeparator')}
                                                        style={getDynamicSegmentStyle('sectionSeparator', true)}
                                                    >
                                                        {sectionChar}
                                                    </span>
                                                )}

                                                {/* Anime Dinámico */}
                                                <span
                                                    onClick={() => { setActiveField('name'); testAnimeInputRef.current?.focus() }}
                                                    style={getDynamicSegmentStyle('name', !!animeSlug)}
                                                    title="Nombre del anime formateado"
                                                >
                                                    {animeSlug}
                                                </span>

                                                {/* Separador de Terminación */}
                                                {(rawSuffix || activeField === 'suffix') && suffixChar && (
                                                    <span
                                                        onClick={() => setActiveField('suffixSeparator')}
                                                        style={getDynamicSegmentStyle('suffixSeparator', true)}
                                                    >
                                                        {suffixChar}
                                                    </span>
                                                )}

                                                {/* Terminación Dinámica */}
                                                {(rawSuffix || activeField === 'suffix') && (
                                                    <span
                                                        onClick={() => { setActiveField('suffix'); suffixInputRef.current?.focus() }}
                                                        style={getDynamicSegmentStyle('suffix', !!rawSuffix)}
                                                        title="Terminación actual"
                                                    >
                                                        {rawSuffix || '<terminación>'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Botón Probar */}
                                            <button
                                                type="button"
                                                disabled={livePreviewUrl === '#'}
                                                onClick={() => livePreviewUrl !== '#' && window.open(livePreviewUrl, '_blank', 'noopener,noreferrer')}
                                                className="btn btn-sm d-inline-flex align-items-center gap-1 flex-shrink-0"
                                                style={{
                                                    background: livePreviewUrl !== '#' ? 'var(--perfil-acento)' : 'rgba(255, 255, 255, 0.08)',
                                                    color: livePreviewUrl !== '#' ? '#080808' : 'rgba(255, 255, 255, 0.25)',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    borderRadius: 6,
                                                    padding: '0.22rem 0.6rem',
                                                }}
                                                title="Abrir enlace de prueba en una nueva pestaña"
                                            >
                                                <span>Probar</span>
                                                <ExternalLink size={11} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* 1. Dominio General */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                <Globe size={14} style={{ color: activeField === 'domain' ? FIELD_COLORS.domain.color : 'var(--perfil-acento)' }} />
                                <span>1. Dominio General</span>
                            </label>
                            <div className="position-relative">
                                <input
                                    ref={domainInputRef}
                                    type="text"
                                    className="form-control form-control-sm text-white transition-all"
                                    style={{
                                        background: 'var(--perfil-card-2)',
                                        borderColor: activeField === 'domain' ? FIELD_COLORS.domain.border : 'var(--perfil-border)',
                                        boxShadow: activeField === 'domain' ? `0 0 10px ${FIELD_COLORS.domain.color}33` : 'none',
                                        fontSize: '0.82rem',
                                        paddingLeft: '2.1rem',
                                    }}
                                    placeholder="ej: www.animigos.app, tudominio.com..."
                                    value={linksConfig.domain}
                                    onFocus={() => setActiveField('domain')}
                                    onClick={() => setActiveField('domain')}
                                    onBlur={() => setActiveField(null)}
                                    onChange={(e) => setLinksConfig({ ...linksConfig, domain: e.target.value })}
                                />
                                <Globe
                                    size={14}
                                    className="position-absolute transition-all"
                                    style={{
                                        left: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: activeField === 'domain' ? FIELD_COLORS.domain.color : 'var(--perfil-text-dim)',
                                    }}
                                />
                            </div>
                            <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.7rem' }}>
                                Servidor o dirección base del sitio web (ej: www.animigos.app).
                            </div>
                        </div>

                        {/* 2. Término Intermedio y Separador de Secciones */}
                        <div className="row g-2">
                            <div className="col-7">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span
                                        className="ml-eyebrow mb-0"
                                        style={{
                                            fontSize: '0.7rem',
                                            color: activeField === 'intermediate' ? FIELD_COLORS.intermediate.color : undefined,
                                        }}
                                    >
                                        2. TÉRMINO INTERMEDIO (OPCIONAL)
                                    </span>
                                </label>
                                <input
                                    ref={intermediateInputRef}
                                    type="text"
                                    className="form-control form-control-sm text-white transition-all"
                                    style={{
                                        background: 'var(--perfil-card-2)',
                                        borderColor: activeField === 'intermediate' ? FIELD_COLORS.intermediate.border : 'var(--perfil-border)',
                                        boxShadow: activeField === 'intermediate' ? `0 0 10px ${FIELD_COLORS.intermediate.color}33` : 'none',
                                        fontSize: '0.82rem',
                                    }}
                                    placeholder="ej: serie, anime, ver (o vacío)"
                                    value={linksConfig.intermediateTerm || ''}
                                    onFocus={() => setActiveField('intermediate')}
                                    onClick={() => setActiveField('intermediate')}
                                    onBlur={() => setActiveField(null)}
                                    onChange={(e) => setLinksConfig({ ...linksConfig, intermediateTerm: e.target.value })}
                                />
                                <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.7rem' }}>
                                    Ruta o categoría intermedia antes del nombre.
                                </div>
                            </div>

                            <div className="col-5">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span
                                        className="ml-eyebrow mb-0"
                                        style={{
                                            fontSize: '0.7rem',
                                            color: activeField === 'sectionSeparator' ? FIELD_COLORS.sectionSeparator.color : undefined,
                                        }}
                                    >
                                        SEPARADOR DE SECCIONES
                                    </span>
                                </label>
                                <div className="d-flex gap-1.5">
                                    {[
                                        { id: 'barra' as SectionSeparator, label: 'Barra (/)', short: '/' },
                                        { id: 'guion' as SectionSeparator, label: 'Guión (-)', short: '-' },
                                        { id: 'ninguna' as SectionSeparator, label: 'Ninguna', short: 'Ø' },
                                    ].map((opt) => {
                                        const isSelected = (linksConfig.sectionSeparator || 'barra') === opt.id
                                        const isFieldActive = activeField === 'sectionSeparator'
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onMouseEnter={() => setActiveField('sectionSeparator')}
                                                onClick={() => {
                                                    setActiveField('sectionSeparator')
                                                    setLinksConfig({ ...linksConfig, sectionSeparator: opt.id })
                                                }}
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
                                                        : isFieldActive
                                                        ? FIELD_COLORS.sectionSeparator.border
                                                        : 'var(--perfil-border)',
                                                    boxShadow: isFieldActive && isSelected ? `0 0 8px ${FIELD_COLORS.sectionSeparator.color}44` : 'none',
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
                                <span
                                    className="ml-eyebrow mb-0"
                                    style={{
                                        fontSize: '0.7rem',
                                        color: activeField === 'name' ? FIELD_COLORS.name.color : undefined,
                                    }}
                                >
                                    3. SEPARACIÓN DE NOMBRE DEL ANIME
                                </span>
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
                                    const isFieldActive = activeField === 'name'
                                    return (
                                        <div key={opt.id} className="col-6">
                                            <button
                                                type="button"
                                                onMouseEnter={() => setActiveField('name')}
                                                onClick={() => {
                                                    setActiveField('name')
                                                    setLinksConfig({ ...linksConfig, nameSeparator: opt.id })
                                                }}
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
                                                        : isFieldActive
                                                        ? FIELD_COLORS.name.border
                                                        : 'var(--perfil-border)',
                                                    boxShadow: isFieldActive && isSelected ? `0 0 8px ${FIELD_COLORS.name.color}44` : 'none',
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
                                    <span
                                        className="ml-eyebrow mb-0"
                                        style={{
                                            fontSize: '0.7rem',
                                            color: activeField === 'suffix' ? FIELD_COLORS.suffix.color : undefined,
                                        }}
                                    >
                                        4. TERMINACIÓN ÚNICA DEL SITIO (OPCIONAL)
                                    </span>
                                </label>
                                <input
                                    ref={suffixInputRef}
                                    type="text"
                                    className="form-control form-control-sm text-white transition-all"
                                    style={{
                                        background: 'var(--perfil-card-2)',
                                        borderColor: activeField === 'suffix' ? FIELD_COLORS.suffix.border : 'var(--perfil-border)',
                                        boxShadow: activeField === 'suffix' ? `0 0 10px ${FIELD_COLORS.suffix.color}33` : 'none',
                                        fontSize: '0.82rem',
                                    }}
                                    placeholder="ej: chapter-6, sub-espanol, hd (o vacío)"
                                    value={linksConfig.suffix || ''}
                                    onFocus={() => setActiveField('suffix')}
                                    onClick={() => setActiveField('suffix')}
                                    onBlur={() => setActiveField(null)}
                                    onChange={(e) => setLinksConfig({ ...linksConfig, suffix: e.target.value })}
                                />
                                <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.68rem' }}>
                                    Sufijo final. Si prefieres que la terminación sea el capítulo, puedes escribirlo aquí.
                                </div>
                            </div>

                            <div className="col-5">
                                <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                    <span
                                        className="ml-eyebrow mb-0"
                                        style={{
                                            fontSize: '0.7rem',
                                            color: activeField === 'suffixSeparator' ? FIELD_COLORS.suffixSeparator.color : undefined,
                                        }}
                                    >
                                        SEPARADOR DE TERMINACIÓN
                                    </span>
                                </label>
                                <div className="d-flex gap-1">
                                    {[
                                        { id: 'guion' as SuffixSeparator, label: 'Guión (-)', short: '-' },
                                        { id: 'barra' as SuffixSeparator, label: 'Barra (/)', short: '/' },
                                        { id: 'punto' as SuffixSeparator, label: 'Punto (.)', short: '.' },
                                        { id: 'ninguna' as SuffixSeparator, label: 'Ninguno', short: 'Ø' },
                                    ].map((opt) => {
                                        const isSelected = (linksConfig.suffixSeparator || 'guion') === opt.id
                                        const isFieldActive = activeField === 'suffixSeparator'
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onMouseEnter={() => setActiveField('suffixSeparator')}
                                                onClick={() => {
                                                    setActiveField('suffixSeparator')
                                                    setLinksConfig({ ...linksConfig, suffixSeparator: opt.id })
                                                }}
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
                                                        : isFieldActive
                                                        ? FIELD_COLORS.suffixSeparator.border
                                                        : 'var(--perfil-border)',
                                                    boxShadow: isFieldActive && isSelected ? `0 0 8px ${FIELD_COLORS.suffixSeparator.color}44` : 'none',
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

                        {/* 5. Personalización de Anime de Prueba */}
                        <div>
                            <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-1.5">
                                <span
                                    className="ml-eyebrow mb-0"
                                    style={{
                                        fontSize: '0.7rem',
                                        color: activeField === 'name' ? FIELD_COLORS.name.color : undefined,
                                    }}
                                >
                                    5. ANIME DE PRUEBA PARA SIMULACIÓN
                                </span>
                            </label>
                            <input
                                ref={testAnimeInputRef}
                                type="text"
                                className="form-control form-control-sm text-white transition-all"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    borderColor: activeField === 'name' ? FIELD_COLORS.name.border : 'var(--perfil-border)',
                                    boxShadow: activeField === 'name' ? `0 0 10px ${FIELD_COLORS.name.color}33` : 'none',
                                    fontSize: '0.78rem',
                                }}
                                value={testAnime}
                                onFocus={() => setActiveField('name')}
                                onClick={() => setActiveField('name')}
                                onBlur={() => setActiveField(null)}
                                onChange={(e) => setTestAnime(e.target.value)}
                                placeholder="ej: Sousou no Frieren, Naruto, One Piece..."
                            />
                            <div className="small mt-1" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.68rem' }}>
                                Título del anime utilizado en el visor dinámico en tiempo real arriba.
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
