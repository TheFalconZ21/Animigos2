/**
 * Tipos y Contratos de Datos para Listas Compartidas, Votación por Consenso y Coordinación en Tiempo Real
 * Pilar 1.4 (Tipado Estricto) y Pilar 3 de AGENTS.md.
 */

export interface CandidateVote {
    id: string
    candidate: string
    voter_id: string
    voter_name: string
    interest_score: number
    voted_at: string
}

export interface HappinessResult {
    final_score: number
    finalScore?: number
    interest_mean: number
    interestMean?: number
    interest_dispersion: number
    interestDispersion?: number
    dispersion_penalty?: number
    mal_score_contribution?: number
    popularity_contribution?: number
    duration_contribution?: number
    quorum_percentage: number
    quorumPercentage?: number
    votes_count: number
    votesCount?: number
    total_members: number
    totalMembers?: number
    explanations: string[]
}

export interface RoomCandidate {
    id: string
    anime_id: number
    title: string
    image_url: string
    score: number | null
    episodes?: number | null
    avg_interest: number
    votes_count: number
    suggested_by: string
    votes?: CandidateVote[]
    happiness_result?: HappinessResult
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const API_BASE = `${API_BASE_URL}/groups`

export async function fetchAllRooms(): Promise<RoomSummary[]> {
    const res = await fetch(`${API_BASE}/`)
    if (!res.ok) throw new Error('No se pudieron cargar las salas grupales')
    const data = await res.json()
    return Array.isArray(data) ? data : data.results || []
}

export async function createRoomApi(data: {
    name: string
    description?: string
    creator_name?: string
    guest_token?: string
}): Promise<RoomSummary> {
    const res = await fetch(`${API_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('No se pudo crear la sala grupal')
    return res.json()
}

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

export async function nominateCandidateApi(roomId: string, animeId: number, suggestedBy?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/${roomId}/nominate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime_id: animeId, suggested_by: suggestedBy }),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'No se pudo postular el anime')
    }
    return res.json()
}

export async function voteCandidateApi(
    roomId: string,
    candidateId: string,
    score: number,
    voterId: string,
    voterName: string
): Promise<any> {
    const res = await fetch(`${API_BASE}/${roomId}/vote/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            candidate_id: candidateId,
            interest_score: score,
            voter_id: voterId,
            voter_name: voterName,
        }),
    })
    if (!res.ok) throw new Error('No se pudo emitir el voto')
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
