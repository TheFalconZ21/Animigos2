import { useMemo, useState } from 'react'
import { CalendarDays, Clapperboard } from 'lucide-react'
import { useHorario, useLanzamientos } from '../../hooks/useCalendario'
import { useMyList } from '../../hooks/useMyList'
import { useAuth } from '../../context/AuthContext'
import { useAhora } from '../../hooks/useAhora'
import { dentroDe, horaLocal } from '../../shared/tiempo'
import { alFallarPoster, type FilaLista } from '../mi-lista/mi-lista-data'
import { fetchAnimeById, fetchCatalogAnimes, type ApiAnimeData } from '../../services/catalogApi'
import { type Lanzamiento, type Emision } from '../../services/scheduleApi'
import { AnimeDetalleDialog } from '../mi-lista/AnimeDetalleDialog'
import { EstaSemana } from './EstaSemana'
import { ProximosLanzamientos } from './ProximosLanzamientos'
import '../mi-lista/mi-lista.css'
import '../tablon/tablon.css'
import './calendario.css'

// ============================================================
// CALENDARIO DE ANIME (番組表)
// Episodios de la semana y próximos lanzamientos, con datos reales
// de AniList a través del backend. Reutiliza el sistema visual de Mi Lista.
// ============================================================

type Pestana = 'semana' | 'lanzamientos'

