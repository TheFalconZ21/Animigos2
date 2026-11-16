import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
    Clock,
    Film,
    Tv,
    Calendar,
    BookOpen,
    Languages,
    GraduationCap,
    Plane,
    BarChart3,
    Sparkles,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { ProfesorDoki, type DokiExpression } from '../doki/ProfesorDoki'
import type { FilaLista } from '../mi-lista/mi-lista-data'

export interface AnimeTimeWatchedViewProps {
    filas: FilaLista[]
    onSelectAnime?: (fila: FilaLista) => void
    accentColor?: string
}

export type WatchedTimeframe = '7d' | '1y' | 'all'

export interface TimeBarItem {
    id: string
    label: string
    sublabel: string
    minutes: number
    hours: number
    episodes: number
    animes: { fila: FilaLista; minutes: number; episodes: number }[]
}

function getEntryMinutes(f: FilaLista): number {
    const epDuration = f.anime.durationMinutes && f.anime.durationMinutes > 0 ? f.anime.durationMinutes : 24
    const eps =
        f.estado === 'visto'
            ? f.anime.episodes || f.episodiosVistos || 12
            : f.episodiosVistos || (f.estado === 'viendo' ? 1 : 0)
    return eps * epDuration
}

function getEntryWatchedEpisodes(f: FilaLista): number {
    if (f.estado === 'visto') {
        return f.anime.episodes || f.episodiosVistos || 12
    }
    return f.episodiosVistos || (f.estado === 'viendo' ? 1 : 0)
}

function isAnimeMovie(f: FilaLista): boolean {
    const rawType = (f.anime.type || '').toUpperCase().trim()
    if (rawType === 'MOVIE' || rawType === 'PELICULA' || rawType === 'PELÍCULA') return true
    if (f.anime.genres?.some((g) => g.toLowerCase() === 'movie')) return true
    if (f.anime.tagsData?.some((t) => t.name.toLowerCase() === 'movie')) return true
    if (f.anime.episodes === 1 && (f.anime.durationMinutes || 0) >= 45) return true
    return false
}

