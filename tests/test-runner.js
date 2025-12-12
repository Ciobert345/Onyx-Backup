const fs = require('fs-extra');
const path = require('path');
const configManager = require('../src/config/configManager');
const backupManager = require('../src/core/backupManager');
const syncManager = require('../src/core/syncManager');
const logger = require('../src/utils/logger');

// Setup test environment
const TEST_DIR = path.join(process.cwd(), 'test-env');
const SOURCE_DIR = path.join(TEST_DIR, 'source');
const DEST_DIR = path.join(TEST_DIR, 'dest');

async function runTests() {
    console.log('--- STARTING BACKEND VERIFICATION ---');

    try {
        // 1. Cleanup & Setup
        await fs.remove(TEST_DIR);
        await fs.ensureDir(SOURCE_DIR);
        await fs.ensureDir(DEST_DIR);

        // Create dummy files
        await fs.writeFile(path.join(SOURCE_DIR, 'file1.txt'), 'content1');
        await fs.writeFile(path.join(SOURCE_DIR, 'file2.log'), 'should be excluded');
        await fs.writeFile(path.join(SOURCE_DIR, 'file3.txt'), 'content3');

        // 2. Configure Jobs
        const backupJob = {
            id: 'job-backup-1',
            source: SOURCE_DIR,
            dest: path.join(DEST_DIR, 'backup'),
            type: 'backup',
            exclusions: ['*.log']
        };

        const syncJob = {
            id: 'job-sync-1',
            source: SOURCE_DIR,
            dest: path.join(DEST_DIR, 'sync'),
            type: 'sync',
            exclusions: ['*.log']
        };

        configManager.updateJob(backupJob);
        configManager.updateJob(syncJob);

        // 3. Test BACKUP
        console.log('\n[TEST] Running Backup Job...');
        await backupManager.startBackup('job-backup-1');

        const backupFile1 = path.join(backupJob.dest, 'file1.txt');
        const backupFileLog = path.join(backupJob.dest, 'file2.log');

        if (fs.existsSync(backupFile1) && !fs.existsSync(backupFileLog)) {
            console.log('PASS: Backup copied valid files and excluded .log files.');
        } else {
            console.error('FAIL: Backup verification failed.');
        }

        // 4. Test SYNC (Initial Copy)
        console.log('\n[TEST] Running Sync Job (Initial)...');
        await syncManager.startSync('job-sync-1');
        if (fs.existsSync(path.join(syncJob.dest, 'file1.txt'))) {
            console.log('PASS: Sync initial copy successful.');
        } else {
            console.error('FAIL: Sync initial copy failed.');
        }

        // 5. Test SYNC (Two-Way)
        console.log('\n[TEST] Modifying destination file for Two-Way Sync...');
        // Sleep to ensure time diff
        await new Promise(r => setTimeout(r, 1000));
        const destFile1 = path.join(syncJob.dest, 'file1.txt');
        await fs.writeFile(destFile1, 'content1-modified-in-dest');

        // Add new file in dest
        await fs.writeFile(path.join(syncJob.dest, 'new-in-dest.txt'), 'hello');

        await syncManager.startSync('job-sync-1');

        const sourceFile1 = path.join(SOURCE_DIR, 'file1.txt');
        const sourceContent = await fs.readFile(sourceFile1, 'utf-8');
        const sourceNewFile = path.join(SOURCE_DIR, 'new-in-dest.txt');

        if (sourceContent === 'content1-modified-in-dest' && fs.existsSync(sourceNewFile)) {
            console.log('PASS: Bi-directional sync successful (Dest -> Source propagation).');
        } else {
            console.error(`FAIL: Bi-directional sync failed. Content: ${sourceContent}`);
        }

    } catch (error) {
        console.error('TEST ERROR:', error);
    } finally {
        console.log('--- VERIFICATION FINISHED ---');
    }
}

runTests();
