/**
 * Admin API Service — Conexión directa a Django REST Framework (AWS PostgreSQL)
 */

import { getAuthHeaders } from '../../services/authApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface OverviewTelemetryDay {
  day: string;
  completed: number;
  abandoned: number;
  total: number;
}

export interface OverviewResponse {
  summary: {
    total_rooms: number;
    active_rooms: number;
    concluded_rooms: number;
    total_members: number;
    total_votes: number;
    consensus_rate: number;
    avg_decision_time_minutes: number;
  };
  weekly_telemetry: OverviewTelemetryDay[];
  funnel: {
    guests_created: number;
    joined_room: number;
    voted: number;
    winner_selected: number;
  };
  health: {
    status: string;
    db_engine: string;
    total_animes: number;
    latency_ms: number;
    version: string;
  };
}

export interface RoomMember {
  name: string;
  role: string;
  channel: string;
}

export interface RoomItem {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  status: 'voting' | 'candidates' | 'selected' | 'watching' | 'completed';
  is_locked?: boolean;
  moderation_note?: string;
  created_at: string;
  created_display?: string;
  updated_at?: string;
  last_activity_display?: string;
  inactivity_hours?: number;
  inactivity_days?: number;
  age_days?: number;
  members_count: number;
  candidates_count: number;
  votes_count: number;
  quorum_percentage: number;
  top_candidate?: {
    title: string;
    score: number;
    image_url?: string;
  } | null;
  selected_anime?: {
    title: string;
    score?: number | null;
    image_url?: string;
  } | null;
  members: RoomMember[];
}

export interface RoomsCleanupPolicy {
  enabled: boolean;
  inactivity_threshold_days: number;
  target_status: string;
  min_members_protected: number;
  frequency: string;
  last_run?: string;
  last_purged_count?: number;
}

export interface RoomsResponse {
  total: number;
  unfiltered_total?: number;
  kpis?: {
    active_count: number;
    concluded_count: number;
    total_members: number;
    avg_quorum: number;
    idle_rooms_threshold_count: number;
  };
  cleanup_policy?: RoomsCleanupPolicy;
  rooms: RoomItem[];
}

export interface RoomsFilterParams {
  q?: string;
  phase?: string;
  members?: string;
  inactivity?: string;
  created?: string;
  quorum?: string;
  votes?: string;
  candidates?: string;
}

export interface AlgorithmRule {
  id: string;
  name: string;
  condition: string;
  effect: string;
  active: boolean;
}

export interface HappinessTimelinePoint {
  date: string;
  label: string;
  avg_happiness: number;
  rooms_count: number;
  consensus_rate: number;
  event?: string;
}

export interface RecommendationEvaluation {
  id: string;
  room_name: string;
  anime_title: string;
  rating: number;
  verdict: string;
  comment: string;
  happiness_score: number;
  time_ago: string;
}

export interface RecommendationSatisfaction {
  overall_satisfaction_pct: number;
  avg_rating: number;
  total_evaluations: number;
  acceptance_rate: number;
  breakdown: {
    excellent_pct: number;
    good_pct: number;
    poor_pct: number;
  };
  comparison: {
    algo_happiness: number;
    manual_happiness: number;
    time_to_consensus_algo: string;
    time_to_consensus_manual: string;
    conflict_rate_algo: string;
    conflict_rate_manual: string;
  };
  recent_feed: RecommendationEvaluation[];
}

export interface AlgorithmResponse {
  formula: string;
  parameters: {
    interest_mean_weight?: number;
    dispersion_weight_lambda: number;
    polarization_penalty_weight?: number;
    tie_break_threshold: number;
    mal_weight: number;
    genre_affinity_bonus?: number;
    popularity_weight?: number;
    marathon_bonus?: number;
  };
  stats: {
    total_votes_analyzed: number;
    avg_interest_score: number;
    total_catalog_size: number;
    average_group_happiness?: number;
    happiness_trend_delta?: string;
    high_consensus_rooms_pct?: number;
  };
  genre_dispersion: Record<string, { count: number; percentage: number }>;
  rules: AlgorithmRule[];
  timeline?: HappinessTimelinePoint[];
  recommendation_satisfaction?: RecommendationSatisfaction;
}

export interface UserVsGuestStats {
  registered_count: number;
  registered_pct: number;
  guest_count: number;
  guest_pct: number;
  conversion_rate_pct: number;
  avg_votes_registered: number;
  avg_votes_guest: number;
  retention_registered_pct: number;
  retention_guest_pct: number;
}

export interface ActivityRateTimelinePoint {
  day_label: string;
  day_offset: number;
  user_activity_pct: number;
  room_activity_pct: number;
  active_users: number;
  active_rooms: number;
}

export interface ActivityRateStats {
  user_activity_7d_pct: number;
  room_activity_7d_pct: number;
  avg_interaction_frequency_days: number;
  timeline: ActivityRateTimelinePoint[];
}

export interface AdminUserItem {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar_url: string;
  role: 'owner' | 'member' | 'guest';
  user_type: 'registered' | 'guest';
  status: 'active' | 'warned' | 'suspended';
  warnings: number;
  reason?: string;
  rooms_count: number;
  votes_count: number;
  joined_at: string;
  last_activity: string;
}

export interface AdminUsersResponse {
  total: number;
  users: AdminUserItem[];
}

