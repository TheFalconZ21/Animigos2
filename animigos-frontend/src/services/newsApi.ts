/**
 * Noticias de anime para el Tablón (Anmo Sugoi y Ramen Para Dos).
 * Se piden a nuestro backend (GET /api/news/), que actúa de proxy con caché
 * de 30 minutos: el navegador nunca consulta los sitios externos (AGENTS.md, pilar 4.1).
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export type FuenteNoticia = 'anmo' | 'ramen'

export const NOMBRE_FUENTE: Record<FuenteNoticia, string> = {
    anmo: 'Anmo Sugoi',
    ramen: 'Ramen Para Dos',
}

interface ApiNoticia {
    id: string
    source: FuenteNoticia
    title: string
    summary: string
    link: string
    category: string
    image_url: string | null
    published_at: number | null
}

export interface Noticia {
    id: string
    fuente: FuenteNoticia
    titulo: string
    resumen: string
    enlace: string
    categoria: string
    imagenUrl: string | null
    publicadoEn: number | null // Unix (segundos)
}

export async function fetchNews(): Promise<Noticia[]> {
    const res = await fetch(`${API_BASE_URL}/news/`)
    if (!res.ok) throw new Error('No se pudieron cargar las noticias')
    const datos: ApiNoticia[] = await res.json()
    return datos.map((n) => ({
        id: n.id,
        fuente: n.source,
        titulo: n.title,
        resumen: n.summary,
        enlace: n.link,
        categoria: n.category,
        imagenUrl: n.image_url,
        publicadoEn: n.published_at,
    }))
}
