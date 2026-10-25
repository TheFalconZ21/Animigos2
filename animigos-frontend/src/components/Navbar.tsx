import { useEffect, useRef } from 'react'
import { NavOverflow } from 'bootstrap'

interface NavbarProps {
    currentView?: 'landing' | 'mi-lista'
    onSelectView?: (view: 'landing' | 'mi-lista') => void
}

export function Navbar({ currentView = 'landing', onSelectView }: NavbarProps) {
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
                {/* Usando la nueva clase de Bootstrap 6: fs-2xl */}
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
                            <a className="nav-link text-secondary" href="#votacion">Sala de Votación</a>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link text-secondary" href="#temporadas">Temporadas</a>
                        </li>
                    </ul>
                </div>

                {/* Botones de acción a la derecha */}
                <div className="d-flex gap-2">
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
                        data-bs-toggle="modal"
                        data-bs-target="#registerModal"
                    >
                        Regístrate
                    </button>
                </div>

            </div>
        </nav>
    )
}
