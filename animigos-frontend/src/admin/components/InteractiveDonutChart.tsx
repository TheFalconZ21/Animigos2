import React from 'react'

export interface DonutSegment {
    id: string
    label: string
    count: number
    color: string
    percentage: number
    description: string
}

interface InteractiveDonutChartProps {
    title: string
    subtitle?: string
    segments: DonutSegment[]
    totalCount: number
    selectedSegmentId: string | null
    onSelectSegment: (segmentId: string | null) => void
    centerLabel?: string
    centerSublabel?: string
}

export const InteractiveDonutChart: React.FC<InteractiveDonutChartProps> = ({
    title,
    subtitle,
    segments,
    totalCount,
    selectedSegmentId,
    onSelectSegment,
    centerLabel,
    centerSublabel
}) => {
    const size = 260
    const strokeWidth = 32
    const radius = (size - strokeWidth) / 2
    const center = size / 2
    const circumference = 2 * Math.PI * radius

    // Calcular offsets de arcos SVG acumulados
    let accumulatedOffset = 0
    const renderedArcs = segments.map((seg) => {
        const segPct = totalCount > 0 ? seg.count / totalCount : 0
        const strokeDasharray = `${segPct * circumference} ${circumference}`
        const strokeDashoffset = -accumulatedOffset
        accumulatedOffset += segPct * circumference

        const isSelected = selectedSegmentId === seg.id
        const isDimmed = selectedSegmentId !== null && !isSelected

        return {
            ...seg,
            strokeDasharray,
            strokeDashoffset,
            isSelected,
            isDimmed
        }
    })

    return (
        <div className="admin-chart-stage">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                            {title}
                        </h2>
                        <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.65rem' }}>
                            Click para filtrar & drill-down
                        </span>
                    </div>
                    {subtitle && (
                        <p className="admin-subtitle m-0 mt-1">
                            {subtitle}
                        </p>
                    )}
                </div>

                {selectedSegmentId && (
                    <button
                        type="button"
                        onClick={() => onSelectSegment(null)}
                        className="admin-btn admin-btn-secondary font-mono d-flex align-items-center gap-1.5"
                        style={{ fontSize: '0.72rem' }}
                    >
                        <span>Mostrar todas ({totalCount})</span>
                    </button>
                )}
            </div>

            <div className="row align-items-center g-4">
                {/* Donut SVG interactivo */}
                <div className="col-12 col-md-5 d-flex justify-content-center">
                    <div className="position-relative" style={{ width: size, height: size }}>
                        <svg
                            width={size}
                            height={size}
                            viewBox={`0 0 ${size} ${size}`}
                            style={{ transform: 'rotate(-90deg)' }}
                        >
                            {/* Pista de fondo */}
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke="var(--admin-surface-3)"
                                strokeWidth={strokeWidth}
                            />

                            {/* Segmentos interactivos */}
                            {renderedArcs.map((arc) => (
                                <circle
                                    key={arc.id}
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    fill="transparent"
                                    stroke={arc.color}
                                    strokeWidth={arc.isSelected ? strokeWidth + 6 : strokeWidth}
                                    strokeDasharray={arc.strokeDasharray}
                                    strokeDashoffset={arc.strokeDashoffset}
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'all 0.22s var(--admin-ease)',
                                        opacity: arc.isDimmed ? 0.35 : 1,
                                        filter: arc.isSelected ? `drop-shadow(0 0 12px ${arc.color})` : 'none'
                                    }}
                                    onClick={() => onSelectSegment(arc.isSelected ? null : arc.id)}
                                />
                            ))}
                        </svg>

                        {/* Centro del Donut */}
                        <div
                            className="position-absolute top-50 start-50 translate-middle text-center d-flex flex-column align-items-center justify-content-center pointer-events-none"
                            style={{ width: size - strokeWidth * 2 - 10, height: size - strokeWidth * 2 - 10 }}
                        >
                            <span className="fs-2 fw-bold text-white font-mono lh-1">
                                {centerLabel ?? totalCount}
                            </span>
                            <span className="text-secondary font-mono small mt-1" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                                {centerSublabel ?? 'SALAS EN TOTAL'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Leyenda interactiva interactuable */}
                <div className="col-12 col-md-7">
                    <div className="d-flex flex-column gap-2">
                        {segments.map((seg) => {
                            const isSelected = selectedSegmentId === seg.id
                            const isDimmed = selectedSegmentId !== null && !isSelected

                            return (
                                <div
                                    key={seg.id}
                                    onClick={() => onSelectSegment(isSelected ? null : seg.id)}
                                    className={`p-2.5 rounded-2 d-flex align-items-center justify-content-between gap-3 cursor-pointer ${isDimmed ? 'opacity-50' : ''}`}
                                    style={{
                                        backgroundColor: isSelected ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                        border: isSelected ? `1.5px solid ${seg.color}` : '1px solid var(--admin-border-subtle)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-2.5 overflow-hidden">
                                        <div
                                            className="rounded-circle flex-shrink-0"
                                            style={{
                                                width: 12,
                                                height: 12,
                                                backgroundColor: seg.color,
                                                boxShadow: isSelected ? `0 0 8px ${seg.color}` : 'none'
                                            }}
                                        />
                                        <div className="text-truncate">
                                            <span className="fw-semibold text-white d-block" style={{ fontSize: '0.84rem' }}>
                                                {seg.label}
                                            </span>
                                            <span className="admin-subtitle d-block text-truncate" style={{ fontSize: '0.7rem' }}>
                                                {seg.description}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-end font-mono flex-shrink-0">
                                        <span className="fw-bold text-white d-block" style={{ fontSize: '0.9rem' }}>
                                            {seg.count}
                                        </span>
                                        <span className="text-muted small" style={{ fontSize: '0.68rem' }}>
                                            {seg.percentage}%
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

