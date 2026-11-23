import React, { useEffect, useState } from 'react'
import { Globe, Loader2, Sparkles } from 'lucide-react'
import { Dialogo } from './mi-lista/piezas'
import { useAuth } from '../context/AuthContext'
import { saveDemographicsApi } from '../services/authApi'

const COMMON_COUNTRIES = [
    'Chile',
    'México',
    'Argentina',
    'Colombia',
    'Perú',
    'España',
    'Estados Unidos',
    'Ecuador',
    'Venezuela',
    'Uruguay',
    'Paraguay',
    'Bolivia',
    'Costa Rica',
    'Panamá',
    'Guatemala',
    'República Dominicana',
    'Honduras',
    'El Salvador',
    'Nicaragua',
    'Brasil',
    'Canadá',
    'Japón',
    'Otro',
]

export const DemographicsOnboardingModal: React.FC = () => {
    const { user, pendingDemographicsOnboarding, completeDemographicsOnboarding } = useAuth()
    const [country, setCountry] = useState('')
    const [birthYear, setBirthYear] = useState('')
    const [gender, setGender] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (pendingDemographicsOnboarding && user) {
            setCountry(user.country || '')
            setBirthYear(user.birth_year ? String(user.birth_year) : '')
            setGender(user.gender || '')
        }
    }, [pendingDemographicsOnboarding, user])

    if (!pendingDemographicsOnboarding || !user) {
        return null
    }

    const browserTz =
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''

    const handleSkip = async () => {
        setSaving(true)
        try {
            const res = await saveDemographicsApi({ skipped: true })
            completeDemographicsOnboarding(res.user)
        } catch {
            completeDemographicsOnboarding()
        } finally {
            setSaving(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const parsedYear = birthYear.trim() ? parseInt(birthYear.trim(), 10) : null
            const res = await saveDemographicsApi({
                country: country.trim(),
                birth_year: parsedYear && parsedYear >= 1930 && parsedYear <= 2020 ? parsedYear : null,
                gender: gender || 'prefer_not_to_say',
                timezone_name: user.timezone_name || browserTz,
                skipped: false,
            })
            completeDemographicsOnboarding(res.user)
        } catch {
            completeDemographicsOnboarding()
        } finally {
            setSaving(false)
        }
    }

    const wasAutoDetected = Boolean(user.country && country === user.country)

    return (
        <Dialogo
            abierto={pendingDemographicsOnboarding}
            onCerrar={handleSkip}
            etiqueta="Completa tu perfil (opcional)"
            ancho={480}
        >
            <form onSubmit={handleSubmit}>
                <div className="ml-dialog-cuerpo d-flex flex-column gap-3">
                    <div>
                        <span className="ml-eyebrow">BIENVENIDO A ANIMIGOS</span>
                        <h3 className="h5 fw-bold text-white mt-1 mb-1 d-flex align-items-center gap-2">
                            <Sparkles size={17} style={{ color: 'var(--theme-acento, #a78bfa)' }} />
                            <span>Un último detalle rápido (10 seg)</span>
                        </h3>
                        <p className="small text-secondary mb-0" style={{ lineHeight: 1.45 }}>
                            Estos datos son <strong>100% opcionales y voluntarios</strong>. Los usamos de forma agregada para mejorar la plataforma, las recomendaciones y los horarios de emisión.
                        </p>
                    </div>

                    {/* País (pre-llenado automáticamente por IP si se detectó) */}
                    <div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <label className="ml-label mb-0" htmlFor="onb-country">
                                País
                            </label>
                            {wasAutoDetected && (
                                <span
                                    className="small d-inline-flex align-items-center gap-1"
                                    style={{ fontSize: '0.7rem', color: '#34d399' }}
                                >
                                    <Globe size={11} />
                                    Detectado automáticamente{user.city ? ` (${user.city})` : ''}
                                </span>
                            )}
                        </div>
                        <input
                            id="onb-country"
                            list="animigos-countries-list"
                            type="text"
                            className="ml-input w-100"
                            placeholder="Ej: Chile, México, España..."
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                        />
                        <datalist id="animigos-countries-list">
                            {COMMON_COUNTRIES.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </div>

                    {/* Año de nacimiento y Género */}
                    <div className="row g-2.5">
                        <div className="col-6">
                            <label className="ml-label" htmlFor="onb-birth-year">
                                Año de nacimiento
                            </label>
                            <input
                                id="onb-birth-year"
                                type="number"
                                min={1930}
                                max={2020}
                                inputMode="numeric"
                                className="ml-input w-100"
                                placeholder="Ej: 1999"
                                value={birthYear}
                                onChange={(e) => setBirthYear(e.target.value.slice(0, 4))}
                            />
                        </div>
                        <div className="col-6">
                            <label className="ml-label" htmlFor="onb-gender">
                                Género
                            </label>
                            <select
                                id="onb-gender"
                                className="ml-input w-100"
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                            >
                                <option value="">Prefiero no decirlo</option>
                                <option value="female">Femenino</option>
                                <option value="male">Masculino</option>
                                <option value="non_binary">No binario</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                    </div>
                </div>

                <footer className="ml-dialog-pie justify-content-between">
                    <button
                        type="button"
                        className="ml-btn ml-btn-fantasma"
                        onClick={handleSkip}
                        disabled={saving}
                    >
                        Omitir
                    </button>
                    <button
                        type="submit"
                        className="ml-btn ml-btn-acento d-inline-flex align-items-center gap-1.5"
                        disabled={saving}
                    >
                        {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                        <span>{saving ? 'Guardando...' : 'Guardar y continuar'}</span>
                    </button>
                </footer>
            </form>
        </Dialogo>
    )
}
