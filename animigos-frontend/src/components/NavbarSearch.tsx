import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Star, ArrowRight, Loader2 } from 'lucide-react'
import { fetchCatalogAnimes } from '../services/catalogApi'
import type { ApiAnimeData } from '../services/userListApi'
import { resolveMediaUrl } from '../utils/mediaUrl'
import './navbar-search.css'

interface NavbarSearchProps {
    onSelectAnime?: (malId: number) => void
    onSearchSubmit?: (query: string) => void
}

export const NavbarSearch: React.FC<NavbarSearchProps> = ({
    onSelectAnime,
    onSearchSubmit
}) => {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<ApiAnimeData[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState<number>(-1)

    const inputRef = useRef<HTMLInputElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    // Atajo global Ctrl+K / Cmd+K para enfocar el buscador
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                inputRef.current?.focus()
                inputRef.current?.select()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Click outside para cerrar el dropdown
    useEffect(() => {
        const handleClickOutside = (ev: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Búsqueda con debounce (250ms)
    useEffect(() => {
        const cleanQuery = query.trim()
        if (cleanQuery.length < 2) {
            setResults([])
            setIsLoading(false)
            setIsOpen(false)
            return
        }

        setIsLoading(true)
        const timer = setTimeout(async () => {
            try {
                const res = await fetchCatalogAnimes({ q: cleanQuery, page_size: 6 })
                setResults(res.results || [])
                setIsOpen(true)
                setSelectedIndex(-1)
            } catch {
                setResults([])
            } finally {
                setIsLoading(false)
            }
        }, 220)

        return () => clearTimeout(timer)
    }, [query])

    const handleSelectAnime = (anime: ApiAnimeData) => {
        onSelectAnime?.(anime.mal_id)
        setIsOpen(false)
        setQuery('')
    }

    const handleSubmitSearch = (searchQuery: string) => {
        const trimmed = searchQuery.trim()
        if (!trimmed) return
        onSearchSubmit?.(trimmed)
        setIsOpen(false)
        setQuery('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen && e.key === 'ArrowDown' && results.length > 0) {
            setIsOpen(true)
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (selectedIndex >= 0 && selectedIndex < results.length) {
                handleSelectAnime(results[selectedIndex])
            } else {
                handleSubmitSearch(query)
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false)
            inputRef.current?.blur()
        }
    }

    return (
        <div className="navbar-search-wrapper" ref={containerRef}>
            <div className={`navbar-search-input-box ${isOpen ? 'is-focused' : ''}`}>
                <Search size={14} className="navbar-search-icon" />

                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.trim().length >= 2 && results.length > 0) {
                            setIsOpen(true)
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar anime (ej: Frieren, Naruto)..."
                    className="navbar-search-input"
                    aria-label="Buscar animes en el catálogo"
                />

                {isLoading ? (
                    <Loader2 size={13} className="text-secondary animate-spin flex-shrink-0" />
                ) : query ? (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('')
                            setResults([])
                            setIsOpen(false)
                            inputRef.current?.focus()
                        }}
                        className="navbar-search-clear-btn"
                        title="Limpiar búsqueda"
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <span className="navbar-search-shortcut d-none d-md-inline-flex" title="Atajo de teclado">
                        Ctrl K
                    </span>
                )}
            </div>

            {/* Popover de Resultados Rápidos */}
            {isOpen && (
                <div className="navbar-search-dropdown">
                    <div className="navbar-search-dropdown-header">
                        <span>Resultados de Catálogo</span>
                        <span>{results.length} coincidencias</span>
                    </div>

                    {results.length === 0 ? (
                        <div className="navbar-search-empty">
                            No se encontraron animes para "{query}".
                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={() => handleSubmitSearch(query)}
                                    className="btn btn-sm btn-outline-secondary py-1 px-2.5"
                                    style={{ fontSize: '0.72rem' }}
                                >
                                    Buscar en el Catálogo completo
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="navbar-search-dropdown-list">
                                {results.map((anime, idx) => {
                                    const isSelected = idx === selectedIndex
                                    return (
                                        <button
                                            key={anime.mal_id}
                                            type="button"
                                            className={`navbar-search-item ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => handleSelectAnime(anime)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <img
                                                src={
                                                    anime.image_url
                                                        ? resolveMediaUrl(anime.image_url)
                                                        : '/placeholder-anime.png'
                                                }
                                                alt={anime.title}
                                                className="navbar-search-thumb"
                                                loading="lazy"
                                            />

                                            <div className="navbar-search-item-info">
                                                <div className="navbar-search-item-title">
                                                    {anime.title}
                                                </div>

                                                <div className="navbar-search-item-meta">
                                                    {anime.score && Number(anime.score) > 0 ? (
                                                        <span className="navbar-search-badge-score">
                                                            <Star size={11} fill="currentColor" />
                                                            {Number(anime.score).toFixed(2)}
                                                        </span>
                                                    ) : null}

                                                    {anime.type && (
                                                        <span className="navbar-search-badge-type">
                                                            {anime.type}
                                                        </span>
                                                    )}

                                                    {anime.season_year ? (
                                                        <span>{anime.season_year}</span>
                                                    ) : null}
                                                </div>

                                                {anime.genres && anime.genres.length > 0 && (
                                                    <div className="navbar-search-item-genres">
                                                        {anime.genres.slice(0, 3).join(' · ')}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="navbar-search-dropdown-footer">
                                <button
                                    type="button"
                                    className="navbar-search-view-all-btn"
                                    onClick={() => handleSubmitSearch(query)}
                                >
                                    <span>Ver todos los resultados para "{query}"</span>
                                    <ArrowRight size={13} />
                                </button>
                                <span className="text-secondary small font-mono" style={{ fontSize: '0.66rem' }}>
                                    ↵ Enter
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

