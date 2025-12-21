import * as CollegeService from "../services/college.service.js";
import MQService from "../services/mq.service.js";
import AppliedCollege from "../models/AppliedCollege.model.js";
import College from "../models/College.model.js";
import crypto from "crypto";
import Audit from "../models/Audit.model.js";


export const applyForCollege = async (req, res, next) => {
    try {
        const { collegeName, officialWebsite, requestedBy, allowedDomain } = req.body;

        const existing = await AppliedCollege.findOne({
            $or: [
                { "requestedBy.email": requestedBy.email },
                { officialWebsite }
            ]
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Application already exists for this email or website"
            });
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");

        const data = await AppliedCollege.create({
            collegeName,
            officialWebsite,
            requestedBy,
            verificationToken,
            allowedDomain,
            status: "pending"
        });

        const required_data = {
            email: data.requestedBy.email,
            phone: data.requestedBy.phone,
            name: data.requestedBy.name,
            collegeName: data.collegeName,
            verificationLink: `${process.env.AUTH_SERVICE_URL}/api/college/verify-email?token=${verificationToken}`
        }

        console.log(`[MOCK EMAIL] Verify at: ${process.env.AUTH_SERVICE_URL}/api/college/verify-email?token=${verificationToken}`);

        await MQService.publishSendCollegeVerificationEmail(required_data)

        res.status(201).json({
            success: true,
            message: "Application submitted. Please verify email."
        });

    } catch (err) {
        next(err);
    }
};



export const verifyCollegeEmail = async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token)
            return res.status(400).json({ success: false, message: "Token required" });

        const application = await AppliedCollege.findOne({ verificationToken: token });
        if (!application)
            return res.status(404).json({ success: false, message: "Invalid token" });

        if (application.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Application already processed"
            });
        }

        // 1️⃣ Mark email as verified
        application.status = "email_verified";
        await application.save();

        // AUDIT LOG → Email verified
        await Audit.create({
            event: "COLLEGE_EMAIL_VERIFIED",
            metadata: {
                applicationId: application._id,
                collegeName: application.collegeName,
                email: application.requestedBy.email
            }
        });

        // 2️⃣ Try extract valid domain
        let allowedDomain = null;

        try {
            if (application.officialWebsite) {
                const parsed = new URL(application.officialWebsite);
                const host = parsed.hostname.replace("www.", "");
                if (host.includes(".")) allowedDomain = host;
            }
        } catch (err) {
            allowedDomain = null;
        }

        // 3️⃣ If no valid domain → manual approval required
        if (!allowedDomain) {

            // AUDIT LOG → Domain invalid, manual approval needed
            await Audit.create({
                event: "COLLEGE_AUTO_APPROVAL_SKIPPED_INVALID_DOMAIN",
                metadata: {
                    applicationId: application._id,
                    officialWebsite: application.officialWebsite,
                    reason: "Invalid or missing domain",
                }
            });

            return res.json({
                success: true,
                message:
                    "Email verified. But website domain is invalid or missing. Super Admin must manually approve."
            });
        }

        // 4️⃣ Auto approve the college
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

        // 5️⃣ Publish event to Auth Service
        await MQService.publishCollegeCreated({
            collegeId: newCollege._id,
            code: newCollege.code,
            name: newCollege.name,
            allowedDomain: newCollege.allowedDomain,
            adminEmail: newCollege.contactEmail,
            adminPhone: newCollege.contactNumber
        });

        // AUDIT LOG → Auto approved
        await Audit.create({
            event: "COLLEGE_AUTO_APPROVED",
            metadata: {
                collegeId: newCollege._id,
                collegeName: newCollege.name,
                allowedDomain,
                adminEmail: newCollege.contactEmail
            }
        });

        return res.json({
            success: true,
            message: "Email verified and college auto-approved (valid domain).",
            college: newCollege
        });

    } catch (err) {
        next(err);
    }
};



export const getApplications = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};
        const applications = await AppliedCollege.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, applications });
    } catch (err) {
        next(err);
    }
};

export const approveCollege = async (req, res, next) => {
    try {
        const { applicationId } = req.body;
        const application = await AppliedCollege.findById(applicationId);

        if (!application) return res.status(404).json({ success: false, message: "Application not found" });
        if (application.status === "approved") return res.status(400).json({ success: false, message: "Already approved" });

        // Create College
        // Generate a simple code like COL001 (in real app, use better logic)
        const count = await College.countDocuments();
        const code = `COL${String(count + 1).padStart(3, "0")}`;

        let domain;
        try {
            const url = new URL(application.officialWebsite);
            domain = url.hostname.replace("www.", "");
        } catch (e) {
            domain = application.officialWebsite; // Fallback
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

        // Publish event if needed (optional for now)
        try {
            await MQService.publishCollegeCreated({
                collegeId: newCollege._id,
                code: newCollege.code,
                name: newCollege.name,
                adminEmail: newCollege.contactEmail,
                adminPhone: newCollege.contactNumber
            });
        } catch (e) {
            console.error("MQ Error", e);
        }

        await Audit.create({
            event: "COLLEGE_ADMIN_APPROVED",
            metadata: {
                collegeId: newCollege._id,
                collegeName: newCollege.name,
                adminEmail: newCollege.contactEmail
            }
        });

        res.json({ success: true, college: newCollege });
    } catch (err) {
        next(err);
    }
};

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
        const result = await CollegeService.deleteCollege(req.params.id);
        res.json({ success: true, message: result });
    } catch (err) {
        next(err);
    }
};


export const recoverCollege = async (req, res, next) => {
    try {
        const result = await CollegeService.recoverCollege(req.query.token);
        res.json({ success: true, message: result });

    } catch (err) {
        next(err);
    }
}
