/**
 * Servicio API para el Motor Recomendador y Calibrador del Profesor Doki Doki
 * Pilar 2.1: Zero Trust BFF - Toda recomendación es orquestada por el backend.
 */

import type { TmdbMovie } from '../components/perfil/perfil-types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export interface CalibrateAnimeCandidate {
    mal_id: number
    title: string
    title_english: string
    image_url: string
    score: number
    season_year?: number
    studio?: string
    genres: string[]
}

export interface CalibratedRecommendation {
    anime_id: number
    anime_title: string
    anime_title_english?: string
    anime_poster: string
    anime_banner?: string
    anime_score: number
    anime_scored_by: number
    anime_studio: string
    season_year?: number
    episodes?: number
    genres: string[]
    affinity_score: number
    match_reason: string
}

export interface CalibrationPayload {
    tmdb_movies: TmdbMovie[]
    liked_anime_ids: number[]
    favorite_genres: string[]
    disliked_genres: string[]
    tropes: string[]
    pacing: string
}

/**
 * Busca animes populares o coincidentes para el selector de 'Animes que ya viste'
 */
export async function searchTestAnimes(query = ''): Promise<CalibrateAnimeCandidate[]> {
    try {
        const url = `${API_BASE_URL}/animes/test-search/?q=${encodeURIComponent(query)}`
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) throw new Error('Error buscando animes para test')
        return await res.json()
    } catch (err) {
        console.error('searchTestAnimes error:', err)
        return []
    }
}

/**
 * Ejecuta el algoritmo de calibración multidimensional y retorna recomendaciones explicadas
 */
export async function calibrateAndGetRecommendations(
    payload: CalibrationPayload
): Promise<CalibratedRecommendation[]> {
    try {
        const url = `${API_BASE_URL}/animes/calibrate-recommendations/`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Error al calibrar recomendaciones')
        return await res.json()
    } catch (err) {
        console.error('calibrateAndGetRecommendations error:', err)
        return []
    }
}
