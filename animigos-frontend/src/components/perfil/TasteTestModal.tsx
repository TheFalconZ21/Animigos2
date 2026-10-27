import React, { useState, useEffect } from 'react'
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Clapperboard,
    Search,
    Plus,
    X,
    Loader2,
    Star,
    BookmarkCheck,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { searchTmdbMovies } from '../../services/tmdbService'
import {
    searchTestAnimes,
    calibrateAndGetRecommendations,
    type CalibrateAnimeCandidate,
    type CalibratedRecommendation,
} from '../../services/recommenderApi'
import { ProfesorDoki, type DokiExpression } from '../doki/ProfesorDoki'
import { useMyList } from '../../hooks/useMyList'
import type { TasteTestAnswers, TmdbMovie } from './perfil-types'

const TROPES_OPTIONS = [
    { id: 'power_scaling', title: 'Torneo & Escalamiento de Poder', desc: 'Entrenamientos, técnicas secretas y superación.' },
    { id: 'enemies_lovers', title: 'Enemigos a Amantes', desc: 'Rivalidad que evoluciona hacia química genuina.' },
    { id: 'mastermind', title: 'Protagonista Estratega', desc: 'Duelos de inteligencia, trampas y ajedrez mental.' },
    { id: 'time_travel', title: 'Bucles & Viajes en el Tiempo', desc: 'Causas y consecuencias, realidades paralelas.' },
    { id: 'antihero', title: 'Antihéroe / Venganza', desc: 'Moral gris, justicia propia y objetivos implacables.' },
    { id: 'slice_cozy', title: 'Iyashikei / Paz Mental', desc: 'Historias reconfortantes, café, paisajes y calma.' },
    { id: 'dark_fantasy', title: 'Fantasía Oscura & Brutal', desc: 'Mundos hostiles donde nadie tiene armadura de guion.' },
    { id: 'psychological_twist', title: 'Misterio & Giros de Trama', desc: 'Nada es lo que parece hasta el último minuto.' },
]

const GENRES_ALL = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
    'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
]

const PACING_OPTIONS = [
    { id: 'fast_12', title: 'Ritmo Dinámico (12 episodios)', desc: 'Cero relleno, tramas condensadas que van al grano.' },
    { id: 'deep_24', title: 'Desarrollo Profundo (24+ episodios)', desc: 'Construcción de mundo paciente y arcos maduros.' },
    { id: 'movies', title: 'Películas de Gran Impacto', desc: 'Producción cinematográfica épica en 2 horas.' },
    { id: 'episodic', title: 'Autoconclusivo (Caso por Episodio)', desc: 'Fácil de pausar y retomar en cualquier momento.' },
]

const FILTER_OPTIONS = [
    { id: 'no_fanservice', label: 'Sin fanservice innecesario' },
    { id: 'allow_gore', label: 'Permitir violencia gráfica / gore maduro' },
    { id: 'conclusive_ending', label: 'Priorizar historias con final conclusivo' },
    { id: 'elite_ost', label: 'Banda sonora memorable (Hiroyuki Sawano, etc.)' },
    { id: 'modern_animation', label: 'Animación moderna (2018 en adelante)' },
]

interface TasteTestModalProps {
    open: boolean
    onClose: () => void
    initialAnswers?: TasteTestAnswers
    onComplete: (answers: TasteTestAnswers) => Promise<void>
}

