import type {
  User,
  TokenResponse,
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  Project,
  ProjectListResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  Member,
  AddMemberRequest,
  UpdateMemberRequest,
  ProjectConfig,
  UpdateConfigRequest,
  TestConnectionResponse,
  Memory,
  MemoryListResponse,
  MemoryListParams,
  AddMemoryRequest,
  UpdateMemoryRequest,
  SearchMemoryRequest,
  SearchResult,
  MemoryHistory,
  BulkDeleteRequest,
  Overview,
  UsageResponse,
  RetrievalResponse,
  AnalyticsParams,
  Webhook,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  WebhookDelivery,
  EntityListResponse,
  EntityDetail,
  Relation,
  SubgraphResponse,
  GraphListParams,
  AdminUser,
  CreateUserRequest,
  UpdateUserRequest,
  AdminUserParams,
  AuditLog,
  AuditLogParams,
  PlatformStats,
} from "./types";

const BASE_URL = "";

// ── Token storage (in-memory only) ──

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshTokenValue = refresh;
}

export function clearTokens() {
  accessToken = null;
  refreshTokenValue = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Core fetch wrapper ──

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

async function doRefresh(): Promise<void> {
  if (!refreshTokenValue) throw new Error("No refresh token");
  const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  });
  if (!res.ok) {
    clearTokens();
    throw new Error("Session expired");
  }
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && auth && retry && refreshTokenValue) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = doRefresh().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }
    await refreshPromise;
    return request<T>(path, options, auth, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(body.detail ?? "Request failed"), {
      status_code: res.status,
      detail: body.detail,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function uploadRequest<T>(
  path: string,
  body: FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail ?? "Upload failed"), {
      status_code: res.status,
      detail: err.detail,
    });
  }

  return res.json() as Promise<T>;
}

// ── Auth ──

export async function register(
  email: string,
  name: string,
  password: string,
): Promise<User> {
  return request<User>(
    "/api/v1/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, name, password } satisfies RegisterRequest),
    },
    false,
  );
}

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const data = await request<TokenResponse>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password } satisfies LoginRequest),
    },
    false,
  );
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function refreshToken(): Promise<void> {
  await doRefresh();
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/api/v1/auth/logout", { method: "POST" });
  } finally {
    clearTokens();
  }
}

export async function getProfile(): Promise<User> {
  return request<User>("/api/v1/auth/me");
}

export async function updateProfile(
  data: UpdateProfileRequest,
): Promise<User> {
  return request<User>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Projects ──

export async function listProjects(): Promise<ProjectListResponse> {
  return request<ProjectListResponse>("/api/v1/projects");
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<Project> {
  return request<Project>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProject(slug: string): Promise<Project> {
  return request<Project>(`/api/v1/projects/${slug}`);
}

export async function updateProject(
  slug: string,
  data: UpdateProjectRequest,
): Promise<Project> {
  return request<Project>(`/api/v1/projects/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function archiveProject(slug: string): Promise<void> {
  return request<void>(`/api/v1/projects/${slug}`, { method: "DELETE" });
}

// Members

export async function listMembers(slug: string): Promise<Member[]> {
  return request<Member[]>(`/api/v1/projects/${slug}/members`);
}

export async function addMember(
  slug: string,
  email: string,
  role: AddMemberRequest["role"],
): Promise<Member> {
  return request<Member>(`/api/v1/projects/${slug}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role } satisfies AddMemberRequest),
  });
}

