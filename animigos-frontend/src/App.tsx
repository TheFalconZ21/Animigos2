import { useState } from 'react'
import { Navbar } from './components/Navbar'
import { LoginModal } from './components/LoginModal'
import { HeroShowcaseBg } from './components/HeroShowcaseBg'
import { AdminPortal } from './admin/AdminPortal'

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'admin'>('landing')

  // Si estamos en modo administración, mostramos el Admin Portal completo
  if (currentView === 'admin') {
    return <AdminPortal onBackToLanding={() => setCurrentView('landing')} />
  }

  // De lo contrario, renderizamos la Landing Page pública
  return (
    <>
      {/* 1. Header de navegación público */}
      <Navbar />

      {/* 2. Sección Hero con el Showcase en el fondo */}
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
              <p className="fs-lg text-secondary mb-0">
                Descubre y vota anime en grupo con felicidad garantizada
              </p>
            </div>
          </header>
        </div>
      </section>

      {/* 3. Modal de Iniciar Sesión / Registro */}
      <LoginModal />

      {/* 4. Switcher flotante para previsualizar el Admin Portal */}
      <div className="position-fixed bottom-0 end-0 p-3 z-3">
        <button
          type="button"
          onClick={() => setCurrentView('admin')}
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
