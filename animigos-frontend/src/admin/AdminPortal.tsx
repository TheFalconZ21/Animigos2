import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowLeft, ChevronRight, Search, X, CornerDownLeft } from 'lucide-react'
import { AdminSidebar, type AdminTab } from './components/AdminSidebar'
import {
    AdminNavProvider,
    useAdminNav,
    ADMIN_SEARCH_INDEX,
    type SearchableAdminEntry
} from './components/AdminSubViewBar'
import { OverviewPage } from './pages/OverviewPage'
import { RoomsPage } from './pages/RoomsPage'
import { AlgorithmPage } from './pages/AlgorithmPage'
import { RecommenderPage } from './pages/RecommenderPage'
import { RatingsPage } from './pages/RatingsPage'
import { AnimeCatalogPage } from './pages/AnimeCatalogPage'
import { UsersPage } from './pages/UsersPage'
import { GrowthPage } from './pages/GrowthPage'
import { ModerationPage } from './pages/ModerationPage'
import './admin-redesign.css'

export interface CorrelativeContext {
    fromTab: AdminTab
    fromTitle: string
    metricLabel: string
}

interface AdminPortalProps {
    onBackToLanding?: () => void
    initialTab?: AdminTab
}

const TAB_LABELS: Record<AdminTab, string> = {
    overview: 'Pulso General',
    rooms: 'Salas & Votación',
    algorithm: 'Consenso Grupal',
    recommender: 'Recomendador IA',
    ratings: 'Calificaciones',
    catalog: 'Catálogo de Animes',
    users: 'Usuarios & Demografía',
    growth: 'Crecimiento & Adopción',
    moderation: 'Centro de Moderación'
}

const TAB_CATEGORIES: Record<AdminTab, string> = {
    overview: 'Telemetría & Operación',
    rooms: 'Telemetría & Operación',
    algorithm: 'Motores & Algoritmos',
    recommender: 'Motores & Algoritmos',
    ratings: 'Motores & Algoritmos',
    catalog: 'Motores & Algoritmos',
    users: 'Audiencia & Comunidad',
    growth: 'Audiencia & Comunidad',
    moderation: 'Audiencia & Comunidad'
}

interface AdminStickyHeadbarProps {
    activeTab: AdminTab
    correlativeBridge: CorrelativeContext | null
    onReturnToOrigin: () => void
    onSelectSearchEntry: (entry: SearchableAdminEntry) => void
}

