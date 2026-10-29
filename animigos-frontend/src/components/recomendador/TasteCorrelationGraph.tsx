import React, { useState, useMemo } from 'react'
import {
    Network,
    Flame,
    Sparkles,
    Compass,
    Layers,
    Check,
    Filter,
    ChevronDown,
    ChevronUp,
    Star,
    SlidersHorizontal,
} from 'lucide-react'
import type {
    TasteAnalyticsResponse,
    TasteGraphNode,
    TasteGraphLink,
    TasteCombinationItem,
} from '../../services/recommenderApi'
import type { FilaLista } from '../mi-lista/mi-lista-data'
import { getTagDescription, TAXONOMY_CATEGORY_DESCRIPTIONS } from '../../shared/tagDescriptions'

interface TasteCorrelationGraphProps {
    analytics: TasteAnalyticsResponse | null
    filas?: FilaLista[]
    loading?: boolean
    accentColor?: string
    onSelectTagFilter?: (tag: string) => void
}

type TaxonomyFilterId = 'main_tags' | 'secondary_tags' | 'Theme' | 'Cast' | 'Setting' | 'Genre'
type ScoreFilterMode = 'all' | 'high_8' | 'good_7' | 'low_6'
type ColorMode = 'score' | 'palette'

const CHORD_PALETTE = [
    '#4a8fe7', // Blue
    '#f2c94c', // Gold
    '#eb5783', // Pink
    '#a3e635', // Lime
    '#06b6d4', // Cyan
    '#fb923c', // Orange
    '#4ade80', // Green
    '#a78bfa', // Purple
    '#e879f9', // Magenta
    '#67e8f9', // Light Cyan
    '#6ee7b7', // Mint
    '#f87171', // Coral Red
    '#60a5fa', // Sky Blue
    '#fdba74', // Peach
    '#818cf8', // Indigo
    '#c084fc', // Violet
]

const CATEGORY_LABELS: Record<string, string> = {
    Genre: 'Género Clásico',
    Theme: 'Temática / Tropo',
    Setting: 'Ambientación',
    Cast: 'Elenco / Protagonistas',
    Technical: 'Narrativa / Demografía',
}

function normalizeTagCategory(rawCat?: string): 'Genre' | 'Theme' | 'Setting' | 'Cast' | 'Technical' {
    if (!rawCat) return 'Theme'
    const c = rawCat.toLowerCase()
    if (c === 'genre') return 'Genre'
    if (c.startsWith('cast')) return 'Cast'
    if (c.startsWith('setting')) return 'Setting'
    if (c.startsWith('technical') || c.startsWith('demographic')) return 'Technical'
    return 'Theme'
}

function getScoreSynergyColor(score: number): string {
    if (score >= 8.6) return '#10b981' // Esmeralda (Obra maestra / Sinergia de Oro)
    if (score >= 8.0) return '#a855f7' // Púrpura vibrante (Excelente sinergia)
    if (score >= 7.3) return '#38bdf8' // Azul / Cian (Sinergia sólida)
    if (score >= 6.5) return '#f59e0b' // Ámbar (Moderada)
    return '#f43f5e' // Coral / Rojo (Baja nota media)
}

function getScoreSynergyLabel(score: number): string {
    if (score >= 8.6) return 'Sinergia de Oro'
    if (score >= 8.0) return 'Sinergia Muy Alta'
    if (score >= 7.3) return 'Combinación Sólida'
    if (score >= 6.5) return 'Gusto Moderado'
    return 'Baja Afinidad'
}

function polarToCartesian(cx: number, cy: number, r: number, angleInRadians: number) {
    return {
        x: cx + r * Math.cos(angleInRadians),
        y: cy + r * Math.sin(angleInRadians),
    }
}

