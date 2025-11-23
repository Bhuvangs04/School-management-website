import { z } from 'zod';

export const createCollegeSchema = z.object({
    body: z.object({
        name: z.string().min(3, "Name must be at least 3 characters"),
        address: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        website: z.string().url().optional(),
    })
});

export const updateCollegeSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
    }),
    body: z.object({
        name: z.string().min(3).optional(),
        address: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        website: z.string().url().optional(),
    })
});

export const getByIdSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId")
    })
});
