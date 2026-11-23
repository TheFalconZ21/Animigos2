import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Image as ImageIcon, RotateCcw, Sliders, Sparkles, Trash2, Upload } from 'lucide-react'
import { SHOWCASE_ROW_1, SHOWCASE_ROW_2, SHOWCASE_ROW_3 } from '../../data/showcase-animes'
import { Dialogo } from './piezas'
import type { FilaLista } from './mi-lista-data'

// ============================================================
// Banners laterales de Mi Lista
// - Modo automático: rotación de afiches de la lista del usuario
// - Modo personalizado: imágenes o GIFs animados subidos o por URL
//   (iguales en ambos lados o independientes izquierda/derecha)
// ============================================================

export interface LateralAnimeItem {
    title: string
    imageUrl: string
}

export interface MiListaLateralConfig {
    mode: 'auto' | 'custom'
    enabled: boolean
    leftUrl: string
    rightUrl: string
    mirrorBoth: boolean
    opacity: number
}

export const DEFAULT_MILISTA_LATERAL_CONFIG: MiListaLateralConfig = {
    mode: 'auto',
    enabled: true,
    leftUrl: '',
    rightUrl: '',
    mirrorBoth: false,
    opacity: 65,
}

interface Props {
    filas?: FilaLista[]
    visibles?: FilaLista[]
    activeFila?: FilaLista | null
    customConfig?: MiListaLateralConfig
}

const DURACION_FADE_MS = 800
const INTERVALO_ROTACION_MS = 5000
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024 // 6 MB para soportar GIFs animados

const FALLBACK_ANIMES: LateralAnimeItem[] = [
    ...SHOWCASE_ROW_1,
    ...SHOWCASE_ROW_2,
    ...SHOWCASE_ROW_3,
].map((a) => ({ title: a.title, imageUrl: a.cover }))

/** Mejora automáticamente URLs de AniList CDN de /cover/medium/ a /cover/large/ */
function toHdPosterUrl(url: string): string {
    if (!url) return url
    if (url.includes('anilistcdn/media/anime/cover/medium/')) {
        return url.replace('/cover/medium/', '/cover/large/')
    }
    return url
}

