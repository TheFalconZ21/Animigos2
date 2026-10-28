import { useEffect, useRef, useState } from 'react'
import { NavOverflow } from 'bootstrap'
import {
    LogOut,
    User as UserIcon,
    ShieldCheck,
    Menu,
    X,
    LayoutDashboard,
    Film,
    Bookmark,
    Users,
    Calendar,
    Sparkles,
    Bell,
    Check,
    Plus,
    ExternalLink,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { AnimigosLogo } from './AnimigosLogo'
import { useCatExpression } from '../hooks/useCatExpression'
import {
    fetchUserNotifications,
    updateUserNotification,
    type UserNotificationItem,
} from '../services/friendsApi'
import { addAnimeToMyList } from '../services/userListApi'

interface NavbarProps {
    currentView?: 'landing' | 'catalogo' | 'recomendador' | 'mi-lista' | 'sala' | 'tablon' | 'calendario' | 'perfil' | 'admin'
    onSelectView?: (view: 'landing' | 'catalogo' | 'recomendador' | 'mi-lista' | 'sala' | 'tablon' | 'calendario' | 'perfil' | 'admin') => void
}

export function Navbar({ currentView = 'catalogo', onSelectView }: NavbarProps) {
    const { user, isAuthenticated, logout } = useAuth()
    const { setExpression } = useCatExpression()
    const queryClient = useQueryClient()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    // 1. Creamos la referencia al contenedor del overflow
    const overflowRef = useRef<HTMLDivElement>(null)

    // Estado de Notificaciones Accionables en la Navbar
    const [notifications, setNotifications] = useState<UserNotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isNotifOpen, setIsNotifOpen] = useState(false)
    const [addedNotifIds, setAddedNotifIds] = useState<Record<string, boolean>>({})
    const notifWrapRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!isAuthenticated || !user) {
            setNotifications([])
            setUnreadCount(0)
            return
        }
        let cancelled = false
        const loadNotifs = () => {
            fetchUserNotifications()
                .then((res) => {
                    if (!cancelled) {
                        setNotifications(res.notifications)
                        setUnreadCount(res.unread_count)
                    }
                })
                .catch(() => {})
        }
        loadNotifs()
        const interval = setInterval(loadNotifs, 25000)
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [isAuthenticated, user?.id])

    useEffect(() => {
        if (!isNotifOpen) return
        const handleClickOutside = (ev: MouseEvent) => {
            if (notifWrapRef.current && !notifWrapRef.current.contains(ev.target as Node)) {
                setIsNotifOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isNotifOpen])

    const handleMarkAllRead = async () => {
        const res = await updateUserNotification({ action: 'mark_all_read' })
        setNotifications(res.notifications)
        setUnreadCount(res.unread_count)
    }

    const handleDismissNotification = async (id: string) => {
        const res = await updateUserNotification({ notification_id: id, action: 'dismiss' })
        setNotifications(res.notifications)
        setUnreadCount(res.unread_count)
    }

    const handleAcceptAnimeRecommendation = async (notif: UserNotificationItem) => {
        if (!notif.anime_id) return
        try {
            await addAnimeToMyList({
                mal_id: notif.anime_id,
                status: 'pendiente',
                notes: `Recomendado por @${notif.from_username}: ${notif.message}`,
            })
            setAddedNotifIds((prev) => ({ ...prev, [notif.id]: true }))
            queryClient.invalidateQueries({ queryKey: ['my-list'] })
            const res = await updateUserNotification({ notification_id: notif.id, action: 'mark_read' })
            setNotifications(res.notifications)
            setUnreadCount(res.unread_count)
        } catch (err) {
            console.error('Error agregando anime recomendado:', err)
        }
    }

    // 2. En cuanto React termine de montar el componente, despertamos a Bootstrap 6
    useEffect(() => {
        if (overflowRef.current) {
            // Le ordenamos a Bootstrap 6 que calcule los anchos
            const instance = NavOverflow.getOrCreateInstance(overflowRef.current)

            // Función de limpieza de React al desmontar
            return () => {
                instance.dispose()
            }
        }
    }, [isAuthenticated])

    // Cierra el menú móvil cuando cambia la vista activa
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [currentView])

    const handleNavClick = (view: NonNullable<NavbarProps['currentView']>) => {
        const hash = view === 'sala' ? 'listas' : view
        window.location.hash = `#${hash}`
        onSelectView?.(view)
        setIsMobileMenuOpen(false)
    }

    const openLoginModal = () => {
        setIsMobileMenuOpen(false)
        const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
        dialog?.showModal()
    }

    return (
        <nav className="navbar navbar-expand border-bottom border-dark py-2 sticky-top glass-nav">
            <div className="container-fluid px-3 px-md-4">

                {/* Logo / Marca — Con enlace a landing page y cambio de expresión al pasar el cursor */}
                <a
                    className="navbar-brand text-decoration-none me-3 me-md-4 me-xl-5"
                    href="#landing"
                    onClick={(e) => {
                        e.preventDefault()
                        handleNavClick('landing')
                    }}
                    onMouseEnter={() => setExpression('happy')}
                    onMouseLeave={() => setExpression('normal')}
                    title="Animigos — Inicio"
                >
                    <AnimigosLogo size="md" />
                </a>

                {/* Navegación Principal — Solo en Escritorio (>= 992px) */}
                <div
                    ref={overflowRef}
                    className="nav-overflow mx-auto nav-desktop-only ps-3 ps-xl-4"
                    data-bs-toggle="nav-overflow"
                >
                    <ul className="nav navbar-nav justify-content-center gap-1">
                        {isAuthenticated && (
                            <li className="nav-item">
                                <a
                                    className={`nav-link ${currentView === 'tablon' ? 'active' : ''}`}
                                    href="#tablon"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('tablon')
                                    }}
                                >
                                    Tablón
                                </a>
                            </li>
                        )}
                        <li className="nav-item">
                            <a
                                className={`nav-link ${currentView === 'catalogo' ? 'active' : ''}`}
                                href="#catalogo"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('catalogo')
                                }}
                            >
                                Catálogo
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={`nav-link d-inline-flex align-items-center gap-1 ${currentView === 'recomendador' ? 'active' : ''}`}
                                href="#recomendador"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('recomendador')
                                }}
                            >
                                Recomendador
                            </a>
                        </li>
                        {isAuthenticated && (
                            <li className="nav-item">
                                <a
                                    className={`nav-link ${currentView === 'mi-lista' ? 'active' : ''}`}
                                    href="#mi-lista"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('mi-lista')
                                    }}
                                >
                                    Mi Lista
                                </a>
                            </li>
                        )}
                        <li className="nav-item">
                            <a
                                className={`nav-link ${currentView === 'sala' ? 'active' : ''}`}
                                href="#listas"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('sala')
                                }}
                            >
                                Listas Grupales
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={`nav-link ${currentView === 'calendario' ? 'active' : ''}`}
                                href="#calendario"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('calendario')
                                }}
                            >
                                Calendario
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Acciones del usuario a la derecha */}
                <div className="d-flex align-items-center gap-2 ms-auto ms-lg-0">
                    {/* CASO: USUARIO AUTENTICADO */}
                    {isAuthenticated && user ? (
                        <>
                            {/* Escritorio (>= 992px): Admin + Perfil + Logout */}
                            <div className="nav-desktop-only align-items-center gap-2">
                                {(user.is_staff || user.is_superuser) && (
                                    <a
                                        href="#admin"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            handleNavClick('admin')
                                        }}
                                        className={`btn btn-sm d-flex align-items-center gap-1.5 py-1 px-2.5 rounded-pill text-decoration-none transition-all ${currentView === 'admin'
                                                ? 'btn-warning text-dark fw-bold shadow-sm'
                                                : 'btn-outline-warning text-warning'
                                            }`}
                                        style={{
                                            fontSize: '0.78rem',
                                            backgroundColor: currentView === 'admin' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)',
                                            border: '1px solid rgba(245, 158, 11, 0.4)',
                                        }}
                                        title="Ir al Portal de Administración"
                                    >
                                        <ShieldCheck size={14} />
                                        <span>Admin Console</span>
                                    </a>
                                )}

                                {/* Icono de Notificaciones Accionables (a la izquierda del botón de Perfil) */}
                                <div ref={notifWrapRef} className="position-relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsNotifOpen((prev) => !prev)}
                                        className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center position-relative transition-all"
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            backgroundColor: isNotifOpen
                                                ? 'rgba(167, 139, 250, 0.2)'
                                                : 'rgba(255, 255, 255, 0.06)',
                                            border: isNotifOpen
                                                ? '1.5px solid var(--theme-acento, #a78bfa)'
                                                : '1.5px solid rgba(255, 255, 255, 0.25)',
                                            color: '#ffffff',
                                        }}
                                        title="Notificaciones y eventos pendientes"
                                        aria-label="Notificaciones"
                                        aria-expanded={isNotifOpen}
                                    >
                                        <Bell size={15} />
                                        {unreadCount > 0 && (
                                            <span
                                                className="position-absolute d-flex align-items-center justify-content-center rounded-pill fw-bold"
                                                style={{
                                                    top: '-4px',
                                                    right: '-4px',
                                                    minWidth: '17px',
                                                    height: '17px',
                                                    padding: '0 4px',
                                                    fontSize: '0.65rem',
                                                    backgroundColor: 'var(--theme-acento, #e8508f)',
                                                    color: '#09090b',
                                                    border: '2px solid #09090b',
                                                }}
                                            >
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* Popover de Notificaciones Accionables */}
                                    {isNotifOpen && (
                                        <div
                                            className="position-absolute end-0 mt-2 rounded-4 shadow-lg p-3"
                                            style={{
                                                width: '360px',
                                                maxWidth: '92vw',
                                                backgroundColor: '#121218',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                zIndex: 1080,
                                            }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom border-secondary border-opacity-25">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="fw-bold text-white small">Notificaciones</span>
                                                    {unreadCount > 0 && (
                                                        <span
                                                            className="badge rounded-pill"
                                                            style={{
                                                                background: 'rgba(167, 139, 250, 0.2)',
                                                                color: '#c4b5fd',
                                                                fontSize: '0.68rem',
                                                            }}
                                                        >
                                                            {unreadCount} {unreadCount === 1 ? 'nueva' : 'nuevas'}
                                                        </span>
                                                    )}
                                                </div>
                                                {unreadCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleMarkAllRead}
                                                        className="btn btn-link btn-sm p-0 text-decoration-none"
                                                        style={{ color: '#a78bfa', fontSize: '0.72rem' }}
                                                    >
                                                        Marcar leídas
                                                    </button>
                                                )}
                                            </div>

                                            {notifications.length === 0 ? (
                                                <div className="text-center py-4 text-secondary small">
                                                    No tienes notificaciones pendientes por ahora.
                                                </div>
                                            ) : (
                                                <div
                                                    className="d-flex flex-column gap-2"
                                                    style={{ maxHeight: '360px', overflowY: 'auto' }}
                                                >
                                                    {notifications.map((n) => {
                                                        const isAdded = Boolean(addedNotifIds[n.id])
                                                        return (
                                                            <div
                                                                key={n.id}
                                                                className="p-2.5 rounded-3 position-relative"
                                                                style={{
                                                                    background: n.read
                                                                        ? 'rgba(255, 255, 255, 0.03)'
                                                                        : 'rgba(167, 139, 250, 0.09)',
                                                                    border: n.read
                                                                        ? '1px solid rgba(255, 255, 255, 0.06)'
                                                                        : '1px solid rgba(167, 139, 250, 0.3)',
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-start gap-2.5">
                                                                    {n.type === 'anime_recommendation' && n.anime_poster ? (
                                                                        <img
                                                                            src={n.anime_poster}
                                                                            alt=""
                                                                            style={{
                                                                                width: 38,
                                                                                height: 54,
                                                                                objectFit: 'cover',
                                                                                borderRadius: 6,
                                                                                flexShrink: 0,
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div
                                                                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                                                            style={{
                                                                                width: 34,
                                                                                height: 34,
                                                                                background: 'rgba(167, 139, 250, 0.18)',
                                                                                color: '#c4b5fd',
                                                                                fontWeight: 700,
                                                                                fontSize: '0.78rem',
                                                                            }}
                                                                        >
                                                                            !
                                                                        </div>
                                                                    )}

                                                                    <div className="flex-grow-1 min-w-0">
                                                                        <div className="d-flex align-items-start justify-content-between gap-1">
                                                                            <div
                                                                                className="small text-white"
                                                                                style={{ fontSize: '0.76rem', lineHeight: 1.35 }}
                                                                            >
                                                                                <strong>{n.from_display_name || `@${n.from_username}`}</strong>{' '}
                                                                                {n.type === 'anime_recommendation' ? (
                                                                                    <>
                                                                                        te recomendó{' '}
                                                                                        <strong style={{ color: '#c4b5fd' }}>
                                                                                            {n.anime_title}
                                                                                        </strong>
                                                                                    </>
                                                                                ) : (
                                                                                    <span>{n.message}</span>
                                                                                )}
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDismissNotification(n.id)}
                                                                                className="btn btn-sm p-0 text-secondary border-0"
                                                                                title="Descartar notificación"
                                                                            >
                                                                                <X size={13} />
                                                                            </button>
                                                                        </div>

                                                                        {n.type === 'anime_recommendation' && n.message && (
                                                                            <div
                                                                                className="text-secondary mt-1"
                                                                                style={{ fontSize: '0.72rem', lineHeight: 1.35 }}
                                                                            >
                                                                                “{n.message}”
                                                                            </div>
                                                                        )}

                                                                        {/* Botones de acción directa para el evento */}
                                                                        <div className="d-flex flex-wrap align-items-center gap-1.5 mt-2">
                                                                            {n.type === 'anime_recommendation' && n.anime_id && (
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isAdded}
                                                                                    onClick={() => handleAcceptAnimeRecommendation(n)}
                                                                                    className="btn btn-sm py-0.5 px-2 rounded-2 d-inline-flex align-items-center gap-1"
                                                                                    style={{
                                                                                        background: isAdded
                                                                                            ? 'rgba(34, 197, 94, 0.2)'
                                                                                            : 'var(--theme-acento, #a78bfa)',
                                                                                        color: isAdded ? '#86efac' : '#09090b',
                                                                                        fontSize: '0.7rem',
                                                                                        fontWeight: 700,
                                                                                        border: 'none',
                                                                                    }}
                                                                                >
                                                                                    {isAdded ? (
                                                                                        <>
                                                                                            <Check size={11} /> ¡En Mi Lista!
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Plus size={11} /> Agregar a Mi Lista
                                                                                        </>
                                                                                    )}
                                                                                </button>
                                                                            )}

                                                                            {n.from_username && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setIsNotifOpen(false)
                                                                                        window.location.hash = `#perfil/${encodeURIComponent(
                                                                                            n.from_username
                                                                                        )}`
                                                                                    }}
                                                                                    className="btn btn-sm py-0.5 px-2 rounded-2 d-inline-flex align-items-center gap-1"
                                                                                    style={{
                                                                                        background: 'rgba(255, 255, 255, 0.07)',
                                                                                        color: '#e4e4e7',
                                                                                        fontSize: '0.7rem',
                                                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                                                    }}
                                                                                >
                                                                                    <ExternalLink size={10} />
                                                                                    <span>Ver perfil</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <a
                                    href="#perfil"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('perfil')
                                    }}
                                    className={`btn btn-sm d-flex align-items-center gap-2 py-1 px-3 rounded-pill text-decoration-none transition-all ${currentView === 'perfil'
                                            ? 'text-white border-0 shadow-sm'
                                            : 'btn-outline-secondary text-light'
                                        }`}
                                    style={{
                                        backgroundColor: currentView === 'perfil' ? 'var(--theme-acento, #e8508f)' : 'rgba(255,255,255,0.06)',
                                        border: currentView === 'perfil' ? 'none' : '1px solid rgba(255,255,255,0.18)',
                                        color: currentView === 'perfil' ? '#ffffff' : 'var(--bs-light)',
                                    }}
                                    title="Ver tu Perfil"
                                >
                                    {user.avatar_url && !user.avatar_url.includes('placeholder') ? (
                                        <img
                                            src={user.avatar_url}
                                            alt={user.display_name || user.username}
                                            className="rounded-circle"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                objectFit: 'cover',
                                                border: '1.5px solid rgba(255,255,255,0.4)',
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <UserIcon size={16} />
                                    )}
                                    <span
                                        className="fw-semibold small"
                                        style={{
                                            maxWidth: '150px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {user.display_name || user.username}
                                    </span>
                                </a>

                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm p-1.5 rounded-circle d-flex align-items-center justify-content-center"
                                    onClick={() => logout()}
                                    title="Cerrar sesión"
                                    style={{ width: '32px', height: '32px' }}
                                >
                                    <LogOut size={14} />
                                </button>
                            </div>

                            {/* Pantallas pequeñas (< 992px): Avatar a perfil + Menú hamburguesa */}
                            <div className="nav-mobile-only align-items-center gap-2">
                                <a
                                    href="#perfil"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('perfil')
                                    }}
                                    className="nav-mobile-avatar-btn"
                                    title={`Perfil de ${user.display_name || user.username}`}
                                >
                                    {user.avatar_url && !user.avatar_url.includes('placeholder') ? (
                                        <img
                                            src={user.avatar_url}
                                            alt={user.display_name || user.username}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <UserIcon size={16} />
                                    )}
                                </a>

                                <button
                                    type="button"
                                    className="nav-mobile-toggle-btn"
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    aria-label="Abrir menú de navegación"
                                    aria-expanded={isMobileMenuOpen}
                                >
                                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* CASO: USUARIO INVITADO (NO AUTENTICADO) */
                        <>
                            {/* Escritorio (>= 992px): 'Log in' y 'Regístrate' visibles directamente en el navbar */}
                            <div className="nav-desktop-only align-items-center gap-2">
                                <button
                                    className="btn btn-outline-light btn-sm px-3"
                                    onClick={openLoginModal}
                                >
                                    Log in
                                </button>

                                <button
                                    className="btn btn-primary btn-sm px-3"
                                    onClick={openLoginModal}
                                >
                                    Regístrate
                                </button>
                            </div>

                            {/* Pantallas pequeñas (< 992px): Botón 'Log in' VISIBLE DIRECTAMENTE EN EL NAVBAR + Menú hamburguesa */}
                            <div className="nav-mobile-only align-items-center gap-2">
                                <button
                                    className="btn btn-outline-light btn-sm px-3 py-1"
                                    style={{ fontSize: '0.85rem', fontWeight: 600 }}
                                    onClick={openLoginModal}
                                >
                                    Log in
                                </button>

                                <button
                                    type="button"
                                    className="nav-mobile-toggle-btn"
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    aria-label="Abrir menú de navegación"
                                    aria-expanded={isMobileMenuOpen}
                                >
                                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                                </button>
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* MENÚ MÓVIL DESPLEGABLE — ÚNICAMENTE EN PANTALLAS PEQUEÑAS (< 992px) */}
            {isMobileMenuOpen && (
                <div className="glass-nav-mobile-dropdown w-100 py-3 px-3 border-top border-dark position-absolute start-0 end-0 top-100">
                    <div className="d-flex flex-column gap-1">
                        {isAuthenticated && (
                            <a
                                href="#tablon"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('tablon')
                                }}
                                className={`mobile-nav-link ${currentView === 'tablon' ? 'active' : ''}`}
                            >
                                <LayoutDashboard size={18} />
                                <span>Tablón</span>
                            </a>
                        )}
                        <a
                            href="#catalogo"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('catalogo')
                            }}
                            className={`mobile-nav-link ${currentView === 'catalogo' ? 'active' : ''}`}
                        >
                            <Film size={18} />
                            <span>Catálogo</span>
                        </a>
                        <a
                            href="#recomendador"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('recomendador')
                            }}
                            className={`mobile-nav-link ${currentView === 'recomendador' ? 'active' : ''}`}
                        >
                            <Sparkles size={18} />
                            <span>Recomendador</span>
                        </a>
                        {isAuthenticated && (
                            <a
                                href="#mi-lista"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('mi-lista')
                                }}
                                className={`mobile-nav-link ${currentView === 'mi-lista' ? 'active' : ''}`}
                            >
                                <Bookmark size={18} />
                                <span>Mi Lista</span>
                            </a>
                        )}
                        <a
                            href="#listas"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('sala')
                            }}
                            className={`mobile-nav-link ${currentView === 'sala' ? 'active' : ''}`}
                        >
                            <Users size={18} />
                            <span>Listas Grupales</span>
                        </a>
                        <a
                            href="#calendario"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('calendario')
                            }}
                            className={`mobile-nav-link ${currentView === 'calendario' ? 'active' : ''}`}
                        >
                            <Calendar size={18} />
                            <span>Calendario</span>
                        </a>
                    </div>

                    <div className="border-top border-secondary border-opacity-25 my-3"></div>

                    {isAuthenticated && user ? (
                        <div className="d-flex flex-column gap-2">
                            {(user.is_staff || user.is_superuser) && (
                                <a
                                    href="#admin"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('admin')
                                    }}
                                    className={`mobile-nav-link text-warning ${currentView === 'admin' ? 'active' : ''}`}
                                >
                                    <ShieldCheck size={18} />
                                    <span>Admin Console</span>
                                </a>
                            )}

                            <a
                                href="#perfil"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('perfil')
                                }}
                                className={`mobile-nav-link ${currentView === 'perfil' ? 'active' : ''}`}
                            >
                                <UserIcon size={18} />
                                <span>Mi Perfil ({user.display_name || user.username})</span>
                            </a>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false)
                                    logout()
                                }}
                                className="btn btn-outline-danger btn-sm d-flex align-items-center justify-content-center gap-2 py-2 mt-1 rounded-3 w-100"
                            >
                                <LogOut size={16} />
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    ) : (
                        <div className="d-flex gap-2 pt-1">
                            <button
                                className="btn btn-outline-light btn-sm flex-grow-1 py-2"
                                onClick={openLoginModal}
                            >
                                Log in
                            </button>
                            <button
                                className="btn btn-primary btn-sm flex-grow-1 py-2"
                                onClick={openLoginModal}
                            >
                                Regístrate
                            </button>
                        </div>
                    )}
                </div>
            )}
        </nav>
    )
}
