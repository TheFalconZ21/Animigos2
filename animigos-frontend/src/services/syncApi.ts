/**
 * Capa de Servicios para Integraciones Externas y Auto-Tracking de Animigos:
 * - MyAnimeList (OAuth2 + PKCE)
 * - AniList (OAuth2 GraphQL + importación pública por @usuario)
 * - Extensión de Navegador (Crunchyroll & Netflix)
 * - Importación de historial NetflixViewingHistory.csv
 */
import { API_BASE_URL } from './apiConfig'
import { getAuthHeaders } from './authApi'

export interface MalIntegrationStatus {
    configured: boolean
    connected: boolean
    username: string
    auto_push: boolean
    last_synced_at: string | null
}

export interface AniListIntegrationStatus {
    configured: boolean
    connected: boolean
    username: string
    auto_push: boolean
    last_synced_at: string | null
}

export interface ExtensionIntegrationStatus {
    has_token: boolean
    token_preview: string
    last_tracked_at: string | null
    last_tracked_title: string
    last_tracked_source: string
}

export interface IntegrationsStatusResponse {
    mal: MalIntegrationStatus
    anilist: AniListIntegrationStatus
    extension: ExtensionIntegrationStatus
}

export interface SyncPullResult {
    provider: 'mal' | 'anilist'
    username?: string
    mode?: 'oauth' | 'public_username'
    total_remote: number
    imported: number
    updated: number
    skipped: number
}

export interface NetflixImportResult {
    total_titles_scanned: number
    matched_animes: number
    created: number
    updated: number
    skipped_non_anime: number
    sample_titles: string[]
    message: string
}

async function parseApiResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const msg =
            (typeof data?.error === 'string' && data.error) ||
            (typeof data?.detail === 'string' && data.detail) ||
            fallbackMsg
        throw new Error(msg)
    }
    return data as T
}

export async function fetchIntegrationsStatus(): Promise<IntegrationsStatusResponse> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/status/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<IntegrationsStatusResponse>(res, 'No se pudo cargar el estado de integraciones.')
}

export async function updateIntegrationPreferences(payload: {
    mal_auto_push?: boolean
    anilist_auto_push?: boolean
}): Promise<IntegrationsStatusResponse> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/status/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    return parseApiResponse<IntegrationsStatusResponse>(res, 'No se pudo actualizar la preferencia.')
}

export async function startMalOAuth(): Promise<{ auth_url: string }> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/mal/connect/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<{ auth_url: string }>(res, 'No se pudo iniciar la conexión con MyAnimeList.')
}

export async function syncMalNow(): Promise<SyncPullResult> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/mal/sync/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<SyncPullResult>(res, 'No se pudo sincronizar con MyAnimeList.')
}

export async function disconnectMal(): Promise<{ ok: boolean; status: IntegrationsStatusResponse }> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/mal/disconnect/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<{ ok: boolean; status: IntegrationsStatusResponse }>(
        res,
        'No se pudo desvincular MyAnimeList.',
    )
}

export async function startAniListOAuth(): Promise<{ auth_url: string }> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/anilist/connect/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<{ auth_url: string }>(res, 'No se pudo iniciar la conexión con AniList.')
}

export async function syncAniListNow(username?: string): Promise<SyncPullResult> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/anilist/sync/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(username ? { username } : {}),
    })
    return parseApiResponse<SyncPullResult>(res, 'No se pudo sincronizar con AniList.')
}

export async function disconnectAniList(): Promise<{ ok: boolean; status: IntegrationsStatusResponse }> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/anilist/disconnect/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<{ ok: boolean; status: IntegrationsStatusResponse }>(
        res,
        'No se pudo desvincular AniList.',
    )
}

export async function generateExtensionToken(): Promise<{
    token: string
    status: IntegrationsStatusResponse
}> {
    const res = await fetch(`${API_BASE_URL}/users/integrations/extension/token/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return parseApiResponse<{ token: string; status: IntegrationsStatusResponse }>(
        res,
        'No se pudo generar el token de extensión.',
    )
}

export async function importNetflixCsvFile(file: File): Promise<NetflixImportResult> {
    const formData = new FormData()
    formData.append('file', file)

    const headers = getAuthHeaders()
    delete headers['Content-Type']

    const res = await fetch(`${API_BASE_URL}/users/my-list/import-netflix-csv/`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
    })
    return parseApiResponse<NetflixImportResult>(res, 'No se pudo importar el CSV de Netflix.')
}
