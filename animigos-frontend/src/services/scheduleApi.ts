/**
 * Horario de emisión de la semana (GET /api/animes/schedule/).
 * El backend lo obtiene de AniList y lo guarda en caché 30 minutos.
 */

import { aFecha, claveDia } from '../shared/tiempo'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

interface ApiEmision {
    id: number
    anilist_id: number
    mal_id: number | null
    title: string
    title_romaji: string
    image_url: string
    episode: number
    total_episodes: number | null
    airing_at: number
    popularity: number
}

export interface Emision {
    id: number
    malId: number | null
    titulo: string
    tituloRomaji: string
    imagenUrl: string
    episodio: number
    totalEpisodios: number | null
    emiteEn: number // Unix (segundos)
    popularidad: number
}

export interface DiaHorario {
    clave: string
    fecha: Date
    emisiones: Emision[]
}

// Agrupa las emisiones en los 7 días a partir de hoy, en la hora local del usuario
export function agruparPorDia(emisiones: Emision[], hoy = new Date()): DiaHorario[] {
    const dias: DiaHorario[] = Array.from({ length: 7 }, (_, i) => {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i)
        return { clave: claveDia(fecha), fecha, emisiones: [] }
    })
    const porClave = new Map(dias.map((d) => [d.clave, d]))
    for (const e of [...emisiones].sort((a, b) => a.emiteEn - b.emiteEn)) {
        porClave.get(claveDia(aFecha(e.emiteEn)))?.emisiones.push(e)
    }
    return dias
}

// ---------- Próximos lanzamientos (GET /api/animes/upcoming/) ----------

export type FormatoLanzamiento = 'TV' | 'TV_SHORT' | 'ONA' | 'MOVIE' | 'OVA' | 'SPECIAL'

interface ApiLanzamiento {
    id: number
    mal_id: number | null
    title: string
    title_romaji: string
    image_url: string
    format: FormatoLanzamiento
    episodes: number | null
    studio: string | null
    release_date: string // "AAAA-MM-DD"
    popularity: number
}

export interface Lanzamiento {
    id: number
    malId: number | null
    titulo: string
    imagenUrl: string
    formato: FormatoLanzamiento
    episodios: number | null
    estudio: string | null
    fecha: Date // Medianoche local del día de estreno
    popularidad: number
}

export async function fetchUpcoming(): Promise<Lanzamiento[]> {
    const res = await fetch(`${API_BASE_URL}/animes/upcoming/`)
    if (!res.ok) throw new Error('No se pudieron cargar los próximos lanzamientos')
    const datos: ApiLanzamiento[] = await res.json()
    return datos.map((l) => {
        const [anio, mes, dia] = l.release_date.split('-').map(Number)
        return {
            id: l.id,
            malId: l.mal_id,
            titulo: l.title,
            imagenUrl: l.image_url,
            formato: l.format,
            episodios: l.episodes,
            estudio: l.studio,
            fecha: new Date(anio, mes - 1, dia),
            popularidad: l.popularity,
        }
    })
}

export async function fetchSchedule(): Promise<Emision[]> {
    const res = await fetch(`${API_BASE_URL}/animes/schedule/`)
    if (!res.ok) throw new Error('No se pudo cargar el horario de emisión')
    const datos: ApiEmision[] = await res.json()
    return datos.map((e) => ({
        id: e.id,
        malId: e.mal_id,
        titulo: e.title,
        tituloRomaji: e.title_romaji,
        imagenUrl: e.image_url,
        episodio: e.episode,
        totalEpisodios: e.total_episodes,
        emiteEn: e.airing_at,
        popularidad: e.popularity,
    }))
}
