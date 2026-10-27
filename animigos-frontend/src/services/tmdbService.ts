/**
 * Servicio Frontend de Integración con TMDB (The Movie Database) x Animigos.
 * Pilar 2.1 (Zero Trust) y Pilar 4.1 (Proxy y Caché Intermedia en Backend).
 */

import type { TmdbMovie, TmdbAnimeRecommendation } from '../components/perfil/perfil-types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

// Catálogo curado fallback por resiliencia de red
const FALLBACK_MOVIES: TmdbMovie[] = [
    {
        id: 27205,
        title: 'El Origen (Inception)',
        originalTitle: 'Inception',
        releaseYear: '2010',
        posterPath: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        genres: ['Ciencia ficción', 'Misterio', 'Acción'],
        overview: 'Un ladrón que roba secretos corporativos mediante tecnología de compartir sueños es contratado para implantar una idea en la mente de un heredero.',
    },
    {
        id: 335984,
        title: 'Blade Runner 2049',
        originalTitle: 'Blade Runner 2049',
        releaseYear: '2017',
        posterPath: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
        genres: ['Ciencia ficción', 'Drama', 'Misterio'],
        overview: 'Treinta años después, un nuevo blade runner descubre un secreto enterrado que podría sumergir a la sociedad en el caos más absoluto.',
    },
    {
        id: 157336,
        title: 'Interestelar (Interstellar)',
        originalTitle: 'Interstellar',
        releaseYear: '2014',
        posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        genres: ['Ciencia ficción', 'Drama', 'Aventura'],
        overview: 'Un grupo de exploradores hace uso de un agujero de gusano para superar las limitaciones de los viajes espaciales y salvar a la humanidad.',
    },
    {
        id: 603,
        title: 'Matrix (The Matrix)',
        originalTitle: 'The Matrix',
        releaseYear: '1999',
        posterPath: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
        genres: ['Acción', 'Ciencia ficción'],
        overview: 'Un hacker informático descubre la verdadera naturaleza de su realidad y su papel en la guerra contra sus controladores que gobiernan el mundo simulado.',
    },
    {
        id: 550,
        title: 'El Club de la Pelea (Fight Club)',
        originalTitle: 'Fight Club',
        releaseYear: '1999',
        posterPath: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        genres: ['Drama', 'Suspense'],
        overview: 'Un oficinista insomne funda un club de peleas clandestino con un fabricante de jabón que desafía los estándares de la sociedad de consumo.',
    },
    {
        id: 155,
        title: 'El Caballero de la Noche (The Dark Knight)',
        originalTitle: 'The Dark Knight',
        releaseYear: '2008',
        posterPath: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        genres: ['Drama', 'Acción', 'Crimen', 'Suspense'],
        overview: 'Batman se enfrenta a su mayor enemigo psicológico, el Joker, quien desata una ola de crimen y caos nihilista en Gotham.',
    },
    {
        id: 438631,
        title: 'Duna (Dune)',
        originalTitle: 'Dune',
        releaseYear: '2021',
        posterPath: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
        genres: ['Ciencia ficción', 'Aventura'],
        overview: 'Paul Atreides viaja al planeta desértico Arrakis, la fuente de la especia más valiosa del universo, enfrentándose a intrigas políticas y bélicas.',
    },
    {
        id: 11324,
        title: 'La Isla Siniestra (Shutter Island)',
        originalTitle: 'Shutter Island',
        releaseYear: '2010',
        posterPath: 'https://image.tmdb.org/t/p/w500/4BgSWFMW2v001ed0bvFvjqYp1eA.jpg',
        genres: ['Drama', 'Suspense', 'Misterio'],
        overview: 'Dos agentes judiciales investigan la misteriosa desaparición de una paciente en un hospital psiquiátrico de máxima seguridad en una isla remota.',
    },
]

export async function searchTmdbMovies(query: string): Promise<TmdbMovie[]> {
    try {
        const res = await fetch(`${API_BASE_URL}/animes/tmdb-search/?q=${encodeURIComponent(query)}`)
        if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
                return data.map((m: any) => ({
                    id: m.id,
                    title: m.title,
                    originalTitle: m.original_title,
                    releaseYear: m.release_year,
                    posterPath: m.poster_path,
                    genres: m.genres || [],
                    overview: m.overview || '',
                    voteAverage: m.vote_average,
                }))
            }
        }
    } catch (e) {
        console.warn('Usando fallback local para búsqueda TMDB:', e)
    }

    // Fallback local
    const q = query.trim().toLowerCase()
    if (!q) return FALLBACK_MOVIES.slice(0, 5)
    return FALLBACK_MOVIES.filter(
        (m) =>
            m.title.toLowerCase().includes(q) ||
            m.originalTitle?.toLowerCase().includes(q) ||
            m.overview.toLowerCase().includes(q)
    )
}

export async function getAnimeRecommendationsFromMovies(
    movies: TmdbMovie[]
): Promise<TmdbAnimeRecommendation[]> {
    if (!movies || movies.length === 0) return []

    try {
        const res = await fetch(`${API_BASE_URL}/animes/tmdb-recommendations/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                movies: movies.map((m) => ({
                    id: m.id,
                    title: m.title,
                    original_title: m.originalTitle,
                    genres: m.genres,
                    overview: m.overview,
                })),
            }),
        })

        if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
                return data.map((r: any) => ({
                    animeId: r.anime_id,
                    animeTitle: r.anime_title,
                    animePoster: r.anime_poster,
                    animeScore: r.anime_score,
                    animeStudio: r.anime_studio,
                    genres: r.genres || [],
                    matchedMovie: r.matched_movie,
                    matchReason: r.match_reason,
                    affinityScore: r.affinity_score,
                }))
            }
        }
    } catch (e) {
        console.warn('Error en recomendación TMDB backend, usando fallback:', e)
    }

    return []
}
