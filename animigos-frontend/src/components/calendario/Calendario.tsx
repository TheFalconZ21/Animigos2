import { useMemo, useState } from 'react'
import { CalendarDays, Clapperboard } from 'lucide-react'
import { useHorario, useLanzamientos } from '../../hooks/useCalendario'
import { useMyList } from '../../hooks/useMyList'
import { useAuth } from '../../context/AuthContext'
import { useAhora } from '../../hooks/useAhora'
import { dentroDe, horaLocal } from '../../shared/tiempo'
import { alFallarPoster } from '../mi-lista/mi-lista-data'
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

export function Calendario() {
    const horario = useHorario()
    const proximos = useLanzamientos()
    const { filas } = useMyList()
    const { isAuthenticated } = useAuth()
    const ahora = useAhora() / 1000
    const [pestana, setPestana] = useState<Pestana>('semana')

    const idsEnLista = useMemo(() => new Set(isAuthenticated ? filas.map((f) => f.malId) : []), [filas, isAuthenticated])
    const enMiLista = (malId: number | null) => malId !== null && idsEnLista.has(malId)
    const siguiente = horario.emisiones.filter((e) => e.emiteEn > ahora).sort((a, b) => a.emiteEn - b.emiteEn)[0]

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
                                <div className="cal-siguiente">
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
                    <EstaSemana emisiones={horario.emisiones} cargando={horario.cargando} error={horario.error} enMiLista={enMiLista} />
                )}
                {pestana === 'lanzamientos' && (
                    <ProximosLanzamientos lanzamientos={proximos.lanzamientos} cargando={proximos.cargando} error={proximos.error} enMiLista={enMiLista} />
                )}
            </div>
        </section>
    )
}
