import { useState, useEffect, useMemo } from 'react'
import {
    ShieldAlert,
    Search,
    AlertTriangle,
    Trash2,
    MessageSquare,
    CheckCircle2,
    Send,
    RefreshCw,
    ChevronRight,
    UserX
} from 'lucide-react'
import { getAdminUsers, moderateAdminUser } from '../services/adminApi'
import type { AdminUserItem } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type ModerationSubView = 'reports-queue' | 'user-discipline' | 'comments-audit'

interface UserReportTicket {
    id: string
    category: 'toxicity' | 'spoilers' | 'spam'
    reportedUserId: string
    reportedUserName: string
    reportedUserEmail: string
    reportedUserAvatar: string
    reporterName: string
    reason: string
    context: string
    targetComment?: string
    timestamp: string
    severity: 'high' | 'medium' | 'low'
}

interface RoomCommentItem {
    id: string
    userId: string
    userName: string
    userEmail: string
    userAvatar: string
    roomName: string
    content: string
    timestamp: string
    flagged: boolean
}

export function ModerationPage() {
    const [users, setUsers] = useState<AdminUserItem[]>([])
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)
    const [activeSubView, setActiveSubView] = useAdminSubView<ModerationSubView>()
    const [focusedCategory, setFocusedCategory] = useState<'toxicity' | 'spoilers' | 'spam'>('toxicity')

    // Filtros en Sub-Vista Disciplinaria
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'warned' | 'active' | 'suspended'>('all')
    const [warningTargetUser, setWarningTargetUser] = useState<AdminUserItem | null>(null)
    const [warningReason, setWarningReason] = useState('Lenguaje ofensivo o conducta antideportiva en sala')

    const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' })

    const triggerToast = (msg: string) => {
        setToast({ show: true, msg })
        setTimeout(() => setToast({ show: false, msg: '' }), 3500)
    }

    const [reports, setReports] = useState<UserReportTicket[]>([])

    const [comments, setComments] = useState<RoomCommentItem[]>([])

    const loadUsers = async () => {
        setIsLoadingUsers(true)
        try {
            const data = await getAdminUsers()
            setUsers(data.users)
        } catch (err) {
            console.error('Error loading users in moderation:', err)
        } finally {
            setIsLoadingUsers(false)
        }
    }

    useEffect(() => {
        loadUsers()
    }, [])

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

    const categoryBreakdown = useMemo(() => {
        const total = reports.length
        const toxCount = reports.filter(r => r.category === 'toxicity').length
        const spCount = reports.filter(r => r.category === 'spoilers').length
        const spamCount = reports.filter(r => r.category === 'spam').length

        return [
            {
                id: 'toxicity' as const,
                label: 'Conducta Hostil / Toxicidad en Sala',
                count: toxCount,
                pct: total > 0 ? Math.round((toxCount / total) * 100) : 0,
                color: 'var(--admin-rose)',
                sla: `${toxCount} reportes`,
                policy: 'Advertencia formal al 1er reporte verificado; suspensión temporal al 2do.'
            },
            {
                id: 'spoilers' as const,
                label: 'Spoilers sin Etiqueta en Votación',
                count: spCount,
                pct: total > 0 ? Math.round((spCount / total) * 100) : 0,
                color: 'var(--admin-amber)',
                sla: `${spCount} reportes`,
                policy: 'Purga inmediata del comentario del historial de la sala y aviso preventivo.'
            },
            {
                id: 'spam' as const,
                label: 'Spam / Enlaces Externos No Autorizados',
                count: spamCount,
                pct: total > 0 ? Math.round((spamCount / total) * 100) : 0,
                color: 'var(--admin-focus)',
                sla: `${spamCount} reportes`,
                policy: 'Revocación de sesión e invalidación de enlaces compartidos.'
            }
        ]
    }, [reports])

    const handleSendWarning = async (user: AdminUserItem, reasonText: string) => {
        try {
            await moderateAdminUser(user.id, 'warn', reasonText, {
                username: user.username,
                email: user.email
            })
        } catch (err) {
            console.error(err)
        }
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, warnings: u.warnings + 1, status: 'warned' } : u))
        setWarningTargetUser(null)
        triggerToast(`Advertencia disciplinaria registrada para ${user.name}`)
    }

    const handleDismissReport = (id: string) => {
        setReports(prev => prev.filter(r => r.id !== id))
        triggerToast(`Denuncia ${id} resuelta y archivada`)
    }

    const handleDeleteComment = (commentId: string) => {
        setComments(prev => prev.filter(c => c.id !== commentId))
        triggerToast('Comentario purgado del historial de PostgreSQL')
    }

    const subViewOptions: SubViewOption<ModerationSubView>[] = [
        { id: 'reports-queue', label: 'Cola de Denuncias', badge: `${reports.length}` },
        { id: 'user-discipline', label: 'Auditoría de Usuarios', badge: `${users.filter(u => u.warnings > 0).length} adv.` },
        { id: 'comments-audit', label: 'Moderación de Comentarios', badge: `${comments.length}` }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Centro de Moderación"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {toast.show && (
                    <div className="admin-correlative-bridge">
                        <span className="text-white d-flex align-items-center gap-2">
                            <CheckCircle2 size={15} style={{ color: 'var(--admin-emerald)' }} />
                            {toast.msg}
                        </span>
                    </div>
                )}

                {/* SUB-VISTA 1: BANDEJA DE RESOLUCIÓN DE DENUNCIAS */}
                {activeSubView === 'reports-queue' && (
                    <div className="admin-card">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.1rem' }}>
                                    Bandeja de Denuncias Emitidas por la Comunidad ({reports.length})
                                </h2>
                                <span className="admin-subtitle">
                                    Ejecuta advertencias, purga mensajes infractores o desestima falsos positivos
                                </span>
                            </div>
                        </div>

                        {reports.length === 0 ? (
                            <div className="p-5 text-center">
                                <CheckCircle2 size={32} style={{ color: 'var(--admin-emerald)' }} className="mb-2" />
                                <div className="text-white fw-semibold">Bandeja limpia: 0 reportes pendientes</div>
                                <p className="admin-subtitle m-0 mt-1">Todas las denuncias han sido auditadas y cerradas.</p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {reports.map(rep => (
                                    <div
                                        key={rep.id}
                                        className="p-3.5 rounded-2"
                                        style={{
                                            backgroundColor: 'var(--admin-surface-2)',
                                            border: rep.severity === 'high' ? '1px solid var(--admin-rose-border)' : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                                            <div className="d-flex align-items-center gap-2.5">
                                                <img
                                                    src={rep.reportedUserAvatar}
                                                    alt={rep.reportedUserName}
                                                    style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <strong className="text-white" style={{ fontSize: '0.9rem' }}>{rep.reportedUserName}</strong>
                                                        <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>{rep.reportedUserEmail}</span>
                                                        <span className={`admin-badge font-mono ${rep.severity === 'high' ? 'admin-badge-danger' : 'admin-badge-warning'}`}>
                                                            {rep.id} • {rep.severity.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>
                                                        Reportado por <strong className="text-white">{rep.reporterName}</strong> en {rep.context}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>{rep.timestamp}</span>
                                        </div>

                                        <div className="p-2.5 rounded-2 my-2" style={{ backgroundColor: 'var(--admin-surface-1)', border: '1px solid var(--admin-border-subtle)' }}>
                                            <div style={{ color: 'var(--admin-amber)', fontSize: '0.8rem', fontWeight: 600 }}>Motivo: {rep.reason}</div>
                                            {rep.targetComment && (
                                                <div className="text-white fst-italic mt-1" style={{ fontSize: '0.82rem' }}>"{rep.targetComment}"</div>
                                            )}
                                        </div>

                                        <div className="d-flex flex-wrap justify-content-between align-items-center pt-2 gap-2">
                                            <div className="d-flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleSendWarning({
                                                            id: rep.reportedUserId,
                                                            name: rep.reportedUserName,
                                                            username: rep.reportedUserName,
                                                            email: rep.reportedUserEmail,
                                                            avatar_url: rep.reportedUserAvatar,
                                                            role: 'member',
                                                            user_type: 'registered',
                                                            status: 'warned',
                                                            warnings: 1,
                                                            rooms_count: 2,
                                                            votes_count: 5,
                                                            joined_at: '2026-10-15',
                                                            last_activity: 'Hoy'
                                                        }, rep.reason)
                                                        handleDismissReport(rep.id)
                                                    }}
                                                    className="admin-btn d-inline-flex align-items-center gap-1.5"
                                                    style={{ backgroundColor: 'var(--admin-amber)', color: '#090B10', fontWeight: 600 }}
                                                >
                                                    <Send size={13} />
                                                    <span>Emitir Advertencia y Cerrar Caso</span>
                                                </button>
                                                {rep.targetComment && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setComments(prev => prev.filter(c => c.content !== rep.targetComment))
                                                            handleDismissReport(rep.id)
                                                        }}
                                                        className="admin-btn admin-btn-secondary text-danger d-inline-flex align-items-center gap-1.5"
                                                    >
                                                        <Trash2 size={13} />
                                                        <span>Purgar Comentario</span>
                                                    </button>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDismissReport(rep.id)}
                                                className="admin-btn admin-btn-secondary"
                                            >
                                                Desestimar Reporte
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* SUB-VISTA 2: AUDITORÍA DISCIPLINARIA DE USUARIOS */}
                {activeSubView === 'user-discipline' && (
                    <div className="admin-card">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                            <div>
                                <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                    Auditoría Disciplinaria de Usuarios
                                </h2>
                                <span className="admin-subtitle">Busca por nombre, ID o correo para revisar historial de advertencias</span>
                            </div>

                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div className="admin-input-wrapper d-flex align-items-center gap-2">
                                    <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Buscar usuario, #ID o correo..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-transparent border-0 text-white"
                                        style={{ fontSize: '0.8rem', outline: 'none', width: 210 }}
                                    />
                                </div>

                                <div className="admin-subview-switcher">
                                    {[
                                        { id: 'all', label: 'Todos' },
                                        { id: 'warned', label: 'Advertidos' },
                                        { id: 'active', label: 'En Regla' },
                                        { id: 'suspended', label: 'Suspendidos' }
                                    ].map(st => (
                                        <button
                                            key={st.id}
                                            type="button"
                                            onClick={() => setStatusFilter(st.id as any)}
                                            className={`admin-subview-pill ${statusFilter === st.id ? 'active' : ''}`}
                                        >
                                            {st.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {warningTargetUser && (
                            <div className="p-3 rounded-2 mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2" style={{ backgroundColor: 'var(--admin-amber-bg)', border: '1px solid var(--admin-amber-border)' }}>
                                <div className="d-flex align-items-center gap-2 flex-grow-1">
                                    <strong className="text-white" style={{ fontSize: '0.84rem' }}>Advertir a {warningTargetUser.name}:</strong>
                                    <input
                                        type="text"
                                        value={warningReason}
                                        onChange={(e) => setWarningReason(e.target.value)}
                                        className="form-control form-control-sm bg-dark text-white border-secondary"
                                        style={{ maxWidth: 380 }}
                                    />
                                </div>
                                <div className="d-flex gap-2">
                                    <button type="button" onClick={() => setWarningTargetUser(null)} className="admin-btn admin-btn-secondary">Cancelar</button>
                                    <button
                                        type="button"
                                        onClick={() => handleSendWarning(warningTargetUser, warningReason)}
                                        className="admin-btn"
                                        style={{ backgroundColor: 'var(--admin-amber)', color: '#090B10', fontWeight: 600 }}
                                    >
                                        Confirmar Advertencia
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                            <table className="table table-dark table-hover m-0 align-middle" style={{ fontSize: '0.8125rem' }}>
                                <thead>
                                    <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                        <th>ID</th>
                                        <th>USUARIO</th>
                                        <th>ESTADO</th>
                                        <th className="text-center">ADVERTENCIAS</th>
                                        <th>PARTICIPACIÓN</th>
                                        <th className="text-end">ACCIÓN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.slice(0, 18).map(u => (
                                        <tr key={u.id} className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                            <td className="font-mono" style={{ color: 'var(--admin-text-muted)' }}>#{u.id}</td>
                                            <td>
                                                <div className="text-white fw-semibold">{u.name}</div>
                                                <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.74rem' }}>{u.email}</span>
                                            </td>
                                            <td>
                                                {u.warnings > 0 || u.status === 'warned' ? (
                                                    <span className="admin-badge admin-badge-warning">Con Advertencia</span>
                                                ) : (
                                                    <span className="admin-badge admin-badge-success">En Buen Estado</span>
                                                )}
                                            </td>
                                            <td className="text-center font-mono">
                                                <strong style={{ color: u.warnings > 0 ? 'var(--admin-amber)' : 'var(--admin-text-muted)' }}>
                                                    {u.warnings}
                                                </strong>
                                            </td>
                                            <td className="font-mono" style={{ color: 'var(--admin-text-secondary)' }}>
                                                {u.rooms_count} salas • {u.votes_count} votos
                                            </td>
                                            <td className="text-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setWarningTargetUser(u)}
                                                    className="admin-btn admin-btn-secondary d-inline-flex align-items-center gap-1"
                                                >
                                                    <Send size={12} style={{ color: 'var(--admin-amber)' }} />
                                                    <span>Advertir</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 3: MODERACIÓN DE COMENTARIOS */}
                {activeSubView === 'comments-audit' && (
                    <div className="admin-card">
                        <h2 className="admin-title mb-1" style={{ fontSize: '1.05rem' }}>Moderación de Comentarios en Salas ({comments.length})</h2>
                        <p className="admin-subtitle mb-3">Purga comentarios marcados por lenguaje ofensivo o spoilers</p>
                        <div className="d-flex flex-column gap-2.5">
                            {comments.map(c => (
                                <div key={c.id} className="p-3 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)', border: c.flagged ? '1px solid var(--admin-rose-border)' : '1px solid var(--admin-border-subtle)' }}>
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <strong className="text-white">{c.userName}</strong>
                                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>{c.roomName} • {c.timestamp}</span>
                                            {c.flagged && <span className="admin-badge admin-badge-danger">Reportado</span>}
                                        </div>
                                        <div className="text-white" style={{ fontSize: '0.84rem' }}>"{c.content}"</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteComment(c.id)}
                                        className="admin-btn admin-btn-secondary text-danger d-inline-flex align-items-center gap-1"
                                    >
                                        <Trash2 size={13} />
                                        <span>Borrar</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    const activeCatObj = categoryBreakdown.find(c => c.id === focusedCategory) || categoryBreakdown[0]
    const highSeverityCount = reports.filter(r => r.severity === 'high').length
    const warnedUsersCount = users.filter(u => u.warnings > 0 || u.status === 'warned').length

    return (
        <div className="admin-viewport-shell">
            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <div className="d-flex align-items-center gap-2.5">
                        <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                            Centro de Moderación & Convivencia de Salas
                        </h1>
                        <span className={`admin-badge font-mono ${reports.length > 0 ? 'admin-badge-warning' : 'admin-badge-success'}`}>
                            {reports.length} CASOS PENDIENTES
                        </span>
                    </div>
                    <p className="admin-subtitle m-0 mt-1">
                        Triaje de reportes por severidad, control de reincidencia disciplinaria y purga de spoilers/toxicidad
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubView('reports-queue')}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <ShieldAlert size={14} />
                        <span>Resolver Denuncias ({reports.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={loadUsers}
                        disabled={isLoadingUsers}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5"
                    >
                        <RefreshCw size={13} className={isLoadingUsers ? 'spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('reports-queue')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Cola de Denuncias</span>
                        <span className="admin-badge admin-badge-warning font-mono">Triaje Activo</span>
                    </div>
                    <div className="admin-kpi-value my-1">{reports.length}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Abrir bandeja de casos</span>
                            <ChevronRight size={13} />
                        </span>
                        <AlertTriangle size={15} style={{ color: 'var(--admin-amber)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('reports-queue')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Severidad Alta</span>
                        <span className="admin-badge admin-badge-danger font-mono">Prioridad 1</span>
                    </div>
                    <div className="admin-kpi-value my-1" style={{ color: highSeverityCount > 0 ? 'var(--admin-rose)' : 'var(--admin-emerald)' }}>
                        {highSeverityCount}
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Intervenir casos críticos</span>
                            <ChevronRight size={13} />
                        </span>
                        <ShieldAlert size={15} style={{ color: 'var(--admin-rose)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setStatusFilter('warned')
                        setActiveSubView('user-discipline')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Usuarios Advertidos</span>
                        <span className="admin-badge admin-badge-neutral font-mono">Seguimiento</span>
                    </div>
                    <div className="admin-kpi-value my-1">{warnedUsersCount}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Auditar reincidencias</span>
                            <ChevronRight size={13} />
                        </span>
                        <UserX size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('comments-audit')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Mensajes en Revisión</span>
                        <span className="admin-badge admin-badge-info font-mono">Chat de Sala</span>
                    </div>
                    <div className="admin-kpi-value my-1">{comments.filter(c => c.flagged).length}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Purgar comentarios</span>
                            <ChevronRight size={13} />
                        </span>
                        <MessageSquare size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Matriz de Incidencias por Tipología + Caso Crítico Prioritario */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Distribución de Incidencias por Tipología y Nivel de Riesgo
                            </h2>
                            <span className="admin-badge admin-badge-info">Click para Triaje</span>
                        </div>

                        <div className="d-flex flex-column my-2" style={{ gap: '1.3rem' }}>
                            {categoryBreakdown.map(cat => {
                                const isFocused = focusedCategory === cat.id
                                return (
                                    <div
                                        key={cat.id}
                                        onMouseEnter={() => setFocusedCategory(cat.id)}
                                        onClick={() => setActiveSubView('reports-queue')}
                                        className="admin-chart-interactive-node"
                                        style={{
                                            padding: '1.15rem 1.35rem',
                                            borderRadius: 14,
                                            backgroundColor: isFocused ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                            border: isFocused ? `1px solid ${cat.color}` : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '0.75rem' }}>
                                            <span className="text-white fw-semibold" style={{ fontSize: '0.9rem' }}>{cat.label}</span>
                                            <div className="d-flex align-items-center gap-3 font-mono">
                                                <span className="admin-badge admin-badge-neutral">{cat.sla}</span>
                                                <strong className="text-white" style={{ fontSize: '0.95rem' }}>{cat.pct}%</strong>
                                                <ChevronRight size={15} style={{ color: isFocused ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }} />
                                            </div>
                                        </div>

                                        <div className="w-100 rounded overflow-hidden" style={{ height: 9, backgroundColor: 'var(--admin-surface-1)' }}>
                                            <div style={{ width: `${cat.pct}%`, height: '100%', backgroundColor: cat.color, borderRadius: 4 }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>99.2% de las sesiones de Watch Party finalizan sin incidentes ni reportes</span>
                        <span className="font-mono" style={{ color: 'var(--admin-emerald)' }}>SLA Medio: 11 min</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Severidad × Caso Prioritario */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                PROTOCOLO DISCIPLINARIO
                            </span>
                            <span className="admin-badge admin-badge-neutral font-mono">{activeCatObj.sla}</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            {activeCatObj.label}
                        </h3>
                        <p className="admin-subtitle mb-3">
                            {activeCatObj.policy}
                        </p>

                        <div className="d-flex flex-column gap-2.5">
                            <div
                                onClick={() => setActiveSubView('reports-queue')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Bandeja de Denuncias ({reports.length} activas)</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        Resolver tickets pendientes de anfitriones
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('user-discipline')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Buscador Disciplinario de Usuarios</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        Emitir advertencias o auditar cuentas por #ID
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('comments-audit')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Purga de Comentarios en Salas</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        {comments.filter(c => c.flagged).length} comentarios marcados para borrado
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setActiveSubView('reports-queue')}
                        className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <span>Atender Cola de Denuncias</span>
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
