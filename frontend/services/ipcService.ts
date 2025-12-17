import { AppConfig, SystemStatus, JobStatus, ScheduleItem, BackupConfig, Preferences, SystemStats, HistoryEvent } from '../types';

// Helper to map backend config to frontend types if needed
// For now assuming direct mapping or simple transformation

// Simple in-memory cache
let statsCache: SystemStats | null = null;
let lastStatsFetch = 0;
const CACHE_TTL = 3000; // 3 seconds TTL

export const ipcService = {
  getPreferences: async (): Promise<Preferences | null> => {
    if (window.electronAPI) {
      return await window.electronAPI.getPreferences();
    }
    return null;
  },

  savePreferences: async (prefs: Preferences): Promise<boolean> => {
    if (window.electronAPI) {
      return await window.electronAPI.savePreferences(prefs);
    }
    return false;
  },

  getStatus: async (): Promise<SystemStatus> => {
    if (window.electronAPI) {
      // Backend getStatus now returns the formatted object directly
      // However the type definition says it returns { config }.
      // Let's verify what backend actually sends. 
      // Main.js sends: { status: '...', lastBackup: '...', ... } directly?
      // Wait, main.js was updated to return { status: ..., lastBackup: ... }
      // The TYPES.ts definition for ElectronAPI.getStatus might need update or we cast as any.
      try {
        const res: any = await window.electronAPI.getStatus();
        return {
          status: (res.status === 'running' || res.status === 'Running' ? JobStatus.RUNNING : JobStatus.IDLE),
          lastBackup: res.lastBackup || 'Never',
          nextBackup: res.nextBackup || 'Not Scheduled',
          lastBackupStatus: res.lastBackupStatus || 'Idle',
          storageUsed: res.storageUsed || 0,
          totalFiles: res.totalFiles || 0,
          progress: res.progress,
          lastError: res.lastError
        };
      } catch (e) {
        console.error('[IPC] getStatus failed:', e);
        // Fallback to offline/idle state so UI doesn't hang
        return {
          status: JobStatus.IDLE,
          lastBackup: 'N/A',
          nextBackup: 'Backend Unreachable',
          lastBackupStatus: 'error',
          storageUsed: 0,
          totalFiles: 0,
          lastError: 'Connection to backend failed'
        };
      }
    }
    return {
      status: JobStatus.IDLE,
      lastBackup: 'N/A',
      nextBackup: 'Not Scheduled',
      lastBackupStatus: 'Idle',
      storageUsed: 0,
      totalFiles: 0
    };
  },

  getSchedule: async (): Promise<ScheduleItem[]> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.getConfig();
      if (res.success && res.config && res.config.scheduler) {
        return res.config.scheduler;
      }
    }
    return [];
  },

  startBackup: async (config: BackupConfig): Promise<boolean> => {
    // In real app, we might save config first, then run job 
    // Or send ad-hoc job. 
    // Let's assume we trigger a generic 'job-1' or similar for demo
    if (window.electronAPI) {
      // Create a temporary job object from the UI config to save/run
      const job = {
        id: 'manual-backup',
        source: config.sourcePath,
        dest: config.destinations[0] || '', // simplistic
        type: 'backup' as const,
        exclusions: config.exclusions,
        triggerType: 'manual' as const
      };
      // We might want to save this to backend config first
      await window.electronAPI.saveConfig({ jobs: [job] });
      const res = await window.electronAPI.startBackup('manual-backup');
      return res.success;
    }
    return false;
  },

  startSync: async (config: BackupConfig): Promise<boolean> => {
    if (window.electronAPI) {
      const job = {
        id: 'manual-sync',
        source: config.sourcePath,
        dest: config.destinations[0] || '',
        type: 'sync' as const,
        exclusions: config.exclusions
      };
      await window.electronAPI.saveConfig({ jobs: [job] });
      const res = await window.electronAPI.startSync('manual-sync');
      return res.success;
    }
    return false;
  },

  pauseJob: async (): Promise<boolean> => {
    // Not implemented in backend yet
    return true;
  },

  selectDirectory: async (): Promise<string | undefined> => {
    if (window.electronAPI) {
      return await window.electronAPI.selectDirectory();
    }
    return undefined;
  },

  selectExclusions: async (): Promise<string[]> => {
    if (window.electronAPI) {
      return await window.electronAPI.selectExclusions();
    }
    return [];
  },

  openPath: async (path: string): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.openPath(path);
      return res.success;
    }
    return false;
  },

  getHistory: async (): Promise<HistoryEvent[]> => {
    if (window.electronAPI) {
      return await window.electronAPI.getHistory();
    }
    return [];
  },

  clearHistory: async (): Promise<boolean> => {
    if (window.electronAPI) {
      return await window.electronAPI.clearHistory();
    }
    return false;
  },

  saveConfig: async (config: Partial<AppConfig>): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.saveConfig(config);
      return res.success;
    }
    return false;
  },

  saveSchedule: async (schedule: ScheduleItem[]): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.saveSchedule({ scheduler: schedule });
      return res.success;
    }
    return false;
  },

  // Google Drive
  getDriveAuthUrl: async (): Promise<{ url: string | null; error?: string }> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.getDriveAuthUrl();
      if (res.success && res.url) {
        return { url: res.url };
      } else {
        return { url: null, error: res.error };
      }
    }
    return { url: null, error: 'Not running in Electron' };
  },

  submitDriveCode: async (code: string): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.submitDriveCode(code);
      return res.success;
    }
    return false;
  },

  logoutGoogle: async (): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.logoutGoogle();
      return res.success;
    }
    return false;
  },

  checkGoogleAuth: async (): Promise<boolean> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.checkGoogleAuth();
      return res.isAuthenticated;
    }
    return false;
  },

  listDriveFolders: async (): Promise<Array<{ id: string; name: string }>> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.listDriveFolders();
      return res.success ? res.folders : [];
    }
    return [];
  },

  createDriveFolder: async (name: string, parentId?: string): Promise<{ id: string; name: string } | null> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.createDriveFolder(name, parentId);
      return res.success && res.folder ? res.folder : null;
    }
    return null;
  },

  quitApp: async (): Promise<void> => {
    if (window.electronAPI) window.electronAPI.quitApp();
  },

  getLogs: async (): Promise<string> => {
    if (window.electronAPI) return await window.electronAPI.getLogs();
    return "No logs available (web mode)";
  },

  getSystemStats: async (): Promise<SystemStats | null> => {
    // Return cache if valid
    const now = Date.now();
    if (statsCache && (now - lastStatsFetch < CACHE_TTL)) {
      return statsCache;
    }

    if (window.electronAPI) {
      const res = await window.electronAPI.getSystemStats();
      if (res.success) {
        statsCache = res.stats;
        lastStatsFetch = Date.now();
        return res.stats;
      }
    }
    return null;
  },

  exportConfig: async (): Promise<{ success: boolean; error?: string; canceled?: boolean }> => {
    if (window.electronAPI) {
      return await window.electronAPI.exportConfig();
    }
    return { success: false, error: 'Not supported in web mode' };
  },

  importConfig: async (): Promise<{ success: boolean; error?: string; canceled?: boolean }> => {
    if (window.electronAPI) {
      return await window.electronAPI.importConfig();
    }
    return { success: false, error: 'Not supported in web mode' };
  },

  getMinecraftStatus: async (ip: string, port: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    if (window.electronAPI) {
      return await window.electronAPI.getMinecraftStatus(ip, port);
    }
    return { success: false, error: 'Not supported in web mode' };
  }
};