export async function updateMember(
  slug: string,
  userId: string,
  role: AddMemberRequest["role"],
): Promise<Member> {
  return request<Member>(`/api/v1/projects/${slug}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role } satisfies UpdateMemberRequest),
  });
}

export async function removeMember(
  slug: string,
  userId: string,
): Promise<void> {
  return request<void>(`/api/v1/projects/${slug}/members/${userId}`, {
    method: "DELETE",
  });
}

// Config

export async function getConfig(slug: string): Promise<ProjectConfig> {
  return request<ProjectConfig>(`/api/v1/projects/${slug}/config`);
}

export async function updateConfig(
  slug: string,
  data: UpdateConfigRequest,
): Promise<ProjectConfig> {
  return request<ProjectConfig>(`/api/v1/projects/${slug}/config`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function testConnection(
  slug: string,
): Promise<TestConnectionResponse> {
  const raw = await request<Record<string, { status: string; detail?: string }>>(
    `/api/v1/projects/${slug}/config/test`,
    { method: "POST" },
  );

  const entries = Object.entries(raw);
  const allOk = entries.every(([, v]) => v.status === "ok");
  const errors = entries
    .filter(([, v]) => v.status === "error")
    .map(([k, v]) => `${k}: ${v.detail}`);

  return {
    success: allOk,
    message: allOk
      ? entries.map(([k]) => k).join(", ") + " connected"
      : errors.join("; "),
  };
}

// ── Memories ──

export async function listMemories(
  slug: string,
  params?: MemoryListParams,
): Promise<MemoryListResponse> {
  return request<MemoryListResponse>(
    `/api/v1/projects/${slug}/memories${buildQuery(params as Record<string, unknown>)}`,
  );
}

export async function addMemory(
  slug: string,
  data: AddMemoryRequest,
): Promise<Memory> {
  return request<Memory>(`/api/v1/projects/${slug}/memories`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMemory(
  slug: string,
  id: string,
): Promise<Memory> {
  return request<Memory>(`/api/v1/projects/${slug}/memories/${id}`);
}

export async function updateMemory(
  slug: string,
  id: string,
  data: UpdateMemoryRequest,
): Promise<Memory> {
  return request<Memory>(`/api/v1/projects/${slug}/memories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMemory(
  slug: string,
  id: string,
): Promise<void> {
  return request<void>(`/api/v1/projects/${slug}/memories/${id}`, {
    method: "DELETE",
  });
}

export async function searchMemories(
  slug: string,
  data: SearchMemoryRequest,
): Promise<SearchResult[]> {
  return request<SearchResult[]>(`/api/v1/projects/${slug}/memories/search`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function bulkDeleteMemories(
  slug: string,
  data: BulkDeleteRequest,
): Promise<void> {
  return request<void>(`/api/v1/projects/${slug}/memories/bulk-delete`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMemoryHistory(
  slug: string,
  id: string,
): Promise<MemoryHistory[]> {
  return request<MemoryHistory[]>(
    `/api/v1/projects/${slug}/memories/${id}/history`,
  );
}

// ── Analytics ──

export async function getOverview(slug: string): Promise<Overview> {
  return request<Overview>(`/api/v1/projects/${slug}/analytics/overview`);
}

export async function getUsage(
  slug: string,
  params?: AnalyticsParams,
): Promise<UsageResponse> {
  return request<UsageResponse>(
    `/api/v1/projects/${slug}/analytics/usage${buildQuery(params as Record<string, unknown>)}`,
  );
}

export async function getRetrieval(
  slug: string,
  params?: AnalyticsParams,
): Promise<RetrievalResponse> {
  return request<RetrievalResponse>(
    `/api/v1/projects/${slug}/analytics/retrieval${buildQuery(params as Record<string, unknown>)}`,
  );
}

// ── Webhooks ──

export async function listWebhooks(slug: string): Promise<Webhook[]> {
  return request<Webhook[]>(`/api/v1/projects/${slug}/webhooks`);
}

export async function createWebhook(
  slug: string,
  data: CreateWebhookRequest,
): Promise<Webhook> {
  return request<Webhook>(`/api/v1/projects/${slug}/webhooks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateWebhook(
  slug: string,
  id: string,
  data: UpdateWebhookRequest,
): Promise<Webhook> {
  return request<Webhook>(`/api/v1/projects/${slug}/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(
  slug: string,
  id: string,
): Promise<void> {
  return request<void>(`/api/v1/projects/${slug}/webhooks/${id}`, {
    method: "DELETE",
  });
}

export async function testWebhook(
  slug: string,
  id: string,
): Promise<WebhookDelivery> {
  return request<WebhookDelivery>(
    `/api/v1/projects/${slug}/webhooks/${id}/test`,
    { method: "POST" },
  );
}

export async function listDeliveries(
  slug: string,
  id: string,
): Promise<WebhookDelivery[]> {
  return request<WebhookDelivery[]>(
    `/api/v1/projects/${slug}/webhooks/${id}/deliveries`,
  );
}

// ── Graph ──

export async function listEntities(
  slug: string,
  params?: GraphListParams,
): Promise<EntityListResponse> {
  return request<EntityListResponse>(
    `/api/v1/projects/${slug}/graph/entities${buildQuery(params as Record<string, unknown>)}`,
  );
}

export async function getEntity(
  slug: string,
  name: string,
): Promise<EntityDetail> {
  return request<EntityDetail>(
    `/api/v1/projects/${slug}/graph/entities/${encodeURIComponent(name)}`,
  );
}

export async function listRelations(
  slug: string,
  params?: GraphListParams,
): Promise<Relation[]> {
  return request<Relation[]>(
    `/api/v1/projects/${slug}/graph/relations${buildQuery(params as Record<string, unknown>)}`,
  );
}

export async function deleteEntity(
  slug: string,
  name: string,
): Promise<void> {
  return request<void>(
    `/api/v1/projects/${slug}/graph/entities/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
}

export async function deleteRelation(
  slug: string,
  id: string,
): Promise<void> {
  return request<void>(`/api/v1/projects/${slug}/graph/relations/${id}`, {
    method: "DELETE",
  });
}

export async function getSubgraph(
  slug: string,
  entities: string[],
  hops?: number,
): Promise<SubgraphResponse> {
  const params: Record<string, unknown> = { entities: entities.join(",") };
  if (hops !== undefined) params.hops = hops;
  return request<SubgraphResponse>(
    `/api/v1/projects/${slug}/graph/subgraph${buildQuery(params)}`,
  );
}

// ── Admin ──

export async function listUsers(
  params?: AdminUserParams,
): Promise<{ users: AdminUser[]; total: number }> {
  const data = await request<AdminUser[] | { users: AdminUser[]; total: number }>(
    `/api/v1/admin/users${buildQuery(params as Record<string, unknown>)}`,
  );
  if (Array.isArray(data)) {
    return { users: data, total: data.length };
  }
  return data;
}

export async function createUser(data: CreateUserRequest): Promise<AdminUser> {
  return request<AdminUser>("/api/v1/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  id: string,
  data: UpdateUserRequest,
): Promise<AdminUser> {
  return request<AdminUser>(`/api/v1/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listAuditLogs(
  params?: AuditLogParams,
): Promise<{ logs: AuditLog[]; total: number }> {
  const data = await request<AuditLog[] | { logs: AuditLog[]; total: number }>(
    `/api/v1/admin/audit-logs${buildQuery(params as Record<string, unknown>)}`,
  );
  if (Array.isArray(data)) {
    return { logs: data, total: data.length };
  }
  return data;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/api/v1/admin/stats");
}
