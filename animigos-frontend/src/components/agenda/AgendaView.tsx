/**
 * Componente Principal de Agenda de Tareas Pendientes (Pilar 1.2 y 1.3 de AGENTS.md).
 * Contador reactivo de capítulos para animes en emisión, ordenados según capítulos de atraso.
 */

import { useState, useMemo, useEffect } from 'react'
import {
    CalendarCheck,
    CheckCircle2,
    AlertCircle,
    Flame,
    Search,
    Plus,
    Minus,
    Sparkles,
    Check,
    Clock,
    ChevronLeft,
    ChevronRight,
    Clapperboard,
} from 'lucide-react'
import { useAgenda } from '../../hooks/useAgenda'
import { alFallarPoster } from '../mi-lista/mi-lista-data'
import { dentroDe } from '../../shared/tiempo'
import type { AgendaItem, SuggestedAiringAnime } from '../../services/agendaApi'
import './agenda.css'

interface AgendaViewProps {
    onOpenAnimeDetail?: (malId: number) => void
}

type FiltroTab = 'todos' | 'atrasados' | 'al_dia'
type OrdenCriterio = 'atraso_desc' | 'atraso_asc' | 'titulo'

export function AgendaView({ onOpenAnimeDetail }: AgendaViewProps) {
    const {
        summary,
        items,
        suggestedAiring,
        isAuthenticated,
        isLoading,
        incrementEpisode,
        decrementEpisode,
        markSetUpToDate,
        addAnimeToAgenda,
        isAdding,
    } = useAgenda()

    const [filtro, setFiltro] = useState<FiltroTab>('todos')
    const [busqueda, setBusqueda] = useState('')
    const [orden, setOrden] = useState<OrdenCriterio>('atraso_desc')

    // Estado del carrusel para los animes sugeridos
    const [slideIndex, setSlideIndex] = useState(0)
    const [isFading, setIsFading] = useState(false)
    const [isPaused, setIsPaused] = useState(false)

    const cambiarSlide = (nuevoIdx: number) => {
        if (isFading || suggestedAiring.length === 0) return
        setIsFading(true)
        setTimeout(() => {
            setSlideIndex((nuevoIdx + suggestedAiring.length) % suggestedAiring.length)
            setIsFading(false)
        }, 220)
    }

    // Auto-avance del carrusel cada 6 segundos
    useEffect(() => {
        if (suggestedAiring.length <= 1 || isPaused) return
        const timer = setInterval(() => {
            cambiarSlide(slideIndex + 1)
        }, 6000)
        return () => clearInterval(timer)
    }, [slideIndex, isPaused, suggestedAiring.length])

    // Formateador de tiempo faltante (minutos para < 1h, horas para > 1h)
    const formatoTiempo = (minutos: number) => {
        if (!minutos || minutos <= 0) return '0 min'
        if (minutos < 60) return `${minutos} min`
        const horas = Math.round(minutos / 60)
        return `${horas} h`
    }
    const formatoMinutos = formatoTiempo

    // Filtrado y ordenación reactiva de la lista de pendientes
    const itemsFiltrados = useMemo(() => {
        let res = [...items]

        if (filtro === 'atrasados') {
            res = res.filter((item) => item.episodes_behind > 0)
        } else if (filtro === 'al_dia') {
            res = res.filter((item) => item.is_up_to_date)
        }

        if (busqueda.trim()) {
            const q = busqueda.toLowerCase().trim()
            res = res.filter(
                (item) =>
                    item.title.toLowerCase().includes(q) ||
                    (item.title_english && item.title_english.toLowerCase().includes(q))
            )
        }

        if (orden === 'atraso_desc') {
            res.sort((a, b) => b.episodes_behind - a.episodes_behind || a.title.localeCompare(b.title))
        } else if (orden === 'atraso_asc') {
            res.sort((a, b) => a.episodes_behind - b.episodes_behind || a.title.localeCompare(b.title))
        } else if (orden === 'titulo') {
            res.sort((a, b) => a.title.localeCompare(b.title))
        }

        return res
    }, [items, filtro, busqueda, orden])

    const abrirLogin = () => (document.getElementById('loginDialog') as HTMLDialogElement | null)?.showModal()

    const currentSugg: SuggestedAiringAnime | undefined =
        suggestedAiring.length > 0 ? suggestedAiring[slideIndex] || suggestedAiring[0] : undefined

    return (
        <div className="agenda-root container">
            {/* Cabecera y Resumen */}
            <header className="agenda-header">
                <span className="agenda-eyebrow">
                    <CalendarCheck size={16} />
                    Tareas Pendientes
                </span>
                <h1 className="agenda-title">Agenda de Episodios</h1>
                <p className="agenda-sub">
                    Monitorea tus animes en emisión, mantén al día tu contador de capítulos y mira exactamente
                    cuántos episodios te faltan para no perderte ningún estreno.
                </p>

                {/* KPI Metric Cards */}
                <div className="agenda-kpi-grid">
                    <div className="agenda-kpi-card kpi-accent">
                        <div className="agenda-kpi-icon">
                            <Flame size={24} />
                        </div>
                        <div>
                            <div className="agenda-kpi-val">{summary.total_episodes_behind}</div>
                            <div className="agenda-kpi-label">Caps de Atraso Totales</div>
                        </div>
                    </div>

                    <div className="agenda-kpi-card">
                        <div className="agenda-kpi-icon text-warning">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <div className="agenda-kpi-val">{summary.behind_count}</div>
                            <div className="agenda-kpi-label">Series con Atraso</div>
                        </div>
                    </div>

                    <div className="agenda-kpi-card">
                        <div className="agenda-kpi-icon text-info">
                            <Clock size={24} />
                        </div>
                        <div>
                            <div className="agenda-kpi-val">{formatoMinutos(summary.estimated_minutes)}</div>
                            <div className="agenda-kpi-label">Minutos Estimados</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Barra de Herramientas y Filtros */}
            <div className="agenda-toolbar">
                <div className="agenda-tabs" role="tablist" aria-label="Filtro de agenda">
                    <button
                        type="button"
                        className={`agenda-tab ${filtro === 'todos' ? 'active' : ''}`}
                        onClick={() => setFiltro('todos')}
                    >
                        Todos <span className="agenda-tab-count">{items.length}</span>
                    </button>
                    <button
                        type="button"
                        className={`agenda-tab ${filtro === 'atrasados' ? 'active' : ''}`}
                        onClick={() => setFiltro('atrasados')}
                    >
                        Atrasados <span className="agenda-tab-count">{summary.behind_count}</span>
                    </button>
                    <button
                        type="button"
                        className={`agenda-tab ${filtro === 'al_dia' ? 'active' : ''}`}
                        onClick={() => setFiltro('al_dia')}
                    >
                        Al Día <span className="agenda-tab-count">{summary.up_to_date_count}</span>
                    </button>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <div className="agenda-search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Buscar en tu agenda..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="agenda-search-input"
                        />
                    </div>

                    <select
                        className="form-select form-select-sm bg-dark text-light border-secondary"
                        style={{ width: 'auto', fontSize: '0.85rem' }}
                        value={orden}
                        onChange={(e) => setOrden(e.target.value as OrdenCriterio)}
                        aria-label="Criterio de ordenación"
                    >
                        <option value="atraso_desc">Mayor atraso primero</option>
                        <option value="atraso_asc">Menor atraso primero</option>
                        <option value="titulo">Título A-Z</option>
                    </select>
                </div>
            </div>

            {/* Listado Principal de Tarjetas */}
            {isLoading ? (
                <div className="agenda-zero-state">
                    <div className="spinner-border text-primary mb-3" role="status" />
                    <p className="text-secondary mb-0">Cargando tu agenda de episodios en emisión...</p>
                </div>
            ) : itemsFiltrados.length > 0 ? (
                <div className="agenda-cards-list">
                    {itemsFiltrados.map((item: AgendaItem) => {
                        const isSevere = item.episodes_behind >= 4
                        const cardStateClass = item.is_up_to_date
                            ? 'card-up-to-date'
                            : isSevere
                            ? 'card-severe'
                            : 'card-behind'

                        return (
                            <article key={item.entry_id} className={`agenda-card ${cardStateClass}`}>
                                {/* Poster */}
                                <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="agenda-card-poster"
                                    onError={alFallarPoster}
                                    onClick={() => onOpenAnimeDetail?.(item.mal_id)}
                                    title="Ver ficha del anime"
                                />

                                {/* Info Central */}
                                <div className="agenda-card-main">
                                    <div className="agenda-card-title-row">
                                        <h2
                                            className="agenda-card-title mb-0"
                                            onClick={() => onOpenAnimeDetail?.(item.mal_id)}
                                            title={item.title_english || item.title}
                                        >
                                            {item.title_english || item.title}
                                        </h2>

                                        {item.is_up_to_date ? (
                                            <span className="agenda-delay-badge badge-success">
                                                <Check size={12} /> Al día
                                            </span>
                                        ) : (
                                            <span
                                                className={`agenda-delay-badge ${
                                                    isSevere ? 'badge-danger' : 'badge-warning'
                                                }`}
                                            >
                                                <AlertCircle size={12} />
                                                {item.episodes_behind} de atraso
                                            </span>
                                        )}
                                    </div>

                                    {/* Metadatos Acotados */}
                                    <div className="agenda-card-meta">
                                        <span className="agenda-meta-item">
                                            Vas en el cap: <strong>{item.episodes_watched}</strong>
                                        </span>
                                        <span className="agenda-meta-sep">·</span>
                                        <span className="agenda-meta-item">
                                            Te faltan:{' '}
                                            <strong className={item.episodes_behind > 0 ? 'text-warning' : 'text-success'}>
                                                {item.episodes_behind}
                                            </strong>
                                        </span>
                                        <span className="agenda-meta-sep">·</span>
                                        <span className="agenda-meta-item">
                                            Tiempo:{' '}
                                            <strong className="text-info">
                                                {formatoTiempo(item.episodes_behind * (item.duration || 24))}
                                            </strong>
                                        </span>

                                        {item.next_airing_at && (
                                            <div className="agenda-meta-next">
                                                <Clock size={12} />
                                                <span>
                                                    Próximo ep. <strong>{item.next_episode}</strong> {dentroDe(item.next_airing_at)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Acciones y Contador */}
                                <div className="agenda-card-actions">
                                    <div className="agenda-counter-controls">
                                        <button
                                            type="button"
                                            className="agenda-btn-counter"
                                            title="Restar 1 capítulo"
                                            disabled={item.episodes_watched <= 0}
                                            onClick={() => decrementEpisode(item)}
                                        >
                                            <Minus size={14} />
                                        </button>

                                        <span className="agenda-counter-current" title="Capítulo actual visto">
                                            {item.episodes_watched}
                                        </span>

                                        <button
                                            type="button"
                                            className="agenda-btn-counter agenda-btn-plus"
                                            title="Sumar 1 capítulo visto"
                                            onClick={() => incrementEpisode(item)}
                                        >
                                            <Plus size={14} /> +1 Visto
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        className="agenda-btn-uptodate"
                                        disabled={item.is_up_to_date}
                                        onClick={() => markSetUpToDate(item)}
                                        title={`Marcar hasta el capítulo ${item.latest_episode} como visto`}
                                    >
                                        <Check size={14} /> ¡Poner al día!
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            ) : (
                <div className="agenda-zero-state">
                    <div className="agenda-zero-icon">
                        {filtro === 'atrasados' ? <CheckCircle2 size={28} /> : <CalendarCheck size={28} />}
                    </div>
                    {filtro === 'atrasados' ? (
                        <>
                            <h3 className="h5 text-white mb-2">¡Estás completamente al día! 🎉</h3>
                            <p className="text-secondary small mb-0">
                                No tienes ningún capítulo atrasado entre tus animes en emisión.
                            </p>
                        </>
                    ) : (
                        <>
                            <h3 className="h5 text-white mb-2">No hay animes en emisión en tu lista</h3>
                            <p className="text-secondary small mb-3">
                                Agrega las series que estás viendo de la temporada actual para que la agenda lleve
                                automáticamente la cuenta de tus episodios pendientes.
                            </p>
                            {!isAuthenticated && (
                                <button type="button" className="btn btn-primary btn-sm" onClick={abrirLogin}>
                                    Iniciar sesión para guardar tu progreso
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Explorador de Animes en Emisión — Carrusel Uno a Uno con Fade In / Fade Out */}
            {suggestedAiring.length > 0 && currentSugg && (
                <section className="agenda-suggested-section">
                    <div className="agenda-suggested-heading">
                        <div>
                            <h3 className="h6 text-white mb-1 d-flex align-items-center gap-2">
                                <Sparkles size={16} className="text-warning" />
                                Animes populares en emisión esta temporada
                            </h3>
                            <p className="text-secondary small mb-0">
                                Explora títulos en emisión y añádelos a tu agenda para seguir su ritmo semanal
                            </p>
                        </div>

                        {/* Controles de Navegación del Carrusel */}
                        <div className="agenda-carousel-nav">
                            <button
                                type="button"
                                className="agenda-carousel-arrow"
                                onClick={() => cambiarSlide(slideIndex - 1)}
                                title="Anterior anime"
                                aria-label="Anime anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="small text-secondary fw-semibold px-1">
                                {slideIndex + 1} / {suggestedAiring.length}
                            </span>
                            <button
                                type="button"
                                className="agenda-carousel-arrow"
                                onClick={() => cambiarSlide(slideIndex + 1)}
                                title="Siguiente anime"
                                aria-label="Anime siguiente"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Contenedor del Carrusel con Efecto Fade In / Fade Out */}
                    <div
                        className="agenda-carousel-wrapper"
                        onMouseEnter={() => setIsPaused(true)}
                        onMouseLeave={() => setIsPaused(false)}
                    >
                        <div className={`agenda-carousel-slide ${isFading ? 'fade-out' : 'fade-in'}`}>
                            {/* Póster */}
                            <img
                                src={currentSugg.image_url}
                                alt={currentSugg.title}
                                className="agenda-carousel-poster"
                                onError={alFallarPoster}
                                onClick={() => onOpenAnimeDetail?.(currentSugg.mal_id)}
                                title="Ver ficha completa"
                            />

                            {/* Información detallada */}
                            <div className="agenda-carousel-info">
                                <div className="agenda-carousel-title-row">
                                    <h4
                                        className="agenda-carousel-title mb-0"
                                        onClick={() => onOpenAnimeDetail?.(currentSugg.mal_id)}
                                    >
                                        {currentSugg.title_english || currentSugg.title}
                                    </h4>

                                    <span className="agenda-carousel-ep-pill">
                                        <Clapperboard size={13} />
                                        En emisión · Actualmente en Cap. {currentSugg.latest_episode}
                                    </span>
                                </div>

                                {/* Chips de Géneros */}
                                {currentSugg.genres && currentSugg.genres.length > 0 && (
                                    <div className="agenda-carousel-genres">
                                        {currentSugg.genres.slice(0, 5).map((g) => (
                                            <span key={g} className="agenda-genre-chip">
                                                {g}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Sinopsis */}
                                <p className="agenda-carousel-synopsis" title={currentSugg.synopsis}>
                                    {currentSugg.synopsis || 'Sin sinopsis disponible para esta temporada.'}
                                </p>

                                {/* Parte Inferior: Botón Seguir + Puntos */}
                                <div className="agenda-carousel-bottom">
                                    <button
                                        type="button"
                                        className="agenda-btn-carousel-add"
                                        disabled={currentSugg.in_user_list || isAdding}
                                        onClick={() => {
                                            if (!isAuthenticated) {
                                                abrirLogin()
                                                return
                                            }
                                            addAnimeToAgenda(currentSugg.mal_id)
                                        }}
                                    >
                                        {currentSugg.in_user_list ? (
                                            <>
                                                <Check size={14} /> En tu agenda
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={14} /> + Seguir en Agenda
                                            </>
                                        )}
                                    </button>

                                    {/* Indicadores de Puntos */}
                                    <div className="agenda-carousel-dots">
                                        {suggestedAiring.map((_, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                className={`agenda-carousel-dot ${idx === slideIndex ? 'active' : ''}`}
                                                onClick={() => cambiarSlide(idx)}
                                                aria-label={`Ir al anime ${idx + 1}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}
