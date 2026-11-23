/**
 * Capa de Servicios de Autenticación y Perfil de Usuario (Animigos)
 * Pilar 2.1: Zero Trust BFF - Las credenciales y sesiones se gestionan mediante cookies HttpOnly seguras.
 */

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, ''); const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const sessionId = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('animigos_session_id') ||
           localStorage.getItem('session_id') ||
           (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('animigos_session_id') || sessionStorage.getItem('session_id')) : null))
        : null
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders,
    }
    if (sessionId) {
        headers['X-Session-Id'] = sessionId
        headers['Authorization'] = `Bearer ${sessionId}`
    }
    return headers
}

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
    is_staff?: boolean
    is_superuser?: boolean
    favorite_anime?: number | null
    country?: string
    region?: string
    city?: string
    timezone_name?: string
    birth_year?: number | null
    gender?: string
    demographics_prompted?: boolean
    preferences?: UserPreferences
    created_at: string
    updated_at: string
}

export interface AuthResponse {
    message: string
    authenticated: boolean
    is_new_user?: boolean
    session_id?: string
    user: UserProfile
}

export interface CurrentUserResponse {
    authenticated: boolean
    session_id?: string
    user: UserProfile | null
}

/**
 * Inicia sesión con usuario o correo y contraseña
 */
export async function loginUser(usernameOrEmail: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/users/login/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            username: usernameOrEmail.trim(),
            password: password.trim(),
        }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const errorMsg =
            data.error ||
            data.detail ||
            (data.username ? (Array.isArray(data.username) ? data.username[0] : data.username) : null) ||
            (data.password ? (Array.isArray(data.password) ? data.password[0] : data.password) : null) ||
            (typeof data === 'string' ? data : null) ||
            `Error del servidor (${res.status}): No se pudo iniciar sesión.`
        throw new Error(errorMsg)
    }
    if (data.session_id) {
        localStorage.setItem('animigos_session_id', data.session_id)
        localStorage.setItem('session_id', data.session_id)
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('animigos_session_id', data.session_id)
            sessionStorage.setItem('session_id', data.session_id)
        }
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
    const browserTz =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    const res = await fetch(`${API_BASE_URL}/users/register/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
            ...payload,
            timezone_name: browserTz,
        }),
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
    if (data.session_id) {
        localStorage.setItem('animigos_session_id', data.session_id)
        localStorage.setItem('session_id', data.session_id)
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('animigos_session_id', data.session_id)
            sessionStorage.setItem('session_id', data.session_id)
        }
    }
    return data
}

/**
 * Inicia sesión o registra cuenta mediante Google Sign-In (ID Token JWT)
 */
export async function loginWithGoogleApi(credential: string): Promise<AuthResponse> {
    const browserTz =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    const res = await fetch(`${API_BASE_URL}/users/auth/google/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            credential,
            timezone_name: browserTz,
        }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || data.detail || 'No se pudo autenticar con Google.')
    }
    if (data.session_id) {
        localStorage.setItem('animigos_session_id', data.session_id)
        localStorage.setItem('session_id', data.session_id)
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('animigos_session_id', data.session_id)
            sessionStorage.setItem('session_id', data.session_id)
        }
    }
    return data
}

/**
 * Guarda los datos demográficos opcionales del onboarding inicial (o marca omitido)
 */
export async function saveDemographicsApi(payload: {
    country?: string
    birth_year?: number | null
    gender?: string
    timezone_name?: string
    skipped?: boolean
}): Promise<{ message: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE_URL}/users/me/demographics/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || data.detail || 'No se pudieron guardar tus datos.')
    }
    return data
}

/**
 * Cierra la sesión activa del usuario
 */
export async function logoutUser(): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/users/logout/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
        })
    } finally {
        localStorage.removeItem('animigos_session_id')
        localStorage.removeItem('session_id')
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('animigos_session_id')
            sessionStorage.removeItem('session_id')
        }
    }
}

/**
 * Verifica el estado de la sesión activa en el BFF
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
    try {
        const res = await fetch(`${API_BASE_URL}/users/me/`, {
            headers: getAuthHeaders(),
            credentials: 'include',
        })
        if (!res.ok) {
            // Solo limpiar tokens si el servidor confirmó explícitamente 401 (no en caídas temporales 5xx)
            if (res.status === 401) {
                localStorage.removeItem('animigos_session_id')
                localStorage.removeItem('session_id')
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem('animigos_session_id')
                    sessionStorage.removeItem('session_id')
                }
            }
            return { authenticated: false, user: null }
        }
        const data = await res.json()
        if (data.authenticated && data.session_id) {
            localStorage.setItem('animigos_session_id', data.session_id)
            localStorage.setItem('session_id', data.session_id)
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('animigos_session_id', data.session_id)
                sessionStorage.setItem('session_id', data.session_id)
            }
        } else if (!data.authenticated) {
            localStorage.removeItem('animigos_session_id')
            localStorage.removeItem('session_id')
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('animigos_session_id')
                sessionStorage.removeItem('session_id')
            }
        }
        return data
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
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates),
    })
    if (!res.ok) {
        throw new Error(`Error al actualizar perfil: ${res.statusText}`)
    }
    return res.json()
}

/**
 * Actualiza preferencias de usuario y customización en la BD (flag_url, lateral_config, socials, etc.)
 */
export async function updateUserPreferences(updates: Partial<{
    onboarding_completed: boolean
    experience_level: string
    favorite_genres: string[]
    disliked_genres: string[]
    preferred_duration: string
    privacy_settings: Record<string, unknown>
}>): Promise<UserPreferences> {
    const res = await fetch(`${API_BASE_URL}/users/me/preferences/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates),
    })
    if (!res.ok) {
        throw new Error(`Error al actualizar preferencias: ${res.statusText}`)
    }
    return res.json()
}

export interface PresetAvatarItem {
    id: string
    name: string
    category: string
    category_slug: string
    url: string
}

export interface PresetAvatarCategory {
    slug: string
    name: string
    count: number
    preview_avatar?: PresetAvatarItem | null
    avatars: PresetAvatarItem[]
}

export interface PresetAvatarsResponse {
    total_categories: number
    total_avatars: number
    summary?: boolean
    categories: PresetAvatarCategory[]
}

export interface FetchPresetAvatarsOptions {
    search?: string
    category?: string
    summary?: boolean
}

/**
 * Obtiene el catálogo de avatares oficiales organizados por series/lotes de anime.
 * Con `summary: true`, descarga únicamente 1 avatar representativo por lote.
 * Con `category: slug`, descarga todos los avatares del lote seleccionado bajo demanda.
 */
export async function fetchPresetAvatars(
    optionsOrSearch?: FetchPresetAvatarsOptions | string,
    categoryArg?: string
): Promise<PresetAvatarsResponse> {
    const params = new URLSearchParams()
    if (typeof optionsOrSearch === 'string') {
        if (optionsOrSearch) params.append('search', optionsOrSearch)
        if (categoryArg) params.append('category', categoryArg)
    } else if (optionsOrSearch) {
        if (optionsOrSearch.search) params.append('search', optionsOrSearch.search)
        if (optionsOrSearch.category) params.append('category', optionsOrSearch.category)
        if (optionsOrSearch.summary) params.append('summary', 'true')
    }
    const queryString = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${API_BASE_URL}/users/preset-avatars/${queryString}`)
    if (!res.ok) {
        throw new Error('Error al cargar avatares predefinidos')
    }
    return res.json()
}

