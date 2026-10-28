import React, { useState, useEffect, useMemo } from 'react'
import {
    Sparkles,
    RotateCcw,
    Film,
    Tv,
    Star,
    Plus,
    Check,
    SlidersHorizontal,
    RefreshCw,
    Wand2,
    Building2,
    Tag,
    Search,
    X,
} from 'lucide-react'
import { useRecommender } from '../../hooks/useRecommender'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { searchTmdbMovies } from '../../services/tmdbService'
import {
    searchTestAnimes,
    type CalibrateAnimeCandidate,
    type CalibratedRecommendation,
    type ReferenceWorkQuery,
} from '../../services/recommenderApi'
import type { TmdbMovie } from '../perfil/perfil-types'
import { ProfesorDoki, type DokiExpression } from '../doki/ProfesorDoki'
import { TasteTestModal } from '../perfil/TasteTestModal'
import './recomendador.css'

const FORMAT_OPTIONS = [
    { id: 'sorprendeme', label: '✨ Sorpréndeme (Todos)' },
    { id: 'Movie', label: '🎬 Película' },
    { id: 'TV', label: '📺 Serie TV' },
    { id: 'ONA', label: '🌐 ONA' },
    { id: 'OVA', label: '💿 OVA' },
]

const GENRE_PREF_OPTIONS = [
    { id: 'sorprendeme', label: '✨ Sorpréndeme (Según mi perfil)' },
    { id: 'Action', label: 'Acción' },
    { id: 'Adventure', label: 'Aventura' },
    { id: 'Romance', label: 'Romance' },
    { id: 'Sci-Fi', label: 'Ciencia Ficción' },
    { id: 'Comedy', label: 'Comedia' },
    { id: 'Drama', label: 'Drama' },
    { id: 'Fantasy', label: 'Fantasía' },
    { id: 'Mystery', label: 'Misterio' },
    { id: 'Psychological', label: 'Psicológico' },
    { id: 'Thriller', label: 'Suspenso / Thriller' },
    { id: 'Slice of Life', label: 'Slice of Life' },
    { id: 'Supernatural', label: 'Sobrenatural' },
    { id: 'Horror', label: 'Terror' },
    { id: 'Sports', label: 'Deportes' },
    { id: 'Cyberpunk', label: 'Tag: Cyberpunk' },
    { id: 'Time Manipulation', label: 'Tag: Viajes en el Tiempo' },
    { id: 'Dark Fantasy', label: 'Tag: Fantasía Oscura' },
]

const ONBOARDING_DIALOGUES: { expression: DokiExpression; text: React.ReactNode }[] = [
    {
        expression: 'emocionado_feliz',
        text: (
            <>
                ¡Konnichiwa! Soy el <strong>Profesor Doki Doki</strong>. Para activar tu
                Recomendador necesito que realicemos juntos un breve{' '}
                <strong>Test de Calibración</strong> guiado paso a paso por mí para conocer tus
                gustos. Toma menos de 1 minuto y podrás volver a hacerlo cuando quieras.
            </>
        ),
    },
    {
        expression: 'explicando',
        text: (
            <>
                En el test me contarás qué películas o series de cine/TV te gustan, tus tropos
                preferidos y los animes que ya viste. Con eso conoceré tu perfil sin recomendarte{' '}
                <strong>jamás secuelas directas</strong> ni series que ya hayas visto.
            </>
        ),
    },
    {
        expression: 'idea_encontrada',
        text: (
            <>
                Una vez calibrado, podrás ingresar cualquier{' '}
                <strong>película, serie o anime puntual</strong> para encontrar los 5 animes más
                parecidos ajustados a tu perfil, además de una fila especial estilo Netflix basada
                en tus obras favoritas.
            </>
        ),
    },
]

