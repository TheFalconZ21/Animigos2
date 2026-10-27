import React from 'react'

export interface AnimigosLogoProps {
    /** Tamaño del logotipo: sm (compacto), md (navbar), lg (modal), xl (hero) */
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Variante cromática: 'white' para fondos oscuros (default) o 'dark' para fondos claros */
    variant?: 'white' | 'dark'
    /** Clases CSS adicionales */
    className?: string
    /** Estilos en línea opcionales */
    style?: React.CSSProperties
}

/**
 * Componente canónico del Logotipo de Animigos.
 * Implementa la marca oficial con el isotipo de gato en sustitución de la vocal 'o'
 * siguiendo la identidad visual (Animig🐱s).
 */
export function AnimigosLogo({
    size = 'md',
    variant = 'white',
    className = '',
    style,
}: AnimigosLogoProps) {
    const catSrc = variant === 'dark' ? '/logo-cat-black.png' : '/logo-cat-white.png'

    return (
        <span
            className={`animigos-logo animigos-logo--${size} ${variant === 'dark' ? 'animigos-logo--dark' : ''} ${className}`}
            style={style}
            aria-label="Animigos"
        >
            <span className="animigos-logo-text">Animig</span>
            <img
                src={catSrc}
                alt="o"
                className="animigos-logo-cat"
                loading="eager"
                draggable={false}
            />
            <span className="animigos-logo-text">s</span>
        </span>
    )
}

export default AnimigosLogo
