interface ViewLoaderProps {
    message?: string
    compact?: boolean
}

/**
 * Indicador de carga branded de Animigos para Suspense (code-splitting)
 * y verificación inicial de rutas privadas.
 */
export function ViewLoader({ message = 'Cargando vista...', compact = false }: ViewLoaderProps) {
    return (
        <div
            className="animigos-view-loader"
            style={compact ? { minHeight: '28vh', padding: '1.25rem' } : undefined}
            role="status"
            aria-live="polite"
        >
            <div className="animigos-view-loader-ring" aria-hidden="true">
                <img
                    src="/logo-cat-white.png"
                    alt=""
                    className="animigos-view-loader-cat"
                    draggable={false}
                />
            </div>
            <span className="animigos-view-loader-text">{message}</span>
        </div>
    )
}
