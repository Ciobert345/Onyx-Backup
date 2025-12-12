const { google } = require('googleapis');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const googleAuth = require('../auth/googleAuth');

class DriveAdapter {
    constructor() {
        this.drive = null;
    }

    async init() {
        // Ensure auth is initialized
        await googleAuth.init();
        if (googleAuth.isAuthenticated()) {
            this.drive = google.drive({ version: 'v3', auth: googleAuth.getClient() });
        } else {
            logger.warn('DriveAdapter: Not authenticated. Call login first.');
        }
    }

    async listFiles(query = '') {
        if (!this.drive) await this.init();
        if (!this.drive) throw new Error('Drive API not initialized');

        try {
            const res = await this.drive.files.list({
                q: query,
                fields: 'files(id, name, mimeType, modifiedTime, parents)',
                spaces: 'drive',
            });
            return res.data.files;
        } catch (e) {
            logger.error(`Drive List Error: ${e.message}`);
            throw e;
        }
    }

    async listFolders() {
        // List only root-level folders in "My Drive", not nested folders
        const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents`;
        return await this.listFiles(query);
    }

    async findFolder(name, parentId = null) {
        let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }
        const files = await this.listFiles(query);
        return files.length > 0 ? files[0] : null;
    }

    async createFolder(name, parentId = null) {
        if (!this.drive) await this.init();
        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }
        try {
            const file = await this.drive.files.create({
                resource: fileMetadata,
                fields: 'id, name',
            });
            return file.data;
        } catch (e) {
            logger.error(`Drive Create Folder Error: ${e.message}`);
            throw e;
        }
    }

    async ensureFolder(folderName, parentId = null) {
        const existing = await this.findFolder(folderName, parentId);
        if (existing) return existing;
        return await this.createFolder(folderName, parentId);
    }

    async uploadFile(localPath, folderId = null) {
        if (!this.drive) await this.init();
        const fileName = path.basename(localPath);

        // Check if file exists to update it, or create new
        let query = `name = '${fileName}' and trashed = false`;
        if (folderId) {
            query += ` and '${folderId}' in parents`;
        }
        const existingFiles = await this.listFiles(query);
        const existingFile = existingFiles.length > 0 ? existingFiles[0] : null;

        const media = {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(localPath),
        };

        try {
            if (existingFile) {
                // Update
                logger.info(`Drive: Updating file ${fileName} (${existingFile.id})`);
                const res = await this.drive.files.update({
                    fileId: existingFile.id,
                    media: media,
                    fields: 'id, name',
                });
                return res.data;
            } else {
                // Create
                logger.info(`Drive: Creating file ${fileName}`);
                const fileMetadata = {
                    name: fileName,
                };
                if (folderId) {
                    fileMetadata.parents = [folderId];
                }
                const res = await this.drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id, name',
                });
                return res.data;
            }
        } catch (e) {
            logger.error(`Drive Upload Error: ${e.message}`);
            throw e;
        }
    }

    async updateFile(localPath, fileId) {
        if (!this.drive) await this.init();
        const fileName = path.basename(localPath);

        try {
            const media = {
                mimeType: 'application/octet-stream',
                body: fs.createReadStream(localPath),
            };

            logger.info(`Drive: Explicitly updating file ${fileName} (${fileId})`);
            const res = await this.drive.files.update({
                fileId: fileId,
                media: media,
                fields: 'id, name',
            });
            return res.data.id;
        } catch (e) {
            logger.error(`Drive Update Error: ${e.message}`);
            throw e;
        }
    }

    async downloadFile(fileId, localPath) {
        if (!this.drive) await this.init();

        const dest = fs.createWriteStream(localPath);
        try {
            const res = await this.drive.files.get({
                fileId,
                alt: 'media',
            }, { responseType: 'stream' });

            return new Promise((resolve, reject) => {
                res.data
                    .on('end', () => {
                        logger.info(`Drive: Downloaded ${fileId} -> ${localPath}`);
                        resolve();
                    })
                    .on('error', err => {
                        logger.error(`Drive Download Error: ${err.message}`);
                        reject(err);
                    })
                    .pipe(dest);
            });
        } catch (e) {
            logger.error(`Drive Download Request Error: ${e.message}`);
            throw e;
        }
    }
}

module.exports = new DriveAdapter();
