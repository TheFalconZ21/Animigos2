/**
 * Servicio de Catálogo de Animes (Capa de Datos / Servicios - Pilar 1.2)
 * Abstrae las peticiones hacia el BFF Django, consumiendo endpoints con caché intermedia.
 */

import type { ApiAnimeData } from './userListApi'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export interface CatalogFilterParams {
    q?: string
    genre?: string
    studio?: string
    year?: number | string
    status?: string
    page?: number
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
 * Consulta el catálogo general con filtros y paginación
 */
export async function fetchCatalogAnimes(params: CatalogFilterParams = {}): Promise<CatalogPaginatedResponse> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set('q', params.q)
    if (params.genre) searchParams.set('genre', params.genre)
    if (params.studio) searchParams.set('studio', params.studio)
    if (params.year) searchParams.set('year', String(params.year))
    if (params.status) searchParams.set('status', params.status)
    if (params.page) searchParams.set('page', String(params.page))
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
 * Obtiene los 24 animes con mayor puntuación (en caché del backend)
 */
export async function fetchTopAnimes(): Promise<ApiAnimeData[]> {
    const response = await fetch(`${API_BASE_URL}/animes/top/`, {
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
