import { BookmarkCheck, BookmarkPlus, Heart, Lightbulb, Ticket, Trophy, Users, Vote, Send, Sparkles, Handshake, Star } from 'lucide-react'
import type { Actividad, TipoActividad } from '../../services/feedApi'
import { alFallarPoster } from '../mi-lista/mi-lista-data'

const ETIQUETA_TIPO: Record<TipoActividad, { texto: string; icono: typeof Send }> = {
    recomendacion_directa: { texto: 'Te recomienda', icono: Send },
    recomendacion_general: { texto: 'Recomienda a todos', icono: Sparkles },
    invitacion_sala: { texto: 'Te invita a una sala', icono: Ticket },
    busco_anime: { texto: 'Pide sugerencias', icono: Lightbulb },
    encuesta: { texto: 'Encuesta', icono: Vote },
    hito: { texto: 'Logro', icono: Trophy },
}

interface Props {
    actividad: Actividad
    enMiLista: (malId: number) => boolean
    onGuardar: (actividad: Actividad) => void
    onAgradecer: (id: string) => void
    onVotar: (id: string, opcionId: string) => void
    onSugerir: (actividad: Actividad) => void
    onEntrarSala: (codigo: string) => void
}

// Una publicación del tablón. Cada tipo tiene su propia forma visual.
export function Publicacion({ actividad: a, enMiLista, onGuardar, onAgradecer, onVotar, onSugerir, onEntrarSala }: Props) {
    const { texto, icono: Icono } = ETIQUETA_TIPO[a.tipo]

    return (
        <article className={`tb-post tb-post-${a.tipo}`}>
            <header className="tb-post-cabecera">
                <Avatar src={a.autor.avatarUrl} nombre={a.autor.nombre} />
                <div className="tb-post-autor">
                    <strong>{a.autor.nombre}</strong>
                    <span>@{a.autor.usuario} · {a.creadoHace}</span>
                </div>
                <span className="tb-post-tipo"><Icono size={13} /> {texto}</span>
            </header>

            {a.recomendacion && <CuerpoRecomendacion actividad={a} guardado={enMiLista(a.recomendacion.anime.malId)} onGuardar={onGuardar} onAgradecer={onAgradecer} />}
            {a.invitacion && <CuerpoInvitacion actividad={a} onEntrarSala={onEntrarSala} />}
            {a.busqueda && <CuerpoBusqueda actividad={a} onSugerir={onSugerir} />}
            {a.encuesta && <CuerpoEncuesta actividad={a} onVotar={onVotar} />}
            {a.hito && <CuerpoHito actividad={a} onAgradecer={onAgradecer} />}
        </article>
    )
}

function Avatar({ src, nombre }: { src: string; nombre: string }) {
    return src ? (
        <img className="tb-avatar" src={src} alt="" loading="lazy" />
    ) : (
        <span className="tb-avatar tb-avatar-inicial" aria-hidden="true">{nombre.charAt(0).toUpperCase()}</span>
    )
}

function BotonAgradecer({ a, onAgradecer, textos }: { a: Actividad; onAgradecer: (id: string) => void; textos: [string, string] }) {
    return (
        <button type="button" className="tb-accion" aria-pressed={a.agradecidoPorMi} onClick={() => onAgradecer(a.id)}>
            <Heart size={15} fill={a.agradecidoPorMi ? 'currentColor' : 'none'} />
            {a.agradecidoPorMi ? textos[1] : textos[0]}
            {a.agradecimientos > 0 && <span className="tb-accion-num">{a.agradecimientos}</span>}
        </button>
    )
}

