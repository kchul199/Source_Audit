import type { Project, Audit, PaginatedResponse, DashboardStats } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${errorBody}`);
  }
  return res.json();
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

export async function fetchConfigFile(): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/config/file`);
  return handleResponse<any>(res);
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
