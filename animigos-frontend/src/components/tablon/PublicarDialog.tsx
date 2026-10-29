import { useEffect, useState } from 'react'
import { Lightbulb, Plus, Search, Send, Vote, X } from 'lucide-react'
import { fetchFriends, type FriendUser } from '../../services/friendsApi'
import type { AnimeResumen, NuevaRecomendacion } from '../../services/feedApi'
import { useBuscarAnimes } from '../../hooks/useTablon'
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

interface Acciones {
    onRecomendar: (datos: NuevaRecomendacion) => Promise<unknown>
    onBuscar: (datos: { pedido: string; referencia?: string }) => Promise<unknown>
    onEncuesta: (datos: { pregunta: string; opciones: string[] }) => Promise<unknown>
}

// Un solo diálogo para las tres formas de publicar en el tablón
export function PublicarDialog({ borrador, onCerrar, ...acciones }: Acciones & { borrador: Borrador | null; onCerrar: () => void }) {
    return (
        <Dialogo abierto={borrador !== null} onCerrar={onCerrar} etiqueta="Publicar en el tablón" ancho={580}>
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
    // Pedir sugerencia
    const [pedido, setPedido] = useState('')
    const [referencia, setReferencia] = useState('')
    // Encuesta
    const [pregunta, setPregunta] = useState('')
    const [opciones, setOpciones] = useState(['', ''])

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

    // Espera a que el usuario deje de escribir antes de buscar
    useEffect(() => {
        const t = setTimeout(() => setTextoBuscado(busqueda), 300)
        return () => clearTimeout(t)
    }, [busqueda])
    const resultados = useBuscarAnimes(textoBuscado)

    const opcionesValidas = opciones.map((o) => o.trim()).filter(Boolean)
    const listo =
        modo === 'recomendar' ? anime !== null && nota.trim() !== ''
            : modo === 'buscar' ? pedido.trim() !== ''
                : pregunta.trim() !== '' && opcionesValidas.length >= 2

    const publicar = async () => {
        setEnviando(true)
        setError(null)
        try {
            if (modo === 'recomendar' && anime) await onRecomendar({ anime, nota: nota.trim(), destinatarioId: destinatario || null })
            if (modo === 'buscar') await onBuscar({ pedido: pedido.trim(), referencia: referencia.trim() })
            if (modo === 'encuesta') await onEncuesta({ pregunta: pregunta.trim(), opciones: opcionesValidas })
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
                        <div>
                            <label className="ml-label" htmlFor="tb-ref">Parecido a (opcional)</label>
                            <input id="tb-ref" className="ml-input w-100" placeholder="Ej: Monster, Death Note" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                        </div>
                    </>
                )}

                {modo === 'encuesta' && (
                    <>
                        <div>
                            <label className="ml-label" htmlFor="tb-pregunta">Pregunta</label>
                            <input id="tb-pregunta" data-autofocus className="ml-input w-100" maxLength={160} placeholder="¿Qué vemos este sábado?" value={pregunta} onChange={(e) => setPregunta(e.target.value)} />
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <span className="ml-label mb-0">Opciones</span>
                            {opciones.map((o, i) => (
                                <div key={i} className="d-flex gap-2">
                                    <input
                                        className="ml-input flex-grow-1"
                                        maxLength={60}
                                        placeholder={`Opción ${i + 1}`}
                                        value={o}
                                        onChange={(e) => setOpciones(opciones.map((x, j) => (j === i ? e.target.value : x)))}
                                        aria-label={`Opción ${i + 1}`}
                                    />
                                    {opciones.length > 2 && (
                                        <button type="button" className="ml-icon-btn" onClick={() => setOpciones(opciones.filter((_, j) => j !== i))} aria-label={`Quitar opción ${i + 1}`}>
                                            <X size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {opciones.length < 4 && (
                                <button type="button" className="ml-link align-self-start" onClick={() => setOpciones([...opciones, ''])}>
                                    <Plus size={13} /> Agregar opción
                                </button>
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
