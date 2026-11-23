import { getAuthHeaders } from './authApi'

const rawApi = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
const API_BASE_URL = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`

export type ReportContentType =
    | 'profile_wall'
    | 'chat_message'
    | 'recommendation'
    | 'suggestion'
    | 'poll'
    | 'other'

export type ReportCategory = 'toxicity' | 'spoilers' | 'spam' | 'other'

export interface CreateContentReportPayload {
    content_type: ReportContentType
    category: ReportCategory
    reason: string
    reported_username: string
    target_id?: string
    target_excerpt?: string
    context_label?: string
}

export interface CreateContentReportResponse {
    id: number
    already_reported: boolean
    message: string
}

export interface AdminReportTicket {
    id: string
    category: 'toxicity' | 'spoilers' | 'spam'
    contentType?: string
    reportedUserId: string
    reportedUserName: string
    reportedUserUsername?: string
    reportedUserEmail: string
    reportedUserAvatar: string
    reporterName: string
    reason: string
    context: string
    targetComment?: string
    timestamp: string
    severity: 'high' | 'medium' | 'low'
    status?: string
}

export async function submitContentReport(
    payload: CreateContentReportPayload
): Promise<CreateContentReportResponse> {
    const res = await fetch(`${API_BASE_URL}/users/reports/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(data.error || data.detail || 'No se pudo enviar el reporte.')
    }
    return data as CreateContentReportResponse
}

export async function fetchAdminReports(statusFilter = 'open'): Promise<AdminReportTicket[]> {
    const res = await fetch(
        `${API_BASE_URL}/users/admin/reports/?status=${encodeURIComponent(statusFilter)}`,
        {
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
        }
    )
    if (!res.ok) {
        throw new Error('No se pudieron cargar los reportes de moderación.')
    }
    const data = await res.json()
    return (data.reports || []) as AdminReportTicket[]
}

export async function resolveAdminReport(
    reportId: string,
    action: 'resolved' | 'dismissed' = 'resolved'
): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/admin/reports/${encodeURIComponent(reportId)}/resolve/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ action }),
    })
    if (!res.ok) {
        throw new Error('No se pudo actualizar el estado del reporte.')
    }
}
