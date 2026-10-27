import React from 'react'
import { Clapperboard, Sparkles, Plus, Check } from 'lucide-react'
import type { TmdbMovie, TmdbAnimeRecommendation } from './perfil-types'

interface TmdbCrossRecommendationsProps {
    favoriteMovies: TmdbMovie[]
    recommendations: TmdbAnimeRecommendation[]
    onAddAnimeToList: (animeId: number) => void
    addedAnimeIds: number[]
    onOpenWizard: () => void
}

export const TmdbCrossRecommendations: React.FC<TmdbCrossRecommendationsProps> = ({
    favoriteMovies,
    recommendations,
    onAddAnimeToList,
    addedAnimeIds,
    onOpenWizard,
}) => {
    if (favoriteMovies.length === 0) {
        return (
            <div className="perfil-tmdb-section text-center py-4">
                <Clapperboard size={32} className="text-secondary opacity-50 mb-2" />
                <h4 className="h6 fw-bold text-white mb-1">Cruce Cinematográfico TMDB Pendiente</h4>
                <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)', maxWidth: 520, margin: '0 auto' }}>
                    Ingresa tus películas favoritas de cine en el Test de Gustos para que extraigamos sus géneros y sinopsis desde <strong>The Movie Database (TMDB)</strong> y te recomendemos animes a tu medida.
                </p>
                <button
                    type="button"
                    onClick={onOpenWizard}
                    className="ml-btn ml-btn-acento ml-btn-sm"
                >
                    <Sparkles size={14} />
                    <span>Configurar Películas en el Test de Gustos</span>
                </button>
            </div>
        )
    }

    return (
        <div className="perfil-tmdb-section">
            {/* Cabecera de la sección */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                <div>
                    <span className="ml-eyebrow">INTELIGENCIA CINEMATOGRÁFICA · TMDB x ANIMIGOS</span>
                    <h4 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                        <Clapperboard size={18} style={{ color: 'var(--perfil-cyan)' }} />
                        <span>Recomendaciones Basadas en tus Películas Favoritas</span>
                    </h4>
                </div>
                <button
                    type="button"
                    onClick={onOpenWizard}
                    className="ml-btn ml-btn-fantasma ml-btn-sm border"
                    style={{ borderColor: 'var(--perfil-border)', fontSize: '0.75rem' }}
                >
                    <span>Editar Películas ({favoriteMovies.length})</span>
                </button>
            </div>

            {/* Fila de películas TMDB registradas */}
            <div className="row g-2 mb-4">
                {favoriteMovies.map((m) => (
                    <div key={m.id} className="col-12 col-md-6 col-lg-4">
                        <div className="perfil-tmdb-movie-card">
                            <img
                                src={m.posterPath || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'}
                                alt={m.title}
                                className="perfil-tmdb-movie-poster"
                                onError={(e) => {
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'
                                }}
                            />
                            <div className="flex-grow-1 min-w-0">
                                <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                    <h5 className="small fw-bold text-white mb-0 text-truncate" title={m.title}>
                                        {m.title}
                                    </h5>
                                    {m.releaseYear && (
                                        <span className="small text-secondary font-mono" style={{ fontSize: '0.7rem' }}>
                                            {m.releaseYear}
                                        </span>
                                    )}
                                </div>

                                <div className="d-flex flex-wrap gap-1 mb-1.5">
                                    {m.genres.slice(0, 2).map((g) => (
                                        <span key={g} className="badge bg-dark border border-secondary small py-0.5 px-1.5" style={{ fontSize: '0.64rem' }}>
                                            {g}
                                        </span>
                                    ))}
                                </div>

                                <p className="small mb-0 text-secondary text-truncate" style={{ fontSize: '0.72rem', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>
                                    {m.overview}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Grilla de Animes Recomendados por el Cruce */}
            <div className="pt-2 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                <span className="small text-secondary fw-semibold d-block mb-3" style={{ fontSize: '0.74rem' }}>
                    ANIMES SELECCIONADOS POR AFINIDAD DE GÉNERO Y SINOPSIS:
                </span>

                <div className="row g-3">
                    {recommendations.slice(0, 4).map((rec) => {
                        const isAdded = addedAnimeIds.includes(rec.animeId)
                        return (
                            <div key={rec.animeId} className="col-12 col-sm-6 col-lg-3">
                                <div className="perfil-recommendation-card">
                                    <div>
                                        <div className="position-relative rounded-3 overflow-hidden mb-2" style={{ aspectRatio: '16/10' }}>
                                            <img
                                                src={rec.animePoster}
                                                alt={rec.animeTitle}
                                                className="w-100 h-100"
                                                style={{ objectFit: 'cover' }}
                                            />
                                            <div
                                                className="position-absolute top-2 start-2"
                                            >
                                                <span className="perfil-affinity-badge">
                                                    <Sparkles size={11} /> {rec.affinityScore}% Afinidad
                                                </span>
                                            </div>
                                            <div
                                                className="position-absolute bottom-2 end-2 bg-dark bg-opacity-75 rounded px-1.5 py-0.5 text-warning small fw-bold font-mono"
                                                style={{ fontSize: '0.72rem', border: '1px solid var(--perfil-amber)' }}
                                            >
                                                ★ {rec.animeScore}
                                            </div>
                                        </div>

                                        <h6 className="small fw-bold text-white mb-1 text-truncate" title={rec.animeTitle}>
                                            {rec.animeTitle}
                                        </h6>

                                        <p className="small mb-2" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.73rem', lineHeight: 1.4 }}>
                                            {rec.matchReason}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => onAddAnimeToList(rec.animeId)}
                                        disabled={isAdded}
                                        className={`ml-btn ${isAdded ? 'ml-btn-fantasma' : 'ml-btn-acento'} ml-btn-sm w-100 justify-content-center py-1 mt-1`}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        {isAdded ? (
                                            <>
                                                <Check size={13} className="text-success" />
                                                <span>En tu Lista</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={13} />
                                                <span>Agregar a Mi Lista</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
