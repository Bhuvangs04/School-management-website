import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import logger from './logger';

export const cleanupFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                logger.error("File cleanup failed", {
                    filePath,
                    message: err.message,
                    stack: err.stack
                });
            }
        });
    }
};

export const validateFileExtension = (filename, allowedExtensions) => {
    const ext = path.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext);
};

export const validateMimeType = async (filePath, allowedMimeTypes) => {
    const buffer = fs.readFileSync(filePath);
    const type = await fileTypeFromBuffer(buffer);
    return type && allowedMimeTypes.includes(type.mime);
};

export const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};
