import { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { PlatformSidebar, type PlatformView } from './components/PlatformSidebar'
import { LoginModal } from './components/LoginModal'
import { HeroShowcaseBg } from './components/HeroShowcaseBg'
import { AdminPortal } from './admin/AdminPortal'
import { MiLista } from './components/mi-lista/MiLista'
import { AgendaView } from './components/agenda/AgendaView'
import { WatchPartyRoom } from './components/watch-party/WatchPartyRoom'
import { AnimeCatalog } from './components/catalogo/AnimeCatalog'
import { Tablon } from './components/tablon/Tablon'
import { Calendario } from './components/calendario/Calendario'
import { PerfilView } from './components/perfil/PerfilView'
import { RecomendadorView } from './components/recomendador/RecomendadorView'
import { TemporadasView } from './components/temporadas/TemporadasView'
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
  const [currentView, setCurrentView] = useState<PlatformView>('landing')
  const [visitedUsername, setVisitedUsername] = useState<string | undefined>(undefined)
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null)
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('')
  const [catalogInitialFilters, setCatalogInitialFilters] = useState<{
    year?: number | string | null
    season?: string | null
    genre?: string | null
    ordering?: string | null
  }>({})
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768
  })

  const handleGlobalSearch = (query: string) => {
    setCatalogSearchQuery(query)
    setSelectedAnimeId(null)
    window.location.hash = '#catalogo'
    setCurrentView('catalogo')
  }

  const handleSelectAnime = (malId: number) => {
    setSelectedAnimeId(malId)
    window.location.hash = `#anime/${malId}`
    setCurrentView('catalogo')
  }

  // Redirigir si un usuario sin permisos intenta ver secciones privadas (Tablón, Mi Lista, Agenda, Perfil, Admin)
  useEffect(() => {
    if (loading) return
    if (!isAuthenticated && (currentView === 'tablon' || currentView === 'mi-lista' || currentView === 'agenda' || currentView === 'perfil')) {
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
      } else if (hash === '#agenda' || hash === '#pendientes') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAuthenticated) {
          window.location.hash = '#catalogo'
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('agenda')
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
      } else if (hash === '#temporadas' || hash === '#seasons' || hash.startsWith('#temporadas/')) {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('temporadas')
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

  // 2. Vistas de la plataforma (incluyendo Landing, con Sidebar lateral dedicado y Navbar desaturado)
  const renderPlatformContent = () => {
    switch (currentView) {
      case 'landing':
        return (
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
        )
      case 'sala':
        return (
          <div className="py-2">
            <WatchPartyRoom />
          </div>
        )
      case 'catalogo':
        return (
          <div className="py-2">
            <AnimeCatalog
              initialAnimeId={selectedAnimeId}
              initialSearch={catalogSearchQuery}
              initialYear={catalogInitialFilters.year}
              initialSeason={catalogInitialFilters.season}
              initialGenre={catalogInitialFilters.genre}
              initialOrdering={catalogInitialFilters.ordering}
            />
          </div>
        )
      case 'recomendador':
        return (
          <div className="py-2">
            <RecomendadorView />
          </div>
        )
      case 'temporadas':
        return (
          <div className="py-2">
            <TemporadasView
              onNavigateToCatalog={({ year, season, genre, ordering }) => {
                setCatalogInitialFilters({ year, season, genre, ordering })
                setSelectedAnimeId(null)
                window.location.hash = '#catalogo'
                setCurrentView('catalogo')
              }}
              onOpenAnimeDetail={(malId) => {
                handleSelectAnime(malId)
              }}
            />
          </div>
        )
      case 'tablon':
        return <Tablon />
      case 'calendario':
        return <Calendario />
      case 'agenda':
        return (
          <div className="py-4">
            <AgendaView onOpenAnimeDetail={(malId) => handleSelectAnime(malId)} />
          </div>
        )
      case 'mi-lista':
        return (
          <div className="py-4">
            <MiLista visitedUsername={visitedUsername} />
          </div>
        )
      case 'perfil':
        return (
          <div className="py-2">
            <PerfilView visitedUsername={visitedUsername} />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="platform-layout d-flex min-vh-100">
      <PlatformSidebar
        currentView={currentView}
        onSelectView={(v) => {
          if (v === 'landing') {
            window.location.hash = ''
            setCurrentView('landing')
          } else {
            window.location.hash = `#${v}`
            setCurrentView(v)
          }
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="platform-main flex-grow-1 d-flex flex-column min-vh-100" style={{ minWidth: 0, width: '100%' }}>
        <Navbar
          currentView={currentView}
          onSelectView={setCurrentView}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          showSidebarToggle={true}
          onSelectAnime={handleSelectAnime}
          onGlobalSearch={handleGlobalSearch}
        />
        <main className="flex-grow-1" style={{ minWidth: 0 }}>
          {renderPlatformContent()}
        </main>
      </div>

      <LoginModal />
    </div>
  )
}

export default App
