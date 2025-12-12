const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'file-cache.json');

class FileCacheManager {
    constructor() {
        this.cache = {};
        this.init();
    }

    async init() {
        await fs.ensureDir(CACHE_DIR);
        if (await fs.pathExists(CACHE_FILE)) {
            try {
                this.cache = await fs.readJson(CACHE_FILE);
            } catch (e) {
                this.cache = {};
            }
        }
    }

    /**
     * Get cache key for a file
     */
    getCacheKey(jobId, filePath) {
        return `${jobId}:${filePath}`;
    }

    /**
     * Calculate file hash for change detection
     */
    async getFileHash(filePath) {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);

        return new Promise((resolve, reject) => {
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Check if a file needs to be uploaded
     * @returns {Object} { needsUpload: boolean, driveFileId: string, reason: string }
     */
    async needsUpload(jobId, filePath, destFolderId) {
        const key = this.getCacheKey(jobId, filePath);
        const cached = this.cache[key];

        // File not in cache - needs upload
        if (!cached) {
            return { needsUpload: true, driveFileId: null, reason: 'new file' };
        }

        // Check if destination changed
        if (cached.destFolderId !== destFolderId) {
            return { needsUpload: true, driveFileId: cached.driveFileId, reason: 'destination changed' };
        }

        // Check file stats
        const stats = await fs.stat(filePath);
        const currentMtime = stats.mtime.getTime();
        const currentSize = stats.size;

        // Quick check: size or mtime changed
        if (currentSize !== cached.size || currentMtime !== cached.mtime) {
            // Double check with hash
            const currentHash = await this.getFileHash(filePath);
            if (currentHash !== cached.hash) {
                return { needsUpload: true, driveFileId: cached.driveFileId, reason: 'content changed' };
            }
        }

        // File unchanged
        return { needsUpload: false, driveFileId: cached.driveFileId, reason: 'unchanged' };
    }

    /**
     * Update cache after successful upload
     */
    async updateCache(jobId, filePath, driveFileId, destFolderId) {
        const key = this.getCacheKey(jobId, filePath);
        const stats = await fs.stat(filePath);
        const hash = await this.getFileHash(filePath);

        this.cache[key] = {
            filePath,
            driveFileId,
            destFolderId,
            mtime: stats.mtime.getTime(),
            size: stats.size,
            hash,
            lastUpload: Date.now()
        };

        await this.saveCache();
    }

    /**
     * Remove file from cache
     */
    async removeFromCache(jobId, filePath) {
        const key = this.getCacheKey(jobId, filePath);
        delete this.cache[key];
        await this.saveCache();
    }

    /**
     * Save cache to disk
     */
    async saveCache() {
        await fs.writeJson(CACHE_FILE, this.cache, { spaces: 2 });
    }

    /**
     * Clear cache for a specific job
     */
    async clearJobCache(jobId) {
        const keysToDelete = Object.keys(this.cache).filter(key => key.startsWith(`${jobId}:`));
        for (const key of keysToDelete) {
            delete this.cache[key];
        }
        await this.saveCache();
    }

    /**
     * Clear all cache
     */
    async clearAll() {
        this.cache = {};
        await this.saveCache();
    }
}

module.exports = new FileCacheManager();
