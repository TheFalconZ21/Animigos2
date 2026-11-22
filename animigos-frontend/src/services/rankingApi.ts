/**
 * Capa de Servicios para el Ranking Global y de Amigos de Animigos.
 */
import { API_BASE_URL } from './apiConfig'
import { getAuthHeaders } from './authApi'

export type RankingScope = 'all' | 'friends'

export interface RankingUserItem {
    rank: number
    user_id: number
    username: string
    display_name: string
    avatar_url: string
    total_hours: number
    total_episodes: number
    animes_completed: number
    is_friend: boolean
    is_current_user: boolean
}

export interface RankingDistributionStats {
    total_users: number
    mean_hours: number
    std_dev_hours: number
    median_hours: number
    min_hours: number
    max_hours: number
}

export interface RankingCurrentUserSummary {
    rank: number
    total_hours: number
    total_episodes: number
    animes_completed: number
    percentile: number
    top_percent: number
    z_score: number
}

export interface RankingResponse {
    scope: RankingScope
    ranking: RankingUserItem[]
    distribution: RankingDistributionStats
    current_user: RankingCurrentUserSummary | null
}

export class RankingOptInRequiredError extends Error {
    code = 'ranking_opt_in_required' as const
    constructor(message: string) {
        super(message)
        this.name = 'RankingOptInRequiredError'
    }
}

export async function fetchUserRanking(scope: RankingScope = 'all'): Promise<RankingResponse> {
    const res = await fetch(`${API_BASE_URL}/users/ranking/?scope=${encodeURIComponent(scope)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const msg =
            (typeof data?.error === 'string' && data.error) ||
            'No se pudo cargar el ranking de usuarios.'
        if (res.status === 403 && data?.code === 'ranking_opt_in_required') {
            throw new RankingOptInRequiredError(msg)
        }
        throw new Error(msg)
    }
    return data as RankingResponse
}

export async function enableRankingParticipation(
    currentPrivacySettings?: Record<string, unknown>,
): Promise<void> {
    const basePs = currentPrivacySettings && typeof currentPrivacySettings === 'object' ? currentPrivacySettings : {}
    const existingNested =
        basePs.privacy && typeof basePs.privacy === 'object'
            ? (basePs.privacy as Record<string, unknown>)
            : {}

    const res = await fetch(`${API_BASE_URL}/users/me/preferences/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
            privacy_settings: {
                ...basePs,
                participateInRanking: true,
                privacy: {
                    ...existingNested,
                    participateInRanking: true,
                },
            },
        }),
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
            (typeof data?.error === 'string' && data.error) ||
                'No se pudo activar tu participación en el ranking.',
        )
    }
}
