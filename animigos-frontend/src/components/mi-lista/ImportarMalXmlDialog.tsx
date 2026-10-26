import React, { useState, useRef } from 'react'
import { Upload, FileCode, CheckCircle2, AlertCircle, Loader2, Sparkles, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import confetti from 'canvas-confetti'
import { Dialogo } from './piezas'
import { importMalXml, type ImportMalXmlResult } from '../../services/userListApi'

interface ImportarMalXmlDialogProps {
    abierto: boolean
    onCerrar: () => void
    onExito: () => void
}

export const ImportarMalXmlDialog: React.FC<ImportarMalXmlDialogProps> = ({ abierto, onCerrar, onExito }) => {
    const [archivo, setArchivo] = useState<File | null>(null)
    const [estaArrastrando, setEstaArrastrando] = useState(false)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resultado, setResultado] = useState<ImportMalXmlResult | null>(null)
    const [mostrarAyuda, setMostrarAyuda] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const limpiar = () => {
        setArchivo(null)
        setError(null)
        setResultado(null)
        setCargando(false)
        setMostrarAyuda(false)
    }

    const handleCerrar = () => {
        limpiar()
        onCerrar()
    }

    const handleArchivoSeleccionado = (f: File | null) => {
        if (!f) return
        if (!f.name.toLowerCase().endsWith('.xml')) {
            setError('El archivo seleccionado debe tener extensión .xml (ej. animelist.xml)')
            setArchivo(null)
            return
        }
        setError(null)
        setArchivo(f)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setEstaArrastrando(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setEstaArrastrando(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setEstaArrastrando(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleArchivoSeleccionado(e.dataTransfer.files[0])
        }
    }

    const ejecutarImportacion = async () => {
        if (!archivo) return
        setCargando(true)
        setError(null)

        try {
            const res = await importMalXml(archivo)
            setResultado(res)
            // Disparar confetti de celebración
            try {
                confetti({
                    particleCount: 65,
                    spread: 60,
                    origin: { y: 0.6 },
                })
            } catch {
                // Silently ignore if canvas-confetti has restrictions
            }
            onExito()
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error al procesar el archivo XML.')
        } finally {
            setCargando(false)
        }
    }

    return (
        <Dialogo abierto={abierto} onCerrar={handleCerrar} etiqueta="Importar MyAnimeList" ancho={540}>
            <div className="p-4 d-flex flex-column gap-3.5">
                {/* Cabecera */}
                <div className="d-flex align-items-center gap-2.5">
                    <div
                        className="rounded-3 p-2 d-flex align-items-center justify-content-center"
                        style={{ background: 'rgba(232, 80, 143, 0.15)', border: '1px solid rgba(232, 80, 143, 0.3)' }}
                    >
                        <FileCode size={22} className="text-warning" />
                    </div>
                    <div>
                        <h2 className="h6 fw-bold text-white mb-0">Importar lista desde MyAnimeList</h2>
                        <span className="small text-secondary" style={{ fontSize: '0.78rem' }}>
                            Sincroniza tus animes vistos, viendo, pendientes, notas y etiquetas en segundos
                        </span>
                    </div>
                </div>

                {/* Vista de éxito tras la importación */}
                {resultado ? (
                    <div className="d-flex flex-column gap-3 py-2 text-center">
                        <div
                            className="p-3.5 rounded-3 d-flex flex-column align-items-center gap-2"
                            style={{ background: '#0d1612', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                        >
                            <CheckCircle2 size={32} className="text-success" />
                            <h3 className="h6 fw-bold text-white mb-0">¡Lista importada con éxito!</h3>
                            <p className="small text-secondary mb-2" style={{ fontSize: '0.8rem' }}>
                                {resultado.message}
                            </p>

                            <div className="row g-2 w-100 font-mono text-center">
                                <div className="col-4">
                                    <div className="p-2 rounded bg-black border border-dark">
                                        <span className="text-secondary d-block" style={{ fontSize: '0.66rem' }}>
                                            PROCESADOS
                                        </span>
                                        <span className="fw-bold text-white" style={{ fontSize: '1rem' }}>
                                            {resultado.total_parsed}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-4">
                                    <div className="p-2 rounded bg-black border border-dark">
                                        <span className="text-secondary d-block" style={{ fontSize: '0.66rem' }}>
                                            NUEVOS
                                        </span>
                                        <span className="fw-bold text-success" style={{ fontSize: '1rem' }}>
                                            +{resultado.created}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-4">
                                    <div className="p-2 rounded bg-black border border-dark">
                                        <span className="text-secondary d-block" style={{ fontSize: '0.66rem' }}>
                                            ACTUALIZADOS
                                        </span>
                                        <span className="fw-bold text-warning" style={{ fontSize: '1rem' }}>
                                            {resultado.updated}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {resultado.new_animes_registered > 0 && (
                                <div className="small text-secondary font-mono mt-1" style={{ fontSize: '0.72rem' }}>
                                    <Sparkles size={12} className="text-warning me-1 inline" />
                                    {resultado.new_animes_registered} nuevos animes fueron incorporados a la base de datos de Animigos.
                                </div>
                            )}
                        </div>

                        <div className="d-flex justify-content-end pt-2">
                            <button
                                type="button"
                                onClick={handleCerrar}
                                className="cat-btn-search py-2 px-4 w-100"
                            >
                                Aceptar y ver Mi Lista
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Zona Drag & Drop */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current?.click()}
                            className="p-4 rounded-3 text-center d-flex flex-column align-items-center justify-content-center gap-2"
                            style={{
                                background: estaArrastrando ? '#16161f' : '#0c0c10',
                                border: `2px dashed ${estaArrastrando ? 'var(--cat-gold, #fcd34d)' : 'rgba(255, 255, 255, 0.12)'}`,
                                cursor: cargando ? 'wait' : 'pointer',
                                transition: 'all 0.2s ease',
                                minHeight: '140px',
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".xml"
                                className="d-none"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        handleArchivoSeleccionado(e.target.files[0])
                                    }
                                }}
                            />

                            {archivo ? (
                                <div className="d-flex flex-column align-items-center gap-1">
                                    <FileCode size={28} className="text-warning mb-1" />
                                    <strong className="text-white small font-mono">{archivo.name}</strong>
                                    <span className="text-secondary small font-mono" style={{ fontSize: '0.72rem' }}>
                                        {(archivo.size / 1024).toFixed(1)} KB · Clic o arrastra para cambiar
                                    </span>
                                </div>
                            ) : (
                                <div className="d-flex flex-column align-items-center gap-1.5">
                                    <Upload size={24} className="text-secondary mb-1" />
                                    <span className="text-white small fw-medium">
                                        Arrastra aquí tu archivo <strong className="text-warning">animelist.xml</strong>
                                    </span>
                                    <span className="text-secondary small" style={{ fontSize: '0.74rem' }}>
                                        o haz clic para explorar tus archivos locales
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Mensaje de error si falla */}
                        {error && (
                            <div className="p-2.5 rounded-2 d-flex align-items-center gap-2 bg-black border border-danger text-danger small font-mono" style={{ fontSize: '0.75rem' }}>
                                <AlertCircle size={15} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Acordeón de ayuda */}
                        <div
                            className="rounded-2 p-2.5"
                            style={{ background: 'var(--cat-surface-2)', border: '1px solid var(--cat-border)' }}
                        >
                            <button
                                type="button"
                                onClick={() => setMostrarAyuda(!mostrarAyuda)}
                                className="w-100 d-flex align-items-center justify-content-between text-start bg-transparent border-0 p-0 text-secondary"
                                style={{ fontSize: '0.76rem', cursor: 'pointer' }}
                            >
                                <span className="d-flex align-items-center gap-1.5">
                                    <HelpCircle size={13} className="text-warning" />
                                    ¿Cómo descargo mi archivo .xml de MyAnimeList?
                                </span>
                                {mostrarAyuda ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {mostrarAyuda && (
                                <div className="mt-2.5 pt-2 border-top border-dark text-secondary small" style={{ fontSize: '0.73rem', lineHeight: 1.5 }}>
                                    <ol className="ps-3 mb-0 d-flex flex-column gap-1">
                                        <li>Ingresa a tu cuenta en <strong>MyAnimeList.net</strong>.</li>
                                        <li>Ve a tu <strong>Panel de Usuario</strong> o entra en tu <strong>Anime List</strong>.</li>
                                        <li>Haz clic en el menú superior derecho en <strong>Export</strong> (o Export My List).</li>
                                        <li>Descarga tu archivo; si se descarga como <code>animelist.xml.gz</code>, descomprímelo para obtener el archivo <code>.xml</code>.</li>
                                    </ol>
                                </div>
                            )}
                        </div>

                        {/* Botones de acción */}
                        <div className="d-flex justify-content-end gap-2 pt-1 border-top border-dark">
                            <button
                                type="button"
                                onClick={handleCerrar}
                                disabled={cargando}
                                className="cat-mode-pill-btn"
                                style={{ border: '1px solid var(--cat-border)' }}
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={ejecutarImportacion}
                                disabled={!archivo || cargando}
                                className="cat-btn-search py-1.5 px-3 d-flex align-items-center gap-1.5"
                            >
                                {cargando ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin text-warning" />
                                        <span>Procesando XML...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={14} />
                                        <span>Importar a Mi Lista</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Dialogo>
    )
}
