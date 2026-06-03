const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function fetchProjects() {
  const res = await fetch(`${API_BASE_URL}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function fetchAudits(projectId?: string) {
  const url = projectId ? `${API_BASE_URL}/audits?projectId=${projectId}` : `${API_BASE_URL}/audits`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch audits');
  return res.json();
}

export async function fetchAuditDetail(id: string) {
  const res = await fetch(`${API_BASE_URL}/audits/${id}`);
  if (!res.ok) throw new Error('Failed to fetch audit detail');
  return res.json();
}

export async function retryAudit(id: string) {
  const res = await fetch(`${API_BASE_URL}/audits/${id}/retry`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to retry audit');
  return res.json();
}