export function Calendario({
    onOpenAnimeDetail,
}: {
    onOpenAnimeDetail?: (malId: number) => void
} = {}) {
    const horario = useHorario()
    const proximos = useLanzamientos()
    const { filas, agregarAnime, actualizar, quitar } = useMyList()
    const { isAuthenticated } = useAuth()
    const ahora = useAhora() / 1000
    const [pestana, setPestana] = useState<Pestana>('semana')
    const [animeSeleccionado, setAnimeSeleccionado] = useState<FilaLista | null>(null)

    const idsEnLista = useMemo(() => new Set(isAuthenticated ? filas.map((f) => f.malId) : []), [filas, isAuthenticated])
    const enMiLista = (malId: number | null) => malId !== null && idsEnLista.has(malId)
    const siguiente = horario.emisiones.filter((e) => e.emiteEn > ahora).sort((a, b) => a.emiteEn - b.emiteEn)[0]

    const handleSeleccionarEmision = async (e: Emision) => {
        const mid = e.malId ?? e.id
        const existing = filas.find((f) => f.malId === mid)
        if (existing) {
            setAnimeSeleccionado(existing)
            return
        }

        const tempFila: FilaLista = {
            id: `temp-${mid}`,
            malId: mid,
            estado: 'esperando',
            nota: null,
            episodiosVistos: 0,
            favorito: false,
            tags: [],
            anime: {
                malId: mid,
                title: e.titulo,
                titleEnglish: e.tituloRomaji || e.titulo,
                imageUrl: e.imagenUrl,
                score: 8.0,
                rank: 1,
                durationMinutes: 24,
                episodes: e.totalEpisodios || 12,
                status: 'RELEASING',
                studio: 'En emisión',
                genres: [],
                tagsData: [],
                synopsis: '',
                type: 'TV',
                season: 'En emisión',
                year: new Date().getFullYear(),
            },
        }
        setAnimeSeleccionado(tempFila)

        let fullData: ApiAnimeData | null = null
        if (e.malId) {
            try {
                fullData = await fetchAnimeById(e.malId)
            } catch {
                // Silencioso, intentamos búsqueda por título
            }
        }
        if (!fullData && e.titulo) {
            try {
                const searchRes = await fetchCatalogAnimes({ q: e.titulo, page_size: 1 })
                if (searchRes?.results?.length > 0) {
                    fullData = searchRes.results[0]
                }
            } catch {
                // Silencioso
            }
        }

        if (fullData) {
            setAnimeSeleccionado((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    malId: fullData!.mal_id,
                    anime: {
                        ...prev.anime,
                        malId: fullData!.mal_id,
                        title: fullData!.title || prev.anime.title,
                        titleEnglish: fullData!.title_english || prev.anime.titleEnglish,
                        titleJapanese: fullData!.title_japanese,
                        imageUrl: fullData!.image_url || prev.anime.imageUrl,
                        synopsis: (fullData as { synopsis_es?: string }).synopsis_es || fullData!.synopsis || prev.anime.synopsis,
                        studio: fullData!.studio || prev.anime.studio,
                        genres: fullData!.genres && fullData!.genres.length ? fullData!.genres : prev.anime.genres,
                        score: typeof fullData!.score === 'number' ? fullData!.score : prev.anime.score,
                        episodes: fullData!.episodes || prev.anime.episodes,
                        season: fullData!.season_display || fullData!.season || prev.anime.season,
                        year: fullData!.season_year || fullData!.year || prev.anime.year,
                        type: fullData!.type || prev.anime.type,
                        status: fullData!.status || prev.anime.status,
                    },
                }
            })
        }
    }

    const handleSeleccionarLanzamiento = async (l: Lanzamiento) => {
        const mid = l.malId ?? l.id
        const existing = filas.find((f) => f.malId === mid)
        if (existing) {
            setAnimeSeleccionado(existing)
            return
        }

        const tempFila: FilaLista = {
            id: `temp-${mid}`,
            malId: mid,
            estado: 'esperando',
            nota: null,
            episodiosVistos: 0,
            favorito: false,
            tags: [],
            anime: {
                malId: mid,
                title: l.titulo,
                titleEnglish: l.titulo,
                imageUrl: l.imagenUrl,
                score: 8.0,
                rank: 1,
                durationMinutes: 24,
                episodes: l.episodios || (l.formato === 'MOVIE' ? 1 : 12),
                status: 'NOT_YET_RELEASED',
                studio: l.estudio || 'Desconocido',
                genres: l.genres || [],
                tagsData: [],
                synopsis: l.synopsis || '',
                type: l.formato,
                season: l.season || 'Estreno',
                year: l.year || l.fecha.getFullYear(),
            },
        }
        setAnimeSeleccionado(tempFila)

        let fullData: ApiAnimeData | null = null
        if (l.malId) {
            try {
                fullData = await fetchAnimeById(l.malId)
            } catch {
                // Fallback a búsqueda
            }
        }
        if (!fullData && l.titulo) {
            try {
                const searchRes = await fetchCatalogAnimes({ q: l.titulo, page_size: 1 })
                if (searchRes?.results?.length > 0) {
                    fullData = searchRes.results[0]
                }
            } catch {
                // Silencioso
            }
        }

        if (fullData) {
            setAnimeSeleccionado((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    malId: fullData!.mal_id,
                    anime: {
                        ...prev.anime,
                        malId: fullData!.mal_id,
                        title: fullData!.title || prev.anime.title,
                        titleEnglish: fullData!.title_english || prev.anime.titleEnglish,
                        titleJapanese: fullData!.title_japanese,
                        imageUrl: fullData!.image_url || prev.anime.imageUrl,
                        synopsis: (fullData as { synopsis_es?: string }).synopsis_es || fullData!.synopsis || prev.anime.synopsis,
                        studio: fullData!.studio || prev.anime.studio,
                        genres: fullData!.genres && fullData!.genres.length ? fullData!.genres : prev.anime.genres,
                        score: typeof fullData!.score === 'number' ? fullData!.score : prev.anime.score,
                        episodes: fullData!.episodes || prev.anime.episodes,
                        season: fullData!.season_display || fullData!.season || prev.anime.season,
                        year: fullData!.season_year || fullData!.year || prev.anime.year,
                        type: fullData!.type || prev.anime.type,
                        status: fullData!.status || prev.anime.status,
                    },
                }
            })
        }
    }

    const handleMarcarEsperando = async (l: Lanzamiento) => {
        const mid = l.malId ?? l.id
        const existing = filas.find((f) => f.malId === mid)
        if (existing) {
            if (existing.estado === 'esperando') {
                setAnimeSeleccionado(existing)
            } else {
                await actualizar(mid, { estado: 'esperando' })
            }
        } else {
            await agregarAnime({
                malId: mid,
                estado: 'esperando',
                nota: null,
                episodiosVistos: 0,
                favorito: false,
                tags: [],
            })
        }
    }

    return (
        <section className="ml-root cal-root">
            <div className="container pb-5">
                <header className="ml-header cal-header">
                    <div className="ml-header-info">
                        <span className="ml-eyebrow">Calendario</span>
                        <h1 className="ml-titulo">Calendario de anime</h1>
                        <p className="ml-sub">
                            <strong>{horario.emisiones.length}</strong> episodios esta semana · <strong>{proximos.lanzamientos.length}</strong> lanzamientos próximos
                            <br />Todos los horarios están en tu hora local.
                        </p>
                    </div>

                    {/* Ficha: el próximo episodio en salir */}
                    <aside className="ml-ficha-lista" aria-label="Próximo episodio">
                        <div className="ml-ficha-lista-cuerpo">
                            <span className="ml-label mb-2">Lo próximo en salir</span>
                            {siguiente ? (
                                <div
                                    className="cal-siguiente cal-siguiente-interactive"
                                    onClick={() => handleSeleccionarEmision(siguiente)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            handleSeleccionarEmision(siguiente)
                                        }
                                    }}
                                    title="Haz clic para ver detalles y evaluar agregar a Mi Lista"
                                >
                                    <img src={siguiente.imagenUrl} alt="" onError={alFallarPoster} />
                                    <div style={{ minWidth: 0 }}>
                                        <div className="ml-ficha-porcentaje cal-cuenta">{dentroDe(siguiente.emiteEn, ahora * 1000)}</div>
                                        <div className="cal-siguiente-titulo">{siguiente.titulo}</div>
                                        <div className="small">Episodio {siguiente.episodio} · {horaLocal(siguiente.emiteEn)}</div>
                                    </div>
                                </div>
                            ) : (
                                <p className="small mb-0">{horario.cargando ? 'Cargando…' : 'No hay episodios próximos registrados.'}</p>
                            )}
                        </div>
                        <span className="ml-lomo" lang="ja" aria-hidden="true">番組表</span>
                    </aside>

                    <div className="ml-header-tabs">
                        <div className="ml-tabs" role="tablist" aria-label="Secciones del calendario">
                            <button type="button" role="tab" className="ml-tab" aria-selected={pestana === 'semana'} onClick={() => setPestana('semana')}>
                                <CalendarDays size={15} /> Esta semana <span className="ml-tab-num">{horario.emisiones.length}</span>
                            </button>
                            <button type="button" role="tab" className="ml-tab" aria-selected={pestana === 'lanzamientos'} onClick={() => setPestana('lanzamientos')}>
                                <Clapperboard size={15} /> Próximos lanzamientos <span className="ml-tab-num">{proximos.lanzamientos.length}</span>
                            </button>
                        </div>
                    </div>
                </header>

                {pestana === 'semana' && (
                    <EstaSemana
                        emisiones={horario.emisiones}
                        cargando={horario.cargando}
                        error={horario.error}
                        enMiLista={enMiLista}
                        onSeleccionarAnime={handleSeleccionarEmision}
                    />
                )}
                {pestana === 'lanzamientos' && (
                    <ProximosLanzamientos
                        lanzamientos={proximos.lanzamientos}
                        cargando={proximos.cargando}
                        error={proximos.error}
                        enMiLista={enMiLista}
                        filas={filas}
                        onSeleccionarAnime={handleSeleccionarLanzamiento}
                        onMarcarEsperando={handleMarcarEsperando}
                    />
                )}
            </div>

            {animeSeleccionado && (
                <AnimeDetalleDialog
                    fila={animeSeleccionado}
                    onCerrar={() => setAnimeSeleccionado(null)}
                    onActualizar={async (cambios) => {
                        const mid = animeSeleccionado.malId
                        const existing = filas.find((f) => f.malId === mid)
                        if (existing) {
                            await actualizar(mid, cambios)
                            setAnimeSeleccionado((prev) => (prev ? { ...prev, ...cambios } : null))
                        } else {
                            const nuevoEstado = cambios.estado || 'esperando'
                            await agregarAnime({
                                malId: mid,
                                estado: nuevoEstado,
                                nota: cambios.nota ?? null,
                                episodiosVistos: cambios.episodiosVistos ?? 0,
                                favorito: cambios.favorito ?? false,
                                tags: cambios.tags ?? [],
                                comentario: cambios.comentario ?? '',
                            })
                            setAnimeSeleccionado((prev) => (prev ? { ...prev, ...cambios, estado: nuevoEstado } : null))
                        }
                    }}
                    onRecomendar={() => {}}
                    onEliminar={filas.some((f) => f.malId === animeSeleccionado.malId) ? () => {
                        quitar(animeSeleccionado.malId)
                        setAnimeSeleccionado(null)
                    } : undefined}
                    onVerFichaCompleta={(malId) => {
                        setAnimeSeleccionado(null)
                        onOpenAnimeDetail?.(malId)
                    }}
                />
            )}
        </section>
    )
}
