/**
 * Servicio de Catálogo de Animes (Capa de Datos / Servicios - Pilar 1.2 y 4.1 de AGENTS.md)
 * Abstrae las peticiones hacia el BFF Django, consumiendo endpoints con caché intermedia.
 */

import type { ApiAnimeData } from './userListApi'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export interface CatalogFilterParams {
    q?: string
    genre?: string
    studio?: string
    year?: number | string
    season?: string
    min_score?: number | string
    format?: string
    type?: string
    status?: string
    no_sequels?: boolean | string
    not_in_my_list?: boolean | string
    recommended_by_friends?: boolean | string
    exclude_ids?: string
    page?: number
    page_size?: number
    ordering?: string
}

export interface CatalogPaginatedResponse {
    count: number
    next: string | null
    previous: string | null
    results: ApiAnimeData[]
}

export interface StudioItem {
    studio: string
    count: number
}

export interface AnimeRecommendationItem {
    id: number
    target: ApiAnimeData
    strength: number
    reason: string
}

/**
 * Consulta el catálogo general con filtros completos y paginación (50 animes a la vez)
 */
export async function fetchCatalogAnimes(params: CatalogFilterParams = {}): Promise<CatalogPaginatedResponse> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set('q', params.q)
    if (params.genre) searchParams.set('genre', params.genre)
    if (params.studio) searchParams.set('studio', params.studio)
    if (params.year) searchParams.set('year', String(params.year))
    if (params.season) searchParams.set('season', params.season)
    if (params.min_score) searchParams.set('min_score', String(params.min_score))
    if (params.format) searchParams.set('format', params.format)
    if (params.type) searchParams.set('type', params.type)
    if (params.status) searchParams.set('status', params.status)
    if (params.no_sequels) searchParams.set('no_sequels', 'true')
    if (params.not_in_my_list) searchParams.set('not_in_my_list', 'true')
    if (params.recommended_by_friends) searchParams.set('recommended_by_friends', 'true')
    if (params.exclude_ids) searchParams.set('exclude_ids', params.exclude_ids)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.page_size) searchParams.set('page_size', String(params.page_size))
    if (params.ordering) searchParams.set('ordering', params.ordering)

    const url = `${API_BASE_URL}/animes/?${searchParams.toString()}`
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al obtener catálogo de animes.`)
    }

    return response.json()
}

/**
 * Obtiene los mejores animes por puntuación
 */
export async function fetchTopAnimes(limit = 50): Promise<ApiAnimeData[]> {
    const response = await fetch(`${API_BASE_URL}/animes/top/?limit=${limit}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar los mejores animes.`)
    }

    return response.json()
}

/**
 * Obtiene lista dinámica de géneros de la base de datos
 */
export async function fetchGenres(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/animes/genres/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })

    if (!response.ok) {
        return [
            'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
            'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural'
        ]
    }

    return response.json()
}

/**
 * Obtiene lista dinámica de años disponibles en la base de datos
 */
export async function fetchYears(): Promise<number[]> {
    const response = await fetch(`${API_BASE_URL}/animes/years/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })

    if (!response.ok) {
        return [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]
    }

    return response.json()
}

/**
 * Obtiene recomendaciones cruzadas para un anime específico
 */
export async function fetchAnimeRecommendations(malId: number, limit = 12): Promise<AnimeRecommendationItem[]> {
    const response = await fetch(`${API_BASE_URL}/animes/${malId}/recommendations/?limit=${limit}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar recomendaciones cruzadas.`)
    }

    return response.json()
}

/**
 * Obtiene los estudios principales agrupados con conteos
 */
export async function fetchStudios(): Promise<StudioItem[]> {
    const response = await fetch(`${API_BASE_URL}/animes/studios/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar estudios de anime.`)
    }

    return response.json()
}
