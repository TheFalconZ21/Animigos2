import { useState, useEffect, useMemo } from 'react'
import {
    Users,
    UserCheck,
    Clock,
    Activity,
    RefreshCw,
    Search,
    Globe,
    Smartphone,
    Monitor,
    Shield,
    Plus,
    Trash2,
    ChevronRight
} from 'lucide-react'
import {
    getAdminUsers,
    getGrowth,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser
} from '../services/adminApi'
import type { AdminUserItem, GrowthResponse } from '../services/adminApi'
import { AdminSubViewBar, useAdminSubView, type SubViewOption } from '../components/AdminSubViewBar'

type UsersSubView = 'user-directory' | 'demographics' | 'create-user'

export function UsersPage() {
    const [users, setUsers] = useState<AdminUserItem[]>([])
    const [growthData, setGrowthData] = useState<GrowthResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const [activeSubView, setActiveSubView] = useAdminSubView<UsersSubView>()
    const [focusedTier, setFocusedTier] = useState<'high' | 'medium' | 'low'>('high')

    // Filtros en Sub-Vista Directorio
    const [searchQuery, setSearchQuery] = useState('')
    const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'registered' | 'guest'>('all')
    const [activityFilter, setActivityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

    // Estado de Creación en Sub-Vista
    const [createFormData, setCreateFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'user' as 'user' | 'admin',
        display_name: ''
    })
    const [isCreating, setIsCreating] = useState(false)
    const [feedback, setFeedback] = useState<string | null>(null)

    const loadData = async () => {
        setIsLoading(true)
        try {
            const [usersRes, growthRes] = await Promise.all([
                getAdminUsers(),
                getGrowth()
            ])
            setUsers(usersRes.users)
            setGrowthData(growthRes)
        } catch (err) {
            console.error('Error loading users:', err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const regUsersCount = users.filter(u => u.user_type === 'registered').length
    const guestUsersCount = users.filter(u => u.user_type === 'guest').length
    const totalUsers = users.length || (growthData?.user_vs_guest ? growthData.user_vs_guest.registered_count + growthData.user_vs_guest.guest_count : 0)

    const userVsGuest = growthData?.user_vs_guest || {
        registered_count: regUsersCount,
        registered_pct: totalUsers > 0 ? Number(((regUsersCount / totalUsers) * 100).toFixed(1)) : 0,
        guest_count: guestUsersCount,
        guest_pct: totalUsers > 0 ? Number(((guestUsersCount / totalUsers) * 100).toFixed(1)) : 0,
        conversion_rate_pct: totalUsers > 0 ? Number(((regUsersCount / totalUsers) * 100).toFixed(1)) : 0,
        avg_votes_registered: 0,
        avg_votes_guest: 0,
        retention_registered_pct: regUsersCount > 0 ? 100 : 0,
        retention_guest_pct: 0
    }

    const activeUsersCount = users.filter(u => u.status === 'active').length
    const dauCount = activeUsersCount
    const wauCount = totalUsers

    const demographicsStats = useMemo(() => {
        const reg = users.filter(u => u.user_type === 'registered')
        const totalReg = reg.length || 1
        const currentYear = new Date().getFullYear()

        // Países y ciudades
        const countryMap = new Map<string, { count: number; cities: Set<string> }>()
        for (const u of reg) {
            const c = (u.country || '').trim() || 'Sin especificar'
            const entry = countryMap.get(c) || { count: 0, cities: new Set<string>() }
            entry.count += 1
            if (u.city) entry.cities.add(u.city)
            countryMap.set(c, entry)
        }
        const countries = Array.from(countryMap.entries())
            .map(([name, info]) => ({
                name,
                count: info.count,
                pct: Math.round((info.count / totalReg) * 100),
                cities: Array.from(info.cities).slice(0, 3),
            }))
            .sort((a, b) => {
                if (a.name === 'Sin especificar') return 1
                if (b.name === 'Sin especificar') return -1
                return b.count - a.count
            })

        // Rangos etarios
        const ageBuckets: Record<string, number> = {
            '< 18 años': 0,
            '18 – 24 años': 0,
            '25 – 34 años': 0,
            '35+ años': 0,
            'Sin especificar': 0,
        }
        for (const u of reg) {
            if (!u.birth_year) {
                ageBuckets['Sin especificar'] += 1
            } else {
                const age = currentYear - u.birth_year
                if (age < 18) ageBuckets['< 18 años'] += 1
                else if (age <= 24) ageBuckets['18 – 24 años'] += 1
                else if (age <= 34) ageBuckets['25 – 34 años'] += 1
                else ageBuckets['35+ años'] += 1
            }
        }
        const ages = Object.entries(ageBuckets).map(([label, count]) => ({
            label,
            count,
            pct: Math.round((count / totalReg) * 100),
        }))

        // Género
        const genderLabels: Record<string, string> = {
            male: 'Masculino',
            female: 'Femenino',
            non_binary: 'No binario',
            other: 'Otro',
            prefer_not_to_say: 'Prefiere no decirlo',
            '': 'Sin especificar',
        }
        const genderMap = new Map<string, number>()
        for (const u of reg) {
            const label = genderLabels[u.gender || ''] || 'Otro'
            genderMap.set(label, (genderMap.get(label) || 0) + 1)
        }
        const genders = Array.from(genderMap.entries())
            .map(([label, count]) => ({
                label,
                count,
                pct: Math.round((count / totalReg) * 100),
            }))
            .sort((a, b) => b.count - a.count)

        const googleCount = reg.filter(u => u.auth_provider === 'google').length
        const emailCount = reg.length - googleCount

        return {
            totalRegistered: reg.length,
            countries,
            ages,
            genders,
            googleCount,
            emailCount,
            googlePct: Math.round((googleCount / totalReg) * 100),
            emailPct: Math.round((emailCount / totalReg) * 100),
        }
    }, [users])

    const activityTiers = useMemo(() => {
        const highUsers = users.filter(u => u.votes_count >= 10 || u.rooms_count >= 4)
        const mediumUsers = users.filter(u => !(u.votes_count >= 10 || u.rooms_count >= 4) && u.votes_count >= 3)
        const lowUsers = users.filter(u => !(u.votes_count >= 10 || u.rooms_count >= 4) && u.votes_count < 3)

        const buildTier = (id: 'high' | 'medium' | 'low', label: string, subset: AdminUserItem[], color: string, insight: string) => {
            const count = subset.length
            const totalShare = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
            const regInTier = subset.filter(u => u.user_type === 'registered').length
            const gstInTier = subset.filter(u => u.user_type === 'guest').length
            const registeredPct = count > 0 ? Math.round((regInTier / count) * 100) : 0
            const guestPct = count > 0 ? Math.round((gstInTier / count) * 100) : 0
            return { id, label, registeredPct, guestPct, totalShare, count, color, insight }
        }

        return [
            buildTier(
                'high',
                'Power Users (Alta Actividad · ≥10 votos)',
                highUsers,
                'var(--admin-emerald)',
                'Usuarios con mayor participación en votaciones, listas personales y creación de salas.'
            ),
            buildTier(
                'medium',
                'Participantes Regulares (Actividad Media · 3 a 9 votos)',
                mediumUsers,
                'var(--admin-focus)',
                'Miembros con actividad regular en salas grupales o listas de seguimiento.'
            ),
            buildTier(
                'low',
                'Ocasionales / Nuevos Ingresos (0 a 2 votos)',
                lowUsers,
                'var(--admin-amber)',
                'Cuentas recién registradas o invitados temporales con baja emisión de votos.'
            )
        ]
    }, [users, totalUsers])

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesQuery = !searchQuery ||
                u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesType = userTypeFilter === 'all' || u.user_type === userTypeFilter

            let matchesActivity = true
            if (activityFilter === 'high') matchesActivity = (u.votes_count >= 10 || u.rooms_count >= 4)
            else if (activityFilter === 'medium') matchesActivity = (u.votes_count >= 3 && u.votes_count < 10)
            else if (activityFilter === 'low') matchesActivity = (u.votes_count < 3)

            return matchesQuery && matchesType && matchesActivity
        })
    }, [users, searchQuery, userTypeFilter, activityFilter])

    const handleToggleRole = async (user: AdminUserItem) => {
        const nextRole = (user.role === 'owner' || (user.role as string) === 'admin') ? 'user' : 'admin'
        try {
            await updateAdminUser(user.id, { role: nextRole })
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: nextRole === 'admin' ? 'owner' : 'member' } : u))
        } catch (err: any) {
            setFeedback(err.message || 'Error al cambiar rol')
        }
    }

    const handleDeleteUser = async (user: AdminUserItem) => {
        try {
            await deleteAdminUser(user.id)
            setUsers(prev => prev.filter(u => u.id !== user.id))
            setFeedback(`Usuario @${user.username} eliminado correctamente`)
            setTimeout(() => setFeedback(null), 3000)
        } catch (err: any) {
            setFeedback(err.message || 'Error al eliminar usuario')
        }
    }

    const handleCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!createFormData.username.trim() || !createFormData.password.trim()) return
        setIsCreating(true)
        try {
            const res = await createAdminUser(createFormData)
            setUsers(prev => [res.user, ...prev])
            setCreateFormData({ username: '', email: '', password: '', role: 'user', display_name: '' })
            setActiveSubView('user-directory')
        } catch (err: any) {
            setFeedback(err.message || 'Error al crear usuario')
        } finally {
            setIsCreating(false)
        }
    }

    const subViewOptions: SubViewOption<UsersSubView>[] = [
        { id: 'user-directory', label: 'Directorio de Usuarios', badge: `${filteredUsers.length}` },
        { id: 'demographics', label: 'Demografía, Países & Dispositivos' },
        { id: 'create-user', label: '+ Nuevo Usuario' }
    ]

    // ============================================================
    // NIVEL 2: SUB-VISTAS INTEGRADAS A PANTALLA COMPLETA
    // ============================================================
    if (activeSubView) {
        return (
            <div className="admin-viewport-shell admin-anim-subview">
                <AdminSubViewBar
                    sectionTitle="Usuarios & Demografía"
                    activeSubView={activeSubView}
                    options={subViewOptions}
                    onSelectSubView={setActiveSubView}
                    onBack={() => setActiveSubView(null)}
                />

                {feedback && (
                    <div className="admin-correlative-bridge">
                        <span className="text-white">{feedback}</span>
                    </div>
                )}

                {/* SUB-VISTA 1: DIRECTORIO OPERATIVO DE USUARIOS */}
                {activeSubView === 'user-directory' && (
                    <div className="admin-card flex-grow-1 d-flex flex-column justify-content-between">
                        <div>
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                <div>
                                    <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                        Directorio de Cuentas Reales e Invitados ({filteredUsers.length})
                                    </h2>
                                    <span className="admin-subtitle">
                                        Filtra por tipo de cuenta o nivel de actividad y administra permisos
                                    </span>
                                </div>

                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    <div className="admin-input-wrapper d-flex align-items-center gap-2">
                                        <Search size={14} style={{ color: 'var(--admin-text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar nombre, @user o email..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-transparent border-0 text-white"
                                            style={{ fontSize: '0.8rem', outline: 'none', width: 200 }}
                                        />
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {[
                                            { id: 'all', label: 'Todos' },
                                            { id: 'registered', label: 'Registrados' },
                                            { id: 'guest', label: 'Invitados' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setUserTypeFilter(t.id as any)}
                                                className={`admin-subview-pill ${userTypeFilter === t.id ? 'active' : ''}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="admin-subview-switcher">
                                        {[
                                            { id: 'all', label: 'Act: Todas' },
                                            { id: 'high', label: 'Alta' },
                                            { id: 'medium', label: 'Media' },
                                            { id: 'low', label: 'Baja' }
                                        ].map(a => (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => setActivityFilter(a.id as any)}
                                                className={`admin-subview-pill ${activityFilter === a.id ? 'active' : ''}`}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                                <table className="table table-dark table-hover m-0 align-middle" style={{ fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                                            <th>USUARIO</th>
                                            <th>TIPO DE CUENTA</th>
                                            <th>ROL</th>
                                            <th className="text-center">SALAS / VOTOS</th>
                                            <th>ÚLTIMA ACTIVIDAD</th>
                                            <th className="text-end">ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.slice(0, 20).map(u => {
                                            const isAdmin = u.role === 'owner' || (u.role as string) === 'admin'
                                            return (
                                                <tr key={u.id} className="border-bottom" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2.5">
                                                            <img
                                                                src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                                                                alt={u.name}
                                                                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                                                            />
                                                            <div>
                                                                <div className="text-white fw-semibold">{u.name}</div>
                                                                <span className="font-mono" style={{ color: 'var(--admin-text-muted)', fontSize: '0.74rem' }}>
                                                                    @{u.username} • {u.email}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {u.user_type === 'registered' ? (
                                                            <span className="admin-badge admin-badge-info">Registrado</span>
                                                        ) : (
                                                            <span className="admin-badge admin-badge-neutral">Invitado (Guest)</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleRole(u)}
                                                            className={`admin-badge border-0 ${isAdmin ? 'admin-badge-success' : 'admin-badge-neutral'}`}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <Shield size={11} className="me-1" />
                                                            {isAdmin ? 'Administrador' : 'Miembro'}
                                                        </button>
                                                    </td>
                                                    <td className="text-center font-mono">
                                                        <strong className="text-white">{u.rooms_count}</strong> salas • <span style={{ color: 'var(--admin-focus)' }}>{u.votes_count} votos</span>
                                                    </td>
                                                    <td style={{ color: 'var(--admin-text-secondary)' }}>{u.last_activity}</td>
                                                    <td className="text-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteUser(u)}
                                                            className="admin-btn admin-btn-secondary text-danger d-inline-flex align-items-center gap-1"
                                                        >
                                                            <Trash2 size={12} />
                                                            <span>Eliminar</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                            <span>Mostrando {Math.min(20, filteredUsers.length)} de {filteredUsers.length} usuarios</span>
                            <button
                                type="button"
                                onClick={() => setActiveSubView('create-user')}
                                className="admin-btn d-inline-flex align-items-center gap-1.5"
                                style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                            >
                                <Plus size={14} />
                                <span>Nuevo Usuario</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 2: DEMOGRAFÍA REAL, PAÍSES, EDAD, GÉNERO Y MÉTODO DE REGISTRO */}
                {activeSubView === 'demographics' && (
                    <div className="row g-3">
                        {/* Países y Ciudades (Detección IP + Onboarding) */}
                        <div className="col-12 col-lg-6">
                            <div className="admin-card h-100">
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                                    <div className="d-flex align-items-center gap-2">
                                        <Globe size={16} style={{ color: 'var(--admin-focus)' }} />
                                        <h3 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>Países y Ubicación (PostgreSQL)</h3>
                                    </div>
                                    <span className="admin-subtitle">{demographicsStats.totalRegistered} cuentas</span>
                                </div>
                                <div className="d-flex flex-column gap-2.5">
                                    {demographicsStats.countries.map(c => (
                                        <div key={c.name} className="p-2.5 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <div>
                                                    <span className="text-white fw-medium">{c.name}</span>
                                                    {c.cities.length > 0 && (
                                                        <span className="admin-subtitle ms-2" style={{ fontSize: '0.72rem' }}>
                                                            ({c.cities.join(', ')})
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-mono text-white fw-bold">{c.count} ({c.pct}%)</span>
                                            </div>
                                            <div className="w-100 rounded overflow-hidden" style={{ height: 7, backgroundColor: 'var(--admin-surface-3)' }}>
                                                <div style={{ width: `${c.pct}%`, height: '100%', backgroundColor: c.name === 'Sin especificar' ? 'var(--admin-text-muted)' : 'var(--admin-focus)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Rangos de Edad y Género */}
                        <div className="col-12 col-lg-6">
                            <div className="admin-card h-100 d-flex flex-column gap-4">
                                <div>
                                    <h3 className="admin-title mb-2.5" style={{ fontSize: '1.05rem' }}>Rangos de Edad (Voluntario)</h3>
                                    <div className="d-flex flex-column gap-2">
                                        {demographicsStats.ages.map(ag => (
                                            <div key={ag.label} className="p-2 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                                <div className="d-flex justify-content-between mb-1">
                                                    <span className="text-white small">{ag.label}</span>
                                                    <span className="font-mono text-white small fw-bold">{ag.count} ({ag.pct}%)</span>
                                                </div>
                                                <div className="w-100 rounded overflow-hidden" style={{ height: 6, backgroundColor: 'var(--admin-surface-3)' }}>
                                                    <div style={{ width: `${ag.pct}%`, height: '100%', backgroundColor: ag.label === 'Sin especificar' ? 'var(--admin-text-muted)' : 'var(--admin-emerald)' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="admin-title mb-2" style={{ fontSize: '0.95rem' }}>Distribución por Género</h4>
                                    <div className="d-flex flex-wrap gap-2">
                                        {demographicsStats.genders.map(g => (
                                            <div
                                                key={g.label}
                                                className="px-3 py-2 rounded-2 d-flex align-items-center gap-2"
                                                style={{ backgroundColor: 'var(--admin-surface-2)', border: '1px solid var(--admin-border)' }}
                                            >
                                                <span className="small text-white">{g.label}</span>
                                                <strong className="font-mono small" style={{ color: 'var(--admin-focus)' }}>
                                                    {g.count} ({g.pct}%)
                                                </strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Método de Registro (Google vs Correo) + Roles */}
                        <div className="col-12 col-lg-6">
                            <div className="admin-card h-100">
                                <h3 className="admin-title mb-3" style={{ fontSize: '1.05rem' }}>Método de Registro & Roles</h3>
                                <div className="row g-3 mb-3">
                                    <div className="col-6">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <div className="text-white fw-semibold small mb-1">Google Sign-In</div>
                                            <div className="admin-kpi-value" style={{ color: 'var(--admin-emerald)' }}>{demographicsStats.googlePct}%</div>
                                            <span className="admin-subtitle">{demographicsStats.googleCount} cuentas Google</span>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <div className="text-white fw-semibold small mb-1">Correo / Clave</div>
                                            <div className="admin-kpi-value" style={{ color: 'var(--admin-focus)' }}>{demographicsStats.emailPct}%</div>
                                            <span className="admin-subtitle">{demographicsStats.emailCount} cuentas correo</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="d-flex flex-column gap-2">
                                    {[
                                        { name: 'Administradores / Anfitriones (Owner)', count: users.filter(u => u.role === 'owner').length },
                                        { name: 'Miembros Registrados (Member)', count: users.filter(u => u.role === 'member').length },
                                        { name: 'Invitados Temporales (Guest)', count: users.filter(u => u.role === 'guest').length }
                                    ].map(c => (
                                        <div key={c.name} className="p-2 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                            <span className="small text-white">{c.name}</span>
                                            <strong className="font-mono small text-white">{c.count}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Tipo de Sesión y Estado Operativo */}
                        <div className="col-12 col-lg-6">
                            <div className="admin-card h-100 d-flex flex-column justify-content-between">
                                <div>
                                    <h3 className="admin-title mb-3" style={{ fontSize: '1.05rem' }}>Tipo de Sesión & Estado de Cuenta</h3>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                                <div className="d-flex align-items-center gap-2 text-white fw-semibold mb-1">
                                                    <Monitor size={15} style={{ color: 'var(--admin-focus)' }} />
                                                    <span>Cuentas Reales</span>
                                                </div>
                                                <div className="admin-kpi-value" style={{ color: 'var(--admin-focus)' }}>{userVsGuest.registered_pct}%</div>
                                                <span className="admin-subtitle">{userVsGuest.registered_count} usuarios registrados</span>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="p-3 rounded-2" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                                <div className="d-flex align-items-center gap-2 text-white fw-semibold mb-1">
                                                    <Smartphone size={15} style={{ color: 'var(--admin-emerald)' }} />
                                                    <span>Sesión Invitado</span>
                                                </div>
                                                <div className="admin-kpi-value" style={{ color: 'var(--admin-emerald)' }}>{userVsGuest.guest_pct}%</div>
                                                <span className="admin-subtitle">{userVsGuest.guest_count} invitados en salas</span>
                                            </div>
                                        </div>
                                    </div>

                                    <h4 className="admin-title mb-2" style={{ fontSize: '0.92rem' }}>Estado Operativo</h4>
                                    <div className="d-flex flex-column gap-2">
                                        {[
                                            { range: 'Cuentas Activas', count: users.filter(u => u.status === 'active').length, color: 'var(--admin-emerald)' },
                                            { range: 'Cuentas con Advertencia', count: users.filter(u => u.status === 'warned' || u.warnings > 0).length, color: 'var(--admin-amber)' },
                                            { range: 'Cuentas Suspendidas', count: users.filter(u => u.status === 'suspended').length, color: 'var(--admin-rose)' }
                                        ].map(ag => (
                                            <div key={ag.range} className="p-2.5 rounded-2 d-flex justify-content-between align-items-center" style={{ backgroundColor: 'var(--admin-surface-2)' }}>
                                                <span className="text-white">{ag.range}</span>
                                                <strong className="font-mono" style={{ color: ag.color }}>{ag.count} usuarios</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-VISTA 3: CREAR USUARIO */}
                {activeSubView === 'create-user' && (
                    <div className="admin-card" style={{ maxWidth: 620, margin: '0 auto', width: '100%' }}>
                        <h2 className="admin-title mb-1" style={{ fontSize: '1.15rem' }}>Registrar Nueva Cuenta de Usuario</h2>
                        <p className="admin-subtitle mb-3">Crea un usuario verificado o administrador en AWS PostgreSQL</p>

                        <form onSubmit={handleCreateUserSubmit} className="row g-3">
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={createFormData.username}
                                    onChange={(e) => setCreateFormData({ ...createFormData, username: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Nombre Visible</label>
                                <input
                                    type="text"
                                    value={createFormData.display_name}
                                    onChange={(e) => setCreateFormData({ ...createFormData, display_name: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={createFormData.email}
                                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="admin-kpi-kicker d-block mb-1">Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    value={createFormData.password}
                                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                                    className="form-control bg-dark text-white border-secondary"
                                />
                            </div>
                            <div className="col-12 d-flex justify-content-end gap-2 pt-2">
                                <button type="button" onClick={() => setActiveSubView(null)} className="admin-btn admin-btn-secondary">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="admin-btn"
                                    style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                                >
                                    {isCreating ? 'Creando...' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================
    // NIVEL 1: VISTA PRINCIPAL CERO-SCROLL (PANORAMA VITAL)
    // ============================================================
    const activeTierObj = activityTiers.find(t => t.id === focusedTier) || activityTiers[0]

    return (
        <div className="admin-viewport-shell">
            {/* Header Ejecutivo */}
            <div className="admin-section-header">
                <div>
                    <h1 className="admin-title m-0" style={{ fontSize: '1.3rem' }}>
                        Audiencia, Cuentas Reales vs. Invitados & Demografía
                    </h1>
                    <p className="admin-subtitle m-0 mt-1">
                        Composición de usuarios, conversión de sesiones temporales a cuentas permanentes y nivel de actividad
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubView('demographics')}
                        className="admin-btn admin-btn-secondary d-flex align-items-center gap-1.5 text-white"
                    >
                        <Globe size={14} style={{ color: 'var(--admin-focus)' }} />
                        <span>Mapa Demográfico</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setUserTypeFilter('all')
                            setActivityFilter('all')
                            setActiveSubView('user-directory')
                        }}
                        className="admin-btn d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <Users size={14} />
                        <span>Directorio de Cuentas</span>
                    </button>
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={isLoading}
                        className="admin-btn admin-btn-secondary"
                    >
                        <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 4 KPIs Vitales (Click para ir a Sub-Vista) */}
            <div className="admin-kpis-inline-grid cols-4">
                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setUserTypeFilter('all')
                        setActiveSubView('user-directory')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Audiencia Total</span>
                        <span className="admin-badge admin-badge-success font-mono">En Vivo</span>
                    </div>
                    <div className="admin-kpi-value my-1">{totalUsers.toLocaleString()}</div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Abrir directorio general</span>
                            <ChevronRight size={13} />
                        </span>
                        <Users size={15} style={{ color: 'var(--admin-focus)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setUserTypeFilter('registered')
                        setActiveSubView('user-directory')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Cuentas Registradas</span>
                        <span className="admin-badge admin-badge-info font-mono">Auth BD</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{userVsGuest.registered_count}</span>
                        <span className="font-mono" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>({userVsGuest.registered_pct}%)</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Filtrar cuentas reales</span>
                            <ChevronRight size={13} />
                        </span>
                        <UserCheck size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => {
                        setUserTypeFilter('guest')
                        setActiveSubView('user-directory')
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Invitados (Guest)</span>
                        <span className="admin-badge admin-badge-neutral font-mono">Salas</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{userVsGuest.guest_count}</span>
                        <span className="font-mono" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.84rem' }}>({userVsGuest.guest_pct}%)</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Auditar invitados</span>
                            <ChevronRight size={13} />
                        </span>
                        <Clock size={15} style={{ color: 'var(--admin-amber)' }} />
                    </div>
                </div>

                <div
                    className="admin-card admin-kpi-clickable"
                    onClick={() => setActiveSubView('demographics')}
                    role="button"
                    tabIndex={0}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <span className="admin-kpi-kicker">Cuentas Activas</span>
                        <span className="admin-badge admin-badge-success font-mono">{totalUsers > 0 ? Math.round((dauCount / totalUsers) * 100) : 0}%</span>
                    </div>
                    <div className="d-flex align-baseline gap-2 my-1">
                        <span className="admin-kpi-value">{dauCount}</span>
                        <span className="font-mono" style={{ color: 'var(--admin-text-secondary)', fontSize: '0.82rem' }}>/ {wauCount} total</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                        <span className="admin-kpi-drill-pill">
                            <span>Ver países & dispositivos</span>
                            <ChevronRight size={13} />
                        </span>
                        <Activity size={15} style={{ color: 'var(--admin-emerald)' }} />
                    </div>
                </div>
            </div>

            {/* ESCENARIO PROTAGONISTA: Matriz de Actividad (Registrados vs Invitados) + Cruce de Conversión */}
            <div className="admin-protagonist-stage">
                <div className="admin-chart-stage">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="admin-title m-0" style={{ fontSize: '1.05rem' }}>
                                Pirámide de Compromiso: Registrados vs. Invitados
                            </h2>
                            <span className="admin-badge admin-badge-info">Click para explorar segmento</span>
                        </div>

                        <div className="d-flex flex-column my-2" style={{ gap: '1.35rem' }}>
                            {activityTiers.map(tier => {
                                const isFocused = focusedTier === tier.id
                                return (
                                    <div
                                        key={tier.id}
                                        onMouseEnter={() => setFocusedTier(tier.id)}
                                        onClick={() => {
                                            setActivityFilter(tier.id)
                                            setActiveSubView('user-directory')
                                        }}
                                        className="admin-chart-interactive-node"
                                        style={{
                                            padding: '1.15rem 1.35rem',
                                            borderRadius: 14,
                                            backgroundColor: isFocused ? 'var(--admin-surface-3)' : 'var(--admin-surface-2)',
                                            border: isFocused ? `1px solid ${tier.color}` : '1px solid var(--admin-border-subtle)'
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '0.75rem' }}>
                                            <span className="text-white fw-semibold" style={{ fontSize: '0.9rem' }}>{tier.label}</span>
                                            <div className="d-flex align-items-center gap-2 font-mono">
                                                <strong className="text-white" style={{ fontSize: '0.95rem' }}>{tier.count} usuarios ({tier.totalShare}%)</strong>
                                                <ChevronRight size={15} style={{ color: isFocused ? 'var(--admin-focus)' : 'var(--admin-text-muted)' }} />
                                            </div>
                                        </div>

                                        <div className="d-flex rounded overflow-hidden" style={{ height: 10, backgroundColor: 'var(--admin-surface-1)', marginBottom: '0.75rem' }}>
                                            <div style={{ width: `${tier.registeredPct}%`, backgroundColor: 'var(--admin-focus)' }} title={`Registrados: ${tier.registeredPct}%`} />
                                            <div style={{ width: `${tier.guestPct}%`, backgroundColor: 'var(--admin-amber)' }} title={`Invitados: ${tier.guestPct}%`} />
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center font-mono" style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                                            <span className="d-inline-flex align-items-center gap-2">
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-focus)', display: 'inline-block' }} />
                                                <span>Registrados: <strong className="text-white">{tier.registeredPct}%</strong></span>
                                            </span>
                                            <span className="d-inline-flex align-items-center gap-2">
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--admin-amber)', display: 'inline-block' }} />
                                                <span>Invitados: <strong className="text-white">{tier.guestPct}%</strong></span>
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="pt-3 mt-2 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--admin-border-subtle)', fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                        <span>Media de votos: <strong className="text-white font-mono">{userVsGuest.avg_votes_registered}</strong> (registrados) vs. <strong className="text-white font-mono">{userVsGuest.avg_votes_guest}</strong> (invitados)</span>
                        <span className="font-mono" style={{ color: 'var(--admin-emerald)' }}>Cuentas reales: {userVsGuest.registered_pct}%</span>
                    </div>
                </div>

                {/* Panel Derecho: Cruce de Decisión sobre el Segmento Enfoque */}
                <div className="admin-decision-panel">
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="admin-kpi-kicker" style={{ color: 'var(--admin-focus)' }}>
                                DIAGNÓSTICO DE SEGMENTO
                            </span>
                            <span className="admin-badge admin-badge-neutral font-mono">{activeTierObj.totalShare}% de la base</span>
                        </div>
                        <h3 className="admin-title mb-2" style={{ fontSize: '1rem' }}>
                            {activeTierObj.label.split('(')[0].trim()}
                        </h3>
                        <p className="admin-subtitle mb-3">
                            {activeTierObj.insight}
                        </p>

                        <div className="d-flex flex-column gap-2.5">
                            <div
                                onClick={() => setActiveSubView('demographics')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Desglose por Rol y Tipo de Cuenta</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        {userVsGuest.registered_count} registrados • {userVsGuest.guest_count} invitados
                                    </span>
                                </div>
                                <ChevronRight size={15} style={{ color: 'var(--admin-focus)' }} />
                            </div>

                            <div
                                onClick={() => setActiveSubView('create-user')}
                                className="admin-decision-item clickable d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <div className="text-white fw-semibold" style={{ fontSize: '0.84rem' }}>Alta Manual de Cuentas y Administradores</div>
                                    <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>
                                        Gestiona roles y accesos de moderación
                                    </span>
                                </div>
                                <Plus size={15} style={{ color: 'var(--admin-emerald)' }} />
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setActivityFilter(activeTierObj.id)
                            setActiveSubView('user-directory')
                        }}
                        className="admin-btn w-100 d-flex align-items-center justify-content-between py-2"
                        style={{ backgroundColor: 'var(--admin-focus)', color: '#090B10', fontWeight: 600 }}
                    >
                        <span>Ver Usuarios de este Segmento</span>
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
