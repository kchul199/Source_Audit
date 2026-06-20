import type {
  Project, Audit, PaginatedResponse, DashboardStats,
  WebhookEvent, TrendData, AuditCompareResult, AppConfig
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    let message = errorBody || res.statusText || 'Unknown error';
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error) message = parsed.error;
    } catch {
      // Non-JSON error bodies are still useful as-is.
    }
    throw new Error(`API Error ${res.status}: ${message}`);
  }
  return res.json();
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (error.message === 'Failed to fetch') {
      return 'API server is not reachable. Start the webhook server on http://localhost:3001 and try again.';
    }
    return error.message;
  }
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE_URL}/projects`);
  return handleResponse<Project[]>(res);
}

export async function fetchAudits(
  projectId?: string,
  page: number = 1,
  limit: number = 20,
): Promise<PaginatedResponse<Audit>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (projectId) params.set('projectId', projectId);
  const res = await fetch(`${API_BASE_URL}/audits?${params.toString()}`);
  return handleResponse<PaginatedResponse<Audit>>(res);
}

export async function fetchAuditDetail(id: string): Promise<Audit> {
  const res = await fetch(`${API_BASE_URL}/audits/${id}`);
  return handleResponse<Audit>(res);
}

export async function retryAudit(id: string): Promise<{ message: string; auditId: string }> {
  const res = await fetch(`${API_BASE_URL}/audits/${id}/retry`, {
    method: 'POST',
  });
  return handleResponse<{ message: string; auditId: string }>(res);
}

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE_URL}/stats`);
  return handleResponse<DashboardStats>(res);
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return handleResponse<Project>(res);
}

export async function updateProject(id: string, project: Partial<Project>): Promise<Project> {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  return handleResponse<Project>(res);
}

export async function deleteProject(id: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });
  return handleResponse<{ message: string }>(res);
}

export async function fetchConfigFile(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE_URL}/config/file`);
  return handleResponse<AppConfig>(res);
}

export async function syncConfigFromConfigFile(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/config/sync`, {
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
}

export async function exportConfigToConfigFile(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/config/export`, {
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
}

export async function fetchWebhookEvents(page: number = 1, limit: number = 30): Promise<PaginatedResponse<WebhookEvent>> {
  const res = await fetch(`${API_BASE_URL}/webhook-events?page=${page}&limit=${limit}`);
  return handleResponse<PaginatedResponse<WebhookEvent>>(res);
}

export async function fetchStatsTrend(projectId?: string, range: string = '30d'): Promise<TrendData[]> {
  const params = new URLSearchParams({ range });
  if (projectId) params.set('projectId', projectId);
  const res = await fetch(`${API_BASE_URL}/stats/trend?${params.toString()}`);
  return handleResponse<TrendData[]>(res);
}

export async function fetchAuditCompare(leftId: string, rightId: string): Promise<AuditCompareResult> {
  const res = await fetch(`${API_BASE_URL}/audits/compare?left=${leftId}&right=${rightId}`);
  return handleResponse<AuditCompareResult>(res);
}
