/**
 * Hook Reactivo para Gestión de Mi Lista (Pilar 1.2 y 4.3 de la Directiva de Arquitectura).
 * Orquesta la sincronización en segundo plano, deduplicación de consultas,
 * actualizaciones optimistas con rollback automático e invalidación de caché con TanStack Query.
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import {
    fetchMyList,
    addAnimeToMyList,
    updateMyListEntry,
    deleteMyListEntry,
    createMyListFolder,
    renameMyListFolder,
    deleteMyListFolder,
    type MyListApiResponse,
    type ApiAnimeData,
    type ApiUserFolder,
    type ApiTagCount,
    type ApiUserListEntry,
    type AddAnimePayload,
    type UpdateAnimePayload,
} from '../services/userListApi'
import {
    apiEntryToFila,
    type FilaLista,
    type Carpeta,
    type EntradaLista,
} from '../components/mi-lista/mi-lista-data'

export function useMyList() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const queryKey = ['my-list', user?.id ?? 'guest']
    const [tagsLocales, setTagsLocales] = useState<string[]>([])

    // 1. Consulta Reactiva con TanStack Query
    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery<MyListApiResponse, Error>({
        queryKey,
        queryFn: fetchMyList,
        staleTime: 1000 * 60 * 3, // 3 minutos de caché activa
    })

    // Mapeo derivado seguro
    const filas: FilaLista[] = (data?.entries ?? []).map(apiEntryToFila)
    const carpetas: Carpeta[] = (data?.folders ?? []).map((f: ApiUserFolder) => ({
        id: f.id,
        nombre: f.name,
    }))
    const serverTags: string[] = (data?.tags ?? []).map((t: ApiTagCount) => t.tag.replace(/^#/, ''))

    const tags: string[] = useMemo(() => {
        const set = new Set([...serverTags, ...tagsLocales])
        return Array.from(set)
    }, [serverTags, tagsLocales])

    // 2. Mutación: Agregar Anime (con Actualización Optimista)
    const addMutation = useMutation({
        mutationFn: (payload: AddAnimePayload) => addAnimeToMyList(payload),
        onMutate: async (newPayload: AddAnimePayload) => {
            await queryClient.cancelQueries({ queryKey })
            const previousData = queryClient.getQueryData<MyListApiResponse>(queryKey)

            if (previousData) {
                // Inserción preliminar optimista
                queryClient.setQueryData<MyListApiResponse>(queryKey, {
                    ...previousData,
                    entries: [
                        {
                            id: `temp-${Date.now()}`,
                            mal_id: newPayload.mal_id,
                            status: newPayload.status ?? 'pendiente',
                            score: newPayload.score ?? null,
                            episodes_watched: newPayload.episodes_watched ?? 0,
                            is_favorite: newPayload.is_favorite ?? false,
                            folder_id: newPayload.folder_id ?? null,
                            folder_name: null,
                            tags: newPayload.tags ?? [],
                            notes: newPayload.notes ?? '',
                            anime: {
                                mal_id: newPayload.mal_id,
                                title: 'Guardando...',
                                image_url: '',
                                genres: [],
                            },
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                        ...previousData.entries.filter((e: ApiUserListEntry) => e.mal_id !== newPayload.mal_id),
                    ],
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
        },
    })

    // 3. Mutación: Actualizar Anime (con Actualización Optimista)
    const updateMutation = useMutation({
        mutationFn: ({ entryId, payload }: { entryId: string; payload: UpdateAnimePayload }) =>
            updateMyListEntry(entryId, payload),
        onMutate: async ({ entryId, payload }) => {
            await queryClient.cancelQueries({ queryKey })
            const previousData = queryClient.getQueryData<MyListApiResponse>(queryKey)

            if (previousData) {
                queryClient.setQueryData<MyListApiResponse>(queryKey, {
                    ...previousData,
                    entries: previousData.entries.map((entry: ApiUserListEntry) => {
                        if (entry.id === entryId) {
                            return {
                                ...entry,
                                status: payload.status ?? entry.status,
                                score: payload.score !== undefined ? payload.score : entry.score,
                                episodes_watched:
                                    payload.episodes_watched !== undefined
                                        ? payload.episodes_watched
                                        : entry.episodes_watched,
                                is_favorite:
                                    payload.is_favorite !== undefined
                                        ? payload.is_favorite
                                        : entry.is_favorite,
                                folder_id:
                                    payload.folder_id !== undefined
                                        ? payload.folder_id
                                        : entry.folder_id,
                                tags: payload.tags ?? entry.tags,
                                notes: payload.notes !== undefined ? payload.notes : entry.notes,
                                updated_at: new Date().toISOString(),
                            }
                        }
                        return entry
                    }),
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
        },
    })

    // 4. Mutación: Eliminar Anime (con Remoción Optimista)
    const deleteMutation = useMutation({
        mutationFn: (entryId: string) => deleteMyListEntry(entryId),
        onMutate: async (entryId: string) => {
            await queryClient.cancelQueries({ queryKey })
            const previousData = queryClient.getQueryData<MyListApiResponse>(queryKey)

            if (previousData) {
                queryClient.setQueryData<MyListApiResponse>(queryKey, {
                    ...previousData,
                    entries: previousData.entries.filter((e: ApiUserListEntry) => e.id !== entryId),
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
        },
    })

    // 5. Mutaciones de Carpetas
    const createFolderMutation = useMutation({
        mutationFn: (nombre: string) => createMyListFolder(nombre),
        onSettled: () => queryClient.invalidateQueries({ queryKey }),
    })

    const renameFolderMutation = useMutation({
        mutationFn: ({ id, nombre }: { id: string; nombre: string }) =>
            renameMyListFolder(id, nombre),
        onSettled: () => queryClient.invalidateQueries({ queryKey }),
    })

    const deleteFolderMutation = useMutation({
        mutationFn: (id: string) => deleteMyListFolder(id),
        onSettled: () => queryClient.invalidateQueries({ queryKey }),
    })

    // Funciones de acción de negocio simplificadas para la UI
    const actualizar = async (malId: number, cambios: Partial<EntradaLista>) => {
        const fila = filas.find((f) => f.malId === malId)
        if (!fila) return

        const payload: UpdateAnimePayload = {}
        if (cambios.estado !== undefined) payload.status = cambios.estado
        if (cambios.nota !== undefined) payload.score = cambios.nota
        if (cambios.episodiosVistos !== undefined) payload.episodes_watched = cambios.episodiosVistos
        if (cambios.favorito !== undefined) payload.is_favorite = cambios.favorito
        if (cambios.carpetaId !== undefined) payload.folder_id = cambios.carpetaId || null
        if (cambios.tags !== undefined) payload.tags = cambios.tags
        if (cambios.comentario !== undefined) payload.notes = cambios.comentario

        await updateMutation.mutateAsync({ entryId: fila.id, payload })
    }

    const quitar = async (malId: number) => {
        const fila = filas.find((f) => f.malId === malId)
        if (!fila) return
        await deleteMutation.mutateAsync(fila.id)
    }

    const agregarAnime = async (nuevaEntrada: EntradaLista, _animeData?: ApiAnimeData) => {
        await addMutation.mutateAsync({
            mal_id: nuevaEntrada.malId,
            status: nuevaEntrada.estado,
            score: nuevaEntrada.nota,
            episodes_watched: nuevaEntrada.episodiosVistos,
            is_favorite: nuevaEntrada.favorito,
            folder_id: nuevaEntrada.carpetaId || null,
            tags: nuevaEntrada.tags,
            notes: nuevaEntrada.comentario || '',
        })
    }

    const crearCarpeta = async (nombre: string) => {
        await createFolderMutation.mutateAsync(nombre)
    }

    const renombrarCarpeta = async (id: string, nombre: string) => {
        await renameFolderMutation.mutateAsync({ id, nombre })
    }

    const eliminarCarpeta = async (id: string) => {
        await deleteFolderMutation.mutateAsync(id)
    }

    const crearTag = (nuevoTag: string) => {
        const limpio = nuevoTag.replace(/^#/, '').trim()
        if (limpio && !tags.includes(limpio)) {
            setTagsLocales((prev) => [...prev, limpio])
        }
    }

    const eliminarTag = async (tagToRemove: string) => {
        setTagsLocales((prev) => prev.filter((t) => t !== tagToRemove))
        const entradasConTag = filas.filter((f) => f.tags.includes(tagToRemove))
        for (const fila of entradasConTag) {
            const nuevosTags = fila.tags.filter((t) => t !== tagToRemove)
            await actualizar(fila.malId, { tags: nuevosTags })
        }
    }

    return {
        filas,
        carpetas,
        tags,
        stats: data?.stats,
        cargando: isLoading,
        errorCarga: isError ? error.message : null,
        refetch,
        actualizar,
        quitar,
        agregarAnime,
        crearCarpeta,
        renombrarCarpeta,
        eliminarCarpeta,
        crearTag,
        eliminarTag,
    }
}
