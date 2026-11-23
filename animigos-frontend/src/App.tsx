import { useState, useEffect, useRef, lazy, Suspense, type ComponentType } from 'react'
import { Navbar } from './components/Navbar'
import { PlatformSidebar, type PlatformView } from './components/PlatformSidebar'
import { LoginModal } from './components/LoginModal'
import { AssociatedLinkSelectorModal } from './components/links/AssociatedLinkSelectorModal'
import { HeroShowcaseBg } from './components/HeroShowcaseBg'
import { ViewLoader } from './components/shared/ViewLoader'
import type { ProfileSubView } from './components/perfil/perfil-types'
import { useThemeAccent } from './hooks/useThemeAccent'
import { useAuth } from './context/AuthContext'
import { useCatExpression } from './hooks/useCatExpression'
import { scheduleIdleAssetPreload } from './shared/assetPreloader'
import { getCurrentPath, navigate, subscribeNavigation } from './utils/navigation'

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const storageKey = 'animigos_lazy_chunk_retry'
    try {
      const component = await factory()
      sessionStorage.removeItem(storageKey)
      return component
    } catch (error) {
      const alreadyRetried = sessionStorage.getItem(storageKey) === 'true'
      if (!alreadyRetried) {
        sessionStorage.setItem(storageKey, 'true')
        window.location.reload()
        return new Promise<{ default: T }>(() => {})
      }
      sessionStorage.removeItem(storageKey)
      throw error
    }
  })
}

const AdminPortal = lazyWithRetry(() => import('./admin/AdminPortal').then((m) => ({ default: m.AdminPortal })))
const MiLista = lazyWithRetry(() => import('./components/mi-lista/MiLista').then((m) => ({ default: m.MiLista })))
const AgendaView = lazyWithRetry(() => import('./components/agenda/AgendaView').then((m) => ({ default: m.AgendaView })))
const WatchPartyRoom = lazyWithRetry(() => import('./components/watch-party/WatchPartyRoom').then((m) => ({ default: m.WatchPartyRoom })))
const AnimeCatalog = lazyWithRetry(() => import('./components/catalogo/AnimeCatalog').then((m) => ({ default: m.AnimeCatalog })))
const Tablon = lazyWithRetry(() => import('./components/tablon/Tablon').then((m) => ({ default: m.Tablon })))
const Calendario = lazyWithRetry(() => import('./components/calendario/Calendario').then((m) => ({ default: m.Calendario })))
const PerfilView = lazyWithRetry(() => import('./components/perfil/PerfilView').then((m) => ({ default: m.PerfilView })))
const RecomendadorView = lazyWithRetry(() => import('./components/recomendador/RecomendadorView').then((m) => ({ default: m.RecomendadorView })))
const TemporadasView = lazyWithRetry(() => import('./components/temporadas/TemporadasView').then((m) => ({ default: m.TemporadasView })))
const RankingView = lazyWithRetry(() => import('./components/ranking/RankingView').then((m) => ({ default: m.RankingView })))

