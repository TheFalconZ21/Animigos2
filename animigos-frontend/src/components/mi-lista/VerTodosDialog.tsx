import { useMemo, useState } from 'react'
import { Heart, Search } from 'lucide-react'
import { ESCALA_NOTAS, alFallarPoster, type FilaLista } from './mi-lista-data'
import { Dialogo } from './piezas'

type Agrupar = 'temporada' | 'estudio' | 'nota'

const AGRUPACIONES: { id: Agrupar; label: string }[] = [
    { id: 'temporada', label: 'Temporada' },
    { id: 'estudio', label: 'Estudio' },
    { id: 'nota', label: 'Tu nota' },
]

// Orden de las temporadas dentro de un año (la más reciente primero)
const ORDEN_TEMPORADA: Record<string, number> = { 'Otoño': 4, 'Verano': 3, 'Primavera': 2, 'Invierno': 1 }

interface Grupo {
    titulo: string
    orden: number | string
    filas: FilaLista[]
}

// Vista de "estantería": todos los animes de una categoría en filas de pósters
export function VerTodosDialog({
    categoria,
    filas,
    onCerrar,
    onVerDetalle,
}: {
    categoria: string | null   // "Viendo", "Favoritos"... (null = cerrado)
    filas: FilaLista[]
    onCerrar: () => void
    onVerDetalle: (malId: number) => void
}) {
    return (
        <Dialogo abierto={categoria !== null} onCerrar={onCerrar} etiqueta={`Todos: ${categoria ?? ''}`} ancho={980}>
            {categoria && <Contenido categoria={categoria} filas={filas} onVerDetalle={onVerDetalle} />}
        </Dialogo>
    )
}

function Contenido({
    categoria,
    filas,
    onVerDetalle,
}: {
    categoria: string
    filas: FilaLista[]
    onVerDetalle: (malId: number) => void
}) {
    const [busqueda, setBusqueda] = useState('')
    const [agrupar, setAgrupar] = useState<Agrupar>('temporada')

    const grupos = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        const mapa = new Map<string, Grupo>()

        filas
            .filter((f) => !q || f.anime.title.toLowerCase().includes(q))
            .forEach((f) => {
                let titulo: string
                let orden: number | string
                if (agrupar === 'temporada') {
                    titulo = `${f.anime.season ?? ''} ${f.anime.year ?? 'Sin fecha'}`.trim()
                    orden = (f.anime.year ?? 0) * 10 + (ORDEN_TEMPORADA[f.anime.season ?? ''] ?? 0)
                } else if (agrupar === 'estudio') {
                    titulo = f.anime.studio
                    orden = f.anime.studio
                } else {
                    titulo = f.nota === null ? 'Sin nota' : `${f.nota} · ${ESCALA_NOTAS[f.nota]}`
                    orden = f.nota ?? -1
                }
                const grupo = mapa.get(titulo) ?? { titulo, orden, filas: [] }
                grupo.filas.push(f)
                mapa.set(titulo, grupo)
            })

        return [...mapa.values()].sort((a, b) =>
            typeof a.orden === 'number' && typeof b.orden === 'number'
                ? b.orden - a.orden
                : String(a.orden).localeCompare(String(b.orden)),
        )
    }, [filas, busqueda, agrupar])

    return (
        <div className="ml-dialog-cuerpo">
            <span className="ml-eyebrow">Mi Lista</span>
            <h2 className="h3 mt-1 mb-0 pe-5">
                {categoria} <span className="text-secondary fw-normal fs-6">· {filas.length} {filas.length === 1 ? 'anime' : 'animes'}</span>
            </h2>

            <div className="ml-estante-controles">
                <div className="ml-buscador">
                    <Search size={16} />
                    <input
                        data-autofocus
                        className="ml-input"
                        placeholder={`Buscar en ${categoria.toLowerCase()}…`}
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        aria-label="Buscar"
                    />
                </div>
                <div className="ml-segmentado" role="group" aria-label="Agrupar por">
                    {AGRUPACIONES.map((a) => (
                        <button key={a.id} type="button" aria-pressed={agrupar === a.id} onClick={() => setAgrupar(a.id)}>
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="ml-estantes mt-4">
                {grupos.map((g) => (
                    <section key={g.titulo} className="ml-estante-grupo">
                        <div className="ml-estante-titulo">
                            <h3>{g.titulo}</h3>
                            <span>{g.filas.length}</span>
                        </div>
                        <div className="ml-estante">
                            {g.filas.map((f) => (
                                <button
                                    key={f.malId}
                                    type="button"
                                    className="ml-portada"
                                    onClick={() => onVerDetalle(f.malId)}
                                    aria-label={`Ver detalle de ${f.anime.title}`}
                                >
                                    <img src={f.anime.imageUrl} alt="" loading="lazy" onError={alFallarPoster} />
                                    {f.favorito && (
                                        <span className="ml-marcapaginas" title="Favorito">
                                            <Heart size={10} fill="currentColor" />
                                        </span>
                                    )}
                                    {f.nota !== null && <span className="ml-portada-nota">{f.nota}</span>}
                                    <span className="ml-portada-titulo">{f.anime.title}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                ))}

                {grupos.length === 0 && (
                    <div className="ml-vacio py-4">
                        <div className="ml-kaomoji">(・_・;)</div>
                        {filas.length === 0 ? 'Todavía no hay animes en esta categoría.' : 'Ningún título coincide.'}
                    </div>
                )}
            </div>
        </div>
    )
}
