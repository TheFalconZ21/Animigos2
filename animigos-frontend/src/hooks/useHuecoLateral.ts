import { useEffect, useRef, useState } from 'react'

/**
 * Mide el espacio libre (en px) entre el borde de la pantalla y el contenido
 * del `.container` hermano del elemento referenciado. Lo usan los fondos
 * decorativos de los costados (Mi Lista, Tablón) para saber si caben.
 */
export function useHuecoLateral<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const [dimensiones, setDimensiones] = useState({ hueco: 0, huecoIzq: 0, huecoDer: 0 })

    useEffect(() => {
        const contenedor = ref.current?.parentElement?.querySelector<HTMLElement>(':scope > .container')
        if (!contenedor) return
        const medir = () => {
            const rect = contenedor.getBoundingClientRect()
            const izq = Math.max(0, rect.left)
            const der = Math.max(0, window.innerWidth - rect.right)
            setDimensiones({ hueco: izq, huecoIzq: izq, huecoDer: der })
        }
        medir()
        const observador = new ResizeObserver(medir)
        observador.observe(document.documentElement)
        observador.observe(contenedor)
        window.addEventListener('resize', medir)
        return () => {
            observador.disconnect()
            window.removeEventListener('resize', medir)
        }
    }, [])

    return {
        ref,
        hueco: dimensiones.hueco,
        huecoIzq: dimensiones.huecoIzq,
        huecoDer: dimensiones.huecoDer,
    }
}
