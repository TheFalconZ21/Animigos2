import { useEffect, useRef } from 'react'
import { NavOverflow } from 'bootstrap'
import { LogOut, User as UserIcon, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface NavbarProps {
    currentView?: 'landing' | 'catalogo' | 'mi-lista' | 'sala' | 'tablon' | 'calendario' | 'perfil' | 'admin'
    onSelectView?: (view: 'landing' | 'catalogo' | 'mi-lista' | 'sala' | 'tablon' | 'calendario' | 'perfil' | 'admin') => void
}

export function Navbar({ currentView = 'catalogo', onSelectView }: NavbarProps) {
    const { user, isAuthenticated, logout } = useAuth()
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

    return (
        <nav className="navbar navbar-expand border-bottom border-dark py-2 sticky-top glass-nav">
            <div className="container">

                {/* Logo / Marca */}
                <a
                    className="navbar-brand fw-bold text-white fs-2xl"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault()
                        window.location.hash = '#catalogo'
                        onSelectView?.('catalogo')
                    }}
                >
                    ANIMIGOS
                </a>

                {/* 3. Conectamos la referencia con ref={overflowRef} */}
                <div
                    ref={overflowRef}
                    className="nav-overflow mx-auto"
                    data-bs-toggle="nav-overflow"
                >
                    <ul className="nav navbar-nav justify-content-center">
                        {isAuthenticated && (
                            <li className="nav-item">
                                <a
                                    className={`nav-link ${currentView === 'tablon' ? 'active' : ''}`}
                                    href="#tablon"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        window.location.hash = '#tablon'
                                        onSelectView?.('tablon')
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
                                    window.location.hash = '#catalogo'
                                    onSelectView?.('catalogo')
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
                                        window.location.hash = '#mi-lista'
                                        onSelectView?.('mi-lista')
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
                                    window.location.hash = '#listas'
                                    onSelectView?.('sala')
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
                                    window.location.hash = '#calendario'
                                    onSelectView?.('calendario')
                                }}
                            >
                                Calendario
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Botones de acción a la derecha: Perfil y Admin Console (logeado) vs Login / Registro (invitado) */}
                <div className="d-flex align-items-center gap-2">
                    {isAuthenticated && user ? (
                        <div className="d-flex align-items-center gap-2">
                            {(user.is_staff || user.is_superuser) && (
                                <a
                                    href="#admin"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        window.location.hash = '#admin'
                                        onSelectView?.('admin')
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
                                    window.location.hash = '#perfil'
                                    onSelectView?.('perfil')
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
                    ) : (
                        <>
                            <button
                                className="btn btn-outline-light btn-sm px-3"
                                onClick={() => {
                                    const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                                    dialog?.showModal()
                                }}
                            >
                                Log in
                            </button>

                            <button
                                className="btn btn-primary btn-sm px-3"
                                onClick={() => {
                                    const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
                                    dialog?.showModal()
                                }}
                            >
                                Regístrate
                            </button>
                        </>
                    )}
                </div>

            </div>
        </nav>
    )
}
