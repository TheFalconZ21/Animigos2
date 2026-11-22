import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe, Loader2, Lock, Search, Settings, Trophy, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
    enableRankingParticipation,
    fetchUserRanking,
    RankingOptInRequiredError,
    type RankingScope,
} from '../../services/rankingApi'
import { getUserTier } from '../../utils/userTiers'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { navigate } from '../../utils/navigation'
import { NormalDistributionChart } from './NormalDistributionChart'
import './ranking.css'

export const RankingView: React.FC = () => {
    const { isAuthenticated, user, refreshUser } = useAuth()
    const queryClient = useQueryClient()
    const [scope, setScope] = useState<RankingScope>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [enablingOptIn, setEnablingOptIn] = useState(false)
    const [optInError, setOptInError] = useState<string | null>(null)

    const { data, isLoading, error } = useQuery({
        queryKey: ['user-ranking', scope],
        queryFn: () => fetchUserRanking(scope),
        staleTime: 60_000,
        retry: (failureCount, err) => !(err instanceof RankingOptInRequiredError) && failureCount < 1,
    })

    const isOptInRequired = error instanceof RankingOptInRequiredError

    const handleEnableParticipation = async () => {
        setEnablingOptIn(true)
        setOptInError(null)
        try {
            await enableRankingParticipation(user?.preferences?.privacy_settings)
            await refreshUser()
            await queryClient.invalidateQueries({ queryKey: ['user-ranking'] })
        } catch (err) {
            setOptInError(
                err instanceof Error ? err.message : 'No se pudo activar tu participación.',
            )
        } finally {
            setEnablingOptIn(false)
        }
    }

    const handleSelectScope = (nextScope: RankingScope) => {
        if (nextScope === 'friends' && !isAuthenticated) {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.showModal()
            return
        }
        setScope(nextScope)
    }

    const filteredRanking = useMemo(() => {
        const list = data?.ranking || []
        const q = searchQuery.trim().toLowerCase()
        if (!q) return list
        return list.filter(
            (u) =>
                u.display_name.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q),
        )
    }, [data?.ranking, searchQuery])

    const topThree = useMemo(() => {
        if (searchQuery.trim() || !data?.ranking || data.ranking.length < 3) return []
        return data.ranking.slice(0, 3)
    }, [data?.ranking, searchQuery])

    return (
        <div className="ranking-page">
            {/* Encabezado y controles */}
            <header className="ranking-header">
                <div>
                    <div className="ranking-eyebrow">CLASIFICACIÓN DE LA COMUNIDAD</div>
                    <h1 className="ranking-title">
                        <Trophy size={24} style={{ color: '#fbbf24' }} />
                        <span>Ranking Otaku</span>
                    </h1>
                    <p className="ranking-subtitle">
                        Usuarios ordenados según las horas totales de anime vistas en su lista.
                    </p>
                </div>

                <div className="ranking-controls">
                    <div className="ranking-scope-tabs" role="tablist" aria-label="Filtro de ranking">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={scope === 'all'}
                            onClick={() => handleSelectScope('all')}
                            className={`ranking-scope-btn ${scope === 'all' ? 'is-active' : ''}`}
                        >
                            <Globe size={14} />
                            <span>Global</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={scope === 'friends'}
                            onClick={() => handleSelectScope('friends')}
                            className={`ranking-scope-btn ${scope === 'friends' ? 'is-active' : ''}`}
                        >
                            <Users size={14} />
                            <span>Solo Amigos</span>
                        </button>
                    </div>

                    <div className="ranking-search-wrap">
                        <Search size={14} className="ranking-search-icon" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar usuario..."
                            className="ranking-search-input"
                        />
                    </div>
                </div>
            </header>

            {isLoading && (
                <div className="d-flex align-items-center justify-content-center gap-2 py-5 text-secondary">
                    <Loader2 size={18} className="spin" />
                    <span>Calculando ranking de horas...</span>
                </div>
            )}

            {isOptInRequired && !isLoading && (
                <section className="ranking-optin-card">
                    <div className="ranking-optin-icon">
                        <Lock size={24} />
                    </div>
                    <h2 className="ranking-optin-title">
                        El Ranking Otaku requiere tu consentimiento
                    </h2>
                    <p className="ranking-optin-desc">
                        Por privacidad, solo los usuarios que activan{' '}
                        <strong className="text-white">Participar en el Ranking Otaku</strong> en{' '}
                        <em>Configuración → Privacidad</em> aparecen en la tabla y pueden consultar la clasificación global y de sus amigos.
                    </p>
                    {optInError && (
                        <div className="small text-danger">{optInError}</div>
                    )}
                    <div className="ranking-optin-actions">
                        <button
                            type="button"
                            onClick={handleEnableParticipation}
                            disabled={enablingOptIn}
                            className="ranking-btn-primary"
                        >
                            <Trophy size={15} />
                            <span>
                                {enablingOptIn
                                    ? 'Activando...'
                                    : 'Activar participación ahora'}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/perfil')}
                            className="ranking-btn-secondary"
                        >
                            <Settings size={15} />
                            <span>Configuración → Privacidad</span>
                        </button>
                    </div>
                </section>
            )}

            {error && !isOptInRequired && !isLoading && (
                <div className="p-3 rounded-3 small text-danger" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {error instanceof Error ? error.message : 'No se pudo cargar el ranking.'}
                </div>
            )}

            {data && !isLoading && (
                <>
                    {/* Gráfico de Distribución Normal */}
                    <NormalDistributionChart
                        distribution={data.distribution}
                        currentUser={data.current_user}
                        scopeLabel={scope === 'friends' ? 'Tus Amigos' : 'Global'}
                    />

                    {/* Podio Top 3 */}
                    {topThree.length === 3 && (
                        <section className="ranking-podium" aria-label="Podio Top 3">
                            {topThree.map((u) => {
                                const tier = getUserTier(u.total_hours)
                                const medal = u.rank === 1 ? '🥇 #1' : u.rank === 2 ? '🥈 #2' : '🥉 #3'
                                return (
                                    <div
                                        key={u.user_id}
                                        onClick={() => navigate(`/perfil/${encodeURIComponent(u.username)}`)}
                                        className={`ranking-podium-card is-rank-${u.rank}`}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                navigate(`/perfil/${encodeURIComponent(u.username)}`)
                                            }
                                        }}
                                    >
                                        <span className="ranking-podium-medal" style={{ color: tier.color }}>
                                            {medal}
                                        </span>
                                        <img
                                            src={resolveMediaUrl(u.avatar_url)}
                                            alt={u.display_name}
                                            className="ranking-podium-avatar"
                                        />
                                        <div>
                                            <div className="fw-bold text-white" style={{ fontSize: '0.95rem' }}>
                                                {u.display_name}
                                            </div>
                                            <div className="small text-secondary" style={{ fontSize: '0.75rem' }}>
                                                @{u.username}
                                            </div>
                                        </div>
                                        <span
                                            className="ranking-tier-pill"
                                            style={{
                                                background: tier.bg,
                                                borderColor: tier.border,
                                                color: tier.color,
                                                boxShadow: tier.glow,
                                            }}
                                        >
                                            {tier.name} {tier.emoji}
                                        </span>
                                        <div className="fw-bold text-white" style={{ fontSize: '1.05rem' }}>
                                            {u.total_hours.toLocaleString()} h
                                            <span className="small text-secondary fw-normal ms-1.5">
                                                ({(u.total_hours / 24).toFixed(1)} días)
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </section>
                    )}

                    {/* Tabla completa de ranking */}
                    <section className="ranking-table-card">
                        <div className="ranking-list-row ranking-list-head">
                            <span>#</span>
                            <span>Usuario</span>
                            <span className="ranking-col-tier">Rango (Tier)</span>
                            <span className="ranking-hours-cell">Horas</span>
                            <span className="ranking-eps-cell ranking-col-eps">Episodios</span>
                        </div>

                        {filteredRanking.length === 0 ? (
                            <div className="p-4 text-center text-secondary small">
                                {scope === 'friends'
                                    ? 'Aún no tienes amigos agregados o ninguno coincide con tu búsqueda.'
                                    : 'No se encontraron usuarios con esa búsqueda.'}
                            </div>
                        ) : (
                            filteredRanking.map((u) => {
                                const tier = getUserTier(u.total_hours)
                                return (
                                    <div
                                        key={u.user_id}
                                        onClick={() => navigate(`/perfil/${encodeURIComponent(u.username)}`)}
                                        className={`ranking-list-row ${u.is_current_user ? 'is-me' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                navigate(`/perfil/${encodeURIComponent(u.username)}`)
                                            }
                                        }}
                                    >
                                        <span className="ranking-pos">#{u.rank}</span>

                                        <div className="ranking-user-cell">
                                            <img
                                                src={resolveMediaUrl(u.avatar_url)}
                                                alt={u.display_name}
                                                className="ranking-avatar"
                                            />
                                            <div className="ranking-user-meta">
                                                <span className="ranking-user-name">
                                                    <span>{u.display_name}</span>
                                                    {u.is_current_user && (
                                                        <span
                                                            className="badge rounded-pill"
                                                            style={{
                                                                background: 'var(--theme-acento, #a78bfa)',
                                                                color: '#080808',
                                                                fontSize: '0.62rem',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            TÚ
                                                        </span>
                                                    )}
                                                    {u.is_friend && !u.is_current_user && (
                                                        <span
                                                            className="badge rounded-pill"
                                                            style={{
                                                                background: 'rgba(56, 189, 248, 0.16)',
                                                                color: '#7dd3fc',
                                                                fontSize: '0.62rem',
                                                            }}
                                                        >
                                                            Amigo
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="ranking-user-handle">@{u.username}</span>
                                            </div>
                                        </div>

                                        <div className="ranking-col-tier">
                                            <span
                                                className="ranking-tier-pill"
                                                style={{
                                                    background: tier.bg,
                                                    borderColor: tier.border,
                                                    color: tier.color,
                                                    boxShadow: tier.glow,
                                                }}
                                            >
                                                {tier.name} {tier.emoji}
                                            </span>
                                        </div>

                                        <div className="ranking-hours-cell">
                                            <div className="ranking-hours-main">
                                                {u.total_hours.toLocaleString()} h
                                            </div>
                                            <div className="ranking-hours-sub">
                                                {(u.total_hours / 24).toFixed(1)} días
                                            </div>
                                        </div>

                                        <div className="ranking-eps-cell ranking-col-eps">
                                            {u.total_episodes.toLocaleString()} eps
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </section>
                </>
            )}
        </div>
    )
}
