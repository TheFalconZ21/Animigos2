import { useState } from 'react'
import { Ellipsis, Folder, FolderInput, Heart, MessageSquare, Send, Tag, Trash2, X } from 'lucide-react'
import { ESTADOS, medioDe, type Carpeta, type EntradaLista, type EstadoLista, type FilaLista, alFallarPoster } from './mi-lista-data'
import { Menu, SelloNota } from './piezas'

interface Props {
    fila: FilaLista
    posicion: number
    carpetas: Carpeta[]
    onActualizar: (cambios: Partial<EntradaLista>) => void
    onQuitar: () => void
    onVerDetalle: () => void
    onRecomendar: () => void
}

export function AnimeFila({ fila, posicion, carpetas, onActualizar, onQuitar, onVerDetalle, onRecomendar }: Props) {
    const { anime } = fila
    const [agregandoTag, setAgregandoTag] = useState(false)
    const [nuevoTag, setNuevoTag] = useState('')
    const [editandoComentario, setEditandoComentario] = useState(false)
    const [textoComentario, setTextoComentario] = useState(fila.comentario || '')
    const carpeta = carpetas.find((c) => c.id === fila.carpetaId)

    const cambiarEstado = (estado: EstadoLista) => {
        // Al marcar como visto, se completan los episodios automáticamente
        onActualizar(estado === 'visto' ? { estado, episodiosVistos: anime.episodes } : { estado })
    }

    const sumarEpisodio = () => {
        const episodiosVistos = fila.episodiosVistos + 1
        const termino = episodiosVistos >= anime.episodes
        onActualizar({
            episodiosVistos,
            estado: termino ? 'visto' : fila.estado === 'pendiente' ? 'viendo' : fila.estado,
        })
    }

    const guardarComentario = () => {
        const comentarioLimpio = textoComentario.trim()
        onActualizar({ comentario: comentarioLimpio })
        setEditandoComentario(false)
    }

    const cancelarEdicionComentario = () => {
        setTextoComentario(fila.comentario || '')
        setEditandoComentario(false)
    }

    const eliminarComentario = () => {
        onActualizar({ comentario: '' })
        setTextoComentario('')
        setEditandoComentario(false)
    }

    const guardarTag = () => {
        const tag = nuevoTag.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
        if (tag && !fila.tags.includes(tag)) onActualizar({ tags: [...fila.tags, tag] })
        setNuevoTag('')
        setAgregandoTag(false)
    }

    return (
        <article className="ml-fila">
            <span className="ml-posicion">{String(posicion).padStart(2, '0')}</span>

            <button type="button" className="ml-poster-btn" onClick={onVerDetalle} aria-label={`Ver detalle de ${anime.title}`}>
                <img className="ml-poster" src={anime.imageUrl} alt="" loading="lazy" onError={alFallarPoster} />
                {fila.favorito && (
                    <span className="ml-marcapaginas" title="Favorito">
                        <Heart size={10} fill="currentColor" />
                    </span>
                )}
            </button>

            <div className="ml-fila-info" style={{ minWidth: 0 }}>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <select
                        className={`ml-select ml-estado ml-estado-${fila.estado}`}
                        value={fila.estado}
                        onChange={(e) => cambiarEstado(e.target.value as EstadoLista)}
                        aria-label="Estado"
                    >
                        {ESTADOS.map((e) => (
                            <option key={e.id} value={e.id}>{e.label}</option>
                        ))}
                    </select>
                    {/* Solo mientras lo está viendo: en qué episodio va y +1 */}
                    {fila.estado === 'viendo' && anime.episodes > 1 && (
                        <span className="ml-ep-actual">
                            Ep {fila.episodiosVistos}/{anime.episodes}
                            <button type="button" className="ml-mas-ep" onClick={sumarEpisodio} title="Marcar un episodio más">
                                +1
                            </button>
                        </span>
                    )}
                </div>

                <button type="button" className="ml-fila-titulo" onClick={onVerDetalle}>
                    {anime.title}
                </button>

                <div className="ml-meta">
                    <span>{medioDe(anime)}</span>
                    <span className="ml-meta-sep" />
                    <span>{anime.studio}</span>
                    <span className="ml-meta-sep" />
                    <span>{anime.year}</span>
                    <span className="ml-meta-sep" />
                    <span>★ {anime.score} MAL</span>
                </div>

                {(carpeta || fila.tags.length > 0 || agregandoTag) && (
                    <div className="d-flex flex-wrap align-items-center gap-1 mt-2">
                        {carpeta && (
                            <span className="ml-tag ml-tag-carpeta">
                                <Folder size={11} /> {carpeta.nombre}
                            </span>
                        )}
                        {fila.tags.map((tag) => (
                            <span key={tag} className="ml-tag">
                                #{tag}
                                <button
                                    type="button"
                                    className="ml-tag-quitar"
                                    onClick={() => onActualizar({ tags: fila.tags.filter((t) => t !== tag) })}
                                    aria-label={`Quitar tag ${tag}`}
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                        {agregandoTag && (
                            // La <datalist id="ml-tags-existentes"> vive una sola vez en MiLista.tsx
                            <input
                                autoFocus
                                className="ml-input ml-tag-input"
                                placeholder="#nuevo-tag"
                                list="ml-tags-existentes"
                                value={nuevoTag}
                                onChange={(e) => setNuevoTag(e.target.value)}
                                onBlur={guardarTag}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') guardarTag()
                                    if (e.key === 'Escape') setAgregandoTag(false)
                                }}
                            />
                        )}
                    </div>
                )}

                {editandoComentario ? (
                    <div className="ml-comentario-edicion">
                        <textarea
                            autoFocus
                            className="ml-comentario-textarea"
                            placeholder="Escribe tu comentario o nota sobre este anime..."
                            value={textoComentario}
                            onChange={(e) => setTextoComentario(e.target.value)}
                            maxLength={500}
                            rows={2}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    guardarComentario()
                                } else if (e.key === 'Escape') {
                                    cancelarEdicionComentario()
                                }
                            }}
                        />
                        <div className="d-flex align-items-center gap-2 mt-1">
                            <button
                                type="button"
                                className="ml-btn ml-btn-acento ml-btn-sm"
                                onClick={guardarComentario}
                            >
                                Guardar comentario
                            </button>
                            <button
                                type="button"
                                className="ml-btn ml-btn-sm"
                                onClick={cancelarEdicionComentario}
                            >
                                Cancelar
                            </button>
                            {fila.comentario && (
                                <button
                                    type="button"
                                    className="ml-btn ml-btn-sm text-danger ms-auto"
                                    onClick={eliminarComentario}
                                >
                                    Eliminar comentario
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    fila.comentario && <p className="ml-comentario">“{fila.comentario}”</p>
                )}
            </div>

            <SelloNota nota={fila.nota} onCambiar={(nota) => onActualizar({ nota })} />

            <Menu etiqueta={`Acciones para ${anime.title}`} boton={<Ellipsis size={18} />}>
                {(cerrar) => (
                    <>
                        <button
                            type="button"
                            className="ml-menu-item"
                            onClick={() => {
                                setTextoComentario(fila.comentario || '')
                                setEditandoComentario(true)
                                cerrar()
                            }}
                        >
                            <MessageSquare size={15} /> {fila.comentario ? 'Editar comentario' : 'Dejar comentario'}
                        </button>
                        <button type="button" className="ml-menu-item" onClick={() => { setAgregandoTag(true); cerrar() }}>
                            <Tag size={15} /> Agregar tag
                        </button>
                        <button type="button" className="ml-menu-item" onClick={() => { onActualizar({ favorito: !fila.favorito }); cerrar() }}>
                            <Heart size={15} /> {fila.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
                        </button>
                        <button type="button" className="ml-menu-item" onClick={() => { onRecomendar(); cerrar() }}>
                            <Send size={15} /> Recomendar a un amigo
                        </button>

                        <div className="ml-menu-sep" />
                        <div className="ml-menu-titulo">Mover a carpeta</div>
                        {carpetas.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                className={`ml-menu-item ${c.id === fila.carpetaId ? 'actual' : ''}`}
                                onClick={() => { onActualizar({ carpetaId: c.id }); cerrar() }}
                            >
                                <FolderInput size={15} /> {c.nombre}
                            </button>
                        ))}
                        {fila.carpetaId && (
                            <button type="button" className="ml-menu-item" onClick={() => { onActualizar({ carpetaId: undefined }); cerrar() }}>
                                <X size={15} /> Sacar de la carpeta
                            </button>
                        )}

                        <div className="ml-menu-sep" />
                        <button type="button" className="ml-menu-item ml-peligro" onClick={() => { onQuitar(); cerrar() }}>
                            <Trash2 size={15} /> Quitar de Mi Lista
                        </button>
                    </>
                )}
            </Menu>
        </article>
    )
}
