/**
 * Componente Principal de Agenda de Tareas Pendientes (Pilar 1.2 y 1.3 de AGENTS.md).
 * KPI interactivos como sub-vistas:
 * 1. Caps de Atraso -> Sub-vista con alto enfoque en cantidad de atraso y siguiente capítulo a ver.
 * 2. Próximo capítulo sale en -> Sub-vista con lista de hasta 15 capítulos futuros por páginas.
 * 3. Minutos estimados -> Sub-vista de gráfico de torta que distribuye el tiempo a invertir.
 */

import { useState, useMemo, useEffect } from 'react'
import {
    CalendarCheck,
    CheckCircle2,
    AlertCircle,
    Flame,
    Plus,
    Minus,
    Sparkles,
    Check,
    Clock,
    ChevronLeft,
    ChevronRight,
    Clapperboard,
    PieChart as PieChartIcon,
    Tv,
    Calendar,
    Play,
    ExternalLink,
} from 'lucide-react'
import { useAgenda } from '../../hooks/useAgenda'
import { useAssociatedLinks } from '../../hooks/useAssociatedLinks'
import { alFallarPoster } from '../mi-lista/mi-lista-data'
import { dentroDe, aFecha, fechaLarga, horaLocal } from '../../shared/tiempo'
import type { AgendaItem, SuggestedAiringAnime } from '../../services/agendaApi'
import './agenda.css'

interface AgendaViewProps {
    onOpenAnimeDetail?: (malId: number) => void
}

type SubvistaAgenda = 'atrasados' | 'proximos' | 'tiempo'

interface CapituloFuturo {
    id: string
    malId: number
    title: string
    titleEnglish: string
    imageUrl: string
    episodeNumber: number
    airingAtUnix: number
    episodesWatched: number
    episodesBehind: number
}

