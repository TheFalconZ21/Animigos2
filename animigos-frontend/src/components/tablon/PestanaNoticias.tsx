import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { NOMBRE_FUENTE, type FuenteNoticia, type Noticia } from '../../services/newsApi'
import { fechaLarga, haceCuanto } from '../../shared/tiempo'
import { useAhora } from '../../hooks/useAhora'

type FiltroFuente = 'todas' | FuenteNoticia

const FILTROS: { id: FiltroFuente; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'anmo', label: NOMBRE_FUENTE.anmo },
    { id: 'ramen', label: NOMBRE_FUENTE.ramen },
]

// Noticias presentadas como la portada de un periódico (新聞): principal, titulares y el resto
export function PestanaNoticias({ noticias, cargando, error, actualizando, onActualizar }: {
    noticias: Noticia[]
    cargando: boolean
    error: string | null
    actualizando: boolean
    onActualizar: () => void
}) {
    const [filtro, setFiltro] = useState<FiltroFuente>('todas')
    const ahora = useAhora()
    const visibles = filtro === 'todas' ? noticias : noticias.filter((n) => n.fuente === filtro)
    const [principal, ...resto] = visibles
    const titulares = resto.slice(0, 3)
    const demas = resto.slice(3)

    return (
        <div className="ml-panel">
            <header className="tb-cabecera-diario">
                <div>
                    <span className="tb-diario-nombre"><span lang="ja">新聞</span> Noticias del anime</span>
                    <span className="tb-diario-fecha">Edición del {fechaLarga(new Date(ahora))}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <div className="ml-segmentado tb-segmentado-sm" role="group" aria-label="Fuente">
                        {FILTROS.map((f) => (
                            <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label}</button>
                        ))}
                    </div>
                    <button type="button" className="ml-icon-btn" onClick={onActualizar} aria-label="Actualizar noticias" disabled={actualizando}>
                        <RefreshCw size={15} className={actualizando ? 'tb-girando' : undefined} />
                    </button>
                </div>
            </header>

            {cargando && (
                <div className="tb-diario-cargando">
                    <div className="tb-esqueleto" style={{ height: 300 }} />
                    <p className="small mt-2 mb-0">Reuniendo las noticias de hoy… la primera carga puede tardar unos segundos.</p>
                </div>
            )}
            {error && !cargando && (
                <div className="ml-vacio">
                    <div className="ml-kaomoji">(´・ω・`)</div>
                    No pudimos traer las noticias ahora. <button type="button" className="ml-link" onClick={onActualizar}>Reintentar</button>
                </div>
            )}

            {principal && (
                <div className="tb-portada">
                    <a className="tb-nota-principal" href={principal.enlace} target="_blank" rel="noopener noreferrer">
                        <ImagenNoticia noticia={principal} />
                        <div className="tb-nota-principal-texto">
                            <MetaNoticia noticia={principal} />
                            <h2>{principal.titulo}</h2>
                            <p>{principal.resumen}</p>
                            <span className="tb-leer">Leer en {NOMBRE_FUENTE[principal.fuente]} <ExternalLink size={13} /></span>
                        </div>
                    </a>

                    <div className="tb-titulares">
                        {titulares.map((n) => (
                            <a key={n.id} className="tb-titular" href={n.enlace} target="_blank" rel="noopener noreferrer">
                                <ImagenNoticia noticia={n} />
                                <div>
                                    <MetaNoticia noticia={n} />
                                    <h3>{n.titulo}</h3>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {demas.length > 0 && (
                <div className="tb-noticias-grid">
                    {demas.map((n) => (
                        <a key={n.id} className="tb-noticia" href={n.enlace} target="_blank" rel="noopener noreferrer">
                            <ImagenNoticia noticia={n} />
                            <div className="tb-noticia-texto">
                                <MetaNoticia noticia={n} />
                                <h3>{n.titulo}</h3>
                                <p>{n.resumen}</p>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    )
}

function MetaNoticia({ noticia: n }: { noticia: Noticia }) {
    return (
        <div className="tb-fijada-meta">
            <span className="tb-fuente">{NOMBRE_FUENTE[n.fuente]}</span>
            {n.categoria && <span>{n.categoria}</span>}
            <span>· {haceCuanto(n.publicadoEn)}</span>
        </div>
    )
}

// Si la noticia no trae imagen (o no carga), se muestra un recuadro con el sello de la fuente
function ImagenNoticia({ noticia: n }: { noticia: Noticia }) {
    const [fallo, setFallo] = useState(false)
    return (
        <div className="tb-noticia-imagen">
            {n.imagenUrl && !fallo ? (
                <img src={n.imagenUrl} alt="" loading="lazy" onError={() => setFallo(true)} />
            ) : (
                <span className="tb-noticia-sin-imagen" lang="ja" aria-hidden="true">新聞</span>
            )}
        </div>
    )
}
