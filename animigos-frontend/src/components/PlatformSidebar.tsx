import React from 'react'
import {
    LayoutDashboard,
    Calendar,
    Users,
    Film,
    Sparkles,
    Bookmark,
    ChevronLeft,
    History,
    CalendarCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AnimigosLogo } from './AnimigosLogo'
import { useCatExpression } from '../hooks/useCatExpression'
import './platform-sidebar.css'

export type PlatformView =
    | 'landing'
    | 'catalogo'
    | 'recomendador'
    | 'temporadas'
    | 'agenda'
    | 'mi-lista'
    | 'sala'
    | 'tablon'
    | 'calendario'
    | 'perfil'
    | 'admin'

interface PlatformSidebarProps {
    currentView: PlatformView
    onSelectView: (view: PlatformView) => void
    isCollapsed: boolean
    onToggleCollapse: () => void
}

interface NavItemConfig {
    id: PlatformView
    label: string
    icon: React.ReactNode
    hash: string
    badge?: string
    badgeColor?: string
    requiresAuth?: boolean
}

export const PlatformSidebar: React.FC<PlatformSidebarProps> = ({
    currentView,
    onSelectView,
    isCollapsed,
    onToggleCollapse
}) => {
    const { isAuthenticated } = useAuth()
    const { setExpression } = useCatExpression()

    const handleItemClick = (item: NavItemConfig) => {
        if (item.requiresAuth && !isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        window.location.hash = `#${item.hash}`
        onSelectView(item.id)
    }

    const navSections: {
        category: string
        items: NavItemConfig[]
    }[] = [
        {
            category: 'De todos los días',
            items: [
                {
                    id: 'tablon',
                    label: 'Tablón Social',
                    icon: <LayoutDashboard size={17} />,
                    hash: 'tablon',
                    requiresAuth: true
                },
                {
                    id: 'calendario',
                    label: 'Calendario',
                    icon: <Calendar size={17} />,
                    hash: 'calendario',
                    badge: 'Semanal',
                    badgeColor: 'rgba(59, 130, 246, 0.2)'
                },
                {
                    id: 'agenda' as PlatformView,
                    label: 'Agenda',
                    icon: <CalendarCheck size={17} />,
                    hash: 'agenda',
                    badge: 'Pendientes',
                    badgeColor: 'rgba(245, 158, 11, 0.25)',
                    requiresAuth: true
                },
                {
                    id: 'sala',
                    label: 'Listas Grupales',
                    icon: <Users size={17} />,
                    hash: 'listas',
                    badge: 'En vivo',
                    badgeColor: 'rgba(16, 185, 129, 0.2)'
                }
            ]
        },
        {
            category: 'Repertorio de Animes',
            items: [
                {
                    id: 'catalogo',
                    label: 'Catálogo',
                    icon: <Film size={17} />,
                    hash: 'catalogo'
                },
                {
                    id: 'recomendador',
                    label: 'Recomendador',
                    icon: <Sparkles size={17} />,
                    hash: 'recomendador',
                    badge: 'IA',
                    badgeColor: 'rgba(168, 85, 247, 0.2)'
                },
                {
                    id: 'temporadas',
                    label: 'Temporadas',
                    icon: <History size={17} />,
                    hash: 'temporadas',
                    badge: 'Timeline',
                    badgeColor: 'color-mix(in srgb, var(--theme-acento, #e8508f) 22%, transparent)'
                }
            ]
        },
        ...(isAuthenticated
            ? [
                  {
                      category: 'Mi Espacio',
                      items: [
                          {
                              id: 'mi-lista' as PlatformView,
                              label: 'Mi Lista',
                              icon: <Bookmark size={17} />,
                              hash: 'mi-lista',
                              requiresAuth: true
                          }
                      ]
                  }
              ]
            : [])
    ]

    return (
        <aside
            className={`platform-sidebar ${isCollapsed ? 'collapsed' : ''}`}
            aria-hidden={isCollapsed}
        >
            {/* Header: Marca Animigos completa y botón de cierre */}
            <div className="platform-sidebar-header">
                <a
                    href="#landing"
                    onClick={(e) => {
                        e.preventDefault()
                        window.location.hash = ''
                        onSelectView('landing')
                    }}
                    onMouseEnter={() => setExpression('happy')}
                    onMouseLeave={() => setExpression('normal')}
                    className="platform-sidebar-logo-link"
                    title="Animigos — Inicio"
                >
                    <AnimigosLogo size="sm" showText={true} />
                </a>

                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="platform-sidebar-toggle-btn"
                    title="Cerrar barra lateral"
                    aria-label="Cerrar sidebar"
                >
                    <ChevronLeft size={16} />
                </button>
            </div>

            {/* Navegación Principal */}
            <nav className="platform-sidebar-nav custom-scrollbar">
                {navSections.map((sec) => (
                    <div key={sec.category} className="mb-2">
                        <div className="platform-sidebar-section-title">
                            {sec.category}
                        </div>
                        <div className="d-flex flex-column gap-1">
                            {sec.items.map((it) => {
                                const isActive = currentView === it.id
                                return (
                                    <button
                                        key={it.id}
                                        type="button"
                                        onClick={() => handleItemClick(it)}
                                        className={`platform-sidebar-item ${isActive ? 'active' : ''}`}
                                    >
                                        <span className="platform-sidebar-icon">
                                            {it.icon}
                                        </span>
                                        <span className="platform-sidebar-label">
                                            {it.label}
                                        </span>
                                        {it.badge && (
                                            <span
                                                className="platform-sidebar-badge"
                                                style={{
                                                    backgroundColor: it.badgeColor || 'rgba(255, 255, 255, 0.1)',
                                                    color: '#ffffff'
                                                }}
                                            >
                                                {it.badge}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    )
}
