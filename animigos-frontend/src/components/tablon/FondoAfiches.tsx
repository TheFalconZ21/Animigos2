import { useEffect, useState } from 'react'
import { SHOWCASE_ROW_1, SHOWCASE_ROW_2, SHOWCASE_ROW_3, type ShowcaseAnime } from '../../data/showcase-animes'
import { useHuecoLateral } from '../../hooks/useHuecoLateral'
import { mezclar } from '../../shared/aleatorio'

// ============================================================
// Fondo del Tablón: un afiche grande por lado que, cada cierto tiempo,
// se desvanece y deja paso a otro anime. Los dos lados cambian por turnos
// (nunca a la vez) para que el movimiento sea tranquilo.
// Mi Lista usa columnas que se desplazan; aquí son afiches que se alternan.
// ============================================================

const SEGUNDOS_POR_AFICHE = 10
const DURACION_FUNDIDO_MS = 1800
const HUECO_MINIMO = 140 // Por debajo de esto no hay espacio a los lados y no se muestra

export function FondoAfiches() {
    const { ref, hueco } = useHuecoLateral<HTMLDivElement>()
    const [afiches] = useState(() => mezclar([...SHOWCASE_ROW_1, ...SHOWCASE_ROW_2, ...SHOWCASE_ROW_3]))
    // Cada lado recorre posiciones distintas de la lista (pares e impares): nunca repiten el mismo anime
    const [cambiosIzq, setCambiosIzq] = useState(0)
    const [cambiosDer, setCambiosDer] = useState(0)
    const visible = hueco >= HUECO_MINIMO

    useEffect(() => {
        if (!visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        // Cada medio intervalo cambia un lado distinto: izquierda, derecha, izquierda...
        let turnoIzquierda = true
        const t = setInterval(() => {
            if (turnoIzquierda) setCambiosIzq((c) => c + 1)
            else setCambiosDer((c) => c + 1)
            turnoIzquierda = !turnoIzquierda
        }, (SEGUNDOS_POR_AFICHE * 1000) / 2)
        return () => clearInterval(t)
    }, [visible])

    const n = afiches.length
    const ancho = Math.max(0, hueco - 24)

    return (
        <>
            <div ref={ref} className="tb-afiche tb-afiche-izq" style={{ width: ancho, display: visible ? undefined : 'none' }} aria-hidden="true">
                {visible && <Afiche anime={afiches[(cambiosIzq * 2) % n]} />}
            </div>
            <div className="tb-afiche tb-afiche-der" style={{ width: ancho, display: visible ? undefined : 'none' }} aria-hidden="true">
                {visible && <Afiche anime={afiches[(cambiosDer * 2 + 1) % n]} />}
            </div>
        </>
    )
}

interface Capa {
    clave: number
    anime: ShowcaseAnime
}

// Un lado: la imagen nueva entra con un fundido encima de la anterior, que luego se retira
function Afiche({ anime }: { anime: ShowcaseAnime }) {
    const [capas, setCapas] = useState<Capa[]>([{ clave: 0, anime }])

    useEffect(() => {
        if (capas[capas.length - 1].anime.cover === anime.cover) return
        let cancelado = false
        let retirar: ReturnType<typeof setTimeout>
        // Se precarga la imagen: el fundido empieza solo cuando ya está descargada
        const img = new Image()
        img.onload = img.onerror = () => {
            if (cancelado) return
            setCapas((prev) => [...prev.slice(-1), { clave: prev[prev.length - 1].clave + 1, anime }])
            retirar = setTimeout(() => setCapas((prev) => prev.slice(-1)), DURACION_FUNDIDO_MS)
        }
        img.src = anime.cover
        return () => {
            cancelado = true
            clearTimeout(retirar)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anime])

    const actual = capas[capas.length - 1].anime

    return (
        <>
            {capas.map((c) => (
                <img key={c.clave} className="tb-afiche-img" src={c.anime.cover} alt="" decoding="async" />
            ))}
            <span key={actual.title} className="tb-afiche-titulo">{actual.title}</span>
        </>
    )
}
