/**
 * Capa de Datos del Tablón Social (Pilar 1.2 y 2.1 de AGENTS.md).
 * Maneja publicaciones, recomendaciones, pedidos de sugerencia y encuestas comunitarias
 * persistidas en PostgreSQL (/api/users/feed/) para que aparezcan en tiempo real a todos
 * los amigos y usuarios de la plataforma.
 */

import { getAuthHeaders } from './authApi'
import { fetchUserNotifications } from './friendsApi'
import { haceCuanto } from '../shared/tiempo'

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export type TipoActividad =
    | 'recomendacion_directa'
    | 'recomendacion_general'
    | 'invitacion_sala'
    | 'busco_anime'
    | 'encuesta'
    | 'hito'
    | 'estreno_anime'

export type FiltroTablon = 'todo' | 'mios' | 'recomendaciones' | 'invitaciones' | 'publicaciones'

export interface AutorActividad {
    id: string
    nombre: string
    usuario: string
    avatarUrl: string
}

export interface AnimeResumen {
    malId: number
    titulo: string
    imagenUrl: string
    nota: number | null
    generos: string[]
}

export interface OpcionEncuesta {
    id: string
    texto: string
    votos: number
    anime?: AnimeResumen
}

export interface RespuestaActividad {
    id: string
    autor: AutorActividad
    nota: string
    anime?: AnimeResumen
    creadoHace: string
}

export interface Actividad {
    id: string
    tipo: TipoActividad
    autor: AutorActividad
    creadoHace: string
    agradecimientos: number
    agradecidoPorMi: boolean
    respuestas?: RespuestaActividad[]
    recomendacion?: { anime: AnimeResumen; nota: string; paraMi: boolean }
    invitacion?: { codigoSala: string; nombreSala: string; integrantes: number; candidatoTop?: string }
    busqueda?: {
        pedido: string
        referencia?: string
        referenciasAnimes?: AnimeResumen[]
        generos?: string[]
        tags?: string[]
    }
    encuesta?: { pregunta: string; opciones: OpcionEncuesta[]; miVoto?: string }
    hito?: { titulo: string; descripcion: string; icono: 'trofeo' | 'amistad' | 'estrella' }
}

export interface NuevaRecomendacion {
    anime: AnimeResumen
    nota: string
    destinatarioId: string | null // null = recomendación general para todos; o username de un amigo
    respuestaAId?: string | null // si responde a un post "busco_anime" del tablón
}

const STORAGE_KEY = 'animigos_tablon_feed_v1'

function getLocalFeed(): Actividad[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) return parsed
        }
    } catch {
        // Fallback silencioso
    }
    return []
}

function saveLocalFeed(acts: Actividad[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(acts))
    } catch {
        // Fallback silencioso
    }
}

const TIPOS_POR_FILTRO: Record<FiltroTablon, TipoActividad[] | null> = {
    todo: null,
    mios: null,
    recomendaciones: ['recomendacion_directa', 'recomendacion_general'],
    invitaciones: ['invitacion_sala'],
    publicaciones: ['busco_anime', 'encuesta', 'hito', 'estreno_anime'],
}

export function filtrarActividades(
    actividades: Actividad[],
    filtro: FiltroTablon,
    currentUsername?: string
): Actividad[] {
    if (filtro === 'mios') {
        const cleanUser = (currentUsername || '').trim().toLowerCase()
        if (!cleanUser) return []
        return actividades.filter(
            (a) => (a.autor.usuario || '').trim().toLowerCase() === cleanUser
        )
    }
    const tipos = TIPOS_POR_FILTRO[filtro]
    return tipos ? actividades.filter((a) => tipos.includes(a.tipo)) : actividades
}

const nuevoId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

async function postActivityToServer(
    act: Actividad,
    extra?: { destinatarioId?: string | null; respuestaAId?: string | null }
): Promise<Actividad | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/users/feed/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                ...act,
                destinatarioId: extra?.destinatarioId || null,
                respuestaAId: extra?.respuestaAId || null,
            }),
        })
        if (res.ok) {
            return (await res.json()) as Actividad
        }
    } catch {
        // Fallback local si no hay red
    }
    return null
}

