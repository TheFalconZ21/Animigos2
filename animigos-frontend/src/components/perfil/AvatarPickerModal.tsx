import React, { useState, useEffect, useMemo } from 'react'
import {
    Check,
    Search,
    Sparkles,
    X,
    Link as LinkIcon,
    Image as ImageIcon,
    ArrowLeft,
    ChevronRight,
    Layers,
    Loader2,
} from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import {
    fetchPresetAvatars,
    type PresetAvatarCategory,
    type PresetAvatarItem,
} from '../../services/authApi'
import { resolveMediaUrl } from '../../utils/mediaUrl'

interface AvatarPickerModalProps {
    open: boolean
    onClose: () => void
    currentAvatarUrl: string
    onSelectAvatar: (url: string) => void
}

/**
 * Limpia prefijos/sufijos técnicos de nombres de archivo (ej. "Aot Fc Mikasa", "Alicia Kv Icon")
 * para mostrar etiquetas de personaje más legibles.
 */
function formatCharacterName(rawName: string, categoryName?: string): string {
    let clean = rawName
        .replace(/\b(kv\s+icon|icon|avatar|fc)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (categoryName) {
        const catPrefix = categoryName.toLowerCase()
        if (clean.toLowerCase().startsWith(catPrefix) && clean.length > catPrefix.length + 2) {
            clean = clean.slice(catPrefix.length).trim()
        }
    }
    return clean || rawName
}

function extractRelativePath(url: string): string {
    if (!url) return ''
    const idx = url.indexOf('/media/avatars/')
    return idx >= 0 ? url.slice(idx) : url
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
    open,
    onClose,
    currentAvatarUrl,
    onSelectAvatar,
}) => {
    const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>('catalog')

    // Vista 1: Resumen de lotes (1 avatar representativo por anime/lote)
    const [packSummaries, setPackSummaries] = useState<PresetAvatarCategory[]>([])
    const [totalAvatarsCount, setTotalAvatarsCount] = useState<number>(845)
    const [loadingSummaries, setLoadingSummaries] = useState(false)

    // Vista 2: Lote / Anime seleccionado y caché en memoria de lotes ya abiertos
    const [selectedPackSlug, setSelectedPackSlug] = useState<string | null>(null)
    const [loadedPacksMap, setLoadedPacksMap] = useState<Record<string, PresetAvatarItem[]>>({})
    const [loadingPackSlug, setLoadingPackSlug] = useState<string | null>(null)

    // Buscador general (en vista de lotes) y filtro interno (dentro de un lote)
    const [searchQuery, setSearchQuery] = useState('')
    const [packFilterQuery, setPackFilterQuery] = useState('')
    const [remoteSearchCategories, setRemoteSearchCategories] = useState<PresetAvatarCategory[] | null>(null)
    const [remoteSearching, setRemoteSearching] = useState(false)

    // Selección actual
    const [selectedUrl, setSelectedUrl] = useState<string>(currentAvatarUrl)
    const [selectedMeta, setSelectedMeta] = useState<{ name: string; category: string } | null>(null)
    const [customUrlInput, setCustomUrlInput] = useState<string>('')

    // Al abrir el modal: iniciar siempre en la vista de Animes/Lotes y cargar solo el resumen (1 por lote)
    useEffect(() => {
        if (!open) return
        setSelectedUrl(currentAvatarUrl)
        setSelectedPackSlug(null)
        setSearchQuery('')
        setPackFilterQuery('')

        if (packSummaries.length === 0) {
            setLoadingSummaries(true)
            fetchPresetAvatars({ summary: true })
                .then((data) => {
                    setPackSummaries(data.categories || [])
                    if (typeof data.total_avatars === 'number' && data.total_avatars > 0) {
                        setTotalAvatarsCount(data.total_avatars)
                    }
                })
                .catch((err) => {
                    console.error('Error cargando resumen de lotes de avatares:', err)
                })
                .finally(() => {
                    setLoadingSummaries(false)
                })
        }
    }, [open, currentAvatarUrl, packSummaries.length])

    // Cargar bajo demanda los avatares de un anime/lote solo cuando el usuario lo selecciona
    const handleOpenPack = async (slug: string) => {
        setSelectedPackSlug(slug)
        setPackFilterQuery('')
        if (loadedPacksMap[slug]) {
            return
        }
        setLoadingPackSlug(slug)
        try {
            const data = await fetchPresetAvatars({ category: slug })
            const foundCat = (data.categories || []).find((c) => c.slug === slug) || data.categories?.[0]
            if (foundCat && Array.isArray(foundCat.avatars)) {
                setLoadedPacksMap((prev) => ({
                    ...prev,
                    [slug]: foundCat.avatars,
                }))
            }
        } catch (err) {
            console.error(`Error cargando avatares del lote ${slug}:`, err)
        } finally {
            setLoadingPackSlug((prev) => (prev === slug ? null : prev))
        }
    }

    // Búsqueda remota con debounce cuando el usuario busca un personaje o anime en la vista principal
    useEffect(() => {
        const q = searchQuery.trim()
        if (!open || selectedPackSlug !== null || q.length < 2) {
            setRemoteSearchCategories(null)
            setRemoteSearching(false)
            return
        }

        let cancelled = false
        setRemoteSearching(true)
        const timer = window.setTimeout(() => {
            fetchPresetAvatars({ search: q })
                .then((res) => {
                    if (!cancelled) {
                        setRemoteSearchCategories(res.categories || [])
                    }
                })
                .catch(() => {
                    if (!cancelled) setRemoteSearchCategories([])
                })
                .finally(() => {
                    if (!cancelled) setRemoteSearching(false)
                })
        }, 240)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [open, selectedPackSlug, searchQuery])

    // Lote activo actualmente abierto
    const activePackSummary = useMemo(() => {
        if (!selectedPackSlug) return null
        return packSummaries.find((c) => c.slug === selectedPackSlug) || null
    }, [packSummaries, selectedPackSlug])

    // Avatares del lote activo filtrados por el buscador interno del lote
    const activePackAvatars = useMemo(() => {
        if (!selectedPackSlug) return []
        const rawList = loadedPacksMap[selectedPackSlug] || activePackSummary?.avatars || []
        const q = packFilterQuery.trim().toLowerCase()
        if (!q) return rawList
        return rawList.filter((av) => av.name.toLowerCase().includes(q))
    }, [selectedPackSlug, loadedPacksMap, activePackSummary, packFilterQuery])

    // Lotes visibles en la Vista 1 (filtrados por nombre de anime o coincidencias remotas)
    const visiblePacks = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return packSummaries

        const localMatches = packSummaries.filter((cat) => cat.name.toLowerCase().includes(q))
        if (!remoteSearchCategories) return localMatches

        const map = new Map<string, PresetAvatarCategory>()
        for (const cat of localMatches) {
            map.set(cat.slug, cat)
        }
        for (const remoteCat of remoteSearchCategories) {
            if (!map.has(remoteCat.slug)) {
                const summaryCat = packSummaries.find((s) => s.slug === remoteCat.slug)
                map.set(remoteCat.slug, summaryCat || remoteCat)
            }
        }
        return Array.from(map.values())
    }, [packSummaries, searchQuery, remoteSearchCategories])

    // Personajes individuales encontrados cuando el usuario escribe en el buscador
    const matchedCharacterAvatars = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q || q.length < 2 || !remoteSearchCategories) return []
        const items: PresetAvatarItem[] = []
        for (const cat of remoteSearchCategories) {
            for (const av of cat.avatars || []) {
                if (av.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q)) {
                    items.push(av)
                }
            }
        }
        return items.slice(0, 24)
    }, [searchQuery, remoteSearchCategories])

    // Detectar a qué lote pertenece el avatar seleccionado actualmente
    const selectedAvatarPackSlug = useMemo(() => {
        const rel = extractRelativePath(selectedUrl)
        const match = rel.match(/^\/media\/avatars\/([^/]+)\//)
        return match ? match[1] : null
    }, [selectedUrl])

    // Información del avatar seleccionado para el pie del modal
    const resolvedSelectedInfo = useMemo(() => {
        if (selectedMeta) return selectedMeta
        const relSelected = extractRelativePath(selectedUrl)

        for (const avatars of Object.values(loadedPacksMap)) {
            const found = avatars.find((a) => extractRelativePath(a.url) === relSelected)
            if (found) {
                return {
                    name: formatCharacterName(found.name, found.category),
                    category: found.category,
                }
            }
        }
        for (const cat of packSummaries) {
            const preview = cat.preview_avatar || cat.avatars?.[0]
            if (preview && extractRelativePath(preview.url) === relSelected) {
                return {
                    name: formatCharacterName(preview.name, cat.name),
                    category: cat.name,
                }
            }
        }
        if (selectedAvatarPackSlug) {
            const cat = packSummaries.find((c) => c.slug === selectedAvatarPackSlug)
            if (cat) {
                return {
                    name: 'Avatar seleccionado',
                    category: cat.name,
                }
            }
        }
        return null
    }, [selectedMeta, selectedUrl, loadedPacksMap, packSummaries, selectedAvatarPackSlug])

    const handlePickAvatar = (av: PresetAvatarItem) => {
        setSelectedUrl(av.url)
        setSelectedMeta({
            name: formatCharacterName(av.name, av.category),
            category: av.category,
        })
    }

    const handleConfirm = () => {
        if (activeTab === 'catalog') {
            onSelectAvatar(selectedUrl)
        } else {
            const finalUrl = customUrlInput.trim() || currentAvatarUrl
            onSelectAvatar(finalUrl)
        }
        onClose()
    }

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Seleccionar Avatar" ancho={780}>
            <div className="d-flex flex-column" style={{ maxHeight: '86vh' }}>
                {/* 1. Cabecera del Modal (sin botón X duplicado; Dialogo ya incluye .ml-dialog-cerrar) */}
                <div className="perfil-avatar-modal-header">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                            <span className="ml-eyebrow d-flex align-items-center gap-1.5 mb-1">
                                <Sparkles size={12} style={{ color: 'var(--perfil-acento)' }} />
                                <span>
                                    COLECCIÓN OFICIAL · {packSummaries.length || 74} LOTES · {totalAvatarsCount} AVATARES HD
                                </span>
                            </span>
                            <h3 className="h5 fw-bold text-white mb-0">Elige tu Avatar de Anime</h3>
                        </div>

                        {/* Selector de Pestaña */}
                        <div className="perfil-avatar-tabs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('catalog')}
                                className={`perfil-avatar-tab-btn ${activeTab === 'catalog' ? 'is-active' : ''}`}
                            >
                                <ImageIcon size={14} />
                                <span>Colecciones ({packSummaries.length || 74})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('custom')}
                                className={`perfil-avatar-tab-btn ${activeTab === 'custom' ? 'is-active' : ''}`}
                            >
                                <LinkIcon size={14} />
                                <span>URL Personalizada</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Contenido según Pestaña */}
                {activeTab === 'catalog' ? (
                    <div className="d-flex flex-column flex-grow-1 overflow-hidden">
                        {/* Barra de herramientas contextual: Vista de Lotes vs Vista Dentro de un Lote */}
                        <div className="perfil-avatar-toolbar">
                            {selectedPackSlug && activePackSummary ? (
                                <div className="perfil-avatar-pack-nav">
                                    <div className="d-flex align-items-center gap-2.5 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPackSlug(null)
                                                setPackFilterQuery('')
                                            }}
                                            className="perfil-avatar-back-btn"
                                        >
                                            <ArrowLeft size={14} />
                                            <span>Animes / Lotes</span>
                                        </button>

                                        <div className="d-flex align-items-center gap-2 min-w-0">
                                            {(activePackSummary.preview_avatar || activePackSummary.avatars?.[0]) && (
                                                <img
                                                    src={resolveMediaUrl(
                                                        (
                                                            activePackSummary.preview_avatar ||
                                                            activePackSummary.avatars[0]
                                                        ).url
                                                    )}
                                                    alt={activePackSummary.name}
                                                    crossOrigin="anonymous"
                                                    className="rounded-circle border flex-shrink-0"
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        objectFit: 'cover',
                                                        borderColor: 'var(--perfil-acento)',
                                                    }}
                                                />
                                            )}
                                            <div className="min-w-0">
                                                <div className="fw-bold text-white text-truncate" style={{ fontSize: '0.88rem' }}>
                                                    {activePackSummary.name}
                                                </div>
                                            </div>
                                            <span className="perfil-avatar-pack-count-pill flex-shrink-0">
                                                {activePackSummary.count} avatares
                                            </span>
                                        </div>
                                    </div>

                                    {/* Filtro rápido dentro del lote seleccionado */}
                                    <div className="perfil-friends-filter-input-wrap" style={{ maxWidth: 230 }}>
                                        <Search size={13} className="perfil-friends-filter-icon" />
                                        <input
                                            type="text"
                                            placeholder={`Filtrar en ${activePackSummary.name}...`}
                                            value={packFilterQuery}
                                            onChange={(e) => setPackFilterQuery(e.target.value)}
                                            className="perfil-friends-filter-input"
                                        />
                                        {packFilterQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setPackFilterQuery('')}
                                                className="perfil-friends-filter-clear"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
                                    <div className="perfil-friends-filter-input-wrap flex-grow-1" style={{ maxWidth: 'none' }}>
                                        <Search size={14} className="perfil-friends-filter-icon" />
                                        <input
                                            type="text"
                                            placeholder="Buscar anime, lote o personaje (ej: Attack on Titan, Chainsaw Man, Bocchi, Eren...)"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="perfil-friends-filter-input"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery('')}
                                                className="perfil-friends-filter-clear"
                                                aria-label="Limpiar búsqueda"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    <span
                                        className="small text-secondary d-none d-md-inline-flex align-items-center gap-1.5 flex-shrink-0"
                                        style={{ fontSize: '0.73rem' }}
                                    >
                                        <Layers size={13} style={{ color: 'var(--perfil-acento)' }} />
                                        <span>Selecciona un anime para ver su lote</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Cuerpo principal del selector */}
                        <div className="perfil-avatar-body">
                            {loadingSummaries ? (
                                <div className="text-center py-5">
                                    <Loader2
                                        size={24}
                                        className="spinner-border mb-2"
                                        style={{ color: 'var(--perfil-acento)' }}
                                    />
                                    <p className="small text-secondary mb-0">
                                        Cargando colecciones de anime...
                                    </p>
                                </div>
                            ) : selectedPackSlug && activePackSummary ? (
                                /* ================= VISTA 2: AVATARES DEL ANIME / LOTE SELECCIONADO ================= */
                                loadingPackSlug === selectedPackSlug ? (
                                    <div className="text-center py-5">
                                        <Loader2
                                            size={24}
                                            className="spinner-border mb-2"
                                            style={{ color: 'var(--perfil-acento)' }}
                                        />
                                        <p className="small text-secondary mb-0">
                                            Cargando lote de <strong className="text-white">{activePackSummary.name}</strong>...
                                        </p>
                                    </div>
                                ) : activePackAvatars.length > 0 ? (
                                    <div className="perfil-avatar-items-grid">
                                        {activePackAvatars.map((av) => {
                                            const isSelected =
                                                extractRelativePath(selectedUrl) === extractRelativePath(av.url)
                                            const cleanName = formatCharacterName(av.name, activePackSummary.name)
                                            return (
                                                <button
                                                    key={av.id}
                                                    type="button"
                                                    onClick={() => handlePickAvatar(av)}
                                                    className={`perfil-avatar-item-card ${isSelected ? 'is-selected' : ''}`}
                                                    title={`${cleanName} · ${activePackSummary.name}`}
                                                >
                                                    <div className="perfil-avatar-item-circle">
                                                        <img
                                                            src={resolveMediaUrl(av.url)}
                                                            alt={cleanName}
                                                            crossOrigin="anonymous"
                                                            loading="lazy"
                                                            className="w-100 h-100 object-fit-cover"
                                                        />
                                                    </div>
                                                    {isSelected && (
                                                        <span className="perfil-avatar-item-check">
                                                            <Check size={12} strokeWidth={3} />
                                                        </span>
                                                    )}
                                                    <span className="perfil-avatar-item-name">{cleanName}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-5 text-secondary">
                                        <p className="small mb-1 text-white">
                                            No hay personajes que coincidan con "{packFilterQuery}" en este lote.
                                        </p>
                                    </div>
                                )
                            ) : (
                                /* ================= VISTA 1: 1 AVATAR POR ANIME / LOTE + NOMBRE ================= */
                                <div className="d-flex flex-column gap-3">
                                    {visiblePacks.length > 0 ? (
                                        <div>
                                            {searchQuery.trim() && (
                                                <div className="perfil-friends-sublabel mb-2">
                                                    <span className="perfil-friends-sublabel-dot" />
                                                    <span>
                                                        Animes / Lotes encontrados ({visiblePacks.length})
                                                    </span>
                                                </div>
                                            )}

                                            <div className="perfil-avatar-pack-grid">
                                                {visiblePacks.map((cat) => {
                                                    const preview = cat.preview_avatar || cat.avatars?.[0]
                                                    const hasSelection = selectedAvatarPackSlug === cat.slug
                                                    return (
                                                        <button
                                                            key={cat.slug}
                                                            type="button"
                                                            onClick={() => handleOpenPack(cat.slug)}
                                                            className={`perfil-avatar-pack-card ${
                                                                hasSelection ? 'has-selection' : ''
                                                            }`}
                                                            title={`Abrir lote de ${cat.name} (${cat.count} avatares)`}
                                                        >
                                                            <div className="perfil-avatar-pack-thumb-wrap">
                                                                {preview && (
                                                                    <img
                                                                        src={resolveMediaUrl(preview.url)}
                                                                        alt={cat.name}
                                                                        crossOrigin="anonymous"
                                                                        loading="lazy"
                                                                        className="w-100 h-100 object-fit-cover"
                                                                    />
                                                                )}
                                                            </div>

                                                            <div className="perfil-avatar-pack-info">
                                                                <span className="perfil-avatar-pack-title">
                                                                    {cat.name}
                                                                </span>
                                                                <div className="perfil-avatar-pack-meta">
                                                                    <span className="perfil-avatar-pack-count-pill">
                                                                        {cat.count}{' '}
                                                                        {cat.count === 1 ? 'avatar' : 'avatares'}
                                                                    </span>
                                                                    {hasSelection && (
                                                                        <span
                                                                            style={{
                                                                                color: 'var(--perfil-acento)',
                                                                                fontWeight: 700,
                                                                                fontSize: '0.66rem',
                                                                            }}
                                                                        >
                                                                            · Actual
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <ChevronRight
                                                                size={16}
                                                                className="perfil-avatar-pack-chevron"
                                                            />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : !remoteSearching ? (
                                        <div className="text-center py-5 text-secondary">
                                            <p className="small mb-1 text-white">
                                                No se encontraron lotes ni personajes con "{searchQuery}"
                                            </p>
                                            <p className="small mb-0" style={{ fontSize: '0.75rem' }}>
                                                Prueba buscando otra serie como Attack on Titan, Chainsaw Man, Bocchi, Dragon Ball...
                                            </p>
                                        </div>
                                    ) : null}

                                    {/* Resultados directos de personajes cuando el usuario usa el buscador */}
                                    {searchQuery.trim().length >= 2 && (
                                        remoteSearching ? (
                                            <div className="text-center py-3">
                                                <Loader2
                                                    size={18}
                                                    className="spinner-border"
                                                    style={{ color: 'var(--perfil-acento)' }}
                                                />
                                            </div>
                                        ) : matchedCharacterAvatars.length > 0 ? (
                                            <div>
                                                <div className="perfil-friends-sublabel is-muted mb-2">
                                                    <span>
                                                        Avatares que coinciden con "{searchQuery.trim()}"
                                                    </span>
                                                </div>
                                                <div className="perfil-avatar-items-grid">
                                                    {matchedCharacterAvatars.map((av) => {
                                                        const isSelected =
                                                            extractRelativePath(selectedUrl) ===
                                                            extractRelativePath(av.url)
                                                        const cleanName = formatCharacterName(av.name, av.category)
                                                        return (
                                                            <button
                                                                key={av.id}
                                                                type="button"
                                                                onClick={() => handlePickAvatar(av)}
                                                                className={`perfil-avatar-item-card ${
                                                                    isSelected ? 'is-selected' : ''
                                                                }`}
                                                                title={`${cleanName} · ${av.category}`}
                                                            >
                                                                <div className="perfil-avatar-item-circle">
                                                                    <img
                                                                        src={resolveMediaUrl(av.url)}
                                                                        alt={cleanName}
                                                                        crossOrigin="anonymous"
                                                                        loading="lazy"
                                                                        className="w-100 h-100 object-fit-cover"
                                                                    />
                                                                </div>
                                                                {isSelected && (
                                                                    <span className="perfil-avatar-item-check">
                                                                        <Check size={12} strokeWidth={3} />
                                                                    </span>
                                                                )}
                                                                <span className="perfil-avatar-item-name">
                                                                    {cleanName}
                                                                </span>
                                                                <span className="perfil-avatar-item-sub">
                                                                    {av.category}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Pestaña: URL Personalizada */
                    <div className="p-4 flex-grow-1" style={{ background: 'var(--perfil-card-2)' }}>
                        <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                            <LinkIcon size={14} style={{ color: 'var(--perfil-acento)' }} />
                            <span>Enlace directo a tu imagen (JPG, PNG, GIF, WebP)</span>
                        </label>
                        <div className="d-flex align-items-center gap-3 mb-3">
                            <div
                                className="rounded-circle overflow-hidden border border-2"
                                style={{
                                    width: '72px',
                                    height: '72px',
                                    borderColor: 'var(--perfil-acento)',
                                    flexShrink: 0,
                                }}
                            >
                                <img
                                    src={resolveMediaUrl(customUrlInput || currentAvatarUrl)}
                                    alt="Vista previa personalizada"
                                    crossOrigin="anonymous"
                                    className="w-100 h-100 object-fit-cover"
                                    onError={(e) => {
                                        e.currentTarget.src = resolveMediaUrl(currentAvatarUrl)
                                    }}
                                />
                            </div>
                            <div className="flex-grow-1">
                                <input
                                    type="url"
                                    className="cat-search-control w-100"
                                    placeholder="https://i.imgur.com/... o https://cdn.discordapp.com/..."
                                    value={customUrlInput}
                                    onChange={(e) => setCustomUrlInput(e.target.value)}
                                    style={{ fontSize: '0.85rem' }}
                                />
                                <span className="small text-secondary d-block mt-1" style={{ fontSize: '0.72rem' }}>
                                    Pega un enlace público de Imgur, Discord, Unsplash o cualquier host de imágenes.
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Pie del Modal con Previsualización y Confirmación */}
                <div className="perfil-avatar-modal-footer">
                    <div className="d-flex align-items-center gap-2.5 min-w-0">
                        <img
                            src={resolveMediaUrl(
                                activeTab === 'catalog' ? selectedUrl : customUrlInput || currentAvatarUrl
                            )}
                            alt="Seleccionado"
                            crossOrigin="anonymous"
                            className="rounded-circle border flex-shrink-0"
                            style={{
                                width: '42px',
                                height: '42px',
                                objectFit: 'cover',
                                borderColor: 'var(--perfil-acento)',
                            }}
                            onError={(e) => {
                                e.currentTarget.src = resolveMediaUrl(currentAvatarUrl)
                            }}
                        />
                        <div className="min-w-0">
                            <span
                                className="small fw-bold text-white d-block text-truncate"
                                style={{ fontSize: '0.82rem' }}
                            >
                                {activeTab === 'catalog'
                                    ? resolvedSelectedInfo?.name || 'Avatar seleccionado'
                                    : 'Avatar personalizado'}
                            </span>
                            <span
                                className="small text-secondary d-block text-truncate"
                                style={{ fontSize: '0.71rem' }}
                            >
                                {activeTab === 'catalog' && resolvedSelectedInfo?.category
                                    ? resolvedSelectedInfo.category
                                    : 'Listo para aplicar'}
                            </span>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-btn ml-btn-fantasma ml-btn-sm px-3"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="ml-btn ml-btn-acento ml-btn-sm px-3 d-inline-flex align-items-center gap-1.5"
                        >
                            <Check size={14} strokeWidth={2.5} />
                            <span>Aplicar Avatar</span>
                        </button>
                    </div>
                </div>
            </div>
        </Dialogo>
    )
}
