/**
 * Servicio de Catálogo de Animes (Capa de Datos / Servicios - Pilar 1.2 y 4.1 de AGENTS.md)
 * Abstrae las peticiones hacia el BFF Django, consumiendo endpoints con caché intermedia.
 */

import type { ApiAnimeData, ApiAnimeRelationItem } from './userListApi'
export type { ApiAnimeData, ApiAnimeRelationItem } from './userListApi'
import { getAuthHeaders } from './authApi'

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, ''); const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export interface CatalogFilterParams {
    q?: string
    genre?: string
    tags?: string
    studio?: string
    year?: number | string
    season?: string
    min_score?: number | string
    max_score?: number | string
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

export interface TaxonomyCatalogItem {
    name: string
    category: 'Genre' | 'Theme' | 'Cast' | 'Setting' | 'Demographic' | string
    count: number
}

export interface TaxonomiesCatalogResponse {
    genres: TaxonomyCatalogItem[]
    tags: TaxonomyCatalogItem[]
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
    reason?: string
}

/**
 * Consulta el catálogo general con filtros completos y paginación (50 animes a la vez)
 */
export async function fetchCatalogAnimes(params: CatalogFilterParams = {}): Promise<CatalogPaginatedResponse> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set('q', params.q)
    if (params.genre) searchParams.set('genre', params.genre)
    if (params.tags) searchParams.set('tags', params.tags)
    if (params.studio) searchParams.set('studio', params.studio)
    if (params.year) searchParams.set('year', String(params.year))
    if (params.season) searchParams.set('season', params.season)
    if (params.min_score !== undefined && params.min_score !== '') searchParams.set('min_score', String(params.min_score))
    if (params.max_score !== undefined && params.max_score !== '') searchParams.set('max_score', String(params.max_score))
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
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al obtener catálogo de animes.`)
    }

    return response.json()
}

/**
 * Obtiene un anime individual por su mal_id
 */
export async function fetchAnimeById(malId: number): Promise<ApiAnimeData> {
    const response = await fetch(`${API_BASE_URL}/animes/${malId}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al obtener el perfil del anime #${malId}.`)
    }

    return response.json()
}

/**
 * Obtiene el catálogo completo de Géneros y Media Tags de AniList con conteos
 */
