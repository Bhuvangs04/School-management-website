import { createCollegeSchema } from '../utils/validationSchemas.js';
import { z } from 'zod';

const testValidation = () => {
    console.log('Testing Validation Schemas...');

    // Valid data
    const validData = {
        body: {
            name: 'Test College',
            email: 'test@college.com',
            website: 'https://college.com'
        }
    };

    try {
        createCollegeSchema.parse(validData);
        console.log('Valid data passed');
    } catch (e) {
        console.error('Valid data failed', e);
    }

    // Invalid data
    const invalidData = {
        body: {
            name: 'Te', // Too short
            email: 'not-an-email'
        }
    };

    try {
        createCollegeSchema.parse(invalidData);
        console.error('Invalid data passed (Unexpected)');
    } catch (e) {
        if (e instanceof z.ZodError) {
            console.log('Invalid data failed as expected');
            console.log(e.errors);
        } else {
            console.error('Unexpected error', e);
        }
    }
};

testValidation();
