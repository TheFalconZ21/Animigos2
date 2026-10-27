import React, { useState, useMemo } from 'react'
import {
    Clock,
    CheckCircle,
    Bookmark,
    Heart,
    Layers,
    TrendingUp,
} from 'lucide-react'
import type { FilaLista } from '../mi-lista/mi-lista-data'
import { ESCALA_NOTAS } from '../mi-lista/mi-lista-data'
import { AnimeDetalleDialog } from '../mi-lista/AnimeDetalleDialog'

interface AnimeStatsDashboardProps {
    filas: FilaLista[]
    showStats?: boolean
    onUpdateFila?: (id: string, updates: any) => void
}

export const AnimeStatsDashboard: React.FC<AnimeStatsDashboardProps> = ({
    filas,
    showStats = true,
    onUpdateFila,
}) => {
    const [selectedAnime, setSelectedAnime] = useState<FilaLista | null>(null)

    // 1. Cálculos de Tiempos y Métricas de Visionado
    const stats = useMemo(() => {
        const totalEntries = filas.length
        const vistos = filas.filter((f) => f.estado === 'visto').length
        const viendo = filas.filter((f) => f.estado === 'viendo').length
        const pendientes = filas.filter((f) => f.estado === 'pendiente').length
        const dropeados = filas.filter((f) => (f as any).estado === 'dropeado').length

        // Minutos calculados: si está visto, cuenta total de eps; si está viendo, cuenta vistos
        const totalMinutos = filas.reduce((acc, f) => {
            const eps = f.estado === 'visto' ? f.anime.episodes || 12 : f.episodiosVistos || 0
            return acc + eps * 24
        }, 0)

        const totalHoras = Math.round(totalMinutos / 60)
        const totalDias = (totalMinutos / (60 * 24)).toFixed(1)

        // Nota Media
        const notas = filas
            .map((f) => f.nota)
            .filter((n): n is number => typeof n === 'number' && n > 0)
        const notaMedia = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0
        const notaEscala = notas.length > 0 ? (ESCALA_NOTAS[Math.round(notaMedia)] || 'Sin calificación') : 'Sin calificaciones'

        // Porcentajes para barra segmentada
        const pctVisto = totalEntries > 0 ? (vistos / totalEntries) * 100 : 0
        const pctViendo = totalEntries > 0 ? (viendo / totalEntries) * 100 : 0
        const pctPendiente = totalEntries > 0 ? (pendientes / totalEntries) * 100 : 0
        const pctDropeado = totalEntries > 0 ? (dropeados / totalEntries) * 100 : 0

        // Animes Favoritos (Top 10)
        const favsMarcados = filas.filter((f) => f.favorito)
        const restantes = [...filas]
            .filter((f) => !f.favorito)
            .sort((a, b) => (b.nota ?? b.anime.score ?? 0) - (a.nota ?? a.anime.score ?? 0))

        const top10 = [...favsMarcados, ...restantes].slice(0, 10)

        return {
            totalEntries,
            vistos,
            viendo,
            pendientes,
            dropeados,
            totalMinutos,
            totalHoras,
            totalDias,
            notaMedia,
            notaEscala,
            pctVisto,
            pctViendo,
            pctPendiente,
            pctDropeado,
            top10,
        }
    }, [filas])

    // Gauge circular SVG (Radio 32, Circunferencia ~201)
    const gaugeRadius = 32
    const circumference = 2 * Math.PI * gaugeRadius
    const gaugeOffset = circumference - (stats.notaMedia / 10) * circumference

    if (!showStats) {
        return (
            <div className="perfil-breakdown-card text-center py-5">
                <span className="small text-secondary">
                    🔒 Las estadísticas de este usuario son privadas.
                </span>
            </div>
        )
    }

    return (
        <>
            {/* Grilla de Métricas Clave */}
            <div className="perfil-metric-grid">
                {/* 1. Tiempo Total Visto */}
                <div className="perfil-metric-card">
                    <div className="perfil-metric-icon" style={{ color: 'var(--perfil-acento)' }}>
                        <Clock size={20} />
                    </div>
                    <div>
                        <div className="perfil-metric-value">
                            {stats.totalDias} <span style={{ fontSize: '0.9rem', color: 'var(--perfil-text-dim)', fontWeight: 600 }}>días</span>
                        </div>
                        <div className="perfil-metric-label">~{stats.totalHoras} Horas de Anime</div>
                    </div>
                </div>

                {/* 2. Nota Media con Medidor Circular */}
                <div className="perfil-metric-card">
                    <div className="perfil-gauge-wrap">
                        <svg width="74" height="74" className="perfil-gauge-svg">
                            <circle cx="37" cy="37" r={gaugeRadius} className="perfil-gauge-bg" />
                            <circle
                                cx="37"
                                cy="37"
                                r={gaugeRadius}
                                className="perfil-gauge-meter"
                                strokeDasharray={circumference}
                                strokeDashoffset={gaugeOffset}
                            />
                        </svg>
                        <span className="perfil-gauge-number">{stats.notaMedia.toFixed(1)}</span>
                    </div>
                    <div>
                        <div className="perfil-metric-value" style={{ fontSize: '1.25rem' }}>
                            {stats.notaEscala}
                        </div>
                        <div className="perfil-metric-label">Nota Media Otorgada</div>
                    </div>
                </div>

                {/* 3. Total en Colección */}
                <div className="perfil-metric-card">
                    <div className="perfil-metric-icon" style={{ color: 'var(--perfil-cyan)' }}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <div className="perfil-metric-value">{stats.totalEntries}</div>
                        <div className="perfil-metric-label">Animes en Colección</div>
                    </div>
                </div>

                {/* 4. Completados */}
                <div className="perfil-metric-card">
                    <div className="perfil-metric-icon" style={{ color: 'var(--perfil-green)' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <div className="perfil-metric-value">{stats.vistos}</div>
                        <div className="perfil-metric-label">Completados / Vistos</div>
                    </div>
                </div>
            </div>

            {/* Barra de Desglose de Estado (Estilo Mi Lista) */}
            <div className="perfil-breakdown-card">
                <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="small fw-semibold text-white d-flex align-items-center gap-2">
                        <TrendingUp size={15} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Distribución de Estados de Visionado</span>
                    </span>
                    <span className="small font-mono text-secondary" style={{ fontSize: '0.75rem' }}>
                        {stats.totalEntries} títulos
                    </span>
                </div>

                {/* Barra Segmentada */}
                {stats.totalEntries > 0 ? (
                    <div className="perfil-breakdown-bar">
                        <div
                            className="perfil-breakdown-seg perfil-seg-visto"
                            style={{ width: `${stats.pctVisto}%` }}
                            title={`Vistos: ${stats.vistos} (${stats.pctVisto.toFixed(0)}%)`}
                        />
                        <div
                            className="perfil-breakdown-seg perfil-seg-viendo"
                            style={{ width: `${stats.pctViendo}%` }}
                            title={`Viendo: ${stats.viendo} (${stats.pctViendo.toFixed(0)}%)`}
                        />
                        <div
                            className="perfil-breakdown-seg perfil-seg-pendiente"
                            style={{ width: `${stats.pctPendiente}%` }}
                            title={`Pendientes: ${stats.pendientes} (${stats.pctPendiente.toFixed(0)}%)`}
                        />
                        {stats.pctDropeado > 0 && (
                            <div
                                className="perfil-breakdown-seg perfil-seg-dropeado"
                                style={{ width: `${stats.pctDropeado}%` }}
                                title={`Dropeados: ${stats.dropeados} (${stats.pctDropeado.toFixed(0)}%)`}
                            />
                        )}
                    </div>
                ) : (
                    <div className="py-2 text-center text-secondary small">
                        Tu colección está vacía. Agrega animes en "Mi lista" para ver tu distribución aquí.
                    </div>
                )}

                {/* Leyenda */}
                <div className="d-flex flex-wrap align-items-center gap-3 pt-1">
                    <div className="perfil-legend-item">
                        <span className="perfil-legend-dot perfil-seg-visto" />
                        <span>Vistos: <strong>{stats.vistos}</strong> ({stats.pctVisto.toFixed(0)}%)</span>
                    </div>
                    <div className="perfil-legend-item">
                        <span className="perfil-legend-dot perfil-seg-viendo" />
                        <span>Viendo: <strong>{stats.viendo}</strong> ({stats.pctViendo.toFixed(0)}%)</span>
                    </div>
                    <div className="perfil-legend-item">
                        <span className="perfil-legend-dot perfil-seg-pendiente" />
                        <span>Pendientes: <strong>{stats.pendientes}</strong> ({stats.pctPendiente.toFixed(0)}%)</span>
                    </div>
                    {stats.dropeados > 0 && (
                        <div className="perfil-legend-item">
                            <span className="perfil-legend-dot perfil-seg-dropeado" />
                            <span>Dropeados: <strong>{stats.dropeados}</strong></span>
                        </div>
                    )}
                </div>
            </div>

            {/* Animes Favoritos (Top 10) */}
            <div className="perfil-fav-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                        <span className="ml-eyebrow">HALLE DE LA FAMA · PERSONAL</span>
                        <h4 className="h6 fw-bold text-white mb-0 d-flex align-items-center gap-1.5">
                            <Heart size={15} style={{ color: 'var(--perfil-pink)' }} />
                            <span>Animes Favoritos (Top 10)</span>
                        </h4>
                    </div>
                    <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>
                        Haz clic en una portada para detalles
                    </span>
                </div>

                <div className="perfil-fav-grid">
                    {stats.top10.map((f, index) => (
                        <div
                            key={f.id}
                            className="perfil-fav-item"
                            onClick={() => setSelectedAnime(f)}
                            title={`${f.anime.title} (Rank #${index + 1})`}
                        >
                            <img src={f.anime.imageUrl} alt={f.anime.title} loading="lazy" />
                            <span className="perfil-fav-rank">#{index + 1}</span>
                            <span className="perfil-fav-score">
                                ★ {f.nota ?? f.anime.score}
                            </span>
                        </div>
                    ))}

                    {/* Espacios vacíos si tiene menos de 10 */}
                    {Array.from({ length: Math.max(0, 10 - stats.top10.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="perfil-fav-empty">
                            <Bookmark size={16} />
                            <span>#{stats.top10.length + i + 1}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Detalle al hacer clic en un favorito */}
            {selectedAnime && (
                <AnimeDetalleDialog
                    fila={selectedAnime}
                    onCerrar={() => setSelectedAnime(null)}
                    onActualizar={(cambios) => {
                        onUpdateFila?.(selectedAnime.id, cambios)
                        setSelectedAnime((prev) => (prev ? { ...prev, ...cambios } : null))
                    }}
                    onRecomendar={() => {
                        // feedback
                    }}
                />
            )}
        </>
    )
}