// ---------- API ----------

export async function fetchFeed(): Promise<Actividad[]> {
    const local = getLocalFeed()
    let serverFeed: Actividad[] = []

    try {
        const res = await fetch(`${API_BASE_URL}/users/feed/`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include',
        })
        if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data.results)) {
                serverFeed = data.results
            }
        }
    } catch {
        // Si falla la red, usar local
    }

    const hasSession =
        typeof localStorage !== 'undefined' &&
        Boolean(localStorage.getItem('animigos_session_id') || localStorage.getItem('session_id'))

    // Migrar automáticamente al servidor cualquier post local (act-...) creado previamente en este navegador
    const serverIds = new Set(serverFeed.map((s) => s.id))
    const unsyncedLocal = local.filter(
        (l) => l.id.startsWith('act-') && !serverIds.has(l.id) && l.tipo !== 'estreno_anime'
    )

    if (hasSession && unsyncedLocal.length > 0) {
        for (const item of [...unsyncedLocal].reverse()) {
            const synced = await postActivityToServer(item)
            if (synced && !serverIds.has(synced.id)) {
                serverFeed.unshift(synced)
                serverIds.add(synced.id)
            }
        }
    }

    // Mezclar notificaciones de estrenos / recomendaciones directas
    let notifActs: Actividad[] = []
    if (hasSession) {
        try {
            const { notifications } = await fetchUserNotifications()
            const releaseNotifs = notifications.filter((n) => n.type === 'anime_release' && n.anime_id)
            notifActs = releaseNotifs.map((n) => {
                const timestampSegundos = n.created_at
                    ? Math.floor(new Date(n.created_at).getTime() / 1000)
                    : null
                return {
                    id: `release-${n.id}`,
                    tipo: 'estreno_anime',
                    autor: {
                        id: 'calendario_oficial',
                        nombre: 'Calendario Oficial',
                        usuario: 'estrenos',
                        avatarUrl: '',
                    },
                    creadoHace: timestampSegundos ? haceCuanto(timestampSegundos) : '¡Ya en emisión!',
                    agradecimientos: 0,
                    agradecidoPorMi: false,
                    recomendacion: {
                        anime: {
                            malId: n.anime_id!,
                            titulo: n.anime_title || 'Anime',
                            imagenUrl: n.anime_poster || '',
                            nota: null,
                            generos: [],
                        },
                        nota: n.message,
                        paraMi: true,
                    },
                }
            })
        } catch {
            // Ignorar error de notificaciones
        }
    }

    const combinedMap = new Map<string, Actividad>()
    for (const item of [...notifActs, ...serverFeed, ...local]) {
        if (!combinedMap.has(item.id)) {
            combinedMap.set(item.id, item)
        }
    }

    const merged = Array.from(combinedMap.values())
    saveLocalFeed(merged)
    return merged
}

export async function publicarRecomendacion(
    autor: AutorActividad,
    datos: NuevaRecomendacion
): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(),
        tipo: datos.destinatarioId ? 'recomendacion_directa' : 'recomendacion_general',
        autor,
        creadoHace: 'Ahora mismo',
        agradecimientos: 0,
        agradecidoPorMi: false,
        recomendacion: {
            anime: datos.anime,
            nota: datos.nota,
            paraMi: false,
        },
    }

    const saved = await postActivityToServer(act, {
        destinatarioId: datos.destinatarioId,
        respuestaAId: datos.respuestaAId,
    })
    const finalAct = saved || act

    const feedActual = getLocalFeed()
    const feedConRespuesta = datos.respuestaAId
        ? feedActual.map((item) => {
              if (item.id !== datos.respuestaAId) return item
              const nuevaResp: RespuestaActividad = {
                  id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  autor,
                  nota: datos.nota,
                  anime: datos.anime,
                  creadoHace: 'Ahora mismo',
              }
              return {
                  ...item,
                  respuestas: [nuevaResp, ...(item.respuestas ?? [])],
              }
          })
        : feedActual

    const actualizado = [finalAct, ...feedConRespuesta.filter((x) => x.id !== finalAct.id)]
    saveLocalFeed(actualizado)
    return finalAct
}

