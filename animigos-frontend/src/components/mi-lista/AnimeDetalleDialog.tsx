import { useState, useEffect } from 'react'
import { Award, Compass, Heart, Send, Star, Trash2, Users, Play, ExternalLink, Plus } from 'lucide-react'
import { ESTADOS, type EntradaLista, type FilaLista, alFallarPoster } from './mi-lista-data'
import { Dialogo, ProgresoEpisodios, SelloNota } from './piezas'
import { useAssociatedLinks } from '../../hooks/useAssociatedLinks'

function cleanHtmlEntities(str?: string): string {
    if (!str) return ''
    return str
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&eacute;/g, 'é')
        .replace(/&aacute;/g, 'á')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&ntilde;/g, 'ñ')
}

// Mini resumen del anime (se abre al hacer clic en el póster o el título)
export function AnimeDetalleDialog({
    fila,
    onCerrar,
    onActualizar,
    onRecomendar,
    onEliminar,
    onVerFichaCompleta,
}: {
    fila: FilaLista | null
    onCerrar: () => void
    onActualizar: (cambios: Partial<EntradaLista>) => void
    onRecomendar: () => void
    onEliminar?: () => void
    onVerFichaCompleta?: (malId: number) => void
}) {
    return (
        <Dialogo abierto={fila !== null} onCerrar={onCerrar} etiqueta={fila ? `Detalle de ${fila.anime.title}` : 'Detalle'}>
            {fila && (
                <Contenido
                    fila={fila}
                    onCerrar={onCerrar}
                    onActualizar={onActualizar}
                    onRecomendar={onRecomendar}
                    onEliminar={onEliminar}
                    onVerFichaCompleta={onVerFichaCompleta}
                />
            )}
        </Dialogo>
    )
}

