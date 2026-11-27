import React, { useState } from 'react'
import { ArrowLeft, ExternalLink, Eye, EyeOff, Film, Heart, Loader2, Mic, User } from 'lucide-react'
import {
    useAnimeCharacterDetailQuery,
    useFavoriteCharactersQuery,
    useToggleFavoriteCharacterMutation,
} from '../../hooks/useCatalog'
import { useAuth } from '../../context/AuthContext'
import type { AnimeCharacterItem, AnimeVoiceActor } from '../../services/catalogApi'

interface AnimeCharacterViewProps {
    malId: number
    animeTitle: string
    initialCharacter: AnimeCharacterItem
    onBack: () => void
    onSelectAnime?: (nextMalId: number) => void
    onSelectStaff?: (va: AnimeVoiceActor) => void
}

/**
 * Visual dedicada de un personaje (estilo MyAnimeList / AniList integrado al tema oscuro de Animigos).
 * Muestra retrato HD, atributos, animeografía, biografía traducida con bloques de spoiler ocultables
 * y actores de doblaje / seiyuu con sus fotografías e idioma.
 */
export const AnimeCharacterView: React.FC<AnimeCharacterViewProps> = ({
    malId,
    animeTitle,
    initialCharacter,
    onBack,
    onSelectAnime,
    onSelectStaff,
}) => {
    const { isAuthenticated } = useAuth()
    const { data: detailedChar, isFetching } = useAnimeCharacterDetailQuery(malId, initialCharacter.id)
    const { data: myFavChars = [] } = useFavoriteCharactersQuery(undefined, isAuthenticated)
    const toggleFavMutation = useToggleFavoriteCharacterMutation()
    const character = detailedChar || initialCharacter
    const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({})
    const [localFavState, setLocalFavState] = useState<{
        isFav: boolean
        favourites: number
        animigosFavs: number
    } | null>(null)

    const isInMyList = myFavChars.some((f) => Number(f.character_id) === Number(character.id))
    const isFav = localFavState ? localFavState.isFav : Boolean(character.is_favourite || isInMyList)
    const baseFavs = Number(character.base_favourites ?? character.favourites ?? 0)
    const totalFavs = localFavState
        ? localFavState.favourites
        : Number(character.favourites ?? baseFavs)
    const animigosFavs = localFavState
        ? localFavState.animigosFavs
        : Number(character.animigos_favourites ?? (isInMyList ? 1 : 0))

    const handleToggleFavorite = async () => {
        if (!isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        const nextIsFav = !isFav
        const delta = nextIsFav ? 1 : -1
        setLocalFavState({
            isFav: nextIsFav,
            favourites: Math.max(0, totalFavs + delta),
            animigosFavs: Math.max(0, animigosFavs + delta),
        })
        try {
            const res = await toggleFavMutation.mutateAsync({
                character_id: character.id,
                character_name: character.name,
                character_native: character.native_name || '',
                character_image: character.image_url,
                role_display: character.role_display || 'Principal',
                anime_mal_id: malId,
                anime_title: animeTitle,
                base_favourites: baseFavs,
            })
            setLocalFavState({
                isFav: res.is_favourite,
                favourites: res.favourites,
                animigosFavs: res.animigos_favourites,
            })
        } catch {
            setLocalFavState(null)
        }
    }

    const bioText = (character.description_es || character.description || '').trim()

    const renderBioWithSpoilers = (text: string) => {
        if (!text) {
            return (
                <p className="small text-secondary mb-0">
                    No hay una descripción biográfica registrada para este personaje aún.
                </p>
            )
        }

        const segments = text.split(/(\[spoiler\][\s\S]*?\[\/spoiler\])/gi)
        return segments.map((seg, idx) => {
            if (seg.toLowerCase().startsWith('[spoiler]') && seg.toLowerCase().endsWith('[/spoiler]')) {
                const inner = seg.slice('[spoiler]'.length, -'[/spoiler]'.length).trim()
                if (!inner) return null
                const isShown = Boolean(revealedSpoilers[idx])
                return (
                    <div key={idx} className="my-2">
                        <button
                            type="button"
                            onClick={() =>
                                setRevealedSpoilers((prev) => ({ ...prev, [idx]: !prev[idx] }))
                            }
                            className="anime-profile-spoiler-btn d-inline-flex align-items-center gap-2"
                        >
                            {isShown ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{isShown ? 'Ocultar spoiler' : 'Mostrar spoiler'}</span>
                        </button>
                        {isShown && (
                            <div
                                className="mt-2 p-3 rounded-3"
                                style={{
                                    background: 'rgba(244, 63, 94, 0.07)',
                                    border: '1px solid rgba(244, 63, 94, 0.28)',
                                    whiteSpace: 'pre-line',
                                    lineHeight: 1.65,
                                    color: '#f4f4f5',
                                    fontSize: '0.88rem',
                                }}
                            >
                                {inner}
                            </div>
                        )}
                    </div>
                )
            }

            const trimmed = seg.trim()
            if (!trimmed) return null
            return (
                <div
                    key={idx}
                    style={{
                        whiteSpace: 'pre-line',
                        lineHeight: 1.7,
                        color: '#d4d4d8',
                        fontSize: '0.9rem',
                    }}
                    className="mb-2"
                >
                    {trimmed}
                </div>
            )
        })
    }

    const aliases = (character.alternative_names || []).filter(Boolean)

    return (
        <div className="d-flex flex-column gap-3">
            {/* Barra superior de retorno a la ficha del anime */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <button type="button" onClick={onBack} className="anime-profile-back-btn">
                    <ArrowLeft size={15} />
                    <span>Volver a {animeTitle}</span>
                </button>
                <div className="small text-secondary font-mono" style={{ fontSize: '0.75rem' }}>
                    {animeTitle} &rsaquo; Personajes &rsaquo;{' '}
                    <span className="text-white">{character.name}</span>
                </div>
            </div>

            {/* Cabecera del Personaje */}
            <div className="anime-profile-section-card">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <div className="d-flex align-items-center flex-wrap gap-2">
                            <h1 className="h4 fw-bold text-white mb-0">{character.name}</h1>
                            { aliases.length > 0 && (
                                <span className="text-secondary fw-normal h6 mb-0">
                                    “{aliases[0]}”
                                </span>
                            )}
                            <span
                                className="badge rounded-pill"
                                style={{
                                    background:
                                        character.role === 'MAIN'
                                            ? 'rgba(168, 85, 247, 0.2)'
                                            : 'rgba(255, 255, 255, 0.08)',
                                    color: character.role === 'MAIN' ? '#d8b4fe' : '#a1a1aa',
                                    border:
                                        character.role === 'MAIN'
                                            ? '1px solid rgba(168, 85, 247, 0.4)'
                                            : '1px solid rgba(255, 255, 255, 0.14)',
                                    fontSize: '0.72rem',
                                }}
                            >
                                Rol {character.role_display}
                            </span>
                        </div>
                        {character.native_name && (
                            <div className="small text-secondary mt-1">{character.native_name}</div>
                        )}
                    </div>

                    <div className="d-flex align-items-center flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleToggleFavorite}
                            disabled={toggleFavMutation.isPending}
                            className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill small"
                            style={{
                                background: isFav
                                    ? 'rgba(244, 63, 94, 0.22)'
                                    : 'rgba(255, 255, 255, 0.06)',
                                border: isFav
                                    ? '1px solid rgba(244, 63, 94, 0.55)'
                                    : '1px solid rgba(255, 255, 255, 0.16)',
                                color: isFav ? '#fda4af' : '#e4e4e7',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            title={
                                isFav
                                    ? 'Quitar de tus personajes favoritos'
                                    : 'Añadir a tus personajes favoritos (se exhibirá en tu perfil debajo del Hall of Fame)'
                            }
                        >
                            <Heart
                                size={14}
                                fill={isFav ? '#f43f5e' : 'none'}
                                color={isFav ? '#f43f5e' : 'currentColor'}
                            />
                            <span>
                                {isFav ? 'En tus Favoritos' : 'Añadir a Favoritos'} ·{' '}
                                {totalFavs.toLocaleString()}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Grilla de 2 columnas estilo MyAnimeList: Izquierda Retrato + Animeografía / Derecha Biografía + Seiyuu */}
            <div className="anime-profile-grid">
                {/* Columna Izquierda */}
                <aside className="anime-profile-sidebar">
                    <div className="anime-profile-poster-card">
                        <img
                            src={character.image_url}
                            alt={character.name}
                            className="anime-profile-poster-img"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleToggleFavorite}
                        disabled={toggleFavMutation.isPending}
                        className={`anime-profile-fav-btn ${isFav ? 'active' : ''}`}
                    >
                        <Heart
                            size={14}
                            fill={isFav ? '#f43f5e' : 'none'}
                            color={isFav ? '#f43f5e' : 'currentColor'}
                        />
                        <span>
                            {isFav ? 'En tus Personajes Favoritos' : 'Añadir a Personajes Favoritos'}
                        </span>
                    </button>

                    {/* Datos personales si existen */}
                    {(character.age || character.gender || character.birthday || character.blood_type || aliases.length > 1) && (
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title">Datos del Personaje</div>
                            <div className="anime-profile-info-list">
                                {character.age && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Edad:</span>
                                        <span className="anime-profile-info-val">{character.age}</span>
                                    </div>
                                )}
                                {character.gender && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Género:</span>
                                        <span className="anime-profile-info-val">{character.gender}</span>
                                    </div>
                                )}
                                {character.birthday && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Cumpleaños:</span>
                                        <span className="anime-profile-info-val">{character.birthday}</span>
                                    </div>
                                )}
                                {character.blood_type && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Tipo sangre:</span>
                                        <span className="anime-profile-info-val">{character.blood_type}</span>
                                    </div>
                                )}
                                {aliases.length > 0 && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Alias:</span>
                                        <span className="anime-profile-info-val">{aliases.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Animeografía */}
                    {character.animeography && character.animeography.length > 0 && (
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title d-flex align-items-center gap-2">
                                <Film size={13} />
                                <span>Animeografía</span>
                            </div>
                            <div className="d-flex flex-column gap-2">
                                {character.animeography.map((item) => (
                                    <div
                                        key={item.mal_id}
                                        onClick={() => {
                                            if (onSelectAnime) {
                                                onSelectAnime(item.mal_id)
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        className="d-flex align-items-center gap-2 p-2 rounded-2"
                                        style={{
                                            cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.025)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            transition: 'background 0.15s ease',
                                        }}
                                    >
                                        <img
                                            src={item.image_url}
                                            alt={item.title}
                                            style={{
                                                width: 38,
                                                height: 52,
                                                objectFit: 'cover',
                                                borderRadius: 6,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <div className="overflow-hidden">
                                            <div
                                                className="small fw-semibold text-white text-truncate"
                                                style={{ fontSize: '0.78rem' }}
                                            >
                                                {item.title}
                                            </div>
                                            <div
                                                className="small text-secondary"
                                                style={{ fontSize: '0.7rem' }}
                                            >
                                                {item.role} {item.season_year ? `· ${item.season_year}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>

                {/* Columna Derecha: Descripción + Actores de Doblaje / Seiyuu */}
                <div className="anime-profile-main d-flex flex-column gap-3">
                    <div className="anime-profile-section-card">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <h3 className="anime-profile-section-heading mb-0 d-flex align-items-center gap-2">
                                <User size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                                <span>Descripción e Historia del Personaje</span>
                            </h3>
                            {isFetching && !character.description_es && (
                                <span className="small text-secondary d-inline-flex align-items-center gap-2" style={{ fontSize: '0.74rem' }}>
                                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                    Traduciendo al español...
                                </span>
                            )}
                        </div>
                        {renderBioWithSpoilers(bioText)}
                    </div>

                    {/* Actores de Voz / Seiyuu */}
                    <div className="anime-profile-section-card">
                        <div className="mb-3">
                            <h3 className="anime-profile-section-heading mb-1 d-flex align-items-center gap-2">
                                <Mic size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                                <span>Actores de Doblaje / Seiyuu ({character.voice_actors?.length || 0})</span>
                            </h3>
                            <p className="small text-secondary mb-0" style={{ fontSize: '0.76rem' }}>
                                Haz clic en cualquier actor de voz o seiyuu para abrir su ficha exclusiva con redes sociales, Wikipedia y todos los animes donde ha trabajado.
                            </p>
                        </div>

                        {!character.voice_actors || character.voice_actors.length === 0 ? (
                            <p className="small text-secondary mb-0">
                                No hay actores de voz registrados para este personaje.
                            </p>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                    gap: '0.75rem',
                                }}
                            >
                                {character.voice_actors.map((va, idx) => (
                                    <div
                                        key={`${va.id || idx}-${va.language}`}
                                        onClick={() => {
                                            if (va.id && onSelectStaff) {
                                                onSelectStaff(va)
                                                window.scrollTo({ top: 0, behavior: 'smooth' })
                                            }
                                        }}
                                        role={va.id && onSelectStaff ? 'button' : undefined}
                                        tabIndex={va.id && onSelectStaff ? 0 : undefined}
                                        className="anime-va-card-clickable d-flex align-items-center justify-content-between gap-3 p-2 rounded-3"
                                        title={`Ver ficha exclusiva de ${va.name} (Redes sociales, Wikipedia y filmografía)`}
                                    >
                                        <div className="d-flex align-items-center gap-3 overflow-hidden">
                                            <img
                                                src={va.image_url}
                                                alt={va.name}
                                                style={{
                                                    width: 48,
                                                    height: 64,
                                                    objectFit: 'cover',
                                                    borderRadius: 8,
                                                    flexShrink: 0,
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                }}
                                            />
                                            <div className="overflow-hidden">
                                                <div className="fw-bold text-white small text-truncate">
                                                    {va.name}
                                                </div>
                                                {va.native_name && (
                                                    <div
                                                        className="small text-secondary text-truncate"
                                                        style={{ fontSize: '0.72rem' }}
                                                    >
                                                        {va.native_name}
                                                    </div>
                                                )}
                                                <span
                                                    className="badge rounded-pill mt-1"
                                                    style={{
                                                        background:
                                                            va.language === 'Japanese'
                                                                ? 'rgba(168, 85, 247, 0.18)'
                                                                : 'rgba(56, 189, 248, 0.16)',
                                                        color:
                                                            va.language === 'Japanese'
                                                                ? '#d8b4fe'
                                                                : '#7dd3fc',
                                                        fontSize: '0.68rem',
                                                    }}
                                                >
                                                    {va.language_display || va.language}
                                                </span>
                                            </div>
                                        </div>
                                        {Boolean(va.id && onSelectStaff) && (
                                            <span className="anime-streaming-action pe-1">
                                                Ficha <ExternalLink size={12} />
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
