import React, { useMemo } from 'react'
import type {
    RankingCurrentUserSummary,
    RankingDistributionStats,
} from '../../services/rankingApi'
import { getUserTier } from '../../utils/userTiers'

interface NormalDistributionChartProps {
    distribution: RankingDistributionStats
    currentUser: RankingCurrentUserSummary | null
    scopeLabel: string
}

function normalPdf(x: number, mean: number, std: number): number {
    const z = (x - mean) / std
    return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI))
}

export const NormalDistributionChart: React.FC<NormalDistributionChartProps> = ({
    distribution,
    currentUser,
    scopeLabel,
}) => {
    const { mean_hours, std_dev_hours, median_hours, total_users, max_hours } = distribution

    const chart = useMemo(() => {
        const width = 760
        const height = 240
        const padLeft = 42
        const padRight = 28
        const padTop = 34
        const padBottom = 42
        const plotW = width - padLeft - padRight
        const plotH = height - padTop - padBottom

        // Piso mínimo seguro para evitar curva degenerada cuando hay pocos usuarios o σ = 0
        const effectiveStd = Math.max(std_dev_hours, 25)
        const minDomain = Math.max(0, Math.floor(mean_hours - 3 * effectiveStd))
        const rawMax = Math.max(
            mean_hours + 3 * effectiveStd,
            max_hours * 1.05,
            currentUser ? currentUser.total_hours + effectiveStd * 0.6 : 0,
            100,
        )
        const maxDomain = Math.ceil(rawMax / 10) * 10
        const domainSpan = Math.max(1, maxDomain - minDomain)

        const toX = (h: number) => padLeft + ((h - minDomain) / domainSpan) * plotW

        const steps = 120
        const peakY = normalPdf(mean_hours, mean_hours, effectiveStd) || 1
        const toY = (pdfVal: number) => padTop + plotH - (pdfVal / peakY) * (plotH * 0.88)

        const points: Array<{ x: number; y: number; h: number }> = []
        for (let i = 0; i <= steps; i++) {
            const h = minDomain + (i / steps) * domainSpan
            const y = toY(normalPdf(h, mean_hours, effectiveStd))
            points.push({ x: toX(h), y, h })
        }

        const linePath = points
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' ')

        const baseY = padTop + plotH
        const fullAreaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} L ${points[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`

        let userAreaPath = ''
        let userX = 0
        let userY = baseY
        if (currentUser) {
            const clampedH = Math.min(maxDomain, Math.max(minDomain, currentUser.total_hours))
            userX = toX(clampedH)
            userY = toY(normalPdf(clampedH, mean_hours, effectiveStd))
            const leftPts = points.filter((p) => p.h <= clampedH)
            leftPts.push({ x: userX, y: userY, h: clampedH })
            if (leftPts.length >= 2) {
                const subLine = leftPts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(' ')
                userAreaPath = `${subLine} L ${userX.toFixed(1)} ${baseY.toFixed(1)} L ${leftPts[0].x.toFixed(1)} ${baseY.toFixed(1)} Z`
            }
        }

        const meanX = toX(Math.min(maxDomain, Math.max(minDomain, mean_hours)))
        const meanY = toY(normalPdf(mean_hours, mean_hours, effectiveStd))

        // 5 marcas limpias en el eje X
        const xTicks: Array<{ h: number; x: number }> = []
        for (let i = 0; i <= 4; i++) {
            const h = Math.round(minDomain + (i / 4) * domainSpan)
            xTicks.push({ h, x: toX(h) })
        }

        return {
            width,
            height,
            padLeft,
            padRight,
            padTop,
            baseY,
            linePath,
            fullAreaPath,
            userAreaPath,
            userX,
            userY,
            meanX,
            meanY,
            xTicks,
        }
    }, [mean_hours, std_dev_hours, max_hours, currentUser])

    const userTier = currentUser ? getUserTier(currentUser.total_hours) : null
    const highlightColor = userTier?.color || 'var(--theme-acento, #a78bfa)'

    return (
        <section className="ranking-dist-card">
            <div className="ranking-dist-header">
                <div>
                    <div className="ranking-eyebrow">DISTRIBUCIÓN NORMAL · {scopeLabel.toUpperCase()}</div>
                    <h2 className="ranking-dist-title">Tu posición respecto a la comunidad</h2>
                </div>

                {currentUser && userTier ? (
                    <div className="ranking-dist-user-pill" style={{ borderColor: userTier.border, background: userTier.bg }}>
                        <span style={{ color: userTier.color, fontWeight: 700 }}>
                            #{currentUser.rank} · Top {currentUser.top_percent}%
                        </span>
                        <span className="ranking-dist-dot">·</span>
                        <span className="text-white">
                            Percentil {currentUser.percentile}%
                        </span>
                        <span className="ranking-dist-dot">·</span>
                        <span style={{ color: 'rgba(255,255,255,0.78)' }}>
                            Z = {currentUser.z_score >= 0 ? `+${currentUser.z_score}` : currentUser.z_score}σ
                        </span>
                    </div>
                ) : (
                    <div className="ranking-dist-guest-note">
                        Inicia sesión para ver tu posición exacta en la campana
                    </div>
                )}
            </div>

            <div className="ranking-svg-wrap">
                <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="ranking-svg"
                    role="img"
                    aria-label="Gráfico de distribución normal de horas vistas"
                >
                    <defs>
                        <linearGradient id="rankingFullGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(167, 139, 250, 0.25)" />
                            <stop offset="100%" stopColor="rgba(167, 139, 250, 0.02)" />
                        </linearGradient>
                        <linearGradient id="rankingUserGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={highlightColor} stopOpacity="0.42" />
                            <stop offset="100%" stopColor={highlightColor} stopOpacity="0.04" />
                        </linearGradient>
                    </defs>

                    {/* Línea base eje X */}
                    <line
                        x1={chart.padLeft}
                        y1={chart.baseY}
                        x2={chart.width - chart.padRight}
                        y2={chart.baseY}
                        stroke="rgba(255, 255, 255, 0.14)"
                        strokeWidth="1"
                    />

                    {/* Área completa de la campana */}
                    <path d={chart.fullAreaPath} fill="url(#rankingFullGrad)" />

                    {/* Área acumulada hasta el usuario actual */}
                    {currentUser && chart.userAreaPath && (
                        <path d={chart.userAreaPath} fill="url(#rankingUserGrad)" />
                    )}

                    {/* Curva normal */}
                    <path
                        d={chart.linePath}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.55)"
                        strokeWidth="2"
                    />

                    {/* Línea vertical de la Media (μ) */}
                    <line
                        x1={chart.meanX}
                        y1={chart.meanY}
                        x2={chart.meanX}
                        y2={chart.baseY}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeDasharray="4 4"
                        strokeWidth="1.2"
                    />
                    <text
                        x={chart.meanX}
                        y={Math.max(16, chart.meanY - 10)}
                        textAnchor="middle"
                        fill="rgba(255, 255, 255, 0.68)"
                        fontSize="11"
                        fontWeight="600"
                    >
                        μ = {Math.round(mean_hours)} h
                    </text>

                    {/* Marcador de posición del usuario actual */}
                    {currentUser && (
                        <g>
                            <line
                                x1={chart.userX}
                                y1={chart.userY}
                                x2={chart.userX}
                                y2={chart.baseY}
                                stroke={highlightColor}
                                strokeWidth="2.2"
                            />
                            <circle
                                cx={chart.userX}
                                cy={chart.userY}
                                r="7"
                                fill={highlightColor}
                                fillOpacity="0.28"
                            />
                            <circle
                                cx={chart.userX}
                                cy={chart.userY}
                                r="4.2"
                                fill={highlightColor}
                                stroke="#0d0f14"
                                strokeWidth="1.6"
                            />
                            <text
                                x={Math.min(chart.width - 70, Math.max(70, chart.userX))}
                                y={Math.max(16, chart.userY - 12)}
                                textAnchor="middle"
                                fill={highlightColor}
                                fontSize="11.5"
                                fontWeight="700"
                            >
                                Tú ({currentUser.total_hours.toLocaleString()} h)
                            </text>
                        </g>
                    )}

                    {/* Ticks eje X */}
                    {chart.xTicks.map((t, idx) => (
                        <g key={idx}>
                            <line
                                x1={t.x}
                                y1={chart.baseY}
                                x2={t.x}
                                y2={chart.baseY + 5}
                                stroke="rgba(255,255,255,0.22)"
                                strokeWidth="1"
                            />
                            <text
                                x={t.x}
                                y={chart.baseY + 20}
                                textAnchor="middle"
                                fill="rgba(255,255,255,0.52)"
                                fontSize="10.5"
                            >
                                {t.h.toLocaleString()} h
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            <div className="ranking-dist-metrics">
                <div className="ranking-metric-box">
                    <span className="ranking-metric-label">Usuarios</span>
                    <strong className="ranking-metric-value">{total_users.toLocaleString()}</strong>
                </div>
                <div className="ranking-metric-box">
                    <span className="ranking-metric-label">Media (μ)</span>
                    <strong className="ranking-metric-value">{Math.round(mean_hours).toLocaleString()} h</strong>
                </div>
                <div className="ranking-metric-box">
                    <span className="ranking-metric-label">Desv. Estándar (σ)</span>
                    <strong className="ranking-metric-value">±{Math.round(std_dev_hours).toLocaleString()} h</strong>
                </div>
                <div className="ranking-metric-box">
                    <span className="ranking-metric-label">Mediana</span>
                    <strong className="ranking-metric-value">{Math.round(median_hours).toLocaleString()} h</strong>
                </div>
            </div>
        </section>
    )
}
