import React, { useMemo, useState } from 'react'
import { Compass, Layers, Sparkles, Users } from 'lucide-react'
import type { FilaLista } from '../mi-lista/mi-lista-data'

export interface OtakuDnaRadarChartProps {
    /** Lista del perfil que se está viendo (propio o visitado) */
    filas: FilaLista[]
    /** Lista del usuario autenticado cuando está visitando el perfil de otro usuario */
    viewerFilas?: FilaLista[]
    profileLabel: string
    viewerLabel?: string
    accentColor?: string
}

interface GenreMetrics {
    count: number
    ratedCount: number
    meanScore: number
    topTitles: string[]
}

interface RadarAxisData {
    genre: string
    primary: GenreMetrics
    secondary: GenreMetrics | null
    /** Valores normalizados 0..100 para dibujar en el radar */
    primaryVolumeNorm: number
    primaryScoreNorm: number
    secondaryVolumeNorm: number
    secondaryScoreNorm: number
}

const EXCLUDED_GENRES = new Set(['hentai', 'erotica', 'award winning'])

function extractGenreStats(filas: FilaLista[]): Map<string, GenreMetrics> {
    const map = new Map<string, { count: number; scoreSum: number; ratedCount: number; titles: Array<{ title: string; score: number }> }>()

    for (const f of filas) {
        if (f.estado !== 'visto' && f.estado !== 'viendo') continue
        const genres = Array.isArray(f.anime.genres) ? f.anime.genres : []
        const userScore = typeof f.nota === 'number' && f.nota > 0 ? f.nota : 0

        for (const rawG of genres) {
            const g = String(rawG || '').trim()
            if (!g || EXCLUDED_GENRES.has(g.toLowerCase())) continue
            let bucket = map.get(g)
            if (!bucket) {
                bucket = { count: 0, scoreSum: 0, ratedCount: 0, titles: [] }
                map.set(g, bucket)
            }
            bucket.count += 1
            if (userScore > 0) {
                bucket.scoreSum += userScore
                bucket.ratedCount += 1
            }
            bucket.titles.push({ title: f.anime.title, score: userScore })
        }
    }

    const result = new Map<string, GenreMetrics>()
    for (const [genre, b] of map.entries()) {
        const sortedTitles = [...b.titles]
            .sort((a, x) => x.score - a.score)
            .slice(0, 3)
            .map((t) => t.title)

        result.set(genre, {
            count: b.count,
            ratedCount: b.ratedCount,
            meanScore: b.ratedCount > 0 ? +(b.scoreSum / b.ratedCount).toFixed(2) : 0,
            topTitles: sortedTitles,
        })
    }
    return result
}

function cosineSimilarityPercent(vecA: number[], vecB: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
    }
    if (normA === 0 || normB === 0) return 0
    return Math.round((dot / (Math.sqrt(normA) * Math.sqrt(normB))) * 100)
}

