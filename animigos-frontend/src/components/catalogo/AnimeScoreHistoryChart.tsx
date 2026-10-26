import React, { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Calendar, Users, Award, Loader2 } from 'lucide-react'
import { fetchAnimeScoreHistory, type AnimeScoreHistoryItem } from '../../services/catalogApi'

interface AnimeScoreHistoryChartProps {
    malId: number
    title?: string
}

export const AnimeScoreHistoryChart: React.FC<AnimeScoreHistoryChartProps> = ({ malId }) => {
    const [history, setHistory] = useState<AnimeScoreHistoryItem[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    useEffect(() => {
        let isMounted = true
        setIsLoading(true)
        setError(null)
        setHoveredIndex(null)

        fetchAnimeScoreHistory(malId)
            .then((data) => {
                if (isMounted) {
                    setHistory(data)
                    setIsLoading(false)
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err.message || 'No se pudo cargar el historial.')
                    setIsLoading(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [malId])

    // Filtramos puntos válidos con nota numérica
    const validPoints = useMemo(() => {
        return history
            .filter((item) => item.score !== null && item.score !== undefined && !isNaN(Number(item.score)))
            .map((item) => ({
                ...item,
                numScore: Number(item.score),
            }))
    }, [history])

    // Estadísticas clave: Primer valor, último valor, variación (delta) y pico
    const stats = useMemo(() => {
        if (validPoints.length === 0) return null

        const first = validPoints[0]
        const last = validPoints[validPoints.length - 1]
        const delta = Number((last.numScore - first.numScore).toFixed(2))

        let peak = validPoints[0]
        for (const pt of validPoints) {
            if (pt.numScore > peak.numScore) {
                peak = pt
            }
        }

        return { first, last, delta, peak }
    }, [validPoints])

    // Punto activo para el tooltip (el hovered o por defecto el último disponible)
    const activePoint = useMemo(() => {
        if (validPoints.length === 0) return null
        if (hoveredIndex !== null && validPoints[hoveredIndex]) {
            return validPoints[hoveredIndex]
        }
        return validPoints[validPoints.length - 1]
    }, [validPoints, hoveredIndex])

    // Geometría del gráfico SVG
    const chartGeometry = useMemo(() => {
        if (validPoints.length < 2) return null

        const width = 500
        const height = 150
        const padLeft = 40
        const padRight = 20
        const padTop = 20
        const padBottom = 26

        const plotWidth = width - padLeft - padRight
        const plotHeight = height - padTop - padBottom

        const scores = validPoints.map((p) => p.numScore)
        let minScore = Math.min(...scores)
        let maxScore = Math.max(...scores)

        // Margen dinámico para que la línea respire
        if (minScore === maxScore) {
            minScore -= 0.5
            maxScore += 0.5
        } else {
            const spread = maxScore - minScore
            const buffer = Math.max(0.08, spread * 0.15)
            minScore = Math.max(0, minScore - buffer)
            maxScore = Math.min(10, maxScore + buffer)
        }

        const scoreRange = maxScore - minScore

        const coords = validPoints.map((pt, i) => {
            const x = padLeft + (i / (validPoints.length - 1)) * plotWidth
            const y = padTop + plotHeight - ((pt.numScore - minScore) / scoreRange) * plotHeight
            return { x, y, pt, index: i }
        })

        // Generación de curva Bézier suave
        let linePath = `M ${coords[0].x} ${coords[0].y}`
        for (let i = 0; i < coords.length - 1; i++) {
            const current = coords[i]
            const next = coords[i + 1]
            const mx = (current.x + next.x) / 2
            linePath += ` C ${mx} ${current.y}, ${mx} ${next.y}, ${next.x} ${next.y}`
        }

        // Área bajo la curva para el gradiente
        const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padTop + plotHeight} L ${coords[0].x} ${padTop + plotHeight} Z`

        // 3 líneas guía horizontales
        const gridSteps = 3
        const gridLines = Array.from({ length: gridSteps }).map((_, idx) => {
            const val = minScore + (idx / (gridSteps - 1)) * scoreRange
            const y = padTop + plotHeight - (idx / (gridSteps - 1)) * plotHeight
            return { val: val.toFixed(2), y }
        })

        return {
            width,
            height,
            coords,
            linePath,
            areaPath,
            gridLines,
            padTop,
            padBottom,
            plotHeight,
        }
    }, [validPoints])

    if (isLoading) {
        return (
            <div className="py-4 d-flex flex-column align-items-center justify-content-center gap-2 text-secondary">
                <Loader2 size={18} className="animate-spin text-warning" />
                <span className="small font-mono" style={{ fontSize: '0.75rem' }}>
                    Consultando histórico de puntuación...
                </span>
            </div>
        )
    }

    if (error || validPoints.length === 0) {
        return (
            <div
                className="p-3 rounded-2 text-center"
                style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
            >
                <span className="small text-secondary" style={{ fontSize: '0.78rem' }}>
                    {validPoints.length === 0
                        ? 'Este anime aún no registra suficientes cortes históricos en la base de datos.'
                        : error}
                </span>
            </div>
        )
    }

    if (validPoints.length === 1) {
        const single = validPoints[0]
        return (
            <div
                className="p-3 rounded-2 d-flex align-items-center justify-content-between"
                style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
            >
                <div className="d-flex align-items-center gap-2">
                    <Calendar size={15} className="text-secondary" />
                    <span className="small text-secondary">
                        Corte inicial ({single.period_label}): <strong className="text-white">★ {single.numScore.toFixed(2)}</strong>
                    </span>
                </div>
                <span className="badge bg-black border border-dark text-secondary font-mono" style={{ fontSize: '0.7rem' }}>
                    1 registro disponible
                </span>
            </div>
        )
    }

    return (
        <div className="d-flex flex-column gap-2.5">
            {/* Header del bloque con etiqueta */}
            <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-1.5">
                    <span className="cat-filter-label mb-0" style={{ letterSpacing: '0.08em' }}>
                        EVOLUCIÓN HISTÓRICA DE LA NOTA
                    </span>
                    <span className="badge bg-black border border-dark text-secondary font-mono" style={{ fontSize: '0.68rem' }}>
                        2018 — 2026
                    </span>
                </div>

                {stats && (
                    <div className="d-flex align-items-center gap-1 font-mono" style={{ fontSize: '0.76rem' }}>
                        <span className="text-secondary">Variación:</span>
                        <span
                            className={`fw-bold d-inline-flex align-items-center gap-0.5 ${
                                stats.delta > 0
                                    ? 'text-success'
                                    : stats.delta < 0
                                    ? 'text-danger'
                                    : 'text-secondary'
                            }`}
                        >
                            {stats.delta > 0 ? (
                                <TrendingUp size={12} />
                            ) : stats.delta < 0 ? (
                                <TrendingDown size={12} />
                            ) : (
                                <Minus size={12} />
                            )}
                            {stats.delta > 0 ? `+${stats.delta.toFixed(2)}` : stats.delta.toFixed(2)}
                        </span>
                    </div>
                )}
            </div>

            {/* Ficha resumen de métricas clave */}
            {stats && (
                <div className="row g-1.5 text-center font-mono">
                    <div className="col-3">
                        <div
                            className="p-1.5 rounded-2"
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
                        >
                            <span className="text-secondary d-block" style={{ fontSize: '0.65rem' }}>
                                INICIAL ({stats.first.period_label})
                            </span>
                            <span className="fw-bold text-white" style={{ fontSize: '0.82rem' }}>
                                ★ {stats.first.numScore.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div className="col-3">
                        <div
                            className="p-1.5 rounded-2"
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
                        >
                            <span className="text-secondary d-block" style={{ fontSize: '0.65rem' }}>
                                ACTUAL ({stats.last.period_label})
                            </span>
                            <span className="fw-bold text-warning" style={{ fontSize: '0.82rem' }}>
                                ★ {stats.last.numScore.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div className="col-3">
                        <div
                            className="p-1.5 rounded-2"
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
                        >
                            <span className="text-secondary d-block" style={{ fontSize: '0.65rem' }}>
                                PICO MÁXIMO
                            </span>
                            <span className="fw-bold text-white" style={{ fontSize: '0.82rem' }}>
                                ★ {stats.peak.numScore.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div className="col-3">
                        <div
                            className="p-1.5 rounded-2"
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
                        >
                            <span className="text-secondary d-block" style={{ fontSize: '0.65rem' }}>
                                CORTES TOTALES
                            </span>
                            <span className="fw-bold text-secondary" style={{ fontSize: '0.82rem' }}>
                                {validPoints.length} años
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenedor del Gráfico SVG Interactivo */}
            {chartGeometry && (
                <div
                    className="p-2.5 rounded-3 position-relative"
                    style={{
                        background: '#0d0d12',
                        border: '1px solid var(--cat-border)',
                        overflow: 'hidden',
                    }}
                >
                    <svg
                        viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                        className="w-100"
                        style={{ display: 'block', maxHeight: '165px' }}
                    >
                        <defs>
                            <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--cat-gold, #fcd34d)" stopOpacity="0.22" />
                                <stop offset="100%" stopColor="var(--cat-gold, #fcd34d)" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="scoreLineGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="var(--cat-acento, #e8508f)" />
                                <stop offset="100%" stopColor="var(--cat-gold, #fcd34d)" />
                            </linearGradient>
                        </defs>

                        {/* Líneas horizontales de referencia */}
                        {chartGeometry.gridLines.map((gl, i) => (
                            <g key={i}>
                                <line
                                    x1={35}
                                    y1={gl.y}
                                    x2={chartGeometry.width - 15}
                                    y2={gl.y}
                                    stroke="rgba(255, 255, 255, 0.06)"
                                    strokeDasharray="2,3"
                                />
                                <text
                                    x={30}
                                    y={gl.y + 3}
                                    fill="rgba(255, 255, 255, 0.35)"
                                    fontSize="8.5"
                                    fontFamily="monospace"
                                    textAnchor="end"
                                >
                                    {gl.val}
                                </text>
                            </g>
                        ))}

                        {/* Área sombreada bajo la curva */}
                        <path d={chartGeometry.areaPath} fill="url(#scoreAreaGrad)" />

                        {/* Línea de tendencia Bézier */}
                        <path
                            d={chartGeometry.linePath}
                            fill="none"
                            stroke="url(#scoreLineGrad)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />

                        {/* Puntos y etiquetas del eje X */}
                        {chartGeometry.coords.map(({ x, y, pt, index }) => {
                            const isHovered = hoveredIndex === index
                            const isFirst = index === 0
                            const isLast = index === chartGeometry.coords.length - 1

                            return (
                                <g key={index}>
                                    {/* Etiqueta del año en el eje X */}
                                    <text
                                        x={x}
                                        y={chartGeometry.height - 6}
                                        fill={isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.4)'}
                                        fontSize="8.5"
                                        fontFamily="monospace"
                                        fontWeight={isHovered || isLast ? 'bold' : 'normal'}
                                        textAnchor="middle"
                                    >
                                        {pt.period_label}
                                    </text>

                                    {/* Punto interactivo */}
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={isHovered ? 6 : isLast || isFirst ? 4 : 3}
                                        fill={isHovered ? '#ffffff' : 'var(--cat-gold, #fcd34d)'}
                                        stroke="#080808"
                                        strokeWidth={isHovered ? 2.5 : 1.5}
                                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                                        onMouseEnter={() => setHoveredIndex(index)}
                                    />
                                </g>
                            )
                        })}
                    </svg>

                    {/* Fila inferior con el detalle del corte seleccionado al posar el cursor */}
                    {activePoint && (
                        <div
                            className="mt-2 pt-2 border-top border-dark d-flex flex-wrap align-items-center justify-content-between font-mono small text-secondary"
                            style={{ fontSize: '0.72rem' }}
                        >
                            <div className="d-flex align-items-center gap-1.5">
                                <Calendar size={11} className="text-secondary" />
                                <span className="text-white fw-bold">{activePoint.period_label}:</span>
                                <span className="text-warning fw-bold">★ {activePoint.numScore.toFixed(2)}</span>
                            </div>

                            <div className="d-flex align-items-center gap-3">
                                {activePoint.scored_by > 0 && (
                                    <span title="Usuarios que calificaron este título">
                                        <Users size={11} className="me-1 inline" />
                                        {activePoint.scored_by.toLocaleString()} votos
                                    </span>
                                )}
                                {activePoint.members > 0 && (
                                    <span>
                                        {activePoint.members.toLocaleString()} miembros
                                    </span>
                                )}
                                {activePoint.rank && (
                                    <span className="text-white">
                                        <Award size={11} className="me-0.5 inline text-warning" />
                                        Rank #{activePoint.rank}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
