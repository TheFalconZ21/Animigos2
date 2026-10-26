import { useState, useEffect, useMemo } from 'react'
import { useMyList } from './useMyList'
import { ACENTO_POR_DEFECTO, ACENTO_POR_GENERO } from '../components/mi-lista/mi-lista-data'

const STORAGE_KEY = 'animigos_tema_acento'

export function useThemeAccent() {
    const { filas } = useMyList()
    const [acentoModo, setAcentoModoState] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'auto'
        } catch {
            return 'auto'
        }
    })

    useEffect(() => {
        const handleStorage = () => {
            try {
                const saved = localStorage.getItem(STORAGE_KEY) || 'auto'
                setAcentoModoState(saved)
            } catch {
                setAcentoModoState('auto')
            }
        }
        window.addEventListener('storage', handleStorage)
        window.addEventListener('animigos-theme-change', handleStorage)
        return () => {
            window.removeEventListener('storage', handleStorage)
            window.removeEventListener('animigos-theme-change', handleStorage)
        }
    }, [])

    const setAcentoModo = (nuevoModo: string) => {
        setAcentoModoState(nuevoModo)
        try {
            localStorage.setItem(STORAGE_KEY, nuevoModo)
        } catch {
            // ignore
        }
        window.dispatchEvent(new Event('animigos-theme-change'))
    }

    const generoDominante = useMemo(() => {
        const conteo = new Map<string, number>()
        filas.forEach((f) => f.anime.genres.forEach((g) => conteo.set(g, (conteo.get(g) ?? 0) + 1)))
        return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    }, [filas])

    const acento = useMemo(() => {
        if (acentoModo === 'auto') {
            return (generoDominante && ACENTO_POR_GENERO[generoDominante]) || ACENTO_POR_DEFECTO
        }
        return acentoModo
    }, [acentoModo, generoDominante])

    // Sincronizar en tiempo real las variables CSS globales para que Catálogo, Watch Party y Mi Lista compartan el acento exacto
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--ml-acento', acento)
            document.documentElement.style.setProperty('--cat-acento', acento)
            document.documentElement.style.setProperty('--theme-acento', acento)
        }
    }, [acento])

    return {
        acento,
        acentoModo,
        setAcentoModo,
        generoDominante,
    }
}
