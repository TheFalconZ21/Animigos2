import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AdminTab } from './AdminSidebar'

export interface SubViewOption<T extends string = string> {
    id: T
    label: string
    badge?: string
}

export interface SearchableAdminEntry {
    id: string
    tab: AdminTab
    sectionLabel: string
    categoryLabel: string
    subViewId?: string
    title: string
    keywords: string
}

export const ADMIN_SEARCH_INDEX: SearchableAdminEntry[] = [
    // 1. Pulso General
    { id: 'sec-overview', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Telemetría & Operación', title: 'Pulso General (Panorama Vital)', keywords: 'overview embudo conversion pulso general kpis' },
    { id: 'sub-ov-guests', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Sub-Vista', subViewId: 'guests', title: '1. Sesiones e Invitaciones Creadas', keywords: 'invitados sesiones lobby pin entrada' },
    { id: 'sub-ov-joined', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Sub-Vista', subViewId: 'joined', title: '2. Sincronizados en Sala Activa', keywords: 'unidos sala activa websockets' },
    { id: 'sub-ov-voted', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Sub-Vista', subViewId: 'voted', title: '3. Quórum de Votación Emitido', keywords: 'quorum votos cuello botella espera' },
    { id: 'sub-ov-winner', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Sub-Vista', subViewId: 'winner', title: '4. Consenso Logrado (Anime Ganador)', keywords: 'consenso ganador tasa exito' },
    { id: 'sub-ov-ttc', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Sub-Vista', subViewId: 'ttc-breakdown', title: 'Velocidad a Decisión (TTC)', keywords: 'tiempo velocidad ttc minutos tamaño grupo' },
    { id: 'sub-ov-infra', tab: 'overview', sectionLabel: 'Pulso General', categoryLabel: 'Sub-Vista', subViewId: 'infra-health', title: 'Salud AWS & Base de Datos PostgreSQL', keywords: 'aws rds postgresql latencia ping servidor' },

    // 2. Salas & Votación
    { id: 'sec-rooms', tab: 'rooms', sectionLabel: 'Salas & Votación', categoryLabel: 'Telemetría & Operación', title: 'Salas & Votación (Panorama Vital)', keywords: 'salas watch party votacion fases donut' },
    { id: 'sub-rm-dir', tab: 'rooms', sectionLabel: 'Salas & Votación', categoryLabel: 'Sub-Vista', subViewId: 'directory', title: 'Directorio y Moderación de Salas', keywords: 'directorio tabla salas buscar pausar eliminar' },
    { id: 'sub-rm-insp', tab: 'rooms', sectionLabel: 'Salas & Votación', categoryLabel: 'Sub-Vista', subViewId: 'room-inspector', title: 'Inspector de Sala y Quórum', keywords: 'inspector detalle candidatos miembros forzar consenso' },
    { id: 'sub-rm-clean', tab: 'rooms', sectionLabel: 'Salas & Votación', categoryLabel: 'Sub-Vista', subViewId: 'cleanup-policy', title: 'Política de Purga de Salas Inactivas', keywords: 'limpieza purga inactivas mantenimiento' },
    { id: 'sub-rm-create', tab: 'rooms', sectionLabel: 'Salas & Votación', categoryLabel: 'Sub-Vista', subViewId: 'create-room', title: 'Crear Nueva Sala de Consenso', keywords: 'crear nueva sala instanciar host' },

    // 3. Consenso Grupal
    { id: 'sec-algo', tab: 'algorithm', sectionLabel: 'Consenso Grupal', categoryLabel: 'Motores & Algoritmos', title: 'Consenso Grupal (Panorama Vital)', keywords: 'algoritmo felicidad dispersion lambda consenso' },
    { id: 'sub-al-lab', tab: 'algorithm', sectionLabel: 'Consenso Grupal', categoryLabel: 'Sub-Vista', subViewId: 'calibration-lab', title: 'Laboratorio de Pesos (6 Sliders)', keywords: 'sliders calibrar pesos lambda media mal afinidad' },
    { id: 'sub-al-rules', tab: 'algorithm', sectionLabel: 'Consenso Grupal', categoryLabel: 'Sub-Vista', subViewId: 'consensus-rules', title: 'Reglas de Consenso y Filtro Antiveto', keywords: 'reglas antiveto supermayoria desempate' },
    { id: 'sub-al-sim', tab: 'algorithm', sectionLabel: 'Consenso Grupal', categoryLabel: 'Sub-Vista', subViewId: 'simulator', title: 'Simulador Reactivo en Vivo', keywords: 'simulador pruebas votos amigos calculo' },

    // 4. Recomendador IA
    { id: 'sec-rec', tab: 'recommender', sectionLabel: 'Recomendador IA', categoryLabel: 'Motores & Algoritmos', title: 'Recomendador IA (Panorama Vital)', keywords: 'recomendador ia ab testing veredictos dona' },
    { id: 'sub-rc-sat', tab: 'recommender', sectionLabel: 'Recomendador IA', categoryLabel: 'Sub-Vista', subViewId: 'satisfaction', title: 'Top Valoraciones & Análisis de Intención', keywords: 'top animes mejor valorados obras semilla intencion' },
    { id: 'sub-rc-conv', tab: 'recommender', sectionLabel: 'Recomendador IA', categoryLabel: 'Sub-Vista', subViewId: 'conversion', title: 'Conversión a Lista / Sesión', keywords: 'conversion mi lista watch party retencion' },
    { id: 'sub-rc-pref', tab: 'recommender', sectionLabel: 'Recomendador IA', categoryLabel: 'Sub-Vista', subViewId: 'preferences', title: 'Criterio: Similitud vs Gustos', keywords: 'similitud gustos perfil patrones busqueda' },
    { id: 'sub-rc-vol', tab: 'recommender', sectionLabel: 'Recomendador IA', categoryLabel: 'Sub-Vista', subViewId: 'volume', title: 'Segmentación de Volumen', keywords: 'volumen personal 1:1 grupal sesiones' },

    // 5. Calificaciones
    { id: 'sec-rat', tab: 'ratings', sectionLabel: 'Calificaciones', categoryLabel: 'Motores & Algoritmos', title: 'Calificaciones (Panorama Vital)', keywords: 'calificaciones estrellas notas histograma' },
    { id: 'sub-rt-exp', tab: 'ratings', sectionLabel: 'Calificaciones', categoryLabel: 'Sub-Vista', subViewId: 'explorer', title: 'Explorador Nominal de Notas', keywords: 'explorador notas individuales usuarios tabla estrellas' },
    { id: 'sub-rt-acc', tab: 'ratings', sectionLabel: 'Calificaciones', categoryLabel: 'Sub-Vista', subViewId: 'accuracy-cross', title: 'Cruce: Predicción IA vs Nota Real', keywords: 'precision prediccion afinidad falsos positivos' },

    // 6. Catálogo de Animes
    { id: 'sec-cat', tab: 'catalog', sectionLabel: 'Catálogo de Animes', categoryLabel: 'Motores & Algoritmos', title: 'Catálogo de Animes (Panorama Vital)', keywords: 'catalogo animes generos taxonomia win-rate' },
    { id: 'sub-ct-grid', tab: 'catalog', sectionLabel: 'Catálogo de Animes', categoryLabel: 'Sub-Vista', subViewId: 'catalog-grid', title: 'Explorador de Catálogo', keywords: 'buscar editar animes series posters' },
    { id: 'sub-ct-new', tab: 'catalog', sectionLabel: 'Catálogo de Animes', categoryLabel: 'Sub-Vista', subViewId: 'create-anime', title: 'Registrar Nuevo Anime', keywords: 'crear registrar nuevo anime catalogo' },

    // 7. Usuarios & Demografía
    { id: 'sec-usr', tab: 'users', sectionLabel: 'Usuarios & Demografía', categoryLabel: 'Audiencia & Comunidad', title: 'Usuarios & Demografía (Panorama Vital)', keywords: 'usuarios registrados invitados dau wau stickiness' },
    { id: 'sub-us-dir', tab: 'users', sectionLabel: 'Usuarios & Demografía', categoryLabel: 'Sub-Vista', subViewId: 'user-directory', title: 'Directorio de Usuarios', keywords: 'directorio cuentas roles admin eliminar' },
    { id: 'sub-us-dem', tab: 'users', sectionLabel: 'Usuarios & Demografía', categoryLabel: 'Sub-Vista', subViewId: 'demographics', title: 'Demografía, Países & Dispositivos', keywords: 'paises chile mexico edad movil desktop' },
    { id: 'sub-us-new', tab: 'users', sectionLabel: 'Usuarios & Demografía', categoryLabel: 'Sub-Vista', subViewId: 'create-user', title: 'Nuevo Usuario', keywords: 'crear registrar cuenta usuario' },

    // 8. Crecimiento & Adopción
    { id: 'sec-grw', tab: 'growth', sectionLabel: 'Crecimiento & Adopción', categoryLabel: 'Audiencia & Comunidad', title: 'Crecimiento & Adopción (Panorama Vital)', keywords: 'crecimiento k-factor viralidad altas diarias' },
    { id: 'sub-gr-coh', tab: 'growth', sectionLabel: 'Crecimiento & Adopción', categoryLabel: 'Sub-Vista', subViewId: 'cohorts-matrix', title: 'Retención de Cohortes (W0-W4)', keywords: 'cohortes retencion semanal lealtad' },
    { id: 'sub-gr-chn', tab: 'growth', sectionLabel: 'Crecimiento & Adopción', categoryLabel: 'Sub-Vista', subViewId: 'channels-viral', title: 'Canales de Invitación & Viralidad', keywords: 'whatsapp enlace qr invitaciones viral' },
    { id: 'sub-gr-dyn', tab: 'growth', sectionLabel: 'Crecimiento & Adopción', categoryLabel: 'Sub-Vista', subViewId: 'daily-dynamism', title: 'Dinamismo en Listas & Notas', keywords: 'dinamismo listas agendas actividad diaria' },

    // 9. Centro de Moderación
    { id: 'sec-mod', tab: 'moderation', sectionLabel: 'Centro de Moderación', categoryLabel: 'Audiencia & Comunidad', title: 'Centro de Moderación (Panorama Vital)', keywords: 'moderacion reportes denuncias toxicidad spoilers' },
    { id: 'sub-md-rep', tab: 'moderation', sectionLabel: 'Centro de Moderación', categoryLabel: 'Sub-Vista', subViewId: 'reports-queue', title: 'Cola de Denuncias', keywords: 'bandeja denuncias reportes resolver tickets' },
    { id: 'sub-md-usr', tab: 'moderation', sectionLabel: 'Centro de Moderación', categoryLabel: 'Sub-Vista', subViewId: 'user-discipline', title: 'Auditoría de Usuarios', keywords: 'advertir suspender reincidencia disciplina' },
    { id: 'sub-md-com', tab: 'moderation', sectionLabel: 'Centro de Moderación', categoryLabel: 'Sub-Vista', subViewId: 'comments-audit', title: 'Moderación de Comentarios', keywords: 'comentarios chat borrar purgar' }
]

interface ActiveSubViewMeta {
    sectionTitle: string
    subViewId: string
    subViewLabel: string
    onBack: () => void
}

interface AdminNavContextValue {
    activeSubViewId: string | null
    setActiveSubViewId: (id: string | null) => void
    subViewMeta: ActiveSubViewMeta | null
    setSubViewMeta: (meta: ActiveSubViewMeta | null) => void
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null)

export function AdminNavProvider({
    children,
    activeSubViewId,
    setActiveSubViewId
}: {
    children: React.ReactNode
    activeSubViewId: string | null
    setActiveSubViewId: (id: string | null) => void
}) {
    const [subViewMeta, setSubViewMeta] = useState<ActiveSubViewMeta | null>(null)

    return (
        <AdminNavContext.Provider value={{ activeSubViewId, setActiveSubViewId, subViewMeta, setSubViewMeta }}>
            {children}
        </AdminNavContext.Provider>
    )
}

export function useAdminNav() {
    return useContext(AdminNavContext)
}

/**
 * Hook sincronizado con la Headbar fija superior.
 * Permite que tanto los clics en KPIs/gráficos como el buscador global de la Headbar
 * abran o cierren sub-vistas de forma instantánea.
 */
export function useAdminSubView<T extends string>(): [T | null, (val: T | null) => void] {
    const ctx = useContext(AdminNavContext)
    const [localState, setLocalState] = useState<T | null>(null)

    const currentVal = (ctx ? (ctx.activeSubViewId as T | null) : localState)

    const setVal = useCallback((next: T | null) => {
        if (ctx) {
            ctx.setActiveSubViewId(next)
            if (next === null) {
                ctx.setSubViewMeta(null)
            }
        } else {
            setLocalState(next)
        }
    }, [ctx])

    return [currentVal, setVal]
}

interface AdminSubViewBarProps<T extends string = string> {
    sectionTitle: string
    activeSubView: T
    options: SubViewOption<T>[]
    onSelectSubView: (subView: T) => void
    onBack: () => void
    rightActions?: React.ReactNode
}

/**
 * Renderiza únicamente los selectores de vistas locales y acciones secundarias
 * a la cabeza de la Sub-Vista (Imagen 2), mientras sincroniza el botón Volver y
 * la ruta hacia la Headbar fija superior (Imagen 1).
 */
export function AdminSubViewBar<T extends string = string>({
    sectionTitle,
    activeSubView,
    options,
    onSelectSubView,
    onBack,
    rightActions
}: AdminSubViewBarProps<T>) {
    const ctx = useContext(AdminNavContext)
    const currentOption = options.find(o => o.id === activeSubView)
    const currentLabel = currentOption?.label || activeSubView

    // Sincronizar metadatos de la ruta con la Headbar estática
    useEffect(() => {
        if (!ctx) return
        ctx.setSubViewMeta({
            sectionTitle,
            subViewId: activeSubView,
            subViewLabel: currentLabel,
            onBack
        })
        return () => {
            ctx.setSubViewMeta(null)
        }
    }, [ctx, sectionTitle, activeSubView, currentLabel, onBack])

    // Cerrar sub-vista con tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onBack()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onBack])

    if (options.length <= 1 && !rightActions) return null

    return (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-2">
            {options.length > 1 ? (
                <div className="admin-subview-switcher">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSelectSubView(opt.id)}
                            className={`admin-subview-pill ${activeSubView === opt.id ? 'active' : ''}`}
                        >
                            <span>{opt.label}</span>
                            {opt.badge && (
                                <span className="ms-1.5 font-mono" style={{ opacity: 0.85, fontSize: '0.72rem' }}>
                                    ({opt.badge})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            ) : <div />}

            {rightActions && (
                <div className="d-flex flex-wrap align-items-center gap-2">
                    {rightActions}
                </div>
            )}
        </div>
    )
}
