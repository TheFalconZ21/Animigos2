/**
 * Capa de Servicios para Mi Lista (Colección Personal de Anime)
 * Arquitectura por capas (Pilar 1.2): Abstracción completa de peticiones HTTP,
 * tipado estricto y comunicación con el BFF Django REST Framework.
 */

import { getAuthHeaders } from './authApi'

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, ''); const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export type EstadoLista = 'visto' | 'viendo' | 'pendiente' | 'dropeado' | 'esperando'

export interface ApiAnimeRelationItem {
    relation_type: string
    relation_type_display: string
    format: string
    format_display: string
    mal_id: number | null
    anilist_id?: number | null
    title: string
    title_english?: string
    image_url: string
    season_year?: number | null
    status?: string
}

export interface ApiAnimeData {
    mal_id: number
    title: string
    title_english?: string
    title_japanese?: string
    synopsis?: string
    image_url: string
    banner_url?: string
    score?: number | string | null
    scored_by?: number | null
    popularity?: number | null
    rank?: number | null
    episodes?: number | null
    duration?: number | null
    status?: string
    season?: string
    season_year?: number | null
    year?: number | null
    season_display?: string
    recommended_by?: string[] | { user_id: number; username: string }[]
    studio?: string
    genres: string[]
    tags_data?: Array<{ name: string; category?: string; rank?: number; spoiler?: boolean }>
    type?: string
    release_date?: string
    relations_data?: ApiAnimeRelationItem[]
}

export interface ApiUserListEntry {
    id: string
    mal_id: number
    status: EstadoLista
    score: number | null
    episodes_watched: number
    is_favorite: boolean
    folder_id: string | null
    folder_name: string | null
    tags: string[]
    notes: string
    anime: ApiAnimeData
    created_at: string
    updated_at: string
}

export interface ApiUserFolder {
    id: string
    name: string
    entries_count: number
    average_score: number | null
    covers: string[]
    created_at: string
    updated_at: string
}

export interface ApiTagCount {
    tag: string
    count: number
}

export interface ApiListStats {
    total: number
    visto: number
    viendo: number
    pendiente: number
    dropeado?: number
    esperando?: number
    average_score: number | null
    percent_completed: number
}

export interface MyListApiResponse {
    entries: ApiUserListEntry[]
    folders: ApiUserFolder[]
    tags: ApiTagCount[]
    stats: ApiListStats
}

export interface AddAnimePayload {
    mal_id: number
    status?: EstadoLista
    score?: number | null
    episodes_watched?: number
    is_favorite?: boolean
    folder_id?: string | null
    tags?: string[]
    notes?: string
    title?: string
    image_url?: string
    episodes?: number | null
}

export interface UpdateAnimePayload {
    status?: EstadoLista
    score?: number | null
    episodes_watched?: number
    is_favorite?: boolean
    folder_id?: string | null
    tags?: string[]
    notes?: string
}

// -------------------------------------------------------------
// HELPER PARA MANEJO ROBUSTO DE RESPUESTAS Y ERRORES DEL BFF
// -------------------------------------------------------------

async function handleApiResponse<T>(res: Response, fallbackPrefix: string): Promise<T> {
    if (!res.ok) {
        let errorDetail = ''
        try {
            const data = await res.json()
            if (data) {
                if (typeof data.detail === 'string' && data.detail.trim()) {
                    errorDetail = data.detail.trim()
                } else if (typeof data.error === 'string' && data.error.trim()) {
                    errorDetail = data.error.trim()
                } else if (typeof data.message === 'string' && data.message.trim()) {
                    errorDetail = data.message.trim()
                } else if (typeof data === 'object') {
                    const firstKey = Object.keys(data)[0]
                    if (firstKey) {
                        const val = data[firstKey]
                        if (Array.isArray(val) && val[0]) errorDetail = `${firstKey}: ${val[0]}`
                        else if (typeof val === 'string') errorDetail = `${firstKey}: ${val}`
                    }
                }
            }
        } catch {
            // Cuerpo no es JSON
        }

        if (!errorDetail) {
            if (res.status === 401 || res.status === 403) {
                errorDetail = 'Debes iniciar sesión para realizar esta acción en tu lista.'
            } else if (res.status === 404) {
                errorDetail = 'El elemento o anime solicitado no fue encontrado.'
            } else if (res.status >= 500) {
                errorDetail = `Error en el servidor (${res.status}). Inténtalo nuevamente en unos instantes.`
            } else {
                errorDetail = `${fallbackPrefix} (Código ${res.status}${res.statusText ? `: ${res.statusText}` : ''})`
            }
        }

        // Si la sesión expiró o no está autorizada, limpiar tokens locales y emitir evento reactivo
        if (res.status === 401 || res.status === 403) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('animigos_session_id')
                localStorage.removeItem('session_id')
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('animigos-auth-expired', { detail: { status: res.status } }))
            }
        }

        throw new Error(errorDetail)
    }

    if (res.status === 204) {
        return undefined as unknown as T
    }

    return res.json()
}

