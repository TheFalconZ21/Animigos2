import { useMemo, useState } from 'react'
import { MessagesSquare, Newspaper } from 'lucide-react'
import { useTablon } from '../../hooks/useTablon'
import { useHorario } from '../../hooks/useCalendario'
import { useAhora } from '../../hooks/useAhora'
import { useMyList } from '../../hooks/useMyList'
import { useAuth } from '../../context/AuthContext'
import { filtrarActividades, type Actividad, type FiltroTablon } from '../../services/feedApi'
import { TablonBanner, type PosterBanner } from './TablonBanner'
import { NoticiaFijada } from './NoticiaFijada'
import { Publicacion } from './Publicacion'
import { SalasLateral } from './SalasLateral'
import { PublicarDialog, type Borrador, type ModoPublicar } from './PublicarDialog'
import { PestanaNoticias } from './PestanaNoticias'
import { HoyEnEmision } from './HoyEnEmision'
import { BannerRotativo } from './BannerRotativo'
import { FondoAfiches } from './FondoAfiches'
import '../mi-lista/mi-lista.css'
import './tablon.css'

// ============================================================
// EL TABLÓN (回覧板) — Dashboard social de Animigos
// Reutiliza el sistema visual de Mi Lista (clases ml-) y agrega
// las piezas propias del tablón con el prefijo tb-.
// ============================================================

type Seccion = 'actividad' | 'noticias'

const FILTROS: { id: FiltroTablon; label: string }[] = [
    { id: 'todo', label: 'Todo' },
    { id: 'recomendaciones', label: 'Recomendaciones' },
    { id: 'invitaciones', label: 'Invitaciones' },
    { id: 'publicaciones', label: 'Encuestas y logros' },
]

const abrirLogin = () => (document.getElementById('loginDialog') as HTMLDialogElement | null)?.showModal()

