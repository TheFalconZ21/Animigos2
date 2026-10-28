import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAuthHeaders } from '../services/authApi'
import {
    calibrateAndGetRecommendations,
    fetchTasteAnalytics,
    type CalibratedRecommendation,
    type TasteAnalyticsResponse,
    type ReferenceWorkQuery,
} from '../services/recommenderApi'
import type { TasteTestAnswers } from '../components/perfil/perfil-types'

export const getStorageTasteKey = (userId?: number | string) =>
    `animigos_taste_${userId ?? 'guest'}`

const getLegacyStorageTasteKey = (userId?: number | string) =>
    `animigos_user_taste_test_${userId ?? 'guest'}`

const DEFAULT_TASTE_ANSWERS: TasteTestAnswers = {
    favoriteGenres: [],
    dislikedGenres: [],
    pacing: '',
    tropes: [],
    favoriteMovies: [],
    likedAnimeIds: [],
    contentFilters: [],
    calibratedPercentage: 0,
}

export function useRecommender() {
    const { user } = useAuth()
    const uid = user?.id ?? 'guest'

    const [tasteAnswers, setTasteAnswers] = useState<TasteTestAnswers>(() => {
        try {
            const saved =
                localStorage.getItem(getStorageTasteKey(uid)) ||
                localStorage.getItem(getLegacyStorageTasteKey(uid))
            if (saved) return JSON.parse(saved)
        } catch {
            // ignore
        }
        return DEFAULT_TASTE_ANSWERS
    })

    const [preferredFormat, setPreferredFormat] = useState<string>('sorprendeme')
    const [preferredGenre, setPreferredGenre] = useState<string>('sorprendeme')
    const [referenceWork, setReferenceWork] = useState<ReferenceWorkQuery | null>(null)
    const [excludedBatchIds, setExcludedBatchIds] = useState<number[]>([])

    // Resultados de la sección superior (búsqueda por referencia + preferencias + perfil)
    const [recommendations, setRecommendations] = useState<CalibratedRecommendation[]>([])
    const [isLoadingRecs, setIsLoadingRecs] = useState<boolean>(false)

    // Resultados de la sección inferior Estilo Netflix (basado en películas/series favoritas del usuario)
    const [selectedNetflixMovieIndex, setSelectedNetflixMovieIndex] = useState<number>(-1)
    const [netflixRecommendations, setNetflixRecommendations] = useState<CalibratedRecommendation[]>([])
    const [isLoadingNetflix, setIsLoadingNetflix] = useState<boolean>(false)

    // Analíticas de correlación de gustos (para el Perfil)
    const [tasteAnalytics, setTasteAnalytics] = useState<TasteAnalyticsResponse | null>(null)
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false)

    useEffect(() => {
        try {
            const saved =
                localStorage.getItem(getStorageTasteKey(uid)) ||
                localStorage.getItem(getLegacyStorageTasteKey(uid))
            if (saved) {
                const parsed = JSON.parse(saved) as TasteTestAnswers
                setTasteAnswers(parsed)
                return
            }
        } catch {
            // ignore
        }

        if (user?.preferences?.onboarding_completed) {
            const backendFavs = user.preferences.favorite_genres || []
            const backendDisliked = user.preferences.disliked_genres || []
            const synced: TasteTestAnswers = {
                ...DEFAULT_TASTE_ANSWERS,
                favoriteGenres: backendFavs,
                dislikedGenres: backendDisliked,
                pacing: user.preferences.preferred_duration || 'fast_12',
                calibratedPercentage: 96,
            }
            setTasteAnswers(synced)
            try {
                localStorage.setItem(getStorageTasteKey(uid), JSON.stringify(synced))
                localStorage.setItem(getLegacyStorageTasteKey(uid), JSON.stringify(synced))
            } catch {
                // ignore
            }
        } else {
            setTasteAnswers(DEFAULT_TASTE_ANSWERS)
        }
    }, [uid, user])

    const isCalibrated = Boolean(
        tasteAnswers.calibratedPercentage >= 50 ||
        user?.preferences?.onboarding_completed
    )

    const loadRecommendations = useCallback(
        async (
            answersOverride?: TasteTestAnswers,
            formatOverride?: string,
            genreOverride?: string,
            refOverride?: ReferenceWorkQuery | null,
            excludeOverride?: number[]
        ) => {
            const activeAnswers = answersOverride ?? tasteAnswers
            const activeFmt = formatOverride ?? preferredFormat
            const activeGenre = genreOverride ?? preferredGenre
            const activeRef = refOverride !== undefined ? refOverride : referenceWork
            const activeExclude = excludeOverride ?? excludedBatchIds

            setIsLoadingRecs(true)
            try {
                const data = await calibrateAndGetRecommendations({
                    tmdb_movies: activeAnswers.favoriteMovies || [],
                    liked_anime_ids: activeAnswers.likedAnimeIds || [],
                    favorite_genres: activeAnswers.favoriteGenres || [],
                    disliked_genres: activeAnswers.dislikedGenres || [],
                    tropes: activeAnswers.tropes || [],
                    pacing: activeAnswers.pacing || '',
                    preferred_format: activeFmt,
                    preferred_genre: activeGenre,
                    reference_work: activeRef,
                    exclude_ids: activeExclude,
                    limit: 5,
                })
                setRecommendations(data.slice(0, 5))
            } finally {
                setIsLoadingRecs(false)
            }
        },
        [tasteAnswers, preferredFormat, preferredGenre, referenceWork, excludedBatchIds]
    )

    const loadNetflixRecommendations = useCallback(
        async (answersOverride?: TasteTestAnswers, movieIndexOverride?: number) => {
            const activeAnswers = answersOverride ?? tasteAnswers
            const idx = movieIndexOverride ?? selectedNetflixMovieIndex
            const userMovies = activeAnswers.favoriteMovies || []

            const targetMovies =
                idx >= 0 && idx < userMovies.length ? [userMovies[idx]] : userMovies

            const activeRef: ReferenceWorkQuery | null =
                idx >= 0 && idx < userMovies.length
                    ? {
                          kind: 'movie',
                          title: userMovies[idx].title,
                          genres: userMovies[idx].genres || [],
                          overview: userMovies[idx].overview || '',
                      }
                    : null

            setIsLoadingNetflix(true)
            try {
                const data = await calibrateAndGetRecommendations({
                    tmdb_movies: targetMovies,
                    liked_anime_ids: activeAnswers.likedAnimeIds || [],
                    favorite_genres: activeAnswers.favoriteGenres || [],
                    disliked_genres: activeAnswers.dislikedGenres || [],
                    tropes: activeAnswers.tropes || [],
                    pacing: activeAnswers.pacing || '',
                    preferred_format: 'sorprendeme',
                    preferred_genre: 'sorprendeme',
                    reference_work: activeRef,
                    netflix_mode: true,
                    limit: 5,
                })
                setNetflixRecommendations(data.slice(0, 5))
            } finally {
                setIsLoadingNetflix(false)
            }
        },
        [tasteAnswers, selectedNetflixMovieIndex]
    )

    const loadAnalytics = useCallback(
        async (answersOverride?: TasteTestAnswers) => {
            const activeAnswers = answersOverride ?? tasteAnswers
            setIsLoadingAnalytics(true)
            try {
                const data = await fetchTasteAnalytics({
                    tmdb_movies: activeAnswers.favoriteMovies || [],
                    liked_anime_ids: activeAnswers.likedAnimeIds || [],
                    favorite_genres: activeAnswers.favoriteGenres || [],
                    tropes: activeAnswers.tropes || [],
                })
                if (data) setTasteAnalytics(data)
            } finally {
                setIsLoadingAnalytics(false)
            }
        },
        [tasteAnswers]
    )

    useEffect(() => {
        if (!isCalibrated) {
            setRecommendations([])
            return
        }
        loadRecommendations(tasteAnswers, preferredFormat, preferredGenre, referenceWork, [])
    }, [isCalibrated, preferredFormat, preferredGenre, referenceWork])

    useEffect(() => {
        if (!isCalibrated) {
            setNetflixRecommendations([])
            return
        }
        loadNetflixRecommendations(tasteAnswers, selectedNetflixMovieIndex)
    }, [isCalibrated, tasteAnswers, selectedNetflixMovieIndex])

    useEffect(() => {
        if (!isCalibrated) {
            setTasteAnalytics(null)
            return
        }
        loadAnalytics(tasteAnswers)
    }, [isCalibrated, tasteAnswers])

    const handleSelectFormat = useCallback((fmt: string) => {
        setExcludedBatchIds([])
        setPreferredFormat(fmt)
    }, [])

    const handleSelectGenre = useCallback((genre: string) => {
        setExcludedBatchIds([])
        setPreferredGenre(genre)
    }, [])

    const handleSelectReferenceWork = useCallback((refWork: ReferenceWorkQuery | null) => {
        setExcludedBatchIds([])
        setReferenceWork(refWork)
    }, [])

    const handleSurpriseMeReset = useCallback(() => {
        setExcludedBatchIds([])
        setReferenceWork(null)
        setPreferredFormat('sorprendeme')
        setPreferredGenre('sorprendeme')
    }, [])

    const rotateNextFive = useCallback(async () => {
        const currentIds = recommendations.map((r) => r.anime_id)
        const nextExcludes = Array.from(new Set([...excludedBatchIds, ...currentIds]))
        const boundedExcludes = nextExcludes.length > 25 ? currentIds : nextExcludes
        setExcludedBatchIds(boundedExcludes)
        await loadRecommendations(
            tasteAnswers,
            preferredFormat,
            preferredGenre,
            referenceWork,
            boundedExcludes
        )
    }, [
        recommendations,
        excludedBatchIds,
        loadRecommendations,
        tasteAnswers,
        preferredFormat,
        preferredGenre,
        referenceWork,
    ])

    const completeCalibrationTest = useCallback(
        async (newAnswers: TasteTestAnswers) => {
            setTasteAnswers(newAnswers)
            setExcludedBatchIds([])
            setSelectedNetflixMovieIndex(-1)
            try {
                localStorage.setItem(getStorageTasteKey(uid), JSON.stringify(newAnswers))
                localStorage.setItem(getLegacyStorageTasteKey(uid), JSON.stringify(newAnswers))
            } catch {
                // ignore
            }

            if (user) {
                try {
                    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
                    await fetch(`${API_BASE_URL}/users/me/preferences/`, {
                        method: 'PATCH',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({
                            onboarding_completed: true,
                            favorite_genres: newAnswers.favoriteGenres,
                            disliked_genres: newAnswers.dislikedGenres,
                            preferred_duration: newAnswers.pacing,
                        }),
                    })
                } catch (e) {
                    console.error('Error guardando preferencias en backend:', e)
                }
            }

            await Promise.all([
                loadRecommendations(newAnswers, preferredFormat, preferredGenre, referenceWork, []),
                loadNetflixRecommendations(newAnswers, -1),
                loadAnalytics(newAnswers),
            ])
        },
        [
            uid,
            user,
            preferredFormat,
            preferredGenre,
            referenceWork,
            loadRecommendations,
            loadNetflixRecommendations,
            loadAnalytics,
        ]
    )

    return {
        tasteAnswers,
        isCalibrated,
        preferredFormat,
        preferredGenre,
        referenceWork,
        recommendations,
        netflixRecommendations,
        selectedNetflixMovieIndex,
        tasteAnalytics,
        isLoadingRecs,
        isLoadingNetflix,
        isLoadingAnalytics,
        handleSelectFormat,
        handleSelectGenre,
        handleSelectReferenceWork,
        setSelectedNetflixMovieIndex,
        handleSurpriseMeReset,
        rotateNextFive,
        completeCalibrationTest,
    }
}
