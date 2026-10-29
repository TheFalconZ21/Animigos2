import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
    Clock,
    CheckCircle,
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
    ArrowUpDown,
    LayoutGrid,
} from 'lucide-react'
import type { FilaLista } from '../mi-lista/mi-lista-data'
import { ESCALA_NOTAS } from '../mi-lista/mi-lista-data'
import { AnimeDetalleDialog } from '../mi-lista/AnimeDetalleDialog'

interface AnimeStatsDashboardProps {
    filas: FilaLista[]
    showStats?: boolean
    canViewList?: boolean
    onViewList?: () => void
    readOnly?: boolean
    onUpdateFila?: (id: string, updates: any) => void
}

type GenreSortField = 'count' | 'meanScore' | 'minutes' | 'weighted'
type ContrastTab = 'hated_enjoyed' | 'loved_didnt' | 'hidden_gems' | 'all'

export const AnimeStatsDashboard: React.FC<AnimeStatsDashboardProps> = ({
    filas,
    showStats = true,
    canViewList = true,
    onViewList,
    readOnly = false,
    onUpdateFila,
}) => {
    const [selectedAnime, setSelectedAnime] = useState<FilaLista | null>(null)
    const favGridRef = useRef<HTMLDivElement | null>(null)
    const [totalRowSlots, setTotalRowSlots] = useState<number>(8)

    // Interacción para Distribución de Notas (tooltip hover en filas 10..1)
    const [hoveredScoreRow, setHoveredScoreRow] = useState<number | null>(null)

    // Interacción para Tabla de Géneros (ordenamiento y expansión)
    const [genreSortBy, setGenreSortBy] = useState<GenreSortField>('count')
    const [genreSortDesc, setGenreSortDesc] = useState<boolean>(true)
    const [expandAllGenres, setExpandAllGenres] = useState<boolean>(false)

    // Interacción para Vitrina de Contrastes y Joyas Ocultas
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
    }, [showStats])

    // 1. Cálculos integrales: Métricas, Distribución de Notas (10..1), Géneros y Contrastes
    const stats = useMemo(() => {
        const totalEntries = filas.length
        const vistos = filas.filter((f) => f.estado === 'visto').length
        const viendo = filas.filter((f) => f.estado === 'viendo').length
        const pendientes = filas.filter((f) => f.estado === 'pendiente').length
        const dropeados = filas.filter((f) => (f as any).estado === 'dropeado').length

        // Minutos calculados: usa duración real del anime si existe (default 24 min)
        const getEntryMinutes = (f: FilaLista) => {
            const epDuration = f.anime.durationMinutes && f.anime.durationMinutes > 0 ? f.anime.durationMinutes : 24
            const eps =
                f.estado === 'visto'
                    ? f.anime.episodes || f.episodiosVistos || 12
                    : f.episodiosVistos || (f.estado === 'viendo' ? 1 : 0)
            return eps * epDuration
        }

        const totalMinutos = filas.reduce((acc, f) => acc + getEntryMinutes(f), 0)
        const totalHoras = Math.round(totalMinutos / 60)
        const totalDias = (totalMinutos / (60 * 24)).toFixed(1)

        // Notas personales otorgadas (1..10)
        const scoredEntries = filas.filter((f) => typeof f.nota === 'number' && f.nota >= 1 && f.nota <= 10)
        const notas = scoredEntries.map((f) => f.nota as number)
        const totalScored = notas.length
        const notaMedia = totalScored > 0 ? notas.reduce((a, b) => a + b, 0) / totalScored : 0
        const notaEscala =
            totalScored > 0
                ? ESCALA_NOTAS[Math.round(notaMedia)] || 'Sin calificación'
                : 'Sin calificaciones'

        // Desviación estándar de las notas (Std Dev)
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
            const cDropeado = matching.filter((f) => (f as any).estado === 'dropeado').length
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
            }
        })
        const maxScoreRowCount = Math.max(1, ...scoreRows.map((r) => r.count))

        // Porcentajes para barra segmentada de estados
        const pctVisto = totalEntries > 0 ? (vistos / totalEntries) * 100 : 0
        const pctViendo = totalEntries > 0 ? (viendo / totalEntries) * 100 : 0
        const pctPendiente = totalEntries > 0 ? (pendientes / totalEntries) * 100 : 0
        const pctDropeado = totalEntries > 0 ? (dropeados / totalEntries) * 100 : 0

        // Animes Favoritos
        const favsMarcados = filas.filter((f) => f.favorito)
        const restantes = [...filas]
            .filter((f) => !f.favorito)
            .sort((a, b) => (b.nota ?? b.anime.score ?? 0) - (a.nota ?? a.anime.score ?? 0))
        const top10 = [...favsMarcados, ...restantes].slice(0, 10)

        // Contrastes con la Comunidad y Joyas Ocultas:
        // 1) "Gustaron personalmente, pero a la mayoría no" (They hated it, I enjoyed it)
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

        // 2) "A la mayoría les gustó, pero personalmente no" (They loved it, I didn't)
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

        // 3) "Animes poco populares que personalmente gustaron" (Hidden Gems)
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

        // 4) Estadísticas por Género (Cantidad, % del total, Nota Media, Tiempo Visto, Ponderada)
        const genreMap = new Map<
            string,
            {
                genre: string
                count: number
                scores: number[]
                minutes: number
            }
        >()

        for (const f of filas) {
            const genresList = Array.isArray(f.anime.genres) && f.anime.genres.length > 0 ? f.anime.genres : ['General']
            const entryMins = getEntryMinutes(f)
            const effectiveScore = typeof f.nota === 'number' && f.nota > 0 ? f.nota : f.anime.score || null

            for (const rawG of genresList) {
                const g = String(rawG).trim()
                if (!g) continue
                const prev = genreMap.get(g) || { genre: g, count: 0, scores: [], minutes: 0 }
                prev.count += 1
                prev.minutes += entryMins
                if (typeof effectiveScore === 'number' && effectiveScore > 0) {
                    prev.scores.push(effectiveScore)
                }
                genreMap.set(g, prev)
            }
        }

        const globalMeanRef = notaMedia > 0 ? notaMedia : 7.5
        const mWeight = 2
        const genreStats = Array.from(genreMap.values()).map((item) => {
            const pctOfList = totalEntries > 0 ? Math.round((item.count / totalEntries) * 100) : 0
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
                days,
                hours,
                weighted,
            }
        })

        return {
            totalEntries,
            vistos,
            viendo,
            pendientes,
            dropeados,
            totalMinutos,
            totalHoras,
            totalDias,
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
            top10,
            theyHatedIEnjoyed,
            theyLovedIDidnt,
            hiddenGems,
            genreStats,
        }
    }, [filas])

    const sortedGenres = useMemo(() => {
        const list = [...stats.genreStats]
        list.sort((a, b) => {
            const valA = a[genreSortBy]
            const valB = b[genreSortBy]
            if (valA !== valB) {
                return genreSortDesc ? valB - valA : valA - valB
            }
            return b.count - a.count
        })
        return list
    }, [stats.genreStats, genreSortBy, genreSortDesc])

    const visibleGenres = expandAllGenres ? sortedGenres : sortedGenres.slice(0, 10)

    const handleToggleGenreSort = (field: GenreSortField) => {
        if (genreSortBy === field) {
            setGenreSortDesc((prev) => !prev)
        } else {
            setGenreSortBy(field)
            setGenreSortDesc(true)
        }
    }

    // Gauge circular SVG (Radio 32, Circunferencia ~201)
    const gaugeRadius = 32
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
        const maxInRow = Math.max(3, Math.min(6, totalRowSlots - 1))
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
                                        className={`perfil-contrast-diff-pill ${
                                            diff >= 0 ? 'is-pos' : 'is-neg'
                                        }`}
                                    >
                                        {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                                    </span>
                                )}
                            </div>

                            {/* Pie de tarjeta idéntico a las referencias (Imágenes 2, 3 y 4) */}
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

    return (
        <div className="perfil-analytics-hub">
            {/* =======================================================================
                BLOQUE 1: VITRINA PERSONAL — ANIMES FAVORITOS (1 FILA RESPONSIVA + VER LISTA)
               ======================================================================= */}
            <div className="perfil-fav-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                        <span className="ml-eyebrow">HALL DE LA FAMA · VITRINA PERSONAL</span>
                        <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-1.5">
                            <Heart size={15} style={{ color: 'var(--perfil-pink)' }} />
                            <span>Animes Favoritos</span>
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
                                        ★ {f.nota ?? f.anime.score}
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

            {/* =======================================================================
                BLOQUE 2: RESUMEN EJECUTIVO DE COLECCIÓN (4 KPIs + ESTADOS DE VISIONADO)
               ======================================================================= */}
            <div className="perfil-metric-grid">
                <div className="perfil-metric-card">
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
                        <div className="perfil-metric-label">~{stats.totalHoras} Horas de Anime</div>
                    </div>
                </div>

                <div className="perfil-metric-card">
                    <div className="perfil-gauge-wrap">
                        <svg width="74" height="74" className="perfil-gauge-svg">
                            <circle cx="37" cy="37" r={gaugeRadius} className="perfil-gauge-bg" />
                            <circle
                                cx="37"
                                cy="37"
                                r={gaugeRadius}
                                className="perfil-gauge-meter"
                                strokeDasharray={circumference}
                                strokeDashoffset={gaugeOffset}
                            />
                        </svg>
                        <span className="perfil-gauge-number">{stats.notaMedia.toFixed(1)}</span>
                    </div>
                    <div>
                        <div className="perfil-metric-value" style={{ fontSize: '1.25rem' }}>
                            {stats.notaEscala}
                        </div>
                        <div className="perfil-metric-label">Nota Media ({stats.totalScored} calif.)</div>
                    </div>
                </div>

                <div className="perfil-metric-card">
                    <div className="perfil-metric-icon" style={{ color: 'var(--perfil-cyan)' }}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <div className="perfil-metric-value">{stats.totalEntries}</div>
                        <div className="perfil-metric-label">Animes en Colección</div>
                    </div>
                </div>

                <div className="perfil-metric-card">
                    <div className="perfil-metric-icon" style={{ color: 'var(--perfil-green)' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <div className="perfil-metric-value">{stats.vistos}</div>
                        <div className="perfil-metric-label">Completados / Vistos</div>
                    </div>
                </div>
            </div>

            <div className="perfil-breakdown-card">
                <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="small fw-semibold text-white d-flex align-items-center gap-2">
                        <TrendingUp size={15} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Distribución de Estados de Visionado</span>
                    </span>
                    <span className="small font-mono text-secondary" style={{ fontSize: '0.75rem' }}>
                        {stats.totalEntries} títulos
                    </span>
                </div>

                {stats.totalEntries > 0 ? (
                    <div className="perfil-breakdown-bar">
                        <div
                            className="perfil-breakdown-seg perfil-seg-visto"
                            style={{ width: `${stats.pctVisto}%` }}
                            title={`Vistos: ${stats.vistos} (${stats.pctVisto.toFixed(0)}%)`}
                        />
                        <div
                            className="perfil-breakdown-seg perfil-seg-viendo"
                            style={{ width: `${stats.pctViendo}%` }}
                            title={`Viendo: ${stats.viendo} (${stats.pctViendo.toFixed(0)}%)`}
                        />
                        <div
                            className="perfil-breakdown-seg perfil-seg-pendiente"
                            style={{ width: `${stats.pctPendiente}%` }}
                            title={`Pendientes: ${stats.pendientes} (${stats.pctPendiente.toFixed(0)}%)`}
                        />
                        {stats.pctDropeado > 0 && (
                            <div
                                className="perfil-breakdown-seg perfil-seg-dropeado"
                                style={{ width: `${stats.pctDropeado}%` }}
                                title={`Dropeados: ${stats.dropeados} (${stats.pctDropeado.toFixed(0)}%)`}
                            />
                        )}
                    </div>
                ) : (
                    <div className="py-2 text-center text-secondary small">
                        Colección vacía. Agrega animes en «Mi Lista» para ver la distribución aquí.
                    </div>
                )}

                <div className="d-flex flex-wrap align-items-center gap-3 pt-1">
                    <div className="perfil-legend-item">
                        <span className="perfil-legend-dot perfil-seg-visto" />
                        <span>
                            Vistos: <strong>{stats.vistos}</strong> ({stats.pctVisto.toFixed(0)}%)
                        </span>
                    </div>
                    <div className="perfil-legend-item">
                        <span className="perfil-legend-dot perfil-seg-viendo" />
                        <span>
                            Viendo: <strong>{stats.viendo}</strong> ({stats.pctViendo.toFixed(0)}%)
                        </span>
                    </div>
                    <div className="perfil-legend-item">
                        <span className="perfil-legend-dot perfil-seg-pendiente" />
                        <span>
                            Pendientes: <strong>{stats.pendientes}</strong> ({stats.pctPendiente.toFixed(0)}%)
                        </span>
                    </div>
                    {stats.dropeados > 0 && (
                        <div className="perfil-legend-item">
                            <span className="perfil-legend-dot perfil-seg-dropeado" />
                            <span>
                                Dropeados: <strong>{stats.dropeados}</strong>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* =======================================================================
                BLOQUE 3: RADIOGRAFÍA ANALÍTICA EN 2 COLUMNAS (NOTAS DADAS + GÉNEROS)
               ======================================================================= */}
            <div className="perfil-analytics-two-col">
                {/* COLUMNA IZQUIERDA: Desglose de Distribución de Notas Dadas (Imagen 1) */}
                <div className="perfil-score-dist-card">
                    <div className="perfil-section-header-line">
                        <div>
                            <span className="ml-eyebrow">HISTOGRAMA DE CALIFICACIONES</span>
                            <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                <BarChart3 size={16} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Distribución de Notas Dadas</span>
                            </h4>
                        </div>
                        <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                            Pasa el cursor por una barra
                        </span>
                    </div>

                    <div className="perfil-score-rows-wrap">
                        {stats.scoreRows.map((row) => {
                            const widthPct =
                                row.count > 0 ? Math.max(4, (row.count / stats.maxScoreRowCount) * 100) : 0
                            const vistoShare = row.count > 0 ? (row.visto / row.count) * 100 : 0
                            const viendoShare = row.count > 0 ? (row.viendo / row.count) * 100 : 0
                            const pendienteShare = row.count > 0 ? (row.pendiente / row.count) * 100 : 0
                            const dropeadoShare = row.count > 0 ? (row.dropeado / row.count) * 100 : 0
                            const isHovered = hoveredScoreRow === row.score

                            return (
                                <div
                                    key={row.score}
                                    className={`perfil-score-row ${isHovered ? 'is-hovered' : ''}`}
                                    onMouseEnter={() => setHoveredScoreRow(row.score)}
                                    onMouseLeave={() => setHoveredScoreRow(null)}
                                >
                                    <span className="perfil-score-num">{row.score}</span>

                                    <div className="perfil-score-bar-track">
                                        {row.count > 0 && (
                                            <div
                                                className="perfil-score-bar-fill"
                                                style={{ width: `${widthPct}%` }}
                                            >
                                                {vistoShare > 0 && (
                                                    <span
                                                        className="perfil-score-seg is-visto"
                                                        style={{ width: `${vistoShare}%` }}
                                                    />
                                                )}
                                                {viendoShare > 0 && (
                                                    <span
                                                        className="perfil-score-seg is-viendo"
                                                        style={{ width: `${viendoShare}%` }}
                                                    />
                                                )}
                                                {pendienteShare > 0 && (
                                                    <span
                                                        className="perfil-score-seg is-pendiente"
                                                        style={{ width: `${pendienteShare}%` }}
                                                    />
                                                )}
                                                {dropeadoShare > 0 && (
                                                    <span
                                                        className="perfil-score-seg is-dropeado"
                                                        style={{ width: `${dropeadoShare}%` }}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Tooltip interactivo estilo MAL (Imagen 1) */}
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

                {/* COLUMNA DERECHA: Desglose de Lista por Género (Imagen 5) */}
                <div className="perfil-genre-table-card">
                    <div className="perfil-section-header-line">
                        <div>
                            <span className="ml-eyebrow">ESTADÍSTICAS POR GÉNERO</span>
                            <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                <Layers size={16} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Cantidad, % del Total, Nota Media y Tiempo por Género</span>
                            </h4>
                        </div>
                        <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                            {sortedGenres.length} géneros registrados
                        </span>
                    </div>

                    {sortedGenres.length === 0 ? (
                        <div className="perfil-contrast-empty my-3">
                            <span>Agrega animes a tu lista para calcular tus métricas por género.</span>
                        </div>
                    ) : (
                        <>
                            <div className="perfil-genre-table-wrap">
                                <table className="perfil-genre-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '36px' }}>#</th>
                                            <th>Género / Temática</th>
                                            <th
                                                className="is-sortable text-end"
                                                onClick={() => handleToggleGenreSort('count')}
                                            >
                                                <span>Cant.</span>
                                                <ArrowUpDown size={11} className="ms-1 opacity-75" />
                                            </th>
                                            <th style={{ minWidth: '130px' }}>% de tu Lista</th>
                                            <th
                                                className="is-sortable text-center"
                                                onClick={() => handleToggleGenreSort('meanScore')}
                                            >
                                                <span>Nota Media</span>
                                                <ArrowUpDown size={11} className="ms-1 opacity-75" />
                                            </th>
                                            <th
                                                className="is-sortable text-center"
                                                onClick={() => handleToggleGenreSort('minutes')}
                                            >
                                                <span>Tiempo Visto</span>
                                                <ArrowUpDown size={11} className="ms-1 opacity-75" />
                                            </th>
                                            <th
                                                className="is-sortable text-end"
                                                onClick={() => handleToggleGenreSort('weighted')}
                                                title="Puntuación ponderada bayesiana según volumen de títulos"
                                            >
                                                <span>Ponderada</span>
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
                                                                style={{
                                                                    width: `${Math.min(100, g.pctOfList)}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="perfil-genre-pct-num">
                                                            {g.pctOfList}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <strong className="text-white">
                                                        {g.meanScore.toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td className="text-center">
                                                    <span
                                                        className="perfil-genre-time"
                                                        title={`${Math.round(g.hours)} horas totales (${g.days.toFixed(1)} días)`}
                                                    >
                                                        {g.days >= 1
                                                            ? `${g.days.toFixed(1)} d`
                                                            : `${Math.max(0.5, g.hours).toFixed(1)} h`}
                                                    </span>
                                                </td>
                                                <td className="text-end text-secondary font-mono">
                                                    {g.weighted.toFixed(2)}
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
                                            <span>Expandir los {sortedGenres.length} géneros</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* =======================================================================
                BLOQUE 4: CONTRASTES CON LA COMUNIDAD & JOYAS OCULTAS (IMÁGENES 2, 3 Y 4)
               ======================================================================= */}
            <div className="perfil-contrasts-card">
                <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-3">
                    <div>
                        <span className="ml-eyebrow">CONTRASTE PERSONAL VS. COMUNIDAD GLOBAL</span>
                        <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                            <Sparkles size={16} style={{ color: 'var(--perfil-acento)' }} />
                            <span>Opiniones a Contramano y Joyas Ocultas</span>
                        </h4>
                    </div>

                    {/* Selector de pestañas para mantener el perfil ordenado */}
                    <div className="perfil-contrast-tabs" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeContrastTab === 'hated_enjoyed'}
                            className={`perfil-contrast-tab ${
                                activeContrastTab === 'hated_enjoyed' ? 'is-active' : ''
                            }`}
                            onClick={() => setActiveContrastTab('hated_enjoyed')}
                        >
                            <Heart size={13} />
                            <span>Me gustaron, a la mayoría no</span>
                            <span className="count">{stats.theyHatedIEnjoyed.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeContrastTab === 'loved_didnt'}
                            className={`perfil-contrast-tab ${
                                activeContrastTab === 'loved_didnt' ? 'is-active' : ''
                            }`}
                            onClick={() => setActiveContrastTab('loved_didnt')}
                        >
                            <HeartCrack size={13} />
                            <span>Gustaron a la mayoría, a mí no</span>
                            <span className="count">{stats.theyLovedIDidnt.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeContrastTab === 'hidden_gems'}
                            className={`perfil-contrast-tab ${
                                activeContrastTab === 'hidden_gems' ? 'is-active' : ''
                            }`}
                            onClick={() => setActiveContrastTab('hidden_gems')}
                        >
                            <Gem size={13} />
                            <span>Joyas Ocultas (Poco populares)</span>
                            <span className="count">{stats.hiddenGems.length}</span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeContrastTab === 'all'}
                            className={`perfil-contrast-tab ${activeContrastTab === 'all' ? 'is-active' : ''}`}
                            onClick={() => setActiveContrastTab('all')}
                            title="Ver las 3 categorías desplegadas al mismo tiempo"
                        >
                            <LayoutGrid size={13} />
                            <span>Ver las 3</span>
                        </button>
                    </div>
                </div>

                {/* Vista según pestaña activa */}
                {(activeContrastTab === 'hated_enjoyed' || activeContrastTab === 'all') && (
                    <div className="perfil-contrast-block">
                        <div className="perfil-contrast-subhead">
                            <span className="title">
                                Animes que personalmente gustaron pero a la mayoría no 🤍
                            </span>
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
                            <span className="title">
                                Animes que a la mayoría les gustó pero personalmente no 💔
                            </span>
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
                            <span className="title">
                                Joyas Ocultas: Animes poco populares que personalmente gustaron 💎
                            </span>
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

            {/* Modal de Detalle al hacer clic en cualquier portada */}
            {selectedAnime && (
                <AnimeDetalleDialog
                    fila={selectedAnime}
                    onCerrar={() => setSelectedAnime(null)}
                    onActualizar={(cambios) => {
                        if (readOnly) return
                        onUpdateFila?.(selectedAnime.id, cambios)
                        setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                    }}
                    onRecomendar={() => {
                        // feedback
                    }}
                />
            )}
        </div>
    )
}
