/**
 * Sistema de Tiers Otaku de Animigos (7 niveles basados en horas vistas).
 * Fuente única de verdad compartida entre Perfil, AnimeTimeWatchedView y Ranking.
 */
import type { FilaLista } from '../components/mi-lista/mi-lista-data'

export interface OtakuTier {
    tier: number
    id: string
    name: string
    emoji: string
    minHours: number
    maxHours: number | null
    color: string
    bg: string
    border: string
    glow?: string
    description: string
    isMax?: boolean
}

export const USER_TIERS: readonly OtakuTier[] = [
    {
        tier: 1,
        id: 'otaku-novato',
        name: 'Otaku Novato',
        emoji: '🌱',
        minHours: 0,
        maxHours: 19,
        color: '#34d399',
        bg: 'rgba(52, 211, 153, 0.14)',
        border: 'rgba(52, 211, 153, 0.42)',
        description: 'Primeros pasos en el mundo del anime (0 – 19 h).',
    },
    {
        tier: 2,
        id: 'otaku-casual',
        name: 'Otaku Casual',
        emoji: '🍜',
        minHours: 20,
        maxHours: 74,
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.14)',
        border: 'rgba(56, 189, 248, 0.44)',
        description: 'Ya tienes varias series favoritas bajo el brazo (20 – 74 h).',
    },
    {
        tier: 3,
        id: 'otaku-comprometido',
        name: 'Otaku Comprometido',
        emoji: '⚡',
        minHours: 75,
        maxHours: 199,
        color: '#60a5fa',
        bg: 'rgba(96, 165, 250, 0.15)',
        border: 'rgba(96, 165, 250, 0.48)',
        description: 'Temporada tras temporada, nunca te pierdes los estrenos (75 – 199 h).',
    },
    {
        tier: 4,
        id: 'otaku-veterano',
        name: 'Otaku Veterano',
        emoji: '🍿',
        minHours: 200,
        maxHours: 499,
        color: '#a78bfa',
        bg: 'rgba(167, 139, 250, 0.16)',
        border: 'rgba(167, 139, 250, 0.5)',
        description: 'Cientos de horas de maratones y clásicos en tu historial (200 – 499 h).',
    },
    {
        tier: 5,
        id: 'otaku-sabio',
        name: 'Otaku Sabio',
        emoji: '📜',
        minHours: 500,
        maxHours: 999,
        color: '#e8508f',
        bg: 'rgba(232, 80, 143, 0.16)',
        border: 'rgba(232, 80, 143, 0.52)',
        description: 'Conoces estudios, directores y joyas ocultas de cada década (500 – 999 h).',
    },
    {
        tier: 6,
        id: 'otaku-legendario',
        name: 'Otaku Legendario',
        emoji: '⚔️',
        minHours: 1000,
        maxHours: 1999,
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.16)',
        border: 'rgba(245, 158, 11, 0.55)',
        glow: '0 0 14px rgba(245, 158, 11, 0.28)',
        description: 'Más de mil horas de anime: una enciclopedia viviente (1,000 – 1,999 h).',
    },
    {
        tier: 7,
        id: 'dios-otaku',
        name: 'Dios Otaku',
        emoji: '👑',
        minHours: 2000,
        maxHours: null,
        color: '#fbbf24',
        bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.24), rgba(232, 80, 143, 0.22), rgba(167, 139, 250, 0.22))',
        border: 'rgba(251, 191, 36, 0.72)',
        glow: '0 0 18px rgba(251, 191, 36, 0.38)',
        description: 'Has trascendido el plano mortal del anime (2,000+ h).',
        isMax: true,
    },
] as const

export function getEntryWatchMinutes(f: FilaLista): number {
    if (f.estado === 'pendiente' || f.estado === 'dropeado' || f.estado === 'esperando') {
        return 0
    }
    const epDuration = f.anime.durationMinutes && f.anime.durationMinutes > 0 ? f.anime.durationMinutes : 24
    const eps =
        f.estado === 'visto'
            ? f.anime.episodes || f.episodiosVistos || 12
            : f.episodiosVistos || (f.estado === 'viendo' ? 1 : 0)
    return Math.max(0, eps) * epDuration
}

export function calculateTotalWatchHours(filas: FilaLista[]): number {
    let totalMinutes = 0
    for (const f of filas) {
        totalMinutes += getEntryWatchMinutes(f)
    }
    return Math.round(totalMinutes / 60)
}

export function getUserTier(hours: number): OtakuTier {
    const safeHours = Math.max(0, Math.floor(Number.isFinite(hours) ? hours : 0))
    for (let i = USER_TIERS.length - 1; i >= 0; i--) {
        if (safeHours >= USER_TIERS[i].minHours) {
            return USER_TIERS[i]
        }
    }
    return USER_TIERS[0]
}

export interface UserTierProgress {
    current: OtakuTier
    next: OtakuTier | null
    hours: number
    hoursToNext: number
    progressPercent: number
}

export function getUserTierProgress(hours: number): UserTierProgress {
    const safeHours = Math.max(0, Math.round(Number.isFinite(hours) ? hours : 0))
    const current = getUserTier(safeHours)
    const nextIdx = USER_TIERS.findIndex((t) => t.tier === current.tier + 1)
    const next = nextIdx >= 0 ? USER_TIERS[nextIdx] : null

    if (!next) {
        return {
            current,
            next: null,
            hours: safeHours,
            hoursToNext: 0,
            progressPercent: 100,
        }
    }

    const span = Math.max(1, next.minHours - current.minHours)
    const gained = Math.max(0, safeHours - current.minHours)
    const progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)))
    const hoursToNext = Math.max(0, next.minHours - safeHours)

    return {
        current,
        next,
        hours: safeHours,
        hoursToNext,
        progressPercent,
    }
}
