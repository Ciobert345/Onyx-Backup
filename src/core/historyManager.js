const { app } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

// Use userData directory for persistent storage (same as configManager)
// This ensures data persists across reboots and app updates
const HISTORY_FILE = path.join(app.getPath('userData'), 'history.json');
const OLD_HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');

// Ensure data directory exists
fs.ensureDirSync(app.getPath('userData'));

/**
 * Migrate old history file from data/ to userData/ if it exists
 * This is called once at module load
 */
async function migrateHistory() {
    if (fs.existsSync(OLD_HISTORY_FILE) && !fs.existsSync(HISTORY_FILE)) {
        try {
            logger.info(`Migrating history from ${OLD_HISTORY_FILE} to ${HISTORY_FILE}`);
            const oldHistory = await fs.readJson(OLD_HISTORY_FILE);
            await fs.writeJson(HISTORY_FILE, oldHistory, { spaces: 2 });
            logger.info('History migration completed successfully');
        } catch (err) {
            logger.error(`Failed to migrate history: ${err.message}`);
        }
    }
}

// Run migration asynchronously (non-blocking)
migrateHistory().catch(err => {
    logger.error(`History migration error: ${err.message}`);
});

/**
 * Adds an event to the history log.
 * @param {string} category - 'BACKUP' or 'POWER'
 * @param {string} action - e.g., 'Backup Completed', 'Shutdown Executed'
 * @param {string} status - 'success', 'failed', 'info'
 * @param {string} details - Additional info
 */
async function addEvent(category, action, status, details = '') {
    try {
        let history = [];
        if (await fs.pathExists(HISTORY_FILE)) {
            history = await fs.readJson(HISTORY_FILE);
        }

        const newEvent = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            category,
            action,
            status,
            details
        };

        // Prepend new event
        history.unshift(newEvent);

        // Limit to last 200 events
        if (history.length > 200) {
            history = history.slice(0, 200);
        }

        await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });
    } catch (error) {
        logger.error(`Failed to write history: ${error.message}`);
    }
}

async function getHistory() {
    try {
        if (await fs.pathExists(HISTORY_FILE)) {
            return await fs.readJson(HISTORY_FILE);
        }
        return [];
    } catch (error) {
        logger.error(`Failed to read history: ${error.message}`);
        return [];
    }
}

async function clearHistory() {
    try {
        await fs.writeJson(HISTORY_FILE, []);
        return true;
    } catch (error) {
        logger.error(`Failed to clear history: ${error.message}`);
        return false;
    }
}

module.exports = {
    addEvent,
    getHistory,
    clearHistory
};
