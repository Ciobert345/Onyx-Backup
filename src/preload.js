const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Config
    getStatus: () => ipcRenderer.invoke('getStatus'),
    getConfig: () => ipcRenderer.invoke('getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('saveConfig', config),
    saveSchedule: (scheduleData) => ipcRenderer.invoke('saveSchedule', scheduleData),
    saveSchedulerGroups: (groups) => ipcRenderer.invoke('saveSchedulerGroups', groups),

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
    getMinecraftStatus: (ip, port) => ipcRenderer.invoke('getMinecraftStatus', ip, port),
    getHistory: () => ipcRenderer.invoke('getHistory'),
    clearHistory: () => ipcRenderer.invoke('clearHistory'),

    // Events
    onNotification: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on('notification', handler);
        return () => ipcRenderer.removeListener('notification', handler);
    },
    testNotification: () => ipcRenderer.invoke('testNotification'),

    // Data Management
    exportConfig: () => ipcRenderer.invoke('exportConfig'),
    importConfig: () => ipcRenderer.invoke('importConfig'),

    // Scheduler
    scheduleCreate: (job) => ipcRenderer.invoke('scheduleCreate', job),
    scheduleDelete: (id) => ipcRenderer.invoke('scheduleDelete', id),
});