export const AnimeTimeWatchedView: React.FC<AnimeTimeWatchedViewProps> = ({
    filas,
    onSelectAnime,
    accentColor = 'var(--perfil-acento)',
}) => {
    const [timeframe, setTimeframe] = useState<WatchedTimeframe>('all')
    const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null)

    // Estado para el carrusel de afiches en "Período Inspeccionado"
    const posterScrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    // Estado para "Dimensiona tu Tiempo" con Profesor Doki
    const [activeDokiCard, setActiveDokiCard] = useState(0)
    const [isDokiPaused, setIsDokiPaused] = useState(false)

    // 1. CÁLCULO DE LOS 4 KPIS PRINCIPALES DE CONSUMO
    const kpis = useMemo(() => {
        let seriesEpisodes = 0
        let moviesCount = 0
        let totalMinutes = 0

        for (const f of filas) {
            if (f.estado === 'pendiente' || f.estado === 'dropeado') continue
            const isMovie = isAnimeMovie(f)
            const eps = getEntryWatchedEpisodes(f)
            const mins = getEntryMinutes(f)
            totalMinutes += mins

            if (isMovie) {
                if (f.estado === 'visto' || eps >= 1) {
                    moviesCount += 1
                }
            } else {
                seriesEpisodes += eps
            }
        }

        const totalHours = Math.round(totalMinutes / 60)
        const totalDays = +(totalMinutes / (60 * 24)).toFixed(1)

        return {
            seriesEpisodes,
            moviesCount,
            totalMinutes,
            totalHours,
            totalDays,
        }
    }, [filas])

    // 2. CÁLCULO DEL GRÁFICO DE BARRAS DE CONSUMO EN MINUTOS POR FECHA
    const barData = useMemo<TimeBarItem[]>(() => {
        const validFilas = filas.filter(
            (f) =>
                f.estado !== 'pendiente' &&
                f.estado !== 'dropeado' &&
                (f.estado === 'visto' || (f.estado === 'viendo' && f.episodiosVistos > 0))
        )

        const now = new Date()

        if (timeframe === '7d') {
            // Últimos 7 días
            const daysNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
            const bars: TimeBarItem[] = []

            for (let i = 6; i >= 0; i--) {
                const d = new Date(now)
                d.setDate(now.getDate() - i)
                d.setHours(0, 0, 0, 0)
                const nextDay = new Date(d)
                nextDay.setDate(d.getDate() + 1)

                const isToday = i === 0
                const isYesterday = i === 1
                const label = isToday
                    ? 'Hoy'
                    : isYesterday
                    ? 'Ayer'
                    : `${daysNames[d.getDay()]} ${d.getDate()}`
                const sublabel = `${d.getDate()} de ${d.toLocaleString('es-ES', { month: 'short' })}`

                const matchingAnimes: { fila: FilaLista; minutes: number; episodes: number }[] = []
                let dayMinutes = 0
                let dayEps = 0

                for (const f of validFilas) {
                    const rawDate = f.updatedAt || f.createdAt
                    const fDate = rawDate ? new Date(rawDate) : now
                    if (fDate >= d && fDate < nextDay) {
                        const mins = getEntryMinutes(f)
                        const eps = getEntryWatchedEpisodes(f)
                        dayMinutes += mins
                        dayEps += eps
                        matchingAnimes.push({ fila: f, minutes: mins, episodes: eps })
                    }
                }

                bars.push({
                    id: `day-${i}`,
                    label,
                    sublabel,
                    minutes: dayMinutes,
                    hours: +(dayMinutes / 60).toFixed(1),
                    episodes: dayEps,
                    animes: matchingAnimes,
                })
            }

            const totalAssigned = bars.reduce((acc, b) => acc + b.minutes, 0)
            if (totalAssigned === 0 && validFilas.length > 0) {
                const todayBar = bars[bars.length - 1]
                for (const f of validFilas) {
                    const mins = getEntryMinutes(f)
                    const eps = getEntryWatchedEpisodes(f)
                    todayBar.minutes += mins
                    todayBar.episodes += eps
                    todayBar.animes.push({ fila: f, minutes: mins, episodes: eps })
                }
                todayBar.hours = +(todayBar.minutes / 60).toFixed(1)
            }

            return bars
        }

        if (timeframe === '1y') {
            // Anual (12 Meses del año actual)
            const monthsNames = [
                'Ene',
                'Feb',
                'Mar',
                'Abr',
                'May',
                'Jun',
                'Jul',
                'Ago',
                'Sep',
                'Oct',
                'Nov',
                'Dic',
            ]
            const currentYear = now.getFullYear()
            const bars: TimeBarItem[] = []

            for (let m = 0; m < 12; m++) {
                const label = monthsNames[m]
                const sublabel = `${monthsNames[m]} ${currentYear}`
                const matchingAnimes: { fila: FilaLista; minutes: number; episodes: number }[] = []
                let monthMinutes = 0
                let monthEps = 0

                for (const f of validFilas) {
                    const rawDate = f.updatedAt || f.createdAt
                    const fDate = rawDate ? new Date(rawDate) : now
                    if (fDate.getFullYear() === currentYear && fDate.getMonth() === m) {
                        const mins = getEntryMinutes(f)
                        const eps = getEntryWatchedEpisodes(f)
                        monthMinutes += mins
                        monthEps += eps
                        matchingAnimes.push({ fila: f, minutes: mins, episodes: eps })
                    }
                }

                bars.push({
                    id: `month-${m}`,
                    label,
                    sublabel,
                    minutes: monthMinutes,
                    hours: +(monthMinutes / 60).toFixed(1),
                    episodes: monthEps,
                    animes: matchingAnimes,
                })
            }

            const totalAssigned = bars.reduce((acc, b) => acc + b.minutes, 0)
            if (totalAssigned === 0 && validFilas.length > 0) {
                const currentMonthBar = bars[now.getMonth()]
                for (const f of validFilas) {
                    const mins = getEntryMinutes(f)
                    const eps = getEntryWatchedEpisodes(f)
                    currentMonthBar.minutes += mins
                    currentMonthBar.episodes += eps
                    currentMonthBar.animes.push({ fila: f, minutes: mins, episodes: eps })
                }
                currentMonthBar.hours = +(currentMonthBar.minutes / 60).toFixed(1)
            }

            return bars
        }

        // 'all' — Todo el tiempo (Todos los años)
        const yearsSet = new Set<number>()
        for (const f of validFilas) {
            const rawDate = f.updatedAt || f.createdAt
            const yr = rawDate ? new Date(rawDate).getFullYear() : f.anime.year || now.getFullYear()
            if (!isNaN(yr) && yr > 2000) yearsSet.add(yr)
        }
        yearsSet.add(now.getFullYear())

        const minYear = Math.min(...Array.from(yearsSet))
        const maxYear = Math.max(...Array.from(yearsSet))
        const sortedYears: number[] = []
        for (let y = Math.min(minYear, maxYear - 2); y <= maxYear; y++) {
            sortedYears.push(y)
        }

        const bars: TimeBarItem[] = sortedYears.map((yr) => {
            const matchingAnimes: { fila: FilaLista; minutes: number; episodes: number }[] = []
            let yrMinutes = 0
            let yrEps = 0

            for (const f of validFilas) {
                const rawDate = f.updatedAt || f.createdAt
                const fYr = rawDate ? new Date(rawDate).getFullYear() : f.anime.year || now.getFullYear()
                if (fYr === yr) {
                    const mins = getEntryMinutes(f)
                    const eps = getEntryWatchedEpisodes(f)
                    yrMinutes += mins
                    yrEps += eps
                    matchingAnimes.push({ fila: f, minutes: mins, episodes: eps })
                }
            }

            return {
                id: `year-${yr}`,
                label: String(yr),
                sublabel: `Año ${yr}`,
                minutes: yrMinutes,
                hours: +(yrMinutes / 60).toFixed(1),
                episodes: yrEps,
                animes: matchingAnimes,
            }
        })

        const totalAssigned = bars.reduce((acc, b) => acc + b.minutes, 0)
        if (totalAssigned === 0 && validFilas.length > 0) {
            const currentYearBar = bars[bars.length - 1]
            for (const f of validFilas) {
                const mins = getEntryMinutes(f)
                const eps = getEntryWatchedEpisodes(f)
                currentYearBar.minutes += mins
                currentYearBar.episodes += eps
                currentYearBar.animes.push({ fila: f, minutes: mins, episodes: eps })
            }
            currentYearBar.hours = +(currentYearBar.minutes / 60).toFixed(1)
        }

        return bars
    }, [filas, timeframe])

    // Determinar la barra activa seleccionada
    const activeBar = useMemo(() => {
        if (selectedBarIdx !== null && selectedBarIdx >= 0 && selectedBarIdx < barData.length) {
            return barData[selectedBarIdx]
        }
        const maxBar = [...barData].reverse().find((b) => b.minutes > 0)
        return maxBar || barData[barData.length - 1]
    }, [barData, selectedBarIdx])

    // Control de scroll y flechas del carrusel de afiches
    const updateScrollButtons = useCallback(() => {
        const el = posterScrollRef.current
        if (!el) {
            setCanScrollLeft(false)
            setCanScrollRight(false)
            return
        }
        const { scrollLeft, scrollWidth, clientWidth } = el
        if (scrollWidth <= clientWidth + 4) {
            setCanScrollLeft(false)
            setCanScrollRight(false)
            return
        }
        setCanScrollLeft(scrollLeft > 4)
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
    }, [])

    useEffect(() => {
        if (posterScrollRef.current) {
            posterScrollRef.current.scrollLeft = 0
        }
        const t = setTimeout(() => {
            updateScrollButtons()
        }, 60)
        return () => clearTimeout(t)
    }, [activeBar, updateScrollButtons])

    useEffect(() => {
        const handleResize = () => updateScrollButtons()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [updateScrollButtons])

    const handleScrollLeft = () => {
        if (!posterScrollRef.current) return
        posterScrollRef.current.scrollBy({ left: -140, behavior: 'smooth' })
    }

    const handleScrollRight = () => {
        if (!posterScrollRef.current) return
        posterScrollRef.current.scrollBy({ left: 140, behavior: 'smooth' })
    }

    // 3. DIMENSIÓN DE TU TIEMPO (EQUIVALENCIAS EN LA VIDA REAL)
    const timeEquivalences = useMemo(() => {
        const hours = Math.max(1, kpis.totalHours)

        // 1. Libros leídos (~300 páginas con lectura reflexiva de 250 palabras/min = 5.2 horas/libro)
        const books = Math.max(1, Math.round(hours / 5.2))

        // 2. Idiomas aprendidos (~200 horas para nivel conversacional B1 según FSI)
        const languages = +(hours / 200).toFixed(1)
        const vocabWords = Math.round(hours * 35)

        // 3. Carrera universitaria (~3.600 horas lectivas en 4 años, ~450 horas/semestre)
        const collegePct = Math.min(100, Math.max(1, Math.round((hours / 3600) * 100)))
        const semestres = +(hours / 450).toFixed(1)
        const ectsCredits = Math.max(1, Math.round(hours / 30))

        // 4. Vueltas al mundo en avión (~45 horas en vuelo comercial ininterrumpido)
        const worldTours = +(hours / 45).toFixed(1)

        return {
            books,
            languages,
            vocabWords,
            collegePct,
            semestres,
            ectsCredits,
            worldTours,
        }
    }, [kpis.totalHours])

    // Tarjetas temáticas con comentarios del Profesor Doki Doki
    const dokiCards = useMemo(() => {
        return [
            {
                id: 'libros',
                title: 'Lectura de Libros',
                category: 'Lectura',
                icon: <BookOpen size={16} style={{ color: '#38bdf8' }} />,
                color: '#38bdf8',
                expression: 'explicando' as DokiExpression,
                headline: `~${timeEquivalences.books} libros completos`,
                quote: `¡Con esas ${kpis.totalHours} horas frente al anime habrías terminado cerca de ${timeEquivalences.books} novelas de 300 páginas (a 250 palabras por minuto)! Podrías haber leído obras maestras enteras de la literatura universal... ¡aunque seguir el viaje de Frieren valió cada segundo!`,
            },
            {
                id: 'idiomas',
                title: 'Aprendizaje de Idiomas',
                category: 'Idiomas',
                icon: <Languages size={16} style={{ color: '#a78bfa' }} />,
                color: '#a78bfa',
                expression: 'pensando' as DokiExpression,
                headline:
                    kpis.totalHours >= 200
                        ? `~${timeEquivalences.languages} idiomas aprendidos (B1)`
                        : `~${timeEquivalences.vocabWords} palabras y frases clave`,
                quote:
                    kpis.totalHours >= 200
                        ? `¡Impresionante! Según el estándar FSI, con ${kpis.totalHours} horas habrías alcanzado nivel conversacional intermedio B1 en ${timeEquivalences.languages} idiomas. ¡Aunque escuchar 'Yamete' y 'Dattebayo' en audio original japonés también es inmersión auditiva!`
                        : `¡Con tus ${kpis.totalHours} horas habrías dominado cerca de ${timeEquivalences.vocabWords} palabras de vocabulario y completado decenas de lecciones intensivas en un nuevo idioma!`,
            },
            {
                id: 'carrera',
                title: 'Carrera Universitaria',
                category: 'Académico',
                icon: <GraduationCap size={16} style={{ color: '#34d399' }} />,
                color: '#34d399',
                expression: 'aprobacion' as DokiExpression,
                headline:
                    kpis.totalHours >= 3600
                        ? `~${(kpis.totalHours / 3600).toFixed(1)} títulos universitarios`
                        : kpis.totalHours >= 450
                        ? `~${timeEquivalences.semestres} semestres lectivos`
                        : `${timeEquivalences.collegePct}% de una carrera (${timeEquivalences.ectsCredits} ECTS)`,
                quote:
                    kpis.totalHours >= 450
                        ? `¡Has invertido el equivalente a ${timeEquivalences.semestres} semestres lectivos completos de educación superior! Ya prácticamente calificas para ser catedrático emérito de narrativa y animación contemporánea.`
                        : `¡Equivale al ${timeEquivalences.collegePct}% de toda la carga lectiva de un grado universitario (cerca de ${timeEquivalences.ectsCredits} créditos ECTS)! ¡Un diplomado honorario en apreciación de anime!`,
            },
            {
                id: 'mundo',
                title: 'Vueltas al Mundo en Avión',
                category: 'Viajes',
                icon: <Plane size={16} style={{ color: '#fbbf24' }} />,
                color: '#fbbf24',
                expression: 'sorprendido' as DokiExpression,
                headline: `~${timeEquivalences.worldTours} vueltas al mundo`,
                quote: `¡Diste el equivalente a ${timeEquivalences.worldTours} circunvalaciones continuas a la Tierra volando sin descanso en un avión comercial (a 45 horas por vuelta al globo)! Mientras contemplabas tus openings favoritos, habrías aterrizado en Tokio, París, Londres y Sydney.`,
            },
            {
                id: 'musica',
                title: 'Música e Instrumentos',
                category: 'Habilidades',
                icon: <Sparkles size={16} style={{ color: '#f472b6' }} />,
                color: '#f472b6',
                expression: 'cantando' as DokiExpression,
                headline: `~${Math.max(1, Math.round(kpis.totalHours / 40))} aperturas o técnicas dominadas`,
                quote: `¡Unas ${kpis.totalHours} horas de práctica deliberada te habrían permitido dominar la guitarra, el bajo o el teclado para tocar tus openings favoritos de memoria! ¿Quién necesita un conservatorio cuando puedes tararear cada solo de Bocchi The Rock?`,
            },
        ]
    }, [kpis.totalHours, timeEquivalences])

    // Iteración automática cada 10 segundos para Profesor Doki (se pausa al pasar el ratón)
    useEffect(() => {
        if (isDokiPaused) return
        const timer = setInterval(() => {
            setActiveDokiCard((prev) => (prev + 1) % dokiCards.length)
        }, 10000)
        return () => clearInterval(timer)
    }, [isDokiPaused, dokiCards.length])

    const currentDokiCard = dokiCards[activeDokiCard] || dokiCards[0]

    // Parámetros de Dibujo SVG para el Gráfico de Barras
    const svgW = 600
    const svgH = 200
    const pad = { top: 20, right: 20, bottom: 28, left: 54 }
    const chartW = svgW - pad.left - pad.right
    const chartH = svgH - pad.top - pad.bottom

    const maxMinutes = Math.max(60, ...barData.map((b) => b.minutes))
    const barSpacing = chartW / barData.length
    const barWidth = Math.max(16, Math.min(46, barSpacing * 0.62))

    return (
        <div className="perfil-time-watched-container mb-4">
            {/* 1. Header con Título Limpio (sin el selector aquí, que se traslada al pie del gráfico) */}
            <div
                className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2.5 border-bottom"
                style={{ borderColor: 'var(--perfil-border)' }}
            >
                <div>
                    <span className="ml-eyebrow" style={{ color: accentColor, letterSpacing: '0.08em' }}>
                        SUBVISTA DEDICADA · TIEMPO CONSUMIDO
                    </span>
                    <h3 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                        <Clock size={16} style={{ color: accentColor }} />
                        <span>Consumo de Anime y Dimensión Temporal</span>
                    </h3>
                </div>
                <span className="small text-secondary font-mono d-none d-md-inline" style={{ fontSize: '0.72rem' }}>
                    Minutos reales frente a la pantalla y equivalencias de vida
                </span>
            </div>

            {/* 2. Los 4 KPIs Principales de Tiempo y Consumo AGRUPADOS EN UNA ÚNICA LÍNEA */}
            <div className="row g-2 mb-3">
                {/* 1. Capítulos Vistos */}
                <div className="col-6 col-md-3">
                    <div
                        className="p-2.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', minHeight: 72 }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="small text-secondary fw-semibold" style={{ fontSize: '0.72rem' }}>
                                Capítulos Vistos
                            </span>
                            <Tv size={14} style={{ color: accentColor }} />
                        </div>
                        <div>
                            <div className="h4 fw-bold text-white mb-0 font-mono" style={{ fontSize: '1.22rem' }}>
                                {kpis.seriesEpisodes.toLocaleString()}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.78rem' }}>
                                    eps
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                Series TV, OVA y especiales
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Películas Vistas */}
                <div className="col-6 col-md-3">
                    <div
                        className="p-2.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', minHeight: 72 }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="small text-secondary fw-semibold" style={{ fontSize: '0.72rem' }}>
                                Películas Vistas
                            </span>
                            <Film size={14} style={{ color: 'var(--perfil-pink)' }} />
                        </div>
                        <div>
                            <div
                                className="h4 fw-bold mb-0 font-mono"
                                style={{ color: 'var(--perfil-pink)', fontSize: '1.22rem' }}
                            >
                                {kpis.moviesCount}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.78rem' }}>
                                    {kpis.moviesCount === 1 ? 'película' : 'películas'}
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                Largometrajes autoconclusivos
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Tiempo en Horas */}
                <div className="col-6 col-md-3">
                    <div
                        className="p-2.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', minHeight: 72 }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="small text-secondary fw-semibold" style={{ fontSize: '0.72rem' }}>
                                Tiempo en Horas
                            </span>
                            <Clock size={14} style={{ color: 'var(--perfil-cyan)' }} />
                        </div>
                        <div>
                            <div
                                className="h4 fw-bold mb-0 font-mono"
                                style={{ color: 'var(--perfil-cyan)', fontSize: '1.22rem' }}
                            >
                                {kpis.totalHours.toLocaleString()}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.78rem' }}>
                                    h
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                Horas acumuladas de visionado
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Tiempo en Minutos */}
                <div className="col-6 col-md-3">
                    <div
                        className="p-2.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)', minHeight: 72 }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="small text-secondary fw-semibold" style={{ fontSize: '0.72rem' }}>
                                Tiempo en Minutos
                            </span>
                            <Calendar size={14} style={{ color: 'var(--perfil-amber)' }} />
                        </div>
                        <div>
                            <div
                                className="h4 fw-bold mb-0 font-mono"
                                style={{ color: 'var(--perfil-amber)', fontSize: '1.22rem' }}
                            >
                                {kpis.totalMinutes.toLocaleString()}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.78rem' }}>
                                    min
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.68rem' }}>
                                ~{kpis.totalDays} días continuos (24h)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Gráfico de Barras con Selector Abajo a la Derecha + Inspector con Carrusel de Afiches */}
            <div className="row g-3 mb-3 align-items-stretch">
                {/* Columna Izquierda: Gráfico SVG de Barras con Selector al Pie Derecho */}
                <div className="col-12 col-xl-7">
                    <div
                        className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                    >
                        {/* Cabecera del gráfico */}
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div className="d-flex align-items-center gap-2">
                                <BarChart3 size={15} style={{ color: accentColor }} />
                                <span className="small fw-bold text-white text-uppercase" style={{ letterSpacing: '0.05em', fontSize: '0.74rem' }}>
                                    Consumo de Anime en Minutos por Fecha
                                </span>
                            </div>
                            <span className="small text-secondary font-mono d-none d-sm-inline" style={{ fontSize: '0.7rem' }}>
                                Clic en una barra para ver afiches
                            </span>
                        </div>

                        {/* Contenedor del Gráfico SVG */}
                        <div className="w-100 my-auto py-1">
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-100" style={{ maxHeight: 185, overflow: 'visible' }}>
                                {/* Líneas de cuadrícula horizontal Y */}
                                {[0, 0.33, 0.66, 1].map((pct, i) => {
                                    const y = pad.top + chartH - pct * chartH
                                    const valMins = Math.round(pct * maxMinutes)
                                    const valHrs = (valMins / 60).toFixed(1)

                                    return (
                                        <g key={i}>
                                            <line
                                                x1={pad.left}
                                                y1={y}
                                                x2={svgW - pad.right}
                                                y2={y}
                                                stroke="rgba(255, 255, 255, 0.06)"
                                                strokeDasharray="3 3"
                                            />
                                            <text
                                                x={pad.left - 6}
                                                y={y + 3.5}
                                                fill="#71717a"
                                                fontSize="9"
                                                fontFamily="monospace"
                                                textAnchor="end"
                                            >
                                                {valMins}m {valMins >= 60 ? `(${valHrs}h)` : ''}
                                            </text>
                                        </g>
                                    )
                                })}

                                {/* Barras Verticales de Consumo */}
                                {barData.map((b, idx) => {
                                    const x = pad.left + idx * barSpacing + (barSpacing - barWidth) / 2
                                    const barHeight = b.minutes > 0 ? Math.max(6, (b.minutes / maxMinutes) * chartH) : 0
                                    const y = pad.top + chartH - barHeight
                                    const isSel = activeBar?.id === b.id

                                    return (
                                        <g
                                            key={b.id}
                                            onClick={() => setSelectedBarIdx(idx)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <rect
                                                x={pad.left + idx * barSpacing}
                                                y={pad.top}
                                                width={barSpacing}
                                                height={chartH}
                                                fill={isSel ? 'rgba(255, 255, 255, 0.04)' : 'transparent'}
                                                style={{ transition: 'all 0.15s ease' }}
                                            />

                                            {b.minutes > 0 && (
                                                <rect
                                                    x={x}
                                                    y={y}
                                                    width={barWidth}
                                                    height={barHeight}
                                                    rx={4}
                                                    ry={4}
                                                    fill={
                                                        isSel
                                                            ? 'var(--perfil-cyan)'
                                                            : b.minutes >= 120
                                                            ? accentColor
                                                            : 'rgba(167, 139, 250, 0.75)'
                                                    }
                                                    filter={isSel ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))' : undefined}
                                                    style={{ transition: 'all 0.2s ease' }}
                                                />
                                            )}

                                            {b.minutes > 0 && (
                                                <text
                                                    x={x + barWidth / 2}
                                                    y={y - 4}
                                                    textAnchor="middle"
                                                    fill={isSel ? '#ffffff' : '#a1a1aa'}
                                                    fontSize="8.5"
                                                    fontWeight="700"
                                                    fontFamily="monospace"
                                                >
                                                    {b.minutes >= 60 ? `${b.hours}h` : `${b.minutes}m`}
                                                </text>
                                            )}

                                            <text
                                                x={x + barWidth / 2}
                                                y={svgH - 6}
                                                textAnchor="middle"
                                                fill={isSel ? '#ffffff' : '#71717a'}
                                                fontSize={isSel ? '10' : '9'}
                                                fontWeight={isSel ? '800' : '500'}
                                            >
                                                {b.label}
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>

                        {/* Pie del Gráfico: Info de la Barra Seleccionada + SELECTOR DE TIEMPO A LA DERECHA */}
                        <div
                            className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-1.5 pt-2 border-top"
                            style={{ borderColor: 'var(--perfil-border)' }}
                        >
                            <div className="small text-secondary font-mono d-flex align-items-center gap-1.5" style={{ fontSize: '0.71rem' }}>
                                <span>Barra activa:</span>
                                <strong className="text-white">{activeBar.label}</strong>
                                <span>•</span>
                                <span style={{ color: 'var(--perfil-cyan)' }}>{activeBar.minutes} min ({activeBar.hours} h)</span>
                            </div>

                            {/* Switcher de Tiempo en la esquina inferior derecha */}
                            <div
                                className="btn-group btn-group-sm p-0.5 rounded-pill border"
                                style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                            >
                                {(
                                    [
                                        { id: '7d', label: 'Últimos 7 días' },
                                        { id: '1y', label: 'Anual' },
                                        { id: 'all', label: 'Todo el tiempo' },
                                    ] as Array<{ id: WatchedTimeframe; label: string }>
                                ).map((btn) => (
                                    <button
                                        key={btn.id}
                                        type="button"
                                        onClick={() => {
                                            setTimeframe(btn.id)
                                            setSelectedBarIdx(null)
                                        }}
                                        className={`btn btn-sm rounded-pill px-2.5 py-0.5 font-mono ${
                                            timeframe === btn.id ? 'btn-primary' : 'text-secondary'
                                        }`}
                                        style={{
                                            fontSize: '0.71rem',
                                            background: timeframe === btn.id ? accentColor : 'transparent',
                                            borderColor: 'transparent',
                                            color: timeframe === btn.id ? '#ffffff' : 'inherit',
                                            fontWeight: timeframe === btn.id ? 700 : 500,
                                            transition: 'all 0.18s ease',
                                        }}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Inspector del Período con Carrusel de Afiches */}
                <div className="col-12 col-xl-5">
                    <div
                        className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div>
                            {/* Cabecera del Período */}
                            <div className="d-flex align-items-center justify-content-between mb-1">
                                <span className="ml-eyebrow" style={{ color: 'var(--perfil-cyan)' }}>
                                    PERÍODO INSPECCIONADO
                                </span>
                                <span
                                    className="badge rounded-pill font-mono px-2 py-0.5"
                                    style={{
                                        background: 'rgba(56, 189, 248, 0.14)',
                                        color: '#38bdf8',
                                        fontSize: '0.69rem',
                                    }}
                                >
                                    {activeBar.minutes} min ({activeBar.hours} h)
                                </span>
                            </div>

                            <div className="d-flex align-items-baseline justify-content-between mb-2">
                                <h4 className="h6 fw-bold text-white mb-0">{activeBar.sublabel}</h4>
                                <span className="small text-secondary font-mono" style={{ fontSize: '0.71rem' }}>
                                    {activeBar.episodes} eps en {activeBar.animes.length}{' '}
                                    {activeBar.animes.length === 1 ? 'anime' : 'animes'}
                                </span>
                            </div>
                        </div>

                        {/* Carrusel Horizontal de Afiches con Flechas Laterales */}
                        <div className="d-flex align-items-center gap-1.5 my-auto py-2">
                            {/* Flecha Izquierda */}
                            <button
                                type="button"
                                onClick={handleScrollLeft}
                                disabled={!canScrollLeft}
                                className="perfil-carousel-nav-btn"
                                aria-label="Afiche anterior"
                                title="Desplazar a la izquierda"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            {/* Pista de afiches (Solo carátulas de animes) */}
                            <div
                                ref={posterScrollRef}
                                onScroll={updateScrollButtons}
                                className="perfil-time-poster-carousel d-flex align-items-center gap-2 overflow-x-auto flex-grow-1 py-1 px-0.5"
                            >
                                {activeBar.animes.length === 0 ? (
                                    <div className="text-center py-4 w-100 text-secondary small" style={{ fontSize: '0.74rem' }}>
                                        No hay episodios registrados en esta fecha.
                                    </div>
                                ) : (
                                    activeBar.animes.map(({ fila, minutes, episodes }) => (
                                        <div
                                            key={fila.id}
                                            onClick={() => onSelectAnime?.(fila)}
                                            className="perfil-time-poster-item position-relative flex-shrink-0"
                                            title={`${fila.anime.title} • ${minutes}m (${episodes} eps) — Clic para abrir ficha`}
                                        >
                                            <img
                                                src={fila.anime.imageUrl}
                                                alt={fila.anime.title}
                                                className="perfil-time-poster-img"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.currentTarget.style.opacity = '0.5'
                                                }}
                                            />
                                            <div className="perfil-time-poster-overlay">
                                                <span className="perfil-time-poster-badge">{minutes}m</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Flecha Derecha */}
                            <button
                                type="button"
                                onClick={handleScrollRight}
                                disabled={!canScrollRight}
                                className="perfil-carousel-nav-btn"
                                aria-label="Afiche siguiente"
                                title="Desplazar a la derecha"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        <div className="d-flex align-items-center justify-content-between pt-1 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                            <span className="small text-secondary font-mono" style={{ fontSize: '0.69rem' }}>
                                Clic en un afiche para abrir ficha
                            </span>
                            <span className="small text-secondary font-mono" style={{ fontSize: '0.69rem' }}>
                                {activeBar.animes.length} disponibles
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Sección "DIMENSIONA TU TIEMPO" con Profesor Doki Doki y Puntitos Interactivos */}
            <div
                className="p-3.5 rounded-3 border"
                style={{
                    background: 'linear-gradient(180deg, var(--perfil-card) 0%, var(--perfil-card-2) 100%)',
                    borderColor: 'var(--perfil-border)',
                }}
                onMouseEnter={() => setIsDokiPaused(true)}
                onMouseLeave={() => setIsDokiPaused(false)}
            >
                {/* Cabecera de la sección */}
                <div
                    className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom"
                    style={{ borderColor: 'var(--perfil-border)' }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <span className="ml-eyebrow" style={{ color: 'var(--perfil-amber)', letterSpacing: '0.08em' }}>
                            DIMENSIONA TU TIEMPO · COMPARATIVA EN LA VIDA REAL
                        </span>
                        <span
                            className="badge rounded-pill font-mono px-2 py-0.5"
                            style={{ background: 'rgba(251, 191, 36, 0.14)', color: '#fbbf24', fontSize: '0.67rem' }}
                        >
                            {kpis.totalHours} Horas Totales
                        </span>
                    </div>

                    <span className="small text-secondary font-mono" style={{ fontSize: '0.71rem' }}>
                        {isDokiPaused ? 'Rotación pausada (lectura)' : 'Rotación cada 10s • Pausar al pasar el ratón'}
                    </span>
                </div>

                {/* Card Individual con Profesor Doki comentando en Globo de Texto */}
                <div className="my-1">
                    <ProfesorDoki
                        expression={currentDokiCard.expression}
                        size="md"
                        title="Profesor Doki Doki"
                        badgeText={`Hito ${activeDokiCard + 1} de ${dokiCards.length} · ${currentDokiCard.category}`}
                        align="left"
                        onPrevTip={() =>
                            setActiveDokiCard((prev) => (prev - 1 + dokiCards.length) % dokiCards.length)
                        }
                        onNextTip={() =>
                            setActiveDokiCard((prev) => (prev + 1) % dokiCards.length)
                        }
                        dialogue={
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1.5">
                                    {currentDokiCard.icon}
                                    <span
                                        className="h6 fw-bold mb-0 font-mono"
                                        style={{ color: currentDokiCard.color, fontSize: '0.96rem' }}
                                    >
                                        {currentDokiCard.headline}
                                    </span>
                                </div>
                                <p
                                    className="small text-secondary mb-0"
                                    style={{ fontSize: '0.76rem', lineHeight: 1.48 }}
                                >
                                    {currentDokiCard.quote}
                                </p>
                            </div>
                        }
                    />
                </div>

                {/* Puntitos de Navegación Interactivos */}
                <div className="d-flex align-items-center justify-content-center gap-2 mt-2">
                    {dokiCards.map((card, idx) => (
                        <button
                            key={card.id}
                            type="button"
                            onClick={() => setActiveDokiCard(idx)}
                            className="perfil-doki-dot"
                            style={{
                                width: activeDokiCard === idx ? 24 : 8,
                                background: activeDokiCard === idx ? card.color : 'rgba(255, 255, 255, 0.2)',
                            }}
                            aria-label={`Ver hito: ${card.title}`}
                            title={`${card.title}: ${card.headline}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
