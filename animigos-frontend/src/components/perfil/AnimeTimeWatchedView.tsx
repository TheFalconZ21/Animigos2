import React, { useState, useMemo } from 'react'
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
} from 'lucide-react'
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

                // Filtrar animes creados/actualizados en esta fecha
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

            // Si los animes no tienen fecha exacta pero están en la lista, distribuirlos en Hoy para visibilidad
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

            // Si ningún anime coincidió con el año actual, asignamos al mes actual
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

        // Asegurar una vista armoniosa con al menos 3 años
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

        // Si los animes no tenían año y quedaron vacíos, asignamos al año actual
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
        // Seleccionar por defecto la barra con mayor consumo o la última con datos
        const maxBar = [...barData].reverse().find((b) => b.minutes > 0)
        return maxBar || barData[barData.length - 1]
    }, [barData, selectedBarIdx])

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

        // 4. Vueltas al mundo en avión (~45 horas en vuelo comercial ininterrumpido alrededor del globo)
        const worldTours = +(hours / 45).toFixed(1)

        // 5. Maratones / Caminata continua (~5 km/h a pie)
        const marathons = Math.max(1, Math.round(hours / 4.2))
        const kmWalked = Math.round(hours * 5)

        return {
            books,
            languages,
            vocabWords,
            collegePct,
            semestres,
            ectsCredits,
            worldTours,
            marathons,
            kmWalked,
        }
    }, [kpis.totalHours])

    // Parámetros de Dibujo SVG para el Gráfico de Barras
    const svgW = 660
    const svgH = 220
    const pad = { top: 22, right: 24, bottom: 32, left: 56 }
    const chartW = svgW - pad.left - pad.right
    const chartH = svgH - pad.top - pad.bottom

    const maxMinutes = Math.max(60, ...barData.map((b) => b.minutes))
    const barSpacing = chartW / barData.length
    const barWidth = Math.max(16, Math.min(48, barSpacing * 0.62))

    return (
        <div className="perfil-time-watched-container mb-4">
            {/* 1. Header con Título y Switcher de Rango Temporal */}
            <div
                className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom"
                style={{ borderColor: 'var(--perfil-border)' }}
            >
                <div>
                    <span className="ml-eyebrow" style={{ color: accentColor, letterSpacing: '0.08em' }}>
                        SUBVISTA DEDICADA · TIEMPO CONSUMIDO
                    </span>
                    <h3 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                        <Clock size={18} style={{ color: accentColor }} />
                        <span>Consumo de Anime y Dimensión Temporal</span>
                    </h3>
                    <p className="small text-secondary mb-0 mt-1" style={{ fontSize: '0.76rem' }}>
                        Supervisa tus minutos reales frente a la pantalla y descubre a qué equivalen en logros del mundo real.
                    </p>
                </div>

                {/* Switcher de 3 Tiempos: Últimos 7 días, Anual, Todo el tiempo */}
                <div
                    className="btn-group btn-group-sm p-0.5 rounded-pill border"
                    style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
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
                            className={`btn btn-sm rounded-pill px-3 py-1 font-mono ${
                                timeframe === btn.id ? 'btn-primary' : 'text-secondary'
                            }`}
                            style={{
                                fontSize: '0.73rem',
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

            {/* 2. Los 4 KPIs Principales de Tiempo y Consumo */}
            <div className="row g-3 mb-4">
                {/* 1. Capítulos Vistos */}
                <div className="col-6 col-lg-3">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                Capítulos Vistos
                            </span>
                            <Tv size={16} style={{ color: accentColor }} />
                        </div>
                        <div>
                            <div className="h3 fw-bold text-white mb-0 font-mono">
                                {kpis.seriesEpisodes.toLocaleString()}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.82rem' }}>
                                    eps
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                Series TV, OVA, ONA y especiales
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Películas Vistas */}
                <div className="col-6 col-lg-3">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                Películas Vistas
                            </span>
                            <Film size={16} style={{ color: 'var(--perfil-pink)' }} />
                        </div>
                        <div>
                            <div
                                className="h3 fw-bold mb-0 font-mono"
                                style={{ color: 'var(--perfil-pink)' }}
                            >
                                {kpis.moviesCount}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.82rem' }}>
                                    {kpis.moviesCount === 1 ? 'película' : 'películas'}
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                Largometrajes autoconclusivos
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Tiempo en Horas */}
                <div className="col-6 col-lg-3">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                Tiempo en Horas
                            </span>
                            <Clock size={16} style={{ color: 'var(--perfil-cyan)' }} />
                        </div>
                        <div>
                            <div
                                className="h3 fw-bold mb-0 font-mono"
                                style={{ color: 'var(--perfil-cyan)' }}
                            >
                                {kpis.totalHours.toLocaleString()}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.82rem' }}>
                                    h
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                Horas acumuladas de visionado
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Tiempo en Días */}
                <div className="col-6 col-lg-3">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                                Tiempo en Días
                            </span>
                            <Calendar size={16} style={{ color: 'var(--perfil-amber)' }} />
                        </div>
                        <div>
                            <div
                                className="h3 fw-bold mb-0 font-mono"
                                style={{ color: 'var(--perfil-amber)' }}
                            >
                                {kpis.totalDays}
                                <span className="small text-secondary fw-normal ms-1" style={{ fontSize: '0.82rem' }}>
                                    días
                                </span>
                            </div>
                            <span className="small text-secondary" style={{ fontSize: '0.7rem' }}>
                                Equivalente continuo (24 h seguidas)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Gráfico de Barras de Consumo en Minutos por Fecha + Inspector de Período */}
            <div className="row g-4 mb-4 align-items-stretch">
                {/* Columna Izquierda: Gráfico SVG de Barras */}
                <div className="col-12 col-xl-8">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="d-flex align-items-center gap-2">
                                <BarChart3 size={16} style={{ color: accentColor }} />
                                <span className="small fw-bold text-white text-uppercase" style={{ letterSpacing: '0.05em', fontSize: '0.76rem' }}>
                                    Consumo de Anime en Minutos por Fecha
                                </span>
                            </div>
                            <span className="small text-secondary font-mono" style={{ fontSize: '0.72rem' }}>
                                Haz clic en una barra para ver sus animes
                            </span>
                        </div>

                        {/* Contenedor del Gráfico SVG */}
                        <div className="w-100 my-auto py-2">
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-100" style={{ maxHeight: 220, overflow: 'visible' }}>
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
                                                x={pad.left - 8}
                                                y={y + 3.5}
                                                fill="#71717a"
                                                fontSize="9.5"
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
                                            {/* Fondo sutil de columna para facilitar clic */}
                                            <rect
                                                x={pad.left + idx * barSpacing}
                                                y={pad.top}
                                                width={barSpacing}
                                                height={chartH}
                                                fill={isSel ? 'rgba(255, 255, 255, 0.04)' : 'transparent'}
                                                style={{ transition: 'all 0.15s ease' }}
                                            />

                                            {/* Barra Real */}
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

                                            {/* Etiqueta de valor sobre la barra */}
                                            {b.minutes > 0 && (
                                                <text
                                                    x={x + barWidth / 2}
                                                    y={y - 5}
                                                    textAnchor="middle"
                                                    fill={isSel ? '#ffffff' : '#a1a1aa'}
                                                    fontSize="9"
                                                    fontWeight="700"
                                                    fontFamily="monospace"
                                                >
                                                    {b.minutes >= 60 ? `${b.hours}h` : `${b.minutes}m`}
                                                </text>
                                            )}

                                            {/* Etiqueta del eje X */}
                                            <text
                                                x={x + barWidth / 2}
                                                y={svgH - 8}
                                                textAnchor="middle"
                                                fill={isSel ? '#ffffff' : '#71717a'}
                                                fontSize={isSel ? '10.5' : '9.5'}
                                                fontWeight={isSel ? '800' : '500'}
                                            >
                                                {b.label}
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Inspector del Período Seleccionado */}
                <div className="col-12 col-xl-4">
                    <div
                        className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                        style={{ background: 'var(--perfil-card)', borderColor: 'var(--perfil-border)' }}
                    >
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="ml-eyebrow" style={{ color: 'var(--perfil-cyan)' }}>
                                    PERÍODO INSPECCIONADO
                                </span>
                                <span
                                    className="badge rounded-pill font-mono px-2 py-0.5"
                                    style={{
                                        background: 'rgba(56, 189, 248, 0.14)',
                                        color: '#38bdf8',
                                        fontSize: '0.7rem',
                                    }}
                                >
                                    {activeBar.minutes} min ({activeBar.hours} h)
                                </span>
                            </div>

                            <h4 className="h6 fw-bold text-white mb-1">{activeBar.sublabel}</h4>
                            <p className="small text-secondary mb-3" style={{ fontSize: '0.74rem' }}>
                                {activeBar.episodes} episodios consumidos en {activeBar.animes.length}{' '}
                                {activeBar.animes.length === 1 ? 'anime' : 'animes'}.
                            </p>

                            {/* Lista de Animes en este período */}
                            <div className="d-flex flex-column gap-2 overflow-auto pe-1 perfil-thin-scrollbar" style={{ maxHeight: 220 }}>
                                {activeBar.animes.length === 0 ? (
                                    <div className="perfil-contrast-empty py-4 text-center">
                                        <Clock size={24} className="text-secondary opacity-50 mb-1" />
                                        <div className="small text-secondary">
                                            No se registraron episodios ni minutos en esta fecha.
                                        </div>
                                    </div>
                                ) : (
                                    activeBar.animes.map(({ fila, minutes, episodes }) => (
                                        <div
                                            key={fila.id}
                                            onClick={() => onSelectAnime?.(fila)}
                                            className="p-2 rounded-3 border d-flex align-items-center gap-2.5"
                                            style={{
                                                background: 'var(--perfil-card-2)',
                                                borderColor: 'var(--perfil-border)',
                                                cursor: 'pointer',
                                                transition: 'all 0.16s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--perfil-cyan)'
                                                e.currentTarget.style.transform = 'translateY(-1px)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--perfil-border)'
                                                e.currentTarget.style.transform = 'none'
                                            }}
                                            title={`${fila.anime.title} — Clic para abrir ficha`}
                                        >
                                            <img
                                                src={fila.anime.imageUrl}
                                                alt={fila.anime.title}
                                                style={{ width: 34, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                                            />
                                            <div className="flex-grow-1 min-w-0">
                                                <div className="d-flex align-items-center justify-content-between gap-1 mb-0.5">
                                                    <span className="small fw-bold text-white text-truncate" style={{ fontSize: '0.78rem' }}>
                                                        {fila.anime.title}
                                                    </span>
                                                    <span className="small font-mono fw-bold flex-shrink-0" style={{ color: 'var(--perfil-cyan)', fontSize: '0.72rem' }}>
                                                        {minutes}m
                                                    </span>
                                                </div>
                                                <div className="small text-secondary d-flex align-items-center gap-2" style={{ fontSize: '0.69rem' }}>
                                                    <span>{episodes} eps vistos</span>
                                                    <span>• {fila.anime.durationMinutes || 24} min/ep</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Sección "DIMENSIONA TU TIEMPO" (Equivalencias en la Vida Real) */}
            <div
                className="p-4 rounded-3 border"
                style={{
                    background: 'linear-gradient(180deg, var(--perfil-card) 0%, var(--perfil-card-2) 100%)',
                    borderColor: 'var(--perfil-border)',
                }}
            >
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--perfil-border)' }}>
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="ml-eyebrow" style={{ color: 'var(--perfil-amber)', letterSpacing: '0.08em' }}>
                                DIMENSIONA TU TIEMPO · COMPARATIVA EN LA VIDA REAL
                            </span>
                            <span className="badge rounded-pill font-mono px-2 py-0.5" style={{ background: 'rgba(251, 191, 36, 0.14)', color: '#fbbf24', fontSize: '0.67rem' }}>
                                {kpis.totalHours} Horas Totales
                            </span>
                        </div>
                        <h4 className="h5 fw-bold text-white mb-0 d-flex align-items-center gap-2">
                            <Sparkles size={18} style={{ color: 'var(--perfil-amber)' }} />
                            <span>¿Qué habrías logrado en este tiempo?</span>
                        </h4>
                    </div>

                    <span className="small text-secondary font-mono" style={{ fontSize: '0.73rem' }}>
                        Basado en estándares internacionales de estudio y aprendizaje
                    </span>
                </div>

                {/* Grid de 4 Hitos Reales */}
                <div className="row g-3">
                    {/* Hito 1: Libros Leídos */}
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div
                            className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between"
                            style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small text-secondary fw-bold" style={{ fontSize: '0.72rem' }}>
                                    Lectura de Libros
                                </span>
                                <BookOpen size={16} style={{ color: '#38bdf8' }} />
                            </div>
                            <div>
                                <div className="h4 fw-bold mb-1 font-mono" style={{ color: '#38bdf8' }}>
                                    ~{timeEquivalences.books} libros
                                </div>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.71rem', lineHeight: 1.4 }}>
                                    Habrías terminado cerca de <strong>{timeEquivalences.books}</strong> novelas u obras completas de 300 páginas (a 250 palabras por minuto).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Hito 2: Idiomas Aprendidos */}
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div
                            className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between"
                            style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small text-secondary fw-bold" style={{ fontSize: '0.72rem' }}>
                                    Aprendizaje de Idiomas
                                </span>
                                <Languages size={16} style={{ color: '#a78bfa' }} />
                            </div>
                            <div>
                                <div className="h4 fw-bold mb-1 font-mono" style={{ color: '#a78bfa' }}>
                                    {kpis.totalHours >= 200
                                        ? `~${timeEquivalences.languages} idiomas`
                                        : `~${timeEquivalences.vocabWords} palabras`}
                                </div>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.71rem', lineHeight: 1.4 }}>
                                    {kpis.totalHours >= 200
                                        ? `Dominio conversacional funcional B1 según el marco del Foreign Service Institute (FSI).`
                                        : `Habrías completado ${Math.round(kpis.totalHours * 3)} lecciones intensivas en un nuevo idioma.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Hito 3: Carrera Universitaria */}
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div
                            className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between"
                            style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small text-secondary fw-bold" style={{ fontSize: '0.72rem' }}>
                                    Carrera Universitaria
                                </span>
                                <GraduationCap size={16} style={{ color: '#34d399' }} />
                            </div>
                            <div>
                                <div className="h4 fw-bold mb-1 font-mono" style={{ color: '#34d399' }}>
                                    {kpis.totalHours >= 3600
                                        ? `~${(kpis.totalHours / 3600).toFixed(1)} carreras`
                                        : kpis.totalHours >= 450
                                        ? `~${timeEquivalences.semestres} semestres`
                                        : `${timeEquivalences.collegePct}% de carrera`}
                                </div>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.71rem', lineHeight: 1.4 }}>
                                    {kpis.totalHours >= 450
                                        ? `Equivalente a ${timeEquivalences.semestres} semestres lectivos completos de educación superior.`
                                        : `Acreditación de ~${timeEquivalences.ectsCredits} créditos ECTS en un grado universitario oficial.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Hito 4: Vueltas al Mundo en Avión */}
                    <div className="col-12 col-sm-6 col-xl-3">
                        <div
                            className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between"
                            style={{ background: 'var(--perfil-card-2)', borderColor: 'var(--perfil-border)' }}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small text-secondary fw-bold" style={{ fontSize: '0.72rem' }}>
                                    Vueltas al Mundo
                                </span>
                                <Plane size={16} style={{ color: '#fbbf24' }} />
                            </div>
                            <div>
                                <div className="h4 fw-bold mb-1 font-mono" style={{ color: '#fbbf24' }}>
                                    ~{timeEquivalences.worldTours} vueltas
                                </div>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.71rem', lineHeight: 1.4 }}>
                                    Recorrido del perímetro del planeta en vuelo comercial continuo (45 h por circunvalación).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
