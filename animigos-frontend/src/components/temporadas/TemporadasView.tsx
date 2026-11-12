import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Flame,
    Star,
    Layers,
    Tag,
    TrendingUp,
    Tv,
    Snowflake,
    Flower2,
    Sun,
    Leaf
} from 'lucide-react'
import {
    useSeasonsTimelineQuery,
    useSeasonMetricsQuery
} from '../../hooks/useCatalog'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import type { SeasonMetricItem, SeasonTopAnime } from '../../services/catalogApi'
import './temporadas.css'

interface TemporadasViewProps {
    onNavigateToCatalog: (filters: {
        year?: number
        season?: string
        genre?: string
        ordering?: string
    }) => void
    onOpenAnimeDetail?: (malId: number) => void
}

type WindowStage = 'timeline' | 'year' | 'season'

const SEASON_THEMES: Record<string, {
    name: string
    icon: React.ReactNode
    accentColor: string
    gradient: string
    glowColor: string
}> = {
    Winter: {
        name: 'Invierno',
        icon: <Snowflake size={22} className="season-ico-winter" />,
        accentColor: '#38bdf8',
        gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(14, 165, 233, 0.04) 100%)',
        glowColor: 'rgba(56, 189, 248, 0.4)'
    },
    Spring: {
        name: 'Primavera',
        icon: <Flower2 size={22} className="season-ico-spring" />,
        accentColor: '#f472b6',
        gradient: 'linear-gradient(135deg, rgba(244, 114, 182, 0.22) 0%, rgba(236, 72, 153, 0.04) 100%)',
        glowColor: 'rgba(244, 114, 182, 0.4)'
    },
    Summer: {
        name: 'Verano',
        icon: <Sun size={22} className="season-ico-summer" />,
        accentColor: '#fbbf24',
        gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.22) 0%, rgba(245, 158, 11, 0.04) 100%)',
        glowColor: 'rgba(251, 191, 36, 0.4)'
    },
    Fall: {
        name: 'Otoño',
        icon: <Leaf size={22} className="season-ico-fall" />,
        accentColor: '#fb923c',
        gradient: 'linear-gradient(135deg, rgba(251, 146, 60, 0.22) 0%, rgba(234, 88, 12, 0.04) 100%)',
        glowColor: 'rgba(251, 146, 60, 0.4)'
    }
}

/**
 * Genera curva Catmull-Rom para graficar el histórico de notas medias en el fondo del scrubber
 */
function generateSvgCurve(points: { x: number; y: number }[], bottomY = 150): { pathD: string; areaD: string } {
    if (points.length === 0) return { pathD: '', areaD: '' }
    if (points.length === 1) return { pathD: `M ${points[0].x} ${points[0].y}`, areaD: '' }

    let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1]

        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6

        pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }

    const first = points[0]
    const last = points[points.length - 1]
    const areaD = `${pathD} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`

    return { pathD, areaD }
}

