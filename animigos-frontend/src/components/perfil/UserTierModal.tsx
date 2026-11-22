import React from 'react'
import { Check, Lock, Sparkles, Trophy } from 'lucide-react'
import { Dialogo } from '../mi-lista/piezas'
import { getUserTierProgress, USER_TIERS } from '../../utils/userTiers'
import { navigate } from '../../utils/navigation'

export interface UserTierModalProps {
    open: boolean
    onClose: () => void
    displayName: string
    totalWatchHours: number
}

export const UserTierModal: React.FC<UserTierModalProps> = ({
    open,
    onClose,
    displayName,
    totalWatchHours,
}) => {
    const progress = getUserTierProgress(totalWatchHours)
    const { current, next, hours, hoursToNext, progressPercent } = progress

    return (
        <Dialogo
            abierto={open}
            onCerrar={onClose}
            etiqueta={`Rango Otaku de ${displayName}`}
            ancho={560}
        >
            <div className="d-flex flex-column gap-3">
                {/* Tarjeta resumen del tier actual */}
                <div
                    className="p-3 rounded-3"
                    style={{
                        background: current.bg,
                        border: `1px solid ${current.border}`,
                        boxShadow: current.glow || 'none',
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                        <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{current.emoji}</span>
                            <div>
                                <div className="fw-bold text-white" style={{ fontSize: '1rem' }}>
                                    {current.name}
                                </div>
                                <div className="small" style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.76rem' }}>
                                    Tier {current.tier} de {USER_TIERS.length} · {current.description}
                                </div>
                            </div>
                        </div>
                        <div className="text-end">
                            <div className="fw-bold" style={{ color: current.color, fontSize: '1.15rem' }}>
                                {hours.toLocaleString()} h
                            </div>
                            <div className="small" style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.7rem' }}>
                                {(hours / 24).toFixed(1)} días vistos
                            </div>
                        </div>
                    </div>

                    {/* Barra de progreso hacia el siguiente tier */}
                    <div className="mt-3">
                        <div className="d-flex justify-content-between small mb-1" style={{ fontSize: '0.74rem' }}>
                            <span className="text-white fw-semibold">
                                {next
                                    ? `Siguiente: ${next.name} ${next.emoji}`
                                    : '¡Rango máximo alcanzado!'}
                            </span>
                            <span style={{ color: current.color, fontWeight: 700 }}>
                                {next ? `Faltan ${hoursToNext.toLocaleString()} h (${progressPercent}%)` : '100%'}
                            </span>
                        </div>
                        <div
                            className="rounded-pill overflow-hidden"
                            style={{ height: 8, background: 'rgba(0, 0, 0, 0.35)' }}
                        >
                            <div
                                className="h-100 rounded-pill"
                                style={{
                                    width: `${progressPercent}%`,
                                    background: current.color,
                                    transition: 'width 0.35s ease',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Escalera completa de 7 tiers */}
                <div className="d-flex flex-column gap-1.5">
                    <div
                        className="small fw-semibold text-uppercase d-flex align-items-center gap-1.5"
                        style={{ color: 'var(--perfil-text-muted)', fontSize: '0.7rem', letterSpacing: '0.06em' }}
                    >
                        <Sparkles size={12} />
                        <span>Escalera de Tiers Otaku</span>
                    </div>

                    {USER_TIERS.map((tier) => {
                        const isUnlocked = hours >= tier.minHours
                        const isCurrent = tier.tier === current.tier
                        const rangeLabel =
                            tier.maxHours !== null
                                ? `${tier.minHours.toLocaleString()} – ${tier.maxHours.toLocaleString()} h`
                                : `${tier.minHours.toLocaleString()}+ h`

                        return (
                            <div
                                key={tier.id}
                                className="px-3 py-2 rounded-3 d-flex align-items-center justify-content-between gap-2"
                                style={{
                                    background: isCurrent
                                        ? tier.bg
                                        : isUnlocked
                                          ? 'rgba(255, 255, 255, 0.04)'
                                          : 'rgba(255, 255, 255, 0.015)',
                                    border: `1px solid ${
                                        isCurrent
                                            ? tier.border
                                            : isUnlocked
                                              ? 'rgba(255, 255, 255, 0.1)'
                                              : 'rgba(255, 255, 255, 0.05)'
                                    }`,
                                    opacity: isUnlocked ? 1 : 0.62,
                                }}
                            >
                                <div className="d-flex align-items-center gap-2.5">
                                    <span style={{ fontSize: '1.05rem', width: 22, textAlign: 'center' }}>
                                        {tier.emoji}
                                    </span>
                                    <div>
                                        <div className="d-flex align-items-center gap-1.5">
                                            <span
                                                className="fw-semibold"
                                                style={{
                                                    fontSize: '0.82rem',
                                                    color: isCurrent ? '#ffffff' : isUnlocked ? tier.color : '#94a3b8',
                                                }}
                                            >
                                                Tier {tier.tier} · {tier.name}
                                            </span>
                                            {isCurrent && (
                                                <span
                                                    className="badge rounded-pill"
                                                    style={{
                                                        background: tier.color,
                                                        color: '#080808',
                                                        fontSize: '0.62rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ACTUAL
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--perfil-text-muted)' }}>
                                            {rangeLabel}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-shrink-0">
                                    {isUnlocked ? (
                                        <Check size={15} style={{ color: tier.color }} />
                                    ) : (
                                        <Lock size={14} style={{ color: '#64748b' }} />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Acceso directo a Ranking Global */}
                <div
                    className="d-flex justify-content-between align-items-center pt-2 border-top gap-2"
                    style={{ borderColor: 'var(--perfil-border)' }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            onClose()
                            navigate('/ranking')
                        }}
                        className="ml-btn ml-btn-acento ml-btn-sm d-inline-flex align-items-center gap-1.5"
                    >
                        <Trophy size={13} />
                        <span>Ver Ranking de Usuarios</span>
                    </button>
                    <button type="button" onClick={onClose} className="ml-btn ml-btn-fantasma ml-btn-sm">
                        Cerrar
                    </button>
                </div>
            </div>
        </Dialogo>
    )
}
