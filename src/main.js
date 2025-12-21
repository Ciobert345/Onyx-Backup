const { app, ipcMain, BrowserWindow, dialog, shell, screen, Notification } = require('electron');
// Set App ID for Windows Notifications
app.setAppUserModelId('com.onyx.backup.system');

const path = require('path');
const configManager = require('./config/configManager');
console.log(`[DEBUG] main.js loaded ConfigManager. InstanceID: ${configManager.instanceId}`);

// FORCE RESET STATUS ON STARTUP
// If app crashed while running, this prevents infinite loading state
const savedStatus = configManager.get('status') || {};
if (savedStatus.isRunning) {
    console.log('[INFO] Resetting stale "isRunning" status to false.');
    configManager.set('status', {
        ...savedStatus,
        isRunning: false,
        lastBackupStatus: 'interrupted' // Optional: indicate it didn't finish cleanly
    });
}
const si = require('systeminformation');
const logger = require('./utils/logger'); // Move logger up to use it
logger.info('Loaded configManager');

let backupManager, syncManager, scheduler;
try {
    backupManager = require('./core/backupManager');
    logger.info('Loaded backupManager');
    syncManager = require('./core/syncManager');
    logger.info('Loaded syncManager');
    scheduler = require('./core/scheduler');
    logger.info('Loaded scheduler');

} catch (error) {
    logger.error(`Failed to load core modules: ${error.message}`);
}

// Note: In a real Electron app, you'd create the BrowserWindow here.
// Since this is just the backend logic, we'll focus on the IPC and init.

// Progress State
let currentProgress = null;

