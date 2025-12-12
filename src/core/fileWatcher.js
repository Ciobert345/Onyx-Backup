const chokidar = require('chokidar');
const logger = require('../utils/logger');
const backupManager = require('./backupManager');
const syncManager = require('./syncManager');
const { isExcluded } = require('../utils/fileUtils');

class FileWatcher {
    constructor() {
        this.watchers = new Map();
        this.debounceTimers = new Map();
        this.changedFiles = new Map(); // jobId -> Set<filePath>
    }

    /**
     * Start watching a job's source folder
     * @param {Object} job - Job configuration
     */
    startWatching(job) {
        if (!job.source || !job.triggerType || job.triggerType !== 'automatic') {
            return;
        }

        // Stop existing watcher if any
        this.stopWatching(job.id);

        logger.info(`Starting file watcher for job ${job.id} on ${job.source}`);

        // Initialize changed files set
        this.changedFiles.set(job.id, new Set());

        const watcher = chokidar.watch(job.source, {
            ignored: (path) => {
                // Ignore exclusions using shared logic
                const exclusions = job.exclusions || [];
                return isExcluded(path, exclusions);
            },
            persistent: true,
            ignoreInitial: true,  // Don't trigger on initial scan
            awaitWriteFinish: {   // Wait for file writes to complete
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        watcher
            .on('add', (path) => this._handleChange(job, 'add', path))
            .on('change', (path) => this._handleChange(job, 'change', path))
            .on('unlink', (path) => this._handleChange(job, 'unlink', path))
            .on('error', (error) => logger.error(`Watcher error for ${job.id}: ${error}`));

        this.watchers.set(job.id, watcher);
        logger.info(`File watcher started for job ${job.id}`);

        // Initial scan removed. We only want to react to NEW changes from now on.
        // If consistency checks are needed, they should be scheduled or manual.
        logger.info(`File watcher ready for job ${job.id}`);
    }

    /**
     * Handle file change events with debouncing
     */
    _handleChange(job, event, path) {
        logger.info(`File ${event}: ${path} (job: ${job.id})`);

        // Add to batch
        if (this.changedFiles.has(job.id)) {
            this.changedFiles.get(job.id).add(path);
        }

        // Clear existing timer
        if (this.debounceTimers.has(job.id)) {
            clearTimeout(this.debounceTimers.get(job.id));
        }

        // Debounce: wait 3 seconds after last change before running backup
        const timer = setTimeout(async () => {
            const filesBatch = Array.from(this.changedFiles.get(job.id) || []);
            this.changedFiles.get(job.id).clear(); // Clear immediately to capture new changes during backup

            if (filesBatch.length === 0) return;

            logger.info(`Triggering automatic ${job.type} for job ${job.id}. Processing ${filesBatch.length} changed files.`);

            try {
                if (job.type === 'sync') {
                    // Sync might still prefer full scan or robust logic, but passing files helps if supported
                    await syncManager.startSync(job.id, filesBatch);
                } else {
                    await backupManager.startBackup(job.id, filesBatch);
                }
            } catch (error) {
                logger.error(`Automatic ${job.type} failed for ${job.id}: ${error.message}`);
            }
            this.debounceTimers.delete(job.id);
        }, 3000);  // 3 second debounce

        this.debounceTimers.set(job.id, timer);
    }

    /**
     * Stop watching a specific job
     */
    stopWatching(jobId) {
        if (this.watchers.has(jobId)) {
            logger.info(`Stopping file watcher for job ${jobId}`);
            this.watchers.get(jobId).close();
            this.watchers.delete(jobId);
        }

        if (this.debounceTimers.has(jobId)) {
            clearTimeout(this.debounceTimers.get(jobId));
            this.debounceTimers.delete(jobId);
        }

        if (this.changedFiles.has(jobId)) {
            this.changedFiles.delete(jobId);
        }
    }

    /**
     * Stop all watchers
     */
    stopAll() {
        logger.info('Stopping all file watchers');
        for (const [jobId, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();

        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.changedFiles.clear();
    }

    /**
     * Initialize watchers from config
     */
    initWatchers(jobs) {
        logger.info('Initializing file watchers');
        this.stopAll();

        for (const job of jobs) {
            if (job.triggerType === 'automatic') {
                this.startWatching(job);
            }
        }
    }
}

module.exports = new FileWatcher();
