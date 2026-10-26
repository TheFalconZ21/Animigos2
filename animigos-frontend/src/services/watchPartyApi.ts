/**
 * Tipos y Contratos de Datos para Watch Parties y Salas en Tiempo Real
 * Pilar 1.4 (Tipado Estricto) y Pilar 3 (Coordinación en Tiempo Real) de AGENTS.md.
 */

export interface RoomCandidate {
    id: string
    anime_id: number
    title: string
    image_url: string
    score: number | null
    avg_interest: number
    votes_count: number
    suggested_by: string
}

export interface RoomSelectedAnime {
    mal_id: number
    title: string
    image_url: string
    score: number | null
    episodes: number | null
}

export interface RoomSummary {
    id: string
    name: string
    description: string
    status: 'candidates' | 'voting' | 'selected' | 'watching' | 'completed'
    invite_code: string
    members_count: number
    candidates: RoomCandidate[]
    selected_anime: RoomSelectedAnime | null
}

export interface RoomPlaybackState {
    is_playing: boolean
    current_time: number
    last_sync_timestamp: number
    episode: number
    speed: number
    host_name: string
    total_duration?: number
}

export interface ChatMessage {
    id: string
    sender: string
    text: string
    timestamp: number
}

export interface FloatingReaction {
    id: string
    sender: string
    emoji: string
    timestamp: number
    xPos: number
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
