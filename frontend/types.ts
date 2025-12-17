export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface Job {
  id: string;
  source: string;
  dest: string;
  destName?: string; // Human readable name for drive folder
  type: 'backup' | 'sync';
  mode?: BackupMode;  // Operation mode: Simple Copy, One-Way Backup, Two-Way Sync
  triggerType?: 'manual' | 'automatic' | 'scheduled';  // How the backup is triggered
  schedule?: string;
  exclusions?: string[];
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  category: 'BACKUP' | 'POWER';
  action: string;
  status: 'success' | 'failed' | 'info';
  details: string;
}

export interface AppConfig {
  jobs: Job[];
  globalExclusions: string[];
  scheduler: any[];
  preferences: any;
  google?: GoogleConfig;
}

export interface ElectronAPI {
  getStatus: () => Promise<{
    status: string;
    lastBackup: string;
    nextBackup: string;
    lastBackupStatus: string;
  }>;
  getConfig: () => Promise<{ success: boolean; config: AppConfig }>;
  saveConfig: (config: Partial<AppConfig>) => Promise<{ success: boolean; error?: string }>;
  saveSchedule: (data: any) => Promise<{ success: boolean; error?: string }>;

  startBackup: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  startSync: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  analyzeChanges: (jobId: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  getDriveAuthUrl: () => Promise<{ success: boolean; url?: string; error?: string }>;
  submitDriveCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  logoutGoogle: () => Promise<{ success: boolean; error?: string }>;
  checkGoogleAuth: () => Promise<{ success: boolean; isAuthenticated: boolean }>;
  getHistory: () => Promise<HistoryEvent[]>;
  clearHistory: () => Promise<boolean>;
  listDriveFolders: () => Promise<{ success: boolean; folders: Array<{ id: string; name: string }>; error?: string }>;
  createDriveFolder: (name: string, parentId?: string) => Promise<{ success: boolean; folder?: { id: string; name: string }; error?: string }>;

  selectDirectory: () => Promise<string | undefined>;
  selectExclusions: () => Promise<string[]>;
  openPath: (path: string) => Promise<{ success: boolean; error?: string }>;
  quitApp: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getLogs: () => Promise<string>;

  // Preferences
  // Preferences
  getPreferences: () => Promise<Preferences>;
  savePreferences: (prefs: Preferences) => Promise<boolean>;

  // System Stats
  getSystemStats: () => Promise<{ success: boolean; stats: SystemStats; error?: string }>;

  // Config Management
  exportConfig: () => Promise<{ success: boolean; error?: string; canceled?: boolean }>;
  importConfig: () => Promise<{ success: boolean; error?: string; canceled?: boolean }>;

  onNotification: (callback: (data: any) => void) => void;
  testNotification: () => Promise<{ success: boolean; error?: string }>;
  getMinecraftStatus: (ip: string, port: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

// Preferences type
export interface Preferences {
  autoStart: boolean;
  notifications?: boolean;
  soundAlerts?: boolean;
  logRetention?: number;
  debugMode?: boolean;
  showSystemStats?: boolean;
  minecraftIp?: string;
  minecraftPort?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// --- UI Types ---

export enum BackupMode {
  ONE_WAY_BACKUP = 'One-Way Backup',
  // Removed others per user request
}

export enum PowerAction {
  SHUTDOWN = 'Shutdown',
  RESTART = 'Restart',
  HIBERNATE = 'Hibernate'
}

export enum JobStatus {
  IDLE = 'Idle',
  RUNNING = 'Running',
  PAUSED = 'Paused',
  ERROR = 'Error'
}

export interface BackupConfig {
  sourcePath: string;
  destinations: string[];
  mode: BackupMode;
  exclusions: string[];
}

export interface ScheduleItem {
  id: string;
  day: string;
  time: string;
  action: PowerAction | 'BACKUP';  // Support both power actions and backup
  enabled: boolean;
  type?: 'power' | 'backup';  // Type to distinguish schedule type
}

export interface SystemStatus {
  status: JobStatus;
  lastBackup: string;
  nextBackup: string;
  lastBackupStatus: string;
  storageUsed: number | string; // Can be raw number from backend or formatted string
  totalFiles: number;
  progress?: {
    processed: number;
    total?: number;
    currentFile: string;
  };
  lastError?: string;
}

export interface SystemStats {
  cpuLoad: number;
  memory: {
    total: number;
    used: number;
    active: number;
    available: number;
  };
  disks: Array<{
    fs: string;
    size: number;
    used: number;
    use: number;
    mount: string;
  }>;
}