// Recomendación: el comentario del amigo es un globo de diálogo junto al póster
function CuerpoRecomendacion({ actividad: a, guardado, onGuardar, onAgradecer }: {
    actividad: Actividad; guardado: boolean; onGuardar: (a: Actividad) => void; onAgradecer: (id: string) => void
}) {
    const { anime, nota, paraMi } = a.recomendacion!
    return (
        <>
            <div className="tb-reco">
                <img className="tb-reco-poster" src={anime.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                <div className="tb-reco-info">
                    {paraMi && <span className="tb-para-ti">Para ti</span>}
                    <h3 className="tb-reco-titulo">{anime.titulo}</h3>
                    <div className="tb-reco-meta">
                        {anime.nota !== null && <span><Star size={12} fill="currentColor" /> {anime.nota}</span>}
                        <span>{anime.generos.slice(0, 3).join(' · ')}</span>
                    </div>
                    <blockquote className="tb-burbuja">{nota}</blockquote>
                </div>
            </div>
            <footer className="tb-post-acciones">
                <button type="button" className="tb-accion" aria-pressed={guardado} disabled={guardado} onClick={() => onGuardar(a)}>
                    {guardado ? <><BookmarkCheck size={15} /> En tu lista</> : <><BookmarkPlus size={15} /> Guardar en Mi Lista</>}
                </button>
                <BotonAgradecer a={a} onAgradecer={onAgradecer} textos={['Agradecer', '¡Gracias!']} />
            </footer>
        </>
    )
}

// Invitación: una entrada de cine con su talón recortable
function CuerpoInvitacion({ actividad: a, onEntrarSala }: { actividad: Actividad; onEntrarSala: (codigo: string) => void }) {
    const inv = a.invitacion!
    return (
        <div className="tb-ticket">
            <div className="tb-ticket-cuerpo">
                <span className="tb-ticket-etiqueta">Sala grupal</span>
                <h3 className="tb-ticket-nombre">{inv.nombreSala}</h3>
                <div className="tb-ticket-meta">
                    <span><Users size={13} /> {inv.integrantes} integrantes</span>
                    {inv.candidatoTop && <span>Va ganando: <strong>{inv.candidatoTop}</strong></span>}
                </div>
            </div>
            <div className="tb-ticket-talon">
                <span className="tb-ticket-codigo">{inv.codigoSala}</span>
                <button type="button" className="ml-btn ml-btn-acento ml-btn-sm" onClick={() => onEntrarSala(inv.codigoSala)}>
                    Entrar
                </button>
            </div>
        </div>
    )
}

// "Busco anime parecido a…": nota adhesiva con 求む ("se busca")
function CuerpoBusqueda({ actividad: a, onSugerir }: { actividad: Actividad; onSugerir: (a: Actividad) => void }) {
    const b = a.busqueda!
    return (
        <div className="tb-nota">
            <span className="tb-nota-sello" lang="ja" aria-hidden="true">求む</span>
            <p className="tb-nota-texto">{b.pedido}</p>
            <div className="tb-nota-pie">
                {b.referencia && <span>Referencia: <strong>{b.referencia}</strong></span>}
                <button type="button" className="ml-btn ml-btn-sm" onClick={() => onSugerir(a)}>
                    <Lightbulb size={14} /> Sugerir un anime
                </button>
            </div>
        </div>
    )
}

// Encuesta: se vota tocando una opción; después se ven los porcentajes
function CuerpoEncuesta({ actividad: a, onVotar }: { actividad: Actividad; onVotar: (id: string, opcionId: string) => void }) {
    const e = a.encuesta!
    const total = e.opciones.reduce((s, o) => s + o.votos, 0)
    const votada = Boolean(e.miVoto)
    return (
        <div className="tb-encuesta">
            <h3 className="tb-encuesta-pregunta">{e.pregunta}</h3>
            <div className="tb-encuesta-opciones" role="group" aria-label="Opciones de la encuesta">
                {e.opciones.map((o) => {
                    const pct = total ? Math.round((o.votos / total) * 100) : 0
                    return (
                        <button
                            key={o.id}
                            type="button"
                            className="tb-opcion"
                            aria-pressed={e.miVoto === o.id}
                            disabled={votada}
                            onClick={() => onVotar(a.id, o.id)}
                        >
                            {votada && <span className="tb-opcion-barra" style={{ width: `${pct}%` }} />}
                            <span className="tb-opcion-texto">{o.texto}</span>
                            {votada && <span className="tb-opcion-pct">{pct}%</span>}
                        </button>
                    )
                })}
            </div>
            <p className="tb-encuesta-total">{total} {total === 1 ? 'voto' : 'votos'}{!votada && ' · toca una opción para votar'}</p>
        </div>
    )
}

// Logro: un sello hanko grande, como los de las tarjetas de sellos japonesas
function CuerpoHito({ actividad: a, onAgradecer }: { actividad: Actividad; onAgradecer: (id: string) => void }) {
    const h = a.hito!
    const Icono = h.icono === 'amistad' ? Handshake : Trophy
    return (
        <div className="tb-hito">
            <span className="tb-hito-sello" lang="ja" aria-hidden="true">{h.icono === 'amistad' ? '祝' : '達成'}</span>
            <div className="tb-hito-info">
                <h3 className="tb-hito-titulo"><Icono size={16} /> {h.titulo}</h3>
                <p>{h.descripcion}</p>
                <BotonAgradecer a={a} onAgradecer={onAgradecer} textos={['Felicitar', '¡Felicitado!']} />
            </div>
        </div>
    )
}
