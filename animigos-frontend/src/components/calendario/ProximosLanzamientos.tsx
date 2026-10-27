import { BookmarkCheck } from 'lucide-react'
import type { FormatoLanzamiento, Lanzamiento } from '../../services/scheduleApi'
import { DIAS_KANJI, DIAS_NOMBRE } from '../../shared/tiempo'
import { useAhora } from '../../hooks/useAhora'
import { alFallarPoster } from '../mi-lista/mi-lista-data'

const NOMBRE_FORMATO: Record<FormatoLanzamiento, string> = {
    TV: 'Serie', TV_SHORT: 'Serie corta', ONA: 'ONA', MOVIE: 'Película', OVA: 'OVA', SPECIAL: 'Especial',
}

const formatoMes = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })
const formatoMesCorto = new Intl.DateTimeFormat('es', { month: 'short' })

// Series nuevas, temporadas y películas que se estrenan pronto, agrupadas por mes
export function ProximosLanzamientos({ lanzamientos, cargando, error, enMiLista }: {
    lanzamientos: Lanzamiento[]
    cargando: boolean
    error: string | null
    enMiLista: (malId: number | null) => boolean
}) {
    const ahora = useAhora()
    const meses = new Map<string, Lanzamiento[]>()
    for (const l of lanzamientos) {
        const clave = formatoMes.format(l.fecha)
        meses.set(clave, [...(meses.get(clave) ?? []), l])
    }

    const faltan = (fecha: Date) => {
        const dias = Math.ceil((fecha.getTime() - ahora) / 86400000)
        return dias <= 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`
    }

    if (cargando) return <div className="tb-esqueleto" style={{ height: 260 }} aria-label="Cargando lanzamientos" />
    if (error) {
        return (
            <div className="ml-vacio">
                <div className="ml-kaomoji">(´・ω・`)</div>
                No pudimos cargar los próximos lanzamientos. Inténtalo en un rato.
            </div>
        )
    }
    if (lanzamientos.length === 0) {
        return <div className="ml-vacio">No hay lanzamientos con fecha confirmada por ahora.</div>
    }

    return (
        <div className="ml-panel">
            {[...meses.entries()].map(([mes, lista]) => (
                <section key={mes} className="cal-mes">
                    <h2 className="cal-mes-titulo">{mes}</h2>
                    <ol className="cal-lanzamientos">
                        {lista.map((l) => (
                            <li key={l.id} className="cal-lanzamiento">
                                {/* Hoja de calendario japonés (日めくり) con el día del estreno */}
                                <div className="cal-himekuri" aria-hidden="true">
                                    <span className="cal-himekuri-mes">{formatoMesCorto.format(l.fecha)}</span>
                                    <span className="cal-himekuri-dia">{l.fecha.getDate()}</span>
                                    <span className="cal-himekuri-kanji" lang="ja">{DIAS_KANJI[l.fecha.getDay()]}</span>
                                </div>
                                <img className="cal-poster" src={l.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                                <div className="cal-info">
                                    <span className="cal-titulo">{l.titulo}</span>
                                    <span className="cal-meta">
                                        <span className="cal-formato">{NOMBRE_FORMATO[l.formato]}</span>
                                        {l.estudio && <span>{l.estudio}</span>}
                                        {l.episodios && l.formato !== 'MOVIE' && <span>{l.episodios} episodios</span>}
                                        {enMiLista(l.malId) && <span className="cal-tuya"><BookmarkCheck size={12} /> En tu lista</span>}
                                    </span>
                                    <span className="cal-fecha-texto">{DIAS_NOMBRE[l.fecha.getDay()]} {l.fecha.getDate()}</span>
                                </div>
                                <span className="cal-estado">{faltan(l.fecha)}</span>
                            </li>
                        ))}
                    </ol>
                </section>
            ))}
        </div>
    )
}
