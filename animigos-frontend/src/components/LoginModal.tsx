export function LoginModal() {
    const handleClose = () => {
        const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
        dialog?.close()
    }

    return (
        <dialog
            id="loginDialog"
            className="dialog dialog-slide-down modal-anime text-white"
            onClick={(e) => {
                // Si hace clic afuera en el fondo oscuro, se cierra
                if (e.target === e.currentTarget) {
                    handleClose()
                }
            }}
        >
            {/* Cabecera del Dialog */}
            <div className="dialog-header d-flex justify-content-between align-items-center">
                <h5 className="dialog-title fw-bold m-0" id="loginDialogLabel">
                    Iniciar Sesión en ANIMIGOS
                </h5>
                <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={handleClose}
                    aria-label="Cerrar"
                ></button>
            </div>

            {/* Cuerpo del Formulario */}
            <div className="dialog-body p-4">
                <form onSubmit={(e) => e.preventDefault()}>
                    {/* Campo: Correo */}
                    <div className="mb-3">
                        <label className="form-label text-secondary small">
                            Correo electrónico
                        </label>
                        <input
                            type="email"
                            className="form-control input-anime"
                            placeholder="otaku@ejemplo.com"
                            required
                        />
                    </div>

                    {/* Campo: Contraseña */}
                    <div className="mb-4">
                        <label className="form-label text-secondary small">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            className="form-control input-anime"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {/* Botón Principal */}
                    <button type="submit" className="btn btn-primary w-100 py-2 mb-3 fw-bold">
                        Ingresar
                    </button>

                    <div className="text-center text-secondary small my-2">
                        — o continúa como invitado —
                    </div>

                    {/* Botón Alternativo de Invitado */}
                    <button
                        type="button"
                        className="btn-outline-light w-100 py-2 btn"
                        onClick={handleClose}
                    >
                        Ingresa código invitado
                    </button>
                </form>
            </div>

            {/* Pie del Dialog */}
            <div className="dialog-footer justify-content-center text-center">
                <span className="small text-secondary">
                    ¿No tienes cuenta?{" "}
                    <a href="#" className="text-info text-decoration-none fw-bold">
                        Regístrate
                    </a>
                </span>
            </div>
        </dialog>
    )
}
