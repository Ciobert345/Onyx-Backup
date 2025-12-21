/// <reference path="./electron.d.ts" />
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'

async function request(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const api = {
  authRedirect: async () => {
    // For Google Auth, we now use getDriveAuthUrl via IPC
    const res = await window.electronAPI.getDriveAuthUrl();
    if (!res.success) throw new Error(res.error);
    return { auth_url: res.url!, state: '' };
  },
  // fsTree not implemented in IPC yet, but mainly used for selection which we do via dialogs now
  fsTree: (path?: string) => Promise.resolve([]),
  fsDownload: (path: string) => '', // Not applicable in Electron app directly usually
  syncStart: (payload: any) => window.electronAPI.startSync(payload.id),
  syncStop: () => Promise.resolve(), // Not implemented yet
  syncStatus: () => window.electronAPI.getStatus(),
  scheduleCreate: (job: any) => window.electronAPI.scheduleCreate(job), // Need backend impl
  scheduleDelete: (id: string) => window.electronAPI.scheduleDelete(id), // Need backend impl
  metricsHistory: () => window.electronAPI.getSystemStats(), // Simplify to current stats or impl history
}

export function oauthLogin() {
  return api.authRedirect().then(({ auth_url }) => { window.location.href = auth_url })
}
