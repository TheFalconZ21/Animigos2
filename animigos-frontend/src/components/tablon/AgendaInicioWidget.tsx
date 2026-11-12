/**
 * Widget de Agenda para la pantalla de Inicio / Tablón Social (Pilar 1.2 y 1.3 de AGENTS.md).
 * Muestra el contador de capítulos pendientes en emisión ordenados por atraso en el dashboard.
 */

import { CalendarCheck, CheckCircle2, ChevronRight, Flame } from 'lucide-react'
import { useAgenda } from '../../hooks/useAgenda'
import { alFallarPoster } from '../mi-lista/mi-lista-data'
import type { AgendaItem } from '../../services/agendaApi'

interface AgendaInicioWidgetProps {
    onVerAgenda: () => void
    onOpenAnimeDetail?: (malId: number) => void
}

export function AgendaInicioWidget({ onVerAgenda, onOpenAnimeDetail }: AgendaInicioWidgetProps) {
    const { summary, items, isAuthenticated, incrementEpisode, isLoading } = useAgenda()

    if (!isAuthenticated) return null

    // Tomar los 3 animes con mayor retraso
    const topAtrasados = items.filter((item) => item.episodes_behind > 0).slice(0, 3)

    return (
        <aside className="tb-lateral mb-4" aria-label="Agenda de pendientes">
            <header className="tb-lateral-cabecera">
                <h2 className="tb-lateral-titulo">
                    <CalendarCheck size={16} />
                    Mi Agenda de Emisión
                </h2>
                <button type="button" className="ml-link" onClick={onVerAgenda}>
                    Ver agenda
                </button>
            </header>

            {isLoading ? (
                <div className="tb-esqueleto" aria-label="Cargando agenda" />
            ) : items.length === 0 ? (
                <div className="p-3 text-center">
                    <p className="small text-secondary mb-2">No tienes animes en emisión en tu agenda.</p>
                    <button type="button" className="ml-btn ml-btn-sm w-100" onClick={onVerAgenda}>
                        Explorar estrenos
                    </button>
                </div>
            ) : topAtrasados.length === 0 ? (
                <div className="p-3 text-center">
                    <div className="d-inline-flex p-2 rounded-circle bg-success bg-opacity-10 text-success mb-2">
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="small fw-bold text-white mb-1">¡Estás al día con todos tus estrenos!</div>
                    <p className="text-secondary small mb-2">
                        Sigues {summary.total_series} animes en emisión sin atrasos.
                    </p>
                    <button type="button" className="ml-btn ml-btn-sm w-100" onClick={onVerAgenda}>
                        Ver mi agenda
                    </button>
                </div>
            ) : (
                <>
                    <div className="tb-agenda-kpi">
                        <span className="tb-agenda-kpi-label">Atraso acumulado</span>
                        <span className="tb-agenda-kpi-pill">
                            <Flame size={12} />
                            {summary.total_episodes_behind} caps pendientes
                        </span>
                    </div>

                    <ul className="tb-hoy">
                        {topAtrasados.map((item: AgendaItem) => (
                            <li key={item.entry_id}>
                                <img
                                    src={item.image_url}
                                    alt={item.title}
                                    loading="lazy"
                                    onError={alFallarPoster}
                                    onClick={() => onOpenAnimeDetail?.(item.mal_id)}
                                    title="Ver ficha del anime"
                                />
                                <div style={{ minWidth: 0 }}>
                                    <span
                                        className="tb-hoy-titulo"
                                        onClick={() => onOpenAnimeDetail?.(item.mal_id)}
                                        title={item.title_english || item.title}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {item.title_english || item.title}
                                    </span>
                                    <span className="tb-hoy-meta">
                                        Cap. <strong>{item.episodes_watched}</strong> de {item.latest_episode} ·{' '}
                                        <span className="tb-agenda-faltan">Faltan {item.episodes_behind}</span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="tb-agenda-btn-sumar"
                                    title="Marcar siguiente capítulo como visto"
                                    onClick={() => incrementEpisode(item)}
                                >
                                    +1
                                </button>
                            </li>
                        ))}
                    </ul>

                    <button
                        type="button"
                        className="ml-btn ml-btn-sm w-100 mt-2"
                        onClick={onVerAgenda}
                    >
                        Ver todos ({items.length} en emisión) <ChevronRight size={14} />
                    </button>
                </>
            )}
        </aside>
    )
}

