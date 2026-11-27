/**
 * Hooks Reactivos de Catálogo de Animes (Capa de Lógica / Hooks - Pilar 1.2 de AGENTS.md)
 * Utiliza TanStack Query para deduplicación, caché en memoria y sincronización reactiva de datos.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    fetchTopAnimes,
    fetchCatalogAnimes,
    fetchAnimeRecommendations,
    fetchAnimeRelations,
    fetchAnimeCharactersStreaming,
    fetchAnimeCharacterDetail,
    fetchAnimeStaffDetail,
    fetchFavoriteCharacters,
    toggleFavoriteCharacter,
    fetchStudios,
    fetchGenres,
    fetchYears,
    fetchAnimeById,
    fetchTaxonomies,
    fetchSeasonsTimeline,
    fetchSeasonMetrics,
    type TimelineYearItem,
    type YearSeasonMetrics,
    type CatalogFilterParams,
    type CatalogPaginatedResponse,
    type StudioItem,
    type AnimeRecommendationItem,
    type TaxonomiesCatalogResponse,
    type AnimeCharacterItem,
    type AnimeCharactersStreamingResponse,
    type StaffPersonDetail,
    type UserFavoriteCharacterItem,
    type ToggleFavoriteCharacterPayload,
    type ToggleFavoriteCharacterResponse,
} from '../services/catalogApi'
import type { ApiAnimeData, ApiAnimeRelationItem } from '../services/userListApi'

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
 * Hook para obras relacionadas (precuelas, secuelas, spin-offs...) de un anime
 */
export function useAnimeRelationsQuery(malId: number | null) {
    return useQuery<ApiAnimeRelationItem[], Error>({
        queryKey: ['animes', 'relations', malId],
        queryFn: () => {
            if (!malId) return Promise.resolve([])
            return fetchAnimeRelations(malId)
        },
        enabled: malId !== null && malId > 0,
        staleTime: 1000 * 60 * 60, // 1 hora
    })
}

/**
 * Hook para personajes (con seiyuu) y plataformas legales de streaming de un anime
 */
export function useAnimeCharactersStreamingQuery(malId: number | null) {
    return useQuery<AnimeCharactersStreamingResponse, Error>({
        queryKey: ['animes', 'characters-streaming', malId],
        queryFn: () => {
            if (!malId) return Promise.resolve({ characters: [], streaming: [] })
            return fetchAnimeCharactersStreaming(malId)
        },
        enabled: malId !== null && malId > 0,
        staleTime: 1000 * 60 * 60,
    })
}

/**
 * Hook para la vista dedicada de un personaje (con biografía traducida al español)
 */
export function useAnimeCharacterDetailQuery(malId: number | null, charId: number | null) {
    return useQuery<AnimeCharacterItem | null, Error>({
        queryKey: ['animes', 'character-detail', malId, charId],
        queryFn: () => {
            if (!malId || !charId) return Promise.resolve(null)
            return fetchAnimeCharacterDetail(malId, charId)
        },
        enabled: Boolean(malId && malId > 0 && charId && charId > 0),
        staleTime: 1000 * 60 * 60,
    })
}

/**
 * Hook para la ficha dedicada de un actor de doblaje / seiyuu, autor / mangaka,
 * director, productor o miembro del staff
 */
export function useAnimeStaffDetailQuery(staffId: number | null) {
    return useQuery<StaffPersonDetail | null, Error>({
        queryKey: ['animes', 'staff-detail', staffId],
        queryFn: () => {
            if (!staffId) return Promise.resolve(null)
            return fetchAnimeStaffDetail(staffId)
        },
        enabled: Boolean(staffId && staffId > 0),
        staleTime: 1000 * 60 * 60,
    })
}

/**
 * Hook reactivo para consultar los personajes favoritos de un usuario
 */
export function useFavoriteCharactersQuery(username?: string, enabled = true) {
    return useQuery<UserFavoriteCharacterItem[], Error>({
        queryKey: ['users', 'favorite-characters', username || 'me'],
        queryFn: () => fetchFavoriteCharacters(username),
        enabled,
        staleTime: 1000 * 60 * 2,
    })
}

/**
 * Mutación reactiva para agregar/quitar un personaje favorito en PostgreSQL
 * y sincronizar contadores en todas las vistas de personajes, seiyuu y perfil.
 */
export function useToggleFavoriteCharacterMutation() {
    const queryClient = useQueryClient()
    return useMutation<ToggleFavoriteCharacterResponse, Error, ToggleFavoriteCharacterPayload>({
        mutationFn: (payload) => toggleFavoriteCharacter(payload),
        onSuccess: (data) => {
            queryClient.setQueryData(['users', 'favorite-characters', 'me'], data.results)
            queryClient.invalidateQueries({ queryKey: ['users', 'favorite-characters'] })
            queryClient.invalidateQueries({ queryKey: ['animes', 'characters-streaming'] })
            queryClient.invalidateQueries({ queryKey: ['animes', 'character-detail'] })
            queryClient.invalidateQueries({ queryKey: ['animes', 'staff-detail'] })
        },
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

/**
 * Hook para obtener la línea de tiempo completa de años con conteos y promedios
 */
export function useSeasonsTimelineQuery() {
    return useQuery<TimelineYearItem[], Error>({
        queryKey: ['animes', 'seasons-timeline', 'v2'],
        queryFn: fetchSeasonsTimeline,
        staleTime: 1000 * 60 * 60, // 1 hora
    })
}

/**
 * Hook reactivo para obtener métricas y top de un año y sus temporadas
 */
export function useSeasonMetricsQuery(year: number | null, season?: string) {
    return useQuery<YearSeasonMetrics, Error>({
        queryKey: ['animes', 'season-metrics', year, season || 'all', 'v2'],
        queryFn: () => {
            if (!year) throw new Error('Año requerido')
            return fetchSeasonMetrics(year, season)
        },
        enabled: !!year,
        staleTime: 1000 * 60 * 30, // 30 minutos
    })
}
