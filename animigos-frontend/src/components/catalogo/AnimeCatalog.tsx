import React, { useState, useMemo, useEffect } from 'react'
import {
    Star,
    Check,
    Plus,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Film,
    Building2,
    Award,
} from 'lucide-react'
import { useCatalogQuery } from '../../hooks/useCatalog'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { useCatalogFilters } from '../../hooks/useCatalogFilters'
import { useAuth } from '../../context/AuthContext'
import type { ApiAnimeData } from '../../services/userListApi'
import { AnimeProfileView } from './AnimeProfileView'
import './catalogo.css'

interface AnimeCatalogProps {
    initialAnimeId?: number | null
}

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

    const [addedAnimeId, setAddedAnimeId] = useState<number | null>(null)
    const { filters, setFilters, clearFilters } = useCatalogFilters()

    // Construcción de parámetros para el BFF
    const filterParams = useMemo(() => {
        return {
            page: filters.currentPage,
            page_size: 50,
            q: filters.submittedSearch.trim() || undefined,
            studio: filters.studio || undefined,
            tags: filters.selectedTerms.length > 0 ? filters.selectedTerms.join(',') : undefined,
            season: filters.season || undefined,
            year: filters.year || undefined,
            min_score: filters.minScore || undefined,
            format: filters.format || undefined,
            ordering: filters.ordering || '-score',
            no_sequels: filters.noSequels ? true : undefined,
            not_in_my_list: isAuthenticated && filters.notInMyList ? true : undefined,
            exclude_ids:
                isAuthenticated && filters.notInMyList && filas.length
                    ? Array.from(myListIds).join(',')
                    : undefined,
        }
    }, [
        filters,
        filas.length,
        myListIds,
        isAuthenticated,
    ])

    const { data: catalogData, isLoading, isFetching, isError } = useCatalogQuery(filterParams)

    const animes = catalogData?.results || []
    const totalCount = catalogData?.count || 0
    const totalPages = Math.max(1, Math.ceil(totalCount / 50))

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
                    setFilters((current) => ({ ...current, selectedTerms: [term], currentPage: 1 }))
                    handleCloseAnimeProfile()
                }}
                onFilterByStudio={(st) => {
                    setFilters((current) => ({ ...current, studio: st, currentPage: 1 }))
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
                                disabled={filters.currentPage <= 1 || isFetching}
                                onClick={() => setFilters((current) => ({ ...current, currentPage: Math.max(1, current.currentPage - 1) }))}
                                className="cat-nav-btn"
                                title="Página anterior"
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <span className="small font-mono text-white">
                                {filters.currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={filters.currentPage >= totalPages || isFetching}
                                onClick={() => setFilters((current) => ({ ...current, currentPage: Math.min(totalPages, current.currentPage + 1) }))}
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
                            onClick={clearFilters}
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
                            onClick={clearFilters}
                            className="cat-btn-search py-1.5 px-3"
                        >
                            Limpiar todos los filtros
                        </button>
                    </div>
                ) : (
                    <div className="cat-grid">
                        {animes.map((anime, index) => {
                            const globalRank = (filters.currentPage - 1) * 50 + index + 1
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
                            disabled={filters.currentPage <= 1 || isFetching}
                            onClick={() => {
                                setFilters((current) => ({ ...current, currentPage: Math.max(1, current.currentPage - 1) }))
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
                                {filters.currentPage}
                            </span>
                            <span className="small text-secondary">de {totalPages}</span>
                        </div>

                        <button
                            type="button"
                            disabled={filters.currentPage >= totalPages || isFetching}
                            onClick={() => {
                                setFilters((current) => ({ ...current, currentPage: Math.min(totalPages, current.currentPage + 1) }))
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
