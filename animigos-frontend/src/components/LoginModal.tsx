import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'


export function LoginModal() {
    const [showPassword, setShowPassword] = useState(false)
    const [isRegister, setIsRegister] = useState(false) // Alterna entre Login (false) y Registro (true)
    const handleClose = () => {
        const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
        dialog?.close()
    }

    return (
        <dialog
            id="loginDialog"
            className="dialog dialog-slide-down modal-anime text-white"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleClose()
                }
            }}
        >
            {/* Cabecera del Dialog */}
            <div className="dialog-header d-flex justify-content-between align-items-center">
                <h5 className="dialog-title fw-bold m-0" id="loginDialogLabel">
                    {isRegister ? "Crear cuenta en ANIMIGOS" : "Iniciar Sesión en ANIMIGOS"}
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

                    {/* Campo: Nombre de usuario (solo visible en Registro) */}
                    {isRegister && (
                        <div className="mb-3">
                            <input
                                type="text"
                                className="form-control input-anime"
                                id="registerUsername"
                                placeholder="Nombre de usuario"
                                required
                            />
                        </div>
                    )}

                    {/* Campo: Correo */}
                    <div className="mb-3">
                        <input
                            type="email"
                            className="form-control input-anime"
                            id="loginEmail"
                            placeholder="Correo electrónico"
                            required
                        />
                    </div>

                    {/* Campo: Contraseña con botón de previsualización */}
                    <div className="position-relative mb-4">
                        <input
                            type={showPassword ? "text" : "password"}
                            className="form-control input-anime pe-5"
                            id="loginPassword"
                            placeholder="Contraseña"
                            required
                        />
                        <button
                            type="button"
                            className="btn position-absolute top-50 end-0 translate-middle-y text-secondary border-0 pe-3 d-flex align-items-center"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                            aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>


                    {/* Botón Principal dinámico */}
                    <button type="submit" className="btn bg-white text-dark btn-premium w-100 py-2 mb-3 fw-bold">
                        {isRegister ? "Crear cuenta" : "Ingresar"}
                    </button>



                    {/* Sección de Invitado (solo útil para iniciar sesión rápida) */}
                    {!isRegister && (
                        <>
                            <div className="text-center text-secondary small my-2">
                                — o continúa como invitado —
                            </div>
                            <div className="input-group">
                                {/* ... input de código de invitado ... */}
                            </div>
                        </>
                    )}

                </form>
            </div>

            {/* Pie del Dialog */}
            <div className="dialog-footer justify-content-center text-center">
                <span className="small text-secondary">
                    {isRegister ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
                    <a
                        href="#"
                        className="text-info text-decoration-none fw-bold"
                        onClick={(e) => {
                            e.preventDefault()
                            setIsRegister(!isRegister) // Cambia a modo Login / Registro
                        }}
                    >
                        {isRegister ? "Inicia sesión" : "Regístrate"}
                    </a>
                </span>
            </div>
        </dialog>
    )
}
