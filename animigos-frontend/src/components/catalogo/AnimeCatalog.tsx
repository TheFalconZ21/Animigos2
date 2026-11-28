import React, { useState, useMemo, useRef, useEffect } from 'react'
import { getCurrentPath, navigate } from '../../utils/navigation'
import {
    Search,
    SlidersHorizontal,
    Star,
    Check,
    Plus,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Film,
    Building2,
    Award,
    ChevronDown,
    Tag,
    X,
    Play,
} from 'lucide-react'
import {
    useCatalogQuery,
    useGenresQuery,
    useYearsQuery,
    useStudios,
    useTaxonomiesQuery,
} from '../../hooks/useCatalog'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { useAuth } from '../../context/AuthContext'
import { useAssociatedLinks } from '../../hooks/useAssociatedLinks'
import type { ApiAnimeData } from '../../services/userListApi'
import { AnimeProfileView } from './AnimeProfileView'
import './catalogo.css'

interface AnimeCatalogProps {
    initialAnimeId?: number | null
    initialPage?: number
    initialSearch?: string
    initialYear?: string | number | null
    initialSeason?: string | null
    initialGenre?: string | null
    initialOrdering?: string | null
}

const GENRES_DEFAULT = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Horror',
    'Isekai',
    'Mecha',
    'Mystery',
    'Psychological',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Sports',
    'Supernatural',
    'Thriller',
]

const SEASONS_LIST = [
    { id: '', label: 'Todas las Temporadas' },
    { id: 'fall', label: 'Otoño (Fall)' },
    { id: 'spring', label: 'Primavera (Spring)' },
    { id: 'summer', label: 'Verano (Summer)' },
    { id: 'winter', label: 'Invierno (Winter)' },
]

const FORMATS_LIST = [
    { id: '', label: 'Todos los Formatos' },
    { id: 'TV', label: 'Serie (TV)' },
    { id: 'Movie', label: 'Película (Movie)' },
    { id: 'OVA', label: 'OVA' },
    { id: 'ONA', label: 'ONA' },
    { id: 'Special', label: 'Especial' },
]

const ORDERING_LIST = [
    { id: '-score', label: 'Puntuación MAL' },
    { id: 'score', label: 'Puntuación MAL (Menor)' },
    { id: '-popularity', label: 'Popularidad' },
    { id: '-season_year', label: 'Año (Recientes)' },
    { id: 'season_year', label: 'Fecha de emisión (Ascendente)' },
    { id: 'title', label: 'Título (A–Z)' },
]

export interface OfficialStreamingPlatform {
    id: string
    label: string
    color: string
    icon: string
}

const OFFICIAL_STREAMING_PLATFORMS: OfficialStreamingPlatform[] = [
    {
        id: 'Crunchyroll',
        label: 'Crunchyroll',
        color: '#F88B24',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/5-AWN2pVlluCOO.png',
    },
    {
        id: 'Netflix',
        label: 'Netflix',
        color: '#E50914',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/10-rVGPom8RCiwH.png',
    },
    {
        id: 'Disney Plus',
        label: 'Disney+',
        color: '#38BDF8',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/118-mphNAqNDTvhO.png',
    },
    {
        id: 'Amazon Prime Video',
        label: 'Prime Video',
        color: '#FF9900',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/21-bDoNIomehkOx.png',
    },
    {
        id: 'HIDIVE',
        label: 'HIDIVE',
        color: '#03AEEF',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/20-3nWxygrjVM5A.png',
    },
    {
        id: 'Hulu',
        label: 'Hulu',
        color: '#1CE783',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/7-rM06PQyWONGC.png',
    },
    {
        id: 'Max',
        label: 'Max',
        color: '#3B82F6',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/211-S2C1vx1Ex5N7.png',
    },
    {
        id: 'Bilibili',
        label: 'Bilibili',
        color: '#00A1D6',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/119-NCwGvCjFADGQ.png',
    },
    {
        id: 'YouTube',
        label: 'YouTube',
        color: '#FF0000',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/13-ZwR1Xwgtyrwa.png',
    },
    {
        id: 'iQIYI',
        label: 'iQIYI',
        color: '#00CC36',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/204-VS6anqt2SaIN.png',
    },
    {
        id: 'Tubi TV',
        label: 'Tubi TV',
        color: '#A855F7',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/30-RoKDJtmAVpZK.png',
    },
    {
        id: 'RetroCrush',
        label: 'RetroCrush',
        color: '#F43F5E',
        icon: 'https://s4.anilist.co/file/anilistcdn/link/icon/27-1wGdEnOAv9WX.png',
    },
]

