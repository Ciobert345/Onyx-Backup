// WSManager is replaced by Electron IPC Events
export class WSManager {
  private cleanup: (() => void) | undefined

  constructor(private channel: string) { }

  connect() {
    // In Electron, we don't need to "connect", we just listen.
    // However, to keep API similar for now:
  }

  subscribe(fn: (data: any) => void) {
    if (this.channel === 'notifications') {
      // Use IPC
      window.electronAPI.onNotification((data) => {
        fn(data);
      });
      // Return a dummy cleanup or implement removeListener if exposed
      return () => { };
    }
    return () => { };
  }
}

export function metricsWS() {
  // Metrics are polled in this architecture usually, or we can setup a push
  // For now return dummy
  return new WSManager('metrics');
}

export function notificationsWS() {
  return new WSManager('notifications');
}
