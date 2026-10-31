import React from 'react'
import {
    Activity,
    Tv,
    SlidersHorizontal,
    Film,
    Users,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    Calendar,
    BarChart3,
    Sparkles,
    TrendingUp,
    ShieldAlert
} from 'lucide-react'

export type AdminTab = 'overview' | 'rooms' | 'algorithm' | 'recommender' | 'catalog' | 'users' | 'growth' | 'moderation'

interface AdminSidebarProps {
    activeTab: AdminTab
    onSelectTab: (tab: AdminTab) => void
    period: string
    onPeriodChange?: (period: string) => void
    onBackToLanding?: () => void
    isCollapsed: boolean
    onToggleCollapse: () => void
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    activeTab,
    onSelectTab,
    period,
    onPeriodChange,
    onBackToLanding,
    isCollapsed,
    onToggleCollapse
}) => {
    const navItems: {
        category?: string
        items: {
            id: AdminTab
            label: string
            icon: React.ReactNode
            badge?: string
            description: string
        }[]
    }[] = [
        {
            category: 'Telemetría & Operación',
            items: [
                {
                    id: 'overview',
                    label: 'Pulso General',
                    icon: <Activity size={16} />,
                    description: 'Embudo de conversión y KPIs vitales'
                },
                {
                    id: 'rooms',
                    label: 'Salas & Votación',
                    icon: <Tv size={16} />,
                    badge: 'En vivo',
                    description: 'Quórum, fases y watch parties'
                }
            ]
        },
        {
            category: 'Motores & Algoritmos',
            items: [
                {
                    id: 'algorithm',
                    label: 'Consenso Grupal',
                    icon: <SlidersHorizontal size={16} />,
                    description: 'Vector de felicidad y penalización σ'
                },
                {
                    id: 'recommender',
                    label: 'Recomendador IA',
                    icon: <Sparkles size={16} />,
                    badge: 'A/B Test',
                    description: 'Satisfacción y adopción de sugerencias'
                },
                {
                    id: 'catalog',
                    label: 'Catálogo de Animes',
                    icon: <Film size={16} />,
                    description: '30,777 títulos en PostgreSQL'
                }
            ]
        },
        {
            category: 'Audiencia & Comunidad',
            items: [
                {
                    id: 'users',
                    label: 'Usuarios & Demografía',
                    icon: <Users size={16} />,
                    description: 'Cuentas reales vs invitados, actividad y perfiles'
                },
                {
                    id: 'growth',
                    label: 'Crecimiento & Adopción',
                    icon: <TrendingUp size={16} />,
                    description: 'Nuevas altas, invitaciones y dinamismo diario'
                },
                {
                    id: 'moderation',
                    label: 'Centro de Moderación',
                    icon: <ShieldAlert size={16} />,
                    badge: 'Reportes',
                    description: 'Denuncias, advertencias y borrado de comentarios'
                }
            ]
        }
    ]

    return (
        <aside className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Header del Sidebar con marca y botón colapsar */}
            <div className="admin-sidebar-header">
                {!isCollapsed ? (
                    <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <div
                            className="d-flex align-items-center justify-content-center rounded-2"
                            style={{
                                width: 28,
                                height: 28,
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                color: '#FFFFFF',
                                flexShrink: 0
                            }}
                        >
                            <BarChart3 size={15} />
                        </div>
                        <div className="text-truncate">
                            <span className="font-mono d-block fw-bold text-white lh-1" style={{ fontSize: '0.8rem', letterSpacing: '0.04em' }}>
                                ANIMIGOS
                            </span>
                            <span className="text-secondary font-mono d-block mt-0.5" style={{ fontSize: '0.62rem', letterSpacing: '0.06em' }}>
                                ADMIN CONSOLE
                            </span>
                        </div>
                    </div>
                ) : (
                    <div
                        className="d-flex align-items-center justify-content-center rounded-2 mx-auto"
                        style={{
                            width: 32,
                            height: 32,
                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                            color: '#FFFFFF'
                        }}
                        title="Animigos Admin"
                    >
                        <BarChart3 size={16} />
                    </div>
                )}

                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="admin-btn admin-btn-secondary p-1 d-flex align-items-center justify-content-center"
                    style={{ width: 26, height: 26 }}
                    title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* Navegación por grupos */}
            <div className="admin-sidebar-nav custom-scrollbar">
                {navItems.map((group, gIdx) => (
                    <div key={gIdx} className="mb-2">
                        {!isCollapsed && group.category && (
                            <div className="admin-sidebar-section-title">
                                {group.category}
                            </div>
                        )}
                        <div className="d-flex flex-column gap-1">
                            {group.items.map((item) => {
                                const isActive = activeTab === item.id
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onSelectTab(item.id)}
                                        className={`admin-sidebar-item ${isActive ? 'active' : ''}`}
                                        title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                                    >
                                        <div
                                            className="d-flex align-items-center justify-content-center"
                                            style={{
                                                color: isActive ? '#FFFFFF' : 'var(--admin-text-secondary)',
                                                flexShrink: 0
                                            }}
                                        >
                                            {item.icon}
                                        </div>

                                        {!isCollapsed && (
                                            <div className="d-flex align-items-center justify-content-between w-100 overflow-hidden">
                                                <span className="text-truncate">{item.label}</span>
                                                {item.badge && (
                                                    <span
                                                        className="admin-badge admin-badge-success font-mono"
                                                        style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer del Sidebar con Selector de Periodo y Salida */}
            <div className="admin-sidebar-footer">
                {!isCollapsed ? (
                    <div className="d-flex flex-column gap-2">
                        {/* Selector de periodo rápido */}
                        <button
                            type="button"
                            onClick={() => {
                                if (!onPeriodChange) return
                                const options = ['Últimos 30 días', 'Últimos 7 días', 'Hoy']
                                const currentIndex = options.indexOf(period)
                                const nextIndex = (currentIndex + 1) % options.length
                                onPeriodChange(options[nextIndex])
                            }}
                            className="admin-btn admin-btn-secondary w-100 d-flex align-items-center justify-content-between py-1.5"
                            title="Alternar ventana temporal"
                        >
                            <span className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.74rem' }}>
                                <Calendar size={13} style={{ color: 'var(--admin-text-muted)' }} />
                                <span className="text-truncate">{period}</span>
                            </span>
                            <span className="font-mono text-muted" style={{ fontSize: '0.65rem' }}>Cambiar</span>
                        </button>

                        {/* Botón Salir a Landing */}
                        {onBackToLanding && (
                            <button
                                type="button"
                                onClick={onBackToLanding}
                                className="admin-btn admin-btn-secondary w-100 d-flex align-items-center justify-content-center gap-1.5 py-1.5 text-secondary"
                                style={{ fontSize: '0.74rem' }}
                            >
                                <ArrowLeft size={13} />
                                <span>Volver a la App</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="d-flex flex-column align-items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (!onPeriodChange) return
                                const options = ['Últimos 30 días', 'Últimos 7 días', 'Hoy']
                                const currentIndex = options.indexOf(period)
                                const nextIndex = (currentIndex + 1) % options.length
                                onPeriodChange(options[nextIndex])
                            }}
                            className="admin-btn admin-btn-secondary p-1.5 d-flex align-items-center justify-content-center"
                            title={`Periodo: ${period} (Click para cambiar)`}
                        >
                            <Calendar size={14} />
                        </button>

                        {onBackToLanding && (
                            <button
                                type="button"
                                onClick={onBackToLanding}
                                className="admin-btn admin-btn-secondary p-1.5 d-flex align-items-center justify-content-center text-secondary"
                                title="Volver a la App"
                            >
                                <ArrowLeft size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </aside>
    )
}
