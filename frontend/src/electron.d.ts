interface ElectronAPI {
    // Config
    getStatus: () => Promise<any>;
    getConfig: () => Promise<any>;
    saveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
    saveSchedule: (scheduleData: any) => Promise<{ success: boolean; error?: string }>;
    scheduleCreate: (job: any) => Promise<{ success: boolean; error?: string }>; // Need to add this to preload
    scheduleDelete: (id: string) => Promise<{ success: boolean; error?: string }>; // Need to add this

    // Actions
    startBackup: (jobId: string) => Promise<{ success: boolean; error?: string }>;
    startSync: (jobId: string) => Promise<{ success: boolean; error?: string }>;
    analyzeChanges: (jobId: string) => Promise<{ success: boolean; data?: any; error?: string }>;

    // Drive
    getDriveAuthUrl: () => Promise<{ success: boolean; url?: string; error?: string }>;
    submitDriveCode: (code: string) => Promise<{ success: boolean; error?: string }>;
    logoutGoogle: () => Promise<{ success: boolean; error?: string }>;
    checkGoogleAuth: () => Promise<{ success: boolean; isAuthenticated: boolean }>;
    listDriveFolders: () => Promise<{ success: boolean; folders?: any[]; error?: string }>;
    createDriveFolder: (name: string, parentId?: string) => Promise<{ success: boolean; folder?: any; error?: string }>;

    // System
    selectDirectory: () => Promise<string | undefined>;
    selectExclusions: () => Promise<string[]>;
    openPath: (path: string) => Promise<{ success: boolean; error?: string }>;
    quitApp: () => Promise<void>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    getLogs: () => Promise<string>;

    // Preferences
    getPreferences: () => Promise<any>;
    savePreferences: (prefs: any) => Promise<boolean>;
    getSystemStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
    getMinecraftStatus: (ip: string, port?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getHistory: () => Promise<any[]>;
    clearHistory: () => Promise<boolean>;

    // Events
    onNotification: (callback: (data: any) => void) => () => void;
    testNotification: () => Promise<{ success: boolean }>;

    // Data Management
    exportConfig: () => Promise<{ success: boolean; error?: string }>;
    importConfig: () => Promise<{ success: boolean; error?: string }>;
}

interface Window {
    electronAPI: ElectronAPI;
}