export const OtakuDnaRadarChart: React.FC<OtakuDnaRadarChartProps> = ({
    filas,
    viewerFilas,
    profileLabel,
    viewerLabel = 'Tú',
    accentColor = 'var(--perfil-acento, #a78bfa)',
}) => {
    const isComparing = Boolean(viewerFilas && viewerFilas.length > 0)
    // En perfil propio: toggles de capas (Volumen vs Nota media)
    const [showVolumeLayer, setShowVolumeLayer] = useState(true)
    const [showScoreLayer, setShowScoreLayer] = useState(true)
    // En perfil visitado: modo de comparación (Consumo vs Calificación)
    const [compareMetric, setCompareMetric] = useState<'volume' | 'score'>('volume')
    // Eje inspeccionado al hacer hover o clic
    const [activeAxisIdx, setActiveAxisIdx] = useState<number>(0)

    const analytics = useMemo(() => {
        const primaryMap = extractGenreStats(filas)
        const secondaryMap = isComparing && viewerFilas ? extractGenreStats(viewerFilas) : null

        // Seleccionar los 6-8 géneros más representativos
        const combinedScores = new Map<string, number>()
        for (const [g, m] of primaryMap.entries()) {
            combinedScores.set(g, (combinedScores.get(g) || 0) + m.count * 1.2)
        }
        if (secondaryMap) {
            for (const [g, m] of secondaryMap.entries()) {
                combinedScores.set(g, (combinedScores.get(g) || 0) + m.count)
            }
        }

        const topGenres = [...combinedScores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7)
            .map(([g]) => g)

        if (topGenres.length < 3) {
            return null
        }

        const maxPrimaryCount = Math.max(
            1,
            ...topGenres.map((g) => primaryMap.get(g)?.count || 0),
        )
        const maxSecondaryCount = secondaryMap
            ? Math.max(1, ...topGenres.map((g) => secondaryMap.get(g)?.count || 0))
            : 1

        const emptyMetrics: GenreMetrics = { count: 0, ratedCount: 0, meanScore: 0, topTitles: [] }

        const axes: RadarAxisData[] = topGenres.map((genre) => {
            const p = primaryMap.get(genre) || emptyMetrics
            const s = secondaryMap ? secondaryMap.get(genre) || emptyMetrics : null
            return {
                genre,
                primary: p,
                secondary: s,
                primaryVolumeNorm: Math.round((p.count / maxPrimaryCount) * 100),
                primaryScoreNorm: Math.round((p.meanScore / 10) * 100),
                secondaryVolumeNorm: s ? Math.round((s.count / maxSecondaryCount) * 100) : 0,
                secondaryScoreNorm: s ? Math.round((s.meanScore / 10) * 100) : 0,
            }
        })

        // Insights para perfil propio
        const mostWatched = [...axes].sort((a, b) => b.primary.count - a.primary.count)[0]
        const ratedAxes = axes.filter((a) => a.primary.ratedCount > 0)
        const highestRated =
            ratedAxes.length > 0
                ? [...ratedAxes].sort((a, b) => b.primary.meanScore - a.primary.meanScore)[0]
                : null

        // Insights para comparación entre 2 usuarios
        let compatibilityPct: number | null = null
        let sharedAnimesCount = 0
        let strongestMatchGenre: string | null = null
        let biggestContrastGenre: string | null = null

        if (isComparing && viewerFilas) {
            // Similitud del coseno sobre el vector completo de géneros presentes en ambos
            const allGenres = Array.from(new Set([...primaryMap.keys(), ...(secondaryMap?.keys() || [])]))
            const vecA = allGenres.map((g) => {
                const m = primaryMap.get(g)
                if (!m) return 0
                return compareMetric === 'score' && m.ratedCount > 0 ? m.meanScore : m.count
            })
            const vecB = allGenres.map((g) => {
                const m = secondaryMap?.get(g)
                if (!m) return 0
                return compareMetric === 'score' && m.ratedCount > 0 ? m.meanScore : m.count
            })
            compatibilityPct = cosineSimilarityPercent(vecA, vecB)

            const primaryIds = new Set(
                filas
                    .filter((f) => f.estado === 'visto' || f.estado === 'viendo')
                    .map((f) => f.malId),
            )
            sharedAnimesCount = viewerFilas.filter(
                (f) => (f.estado === 'visto' || f.estado === 'viendo') && primaryIds.has(f.malId),
            ).length

            const scoredMatches = axes.map((a) => {
                const v1 = compareMetric === 'score' ? a.primaryScoreNorm : a.primaryVolumeNorm
                const v2 = compareMetric === 'score' ? a.secondaryScoreNorm : a.secondaryVolumeNorm
                return {
                    genre: a.genre,
                    joint: Math.min(v1, v2),
                    diff: Math.abs(v1 - v2),
                }
            })
            strongestMatchGenre = [...scoredMatches].sort((a, b) => b.joint - a.joint)[0]?.genre || null
            biggestContrastGenre = [...scoredMatches].sort((a, b) => b.diff - a.diff)[0]?.genre || null
        }

        return {
            axes,
            mostWatched,
            highestRated,
            compatibilityPct,
            sharedAnimesCount,
            strongestMatchGenre,
            biggestContrastGenre,
        }
    }, [filas, viewerFilas, isComparing, compareMetric])

    if (!analytics) {
        return (
            <section className="perfil-dna-card">
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <div>
                        <span className="ml-eyebrow">ADN OTAKU · ANÁLISIS MULTIVARIADO</span>
                        <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-1.5">
                            <Compass size={15} style={{ color: accentColor }} />
                            <span>Radar de Géneros y Afinidad</span>
                        </h4>
                    </div>
                </div>
                <p className="small mb-0 mt-2" style={{ color: 'var(--perfil-text-muted)' }}>
                    Agrega al menos 3 animes vistos o viendo con géneros distintos para construir el radar de ADN Otaku.
                </p>
            </section>
        )
    }

    const { axes } = analytics
    const safeIdx = Math.min(activeAxisIdx, axes.length - 1)
    const activeAxis = axes[safeIdx]

    // Geometría del SVG Radar
    const size = 340
    const cx = size / 2
    const cy = size / 2
    const radius = 112
    const rings = [25, 50, 75, 100]

    const angleFor = (idx: number) => -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length
    const pointAt = (idx: number, pct: number) => {
        const a = angleFor(idx)
        const r = (Math.max(4, pct) / 100) * radius
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
    }

    const buildPolygon = (values: number[]) =>
        values
            .map((v, i) => {
                const pt = pointAt(i, v)
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
            })
            .join(' ')

    const primaryValues = axes.map((a) =>
        isComparing
            ? compareMetric === 'score'
                ? a.primaryScoreNorm
                : a.primaryVolumeNorm
            : a.primaryVolumeNorm,
    )
    const secondaryValues = axes.map((a) =>
        isComparing
            ? compareMetric === 'score'
                ? a.secondaryScoreNorm
                : a.secondaryVolumeNorm
            : a.primaryScoreNorm,
    )

    const secondaryColor = '#38bdf8'

    return (
        <section className="perfil-dna-card">
            {/* Header */}
            <div className="perfil-dna-header">
                <div>
                    <span className="ml-eyebrow">
                        {isComparing
                            ? 'ADN OTAKU · COMPARATIVA EN TIEMPO REAL'
                            : 'ADN OTAKU · ANÁLISIS MULTIVARIADO'}
                    </span>
                    <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-1.5">
                        {isComparing ? (
                            <Users size={15} style={{ color: accentColor }} />
                        ) : (
                            <Layers size={15} style={{ color: accentColor }} />
                        )}
                        <span>
                            {isComparing
                                ? `Perfil de Gustos: ${profileLabel} vs. ${viewerLabel}`
                                : 'Radar de Consumo vs. Calificación por Género'}
                        </span>
                    </h4>
                </div>

                {/* Controles según modo */}
                <div className="perfil-dna-controls">
                    {isComparing ? (
                        <>
                            {analytics.compatibilityPct !== null && (
                                <span
                                    className="perfil-dna-compat-badge"
                                    style={{
                                        borderColor: accentColor,
                                        color: '#ffffff',
                                    }}
                                    title="Calculado mediante similitud del coseno sobre los vectores de géneros de ambos usuarios"
                                >
                                    <Sparkles size={12} style={{ color: accentColor }} />
                                    <span>{analytics.compatibilityPct}% afinidad</span>
                                </span>
                            )}
                            <div className="perfil-dna-toggle-group">
                                <button
                                    type="button"
                                    onClick={() => setCompareMetric('volume')}
                                    className={`perfil-dna-toggle-btn ${compareMetric === 'volume' ? 'is-active' : ''}`}
                                >
                                    Consumo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCompareMetric('score')}
                                    className={`perfil-dna-toggle-btn ${compareMetric === 'score' ? 'is-active' : ''}`}
                                >
                                    Nota Media
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="perfil-dna-toggle-group">
                            <button
                                type="button"
                                onClick={() => setShowVolumeLayer((v) => !v)}
                                className={`perfil-dna-toggle-btn ${showVolumeLayer ? 'is-active' : ''}`}
                            >
                                <span className="perfil-dna-dot" style={{ background: accentColor }} />
                                <span>Volumen</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowScoreLayer((v) => !v)}
                                className={`perfil-dna-toggle-btn ${showScoreLayer ? 'is-active-cyan' : ''}`}
                            >
                                <span className="perfil-dna-dot" style={{ background: secondaryColor }} />
                                <span>Nota Media</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Cuerpo 2 columnas: Radar SVG + Inspector / Insights */}
            <div className="perfil-dna-body">
                {/* Columna Izquierda: SVG Radar */}
                <div className="perfil-dna-svg-col">
                    <svg
                        viewBox={`0 0 ${size} ${size}`}
                        className="perfil-dna-svg"
                        role="img"
                        aria-label="Gráfico de radar de géneros de anime"
                    >
                        {/* Anillos concéntricos */}
                        {rings.map((rPct) => (
                            <polygon
                                key={rPct}
                                points={axes
                                    .map((_, i) => {
                                        const pt = pointAt(i, rPct)
                                        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
                                    })
                                    .join(' ')}
                                fill="none"
                                stroke="rgba(255, 255, 255, 0.08)"
                                strokeWidth="1"
                            />
                        ))}

                        {/* Ejes radiales y etiquetas */}
                        {axes.map((a, idx) => {
                            const outer = pointAt(idx, 100)
                            const labelPt = pointAt(idx, 124)
                            const isSelected = idx === safeIdx
                            return (
                                <g
                                    key={a.genre}
                                    onMouseEnter={() => setActiveAxisIdx(idx)}
                                    onClick={() => setActiveAxisIdx(idx)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <line
                                        x1={cx}
                                        y1={cy}
                                        x2={outer.x}
                                        y2={outer.y}
                                        stroke={isSelected ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.1)'}
                                        strokeWidth={isSelected ? '1.5' : '1'}
                                    />
                                    <text
                                        x={labelPt.x}
                                        y={labelPt.y}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill={isSelected ? '#ffffff' : 'rgba(255,255,255,0.68)'}
                                        fontSize={isSelected ? '11.5' : '10.5'}
                                        fontWeight={isSelected ? '700' : '500'}
                                    >
                                        {a.genre.length > 13 ? `${a.genre.slice(0, 12)}…` : a.genre}
                                    </text>
                                </g>
                            )
                        })}

                        {/* Polígono Primario (Volumen propio o Perfil visitado) */}
                        {(isComparing || showVolumeLayer) && (
                            <g>
                                <polygon
                                    points={buildPolygon(primaryValues)}
                                    fill={accentColor}
                                    fillOpacity="0.22"
                                    stroke={accentColor}
                                    strokeWidth="2.2"
                                    strokeLinejoin="round"
                                />
                                {primaryValues.map((v, i) => {
                                    const pt = pointAt(i, v)
                                    return (
                                        <circle
                                            key={`p-${i}`}
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={i === safeIdx ? 5 : 3.2}
                                            fill={accentColor}
                                            stroke="#0d0f14"
                                            strokeWidth="1.4"
                                            onMouseEnter={() => setActiveAxisIdx(i)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    )
                                })}
                            </g>
                        )}

                        {/* Polígono Secundario (Nota Media propia o Usuario visitante) */}
                        {(isComparing || showScoreLayer) && (
                            <g>
                                <polygon
                                    points={buildPolygon(secondaryValues)}
                                    fill={secondaryColor}
                                    fillOpacity="0.16"
                                    stroke={secondaryColor}
                                    strokeWidth="2"
                                    strokeDasharray={isComparing ? undefined : '5 3'}
                                    strokeLinejoin="round"
                                />
                                {secondaryValues.map((v, i) => {
                                    const pt = pointAt(i, v)
                                    return (
                                        <circle
                                            key={`s-${i}`}
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={i === safeIdx ? 4.8 : 3}
                                            fill={secondaryColor}
                                            stroke="#0d0f14"
                                            strokeWidth="1.4"
                                            onMouseEnter={() => setActiveAxisIdx(i)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    )
                                })}
                            </g>
                        )}
                    </svg>

                    {/* Leyenda compacta */}
                    <div className="perfil-dna-legend">
                        <span className="perfil-dna-legend-item">
                            <span className="perfil-dna-dot" style={{ background: accentColor }} />
                            <span>{isComparing ? profileLabel : 'Volumen visto'}</span>
                        </span>
                        <span className="perfil-dna-legend-item">
                            <span className="perfil-dna-dot" style={{ background: secondaryColor }} />
                            <span>{isComparing ? viewerLabel : 'Calificación media (0–10)'}</span>
                        </span>
                    </div>
                </div>

                {/* Columna Derecha: Inspector de Género + Insights */}
                <div className="perfil-dna-info-col">
                    {/* Tarjeta de género inspeccionado */}
                    <div className="perfil-dna-inspector">
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                            <span className="fw-bold text-white" style={{ fontSize: '0.95rem' }}>
                                {activeAxis.genre}
                            </span>
                            <span className="small" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.72rem' }}>
                                Pasa o haz clic en cada eje
                            </span>
                        </div>

                        {isComparing && activeAxis.secondary ? (
                            <div className="perfil-dna-compare-grid">
                                <div className="perfil-dna-stat-box">
                                    <span className="perfil-dna-stat-who" style={{ color: accentColor }}>
                                        {profileLabel}
                                    </span>
                                    <strong className="text-white">
                                        {activeAxis.primary.count} animes
                                    </strong>
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {activeAxis.primary.meanScore > 0
                                            ? `★ ${activeAxis.primary.meanScore.toFixed(1)} media`
                                            : 'Sin notas'}
                                    </span>
                                </div>
                                <div className="perfil-dna-stat-box">
                                    <span className="perfil-dna-stat-who" style={{ color: secondaryColor }}>
                                        {viewerLabel}
                                    </span>
                                    <strong className="text-white">
                                        {activeAxis.secondary.count} animes
                                    </strong>
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {activeAxis.secondary.meanScore > 0
                                            ? `★ ${activeAxis.secondary.meanScore.toFixed(1)} media`
                                            : 'Sin notas'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="perfil-dna-compare-grid">
                                <div className="perfil-dna-stat-box">
                                    <span className="perfil-dna-stat-who" style={{ color: accentColor }}>
                                        Volumen visto
                                    </span>
                                    <strong className="text-white">
                                        {activeAxis.primary.count} animes
                                    </strong>
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {activeAxis.primaryVolumeNorm}% del máximo
                                    </span>
                                </div>
                                <div className="perfil-dna-stat-box">
                                    <span className="perfil-dna-stat-who" style={{ color: secondaryColor }}>
                                        Calificación media
                                    </span>
                                    <strong className="text-white">
                                        {activeAxis.primary.meanScore > 0
                                            ? `★ ${activeAxis.primary.meanScore.toFixed(2)}`
                                            : 'Sin notas'}
                                    </strong>
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {activeAxis.primary.ratedCount} calificados
                                    </span>
                                </div>
                            </div>
                        )}

                        {activeAxis.primary.topTitles.length > 0 && (
                            <div className="mt-2 pt-2 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                                <div className="small mb-1" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.7rem' }}>
                                    Destacados en {activeAxis.genre}:
                                </div>
                                <div className="d-flex flex-wrap gap-1">
                                    {activeAxis.primary.topTitles.map((t) => (
                                        <span key={t} className="perfil-dna-title-chip">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Hallazgos automáticos */}
                    <div className="perfil-dna-insights">
                        {isComparing ? (
                            <>
                                <div className="perfil-dna-insight-row">
                                    <span className="perfil-dna-insight-label">Animes en común</span>
                                    <strong className="text-white">{analytics.sharedAnimesCount} series</strong>
                                </div>
                                {analytics.strongestMatchGenre && (
                                    <div className="perfil-dna-insight-row">
                                        <span className="perfil-dna-insight-label">Mayor coincidencia</span>
                                        <strong style={{ color: '#34d399' }}>{analytics.strongestMatchGenre}</strong>
                                    </div>
                                )}
                                {analytics.biggestContrastGenre && (
                                    <div className="perfil-dna-insight-row">
                                        <span className="perfil-dna-insight-label">Mayor contraste</span>
                                        <strong style={{ color: '#fbbf24' }}>{analytics.biggestContrastGenre}</strong>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {analytics.mostWatched && (
                                    <div className="perfil-dna-insight-row">
                                        <span className="perfil-dna-insight-label">Más consumido</span>
                                        <strong style={{ color: accentColor }}>
                                            {analytics.mostWatched.genre} ({analytics.mostWatched.primary.count})
                                        </strong>
                                    </div>
                                )}
                                {analytics.highestRated && (
                                    <div className="perfil-dna-insight-row">
                                        <span className="perfil-dna-insight-label">Mejor calificado</span>
                                        <strong style={{ color: secondaryColor }}>
                                            {analytics.highestRated.genre} (★ {analytics.highestRated.primary.meanScore.toFixed(1)})
                                        </strong>
                                    </div>
                                )}
                                {analytics.mostWatched &&
                                    analytics.highestRated &&
                                    analytics.mostWatched.genre !== analytics.highestRated.genre && (
                                        <p className="mb-0 mt-1 small" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.74rem' }}>
                                            Consumes más <strong>{analytics.mostWatched.genre}</strong>, pero premias con notas más altas a{' '}
                                            <strong>{analytics.highestRated.genre}</strong>.
                                        </p>
                                    )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
