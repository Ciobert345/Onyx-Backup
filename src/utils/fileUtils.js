const { minimatch } = require('minimatch');
const path = require('path');

/**
 * Checks if a file path matches any of the exclusion patterns.
 * @param {string} filePath - Absolute or relative file path.
 * @param {string[]} exclusions - Array of glob patterns or directory names.
 * @returns {boolean} - True if excluded, false otherwise.
 */
function isExcluded(filePath, exclusions) {
    if (!exclusions || exclusions.length === 0) return false;

    // Normalize path to forward slashes for consistent matching
    const normalizedPath = filePath.split(path.sep).join('/');

    return exclusions.some(pattern => {
        // Use minimatch with matchBase: true
        // This allows 'node_modules' to match '.../node_modules'
        // and '*.tmp' to match '.../file.tmp'
        if (minimatch(normalizedPath, pattern, { matchBase: true, dot: true })) return true;

        // Handle patterns that include slashes (e.g. "temp/*" or "src/config.js")
        // We prepend **/ to match them anywhere in the path
        if (minimatch(normalizedPath, `**/${pattern}`, { dot: true })) return true;

        // Also check if it's a directory match by adding glob stars if not present
        // This covers cases where user types "temp" and expects to exclude "src/temp/file.txt"
        if (!pattern.includes('/') && !pattern.includes('*')) {
            if (minimatch(normalizedPath, `**/${pattern}/**`, { dot: true })) return true;
        }

        return false;
    });
}

const fs = require('fs-extra');
const logger = require('./logger');

/**
 * Recursively calculates directory size and file count.
 * @param {string} dirPath - Directory path.
 * @param {string[]} exclusions - Exclusion patterns.
 * @returns {Promise<{ size: number, count: number }>}
 */
async function getDirectoryStats(dirPath, exclusions = []) {
    let stats = { size: 0, count: 0 };

    try {
        if (!fs.existsSync(dirPath)) return stats;

        const list = await fs.readdir(dirPath);
        for (const file of list) {
            const fullPath = path.join(dirPath, file);
            if (isExcluded(fullPath, exclusions)) continue;

            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                const subStats = await getDirectoryStats(fullPath, exclusions);
                stats.size += subStats.size;
                stats.count += subStats.count;
            } else {
                stats.size += stat.size;
                stats.count += 1;
            }
        }
    } catch (error) {
        logger.error(`Error calculating stats for ${dirPath}: ${error.message}`);
    }
    return stats;
}

module.exports = { isExcluded, getDirectoryStats };
