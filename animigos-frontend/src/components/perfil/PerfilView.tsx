import React, { useState, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { updateUserProfile } from '../../services/authApi'
import { ProfileHeader } from './ProfileHeader'
import { FlagPickerModal, FLAG_PRESETS } from './FlagPickerModal'
import { LateralCustomWallpaper } from './LateralCustomWallpaper'
import { TasteTestBanner } from './TasteTestBanner'
import { TasteTestModal } from './TasteTestModal'
import { AnimeStatsDashboard } from './AnimeStatsDashboard'
import { CommentsWall } from './CommentsWall'
import { EditProfileModal } from './EditProfileModal'
import { PrivacySettingsModal } from './PrivacySettingsModal'
import { AvatarPickerModal } from './AvatarPickerModal'
import type {
    SocialLinks,
    PrivacyConfig,
    TasteTestAnswers,
    LateralWallpaperConfig,
} from './perfil-types'
import '../mi-lista/mi-lista.css'
import './perfil.css'

const STORAGE_PROFILE_KEY = 'animigos_user_custom_profile'
const STORAGE_PRIVACY_KEY = 'animigos_user_privacy_config'
const STORAGE_TASTE_KEY = 'animigos_user_taste_test'
const STORAGE_FLAG_KEY = 'animigos_user_flag_banner'
const STORAGE_LATERAL_KEY = 'animigos_user_lateral_wallpaper'

export const PerfilView: React.FC = () => {
    const { acento } = useThemeAccent()
    const { user, refreshUser } = useAuth()
    const { filas, actualizar } = useMyList()

    // 1. Datos de perfil reactivos
    const [displayName, setDisplayName] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_PROFILE_KEY)
            if (saved) return JSON.parse(saved).displayName
        } catch {}
        return user?.display_name || user?.username || 'Otaku Legendario'
    })

    const [bio, setBio] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_PROFILE_KEY)
            if (saved) return JSON.parse(saved).bio
        } catch {}
        return user?.bio || 'Coordinando las mejores watch parties de la temporada con mis amigos en Animigos 🍿'
    })

    const [avatarUrl, setAvatarUrl] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_PROFILE_KEY)
            if (saved) return JSON.parse(saved).avatarUrl
        } catch {}
        return (
            user?.avatar_url ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
        )
    })

    const [socials, setSocials] = useState<SocialLinks>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_PROFILE_KEY)
            if (saved && JSON.parse(saved).socials) return JSON.parse(saved).socials
        } catch {}
        return {
            mal: 'AnimigoMaster',
            anilist: 'animigo_fan',
            discord: '#otaku77',
            twitter: '@animigos_app',
        }
    })

    // 2. Imagen tipo Flag de la card superior
    const [flagUrl, setFlagUrl] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_FLAG_KEY)
            if (saved) return saved
        } catch {}
        return FLAG_PRESETS[0].url
    })

    // 3. Fondo Lateral Personalizado (GIF o Imagen)
    const [lateralConfig, setLateralConfig] = useState<LateralWallpaperConfig>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_LATERAL_KEY)
            if (saved) return JSON.parse(saved)
        } catch {}
        return {
            imageUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
            opacity: 45,
            enabled: true,
        }
    })

    // 4. Configuración de Privacidad
    const [privacy, setPrivacy] = useState<PrivacyConfig>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_PRIVACY_KEY)
            if (saved) return JSON.parse(saved)
        } catch {}
        return {
            isListPublic: true,
            showStats: true,
            allowComments: 'everyone',
        }
    })

    // 5. Test de Gustos (Recomendador IA con TMDB)
    const [tasteAnswers, setTasteAnswers] = useState<TasteTestAnswers>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_TASTE_KEY)
            if (saved) return JSON.parse(saved)
        } catch {}
        return {
            tropes: ['mastermind', 'dark_fantasy', 'power_scaling'],
            favoriteGenres: ['Psychological', 'Action', 'Sci-Fi'],
            dislikedGenres: ['Horror'],
            pacing: 'fast_12',
            contentFilters: ['no_fanservice', 'conclusive_ending'],
            favoriteMovies: [
                {
                    id: 27205,
                    title: 'El Origen (Inception)',
                    originalTitle: 'Inception',
                    releaseYear: '2010',
                    posterPath: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
                    genres: ['Ciencia ficción', 'Misterio', 'Acción'],
                    overview: 'Un ladrón que roba secretos corporativos mediante tecnología de compartir sueños.',
                },
                {
                    id: 335984,
                    title: 'Blade Runner 2049',
                    originalTitle: 'Blade Runner 2049',
                    releaseYear: '2017',
                    posterPath: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
                    genres: ['Ciencia ficción', 'Drama', 'Misterio'],
                    overview: 'Un blade runner descubre un secreto que podría sumergir a la sociedad en el caos.',
                },
            ],
            likedAnimeIds: [1535, 9253],
            calibratedPercentage: 90,
        }
    })

    // Modales
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [avatarModalOpen, setAvatarModalOpen] = useState(false)
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
    const [tasteModalOpen, setTasteModalOpen] = useState(false)
    const [flagModalOpen, setFlagModalOpen] = useState(false)

    // Seleccionar y guardar Avatar directamente
    const handleSelectAvatar = async (newUrl: string) => {
        setAvatarUrl(newUrl)
        try {
            const saved = localStorage.getItem(STORAGE_PROFILE_KEY)
            const parsed = saved ? JSON.parse(saved) : {}
            localStorage.setItem(
                STORAGE_PROFILE_KEY,
                JSON.stringify({ ...parsed, avatarUrl: newUrl })
            )
        } catch {}

        if (user) {
            try {
                await updateUserProfile({ avatar_url: newUrl })
                await refreshUser()
            } catch (e) {
                console.error('Error sincronizando avatar con el backend:', e)
            }
        }
    }

    // Guardar Perfil
    const handleSaveProfile = async (data: {
        displayName: string
        bio: string
        avatarUrl: string
        socials: SocialLinks
    }) => {
        setDisplayName(data.displayName)
        setBio(data.bio)
        setAvatarUrl(data.avatarUrl)
        setSocials(data.socials)

        localStorage.setItem(
            STORAGE_PROFILE_KEY,
            JSON.stringify({
                displayName: data.displayName,
                bio: data.bio,
                avatarUrl: data.avatarUrl,
                socials: data.socials,
            })
        )

        if (user) {
            try {
                await updateUserProfile({
                    display_name: data.displayName,
                    bio: data.bio,
                    avatar_url: data.avatarUrl,
                })
                await refreshUser()
            } catch (e) {
                console.error('Error sincronizando perfil con el backend:', e)
            }
        }
    }

    // Guardar Flag
    const handleSaveFlag = (newUrl: string) => {
        setFlagUrl(newUrl)
        localStorage.setItem(STORAGE_FLAG_KEY, newUrl)
    }

    // Guardar Configuración de Fondo Lateral
    const handleSaveLateralConfig = (newConfig: LateralWallpaperConfig) => {
        setLateralConfig(newConfig)
        localStorage.setItem(STORAGE_LATERAL_KEY, JSON.stringify(newConfig))
    }

    // Guardar Privacidad
    const handleSavePrivacy = async (newConfig: PrivacyConfig) => {
        setPrivacy(newConfig)
        localStorage.setItem(STORAGE_PRIVACY_KEY, JSON.stringify(newConfig))

        if (user) {
            try {
                const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
                await fetch(`${API_BASE_URL}/users/me/preferences/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        privacy_settings: newConfig,
                    }),
                })
            } catch (e) {
                console.error('Error guardando privacidad en backend:', e)
            }
        }
    }

    // Completar Test de Gustos IA
    const handleCompleteTasteTest = async (answers: TasteTestAnswers) => {
        setTasteAnswers(answers)
        localStorage.setItem(STORAGE_TASTE_KEY, JSON.stringify(answers))

        if (user) {
            try {
                const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
                await fetch(`${API_BASE_URL}/users/me/preferences/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        onboarding_completed: true,
                        favorite_genres: answers.favoriteGenres,
                        disliked_genres: answers.dislikedGenres,
                        preferred_duration: answers.pacing,
                    }),
                })
            } catch (e) {
                console.error('Error guardando preferencias en backend:', e)
            }
        }
    }

    return (
        <section
            className="ml-root perfil-root py-4 px-3 px-md-4"
            style={{ '--ml-acento': acento, '--perfil-acento': acento } as CSSProperties}
        >
            {/* 1. Fondo Lateral Personalizado (GIF o Imagen) que flanquea el contenido */}
            <LateralCustomWallpaper
                config={lateralConfig}
                onChangeConfig={handleSaveLateralConfig}
            />

            <div className="container position-relative z-1" style={{ maxWidth: '1240px' }}>
                {/* 2. Cabecera de Perfil con Imagen tipo Flag */}
                <ProfileHeader
                    displayName={displayName}
                    username={user?.username || 'otaku_master'}
                    avatarUrl={avatarUrl}
                    flagUrl={flagUrl}
                    bio={bio}
                    memberSince={
                        user?.created_at
                            ? new Date(user.created_at).toLocaleDateString('es-ES', {
                                  month: 'short',
                                  year: 'numeric',
                              })
                            : 'Enero 2024'
                    }
                    socials={socials}
                    privacy={privacy}
                    onOpenEditModal={() => setEditModalOpen(true)}
                    onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
                    onChangeAvatarClick={() => setAvatarModalOpen(true)}
                    onOpenFlagModal={() => setFlagModalOpen(true)}
                    isCurrentUser={true}
                />

                {/* 3. Tarjeta Destacada: Test de Gustos (Profesor Doki Doki) */}
                <TasteTestBanner
                    answers={tasteAnswers}
                    onOpenWizard={() => setTasteModalOpen(true)}
                />

                {/* 5. Dashboard de Estadísticas de Anime */}
                <AnimeStatsDashboard
                    filas={filas}
                    showStats={privacy.showStats}
                    onUpdateFila={(id, cambios) => {
                        const targetFila = filas.find((f) => f.id === id)
                        if (targetFila) {
                            actualizar(targetFila.malId, cambios)
                        }
                    }}
                />

                {/* 6. Muro de Comentarios y Actividad Social */}
                <CommentsWall
                    currentUser={{
                        id: user?.id || 'current_user',
                        name: displayName,
                        username: user?.username || 'otaku_master',
                        avatar: avatarUrl,
                    }}
                    allowComments={privacy.allowComments}
                />
            </div>

            {/* Modales Interactivos */}
            <EditProfileModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                initialName={displayName}
                initialBio={bio}
                initialAvatar={avatarUrl}
                initialSocials={socials}
                onSave={handleSaveProfile}
                onOpenAvatarPicker={() => setAvatarModalOpen(true)}
            />

            <AvatarPickerModal
                open={avatarModalOpen}
                onClose={() => setAvatarModalOpen(false)}
                currentAvatarUrl={avatarUrl}
                onSelectAvatar={handleSelectAvatar}
            />

            <FlagPickerModal
                open={flagModalOpen}
                onClose={() => setFlagModalOpen(false)}
                currentFlagUrl={flagUrl}
                onSaveFlag={handleSaveFlag}
            />

            <PrivacySettingsModal
                open={privacyModalOpen}
                onClose={() => setPrivacyModalOpen(false)}
                initialConfig={privacy}
                onSave={handleSavePrivacy}
            />

            <TasteTestModal
                open={tasteModalOpen}
                onClose={() => setTasteModalOpen(false)}
                initialAnswers={tasteAnswers}
                onComplete={handleCompleteTasteTest}
            />
        </section>
    )
}
