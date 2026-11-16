import { useEffect, useRef, useState } from 'react'

/**
 * Mide el espacio libre (en px) entre el borde de la pantalla y el contenido
 * del `.container` hermano del elemento referenciado. Lo usan los fondos
 * decorativos de los costados (Mi Lista, Tablón) para saber si caben.
 */
export function useHuecoLateral<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const [estado, setEstado] = useState({
        hueco: 160,
        huecoIzq: 120,
        huecoDer: 120,
        sidebarWidth: 76,
    })

    useEffect(() => {
        const medir = () => {
            const rootEl = ref.current?.closest('.ml-root') || document.querySelector('.ml-root') || ref.current?.parentElement
            const contenedor = rootEl?.querySelector<HTMLElement>('.container') || document.querySelector<HTMLElement>('.ml-root .container')
            const sidebar = document.querySelector<HTMLElement>('.platform-sidebar')
            const sWidth = sidebar ? sidebar.getBoundingClientRect().width : 76

            if (contenedor) {
                const rect = contenedor.getBoundingClientRect()
                const relleno = parseFloat(getComputedStyle(contenedor).paddingLeft) || 0
                const izq = Math.max(0, rect.left + relleno - sWidth)
                const der = Math.max(0, window.innerWidth - rect.right + relleno)
                setEstado({
                    hueco: Math.round(rect.left + relleno),
                    huecoIzq: Math.round(izq),
                    huecoDer: Math.round(der),
                    sidebarWidth: Math.round(sWidth),
                })
            } else {
                setEstado((prev) => ({ ...prev, sidebarWidth: Math.round(sWidth) }))
            }
        }

        medir()

        const observador = new ResizeObserver(medir)
        observador.observe(document.documentElement)

        const sidebar = document.querySelector('.platform-sidebar')
        if (sidebar) observador.observe(sidebar)

        const rootEl = ref.current?.closest('.ml-root') || document.querySelector('.ml-root') || ref.current?.parentElement
        const contenedor = rootEl?.querySelector('.container') || document.querySelector('.ml-root .container')
        if (contenedor) observador.observe(contenedor)

        window.addEventListener('resize', medir)
        return () => {
            observador.disconnect()
            window.removeEventListener('resize', medir)
        }
    }, [])

    return {
        ref,
        hueco: estado.hueco,
        huecoIzq: estado.huecoIzq,
        huecoDer: estado.huecoDer,
        sidebarWidth: estado.sidebarWidth,
    }
}