function registerIpcHandlers() {

    ipcMain.handle('startBackup', async (event, jobId) => {
        try {
            currentProgress = { processed: 0, currentFile: 'Initializing...' };

            const onProgress = (data) => {
                if (data.processed % 5 === 0 || data.processed === 1) {
                    logger.info(`Main process received progress: ${JSON.stringify(data)}`);
                }
                currentProgress = data;
            };

            const result = await backupManager.startBackup(jobId, null, onProgress);
            // console.log('[DEBUG] Backup Result:', JSON.stringify(result));

            // Check for Identical Files Notification
            // In-App Notification using IPC
            if (result && result.uploaded === 0 && result.updated === 0 && result.skipped > 0) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('notification', {
                        title: 'Backup Complete',
                        message: 'Files are identical to Google Drive. No upload needed.',
                        type: 'info'
                    });
                }
            }

            currentProgress = null; // Clear when done
            return { success: true };
        } catch (e) {
            currentProgress = null;
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('startSync', async (event, jobId) => {
        try {
            currentProgress = { processed: 0, total: 100, currentFile: 'Starting sync...' };
            const result = await syncManager.startSync(jobId, (progress) => {
                currentProgress = progress;
            });
            // console.log('[DEBUG] Sync Result:', JSON.stringify(result));

            // In-App Notification using IPC
            if (result && result.uploaded === 0 && result.updated === 0 && result.skipped > 0) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('notification', {
                        title: 'Sync Complete',
                        message: 'Files are identical to Google Drive. No upload needed.',
                        type: 'info'
                    });
                }
            }
            currentProgress = null;
            return { success: true };
        } catch (e) {
            currentProgress = null;
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('analyzeChanges', async (event, jobId) => {
        try {
            const changes = await syncManager.analyzeChanges(jobId);
            return { success: true, data: changes };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('testNotification', () => {
        console.log('[DEBUG] Received testNotification request.');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('notification', {
                title: 'Test Notification',
                message: 'This is a test notification from the backend.',
                type: 'info'
            });
            return { success: true };
        }
        return { success: false, error: 'mainWindow not available' };
    });

    ipcMain.handle('scheduleCreate', async (event, job) => {
        try {
            // Validate job data
            if (!job || typeof job !== 'object') {
                return { success: false, error: 'Invalid job data: job must be an object' };
            }

            const config = configManager.get();
            const schedulerList = config.scheduler || [];

            // Generate ID if missing
            if (!job.id) {
                job.id = `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            // Check for duplicate IDs
            if (schedulerList.some(item => item.id === job.id)) {
                logger.warn(`Schedule with ID ${job.id} already exists. Updating instead of creating duplicate.`);
                // Update existing instead of creating duplicate
                const index = schedulerList.findIndex(item => item.id === job.id);
                schedulerList[index] = { ...schedulerList[index], ...job };
            } else {
                schedulerList.push(job);
            }

            configManager.set('scheduler', schedulerList);

            // Re-init scheduler
            scheduler.initScheduler();
            return { success: true };
        } catch (e) {
            logger.error(`Error creating schedule: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('scheduleDelete', async (event, id) => {
        try {
            const config = configManager.get();
            let schedulerList = config.scheduler || [];

            // Filter out by ID
            // Note: Frontend generates IDs like "action-time-random". 
            // We need to ensure we save/load these IDs properly.
            schedulerList = schedulerList.filter(item => item.id !== id);

            configManager.set('scheduler', schedulerList);
            scheduler.initScheduler();
            return { success: true };
        } catch (e) {
            logger.error(`Error deleting schedule: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('saveSchedule', async (event, scheduleData) => {
        // scheduleData: { scheduler: [...] } or updated jobs
        try {
            if (!scheduleData || typeof scheduleData !== 'object') {
                return { success: false, error: 'Invalid schedule data' };
            }

            if (scheduleData.scheduler) {
                // Validate it's an array
                if (!Array.isArray(scheduleData.scheduler)) {
                    return { success: false, error: 'Scheduler must be an array' };
                }

                // Ensure all items have IDs
                scheduleData.scheduler = scheduleData.scheduler.map((item, index) => {
                    if (!item.id) {
                        item.id = `sched-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                    }
                    return item;
                });

                // Remove duplicates by ID (keep last occurrence)
                const seen = new Set();
                scheduleData.scheduler = scheduleData.scheduler.filter(item => {
                    if (seen.has(item.id)) {
                        logger.warn(`Removing duplicate schedule with ID: ${item.id}`);
                        return false;
                    }
                    seen.add(item.id);
                    return true;
                });

                configManager.set('scheduler', scheduleData.scheduler);
            }
            
            // Re-init scheduler to pick up changes
            scheduler.initScheduler();
            return { success: true };
        } catch (e) {
            logger.error(`Error saving schedule: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('getConfig', (event) => {
        return { success: true, config: configManager.get() };
    });

    ipcMain.handle('getStatus', (event) => {
        const config = configManager.get();
        const status = config.status || {};

        // Find next scheduled time
        let nextBackup = 'Not Scheduled';
        if (config.jobs && config.jobs.length > 0) {
            const job = config.jobs[0];
            const trigger = job.triggerType || job.trigger; // Handle both keys
            if (trigger === 'automatic') nextBackup = 'Automatic (File Watcher)';
            else if (job.schedule) nextBackup = `Scheduled (${job.schedule})`;
        }

        // Robust Date Handling
        let lastBackupStr = 'Never';
        try {
            if (status.lastBackup && status.lastBackup !== 'Never') {
                const date = new Date(status.lastBackup);
                if (!isNaN(date.getTime())) {
                    lastBackupStr = date.toLocaleString();
                } else {
                    lastBackupStr = 'Invalid Date (Resetting...)';
                }
            }
        } catch (e) {
            lastBackupStr = 'Error';
        }

        // Force running state if we have active progress
        const bmProgress = backupManager.getProgress ? backupManager.getProgress() : null;
        const smProgress = syncManager.getProgress ? syncManager.getProgress() : null;
        const effectiveProgress = currentProgress || bmProgress || smProgress;
        const effectiveIsRunning = status.isRunning || !!effectiveProgress;

        // DEBUG: Log status explicitly to console for user visibility
        console.log(`[DEBUG] getStatus: isRunning=${status.isRunning}, Progress=${JSON.stringify(effectiveProgress)}`);

        return {
            status: effectiveIsRunning ? 'Running' : 'Idle',
            lastBackup: lastBackupStr,
            nextBackup: nextBackup,
            lastBackupStatus: status.lastBackupStatus || 'Idle',
            storageUsed: status.storageUsed || 0,
            totalFiles: status.totalFiles || 0,
            lastError: status.lastError || null,
            progress: effectiveProgress
        };
    });

    ipcMain.handle('saveConfig', async (event, newConfig) => {
        try {
            // Merge top level keys
            Object.keys(newConfig).forEach(key => {
                configManager.set(key, newConfig[key]);
            });
            scheduler.initScheduler();
            return { success: true };
        } catch (e) {
            logger.error(e);
            return { success: false, error: e.message };
        }
    });

    // --- Google Drive IPC ---
    const googleAuth = require('./auth/googleAuth');

    ipcMain.handle('getDriveAuthUrl', async () => {
        try {
            await googleAuth.init();
            const url = googleAuth.generateAuthUrl();
            return { success: true, url };
        } catch (e) {
            logger.error(`getDriveAuthUrl failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('submitDriveCode', async (event, code) => {
        try {
            await googleAuth.exchangeCodeForToken(code);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('logoutGoogle', async () => {
        try {
            await googleAuth.logout();
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('checkGoogleAuth', async () => {
        try {
            await googleAuth.init(); // Load tokens from disk first
            const isAuth = googleAuth.isAuthenticated();
            return { success: true, isAuthenticated: isAuth };
        } catch (e) {
            return { success: false, isAuthenticated: false };
        }
    });

    ipcMain.handle('listDriveFolders', async () => {
        try {
            const driveAdapter = require('./core/driveAdapter');
            await driveAdapter.init();
            const folders = await driveAdapter.listFolders();
            return { success: true, folders };
        } catch (e) {
            logger.error(`List Drive Folders Error: ${e.message}`);
            return { success: false, error: e.message, folders: [] };
        }
    });

    ipcMain.handle('createDriveFolder', async (event, name, parentId) => {
        try {
            const driveAdapter = require('./core/driveAdapter');
            await driveAdapter.init();
            const folder = await driveAdapter.createFolder(name, parentId);
            return { success: true, folder };
        } catch (e) {
            logger.error(`Create Drive Folder Error: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('selectExclusions', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'openDirectory', 'multiSelections'],
            title: 'Select Files or Folders to Exclude',
            buttonLabel: 'Exclude'
        });
        return result.canceled ? [] : result.filePaths;
    });

    ipcMain.handle('selectDirectory', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        return result.filePaths[0]; // Returns undefined if cancelled
    });

    ipcMain.handle('openPath', async (event, path) => {
        try {
            const error = await shell.openPath(path);
            if (error) {
                logger.error(`Failed to open path ${path}: ${error}`);
                return { success: false, error };
            }
            return { success: true };
        } catch (e) {
            logger.error(`Error opening path: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('getPreferences', async () => {
        return configManager.get('preferences') || {};
    });

    ipcMain.handle('savePreferences', async (event, prefs) => {
        try {
            configManager.set('preferences', prefs);

            // Configure Auto-Start
            if (typeof prefs.autoStart === 'boolean') {
                app.setLoginItemSettings({
                    openAtLogin: prefs.autoStart,
                    path: app.getPath('exe')
                });
                logger.info(`Auto-start set to: ${prefs.autoStart}`);
            }

            return true;
        } catch (e) {
            logger.error(`Error saving preferences: ${e.message}`);
            return false;
        }
    });

    ipcMain.handle('quitApp', () => {
        process.isQuitting = true;
        app.quit();
    });

    // Window controls for frameless window
    ipcMain.handle('minimizeWindow', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle('maximizeWindow', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle('closeWindow', () => {
        if (mainWindow) mainWindow.close();
    });

    ipcMain.handle('getLogs', async () => {
        try {
            const fs = require('fs-extra');
            // MATCH logger.js: Use userData for logs
            const logPath = path.join(app.getPath('userData'), 'logs', 'app.log');
            if (await fs.pathExists(logPath)) {
                const content = await fs.readFile(logPath, 'utf8');
                // Return last 50 lines
                return content.split('\n').slice(-50).join('\n');
            }
            return '';
        } catch (e) {
            logger.error(`Error reading logs: ${e.message}`);
            return '';
        }
    });

    ipcMain.handle('getHistory', async () => {
        try {
            const historyManager = require('./core/historyManager');
            return await historyManager.getHistory();
        } catch (e) {
            logger.error(`Error fetching history: ${e.message}`);
            return [];
        }
    });

    ipcMain.handle('clearHistory', async () => {
        try {
            const historyManager = require('./core/historyManager');
            return await historyManager.clearHistory();
        } catch (e) {
            logger.error(`Error clearing history: ${e.message}`);
            return false;
        }
    });

    ipcMain.handle('getSystemStats', async () => {
        try {
            const [cpu, mem, fs] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize()
            ]);
            return {
                success: true,
                stats: {
                    cpuLoad: Math.round(cpu.currentLoad),
                    memory: {
                        total: mem.total,
                        used: mem.used,
                        active: mem.active,
                        available: mem.available
                    },
                    disks: fs.map(disk => ({
                        fs: disk.fs,
                        size: disk.size,
                        used: disk.used,
                        use: disk.use,
                        mount: disk.mount
                    }))
                }
            };
        } catch (e) {
            logger.error(`Error getting system stats: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('getMinecraftStatus', async (event, ip, port) => {
        try {
            const address = port && port !== '25565' ? `${ip}:${port}` : ip;
            // Using mcsrvstat.us - Node.js 18+ has native fetch
            const res = await fetch(`https://api.mcsrvstat.us/2/${address}`);
            const data = await res.json();
            return { success: true, data };
        } catch (e) {
            logger.error(`Error fetching Minecraft status: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    // --- Config Export/Import ---
    ipcMain.handle('exportConfig', async () => {
        try {
            const result = await dialog.showSaveDialog(mainWindow, {
                title: 'Export Configuration',
                defaultPath: 'onyx-config.json',
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });

            if (result.canceled || !result.filePath) return { success: false, canceled: true };

            const config = configManager.get();
            const fs = require('fs-extra');
            await fs.writeJson(result.filePath, config, { spaces: 2 });
            return { success: true };
        } catch (e) {
            logger.error(`Export config failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('importConfig', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Import Configuration',
                filters: [{ name: 'JSON', extensions: ['json'] }],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

            const fs = require('fs-extra');
            const newConfig = await fs.readJson(result.filePaths[0]);

            // Basic validation
            if (!newConfig || typeof newConfig !== 'object') {
                throw new Error('Invalid configuration file format');
            }

            // Restore config
            // We iterate keys to ensure we update the manager properly
            Object.keys(newConfig).forEach(key => {
                configManager.set(key, newConfig[key]);
            });

            // Re-init scheduler
            scheduler.initScheduler();

            return { success: true };
        } catch (e) {
            logger.error(`Import config failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    });
}

// --- Window Management ---
let mainWindow;

function createWindow() {
    // Get primary display dimensions
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Calculate window size as percentage of screen (80% width, 70% height)
    const windowWidth = Math.floor(screenWidth * 0.7);
    const windowHeight = Math.floor(screenHeight * 0.82);

    mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        show: false, // Don't show until ready
        frame: false, // Remove native title bar and frame
        backgroundColor: '#0a0a0a', // Dark background to match app theme
        icon: path.join(__dirname, 'assets', 'icon.png'), // App icon
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Show window when ready to prevent white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // In production, load file. In dev, could load localhost.
    // Assuming build output is in ../frontend/dist/index.html or similar?
    // For this setup, let's assume the user runs the frontend separately in dev mode (localhost:5173)
    // OR we can try to serve the static files if built.

    // Strategy: Try loading dev server, fallback to file.
    // You might want to pass an env var or just default to localhost for dev.
    const devUrl = 'http://localhost:5173';

    mainWindow.loadURL(devUrl).catch((err) => {
        logger.info(`Dev server connection failed: ${err.message}. Converting to static file.`);
        // Fallback to production build
        const indexPath = path.join(__dirname, '../frontend/dist/index.html');
        mainWindow.loadFile(indexPath).catch((fileErr) => {
            logger.error(`Failed to load static file: ${fileErr.message}`);
        });
    });

    // Tray Behavior
    mainWindow.on('close', (event) => {
        if (!process.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

let tray;

function createTray() {
    // Only implemented for Windows via 'tray' but requires an icon
    // Using a simple workaround code if no icon file is maintained
    // For now assuming icon is skipped or default
    // In a real app, pass icon path: path.join(__dirname, 'icon.png')

    // Using nativeImage is better but strict requirements on path
    const { Tray, Menu, nativeImage } = require('electron');

    // Handle icon path for both dev (src/assets) and prod (resources/app.asar/src/assets)
    // Since we moved it to src/assets, it should be relative to __dirname (which is src)
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    let icon;
    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            logger.warn('Icon file is empty, using default');
            icon = null;
        }
    } catch (err) {
        logger.warn(`Failed to load icon from ${iconPath}: ${err.message}`);
        icon = null;
    }

    if (!icon) {
        // Create a simple default icon if custom icon fails
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('Onyx Backup');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => mainWindow.show() },
        {
            label: 'Quit', click: () => {
                process.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

// Debugging entry point
logger.info(`Starting main.js. require.main === module: ${require.main === module}`);

// Start app unconditionally
app.whenReady().then(() => {
    logger.info('Electron Backend Service Started');
    registerIpcHandlers();
    if (scheduler) {
        scheduler.initScheduler();
    } else {
        logger.error('Scheduler module not loaded. Skipping initialization.');
    }
    createWindow();
    createTray();

    app.on('activate', () => {
        if (mainWindow === null) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


module.exports = { registerIpcHandlers };
