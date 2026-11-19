import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
    Clock,
    Bookmark,
    Heart,
    Layers,
    TrendingUp,
    BookOpen,
    ArrowUpRight,
    BarChart3,
    Sparkles,
    HeartCrack,
    Gem,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    ArrowUpDown,
    LayoutGrid,
    Compass,
    Tag,
    Search,
    PieChart,
    Filter,
    X,
    MousePointerClick,
} from 'lucide-react'
import type { FilaLista } from '../mi-lista/mi-lista-data'
import { ESCALA_NOTAS } from '../mi-lista/mi-lista-data'
import { AnimeDetalleDialog } from '../mi-lista/AnimeDetalleDialog'
import { TasteCorrelationGraph } from '../recomendador/TasteCorrelationGraph'
import { AnimeTimeWatchedView } from './AnimeTimeWatchedView'
import type { TasteAnalyticsResponse } from '../../services/recommenderApi'
import type { ProfileSubView } from './perfil-types'

interface AnimeStatsDashboardProps {
    filas: FilaLista[]
    activeSubView?: ProfileSubView | null
    onSelectSubView?: (view: ProfileSubView | null) => void
    showStats?: boolean
    canViewList?: boolean
    onViewList?: () => void
    readOnly?: boolean
    onUpdateFila?: (id: string, updates: any) => void
    tasteAnalytics?: TasteAnalyticsResponse | null
    loadingAnalytics?: boolean
    accentColor?: string
}

type GenreSortField = 'count' | 'meanScore' | 'minutes' | 'weighted'
type ContrastTab = 'hated_enjoyed' | 'loved_didnt' | 'hidden_gems' | 'all'

function getEntryMinutes(f: FilaLista): number {
    const epDuration = f.anime.durationMinutes && f.anime.durationMinutes > 0 ? f.anime.durationMinutes : 24
    const eps =
        f.estado === 'visto'
            ? f.anime.episodes || f.episodiosVistos || 12
            : f.episodiosVistos || (f.estado === 'viendo' ? 1 : 0)
    return eps * epDuration
}

function getEntryWatchedEpisodes(f: FilaLista): number {
    if (f.estado === 'visto') {
        return f.anime.episodes || f.episodiosVistos || 12
    }
    return f.episodiosVistos || (f.estado === 'viendo' ? 1 : 0)
}

function calculateGenreStatsForFilas(
    filasSubset: FilaLista[],
    totalReference: number,
    globalMeanRef: number
) {
    const genreMap = new Map<
        string,
        {
            genre: string
            count: number
            scores: number[]
            minutes: number
            episodes: number
            animes: Array<{ fila: FilaLista; minutes: number; episodes: number }>
        }
    >()

    for (const f of filasSubset) {
        const genresList = Array.isArray(f.anime.genres) && f.anime.genres.length > 0 ? f.anime.genres : ['General']
        const entryMins = getEntryMinutes(f)
        const entryEps = getEntryWatchedEpisodes(f)
        const effectiveScore = typeof f.nota === 'number' && f.nota > 0 ? f.nota : f.anime.score || null

        for (const rawG of genresList) {
            const g = String(rawG).trim()
            if (!g) continue
            const prev = genreMap.get(g) || {
                genre: g,
                count: 0,
                scores: [],
                minutes: 0,
                episodes: 0,
                animes: [],
            }
            prev.count += 1
            prev.minutes += entryMins
            prev.episodes += entryEps
            prev.animes.push({ fila: f, minutes: entryMins, episodes: entryEps })
            if (typeof effectiveScore === 'number' && effectiveScore > 0) {
                prev.scores.push(effectiveScore)
            }
            genreMap.set(g, prev)
        }
    }

    const mWeight = 2
    return Array.from(genreMap.values()).map((item) => {
        const pctOfList = totalReference > 0 ? Math.round((item.count / totalReference) * 100) : 0
        const gMean =
            item.scores.length > 0
                ? item.scores.reduce((a, b) => a + b, 0) / item.scores.length
                : globalMeanRef
        const v = item.scores.length
        const weighted = (v / (v + mWeight)) * gMean + (mWeight / (v + mWeight)) * globalMeanRef
        const days = item.minutes / (60 * 24)
        const hours = item.minutes / 60

        return {
            genre: item.genre,
            count: item.count,
            pctOfList,
            meanScore: gMean,
            minutes: item.minutes,
            episodes: item.episodes,
            days,
            hours,
            weighted,
            animes: item.animes.sort((a, b) => b.minutes - a.minutes),
        }
    })
}

