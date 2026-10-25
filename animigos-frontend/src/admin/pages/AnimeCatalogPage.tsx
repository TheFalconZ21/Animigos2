import { useState, useEffect } from 'react'
import {
    Film,
    Search,
    Flame,
    Trophy,
    Compass,
    Star,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import { getAnimes } from '../services/adminApi'
import type { AnimeItem } from '../services/adminApi'

export function AnimeCatalogPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGenre, setSelectedGenre] = useState('Todos')
    const [animes, setAnimes] = useState<AnimeItem[]>([])
    const [totalCount, setTotalCount] = useState<number>(19384)
    const [page, setPage] = useState<number>(1)
    const [loading, setLoading] = useState<boolean>(true)

    const genresList = ['Todos', 'Action', 'Adventure', 'Fantasy', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Mystery']

    const fetchCatalog = async () => {
        setLoading(true)
        try {
            const data = await getAnimes({
                page,
                q: searchQuery.trim(),
                genre: selectedGenre === 'Todos' ? '' : selectedGenre,
                ordering: '-score'
            })
            setAnimes(data.results)
            setTotalCount(data.count)
        } catch (err) {
            console.error('Error fetching animes:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchCatalog()
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [searchQuery, selectedGenre, page])

    return (
        <div>
            {/* Header del módulo */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0">
                        Catálogo & Desempeño de Animes
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Catálogo oficial alojado en AWS PostgreSQL 16 (19.384 series indexadas)
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="admin-badge admin-badge-success font-mono">
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--admin-emerald)' }}></span>
                        {totalCount.toLocaleString()} series disponibles
                    </span>
                </div>
            </div>

            {/* ============================================================
               1. FILA DE KPIS PRINCIPALES (4 Columnas)
               ============================================================ */}
            <section className="admin-grid-kpis mb-3">
                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Catálogo Activo
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Film size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">{totalCount.toLocaleString()}</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>títulos</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            100% en AWS RDS
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            PostgreSQL 16
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Top Anime Calificado
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Flame size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-4 fw-bold text-white lh-1 text-truncate" style={{ maxWidth: 170 }}>
                                {animes[0]?.title || 'Fullmetal Alchemist'}
                            </span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            Score: {animes[0]?.score || '9.0'}
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            {animes[0]?.studio || 'Bones'}
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Consenso de Títulos
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Trophy size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1 font-mono">91.8%</span>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>satisfacción</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-success font-mono">
                            Win Rate Óptimo
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Algoritmo Calibrado
                        </span>
                    </div>
                </div>

                <div className="admin-card d-flex flex-column justify-content-between">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em', color: 'var(--admin-text-muted)', fontWeight: 600 }}>
                                Género Predominante
                            </span>
                            <div className="p-1 rounded" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                <Compass size={13} />
                            </div>
                        </div>
                        <div className="d-flex align-baseline gap-2 mb-1">
                            <span className="fs-3 fw-bold text-white lh-1">Acción & Fantasía</span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-neutral font-mono">
                            48% catálogo
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Base indexada
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. EXPLORADOR DE ANIMES DE ALTO RENDIMIENTO
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>Explorador de Rendimiento de Anime</h2>
                        <span className="admin-subtitle">
                            Resultados directos del catálogo en la nube (Página {page})
                        </span>
                    </div>

                    <div className="admin-input-wrapper d-flex align-items-center gap-2">
                        <Search size={13} style={{ color: 'var(--admin-text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar anime en DB..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setPage(1)
                            }}
                            className="bg-transparent border-0 text-white font-mono"
                            style={{ outline: 'none', width: 160, fontSize: '0.74rem' }}
                        />
                    </div>
                </div>

                {/* Filtros de género */}
                <div className="d-flex align-items-center gap-1 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                    {genresList.map((g) => (
                        <button
                            key={g}
                            type="button"
                            onClick={() => {
                                setSelectedGenre(g)
                                setPage(1)
                            }}
                            className="admin-btn py-0.5 px-2"
                            style={{
                                fontSize: '0.7rem',
                                backgroundColor: selectedGenre === g ? 'var(--admin-surface-3)' : 'transparent',
                                color: selectedGenre === g ? '#FFFFFF' : 'var(--admin-text-secondary)',
                                border: selectedGenre === g ? '1px solid var(--admin-border-divider)' : '1px solid transparent',
                                borderRadius: 'var(--radius-sm)'
                            }}
                        >
                            {g}
                        </button>
                    ))}
                </div>

                {/* Tabla de animes reales */}
                <div className="table-responsive custom-scrollbar" style={{ minHeight: 340 }}>
                    {loading ? (
                        <div className="d-flex flex-column gap-2 py-2">
                            <div className="admin-skeleton" style={{ height: 40, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 40, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 40, width: '100%' }}></div>
                            <div className="admin-skeleton" style={{ height: 40, width: '100%' }}></div>
                        </div>
                    ) : animes.length === 0 ? (
                        <div className="text-center py-5 text-secondary font-mono" style={{ fontSize: '0.8rem' }}>
                            No se encontraron animes para los filtros aplicados.
                        </div>
                    ) : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ANIME</th>
                                    <th>ESTUDIO</th>
                                    <th>AÑO / TIPO</th>
                                    <th className="text-center">MAL SCORE</th>
                                    <th className="text-center">EPISODIOS</th>
                                    <th className="pe-2 text-end">POPULARIDAD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {animes.map((a) => (
                                    <tr key={a.mal_id} className="admin-table-row">
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {a.image_url ? (
                                                    <img
                                                        src={a.image_url}
                                                        alt={a.title}
                                                        style={{ width: 26, height: 36, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--admin-border-subtle)' }}
                                                        onError={(e) => {
                                                            e.currentTarget.onerror = null;
                                                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='36' viewBox='0 0 26 36'%3E%3Crect width='26' height='36' fill='%23141414'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%2371717A' font-size='9' font-family='sans-serif'%3EANIME%3C/text%3E%3C/svg%3E";
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ width: 26, height: 36, backgroundColor: '#141414', borderRadius: 'var(--radius-sm)', border: '1px solid var(--admin-border-subtle)' }}></div>
                                                )}
                                                <div>
                                                    <div className="fw-semibold text-white text-truncate" style={{ maxWidth: 220, fontSize: '0.78rem' }}>
                                                        {a.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)' }}>
                                                        {a.genres?.slice(0, 3).join(' · ') || 'Anime'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-secondary" style={{ fontSize: '0.74rem' }}>
                                            {a.studio || 'Desconocido'}
                                        </td>
                                        <td className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>
                                            {a.season_year || '—'} · {a.type}
                                        </td>
                                        <td className="text-center font-mono">
                                            <span className="admin-badge admin-badge-success d-inline-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                                                <Star size={10} style={{ color: '#F59E0B' }} />
                                                {a.score ? Number(a.score).toFixed(2) : '—'}
                                            </span>
                                        </td>
                                        <td className="text-center font-mono text-secondary" style={{ fontSize: '0.74rem' }}>
                                            {a.episodes ? `${a.episodes} eps` : '—'}
                                        </td>
                                        <td className="pe-2 text-end font-mono" style={{ fontSize: '0.74rem', color: 'var(--admin-text-muted)' }}>
                                            {a.scored_by ? `${(a.scored_by / 1000).toFixed(0)}k miembros` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Paginación */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                    <span className="font-mono text-secondary" style={{ fontSize: '0.72rem' }}>
                        Página {page} · Mostrando 24 de {totalCount.toLocaleString()} títulos
                    </span>

                    <div className="d-flex gap-1">
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                        >
                            <ChevronLeft size={13} />
                            <span>Anterior</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(p => p + 1)}
                            disabled={animes.length < 24 || loading}
                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                        >
                            <span>Siguiente</span>
                            <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
