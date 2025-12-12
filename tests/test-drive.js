const path = require('path');
const fs = require('fs-extra');
const mockery = require('mockery');
const assert = require('assert');

// 1. Setup Mockery
mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false,
    useCleanCache: true
});

// 2. Mock Logger
const mockLogger = {
    info: (msg) => console.log('[MOCK INFO]', msg),
    error: (msg) => console.error('[MOCK ERROR]', msg),
    debug: () => { },
    warn: () => { }
};
mockery.registerMock('../utils/logger', mockLogger);

// 3. Mock ConfigManager
const mockConfig = {
    get: (key) => {
        if (key === 'jobs') return [{
            id: 'job-drive-1',
            source: path.join(process.cwd(), 'test-env', 'source'),
            dest: 'drive://BackupFolder',
            type: 'backup',
            exclusions: []
        }];
        if (key === 'globalExclusions') return [];
        return {};
    }
};
mockery.registerMock('../config/configManager', mockConfig);

// 4. Mock DriveAdapter
const mockDriveAdapter = {
    ensureFolder: async (name) => {
        console.log(`[MOCK DRIVE] Ensure Folder: ${name}`);
        return { id: 'mock-folder-id-' + name };
    },
    uploadFile: async (localPath, parentId) => {
        console.log(`[MOCK DRIVE] Upload File: ${path.basename(localPath)} to ${parentId}`);
        return { id: 'mock-file-id' };
    }
};
mockery.registerMock('./driveAdapter', mockDriveAdapter);

// 5. Run Test
async function runTest() {
    try {
        console.log('--- STARTING DRIVE BACKUP MOCK TEST ---');

        // Setup Files
        const sourceDir = path.join(process.cwd(), 'test-env', 'source');
        await fs.ensureDir(sourceDir);
        await fs.writeFile(path.join(sourceDir, 'doc.txt'), 'content');

        // Load Module (with mocks)
        const backupManager = require('../src/core/backupManager');

        // Execute
        await backupManager.startBackup('job-drive-1');

        console.log('PASS: Drive Backup executed with mocks.');
    } catch (e) {
        console.error('FAIL:', e);
    } finally {
        mockery.disable();
        console.log('--- TEST FINISHED ---');
    }
}

runTest();