function calculateTagStatsForFilas(
    filasSubset: FilaLista[],
    totalReference: number,
    globalMeanRef: number
) {
    const tagMap = new Map<
        string,
        {
            name: string
            category: string
            count: number
            scores: number[]
        }
    >()

    for (const f of filasSubset) {
        const effectiveScore = typeof f.nota === 'number' && f.nota > 0 ? f.nota : f.anime.score || null
        const seenInAnime = new Set<string>()

        for (const td of f.anime.tagsData || []) {
            if (!td?.name || td.spoiler) continue
            const tName = td.name.trim()
            if (!tName || seenInAnime.has(tName.toLowerCase())) continue
            seenInAnime.add(tName.toLowerCase())
            const prev = tagMap.get(tName) || {
                name: tName,
                category: td.category || 'Theme',
                count: 0,
                scores: [],
            }
            prev.count += 1
            if (typeof effectiveScore === 'number' && effectiveScore > 0) {
                prev.scores.push(effectiveScore)
            }
            tagMap.set(tName, prev)
        }

        for (const customTag of f.tags || []) {
            const clean = customTag.replace(/^#/, '').trim()
            if (!clean || seenInAnime.has(clean.toLowerCase())) continue
            seenInAnime.add(clean.toLowerCase())
            const prev = tagMap.get(clean) || {
                name: clean,
                category: 'Personal',
                count: 0,
                scores: [],
            }
            prev.count += 1
            if (typeof effectiveScore === 'number' && effectiveScore > 0) {
                prev.scores.push(effectiveScore)
            }
            tagMap.set(clean, prev)
        }
    }

    return Array.from(tagMap.values())
        .map((t) => ({
            name: t.name,
            category: t.category,
            count: t.count,
            pctOfList: totalReference > 0 ? Math.round((t.count / totalReference) * 100) : 0,
            meanScore:
                t.scores.length > 0
                    ? t.scores.reduce((a, b) => a + b, 0) / t.scores.length
                    : globalMeanRef,
        }))
        .sort((a, b) => b.count - a.count || b.meanScore - a.meanScore)
}

export const AnimeStatsDashboard: React.FC<AnimeStatsDashboardProps> = ({
    filas,
    activeSubView = null,
    onSelectSubView,
    showStats = true,
    canViewList = true,
    onViewList,
    readOnly = false,
    onUpdateFila,
    tasteAnalytics = null,
    loadingAnalytics = false,
    accentColor = '#a78bfa',
}) => {
    const [selectedAnime, setSelectedAnime] = useState<FilaLista | null>(null)
    const favGridRef = useRef<HTMLDivElement | null>(null)
    const [totalRowSlots, setTotalRowSlots] = useState<number>(8)

    // Estado para Subvista 2: Cantidad de Animes en Lista (Estados, % Géneros, % Tags)
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'visto' | 'viendo' | 'pendiente' | 'dropeado' | 'esperando'>('all')
    const [hoveredStatus, setHoveredStatus] = useState<string | null>(null)
    const [genreSortBy, setGenreSortBy] = useState<GenreSortField>('count')
    const [genreSortDesc, setGenreSortDesc] = useState<boolean>(true)
    const [expandAllGenres, setExpandAllGenres] = useState<boolean>(false)
    const [tagSearchQuery, setTagSearchQuery] = useState<string>('')
    const [expandAllTags, setExpandAllTags] = useState<boolean>(false)

    // Estado para Subvista 3: Nota Media (Histograma + Contrastes)
    const [hoveredScoreRow, setHoveredScoreRow] = useState<number | null>(null)
    const [selectedScoreFilter, setSelectedScoreFilter] = useState<number | null>(null)
    const [activeContrastTab, setActiveContrastTab] = useState<ContrastTab>('hated_enjoyed')

    useEffect(() => {
        const el = favGridRef.current
        if (!el) return

        const computeSlots = (width: number) => {
            if (!width || width <= 0) return
            const minSlotWidth = 114
            const gap = 14
            const count = Math.max(3, Math.min(9, Math.floor((width + gap) / (minSlotWidth + gap))))
            setTotalRowSlots((prev) => (prev !== count ? count : prev))
        }

        computeSlots(el.clientWidth)

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    computeSlots(entry.contentRect.width)
                }
            })
            observer.observe(el)
            return () => observer.disconnect()
        }
    }, [showStats, activeSubView])

    // =========================================================================
    // 1. CÁLCULOS GENERALES E INTEGRALES DE LA COLECCIÓN
    // =========================================================================
    const stats = useMemo(() => {
        const totalEntries = filas.length
        const vistos = filas.filter((f) => f.estado === 'visto').length
        const viendo = filas.filter((f) => f.estado === 'viendo').length
        const pendientes = filas.filter((f) => f.estado === 'pendiente').length
        const dropeados = filas.filter((f) => f.estado === 'dropeado').length
        const esperando = filas.filter((f) => f.estado === 'esperando').length

        const totalMinutos = filas.reduce((acc, f) => acc + getEntryMinutes(f), 0)
        const totalHoras = Math.round(totalMinutos / 60)
        const totalDias = (totalMinutos / (60 * 24)).toFixed(1)
        const totalEpisodesWatched = filas.reduce((acc, f) => acc + getEntryWatchedEpisodes(f), 0)

        // Notas personales otorgadas (1..10)
        const scoredEntries = filas.filter((f) => typeof f.nota === 'number' && f.nota >= 1 && f.nota <= 10)
        const notas = scoredEntries.map((f) => f.nota as number)
        const totalScored = notas.length
        const notaMedia = totalScored > 0 ? notas.reduce((a, b) => a + b, 0) / totalScored : 0
        const notaEscala =
            totalScored > 0
                ? ESCALA_NOTAS[Math.round(notaMedia)] || 'Sin calificación'
                : 'Sin calificaciones'

        const variance =
            totalScored > 0
                ? notas.reduce((acc, n) => acc + Math.pow(n - notaMedia, 2), 0) / totalScored
                : 0
        const stdDev = Math.sqrt(variance)

        // Distribución de notas del 10 al 1 desglosada por estado
        const scoreRows = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((scoreVal) => {
            const matching = scoredEntries.filter((f) => Math.round(f.nota as number) === scoreVal)
            const cVisto = matching.filter((f) => f.estado === 'visto').length
            const cViendo = matching.filter((f) => f.estado === 'viendo').length
            const cPendiente = matching.filter((f) => f.estado === 'pendiente').length
            const cDropeado = matching.filter((f) => f.estado === 'dropeado').length
            const cEsperando = matching.filter((f) => f.estado === 'esperando').length
            const count = matching.length
            const pctOfScored = totalScored > 0 ? Math.round((count / totalScored) * 100) : 0
            return {
                score: scoreVal,
                label: ESCALA_NOTAS[scoreVal] || '',
                count,
                pctOfScored,
                visto: cVisto,
                viendo: cViendo,
                pendiente: cPendiente,
                dropeado: cDropeado,
                esperando: cEsperando,
                items: matching,
            }
        })
        const maxScoreRowCount = Math.max(1, ...scoreRows.map((r) => r.count))

        const pctVisto = totalEntries > 0 ? (vistos / totalEntries) * 100 : 0
        const pctViendo = totalEntries > 0 ? (viendo / totalEntries) * 100 : 0
        const pctPendiente = totalEntries > 0 ? (pendientes / totalEntries) * 100 : 0
        const pctDropeado = totalEntries > 0 ? (dropeados / totalEntries) * 100 : 0
        const pctEsperando = totalEntries > 0 ? (esperando / totalEntries) * 100 : 0

        // Hall of Fame (Vitrina Personal): Exclusivamente animes vistos o viendo con calificación personal del usuario,
        // ordenados por la nota más alta otorgada por el usuario (desempate por marcado como favorito).
        const top10 = [...filas]
            .filter(
                (f) =>
                    (f.estado === 'visto' || f.estado === 'viendo') &&
                    typeof f.nota === 'number' &&
                    f.nota > 0
            )
            .sort((a, b) => {
                const diff = (b.nota as number) - (a.nota as number)
                if (diff !== 0) return diff
                if (a.favorito !== b.favorito) return b.favorito ? 1 : -1
                return (b.anime.score ?? 0) - (a.anime.score ?? 0)
            })
            .slice(0, 10)

        // Contrastes con la Comunidad y Joyas Ocultas
        const theyHatedIEnjoyed = [...filas]
            .filter((f) => {
                const uScore = f.nota ?? (f.favorito ? 8.5 : null)
                if (uScore === null) return false
                const cScore = f.anime.score || 7.5
                return uScore >= 6 && (uScore > cScore || cScore < 7.6)
            })
            .sort((a, b) => {
                const diffA = (a.nota ?? 8.5) - (a.anime.score || 7.5)
                const diffB = (b.nota ?? 8.5) - (b.anime.score || 7.5)
                return diffB - diffA
            })
            .slice(0, 12)

        const theyLovedIDidnt = [...filas]
            .filter((f) => {
                if (typeof f.nota !== 'number' || f.nota <= 0) return false
                const cScore = f.anime.score || 7.5
                return f.nota < cScore && (f.nota <= 6 || cScore - f.nota >= 0.5)
            })
            .sort((a, b) => {
                const diffA = (a.anime.score || 7.5) - (a.nota as number)
                const diffB = (b.anime.score || 7.5) - (b.nota as number)
                return diffB - diffA
            })
            .slice(0, 12)

        const hiddenGems = [...filas]
            .filter((f) => {
                const uScore = f.nota ?? (f.favorito ? 9 : null)
                return (uScore !== null && uScore >= 7) || f.favorito
            })
            .sort((a, b) => {
                const rankA = a.anime.popularity || a.anime.rank || 1
                const rankB = b.anime.popularity || b.anime.rank || 1
                if (rankB !== rankA) return rankB - rankA
                return (b.nota ?? b.anime.score) - (a.nota ?? a.anime.score)
            })
            .slice(0, 12)

        // Estadísticas por Género y Tags (Cálculo Global)
        const globalMeanRef = notaMedia > 0 ? notaMedia : 7.5
        const genreStats = calculateGenreStatsForFilas(filas, totalEntries, globalMeanRef)
        const tagStats = calculateTagStatsForFilas(filas, totalEntries, globalMeanRef)

        // Género favorito (mayor presencia combinada con ponderación)
        const sortedByFavorite = [...genreStats].sort(
            (a, b) => b.count * b.weighted - a.count * a.weighted
        )
        const favoriteGenre = sortedByFavorite[0] || {
            genre: 'Sin definir',
            count: 0,
            pctOfList: 0,
            meanScore: 0,
            minutes: 0,
            episodes: 0,
            days: 0,
            hours: 0,
            weighted: 0,
            animes: [],
        }

        return {
            totalEntries,
            vistos,
            viendo,
            pendientes,
            dropeados,
            esperando,
            totalMinutos,
            totalHoras,
            totalDias,
            totalEpisodesWatched,
            totalScored,
            notaMedia,
            notaEscala,
            stdDev,
            scoreRows,
            maxScoreRowCount,
            pctVisto,
            pctViendo,
            pctPendiente,
            pctDropeado,
            pctEsperando,
            top10,
            theyHatedIEnjoyed,
            theyLovedIDidnt,
            hiddenGems,
            genreStats,
            favoriteGenre,
            tagStats,
        }
    }, [filas])

    // Subconjuntos reactivos para Subvista 2: Cantidad de Animes en Lista
    const listMetricsFilas = useMemo(() => {
        if (selectedStatusFilter === 'all') return filas
        return filas.filter((f) => f.estado === selectedStatusFilter)
    }, [filas, selectedStatusFilter])

    const listMetricsGenres = useMemo(() => {
        if (selectedStatusFilter === 'all') return stats.genreStats
        return calculateGenreStatsForFilas(
            listMetricsFilas,
            listMetricsFilas.length,
            stats.notaMedia > 0 ? stats.notaMedia : 7.5
        )
    }, [selectedStatusFilter, listMetricsFilas, stats.genreStats, stats.notaMedia])

    const listMetricsTags = useMemo(() => {
        if (selectedStatusFilter === 'all') return stats.tagStats
        return calculateTagStatsForFilas(
            listMetricsFilas,
            listMetricsFilas.length,
            stats.notaMedia > 0 ? stats.notaMedia : 7.5
        )
    }, [selectedStatusFilter, listMetricsFilas, stats.tagStats, stats.notaMedia])

    const sortedGenres = useMemo(() => {
        const list = [...listMetricsGenres]
        list.sort((a, b) => {
            const valA = a[genreSortBy]
            const valB = b[genreSortBy]
            if (valA !== valB) {
                return genreSortDesc ? valB - valA : valA - valB
            }
            return b.count - a.count
        })
        return list
    }, [listMetricsGenres, genreSortBy, genreSortDesc])

    const visibleGenres = expandAllGenres ? sortedGenres : sortedGenres.slice(0, 10)

    const filteredTags = useMemo(() => {
        const q = tagSearchQuery.trim().toLowerCase()
        const base = q
            ? listMetricsTags.filter(
                (t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
            )
            : listMetricsTags
        return expandAllTags ? base : base.slice(0, 10)
    }, [listMetricsTags, tagSearchQuery, expandAllTags])

    const handleToggleGenreSort = (field: GenreSortField) => {
        if (genreSortBy === field) {
            setGenreSortDesc((prev) => !prev)
        } else {
            setGenreSortBy(field)
            setGenreSortDesc(true)
        }
    }

    const gaugeRadius = 28
    const circumference = 2 * Math.PI * gaugeRadius
    const gaugeOffset = circumference - (stats.notaMedia / 10) * circumference

    if (!showStats) {
        return (
            <div className="perfil-breakdown-card text-center py-5">
                <span className="small text-secondary">
                    🔒 Las estadísticas y métricas analíticas de este usuario son privadas.
                </span>
            </div>
        )
    }

    const renderContrastRow = (
        items: FilaLista[],
        mode: 'hated_enjoyed' | 'loved_didnt' | 'hidden_gems',
        emptyText: string
    ) => {
        const maxInRow = activeSubView === 'mean-score' ? 4 : Math.max(3, Math.min(6, totalRowSlots - 1))
        const sliceItems = items.slice(0, maxInRow)

        if (sliceItems.length === 0) {
            return (
                <div className="perfil-contrast-empty">
                    <span>{emptyText}</span>
                </div>
            )
        }

        return (
            <div
                className="perfil-contrast-poster-grid"
                style={{
                    gridTemplateColumns: `repeat(${maxInRow}, minmax(0, 1fr))`,
                }}
            >
                {sliceItems.map((f) => {
                    const userScore = f.nota ?? (f.favorito ? 9 : Math.round(f.anime.score))
                    const commScore = f.anime.score || 7.5
                    const popRank = f.anime.popularity || f.anime.rank || 1
                    const diff = userScore - commScore

                    return (
                        <div
                            key={`${mode}-${f.id || f.malId}`}
                            className="perfil-contrast-item"
                            onClick={() => setSelectedAnime(f)}
                            title={`${f.anime.title} — Haz clic para ver ficha`}
                        >
                            <div className="perfil-contrast-poster-wrap">
                                <img src={f.anime.imageUrl} alt={f.anime.title} loading="lazy" />
                                <div className="perfil-contrast-poster-title-overlay">
                                    <span>{f.anime.title}</span>
                                </div>
                                {mode !== 'hidden_gems' && (
                                    <span
                                        className={`perfil-contrast-diff-pill ${diff >= 0 ? 'is-pos' : 'is-neg'
                                            }`}
                                    >
                                        {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                                    </span>
                                )}
                            </div>

                            <div className="perfil-contrast-meta-bar">
                                {mode === 'hidden_gems' ? (
                                    <span
                                        className="perfil-contrast-meta-left"
                                        title="Posición en ranking / popularidad"
                                    >
                                        # {popRank}
                                    </span>
                                ) : (
                                    <span
                                        className="perfil-contrast-meta-left"
                                        title={`Nota media de la comunidad: ${commScore.toFixed(2)}`}
                                    >
                                        ☆ {commScore.toFixed(2)}
                                    </span>
                                )}

                                <span
                                    className="perfil-contrast-meta-right"
                                    title={`Nota personal otorgada: ${userScore}`}
                                >
                                    ★ {userScore}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    // =========================================================================
    // SUBVISTA 1: TIEMPO CONSUMIDO (CAPÍTULOS, PELÍCULAS, HORAS, DÍAS + BARRAS + DIMENSIONA TU TIEMPO)
    // =========================================================================
    if (activeSubView === 'time-watched') {
        return (
            <div className="perfil-analytics-hub perfil-subview-enter">
                <AnimeTimeWatchedView
                    filas={filas}
                    onSelectAnime={(f) => setSelectedAnime(f)}
                    accentColor={accentColor}
                />

                {selectedAnime && (
                    <AnimeDetalleDialog
                        fila={selectedAnime}
                        onCerrar={() => setSelectedAnime(null)}
                        onActualizar={(cambios) => {
                            if (readOnly) return
                            onUpdateFila?.(selectedAnime.id, cambios)
                            setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                        }}
                        onRecomendar={() => { }}
                    />
                )}
            </div>
        )
    }

    // =========================================================================
    // SUBVISTA 2: CANTIDAD DE ANIMES EN LISTA (ESTADOS + % GÉNEROS + % TAGS)
    // =========================================================================
    if (activeSubView === 'list-metrics') {
        const statusItems = [
            {
                id: 'visto' as const,
                label: 'Completados / Vistos',
                shortLabel: 'Completados',
                count: stats.vistos,
                pct: stats.pctVisto,
                colorHex: '#a855f7',
                colorVar: 'var(--perfil-acento)',
                dotClass: 'perfil-seg-visto',
            },
            {
                id: 'viendo' as const,
                label: 'Viendo Actualmente',
                shortLabel: 'Viendo',
                count: stats.viendo,
                pct: stats.pctViendo,
                colorHex: '#22c55e',
                colorVar: '#22c55e',
                dotClass: 'perfil-seg-viendo',
            },
            {
                id: 'pendiente' as const,
                label: 'Pendientes (Plan to Watch)',
                shortLabel: 'Pendientes',
                count: stats.pendientes,
                pct: stats.pctPendiente,
                colorHex: '#fbbf24',
                colorVar: '#fbbf24',
                dotClass: 'perfil-seg-pendiente',
            },
            {
                id: 'esperando' as const,
                label: 'Esperando Estreno',
                shortLabel: 'Esperando',
                count: stats.esperando,
                pct: stats.pctEsperando,
                colorHex: '#38bdf8',
                colorVar: 'var(--ml-esperando, #38bdf8)',
                dotClass: 'perfil-seg-esperando',
            },
            {
                id: 'dropeado' as const,
                label: 'Dropeados / Abandonados',
                shortLabel: 'Dropeados',
                count: stats.dropeados,
                pct: stats.pctDropeado,
                colorHex: '#f43f5e',
                colorVar: 'var(--perfil-pink)',
                dotClass: 'perfil-seg-dropeado',
            },
        ]

        const statusFilteredFilas =
            selectedStatusFilter === 'all'
                ? []
                : filas.filter((f) => f.estado === selectedStatusFilter)

        const activeStatusItem = hoveredStatus
            ? statusItems.find((s) => s.id === hoveredStatus)
            : selectedStatusFilter !== 'all'
                ? statusItems.find((s) => s.id === selectedStatusFilter)
                : null

        const donutRadius = 64
        const donutCircumference = 2 * Math.PI * donutRadius
        let accumulatedDashOffset = 0
        const donutSlices = statusItems
            .filter((st) => st.count > 0)
            .map((st) => {
                const fraction = stats.totalEntries > 0 ? st.count / stats.totalEntries : 0
                const strokeDash = fraction * donutCircumference
                const strokeDasharray = `${strokeDash} ${donutCircumference - strokeDash}`
                const strokeDashoffset = -accumulatedDashOffset
                accumulatedDashOffset += strokeDash
                return {
                    ...st,
                    fraction,
                    strokeDasharray,
                    strokeDashoffset,
                }
            })

        return (
            <div className="perfil-analytics-hub perfil-subview-enter">
                {/* 1. Distribución de Estados de la Lista en Gráfico de Dona */}
                <div className="perfil-breakdown-card mb-4">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                        <div>
                            <span className="ml-eyebrow">SUBVISTA DEDICADA · COMPOSICIÓN DE COLECCIÓN</span>
                            <h3 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                <PieChart size={18} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Distribución de Estados de Visionado ({stats.totalEntries} Animes)</span>
                            </h3>
                        </div>

                        {canViewList && onViewList && (
                            <button
                                type="button"
                                onClick={onViewList}
                                className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                            >
                                <BookOpen size={14} />
                                <span>Abrir Lista Completa</span>
                            </button>
                        )}
                    </div>

                    <div className="perfil-donut-hub-layout">
                        {/* Columna Izquierda: Gráfico de Dona SVG + Leyenda Interactiva */}
                        <div className="perfil-donut-col">
                            <div className="perfil-donut-wrapper">
                                <svg
                                    viewBox="0 0 180 180"
                                    className="perfil-donut-svg"
                                >
                                    {/* Pista de fondo */}
                                    <circle
                                        cx="90"
                                        cy="90"
                                        r={donutRadius}
                                        fill="transparent"
                                        stroke="rgba(255, 255, 255, 0.05)"
                                        strokeWidth="18"
                                    />

                                    {/* Segmentos interactivos */}
                                    {donutSlices.map((slice) => {
                                        const isSel = selectedStatusFilter === slice.id
                                        const isHov = hoveredStatus === slice.id
                                        const isHighlighted = isSel || isHov
                                        const isDimmed =
                                            (hoveredStatus && hoveredStatus !== slice.id) ||
                                            (!hoveredStatus && selectedStatusFilter !== 'all' && selectedStatusFilter !== slice.id)

                                        return (
                                            <circle
                                                key={slice.id}
                                                cx="90"
                                                cy="90"
                                                r={donutRadius}
                                                fill="transparent"
                                                stroke={slice.colorHex}
                                                strokeWidth={isHighlighted ? 22 : 18}
                                                strokeDasharray={slice.strokeDasharray}
                                                strokeDashoffset={slice.strokeDashoffset}
                                                transform="rotate(-90 90 90)"
                                                style={{
                                                    cursor: 'pointer',
                                                    transition: 'stroke-width 0.2s ease, opacity 0.2s ease, filter 0.2s ease',
                                                    opacity: isDimmed ? 0.35 : 1,
                                                    filter: isHighlighted ? `drop-shadow(0 0 8px ${slice.colorHex}99)` : 'none',
                                                }}
                                                onClick={() =>
                                                    setSelectedStatusFilter((prev) => (prev === slice.id ? 'all' : slice.id))
                                                }
                                                onMouseEnter={() => setHoveredStatus(slice.id)}
                                                onMouseLeave={() => setHoveredStatus(null)}
                                            >
                                                <title>{`${slice.label}: ${slice.count} (${slice.pct.toFixed(1)}%)`}</title>
                                            </circle>
                                        )
                                    })}
                                </svg>

                                {/* Centro de la dona dinámico */}
                                <div className="perfil-donut-center-info">
                                    {activeStatusItem ? (
                                        <>
                                            <span
                                                className="perfil-donut-center-pct"
                                                style={{ color: activeStatusItem.colorHex }}
                                            >
                                                {activeStatusItem.pct.toFixed(0)}%
                                            </span>
                                            <span className="perfil-donut-center-sub">
                                                {activeStatusItem.count} {activeStatusItem.count === 1 ? 'anime' : 'animes'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="perfil-donut-center-val">
                                                {stats.totalEntries}
                                            </span>
                                            <span className="perfil-donut-center-sub">
                                                Total Animes
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Leyenda interactiva debajo de la dona */}
                            <div className="perfil-donut-legend">
                                {statusItems.map((st) => {
                                    const isSel = selectedStatusFilter === st.id
                                    return (
                                        <button
                                            key={st.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedStatusFilter((prev) => (prev === st.id ? 'all' : st.id))
                                            }
                                            onMouseEnter={() => setHoveredStatus(st.id)}
                                            onMouseLeave={() => setHoveredStatus(null)}
                                            className={`perfil-donut-legend-item ${isSel ? 'is-selected' : ''}`}
                                            style={{
                                                borderColor: isSel ? st.colorHex : undefined,
                                                background: isSel ? 'rgba(255, 255, 255, 0.08)' : undefined,
                                            }}
                                        >
                                            <span className={`perfil-legend-dot ${st.dotClass}`} />
                                            <span className="perfil-donut-legend-label">{st.shortLabel}</span>
                                            <span
                                                className="perfil-donut-legend-count font-mono"
                                                style={{ color: st.colorHex }}
                                            >
                                                {st.pct.toFixed(0)}%
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Columna Derecha: Panel Dinámico de Información y Filtros */}
                        <div className="perfil-donut-detail-panel">
                            {selectedStatusFilter === 'all' ? (
                                <>
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <TrendingUp size={16} style={{ color: 'var(--perfil-acento)' }} />
                                            <span className="ml-eyebrow mb-0">RESUMEN GLOBAL DE COLECCIÓN</span>
                                        </div>
                                        <span
                                            className="badge rounded-pill px-2 py-0.5"
                                            style={{
                                                background: 'rgba(168, 85, 247, 0.15)',
                                                color: '#c084fc',
                                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                                fontSize: '0.7rem',
                                            }}
                                        >
                                            Catálogo Completo
                                        </span>
                                    </div>

                                    <div className="d-flex align-items-baseline gap-2 mb-2">
                                        <span className="h2 fw-bold text-white mb-0 font-mono">{stats.totalEntries}</span>
                                        <span className="text-white fw-semibold">Animes Registrados</span>
                                        <span
                                            className="badge rounded-pill px-2.5 py-0.5 ms-auto fw-bold"
                                            style={{
                                                background: 'rgba(168, 85, 247, 0.15)',
                                                color: 'var(--perfil-acento)',
                                                border: '1px solid var(--perfil-acento)',
                                                fontSize: '0.74rem',
                                            }}
                                        >
                                            {stats.vistos} Vistos ({stats.pctVisto.toFixed(0)}%)
                                        </span>
                                    </div>

                                    <div className="perfil-donut-summary-grid">
                                        <div className="perfil-donut-stat-chip">
                                            <span className="perfil-donut-stat-chip-label">
                                                <span className="perfil-legend-dot perfil-seg-viendo" />
                                                <span>Viendo</span>
                                            </span>
                                            <span className="perfil-donut-stat-chip-val" style={{ color: '#22c55e' }}>
                                                {stats.viendo}{' '}
                                                <span className="small text-secondary fw-normal">({stats.pctViendo.toFixed(0)}%)</span>
                                            </span>
                                        </div>
                                        <div className="perfil-donut-stat-chip">
                                            <span className="perfil-donut-stat-chip-label">
                                                <span className="perfil-legend-dot perfil-seg-pendiente" />
                                                <span>Pendientes</span>
                                            </span>
                                            <span className="perfil-donut-stat-chip-val" style={{ color: '#fbbf24' }}>
                                                {stats.pendientes}{' '}
                                                <span className="small text-secondary fw-normal">({stats.pctPendiente.toFixed(0)}%)</span>
                                            </span>
                                        </div>
                                        <div className="perfil-donut-stat-chip">
                                            <span className="perfil-donut-stat-chip-label">
                                                <span className="perfil-legend-dot perfil-seg-esperando" />
                                                <span>Esperando</span>
                                            </span>
                                            <span className="perfil-donut-stat-chip-val" style={{ color: '#38bdf8' }}>
                                                {stats.esperando}{' '}
                                                <span className="small text-secondary fw-normal">({stats.pctEsperando.toFixed(0)}%)</span>
                                            </span>
                                        </div>
                                        <div className="perfil-donut-stat-chip">
                                            <span className="perfil-donut-stat-chip-label">
                                                <span className="perfil-legend-dot perfil-seg-dropeado" />
                                                <span>Dropeados</span>
                                            </span>
                                            <span className="perfil-donut-stat-chip-val" style={{ color: '#f43f5e' }}>
                                                {stats.dropeados}{' '}
                                                <span className="small text-secondary fw-normal">({stats.pctDropeado.toFixed(0)}%)</span>
                                            </span>
                                        </div>
                                        <div className="perfil-donut-stat-chip">
                                            <span className="perfil-donut-stat-chip-label">
                                                <Clock size={12} className="text-secondary" />
                                                <span>Tiempo Visto</span>
                                            </span>
                                            <span className="perfil-donut-stat-chip-val text-white">
                                                {stats.totalDias}d{' '}
                                                <span className="small text-secondary fw-normal">({stats.totalHoras}h)</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        className="mt-3 p-2 rounded-2 d-flex align-items-center gap-2"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.025)',
                                            border: '1px dashed var(--perfil-border)',
                                        }}
                                    >
                                        <MousePointerClick size={14} style={{ color: 'var(--perfil-acento)', flexShrink: 0 }} />
                                        <span className="small text-secondary" style={{ fontSize: '0.73rem' }}>
                                            Haz clic en cualquier segmento de la dona o en la leyenda para filtrar los títulos y recalcular los desgloses de géneros y media tags.
                                        </span>
                                    </div>
                                </>
                            ) : (
                                (() => {
                                    const curStatus = statusItems.find((s) => s.id === selectedStatusFilter)!
                                    return (
                                        <>
                                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span
                                                        className="perfil-legend-dot"
                                                        style={{ background: curStatus.colorHex, width: 10, height: 10 }}
                                                    />
                                                    <span className="fw-bold text-white h6 mb-0">{curStatus.label}</span>
                                                    <span
                                                        className="badge rounded-pill px-2 py-0.5"
                                                        style={{
                                                            background: `${curStatus.colorHex}22`,
                                                            color: curStatus.colorHex,
                                                            border: `1px solid ${curStatus.colorHex}55`,
                                                            fontSize: '0.68rem',
                                                        }}
                                                    >
                                                        Filtro Activo
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedStatusFilter('all')}
                                                    className="ml-btn ml-btn-subtle ml-btn-sm d-inline-flex align-items-center gap-1.5"
                                                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                                >
                                                    <X size={12} />
                                                    <span>Limpiar filtro / Ver todos</span>
                                                </button>
                                            </div>

                                            <div className="d-flex align-items-baseline gap-2 mb-2">
                                                <span
                                                    className="h2 fw-bold mb-0 font-mono"
                                                    style={{ color: curStatus.colorHex }}
                                                >
                                                    {curStatus.count}
                                                </span>
                                                <span className="text-white fw-semibold">
                                                    {curStatus.count === 1 ? 'Anime' : 'Animes'}
                                                </span>
                                                <span className="small text-secondary ms-1">
                                                    ({curStatus.pct.toFixed(1)}% de tu colección)
                                                </span>
                                            </div>

                                            {/* Títulos en este estado */}
                                            {statusFilteredFilas.length > 0 ? (
                                                <div className="mt-1">
                                                    <div
                                                        className="small text-secondary mb-1.5 d-flex align-items-center justify-content-between"
                                                        style={{ fontSize: '0.71rem' }}
                                                    >
                                                        <span>Títulos en este estado ({statusFilteredFilas.length}):</span>
                                                        <span className="opacity-75">Click para ver detalles</span>
                                                    </div>
                                                    <div className="d-flex gap-2 overflow-auto pb-1.5 perfil-thin-scrollbar">
                                                        {statusFilteredFilas.map((f) => (
                                                            <div
                                                                key={f.id}
                                                                onClick={() => setSelectedAnime(f)}
                                                                className="flex-shrink-0 text-center"
                                                                style={{ width: 68, cursor: 'pointer' }}
                                                                title={f.anime.title}
                                                            >
                                                                <img
                                                                    src={f.anime.imageUrl}
                                                                    alt={f.anime.title}
                                                                    style={{
                                                                        width: 68,
                                                                        height: 94,
                                                                        objectFit: 'cover',
                                                                        borderRadius: 6,
                                                                        border: `1px solid rgba(255, 255, 255, 0.1)`,
                                                                    }}
                                                                />
                                                                <div
                                                                    className="small text-white text-truncate mt-1"
                                                                    style={{ fontSize: '0.68rem' }}
                                                                >
                                                                    {f.anime.title}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="small text-secondary py-3">
                                                    No hay títulos en este estado dentro de tu lista.
                                                </div>
                                            )}

                                            <div
                                                className="mt-2.5 pt-2 border-top d-flex align-items-center gap-1.5 small"
                                                style={{
                                                    borderColor: 'rgba(255, 255, 255, 0.06)',
                                                    color: curStatus.colorHex,
                                                    fontSize: '0.73rem',
                                                }}
                                            >
                                                <Filter size={13} style={{ flexShrink: 0 }} />
                                                <span>
                                                    Desgloses inferiores de Géneros y Media Tags recalculados exclusivamente para estos {curStatus.count} animes.
                                                </span>
                                            </div>
                                        </>
                                    )
                                })()
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Desglose de la Lista en % de Géneros y % de Tags */}
                <div className="perfil-analytics-two-col">
                    {/* Columna Izquierda: % de Géneros */}
                    <div className="perfil-genre-table-card">
                        <div className="perfil-section-header-line">
                            <div>
                                <span className="ml-eyebrow d-flex align-items-center gap-1.5">
                                    <span>DESGLOSE POR GÉNEROS</span>
                                    {selectedStatusFilter !== 'all' && (
                                        <span
                                            className="badge rounded-pill px-1.5 py-0.5"
                                            style={{
                                                background: 'var(--perfil-acento-soft)',
                                                color: 'var(--perfil-acento)',
                                                fontSize: '0.62rem',
                                            }}
                                        >
                                            Filtrado: {statusItems.find((s) => s.id === selectedStatusFilter)?.shortLabel}
                                        </span>
                                    )}
                                </span>
                                <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                    <Layers size={16} style={{ color: 'var(--perfil-acento)' }} />
                                    <span>% de Géneros en la Lista</span>
                                </h4>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                {sortedGenres.length} {sortedGenres.length === 1 ? 'género' : 'géneros'}
                            </span>
                        </div>

                        {sortedGenres.length === 0 ? (
                            <div className="perfil-contrast-empty my-3">
                                <span>
                                    {selectedStatusFilter !== 'all'
                                        ? 'No hay títulos en este estado para calcular el % de géneros.'
                                        : 'Agrega animes a tu lista para calcular el % de géneros.'}
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className="perfil-genre-table-wrap">
                                    <table className="perfil-genre-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '32px' }}>#</th>
                                                <th>Género</th>
                                                <th className="is-sortable text-end" onClick={() => handleToggleGenreSort('count')}>
                                                    <span>Cant.</span>
                                                    <ArrowUpDown size={11} className="ms-1 opacity-75" />
                                                </th>
                                                <th style={{ minWidth: '130px' }}>% de Lista</th>
                                                <th className="is-sortable text-center" onClick={() => handleToggleGenreSort('meanScore')}>
                                                    <span>Nota Media</span>
                                                    <ArrowUpDown size={11} className="ms-1 opacity-75" />
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleGenres.map((g, idx) => (
                                                <tr key={g.genre}>
                                                    <td className="text-secondary font-mono">{idx + 1}</td>
                                                    <td>
                                                        <span className="perfil-genre-name">{g.genre}</span>
                                                    </td>
                                                    <td className="text-end">
                                                        <span className="perfil-genre-count">{g.count}</span>
                                                    </td>
                                                    <td>
                                                        <div className="perfil-genre-pct-cell">
                                                            <div className="perfil-genre-pct-bar">
                                                                <div
                                                                    className="perfil-genre-pct-fill"
                                                                    style={{ width: `${Math.min(100, g.pctOfList)}%` }}
                                                                />
                                                            </div>
                                                            <span className="perfil-genre-pct-num">{g.pctOfList}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <strong className="text-white">★ {g.meanScore.toFixed(2)}</strong>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {sortedGenres.length > 10 && (
                                    <button
                                        type="button"
                                        className="perfil-genre-expand-btn"
                                        onClick={() => setExpandAllGenres((prev) => !prev)}
                                    >
                                        {expandAllGenres ? (
                                            <>
                                                <ChevronUp size={14} />
                                                <span>Contraer a Top 10 géneros</span>
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown size={14} />
                                                <span>Ver los {sortedGenres.length} géneros</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Columna Derecha: % de Tags */}
                    <div className="perfil-genre-table-card">
                        <div className="perfil-section-header-line">
                            <div>
                                <span className="ml-eyebrow d-flex align-items-center gap-1.5">
                                    <span>DESGLOSE POR MEDIA TAGS</span>
                                    {selectedStatusFilter !== 'all' && (
                                        <span
                                            className="badge rounded-pill px-1.5 py-0.5"
                                            style={{
                                                background: 'rgba(56, 189, 248, 0.15)',
                                                color: '#38bdf8',
                                                fontSize: '0.62rem',
                                            }}
                                        >
                                            Filtrado: {statusItems.find((s) => s.id === selectedStatusFilter)?.shortLabel}
                                        </span>
                                    )}
                                </span>
                                <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                    <Tag size={16} style={{ color: 'var(--perfil-cyan)' }} />
                                    <span>% de Tags y Temáticas en la Lista</span>
                                </h4>
                            </div>

                            <div className="perfil-friends-filter-input-wrap" style={{ maxWidth: 180 }}>
                                <Search size={13} className="perfil-friends-filter-icon" />
                                <input
                                    type="text"
                                    placeholder="Filtrar tag..."
                                    value={tagSearchQuery}
                                    onChange={(e) => setTagSearchQuery(e.target.value)}
                                    className="perfil-friends-filter-input"
                                />
                            </div>
                        </div>

                        {filteredTags.length === 0 ? (
                            <div className="perfil-contrast-empty my-3">
                                <span>
                                    {selectedStatusFilter !== 'all'
                                        ? 'No se encontraron tags para los animes en este estado.'
                                        : 'No se encontraron tags registrados en los animes de esta lista.'}
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className="perfil-genre-table-wrap">
                                    <table className="perfil-genre-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '32px' }}>#</th>
                                                <th>Tag / Tropo</th>
                                                <th className="text-end">Cant.</th>
                                                <th style={{ minWidth: '130px' }}>% de Lista</th>
                                                <th className="text-center">Nota Media</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTags.map((t, idx) => (
                                                <tr key={t.name}>
                                                    <td className="text-secondary font-mono">{idx + 1}</td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-1.5">
                                                            <span className="perfil-genre-name">{t.name}</span>
                                                            <span className="badge rounded-pill px-1.5 py-0" style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.06)', color: 'var(--perfil-text-dim)' }}>
                                                                {t.category}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="text-end">
                                                        <span className="perfil-genre-count">{t.count}</span>
                                                    </td>
                                                    <td>
                                                        <div className="perfil-genre-pct-cell">
                                                            <div className="perfil-genre-pct-bar">
                                                                <div
                                                                    className="perfil-genre-pct-fill"
                                                                    style={{
                                                                        width: `${Math.min(100, t.pctOfList)}%`,
                                                                        background: 'linear-gradient(90deg, var(--perfil-cyan), var(--perfil-acento))',
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="perfil-genre-pct-num">{t.pctOfList}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <strong className="text-white">★ {t.meanScore.toFixed(2)}</strong>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {listMetricsTags.length > 10 && (
                                    <button
                                        type="button"
                                        className="perfil-genre-expand-btn"
                                        onClick={() => setExpandAllTags((prev) => !prev)}
                                    >
                                        {expandAllTags ? (
                                            <>
                                                <ChevronUp size={14} />
                                                <span>Contraer a Top 10 tags</span>
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown size={14} />
                                                <span>Ver los {listMetricsTags.length} tags detectados</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {selectedAnime && (
                    <AnimeDetalleDialog
                        fila={selectedAnime}
                        onCerrar={() => setSelectedAnime(null)}
                        onActualizar={(cambios) => {
                            if (readOnly) return
                            onUpdateFila?.(selectedAnime.id, cambios)
                            setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                        }}
                        onRecomendar={() => { }}
                    />
                )}
            </div>
        )
    }

    // =========================================================================
    // SUBVISTA 3: NOTA MEDIA (DISTRIBUCIÓN DE NOTAS + CONTRASTES & JOYAS OCULTAS)
    // =========================================================================
    if (activeSubView === 'mean-score') {
        const selectedScoreRowObj = stats.scoreRows.find((r) => r.score === selectedScoreFilter)

        return (
            <div className="perfil-analytics-hub perfil-subview-enter">
                <div className="perfil-mean-score-layout">
                    {/* 1. Histograma Interactivo de Notas Dadas por el Usuario (Columna Izquierda Compacta) */}
                    <div className="perfil-score-dist-card">
                        <div className="perfil-section-header-line">
                            <div>
                                <span className="ml-eyebrow">SUBVISTA DEDICADA · HISTOGRAMA DE CALIFICACIONES</span>
                                <h3 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                    <BarChart3 size={18} style={{ color: 'var(--perfil-acento)' }} />
                                    <span>Distribución de Notas Dadas por el Usuario</span>
                                </h3>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                Haz clic en cualquier nota (10 a 1) para ver los animes con esa puntuación
                            </span>
                        </div>

                        <div className="perfil-score-rows-wrap">
                            {stats.scoreRows.map((row) => {
                                const widthPct =
                                    row.count > 0 ? Math.max(4, (row.count / stats.maxScoreRowCount) * 100) : 0
                                const vistoShare = row.count > 0 ? (row.visto / row.count) * 100 : 0
                                const viendoShare = row.count > 0 ? (row.viendo / row.count) * 100 : 0
                                const pendienteShare = row.count > 0 ? (row.pendiente / row.count) * 100 : 0
                                const esperandoShare = row.count > 0 ? (row.esperando / row.count) * 100 : 0
                                const dropeadoShare = row.count > 0 ? (row.dropeado / row.count) * 100 : 0
                                const isHovered = hoveredScoreRow === row.score
                                const isSelected = selectedScoreFilter === row.score

                                return (
                                    <div
                                        key={row.score}
                                        className={`perfil-score-row ${isHovered || isSelected ? 'is-hovered' : ''}`}
                                        style={{ cursor: row.count > 0 ? 'pointer' : 'default' }}
                                        onMouseEnter={() => setHoveredScoreRow(row.score)}
                                        onMouseLeave={() => setHoveredScoreRow(null)}
                                        onClick={() => {
                                            if (row.count > 0) {
                                                setSelectedScoreFilter(isSelected ? null : row.score)
                                            }
                                        }}
                                    >
                                        <span className="perfil-score-num">{row.score}</span>

                                        <div className="perfil-score-bar-track">
                                            {row.count > 0 && (
                                                <div
                                                    className="perfil-score-bar-fill"
                                                    style={{ width: `${widthPct}%` }}
                                                >
                                                    {vistoShare > 0 && (
                                                        <span className="perfil-score-seg is-visto" style={{ width: `${vistoShare}%` }} />
                                                    )}
                                                    {viendoShare > 0 && (
                                                        <span className="perfil-score-seg is-viendo" style={{ width: `${viendoShare}%` }} />
                                                    )}
                                                    {pendienteShare > 0 && (
                                                        <span className="perfil-score-seg is-pendiente" style={{ width: `${pendienteShare}%` }} />
                                                    )}
                                                    {esperandoShare > 0 && (
                                                        <span className="perfil-score-seg is-esperando" style={{ width: `${esperandoShare}%` }} />
                                                    )}
                                                    {dropeadoShare > 0 && (
                                                        <span className="perfil-score-seg is-dropeado" style={{ width: `${dropeadoShare}%` }} />
                                                    )}
                                                </div>
                                            )}

                                            {isHovered && (
                                                <div className="perfil-score-tooltip">
                                                    <div className="perfil-score-tooltip-title">
                                                        Nota: {row.score} - {row.label}
                                                    </div>
                                                    <div className="perfil-score-tooltip-item">
                                                        <span className="dot is-visto" />
                                                        <span>Completados : {row.visto}</span>
                                                    </div>
                                                    <div className="perfil-score-tooltip-item">
                                                        <span className="dot is-viendo" />
                                                        <span>Viendo : {row.viendo}</span>
                                                    </div>
                                                    <div className="perfil-score-tooltip-item">
                                                        <span className="dot is-pendiente" />
                                                        <span>Pendientes : {row.pendiente}</span>
                                                    </div>
                                                    {row.esperando > 0 && (
                                                        <div className="perfil-score-tooltip-item">
                                                            <span className="dot is-esperando" />
                                                            <span>Esperando : {row.esperando}</span>
                                                        </div>
                                                    )}
                                                    {row.dropeado > 0 && (
                                                        <div className="perfil-score-tooltip-item">
                                                            <span className="dot is-dropeado" />
                                                            <span>Dropeados : {row.dropeado}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="perfil-score-right-stats">
                                            <span className="perfil-score-count">{row.count}</span>
                                            <span className="perfil-score-pct">({row.pctOfScored}%)</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {selectedScoreRowObj && selectedScoreRowObj.items.length > 0 && (
                            <div className="mt-3 pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="small fw-bold text-white">
                                        Animes calificados con ★ {selectedScoreRowObj.score} ({selectedScoreRowObj.label})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedScoreFilter(null)}
                                        className="btn btn-sm p-0 text-secondary small"
                                    >
                                        Limpiar selección
                                    </button>
                                </div>
                                <div className="d-flex gap-2.5 overflow-auto pb-2">
                                    {selectedScoreRowObj.items.map((f) => (
                                        <div
                                            key={f.id}
                                            onClick={() => setSelectedAnime(f)}
                                            className="flex-shrink-0"
                                            style={{ width: 86, cursor: 'pointer' }}
                                        >
                                            <img
                                                src={f.anime.imageUrl}
                                                alt={f.anime.title}
                                                style={{ width: 86, height: 122, objectFit: 'cover', borderRadius: 8 }}
                                            />
                                            <div className="small text-white text-truncate mt-1" style={{ fontSize: '0.72rem' }}>
                                                {f.anime.title}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="perfil-score-dist-footer">
                            <div>
                                <span className="text-secondary">Nota Media:</span>{' '}
                                <strong className="text-white">{stats.notaMedia.toFixed(2)}</strong>
                            </div>
                            <div>
                                <span className="text-secondary">Desv. Estándar:</span>{' '}
                                <strong className="text-white">{stats.stdDev.toFixed(2)}</strong>
                            </div>
                            <div>
                                <span className="text-secondary">Total Notas:</span>{' '}
                                <strong className="text-white">{stats.totalScored}</strong>
                            </div>
                        </div>
                    </div>

                    {/* 2. Selección de Animes de Interés: Contraste con la Comunidad & Joyas Ocultas (Columna Derecha) */}
                    <div className="perfil-contrasts-card">
                        <div className="d-flex flex-column flex-xxl-row align-items-xxl-center justify-content-between gap-2.5 mb-3">
                            <div>
                                <span className="ml-eyebrow">CONTRASTE PERSONAL VS. COMUNIDAD GLOBAL</span>
                                <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                    <Sparkles size={16} style={{ color: 'var(--perfil-acento)' }} />
                                    <span>Selección de Animes de Interés y Joyas Ocultas</span>
                                </h4>
                            </div>

                            <div className="perfil-contrast-tabs" role="tablist">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeContrastTab === 'hated_enjoyed'}
                                    className={`perfil-contrast-tab ${activeContrastTab === 'hated_enjoyed' ? 'is-active' : ''}`}
                                    onClick={() => setActiveContrastTab('hated_enjoyed')}
                                >
                                    <Heart size={13} />
                                    <span>Me gustaron y a la mayoría no</span>
                                    <span className="count">{stats.theyHatedIEnjoyed.length}</span>
                                </button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeContrastTab === 'loved_didnt'}
                                    className={`perfil-contrast-tab ${activeContrastTab === 'loved_didnt' ? 'is-active' : ''}`}
                                    onClick={() => setActiveContrastTab('loved_didnt')}
                                >
                                    <HeartCrack size={13} />
                                    <span>No me gustaron y a la mayoría sí</span>
                                    <span className="count">{stats.theyLovedIDidnt.length}</span>
                                </button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeContrastTab === 'hidden_gems'}
                                    className={`perfil-contrast-tab ${activeContrastTab === 'hidden_gems' ? 'is-active' : ''}`}
                                    onClick={() => setActiveContrastTab('hidden_gems')}
                                >
                                    <Gem size={13} />
                                    <span>Joyas Ocultas</span>
                                    <span className="count">{stats.hiddenGems.length}</span>
                                </button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeContrastTab === 'all'}
                                    className={`perfil-contrast-tab ${activeContrastTab === 'all' ? 'is-active' : ''}`}
                                    onClick={() => setActiveContrastTab('all')}
                                >
                                    <LayoutGrid size={13} />
                                    <span>Ver las 3</span>
                                </button>
                            </div>
                        </div>

                        <div className="perfil-contrast-content-scroll perfil-thin-scrollbar">
                            {(activeContrastTab === 'hated_enjoyed' || activeContrastTab === 'all') && (
                                <div className="perfil-contrast-block">
                                    <div className="perfil-contrast-subhead">
                                        <span className="title">Me gustaron y a la mayoría no 🤍</span>
                                        <span className="legend">☆ Media Comunidad vs. ★ Tu Nota</span>
                                    </div>
                                    {renderContrastRow(
                                        stats.theyHatedIEnjoyed,
                                        'hated_enjoyed',
                                        'Aún no hay animes donde tu calificación supere a la media global de la comunidad (☆ MAL < ★ Tu Nota).'
                                    )}
                                </div>
                            )}

                            {(activeContrastTab === 'loved_didnt' || activeContrastTab === 'all') && (
                                <div className="perfil-contrast-block">
                                    <div className="perfil-contrast-subhead">
                                        <span className="title">No me gustaron y a la mayoría sí 💔</span>
                                        <span className="legend">☆ Media Comunidad vs. ★ Tu Nota</span>
                                    </div>
                                    {renderContrastRow(
                                        stats.theyLovedIDidnt,
                                        'loved_didnt',
                                        'No tienes animes calificados por debajo del consenso de la comunidad (☆ MAL > ★ Tu Nota).'
                                    )}
                                </div>
                            )}

                            {(activeContrastTab === 'hidden_gems' || activeContrastTab === 'all') && (
                                <div className="perfil-contrast-block">
                                    <div className="perfil-contrast-subhead">
                                        <span className="title">Joyas Ocultas: Animes poco populares con alta valoración 💎</span>
                                        <span className="legend"># Ranking / Popularidad vs. ★ Tu Nota</span>
                                    </div>
                                    {renderContrastRow(
                                        stats.hiddenGems,
                                        'hidden_gems',
                                        'Califica con ★ 7 o más tus animes favoritos para descubrir tus joyas ocultas aquí.'
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {selectedAnime && (
                    <AnimeDetalleDialog
                        fila={selectedAnime}
                        onCerrar={() => setSelectedAnime(null)}
                        onActualizar={(cambios) => {
                            if (readOnly) return
                            onUpdateFila?.(selectedAnime.id, cambios)
                            setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                        }}
                        onRecomendar={() => { }}
                    />
                )}
            </div>
        )
    }

    // =========================================================================
    // SUBVISTA 4: GÉNERO FAVORITO (CONEXIONES DE TAGS & SINERGIA DE NOTAS)
    // =========================================================================
    if (activeSubView === 'favorite-genre') {
        return (
            <div className="perfil-analytics-hub perfil-subview-enter">
                {/* Gráfico de Conexiones de Media Tags & Sinergia de Notas */}
                <TasteCorrelationGraph
                    analytics={tasteAnalytics}
                    filas={filas.filter(
                        (f) =>
                            f.estado !== 'pendiente' &&
                            f.estado !== 'dropeado' &&
                            (f.estado === 'visto' || (f.estado === 'viendo' && f.episodiosVistos > 0))
                    )}
                    loading={loadingAnalytics}
                    accentColor={accentColor}
                />

                {selectedAnime && (
                    <AnimeDetalleDialog
                        fila={selectedAnime}
                        onCerrar={() => setSelectedAnime(null)}
                        onActualizar={(cambios) => {
                            if (readOnly) return
                            onUpdateFila?.(selectedAnime.id, cambios)
                            setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                        }}
                        onRecomendar={() => { }}
                    />
                )}
            </div>
        )
    }

    // =========================================================================
    // VISTA PRINCIPAL DEL PERFIL (ORDEN ESTRICTO: 2º FILA DE 4 KPIs + 3º HALL OF FAME)
    // =========================================================================
    return (
        <div className="perfil-analytics-hub">
            {/* =======================================================================
                2º FILA DE 4 KPIs GENERALES CLICKEABLES (ACCESO A SUBVISTAS DEDICADAS)
               ======================================================================= */}
            <div className="perfil-metric-grid">
                {/* KPI 1: Tiempo de anime visto */}
                <div
                    className="perfil-metric-card perfil-kpi-clickable"
                    onClick={() => onSelectSubView?.('time-watched')}
                    role="button"
                    tabIndex={0}
                    title="Haz clic para abrir la subvista de Tiempo de Anime Visto por Género"
                >
                    <div className="d-flex align-items-center gap-3">
                        <div className="perfil-metric-icon" style={{ color: 'var(--perfil-acento)' }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <div className="perfil-metric-value">
                                {stats.totalDias}{' '}
                                <span style={{ fontSize: '0.9rem', color: 'var(--perfil-text-dim)', fontWeight: 600 }}>
                                    días
                                </span>
                            </div>
                            <div className="perfil-metric-label">
                                ~{stats.totalHoras} Horas de Anime Visto
                            </div>
                        </div>
                    </div>
                    <div className="perfil-kpi-drill-footer">
                        <span>Géneros vs. Tiempo consumido</span>
                        <ChevronRight size={14} />
                    </div>
                </div>

                {/* KPI 2: Cantidad de animes en lista */}
                <div
                    className="perfil-metric-card perfil-kpi-clickable"
                    onClick={() => onSelectSubView?.('list-metrics')}
                    role="button"
                    tabIndex={0}
                    title="Haz clic para abrir la subvista de Métricas de Lista (Estados, % Géneros y % Tags)"
                >
                    <div className="d-flex align-items-center gap-3">
                        <div className="perfil-metric-icon" style={{ color: 'var(--perfil-cyan)' }}>
                            <Layers size={20} />
                        </div>
                        <div>
                            <div className="perfil-metric-value">{stats.totalEntries}</div>
                            <div className="perfil-metric-label">
                                Animes en Lista ({stats.vistos} vistos)
                            </div>
                        </div>
                    </div>
                    <div className="perfil-kpi-drill-footer">
                        <span>Estados, % géneros y % tags</span>
                        <ChevronRight size={14} />
                    </div>
                </div>

                {/* KPI 3: Nota media */}
                <div
                    className="perfil-metric-card perfil-kpi-clickable"
                    onClick={() => onSelectSubView?.('mean-score')}
                    role="button"
                    tabIndex={0}
                    title="Haz clic para abrir la subvista de Nota Media, Distribución y Joyas Ocultas"
                >
                    <div className="d-flex align-items-center gap-3">
                        <div className="perfil-gauge-wrap" style={{ width: 64, height: 64 }}>
                            <svg width="64" height="64" className="perfil-gauge-svg">
                                <circle cx="32" cy="32" r={gaugeRadius} className="perfil-gauge-bg" />
                                <circle
                                    cx="32"
                                    cy="32"
                                    r={gaugeRadius}
                                    className="perfil-gauge-meter"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={gaugeOffset}
                                />
                            </svg>
                            <span className="perfil-gauge-number" style={{ fontSize: '0.98rem' }}>
                                {stats.notaMedia.toFixed(1)}
                            </span>
                        </div>
                        <div>
                            <div className="perfil-metric-value" style={{ fontSize: '1.2rem' }}>
                                {stats.notaEscala}
                            </div>
                            <div className="perfil-metric-label">
                                Nota Media ({stats.totalScored} calif.)
                            </div>
                        </div>
                    </div>
                    <div className="perfil-kpi-drill-footer">
                        <span>Notas y joyas ocultas</span>
                        <ChevronRight size={14} />
                    </div>
                </div>

                {/* KPI 4: Género favorito */}
                <div
                    className="perfil-metric-card perfil-kpi-clickable"
                    onClick={() => onSelectSubView?.('favorite-genre')}
                    role="button"
                    tabIndex={0}
                    title="Haz clic para abrir la subvista de Género Favorito, Sinergia de Tags y Tendencias"
                >
                    <div className="d-flex align-items-center gap-3">
                        <div className="perfil-metric-icon" style={{ color: 'var(--perfil-green)' }}>
                            <Compass size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="perfil-metric-value text-truncate" style={{ fontSize: '1.25rem' }}>
                                {stats.favoriteGenre.genre}
                            </div>
                            <div className="perfil-metric-label">
                                Género Favorito ({stats.favoriteGenre.count} títulos)
                            </div>
                        </div>
                    </div>
                    <div className="perfil-kpi-drill-footer">
                        <span>Sinergia y línea temporal</span>
                        <ChevronRight size={14} />
                    </div>
                </div>
            </div>

            {/* =======================================================================
                3º HALL OF FAME DEL USUARIO (ANIMES FAVORITOS CON LA NOTA MÁS ALTA)
               ======================================================================= */}
            <div className="perfil-fav-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                        <span className="ml-eyebrow">HALL OF FAME · VITRINA PERSONAL</span>
                        <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-1.5">
                            <Heart size={15} style={{ color: 'var(--perfil-pink)' }} />
                            <span>Animes Favoritos Mejor Calificados</span>
                        </h4>
                    </div>
                    <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                        Haz clic en una portada para detalles
                    </span>
                </div>

                {(() => {
                    const showViewListBox = Boolean(canViewList && onViewList)
                    const animeSlotsCount = showViewListBox ? Math.max(2, totalRowSlots - 1) : totalRowSlots
                    const visibleFavs = stats.top10.slice(0, animeSlotsCount)
                    const emptySlotsCount = Math.max(0, animeSlotsCount - visibleFavs.length)

                    return (
                        <div
                            ref={favGridRef}
                            className="perfil-fav-grid"
                            style={{
                                gridTemplateColumns: `repeat(${totalRowSlots}, minmax(0, 1fr))`,
                            }}
                        >
                            {visibleFavs.map((f, index) => (
                                <div
                                    key={f.id}
                                    className="perfil-fav-item"
                                    onClick={() => setSelectedAnime(f)}
                                    title={`${f.anime.title} (Rank #${index + 1})`}
                                >
                                    <img src={f.anime.imageUrl} alt={f.anime.title} loading="lazy" />
                                    <span className="perfil-fav-rank">#{index + 1}</span>
                                    <span className="perfil-fav-score">
                                        ★ {f.nota}
                                    </span>
                                </div>
                            ))}

                            {Array.from({ length: emptySlotsCount }).map((_, i) => (
                                <div key={`empty-${i}`} className="perfil-fav-empty">
                                    <Bookmark size={16} />
                                    <span>#{visibleFavs.length + i + 1}</span>
                                </div>
                            ))}

                            {showViewListBox && (
                                <button
                                    type="button"
                                    className="perfil-fav-viewlist-card"
                                    onClick={onViewList}
                                    title={
                                        readOnly
                                            ? 'Visitar la lista de anime de este usuario (Solo lectura)'
                                            : 'Ir a Mi Lista completa'
                                    }
                                >
                                    <div className="perfil-fav-viewlist-icon">
                                        <BookOpen size={20} />
                                    </div>
                                    <span className="perfil-fav-viewlist-label">VER LISTA</span>
                                    <span className="perfil-fav-viewlist-sub">
                                        {stats.totalEntries} {stats.totalEntries === 1 ? 'anime' : 'animes'}
                                    </span>
                                    <ArrowUpRight size={14} className="perfil-fav-viewlist-arrow" />
                                </button>
                            )}
                        </div>
                    )
                })()}
            </div>

            {selectedAnime && (
                <AnimeDetalleDialog
                    fila={selectedAnime}
                    onCerrar={() => setSelectedAnime(null)}
                    onActualizar={(cambios) => {
                        if (readOnly) return
                        onUpdateFila?.(selectedAnime.id, cambios)
                        setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                    }}
                    onRecomendar={() => { }}
                />
            )}
        </div>
    )
}
