import React, { useState, useMemo, useCallback } from 'react'
import {
    Layers,
    Search,
} from 'lucide-react'
import type { FilaLista } from '../mi-lista/mi-lista-data'
import type { TasteAnalyticsResponse } from '../../services/recommenderApi'

export interface VennDiagramGenreExplorerProps {
    filas: FilaLista[]
    tasteAnalytics?: TasteAnalyticsResponse | null
    onSelectAnime?: (fila: FilaLista) => void
    accentColor?: string
}

export type VennCategoryFilter = 'all' | 'Genre' | 'Theme' | 'Cast' | 'Setting'

export interface VennEntity {
    id: string
    name: string
    category: 'Genre' | 'Theme' | 'Cast' | 'Setting' | 'Technical'
    categoryLabel: string
    count: number
    animes: FilaLista[]
}

export type RegionId = 'only_a' | 'only_b' | 'only_c' | 'ab' | 'ac' | 'bc' | 'abc'

export interface VennRegionData {
    id: RegionId
    label: string
    shortLabel: string
    description: string
    animes: FilaLista[]
    count: number
    pctOfList: number
    color: string
    accentColor: string
    isIntersection: boolean
    activeEntityNames: string[]
}

const CATEGORY_NAMES: Record<string, string> = {
    Genre: 'Género',
    Theme: 'Temática',
    Cast: 'Elenco',
    Setting: 'Ambientación',
    Technical: 'Narrativa',
}

const SET_PALETTES = [
    {
        name: 'Set A',
        color: '#8b5cf6', // Violeta / Púrpura
        softBg: 'rgba(139, 92, 246, 0.16)',
        stroke: '#a78bfa',
        glow: 'rgba(139, 92, 246, 0.35)',
    },
    {
        name: 'Set B',
        color: '#ec4899', // Rosa / Fucsia
        softBg: 'rgba(236, 72, 153, 0.16)',
        stroke: '#f472b6',
        glow: 'rgba(236, 72, 153, 0.35)',
    },
    {
        name: 'Set C',
        color: '#06b6d4', // Cian / Turquesa
        softBg: 'rgba(6, 182, 212, 0.16)',
        stroke: '#22d3ee',
        glow: 'rgba(6, 182, 212, 0.35)',
    },
]

function normalizeCategory(rawCat?: string): 'Genre' | 'Theme' | 'Cast' | 'Setting' | 'Technical' {
    if (!rawCat) return 'Theme'
    const c = rawCat.toLowerCase().trim()
    if (c === 'genre') return 'Genre'
    if (c.startsWith('cast') || c.includes('protagonist')) return 'Cast'
    if (c.startsWith('setting') || c.includes('scene')) return 'Setting'
    if (c.startsWith('technical') || c.startsWith('demographic')) return 'Technical'
    return 'Theme'
}