export function Tablon() {
    const tablon = useTablon()
    const horario = useHorario()
    const ahora = useAhora()
    const { filas, agregarAnime } = useMyList()
    const { isAuthenticated } = useAuth()
    const [seccion, setSeccion] = useState<Seccion>('actividad')
    const [filtro, setFiltro] = useState<FiltroTablon>('todo')
    const [borrador, setBorrador] = useState<Borrador | null>(null)

    // Sin sesión no hay lista propia: no marcamos nada como "En tu lista"
    const idsEnLista = useMemo(() => new Set(isAuthenticated ? filas.map((f) => f.malId) : []), [filas, isAuthenticated])
    const visibles = filtrarActividades(tablon.actividades, filtro)
    const salasEsperando = tablon.salas.filter((s) => s.status === 'voting' || s.status === 'candidates').length

    // Portadas del corcho: animes recomendados reales en el tablón (sin datos falsos)
    const posters = useMemo<PosterBanner[]>(() => {
        const recomendados = tablon.actividades
            .filter((a) => a.recomendacion)
            .map((a) => ({
                clave: `r${a.recomendacion!.anime.malId}-${a.id}`,
                titulo: a.recomendacion!.anime.titulo,
                imagenUrl: a.recomendacion!.anime.imagenUrl,
            }))
        const unicos = new Map(recomendados.map((p) => [p.titulo, p]))
        return [...unicos.values()].slice(0, 5)
    }, [tablon.actividades])

    // Publicar requiere sesión; si no hay, se abre el login
    const publicar = (b: Borrador) => (isAuthenticated ? setBorrador(b) : abrirLogin())

    const guardar = (a: Actividad) => {
        if (!isAuthenticated) return abrirLogin()
        const { malId } = a.recomendacion!.anime
        agregarAnime({ malId, estado: 'pendiente', nota: null, episodiosVistos: 0, favorito: false, tags: [] })
    }

    // Responder a un "busco anime": recomendación directa al autor, con la nota ya iniciada
    const sugerir = (a: Actividad) =>
        publicar({ modo: 'recomendar', destinatarioId: a.autor.usuario, nota: `Por lo que pediste (“${a.busqueda!.pedido.slice(0, 60)}…”), te sugiero este:` })

    const entrarSala = (codigo?: string) => {
        window.location.hash = codigo ? `#sala/${codigo}` : '#listas'
    }

    return (
        <section className="ml-root tb-root">
            <FondoAfiches />

            <div className="container pb-5">
                {/* Recuadro principal: alterna cada 15 s entre el tablón y las noticias del día */}
                <BannerRotativo
                    noticias={tablon.noticias}
                    ahora={ahora}
                    onVerTodas={() => setSeccion('noticias')}
                    bannerTablon={
                        <TablonBanner
                            posters={posters}
                            publicacionesHoy={tablon.actividades.length}
                            salasEsperando={salasEsperando}
                            onPublicar={(modo: ModoPublicar) => publicar({ modo })}
                        />
                    }
                />

                <div className="tb-grid">
                    <div className="tb-principal">
                        <div className="ml-tabs tb-filtros" role="tablist" aria-label="Secciones del tablón">
                            {(
                                [
                                    ['actividad', 'Actividad', tablon.actividades.length, MessagesSquare],
                                    ['noticias', 'Noticias', tablon.noticias.length, Newspaper],
                                ] as const
                            ).map(([id, label, num, Icono]) => (
                                <button key={id} type="button" role="tab" className="ml-tab" aria-selected={seccion === id} onClick={() => setSeccion(id)}>
                                    <Icono size={15} /> {label}
                                    {num > 0 && <span className="ml-tab-num">{num}</span>}
                                </button>
                            ))}
                        </div>

                        {seccion === 'noticias' && (
                            <PestanaNoticias
                                noticias={tablon.noticias}
                                cargando={tablon.cargandoNoticias}
                                error={tablon.errorNoticias}
                                actualizando={tablon.actualizandoNoticias}
                                onActualizar={tablon.refrescarNoticias}
                            />
                        )}

                        {seccion === 'actividad' && (
                            <div className="ml-panel">
                                <div className="ml-chips mb-3" role="group" aria-label="Filtrar la actividad">
                                    {FILTROS.map(({ id, label }) => (
                                        <button key={id} type="button" className="ml-chip" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                                            {label} <span className="ml-chip-num">{filtrarActividades(tablon.actividades, id).length}</span>
                                        </button>
                                    ))}
                                </div>

                                {filtro === 'todo' && tablon.noticias.length > 0 && (
                                    <NoticiaFijada
                                        noticias={tablon.noticias}
                                        actualizando={tablon.actualizandoNoticias}
                                        onActualizar={tablon.refrescarNoticias}
                                        onVerTodas={() => setSeccion('noticias')}
                                    />
                                )}

                                {tablon.cargandoFeed && <div className="tb-esqueleto tb-esqueleto-post" aria-label="Cargando publicaciones" />}
                                {tablon.errorFeed && <p className="ml-vacio">No pudimos cargar el tablón: {tablon.errorFeed}</p>}

                                <div className="tb-feed">
                                    {visibles.map((a) => (
                                        <Publicacion
                                            key={a.id}
                                            actividad={a}
                                            enMiLista={(malId) => idsEnLista.has(malId)}
                                            onGuardar={guardar}
                                            onAgradecer={tablon.agradecer}
                                            onVotar={tablon.votarEncuesta}
                                            onSugerir={sugerir}
                                            onEntrarSala={entrarSala}
                                        />
                                    ))}
                                </div>

                                {!tablon.cargandoFeed && visibles.length === 0 && (
                                    <div className="ml-vacio">
                                        <div className="ml-kaomoji">(・・;)</div>
                                        Nada por aquí todavía. ¡Sé el primero en publicar!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="tb-columna">
                        <SalasLateral salas={tablon.salas} cargando={tablon.cargandoSalas} error={tablon.errorSalas} onEntrar={entrarSala} />
                        <HoyEnEmision
                            emisiones={horario.emisiones}
                            cargando={horario.cargando}
                            onVerSemana={() => { window.location.hash = '#calendario' }}
                        />
                    </div>
                </div>
            </div>

            <PublicarDialog
                borrador={borrador}
                onCerrar={() => setBorrador(null)}
                onRecomendar={tablon.publicarRecomendacion}
                onBuscar={tablon.publicarBusqueda}
                onEncuesta={tablon.publicarEncuesta}
            />
        </section>
    )
}
