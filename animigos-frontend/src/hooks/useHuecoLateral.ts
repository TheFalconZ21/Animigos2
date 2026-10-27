import { useEffect, useRef, useState } from 'react'

/**
 * Mide el espacio libre (en px) entre el borde de la pantalla y el contenido
 * del `.container` hermano del elemento referenciado. Lo usan los fondos
 * decorativos de los costados (Mi Lista, Tablón) para saber si caben.
 */
export function useHuecoLateral<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const [hueco, setHueco] = useState(0)

    useEffect(() => {
        const contenedor = ref.current?.parentElement?.querySelector<HTMLElement>(':scope > .container')
        if (!contenedor) return
        const medir = () => {
            const relleno = parseFloat(getComputedStyle(contenedor).paddingLeft)
            setHueco(contenedor.getBoundingClientRect().left + relleno)
        }
        medir()
        const observador = new ResizeObserver(medir)
        observador.observe(document.documentElement)
        return () => observador.disconnect()
    }, [])

    return { ref, hueco }
}