function doesAnimeMatchEntity(f: FilaLista, entityName: string): boolean {
    const target = entityName.trim().toLowerCase()
    if (f.anime.genres?.some((g) => g.trim().toLowerCase() === target)) return true
    if (f.anime.tagsData?.some((td) => td?.name?.trim().toLowerCase() === target)) return true
    if (f.tags?.some((t) => t.replace(/^#/, '').trim().toLowerCase() === target)) return true
    return false
}

export const VennDiagramGenreExplorer: React.FC<VennDiagramGenreExplorerProps> = ({
    filas,
    tasteAnalytics,
    onSelectAnime,
    accentColor = 'var(--perfil-acento)',
}) => {
    // 1. Extraer y catalogar todas las entidades (Géneros, Temáticas, Elenco, Ambientación) presentes en la lista
    const allEntities = useMemo<VennEntity[]>(() => {
        const entityMap = new Map<string, VennEntity>()

        for (const f of filas) {
            // A) Géneros oficiales del anime
            for (const g of f.anime.genres || []) {
                const clean = g.trim()
                if (!clean) continue
                const key = `Genre:${clean.toLowerCase()}`
                const existing = entityMap.get(key)
                if (existing) {
                    if (!existing.animes.some((x) => x.id === f.id)) {
                        existing.animes.push(f)
                        existing.count += 1
                    }
                } else {
                    entityMap.set(key, {
                        id: key,
                        name: clean,
                        category: 'Genre',
                        categoryLabel: CATEGORY_NAMES.Genre,
                        count: 1,
                        animes: [f],
                    })
                }
            }

            // B) Tags analizados (AniList / MAL)
            for (const td of f.anime.tagsData || []) {
                if (!td?.name || td.spoiler) continue
                const clean = td.name.trim()
                if (!clean) continue
                const cat = normalizeCategory(td.category)
                const key = `${cat}:${clean.toLowerCase()}`
                const existing = entityMap.get(key)
                if (existing) {
                    if (!existing.animes.some((x) => x.id === f.id)) {
                        existing.animes.push(f)
                        existing.count += 1
                    }
                } else {
                    entityMap.set(key, {
                        id: key,
                        name: clean,
                        category: cat,
                        categoryLabel: CATEGORY_NAMES[cat] || cat,
                        count: 1,
                        animes: [f],
                    })
                }
            }

            // C) Custom tags del usuario
            for (const ct of f.tags || []) {
                const clean = ct.replace(/^#/, '').trim()
                if (!clean) continue
                const key = `Theme:${clean.toLowerCase()}`
                const existing = entityMap.get(key)
                if (existing) {
                    if (!existing.animes.some((x) => x.id === f.id)) {
                        existing.animes.push(f)
                        existing.count += 1
                    }
                } else {
                    entityMap.set(key, {
                        id: key,
                        name: clean,
                        category: 'Theme',
                        categoryLabel: CATEGORY_NAMES.Theme,
                        count: 1,
                        animes: [f],
                    })
                }
            }
        }

        // Si tenemos nodos enriquecidos desde tasteAnalytics, armonizamos las categorías
        if (tasteAnalytics?.nodes) {
            for (const node of tasteAnalytics.nodes) {
                const normCat = normalizeCategory(node.category)
                const key = `${normCat}:${node.label.toLowerCase()}`
                const existing = entityMap.get(key)
                if (existing && !existing.categoryLabel) {
                    existing.category = normCat
                    existing.categoryLabel = CATEGORY_NAMES[normCat] || normCat
                }
            }
        }

        return Array.from(entityMap.values()).sort((a, b) => b.count - a.count)
    }, [filas, tasteAnalytics])

    // Filtros de categoría para selector de pills
    const [selectedCategoryTab, setSelectedCategoryTab] = useState<VennCategoryFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [isTriVenn, setIsTriVenn] = useState<boolean>(true)

    // Entidades activas en el diagrama de Venn (IDs)
    const [activeEntityIds, setActiveEntityIds] = useState<string[]>(() => {
        if (allEntities.length === 0) return []
        // Tomar las top 3 o top 2 por defecto
        const topIds = allEntities.slice(0, 3).map((e) => e.id)
        return topIds
    })

    // Asegurar que si cambian las filas, tengamos entidades válidas seleccionadas
    const activeEntities = useMemo(() => {
        const selected = activeEntityIds
            .map((id) => allEntities.find((e) => e.id === id))
            .filter((e): e is VennEntity => Boolean(e))

        // Si por alguna razón hay menos de 2 pero existen entidades disponibles, completamos
        if (selected.length < 2 && allEntities.length >= 2) {
            return allEntities.slice(0, isTriVenn ? 3 : 2)
        }
        return isTriVenn ? selected.slice(0, 3) : selected.slice(0, 2)
    }, [activeEntityIds, allEntities, isTriVenn])

    // Alternar entidad activa al hacer click en un chip
    const handleToggleEntity = useCallback(
        (entityId: string) => {
            setActiveEntityIds((prev) => {
                const maxSets = isTriVenn ? 3 : 2
                if (prev.includes(entityId)) {
                    // No permitir deseleccionar si quedan menos de 2
                    if (prev.length <= 2) return prev
                    return prev.filter((id) => id !== entityId)
                }

                if (prev.length < maxSets) {
                    return [...prev, entityId]
                }
                // Si ya está lleno (3 o 2), reemplazamos el último para una experiencia fluida
                const next = [...prev]
                next[next.length - 1] = entityId
                return next
            })
        },
        [isTriVenn]
    )

    // Filtrar la lista de entidades disponibles para seleccionar
    const filteredAvailableEntities = useMemo(() => {
        return allEntities.filter((e) => {
            if (selectedCategoryTab !== 'all' && e.category !== selectedCategoryTab) {
                return false
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                return e.name.toLowerCase().includes(q) || e.categoryLabel.toLowerCase().includes(q)
            }
            return true
        })
    }, [allEntities, selectedCategoryTab, searchQuery])

    // 2. Cálculo Matemático de Universos e Intersecciones
    const setA = activeEntities[0] || null
    const setB = activeEntities[1] || null
    const setC = isTriVenn && activeEntities.length > 2 ? activeEntities[2] : null

    const regionsData = useMemo<Record<RegionId, VennRegionData>>(() => {
        const totalFilasCount = Math.max(1, filas.length)

        const animesA = setA ? setA.animes : []
        const animesB = setB ? setB.animes : []
        const animesC = setC ? setC.animes : []

        const idsA = new Set(animesA.map((x) => x.id))
        const idsB = new Set(animesB.map((x) => x.id))
        const idsC = new Set(animesC.map((x) => x.id))

        if (setC) {
            // Tri-Venn (3 Conjuntos)
            const listOnlyA = animesA.filter((f) => !idsB.has(f.id) && !idsC.has(f.id))
            const listOnlyB = animesB.filter((f) => !idsA.has(f.id) && !idsC.has(f.id))
            const listOnlyC = animesC.filter((f) => !idsA.has(f.id) && !idsB.has(f.id))

            const listAB = animesA.filter((f) => idsB.has(f.id) && !idsC.has(f.id))
            const listAC = animesA.filter((f) => idsC.has(f.id) && !idsB.has(f.id))
            const listBC = animesB.filter((f) => idsC.has(f.id) && !idsA.has(f.id))

            const listABC = animesA.filter((f) => idsB.has(f.id) && idsC.has(f.id))

            return {
                only_a: {
                    id: 'only_a',
                    label: `Solo ${setA?.name || 'A'}`,
                    shortLabel: `Solo ${setA?.name || 'A'}`,
                    description: `Obras que contienen exclusivamente ${setA?.name}, sin solaparse con ${setB?.name} ni ${setC?.name}.`,
                    animes: listOnlyA,
                    count: listOnlyA.length,
                    pctOfList: Math.round((listOnlyA.length / totalFilasCount) * 100),
                    color: SET_PALETTES[0].color,
                    accentColor: SET_PALETTES[0].stroke,
                    isIntersection: false,
                    activeEntityNames: [setA?.name || ''],
                },
                only_b: {
                    id: 'only_b',
                    label: `Solo ${setB?.name || 'B'}`,
                    shortLabel: `Solo ${setB?.name || 'B'}`,
                    description: `Obras que contienen exclusivamente ${setB?.name}, sin solaparse con ${setA?.name} ni ${setC?.name}.`,
                    animes: listOnlyB,
                    count: listOnlyB.length,
                    pctOfList: Math.round((listOnlyB.length / totalFilasCount) * 100),
                    color: SET_PALETTES[1].color,
                    accentColor: SET_PALETTES[1].stroke,
                    isIntersection: false,
                    activeEntityNames: [setB?.name || ''],
                },
                only_c: {
                    id: 'only_c',
                    label: `Solo ${setC?.name || 'C'}`,
                    shortLabel: `Solo ${setC?.name || 'C'}`,
                    description: `Obras que contienen exclusivamente ${setC?.name}, sin solaparse con ${setA?.name} ni ${setB?.name}.`,
                    animes: listOnlyC,
                    count: listOnlyC.length,
                    pctOfList: Math.round((listOnlyC.length / totalFilasCount) * 100),
                    color: SET_PALETTES[2].color,
                    accentColor: SET_PALETTES[2].stroke,
                    isIntersection: false,
                    activeEntityNames: [setC?.name || ''],
                },
                ab: {
                    id: 'ab',
                    label: `${setA?.name} ∩ ${setB?.name}`,
                    shortLabel: `${setA?.name} + ${setB?.name}`,
                    description: `Intersección doble: Obras que combinan ${setA?.name} y ${setB?.name} (sin incluir ${setC?.name}).`,
                    animes: listAB,
                    count: listAB.length,
                    pctOfList: Math.round((listAB.length / totalFilasCount) * 100),
                    color: '#c084fc',
                    accentColor: '#d8b4fe',
                    isIntersection: true,
                    activeEntityNames: [setA?.name || '', setB?.name || ''],
                },
                ac: {
                    id: 'ac',
                    label: `${setA?.name} ∩ ${setC?.name}`,
                    shortLabel: `${setA?.name} + ${setC?.name}`,
                    description: `Intersección doble: Obras que combinan ${setA?.name} y ${setC?.name} (sin incluir ${setB?.name}).`,
                    animes: listAC,
                    count: listAC.length,
                    pctOfList: Math.round((listAC.length / totalFilasCount) * 100),
                    color: '#38bdf8',
                    accentColor: '#7dd3fc',
                    isIntersection: true,
                    activeEntityNames: [setA?.name || '', setC?.name || ''],
                },
                bc: {
                    id: 'bc',
                    label: `${setB?.name} ∩ ${setC?.name}`,
                    shortLabel: `${setB?.name} + ${setC?.name}`,
                    description: `Intersección doble: Obras que combinan ${setB?.name} y ${setC?.name} (sin incluir ${setA?.name}).`,
                    animes: listBC,
                    count: listBC.length,
                    pctOfList: Math.round((listBC.length / totalFilasCount) * 100),
                    color: '#2dd4bf',
                    accentColor: '#5eead4',
                    isIntersection: true,
                    activeEntityNames: [setB?.name || '', setC?.name || ''],
                },
                abc: {
                    id: 'abc',
                    label: `${setA?.name} ∩ ${setB?.name} ∩ ${setC?.name}`,
                    shortLabel: `${setA?.name} + ${setB?.name} + ${setC?.name}`,
                    description: `Núcleo de Intersección Triple: Obras que poseen simultáneamente ${setA?.name}, ${setB?.name} y ${setC?.name}.`,
                    animes: listABC,
                    count: listABC.length,
                    pctOfList: Math.round((listABC.length / totalFilasCount) * 100),
                    color: '#f59e0b',
                    accentColor: '#fbbf24',
                    isIntersection: true,
                    activeEntityNames: [setA?.name || '', setB?.name || '', setC?.name || ''],
                },
            }
        }

        // Bi-Venn (2 Conjuntos)
        const listOnlyA = animesA.filter((f) => !idsB.has(f.id))
        const listOnlyB = animesB.filter((f) => !idsA.has(f.id))
        const listAB = animesA.filter((f) => idsB.has(f.id))

        return {
            only_a: {
                id: 'only_a',
                label: `Solo ${setA?.name || 'A'}`,
                shortLabel: `Solo ${setA?.name || 'A'}`,
                description: `Obras con ${setA?.name} que no poseen ${setB?.name}.`,
                animes: listOnlyA,
                count: listOnlyA.length,
                pctOfList: Math.round((listOnlyA.length / totalFilasCount) * 100),
                color: SET_PALETTES[0].color,
                accentColor: SET_PALETTES[0].stroke,
                isIntersection: false,
                activeEntityNames: [setA?.name || ''],
            },
            only_b: {
                id: 'only_b',
                label: `Solo ${setB?.name || 'B'}`,
                shortLabel: `Solo ${setB?.name || 'B'}`,
                description: `Obras con ${setB?.name} que no poseen ${setA?.name}.`,
                animes: listOnlyB,
                count: listOnlyB.length,
                pctOfList: Math.round((listOnlyB.length / totalFilasCount) * 100),
                color: SET_PALETTES[1].color,
                accentColor: SET_PALETTES[1].stroke,
                isIntersection: false,
                activeEntityNames: [setB?.name || ''],
            },
            only_c: {
                id: 'only_c',
                label: 'No aplicable',
                shortLabel: '-',
                description: '',
                animes: [],
                count: 0,
                pctOfList: 0,
                color: '#71717a',
                accentColor: '#71717a',
                isIntersection: false,
                activeEntityNames: [],
            },
            ab: {
                id: 'ab',
                label: `${setA?.name} ∩ ${setB?.name}`,
                shortLabel: `${setA?.name} + ${setB?.name}`,
                description: `Obras que combinan simultáneamente ${setA?.name} y ${setB?.name}.`,
                animes: listAB,
                count: listAB.length,
                pctOfList: Math.round((listAB.length / totalFilasCount) * 100),
                color: '#f59e0b',
                accentColor: '#fbbf24',
                isIntersection: true,
                activeEntityNames: [setA?.name || '', setB?.name || ''],
            },
            ac: {
                id: 'ac',
                label: 'No aplicable',
                shortLabel: '-',
                description: '',
                animes: [],
                count: 0,
                pctOfList: 0,
                color: '#71717a',
                accentColor: '#71717a',
                isIntersection: false,
                activeEntityNames: [],
            },
            bc: {
                id: 'bc',
                label: 'No aplicable',
                shortLabel: '-',
                description: '',
                animes: [],
                count: 0,
                pctOfList: 0,
                color: '#71717a',
                accentColor: '#71717a',
                isIntersection: false,
                activeEntityNames: [],
            },
            abc: {
                id: 'abc',
                label: 'No aplicable',
                shortLabel: '-',
                description: '',
                animes: [],
                count: 0,
                pctOfList: 0,
                color: '#71717a',
                accentColor: '#71717a',
                isIntersection: false,
                activeEntityNames: [],
            },
        }
    }, [filas, setA, setB, setC, isTriVenn])

    // Región seleccionada e inspeccionada
    const [selectedRegionId, setSelectedRegionId] = useState<RegionId>(() => {
        return isTriVenn ? 'abc' : 'ab'
    })
    const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null)

    // Si cambiamos entre Bi-Venn y Tri-Venn, reajustamos selección si queda inválida
    const activeSelectedRegion = useMemo<VennRegionData>(() => {
        if (!isTriVenn && (selectedRegionId === 'abc' || selectedRegionId === 'ac' || selectedRegionId === 'bc' || selectedRegionId === 'only_c')) {
            return regionsData.ab
        }
        return regionsData[selectedRegionId] || regionsData.ab || regionsData.only_a
    }, [isTriVenn, selectedRegionId, regionsData])

    // Coordenadas Geométricas del Diagrama
    // Dimensiones SVG: 540 x 360
    const triVennCoords = useMemo(() => {
        const r = 96
        const cA = { x: 270, y: 135, r }
        const cB = { x: 205, y: 235, r }
        const cC = { x: 335, y: 235, r }

        // Centroids para insignias interactivas de cantidad
        return {
            cA,
            cB,
            cC,
            centroids: {
                only_a: { x: 270, y: 82 },
                only_b: { x: 155, y: 272 },
                only_c: { x: 385, y: 272 },
                ab: { x: 220, y: 172 },
                ac: { x: 320, y: 172 },
                bc: { x: 270, y: 270 },
                abc: { x: 270, y: 202 },
            },
            labels: {
                a: { x: 270, y: 24 },
                b: { x: 120, y: 345 },
                c: { x: 420, y: 345 },
            },
        }
    }, [])

    const biVennCoords = useMemo(() => {
        const r = 108
        const cA = { x: 210, y: 185, r }
        const cB = { x: 330, y: 185, r }

        return {
            cA,
            cB,
            centroids: {
                only_a: { x: 155, y: 185 },
                only_b: { x: 385, y: 185 },
                ab: { x: 270, y: 185 },
            },
            labels: {
                a: { x: 165, y: 55 },
                b: { x: 375, y: 55 },
            },
        }
    }, [])

    return (
        <div className="perfil-breakdown-card mb-4 perfil-venn-wrapper">
            {/* 1. Header con Título, Explicación y Modos */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--perfil-border)' }}>
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="ml-eyebrow" style={{ color: accentColor, letterSpacing: '0.08em' }}>
                            SUBVISTA DEDICADA · DIAGRAMA DE VENN DINÁMICO
                        </span>
                        <span className="badge rounded-pill font-mono px-2 py-0.5" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', fontSize: '0.67rem' }}>
                            Mide Cantidad & Co-ocurrencia
                        </span>
                    </div>
                    <h3 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                        <Layers size={18} style={{ color: accentColor }} />
                        <span>Presencia y Superposición de Universos en tu Lista</span>
                    </h3>
                    <p className="small text-secondary mb-0 mt-1" style={{ fontSize: '0.76rem' }}>
                        Selecciona hasta 3 categorías o temáticas para visualizar su intersección exacta y haz clic en cualquier área para ver sus animes.
                    </p>
                </div>

                {/* Switcher 2 vs 3 Universos */}
                <div className="d-flex align-items-center gap-2">
                    <span className="small text-secondary d-none d-sm-inline" style={{ fontSize: '0.74rem' }}>
                        Modo Venn:
                    </span>
                    <div className="btn-group btn-group-sm p-0.5 rounded-pill border" style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}>
                        <button
                            type="button"
                            onClick={() => setIsTriVenn(true)}
                            className={`btn btn-sm rounded-pill px-3 py-1 font-mono ${isTriVenn ? 'btn-primary' : 'text-secondary'}`}
                            style={{
                                fontSize: '0.72rem',
                                background: isTriVenn ? 'var(--perfil-acento)' : 'transparent',
                                borderColor: 'transparent',
                                color: isTriVenn ? '#ffffff' : 'inherit',
                                fontWeight: 700,
                            }}
                        >
                            3 Universos
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsTriVenn(false)
                                if (selectedRegionId === 'abc' || selectedRegionId === 'ac' || selectedRegionId === 'bc' || selectedRegionId === 'only_c') {
                                    setSelectedRegionId('ab')
                                }
                            }}
                            className={`btn btn-sm rounded-pill px-3 py-1 font-mono ${!isTriVenn ? 'btn-primary' : 'text-secondary'}`}
                            style={{
                                fontSize: '0.72rem',
                                background: !isTriVenn ? 'var(--perfil-acento)' : 'transparent',
                                borderColor: 'transparent',
                                color: !isTriVenn ? '#ffffff' : 'inherit',
                                fontWeight: 700,
                            }}
                        >
                            2 Universos
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Selector de Entidades Activas con Filtros de Taxonomía */}
            <div className="mb-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                    <div className="d-flex align-items-center gap-1.5 overflow-auto pb-1" role="tablist">
                        {(
                            [
                                { id: 'all', label: 'Todos' },
                                { id: 'Genre', label: 'Géneros' },
                                { id: 'Theme', label: 'Temáticas & Tropos' },
                                { id: 'Cast', label: 'Elenco' },
                                { id: 'Setting', label: 'Ambientación' },
                            ] as Array<{ id: VennCategoryFilter; label: string }>
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSelectedCategoryTab(tab.id)}
                                className={`px-2.5 py-1 rounded-pill small border ${selectedCategoryTab === tab.id ? 'fw-bold text-white' : 'text-secondary'}`}
                                style={{
                                    fontSize: '0.73rem',
                                    background: selectedCategoryTab === tab.id ? 'var(--perfil-card-2)' : 'transparent',
                                    borderColor: selectedCategoryTab === tab.id ? 'var(--perfil-acento)' : 'transparent',
                                    transition: 'all 0.15s ease',
                                    cursor: 'pointer',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <div className="position-relative" style={{ width: 170 }}>
                            <Search size={12} className="position-absolute text-secondary" style={{ left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                placeholder="Buscar tag..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="form-control form-control-sm ps-4 py-0.5 text-white"
                                style={{
                                    background: 'var(--perfil-card-2)',
                                    borderColor: 'var(--perfil-border)',
                                    fontSize: '0.73rem',
                                    borderRadius: 999,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Pills de entidades activables */}
                <div className="d-flex flex-wrap align-items-center gap-2 perfil-thin-scrollbar" style={{ maxHeight: 110, overflowY: 'auto', padding: '2px 0' }}>
                    {filteredAvailableEntities.length === 0 ? (
                        <span className="small text-secondary py-1" style={{ fontSize: '0.74rem' }}>
                            No se encontraron categorías coincidentes con la búsqueda.
                        </span>
                    ) : (
                        filteredAvailableEntities.slice(0, 36).map((ent) => {
                            const activeIdx = activeEntities.findIndex((e) => e.id === ent.id)
                            const isActive = activeIdx !== -1
                            const palette = isActive ? SET_PALETTES[activeIdx] : null

                            return (
                                <button
                                    key={ent.id}
                                    type="button"
                                    onClick={() => handleToggleEntity(ent.id)}
                                    className={`px-2.5 py-1 rounded-pill border d-inline-flex align-items-center gap-1.5 small ${isActive ? 'is-active-set' : ''}`}
                                    style={{
                                        background: isActive ? palette?.softBg : 'var(--perfil-card-2)',
                                        borderColor: isActive ? palette?.stroke : 'var(--perfil-border)',
                                        color: isActive ? '#ffffff' : 'var(--perfil-text-dim)',
                                        cursor: 'pointer',
                                        fontSize: '0.74rem',
                                        fontWeight: isActive ? 700 : 500,
                                        transition: 'all 0.16s ease',
                                        boxShadow: isActive ? `0 0 10px ${palette?.glow}` : 'none',
                                    }}
                                    title={`Haz clic para activar o cambiar en el diagrama de Venn (${ent.count} animes)`}
                                >
                                    {isActive ? (
                                        <span
                                            style={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: '50%',
                                                background: palette?.color,
                                                display: 'inline-block',
                                            }}
                                        />
                                    ) : (
                                        <span className="small text-secondary" style={{ fontSize: '0.66rem' }}>
                                            {ent.categoryLabel[0]}·
                                        </span>
                                    )}
                                    <span>{ent.name}</span>
                                    <span
                                        className="font-mono badge rounded-pill"
                                        style={{
                                            background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            color: isActive ? '#ffffff' : '#9ca3af',
                                            fontSize: '0.64rem',
                                            padding: '0.1rem 0.35rem',
                                        }}
                                    >
                                        {ent.count}
                                    </span>
                                </button>
                            )
                        })
                    )}
                </div>
            </div>

            {/* 3. Contenedor Principal: Diagrama de Venn (Izq) + Desglose/Inspector de Universo (Der) */}
            <div className="row g-4 align-items-stretch">
                {/* Columna Izquierda: Diagrama SVG Interactivo de Venn */}
                <div className="col-12 col-xl-7">
                    <div
                        className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between position-relative"
                        style={{
                            background: 'var(--perfil-card-2)',
                            borderColor: 'var(--perfil-border)',
                            minHeight: 410,
                        }}
                    >
                        {/* SVG Venn Diagram */}
                        <div className="w-100 d-flex align-items-center justify-content-center flex-grow-1" style={{ position: 'relative' }}>
                            <svg viewBox="0 0 540 370" className="w-100" style={{ maxHeight: 350, overflow: 'visible' }}>
                                <defs>
                                    {/* Clip Paths para intersecciones booleanas */}
                                    {isTriVenn ? (
                                        <>
                                            <clipPath id="venn-clip-a">
                                                <circle cx={triVennCoords.cA.x} cy={triVennCoords.cA.y} r={triVennCoords.cA.r} />
                                            </clipPath>
                                            <clipPath id="venn-clip-b">
                                                <circle cx={triVennCoords.cB.x} cy={triVennCoords.cB.y} r={triVennCoords.cB.r} />
                                            </clipPath>
                                            <clipPath id="venn-clip-c">
                                                <circle cx={triVennCoords.cC.x} cy={triVennCoords.cC.y} r={triVennCoords.cC.r} />
                                            </clipPath>
                                        </>
                                    ) : (
                                        <>
                                            <clipPath id="venn-clip-a">
                                                <circle cx={biVennCoords.cA.x} cy={biVennCoords.cA.y} r={biVennCoords.cA.r} />
                                            </clipPath>
                                            <clipPath id="venn-clip-b">
                                                <circle cx={biVennCoords.cB.x} cy={biVennCoords.cB.y} r={biVennCoords.cB.r} />
                                            </clipPath>
                                        </>
                                    )}

                                    {/* Filtro de Resplandor Suave */}
                                    <filter id="venn-glow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="4" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>

                                {isTriVenn ? (
                                    <>
                                        {/* Círculos Base Tri-Venn con opacidad controlada */}
                                        <g>
                                            {/* Círculo A (Superior) */}
                                            <circle
                                                cx={triVennCoords.cA.x}
                                                cy={triVennCoords.cA.y}
                                                r={triVennCoords.cA.r}
                                                fill={SET_PALETTES[0].color}
                                                fillOpacity={selectedRegionId === 'only_a' ? 0.35 : 0.16}
                                                stroke={SET_PALETTES[0].stroke}
                                                strokeWidth={selectedRegionId === 'only_a' ? 3 : 2}
                                                strokeOpacity={0.8}
                                                style={{ transition: 'all 0.25s ease', cursor: 'pointer' }}
                                                onClick={() => setSelectedRegionId('only_a')}
                                                onMouseEnter={() => setHoveredRegionId('only_a')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />

                                            {/* Círculo B (Inferior Izq) */}
                                            <circle
                                                cx={triVennCoords.cB.x}
                                                cy={triVennCoords.cB.y}
                                                r={triVennCoords.cB.r}
                                                fill={SET_PALETTES[1].color}
                                                fillOpacity={selectedRegionId === 'only_b' ? 0.35 : 0.16}
                                                stroke={SET_PALETTES[1].stroke}
                                                strokeWidth={selectedRegionId === 'only_b' ? 3 : 2}
                                                strokeOpacity={0.8}
                                                style={{ transition: 'all 0.25s ease', cursor: 'pointer' }}
                                                onClick={() => setSelectedRegionId('only_b')}
                                                onMouseEnter={() => setHoveredRegionId('only_b')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />

                                            {/* Círculo C (Inferior Der) */}
                                            <circle
                                                cx={triVennCoords.cC.x}
                                                cy={triVennCoords.cC.y}
                                                r={triVennCoords.cC.r}
                                                fill={SET_PALETTES[2].color}
                                                fillOpacity={selectedRegionId === 'only_c' ? 0.35 : 0.16}
                                                stroke={SET_PALETTES[2].stroke}
                                                strokeWidth={selectedRegionId === 'only_c' ? 3 : 2}
                                                strokeOpacity={0.8}
                                                style={{ transition: 'all 0.25s ease', cursor: 'pointer' }}
                                                onClick={() => setSelectedRegionId('only_c')}
                                                onMouseEnter={() => setHoveredRegionId('only_c')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />
                                        </g>

                                        {/* Intersección Triple (A ∩ B ∩ C) - Núcleo de Oro */}
                                        <g clipPath="url(#venn-clip-b)">
                                            <circle
                                                cx={triVennCoords.cA.x}
                                                cy={triVennCoords.cA.y}
                                                r={triVennCoords.cA.r}
                                                clipPath="url(#venn-clip-c)"
                                                fill="#f59e0b"
                                                fillOpacity={selectedRegionId === 'abc' ? 0.55 : 0.32}
                                                stroke="#fbbf24"
                                                strokeWidth={selectedRegionId === 'abc' ? 2.5 : 1.5}
                                                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                onClick={() => setSelectedRegionId('abc')}
                                                onMouseEnter={() => setHoveredRegionId('abc')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />
                                        </g>

                                        {/* Insignias de Cantidad en los Centroids (Clickeables y Reactivas) */}
                                        {(
                                            [
                                                { id: 'only_a', ...triVennCoords.centroids.only_a },
                                                { id: 'only_b', ...triVennCoords.centroids.only_b },
                                                { id: 'only_c', ...triVennCoords.centroids.only_c },
                                                { id: 'ab', ...triVennCoords.centroids.ab },
                                                { id: 'ac', ...triVennCoords.centroids.ac },
                                                { id: 'bc', ...triVennCoords.centroids.bc },
                                                { id: 'abc', ...triVennCoords.centroids.abc },
                                            ] as Array<{ id: RegionId; x: number; y: number }>
                                        ).map((spot) => {
                                            const reg = regionsData[spot.id]
                                            const isSel = selectedRegionId === spot.id
                                            const isHov = hoveredRegionId === spot.id
                                            const hasAnimes = reg.count > 0

                                            return (
                                                <g
                                                    key={spot.id}
                                                    onClick={() => setSelectedRegionId(spot.id)}
                                                    onMouseEnter={() => setHoveredRegionId(spot.id)}
                                                    onMouseLeave={() => setHoveredRegionId(null)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <circle
                                                        cx={spot.x}
                                                        cy={spot.y}
                                                        r={isSel ? 18 : 14}
                                                        fill={
                                                            isSel
                                                                ? reg.color
                                                                : hasAnimes
                                                                ? 'rgba(18, 19, 26, 0.92)'
                                                                : 'rgba(10, 10, 14, 0.65)'
                                                        }
                                                        stroke={isSel ? '#ffffff' : hasAnimes ? reg.accentColor : 'rgba(255,255,255,0.18)'}
                                                        strokeWidth={isSel ? 2.5 : hasAnimes ? 1.6 : 1}
                                                        style={{ transition: 'all 0.2s ease' }}
                                                        filter={isSel || isHov ? 'url(#venn-glow)' : undefined}
                                                    />
                                                    <text
                                                        x={spot.x}
                                                        y={spot.y + 4}
                                                        textAnchor="middle"
                                                        fill={isSel ? '#ffffff' : hasAnimes ? '#f4f4f5' : '#71717a'}
                                                        fontSize={isSel ? '12' : '10.5'}
                                                        fontWeight={isSel ? '800' : '700'}
                                                        fontFamily="monospace"
                                                    >
                                                        {reg.count}
                                                    </text>
                                                </g>
                                            )
                                        })}

                                        {/* Etiquetas de los Conjuntos A, B y C */}
                                        <g>
                                            {/* Set A Label (Superior) */}
                                            <text
                                                x={triVennCoords.labels.a.x}
                                                y={triVennCoords.labels.a.y}
                                                textAnchor="middle"
                                                fill={SET_PALETTES[0].stroke}
                                                fontSize="12.5"
                                                fontWeight="800"
                                            >
                                                {setA?.name} ({setA?.count})
                                            </text>
                                            {/* Set B Label (Inferior Izq) */}
                                            <text
                                                x={triVennCoords.labels.b.x}
                                                y={triVennCoords.labels.b.y}
                                                textAnchor="middle"
                                                fill={SET_PALETTES[1].stroke}
                                                fontSize="12"
                                                fontWeight="800"
                                            >
                                                {setB?.name} ({setB?.count})
                                            </text>
                                            {/* Set C Label (Inferior Der) */}
                                            <text
                                                x={triVennCoords.labels.c.x}
                                                y={triVennCoords.labels.c.y}
                                                textAnchor="middle"
                                                fill={SET_PALETTES[2].stroke}
                                                fontSize="12"
                                                fontWeight="800"
                                            >
                                                {setC?.name} ({setC?.count})
                                            </text>
                                        </g>
                                    </>
                                ) : (
                                    <>
                                        {/* Bi-Venn (2 Círculos) */}
                                        <g>
                                            {/* Círculo A */}
                                            <circle
                                                cx={biVennCoords.cA.x}
                                                cy={biVennCoords.cA.y}
                                                r={biVennCoords.cA.r}
                                                fill={SET_PALETTES[0].color}
                                                fillOpacity={selectedRegionId === 'only_a' ? 0.35 : 0.18}
                                                stroke={SET_PALETTES[0].stroke}
                                                strokeWidth={selectedRegionId === 'only_a' ? 3 : 2}
                                                strokeOpacity={0.8}
                                                style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                                                onClick={() => setSelectedRegionId('only_a')}
                                                onMouseEnter={() => setHoveredRegionId('only_a')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />
                                            {/* Círculo B */}
                                            <circle
                                                cx={biVennCoords.cB.x}
                                                cy={biVennCoords.cB.y}
                                                r={biVennCoords.cB.r}
                                                fill={SET_PALETTES[1].color}
                                                fillOpacity={selectedRegionId === 'only_b' ? 0.35 : 0.18}
                                                stroke={SET_PALETTES[1].stroke}
                                                strokeWidth={selectedRegionId === 'only_b' ? 3 : 2}
                                                strokeOpacity={0.8}
                                                style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                                                onClick={() => setSelectedRegionId('only_b')}
                                                onMouseEnter={() => setHoveredRegionId('only_b')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />
                                        </g>

                                        {/* Intersección Central (A ∩ B) */}
                                        <g clipPath="url(#venn-clip-b)">
                                            <circle
                                                cx={biVennCoords.cA.x}
                                                cy={biVennCoords.cA.y}
                                                r={biVennCoords.cA.r}
                                                fill="#f59e0b"
                                                fillOpacity={selectedRegionId === 'ab' ? 0.55 : 0.32}
                                                stroke="#fbbf24"
                                                strokeWidth={selectedRegionId === 'ab' ? 2.5 : 1.5}
                                                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                onClick={() => setSelectedRegionId('ab')}
                                                onMouseEnter={() => setHoveredRegionId('ab')}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />
                                        </g>

                                        {/* Insignias de Cantidad */}
                                        {(
                                            [
                                                { id: 'only_a', ...biVennCoords.centroids.only_a },
                                                { id: 'only_b', ...biVennCoords.centroids.only_b },
                                                { id: 'ab', ...biVennCoords.centroids.ab },
                                            ] as Array<{ id: RegionId; x: number; y: number }>
                                        ).map((spot) => {
                                            const reg = regionsData[spot.id]
                                            const isSel = selectedRegionId === spot.id
                                            const hasAnimes = reg.count > 0

                                            return (
                                                <g
                                                    key={spot.id}
                                                    onClick={() => setSelectedRegionId(spot.id)}
                                                    onMouseEnter={() => setHoveredRegionId(spot.id)}
                                                    onMouseLeave={() => setHoveredRegionId(null)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <circle
                                                        cx={spot.x}
                                                        cy={spot.y}
                                                        r={isSel ? 20 : 16}
                                                        fill={
                                                            isSel
                                                                ? reg.color
                                                                : hasAnimes
                                                                ? 'rgba(18, 19, 26, 0.92)'
                                                                : 'rgba(10, 10, 14, 0.65)'
                                                        }
                                                        stroke={isSel ? '#ffffff' : hasAnimes ? reg.accentColor : 'rgba(255,255,255,0.18)'}
                                                        strokeWidth={isSel ? 2.5 : hasAnimes ? 1.6 : 1}
                                                        filter={isSel ? 'url(#venn-glow)' : undefined}
                                                    />
                                                    <text
                                                        x={spot.x}
                                                        y={spot.y + 4.5}
                                                        textAnchor="middle"
                                                        fill={isSel ? '#ffffff' : hasAnimes ? '#f4f4f5' : '#71717a'}
                                                        fontSize={isSel ? '13' : '11'}
                                                        fontWeight="800"
                                                        fontFamily="monospace"
                                                    >
                                                        {reg.count}
                                                    </text>
                                                </g>
                                            )
                                        })}

                                        {/* Etiquetas de Conjuntos A y B */}
                                        <g>
                                            <text
                                                x={biVennCoords.labels.a.x}
                                                y={biVennCoords.labels.a.y}
                                                textAnchor="middle"
                                                fill={SET_PALETTES[0].stroke}
                                                fontSize="13"
                                                fontWeight="800"
                                            >
                                                {setA?.name} ({setA?.count})
                                            </text>
                                            <text
                                                x={biVennCoords.labels.b.x}
                                                y={biVennCoords.labels.b.y}
                                                textAnchor="middle"
                                                fill={SET_PALETTES[1].stroke}
                                                fontSize="13"
                                                fontWeight="800"
                                            >
                                                {setB?.name} ({setB?.count})
                                            </text>
                                        </g>
                                    </>
                                )}
                            </svg>
                        </div>

                        {/* Matriz de Botones Rápidos para seleccionar Universos */}
                        <div className="pt-2.5 mt-2 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                            <div className="small text-secondary mb-1.5" style={{ fontSize: '0.71rem' }}>
                                Acceso Rápido a Universos e Intersecciones:
                            </div>
                            <div className="d-flex flex-wrap gap-1.5">
                                {(isTriVenn
                                    ? ['abc', 'ab', 'ac', 'bc', 'only_a', 'only_b', 'only_c']
                                    : ['ab', 'only_a', 'only_b']
                                ).map((rId) => {
                                    const reg = regionsData[rId as RegionId]
                                    if (!reg) return null
                                    const isSel = selectedRegionId === rId

                                    return (
                                        <button
                                            key={rId}
                                            type="button"
                                            onClick={() => setSelectedRegionId(rId as RegionId)}
                                            className="btn btn-sm px-2.5 py-1 rounded-pill d-inline-flex align-items-center gap-1.5"
                                            style={{
                                                fontSize: '0.71rem',
                                                background: isSel ? 'var(--perfil-card)' : 'transparent',
                                                borderColor: isSel ? reg.accentColor : 'var(--perfil-border)',
                                                borderWidth: 1,
                                                borderStyle: 'solid',
                                                color: isSel ? '#ffffff' : '#a1a1aa',
                                                fontWeight: isSel ? 700 : 500,
                                                boxShadow: isSel ? `0 0 10px ${reg.color}40` : 'none',
                                            }}
                                        >
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: reg.color }} />
                                            <span>{reg.shortLabel}</span>
                                            <span className="font-mono text-white fw-bold">({reg.count})</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Inspector del Universo Seleccionado (Desglose de Animes) */}
                <div className="col-12 col-xl-5">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column"
                        style={{
                            background: 'var(--perfil-card)',
                            borderColor: 'var(--perfil-border)',
                            minHeight: 410,
                        }}
                    >
                        {/* Cabecera del Universo */}
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-2 pb-2.5 border-bottom" style={{ borderColor: 'var(--perfil-border)' }}>
                            <div>
                                <span className="ml-eyebrow" style={{ color: activeSelectedRegion.accentColor, letterSpacing: '0.07em' }}>
                                    {activeSelectedRegion.isIntersection ? 'INTERSECCIÓN SELECCIONADA' : 'UNIVERSO EXCLUSIVO'}
                                </span>
                                <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                    <span>{activeSelectedRegion.label}</span>
                                </h4>
                            </div>

                            <span
                                className="badge rounded-pill font-mono px-2.5 py-1"
                                style={{
                                    background: `${activeSelectedRegion.color}22`,
                                    color: activeSelectedRegion.accentColor,
                                    border: `1px solid ${activeSelectedRegion.accentColor}55`,
                                    fontSize: '0.74rem',
                                }}
                            >
                                {activeSelectedRegion.count} {activeSelectedRegion.count === 1 ? 'anime' : 'animes'} ({activeSelectedRegion.pctOfList}%)
                            </span>
                        </div>

                        {/* Descripción de la Co-ocurrencia */}
                        <p className="small text-secondary mb-3" style={{ fontSize: '0.75rem', lineHeight: 1.45 }}>
                            {activeSelectedRegion.description}
                        </p>

                        {/* Desglose de Animes en este Universo */}
                        <div className="flex-grow-1 overflow-auto pe-1 perfil-thin-scrollbar" style={{ maxHeight: 310 }}>
                            {activeSelectedRegion.animes.length === 0 ? (
                                <div className="perfil-contrast-empty my-auto text-center py-4">
                                    <Layers size={28} className="text-secondary mb-2 opacity-50" />
                                    <div className="fw-bold text-white small mb-1">0 Animes en este Universo</div>
                                    <span style={{ fontSize: '0.74rem' }}>
                                        Ninguna obra en tu lista comparte simultáneamente estos criterios. Prueba seleccionando otra intersección o modificando los conjuntos.
                                    </span>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {activeSelectedRegion.animes.map((f) => {
                                        const userScore = f.nota
                                        const malScore = f.anime.score
                                        const year = f.anime.year || f.anime.season
                                        const studio = f.anime.studio

                                        return (
                                            <div
                                                key={f.id}
                                                onClick={() => onSelectAnime?.(f)}
                                                className="p-2 rounded-3 border d-flex gap-2.5 align-items-center"
                                                style={{
                                                    background: 'var(--perfil-card-2)',
                                                    borderColor: 'var(--perfil-border)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.16s ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = activeSelectedRegion.accentColor
                                                    e.currentTarget.style.transform = 'translateY(-1px)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--perfil-border)'
                                                    e.currentTarget.style.transform = 'none'
                                                }}
                                                title={`${f.anime.title} — Clic para abrir ficha`}
                                            >
                                                {/* Póster */}
                                                <img
                                                    src={f.anime.imageUrl}
                                                    alt={f.anime.title}
                                                    style={{
                                                        width: 44,
                                                        height: 60,
                                                        borderRadius: 6,
                                                        objectFit: 'cover',
                                                        flexShrink: 0,
                                                    }}
                                                />

                                                {/* Metadatos */}
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="d-flex align-items-center justify-content-between gap-1 mb-0.5">
                                                        <h5
                                                            className="text-white fw-bold mb-0 text-truncate"
                                                            style={{ fontSize: '0.8rem', lineHeight: 1.3 }}
                                                        >
                                                            {f.anime.title}
                                                        </h5>

                                                        {/* Nota */}
                                                        {typeof userScore === 'number' && userScore > 0 ? (
                                                            <span
                                                                className="badge font-mono rounded-pill px-1.5 py-0.5 d-inline-flex align-items-center gap-0.5 flex-shrink-0"
                                                                style={{
                                                                    background: 'rgba(250, 204, 21, 0.14)',
                                                                    color: '#facc15',
                                                                    fontSize: '0.68rem',
                                                                }}
                                                            >
                                                                ★ {userScore}
                                                            </span>
                                                        ) : malScore ? (
                                                            <span
                                                                className="badge font-mono rounded-pill px-1.5 py-0.5 text-secondary flex-shrink-0"
                                                                style={{
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    fontSize: '0.67rem',
                                                                }}
                                                            >
                                                                ☆ {malScore.toFixed(1)}
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <div className="text-secondary small d-flex align-items-center gap-2 mb-1" style={{ fontSize: '0.69rem' }}>
                                                        {studio && <span>{studio}</span>}
                                                        {year && <span>• {year}</span>}
                                                        <span>• {f.anime.episodes || 12} eps</span>
                                                    </div>

                                                    {/* Chips de tags que coinciden con los conjuntos activos */}
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {activeSelectedRegion.activeEntityNames.map((name) => {
                                                            const matches = doesAnimeMatchEntity(f, name)
                                                            if (!matches) return null
                                                            return (
                                                                <span
                                                                    key={name}
                                                                    className="px-1.5 py-0.2 rounded-pill font-mono"
                                                                    style={{
                                                                        background: `${activeSelectedRegion.color}22`,
                                                                        color: activeSelectedRegion.accentColor,
                                                                        fontSize: '0.63rem',
                                                                        border: `1px solid ${activeSelectedRegion.accentColor}44`,
                                                                    }}
                                                                >
                                                                    {name}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
