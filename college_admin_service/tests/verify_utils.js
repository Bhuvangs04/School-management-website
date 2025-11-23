import { validateFileExtension, validateMimeType } from '../utils/fileHelpers.js';
import metrics, { trackRequestDuration, incrementActiveRequests } from '../utils/metrics.js';
import fs from 'fs';

const verify = async () => {
    console.log('Verifying Utils...');

    // File Helpers
    const allowedExts = ['.jpg', '.png'];
    const isExtValid = validateFileExtension('test.jpg', allowedExts);
    console.log(`Extension Valid: ${isExtValid}`);

    if (!isExtValid) {
        console.error('Extension validation failed');
        process.exit(1);
    }

    // Metrics
    console.log('Testing Metrics...');
    incrementActiveRequests();
    trackRequestDuration(Date.now() - 100);
    console.log('Metrics functions executed without error');
    
    console.log('Verification Successful');
};

verify();
