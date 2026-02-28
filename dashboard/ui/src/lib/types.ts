// ── Auth ──

export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  password?: string;
}

// ── Projects ──

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  qdrant_collection: string;
  neo4j_database: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  role: string;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
}

export interface CreateProjectRequest {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export interface AddMemberRequest {
  email: string;
  role: "admin" | "editor" | "viewer";
}

export interface UpdateMemberRequest {
  role: "admin" | "editor" | "viewer";
}

export interface ProjectConfig {
  llm_config: Record<string, unknown>;
  embedder_config: Record<string, unknown>;
  vector_store_config: Record<string, unknown>;
  graph_store_config: Record<string, unknown>;
  updated_at: string;
}

export interface UpdateConfigRequest {
  llm_config?: Record<string, unknown>;
  embedder_config?: Record<string, unknown>;
  vector_store_config?: Record<string, unknown>;
  graph_store_config?: Record<string, unknown>;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

// ── Memories ──

export interface Memory {
  id: string;
  content: string;
  mem0_user_id: string;
  mem0_agent_id?: string | null;
  mem0_run_id?: string | null;
  metadata_?: Record<string, unknown> | null;
  categories?: string[];
  score?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryListResponse {
  items: Memory[];
  total: number;
  page: number;
  page_size: number;
}

export interface MemoryListParams {
  page?: number;
  page_size?: number;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
}

export interface AddMemoryRequest {
  messages: Array<{ role: string; content: string }>;
  user_id: string;
  agent_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryRequest {
  content?: string;
}

export interface SearchMemoryRequest {
  query: string;
  user_id?: string;
  agent_id?: string;
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  content: string;
  score?: number | null;
  mem0_user_id?: string | null;
  metadata_?: Record<string, unknown> | null;
}

export interface MemoryHistory {
  id: string;
  content: string;
  metadata_?: Record<string, unknown> | null;
  changed_by?: string | null;
  changed_at: string;
}

export interface BulkDeleteRequest {
  ids?: string[];
  user_id?: string;
}

export interface ExportRequest {
  format: "json" | "csv";
}

// ── Analytics ──

export interface TopUser {
  user_id: string;
  memory_count: number;
}

export interface Overview {
  total_memories: number;
  total_users: number;
  growth_rate_7d: number;
  top_users: TopUser[];
}

export interface UsagePoint {
  date: string;
  count: number;
  action: string;
}

export interface UsageResponse {
  data: UsagePoint[];
  interval: string;
}

export interface RetrievalResponse {
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  total_searches: number;
}

export interface AnalyticsParams {
  period?: "7d" | "30d" | "90d";
  start_date?: string;
  end_date?: string;
}

// ── Webhooks ──

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  created_at: string;
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  is_active?: boolean;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  is_active?: boolean;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  attempt_count: number;
  delivered_at: string | null;
  created_at: string;
}

// ── Graph ──

export interface Entity {
  name: string;
  type?: string | null;
  properties?: Record<string, unknown>;
  relation_count?: number;
}

export interface EntityListResponse {
  items: Entity[];
  total: number;
  page: number;
  page_size: number;
}

export interface EntityDetail {
  name: string;
  type?: string | null;
  properties?: Record<string, unknown>;
  relations?: Relation[];
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface SubgraphResponse {
  entities: Entity[];
  relations: Relation[];
}

export interface GraphListParams {
  page?: number;
  page_size?: number;
  type?: string;
}

// ── Admin ──

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  is_superadmin?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  is_active?: boolean;
  is_superadmin?: boolean;
}

export interface AdminUserParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: string;
  project_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogParams {
  page?: number;
  page_size?: number;
  action?: string;
}

export interface PlatformStats {
  total_users: number;
  active_users: number;
  total_projects: number;
  total_memories: number;
  total_api_calls: number;
}

// ── Generic ──

export interface ApiError {
  detail: string;
  status_code: number;
}

export interface PaginatedParams {
  page?: number;
  page_size?: number;
}
