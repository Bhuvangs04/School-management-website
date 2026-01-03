import * as CollegeService from "../services/college.service.js";
import MQService from "../services/mq.service.js";
import AppliedCollege from "../models/AppliedCollege.model.js";
import College from "../models/College.model.js";
import Audit from "../models/Audit.model.js";
import crypto from "crypto";
import logger from "../utils/logger.js";

/**
 * Apply for college
 */
export const applyForCollege = async (req, res, next) => {
    try {
        const { collegeName, officialWebsite, requestedBy, allowedDomain } = req.body;

        logger.info("College application request received", {
            requestId: req.requestId,
            collegeName,
            officialWebsite,
            email: requestedBy?.email
        });

        const existing = await AppliedCollege.findOne({
            $or: [
                { "requestedBy.email": requestedBy.email },
                { officialWebsite }
            ]
        });

        if (existing) {
            logger.warn("Duplicate college application attempt", {
                requestId: req.requestId,
                email: requestedBy.email,
                officialWebsite
            });

            return res.status(400).json({
                success: false,
                message: "Application already exists for this email or website"
            });
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");

        const application = await AppliedCollege.create({
            collegeName,
            officialWebsite,
            requestedBy,
            verificationToken,
            allowedDomain,
            status: "pending"
        });

        await MQService.publishSendCollegeVerificationEmail({
            email: application.requestedBy.email,
            phone: application.requestedBy.phone,
            name: application.requestedBy.name,
            collegeName: application.collegeName,
            verificationLink: `${process.env.AUTH_SERVICE_URL}/api/college/verify-email?token=${verificationToken}`,
            audit: {
                userId: collegeName,
                event: "COLLEGE_VERIFICATION_EMAIL_SENT",
                metadata: { requestedBy }
            }
        });

        logger.info("College application created", {
            requestId: req.requestId,
            applicationId: application._id,
            collegeName
        });

        res.status(201).json({
            success: true,
            message: "Application submitted. Please verify email."
        });

    } catch (err) {
        logger.error("Apply for college failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Verify college email & auto approve
 */
export const verifyCollegeEmail = async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token) {
            const error = new Error("Token required");
            error.statusCode = 400;
            throw error;
        }

        const application = await AppliedCollege.findOne({ verificationToken: token });
        if (!application) {
            const error = new Error("Invalid token");
            error.statusCode = 404;
            throw error;
        }

        if (application.status !== "pending") {
            const error = new Error("Application already processed");
            error.statusCode = 400;
            throw error;
        }

        application.status = "email_verified";
        await application.save();

        logger.info("College email verified", {
            requestId: req.requestId,
            applicationId: application._id,
            email: application.requestedBy.email
        });

        await Audit.create({
            event: "COLLEGE_EMAIL_VERIFIED",
            metadata: {
                applicationId: application._id,
                collegeName: application.collegeName,
                email: application.requestedBy.email
            }
        });

        let allowedDomain = null;
        try {
            const parsed = new URL(application.officialWebsite);
            const host = parsed.hostname.replace("www.", "");
            if (host.includes(".")) allowedDomain = host;
        } catch (_) { }

        if (!allowedDomain) {
            logger.warn("Auto approval skipped due to invalid domain", {
                requestId: req.requestId,
                applicationId: application._id,
                officialWebsite: application.officialWebsite
            });

            await Audit.create({
                event: "COLLEGE_AUTO_APPROVAL_SKIPPED_INVALID_DOMAIN",
                metadata: {
                    applicationId: application._id,
                    officialWebsite: application.officialWebsite
                }
            });

            return res.json({
                success: true,
                message: "Email verified. Manual approval required."
            });
        }

        const count = await College.countDocuments();
        const code = `COL${String(count + 1).padStart(3, "0")}`;

        const newCollege = await College.create({
            name: application.collegeName,
            code,
            contactEmail: application.requestedBy.email,
            contactNumber: application.requestedBy.phone,
            allowedDomain
        });

        application.status = "approved";
        application.collegeId = newCollege._id;
        await application.save();

        await MQService.publishCollegeCreated({
            collegeId: newCollege._id,
            code: newCollege.code,
            name: newCollege.name,
            allowedDomain,
            adminEmail: newCollege.contactEmail,
            adminPhone: newCollege.contactNumber
        });

        logger.info("College auto approved", {
            requestId: req.requestId,
            collegeId: newCollege._id,
            allowedDomain
        });

        await Audit.create({
            event: "COLLEGE_AUTO_APPROVED",
            metadata: {
                collegeId: newCollege._id,
                collegeName: newCollege.name,
                allowedDomain
            }
        });

        res.json({
            success: true,
            message: "Email verified and college auto-approved",
            college: newCollege
        });

    } catch (err) {
        logger.error("Verify college email failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Get applications
 */
export const getApplications = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};
        const applications = await AppliedCollege.find(filter).sort({ createdAt: -1 });

        logger.info("Applications fetched", {
            requestId: req.requestId,
            status,
            count: applications.length
        });

        res.json({ success: true, applications });
    } catch (err) {
        logger.error("Get applications failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Manual approve college
 */
export const approveCollege = async (req, res, next) => {
    try {
        const { applicationId } = req.body;

        const application = await AppliedCollege.findById(applicationId);
        if (!application) {
            const error = new Error("Application not found");
            error.statusCode = 404;
            throw error;
        }

        if (application.status === "approved") {
            const error = new Error("Already approved");
            error.statusCode = 400;
            throw error;
        }

        const count = await College.countDocuments();
        const code = `COL${String(count + 1).padStart(3, "0")}`;

        let domain;
        try {
            const url = new URL(application.officialWebsite);
            domain = url.hostname.replace("www.", "");
        } catch {
            domain = application.officialWebsite;
        }

        const newCollege = await College.create({
            name: application.collegeName,
            code,
            contactEmail: application.requestedBy.email,
            contactNumber: application.requestedBy.phone,
            allowedDomain: domain
        });

        application.status = "approved";
        await application.save();

        await MQService.publishCollegeCreated({
            collegeId: newCollege._id,
            code: newCollege.code,
            name: newCollege.name,
            adminEmail: newCollege.contactEmail,
            adminPhone: newCollege.contactNumber
        });

        logger.info("College manually approved", {
            requestId: req.requestId,
            collegeId: newCollege._id
        });

        await Audit.create({
            event: "COLLEGE_ADMIN_APPROVED",
            metadata: {
                collegeId: newCollege._id,
                collegeName: newCollege.name
            }
        });

        res.json({ success: true, college: newCollege });

    } catch (err) {
        logger.error("Manual college approval failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * CRUD passthroughs
 */
export const createCollege = async (req, res, next) => {
    try {
        const college = await CollegeService.createCollege(req.body);
        await MQService.publishCollegeCreated(college);

        logger.info("College created manually", {
            requestId: req.requestId,
            collegeId: college._id
        });

        res.status(201).json({ success: true, college });
    } catch (err) {
        logger.error("Create college failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const getCollege = async (req, res, next) => {
    try {
        const college = await CollegeService.getCollegeById(req.params.id);
        if (!college) {
            const error = new Error("College not found");
            error.statusCode = 404;
            throw error;
        }
        logger.info("College fetched successfully", {
            requestId: req.requestId,
            collegeId: college._id
        });

        res.json({ success: true, college });
    } catch (err) {
        logger.error("Get college failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
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
        logger.info("College Updated successfully", {
            requestId: req.requestId,
            collegeId: updated._id,
            updated_Details: req.body
        });

        res.json({ success: true, updated });
    } catch (err) {
        logger.error("Update college failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const deleteCollege = async (req, res, next) => {
    try {
        const result = await CollegeService.deleteCollege(req.params.id);
        logger.info("College Deleted successfully", {
            requestId: req.requestId,
            collegeId: req.params.id,
            Output: result
        });
        res.json({ success: true, message: result });
    } catch (err) {
        logger.error("Delete college failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const recoverCollege = async (req, res, next) => {
    try {
        const result = await CollegeService.recoverCollege(req.query.token);
        logger.info("College Deleted successfully", {
            requestId: req.requestId,
            token: req.query.token,
            Output: result
        });
        res.json({ success: true, message: result });
    } catch (err) {
        logger.error("Recover college failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};
