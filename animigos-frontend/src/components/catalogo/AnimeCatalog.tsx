import React, { useState, useMemo, useRef, useEffect } from 'react'
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
import type { ApiAnimeData } from '../../services/userListApi'
import { AnimeProfileView } from './AnimeProfileView'
import './catalogo.css'

interface AnimeCatalogProps {
    initialAnimeId?: number | null
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

const MIN_SCORES_LIST = [
    { id: '', label: 'Todas las notas' },
    { id: '9.0', label: '★ 9.0 o más' },
    { id: '8.5', label: '★ 8.5 o más' },
    { id: '8.0', label: '★ 8.0 o más' },
    { id: '7.5', label: '★ 7.5 o más' },
    { id: '7.0', label: '★ 7.0 o más' },
]

const ORDERING_LIST = [
    { id: '-score', label: 'Puntuación MAL' },
    { id: 'score', label: 'Puntuación MAL (Menor)' },
    { id: '-popularity', label: 'Popularidad' },
    { id: '-season_year', label: 'Año (Recientes)' },
    { id: 'title', label: 'Título (A–Z)' },
]

type TaxonomyTabId = 'all' | 'Genre' | 'Theme' | 'Cast' | 'Setting' | 'Demographic'

export const AnimeCatalog: React.FC<AnimeCatalogProps> = ({ initialAnimeId = null }) => {
    const { isAuthenticated } = useAuth()
    const { filas, agregarAnime } = useMyList()
    const { acento } = useThemeAccent()
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
    const [selectedTerms, setSelectedTerms] = useState<string[]>([])
    const [season, setSeason] = useState('')
    const [year, setYear] = useState('')
    const [minScore, setMinScore] = useState('')
    const [format, setFormat] = useState('')
    const [ordering, setOrdering] = useState('-score')

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

    // Toggles rápidos
    const [noSequels, setNoSequels] = useState(false)
    const [notInMyList, setNotInMyList] = useState(false)

    // Búsqueda por texto y paginación
    const [searchInput, setSearchInput] = useState('')
    const [submittedSearch, setSubmittedSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [addedAnimeId, setAddedAnimeId] = useState<number | null>(null)

    // Queries auxiliares
    const { data: genresData } = useGenresQuery()
    const { data: taxonomiesData } = useTaxonomiesQuery()
    const { data: yearsData } = useYearsQuery()
    const { data: studiosData } = useStudios()

    const yearsList =
        yearsData && yearsData.length
            ? yearsData
            : [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2010, 2005, 2000]

    // Unificar Géneros y Media Tags de AniList para el selector multi-taxonomía
    const allTaxonomyOptions = useMemo(() => {
        const map = new Map<string, { name: string; category: string; count: number }>()

        const baseGenres = genresData && genresData.length ? genresData : GENRES_DEFAULT
        for (const g of baseGenres) {
            map.set(g.toLowerCase(), { name: g, category: 'Genre', count: 0 })
        }

        if (taxonomiesData) {
            for (const g of taxonomiesData.genres || []) {
                map.set(g.name.toLowerCase(), { name: g.name, category: 'Genre', count: g.count })
            }
            for (const t of taxonomiesData.tags || []) {
                const existing = map.get(t.name.toLowerCase())
                if (!existing) {
                    map.set(t.name.toLowerCase(), {
                        name: t.name,
                        category: t.category || 'Theme',
                        count: t.count,
                    })
                } else if (existing.count === 0) {
                    existing.count = t.count
                }
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
        setSelectedTerms((prev) => {
            const exists = prev.some((t) => t.toLowerCase() === termName.toLowerCase())
            if (exists) {
                return prev.filter((t) => t.toLowerCase() !== termName.toLowerCase())
            }
            return [...prev, termName]
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
            min_score: minScore || undefined,
            format: format || undefined,
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
        format,
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
        setSeason('')
        setYear('')
        setMinScore('')
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
            season ||
            year ||
            minScore ||
            format ||
            ordering !== '-score' ||
            noSequels ||
            (isAuthenticated && notInMyList) ||
            submittedSearch
    )

    const handleOpenAnimeProfile = (anime: ApiAnimeData) => {
        setActiveProfileAnime(anime)
        setActiveProfileMalId(anime.mal_id)
        window.location.hash = `#anime/${anime.mal_id}`
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleCloseAnimeProfile = () => {
        setActiveProfileMalId(null)
        setActiveProfileAnime(null)
        window.location.hash = '#catalogo'
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
        } catch (err) {
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
                    window.location.hash = `#anime/${nextId}`
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onFilterByGenreOrTag={(term) => {
                    setSelectedTerms([term])
                    setCurrentPage(1)
                    handleCloseAnimeProfile()
                }}
                onFilterByStudio={(st) => {
                    setStudio(st)
                    setCurrentPage(1)
                    handleCloseAnimeProfile()
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
                    <div className="cat-filter-title">
                        <SlidersHorizontal size={14} style={{ color: 'var(--cat-warning)' }} />
                        <span>Filtros de Catálogo & Taxonomía de AniList</span>
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
                            <label className="cat-filter-label">GÉNEROS & TAXONOMÍA</label>
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
                            <label className="cat-filter-label">NOTA MÍNIMA</label>
                            <select
                                className="cat-select"
                                value={minScore}
                                onChange={(e) => {
                                    setMinScore(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                {MIN_SCORES_LIST.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
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

                    {/* Fila de Buscador */}
                    <form onSubmit={handleSearchSubmit} className="cat-search-row">
                        <div className="cat-search-input-wrapper">
                            <Search size={15} className="cat-search-icon" />
                            <input
                                type="text"
                                placeholder="Buscar en Top Animes por título, título en inglés, estudio..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="cat-search-control"
                            />
                        </div>
                        <button type="submit" className="cat-btn-search">
                            Buscar
                        </button>
                    </form>

                    {/* Chips de Géneros y Taxonomías seleccionadas (Intersección AND) */}
                    {selectedTerms.length > 0 && (
                        <div className="d-flex flex-wrap align-items-center gap-1.5 mt-3 pt-2 border-top border-dark">
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

                    {/* Chips de Filtros Rápidos */}
                    <div className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-2">
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
                                className="btn btn-link text-secondary text-decoration-none p-0 ms-auto small"
                                style={{ fontSize: '0.74rem' }}
                            >
                                ✕ Limpiar filtros
                            </button>
                        )}
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
                        {animes.map((anime, index) => {
                            const globalRank = (currentPage - 1) * 50 + index + 1
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

                                        {/* Badge de Ranking (#1, #2, #3...) */}
                                        <div className="cat-rank-badge">
                                            <Award size={10} className="text-warning" />
                                            <span>#{globalRank}</span>
                                        </div>

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

                                        {/* Botón de Añadir a Mi Lista */}
                                        <button
                                            type="button"
                                            onClick={(e) => handleQuickAdd(anime, e)}
                                            className={`cat-btn-add ${inMyList ? 'in-list' : ''}`}
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
                                                    <span>Añadir a Mi Lista</span>
                                                </>
                                            )}
                                        </button>
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
