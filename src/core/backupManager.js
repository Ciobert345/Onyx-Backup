const fs = require('fs-extra');
const path = require('path');
const configManager = require('../config/configManager');
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
async function startBackup(jobId, specificFiles = null) {
    const jobs = configManager.get('jobs');
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
        logger.error(`Backup job ${jobId} not found.`);
        return;
    }

    const isIncremental = specificFiles && specificFiles.length > 0;
    logger.info(`Starting backup job: ${job.id} (${job.source} -> ${job.dest}) ${isIncremental ? `[Incremental: ${specificFiles.length} files]` : '[Full Scan]'}`);

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
        if (job.dest.startsWith('drive://')) {
            await handleDriveBackup(job, allExclusions, specificFiles);
        } else {
            // Local Backup
            await handleLocalBackup(job, allExclusions, specificFiles);
        }

        // Only log "Completed" if it wasn't a tiny incremental (spam reduction)
        // Or log differently.
        logger.info(`Backup job ${jobId} completed.`);

        // For incremental, maybe skip full stats recalculation to save IO?
        // But user wants to see storage used.
        // Let's do stats only on Full Scan or infrequent updates
        let stats = { size: 0, count: 0 };
        if (!isIncremental) {
            stats = await getDirectoryStats(job.source, allExclusions);
            // Update Status: Success
            configManager.set('status', {
                ...configManager.get('status'),
                isRunning: false,
                lastBackup: new Date().toISOString(),
                lastBackupStatus: 'success',
                storageUsed: stats.size,
                totalFiles: stats.count
            });
        } else {
            // Just mark not running
            configManager.set('status', {
                ...configManager.get('status'),
                isRunning: false,
                lastBackup: new Date().toISOString(),
                lastBackupStatus: 'success'
            });
        }

        // Log History
        const typeStr = job.dest.startsWith('drive://') ? 'Cloud Backup' : 'Local Backup';
        const msg = isIncremental
            ? `Incremental backup: ${specificFiles.length} files updated.`
            : `Full backup completed.`;

        await historyManager.addEvent('BACKUP', typeStr, 'success', msg);

    } catch (error) {
        logger.error(`Backup job ${jobId} failed: ${error.message}`);

        // Update Status: Failed
        configManager.set('status', {
            ...configManager.get('status'),
            isRunning: false,
            lastBackupStatus: 'failed'
        });

        await historyManager.addEvent('BACKUP', 'Backup Failed', 'failed', `${job.dest}: ${error.message}`);

        throw error;
    }
}

async function handleLocalBackup(job, exclusions, specificFiles) {
    // Ensure destination exists
    await fs.ensureDir(job.dest);

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

            const relativePath = path.relative(job.source, file);
            const destPath = path.join(job.dest, relativePath);

            try {
                if (await fs.pathExists(file)) {
                    await fs.copy(file, destPath, { overwrite: true, errorOnExist: false });
                } else {
                    // File might have been deleted locally
                    // Optional: Delete from dest if exist (Sync behavior)
                    // For now, if file missing, ignore (it was an unlink event)
                    if (await fs.pathExists(destPath)) {
                        // If we want to reflect deletions:
                        // await fs.remove(destPath); 
                        // logger.info(`Deleted ${destPath}`);
                    }
                }
            } catch (err) {
                logger.error(`Failed to copy ${file}: ${err.message}`);
            }
        }
    } else {
        // Full Scan
        await fs.copy(job.source, job.dest, {
            overwrite: true,
            errorOnExist: false,
            filter: filterFunc
        });
    }
}

async function handleDriveBackup(job, exclusions, specificFiles) {
    // dest format: drive://FolderId
    const folderId = job.dest.replace('drive://', '');
    logger.info(`Uploading to Drive folder ID: ${folderId}`);

    let stats = { scanned: 0, uploaded: 0, updated: 0, skipped: 0 };

    if (specificFiles) {
        // Incremental Mode
        for (const filePath of specificFiles) {
            if (isExcluded(filePath, exclusions)) continue;

            // Check if file still exists (it might be an unlink event)
            if (!await fs.pathExists(filePath)) {
                // Handle deletion? 
                // We don't have the drive ID of the deleted file easily unless we look up cache.
                // cacheManager.removeFromCache(job.id, filePath) then..
                // Ideally finding the file on Drive and trashing it.
                // For now, skip.
                continue;
            }

            try {
                // We need to find the parent folder ID on Drive for this specific file
                // Path relative to source
                const relativePath = path.relative(job.source, filePath);
                const dirName = path.dirname(relativePath); // e.g., "sub/folder" or "."

                let parentId = folderId; // Default to root

                if (dirName !== '.') {
                    // We need to ensure the directory structure exists on Drive
                    // This is overhead, but necessary.
                    parentId = await ensureDrivePath(dirName, folderId);
                }

                // Now upload/update the file
                const cacheCheck = await fileCacheManager.needsUpload(job.id, filePath, parentId);

                if (cacheCheck.needsUpload) {
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

            } catch (err) {
                logger.error(`Failed to incremental upload ${filePath}: ${err.message}`);
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
                    const cacheCheck = await fileCacheManager.needsUpload(job.id, fullPath, parentFolderId);
                    if (cacheCheck.needsUpload) {
                        let driveFileId;
                        try {
                            if (cacheCheck.driveFileId) {
                                logger.info(`Updating file: ${path.basename(fullPath)}`);
                                driveFileId = await driveAdapter.updateFile(fullPath, cacheCheck.driveFileId);
                                stats.updated++;
                            } else {
                                logger.info(`Uploading new file: ${path.basename(fullPath)}`);
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
}

module.exports = { startBackup };
