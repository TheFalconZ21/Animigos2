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

const getStorageProfileKey = (uid?: number | string) => `animigos_user_custom_profile_${uid ?? 'guest'}`
const getStoragePrivacyKey = (uid?: number | string) => `animigos_user_privacy_config_${uid ?? 'guest'}`
const getStorageTasteKey = (uid?: number | string) => `animigos_user_taste_test_${uid ?? 'guest'}`
const getStorageFlagKey = (uid?: number | string) => `animigos_user_flag_banner_${uid ?? 'guest'}`
const getStorageLateralKey = (uid?: number | string) => `animigos_user_lateral_wallpaper_${uid ?? 'guest'}`

export const PerfilView: React.FC = () => {
    const { acento } = useThemeAccent()
    const { user, refreshUser } = useAuth()
    const { filas, actualizar } = useMyList()

    // 1. Datos de perfil reactivos
    const [displayName, setDisplayName] = useState<string>(() => user?.display_name || user?.username || '')
    const [bio, setBio] = useState<string>(() => user?.bio || '')
    const [avatarUrl, setAvatarUrl] = useState<string>(() => user?.avatar_url || '')
    const [socials, setSocials] = useState<SocialLinks>({ mal: '', anilist: '', discord: '', twitter: '' })
    const [flagUrl, setFlagUrl] = useState<string>(FLAG_PRESETS[0]?.url || '')
    const [lateralConfig, setLateralConfig] = useState<LateralWallpaperConfig>({
        imageUrl: '',
        opacity: 45,
        enabled: false,
    })
    const [privacy, setPrivacy] = useState<PrivacyConfig>({
        isListPublic: true,
        showStats: true,
        allowComments: 'everyone',
    })
    const [tasteAnswers, setTasteAnswers] = useState<TasteTestAnswers>({
        tropes: [],
        favoriteGenres: [],
        dislikedGenres: [],
        pacing: '',
        contentFilters: [],
        favoriteMovies: [],
        likedAnimeIds: [],
        calibratedPercentage: 0,
    })

    // Sincronizar estado cuando el usuario cambia o se autentica
    React.useEffect(() => {
        const uid = user?.id ?? 'guest'
        // Cargar perfil custom si existe para este usuario
        try {
            const savedProfile = localStorage.getItem(getStorageProfileKey(uid))
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile)
                setDisplayName(parsed.displayName || user?.display_name || user?.username || '')
                setBio(typeof parsed.bio === 'string' ? parsed.bio : (user?.bio || ''))
                setAvatarUrl(parsed.avatarUrl || user?.avatar_url || '')
                setSocials(parsed.socials || { mal: '', anilist: '', discord: '', twitter: '' })
            } else {
                setDisplayName(user?.display_name || user?.username || '')
                setBio(user?.bio || '')
                setAvatarUrl(user?.avatar_url || '')
                setSocials({ mal: '', anilist: '', discord: '', twitter: '' })
            }
        } catch {
            setDisplayName(user?.display_name || user?.username || '')
            setBio(user?.bio || '')
            setAvatarUrl(user?.avatar_url || '')
            setSocials({ mal: '', anilist: '', discord: '', twitter: '' })
        }

        // Cargar Flag
        try {
            const savedFlag = localStorage.getItem(getStorageFlagKey(uid))
            setFlagUrl(savedFlag || FLAG_PRESETS[0]?.url || '')
        } catch {
            setFlagUrl(FLAG_PRESETS[0]?.url || '')
        }

        // Cargar Lateral
        try {
            const savedLat = localStorage.getItem(getStorageLateralKey(uid))
            setLateralConfig(savedLat ? JSON.parse(savedLat) : { imageUrl: '', opacity: 45, enabled: false })
        } catch {
            setLateralConfig({ imageUrl: '', opacity: 45, enabled: false })
        }

        // Cargar Privacidad
        try {
            const savedPriv = localStorage.getItem(getStoragePrivacyKey(uid))
            setPrivacy(savedPriv ? JSON.parse(savedPriv) : { isListPublic: true, showStats: true, allowComments: 'everyone' })
        } catch {
            setPrivacy({ isListPublic: true, showStats: true, allowComments: 'everyone' })
        }

        // Cargar Taste Test
        try {
            const savedTaste = localStorage.getItem(getStorageTasteKey(uid))
            setTasteAnswers(savedTaste ? JSON.parse(savedTaste) : {
                tropes: [],
                favoriteGenres: [],
                dislikedGenres: [],
                pacing: '',
                contentFilters: [],
                favoriteMovies: [],
                likedAnimeIds: [],
                calibratedPercentage: 0,
            })
        } catch {
            setTasteAnswers({
                tropes: [],
                favoriteGenres: [],
                dislikedGenres: [],
                pacing: '',
                contentFilters: [],
                favoriteMovies: [],
                likedAnimeIds: [],
                calibratedPercentage: 0,
            })
        }
    }, [user])

    // Modales
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [avatarModalOpen, setAvatarModalOpen] = useState(false)
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
    const [tasteModalOpen, setTasteModalOpen] = useState(false)
    const [flagModalOpen, setFlagModalOpen] = useState(false)

    // Seleccionar y guardar Avatar directamente
    const handleSelectAvatar = async (newUrl: string) => {
        setAvatarUrl(newUrl)
        const uid = user?.id ?? 'guest'
        try {
            const key = getStorageProfileKey(uid)
            const saved = localStorage.getItem(key)
            const parsed = saved ? JSON.parse(saved) : {}
            localStorage.setItem(key, JSON.stringify({ ...parsed, avatarUrl: newUrl }))
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

        const uid = user?.id ?? 'guest'
        localStorage.setItem(
            getStorageProfileKey(uid),
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
        const uid = user?.id ?? 'guest'
        localStorage.setItem(getStorageFlagKey(uid), newUrl)
    }

    // Guardar Configuración de Fondo Lateral
    const handleSaveLateralConfig = (newConfig: LateralWallpaperConfig) => {
        setLateralConfig(newConfig)
        const uid = user?.id ?? 'guest'
        localStorage.setItem(getStorageLateralKey(uid), JSON.stringify(newConfig))
    }

    // Guardar Privacidad
    const handleSavePrivacy = async (newConfig: PrivacyConfig) => {
        setPrivacy(newConfig)
        const uid = user?.id ?? 'guest'
        localStorage.setItem(getStoragePrivacyKey(uid), JSON.stringify(newConfig))

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
        const uid = user?.id ?? 'guest'
        localStorage.setItem(getStorageTasteKey(uid), JSON.stringify(answers))

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
                    username={user?.username || ''}
                    avatarUrl={avatarUrl}
                    flagUrl={flagUrl}
                    bio={bio}
                    memberSince={
                        user?.created_at
                            ? new Date(user.created_at).toLocaleDateString('es-ES', {
                                  month: 'long',
                                  year: 'numeric',
                              })
                            : 'Reciente'
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
                        id: String(user?.id || 'guest'),
                        name: displayName,
                        username: user?.username || '',
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
