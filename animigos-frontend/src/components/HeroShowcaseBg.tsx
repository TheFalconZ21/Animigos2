import { SHOWCASE_ROW_1, SHOWCASE_ROW_2 } from '../data/showcase-animes'

export function HeroShowcaseBg() {
    // Duplicamos las filas para que el bucle de scroll sea infinito y sin saltos
    const row1 = [...SHOWCASE_ROW_1, ...SHOWCASE_ROW_1]
    const row2 = [...SHOWCASE_ROW_2, ...SHOWCASE_ROW_2]

    return (
        <>
            <div className="hero-showcase-bg">
                {/* Fila 1: Se desplaza hacia la izquierda */}
                <div className="marquee-row">
                    <div className="marquee-track-left">
                        {row1.map((anime, index) => (
                            <img
                                key={`r1-${index}`}
                                src={anime.cover}
                                alt={anime.title}
                                className="showcase-poster"
                                loading="lazy"
                            />
                        ))}
                    </div>
                </div>

                {/* Fila 2: Se desplaza hacia la derecha */}
                <div className="marquee-row">
                    <div className="marquee-track-right">
                        {row2.map((anime, index) => (
                            <img
                                key={`r2-${index}`}
                                src={anime.cover}
                                alt={anime.title}
                                className="showcase-poster"
                                loading="lazy"
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Máscara viñeta que oscurece el centro para proteger el título */}
            <div className="hero-vignette" />
        </>
    )
}


