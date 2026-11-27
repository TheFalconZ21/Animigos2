import React, { useState } from 'react'
import {
    ArrowLeft,
    BookOpen,
    Briefcase,
    ExternalLink,
    Eye,
    EyeOff,
    Film,
    Globe,
    Heart,
    Loader2,
    Mic,
    Share2,
    User,
} from 'lucide-react'
import { useAnimeStaffDetailQuery } from '../../hooks/useCatalog'
import type { AnimeStaffMember, StaffPersonDetail } from '../../services/catalogApi'

interface AnimeStaffViewProps {
    staffId: number
    animeTitle: string
    initialStaff?: Partial<AnimeStaffMember> | null
    onBack: () => void
    onSelectAnime?: (nextMalId: number) => void
}

/**
 * Visual dedicada para Actores de Doblaje / Seiyuu, Autores Originales (Mangakas),
 * Directores, Productores y Trabajadores conocidos de cada anime.
 * Incluye enlaces a Wikipedia, redes sociales oficiales (X/Twitter, Instagram, YouTube, Sitio Oficial),
 * biografía en español, obras de autoría/producción y personajes doblados.
 */
export const AnimeStaffView: React.FC<AnimeStaffViewProps> = ({
    staffId,
    animeTitle,
    initialStaff,
    onBack,
    onSelectAnime,
}) => {
    const { data: detailedStaff, isFetching } = useAnimeStaffDetailQuery(staffId)
    const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({})

    const person: Partial<StaffPersonDetail> = detailedStaff || {
        id: staffId,
        name: initialStaff?.name || 'Cargando...',
        native_name: initialStaff?.native_name || '',
        image_url: initialStaff?.image_url || '',
        occupations: initialStaff?.occupations?.length
            ? initialStaff.occupations
            : initialStaff?.role_display
              ? [initialStaff.role_display]
              : [],
        language_display: initialStaff?.language_display || '',
        description: '',
        description_es: '',
        social_links: [],
        voice_works: [],
        production_works: [],
    }

    const bioText = (person.description_es || person.description || '').trim()

    const renderBioWithSpoilers = (text: string) => {
        if (!text) {
            if (isFetching) {
                return (
                    <div className="d-flex align-items-center gap-2 text-secondary py-3">
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        <span className="small">Cargando biografía, redes sociales y filmografía...</span>
                    </div>
                )
            }
            return (
                <p className="small text-secondary mb-0">
                    No hay una biografía detallada registrada en AniList para esta persona, pero puedes consultar su artículo completo en Wikipedia y sus obras a continuación.
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

    const occupations =
        person.occupations && person.occupations.length > 0
            ? person.occupations
            : initialStaff?.role_display
              ? [initialStaff.role_display]
              : ['Staff / Seiyuu']

    const wikiUrl =
        person.wikipedia?.url ||
        `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(person.name || '')}`
    const wikiLang = (person.wikipedia?.lang || 'es').toUpperCase()

    const socialLinks = person.social_links || []
    const hasTwitter = socialLinks.some((s) => s.platform === 'twitter')
    const voiceWorks = person.voice_works || []
    const productionWorks = person.production_works || []
    const authorshipWorks = productionWorks.filter((w) => w.is_authorship)
    const crewWorks = productionWorks.filter((w) => !w.is_authorship)

    const renderPlatformBadge = (platform: string) => {
        switch (platform) {
            case 'twitter':
                return '𝕏'
            case 'instagram':
                return 'IG'
            case 'youtube':
                return '▶'
            case 'tiktok':
                return '♪'
            case 'pixiv':
                return 'P'
            case 'anilist':
                return 'AL'
            default:
                return '🌐'
        }
    }

    return (
        <div className="d-flex flex-column gap-3">
            {/* Barra superior de retorno */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <button type="button" onClick={onBack} className="anime-profile-back-btn">
                    <ArrowLeft size={15} />
                    <span>Volver a {animeTitle}</span>
                </button>
                <div className="small text-secondary font-mono" style={{ fontSize: '0.75rem' }}>
                    {animeTitle} &rsaquo; Staff &amp; Seiyuu &rsaquo;{' '}
                    <span className="text-white">{person.name}</span>
                </div>
            </div>

            {/* Cabecera de la Persona (Seiyuu / Mangaka / Director / Productor) */}
            <div className="anime-profile-section-card">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <div className="d-flex align-items-center flex-wrap gap-2">
                            <h1 className="h4 fw-bold text-white mb-0">{person.name}</h1>
                            {occupations.map((occ) => (
                                <span
                                    key={occ}
                                    className="badge rounded-pill"
                                    style={{
                                        background: 'rgba(168, 85, 247, 0.2)',
                                        color: '#d8b4fe',
                                        border: '1px solid rgba(168, 85, 247, 0.4)',
                                        fontSize: '0.72rem',
                                    }}
                                >
                                    {occ}
                                </span>
                            ))}
                            {person.language_display && (
                                <span
                                    className="badge rounded-pill"
                                    style={{
                                        background: 'rgba(56, 189, 248, 0.14)',
                                        color: '#7dd3fc',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        fontSize: '0.72rem',
                                    }}
                                >
                                    {person.language_display}
                                </span>
                            )}
                        </div>
                        {person.native_name && (
                            <div className="small text-secondary mt-1">{person.native_name}</div>
                        )}
                    </div>

                    {Boolean(person.favourites && person.favourites > 0) && (
                        <div
                            className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill small"
                            style={{
                                background: 'rgba(244, 63, 94, 0.12)',
                                border: '1px solid rgba(244, 63, 94, 0.3)',
                                color: '#fda4af',
                                fontWeight: 600,
                            }}
                        >
                            <Heart size={13} fill="currentColor" />
                            <span>{person.favourites?.toLocaleString()} favoritos</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Grilla de 2 columnas: Izquierda Retrato + Wikipedia + Redes Sociales + Datos / Derecha Biografía + Obras */}
            <div className="anime-profile-grid">
                {/* Columna Izquierda */}
                <aside className="anime-profile-sidebar">
                    {person.image_url && (
                        <div className="anime-profile-poster-card">
                            <img
                                src={person.image_url}
                                alt={person.name}
                                className="anime-profile-poster-img"
                            />
                        </div>
                    )}

                    {/* Wikipedia y Redes Sociales Oficiales */}
                    <div className="anime-profile-panel">
                        <div className="anime-profile-panel-title d-flex align-items-center justify-content-between">
                            <span>Wikipedia &amp; Redes Sociales</span>
                            <Share2 size={12} className="text-secondary" />
                        </div>

                        <div className="anime-streaming-list">
                            {/* Botón directo a Wikipedia */}
                            <a
                                href={wikiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="anime-streaming-item"
                                style={{
                                    borderColor: 'rgba(255, 255, 255, 0.22)',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                }}
                            >
                                <div className="anime-streaming-item-left">
                                    <span
                                        className="anime-streaming-icon-box fw-bold"
                                        style={{
                                            background: '#f4f4f5',
                                            color: '#09090b',
                                            fontFamily: 'Georgia, serif',
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        W
                                    </span>
                                    <div className="overflow-hidden">
                                        <div className="anime-streaming-name">
                                            Wikipedia ({wikiLang})
                                        </div>
                                        {person.wikipedia?.title && (
                                            <div
                                                className="text-secondary text-truncate"
                                                style={{ fontSize: '0.68rem' }}
                                            >
                                                {person.wikipedia.title}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className="anime-streaming-action">
                                    Leer <ExternalLink size={12} />
                                </span>
                            </a>

                            {/* Redes sociales extraídas de AniList / Wikidata */}
                            {socialLinks.map((soc, idx) => {
                                const brandColor = soc.color || '#a855f7'
                                return (
                                    <a
                                        key={`${soc.platform}-${idx}`}
                                        href={soc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="anime-streaming-item"
                                        style={{ borderColor: `${brandColor}45` }}
                                    >
                                        <div className="anime-streaming-item-left">
                                            <span
                                                className="anime-streaming-icon-box fw-bold"
                                                style={{
                                                    background: `${brandColor}22`,
                                                    border: `1px solid ${brandColor}66`,
                                                    color: '#ffffff',
                                                    fontSize: '0.74rem',
                                                }}
                                            >
                                                {renderPlatformBadge(soc.platform)}
                                            </span>
                                            <div className="overflow-hidden">
                                                <div className="anime-streaming-name">
                                                    {soc.label}
                                                </div>
                                                {soc.handle && (
                                                    <div
                                                        className="text-secondary text-truncate"
                                                        style={{ fontSize: '0.68rem' }}
                                                    >
                                                        {soc.handle}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="anime-streaming-action">
                                            Abrir <ExternalLink size={12} />
                                        </span>
                                    </a>
                                )
                            })}

                            {/* Búsqueda directa en X / Twitter si no tiene handle registrado en Wikidata/AniList */}
                            {!hasTwitter && person.name && (
                                <a
                                    href={`https://x.com/search?q=${encodeURIComponent(
                                        person.native_name || person.name
                                    )}&f=user`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="anime-streaming-item"
                                    style={{ borderColor: 'rgba(29, 161, 242, 0.3)' }}
                                >
                                    <div className="anime-streaming-item-left">
                                        <span
                                            className="anime-streaming-icon-box fw-bold"
                                            style={{
                                                background: 'rgba(29, 161, 242, 0.16)',
                                                border: '1px solid rgba(29, 161, 242, 0.45)',
                                                color: '#38bdf8',
                                                fontSize: '0.76rem',
                                            }}
                                        >
                                            𝕏
                                        </span>
                                        <div className="overflow-hidden">
                                            <div className="anime-streaming-name">X / Twitter</div>
                                            <div
                                                className="text-secondary text-truncate"
                                                style={{ fontSize: '0.68rem' }}
                                            >
                                                Buscar perfil de {person.name}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="anime-streaming-action">
                                        Buscar <ExternalLink size={12} />
                                    </span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Datos Personales y Profesionales */}
                    {(person.birthday ||
                        person.age ||
                        person.hometown ||
                        person.years_active ||
                        person.gender ||
                        person.blood_type ||
                        (person.alternative_names && person.alternative_names.length > 0)) && (
                        <div className="anime-profile-panel">
                            <div className="anime-profile-panel-title">Información Personal</div>
                            <div className="anime-profile-info-list">
                                {person.years_active && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Actividad:</span>
                                        <span className="anime-profile-info-val">
                                            {person.years_active}
                                        </span>
                                    </div>
                                )}
                                {person.birthday && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Nacimiento:</span>
                                        <span className="anime-profile-info-val">
                                            {person.birthday}
                                        </span>
                                    </div>
                                )}
                                {person.age && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Edad:</span>
                                        <span className="anime-profile-info-val">
                                            {person.age} años
                                        </span>
                                    </div>
                                )}
                                {person.hometown && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Origen:</span>
                                        <span className="anime-profile-info-val">
                                            {person.hometown}
                                        </span>
                                    </div>
                                )}
                                {person.gender && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Género:</span>
                                        <span className="anime-profile-info-val">
                                            {person.gender}
                                        </span>
                                    </div>
                                )}
                                {person.blood_type && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Tipo sangre:</span>
                                        <span className="anime-profile-info-val">
                                            {person.blood_type}
                                        </span>
                                    </div>
                                )}
                                {person.alternative_names && person.alternative_names.length > 0 && (
                                    <div className="anime-profile-info-row">
                                        <span className="anime-profile-info-key">Otros nombres:</span>
                                        <span className="anime-profile-info-val">
                                            {person.alternative_names.join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                {/* Columna Derecha: Biografía + Obras de Autoría (Mangakas) + Producción/Dirección + Roles de Voz (Seiyuu) */}
                <div className="anime-profile-main d-flex flex-column gap-3">
                    {/* Biografía */}
                    <div className="anime-profile-section-card">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <h3 className="anime-profile-section-heading mb-0 d-flex align-items-center gap-2">
                                <User size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                                <span>Biografía y Trayectoria Profesional</span>
                            </h3>
                            <div className="d-flex align-items-center gap-2">
                                {isFetching && (
                                    <span
                                        className="small text-secondary d-inline-flex align-items-center gap-2"
                                        style={{ fontSize: '0.74rem' }}
                                    >
                                        <Loader2
                                            size={13}
                                            style={{ animation: 'spin 1s linear infinite' }}
                                        />
                                        Sincronizando datos...
                                    </span>
                                )}
                                <a
                                    href={wikiUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="anime-profile-spoiler-btn text-decoration-none d-inline-flex align-items-center gap-1"
                                >
                                    <Globe size={12} />
                                    <span>Wikipedia ({wikiLang})</span>
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                        </div>
                        {renderBioWithSpoilers(bioText)}
                    </div>

                    {/* 1. Obras con Autoría Original (Mangaka / Creador Original) */}
                    {authorshipWorks.length > 0 && (
                        <div className="anime-profile-section-card">
                            <div className="mb-3">
                                <h3 className="anime-profile-section-heading mb-1 d-flex align-items-center gap-2">
                                    <BookOpen
                                        size={15}
                                        style={{ color: 'var(--cat-acento, #a855f7)' }}
                                    />
                                    <span>
                                        Obras de Autoría Original / Mangaka ({authorshipWorks.length})
                                    </span>
                                </h3>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.76rem' }}>
                                    Animes y obras originales creadas o escritas por {person.name}. Haz clic en cualquier anime para abrir su ficha.
                                </p>
                            </div>

                            <div className="anime-staff-works-grid">
                                {authorshipWorks.map((work, idx) => (
                                    <div
                                        key={`auth-${work.mal_id || idx}-${work.title}`}
                                        onClick={() => {
                                            if (work.mal_id && onSelectAnime) {
                                                onSelectAnime(work.mal_id)
                                                window.scrollTo({ top: 0, behavior: 'smooth' })
                                            }
                                        }}
                                        role={work.mal_id ? 'button' : undefined}
                                        tabIndex={work.mal_id ? 0 : undefined}
                                        className={`anime-staff-work-card ${work.mal_id ? 'is-clickable' : ''}`}
                                    >
                                        <img
                                            src={work.image_url}
                                            alt={work.title}
                                            loading="lazy"
                                            className="anime-staff-work-poster"
                                        />
                                        <div className="anime-staff-work-body">
                                            <div className="d-flex align-items-center flex-wrap gap-1 mb-1">
                                                <span className="anime-staff-role-pill is-author">
                                                    {work.role_display}
                                                </span>
                                            </div>
                                            <div className="anime-staff-work-title">
                                                {work.title}
                                            </div>
                                            <div className="anime-staff-work-meta">
                                                <span>{work.format}</span>
                                                {work.season_year && <span>· {work.season_year}</span>}
                                                {work.score && (
                                                    <span className="text-warning fw-semibold">
                                                        · ★ {work.score.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Créditos de Dirección, Producción y Staff en Animes */}
                    {crewWorks.length > 0 && (
                        <div className="anime-profile-section-card">
                            <div className="mb-3">
                                <h3 className="anime-profile-section-heading mb-1 d-flex align-items-center gap-2">
                                    <Briefcase
                                        size={15}
                                        style={{ color: 'var(--cat-acento, #a855f7)' }}
                                    />
                                    <span>
                                        Animes donde ha Trabajado — Dirección, Producción y Staff (
                                        {crewWorks.length})
                                    </span>
                                </h3>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.76rem' }}>
                                    Participaciones acreditadas en producción, dirección, guion, música o animación.
                                </p>
                            </div>

                            <div className="anime-staff-works-grid">
                                {crewWorks.map((work, idx) => (
                                    <div
                                        key={`crew-${work.mal_id || idx}-${work.title}`}
                                        onClick={() => {
                                            if (work.mal_id && onSelectAnime) {
                                                onSelectAnime(work.mal_id)
                                                window.scrollTo({ top: 0, behavior: 'smooth' })
                                            }
                                        }}
                                        role={work.mal_id ? 'button' : undefined}
                                        tabIndex={work.mal_id ? 0 : undefined}
                                        className={`anime-staff-work-card ${work.mal_id ? 'is-clickable' : ''}`}
                                    >
                                        <img
                                            src={work.image_url}
                                            alt={work.title}
                                            loading="lazy"
                                            className="anime-staff-work-poster"
                                        />
                                        <div className="anime-staff-work-body">
                                            <div className="d-flex align-items-center flex-wrap gap-1 mb-1">
                                                <span className="anime-staff-role-pill">
                                                    {work.role_display}
                                                </span>
                                            </div>
                                            <div className="anime-staff-work-title">
                                                {work.title}
                                            </div>
                                            <div className="anime-staff-work-meta">
                                                <span>{work.format}</span>
                                                {work.season_year && <span>· {work.season_year}</span>}
                                                {work.score && (
                                                    <span className="text-warning fw-semibold">
                                                        · ★ {work.score.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Roles de Doblaje / Seiyuu (Personajes y Animes interpretados) */}
                    {voiceWorks.length > 0 && (
                        <div className="anime-profile-section-card">
                            <div className="mb-3">
                                <h3 className="anime-profile-section-heading mb-1 d-flex align-items-center gap-2">
                                    <Mic size={15} style={{ color: 'var(--cat-acento, #a855f7)' }} />
                                    <span>
                                        Roles de Doblaje / Seiyuu — Animes y Personajes ({voiceWorks.length})
                                    </span>
                                </h3>
                                <p className="small text-secondary mb-0" style={{ fontSize: '0.76rem' }}>
                                    Haz clic en cualquier tarjeta para ir a la ficha del anime correspondiente.
                                </p>
                            </div>

                            <div className="anime-char-grid">
                                {voiceWorks.map((vw, idx) => (
                                    <div
                                        key={`${vw.mal_id}-${vw.character_id || idx}`}
                                        onClick={() => {
                                            if (vw.mal_id && onSelectAnime) {
                                                onSelectAnime(vw.mal_id)
                                                window.scrollTo({ top: 0, behavior: 'smooth' })
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        className="anime-char-card"
                                        title={`Ir a ${vw.anime_title}`}
                                    >
                                        {/* Lado Izquierdo: Anime donde actuó */}
                                        <div className="anime-char-side">
                                            <img
                                                src={vw.anime_image}
                                                alt={vw.anime_title}
                                                loading="lazy"
                                                className="anime-char-avatar"
                                            />
                                            <div className="overflow-hidden">
                                                <div
                                                    className="small fw-bold text-white text-truncate"
                                                    style={{ fontSize: '0.8rem' }}
                                                >
                                                    {vw.anime_title}
                                                </div>
                                                <div
                                                    className="small text-secondary"
                                                    style={{ fontSize: '0.68rem' }}
                                                >
                                                    {vw.format}
                                                    {vw.season_year ? ` · ${vw.season_year}` : ''}
                                                    {vw.score ? (
                                                        <span className="text-warning ms-1">
                                                            ★ {vw.score.toFixed(2)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lado Derecho: Personaje interpretado */}
                                        <div className="anime-char-side is-va">
                                            <div className="overflow-hidden">
                                                <div
                                                    className="small fw-semibold text-white text-truncate"
                                                    style={{ fontSize: '0.78rem' }}
                                                >
                                                    {vw.character_name}
                                                </div>
                                                <div
                                                    className="small text-secondary"
                                                    style={{ fontSize: '0.68rem' }}
                                                >
                                                    Rol {vw.character_role}
                                                </div>
                                            </div>
                                            {vw.character_image && (
                                                <img
                                                    src={vw.character_image}
                                                    alt={vw.character_name}
                                                    loading="lazy"
                                                    className="anime-char-avatar"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isFetching &&
                        authorshipWorks.length === 0 &&
                        crewWorks.length === 0 &&
                        voiceWorks.length === 0 && (
                            <div className="anime-profile-section-card">
                                <div className="d-flex align-items-center gap-2 text-secondary small">
                                    <Film size={15} />
                                    <span>
                                        No se encontraron créditos adicionales indexados para esta persona.
                                    </span>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        </div>
    )
}
