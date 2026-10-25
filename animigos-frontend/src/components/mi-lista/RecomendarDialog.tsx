import { useState } from 'react'
import { Folder, ListFilter, Send } from 'lucide-react'
import { MOCK_USER_FRIENDS } from '../../data/anime-data'
import { alFallarPoster, type Carpeta, type FilaLista } from './mi-lista-data'
import { Dialogo } from './piezas'

export interface Paquete {
    titulo: string     // "Frieren", "Saga Steins;Gate" o "Selección filtrada"
    criterio: string   // Texto que explica de dónde salió el paquete
    filas: FilaLista[]
}

export function RecomendarDialog({
    paquete,
    carpetas,
    onCerrar,
}: {
    paquete: Paquete | null
    carpetas: Carpeta[]
    onCerrar: () => void
}) {
    return (
        <Dialogo abierto={paquete !== null} onCerrar={onCerrar} etiqueta="Recomendar animes" ancho={600}>
            {paquete && <Contenido paquete={paquete} carpetas={carpetas} onCerrar={onCerrar} />}
        </Dialogo>
    )
}

function Contenido({ paquete, carpetas, onCerrar }: { paquete: Paquete; carpetas: Carpeta[]; onCerrar: () => void }) {
    const [amigoId, setAmigoId] = useState(MOCK_USER_FRIENDS[0].id)
    const [mensaje, setMensaje] = useState('')
    const [enviado, setEnviado] = useState(false)
    const amigo = MOCK_USER_FRIENDS.find((f) => f.id === amigoId)!

    // Agrupa: primero las carpetas (sagas), luego los animes sueltos
    const grupos = carpetas
        .map((c) => ({ carpeta: c, filas: paquete.filas.filter((f) => f.carpetaId === c.id) }))
        .filter((g) => g.filas.length > 0)
    const sueltos = paquete.filas.filter((f) => !grupos.some((g) => g.carpeta.id === f.carpetaId))

    if (enviado) {
        return (
            <div className="ml-enviado">
                <div className="ml-sello lleno" lang="ja">済</div>
                <h2 className="h4 mb-1">¡Enviado a {amigo.name.split(' ')[0]}!</h2>
                <p className="mb-4">
                    {paquete.filas.length === 1 ? 'Le llegará tu recomendación' : `Le llegarán ${paquete.filas.length} animes`} en sus notificaciones.
                </p>
                <button type="button" className="ml-btn" onClick={onCerrar}>Listo</button>
            </div>
        )
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                // TODO backend: POST /api/recomendaciones { amigoId, malIds, mensaje }
                setEnviado(true)
            }}
        >
            <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                <div>
                    <span className="ml-eyebrow">Recomendar</span>
                    <h2 className="h3 mt-1 mb-1 pe-5">{paquete.titulo}</h2>
                    <p className="small mb-0 d-flex align-items-center gap-2">
                        <ListFilter size={14} /> {paquete.criterio}
                    </p>
                </div>

                <div>
                    <div className="d-flex justify-content-between align-items-baseline">
                        <span className="ml-label">Qué se envía</span>
                        <span className="small">
                            {paquete.filas.length} {paquete.filas.length === 1 ? 'anime' : 'animes'}
                            {grupos.length > 0 && ` · ${grupos.length} ${grupos.length === 1 ? 'saga' : 'sagas'}`}
                        </span>
                    </div>
                    <div className="ml-paquete">
                        {grupos.map(({ carpeta, filas }) => (
                            <div key={carpeta.id} className="ml-paquete-item ml-paquete-carpeta">
                                <Folder size={18} color="#c4b5fd" />
                                <div style={{ minWidth: 0 }}>
                                    <div className="fw-semibold">{carpeta.nombre}</div>
                                    <div className="small text-secondary text-truncate">{filas.map((f) => f.anime.title).join(' · ')}</div>
                                </div>
                            </div>
                        ))}
                        {sueltos.map((f) => (
                            <div key={f.malId} className="ml-paquete-item">
                                <img src={f.anime.imageUrl} alt="" onError={alFallarPoster} />
                                <div style={{ minWidth: 0 }}>
                                    <div className="fw-semibold text-truncate">{f.anime.title}</div>
                                    <div className="small text-secondary">
                                        {f.nota !== null ? `Tu nota: ${f.nota}` : 'Sin nota'} · {f.anime.studio}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-12 col-sm-5">
                        <label className="ml-label" htmlFor="ml-amigo">Para</label>
                        <select id="ml-amigo" className="ml-select w-100" value={amigoId} onChange={(e) => setAmigoId(e.target.value)}>
                            {MOCK_USER_FRIENDS.map((f) => (
                                <option key={f.id} value={f.id}>{f.name} ({f.username})</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-12 col-sm-7">
                        <label className="ml-label" htmlFor="ml-mensaje">Nota personal (opcional)</label>
                        <input
                            id="ml-mensaje"
                            className="ml-input w-100"
                            placeholder="“Te va a encantar el final…”"
                            value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <footer className="ml-dialog-pie">
                <button type="button" className="ml-btn ml-btn-fantasma" onClick={onCerrar}>Cancelar</button>
                <button type="submit" className="ml-btn ml-btn-acento" disabled={paquete.filas.length === 0}>
                    <Send size={15} /> Enviar a {amigo.name.split(' ')[0]}
                </button>
            </footer>
        </form>
    )
}
