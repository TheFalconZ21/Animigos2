/**
 * Servicio de Amigos y Conexiones Sociales (Animigos)
 * Cumple con Directiva AGENTS.md (Regla 1.2: Capa de Servicios y Regla 2.1: Zero Trust)
 */
import { getAuthHeaders } from './authApi'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export interface FriendUser {
    id: number
    username: string
    display_name: string
    avatar_url: string
    bio: string
    anime_count: number
    created_at?: string
    is_online?: boolean
}

export async function fetchFriends(): Promise<FriendUser[]> {
    const res = await fetch(`${API_BASE_URL}/users/me/friends/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!res.ok) {
        throw new Error(`Error al obtener amigos (${res.status})`)
    }
    const data = await res.json()
    return data.friends || []
}

export async function addFriend(usernameOrEmail: string): Promise<{ message: string; friend: FriendUser }> {
    const res = await fetch(`${API_BASE_URL}/users/me/friends/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ username_or_email: usernameOrEmail }),
    })
    const data = await res.json()
    if (!res.ok) {
        throw new Error(data.error || 'Error al agregar amigo')
    }
    return data
}

export async function removeFriend(friendId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/me/friends/${friendId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al eliminar amigo')
    }
}

export async function fetchSuggestedFriends(): Promise<FriendUser[]> {
    const res = await fetch(`${API_BASE_URL}/users/suggested-friends/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!res.ok) {
        return []
    }
    const data = await res.json()
    return data.suggested || []
}
