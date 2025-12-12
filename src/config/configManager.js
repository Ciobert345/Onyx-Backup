const { app } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

// Store in %APPDATA%/OnyxBackup/settings.json
const CONFIG_PATH = path.join(app.getPath('userData'), 'settings.json');

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
        this.config = { ...DEFAULT_CONFIG };
        this.load();
    }

    load() {
        try {
            const localConfigPath = path.join(process.cwd(), 'data', 'settings.json');
            let loadedConfig = {};

            // 1. Load from UserData if exists
            if (fs.existsSync(CONFIG_PATH)) {
                const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
                loadedConfig = JSON.parse(fileContent);
            }

            // 2. Check if we need migration (if google config missing in loaded but exists in local)
            const needsMigration = (!loadedConfig.google || !loadedConfig.google.clientId) && fs.existsSync(localConfigPath);

            if (needsMigration) {
                logger.info(`Migrating settings from ${localConfigPath} to ${CONFIG_PATH}`);
                const localContent = fs.readFileSync(localConfigPath, 'utf-8');
                const localConfig = JSON.parse(localContent);

                // Merge local config into loaded config (prefer local for google creds)
                loadedConfig = { ...loadedConfig, ...localConfig };

                // Save the migrated result
                fs.ensureDirSync(path.dirname(CONFIG_PATH));
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(loadedConfig, null, 2));
            }

            if (Object.keys(loadedConfig).length > 0) {
                this.config = { ...DEFAULT_CONFIG, ...loadedConfig };
                logger.info('Configuration loaded successfully.');
            } else {
                logger.info('No configuration file found. Creating default.');
                this.save();
            }
        } catch (error) {
            logger.error(`Failed to load configuration: ${error.message}`);
        }
    }

    save() {
        try {
            fs.ensureDirSync(path.dirname(CONFIG_PATH));
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
            logger.info('Configuration saved.');
        } catch (error) {
            logger.error(`Failed to save configuration: ${error.message}`);
        }
    }

    get(key) {
        return key ? this.config[key] : this.config;
    }

    set(key, value) {
        logger.info(`ConfigManager.set(${key}): ${JSON.stringify(value)}`);
        this.config[key] = value;
        this.save();
    }

    updateJob(job) {
        const index = this.config.jobs.findIndex(j => j.id === job.id);
        if (index !== -1) {
            this.config.jobs[index] = job;
        } else {
            this.config.jobs.push(job);
        }
        this.save();
    }

    removeJob(jobId) {
        this.config.jobs = this.config.jobs.filter(j => j.id !== jobId);
        this.save();
    }
}

module.exports = new ConfigManager();
