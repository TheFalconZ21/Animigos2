import { useState } from 'react'
import { ArrowRight, Hash, Trash2 } from 'lucide-react'
import type { FilaLista } from './mi-lista-data'

export function PestanaTags({
    tags,
    filas,
    onCrear,
    onEliminar,
    onFiltrar,
}: {
    tags: string[]
    filas: FilaLista[]
    onCrear: (tag: string) => void
    onEliminar: (tag: string) => void
    onFiltrar: (tag: string) => void
}) {
    const [nuevo, setNuevo] = useState('')

    return (
        <>
            <form
                className="d-flex gap-2 mb-4"
                style={{ maxWidth: 460 }}
                onSubmit={(e) => {
                    e.preventDefault()
                    const tag = nuevo.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
                    if (tag) onCrear(tag)
                    setNuevo('')
                }}
            >
                <div className="ml-buscador">
                    <Hash size={16} />
                    <input className="ml-input" placeholder="nuevo-tag" value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="Nuevo tag" />
                </div>
                <button type="submit" className="ml-btn ml-btn-acento" disabled={!nuevo.trim()}>Crear tag</button>
            </form>

            {tags.length === 0 ? (
                <div className="ml-vacio">
                    <div className="ml-kaomoji">( ˘ω˘ )</div>
                    Todavía no tienes tags. Crea uno, como <strong>#para-llorar</strong>.
                </div>
            ) : (
                <div className="ml-grid-tags">
                    {tags.map((tag) => {
                        const cuantos = filas.filter((f) => f.tags.includes(tag)).length
                        return (
                            <div key={tag} className="ml-tag-card">
                                <div className="ml-tag-card-nombre"><span>#</span>{tag}</div>
                                <span className="small text-nowrap">{cuantos} {cuantos === 1 ? 'anime' : 'animes'}</span>
                                <button type="button" className="ml-icon-btn" onClick={() => onFiltrar(tag)} aria-label={`Ver animes con #${tag}`} disabled={cuantos === 0}>
                                    <ArrowRight size={15} />
                                </button>
                                <button
                                    type="button"
                                    className="ml-icon-btn ml-peligro"
                                    aria-label={`Eliminar #${tag}`}
                                    onClick={() => {
                                        if (cuantos === 0 || confirm(`¿Eliminar #${tag}? Se quitará de ${cuantos} anime(s).`)) onEliminar(tag)
                                    }}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </>
    )
}