type TaxonomyTabId = 'all' | 'Genre' | 'Theme' | 'Cast' | 'Setting' | 'Demographic'

export const AnimeCatalog: React.FC<AnimeCatalogProps> = ({
    initialAnimeId = null,
    initialPage = 1,
    initialSearch = '',
    initialYear = null,
    initialSeason = null,
    initialGenre = null,
    initialOrdering = null,
}) => {
    const { isAuthenticated } = useAuth()
    const { filas, agregarAnime } = useMyList()
    const { acento } = useThemeAccent()
    const { openAnimeLink, isEnabled: isLinksEnabled } = useAssociatedLinks()
    const myListIds = useMemo(() => new Set(filas.map((f) => f.malId)), [filas])

    // --- Vista Perfil de Anime ---
    const [activeProfileMalId, setActiveProfileMalId] = useState<number | null>(initialAnimeId)
    const [activeProfileAnime, setActiveProfileAnime] = useState<ApiAnimeData | null>(null)

    useEffect(() => {
        setActiveProfileMalId(initialAnimeId ?? null)
    }, [initialAnimeId])

    // --- Filtros ---
    const [studio, setStudio] = useState('')
    // Lista combinada de Géneros y Taxonomías de AniList seleccionados (Intersección AND)
    const [selectedTerms, setSelectedTerms] = useState<string[]>(initialGenre ? [initialGenre] : [])
    const [season, setSeason] = useState(initialSeason ? String(initialSeason).toLowerCase() : '')
    const [year, setYear] = useState(initialYear ? String(initialYear) : '')
    const [minScore, setMinScore] = useState('')
    const [maxScore, setMaxScore] = useState('')
    const [format, setFormat] = useState('')
    const [ordering, setOrdering] = useState(initialOrdering || '-score')

    useEffect(() => {
        if (initialYear !== undefined && initialYear !== null) {
            setYear(String(initialYear))
        }
        if (initialSeason !== undefined && initialSeason !== null) {
            setSeason(String(initialSeason).toLowerCase())
        }
        if (initialGenre) {
            setSelectedTerms([initialGenre])
        }
        if (initialOrdering) {
            setOrdering(initialOrdering)
        }
    }, [initialYear, initialSeason, initialGenre, initialOrdering])

    // Selector desplegable de Géneros + Taxonomías de AniList
    const [taxDropdownOpen, setTaxDropdownOpen] = useState(false)
    const [taxSearch, setTaxSearch] = useState('')
    const [taxCategoryTab, setTaxCategoryTab] = useState<TaxonomyTabId>('all')
    const taxDropdownRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handleClickOutside = (ev: MouseEvent) => {
            if (taxDropdownRef.current && !taxDropdownRef.current.contains(ev.target as Node)) {
                setTaxDropdownOpen(false)
            }
        }
        if (taxDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [taxDropdownOpen])

    // Toggles rápidos y Plataformas de Streaming Oficiales
    const [noSequels, setNoSequels] = useState(false)
    const [notInMyList, setNotInMyList] = useState(false)
    const [selectedStreaming, setSelectedStreaming] = useState<string[]>([])

    const toggleStreamingPlatform = (platformId: string) => {
        setSelectedStreaming((prev) =>
            prev.includes(platformId)
                ? prev.filter((id) => id !== platformId)
                : [...prev, platformId]
        )
        setCurrentPage(1)
    }

    // Búsqueda por texto y paginación sincronizada con /catalogo/:page
    const [searchInput, setSearchInput] = useState(initialSearch)
    const [submittedSearch, setSubmittedSearch] = useState(initialSearch)
    const [currentPage, setCurrentPageState] = useState<number>(() => Math.max(1, initialPage || 1))
    const [addedAnimeId, setAddedAnimeId] = useState<number | null>(null)

    useEffect(() => {
        const normalized = Math.max(1, initialPage || 1)
        setCurrentPageState((prev) => (prev === normalized ? prev : normalized))
    }, [initialPage])

    const setCurrentPage = (updater: number | ((prev: number) => number), replace = false) => {
        const next = Math.max(1, typeof updater === 'function' ? updater(currentPage) : updater)
        setCurrentPageState(next)
        if (!activeProfileMalId) {
            const targetPath = `/catalogo/${next}`
            if (getCurrentPath() !== targetPath) {
                navigate(targetPath, { replace })
            }
        }
    }

    useEffect(() => {
        if (initialSearch) {
            setSearchInput(initialSearch)
            setSubmittedSearch(initialSearch)
            setCurrentPageState(1)
        }
    }, [initialSearch])

    // Queries auxiliares
    const { data: genresData } = useGenresQuery()
    const { data: taxonomiesData } = useTaxonomiesQuery()
    const { data: yearsData } = useYearsQuery()
    const { data: studiosData } = useStudios()

    const yearsList =
        yearsData && yearsData.length
            ? yearsData
            : [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2010, 2005, 2000]

    // Helper para sanitizar nombres de taxonomía y evitar corchetes o comillas residuales
    const cleanTaxonomyToken = (raw: string): string => {
        return raw.replace(/^[\["'\s]+|[\]"'\s]+$/g, '').trim()
    }

    // Unificar Géneros y Media Tags de AniList para el selector multi-taxonomía
    const allTaxonomyOptions = useMemo(() => {
        const map = new Map<string, { name: string; category: string; count: number }>()

        const addOption = (rawName: string, category: string, count: number) => {
            const cleanName = cleanTaxonomyToken(rawName)
            if (!cleanName) return
            const key = cleanName.toLowerCase()
            const existing = map.get(key)
            if (existing) {
                existing.count = Math.max(existing.count, 0) + (count > 0 ? count : 0)
                if (category === 'Genre') existing.category = 'Genre'
            } else {
                map.set(key, {
                    name: cleanName,
                    category: category || 'Theme',
                    count: count > 0 ? count : 0
                })
            }
        }

        const baseGenres = genresData && genresData.length ? genresData : GENRES_DEFAULT
        for (const g of baseGenres) {
            addOption(g, 'Genre', 0)
        }

        if (taxonomiesData) {
            for (const g of taxonomiesData.genres || []) {
                addOption(g.name, 'Genre', g.count)
            }
            for (const t of taxonomiesData.tags || []) {
                addOption(t.name, t.category || 'Theme', t.count)
            }
        }

        return Array.from(map.values()).sort((a, b) => {
            if (a.category === 'Genre' && b.category !== 'Genre') return -1
            if (a.category !== 'Genre' && b.category === 'Genre') return 1
            return b.count - a.count || a.name.localeCompare(b.name)
        })
    }, [genresData, taxonomiesData])

    const filteredTaxonomyOptions = useMemo(() => {
        const q = taxSearch.trim().toLowerCase()
        return allTaxonomyOptions.filter((item) => {
            if (taxCategoryTab !== 'all' && item.category !== taxCategoryTab) return false
            if (q && !item.name.toLowerCase().includes(q)) return false
            return true
        })
    }, [allTaxonomyOptions, taxSearch, taxCategoryTab])

    const toggleTerm = (termName: string) => {
        const clean = cleanTaxonomyToken(termName)
        setSelectedTerms((prev) => {
            const exists = prev.some((t) => t.toLowerCase() === clean.toLowerCase())
            if (exists) {
                return prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())
            }
            return [...prev, clean]
        })
        setCurrentPage(1)
    }

    // Construcción de parámetros para el BFF
    const filterParams = useMemo(() => {
        return {
            page: currentPage,
            page_size: 50,
            q: submittedSearch.trim() || undefined,
            studio: studio || undefined,
            tags: selectedTerms.length > 0 ? selectedTerms.join(',') : undefined,
            season: season || undefined,
            year: year || undefined,
            min_score: minScore.trim() !== '' ? minScore.trim().replace(',', '.') : undefined,
            max_score: maxScore.trim() !== '' ? maxScore.trim().replace(',', '.') : undefined,
            format: format || undefined,
            streaming: selectedStreaming.length > 0 ? selectedStreaming.join(',') : undefined,
            ordering: ordering || '-score',
            no_sequels: noSequels ? true : undefined,
            not_in_my_list: isAuthenticated && notInMyList ? true : undefined,
            exclude_ids:
                isAuthenticated && notInMyList && filas.length
                    ? Array.from(myListIds).join(',')
                    : undefined,
        }
    }, [
        currentPage,
        submittedSearch,
        studio,
        selectedTerms,
        season,
        year,
        minScore,
        maxScore,
        format,
        selectedStreaming,
        ordering,
        noSequels,
        notInMyList,
        filas.length,
        myListIds,
        isAuthenticated,
    ])

    const { data: catalogData, isLoading, isFetching, isError } = useCatalogQuery(filterParams)

    const animes = catalogData?.results || []
    const totalCount = catalogData?.count || 0
    const totalPages = Math.max(1, Math.ceil(totalCount / 50))

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmittedSearch(searchInput.trim())
        setCurrentPage(1)
    }

    const handleClearFilters = () => {
        setStudio('')
        setSelectedTerms([])
        setSelectedStreaming([])
        setSeason('')
        setYear('')
        setMinScore('')
        setMaxScore('')
        setFormat('')
        setOrdering('-score')
        setNoSequels(false)
        setNotInMyList(false)
        setSearchInput('')
        setSubmittedSearch('')
        setCurrentPage(1)
    }

    const hasActiveFilters = Boolean(
        studio ||
            selectedTerms.length > 0 ||
            selectedStreaming.length > 0 ||
            season ||
            year ||
            minScore ||
            maxScore ||
            format ||
            ordering !== '-score' ||
            noSequels ||
            (isAuthenticated && notInMyList) ||
            submittedSearch
    )

    const handleOpenAnimeProfile = (anime: ApiAnimeData) => {
        setActiveProfileAnime(anime)
        setActiveProfileMalId(anime.mal_id)
        navigate(`/anime/${anime.mal_id}`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleCloseAnimeProfile = (pageOverride?: number) => {
        const targetPage = Math.max(1, pageOverride ?? currentPage)
        setActiveProfileMalId(null)
        setActiveProfileAnime(null)
        navigate(`/catalogo/${targetPage}`)
    }

    const handleQuickAdd = async (anime: ApiAnimeData, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        if (!isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        if (myListIds.has(anime.mal_id)) return
        try {
            await agregarAnime(
                {
                    id: `entry_${anime.mal_id}_${Date.now()}`,
                    malId: anime.mal_id,
                    estado: 'pendiente',
                    nota: null,
                    episodiosVistos: 0,
                    favorito: false,
                    carpetaId: undefined,
                    tags: [],
                    comentario: '',
                },
                anime
            )
            setAddedAnimeId(anime.mal_id)
            setTimeout(() => setAddedAnimeId(null), 2500)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al agregar a Mi Lista'
            if (msg.includes('iniciar sesión') || msg.includes('credenciales')) {
                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                dialog?.showModal()
            }
            console.error('Error al agregar a Mi Lista:', err)
        }
    }

    // Si hay un anime seleccionado, renderizar su Visual Tipo Perfil completa
    if (activeProfileMalId) {
        return (
            <AnimeProfileView
                malId={activeProfileMalId}
                initialAnime={
                    activeProfileAnime?.mal_id === activeProfileMalId ? activeProfileAnime : null
                }
                onBack={handleCloseAnimeProfile}
                onSelectAnime={(nextId, nextAnime) => {
                    setActiveProfileAnime(nextAnime || null)
                    setActiveProfileMalId(nextId)
                    navigate(`/anime/${nextId}`)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onFilterByGenreOrTag={(term) => {
                    setSelectedTerms([term])
                    setCurrentPageState(1)
                    handleCloseAnimeProfile(1)
                }}
                onFilterByStudio={(st) => {
                    setStudio(st)
                    setCurrentPageState(1)
                    handleCloseAnimeProfile(1)
                }}
            />
        )
    }

    return (
        <section
            className="cat-root py-4 px-3 px-md-5"
            style={{ '--cat-acento': acento, '--ml-acento': acento } as React.CSSProperties}
        >
            <div className="container" style={{ maxWidth: '1240px' }}>
                {/* ---------- Caja de Filtros de Catálogo ---------- */}
                <div className="cat-filter-card mb-4">
                    <div className="cat-filter-header-row">
                        <div className="cat-filter-title mb-0">
                            <SlidersHorizontal size={14} style={{ color: 'var(--cat-warning)' }} />
                            <span>Filtros de Catálogo & Taxonomía de AniList</span>
                        </div>

                        {/* Buscador Compacto Integrado */}
                        <form onSubmit={handleSearchSubmit} className="cat-search-row">
                            <div className="cat-search-input-wrapper">
                                <Search size={14} className="cat-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Buscar por título, título en inglés, estudio..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="cat-search-control"
                                />
                            </div>
                            <button type="submit" className="cat-btn-search">
                                Buscar
                            </button>
                        </form>
                    </div>

                    {/* Grilla Horizontal de Filtros Desplegables */}
                    <div className="cat-filter-grid">
                        <div className="cat-filter-col">
                            <label className="cat-filter-label">ESTUDIO</label>
                            <select
                                className="cat-select"
                                value={studio}
                                onChange={(e) => {
                                    setStudio(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="">Todos los Estudios</option>
                                {studiosData?.map((s) => (
                                    <option key={s.studio} value={s.studio}>
                                        {s.studio}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selector Multi-Género + Taxonomías de AniList */}
                        <div className="cat-filter-col position-relative" ref={taxDropdownRef}>
                            <label className="cat-filter-label" title="Géneros y Taxonomía de AniList">
                                GÉNEROS Y TAGS
                            </label>
                            <button
                                type="button"
                                className={`cat-tax-trigger-btn ${taxDropdownOpen ? 'open' : ''}`}
                                onClick={() => setTaxDropdownOpen((prev) => !prev)}
                            >
                                <span className="text-truncate">
                                    {selectedTerms.length === 0
                                        ? 'Géneros y Tags...'
                                        : selectedTerms.length === 1
                                          ? selectedTerms[0]
                                          : `${selectedTerms.length} seleccionados`}
                                </span>
                                <ChevronDown size={13} className="text-secondary flex-shrink-0" />
                            </button>

                            {taxDropdownOpen && (
                                <div className="cat-tax-popover">
                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                        <span className="small fw-bold text-white" style={{ fontSize: '0.78rem' }}>
                                            Selecciona uno o varios Géneros y Media Tags (Intersección AND)
                                        </span>
                                        {selectedTerms.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTerms([])
                                                    setCurrentPage(1)
                                                }}
                                                className="btn btn-link p-0 text-secondary text-decoration-none"
                                                style={{ fontSize: '0.72rem' }}
                                            >
                                                Limpiar ({selectedTerms.length})
                                            </button>
                                        )}
                                    </div>

                                    {/* Buscador interno de taxonomías */}
                                    <div className="position-relative mb-2">
                                        <Search
                                            size={13}
                                            className="position-absolute text-secondary"
                                            style={{ left: 10, top: '50%', transform: 'translateY(-50%)' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Buscar género o tag (ej: Isekai, Revenge, Vikings, Mecha, Seinen)..."
                                            value={taxSearch}
                                            onChange={(e) => setTaxSearch(e.target.value)}
                                            className="cat-search-control py-1.5"
                                            style={{ paddingLeft: '2rem', fontSize: '0.78rem' }}
                                        />
                                    </div>

                                    {/* Pestañas por categoría de AniList */}
                                    <div className="cat-tax-tabs">
                                        {(
                                            [
                                                { id: 'all', label: 'Todos' },
                                                { id: 'Genre', label: 'Géneros' },
                                                { id: 'Theme', label: 'Temáticas / Tropos' },
                                                { id: 'Cast', label: 'Elenco / Cast' },
                                                { id: 'Setting', label: 'Ambientación' },
                                                { id: 'Demographic', label: 'Demografía' },
                                            ] as Array<{ id: TaxonomyTabId; label: string }>
                                        ).map((tab) => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                className={`cat-tax-tab ${taxCategoryTab === tab.id ? 'active' : ''}`}
                                                onClick={() => setTaxCategoryTab(tab.id)}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Lista de opciones multi-seleccionables */}
                                    <div className="cat-tax-list">
                                        {filteredTaxonomyOptions.length === 0 ? (
                                            <div className="small text-secondary py-2">
                                                No se encontraron etiquetas que coincidan con "{taxSearch}".
                                            </div>
                                        ) : (
                                            filteredTaxonomyOptions.slice(0, 120).map((opt) => {
                                                const isSel = selectedTerms.some(
                                                    (t) => t.toLowerCase() === opt.name.toLowerCase()
                                                )
                                                return (
                                                    <button
                                                        key={opt.name}
                                                        type="button"
                                                        className={`cat-tax-option ${isSel ? 'selected' : ''}`}
                                                        onClick={() => toggleTerm(opt.name)}
                                                    >
                                                        {isSel && <Check size={11} />}
                                                        <span>{opt.name}</span>
                                                        {opt.count > 0 && (
                                                            <span className="cat-tax-option-count">
                                                                {opt.count}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="cat-filter-col">
                            <label className="cat-filter-label">TEMPORADA</label>
                            <select
                                className="cat-select"
                                value={season}
                                onChange={(e) => {
                                    setSeason(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                {SEASONS_LIST.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="cat-filter-col">
                            <label className="cat-filter-label">AÑO</label>
                            <select
                                className="cat-select"
                                value={year}
                                onChange={(e) => {
                                    setYear(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="">Todos los Años</option>
                                {yearsList.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="cat-filter-col">
                            <label className="cat-filter-label">NOTA</label>
                            <div className="cat-score-range-box">
                                <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    inputMode="decimal"
                                    placeholder="Mín"
                                    className="cat-score-range-input"
                                    aria-label="Nota mínima"
                                    value={minScore}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val === '' || /^\d{0,2}([.,]\d{0,2})?$/.test(val)) {
                                            setMinScore(val)
                                            setCurrentPage(1)
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const raw = e.target.value.trim().replace(',', '.')
                                        if (!raw) return
                                        const num = parseFloat(raw)
                                        if (Number.isNaN(num)) {
                                            setMinScore('')
                                        } else {
                                            const clamped = Math.max(0, Math.min(10, num))
                                            setMinScore(String(Number(clamped.toFixed(2))))
                                        }
                                    }}
                                />
                                <span className="cat-score-range-sep" aria-hidden="true">–</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    inputMode="decimal"
                                    placeholder="Máx"
                                    className="cat-score-range-input"
                                    aria-label="Nota máxima"
                                    value={maxScore}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val === '' || /^\d{0,2}([.,]\d{0,2})?$/.test(val)) {
                                            setMaxScore(val)
                                            setCurrentPage(1)
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const raw = e.target.value.trim().replace(',', '.')
                                        if (!raw) return
                                        const num = parseFloat(raw)
                                        if (Number.isNaN(num)) {
                                            setMaxScore('')
                                        } else {
                                            const clamped = Math.max(0, Math.min(10, num))
                                            setMaxScore(String(Number(clamped.toFixed(2))))
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="cat-filter-col">
                            <label className="cat-filter-label">FORMATO</label>
                            <select
                                className="cat-select"
                                value={format}
                                onChange={(e) => {
                                    setFormat(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                {FORMATS_LIST.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="cat-filter-col">
                            <label className="cat-filter-label">ORDENAR POR</label>
                            <select
                                className="cat-select"
                                value={ordering}
                                onChange={(e) => {
                                    setOrdering(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                {ORDERING_LIST.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Chips de Géneros y Taxonomías seleccionadas (Intersección AND) */}
                    {selectedTerms.length > 0 && (
                        <div className="d-flex flex-wrap align-items-center gap-1.5 mt-2">
                            <span
                                className="small text-secondary fw-semibold d-inline-flex align-items-center gap-1 me-1"
                                style={{ fontSize: '0.72rem' }}
                            >
                                <Tag size={12} style={{ color: 'var(--cat-acento)' }} />
                                Cumpliendo simultáneamente:
                            </span>
                            {selectedTerms.map((term, idx) => (
                                <React.Fragment key={term}>
                                    <span className="cat-active-term-chip">
                                        <span>{term}</span>
                                        <button
                                            type="button"
                                            className="cat-active-term-remove"
                                            onClick={() => toggleTerm(term)}
                                            aria-label={`Quitar ${term}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                    {idx < selectedTerms.length - 1 && (
                                        <span className="small text-secondary fw-bold">+</span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    {/* Fila combinada: Filtros Rápidos (izquierda) + Disponible en / Iconos de Streaming (derecha) */}
                    <div className="cat-quick-and-streaming-row">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="small text-secondary fw-semibold me-1" style={{ fontSize: '0.72rem' }}>
                                Filtros rápidos:
                            </span>

                            <button
                                type="button"
                                onClick={() => {
                                    setNoSequels(!noSequels)
                                    setCurrentPage(1)
                                }}
                                className={`cat-toggle-chip ${noSequels ? 'active' : ''}`}
                            >
                                <span>No secuelas</span>
                            </button>

                            {isAuthenticated && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNotInMyList(!notInMyList)
                                        setCurrentPage(1)
                                    }}
                                    className={`cat-toggle-chip ${notInMyList ? 'active' : ''}`}
                                >
                                    <span>No en mi lista</span>
                                </button>
                            )}

                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="btn btn-link text-secondary text-decoration-none p-0 ms-2 small"
                                    style={{ fontSize: '0.74rem' }}
                                >
                                    ✕ Limpiar filtros
                                </button>
                            )}
                        </div>

                        <div className="cat-streaming-inline-group">
                            <span className="small text-secondary fw-semibold me-1" style={{ fontSize: '0.72rem' }}>
                                Disponible en:
                            </span>
                            <div className="cat-streaming-icons-row">
                                {OFFICIAL_STREAMING_PLATFORMS.map((platform) => {
                                    const isActive = selectedStreaming.includes(platform.id)
                                    return (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            onClick={() => toggleStreamingPlatform(platform.id)}
                                            className={`cat-streaming-icon-only-btn ${isActive ? 'active' : ''}`}
                                            style={{ '--sp-color': platform.color } as React.CSSProperties}
                                            title={platform.label}
                                            data-tooltip={platform.label}
                                            aria-label={platform.label}
                                            aria-pressed={isActive}
                                        >
                                            <img
                                                src={platform.icon}
                                                alt={platform.label}
                                                loading="lazy"
                                                className="cat-streaming-logo-img"
                                            />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---------- Conteo de Animes y Paginación Rápida ---------- */}
                <div className="d-flex justify-content-between align-items-center my-3">
                    <span className="small text-secondary" style={{ fontSize: '0.8rem' }}>
                        Mostrando <strong className="text-white">{animes.length}</strong> de{' '}
                        <strong className="text-white">{totalCount}</strong> animes clasificados
                    </span>

                    {totalPages > 1 && (
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                disabled={currentPage <= 1 || isFetching}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="cat-nav-btn"
                                title="Página anterior"
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <span className="small font-mono text-white">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={currentPage >= totalPages || isFetching}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="cat-nav-btn"
                                title="Página siguiente"
                            >
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="cat-divider mb-4" />

                {/* ---------- Grilla Adaptativa Óptima (5 columnas en desktop) ---------- */}
                {isLoading ? (
                    <div className="text-center py-5">
                        <Loader2
                            size={32}
                            className="text-secondary mb-3"
                            style={{ animation: 'spin 1s linear infinite' }}
                        />
                        <p className="small text-secondary">Cargando animes clasificados...</p>
                    </div>
                ) : isError ? (
                    <div
                        className="p-5 text-center rounded-4"
                        style={{ background: 'var(--cat-surface)', border: '1px dashed var(--cat-border)' }}
                    >
                        <p className="text-danger mb-2 small">
                            Hubo un problema al cargar los animes del catálogo.
                        </p>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="cat-btn-search py-1.5 px-3"
                        >
                            Restablecer Filtros
                        </button>
                    </div>
                ) : animes.length === 0 ? (
                    <div
                        className="p-5 text-center rounded-4"
                        style={{ background: 'var(--cat-surface)', border: '1px dashed var(--cat-border)' }}
                    >
                        <Film size={32} className="text-secondary mb-2 opacity-50" />
                        <h3 className="h6 fw-bold text-white mb-1">
                            No se encontraron animes con la combinación de filtros seleccionada
                        </h3>
                        <p className="small mb-3 text-secondary">
                            Prueba quitando alguna etiqueta de la intersección o relajando la nota mínima.
                        </p>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="cat-btn-search py-1.5 px-3"
                        >
                            Limpiar todos los filtros
                        </button>
                    </div>
                ) : (
                    <div className="cat-grid">
                        {animes.map((anime) => {
                            const staticRank = anime.rank && anime.rank > 0 ? anime.rank : null
                            const inMyList = myListIds.has(anime.mal_id)
                            const justAdded = addedAnimeId === anime.mal_id

                            return (
                                <article key={anime.mal_id} className="cat-anime-card">
                                    {/* Póster con Proporción Áurea 3/4 y Badges Superpuestos */}
                                    <div
                                        className="cat-poster-wrapper"
                                        onClick={() => handleOpenAnimeProfile(anime)}
                                        title={`Ver perfil completo de ${anime.title}`}
                                    >
                                        <img
                                            src={anime.image_url}
                                            alt={anime.title}
                                            loading="lazy"
                                            className="cat-poster-img"
                                        />

                                        {/* Badge de Ranking Estático Global (#1, #2, #3...) */}
                                        {staticRank !== null && (
                                            <div
                                                className="cat-rank-badge"
                                                title={`Puesto #${staticRank} en el Top Global`}
                                            >
                                                <Award size={10} className="text-warning" />
                                                <span>#{staticRank}</span>
                                            </div>
                                        )}

                                        {/* Badge de Temporada */}
                                        {anime.season_display && (
                                            <div className="cat-season-badge">{anime.season_display}</div>
                                        )}

                                        {/* Badge de Score MAL */}
                                        <div className="cat-score-badge">
                                            <Star size={11} fill="currentColor" />
                                            <span>
                                                {anime.score ? Number(anime.score).toFixed(2) : 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Contenido Inferior de la Tarjeta */}
                                    <div className="cat-card-body">
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenAnimeProfile(anime)}
                                                className="cat-card-title"
                                                title={anime.title}
                                            >
                                                {anime.title}
                                            </button>

                                            <div className="cat-card-studio">
                                                <Building2 size={11} className="text-secondary shrink-0" />
                                                <span>{anime.studio || 'Estudio no especificado'}</span>
                                            </div>
                                        </div>

                                        {/* Botón de Añadir a Mi Lista y Botón Ver */}
                                        <div className="cat-card-actions">
                                            <button
                                                type="button"
                                                onClick={(e) => handleQuickAdd(anime, e)}
                                                className={`cat-btn-add flex-grow-1 ${inMyList ? 'in-list' : ''}`}
                                                disabled={inMyList}
                                            >
                                                {justAdded ? (
                                                    <>
                                                        <Check size={12} className="text-success" />
                                                        <span>¡Guardado!</span>
                                                    </>
                                                ) : inMyList ? (
                                                    <>
                                                        <Check size={12} />
                                                        <span>En mi lista</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={12} />
                                                        <span>Añadir</span>
                                                    </>
                                                )}
                                            </button>

                                            {isLinksEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => openAnimeLink({ title: anime.title, title_english: anime.title_english }, e)}
                                                    className="cat-btn-ver"
                                                    title={`Abrir enlace asociado a ${anime.title}`}
                                                >
                                                    <Play size={10} fill="currentColor" />
                                                    <span>Ver</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}

                {/* ---------- Paginación Inferior ---------- */}
                {totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center py-4 mt-3 border-top border-dark">
                        <button
                            type="button"
                            disabled={currentPage <= 1 || isFetching}
                            onClick={() => {
                                setCurrentPage((p) => Math.max(1, p - 1))
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="cat-mode-pill-btn"
                            style={{
                                background: 'var(--cat-surface-2)',
                                border: '1px solid var(--cat-border)',
                            }}
                        >
                            <ChevronLeft size={14} />
                            <span>Página Anterior</span>
                        </button>

                        <div className="d-flex align-items-center gap-1.5">
                            <span className="small text-secondary">Página</span>
                            <span className="small font-mono fw-bold text-white px-2 py-0.5 rounded bg-black border border-dark">
                                {currentPage}
                            </span>
                            <span className="small text-secondary">de {totalPages}</span>
                        </div>

                        <button
                            type="button"
                            disabled={currentPage >= totalPages || isFetching}
                            onClick={() => {
                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="cat-mode-pill-btn"
                            style={{
                                background: 'var(--cat-surface-2)',
                                border: '1px solid var(--cat-border)',
                            }}
                        >
                            <span>Siguiente Página</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </section>
    )
}

export default AnimeCatalog
