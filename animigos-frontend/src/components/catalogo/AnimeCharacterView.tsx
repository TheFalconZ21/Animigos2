import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Film, Heart, Loader2, Mic, User } from 'lucide-react'
import { useAnimeCharacterDetailQuery } from '../../hooks/useCatalog'
import type { AnimeCharacterItem } from '../../services/catalogApi'

interface AnimeCharacterViewProps {
    malId: number
    animeTitle: string
    initialCharacter: AnimeCharacterItem
    onBack: () => void
    onSelectAnime?: (nextMalId: number) => void
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
}) => {
    const { data: detailedChar, isFetching } = useAnimeCharacterDetailQuery(malId, initialCharacter.id)
    const character = detailedChar || initialCharacter
    const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({})

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
                            className="anime-profile-spoiler-btn d-inline-flex align-items-center gap-1.5"
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

                    {Boolean(character.favourites && character.favourites > 0) && (
                        <div
                            className="d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill small"
                            style={{
                                background: 'rgba(244, 63, 94, 0.12)',
                                border: '1px solid rgba(244, 63, 94, 0.3)',
                                color: '#fda4af',
                                fontWeight: 600,
                            }}
                        >
                            <Heart size={13} fill="currentColor" />
                            <span>{character.favourites?.toLocaleString()} favoritos</span>
                        </div>
                    )}
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
                            <div className="anime-profile-panel-title d-flex align-items-center gap-1.5">
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
                                        className="d-flex align-items-center gap-2.5 p-1.5 rounded-2"
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
                                <span className="small text-secondary d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.74rem' }}>
                                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                    Traduciendo al español...
                                </span>
                            )}
                        </div>
                        {renderBioWithSpoilers(bioText)}
                    </div>

                    {/* Actores de Voz / Seiyuu */}
                    <div className="anime-profile-section-card">
                        <h3 className="anime-profile-section-heading d-flex align-items-center gap-2">
                            <Mic size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                            <span>Actores de Doblaje / Seiyuu ({character.voice_actors?.length || 0})</span>
                        </h3>

                        {!character.voice_actors || character.voice_actors.length === 0 ? (
                            <p className="small text-secondary mb-0">
                                No hay actores de voz registrados para este personaje.
                            </p>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    gap: '0.75rem',
                                }}
                            >
                                {character.voice_actors.map((va, idx) => (
                                    <div
                                        key={`${va.id || idx}-${va.language}`}
                                        className="d-flex align-items-center gap-3 p-2.5 rounded-3"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                        }}
                                    >
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
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
