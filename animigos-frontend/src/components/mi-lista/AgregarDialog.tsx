import { useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { searchCatalogAnimes, type ApiAnimeData } from '../../services/userListApi'
import { ESCALA_NOTAS, ESTADOS, type Carpeta, type EntradaLista, type EstadoLista, alFallarPoster } from './mi-lista-data'
import { Dialogo } from './piezas'

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
    onAgregar: (entrada: EntradaLista, animeData: ApiAnimeData) => void
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
    onAgregar: (entrada: EntradaLista, animeData: ApiAnimeData) => void
}) {
    const [busqueda, setBusqueda] = useState('')
    const [buscando, setBuscando] = useState(false)
    const [catalogo, setCatalogo] = useState<ApiAnimeData[]>([])
    const [elegido, setElegido] = useState<number | null>(null)
    const [estado, setEstado] = useState<EstadoLista>('pendiente')
    const [nota, setNota] = useState<number | null>(null)
    const [carpetaId, setCarpetaId] = useState('')

    // Búsqueda dinámica en tiempo real contra el backend
    useEffect(() => {
        let cancelado = false
        setBuscando(true)

        const timer = setTimeout(() => {
            searchCatalogAnimes(busqueda, 12)
                .then((datos) => {
                    if (!cancelado) {
                        setCatalogo(datos)
                    }
                })
                .catch((err) => {
                    console.error('Error al consultar catálogo de animes:', err)
                })
                .finally(() => {
                    if (!cancelado) setBuscando(false)
                })
        }, 280)

        return () => {
            cancelado = true
            clearTimeout(timer)
        }
    }, [busqueda])

    const resultados = catalogo.filter((a) => !idsEnLista.includes(a.mal_id))
    const anime = catalogo.find((a) => a.mal_id === elegido)

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                if (!anime) return
                onAgregar(
                    {
                        malId: anime.mal_id,
                        estado,
                        nota: estado === 'pendiente' ? null : nota,
                        episodiosVistos: estado === 'visto' ? anime.episodes || 24 : 0,
                        favorito: false,
                        tags: [],
                        carpetaId: carpetaId || undefined,
                    },
                    anime,
                )
            }}
        >
            <div className="ml-dialog-cuerpo">
                <span className="ml-eyebrow">Mi Lista</span>
                <h2 className="h3 mt-1 mb-3">Agregar anime</h2>

                <div className="ml-buscador position-relative">
                    <Search size={16} />
                    <input
                        data-autofocus
                        className="ml-input"
                        placeholder="Busca por título en el catálogo…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                    {buscando && (
                        <span className="position-absolute end-0 me-3 text-secondary" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                            <Loader2 size={15} className="spinner-border-sm" style={{ animation: 'spin 1s linear infinite' }} />
                        </span>
                    )}
                </div>

                <div className="ml-resultados mt-2">
                    {resultados.map((a) => {
                        const scoreDisplay = a.score ? Number(a.score).toFixed(1) : 'S/P'
                        return (
                            <button
                                key={a.mal_id}
                                type="button"
                                className="ml-resultado"
                                aria-pressed={elegido === a.mal_id}
                                onClick={() => setElegido(a.mal_id)}
                            >
                                <img src={a.image_url} alt="" loading="lazy" onError={alFallarPoster} />
                                <span style={{ minWidth: 0 }}>
                                    <span className="d-block fw-semibold text-truncate">{a.title}</span>
                                    <span className="small text-secondary">
                                        {a.studio || 'Estudio'} · {a.season_year || a.type || 'TV'} · ★ {scoreDisplay}
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                    {!buscando && resultados.length === 0 && (
                        <div className="ml-vacio py-4">
                            <div className="ml-kaomoji">(・_・;)</div>
                            No encontramos títulos en el catálogo con esa búsqueda.
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
