import React, { useState, useMemo, useEffect } from 'react'
import { navigate } from '../../utils/navigation'
import {
    ArrowLeft,
    Building2,
    Calendar,
    Heart,
    Plus,
    Sparkles,
    Tag,
    TrendingUp,
    Eye,
    EyeOff,
    Loader2,
    Trash2,
    Play,
    ExternalLink,
    Bell,
    GitFork,
    Users,
} from 'lucide-react'
import {
    useAnimeDetailQuery,
    useAnimeRecommendations,
    useAnimeRelationsQuery,
    useAnimeCharactersStreamingQuery,
} from '../../hooks/useCatalog'
import type { AnimeCharacterItem } from '../../services/catalogApi'
import { AnimeCharacterView } from './AnimeCharacterView'
import { useMyList } from '../../hooks/useMyList'
import { useAuth } from '../../context/AuthContext'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { useAssociatedLinks } from '../../hooks/useAssociatedLinks'
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
    backLabel?: string
}

export const AnimeProfileView: React.FC<AnimeProfileViewProps> = ({
    malId,
    initialAnime = null,
    onBack,
    onSelectAnime,
    onFilterByGenreOrTag,
    onFilterByStudio,
    backLabel,
}) => {
    const { isAuthenticated } = useAuth()
    const { acento } = useThemeAccent()
    const { filas, agregarAnime, actualizar, quitar } = useMyList()
    const { openAnimeLink, isEnabled: isLinksEnabled } = useAssociatedLinks()

    const { data: fetchedAnime, isLoading } = useAnimeDetailQuery(malId)
    const { data: recommendations = [], isLoading: loadingRecs } = useAnimeRecommendations(malId)
    const { data: fetchedRelations = [], isLoading: loadingRelations } = useAnimeRelationsQuery(malId)
    const { data: charsStreamingData, isLoading: loadingCharsStreaming } = useAnimeCharactersStreamingQuery(malId)

    const anime = fetchedAnime || initialAnime
    const characters = charsStreamingData?.characters || []
    const streamingPlatforms = charsStreamingData?.streaming || []

    const relations = useMemo(() => {
        if (fetchedRelations && fetchedRelations.length > 0) return fetchedRelations
        if (anime?.relations_data && anime.relations_data.length > 0) return anime.relations_data
        return []
    }, [fetchedRelations, anime?.relations_data])

    const [activeTab, setActiveTab] = useState<'details' | 'characters' | 'stats' | 'recommendations'>('details')
    const [selectedCharacter, setSelectedCharacter] = useState<AnimeCharacterItem | null>(null)

    useEffect(() => {
        setSelectedCharacter(null)
    }, [malId])
    const [showSpoilers, setShowSpoilers] = useState(false)
    const [hoveredTag, setHoveredTag] = useState<string | null>(null)
    const [savingList, setSavingList] = useState(false)

    // Entrada actual del usuario en Mi Lista (si ya lo tiene agregado)
    const myEntry = useMemo(
        () => filas.find((f) => Number(f.malId) === Number(malId)) || null,
        [filas, malId]
    )

    const [localEp, setLocalEp] = useState<string>('0')

    useEffect(() => {
        if (myEntry) {
            setLocalEp(String(myEntry.episodiosVistos ?? 0))
        }
    }, [myEntry?.episodiosVistos])

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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al agregar anime a Mi Lista'
            if (msg.includes('iniciar sesión') || msg.includes('credenciales') || !isAuthenticated) {
                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                dialog?.showModal()
            }
            console.error('Error al agregar anime a Mi Lista:', err)
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
        actualizar(malId, changes).catch((err) => {
            console.error('Error al actualizar estado:', err)
        })
    }

    const handleUpdateScore = (newScoreStr: string) => {
        if (!myEntry) return
        const scoreVal = newScoreStr === '' ? null : Number(newScoreStr)
        actualizar(malId, { nota: scoreVal }).catch((err) => {
            console.error('Error al actualizar nota:', err)
        })
    }

    const handleDecrementEpisodes = () => {
        if (!myEntry) return
        const prevEps = Math.max(0, (myEntry.episodiosVistos || 0) - 1)
        actualizar(Number(malId), { episodiosVistos: prevEps }).catch((err) => {
            console.error('Error al decrementar episodios:', err)
        })
    }

    const handleIncrementEpisodes = () => {
        if (!myEntry) return
        const maxEps = anime?.episodes || 9999
        const nextEps = Math.min(maxEps, (myEntry.episodiosVistos || 0) + 1)
        const nextStatus: EstadoLista =
            anime?.episodes && nextEps >= anime.episodes ? 'visto' : myEntry.estado === 'pendiente' ? 'viendo' : myEntry.estado
        actualizar(Number(malId), { episodiosVistos: nextEps, estado: nextStatus }).catch((err) => {
            console.error('Error al incrementar episodios:', err)
        })
    }

    const handleCommitEpisodes = () => {
        if (!myEntry) return
        const num = Math.max(0, parseInt(localEp, 10) || 0)
        const maxEps = anime?.episodes || 9999
        const finalVal = Math.min(maxEps, num)
        setLocalEp(String(finalVal))
        const nextStatus: EstadoLista =
            anime?.episodes && finalVal >= anime.episodes ? 'visto' : myEntry.estado === 'pendiente' && finalVal > 0 ? 'viendo' : myEntry.estado
        actualizar(Number(malId), { episodiosVistos: finalVal, estado: nextStatus }).catch((err) => {
            console.error('Error al guardar episodios:', err)
        })
    }

    const handleToggleFavorite = () => {
        if (!myEntry) return
        actualizar(malId, { favorito: !myEntry.favorito }).catch((err) => {
            console.error('Error al alternar favorito:', err)
        })
    }

    const handleRemoveFromMyList = async () => {
        if (!myEntry) return
        setSavingList(true)
        try {
            await quitar(Number(malId))
        } finally {
            setSavingList(false)
        }
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
                        onClick={() => (onBack ? onBack() : navigate('/catalogo'))}
                    >
                        {backLabel || 'Volver al Catálogo'}
                    </button>
                </div>
            </section>
        )
    }

    const scoreNum = anime.score ? Number(anime.score) : null

    if (selectedCharacter) {
        return (
            <section
                className="cat-root py-4 px-3 px-md-4"
                style={{ '--cat-acento': acento, '--ml-acento': acento } as React.CSSProperties}
            >
                <div className="container" style={{ maxWidth: '1240px' }}>
                    <AnimeCharacterView
                        malId={anime.mal_id}
                        animeTitle={anime.title}
                        initialCharacter={selectedCharacter}
                        onBack={() => {
                            setSelectedCharacter(null)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        onSelectAnime={(nextMalId) => {
                            setSelectedCharacter(null)
                            if (onSelectAnime) {
                                onSelectAnime(nextMalId)
                            } else {
                                navigate(`/anime/${nextMalId}`)
                            }
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                    />
                </div>
            </section>
        )
    }

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
                        onClick={() => (onBack ? onBack() : navigate('/catalogo'))}
                        className="anime-profile-back-btn"
                    >
                        <ArrowLeft size={15} />
                        <span>{backLabel || 'Volver al Catálogo'}</span>
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
                                    {anime.status === 'NOT_YET_RELEASED' || (anime.release_date && new Date(anime.release_date) > new Date()) ? (
                                        <button
                                            type="button"
                                            disabled={savingList}
                                            onClick={() => handleAddToMyList('esperando')}
                                            className="cat-btn-search w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(167, 139, 250, 0.2))',
                                                borderColor: 'var(--ml-esperando, #38bdf8)',
                                                color: '#38bdf8',
                                                fontWeight: 700,
                                            }}
                                        >
                                            <Bell size={15} />
                                            <span>{savingList ? 'Guardando...' : 'Esperando su estreno'}</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={savingList}
                                            onClick={() => handleAddToMyList('pendiente')}
                                            className="cat-btn-search w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                        >
                                            <Plus size={15} />
                                            <span>{savingList ? 'Guardando...' : 'Añadir a Mi Lista'}</span>
                                        </button>
                                    )}
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
                                            onClick={() => handleAddToMyList(anime.status === 'NOT_YET_RELEASED' ? 'pendiente' : 'esperando')}
                                            className="anime-profile-mini-btn"
                                        >
                                            {anime.status === 'NOT_YET_RELEASED' ? 'Marcar Pendiente' : 'Esperando Estreno'}
                                        </button>
                                    </div>

                                    {isLinksEnabled && (
                                        <button
                                            type="button"
                                            onClick={(e) => openAnimeLink({ title: anime.title, title_english: anime.title_english }, e)}
                                            className="anime-profile-btn-ver mt-1"
                                            title={`Abrir enlace asociado a ${anime.title}`}
                                        >
                                            <Play size={13} fill="currentColor" />
                                            <span>Ver en enlace asociado</span>
                                            <ExternalLink size={12} />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2.5">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="anime-profile-field-label">Estado:</span>
                                        <select
                                            className="cat-select py-1 px-2"
                                            style={{ width: '165px', fontSize: '0.78rem' }}
                                            value={myEntry.estado}
                                            onChange={(e) => {
                                                if (e.target.value === 'eliminar') {
                                                    handleRemoveFromMyList()
                                                } else {
                                                    handleUpdateStatus(e.target.value as EstadoLista)
                                                }
                                            }}
                                        >
                                            <option value="viendo">🟢 Viendo</option>
                                            <option value="visto">🔵 Completado</option>
                                            <option value="pendiente">⚪ Pendiente</option>
                                            <option value="esperando">⏳ Esperando estreno</option>
                                            <option value="dropeado">🔴 Dropeado</option>
                                            <option value="eliminar">🗑️ Quitar de Mi Lista</option>
                                        </select>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="anime-profile-field-label">Episodios:</span>
                                        <div className="d-flex align-items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleDecrementEpisodes}
                                                className="anime-profile-ep-minus"
                                                disabled={(myEntry.episodiosVistos || 0) <= 0}
                                                title="Restar 1 episodio visto"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={localEp}
                                                onChange={(e) => setLocalEp(e.target.value.replace(/[^0-9]/g, ''))}
                                                onBlur={handleCommitEpisodes}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCommitEpisodes()
                                                }}
                                                className="anime-profile-ep-input"
                                                title="Escribe el episodio y presiona Enter"
                                            />
                                            <span className="small text-secondary font-mono px-1">
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

                                    {isLinksEnabled && (
                                        <button
                                            type="button"
                                            onClick={(e) => openAnimeLink({ title: anime.title, title_english: anime.title_english }, e)}
                                            className="anime-profile-btn-ver"
                                            title={`Abrir enlace asociado a ${anime.title}`}
                                        >
                                            <Play size={13} fill="currentColor" />
                                            <span>Ver en enlace asociado</span>
                                            <ExternalLink size={12} />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleRemoveFromMyList}
                                        disabled={savingList}
                                        className="anime-profile-remove-btn"
                                        title="Eliminar este anime de tu lista"
                                    >
                                        <Trash2 size={13} />
                                        <span>{savingList ? 'Quitando...' : 'Quitar de Mi Lista'}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 2.5 Plataformas Legales de Streaming Oficiales */}
                        {streamingPlatforms.length > 0 && (
                            <div className="anime-profile-panel">
                                <div className="anime-profile-panel-title">Dónde Ver Oficialmente</div>
                                <div className="anime-streaming-list">
                                    {streamingPlatforms.map((sp) => (
                                        <a
                                            key={sp.site}
                                            href={sp.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="anime-streaming-item"
                                            style={{ '--sp-brand': sp.color || '#a855f7' } as React.CSSProperties}
                                            title={`Ver ${anime.title} en ${sp.site}`}
                                        >
                                            <div className="anime-streaming-left">
                                                <span className="anime-streaming-icon-box">
                                                    {sp.icon ? (
                                                        <img src={sp.icon} alt={sp.site} />
                                                    ) : (
                                                        <Play size={11} fill="#ffffff" color="#ffffff" />
                                                    )}
                                                </span>
                                                <span className="anime-streaming-name">{sp.site}</span>
                                            </div>
                                            <span className="anime-streaming-action">
                                                <span>Ver</span>
                                                <ExternalLink size={12} />
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                className={`anime-profile-tab ${activeTab === 'characters' ? 'active' : ''}`}
                                onClick={() => setActiveTab('characters')}
                            >
                                <Users size={14} /> Personajes ({characters.length})
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
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setHoveredTag((prev) => (prev === `genre_${g}` ? null : `genre_${g}`))
                                                                }}
                                                            >
                                                                i
                                                            </span>
                                                        </button>
                                                        {hoveredTag === `genre_${g}` && (
                                                            <div className="anime-tag-info-popover">
                                                                <div className="anime-tag-info-popover-title">{g}</div>
                                                                <p className="anime-tag-info-popover-desc mb-0">
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
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setHoveredTag((prev) => (prev === `main_${t.name}` ? null : `main_${t.name}`))
                                                                }}
                                                            >
                                                                i
                                                            </span>
                                                        </button>
                                                        {hoveredTag === `main_${t.name}` && (
                                                            <div className="anime-tag-info-popover">
                                                                <div className="anime-tag-info-popover-title">
                                                                    {t.name} ({t.rank ?? 80}%)
                                                                </div>
                                                                <p className="anime-tag-info-popover-desc mb-0">
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
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setHoveredTag((prev) => (prev === `sec_${t.name}` ? null : `sec_${t.name}`))
                                                                }}
                                                            >
                                                                i
                                                            </span>
                                                        </button>
                                                        {hoveredTag === `sec_${t.name}` && (
                                                            <div className="anime-tag-info-popover">
                                                                <div className="anime-tag-info-popover-title">
                                                                    {t.name} ({t.rank ?? 60}%)
                                                                </div>
                                                                <p className="anime-tag-info-popover-desc mb-0">
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

                                {/* Personajes y Seiyuu / Actores de Doblaje (vista previa en Detalles) */}
                                {(characters.length > 0 || loadingCharsStreaming) && (
                                    <div className="anime-profile-section-card">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                            <div>
                                                <h3 className="anime-profile-section-heading mb-0 border-0 pb-0 d-flex align-items-center gap-2">
                                                    <Users size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                                                    <span>Personajes & Actores de Voz (Seiyuu)</span>
                                                </h3>
                                                <p className="small text-secondary mb-0" style={{ fontSize: '0.76rem' }}>
                                                    Haz clic en cualquier personaje para abrir su ficha dedicada con biografía completa, spoilers y actores de doblaje.
                                                </p>
                                            </div>
                                            {characters.length > 8 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('characters')}
                                                    className="anime-profile-spoiler-btn"
                                                >
                                                    Ver los {characters.length} personajes
                                                </button>
                                            )}
                                        </div>

                                        {loadingCharsStreaming && characters.length === 0 ? (
                                            <div className="d-flex align-items-center justify-content-center py-4 text-secondary gap-2">
                                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                                <span className="small">Cargando personajes y actores de voz...</span>
                                            </div>
                                        ) : (
                                            <div className="anime-char-grid">
                                                {characters.slice(0, 8).map((ch) => {
                                                    const mainVa = ch.voice_actors?.[0]
                                                    return (
                                                        <div
                                                            key={ch.id}
                                                            onClick={() => {
                                                                setSelectedCharacter(ch)
                                                                window.scrollTo({ top: 0, behavior: 'smooth' })
                                                            }}
                                                            role="button"
                                                            tabIndex={0}
                                                            className="anime-char-card"
                                                            title={`Ver ficha dedicada de ${ch.name}`}
                                                        >
                                                            {/* Lado izquierdo: Personaje */}
                                                            <div className="anime-char-side">
                                                                <img
                                                                    src={ch.image_url}
                                                                    alt={ch.name}
                                                                    loading="lazy"
                                                                    className="anime-char-avatar"
                                                                />
                                                                <div className="overflow-hidden">
                                                                    <div className="small fw-bold text-white text-truncate" style={{ fontSize: '0.82rem' }}>
                                                                        {ch.name}
                                                                    </div>
                                                                    <div className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                                                        {ch.role_display}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Lado derecho: Seiyuu / Actor de voz principal */}
                                                            {mainVa && (
                                                                <div className="anime-char-side is-va">
                                                                    <div className="overflow-hidden">
                                                                        <div className="small fw-semibold text-white text-truncate" style={{ fontSize: '0.78rem' }}>
                                                                            {mainVa.name}
                                                                        </div>
                                                                        <div className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                                                            {mainVa.language_display || mainVa.language}
                                                                        </div>
                                                                    </div>
                                                                    <img
                                                                        src={mainVa.image_url}
                                                                        alt={mainVa.name}
                                                                        loading="lazy"
                                                                        className="anime-char-avatar"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Evolución Histórica integrada también en la vista principal */}
                                <div className="anime-profile-section-card">
                                    <h3 className="anime-profile-section-heading">
                                        Evolución Histórica de Puntuación (2018–2026)
                                    </h3>
                                    <AnimeScoreHistoryChart
                                        malId={anime.mal_id}
                                        title={anime.title}
                                        relations={relations}
                                        onSelectAnime={onSelectAnime}
                                    />
                                </div>

                                {/* Cronología y Obras Relacionadas (Precuelas, Secuelas, Spin-offs) */}
                                {(relations.length > 0 || loadingRelations) && (
                                    <div className="anime-profile-section-card">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <h3 className="anime-profile-section-heading mb-0 d-flex align-items-center gap-2">
                                                <GitFork size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                                                <span>Cronología y Obras Relacionadas</span>
                                            </h3>
                                            {relations.length > 0 && (
                                                <span className="small text-secondary font-mono" style={{ fontSize: '0.74rem' }}>
                                                    {relations.length} {relations.length === 1 ? 'obra vinculada' : 'obras vinculadas'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="small text-secondary mb-3" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                                            Sigue la historia en orden: conecta esta temporada con sus precuelas, secuelas directas, historias paralelas y derivados.
                                        </p>

                                        {loadingRelations && relations.length === 0 ? (
                                            <div className="d-flex align-items-center justify-content-center py-4 text-secondary gap-2">
                                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                                <span className="small">Cargando relaciones de la franquicia...</span>
                                            </div>
                                        ) : (
                                            <div className="anime-profile-relations-grid">
                                                {relations.map((rel, idx) => {
                                                    const typeKey = (rel.relation_type || 'other').toLowerCase()
                                                    return (
                                                        <div
                                                            key={`${rel.mal_id || rel.anilist_id || idx}-${rel.relation_type}`}
                                                            className="anime-relation-card"
                                                            onClick={() => {
                                                                if (rel.mal_id) {
                                                                    if (onSelectAnime) {
                                                                        onSelectAnime(rel.mal_id)
                                                                    } else {
                                                                        navigate(`/anime/${rel.mal_id}`)
                                                                    }
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                                                }
                                                            }}
                                                            role={rel.mal_id ? 'button' : undefined}
                                                            tabIndex={rel.mal_id ? 0 : undefined}
                                                            title={rel.mal_id ? `Ir a la ficha de ${rel.title}` : rel.title}
                                                        >
                                                            <div className="anime-relation-poster-wrap">
                                                                <img
                                                                    src={rel.image_url}
                                                                    alt={rel.title}
                                                                    className="anime-relation-poster-img"
                                                                    loading="lazy"
                                                                    onError={(e) => {
                                                                        ;(e.currentTarget as HTMLImageElement).src =
                                                                            'https://via.placeholder.com/60x85/1e1e24/a855f7?text=Anime'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="anime-relation-info">
                                                                <div className="anime-relation-badge-row">
                                                                    <span className={`anime-relation-badge relation-${typeKey}`}>
                                                                        {rel.relation_type_display || rel.relation_type} ({rel.format_display || rel.format || 'Anime'})
                                                                    </span>
                                                                </div>
                                                                <div className="anime-relation-title">
                                                                    {rel.title}
                                                                </div>
                                                                <div className="anime-relation-meta">
                                                                    {rel.season_year && <span>{rel.season_year}</span>}
                                                                    {rel.status && <span>· {rel.status}</span>}
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
                        )}

                        {activeTab === 'characters' && (
                            <div className="anime-profile-section-card">
                                <div className="mb-3">
                                    <h3 className="anime-profile-section-heading mb-1">
                                        Personajes y Actores de Doblaje / Seiyuu de {anime.title}
                                    </h3>
                                    <p className="small text-secondary mb-0" style={{ fontSize: '0.78rem' }}>
                                        Selecciona cualquier personaje para abrir su visual dedicada con historia, spoilers ocultables, animeografía y actores de voz.
                                    </p>
                                </div>

                                {loadingCharsStreaming && characters.length === 0 ? (
                                    <div className="text-center py-4">
                                        <Loader2
                                            size={24}
                                            className="text-secondary"
                                            style={{ animation: 'spin 1s linear infinite' }}
                                        />
                                    </div>
                                ) : characters.length === 0 ? (
                                    <div className="small text-secondary py-3">
                                        No se encontraron personajes registrados para este anime.
                                    </div>
                                ) : (
                                    <div className="anime-char-grid">
                                        {characters.map((ch) => {
                                            const mainVa = ch.voice_actors?.[0]
                                            return (
                                                <div
                                                    key={ch.id}
                                                    onClick={() => {
                                                        setSelectedCharacter(ch)
                                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                    className="anime-char-card"
                                                >
                                                    <div className="anime-char-side">
                                                        <img
                                                            src={ch.image_url}
                                                            alt={ch.name}
                                                            loading="lazy"
                                                            className="anime-char-avatar"
                                                        />
                                                        <div className="overflow-hidden">
                                                            <div className="small fw-bold text-white text-truncate">
                                                                {ch.name}
                                                            </div>
                                                            {ch.native_name && (
                                                                <div className="small text-secondary text-truncate" style={{ fontSize: '0.7rem' }}>
                                                                    {ch.native_name}
                                                                </div>
                                                            )}
                                                            <div className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                                                {ch.role_display}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {mainVa && (
                                                        <div className="anime-char-side is-va">
                                                            <div className="overflow-hidden">
                                                                <div className="small fw-semibold text-white text-truncate" style={{ fontSize: '0.78rem' }}>
                                                                    {mainVa.name}
                                                                </div>
                                                                <div className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                                                    {mainVa.language_display || mainVa.language}
                                                                </div>
                                                            </div>
                                                            <img
                                                                src={mainVa.image_url}
                                                                alt={mainVa.name}
                                                                loading="lazy"
                                                                className="anime-char-avatar"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="anime-profile-section-card">
                                <h3 className="anime-profile-section-heading">
                                    Histórico de Calificaciones y Tendencia en MyAnimeList
                                </h3>
                                <AnimeScoreHistoryChart
                                    malId={anime.mal_id}
                                    title={anime.title}
                                    relations={relations}
                                    onSelectAnime={onSelectAnime}
                                />
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
                                                            navigate(`/anime/${tgt.mal_id}`)
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

