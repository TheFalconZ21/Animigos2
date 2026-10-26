/**
 * Hooks Reactivos de Catálogo de Animes (Capa de Lógica / Hooks - Pilar 1.2)
 * Utiliza TanStack Query para deduplicación, caché en memoria y sincronización de datos.
 */

import { useQuery } from '@tanstack/react-query'
import {
    fetchTopAnimes,
    fetchCatalogAnimes,
    fetchAnimeRecommendations,
    fetchStudios,
    type CatalogFilterParams,
    type CatalogPaginatedResponse,
    type StudioItem,
    type AnimeRecommendationItem,
} from '../services/catalogApi'
import type { ApiAnimeData } from '../services/userListApi'

/**
 * Hook para consultar los 24 mejores animes puntuados
 */
export function useTopAnimes() {
    return useQuery<ApiAnimeData[], Error>({
        queryKey: ['animes', 'top'],
        queryFn: fetchTopAnimes,
        staleTime: 1000 * 60 * 15, // 15 minutos en el cliente
    })
}

/**
 * Hook para búsqueda y filtrado de catálogo con deduplicación y caché
 */
export function useCatalogQuery(params: CatalogFilterParams = {}) {
    return useQuery<CatalogPaginatedResponse, Error>({
        queryKey: ['animes', 'catalog', params],
        queryFn: () => fetchCatalogAnimes(params),
        staleTime: 1000 * 60 * 5, // 5 minutos
    })
}

/**
 * Hook reactivo para búsquedas en tiempo real (por ejemplo en modales de agregar o explorador)
 */
export function useCatalogSearch(query: string, enabled = true) {
    const trimmed = query.trim()
    return useQuery<ApiAnimeData[], Error>({
        queryKey: ['animes', 'search', trimmed],
        queryFn: async () => {
            if (!trimmed) {
                const top = await fetchTopAnimes()
                return top.slice(0, 12)
            }
            const res = await fetchCatalogAnimes({ q: trimmed, page: 1 })
            return res.results
        },
        enabled,
        staleTime: 1000 * 60 * 5,
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
