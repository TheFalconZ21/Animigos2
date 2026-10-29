/**
 * Servicio API para el Motor Recomendador Híbrido y Perfil Analítico de Gustos
 * Pilar 2.1: Zero Trust BFF - Toda recomendación y correlación se procesa en el backend.
 */

import type { TmdbMovie } from '../components/perfil/perfil-types'
import { getAuthHeaders } from './authApi'

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, ''); const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export interface CalibrateAnimeCandidate {
    mal_id: number
    id?: number
    title: string
    title_english: string
    image_url: string
    poster?: string
    score: number
    season_year?: number
    studio?: string
    genres: string[]
}

export type TestAnimeItem = CalibrateAnimeCandidate

export interface AnimeWeightedTag {
    name: string
    category: string
    rank: number
}

export interface CalibratedRecommendation {
    anime_id: number
    anime_title: string
    anime_title_english?: string
    synopsis?: string
    anime_poster: string
    anime_banner?: string
    anime_score: number
    anime_scored_by: number
    anime_studio: string
    season_year?: number
    episodes?: number
    type?: string
    genres: string[]
    tags?: AnimeWeightedTag[]
    affinity_score: number
    match_reason: string
}

export interface ReferenceWorkQuery {
    kind: 'movie' | 'anime' | 'tv'
    title: string
    genres: string[]
    overview?: string
    mal_id?: number
    poster?: string
    year?: string | number
    mediaType?: 'movie' | 'tv'
}

export interface CalibrationPayload {
    tmdb_movies: TmdbMovie[]
    liked_anime_ids: number[]
    favorite_genres: string[]
    disliked_genres: string[]
    tropes: string[]
    pacing: string
    preferred_format?: string
    preferred_genre?: string
    preferred_year_min?: number | null
    preferred_year_max?: number | null
    reference_work?: ReferenceWorkQuery | null
    netflix_mode?: boolean
    exclude_ids?: number[]
    limit?: number
}

export interface TasteGraphNode {
    id: string
    label: string
    category: 'Genre' | 'Theme' | 'Setting' | 'Cast' | 'Technical' | string
    weight: number
    normalized_weight: number
    count: number
    mean_score?: number
    avg_rank?: number
    is_main_tag?: boolean
    sample_animes: string[]
}

export interface TasteGraphLink {
    source: string
    target: string
    strength: number
    mean_score?: number
    shared_animes: string[]
}

export interface TasteCombinationItem {
    pair: string
    source: string
    target: string
    count: number
    mean_score?: number
    affinity_pct: number
    examples: string[]
}

export interface TasteAnalyticsResponse {
    nodes: TasteGraphNode[]
    links: TasteGraphLink[]
    top_combinations: TasteCombinationItem[]
    archetype: {
        title: string
        description: string
        dominant_tags: string[]
        analyzed_works_count: number
    }
}

/**
 * Busca animes populares o coincidentes para el selector de 'Animes que ya viste'
 */
export async function searchTestAnimes(query = ''): Promise<CalibrateAnimeCandidate[]> {
    try {
        const url = `${API_BASE_URL}/animes/test-search/?q=${encodeURIComponent(query)}`
        const res = await fetch(url, {
            headers: getAuthHeaders(),
            credentials: 'include',
        })
        if (!res.ok) throw new Error('Error buscando animes para test')
        const data = await res.json()
        return (data || []).map((item: any) => ({
            ...item,
            id: item.id ?? item.mal_id,
            poster: item.poster ?? item.image_url,
        }))
    } catch (err) {
        console.error('searchTestAnimes error:', err)
        return []
    }
}

/**
 * Ejecuta el motor recomendador híbrido (tags ponderados + contenido + filtros dinámicos)
 * y retorna 5 alternativas sin secuelas ni series ya vistas.
 */
export async function calibrateAndGetRecommendations(
    payload: CalibrationPayload
): Promise<CalibratedRecommendation[]> {
    try {
        const url = `${API_BASE_URL}/animes/calibrate-recommendations/`
        const res = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                ...payload,
                limit: payload.limit ?? 5,
            }),
        })
        if (!res.ok) throw new Error('Error al calibrar recomendaciones')
        return await res.json()
    } catch (err) {
        console.error('calibrateAndGetRecommendations error:', err)
        return []
    }
}

/**
 * Obtiene el grafo de co-ocurrencia de etiquetas y perfil analítico de gustos del usuario
 */
export async function fetchTasteAnalytics(
    payload: Partial<CalibrationPayload> = {}
): Promise<TasteAnalyticsResponse | null> {
    try {
        const url = `${API_BASE_URL}/animes/taste-analytics/`
        const res = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Error al obtener analíticas de gustos')
        return await res.json()
    } catch (err) {
        console.error('fetchTasteAnalytics error:', err)
        return null
    }
}