export async function fetchTaxonomies(): Promise<TaxonomiesCatalogResponse> {
    const response = await fetch(`${API_BASE_URL}/animes/taxonomies/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        return { genres: [], tags: [] }
    }

    return response.json()
}

/**
 * Obtiene los mejores animes por puntuación
 */
export async function fetchTopAnimes(limit = 50): Promise<ApiAnimeData[]> {
    const response = await fetch(`${API_BASE_URL}/animes/top/?limit=${limit}`, {
        method: 'GET',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        return [
            'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
            'Isekai', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural'
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
        headers: getAuthHeaders(),
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
    try {
        const response = await fetch(`${API_BASE_URL}/animes/${malId}/recommendations/?limit=${limit}`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include',
        })

        if (!response.ok) {
            return []
        }

        return await response.json()
    } catch {
        return []
    }
}

/**
 * Obtiene los estudios principales agrupados con conteos
 */
export async function fetchStudios(): Promise<StudioItem[]> {
    const response = await fetch(`${API_BASE_URL}/animes/studios/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar estudios de anime.`)
    }

    return response.json()
}

export interface AnimeScoreHistoryItem {
    id: number
    year: number
    month: number | null
    recorded_at: string
    period_label: string
    score: string | null
    scored_by: number
    members: number
    rank: number | null
    popularity: number | null
    favorites: number | null
}

/**
 * Obtiene la evolución histórica y mensual de la nota de un anime
 */
export async function fetchAnimeScoreHistory(malId: number): Promise<AnimeScoreHistoryItem[]> {
    const response = await fetch(`${API_BASE_URL}/animes/${malId}/history/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar histórico de notas.`)
    }

    return response.json()
}

export interface PopularAnimePreview {
    mal_id: number
    title: string
    image_url: string
    banner_url?: string
    scored_by: number
    score: number
}

export interface TimelineYearItem {
    year: number
    count: number
    avg_score: number
    top_popular?: PopularAnimePreview[]
}

export interface SeasonTopAnime {
    mal_id: number
    title: string
    title_english: string
    score: number
    scored_by: number
    image_url: string
    type: string
    season: string
    studio: string
}

export interface SeasonMetricItem {
    season: 'Winter' | 'Spring' | 'Summer' | 'Fall' | string
    name_es: string
    icon: string
    count: number
    avg_score: number
    top_genre: string
    top_3: SeasonTopAnime[]
}

export interface YearSeasonMetrics {
    year: number
    total_animes: number
    avg_score: number
    top_genre: string
    top_3: SeasonTopAnime[]
    seasons: {
        Winter: SeasonMetricItem
        Spring: SeasonMetricItem
        Summer: SeasonMetricItem
        Fall: SeasonMetricItem
        [key: string]: SeasonMetricItem
    }
    selected_season?: SeasonMetricItem
}

/**
 * Obtiene la línea de tiempo completa de años con su conteo y nota media
 */
export async function fetchSeasonsTimeline(): Promise<TimelineYearItem[]> {
    const response = await fetch(`${API_BASE_URL}/animes/seasons-timeline/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar la línea de tiempo de temporadas.`)
    }

    return response.json()
}

/**
 * Obtiene métricas cuantitativas y cualitativas de un año específico y sus 4 temporadas
 */
export async function fetchSeasonMetrics(year: number, season?: string): Promise<YearSeasonMetrics> {
    const params = new URLSearchParams()
    params.set('year', String(year))
    if (season) {
        params.set('season', season)
    }

    const response = await fetch(`${API_BASE_URL}/animes/season-metrics/?${params.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        throw new Error(`Error ${response.status} al consultar las métricas de la temporada.`)
    }

    return response.json()
}

/**
 * Consulta las obras relacionadas (precuelas, secuelas, spin-offs...) de un anime
 */
export async function fetchAnimeRelations(malId: number): Promise<ApiAnimeRelationItem[]> {
    const response = await fetch(`${API_BASE_URL}/animes/${malId}/relations/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })

    if (!response.ok) {
        return []
    }

    return response.json()
}

export interface AnimeVoiceActor {
    id: number
    name: string
    native_name?: string
    language: string
    language_display: string
    image_url: string
}

export interface CharacterAnimeographyItem {
    mal_id: number
    title: string
    image_url: string
    role: string
    format?: string
    season_year?: number | null
}

export interface AnimeCharacterItem {
    id: number
    name: string
    native_name?: string
    alternative_names?: string[]
    role: string
    role_display: string
    image_url: string
    description: string
    description_es?: string
    age?: string
    gender?: string
    blood_type?: string
    birthday?: string
    favourites?: number
    base_favourites?: number
    animigos_favourites?: number
    is_favourite?: boolean
    voice_actors: AnimeVoiceActor[]
    animeography?: CharacterAnimeographyItem[]
}

export interface AnimeStreamingPlatform {
    site: string
    url: string
    language?: string
    color?: string
    icon?: string
}

export interface AnimeStaffMember {
    id: number
    name: string
    native_name?: string
    role: string
    role_display: string
    category?: 'author' | 'direction' | 'production' | 'music' | 'art_animation' | 'other' | string
    occupations?: string[]
    image_url: string
    language_display?: string
}

export interface StaffSocialLink {
    platform: 'twitter' | 'instagram' | 'youtube' | 'tiktok' | 'pixiv' | 'facebook' | 'twitch' | 'blog' | 'website' | 'anilist' | string
    label: string
    url: string
    color: string
    handle?: string
}

export interface StaffWikipediaInfo {
    url: string
    title: string
    lang: string
    is_direct: boolean
}

export interface StaffVoiceWorkItem {
    mal_id: number
    anime_title: string
    anime_image: string
    format: string
    season_year?: number | null
    score?: number | null
    character_id?: number | null
    character_name: string
    character_native?: string
    character_image: string
    character_role: string
    base_character_favourites?: number
    animigos_character_favourites?: number
    character_favourites?: number
    is_character_favourite?: boolean
}

export interface UserFavoriteCharacterItem {
    id: string
    character_id: number
    name: string
    native_name?: string
    image_url: string
    role_display: string
    anime_mal_id?: number | null
    anime_title?: string
    base_favourites: number
    animigos_favourites: number
    favourites: number
    is_favourite: boolean
    created_at?: string
}

export interface ToggleFavoriteCharacterPayload {
    character_id: number
    character_name: string
    character_native?: string
    character_image: string
    role_display?: string
    anime_mal_id?: number | null
    anime_title?: string
    base_favourites?: number
}

export interface ToggleFavoriteCharacterResponse {
    character_id: number
    is_favourite: boolean
    base_favourites: number
    animigos_favourites: number
    favourites: number
    results: UserFavoriteCharacterItem[]
}

export interface StaffProductionWorkItem {
    mal_id?: number | null
    media_type: 'ANIME' | 'MANGA' | string
    title: string
    image_url: string
    format: string
    season_year?: number | null
    score?: number | null
    role: string
    role_display: string
    is_authorship?: boolean
}

export interface StaffPersonDetail {
    id: number
    name: string
    native_name?: string
    alternative_names?: string[]
    language?: string
    language_display?: string
    image_url: string
    occupations?: string[]
    gender?: string
    age?: string
    birthday?: string
    hometown?: string
    blood_type?: string
    years_active?: string
    favourites?: number
    description: string
    description_es?: string
    wikipedia?: StaffWikipediaInfo
    social_links: StaffSocialLink[]
    voice_works: StaffVoiceWorkItem[]
    production_works: StaffProductionWorkItem[]
}

export interface AnimeCharactersStreamingResponse {
    characters: AnimeCharacterItem[]
    streaming: AnimeStreamingPlatform[]
    staff?: AnimeStaffMember[]
}

/**
 * Consulta personajes (con seiyuu/actores de voz), staff/autores y plataformas legales de streaming de un anime
 */
export async function fetchAnimeCharactersStreaming(
    malId: number
): Promise<AnimeCharactersStreamingResponse> {
    const response = await fetch(`${API_BASE_URL}/animes/${malId}/characters-streaming/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!response.ok) {
        return { characters: [], streaming: [], staff: [] }
    }
    return response.json()
}

/**
 * Consulta el detalle dedicado de un personaje (con biografía traducida al español)
 */
export async function fetchAnimeCharacterDetail(
    malId: number,
    charId: number
): Promise<AnimeCharacterItem | null> {
    const response = await fetch(`${API_BASE_URL}/animes/${malId}/character/${charId}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!response.ok) {
        return null
    }
    return response.json()
}

/**
 * Consulta la ficha dedicada de un actor de doblaje / seiyuu, autor / mangaka,
 * director, productor o miembro del staff (con redes sociales, Wikipedia y obras)
 */
export async function fetchAnimeStaffDetail(staffId: number): Promise<StaffPersonDetail | null> {
    const response = await fetch(`${API_BASE_URL}/animes/staff/${staffId}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!response.ok) {
        return null
    }
    return response.json()
}

/**
 * Obtiene la lista de personajes favoritos de un usuario (o del usuario autenticado)
 */
export async function fetchFavoriteCharacters(username?: string): Promise<UserFavoriteCharacterItem[]> {
    const qs = username ? `?username=${encodeURIComponent(username)}` : ''
    const response = await fetch(`${API_BASE_URL}/users/favorite-characters/${qs}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!response.ok) {
        return []
    }
    const data = await response.json()
    return Array.isArray(data?.results) ? data.results : []
}

/**
 * Agrega o quita un personaje de los favoritos del usuario en PostgreSQL
 */
export async function toggleFavoriteCharacter(
    payload: ToggleFavoriteCharacterPayload
): Promise<ToggleFavoriteCharacterResponse> {
    const response = await fetch(`${API_BASE_URL}/users/favorite-characters/toggle/`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        throw new Error(`Error ${response.status} al actualizar personaje favorito.`)
    }
    return response.json()
}

