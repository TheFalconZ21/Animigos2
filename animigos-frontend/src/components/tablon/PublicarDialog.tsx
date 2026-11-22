import { useEffect, useMemo, useState } from 'react'
import { Lightbulb, Search, Send, Tag, Vote, X } from 'lucide-react'
import { fetchFriends, type FriendUser } from '../../services/friendsApi'
import type { AnimeResumen, NuevaRecomendacion } from '../../services/feedApi'
import { useBuscarAnimes } from '../../hooks/useTablon'
import { searchRegisteredTags } from '../../shared/tagDescriptions'
import { Dialogo } from '../mi-lista/piezas'
import { alFallarPoster } from '../mi-lista/mi-lista-data'

export type ModoPublicar = 'recomendar' | 'buscar' | 'encuesta'

export interface Borrador {
    modo: ModoPublicar
    destinatarioId?: string | null
    nota?: string
}

const MODOS: { id: ModoPublicar; label: string; icono: typeof Send }[] = [
    { id: 'recomendar', label: 'Recomendar', icono: Send },
    { id: 'buscar', label: 'Pedir sugerencia', icono: Lightbulb },
    { id: 'encuesta', label: 'Encuesta', icono: Vote },
]

const GENEROS_SUGERIDOS = [
    'Acción',
    'Aventura',
    'Comedia',
    'Drama',
    'Fantasía',
    'Misterio',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Suspenso',
    'Deportes',
    'Psicológico',
    'Seinen',
    'Shounen',
]

interface Acciones {
    onRecomendar: (datos: NuevaRecomendacion) => Promise<unknown>
    onBuscar: (datos: {
        pedido: string
        referencia?: string
        generos?: string[]
        tags?: string[]
        referenciasAnimes?: AnimeResumen[]
    }) => Promise<unknown>
    onEncuesta: (datos: { pregunta: string; opciones: AnimeResumen[] }) => Promise<unknown>
}

// Un solo diálogo para las tres formas de publicar en el tablón
export function PublicarDialog({ borrador, onCerrar, ...acciones }: Acciones & { borrador: Borrador | null; onCerrar: () => void }) {
    return (
        <Dialogo abierto={borrador !== null} onCerrar={onCerrar} etiqueta="Publicar en el tablón" ancho={600}>
            {borrador && <Contenido borrador={borrador} onCerrar={onCerrar} {...acciones} />}
        </Dialogo>
    )
}

