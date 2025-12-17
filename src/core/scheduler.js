const cron = require('node-cron');
const { exec } = require('child_process');
const configManager = require('../config/configManager');
const logger = require('../utils/logger');
const backupManager = require('./backupManager');
const syncManager = require('./syncManager');

const fileWatcher = require('./fileWatcher');
const historyManager = require('./historyManager');

const activeTasks = new Map();

function executePowerCommand(action) {
    logger.info(`Executing power command: ${action}`);
    let cmd = '';
    switch (action) {
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
            logger.warn(`Unknown power action: ${action}`);
            return;
    }

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            logger.error(`Power command failed: ${err.message}`);
            historyManager.addEvent('POWER', `Action: ${action}`, 'failed', err.message);
            return;
        }
        logger.info(`Power command output: ${stdout}`);
        historyManager.addEvent('POWER', `Action: ${action}`, 'success', 'Executed successfully');
    });
}

function initScheduler() {
    logger.info('Initializing Scheduler...');

    // Clear existing tasks
    for (const [key, task] of activeTasks) {
        task.stop();
    }
    activeTasks.clear();

    const config = configManager.get();

    // 1. Schedule Jobs (Backup/Sync)
    if (config.jobs) {
        config.jobs.forEach(job => {
            if (job.schedule) {
                logger.info(`Scheduling job ${job.id} with cron: ${job.schedule}`);
                const task = cron.schedule(job.schedule, async () => {
                    logger.info(`Running scheduled job: ${job.id}`);
                    if (job.type === 'sync') {
                        await syncManager.startSync(job.id);
                    } else {
                        await backupManager.startBackup(job.id);
                    }
                });
                activeTasks.set(`job-${job.id}`, task);
            }
        });
    }

    // 2. Schedule System Actions & Backup Tasks
    if (config.scheduler) {
        config.scheduler.forEach((item, index) => {
            if (!item.enabled) {
                logger.info(`Skipping disabled task: ${item.action} at ${item.time} on ${item.day}`);
                return;
            }

            // item: { day, time, action, type }
            // Convert day to cron format
            let cronDay = '*';
            if (item.day !== 'Daily') {
                const dayMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
                cronDay = dayMap[item.day];

                if (cronDay === undefined) {
                    logger.warn(`Invalid day '${item.day}' for task '${item.action}'. Skipping to prevent accidental daily execution.`);
                    return;
                }
            }

            const [hour, minute] = item.time.split(':');
            const cronExp = `${minute} ${hour} * * ${cronDay}`;

            logger.info(`Scheduling ${item.type || 'power'} action ${item.action} at ${item.time} on day ${item.day}`);

            const task = cron.schedule(cronExp, async () => {
                if (item.action === 'BACKUP') {
                    // Run backup job
                    logger.info('Running scheduled backup...');
                    historyManager.addEvent('BACKUP', 'Scheduled Backup Triggered', 'info', 'Starting backup process...');
                    await backupManager.startBackup('manual-backup');
                } else {
                    // Power command
                    executePowerCommand(item.action.toLowerCase());
                }
            });
            activeTasks.set(`sched-${index}`, task);
        });
    }

    // 3. Initialize File Watchers for automatic triggers
    if (config.jobs) {
        fileWatcher.initWatchers(config.jobs);
    }
}

module.exports = { initScheduler };
