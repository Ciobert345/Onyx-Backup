const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'

async function request(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
    ...opts,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const api = {
  authRedirect: () => request('/api/auth/google/redirect') as Promise<{auth_url: string, state: string}>,
  fsTree: (path?: string) => request(`/api/fs/tree${path?`?path=${encodeURIComponent(path)}`:''}`),
  fsDownload: (path: string) => `${API_BASE}/api/fs/download?path=${encodeURIComponent(path)}`,
  syncStart: (payload: any) => request('/api/sync/start', { method:'POST', body: JSON.stringify(payload)}),
  syncStop: () => request('/api/sync/stop', { method:'POST'}),
  syncStatus: () => request('/api/sync/status'),
  scheduleCreate: (job: any) => request('/api/schedule', { method:'POST', body: JSON.stringify(job)}),
  scheduleDelete: (id: string) => request(`/api/schedule/${id}`, { method:'DELETE'}),
  metricsHistory: () => request('/api/metrics/history'),
}

export function oauthLogin() {
  return api.authRedirect().then(({auth_url}) => { window.location.href = auth_url })
}
