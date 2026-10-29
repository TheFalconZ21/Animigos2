import React, { useState, useEffect } from 'react'
import {
    Sparkles,
    Brain,
    CheckCircle2,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Plus,
    Check,
    RotateCcw,
    Loader2,
} from 'lucide-react'
import { ProfesorDoki } from '../doki/ProfesorDoki'
import { useMyList } from '../../hooks/useMyList'
import {
    calibrateAndGetRecommendations,
    type CalibratedRecommendation,
} from '../../services/recommenderApi'
import type { TasteTestAnswers } from './perfil-types'

const STORAGE_CALIBRATED_RECS_KEY = 'animigos_calibrated_recs'

interface TasteTestBannerProps {
    answers: TasteTestAnswers
    onOpenWizard: () => void
    recommendations?: CalibratedRecommendation[]
}

export const TasteTestBanner: React.FC<TasteTestBannerProps> = ({
    answers,
    onOpenWizard,
    recommendations: initialRecs,
}) => {
    const { agregarAnime, filas } = useMyList()
    const isCalibrated = answers.calibratedPercentage >= 90

    // Lista de recomendaciones calibradas
    const [recs, setRecs] = useState<CalibratedRecommendation[]>(() => {
        if (initialRecs && initialRecs.length > 0) return initialRecs
        try {
            const saved = localStorage.getItem(STORAGE_CALIBRATED_RECS_KEY)
            if (saved) return JSON.parse(saved)
        } catch {}
        return []
    })

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isLoadingRecs, setIsLoadingRecs] = useState(false)
    const [addedAnimeIds, setAddedAnimeIds] = useState<number[]>([])

    // Sincronizar si entran nuevas recomendaciones por prop
    useEffect(() => {
        if (initialRecs && initialRecs.length > 0) {
            setRecs(initialRecs)
        }
    }, [initialRecs])

    // Cargar recomendaciones si está calibrado pero no hay recomendaciones en memoria
    useEffect(() => {
        let isMounted = true
        const fetchMissingRecs = async () => {
            if (isCalibrated && recs.length === 0 && !isLoadingRecs) {
                setIsLoadingRecs(true)
                try {
                    const data = await calibrateAndGetRecommendations({
                        tmdb_movies: answers.favoriteMovies || [],
                        liked_anime_ids: answers.likedAnimeIds || [],
                        favorite_genres: answers.favoriteGenres || [],
                        disliked_genres: answers.dislikedGenres || [],
                        tropes: answers.tropes || [],
                        pacing: answers.pacing || '',
                    })
                    if (isMounted && data.length > 0) {
                        setRecs(data)
                        localStorage.setItem(STORAGE_CALIBRATED_RECS_KEY, JSON.stringify(data))
                    }
                } catch (e) {
                    console.error('Error cargando recomendaciones en banner:', e)
                } finally {
                    if (isMounted) setIsLoadingRecs(false)
                }
            }
        }
        fetchMissingRecs()
        return () => {
            isMounted = false
        }
    }, [isCalibrated, recs.length, answers])

    // Detectar animes que ya están en Mi Lista
    const activeRec = recs[currentIndex]
    const isInList = activeRec
        ? addedAnimeIds.includes(activeRec.anime_id) ||
          filas.some((f) => f.malId === activeRec.anime_id)
        : false

    const handleNext = () => {
        if (recs.length === 0) return
        setCurrentIndex((prev) => (prev + 1) % recs.length)
    }

    const handlePrev = () => {
        if (recs.length === 0) return
        setCurrentIndex((prev) => (prev - 1 + recs.length) % recs.length)
    }

    const handleAddToList = async () => {
        if (!activeRec || isInList) return
        try {
            await agregarAnime({
                malId: activeRec.anime_id,
                estado: 'pendiente',
                nota: null,
                episodiosVistos: 0,
                favorito: false,
                tags: ['Recomendación Doki Doki', activeRec.anime_studio],
                comentario: `Recomendado por Profesor Doki Doki: ${activeRec.match_reason}`,
            })
            setAddedAnimeIds((prev) => [...prev, activeRec.anime_id])
        } catch (err) {
            console.error('Error agregando anime desde banner:', err)
        }
    }

    // =========================================================================
    // ESTADO A: PERFIL CALIBRADO -> CARD DE RECOMENDACIONES CON ITERADOR Y RECALIBRAR
    // =========================================================================
    if (isCalibrated) {
        return (
            <div className="perfil-taste-card">
                {/* Cabecera de la card con opción de recalibrar arriba a la derecha */}
                <div className="d-flex align-items-center justify-content-between gap-3 mb-3 pb-2 border-bottom border-dark position-relative z-1">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <div
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    background: 'var(--perfil-acento-soft)',
                                    border: '1px solid var(--perfil-acento-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--perfil-acento)',
                                }}
                            >
                                <Brain size={14} />
                            </div>
                            <span className="ml-eyebrow">RECOMENDADOR NEURONAL · PROFESOR DOKI DOKI</span>
                            <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle px-2 py-0.5 small d-inline-flex align-items-center gap-1 font-mono" style={{ fontSize: '0.68rem' }}>
                                <CheckCircle2 size={10} /> 100% Calibrado
                            </span>
                        </div>
                        <h3 className="h5 fw-bold text-white mb-0">
                            Recomendaciones de Anime para ti
                        </h3>
                        {answers.favoriteMovies && answers.favoriteMovies.length > 0 && (
                            <div className="d-flex flex-wrap align-items-center gap-1.5 mt-2">
                                <span className="text-secondary small me-1" style={{ fontSize: '0.72rem' }}>Obras de referencia:</span>
                                {answers.favoriteMovies.map((m) => (
                                    <span
                                        key={`${m.mediaType || 'm'}-${m.id}`}
                                        className="badge rounded-pill border px-2 py-0.5"
                                        style={{
                                            fontSize: '0.68rem',
                                            backgroundColor: m.mediaType === 'tv' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                                            color: m.mediaType === 'tv' ? '#38bdf8' : '#c084fc',
                                            borderColor: m.mediaType === 'tv' ? 'rgba(56, 189, 248, 0.28)' : 'rgba(168, 85, 247, 0.28)',
                                        }}
                                    >
                                        {m.mediaType === 'tv' ? '📺 ' : '🎬 '}
                                        {m.title}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botón de Recalibrar ARRIBA A LA DERECHA */}
                    <button
                        type="button"
                        onClick={onOpenWizard}
                        className="ml-btn ml-btn-fantasma ml-btn-sm border d-inline-flex align-items-center gap-1.5 flex-shrink-0"
                        style={{ borderColor: 'var(--perfil-border)', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                        title="Recalibrar o ajustar tus gustos con el Profesor Doki Doki"
                    >
                        <RotateCcw size={13} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Recalibrar</span>
                    </button>
                </div>

                {/* Cuerpo del Carrusel / Iterador de Recomendaciones */}
                {isLoadingRecs ? (
                    <div className="py-4 text-center">
                        <Loader2 size={28} className="text-secondary mb-2" style={{ animation: 'spin 1s linear infinite' }} />
                        <p className="small text-secondary mb-0">Calculando tus recomendaciones supremas...</p>
                    </div>
                ) : activeRec ? (
                    <div className="perfil-taste-carousel-body position-relative z-1">
                        {/* Póster con badge de afinidad */}
                        <div className="perfil-taste-poster-wrap">
                            <img
                                src={activeRec.anime_poster}
                                alt={activeRec.anime_title}
                                className="perfil-taste-poster-img"
                                onError={(e) => {
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'
                                }}
                            />
                            <div className="position-absolute top-2 start-2">
                                <span className="perfil-affinity-badge" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>
                                    <Sparkles size={10} /> {activeRec.affinity_score}% Afinidad
                                </span>
                            </div>
                            <div
                                className="position-absolute bottom-2 end-2 bg-dark bg-opacity-75 rounded px-1.5 py-0.5 text-warning small fw-bold font-mono"
                                style={{ fontSize: '0.7rem', border: '1px solid var(--perfil-amber)' }}
                            >
                                ★ {activeRec.anime_score}
                            </div>
                        </div>

                        {/* Detalles de la alternativa actual */}
                        <div className="flex-grow-1 min-w-0">
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                                <h4 className="h5 fw-bold text-white mb-0 text-truncate" title={activeRec.anime_title}>
                                    {activeRec.anime_title}
                                </h4>

                                {/* Controles de navegación / iteración */}
                                <div className="d-flex align-items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handlePrev}
                                        className="perfil-taste-nav-btn"
                                        title="Alternativa anterior"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="small text-secondary font-mono px-1" style={{ fontSize: '0.74rem' }}>
                                        {currentIndex + 1} / {recs.length}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className="perfil-taste-nav-btn"
                                        title="Siguiente alternativa"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                <span className="small text-secondary font-mono" style={{ fontSize: '0.72rem' }}>
                                    {activeRec.anime_studio} {activeRec.season_year ? `· ${activeRec.season_year}` : ''}
                                </span>
                                {activeRec.genres.map((g) => (
                                    <span key={g} className="badge bg-dark border border-secondary text-secondary small py-0.5 px-1.5" style={{ fontSize: '0.66rem' }}>
                                        {g}
                                    </span>
                                ))}
                            </div>

                            {/* Explicación del Profesor Doki Doki */}
                            <ProfesorDoki
                                size="sm"
                                expression="celebracion"
                                title="Profesor Doki Doki"
                                dialogue={
                                    <span>
                                        <strong>¿Por qué te lo recomiendo?</strong> {activeRec.match_reason}
                                    </span>
                                }
                                className="my-2"
                                align="compact"
                            />

                            {/* Botón de acción y dots */}
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={handleAddToList}
                                    disabled={isInList}
                                    className={`ml-btn ${isInList ? 'ml-btn-fantasma border' : 'ml-btn-acento'} ml-btn-sm py-1.5 px-3`}
                                    style={{ fontSize: '0.78rem' }}
                                >
                                    {isInList ? (
                                        <>
                                            <Check size={14} className="text-success" />
                                            <span>Ya está en tu Lista</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={14} />
                                            <span>Agregar a Mi Lista</span>
                                        </>
                                    )}
                                </button>

                                {/* Indicadores dots para saltar entre alternativas */}
                                <div className="d-flex align-items-center gap-1.5">
                                    {recs.slice(0, 8).map((_, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setCurrentIndex(idx)}
                                            className={`perfil-taste-dot ${idx === currentIndex ? 'is-active' : ''}`}
                                            title={`Ver recomendación ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 text-center">
                        <p className="small text-secondary mb-3">No hay recomendaciones cacheadas aún.</p>
                        <button type="button" onClick={onOpenWizard} className="ml-btn ml-btn-acento ml-btn-sm">
                            <Sparkles size={14} />
                            <span>Generar Recomendaciones</span>
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // =========================================================================
    // ESTADO B: CALIBRACIÓN PENDIENTE -> BARRA DE PROGRESO, PROFESOR DOKI DOKI Y BOTÓN
    // =========================================================================
    return (
        <div className="perfil-taste-card">
            <div className="d-flex flex-column gap-3 position-relative z-1">
                {/* Cabecera */}
                <div className="d-flex align-items-center gap-2">
                    <div
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: 'var(--perfil-acento-soft)',
                            border: '1px solid var(--perfil-acento-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--perfil-acento)',
                        }}
                    >
                        <Brain size={15} />
                    </div>
                    <span className="ml-eyebrow">RECOMENDADOR NEURONAL · PROFESOR DOKI DOKI</span>
                    <span className="badge rounded-pill bg-warning-subtle text-warning border border-warning-subtle px-2 py-0.5 small font-mono" style={{ fontSize: '0.68rem' }}>
                        Calibración Pendiente
                    </span>
                </div>

                <div>
                    <h3 className="h4 fw-bold text-white mb-1">
                        Calibra tus Gustos para Desbloquear Recomendaciones
                    </h3>
                    <p className="small text-secondary mb-0">
                        Completa el test con el Profesor Doki Doki para activar la inteligencia artificial y descubrir animes a tu medida.
                    </p>
                </div>

                {/* Profesor Doki Doki comentando lo que falta por hacer */}
                <ProfesorDoki
                    size="md"
                    expression="explicando"
                    dialogue={
                        <span>
                            ¡Konnichiwa! Tu recomendador está calibrado al <strong>{answers.calibratedPercentage}%</strong>. Necesito que me cuentes qué <strong>películas o series de TV favoritas (TMDb)</strong> y qué <strong>animes ya viste y te gustaron</strong> para calcular tus afinidades supremas.
                        </span>
                    }
                    badgeText="Pendiente"
                />

                {/* Barra de progreso */}
                <div className="d-flex align-items-center gap-3">
                    <div className="perfil-taste-progress-bar flex-grow-1">
                        <div
                            className="perfil-taste-progress-fill"
                            style={{ width: `${answers.calibratedPercentage}%` }}
                        />
                    </div>
                    <span className="small font-mono fw-bold text-white" style={{ minWidth: 42 }}>
                        {answers.calibratedPercentage}%
                    </span>
                </div>

                {/* Botón principal para iniciar la calibración */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={onOpenWizard}
                        className="ml-btn ml-btn-acento px-3 py-2 w-100 justify-content-center d-inline-flex align-items-center gap-2"
                        style={{
                            boxShadow: '0 0 20px var(--perfil-acento-glow)',
                            fontSize: '0.86rem',
                        }}
                    >
                        <Sparkles size={16} />
                        <span>Iniciar Calibración con Profesor Doki Doki</span>
                        <ArrowRight size={14} />
                    </button>
                    <span className="small text-secondary d-block text-center mt-2" style={{ fontSize: '0.72rem' }}>
                        Toma menos de 2 minutos · 5 pasos guiados
                    </span>
                </div>
            </div>
        </div>
    )
}
