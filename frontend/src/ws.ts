export class WSManager {
  private url: string
  private ws?: WebSocket
  private listeners = new Set<(data: any) => void>()
  private reconnectDelay = 1000

  constructor(url: string) { this.url = url }

  connect() {
    this.ws = new WebSocket(this.url)
    this.ws.onopen = () => { this.reconnectDelay = 1000 }
    this.ws.onmessage = (ev) => {
      try { const data = JSON.parse(ev.data as string); this.listeners.forEach(l=>l(data)) } catch {}
    }
    this.ws.onclose = () => {
      setTimeout(()=> this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay*2, 15000)
    }
    this.ws.onerror = () => { try { this.ws?.close() } catch {} }
  }

  subscribe(fn: (data: any) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
}

export function metricsWS(base: string = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000') {
  const url = base.replace('http','ws') + '/ws/metrics'
  const m = new WSManager(url)
  m.connect()
  return m
}

export function notificationsWS(base: string = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000') {
  const url = base.replace('http','ws') + '/ws/notifications'
  const m = new WSManager(url)
  m.connect()
  return m
}
