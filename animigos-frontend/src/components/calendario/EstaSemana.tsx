import { useEffect, useMemo, useState } from 'react'
import { BookmarkCheck, ChevronLeft, ChevronRight, Clock, LayoutList, Pause, Play, Sparkles, Square } from 'lucide-react'
import { agruparPorDia, type Emision } from '../../services/scheduleApi'
import { DIAS_KANJI, DIAS_NOMBRE, aFecha, dentroDe, horaJapon, horaLocal } from '../../shared/tiempo'
import { useAhora } from '../../hooks/useAhora'
import { alFallarPoster } from '../mi-lista/mi-lista-data'

type Vista = 'lista' | 'individual'

// "Estreno" si es el primer episodio, "Final" si es el último conocido
function hito(e: Emision): 'Estreno' | 'Final' | null {
    if (e.episodio === 1) return 'Estreno'
    if (e.totalEpisodios && e.episodio === e.totalEpisodios) return 'Final'
    return null
}

// Episodios de los próximos 7 días: selector de días arriba, vista "Lista" o "Individual" debajo
export function EstaSemana({
    emisiones,
    cargando,
    error,
    enMiLista,
    onSeleccionarAnime,
}: {
    emisiones: Emision[]
    cargando: boolean
    error: string | null
    enMiLista: (malId: number | null) => boolean
    onSeleccionarAnime?: (emision: Emision) => void
}) {
    const ahoraMs = useAhora()
    const claveHoy = new Date(ahoraMs).toDateString()
    // Se reagrupa solo si cambian los datos o si pasa la medianoche
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const dias = useMemo(() => agruparPorDia(emisiones, new Date(ahoraMs)), [emisiones, claveHoy])
    const [vista, setVista] = useState<Vista>('lista')
    const [elegido, setElegido] = useState(dias[0].clave)
    const [soloMiLista, setSoloMiLista] = useState(false)

    // Estado para la vista Individual (carrusel automático cada 10s controlable por el usuario)
    const [indiceActual, setIndiceActual] = useState(0)
    const [pausadoManual, setPausadoManual] = useState(false)
    const [pausadoHover, setPausadoHover] = useState(false)

    const ahora = ahoraMs / 1000
    const filtrar = (items: Emision[]) => (soloMiLista ? items.filter((e) => enMiLista(e.malId)) : items)
    const dia = dias.find((d) => d.clave === elegido) ?? dias[0]
    const lista = filtrar(dia.emisiones)

    // Reiniciar índice al cambiar de día, filtro o tamaño de lista
    useEffect(() => {
        setIndiceActual(0)
    }, [dia.clave, soloMiLista, lista.length])

    // Avance automático cada 10 segundos en vista Individual
    const estaPausado = pausadoManual || pausadoHover
    useEffect(() => {
        if (vista !== 'individual' || estaPausado || lista.length <= 1) return
        const timer = setInterval(() => {
            setIndiceActual((prev) => (prev + 1) % lista.length)
        }, 10000)
        return () => clearInterval(timer)
    }, [vista, estaPausado, lista.length])

    const indiceSeguro = lista.length > 0 ? Math.min(indiceActual, lista.length - 1) : 0
    const emisionActual = lista[indiceSeguro] ?? null

    const irAnterior = () => {
        if (lista.length <= 1) return
        setIndiceActual((prev) => (prev - 1 + lista.length) % lista.length)
    }

    const irSiguiente = () => {
        if (lista.length <= 1) return
        setIndiceActual((prev) => (prev + 1) % lista.length)
    }

    return (
        <div className="ml-panel">
            {cargando && <div className="tb-esqueleto" style={{ height: 260 }} aria-label="Cargando horario" />}
            {error && !cargando && (
                <div className="ml-vacio">
                    <div className="ml-kaomoji">(´・ω・`)</div>
                    No pudimos cargar el horario de emisión. Inténtalo en un rato.
                </div>
            )}

            {!cargando && !error && (
                <>
                    {/* 1. Tira de botones de los días de la semana */}
                    <div className="cal-tira" role="tablist" aria-label="Días de la semana">
                        {dias.map((d, i) => (
                            <button
                                key={d.clave}
                                type="button"
                                role="tab"
                                className="cal-dia"
                                aria-selected={d.clave === dia.clave}
                                onClick={() => setElegido(d.clave)}
                            >
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

                    {/* 2. Selector entre "Lista" e "Individual" debajo de los botones de los días */}
                    <div className="cal-controles mt-3">
                        <div className="ml-segmentado" role="group" aria-label="Modo de visualización">
                            <button type="button" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>
                                <LayoutList size={14} /> Lista
                            </button>
                            <button type="button" aria-pressed={vista === 'individual'} onClick={() => setVista('individual')}>
                                <Square size={14} /> Individual
                            </button>
                        </div>
                        <button type="button" className="ml-chip" aria-pressed={soloMiLista} onClick={() => setSoloMiLista(!soloMiLista)}>
                            <BookmarkCheck size={14} /> Solo de mi lista
                        </button>
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
                    ) : vista === 'lista' ? (
                        <ol className="cal-emisiones">
                            {lista.map((e) => {
                                const yaSalio = e.emiteEn <= ahora
                                const mio = enMiLista(e.malId)
                                const marca = hito(e)
                                return (
                                    <li
                                        key={e.id}
                                        className={`cal-emision cal-emision-interactive ${yaSalio ? 'cal-pasada' : ''} ${mio ? 'cal-mia' : ''}`}
                                        onClick={() => onSeleccionarAnime?.(e)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(evt) => {
                                            if (evt.key === 'Enter' || evt.key === ' ') {
                                                evt.preventDefault()
                                                onSeleccionarAnime?.(e)
                                            }
                                        }}
                                        title="Haz clic para ver detalles y evaluar agregar a Mi Lista"
                                    >
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
                    ) : (
                        emisionActual && (() => {
                            const yaSalio = emisionActual.emiteEn <= ahora
                            const mio = enMiLista(emisionActual.malId)
                            const marca = hito(emisionActual)
                            return (
                                <div
                                    className="cal-individual-wrap"
                                    onMouseEnter={() => setPausadoHover(true)}
                                    onMouseLeave={() => setPausadoHover(false)}
                                >
                                    <article
                                        key={emisionActual.id}
                                        className={`cal-individual-card ${yaSalio ? 'cal-pasada' : ''} ${mio ? 'cal-mia' : ''}`}
                                    >
                                        {/* Barra de progreso visual de 10s */}
                                        {lista.length > 1 && (
                                            <div className="cal-ind-progress-track" aria-hidden="true">
                                                <div
                                                    key={`${emisionActual.id}-${indiceSeguro}-${pausadoManual ? 'p' : 'r'}`}
                                                    className={`cal-ind-progress-fill ${estaPausado ? 'is-paused' : ''}`}
                                                />
                                            </div>
                                        )}

                                        <div className="cal-ind-body">
                                            <div
                                                className="cal-ind-poster-wrap"
                                                onClick={() => onSeleccionarAnime?.(emisionActual)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(evt) => {
                                                    if (evt.key === 'Enter' || evt.key === ' ') {
                                                        evt.preventDefault()
                                                        onSeleccionarAnime?.(emisionActual)
                                                    }
                                                }}
                                            >
                                                <img
                                                    src={emisionActual.imagenUrl}
                                                    alt={emisionActual.titulo}
                                                    className="cal-ind-poster"
                                                    onError={alFallarPoster}
                                                />
                                            </div>

                                            <div className="cal-ind-info">
                                                <div className="cal-ind-badges">
                                                    <span className="cal-ind-counter">
                                                        {indiceSeguro + 1} / {lista.length}
                                                    </span>
                                                    {marca && <span className="cal-hito">{marca}</span>}
                                                    {mio && (
                                                        <span className="cal-tuya">
                                                            <BookmarkCheck size={12} /> En tu lista
                                                        </span>
                                                    )}
                                                </div>

                                                <h3
                                                    className="cal-ind-title"
                                                    onClick={() => onSeleccionarAnime?.(emisionActual)}
                                                >
                                                    {emisionActual.titulo}
                                                </h3>

                                                {emisionActual.tituloRomaji &&
                                                    emisionActual.tituloRomaji !== emisionActual.titulo && (
                                                        <p className="cal-ind-subtitle">{emisionActual.tituloRomaji}</p>
                                                    )}

                                                <div className="cal-ind-meta-grid">
                                                    <div className="cal-ind-meta-box">
                                                        <span className="cal-ind-meta-label">Episodio</span>
                                                        <strong className="cal-ind-meta-val">
                                                            Ep. {emisionActual.episodio}
                                                            {emisionActual.totalEpisodios ? ` de ${emisionActual.totalEpisodios}` : ''}
                                                        </strong>
                                                    </div>
                                                    <div className="cal-ind-meta-box">
                                                        <span className="cal-ind-meta-label">Hora local</span>
                                                        <strong className="cal-ind-meta-val">
                                                            {horaLocal(emisionActual.emiteEn)}
                                                            <span className="cal-ind-jst"> · JST {horaJapon(emisionActual.emiteEn)}</span>
                                                        </strong>
                                                    </div>
                                                    <div className="cal-ind-meta-box">
                                                        <span className="cal-ind-meta-label">Estado</span>
                                                        <strong className="cal-ind-meta-val">
                                                            {yaSalio ? (
                                                                'Ya salió'
                                                            ) : (
                                                                <span className="d-inline-flex align-items-center gap-1">
                                                                    <Clock size={13} /> {dentroDe(emisionActual.emiteEn, ahoraMs)}
                                                                </span>
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div className="cal-ind-cta-row">
                                                    <button
                                                        type="button"
                                                        className="ml-btn ml-btn-acento ml-btn-sm"
                                                        onClick={() => onSeleccionarAnime?.(emisionActual)}
                                                    >
                                                        <Sparkles size={14} /> Ver ficha y detalles
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Controles inferiores: Anterior / Pausar / Indicadores / Siguiente */}
                                        <footer className="cal-ind-footer">
                                            <div className="cal-ind-nav-group">
                                                <button
                                                    type="button"
                                                    className="cal-ind-ctrl-btn"
                                                    onClick={irAnterior}
                                                    disabled={lista.length <= 1}
                                                    title="Anime anterior"
                                                    aria-label="Anime anterior"
                                                >
                                                    <ChevronLeft size={16} />
                                                    <span>Anterior</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cal-ind-ctrl-btn is-icon"
                                                    onClick={() => setPausadoManual((p) => !p)}
                                                    disabled={lista.length <= 1}
                                                    title={pausadoManual ? 'Reanudar avance automático (10s)' : 'Pausar avance automático'}
                                                    aria-label={pausadoManual ? 'Reanudar' : 'Pausar'}
                                                >
                                                    {pausadoManual ? <Play size={14} /> : <Pause size={14} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cal-ind-ctrl-btn"
                                                    onClick={irSiguiente}
                                                    disabled={lista.length <= 1}
                                                    title="Siguiente anime"
                                                    aria-label="Siguiente anime"
                                                >
                                                    <span>Siguiente</span>
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>

                                            <div className="cal-ind-dots" role="tablist" aria-label="Estrenos del día">
                                                {lista.slice(0, 14).map((item, idx) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={idx === indiceSeguro}
                                                        className={`cal-ind-dot ${idx === indiceSeguro ? 'is-active' : ''}`}
                                                        onClick={() => setIndiceActual(idx)}
                                                        title={`${idx + 1}. ${item.titulo}`}
                                                    />
                                                ))}
                                                {lista.length > 14 && (
                                                    <span className="cal-ind-more">+{lista.length - 14}</span>
                                                )}
                                            </div>

                                            <span className="cal-ind-auto-hint">
                                                {lista.length <= 1
                                                    ? '1 estreno hoy'
                                                    : estaPausado
                                                      ? 'Pausado'
                                                      : 'Siguiente en 10s'}
                                            </span>
                                        </footer>
                                    </article>
                                </div>
                            )
                        })()
                    )}
                </>
            )}
        </div>
    )
}
