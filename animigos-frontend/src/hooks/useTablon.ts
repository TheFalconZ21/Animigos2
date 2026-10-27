/**
 * Hook del Tablón Social (Pilar 1.2 y 4.3 de AGENTS.md).
 * Reúne feed, noticias y salas del usuario con TanStack Query y expone
 * acciones (publicar, votar, agradecer) que invalidan la caché al terminar.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import {
    fetchFeed,
    publicarRecomendacion,
    publicarBusqueda,
    publicarEncuesta,
    votarEncuesta,
    alternarAgradecimiento,
    type Actividad,
    type AutorActividad,
    type NuevaRecomendacion,
} from '../services/feedApi'
import { fetchNews, type Noticia } from '../services/newsApi'
import { fetchAllRooms, type RoomSummary } from '../services/watchPartyApi'
import { searchCatalogAnimes } from '../services/userListApi'
import type { AnimeResumen } from '../services/feedApi'

const CLAVE_FEED = ['tablon', 'feed']

// Búsqueda en el catálogo real (para elegir qué anime recomendar)
export function useBuscarAnimes(texto: string) {
    const q = texto.trim()
    return useQuery<AnimeResumen[], Error>({
        queryKey: ['tablon', 'buscar', q],
        enabled: q.length >= 2,
        staleTime: 1000 * 60 * 5,
        queryFn: async () =>
            (await searchCatalogAnimes(q, 8)).map((a) => ({
                malId: a.mal_id,
                titulo: a.title,
                imagenUrl: a.image_url,
                nota: a.score === null || a.score === undefined ? null : Number(a.score),
                generos: a.genres ?? [],
            })),
    })
}

export function useTablon() {
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const feed = useQuery<Actividad[], Error>({ queryKey: CLAVE_FEED, queryFn: fetchFeed, staleTime: 1000 * 30 })
    const noticias = useQuery<Noticia[], Error>({ queryKey: ['tablon', 'noticias'], queryFn: fetchNews, staleTime: 1000 * 60 * 15 })
    const salas = useQuery<RoomSummary[], Error>({ queryKey: ['salas'], queryFn: fetchAllRooms, staleTime: 1000 * 60 })

    const autor: AutorActividad = {
        id: String(user?.id ?? 'invitado'),
        nombre: user?.display_name || user?.username || 'Tú',
        usuario: user?.username ?? 'invitado',
        avatarUrl: user?.avatar_url || '',
    }

    const refrescarFeed = () => queryClient.invalidateQueries({ queryKey: CLAVE_FEED })

    const recomendar = useMutation({
        mutationFn: (datos: NuevaRecomendacion) => publicarRecomendacion(autor, datos),
        onSettled: refrescarFeed,
    })
    const buscar = useMutation({
        mutationFn: ({ pedido, referencia }: { pedido: string; referencia?: string }) => publicarBusqueda(autor, pedido, referencia),
        onSettled: refrescarFeed,
    })
    const encuesta = useMutation({
        mutationFn: ({ pregunta, opciones }: { pregunta: string; opciones: string[] }) => publicarEncuesta(autor, pregunta, opciones),
        onSettled: refrescarFeed,
    })
    const votar = useMutation({
        mutationFn: ({ actividadId, opcionId }: { actividadId: string; opcionId: string }) => votarEncuesta(actividadId, opcionId),
        onSettled: refrescarFeed,
    })
    const agradecer = useMutation({
        mutationFn: (actividadId: string) => alternarAgradecimiento(actividadId),
        onSettled: refrescarFeed,
    })

    return {
        autor,
        actividades: feed.data ?? [],
        cargandoFeed: feed.isLoading,
        errorFeed: feed.isError ? feed.error.message : null,
        noticias: noticias.data ?? [],
        cargandoNoticias: noticias.isLoading,
        errorNoticias: noticias.isError ? noticias.error.message : null,
        refrescarNoticias: () => noticias.refetch(),
        actualizandoNoticias: noticias.isFetching,
        salas: salas.data ?? [],
        cargandoSalas: salas.isLoading,
        errorSalas: salas.isError ? salas.error.message : null,
        publicarRecomendacion: recomendar.mutateAsync,
        publicarBusqueda: buscar.mutateAsync,
        publicarEncuesta: encuesta.mutateAsync,
        votarEncuesta: (actividadId: string, opcionId: string) => votar.mutate({ actividadId, opcionId }),
        agradecer: (actividadId: string) => agradecer.mutate(actividadId),
    }
}