// Paleta de colores distintivos y armoniosos para el gráfico de torta
const PALETA_TORTA = [
    '#e8508f', // Acento primario rosa
    '#8b5cf6', // Violeta
    '#38bdf8', // Cyan brillante
    '#34d399', // Esmeralda / menta
    '#fbbf24', // Ámbar cálido
    '#f87171', // Coral suave
    '#a78bfa', // Lavanda
    '#f472b6', // Fucsia suave
    '#2dd4bf', // Turquesa
    '#c084fc', // Púrpura pastel
]

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

    const { openAnimeLink, isEnabled: isLinksEnabled } = useAssociatedLinks()

    // Sub-vista activa seleccionada a través de los KPIs
    const [subvista, setSubvista] = useState<SubvistaAgenda>('atrasados')

    // Paginación para la sub-vista de próximos capítulos futuros (5 por página, hasta 15)
    const [proximosPagina, setProximosPagina] = useState(1)
    const itemsPorPagina = 5

    // Estado del hover en el gráfico de torta
    const [hoveredAnimeId, setHoveredAnimeId] = useState<number | null>(null)

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
        const horas = Math.floor(minutos / 60)
        const resto = minutos % 60
        return resto > 0 ? `${horas}h ${resto}m` : `${horas} h`
    }
    const formatoMinutos = formatoTiempo

    // 1. Cálculo del anime con el estreno más cercano para el KPI 2
    const proximoEstreno = useMemo(() => {
        const ahora = Date.now() / 1000
        const conEstreno = items
            .filter((it) => it.next_airing_at && it.next_airing_at > ahora)
            .sort((a, b) => a.next_airing_at! - b.next_airing_at!)
        return conEstreno[0] || null
    }, [items])

    // 2. Animes que tienen atraso actualmente (para la sub-vista 1)
    const animesConAtraso = useMemo(() => {
        return items
            .filter((item) => item.episodes_behind > 0)
            .sort((a, b) => b.episodes_behind - a.episodes_behind || a.title.localeCompare(b.title))
    }, [items])

    // 3. Proyección de hasta 15 capítulos futuros de las series del usuario (para la sub-vista 2)
    const capsFuturos = useMemo(() => {
        const ahora = Date.now() / 1000
        const lista: CapituloFuturo[] = []

        items.forEach((item) => {
            if (!item.next_airing_at || item.next_airing_at <= ahora) return

            const baseTime = item.next_airing_at
            const baseEp = item.next_episode || item.latest_episode + 1
            const maxEp = item.total_episodes || 999

            // Proyectamos hasta 4 semanas futuras por anime si no excede su total
            for (let i = 0; i < 4; i++) {
                const epNum = baseEp + i
                if (epNum > maxEp) break
                const airTime = baseTime + i * 7 * 86400

                lista.push({
                    id: `${item.mal_id}-ep-${epNum}`,
                    malId: item.mal_id,
                    title: item.title,
                    titleEnglish: item.title_english || item.title,
                    imageUrl: item.image_url,
                    episodeNumber: epNum,
                    airingAtUnix: airTime,
                    episodesWatched: item.episodes_watched,
                    episodesBehind: item.episodes_behind,
                })
            }
        })

        // Ordenamos cronológicamente y recortamos a exactamente máximo 15 capítulos
        lista.sort((a, b) => a.airingAtUnix - b.airingAtUnix)
        return lista.slice(0, 15)
    }, [items])

    // Paginación de capítulos futuros
    const totalPaginasProximos = Math.max(1, Math.ceil(capsFuturos.length / itemsPorPagina))
    const capsFuturosPaginados = useMemo(() => {
        const inicio = (proximosPagina - 1) * itemsPorPagina
        return capsFuturos.slice(inicio, inicio + itemsPorPagina)
    }, [capsFuturos, proximosPagina, itemsPorPagina])

    // 4. Datos para el Gráfico de Torta de Distribución de Tiempo (para la sub-vista 3)
    const datosTorta = useMemo(() => {
        const conTiempo = animesConAtraso.map((item, idx) => {
            const minutos = item.episodes_behind * (item.duration || 24)
            return {
                malId: item.mal_id,
                title: item.title_english || item.title,
                imageUrl: item.image_url,
                episodesBehind: item.episodes_behind,
                minutos,
                color: PALETA_TORTA[idx % PALETA_TORTA.length],
            }
        })

        const totalMinutos = conTiempo.reduce((acc, curr) => acc + curr.minutos, 0)

        // Calcular segmentos para el Donut Chart SVG
        // Radio R = 75, Circunferencia C = 2 * PI * 75 ≈ 471.24
        const radio = 75
        const circunferencia = 2 * Math.PI * radio
        let offsetAcumulado = 0

        const segmentos = conTiempo.map((item) => {
            const porcentaje = totalMinutos > 0 ? (item.minutos / totalMinutos) * 100 : 0
            const longitudSegmento = (porcentaje / 100) * circunferencia
            const dasharray = `${Math.max(1, longitudSegmento)} ${circunferencia}`
            const dashoffset = -offsetAcumulado
            offsetAcumulado += longitudSegmento

            return {
                ...item,
                porcentaje,
                dasharray,
                dashoffset,
            }
        })

        return {
            items: segmentos,
            totalMinutos,
            circunferencia,
            radio,
        }
    }, [animesConAtraso])

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

                {/* KPI Cards Interactivos — Funcionan como Selectores de Sub-vistas */}
                <div className="agenda-kpi-grid">
                    {/* KPI 1: Caps de Atraso Totales */}
                    <div
                        className={`agenda-kpi-card ${subvista === 'atrasados' ? 'kpi-active' : ''}`}
                        onClick={() => setSubvista('atrasados')}
                        title="Click para ver animes con capítulos atrasados"
                    >
                        <div className="agenda-kpi-icon">
                            <Flame size={24} />
                        </div>
                        <div>
                            <div className="agenda-kpi-val">{summary.total_episodes_behind}</div>
                            <div className="agenda-kpi-label">Caps de Atraso Totales</div>
                            <div className="agenda-kpi-subtext">
                                {animesConAtraso.length === 1
                                    ? '1 anime con retraso'
                                    : `${animesConAtraso.length} animes con retraso`}
                            </div>
                        </div>
                        {subvista === 'atrasados' && (
                            <span className="agenda-kpi-active-pill">Viendo</span>
                        )}
                    </div>

                    {/* KPI 2: Próximo Capítulo Sale En */}
                    <div
                        className={`agenda-kpi-card ${subvista === 'proximos' ? 'kpi-active' : ''}`}
                        onClick={() => {
                            setSubvista('proximos')
                            setProximosPagina(1)
                        }}
                        title="Click para ver los próximos 15 capítulos futuros de tus series"
                    >
                        <div className="agenda-kpi-icon text-info">
                            <Clock size={24} />
                        </div>
                        <div>
                            <div className="agenda-kpi-val" style={{ fontSize: '1.5rem' }}>
                                {proximoEstreno ? dentroDe(proximoEstreno.next_airing_at!) : 'Al día'}
                            </div>
                            <div className="agenda-kpi-label">Próximo capítulo sale en</div>
                            <div className="agenda-kpi-subtext" title={proximoEstreno ? `${proximoEstreno.title_english || proximoEstreno.title} Ep. ${proximoEstreno.next_episode}` : ''}>
                                {proximoEstreno
                                    ? `Ep. ${proximoEstreno.next_episode} · ${proximoEstreno.title_english || proximoEstreno.title}`
                                    : 'Sin estrenos programados'}
                            </div>
                        </div>
                        {subvista === 'proximos' && (
                            <span className="agenda-kpi-active-pill">Viendo</span>
                        )}
                    </div>

                    {/* KPI 3: Minutos Estimados / Gráfico de Tiempo */}
                    <div
                        className={`agenda-kpi-card ${subvista === 'tiempo' ? 'kpi-active' : ''}`}
                        onClick={() => setSubvista('tiempo')}
                        title="Click para ver gráfico de torta con la distribución de tiempo"
                    >
                        <div className="agenda-kpi-icon text-warning">
                            <PieChartIcon size={24} />
                        </div>
                        <div>
                            <div className="agenda-kpi-val">{formatoMinutos(summary.estimated_minutes)}</div>
                            <div className="agenda-kpi-label">Minutos Estimados</div>
                            <div className="agenda-kpi-subtext">Distribución de tiempo</div>
                        </div>
                        {subvista === 'tiempo' && (
                            <span className="agenda-kpi-active-pill">Viendo</span>
                        )}
                    </div>
                </div>
            </header>

            {/* Cabecera Descriptiva de la Sub-vista Activa */}
            <div className="agenda-subview-header">
                <h2 className="agenda-subview-title">
                    {subvista === 'atrasados' && (
                        <>
                            <Flame size={18} className="text-warning" />
                            <span>Animes con Atraso y Próximo Capítulo a Ver</span>
                            <span className="agenda-subview-badge">{animesConAtraso.length} series</span>
                        </>
                    )}
                    {subvista === 'proximos' && (
                        <>
                            <Calendar size={18} style={{ color: '#38bdf8' }} />
                            <span>Próximos Capítulos de tus Series</span>
                            <span className="agenda-subview-badge">{capsFuturos.length} programados</span>
                        </>
                    )}
                    {subvista === 'tiempo' && (
                        <>
                            <PieChartIcon size={18} className="text-warning" />
                            <span>Distribución del Tiempo a Invertir</span>
                            <span className="agenda-subview-badge">{formatoMinutos(datosTorta.totalMinutos)} total</span>
                        </>
                    )}
                </h2>
            </div>

            {/* ==============================================================
                SUB-VISTA 1: ANIMES CON ATRASO (ALTO ENFOQUE EN CANTIDAD Y SIGUIENTE CAP)
               ============================================================== */}
            {subvista === 'atrasados' && (
                <>
                    {isLoading ? (
                        <div className="agenda-zero-state">
                            <div className="spinner-border text-primary mb-3" role="status" />
                            <p className="text-secondary mb-0">Cargando tus animes con atraso...</p>
                        </div>
                    ) : animesConAtraso.length > 0 ? (
                        <div className="agenda-cards-list">
                            {animesConAtraso.map((item: AgendaItem) => {
                                const isSevere = item.episodes_behind >= 4
                                const siguienteCap = item.episodes_watched + 1

                                return (
                                    <article
                                        key={item.entry_id}
                                        className={`agenda-card ${isSevere ? 'card-severe' : 'card-behind'}`}
                                    >
                                        {/* Poster */}
                                        <img
                                            src={item.image_url}
                                            alt={item.title}
                                            className="agenda-card-poster"
                                            onError={alFallarPoster}
                                            onClick={() => onOpenAnimeDetail?.(item.mal_id)}
                                            title="Ver ficha del anime"
                                        />

                                        {/* Contenido en 3 filas completas sin desbordes */}
                                        <div className="agenda-card-content">
                                            {/* Fila 1: Título y Badge de Atraso */}
                                            <div className="agenda-card-header-row">
                                                <h3
                                                    className="agenda-card-title"
                                                    onClick={() => onOpenAnimeDetail?.(item.mal_id)}
                                                    title={item.title_english || item.title}
                                                >
                                                    {item.title_english || item.title}
                                                </h3>

                                                <span
                                                    className={`agenda-delay-badge ${
                                                        isSevere ? 'badge-danger' : 'badge-warning'
                                                    }`}
                                                >
                                                    <AlertCircle size={12} />
                                                    {item.episodes_behind} de atraso
                                                </span>
                                            </div>

                                            {/* Fila 2: Enfoque Siguiente Capítulo + Stepper y Botón Visto */}
                                            <div className="agenda-card-action-row">
                                                <div className="agenda-next-focus-tag">
                                                    <Tv size={14} style={{ color: 'var(--theme-acento, #e8508f)' }} />
                                                    <span>A continuación:</span>
                                                    <strong className="agenda-next-focus-cap">
                                                        Capítulo {siguienteCap}
                                                    </strong>
                                                </div>

                                                <div className="agenda-action-buttons-group">
                                                    {isLinksEnabled && (
                                                        <button
                                                            type="button"
                                                            className="agenda-btn-ver"
                                                            onClick={(e) => openAnimeLink({ title: item.title, title_english: item.title_english }, e)}
                                                            title={`Abrir enlace asociado a ${item.title}`}
                                                        >
                                                            <Play size={11} fill="currentColor" />
                                                            <span>Ver</span>
                                                            <ExternalLink size={10} />
                                                        </button>
                                                    )}

                                                    <div className="agenda-counter-controls">
                                                        <button
                                                            type="button"
                                                            className="agenda-btn-counter"
                                                            title="Restar 1 capítulo"
                                                            disabled={item.episodes_watched <= 0}
                                                            onClick={() => decrementEpisode(item)}
                                                        >
                                                            <Minus size={13} />
                                                        </button>

                                                        <span className="agenda-counter-current" title="Capítulo actual visto">
                                                            {item.episodes_watched}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            className="agenda-btn-counter"
                                                            title="Sumar 1 capítulo"
                                                            onClick={() => incrementEpisode(item)}
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fila 3: Metadatos y Botón Poner al Día */}
                                            <div className="agenda-card-footer-row">
                                                <div className="agenda-footer-meta">
                                                    <span>Vas: <strong>{item.episodes_watched}</strong></span>
                                                    <span className="agenda-meta-sep">·</span>
                                                    <span>Faltan: <strong className="text-warning">{item.episodes_behind}</strong></span>
                                                    <span className="agenda-meta-sep">·</span>
                                                    <span>Tiempo: <strong className="text-info">{formatoTiempo(item.episodes_behind * (item.duration || 24))}</strong></span>
                                                </div>

                                                <div className="agenda-footer-right">
                                                    {item.next_airing_at && (
                                                        <div className="agenda-meta-next" title={`Próximo episodio ${item.next_episode}`}>
                                                            <Clock size={11} />
                                                            <span>Ep. {item.next_episode} {dentroDe(item.next_airing_at)}</span>
                                                        </div>
                                                    )}

                                                    <button
                                                        type="button"
                                                        className="agenda-btn-uptodate"
                                                        disabled={item.is_up_to_date}
                                                        onClick={() => markSetUpToDate(item)}
                                                        title={`Marcar hasta el capítulo ${item.latest_episode} como visto`}
                                                    >
                                                        <Check size={12} />
                                                        <span>¡Poner al día!</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="agenda-zero-state">
                            <div className="agenda-zero-icon">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="h5 text-white mb-2">¡Felicidades! Estás completamente al día 🎉</h3>
                            <p className="text-secondary small mb-0">
                                No tienes ningún capítulo atrasado entre tus animes en emisión.
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* ==============================================================
                SUB-VISTA 2: PRÓXIMOS LANZAMIENTOS (HASTA 15 CAPS, PAGINADOS)
               ============================================================== */}
            {subvista === 'proximos' && (
                <div className="agenda-future-container">
                    {capsFuturos.length === 0 ? (
                        <div className="agenda-zero-state" style={{ background: 'transparent', border: 'none' }}>
                            <div className="agenda-zero-icon">
                                <CalendarCheck size={32} />
                            </div>
                            <h3 className="h5 text-white mb-2">No hay fechas de emisión programadas</h3>
                            <p className="text-secondary small mb-0">
                                Agrega animes en emisión a tu lista para ver el calendario de sus próximos estrenos.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="agenda-future-grid">
                                {capsFuturosPaginados.map((cap) => {
                                    const fechaObj = aFecha(cap.airingAtUnix)
                                    const fechaTexto = fechaLarga(fechaObj)
                                    const horaTexto = horaLocal(cap.airingAtUnix)

                                    return (
                                        <div key={cap.id} className="agenda-future-card">
                                            <div className="agenda-future-left">
                                                <img
                                                    src={cap.imageUrl}
                                                    alt={cap.title}
                                                    className="agenda-future-poster"
                                                    onError={alFallarPoster}
                                                    onClick={() => onOpenAnimeDetail?.(cap.malId)}
                                                    title="Ver anime"
                                                />

                                                <div className="agenda-future-info">
                                                    <h3
                                                        className="agenda-future-title"
                                                        onClick={() => onOpenAnimeDetail?.(cap.malId)}
                                                        title={cap.titleEnglish}
                                                    >
                                                        {cap.titleEnglish}
                                                    </h3>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="agenda-future-ep-badge">
                                                            <Clapperboard size={12} />
                                                            Capítulo {cap.episodeNumber}
                                                        </span>
                                                        <span className="small text-secondary font-mono" style={{ fontSize: '0.75rem' }}>
                                                            Vas en el cap. {cap.episodesWatched}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="agenda-future-right">
                                                <div className="agenda-future-countdown">
                                                    <Clock size={13} />
                                                    <span>Sale {dentroDe(cap.airingAtUnix)}</span>
                                                </div>
                                                <span className="agenda-future-date">
                                                    {fechaTexto}, {horaTexto} hs
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Paginación (5 capítulos por página) */}
                            <div className="agenda-pagination-row">
                                <button
                                    type="button"
                                    className="agenda-page-btn"
                                    disabled={proximosPagina <= 1}
                                    onClick={() => setProximosPagina((p) => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft size={16} />
                                    <span>Anteriores</span>
                                </button>

                                <span className="agenda-page-indicator">
                                    Página {proximosPagina} de {totalPaginasProximos} ({capsFuturos.length} capítulos)
                                </span>

                                <button
                                    type="button"
                                    className="agenda-page-btn"
                                    disabled={proximosPagina >= totalPaginasProximos}
                                    onClick={() => setProximosPagina((p) => Math.min(totalPaginasProximos, p + 1))}
                                >
                                    <span>Siguientes</span>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ==============================================================
                SUB-VISTA 3: GRÁFICO DE TORTA / DISTRIBUCIÓN DE TIEMPO
               ============================================================== */}
            {subvista === 'tiempo' && (
                <div className="agenda-pie-wrapper">
                    {datosTorta.items.length === 0 ? (
                        <div className="agenda-zero-state w-100" style={{ background: 'transparent', border: 'none' }}>
                            <div className="agenda-zero-icon">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="h5 text-white mb-2">¡Cero tiempo pendiente por invertir! 🎉</h3>
                            <p className="text-secondary small mb-0">
                                Estás al día con todos tus animes en emisión, no requieres tiempo de maratón.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Columna Izquierda: Gráfico Donut SVG Reactivo */}
                            <div className="agenda-pie-chart-col">
                                <div className="agenda-pie-svg-container">
                                    <svg viewBox="0 0 200 200" className="agenda-pie-svg">
                                        {/* Pista de fondo */}
                                        <circle
                                            cx="100"
                                            cy="100"
                                            r={datosTorta.radio}
                                            fill="transparent"
                                            stroke="rgba(255, 255, 255, 0.05)"
                                            strokeWidth="28"
                                        />

                                        {/* Segmentos por Anime */}
                                        {datosTorta.items.map((seg) => {
                                            const isHovered = hoveredAnimeId === seg.malId

                                            return (
                                                <circle
                                                    key={seg.malId}
                                                    cx="100"
                                                    cy="100"
                                                    r={datosTorta.radio}
                                                    fill="transparent"
                                                    stroke={seg.color}
                                                    strokeWidth={isHovered ? '34' : '28'}
                                                    strokeDasharray={seg.dasharray}
                                                    strokeDashoffset={seg.dashoffset}
                                                    strokeLinecap="butt"
                                                    style={{
                                                        transition: 'all 0.25s ease',
                                                        cursor: 'pointer',
                                                        filter: isHovered ? `drop-shadow(0 0 8px ${seg.color})` : 'none',
                                                    }}
                                                    onMouseEnter={() => setHoveredAnimeId(seg.malId)}
                                                    onMouseLeave={() => setHoveredAnimeId(null)}
                                                />
                                            )
                                        })}
                                    </svg>

                                    {/* Centro del Donut */}
                                    <div className="agenda-pie-center-text">
                                        <div className="agenda-pie-total-val">
                                            {formatoTiempo(datosTorta.totalMinutos)}
                                        </div>
                                        <div className="agenda-pie-total-label">Tiempo Total</div>
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha: Leyenda Desglosada con Barras */}
                            <div className="agenda-pie-legend">
                                {datosTorta.items.map((item) => {
                                    const isHovered = hoveredAnimeId === item.malId

                                    return (
                                        <div
                                            key={item.malId}
                                            className={`agenda-pie-item ${isHovered ? 'is-hovered' : ''}`}
                                            onMouseEnter={() => setHoveredAnimeId(item.malId)}
                                            onMouseLeave={() => setHoveredAnimeId(null)}
                                            onClick={() => onOpenAnimeDetail?.(item.malId)}
                                            title="Ver anime"
                                        >
                                            <div className="agenda-pie-item-left">
                                                <span
                                                    className="agenda-pie-color-dot"
                                                    style={{ background: item.color }}
                                                />
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.title}
                                                    className="agenda-pie-thumb"
                                                    onError={alFallarPoster}
                                                />
                                                <div className="agenda-pie-item-info">
                                                    <h4 className="agenda-pie-item-title mb-0">{item.title}</h4>
                                                    <span className="agenda-pie-item-behind">
                                                        {item.episodesBehind} {item.episodesBehind === 1 ? 'capítulo' : 'capítulos'} de atraso
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="agenda-pie-item-right">
                                                <div className="agenda-pie-item-time">
                                                    {formatoTiempo(item.minutos)}
                                                </div>
                                                <span className="agenda-pie-item-pct">
                                                    {item.porcentaje.toFixed(0)}% del total
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
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
