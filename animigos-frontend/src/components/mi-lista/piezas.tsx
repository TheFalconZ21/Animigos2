import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ESCALA_NOTAS } from './mi-lista-data'

// ============================================================
// Piezas pequeñas reutilizadas en toda la sección Mi Lista
// ============================================================

// Sello de nota personal. Si recibe onCambiar, se vuelve editable:
// encima del sello hay un <select> invisible con la escala 1-10.
export function SelloNota({
    nota,
    onCambiar,
    pequeno = false,
    conEtiqueta = true,
}: {
    nota: number | null
    onCambiar?: (nota: number | null) => void
    pequeno?: boolean
    conEtiqueta?: boolean
}) {
    const clase = nota === null ? 'vacio' : nota === 10 ? 'lleno' : ''
    const texto = nota === null ? '—' : Number.isInteger(nota) ? nota : nota.toFixed(1)
    const etiqueta = nota === null ? 'Sin nota' : ESCALA_NOTAS[Math.round(nota)]

    return (
        <div className="ml-sello-wrap" title={onCambiar ? 'Cambiar tu nota' : etiqueta}>
            <span className={`ml-sello ${clase} ${pequeno ? 'ml-sello-sm' : ''}`} aria-hidden="true">
                {texto}
            </span>
            {conEtiqueta && <span className="ml-sello-label">{etiqueta}</span>}

            {onCambiar && (
                <select
                    className="ml-sello-select"
                    aria-label="Tu nota personal"
                    value={nota ?? ''}
                    onChange={(e) => onCambiar(e.target.value === '' ? null : Number(e.target.value))}
                >
                    <option value="">Sin nota</option>
                    {Object.entries(ESCALA_NOTAS)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([valor, nombre]) => (
                            <option key={valor} value={valor}>
                                {valor} · {nombre}
                            </option>
                        ))}
                </select>
            )}
        </div>
    )
}

// Progreso de episodios como marcas de una tira de película.
// Con muchos episodios (ej. 148) agrupa en 24 marcas proporcionales.
export function ProgresoEpisodios({
    vistos,
    total,
    onSumar,
}: {
    vistos: number
    total: number
    onSumar?: () => void
}) {
    const marcas = Math.min(total, 24)
    const encendidas = total === 0 ? 0 : Math.round((vistos / total) * marcas)

    return (
        <div className="ml-progreso">
            <div className="ml-marcas" aria-hidden="true">
                {Array.from({ length: marcas }, (_, i) => (
                    <span key={i} className={`ml-marca ${i < encendidas ? 'on' : ''}`} />
                ))}
            </div>
            <span className="ml-progreso-txt">
                {vistos} / {total} ep
            </span>
            {onSumar && vistos < total && (
                <button type="button" className="ml-mas-ep" onClick={onSumar} title="Marcar un episodio más">
                    +1
                </button>
            )}
        </div>
    )
}

// Envoltorio del <dialog> nativo (igual que LoginModal), pero controlado por React
export function Dialogo({
    abierto,
    onCerrar,
    etiqueta,
    children,
    ancho,
}: {
    abierto: boolean
    onCerrar: () => void
    etiqueta: string
    children: ReactNode
    ancho?: number
}) {
    const ref = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        if (abierto && !dialog.open) {
            dialog.showModal()
            // showModal() enfoca la ✕; mejor el campo marcado con data-autofocus o el propio diálogo
            const campo = dialog.querySelector<HTMLElement>('[data-autofocus]')
            if (campo) campo.focus()
            else dialog.focus()
        }
        if (!abierto && dialog.open) dialog.close()
    }, [abierto])

    return (
        <dialog
            ref={ref}
            className="ml-dialog"
            aria-label={etiqueta}
            tabIndex={-1}
            style={ancho ? { width: `min(${ancho}px, calc(100vw - 32px))` } : undefined}
            onCancel={(e) => {
                e.preventDefault()
                onCerrar()
            }}
            onClick={(e) => {
                // Clic en el fondo oscuro = cerrar
                if (e.target === e.currentTarget) onCerrar()
            }}
        >
            <button type="button" className="ml-icon-btn ml-dialog-cerrar" onClick={onCerrar} aria-label="Cerrar">
                <X size={18} />
            </button>
            {abierto && children}
        </dialog>
    )
}

// Menú desplegable simple que se cierra al hacer clic fuera o con Escape
export function Menu({
    boton,
    etiqueta,
    children,
}: {
    boton: ReactNode
    etiqueta: string
    children: (cerrar: () => void) => ReactNode
}) {
    const [abierto, setAbierto] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!abierto) return
        const alClic = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setAbierto(false)
        }
        const alTecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setAbierto(false)
        }
        document.addEventListener('mousedown', alClic)
        document.addEventListener('keydown', alTecla)
        return () => {
            document.removeEventListener('mousedown', alClic)
            document.removeEventListener('keydown', alTecla)
        }
    }, [abierto])

    return (
        <div className="ml-menu" ref={ref}>
            <button
                type="button"
                className="ml-icon-btn"
                aria-label={etiqueta}
                aria-expanded={abierto}
                onClick={() => setAbierto(!abierto)}
            >
                {boton}
            </button>
            {abierto && (
                <div className="ml-menu-lista" role="menu">
                    {children(() => setAbierto(false))}
                </div>
            )}
        </div>
    )
}
