const fs = require('fs-extra');
const path = require('path');

const configManager = require('../config/configManager');
console.log(`[DEBUG] backupManager.js loaded ConfigManager. InstanceID: ${configManager.instanceId}`);
const logger = require('../utils/logger');
const historyManager = require('./historyManager');
const { isExcluded, getDirectoryStats } = require('../utils/fileUtils');
const driveAdapter = require('./driveAdapter');
const fileCacheManager = require('./fileCacheManager');

/**
 * Performs a one-way backup from source to destination.
 * @param {string} jobId - The ID of the job to run.
 * @param {string[]} [specificFiles] - Optional list of specific files to backup (incremental mode).
 */
async function startBackup(jobId, specificFiles = null, onProgress = null) {
    const jobs = configManager.get('jobs');
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
        const errorMsg = `Backup job ${jobId} not found. Available jobs: ${jobs.map(j => j.id).join(', ')}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
    }

    const isIncremental = specificFiles && specificFiles.length > 0;

    // Calculate total files for progress bar
    let totalFiles = 0;
    if (isIncremental) {
        totalFiles = specificFiles.length;
    } else {
        logger.info(`Calculating total files for ${job.source}...`);
        // Simple recursive count
        const countFiles = async (dir) => {
            let count = 0;
            try {
                const entries = await fs.readdir(dir);
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry);
                    if (isExcluded(fullPath, job.exclusions || [])) continue;
                    const stat = await fs.stat(fullPath);
                    if (stat.isDirectory()) {
                        count += await countFiles(fullPath);
                    } else {
                        count++;
                    }
                }
            } catch (e) {
                // ignore access errors
            }
            return count;
        };
        totalFiles = await countFiles(job.source);
    }

    logger.info(`Starting backup job: ${job.id} (${job.source} -> ${job.dest}) ${isIncremental ? `[Incremental]` : '[Full Scan]'} - Total Files: ${totalFiles}`);

    // Update Status: Running
    configManager.set('status', {
        ...configManager.get('status'),
        isRunning: true,
        lastBackupStatus: 'running'
    });

    try {
        const globalExclusions = configManager.get('globalExclusions') || [];
        const jobExclusions = job.exclusions || [];
        const allExclusions = [...globalExclusions, ...jobExclusions];

        // Check if Drive Backup
        let runStats = null;
        if (job.dest.startsWith('drive://')) {
            runStats = await handleDriveBackup(job, allExclusions, specificFiles, onProgress, totalFiles);
        } else {
            // Local Backup
            await handleLocalBackup(job, allExclusions, specificFiles, onProgress, totalFiles);
        }

        // Only log "Completed" if it wasn't a tiny incremental (spam reduction)
        // Or log differently.
        logger.info(`Backup job ${jobId} completed.`);

        // Return run stats logic moved to end
        // if (runStats) return runStats;

        // Always recalculate stats (Local vs Drive)
        // Or log differently.
        logger.info(`Backup job ${jobId} completed.`);

        // For incremental, maybe skip full stats recalculation to save IO?
        // But user wants to see storage used.
        // Let's do stats only on Full Scan or infrequent updates
        // Always recalculate stats (Local vs Drive)
        let stats = { size: 0, count: 0 };
        if (job.dest.startsWith('drive://')) {
            const folderId = job.dest.replace('drive://', '');
            logger.info(`Fetching remote stats from Google Drive (Folder: ${folderId})...`);
            stats = await driveAdapter.getFolderStats(folderId);
        } else {
            stats = await getDirectoryStats(job.source, allExclusions);
        }

        logger.info(`Final Stats: Size=${stats.size}, Count=${stats.count}`);

        // Update Status: Success
        configManager.set('status', {
            ...configManager.get('status'),
            isRunning: false,
            lastBackup: new Date().toISOString(),
            lastBackupStatus: 'success',
            storageUsed: stats.size,
            totalFiles: stats.count,
            lastError: null
        });

        // Determine final stats to return (prefer runStats if available)
        const finalReturn = runStats || { success: true };
        console.log('[DEBUG] backupManager check: finalReturn=', JSON.stringify(finalReturn));

        // Log History
        const typeStr = job.dest.startsWith('drive://') ? 'Cloud Backup' : 'Local Backup';
        const msg = isIncremental
            ? `Incremental backup: ${specificFiles.length} files updated.`
            : `Full backup completed.`;

        await historyManager.addEvent('BACKUP', typeStr, 'success', msg);

        return finalReturn;

    } catch (error) {
        logger.error(`Backup job ${jobId} failed: ${error.message}`);

        // Update Status: Failed
        configManager.set('status', {
            ...configManager.get('status'),
            isRunning: false,
            lastBackupStatus: 'failed',
            lastError: error.message
        });

        await historyManager.addEvent('BACKUP', 'Backup Failed', 'failed', `${job.dest}: ${error.message}`);

        throw error;
    }
}

async function handleLocalBackup(job, exclusions, specificFiles, onProgress, totalFiles = 0) {
    // Ensure destination exists
    await fs.ensureDir(job.dest);

    let processedCount = 0;
    const notifyProgress = (file) => {
        processedCount++;
        if (onProgress) onProgress({ processed: processedCount, total: totalFiles, currentFile: path.basename(file) });
    };

    // Filter
    const filterFunc = (src, dest) => {
        if (isExcluded(src, exclusions)) return false;
        return true;
    };

    if (specificFiles) {
        // Incremental: Copy only specific files
        for (const file of specificFiles) {
            // file is absolute source path
            if (isExcluded(file, exclusions)) continue;

            // Notify start of processing for this file
            if (onProgress) onProgress({ processed: processedCount, total: totalFiles, currentFile: path.basename(file) });

            const relativePath = path.relative(job.source, file);
            const destPath = path.join(job.dest, relativePath);

            try {
                if (await fs.pathExists(file)) {
                    await fs.copy(file, destPath, { overwrite: true, errorOnExist: false });
                    notifyProgress(file);
                } else {
                    // File might have been deleted locally
                    if (await fs.pathExists(destPath)) {
                        // Optional deletion logic
                    }
                }
            } catch (err) {
                logger.error(`Failed to copy ${file}: ${err.message}`);
            }
        }
    } else {
        // Full Scan - copy method doesn't support granular progress easily without walking.
        // For better UX, we should probably walk. But for now, let's keep it simple and just use the copy.
        // Or finding total files first.
        // LIMITATION: 'fs.copy' is atomic for the caller. We won't get per-file callbacks easily unless we use filter to track.

        let scannedCount = 0;
        const progressFilter = (src, dest) => {
            if (isExcluded(src, exclusions)) return false;
            // We can use this to track progress vaguely
            if (fs.statSync(src).isFile()) {
                scannedCount++;
                if (scannedCount % 5 === 0 || scannedCount === 1) {
                    logger.info(`Processing file ${scannedCount}: ${path.basename(src)}`);
                }
                if (onProgress) onProgress({ processed: scannedCount, total: totalFiles, currentFile: path.basename(src) });
            }
            return true;
        };

        await fs.copy(job.source, job.dest, {
            overwrite: true,
            errorOnExist: false,
            filter: progressFilter
        });
    }
}

async function handleDriveBackup(job, exclusions, specificFiles, onProgress, totalFiles = 0) {
    // dest format: drive://FolderId
    const folderId = job.dest.replace('drive://', '');
    logger.info(`Uploading to Drive folder ID: ${folderId}`);

    let stats = { scanned: 0, uploaded: 0, updated: 0, skipped: 0 };
    let processedCount = 0;

    const notifyProgress = (file) => {
        processedCount++;
        if (onProgress) onProgress({ processed: processedCount, total: totalFiles, currentFile: path.basename(file) });
    };

    if (specificFiles) {
        // Incremental Mode
        for (const filePath of specificFiles) {
            if (isExcluded(filePath, exclusions)) continue;

            if (onProgress) onProgress({ processed: processedCount, total: totalFiles, currentFile: path.basename(filePath) + ' (Preparing...)' });

            if (!await fs.pathExists(filePath)) {
                continue;
            }

            try {
                const relativePath = path.relative(job.source, filePath);
                const dirName = path.dirname(relativePath);
                let parentId = folderId;

                if (dirName !== '.') {
                    parentId = await ensureDrivePath(dirName, folderId);
                }

                let cacheCheck = await fileCacheManager.needsUpload(job.id, filePath, parentId);

                // DOUBLE CHECK: If cache says "unchanged", verify it actually exists on Drive
                // This handles the case where user deleted file on Drive but Cache thinks it's there.
                if (!cacheCheck.needsUpload && cacheCheck.driveFileId) {
                    const existsOnDrive = await driveAdapter.checkFileExists(cacheCheck.driveFileId);
                    if (!existsOnDrive) {
                        logger.info(`File ${path.basename(filePath)} missing on Drive despite cache. Forcing upload.`);
                        cacheCheck.needsUpload = true;
                        cacheCheck.driveFileId = null; // Reset ID to force create/search by name
                    }
                }

                if (cacheCheck.needsUpload) {
                    if (onProgress) onProgress({ processed: processedCount, total: totalFiles, currentFile: path.basename(filePath) + ' (Uploading...)' });

                    let driveFileId;
                    if (cacheCheck.driveFileId) {
                        logger.info(`Updating file: ${path.basename(filePath)}`);
                        driveFileId = await driveAdapter.updateFile(filePath, cacheCheck.driveFileId);
                        stats.updated++;
                    } else {
                        logger.info(`Uploading new file: ${path.basename(filePath)}`);
                        const uploadedFile = await driveAdapter.uploadFile(filePath, parentId);
                        driveFileId = uploadedFile.id;
                        stats.uploaded++;
                    }
                    await fileCacheManager.updateCache(job.id, filePath, driveFileId, parentId);
                } else {
                    stats.skipped++;
                }
                notifyProgress(filePath);

            } catch (err) {
                logger.error(`Failed to backup ${filePath}: ${err.message}`);
            }
        }
    } else {
        // Full Scan Mode (Recursive)
        async function walkAndUpload(currentDir, parentFolderId) {
            const list = await fs.readdir(currentDir);
            for (const file of list) {
                const fullPath = path.join(currentDir, file);
                if (isExcluded(fullPath, exclusions)) continue;

                const stat = await fs.stat(fullPath);
                if (stat.isDirectory()) {
                    const subFolder = await driveAdapter.ensureFolder(file, parentFolderId);
                    await walkAndUpload(fullPath, subFolder.id);
                } else {
                    stats.scanned++;
                    if (onProgress) onProgress({ processed: stats.scanned, total: totalFiles, currentFile: file });

                    let cacheCheck = await fileCacheManager.needsUpload(job.id, fullPath, parentFolderId);

                    // DOUBLE CHECK INTEGRITY
                    if (!cacheCheck.needsUpload && cacheCheck.driveFileId) {
                        const exists = await driveAdapter.checkFileExists(cacheCheck.driveFileId);
                        if (!exists) {
                            logger.info(`FullScan: File ${file} missing on Drive. Forcing upload.`);
                            cacheCheck.needsUpload = true;
                            cacheCheck.driveFileId = null;
                        }
                    }

                    if (cacheCheck.needsUpload) {
                        if (onProgress) onProgress({ processed: stats.scanned, total: totalFiles, currentFile: file + ' (Uploading...)' });
                        let driveFileId;
                        try {
                            if (cacheCheck.driveFileId) {
                                logger.info(`Updating file: ${file}`);
                                driveFileId = await driveAdapter.updateFile(fullPath, cacheCheck.driveFileId);
                                stats.updated++;
                            } else {
                                logger.info(`Uploading new file: ${file}`);
                                const uploadedFile = await driveAdapter.uploadFile(fullPath, parentFolderId);
                                driveFileId = uploadedFile.id;
                                stats.uploaded++;
                            }
                            await fileCacheManager.updateCache(job.id, fullPath, driveFileId, parentFolderId);
                        } catch (err) {
                            logger.error(`Failed to process ${fullPath}: ${err.message}`);
                        }
                    } else {
                        stats.skipped++;
                    }
                }
            }
        }
        await walkAndUpload(job.source, folderId);
    }

    return stats;
}

// Helper to walk down drive folders for a path
async function ensureDrivePath(relativePath, rootId) {
    const parts = relativePath.split(/[/\\]/); // split by / or \
    let currentId = rootId;
    for (const part of parts) {
        if (!part || part === '.') continue;
        // This relies on ensureFolder checking if it exists
        const folder = await driveAdapter.ensureFolder(part, currentId);
        currentId = folder.id;
    }
    return currentId;
}




function getProgress() {
    // Return a global progress object if we track it module-level
    // Currently we rely on callbacks only. Let's make a hacky global tracker for IPC.
    return globalProgress;
}

// Module-level tracker
let globalProgress = null;

// Wrap startBackup to capture progress globally
const originalStartBackup = startBackup;
startBackup = async (jobId, specificFiles = null, onProgress = null) => {
    // Intercept callback
    const wrappedOnProgress = (data) => {
        globalProgress = data;
        if (onProgress) onProgress(data);
    };

    // Clear old progress
    globalProgress = { processed: 0, currentFile: 'Starting...' };

    try {
        return await originalStartBackup(jobId, specificFiles, wrappedOnProgress);
    } finally {
        // Keep last status for a moment or clear? 
        // Let's keep it until next job starts or explicit clear.
        // Actually, clearing it might hide "Completed" state.
        // But getStatus checks isRunning.
        globalProgress = null;
    }
};

module.exports = { startBackup, getProgress };
