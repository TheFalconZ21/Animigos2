/**
 * Hooks del Calendario de anime (Pilar 1.2 y 4.3 de AGENTS.md).
 * La misma caché la comparten el Calendario y el widget "Hoy en emisión" del Tablón.
 */

import { useQuery } from '@tanstack/react-query'
import { fetchSchedule, fetchUpcoming, type Emision, type Lanzamiento } from '../services/scheduleApi'

export function useHorario() {
    const q = useQuery<Emision[], Error>({ queryKey: ['calendario', 'horario'], queryFn: fetchSchedule, staleTime: 1000 * 60 * 30 })
    return {
        emisiones: q.data ?? [],
        cargando: q.isLoading,
        error: q.isError ? q.error.message : null,
    }
}

export function useLanzamientos() {
    const q = useQuery<Lanzamiento[], Error>({ queryKey: ['calendario', 'lanzamientos'], queryFn: fetchUpcoming, staleTime: 1000 * 60 * 60 })
    return {
        lanzamientos: q.data ?? [],
        cargando: q.isLoading,
        error: q.isError ? q.error.message : null,
    }
}
