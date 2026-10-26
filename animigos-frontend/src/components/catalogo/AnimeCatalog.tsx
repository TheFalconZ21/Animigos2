import React, { useState, useMemo } from 'react'
import {
    Search,
    SlidersHorizontal,
    Star,
    Trophy,
    Calendar,
    Users,
    Check,
    Plus,
    X,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Film,
    Sparkles,
} from 'lucide-react'
import {
    useCatalogQuery,
    useGenresQuery,
    useYearsQuery,
    useStudios,
} from '../../hooks/useCatalog'
import { useMyList } from '../../hooks/useMyList'
import type { ApiAnimeData } from '../../services/userListApi'
import { Dialogo } from '../mi-lista/piezas'
import '../mi-lista/mi-lista.css'
import './catalogo.css'

const GENRES_DEFAULT = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
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
    { id: '-score', label: 'Puntuación MAL (Mayor a menor)' },
    { id: 'score', label: 'Puntuación MAL (Menor a mayor)' },
    { id: '-popularity', label: 'Popularidad (Más populares)' },
    { id: '-season_year', label: 'Año (Más recientes)' },
    { id: 'title', label: 'Título (A–Z)' },
]

export const AnimeCatalog: React.FC = () => {
    // --- Capa de Lógica / Estado de Mi Lista para filtros cruzados ---
    const { filas, agregarAnime } = useMyList()
    const myListIds = useMemo(() => new Set(filas.map((f) => f.malId)), [filas])

    // --- Vista activa: 'top' (Catálogo principal) o 'seasonal' (Calendario) ---
    const [viewMode, setViewMode] = useState<'top' | 'seasonal'>('top')

    // --- Estados de Filtros ---
    const [studio, setStudio] = useState('')
    const [genre, setGenre] = useState('')
    const [season, setSeason] = useState('')
    const [year, setYear] = useState('')
    const [minScore, setMinScore] = useState('')
    const [format, setFormat] = useState('')
    const [ordering, setOrdering] = useState('-score')

    // Toggles rápidos
    const [noSequels, setNoSequels] = useState(false)
    const [notInMyList, setNotInMyList] = useState(false)
    const [recommendedByFriends, setRecommendedByFriends] = useState(false)

    // Búsqueda por texto y paginación
    const [searchInput, setSearchInput] = useState('')
    const [submittedSearch, setSubmittedSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)

    // Modal de detalle de anime
    const [selectedAnime, setSelectedAnime] = useState<ApiAnimeData | null>(null)
    const [addedAnimeId, setAddedAnimeId] = useState<number | null>(null)

    // --- Queries auxiliares (estudios, géneros, años) ---
    const { data: genresData } = useGenresQuery()
    const { data: yearsData } = useYearsQuery()
    const { data: studiosData } = useStudios()

    const genresList = genresData && genresData.length ? genresData : GENRES_DEFAULT
    const yearsList = yearsData && yearsData.length ? yearsData : [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2010, 2005, 2000]

    // Construcción de parámetros para el BFF
    const filterParams = useMemo(() => {
        return {
            page: currentPage,
            page_size: 50, // 50 animes a la vez según requerimiento
            q: submittedSearch.trim() || undefined,
            studio: studio || undefined,
            genre: genre || undefined,
            season: season || undefined,
            year: year || undefined,
            min_score: minScore || undefined,
            format: format || undefined,
            ordering: ordering || '-score',
            no_sequels: noSequels ? true : undefined,
            not_in_my_list: notInMyList ? true : undefined,
            exclude_ids: notInMyList && filas.length ? Array.from(myListIds).join(',') : undefined,
            recommended_by_friends: recommendedByFriends ? true : undefined,
        }
    }, [
        currentPage,
        submittedSearch,
        studio,
        genre,
        season,
        year,
        minScore,
        format,
        ordering,
        noSequels,
        notInMyList,
        recommendedByFriends,
        filas,
        myListIds,
    ])

    // --- Query principal de animes paginados (TanStack Query) ---
    const { data: catalogData, isLoading, isFetching, isError } = useCatalogQuery(filterParams)

    const animes = catalogData?.results || []
    const totalCount = catalogData?.count || 0
    const totalPages = Math.max(1, Math.ceil(totalCount / 50))

    // Manejo de búsqueda por texto
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmittedSearch(searchInput.trim())
        setCurrentPage(1)
    }

    const handleClearFilters = () => {
        setStudio('')
        setGenre('')
        setSeason('')
        setYear('')
        setMinScore('')
        setFormat('')
        setOrdering('-score')
        setNoSequels(false)
        setNotInMyList(false)
        setRecommendedByFriends(false)
        setSearchInput('')
        setSubmittedSearch('')
        setCurrentPage(1)
    }

    const hasActiveFilters = Boolean(
        studio ||
        genre ||
        season ||
        year ||
        minScore ||
        format ||
        ordering !== '-score' ||
        noSequels ||
        notInMyList ||
        recommendedByFriends ||
        submittedSearch
    )

    // Agregar a Mi Lista con retroalimentación instantánea
    const handleQuickAdd = async (anime: ApiAnimeData, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        if (myListIds.has(anime.mal_id)) return
        try {
            await agregarAnime({
                id: `entry_${anime.mal_id}_${Date.now()}`,
                malId: anime.mal_id,
                estado: 'pendiente',
                nota: null,
                episodiosVistos: 0,
                favorito: false,
                carpetaId: null,
                tags: [],
                comentario: '',
                modificado: new Date().toISOString(),
            }, anime)
            setAddedAnimeId(anime.mal_id)
            setTimeout(() => setAddedAnimeId(null), 2500)
        } catch (err) {
            console.error('Error al agregar a Mi Lista:', err)
        }
    }

    return (
        <section className="ml-root cat-root py-4 px-3 px-md-5">
            <div className="container" style={{ maxWidth: '1360px' }}>
                {/* ---------- Header Limpio (Sin Card) ---------- */}
                <header className="cat-header">
                    <span className="ml-eyebrow">CATÁLOGO OFICIAL · ANIMIGOS</span>
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-1">
                        <div>
                            <h1 className="ml-titulo">Catálogo de Animes</h1>
                            <p className="ml-sub mb-0">
                                Explora la base de datos completa clasificada por nota MAL descendiente. Descubre qué ver y agrégalo a tu lista.
                            </p>
                        </div>

                        {/* Selector de Vista: [Top Animes] y [De Temporada] */}
                        <div className="ml-tabs mb-0">
                            <button
                                type="button"
                                className="ml-tab"
                                aria-selected={viewMode === 'top'}
                                onClick={() => {
                                    setViewMode('top')
                                    setSeason('')
                                    setCurrentPage(1)
                                }}
                            >
                                <Trophy size={15} />
                                <span>Top Animes</span>
                            </button>
                            <button
                                type="button"
                                className="ml-tab"
                                aria-selected={viewMode === 'seasonal'}
                                onClick={() => {
                                    setViewMode('seasonal')
                                    setSeason('fall')
                                    setCurrentPage(1)
                                }}
                            >
                                <Calendar size={15} />
                                <span>De Temporada (Calendario)</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* ---------- Panel de Filtros de Catálogo ---------- */}
                <div className="cat-filter-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="d-flex align-items-center gap-2">
                            <SlidersHorizontal size={16} style={{ color: 'var(--cat-acento)' }} />
                            <span className="small fw-bold text-white text-uppercase" style={{ letterSpacing: '0.06em' }}>
                                Filtros de Catálogo
                            </span>
                        </div>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="ml-btn ml-btn-fantasma ml-btn-sm py-0.5 px-2 text-danger"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <X size={12} /> Limpiar filtros
                            </button>
                        )}
                    </div>

                    {/* Fila 1: Selectores desplegables */}
                    <div className="row g-2 g-md-3 mb-3">
                        {/* Estudio */}
                        <div className="col-6 col-md-4 col-lg-2">
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
                                        {s.studio} ({s.count})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Género */}
                        <div className="col-6 col-md-4 col-lg-2">
                            <label className="cat-filter-label">GÉNERO</label>
                            <select
                                className="cat-select"
                                value={genre}
                                onChange={(e) => {
                                    setGenre(e.target.value)
                                    setCurrentPage(1)
                                }}
                            >
                                <option value="">Todos los Géneros</option>
                                {genresList.map((g) => (
                                    <option key={g} value={g}>
                                        {g}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Temporada */}
                        <div className="col-6 col-md-4 col-lg-2">
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

                        {/* Año */}
                        <div className="col-6 col-md-4 col-lg-2">
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

                        {/* Nota Mínima */}
                        <div className="col-6 col-md-4 col-lg-2">
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

                        {/* Ordenar Por */}
                        <div className="col-6 col-md-4 col-lg-2">
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

                    {/* Fila 2: Formato + Buscador con botón */}
                    <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center mb-3">
                        <div className="col-12 col-md-3 col-lg-2">
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

                        <div className="col-12 col-md-7 col-lg-8 position-relative">
                            <Search
                                size={15}
                                className="position-absolute text-secondary"
                                style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                            />
                            <input
                                type="text"
                                placeholder="Buscar en Top Animes por título, estudio..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="cat-search-input"
                            />
                        </div>

                        <div className="col-12 col-md-2 col-lg-2">
                            <button
                                type="submit"
                                className="wp-btn-pill-primary w-100 justify-content-center py-2"
                                style={{ borderRadius: '8px', fontSize: '0.82rem' }}
                            >
                                <span>Buscar</span>
                            </button>
                        </div>
                    </form>

                    {/* Fila 3: Chips de filtro rápido */}
                    <div className="d-flex flex-wrap align-items-center gap-2 pt-2 border-top" style={{ borderColor: 'var(--cat-border)' }}>
                        <span className="small text-secondary fw-semibold me-1" style={{ fontSize: '0.75rem' }}>
                            Filtros rápidos:
                        </span>

                        {/* No secuelas */}
                        <button
                            type="button"
                            onClick={() => {
                                setNoSequels(!noSequels)
                                setCurrentPage(1)
                            }}
                            className={`cat-toggle-chip ${noSequels ? 'active' : ''}`}
                        >
                            <span>🚫</span>
                            <span>No secuelas</span>
                        </button>

                        {/* No en mi lista */}
                        <button
                            type="button"
                            onClick={() => {
                                setNotInMyList(!notInMyList)
                                setCurrentPage(1)
                            }}
                            className={`cat-toggle-chip ${notInMyList ? 'active' : ''}`}
                        >
                            <span>📖</span>
                            <span>No en mi lista</span>
                        </button>

                        {/* Recomendadas por amigos */}
                        <button
                            type="button"
                            onClick={() => {
                                setRecommendedByFriends(!recommendedByFriends)
                                setCurrentPage(1)
                            }}
                            className={`cat-toggle-chip ${recommendedByFriends ? 'active' : ''}`}
                        >
                            <span>👥</span>
                            <span>Recomendadas por amigos</span>
                        </button>
                    </div>
                </div>

                {/* ---------- Barra de Resumen / Conteo ---------- */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <span className="small" style={{ color: 'var(--cat-text-dim)' }}>
                        Mostrando <strong className="text-white">{animes.length}</strong> de <strong className="text-white">{totalCount}</strong> animes clasificados
                    </span>

                    {/* Paginación Rápida Superior */}
                    {totalPages > 1 && (
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                disabled={currentPage <= 1 || isFetching}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="ml-btn ml-btn-sm py-1 px-2.5"
                                title="Página anterior"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="small font-mono text-white">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={currentPage >= totalPages || isFetching}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="ml-btn ml-btn-sm py-1 px-2.5"
                                title="Página siguiente"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* ---------- Grilla de Animes (50 animes) ---------- */}
                {isLoading ? (
                    <div className="text-center py-5">
                        <Loader2 size={36} className="text-secondary mb-3" style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: 'var(--cat-text-dim)' }}>Cargando 50 animes del catálogo...</p>
                    </div>
                ) : isError ? (
                    <div className="p-5 text-center rounded-4" style={{ background: 'var(--cat-surface)', border: '1px dashed var(--cat-border)' }}>
                        <p className="text-danger mb-2">Hubo un problema al cargar los animes del catálogo.</p>
                        <button type="button" onClick={handleClearFilters} className="ml-btn ml-btn-acento ml-btn-sm">
                            Restablecer Filtros
                        </button>
                    </div>
                ) : animes.length === 0 ? (
                    <div className="p-5 text-center rounded-4" style={{ background: 'var(--cat-surface)', border: '1px dashed var(--cat-border)' }}>
                        <Film size={36} className="text-secondary mb-2 opacity-50" />
                        <h3 className="h6 fw-bold text-white mb-1">No se encontraron animes con los filtros seleccionados</h3>
                        <p className="small mb-3" style={{ color: 'var(--cat-text-dim)' }}>
                            Prueba ajustando la nota mínima, quitando filtros rápidos o buscando otro término.
                        </p>
                        <button type="button" onClick={handleClearFilters} className="ml-btn ml-btn-acento ml-btn-sm">
                            Limpiar todos los filtros
                        </button>
                    </div>
                ) : (
                    <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3 g-md-4">
                        {animes.map((anime, index) => {
                            const globalRank = (currentPage - 1) * 50 + index + 1
                            const isTop3 = globalRank <= 3
                            const inMyList = myListIds.has(anime.mal_id)
                            const justAdded = addedAnimeId === anime.mal_id

                            return (
                                <div key={anime.mal_id} className="col">
                                    <article className="cat-anime-card">
                                        {/* Contenedor del Póster */}
                                        <div
                                            className="cat-poster-wrapper cursor-pointer"
                                            onClick={() => setSelectedAnime(anime)}
                                            title={`Ver detalle de ${anime.title}`}
                                        >
                                            <img
                                                src={anime.image_url}
                                                alt={anime.title}
                                                loading="lazy"
                                                className="cat-poster-img"
                                            />

                                            {/* Badge de Ranking (#1, #2, #3...) */}
                                            <span className={`cat-rank-badge ${!isTop3 ? 'secondary-rank' : ''}`}>
                                                {isTop3 && <span>👑</span>}
                                                <span>#{globalRank}</span>
                                            </span>

                                            {/* Temporada / Año */}
                                            {anime.season_display && (
                                                <span className="cat-season-badge">
                                                    {anime.season_display}
                                                </span>
                                            )}

                                            {/* Calificación MAL */}
                                            <span className="cat-score-badge">
                                                <Star size={11} fill="currentColor" />
                                                <span>{anime.score ? Number(anime.score).toFixed(2) : '8.50'}</span>
                                            </span>
                                        </div>

                                        {/* Información de la Tarjeta */}
                                        <div className="cat-card-body">
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAnime(anime)}
                                                    className="cat-card-title"
                                                    title={anime.title}
                                                >
                                                    {anime.title}
                                                </button>

                                                {/* Estudio y Episodios */}
                                                <div className="cat-card-meta mt-1">
                                                    <span>🏛️ {anime.studio || 'Estudio Varios'}</span>
                                                    <span>·</span>
                                                    <span>{anime.episodes ? `${anime.episodes} eps` : 'TV'}</span>
                                                </div>
                                            </div>

                                            {/* Recomendadas por Amigos (como en la referencia) */}
                                            <div
                                                className="cat-friends-recommend"
                                                title={`Recomendado por: ${anime.recommended_by?.join(', ') || 'Comunidad Animigos'}`}
                                            >
                                                <Users size={12} className="flex-shrink-0" style={{ color: 'var(--cat-acento)' }} />
                                                <span className="text-truncate">
                                                    {anime.recommended_by && anime.recommended_by.length > 0
                                                        ? anime.recommended_by.join(', ')
                                                        : 'Comunidad Animigos'}
                                                </span>
                                            </div>

                                            {/* Botón Acción Rápida: Agregar a Mi Lista */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleQuickAdd(anime, e)}
                                                className={`cat-btn-add ${inMyList ? 'in-list' : ''}`}
                                                disabled={inMyList}
                                            >
                                                {justAdded ? (
                                                    <>
                                                        <Check size={13} className="text-success" />
                                                        <span>¡Guardado!</span>
                                                    </>
                                                ) : inMyList ? (
                                                    <>
                                                        <Check size={13} />
                                                        <span>En mi lista</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={13} />
                                                        <span>Agregar a Mi Lista</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </article>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ---------- Paginación Inferior (50 a la vez) ---------- */}
                {totalPages > 1 && (
                    <div className="cat-pagination-bar">
                        <button
                            type="button"
                            disabled={currentPage <= 1 || isFetching}
                            onClick={() => {
                                setCurrentPage((p) => Math.max(1, p - 1))
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="ml-btn ml-btn-sm"
                        >
                            <ChevronLeft size={15} />
                            <span>Página Anterior</span>
                        </button>

                        <div className="d-flex align-items-center gap-1">
                            <span className="small text-secondary">Página</span>
                            <span className="small font-mono fw-bold text-white px-2 py-0.5 rounded bg-dark">
                                {currentPage}
                            </span>
                            <span className="small text-secondary">de {totalPages} ({totalCount} animes)</span>
                        </div>

                        <button
                            type="button"
                            disabled={currentPage >= totalPages || isFetching}
                            onClick={() => {
                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="ml-btn ml-btn-sm"
                        >
                            <span>Siguiente Página</span>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                )}

                {/* ---------- Modal de Detalle de Anime ---------- */}
                <Dialogo
                    abierto={selectedAnime !== null}
                    onCerrar={() => setSelectedAnime(null)}
                    etiqueta={selectedAnime ? selectedAnime.title : 'Detalle'}
                    ancho={560}
                >
                    {selectedAnime && (
                        <div className="p-4 d-flex flex-column gap-3">
                            <div className="d-flex gap-3">
                                <img
                                    src={selectedAnime.image_url}
                                    alt={selectedAnime.title}
                                    className="rounded-3 shadow"
                                    style={{ width: 100, height: 142, objectFit: 'cover' }}
                                />
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="d-flex flex-wrap gap-2 mb-1">
                                        <span className="wp-chip font-mono text-warning">
                                            ★ {selectedAnime.score || '9.0'} MAL
                                        </span>
                                        <span className="wp-chip">
                                            {selectedAnime.type || 'TV'} · {selectedAnime.episodes || '?'} eps
                                        </span>
                                    </div>
                                    <h3 className="h6 fw-bold text-white mb-1">{selectedAnime.title}</h3>
                                    {selectedAnime.title_english && (
                                        <span className="small text-secondary d-block mb-1">
                                            {selectedAnime.title_english}
                                        </span>
                                    )}
                                    <div className="small font-mono" style={{ color: 'var(--cat-text-dim)', fontSize: '0.75rem' }}>
                                        Estudio: <strong className="text-white">{selectedAnime.studio || 'N/A'}</strong> · Temporada: <strong className="text-white">{selectedAnime.season_display || 'N/A'}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Géneros */}
                            {selectedAnime.genres && selectedAnime.genres.length > 0 && (
                                <div className="d-flex flex-wrap gap-1.5">
                                    {selectedAnime.genres.map((g) => (
                                        <span key={g} className="ml-tag">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Sinopsis */}
                            <div>
                                <span className="cat-filter-label">SINOPSIS</span>
                                <p className="small mb-0" style={{ color: 'var(--cat-text-muted)', lineHeight: 1.6, maxHeight: '180px', overflowY: 'auto' }}>
                                    {selectedAnime.synopsis || 'Sin sinopsis disponible actualmente para este título.'}
                                </p>
                            </div>

                            {/* Amigos que recomiendan */}
                            {selectedAnime.recommended_by && selectedAnime.recommended_by.length > 0 && (
                                <div className="p-2.5 rounded-2 d-flex align-items-center gap-2" style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}>
                                    <Sparkles size={16} className="text-warning flex-shrink-0" />
                                    <span className="small" style={{ color: 'var(--cat-text-muted)', fontSize: '0.78rem' }}>
                                        Recomendado con entusiasmo por: <strong className="text-white">{selectedAnime.recommended_by.join(', ')}</strong>
                                    </span>
                                </div>
                            )}

                            {/* Botones de Acción */}
                            <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--cat-border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedAnime(null)}
                                    className="ml-btn ml-btn-fantasma ml-btn-sm"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleQuickAdd(selectedAnime)
                                    }}
                                    disabled={myListIds.has(selectedAnime.mal_id)}
                                    className="ml-btn ml-btn-acento ml-btn-sm"
                                >
                                    {myListIds.has(selectedAnime.mal_id) ? (
                                        <>
                                            <Check size={14} />
                                            <span>Ya está en Mi Lista</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={14} />
                                            <span>Agregar a Mi Lista</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </Dialogo>
            </div>
        </section>
    )
}

export default AnimeCatalog
