import React, { useState } from 'react'
import { type CatExpression, useCatExpression } from '../hooks/useCatExpression'

export interface AnimigosLogoProps {
    /** Tamaño del logotipo: sm (compacto), md (navbar), lg (modal), xl (destacado), hero (landing) */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
    /** Variante cromática: 'white' para fondos oscuros (default) o 'dark' para fondos claros */
    variant?: 'white' | 'dark'
    /** Expresión forzada ('normal' o 'happy'). Si se omite, se sincroniza automáticamente con useCatExpression */
    expression?: CatExpression
    /** Clases CSS adicionales para el contenedor */
    className?: string
    /** Clases CSS adicionales para la imagen del gato */
    catClassName?: string
    /** Estilos en línea opcionales */
    style?: React.CSSProperties
    /** Callback opcional al hacer clic sobre el gato */
    onCatClick?: (e: React.MouseEvent) => void
    /** Habilita alternar la expresión al hacer clic sobre el gato directamente */
    interactiveCat?: boolean
    /** Cambiar expresión al pasar el cursor por encima (hover). Por defecto true */
    hoverExpression?: boolean
}

/**
 * Componente canónico del Logotipo de Animigos.
 * Implementa la marca oficial con el isotipo de gato en sustitución de la vocal 'o' (Animig🐱s).
 * Soporta expresiones faciales reactivas:
 * - 'normal': Expresión tranquila anime (logo.jpg / u w u)
 * - 'happy': Expresión alegre y festiva anime (logo2.jpg / > ▽ <)
 */
export function AnimigosLogo({
    size = 'md',
    variant = 'white',
    expression: propExpression,
    className = '',
    catClassName = '',
    style,
    onCatClick,
    interactiveCat = false,
    hoverExpression = true,
}: AnimigosLogoProps) {
    const { expression: hookExpression, setExpression, toggleExpression } = useCatExpression()
    const [isHovered, setIsHovered] = useState(false)
    const [isBouncing, setIsBouncing] = useState(false)

    // Si se pasa expression explícita por prop, la usamos; de lo contrario usamos hover o el hook global
    const activeExpression =
        propExpression ?? ((hoverExpression && isHovered) ? 'happy' : hookExpression)

    const catSrc =
        variant === 'dark'
            ? activeExpression === 'happy'
                ? '/logo2-cat-black.png'
                : '/logo-cat-black.png'
            : activeExpression === 'happy'
              ? '/logo2-cat-white.png'
              : '/logo-cat-white.png'

    const handleMouseEnter = () => {
        if (hoverExpression) {
            setIsHovered(true)
            setExpression('happy')
        }
    }

    const handleMouseLeave = () => {
        if (hoverExpression) {
            setIsHovered(false)
            setExpression('normal')
        }
    }

    const handleCatClick = (e: React.MouseEvent) => {
        setIsBouncing(true)
        setTimeout(() => setIsBouncing(false), 450)

        if (interactiveCat) {
            toggleExpression()
        }
        onCatClick?.(e)
    }

    return (
        <span
            className={`animigos-logo animigos-logo--${size} ${variant === 'dark' ? 'animigos-logo--dark' : ''} ${className}`}
            style={style}
            aria-label="Animigos"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <span className="animigos-logo-text">Animig</span>
            <img
                src={catSrc}
                alt={activeExpression === 'happy' ? 'Animigos feliz (> ▽ <)' : 'Animigos (u w u)'}
                className={`animigos-logo-cat ${interactiveCat ? 'animigos-logo-cat--interactive' : ''} ${isBouncing ? 'animigos-logo-cat--bouncing' : ''} ${catClassName}`}
                loading="eager"
                draggable={false}
                onClick={interactiveCat || onCatClick ? handleCatClick : undefined}
                title={interactiveCat ? '¡Haz clic para cambiar mi expresión! 🐱' : undefined}
            />
            <span className="animigos-logo-text">s</span>
        </span>
    )
}

export default AnimigosLogo
