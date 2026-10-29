import React, { useState, useMemo } from 'react'
import {
    ArrowLeft,
    Star,
    Award,
    Users,
    Building2,
    Calendar,
    Tv,
    Clock,
    Heart,
    Plus,
    Check,
    Sparkles,
    Tag,
    TrendingUp,
    Eye,
    EyeOff,
    Info,
    Loader2,
} from 'lucide-react'
import { useAnimeDetailQuery, useAnimeRecommendations } from '../../hooks/useCatalog'
import { useMyList } from '../../hooks/useMyList'
import { useAuth } from '../../context/AuthContext'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import type { ApiAnimeData, EstadoLista } from '../../services/userListApi'
import { ESCALA_NOTAS } from '../mi-lista/mi-lista-data'
import { getTagDescription } from '../../shared/tagDescriptions'
import { AnimeScoreHistoryChart } from './AnimeScoreHistoryChart'
import './catalogo.css'

interface AnimeProfileViewProps {
    malId: number
    initialAnime?: ApiAnimeData | null
    onBack?: () => void
    onSelectAnime?: (malId: number, anime?: ApiAnimeData) => void
    onFilterByGenreOrTag?: (term: string, isTag?: boolean) => void
    onFilterByStudio?: (studio: string) => void
}

export const AnimeProfileView: React.FC<AnimeProfileViewProps> = ({
    malId,
    initialAnime = null,
    onBack,
    onSelectAnime,
    onFilterByGenreOrTag,
    onFilterByStudio,
}) => {
    const { isAuthenticated } = useAuth()
    const { acento } = useThemeAccent()
    const { filas, agregarAnime, actualizar } = useMyList()

    const { data: fetchedAnime, isLoading } = useAnimeDetailQuery(malId)
    const { data: recommendations = [], isLoading: loadingRecs } = useAnimeRecommendations(malId)

    const anime = fetchedAnime || initialAnime

    const [activeTab, setActiveTab] = useState<'details' | 'stats' | 'recommendations'>('details')
    const [showSpoilers, setShowSpoilers] = useState(false)
    const [hoveredTag, setHoveredTag] = useState<string | null>(null)
    const [savingList, setSavingList] = useState(false)

    // Entrada actual del usuario en Mi Lista (si ya lo tiene agregado)
    const myEntry = useMemo(
        () => filas.find((f) => f.malId === malId) || null,
        [filas, malId]
    )

    const { mainTags, secondaryTags, spoilerCount } = useMemo(() => {
        const raw = anime?.tags_data || []
        let spoilers = 0
        const visible = raw.filter((t) => {
            if (!t?.name) return false
            if (t.spoiler) {
                spoilers += 1
                return showSpoilers
            }
            return true
        })

        const sorted = [...visible].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
        return {
            mainTags: sorted.filter((t) => (t.rank ?? 0) >= 72),
            secondaryTags: sorted.filter((t) => (t.rank ?? 0) < 72),
            spoilerCount: spoilers,
        }
    }, [anime?.tags_data, showSpoilers])

    const handleAddToMyList = async (initialStatus: EstadoLista = 'pendiente') => {
        if (!anime) return
        if (!isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        setSavingList(true)
        try {
            await agregarAnime(
                {
                    id: `entry_${anime.mal_id}_${Date.now()}`,
                    malId: anime.mal_id,
                    estado: initialStatus,
                    nota: null,
                    episodiosVistos: initialStatus === 'visto' ? anime.episodes || 0 : 0,
                    favorito: false,
                    tags: [],
                    comentario: '',
                },
                anime
            )
        } finally {
            setSavingList(false)
        }
    }

    const handleUpdateStatus = (newStatus: EstadoLista) => {
        if (!myEntry || !anime) return
        const changes: Partial<{ estado: EstadoLista; episodiosVistos: number }> = {
            estado: newStatus,
        }
        if (newStatus === 'visto' && anime.episodes) {
            changes.episodiosVistos = anime.episodes
        }
        actualizar(malId, changes)
    }

    const handleUpdateScore = (newScoreStr: string) => {
        if (!myEntry) return
        const scoreVal = newScoreStr === '' ? null : Number(newScoreStr)
        actualizar(malId, { nota: scoreVal })
    }

    const handleIncrementEpisodes = () => {
        if (!myEntry) return
        const maxEps = anime?.episodes || 9999
        const nextEps = Math.min(maxEps, (myEntry.episodiosVistos || 0) + 1)
        const nextStatus: EstadoLista =
            anime?.episodes && nextEps >= anime.episodes ? 'visto' : myEntry.estado
        actualizar(malId, { episodiosVistos: nextEps, estado: nextStatus })
    }

    const handleToggleFavorite = () => {
        if (!myEntry) return
        actualizar(malId, { favorito: !myEntry.favorito })
    }

    if (isLoading && !anime) {
        return (
            <section className="cat-root py-5 px-3">
                <div className="container text-center py-5" style={{ maxWidth: '1240px' }}>
                    <Loader2
                        size={34}
                        className="text-secondary mb-3"
                        style={{ animation: 'spin 1s linear infinite' }}
                    />
                    <div className="text-white fw-semibold">Cargando perfil del anime...</div>
                </div>
            </section>
        )
    }

    if (!anime) {
        return (
            <section className="cat-root py-5 px-3">
                <div className="container text-center py-5" style={{ maxWidth: '1240px' }}>
                    <h3 className="h5 text-white fw-bold mb-2">No se encontró el anime solicitado</h3>
                    <button
                        type="button"
                        className="cat-btn-search py-2 px-4 mt-2"
                        onClick={() => (onBack ? onBack() : (window.location.hash = '#catalogo'))}
                    >
                        Volver al Catálogo
                    </button>
                </div>
            </section>
        )
    }

    const scoreNum = anime.score ? Number(anime.score) : null

    return (
        <section
            className="cat-root py-4 px-3 px-md-4"
            style={{ '--cat-acento': acento, '--ml-acento': acento } as React.CSSProperties}
        >
            <div className="container" style={{ maxWidth: '1240px' }}>
                {/* Barra de navegación superior */}
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <button
                        type="button"
                        onClick={() => (onBack ? onBack() : (window.location.hash = '#catalogo'))}
                        className="anime-profile-back-btn"
                    >
                        <ArrowLeft size={15} />
                        <span>Volver al Catálogo</span>
                    </button>

                    <div className="small text-secondary font-mono" style={{ fontSize: '0.75rem' }}>
                        Catálogo &rsaquo; Anime &rsaquo; <span className="text-white">{anime.title}</span>
                    </div>
                </div>

                {/* Cabecera Hero tipo Perfil con Banner sutil */}
                <div className="anime-profile-hero mb-4">
                    <div
                        className="anime-profile-hero-bg"
                        style={{
                            backgroundImage: `url(${anime.banner_url || anime.image_url})`,
                        }}
                    />
                    <div className="anime-profile-hero-overlay" />

                    <div className="anime-profile-hero-content">
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <span className="anime-profile-format-pill">{anime.type || 'TV'}</span>
                            {anime.season_display && (
                                <span className="anime-profile-season-pill">
                                    <Calendar size={12} /> {anime.season_display}
                                </span>
                            )}
                            {anime.studio && (
                                <button
                                    type="button"
                                    className="anime-profile-studio-pill"
                                    onClick={() => onFilterByStudio?.(anime.studio!)}
                                >
                                    <Building2 size={12} /> {anime.studio}
                                </button>
                            )}
                        </div>
                        <h1 className="anime-profile-main-title">{anime.title}</h1>
                        {(anime.title_english || anime.title_japanese) && (
                            <div className="anime-profile-subtitles">
                                {anime.title_english && anime.title_english !== anime.title && (
                                    <span>{anime.title_english}</span>
                                )}
                                {anime.title_japanese && (
                                    <span className="opacity-75">{anime.title_japanese}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Layout de 2 Columnas (Estilo Ficha Perfil MAL / AniList) */}
                <div className="anime-profile-grid">
                    {/* ================= COLUMNA IZQUIERDA (SIDEBAR) ================= */}
                    <aside className="anime-profile-sidebar">
                        {/* 1. Póster Oficial */}
                        <div className="anime-profile-poster-card">
                            <img
                                src={anime.image_url}
                                alt={anime.title}
                                className="anime-profile-poster-img"
                            />
                        </div>

                        {/* 2. Panel de Estado en Mi Lista (Edit Status) */}
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title">Mi Lista</div>

                            {!myEntry ? (
                                <div className="d-flex flex-column gap-2">
                                    <button
                                        type="button"
                                        disabled={savingList}
                                        onClick={() => handleAddToMyList('pendiente')}
                                        className="cat-btn-search w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                    >
                                        <Plus size={15} />
                                        <span>{savingList ? 'Guardando...' : 'Añadir a Mi Lista'}</span>
                                    </button>
                                    <div className="d-grid grid-cols-2 gap-1.5" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                                        <button
                                            type="button"
                                            disabled={savingList}
                                            onClick={() => handleAddToMyList('viendo')}
                                            className="anime-profile-mini-btn"
                                        >
                                            Marcar Viendo
                                        </button>
                                        <button
                                            type="button"
                                            disabled={savingList}
                                            onClick={() => handleAddToMyList('visto')}
                                            className="anime-profile-mini-btn"
                                        >
                                            Marcar Visto
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2.5">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="anime-profile-field-label">Estado:</span>
                                        <select
                                            className="cat-select py-1 px-2"
                                            style={{ width: '145px', fontSize: '0.78rem' }}
                                            value={myEntry.estado}
                                            onChange={(e) => handleUpdateStatus(e.target.value as EstadoLista)}
                                        >
                                            <option value="viendo">🟢 Viendo</option>
                                            <option value="visto">🔵 Completado</option>
                                            <option value="pendiente">⚪ Pendiente</option>
                                            <option value="dropeado">🔴 Dropeado</option>
                                        </select>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="anime-profile-field-label">Episodios:</span>
                                        <div className="d-flex align-items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={anime.episodes || 9999}
                                                value={myEntry.episodiosVistos}
                                                onChange={(e) =>
                                                    actualizar(malId, {
                                                        episodiosVistos: Math.max(0, Number(e.target.value) || 0),
                                                    })
                                                }
                                                className="cat-select text-center py-1 px-1"
                                                style={{ width: '58px', fontSize: '0.78rem' }}
                                            />
                                            <span className="small text-secondary font-mono">
                                                / {anime.episodes || '?'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleIncrementEpisodes}
                                                className="anime-profile-ep-plus"
                                                title="Sumar 1 episodio visto"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="anime-profile-field-label">Tu Nota:</span>
                                        <select
                                            className="cat-select py-1 px-2"
                                            style={{ width: '145px', fontSize: '0.78rem' }}
                                            value={myEntry.nota ?? ''}
                                            onChange={(e) => handleUpdateScore(e.target.value)}
                                        >
                                            <option value="">Sin calificar</option>
                                            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                                                <option key={n} value={n}>
                                                    ({n}) {ESCALA_NOTAS[n]}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleToggleFavorite}
                                        className={`anime-profile-fav-btn ${myEntry.favorito ? 'active' : ''}`}
                                    >
                                        <Heart
                                            size={14}
                                            fill={myEntry.favorito ? '#f43f5e' : 'none'}
                                            color={myEntry.favorito ? '#f43f5e' : 'currentColor'}
                                        />
                                        <span>
                                            {myEntry.favorito ? 'En tus Animes Favoritos' : 'Añadir a Favoritos'}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 3. Títulos Alternativos */}
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title">Títulos Alternativos</div>
                            <div className="anime-profile-info-list">
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Inglés:</span>
                                    <span className="anime-profile-info-val">
                                        {anime.title_english || anime.title}
                                    </span>
                                </div>
                                {anime.title_japanese && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Japonés:</span>
                                        <span className="anime-profile-info-val">{anime.title_japanese}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Ficha de Información (Information) */}
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title">Información</div>
                            <div className="anime-profile-info-list">
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Formato:</span>
                                    <span className="anime-profile-info-val">{anime.type || 'TV'}</span>
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Episodios:</span>
                                    <span className="anime-profile-info-val">{anime.episodes || 'Desconocido'}</span>
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Estado:</span>
                                    <span className="anime-profile-info-val">{anime.status || 'FINISHED'}</span>
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Estreno:</span>
                                    <span className="anime-profile-info-val">
                                        {anime.season_display || anime.season_year || 'N/A'}
                                    </span>
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Estudio:</span>
                                    {anime.studio ? (
                                        <button
                                            type="button"
                                            className="anime-profile-inline-link"
                                            onClick={() => onFilterByStudio?.(anime.studio!)}
                                        >
                                            {anime.studio}
                                        </button>
                                    ) : (
                                        <span className="anime-profile-info-val">No especificado</span>
                                    )}
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Duración:</span>
                                    <span className="anime-profile-info-val">
                                        {anime.duration ? `${Math.round(Number(anime.duration))} min. por ep.` : '24 min. por ep.'}
                                    </span>
                                </div>
                                {anime.genres && anime.genres.length > 0 && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Géneros:</span>
                                        <span className="anime-profile-info-val d-inline-flex flex-wrap gap-1">
                                            {anime.genres.map((g, i) => (
                                                <React.Fragment key={g}>
                                                    <button
                                                        type="button"
                                                        className="anime-profile-inline-link"
                                                        onClick={() => onFilterByGenreOrTag?.(g, false)}
                                                    >
                                                        {g}
                                                    </button>
                                                    {i < anime.genres.length - 1 && (
                                                        <span className="text-secondary">,</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. Estadísticas Oficiales (Statistics) */}
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title">Estadísticas</div>
                            <div className="anime-profile-info-list">
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Puntuación:</span>
                                    <span className="anime-profile-info-val">
                                        <strong className="text-warning">
                                            ★ {scoreNum ? scoreNum.toFixed(2) : 'N/A'}
                                        </strong>{' '}
                                        <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                                            ({(anime.scored_by || 0).toLocaleString()} votos)
                                        </span>
                                    </span>
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Ranking:</span>
                                    <span className="anime-profile-info-val">
                                        {anime.rank ? `#${anime.rank}` : 'N/A'}
                                    </span>
                                </div>
                                <div className="anime-profile-info-row">
                                    <span className="anime-profile-info-key">Popularidad:</span>
                                    <span className="anime-profile-info-val">
                                        {anime.popularity ? `#${anime.popularity}` : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* ================= COLUMNA DERECHA (MAIN CONTENT) ================= */}
                    <div className="anime-profile-main">
                        {/* Barra de Métricas Destacadas estilo MyAnimeList */}
                        <div className="anime-profile-score-banner mb-3">
                            <div className="anime-profile-score-box">
                                <span className="anime-profile-score-label">SCORE</span>
                                <span className="anime-profile-score-number">
                                    {scoreNum ? scoreNum.toFixed(2) : 'N/A'}
                                </span>
                                <span className="anime-profile-score-users">
                                    {(anime.scored_by || 0).toLocaleString()} usuarios
                                </span>
                            </div>

                            <div className="anime-profile-score-divider" />

                            <div className="anime-profile-metrics-strip">
                                <div className="d-flex flex-wrap align-items-center gap-4">
                                    <div className="anime-profile-metric-item">
                                        <span className="text-secondary">Ranked</span>{' '}
                                        <strong className="text-white">
                                            #{anime.rank || '—'}
                                        </strong>
                                    </div>
                                    <div className="anime-profile-metric-item">
                                        <span className="text-secondary">Popularity</span>{' '}
                                        <strong className="text-white">
                                            #{anime.popularity || '—'}
                                        </strong>
                                    </div>
                                    <div className="anime-profile-metric-item">
                                        <span className="text-secondary">Members</span>{' '}
                                        <strong className="text-white">
                                            {(anime.scored_by || 0).toLocaleString()}
                                        </strong>
                                    </div>
                                </div>

                                <div className="anime-profile-submeta-links">
                                    {anime.season_display && <span>{anime.season_display}</span>}
                                    <span>{anime.type || 'TV'}</span>
                                    {anime.studio && (
                                        <button
                                            type="button"
                                            className="anime-profile-inline-link"
                                            onClick={() => onFilterByStudio?.(anime.studio!)}
                                        >
                                            {anime.studio}
                                        </button>
                                    )}
                                    {anime.episodes && <span>{anime.episodes} episodios</span>}
                                </div>
                            </div>
                        </div>

                        {/* Pestañas de navegación del perfil del anime */}
                        <div className="anime-profile-tabs mb-3">
                            <button
                                type="button"
                                className={`anime-profile-tab ${activeTab === 'details' ? 'active' : ''}`}
                                onClick={() => setActiveTab('details')}
                            >
                                Detalles & Taxonomía
                            </button>
                            <button
                                type="button"
                                className={`anime-profile-tab ${activeTab === 'stats' ? 'active' : ''}`}
                                onClick={() => setActiveTab('stats')}
                            >
                                <TrendingUp size={14} /> Evolución Histórica
                            </button>
                            <button
                                type="button"
                                className={`anime-profile-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
                                onClick={() => setActiveTab('recommendations')}
                            >
                                <Sparkles size={14} /> Recomendaciones ({recommendations.length})
                            </button>
                        </div>

                        {activeTab === 'details' && (
                            <div className="d-flex flex-column gap-3">
                                {/* Sinopsis completa */}
                                <div className="anime-profile-section-card">
                                    <h3 className="anime-profile-section-heading">Sinopsis</h3>
                                    <p className="anime-profile-synopsis">
                                        {anime.synopsis || 'Sin sinopsis disponible para este título.'}
                                    </p>
                                </div>

                                {/* Géneros y Taxonomía de Media Tags de AniList (Main Tags & Secondary Tags) */}
                                <div className="anime-profile-section-card">
                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                        <div>
                                            <h3 className="anime-profile-section-heading mb-0 border-0 pb-0">
                                                Taxonomía de AniList & Géneros
                                            </h3>
                                            <p className="small text-secondary mb-0" style={{ fontSize: '0.76rem' }}>
                                                Haz clic en cualquier etiqueta para buscar animes con esa categoría en el catálogo, o pasa el cursor sobre <strong>i</strong> para ver su definición.
                                            </p>
                                        </div>

                                        {spoilerCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowSpoilers((prev) => !prev)}
                                                className="anime-profile-spoiler-btn"
                                            >
                                                {showSpoilers ? <EyeOff size={13} /> : <Eye size={13} />}
                                                <span>
                                                    {showSpoilers
                                                        ? 'Ocultar tags con spoiler'
                                                        : `Mostrar ${spoilerCount} tags de trama`}
                                                </span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Géneros Clásicos */}
                                    {anime.genres && anime.genres.length > 0 && (
                                        <div className="mb-3">
                                            <div className="anime-profile-tag-group-title">Géneros:</div>
                                            <div className="d-flex flex-wrap gap-2">
                                                {anime.genres.map((g) => (
                                                    <div key={g} className="position-relative d-inline-flex">
                                                        <button
                                                            type="button"
                                                            className="anime-profile-tag-chip genre"
                                                            onClick={() => onFilterByGenreOrTag?.(g, false)}
                                                        >
                                                            <span>{g}</span>
                                                            <span
                                                                className="anime-profile-tag-info-dot"
                                                                onMouseEnter={(e) => {
                                                                    e.stopPropagation()
                                                                    setHoveredTag(`genre_${g}`)
                                                                }}
                                                                onMouseLeave={() => setHoveredTag(null)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                i
                                                            </span>
                                                        </button>
                                                        {hoveredTag === `genre_${g}` && (
                                                            <div className="rec-tag-info-popover rec-tag-info-popover-tax">
                                                                <div className="rec-tag-info-popover-title">{g}</div>
                                                                <p className="rec-tag-info-popover-desc mb-0">
                                                                    {getTagDescription(g, 'Genre', true)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Main Tags (Relevancia >= 72%) */}
                                    {mainTags.length > 0 && (
                                        <div className="mb-3">
                                            <div className="anime-profile-tag-group-title">
                                                Main Tags (Relevancia &ge; 72%):
                                            </div>
                                            <div className="d-flex flex-wrap gap-2">
                                                {mainTags.map((t) => (
                                                    <div key={t.name} className="position-relative d-inline-flex">
                                                        <button
                                                            type="button"
                                                            className="anime-profile-tag-chip main"
                                                            onClick={() => onFilterByGenreOrTag?.(t.name, true)}
                                                        >
                                                            <Tag size={11} className="opacity-75" />
                                                            <span>{t.name}</span>
                                                            {t.rank && (
                                                                <span className="anime-profile-tag-rank">
                                                                    {t.rank}%
                                                                </span>
                                                            )}
                                                            <span
                                                                className="anime-profile-tag-info-dot"
                                                                onMouseEnter={(e) => {
                                                                    e.stopPropagation()
                                                                    setHoveredTag(`main_${t.name}`)
                                                                }}
                                                                onMouseLeave={() => setHoveredTag(null)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                i
                                                            </span>
                                                        </button>
                                                        {hoveredTag === `main_${t.name}` && (
                                                            <div className="rec-tag-info-popover rec-tag-info-popover-tax">
                                                                <div className="rec-tag-info-popover-title">
                                                                    {t.name} ({t.rank ?? 80}%)
                                                                </div>
                                                                <p className="rec-tag-info-popover-desc mb-0">
                                                                    {getTagDescription(t.name, t.category, true)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Secondary Tags (Relevancia < 72%) */}
                                    {secondaryTags.length > 0 && (
                                        <div>
                                            <div className="anime-profile-tag-group-title">
                                                Secondary Tags:
                                            </div>
                                            <div className="d-flex flex-wrap gap-2">
                                                {secondaryTags.map((t) => (
                                                    <div key={t.name} className="position-relative d-inline-flex">
                                                        <button
                                                            type="button"
                                                            className="anime-profile-tag-chip secondary"
                                                            onClick={() => onFilterByGenreOrTag?.(t.name, true)}
                                                        >
                                                            <span>{t.name}</span>
                                                            {t.rank && (
                                                                <span className="anime-profile-tag-rank">
                                                                    {t.rank}%
                                                                </span>
                                                            )}
                                                            <span
                                                                className="anime-profile-tag-info-dot"
                                                                onMouseEnter={(e) => {
                                                                    e.stopPropagation()
                                                                    setHoveredTag(`sec_${t.name}`)
                                                                }}
                                                                onMouseLeave={() => setHoveredTag(null)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                i
                                                            </span>
                                                        </button>
                                                        {hoveredTag === `sec_${t.name}` && (
                                                            <div className="rec-tag-info-popover rec-tag-info-popover-tax">
                                                                <div className="rec-tag-info-popover-title">
                                                                    {t.name} ({t.rank ?? 60}%)
                                                                </div>
                                                                <p className="rec-tag-info-popover-desc mb-0">
                                                                    {getTagDescription(t.name, t.category, false)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Evolución Histórica integrada también en la vista principal */}
                                <div className="anime-profile-section-card">
                                    <h3 className="anime-profile-section-heading">
                                        Evolución Histórica de Puntuación (2018–2026)
                                    </h3>
                                    <AnimeScoreHistoryChart malId={anime.mal_id} title={anime.title} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="anime-profile-section-card">
                                <h3 className="anime-profile-section-heading">
                                    Histórico de Calificaciones y Tendencia en MyAnimeList
                                </h3>
                                <AnimeScoreHistoryChart malId={anime.mal_id} title={anime.title} />
                            </div>
                        )}

                        {activeTab === 'recommendations' && (
                            <div className="anime-profile-section-card">
                                <h3 className="anime-profile-section-heading">
                                    Animes Recomendados si te gustó {anime.title}
                                </h3>
                                {loadingRecs ? (
                                    <div className="text-center py-4">
                                        <Loader2
                                            size={24}
                                            className="text-secondary"
                                            style={{ animation: 'spin 1s linear infinite' }}
                                        />
                                    </div>
                                ) : recommendations.length === 0 ? (
                                    <div className="small text-secondary py-3">
                                        No hay recomendaciones cruzadas registradas para este anime aún.
                                    </div>
                                ) : (
                                    <div className="anime-profile-recs-grid">
                                        {recommendations.map((rec) => {
                                            const tgt = rec.target
                                            if (!tgt) return null
                                            return (
                                                <div
                                                    key={tgt.mal_id}
                                                    className="anime-profile-rec-card"
                                                    onClick={() => {
                                                        if (onSelectAnime) {
                                                            onSelectAnime(tgt.mal_id, tgt)
                                                        } else {
                                                            window.location.hash = `#anime/${tgt.mal_id}`
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                >
                                                    <img
                                                        src={tgt.image_url}
                                                        alt={tgt.title}
                                                        className="anime-profile-rec-img"
                                                    />
                                                    <div className="p-2">
                                                        <div className="small fw-bold text-white text-truncate">
                                                            {tgt.title}
                                                        </div>
                                                        <div
                                                            className="small text-secondary d-flex align-items-center justify-content-between mt-1"
                                                            style={{ fontSize: '0.72rem' }}
                                                        >
                                                            <span className="text-warning">
                                                                ★ {tgt.score ? Number(tgt.score).toFixed(2) : 'N/A'}
                                                            </span>
                                                            <span>{rec.strength} votos</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

