import { useEffect, useRef } from 'react'
import { NavOverflow } from 'bootstrap'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface NavbarProps {
    currentView?: 'landing' | 'mi-lista' | 'sala'
    onSelectView?: (view: 'landing' | 'mi-lista' | 'sala') => void
}

export function Navbar({ currentView = 'landing', onSelectView }: NavbarProps) {
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
    }, [])

    return (
        <nav className="navbar navbar-expand border-bottom border-dark py-2 sticky-top glass-nav">
            <div className="container">

                {/* Logo / Marca */}
                <a
                    className="navbar-brand fw-bold text-white fs-2xl"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault()
                        window.location.hash = ''
                        onSelectView?.('landing')
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
                        <li className="nav-item">
                            <a
                                className={`nav-link ${currentView === 'landing' ? 'active text-white' : 'text-secondary'}`}
                                href="#catalogo"
                                onClick={(e) => {
                                    e.preventDefault()
                                    window.location.hash = '#catalogo'
                                    onSelectView?.('landing')
                                }}
                            >
                                Catálogo
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={`nav-link ${currentView === 'mi-lista' ? 'active text-white' : 'text-secondary'}`}
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
                        <li className="nav-item">
                            <a
                                className={`nav-link ${currentView === 'sala' ? 'active text-white' : 'text-secondary'}`}
                                href="#sala"
                                onClick={(e) => {
                                    e.preventDefault()
                                    window.location.hash = '#sala'
                                    onSelectView?.('sala')
                                }}
                            >
                                Sala en Vivo & Watch Party
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Botones de acción a la derecha */}
                <div className="d-flex align-items-center gap-2">
                    {isAuthenticated && user ? (
                        <div className="d-flex align-items-center gap-3">
                            <div className="d-flex align-items-center gap-2">
                                <img
                                    src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                    alt={user.display_name || user.username}
                                    className="rounded-circle border border-dark"
                                    style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                    onError={(e) => {
                                        e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                                    }}
                                />
                                <span className="small text-white fw-semibold d-none d-sm-inline">
                                    {user.display_name || user.username}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-outline-danger btn-sm px-2 d-flex align-items-center gap-1"
                                onClick={() => logout()}
                                title="Cerrar sesión"
                            >
                                <LogOut size={14} />
                                <span className="d-none d-md-inline small">Salir</span>
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
