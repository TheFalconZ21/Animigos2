/**
 * Capa de Servicios de Autenticación y Perfil de Usuario (Animigos)
 * Pilar 2.1: Zero Trust BFF - Las credenciales y sesiones se gestionan mediante cookies HttpOnly seguras.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export interface UserPreferences {
    id: string
    onboarding_completed: boolean
    experience_level: string
    favorite_genres: string[]
    disliked_genres: string[]
    preferred_duration: string
    privacy_settings: Record<string, unknown>
    updated_at: string
}

export interface UserProfile {
    id: string
    username: string
    email: string
    display_name: string
    avatar_url: string
    bio: string
    favorite_anime?: number | null
    preferences?: UserPreferences
    created_at: string
    updated_at: string
}

export interface AuthResponse {
    message: string
    authenticated: boolean
    user: UserProfile
}

export interface CurrentUserResponse {
    authenticated: boolean
    user: UserProfile | null
}

/**
 * Inicia sesión con usuario o correo y contraseña
 */
export async function loginUser(usernameOrEmail: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/users/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            username: usernameOrEmail,
            password,
        }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas. Verifica tu usuario y contraseña.')
    }
    return data
}

/**
 * Registra una nueva cuenta de usuario
 */
export async function registerUser(payload: {
    username: string
    email: string
    password: string
    display_name?: string
}): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/users/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const errorMsg =
            data.username?.[0] ||
            data.email?.[0] ||
            data.password?.[0] ||
            data.error ||
            'Error al registrar la cuenta.'
        throw new Error(errorMsg)
    }
    return data
}

/**
 * Cierra la sesión activa del usuario
 */
export async function logoutUser(): Promise<void> {
    await fetch(`${API_BASE_URL}/users/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    })
}

/**
 * Verifica el estado de la sesión activa en el BFF
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
    try {
        const res = await fetch(`${API_BASE_URL}/users/me/`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        })
        if (!res.ok) {
            return { authenticated: false, user: null }
        }
        return await res.json()
    } catch {
        return { authenticated: false, user: null }
    }
}

/**
 * Actualiza los datos de perfil del usuario logueado
 */
export async function updateUserProfile(updates: Partial<{
    display_name: string
    avatar_url: string
    bio: string
    favorite_anime: number
}>): Promise<UserProfile> {
    const res = await fetch(`${API_BASE_URL}/users/me/profile/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
    })
    if (!res.ok) {
        throw new Error(`Error al actualizar perfil: ${res.statusText}`)
    }
    return res.json()
}
