import React, { useState, useEffect } from 'react'
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Zap,
    Clapperboard,
    Search,
    Plus,
    X,
    Loader2,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { searchTmdbMovies } from '../../services/tmdbService'
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
    { id: 'deep_24', title: 'Desarrollo Profundo (24+ episodios)', desc: 'Construcción de mundo paciente y arcos de personajes maduros.' },
    { id: 'movies', title: 'Películas de Gran Impacto', desc: 'Producción de alta escala cinematográfica en 2 horas.' },
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
    const [step, setStep] = useState<number>(1)
    const [isSaving, setIsSaving] = useState<boolean>(false)

    const [selectedTropes, setSelectedTropes] = useState<string[]>(initialAnswers?.tropes || ['mastermind', 'dark_fantasy'])
    const [favGenres, setFavGenres] = useState<string[]>(initialAnswers?.favoriteGenres || ['Psychological', 'Action', 'Sci-Fi'])
    const [dislikedGenres, setDislikedGenres] = useState<string[]>(initialAnswers?.dislikedGenres || ['Horror'])
    const [pacing, setPacing] = useState<string>(initialAnswers?.pacing || 'fast_12')
    const [contentFilters, setContentFilters] = useState<string[]>(initialAnswers?.contentFilters || ['no_fanservice', 'conclusive_ending'])

    // Películas TMDB
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

    // Búsqueda en TMDB con debounce
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
            } finally {
                setIsSearchingMovies(false)
            }
        }, 250)

        return () => clearTimeout(timer)
    }, [movieSearchQuery])

    const addMovie = (movie: TmdbMovie) => {
        if (!favoriteMovies.some((m) => m.id === movie.id)) {
            setFavoriteMovies([...favoriteMovies, movie])
        }
        setMovieSearchQuery('')
        setMovieSearchResults([])
    }

    const removeMovie = (movieId: number) => {
        setFavoriteMovies(favoriteMovies.filter((m) => m.id !== movieId))
    }

    const toggleTrope = (id: string) => {
        setSelectedTropes((prev) =>
            prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
        )
    }

    const toggleFavGenre = (g: string) => {
        setFavGenres((prev) =>
            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
        )
        setDislikedGenres((prev) => prev.filter((x) => x !== g))
    }

    const toggleDislikedGenre = (g: string) => {
        setDislikedGenres((prev) =>
            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
        )
        setFavGenres((prev) => prev.filter((x) => x !== g))
    }

    const toggleFilter = (id: string) => {
        setContentFilters((prev) =>
            prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
        )
    }

    const handleFinish = async () => {
        setIsSaving(true)
        try {
            await onComplete({
                tropes: selectedTropes,
                favoriteGenres: favGenres,
                dislikedGenres,
                pacing,
                contentFilters,
                favoriteMovies,
                calibratedPercentage: 100,
            })
            onClose()
            setStep(1)
        } catch (err) {
            console.error('Error completando test de gustos:', err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Test de Preferencias Anime e IA (TMDB)" ancho={640}>
            <div className="p-4 d-flex flex-column gap-3">
                {/* Cabecera del Wizard */}
                <div className="d-flex align-items-center justify-content-between border-bottom pb-3" style={{ borderColor: 'var(--perfil-border)' }}>
                    <div>
                        <div className="d-flex align-items-center gap-1.5 mb-1">
                            <Sparkles size={14} style={{ color: 'var(--perfil-acento)' }} />
                            <span className="ml-eyebrow">RECOMENDADOR NEURONAL · TMDB x ANIMIGOS</span>
                        </div>
                        <h3 className="h5 fw-bold text-white mb-0">Calibrador de Gustos</h3>
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
                                        backgroundColor: i === step ? 'var(--perfil-acento)' : i < step ? 'var(--perfil-green)' : 'rgba(255,255,255,0.15)',
                                        transition: 'background-color 0.2s ease',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* PASO 1: TROPOS Y ARQUETIPOS */}
                {step === 1 && (
                    <div className="py-2">
                        <h4 className="h6 fw-bold text-white mb-1">1. ¿Qué tropos y dinámicas te enganchan más?</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Selecciona los arquetipos narrativos que hacen que no puedas soltar una historia.
                        </p>
                        <div className="row g-2">
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
                    </div>
                )}

                {/* PASO 2: GÉNEROS FAVORITOS & VETADOS */}
                {step === 2 && (
                    <div className="py-2">
                        <h4 className="h6 fw-bold text-white mb-1">2. Géneros Favoritos y Filtros de Descarte</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Indica qué géneros amas (<ThumbsUp size={12} className="text-success" />) y cuáles prefieres evitar (<ThumbsDown size={12} className="text-danger" />).
                        </p>

                        <div className="mb-3">
                            <span className="small text-secondary fw-semibold d-block mb-2">TUS GÉNEROS FAVORITOS:</span>
                            <div className="d-flex flex-wrap gap-1.5">
                                {GENRES_ALL.map((g) => {
                                    const isFav = favGenres.includes(g)
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => toggleFavGenre(g)}
                                            className="ml-chip"
                                            aria-pressed={isFav}
                                            style={{
                                                borderColor: isFav ? 'var(--perfil-acento)' : undefined,
                                                background: isFav ? 'var(--perfil-acento-soft)' : undefined,
                                                color: isFav ? '#ffffff' : undefined,
                                            }}
                                        >
                                            {isFav && <Check size={12} className="me-1 text-success" />}
                                            {g}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <span className="small text-secondary fw-semibold d-block mb-2">GÉNEROS QUE DESEAS EXCLUIR:</span>
                            <div className="d-flex flex-wrap gap-1.5">
                                {GENRES_ALL.map((g) => {
                                    const isDisliked = dislikedGenres.includes(g)
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => toggleDislikedGenre(g)}
                                            className="ml-chip"
                                            aria-pressed={isDisliked}
                                            style={{
                                                borderColor: isDisliked ? 'var(--perfil-pink)' : undefined,
                                                background: isDisliked ? 'var(--perfil-pink-soft)' : undefined,
                                                color: isDisliked ? 'var(--perfil-pink)' : undefined,
                                            }}
                                        >
                                            {isDisliked && <ThumbsDown size={11} className="me-1 text-danger" />}
                                            {g}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* PASO 3: PELÍCULAS FAVORITAS DE CINE (TMDB) */}
                {step === 3 && (
                    <div className="py-2">
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Clapperboard size={16} style={{ color: 'var(--perfil-cyan)' }} />
                            <h4 className="h6 fw-bold text-white mb-0">3. Películas Favoritas de Cine (Cruce TMDB)</h4>
                        </div>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Extraemos automáticamente los géneros, temas y sinopsis de <strong>The Movie Database (TMDB)</strong> para cruzarlos con el catálogo de anime y darte recomendaciones perfectas.
                        </p>

                        {/* Buscador de Películas TMDB */}
                        <div className="position-relative mb-3">
                            <div className="d-flex align-items-center position-relative">
                                <Search size={15} className="position-absolute start-0 ms-3 text-secondary" />
                                <input
                                    type="text"
                                    className="cat-search-control w-100 ps-5"
                                    placeholder="Buscar película en TMDB (ej: Inception, Interstellar, Blade Runner, Dune...)"
                                    value={movieSearchQuery}
                                    onChange={(e) => setMovieSearchQuery(e.target.value)}
                                />
                                {isSearchingMovies && (
                                    <Loader2 size={16} className="position-absolute end-0 me-3 text-secondary" style={{ animation: 'spin 1s linear infinite' }} />
                                )}
                            </div>

                            {/* Dropdown de resultados de búsqueda */}
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
                                TUS PELÍCULAS REGISTRADAS PARA EL CRUCE ({favoriteMovies.length}):
                            </span>

                            {favoriteMovies.length === 0 ? (
                                <div className="p-3 rounded-2 text-center small text-secondary border border-dashed border-secondary-subtle">
                                    Agrega al menos una película para cruzarla con los animes de la plataforma.
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
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
                                                title="Eliminar película"
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

                {/* PASO 4: RITMO NARRATIVO & FORMATO */}
                {step === 4 && (
                    <div className="py-2">
                        <h4 className="h6 fw-bold text-white mb-1">4. Ritmo Narrativo y Duración Ideal</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            El recomendador priorizará series con la cadencia de capítulos que mejor se adapte a tu rutina.
                        </p>
                        <div className="d-flex flex-column gap-2">
                            {PACING_OPTIONS.map((p) => {
                                const isSelected = pacing === p.id
                                return (
                                    <div
                                        key={p.id}
                                        className={`perfil-trope-card ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => setPacing(p.id)}
                                    >
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="fw-semibold small text-white d-flex align-items-center gap-2">
                                                <Zap size={14} style={{ color: isSelected ? 'var(--perfil-acento)' : 'var(--perfil-text-dim)' }} />
                                                {p.title}
                                            </span>
                                            <div
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: '50%',
                                                    border: isSelected ? '5px solid var(--perfil-acento)' : '1px solid var(--perfil-border)',
                                                    background: '#ffffff',
                                                }}
                                            />
                                        </div>
                                        <p className="small mb-0 ps-4" style={{ color: 'var(--perfil-text-dim)', fontSize: '0.74rem' }}>
                                            {p.desc}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* PASO 5: FILTROS DE CONTENIDO Y REGLAS */}
                {step === 5 && (
                    <div className="py-2">
                        <h4 className="h6 fw-bold text-white mb-1">5. Filtros de Calidad y Preferencias Finales</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Ajusta los últimos filtros de contenido para garantizar recomendaciones 100% afinadas.
                        </p>
                        <div className="d-flex flex-column gap-2">
                            {FILTER_OPTIONS.map((f) => {
                                const isChecked = contentFilters.includes(f.id)
                                return (
                                    <div
                                        key={f.id}
                                        className={`perfil-switch-wrap ${isChecked ? 'border-primary' : ''}`}
                                        onClick={() => toggleFilter(f.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span className="small fw-semibold text-white">{f.label}</span>
                                        <button
                                            type="button"
                                            className={`perfil-pill-toggle ${isChecked ? 'is-on' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                toggleFilter(f.id)
                                            }}
                                        >
                                            <span className="perfil-pill-handle" />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Controles del Wizard */}
                <div className="d-flex align-items-center justify-content-between pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={() => setStep(step - 1)}
                            className="ml-btn ml-btn-fantasma ml-btn-sm"
                        >
                            <ChevronLeft size={15} />
                            <span>Atrás</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 5 ? (
                        <button
                            type="button"
                            onClick={() => setStep(step + 1)}
                            className="ml-btn ml-btn-acento ml-btn-sm"
                        >
                            <span>Siguiente</span>
                            <ChevronRight size={15} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={handleFinish}
                            className="ml-btn ml-btn-acento ml-btn-sm"
                        >
                            <Sparkles size={15} />
                            <span>{isSaving ? 'Cruzando TMDB x Anime...' : 'Guardar y Calibrar IA al 100%'}</span>
                        </button>
                    )}
                </div>
            </div>
        </Dialogo>
    )
}
