import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getCurrentPath } from '../utils/navigation'

export function LoginModal() {
    const { login, register } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [isRegister, setIsRegister] = useState(false)

    // Campos del formulario
    const [usernameOrEmail, setUsernameOrEmail] = useState('')
    const [registerUsername, setRegisterUsername] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Estados de UI y micro-feedback
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    const [slowWaitStage, setSlowWaitStage] = useState<0 | 1 | 2>(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const closeTimersRef = useRef<number[]>([])

    const clearCloseTimers = () => {
        closeTimersRef.current.forEach((id) => window.clearTimeout(id))
        closeTimersRef.current = []
    }

    // Mensajes progresivos si el servidor tarda (ej. cold start en Render)
    useEffect(() => {
        if (!isSubmitting) {
            setSlowWaitStage(0)
            return
        }
        const t1 = window.setTimeout(() => setSlowWaitStage(1), 2500)
        const t2 = window.setTimeout(() => setSlowWaitStage(2), 7000)
        return () => {
            window.clearTimeout(t1)
            window.clearTimeout(t2)
        }
    }, [isSubmitting])

    useEffect(() => {
        return () => clearCloseTimers()
    }, [])

    const handleClose = () => {
        if (isSubmitting) return
        clearCloseTimers()
        const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
        dialog?.close()
        setIsClosing(false)
        setErrorMsg(null)
        setSuccessMsg(null)
    }

    const handleSmoothSuccessClose = () => {
        clearCloseTimers()
        const t1 = window.setTimeout(() => {
            setIsClosing(true)
        }, 420)
        const t2 = window.setTimeout(() => {
            const dialog = document.getElementById('loginDialog') as HTMLDialogElement | null
            dialog?.close()
            setIsClosing(false)
            setErrorMsg(null)
            setSuccessMsg(null)
            setPassword('')
        }, 640)
        closeTimersRef.current = [t1, t2]
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting || isClosing) return
        setErrorMsg(null)
        setSuccessMsg(null)
        setIsSubmitting(true)

        try {
            if (isRegister) {
                if (!registerUsername.trim()) {
                    throw new Error('El nombre de usuario es obligatorio')
                }
                if (!email.trim()) {
                    throw new Error('El correo electrónico es obligatorio')
                }
                if (password.length < 6) {
                    throw new Error('La contraseña debe tener al menos 6 caracteres')
                }

                await register({
                    username: registerUsername.trim(),
                    email: email.trim(),
                    password,
                    display_name: displayName.trim() || undefined,
                })
                setSuccessMsg('¡Cuenta creada e inicio de sesión exitoso!')
            } else {
                if (!usernameOrEmail.trim()) {
                    throw new Error('Ingresa tu usuario o correo electrónico')
                }
                if (!password.trim()) {
                    throw new Error('Ingresa tu contraseña')
                }

                const loggedUser = await login(usernameOrEmail.trim(), password.trim())
                const isAdminUser = Boolean(loggedUser?.is_staff || loggedUser?.is_superuser)

                if (isAdminUser && getCurrentPath() === '/admin') {
                    setSuccessMsg('¡Bienvenido Administrador! Ingresando a Admin Console...')
                } else if (isAdminUser) {
                    setSuccessMsg(`¡Bienvenido ${loggedUser.display_name || loggedUser.username}!`)
                } else {
                    setSuccessMsg('¡Bienvenido de vuelta a Animigos!')
                }
            }

            handleSmoothSuccessClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al procesar la solicitud'
            setErrorMsg(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const isSuccess = Boolean(successMsg)
    const isBusy = isSubmitting || isSuccess || isClosing

    return (
        <dialog
            id="loginDialog"
            className={`dialog dialog-slide-down modal-anime login-modal-shell text-white ${isClosing ? 'is-closing' : ''}`}
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) {
                    handleClose()
                }
            }}
        >
            {/* Barra de progreso indeterminada durante autenticación */}
            {isSubmitting && (
                <div className="login-progress-track" aria-hidden="true">
                    <div className="login-progress-indicator" />
                </div>
            )}

            {/* Cabecera del Dialog */}
            <div className="dialog-header d-flex justify-content-between align-items-center">
                <h5 className="dialog-title fw-bold m-0" id="loginDialogLabel">
                    {isRegister ? 'Crear cuenta en ANIMIGOS' : 'Iniciar Sesión en ANIMIGOS'}
                </h5>
                <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    aria-label="Cerrar"
                ></button>
            </div>

            {/* Cuerpo del Formulario */}
            <div className="dialog-body p-4">
                {errorMsg && (
                    <div className="alert alert-danger login-feedback-banner d-flex align-items-center gap-2 py-2 px-3 mb-3 small" role="alert">
                        <AlertCircle size={16} className="flex-shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="alert alert-success login-feedback-banner d-flex align-items-center gap-2 py-2 px-3 mb-3 small" role="alert">
                        <CheckCircle size={16} className="flex-shrink-0 login-check-pop" />
                        <span>{successMsg}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
                    <fieldset className="login-fieldset" disabled={isBusy}>
                        {/* Modo Registro: Username y Display Name */}
                        {isRegister ? (
                            <>
                                <div className="mb-3">
                                    <label className="form-label small text-secondary mb-1" htmlFor="registerUsername">
                                        Nombre de usuario
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control input-anime"
                                        id="registerUsername"
                                        placeholder="otaku_fan"
                                        value={registerUsername}
                                        onChange={(e) => setRegisterUsername(e.target.value)}
                                        required
                                        autoFocus
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        autoComplete="username"
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small text-secondary mb-1" htmlFor="registerDisplayName">
                                        Nombre público (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control input-anime"
                                        id="registerDisplayName"
                                        placeholder="Ren Amamiya"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small text-secondary mb-1" htmlFor="registerEmail">
                                        Correo electrónico
                                    </label>
                                    <input
                                        type="email"
                                        className="form-control input-anime"
                                        id="registerEmail"
                                        placeholder="tu-correo@ejemplo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        autoComplete="email"
                                    />
                                </div>
                            </>
                        ) : (
                            /* Modo Login: Username o Email */
                            <div className="mb-3">
                                <label className="form-label small text-secondary mb-1" htmlFor="loginUsernameOrEmail">
                                    Usuario o Correo
                                </label>
                                <input
                                    type="text"
                                    className="form-control input-anime"
                                    id="loginUsernameOrEmail"
                                    placeholder="Usuario o tu-correo@ejemplo.com"
                                    value={usernameOrEmail}
                                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                                    required
                                    autoFocus
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    autoComplete="username"
                                />
                            </div>
                        )}

                        {/* Campo Contraseña con botón de visualización */}
                        <div className="position-relative mb-4">
                            <label className="form-label small text-secondary mb-1" htmlFor="loginPassword">
                                Contraseña
                            </label>
                            <div className="position-relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-control input-anime pe-5"
                                    id="loginPassword"
                                    placeholder={isRegister ? 'Mínimo 6 caracteres' : '••••••••'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                                />
                                <button
                                    type="button"
                                    className="btn position-absolute top-50 end-0 translate-middle-y text-secondary border-0 pe-3 d-flex align-items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </fieldset>

                    {/* Botón Principal con spinner real y estados dinámicos */}
                    <button
                        type="submit"
                        className={`btn bg-white text-dark btn-premium login-submit-btn w-100 py-2 mb-3 fw-bold d-flex align-items-center justify-content-center gap-2 ${
                            isSubmitting ? 'is-loading' : ''
                        } ${isSuccess ? 'is-success' : ''}`}
                        disabled={isBusy}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animigos-spin" />
                                <span>{isRegister ? 'Creando cuenta...' : 'Ingresando...'}</span>
                            </>
                        ) : isSuccess ? (
                            <>
                                <CheckCircle size={16} className="login-check-pop" />
                                <span>¡Listo!</span>
                            </>
                        ) : (
                            <span>{isRegister ? 'Crear cuenta' : 'Ingresar'}</span>
                        )}
                    </button>

                    {/* Mensaje tranquilizador si el backend demora (ej. cold start de Render) */}
                    {isSubmitting && slowWaitStage > 0 && (
                        <div className="login-status-hint" role="status" aria-live="polite">
                            <span className="login-status-dot" aria-hidden="true" />
                            <span>
                                {slowWaitStage === 1
                                    ? 'Conectando con el servidor, un momento...'
                                    : 'El servidor se está despertando, gracias por esperar...'}
                            </span>
                        </div>
                    )}
                </form>
            </div>

            {/* Pie del Dialog */}
            <div className="dialog-footer justify-content-center text-center">
                <span className="small text-secondary">
                    {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
                    <button
                        type="button"
                        className="btn btn-link text-info text-decoration-none fw-bold p-0 ms-1 align-baseline"
                        disabled={isBusy}
                        onClick={() => {
                            setIsRegister(!isRegister)
                            setErrorMsg(null)
                            setSuccessMsg(null)
                        }}
                    >
                        {isRegister ? 'Inicia sesión' : 'Regístrate'}
                    </button>
                </span>
            </div>
        </dialog>
    )
}
