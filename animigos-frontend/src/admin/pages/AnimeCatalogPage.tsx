import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    Film,
    Search,
    Flame,
    Trophy,
    Compass,
    Star,
    ChevronLeft,
    ChevronRight,
    Edit3,
    ExternalLink,
    X,
    Check,
    Image as ImageIcon,
    Plus,
    Tag,
    Sparkles,
    AlertCircle
} from 'lucide-react'
import { getAnimes, updateAdminAnime } from '../services/adminApi'
import type { AnimeItem, AdminAnimeUpdatePayload } from '../services/adminApi'

export function AnimeCatalogPage() {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGenre, setSelectedGenre] = useState('Todos')
    const [animes, setAnimes] = useState<AnimeItem[]>([])
    const [totalCount, setTotalCount] = useState<number>(19384)
    const [page, setPage] = useState<number>(1)
    const [loading, setLoading] = useState<boolean>(true)

    // Estado del modal de edición de anime
    const [editingAnime, setEditingAnime] = useState<AnimeItem | null>(null)
    const [formData, setFormData] = useState<AdminAnimeUpdatePayload>({})
    const [newGenreInput, setNewGenreInput] = useState('')
    const [newTagName, setNewTagName] = useState('')
    const [newTagCategory, setNewTagCategory] = useState('Theme')
    const [newTagRank, setNewTagRank] = useState<number>(80)
    const [saving, setSaving] = useState(false)
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    const genresList = [
        'Todos',
        'Action',
        'Adventure',
        'Fantasy',
        'Isekai',
        'Comedy',
        'Drama',
        'Sci-Fi',
        'Romance',
        'Mystery',
        'Supernatural',
        'Suspense',
        'Mecha'
    ]

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

    const handleOpenEdit = (anime: AnimeItem) => {
        setEditingAnime(anime)
        setSaveFeedback(null)
        setNewGenreInput('')
        setNewTagName('')
        setFormData({
            title: anime.title || '',
            title_english: anime.title_english || '',
            title_japanese: anime.title_japanese || '',
            synopsis: anime.synopsis || '',
            image_url: anime.image_url || '',
            banner_url: anime.banner_url || '',
            type: anime.type || 'TV',
            status: anime.status || 'Finished Airing',
            episodes: anime.episodes ?? null,
            duration: anime.duration || '',
            score: anime.score ?? null,
            studio: anime.studio || '',
            season: anime.season || '',
            season_year: anime.season_year ?? null,
            genres: Array.isArray(anime.genres) ? [...anime.genres] : [],
            tags_data: Array.isArray(anime.tags_data) ? [...anime.tags_data] : []
        })
    }

    const handleAddGenre = () => {
        const trimmed = newGenreInput.trim()
        if (!trimmed) return
        const current = formData.genres || []
        if (!current.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
            setFormData((prev) => ({
                ...prev,
                genres: [...(prev.genres || []), trimmed]
            }))
        }
        setNewGenreInput('')
    }

    const handleRemoveGenre = (genreToRemove: string) => {
        setFormData((prev) => ({
            ...prev,
            genres: (prev.genres || []).filter((g) => g !== genreToRemove)
        }))
    }

    const handleAddTag = () => {
        const trimmed = newTagName.trim()
        if (!trimmed) return
        const current = formData.tags_data || []
        if (!current.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
            setFormData((prev) => ({
                ...prev,
                tags_data: [
                    ...(prev.tags_data || []),
                    {
                        name: trimmed,
                        category: newTagCategory,
                        rank: Math.max(1, Math.min(100, Number(newTagRank) || 80)),
                        is_spoiler: false
                    }
                ]
            }))
        }
        setNewTagName('')
    }

    const handleRemoveTag = (tagName: string) => {
        setFormData((prev) => ({
            ...prev,
            tags_data: (prev.tags_data || []).filter((t) => t.name !== tagName)
        }))
    }

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingAnime) return
        setSaving(true)
        setSaveFeedback(null)

        try {
            const response = await updateAdminAnime(editingAnime.mal_id, formData)
            const updatedAnime = response.anime

            // Actualizar fila en la tabla local inmediatamente
            setAnimes((prev) =>
                prev.map((item) => (item.mal_id === updatedAnime.mal_id ? updatedAnime : item))
            )
            setEditingAnime(updatedAnime)

            // Invalidar cachés de React Query para que el Catálogo y Perfil de Anime reflejen el cambio al instante
            queryClient.invalidateQueries({ queryKey: ['animes'] })
            queryClient.invalidateQueries({ queryKey: ['anime-detail', updatedAnime.mal_id] })
            queryClient.invalidateQueries({ queryKey: ['anime-taxonomies'] })

            setSaveFeedback({
                type: 'success',
                message: 'Información del anime actualizada correctamente para todos los usuarios.'
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al guardar los cambios del anime'
            setSaveFeedback({
                type: 'error',
                message: msg
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div>
            {/* Header del módulo */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0">
                        Catálogo & Desempeño de Animes
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Gestión de metadatos, imágenes de portada, géneros y taxonomías de AniList ({totalCount.toLocaleString()} series indexadas)
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
                            100% Enriquecido
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            MAL + AniList Tags
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
                                {animes[0]?.title || 'Sousou no Frieren'}
                            </span>
                        </div>
                    </div>
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-badge admin-badge-info font-mono">
                            Score: {animes[0]?.score || '9.30'}
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            {animes[0]?.studio || 'Madhouse'}
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
                            Taxonomía Activa
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>
                            Edición en Tiempo Real
                        </span>
                    </div>
                </div>
            </section>

            {/* ============================================================
               2. EXPLORADOR Y EDITOR DE ANIMES
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h2 className="admin-title m-0" style={{ fontSize: '0.92rem' }}>
                            Explorador y Editor de Catálogo de Animes
                        </h2>
                        <span className="admin-subtitle">
                            Busca cualquier anime por título, estudio o género y haz clic en <strong>Editar</strong> para modificar su foto de portada o información (Página {page})
                        </span>
                    </div>

                    <div className="admin-input-wrapper d-flex align-items-center gap-2" style={{ minWidth: 260 }}>
                        <Search size={13} style={{ color: 'var(--admin-text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por título, inglés, estudio..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setPage(1)
                            }}
                            className="bg-transparent border-0 text-white font-mono w-100"
                            style={{ outline: 'none', fontSize: '0.75rem' }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('')
                                    setPage(1)
                                }}
                                className="btn btn-link p-0 text-secondary"
                                title="Limpiar búsqueda"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtros rápidos de género / taxonomía */}
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
                                    <th className="text-end">POPULARIDAD</th>
                                    <th className="pe-2 text-end">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {animes.map((a) => (
                                    <tr key={a.mal_id} className="admin-table-row">
                                        <td>
                                            <div className="d-flex align-items-center gap-2.5">
                                                {a.image_url ? (
                                                    <img
                                                        src={a.image_url}
                                                        alt={a.title}
                                                        style={{ width: 32, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--admin-border-subtle)' }}
                                                        onError={(e) => {
                                                            e.currentTarget.onerror = null
                                                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='44' viewBox='0 0 32 44'%3E%3Crect width='32' height='44' fill='%23141414'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%2371717A' font-size='8' font-family='sans-serif'%3EANIME%3C/text%3E%3C/svg%3E"
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ width: 32, height: 44, backgroundColor: '#141414', borderRadius: 'var(--radius-sm)', border: '1px solid var(--admin-border-subtle)' }}></div>
                                                )}
                                                <div>
                                                    <div className="fw-semibold text-white text-truncate" style={{ maxWidth: 240, fontSize: '0.79rem' }}>
                                                        {a.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)' }}>
                                                        <span className="font-mono me-1.5" style={{ color: '#a78bfa' }}>#{a.mal_id}</span>
                                                        {a.genres?.slice(0, 3).join(' · ') || 'Sin géneros'}
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
                                        <td className="text-end font-mono" style={{ fontSize: '0.74rem', color: 'var(--admin-text-muted)' }}>
                                            {a.scored_by ? `${(a.scored_by / 1000).toFixed(0)}k miembros` : '—'}
                                        </td>
                                        <td className="pe-2 text-end">
                                            <div className="d-inline-flex align-items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(a)}
                                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1"
                                                    style={{
                                                        fontSize: '0.71rem',
                                                        padding: '0.24rem 0.6rem',
                                                        borderColor: 'rgba(139, 92, 246, 0.45)',
                                                        backgroundColor: 'rgba(139, 92, 246, 0.14)',
                                                        color: '#e9d5ff'
                                                    }}
                                                    title="Editar portada, título, sinopsis y géneros de este anime"
                                                >
                                                    <Edit3 size={12} />
                                                    <span>Editar</span>
                                                </button>
                                                <a
                                                    href={`#anime/${a.mal_id}`}
                                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center justify-content-center"
                                                    style={{ padding: '0.24rem 0.45rem', fontSize: '0.71rem' }}
                                                    title="Ver ficha pública del anime"
                                                >
                                                    <ExternalLink size={12} />
                                                </a>
                                            </div>
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
                        Página {page} · Mostrando {animes.length} de {totalCount.toLocaleString()} títulos
                    </span>

                    <div className="d-flex gap-1">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                        >
                            <ChevronLeft size={13} />
                            <span>Anterior</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => p + 1)}
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

            {/* ============================================================
               3. MODAL DE EDICIÓN DE ANIME (PORTADA, TÍTULOS, GÉNEROS, TAGS)
               ============================================================ */}
            {editingAnime && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
                    style={{
                        backgroundColor: 'rgba(5, 5, 10, 0.84)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2050
                    }}
                    onClick={() => !saving && setEditingAnime(null)}
                >
                    <div
                        className="admin-card w-100 custom-scrollbar"
                        style={{
                            maxWidth: 880,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            backgroundColor: '#111116',
                            border: '1px solid rgba(139, 92, 246, 0.35)',
                            boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85)',
                            padding: '1.35rem'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Encabezado del Modal */}
                        <div className="d-flex justify-content-between align-items-start gap-3 pb-3 mb-3 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="admin-badge admin-badge-info font-mono">
                                        MAL #{editingAnime.mal_id}
                                    </span>
                                    <span className="text-uppercase font-mono" style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)' }}>
                                        Editor de Ficha de Anime
                                    </span>
                                </div>
                                <h3 className="m-0 text-white fw-bold" style={{ fontSize: '1.1rem' }}>
                                    {editingAnime.title}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingAnime(null)}
                                disabled={saving}
                                className="admin-btn admin-btn-secondary p-1.5"
                                title="Cerrar editor"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {saveFeedback && (
                            <div
                                className="d-flex align-items-center gap-2 p-2.5 rounded mb-3"
                                style={{
                                    backgroundColor: saveFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                                    border: `1px solid ${saveFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                    color: saveFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
                                    fontSize: '0.78rem'
                                }}
                            >
                                {saveFeedback.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
                                <span>{saveFeedback.message}</span>
                            </div>
                        )}

                        <form onSubmit={handleSaveEdit}>
                            <div className="row g-3">
                                {/* Columna Izquierda: Vista Previa de Portada y Banner */}
                                <div className="col-12 col-md-4">
                                    <div
                                        className="p-3 rounded h-100 d-flex flex-column justify-content-between"
                                        style={{
                                            backgroundColor: '#16161e',
                                            border: '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div>
                                            <div className="d-flex align-items-center gap-1.5 mb-2 text-uppercase font-mono" style={{ fontSize: '0.68rem', color: 'var(--admin-text-muted)', fontWeight: 700 }}>
                                                <ImageIcon size={12} />
                                                <span>Vista Previa de Portada</span>
                                            </div>

                                            <div
                                                className="mx-auto mb-3 overflow-hidden d-flex align-items-center justify-content-center"
                                                style={{
                                                    width: '100%',
                                                    maxWidth: 200,
                                                    aspectRatio: '2 / 3',
                                                    backgroundColor: '#0c0c10',
                                                    borderRadius: 10,
                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                            >
                                                {formData.image_url ? (
                                                    <img
                                                        src={formData.image_url}
                                                        alt={formData.title || 'Preview'}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.currentTarget.onerror = null
                                                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%23121218'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2371717A' font-size='13' font-family='sans-serif'%3EURL Inv%C3%A1lida%3C/text%3E%3C/svg%3E"
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-secondary font-mono" style={{ fontSize: '0.75rem' }}>
                                                        Sin imagen
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mb-2.5">
                                                <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: '#c4b5fd' }}>
                                                    URL de Foto de Portada (Poster)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.image_url || ''}
                                                    onChange={(e) => setFormData((prev) => ({ ...prev, image_url: e.target.value }))}
                                                    placeholder="https://cdn.myanimelist.net/images/anime/..."
                                                    className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                                    style={{ fontSize: '0.73rem' }}
                                                />
                                                <small className="text-secondary d-block mt-1" style={{ fontSize: '0.66rem' }}>
                                                    Esta imagen se muestra en las tarjetas del Catálogo, Perfil del Anime y Mi Lista.
                                                </small>
                                            </div>

                                            <div>
                                                <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                    URL de Banner Superior (Opcional)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.banner_url || ''}
                                                    onChange={(e) => setFormData((prev) => ({ ...prev, banner_url: e.target.value }))}
                                                    placeholder="https://s4.anilist.co/file/anilistcdn/media/anime/banner/..."
                                                    className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                                    style={{ fontSize: '0.73rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-3 mt-3 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                            <a
                                                href={`#anime/${editingAnime.mal_id}`}
                                                className="admin-btn admin-btn-secondary w-100 d-flex align-items-center justify-content-center gap-1.5"
                                                style={{ fontSize: '0.74rem' }}
                                            >
                                                <ExternalLink size={13} />
                                                <span>Abrir Perfil Público del Anime</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Columna Derecha: Metadatos, Títulos, Géneros, Tags y Sinopsis */}
                                <div className="col-12 col-md-8">
                                    <div className="row g-2.5">
                                        <div className="col-12">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Título Principal (Romaji / Oficial)
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.title || ''}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.8rem' }}
                                            />
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Título en Inglés
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title_english || ''}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, title_english: e.target.value }))}
                                                placeholder="Ej: Frieren: Beyond Journey's End"
                                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem' }}
                                            />
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Título en Japonés
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title_japanese || ''}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, title_japanese: e.target.value }))}
                                                placeholder="Ej: 葬送のフリーレン"
                                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem' }}
                                            />
                                        </div>

                                        <div className="col-6 col-sm-4">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Estudio de Animación
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.studio || ''}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, studio: e.target.value }))}
                                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem' }}
                                            />
                                        </div>

                                        <div className="col-6 col-sm-4">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Formato
                                            </label>
                                            <select
                                                value={formData.type || 'TV'}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                                                className="form-select form-select-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem' }}
                                            >
                                                <option value="TV">TV</option>
                                                <option value="Movie">Movie</option>
                                                <option value="OVA">OVA</option>
                                                <option value="ONA">ONA</option>
                                                <option value="Special">Special</option>
                                                <option value="TV Special">TV Special</option>
                                            </select>
                                        </div>

                                        <div className="col-6 col-sm-4">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Estado de Emisión
                                            </label>
                                            <select
                                                value={formData.status || 'Finished Airing'}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                                                className="form-select form-select-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem' }}
                                            >
                                                <option value="Finished Airing">Finished Airing</option>
                                                <option value="Currently Airing">Currently Airing</option>
                                                <option value="Not yet aired">Not yet aired</option>
                                            </select>
                                        </div>

                                        <div className="col-6 col-sm-3">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Nota MAL (0-10)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="10"
                                                value={formData.score ?? ''}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        score: e.target.value === '' ? null : Number(e.target.value)
                                                    }))
                                                }
                                                className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                                style={{ fontSize: '0.76rem' }}
                                            />
                                        </div>

                                        <div className="col-6 col-sm-3">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Episodios
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.episodes ?? ''}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        episodes: e.target.value === '' ? null : Number(e.target.value)
                                                    }))
                                                }
                                                className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                                style={{ fontSize: '0.76rem' }}
                                            />
                                        </div>

                                        <div className="col-6 col-sm-3">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Temporada
                                            </label>
                                            <select
                                                value={formData.season || ''}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, season: e.target.value }))}
                                                className="form-select form-select-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem' }}
                                            >
                                                <option value="">—</option>
                                                <option value="winter">Winter (Invierno)</option>
                                                <option value="spring">Spring (Primavera)</option>
                                                <option value="summer">Summer (Verano)</option>
                                                <option value="fall">Fall (Otoño)</option>
                                            </select>
                                        </div>

                                        <div className="col-6 col-sm-3">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Año
                                            </label>
                                            <input
                                                type="number"
                                                min="1960"
                                                max="2030"
                                                value={formData.season_year ?? ''}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        season_year: e.target.value === '' ? null : Number(e.target.value)
                                                    }))
                                                }
                                                className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                                style={{ fontSize: '0.76rem' }}
                                            />
                                        </div>

                                        {/* Editor de Géneros Clásicos */}
                                        <div className="col-12 mt-2">
                                            <label className="form-label d-flex align-items-center gap-1.5 text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: '#c4b5fd' }}>
                                                <Tag size={12} />
                                                <span>Géneros Oficiales ({formData.genres?.length || 0})</span>
                                            </label>
                                            <div className="d-flex flex-wrap gap-1.5 mb-2">
                                                {(formData.genres || []).map((g) => (
                                                    <span
                                                        key={g}
                                                        className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded font-mono"
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            backgroundColor: 'rgba(139, 92, 246, 0.16)',
                                                            border: '1px solid rgba(139, 92, 246, 0.4)',
                                                            color: '#e9d5ff'
                                                        }}
                                                    >
                                                        <span>{g}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveGenre(g)}
                                                            className="btn btn-link p-0 text-white-50"
                                                            style={{ lineHeight: 1 }}
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="d-flex gap-1.5">
                                                <input
                                                    type="text"
                                                    value={newGenreInput}
                                                    onChange={(e) => setNewGenreInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            handleAddGenre()
                                                        }
                                                    }}
                                                    placeholder="Añadir género (ej: Isekai, Fantasy, Cyberpunk...)"
                                                    className="form-control form-control-sm bg-dark text-white border-secondary"
                                                    style={{ fontSize: '0.74rem' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddGenre}
                                                    className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 px-2.5"
                                                    style={{ fontSize: '0.73rem' }}
                                                >
                                                    <Plus size={13} />
                                                    <span>Añadir</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Editor de Taxonomía Media Tags de AniList */}
                                        <div className="col-12 mt-2">
                                            <label className="form-label d-flex align-items-center gap-1.5 text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: '#6ee7b7' }}>
                                                <Sparkles size={12} />
                                                <span>Taxonomía Media Tags de AniList ({formData.tags_data?.length || 0})</span>
                                            </label>
                                            <div className="d-flex flex-wrap gap-1.5 mb-2" style={{ maxHeight: 110, overflowY: 'auto' }}>
                                                {(formData.tags_data || []).map((t) => (
                                                    <span
                                                        key={t.name}
                                                        className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded font-mono"
                                                        style={{
                                                            fontSize: '0.7rem',
                                                            backgroundColor: 'rgba(16, 185, 129, 0.13)',
                                                            border: '1px solid rgba(16, 185, 129, 0.35)',
                                                            color: '#a7f3d0'
                                                        }}
                                                    >
                                                        <span>{t.name}</span>
                                                        <span style={{ opacity: 0.7, fontSize: '0.64rem' }}>{t.rank}%</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveTag(t.name)}
                                                            className="btn btn-link p-0 text-white-50"
                                                            style={{ lineHeight: 1 }}
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="d-flex flex-wrap gap-1.5">
                                                <input
                                                    type="text"
                                                    value={newTagName}
                                                    onChange={(e) => setNewTagName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            handleAddTag()
                                                        }
                                                    }}
                                                    placeholder="Nombre del Tag (ej: Time Manipulation, Female Protagonist...)"
                                                    className="form-control form-control-sm bg-dark text-white border-secondary flex-grow-1"
                                                    style={{ fontSize: '0.74rem', minWidth: 180 }}
                                                />
                                                <select
                                                    value={newTagCategory}
                                                    onChange={(e) => setNewTagCategory(e.target.value)}
                                                    className="form-select form-select-sm bg-dark text-white border-secondary"
                                                    style={{ fontSize: '0.73rem', width: 120 }}
                                                >
                                                    <option value="Theme">Theme</option>
                                                    <option value="Cast">Cast</option>
                                                    <option value="Setting">Setting</option>
                                                    <option value="Demographic">Demographic</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={newTagRank}
                                                    onChange={(e) => setNewTagRank(Number(e.target.value))}
                                                    title="Porcentaje de relevancia (Main Tag >= 75%)"
                                                    className="form-control form-control-sm bg-dark text-white border-secondary font-mono"
                                                    style={{ fontSize: '0.73rem', width: 70 }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddTag}
                                                    className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 px-2.5"
                                                    style={{ fontSize: '0.73rem' }}
                                                >
                                                    <Plus size={13} />
                                                    <span>Tag</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Sinopsis */}
                                        <div className="col-12 mt-2">
                                            <label className="form-label text-uppercase font-mono mb-1" style={{ fontSize: '0.66rem', color: 'var(--admin-text-muted)' }}>
                                                Sinopsis Mostrada a los Usuarios
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={formData.synopsis || ''}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, synopsis: e.target.value }))}
                                                className="form-control form-control-sm bg-dark text-white border-secondary"
                                                style={{ fontSize: '0.76rem', resize: 'vertical' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Botones de Acción */}
                                    <div className="d-flex justify-content-end gap-2 pt-3 mt-3 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => setEditingAnime(null)}
                                            className="admin-btn admin-btn-secondary px-3 py-1.5"
                                            style={{ fontSize: '0.76rem' }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="admin-btn d-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold"
                                            style={{
                                                fontSize: '0.76rem',
                                                backgroundColor: '#8b5cf6',
                                                color: '#ffffff',
                                                border: '1px solid #a78bfa'
                                            }}
                                        >
                                            <Check size={14} />
                                            <span>{saving ? 'Guardando cambios...' : 'Guardar Cambios del Anime'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