function Contenido({ borrador, onCerrar, onRecomendar, onBuscar, onEncuesta }: Acciones & { borrador: Borrador; onCerrar: () => void }) {
    const [modo, setModo] = useState<ModoPublicar>(borrador.modo)
    const [enviando, setEnviando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [amigos, setAmigos] = useState<FriendUser[]>([])

    // Recomendar
    const [busqueda, setBusqueda] = useState('')
    const [textoBuscado, setTextoBuscado] = useState('')
    const [anime, setAnime] = useState<AnimeResumen | null>(null)
    const [destinatario, setDestinatario] = useState<string>(borrador.destinatarioId ?? '')
    const [nota, setNota] = useState(borrador.nota ?? '')

    // Pedir sugerencia (con géneros, tags y animes de referencia del catálogo)
    const [pedido, setPedido] = useState('')
    const [referenciasAnimes, setReferenciasAnimes] = useState<AnimeResumen[]>([])
    const [busquedaRef, setBusquedaRef] = useState('')
    const [textoBuscadoRef, setTextoBuscadoRef] = useState('')
    const [generosSeleccionados, setGenerosSeleccionados] = useState<string[]>([])
    const [tagsSeleccionados, setTagsSeleccionados] = useState<string[]>([])
    const [tagInput, setTagInput] = useState('')

    // Encuesta de animes (opciones reales del catálogo)
    const [pregunta, setPregunta] = useState('')
    const [opcionesAnime, setOpcionesAnime] = useState<AnimeResumen[]>([])
    const [busquedaEncuesta, setBusquedaEncuesta] = useState('')
    const [textoBuscadoEncuesta, setTextoBuscadoEncuesta] = useState('')

    useEffect(() => {
        let montado = true
        fetchFriends()
            .then((list) => {
                if (montado) setAmigos(list)
            })
            .catch(() => {
                if (montado) setAmigos([])
            })
        return () => {
            montado = false
        }
    }, [])

    // Debounce búsqueda para Recomendar
    useEffect(() => {
        const t = setTimeout(() => setTextoBuscado(busqueda), 300)
        return () => clearTimeout(t)
    }, [busqueda])
    const resultados = useBuscarAnimes(textoBuscado)

    // Debounce búsqueda para Encuesta de animes
    useEffect(() => {
        const t = setTimeout(() => setTextoBuscadoEncuesta(busquedaEncuesta), 300)
        return () => clearTimeout(t)
    }, [busquedaEncuesta])
    const resultadosEncuesta = useBuscarAnimes(textoBuscadoEncuesta)

    // Debounce búsqueda para "Parecido a" (animes de referencia)
    useEffect(() => {
        const t = setTimeout(() => setTextoBuscadoRef(busquedaRef), 300)
        return () => clearTimeout(t)
    }, [busquedaRef])
    const resultadosRef = useBuscarAnimes(textoBuscadoRef)

    const agregarReferenciaAnime = (elegido: AnimeResumen) => {
        if (referenciasAnimes.length >= 3) return
        if (referenciasAnimes.some((r) => r.malId === elegido.malId)) return
        setReferenciasAnimes((prev) => [...prev, elegido])
        setBusquedaRef('')
        setTextoBuscadoRef('')
    }

    const quitarReferenciaAnime = (malId: number) => {
        setReferenciasAnimes((prev) => prev.filter((r) => r.malId !== malId))
    }

    const toggleGenero = (g: string) => {
        setGenerosSeleccionados((prev) =>
            prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev,
        )
    }

    const toggleTag = (t: string) => {
        const clean = t.trim()
        if (!clean) return
        setTagsSeleccionados((prev) =>
            prev.some((x) => x.toLowerCase() === clean.toLowerCase())
                ? prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())
                : prev.length < 6
                  ? [...prev, clean]
                  : prev,
        )
    }

    const sugerenciasTag = useMemo(
        () => searchRegisteredTags(tagInput, tagsSeleccionados, 7),
        [tagInput, tagsSeleccionados],
    )

    const agregarTagRegistrado = (tagName: string) => {
        if (tagsSeleccionados.length >= 6) return
        if (!tagsSeleccionados.some((x) => x.toLowerCase() === tagName.toLowerCase())) {
            setTagsSeleccionados((prev) => [...prev, tagName])
        }
        setTagInput('')
    }

    const agregarPrimerTagSugerido = () => {
        if (sugerenciasTag.length > 0) {
            agregarTagRegistrado(sugerenciasTag[0].name)
        }
    }

    const agregarOpcionAnime = (elegido: AnimeResumen) => {
        if (opcionesAnime.length >= 4) return
        if (opcionesAnime.some((o) => o.malId === elegido.malId)) return
        setOpcionesAnime((prev) => [...prev, elegido])
        setBusquedaEncuesta('')
        setTextoBuscadoEncuesta('')
    }

    const quitarOpcionAnime = (malId: number) => {
        setOpcionesAnime((prev) => prev.filter((o) => o.malId !== malId))
    }

    const listo =
        modo === 'recomendar'
            ? anime !== null && nota.trim() !== ''
            : modo === 'buscar'
              ? pedido.trim() !== ''
              : pregunta.trim() !== '' && opcionesAnime.length >= 2

    const publicar = async () => {
        setEnviando(true)
        setError(null)
        try {
            if (modo === 'recomendar' && anime) {
                await onRecomendar({ anime, nota: nota.trim(), destinatarioId: destinatario || null })
            }
            if (modo === 'buscar') {
                await onBuscar({
                    pedido: pedido.trim(),
                    referencia: referenciasAnimes.map((a) => a.titulo).join(', '),
                    referenciasAnimes,
                    generos: generosSeleccionados,
                    tags: tagsSeleccionados,
                })
            }
            if (modo === 'encuesta') {
                await onEncuesta({ pregunta: pregunta.trim(), opciones: opcionesAnime })
            }
            onCerrar()
        } catch {
            setError('No se pudo publicar. Inténtalo de nuevo.')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <form onSubmit={(e) => { e.preventDefault(); if (listo) publicar() }}>
            <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">El Tablón</span>
                    <h2 className="h3 mt-1 mb-3 pe-5">Nueva publicación</h2>
                    <div className="ml-segmentado" role="group" aria-label="Tipo de publicación">
                        {MODOS.map(({ id, label, icono: Icono }) => (
                            <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)}>
                                <Icono size={14} /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                {modo === 'recomendar' && (
                    <>
                        {anime ? (
                            <div className="tb-elegido">
                                <img src={anime.imagenUrl} alt="" onError={alFallarPoster} />
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="fw-semibold text-white text-truncate">{anime.titulo}</div>
                                    <div className="small">{anime.generos.slice(0, 3).join(' · ')}</div>
                                </div>
                                <button type="button" className="ml-icon-btn" onClick={() => setAnime(null)} aria-label="Elegir otro anime">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label className="ml-label" htmlFor="tb-buscar">¿Qué anime recomiendas?</label>
                                <div className="ml-buscador">
                                    <Search size={16} />
                                    <input id="tb-buscar" data-autofocus className="ml-input" placeholder="Escribe al menos 2 letras…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                                </div>
                                <div className="ml-resultados">
                                    {resultados.isFetching && <p className="small mb-0 mt-2">Buscando…</p>}
                                    {resultados.isError && <p className="small mb-0 mt-2">No se pudo buscar en el catálogo.</p>}
                                    {(resultados.data ?? []).map((r) => (
                                        <button key={r.malId} type="button" className="ml-resultado" onClick={() => setAnime(r)}>
                                            <img src={r.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                                            <span style={{ minWidth: 0 }}>
                                                <span className="d-block fw-semibold text-truncate">{r.titulo}</span>
                                                <span className="small text-secondary">{r.nota !== null ? `★ ${r.nota}` : 'Sin nota'}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="ml-label" htmlFor="tb-para">Para</label>
                            <select id="tb-para" className="ml-select w-100" value={destinatario} onChange={(e) => setDestinatario(e.target.value)}>
                                <option value="">Todos mis amigos (recomendación general)</option>
                                {amigos.map((f) => (
                                    <option key={f.id} value={f.username}>
                                        {f.display_name} (@{f.username})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="ml-label" htmlFor="tb-nota">¿Por qué lo recomiendas?</label>
                            <textarea id="tb-nota" className="ml-input w-100" rows={3} maxLength={280} placeholder="“La banda sonora te va a volar la cabeza…”" value={nota} onChange={(e) => setNota(e.target.value)} />
                        </div>
                    </>
                )}

                {modo === 'buscar' && (
                    <>
                        <div>
                            <label className="ml-label" htmlFor="tb-pedido">¿Qué tipo de anime buscas?</label>
                            <textarea id="tb-pedido" data-autofocus className="ml-input w-100" rows={3} maxLength={280} placeholder="Algo de misterio oscuro, con giros inesperados…" value={pedido} onChange={(e) => setPedido(e.target.value)} />
                        </div>

                        {/* Selector de Géneros */}
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-1.5">
                                <span className="ml-label mb-0">Géneros (opcional · máx. 5)</span>
                                {generosSeleccionados.length > 0 && (
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {generosSeleccionados.length}/5 seleccionados
                                    </span>
                                )}
                            </div>
                            <div className="tb-chip-picker">
                                {GENEROS_SUGERIDOS.map((g) => {
                                    const activo = generosSeleccionados.includes(g)
                                    return (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => toggleGenero(g)}
                                            className={`tb-picker-chip ${activo ? 'is-selected' : ''}`}
                                        >
                                            {g}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Autocompletado inteligente de Main Tags & Secondary Tags (ES / EN) */}
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-1.5">
                                <span className="ml-label mb-0">Tags de AniList (opcional · máx. 6)</span>
                                {tagsSeleccionados.length > 0 && (
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {tagsSeleccionados.length}/6
                                    </span>
                                )}
                            </div>

                            {tagsSeleccionados.length > 0 && (
                                <div className="d-flex flex-wrap gap-1.5 mb-2">
                                    {tagsSeleccionados.map((t) => (
                                        <span key={t} className="tb-tag-selected">
                                            <Tag size={11} />
                                            <span>#{t}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleTag(t)}
                                                aria-label={`Quitar tag ${t}`}
                                            >
                                                <X size={11} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {tagsSeleccionados.length < 6 && (
                                <div className="position-relative">
                                    <div className="ml-buscador">
                                        <Search size={15} />
                                        <input
                                            type="text"
                                            className="ml-input"
                                            maxLength={40}
                                            placeholder="Escribe en español o inglés (ej: deportes, venganza, tiempo, oscuro)…"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    agregarPrimerTagSugerido()
                                                }
                                            }}
                                        />
                                    </div>

                                    {tagInput.trim().length > 0 && (
                                        <div className="tb-tag-autocomplete" role="listbox" aria-label="Sugerencias de tags">
                                            {sugerenciasTag.length > 0 ? (
                                                sugerenciasTag.map((sug) => (
                                                    <button
                                                        key={sug.name}
                                                        type="button"
                                                        role="option"
                                                        className="tb-tag-suggestion-item"
                                                        onClick={() => agregarTagRegistrado(sug.name)}
                                                    >
                                                        <div className="tb-tag-suggestion-top">
                                                            <span className="tb-tag-suggestion-name">#{sug.name}</span>
                                                            {sug.spanishLabel &&
                                                                sug.spanishLabel.toLowerCase() !== sug.name.toLowerCase() && (
                                                                    <span className="tb-tag-suggestion-es">
                                                                        {sug.spanishLabel}
                                                                    </span>
                                                                )}
                                                        </div>
                                                        <span className="tb-tag-suggestion-desc">
                                                            {sug.description}
                                                        </span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="tb-tag-suggestion-empty">
                                                    Sin tags registrados que coincidan con “{tagInput.trim()}”.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Buscador de animes "Parecido a" desde la base de datos */}
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-1.5">
                                <label className="ml-label mb-0" htmlFor="tb-ref">
                                    Parecido a (opcional · máx. 3 animes)
                                </label>
                                {referenciasAnimes.length > 0 && (
                                    <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                        {referenciasAnimes.length}/3
                                    </span>
                                )}
                            </div>

                            {referenciasAnimes.length > 0 && (
                                <div className="d-flex flex-column gap-1.5 mb-2">
                                    {referenciasAnimes.map((refAnime) => (
                                        <div key={refAnime.malId} className="tb-elegido">
                                            <img src={refAnime.imagenUrl} alt="" onError={alFallarPoster} />
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <div className="fw-semibold text-white text-truncate">
                                                    {refAnime.titulo}
                                                </div>
                                                <div className="small">
                                                    {refAnime.nota !== null ? `★ ${refAnime.nota}` : 'Sin nota'}
                                                    {refAnime.generos.length > 0
                                                        ? ` · ${refAnime.generos.slice(0, 2).join(', ')}`
                                                        : ''}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="ml-icon-btn"
                                                onClick={() => quitarReferenciaAnime(refAnime.malId)}
                                                aria-label={`Quitar ${refAnime.titulo}`}
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {referenciasAnimes.length < 3 && (
                                <div>
                                    <div className="ml-buscador">
                                        <Search size={15} />
                                        <input
                                            id="tb-ref"
                                            className="ml-input"
                                            placeholder="Busca un anime de referencia (ej: Monster, Death Note)…"
                                            value={busquedaRef}
                                            onChange={(e) => setBusquedaRef(e.target.value)}
                                        />
                                    </div>
                                    <div className="ml-resultados">
                                        {resultadosRef.isFetching && (
                                            <p className="small mb-0 mt-2">Buscando en el catálogo…</p>
                                        )}
                                        {resultadosRef.isError && (
                                            <p className="small mb-0 mt-2">No se pudo buscar en el catálogo.</p>
                                        )}
                                        {(resultadosRef.data ?? [])
                                            .filter((r) => !referenciasAnimes.some((a) => a.malId === r.malId))
                                            .map((r) => (
                                                <button
                                                    key={r.malId}
                                                    type="button"
                                                    className="ml-resultado"
                                                    onClick={() => agregarReferenciaAnime(r)}
                                                >
                                                    <img
                                                        src={r.imagenUrl}
                                                        alt=""
                                                        loading="lazy"
                                                        onError={alFallarPoster}
                                                    />
                                                    <span style={{ minWidth: 0 }}>
                                                        <span className="d-block fw-semibold text-truncate">
                                                            {r.titulo}
                                                        </span>
                                                        <span className="small text-secondary">
                                                            {r.nota !== null ? `★ ${r.nota}` : 'Sin nota'}
                                                        </span>
                                                    </span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {modo === 'encuesta' && (
                    <>
                        <div>
                            <label className="ml-label" htmlFor="tb-pregunta">Pregunta sobre animes</label>
                            <input
                                id="tb-pregunta"
                                data-autofocus
                                className="ml-input w-100"
                                maxLength={160}
                                placeholder="Ej: ¿Qué me recomiendan ver primero?"
                                value={pregunta}
                                onChange={(e) => setPregunta(e.target.value)}
                            />
                        </div>

                        <div className="d-flex flex-column gap-2">
                            <div className="d-flex align-items-center justify-content-between">
                                <span className="ml-label mb-0">Opciones de anime (mín. 2, máx. 4)</span>
                                <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>
                                    {opcionesAnime.length}/4 animes
                                </span>
                            </div>

                            {/* Animes ya elegidos como opciones */}
                            {opcionesAnime.length > 0 && (
                                <div className="d-flex flex-column gap-1.5">
                                    {opcionesAnime.map((op, idx) => (
                                        <div key={op.malId} className="tb-elegido">
                                            <span className="tb-opcion-num">#{idx + 1}</span>
                                            <img src={op.imagenUrl} alt="" onError={alFallarPoster} />
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <div className="fw-semibold text-white text-truncate">{op.titulo}</div>
                                                <div className="small">
                                                    {op.nota !== null ? `★ ${op.nota}` : 'Sin nota'}
                                                    {op.generos.length > 0 ? ` · ${op.generos.slice(0, 2).join(', ')}` : ''}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="ml-icon-btn"
                                                onClick={() => quitarOpcionAnime(op.malId)}
                                                aria-label={`Quitar ${op.titulo}`}
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Buscador del catálogo para añadir opciones de anime */}
                            {opcionesAnime.length < 4 && (
                                <div>
                                    <div className="ml-buscador">
                                        <Search size={16} />
                                        <input
                                            id="tb-buscar-encuesta"
                                            className="ml-input"
                                            placeholder={`Buscar anime para opción ${opcionesAnime.length + 1} (ej: Frieren, Fullmetal)…`}
                                            value={busquedaEncuesta}
                                            onChange={(e) => setBusquedaEncuesta(e.target.value)}
                                        />
                                    </div>
                                    <div className="ml-resultados">
                                        {resultadosEncuesta.isFetching && <p className="small mb-0 mt-2">Buscando…</p>}
                                        {resultadosEncuesta.isError && <p className="small mb-0 mt-2">No se pudo buscar en el catálogo.</p>}
                                        {(resultadosEncuesta.data ?? [])
                                            .filter((r) => !opcionesAnime.some((o) => o.malId === r.malId))
                                            .map((r) => (
                                                <button
                                                    key={r.malId}
                                                    type="button"
                                                    className="ml-resultado"
                                                    onClick={() => agregarOpcionAnime(r)}
                                                >
                                                    <img src={r.imagenUrl} alt="" loading="lazy" onError={alFallarPoster} />
                                                    <span style={{ minWidth: 0 }}>
                                                        <span className="d-block fw-semibold text-truncate">{r.titulo}</span>
                                                        <span className="small text-secondary">
                                                            {r.nota !== null ? `★ ${r.nota}` : 'Sin nota'}
                                                        </span>
                                                    </span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {error && <p className="small mb-0" role="alert" style={{ color: '#f87171' }}>{error}</p>}
            </div>

            <footer className="ml-dialog-pie">
                <button type="button" className="ml-btn ml-btn-fantasma" onClick={onCerrar}>Cancelar</button>
                <button type="submit" className="ml-btn ml-btn-acento" disabled={!listo || enviando}>
                    <Send size={15} /> {enviando ? 'Publicando…' : 'Publicar'}
                </button>
            </footer>
        </form>
    )
}
