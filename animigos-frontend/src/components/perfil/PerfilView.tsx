import React, { useState, type CSSProperties } from 'react'
import { Search, Send, Sparkles, Check, Loader2, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { updateUserProfile, getAuthHeaders } from '../../services/authApi'
import {
    fetchPublicProfile,
    sendAnimeRecommendationToUser,
    type PublicUserProfileData,
} from '../../services/friendsApi'
import { apiEntryToFila, type FilaLista } from '../mi-lista/mi-lista-data'
import { Dialogo } from '../mi-lista/piezas'
import { ProfileHeader } from './ProfileHeader'
import { FlagPickerModal, FLAG_PRESETS } from './FlagPickerModal'
import { LateralCustomWallpaper, LATERAL_PRESETS } from './LateralCustomWallpaper'
import { AnimeStatsDashboard } from './AnimeStatsDashboard'
import { CommentsWall } from './CommentsWall'
import { ProfileSettingsModal } from './ProfileSettingsModal'
import { UserFriendsSection } from './UserFriendsSection'
import { AvatarPickerModal } from './AvatarPickerModal'
import { TasteCorrelationGraph } from '../recomendador/TasteCorrelationGraph'
import {
    fetchTasteAnalytics,
    searchTestAnimes,
    type TasteAnalyticsResponse,
    type TestAnimeItem,
} from '../../services/recommenderApi'
import type {
    SocialLinks,
    PrivacyConfig,
    TasteTestAnswers,
    LateralWallpaperConfig,
} from './perfil-types'
import '../mi-lista/mi-lista.css'
import '../recomendador/recomendador.css'
import './perfil.css'

const getStorageProfileKey = (uid?: number | string) => `animigos_user_custom_profile_${uid ?? 'guest'}`
const getStoragePrivacyKey = (uid?: number | string) => `animigos_user_privacy_config_${uid ?? 'guest'}`
const getStorageTasteKey = (uid?: number | string) => `animigos_user_taste_test_${uid ?? 'guest'}`
const getStorageFlagKey = (uid?: number | string) => `animigos_user_flag_banner_${uid ?? 'guest'}`
const getStorageLateralKey = (uid?: number | string) => `animigos_user_lateral_wallpaper_${uid ?? 'guest'}`

interface PerfilViewProps {
    visitedUsername?: string
}

export const PerfilView: React.FC<PerfilViewProps> = ({ visitedUsername }) => {
    const { acento } = useThemeAccent()
    const { user, refreshUser } = useAuth()
    const { filas, actualizar } = useMyList()

    const isVisitingOther = Boolean(
        visitedUsername &&
            visitedUsername.trim() !== '' &&
            visitedUsername.trim().toLowerCase() !== (user?.username || '').toLowerCase()
    )

    // Estado para perfil público visitado (#perfil/<username>)
    const [publicData, setPublicData] = useState<PublicUserProfileData | null>(null)
    const [publicLoading, setPublicLoading] = useState(false)
    const [publicError, setPublicError] = useState<string | null>(null)

    React.useEffect(() => {
        if (!isVisitingOther || !visitedUsername) {
            setPublicData(null)
            setPublicError(null)
            return
        }
        let cancelled = false
        setPublicLoading(true)
        setPublicError(null)
        fetchPublicProfile(visitedUsername)
            .then((res) => {
                if (!cancelled) setPublicData(res)
            })
            .catch((err: any) => {
                if (!cancelled) setPublicError(err?.message || 'No se pudo cargar este perfil')
            })
            .finally(() => {
                if (!cancelled) setPublicLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [isVisitingOther, visitedUsername])

    // Estado para modal "Recomendar Anime"
    const [recommendModalOpen, setRecommendModalOpen] = useState(false)
    const [recSearchQuery, setRecSearchQuery] = useState('')
    const [recSearchResults, setRecSearchResults] = useState<TestAnimeItem[]>([])
    const [recSearching, setRecSearching] = useState(false)
    const [selectedRecAnime, setSelectedRecAnime] = useState<TestAnimeItem | null>(null)
    const [recMessage, setRecMessage] = useState('')
    const [recSending, setRecSending] = useState(false)
    const [recFeedback, setRecFeedback] = useState<{ text: string; isError: boolean } | null>(null)

    React.useEffect(() => {
        if (!recommendModalOpen) return
        let cancelled = false
        const timer = setTimeout(async () => {
            setRecSearching(true)
            try {
                const items = await searchTestAnimes(recSearchQuery.trim())
                if (!cancelled) setRecSearchResults(items.slice(0, 8))
            } catch {
                if (!cancelled) setRecSearchResults([])
            } finally {
                if (!cancelled) setRecSearching(false)
            }
        }, 220)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [recommendModalOpen, recSearchQuery])

    // Modo de edición visual rápida (lápiz): foto de perfil, flag, laterales
    const [isVisualEditOpen, setIsVisualEditOpen] = useState(false)
    const [lateralModalOpen, setLateralModalOpen] = useState(false)

    // 1. Datos de perfil reactivos
    const [displayName, setDisplayName] = useState<string>(() => user?.display_name || user?.username || '')
    const [bio, setBio] = useState<string>(() => user?.bio || '')
    const [avatarUrl, setAvatarUrl] = useState<string>(() => user?.avatar_url || '')
    const [socials, setSocials] = useState<SocialLinks>({ mal: '', anilist: '', discord: '', twitter: '' })
    const [flagUrl, setFlagUrl] = useState<string>(FLAG_PRESETS[0]?.url || '')
    const [lateralConfig, setLateralConfig] = useState<LateralWallpaperConfig>({
        imageUrl: LATERAL_PRESETS[0]?.url || '',
        opacity: 55,
        enabled: true,
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

        // Cargar Lateral (habilitado por defecto con preset si aún no se ha configurado imagen)
        try {
            const savedLat = localStorage.getItem(getStorageLateralKey(uid))
            if (savedLat) {
                const parsed = JSON.parse(savedLat)
                if (parsed && parsed.imageUrl) {
                    setLateralConfig(parsed)
                } else {
                    setLateralConfig({
                        imageUrl: LATERAL_PRESETS[0]?.url || '',
                        opacity: 55,
                        enabled: true,
                    })
                }
            } else {
                setLateralConfig({
                    imageUrl: LATERAL_PRESETS[0]?.url || '',
                    opacity: 55,
                    enabled: true,
                })
            }
        } catch {
            setLateralConfig({
                imageUrl: LATERAL_PRESETS[0]?.url || '',
                opacity: 55,
                enabled: true,
            })
        }

        // Cargar Privacidad
        try {
            const savedPriv = localStorage.getItem(getStoragePrivacyKey(uid))
            setPrivacy(savedPriv ? JSON.parse(savedPriv) : { isListPublic: true, showStats: true, allowComments: 'everyone' })
        } catch {
            setPrivacy({ isListPublic: true, showStats: true, allowComments: 'everyone' })
        }

        // Cargar Taste Test (sincronizado entre #recomendador y #perfil)
        try {
            const savedTaste =
                localStorage.getItem(`animigos_taste_${uid}`) ||
                localStorage.getItem(getStorageTasteKey(uid))
            setTasteAnswers(
                savedTaste
                    ? JSON.parse(savedTaste)
                    : {
                          tropes: [],
                          favoriteGenres: user?.preferences?.favorite_genres || [],
                          dislikedGenres: user?.preferences?.disliked_genres || [],
                          pacing: user?.preferences?.preferred_duration || '',
                          contentFilters: [],
                          favoriteMovies: [],
                          likedAnimeIds: [],
                          calibratedPercentage: user?.preferences?.onboarding_completed ? 90 : 0,
                      }
            )
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

    // Estado para la correlación analítica de gustos en el perfil del usuario
    const [tasteAnalytics, setTasteAnalytics] = useState<TasteAnalyticsResponse | null>(null)
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

    const listLikedIdsKey = React.useMemo(() => {
        return filas
            .filter(
                (f) =>
                    (f.nota !== null && f.nota >= 7) ||
                    f.favorito ||
                    f.estado === 'visto' ||
                    f.estado === 'viendo'
            )
            .map((f) => f.malId)
            .sort((a, b) => a - b)
            .join(',')
    }, [filas])

    React.useEffect(() => {
        const listLikedIds = listLikedIdsKey
            ? listLikedIdsKey.split(',').map((n) => Number(n)).filter(Boolean)
            : []

        const allLikedIds = Array.from(new Set([...(tasteAnswers.likedAnimeIds || []), ...listLikedIds]))
        const hasCalibrationData =
            Boolean(user) ||
            (tasteAnswers.calibratedPercentage || 0) > 0 ||
            (tasteAnswers.favoriteGenres?.length || 0) > 0 ||
            (tasteAnswers.favoriteMovies?.length || 0) > 0 ||
            allLikedIds.length > 0

        if (!hasCalibrationData) {
            setTasteAnalytics(null)
            return
        }

        let cancelled = false
        setIsLoadingAnalytics(true)
        fetchTasteAnalytics({
            tropes: tasteAnswers.tropes || [],
            favorite_genres: tasteAnswers.favoriteGenres || [],
            disliked_genres: tasteAnswers.dislikedGenres || [],
            pacing: tasteAnswers.pacing || '',
            tmdb_movies: tasteAnswers.favoriteMovies || [],
            liked_anime_ids: allLikedIds,
        })
            .then((res) => {
                if (!cancelled) setTasteAnalytics(res)
            })
            .catch(() => {
                if (!cancelled) setTasteAnalytics(null)
            })
            .finally(() => {
                if (!cancelled) setIsLoadingAnalytics(false)
            })

        return () => {
            cancelled = true
        }
    }, [tasteAnswers, listLikedIdsKey, user?.id])

    // Modales
    const [configModalOpen, setConfigModalOpen] = useState(false)
    const [avatarModalOpen, setAvatarModalOpen] = useState(false)
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
                const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
                await fetch(`${API_BASE_URL}/users/me/preferences/`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        privacy_settings: {
                            privacy: newConfig,
                            isListPublic: newConfig.isListPublic,
                            showStats: newConfig.showStats,
                            allowComments: newConfig.allowComments,
                            allowRecommendations: newConfig.allowRecommendations !== false,
                            socials,
                            flag_url: flagUrl,
                            lateral_config: lateralConfig,
                        },
                    }),
                })
            } catch (e) {
                console.error('Error guardando privacidad en backend:', e)
            }
        }
    }

    // Valores efectivos según si estamos en nuestro propio perfil o visitando el de otro usuario
    const activeUsername = isVisitingOther
        ? publicData?.user?.username || visitedUsername || ''
        : user?.username || ''
    const activeDisplayName = isVisitingOther
        ? publicData?.user?.display_name || publicData?.user?.username || visitedUsername || ''
        : displayName
    const activeBio = isVisitingOther
        ? publicData?.user?.bio || '¡Hola! Estoy usando Animigos para coordinar animes con mis amigos 🍿'
        : bio
    const activeAvatarUrl = isVisitingOther
        ? publicData?.user?.avatar_url || ''
        : avatarUrl
    const activeFlagUrl = isVisitingOther
        ? publicData?.flag_url || FLAG_PRESETS[0]?.url || ''
        : flagUrl
    const activeSocials = isVisitingOther
        ? publicData?.socials || {}
        : socials
    const activePrivacy: PrivacyConfig = isVisitingOther
        ? publicData?.privacy || {
              isListPublic: true,
              showStats: true,
              allowComments: 'everyone',
              allowRecommendations: true,
          }
        : privacy
    const activeLateralConfig: LateralWallpaperConfig = isVisitingOther
        ? publicData?.lateral_config && publicData.lateral_config.imageUrl
            ? publicData.lateral_config
            : lateralConfig
        : lateralConfig
    const activeFilas: FilaLista[] = React.useMemo(() => {
        if (!isVisitingOther) return filas
        return (publicData?.entries || []).map(apiEntryToFila)
    }, [isVisitingOther, filas, publicData?.entries])

    const activeTasteAnalytics = isVisitingOther
        ? publicData?.taste_analytics || null
        : tasteAnalytics

    const handleNavigateToList = () => {
        if (isVisitingOther && activeUsername) {
            window.location.hash = `#mi-lista/${encodeURIComponent(activeUsername)}`
        } else {
            window.location.hash = '#mi-lista'
        }
    }

    const handleSendRecommendation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedRecAnime || !activeUsername) return
        setRecSending(true)
        setRecFeedback(null)
        try {
            const res = await sendAnimeRecommendationToUser(activeUsername, {
                anime_id: selectedRecAnime.id,
                message: recMessage.trim(),
            })
            setRecFeedback({ text: res.message || '¡Recomendación enviada!', isError: false })
            setTimeout(() => {
                setRecommendModalOpen(false)
                setSelectedRecAnime(null)
                setRecMessage('')
                setRecFeedback(null)
            }, 1300)
        } catch (err: any) {
            setRecFeedback({
                text: err?.message || 'Error al enviar la recomendación.',
                isError: true,
            })
        } finally {
            setRecSending(false)
        }
    }

    return (
        <section
            className="ml-root perfil-root py-4 px-3 px-md-4"
            style={{ '--ml-acento': acento, '--perfil-acento': acento } as CSSProperties}
        >
            {/* 1. Fondo Lateral Personalizado (GIF o Imagen) que flanquea el contenido */}
            <LateralCustomWallpaper
                config={activeLateralConfig}
                onChangeConfig={handleSaveLateralConfig}
                isEditMode={!isVisitingOther && isVisualEditOpen}
                externalModalOpen={!isVisitingOther && lateralModalOpen}
                onCloseExternalModal={() => setLateralModalOpen(false)}
            />

            <div className="container position-relative z-1" style={{ maxWidth: '1240px' }}>
                {isVisitingOther && publicLoading ? (
                    <div className="perfil-breakdown-card text-center py-5 my-4">
                        <Loader2 size={26} className="spinner-border text-secondary mb-2" />
                        <div className="text-white fw-semibold">Cargando perfil de @{visitedUsername}...</div>
                    </div>
                ) : isVisitingOther && publicError ? (
                    <div className="perfil-breakdown-card text-center py-5 my-4">
                        <div className="text-danger fw-bold mb-2">{publicError}</div>
                        <button
                            type="button"
                            className="ml-btn ml-btn-acento ml-btn-sm"
                            onClick={() => {
                                window.location.hash = '#perfil'
                            }}
                        >
                            Volver a mi perfil
                        </button>
                    </div>
                ) : (
                    <>
                        {/* 2. Cabecera de Perfil con Imagen tipo Flag */}
                        <ProfileHeader
                            displayName={activeDisplayName}
                            username={activeUsername}
                            avatarUrl={activeAvatarUrl}
                            flagUrl={activeFlagUrl}
                            bio={activeBio}
                            memberSince={
                                (isVisitingOther ? publicData?.user?.created_at : user?.created_at)
                                    ? new Date(
                                          (isVisitingOther ? publicData?.user?.created_at : user?.created_at) as string
                                      ).toLocaleDateString('es-ES', {
                                          month: 'long',
                                          year: 'numeric',
                                      })
                                    : 'Reciente'
                            }
                            socials={activeSocials}
                            privacy={activePrivacy}
                            onOpenConfigModal={() => setConfigModalOpen(true)}
                            onChangeAvatarClick={() => setAvatarModalOpen(true)}
                            onOpenFlagModal={() => setFlagModalOpen(true)}
                            isVisualEditOpen={!isVisitingOther && isVisualEditOpen}
                            onToggleVisualEdit={() => setIsVisualEditOpen((prev) => !prev)}
                            isCurrentUser={!isVisitingOther}
                            onViewList={
                                !isVisitingOther || activePrivacy.isListPublic ? handleNavigateToList : undefined
                            }
                            onRecommendAnime={
                                activePrivacy.allowRecommendations !== false
                                    ? () => {
                                          setRecFeedback(null)
                                          setRecommendModalOpen(true)
                                      }
                                    : undefined
                            }
                            onBackToOwnProfile={
                                isVisitingOther
                                    ? () => {
                                          window.location.hash = '#perfil'
                                      }
                                    : undefined
                            }
                        />

                        {/* 3. Sección de Amigos del Usuario */}
                        <UserFriendsSection
                            currentUserUsername={activeUsername}
                            readOnly={isVisitingOther}
                            initialFriends={isVisitingOther ? publicData?.friends || [] : undefined}
                        />

                        {/* 4. ADN & Correlación de Gustos del Usuario (Red de Nodos y Matriz de Co-ocurrencia) */}
                        {(!isVisitingOther || activePrivacy.showStats) ? (
                            <div className="my-4">
                                <TasteCorrelationGraph
                                    analytics={activeTasteAnalytics}
                                    loading={isVisitingOther ? publicLoading : isLoadingAnalytics}
                                    accentColor={acento}
                                />
                            </div>
                        ) : (
                            <div className="perfil-breakdown-card text-center py-4 my-4">
                                <Lock size={18} className="text-secondary mb-1" />
                                <div className="small text-secondary">
                                    La matriz de correlación de gustos de @{activeUsername} es privada.
                                </div>
                            </div>
                        )}

                        {/* 5. Dashboard de Estadísticas de Anime */}
                        <AnimeStatsDashboard
                            filas={activeFilas}
                            showStats={!isVisitingOther || activePrivacy.showStats}
                            canViewList={!isVisitingOther || activePrivacy.isListPublic}
                            onViewList={handleNavigateToList}
                            readOnly={isVisitingOther}
                            onUpdateFila={(id, cambios) => {
                                if (isVisitingOther) return
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
                            allowComments={activePrivacy.allowComments}
                        />
                    </>
                )}
            </div>

            {/* Modal para Recomendar Anime directamente al usuario del perfil */}
            <Dialogo
                abierto={recommendModalOpen}
                onCerrar={() => setRecommendModalOpen(false)}
                etiqueta="Recomendar Anime"
                ancho={560}
            >
                <form onSubmit={handleSendRecommendation} className="p-4 d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">RECOMENDACIÓN DIRECTA</span>
                        <h3 className="h5 fw-bold text-white mb-1 d-flex align-items-center gap-2">
                            <Sparkles size={16} style={{ color: 'var(--perfil-acento)' }} />
                            <span>Recomendar Anime a {activeDisplayName}</span>
                        </h3>
                        <p className="small mb-0 text-secondary" style={{ fontSize: '0.78rem' }}>
                            Elige un anime del catálogo y envíale una recomendación directa a <strong>@{activeUsername}</strong>. Recibirá una notificación inmediata.
                        </p>
                    </div>

                    {/* Buscador de anime */}
                    <div>
                        <label className="form-label small fw-semibold text-white mb-1.5">
                            1. Busca y selecciona el anime
                        </label>
                        <div className="perfil-friends-filter-input-wrap w-100" style={{ maxWidth: 'none' }}>
                            <Search size={14} className="perfil-friends-filter-icon" />
                            <input
                                type="text"
                                data-autofocus
                                placeholder="Escribe el título del anime (ej: Vinland Saga, Frieren, Monster)..."
                                value={recSearchQuery}
                                onChange={(e) => setRecSearchQuery(e.target.value)}
                                className="perfil-friends-filter-input"
                            />
                        </div>

                        {/* Anime seleccionado */}
                        {selectedRecAnime && (
                            <div
                                className="mt-2 p-2.5 rounded-3 d-flex align-items-center justify-content-between gap-2"
                                style={{
                                    background: 'var(--perfil-acento-soft)',
                                    border: '1px solid var(--perfil-acento)',
                                }}
                            >
                                <div className="d-flex align-items-center gap-2.5 min-w-0">
                                    <img
                                        src={selectedRecAnime.poster}
                                        alt=""
                                        style={{
                                            width: 38,
                                            height: 54,
                                            objectFit: 'cover',
                                            borderRadius: 6,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div className="min-w-0">
                                        <div className="small fw-bold text-white text-truncate">
                                            {selectedRecAnime.title}
                                        </div>
                                        <div className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                            ★ {selectedRecAnime.score} · {(selectedRecAnime.genres || []).slice(0, 3).join(', ')}
                                        </div>
                                    </div>
                                </div>
                                <span
                                    className="badge rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1"
                                    style={{ background: 'var(--perfil-acento)', color: '#09090b', fontSize: '0.7rem' }}
                                >
                                    <Check size={12} /> Seleccionado
                                </span>
                            </div>
                        )}

                        {/* Lista de resultados del catálogo */}
                        <div className="mt-2">
                            {recSearching ? (
                                <div className="text-center py-3">
                                    <Loader2 size={18} className="spinner-border text-secondary" />
                                </div>
                            ) : (
                                <div className="row g-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                                    {recSearchResults.map((item) => {
                                        const isSel = selectedRecAnime?.id === item.id
                                        return (
                                            <div key={item.id} className="col-12 col-sm-6">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRecAnime(item)}
                                                    className="w-100 p-2 rounded-3 border text-start d-flex align-items-center gap-2"
                                                    style={{
                                                        background: isSel
                                                            ? 'var(--perfil-acento-soft)'
                                                            : 'var(--perfil-card-2)',
                                                        borderColor: isSel
                                                            ? 'var(--perfil-acento)'
                                                            : 'var(--perfil-border)',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <img
                                                        src={item.poster}
                                                        alt=""
                                                        style={{
                                                            width: 34,
                                                            height: 48,
                                                            objectFit: 'cover',
                                                            borderRadius: 5,
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <div className="min-w-0 flex-grow-1">
                                                        <div className="small fw-bold text-white text-truncate">
                                                            {item.title}
                                                        </div>
                                                        <div
                                                            className="small text-secondary text-truncate"
                                                            style={{ fontSize: '0.68rem' }}
                                                        >
                                                            ★ {item.score} · {(item.genres || []).slice(0, 2).join(', ')}
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Nota o mensaje personalizado */}
                    <div>
                        <label className="form-label small fw-semibold text-white mb-1">
                            2. Mensaje opcional para @{activeUsername}
                        </label>
                        <textarea
                            className="cat-search-control w-100"
                            rows={2}
                            maxLength={240}
                            placeholder="Ej: ¡Tienes que ver este anime sí o sí, el protagonista te va a encantar!"
                            value={recMessage}
                            onChange={(e) => setRecMessage(e.target.value)}
                            style={{ resize: 'none', fontSize: '0.8rem' }}
                        />
                    </div>

                    {recFeedback && (
                        <div
                            className={`small p-2 rounded-2 ${
                                recFeedback.isError
                                    ? 'text-danger bg-danger-subtle'
                                    : 'text-success bg-success-subtle'
                            }`}
                            style={{ fontSize: '0.76rem' }}
                        >
                            {recFeedback.text}
                        </div>
                    )}

                    <div
                        className="d-flex justify-content-end gap-2 pt-2 border-top"
                        style={{ borderColor: 'var(--perfil-border)' }}
                    >
                        <button
                            type="button"
                            onClick={() => setRecommendModalOpen(false)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedRecAnime || recSending}
                            className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                        >
                            {recSending ? (
                                <Loader2 size={14} className="spinner-border spinner-border-sm" />
                            ) : (
                                <Send size={14} />
                            )}
                            <span>{recSending ? 'Enviando...' : 'Enviar Recomendación'}</span>
                        </button>
                    </div>
                </form>
            </Dialogo>

            {/* Modal de Configuración Unificado (Paleta/Acento, Perfil y Privacidad) */}
            <ProfileSettingsModal
                open={configModalOpen}
                onClose={() => setConfigModalOpen(false)}
                initialName={displayName}
                initialBio={bio}
                initialAvatar={avatarUrl}
                initialSocials={socials}
                initialPrivacy={privacy}
                onSaveProfile={handleSaveProfile}
                onSavePrivacy={handleSavePrivacy}
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
        </section>
    )
}
