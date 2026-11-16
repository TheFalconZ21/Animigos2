import React, { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Search, Tag, X } from 'lucide-react'
import {
    useGenresQuery,
    useStudios,
    useTaxonomiesQuery,
    useYearsQuery,
} from '../../hooks/useCatalog'
import { useCatalogFilters } from '../../hooks/useCatalogFilters'
import { useAuth } from '../../context/AuthContext'
import './catalogo.css'

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
    { id: 'season_year', label: 'Fecha de emisión (Ascendente)' },
    { id: 'title', label: 'Título (A–Z)' },
]

type TaxonomyTabId = 'all' | 'Genre' | 'Theme' | 'Cast' | 'Setting' | 'Demographic'
type FilterCategoryId = 'year' | 'studio' | 'quick' | 'format' | 'taxonomy' | 'minScore' | 'ordering' | 'season'

const FILTER_CATEGORIES: Array<{ id: FilterCategoryId; label: string }> = [
    { id: 'year', label: 'Año' },
    { id: 'studio', label: 'Estudio' },
    { id: 'quick', label: 'Filtros rápidos' },
    { id: 'format', label: 'Formato' },
    { id: 'taxonomy', label: 'Géneros y taxonomía' },
    { id: 'minScore', label: 'Nota mínima' },
    { id: 'ordering', label: 'Ordenar por' },
    { id: 'season', label: 'Temporada' },
]

const TAXONOMY_TABS: Array<{ id: TaxonomyTabId; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'Genre', label: 'Géneros' },
    { id: 'Theme', label: 'Temáticas / Tropos' },
    { id: 'Cast', label: 'Elenco / Cast' },
    { id: 'Setting', label: 'Ambientación' },
    { id: 'Demographic', label: 'Demografía' },
]

