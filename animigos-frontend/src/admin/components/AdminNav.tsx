import type { ReactNode } from 'react'
import {
    Activity,
    Tv,
    SlidersHorizontal,
    Film,
    Users,
    Calendar,
    ArrowLeft
} from 'lucide-react'

export type AdminTab = 'overview' | 'rooms' | 'algorithm' | 'catalog' | 'growth'

interface AdminNavProps {
    activeTab: AdminTab
    onSelectTab: (tab: AdminTab) => void
    period: string
    onPeriodChange?: (period: string) => void
    onBackToLanding?: () => void
}

export function AdminNav({
    activeTab,
    onSelectTab,
    period,
    onPeriodChange,
    onBackToLanding
}: AdminNavProps) {
    const tabs: { id: AdminTab; label: string; icon: ReactNode; badge?: string }[] = [
        { id: 'overview', label: 'Pulso General', icon: <Activity size={14} /> },
        { id: 'rooms', label: 'Salas & Votación', icon: <Tv size={14} />, badge: '4 activas' },
        { id: 'algorithm', label: 'Algoritmo de Felicidad', icon: <SlidersHorizontal size={14} /> },
        { id: 'catalog', label: 'Catálogo de Animes', icon: <Film size={14} /> },
        { id: 'growth', label: 'Usuarios & Crecimiento', icon: <Users size={14} /> }
    ]

    return (
        <header className="mb-4">
            {/* Top row: Brand + Period selector + Back */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 pb-3 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <span
                            className="font-mono"
                            style={{
                                fontSize: '0.72rem',
                                letterSpacing: '0.06em',
                                color: 'var(--admin-text-secondary)',
                                fontWeight: 600
                            }}
                        >
                            ANIMIGOS / ADMIN CONSOLE
                        </span>
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                            LIVE
                        </span>
                    </div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Period selector */}
                    <button
                        type="button"
                        onClick={() => {
                            if (!onPeriodChange) return
                            const options = ['Últimos 30 días', 'Últimos 7 días', 'Hoy']
                            const currentIndex = options.indexOf(period)
                            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length
                            onPeriodChange(options[nextIndex])
                        }}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-2"
                        title="Clic para alternar periodo de auditoría"
                    >
                        <Calendar size={13} style={{ color: 'var(--admin-text-muted)' }} />
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>Periodo:</span>
                        <span className="font-mono text-white" style={{ fontSize: '0.75rem' }}>{period}</span>
                    </button>

                    {/* Back to landing */}
                    {onBackToLanding && (
                        <button
                            type="button"
                            onClick={onBackToLanding}
                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                        >
                            <ArrowLeft size={13} style={{ color: 'var(--admin-text-muted)' }} />
                            <span>Landing</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs Bar (Linear / Vercel style: 2px white bottom border on active) */}
            <nav className="admin-nav-tabs custom-scrollbar">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onSelectTab(tab.id)}
                            className={`admin-nav-tab ${isActive ? 'active' : ''}`}
                        >
                            <span style={{ color: isActive ? 'var(--admin-text-primary)' : 'var(--admin-text-muted)' }}>
                                {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span
                                    className={`admin-badge font-mono ${isActive ? 'admin-badge-success' : 'admin-badge-neutral'}`}
                                    style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </nav>
        </header>
    )
}
