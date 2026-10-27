/**
 * Utilidades de fechas y horas compartidas (Pilar 1.1 de AGENTS.md).
 * Todas reciben marcas de tiempo Unix en segundos (como las entrega el backend)
 * y muestran el resultado en la zona horaria del usuario.
 */

// Domingo = 0, igual que Date.getDay()
export const DIAS_KANJI = ['日', '月', '火', '水', '木', '金', '土']
export const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const formatoHora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const formatoHoraJapon = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
const formatoFechaLarga = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })

export const aFecha = (unix: number) => new Date(unix * 1000)

export const horaLocal = (unix: number) => formatoHora.format(aFecha(unix))

export const horaJapon = (unix: number) => formatoHoraJapon.format(aFecha(unix))

export const fechaLarga = (fecha: Date) => formatoFechaLarga.format(fecha)

// Clave estable de un día local (ej: "2026-10-26"), útil para agrupar
export function claveDia(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')
    return `${fecha.getFullYear()}-${mes}-${dia}`
}

// "Hace 5 min", "Hace 3 h", "Ayer", "Hace 4 días"
export function haceCuanto(unix: number | null, ahora = Date.now()): string {
    if (unix === null) return ''
    const minutos = Math.max(0, Math.round((ahora - unix * 1000) / 60000))
    if (minutos < 1) return 'Ahora mismo'
    if (minutos < 60) return `Hace ${minutos} min`
    const horas = Math.round(minutos / 60)
    if (horas < 24) return `Hace ${horas} h`
    const dias = Math.round(horas / 24)
    return dias === 1 ? 'Ayer' : `Hace ${dias} días`
}

// "en 25 min", "en 3 h" (para lo que todavía no se emite)
export function dentroDe(unix: number, ahora = Date.now()): string {
    const minutos = Math.round((unix * 1000 - ahora) / 60000)
    if (minutos < 60) return `en ${Math.max(minutos, 1)} min`
    return `en ${Math.round(minutos / 60)} h`
}
