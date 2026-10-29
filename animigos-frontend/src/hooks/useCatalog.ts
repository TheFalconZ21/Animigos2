/**
 * Hooks Reactivos de Catálogo de Animes (Capa de Lógica / Hooks - Pilar 1.2 de AGENTS.md)
 * Utiliza TanStack Query para deduplicación, caché en memoria y sincronización reactiva de datos.
 */

import { useQuery } from '@tanstack/react-query'
import {
    fetchTopAnimes,
    fetchCatalogAnimes,
    fetchAnimeRecommendations,
    fetchStudios,
    fetchGenres,
    fetchYears,
    fetchAnimeById,
    fetchTaxonomies,
    type CatalogFilterParams,
    type CatalogPaginatedResponse,
    type StudioItem,
    type AnimeRecommendationItem,
    type TaxonomiesCatalogResponse,
} from '../services/catalogApi'
import type { ApiAnimeData } from '../services/userListApi'

/**
 * Hook para consultar los animes top puntuados
 */
export function useTopAnimes(limit = 50) {
    return useQuery<ApiAnimeData[], Error>({
        queryKey: ['animes', 'top', limit],
        queryFn: () => fetchTopAnimes(limit),
        staleTime: 1000 * 60 * 15,
    })
}

/**
 * Hook para búsqueda y filtrado de catálogo con deduplicación y caché
 */
export function useCatalogQuery(params: CatalogFilterParams = {}) {
    return useQuery<CatalogPaginatedResponse, Error>({
        queryKey: ['animes', 'catalog', params],
        queryFn: () => fetchCatalogAnimes(params),
        staleTime: 1000 * 60 * 5,
    })
}

/**
 * Hook reactivo para búsquedas en tiempo real
 */
export function useCatalogSearch(query: string, enabled = true) {
    const trimmed = query.trim()
    return useQuery<ApiAnimeData[], Error>({
        queryKey: ['animes', 'search', trimmed],
        queryFn: async () => {
            if (!trimmed) {
                const top = await fetchTopAnimes(12)
                return top
            }
            const res = await fetchCatalogAnimes({ q: trimmed, page: 1, page_size: 15 })
            return res.results
        },
        enabled,
        staleTime: 1000 * 60 * 5,
    })
}

/**
 * Hook para listado de géneros disponibles
 */
export function useGenresQuery() {
    return useQuery<string[], Error>({
        queryKey: ['animes', 'genres'],
        queryFn: fetchGenres,
        staleTime: 1000 * 60 * 60, // 1 hora
    })
}

/**
 * Hook para listado de años disponibles
 */
export function useYearsQuery() {
    return useQuery<number[], Error>({
        queryKey: ['animes', 'years'],
        queryFn: fetchYears,
        staleTime: 1000 * 60 * 60, // 1 hora
    })
}

/**
 * Hook para recomendaciones cruzadas de un anime
 */
export function useAnimeRecommendations(malId: number | null) {
    return useQuery<AnimeRecommendationItem[], Error>({
        queryKey: ['animes', 'recommendations', malId],
        queryFn: () => {
            if (!malId) return Promise.resolve([])
            return fetchAnimeRecommendations(malId)
        },
        enabled: malId !== null && malId > 0,
        staleTime: 1000 * 60 * 15,
    })
}

/**
 * Hook para listado de estudios
 */
export function useStudios() {
    return useQuery<StudioItem[], Error>({
        queryKey: ['animes', 'studios'],
        queryFn: fetchStudios,
        staleTime: 1000 * 60 * 60, // 1 hora
    })
}

/**
 * Hook para obtener el catálogo completo de Géneros y Taxonomías de AniList
 */
export function useTaxonomiesQuery() {
    return useQuery<TaxonomiesCatalogResponse, Error>({
        queryKey: ['animes', 'taxonomies'],
        queryFn: fetchTaxonomies,
        staleTime: 1000 * 60 * 60,
    })
}

/**
 * Hook para obtener el perfil completo de un anime por su mal_id
 */
export function useAnimeDetailQuery(malId: number | null) {
    return useQuery<ApiAnimeData | null, Error>({
        queryKey: ['animes', 'detail', malId],
        queryFn: () => {
            if (!malId || malId <= 0) return Promise.resolve(null)
            return fetchAnimeById(malId)
        },
        enabled: malId !== null && malId > 0,
        staleTime: 1000 * 60 * 5,
    })
}
