/**
 * Capa de Servicios para Mi Lista (Colección Personal de Anime)
 * Arquitectura por capas (Pilar 1.2): Abstracción completa de peticiones HTTP,
 * tipado estricto y comunicación con el BFF Django REST Framework.
 */

import { getAuthHeaders } from './authApi'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export type EstadoLista = 'visto' | 'viendo' | 'pendiente' | 'dropeado'

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
    if (!res.ok) {
        throw new Error(`Error al obtener Mi Lista: ${res.statusText}`)
    }
    return res.json()
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
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Error al agregar anime: ${res.statusText}`)
    }
    return res.json()
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
    if (!res.ok) {
        throw new Error(`Error al actualizar anime: ${res.statusText}`)
    }
    return res.json()
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
    if (!res.ok) {
        throw new Error(`Error al eliminar anime de la lista: ${res.statusText}`)
    }
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
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Error al crear carpeta: ${res.statusText}`)
    }
    return res.json()
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
    if (!res.ok) {
        throw new Error(`Error al renombrar carpeta: ${res.statusText}`)
    }
    return res.json()
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
    if (!res.ok) {
        throw new Error(`Error al eliminar carpeta: ${res.statusText}`)
    }
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
    if (!res.ok) {
        throw new Error(`Error al buscar animes en catálogo: ${res.statusText}`)
    }
    const data = await res.json()
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

    const data = await res.json()
    if (!res.ok) {
        throw new Error(data.error || 'Error al importar lista de MyAnimeList')
    }

    return data
}