// -------------------------------------------------------------
// FUNCIONES DE API (CRUD)
// -------------------------------------------------------------

/**
 * Obtiene toda la colección del usuario desde la base de datos
 */
export async function fetchMyList(): Promise<MyListApiResponse> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/`, {
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return handleApiResponse<MyListApiResponse>(res, 'Error al obtener Mi Lista')
}

/**
 * Agrega un nuevo anime a la colección personal
 */
export async function addAnimeToMyList(payload: AddAnimePayload): Promise<ApiUserListEntry> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    return handleApiResponse<ApiUserListEntry>(res, 'Error al agregar anime a Mi Lista')
}

/**
 * Actualiza parcialmente una entrada en la lista personal
 */
export async function updateMyListEntry(
    entryId: string,
    updates: UpdateAnimePayload
): Promise<ApiUserListEntry> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/${entryId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates),
    })
    return handleApiResponse<ApiUserListEntry>(res, 'Error al actualizar anime')
}

/**
 * Elimina un anime de la lista personal
 */
export async function deleteMyListEntry(entryId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/${entryId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return handleApiResponse<void>(res, 'Error al eliminar anime de la lista')
}

/**
 * Crea una nueva carpeta personal
 */
export async function createMyListFolder(name: string): Promise<ApiUserFolder> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/folders/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name }),
    })
    return handleApiResponse<ApiUserFolder>(res, 'Error al crear carpeta')
}

/**
 * Renombra una carpeta
 */
export async function renameMyListFolder(folderId: string, name: string): Promise<ApiUserFolder> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/folders/${folderId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name }),
    })
    return handleApiResponse<ApiUserFolder>(res, 'Error al renombrar carpeta')
}

/**
 * Elimina una carpeta personal
 */
export async function deleteMyListFolder(folderId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/my-list/folders/${folderId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    return handleApiResponse<void>(res, 'Error al eliminar carpeta')
}

/**
 * Consulta el catálogo general de animes en la BD para el diálogo de agregar
 */
export async function searchCatalogAnimes(query: string, limit = 20): Promise<ApiAnimeData[]> {
    const url = new URL(`${API_BASE_URL}/animes/`, window.location.origin)
    if (query.trim()) {
        url.searchParams.set('q', query.trim())
    }
    url.searchParams.set('page_size', String(limit))

    const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    const data = await handleApiResponse<any>(res, 'Error al buscar animes en catálogo')
    return Array.isArray(data) ? data : data.results || []
}

export interface ImportMalXmlResult {
    success: boolean
    total_parsed: number
    imported: number
    created: number
    updated: number
    new_animes_registered: number
    enriched_count: number
    message: string
}

/**
 * Importa la lista de anime desde un archivo oficial animelist.xml de MyAnimeList
 */
export async function importMalXml(file: File): Promise<ImportMalXmlResult> {
    const formData = new FormData()
    formData.append('file', file)

    const authHeaders = getAuthHeaders()
    const headersWithoutContentType: Record<string, string> = {}
    if (authHeaders['X-Session-Id']) headersWithoutContentType['X-Session-Id'] = authHeaders['X-Session-Id']
    if (authHeaders['Authorization']) headersWithoutContentType['Authorization'] = authHeaders['Authorization']

    const res = await fetch(`${API_BASE_URL}/users/my-list/import-mal-xml/`, {
        method: 'POST',
        headers: headersWithoutContentType,
        body: formData,
        credentials: 'include',
    })

    return handleApiResponse<ImportMalXmlResult>(res, 'Error al importar lista de MyAnimeList')
}

