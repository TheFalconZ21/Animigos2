import { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { LoginModal } from './components/LoginModal'
import { HeroShowcaseBg } from './components/HeroShowcaseBg'
import { AdminPortal } from './admin/AdminPortal'
import { MiLista } from './components/mi-lista/MiLista'
import { WatchPartyRoom } from './components/watch-party/WatchPartyRoom'
import { AnimeCatalog } from './components/catalogo/AnimeCatalog'
import { Tablon } from './components/tablon/Tablon'
import { Calendario } from './components/calendario/Calendario'
import { PerfilView } from './components/perfil/PerfilView'
import { useThemeAccent } from './hooks/useThemeAccent'
import { useAuth } from './context/AuthContext'

function App() {
  useThemeAccent()
  const { user, isAuthenticated, loading } = useAuth()
  const isAdmin = Boolean(isAuthenticated && (user?.is_staff || user?.is_superuser))
  const [currentView, setCurrentView] = useState<'landing' | 'catalogo' | 'mi-lista' | 'admin' | 'sala' | 'tablon' | 'calendario' | 'perfil'>('catalogo')

  // Redirigir si un usuario sin permisos intenta ver secciones privadas (Tablón, Mi Lista, Perfil, Admin)
  useEffect(() => {
    if (loading) return
    if (!isAuthenticated && (currentView === 'tablon' || currentView === 'mi-lista' || currentView === 'perfil')) {
      setCurrentView('catalogo')
      window.location.hash = '#catalogo'
    } else if (!isAdmin && currentView === 'admin') {
      setCurrentView('catalogo')
      window.location.hash = '#catalogo'
    }
  }, [isAuthenticated, isAdmin, currentView, loading])

  // Soporte de navegación por hash (ej: /#catalogo, /#mi-lista, /#admin, /#sala o /#perfil)
  useEffect(() => {
    if (loading) return
    const handleHash = () => {
      const hash = window.location.hash
      if (hash === '#mi-lista') {
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('mi-lista')
        }
      } else if (hash === '#tablon' || hash === '#dashboard') {
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('tablon')
        }
      } else if (hash === '#calendario' || hash === '#estrenos') {
        setCurrentView('calendario')
      } else if (hash === '#admin') {
        if (!isAdmin) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('admin')
        }
      } else if (hash === '#sala' || hash === '#votacion' || hash === '#listas' || hash.startsWith('#sala/')) {
        setCurrentView('sala')
      } else if (hash === '#perfil' || hash === '#profile') {
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('perfil')
        }
      } else if (hash === '#landing') {
        setCurrentView('landing')
      } else if (hash === '#catalogo' || hash === '#animes' || hash === '#top' || hash === '') {
        setCurrentView('catalogo')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [isAuthenticated, isAdmin, loading])

  // Switcher flotante para la consola de administración (exclusivo para administradores)
  const renderAdminFloatingBtn = () => {
    if (!isAdmin) return null
    return (
      <div className="position-fixed bottom-0 end-0 p-3 z-3">
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#admin'
            setCurrentView('admin')
          }}
          className="admin-btn d-flex align-items-center gap-2 px-3 py-2 text-white shadow"
          style={{
            backgroundColor: '#0A0A0A',
            border: '1px solid #1F1F1F',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }}></span>
          <span>ADMIN CONSOLE (5 Vistas)</span>
        </button>
      </div>
    )
  }

  // 1. Si estamos en modo administración, mostramos el Admin Portal completo
  if (currentView === 'admin' && isAdmin) {
    return (
      <AdminPortal
        onBackToLanding={() => {
          window.location.hash = ''
          setCurrentView('landing')
        }}
      />
    )
  }

  // 2. Si estamos en la vista de Watch Party / Sala en Vivo
  if (currentView === 'sala') {
    return (
      <>
        <Navbar currentView="sala" onSelectView={setCurrentView} />
        <main className="py-2">
          <WatchPartyRoom />
        </main>
        <LoginModal />
        {renderAdminFloatingBtn()}
      </>
    )
  }

  // 3. Si estamos en la vista de Catálogo de Animes
  if (currentView === 'catalogo') {
    return (
      <>
        <Navbar currentView="catalogo" onSelectView={setCurrentView} />
        <main className="py-2">
          <AnimeCatalog />
        </main>
        <LoginModal />

        {renderAdminFloatingBtn()}
      </>
    )
  }

  // El Tablón: dashboard social (feed de amigos, noticias y salas activas)
  if (currentView === 'tablon') {
    return (
      <>
        <Navbar currentView="tablon" onSelectView={setCurrentView} />
        <main>
          <Tablon />
        </main>
        <LoginModal />
      </>
    )
  }

  // Calendario de anime: episodios de la semana y próximos lanzamientos
  if (currentView === 'calendario') {
    return (
      <>
        <Navbar currentView="calendario" onSelectView={setCurrentView} />
        <main>
          <Calendario />
        </main>
        <LoginModal />
      </>
    )
  }

  // 4. Si estamos en la vista "Mi Lista", renderizamos el módulo de listas personales
  if (currentView === 'mi-lista') {
    return (
      <>
        <Navbar currentView="mi-lista" onSelectView={setCurrentView} />
        <main className="py-4">
          <MiLista />
        </main>
        <LoginModal />

        {renderAdminFloatingBtn()}
      </>
    )
  }

  // 5. Si estamos en la vista de Perfil
  if (currentView === 'perfil') {
    return (
      <>
        <Navbar currentView="perfil" onSelectView={setCurrentView} />
        <main className="py-2">
          <PerfilView />
        </main>
        <LoginModal />

        {renderAdminFloatingBtn()}
      </>
    )
  }

  // 6. De lo contrario, renderizamos la Landing Page pública
  return (
    <>
      {/* Header de navegación público con soporte de Mi Lista */}
      <Navbar currentView="landing" onSelectView={setCurrentView} />

      {/* Sección Hero con el Showcase en el fondo */}
      <section className="position-relative overflow-hidden py-12 my-6">
        <HeroShowcaseBg />

        <div className="container mx-auto my-12 py-12 position-relative z-2">
          <header className="row justify-content-center">
            <div className="col-12 col-lg-10 text-center">
              <h1 className="hero-title fw-bold mb-2">
                {"ANIMIGOS".split("").map((letra, index) => (
                  <span key={index} className="hover-letter">
                    {letra}
                  </span>
                ))}
              </h1>
              <p className="fs-lg text-secondary mb-4">
                Descubre y vota anime en grupo con felicidad garantizada
              </p>

              {/* Botones de acción directa */}
              <div className="d-flex justify-content-center flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#sala'
                    setCurrentView('sala')
                  }}
                  className="btn btn-primary btn-sm px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-1.5"
                  style={{ backgroundColor: '#e8508f', borderColor: '#e8508f' }}
                >
                  <span>📺 Watch Party en Vivo</span>
                </button>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#mi-lista'
                      setCurrentView('mi-lista')
                    }}
                    className="btn btn-outline-light btn-sm px-4 py-2 fw-semibold shadow-sm"
                  >
                    Explorar Mi Lista
                  </button>
                )}
                <a href="#catalogo" className="btn btn-outline-secondary btn-sm px-4 py-2">
                  Ver Catálogo
                </a>
              </div>
            </div>
          </header>
        </div>
      </section>

      {/* Modal de Iniciar Sesión / Registro */}
      <LoginModal />

      {renderAdminFloatingBtn()}
    </>
  )
}

export default App
