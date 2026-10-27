import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Newspaper, Pause, Users } from 'lucide-react'
import type { Noticia } from '../../services/newsApi'
import { NoticiasBanner } from './NoticiasBanner'

const SEGUNDOS_POR_VISTA = 15

/**
 * Alterna cada 15 s entre el banner del Tablón y una noticia del día (en bucle).
 * - Las dos capas ocupan la misma celda, así el cambio es un fundido sin saltos de altura.
 * - Se pausa mientras el usuario tiene el mouse o el foco encima, para que no le cambie
 *   el contenido mientras lee o hace clic.
 * - Cada vez que vuelve a las noticias, muestra la siguiente.
 */
export function BannerRotativo({ bannerTablon, noticias, ahora, onVerTodas }: {
    bannerTablon: ReactNode
    noticias: Noticia[]
    ahora: number
    onVerTodas: () => void
}) {
    const [enNoticias, setEnNoticias] = useState(false)
    const [indice, setIndice] = useState(0)
    const [pausado, setPausado] = useState(false)
    const hayNoticias = noticias.length > 0
    // Tiempo que le queda a la vista actual: al pausar se guarda, al reanudar se continúa
    const restante = useRef(SEGUNDOS_POR_VISTA * 1000)

    useEffect(() => {
        restante.current = SEGUNDOS_POR_VISTA * 1000
    }, [enNoticias])

    useEffect(() => {
        if (pausado || !hayNoticias) return
        const inicio = Date.now()
        const t = setTimeout(() => {
            // Al volver al tablón se prepara la siguiente noticia para la próxima vuelta
            if (enNoticias) setIndice((i) => (i + 1) % noticias.length)
            setEnNoticias(!enNoticias)
        }, restante.current)
        return () => {
            clearTimeout(t)
            restante.current = Math.max(0, restante.current - (Date.now() - inicio))
        }
    }, [enNoticias, pausado, hayNoticias, noticias.length])

    const noticia = hayNoticias ? noticias[indice % noticias.length] : null
    const mostrar = (aNoticias: boolean) => setEnNoticias(aNoticias && hayNoticias)

    return (
        <div
            className="tb-rotativo"
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocus={() => setPausado(true)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPausado(false) }}
        >
            <div className="tb-rotativo-capas">
                <div className="tb-capa" data-activa={!enNoticias} inert={enNoticias}>
                    {bannerTablon}
                </div>
                {noticia && (
                    <div className="tb-capa" data-activa={enNoticias} inert={!enNoticias}>
                        <NoticiasBanner noticia={noticia} posicion={(indice % noticias.length) + 1} total={noticias.length} ahora={ahora} onVerTodas={onVerTodas} />
                    </div>
                )}
            </div>

            {hayNoticias && (
                <div className="tb-rotativo-control" role="group" aria-label="Contenido del recuadro principal">
                    {pausado && <span className="tb-rotativo-pausa"><Pause size={11} /> En pausa</span>}
                    {([false, true] as const).map((aNoticias) => {
                        const activa = enNoticias === aNoticias
                        return (
                            <button
                                key={String(aNoticias)}
                                type="button"
                                className="tb-rotativo-boton"
                                aria-pressed={activa}
                                onClick={() => mostrar(aNoticias)}
                            >
                                {aNoticias ? <><Newspaper size={13} /> Noticias del día</> : <><Users size={13} /> Tablón</>}
                                {/* Barra que se llena en 15 s; se reinicia en cada cambio (key) */}
                                {activa && (
                                    <span
                                        key={`${enNoticias}-${indice}`}
                                        className="tb-rotativo-progreso"
                                        style={{ animationDuration: `${SEGUNDOS_POR_VISTA}s`, animationPlayState: pausado ? 'paused' : 'running' }}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
