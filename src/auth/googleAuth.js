const { google } = require('googleapis');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const configManager = require('../config/configManager');

const { app } = require('electron'); // Add app

// Store in %APPDATA%/OnyxBackup/tokens.json
const TOKEN_PATH = path.join(app.getPath('userData'), 'tokens.json');

class GoogleAuthManager {
    constructor() {
        this.oauth2Client = null;
    }

    /**
     * Initialize the OAuth2 client.
     * Requires 'google' config in settings.json with { clientId, clientSecret, redirectUri }
     */
    async init() {
        const config = configManager.get('google');
        logger.info(`Initializing Google Auth with config: ${JSON.stringify(config)}`);
        if (!config || !config.clientId || !config.clientSecret) {
            logger.warn('Google Drive config missing. Please set clientId and clientSecret.');
            return false;
        }

        // Default redirect URI if not set (for manual copy-paste flow)
        const redirectUri = config.redirectUri || 'urn:ietf:wg:oauth:2.0:oob';

        this.oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            redirectUri
        );

        // Migration: Check if local tokens exist and userData tokens missing
        const localTokenPath = path.join(process.cwd(), 'data', 'tokens.json');
        if (!fs.existsSync(TOKEN_PATH) && fs.existsSync(localTokenPath)) {
            try {
                logger.info(`Migrating tokens from ${localTokenPath} to ${TOKEN_PATH}`);
                const tokens = await fs.readJson(localTokenPath);
                await fs.writeJson(TOKEN_PATH, tokens);
            } catch (e) {
                logger.error(`Failed to migrate tokens: ${e.message}`);
            }
        }

        // Load saved tokens
        if (fs.existsSync(TOKEN_PATH)) {
            try {
                const tokens = await fs.readJson(TOKEN_PATH);
                this.oauth2Client.setCredentials(tokens);
                logger.info('Google Drive tokens loaded.');
                return true;
            } catch (e) {
                logger.error(`Failed to load tokens: ${e.message}`);
            }
        }
        return false;
    }

    generateAuthUrl() {
        if (!this.oauth2Client) throw new Error('OAuth Client not initialized');

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/drive'], // Full drive access to see all folders
        });
    }

    async exchangeCodeForToken(code) {
        if (!this.oauth2Client) throw new Error('OAuth Client not initialized');

        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        await fs.writeJson(TOKEN_PATH, tokens);
        logger.info('Google Drive tokens acquired and saved.');
        return true;
    }

    getClient() {
        return this.oauth2Client;
    }

    isAuthenticated() {
        return !!this.oauth2Client && !!this.oauth2Client.credentials && !!this.oauth2Client.credentials.access_token;
    }

    async logout() {
        this.oauth2Client = null;
        if (fs.existsSync(TOKEN_PATH)) {
            await fs.remove(TOKEN_PATH);
            logger.info('Google Drive tokens cleared.');
        }
        return true;
    }
}

module.exports = new GoogleAuthManager();