function describeArcBand(
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number
): string {
    const p1 = polarToCartesian(cx, cy, outerR, startAngle)
    const p2 = polarToCartesian(cx, cy, outerR, endAngle)
    const p3 = polarToCartesian(cx, cy, innerR, endAngle)
    const p4 = polarToCartesian(cx, cy, innerR, startAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

    return [
        `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
        'Z',
    ].join(' ')
}

function describeChordRibbon(
    cx: number,
    cy: number,
    r: number,
    s0: number,
    s1: number,
    t0: number,
    t1: number
): string {
    const pS0 = polarToCartesian(cx, cy, r, s0)
    const pS1 = polarToCartesian(cx, cy, r, s1)
    const pT0 = polarToCartesian(cx, cy, r, t0)
    const pT1 = polarToCartesian(cx, cy, r, t1)
    const largeArcS = Math.abs(s1 - s0) > Math.PI ? 1 : 0
    const largeArcT = Math.abs(t1 - t0) > Math.PI ? 1 : 0

    return [
        `M ${pS0.x.toFixed(2)} ${pS0.y.toFixed(2)}`,
        `A ${r} ${r} 0 ${largeArcS} 1 ${pS1.x.toFixed(2)} ${pS1.y.toFixed(2)}`,
        `Q ${cx} ${cy} ${pT0.x.toFixed(2)} ${pT0.y.toFixed(2)}`,
        `A ${r} ${r} 0 ${largeArcT} 1 ${pT1.x.toFixed(2)} ${pT1.y.toFixed(2)}`,
        `Q ${cx} ${cy} ${pS0.x.toFixed(2)} ${pS0.y.toFixed(2)}`,
        'Z',
    ].join(' ')
}

export const TasteCorrelationGraph: React.FC<TasteCorrelationGraphProps> = ({
    analytics,
    filas = [],
    loading = false,
    accentColor = '#e8508f',
    onSelectTagFilter,
}) => {
    const [activeTab, setActiveTab] = useState<'graph' | 'combos'>('graph')
    const [selectedTaxonomies, setSelectedTaxonomies] = useState<TaxonomyFilterId[]>([
        'main_tags',
        'secondary_tags',
        'Theme',
        'Cast',
        'Setting',
        'Genre',
    ])
    const [scoreFilter, setScoreFilter] = useState<ScoreFilterMode>('all')
    const [colorMode, setColorMode] = useState<ColorMode>('score')
    const [comboSortBy, setComboSortBy] = useState<'synergy' | 'score' | 'count'>('synergy')
    const [howItWorksOpen, setHowItWorksOpen] = useState<boolean>(true)

    // Interacción: clic fija un género/taxonomía individual para poder inspeccionar el icono "i" arriba a la derecha
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
    const [hoveredChordKey, setHoveredChordKey] = useState<string | null>(null)
    const [hoveredInfoTarget, setHoveredInfoTarget] = useState<'canvas' | 'inspector' | TaxonomyFilterId | null>(null)

    const toggleTaxonomy = (id: TaxonomyFilterId) => {
        setSelectedTaxonomies((prev) => {
            if (prev.includes(id)) {
                if (prev.length === 1) return prev // Mantener al menos 1 activo
                return prev.filter((item) => item !== id)
            }
            return [...prev, id]
        })
    }

    // Construir dataset dinámico si el usuario tiene entradas con tagsData o si aplica filtro de nota personal
    const computedDataset = useMemo(() => {
        const validFilas = filas.filter((f) => {
            // EXCLUSIÓN ESTRICTA: Animes en 'pendiente' o 'dropeado' NUNCA deben tomarse en cuenta en el gráfico
            if (f.estado === 'pendiente' || f.estado === 'dropeado') return false
            if (f.estado !== 'visto' && f.estado !== 'viendo') return false
            if (f.estado === 'viendo' && f.episodiosVistos === 0) return false
            const effectiveScore = f.nota ?? (f.favorito ? 9 : f.anime.score || 7.5)
            if (scoreFilter === 'high_8') return effectiveScore >= 8
            if (scoreFilter === 'good_7') return effectiveScore >= 7
            if (scoreFilter === 'low_6') return effectiveScore <= 6.9
            return true
        })

        const hasFilasWithTags = validFilas.some(
            (f) => (f.anime.tagsData && f.anime.tagsData.length > 0) || (f.anime.genres && f.anime.genres.length > 0)
        )

        const shouldComputeFromFilas =
            hasFilasWithTags && (scoreFilter !== 'all' || !analytics || analytics.nodes.length === 0 || validFilas.length >= 1)

        let rawNodes: TasteGraphNode[] = []
        let rawLinks: TasteGraphLink[] = []
        let rawCombos: TasteCombinationItem[] = []

        if (shouldComputeFromFilas) {

            const tagStats = new Map<
                string,
                {
                    category: string
                    weight: number
                    count: number
                    scores: number[]
                    ranks: number[]
                    samples: string[]
                }
            >()

            const pairStats = new Map<
                string,
                {
                    a: string
                    b: string
                    weight: number
                    count: number
                    scores: number[]
                    shared: string[]
                }
            >()

            for (const f of validFilas) {
                const effectiveScore = f.nota ?? (f.favorito ? 9.0 : Number(f.anime.score) || 7.5)
                const scoreWeight = Math.max(0.45, (effectiveScore - 3.5) / 5.0)
                const workTags: Array<{ name: string; category: string; rank: number }> = []
                const seenInWork = new Set<string>()

                for (const t of f.anime.tagsData || []) {
                    if (!t?.name || t.spoiler) continue
                    const rank = Number(t.rank ?? 65)
                    if (rank < 45) continue
                    const normCat = normalizeTagCategory(t.category)
                    if (!seenInWork.has(t.name)) {
                        seenInWork.add(t.name)
                        workTags.push({ name: t.name, category: normCat, rank })
                    }
                }

                for (const g of f.anime.genres || []) {
                    if (!g || seenInWork.has(g)) continue
                    seenInWork.add(g)
                    workTags.push({ name: g, category: 'Genre', rank: 82 })
                }

                workTags.sort((x, y) => y.rank - x.rank)
                const topWorkTags = workTags.slice(0, 12)

                for (const t of topWorkTags) {
                    const prev = tagStats.get(t.name) || {
                        category: t.category,
                        weight: 0,
                        count: 0,
                        scores: [],
                        ranks: [],
                        samples: [],
                    }
                    prev.weight += (t.rank / 100) * scoreWeight * 1.4
                    prev.count += 1
                    prev.scores.push(effectiveScore)
                    prev.ranks.push(t.rank)
                    if (prev.samples.length < 5 && !prev.samples.includes(f.anime.title)) {
                        prev.samples.push(f.anime.title)
                    }
                    tagStats.set(t.name, prev)
                }

                for (let i = 0; i < topWorkTags.length; i++) {
                    for (let j = i + 1; j < topWorkTags.length; j++) {
                        const [tA, tB] =
                            topWorkTags[i].name < topWorkTags[j].name
                                ? [topWorkTags[i], topWorkTags[j]]
                                : [topWorkTags[j], topWorkTags[i]]
                        const key = `${tA.name}|||${tB.name}`
                        const p = pairStats.get(key) || {
                            a: tA.name,
                            b: tB.name,
                            weight: 0,
                            count: 0,
                            scores: [],
                            shared: [],
                        }
                        const pairRankFactor = ((tA.rank + tB.rank) / 200) * scoreWeight
                        p.weight += pairRankFactor
                        p.count += 1
                        p.scores.push(effectiveScore)
                        if (p.shared.length < 5 && !p.shared.includes(f.anime.title)) {
                            p.shared.push(f.anime.title)
                        }
                        pairStats.set(key, p)
                    }
                }
            }

            const allEntries = Array.from(tagStats.entries()).sort((a, b) => b[1].weight - a[1].weight)
            const maxW = allEntries.length > 0 ? Math.max(allEntries[0][1].weight, 1) : 1

            rawNodes = allEntries.map(([name, st]) => {
                const avgScore =
                    st.scores.length > 0 ? st.scores.reduce((a, b) => a + b, 0) / st.scores.length : 7.8
                const avgRank =
                    st.ranks.length > 0 ? st.ranks.reduce((a, b) => a + b, 0) / st.ranks.length : 75
                return {
                    id: name,
                    label: name,
                    category: st.category,
                    weight: Number(st.weight.toFixed(2)),
                    normalized_weight: Math.min(100, Math.max(18, Math.round((st.weight / maxW) * 100))),
                    count: st.count,
                    mean_score: Number(avgScore.toFixed(2)),
                    avg_rank: Math.round(avgRank),
                    is_main_tag: avgRank >= 72,
                    sample_animes: st.samples,
                }
            })

            rawLinks = Array.from(pairStats.values())
                .filter((p) => p.count >= 1)
                .sort((a, b) => b.count - a.count || b.weight - a.weight)
                .map((p) => {
                    const avgScore =
                        p.scores.length > 0 ? p.scores.reduce((a, b) => a + b, 0) / p.scores.length : 7.8
                    return {
                        source: p.a,
                        target: p.b,
                        strength: p.count,
                        mean_score: Number(avgScore.toFixed(2)),
                        shared_animes: p.shared,
                    }
                })
        } else if (analytics) {
            rawNodes = analytics.nodes.map((n) => ({
                ...n,
                mean_score: n.mean_score ?? 8.1,
                avg_rank: n.avg_rank ?? (n.category === 'Genre' ? 85 : 76),
                is_main_tag: n.is_main_tag ?? (n.avg_rank ? n.avg_rank >= 72 : true),
            }))
            rawLinks = analytics.links.map((lk) => ({
                ...lk,
                mean_score: lk.mean_score ?? 8.1,
            }))
        }

        // Aplicar filtros de taxonomía (Main Tags, Secondary Tags, Categorías de AniList)
        const allowMain = selectedTaxonomies.includes('main_tags')
        const allowSecondary = selectedTaxonomies.includes('secondary_tags')
        const activeCategories = new Set(
            selectedTaxonomies.filter((t) => t !== 'main_tags' && t !== 'secondary_tags')
        )

        const filteredNodes = rawNodes
            .filter((node) => {
                const isMain = node.is_main_tag ?? (node.avg_rank ?? 75) >= 72
                if (allowMain && !allowSecondary && !isMain) return false
                if (!allowMain && allowSecondary && isMain) return false

                if (activeCategories.size > 0) {
                    const cat = node.category === 'Technical' ? 'Theme' : node.category
                    if (!activeCategories.has(cat as TaxonomyFilterId)) return false
                }

                if (!shouldComputeFromFilas && scoreFilter !== 'all') {
                    const sc = node.mean_score ?? 8.0
                    if (scoreFilter === 'high_8' && sc < 8.0) return false
                    if (scoreFilter === 'good_7' && sc < 7.0) return false
                    if (scoreFilter === 'low_6' && sc > 7.2) return false
                }

                return true
            })
            .slice(0, 16)

        const nodeSet = new Set(filteredNodes.map((n) => n.id))
        const filteredLinks = rawLinks
            .filter((lk) => nodeSet.has(lk.source) && nodeSet.has(lk.target))
            .slice(0, 48)

        const maxLinkCount =
            filteredLinks.length > 0 ? Math.max(...filteredLinks.map((l) => l.strength), 1) : 1

        rawCombos = filteredLinks.map((lk) => {
            const sc = lk.mean_score ?? 8.0
            const countRatio = lk.strength / maxLinkCount
            const scoreRatio = Math.max(0.2, (sc - 4.0) / 6.0)
            const synergyPct = Math.min(99, Math.max(35, Math.round((countRatio * 0.55 + scoreRatio * 0.45) * 100)))
            return {
                pair: `${lk.source} + ${lk.target}`,
                source: lk.source,
                target: lk.target,
                count: lk.strength,
                mean_score: sc,
                affinity_pct: synergyPct,
                examples: lk.shared_animes,
            }
        })

        return {
            nodes: filteredNodes,
            links: filteredLinks,
            combos: rawCombos,
        }
    }, [analytics, filas, selectedTaxonomies, scoreFilter])

    // Geometría matemática del Diagrama de Cuerdas Circular (Chord Diagram)
    const chordLayout = useMemo(() => {
        const { nodes, links } = computedDataset
        if (!nodes.length) return { arcs: [], chords: [] }

        const cx = 310
        const cy = 275
        const outerR = 186
        const innerR = 171
        const ribbonR = 167

        const nodeTotals = new Map<string, number>()
        for (const n of nodes) {
            nodeTotals.set(n.id, 0)
        }
        for (const lk of links) {
            nodeTotals.set(lk.source, (nodeTotals.get(lk.source) || 0) + lk.strength)
            nodeTotals.set(lk.target, (nodeTotals.get(lk.target) || 0) + lk.strength)
        }

        for (const n of nodes) {
            const current = nodeTotals.get(n.id) || 0
            if (current === 0) {
                nodeTotals.set(n.id, Math.max(1, n.count * 0.5))
            }
        }

        const totalStrength = Array.from(nodeTotals.values()).reduce((a, b) => a + b, 0) || 1
        const padAngle = nodes.length > 1 ? 0.032 : 0
        const availableAngle = Math.max(0.5, Math.PI * 2 - padAngle * nodes.length)

        let currentAngle = 0.08
        const arcs = nodes.map((node, idx) => {
            const nodeVal = nodeTotals.get(node.id) || 1
            const span = Math.max(0.08, (nodeVal / totalStrength) * availableAngle)
            const startAngle = currentAngle
            const endAngle = currentAngle + span
            const midAngle = (startAngle + endAngle) / 2
            currentAngle = endAngle + padAngle

            const paletteColor = CHORD_PALETTE[idx % CHORD_PALETTE.length]
            const scoreColor = getScoreSynergyColor(node.mean_score ?? 8.0)

            return {
                ...node,
                index: idx,
                totalLinkValue: nodeVal,
                startAngle,
                endAngle,
                midAngle,
                paletteColor,
                scoreColor,
                path: describeArcBand(cx, cy, innerR, outerR, startAngle, endAngle),
            }
        })

        const arcMap = new Map(arcs.map((a) => [a.id, a]))
        const arcOffsets = new Map<string, number>()
        for (const a of arcs) {
            arcOffsets.set(a.id, a.startAngle)
        }

        const sortedLinks = [...links].sort((a, b) => a.strength - b.strength)

        const chords = sortedLinks
            .map((lk) => {
                const srcArc = arcMap.get(lk.source)
                const tgtArc = arcMap.get(lk.target)
                if (!srcArc || !tgtArc) return null

                const srcSpan = srcArc.endAngle - srcArc.startAngle
                const tgtSpan = tgtArc.endAngle - tgtArc.startAngle

                const srcSlice = (lk.strength / Math.max(srcArc.totalLinkValue, 1)) * srcSpan
                const tgtSlice = (lk.strength / Math.max(tgtArc.totalLinkValue, 1)) * tgtSpan

                const s0 = arcOffsets.get(lk.source) ?? srcArc.startAngle
                const s1 = Math.min(srcArc.endAngle, s0 + Math.max(0.014, srcSlice))
                arcOffsets.set(lk.source, s1)

                const t0 = arcOffsets.get(lk.target) ?? tgtArc.startAngle
                const t1 = Math.min(tgtArc.endAngle, t0 + Math.max(0.014, tgtSlice))
                arcOffsets.set(lk.target, t1)

                const key = `${lk.source}__${lk.target}`
                const meanScore = lk.mean_score ?? 8.0
                const scoreColor = getScoreSynergyColor(meanScore)

                return {
                    ...lk,
                    key,
                    srcArc,
                    tgtArc,
                    s0,
                    s1,
                    t0,
                    t1,
                    meanScore,
                    scoreColor,
                    path: describeChordRibbon(cx, cy, ribbonR, s0, s1, t0, t1),
                }
            })
            .filter(Boolean) as Array<
            TasteGraphLink & {
                key: string
                srcArc: (typeof arcs)[number]
                tgtArc: (typeof arcs)[number]
                s0: number
                s1: number
                t0: number
                t1: number
                meanScore: number
                scoreColor: string
                path: string
            }
        >

        return { arcs, chords, cx, cy, outerR, innerR }
    }, [computedDataset])

    // Nodo efectivo: prioridad a hover temporal sobre un nodo, luego al nodo fijado con clic, luego al primero
    const effectiveNodeId = hoveredNodeId || selectedNodeId

    const activeChord = useMemo(() => {
        if (!hoveredChordKey) return null
        return chordLayout.chords.find((c) => c.key === hoveredChordKey) || null
    }, [hoveredChordKey, chordLayout.chords])

    const activeArc = useMemo(() => {
        if (!chordLayout.arcs.length) return null
        if (effectiveNodeId) {
            return chordLayout.arcs.find((a) => a.id === effectiveNodeId) || chordLayout.arcs[0]
        }
        return chordLayout.arcs[0]
    }, [effectiveNodeId, chordLayout.arcs])

    const connectedNodeIds = useMemo(() => {
        const set = new Set<string>()
        if (hoveredChordKey && activeChord) {
            set.add(activeChord.source)
            set.add(activeChord.target)
            return set
        }
        if (!effectiveNodeId) return set
        set.add(effectiveNodeId)
        for (const ch of chordLayout.chords) {
            if (ch.source === effectiveNodeId) set.add(ch.target)
            if (ch.target === effectiveNodeId) set.add(ch.source)
        }
        return set
    }, [effectiveNodeId, hoveredChordKey, activeChord, chordLayout.chords])

    const sortedCombos = useMemo(() => {
        const list = [...computedDataset.combos]
        if (comboSortBy === 'score') {
            return list.sort((a, b) => (b.mean_score ?? 0) - (a.mean_score ?? 0) || b.count - a.count)
        }
        if (comboSortBy === 'count') {
            return list.sort((a, b) => b.count - a.count || (b.mean_score ?? 0) - (a.mean_score ?? 0))
        }
        return list.sort((a, b) => b.affinity_pct - a.affinity_pct || b.count - a.count)
    }, [computedDataset.combos, comboSortBy])

    const handleToggleSelectNode = (nodeId: string, label: string) => {
        setHoveredChordKey(null)
        setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
        onSelectTagFilter?.(label)
    }

    if (loading) {
        return (
            <div className="rec-analytics-card p-4 text-center">
                <div className="spinner-border spinner-border-sm text-secondary me-2" role="status" />
                <span className="text-secondary small">
                    Calculando diagrama de cuerdas y sinergia de tags...
                </span>
            </div>
        )
    }

    const hasAnyData =
        (analytics && analytics.nodes.length > 0) ||
        filas.some((f) => (f.anime.tagsData?.length || 0) > 0 || (f.anime.genres?.length || 0) > 0)

    if (!hasAnyData) {
        return (
            <section className="rec-analytics-card mb-4">
                <div className="rec-analytics-header mb-2">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span
                            className="rec-analytics-badge"
                            style={{ borderColor: accentColor, color: accentColor }}
                        >
                            <Network size={14} /> Conexiones de Tags & Sinergia de Notas
                        </span>
                        <h3 className="rec-analytics-title mb-0">Sin datos de calibración aún</h3>
                    </div>
                </div>
                <p className="rec-analytics-desc mb-3">
                    Añade animes a tu lista o realiza el test en la sección <strong>Recomendador</strong> para visualizar tu diagrama de cuerdas con la taxonomía de AniList.
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

    const archetypeTitle = analytics?.archetype?.title || 'Mapa de Sinergia de Media Tags'
    const archetypeDesc =
        analytics?.archetype?.description ||
        'Correlación circular entre etiquetas principales y secundarias de AniList ponderadas por la cantidad de obras vistas y tu nota media personal.'

    const activeArcDescription = activeArc
        ? getTagDescription(activeArc.label, activeArc.category, activeArc.is_main_tag)
        : ''

    return (
        <section className="rec-analytics-card mb-4">
            {/* Cabecera del módulo */}
            <div className="rec-analytics-header">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span
                        className="rec-analytics-badge"
                        style={{ borderColor: accentColor, color: accentColor }}
                    >
                        <Network size={14} /> Conexiones de Media Tags & Sinergia
                    </span>
                    <h3 className="rec-analytics-title mb-0">{archetypeTitle}</h3>
                </div>

                <div className="rec-analytics-tabs">
                    <button
                        type="button"
                        className={`rec-analytics-tab ${activeTab === 'graph' ? 'active' : ''}`}
                        onClick={() => setActiveTab('graph')}
                    >
                        <Compass size={14} /> Diagrama de Cuerdas
                    </button>
                    <button
                        type="button"
                        className={`rec-analytics-tab ${activeTab === 'combos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('combos')}
                    >
                        <Layers size={14} /> Matriz Cantidad vs. Nota ({computedDataset.combos.length})
                    </button>
                </div>
            </div>

            <p className="rec-analytics-desc mb-3">{archetypeDesc}</p>

            {activeTab === 'graph' ? (
                <div className="rec-chord-layout">
                    {/* Columna Izquierda: Diagrama Circular de Cuerdas (Chord Diagram) */}
                    <div className="rec-chord-canvas-wrap position-relative">
                        {chordLayout.arcs.length === 0 ? (
                            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center px-3 my-auto">
                                <Filter size={28} className="text-secondary mb-2" />
                                <div className="text-white fw-bold mb-1">
                                    No hay etiquetas que coincidan con estos filtros
                                </div>
                                <div className="small text-secondary mb-3">
                                    Prueba activando más categorías de taxonomía o cambiando el rango de nota personal.
                                </div>
                                <button
                                    type="button"
                                    className="rec-chord-pill active"
                                    onClick={() => {
                                        setSelectedTaxonomies([
                                            'main_tags',
                                            'secondary_tags',
                                            'Theme',
                                            'Cast',
                                            'Setting',
                                            'Genre',
                                        ])
                                        setScoreFilter('all')
                                    }}
                                >
                                    Restablecer filtros
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="position-relative w-100 d-flex justify-content-center">
                                    <svg
                                        viewBox="0 0 620 550"
                                        className="rec-chord-svg"
                                        role="img"
                                        aria-label="Diagrama de cuerdas de conexiones entre etiquetas y nota media"
                                    >
                                        <defs>
                                            <radialGradient id="chordCenterVoid" cx="50%" cy="50%" r="50%">
                                                <stop offset="0%" stopColor="#09090d" stopOpacity="0.95" />
                                                <stop offset="85%" stopColor="#0d0d14" stopOpacity="0.6" />
                                                <stop offset="100%" stopColor="#12121c" stopOpacity="0" />
                                            </radialGradient>
                                        </defs>

                                        {/* Fondo circular interior (clic en el centro desfija la selección) */}
                                        <circle
                                            cx={chordLayout.cx}
                                            cy={chordLayout.cy}
                                            r={chordLayout.innerR}
                                            fill="url(#chordCenterVoid)"
                                            onClick={() => setSelectedNodeId(null)}
                                            style={{ cursor: selectedNodeId ? 'pointer' : 'default' }}
                                        />

                                        {/* Cuerdas interiores (Ribbons Bézier) */}
                                        {chordLayout.chords.map((ch) => {
                                            const isNodeActive =
                                                effectiveNodeId !== null &&
                                                (ch.source === effectiveNodeId || ch.target === effectiveNodeId)
                                            const isChordHovered = hoveredChordKey === ch.key
                                            const isHighlighted = isNodeActive || isChordHovered
                                            const hasAnyFocus =
                                                effectiveNodeId !== null || hoveredChordKey !== null

                                            let fillColor = ch.scoreColor
                                            if (colorMode === 'palette') {
                                                if (effectiveNodeId === ch.target) {
                                                    fillColor = ch.tgtArc.paletteColor
                                                } else {
                                                    fillColor = ch.srcArc.paletteColor
                                                }
                                            }

                                            const fillOpacity = isChordHovered
                                                ? 0.92
                                                : isNodeActive
                                                  ? 0.84
                                                  : hasAnyFocus
                                                    ? 0.08
                                                    : 0.34

                                            return (
                                                <path
                                                    key={ch.key}
                                                    d={ch.path}
                                                    fill={fillColor}
                                                    fillOpacity={fillOpacity}
                                                    stroke={isHighlighted ? fillColor : 'none'}
                                                    strokeWidth={isHighlighted ? 0.9 : 0}
                                                    strokeOpacity={isHighlighted ? 0.95 : 0}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'fill-opacity 0.2s ease, stroke-opacity 0.2s ease',
                                                    }}
                                                    onMouseEnter={() => {
                                                        setHoveredChordKey(ch.key)
                                                        setHoveredNodeId(null)
                                                    }}
                                                    onMouseLeave={() => setHoveredChordKey(null)}
                                                />
                                            )
                                        })}

                                        {/* Arcos perimetrales y etiquetas radiales clickeables */}
                                        {chordLayout.arcs.map((arc) => {
                                            const isSelected = selectedNodeId === arc.id
                                            const isHovered = hoveredNodeId === arc.id
                                            const isActive = isSelected || isHovered
                                            const isConnected =
                                                (!effectiveNodeId && !hoveredChordKey) ||
                                                connectedNodeIds.has(arc.id)
                                            const arcColor =
                                                colorMode === 'palette' ? arc.paletteColor : arc.scoreColor

                                            const labelR = (chordLayout.outerR || 186) + 14
                                            const labelPos = polarToCartesian(
                                                chordLayout.cx || 310,
                                                chordLayout.cy || 275,
                                                labelR,
                                                arc.midAngle
                                            )
                                            const deg = ((arc.midAngle * 180) / Math.PI + 360) % 360
                                            const isLeftSide = deg > 90 && deg < 270
                                            const textRotation = isLeftSide ? deg + 180 : deg
                                            const textAnchor = isLeftSide ? 'end' : 'start'

                                            return (
                                                <g
                                                    key={arc.id}
                                                    style={{
                                                        opacity: isConnected ? 1 : 0.25,
                                                        cursor: 'pointer',
                                                        transition: 'opacity 0.2s ease',
                                                    }}
                                                    onMouseEnter={() => {
                                                        setHoveredNodeId(arc.id)
                                                        setHoveredChordKey(null)
                                                    }}
                                                    onMouseLeave={() => setHoveredNodeId(null)}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleToggleSelectNode(arc.id, arc.label)
                                                    }}
                                                >
                                                    <path
                                                        d={arc.path}
                                                        fill={arcColor}
                                                        stroke={isSelected ? '#ffffff' : '#09090d'}
                                                        strokeWidth={isSelected ? 2.4 : isHovered ? 2 : 1.2}
                                                        style={{
                                                            filter: isActive
                                                                ? `drop-shadow(0 0 9px ${arcColor}aa)`
                                                                : 'none',
                                                        }}
                                                    />

                                                    <text
                                                        transform={`translate(${labelPos.x.toFixed(2)}, ${labelPos.y.toFixed(2)}) rotate(${textRotation.toFixed(2)})`}
                                                        textAnchor={textAnchor}
                                                        dominantBaseline="central"
                                                        fill={isActive ? '#ffffff' : '#d4d4d8'}
                                                        fontSize={isActive ? '11.5' : '10.5'}
                                                        fontWeight={isActive ? '800' : '600'}
                                                        style={{
                                                            userSelect: 'none',
                                                            textDecoration: isSelected ? 'underline' : 'none',
                                                        }}
                                                    >
                                                        {arc.label.length > 20
                                                            ? `${arc.label.slice(0, 19)}…`
                                                            : arc.label}
                                                    </text>
                                                </g>
                                            )
                                        })}

                                        {/* Tooltip flotante sobre el diagrama */}
                                        {(effectiveNodeId || hoveredChordKey) && (
                                            <g
                                                transform={`translate(${chordLayout.cx}, ${(chordLayout.cy || 275) + 115})`}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <rect
                                                    x="-142"
                                                    y="-24"
                                                    width="284"
                                                    height="46"
                                                    rx="8"
                                                    fill="rgba(18, 19, 28, 0.94)"
                                                    stroke={
                                                        activeChord
                                                            ? activeChord.scoreColor
                                                            : activeArc
                                                              ? colorMode === 'palette'
                                                                  ? activeArc.paletteColor
                                                                  : activeArc.scoreColor
                                                              : accentColor
                                                    }
                                                    strokeWidth="1.5"
                                                />
                                                <text
                                                    x="0"
                                                    y="-5"
                                                    textAnchor="middle"
                                                    fill="#ffffff"
                                                    fontSize="11.5"
                                                    fontWeight="800"
                                                >
                                                    {activeChord
                                                        ? `${activeChord.source} ↔ ${activeChord.target}`
                                                        : `${activeArc?.label || ''}${selectedNodeId === activeArc?.id ? ' 📌' : ''}`}
                                                </text>
                                                <text
                                                    x="0"
                                                    y="12"
                                                    textAnchor="middle"
                                                    fill="#a1a1aa"
                                                    fontSize="10"
                                                    fontWeight="600"
                                                >
                                                    {activeChord
                                                        ? `${activeChord.strength} obras compartidas · ★ ${activeChord.meanScore.toFixed(2)} media`
                                                        : `${activeArc?.count || 0} obras · ★ ${(activeArc?.mean_score ?? 8.0).toFixed(2)} nota media`}
                                                </text>
                                            </g>
                                        )}
                                    </svg>
                                </div>

                                {/* Leyenda inferior de temperatura de Nota Media */}
                                <div className="rec-graph-legend">
                                    {colorMode === 'score' ? (
                                        <>
                                            <span className="rec-graph-legend-item">
                                                <span
                                                    className="rec-graph-legend-dot"
                                                    style={{ backgroundColor: '#10b981' }}
                                                />
                                                ★ 8.6–10 Sinergia de Oro
                                            </span>
                                            <span className="rec-graph-legend-item">
                                                <span
                                                    className="rec-graph-legend-dot"
                                                    style={{ backgroundColor: '#a855f7' }}
                                                />
                                                ★ 8.0–8.5 Muy Alta
                                            </span>
                                            <span className="rec-graph-legend-item">
                                                <span
                                                    className="rec-graph-legend-dot"
                                                    style={{ backgroundColor: '#38bdf8' }}
                                                />
                                                ★ 7.3–7.9 Sólida
                                            </span>
                                            <span className="rec-graph-legend-item">
                                                <span
                                                    className="rec-graph-legend-dot"
                                                    style={{ backgroundColor: '#f59e0b' }}
                                                />
                                                ★ 6.5–7.2 Moderada
                                            </span>
                                            <span className="rec-graph-legend-item">
                                                <span
                                                    className="rec-graph-legend-dot"
                                                    style={{ backgroundColor: '#f43f5e' }}
                                                />
                                                ★ &lt;6.5 Baja Nota
                                            </span>
                                        </>
                                    ) : (
                                        <span className="rec-graph-legend-item">
                                            Grosor de cuerda = Cantidad de obras compartidas · Color = Identificador del Tag seleccionado
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Columna Derecha: Controles de Taxonomía, Filtros, Inspector y "¿Cómo funciona?" */}
                    <div className="rec-chord-sidebar">
                        {/* 1. Tarjeta Inspector en vivo (con icono "i" arriba a la derecha SOLO para géneros/taxonomías individuales) */}
                        <div className="rec-chord-panel position-relative">
                            {activeChord ? (
                                <>
                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                        <span
                                            className="rec-inspector-cat"
                                            style={{ color: activeChord.scoreColor }}
                                        >
                                            {getScoreSynergyLabel(activeChord.meanScore)}
                                        </span>
                                        <span className="rec-inspector-weight d-inline-flex align-items-center gap-1">
                                            <Star size={11} fill="#facc15" color="#facc15" />
                                            {activeChord.meanScore.toFixed(2)} media
                                        </span>
                                    </div>
                                    <h4 className="rec-inspector-node-title mb-1" style={{ fontSize: '1.02rem' }}>
                                        {activeChord.source} + {activeChord.target}
                                    </h4>
                                    <p className="rec-inspector-hint mb-2">
                                        Co-ocurren en <strong>{activeChord.strength}</strong> obras analizadas de tu perfil.
                                    </p>
                                    {activeChord.shared_animes.length > 0 && (
                                        <div className="d-flex flex-wrap gap-1">
                                            {activeChord.shared_animes.slice(0, 4).map((title) => (
                                                <span key={title} className="rec-inspector-chip">
                                                    {title}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : activeArc ? (
                                <>
                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                        <span
                                            className="rec-inspector-cat"
                                            style={{
                                                color:
                                                    colorMode === 'palette'
                                                        ? activeArc.paletteColor
                                                        : activeArc.scoreColor,
                                            }}
                                        >
                                            {CATEGORY_LABELS[activeArc.category] || activeArc.category} ·{' '}
                                            {activeArc.is_main_tag ? 'Main Tag' : 'Secondary Tag'}
                                        </span>

                                        <div className="d-flex align-items-center gap-1.5">
                                            <span className="rec-inspector-weight d-inline-flex align-items-center gap-1">
                                                <Star size={11} fill="#facc15" color="#facc15" />
                                                {(activeArc.mean_score ?? 8.0).toFixed(2)}
                                            </span>

                                            {/* Icono "i" de información arriba a la derecha para explicar el género/taxonomía individual */}
                                            <div
                                                className="rec-tag-info-anchor"
                                                onMouseEnter={() => setHoveredInfoTarget('inspector')}
                                                onMouseLeave={() => setHoveredInfoTarget(null)}
                                            >
                                                <button
                                                    type="button"
                                                    className="rec-inspector-info-icon"
                                                    aria-label={`Explicación de ${activeArc.label}`}
                                                >
                                                    i
                                                </button>

                                                {hoveredInfoTarget === 'inspector' && (
                                                    <div className="rec-tag-info-popover rec-tag-info-popover-right">
                                                        <div className="rec-tag-info-popover-header">
                                                            <span
                                                                className="rec-tag-info-popover-cat"
                                                                style={{
                                                                    color:
                                                                        colorMode === 'palette'
                                                                            ? activeArc.paletteColor
                                                                            : activeArc.scoreColor,
                                                                }}
                                                            >
                                                                {CATEGORY_LABELS[activeArc.category] ||
                                                                    activeArc.category}{' '}
                                                                ·{' '}
                                                                {activeArc.is_main_tag
                                                                    ? 'Main Tag (≥72%)'
                                                                    : 'Secondary Tag (<72%)'}
                                                            </span>
                                                        </div>
                                                        <div className="rec-tag-info-popover-title">
                                                            {activeArc.label}
                                                        </div>
                                                        <p className="rec-tag-info-popover-desc mb-2">
                                                            {activeArcDescription}
                                                        </p>
                                                        <div className="rec-tag-info-popover-meta">
                                                            <span>
                                                                Relevancia en AniList:{' '}
                                                                <strong>{activeArc.avg_rank ?? 78}%</strong>
                                                            </span>
                                                            <span>
                                                                Obras en tu perfil:{' '}
                                                                <strong>{activeArc.count}</strong>
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                        <h4 className="rec-inspector-node-title mb-0" style={{ fontSize: '1.08rem' }}>
                                            {activeArc.label}
                                        </h4>
                                        {selectedNodeId === activeArc.id && (
                                            <span className="rec-inspector-pinned-badge">Seleccionado</span>
                                        )}
                                    </div>
                                    <p className="rec-inspector-hint mb-2">
                                        Presente en <strong>{activeArc.count}</strong> obras · Relevancia AniList{' '}
                                        <strong>{activeArc.avg_rank ?? 78}%</strong>.
                                    </p>
                                    {activeArc.sample_animes.length > 0 && (
                                        <div className="d-flex flex-wrap gap-1">
                                            {activeArc.sample_animes.slice(0, 4).map((title) => (
                                                <span key={title} className="rec-inspector-chip">
                                                    {title}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>

                        {/* 2. Selector de Taxonomía AniList con icono "i" explicativo por categoría */}
                        <div className="rec-chord-panel">
                            <div className="rec-chord-section-label mb-2">
                                <Check size={13} /> Selecciona 1 o más (Taxonomía AniList)
                            </div>
                            <div className="rec-chord-pills-grid">
                                {(
                                    [
                                        { id: 'main_tags', label: 'Main Tags (≥72%)' },
                                        { id: 'secondary_tags', label: 'Secondary Tags' },
                                        { id: 'Theme', label: 'Temáticas / Tropos' },
                                        { id: 'Cast', label: 'Elenco / Cast' },
                                        { id: 'Setting', label: 'Ambientación' },
                                        { id: 'Genre', label: 'Géneros Clásicos' },
                                    ] as Array<{ id: TaxonomyFilterId; label: string }>
                                ).map((item) => {
                                    const active = selectedTaxonomies.includes(item.id)
                                    const isInfoOpen = hoveredInfoTarget === item.id
                                    return (
                                        <div key={item.id} className="position-relative d-inline-flex">
                                            <button
                                                type="button"
                                                className={`rec-chord-pill ${active ? 'active' : ''}`}
                                                onClick={() => toggleTaxonomy(item.id)}
                                            >
                                                {active && <span className="rec-chord-pill-check">✓</span>}
                                                <span>{item.label}</span>
                                                <span
                                                    className="rec-chord-pill-info"
                                                    onMouseEnter={(e) => {
                                                        e.stopPropagation()
                                                        setHoveredInfoTarget(item.id)
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.stopPropagation()
                                                        setHoveredInfoTarget(null)
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label={`Qué es ${item.label}`}
                                                >
                                                    i
                                                </span>
                                            </button>

                                            {isInfoOpen && (
                                                <div className="rec-tag-info-popover rec-tag-info-popover-tax">
                                                    <div className="rec-tag-info-popover-title">{item.label}</div>
                                                    <p className="rec-tag-info-popover-desc mb-0">
                                                        {TAXONOMY_CATEGORY_DESCRIPTIONS[item.id]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="rec-chord-section-label mt-3 mb-2">
                                <SlidersHorizontal size={13} /> Filtros de Nota y Color
                            </div>
                            <div className="d-flex flex-column gap-2">
                                <div className="d-flex align-items-center justify-content-between gap-2">
                                    <span className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                                        Nota en Lista:
                                    </span>
                                    <select
                                        className="rec-chord-select"
                                        value={scoreFilter}
                                        onChange={(e) => setScoreFilter(e.target.value as ScoreFilterMode)}
                                    >
                                        <option value="all">Todas las notas</option>
                                        <option value="high_8">Favoritos (★ 8 – 10)</option>
                                        <option value="good_7">Notas buenas (★ 7+)</option>
                                        <option value="low_6">Notas críticas (★ ≤ 6)</option>
                                    </select>
                                </div>

                                <div className="d-flex align-items-center justify-content-between gap-2">
                                    <span className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                                        Color de Cuerdas:
                                    </span>
                                    <select
                                        className="rec-chord-select"
                                        value={colorMode}
                                        onChange={(e) => setColorMode(e.target.value as ColorMode)}
                                    >
                                        <option value="score">★ Por Nota Media (Sinergia)</option>
                                        <option value="palette">🎨 Por Color del Tag</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 3. Explicación "¿Cómo funciona?" */}
                        <div className="rec-chord-panel">
                            <button
                                type="button"
                                className="rec-chord-how-toggle"
                                onClick={() => setHowItWorksOpen((prev) => !prev)}
                            >
                                <span>¿Cómo funciona este gráfico?</span>
                                {howItWorksOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            {howItWorksOpen && (
                                <div className="rec-chord-how-body mt-2">
                                    <p className="mb-2">
                                        Este diagrama muestra qué <strong>Media Tags de AniList</strong> co-ocurren en los animes de tu lista (ej. <em>Vikings</em> y <em>Revenge</em>).
                                    </p>
                                    <p className="mb-2">
                                        <strong>Haz clic en un género o tag:</strong> Fija ese elemento en el panel superior derecho y pasa el cursor sobre el icono <strong>"i"</strong> para leer en qué consiste esa etiqueta o taxonomía.
                                    </p>
                                    <p className="mb-0">
                                        <strong>Grosor y Color:</strong> El grosor de cada cuerda indica la cantidad de animes compartidos, y su color refleja la <strong>nota media (★)</strong> que les diste.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Pestaña 2: Matriz de Sinergia (Cantidad vs. Nota Media) */
                <div>
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                        <div className="small text-secondary">
                            Combinaciones evaluadas cruzando <strong>frecuencia de aparición</strong> y{' '}
                            <strong>nota media otorgada</strong>.
                        </div>
                        <div className="d-flex align-items-center gap-1">
                            <span className="small text-secondary me-1" style={{ fontSize: '0.75rem' }}>
                                Ordenar por:
                            </span>
                            {(
                                [
                                    { id: 'synergy', label: 'Mayor Sinergia' },
                                    { id: 'score', label: '★ Nota Media' },
                                    { id: 'count', label: 'Cantidad de Obras' },
                                ] as const
                            ).map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`rec-chord-pill ${comboSortBy === opt.id ? 'active' : ''}`}
                                    onClick={() => setComboSortBy(opt.id)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rec-combos-grid">
                        {sortedCombos.length === 0 ? (
                            <div className="text-secondary small p-3">
                                Ajusta los filtros de taxonomía o agrega más animes calificados para ver las combinaciones de tags.
                            </div>
                        ) : (
                            sortedCombos.slice(0, 18).map((combo) => {
                                const sc = combo.mean_score ?? 8.0
                                const badgeColor = getScoreSynergyColor(sc)
                                return (
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
                                        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                            <span className="rec-combo-pair text-truncate">
                                                <Flame size={14} style={{ color: badgeColor, flexShrink: 0 }} />
                                                <span className="text-truncate">{combo.pair}</span>
                                            </span>
                                            <span
                                                className="rec-combo-pct flex-shrink-0 d-inline-flex align-items-center gap-1"
                                                style={{ color: badgeColor }}
                                            >
                                                ★ {sc.toFixed(2)} · {combo.count}{' '}
                                                {combo.count === 1 ? 'obra' : 'obras'}
                                            </span>
                                        </div>
                                        <div className="rec-combo-bar-bg mb-2">
                                            <div
                                                className="rec-combo-bar-fill"
                                                style={{
                                                    width: `${combo.affinity_pct}%`,
                                                    backgroundColor: badgeColor,
                                                }}
                                            />
                                        </div>
                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                            {combo.examples.length > 0 ? (
                                                <div className="rec-combo-examples">
                                                    Converge en: {combo.examples.join(' · ')}
                                                </div>
                                            ) : (
                                                <div className="rec-combo-examples">Combinación detectada</div>
                                            )}
                                            <span
                                                className="small fw-bold flex-shrink-0"
                                                style={{ fontSize: '0.7rem', color: '#a1a1aa' }}
                                            >
                                                {combo.affinity_pct}% sinergia
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </section>
    )
}
