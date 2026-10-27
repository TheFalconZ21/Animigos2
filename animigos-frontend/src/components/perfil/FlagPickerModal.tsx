import React, { useState } from 'react'
import { Flag, Sparkles, Upload, Check } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'

export const FLAG_PRESETS = [
    {
        title: 'Neo Tokyo Horizon',
        url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&auto=format&fit=crop&q=80',
    },
    {
        title: 'Cyberpunk Neon Alley',
        url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
    },
    {
        title: 'Ghibli Starlit Sky',
        url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
    },
    {
        title: 'Sakura Twilight Garden',
        url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200&auto=format&fit=crop&q=80',
    },
    {
        title: 'Retro Synthwave Grid',
        url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80',
    },
    {
        title: 'Anime Crimson Sunset',
        url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80',
    },
]

interface FlagPickerModalProps {
    open: boolean
    onClose: () => void
    currentFlagUrl: string
    onSaveFlag: (newUrl: string) => void
}

export const FlagPickerModal: React.FC<FlagPickerModalProps> = ({
    open,
    onClose,
    currentFlagUrl,
    onSaveFlag,
}) => {
    const [flagUrl, setFlagUrl] = useState(currentFlagUrl)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setFlagUrl(reader.result)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleSave = () => {
        if (flagUrl.trim()) {
            onSaveFlag(flagUrl.trim())
        }
        onClose()
    }

    return (
        <Dialogo abierto={open} onCerrar={onClose} etiqueta="Cambiar Banner Flag" ancho={560}>
            <div className="p-4 d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">CABECERA · ANIMIGOS</span>
                    <h3 className="h5 fw-bold text-white mb-1">Cambiar Imagen Flag del Perfil</h3>
                    <p className="small mb-0" style={{ color: 'var(--perfil-text-muted)' }}>
                        Elige una imagen o GIF panorámico para la tarjeta superior de tu perfil.
                    </p>
                </div>

                {/* Previsualización */}
                <div
                    className="rounded-3 overflow-hidden border position-relative"
                    style={{ height: 110, borderColor: 'var(--perfil-border)' }}
                >
                    <img
                        src={flagUrl || currentFlagUrl}
                        alt="Previsualización Flag"
                        className="w-100 h-100"
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                            e.currentTarget.src = FLAG_PRESETS[0].url
                        }}
                    />
                    <div
                        className="position-absolute bottom-0 start-0 p-2 text-white small fw-bold"
                        style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                            width: '100%',
                        }}
                    >
                        Vista previa de tu Flag
                    </div>
                </div>

                {/* Presets */}
                <div>
                    <label className="form-label small fw-semibold text-white d-flex align-items-center gap-1.5 mb-2">
                        <Sparkles size={14} style={{ color: 'var(--perfil-acento)' }} />
                        <span>Flags Panorámicos Recomendados</span>
                    </label>
                    <div className="row g-2">
                        {FLAG_PRESETS.map((p) => {
                            const isSelected = flagUrl === p.url
                            return (
                                <div key={p.title} className="col-6">
                                    <div
                                        className="rounded-3 border overflow-hidden position-relative"
                                        onClick={() => setFlagUrl(p.url)}
                                        style={{
                                            cursor: 'pointer',
                                            height: 60,
                                            borderColor: isSelected ? 'var(--perfil-acento)' : 'var(--perfil-border)',
                                            boxShadow: isSelected ? '0 0 12px var(--perfil-acento-glow)' : 'none',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <img src={p.url} alt={p.title} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                        <div
                                            className="position-absolute inset-0 d-flex align-items-center justify-content-between p-2"
                                            style={{ background: 'rgba(0,0,0,0.45)' }}
                                        >
                                            <span className="small text-white fw-semibold" style={{ fontSize: '0.72rem' }}>
                                                {p.title}
                                            </span>
                                            {isSelected && (
                                                <div
                                                    className="rounded-circle p-1"
                                                    style={{ background: 'var(--perfil-acento)', color: '#000' }}
                                                >
                                                    <Check size={10} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Subir archivo propio o URL */}
                <div>
                    <label className="form-label small fw-semibold text-white d-flex align-items-center justify-content-between mb-1.5">
                        <span className="d-flex align-items-center gap-1.5">
                            <Upload size={14} style={{ color: 'var(--perfil-cyan)' }} />
                            <span>Subir Archivo de Imagen o GIF</span>
                        </span>
                        <label className="btn btn-sm btn-outline-secondary py-0.5 px-2 mb-0" style={{ fontSize: '0.72rem', cursor: 'pointer' }}>
                            📁 Examinar...
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
                        placeholder="O ingresa URL de banner flag (https://...)"
                        value={flagUrl.startsWith('data:') ? 'Imagen local cargada' : flagUrl}
                        onChange={(e) => setFlagUrl(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                    />
                </div>

                {/* Acciones */}
                <div className="d-flex justify-content-end gap-2 pt-3 border-top" style={{ borderColor: 'var(--perfil-border)' }}>
                    <button type="button" onClick={onClose} className="ml-btn ml-btn-fantasma ml-btn-sm">
                        Cancelar
                    </button>
                    <button type="button" onClick={handleSave} className="ml-btn ml-btn-acento ml-btn-sm">
                        <Flag size={14} />
                        <span>Guardar Flag</span>
                    </button>
                </div>
            </div>
        </Dialogo>
    )
}
