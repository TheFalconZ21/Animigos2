import React, { useState, useEffect } from 'react'
import { Image as ImageIcon, Sparkles, Upload, Eye, EyeOff, Sliders } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import type { LateralWallpaperConfig } from './perfil-types'

export const LATERAL_PRESETS = [
    {
        label: 'Cyberpunk City Neon (GIF)',
        url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
    },
    {
        label: 'Lofi Anime Rain (GIF)',
        url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    },
    {
        label: 'Pixel Space Odyssey',
        url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    },
    {
        label: 'Sakura Night Bloom',
        url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&auto=format&fit=crop&q=80',
    },
    {
        label: 'Retro Synthwave Grid',
        url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    },
    {
        label: 'Ghibli Misty Forest',
        url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=800&auto=format&fit=crop&q=80',
    },
]

interface LateralCustomWallpaperProps {
    config: LateralWallpaperConfig
    onChangeConfig: (newConfig: LateralWallpaperConfig) => void
    isEditMode?: boolean
    externalModalOpen?: boolean
    onCloseExternalModal?: () => void
}

export const LateralCustomWallpaper: React.FC<LateralCustomWallpaperProps> = ({
    config,
    onChangeConfig,
    isEditMode = false,
    externalModalOpen = false,
    onCloseExternalModal,
}) => {
    const [modalOpen, setModalOpen] = useState(false)
    const [customUrl, setCustomUrl] = useState(config.imageUrl || LATERAL_PRESETS[0].url)
    const [opacity, setOpacity] = useState(config.opacity || 55)
    const [enabled, setEnabled] = useState(config.enabled)

    useEffect(() => {
        setCustomUrl(config.imageUrl || LATERAL_PRESETS[0].url)
        setOpacity(config.opacity || 55)
        setEnabled(config.enabled)
    }, [config.imageUrl, config.opacity, config.enabled])

    const isDialogOpen = modalOpen || externalModalOpen

    const handleClose = () => {
        setModalOpen(false)
        onCloseExternalModal?.()
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setCustomUrl(reader.result)
                setEnabled(true)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleSave = () => {
        onChangeConfig({
            imageUrl: customUrl || LATERAL_PRESETS[0].url,
            opacity,
            enabled,
        })
        handleClose()
    }

    const activeImageUrl = config.imageUrl || LATERAL_PRESETS[0].url

    return (
        <>
            {/* Laterales renderizados a izquierda y derecha con gradiente difuminado hacia el centro */}
            {config.enabled && activeImageUrl && (
                <>
                    <div className="perfil-lateral-art perfil-lateral-left" aria-hidden="true">
                        <img
                            src={activeImageUrl}
                            alt=""
                            className="perfil-lateral-img"
                            style={{ opacity: (config.opacity || 55) / 100 }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none'
                            }}
                        />
                    </div>
                    <div className="perfil-lateral-art perfil-lateral-right" aria-hidden="true">
                        <img
                            src={activeImageUrl}
                            alt=""
                            className="perfil-lateral-img"
                            style={{ opacity: (config.opacity || 55) / 100 }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none'
                            }}
                        />
                    </div>
                </>
            )}

            {/* Refuerzo visual precortado para laterales (visible en modo edición) */}
            {isEditMode && (
                <>
                    {/* Lateral Izquierdo: Área precortada interactiva */}
                    <div
                        className="perfil-crop-target-lateral perfil-crop-target-lateral-left d-none d-xl-flex animate-fade-in"
                        onClick={() => setModalOpen(true)}
                        role="button"
                        tabIndex={0}
                        title="Haz clic para personalizar el fondo lateral izquierdo (GIF o Imagen)"
                    >
                        <div className="perfil-crop-corner perfil-crop-tl" />
                        <div className="perfil-crop-corner perfil-crop-tr" />
                        <div className="perfil-crop-corner perfil-crop-bl" />
                        <div className="perfil-crop-corner perfil-crop-br" />
                        <ImageIcon size={24} style={{ color: 'var(--perfil-acento)' }} />
                        <span
                            className="small fw-bold text-white text-center"
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '1px' }}
                        >
                            Fondo Lateral Izquierdo
                        </span>
                        <span
                            className="badge rounded-pill text-dark px-2 py-1 mt-auto"
                            style={{ background: 'var(--perfil-acento)', fontSize: '0.68rem', fontWeight: 700 }}
                        >
                            Subir GIF / Imagen
                        </span>
                    </div>

                    {/* Lateral Derecho: Área precortada interactiva */}
                    <div
                        className="perfil-crop-target-lateral perfil-crop-target-lateral-right d-none d-xl-flex animate-fade-in"
                        onClick={() => setModalOpen(true)}
                        role="button"
                        tabIndex={0}
                        title="Haz clic para personalizar el fondo lateral derecho (GIF o Imagen)"
                    >
                        <div className="perfil-crop-corner perfil-crop-tl" />
                        <div className="perfil-crop-corner perfil-crop-tr" />
                        <div className="perfil-crop-corner perfil-crop-bl" />
                        <div className="perfil-crop-corner perfil-crop-br" />
                        <ImageIcon size={24} style={{ color: 'var(--perfil-acento)' }} />
                        <span
                            className="small fw-bold text-white text-center"
                            style={{ writingMode: 'vertical-rl', letterSpacing: '1px' }}
                        >
                            Fondo Lateral Derecho
                        </span>
                        <span
                            className="badge rounded-pill text-dark px-2 py-1 mt-auto"
                            style={{ background: 'var(--perfil-acento)', fontSize: '0.68rem', fontWeight: 700 }}
                        >
                            Subir GIF / Imagen
                        </span>
                    </div>

                    {/* Botón flotante para pantallas pequeñas / móviles */}
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="perfil-crop-lateral-mobile-btn d-xl-none animate-fade-in"
                        title="Personalizar Imagen o GIF de fondo lateral"
                    >
                        <Sliders size={16} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Laterales (GIF / Imagen) · Haz clic para personalizar</span>
                    </button>
                </>
            )}

            {/* Modal de Configuración de Laterales */}
            <Dialogo
                abierto={isDialogOpen}
                onCerrar={handleClose}
                etiqueta="Personalizar Fondo Lateral (GIF / Imagen)"
                ancho={540}
            >
                <div className="p-4 d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">ESTÉTICA & AMBIENTACIÓN</span>
                        <h3 className="h5 fw-bold text-white mb-1">Laterales Personalizados (GIF / Imagen)</h3>
                        <p className="small mb-0" style={{ color: 'var(--perfil-text-muted)' }}>
                            Rellena el espacio a los costados de tu perfil con la imagen o GIF animado que prefieras.
                        </p>
                    </div>

                    {/* Toggle de activación */}
                    <div className="perfil-switch-wrap">
                        <div className="d-flex align-items-center gap-2">
                            {enabled ? <Eye size={16} className="text-success" /> : <EyeOff size={16} className="text-secondary" />}
                            <span className="small fw-semibold text-white">Mostrar Fondos Laterales</span>
                        </div>
                        <button
                            type="button"
                            className={`perfil-pill-toggle ${enabled ? 'is-on' : ''}`}
                            onClick={() => setEnabled(!enabled)}
                        >
                            <span className="perfil-pill-handle" />
                        </button>
                    </div>

                    {/* Presets */}
                    <div>
                        <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                            <Sparkles size={14} style={{ color: 'var(--perfil-acento)' }} />
                            <span>Presets de Fondo / GIF Animados</span>
                        </label>
                        <div className="row g-2">
                            {LATERAL_PRESETS.map((p) => {
                                const isSelected = customUrl === p.url
                                return (
                                    <div key={p.label} className="col-6">
                                        <div
                                            className={`p-2 rounded-3 border d-flex align-items-center gap-2`}
                                            onClick={() => {
                                                setCustomUrl(p.url)
                                                setEnabled(true)
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                background: isSelected ? 'var(--perfil-acento-soft)' : 'var(--perfil-card-2)',
                                                borderColor: isSelected ? 'var(--perfil-acento)' : 'var(--perfil-border)',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            <img
                                                src={p.url}
                                                alt=""
                                                className="rounded"
                                                style={{ width: 36, height: 36, objectFit: 'cover' }}
                                            />
                                            <span className="small text-white fw-semibold" style={{ fontSize: '0.74rem' }}>
                                                {p.label}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Subir archivo propio o ingresar URL */}
                    <div>
                        <label className="form-label small fw-semibold text-white d-flex align-items-center justify-content-between mb-1.5">
                            <span className="d-flex align-items-center gap-1.5">
                                <Upload size={14} style={{ color: 'var(--perfil-cyan)' }} />
                                <span>Subir Imagen o GIF Propio</span>
                            </span>
                            <label className="btn btn-sm btn-outline-secondary py-0.5 px-2 mb-0" style={{ fontSize: '0.72rem', cursor: 'pointer' }}>
                                📁 Elegir Archivo
                                <input
                                    type="file"
                                    accept="image/*,.gif,.webp"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </label>
                        <input
                            type="url"
                            className="cat-search-control w-100"
                            placeholder="O pega una URL directa de imagen o GIF (https://...)"
                            value={customUrl.startsWith('data:') ? 'Imagen local cargada' : customUrl}
                            onChange={(e) => {
                                setCustomUrl(e.target.value)
                                if (e.target.value.trim()) setEnabled(true)
                            }}
                            style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                        />
                    </div>

                    {/* Slider de Opacidad */}
                    <div>
                        <div className="d-flex align-items-center justify-content-between mb-1.5">
                            <span className="small text-white fw-semibold d-flex align-items-center gap-1.5">
                                <Sliders size={13} style={{ color: 'var(--perfil-amber)' }} />
                                <span>Opacidad del Fondo</span>
                            </span>
                            <span className="small font-mono text-secondary">{opacity}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={opacity}
                            onChange={(e) => setOpacity(Number(e.target.value))}
                            className="wp-slider-track w-100"
                        />
                    </div>

                    {/* Acciones */}
                    <div className="d-flex justify-content-end gap-2 pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                        <button type="button" onClick={() => setModalOpen(false)} className="ml-btn ml-btn-fantasma ml-btn-sm">
                            Cancelar
                        </button>
                        <button type="button" onClick={handleSave} className="ml-btn ml-btn-acento ml-btn-sm">
                            Guardar Fondo Lateral
                        </button>
                    </div>
                </div>
            </Dialogo>
        </>
    )
}
