/**
 * Configuración Central de TanStack Query (React Query)
 * Pilar 1.1 y 4.3 de la Directiva de Arquitectura Animigos.
 * 
 * Gestiona deduplicación de consultas, políticas de caducidad en memoria (staleTime),
 * recolección de basura (gcTime) y reintentos automáticos controlados.
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,       // 5 minutos de validez de caché por defecto
            gcTime: 1000 * 60 * 30,         // 30 minutos de persistencia en memoria
            refetchOnWindowFocus: false,    // Evitar parpadeos y solicitudes redundantes al cambiar de ventana
            retry: (failureCount, error: any) => {
                // No reintentar ante errores 401/403/404 de cliente
                const status = error?.status || error?.response?.status
                if (status === 401 || status === 403 || status === 404) {
                    return false
                }
                return failureCount < 2
            },
        },
        mutations: {
            retry: 0,
        },
    },
})
