import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Pin, RefreshCw } from 'lucide-react'
import { NOMBRE_FUENTE, type FuenteNoticia, type Noticia } from '../../services/newsApi'
import { haceCuanto } from '../../shared/tiempo'

type FiltroFuente = 'todas' | FuenteNoticia

const FILTROS: { id: FiltroFuente; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'anmo', label: NOMBRE_FUENTE.anmo },
    { id: 'ramen', label: NOMBRE_FUENTE.ramen },
]

const SEGUNDOS_POR_NOTICIA = 7

// Noticias como publicación fijada al inicio del tablón (avanzan solas)
export function NoticiaFijada({ noticias, actualizando, onActualizar, onVerTodas }: {
    noticias: Noticia[]
    actualizando: boolean
    onActualizar: () => void
    onVerTodas: () => void
}) {
    const [filtro, setFiltro] = useState<FiltroFuente>('todas')
    const [indice, setIndice] = useState(0)
    const [pausado, setPausado] = useState(false)

    const visibles = filtro === 'todas' ? noticias : noticias.filter((n) => n.fuente === filtro)
    const total = visibles.length
    const actual = visibles[indice % Math.max(total, 1)]

    const mover = (paso: number) => setIndice((i) => (i + paso + total) % total)

    useEffect(() => {
        if (pausado || total < 2) return
        const t = setInterval(() => setIndice((i) => (i + 1) % total), SEGUNDOS_POR_NOTICIA * 1000)
        return () => clearInterval(t)
    }, [pausado, total])

    return (
        <section
            className="tb-fijada"
            aria-label="Noticias de anime"
            onMouseEnter={() => setPausado(true)}
            onMouseLeave={() => setPausado(false)}
            onFocus={() => setPausado(true)}
            onBlur={() => setPausado(false)}
        >
            <header className="tb-fijada-cabecera">
                <span className="tb-fijada-titulo"><Pin size={14} /> Fijado · Noticias</span>
                <div className="d-flex align-items-center gap-2">
                    <div className="ml-segmentado tb-segmentado-sm" role="group" aria-label="Fuente">
                        {FILTROS.map((f) => (
                            <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => { setFiltro(f.id); setIndice(0) }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="ml-icon-btn" onClick={onActualizar} aria-label="Actualizar noticias" disabled={actualizando}>
                        <RefreshCw size={15} className={actualizando ? 'tb-girando' : undefined} />
                    </button>
                </div>
            </header>

            {actual ? (
                <div className="tb-fijada-cuerpo" key={actual.id}>
                    <div className="tb-fijada-meta">
                        <span className="tb-fuente">{NOMBRE_FUENTE[actual.fuente]}</span>
                        <span>{actual.categoria}</span>
                        <span>· {haceCuanto(actual.publicadoEn)}</span>
                    </div>
                    <h2 className="tb-fijada-noticia">{actual.titulo}</h2>
                    <p className="mb-0">{actual.resumen}</p>
                </div>
            ) : (
                <div className="ml-vacio py-4">No hay noticias de esta fuente por ahora.</div>
            )}

            {actual && (
                <footer className="tb-fijada-pie">
                    <div className="d-flex align-items-center gap-1">
                        <button type="button" className="ml-icon-btn" onClick={() => mover(-1)} aria-label="Noticia anterior" disabled={total < 2}>
                            <ChevronLeft size={16} />
                        </button>
                        <span className="tb-contador">{(indice % total) + 1} / {total}</span>
                        <button type="button" className="ml-icon-btn" onClick={() => mover(1)} aria-label="Noticia siguiente" disabled={total < 2}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <button type="button" className="ml-link" onClick={onVerTodas}>Ver todas</button>
                        <a className="ml-btn ml-btn-sm" href={actual.enlace} target="_blank" rel="noopener noreferrer">
                            Leer nota <ExternalLink size={13} />
                        </a>
                    </div>
                </footer>
            )}
        </section>
    )
}
