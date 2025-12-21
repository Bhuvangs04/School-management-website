import College from "../models/College.model.js";
import MQService from "../services/mq.service.js";
import crypto from "crypto";
import mongoose from "mongoose";




export const createCollege = async (data) => {
    const exist = await College.findOne({ code: data.code });
    if (exist) throw new Error("College code already exists");
    return await College.create(data);
};



export const getCollegeById = async (id) => {
    const college = await College.findById(id);
    if (!college) throw new Error("College not found");
    return college;
};

export const updateCollege = async (id, data) => {
    return await College.findByIdAndUpdate(id, data, { new: true });
};

export const deleteCollege = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid college ID");
    }
    const college = await College.findById(id);
    if (!college) {
        throw new Error("College Not Found");
    }
    if (college.status === "DELETING") {
        return {
            message: "College deletion already in progress",
            recoverUntil: college.recoverUntil
        };
    }

    const now = new Date();
    const recoverUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const RecoverToken = crypto.randomBytes(32).toString("hex");

    college.status = "DELETING";
    college.recoverUntil = recoverUntil;
    college.deletedAt = now;
    college.recoverToken = RecoverToken;
    college.recoverTokenExpiresAt = recoverUntil;

    await college.save();

    await MQService.publishCollegeDeletion({
        collegeId: college.code.toString(),
        collegeName: college.name,
        adminEmail: college.contactEmail,
        recoverUntil,
        RecoverToken
    });


    return {
        message: "College scheduled for deletion",
    };
};


export const recoverCollege = async (token) => {
    const college = await College.findOne({
        recoverToken: token,
        recoverTokenExpiresAt: { $gt: new Date() },
        status: "DELETING"
    });
    if (!college) {
        throw new Error("Invalid or expired recovery token");
    }
    college.status = "ACTIVE";
    college.deletedAt = null;
    college.recoverUntil = null;
    college.RecoverToken = null;
    college.recoverTokenExpiresAt = null;

    await college.save();


    await MQService.publishCollegeRecover({
        collegeId: college.code.toString(),
        collegeName: college.name,
        adminEmail: college.contactEmail,
        recover: "true"
    });


    return {
        message: "College scheduled for deletion",
    };
};
