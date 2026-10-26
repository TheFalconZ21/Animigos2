import type { SyntheticEvent } from 'react'
import { MOCK_TOP_ANIMES, type ExtendedAnime } from '../../data/anime-data'

import type { ApiUserListEntry } from '../../services/userListApi'

// ============================================================
// MI LISTA — Tipos, escala de notas y adaptadores de API
// ============================================================

export type EstadoLista = 'visto' | 'viendo' | 'pendiente'

export interface EntradaLista {
    id?: string
    malId: number
    estado: EstadoLista
    nota: number | null        // Puntuación personal 1-10 (null = sin nota)
    episodiosVistos: number
    favorito: boolean
    tags: string[]
    comentario?: string
    carpetaId?: string
}

export interface Carpeta {
    id: string
    nombre: string
}

// Una entrada ya "unida" con los datos del anime
export interface FilaLista extends EntradaLista {
    id: string
    anime: ExtendedAnime
}

export function apiEntryToFila(entry: ApiUserListEntry): FilaLista {
    const rawAnime = entry.anime
    const scoreNum =
        typeof rawAnime.score === 'number'
            ? rawAnime.score
            : rawAnime.score
                ? parseFloat(String(rawAnime.score))
                : 8.0

    const anime: ExtendedAnime = {
        malId: entry.mal_id,
        title: rawAnime.title,
        titleEnglish: rawAnime.title_english,
        titleJapanese: rawAnime.title_japanese,
        imageUrl: rawAnime.image_url,
        score: isNaN(scoreNum) ? 8.0 : scoreNum,
        rank: 1,
        episodes: rawAnime.episodes || 24,
        status: rawAnime.status || 'Finished Airing',
        season: rawAnime.season,
        year: rawAnime.season_year || undefined,
        studio: rawAnime.studio || 'Desconocido',
        genres: rawAnime.genres || [],
        synopsis: rawAnime.synopsis || '',
    }

    return {
        id: entry.id,
        malId: entry.mal_id,
        estado: entry.status,
        nota: entry.score,
        episodiosVistos: entry.episodes_watched,
        favorito: entry.is_favorite,
        tags: entry.tags || [],
        comentario: entry.notes || '',
        carpetaId: entry.folder_id || undefined,
        anime,
    }
}

// Escala estilo MyAnimeList
export const ESCALA_NOTAS: Record<number, string> = {
    10: 'Obra maestra',
    9: 'Excelente',
    8: 'Muy bueno',
    7: 'Bueno',
    6: 'Aceptable',
    5: 'Regular',
    4: 'Malo',
    3: 'Muy malo',
    2: 'Horrible',
    1: 'Atroz',
}

export const ESTADOS: { id: EstadoLista; label: string }[] = [
    { id: 'visto', label: 'Visto' },
    { id: 'viendo', label: 'Viendo' },
    { id: 'pendiente', label: 'Pendiente' },
]

// Color de acento según el género dominante de la lista ("Tema dinámico").
// Los géneros que no están aquí usan el rosa de Animigos.
export const ACENTO_POR_GENERO: Record<string, string> = {
    'Romance': '#f472b6',
    'Acción': '#f97316',
    'Sci-Fi': '#38bdf8',
    'Drama': '#a78bfa',
    'Comedia': '#facc15',
    'Suspenso': '#22c55e',
}
export const ACENTO_POR_DEFECTO = '#e8508f'

export const CARPETAS_INICIALES: Carpeta[] = [
    { id: 'saga-steins-gate', nombre: 'Saga Steins;Gate' },
]

export const LISTA_INICIAL: EntradaLista[] = [
    { malId: 52991, estado: 'visto', nota: 10, episodiosVistos: 28, favorito: true, tags: ['obras-maestras'], comentario: 'Excelente desarrollo de personajes y animación brillante.' },
    { malId: 9253, estado: 'visto', nota: 10, episodiosVistos: 24, favorito: false, tags: ['obras-maestras'], carpetaId: 'saga-steins-gate' },
    { malId: 35180, estado: 'visto', nota: 9, episodiosVistos: 23, favorito: false, tags: [], carpetaId: 'saga-steins-gate' },
    { malId: 5114, estado: 'visto', nota: 9, episodiosVistos: 64, favorito: false, tags: ['obras-maestras'] },
    { malId: 50709, estado: 'viendo', nota: 8, episodiosVistos: 7, favorito: false, tags: ['maratón-viernes'], comentario: 'Ideal para ver con el grupo los viernes.' },
    { malId: 49387, estado: 'visto', nota: 9, episodiosVistos: 24, favorito: false, tags: [] },
    { malId: 50265, estado: 'pendiente', nota: null, episodiosVistos: 0, favorito: false, tags: ['maratón-viernes'] },
]

export const TAGS_INICIALES = ['obras-maestras', 'maratón-viernes', 'para-llorar']

export function buscarAnime(malId: number): ExtendedAnime | undefined {
    return MOCK_TOP_ANIMES.find((a) => a.malId === malId)
}

// El "medio" no viene en los datos: una película tiene 1 episodio
export function medioDe(anime: ExtendedAnime): 'TV' | 'Película' {
    return anime.status === 'Película' || anime.episodes === 1 ? 'Película' : 'TV'
}

// Póster de respaldo cuando la URL de la portada no carga
const POSTER_RESPALDO =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 3'%3E%3Crect width='2' height='3' fill='%2318181f'/%3E%3Ctext x='1' y='1.75' font-size='0.9' text-anchor='middle' fill='%2371717a'%3E%E2%98%85%3C/text%3E%3C/svg%3E"

export function alFallarPoster(e: SyntheticEvent<HTMLImageElement>) {
    if (e.currentTarget.src !== POSTER_RESPALDO) e.currentTarget.src = POSTER_RESPALDO
}

export function promedio(notas: (number | null)[]): number | null {
    const validas = notas.filter((n): n is number => n !== null)
    if (validas.length === 0) return null
    return validas.reduce((a, b) => a + b, 0) / validas.length
}
