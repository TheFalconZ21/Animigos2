/**
 * Tipos y Contratos de Datos para Watch Parties y Coordinación de Capítulos en Tiempo Real
 * Pilar 1.4 (Tipado Estricto) y Pilar 3 (Coordinación Grupal y Sincronización) de AGENTS.md.
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
    synopsis?: string
}

export interface RoomMember {
    id: string
    guest_name: string
    guest_token: string
    role: 'owner' | 'member' | 'guest'
    episodes_watched: number
    episodes_behind: number
    sync_status: 'al_dia' | 'atrasado' | 'adelantado'
    last_active_at: string | null
}

export interface CatchupMember {
    id: string
    guest_name: string
    episodes_watched: number
    episodes_behind: number
}

export interface RoomSummary {
    id: string
    name: string
    description: string
    status: 'candidates' | 'voting' | 'selected' | 'watching' | 'completed'
    invite_code: string
    current_episode: number
    next_session_date: string | null
    session_notes: string
    members_count: number
    members: RoomMember[]
    catchup_members: CatchupMember[]
    candidates: RoomCandidate[]
    selected_anime: RoomSelectedAnime | null
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

const API_BASE = '/api/groups/lists'

export async function fetchRoomByCode(code: string): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/by_code/?code=${encodeURIComponent(code)}`)
    if (!res.ok) throw new Error('Sala no encontrada con el código ingresado')
    return res.json()
}

export async function fetchRoomById(id: string): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/${id}/`)
    if (!res.ok) throw new Error('No se pudo cargar la información de la sala')
    return res.json()
}

export async function updateMyProgressApi(
    roomId: string,
    data: { guest_token?: string; guest_name?: string; episodes_watched: number }
): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/${roomId}/update_my_progress/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('No se pudo actualizar el progreso individual')
    return res.json()
}

export async function setGroupEpisodeApi(roomId: string, episode: number): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/${roomId}/set_group_episode/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode }),
    })
    if (!res.ok) throw new Error('No se pudo actualizar la meta grupal')
    return res.json()
}

export async function scheduleGroupSessionApi(
    roomId: string,
    data: { next_session_date?: string | null; session_notes?: string }
): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/${roomId}/schedule_session/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('No se pudo agendar la sesión')
    return res.json()
}

export async function selectWinningAnimeApi(roomId: string, animeId: number): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/${roomId}/select_winner/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime_id: animeId }),
    })
    if (!res.ok) throw new Error('No se pudo seleccionar el anime ganador')
    return res.json()
}
