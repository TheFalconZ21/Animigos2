import { useMemo, useState, type CSSProperties } from 'react'
import { Folder, Hash, LayoutGrid, LayoutList, Loader2, Plus, Search, Send, SlidersHorizontal, Upload, X } from 'lucide-react'
import {
    ESCALA_NOTAS,
    ESTADOS,
    medioDe,
    promedio,
    type EntradaLista,
    type EstadoLista,
    type FilaLista,
} from './mi-lista-data'
import type { ApiAnimeData } from '../../services/userListApi'
import { useMyList } from '../../hooks/useMyList'
import { useThemeAccent } from '../../hooks/useThemeAccent'
import { AnimeFila } from './AnimeFila'
import { PestanaCarpetas } from './PestanaCarpetas'
import { PestanaTags } from './PestanaTags'
import { AnimeDetalleDialog } from './AnimeDetalleDialog'
import { RecomendarDialog, type Paquete } from './RecomendarDialog'
import { AgregarDialog } from './AgregarDialog'
import { ImportarMalXmlDialog } from './ImportarMalXmlDialog'
import { VerTodosDialog } from './VerTodosDialog'
import { LateralesAnime } from './LateralesAnime'
import { SelloNota } from './piezas'
import './mi-lista.css'

// ============================================================
// MI LISTA — Colección personal reactiva con TanStack Query y DRF
// ============================================================

type Pestana = 'animes' | 'carpetas' | 'tags'
type FiltroEstado = 'todos' | EstadoLista | 'favoritos'
type Orden = 'nota-desc' | 'nota-asc' | 'mal' | 'titulo' | 'anio' | 'agregado'

interface Filtros {
    anio: string
    estudio: string
    medio: string
    genero: string
    tag: string
}

const FILTROS_VACIOS: Filtros = { anio: '', estudio: '', medio: '', genero: '', tag: '' }

const ORDENES: { id: Orden; label: string }[] = [
    { id: 'nota-desc', label: 'Tu nota (mayor)' },
    { id: 'nota-asc', label: 'Tu nota (menor)' },
    { id: 'mal', label: 'Nota MAL' },
    { id: 'titulo', label: 'Título A–Z' },
    { id: 'anio', label: 'Más recientes' },
    { id: 'agregado', label: 'Agregados últimamente' },
]

const ACENTOS = [
    { id: 'auto', label: 'Automático (por género)' },
    { id: '#e8508f', label: 'Sakura' },
    { id: '#38bdf8', label: 'Cielo' },
    { id: '#a78bfa', label: 'Lavanda' },
    { id: '#34d399', label: 'Jade' },
    { id: '#fbbf24', label: 'Ámbar' },
]

const CHIPS_ESTADO: { id: FiltroEstado; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'visto', label: 'Vistos' },
    { id: 'viendo', label: 'Viendo' },
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'favoritos', label: 'Favoritos' },
]

