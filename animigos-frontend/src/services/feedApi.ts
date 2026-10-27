/**
 * Capa de Datos del Tablón Social (Pilar 1.2 de AGENTS.md).
 *
 * TODO backend: todavía no existe un endpoint de feed en Django.
 * Estas funciones trabajan sobre un almacén en memoria con la misma
 * forma que tendrá la API (GET /api/feed/, POST /api/feed/posts/, etc.).
 * Al crear el endpoint, solo hay que reemplazar el cuerpo de cada función
 * por su fetch(); el hook useTablon y los componentes no cambian.
 */

import { MOCK_TOP_ANIMES, MOCK_USER_FRIENDS } from '../data/anime-data'

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
    destinatarioId: string | null // null = recomendación general para todos
}

// ---------- Almacén en memoria (datos de ejemplo) ----------

const amigo = (id: string): AutorActividad => {
    const f = MOCK_USER_FRIENDS.find((x) => x.id === id) ?? MOCK_USER_FRIENDS[0]
    return { id: f.id, nombre: f.name, usuario: f.username.replace(/^@/, ''), avatarUrl: f.avatarUrl }
}

const anime = (malId: number): AnimeResumen => {
    const a = MOCK_TOP_ANIMES.find((x) => x.malId === malId)!
    return { malId: a.malId, titulo: a.title, imagenUrl: a.imageUrl, nota: a.score, generos: a.genres }
}

let almacen: Actividad[] = [
    {
        id: 'act-1', tipo: 'recomendacion_directa', autor: amigo('friend-1'), creadoHace: 'Hace 15 min',
        agradecimientos: 0, agradecidoPorMi: false,
        recomendacion: {
            anime: anime(9253), paraMi: true,
            nota: '¡Sé que te encantan los viajes en el tiempo y los dilemas éticos! Tienes que ver este clásico sí o sí ⏱️',
        },
    },
    {
        id: 'act-2', tipo: 'invitacion_sala', autor: amigo('friend-1'), creadoHace: 'Hace 45 min',
        agradecimientos: 0, agradecidoPorMi: false,
        invitacion: { codigoSala: 'VIERNES', nombreSala: 'Anime de los Viernes 🍿', integrantes: 4, candidatoTop: "Frieren: Beyond Journey's End" },
    },
    {
        id: 'act-3', tipo: 'busco_anime', autor: amigo('friend-3'), creadoHace: 'Hace 1 h',
        agradecimientos: 2, agradecidoPorMi: false,
        busqueda: {
            pedido: '¡Amigos! Busco animes de misterio y suspenso psicológico oscuro parecidos a Monster o Death Note. ¿Qué me recomiendan?',
            referencia: 'Monster / Death Note',
        },
    },
    {
        id: 'act-4', tipo: 'encuesta', autor: amigo('friend-2'), creadoHace: 'Hace 2 h',
        agradecimientos: 1, agradecidoPorMi: false,
        encuesta: {
            pregunta: '¿Qué género deberíamos ver en la próxima maratón del grupo este fin de semana?',
            opciones: [
                { id: 'o1', texto: 'Sci-Fi & Cyberpunk', votos: 5 },
                { id: 'o2', texto: 'Fantasía oscura', votos: 3 },
                { id: 'o3', texto: 'Comedia & Slice of Life', votos: 2 },
            ],
        },
    },
    {
        id: 'act-5', tipo: 'hito', autor: amigo('friend-4'), creadoHace: 'Hace 3 h',
        agradecimientos: 6, agradecidoPorMi: false,
        hito: { titulo: '100 animes completados', descripcion: 'Camila completó su anime número 100 y subió a Nivel Otaku 15.', icono: 'trofeo' },
    },
    {
        id: 'act-6', tipo: 'recomendacion_general', autor: amigo('friend-3'), creadoHace: 'Hace 5 h',
        agradecimientos: 4, agradecidoPorMi: false,
        recomendacion: {
            anime: anime(52991), paraMi: false,
            nota: '¡Recomendación para todos! La animación y la música de esta obra son una verdadera joya 🍃',
        },
    },
    {
        id: 'act-7', tipo: 'hito', autor: amigo('friend-1'), creadoHace: 'Ayer',
        agradecimientos: 1, agradecidoPorMi: false,
        hito: { titulo: '1 año de amigos', descripcion: 'Sofía y tú celebran su primer aniversario como amigos en Animigos.', icono: 'amistad' },
    },
]

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

const nuevoId = () => `act-${Date.now()}`
const copia = () => almacen.map((a) => ({ ...a }))

// ---------- API ----------

export async function fetchFeed(): Promise<Actividad[]> {
    return copia()
}

export async function publicarRecomendacion(autor: AutorActividad, datos: NuevaRecomendacion): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(),
        tipo: datos.destinatarioId ? 'recomendacion_directa' : 'recomendacion_general',
        autor, creadoHace: 'Ahora mismo', agradecimientos: 0, agradecidoPorMi: false,
        recomendacion: { anime: datos.anime, nota: datos.nota, paraMi: false },
    }
    almacen = [act, ...almacen]
    return act
}

export async function publicarBusqueda(autor: AutorActividad, pedido: string, referencia?: string): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(), tipo: 'busco_anime', autor, creadoHace: 'Ahora mismo',
        agradecimientos: 0, agradecidoPorMi: false,
        busqueda: { pedido, referencia: referencia || undefined },
    }
    almacen = [act, ...almacen]
    return act
}

export async function publicarEncuesta(autor: AutorActividad, pregunta: string, opciones: string[]): Promise<Actividad> {
    const act: Actividad = {
        id: nuevoId(), tipo: 'encuesta', autor, creadoHace: 'Ahora mismo',
        agradecimientos: 0, agradecidoPorMi: false,
        encuesta: { pregunta, opciones: opciones.map((texto, i) => ({ id: `o${i + 1}`, texto, votos: 0 })) },
    }
    almacen = [act, ...almacen]
    return act
}

export async function votarEncuesta(actividadId: string, opcionId: string): Promise<void> {
    almacen = almacen.map((a) => {
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
}

export async function alternarAgradecimiento(actividadId: string): Promise<void> {
    almacen = almacen.map((a) =>
        a.id === actividadId
            ? { ...a, agradecidoPorMi: !a.agradecidoPorMi, agradecimientos: a.agradecimientos + (a.agradecidoPorMi ? -1 : 1) }
            : a,
    )
}
