import { BookmarkCheck, BookmarkPlus, Heart, MessageSquare, Sparkles, Star, Trophy, Vote } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { alFallarPoster } from '../mi-lista/mi-lista-data'
import { navigate } from '../../utils/navigation'
import type { Actividad, AnimeResumen, RespuestaActividad } from '../../services/feedApi'

interface Props {
    actividad: Actividad | null
    todasActividades: Actividad[]
    enMiLista: (malId: number) => boolean
    onGuardarAnime: (anime: AnimeResumen) => void
    onCerrar: () => void
}

/**
 * Modal de feedback para el dueño de una publicación en El Tablón:
 * muestra votos (encuestas), agradecimientos y recomendaciones/opiniones recibidas de amigos.
 */
export function PostFeedbackDialog({
    actividad,
    todasActividades,
    enMiLista,
    onGuardarAnime,
    onCerrar,
}: Props) {
    if (!actividad) return null

    // Combinar respuestas directas enlazadas al post + recomendaciones entrantes que citen el pedido
    const respuestasDirectas: RespuestaActividad[] = actividad.respuestas ?? []
    const pedidoPrefix = (actividad.busqueda?.pedido || '').trim().slice(0, 32).toLowerCase()

    const recosRelacionadas: RespuestaActividad[] =
        actividad.tipo === 'busco_anime' && pedidoPrefix.length >= 4
            ? todasActividades
                  .filter(
                      (other) =>
                          other.id !== actividad.id &&
                          other.tipo === 'recomendacion_directa' &&
                          other.recomendacion &&
                          other.recomendacion.nota.toLowerCase().includes(pedidoPrefix) &&
                          !respuestasDirectas.some(
                              (r) =>
                                  r.anime?.malId === other.recomendacion?.anime.malId &&
                                  r.autor.usuario === other.autor.usuario
                          )
                  )
                  .map((other) => ({
                      id: `rel-${other.id}`,
                      autor: other.autor,
                      nota: other.recomendacion!.nota,
                      anime: other.recomendacion!.anime,
                      creadoHace: other.creadoHace,
                  }))
            : []

    const todasRespuestas = [...respuestasDirectas, ...recosRelacionadas]

    const totalVotos = actividad.encuesta
        ? actividad.encuesta.opciones.reduce((sum, o) => sum + o.votos, 0)
        : 0

    const maxVotos = actividad.encuesta
        ? Math.max(0, ...actividad.encuesta.opciones.map((o) => o.votos))
        : 0

    const resumenPost =
        actividad.busqueda?.pedido ||
        actividad.encuesta?.pregunta ||
        (actividad.recomendacion ? `${actividad.recomendacion.anime.titulo} — “${actividad.recomendacion.nota}”` : '') ||
        actividad.invitacion?.nombreSala ||
        actividad.hito?.titulo ||
        'Publicación'

    return (
        <Dialogo
            abierto={Boolean(actividad)}
            onCerrar={onCerrar}
            etiqueta="Feedback de tu publicación"
            ancho={580}
        >
            <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">FEEDBACK DE TUS AMIGOS</span>
                    <h3 className="h5 fw-bold text-white mt-1 mb-1 d-flex align-items-center gap-2">
                        <Sparkles size={17} style={{ color: 'var(--ml-acento, #a78bfa)' }} />
                        <span>Resumen de tu publicación</span>
                    </h3>
                    <div
                        className="p-2.5 rounded-3 mt-2"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        <div className="small text-white fw-semibold">{resumenPost}</div>
                        <div className="small text-secondary mt-1" style={{ fontSize: '0.73rem' }}>
                            Publicado por @{actividad.autor.usuario} · {actividad.creadoHace}
                        </div>
                    </div>
                </div>

                {/* Métricas rápidas */}
                <div className="row g-2">
                    <div className="col-4">
                        <div
                            className="p-2.5 rounded-3 text-center"
                            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                            <div className="d-flex align-items-center justify-content-center gap-1 text-danger small fw-bold">
                                <Heart size={13} /> {actividad.agradecimientos}
                            </div>
                            <div className="small text-secondary" style={{ fontSize: '0.7rem' }}>Agradecimientos</div>
                        </div>
                    </div>
                    <div className="col-4">
                        <div
                            className="p-2.5 rounded-3 text-center"
                            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                            <div className="d-flex align-items-center justify-content-center gap-1 small fw-bold" style={{ color: 'var(--ml-acento, #a78bfa)' }}>
                                <MessageSquare size={13} /> {todasRespuestas.length}
                            </div>
                            <div className="small text-secondary" style={{ fontSize: '0.7rem' }}>Recomendaciones</div>
                        </div>
                    </div>
                    <div className="col-4">
                        <div
                            className="p-2.5 rounded-3 text-center"
                            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                            <div className="d-flex align-items-center justify-content-center gap-1 text-info small fw-bold">
                                <Vote size={13} /> {totalVotos}
                            </div>
                            <div className="small text-secondary" style={{ fontSize: '0.7rem' }}>Votos</div>
                        </div>
                    </div>
                </div>

                {/* Resultados detallados si es Encuesta */}
                {actividad.encuesta && (
                    <div className="d-flex flex-column gap-2">
                        <span className="ml-label mb-0">Resultados de la encuesta</span>
                        {actividad.encuesta.opciones.map((op) => {
                            const pct = totalVotos > 0 ? Math.round((op.votos / totalVotos) * 100) : 0
                            const isLeader = maxVotos > 0 && op.votos === maxVotos
                            return (
                                <div
                                    key={op.id}
                                    className="p-2.5 rounded-3"
                                    style={{
                                        background: isLeader ? 'rgba(167, 139, 250, 0.1)' : 'rgba(255,255,255,0.025)',
                                        border: isLeader
                                            ? '1px solid rgba(167, 139, 250, 0.4)'
                                            : '1px solid rgba(255,255,255,0.07)',
                                    }}
                                >
                                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1.5">
                                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                                            {op.anime?.imagenUrl && (
                                                <img
                                                    src={op.anime.imagenUrl}
                                                    alt=""
                                                    onError={alFallarPoster}
                                                    style={{ width: 28, height: 38, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }}
                                                />
                                            )}
                                            <span className="small fw-semibold text-white text-truncate">
                                                {op.anime?.titulo || op.texto}
                                            </span>
                                            {isLeader && (
                                                <span className="badge rounded-pill text-warning" style={{ background: 'rgba(251, 191, 36, 0.15)', fontSize: '0.66rem' }}>
                                                    <Trophy size={10} className="me-1" /> Líder
                                                </span>
                                            )}
                                        </div>
                                        <span className="small font-mono text-white fw-bold flex-shrink-0">
                                            {op.votos} {op.votos === 1 ? 'voto' : 'votos'} ({pct}%)
                                        </span>
                                    </div>
                                    <div className="w-100 rounded overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.08)' }}>
                                        <div
                                            style={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                background: isLeader ? 'var(--ml-acento, #a78bfa)' : 'rgba(255,255,255,0.35)',
                                            }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Recomendaciones y opiniones recibidas */}
                <div className="d-flex flex-column gap-2">
                    <span className="ml-label mb-0">
                        Recomendaciones y opiniones ({todasRespuestas.length})
                    </span>

                    {todasRespuestas.length === 0 ? (
                        <div
                            className="p-4 text-center rounded-3 small text-secondary"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}
                        >
                            Aún no has recibido recomendaciones ni opiniones de tus amigos en esta publicación.
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {todasRespuestas.map((resp) => {
                                const yaGuardado = resp.anime ? enMiLista(resp.anime.malId) : false
                                return (
                                    <div
                                        key={resp.id}
                                        className="p-3 rounded-3 d-flex flex-column gap-2"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        }}
                                    >
                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="small fw-bold text-white">{resp.autor.nombre}</span>
                                                <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                                    @{resp.autor.usuario} · {resp.creadoHace}
                                                </span>
                                            </div>
                                        </div>

                                        {resp.nota && (
                                            <p className="small text-light mb-0" style={{ fontSize: '0.82rem' }}>
                                                “{resp.nota}”
                                            </p>
                                        )}

                                        {resp.anime && (
                                            <div
                                                className="d-flex align-items-center justify-content-between gap-2 p-2 rounded-2"
                                                style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)' }}
                                            >
                                                <div
                                                    className="d-flex align-items-center gap-2 overflow-hidden"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        onCerrar()
                                                        navigate(`/anime/${resp.anime!.malId}`)
                                                    }}
                                                >
                                                    <img
                                                        src={resp.anime.imagenUrl}
                                                        alt=""
                                                        onError={alFallarPoster}
                                                        style={{ width: 34, height: 46, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                                                    />
                                                    <div className="overflow-hidden">
                                                        <div className="small fw-semibold text-white text-truncate">
                                                            {resp.anime.titulo}
                                                        </div>
                                                        {resp.anime.nota !== null && (
                                                            <div className="small text-warning d-inline-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                                                <Star size={10} fill="currentColor" /> {resp.anime.nota}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="ml-btn ml-btn-sm flex-shrink-0"
                                                    disabled={yaGuardado}
                                                    onClick={() => onGuardarAnime(resp.anime!)}
                                                >
                                                    {yaGuardado ? (
                                                        <>
                                                            <BookmarkCheck size={13} /> En tu lista
                                                        </>
                                                    ) : (
                                                        <>
                                                            <BookmarkPlus size={13} /> Guardar
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <footer className="ml-dialog-pie justify-content-end">
                <button type="button" className="ml-btn ml-btn-acento" onClick={onCerrar}>
                    Cerrar
                </button>
            </footer>
        </Dialogo>
    )
}
