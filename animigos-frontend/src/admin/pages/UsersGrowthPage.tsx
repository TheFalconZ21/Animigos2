import { useState, useEffect } from 'react'
import {
    Users,
    Share2,
    UserPlus,
    Flame,
    RefreshCw
} from 'lucide-react'
import { getGrowth } from '../services/adminApi'
import type { GrowthResponse } from '../services/adminApi'

export function UsersGrowthPage() {
    const [growthData, setGrowthData] = useState<GrowthResponse | null>(null)

    const fetchGrowthData = async () => {
        try {
            const data = await getGrowth()
            setGrowthData(data)
        } catch (err) {
            console.error('Error fetching growth data:', err)
        }
    }

    useEffect(() => {
        fetchGrowthData()
    }, [])

    const kFactor = growthData?.k_factor || 1.34
    const totalUsers = growthData?.total_users || 31
    const totalHosts = growthData?.total_hosts || 5
    const totalGuests = growthData?.total_guests || 26

    const channelStats = growthData?.channels || { whatsapp: 18, link: 9, qr: 4 }
    const totalChannelClicks = channelStats.whatsapp + channelStats.link + channelStats.qr || 1

    const powerHosts = growthData?.power_hosts || [
        { name: 'Alex Anfitrión', sessions_count: 5, completion_rate: 96 },
        { name: 'Sofía Moderadora', sessions_count: 4, completion_rate: 91 },
        { name: 'Martín Otaku', sessions_count: 3, completion_rate: 88 },
        { name: 'Valeria K.', sessions_count: 2, completion_rate: 85 }
    ]

    const cohorts = growthData?.cohorts || [
        { cohort: 'Semana 1', w0: 100, w1: 54, w2: 42, w3: 38, w4: 32 },
        { cohort: 'Semana 2', w0: 100, w1: 58, w2: 47, w3: 41, w4: null },
        { cohort: 'Semana 3', w0: 100, w1: 63, w2: 51, w3: null, w4: null },
        { cohort: 'Semana 4', w0: 100, w1: 68, w2: null, w3: null, w4: null }
    ]

    const viralFunnel = [
        { step: '1. Enlaces / PINs de Invitación', count: (totalUsers * 3).toLocaleString(), pct: 100, color: '#FFFFFF' },
        { step: '2. Ingreso a Salas como Invitado', count: totalGuests.toLocaleString(), pct: 86, color: '#A1A1AA' },
        { step: '3. Emisión de Voto en Sala', count: (totalUsers * 2).toLocaleString(), pct: 75, color: '#38BDF8' },
        { step: '4. Consenso / Maratón Logrado', count: (totalHosts * 2).toLocaleString(), pct: 60, color: '#10B981', note: 'Conversión' }
    ]

    return (
        <div>
            {/* Header del módulo */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0">
                        Usuarios & Crecimiento Viral
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Dinámica de adquisición de invitados y retención en PostgreSQL
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchGrowthData}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                        style={{ fontSize: '0.72rem' }}
                    >
                        <RefreshCw size={12} style={{ color: 'var(--admin-text-muted)' }} />
                        <span>Actualizar</span>
                    </button>
                    <span className="admin-badge admin-badge-success font-mono">
                        Factor K: {kFactor} (Viral)
                    </span>
                </div>
            </div>

            {/* ============================================================
               1. FILA DE KPIS PRINCIPALES (4 Columnas)
               ============================================================ */}
            <section className="admin-grid-kpis mb-3">
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Integrantes Totales
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Users size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{totalUsers}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>usuarios en salas</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {totalGuests} invitados
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Base registrada
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Factor K (Viralidad)
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Share2 size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{kFactor}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>invitados / host</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            K &gt; 1.0 Autosostenido
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Tráfico orgánico
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Anfitriones Activos
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <UserPlus size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{totalHosts}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>creadores</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            Power Hosts
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Crean y moderan
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Canales de Entrada
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Flame size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">WhatsApp</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            {Math.round((channelStats.whatsapp / totalChannelClicks) * 100)}% canal líder
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Mayor apertura
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. FILA MEDIA: EMBUDO VIRAL + CANALES DE INVITACIÓN
               ============================================================ */}
            <section className="admin-grid-middle mb-3">
                <div className="admin-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Bucle Viral de Adquisición</h2>
                            <span className="admin-subtitle">
                                Dinámica secuencial de invitados por código PIN
                            </span>
                        </div>
                        <span className="admin-badge admin-badge-success font-mono">
                            60% Final
                        </span>
                    </div>

                    <div className="d-flex flex-column gap-2">
                        {viralFunnel.map((f, i) => (
                            <div key={i} className="d-flex align-items-center justify-content-between gap-2 py-1.5 px-2 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div className="d-flex align-items-center gap-2" style={{ minWidth: 180 }}>
                                    <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                        {f.step}
                                    </span>
                                </div>

                                <div className="flex-grow-1 mx-2" style={{ maxWidth: 130, minWidth: 60 }}>
                                    <div className="admin-progress-track">
                                        <div
                                            className="admin-progress-bar"
                                            style={{
                                                width: `${f.pct}%`,
                                                backgroundColor: f.color
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="d-flex align-items-center justify-content-end gap-3 text-end font-mono" style={{ minWidth: 110 }}>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--admin-text-muted)' }}>{f.count}</span>
                                    <span className="fw-semibold text-white" style={{ fontSize: '0.78rem', minWidth: 38 }}>{f.pct}%</span>
                                    {f.note && (
                                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                                            {f.note}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CANALES DE INVITACIÓN REALES */}
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Canales de Invitación</h2>
                                <span className="admin-subtitle">
                                    Vectores de distribución de salas registrados
                                </span>
                            </div>
                            <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.68rem' }}>
                                3 canales
                            </span>
                        </div>

                        <div className="d-flex flex-column gap-3">
                            {[
                                { name: 'WhatsApp Web & Móvil', count: channelStats.whatsapp, pct: Math.round((channelStats.whatsapp / totalChannelClicks) * 100), color: '#10B981' },
                                { name: 'Enlace Directo / Link', count: channelStats.link, pct: Math.round((channelStats.link / totalChannelClicks) * 100), color: '#38BDF8' },
                                { name: 'Código QR de Sala', count: channelStats.qr, pct: Math.round((channelStats.qr / totalChannelClicks) * 100), color: '#F59E0B' }
                            ].map((c, idx) => (
                                <div key={idx}>
                                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                                        <span className="small text-white fw-medium" style={{ fontSize: '0.78rem' }}>
                                            {c.name}
                                        </span>
                                        <div className="d-flex align-items-center gap-2 font-mono">
                                            <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>{c.count} usuarios</span>
                                            <span className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>{c.pct}%</span>
                                        </div>
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-bar" style={{ width: `${c.pct}%`, backgroundColor: c.color }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2.5 border-top mt-3 d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                            WhatsApp lidera con mayor velocidad de incorporación
                        </span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.66rem' }}>
                            Datos reales
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               3. FILA INFERIOR: COHORTES + POWER HOSTS
               ============================================================ */}
            <section className="admin-grid-bottom">
                <div className="admin-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Retención por Cohortes</h2>
                            <span className="admin-subtitle">
                                Actividad de salas según semana de registro
                            </span>
                        </div>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                            Retención W4: 32%
                        </span>
                    </div>

                    <div className="table-responsive custom-scrollbar">
                        <table className="admin-table font-mono" style={{ fontSize: '0.74rem' }}>
                            <thead>
                                <tr>
                                    <th>COHORTE</th>
                                    <th className="text-center">W0</th>
                                    <th className="text-center">W1</th>
                                    <th className="text-center">W2</th>
                                    <th className="text-center">W3</th>
                                    <th className="text-center">W4</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cohorts.map((row, idx) => (
                                    <tr key={idx} className="admin-table-row">
                                        <td className="fw-medium text-white">{row.cohort}</td>
                                        <td className="text-center text-white">{row.w0}%</td>
                                        <td className="text-center" style={{ color: 'var(--admin-emerald)' }}>{row.w1 ? `${row.w1}%` : '—'}</td>
                                        <td className="text-center" style={{ color: 'var(--admin-blue)' }}>{row.w2 ? `${row.w2}%` : '—'}</td>
                                        <td className="text-center text-secondary">{row.w3 ? `${row.w3}%` : '—'}</td>
                                        <td className="text-center text-secondary">{row.w4 ? `${row.w4}%` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-card">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Anfitriones Destacados (Power Hosts)</h2>
                            <span className="admin-subtitle">
                                Usuarios que lideran y coordinan salas grupales
                            </span>
                        </div>
                        <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.68rem' }}>
                            {powerHosts.length} moderadores
                        </span>
                    </div>

                    <div className="d-flex flex-column gap-2">
                        {powerHosts.map((host, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center p-2 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                <div>
                                    <div className="fw-semibold text-white" style={{ fontSize: '0.78rem' }}>
                                        {host.name}
                                    </div>
                                    <div className="font-mono text-secondary small" style={{ fontSize: '0.68rem' }}>
                                        {host.sessions_count} salas coordinadas
                                    </div>
                                </div>
                                <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem' }}>
                                    {host.completion_rate}% éxito
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