export const CatalogFiltersSidebar: React.FC = () => {
    const { filters, setFilters, clearFilters } = useCatalogFilters()
    const { isAuthenticated } = useAuth()
    const { data: genresData } = useGenresQuery()
    const { data: taxonomiesData } = useTaxonomiesQuery()
    const { data: yearsData } = useYearsQuery()
    const { data: studiosData } = useStudios()
    const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false)
    const [activeFilterCategory, setActiveFilterCategory] = useState<FilterCategoryId | null>(null)
    const [taxSearch, setTaxSearch] = useState('')
    const [taxCategoryTab, setTaxCategoryTab] = useState<TaxonomyTabId>('all')

    const yearsList = yearsData?.length
        ? yearsData
        : [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2010, 2005, 2000]

    const cleanTaxonomyToken = (raw: string): string => {
        return raw.replace(/^[["'\s]+|[\]"'\s]+$/g, '').trim()
    }

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
                    count: count > 0 ? count : 0,
                })
            }
        }

        for (const genre of genresData?.length ? genresData : GENRES_DEFAULT) {
            addOption(genre, 'Genre', 0)
        }
        for (const genre of taxonomiesData?.genres || []) {
            addOption(genre.name, 'Genre', genre.count)
        }
        for (const tag of taxonomiesData?.tags || []) {
            addOption(tag.name, tag.category || 'Theme', tag.count)
        }

        return Array.from(map.values()).sort((a, b) => {
            if (a.category === 'Genre' && b.category !== 'Genre') return -1
            if (a.category !== 'Genre' && b.category === 'Genre') return 1
            return b.count - a.count || a.name.localeCompare(b.name)
        })
    }, [genresData, taxonomiesData])

    const filteredTaxonomyOptions = useMemo(() => {
        const query = taxSearch.trim().toLowerCase()
        return allTaxonomyOptions.filter((item) => {
            if (taxCategoryTab !== 'all' && item.category !== taxCategoryTab) return false
            return !query || item.name.toLowerCase().includes(query)
        })
    }, [allTaxonomyOptions, taxSearch, taxCategoryTab])

    const hasActiveFilters = Boolean(
        filters.studio ||
            filters.selectedTerms.length > 0 ||
            filters.season ||
            filters.year ||
            filters.minScore ||
            filters.format ||
            filters.ordering !== '-score' ||
            filters.noSequels ||
            (isAuthenticated && filters.notInMyList) ||
            filters.submittedSearch
    )

    const updateFilter = <K extends keyof typeof filters>(
        key: K,
        value: (typeof filters)[K],
    ) => {
        setFilters((current) => ({ ...current, [key]: value, currentPage: 1 }))
    }

    const toggleTerm = (termName: string) => {
        const clean = cleanTaxonomyToken(termName)
        setFilters((current) => {
            const exists = current.selectedTerms.some((term) => term.toLowerCase() === clean.toLowerCase())
            return {
                ...current,
                selectedTerms: exists
                    ? current.selectedTerms.filter((term) => term.toLowerCase() !== clean.toLowerCase())
                    : [...current.selectedTerms, clean],
                currentPage: 1,
            }
        })
    }

    const renderCategoryControl = (category: FilterCategoryId) => {
        switch (category) {
            case 'year':
                return (
                    <div className="cat-sidebar-filter-field">
                        <label className="cat-filter-label" htmlFor="cat-filter-year">AÑO</label>
                        <select id="cat-filter-year" className="cat-select" value={filters.year} onChange={(e) => updateFilter('year', e.target.value)}>
                            <option value="">Todos los Años</option>
                            {yearsList.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                )
            case 'studio':
                return (
                    <div className="cat-sidebar-filter-field">
                        <label className="cat-filter-label" htmlFor="cat-filter-studio">ESTUDIO</label>
                        <select id="cat-filter-studio" className="cat-select" value={filters.studio} onChange={(e) => updateFilter('studio', e.target.value)}>
                            <option value="">Todos los Estudios</option>
                            {studiosData?.map((studio) => <option key={studio.studio} value={studio.studio}>{studio.studio}</option>)}
                        </select>
                    </div>
                )
            case 'quick':
                return (
                    <div className="cat-sidebar-filter-options">
                        <button type="button" onClick={() => updateFilter('noSequels', !filters.noSequels)} className={`cat-toggle-chip ${filters.noSequels ? 'active' : ''}`}>
                            No secuelas
                        </button>
                        {isAuthenticated && (
                            <button type="button" onClick={() => updateFilter('notInMyList', !filters.notInMyList)} className={`cat-toggle-chip ${filters.notInMyList ? 'active' : ''}`}>
                                No en mi lista
                            </button>
                        )}
                    </div>
                )
            case 'format':
                return (
                    <div className="cat-sidebar-filter-field">
                        <label className="cat-filter-label" htmlFor="cat-filter-format">FORMATO</label>
                        <select id="cat-filter-format" className="cat-select" value={filters.format} onChange={(e) => updateFilter('format', e.target.value)}>
                            {FORMATS_LIST.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
                        </select>
                    </div>
                )
            case 'taxonomy':
                return (
                    <div className="cat-sidebar-taxonomy">
                        <div className="cat-sidebar-taxonomy-heading">
                            <span>Selecciona uno o varios géneros y Media Tags (intersección AND)</span>
                            {filters.selectedTerms.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilters((current) => ({ ...current, selectedTerms: [], currentPage: 1 }))}
                                    className="cat-sidebar-clear-terms"
                                >
                                    Limpiar ({filters.selectedTerms.length})
                                </button>
                            )}
                        </div>
                        <div className="cat-sidebar-tax-search">
                            <Search size={13} className="cat-search-icon" />
                            <input
                                type="text"
                                aria-label="Buscar géneros y etiquetas"
                                placeholder="Buscar género o tag..."
                                value={taxSearch}
                                onChange={(e) => setTaxSearch(e.target.value)}
                                className="cat-search-control"
                            />
                        </div>
                        <div className="cat-sidebar-tax-tabs">
                            {TAXONOMY_TABS.map((tab) => (
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
                        <div className="cat-sidebar-tax-list">
                            {filteredTaxonomyOptions.length === 0 ? (
                                <div className="small text-secondary py-2">No se encontraron etiquetas.</div>
                            ) : filteredTaxonomyOptions.slice(0, 120).map((option) => {
                                const isSelected = filters.selectedTerms.some((term) => term.toLowerCase() === option.name.toLowerCase())
                                return (
                                    <button
                                        key={option.name}
                                        type="button"
                                        className={`cat-tax-option ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleTerm(option.name)}
                                    >
                                        {isSelected && <Check size={11} />}
                                        <span>{option.name}</span>
                                        {option.count > 0 && <span className="cat-tax-option-count">{option.count}</span>}
                                    </button>
                                )
                            })}
                        </div>
                        {filters.selectedTerms.length > 0 && (
                            <div className="cat-sidebar-active-terms">
                                <span className="cat-filter-active-label"><Tag size={12} /> Seleccionados</span>
                                {filters.selectedTerms.map((term) => (
                                    <span key={term} className="cat-active-term-chip">
                                        <span>{term}</span>
                                        <button type="button" className="cat-active-term-remove" onClick={() => toggleTerm(term)} aria-label={`Quitar ${term}`}>
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )
            case 'minScore':
                return (
                    <div className="cat-sidebar-filter-field">
                        <label className="cat-filter-label" htmlFor="cat-filter-score">NOTA MÍNIMA</label>
                        <select id="cat-filter-score" className="cat-select" value={filters.minScore} onChange={(e) => updateFilter('minScore', e.target.value)}>
                            {MIN_SCORES_LIST.map((score) => <option key={score.id} value={score.id}>{score.label}</option>)}
                        </select>
                    </div>
                )
            case 'ordering':
                return (
                    <div className="cat-sidebar-filter-field">
                        <label className="cat-filter-label" htmlFor="cat-filter-ordering">ORDENAR POR</label>
                        <select id="cat-filter-ordering" className="cat-select" value={filters.ordering} onChange={(e) => updateFilter('ordering', e.target.value)}>
                            {ORDERING_LIST.map((order) => <option key={order.id} value={order.id}>{order.label}</option>)}
                        </select>
                    </div>
                )
            case 'season':
                return (
                    <div className="cat-sidebar-filter-field">
                        <label className="cat-filter-label" htmlFor="cat-filter-season">TEMPORADA</label>
                        <select id="cat-filter-season" className="cat-select" value={filters.season} onChange={(e) => updateFilter('season', e.target.value)}>
                            {SEASONS_LIST.map((season) => <option key={season.id} value={season.id}>{season.label}</option>)}
                        </select>
                    </div>
                )
        }
    }

    return (
        <div className="cat-sidebar-filters">
            <div className="cat-sidebar-search-row">
                <button
                    type="button"
                    className="cat-sidebar-collapse-toggle"
                    onClick={() => setIsFiltersCollapsed((collapsed) => !collapsed)}
                    aria-label={isFiltersCollapsed ? 'Mostrar filtros del catálogo' : 'Ocultar filtros del catálogo'}
                    aria-expanded={!isFiltersCollapsed}
                    aria-controls={!isFiltersCollapsed ? 'cat-sidebar-filter-list' : undefined}
                    title={isFiltersCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
                >
                    {isFiltersCollapsed ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        setFilters((current) => ({
                            ...current,
                            submittedSearch: current.searchInput.trim(),
                            currentPage: 1,
                        }))
                    }}
                    className="cat-sidebar-search"
                >
                    <div className="cat-sidebar-search-field">
                        <Search size={14} className="cat-search-icon" />
                        <input
                            type="text"
                            aria-label="Buscar anime por título o estudio"
                            placeholder="Buscar en catálogo..."
                            value={filters.searchInput}
                            onChange={(event) => setFilters((current) => ({ ...current, searchInput: event.target.value }))}
                            className="cat-search-control"
                        />
                    </div>
                    <button type="submit" className="cat-btn-search" aria-label="Buscar" title="Buscar">
                        <Search size={16} aria-hidden="true" />
                    </button>
                    {!isFiltersCollapsed && hasActiveFilters && (
                        <button type="button" onClick={clearFilters} className="cat-sidebar-clear-filters">
                            Limpiar
                        </button>
                    )}
                </form>
            </div>

            {!isFiltersCollapsed && (
                <div id="cat-sidebar-filter-list" className="cat-sidebar-filter-list">
                    {FILTER_CATEGORIES.map((category) => {
                        const isExpanded = activeFilterCategory === category.id
                        return (
                            <div key={category.id} className="cat-sidebar-filter-category">
                                <button
                                    type="button"
                                    className={`cat-sidebar-filter-trigger ${isExpanded ? 'active' : ''}`}
                                    onClick={() => setActiveFilterCategory(isExpanded ? null : category.id)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`cat-sidebar-filter-${category.id}`}
                                >
                                    <span>{category.label}</span>
                                    <ChevronDown size={13} />
                                </button>
                                {isExpanded && (
                                    <div id={`cat-sidebar-filter-${category.id}`} className="cat-sidebar-filter-content">
                                        {renderCategoryControl(category.id)}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
