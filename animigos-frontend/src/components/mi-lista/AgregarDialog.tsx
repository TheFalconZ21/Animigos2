import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { MOCK_TOP_ANIMES } from '../../data/anime-data'
import { ESCALA_NOTAS, ESTADOS, type Carpeta, type EntradaLista, type EstadoLista, alFallarPoster } from './mi-lista-data'
import { Dialogo } from './piezas'

// Reemplaza el antiguo panel lateral "Agregar a Mi Lista"
export function AgregarDialog({
    abierto,
    idsEnLista,
    carpetas,
    onCerrar,
    onAgregar,
}: {
    abierto: boolean
    idsEnLista: number[]
    carpetas: Carpeta[]
    onCerrar: () => void
    onAgregar: (entrada: EntradaLista) => void
}) {
    return (
        <Dialogo abierto={abierto} onCerrar={onCerrar} etiqueta="Agregar a Mi Lista" ancho={560}>
            <Contenido idsEnLista={idsEnLista} carpetas={carpetas} onAgregar={onAgregar} />
        </Dialogo>
    )
}

function Contenido({
    idsEnLista,
    carpetas,
    onAgregar,
}: {
    idsEnLista: number[]
    carpetas: Carpeta[]
    onAgregar: (entrada: EntradaLista) => void
}) {
    const [busqueda, setBusqueda] = useState('')
    const [elegido, setElegido] = useState<number | null>(null)
    const [estado, setEstado] = useState<EstadoLista>('pendiente')
    const [nota, setNota] = useState<number | null>(null)
    const [carpetaId, setCarpetaId] = useState('')

    // TODO backend: reemplazar por la búsqueda real del catálogo
    const resultados = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        return MOCK_TOP_ANIMES.filter((a) => !idsEnLista.includes(a.malId))
            .filter((a) => !q || a.title.toLowerCase().includes(q) || a.titleJapanese?.includes(q))
            .slice(0, 8)
    }, [busqueda, idsEnLista])

    const anime = MOCK_TOP_ANIMES.find((a) => a.malId === elegido)

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                if (!anime) return
                onAgregar({
                    malId: anime.malId,
                    estado,
                    nota: estado === 'pendiente' ? null : nota,
                    episodiosVistos: estado === 'visto' ? anime.episodes : 0,
                    favorito: false,
                    tags: [],
                    carpetaId: carpetaId || undefined,
                })
            }}
        >
            <div className="ml-dialog-cuerpo">
                <span className="ml-eyebrow">Mi Lista</span>
                <h2 className="h3 mt-1 mb-3">Agregar anime</h2>

                <div className="ml-buscador">
                    <Search size={16} />
                    <input
                        data-autofocus
                        className="ml-input"
                        placeholder="Busca por título…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="ml-resultados">
                    {resultados.map((a) => (
                        <button
                            key={a.malId}
                            type="button"
                            className="ml-resultado"
                            aria-pressed={elegido === a.malId}
                            onClick={() => setElegido(a.malId)}
                        >
                            <img src={a.imageUrl} alt="" loading="lazy" onError={alFallarPoster} />
                            <span style={{ minWidth: 0 }}>
                                <span className="d-block fw-semibold text-truncate">{a.title}</span>
                                <span className="small text-secondary">{a.studio} · {a.year} · ★ {a.score}</span>
                            </span>
                        </button>
                    ))}
                    {resultados.length === 0 && (
                        <div className="ml-vacio py-4">
                            <div className="ml-kaomoji">(・_・;)</div>
                            No encontramos ese título.
                        </div>
                    )}
                </div>

                {anime && (
                    <div className="row g-3 mt-2">
                        <div className="col-12 col-sm-4">
                            <label className="ml-label" htmlFor="ml-ag-estado">Estado</label>
                            <select id="ml-ag-estado" className="ml-select w-100" value={estado} onChange={(e) => setEstado(e.target.value as EstadoLista)}>
                                {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4">
                            <label className="ml-label" htmlFor="ml-ag-nota">Tu nota</label>
                            <select
                                id="ml-ag-nota"
                                className="ml-select w-100"
                                value={nota ?? ''}
                                disabled={estado === 'pendiente'}
                                onChange={(e) => setNota(e.target.value === '' ? null : Number(e.target.value))}
                            >
                                <option value="">Sin nota</option>
                                {Object.entries(ESCALA_NOTAS).reverse().map(([v, n]) => (
                                    <option key={v} value={v}>{v} · {n}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4">
                            <label className="ml-label" htmlFor="ml-ag-carpeta">Carpeta</label>
                            <select id="ml-ag-carpeta" className="ml-select w-100" value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)}>
                                <option value="">Ninguna</option>
                                {carpetas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <footer className="ml-dialog-pie">
                <button type="submit" className="ml-btn ml-btn-acento" disabled={!anime}>
                    <Plus size={16} /> {anime ? `Agregar ${anime.title.length > 26 ? 'a la lista' : anime.title}` : 'Elige un anime'}
                </button>
            </footer>
        </form>
    )
}
