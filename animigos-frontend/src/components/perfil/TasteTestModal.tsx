import React, { useState } from 'react'
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Zap,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import type { TasteTestAnswers } from './perfil-types'

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
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Test de Preferencias Anime IA" ancho={620}>
            <div className="p-4 d-flex flex-column gap-3">
                {/* Cabecera del Wizard */}
                <div className="d-flex align-items-center justify-content-between border-bottom pb-3" style={{ borderColor: 'var(--perfil-border)' }}>
                    <div>
                        <div className="d-flex align-items-center gap-1.5 mb-1">
                            <Sparkles size={14} style={{ color: 'var(--perfil-acento)' }} />
                            <span className="ml-eyebrow">RECOMENDADOR IA · CALIBRACIÓN</span>
                        </div>
                        <h3 className="h5 fw-bold text-white mb-0">Test de Preferencias</h3>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <span className="small text-white fw-semibold">Paso {step} de 4</span>
                        <div className="d-flex gap-1">
                            {[1, 2, 3, 4].map((i) => (
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
                        <h4 className="h6 fw-bold text-white mb-1">¿Qué tropos y dinámicas te enganchan más?</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Selecciona los arquetipos narrativos que hacen que no puedas soltar un anime.
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
                        <h4 className="h6 fw-bold text-white mb-1">Géneros Favoritos y Filtros de Descarte</h4>
                        <p className="small mb-3" style={{ color: 'var(--perfil-text-muted)' }}>
                            Indica qué géneros amas (<ThumbsUp size={12} className="text-success" />) y cuáles prefieres evitar por completo (<ThumbsDown size={12} className="text-danger" />).
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

                {/* PASO 3: RITMO NARRATIVO & FORMATO */}
                {step === 3 && (
                    <div className="py-2">
                        <h4 className="h6 fw-bold text-white mb-1">Ritmo Narrativo y Duración Ideal</h4>
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

                {/* PASO 4: FILTROS DE CONTENIDO Y REGLAS */}
                {step === 4 && (
                    <div className="py-2">
                        <h4 className="h6 fw-bold text-white mb-1">Filtros de Calidad y Preferencias Finales</h4>
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

                    {step < 4 ? (
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
                            <span>{isSaving ? 'Calibrando Algoritmo...' : 'Guardar y Calibrar IA al 100%'}</span>
                        </button>
                    )}
                </div>
            </div>
        </Dialogo>
    )
}
