import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    Film,
    Search,
    Flame,
    Trophy,
    Compass,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Check,
    Plus,
    Trash2
} from 'lucide-react'
import { getAnimes, getAlgorithm, updateAdminAnime, createAdminAnime, deleteAdminAnime } from '../services/adminApi'
import type { AnimeItem, AdminAnimeUpdatePayload, AlgorithmResponse } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type CatalogSubView = 'catalog-grid' | 'edit-anime' | 'create-anime'

interface GenrePerformanceItem {
    genre: string
    label: string
    catalogCount: number
    demandPct: number
    winRatePct: number
    avgScore: number
    topAnime: string
    decisionNote: string
}

export function AnimeCatalogPage() {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGenre, setSelectedGenre] = useState('Todos')
    const [animes, setAnimes] = useState<AnimeItem[]>([])
    const [algoData, setAlgoData] = useState<AlgorithmResponse | null>(null)
    const [totalCount, setTotalCount] = useState<number>(0)
    const [page, setPage] = useState<number>(1)
    const [loading, setLoading] = useState<boolean>(true)

    // Sub-Vista Activa (Cero Modales)
    const [activeSubView, setActiveSubView] = useAdminSubView<CatalogSubView>()
    const [focusedGenre, setFocusedGenre] = useState<string>('Fantasy')

    // Estado de Edición en Sub-Vista
    const [editingAnime, setEditingAnime] = useState<AnimeItem | null>(null)
    const [formData, setFormData] = useState<AdminAnimeUpdatePayload>({})
    const [newGenreInput, setNewGenreInput] = useState('')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    // Estado de Creación en Sub-Vista
    const [createFormData, setCreateFormData] = useState<Partial<AnimeItem>>({
        title: '',
        title_english: '',
        studio: '',
        episodes: 12,
        status: 'FINISHED',
        score: 8.0,
        synopsis: '',
        image_url: '',
        genres: ['Action', 'Fantasy']
    })

    useEffect(() => {
        getAlgorithm()
            .then(data => setAlgoData(data))
            .catch(err => console.error('Error loading genre dispersion:', err))
    }, [])

    const genreStats: GenrePerformanceItem[] = useMemo(() => {
        const disp = algoData?.genre_dispersion || {}
        const baseGenres = [
            { genre: 'Fantasy', label: 'Fantasía & Aventura' },
            { genre: 'Action', label: 'Acción & Shonen' },
            { genre: 'Mystery', label: 'Misterio & Thriller Psicológico' },
            { genre: 'Comedy', label: 'Comedia & Slice of Life' },
            { genre: 'Sci-Fi', label: 'Sci-Fi & Cyberpunk' },
            { genre: 'Romance', label: 'Romance & Drama' }
        ]
        return baseGenres.map(bg => {
            const gInfo = disp[bg.genre]
            const count = gInfo?.count ?? 0
            const pct = gInfo?.percentage ?? 0
            const winRate = gInfo?.win_rate_pct ?? 0
            const avgSc = gInfo?.avg_score ?? 0
            const topTitle = gInfo?.top_anime || 'Sin registros'
            return {
                genre: bg.genre,
                label: bg.label,
                catalogCount: count,
                demandPct: pct,
                winRatePct: winRate > 0 ? winRate : pct,
                avgScore: avgSc,
                topAnime: topTitle,
                decisionNote: `${count.toLocaleString()} series indexadas (${pct}% del catálogo en PostgreSQL).`
            }
        })
    }, [algoData])

    const fetchCatalog = (targetPage: number, q: string, g: string) => {
        setLoading(true)
        getAnimes({ page: targetPage, q, genre: g === 'Todos' ? '' : g })
            .then(data => {
                setAnimes(data.results || [])
                setTotalCount(data.count || 0)
            })
            .catch(err => console.error('Error fetching animes:', err))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCatalog(page, searchQuery, selectedGenre)
        }, 220)
        return () => clearTimeout(timer)
    }, [page, searchQuery, selectedGenre])

    const handleOpenEdit = (anime: AnimeItem) => {
        setEditingAnime(anime)
        setFormData({
            title: anime.title,
            title_english: anime.title_english || '',
            synopsis: anime.synopsis || '',
            image_url: anime.image_url || '',
            score: anime.score ?? 8.0,
            episodes: anime.episodes ?? 12,
            status: anime.status || 'Finished Airing',
            studio: anime.studio || '',
            genres: [...(anime.genres || [])]
        })
        setActiveSubView('edit-anime')
    }

    const handleSaveAnime = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingAnime) return
        setSaving(true)
        setFeedback(null)
        try {
            const res = await updateAdminAnime(editingAnime.mal_id, formData)
            setAnimes(prev => prev.map(a => a.mal_id === editingAnime.mal_id ? res.anime : a))
            await queryClient.invalidateQueries({ queryKey: ['catalog'] })
            setFeedback({ type: 'success', message: 'Metadatos actualizados en AWS PostgreSQL' })
            setTimeout(() => {
                setFeedback(null)
                setActiveSubView('catalog-grid')
            }, 900)
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || 'Error al guardar cambios' })
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteAnime = async () => {
        if (!editingAnime) return
        setSaving(true)
        try {
            await deleteAdminAnime(editingAnime.mal_id)
            setAnimes(prev => prev.filter(a => a.mal_id !== editingAnime.mal_id))
            setTotalCount(prev => Math.max(0, prev - 1))
            setActiveSubView('catalog-grid')
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || 'Error al eliminar anime' })
        } finally {
            setSaving(false)
        }
    }

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!createFormData.title?.trim()) return
        setSaving(true)
        try {
            const res = await createAdminAnime(createFormData)
            setAnimes(prev => [res.anime, ...prev])
            setTotalCount(prev => prev + 1)
            setActiveSubView('catalog-grid')
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || 'Error al crear anime' })
        } finally {
            setSaving(false)
        }
    }

    const subViewOptions: SubViewOption<CatalogSubView>[] = [
        { id: 'catalog-grid', label: 'Explorador de Catálogo', badge: selectedGenre },
        ...(editingAnime ? [{ id: 'edit-anime' as CatalogSubView, label: `Editar: ${editingAnime.title.slice(0, 18)}...` }] : []),
        { id: 'create-anime', label: '+ Registrar Nuevo Anime' }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Catálogo de Animes"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {feedback && (
                    <div className="admin-correlative-bridge">
                        <span className="text-white">{feedback.message}</span>
                    </div>
                )}

                {/* SUB-VISTA 1: EXPLORADOR Y CURADURÍA DEL CATÁLOGO */}
                {activeSubView === 'catalog-grid' && (
                    <div className="admin-card flex-grow-1 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    <div className="admin-input-wrapper d-flex align-items-center gap-2">
                                        <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar por título o estudio..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value)
                                                setPage(1)
                                            }}
                                            className="bg-transparent border-0 text-white"
                                            style={{ fontSize: '0.8rem', outline: 'none', width: 220 }}
                                        />
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {['Todos', 'Action', 'Fantasy', 'Comedy', 'Mystery', 'Sci-Fi', 'Romance'].map(g => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedGenre(g)
                                                    setPage(1)
                                                }}
                                                className={`admin-subview-pill ${selectedGenre === g ? 'active' : ''}`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={page <= 1 || loading}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="admin-btn admin-btn-secondary"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="font-mono text-white" style={{ fontSize: '0.8rem' }}>Pág. {page}</span>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => setPage(p => p + 1)}
                                        className="admin-btn admin-btn-secondary"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="row g-3" style={{ maxHeight: 'calc(100vh - 290px)', overflowY: 'auto' }}>
                                {animes.slice(0, 12).map(anime => (
                                    <div key={anime.mal_id} className="col-12 col-md-6 col-xl-4">
                                        <div className="p-3 rounded-2 d-flex gap-3 h-100 align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <img
                                                src={anime.image_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100&auto=format&fit=crop&q=80'}
                                                alt={anime.title}
                                                style={{ width: 52, height: 74, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                                            />
                                            <div className="overflow-hidden flex-grow-1">
                                                <div className="text-white fw-semibold text-truncate" style={{ fontSize: '0.88rem' }}>{anime.title}</div>
                                                <div className="text-truncate" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.76rem' }}>
                                                    {anime.studio || 'Estudio'} • {anime.episodes || '?'} eps
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between mt-2">
                                                    <span className="font-mono fw-bold" style={{ color: 'var(--admin-amber)', fontSize: '0.8rem' }}>
                                                        ★ {anime.score || '8.0'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(anime)}
                                                        className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1 py-1 px-2"
                                                    >
                                                        <Edit3 size={12} />
                                                        <span>Editar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                            <span>Total en PostgreSQL: {totalCount.toLocaleString()} series</span>
                            <button
                                type="button"
                                onClick={() => setActiveSubView('create-anime')}
                                className="admin-btn d-inline-flex align-items-center gap-1.5"
                                style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                            >
                                <Plus size={14} />
                                <span>Registrar Nuevo Anime</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 2: EDITOR DE ANIME */}
                {activeSubView === 'edit-anime' && editingAnime && (
                    <div className="admin-card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.15rem' }}>Editando: {editingAnime.title}</h2>
                                <span className="admin-subtitle">ID Canónico #{editingAnime.mal_id} en AWS PostgreSQL</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleDeleteAnime}
                                disabled={saving}
                                className="admin-btn admin-btn-secondary text-danger d-inline-flex align-items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                <span>Eliminar del Catálogo</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveAnime} className="row g-3">
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Título Principal</label>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-6 col-md-3">
                                <label className="admin-kpi-kicker d-block mb-1">Score MAL</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.score ?? 8.0}
                                    onChange={(e) => setFormData({ ...formData, score: parseFloat(e.target.value) })}
                                    className="form-control bg-dark text-white border-secondary font-mono"
                                />
                            </div>
                            <div className="col-6 col-md-3">
                                <label className="admin-kpi-kicker d-block mb-1">Episodios</label>
                                <input
                                    type="number"
                                    value={formData.episodes ?? 12}
                                    onChange={(e) => setFormData({ ...formData, episodes: parseInt(e.target.value, 10) })}
                                    className="form-control bg-dark text-white border-secondary font-mono"
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Estudio de Animación</label>
                                <input
                                    type="text"
                                    value={formData.studio || ''}
                                    onChange={(e) => setFormData({ ...formData, studio: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Agregar Género</label>
                                <div className="d-flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ej. Psychological"
                                        value={newGenreInput}
                                        onChange={(e) => setNewGenreInput(e.target.value)}
                                        className="form-control bg-dark text-white border-secondary"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!newGenreInput.trim()) return
                                            setFormData({ ...formData, genres: [...(formData.genres || []), newGenreInput.trim()] })
                                            setNewGenreInput('')
                                        }}
                                        className="admin-btn admin-btn-secondary text-white"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>
                            <div className="col-12">
                                <label className="admin-kpi-kicker d-block mb-1">Sinopsis</label>
                                <textarea
                                    rows={3}
                                    value={formData.synopsis || ''}
                                    onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 d-flex justify-content-end gap-2 pt-2">
                                <button type="button" onClick={() => setActiveSubView('catalog-grid')} className="admin-btn admin-btn-secondary">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="admin-btn d-inline-flex align-items-center gap-1.5"
                                    style={{ backgroundColor: 'var(--admin-emerald)', color: '#090B10', fontWeight: 600 }}
                                >
                                    <Check size={14} />
                                    <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* SUB-VISTA 3: CREAR NUEVO ANIME */}
                {activeSubView === 'create-anime' && (
                    <div className="admin-card" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
                        <h2 className="admin-title mb-1" style={{ fontSize: '1.15rem' }}>Registrar Nuevo Anime en el Catálogo</h2>
                        <p className="admin-subtitle mb-3">Indexa una nueva serie directamente en la tabla maestra de PostgreSQL</p>

                        <form onSubmit={handleCreateSubmit} className="row g-3">
                            <div className="col-12 col-md-8">
                                <label className="admin-kpi-kicker d-block mb-1">Título Oficial</label>
                                <input
                                    type="text"
                                    required
                                    value={createFormData.title || ''}
                                    onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 col-md-4">
                                <label className="admin-kpi-kicker d-block mb-1">Score Inicial</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={createFormData.score ?? 8.2}
                                    onChange={(e) => setCreateFormData({ ...createFormData, score: parseFloat(e.target.value) })}
                                    className="form-control bg-dark text-white border-secondary font-mono"
                                />
                            </div>
                            <div className="col-12">
                                <label className="admin-kpi-kicker d-block mb-1">Sinopsis</label>
                                <textarea
                                    rows={3}
                                    value={createFormData.synopsis || ''}
                                    onChange={(e) => setCreateFormData({ ...createFormData, synopsis: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 d-flex justify-content-end gap-2">
                                <button type="button" onClick={() => setActiveSubView(null)} className="admin-btn admin-btn-secondary">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="admin-btn"
                                    style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                                >
                                    {saving ? 'Indexando...' : 'Crear Anime'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    const activeGenreObj = genreStats.find(g => g.genre === focusedGenre) || genreStats[0]

    return (
        <div className="admin-viewport-shell">
            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                        Catálogo Maestro & Desempeño por Género
                    </h1>
                    <p className="admin-subtitle m-0 mt-1">
                        Cruce entre demanda de búsqueda de usuarios, disponibilidad en PostgreSQL y tasa de victoria en salas
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubView('create-anime')}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 text-white"
                    >
                        <Plus size={14} />
                        <span>Registrar Anime</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedGenre('Todos')
                            setActiveSubView('catalog-grid')
                        }}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <Search size={14} />
                        <span>Explorar Catálogo ({totalCount.toLocaleString()})</span>
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setSelectedGenre('Todos')
                        setActiveSubView('catalog-grid')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Series en PostgreSQL</span>
                        <span className="admin-badge admin-badge-success font-mono">100% Enriquecido</span>
                    </div>
                    <div className="admin-kpi-value my-1">{totalCount.toLocaleString()}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Abrir explorador CRUD</span>
                            <ChevronRight size={13} />
                        </span>
                        <Film size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setSelectedGenre('Fantasy')
                        setActiveSubView('catalog-grid')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Top Anime Indexado</span>
                        <span className="admin-badge admin-badge-info font-mono">★ {animes[0]?.score ?? activeGenreObj.avgScore}</span>
                    </div>
                    <div className="text-white fw-bold text-truncate my-1" style={{ fontSize: '1.25rem' }}>
                        {animes[0]?.title || activeGenreObj.topAnime}
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ver títulos líderes</span>
                            <ChevronRight size={13} />
                        </span>
                        <Flame size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setSelectedGenre('Todos')
                        setActiveSubView('catalog-grid')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Consenso de Candidatos</span>
                        <span className="admin-badge admin-badge-success">En Vivo</span>
                    </div>
                    <div className="admin-kpi-value my-1">{algoData?.stats?.high_consensus_rooms_pct ?? 0}%</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Auditar desempeño</span>
                            <ChevronRight size={13} />
                        </span>
                        <Trophy size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setSelectedGenre('Action')
                        setActiveSubView('catalog-grid')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Género Dominante</span>
                        <span className="admin-badge admin-badge-neutral font-mono">{genreStats[1]?.catalogCount.toLocaleString() || 0} títulos</span>
                    </div>
                    <div className="text-white fw-bold my-1" style={{ fontSize: '1.25rem' }}>
                        {genreStats[1]?.label || 'Acción & Fantasía'}
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Filtrar por taxonomía</span>
                            <ChevronRight size={13} />
                        </span>
                        <Compass size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Matriz de Géneros (Demanda vs Win-Rate) + Inspector Taxonómico */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Desempeño Taxonómico: Demanda vs. Tasa de Victoria
                            </h2>
                            <span className="admin-badge admin-badge-info">Click para Curaduría</span>
                        </div>

                        <div className="d-flex flex-column" style={{ gap: '1.1rem' }}>
                            {genreStats.map(g => {
                                const isFocused = focusedGenre === g.genre
                                return (
                                    <div
                                        key={g.genre}
                                        onMouseEnter={() => setFocusedGenre(g.genre)}
                                        onClick={() => {
                                            setSelectedGenre(g.genre)
                                            setActiveSubView('catalog-grid')
                                        }}
                                        className="admin-chart-interactive-node"
                                        style={{
                                            padding: '1rem 1.3rem',
                                            borderRadius: 14,
                                            backgroundColor: isFocused ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                            border: isFocused ? '1px solid var(--admin-focus)' : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '0.65rem' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="text-white fw-semibold" style={{ fontSize: '0.88rem' }}>{g.label}</span>
                                                <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.76rem' }}>
                                                    ({g.catalogCount.toLocaleString()} series)
                                                </span>
                                            </div>
                                            <div className="d-flex align-items-center gap-3 font-mono" style={{ fontSize: '0.8rem' }}>
                                                <span style={{ color: 'var(--admin-focus)' }}>Cobertura: <strong>{g.demandPct}%</strong></span>
                                                <span style={{ color: 'var(--admin-emerald)' }}>Media: <strong>★ {g.avgScore}</strong></span>
                                                <ChevronRight size={14} style={{ color: isFocused ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }} />
                                            </div>
                                        </div>

                                        <div className="d-flex gap-1.5 align-items-center">
                                            <div className="flex-grow-1 rounded overflow-hidden" style={{ height: 8, backgroundColor: 'var(--admin-surface-1)' }}>
                                                <div style={{ width: `${Math.min(100, g.demandPct * 2)}%`, height: '100%', backgroundColor: isFocused ? 'var(--admin-focus)' : 'var(--admin-emerald)', borderRadius: 4 }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>Metadatos enriquecidos con vectores semánticos de AniList y MyAnimeList</span>
                        <span className="font-mono">{totalCount.toLocaleString()} registros activos</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Decisión por Género */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                DIAGNÓSTICO DE GÉNERO
                            </span>
                            <span className="admin-badge admin-badge-success font-mono">★ {activeGenreObj.avgScore} media</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1.05rem' }}>
                            {activeGenreObj.label}
                        </h3>
                        <p className="admin-subtitle mb-3">
                            {activeGenreObj.decisionNote}
                        </p>

                        <div className="d-flex flex-column gap-2.5 mb-3">
                            <div className="admin-decision-item">
                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>Obra Estandarte en Salas</span>
                                <div className="text-white fw-semibold mt-0.5" style={{ fontSize: '0.88rem' }}>🏆 {activeGenreObj.topAnime}</div>
                            </div>
                            <div className="admin-decision-item">
                                <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>Volumen Indexado en RDS</span>
                                <div className="font-mono text-white fw-bold mt-0.5" style={{ fontSize: '0.95rem' }}>
                                    {activeGenreObj.catalogCount.toLocaleString()} títulos disponibles
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex flex-column gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedGenre(activeGenreObj.genre)
                                setActiveSubView('catalog-grid')
                            }}
                            className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                            style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                        >
                            <span>Curar Títulos de {activeGenreObj.label.split('&')[0].trim()}</span>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
