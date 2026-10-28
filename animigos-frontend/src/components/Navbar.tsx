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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AnimigosLogo } from './AnimigosLogo'

interface NavbarProps {
    currentView?: 'landing' | 'catalogo' | 'mi-lista' | 'sala' | 'tablon' | 'calendario' | 'perfil' | 'admin'
    onSelectView?: (view: 'landing' | 'catalogo' | 'mi-lista' | 'sala' | 'tablon' | 'calendario' | 'perfil' | 'admin') => void
}

export function Navbar({ currentView = 'catalogo', onSelectView }: NavbarProps) {
    const { user, isAuthenticated, logout } = useAuth()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    // 1. Creamos la referencia al contenedor del overflow
    const overflowRef = useRef<HTMLDivElement>(null)

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

                {/* Logo / Marca — Con enlace a landing page y mayor separación de las secciones */}
                <a
                    className="navbar-brand text-decoration-none me-3 me-md-4 me-xl-5"
                    href="#landing"
                    onClick={(e) => {
                        e.preventDefault()
                        handleNavClick('landing')
                    }}
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
                                        className={`btn btn-sm d-flex align-items-center gap-1.5 py-1 px-2.5 rounded-pill text-decoration-none transition-all ${
                                            currentView === 'admin'
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

                                <a
                                    href="#perfil"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleNavClick('perfil')
                                    }}
                                    className={`btn btn-sm d-flex align-items-center gap-2 py-1 px-3 rounded-pill text-decoration-none transition-all ${
                                        currentView === 'perfil'
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
