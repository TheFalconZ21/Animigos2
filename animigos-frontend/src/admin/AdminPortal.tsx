import { useState } from 'react'
import { AdminNav, type AdminTab } from './components/AdminNav'
import { OverviewPage } from './pages/OverviewPage'
import { RoomsPage } from './pages/RoomsPage'
import { AlgorithmPage } from './pages/AlgorithmPage'
import { AnimeCatalogPage } from './pages/AnimeCatalogPage'
import { UsersGrowthPage } from './pages/UsersGrowthPage'

interface AdminPortalProps {
    onBackToLanding?: () => void
    initialTab?: AdminTab
}

export function AdminPortal({ onBackToLanding, initialTab = 'overview' }: AdminPortalProps) {
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
    const [period, setPeriod] = useState('Últimos 30 días')

    return (
        <div className="admin-root min-vh-100 px-3 px-md-4 px-xl-5 py-4">
            <div className="admin-layout-container">
                {/* Navegación común y persistente entre vistas */}
                <AdminNav
                    activeTab={activeTab}
                    onSelectTab={setActiveTab}
                    period={period}
                    onPeriodChange={setPeriod}
                    onBackToLanding={onBackToLanding}
                />

                {/* Renderizado de la vista de administración activa */}
                <main>
                    {activeTab === 'overview' && <OverviewPage />}
                    {activeTab === 'rooms' && <RoomsPage />}
                    {activeTab === 'algorithm' && <AlgorithmPage />}
                    {activeTab === 'catalog' && <AnimeCatalogPage />}
                    {activeTab === 'growth' && <UsersGrowthPage />}
                </main>
            </div>
        </div>
    )
}
