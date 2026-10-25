/**
 * Admin API Service — Conexión directa a Django REST Framework (AWS PostgreSQL)
 */

const API_BASE_URL = 'http://127.0.0.1:8000/api';

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
  created_at: string;
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

export interface RoomsResponse {
  total: number;
  rooms: RoomItem[];
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
  cohorts: Array<{
    cohort: string;
    w0: number;
    w1: number | null;
    w2: number | null;
    w3: number | null;
    w4: number | null;
  }>;
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
  const res = await fetch(`${API_BASE_URL}/admin/overview/?period=${period}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener overview`);
  return res.json();
}

export async function getRooms(phase = 'all'): Promise<RoomsResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/?phase=${phase}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener salas`);
  return res.json();
}

export async function pingRoom(roomId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/admin/rooms/${roomId}/ping/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al enviar ping`);
  return res.json();
}

export async function getAlgorithm(): Promise<AlgorithmResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/algorithm/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener algoritmo`);
  return res.json();
}

export async function calibrateAlgorithm(payload: {
  parameters: Record<string, number>;
  rules: AlgorithmRule[];
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/admin/algorithm/calibrate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al simular algoritmo`);
  return res.json();
}

export async function getGrowth(): Promise<GrowthResponse> {
  const res = await fetch(`${API_BASE_URL}/admin/growth/`);
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

  const res = await fetch(`${API_BASE_URL}/animes/?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: Error al obtener catálogo de animes`);
  return res.json();
}
