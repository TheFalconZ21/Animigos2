import { useState } from 'react'
import { ExternalLink, Newspaper } from 'lucide-react'
import { NOMBRE_FUENTE, type Noticia } from '../../services/newsApi'
import { haceCuanto } from '../../shared/tiempo'

// Recuadro de "Noticias del día": mismo marco que el banner del Tablón,
// con la imagen de la noticia clavada como una foto en el corcho
export function NoticiasBanner({ noticia, posicion, total, ahora, onVerTodas }: {
    noticia: Noticia
    posicion: number
    total: number
    ahora: number
    onVerTodas: () => void
}) {
    const [falloImagen, setFalloImagen] = useState(false)

    return (
        <header className="tb-banner tb-banner-noticias">
            <div className="tb-banner-texto">
                <span className="ml-eyebrow">Noticias del día · {posicion} de {total}</span>
                <div className="tb-fijada-meta mt-2">
                    <span className="tb-fuente">{NOMBRE_FUENTE[noticia.fuente]}</span>
                    {noticia.categoria && <span>{noticia.categoria}</span>}
                    <span>· {haceCuanto(noticia.publicadoEn, ahora)}</span>
                </div>
                <h2 className="tb-banner-titular">{noticia.titulo}</h2>
                <p className="tb-banner-sub">{noticia.resumen}</p>
                <div className="tb-banner-acciones">
                    <a className="ml-btn ml-btn-acento" href={noticia.enlace} target="_blank" rel="noopener noreferrer">
                        Leer la nota <ExternalLink size={14} />
                    </a>
                    <button type="button" className="ml-btn" onClick={onVerTodas}>
                        <Newspaper size={15} /> Ver todas las noticias
                    </button>
                </div>
            </div>

            <div className="tb-corcho" aria-hidden="true">
                <figure className="tb-clavado tb-clavado-noticia">
                    <span className="tb-washi" />
                    {noticia.imagenUrl && !falloImagen ? (
                        <img src={noticia.imagenUrl} alt="" onError={() => setFalloImagen(true)} />
                    ) : (
                        <span className="tb-clavado-vacio" lang="ja">新聞</span>
                    )}
                    <figcaption>{NOMBRE_FUENTE[noticia.fuente]}</figcaption>
                </figure>
            </div>

            <span className="ml-lomo tb-lomo" lang="ja" aria-hidden="true">新聞</span>
        </header>
    )
}
