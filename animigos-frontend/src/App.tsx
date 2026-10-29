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
import { RecomendadorView } from './components/recomendador/RecomendadorView'
import { useThemeAccent } from './hooks/useThemeAccent'
import { useAuth } from './context/AuthContext'
import { useCatExpression } from './hooks/useCatExpression'

function App() {
  useThemeAccent()
  const { user, isAuthenticated, loading } = useAuth()
  const { isHappy: isCatHappy, setExpression: setCatExpression } = useCatExpression()
  const [isHeroCatBouncing, setIsHeroCatBouncing] = useState(false)

  const handleHeroCatClick = () => {
    setIsHeroCatBouncing(true)
    setTimeout(() => setIsHeroCatBouncing(false), 450)
  }

  const isAdmin = Boolean(isAuthenticated && (user?.is_staff || user?.is_superuser))
  const [currentView, setCurrentView] = useState<'landing' | 'catalogo' | 'recomendador' | 'mi-lista' | 'admin' | 'sala' | 'tablon' | 'calendario' | 'perfil'>('landing')
  const [visitedUsername, setVisitedUsername] = useState<string | undefined>(undefined)
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null)

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

  // Soporte de navegación por hash (ej: /#catalogo, /#anime/<id>, /#mi-lista, /#mi-lista/<username>, /#perfil, /#perfil/<username>)
  useEffect(() => {
    if (loading) return
    const handleHash = () => {
      const hash = window.location.hash
      if (hash.startsWith('#anime/')) {
        const rawId = Number(hash.slice('#anime/'.length).trim())
        if (Number.isFinite(rawId) && rawId > 0) {
          setSelectedAnimeId(rawId)
          setVisitedUsername(undefined)
          setCurrentView('catalogo')
        }
      } else if (hash === '#mi-lista' || hash.startsWith('#mi-lista/')) {
        setSelectedAnimeId(null)
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          const uname = hash.startsWith('#mi-lista/') ? decodeURIComponent(hash.slice('#mi-lista/'.length).trim()) : undefined
          setVisitedUsername(uname || undefined)
          setCurrentView('mi-lista')
        }
      } else if (hash === '#tablon' || hash === '#dashboard') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('tablon')
        }
      } else if (hash === '#recomendador' || hash === '#recomendar') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('recomendador')
      } else if (hash === '#calendario' || hash === '#estrenos') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('calendario')
      } else if (hash === '#admin') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAdmin) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('admin')
        }
      } else if (hash === '#sala' || hash === '#votacion' || hash === '#listas' || hash.startsWith('#sala/')) {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('sala')
      } else if (hash === '#perfil' || hash === '#profile' || hash.startsWith('#perfil/')) {
        setSelectedAnimeId(null)
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          const uname = hash.startsWith('#perfil/') ? decodeURIComponent(hash.slice('#perfil/'.length).trim()) : undefined
          setVisitedUsername(uname || undefined)
          setCurrentView('perfil')
        }
      } else if (hash === '#catalogo' || hash === '#animes' || hash === '#top') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('catalogo')
      } else if (hash === '#landing' || hash === '' || hash === '#') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('landing')
      }
    }
    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [isAuthenticated, isAdmin, loading])


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
      </>
    )
  }

  // 3. Si estamos en la vista de Catálogo de Animes
  if (currentView === 'catalogo') {
    return (
      <>
        <Navbar currentView="catalogo" onSelectView={setCurrentView} />
        <main className="py-2">
          <AnimeCatalog initialAnimeId={selectedAnimeId} />
        </main>
        <LoginModal />

      </>
    )
  }

  // 3b. Si estamos en la vista del Recomendador Híbrido
  if (currentView === 'recomendador') {
    return (
      <>
        <Navbar currentView="recomendador" onSelectView={setCurrentView} />
        <main className="py-2">
          <RecomendadorView />
        </main>
        <LoginModal />
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
          <MiLista visitedUsername={visitedUsername} />
        </main>
        <LoginModal />

      </>
    )
  }

  // 5. Si estamos en la vista de Perfil
  if (currentView === 'perfil') {
    return (
      <>
        <Navbar currentView="perfil" onSelectView={setCurrentView} />
        <main className="py-2">
          <PerfilView visitedUsername={visitedUsername} />
        </main>
        <LoginModal />

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
                {"Animig".split("").map((letra, index) => (
                  <span key={index} className="hover-letter">
                    {letra}
                  </span>
                ))}
                <span
                  className={`hero-cat-wrapper ${isHeroCatBouncing ? 'hero-cat-wrapper--bouncing' : ''}`}
                  onMouseEnter={() => setCatExpression('happy')}
                  onMouseLeave={() => setCatExpression('normal')}
                  onClick={handleHeroCatClick}
                  title="¡Haz clic en mí para cambiar mi expresión! 🐱"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleHeroCatClick()
                    }
                  }}
                >
                  <img
                    src={isCatHappy ? '/logo2-cat-white.png' : '/logo-cat-white.png'}
                    alt={isCatHappy ? 'o feliz (> ▽ <)' : 'o (u w u)'}
                    className="hero-cat-img"
                    draggable={false}
                  />
                </span>
                <span className="hover-letter">s</span>
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
    </>
  )
}

export default App
