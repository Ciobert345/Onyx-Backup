const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');

// Ensure log directory exists
// Use userData for logs in production
// Use local logs folder for easier debugging access
// const logDir = path.join(app.getPath('userData'), 'logs');
const logDir = path.join(app.getPath('userData'), 'logs');
// const logDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logDir);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(logDir, 'app.log') })
    ]
});

module.exports = logger;
