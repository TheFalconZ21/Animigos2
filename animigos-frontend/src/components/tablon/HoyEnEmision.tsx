import { CalendarDays } from 'lucide-react'
import { agruparPorDia, type Emision } from '../../services/scheduleApi'
import { DIAS_KANJI, dentroDe, horaLocal } from '../../shared/tiempo'
import { alFallarPoster } from '../mi-lista/mi-lista-data'
import { useAhora } from '../../hooks/useAhora'

const MAXIMO = 4

// Columna lateral: los próximos episodios de hoy; si ya salieron todos, los de mañana
export function HoyEnEmision({ emisiones, cargando, onVerSemana }: {
    emisiones: Emision[]
    cargando: boolean
    onVerSemana: () => void
}) {
    const ahoraMs = useAhora()
    const ahora = ahoraMs / 1000
    const [diaHoy, diaManana] = agruparPorDia(emisiones, new Date(ahoraMs))
    const quedanHoy = diaHoy.emisiones.some((e) => e.emiteEn > ahora)
    const hoy = quedanHoy ? diaHoy : diaManana
    const mostrar = hoy.emisiones.filter((e) => e.emiteEn > ahora).slice(0, MAXIMO)

    return (
        <aside className="tb-lateral" aria-label="Próximos estrenos">
            <header className="tb-lateral-cabecera">
                <h2 className="tb-lateral-titulo">
                    <span className="tb-kanji-hoy" lang="ja">{DIAS_KANJI[hoy.fecha.getDay()]}</span> {quedanHoy ? 'Hoy en emisión' : 'Mañana en emisión'}
                </h2>
                <button type="button" className="ml-link" onClick={onVerSemana}>Ver calendario</button>
            </header>

            {cargando && <div className="tb-esqueleto" aria-label="Cargando horario" />}

            {!cargando && mostrar.length === 0 && (
                <p className="small mb-0">No hay estrenos registrados por ahora.</p>
            )}

            <ul className="tb-hoy">
                {mostrar.map((e) => (
                    <li key={e.id}>
                        <img src={e.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                        <div style={{ minWidth: 0 }}>
                            <span className="tb-hoy-titulo">{e.titulo}</span>
                            <span className="tb-hoy-meta">Ep. {e.episodio} · {horaLocal(e.emiteEn)}</span>
                        </div>
                        <span className="tb-hoy-falta">{dentroDe(e.emiteEn, ahoraMs)}</span>
                    </li>
                ))}
            </ul>

            {!cargando && hoy.emisiones.length > MAXIMO && (
                <button type="button" className="ml-btn ml-btn-sm w-100 mt-2" onClick={onVerSemana}>
                    <CalendarDays size={14} /> Ver los {hoy.emisiones.length} episodios de {quedanHoy ? 'hoy' : 'mañana'}
                </button>
            )}
        </aside>
    )
}