export interface GrowthResponse {
  k_factor: number;
  total_users: number;
  total_hosts: number;
  total_guests: number;
  channels: {
    whatsapp: number;
    link: number;
    qr: number;
  };
  power_hosts: Array<{
    name: string;
    sessions_count: number;
    completion_rate: number;
  }>;
  cohorts?: Array<{
    cohort: string;
    w0: number;
    w1: number | null;
    w2: number | null;
    w3: number | null;
    w4: number | null;
  }>;
  user_vs_guest?: UserVsGuestStats;
  activity_rate?: ActivityRateStats;
}

export interface AnimeItem {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  score?: string | number | null;
  scored_by: number;
  popularity?: number | null;
  rank?: number | null;
  episodes?: number | null;
  duration?: string | number | null;
  status: string;
  season?: string;
  season_year?: number | null;
  studio?: string;
  genres: string[];
  type: string;
  image_url?: string;
  banner_url?: string;
}

export interface AnimesResponse {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: AnimeItem[];
}

// ----------------------------------------------------
// Métodos de llamada HTTP
// ----------------------------------------------------

export async function getOverview(period = '7d'): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/overview/?period=${period}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener overview`);
  return res.json();
}

export async function getRooms(params: RoomsFilterParams | string = 'all'): Promise<RoomsResponse> {
  const query = new URLSearchParams();
  if (typeof params === 'string') {
    if (params && params !== 'all') query.append('phase', params);
  } else if (params) {
    if (params.q) query.append('q', params.q);
    if (params.phase && params.phase !== 'all') query.append('phase', params.phase);
    if (params.members && params.members !== 'all') query.append('members', params.members);
    if (params.inactivity && params.inactivity !== 'all') query.append('inactivity', params.inactivity);
    if (params.created && params.created !== 'all') query.append('created', params.created);
    if (params.quorum && params.quorum !== 'all') query.append('quorum', params.quorum);
    if (params.votes && params.votes !== 'all') query.append('votes', params.votes);
    if (params.candidates && params.candidates !== 'all') query.append('candidates', params.candidates);
  }

  const res = await fetch(`${API_BASE_URL}/admin/rooms/?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener salas`);
  return res.json();
}

export async function pingRoom(roomId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/${roomId}/ping/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al enviar ping`);
  return res.json();
}

export async function moderateRoom(
  roomId: string,
  action: 'pause' | 'resume' | 'force_select' | 'reset_votes' | 'delete' | 'ping',
  reason?: string
): Promise<{ success: boolean; message: string; action: string; status?: string; is_locked?: boolean }> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/${roomId}/moderate/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ action, reason })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al moderar sala`);
  return res.json();
}

export async function getRoomsCleanupPolicy(): Promise<{
  policy: RoomsCleanupPolicy;
  matching_count: number;
  matching_rooms: any[];
}> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/cleanup-policy/`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener política de limpieza`);
  return res.json();
}

export async function saveRoomsCleanupPolicy(policy: Partial<RoomsCleanupPolicy>): Promise<{
  policy: RoomsCleanupPolicy;
  matching_count: number;
  matching_rooms: any[];
}> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/cleanup-policy/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(policy)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al guardar política de limpieza`);
  return res.json();
}

export async function runRoomsCleanup(): Promise<{
  success: boolean;
  purged_count: number;
  purged_rooms: any[];
  message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/cleanup-run/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al ejecutar limpieza de salas`);
  return res.json();
}

export async function getAlgorithm(): Promise<AlgorithmResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/algorithm/`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener algoritmo`);
  return res.json();
}

export async function calibrateAlgorithm(payload: {
  parameters: Record<string, number>;
  rules: AlgorithmRule[];
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/admin/algorithm/calibrate/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al calibrar algoritmo`);
  return res.json();
}

export async function simulateAlgorithmCalculation(payload: {
  votes: Array<{ voter_name: string; interest_score: number }>;
  mal_score?: number;
  mal_scored_by?: number;
  title?: string;
  episodes?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/admin/algorithm/simulate/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al simular algoritmo`);
  return res.json();
}

export async function getGrowth(): Promise<GrowthResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/growth/`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener métricas de crecimiento`);
  return res.json();
}

export async function getAnimes(params: {
  page?: number;
  q?: string;
  genre?: string;
  studio?: string;
  ordering?: string;
}): Promise<AnimesResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page.toString());
  if (params.q) query.append('q', params.q);
  if (params.genre) query.append('genre', params.genre);
  if (params.studio) query.append('studio', params.studio);
  if (params.ordering) query.append('ordering', params.ordering);

  const res = await fetch(`${API_BASE_URL}/animes/?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener catálogo de animes`);
  return res.json();
}

export async function getAdminUsers(params?: {
  q?: string;
  role?: string;
  status?: string;
}): Promise<AdminUsersResponse> {
  const query = new URLSearchParams();
  if (params?.q) query.append('q', params.q);
  if (params?.role && params.role !== 'all') query.append('role', params.role);
  if (params?.status && params.status !== 'all') query.append('status', params.status);

  const res = await fetch(`${API_BASE_URL}/admin/users/?${query.toString()}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener lista de usuarios`);
  return res.json();
}

export async function moderateAdminUser(
  userId: string,
  action: 'warn' | 'suspend' | 'activate' | 'kick',
  reason?: string
): Promise<{ status: string; message: string; user_id: string; moderation: any }> {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/moderate/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ action, reason })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al moderar usuario`);
  return res.json();
}