function isPrivatePath(path: string): boolean {
  return (
    path === '/agenda' ||
    path === '/pendientes' ||
    path === '/mi-lista' ||
    path.startsWith('/mi-lista/') ||
    path === '/tablon' ||
    path === '/dashboard' ||
    path === '/perfil' ||
    path === '/profile' ||
    path.startsWith('/perfil/') ||
    path === '/ranking' ||
    path === '/admin'
  )
}

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
  const isAdminRef = useRef(isAdmin)
  isAdminRef.current = isAdmin
  const isAuthenticatedRef = useRef(isAuthenticated)
  isAuthenticatedRef.current = isAuthenticated

  const [currentView, setCurrentView] = useState<PlatformView>('landing')
  const [profileSubView, setProfileSubView] = useState<ProfileSubView | null>(null)
  const [visitedUsername, setVisitedUsername] = useState<string | undefined>(undefined)
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null)
  const [catalogPage, setCatalogPage] = useState<number>(1)
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
    navigate('/catalogo')
    setCurrentView('catalogo')
  }

  const handleSelectAnime = (malId: number) => {
    setSelectedAnimeId(malId)
    navigate(`/anime/${malId}`)
    setCurrentView('catalogo')
  }

  // Redirigir si un usuario sin permisos intenta ver secciones privadas (Tablón, Mi Lista, Agenda, Perfil, Admin)
  useEffect(() => {
    if (loading) return
    if (!isAuthenticated && (currentView === 'tablon' || currentView === 'mi-lista' || currentView === 'agenda' || currentView === 'perfil' || currentView === 'ranking')) {
      setCurrentView('catalogo')
      navigate('/catalogo', { replace: true })
    } else if (!isAdmin && currentView === 'admin') {
      setCurrentView('catalogo')
      navigate('/catalogo', { replace: true })
    }
  }, [isAuthenticated, isAdmin, currentView, loading])

  // Soporte de navegación por rutas limpias (ej: /catalogo, /anime/<id>, /mi-lista, /mi-lista/<username>, /perfil, /perfil/<username>)
  useEffect(() => {
    if (loading) return
    const handleRoute = () => {
      const path = getCurrentPath()
      if (path.startsWith('/anime/')) {
        const rawId = Number(path.slice('/anime/'.length).trim())
        if (Number.isFinite(rawId) && rawId > 0) {
          setSelectedAnimeId(rawId)
          setVisitedUsername(undefined)
          setCurrentView('catalogo')
        }
      } else if (path === '/agenda' || path === '/pendientes') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAuthenticatedRef.current) {
          navigate('/catalogo', { replace: true })
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('agenda')
        }
      } else if (path === '/mi-lista' || path.startsWith('/mi-lista/')) {
        setSelectedAnimeId(null)
        if (!isAuthenticatedRef.current) {
          navigate('/catalogo', { replace: true })
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          const uname = path.startsWith('/mi-lista/') ? decodeURIComponent(path.slice('/mi-lista/'.length).trim()) : undefined
          setVisitedUsername(uname || undefined)
          setCurrentView('mi-lista')
        }
      } else if (path === '/tablon' || path === '/dashboard') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAuthenticatedRef.current) {
          navigate('/catalogo', { replace: true })
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('tablon')
        }
      } else if (path === '/recomendador' || path === '/recomendar') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('recomendador')
      } else if (path === '/temporadas' || path === '/seasons' || path.startsWith('/temporadas/')) {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('temporadas')
      } else if (path === '/calendario' || path === '/estrenos') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('calendario')
      } else if (path === '/ranking') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAuthenticatedRef.current) {
          navigate('/catalogo', { replace: true })
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          setCurrentView('ranking')
        }
      } else if (path === '/admin') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        if (!isAdminRef.current) {
          navigate('/catalogo', { replace: true })
          setCurrentView('catalogo')
          if (!isAuthenticatedRef.current) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
          }
        } else {
          setCurrentView('admin')
        }
      } else if (path === '/sala' || path === '/votacion' || path === '/listas' || path.startsWith('/sala/')) {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('sala')
      } else if (path === '/perfil' || path === '/profile' || path.startsWith('/perfil/')) {
        setSelectedAnimeId(null)
        if (!isAuthenticatedRef.current) {
          navigate('/catalogo', { replace: true })
          setCurrentView('catalogo')
          const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
          dialog?.showModal()
        } else {
          const uname = path.startsWith('/perfil/') ? decodeURIComponent(path.slice('/perfil/'.length).trim()) : undefined
          setVisitedUsername(uname || undefined)
          setProfileSubView(null)
          setCurrentView('perfil')
        }
      } else if (path === '/catalogo' || path === '/animes' || path === '/top') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCatalogPage(1)
        setCurrentView('catalogo')
        navigate('/catalogo/1', { replace: true })
      } else if (/^\/(?:catalogo|animes|top)\/\d+$/.test(path)) {
        const pageStr = path.split('/').pop() || '1'
        const parsedPage = Math.max(1, parseInt(pageStr, 10) || 1)
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCatalogPage(parsedPage)
        setCurrentView('catalogo')
      } else if (path === '/landing' || path === '/' || path === '') {
        setSelectedAnimeId(null)
        setVisitedUsername(undefined)
        setCurrentView('landing')
      }
    }
    handleRoute()
    return subscribeNavigation(handleRoute)
  }, [isAuthenticated, isAdmin, loading])

  // Precarga silenciosa en segundo plano de assets clave cuando el navegador queda libre
  useEffect(() => {
    scheduleIdleAssetPreload()
  }, [])

  // 1. Si estamos en modo administración, mostramos el Admin Portal completo
  if (currentView === 'admin' && isAdmin) {
    return (
      <Suspense fallback={<ViewLoader message="Cargando Admin Console..." />}>
        <AdminPortal
          onBackToLanding={() => {
            navigate('/')
            setCurrentView('landing')
          }}
        />
      </Suspense>
    )
  }

  const isCheckingPrivateRoute =
    loading && typeof window !== 'undefined' && isPrivatePath(getCurrentPath())

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
                        navigate('/sala')
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
                          navigate('/mi-lista')
                          setCurrentView('mi-lista')
                        }}
                        className="btn btn-outline-light btn-sm px-4 py-2 fw-semibold shadow-sm"
                      >
                        Explorar Mi Lista
                      </button>
                    )}
                    <a
                      href="/catalogo"
                      onClick={(e) => {
                        e.preventDefault()
                        navigate('/catalogo')
                        setCurrentView('catalogo')
                      }}
                      className="btn btn-outline-secondary btn-sm px-4 py-2"
                    >
                      Ver Catálogo
                    </a>
                  </div>
                </div>
              </header>
            </div>
          </section>
        )
      case 'sala':
        return <WatchPartyRoom />
      case 'catalogo':
        return (
          <div className="py-2">
            <AnimeCatalog
              initialAnimeId={selectedAnimeId}
              initialPage={catalogPage}
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
                navigate('/catalogo')
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
        return <Calendario onOpenAnimeDetail={(malId) => handleSelectAnime(malId)} />
      case 'ranking':
        return <RankingView />
      case 'agenda':
        return (
          <div className="py-4">
            <AgendaView onOpenAnimeDetail={(malId) => handleSelectAnime(malId)} />
          </div>
        )
      case 'mi-lista':
        return (
          <MiLista
            visitedUsername={visitedUsername}
            onOpenAnimeDetail={(malId) => handleSelectAnime(malId)}
          />
        )
      case 'perfil':
        return (
          <div className="py-2">
            <PerfilView
              visitedUsername={visitedUsername}
              activeSubView={profileSubView}
              onChangeSubView={setProfileSubView}
            />
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
          setProfileSubView(null)
          if (v === 'landing') {
            navigate('/')
            setCurrentView('landing')
          } else {
            navigate(`/${v}`)
            setCurrentView(v)
          }
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="platform-main flex-grow-1 d-flex flex-column min-vh-100" style={{ minWidth: 0, width: '100%' }}>
        <Navbar
          currentView={currentView}
          onSelectView={(v) => {
            setProfileSubView(null)
            if (v === 'perfil') {
              setVisitedUsername(undefined)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
            setCurrentView(v)
          }}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          showSidebarToggle={true}
          onSelectAnime={handleSelectAnime}
          onGlobalSearch={handleGlobalSearch}
          profileSubView={currentView === 'perfil' ? profileSubView : null}
          onBackFromProfileSubView={() => setProfileSubView(null)}
          profileUsername={visitedUsername || user?.username || 'usuario'}
        />
        <main className="flex-grow-1" style={{ minWidth: 0 }}>
          {isCheckingPrivateRoute ? (
            <ViewLoader message="Verificando tu sesión..." />
          ) : (
            <Suspense fallback={<ViewLoader />}>
              <div key={currentView} className="animigos-view-enter">
                {renderPlatformContent()}
              </div>
            </Suspense>
          )}
        </main>
      </div>

      <LoginModal />
      <AssociatedLinkSelectorModal />
    </div>
  )
}

export default App
