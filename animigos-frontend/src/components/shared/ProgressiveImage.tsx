import { useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from 'react'

export interface ProgressiveImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src: string
    alt: string
    wrapperClassName?: string
    wrapperStyle?: CSSProperties
    aspectRatio?: string
    fallbackSrc?: string
}

/**
 * Imagen progresiva con shimmer de carga, cero saltos de diseño (CLS)
 * y transición suave al terminar de cargar.
 */
export function ProgressiveImage({
    src,
    alt,
    className = '',
    wrapperClassName = '',
    wrapperStyle,
    aspectRatio,
    fallbackSrc,
    loading = 'lazy',
    decoding = 'async',
    onLoad,
    onError,
    ...rest
}: ProgressiveImageProps) {
    const imgRef = useRef<HTMLImageElement | null>(null)
    const [currentSrc, setCurrentSrc] = useState(src)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        setCurrentSrc(src)
        if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
            setLoaded(true)
        } else {
            setLoaded(false)
        }
    }, [src])

    const mergedWrapperStyle: CSSProperties = {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...wrapperStyle,
    }

    return (
        <span
            className={`progressive-img-wrap ${loaded ? 'is-loaded' : ''} ${wrapperClassName}`.trim()}
            style={mergedWrapperStyle}
        >
            <img
                ref={imgRef}
                src={currentSrc}
                alt={alt}
                loading={loading}
                decoding={decoding}
                className={`progressive-img ${loaded ? 'is-loaded' : ''} ${className}`.trim()}
                onLoad={(e) => {
                    setLoaded(true)
                    onLoad?.(e)
                }}
                onError={(e) => {
                    if (fallbackSrc && currentSrc !== fallbackSrc) {
                        setCurrentSrc(fallbackSrc)
                    } else {
                        setLoaded(true)
                    }
                    onError?.(e)
                }}
                {...rest}
            />
        </span>
    )
}