export const RecomendadorView: React.FC = () => {
    const { acento } = useThemeAccent()
    const { filas, agregarAnime } = useMyList()
    const {
        tasteAnswers,
        isCalibrated,
        preferredFormat,
        preferredGenre,
        referenceWork,
        recommendations,
        netflixRecommendations,
        selectedNetflixMovieIndex,
        isLoadingRecs,
        isLoadingNetflix,
        handleSelectFormat,
        handleSelectGenre,
        handleSelectReferenceWork,
        setSelectedNetflixMovieIndex,
        handleSurpriseMeReset,
        rotateNextFive,
        completeCalibrationTest,
    } = useRecommender()

    const [isTestModalOpen, setIsTestModalOpen] = useState(false)
    const [justAddedIds, setJustAddedIds] = useState<number[]>([])
    const [onboardingIdx, setOnboardingIdx] = useState(0)
    const [calibratedTipIdx, setCalibratedTipIdx] = useState(0)

    // Buscador de obra puntual (película, serie o anime)
    const [refSearchQuery, setRefSearchQuery] = useState('')
    const [refMovieResults, setRefMovieResults] = useState<TmdbMovie[]>([])
    const [refAnimeResults, setRefAnimeResults] = useState<CalibrateAnimeCandidate[]>([])
    const [isSearchingRef, setIsSearchingRef] = useState(false)

    const myListIds = useMemo(() => new Set(filas.map((f) => f.malId)), [filas])

    const isSurpriseMode =
        preferredFormat === 'sorprendeme' &&
        preferredGenre === 'sorprendeme' &&
        !referenceWork

    // Debounce para el buscador unificado de referencia (Película/Serie TMDb + Anime)
    useEffect(() => {
        const q = refSearchQuery.trim()
        if (q.length < 2) {
            setRefMovieResults([])
            setRefAnimeResults([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingRef(true)
            try {
                const [movies, animes] = await Promise.all([
                    searchTmdbMovies(q),
                    searchTestAnimes(q),
                ])
                setRefMovieResults(movies.slice(0, 5))
                setRefAnimeResults(animes.slice(0, 5))
            } catch {
                setRefMovieResults([])
                setRefAnimeResults([])
            } finally {
                setIsSearchingRef(false)
            }
        }, 250)
        return () => clearTimeout(timer)
    }, [refSearchQuery])

    const selectMovieAsReference = (m: TmdbMovie) => {
        const ref: ReferenceWorkQuery = {
            kind: 'movie',
            title: m.title,
            genres: m.genres || [],
            overview: m.overview || '',
            poster: m.posterPath,
            year: m.releaseYear,
        }
        handleSelectReferenceWork(ref)
        setRefSearchQuery('')
        setRefMovieResults([])
        setRefAnimeResults([])
    }

    const selectAnimeAsReference = (a: CalibrateAnimeCandidate) => {
        const ref: ReferenceWorkQuery = {
            kind: 'anime',
            title: a.title,
            genres: a.genres || [],
            mal_id: a.mal_id,
            poster: a.image_url,
            year: a.season_year,
        }
        handleSelectReferenceWork(ref)
        setRefSearchQuery('')
        setRefMovieResults([])
        setRefAnimeResults([])
    }

    const calibratedDokiGuide = useMemo(() => {
        if (isLoadingRecs) {
            return {
                expression: 'pensando' as DokiExpression,
                text: (
                    <>
                        Calculando tus <strong>5 mejores alternativas</strong> a partir de tu
                        calibración{referenceWork ? ` y tu búsqueda "${referenceWork.title}"` : ''}{' '}
                        (excluyendo secuelas y series vistas)...
                    </>
                ),
            }
        }

        if (referenceWork) {
            return {
                expression: 'idea_encontrada' as DokiExpression,
                text: (
                    <>
                        ¡Excelente referencia! He combinado la relación temática de{' '}
                        <strong>"{referenceWork.title}"</strong> con lo que sé de ti en el
                        calibrador para entregarte estas <strong>5 alternativas</strong>.
                    </>
                ),
            }
        }

        if (!isSurpriseMode) {
            const fmtExpr: Record<string, DokiExpression> = {
                Movie: 'comiendo',
                TV: 'emocionado_feliz',
                ONA: 'sorprendido',
                OVA: 'six_seven',
            }
            const genreExpr: Record<string, DokiExpression> = {
                Action: 'emocionado_serio',
                Adventure: 'emocionado_feliz',
                Romance: 'sonrojado',
                'Sci-Fi': 'idea_encontrada',
                Comedy: 'risa',
                Drama: 'emocionado_triste',
                Mystery: 'six_seven',
                Psychological: 'six_seven',
                Thriller: 'shock',
                Horror: 'shock',
                'Slice of Life': 'tranquilo',
            }

            const chosenExpr =
                (preferredGenre !== 'sorprendeme' && genreExpr[preferredGenre]) ||
                (preferredFormat !== 'sorprendeme' && fmtExpr[preferredFormat]) ||
                'aprobacion'

            return {
                expression: chosenExpr,
                text: (
                    <>
                        He filtrado tus 5 alternativas priorizando{' '}
                        <strong>
                            {preferredFormat !== 'sorprendeme'
                                ? preferredFormat
                                : 'todos los formatos'}
                        </strong>
                        {preferredGenre !== 'sorprendeme' ? (
                            <>
                                {' '}
                                en <strong>{preferredGenre}</strong>
                            </>
                        ) : null}{' '}
                        según tu perfil. Si quieres volver al mejor match global, pulsa{' '}
                        <strong>"Sorpréndeme"</strong>.
                    </>
                ),
            }
        }

        const calibratedTips: { expression: DokiExpression; text: React.ReactNode }[] = [
            {
                expression: 'explicando',
                text: (
                    <>
                        Escribe abajo cualquier <strong>película, serie o anime puntual</strong>{' '}
                        para recomendarte 5 animes parecidos ajustados a tu perfil, o usa el modo{' '}
                        <strong>"Sorpréndeme"</strong>.
                    </>
                ),
            },
            {
                expression: 'comiendo',
                text: (
                    <>
                        Más abajo te preparé una sección especial <strong>estilo Netflix</strong>{' '}
                        con 5 alternativas basadas directamente en tus películas y series favoritas.
                    </>
                ),
            },
        ]

        return calibratedTips[calibratedTipIdx % calibratedTips.length]
    }, [
        isLoadingRecs,
        referenceWork,
        isSurpriseMode,
        preferredFormat,
        preferredGenre,
        calibratedTipIdx,
    ])

    const handleAddToMyList = async (animeId: number) => {
        if (myListIds.has(animeId) || justAddedIds.includes(animeId)) return
        setJustAddedIds((prev) => [...prev, animeId])
        try {
            await agregarAnime({
                malId: animeId,
                estado: 'pendiente',
                nota: null,
                episodiosVistos: 0,
                favorito: false,
                carpetaId: null,
                tags: ['#recomendado-doki'],
                comentario: 'Descubierto en el Recomendador de Animigos',
            })
        } catch (err) {
            console.error('Error agregando anime desde recomendador:', err)
        }
    }

    const renderAnimeCard = (rec: CalibratedRecommendation, index: number) => {
        const inList = myListIds.has(rec.anime_id) || justAddedIds.includes(rec.anime_id)
        return (
            <article key={rec.anime_id} className="rec-anime-card">
                <div className="rec-anime-poster-wrap">
                    <img
                        src={rec.anime_poster}
                        alt={rec.anime_title}
                        className="rec-anime-poster"
                        loading="lazy"
                    />
                    <span className="rec-rank-badge">#{index + 1}</span>
                    <span className="rec-affinity-badge" style={{ backgroundColor: acento }}>
                        {rec.affinity_score}% Match
                    </span>
                    <span className="rec-format-badge">
                        {rec.type === 'Movie' ? (
                            <>
                                <Film size={11} /> Película
                            </>
                        ) : (
                            <>
                                <Tv size={11} /> {rec.type || 'TV'}
                            </>
                        )}
                    </span>
                </div>

                <div className="rec-anime-body">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                        <span className="rec-anime-studio">
                            <Building2 size={12} /> {rec.anime_studio}
                        </span>
                        <span className="rec-anime-score">
                            <Star size={12} fill="#facc15" color="#facc15" />{' '}
                            {rec.anime_score.toFixed(2)}
                        </span>
                    </div>

                    <h3 className="rec-anime-title" title={rec.anime_title}>
                        {rec.anime_title}
                    </h3>

                    <div className="rec-anime-meta mb-2">
                        {rec.season_year && <span>{rec.season_year}</span>}
                        {rec.episodes && (
                            <span>
                                · {rec.episodes} {rec.episodes === 1 ? 'ep' : 'eps'}
                            </span>
                        )}
                    </div>

                    <div className="rec-match-reason-box mb-2">
                        <span>{rec.match_reason}</span>
                    </div>

                    <div className="rec-tags-wrap mb-3">
                        {rec.genres.slice(0, 2).map((g) => (
                            <span key={g} className="rec-genre-pill">
                                {g}
                            </span>
                        ))}
                        {(rec.tags || []).slice(0, 3).map((t) => (
                            <span
                                key={t.name}
                                className="rec-weighted-tag-pill"
                                title={`Relevancia: ${t.rank}%`}
                            >
                                {t.name} <small>{t.rank}%</small>
                            </span>
                        ))}
                    </div>

                    <div className="mt-auto pt-1">
                        <button
                            type="button"
                            className={`rec-add-list-btn w-100 ${inList ? 'added' : ''}`}
                            style={
                                !inList
                                    ? {
                                          borderColor: acento,
                                          color: '#ffffff',
                                      }
                                    : undefined
                            }
                            onClick={() => handleAddToMyList(rec.anime_id)}
                            disabled={inList}
                        >
                            {inList ? (
                                <>
                                    <Check size={15} /> En Mi Lista
                                </>
                            ) : (
                                <>
                                    <Plus size={15} /> Agregar a Mi Lista
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </article>
        )
    }

    const currentDialogue = ONBOARDING_DIALOGUES[onboardingIdx]
    const userFavMovies = tasteAnswers.favoriteMovies || []
    const activeNetflixMovieTitle =
        selectedNetflixMovieIndex >= 0 && selectedNetflixMovieIndex < userFavMovies.length
            ? userFavMovies[selectedNetflixMovieIndex].title
            : userFavMovies.length > 0
              ? userFavMovies.map((m) => m.title).slice(0, 2).join(' y ')
              : 'tus películas y series favoritas'

    return (
        <section
            className="ml-root py-4 px-3 px-md-5"
            style={{ '--rec-accent': acento, '--ml-acento': acento } as React.CSSProperties}
        >
            <div className="recomendador-page container" style={{ maxWidth: '1240px' }}>
            {/* =====================================================================
                ESTADO 1: PREVIO AL TEST — FOTO A LA IZQUIERDA Y BURBUJA A LA DERECHA
               ===================================================================== */}
            {!isCalibrated ? (
                <section className="rec-onboarding-stage my-3">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                        <h1 className="rec-main-heading mb-0">Recomendador</h1>
                    </div>

                    <ProfesorDoki
                        expression={currentDialogue.expression}
                        dialogue={currentDialogue.text}
                        size="xl"
                        className="rec-onboarding-doki mb-0"
                        onPrevTip={() =>
                            setOnboardingIdx(
                                (prev) =>
                                    (prev - 1 + ONBOARDING_DIALOGUES.length) %
                                    ONBOARDING_DIALOGUES.length
                            )
                        }
                        onNextTip={() =>
                            setOnboardingIdx((prev) => (prev + 1) % ONBOARDING_DIALOGUES.length)
                        }
                        actions={
                            <button
                                type="button"
                                className="rec-primary-cta-btn"
                                style={{ backgroundColor: acento, borderColor: acento }}
                                onClick={() => setIsTestModalOpen(true)}
                            >
                                <Sparkles size={17} /> Realizar Test de Calibración
                            </button>
                        }
                    />
                </section>
            ) : (
                /* =====================================================================
                    ESTADO 2: CALIBRADO — BUSCADOR DE REFERENCIA + RESULTADOS + FILA NETFLIX
                   ===================================================================== */
                <>
                    <header className="rec-calibrated-header mb-4">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                            <h1 className="rec-main-heading mb-0">Recomendador</h1>

                            <button
                                type="button"
                                className="rec-recalibrate-btn"
                                onClick={() => setIsTestModalOpen(true)}
                            >
                                <RotateCcw size={15} /> Volver a hacer el test
                            </button>
                        </div>

                        <ProfesorDoki
                            expression={calibratedDokiGuide.expression}
                            dialogue={calibratedDokiGuide.text}
                            size="md"
                            onNextTip={() => setCalibratedTipIdx((prev) => prev + 1)}
                            className="mb-0"
                        />
                    </header>

                    {/* =====================================================================
                        SECCIÓN 1: BÚSQUEDA POR PELÍCULA, SERIE O ANIME PUNTUAL + PREFERENCIAS
                       ===================================================================== */}
                    <section className="rec-preferences-bar mb-4">
                        {/* Buscador de obra de referencia puntual */}
                        <div className="mb-3 pb-3 border-bottom border-secondary border-opacity-25">
                            <label className="rec-pref-section-label d-block mb-2">
                                <Search size={15} className="me-1.5" style={{ color: acento }} />
                                Buscar anime parecido a una película, serie o anime puntual:
                            </label>

                            <div className="doki-wiz-search-wrap mb-0">
                                <div className="doki-wiz-search-box">
                                    <Search size={17} className="text-secondary flex-shrink-0" />
                                    <input
                                        type="text"
                                        className="doki-wiz-search-input"
                                        placeholder="Escribe una película, serie o anime (ej: Interstellar, El Padrino, Death Note, Frieren...)"
                                        value={refSearchQuery}
                                        onChange={(e) => setRefSearchQuery(e.target.value)}
                                    />
                                    {refSearchQuery && (
                                        <button
                                            type="button"
                                            className="btn btn-sm p-0 text-secondary border-0"
                                            onClick={() => setRefSearchQuery('')}
                                        >
                                            <X size={15} />
                                        </button>
                                    )}
                                </div>

                                {refSearchQuery.trim().length >= 2 && (
                                    <div className="doki-wiz-dropdown">
                                        {isSearchingRef ? (
                                            <div className="p-3 text-center text-secondary small">
                                                Buscando películas, series y animes...
                                            </div>
                                        ) : refMovieResults.length === 0 &&
                                          refAnimeResults.length === 0 ? (
                                            <div className="p-3 text-center text-secondary small">
                                                No se encontraron obras para "{refSearchQuery}".
                                            </div>
                                        ) : (
                                            <>
                                                {refMovieResults.length > 0 && (
                                                    <div className="px-2 py-1 text-secondary fw-bold" style={{ fontSize: '0.7rem' }}>
                                                        PELÍCULAS Y SERIES (CINE / TV)
                                                    </div>
                                                )}
                                                {refMovieResults.map((m) => (
                                                    <button
                                                        key={`movie-${m.id}`}
                                                        type="button"
                                                        onClick={() => selectMovieAsReference(m)}
                                                        className="doki-wiz-dropdown-item"
                                                    >
                                                        {m.posterPath ? (
                                                            <img
                                                                src={m.posterPath}
                                                                alt={m.title}
                                                                style={{
                                                                    width: '32px',
                                                                    height: '46px',
                                                                    objectFit: 'cover',
                                                                    borderRadius: '6px',
                                                                }}
                                                            />
                                                        ) : (
                                                            <Film size={16} className="text-secondary" />
                                                        )}
                                                        <div className="flex-grow-1 min-w-0">
                                                            <div className="fw-bold text-white small text-truncate">
                                                                {m.title}{' '}
                                                                {m.releaseYear && (
                                                                    <span className="text-secondary fw-normal">
                                                                        ({m.releaseYear})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-secondary text-truncate" style={{ fontSize: '0.72rem' }}>
                                                                Cine/TV · {m.genres.join(' · ')}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}

                                                {refAnimeResults.length > 0 && (
                                                    <div className="px-2 py-1 mt-1 text-secondary fw-bold" style={{ fontSize: '0.7rem' }}>
                                                        ANIMES DEL CATÁLOGO
                                                    </div>
                                                )}
                                                {refAnimeResults.map((a) => (
                                                    <button
                                                        key={`anime-${a.mal_id}`}
                                                        type="button"
                                                        onClick={() => selectAnimeAsReference(a)}
                                                        className="doki-wiz-dropdown-item"
                                                    >
                                                        <img
                                                            src={a.image_url}
                                                            alt={a.title}
                                                            style={{
                                                                width: '32px',
                                                                height: '46px',
                                                                objectFit: 'cover',
                                                                borderRadius: '6px',
                                                            }}
                                                        />
                                                        <div className="flex-grow-1 min-w-0">
                                                            <div className="fw-bold text-white small text-truncate">
                                                                {a.title}
                                                            </div>
                                                            <div className="text-secondary text-truncate" style={{ fontSize: '0.72rem' }}>
                                                                Anime · {(a.genres || []).slice(0, 3).join(' · ')}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Obra de referencia activa */}
                            {referenceWork && (
                                <div className="d-flex align-items-center justify-content-between gap-2 mt-2 p-2 rounded-3" style={{ background: '#18181f', border: `1px solid ${acento}` }}>
                                    <div className="d-flex align-items-center gap-2.5 min-w-0">
                                        {referenceWork.poster ? (
                                            <img
                                                src={referenceWork.poster}
                                                alt={referenceWork.title}
                                                style={{
                                                    width: '32px',
                                                    height: '44px',
                                                    objectFit: 'cover',
                                                    borderRadius: '6px',
                                                }}
                                            />
                                        ) : referenceWork.kind === 'movie' ? (
                                            <Film size={16} />
                                        ) : (
                                            <Tv size={16} />
                                        )}
                                        <div className="min-w-0">
                                            <div className="small fw-bold text-white text-truncate">
                                                Referencia activa: {referenceWork.title}
                                            </div>
                                            <div className="text-secondary text-truncate" style={{ fontSize: '0.72rem' }}>
                                                Combinando similitud con "{referenceWork.title}" + tu perfil calibrado
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="doki-wiz-btn-secondary py-1 px-2.5"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleSelectReferenceWork(null)}
                                    >
                                        <X size={13} /> Quitar referencia
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="rec-preferences-top d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                            <div className="d-flex align-items-center gap-2">
                                <SlidersHorizontal size={16} style={{ color: acento }} />
                                <span className="rec-pref-section-label">
                                    Preferencias de recomendación
                                </span>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    className={`rec-surprise-btn ${isSurpriseMode ? 'active' : ''}`}
                                    style={
                                        isSurpriseMode
                                            ? {
                                                  backgroundColor: acento,
                                                  borderColor: acento,
                                                  color: '#fff',
                                              }
                                            : undefined
                                    }
                                    onClick={handleSurpriseMeReset}
                                >
                                    <Wand2 size={15} /> Sorpréndeme
                                </button>

                                <button
                                    type="button"
                                    className="rec-rotate-btn"
                                    onClick={rotateNextFive}
                                    disabled={isLoadingRecs}
                                >
                                    <RefreshCw
                                        size={14}
                                        className={isLoadingRecs ? 'rec-spin' : ''}
                                    />
                                    Otras 5 alternativas
                                </button>
                            </div>
                        </div>

                        <div className="rec-filter-group mb-3">
                            <span className="rec-filter-label">
                                <Film size={13} /> Formato:
                            </span>
                            <div className="rec-chips-row">
                                {FORMAT_OPTIONS.map((fmt) => {
                                    const active = preferredFormat === fmt.id
                                    return (
                                        <button
                                            key={fmt.id}
                                            type="button"
                                            className={`rec-pref-chip ${active ? 'active' : ''}`}
                                            style={
                                                active
                                                    ? {
                                                          borderColor: acento,
                                                          backgroundColor: `color-mix(in srgb, ${acento} 20%, transparent)`,
                                                          color: '#ffffff',
                                                      }
                                                    : undefined
                                            }
                                            onClick={() => handleSelectFormat(fmt.id)}
                                        >
                                            {fmt.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="rec-filter-group">
                            <span className="rec-filter-label">
                                <Tag size={13} /> Género / Tag:
                            </span>
                            <div className="rec-chips-row">
                                {GENRE_PREF_OPTIONS.map((g) => {
                                    const active = preferredGenre === g.id
                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            className={`rec-pref-chip ${active ? 'active' : ''}`}
                                            style={
                                                active
                                                    ? {
                                                          borderColor: acento,
                                                          backgroundColor: `color-mix(in srgb, ${acento} 20%, transparent)`,
                                                          color: '#ffffff',
                                                      }
                                                    : undefined
                                            }
                                            onClick={() => handleSelectGenre(g.id)}
                                        >
                                            {g.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Resultados de la búsqueda / preferencias (5 alternativas) */}
                    <section className="rec-results-section mb-5">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                            <h2 className="rec-section-title mb-0">
                                {referenceWork
                                    ? `5 Animes parecidos a "${referenceWork.title}" según tu perfil`
                                    : '5 Alternativas para ti'}
                                {!isSurpriseMode && !referenceWork && (
                                    <span className="rec-active-filter-pill ms-2">
                                        {preferredFormat !== 'sorprendeme' ? preferredFormat : ''}{' '}
                                        {preferredGenre !== 'sorprendeme'
                                            ? `· ${preferredGenre}`
                                            : ''}
                                    </span>
                                )}
                            </h2>
                        </div>

                        {isLoadingRecs ? (
                            <div className="rec-loading-box py-5 text-center">
                                <div
                                    className="spinner-border mb-3"
                                    style={{ color: acento }}
                                    role="status"
                                />
                                <p className="mb-0 text-secondary">
                                    Calculando 5 alternativas sin secuelas ni series vistas...
                                </p>
                            </div>
                        ) : recommendations.length === 0 ? (
                            <div className="rec-empty-box p-5 text-center">
                                <p className="mb-3 text-secondary">
                                    No encontramos 5 candidatos con esa combinación sin repetir tus
                                    animes vistos.
                                </p>
                                <button
                                    type="button"
                                    className="rec-surprise-btn active"
                                    style={{
                                        backgroundColor: acento,
                                        borderColor: acento,
                                        color: '#fff',
                                    }}
                                    onClick={handleSurpriseMeReset}
                                >
                                    <Wand2 size={15} /> Volver a "Sorpréndeme"
                                </button>
                            </div>
                        ) : (
                            <div className="rec-five-grid">
                                {recommendations
                                    .slice(0, 5)
                                    .map((rec, index) => renderAnimeCard(rec, index))}
                            </div>
                        )}
                    </section>

                    {/* =====================================================================
                        SECCIÓN 2: RECOMENDACIONES ESTILO NETFLIX BASADAS EN SUS PELÍCULAS/SERIES FAVORITAS (SOLO 5 ALTERNATIVAS)
                       ===================================================================== */}
                    <section className="rec-netflix-section mb-4">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                            <div>
                                <h2 className="rec-section-title mb-1">
                                    Porque te gustó {activeNetflixMovieTitle}
                                </h2>
                                <p className="text-secondary small mb-0">
                                    5 alternativas de anime recomendadas a partir de tus películas y
                                    series favoritas registradas en tu calibración
                                </p>
                            </div>

                            {userFavMovies.length > 1 && (
                                <div className="d-flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        className={`rec-pref-chip ${selectedNetflixMovieIndex === -1 ? 'active' : ''}`}
                                        style={
                                            selectedNetflixMovieIndex === -1
                                                ? {
                                                      borderColor: acento,
                                                      backgroundColor: `color-mix(in srgb, ${acento} 20%, transparent)`,
                                                      color: '#ffffff',
                                                  }
                                                : undefined
                                        }
                                        onClick={() => setSelectedNetflixMovieIndex(-1)}
                                    >
                                        Todas mis favoritas
                                    </button>
                                    {userFavMovies.map((m, idx) => {
                                        const active = selectedNetflixMovieIndex === idx
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                className={`rec-pref-chip ${active ? 'active' : ''}`}
                                                style={
                                                    active
                                                        ? {
                                                              borderColor: acento,
                                                              backgroundColor: `color-mix(in srgb, ${acento} 20%, transparent)`,
                                                              color: '#ffffff',
                                                          }
                                                        : undefined
                                                }
                                                onClick={() => setSelectedNetflixMovieIndex(idx)}
                                            >
                                                <Film size={12} className="me-1" />
                                                {m.title}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {isLoadingNetflix ? (
                            <div className="rec-loading-box py-5 text-center">
                                <div
                                    className="spinner-border mb-3"
                                    style={{ color: acento }}
                                    role="status"
                                />
                                <p className="mb-0 text-secondary">
                                    Generando tus 5 alternativas estilo Netflix...
                                </p>
                            </div>
                        ) : (
                            <div className="rec-five-grid">
                                {netflixRecommendations
                                    .slice(0, 5)
                                    .map((rec, index) => renderAnimeCard(rec, index))}
                            </div>
                        )}
                    </section>
                </>
            )}

            <TasteTestModal
                open={isTestModalOpen}
                onClose={() => setIsTestModalOpen(false)}
                initialAnswers={tasteAnswers}
                onComplete={async (answers) => {
                    await completeCalibrationTest(answers)
                    setIsTestModalOpen(false)
                }}
            />
            </div>
        </section>
    )
}
