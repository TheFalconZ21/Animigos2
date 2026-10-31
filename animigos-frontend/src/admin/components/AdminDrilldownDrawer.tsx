import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface AdminDrilldownDrawerProps {
    isOpen: boolean
    onClose: () => void
    title: string
    subtitle?: string
    badgeText?: string
    badgeType?: 'success' | 'info' | 'warning' | 'danger' | 'neutral'
    children: React.ReactNode
    footer?: React.ReactNode
    maxWidth?: string
}

export const AdminDrilldownDrawer: React.FC<AdminDrilldownDrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    badgeText,
    badgeType = 'info',
    children,
    footer,
    maxWidth = '540px'
}) => {
    // Cerrar con Escape
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="admin-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div
                className="admin-drawer-content"
                style={{ maxWidth }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header del Drawer */}
                <div className="admin-drawer-header">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-0.5">
                            <h2 className="admin-title m-0" style={{ fontSize: '1rem' }}>
                                {title}
                            </h2>
                            {badgeText && (
                                <span className={`admin-badge admin-badge-${badgeType} font-mono`} style={{ fontSize: '0.68rem' }}>
                                    {badgeText}
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <p className="admin-subtitle m-0" style={{ fontSize: '0.75rem' }}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="admin-btn admin-btn-secondary p-1.5 d-flex align-items-center justify-content-center"
                        title="Cerrar panel (Esc)"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Cuerpo del Drawer */}
                <div className="admin-drawer-body custom-scrollbar">
                    {children}
                </div>

                {/* Footer opcional */}
                {footer && (
                    <div className="admin-drawer-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}