export const TasteTestModal: React.FC<TasteTestModalProps> = ({
    open,
    onClose,
    initialAnswers,
    onComplete,
}) => {
    const { agregarAnime } = useMyList()
    const [step, setStep] = useState<number>(1)
    const [isSaving, setIsSaving] = useState<boolean>(false)
    const [isCalibrating, setIsCalibrating] = useState<boolean>(false)

    // Estados de respuestas
    const [selectedTropes, setSelectedTropes] = useState<string[]>(initialAnswers?.tropes || ['mastermind', 'dark_fantasy'])
    const [favGenres, setFavGenres] = useState<string[]>(initialAnswers?.favoriteGenres || ['Psychological', 'Action', 'Sci-Fi'])
    const [dislikedGenres, setDislikedGenres] = useState<string[]>(initialAnswers?.dislikedGenres || ['Horror'])
    const [pacing, setPacing] = useState<string>(initialAnswers?.pacing || 'fast_12')
    const [contentFilters, setContentFilters] = useState<string[]>(initialAnswers?.contentFilters || ['no_fanservice', 'conclusive_ending'])

    // Paso 1: Películas TMDB
    const [favoriteMovies, setFavoriteMovies] = useState<TmdbMovie[]>(initialAnswers?.favoriteMovies || [
        {
            id: 27205,
            title: 'El Origen (Inception)',
            originalTitle: 'Inception',
            releaseYear: '2010',
            posterPath: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
            genres: ['Ciencia ficción', 'Misterio', 'Acción'],
            overview: 'Un ladrón que roba secretos corporativos mediante tecnología de compartir sueños.',
        },
        {
            id: 335984,
            title: 'Blade Runner 2049',
            originalTitle: 'Blade Runner 2049',
            releaseYear: '2017',
            posterPath: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
            genres: ['Ciencia ficción', 'Drama', 'Misterio'],
            overview: 'Un blade runner descubre un secreto que podría sumergir a la sociedad en el caos.',
        },
    ])
    const [movieSearchQuery, setMovieSearchQuery] = useState('')
    const [movieSearchResults, setMovieSearchResults] = useState<TmdbMovie[]>([])
    const [isSearchingMovies, setIsSearchingMovies] = useState(false)

    // Paso 3: Animes ya vistos y favoritos
    const [likedAnimeList, setLikedAnimeList] = useState<CalibrateAnimeCandidate[]>([])
    const [animeSearchQuery, setAnimeSearchQuery] = useState('')
    const [animeSearchResults, setAnimeSearchResults] = useState<CalibrateAnimeCandidate[]>([])
    const [isSearchingAnimes, setIsSearchingAnimes] = useState(false)

    // Paso 5: Resultados de la calibración
    const [calibratedRecommendations, setCalibratedRecommendations] = useState<CalibratedRecommendation[]>([])
    const [addedAnimeIds, setAddedAnimeIds] = useState<number[]>([])

    // Debounce búsqueda TMDB
    useEffect(() => {
        if (!movieSearchQuery.trim()) {
            setMovieSearchResults([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingMovies(true)
            try {
                const results = await searchTmdbMovies(movieSearchQuery)
                setMovieSearchResults(results)
            } catch (err) {
                console.error('Error buscando películas en TMDB:', err)
            } finally {
                setIsSearchingMovies(false)
            }
        }, 320)
        return () => clearTimeout(timer)
    }, [movieSearchQuery])

    // Cargar animes iniciales sugeridos para el paso 3
    useEffect(() => {
        const fetchInitialAnimes = async () => {
            const initialList = await searchTestAnimes('')
            if (likedAnimeList.length === 0 && initialList.length > 0) {
                // Preseleccionar los dos primeros como favoritos por defecto si no hay nada
                setLikedAnimeList(initialList.slice(0, 2))
            }
            setAnimeSearchResults(initialList)
        }
        fetchInitialAnimes()
    }, [])

    // Búsqueda de animes con debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            setIsSearchingAnimes(true)
            try {
                const results = await searchTestAnimes(animeSearchQuery)
                setAnimeSearchResults(results)
            } catch (err) {
                console.error('Error buscando animes:', err)
            } finally {
                setIsSearchingAnimes(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [animeSearchQuery])

    // Helpers de mutación de listas
    const toggleTrope = (id: string) => {
        setSelectedTropes((prev) =>
            prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
        )
    }

    const toggleFavGenre = (g: string) => {
        if (dislikedGenres.includes(g)) {
            setDislikedGenres((prev) => prev.filter((x) => x !== g))
        }
        setFavGenres((prev) =>
            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
        )
    }

    const toggleDislikedGenre = (g: string) => {
        if (favGenres.includes(g)) {
            setFavGenres((prev) => prev.filter((x) => x !== g))
        }
        setDislikedGenres((prev) =>
            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
        )
    }

    const toggleFilter = (f: string) => {
        setContentFilters((prev) =>
            prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
        )
    }

    const addMovie = (movie: TmdbMovie) => {
        if (!favoriteMovies.some((m) => m.id === movie.id)) {
            setFavoriteMovies((prev) => [...prev, movie])
        }
        setMovieSearchQuery('')
        setMovieSearchResults([])
    }

    const removeMovie = (id: number) => {
        setFavoriteMovies((prev) => prev.filter((m) => m.id !== id))
    }

    const addLikedAnime = (anime: CalibrateAnimeCandidate) => {
        if (!likedAnimeList.some((a) => a.mal_id === anime.mal_id)) {
            setLikedAnimeList((prev) => [...prev, anime])
        }
    }

    const removeLikedAnime = (malId: number) => {
        setLikedAnimeList((prev) => prev.filter((a) => a.mal_id !== malId))
    }

    // Ejecutar calibración y avanzar a resultados
    const handleRunCalibration = async () => {
        setIsCalibrating(true)
        setStep(5)
        try {
            const likedIds = likedAnimeList.map((a) => a.mal_id)
            const recs = await calibrateAndGetRecommendations({
                tmdb_movies: favoriteMovies,
                liked_anime_ids: likedIds,
                favorite_genres: favGenres,
                disliked_genres: dislikedGenres,
                tropes: selectedTropes,
                pacing: pacing,
            })
            setCalibratedRecommendations(recs)
        } catch (err) {
            console.error('Error calculando recomendaciones de calibración:', err)
        } finally {
            setIsCalibrating(false)
        }
    }

    // Agregar anime recomendado a Mi Lista
    const handleAddRecToList = async (rec: CalibratedRecommendation) => {
        try {
            await agregarAnime({
                malId: rec.anime_id,
                estado: 'pendiente',
                nota: null,
                episodiosVistos: 0,
                favorito: false,
                tags: ['Calibrado Doki Doki', rec.anime_studio],
                comentario: `Recomendado por Profesor Doki Doki: ${rec.match_reason}`,
            })
            setAddedAnimeIds((prev) => [...prev, rec.anime_id])
        } catch (e) {
            console.error('Error agregando anime recomendado:', e)
        }
    }

    // Finalizar y Guardar Todo
    const handleFinishTest = async () => {
        setIsSaving(true)
        try {
            const finalScore = Math.min(
                100,
                50 +
                    (favoriteMovies.length > 0 ? 15 : 0) +
                    (likedAnimeList.length > 0 ? 15 : 0) +
                    (favGenres.length > 0 ? 10 : 0) +
                    (selectedTropes.length > 0 ? 10 : 0)
            )

            const finalAnswers: TasteTestAnswers = {
                tropes: selectedTropes,
                favoriteGenres: favGenres,
                dislikedGenres,
                pacing,
                contentFilters,
                favoriteMovies,
                likedAnimeIds: likedAnimeList.map((a) => a.mal_id),
                calibratedPercentage: finalScore,
            }

            await onComplete(finalAnswers)
            onClose()
            setStep(1)
        } catch (err) {
            console.error('Error completando test de gustos:', err)
        } finally {
            setIsSaving(false)
        }
    }

    // Determinar la expresión y diálogo del Profesor Doki según el paso
    const getDokiMeta = (): { expression: DokiExpression; dialogue: React.ReactNode } => {
        switch (step) {
            case 1:
                return {
                    expression: 'explicando',
                    dialogue: (
                        <span>
                            ¡Konnichiwa! Soy el <strong>Profesor Doki Doki</strong>. Para empezar, escribe de <strong>1 a 5 de tus películas o series favoritas de cine/TV</strong>. ¡Extraeré su ADN desde TMDB para hallar animes con el mismo impacto!
                        </span>
                    ),
                }
            case 2:
                return {
                    expression: 'emocionado_serio',
                    dialogue: (
                        <span>
                            ¡Gran selección! Ahora selecciona los <strong>tropos narrativos y géneros</strong> que te aceleran el pulso. Puedes marcar en verde los que amas y en rojo los que prefieres evitar.
                        </span>
                    ),
                }
            case 3:
                return {
                    expression: 'emocionado_feliz',
                    dialogue: (
                        <span>
                            ¡Este es el paso más crucial! Dime <strong>qué animes ya viste y te fascinaron</strong>. Con esto rastrearé el mismo <strong>estudio de animación, autor, año y joyas de alta nota</strong> para ti.
                        </span>
                    ),
                }
            case 4:
                return {
                    expression: 'pensando',
                    dialogue: (
                        <span>
                            ¡Casi listos! Dime tu <strong>ritmo y duración preferida</strong> para maratonear, además de filtros especiales de contenido (como historias con final cerrado o cero relleno).
                        </span>
                    ),
                }
            case 5:
            default:
                return {
                    expression: 'celebracion',
                    dialogue: (
                        <span>
                            ¡Eureka! Mi algoritmo neuronal ha cruzado tus animes vistos con tus películas de TMDB. Aquí tienes tus <strong>recomendaciones supremas con alta nota y afinidad</strong>. ¡Agrégalas a tu lista!
                        </span>
                    ),
                }
        }
    }

    const dokiMeta = getDokiMeta()

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Calibrador de Preferencias Anime · Profesor Doki Doki" ancho={740}>
            <div className="p-3 p-md-4 d-flex flex-column gap-3">
                {/* Cabecera del Wizard */}
                <div className="d-flex align-items-center justify-content-between border-bottom pb-3" style={{ borderColor: 'var(--perfil-border)' }}>
                    <div>
                        <div className="d-flex align-items-center gap-1.5 mb-1">
                            <Sparkles size={14} style={{ color: 'var(--perfil-acento)' }} />
                            <span className="ml-eyebrow">LABORATORIO NEURONAL · ANIMIGOS x TMDB</span>
                        </div>
                        <h3 className="h5 fw-bold text-white mb-0">Calibrador de Preferencias</h3>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <span className="small text-white fw-semibold">Paso {step} de 5</span>
                        <div className="d-flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor:
                                            i === step
                                                ? 'var(--perfil-acento)'
                                                : i < step
                                                ? 'var(--perfil-green)'
                                                : 'rgba(255,255,255,0.15)',
                                        transition: 'background-color 0.2s ease',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Asistente Profesor Doki Doki con Burbuja de Diálogo Reactiva */}
                <ProfesorDoki
                    size="md"
                    expression={dokiMeta.expression}
                    dialogue={dokiMeta.dialogue}
                    badgeText={`Paso ${step}`}
                />

                {/* PASO 1: PELÍCULAS Y SERIES TMDB */}
                {step === 1 && (
                    <div className="py-1">
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Clapperboard size={16} style={{ color: 'var(--perfil-cyan)' }} />
                            <h4 className="h6 fw-bold text-white mb-0">1. Películas o Series de Cine/TV Favoritas (TMDB)</h4>
                        </div>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Busca obras que te hayan fascinado (ej: <em>Inception, Interstellar, The Matrix, Blade Runner, Dune, Severance...</em>).
                        </p>

                        <div className="position-relative mb-3">
                            <div className="d-flex align-items-center position-relative">
                                <Search size={15} className="position-absolute start-0 ms-3 text-secondary" />
                                <input
                                    type="text"
                                    className="cat-search-control w-100 ps-5"
                                    placeholder="Buscar película o serie en TMDB..."
                                    value={movieSearchQuery}
                                    onChange={(e) => setMovieSearchQuery(e.target.value)}
                                />
                                {isSearchingMovies && (
                                    <Loader2 size={16} className="position-absolute end-0 me-3 text-secondary" style={{ animation: 'spin 1s linear infinite' }} />
                                )}
                            </div>

                            {/* Dropdown de resultados TMDB */}
                            {movieSearchResults.length > 0 && (
                                <div
                                    className="position-absolute start-0 end-0 mt-1 rounded-3 border shadow-lg overflow-hidden z-3"
                                    style={{
                                        background: 'var(--perfil-card)',
                                        borderColor: 'var(--perfil-border-strong)',
                                        maxHeight: '220px',
                                        overflowY: 'auto',
                                    }}
                                >
                                    {movieSearchResults.map((movie) => (
                                        <div
                                            key={movie.id}
                                            onClick={() => addMovie(movie)}
                                            className="p-2 d-flex align-items-center gap-2.5 border-bottom border-dark"
                                            style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--perfil-card-2)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            <img
                                                src={movie.posterPath || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'}
                                                alt=""
                                                className="rounded"
                                                style={{ width: 34, height: 48, objectFit: 'cover' }}
                                            />
                                            <div className="flex-grow-1 min-w-0">
                                                <div className="small fw-bold text-white text-truncate">
                                                    {movie.title} {movie.releaseYear && `(${movie.releaseYear})`}
                                                </div>
                                                <div className="small text-secondary text-truncate" style={{ fontSize: '0.72rem' }}>
                                                    {movie.genres.join(', ') || movie.overview}
                                                </div>
                                            </div>
                                            <Plus size={16} className="text-secondary" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lista de películas seleccionadas */}
                        <div>
                            <span className="small text-secondary fw-semibold d-block mb-2">
                                TUS OBRAS REGISTRADAS ({favoriteMovies.length}):
                            </span>

                            {favoriteMovies.length === 0 ? (
                                <div className="p-3 rounded-2 text-center small text-secondary border border-dashed border-secondary-subtle">
                                    Agrega al menos una película o serie para extraer sus temas y sinopsis.
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {favoriteMovies.map((movie) => (
                                        <div
                                            key={movie.id}
                                            className="p-2 rounded-3 border d-flex align-items-center justify-content-between gap-2"
                                            style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                                        >
                                            <div className="d-flex align-items-center gap-2.5 min-w-0">
                                                <img
                                                    src={movie.posterPath || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'}
                                                    alt=""
                                                    className="rounded"
                                                    style={{ width: 32, height: 44, objectFit: 'cover' }}
                                                />
                                                <div className="min-w-0">
                                                    <div className="small fw-bold text-white text-truncate">
                                                        {movie.title} {movie.releaseYear && `(${movie.releaseYear})`}
                                                    </div>
                                                    <div className="small text-secondary text-truncate" style={{ fontSize: '0.72rem' }}>
                                                        TMDB: {movie.genres.join(', ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeMovie(movie.id)}
                                                className="btn btn-link text-secondary p-1"
                                                title="Eliminar"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PASO 2: GÉNEROS Y TROPOS */}
                {step === 2 && (
                    <div className="py-1">
                        <h4 className="h6 fw-bold text-white mb-1">2. Arquetipos Narrativos y Géneros</h4>
                        <p className="small mb-2" style={{ color: 'var(--perfil-text-muted)' }}>
                            Selecciona los tropos que te enganchan de inmediato:
                        </p>
                        <div className="row g-2 mb-3" style={{ maxHeight: 180, overflowY: 'auto' }}>
                            {TROPES_OPTIONS.map((t) => {
                                const isSelected = selectedTropes.includes(t.id)
                                return (
                                    <div key={t.id} className="col-12 col-sm-6">
                                        <div
                                            className={`perfil-trope-card ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => toggleTrope(t.id)}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <span className="fw-semibold small text-white">{t.title}</span>
                                                <div
                                                    style={{
                                                        width: 18,
                                                        height: 18,
                                                        borderRadius: 4,
                                                        border: isSelected ? 'none' : '1px solid var(--perfil-border)',
                                                        background: isSelected ? 'var(--perfil-acento)' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#000',
                                                    }}
                                                >
                                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                                </div>
                                            </div>
                                            <p className="small mb-0" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.73rem' }}>
                                                {t.desc}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Géneros Favoritos y Vetados */}
                        <span className="small text-secondary fw-semibold d-block mb-1.5">
                            GÉNEROS FAVORITOS (VERDE) Y VETADOS (ROJO):
                        </span>
                        <div className="d-flex flex-wrap gap-1.5">
                            {GENRES_ALL.map((g) => {
                                const isFav = favGenres.includes(g)
                                const isDisliked = dislikedGenres.includes(g)
                                return (
                                    <div key={g} className="btn-group btn-group-sm">
                                        <button
                                            type="button"
                                            onClick={() => toggleFavGenre(g)}
                                            className={`btn btn-sm ${isFav ? 'btn-success' : 'btn-dark border-secondary'}`}
                                            style={{ fontSize: '0.72rem' }}
                                        >
                                            <ThumbsUp size={11} className="me-1" />
                                            {g}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleDislikedGenre(g)}
                                            className={`btn btn-sm ${isDisliked ? 'btn-danger' : 'btn-dark border-secondary'}`}
                                            title={`Vetar ${g}`}
                                        >
                                            <ThumbsDown size={11} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* PASO 3: ANIMES QUE YA VISTE Y TE ENCANTARON */}
                {step === 3 && (
                    <div className="py-1">
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Star size={16} style={{ color: 'var(--perfil-amber)' }} />
                            <h4 className="h6 fw-bold text-white mb-0">3. Animes que ya viste y te encantaron</h4>
                        </div>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            El recomendador usará estos animes para encontrar obras del <strong>mismo estudio, misma era y con alto reconocimiento de la comunidad</strong> (y no te recomendará estos que ya viste).
                        </p>

                        <div className="position-relative mb-3">
                            <div className="d-flex align-items-center position-relative">
                                <Search size={15} className="position-absolute start-0 ms-3 text-secondary" />
                                <input
                                    type="text"
                                    className="cat-search-control w-100 ps-5"
                                    placeholder="Buscar anime que ya viste (ej: Death Note, Attack on Titan, Steins;Gate...)"
                                    value={animeSearchQuery}
                                    onChange={(e) => setAnimeSearchQuery(e.target.value)}
                                />
                                {isSearchingAnimes && (
                                    <Loader2 size={16} className="position-absolute end-0 me-3 text-secondary" style={{ animation: 'spin 1s linear infinite' }} />
                                )}
                            </div>

                            {/* Resultados de animes */}
                            {animeSearchResults.length > 0 && (
                                <div
                                    className="mt-2 rounded-3 border p-2"
                                    style={{
                                        background: 'var(--perfil-card)',
                                        borderColor: 'var(--perfil-border)',
                                        maxHeight: 180,
                                        overflowY: 'auto',
                                    }}
                                >
                                    <div className="row g-2">
                                        {animeSearchResults.map((a) => {
                                            const isSelected = likedAnimeList.some((item) => item.mal_id === a.mal_id)
                                            return (
                                                <div key={a.mal_id} className="col-12 col-sm-6">
                                                    <div
                                                        className={`p-2 rounded-2 border d-flex align-items-center justify-content-between gap-2 ${
                                                            isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'
                                                        }`}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => (isSelected ? removeLikedAnime(a.mal_id) : addLikedAnime(a))}
                                                    >
                                                        <div className="d-flex align-items-center gap-2 min-w-0">
                                                            <img
                                                                src={a.image_url}
                                                                alt=""
                                                                className="rounded"
                                                                style={{ width: 28, height: 38, objectFit: 'cover' }}
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="small fw-bold text-white text-truncate" style={{ fontSize: '0.74rem' }}>
                                                                    {a.title}
                                                                </div>
                                                                <div className="small text-secondary font-mono" style={{ fontSize: '0.68rem' }}>
                                                                    ★ {a.score} · {a.studio || 'Estudio N/A'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button type="button" className={`btn btn-sm p-1 ${isSelected ? 'text-primary' : 'text-secondary'}`}>
                                                            {isSelected ? <Check size={14} /> : <Plus size={14} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Animes seleccionados */}
                        <div>
                            <span className="small text-secondary fw-semibold d-block mb-1.5">
                                ANIMES MARCADOS COMO VISTOS Y FAVORITOS ({likedAnimeList.length}):
                            </span>
                            <div className="d-flex flex-wrap gap-1.5" style={{ maxHeight: 110, overflowY: 'auto' }}>
                                {likedAnimeList.map((a) => (
                                    <span
                                        key={a.mal_id}
                                        className="badge bg-dark border border-secondary text-white py-1 px-2 d-inline-flex align-items-center gap-1.5"
                                        style={{ fontSize: '0.72rem' }}
                                    >
                                        <BookmarkCheck size={12} className="text-success" />
                                        <span>{a.title}</span>
                                        <X
                                            size={12}
                                            className="text-secondary"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => removeLikedAnime(a.mal_id)}
                                        />
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* PASO 4: RITMO Y FILTROS */}
                {step === 4 && (
                    <div className="py-1">
                        <h4 className="h6 fw-bold text-white mb-1">4. Ritmo y Filtros de Contenido</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Elige la cadencia de episodios que mejor encaje con tu tiempo libre:
                        </p>
                        <div className="row g-2 mb-3">
                            {PACING_OPTIONS.map((p) => {
                                const isSelected = pacing === p.id
                                return (
                                    <div key={p.id} className="col-12 col-sm-6">
                                        <div
                                            className={`perfil-trope-card ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => setPacing(p.id)}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <span className="fw-semibold small text-white">{p.title}</span>
                                                <div
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: '50%',
                                                        border: isSelected ? 'none' : '1px solid var(--perfil-border)',
                                                        background: isSelected ? 'var(--perfil-acento)' : 'transparent',
                                                    }}
                                                />
                                            </div>
                                            <p className="small mb-0" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.72rem' }}>
                                                {p.desc}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <span className="small text-secondary fw-semibold d-block mb-1.5">FILTROS DE RECOMENDACIÓN:</span>
                        <div className="d-flex flex-wrap gap-2">
                            {FILTER_OPTIONS.map((f) => {
                                const isSelected = contentFilters.includes(f.id)
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => toggleFilter(f.id)}
                                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-dark border-secondary'}`}
                                        style={{ fontSize: '0.74rem' }}
                                    >
                                        {isSelected && <Check size={12} className="me-1" />}
                                        {f.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* PASO 5: RESULTADOS DE CALIBRACIÓN */}
                {step === 5 && (
                    <div className="py-1">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-1.5">
                                <Sparkles size={16} style={{ color: 'var(--perfil-acento)' }} />
                                <span>Recomendaciones Personalizadas por el Profesor Doki Doki</span>
                            </h4>
                            <span className="badge bg-success-subtle text-success border border-success-subtle small">
                                100% Calibrado
                            </span>
                        </div>

                        {isCalibrating ? (
                            <div className="py-5 text-center">
                                <Loader2 size={32} className="text-secondary mb-2" style={{ animation: 'spin 1s linear infinite' }} />
                                <h5 className="h6 text-white">Sintetizando Afinidades Multidimensionales...</h5>
                                <p className="small text-secondary">
                                    El Profesor Doki Doki está cruzando el ADN de tus películas con tus animes favoritos.
                                </p>
                            </div>
                        ) : (
                            <div className="row g-2" style={{ maxHeight: 330, overflowY: 'auto' }}>
                                {calibratedRecommendations.slice(0, 6).map((rec) => {
                                    const isAdded = addedAnimeIds.includes(rec.anime_id)
                                    return (
                                        <div key={rec.anime_id} className="col-12 col-sm-6">
                                            <div
                                                className="p-2.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                                                style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                                            >
                                                <div>
                                                    <div className="d-flex gap-2.5 mb-2">
                                                        <img
                                                            src={rec.anime_poster}
                                                            alt={rec.anime_title}
                                                            className="rounded"
                                                            style={{ width: 44, height: 60, objectFit: 'cover' }}
                                                        />
                                                        <div className="min-w-0 flex-grow-1">
                                                            <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                                                <span className="badge bg-primary small py-0.5 px-1.5" style={{ fontSize: '0.68rem' }}>
                                                                    {rec.affinity_score}% Afinidad
                                                                </span>
                                                                <span className="small text-warning font-mono" style={{ fontSize: '0.72rem' }}>
                                                                    ★ {rec.anime_score}
                                                                </span>
                                                            </div>
                                                            <h6 className="small fw-bold text-white mb-0 text-truncate" title={rec.anime_title}>
                                                                {rec.anime_title}
                                                            </h6>
                                                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                                                {rec.anime_studio} {rec.season_year && `(${rec.season_year})`}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p className="small mb-2" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.71rem', lineHeight: 1.35 }}>
                                                        {rec.match_reason}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleAddRecToList(rec)}
                                                    disabled={isAdded}
                                                    className={`ml-btn ${isAdded ? 'ml-btn-fantasma' : 'ml-btn-acento'} ml-btn-sm w-100 justify-content-center py-1`}
                                                    style={{ fontSize: '0.72rem' }}
                                                >
                                                    {isAdded ? (
                                                        <>
                                                            <Check size={12} className="text-success" />
                                                            <span>En tu Lista</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus size={12} />
                                                            <span>Agregar a Mi Lista</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer del Wizard */}
                <div className="d-flex align-items-center justify-content-between border-top pt-3" style={{ borderColor: 'var(--perfil-border)' }}>
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep((s) => s - 1)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                            disabled={isSaving || isCalibrating}
                        >
                            <ChevronLeft size={14} />
                            <span>Anterior</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="d-flex align-items-center gap-2">
                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={() => setStep((s) => s + 1)}
                                className="ml-btn ml-btn-acento ml-btn-sm"
                            >
                                <span>Siguiente</span>
                                <ChevronRight size={14} />
                            </button>
                        ) : step === 4 ? (
                            <button
                                type="button"
                                onClick={handleRunCalibration}
                                disabled={isCalibrating}
                                className="ml-btn ml-btn-acento ml-btn-sm"
                            >
                                <Sparkles size={14} />
                                <span>{isCalibrating ? 'Calibrando...' : 'Calibrar con Profesor Doki Doki'}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleFinishTest}
                                disabled={isSaving}
                                className="ml-btn ml-btn-acento ml-btn-sm"
                            >
                                <Check size={14} />
                                <span>{isSaving ? 'Guardando...' : 'Guardar y Finalizar'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Dialogo>
    )
}
