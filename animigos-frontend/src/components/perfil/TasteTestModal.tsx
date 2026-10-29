import React, { useState, useEffect, useMemo } from 'react'
import {
    Sparkles,
    Check,
    ChevronRight,
    ChevronLeft,
    Flame,
    Compass,
    Film,
    Search,
    Plus,
    X,
    ThumbsUp,
    Ban,
    Tv,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { searchTmdbMovies } from '../../services/tmdbService'
import {
    searchTestAnimes,
    type CalibrateAnimeCandidate,
} from '../../services/recommenderApi'
import { ProfesorDoki, type DokiExpression, type DokiTipItem } from '../doki/ProfesorDoki'
import type { TasteTestAnswers, TmdbMovie } from './perfil-types'

interface TasteTestModalProps {
    open: boolean
    onClose: () => void
    initialAnswers?: TasteTestAnswers
    onComplete: (answers: TasteTestAnswers) => Promise<void> | void
}

const TROPE_OPTIONS: {
    id: string
    label: string
    desc: string
    expression: DokiExpression
    reactionText: string
}[] = [
    {
        id: 'mastermind',
        label: 'Protagonista Estratega & Juegos Mentales',
        desc: 'Duelos de inteligencia, trampas y ajedrez mental.',
        expression: 'six_seven',
        reactionText:
            '¡Juegos mentales! Veo que disfrutas cuando cada diálogo es una partida de ajedrez a 200 de IQ.',
    },
    {
        id: 'power_scaling',
        label: 'Torneo & Escalamiento de Poder',
        desc: 'Entrenamientos, técnicas secretas y superación épica.',
        expression: 'emocionado_serio',
        reactionText:
            '¡Pura determinación! Nada supera el escalofrío de ver al protagonista levantarse contra todo pronóstico.',
    },
    {
        id: 'enemies_lovers',
        label: 'Enemigos a Amantes / Tensión Romántica',
        desc: 'Rivalidad que evoluciona hacia química genuina.',
        expression: 'sonrojado',
        reactionText:
            '¡Kyaa! Esa tensión entre rivales que terminan enamorándose hace latir hasta mis circuitos.',
    },
    {
        id: 'dark_fantasy',
        label: 'Fantasía Oscura & Brutal',
        desc: 'Mundos hostiles donde nadie tiene armadura de guion.',
        expression: 'shock',
        reactionText:
            '¡Uff, mundos implacables! Ajustaré los sensores hacia tramas maduras, crudas y sin censura moral.',
    },
    {
        id: 'time_travel',
        label: 'Bucles & Viajes en el Tiempo',
        desc: 'Causas y consecuencias, paradojas y realidades paralelas.',
        expression: 'idea_encontrada',
        reactionText:
            '¡El Psy Kongroo! Las paradojas temporales y los misterios de línea de mundo son mi especialidad.',
    },
    {
        id: 'antihero',
        label: 'Antihéroe / Venganza',
        desc: 'Moral gris, justicia propia y objetivos implacables.',
        expression: 'six_seven',
        reactionText:
            '¡Interesante! Anti-héroes brillantes que mueven los hilos desde las sombras.',
    },
    {
        id: 'slice_cozy',
        label: 'Iyashikei / Paz Mental & Comedia',
        desc: 'Historias reconfortantes, café, paisajes y calma.',
        expression: 'tranquilo',
        reactionText:
            'Respira profundo... Buscaré obras reconfortantes y divertidas que te recarguen el alma.',
    },
    {
        id: 'psychological_twist',
        label: 'Misterio & Giros de Trama',
        desc: 'Nada es lo que parece hasta el último minuto.',
        expression: 'sorprendido',
        reactionText:
            '¡Plot twists de infarto! Priorizaré historias llenas de suspenso y revelaciones inesperadas.',
    },
]

const GENRE_LIST = [
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Horror',
    'Mystery',
    'Psychological',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Sports',
    'Supernatural',
    'Thriller',
]

const EXTRA_FILTERS: {
    id: string
    label: string
    expression: DokiExpression
    reaction: string
}[] = [
    {
        id: 'no_fanservice',
        label: 'Sin fanservice innecesario',
        expression: 'aprobacion',
        reaction: '¡Anotado! Priorizaré obras serias y enfocadas en su narrativa.',
    },
    {
        id: 'modern_animation',
        label: 'Animación moderna (2018 en adelante)',
        expression: 'sorprendido',
        reaction:
            '¡Sakuga moderno! Daremos prioridad a producciones recientes con dirección visual puntera.',
    },
    {
        id: 'conclusive_ending',
        label: 'Priorizar historias con final conclusivo',
        expression: 'tranquilo',
        reaction:
            '¡Paz mental garantizada! Priorizaremos historias con conclusión satisfactoria.',
    },
    {
        id: 'elite_ost',
        label: 'Banda sonora memorable (OST Destacado)',
        expression: 'cantando',
        reaction: '🎵 ¡La música lo es todo! Buscaré animes con compositores legendarios.',
    },
]

const STEP_GUIDED_TIPS: Record<number, DokiTipItem[]> = {
    1: [
        {
            expression: 'explicando',
            text: (
                <>
                    ¡Konnichiwa! Para empezar a conocerte, busca y selecciona de{' '}
                    <strong>1 a 5 películas o series de cine/TV</strong> que te hayan encantado.
                    Con ellas también te armaré una fila especial de recomendaciones estilo Netflix.
                </>
            ),
        },
        {
            expression: 'idea_encontrada',
            text: (
                <>
                    Al elegir tus obras favoritas de cine o TV, cruzo su ADN temático contra más de{' '}
                    <strong>131.000 etiquetas ponderadas</strong> de nuestro catálogo.
                </>
            ),
        },
    ],
    2: [
        {
            expression: 'emocionado_serio',
            text: (
                <>
                    Ahora elige hasta <strong>4 tropos narrativos</strong> que te atrapen. Abajo,
                    haz <strong>1 clic en un género para marcarlo Favorito (verde)</strong> o{' '}
                    <strong>2 clics para Vetarlo (rojo)</strong>.
                </>
            ),
        },
        {
            expression: 'six_seven',
            text: (
                <>
                    Los géneros que marques en <strong>rojo (Vetados)</strong> quedarán
                    estrictamente excluidos para que jamás te recomiende algo que no disfrutes.
                </>
            ),
        },
    ],
    3: [
        {
            expression: 'emocionado_feliz',
            text: (
                <>
                    Busca hasta <strong>5 animes que ya hayas visto y amado</strong>. Si es tu
                    primera vez viendo anime, puedes avanzar directamente al siguiente paso.
                </>
            ),
        },
        {
            expression: 'aprobacion',
            text: (
                <>
                    Nunca te recomendaré un anime que ya hayas visto ni tampoco{' '}
                    <strong>secuelas directas</strong> de franquicias que aún no hayas empezado.
                </>
            ),
        },
    ],
    4: [
        {
            expression: 'pensando',
            text: (
                <>
                    ¡Último paso para conocer tu perfil! Elige tus{' '}
                    <strong>exigencias de calidad</strong> y pulsa{' '}
                    <strong>"Guardar y Abrir Recomendador"</strong> para empezar a buscar.
                </>
            ),
        },
        {
            expression: 'celebracion',
            text: (
                <>
                    Al guardar tu calibración, también se actualizará automáticamente tu{' '}
                    <strong>Mapa de Correlación de Gustos</strong> en tu Perfil de usuario.
                </>
            ),
        },
    ],
}

export const TasteTestModal: React.FC<TasteTestModalProps> = ({
    open,
    onClose,
    initialAnswers,
    onComplete,
}) => {
    const [step, setStep] = useState(1)
    const [tipIndex, setTipIndex] = useState(0)
    const [isSaving, setIsSaving] = useState(false)
    const [customReaction, setCustomReaction] = useState<{
        expression: DokiExpression
        text: React.ReactNode
    } | null>(null)

    // Paso 1: Películas / Series (TMDB)
    const [movieQuery, setMovieQuery] = useState('')
    const [movieFilterType, setMovieFilterType] = useState<'all' | 'movie' | 'tv'>('all')
    const [movieResults, setMovieResults] = useState<TmdbMovie[]>([])
    const [isSearchingMovies, setIsSearchingMovies] = useState(false)
    const [selectedMovies, setSelectedMovies] = useState<TmdbMovie[]>(
        initialAnswers?.favoriteMovies || []
    )

    // Paso 2: Tropos y Géneros
    const [selectedTropes, setSelectedTropes] = useState<string[]>(
        initialAnswers?.tropes?.length ? initialAnswers.tropes : ['mastermind', 'dark_fantasy']
    )
    const [preferredGenres, setPreferredGenres] = useState<string[]>(
        initialAnswers?.favoriteGenres?.length
            ? initialAnswers.favoriteGenres
            : ['Action', 'Sci-Fi', 'Psychological']
    )
    const [dislikedGenres, setDislikedGenres] = useState<string[]>(
        initialAnswers?.dislikedGenres || []
    )

    // Paso 3: Animes Vistos
    const [animeQuery, setAnimeQuery] = useState('')
    const [animeResults, setAnimeResults] = useState<CalibrateAnimeCandidate[]>([])
    const [isSearchingAnimes, setIsSearchingAnimes] = useState(false)
    const [selectedAnimes, setSelectedAnimes] = useState<CalibrateAnimeCandidate[]>([])

    // Paso 4: Ritmo y Filtros
    const [pacing, setPacing] = useState<string>(initialAnswers?.pacing || 'fast_12')
    const [extraFilters, setExtraFilters] = useState<string[]>(
        initialAnswers?.contentFilters || ['no_fanservice', 'conclusive_ending']
    )

    useEffect(() => {
        if (open) {
            setStep(1)
            setTipIndex(0)
            setCustomReaction(null)
            if (initialAnswers?.favoriteMovies) {
                setSelectedMovies(initialAnswers.favoriteMovies)
            }
            if (initialAnswers?.tropes?.length) {
                setSelectedTropes(initialAnswers.tropes)
            }
            if (initialAnswers?.favoriteGenres?.length) {
                setPreferredGenres(initialAnswers.favoriteGenres)
            }
            if (initialAnswers?.dislikedGenres) {
                setDislikedGenres(initialAnswers.dislikedGenres)
            }
            if (initialAnswers?.pacing) {
                setPacing(initialAnswers.pacing)
            }
            if (initialAnswers?.contentFilters) {
                setExtraFilters(initialAnswers.contentFilters)
            }
        }
    }, [open, initialAnswers])

    const goToStep = (nextStep: number) => {
        setStep(nextStep)
        setTipIndex(0)
        setCustomReaction(null)
    }

    // Debounce búsqueda TMDB
    useEffect(() => {
        if (!open || step !== 1) return
        const q = movieQuery.trim()
        if (q.length < 2) {
            setMovieResults([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingMovies(true)
            try {
                const res = await searchTmdbMovies(q, movieFilterType)
                setMovieResults(res)
            } catch {
                setMovieResults([])
            } finally {
                setIsSearchingMovies(false)
            }
        }, 240)
        return () => clearTimeout(timer)
    }, [movieQuery, movieFilterType, open, step])

    // Debounce búsqueda Animes
    useEffect(() => {
        if (!open || step !== 3) return
        const q = animeQuery.trim()
        if (q.length < 2) {
            setAnimeResults([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingAnimes(true)
            try {
                const res = await searchTestAnimes(q)
                setAnimeResults(res)
            } catch {
                setAnimeResults([])
            } finally {
                setIsSearchingAnimes(false)
            }
        }, 250)
        return () => clearTimeout(timer)
    }, [animeQuery, open, step])

    const addMovie = (movie: TmdbMovie) => {
        if (selectedMovies.some((m) => m.id === movie.id)) return
        if (selectedMovies.length >= 5) return
        const next = [...selectedMovies, movie]
        setSelectedMovies(next)
        setMovieQuery('')
        setMovieResults([])

        if (next.length === 1) {
            setCustomReaction({
                expression: 'sorprendido',
                text: (
                    <>
                        ¡Ooh, <strong>{movie.title}</strong>! Excelente punto de partida (
                        {movie.genres.slice(0, 2).join(', ') || 'Cine'}). Puedes añadir hasta 4
                        obras más o avanzar al siguiente paso.
                    </>
                ),
            })
        } else if (next.length === 2) {
            setCustomReaction({
                expression: 'comiendo',
                text: (
                    <>
                        ¡<strong>{movie.title}</strong> sumada! Ya veo por dónde van tus gustos
                        cinematográficos.
                    </>
                ),
            })
        } else {
            setCustomReaction({
                expression: 'idea_encontrada',
                text: (
                    <>
                        ¡<strong>{next.length} obras registradas</strong> con{' '}
                        <strong>{movie.title}</strong>! Ya detecto un patrón temático muy claro.
                    </>
                ),
            })
        }
    }

    const removeMovie = (id: number) => {
        setSelectedMovies((prev) => prev.filter((m) => m.id !== id))
    }

    const toggleTrope = (id: string) => {
        const meta = TROPE_OPTIONS.find((t) => t.id === id)
        setSelectedTropes((prev) => {
            const exists = prev.includes(id)
            if (!exists && meta && prev.length < 4) {
                setCustomReaction({
                    expression: meta.expression,
                    text: (
                        <>
                            <strong>{meta.label}:</strong> {meta.reactionText}
                        </>
                    ),
                })
            }
            return exists ? prev.filter((t) => t !== id) : prev.length < 4 ? [...prev, id] : prev
        })
    }

    const cycleGenreState = (genre: string) => {
        if (preferredGenres.includes(genre)) {
            setPreferredGenres((prev) => prev.filter((g) => g !== genre))
            setDislikedGenres((prev) => [...prev, genre])
            setCustomReaction({
                expression: 'preocupado',
                text: (
                    <>
                        He puesto <strong>{genre}</strong> en tu{' '}
                        <strong>lista de vetados (rojo)</strong>. Bloquearé los animes que dependan
                        de ese género.
                    </>
                ),
            })
        } else if (dislikedGenres.includes(genre)) {
            setDislikedGenres((prev) => prev.filter((g) => g !== genre))
            setCustomReaction({
                expression: 'tranquilo',
                text: (
                    <>
                        Dejamos <strong>{genre}</strong> en estado neutral otra vez.
                    </>
                ),
            })
        } else {
            if (preferredGenres.length < 6) {
                setPreferredGenres((prev) => [...prev, genre])
                const exprMap: Record<string, DokiExpression> = {
                    Romance: 'sonrojado',
                    Horror: 'shock',
                    Psychological: 'six_seven',
                    Comedy: 'risa',
                    Action: 'emocionado_serio',
                    'Sci-Fi': 'idea_encontrada',
                }
                setCustomReaction({
                    expression: exprMap[genre] || 'aprobacion',
                    text: (
                        <>
                            ¡<strong>{genre}</strong> marcado como género favorito! Le daré
                            prioridad en tus recomendaciones.
                        </>
                    ),
                })
            }
        }
    }

    const addWatchedAnime = (anime: CalibrateAnimeCandidate) => {
        if (selectedAnimes.some((a) => a.mal_id === anime.mal_id)) return
        if (selectedAnimes.length >= 5) return
        const next = [...selectedAnimes, anime]
        setSelectedAnimes(next)
        setAnimeQuery('')
        setAnimeResults([])
        setCustomReaction({
            expression: next.length % 2 === 1 ? 'aprobacion' : 'risa',
            text: (
                <>
                    ¡<strong>{anime.title}</strong> es una gran obra! Lo usaré como referencia y no
                    te lo repetiré ni te sugeriré sus secuelas.
                </>
            ),
        })
    }

    const removeWatchedAnime = (mal_id: number) => {
        setSelectedAnimes((prev) => prev.filter((a) => a.mal_id !== mal_id))
    }

    const toggleExtraFilter = (id: string) => {
        const meta = EXTRA_FILTERS.find((f) => f.id === id)
        setExtraFilters((prev) => {
            const exists = prev.includes(id)
            if (!exists && meta) {
                setCustomReaction({
                    expression: meta.expression,
                    text: meta.reaction,
                })
            }
            return exists ? prev.filter((f) => f !== id) : [...prev, id]
        })
    }

    const buildAnswersPayload = (): TasteTestAnswers => {
        const finalScore = Math.min(
            100,
            50 +
                (selectedMovies.length > 0 ? 15 : 0) +
                (selectedAnimes.length > 0 ? 15 : 0) +
                (preferredGenres.length > 0 ? 10 : 0) +
                (selectedTropes.length > 0 ? 10 : 0)
        )

        return {
            tropes: selectedTropes,
            favoriteGenres: preferredGenres,
            dislikedGenres,
            pacing,
            contentFilters: extraFilters,
            favoriteMovies: selectedMovies,
            likedAnimeIds:
                selectedAnimes.length > 0
                    ? selectedAnimes.map((a) => a.mal_id)
                    : initialAnswers?.likedAnimeIds || [],
            calibratedPercentage: Math.max(92, finalScore),
        }
    }

    const handleFinishAndSave = async () => {
        setIsSaving(true)
        try {
            const payload = buildAnswersPayload()
            await onComplete(payload)
            onClose()
            setStep(1)
        } finally {
            setIsSaving(false)
        }
    }

    const activeDokiState = useMemo(() => {
        if (step === 1 && isSearchingMovies) {
            return {
                expression: 'pensando' as DokiExpression,
                dialogue: (
                    <>
                        Buscando <strong>"{movieQuery}"</strong> en TMDb...
                    </>
                ),
            }
        }
        if (step === 3 && isSearchingAnimes) {
            return {
                expression: 'pensando' as DokiExpression,
                dialogue: (
                    <>
                        Buscando <strong>"{animeQuery}"</strong> en el catálogo...
                    </>
                ),
            }
        }

        if (customReaction) {
            return {
                expression: customReaction.expression,
                dialogue: customReaction.text,
            }
        }

        const stepTips = STEP_GUIDED_TIPS[step] || STEP_GUIDED_TIPS[1]
        const currentTip = stepTips[tipIndex % stepTips.length]
        return {
            expression: currentTip.expression,
            dialogue: currentTip.text,
        }
    }, [
        step,
        tipIndex,
        customReaction,
        isSearchingMovies,
        movieQuery,
        isSearchingAnimes,
        animeQuery,
    ])

    const currentStepTips = STEP_GUIDED_TIPS[step] || STEP_GUIDED_TIPS[1]

    return (
        <Dialogo
            abierto={open}
            onCerrar={onClose}
            etiqueta="Calibración recomendador"
            ancho={920}
        >
            <div className="doki-wizard-shell">
                <div className="doki-wiz-header">
                    <h3 className="doki-wiz-title">Calibración recomendador</h3>
                </div>

                <ProfesorDoki
                    expression={activeDokiState.expression}
                    dialogue={activeDokiState.dialogue}
                    size="md"
                    onNextTip={
                        currentStepTips.length > 1
                            ? () => {
                                  setCustomReaction(null)
                                  setTipIndex((prev) => (prev + 1) % currentStepTips.length)
                              }
                            : undefined
                    }
                />

                {/* =========================================================
                    PASO 1: PELÍCULAS Y SERIES (TMDB)
                   ========================================================= */}
                {step === 1 && (
                    <div className="doki-wiz-panel">
                        <div className="doki-wiz-section-title">
                            <Film size={17} />
                            <span>1. Películas y Series Favoritas (no anime)</span>
                        </div>
                        <p className="doki-wiz-section-sub">
                            Busca películas o series de TV que te hayan fascinado (ej: Breaking Bad, Game of Thrones, Dark, Stranger Things, Inception, Matrix, Interstellar...):
                        </p>

                        {/* Selector de tipo de obra */}
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <button
                                type="button"
                                className={`btn btn-sm ${movieFilterType === 'all' ? 'btn-primary' : 'btn-outline-secondary text-secondary'}`}
                                style={{ fontSize: '0.74rem', borderRadius: '16px', padding: '2px 12px' }}
                                onClick={() => setMovieFilterType('all')}
                            >
                                ✨ Todas
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${movieFilterType === 'movie' ? 'btn-primary' : 'btn-outline-secondary text-secondary'}`}
                                style={{ fontSize: '0.74rem', borderRadius: '16px', padding: '2px 12px' }}
                                onClick={() => setMovieFilterType('movie')}
                            >
                                <Film size={13} className="me-1" /> Películas
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${movieFilterType === 'tv' ? 'btn-primary' : 'btn-outline-secondary text-secondary'}`}
                                style={{ fontSize: '0.74rem', borderRadius: '16px', padding: '2px 12px' }}
                                onClick={() => setMovieFilterType('tv')}
                            >
                                <Tv size={13} className="me-1" /> Series TV
                            </button>
                        </div>

                        <div className="doki-wiz-search-wrap">
                            <div className="doki-wiz-search-box">
                                <Search size={17} className="text-secondary flex-shrink-0" />
                                <input
                                    type="text"
                                    className="doki-wiz-search-input"
                                    placeholder={
                                        movieFilterType === 'tv'
                                            ? 'Escribe el nombre de una serie (ej: Breaking Bad, Dark...)'
                                            : movieFilterType === 'movie'
                                              ? 'Escribe el nombre de una película (ej: Inception, Matrix...)'
                                              : 'Escribe el nombre de una película o serie...'
                                    }
                                    value={movieQuery}
                                    onChange={(e) => setMovieQuery(e.target.value)}
                                />
                                {movieQuery && (
                                    <button
                                        type="button"
                                        className="btn btn-sm p-0 text-secondary border-0"
                                        onClick={() => setMovieQuery('')}
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>

                            {movieQuery.trim().length >= 2 && (
                                <div className="doki-wiz-dropdown">
                                    {isSearchingMovies ? (
                                        <div className="p-3 text-center text-secondary small">
                                            Buscando en catálogo TMDB (72k+ títulos)...
                                        </div>
                                    ) : movieResults.length === 0 ? (
                                        <div className="p-3 text-center text-secondary small">
                                            No se encontraron resultados para "{movieQuery}".
                                        </div>
                                    ) : (
                                        movieResults.map((m) => {
                                            const already = selectedMovies.some(
                                                (s) => s.id === m.id
                                            )
                                            const isTv = m.mediaType === 'tv'
                                            return (
                                                <button
                                                    key={`${m.mediaType || 'm'}-${m.id}`}
                                                    type="button"
                                                    disabled={already || selectedMovies.length >= 5}
                                                    onClick={() => addMovie(m)}
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
                                                        <div
                                                            style={{
                                                                width: '32px',
                                                                height: '46px',
                                                                borderRadius: '6px',
                                                                backgroundColor: 'rgba(255,255,255,0.06)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                        >
                                                            {isTv ? <Tv size={16} className="text-secondary" /> : <Film size={16} className="text-secondary" />}
                                                        </div>
                                                    )}
                                                    <div className="flex-grow-1 min-w-0">
                                                        <div className="fw-bold text-white text-truncate d-flex align-items-center gap-1.5">
                                                            <span
                                                                className="badge"
                                                                style={{
                                                                    fontSize: '0.62rem',
                                                                    backgroundColor: isTv ? 'rgba(56, 189, 248, 0.18)' : 'rgba(168, 85, 247, 0.18)',
                                                                    color: isTv ? '#38bdf8' : '#c084fc',
                                                                    border: `1px solid ${isTv ? 'rgba(56, 189, 248, 0.35)' : 'rgba(168, 85, 247, 0.35)'}`,
                                                                    padding: '2px 5px',
                                                                }}
                                                            >
                                                                {isTv ? '📺 Serie' : '🎬 Película'}
                                                            </span>
                                                            <span className="text-truncate">{m.title}</span>
                                                            {m.releaseYear && (
                                                                <span className="text-secondary fw-normal">
                                                                    ({m.releaseYear})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-secondary small text-truncate">
                                                            {isTv && m.numberOfSeasons ? `${m.numberOfSeasons} ${m.numberOfSeasons === 1 ? 'temporada' : 'temporadas'} · ` : ''}
                                                            {m.genres.join(' · ')}
                                                        </div>
                                                    </div>
                                                    {already ? (
                                                        <Check size={16} className="text-success" />
                                                    ) : (
                                                        <Plus size={16} className="text-light" />
                                                    )}
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <div
                                className="text-secondary fw-bold mb-2"
                                style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}
                            >
                                TUS OBRAS REGISTRADAS ({selectedMovies.length}/5):
                            </div>
                            {selectedMovies.length === 0 ? (
                                <div className="doki-wiz-empty-slot">
                                    Agrega al menos una película o serie para extraer sus temas y
                                    sinopsis.
                                </div>
                            ) : (
                                <div className="row g-2">
                                    {selectedMovies.map((m) => {
                                        const isTv = m.mediaType === 'tv'
                                        return (
                                            <div key={`${m.mediaType || 'm'}-${m.id}`} className="col-12 col-md-6">
                                                <div className="doki-wiz-selected-card">
                                                    {m.posterPath ? (
                                                        <img
                                                            src={m.posterPath}
                                                            alt={m.title}
                                                            style={{
                                                                width: '36px',
                                                                height: '50px',
                                                                objectFit: 'cover',
                                                                borderRadius: '6px',
                                                            }}
                                                        />
                                                    ) : isTv ? (
                                                        <Tv
                                                            size={18}
                                                            className="text-secondary flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <Film
                                                            size={18}
                                                            className="text-secondary flex-shrink-0"
                                                        />
                                                    )}
                                                    <div className="flex-grow-1 min-w-0">
                                                        <div className="fw-bold text-white small text-truncate d-flex align-items-center gap-1">
                                                            <span
                                                                className="badge"
                                                                style={{
                                                                    fontSize: '0.6rem',
                                                                    backgroundColor: isTv ? 'rgba(56, 189, 248, 0.18)' : 'rgba(168, 85, 247, 0.18)',
                                                                    color: isTv ? '#38bdf8' : '#c084fc',
                                                                    border: `1px solid ${isTv ? 'rgba(56, 189, 248, 0.35)' : 'rgba(168, 85, 247, 0.35)'}`,
                                                                    padding: '1px 4px',
                                                                }}
                                                            >
                                                                {isTv ? 'Serie' : 'Película'}
                                                            </span>
                                                            <span className="text-truncate">{m.title}</span>
                                                            {m.releaseYear ? `(${m.releaseYear})` : ''}
                                                        </div>
                                                        <div
                                                            className="text-secondary text-truncate"
                                                            style={{ fontSize: '0.72rem' }}
                                                        >
                                                            {m.genres.join(', ') || (isTv ? 'Serie' : 'Película')}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMovie(m.id)}
                                                        className="btn btn-sm p-0 text-secondary border-0"
                                                        title="Quitar"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* =========================================================
                    PASO 2: TROPOS Y GÉNEROS (FAVORITOS VS VETADOS)
                   ========================================================= */}
                {step === 2 && (
                    <div className="doki-wiz-panel">
                        <div className="doki-wiz-section-title">
                            <Flame size={17} />
                            <span>
                                2A. Tropos Narrativos Favoritos ({selectedTropes.length}/4)
                            </span>
                        </div>
                        <p className="doki-wiz-section-sub">
                            Selecciona hasta 4 dinámicas de historia que te atrapen:
                        </p>

                        <div className="row g-2 mb-4">
                            {TROPE_OPTIONS.map((trope) => {
                                const active = selectedTropes.includes(trope.id)
                                return (
                                    <div key={trope.id} className="col-12 col-md-6">
                                        <button
                                            type="button"
                                            onClick={() => toggleTrope(trope.id)}
                                            className={`doki-wiz-choice-card ${active ? 'active' : ''}`}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <span className="fw-bold small text-white">
                                                    {trope.label}
                                                </span>
                                                {active && <Check size={15} />}
                                            </div>
                                            <p
                                                className="mb-0 text-secondary"
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                {trope.desc}
                                            </p>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="doki-wiz-section-title">
                            <Compass size={17} />
                            <span>2B. Géneros Favoritos vs. Vetados</span>
                        </div>
                        <p className="doki-wiz-section-sub">
                            <strong>1 clic</strong> = Favorito (Verde) · <strong>2 clics</strong> =
                            Vetado (Rojo) · <strong>3 clics</strong> = Neutral:
                        </p>

                        <div className="d-flex flex-wrap gap-2">
                            {GENRE_LIST.map((genre) => {
                                const isFav = preferredGenres.includes(genre)
                                const isDisliked = dislikedGenres.includes(genre)
                                return (
                                    <button
                                        key={genre}
                                        type="button"
                                        onClick={() => cycleGenreState(genre)}
                                        className={`doki-wiz-genre-chip ${isFav ? 'fav' : ''} ${isDisliked ? 'veto' : ''}`}
                                    >
                                        {isFav && <ThumbsUp size={12} />}
                                        {isDisliked && <Ban size={12} />}
                                        {genre}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* =========================================================
                    PASO 3: ANIMES VISTOS QUE TE GUSTARON
                   ========================================================= */}
                {step === 3 && (
                    <div className="doki-wiz-panel">
                        <div className="doki-wiz-section-title">
                            <Tv size={17} />
                            <span>3. Animes que ya viste y te encantaron (Opcional)</span>
                        </div>
                        <p className="doki-wiz-section-sub">
                            Busca hasta 5 animes referentes para conocer tus gustos y excluirlos de
                            tus recomendaciones:
                        </p>

                        <div className="doki-wiz-search-wrap">
                            <div className="doki-wiz-search-box">
                                <Search size={17} className="text-secondary flex-shrink-0" />
                                <input
                                    type="text"
                                    className="doki-wiz-search-input"
                                    placeholder="Busca un anime que te haya gustado (ej: Death Note, Frieren, Attack on Titan...)"
                                    value={animeQuery}
                                    onChange={(e) => setAnimeQuery(e.target.value)}
                                />
                                {animeQuery && (
                                    <button
                                        type="button"
                                        className="btn btn-sm p-0 text-secondary border-0"
                                        onClick={() => setAnimeQuery('')}
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>

                            {animeQuery.trim().length >= 2 && (
                                <div className="doki-wiz-dropdown">
                                    {isSearchingAnimes ? (
                                        <div className="p-3 text-center text-secondary small">
                                            Buscando en el catálogo...
                                        </div>
                                    ) : animeResults.length === 0 ? (
                                        <div className="p-3 text-center text-secondary small">
                                            No encontramos animes con ese título.
                                        </div>
                                    ) : (
                                        animeResults.map((a) => {
                                            const already = selectedAnimes.some(
                                                (s) => s.mal_id === a.mal_id
                                            )
                                            return (
                                                <button
                                                    key={a.mal_id}
                                                    type="button"
                                                    disabled={already || selectedAnimes.length >= 5}
                                                    onClick={() => addWatchedAnime(a)}
                                                    className="doki-wiz-dropdown-item"
                                                >
                                                    <img
                                                        src={a.image_url}
                                                        alt={a.title}
                                                        style={{
                                                            width: '34px',
                                                            height: '46px',
                                                            objectFit: 'cover',
                                                            borderRadius: '6px',
                                                        }}
                                                    />
                                                    <div className="flex-grow-1 min-w-0">
                                                        <div className="fw-bold text-white small text-truncate">
                                                            {a.title}
                                                        </div>
                                                        <div
                                                            className="text-secondary text-truncate"
                                                            style={{ fontSize: '0.72rem' }}
                                                        >
                                                            {(a.genres || [])
                                                                .slice(0, 3)
                                                                .join(' · ')}
                                                        </div>
                                                    </div>
                                                    <span className="badge bg-dark border border-secondary text-warning">
                                                        ★ {a.score}
                                                    </span>
                                                    {already ? (
                                                        <Check size={16} className="text-success" />
                                                    ) : (
                                                        <Plus size={16} className="text-light" />
                                                    )}
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div
                            className="text-secondary fw-bold mb-2"
                            style={{ fontSize: '0.74rem', letterSpacing: '0.04em' }}
                        >
                            ANIMES SELECCIONADOS ({selectedAnimes.length}/5):
                        </div>
                        {selectedAnimes.length === 0 ? (
                            <div className="doki-wiz-empty-slot">
                                Aún no has añadido animes referentes. Si eres nuevo en el anime,
                                puedes pulsar <strong>Siguiente</strong> directamente.
                            </div>
                        ) : (
                            <div className="row g-2">
                                {selectedAnimes.map((a) => (
                                    <div key={a.mal_id} className="col-12 col-sm-6">
                                        <div className="doki-wiz-selected-card">
                                            <img
                                                src={a.image_url}
                                                alt={a.title}
                                                style={{
                                                    width: '38px',
                                                    height: '52px',
                                                    objectFit: 'cover',
                                                    borderRadius: '6px',
                                                }}
                                            />
                                            <div className="flex-grow-1 min-w-0">
                                                <div className="fw-bold text-white small text-truncate">
                                                    {a.title}
                                                </div>
                                                <div
                                                    className="text-secondary text-truncate"
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    {(a.genres || []).slice(0, 3).join(', ')}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeWatchedAnime(a.mal_id)}
                                                className="btn btn-sm p-0 text-secondary border-0"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* =========================================================
                    PASO 4: EXIGENCIAS DE CALIDAD
                   ========================================================= */}
                {step === 4 && (
                    <div className="doki-wiz-panel">
                        <div className="doki-wiz-section-title">
                            <Sparkles size={17} />
                            <span>Exigencias de Calidad</span>
                        </div>
                        <p className="doki-wiz-section-sub">
                            Filtros opcionales para adaptar las recomendaciones a tus estándares de producción y narrativa.
                        </p>

                        <div className="row g-2">
                            {EXTRA_FILTERS.map((f) => {
                                const active = extraFilters.includes(f.id)
                                return (
                                    <div key={f.id} className="col-12 col-sm-6">
                                        <button
                                            type="button"
                                            onClick={() => toggleExtraFilter(f.id)}
                                            className={`doki-wiz-choice-card d-flex align-items-center justify-content-between ${active ? 'active' : ''}`}
                                        >
                                            <span className="fw-semibold small text-white">
                                                {f.label}
                                            </span>
                                            {active ? (
                                                <Check size={15} />
                                            ) : (
                                                <Plus size={15} className="text-secondary" />
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Pie de navegación del Wizard (4 pasos, sin recomendar dentro del calibrador) */}
                <div className="doki-wiz-footer">
                    {step > 1 ? (
                        <button
                            type="button"
                            className="doki-wiz-btn-secondary"
                            onClick={() => goToStep(step - 1)}
                            disabled={isSaving}
                        >
                            <ChevronLeft size={16} /> Anterior
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 4 ? (
                        <button
                            type="button"
                            className="doki-wiz-btn-primary"
                            onClick={() => goToStep(step + 1)}
                        >
                            Siguiente <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="doki-wiz-btn-primary"
                            onClick={handleFinishAndSave}
                            disabled={isSaving}
                        >
                            <Check size={16} />{' '}
                            {isSaving ? 'Guardando...' : 'Guardar y Abrir Recomendador'}
                        </button>
                    )}
                </div>
            </div>
        </Dialogo>
    )
}
