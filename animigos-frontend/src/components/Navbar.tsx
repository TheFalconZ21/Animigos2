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
    ArrowLeft,
    History,
    CalendarCheck,
    AlertTriangle,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { AnimigosLogo } from './AnimigosLogo'
import { useCatExpression } from '../hooks/useCatExpression'
import { navigate } from '../utils/navigation'
import {
    fetchUserNotifications,
    updateUserNotification,
    respondFriendRequest,
    type UserNotificationItem,
} from '../services/friendsApi'
import { addAnimeToMyList } from '../services/userListApi'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { NavbarSearch } from './NavbarSearch'
import type { PlatformView } from './PlatformSidebar'
import type { ProfileSubView } from './perfil/perfil-types'

interface NavbarProps {
    currentView?: PlatformView
    onSelectView?: (view: PlatformView) => void
    isSidebarCollapsed?: boolean
    onToggleSidebar?: () => void
    showSidebarToggle?: boolean
    onSelectAnime?: (malId: number) => void
    onGlobalSearch?: (query: string) => void
    profileSubView?: ProfileSubView | null
    onBackFromProfileSubView?: () => void
    profileUsername?: string
}

export function Navbar({
    currentView = 'catalogo',
    onSelectView,
    isSidebarCollapsed: _isSidebarCollapsed = false,
    onToggleSidebar: _onToggleSidebar,
    showSidebarToggle = false,
    onSelectAnime,
    onGlobalSearch,
    profileSubView = null,
    onBackFromProfileSubView,
    profileUsername,
}: NavbarProps) {
    const { user, isAuthenticated, loading: authLoading, logout } = useAuth()
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
    const [handledFriendReqNotifs, setHandledFriendReqNotifs] = useState<Record<string, 'accepted' | 'rejected'>>({})
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
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al agregar recomendación'
            if (msg.includes('iniciar sesión') || msg.includes('credenciales')) {
                const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                dialog?.showModal()
            }
            console.error('Error agregando anime recomendado:', err)
        }
    }

    const handleRespondFriendRequestNotif = async (notif: UserNotificationItem, action: 'accept' | 'reject') => {
        if (!notif.request_id) return
        try {
            await respondFriendRequest(notif.request_id, action)
            setHandledFriendReqNotifs((prev) => ({
                ...prev,
                [notif.id]: action === 'accept' ? 'accepted' : 'rejected',
            }))
            const res = await updateUserNotification({ notification_id: notif.id, action: 'mark_read' })
            setNotifications(res.notifications)
            setUnreadCount(res.unread_count)
        } catch (err) {
            console.error('Error respondiendo solicitud de amistad:', err)
            const res = await updateUserNotification({ notification_id: notif.id, action: 'dismiss' })
            setNotifications(res.notifications)
            setUnreadCount(res.unread_count)
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
        const path = view === 'landing' ? '/' : view === 'sala' ? '/listas' : `/${view}`
        navigate(path)
        onSelectView?.(view)
        setIsMobileMenuOpen(false)
    }

    const openLoginModal = () => {
        setIsMobileMenuOpen(false)
        const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
        dialog?.showModal()
    }

    return (
        <nav
            className="navbar navbar-expand sticky-top glass-nav"
            style={{
                height: 64,
                minHeight: 64,
                maxHeight: 64,
                paddingTop: 0,
                paddingBottom: 0,
                boxSizing: 'border-box',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
        >
            <div className="container-fluid px-3 px-md-4 h-100 d-flex align-items-center">

                {/* Logo visible en pantallas pequeñas (< 992px) cuando el sidebar lateral está oculto */}
                <div className="d-lg-none me-2 flex-shrink-0">
                    <a
                        className="navbar-brand text-decoration-none p-0 d-flex align-items-center"
                        href="/"
                        onClick={(e) => {
                            e.preventDefault()
                            handleNavClick('landing')
                        }}
                        onMouseEnter={() => setExpression('happy')}
                        onMouseLeave={() => setExpression('normal')}
                        title="Animigos — Inicio"
                    >
                        <AnimigosLogo size="sm" showText={false} />
                    </a>
                </div>

                {/* Si estamos en modo plataforma con Sidebar */}
                {showSidebarToggle ? (
                    <div className="d-flex align-items-center gap-2">
                        {currentView === 'perfil' && profileSubView ? (
                            <div className="d-flex align-items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={onBackFromProfileSubView}
                                    className="navbar-subview-back-btn"
                                    title="Volver al Perfil"
                                    aria-label="Volver al Perfil"
                                >
                                    <ArrowLeft size={14} />
                                    <span>Volver al Perfil</span>
                                </button>

                                <div className="d-flex align-items-center gap-1.5 small d-none d-sm-flex">
                                    <span className="font-mono text-secondary" style={{ fontSize: '0.78rem' }}>
                                        @{profileUsername || user?.username || 'usuario'}
                                    </span>
                                    <span className="text-secondary opacity-50" style={{ fontSize: '0.78rem' }}>›</span>
                                    <strong className="text-white" style={{ fontSize: '0.82rem', letterSpacing: '0.01em' }}>
                                        {profileSubView === 'friends' && 'Amigos & Comunidad'}
                                        {profileSubView === 'time-watched' && 'Tiempo de Anime Visto'}
                                        {profileSubView === 'list-metrics' && 'Métricas de la Lista'}
                                        {profileSubView === 'mean-score' && 'Nota Media & Joyas Ocultas'}
                                        {profileSubView === 'favorite-genre' && 'Género Favorito, Sinergia & Tendencias'}
                                    </strong>
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex flex-column d-none d-sm-flex">
                                <span className="navbar-breadcrumb-title">
                                    {currentView === 'landing' && 'Animigos · Inicio'}
                                    {currentView === 'catalogo' && 'Catálogo de Animes'}
                                    {currentView === 'recomendador' && 'Recomendador Inteligente'}
                                    {currentView === 'temporadas' && 'Temporadas de Anime'}
                                    {currentView === 'tablon' && 'Tablón Social'}
                                    {currentView === 'calendario' && 'Calendario de Anime'}
                                    {currentView === 'agenda' && 'Agenda de Tareas'}
                                    {currentView === 'mi-lista' && 'Mi Lista Personal'}
                                    {currentView === 'sala' && 'Listas Grupales & Salas'}
                                    {currentView === 'perfil' && 'Perfil de Usuario'}
                                </span>
                                <span className="navbar-breadcrumb-subtitle d-none d-md-inline">
                                    {currentView === 'landing' && 'Descubre y vota anime en grupo'}
                                    {currentView === 'catalogo' && '26,878 series y películas indexadas'}
                                    {currentView === 'recomendador' && 'Recomendaciones por consenso y afinidad grupal'}
                                    {currentView === 'temporadas' && 'Línea de tiempo y estaciones del año'}
                                    {currentView === 'tablon' && 'Feed de amigos, noticias y watch parties en curso'}
                                    {currentView === 'calendario' && 'Horarios y emisiones de la semana'}
                                    {currentView === 'agenda' && 'Contador de capítulos pendientes en emisión'}
                                    {currentView === 'mi-lista' && 'Seguimiento personal y notas'}
                                    {currentView === 'sala' && 'Votación grupal y watch parties en vivo'}
                                    {currentView === 'perfil' && 'Estadísticas y configuración de cuenta'}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Logo / Marca — Modo Landing o barra superior clásica */
                    <a
                        className="navbar-brand text-decoration-none me-3 me-md-4 me-xl-5"
                        href="/"
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
                )}

                {/* Navegación Horizontal Clásica — SOLO cuando NO hay sidebar (ej: Landing page) */}
                {!showSidebarToggle && (
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
                                        href="/tablon"
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
                                    href="/catalogo"
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
                                    href="/recomendador"
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
                                        href="/mi-lista"
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
                                    href="/listas"
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
                                    href="/calendario"
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
                )}

                {/* Buscador Multiusos de Animes */}
                <div className="mx-2 mx-md-3 flex-grow-1 d-flex justify-content-center" style={{ maxWidth: '420px' }}>
                    <NavbarSearch
                        onSelectAnime={onSelectAnime}
                        onSearchSubmit={onGlobalSearch}
                    />
                </div>

                {/* Acciones del usuario a la derecha */}
                <div className="d-flex align-items-center gap-2 ms-auto">
                    {/* CASO: VERIFICANDO SESIÓN (SKELETON SIN PARPADEO) */}
                    {authLoading ? (
                        <div className="nav-auth-skeleton-wrap" aria-label="Verificando sesión" role="status">
                            <span className="animigos-skeleton nav-auth-skeleton-circle nav-desktop-only" />
                            <span className="animigos-skeleton nav-auth-skeleton-pill" />
                        </div>
                    ) : isAuthenticated && user ? (
                        <>
                            {/* Escritorio (>= 992px): Admin + Perfil + Logout */}
                            <div className="nav-desktop-only align-items-center gap-2">
                                {(user.is_staff || user.is_superuser) && (
                                    <a
                                        href="/admin"
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
                                        onClick={() => {
                                            setIsNotifOpen((prev) => {
                                                const next = !prev
                                                if (next && user) {
                                                    fetchUserNotifications()
                                                        .then((res) => {
                                                            if (res && res.notifications) {
                                                                setNotifications(res.notifications)
                                                                setUnreadCount(res.unread_count)
                                                            }
                                                        })
                                                        .catch(() => {})
                                                }
                                                return next
                                            })
                                        }}
                                        className={`nav-notif-trigger ${isNotifOpen ? 'is-open' : ''}`}
                                        title="Notificaciones y eventos pendientes"
                                        aria-label="Notificaciones"
                                        aria-expanded={isNotifOpen}
                                    >
                                        <Bell size={15} />
                                        {unreadCount > 0 && (
                                            <span className="nav-notif-badge">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* Popover de Notificaciones Accionables */}
                                    {isNotifOpen && (
                                        <div className="nav-notif-popover">
                                            <div className="nav-notif-header">
                                                <div className="nav-notif-header-title">
                                                    <Bell size={14} style={{ color: 'var(--theme-acento, #a78bfa)' }} />
                                                    <span>Notificaciones</span>
                                                    {unreadCount > 0 && (
                                                        <span className="nav-notif-count-pill">
                                                            {unreadCount} {unreadCount === 1 ? 'nueva' : 'nuevas'}
                                                        </span>
                                                    )}
                                                </div>
                                                {unreadCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleMarkAllRead}
                                                        className="nav-notif-markread-btn"
                                                    >
                                                        Marcar leídas
                                                    </button>
                                                )}
                                            </div>

                                            {notifications.length === 0 ? (
                                                <div className="text-center py-4 px-3 text-secondary small">
                                                    No tienes notificaciones pendientes por ahora.
                                                </div>
                                            ) : (
                                                <div className="nav-notif-list">
                                                    {notifications.map((n) => {
                                                        const isAdded = Boolean(addedNotifIds[n.id])
                                                        const isWarning = n.type === 'warning' || n.type === 'admin_warning'
                                                        const isFriendRequest = n.type === 'friend_request'
                                                        const isFriendAccepted = n.type === 'friend_accepted'
                                                        const isRoomInvite = n.type === 'room_invitation'
                                                        const isProfileComment = n.type === 'profile_comment'
                                                        const isSocialAvatarNotif =
                                                            isFriendRequest ||
                                                            isFriendAccepted ||
                                                            isRoomInvite ||
                                                            isProfileComment
                                                        const handledState = handledFriendReqNotifs[n.id]
                                                        return (
                                                            <div
                                                                key={n.id}
                                                                className={`nav-notif-card ${!n.read ? 'is-unread' : ''} ${isWarning ? 'is-warning' : ''}`}
                                                            >
                                                                <div className="nav-notif-thumb-wrap">
                                                                    {n.type === 'anime_recommendation' && n.anime_poster ? (
                                                                        <img
                                                                            src={n.anime_poster}
                                                                            alt={n.anime_title || ''}
                                                                            className="nav-notif-poster"
                                                                        />
                                                                    ) : isSocialAvatarNotif && n.from_avatar ? (
                                                                        <img
                                                                            src={resolveMediaUrl(n.from_avatar)}
                                                                            crossOrigin="anonymous"
                                                                            alt={n.from_display_name || n.from_username || ''}
                                                                            className="nav-notif-poster rounded-circle"
                                                                            style={{ height: 42, width: 42, objectFit: 'cover' }}
                                                                        />
                                                                    ) : isSocialAvatarNotif ? (
                                                                        <div className="nav-notif-avatar-fallback">
                                                                            <Users size={18} />
                                                                        </div>
                                                                    ) : isWarning ? (
                                                                        <div
                                                                            className="nav-notif-avatar-fallback warning-fallback"
                                                                            style={{
                                                                                background: 'rgba(234, 179, 8, 0.15)',
                                                                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                                color: '#facc15',
                                                                            }}
                                                                        >
                                                                            <AlertTriangle size={18} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="nav-notif-avatar-fallback">
                                                                            <Sparkles size={18} />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="nav-notif-body">
                                                                    <div className="nav-notif-top-row">
                                                                        <span className="nav-notif-eyebrow">
                                                                            {!n.read && <span className="nav-notif-unread-dot" />}
                                                                            <span style={isWarning ? { color: '#facc15', fontWeight: 700 } : undefined}>
                                                                                {n.type === 'anime_recommendation'
                                                                                    ? 'Recomendación de Anime'
                                                                                    : isFriendRequest
                                                                                    ? 'Solicitud de Amistad'
                                                                                    : isFriendAccepted
                                                                                    ? 'Nueva Amistad'
                                                                                    : isRoomInvite
                                                                                    ? 'Invitación a Lista Grupal'
                                                                                    : isProfileComment
                                                                                    ? 'Comentario en tu Muro'
                                                                                    : isWarning
                                                                                    ? 'Aviso de Moderación'
                                                                                    : 'Comunidad Animigos'}
                                                                            </span>
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDismissNotification(n.id)}
                                                                            className="nav-notif-dismiss-btn"
                                                                            title="Descartar notificación"
                                                                            aria-label="Descartar notificación"
                                                                        >
                                                                            <X size={13} />
                                                                        </button>
                                                                    </div>

                                                                    <div className="nav-notif-headline">
                                                                        {isWarning ? (
                                                                            <span className="text-warning fw-semibold">
                                                                                Has recibido una advertencia administrativa
                                                                            </span>
                                                                        ) : n.type === 'anime_recommendation' ? (
                                                                            <>
                                                                                <span className="nav-notif-user">
                                                                                    {n.from_display_name || `@${n.from_username}`}
                                                                                </span>{' '}
                                                                                te recomendó{' '}
                                                                                <span className="nav-notif-anime-title">
                                                                                    {n.anime_title}
                                                                                </span>
                                                                            </>
                                                                        ) : isSocialAvatarNotif ? (
                                                                            <>
                                                                                <span className="nav-notif-user">
                                                                                    {n.from_display_name || `@${n.from_username}`}
                                                                                </span>{' '}
                                                                                {n.message}
                                                                            </>
                                                                        ) : (
                                                                            <span>{n.message}</span>
                                                                        )}
                                                                    </div>

                                                                    {(n.type === 'anime_recommendation' || isWarning) && n.message && (
                                                                        <div
                                                                            className="nav-notif-quote"
                                                                            style={
                                                                                isWarning
                                                                                    ? {
                                                                                          borderLeftColor: '#facc15',
                                                                                          backgroundColor: 'rgba(234, 179, 8, 0.08)',
                                                                                          color: '#fef08a',
                                                                                      }
                                                                                    : undefined
                                                                            }
                                                                        >
                                                                            “{n.message}”
                                                                        </div>
                                                                    )}

                                                                    {/* Botones de acción directa para el evento */}
                                                                    <div className="nav-notif-actions">
                                                                        {isRoomInvite && n.invite_code && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setIsNotifOpen(false)
                                                                                    void updateUserNotification({
                                                                                        notification_id: n.id,
                                                                                        action: 'mark_read',
                                                                                    })
                                                                                    navigate(`/sala/${encodeURIComponent(
                                                                                        n.invite_code!
                                                                                    )}`)
                                                                                }}
                                                                                className="nav-notif-btn-primary"
                                                                            >
                                                                                <ExternalLink size={11} />
                                                                                <span>Entrar a la Sala</span>
                                                                            </button>
                                                                        )}

                                                                        {isProfileComment && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setIsNotifOpen(false)
                                                                                    void updateUserNotification({
                                                                                        notification_id: n.id,
                                                                                        action: 'mark_read',
                                                                                    })
                                                                                    navigate('/perfil')
                                                                                }}
                                                                                className="nav-notif-btn-primary"
                                                                            >
                                                                                <ExternalLink size={11} />
                                                                                <span>Ver mi muro</span>
                                                                            </button>
                                                                        )}

                                                                        {isFriendRequest && n.request_id && (
                                                                            handledState ? (
                                                                                <span className="nav-notif-btn-secondary">
                                                                                    <Check size={11} />
                                                                                    <span>
                                                                                        {handledState === 'accepted'
                                                                                            ? '¡Aceptada!'
                                                                                            : 'Rechazada'}
                                                                                    </span>
                                                                                </span>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            handleRespondFriendRequestNotif(n, 'accept')
                                                                                        }
                                                                                        className="nav-notif-btn-primary"
                                                                                    >
                                                                                        <Check size={12} />
                                                                                        <span>Aceptar</span>
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            handleRespondFriendRequestNotif(n, 'reject')
                                                                                        }
                                                                                        className="nav-notif-btn-secondary"
                                                                                    >
                                                                                        <X size={11} />
                                                                                        <span>Rechazar</span>
                                                                                    </button>
                                                                                </>
                                                                            )
                                                                        )}

                                                                        {n.type === 'anime_recommendation' && n.anime_id && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={isAdded}
                                                                                onClick={() => handleAcceptAnimeRecommendation(n)}
                                                                                className={`nav-notif-btn-primary ${
                                                                                    isAdded ? 'is-added' : ''
                                                                                }`}
                                                                            >
                                                                                {isAdded ? (
                                                                                    <>
                                                                                        <Check size={12} />
                                                                                        <span>¡En Mi Lista!</span>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Plus size={12} />
                                                                                        <span>Agregar a Mi Lista</span>
                                                                                    </>
                                                                                )}
                                                                            </button>
                                                                        )}

                                                                        {isWarning && !n.read && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDismissNotification(n.id)}
                                                                                className="nav-notif-btn-primary"
                                                                                style={{
                                                                                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                                                                    borderColor: '#facc15',
                                                                                    color: '#000',
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            >
                                                                                <Check size={12} />
                                                                                <span>Entendido</span>
                                                                            </button>
                                                                        )}

                                                                        {!isWarning && n.from_username && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setIsNotifOpen(false)
                                                                                    navigate(`/perfil/${encodeURIComponent(
                                                                                        n.from_username
                                                                                    )}`)
                                                                                }}
                                                                                className="nav-notif-btn-secondary"
                                                                            >
                                                                                <ExternalLink size={11} />
                                                                                <span>Ver perfil</span>
                                                                            </button>
                                                                        )}
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
                                    href="/perfil"
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
                                            src={resolveMediaUrl(user.avatar_url)}
                                            crossOrigin="anonymous"
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
                                    href="/perfil"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('perfil')
                                    }}
                                    className="nav-mobile-avatar-btn"
                                    title={`Perfil de ${user.display_name || user.username}`}
                                >
                                    {user.avatar_url && !user.avatar_url.includes('placeholder') ? (
                                        <img
                                            src={resolveMediaUrl(user.avatar_url)}
                                            crossOrigin="anonymous"
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
                                href="/tablon"
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
                            href="/calendario"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('calendario')
                            }}
                            className={`mobile-nav-link ${currentView === 'calendario' ? 'active' : ''}`}
                        >
                            <Calendar size={18} />
                            <span>Calendario</span>
                        </a>
                        {isAuthenticated && (
                            <a
                                href="/agenda"
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleNavClick('agenda')
                                }}
                                className={`mobile-nav-link ${currentView === 'agenda' ? 'active' : ''}`}
                            >
                                <CalendarCheck size={18} />
                                <span>Agenda</span>
                            </a>
                        )}
                        <a
                            href="/listas"
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
                            href="/catalogo"
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
                            href="/recomendador"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('recomendador')
                            }}
                            className={`mobile-nav-link ${currentView === 'recomendador' ? 'active' : ''}`}
                        >
                            <Sparkles size={18} />
                            <span>Recomendador</span>
                        </a>
                        <a
                            href="/temporadas"
                            onClick={(e) => {
                                e.preventDefault()
                                handleNavClick('temporadas')
                            }}
                            className={`mobile-nav-link ${currentView === 'temporadas' ? 'active' : ''}`}
                        >
                            <History size={18} />
                            <span>Temporadas</span>
                        </a>
                        {isAuthenticated && (
                            <a
                                href="/mi-lista"
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
                    </div>

                    <div className="border-top border-secondary border-opacity-25 my-3"></div>

                    {isAuthenticated && user ? (
                        <div className="d-flex flex-column gap-2">
                            {(user.is_staff || user.is_superuser) && (
                                <a
                                    href="/admin"
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
                                href="/perfil"
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
