/**
 * Hook de Agenda de Tareas Pendientes (Pilar 1.2 y 4.3 de AGENTS.md).
 * Orquesta la sincronización reactiva, mutaciones optimistas para el contador de capítulos
 * y la persistencia de progreso en Mi Lista.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAgenda, type AgendaApiResponse, type AgendaItem } from '../services/agendaApi'
import { updateMyListEntry, addAnimeToMyList } from '../services/userListApi'
import { useAuth } from '../context/AuthContext'

export function useAgenda() {
    const { user, isAuthenticated } = useAuth()
    const queryClient = useQueryClient()
    const queryKey = ['user-agenda', user?.id ?? 'guest']

    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery<AgendaApiResponse, Error>({
        queryKey,
        queryFn: fetchAgenda,
        staleTime: 1000 * 60 * 5, // 5 minutos de caché activa
    })

    // Mutación optimista para actualizar el progreso de episodios
    const updateProgressMutation = useMutation({
        mutationFn: async ({ entryId, episodesWatched }: { entryId: string; episodesWatched: number }) => {
            return updateMyListEntry(entryId, { episodes_watched: Math.max(0, episodesWatched) })
        },
        onMutate: async ({ entryId, episodesWatched }) => {
            await queryClient.cancelQueries({ queryKey })
            const previousData = queryClient.getQueryData<AgendaApiResponse>(queryKey)

            if (previousData) {
                const newItems = previousData.items.map((item) => {
                    if (item.entry_id === entryId) {
                        const newWatched = Math.max(0, episodesWatched)
                        const newBehind = Math.max(0, item.latest_episode - newWatched)
                        const newPct = item.latest_episode > 0 ? Math.min(100, Math.round((newWatched / item.latest_episode) * 100)) : 100
                        return {
                            ...item,
                            episodes_watched: newWatched,
                            episodes_behind: newBehind,
                            is_up_to_date: newBehind === 0,
                            progress_percent: newPct,
                        }
                    }
                    return item
                })

                // Recalcular resumen
                const totalBehind = newItems.reduce((acc, it) => acc + it.episodes_behind, 0)
                const upToDate = newItems.filter((it) => it.is_up_to_date).length
                const behindCount = newItems.filter((it) => !it.is_up_to_date).length
                const estMin = newItems.reduce((acc, it) => acc + (it.episodes_behind * (it.duration || 24)), 0)

                queryClient.setQueryData<AgendaApiResponse>(queryKey, {
                    ...previousData,
                    summary: {
                        total_series: newItems.length,
                        total_episodes_behind: totalBehind,
                        up_to_date_count: upToDate,
                        behind_count: behindCount,
                        estimated_minutes: estMin,
                    },
                    items: newItems,
                })
            }

            return { previousData }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKey, context.previousData)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey })
            queryClient.invalidateQueries({ queryKey: ['my-list'] })
        },
    })

    // Mutación para agregar anime sugerido a la agenda
    const addSuggestedMutation = useMutation({
        mutationFn: async (malId: number) => {
            return addAnimeToMyList({
                mal_id: malId,
                status: 'viendo',
                episodes_watched: 0,
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey })
            queryClient.invalidateQueries({ queryKey: ['my-list'] })
        },
    })

    // Funciones convenientes para la interfaz de usuario
    const incrementEpisode = (item: AgendaItem) => {
        const nextWatched = item.episodes_watched + 1
        updateProgressMutation.mutate({ entryId: item.entry_id, episodesWatched: nextWatched })
    }

    const decrementEpisode = (item: AgendaItem) => {
        if (item.episodes_watched <= 0) return
        const nextWatched = item.episodes_watched - 1
        updateProgressMutation.mutate({ entryId: item.entry_id, episodesWatched: nextWatched })
    }

    const markSetUpToDate = (item: AgendaItem) => {
        updateProgressMutation.mutate({ entryId: item.entry_id, episodesWatched: item.latest_episode })
    }

    const setExactEpisode = (item: AgendaItem, episode: number) => {
        updateProgressMutation.mutate({ entryId: item.entry_id, episodesWatched: Math.max(0, episode) })
    }

    const addAnimeToAgenda = (malId: number) => {
        return addSuggestedMutation.mutateAsync(malId)
    }

    return {
        summary: data?.summary ?? { total_series: 0, total_episodes_behind: 0, up_to_date_count: 0, behind_count: 0, estimated_minutes: 0 },
        items: data?.items ?? [],
        suggestedAiring: data?.suggested_airing ?? [],
        isAuthenticated: Boolean(data?.is_authenticated ?? isAuthenticated),
        isLoading,
        isError,
        error: isError ? error.message : null,
        refetch,
        incrementEpisode,
        decrementEpisode,
        markSetUpToDate,
        setExactEpisode,
        addAnimeToAgenda,
        isUpdating: updateProgressMutation.isPending,
        isAdding: addSuggestedMutation.isPending,
    }
}