export async function publicarBusqueda(
    autor: AutorActividad,
    pedido: string,
    referencia?: string,
    generos?: string[],
    tags?: string[],
    referenciasAnimes?: AnimeResumen[]
): Promise<Actividad> {
    const cleanGeneros = (generos ?? []).map((g) => g.trim()).filter(Boolean)
    const cleanTags = (tags ?? []).map((t) => t.trim()).filter(Boolean)
    const cleanRefs = (referenciasAnimes ?? []).filter((a) => a && a.malId)
    const fallbackRefText =
        referencia ||
        (cleanRefs.length > 0 ? cleanRefs.map((a) => a.titulo).join(', ') : undefined)
    const act: Actividad = {
        id: nuevoId(),
        tipo: 'busco_anime',
        autor,
        creadoHace: 'Ahora mismo',
        agradecimientos: 0,
        agradecidoPorMi: false,
        busqueda: {
            pedido,
            referencia: fallbackRefText,
            referenciasAnimes: cleanRefs.length > 0 ? cleanRefs : undefined,
            generos: cleanGeneros.length > 0 ? cleanGeneros : undefined,
            tags: cleanTags.length > 0 ? cleanTags : undefined,
        },
    }

    const saved = await postActivityToServer(act)
    const finalAct = saved || act

    const feedActual = getLocalFeed()
    const actualizado = [finalAct, ...feedActual.filter((x) => x.id !== finalAct.id)]
    saveLocalFeed(actualizado)
    return finalAct
}

export async function publicarEncuesta(
    autor: AutorActividad,
    pregunta: string,
    opciones: AnimeResumen[]
): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(),
        tipo: 'encuesta',
        autor,
        creadoHace: 'Ahora mismo',
        agradecimientos: 0,
        agradecidoPorMi: false,
        encuesta: {
            pregunta,
            opciones: opciones.map((anime, i) => ({
                id: `o${i + 1}`,
                texto: anime.titulo,
                votos: 0,
                anime,
            })),
        },
    }

    const saved = await postActivityToServer(act)
    const finalAct = saved || act

    const feedActual = getLocalFeed()
    const actualizado = [finalAct, ...feedActual.filter((x) => x.id !== finalAct.id)]
    saveLocalFeed(actualizado)
    return finalAct
}

export async function votarEncuesta(actividadId: string, opcionId: string): Promise<void> {
    try {
        const res = await fetch(
            `${API_BASE_URL}/users/feed/${encodeURIComponent(actividadId)}/vote/`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ opcionId }),
            }
        )
        if (res.ok) {
            const updatedPost = (await res.json()) as Actividad
            const feedActual = getLocalFeed()
            saveLocalFeed(feedActual.map((a) => (a.id === actividadId ? updatedPost : a)))
            return
        }
    } catch {
        // Fallback local
    }

    const feedActual = getLocalFeed()
    const actualizado = feedActual.map((a) => {
        if (a.id !== actividadId || !a.encuesta || a.encuesta.miVoto) return a
        return {
            ...a,
            encuesta: {
                ...a.encuesta,
                miVoto: opcionId,
                opciones: a.encuesta.opciones.map((o) =>
                    o.id === opcionId ? { ...o, votos: o.votos + 1 } : o
                ),
            },
        }
    })
    saveLocalFeed(actualizado)
}

export async function alternarAgradecimiento(actividadId: string): Promise<void> {
    try {
        const res = await fetch(
            `${API_BASE_URL}/users/feed/${encodeURIComponent(actividadId)}/thank/`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
            }
        )
        if (res.ok) {
            const updatedPost = (await res.json()) as Actividad
            const feedActual = getLocalFeed()
            saveLocalFeed(feedActual.map((a) => (a.id === actividadId ? updatedPost : a)))
            return
        }
    } catch {
        // Fallback local
    }

    const feedActual = getLocalFeed()
    const actualizado = feedActual.map((a) =>
        a.id === actividadId
            ? {
                  ...a,
                  agradecidoPorMi: !a.agradecidoPorMi,
                  agradecimientos: a.agradecimientos + (a.agradecidoPorMi ? -1 : 1),
              }
            : a
    )
    saveLocalFeed(actualizado)
}
