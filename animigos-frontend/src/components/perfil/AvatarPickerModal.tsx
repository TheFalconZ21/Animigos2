import React, { useState, useEffect, useMemo } from 'react'
import { Check, Search, Sparkles, X, Link as LinkIcon, Image as ImageIcon } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { fetchPresetAvatars, type PresetAvatarCategory, type PresetAvatarItem } from '../../services/authApi'
import { resolveMediaUrl } from '../../utils/mediaUrl'

interface AvatarPickerModalProps {
    open: boolean
    onClose: () => void
    currentAvatarUrl: string
    onSelectAvatar: (url: string) => void
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
    open,
    onClose,
    currentAvatarUrl,
    onSelectAvatar,
}) => {
    const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>('catalog')
    const [categories, setCategories] = useState<PresetAvatarCategory[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [selectedUrl, setSelectedUrl] = useState<string>(currentAvatarUrl)
    const [customUrlInput, setCustomUrlInput] = useState<string>('')

    // Cargar catálogo de avatares desde el backend al abrir el modal
    useEffect(() => {
        if (!open) return
        setSelectedUrl(currentAvatarUrl)

        if (categories.length === 0) {
            setLoading(true)
            fetchPresetAvatars()
                .then((data) => {
                    setCategories(data.categories || [])
                })
                .catch((err) => {
                    console.error('Error cargando avatares predefinidos:', err)
                })
                .finally(() => {
                    setLoading(false)
                })
        }
    }, [open, currentAvatarUrl, categories.length])

    // Filtrado de avatares en memoria para velocidad instantánea
    const filteredAvatars = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const result: PresetAvatarItem[] = []

        for (const cat of categories) {
            if (selectedCategory !== 'all' && cat.slug !== selectedCategory) {
                continue
            }

            const catMatches = query && cat.name.toLowerCase().includes(query)

            for (const av of cat.avatars) {
                if (!query || catMatches || av.name.toLowerCase().includes(query)) {
                    result.push(av)
                }
            }
        }

        return result
    }, [categories, searchQuery, selectedCategory])

    // Encontrar información del avatar seleccionado para la preview
    const selectedItem = useMemo(() => {
        for (const cat of categories) {
            const found = cat.avatars.find((a) => a.url === selectedUrl)
            if (found) return found
        }
        return null
    }, [categories, selectedUrl])

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
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Seleccionar Avatar" ancho={760}>
            <div className="d-flex flex-column" style={{ maxHeight: '85vh' }}>
                {/* Cabecera del Modal */}
                <div className="p-4 border-bottom border-dark">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <div>
                            <span className="ml-eyebrow d-flex align-items-center gap-1.5">
                                <Sparkles size={12} style={{ color: 'var(--perfil-acento)' }} />
                                COLECCIÓN OFICIAL · 835 AVATARES EN ALTA DEFINICIÓN
                            </span>
                            <h3 className="h5 fw-bold text-white mb-0">Elige tu Avatar de Anime</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-sm text-secondary p-1 border-0"
                            aria-label="Cerrar modal"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Selector de Pestaña */}
                    <div className="d-flex align-items-center gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => setActiveTab('catalog')}
                            className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill ${
                                activeTab === 'catalog'
                                    ? 'btn-primary text-white fw-semibold'
                                    : 'btn-dark text-secondary'
                            }`}
                            style={{
                                backgroundColor: activeTab === 'catalog' ? 'var(--perfil-acento)' : 'var(--perfil-card)',
                                borderColor: 'var(--perfil-border)',
                                fontSize: '0.82rem',
                            }}
                        >
                            <ImageIcon size={14} />
                            <span>Catálogo Oficial ({categories.reduce((acc, c) => acc + (c.count || c.avatars?.length || 0), 0) || '845'})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('custom')}
                            className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill ${
                                activeTab === 'custom'
                                    ? 'btn-primary text-white fw-semibold'
                                    : 'btn-dark text-secondary'
                            }`}
                            style={{
                                backgroundColor: activeTab === 'custom' ? 'var(--perfil-acento)' : 'var(--perfil-card)',
                                borderColor: 'var(--perfil-border)',
                                fontSize: '0.82rem',
                            }}
                        >
                            <LinkIcon size={14} />
                            <span>URL Personalizada</span>
                        </button>
                    </div>
                </div>

                {/* Contenido según Pestaña */}
                {activeTab === 'catalog' ? (
                    <div className="d-flex flex-column flex-grow-1 overflow-hidden">
                        {/* Buscador y Categorías */}
                        <div className="p-3 border-bottom border-dark bg-dark bg-opacity-25">
                            {/* Buscador en Vivo */}
                            <div className="position-relative mb-2.5">
                                <Search
                                    size={15}
                                    className="position-absolute text-secondary"
                                    style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Buscar por anime o personaje (ej: Frieren, Luffy, Gojo, Tanjiro, Solo Leveling...)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="cat-search-control w-100"
                                    style={{
                                        paddingLeft: '36px',
                                        paddingRight: searchQuery ? '36px' : '14px',
                                        fontSize: '0.82rem',
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="position-absolute btn btn-sm p-0 text-secondary border-0"
                                        style={{ right: '12px', top: '50%', transform: 'translateY(-50%)' }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Filtro por Series de Anime (Píldoras con scroll horizontal) */}
                            <div
                                className="d-flex align-items-center gap-1.5 overflow-x-auto pb-1"
                                style={{ scrollbarWidth: 'thin' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory('all')}
                                    className="btn btn-sm px-2.5 py-1 text-nowrap rounded-pill border"
                                    style={{
                                        fontSize: '0.72rem',
                                        backgroundColor: selectedCategory === 'all' ? 'var(--perfil-acento)' : 'transparent',
                                        borderColor: selectedCategory === 'all' ? 'var(--perfil-acento)' : 'var(--perfil-border)',
                                        color: selectedCategory === 'all' ? '#ffffff' : 'var(--perfil-text-muted)',
                                        fontWeight: selectedCategory === 'all' ? 600 : 400,
                                    }}
                                >
                                    Todas las Series ({categories.reduce((acc, c) => acc + c.count, 0)})
                                </button>

                                {categories.map((cat) => (
                                    <button
                                        key={cat.slug}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.slug)}
                                        className="btn btn-sm px-2.5 py-1 text-nowrap rounded-pill border"
                                        style={{
                                            fontSize: '0.72rem',
                                            backgroundColor: selectedCategory === cat.slug ? 'var(--perfil-acento)' : 'transparent',
                                            borderColor: selectedCategory === cat.slug ? 'var(--perfil-acento)' : 'var(--perfil-border)',
                                            color: selectedCategory === cat.slug ? '#ffffff' : 'var(--perfil-text-muted)',
                                            fontWeight: selectedCategory === cat.slug ? 600 : 400,
                                        }}
                                    >
                                        {cat.name} ({cat.count})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grid de Avatares */}
                        <div
                            className="p-3 flex-grow-1 overflow-y-auto"
                            style={{
                                maxHeight: '380px',
                                minHeight: '260px',
                                background: 'var(--perfil-card-2)',
                            }}
                        >
                            {loading ? (
                                <div className="text-center py-5">
                                    <div
                                        className="spinner-border spinner-border-sm mb-2"
                                        style={{ color: 'var(--perfil-acento)' }}
                                        role="status"
                                    />
                                    <p className="small text-secondary mb-0">Cargando 835 avatares oficiales...</p>
                                </div>
                            ) : filteredAvatars.length > 0 ? (
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
                                        gap: '12px',
                                    }}
                                >
                                    {filteredAvatars.map((av) => {
                                        const isSelected = selectedUrl === av.url
                                        return (
                                            <div
                                                key={av.id}
                                                onClick={() => setSelectedUrl(av.url)}
                                                className="position-relative d-flex flex-column align-items-center p-1 rounded-3"
                                                style={{
                                                    cursor: 'pointer',
                                                    border: isSelected
                                                        ? '2px solid var(--perfil-acento)'
                                                        : '1px solid var(--perfil-border)',
                                                    backgroundColor: isSelected
                                                        ? 'rgba(167, 139, 250, 0.12)'
                                                        : 'rgba(255, 255, 255, 0.02)',
                                                    transition: 'all 0.15s ease',
                                                    transform: isSelected ? 'scale(1.04)' : 'none',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.borderColor = 'var(--perfil-acento)'
                                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.borderColor = 'var(--perfil-border)'
                                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                                                    }
                                                }}
                                            >
                                                {/* Imagen de avatar WebP */}
                                                <div
                                                    className="rounded-circle overflow-hidden position-relative"
                                                    style={{ width: '64px', height: '64px', background: '#111' }}
                                                >
                                                    <img
                                                        src={resolveMediaUrl(av.url)}
                                                        alt={av.name}
                                                        loading="lazy"
                                                        className="w-100 h-100 object-fit-cover"
                                                    />
                                                    {isSelected && (
                                                        <div
                                                            className="position-absolute top-0 end-0 rounded-circle d-flex align-items-center justify-content-center text-white"
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                backgroundColor: 'var(--perfil-acento)',
                                                                margin: '2px',
                                                            }}
                                                        >
                                                            <Check size={12} strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>

                                                <span
                                                    className="small text-truncate w-100 text-center mt-1 text-white"
                                                    style={{ fontSize: '0.66rem' }}
                                                    title={`${av.name} (${av.category})`}
                                                >
                                                    {av.name}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-5 text-secondary">
                                    <p className="small mb-1 text-white">No se encontraron avatares con "{searchQuery}"</p>
                                    <p className="small mb-0" style={{ fontSize: '0.75rem' }}>
                                        Prueba buscando otra serie como Frieren, One Piece, Dragon Ball, Demon Slayer...
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Pestaña: URL Personalizada */
                    <div className="p-4 flex-grow-1">
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

                {/* Pie del Modal con Previsualización y Confirmación */}
                <div className="p-3 border-top border-dark d-flex align-items-center justify-content-between bg-dark bg-opacity-40">
                    <div className="d-flex align-items-center gap-2.5">
                        <img
                            src={resolveMediaUrl(activeTab === 'catalog' ? selectedUrl : customUrlInput || currentAvatarUrl)}
                            alt="Seleccionado"
                            className="rounded-circle border"
                            style={{
                                width: '40px',
                                height: '40px',
                                objectFit: 'cover',
                                borderColor: 'var(--perfil-acento)',
                            }}
                            onError={(e) => {
                                e.currentTarget.src = resolveMediaUrl(currentAvatarUrl)
                            }}
                        />
                        <div className="min-w-0">
                            <span className="small fw-bold text-white d-block text-truncate" style={{ fontSize: '0.82rem' }}>
                                {activeTab === 'catalog'
                                    ? selectedItem
                                        ? selectedItem.name
                                        : 'Avatar seleccionado'
                                    : 'Avatar personalizado'}
                            </span>
                            <span className="small text-secondary d-block text-truncate" style={{ fontSize: '0.7rem' }}>
                                {activeTab === 'catalog' && selectedItem ? selectedItem.category : 'Listo para aplicar'}
                            </span>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-sm btn-dark text-secondary px-3"
                            style={{ borderColor: 'var(--perfil-border)', fontSize: '0.82rem' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="btn btn-sm text-white fw-bold px-3 d-flex align-items-center gap-1.5"
                            style={{
                                backgroundColor: 'var(--perfil-acento)',
                                fontSize: '0.82rem',
                            }}
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
