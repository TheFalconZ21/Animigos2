/**
 * Servicio de Amigos y Conexiones Sociales (Animigos)
 * Cumple con Directiva AGENTS.md (Regla 1.2: Capa de Servicios y Regla 2.1: Zero Trust)
 */
import { getAuthHeaders, type UserProfile } from './authApi'
import type { TasteAnalyticsResponse } from './recommenderApi'
import type { ApiUserListEntry, ApiUserFolder, ApiTagCount } from './userListApi'
import type {
    PrivacyConfig,
    SocialLinks,
    LateralWallpaperConfig,
    ProfileComment,
} from '../components/perfil/perfil-types'

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, ''); const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export type FriendshipStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received'

export interface FriendUser {
    id: number
    username: string
    display_name: string
    avatar_url: string
    bio: string
    anime_count: number
    mutual_friends_count?: number
    friendship_status?: FriendshipStatus
    request_id?: string | null
    created_at?: string
    is_online?: boolean
}

export interface FriendRequestItem extends FriendUser {
    request_id: string
    created_at: string
}

export interface FriendsOverviewResponse {
    friends: FriendUser[]
    incoming_requests: FriendRequestItem[]
    outgoing_requests: FriendRequestItem[]
    pending_count: number
    total: number
}

export interface SendFriendRequestResponse {
    message: string
    friendship_status: FriendshipStatus
    request_id?: string | null
    accepted?: boolean
    friend?: FriendUser
    request?: FriendRequestItem
}

export interface PublicUserProfileData {
    user: UserProfile
    privacy: PrivacyConfig
    socials: SocialLinks
    flag_url: string | null
    lateral_config: LateralWallpaperConfig | null
    friends: FriendUser[]
    friendship_status?: FriendshipStatus
    friend_request_id?: string | null
    mutual_friends_count?: number
    comments?: ProfileComment[]
    can_comment?: boolean
    entries: ApiUserListEntry[]
    folders: ApiUserFolder[]
    tags: ApiTagCount[]
    taste_analytics: TasteAnalyticsResponse | null
}

export interface UserNotificationItem {
    id: string
    type:
        | 'anime_recommendation'
        | 'friend_request'
        | 'friend_accepted'
        | 'friend_added'
        | 'profile_comment'
        | 'room_invitation'
        | 'anime_release'
        | 'warning'
        | 'system'
        | string
    from_username: string
    from_display_name: string
    from_avatar: string
    request_id?: string
    room_id?: string
    room_name?: string
    invite_code?: string
    anime_id?: number
    anime_title?: string
    anime_poster?: string
    message: string
    created_at: string
    read: boolean
}

export async function fetchFriendsOverview(): Promise<FriendsOverviewResponse> {
    const res = await fetch(`${API_BASE_URL}/users/me/friends/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    if (!res.ok) {
        throw new Error(`Error al obtener amigos (${res.status})`)
    }
    const data = await res.json()
    return {
        friends: Array.isArray(data.friends) ? data.friends : [],
        incoming_requests: Array.isArray(data.incoming_requests) ? data.incoming_requests : [],
        outgoing_requests: Array.isArray(data.outgoing_requests) ? data.outgoing_requests : [],
        pending_count: typeof data.pending_count === 'number' ? data.pending_count : 0,
        total: typeof data.total === 'number' ? data.total : (Array.isArray(data.friends) ? data.friends.length : 0),
    }
}

export async function fetchFriends(): Promise<FriendUser[]> {
    const overview = await fetchFriendsOverview()
    return overview.friends
}

export async function sendFriendRequest(usernameOrEmail: string): Promise<SendFriendRequestResponse> {
    const res = await fetch(`${API_BASE_URL}/users/me/friend-requests/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ username_or_email: usernameOrEmail }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Error al enviar la solicitud de amistad')
    }
    return data as SendFriendRequestResponse
}

export async function addFriend(usernameOrEmail: string): Promise<SendFriendRequestResponse> {
    return sendFriendRequest(usernameOrEmail)
}

export async function respondFriendRequest(
    requestId: string,
    action: 'accept' | 'reject'
): Promise<{ message: string; friendship_status: FriendshipStatus; friend?: FriendUser }> {
    const res = await fetch(`${API_BASE_URL}/users/me/friend-requests/${encodeURIComponent(requestId)}/respond/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Error al responder la solicitud de amistad')
    }
    return data
}

export async function cancelFriendRequest(
    requestId: string
): Promise<{ message: string; friendship_status: FriendshipStatus }> {
    const res = await fetch(`${API_BASE_URL}/users/me/friend-requests/${encodeURIComponent(requestId)}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Error al cancelar la solicitud de amistad')
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

export interface ProfileWallCommentsResponse {
    comments: ProfileComment[]
    allow_comments?: 'everyone' | 'friends' | 'none'
    can_comment?: boolean
}

export async function fetchProfileComments(username: string): Promise<ProfileWallCommentsResponse> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(`${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/comments/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'No se pudieron cargar los comentarios del muro')
    }
    return {
        comments: Array.isArray(data.comments) ? data.comments : [],
        allow_comments: data.allow_comments,
        can_comment: data.can_comment,
    }
}

export async function postProfileComment(
    username: string,
    payload: { content: string; hasSpoiler?: boolean }
): Promise<ProfileWallCommentsResponse> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(`${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/comments/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'No se pudo publicar el comentario')
    }
    return {
        comments: Array.isArray(data.comments) ? data.comments : [],
        allow_comments: data.allow_comments,
        can_comment: data.can_comment,
    }
}

export async function toggleLikeProfileComment(
    username: string,
    commentId: string
): Promise<ProfileComment[]> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(
        `${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/comments/${encodeURIComponent(commentId)}/`,
        {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({ action: 'like' }),
        }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'No se pudo registrar el me gusta')
    }
    return Array.isArray(data.comments) ? data.comments : []
}

export async function replyProfileComment(
    username: string,
    commentId: string,
    content: string
): Promise<ProfileComment[]> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(
        `${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/comments/${encodeURIComponent(commentId)}/`,
        {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({ action: 'reply', content }),
        }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'No se pudo publicar la respuesta')
    }
    return Array.isArray(data.comments) ? data.comments : []
}

export async function deleteProfileComment(
    username: string,
    commentId: string
): Promise<ProfileComment[]> {
    const clean = username.trim().replace(/^@/, '')
    const res = await fetch(
        `${API_BASE_URL}/users/public-profile/${encodeURIComponent(clean)}/comments/${encodeURIComponent(commentId)}/`,
        {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include',
        }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el comentario')
    }
    return Array.isArray(data.comments) ? data.comments : []
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

