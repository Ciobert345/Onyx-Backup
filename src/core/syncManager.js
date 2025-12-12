const fs = require('fs-extra');
const path = require('path');
const configManager = require('../config/configManager');
const logger = require('../utils/logger');
const { isExcluded, getDirectoryStats } = require('../utils/fileUtils');

/**
 * returns: { added: [], modified: [], deleted: [] }
 * Note: simplistic "analyze" for 2-way sync usually means:
 * - Files in A but not B -> Copy A to B
 * - Files in B but not A -> Copy B to A
 * - Files in both -> Copy newer to older
 * 
 * "deleted" is tricky in 2-way sync (propagation of deletes) wihtout a state database.
 * We will implement a "Union" sync (newest/existence wins).
 */
async function analyzeChanges(jobId) {
    const jobs = configManager.get('jobs');
    const job = jobs.find(j => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const globalExclusions = configManager.get('globalExclusions') || [];
    const allExclusions = [...globalExclusions, ...(job.exclusions || [])];

    const changes = {
        copyToDest: [],   // Source -> Dest
        copyToSource: [], // Dest -> Source
        conflicts: []
    };

    // Helper to get recursive file list
    async function getFiles(dir, baseDir) {
        let results = [];
        const list = await fs.readdir(dir);
        for (const file of list) {
            const fullPath = path.join(dir, file);
            if (isExcluded(fullPath, allExclusions)) continue;

            const stat = await fs.stat(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(await getFiles(fullPath, baseDir));
            } else {
                results.push({
                    path: fullPath,
                    relPath: path.relative(baseDir, fullPath),
                    mtime: stat.mtimeMs
                });
            }
        }
        return results;
    }

    // Just in case directories don't exist
    if (!fs.existsSync(job.source)) throw new Error(`Source ${job.source} does not exist`);
    await fs.ensureDir(job.dest);

    const sourceFiles = await getFiles(job.source, job.source);
    const destFiles = await getFiles(job.dest, job.dest);

    const sourceMap = new Map(sourceFiles.map(f => [f.relPath, f]));
    const destMap = new Map(destFiles.map(f => [f.relPath, f]));

    // Check Source against Dest
    for (const [relPath, sFile] of sourceMap) {
        if (!destMap.has(relPath)) {
            changes.copyToDest.push(relPath);
        } else {
            const dFile = destMap.get(relPath);
            if (sFile.mtime > dFile.mtime) {
                changes.copyToDest.push(relPath);
            } else if (dFile.mtime > sFile.mtime) {
                changes.copyToSource.push(relPath);
            }
        }
    }

    // Check Dest against Source (for new files in Dest)
    for (const [relPath, dFile] of destMap) {
        if (!sourceMap.has(relPath)) {
            changes.copyToSource.push(relPath);
        }
    }

    return changes;
}

async function startSync(jobId) {
    const jobs = configManager.get('jobs');
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
        logger.error(`Sync job ${jobId} not found.`);
        return;
    }

    logger.info(`Starting sync job: ${jobId}`);

    // Update Status: Running
    configManager.set('status', {
        ...configManager.get('status'),
        isRunning: true,
        lastBackupStatus: 'running'
    });

    try {
        const changes = await analyzeChanges(jobId);

        // Execute changes
        // 1. Copy to Dest
        for (const relPath of changes.copyToDest) {
            const valSource = path.join(job.source, relPath);
            const valDest = path.join(job.dest, relPath);
            await fs.ensureDir(path.dirname(valDest));
            await fs.copy(valSource, valDest, { overwrite: true });
            logger.info(`Sync: Copied to dest -> ${relPath}`);
        }

        // 2. Copy to Source
        for (const relPath of changes.copyToSource) {
            const valSource = path.join(job.source, relPath); // This is where we write TO
            const valDest = path.join(job.dest, relPath); // This is where we read FROM
            await fs.ensureDir(path.dirname(valSource));
            await fs.copy(valDest, valSource, { overwrite: true });
            logger.info(`Sync: Copied to source -> ${relPath}`);
        }

        logger.info(`Sync job ${jobId} finished.`);

        // Calculate Stats (sync dir should match source)
        const globalExclusions = configManager.get('globalExclusions') || [];
        const jobExclusions = job.exclusions || [];
        const allExclusions = [...globalExclusions, ...jobExclusions];
        const stats = await getDirectoryStats(job.source, allExclusions);

        // Update Status: Success
        configManager.set('status', {
            ...configManager.get('status'),
            isRunning: false,
            lastBackup: new Date().toISOString(),
            lastBackupStatus: 'success',
            storageUsed: stats.size,
            totalFiles: stats.count
        });
    } catch (err) {
        logger.error(`Sync failed: ${err.message}`);

        // Update Status: Failed
        configManager.set('status', {
            ...configManager.get('status'),
            isRunning: false,
            lastBackupStatus: 'failed'
        });

        throw err;
    }
}

module.exports = { startSync, analyzeChanges };