function Contenido({
    fila,
    onCerrar,
    onActualizar,
    onRecomendar,
    onEliminar,
    onVerFichaCompleta,
}: {
    fila: FilaLista
    onCerrar: () => void
    onActualizar: (cambios: Partial<EntradaLista>) => void
    onRecomendar: () => void
    onEliminar?: () => void
    onVerFichaCompleta?: (malId: number) => void
}) {
    const { anime } = fila
    const { openAnimeLink, isEnabled: isLinksEnabled } = useAssociatedLinks()
    const amigos = (anime.watchedByFriends ?? []).map((nombre: string) => ({ name: nombre, avatarUrl: '' }))

    const [localEp, setLocalEp] = useState<string>(String(fila.episodiosVistos ?? 0))

    useEffect(() => {
        setLocalEp(String(fila.episodiosVistos ?? 0))
    }, [fila.episodiosVistos])

    const handleIrAFichaPrincipal = () => {
        const malId = Number(fila.malId || anime.malId)
        onCerrar()
        if (onVerFichaCompleta) {
            onVerFichaCompleta(malId)
        } else {
            window.location.hash = `#anime/${malId}`
        }
    }

    const maxEps = anime.episodes || 9999

    const decrementarEp = () => {
        const next = Math.max(0, (fila.episodiosVistos || 0) - 1)
        onActualizar({ episodiosVistos: next })
    }

    const incrementarEp = () => {
        const next = Math.min(maxEps, (fila.episodiosVistos || 0) + 1)
        const termino = Boolean(anime.episodes && next >= anime.episodes)
        onActualizar({
            episodiosVistos: next,
            estado: termino ? 'visto' : fila.estado === 'pendiente' ? 'viendo' : fila.estado,
        })
    }

    const handleCommitEp = (valStr: string) => {
        const val = Math.max(0, parseInt(valStr, 10) || 0)
        const finalVal = Math.min(maxEps, val)
        setLocalEp(String(finalVal))
        const termino = Boolean(anime.episodes && finalVal >= anime.episodes)
        onActualizar({
            episodiosVistos: finalVal,
            estado: termino ? 'visto' : fila.estado === 'pendiente' && finalVal > 0 ? 'viendo' : fila.estado,
        })
    }

    return (
        <>
            <div className="ml-dialog-cuerpo">
                <div className="ml-dialog-cabecera">
                    <img
                        className="ml-dialog-poster"
                        src={anime.imageUrl}
                        alt={anime.title}
                        onError={alFallarPoster}
                        onClick={handleIrAFichaPrincipal}
                        style={{ cursor: 'pointer' }}
                        title="Clic para ir a la interfaz principal del anime"
                    />
                    <div className="ml-dialog-titulares">
                        <div className="ml-dialog-titulares-top">
                            <div className="min-w-0">
                                <h2
                                    className="ml-dialog-titulo"
                                    onClick={handleIrAFichaPrincipal}
                                    style={{ cursor: 'pointer' }}
                                    title="Clic para ir a la interfaz principal del anime"
                                >
                                    {cleanHtmlEntities(anime.title)}
                                </h2>
                                {anime.titleEnglish && <p className="ml-dialog-ingles">{cleanHtmlEntities(anime.titleEnglish)}</p>}
                            </div>
                            <button
                                type="button"
                                className="ml-btn-ficha-badge"
                                onClick={handleIrAFichaPrincipal}
                                title="Ir a la interfaz principal del anime"
                            >
                                <Compass size={13} />
                                <span>Ver ficha</span>
                            </button>
                        </div>
                        <div className="ml-dialog-chips">
                            {Boolean(anime.year) && <span className="ml-chip">{anime.year}</span>}
                            {Boolean(anime.season) && <span className="ml-chip">{anime.season}</span>}
                            {Boolean(anime.studio) && <span className="ml-chip">{anime.studio}</span>}
                            {typeof anime.score === 'number' && anime.score > 0 ? (
                                <span className="ml-chip ml-chip-nota">
                                    <Star size={12} fill="currentColor" /> {anime.score}
                                </span>
                            ) : null}
                            {anime.rank ? (
                                <span className="ml-chip">
                                    <Award size={12} /> #{anime.rank}
                                </span>
                            ) : null}
                        </div>
                        <div className="ml-dialog-generos">
                            {anime.genres.map((g) => (
                                <span key={g} className="ml-genero-tag">
                                    {g}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="ml-dialog-sinopsis">{cleanHtmlEntities(anime.synopsis)}</p>

                {amigos.length > 0 && (
                    <div className="ml-amigos">
                        <div className="ml-avatares">
                            {amigos.map((a: { name: string; avatarUrl?: string }) =>
                                a.avatarUrl ? <img key={a.name} src={a.avatarUrl} alt="" /> : <Users key={a.name} size={18} />,
                            )}
                        </div>
                        <span>
                            <strong>Visto por tus amigos:</strong> {amigos.map((a: { name: string }) => a.name).join(', ')}
                        </span>
                    </div>
                )}

                {/* Lo que el usuario tiene guardado de este anime */}
                <section>
                    <h3 className="ml-label">{onEliminar ? 'En tu lista' : 'Estado en tu lista'}</h3>
                    {!onEliminar && (
                        <p className="small text-secondary mb-2" style={{ fontSize: '0.78rem' }}>
                            Este anime no está en tu lista todavía. Selecciona un estado o pulsa Agregar:
                        </p>
                    )}
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <SelloNota nota={fila.nota} onCambiar={(nota) => onActualizar({ nota })} />
                        <div className="d-flex flex-column gap-2" style={{ flex: 1, minWidth: 220 }}>
                            <div className="d-flex flex-wrap gap-2">
                                <div className="ml-segmentado" role="group" aria-label="Estado">
                                    {ESTADOS.map((e) => (
                                        <button
                                            key={e.id}
                                            type="button"
                                            aria-pressed={fila.estado === e.id}
                                            onClick={() =>
                                                onActualizar(e.id === 'visto' ? { estado: e.id, episodiosVistos: anime.episodes } : { estado: e.id })
                                            }
                                        >
                                            <span className={`ml-punto ml-punto-${e.id}`} /> {e.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="ml-btn ml-btn-sm ml-fav"
                                    aria-pressed={fila.favorito}
                                    onClick={() => onActualizar({ favorito: !fila.favorito })}
                                >
                                    <Heart size={14} fill={fila.favorito ? 'currentColor' : 'none'} /> Favorito
                                </button>
                            </div>

                            {/* Control interactivo de episodios nativo de Mi Lista */}
                            <div className="ml-episodios-fila">
                                <div className="ml-episodios-stepper">
                                    <button
                                        type="button"
                                        className="ml-ep-btn"
                                        disabled={(fila.episodiosVistos || 0) <= 0}
                                        onClick={decrementarEp}
                                        title="Restar 1 episodio"
                                        aria-label="Restar 1 episodio"
                                    >
                                        -
                                    </button>
                                    <div className="ml-ep-input-wrap">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={localEp}
                                            onChange={(e) => setLocalEp(e.target.value.replace(/[^0-9]/g, ''))}
                                            onBlur={() => handleCommitEp(localEp)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleCommitEp(localEp)
                                            }}
                                            className="ml-ep-input"
                                            title="Escribe el episodio y presiona Enter"
                                            aria-label="Episodio actual"
                                        />
                                        <span className="ml-ep-total">/ {anime.episodes || '?'} ep</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="ml-ep-btn ml-ep-btn-sumar"
                                        disabled={Boolean(anime.episodes && fila.episodiosVistos >= anime.episodes)}
                                        onClick={incrementarEp}
                                        title="Sumar 1 episodio"
                                        aria-label="Sumar 1 episodio"
                                    >
                                        +1
                                    </button>
                                </div>

                                {Boolean(anime.episodes && fila.episodiosVistos < anime.episodes) && (
                                    <button
                                        type="button"
                                        className="ml-todo-visto-btn"
                                        onClick={() => onActualizar({ episodiosVistos: anime.episodes, estado: 'visto' })}
                                        title="Marcar todos los episodios como vistos"
                                    >
                                        Todo visto
                                    </button>
                                )}

                                {isLinksEnabled && (
                                    <button
                                        type="button"
                                        className="ml-btn-ver"
                                        onClick={(e) => openAnimeLink({ title: anime.title, titleEnglish: anime.titleEnglish }, e)}
                                        title={`Abrir enlace asociado a ${anime.title}`}
                                    >
                                        <Play size={12} fill="currentColor" />
                                        <span>Ver</span>
                                        <ExternalLink size={11} />
                                    </button>
                                )}
                            </div>

                            {/* Barra gráfica de marcas de película */}
                            {anime.episodes && anime.episodes > 1 ? (
                                <ProgresoEpisodios vistos={fila.episodiosVistos} total={anime.episodes} />
                            ) : null}

                            {fila.comentario && (
                                <div className="mt-2">
                                    <h4 className="ml-label mb-1" style={{ fontSize: '0.78rem' }}>Comentario:</h4>
                                    <p className="ml-comentario m-0">“{fila.comentario}”</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <footer className="ml-dialog-pie d-flex flex-wrap align-items-center justify-content-between gap-2">
                {onEliminar ? (
                    <button
                        type="button"
                        className="ml-btn ml-btn-sm ml-peligro-suave"
                        onClick={onEliminar}
                        title="Quitar este anime de Mi Lista"
                    >
                        <Trash2 size={14} /> Quitar de mi lista
                    </button>
                ) : (
                    <button
                        type="button"
                        className="ml-btn ml-btn-sm ml-btn-acento d-inline-flex align-items-center gap-1.5"
                        onClick={() => onActualizar({ estado: fila.estado || 'esperando' })}
                        title="Agregar este anime a Mi Lista"
                    >
                        <Plus size={14} />
                        <span>Agregar a Mi Lista</span>
                    </button>
                )}
                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        className="ml-btn ml-btn-secundario"
                        onClick={handleIrAFichaPrincipal}
                        title="Ver interfaz principal del anime (detalles, taxonomía, estadísticas y recomendaciones)"
                    >
                        <Compass size={14} />
                        <span>Ficha del anime</span>
                    </button>
                    <button type="button" className="ml-btn ml-btn-acento" onClick={onRecomendar}>
                        <Send size={15} /> Recomendar a un amigo
                    </button>
                </div>
            </footer>
        </>
    )
}
