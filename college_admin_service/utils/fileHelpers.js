import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

export const cleanupFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete file: ${filePath}`, err);
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