export const TemporadasView: React.FC<TemporadasViewProps> = ({
    onNavigateToCatalog,
    onOpenAnimeDetail
}) => {
    const { acento } = useThemeAccent()

    // Línea de tiempo de años (de pasado a futuro: izquierda a derecha)
    const { data: rawTimeline = [], isLoading: isLoadingTimeline } = useSeasonsTimelineQuery()

    // Ordenar de menor a mayor (izquierda = pasado, derecha = futuro)
    const timeline = useMemo(() => {
        return [...rawTimeline].sort((a, b) => a.year - b.year)
    }, [rawTimeline])

    // Estado de ventanas separadas (timeline -> year -> season)
    const [currentStage, setCurrentStage] = useState<WindowStage>('timeline')
    const [selectedYear, setSelectedYear] = useState<number>(2024)
    const [selectedSeasonKey, setSelectedSeasonKey] = useState<string | null>(null)
    const [isTransitioning, setIsTransitioning] = useState(false)

    // Estados de interacción fluida, fisheye y zona de perdón
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [selectingYear, setSelectingYear] = useState<number | null>(null)
    const rulerTrackRef = useRef<HTMLDivElement | null>(null)

    // Estados para rotación de animes populares (1 o 2 a la vez cada 3.5s con fade)
    const [slideIndex, setSlideIndex] = useState(0)
    const [isSlideFading, setIsSlideFading] = useState(false)

    // Métricas del año seleccionado
    const { data: yearMetrics, isLoading: isLoadingMetrics } = useSeasonMetricsQuery(selectedYear)

    // Cálculo del gráfico de fondo de notas medias y punto focal activo
    const chartData = useMemo(() => {
        if (!timeline.length) return { points: [], pathD: '', areaD: '', activePoint: null }
        const validScores = timeline.map(t => t.avg_score).filter(s => s > 0)
        const minS = validScores.length ? Math.min(...validScores) - 0.2 : 5.0
        const maxS = validScores.length ? Math.max(...validScores) + 0.2 : 9.0
        const range = Math.max(0.4, maxS - minS)

        const points = timeline.map((item, i) => {
            const x = (i / Math.max(1, timeline.length - 1)) * 1000
            const score = item.avg_score > 0 ? item.avg_score : (minS + range * 0.3)
            // Curva fluida y expresiva: de y=26 hasta y=130 (amplitud de 104px en viewBox 150)
            const y = 130 - ((score - minS) / range) * 104
            return { x, y, score: item.avg_score, year: item.year }
        })

        const { pathD, areaD } = generateSvgCurve(points, 150)

        // Determinar año activo exclusivamente si el usuario está interactuando con el cursor (por defecto deseleccionado)
        const targetYear = hoveredIndex !== null ? timeline[hoveredIndex]?.year : null
        const activePoint = targetYear !== null ? (points.find(p => p.year === targetYear) || null) : null

        return { points, pathD, areaD, activePoint }
    }, [timeline, hoveredIndex])

    // Seguimiento del cursor fluido año a año sin saltos de 2 años
    const handleMouseMoveTrack = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!rulerTrackRef.current || timeline.length === 0) return

        // 1. Detección directa del slot DOM para respetar exactamente los límites del hover
        const target = (e.target as HTMLElement).closest('.ruler-slot') as HTMLElement | null
        if (target && target.dataset.year) {
            const year = parseInt(target.dataset.year, 10)
            const idx = timeline.findIndex(t => t.year === year)
            if (idx !== -1) {
                if (idx !== hoveredIndex) {
                    setHoveredIndex(idx)
                }
                return
            }
        }

        // 2. Mapeo continuo 1 a 1 si el cursor está en el área adyacente o pista general
        const rect = rulerTrackRef.current.getBoundingClientRect()
        const relX = e.clientX - rect.left
        const totalW = rect.width
        const N = timeline.length

        const rawIdx = Math.round((relX / totalW) * (N - 1))
        const clampedIdx = Math.max(0, Math.min(N - 1, rawIdx))
        if (clampedIdx !== hoveredIndex) {
            setHoveredIndex(clampedIdx)
        }
    }

    const handleMouseLeaveTrack = () => {
        setHoveredIndex(null)
    }

    // Transición suave entre ventanas independientes con feedback hático visual
    const changeStage = (newStage: WindowStage, year?: number, seasonKey?: string | null) => {
        setIsTransitioning(true)
        if (year !== undefined) setSelectedYear(year)
        if (seasonKey !== undefined) setSelectedSeasonKey(seasonKey)

        setTimeout(() => {
            setCurrentStage(newStage)
            setIsTransitioning(false)
        }, 160)
    }

    const handleSelectYearLine = (year: number) => {
        // Feedback visual inmediato en la línea seleccionada
        setSelectingYear(year)
        setTimeout(() => {
            setSelectingYear(null)
            changeStage('year', year, null)
        }, 220)
    }

    const handleSelectSeason = (seasonKey: string) => {
        changeStage('season', undefined, seasonKey)
    }

    const handleBackToTimeline = () => {
        changeStage('timeline')
    }

    const handleBackToYear = () => {
        changeStage('year', undefined, null)
    }

    const activeSeasonData: SeasonMetricItem | null = useMemo(() => {
        if (!yearMetrics?.seasons || !selectedSeasonKey) return null
        return yearMetrics.seasons[selectedSeasonKey] || null
    }, [yearMetrics, selectedSeasonKey])

    // Año activo para mostrar su galería de animes populares
    const activeYearItem = hoveredIndex !== null ? timeline[hoveredIndex] : null

    // Rotación automática de animes populares (1 o 2 a la vez) cada 3.5 segundos con fade in/out
    useEffect(() => {
        setSlideIndex(0)
        setIsSlideFading(false)
    }, [activeYearItem?.year])

    useEffect(() => {
        if (!activeYearItem?.top_popular || activeYearItem.top_popular.length <= 2) return

        const interval = setInterval(() => {
            setIsSlideFading(true)
            setTimeout(() => {
                setSlideIndex((prev) => {
                    const total = activeYearItem.top_popular!.length
                    return (prev + 2) >= total ? 0 : prev + 2
                })
                setIsSlideFading(false)
            }, 300)
        }, 3500)

        return () => clearInterval(interval)
    }, [activeYearItem?.year, activeYearItem?.top_popular])

    // Pareja actual de animes (1 o 2) a mostrar en gran tamaño
    const currentSpotlightAnimes = useMemo(() => {
        if (!activeYearItem?.top_popular || activeYearItem.top_popular.length === 0) return []
        return activeYearItem.top_popular.slice(slideIndex, slideIndex + 2)
    }, [activeYearItem, slideIndex])

    return (
        <div
            className="temporadas-window-app"
            style={{ '--temp-acento': acento } as React.CSSProperties}
        >
            {/* ============================================================== */}
            {/* VENTANA 1: LÍNEA TEMPORAL MINIMALISTA (STAGE: 'timeline')      */}
            {/* ============================================================== */}
            {currentStage === 'timeline' && (
                <div className={`window-pane timeline-window-pane ${isTransitioning ? 'pane-fade-out' : 'pane-fade-in'}`}>
                    <div className="timeline-hero-section">
                        <h1 className="timeline-main-title">Línea de Tiempo</h1>
                    </div>

                    {/* Regla Temporal Minimalista de Pantalla Completa con Gráfico de Fondo */}
                    <div className="minimal-ruler-outer">
                        {/* Fondo de Animes que se propaga por toda la card contenedora */}
                        <div className={`minimal-ruler-bg-showcase ${activeYearItem && currentSpotlightAnimes.length ? 'showcase-active' : ''}`}>
                            {activeYearItem && currentSpotlightAnimes.length > 0 && (
                                <div
                                    className={`popular-cinematic-grid ${isSlideFading ? 'slide-fading-out' : 'slide-fading-in'}`}
                                    key={`${activeYearItem.year}-${slideIndex}`}
                                >
                                    {currentSpotlightAnimes.map((anime, idx) => {
                                        const displayImg = anime.banner_url || anime.image_url
                                        const isLeft = idx === 0 && currentSpotlightAnimes.length > 1
                                        const isRight = idx === 1
                                        // Intercalado dinámico por ciclo:
                                        // Ciclo 0 (par): Izquierda baja (pan-down), Derecha sube (pan-up)
                                        // Ciclo 1 (impar): Izquierda sube (pan-up), Derecha baja (pan-down)
                                        const cycle = Math.floor(slideIndex / 2)
                                        const isCycleEven = cycle % 2 === 0
                                        const leftPanClass = isCycleEven ? 'pan-down' : 'pan-up'
                                        const rightPanClass = isCycleEven ? 'pan-up' : 'pan-down'
                                        const panClass = isRight ? rightPanClass : leftPanClass
                                        return (
                                            <div
                                                key={anime.mal_id}
                                                className={`popular-bg-panel ${isLeft ? 'panel-left' : ''} ${isRight ? 'panel-right' : ''}`}
                                            >
                                                <img
                                                    src={displayImg}
                                                    alt={anime.title}
                                                    className={`popular-pure-img ${panClass}`}
                                                    loading="lazy"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Overlay permanente para mantener contraste perfecto del gráfico superior y de la línea de tiempo */}
                        <div className="minimal-ruler-contrast-overlay" />

                        <div className="ruler-direction-hints">
                            <span className="direction-label left-label">
                                <ChevronLeft size={14} /> Pasado (1960)
                            </span>
                            <span className="direction-center-note">
                                Explora temporadas pasadas y descubre joyas ocultas
                            </span>
                            <span className="direction-label right-label">
                                Futuro (2026) <ChevronRight size={14} />
                            </span>
                        </div>

                        <div className="full-ruler-track-wrapper">
                            {/* Gráfico de Líneas con Gran Amplitud y Alto Contraste */}
                            <svg
                                className="timeline-bg-chart-svg"
                                viewBox="0 0 1000 150"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <defs>
                                    <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={acento} stopOpacity="0.32" />
                                        <stop offset="65%" stopColor={acento} stopOpacity="0.08" />
                                        <stop offset="100%" stopColor={acento} stopOpacity="0.0" />
                                    </linearGradient>
                                    <filter id="neonPointGlow" x="-30%" y="-30%" width="160%" height="160%">
                                        <feGaussianBlur stdDeviation="3.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>

                                {/* Área bajo la curva */}
                                {chartData.areaD && (
                                    <path d={chartData.areaD} fill="url(#scoreAreaGradient)" />
                                )}

                                {/* Línea del histórico de notas con alto contraste y sombra suave */}
                                {chartData.pathD && (
                                    <path
                                        d={chartData.pathD}
                                        fill="none"
                                        stroke="rgba(255, 255, 255, 0.35)"
                                        strokeWidth="2.2"
                                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.95))' }}
                                    />
                                )}

                                {/* Puntos no relativos al año seleccionado */}
                                {chartData.points.map((p) => (
                                    <circle
                                        key={p.year}
                                        cx={p.x}
                                        cy={p.y}
                                        r="1.8"
                                        fill="rgba(255, 255, 255, 0.3)"
                                    />
                                ))}

                                {/* AÑO CORRESPONDIENTE AL SELECCIONADO: ILUMINADO */}
                                {chartData.activePoint && (
                                    <g className="chart-active-glow-group">
                                        {/* Rayo vertical guía hacia la regla */}
                                        <line
                                            x1={chartData.activePoint.x}
                                            y1={chartData.activePoint.y}
                                            x2={chartData.activePoint.x}
                                            y2="150"
                                            stroke={acento}
                                            strokeOpacity="0.65"
                                            strokeWidth="1.5"
                                            strokeDasharray="3 3"
                                        />

                                        {/* Halo pulsante del punto del año activo */}
                                        <circle
                                            cx={chartData.activePoint.x}
                                            cy={chartData.activePoint.y}
                                            r="8"
                                            fill={acento}
                                            fillOpacity="0.45"
                                            stroke={acento}
                                            strokeWidth="2.5"
                                            filter="url(#neonPointGlow)"
                                        />
                                        <circle
                                            cx={chartData.activePoint.x}
                                            cy={chartData.activePoint.y}
                                            r="3.5"
                                            fill="#ffffff"
                                        />

                                        {/* Badge indicador con la nota media del año */}
                                        {chartData.activePoint.score > 0 && (
                                            <g transform={`translate(${chartData.activePoint.x}, ${Math.max(18, chartData.activePoint.y - 14)})`}>
                                                <rect
                                                    x="-26"
                                                    y="-14"
                                                    width="52"
                                                    height="18"
                                                    rx="6"
                                                    fill="rgba(10, 11, 20, 0.98)"
                                                    stroke={acento}
                                                    strokeWidth="1.2"
                                                />
                                                <text
                                                    x="0"
                                                    y="-2"
                                                    textAnchor="middle"
                                                    fill="#fbbf24"
                                                    fontSize="10"
                                                    fontWeight="800"
                                                >
                                                    ★ {chartData.activePoint.score.toFixed(2)}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                )}
                            </svg>

                            {/* Pista de líneas interactivas con acordeón y selección fluida */}
                            <div
                                className="full-ruler-track"
                                ref={rulerTrackRef}
                                onMouseMove={handleMouseMoveTrack}
                                onMouseLeave={handleMouseLeaveTrack}
                            >
                                <div className="ruler-baseline" />

                                {isLoadingTimeline ? (
                                    <div className="ruler-skeleton">Cargando cronología...</div>
                                ) : (
                                    timeline.map((item, index) => {
                                        const isDecade = item.year % 10 === 0
                                        const isHovered = hoveredIndex === index
                                        const isActivating = selectingYear === item.year

                                        // Dinamismo suave: abre espacio para el año enfocado
                                        let flexGrow = 1
                                        if (hoveredIndex !== null) {
                                            const dist = Math.abs(index - hoveredIndex)
                                            if (dist === 0) flexGrow = 3.6
                                            else if (dist === 1) flexGrow = 1.8
                                            else if (dist === 2) flexGrow = 1.2
                                        }

                                        return (
                                            <div
                                                key={item.year}
                                                data-year={item.year}
                                                className={`ruler-slot ${isDecade ? 'slot-decade' : 'slot-intermediate'} ${isHovered ? 'slot-hovered' : ''} ${isActivating ? 'slot-activating' : ''}`}
                                                style={{ flexGrow }}
                                                onClick={() => handleSelectYearLine(item.year)}
                                                onMouseEnter={() => setHoveredIndex(index)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        handleSelectYearLine(item.year)
                                                    }
                                                }}
                                            >
                                                {/* Línea minimalista: visible y destacada en hover/activa */}
                                                <div className="ruler-tick-bar" />

                                                {/* Tarjeta flotante que se transforma de forma fluida: ÚNICAMENTE EL AÑO */}
                                                <div className="tick-morph-card">
                                                    <span className="morph-year">{item.year}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* VENTANA 2: VENTANA INDEPENDIENTE DEL AÑO (STAGE: 'year')       */}
            {/* ============================================================== */}
            {currentStage === 'year' && (
                <div className={`window-pane year-window-pane ${isTransitioning ? 'pane-fade-out' : 'pane-fade-in'}`}>
                    {/* Barra Superior de la Ventana del Año */}
                    <div className="window-topbar">
                        <button
                            type="button"
                            onClick={handleBackToTimeline}
                            className="window-back-btn"
                        >
                            <ArrowLeft size={16} />
                            <span>Línea de Tiempo</span>
                        </button>

                        <div className="window-topbar-center">
                            <span className="window-current-badge">AÑO EN REVISIÓN</span>
                            <h2 className="window-current-title">{selectedYear}</h2>
                        </div>

                        {/* Espaciador para centrado balanceado */}
                        <div className="window-topbar-spacer" />
                    </div>

                    {/* SECCIÓN SUPERIOR: KPIS Y TOP 3 ANIMES DEL AÑO */}
                    <div className="year-top-overview">
                        {/* Fila de 3 KPIs Clickeables */}
                        <div className="year-kpis-row">
                            <div
                                className="clean-kpi-card clickeable"
                                onClick={() => onNavigateToCatalog({ year: selectedYear, ordering: 'season_year' })}
                                role="button"
                                tabIndex={0}
                                title={`Ver animes de ${selectedYear} ordenados por fecha de emisión ascendente en el Catálogo`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onNavigateToCatalog({ year: selectedYear, ordering: 'season_year' })
                                    }
                                }}
                            >
                                <Layers size={18} style={{ color: 'var(--temp-acento)' }} />
                                <div className="kpi-texts">
                                    <span className="kpi-num">
                                        {isLoadingMetrics ? '...' : (yearMetrics?.total_animes || 0)}
                                    </span>
                                    <span className="kpi-txt">Animes</span>
                                </div>
                                <span className="kpi-action-pill">Ver ➔</span>
                            </div>

                            <div
                                className="clean-kpi-card clickeable"
                                onClick={() => onNavigateToCatalog({ year: selectedYear, ordering: '-score' })}
                                role="button"
                                tabIndex={0}
                                title={`Ver animes de ${selectedYear} ordenados por nota media descendiente en el Catálogo`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onNavigateToCatalog({ year: selectedYear, ordering: '-score' })
                                    }
                                }}
                            >
                                <Star size={18} className="text-warning" />
                                <div className="kpi-texts">
                                    <span className="kpi-num">
                                        {isLoadingMetrics ? '...' : (yearMetrics?.avg_score ? `${yearMetrics.avg_score} ★` : 'N/A')}
                                    </span>
                                    <span className="kpi-txt">Nota Media</span>
                                </div>
                                <span className="kpi-action-pill">Ver ➔</span>
                            </div>

                            <div
                                className="clean-kpi-card clickeable"
                                onClick={() => {
                                    if (yearMetrics?.top_genre && yearMetrics.top_genre !== 'Variado') {
                                        onNavigateToCatalog({ year: selectedYear, genre: yearMetrics.top_genre })
                                    } else {
                                        onNavigateToCatalog({ year: selectedYear })
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                title={`Ver catálogo filtrado por ${selectedYear} y género ${yearMetrics?.top_genre || ''}`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        if (yearMetrics?.top_genre && yearMetrics.top_genre !== 'Variado') {
                                            onNavigateToCatalog({ year: selectedYear, genre: yearMetrics.top_genre })
                                        } else {
                                            onNavigateToCatalog({ year: selectedYear })
                                        }
                                    }
                                }}
                            >
                                <Tag size={18} className="text-info" />
                                <div className="kpi-texts">
                                    <span className="kpi-num text-truncate" style={{ maxWidth: '140px' }}>
                                        {isLoadingMetrics ? '...' : (yearMetrics?.top_genre || 'Variado')}
                                    </span>
                                    <span className="kpi-txt">Top Género</span>
                                </div>
                                <span className="kpi-action-pill">Filtrar ➔</span>
                            </div>
                        </div>

                        {/* Top 3 Animes del Año */}
                        <div className="year-top3-block">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="panel-subheading">
                                    <Flame size={16} className="text-warning me-1.5" />
                                    Top 3 de {selectedYear}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onNavigateToCatalog({ year: selectedYear })}
                                    className="btn-link-clean"
                                >
                                    Ver más en Catálogo ➔
                                </button>
                            </div>

                            <div className="year-top3-grid-row">
                                {isLoadingMetrics ? (
                                    <div className="p-3 text-secondary text-center w-100">Cargando top 3...</div>
                                ) : (yearMetrics?.top_3 || []).length > 0 ? (
                                    yearMetrics?.top_3.map((anime: SeasonTopAnime, idx: number) => (
                                        <div
                                            key={anime.mal_id}
                                            className="compact-top-row"
                                            onClick={() => onOpenAnimeDetail ? onOpenAnimeDetail(anime.mal_id) : onNavigateToCatalog({ year: selectedYear })}
                                        >
                                            <div className={`compact-medal medal-${idx + 1}`}>#{idx + 1}</div>
                                            <img
                                                src={anime.image_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80'}
                                                alt={anime.title}
                                                className="compact-poster"
                                                loading="lazy"
                                            />
                                            <div className="compact-texts">
                                                <span className="compact-title text-truncate" title={anime.title_english || anime.title}>
                                                    {anime.title_english || anime.title}
                                                </span>
                                                <div className="compact-sub">
                                                    <span className="badge-type">{anime.type || 'TV'}</span>
                                                    <span className="compact-score">★ {anime.score > 0 ? anime.score.toFixed(2) : 'S/P'}</span>
                                                    <span className="compact-votes">{anime.scored_by.toLocaleString()} votos</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-secondary text-center w-100">Sin animes puntuados suficientes.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN INFERIOR: SECUENCIA DE TEMPORADAS EN LÍNEA HORIZONTAL */}
                    <div className="year-bottom-seasons-sequence">
                        <h3 className="panel-heading mb-3">Las 4 Temporadas de {selectedYear}</h3>

                        <div className="clean-seasons-horizontal-row">
                            {(['Winter', 'Spring', 'Summer', 'Fall'] as const).map((seasonKey) => {
                                const sTheme = SEASON_THEMES[seasonKey]

                                return (
                                    <div
                                        key={seasonKey}
                                        className={`clean-season-card season-${seasonKey.toLowerCase()}`}
                                        onClick={() => handleSelectSeason(seasonKey)}
                                        role="button"
                                        tabIndex={0}
                                        title={`Ver detalles de ${sTheme.name} ${selectedYear}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleSelectSeason(seasonKey)
                                            }
                                        }}
                                    >
                                        <div
                                            className="season-gradient-underlay"
                                            style={{ background: sTheme.gradient }}
                                        />

                                        <div className="season-ident">
                                            {sTheme.icon}
                                            <span className="season-title-text">{sTheme.name}</span>
                                        </div>

                                        <div className="season-click-cue" aria-hidden="true">
                                            <ChevronRight size={18} className="season-cue-icon" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* VENTANA 3: VENTANA INDEPENDIENTE DE TEMPORADA (STAGE: 'season') */}
            {/* ============================================================== */}
            {currentStage === 'season' && selectedSeasonKey && (
                <div className={`window-pane season-window-pane season-theme-${selectedSeasonKey.toLowerCase()} ${isTransitioning ? 'pane-fade-out' : 'pane-fade-in'}`}>
                    {/* Barra Superior con Navegación de Regreso */}
                    <div className="window-topbar">
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                onClick={handleBackToYear}
                                className="window-back-btn"
                            >
                                <ArrowLeft size={16} />
                                <span>Volver a {selectedYear}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleBackToTimeline}
                                className="window-back-btn secondary-btn"
                            >
                                <span>Línea Temporal</span>
                            </button>
                        </div>

                        <div className="window-topbar-center">
                            <span className="window-current-badge">ESTACIÓN SELECCIONADA</span>
                            <div className="d-flex align-items-center justify-content-center gap-2">
                                {SEASON_THEMES[selectedSeasonKey]?.icon}
                                <h2 className="window-current-title">
                                    {SEASON_THEMES[selectedSeasonKey]?.name} {selectedYear}
                                </h2>
                            </div>
                        </div>

                        {/* Espaciador para centrado balanceado */}
                        <div className="window-topbar-spacer" />
                    </div>

                    {/* Dashboard de la Temporada */}
                    <div className="season-dashboard-content">
                        {/* 3 KPIs Clickeables de la Temporada */}
                        <div className="season-kpis-strip">
                            <div
                                className="clean-kpi-card large clickeable"
                                onClick={() => onNavigateToCatalog({
                                    year: selectedYear,
                                    season: selectedSeasonKey || undefined,
                                    ordering: 'season_year'
                                })}
                                role="button"
                                tabIndex={0}
                                title={`Ver animes de ${SEASON_THEMES[selectedSeasonKey || '']?.name || ''} ${selectedYear} por emisión ascendente`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onNavigateToCatalog({
                                            year: selectedYear,
                                            season: selectedSeasonKey || undefined,
                                            ordering: 'season_year'
                                        })
                                    }
                                }}
                            >
                                <Layers size={22} style={{ color: SEASON_THEMES[selectedSeasonKey]?.accentColor }} />
                                <div className="kpi-texts">
                                    <span className="kpi-num">{activeSeasonData?.count || 0}</span>
                                    <span className="kpi-txt">Animes estrenados en la estación</span>
                                </div>
                                <span className="kpi-action-pill">Ver ➔</span>
                            </div>

                            <div
                                className="clean-kpi-card large clickeable"
                                onClick={() => onNavigateToCatalog({
                                    year: selectedYear,
                                    season: selectedSeasonKey || undefined,
                                    ordering: '-score'
                                })}
                                role="button"
                                tabIndex={0}
                                title={`Ver animes de ${SEASON_THEMES[selectedSeasonKey || '']?.name || ''} ${selectedYear} ordenados por nota descendiente`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onNavigateToCatalog({
                                            year: selectedYear,
                                            season: selectedSeasonKey || undefined,
                                            ordering: '-score'
                                        })
                                    }
                                }}
                            >
                                <Star size={22} className="text-warning" />
                                <div className="kpi-texts">
                                    <span className="kpi-num">
                                        {activeSeasonData && activeSeasonData.avg_score > 0 ? `${activeSeasonData.avg_score} ★` : 'N/A'}
                                    </span>
                                    <span className="kpi-txt">Nota media de la temporada</span>
                                </div>
                                <span className="kpi-action-pill">Ver ➔</span>
                            </div>

                            <div
                                className="clean-kpi-card large clickeable"
                                onClick={() => onNavigateToCatalog({
                                    year: selectedYear,
                                    season: selectedSeasonKey || undefined,
                                    genre: activeSeasonData?.top_genre && activeSeasonData.top_genre !== 'Variado' ? activeSeasonData.top_genre : undefined
                                })}
                                role="button"
                                tabIndex={0}
                                title={`Filtrar estación por género: ${activeSeasonData?.top_genre || ''}`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        onNavigateToCatalog({
                                            year: selectedYear,
                                            season: selectedSeasonKey || undefined,
                                            genre: activeSeasonData?.top_genre && activeSeasonData.top_genre !== 'Variado' ? activeSeasonData.top_genre : undefined
                                        })
                                    }
                                }}
                            >
                                <Tag size={22} style={{ color: SEASON_THEMES[selectedSeasonKey]?.accentColor }} />
                                <div className="kpi-texts">
                                    <span className="kpi-num">{activeSeasonData?.top_genre || 'Variado'}</span>
                                    <span className="kpi-txt">Género dominante</span>
                                </div>
                                <span className="kpi-action-pill">Filtrar ➔</span>
                            </div>
                        </div>

                        {/* Top 3 Animes de esta Estación */}
                        <div className="season-top3-area">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <span className="panel-heading mb-0">
                                    <Flame size={18} className="text-warning me-1.5" />
                                    Top 3 Animes de {SEASON_THEMES[selectedSeasonKey]?.name} {selectedYear}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onNavigateToCatalog({
                                        year: selectedYear,
                                        season: selectedSeasonKey.toLowerCase()
                                    })}
                                    className="btn-link-clean"
                                >
                                    Ver todos los estrenos en Catálogo ➔
                                </button>
                            </div>

                            <div className="season-top3-grid">
                                {(activeSeasonData?.top_3 || []).length > 0 ? (
                                    activeSeasonData?.top_3.map((anime: SeasonTopAnime, idx: number) => (
                                        <div
                                            key={anime.mal_id}
                                            className="season-anime-card"
                                            onClick={() => onOpenAnimeDetail ? onOpenAnimeDetail(anime.mal_id) : onNavigateToCatalog({ year: selectedYear, season: selectedSeasonKey.toLowerCase() })}
                                        >
                                            <div className="anime-poster-wrapper">
                                                <img
                                                    src={anime.image_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80'}
                                                    alt={anime.title}
                                                    loading="lazy"
                                                    className="anime-poster"
                                                />
                                                <div className={`medal-corner medal-${idx + 1}`}>#{idx + 1}</div>
                                                <div className="score-corner">★ {anime.score > 0 ? anime.score.toFixed(2) : 'S/P'}</div>
                                            </div>

                                            <div className="anime-details">
                                                <span className="anime-type-badge">
                                                    <Tv size={11} className="me-1" />
                                                    {anime.type || 'TV'}
                                                </span>
                                                <h4 className="anime-title" title={anime.title_english || anime.title}>
                                                    {anime.title_english || anime.title}
                                                </h4>
                                                {anime.studio && (
                                                    <span className="anime-studio">{anime.studio}</span>
                                                )}
                                                <div className="anime-votes">
                                                    <TrendingUp size={12} className="me-1" />
                                                    {anime.scored_by.toLocaleString()} votos
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-data-notice">
                                        No hay animes registrados para {SEASON_THEMES[selectedSeasonKey]?.name} de {selectedYear}.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Switcher rápido de las otras 3 estaciones de este mismo año */}
                        <div className="season-sibling-switcher">
                            <span className="sibling-lbl">Cambiar de estación ({selectedYear}):</span>
                            <div className="sibling-pills">
                                {(['Winter', 'Spring', 'Summer', 'Fall'] as const)
                                    .filter(s => s !== selectedSeasonKey)
                                    .map(otherSeason => (
                                        <button
                                            key={otherSeason}
                                            type="button"
                                            onClick={() => handleSelectSeason(otherSeason)}
                                            className="sibling-pill-btn"
                                        >
                                            {SEASON_THEMES[otherSeason].icon}
                                            <span>{SEASON_THEMES[otherSeason].name}</span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
