import { z } from 'zod';
import logger from '../utils/logger.js';

const validate = (schema) => (req, res, next) => {
    try {
        const { body, query, params } = req;
        const result = schema.parse({
            body,
            query,
            params,
        });

        // Replace req values with parsed/validated values
        req.body = result.body;
        req.query = result.query;
        req.params = result.params;

        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.warn('Validation error', { errors: error.errors });
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: error.errors.map(e => ({
                    path: e.path.join('.'),
                    message: e.message
                }))
            });
        }
        next(error);
    }
};

export default validate;