function AdminStickyHeadbar({
    activeTab,
    correlativeBridge,
    onReturnToOrigin,
    onSelectSearchEntry
}: AdminStickyHeadbarProps) {
    const navCtx = useAdminNav()
    const subViewMeta = navCtx?.subViewMeta || null

    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIdx, setHighlightIdx] = useState(0)
    const searchWrapperRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const results = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) {
            return ADMIN_SEARCH_INDEX.slice(0, 10)
        }
        return ADMIN_SEARCH_INDEX.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.sectionLabel.toLowerCase().includes(q) ||
            item.keywords.toLowerCase().includes(q)
        ).slice(0, 12)
    }, [query])

    useEffect(() => {
        setHighlightIdx(0)
    }, [results])

    // Atajo global Ctrl+K / Cmd+K para enfocar el buscador de secciones y sub-vistas
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                inputRef.current?.focus()
                setIsOpen(true)
            }
        }
        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [])

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleTriggerEntry = (entry: SearchableAdminEntry) => {
        onSelectSearchEntry(entry)
        setIsOpen(false)
        setQuery('')
        inputRef.current?.blur()
    }

    return (
        <header className="admin-sticky-headbar">
            <div className="admin-sticky-headbar-inner">
                {/* Izquierda: Botón Volver + Ruta de Sub-Vista o Sección (Sin el tag "Sub-Vista") */}
                <div className="d-flex flex-wrap align-items-center gap-3">
                    {subViewMeta ? (
                        <>
                            <button
                                type="button"
                                onClick={subViewMeta.onBack}
                                className="admin-back-btn"
                                title="Regresar al panorama principal de la sección (Esc)"
                            >
                                <ArrowLeft size={15} />
                                <span>Volver al Panorama</span>
                            </button>

                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    onClick={subViewMeta.onBack}
                                    className="bg-transparent border-0 p-0"
                                    style={{ color: 'var(--admin-text-secondary)', fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer' }}
                                >
                                    {subViewMeta.sectionTitle}
                                </button>
                                <ChevronRight size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                <strong style={{ color: 'var(--admin-text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                                    {subViewMeta.subViewLabel}
                                </strong>
                            </div>
                        </>
                    ) : correlativeBridge ? (
                        <>
                            <button
                                type="button"
                                onClick={onReturnToOrigin}
                                className="admin-back-btn"
                            >
                                <ArrowLeft size={15} />
                                <span>Volver a {correlativeBridge.fromTitle}</span>
                            </button>

                            <div className="d-flex align-items-center gap-2">
                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.86rem', fontWeight: 500 }}>
                                    {correlativeBridge.fromTitle}
                                </span>
                                <ChevronRight size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                <strong style={{ color: 'var(--admin-text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                                    {TAB_LABELS[activeTab]}
                                </strong>
                                <span className="admin-badge admin-badge-info">{correlativeBridge.metricLabel}</span>
                            </div>
                        </>
                    ) : (
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.82rem', fontWeight: 500 }}>
                                {TAB_CATEGORIES[activeTab]}
                            </span>
                            <ChevronRight size={14} style={{ color: 'var(--admin-text-muted)' }} />
                            <strong style={{ color: 'var(--admin-text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                                {TAB_LABELS[activeTab]}
                            </strong>
                        </div>
                    )}
                </div>

                {/* Derecha: Buscador Global de Secciones y Sub-Vistas */}
                <div ref={searchWrapperRef} className="position-relative" style={{ minWidth: 310, maxWidth: 380, width: '100%' }}>
                    <div className={`admin-headbar-search-box ${isOpen ? 'focused' : ''}`}>
                        <Search size={15} style={{ color: 'var(--admin-focus)', flexShrink: 0 }} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar sección o sub-vista... (Ctrl+K)"
                            value={query}
                            onFocus={() => setIsOpen(true)}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                setIsOpen(true)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault()
                                    setHighlightIdx(prev => (results.length > 0 ? (prev + 1) % results.length : 0))
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault()
                                    setHighlightIdx(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0))
                                } else if (e.key === 'Enter' && results[highlightIdx]) {
                                    e.preventDefault()
                                    handleTriggerEntry(results[highlightIdx])
                                } else if (e.key === 'Escape') {
                                    setIsOpen(false)
                                    inputRef.current?.blur()
                                }
                            }}
                            className="bg-transparent border-0 text-white w-100"
                            style={{ fontSize: '0.82rem', outline: 'none' }}
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('')
                                    inputRef.current?.focus()
                                }}
                                className="bg-transparent border-0 p-0 d-flex align-items-center"
                                style={{ color: 'var(--admin-text-muted)' }}
                            >
                                <X size={14} />
                            </button>
                        ) : (
                            <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface-1)', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--admin-border-subtle)' }}>
                                Ctrl+K
                            </span>
                        )}
                    </div>

                    {isOpen && (
                        <div className="admin-headbar-search-dropdown custom-scrollbar">
                            <div className="px-3 py-1.5 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.7rem', color: 'var(--admin-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span>{query.trim() ? `Resultados (${results.length})` : 'Acceso Rápido a Secciones y Sub-Vistas'}</span>
                                <span>↵ Ir</span>
                            </div>

                            {results.length === 0 ? (
                                <div className="p-3 text-center" style={{ color: 'var(--admin-text-muted)', fontSize: '0.82rem' }}>
                                    No se encontraron secciones ni sub-vistas para "{query}"
                                </div>
                            ) : (
                                <div className="p-1.5 d-flex flex-column gap-1">
                                    {results.map((entry, idx) => {
                                        const isHighlighted = idx === highlightIdx
                                        return (
                                            <button
                                                key={entry.id}
                                                type="button"
                                                onMouseEnter={() => setHighlightIdx(idx)}
                                                onClick={() => handleTriggerEntry(entry)}
                                                className={`admin-headbar-search-item ${isHighlighted ? 'active' : ''}`}
                                            >
                                                <div className="d-flex align-items-center gap-2 overflow-hidden">
                                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                        {entry.sectionLabel}
                                                    </span>
                                                    {entry.subViewId && (
                                                        <>
                                                            <ChevronRight size={12} style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }} />
                                                            <strong className="text-truncate" style={{ color: 'var(--admin-text-primary)', fontSize: '0.82rem' }}>
                                                                {entry.title}
                                                            </strong>
                                                        </>
                                                    )}
                                                    {!entry.subViewId && (
                                                        <span className="admin-badge admin-badge-neutral" style={{ fontSize: '0.66rem', padding: '0.12rem 0.45rem' }}>
                                                            Panorama Vital
                                                        </span>
                                                    )}
                                                </div>
                                                <CornerDownLeft size={13} style={{ color: isHighlighted ? 'var(--admin-focus)' : 'var(--admin-text-muted)', flexShrink: 0 }} />
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}

export function AdminPortal({ onBackToLanding, initialTab = 'overview' }: AdminPortalProps) {
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
    const [activeSubViewId, setActiveSubViewId] = useState<string | null>(null)
    const [period, setPeriod] = useState('Últimos 30 días')
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [correlativeBridge, setCorrelativeBridge] = useState<CorrelativeContext | null>(null)

    // Cambio No Correlativo desde el menú lateral
    const handleSidebarSelectTab = (tab: AdminTab) => {
        setCorrelativeBridge(null)
        setActiveSubViewId(null)
        setActiveTab(tab)
    }

    // Salto Correlativo entre módulos
    const handleNavigateCorrelative = (targetTab: AdminTab, metricLabel?: string) => {
        if (targetTab !== activeTab) {
            setCorrelativeBridge({
                fromTab: activeTab,
                fromTitle: TAB_LABELS[activeTab],
                metricLabel: metricLabel || 'Métrica vinculada'
            })
            setActiveSubViewId(null)
            setActiveTab(targetTab)
        }
    }

    const handleReturnToOrigin = () => {
        if (!correlativeBridge) return
        const target = correlativeBridge.fromTab
        setCorrelativeBridge(null)
        setActiveSubViewId(null)
        setActiveTab(target)
    }

    const handleSelectSearchEntry = (entry: SearchableAdminEntry) => {
        setCorrelativeBridge(null)
        setActiveTab(entry.tab)
        setActiveSubViewId(entry.subViewId || null)
    }

    return (
        <AdminNavProvider activeSubViewId={activeSubViewId} setActiveSubViewId={setActiveSubViewId}>
            <div className="admin-root min-vh-100 d-flex">
                <AdminSidebar
                    activeTab={activeTab}
                    onSelectTab={handleSidebarSelectTab}
                    period={period}
                    onPeriodChange={setPeriod}
                    onBackToLanding={onBackToLanding}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />

                <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0, overflowX: 'clip' }}>
                    <AdminStickyHeadbar
                        activeTab={activeTab}
                        correlativeBridge={correlativeBridge}
                        onReturnToOrigin={handleReturnToOrigin}
                        onSelectSearchEntry={handleSelectSearchEntry}
                    />

                    <main
                        key={activeTab}
                        className="admin-main-workspace custom-scrollbar admin-anim-section"
                    >
                        {activeTab === 'overview' && <OverviewPage onNavigateTab={handleNavigateCorrelative} />}
                        {activeTab === 'rooms' && <RoomsPage />}
                        {activeTab === 'algorithm' && <AlgorithmPage />}
                        {activeTab === 'recommender' && <RecommenderPage onNavigateTab={handleNavigateCorrelative} />}
                        {activeTab === 'ratings' && <RatingsPage />}
                        {activeTab === 'catalog' && <AnimeCatalogPage />}
                        {activeTab === 'users' && <UsersPage />}
                        {activeTab === 'growth' && <GrowthPage />}
                        {activeTab === 'moderation' && <ModerationPage />}
                    </main>
                </div>
            </div>
        </AdminNavProvider>
    )
}
