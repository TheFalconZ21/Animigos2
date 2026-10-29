/**
 * Servicio de Amigos y Conexiones Sociales (Animigos)
 * Cumple con Directiva AGENTS.md (Regla 1.2: Capa de Servicios y Regla 2.1: Zero Trust)
 */
import { getAuthHeaders, type UserProfile } from './authApi'
import type { TasteAnalyticsResponse } from './recommenderApi'
import type { ApiUserListEntry, ApiUserFolder, ApiTagCount } from './userListApi'
import type { PrivacyConfig, SocialLinks, LateralWallpaperConfig } from '../components/perfil/perfil-types'

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

export interface PublicUserProfileData {
    user: UserProfile
    privacy: PrivacyConfig
    socials: SocialLinks
    flag_url: string | null
    lateral_config: LateralWallpaperConfig | null
    friends: FriendUser[]
    entries: ApiUserListEntry[]
    folders: ApiUserFolder[]
    tags: ApiTagCount[]
    taste_analytics: TasteAnalyticsResponse | null
}

export interface UserNotificationItem {
    id: string
    type: 'anime_recommendation' | 'friend_added'
    from_username: string
    from_display_name: string
    from_avatar: string
    anime_id?: number
    anime_title?: string
    anime_poster?: string
    message: string
    created_at: string
    read: boolean
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

export async function fetchSuggestedFriends(query = ''): Promise<FriendUser[]> {
    const qParam = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    const res = await fetch(`${API_BASE_URL}/users/suggested-friends/${qParam}`, {
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

export async function fetchPublicProfile(username: string): Promise<PublicUserProfileData> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(`${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || `No se pudo cargar el perfil de @${clean}`)
    }
    return data as PublicUserProfileData
}

export async function sendAnimeRecommendationToUser(
    username: string,
    payload: { anime_id: number; message: string }
): Promise<{ success: boolean; message: string }> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(`${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/recommend/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar la recomendación')
    }
    return data
}

export async function fetchUserNotifications(): Promise<{
    notifications: UserNotificationItem[]
    unread_count: number
}> {
    const res = await fetch(`${API_BASE_URL}/users/me/notifications/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!res.ok) {
        return { notifications: [], unread_count: 0 }
    }
    const data = await res.json().catch(() => ({}))
    return {
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        unread_count: typeof data.unread_count === 'number' ? data.unread_count : 0,
    }
}

export async function updateUserNotification(payload: {
    notification_id?: string
    action: 'dismiss' | 'mark_read' | 'mark_all_read'
}): Promise<{
    notifications: UserNotificationItem[]
    unread_count: number
}> {
    const res = await fetch(`${API_BASE_URL}/users/me/notifications/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    if (!res.ok) {
        return { notifications: [], unread_count: 0 }
    }
    const data = await res.json().catch(() => ({}))
    return {
        notifications: Array.isArray(data.notifications) ? data.notifications : [],
        unread_count: typeof data.unread_count === 'number' ? data.unread_count : 0,
    }
}

