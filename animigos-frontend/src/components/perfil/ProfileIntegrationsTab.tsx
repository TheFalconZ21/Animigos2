import React, { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    Check,
    Copy,
    ExternalLink,
    FileSpreadsheet,
    KeyRound,
    Link2,
    Loader2,
    Puzzle,
    RefreshCw,
    Unlink,
    Upload,
} from 'lucide-react'
import {
    disconnectAniList,
    disconnectMal,
    fetchIntegrationsStatus,
    generateExtensionToken,
    importNetflixCsvFile,
    startAniListOAuth,
    startMalOAuth,
    syncAniListNow,
    syncMalNow,
    updateIntegrationPreferences,
    type IntegrationsStatusResponse,
    type NetflixImportResult,
    type SyncPullResult,
} from '../../services/syncApi'

export const ProfileIntegrationsTab: React.FC = () => {
    const queryClient = useQueryClient()
    const [status, setStatus] = useState<IntegrationsStatusResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // AniList usuario público
    const [anilistUsername, setAnilistUsername] = useState('')

    // Extensión token recién generado
    const [freshToken, setFreshToken] = useState<string | null>(null)
    const [copiedToken, setCopiedToken] = useState(false)

    // Importador CSV Netflix
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [netflixResult, setNetflixResult] = useState<NetflixImportResult | null>(null)

    const loadStatus = async () => {
        try {
            setLoading(true)
            const data = await fetchIntegrationsStatus()
            setStatus(data)
            if (data.anilist.username && !anilistUsername) {
                setAnilistUsername(data.anilist.username)
            }
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo cargar el estado de integraciones.',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadStatus()
    }, [])

    const invalidateUserLists = () => {
        void queryClient.invalidateQueries({ queryKey: ['my-list'] })
        void queryClient.invalidateQueries({ queryKey: ['user-agenda'] })
    }

    const formatSyncSummary = (label: string, res: SyncPullResult) =>
        `${label}: ${res.imported} nuevos, ${res.updated} actualizados (${res.total_remote} en tu cuenta).`

    const handleConnectMal = async () => {
        setBusyKey('mal-connect')
        setFeedback(null)
        try {
            const { auth_url } = await startMalOAuth()
            window.location.href = auth_url
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo conectar con MyAnimeList.',
            })
            setBusyKey(null)
        }
    }

    const handleSyncMal = async () => {
        setBusyKey('mal-sync')
        setFeedback(null)
        try {
            const res = await syncMalNow()
            setFeedback({ type: 'success', text: formatSyncSummary('MyAnimeList', res) })
            invalidateUserLists()
            await loadStatus()
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'Error al sincronizar MyAnimeList.',
            })
        } finally {
            setBusyKey(null)
        }
    }

    const handleDisconnectMal = async () => {
        setBusyKey('mal-disconnect')
        setFeedback(null)
        try {
            const res = await disconnectMal()
            setStatus(res.status)
            setFeedback({ type: 'success', text: 'Cuenta de MyAnimeList desvinculada.' })
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo desvincular MyAnimeList.',
            })
        } finally {
            setBusyKey(null)
        }
    }

    const handleConnectAniList = async () => {
        setBusyKey('al-connect')
        setFeedback(null)
        try {
            const { auth_url } = await startAniListOAuth()
            window.location.href = auth_url
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo conectar con AniList.',
            })
            setBusyKey(null)
        }
    }

    const handleSyncAniList = async (usePublicUsername: boolean) => {
        const cleanUser = anilistUsername.trim()
        if (usePublicUsername && !cleanUser) {
            setFeedback({ type: 'error', text: 'Ingresa tu nombre de usuario público de AniList.' })
            return
        }
        setBusyKey('al-sync')
        setFeedback(null)
        try {
            const res = await syncAniListNow(usePublicUsername ? cleanUser : undefined)
            setFeedback({ type: 'success', text: formatSyncSummary('AniList', res) })
            invalidateUserLists()
            await loadStatus()
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'Error al sincronizar AniList.',
            })
        } finally {
            setBusyKey(null)
        }
    }

    const handleDisconnectAniList = async () => {
        setBusyKey('al-disconnect')
        setFeedback(null)
        try {
            const res = await disconnectAniList()
            setStatus(res.status)
            setFeedback({ type: 'success', text: 'Cuenta de AniList desvinculada.' })
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo desvincular AniList.',
            })
        } finally {
            setBusyKey(null)
        }
    }

    const handleToggleAutoPush = async (provider: 'mal' | 'anilist', nextValue: boolean) => {
        setBusyKey(`${provider}-push`)
        try {
            const updated = await updateIntegrationPreferences(
                provider === 'mal' ? { mal_auto_push: nextValue } : { anilist_auto_push: nextValue },
            )
            setStatus(updated)
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo actualizar auto-push.',
            })
        } finally {
            setBusyKey(null)
        }
    }

    const handleGenerateToken = async () => {
        setBusyKey('ext-token')
        setFeedback(null)
        try {
            const res = await generateExtensionToken()
            setFreshToken(res.token)
            setStatus(res.status)
            setCopiedToken(false)
            setFeedback({
                type: 'success',
                text: 'Token generado. Cópialo y pégalo en el popup de la extensión Animigos Sync.',
            })
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo generar el token.',
            })
        } finally {
            setBusyKey(null)
        }
    }

    const handleCopyToken = async () => {
        if (!freshToken) return
        try {
            await navigator.clipboard.writeText(freshToken)
            setCopiedToken(true)
            setTimeout(() => setCopiedToken(false), 2500)
        } catch {
            setFeedback({ type: 'error', text: 'No se pudo copiar al portapapeles.' })
        }
    }

    const handleNetflixFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setBusyKey('netflix-csv')
        setFeedback(null)
        setNetflixResult(null)
        try {
            const res = await importNetflixCsvFile(file)
            setNetflixResult(res)
            setFeedback({
                type: 'success',
                text: `Netflix CSV procesado: ${res.matched_animes} animes detectados (${res.created} nuevos, ${res.updated} actualizados).`,
            })
            invalidateUserLists()
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err instanceof Error ? err.message : 'No se pudo importar el CSV de Netflix.',
            })
        } finally {
            setBusyKey(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    if (loading && !status) {
        return (
            <div className="d-flex align-items-center justify-content-center gap-2 py-4" style={{ color: 'var(--perfil-text-muted)' }}>
                <Loader2 size={16} className="spin" />
                <span className="small">Cargando integraciones...</span>
            </div>
        )
    }

    const cardStyle: React.CSSProperties = {
        background: 'var(--perfil-card-2)',
        border: '1px solid var(--perfil-border)',
        borderRadius: 12,
    }

    return (
        <div className="d-flex flex-column gap-3 animate-fade-in">
            {feedback && (
                <div
                    className="p-2.5 rounded-3 small d-flex align-items-center justify-content-between gap-2"
                    style={{
                        background:
                            feedback.type === 'success'
                                ? 'rgba(34, 197, 94, 0.14)'
                                : 'rgba(239, 68, 68, 0.14)',
                        border: `1px solid ${
                            feedback.type === 'success'
                                ? 'rgba(34, 197, 94, 0.35)'
                                : 'rgba(239, 68, 68, 0.35)'
                        }`,
                        color: feedback.type === 'success' ? '#86efac' : '#fca5a5',
                        fontSize: '0.78rem',
                    }}
                >
                    <span>{feedback.text}</span>
                </div>
            )}

            {/* 1. MyAnimeList */}
            <div className="p-3" style={cardStyle}>
                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-white" style={{ fontSize: '0.88rem' }}>
                                MyAnimeList
                            </span>
                            <span
                                className="badge rounded-pill"
                                style={{
                                    fontSize: '0.68rem',
                                    background: status?.mal.connected
                                        ? 'rgba(34, 197, 94, 0.18)'
                                        : 'rgba(255, 255, 255, 0.08)',
                                    color: status?.mal.connected ? '#86efac' : 'var(--perfil-text-muted)',
                                }}
                            >
                                {status?.mal.connected
                                    ? `Conectado${status.mal.username ? ` · @${status.mal.username}` : ''}`
                                    : 'No conectado'}
                            </span>
                        </div>
                        <p className="mb-0 mt-1" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.75rem' }}>
                            Sincronización bidireccional OAuth2: importa tu lista y envía automáticamente cada capítulo que marques en Animigos.
                        </p>
                    </div>

                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        {status?.mal.connected ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSyncMal}
                                    disabled={busyKey !== null}
                                    className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1"
                                >
                                    <RefreshCw size={13} />
                                    <span>{busyKey === 'mal-sync' ? 'Sincronizando...' : 'Sincronizar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDisconnectMal}
                                    disabled={busyKey !== null}
                                    className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1"
                                    title="Desvincular MyAnimeList"
                                >
                                    <Unlink size={13} />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConnectMal}
                                disabled={busyKey !== null}
                                className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1"
                            >
                                <ExternalLink size={13} />
                                <span>{busyKey === 'mal-connect' ? 'Redirigiendo...' : 'Conectar MAL'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {status?.mal.connected && (
                    <label
                        className="d-flex align-items-center gap-2 mt-2.5 pt-2 border-top small"
                        style={{ borderColor: 'var(--perfil-border)', color: 'var(--perfil-text-muted)', cursor: 'pointer', fontSize: '0.74rem' }}
                    >
                        <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={status.mal.auto_push}
                            disabled={busyKey === 'mal-push'}
                            onChange={(e) => handleToggleAutoPush('mal', e.target.checked)}
                        />
                        <span>Enviar automáticamente mis episodios y notas a MyAnimeList</span>
                    </label>
                )}

                {status && !status.mal.configured && !status.mal.connected && (
                    <div className="mt-2 small" style={{ color: '#fbbf24', fontSize: '0.72rem' }}>
                        Requiere configurar <code>MAL_CLIENT_ID</code> en el <code>.env</code> del servidor.
                    </div>
                )}
            </div>

            {/* 2. AniList */}
            <div className="p-3" style={cardStyle}>
                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-white" style={{ fontSize: '0.88rem' }}>
                                AniList
                            </span>
                            <span
                                className="badge rounded-pill"
                                style={{
                                    fontSize: '0.68rem',
                                    background: status?.anilist.connected
                                        ? 'rgba(34, 197, 94, 0.18)'
                                        : 'rgba(56, 189, 248, 0.16)',
                                    color: status?.anilist.connected ? '#86efac' : '#7dd3fc',
                                }}
                            >
                                {status?.anilist.connected
                                    ? `OAuth conectado${status.anilist.username ? ` · @${status.anilist.username}` : ''}`
                                    : 'Importación pública disponible'}
                            </span>
                        </div>
                        <p className="mb-0 mt-1" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.75rem' }}>
                            Vincula vía OAuth2 (bidireccional) o importa al instante ingresando tu usuario público de AniList.
                        </p>
                    </div>

                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        {status?.anilist.connected ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSyncAniList(false)}
                                    disabled={busyKey !== null}
                                    className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1"
                                >
                                    <RefreshCw size={13} />
                                    <span>{busyKey === 'al-sync' ? 'Sincronizando...' : 'Sincronizar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDisconnectAniList}
                                    disabled={busyKey !== null}
                                    className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1"
                                    title="Desvincular AniList"
                                >
                                    <Unlink size={13} />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConnectAniList}
                                disabled={busyKey !== null}
                                className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1"
                            >
                                <Link2 size={13} />
                                <span>{busyKey === 'al-connect' ? 'Redirigiendo...' : 'Conectar OAuth'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Importación directa por usuario público de AniList */}
                <div className="d-flex gap-2 mt-2.5">
                    <input
                        type="text"
                        value={anilistUsername}
                        onChange={(e) => setAnilistUsername(e.target.value)}
                        placeholder="Tu usuario público de AniList (ej. Kurosaki)"
                        className="form-control form-control-sm text-white"
                        style={{
                            background: 'var(--perfil-card)',
                            borderColor: 'var(--perfil-border)',
                            fontSize: '0.78rem',
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => handleSyncAniList(true)}
                        disabled={busyKey !== null || !anilistUsername.trim()}
                        className="ml-btn ml-btn-acento ml-btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1"
                    >
                        <RefreshCw size={13} />
                        <span>{busyKey === 'al-sync' ? 'Importando...' : 'Importar lista'}</span>
                    </button>
                </div>

                {status?.anilist.connected && (
                    <label
                        className="d-flex align-items-center gap-2 mt-2.5 pt-2 border-top small"
                        style={{ borderColor: 'var(--perfil-border)', color: 'var(--perfil-text-muted)', cursor: 'pointer', fontSize: '0.74rem' }}
                    >
                        <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={status.anilist.auto_push}
                            disabled={busyKey === 'anilist-push'}
                            onChange={(e) => handleToggleAutoPush('anilist', e.target.checked)}
                        />
                        <span>Enviar automáticamente mis episodios y notas a AniList</span>
                    </label>
                )}
            </div>

            {/* 3. Extensión de Navegador (Crunchyroll & Netflix) */}
            <div className="p-3" style={cardStyle}>
                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <Puzzle size={15} style={{ color: 'var(--perfil-acento)' }} />
                            <span className="fw-bold text-white" style={{ fontSize: '0.88rem' }}>
                                Auto-Tracking Crunchyroll & Netflix
                            </span>
                            <span
                                className="badge rounded-pill"
                                style={{
                                    fontSize: '0.68rem',
                                    background: status?.extension.has_token
                                        ? 'rgba(34, 197, 94, 0.18)'
                                        : 'rgba(255, 255, 255, 0.08)',
                                    color: status?.extension.has_token ? '#86efac' : 'var(--perfil-text-muted)',
                                }}
                            >
                                {status?.extension.has_token ? 'Token activo' : 'Sin token'}
                            </span>
                        </div>
                        <p className="mb-0 mt-1" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.75rem' }}>
                            Instala la extensión <strong>Animigos Sync</strong> (Chrome/Edge/Brave/Firefox) para marcar episodios automáticamente al llegar al 85% en Crunchyroll o Netflix.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerateToken}
                        disabled={busyKey !== null}
                        className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1"
                    >
                        <KeyRound size={13} />
                        <span>
                            {busyKey === 'ext-token'
                                ? 'Generando...'
                                : status?.extension.has_token
                                  ? 'Regenerar Token'
                                  : 'Generar Token'}
                        </span>
                    </button>
                </div>

                {freshToken && (
                    <div
                        className="mt-2.5 p-2 rounded-2 d-flex align-items-center justify-content-between gap-2"
                        style={{ background: 'var(--perfil-card)', border: '1px solid var(--perfil-acento)' }}
                    >
                        <code className="text-truncate small" style={{ color: '#ffffff', fontSize: '0.74rem' }}>
                            {freshToken}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopyToken}
                            className="ml-btn ml-btn-fantasma ml-btn-sm flex-shrink-0 d-inline-flex align-items-center gap-1"
                        >
                            {copiedToken ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedToken ? 'Copiado' : 'Copiar'}</span>
                        </button>
                    </div>
                )}

                {status?.extension.last_tracked_title && (
                    <div className="mt-2 small" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.72rem' }}>
                        Último episodio detectado: <strong className="text-white">{status.extension.last_tracked_title}</strong>{' '}
                        ({status.extension.last_tracked_source})
                    </div>
                )}
            </div>

            {/* 4. Importador de Historial NetflixViewingHistory.csv */}
            <div className="p-3" style={cardStyle}>
                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <FileSpreadsheet size={15} style={{ color: 'var(--perfil-acento)' }} />
                            <span className="fw-bold text-white" style={{ fontSize: '0.88rem' }}>
                                Importar Historial de Netflix (CSV)
                            </span>
                        </div>
                        <p className="mb-0 mt-1" style={{ color: 'var(--perfil-text-muted)', fontSize: '0.75rem' }}>
                            Descarga <code>NetflixViewingHistory.csv</code> desde{' '}
                            <a
                                href="https://www.netflix.com/viewingactivity"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--perfil-acento)' }}
                            >
                                netflix.com/viewingactivity
                            </a>{' '}
                            y súbelo aquí para importar tus animes vistos de una sola vez.
                        </p>
                    </div>

                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            onChange={handleNetflixFileChange}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busyKey !== null}
                            className="ml-btn ml-btn-fantasma ml-btn-sm d-inline-flex align-items-center gap-1"
                        >
                            <Upload size={13} />
                            <span>{busyKey === 'netflix-csv' ? 'Procesando...' : 'Subir CSV'}</span>
                        </button>
                    </div>
                </div>

                {netflixResult && (
                    <div className="mt-2 small" style={{ color: '#86efac', fontSize: '0.73rem' }}>
                        Series escaneadas: {netflixResult.total_titles_scanned} · Animes encontrados:{' '}
                        {netflixResult.matched_animes} ({netflixResult.created} nuevos, {netflixResult.updated}{' '}
                        actualizados).
                    </div>
                )}
            </div>
        </div>
    )
}
