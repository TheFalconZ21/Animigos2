import { useEffect, useState } from 'react'

/**
 * La hora actual en milisegundos, actualizada cada `intervaloMs`.
 * Sirve para cuentas regresivas ("en 2 h") que deben avanzar solas
 * sin leer Date.now() durante el render.
 */
export function useAhora(intervaloMs = 60_000): number {
    const [ahora, setAhora] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setAhora(Date.now()), intervaloMs)
        return () => clearInterval(t)
    }, [intervaloMs])
    return ahora
}
