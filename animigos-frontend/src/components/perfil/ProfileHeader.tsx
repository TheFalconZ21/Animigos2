import React from 'react'
import {
    Camera,
    Pencil,
    Shield,
    Settings,
    Calendar,
    Sparkles,
    Flag,
    Image as ImageIcon,
    Palette,
    X,
} from 'lucide-react'
import type { SocialLinks, PrivacyConfig } from './perfil-types'
import { OPCIONES_ACENTO } from '../../hooks/useThemeAccent'

interface ProfileHeaderProps {
    displayName: string
    username: string
    avatarUrl: string
    flagUrl: string
    bio: string
    memberSince: string
    socials: SocialLinks
    privacy: PrivacyConfig
    onOpenEditModal: () => void
    onOpenPrivacyModal: () => void
    onChangeAvatarClick: () => void
    onOpenFlagModal: () => void
    onOpenLateralModal: () => void
    isVisualEditOpen: boolean
    onToggleVisualEdit: () => void
    acentoModo: string
    onChangeAcentoModo: (nuevo: string) => void
    isCurrentUser?: boolean
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    displayName,
    username,
    avatarUrl,
    flagUrl,
    bio,
    memberSince,
    socials,
    privacy,
    onOpenEditModal,
    onOpenPrivacyModal,
    onChangeAvatarClick,
    onOpenFlagModal,
    onOpenLateralModal,
    isVisualEditOpen,
    onToggleVisualEdit,
    acentoModo,
    onChangeAcentoModo,
    isCurrentUser = true,
}) => {
    return (
        <div className="perfil-header-card">
            {/* Banner superior con imagen tipo Flag */}
            <div className="perfil-banner-bg">
                <img
                    src={flagUrl}
                    alt="Flag del Perfil"
                    className="perfil-banner-flag-img"
                    onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200'
                    }}
                />
                <div className="perfil-banner-overlay" />

                {/* Modificación de Flag: habilitada únicamente cuando el modo lápiz está activo */}
                {isCurrentUser && isVisualEditOpen && (
                    <button
                        type="button"
                        onClick={onOpenFlagModal}
                        className="perfil-flag-btn animate-fade-in"
                        title="Modificar imagen flag del perfil"
                    >
                        <Pencil size={13} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Modificar Flag</span>
                    </button>
                )}

                <div className="position-absolute bottom-0 end-0 p-3 d-flex align-items-center gap-2">
                    <span className="ml-lomo d-none d-md-flex" lang="ja" aria-hidden="true" style={{ height: 110 }}>
                        プロフィール
                    </span>
                </div>
            </div>

            {/* Cuerpo de la cabecera */}
            <div className="perfil-header-body">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
                    {/* Identidad: Avatar circular con botón flotante */}
                    <div className="d-flex flex-column flex-sm-row align-items-sm-end gap-3.5">
                        <div className="perfil-avatar-wrapper">
                            <img
                                src={avatarUrl}
                                alt={displayName}
                                className="perfil-avatar-img"
                                onError={(e) => {
                                    e.currentTarget.src =
                                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                }}
                            />
                            {/* Modificación de Foto de Perfil: habilitada únicamente cuando el modo lápiz está activo */}
                            {isCurrentUser && isVisualEditOpen && (
                                <button
                                    type="button"
                                    onClick={onChangeAvatarClick}
                                    className="perfil-avatar-btn animate-fade-in"
                                    title="Modificar foto de perfil"
                                    aria-label="Modificar foto de perfil"
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                        </div>

                        {/* Nombre, handle y badges */}
                        <div className="pt-2">
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                <h1 className="h4 fw-bold text-white mb-0">{displayName}</h1>
                                <span className="perfil-badge-status">
                                    <Sparkles size={12} />
                                    <span>Otaku Veterano 🍿</span>
                                </span>
                            </div>

                            <div className="d-flex flex-wrap align-items-center gap-2 text-secondary small mb-2">
                                <span className="fw-semibold font-mono" style={{ color: 'var(--perfil-text-muted)' }}>
                                    @{username}
                                </span>
                                <span>·</span>
                                <span className="d-inline-flex align-items-center gap-1">
                                    <Calendar size={13} /> Miembro desde {memberSince}
                                </span>
                                {!privacy.isListPublic && (
                                    <>
                                        <span>·</span>
                                        <span className="badge rounded-pill bg-dark border border-secondary text-secondary py-0.5 px-2" style={{ fontSize: '0.68rem' }}>
                                            🔒 Perfil Privado
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Biografía */}
                            <p className="small text-white mb-2" style={{ maxWidth: 640, lineHeight: 1.5 }}>
                                {bio}
                            </p>

                            {/* Redes sociales vinculadas */}
                            <div className="d-flex align-items-center gap-2 pt-1">
                                {socials.mal && (
                                    <a
                                        href={`https://myanimelist.net/profile/${socials.mal}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="perfil-social-link"
                                        title={`MyAnimeList: ${socials.mal}`}
                                    >
                                        MAL
                                    </a>
                                )}
                                {socials.anilist && (
                                    <a
                                        href={`https://anilist.co/user/${socials.anilist}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="perfil-social-link"
                                        title={`AniList: ${socials.anilist}`}
                                    >
                                        AL
                                    </a>
                                )}
                                {socials.discord && (
                                    <span className="perfil-social-link" title={`Discord: ${socials.discord}`}>
                                        DC
                                    </span>
                                )}
                                {socials.twitter && (
                                    <a
                                        href={`https://twitter.com/${socials.twitter.replace(/^@/, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="perfil-social-link"
                                        title={`Twitter / X: ${socials.twitter}`}
                                    >
                                        𝕏
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Botones de Acción y Configuración de Usuario */}
                    {isCurrentUser && (
                        <div className="d-flex flex-wrap align-items-center gap-2 pt-2 pt-md-0">
                            {/* Selector de color / acento de la plataforma */}
                            <div
                                className="d-flex align-items-center gap-1.5 px-2 py-1 rounded-3"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    border: '1px solid var(--perfil-border)',
                                }}
                                title="Selector de color de la plataforma"
                            >
                                <Palette size={14} style={{ color: 'var(--perfil-acento)' }} />
                                <select
                                    className="ml-select border-0 p-0 text-white"
                                    value={acentoModo}
                                    onChange={(e) => onChangeAcentoModo(e.target.value)}
                                    aria-label="Color de acento de la plataforma"
                                    style={{
                                        fontSize: '0.8rem',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        outline: 'none',
                                    }}
                                >
                                    {OPCIONES_ACENTO.map((a) => (
                                        <option
                                            key={a.id}
                                            value={a.id}
                                            style={{ background: '#18181f', color: '#ffffff' }}
                                        >
                                            Acento: {a.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Icono con un lápiz: Habilita la modificación de foto de perfil, imagen flag e imagen de los laterales */}
                            <button
                                type="button"
                                onClick={onToggleVisualEdit}
                                className={`ml-btn ml-btn-sm d-inline-flex align-items-center gap-1.5 ${
                                    isVisualEditOpen ? 'ml-btn-acento shadow' : 'ml-btn-fantasma border'
                                }`}
                                style={
                                    !isVisualEditOpen
                                        ? { borderColor: 'var(--perfil-border)', background: 'var(--perfil-card-2)' }
                                        : undefined
                                }
                                title={
                                    isVisualEditOpen
                                        ? 'Finalizar personalización visual'
                                        : 'Habilitar modificación de foto de perfil, imagen flag e imagen de los laterales'
                                }
                            >
                                <Pencil size={14} />
                                <span>{isVisualEditOpen ? 'Modo Edición Activo' : 'Personalizar Visuales'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenEditModal}
                                className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1.5 border"
                                style={{ borderColor: 'var(--perfil-border)', background: 'var(--perfil-card-2)' }}
                            >
                                <Settings size={14} />
                                <span>Editar Perfil</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenPrivacyModal}
                                className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1.5 border"
                                style={{ borderColor: 'var(--perfil-border)', background: 'var(--perfil-card-2)' }}
                                title="Configuración de Privacidad"
                            >
                                <Shield size={14} />
                                <span>Privacidad</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Barra interactiva de modificación visual (desplegada al activar el icono con lápiz) */}
                {isCurrentUser && isVisualEditOpen && (
                    <div
                        className="perfil-visual-toolbar d-flex flex-wrap align-items-center justify-content-between gap-2 p-2.5 px-3 rounded-3 mt-3 border animate-fade-in"
                        style={{
                            background: 'rgba(24, 24, 31, 0.95)',
                            backdropFilter: 'blur(10px)',
                            borderColor: 'var(--perfil-acento)',
                            boxShadow: '0 4px 20px color-mix(in srgb, var(--perfil-acento) 22%, transparent)',
                        }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <Pencil size={15} style={{ color: 'var(--perfil-acento)' }} />
                            <span className="small fw-semibold text-white">
                                Modificación visual habilitada: Selecciona qué deseas cambiar
                            </span>
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <button
                                type="button"
                                onClick={onChangeAvatarClick}
                                className="ml-btn ml-btn-sm d-inline-flex align-items-center gap-1.5"
                                style={{ background: 'var(--perfil-card)', fontSize: '0.78rem' }}
                                title="Modificar foto de perfil"
                            >
                                <Camera size={13} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Foto de Perfil</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenFlagModal}
                                className="ml-btn ml-btn-sm d-inline-flex align-items-center gap-1.5"
                                style={{ background: 'var(--perfil-card)', fontSize: '0.78rem' }}
                                title="Modificar imagen flag del perfil"
                            >
                                <Flag size={13} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Imagen Flag</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenLateralModal}
                                className="ml-btn ml-btn-sm d-inline-flex align-items-center gap-1.5"
                                style={{ background: 'var(--perfil-card)', fontSize: '0.78rem' }}
                                title="Modificar fondos laterales (GIF o imagen)"
                            >
                                <ImageIcon size={13} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Imagen Laterales</span>
                            </button>

                            <button
                                type="button"
                                onClick={onToggleVisualEdit}
                                className="ml-btn ml-btn-fantasma ml-btn-sm py-1 px-2 text-secondary"
                                title="Cerrar barra de modificación visual"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
