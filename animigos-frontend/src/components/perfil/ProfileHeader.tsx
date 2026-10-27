import React from 'react'
import {
    Camera,
    Pencil,
    Settings,
    Calendar,
    Sparkles,
    Check,
} from 'lucide-react'
import type { SocialLinks, PrivacyConfig } from './perfil-types'

interface ProfileHeaderProps {
    displayName: string
    username: string
    avatarUrl: string
    flagUrl: string
    bio: string
    memberSince: string
    socials: SocialLinks
    privacy: PrivacyConfig
    onOpenConfigModal: () => void
    onChangeAvatarClick: () => void
    onOpenFlagModal: () => void
    isVisualEditOpen: boolean
    onToggleVisualEdit: () => void
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
    onOpenConfigModal,
    onChangeAvatarClick,
    onOpenFlagModal,
    isVisualEditOpen,
    onToggleVisualEdit,
    isCurrentUser = true,
}) => {
    return (
        <div className="perfil-header-card">
            {/* Banner superior con imagen tipo Flag */}
            <div className="perfil-banner-bg position-relative">
                <img
                    src={flagUrl}
                    alt="Flag del Perfil"
                    className="perfil-banner-flag-img"
                    onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200'
                    }}
                />
                <div className="perfil-banner-overlay" />

                {/* Refuerzo visual de edición tipo área precortada sobre el banner flag */}
                {isCurrentUser && isVisualEditOpen && (
                    <div
                        onClick={onOpenFlagModal}
                        className="perfil-crop-target-flag animate-fade-in"
                        role="button"
                        tabIndex={0}
                        title="Haz clic para subir un archivo o elegir una imagen de la biblioteca para el banner flag"
                    >
                        <div className="perfil-crop-corner perfil-crop-tl" />
                        <div className="perfil-crop-corner perfil-crop-tr" />
                        <div className="perfil-crop-corner perfil-crop-bl" />
                        <div className="perfil-crop-corner perfil-crop-br" />

                        <Camera size={26} style={{ color: 'var(--perfil-acento)' }} />
                        <div className="text-center">
                            <div className="fw-bold text-white small">Banner Flag del Perfil</div>
                            <div className="text-secondary small mt-0.5" style={{ fontSize: '0.74rem' }}>
                                Haz clic aquí para subir un archivo nuevo o elegir de la biblioteca
                            </div>
                        </div>
                        <span
                            className="badge rounded-pill px-3 py-1 text-dark"
                            style={{ background: 'var(--perfil-acento)', fontWeight: 700, fontSize: '0.72rem' }}
                        >
                            Subir o Elegir Imagen
                        </span>
                    </div>
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
                    {/* Identidad: Avatar circular */}
                    <div className="d-flex flex-column flex-sm-row align-items-sm-end gap-3.5">
                        <div className="perfil-avatar-wrapper position-relative">
                            <img
                                src={avatarUrl}
                                alt={displayName}
                                className="perfil-avatar-img"
                                onError={(e) => {
                                    e.currentTarget.src =
                                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                }}
                            />

                            {/* Refuerzo visual precortado para la foto de perfil en modo edición */}
                            {isCurrentUser && isVisualEditOpen && (
                                <div
                                    onClick={onChangeAvatarClick}
                                    className="perfil-crop-target-avatar animate-fade-in"
                                    role="button"
                                    tabIndex={0}
                                    title="Haz clic para modificar la foto de perfil (subir archivo o elegir del catálogo)"
                                >
                                    <Camera size={22} style={{ color: 'var(--perfil-acento)' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ffffff', textAlign: 'center', lineHeight: 1.1 }}>
                                        Cambiar<br />Avatar
                                    </span>
                                    <span className="small text-secondary" style={{ fontSize: '0.64rem' }}>
                                        Subir / Elegir
                                    </span>
                                </div>
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

                    {/* Botones de Acción en Cabecera: Únicamente Editar (lápiz) y Configuración */}
                    {isCurrentUser && (
                        <div className="d-flex flex-wrap align-items-center gap-2 pt-2 pt-md-0">
                            {/* Icono con un lápiz: Habilita/Deshabilita la modificación visual (refuerzo de área precortada) */}
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
                                {isVisualEditOpen ? <Check size={14} /> : <Pencil size={14} />}
                                <span>{isVisualEditOpen ? 'Finalizar Edición' : 'Editar'}</span>
                            </button>

                            {/* Botón Configuración: Abre el modal con Paleta de Colores, Perfil y Privacidad */}
                            <button
                                type="button"
                                onClick={onOpenConfigModal}
                                className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1.5 border"
                                style={{ borderColor: 'var(--perfil-border)', background: 'var(--perfil-card-2)' }}
                                title="Configuración de Cuenta, Paleta y Privacidad"
                            >
                                <Settings size={14} />
                                <span>Configuración</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

