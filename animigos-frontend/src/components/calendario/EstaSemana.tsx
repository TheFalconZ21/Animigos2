import { useMemo, useState } from 'react'
import { BookmarkCheck, Clock } from 'lucide-react'
import { agruparPorDia, type Emision } from '../../services/scheduleApi'
import { DIAS_KANJI, DIAS_NOMBRE, aFecha, dentroDe, horaJapon, horaLocal } from '../../shared/tiempo'
import { useAhora } from '../../hooks/useAhora'
import { alFallarPoster } from '../mi-lista/mi-lista-data'

type Vista = 'dia' | 'semana'

// "Estreno" si es el primer episodio, "Final" si es el último conocido
function hito(e: Emision): 'Estreno' | 'Final' | null {
    if (e.episodio === 1) return 'Estreno'
    if (e.totalEpisodios && e.episodio === e.totalEpisodios) return 'Final'
    return null
}

// Episodios de los próximos 7 días: vista por día (lista) o semana completa (7 columnas)
export function EstaSemana({ emisiones, cargando, error, enMiLista }: {
    emisiones: Emision[]
    cargando: boolean
    error: string | null
    enMiLista: (malId: number | null) => boolean
}) {
    const ahoraMs = useAhora()
    const claveHoy = new Date(ahoraMs).toDateString()
    // Se reagrupa solo si cambian los datos o si pasa la medianoche
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const dias = useMemo(() => agruparPorDia(emisiones, new Date(ahoraMs)), [emisiones, claveHoy])
    const [vista, setVista] = useState<Vista>('dia')
    const [elegido, setElegido] = useState(dias[0].clave)
    const [soloMiLista, setSoloMiLista] = useState(false)
    const ahora = ahoraMs / 1000
    const filtrar = (lista: Emision[]) => (soloMiLista ? lista.filter((e) => enMiLista(e.malId)) : lista)
    const dia = dias.find((d) => d.clave === elegido) ?? dias[0]
    const lista = filtrar(dia.emisiones)

    return (
        <div className="ml-panel">
            <div className="cal-controles">
                <div className="ml-segmentado" role="group" aria-label="Vista">
                    <button type="button" aria-pressed={vista === 'dia'} onClick={() => setVista('dia')}>Por día</button>
                    <button type="button" aria-pressed={vista === 'semana'} onClick={() => setVista('semana')}>Semana completa</button>
                </div>
                <button type="button" className="ml-chip" aria-pressed={soloMiLista} onClick={() => setSoloMiLista(!soloMiLista)}>
                    <BookmarkCheck size={14} /> Solo de mi lista
                </button>
            </div>

            {cargando && <div className="tb-esqueleto" style={{ height: 260 }} aria-label="Cargando horario" />}
            {error && !cargando && (
                <div className="ml-vacio">
                    <div className="ml-kaomoji">(´・ω・`)</div>
                    No pudimos cargar el horario de emisión. Inténtalo en un rato.
                </div>
            )}

            {!cargando && !error && vista === 'dia' && (
                <>
                    {/* Tira de la semana: kanji del día, cuántos episodios hay y sus primeras portadas */}
                    <div className="cal-tira" role="tablist" aria-label="Días de la semana">
                        {dias.map((d, i) => (
                            <button key={d.clave} type="button" role="tab" className="cal-dia" aria-selected={d.clave === dia.clave} onClick={() => setElegido(d.clave)}>
                                <span className="cal-dia-kanji" lang="ja">{DIAS_KANJI[d.fecha.getDay()]}</span>
                                <span className="cal-dia-nombre">{i === 0 ? 'Hoy' : DIAS_NOMBRE[d.fecha.getDay()].slice(0, 3)}</span>
                                <span className="cal-dia-num">{d.fecha.getDate()}</span>
                                <span className="cal-dia-cuenta">{filtrar(d.emisiones).length} ep.</span>
                                <span className="cal-dia-portadas" aria-hidden="true">
                                    {filtrar(d.emisiones).slice(0, 3).map((e) => <img key={e.id} src={e.imagenUrl} alt="" loading="lazy" />)}
                                </span>
                            </button>
                        ))}
                    </div>

                    <h2 className="cal-dia-titulo">
                        <span lang="ja">{DIAS_KANJI[dia.fecha.getDay()]}曜日</span> {DIAS_NOMBRE[dia.fecha.getDay()]} {dia.fecha.getDate()}
                        <span>{lista.length} {lista.length === 1 ? 'episodio' : 'episodios'}</span>
                    </h2>

                    {lista.length === 0 ? (
                        <div className="ml-vacio py-4">
                            <div className="ml-kaomoji">( ˘ω˘ )</div>
                            {soloMiLista ? 'Ningún anime de tu lista se emite este día.' : 'No hay estrenos registrados este día.'}
                        </div>
                    ) : (
                        <ol className="cal-emisiones">
                            {lista.map((e) => {
                                const yaSalio = e.emiteEn <= ahora
                                const mio = enMiLista(e.malId)
                                const marca = hito(e)
                                return (
                                    <li key={e.id} className={`cal-emision ${yaSalio ? 'cal-pasada' : ''} ${mio ? 'cal-mia' : ''}`}>
                                        <time className="cal-hora" dateTime={aFecha(e.emiteEn).toISOString()}>
                                            <strong>{horaLocal(e.emiteEn)}</strong>
                                            <span title="Hora de Japón">JST {horaJapon(e.emiteEn)}</span>
                                        </time>
                                        <img className="cal-poster" src={e.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                                        <div className="cal-info">
                                            <span className="cal-titulo">{e.titulo}</span>
                                            <span className="cal-meta">
                                                Episodio {e.episodio}{e.totalEpisodios ? ` de ${e.totalEpisodios}` : ''}
                                                {marca && <span className="cal-hito">{marca}</span>}
                                                {mio && <span className="cal-tuya"><BookmarkCheck size={12} /> En tu lista</span>}
                                            </span>
                                        </div>
                                        <span className="cal-estado">
                                            {yaSalio ? 'Ya salió' : <><Clock size={12} /> {dentroDe(e.emiteEn, ahoraMs)}</>}
                                        </span>
                                    </li>
                                )
                            })}
                        </ol>
                    )}
                </>
            )}

            {!cargando && !error && vista === 'semana' && (
                <div className="cal-semana">
                    {dias.map((d, i) => (
                        <section key={d.clave} className={`cal-columna ${i === 0 ? 'cal-columna-hoy' : ''}`} aria-label={`${DIAS_NOMBRE[d.fecha.getDay()]} ${d.fecha.getDate()}`}>
                            <header className="cal-columna-cabecera">
                                <span className="cal-dia-kanji" lang="ja">{DIAS_KANJI[d.fecha.getDay()]}</span>
                                <span className="cal-dia-nombre">{i === 0 ? 'Hoy' : DIAS_NOMBRE[d.fecha.getDay()].slice(0, 3)} {d.fecha.getDate()}</span>
                            </header>
                            {filtrar(d.emisiones).map((e) => {
                                const marca = hito(e)
                                return (
                                    <article key={e.id} className={`cal-ficha ${e.emiteEn <= ahora ? 'cal-pasada' : ''} ${enMiLista(e.malId) ? 'cal-mia' : ''}`} title={e.titulo}>
                                        <img src={e.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                                        <div style={{ minWidth: 0 }}>
                                            <span className="cal-ficha-hora">{horaLocal(e.emiteEn)}</span>
                                            <span className="cal-ficha-titulo">{e.titulo}</span>
                                            <span className="cal-ficha-ep">Ep. {e.episodio}{marca && <span className="cal-hito">{marca}</span>}</span>
                                        </div>
                                    </article>
                                )
                            })}
                            {filtrar(d.emisiones).length === 0 && <p className="cal-columna-vacia">—</p>}
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
