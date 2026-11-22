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
    CalendarCheck,
    LogIn,
    Trophy,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AnimigosLogo } from './AnimigosLogo'
import { useCatExpression } from '../hooks/useCatExpression'
import { navigate } from '../utils/navigation'
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
    | 'ranking'
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
    description?: string
}

export const PlatformSidebar: React.FC<PlatformSidebarProps> = ({
    currentView,
    onSelectView,
    isCollapsed,
    onToggleCollapse
}) => {
    const { isAuthenticated, loading: authLoading } = useAuth()
    const { setExpression } = useCatExpression()

    const handleItemClick = (item: NavItemConfig) => {
        if (item.requiresAuth && !isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        navigate(`/${item.hash}`)
        onSelectView(item.id)
    }

    const navSections: {
        category: string
        items: NavItemConfig[]
    }[] = [
        ...(isAuthenticated
            ? [
                  {
                      category: 'Social',
                      items: [
                          {
                              id: 'tablon' as PlatformView,
                              label: 'Tablón Social',
                              icon: <LayoutDashboard size={17} />,
                              hash: 'tablon',
                              requiresAuth: true,
                              description: 'Feed de amigos, noticias y watch parties'
                          },
                          {
                              id: 'ranking' as PlatformView,
                              label: 'Ranking',
                              icon: <Trophy size={17} />,
                              hash: 'ranking',
                              badge: 'Tiers',
                              badgeColor: 'rgba(251, 191, 36, 0.22)',
                              requiresAuth: true,
                              description: 'Clasificación de usuarios por horas vistas'
                          }
                      ]
                  }
              ]
            : []),
        {
            category: 'De todos los días',
            items: [
                {
                    id: 'calendario',
                    label: 'Calendario',
                    icon: <Calendar size={17} />,
                    hash: 'calendario',
                    badge: 'Semanal',
                    badgeColor: 'rgba(59, 130, 246, 0.25)',
                    description: 'Horarios de emisión y estrenos semanales'
                },
                ...(isAuthenticated
                    ? [
                          {
                              id: 'agenda' as PlatformView,
                              label: 'Agenda',
                              icon: <CalendarCheck size={17} />,
                              hash: 'agenda',
                              badge: 'Pendientes',
                              badgeColor: 'rgba(245, 158, 11, 0.25)',
                              requiresAuth: true,
                              description: 'Seguimiento de capítulos pendientes'
                          }
                      ]
                    : [])
            ]
        },
        {
            category: 'Repertorio y Descubrimiento',
            items: [
                {
                    id: 'catalogo',
                    label: 'Catálogo',
                    icon: <Film size={17} />,
                    hash: 'catalogo',
                    description: '26,878 series y películas indexadas'
                },
                {
                    id: 'recomendador',
                    label: 'Recomendador',
                    icon: <Sparkles size={17} />,
                    hash: 'recomendador',
                    badge: 'IA',
                    badgeColor: 'rgba(168, 85, 247, 0.25)',
                    description: 'Recomendaciones inteligentes y calibración'
                },
                {
                    id: 'temporadas',
                    label: 'Temporadas',
                    icon: <History size={17} />,
                    hash: 'temporadas',
                    badge: 'Timeline',
                    badgeColor: 'color-mix(in srgb, var(--theme-acento, #e8508f) 22%, transparent)',
                    description: 'Estaciones del año y línea temporal'
                }
            ]
        },
        {
            category: 'Mi espacio',
            items: [
                ...(isAuthenticated
                    ? [
                          {
                              id: 'mi-lista' as PlatformView,
                              label: 'Mi Lista',
                              icon: <Bookmark size={17} />,
                              hash: 'mi-lista',
                              requiresAuth: true,
                              description: 'Seguimiento personal y notas de animes'
                          }
                      ]
                    : []),
                {
                    id: 'sala',
                    label: 'Listas Grupales',
                    icon: <Users size={17} />,
                    hash: 'listas',
                    badge: 'En vivo',
                    badgeColor: 'rgba(16, 185, 129, 0.25)',
                    description: 'Votación por consenso y watch parties'
                }
            ]
        }
    ]

    return (
        <aside
            className={`admin-sidebar platform-sidebar ${isCollapsed ? 'collapsed' : ''}`}
            aria-label="Barra lateral de navegación"
        >
            {/* Header: Idéntico al del Panel Admin */}
            <div className="admin-sidebar-header">
                {!isCollapsed ? (
                    <div className="d-flex align-items-center gap-2.5 overflow-hidden">
                        <a
                            href="/"
                            onClick={(e) => {
                                e.preventDefault()
                                navigate('/')
                                onSelectView('landing')
                            }}
                            onMouseEnter={() => setExpression('happy')}
                            onMouseLeave={() => setExpression('normal')}
                            className="platform-sidebar-logo-link"
                            title="Animigos — Inicio"
                        >
                            <AnimigosLogo size="sm" showText={true} />
                        </a>
                    </div>
                ) : (
                    <div className="mx-auto d-flex align-items-center justify-content-center">
                        <a
                            href="/"
                            onClick={(e) => {
                                e.preventDefault()
                                navigate('/')
                                onSelectView('landing')
                            }}
                            onMouseEnter={() => setExpression('happy')}
                            onMouseLeave={() => setExpression('normal')}
                            className="platform-sidebar-logo-link"
                            title="Animigos — Inicio"
                        >
                            <AnimigosLogo size="sm" showText={false} />
                        </a>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="admin-btn admin-btn-secondary d-flex align-items-center justify-content-center"
                    style={{ width: 26, height: 26, padding: 0, flexShrink: 0 }}
                    title={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
                    aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
                >
                    {!isCollapsed && (
                        <ChevronLeft size={15} style={{ stroke: 'rgba(255, 255, 255, 0.85)' }} />
                    )}
                </button>
            </div>

            {/* Navegación Principal */}
            <nav className="platform-sidebar-nav custom-scrollbar">
                {navSections.map((sec, sIdx) => (
                    <div key={sec.category} className="mb-2">
                        {!isCollapsed ? (
                            <div className="platform-sidebar-section-title">
                                {sec.category}
                            </div>
                        ) : (
                            sIdx > 0 && <div className="platform-sidebar-section-divider" />
                        )}
                        <div className="d-flex flex-column gap-1">
                            {sec.items.map((it) => {
                                const isActive = currentView === it.id
                                return (
                                    <button
                                        key={it.id}
                                        type="button"
                                        onClick={() => handleItemClick(it)}
                                        className={`platform-sidebar-item ${isActive ? 'active' : ''}`}
                                        title={isCollapsed ? `${it.label}${it.description ? ` — ${it.description}` : ''}` : undefined}
                                    >
                                        <span className="platform-sidebar-icon">
                                            {it.icon}
                                        </span>
                                        {!isCollapsed && (
                                            <div className="d-flex align-items-center justify-content-between w-100 overflow-hidden">
                                                <span className="platform-sidebar-label text-truncate">
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
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer del Sidebar: Solo visible para usuarios no autenticados (sin parpadeo en carga) */}
            {!authLoading && !isAuthenticated && (
                <div className="platform-sidebar-footer">
                    {!isCollapsed ? (
                        <button
                            type="button"
                            onClick={() => {
                                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                                dialog?.showModal()
                            }}
                            className="platform-sidebar-login-btn w-100"
                            title="Iniciar Sesión en Animigos"
                        >
                            <LogIn size={15} />
                            <span>Iniciar Sesión</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                                dialog?.showModal()
                            }}
                            className="platform-sidebar-login-btn-mini"
                            title="Iniciar Sesión en Animigos"
                        >
                            <LogIn size={16} />
                        </button>
                    )}
                </div>
            )}
        </aside>
    )
}
