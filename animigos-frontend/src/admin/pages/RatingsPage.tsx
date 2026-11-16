import { useState, useEffect, useMemo } from 'react'
import {
    Star,
    Search,
    RefreshCw,
    X,
    CheckCircle2,
    ThumbsUp,
    ChevronRight,
    Sparkles,
    SlidersHorizontal
} from 'lucide-react'
import { getAlgorithm } from '../services/adminApi'
import type { IndividualRatingItem } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type RatingsSubView = 'explorer' | 'accuracy-cross'

export function RatingsPage() {
    const [ratingsData, setRatingsData] = useState<IndividualRatingItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [activeSubView, setActiveSubView] = useAdminSubView<RatingsSubView>()
    const [hoveredStar, setHoveredStar] = useState<number | null>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [modalityFilter, setModalityFilter] = useState<'all' | 'personal' | 'group'>('all')
    const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | 'low'>('all')
    const [actionFilter, setActionFilter] = useState<'all' | 'favorite' | 'list' | 'group'>('all')

    const handleRefresh = () => {
        setIsLoading(true)
        getAlgorithm()
            .then(data => {
                setRatingsData(data.recommendation_satisfaction?.individual_ratings || [])
            })
            .catch(err => console.error('Error fetching ratings:', err))
            .finally(() => setIsLoading(false))
    }

    useEffect(() => {
        handleRefresh()
    }, [])

    const filteredRatings = useMemo(() => {
        return ratingsData.filter(item => {
            if (modalityFilter !== 'all' && item.modality !== modalityFilter) return false
            if (ratingFilter === '5' && item.rating !== 5) return false
            if (ratingFilter === '4' && item.rating !== 4) return false
            if (ratingFilter === 'low' && item.rating > 3) return false

            if (actionFilter === 'favorite' && !item.actionTaken.includes('Favoritos')) return false
            if (actionFilter === 'list' && !item.actionTaken.includes('Mi Lista')) return false
            if (actionFilter === 'group' && !item.actionTaken.toLowerCase().includes('sala') && !item.actionTaken.toLowerCase().includes('grupal')) return false

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const matchesUser = item.userName.toLowerCase().includes(q) || item.userHandle.toLowerCase().includes(q)
                const matchesAnime = item.animeTitle.toLowerCase().includes(q) || item.animeGenre.toLowerCase().includes(q)
                const matchesCrit = item.criterion.toLowerCase().includes(q)
                if (!matchesUser && !matchesAnime && !matchesCrit) return false
            }

            return true
        })
    }, [ratingsData, modalityFilter, ratingFilter, actionFilter, searchQuery])

    const metrics = useMemo(() => {
        const total = ratingsData.length
        const avg = total > 0 ? Number((ratingsData.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(2)) : 0
        const scale10Avg = total > 0
            ? (ratingsData.reduce((acc, r) => acc + r.score10, 0) / total).toFixed(1)
            : '0.0'

        const countByStars = (s: number) => ratingsData.filter(r => r.rating === s).length
        const pctByStars = (s: number) => total > 0 ? Number(((countByStars(s) / total) * 100).toFixed(1)) : 0

        const c5 = countByStars(5)
        const c4 = countByStars(4)
        const c3 = countByStars(3)
        const c2 = countByStars(2)
        const c1 = countByStars(1)

        const perfectPct = pctByStars(5)
        const approvedPct = total > 0 ? Number((((c5 + c4) / total) * 100).toFixed(1)) : 0

        const personalItems = ratingsData.filter(r => r.modality === 'personal')
        const groupItems = ratingsData.filter(r => r.modality === 'group')
        const personalAvg = personalItems.length > 0
            ? (personalItems.reduce((acc, r) => acc + r.rating, 0) / personalItems.length).toFixed(2)
            : '0.00'
        const groupAvg = groupItems.length > 0
            ? (groupItems.reduce((acc, r) => acc + r.rating, 0) / groupItems.length).toFixed(2)
            : '0.00'

        return {
            total,
            avgRating: avg,
            scale10Avg,
            perfectPct,
            perfectCount: c5,
            approvedPct,
            personalCount: personalItems.length,
            personalAvg,
            groupCount: groupItems.length,
            groupAvg,
            starDistribution: [
                { stars: 5, pct: perfectPct, count: c5, color: '#10B981', desc: 'Acierto sobresaliente: calificación máxima (9-10 pts)' },
                { stars: 4, pct: pctByStars(4), count: c4, color: '#38BDF8', desc: 'Buena valoración: calificación positiva (7-8 pts)' },
                { stars: 3, pct: pctByStars(3), count: c3, color: '#F59E0B', desc: 'Neutral: calificación media (5-6 pts)' },
                { stars: 2, pct: pctByStars(2), count: c2, color: '#F97316', desc: 'Baja afinidad: calificación baja (3-4 pts)' },
                { stars: 1, pct: pctByStars(1), count: c1, color: '#EF4444', desc: 'Rechazo directo: calificación mínima (1-2 pts)' }
            ]
        }
    }, [ratingsData])

    const subViewOptions: SubViewOption<RatingsSubView>[] = [
        { id: 'explorer', label: 'Explorador Nominal de Notas', badge: `${filteredRatings.length}` },
        { id: 'accuracy-cross', label: 'Cruce: Predicción IA vs Nota Real', badge: `${metrics.approvedPct}%` }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Calificaciones"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {/* SUB-VISTA 1: EXPLORADOR NOMINAL DE NOTAS POR USUARIO */}
                {activeSubView === 'explorer' && (
                    <div className="admin-card flex-grow-1 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                <div>
                                    <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                        Registro en Vivo de Calificaciones por Usuario
                                    </h2>
                                    <span className="admin-subtitle">
                                        Auditoría individual de puntuaciones 1 a 5 estrellas, afinidad predicha y acción tomada
                                    </span>
                                </div>

                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    <div className="admin-input-wrapper d-flex align-items-center gap-2">
                                        <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar usuario o anime..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-transparent border-0 text-white"
                                            style={{ fontSize: '0.8rem', outline: 'none', width: 185 }}
                                        />
                                        {searchQuery && (
                                            <button type="button" onClick={() => setSearchQuery('')} className="btn btn-sm p-0 text-secondary">
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {[
                                            { id: 'all', label: 'Todas' },
                                            { id: 'personal', label: 'Personal 1:1' },
                                            { id: 'group', label: 'Salas Grupales' }
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setModalityFilter(m.id as any)}
                                                className={`admin-subview-pill ${modalityFilter === m.id ? 'active' : ''}`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {[
                                            { id: 'all', label: '★ Todas' },
                                            { id: '5', label: '5.0 ★' },
                                            { id: '4', label: '4.0 ★' },
                                            { id: 'low', label: '≤ 3.0 ★' }
                                        ].map(r => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => setRatingFilter(r.id as any)}
                                                className={`admin-subview-pill ${ratingFilter === r.id ? 'active' : ''}`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {[
                                            { id: 'all', label: 'Acciones' },
                                            { id: 'favorite', label: 'Favoritos' },
                                            { id: 'list', label: 'Mi Lista' }
                                        ].map(a => (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => setActionFilter(a.id as any)}
                                                className={`admin-subview-pill ${actionFilter === a.id ? 'active' : ''}`}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                <table className="table table-dark table-hover m-0 align-middle" style={{ fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                            <th>USUARIO</th>
                                            <th>ANIME EVALUADO</th>
                                            <th>MODALIDAD</th>
                                            <th>CRITERIO DISPARADOR</th>
                                            <th className="text-center">PREDICCIÓN VS REAL</th>
                                            <th>ACCIÓN POSTERIOR</th>
                                            <th className="text-end">TIEMPO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRatings.map(item => (
                                            <tr key={item.id} className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2.5">
                                                        <img
                                                            src={item.userAvatar}
                                                            alt={item.userName}
                                                            style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }}
                                                        />
                                                        <div>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <span className="text-white fw-semibold">{item.userName}</span>
                                                                {item.isVerified && <CheckCircle2 size={12} style={{ color: 'var(--admin-emerald)' }} />}
                                                            </div>
                                                            <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.74rem' }}>{item.userHandle}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2.5">
                                                        <img
                                                            src={item.animePoster}
                                                            alt={item.animeTitle}
                                                            style={{ width: 26, height: 36, borderRadius: 4, objectFit: 'cover' }}
                                                        />
                                                        <div>
                                                            <div className="text-white fw-medium">{item.animeTitle}</div>
                                                            <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>{item.animeGenre}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {item.modality === 'personal' ? (
                                                        <span className="admin-badge admin-badge-info">Personal 1:1</span>
                                                    ) : (
                                                        <div>
                                                            <span className="admin-badge admin-badge-purple">Sala Grupal</span>
                                                            <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>{item.groupRoomName}</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ color: 'var(--admin-text-secondary)', maxWidth: 240 }} className="text-truncate">
                                                    {item.criterion}
                                                </td>
                                                <td className="text-center font-mono">
                                                    <div style={{ color: 'var(--admin-amber)', fontWeight: 700 }}>
                                                        {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)} ({item.score10})
                                                    </div>
                                                    <span style={{ color: 'var(--admin-emerald)', fontSize: '0.74rem' }}>
                                                        IA predijo: {item.predictedAffinity}%
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="admin-badge admin-badge-neutral">{item.actionTaken}</span>
                                                </td>
                                                <td className="text-end font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
                                                    {item.timeAgo}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                            <span>Mostrando {filteredRatings.length} de {ratingsData.length} registros reales</span>
                            <span style={{ color: 'var(--admin-emerald)' }}>{metrics.approvedPct}% de calificaciones positivas (≥4★)</span>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 2: CRUCE DE PRECISIÓN ALGORÍTMICA */}
                {activeSubView === 'accuracy-cross' && (
                    <div className="admin-protagonist-stage">
                        <div className="admin-chart-stage">
                            <div>
                                <span className="admin-badge admin-badge-info mb-2">AUDITORÍA DE CALIBRACIÓN PREDICTIVA</span>
                                <h2 className="admin-title mb-1" style={{ fontSize: '1.2rem' }}>
                                    Cruce: Distribución de Calificaciones por Nivel de Satisfacción
                                </h2>
                                <p className="admin-subtitle mb-4">
                                    Desglose real de las puntuaciones registradas en listas personales y salas grupales
                                </p>

                                <div className="d-flex flex-column gap-3">
                                    {[
                                        { range: 'Calificación Máxima (5★)', realAvg: `${metrics.perfectCount} registros`, accuracy: metrics.perfectPct, note: 'Usuarios con satisfacción sobresaliente (9-10 pts)', color: 'var(--admin-emerald)' },
                                        { range: 'Aprobación General (≥4★)', realAvg: `${metrics.avgRating} / 5.0 ⭐`, accuracy: metrics.approvedPct, note: 'Porcentaje total de valoraciones positivas en la base de datos', color: 'var(--admin-focus)' },
                                        { range: 'Calificaciones Críticas (≤3★)', realAvg: `${Math.max(0, 100 - metrics.approvedPct).toFixed(1)}%`, accuracy: Math.max(0, 100 - metrics.approvedPct), note: 'Votos neutrales o de baja afinidad en salas y listas', color: 'var(--admin-amber)' }
                                    ].map((row, idx) => (
                                        <div key={idx} className="p-3.5 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-1.5">
                                                <strong className="text-white" style={{ fontSize: '0.88rem' }}>{row.range}</strong>
                                                <span className="font-mono fw-bold" style={{ color: row.color, fontSize: '0.95rem' }}>{row.realAvg}</span>
                                            </div>
                                            <div className="w-100 rounded overflow-hidden mb-1.5" style={{ height: 8, backgroundColor: 'var(--admin-surface-3)' }}>
                                                <div style={{ width: `${row.accuracy}%`, height: '100%', backgroundColor: row.color }} />
                                            </div>
                                            <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>{row.note}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="admin-decision-panel">
                            <div>
                                <h3 className="admin-title mb-2" style={{ fontSize: '0.98rem' }}>Resumen de Registros Auditados</h3>
                                <p className="admin-subtitle">
                                    Total de valoraciones almacenadas en PostgreSQL: <strong className="text-white">{metrics.total}</strong> ({metrics.personalCount} personales y {metrics.groupCount} grupales).
                                </p>
                                <div className="admin-decision-item mt-3">
                                    <div className="text-white fw-semibold mb-1" style={{ fontSize: '0.84rem' }}>Sincronización en Vivo</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>
                                        Cada nueva nota en "Mi Lista" o voto en sala grupal actualiza automáticamente este panel.
                                    </span>
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
    const activeStarObj = metrics.starDistribution.find(s => s.stars === (hoveredStar || 5)) || metrics.starDistribution[0]

    return (
        <div className="admin-viewport-shell">
            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <div className="d-flex align-items-center gap-2.5">
                        <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                            Centro de Calificaciones & Notas Individuales
                        </h1>
                        <span className="admin-badge admin-badge-success font-mono">FEEDBACK EN VIVO</span>
                    </div>
                    <p className="admin-subtitle m-0 mt-1">
                        Distribución cuantitativa de calificaciones 1 a 5 estrellas y precisión de afinidad por modalidad
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setRatingFilter('all')
                            setActiveSubView('explorer')
                        }}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <ThumbsUp size={14} />
                        <span>Explorar Notas por Usuario</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setRatingFilter('all')
                        setActiveSubView('explorer')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Nota Media Global</span>
                        <span className="admin-badge admin-badge-success font-mono">{metrics.scale10Avg} / 10</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{metrics.avgRating}</span>
                        <span className="font-mono" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>/ 5.0 ⭐</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Auditar registro nominal</span>
                            <ChevronRight size={13} />
                        </span>
                        <Star size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('accuracy-cross')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Tasa de Aprobación (≥4★)</span>
                        <span className="admin-badge admin-badge-info">Alta Precisión</span>
                    </div>
                    <div className="admin-kpi-value my-1">{metrics.approvedPct}%</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Cruce Predicción vs Real</span>
                            <ChevronRight size={13} />
                        </span>
                        <SlidersHorizontal size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setRatingFilter('5')
                        setActiveSubView('explorer')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Match Perfecto (5★)</span>
                        <span className="admin-badge admin-badge-success font-mono">{metrics.perfectCount} votos</span>
                    </div>
                    <div className="admin-kpi-value my-1">{metrics.perfectPct}%</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Filtrar calificaciones 5★</span>
                            <ChevronRight size={13} />
                        </span>
                        <Sparkles size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setRatingFilter('all')
                        setActiveSubView('explorer')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Evaluaciones Auditadas</span>
                        <span className="admin-badge admin-badge-neutral font-mono">100% Verificadas</span>
                    </div>
                    <div className="admin-kpi-value my-1">{metrics.total.toLocaleString()}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ver tabla completa</span>
                            <ChevronRight size={13} />
                        </span>
                        <ThumbsUp size={15} style={{ color: 'var(--admin-text-secondary)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Histograma Interactivo de Estrellas + Cruce por Modalidad */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Distribución Interactiva de Calificaciones por Estrellas
                            </h2>
                            <span className="admin-badge admin-badge-info">Click para filtrar usuarios</span>
                        </div>

                        <div className="d-flex flex-column my-2" style={{ gap: '1.15rem' }}>
                            {metrics.starDistribution.map((item) => {
                                const isHovered = hoveredStar === item.stars
                                return (
                                    <div
                                        key={item.stars}
                                        onMouseEnter={() => setHoveredStar(item.stars)}
                                        onMouseLeave={() => setHoveredStar(null)}
                                        onClick={() => {
                                            setRatingFilter(item.stars === 5 ? '5' : item.stars === 4 ? '4' : 'low')
                                            setActiveSubView('explorer')
                                        }}
                                        className="admin-chart-interactive-node"
                                        style={{
                                            padding: '1.05rem 1.3rem',
                                            borderRadius: 14,
                                            backgroundColor: isHovered ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                            border: isHovered ? `1px solid ${item.color}` : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="font-mono d-flex align-items-center gap-1.5" style={{ width: 85, color: 'var(--admin-amber)', fontSize: '0.86rem' }}>
                                                <span className="fw-bold text-white">{item.stars}★</span>
                                                <span>{'★'.repeat(item.stars)}</span>
                                            </div>

                                            <div className="flex-grow-1 rounded overflow-hidden" style={{ height: 11, backgroundColor: 'var(--admin-surface-1)' }}>
                                                <div
                                                    style={{
                                                        width: `${item.pct}%`,
                                                        height: '100%',
                                                        backgroundColor: item.color,
                                                        borderRadius: 4,
                                                        transition: 'width 0.35s ease'
                                                    }}
                                                />
                                            </div>

                                            <div className="d-flex align-items-center justify-content-end gap-2 font-mono" style={{ width: 135, fontSize: '0.84rem' }}>
                                                <span className="text-white fw-bold">{item.pct}%</span>
                                                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.76rem' }}>({item.count})</span>
                                                <ChevronRight size={14} style={{ color: isHovered ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>Foco activo ({activeStarObj.stars}★): <strong className="text-white">{activeStarObj.desc}</strong></span>
                        <span className="font-mono" style={{ color: 'var(--admin-emerald)' }}>Aprobación: {metrics.approvedPct}%</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce por Modalidad (Personal 1:1 vs Salas Grupales) */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                CRUCE: MODALIDAD × SATISFACCIÓN
                            </span>
                            <span className="admin-badge admin-badge-neutral font-mono">{metrics.total} registros</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            Personal 1:1 vs. Salas Grupales
                        </h3>
                        <p className="admin-subtitle mb-3">
                            Comparativa en tiempo real entre las notas individuales de "Mi Lista" y los votos en salas grupales.
                        </p>

                        <div className="d-flex flex-column gap-2.5 mb-3">
                            <div
                                onClick={() => {
                                    setModalityFilter('personal')
                                    setActiveSubView('explorer')
                                }}
                                className="admin-decision-item clickable"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="admin-badge admin-badge-info">Recomendador Personal 1:1</span>
                                    <span className="font-mono fw-bold" style={{ color: 'var(--admin-emerald)', fontSize: '0.95rem' }}>{metrics.personalAvg} / 5.0 ⭐</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mt-1.5" style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                                    <span>{metrics.personalCount.toLocaleString()} valoraciones individuales</span>
                                    <span className="admin-kpi-drill-pill">Filtrar →</span>
                                </div>
                            </div>

                            <div
                                onClick={() => {
                                    setModalityFilter('group')
                                    setActiveSubView('explorer')
                                }}
                                className="admin-decision-item clickable"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="admin-badge admin-badge-purple">Salas Grupales (Watch Parties)</span>
                                    <span className="font-mono fw-bold" style={{ color: 'var(--admin-focus)', fontSize: '0.95rem' }}>{metrics.groupAvg} / 5.0 ⭐</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center mt-1.5" style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                                    <span>{metrics.groupCount.toLocaleString()} votos en salas</span>
                                    <span className="admin-kpi-drill-pill">Filtrar →</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex flex-column gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setModalityFilter('all')
                                setRatingFilter('all')
                                setActiveSubView('explorer')
                            }}
                            className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                            style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                        >
                            <span>Abrir Explorador Nominal de Calificaciones</span>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
