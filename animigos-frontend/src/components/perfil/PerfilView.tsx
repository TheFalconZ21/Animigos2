import React, { useState, useEffect, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { updateUserProfile } from '../../services/authApi'
import { LateralesAnime } from '../mi-lista/LateralesAnime'
import { ProfileHeader } from './ProfileHeader'
import { TasteTestBanner } from './TasteTestBanner'
import { TasteTestModal } from './TasteTestModal'
import { AnimeStatsDashboard } from './AnimeStatsDashboard'
import { CommentsWall } from './CommentsWall'
import { EditProfileModal } from './EditProfileModal'
import { PrivacySettingsModal } from './PrivacySettingsModal'
import type { SocialLinks, PrivacyConfig, TasteTestAnswers } from './perfil-types'
import '../mi-lista/mi-lista.css'
import './perfil.css'

const STORAGE_PROFILE_KEY = 'animigos_user_custom_profile'
const STORAGE_PRIVACY_KEY = 'animigos_user_privacy_config'
const STORAGE_TASTE_KEY = 'animigos_user_taste_test'

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

    // 2. Configuración de Privacidad
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

    // 3. Test de Gustos (Recomendador IA)
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
            calibratedPercentage: 85,
        }
    })

    // Sincronizar si cambia el usuario de la sesión
    useEffect(() => {
        if (user) {
            if (user.display_name) setDisplayName(user.display_name)
            if (user.avatar_url) setAvatarUrl(user.avatar_url)
            if (user.bio) setBio(user.bio)
        }
    }, [user])

    // Modales
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
    const [tasteModalOpen, setTasteModalOpen] = useState(false)

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

        // Persistencia local inmediata
        localStorage.setItem(
            STORAGE_PROFILE_KEY,
            JSON.stringify({
                displayName: data.displayName,
                bio: data.bio,
                avatarUrl: data.avatarUrl,
                socials: data.socials,
            })
        )

        // Si está autenticado, sincronizar con Django BFF
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

    // Guardar Privacidad
    const handleSavePrivacy = async (newConfig: PrivacyConfig) => {
        setPrivacy(newConfig)
        localStorage.setItem(STORAGE_PRIVACY_KEY, JSON.stringify(newConfig))

        // Si está autenticado, enviar a preferences
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

        // Sincronizar con backend si está autenticado
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
            <LateralesAnime />

            <div className="container" style={{ maxWidth: '1240px' }}>
                {/* 1. Cabecera de Perfil */}
                <ProfileHeader
                    displayName={displayName}
                    username={user?.username || 'otaku_master'}
                    avatarUrl={avatarUrl}
                    bio={bio}
                    memberSince={user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : 'Enero 2024'}
                    socials={socials}
                    privacy={privacy}
                    onOpenEditModal={() => setEditModalOpen(true)}
                    onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
                    onChangeAvatarClick={() => setEditModalOpen(true)}
                    isCurrentUser={true}
                />

                {/* 2. Tarjeta Destacada: Test de Gustos (Recomendador IA) */}
                <TasteTestBanner
                    answers={tasteAnswers}
                    onOpenWizard={() => setTasteModalOpen(true)}
                />

                {/* 3. Dashboard de Estadísticas de Anime */}
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

                {/* 4. Muro de Comentarios y Actividad Social */}
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
