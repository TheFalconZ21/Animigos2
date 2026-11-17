import { BookmarkCheck, Bell, Clock } from 'lucide-react'
import type { FormatoLanzamiento, Lanzamiento } from '../../services/scheduleApi'
import { DIAS_KANJI, DIAS_NOMBRE } from '../../shared/tiempo'
import { useAhora } from '../../hooks/useAhora'
import { alFallarPoster, type FilaLista } from '../mi-lista/mi-lista-data'

const NOMBRE_FORMATO: Record<FormatoLanzamiento, string> = {
    TV: 'Serie', TV_SHORT: 'Serie corta', ONA: 'ONA', MOVIE: 'Película', OVA: 'OVA', SPECIAL: 'Especial',
}

const formatoMes = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })
const formatoMesCorto = new Intl.DateTimeFormat('es', { month: 'short' })

interface Props {
    lanzamientos: Lanzamiento[]
    cargando: boolean
    error: string | null
    enMiLista: (malId: number | null) => boolean
    filas?: FilaLista[]
    onSeleccionarAnime?: (lanzamiento: Lanzamiento) => void
    onMarcarEsperando?: (lanzamiento: Lanzamiento) => void
}

// Series nuevas, temporadas y películas que se estrenan pronto, agrupadas por mes
export function ProximosLanzamientos({
    lanzamientos,
    cargando,
    error,
    enMiLista: _enMiLista,
    filas = [],
    onSeleccionarAnime,
    onMarcarEsperando,
}: Props) {
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
                        {lista.map((l) => {
                            const entrada = l.malId ? filas.find((f) => f.malId === l.malId) : null
                            const esEsperando = entrada?.estado === 'esperando'

                            return (
                                <li
                                    key={l.id}
                                    className={`cal-lanzamiento cal-lanzamiento-interactive ${esEsperando ? 'cal-lanzamiento-esperando' : ''}`}
                                    onClick={() => onSeleccionarAnime?.(l)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            onSeleccionarAnime?.(l)
                                        }
                                    }}
                                    title="Haz clic para revisar y ver detalles del anime"
                                >
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
                                            {l.season && <span>{l.season}{l.year ? ` ${l.year}` : ''}</span>}
                                            {l.estudio && <span>{l.estudio}</span>}
                                            {l.episodios && l.formato !== 'MOVIE' && <span>{l.episodios} episodios</span>}
                                            {entrada && (
                                                <span
                                                    className="cal-tuya"
                                                    style={{
                                                        color: esEsperando ? 'var(--ml-esperando, #38bdf8)' : undefined,
                                                        borderColor: esEsperando ? 'rgba(56, 189, 248, 0.3)' : undefined,
                                                    }}
                                                >
                                                    <BookmarkCheck size={12} />
                                                    {esEsperando ? 'Esperando estreno' : `En tu lista · ${entrada.estado}`}
                                                </span>
                                            )}
                                        </span>
                                        <span className="cal-fecha-texto">{DIAS_NOMBRE[l.fecha.getDay()]} {l.fecha.getDate()}</span>
                                    </div>

                                    <div className="cal-lanzamiento-acciones">
                                        <span className="cal-estado me-2">{faltan(l.fecha)}</span>

                                        {onMarcarEsperando && (
                                            <button
                                                type="button"
                                                className={`cal-btn-esperar ${esEsperando ? 'cal-btn-esperando-activo' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onMarcarEsperando(l)
                                                }}
                                                title={esEsperando ? 'Estás esperando este estreno. Haz clic para gestionar.' : 'Marcar anime como "Esperando su estreno"'}
                                            >
                                                {esEsperando ? (
                                                    <>
                                                        <Clock size={13} />
                                                        <span>Esperando</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Bell size={13} />
                                                        <span>Esperar estreno</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                </section>
            ))}
        </div>
    )
}
