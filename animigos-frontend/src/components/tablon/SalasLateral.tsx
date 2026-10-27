import { ArrowRight, Plus, Users, Vote } from 'lucide-react'
import type { RoomSummary } from '../../services/watchPartyApi'

const ESTADO_SALA: Record<RoomSummary['status'], string> = {
    candidates: 'Candidatos abiertos',
    voting: 'Votación en curso',
    selected: 'Anime elegido',
    watching: 'Viendo juntos',
    completed: 'Terminada',
}

// El candidato que va ganando: mayor puntaje de felicidad o, si no hay, mayor interés medio
function lider(sala: RoomSummary) {
    if (sala.selected_anime) return { titulo: sala.selected_anime.title, puntaje: sala.selected_anime.score }
    const mejor = [...sala.candidates].sort(
        (a, b) => (b.happiness_result?.final_score ?? b.avg_interest) - (a.happiness_result?.final_score ?? a.avg_interest),
    )[0]
    return mejor ? { titulo: mejor.title, puntaje: mejor.happiness_result?.final_score ?? mejor.avg_interest } : null
}

// Columna lateral: salas grupales activas (datos reales del backend)
export function SalasLateral({ salas, cargando, error, onEntrar }: {
    salas: RoomSummary[]
    cargando: boolean
    error: string | null
    onEntrar: (codigo?: string) => void
}) {
    const activas = salas.filter((s) => s.status !== 'completed')

    return (
        <aside className="tb-lateral" aria-label="Tus salas grupales">
            <header className="tb-lateral-cabecera">
                <h2 className="tb-lateral-titulo"><Users size={16} /> Salas activas</h2>
                {activas.length > 0 && (
                    <button type="button" className="ml-link" onClick={() => onEntrar()}>Ver todas</button>
                )}
            </header>

            {cargando && <div className="tb-esqueleto" aria-label="Cargando salas" />}

            {error && !cargando && (
                <p className="small mb-0">No pudimos cargar las salas. ¿Está encendido el backend?</p>
            )}

            {!cargando && !error && activas.length === 0 && (
                <div className="ml-vacio py-3">
                    <div className="ml-kaomoji">( ´ ▽ ` )ﾉ</div>
                    <p className="small">Todavía no hay salas. Crea una para decidir qué ver con tus amigos.</p>
                    <button type="button" className="ml-btn ml-btn-sm" onClick={() => onEntrar()}>
                        <Plus size={14} /> Crear sala
                    </button>
                </div>
            )}

            <div className="d-flex flex-column gap-2">
                {activas.slice(0, 4).map((s) => {
                    const top = lider(s)
                    const votando = s.status === 'voting' || s.status === 'candidates'
                    return (
                        <div key={s.id} className={`tb-sala ${votando ? 'tb-sala-votando' : ''}`}>
                            <div className="d-flex justify-content-between align-items-center gap-2">
                                <span className="tb-sala-estado">{ESTADO_SALA[s.status]}</span>
                                <span className="small"><Users size={12} /> {s.members_count}</span>
                            </div>
                            <h3 className="tb-sala-nombre">{s.name}</h3>
                            {top && (
                                <p className="tb-sala-lider">
                                    Va ganando <strong>{top.titulo}</strong>
                                    {top.puntaje !== null && <span> · {Number(top.puntaje).toFixed(1)}</span>}
                                </p>
                            )}
                            <button
                                type="button"
                                className={`ml-btn ml-btn-sm w-100 ${votando ? 'ml-btn-acento' : ''}`}
                                onClick={() => onEntrar(s.invite_code)}
                            >
                                {votando ? <><Vote size={14} /> Ir a votar</> : <>Entrar a la sala <ArrowRight size={14} /></>}
                            </button>
                        </div>
                    )
                })}
            </div>
        </aside>
    )
}
