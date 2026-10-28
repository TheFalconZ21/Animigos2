import React, { useState, useMemo } from 'react'
import { Network, Flame, Sparkles, Compass, Layers } from 'lucide-react'
import type { TasteAnalyticsResponse, TasteGraphNode } from '../../services/recommenderApi'

interface TasteCorrelationGraphProps {
    analytics: TasteAnalyticsResponse | null
    loading?: boolean
    accentColor?: string
    onSelectTagFilter?: (tag: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
    Genre: '#e8508f',
    Theme: '#8b5cf6',
    Setting: '#06b6d4',
    Cast: '#f59e0b',
    Technical: '#10b981',
}

const CATEGORY_LABELS: Record<string, string> = {
    Genre: 'Género Principal',
    Theme: 'Tropo / Temática',
    Setting: 'Ambientación',
    Cast: 'Arquetipo de Elenco',
    Technical: 'Narrativa / Técnica',
}

export const TasteCorrelationGraph: React.FC<TasteCorrelationGraphProps> = ({
    analytics,
    loading = false,
    accentColor = '#e8508f',
    onSelectTagFilter,
}) => {
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'graph' | 'combos'>('graph')

    // Calcular posiciones estables de constelación de fuerza (radial + anillos ponderados)
    const positionedData = useMemo(() => {
        if (!analytics || !analytics.nodes.length) return { nodes: [], links: [] }

        const nodes = analytics.nodes.slice(0, 14)
        const cx = 340
        const cy = 210

        const placedNodes = nodes.map((node, idx) => {
            if (idx === 0) {
                return { ...node, x: cx, y: cy, r: 30 }
            }
            // Primer anillo (nodos 1..5), segundo anillo (nodos 6..13)
            const isInnerRing = idx <= 5
            const ringIndex = isInnerRing ? idx - 1 : idx - 6
            const ringTotal = isInnerRing ? Math.min(5, nodes.length - 1) : Math.max(1, nodes.length - 6)
            const radiusX = isInnerRing ? 135 : 245
            const radiusY = isInnerRing ? 95 : 158
            const angleOffset = isInnerRing ? -Math.PI / 2 : -Math.PI / 2 + 0.38
            const angle = angleOffset + (ringIndex / ringTotal) * Math.PI * 2

            const x = cx + Math.cos(angle) * radiusX
            const y = cy + Math.sin(angle) * radiusY
            const r = Math.max(16, Math.min(26, Math.round(12 + (node.normalized_weight / 100) * 14)))

            return { ...node, x, y, r }
        })

        const nodeMap = new Map(placedNodes.map((n) => [n.id, n]))
        const validLinks = analytics.links
            .map((lk) => {
                const src = nodeMap.get(lk.source)
                const tgt = nodeMap.get(lk.target)
                if (!src || !tgt) return null
                return { ...lk, src, tgt }
            })
            .filter(Boolean) as Array<{
            source: string
            target: string
            strength: number
            shared_animes: string[]
            src: TasteGraphNode & { x: number; y: number; r: number }
            tgt: TasteGraphNode & { x: number; y: number; r: number }
        }>

        return { nodes: placedNodes, links: validLinks }
    }, [analytics])

    const activeNode = useMemo(() => {
        if (!positionedData.nodes.length) return null
        if (hoveredNodeId) {
            return positionedData.nodes.find((n) => n.id === hoveredNodeId) || positionedData.nodes[0]
        }
        return positionedData.nodes[0]
    }, [positionedData.nodes, hoveredNodeId])

    const connectedNodeIds = useMemo(() => {
        const set = new Set<string>()
        if (!hoveredNodeId) return set
        set.add(hoveredNodeId)
        for (const lk of positionedData.links) {
            if (lk.source === hoveredNodeId) set.add(lk.target)
            if (lk.target === hoveredNodeId) set.add(lk.source)
        }
        return set
    }, [hoveredNodeId, positionedData.links])

    if (loading) {
        return (
            <div className="rec-analytics-card p-4 text-center">
                <div className="spinner-border spinner-border-sm text-secondary me-2" role="status" />
                <span className="text-secondary small">Calculando grafo de correlación de tus gustos...</span>
            </div>
        )
    }

    if (!analytics || !analytics.nodes.length) {
        return (
            <section className="rec-analytics-card mb-4">
                <div className="rec-analytics-header mb-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="rec-analytics-badge" style={{ borderColor: accentColor, color: accentColor }}>
                            <Network size={14} /> ADN & Correlación de Gustos
                        </span>
                        <h3 className="rec-analytics-title mb-0">Sin datos de calibración aún</h3>
                    </div>
                </div>
                <p className="rec-analytics-desc mb-3">
                    Realiza el test de calibración en la sección <strong>Recomendador</strong> o añade animes a tu lista para visualizar tu red y matriz de correlación de gustos.
                </p>
                <a
                    href="#recomendador"
                    className="rec-inspector-filter-btn d-inline-flex text-decoration-none"
                    style={{ width: 'auto', borderColor: accentColor, color: '#ffffff' }}
                >
                    <Sparkles size={13} /> Ir al Calibrador / Recomendador
                </a>
            </section>
        )
    }

    return (
        <section className="rec-analytics-card mb-4">
            <div className="rec-analytics-header">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="rec-analytics-badge" style={{ borderColor: accentColor, color: accentColor }}>
                        <Network size={14} /> ADN & Correlación de Gustos
                    </span>
                    <h3 className="rec-analytics-title mb-0">{analytics.archetype.title}</h3>
                </div>

                <div className="rec-analytics-tabs">
                    <button
                        type="button"
                        className={`rec-analytics-tab ${activeTab === 'graph' ? 'active' : ''}`}
                        onClick={() => setActiveTab('graph')}
                    >
                        <Compass size={14} /> Red de Nodos
                    </button>
                    <button
                        type="button"
                        className={`rec-analytics-tab ${activeTab === 'combos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('combos')}
                    >
                        <Layers size={14} /> Matriz de Co-ocurrencia
                    </button>
                </div>
            </div>

            <p className="rec-analytics-desc mb-3">{analytics.archetype.description}</p>

            {activeTab === 'graph' ? (
                <div className="rec-graph-layout">
                    {/* Lienzo SVG interactivo */}
                    <div className="rec-graph-canvas-wrap">
                        <svg
                            viewBox="0 0 680 420"
                            className="rec-graph-svg"
                            role="img"
                            aria-label="Grafo de correlación de etiquetas y géneros del usuario"
                        >
                            <defs>
                                <radialGradient id="recCoreGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
                                    <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
                                </radialGradient>
                            </defs>

                            {/* Halo central */}
                            <circle cx="340" cy="210" r="195" fill="url(#recCoreGlow)" />
                            <circle
                                cx="340"
                                cy="210"
                                r="135"
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeDasharray="4 6"
                            />
                            <circle
                                cx="340"
                                cy="210"
                                r="235"
                                fill="none"
                                stroke="rgba(255,255,255,0.035)"
                                strokeDasharray="3 7"
                            />

                            {/* Aristas de co-ocurrencia */}
                            {positionedData.links.map((lk, idx) => {
                                const isHighlighted =
                                    hoveredNodeId === lk.source || hoveredNodeId === lk.target
                                const isDimmed = hoveredNodeId !== null && !isHighlighted
                                const strokeW = Math.min(4.5, 1.2 + lk.strength * 0.7)
                                return (
                                    <line
                                        key={`${lk.source}-${lk.target}-${idx}`}
                                        x1={lk.src.x}
                                        y1={lk.src.y}
                                        x2={lk.tgt.x}
                                        y2={lk.tgt.y}
                                        stroke={isHighlighted ? accentColor : 'rgba(255,255,255,0.18)'}
                                        strokeWidth={isHighlighted ? strokeW + 1 : strokeW}
                                        strokeOpacity={isDimmed ? 0.12 : isHighlighted ? 0.92 : 0.42}
                                        style={{ transition: 'all 0.22s ease' }}
                                    />
                                )
                            })}

                            {/* Nodos */}
                            {positionedData.nodes.map((node) => {
                                const color = CATEGORY_COLORS[node.category] || accentColor
                                const isHovered = hoveredNodeId === node.id
                                const isConnected = !hoveredNodeId || connectedNodeIds.has(node.id)
                                return (
                                    <g
                                        key={node.id}
                                        transform={`translate(${node.x}, ${node.y})`}
                                        className="rec-graph-node"
                                        style={{
                                            opacity: isConnected ? 1 : 0.28,
                                            cursor: 'pointer',
                                            transition: 'opacity 0.22s ease',
                                        }}
                                        onMouseEnter={() => setHoveredNodeId(node.id)}
                                        onMouseLeave={() => setHoveredNodeId(null)}
                                        onClick={() => onSelectTagFilter?.(node.label)}
                                    >
                                        {isHovered && (
                                            <circle
                                                r={node.r + 7}
                                                fill="none"
                                                stroke={color}
                                                strokeWidth="2"
                                                strokeOpacity="0.65"
                                            />
                                        )}
                                        <circle
                                            r={node.r}
                                            fill="rgba(16, 17, 24, 0.92)"
                                            stroke={color}
                                            strokeWidth={isHovered ? 3 : 2}
                                        />
                                        <text
                                            y={3}
                                            textAnchor="middle"
                                            fill="#ffffff"
                                            fontSize="9.5"
                                            fontWeight="700"
                                        >
                                            {node.normalized_weight}%
                                        </text>
                                        <text
                                            y={node.r + 14}
                                            textAnchor="middle"
                                            fill={isHovered ? '#ffffff' : '#d4d4d8'}
                                            fontSize={isHovered ? '11.5' : '10.5'}
                                            fontWeight={isHovered ? '700' : '600'}
                                            style={{
                                                textShadow: '0 2px 6px rgba(0,0,0,0.95)',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            {node.label}
                                        </text>
                                    </g>
                                )
                            })}
                        </svg>

                        {/* Leyenda inferior */}
                        <div className="rec-graph-legend">
                            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                                <span key={cat} className="rec-graph-legend-item">
                                    <span
                                        className="rec-graph-legend-dot"
                                        style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                                    />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Inspector Lateral del Nodo Seleccionado */}
                    {activeNode && (
                        <div className="rec-graph-inspector">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span
                                    className="rec-inspector-cat"
                                    style={{
                                        color: CATEGORY_COLORS[activeNode.category] || accentColor,
                                    }}
                                >
                                    {CATEGORY_LABELS[activeNode.category] || activeNode.category}
                                </span>
                                <span className="rec-inspector-weight">
                                    Afinidad {activeNode.normalized_weight}%
                                </span>
                            </div>

                            <h4 className="rec-inspector-node-title">{activeNode.label}</h4>

                            <p className="rec-inspector-hint">
                                Presente en <strong>{activeNode.count}</strong> indicadores de tu perfil analítico.
                            </p>

                            {activeNode.sample_animes.length > 0 && (
                                <div className="mb-3">
                                    <div className="rec-inspector-sub">Obras de origen en tu perfil:</div>
                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                        {activeNode.sample_animes.map((title) => (
                                            <span key={title} className="rec-inspector-chip">
                                                {title}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {onSelectTagFilter && (
                                <button
                                    type="button"
                                    className="rec-inspector-filter-btn"
                                    style={{ borderColor: accentColor, color: '#ffffff' }}
                                    onClick={() => onSelectTagFilter(activeNode.label)}
                                >
                                    <Sparkles size={13} /> Filtrar 5 recomendaciones por "{activeNode.label}"
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Vista de Matriz / Combos de Co-ocurrencia */
                <div className="rec-combos-grid">
                    {analytics.top_combinations.length === 0 ? (
                        <div className="text-secondary small p-3">
                            Agrega más géneros, películas o animes vistos en tu calibrador para descubrir combinaciones recurrentes.
                        </div>
                    ) : (
                        analytics.top_combinations.map((combo) => (
                            <div
                                key={combo.pair}
                                className="rec-combo-card"
                                onClick={() => onSelectTagFilter?.(combo.source)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onSelectTagFilter?.(combo.source)
                                }}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="rec-combo-pair">
                                        <Flame size={14} style={{ color: accentColor }} />
                                        {combo.pair}
                                    </span>
                                    <span className="rec-combo-pct" style={{ color: accentColor }}>
                                        {combo.affinity_pct}% sinergia
                                    </span>
                                </div>
                                <div className="rec-combo-bar-bg mb-2">
                                    <div
                                        className="rec-combo-bar-fill"
                                        style={{
                                            width: `${combo.affinity_pct}%`,
                                            backgroundColor: accentColor,
                                        }}
                                    />
                                </div>
                                {combo.examples.length > 0 && (
                                    <div className="rec-combo-examples">
                                        Converge en: {combo.examples.join(' · ')}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </section>
    )
}

