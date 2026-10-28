import { useState, useEffect, useCallback } from 'react'

export type CatExpression = 'normal' | 'happy'

const STORAGE_KEY = 'animigos_cat_expression'
const SYNC_EVENT = 'animigos:cat-expression-change'

/**
 * Hook reactivo para gestionar la expresión facial del isotipo de gato de Animigos.
 * Sincroniza en tiempo real el cambio entre el logo normal ('u w u') y el logo2 ('happy' / '> ▽ <')
 * tanto en el Navbar como en el Hero y otros componentes.
 */
export function useCatExpression() {
    const [expression, setExpressionState] = useState<CatExpression>(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY)
            return saved === 'happy' ? 'happy' : 'normal'
        } catch {
            return 'normal'
        }
    })

    useEffect(() => {
        const handleSync = () => {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY)
                setExpressionState(saved === 'happy' ? 'happy' : 'normal')
            } catch {
                setExpressionState('normal')
            }
        }

        window.addEventListener(SYNC_EVENT, handleSync)
        return () => {
            window.removeEventListener(SYNC_EVENT, handleSync)
        }
    }, [])

    const setExpression = useCallback((next: CatExpression) => {
        setExpressionState(next)
        try {
            sessionStorage.setItem(STORAGE_KEY, next)
        } catch {
            // ignore
        }
        window.dispatchEvent(new Event(SYNC_EVENT))
    }, [])

    const toggleExpression = useCallback(() => {
        setExpressionState((prev) => {
            const next: CatExpression = prev === 'normal' ? 'happy' : 'normal'
            try {
                sessionStorage.setItem(STORAGE_KEY, next)
            } catch {
                // ignore
            }
            window.dispatchEvent(new Event(SYNC_EVENT))
            return next
        })
    }, [])

    return {
        expression,
        isHappy: expression === 'happy',
        setExpression,
        toggleExpression,
    }
}
