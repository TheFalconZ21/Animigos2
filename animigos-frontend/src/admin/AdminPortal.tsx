import { useState } from 'react'
import { AdminSidebar, type AdminTab } from './components/AdminSidebar'
import { OverviewPage } from './pages/OverviewPage'
import { RoomsPage } from './pages/RoomsPage'
import { AlgorithmPage } from './pages/AlgorithmPage'
import { RecommenderPage } from './pages/RecommenderPage'
import { AnimeCatalogPage } from './pages/AnimeCatalogPage'
import { UsersGrowthPage } from './pages/UsersGrowthPage'
import './admin-redesign.css'

interface AdminPortalProps {
    onBackToLanding?: () => void
    initialTab?: AdminTab
}

export function AdminPortal({ onBackToLanding, initialTab = 'overview' }: AdminPortalProps) {
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
    const [period, setPeriod] = useState('Últimos 30 días')
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    return (
        <div className="admin-root min-vh-100 d-flex">
            {/* Sidebar lateral fijo y colapsable (resuelve el cuello de botella del headbar) */}
            <AdminSidebar
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                period={period}
                onPeriodChange={setPeriod}
                onBackToLanding={onBackToLanding}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            {/* Área de trabajo central focalizada */}
            <div className="flex-grow-1 overflow-x-hidden d-flex flex-column" style={{ minWidth: 0 }}>
                {/* Barra superior de contexto mínima */}
                <header
                    className="d-flex align-items-center justify-content-between px-4 py-2.5 border-bottom sticky-top"
                    style={{
                        backgroundColor: 'rgba(10, 10, 10, 0.85)',
                        backdropFilter: 'blur(10px)',
                        borderColor: 'var(--admin-border-subtle)',
                        zIndex: 30
                    }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <span className="font-mono text-uppercase" style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', letterSpacing: '0.06em' }}>
                            Consola /
                        </span>
                        <span className="font-mono fw-semibold text-white" style={{ fontSize: '0.75rem' }}>
                            {activeTab === 'overview' && 'Pulso General & Embudo'}
                            {activeTab === 'rooms' && 'Salas de Consenso & Votación'}
                            {activeTab === 'algorithm' && 'Algoritmo de Felicidad (μ - λσ)'}
                            {activeTab === 'recommender' && 'Recomendador IA & Satisfacción'}
                            {activeTab === 'catalog' && 'Catálogo Maestro & Taxonomía'}
                            {activeTab === 'growth' && 'Crecimiento & Moderación'}
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <span className="admin-badge admin-badge-success font-mono" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                            AWS RDS ACTIVE
                        </span>
                        <span className="font-mono text-secondary small d-none d-md-inline" style={{ fontSize: '0.7rem' }}>
                            {period}
                        </span>
                    </div>
                </header>

                {/* Contenido activo con holgura visual */}
                <main className="flex-grow-1 p-3 p-md-4 p-xl-5 custom-scrollbar" style={{ maxWidth: 1400, width: '100%', margin: '0 auto' }}>
                    {activeTab === 'overview' && <OverviewPage />}
                    {activeTab === 'rooms' && <RoomsPage />}
                    {activeTab === 'algorithm' && <AlgorithmPage />}
                    {activeTab === 'recommender' && <RecommenderPage />}
                    {activeTab === 'catalog' && <AnimeCatalogPage />}
                    {activeTab === 'growth' && <UsersGrowthPage />}
                </main>
            </div>
        </div>
    )
}
