const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Config
    // Config
    getStatus: () => ipcRenderer.invoke('getStatus'),
    getConfig: () => ipcRenderer.invoke('getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('saveConfig', config),
    saveSchedule: (scheduleData) => ipcRenderer.invoke('saveSchedule', scheduleData),

    // Actions
    startBackup: (jobId) => ipcRenderer.invoke('startBackup', jobId),
    startSync: (jobId) => ipcRenderer.invoke('startSync', jobId),
    analyzeChanges: (jobId) => ipcRenderer.invoke('analyzeChanges', jobId),

    // Drive
    getDriveAuthUrl: () => ipcRenderer.invoke('getDriveAuthUrl'),
    submitDriveCode: (code) => ipcRenderer.invoke('submitDriveCode', code),
    logoutGoogle: () => ipcRenderer.invoke('logoutGoogle'),
    checkGoogleAuth: () => ipcRenderer.invoke('checkGoogleAuth'),
    listDriveFolders: () => ipcRenderer.invoke('listDriveFolders'),
    createDriveFolder: (name, parentId) => ipcRenderer.invoke('createDriveFolder', name, parentId),

    // System
    selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
    selectExclusions: () => ipcRenderer.invoke('selectExclusions'),
    openPath: (path) => ipcRenderer.invoke('openPath', path),
    quitApp: () => ipcRenderer.invoke('quitApp'),
    minimizeWindow: () => ipcRenderer.invoke('minimizeWindow'),
    maximizeWindow: () => ipcRenderer.invoke('maximizeWindow'),
    closeWindow: () => ipcRenderer.invoke('closeWindow'),
    getLogs: () => ipcRenderer.invoke('getLogs'),

    // Preferences
    getPreferences: () => ipcRenderer.invoke('getPreferences'),
    savePreferences: (prefs) => ipcRenderer.invoke('savePreferences', prefs),
    getSystemStats: () => ipcRenderer.invoke('getSystemStats'),
    getHistory: () => ipcRenderer.invoke('getHistory'),
    getHistory: () => ipcRenderer.invoke('getHistory'),
    clearHistory: () => ipcRenderer.invoke('clearHistory'),

    // Data Management
    exportConfig: () => ipcRenderer.invoke('exportConfig'),
    importConfig: () => ipcRenderer.invoke('importConfig'),
});
