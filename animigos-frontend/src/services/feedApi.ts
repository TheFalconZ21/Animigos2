/**
 * Capa de Datos del Tablón Social (Pilar 1.2 y 2.1 de AGENTS.md).
 * Maneja publicaciones, recomendaciones y encuestas comunitarias reales.
 * Se integra con el sistema de notificaciones y persistencia de usuario.
 */

import { fetchUserNotifications, sendAnimeRecommendationToUser } from './friendsApi'
import { haceCuanto } from '../shared/tiempo'

export type TipoActividad =
    | 'recomendacion_directa'
    | 'recomendacion_general'
    | 'invitacion_sala'
    | 'busco_anime'
    | 'encuesta'
    | 'hito'

export type FiltroTablon = 'todo' | 'recomendaciones' | 'invitaciones' | 'publicaciones'

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
}

export interface Actividad {
    id: string
    tipo: TipoActividad
    autor: AutorActividad
    creadoHace: string
    agradecimientos: number
    agradecidoPorMi: boolean
    recomendacion?: { anime: AnimeResumen; nota: string; paraMi: boolean }
    invitacion?: { codigoSala: string; nombreSala: string; integrantes: number; candidatoTop?: string }
    busqueda?: { pedido: string; referencia?: string }
    encuesta?: { pregunta: string; opciones: OpcionEncuesta[]; miVoto?: string }
    hito?: { titulo: string; descripcion: string; icono: 'trofeo' | 'amistad' | 'estrella' }
}

export interface NuevaRecomendacion {
    anime: AnimeResumen
    nota: string
    destinatarioId: string | null // null = recomendación general para todos; o username de un amigo
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
    recomendaciones: ['recomendacion_directa', 'recomendacion_general'],
    invitaciones: ['invitacion_sala'],
    publicaciones: ['busco_anime', 'encuesta', 'hito'],
}

export function filtrarActividades(actividades: Actividad[], filtro: FiltroTablon): Actividad[] {
    const tipos = TIPOS_POR_FILTRO[filtro]
    return tipos ? actividades.filter((a) => tipos.includes(a.tipo)) : actividades
}

const nuevoId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// ---------- API ----------

export async function fetchFeed(): Promise<Actividad[]> {
    const local = getLocalFeed()

    // Sincronizar recomendaciones directas reales recibidas por el usuario
    try {
        const { notifications } = await fetchUserNotifications()
        const recoNotifs = notifications.filter((n) => n.type === 'anime_recommendation' && n.anime_id)

        const recoActs: Actividad[] = recoNotifs.map((n) => {
            const timestampSegundos = n.created_at ? Math.floor(new Date(n.created_at).getTime() / 1000) : null
            return {
                id: `notif-${n.id}`,
                tipo: 'recomendacion_directa',
                autor: {
                    id: n.from_username,
                    nombre: n.from_display_name || n.from_username,
                    usuario: n.from_username,
                    avatarUrl: n.from_avatar || '',
                },
                creadoHace: timestampSegundos ? haceCuanto(timestampSegundos) : 'Reciente',
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

        const ids = new Set(local.map((a) => a.id))
        const combinado = [...local]
        for (const r of recoActs) {
            if (!ids.has(r.id)) {
                combinado.push(r)
                ids.add(r.id)
            }
        }
        return combinado
    } catch {
        return local
    }
}

export async function publicarRecomendacion(autor: AutorActividad, datos: NuevaRecomendacion): Promise<Actividad> {
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

    // Si se especificó un amigo concreto, enviar la recomendación real al backend
    if (datos.destinatarioId) {
        try {
            await sendAnimeRecommendationToUser(datos.destinatarioId, {
                anime_id: datos.anime.malId,
                message: datos.nota,
            })
        } catch (err) {
            console.warn('No se pudo despachar la notificación al backend:', err)
        }
    }

    const feedActual = getLocalFeed()
    const actualizado = [act, ...feedActual]
    saveLocalFeed(actualizado)
    return act
}

export async function publicarBusqueda(autor: AutorActividad, pedido: string, referencia?: string): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(),
        tipo: 'busco_anime',
        autor,
        creadoHace: 'Ahora mismo',
        agradecimientos: 0,
        agradecidoPorMi: false,
        busqueda: { pedido, referencia: referencia || undefined },
    }
    const feedActual = getLocalFeed()
    const actualizado = [act, ...feedActual]
    saveLocalFeed(actualizado)
    return act
}

export async function publicarEncuesta(autor: AutorActividad, pregunta: string, opciones: string[]): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(),
        tipo: 'encuesta',
        autor,
        creadoHace: 'Ahora mismo',
        agradecimientos: 0,
        agradecidoPorMi: false,
        encuesta: {
            pregunta,
            opciones: opciones.map((texto, i) => ({ id: `o${i + 1}`, texto, votos: 0 })),
        },
    }
    const feedActual = getLocalFeed()
    const actualizado = [act, ...feedActual]
    saveLocalFeed(actualizado)
    return act
}

export async function votarEncuesta(actividadId: string, opcionId: string): Promise<void> {
    const feedActual = getLocalFeed()
    const actualizado = feedActual.map((a) => {
        if (a.id !== actividadId || !a.encuesta || a.encuesta.miVoto) return a
        return {
            ...a,
            encuesta: {
                ...a.encuesta,
                miVoto: opcionId,
                opciones: a.encuesta.opciones.map((o) => (o.id === opcionId ? { ...o, votos: o.votos + 1 } : o)),
            },
        }
    })
    saveLocalFeed(actualizado)
}

export async function alternarAgradecimiento(actividadId: string): Promise<void> {
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
