import { useState } from 'react'
import { ChevronDown, FolderPlus, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { promedio, type Carpeta, type FilaLista, alFallarPoster } from './mi-lista-data'
import { SelloNota } from './piezas'

interface Props {
    carpetas: Carpeta[]
    filas: FilaLista[]
    onCrear: (nombre: string) => void
    onRenombrar: (id: string, nombre: string) => void
    onEliminar: (id: string) => void
    onMover: (malId: number, carpetaId: string | undefined) => void
    onRecomendar: (carpeta: Carpeta) => void
    onVerDetalle: (malId: number) => void
}

export function PestanaCarpetas({ carpetas, filas, onCrear, onRenombrar, onEliminar, onMover, onRecomendar, onVerDetalle }: Props) {
    const [nuevoNombre, setNuevoNombre] = useState('')

    return (
        <div className="ml-grid-carpetas">
            {carpetas.map((c) => (
                <TarjetaCarpeta
                    key={c.id}
                    carpeta={c}
                    miembros={filas.filter((f) => f.carpetaId === c.id)}
                    sueltos={filas.filter((f) => !f.carpetaId)}
                    onRenombrar={(nombre) => onRenombrar(c.id, nombre)}
                    onEliminar={() => onEliminar(c.id)}
                    onMover={onMover}
                    onRecomendar={() => onRecomendar(c)}
                    onVerDetalle={onVerDetalle}
                />
            ))}

            <form
                className="ml-carpeta ml-carpeta-nueva"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (!nuevoNombre.trim()) return
                    onCrear(nuevoNombre.trim())
                    setNuevoNombre('')
                }}
            >
                <FolderPlus size={26} color="var(--ml-acento)" />
                <div>
                    <h3 className="ml-carpeta-nombre">Nueva carpeta</h3>
                    <p className="small mb-0">Agrupa sagas o temporadas. Su nota será el promedio de tus notas.</p>
                </div>
                <div className="d-flex gap-2">
                    <input
                        className="ml-input flex-grow-1"
                        placeholder="Ej: Saga Monogatari"
                        value={nuevoNombre}
                        onChange={(e) => setNuevoNombre(e.target.value)}
                        aria-label="Nombre de la carpeta"
                    />
                    <button type="submit" className="ml-btn ml-btn-acento" disabled={!nuevoNombre.trim()}>Crear</button>
                </div>
            </form>
        </div>
    )
}

function TarjetaCarpeta({
    carpeta,
    miembros,
    sueltos,
    onRenombrar,
    onEliminar,
    onMover,
    onRecomendar,
    onVerDetalle,
}: {
    carpeta: Carpeta
    miembros: FilaLista[]
    sueltos: FilaLista[]
    onRenombrar: (nombre: string) => void
    onEliminar: () => void
    onMover: (malId: number, carpetaId: string | undefined) => void
    onRecomendar: () => void
    onVerDetalle: (malId: number) => void
}) {
    const [abierta, setAbierta] = useState(false)
    const [editando, setEditando] = useState(false)
    const [nombre, setNombre] = useState(carpeta.nombre)
    const notaMedia = promedio(miembros.map((m) => m.nota))
    const malMedia = promedio(miembros.map((m) => m.anime.score))

    return (
        <article className="ml-carpeta">
            <div className="ml-abanico">
                {miembros.length > 0 ? (
                    miembros.slice(0, 3).map((m) => <img key={m.malId} src={m.anime.imageUrl} alt="" loading="lazy" onError={alFallarPoster} />)
                ) : (
                    <div className="ml-abanico-vacio">Carpeta vacía</div>
                )}
                {notaMedia !== null && <SelloNota nota={notaMedia} conEtiqueta={false} />}
            </div>

            {editando ? (
                <form
                    className="d-flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (nombre.trim()) onRenombrar(nombre.trim())
                        setEditando(false)
                    }}
                >
                    <input autoFocus className="ml-input flex-grow-1" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre de la carpeta" />
                    <button type="submit" className="ml-btn ml-btn-sm">Guardar</button>
                </form>
            ) : (
                <div className="d-flex align-items-center gap-1">
                    <h3 className="ml-carpeta-nombre flex-grow-1">{carpeta.nombre}</h3>
                    <button type="button" className="ml-icon-btn" onClick={() => setEditando(true)} aria-label="Renombrar carpeta">
                        <Pencil size={15} />
                    </button>
                    <button
                        type="button"
                        className="ml-icon-btn ml-peligro"
                        aria-label="Eliminar carpeta"
                        onClick={() => {
                            if (confirm(`¿Eliminar "${carpeta.nombre}"? Los animes seguirán en tu lista.`)) onEliminar()
                        }}
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            )}

            <p className="small mt-1 mb-3">
                {miembros.length} {miembros.length === 1 ? 'anime' : 'animes'}
                {notaMedia !== null && <> · tu promedio <strong className="text-white">{notaMedia.toFixed(1)}</strong></>}
                {malMedia !== null && <> · MAL {malMedia.toFixed(2)}</>}
            </p>

            <div className="d-flex flex-wrap align-items-center gap-1 mt-auto">
                <button type="button" className="ml-btn ml-btn-sm" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
                    <ChevronDown size={14} style={{ transform: abierta ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
                    {abierta ? 'Ocultar' : 'Ver animes'}
                </button>
                <button type="button" className="ml-btn ml-btn-sm" onClick={onRecomendar} disabled={miembros.length === 0}>
                    <Send size={14} /> Recomendar
                </button>
            </div>

            {abierta && (
                <ul className="ml-carpeta-miembros">
                    {miembros.map((m) => (
                        <li key={m.malId}>
                            <img src={m.anime.imageUrl} alt="" onError={alFallarPoster} />
                            <button type="button" className="ml-link text-start flex-grow-1 text-white text-decoration-none" onClick={() => onVerDetalle(m.malId)}>
                                {m.anime.title}
                            </button>
                            <span className="small">{m.nota ?? '—'}</span>
                            <button type="button" className="ml-icon-btn" onClick={() => onMover(m.malId, undefined)} aria-label={`Sacar ${m.anime.title} de la carpeta`}>
                                <X size={14} />
                            </button>
                        </li>
                    ))}
                    {sueltos.length > 0 && (
                        <li>
                            <Plus size={16} />
                            <select
                                className="ml-select flex-grow-1"
                                value=""
                                onChange={(e) => e.target.value && onMover(Number(e.target.value), carpeta.id)}
                                aria-label="Agregar un anime de tu lista a esta carpeta"
                            >
                                <option value="">Agregar anime de tu lista…</option>
                                {sueltos.map((s) => <option key={s.malId} value={s.malId}>{s.anime.title}</option>)}
                            </select>
                        </li>
                    )}
                </ul>
            )}
        </article>
    )
}