export function MiLista() {
    // --- Capa de Lógica / Hooks Reactivos (Pilar 1.2 y 4.3 de la Directiva de Arquitectura) ---
    const {
        filas,
        carpetas,
        tags,
        cargando,
        errorCarga,
        actualizar,
        quitar,
        agregarAnime,
        crearCarpeta,
        renombrarCarpeta,
        eliminarCarpeta,
        crearTag,
        eliminarTag,
        refetch,
    } = useMyList()

    // --- Interfaz Local ---
    const [pestana, setPestana] = useState<Pestana>('animes')
    const [busqueda, setBusqueda] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
    const [orden, setOrden] = useState<Orden>('nota-desc')
    const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
    const [verFiltros, setVerFiltros] = useState(false)
    const { acento, acentoModo, setAcentoModo, generoDominante } = useThemeAccent()

    // --- Diálogos ---
    const [detalleId, setDetalleId] = useState<number | null>(null)
    const [paquete, setPaquete] = useState<Paquete | null>(null)
    const [agregarAbierto, setAgregarAbierto] = useState(false)
    const [importarAbierto, setImportarAbierto] = useState(false)
    const [verTodos, setVerTodos] = useState<string | null>(null)

    const handleAgregarAnime = async (nuevaEntrada: EntradaLista, _animeData?: ApiAnimeData) => {
        try {
            await agregarAnime(nuevaEntrada, _animeData)
        } catch (err) {
            console.error('Error al agregar anime a la lista:', err)
        } finally {
            setAgregarAbierto(false)
            setPestana('animes')
        }
    }

    const handleCrearCarpeta = async (nombre: string) => {
        try {
            await crearCarpeta(nombre)
        } catch (err) {
            console.error('Error al crear carpeta:', err)
        }
    }

    const handleRenombrarCarpeta = async (id: string, nombre: string) => {
        try {
            await renombrarCarpeta(id, nombre)
        } catch (err) {
            console.error('Error al renombrar carpeta:', err)
        }
    }

    const handleEliminarCarpeta = async (id: string) => {
        try {
            await eliminarCarpeta(id)
        } catch (err) {
            console.error('Error al eliminar carpeta:', err)
        }
    }

    const recomendarUno = (fila: FilaLista) =>
        setPaquete({ titulo: fila.anime.title, criterio: 'Un anime de tu lista', filas: [fila] })

    // --- Resúmenes de la cabecera ---
    const vistos = filas.filter((f) => f.estado === 'visto').length
    const notaMedia = promedio(filas.map((f) => f.nota))
    const horas = Math.round(
        filas.reduce((total, f) => total + f.episodiosVistos * (medioDe(f.anime) === 'Película' ? 110 : 24), 0) / 60,
    )

    const conteoEstado = (id: FiltroEstado) =>
        id === 'todos' ? filas.length : id === 'favoritos' ? filas.filter((f) => f.favorito).length : filas.filter((f) => f.estado === id).length

    // Opciones de los filtros, sacadas de la propia lista
    const opciones = useMemo(() => {
        const unicos = (valores: (string | number | undefined)[]) =>
            [...new Set(valores.filter((v) => v !== undefined).map(String))]
        return {
            anios: unicos(filas.map((f) => f.anime.year)).sort((a, b) => Number(b) - Number(a)),
            estudios: unicos(filas.map((f) => f.anime.studio)).sort(),
            medios: unicos(filas.map((f) => medioDe(f.anime))).sort(),
            generos: unicos(filas.flatMap((f) => f.anime.genres)).sort(),
        }
    }, [filas])

    // --- Filtrado y orden ---
    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        const resultado = filas.filter((f) => {
            if (filtroEstado === 'favoritos' && !f.favorito) return false
            if (filtroEstado !== 'todos' && filtroEstado !== 'favoritos' && f.estado !== filtroEstado) return false
            if (filtros.anio && String(f.anime.year) !== filtros.anio) return false
            if (filtros.estudio && f.anime.studio !== filtros.estudio) return false
            if (filtros.medio && medioDe(f.anime) !== filtros.medio) return false
            if (filtros.genero && !f.anime.genres.includes(filtros.genero)) return false
            if (filtros.tag && !f.tags.includes(filtros.tag)) return false
            if (q) {
                const carpeta = carpetas.find((c) => c.id === f.carpetaId)?.nombre ?? ''
                const texto = [f.anime.title, f.anime.titleJapanese, f.anime.studio, carpeta, ...f.tags].join(' ').toLowerCase()
                if (!texto.includes(q)) return false
            }
            return true
        })

        const posicion = new Map(filas.map((e, i) => [e.malId, i]))
        const nota = (f: FilaLista) => f.nota ?? -1
        const comparar: Record<Orden, (a: FilaLista, b: FilaLista) => number> = {
            'nota-desc': (a, b) => nota(b) - nota(a) || b.anime.score - a.anime.score,
            'nota-asc': (a, b) => nota(a) - nota(b),
            mal: (a, b) => b.anime.score - a.anime.score,
            titulo: (a, b) => a.anime.title.localeCompare(b.anime.title),
            anio: (a, b) => (b.anime.year ?? 0) - (a.anime.year ?? 0),
            agregado: (a, b) => posicion.get(b.malId)! - posicion.get(a.malId)!,
        }
        return resultado.sort(comparar[orden])
    }, [filas, carpetas, busqueda, filtroEstado, filtros, orden])

    // Filtros activos como pastillas que se pueden quitar
    const activos = (
        [
            ['anio', 'Año'],
            ['estudio', 'Estudio'],
            ['medio', 'Medio'],
            ['genero', 'Género'],
            ['tag', 'Tag'],
        ] as [keyof Filtros, string][]
    ).filter(([clave]) => filtros[clave])

    const hayFiltros = activos.length > 0 || busqueda.trim() !== '' || filtroEstado !== 'todos'

    const limpiarFiltros = () => {
        setFiltros(FILTROS_VACIOS)
        setBusqueda('')
        setFiltroEstado('todos')
    }

    const recomendarSeleccion = () => {
        const partes = [
            filtroEstado !== 'todos' && CHIPS_ESTADO.find((c) => c.id === filtroEstado)?.label,
            ...activos.map(([clave]) => (clave === 'tag' ? `#${filtros.tag}` : filtros[clave])),
            busqueda.trim() && `“${busqueda.trim()}”`,
        ].filter(Boolean)
        setPaquete({
            titulo: 'Tu selección',
            criterio: partes.length ? `Filtrado por: ${partes.join(' · ')}` : 'Toda tu lista, sin filtros',
            filas: visibles,
        })
    }

    const filaDetalle = filas.find((f) => f.malId === detalleId) ?? null

    return (
        <section className="ml-root" style={{ '--ml-acento': acento } as CSSProperties}>
            <LateralesAnime />

            <div className="container">
                {/* ---------- Cabecera ---------- */}
                <header className="ml-header">
                    <div className="ml-header-info">
                        <span className="ml-eyebrow">Tu colección</span>
                        <h1 className="ml-titulo">Mi Lista</h1>
                        <p className="ml-sub">
                            <strong>{filas.length}</strong> animes guardados · <strong>~{horas} horas</strong> frente a la pantalla
                        </p>
                        <div className="ml-header-acciones">
                            <button type="button" className="ml-btn ml-btn-acento" onClick={() => setAgregarAbierto(true)}>
                                <Plus size={16} /> Agregar anime
                            </button>
                            <button
                                type="button"
                                className="ml-btn"
                                style={{
                                    background: 'var(--cat-surface-2, #18181f)',
                                    border: '1px solid var(--cat-border, rgba(255, 255, 255, 0.1))',
                                    color: '#f4f4f5',
                                }}
                                onClick={() => setImportarAbierto(true)}
                                title="Importa tu lista oficial desde animelist.xml de MyAnimeList"
                            >
                                <Upload size={15} /> Importar MyAnimeList (.xml)
                            </button>
                            <select
                                className="ml-select"
                                value={acentoModo}
                                onChange={(e) => setAcentoModo(e.target.value)}
                                aria-label="Color de acento"
                                title="Color de acento de tu lista"
                            >
                                {ACENTOS.map((a) => <option key={a.id} value={a.id}>Acento: {a.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Ficha de la lista: reparto por estado + nota media */}
                    <aside className="ml-ficha-lista" aria-label="Resumen de tu lista">
                        <div className="ml-ficha-lista-cuerpo">
                            <div className="ml-ficha-encabezado">
                                <div>
                                    <div className="mb-1">Cómo va tu lista</div>
                                    <div className="ml-ficha-porcentaje">
                                        {filas.length ? Math.round((vistos / filas.length) * 100) : 0}<small>%</small>
                                    </div>
                                </div>
                                <span className="text-end"><strong>{vistos}</strong> de <strong>{filas.length}</strong><br />terminados</span>
                            </div>
                            <div className="ml-barra-estados" aria-hidden="true">
                                {ESTADOS.map((e) => (
                                    <span key={e.id} style={{ flexGrow: conteoEstado(e.id), background: `var(--ml-${e.id})` }} />
                                ))}
                            </div>
                            <ul className="ml-leyenda">
                                {ESTADOS.map((e) => (
                                    <li key={e.id}>
                                        <span className={`ml-punto ml-punto-${e.id}`} /> <strong>{conteoEstado(e.id)}</strong> {CHIPS_ESTADO.find((c) => c.id === e.id)!.label.toLowerCase()}
                                    </li>
                                ))}
                            </ul>
                            <div className="ml-ficha-pie">
                                <SelloNota nota={notaMedia} conEtiqueta={false} />
                                <div>
                                    Nota media
                                    <strong>{notaMedia !== null ? `${notaMedia.toFixed(1)} · ${ESCALA_NOTAS[Math.round(notaMedia)]}` : 'Sin notas aún'}</strong>
                                </div>
                                {generoDominante && (
                                    <>
                                        <span className="ml-ficha-sep" />
                                        <div>
                                            Lo que más ves
                                            <strong>{generoDominante}</strong>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <span className="ml-lomo" lang="ja" aria-hidden="true">マイリスト</span>
                    </aside>

                    {/* ---------- Pestañas (debajo del título, a la altura del final de la ficha) ---------- */}
                    <div className="ml-header-tabs">
                    <div className="ml-tabs" role="tablist" aria-label="Secciones de Mi Lista">
                        {(
                            [
                                ['animes', 'Animes', filas.length, <LayoutList key="i" size={16} />],
                                ['carpetas', 'Carpetas', carpetas.length, <Folder key="i" size={16} />],
                                ['tags', 'Tags', tags.length, <Hash key="i" size={16} />],
                            ] as const
                        ).map(([id, label, num, icono]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                className="ml-tab"
                                aria-selected={pestana === id}
                                onClick={() => setPestana(id)}
                            >
                                {icono} {label} <span className="ml-tab-num">{num}</span>
                            </button>
                        ))}
                    </div>
                    </div>
                </header>
            </div>

            <div className="container pb-5">
                {/* ---------- Pestaña: Animes ---------- */}
                {pestana === 'animes' && (
                    <div className="ml-panel" role="tabpanel" key="animes">
                        <div className="ml-toolbar">
                            <div className="ml-buscador">
                                <Search size={16} />
                                <input
                                    className="ml-input"
                                    placeholder="Buscar por título, estudio, carpeta o #tag…"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    aria-label="Buscar en Mi Lista"
                                />
                            </div>
                            <select className="ml-select" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} aria-label="Ordenar por">
                                {ORDENES.map((o) => <option key={o.id} value={o.id}>Orden: {o.label}</option>)}
                            </select>
                            <button type="button" className="ml-btn" aria-expanded={verFiltros} onClick={() => setVerFiltros(!verFiltros)}>
                                <SlidersHorizontal size={15} /> Filtros
                                {activos.length > 0 && <span className="ml-badge-contador">{activos.length}</span>}
                            </button>
                            <button
                                type="button"
                                className="ml-btn"
                                onClick={recomendarSeleccion}
                                disabled={visibles.length === 0}
                                title="Envía a un amigo todo lo que estás viendo ahora"
                            >
                                <Send size={15} /> Recomendar lo que ves
                            </button>
                        </div>

                        {verFiltros && (
                            <div className="ml-filtros">
                                <SelectFiltro label="Año de estreno" valor={filtros.anio} opciones={opciones.anios} todos="Todos los años"
                                    onCambiar={(anio) => setFiltros({ ...filtros, anio })} />
                                <SelectFiltro label="Estudio" valor={filtros.estudio} opciones={opciones.estudios} todos="Todos los estudios"
                                    onCambiar={(estudio) => setFiltros({ ...filtros, estudio })} />
                                <SelectFiltro label="Medio / Formato" valor={filtros.medio} opciones={opciones.medios} todos="Todos los medios"
                                    onCambiar={(medio) => setFiltros({ ...filtros, medio })} />
                                <SelectFiltro label="Género" valor={filtros.genero} opciones={opciones.generos} todos="Todos los géneros"
                                    onCambiar={(genero) => setFiltros({ ...filtros, genero })} />
                                <SelectFiltro label="Tag" valor={filtros.tag} opciones={tags} todos="Todos los tags"
                                    onCambiar={(tag) => setFiltros({ ...filtros, tag })} />
                            </div>
                        )}

                        <div className="ml-chips-fila">
                            <div className="ml-chips" role="group" aria-label="Filtrar por estado">
                                {CHIPS_ESTADO.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className="ml-chip"
                                        aria-pressed={filtroEstado === c.id}
                                        onClick={() => setFiltroEstado(c.id)}
                                    >
                                        {c.id !== 'todos' && c.id !== 'favoritos' && <span className={`ml-punto ml-punto-${c.id}`} />}
                                        {c.label} <span className="ml-chip-num">{conteoEstado(c.id)}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="ml-btn ml-btn-sm"
                                onClick={() => setVerTodos(CHIPS_ESTADO.find((c) => c.id === filtroEstado)!.label)}
                                disabled={conteoEstado(filtroEstado) === 0}
                                title="Ver esta categoría como estantería de pósters"
                                aria-label="Ver todos"
                            >
                                <LayoutGrid size={14} /> <span className="ml-solo-escritorio">Ver todos</span>
                            </button>
                        </div>

                        {activos.length > 0 && (
                            <div className="ml-activos">
                                {activos.map(([clave, nombre]) => (
                                    <button
                                        key={clave}
                                        type="button"
                                        className="ml-pastilla"
                                        onClick={() => setFiltros({ ...filtros, [clave]: '' })}
                                        aria-label={`Quitar filtro ${nombre}`}
                                    >
                                        {clave === 'tag' ? `#${filtros.tag}` : `${nombre}: ${filtros[clave]}`} <X size={13} />
                                    </button>
                                ))}
                                <button type="button" className="ml-link ms-1" onClick={() => setFiltros(FILTROS_VACIOS)}>
                                    Quitar todos
                                </button>
                            </div>
                        )}

                        {errorCarga && (
                            <div className="alert alert-danger py-2 px-3 mb-3 text-start d-flex align-items-center gap-2" role="alert" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
                                <span>⚠️ {errorCarga}</span>
                            </div>
                        )}

                        {cargando ? (
                            <div className="ml-vacio py-5 text-center">
                                <Loader2 size={32} className="text-secondary mx-auto mb-3" style={{ animation: 'spin 1s linear infinite' }} />
                                <p className="text-secondary mb-0">Cargando tu colección de animes desde la base de datos...</p>
                            </div>
                        ) : visibles.length > 0 ? (
                            <div className="ml-lista">
                                {visibles.map((fila, i) => (
                                    <AnimeFila
                                        key={fila.id || fila.malId}
                                        fila={fila}
                                        posicion={i + 1}
                                        carpetas={carpetas}
                                        onActualizar={(cambios) => actualizar(fila.malId, cambios)}
                                        onQuitar={() => quitar(fila.malId)}
                                        onVerDetalle={() => setDetalleId(fila.malId)}
                                        onRecomendar={() => recomendarUno(fila)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="ml-vacio">
                                <div className="ml-kaomoji">(・・;)ゞ</div>
                                {filas.length === 0 ? (
                                    <>
                                        <p>Tu lista está vacía. ¡Hora de empezar una nueva aventura!</p>
                                        <button type="button" className="ml-btn ml-btn-acento" onClick={() => setAgregarAbierto(true)}>
                                            <Plus size={16} /> Agregar mi primer anime
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p>Ningún anime coincide con esto.</p>
                                        {hayFiltros && <button type="button" className="ml-btn" onClick={limpiarFiltros}>Limpiar búsqueda y filtros</button>}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Sugerencias para el input de tags de cada fila */}
                        <datalist id="ml-tags-existentes">
                            {tags.map((t) => <option key={t} value={t} />)}
                        </datalist>
                    </div>
                )}

                {/* ---------- Pestaña: Carpetas ---------- */}
                {pestana === 'carpetas' && (
                    <div className="ml-panel" role="tabpanel" key="carpetas">
                        <PestanaCarpetas
                            carpetas={carpetas}
                            filas={filas}
                            onCrear={handleCrearCarpeta}
                            onRenombrar={handleRenombrarCarpeta}
                            onEliminar={handleEliminarCarpeta}
                            onMover={(malId, carpetaId) => actualizar(malId, { carpetaId })}
                            onRecomendar={(c) =>
                                setPaquete({
                                    titulo: c.nombre,
                                    criterio: 'Carpeta completa',
                                    filas: filas.filter((f) => f.carpetaId === c.id),
                                })
                            }
                            onVerDetalle={setDetalleId}
                        />
                    </div>
                )}

                {/* ---------- Pestaña: Tags ---------- */}
                {pestana === 'tags' && (
                    <div className="ml-panel" role="tabpanel" key="tags">
                        <PestanaTags
                            tags={tags}
                            filas={filas}
                            onCrear={crearTag}
                            onEliminar={eliminarTag}
                            onFiltrar={(tag) => {
                                setFiltros({ ...FILTROS_VACIOS, tag })
                                setFiltroEstado('todos')
                                setBusqueda('')
                                setPestana('animes')
                            }}
                        />
                    </div>
                )}
            </div>

            {/* ---------- Diálogos ---------- */}
            <AnimeDetalleDialog
                fila={filaDetalle}
                onCerrar={() => setDetalleId(null)}
                onActualizar={(cambios) => detalleId !== null && actualizar(detalleId, cambios)}
                onRecomendar={() => {
                    if (!filaDetalle) return
                    setDetalleId(null)
                    recomendarUno(filaDetalle)
                }}
            />
            <VerTodosDialog
                categoria={verTodos}
                filas={filas.filter((f) =>
                    filtroEstado === 'todos' ? true : filtroEstado === 'favoritos' ? f.favorito : f.estado === filtroEstado,
                )}
                onCerrar={() => setVerTodos(null)}
                onVerDetalle={setDetalleId}
            />
            <RecomendarDialog paquete={paquete} carpetas={carpetas} onCerrar={() => setPaquete(null)} />
            <AgregarDialog
                abierto={agregarAbierto}
                idsEnLista={filas.map((f) => f.malId)}
                carpetas={carpetas}
                onCerrar={() => setAgregarAbierto(false)}
                onAgregar={handleAgregarAnime}
            />
            <ImportarMalXmlDialog
                abierto={importarAbierto}
                onCerrar={() => setImportarAbierto(false)}
                onExito={() => refetch()}
            />
        </section>

    )
}

function SelectFiltro({
    label,
    valor,
    opciones,
    todos,
    onCambiar,
}: {
    label: string
    valor: string
    opciones: string[]
    todos: string
    onCambiar: (valor: string) => void
}) {
    const id = `ml-filtro-${label.toLowerCase().replace(/\W+/g, '-')}`
    return (
        <div>
            <label className="ml-label" htmlFor={id}>{label}</label>
            <select id={id} className="ml-select" value={valor} onChange={(e) => onCambiar(e.target.value)}>
                <option value="">{todos}</option>
                {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    )
}
