/**
 * Servicio de API para la Agenda de Tareas Pendientes (Pilar 1.2 y 2.1 de AGENTS.md).
 * Proporciona el contador de episodios atrasados para animes en emisión.
 */

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export interface AgendaItem {
    entry_id: string
    mal_id: number
    title: string
    title_english: string
    image_url: string
    banner_url: string
    user_status: string
    episodes_watched: number
    latest_episode: number
    total_episodes: number | null
    episodes_behind: number
    is_up_to_date: boolean
    progress_percent: number
    duration: number
    next_airing_at: number | null
    next_episode: number | null
    score: number | null
    is_favorite: boolean
}

export interface AgendaSummary {
    total_series: number
    total_episodes_behind: number
    up_to_date_count: number
    behind_count: number
    estimated_minutes: number
}

export interface SuggestedAiringAnime {
    mal_id: number
    title: string
    title_english: string
    image_url: string
    banner_url: string
    synopsis: string
    genres: string[]
    duration: number
    score: number
    scored_by: number
    latest_episode: number
    total_episodes: number | null
    next_airing_at: number | null
    next_episode: number | null
    in_user_list: boolean
}

export interface AgendaApiResponse {
    summary: AgendaSummary
    items: AgendaItem[]
    suggested_airing: SuggestedAiringAnime[]
    is_authenticated: boolean
}

export async function fetchAgenda(): Promise<AgendaApiResponse> {
    const res = await fetch(`${API_BASE_URL}/users/agenda/`, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'include',
    })

    if (!res.ok) {
        throw new Error('No se pudo cargar la agenda de episodios')
    }

    return res.json()
}

