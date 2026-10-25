import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SHOWCASE_ROW_1, SHOWCASE_ROW_2, SHOWCASE_ROW_3, type ShowcaseAnime } from '../../data/showcase-animes'

// ============================================================
// Columnas de portadas que suben y bajan en los costados.
// Mide el espacio libre al lado del .container y decide cuántas
// columnas caben (0, 1 o 2 por lado). En pantallas chicas no aparece.
// Se eligen 12 portadas al azar para no cargar demasiadas imágenes.
// ============================================================

const MAX_PORTADAS = 12
const ANCHO_COLUMNA = 150
const ANCHO_MINIMO = 100
const SEPARACION = 16

function mezclar<T>(lista: T[]): T[] {
    const copia = [...lista]
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copia[i], copia[j]] = [copia[j], copia[i]]
    }
    return copia
}

export function LateralesAnime() {
    const ref = useRef<HTMLDivElement>(null)
    const [hueco, setHueco] = useState(0) // Píxeles libres entre el borde de la pantalla y el contenido
    const [portadas] = useState(() =>
        mezclar([...SHOWCASE_ROW_1, ...SHOWCASE_ROW_2, ...SHOWCASE_ROW_3]).slice(0, MAX_PORTADAS),
    )

    useEffect(() => {
        const contenedor = ref.current?.parentElement?.querySelector<HTMLElement>(':scope > .container')
        if (!contenedor) return
        const medir = () => {
            const relleno = parseFloat(getComputedStyle(contenedor).paddingLeft)
            setHueco(contenedor.getBoundingClientRect().left + relleno)
        }
        medir()
        const observador = new ResizeObserver(medir)
        observador.observe(document.documentElement)
        return () => observador.disconnect()
    }, [])

    // Dos columnas si caben a buen tamaño; si no, una que se achica hasta ANCHO_MINIMO
    const espacio = hueco - SEPARACION * 2
    const columnas = espacio >= ANCHO_COLUMNA * 2 + SEPARACION ? 2 : espacio >= ANCHO_MINIMO ? 1 : 0
    const ancho = Math.min(ANCHO_COLUMNA, columnas === 2 ? (espacio - SEPARACION) / 2 : espacio)
    const mitadA = portadas.slice(0, MAX_PORTADAS / 2)
    const mitadB = portadas.slice(MAX_PORTADAS / 2)
    const estilo = {
        width: hueco - SEPARACION,
        display: columnas === 0 ? 'none' : undefined,
        '--ml-columna': `${ancho}px`,
    } as CSSProperties

    return (
        <>
            <div ref={ref} className="ml-lateral ml-lateral-izq" style={estilo} aria-hidden="true">
                <Columna animes={mitadA} sentido="sube" duracion={70} />
                {columnas === 2 && <Columna animes={mitadB} sentido="baja" duracion={85} />}
            </div>
            <div className="ml-lateral ml-lateral-der" style={estilo} aria-hidden="true">
                <Columna animes={[...mitadB].reverse()} sentido="baja" duracion={78} />
                {columnas === 2 && <Columna animes={[...mitadA].reverse()} sentido="sube" duracion={64} />}
            </div>
        </>
    )
}

function Columna({ animes, sentido, duracion }: { animes: ShowcaseAnime[]; sentido: 'sube' | 'baja'; duracion: number }) {
    // La lista va duplicada: al llegar a la mitad, la animación vuelve al inicio sin que se note el salto
    return (
        <div className="ml-columna">
            <div className={`ml-columna-pista ml-${sentido}`} style={{ animationDuration: `${duracion}s` }}>
                {[...animes, ...animes].map((a, i) => (
                    <figure key={i} className="ml-lateral-portada">
                        <img src={a.cover} alt="" decoding="async" />
                        <figcaption>{a.title}</figcaption>
                    </figure>
                ))}
            </div>
        </div>
    )
}
