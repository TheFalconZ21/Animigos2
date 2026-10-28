import React, { useState, useMemo } from 'react'
import {
    Search,
    SlidersHorizontal,
    Star,
    Users,
    Check,
    Plus,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Film,
    Sparkles,
    Building2,
    Award,
} from 'lucide-react'
import {
    useCatalogQuery,
    useGenresQuery,
    useYearsQuery,
    useStudios,
} from '../../hooks/useCatalog'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { useAuth } from '../../context/AuthContext'
import type { ApiAnimeData } from '../../services/userListApi'
import { Dialogo } from '../mi-lista/piezas'
import { AnimeScoreHistoryChart } from './AnimeScoreHistoryChart'
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
    { id: '-score', label: 'Puntuación MAL' },
    { id: 'score', label: 'Puntuación MAL (Menor)' },
    { id: '-popularity', label: 'Popularidad' },
    { id: '-season_year', label: 'Año (Recientes)' },
    { id: 'title', label: 'Título (A–Z)' },
]

const getRecsText = (recs?: string[] | { user_id: number; username: string }[]) => {
    if (!recs || !recs.length) return ''
    return recs.map((r: any) => (typeof r === 'string' ? r : r.username || 'Amigo')).join(', ')
}

export const AnimeCatalog: React.FC = () => {
    // --- Capa de Lógica / Estado de Mi Lista, Auth y Tema ---
    const { isAuthenticated } = useAuth()
    const { filas, agregarAnime } = useMyList()
    const { acento } = useThemeAccent()
    const myListIds = useMemo(() => new Set(filas.map((f) => f.malId)), [filas])


    // --- Filtros ---
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

    // Queries auxiliares
    const { data: genresData } = useGenresQuery()
    const { data: yearsData } = useYearsQuery()
    const { data: studiosData } = useStudios()

    const genresList = genresData && genresData.length ? genresData : GENRES_DEFAULT
    const yearsList = yearsData && yearsData.length ? yearsData : [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2010, 2005, 2000]

    // Construcción de parámetros para el BFF
    const filterParams = useMemo(() => {
        return {
            page: currentPage,
            page_size: 50,
            q: submittedSearch.trim() || undefined,
            studio: studio || undefined,
            genre: genre || undefined,
            season: season || undefined,
            year: year || undefined,
            min_score: minScore || undefined,
            format: format || undefined,
            ordering: ordering || '-score',
            no_sequels: noSequels ? true : undefined,
            not_in_my_list: (isAuthenticated && notInMyList) ? true : undefined,
            exclude_ids: (isAuthenticated && notInMyList && filas.length) ? Array.from(myListIds).join(',') : undefined,
            recommended_by_friends: (isAuthenticated && recommendedByFriends) ? true : undefined,
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
        (isAuthenticated && notInMyList) ||
        (isAuthenticated && recommendedByFriends) ||
        submittedSearch
    )

    const handleQuickAdd = async (anime: ApiAnimeData, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        if (!isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        if (myListIds.has(anime.mal_id)) return
        try {
            await agregarAnime({
                id: `entry_${anime.mal_id}_${Date.now()}`,
                malId: anime.mal_id,
                estado: 'pendiente',
                nota: null,
                episodiosVistos: 0,
                favorito: false,
                carpetaId: undefined,
                tags: [],
                comentario: '',
            }, anime)
            setAddedAnimeId(anime.mal_id)
            setTimeout(() => setAddedAnimeId(null), 2500)
        } catch (err) {
            console.error('Error al agregar a Mi Lista:', err)
        }
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
                        <span>Filtros de Catálogo</span>
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

                        <div className="cat-filter-col">
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
                                placeholder="Buscar en Top Animes por título, estudio..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="cat-search-control"
                            />
                        </div>
                        <button type="submit" className="cat-btn-search">
                            Buscar
                        </button>
                    </form>

                    {/* Chips de Filtros Rápidos */}
                    <div className="d-flex flex-wrap align-items-center gap-2 mt-5 pt-2.5">
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

                        {isAuthenticated && (
                            <button
                                type="button"
                                onClick={() => {
                                    setRecommendedByFriends(!recommendedByFriends)
                                    setCurrentPage(1)
                                }}
                                className={`cat-toggle-chip ${recommendedByFriends ? 'active' : ''}`}
                            >
                                <span>Recomendadas por amigos</span>
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
                        Mostrando <strong className="text-white">{animes.length}</strong> de <strong className="text-white">{totalCount}</strong> animes clasificados
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
                        <Loader2 size={32} className="text-secondary mb-3" style={{ animation: 'spin 1s linear infinite' }} />
                        <p className="small text-secondary">Cargando 50 animes clasificados...</p>
                    </div>
                ) : isError ? (
                    <div className="p-5 text-center rounded-4" style={{ background: 'var(--cat-surface)', border: '1px dashed var(--cat-border)' }}>
                        <p className="text-danger mb-2 small">Hubo un problema al cargar los animes del catálogo.</p>
                        <button type="button" onClick={handleClearFilters} className="cat-btn-search py-1.5 px-3">
                            Restablecer Filtros
                        </button>
                    </div>
                ) : animes.length === 0 ? (
                    <div className="p-5 text-center rounded-4" style={{ background: 'var(--cat-surface)', border: '1px dashed var(--cat-border)' }}>
                        <Film size={32} className="text-secondary mb-2 opacity-50" />
                        <h3 className="h6 fw-bold text-white mb-1">No se encontraron animes con los filtros seleccionados</h3>
                        <p className="small mb-3 text-secondary">
                            Prueba relajando la nota mínima o quitando filtros rápidos.
                        </p>
                        <button type="button" onClick={handleClearFilters} className="cat-btn-search py-1.5 px-3">
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
                                        <div className="cat-rank-badge">
                                            <Award size={10} className="text-warning" />
                                            <span>#{globalRank}</span>
                                        </div>

                                        {/* Badge de Temporada */}
                                        {anime.season_display && (
                                            <div className="cat-season-badge">
                                                {anime.season_display}
                                            </div>
                                        )}

                                        {/* Badge de Score MAL */}
                                        <div className="cat-score-badge">
                                            <Star size={11} fill="currentColor" />
                                            <span>{anime.score ? Number(anime.score).toFixed(2) : 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Contenido Inferior de la Tarjeta */}
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

                                            <div className="cat-card-studio">
                                                <Building2 size={11} className="text-secondary shrink-0" />
                                                <span>{anime.studio || 'Estudio no especificado'}</span>
                                            </div>
                                        </div>

                                        {/* Chip de Recomendados por Amigos (solo para usuarios autenticados) */}
                                        {isAuthenticated && anime.recommended_by && anime.recommended_by.length > 0 && (
                                            <div
                                                className="cat-friends-recommend"
                                                title={`Recomendado por: ${getRecsText(anime.recommended_by)}`}
                                            >
                                                <Users size={11} className="shrink-0 text-secondary" />
                                                <span className="truncate">{getRecsText(anime.recommended_by)}</span>
                                            </div>
                                        )}

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
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
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
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
                        >
                            <span>Siguiente Página</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}

                {/* ---------- Modal de Detalle de Anime ---------- */}
                <Dialogo
                    abierto={selectedAnime !== null}
                    onCerrar={() => setSelectedAnime(null)}
                    etiqueta={selectedAnime ? selectedAnime.title : 'Detalle'}
                    ancho={600}
                >
                    {selectedAnime && (
                        <div className="p-4 d-flex flex-column gap-3">
                            <div className="d-flex gap-3">
                                <img
                                    src={selectedAnime.image_url}
                                    alt={selectedAnime.title}
                                    className="rounded-3 shadow"
                                    style={{ width: 90, height: 125, objectFit: 'cover' }}
                                />
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="d-flex flex-wrap gap-2 mb-1">
                                        <span className="badge rounded-pill bg-black border border-warning text-warning font-mono">
                                            ★ {selectedAnime.score ? Number(selectedAnime.score).toFixed(2) : 'N/A'} MAL
                                        </span>
                                        <span className="badge rounded-pill bg-dark text-secondary">
                                            {selectedAnime.type || 'TV'} · {selectedAnime.episodes || '?'} eps
                                        </span>
                                    </div>
                                    <h3 className="h6 fw-bold text-white mb-1 text-truncate">{selectedAnime.title}</h3>
                                    {selectedAnime.title_english && (
                                        <span className="small text-secondary d-block mb-1 text-truncate">
                                            {selectedAnime.title_english}
                                        </span>
                                    )}
                                    <div className="small font-mono text-secondary" style={{ fontSize: '0.74rem' }}>
                                        Estudio: <strong className="text-white">{selectedAnime.studio || 'N/A'}</strong> · Temporada: <strong className="text-white">{selectedAnime.season_display || 'N/A'}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Géneros */}
                            {selectedAnime.genres && selectedAnime.genres.length > 0 && (
                                <div className="d-flex flex-wrap gap-1.5">
                                    {selectedAnime.genres.map((g) => (
                                        <span key={g} className="badge bg-black border border-dark text-secondary">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Sinopsis */}
                            <div>
                                <span className="cat-filter-label">SINOPSIS</span>
                                <p className="small mb-0 text-secondary" style={{ lineHeight: 1.6, maxHeight: '110px', overflowY: 'auto' }}>
                                    {selectedAnime.synopsis || 'Sin sinopsis disponible actualmente.'}
                                </p>
                            </div>

                            {/* Evolución Histórica de la Nota (2018-2026 + Mensual) */}
                            <AnimeScoreHistoryChart malId={selectedAnime.mal_id} title={selectedAnime.title} />

                            {/* Recomendado por amigos (solo usuarios autenticados) */}
                            {isAuthenticated && selectedAnime.recommended_by && selectedAnime.recommended_by.length > 0 && (
                                <div className="p-2.5 rounded-2 d-flex align-items-center gap-2" style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}>
                                    <Sparkles size={15} className="text-warning shrink-0" />
                                    <span className="small text-secondary" style={{ fontSize: '0.76rem' }}>
                                        Recomendado por: <strong className="text-white">{getRecsText(selectedAnime.recommended_by)}</strong>
                                    </span>
                                </div>
                            )}

                            {/* Acciones */}
                            <div className="d-flex justify-content-end gap-2 pt-2 border-top border-dark">
                                <button
                                    type="button"
                                    onClick={() => setSelectedAnime(null)}
                                    className="cat-mode-pill-btn"
                                    style={{ border: '1px solid var(--cat-border)' }}
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickAdd(selectedAnime)}
                                    disabled={myListIds.has(selectedAnime.mal_id)}
                                    className="cat-btn-search py-1.5 px-3"
                                >
                                    {myListIds.has(selectedAnime.mal_id) ? (
                                        <>
                                            <Check size={13} className="me-1" />
                                            <span>En Mi Lista</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={13} className="me-1" />
                                            <span>Añadir a Mi Lista</span>
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
