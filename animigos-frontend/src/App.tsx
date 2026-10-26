import { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { LoginModal } from './components/LoginModal'
import { HeroShowcaseBg } from './components/HeroShowcaseBg'
import { AdminPortal } from './admin/AdminPortal'
import { MiLista } from './components/mi-lista/MiLista'
import { WatchPartyRoom } from './components/watch-party/WatchPartyRoom'

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'mi-lista' | 'admin' | 'sala'>('landing')

  // Soporte de navegación por hash (ej: /#mi-lista, /#admin o /#sala)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash
      if (hash === '#mi-lista') {
        setCurrentView('mi-lista')
      } else if (hash === '#admin') {
        setCurrentView('admin')
      } else if (hash === '#sala' || hash === '#votacion') {
        setCurrentView('sala')
      } else if (hash === '#landing' || hash === '' || hash === '#catalogo') {
        setCurrentView('landing')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  // 1. Si estamos en modo administración, mostramos el Admin Portal completo
  if (currentView === 'admin') {
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

        {/* Switcher flotante para previsualizar el Admin Portal */}
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
      </>
    )
  }

  // 3. Si estamos en la vista "Mi Lista", renderizamos el módulo de listas personales
  if (currentView === 'mi-lista') {
    return (
      <>
        <Navbar currentView="mi-lista" onSelectView={setCurrentView} />
        <main className="py-4">
          <MiLista />
        </main>
        <LoginModal />

        {/* Switcher flotante para previsualizar el Admin Portal */}
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
      </>
    )
  }

  // 3. De lo contrario, renderizamos la Landing Page pública
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

      {/* Switcher flotante para previsualizar el Admin Portal */}
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
    </>
  )
}

export default App
