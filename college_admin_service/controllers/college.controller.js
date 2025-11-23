import * as CollegeService from "../services/college.service.js";
import MQService from "../services/mq.service.js";

export const createCollege = async (req, res, next) => {
    try {
        const c = await CollegeService.createCollege(req.body);
        try {
            await MQService.publishCollegeCreated(c);
        } catch (mqError) {
            // Log error but don't fail the request
            // In a real production system, we might want to save this to a DB table for retry
            console.error("Failed to publish college created event:", mqError);
        }
        res.status(201).json({ success: true, college: c });
    } catch (err) {
        next(err);
    }
};



export const getCollege = async (req, res, next) => {
    try {
        const c = await CollegeService.getCollegeById(req.params.id);
        if (!c) {
            const error = new Error("College not found");
            error.statusCode = 404;
            throw error;
        }
        res.json({ success: true, college: c });
    } catch (err) {
        next(err);
    }
};

export const updateCollege = async (req, res, next) => {
    try {
        const updated = await CollegeService.updateCollege(req.params.id, req.body);
        if (!updated) {
            const error = new Error("College not found");
            error.statusCode = 404;
            throw error;
        }
        res.json({ success: true, updated });
    } catch (err) {
        next(err);
    }
};

export const deleteCollege = async (req, res, next) => {
    try {
        await CollegeService.deleteCollege(req.params.id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};
