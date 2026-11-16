import { useEffect, useMemo, useState } from 'react'
import { SHOWCASE_ROW_1, SHOWCASE_ROW_2, SHOWCASE_ROW_3 } from '../../data/showcase-animes'
import type { FilaLista } from './mi-lista-data'

// ============================================================
// Banners laterales de afiches de Mi Lista
// - Confinados en los carriles laterales de la pantalla (fuera del contenedor de 900px)
// - Lateral derecho: extremo izquierdo del afiche (object-position: left center)
// - Lateral izquierdo: extremo derecho del afiche (object-position: right center)
// - Al posar el cursor o seleccionar un anime de la lista se actualiza al instante
// - Sin selección activa: rotación automática cada 5s con crossfade (fade in/fade out)
// ============================================================

export interface LateralAnimeItem {
    title: string
    imageUrl: string
}

interface Props {
    filas?: FilaLista[]
    visibles?: FilaLista[]
    activeFila?: FilaLista | null
}

const DURACION_FADE_MS = 800
const INTERVALO_ROTACION_MS = 5000

const FALLBACK_ANIMES: LateralAnimeItem[] = [
    ...SHOWCASE_ROW_1,
    ...SHOWCASE_ROW_2,
    ...SHOWCASE_ROW_3,
].map((a) => ({ title: a.title, imageUrl: a.cover }))

export function LateralesAnime({ filas = [], visibles = [], activeFila }: Props) {
    // Pool de animes derivados de la lista del usuario (o fallback)
    const pool = useMemo<LateralAnimeItem[]>(() => {
        const fuente = visibles.length > 0 ? visibles : filas
        const items = fuente
            .filter((f) => Boolean(f.anime?.imageUrl))
            .map((f) => ({
                title: f.anime.title,
                imageUrl: f.anime.imageUrl,
            }))
        return items.length > 0 ? items : FALLBACK_ANIMES
    }, [visibles, filas])

    const [idleIndex, setIdleIndex] = useState(0)

    // Al cambiar la lista o los filtros reseteamos el ciclo
    useEffect(() => {
        setIdleIndex(0)
    }, [pool.length])

    // Rotación automática cada 5 segundos cuando no hay selección activa
    useEffect(() => {
        if (activeFila) return // Pausar cuando el usuario está interactuando con un anime
        if (pool.length <= 1) return

        const timer = setInterval(() => {
            setIdleIndex((prev) => (prev + 1) % pool.length)
        }, INTERVALO_ROTACION_MS)

        return () => clearInterval(timer)
    }, [activeFila, pool.length])

    const targetAnime = useMemo<LateralAnimeItem>(() => {
        if (activeFila?.anime?.imageUrl) {
            return {
                title: activeFila.anime.title,
                imageUrl: activeFila.anime.imageUrl,
            }
        }
        return pool[idleIndex % pool.length] || FALLBACK_ANIMES[0]
    }, [activeFila, pool, idleIndex])

    const isActive = Boolean(activeFila)

    return (
        <div className="ml-laterales-wrap">
            <BannerLado
                lado="izq"
                anime={targetAnime}
                isActive={isActive}
            />
            <BannerLado
                lado="der"
                anime={targetAnime}
                isActive={isActive}
            />
        </div>
    )
}

interface Capa {
    clave: number
    anime: LateralAnimeItem
}

function BannerLado({
    lado,
    anime,
    isActive,
}: {
    lado: 'izq' | 'der'
    anime: LateralAnimeItem
    isActive: boolean
}) {
    const [capas, setCapas] = useState<Capa[]>([{ clave: 0, anime }])

    useEffect(() => {
        if (!anime?.imageUrl) return
        const ultimo = capas[capas.length - 1]
        if (ultimo && ultimo.anime.imageUrl === anime.imageUrl) return

        let cancelado = false
        let timer: ReturnType<typeof setTimeout>

        // Precarga para transición sin parpadeos
        const img = new Image()
        img.onload = img.onerror = () => {
            if (cancelado) return
            setCapas((prev) => {
                const prevUltimo = prev[prev.length - 1]
                const nuevaClave = (prevUltimo?.clave ?? 0) + 1
                return [...prev.slice(-1), { clave: nuevaClave, anime }]
            })
            timer = setTimeout(() => {
                if (!cancelado) {
                    setCapas((prev) => prev.slice(-1))
                }
            }, DURACION_FADE_MS)
        }
        img.src = anime.imageUrl

        return () => {
            cancelado = true
            clearTimeout(timer)
        }
    }, [anime.imageUrl])

    return (
        <div
            className={`ml-lateral ml-lateral-${lado} ${isActive ? 'is-active' : ''}`}
            aria-hidden="true"
        >
            <div className="ml-lateral-contenedor">
                {capas.map((c, i) => {
                    const esUltima = i === capas.length - 1 && capas.length > 1
                    return (
                        <div
                            key={c.clave}
                            className={`ml-lateral-capa ${esUltima ? 'ml-lateral-entra' : ''}`}
                        >
                            <img
                                className="ml-lateral-img"
                                src={c.anime.imageUrl || FALLBACK_ANIMES[0].imageUrl}
                                alt=""
                                decoding="async"
                            />
                        </div>
                    )
                })}
                <div className="ml-lateral-overlay" />
            </div>
        </div>
    )
}
