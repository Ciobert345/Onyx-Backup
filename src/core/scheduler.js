const cron = require('node-cron');
const { exec } = require('child_process');
const configManager = require('../config/configManager');
const logger = require('../utils/logger');
const backupManager = require('./backupManager');
const syncManager = require('./syncManager');

const fileWatcher = require('./fileWatcher');
const historyManager = require('./historyManager');

const activeTasks = new Map();

// Valid power actions
const VALID_POWER_ACTIONS = ['shutdown', 'restart', 'hibernate', 'BACKUP'];

// Valid days mapping
const DAY_MAP = {
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
    'Sunday': 0
};

/**
 * Validates time format (HH:MM)
 */
function validateTime(time) {
    if (!time || typeof time !== 'string') {
        return { valid: false, error: 'Time must be a string' };
    }

    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) {
        return { valid: false, error: `Invalid time format: ${time}. Expected HH:MM (00:00-23:59)` };
    }

    return { valid: true };
}

/**
 * Validates schedule item
 */
function validateScheduleItem(item, index) {
    const errors = [];

    // Validate required fields
    if (!item.id) {
        errors.push(`Schedule item at index ${index} is missing 'id'`);
    }

    if (!item.time) {
        errors.push(`Schedule item '${item.id || index}' is missing 'time'`);
    } else {
        const timeValidation = validateTime(item.time);
        if (!timeValidation.valid) {
            errors.push(`Schedule item '${item.id || index}': ${timeValidation.error}`);
        }
    }

    if (!item.day) {
        errors.push(`Schedule item '${item.id || index}' is missing 'day'`);
    } else if (item.day !== 'Daily' && !DAY_MAP.hasOwnProperty(item.day)) {
        errors.push(`Schedule item '${item.id || index}' has invalid day: ${item.day}`);
    }

    if (!item.action) {
        errors.push(`Schedule item '${item.id || index}' is missing 'action'`);
    } else if (!VALID_POWER_ACTIONS.includes(item.action) && !VALID_POWER_ACTIONS.includes(item.action.toLowerCase())) {
        errors.push(`Schedule item '${item.id || index}' has invalid action: ${item.action}`);
    }

    // Validate dayOffset for night times
    if (item.time) {
        const [hour] = item.time.split(':').map(Number);
        const isNightTime = !isNaN(hour) && hour >= 0 && hour <= 5;

        if (isNightTime && item.dayOffset !== undefined) {
            if (item.dayOffset !== 0 && item.dayOffset !== 1) {
                errors.push(`Schedule item '${item.id || index}' has invalid dayOffset: ${item.dayOffset}. Must be 0 or 1`);
            }
        } else if (!isNightTime && item.dayOffset !== undefined) {
            // dayOffset should only be set for night times
            logger.warn(`Schedule item '${item.id || index}' has dayOffset set but time is not in night range (00:00-05:59). Ignoring dayOffset.`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validates cron expression before scheduling
 */
function validateCronExpression(cronExp) {
    try {
        // node-cron validates expressions, but we can do a basic check first
        if (!cron.validate(cronExp)) {
            return { valid: false, error: `Invalid cron expression: ${cronExp}` };
        }
        return { valid: true };
    } catch (err) {
        return { valid: false, error: `Cron validation error: ${err.message}` };
    }
}

function executePowerCommand(action, scheduleId = 'unknown') {
    const normalizedAction = action.toLowerCase();

    logger.info(`[Schedule ${scheduleId}] Executing power command: ${normalizedAction}`);

    // Validate action
    if (!VALID_POWER_ACTIONS.includes(normalizedAction)) {
        const error = `Invalid power action: ${action}`;
        logger.error(`[Schedule ${scheduleId}] ${error}`);
        historyManager.addEvent('POWER', `Action: ${action}`, 'failed', error);
        return;
    }

    let cmd = '';
    switch (normalizedAction) {
        case 'shutdown':
            cmd = 'shutdown.exe /s /t 0';
            break;
        case 'restart':
            cmd = 'shutdown.exe /r /t 0';
            break;
        case 'hibernate':
            cmd = 'rundll32 powrprof.dll,SetSuspendState Hibernate';
            break;
        default:
            const error = `Unsupported power action: ${normalizedAction}`;
            logger.error(`[Schedule ${scheduleId}] ${error}`);
            historyManager.addEvent('POWER', `Action: ${action}`, 'failed', error);
            return;
    }

    exec(cmd, { timeout: 5000 }, (err, stdout, stderr) => {
        if (err) {
            const errorMsg = `Power command failed: ${err.message}${stderr ? ` (${stderr})` : ''}`;
            logger.error(`[Schedule ${scheduleId}] ${errorMsg}`);
            historyManager.addEvent('POWER', `Action: ${action}`, 'failed', errorMsg);
            return;
        }

        logger.info(`[Schedule ${scheduleId}] Power command executed successfully${stdout ? `: ${stdout}` : ''}`);
        historyManager.addEvent('POWER', `Action: ${action}`, 'success', 'Executed successfully');
    });
}

function initScheduler() {
    logger.info('Initializing Scheduler...');

    // Clear existing tasks safely
    let clearedCount = 0;
    for (const [key, task] of activeTasks) {
        try {
            if (task && typeof task.stop === 'function') {
                task.stop();
                clearedCount++;
            }
        } catch (err) {
            logger.warn(`Error stopping task ${key}: ${err.message}`);
        }
    }
    activeTasks.clear();
    logger.info(`Cleared ${clearedCount} existing scheduled tasks`);

    const config = configManager.get();
    let scheduledCount = 0;
    let errorCount = 0;

    // 1. Schedule Jobs (Backup/Sync)
    if (config.jobs && Array.isArray(config.jobs)) {
        config.jobs.forEach((job, index) => {
            try {
                if (!job || !job.schedule) {
                    return;
                }

                // Validate cron expression
                const cronValidation = validateCronExpression(job.schedule);
                if (!cronValidation.valid) {
                    logger.error(`Invalid cron expression for job ${job.id || index}: ${cronValidation.error}`);
                    errorCount++;
                    return;
                }

                logger.info(`Scheduling job ${job.id} with cron: ${job.schedule}`);
                const task = cron.schedule(job.schedule, async () => {
                    try {
                        logger.info(`[Job ${job.id}] Running scheduled job`);
                        if (job.type === 'sync') {
                            await syncManager.startSync(job.id);
                        } else {
                            await backupManager.startBackup(job.id);
                        }
                        logger.info(`[Job ${job.id}] Scheduled job completed successfully`);
                    } catch (err) {
                        logger.error(`[Job ${job.id}] Scheduled job failed: ${err.message}`);
                        historyManager.addEvent('BACKUP', `Scheduled job ${job.id}`, 'failed', err.message);
                    }
                }, {
                    scheduled: true,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
                });

                activeTasks.set(`job-${job.id}`, task);
                scheduledCount++;
            } catch (err) {
                logger.error(`Error scheduling job ${job.id || index}: ${err.message}`);
                errorCount++;
            }
        });
    }

    // 2. Schedule System Actions & Backup Tasks
    if (config.scheduler && Array.isArray(config.scheduler)) {
        config.scheduler.forEach((item, index) => {
            try {
                // Skip disabled tasks
                if (!item.enabled) {
                    logger.debug(`Skipping disabled task: ${item.action} at ${item.time} on ${item.day}`);
                    return;
                }

                // Check group status
                const schedulerGroups = config.schedulerGroups || [];
                if (item.groupId) {
                    const group = schedulerGroups.find(g => g.id === item.groupId);
                    if (group && !group.enabled) {
                        logger.debug(`Skipping task ${item.id} because group '${group.name}' is disabled`);
                        return;
                    }
                }

                // Validate schedule item
                const validation = validateScheduleItem(item, index);
                if (!validation.valid) {
                    logger.error(`Invalid schedule item at index ${index} (ID: ${item.id || 'unknown'}): ${validation.errors.join('; ')}`);
                    errorCount++;
                    return;
                }

                // Parse time safely
                const timeParts = item.time.split(':');
                if (timeParts.length !== 2) {
                    logger.error(`[Schedule ${item.id}] Invalid time format: ${item.time}`);
                    errorCount++;
                    return;
                }

                const hour = parseInt(timeParts[0], 10);
                const minute = parseInt(timeParts[1], 10);

                // Validate parsed values
                if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                    logger.error(`[Schedule ${item.id}] Invalid time values: hour=${hour}, minute=${minute}`);
                    errorCount++;
                    return;
                }

                const isNightTime = hour >= 0 && hour <= 5; // 00:00 - 05:59

                // Convert day to cron format with day offset handling for night times
                let cronDay = '*';
                if (item.day !== 'Daily') {
                    let targetDay = DAY_MAP[item.day];

                    if (targetDay === undefined) {
                        logger.error(`[Schedule ${item.id}] Invalid day '${item.day}'. Skipping to prevent accidental daily execution.`);
                        errorCount++;
                        return;
                    }

                    // Handle day offset for night times (00:00-05:59)
                    // dayOffset: 0 = same day morning, 1 = next day night (default for night times)
                    if (isNightTime && item.dayOffset === 1) {
                        // Shift to next day (e.g., Monday 02:00 with offset=1 means Tuesday 02:00)
                        targetDay = (targetDay + 1) % 7;
                        logger.info(`[Schedule ${item.id}] Night time schedule: shifting ${item.day} to next day (cron day ${targetDay})`);
                    }

                    cronDay = targetDay;
                }

                const cronExp = `${minute} ${hour} * * ${cronDay}`;

                // Validate cron expression
                const cronValidation = validateCronExpression(cronExp);
                if (!cronValidation.valid) {
                    logger.error(`[Schedule ${item.id}] ${cronValidation.error}`);
                    errorCount++;
                    return;
                }

                logger.info(`[Schedule ${item.id}] Scheduling ${item.type || 'power'} action ${item.action} at ${item.time} on day ${item.day}${isNightTime && item.dayOffset !== undefined ? ` (${item.dayOffset === 0 ? 'same day' : 'next day'})` : ''}`);

                const task = cron.schedule(cronExp, async () => {
                    try {
                        if (item.action === 'BACKUP') {
                            // Run backup job
                            logger.info(`[Schedule ${item.id}] Running scheduled backup...`);
                            historyManager.addEvent('BACKUP', 'Scheduled Backup Triggered', 'info', 'Starting backup process...');
                            await backupManager.startBackup('manual-backup');
                            logger.info(`[Schedule ${item.id}] Scheduled backup completed`);
                        } else {
                            // Power command
                            executePowerCommand(item.action, item.id);
                        }
                    } catch (err) {
                        logger.error(`[Schedule ${item.id}] Scheduled task execution failed: ${err.message}`);
                        historyManager.addEvent('POWER', `Scheduled task ${item.id}`, 'failed', err.message);
                    }
                }, {
                    scheduled: true,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
                });

                activeTasks.set(`sched-${item.id}`, task);
                scheduledCount++;
            } catch (err) {
                logger.error(`Error scheduling item at index ${index} (ID: ${item.id || 'unknown'}): ${err.message}`);
                errorCount++;
            }
        });
    }

    // 3. Initialize File Watchers for automatic triggers
    if (config.jobs && Array.isArray(config.jobs)) {
        try {
            fileWatcher.initWatchers(config.jobs);
        } catch (err) {
            logger.error(`Error initializing file watchers: ${err.message}`);
        }
    }

    logger.info(`Scheduler initialization complete. Scheduled: ${scheduledCount}, Errors: ${errorCount}`);
}

/**
 * Get scheduler status and statistics
 */
function getSchedulerStatus() {
    return {
        activeTasksCount: activeTasks.size,
        activeTaskIds: Array.from(activeTasks.keys()),
        isInitialized: activeTasks.size >= 0 // Always true after first init
    };
}

/**
 * Stop a specific scheduled task by ID
 */
function stopTask(taskId) {
    const task = activeTasks.get(taskId);
    if (task) {
        try {
            task.stop();
            activeTasks.delete(taskId);
            logger.info(`Stopped scheduled task: ${taskId}`);
            return { success: true };
        } catch (err) {
            logger.error(`Error stopping task ${taskId}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
    return { success: false, error: `Task ${taskId} not found` };
}

/**
 * Get list of all scheduled items (for debugging/monitoring)
 */
function getScheduledItems() {
    const config = configManager.get();
    return {
        jobs: config.jobs || [],
        scheduler: config.scheduler || [],
        groups: config.schedulerGroups || [],
        activeTasks: Array.from(activeTasks.keys())
    };
}

module.exports = {
    initScheduler,
    getSchedulerStatus,
    stopTask,
    getScheduledItems,
    validateScheduleItem,
    validateTime,
    validateCronExpression
};
