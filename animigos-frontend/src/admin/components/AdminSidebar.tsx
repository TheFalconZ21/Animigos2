import React, { useState } from 'react'
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
    Sparkles,
    TrendingUp,
    ShieldAlert,
    Star
} from 'lucide-react'

/**
 * Logotipo Oficial del Panel Admin: Gato de Animigos rodeado de una Tuerca Mecánica
 */
const AdminCatGearLogo: React.FC = () => {
    const [isHovered, setIsHovered] = useState(false)

    // 8 dientes de tuerca/engranaje (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
    const teethAngles = [0, 45, 90, 135, 180, 225, 270, 315]

    return (
        <div
            className="admin-cat-gear-logo"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title="Animigos Consola Ejecutiva"
        >
            <svg
                viewBox="0 0 40 40"
                className="admin-cat-gear-svg"
                aria-hidden="true"
            >
                {/* Dientes de la tuerca/engranaje */}
                {teethAngles.map((angle) => (
                    <rect
                        key={angle}
                        x="17"
                        y="1.2"
                        width="6"
                        height="6.2"
                        rx="1.4"
                        fill="currentColor"
                        transform={`rotate(${angle} 20 20)`}
                    />
                ))}
                {/* Cuerpo anular de la tuerca */}
                <circle
                    cx="20"
                    cy="20"
                    r="14.6"
                    fill="currentColor"
                />
                {/* Núcleo oscuro interior donde habita el gato de Animigos */}
                <circle
                    cx="20"
                    cy="20"
                    r="11.4"
                    fill="#090B10"
                    stroke="rgba(255, 255, 255, 0.14)"
                    strokeWidth="0.8"
                />
            </svg>
            <img
                src={isHovered ? '/logo2-cat-white.png' : '/logo-cat-white.png'}
                alt="Gato Animigos Admin"
                className="admin-cat-gear-img"
                draggable={false}
            />
        </div>
    )
}

export type AdminTab = 'overview' | 'rooms' | 'algorithm' | 'recommender' | 'ratings' | 'catalog' | 'users' | 'growth' | 'moderation'

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
                    id: 'ratings',
                    label: 'Calificaciones',
                    icon: <Star size={16} />,
                    badge: 'Feedback',
                    description: 'Notas individuales y feedback de usuarios'
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
            {/* Header del Sidebar con marca (Gato de Animigos rodeado de Tuerca) y botón colapsar */}
            <div className="admin-sidebar-header">
                {!isCollapsed ? (
                    <div className="d-flex align-items-center gap-2.5 overflow-hidden">
                        <AdminCatGearLogo />
                        <div className="text-truncate">
                            <span className="d-block fw-bold text-white lh-1" style={{ fontSize: '0.88rem', letterSpacing: '0.03em' }}>
                                ANIMIGOS
                            </span>
                            <span className="d-block mt-1" style={{ color: 'var(--admin-text-muted)', fontSize: '0.68rem', letterSpacing: '0.07em', fontWeight: 600 }}>
                                CONSOLA EJECUTIVA
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto d-flex align-items-center justify-content-center">
                        <AdminCatGearLogo />
                    </div>
                )}

                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="admin-btn admin-btn-secondary p-1 d-flex align-items-center justify-content-center"
                    style={{ width: 26, height: 26, flexShrink: 0 }}
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
                                                        className={`admin-badge font-mono ${isActive ? 'admin-badge-info' : 'admin-badge-neutral'}`}
                                                        style={{ fontSize: '0.68rem', padding: '0.12rem 0.42rem' }}
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
                            className="admin-btn admin-btn-secondary w-100 d-flex align-items-center justify-content-between"
                            style={{ padding: '0.55rem 0.85rem' }}
                            title="Alternar ventana temporal"
                        >
                            <span className="d-flex align-items-center gap-2" style={{ fontSize: '0.78rem' }}>
                                <Calendar size={14} style={{ color: 'var(--admin-focus)', flexShrink: 0 }} />
                                <span className="text-truncate">{period}</span>
                            </span>
                            <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.7rem' }}>Cambiar</span>
                        </button>

                        {/* Botón Salir a Landing */}
                        {onBackToLanding && (
                            <button
                                type="button"
                                onClick={onBackToLanding}
                                className="admin-btn admin-btn-secondary w-100 d-flex align-items-center justify-content-center gap-2"
                                style={{ padding: '0.55rem 0.85rem', fontSize: '0.78rem' }}
                            >
                                <ArrowLeft size={14} style={{ flexShrink: 0 }} />
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
