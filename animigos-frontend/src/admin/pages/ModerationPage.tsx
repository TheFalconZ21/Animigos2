import { useState, useEffect, useMemo } from 'react'
import {
    ShieldAlert,
    AlertTriangle,
    Search,
    Trash2,
    Send,
    CheckCircle2,
    Eye,
    MessageSquare,
    RefreshCw,
    X,
    AlertCircle
} from 'lucide-react'
import { getAdminUsers, moderateAdminUser } from '../services/adminApi'
import type { AdminUserItem } from '../services/adminApi'
import { AdminDrilldownDrawer } from '../components/AdminDrilldownDrawer'

interface ReportTicket {
    id: string
    reportedUserId: string
    reportedUserName: string
    reportedUserEmail: string
    reportedUserAvatar: string
    reporterName: string
    reason: string
    context: string
    targetComment?: string
    timestamp: string
    status: 'pending' | 'resolved' | 'dismissed'
    severity: 'high' | 'medium' | 'low'
}

interface UserCommentItem {
    id: string
    userId: string
    userName: string
    userAvatar: string
    content: string
    roomOrAnime: string
    timestamp: string
    reported: boolean
}

export function ModerationPage() {
    const [users, setUsers] = useState<AdminUserItem[]>([])
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'warned' | 'active' | 'suspended'>('all')

    // Usuario seleccionado para revisar su actividad (Drilldown)
    const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)

    // Modal para enviar advertencias
    const [warnModal, setWarnModal] = useState<{
        isOpen: boolean
        user: AdminUserItem | null
        reason: string
        customMessage: string
    }>({
        isOpen: false,
        user: null,
        reason: 'Lenguaje inapropiado o agresivo en sala',
        customMessage: ''
    })
    const [isSubmittingWarn, setIsSubmittingWarn] = useState(false)

    // Toast de retroalimentación
    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'warning' | 'danger' }>({
        show: false,
        msg: '',
        type: 'success'
    })

    const triggerToast = (msg: string, type: 'success' | 'warning' | 'danger' = 'success') => {
        setToast({ show: true, msg, type })
        setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500)
    }

    // Lista de Denuncias / Tickets de Reporte (Mock conectado a usuarios reales)
    const [reports, setReports] = useState<ReportTicket[]>([
        {
            id: 'REP-101',
            reportedUserId: 'u2',
            reportedUserName: 'Sofia Mendez',
            reportedUserEmail: 'sofia.m@gmail.com',
            reportedUserAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80',
            reporterName: 'Matias Perez',
            reason: 'Lenguaje agresivo y descalificaciones en chat grupal',
            context: 'Sala: Otakus del Viernes (Watch Party)',
            targetComment: 'Votan puras basuras, no tienen gusto para el anime.',
            timestamp: 'Hace 35 min',
            status: 'pending',
            severity: 'high'
        },
        {
            id: 'REP-102',
            reportedUserId: 'u3',
            reportedUserName: 'Kenji Sato',
            reportedUserEmail: 'kenji.s@yahoo.com',
            reportedUserAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
            reporterName: 'Lucia Gómez',
            reason: 'Veto arbitrario repetitivo para sabotear la elección grupal',
            context: 'Sala: Anime Chill & Pizza',
            targetComment: 'Voy a seguir vetando todo hasta que pongamos lo que yo quiero.',
            timestamp: 'Hace 2 horas',
            status: 'pending',
            severity: 'medium'
        },
        {
            id: 'REP-103',
            reportedUserId: 'u5',
            reportedUserName: 'Invited Guest #42',
            reportedUserEmail: 'guest-42@animigos.local',
            reportedUserAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80',
            reporterName: 'Sistema de Detección Anti-Spam',
            reason: 'Spam masivo de mensajes y enlaces no autorizados',
            context: 'Sala: Shonen Hype Watch Party',
            targetComment: 'Únanse a mi canal de telegram para ver anime pirata gratis: t.me/fake_link',
            timestamp: 'Hace 4 horas',
            status: 'pending',
            severity: 'high'
        }
    ])

    // Lista de Comentarios para Moderación Directa
    const [comments, setComments] = useState<UserCommentItem[]>([
        {
            id: 'comm-1',
            userId: 'u2',
            userName: 'Sofia Mendez',
            userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80',
            content: 'Votan puras basuras, no tienen gusto para el anime.',
            roomOrAnime: 'Sala: Otakus del Viernes',
            timestamp: 'Hace 35 min',
            reported: true
        },
        {
            id: 'comm-2',
            userId: 'u5',
            userName: 'Invited Guest #42',
            userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80',
            content: 'Únanse a mi canal de telegram para ver anime pirata gratis: t.me/fake_link',
            roomOrAnime: 'Sala: Shonen Hype',
            timestamp: 'Hace 4 horas',
            reported: true
        },
        {
            id: 'comm-3',
            userId: 'u3',
            userName: 'Kenji Sato',
            userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
            content: 'Voy a seguir vetando todo hasta que pongamos lo que yo quiero.',
            roomOrAnime: 'Sala: Anime Chill & Pizza',
            timestamp: 'Hace 2 horas',
            reported: true
        },
        {
            id: 'comm-4',
            userId: 'u4',
            userName: 'Valentina Silva',
            userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80',
            content: 'Excelente la animación de Frieren en el episodio 10, de lo mejor de la temporada.',
            roomOrAnime: 'Frieren: Beyond Journey\'s End',
            timestamp: 'Ayer',
            reported: false
        }
    ])

    // Cargar usuarios desde backend
    const loadUsers = async () => {
        setIsLoadingUsers(true)
        try {
            const data = await getAdminUsers()
            setUsers(data.users)
        } catch (err) {
            console.error('Error cargando usuarios en moderación:', err)
        } finally {
            setIsLoadingUsers(false)
        }
    }

    useEffect(() => {
        loadUsers()
    }, [])

    // Búsqueda global por Nombre, ID o Correo Electrónico
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const q = searchQuery.toLowerCase().trim()
            const matchesQuery = !q ||
                u.name.toLowerCase().includes(q) ||
                u.id.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q)

            let matchesStatus = true
            if (statusFilter === 'warned') matchesStatus = u.warnings > 0 || u.status === 'warned'
            else if (statusFilter === 'active') matchesStatus = u.status === 'active' && u.warnings === 0
            else if (statusFilter === 'suspended') matchesStatus = u.status === 'suspended'

            return matchesQuery && matchesStatus
        })
    }, [users, searchQuery, statusFilter])

    // Acción: Enviar Advertencia a Usuario
    const handleSendWarning = async () => {
        if (!warnModal.user) return
        setIsSubmittingWarn(true)
        const reasonText = warnModal.customMessage.trim()
            ? `${warnModal.reason}: ${warnModal.customMessage}`
            : warnModal.reason

        try {
            await moderateAdminUser(warnModal.user.id, 'warn', reasonText)
            setUsers(prev => prev.map(u => {
                if (u.id === warnModal.user?.id) {
                    return {
                        ...u,
                        warnings: u.warnings + 1,
                        status: 'warned',
                        reason: reasonText
                    }
                }
                return u
            }))
            triggerToast(`Advertencia enviada exitosamente a ${warnModal.user.name} (@${warnModal.user.username})`, 'warning')
            setWarnModal({ isOpen: false, user: null, reason: 'Lenguaje inapropiado o agresivo en sala', customMessage: '' })
        } catch (err) {
            console.error('Error enviando advertencia:', err)
            triggerToast('Advertencia registrada localmente (Error de conexión backend)', 'warning')
            setWarnModal({ isOpen: false, user: null, reason: '', customMessage: '' })
        } finally {
            setIsSubmittingWarn(false)
        }
    }

    // Acción: Borrar Comentario de Usuario
    const handleDeleteComment = (commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId))
        triggerToast('Comentario eliminado y purgado del historial de la sala.', 'success')
    }

    // Acción: Desestimar Denuncia
    const handleDismissReport = (reportId: string) => {
        setReports(prev => prev.filter(r => r.id !== reportId))
        triggerToast(`Denuncia #${reportId} desestimada tras revisión del moderador.`, 'info' as any)
    }

    return (
        <div className="pb-5">
            {/* Header del Centro de Moderación */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="admin-title m-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#EF4444' }}>
                            <ShieldAlert size={16} />
                        </span>
                        <span>Centro de Moderación & Reportes de Comunidad</span>
                        <span className="admin-badge admin-badge-danger font-mono" style={{ fontSize: '0.68rem' }}>
                            {reports.length} REPORTES PENDIENTES
                        </span>
                    </h1>
                    <p className="admin-subtitle mb-0 mt-0.5">
                        Gestión de denuncias de usuarios, revisión de actividad, advertencias disciplinarias y borrado de comentarios
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadUsers}
                    disabled={isLoadingUsers}
                    className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 font-mono"
                    style={{ fontSize: '0.72rem', padding: '5px 12px' }}
                >
                    <RefreshCw size={12} className={isLoadingUsers ? 'spin' : ''} />
                    <span>Actualizar Datos</span>
                </button>
            </div>

            {/* Toast de confirmación */}
            {toast.show && (
                <div
                    className={`alert d-flex align-items-center justify-content-between p-2.5 mb-3 rounded-1 font-mono small ${
                        toast.type === 'danger' ? 'alert-danger' : toast.type === 'warning' ? 'alert-warning' : 'alert-success'
                    }`}
                    style={{ fontSize: '0.74rem' }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>{toast.msg}</span>
                    </div>
                </div>
            )}

            {/* ============================================================
               1. BANNER DE TAREA PENDIENTE EN ROADMAP (TODO)
               ============================================================ */}
            <div
                className="p-3 rounded-2 mb-4 d-flex align-items-start gap-3"
                style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#FDE68A'
                }}
            >
                <AlertCircle size={20} className="flex-shrink-0 text-warning mt-0.5" />
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="fw-bold font-mono text-warning" style={{ fontSize: '0.78rem' }}>
                            [TAREA PENDIENTE EN ROADMAP DE DESARROLLO]
                        </span>
                        <span className="badge bg-warning text-dark font-mono" style={{ fontSize: '0.6rem' }}>
                            PRIORIDAD ALTA
                        </span>
                    </div>
                    <p className="m-0 font-sans text-light small" style={{ fontSize: '0.74rem', lineHeight: 1.45 }}>
                        <strong>Implementación formal del Sistema de Reportes Backend:</strong> Diseñar la migración en Django para el modelo <code>UserReportTicket</code> (PostgreSQL), endpoints REST <code>/api/reports/</code> para reporte de usuarios y comentarios desde el frontend del cliente, y webhooks de alerta inmediata en Discord/Slack para moderadores de guardia.
                    </p>
                </div>
            </div>

            {/* ============================================================
               2. GESTIÓN DE DENUNCIAS HECHAS POR USUARIOS (COLA DE MODERACIÓN)
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                            <AlertTriangle size={15} style={{ color: '#F59E0B' }} />
                            <span>Cola de Denuncias Hechas por Usuarios</span>
                        </h2>
                        <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                            Reportes en espera de veredicto emitidos por anfitriones y miembros de salas
                        </span>
                    </div>
                    <span className="admin-badge admin-badge-warning font-mono" style={{ fontSize: '0.65rem' }}>
                        {reports.length} Casos por Auditar
                    </span>
                </div>

                {reports.length === 0 ? (
                    <div className="text-center py-4 text-muted font-mono small">
                        No hay denuncias pendientes de revisión en este momento. La comunidad opera en armonía.
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-2.5">
                        {reports.map((rep) => (
                            <div
                                key={rep.id}
                                className="p-3 rounded-2"
                                style={{
                                    backgroundColor: 'var(--admin-surface-2)',
                                    border: `1px solid ${rep.severity === 'high' ? 'rgba(239, 68, 68, 0.4)' : 'var(--admin-border-subtle)'}`
                                }}
                            >
                                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                                    <div className="d-flex align-items-center gap-2.5">
                                        <img
                                            src={rep.reportedUserAvatar}
                                            alt={rep.reportedUserName}
                                            className="rounded-circle"
                                            style={{ width: 32, height: 32, objectFit: 'cover' }}
                                        />
                                        <div>
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="text-white fw-bold" style={{ fontSize: '0.84rem' }}>
                                                    {rep.reportedUserName}
                                                </span>
                                                <span className="font-mono text-muted small" style={{ fontSize: '0.68rem' }}>
                                                    {rep.reportedUserEmail}
                                                </span>
                                                <span
                                                    className="font-mono rounded px-1.5 py-0.5 fw-bold"
                                                    style={{
                                                        fontSize: '0.6rem',
                                                        backgroundColor: rep.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                        color: rep.severity === 'high' ? '#EF4444' : '#F59E0B'
                                                    }}
                                                >
                                                    {rep.id} • SEVERIDAD {rep.severity.toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="font-mono text-secondary small d-block" style={{ fontSize: '0.7rem' }}>
                                                Denunciado por: <strong className="text-info">{rep.reporterName}</strong> • {rep.context}
                                            </span>
                                        </div>
                                    </div>

                                    <span className="font-mono text-muted small" style={{ fontSize: '0.68rem' }}>
                                        {rep.timestamp}
                                    </span>
                                </div>

                                {/* Motivo y Comentario Denunciado */}
                                <div className="p-2.5 rounded-1 mb-2.5" style={{ backgroundColor: 'var(--admin-surface-3)', border: '1px solid var(--admin-border-divider)' }}>
                                    <div className="d-flex align-items-center gap-1.5 mb-1 font-mono text-warning" style={{ fontSize: '0.72rem' }}>
                                        <AlertTriangle size={12} />
                                        <span>Motivo: <strong>{rep.reason}</strong></span>
                                    </div>
                                    {rep.targetComment && (
                                        <p className="m-0 font-sans text-light small fst-italic" style={{ fontSize: '0.74rem', color: '#E4E4E7' }}>
                                            "{rep.targetComment}"
                                        </p>
                                    )}
                                </div>

                                {/* Botones de Acción de Moderación */}
                                <div className="d-flex flex-wrap justify-content-between align-items-center pt-2 border-top gap-2 font-mono" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.7rem' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        {/* Botón Mandar Advertencia */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const targetU = users.find(u => u.id === rep.reportedUserId) || {
                                                    id: rep.reportedUserId,
                                                    name: rep.reportedUserName,
                                                    username: rep.reportedUserName.toLowerCase().replace(/\s+/g, ''),
                                                    email: rep.reportedUserEmail,
                                                    avatar_url: rep.reportedUserAvatar,
                                                    role: 'member',
                                                    user_type: 'registered',
                                                    status: 'active',
                                                    warnings: 0,
                                                    rooms_count: 3,
                                                    votes_count: 8,
                                                    joined_at: '2026-10-15',
                                                    last_activity: 'Hace 1 hora'
                                                }
                                                setWarnModal({
                                                    isOpen: true,
                                                    user: targetU,
                                                    reason: rep.reason,
                                                    customMessage: `Reportado en ${rep.context}`
                                                })
                                            }}
                                            className="admin-btn d-flex align-items-center gap-1"
                                            style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                                        >
                                            <Send size={12} />
                                            <span>Mandar Advertencia</span>
                                        </button>

                                        {/* Botón Borrar Comentario Denunciado */}
                                        {rep.targetComment && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setComments(prev => prev.filter(c => c.content !== rep.targetComment))
                                                    triggerToast('Comentario eliminado de la sala y purgado.', 'success')
                                                }}
                                                className="admin-btn d-flex align-items-center gap-1"
                                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                            >
                                                <Trash2 size={12} />
                                                <span>Borrar Comentario</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Botón Desestimar Denuncia */}
                                    <button
                                        type="button"
                                        onClick={() => handleDismissReport(rep.id)}
                                        className="btn btn-sm btn-link text-muted font-mono"
                                        style={{ fontSize: '0.68rem', textDecoration: 'none' }}
                                    >
                                        Desestimar Denuncia
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ============================================================
               3. BUSCADOR GLOBAL Y REVISIÓN DE ACTIVIDAD POR USUARIO
               ============================================================ */}
            <div className="admin-card mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                            <Search size={15} style={{ color: 'var(--admin-blue)' }} />
                            <span>Buscador Global de Usuarios & Auditoría Disciplinaria</span>
                        </h2>
                        <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                            Busca cualquier usuario por <strong>Nombre</strong>, <strong>ID canónico</strong> o <strong>Correo Electrónico</strong>
                        </span>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        {/* Input de Búsqueda */}
                        <div className="position-relative" style={{ width: 280 }}>
                            <Search size={13} className="position-absolute text-muted" style={{ left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por Nombre, ID (#u1) o Correo..."
                                className="form-control form-control-sm font-mono ps-4"
                                style={{
                                    backgroundColor: 'var(--admin-surface-2)',
                                    borderColor: 'var(--admin-border-subtle)',
                                    color: '#FFFFFF',
                                    fontSize: '0.74rem'
                                }}
                            />
                        </div>

                        {/* Filtro por estado disciplinario */}
                        <div className="d-flex align-items-center gap-1 p-0.5 rounded-1" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            {(['all', 'warned', 'active', 'suspended'] as const).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className="btn btn-sm font-mono border-0"
                                    style={{
                                        fontSize: '0.66rem',
                                        padding: '3px 8px',
                                        backgroundColor: statusFilter === st ? 'var(--admin-blue)' : 'transparent',
                                        color: statusFilter === st ? '#000000' : 'var(--admin-text-secondary)',
                                        fontWeight: statusFilter === st ? 600 : 400
                                    }}
                                >
                                    {st === 'all' ? 'TODOS' : st === 'warned' ? 'CON ADVERTENCIAS' : st === 'active' ? 'ACTIVOS' : 'SUSPENDIDOS'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tabla de Usuarios con botón de Drilldown y Advertencia */}
                <div className="table-responsive">
                    <table className="table table-dark table-hover font-mono m-0" style={{ fontSize: '0.74rem' }}>
                        <thead>
                            <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-muted)' }}>
                                <th>ID CANÓNICO</th>
                                <th>USUARIO & CORREO</th>
                                <th>ROL / TIPO</th>
                                <th>ESTADO DISCIPLINARIO</th>
                                <th>ADVERTENCIAS</th>
                                <th>ACTIVIDAD SALAS</th>
                                <th className="text-end">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-4 text-muted">
                                        No se encontró ningún usuario con los criterios de búsqueda especificados.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(u => (
                                    <tr key={u.id} className="border-bottom" style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
                                        <td className="text-muted fw-bold">#{u.id}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <img
                                                    src={u.avatar_url || 'https://via.placeholder.com/26'}
                                                    alt={u.name}
                                                    className="rounded-circle"
                                                    style={{ width: 26, height: 26, objectFit: 'cover' }}
                                                />
                                                <div>
                                                    <div className="text-white fw-semibold">{u.name}</div>
                                                    <div className="text-muted small" style={{ fontSize: '0.66rem' }}>{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="admin-badge admin-badge-neutral" style={{ fontSize: '0.62rem' }}>
                                                {u.user_type === 'registered' ? 'Registrado' : 'Guest'}
                                            </span>
                                        </td>
                                        <td>
                                            {u.status === 'suspended' ? (
                                                <span className="admin-badge admin-badge-danger" style={{ fontSize: '0.62rem' }}>Suspendido</span>
                                            ) : u.warnings > 0 || u.status === 'warned' ? (
                                                <span className="admin-badge admin-badge-warning" style={{ fontSize: '0.62rem' }}>Advertido</span>
                                            ) : (
                                                <span className="admin-badge admin-badge-success" style={{ fontSize: '0.62rem' }}>En Buen Estado</span>
                                            )}
                                        </td>
                                        <td>
                                            {u.warnings > 0 ? (
                                                <span className="text-warning fw-bold">⚠️ {u.warnings}</span>
                                            ) : (
                                                <span className="text-muted">0</span>
                                            )}
                                        </td>
                                        <td className="text-secondary small">
                                            {u.rooms_count} salas • {u.votes_count} votos
                                        </td>
                                        <td className="text-end">
                                            <div className="d-flex align-items-center justify-content-end gap-1.5">
                                                {/* Botón Revisar Actividad (Drilldown) */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedUser(u)}
                                                    className="admin-btn admin-btn-secondary d-flex align-items-center gap-1 font-mono"
                                                    style={{ fontSize: '0.66rem', padding: '3px 8px' }}
                                                    title="Revisar actividad completa del usuario"
                                                >
                                                    <Eye size={11} />
                                                    <span>Actividad</span>
                                                </button>

                                                {/* Botón Mandar Advertencia */}
                                                <button
                                                    type="button"
                                                    onClick={() => setWarnModal({
                                                        isOpen: true,
                                                        user: u,
                                                        reason: 'Inconducta o infracción a las normas de sala',
                                                        customMessage: ''
                                                    })}
                                                    className="admin-btn d-flex align-items-center gap-1 font-mono"
                                                    style={{
                                                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                        color: '#F59E0B',
                                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                                        fontSize: '0.66rem',
                                                        padding: '3px 8px'
                                                    }}
                                                    title="Mandar advertencia formal"
                                                >
                                                    <Send size={11} />
                                                    <span>Advertir</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ============================================================
               4. MODERACIÓN DE COMENTARIOS RECIENTES DE USUARIOS
               ============================================================ */}
            <div className="admin-card">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h2 className="admin-title m-0 d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                            <MessageSquare size={15} style={{ color: 'var(--admin-purple)' }} />
                            <span>Moderación de Comentarios Recientes en Salas</span>
                        </h2>
                        <span className="admin-subtitle" style={{ fontSize: '0.72rem' }}>
                            Supervisión y opción de borrado inmediato de mensajes reportados o sospechosos
                        </span>
                    </div>
                    <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.65rem' }}>
                        {comments.length} Mensajes en Cola
                    </span>
                </div>

                <div className="row g-2">
                    {comments.map((comm) => (
                        <div key={comm.id} className="col-12 col-md-6">
                            <div
                                className="p-3 rounded-2 h-100 d-flex flex-column justify-content-between"
                                style={{
                                    backgroundColor: 'var(--admin-surface-2)',
                                    border: `1px solid ${comm.reported ? 'rgba(239, 68, 68, 0.35)' : 'var(--admin-border-subtle)'}`
                                }}
                            >
                                <div>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <img
                                                src={comm.userAvatar}
                                                alt={comm.userName}
                                                className="rounded-circle"
                                                style={{ width: 24, height: 24, objectFit: 'cover' }}
                                            />
                                            <div>
                                                <div className="fw-semibold text-white small" style={{ fontSize: '0.78rem' }}>
                                                    {comm.userName}
                                                </div>
                                                <div className="font-mono text-muted small" style={{ fontSize: '0.64rem' }}>
                                                    {comm.roomOrAnime}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-1.5">
                                            {comm.reported && (
                                                <span className="admin-badge admin-badge-danger font-mono" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                                                    REPORTADO
                                                </span>
                                            )}
                                            <span className="font-mono text-muted small" style={{ fontSize: '0.64rem' }}>
                                                {comm.timestamp}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="m-0 font-sans text-light small mb-2" style={{ fontSize: '0.75rem', color: '#E4E4E7', lineHeight: 1.4 }}>
                                        "{comm.content}"
                                    </p>
                                </div>

                                <div className="d-flex justify-content-between align-items-center pt-2 border-top font-mono" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                    <span className="text-muted small" style={{ fontSize: '0.64rem' }}>ID: {comm.id}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteComment(comm.id)}
                                        className="btn btn-sm btn-outline-danger font-mono d-flex align-items-center gap-1"
                                        style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                                        title="Borrar comentario del sistema"
                                    >
                                        <Trash2 size={11} />
                                        <span>Borrar Comentario</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ============================================================
               MODAL: MANDAR ADVERTENCIA A USUARIO
               ============================================================ */}
            {warnModal.isOpen && warnModal.user && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.78)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 1050
                    }}
                    onClick={() => setWarnModal({ isOpen: false, user: null, reason: '', customMessage: '' })}
                >
                    <div
                        className="admin-card w-100 p-4"
                        style={{
                            maxWidth: 540,
                            border: '1px solid var(--admin-border-divider)',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-start mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <div className="d-flex align-items-center gap-2">
                                <span className="p-1 rounded bg-warning-subtle text-warning">
                                    <AlertTriangle size={16} />
                                </span>
                                <h3 className="admin-title m-0" style={{ fontSize: '1rem' }}>
                                    Enviar Advertencia Disciplinaria
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-link text-muted p-1"
                                onClick={() => setWarnModal({ isOpen: false, user: null, reason: '', customMessage: '' })}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Detalle del Usuario a Advertir */}
                        <div className="p-2.5 rounded-2 mb-3 d-flex align-items-center gap-2.5" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <img
                                src={warnModal.user.avatar_url || 'https://via.placeholder.com/32'}
                                alt={warnModal.user.name}
                                className="rounded-circle"
                                style={{ width: 32, height: 32, objectFit: 'cover' }}
                            />
                            <div>
                                <div className="text-white fw-bold" style={{ fontSize: '0.84rem' }}>{warnModal.user.name}</div>
                                <div className="text-muted font-mono small" style={{ fontSize: '0.68rem' }}>
                                    @{warnModal.user.username} • {warnModal.user.email} (Advertencias previas: {warnModal.user.warnings})
                                </div>
                            </div>
                        </div>

                        {/* Selector de Motivo */}
                        <div className="mb-3">
                            <label className="form-label font-mono text-secondary small" style={{ fontSize: '0.72rem' }}>
                                Motivo de la Infracción:
                            </label>
                            <select
                                value={warnModal.reason}
                                onChange={(e) => setWarnModal(prev => ({ ...prev, reason: e.target.value }))}
                                className="form-select form-select-sm font-mono"
                                style={{
                                    backgroundColor: 'var(--admin-surface-2)',
                                    borderColor: 'var(--admin-border-subtle)',
                                    color: '#FFFFFF',
                                    fontSize: '0.74rem'
                                }}
                            >
                                <option value="Lenguaje inapropiado o agresivo en sala">Lenguaje inapropiado o agresivo en sala</option>
                                <option value="Spam reiterado de enlaces o autopromoción">Spam reiterado de enlaces o autopromoción</option>
                                <option value="Veto malicioso sistemático para sabotear watch party">Veto malicioso sistemático para sabotear watch party</option>
                                <option value="Spoilers no advertidos en chat de votación">Spoilers no advertidos en chat de votación</option>
                                <option value="Infracción reiterada a las normas de convivencia">Infracción reiterada a las normas de convivencia</option>
                            </select>
                        </div>

                        {/* Mensaje personalizado de advertencia */}
                        <div className="mb-3">
                            <label className="form-label font-mono text-secondary small" style={{ fontSize: '0.72rem' }}>
                                Mensaje o Contexto Adicional (visible para el usuario):
                            </label>
                            <textarea
                                value={warnModal.customMessage}
                                onChange={(e) => setWarnModal(prev => ({ ...prev, customMessage: e.target.value }))}
                                placeholder="Indica el contexto específico o llamado de atención..."
                                rows={3}
                                className="form-control form-control-sm font-mono"
                                style={{
                                    backgroundColor: 'var(--admin-surface-2)',
                                    borderColor: 'var(--admin-border-subtle)',
                                    color: '#FFFFFF',
                                    fontSize: '0.74rem'
                                }}
                            />
                        </div>

                        <div className="d-flex justify-content-end gap-2 pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                            <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                onClick={() => setWarnModal({ isOpen: false, user: null, reason: '', customMessage: '' })}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isSubmittingWarn}
                                onClick={handleSendWarning}
                                className="admin-btn d-flex align-items-center gap-1.5"
                                style={{ backgroundColor: 'var(--admin-amber)', color: '#000000', fontWeight: 600 }}
                            >
                                <Send size={13} />
                                <span>{isSubmittingWarn ? 'Enviando...' : 'Confirmar y Notificar Advertencia'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================
               DRAWER: REVISIÓN DE ACTIVIDAD COMPLETA DEL USUARIO
               ============================================================ */}
            <AdminDrilldownDrawer
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                title={selectedUser?.name || 'Perfil de Usuario'}
                subtitle={`Auditoría completa de actividad, salas y comportamiento (#${selectedUser?.id})`}
                badgeText={selectedUser?.status === 'suspended' ? 'Suspendido' : selectedUser?.warnings ? `${selectedUser.warnings} Advertencias` : 'Activo'}
                badgeType={selectedUser?.status === 'suspended' ? 'danger' : selectedUser?.warnings ? 'warning' : 'success'}
            >
                {selectedUser && (
                    <div className="d-flex flex-column gap-3.5">
                        {/* Cabecera del usuario */}
                        <div className="p-3 rounded-2 text-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <img
                                src={selectedUser.avatar_url || 'https://via.placeholder.com/64'}
                                alt={selectedUser.name}
                                className="rounded-circle mb-2"
                                style={{ width: 56, height: 56, objectFit: 'cover', border: '2px solid var(--admin-border-divider)' }}
                            />
                            <h4 className="text-white fw-bold m-0" style={{ fontSize: '0.95rem' }}>{selectedUser.name}</h4>
                            <span className="font-mono text-muted small" style={{ fontSize: '0.72rem' }}>
                                @{selectedUser.username} • {selectedUser.email}
                            </span>
                            <div className="d-flex justify-content-center gap-2 mt-2">
                                <span className="admin-badge admin-badge-info font-mono" style={{ fontSize: '0.65rem' }}>
                                    {selectedUser.user_type === 'registered' ? 'Cuenta Registrada' : 'Invitado Temporal'}
                                </span>
                                <span className="admin-badge admin-badge-neutral font-mono" style={{ fontSize: '0.65rem' }}>
                                    Rol: {selectedUser.role.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Historial de actividad */}
                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <span className="fw-semibold text-white d-block mb-2 font-mono" style={{ fontSize: '0.76rem' }}>
                                HISTORIAL DE INTERACCIÓN:
                            </span>
                            <div className="d-flex flex-column gap-2 font-mono small" style={{ fontSize: '0.72rem' }}>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-3)' }}>
                                    <span className="text-secondary">Salas Creadas o Participadas:</span>
                                    <span className="text-white fw-bold">{selectedUser.rooms_count} salas</span>
                                </div>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-3)' }}>
                                    <span className="text-secondary">Votos y Calificaciones Emitidas:</span>
                                    <span className="text-white fw-bold">{selectedUser.votes_count} votos</span>
                                </div>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-3)' }}>
                                    <span className="text-secondary">Última Conexión Registrada:</span>
                                    <span className="text-white">{selectedUser.last_activity}</span>
                                </div>
                                <div className="d-flex justify-content-between p-2 rounded" style={{ backgroundColor: 'var(--admin-surface-3)' }}>
                                    <span className="text-secondary">Fecha de Alta en la Plataforma:</span>
                                    <span className="text-white">{selectedUser.joined_at}</span>
                                </div>
                            </div>
                        </div>

                        {/* Advertencias previas */}
                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="fw-semibold text-white font-mono" style={{ fontSize: '0.76rem' }}>
                                    REGISTRO DISCIPLINARIO:
                                </span>
                                <span className="font-mono text-warning fw-bold small">
                                    {selectedUser.warnings} advertencias
                                </span>
                            </div>
                            {selectedUser.reason ? (
                                <div className="p-2 rounded font-mono small text-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.7rem' }}>
                                    Último motivo: {selectedUser.reason}
                                </div>
                            ) : (
                                <div className="font-mono text-muted small" style={{ fontSize: '0.7rem' }}>
                                    No registra antecedentes ni sanciones disciplinarias.
                                </div>
                            )}
                        </div>

                        {/* Botón de acción rápida desde Drawer */}
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedUser(null)
                                setWarnModal({
                                    isOpen: true,
                                    user: selectedUser,
                                    reason: 'Inconducta observada en auditoría de actividad',
                                    customMessage: ''
                                })
                            }}
                            className="admin-btn d-flex align-items-center justify-content-center gap-1.5 font-mono w-100 py-2"
                            style={{ backgroundColor: 'var(--admin-amber)', color: '#000000', fontWeight: 600 }}
                        >
                            <Send size={13} />
                            <span>Mandar Advertencia a este Usuario</span>
                        </button>
                    </div>
                )}
            </AdminDrilldownDrawer>
        </div>
    )
}
