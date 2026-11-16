import { useState, useEffect, useMemo } from 'react'
import {
    Sparkles,
    Star,
    RefreshCw,
    ChevronRight,
    Bookmark,
    Layers,
    ThumbsUp,
    SlidersHorizontal,
    Tv,
    Eye,
    ArrowUpRight
} from 'lucide-react'
import { getAlgorithm } from '../services/adminApi'
import type { AlgorithmResponse, TopRatedAnimeRecItem } from '../services/adminApi'
import type { AdminTab } from '../components/AdminSidebar'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type ScopeFilter = 'all' | 'personal' | 'groups'
type RecommenderSubView = 'satisfaction' | 'conversion' | 'preferences' | 'volume'

interface RecommenderPageProps {
    onNavigateTab?: (tab: AdminTab, metricLabel?: string) => void
}

export function RecommenderPage({ onNavigateTab }: RecommenderPageProps = {}) {
    const [scope, setScope] = useState<ScopeFilter>('all')
    const [algoData, setAlgoData] = useState<AlgorithmResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [activeSubView, setActiveSubView] = useAdminSubView<RecommenderSubView>()
    const [activeDonutSegment, setActiveDonutSegment] = useState<string | null>(null)

    const topRatedAnimes: TopRatedAnimeRecItem[] = useMemo(() => {
        return algoData?.recommendation_satisfaction?.top_rated_animes || []
    }, [algoData])

    const stats = useMemo(() => {
        const sat = algoData?.recommendation_satisfaction
        const allRatings = sat?.individual_ratings || []
        const filtered = scope === 'personal'
            ? allRatings.filter(r => r.modality === 'personal')
            : scope === 'groups'
                ? allRatings.filter(r => r.modality === 'group')
                : allRatings

        const totalRecs = filtered.length
        const avgRating = totalRecs > 0
            ? Number((filtered.reduce((acc, r) => acc + r.rating, 0) / totalRecs).toFixed(2))
            : 0
        const excCount = filtered.filter(r => r.rating === 5).length
        const goodCount = filtered.filter(r => r.rating === 4).length

        const excellent = totalRecs > 0 ? Math.round((excCount / totalRecs) * 100) : 0
        const good = totalRecs > 0 ? Math.round((goodCount / totalRecs) * 100) : 0
        const poor = totalRecs > 0 ? Math.max(0, 100 - excellent - good) : 0

        const personalCount = sat?.personal_evaluations ?? allRatings.filter(r => r.modality === 'personal').length
        const groupCount = sat?.group_evaluations ?? allRatings.filter(r => r.modality === 'group').length
        const totalAll = personalCount + groupCount

        const similarityChoicePct = totalAll > 0 ? Math.round((groupCount / totalAll) * 100) : 0
        const profileChoicePct = totalAll > 0 ? Math.max(0, 100 - similarityChoicePct) : 0

        const label = scope === 'personal'
            ? 'Recomendador Personal (1:1)'
            : scope === 'groups'
                ? 'Salas Grupales (Watch Parties)'
                : 'Consolidado Global (Personal + Grupal)'

        return {
            totalRecs,
            personalCount,
            groupCount,
            totalListEntries: sat?.total_list_entries ?? 0,
            avgRating,
            satisfactionPct: excellent + good,
            conversionRate: sat?.acceptance_rate ?? 0,
            similarityChoicePct,
            profileChoicePct,
            breakdown: { excellent, good, poor },
            label
        }
    }, [algoData, scope])

    const donutData = useMemo(() => {
        const size = 185
        const strokeWidth = 24
        const radius = (size - strokeWidth) / 2
        const center = size / 2
        const circumference = 2 * Math.PI * radius

        const segments = [
            {
                id: 'excellent',
                label: '¡Nos encantó! (5★)',
                pct: stats.breakdown.excellent,
                count: Math.round((stats.totalRecs * stats.breakdown.excellent) / 100),
                color: '#10B981',
                sublabel: 'Match de alta precisión con el usuario'
            },
            {
                id: 'good',
                label: 'Aceptable (4★)',
                pct: stats.breakdown.good,
                count: Math.round((stats.totalRecs * stats.breakdown.good) / 100),
                color: '#38BDF8',
                sublabel: 'Entretenido y acorde al género buscado'
            },
            {
                id: 'poor',
                label: 'Disconforme (≤3★)',
                pct: stats.breakdown.poor,
                count: Math.round((stats.totalRecs * stats.breakdown.poor) / 100),
                color: '#EF4444',
                sublabel: 'Descartado o con solicitud de re-roll'
            }
        ]

        let accumulatedPct = 0
        const arcs = segments.map(seg => {
            const strokeDasharray = `${(seg.pct / 100) * circumference} ${circumference}`
            const strokeDashoffset = -((accumulatedPct / 100) * circumference)
            accumulatedPct += seg.pct
            return { ...seg, strokeDasharray, strokeDashoffset }
        })

        return { size, strokeWidth, radius, center, circumference, arcs }
    }, [stats])

    const fetchSatisfaction = () => {
        setIsLoading(true)
        getAlgorithm()
            .then(data => setAlgoData(data))
            .catch(err => console.error('Error fetching recommendation satisfaction:', err))
            .finally(() => setIsLoading(false))
    }

    useEffect(() => {
        fetchSatisfaction()
    }, [])

    const subViewOptions: SubViewOption<RecommenderSubView>[] = [
        { id: 'satisfaction', label: 'Top Valoraciones & Intención', badge: `${stats.avgRating}★` },
        { id: 'conversion', label: 'Conversión a Lista / Sesión', badge: `${stats.conversionRate}%` },
        { id: 'preferences', label: 'Similitud vs Gustos', badge: `${stats.similarityChoicePct}%` },
        { id: 'volume', label: 'Segmentación de Volumen', badge: stats.totalRecs.toLocaleString() }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTA ESPECÍFICA INTEGRADA A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Recomendador IA"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                    rightActions={
                        <button
                            type="button"
                            onClick={() => onNavigateTab?.('ratings', 'Auditoría de Notas Individuales')}
                            className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1.5 text-white"
                        >
                            <Star size={13} style={{ color: 'var(--admin-emerald)' }} />
                            <span>Ir a Calificaciones</span>
                            <ArrowUpRight size={13} />
                        </button>
                    }
                />

                {/* SUB-VISTA 1: SATISFACCIÓN + TOP ANIMES + SIMILITUD VS PERFIL */}
                {activeSubView === 'satisfaction' && (
                    <div className="d-flex flex-column gap-3">
                        <div className="row g-3">
                            <div className="col-12 col-lg-7">
                                <div className="admin-card h-100 d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div>
                                                <h3 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                                    ¿Cómo eligen los usuarios sus animes en el Recomendador IA?
                                                </h3>
                                                <p className="admin-subtitle m-0 mt-1">
                                                    Cruce de intención: Salas grupales vs. Afinidad al perfil personal
                                                </p>
                                            </div>
                                            <span className="admin-badge admin-badge-info">Análisis de Intención</span>
                                        </div>

                                        <div className="my-3">
                                            <div className="d-flex rounded overflow-hidden mb-2.5" style={{ height: 14, backgroundColor: 'var(--admin-surface-2)' }}>
                                                <div style={{ width: `${stats.similarityChoicePct}%`, backgroundColor: 'var(--admin-focus)' }} />
                                                <div style={{ width: `${stats.profileChoicePct}%`, backgroundColor: 'var(--admin-emerald)' }} />
                                            </div>

                                            <div className="d-flex flex-wrap justify-content-between gap-2" style={{ fontSize: '0.8125rem' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--admin-focus)', display: 'inline-block' }} />
                                                    <strong className="font-mono text-white">{stats.similarityChoicePct}%</strong>
                                                    <span style={{ color: 'var(--admin-text-secondary)' }}>Votación en Salas Grupales ({stats.groupCount} registros)</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)', display: 'inline-block' }} />
                                                    <strong className="font-mono text-white">{stats.profileChoicePct}%</strong>
                                                    <span style={{ color: 'var(--admin-text-secondary)' }}>Listas Personales ({stats.personalCount} registros)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                                        <strong className="text-white">Estado en Base de Datos:</strong> {stats.totalRecs} evaluaciones auditadas ({stats.satisfactionPct}% satisfacción global).
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 col-lg-5">
                                <div className="admin-card h-100">
                                    <h3 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                        Obras con Mayor Actividad en Base de Datos
                                    </h3>
                                    <p className="admin-subtitle m-0 mt-1 mb-3">
                                        Títulos reales registrados en listas o salas
                                    </p>

                                    {topRatedAnimes.length === 0 ? (
                                        <div className="p-4 text-center rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text-secondary)', fontSize: '0.82rem' }}>
                                            Sin animes evaluados aún en la base de datos.
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column gap-2">
                                            {topRatedAnimes.slice(0, 4).map((item, idx) => (
                                                <div key={idx} className="p-2.5 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                                    <div className="text-truncate pe-2">
                                                        <div className="text-white fw-semibold text-truncate" style={{ fontSize: '0.84rem' }}>{item.title}</div>
                                                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>{item.genre}</span>
                                                    </div>
                                                    <div className="text-end font-mono flex-shrink-0">
                                                        <span style={{ color: 'var(--admin-focus)', fontSize: '0.78rem' }}>{item.totalRecs} registros</span>
                                                        <div style={{ color: 'var(--admin-emerald)', fontWeight: 700, fontSize: '0.78rem' }}>★ {item.avgRating}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Ranking de Top Animes Mejor Valorados */}
                        <div className="admin-card">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div className="d-flex align-items-center gap-2">
                                    <ThumbsUp size={16} style={{ color: 'var(--admin-emerald)' }} />
                                    <h3 className="admin-title m-0" style={{ fontSize: '1.02rem' }}>
                                        Top Animes con Mayor Calificación en PostgreSQL
                                    </h3>
                                </div>
                                <span className="admin-subtitle">Auditado sobre {stats.totalRecs.toLocaleString()} registros</span>
                            </div>

                            {topRatedAnimes.length === 0 ? (
                                <div className="p-4 text-center rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>
                                    No hay animes calificados aún en listas o salas grupales.
                                </div>
                            ) : (
                                <div className="row g-3">
                                    {topRatedAnimes.map((anime, index) => (
                                        <div key={anime.id} className="col-12 col-md-6 col-xl-4">
                                            <div className="p-3 rounded-2 d-flex align-items-center gap-3 h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                                <div className="position-relative flex-shrink-0" style={{ width: 48, height: 66, borderRadius: 6, overflow: 'hidden', backgroundColor: 'var(--admin-surface-3)' }}>
                                                    {anime.poster && (
                                                        <img
                                                            src={anime.poster}
                                                            alt={anime.title}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    )}
                                                    <span className="position-absolute top-0 start-0 px-1.5 py-0.5 font-mono fw-bold" style={{ backgroundColor: 'rgba(9,11,16,0.85)', color: '#FFFFFF', fontSize: '0.7rem' }}>
                                                        #{index + 1}
                                                    </span>
                                                </div>

                                                <div className="overflow-hidden flex-grow-1">
                                                    <div className="fw-semibold text-white text-truncate" style={{ fontSize: '0.88rem' }}>{anime.title}</div>
                                                    <div className="text-truncate" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>{anime.genre}</div>
                                                    <div className="d-flex align-items-center gap-2 mt-1 font-mono" style={{ fontSize: '0.78rem' }}>
                                                        <span style={{ color: 'var(--admin-amber)', fontWeight: 700 }}>★ {anime.avgRating}</span>
                                                        <span style={{ color: 'var(--admin-text-muted)' }}>•</span>
                                                        <span style={{ color: 'var(--admin-emerald)' }}>{anime.satisfactionPct}%</span>
                                                        <span style={{ color: 'var(--admin-text-muted)' }}>•</span>
                                                        <span style={{ color: 'var(--admin-text-secondary)' }}>{anime.totalRecs} recs</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 2: CONVERSIÓN A LISTA Y SESIÓN */}
                {activeSubView === 'conversion' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <span className="admin-badge admin-badge-info mb-2">EMBUDO DE ADOPCIÓN POST-SUGERENCIA</span>
                                <h2 className="admin-title mb-1" style={{ fontSize: '1.2rem' }}>
                                    Destino de las Recomendaciones Emitidas ({stats.conversionRate}% Conversión)
                                </h2>
                                <p className="admin-subtitle mb-4">
                                    Registros reales en Mi Lista y en Salas Grupales de PostgreSQL
                                </p>

                                <div className="row g-3">
                                    <div className="col-12 col-md-4">
                                        <div className="p-3.5 rounded-2 text-center h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <Bookmark size={24} style={{ color: 'var(--admin-emerald)' }} />
                                            <div className="admin-kpi-value mt-2">{stats.totalListEntries}</div>
                                            <div className="text-white fw-medium mt-1" style={{ fontSize: '0.84rem' }}>Entradas en "Mi Lista"</div>
                                            <p className="admin-subtitle m-0 mt-1" style={{ fontSize: '0.76rem' }}>Guardados en cuentas de usuarios</p>
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-4">
                                        <div className="p-3.5 rounded-2 text-center h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <Tv size={24} style={{ color: 'var(--admin-focus)' }} />
                                            <div className="admin-kpi-value mt-2">{stats.groupCount}</div>
                                            <div className="text-white fw-medium mt-1" style={{ fontSize: '0.84rem' }}>Votos en Watch Party</div>
                                            <p className="admin-subtitle m-0 mt-1" style={{ fontSize: '0.76rem' }}>Emitidos en salas grupales</p>
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-4">
                                        <div className="p-3.5 rounded-2 text-center h-100" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <Eye size={24} style={{ color: 'var(--admin-text-secondary)' }} />
                                            <div className="admin-kpi-value mt-2">{stats.personalCount}</div>
                                            <div className="text-white fw-medium mt-1" style={{ fontSize: '0.84rem' }}>Calificaciones Personales</div>
                                            <p className="admin-subtitle m-0 mt-1" style={{ fontSize: '0.76rem' }}>Puntuaciones directas en lista</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-top" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                                <strong className="text-white">Conversión real:</strong> {stats.conversionRate}% sobre los registros activos en base de datos.
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.98rem' }}>Volumen por Modalidad</h3>
                                <div className="d-flex flex-column gap-2.5 mt-3">
                                    <div className="admin-decision-item">
                                        <div className="d-flex justify-content-between">
                                            <span className="text-white fw-semibold">Recomendador Personal (1:1)</span>
                                            <span className="font-mono fw-bold" style={{ color: 'var(--admin-emerald)' }}>{stats.personalCount} evals</span>
                                        </div>
                                        <span className="admin-subtitle" style={{ fontSize: '0.76rem' }}>Registros en Mi Lista personal</span>
                                    </div>
                                    <div className="admin-decision-item">
                                        <div className="d-flex justify-content-between">
                                            <span className="text-white fw-semibold">Salas Grupales</span>
                                            <span className="font-mono fw-bold" style={{ color: 'var(--admin-focus)' }}>{stats.groupCount} votos</span>
                                        </div>
                                        <span className="admin-subtitle" style={{ fontSize: '0.76rem' }}>Votos emitidos en salas compartidas</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 3: PREFERENCIAS SEMÁNTICAS */}
                {activeSubView === 'preferences' && (
                    <div className="row g-3">
                        <div className="col-12 col-md-6">
                            <div className="admin-card h-100">
                                <h3 className="admin-title mb-1" style={{ fontSize: '1.05rem' }}>Actividad en Recomendador Personal (1:1)</h3>
                                <p className="admin-subtitle mb-3">Registros reales de listas de usuarios</p>
                                <div className="d-flex flex-column gap-2.5">
                                    <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                        <span className="text-white" style={{ fontSize: '0.84rem' }}>Animes guardados en Mi Lista</span>
                                        <strong className="font-mono" style={{ color: 'var(--admin-focus)', fontSize: '0.95rem' }}>{stats.totalListEntries}</strong>
                                    </div>
                                    <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                        <span className="text-white" style={{ fontSize: '0.84rem' }}>Animes con nota asignada</span>
                                        <strong className="font-mono" style={{ color: 'var(--admin-emerald)', fontSize: '0.95rem' }}>{stats.personalCount}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-md-6">
                            <div className="admin-card h-100">
                                <h3 className="admin-title mb-1" style={{ fontSize: '1.05rem' }}>Actividad en Salas Grupales</h3>
                                <p className="admin-subtitle mb-3">Registros reales de votación grupal</p>
                                <div className="d-flex flex-column gap-2.5">
                                    <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                        <span className="text-white" style={{ fontSize: '0.84rem' }}>Votos grupales analizados</span>
                                        <strong className="font-mono" style={{ color: 'var(--admin-emerald)', fontSize: '0.95rem' }}>{stats.groupCount}</strong>
                                    </div>
                                    <div className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                        <span className="text-white" style={{ fontSize: '0.84rem' }}>Proporción sobre el total</span>
                                        <strong className="font-mono" style={{ color: 'var(--admin-focus)', fontSize: '0.95rem' }}>{stats.similarityChoicePct}%</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 4: VOLUMEN EVALUADO */}
                {activeSubView === 'volume' && (
                    <div className="admin-card">
                        <h3 className="admin-title mb-1" style={{ fontSize: '1.1rem' }}>Segmentación Operativa del Volumen Evaluado</h3>
                        <p className="admin-subtitle mb-4">Desglose de las {stats.totalRecs.toLocaleString()} evaluaciones registradas en PostgreSQL</p>
                        <div className="row g-3">
                            <div className="col-12 col-md-4">
                                <div className="p-3.5 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="admin-kpi-kicker">Evaluaciones Personales 1:1</span>
                                    <div className="admin-kpi-value my-1" style={{ color: 'var(--admin-focus)' }}>{stats.personalCount.toLocaleString()}</div>
                                    <span className="admin-subtitle">{stats.profileChoicePct}% del volumen total</span>
                                </div>
                            </div>
                            <div className="col-12 col-md-4">
                                <div className="p-3.5 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="admin-kpi-kicker">Votos en Salas Grupales</span>
                                    <div className="admin-kpi-value my-1" style={{ color: 'var(--admin-emerald)' }}>{stats.groupCount.toLocaleString()}</div>
                                    <span className="admin-subtitle">{stats.similarityChoicePct}% del volumen</span>
                                </div>
                            </div>
                            <div className="col-12 col-md-4">
                                <div className="p-3.5 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                    <span className="admin-kpi-kicker">Entradas Totales en Listas</span>
                                    <div className="admin-kpi-value my-1">{stats.totalListEntries.toLocaleString()}</div>
                                    <span className="admin-subtitle">guardados en Mi Lista</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    return (
        <div className="admin-viewport-shell">
            {/* Header con Selector de Ámbito Dual */}
            <div className="admin-section-header">
                <div>
                    <div className="d-flex align-items-center gap-2.5">
                        <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                            Recomendador IA & Eficacia de Sugerencias
                        </h1>
                        <span className="admin-badge admin-badge-success font-mono">A/B TESTING ACTIVO</span>
                    </div>
                    <p className="admin-subtitle m-0 mt-1">
                        Telemetría consolidada del motor de recomendación (Personal 1:1 + Salas Grupales)
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    <div className="admin-subview-switcher">
                        <button
                            type="button"
                            onClick={() => setScope('all')}
                            className={`admin-subview-pill ${scope === 'all' ? 'active' : ''}`}
                        >
                            Todo Consolidado
                        </button>
                        <button
                            type="button"
                            onClick={() => setScope('personal')}
                            className={`admin-subview-pill ${scope === 'personal' ? 'active' : ''}`}
                        >
                            Personal 1:1
                        </button>
                        <button
                            type="button"
                            onClick={() => setScope('groups')}
                            className={`admin-subview-pill ${scope === 'groups' ? 'active' : ''}`}
                        >
                            Salas Grupales
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchSatisfaction}
                        disabled={isLoading}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista integrada) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('satisfaction')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Evaluación Post-Elección</span>
                        <span className="admin-badge admin-badge-success">Excelente</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{stats.avgRating}</span>
                        <span className="font-mono" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>/ 5.0 ⭐</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Top animes & similitud</span>
                            <ChevronRight size={13} />
                        </span>
                        <Star size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('conversion')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Conversión a Lista / Sesión</span>
                        <span className="admin-badge admin-badge-info">Alta adopción</span>
                    </div>
                    <div className="admin-kpi-value my-1">{stats.conversionRate}%</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Desglose de conversión</span>
                            <ChevronRight size={13} />
                        </span>
                        <Bookmark size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('preferences')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Criterio: Similitud vs Gustos</span>
                        <span className="admin-badge admin-badge-neutral font-mono">{stats.profileChoicePct}% Perfil</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{stats.similarityChoicePct}%</span>
                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>por similitud</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ver patrones de búsqueda</span>
                            <ChevronRight size={13} />
                        </span>
                        <SlidersHorizontal size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('volume')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Volumen Evaluado</span>
                        <span className="admin-badge admin-badge-neutral">Activas</span>
                    </div>
                    <div className="admin-kpi-value my-1">{stats.totalRecs.toLocaleString()}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Segmentación 1:1 vs Grupal</span>
                            <ChevronRight size={13} />
                        </span>
                        <Layers size={15} style={{ color: 'var(--admin-text-secondary)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA EN LA MISMA LÍNEA: Dona de Veredictos (Izquierda) + Impacto A/B (Derecha) */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '1.25rem',
                    flex: 1,
                    alignItems: 'stretch'
                }}
            >
                {/* 1. Distribución de Veredictos (Donut + Leyenda a un costado) */}
                <div className="admin-chart-stage" style={{ minWidth: 0 }}>
                    <div>
                        <div className="d-flex justify-content-between align-items-baseline mb-2">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.02rem' }}>
                                    Distribución de Veredictos del Recomendador IA
                                </h2>
                                <span className="admin-subtitle">
                                    Percepción post-elección ({stats.label})
                                </span>
                            </div>
                            <span className="font-mono fw-bold" style={{ color: 'var(--admin-emerald)', fontSize: '0.95rem' }}>
                                {stats.avgRating} / 5.0 ⭐
                            </span>
                        </div>

                        <div className="d-flex flex-column flex-sm-row align-items-center gap-4 my-3">
                            <div className="d-flex justify-content-center flex-shrink-0" style={{ width: donutData.size, height: donutData.size }}>
                                <div className="position-relative" style={{ width: donutData.size, height: donutData.size }}>
                                    <svg
                                        width={donutData.size}
                                        height={donutData.size}
                                        viewBox={`0 0 ${donutData.size} ${donutData.size}`}
                                        style={{ transform: 'rotate(-90deg)' }}
                                    >
                                        <circle
                                            cx={donutData.center}
                                            cy={donutData.center}
                                            r={donutData.radius}
                                            fill="transparent"
                                            stroke="var(--admin-surface-3)"
                                            strokeWidth={donutData.strokeWidth}
                                        />
                                        {donutData.arcs.map((arc) => {
                                            const isSelected = activeDonutSegment === arc.id
                                            const isDimmed = activeDonutSegment !== null && !isSelected
                                            return (
                                                <circle
                                                    key={arc.id}
                                                    cx={donutData.center}
                                                    cy={donutData.center}
                                                    r={donutData.radius}
                                                    fill="transparent"
                                                    stroke={arc.color}
                                                    strokeWidth={isSelected ? donutData.strokeWidth + 5 : donutData.strokeWidth}
                                                    strokeDasharray={arc.strokeDasharray}
                                                    strokeDashoffset={arc.strokeDashoffset}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.22s var(--admin-ease)',
                                                        opacity: isDimmed ? 0.35 : 1
                                                    }}
                                                    onClick={() => setActiveDonutSegment(isSelected ? null : arc.id)}
                                                />
                                            )
                                        })}
                                    </svg>

                                    <div className="position-absolute top-50 start-50 translate-middle text-center pointer-events-none">
                                        <span className="admin-kpi-value d-block" style={{ fontSize: '1.55rem' }}>
                                            {activeDonutSegment
                                                ? `${donutData.arcs.find(a => a.id === activeDonutSegment)?.pct}%`
                                                : `${stats.avgRating}★`}
                                        </span>
                                        <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>
                                            SATISFACCIÓN
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow-1 w-100" style={{ minWidth: 0 }}>
                                <div className="d-flex flex-column gap-2.5">
                                    {donutData.arcs.map((seg) => {
                                        const isSelected = activeDonutSegment === seg.id
                                        return (
                                            <div
                                                key={seg.id}
                                                onClick={() => setActiveSubView('satisfaction')}
                                                onMouseEnter={() => setActiveDonutSegment(seg.id)}
                                                onMouseLeave={() => setActiveDonutSegment(null)}
                                                className="admin-decision-item clickable d-flex align-items-center justify-content-between gap-2"
                                                style={{
                                                    borderColor: isSelected ? seg.color : 'var(--admin-border-subtle)'
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2.5 overflow-hidden">
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
                                                    <div className="text-truncate">
                                                        <div className="text-white fw-semibold" style={{ fontSize: '0.82rem' }}>{seg.label}</div>
                                                        <div className="text-truncate" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.74rem' }}>{seg.sublabel}</div>
                                                    </div>
                                                </div>
                                                <div className="text-end font-mono flex-shrink-0">
                                                    <span className="text-white fw-bold" style={{ fontSize: '0.88rem' }}>{seg.pct}%</span>
                                                    <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>{seg.count} recs</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--admin-text-secondary)' }}>Tasa de conversión directa sin re-roll:</span>
                        <span className="font-mono text-white fw-bold">{stats.conversionRate}%</span>
                    </div>
                </div>

                {/* 2. Impacto del Recomendador IA vs Selección Manual (Diseño Ejecutivo Pizarra Carbono) */}
                <div className="admin-decision-panel" style={{ minWidth: 0 }}>
                    <div>
                        <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Impacto del Recomendador IA vs Selección Manual
                            </h2>
                            <span className="admin-badge admin-badge-success font-mono">A/B Testing Activo</span>
                        </div>

                        <div className="d-flex flex-column my-2" style={{ gap: '1.1rem' }}>
                            {[
                                {
                                    metric: 'Satisfacción post-visión',
                                    aiVal: `${algoData?.recommendation_satisfaction?.comparison?.algo_happiness ?? 0} / 10`,
                                    manualVal: `${algoData?.recommendation_satisfaction?.comparison?.manual_happiness ?? 0} / 10`,
                                    delta: `${stats.satisfactionPct}% positivo`,
                                    aiPct: Math.min(100, Math.round((algoData?.recommendation_satisfaction?.comparison?.algo_happiness ?? 0) * 10)),
                                    manualPct: Math.min(100, Math.round((algoData?.recommendation_satisfaction?.comparison?.manual_happiness ?? 0) * 10))
                                },
                                {
                                    metric: 'Acuerdo Grupal Logrado',
                                    aiVal: `${algoData?.stats?.high_consensus_rooms_pct ?? 0}%`,
                                    manualVal: `${stats.groupCount} votos`,
                                    delta: 'En salas reales',
                                    aiPct: Math.min(100, Math.round(algoData?.stats?.high_consensus_rooms_pct ?? 0)),
                                    manualPct: 0
                                },
                                {
                                    metric: 'Conversión a "Mi Lista"',
                                    aiVal: `${stats.conversionRate}%`,
                                    manualVal: `${stats.totalListEntries} guardados`,
                                    delta: `${stats.personalCount} calificados`,
                                    aiPct: Math.min(100, Math.round(stats.conversionRate)),
                                    manualPct: 0
                                }
                            ].map((row, idx) => (
                                <div key={idx} className="admin-decision-item">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="text-white fw-semibold" style={{ fontSize: '0.86rem' }}>{row.metric}</span>
                                        <span className="admin-badge admin-badge-success font-mono">{row.delta}</span>
                                    </div>

                                    <div className="d-flex align-items-center justify-content-between gap-3 font-mono" style={{ fontSize: '0.8rem' }}>
                                        <div className="d-flex align-items-center gap-2">
                                            <span style={{ color: 'var(--admin-text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '0.76rem' }}>Recomendador IA:</span>
                                            <strong style={{ color: 'var(--admin-emerald)', fontSize: '0.92rem' }}>{row.aiVal}</strong>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span style={{ color: 'var(--admin-text-muted)', fontFamily: 'var(--font-sans)', fontSize: '0.76rem' }}>Manual:</span>
                                            <span style={{ color: 'var(--admin-text-secondary)' }}>{row.manualVal}</span>
                                        </div>
                                    </div>

                                    <div className="d-flex gap-1.5 mt-2">
                                        <div className="flex-grow-1 rounded overflow-hidden" style={{ height: 6, backgroundColor: 'var(--admin-surface-1)' }}>
                                            <div style={{ width: `${row.aiPct}%`, height: '100%', backgroundColor: 'var(--admin-emerald)', borderRadius: 4 }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="d-flex align-items-center gap-2" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                            <Sparkles size={14} style={{ color: 'var(--admin-focus)', flexShrink: 0 }} />
                            <span>¿Deseas auditar cada nota individual por usuario?</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => onNavigateTab?.('ratings', 'Notas Individuales de Recomendaciones')}
                            className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-2 text-white"
                        >
                            <span>Ir a Calificaciones</span>
                            <ArrowUpRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