export function LateralesAnime({ filas = [], visibles = [], activeFila, customConfig }: Props) {
    const cfg = customConfig ?? DEFAULT_MILISTA_LATERAL_CONFIG

    // Pool de animes derivados de la lista del usuario (o fallback)
    const pool = useMemo<LateralAnimeItem[]>(() => {
        const fuente = visibles.length > 0 ? visibles : filas
        const items = fuente
            .filter((f) => Boolean(f.anime?.imageUrl))
            .map((f) => ({
                title: f.anime.title,
                imageUrl: toHdPosterUrl(f.anime.imageUrl),
            }))
        return items.length > 0 ? items : FALLBACK_ANIMES
    }, [visibles, filas])

    const [idleIndex, setIdleIndex] = useState(0)

    // Al cambiar la lista o los filtros reseteamos el ciclo
    useEffect(() => {
        setIdleIndex(0)
    }, [pool.length])

    // Rotación automática cada 5 segundos cuando está en modo auto y sin selección activa
    useEffect(() => {
        if (!cfg.enabled || cfg.mode === 'custom') return
        if (activeFila) return
        if (pool.length <= 1) return

        const timer = setInterval(() => {
            setIdleIndex((prev) => (prev + 1) % pool.length)
        }, INTERVALO_ROTACION_MS)

        return () => clearInterval(timer)
    }, [activeFila, pool.length, cfg.enabled, cfg.mode])

    const targetAnime = useMemo<LateralAnimeItem>(() => {
        if (activeFila?.anime?.imageUrl) {
            return {
                title: activeFila.anime.title,
                imageUrl: toHdPosterUrl(activeFila.anime.imageUrl),
            }
        }
        return pool[idleIndex % pool.length] || FALLBACK_ANIMES[0]
    }, [activeFila, pool, idleIndex])

    if (!cfg.enabled) {
        return null
    }

    // Modo personalizado (2 imágenes o GIFs completamente independientes: izquierda y derecha)
    if (cfg.mode === 'custom' && (cfg.leftUrl || cfg.rightUrl)) {
        const leftSrc = (cfg.leftUrl || '').trim()
        const rightSrc = (cfg.rightUrl || '').trim()
        const opacityStyle = Math.max(0.1, Math.min(1, (cfg.opacity || 65) / 100))

        return (
            <div className="ml-laterales-wrap">
                {leftSrc && (
                    <div className="ml-lateral ml-lateral-izq is-active" aria-hidden="true">
                        <div className="ml-lateral-contenedor">
                            <div className="ml-lateral-capa">
                                <img
                                    className="ml-lateral-img"
                                    src={leftSrc}
                                    alt=""
                                    style={{ opacity: opacityStyle }}
                                />
                            </div>
                            <div className="ml-lateral-overlay" />
                        </div>
                    </div>
                )}
                {rightSrc && (
                    <div className="ml-lateral ml-lateral-der is-active" aria-hidden="true">
                        <div className="ml-lateral-contenedor">
                            <div className="ml-lateral-capa">
                                <img
                                    className="ml-lateral-img"
                                    src={rightSrc}
                                    alt=""
                                    style={{ opacity: opacityStyle }}
                                />
                            </div>
                            <div className="ml-lateral-overlay" />
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const isActive = Boolean(activeFila)

    return (
        <div className="ml-laterales-wrap">
            <BannerLado lado="izq" anime={targetAnime} isActive={isActive} />
            <BannerLado lado="der" anime={targetAnime} isActive={isActive} />
        </div>
    )
}

interface Capa {
    clave: number
    anime: LateralAnimeItem
}

function BannerLado({
    lado,
    anime,
    isActive,
}: {
    lado: 'izq' | 'der'
    anime: LateralAnimeItem
    isActive: boolean
}) {
    const [capas, setCapas] = useState<Capa[]>([{ clave: 0, anime }])

    useEffect(() => {
        if (!anime?.imageUrl) return
        const ultimo = capas[capas.length - 1]
        if (ultimo && ultimo.anime.imageUrl === anime.imageUrl) return

        let cancelado = false
        let timer: ReturnType<typeof setTimeout>

        const img = new Image()
        img.onload = img.onerror = () => {
            if (cancelado) return
            setCapas((prev) => {
                const prevUltimo = prev[prev.length - 1]
                const nuevaClave = (prevUltimo?.clave ?? 0) + 1
                return [...prev.slice(-1), { clave: nuevaClave, anime }]
            })
            timer = setTimeout(() => {
                if (!cancelado) {
                    setCapas((prev) => prev.slice(-1))
                }
            }, DURACION_FADE_MS)
        }
        img.src = anime.imageUrl

        return () => {
            cancelado = true
            clearTimeout(timer)
        }
    }, [anime.imageUrl])

    return (
        <div
            className={`ml-lateral ml-lateral-${lado} ${isActive ? 'is-active' : ''}`}
            aria-hidden="true"
        >
            <div className="ml-lateral-contenedor">
                {capas.map((c, i) => {
                    const esUltima = i === capas.length - 1 && capas.length > 1
                    return (
                        <div
                            key={c.clave}
                            className={`ml-lateral-capa ${esUltima ? 'ml-lateral-entra' : ''}`}
                        >
                            <img
                                className="ml-lateral-img"
                                src={c.anime.imageUrl || FALLBACK_ANIMES[0].imageUrl}
                                alt=""
                                decoding="async"
                            />
                        </div>
                    )
                })}
                <div className="ml-lateral-overlay" />
            </div>
        </div>
    )
}

export function LateralBannerModal({
    abierto,
    onCerrar,
    config,
    onGuardar,
}: {
    abierto: boolean
    onCerrar: () => void
    config: MiListaLateralConfig
    onGuardar: (next: MiListaLateralConfig) => void
}) {
    const [draft, setDraft] = useState<MiListaLateralConfig>(config)
    const [uploadError, setUploadError] = useState<string | null>(null)

    useEffect(() => {
        if (abierto) {
            setDraft(config)
            setUploadError(null)
        }
    }, [abierto, config])

    const handleFileUpload = (side: 'left' | 'right', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadError(null)

        if (!file.type.startsWith('image/')) {
            setUploadError('Selecciona una imagen válida (PNG, JPG, WebP o GIF animado).')
            return
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setUploadError('El archivo supera el límite de 6 MB. Comprímelo o usa una URL directa.')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const dataUrl = reader.result
                setDraft((prev) => ({
                    ...prev,
                    mode: 'custom',
                    enabled: true,
                    mirrorBoth: false,
                    leftUrl: side === 'left' ? dataUrl : prev.leftUrl,
                    rightUrl: side === 'right' ? dataUrl : prev.rightUrl,
                }))
            }
        }
        reader.readAsDataURL(file)
    }

    const handleSave = () => {
        onGuardar({ ...draft, mirrorBoth: false })
        onCerrar()
    }

    return (
        <Dialogo
            abierto={abierto}
            onCerrar={onCerrar}
            etiqueta="Personalizar banners laterales (Imagen / GIF)"
            ancho={680}
        >
            <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">AMBIENTACIÓN DE MI LISTA</span>
                    <h3 className="h5 fw-bold text-white mt-1 mb-1 d-flex align-items-center gap-2">
                        <ImageIcon size={18} style={{ color: 'var(--ml-acento, #a78bfa)' }} />
                        <span>Banners Laterales (Imagen o GIF)</span>
                    </h3>
                    <p className="small text-secondary mb-0">
                        Personaliza los laterales de tu lista con cualquier imagen o GIF animado (archivo local o URL).
                    </p>
                </div>

                {/* Toggle visible/oculto */}
                <div
                    className="d-flex align-items-center justify-content-between p-2.5 rounded-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    <span className="small fw-semibold text-white d-inline-flex align-items-center gap-2">
                        {draft.enabled ? <Eye size={15} className="text-success" /> : <EyeOff size={15} className="text-secondary" />}
                        Mostrar banners laterales
                    </span>
                    <button
                        type="button"
                        className="ml-btn ml-btn-sm"
                        onClick={() => setDraft((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    >
                        {draft.enabled ? 'Activado' : 'Oculto'}
                    </button>
                </div>

                {/* Selector de modo: Automático vs Personalizado */}
                <div className="ml-segmentado" role="group" aria-label="Modo de banners laterales">
                    <button
                        type="button"
                        aria-pressed={draft.mode === 'auto'}
                        onClick={() => setDraft((prev) => ({ ...prev, mode: 'auto', enabled: true }))}
                    >
                        <Sparkles size={14} /> Afiches automáticos
                    </button>
                    <button
                        type="button"
                        aria-pressed={draft.mode === 'custom'}
                        onClick={() => setDraft((prev) => ({ ...prev, mode: 'custom', enabled: true }))}
                    >
                        <Upload size={14} /> Imagen / GIF propio
                    </button>
                </div>

                {draft.mode === 'custom' && (
                    <>
                        {/* Dos paneles independientes: Banner Izquierdo y Banner Derecho */}
                        <div className="row g-3">
                            {/* Lateral Izquierdo */}
                            <div className="col-12 col-md-6">
                                <div
                                    className="p-3 rounded-3 d-flex flex-column gap-2 h-100"
                                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                    <div className="d-flex align-items-center justify-content-between gap-2">
                                        <span className="ml-label mb-0">Banner Izquierdo</span>
                                        <label className="ml-btn ml-btn-fantasma ml-btn-sm mb-0" style={{ cursor: 'pointer' }}>
                                            <Upload size={13} /> Subir
                                            <input
                                                type="file"
                                                accept="image/gif,image/png,image/jpeg,image/webp,image/*"
                                                onChange={(e) => handleFileUpload('left', e)}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                    <input
                                        type="url"
                                        className="ml-input w-100"
                                        placeholder="URL directa (IMG o GIF)..."
                                        value={draft.leftUrl.startsWith('data:') ? 'Archivo local cargado' : draft.leftUrl}
                                        onChange={(e) => setDraft((prev) => ({ ...prev, leftUrl: e.target.value }))}
                                    />
                                    {draft.leftUrl ? (
                                        <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                                            <div className="d-flex align-items-center gap-2">
                                                <img
                                                    src={draft.leftUrl}
                                                    alt="Vista previa banner izquierdo"
                                                    style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)' }}
                                                />
                                                <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>Izquierdo activo</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="ml-btn ml-btn-fantasma ml-btn-sm text-danger"
                                                onClick={() => setDraft((prev) => ({ ...prev, leftUrl: '' }))}
                                                title="Quitar banner izquierdo"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="small text-secondary opacity-75 mt-1" style={{ fontSize: '0.74rem' }}>
                                            Sin imagen asignada en el lado izquierdo.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Lateral Derecho */}
                            <div className="col-12 col-md-6">
                                <div
                                    className="p-3 rounded-3 d-flex flex-column gap-2 h-100"
                                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                    <div className="d-flex align-items-center justify-content-between gap-2">
                                        <span className="ml-label mb-0">Banner Derecho</span>
                                        <label className="ml-btn ml-btn-fantasma ml-btn-sm mb-0" style={{ cursor: 'pointer' }}>
                                            <Upload size={13} /> Subir
                                            <input
                                                type="file"
                                                accept="image/gif,image/png,image/jpeg,image/webp,image/*"
                                                onChange={(e) => handleFileUpload('right', e)}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                    <input
                                        type="url"
                                        className="ml-input w-100"
                                        placeholder="URL directa (IMG o GIF)..."
                                        value={draft.rightUrl.startsWith('data:') ? 'Archivo local cargado' : draft.rightUrl}
                                        onChange={(e) => setDraft((prev) => ({ ...prev, rightUrl: e.target.value }))}
                                    />
                                    {draft.rightUrl ? (
                                        <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                                            <div className="d-flex align-items-center gap-2">
                                                <img
                                                    src={draft.rightUrl}
                                                    alt="Vista previa banner derecho"
                                                    style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)' }}
                                                />
                                                <span className="small text-secondary" style={{ fontSize: '0.74rem' }}>Derecho activo</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="ml-btn ml-btn-fantasma ml-btn-sm text-danger"
                                                onClick={() => setDraft((prev) => ({ ...prev, rightUrl: '' }))}
                                                title="Quitar banner derecho"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="small text-secondary opacity-75 mt-1" style={{ fontSize: '0.74rem' }}>
                                            Sin imagen asignada en el lado derecho.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Opacidad */}
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-1">
                                <span className="ml-label mb-0 d-inline-flex align-items-center gap-1.5">
                                    <Sliders size={13} /> Opacidad
                                </span>
                                <span className="small text-secondary">{draft.opacity}%</span>
                            </div>
                            <input
                                type="range"
                                min={15}
                                max={100}
                                step={5}
                                value={draft.opacity}
                                onChange={(e) => setDraft((prev) => ({ ...prev, opacity: Number(e.target.value) }))}
                                className="w-100"
                            />
                        </div>
                    </>
                )}

                {uploadError && (
                    <div className="small text-danger" role="alert">
                        {uploadError}
                    </div>
                )}
            </div>

            <footer className="ml-dialog-pie justify-content-between">
                <button
                    type="button"
                    className="ml-btn ml-btn-fantasma ml-btn-sm"
                    onClick={() => setDraft(DEFAULT_MILISTA_LATERAL_CONFIG)}
                    title="Restaurar afiches automáticos"
                >
                    <RotateCcw size={13} /> Restaurar
                </button>
                <div className="d-flex gap-2">
                    <button type="button" className="ml-btn ml-btn-fantasma" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="button" className="ml-btn ml-btn-acento" onClick={handleSave}>
                        Guardar laterales
                    </button>
                </div>
            </footer>
        </Dialogo>
    )
}
