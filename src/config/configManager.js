const { app } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

// Store in %APPDATA%/OnyxBackup/settings.json

const DEFAULT_CONFIG = {
    jobs: [], // { id, source, dest, type: 'backup'|'sync', schedule: '0 0 * * *', exclusions: [] }
    globalExclusions: ['.tmp', '.log', 'node_modules', '.git'],
    scheduler: [], // { day: 1, time: '22:00', action: 'shutdown' }
    preferences: {
        autoStart: false,
        theme: 'light'
    },
    status: {
        lastBackup: null, // ISO string
        lastBackupStatus: 'idle', // 'success', 'failed', 'idle'
        isRunning: false
    }
};

class ConfigManager {
    constructor() {
        this.instanceId = Math.random().toString(36).substring(7);
        // Defer path resolution to ensure app is ready/configured
        this.configPath = path.join(app.getPath('userData'), 'settings.json');

        console.log(`[DEBUG] ConfigManager INIT. InstanceID: ${this.instanceId}`);
        console.log(`[DEBUG] Config Path: ${this.configPath}`);

        this.config = { ...DEFAULT_CONFIG };
        this.load();
    }

    load() {
        try {
            let loadedConfig = {};

            // 1. Load from UserData if exists
            if (fs.existsSync(this.configPath)) {
                try {
                    const fileContent = fs.readFileSync(this.configPath, 'utf-8');
                    loadedConfig = JSON.parse(fileContent);
                    logger.info('Configuration loaded successfully from UserData.');
                } catch (parseErr) {
                    logger.error(`Error parsing settings.json: ${parseErr.message}. Backing up corrupted file.`);
                    try {
                        // Backup corrupted file so user data isn't lost for debugging
                        const backupPath = `${this.configPath}.corrupted.${Date.now()}.json`;
                        fs.copySync(this.configPath, backupPath);
                        logger.info(`Corrupted settings backed up to ${backupPath}`);
                    } catch (backupErr) {
                        logger.error(`Failed to backup corrupted settings: ${backupErr.message}`);
                    }
                }
            }

            // 2. Migration/Seeding Logic
            // Only seek local dev config if NOT packaged (dev mode) AND no UserData config exists
            const hasUserData = Object.keys(loadedConfig).length > 0;

            if (!hasUserData && !app.isPackaged) {
                const localConfigPath = path.join(process.cwd(), 'data', 'settings.json');
                if (fs.existsSync(localConfigPath)) {
                    logger.info(`Dev Mode: Seeding configuration from ${localConfigPath}`);
                    try {
                        const localContent = fs.readFileSync(localConfigPath, 'utf-8');
                        loadedConfig = JSON.parse(localContent);
                    } catch (err) {
                        logger.warn(`Failed to seed from local config: ${err.message}`);
                    }
                }
            }

            if (Object.keys(loadedConfig).length > 0) {
                // Merge with defaults to ensure all keys exist (handling schema updates)
                this.config = { ...DEFAULT_CONFIG, ...loadedConfig };

                // Ensure array fields are actually arrays (prevent runtime map/filter errors)
                if (!Array.isArray(this.config.jobs)) this.config.jobs = [];
                if (!Array.isArray(this.config.scheduler)) this.config.scheduler = [];

            } else {
                logger.info('No existing configuration found. Initializing defaults.');
                this.save();
            }
        } catch (error) {
            logger.error(`CRITICAL: Failed to load configuration: ${error.message}`);
            // Fallback to defaults in memory so app doesn't crash
            this.config = { ...DEFAULT_CONFIG };
        }
    }

    // Atomic Save: Write to .tmp then rename
    save() {
        try {
            fs.ensureDirSync(path.dirname(this.configPath));

            const tmpPath = `${this.configPath}.tmp`;
            fs.writeJsonSync(tmpPath, this.config, { spaces: 2 });

            // Rename is strictly atomic on POSIX, usually atomic enough on Windows for this purpose
            // vs writing directly to the target file.
            fs.moveSync(tmpPath, this.configPath, { overwrite: true });

            logger.info('Configuration saved successfully.');
        } catch (error) {
            logger.error(`Failed to save configuration to ${this.configPath}: ${error.message}`);
            console.error(`[CRITICAL] Save failed: ${error.message}`);
        }
    }

    get(key) {
        return key ? this.config[key] : this.config;
    }

    set(key, value) {
        if (key === 'status') {
            // Filter detailed log to avoid noise
        } else {
            logger.info(`ConfigManager.set(${key})`);
        }

        this.config[key] = value;
        this.save();
    }

    updateJob(job) {
        // Ensure jobs array exists
        if (!Array.isArray(this.config.jobs)) this.config.jobs = [];

        const index = this.config.jobs.findIndex(j => j.id === job.id);
        if (index !== -1) {
            this.config.jobs[index] = job;
        } else {
            this.config.jobs.push(job);
        }
        this.save();
    }

    removeJob(jobId) {
        if (!Array.isArray(this.config.jobs)) return;

        this.config.jobs = this.config.jobs.filter(j => j.id !== jobId);
        this.save();
    }
}

module.exports = new ConfigManager();
