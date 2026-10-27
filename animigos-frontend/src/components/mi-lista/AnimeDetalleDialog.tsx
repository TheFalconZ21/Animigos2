import { Award, Heart, Send, Star, Users } from 'lucide-react'
import { ESTADOS, type EntradaLista, type FilaLista, alFallarPoster } from './mi-lista-data'
import { Dialogo, ProgresoEpisodios, SelloNota } from './piezas'

// Mini resumen del anime (se abre al hacer clic en el póster o el título)
export function AnimeDetalleDialog({
    fila,
    onCerrar,
    onActualizar,
    onRecomendar,
}: {
    fila: FilaLista | null
    onCerrar: () => void
    onActualizar: (cambios: Partial<EntradaLista>) => void
    onRecomendar: () => void
}) {
    return (
        <Dialogo abierto={fila !== null} onCerrar={onCerrar} etiqueta={fila ? `Detalle de ${fila.anime.title}` : 'Detalle'}>
            {fila && <Contenido fila={fila} onActualizar={onActualizar} onRecomendar={onRecomendar} />}
        </Dialogo>
    )
}

function Contenido({
    fila,
    onActualizar,
    onRecomendar,
}: {
    fila: FilaLista
    onActualizar: (cambios: Partial<EntradaLista>) => void
    onRecomendar: () => void
}) {
    const { anime } = fila
    const amigos = (anime.watchedByFriends ?? []).map((nombre) => ({ name: nombre, avatarUrl: '' }))

    return (
        <>
            <header className="ml-detalle-hero">
                <div className="ml-detalle-fondo" style={{ backgroundImage: `url(${anime.imageUrl})` }} />
                <img className="ml-detalle-poster" src={anime.imageUrl} alt={`Póster de ${anime.title}`} onError={alFallarPoster} />
                <div style={{ minWidth: 0 }}>
                    <div className="d-flex flex-wrap gap-2">
                        <span className="ml-insignia"><Award size={13} /> Rank #{anime.rank}</span>
                        <span className="ml-insignia"><Star size={13} /> {anime.score} MAL</span>
                    </div>
                    <h2 className="ml-detalle-titulo">{anime.title}</h2>
                    {anime.titleJapanese && <div className="ml-detalle-jp" lang="ja">{anime.titleJapanese}</div>}
                </div>
            </header>

            <div className="ml-dialog-cuerpo pt-2 d-flex flex-column gap-4">
                <dl className="ml-ficha m-0">
                    <div><dt>Estudio</dt><dd>{anime.studio}</dd></div>
                    <div><dt>Episodios</dt><dd>{anime.episodes} eps</dd></div>
                    <div><dt>Estreno</dt><dd>{anime.season} {anime.year}</dd></div>
                    <div><dt>Géneros</dt><dd>{anime.genres.join(', ')}</dd></div>
                </dl>

                <section>
                    <h3 className="ml-label">Sinopsis</h3>
                    <p className="ml-sinopsis">{anime.synopsis}</p>
                </section>

                {amigos.length > 0 && (
                    <div className="ml-amigos">
                        <div className="ml-avatares">
                            {amigos.map((a) =>
                                a.avatarUrl ? <img key={a.name} src={a.avatarUrl} alt="" /> : <Users key={a.name} size={18} />,
                            )}
                        </div>
                        <span>
                            <strong>Visto por tus amigos:</strong> {amigos.map((a) => a.name).join(', ')}
                        </span>
                    </div>
                )}

                {/* Lo que el usuario tiene guardado de este anime */}
                <section>
                    <h3 className="ml-label">En tu lista</h3>
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <SelloNota nota={fila.nota} onCambiar={(nota) => onActualizar({ nota })} />
                        <div className="d-flex flex-column gap-2" style={{ flex: 1, minWidth: 220 }}>
                            <div className="d-flex flex-wrap gap-2">
                                <div className="ml-segmentado" role="group" aria-label="Estado">
                                    {ESTADOS.map((e) => (
                                        <button
                                            key={e.id}
                                            type="button"
                                            aria-pressed={fila.estado === e.id}
                                            onClick={() =>
                                                onActualizar(e.id === 'visto' ? { estado: e.id, episodiosVistos: anime.episodes } : { estado: e.id })
                                            }
                                        >
                                            <span className={`ml-punto ml-punto-${e.id}`} /> {e.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="ml-btn ml-btn-sm ml-fav"
                                    aria-pressed={fila.favorito}
                                    onClick={() => onActualizar({ favorito: !fila.favorito })}
                                >
                                    <Heart size={14} fill={fila.favorito ? 'currentColor' : 'none'} /> Favorito
                                </button>
                            </div>
                            {anime.episodes > 1 && <ProgresoEpisodios vistos={fila.episodiosVistos} total={anime.episodes} />}
                        </div>
                    </div>
                </section>
            </div>

            <footer className="ml-dialog-pie">
                <button type="button" className="ml-btn ml-btn-acento" onClick={onRecomendar}>
                    <Send size={15} /> Recomendar a un amigo
                </button>
            </footer>
        </>
    )
}
