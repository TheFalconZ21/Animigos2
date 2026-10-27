import { Lightbulb, Send, Vote } from 'lucide-react'
import type { ModoPublicar } from './PublicarDialog'
import { alFallarPoster } from '../mi-lista/mi-lista-data'

export interface PosterBanner {
    clave: string
    titulo: string
    imagenUrl: string
}

// Inclinación de cada portada clavada en el corcho (fija, para que no "baile" al recargar)
const GIROS = [-6, 4, -2, 7, -4]

// Banner: tablero de corcho oscuro con las portadas que se están comentando
export function TablonBanner({ posters, publicacionesHoy, salasEsperando, onPublicar }: {
    posters: PosterBanner[]
    publicacionesHoy: number
    salasEsperando: number
    onPublicar: (modo: ModoPublicar) => void
}) {
    return (
        <header className="tb-banner">
            <div className="tb-banner-texto">
                <span className="ml-eyebrow">Comunidad</span>
                <h1 className="ml-titulo">El Tablón</h1>
                <p className="tb-banner-sub">
                    Lo que tus amigos están viendo, recomendando y votando.
                    <br />
                    <strong>{publicacionesHoy}</strong> publicaciones nuevas
                    {salasEsperando > 0 && <> · <strong>{salasEsperando}</strong> {salasEsperando === 1 ? 'sala espera' : 'salas esperan'} tu voto</>}
                </p>
                <div className="tb-banner-acciones">
                    <button type="button" className="ml-btn ml-btn-acento" onClick={() => onPublicar('recomendar')}>
                        <Send size={15} /> Recomendar anime
                    </button>
                    <button type="button" className="ml-btn" onClick={() => onPublicar('buscar')}>
                        <Lightbulb size={15} /> Pedir sugerencia
                    </button>
                    <button type="button" className="ml-btn" onClick={() => onPublicar('encuesta')}>
                        <Vote size={15} /> Crear encuesta
                    </button>
                </div>
            </div>

            <div className="tb-corcho" aria-hidden="true">
                {posters.slice(0, 5).map((p, i) => (
                    <figure key={p.clave} className="tb-clavado" style={{ transform: `rotate(${GIROS[i]}deg)` }}>
                        <span className="tb-washi" />
                        <img src={p.imagenUrl} alt="" onError={alFallarPoster} />
                        <figcaption>{p.titulo}</figcaption>
                    </figure>
                ))}
            </div>

            <span className="ml-lomo tb-lomo" lang="ja" aria-hidden="true">回覧板</span>
        </header>
    )
}
