import UploadJob from "../models/UploadJob.model.js";
import Student from "../models/Student.model.js";
import { studentImportQueue } from "../queues/queues.js";
import { createAudit } from "../utils/audit.js";
import { uploadToS3 } from "../utils/s3.js";
import fs from "fs";


export const createUploadJob = async (collegeId, userId, file) => {

    const uploaded = await uploadToS3(file.path, "uploads/");
    fs.unlink(file.path, () => { });

    const job = await UploadJob.create({
        collegeId,
        uploadedBy: userId,
        filePath: uploaded.url,
        status: "pending"
    });

    await studentImportQueue.add(
        "importXlsx",
        { uploadJobId: job._id, path: uploaded.url },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
    );

    await createAudit(userId, "UPLOAD_STUDENTS_STARTED", {
        uploadJobId: job._id,
        file: uploaded.url
    });

    return job;
};


export const getUploadJobById = async (id) => {
    return await UploadJob.findById(id);
};

export const getStudents = async (collegeId, page, limit) => {
    return await Student.find({ collegeId })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
};

export const assignParentToStudent = async (collegeId, studentId, parentId) => {
    const student = await Student.findById(studentId);
    if (!student) throw new Error("Student not found");
    if (!student.collegeId.equals(collegeId)) throw new Error("College mismatch");

    student.parents = student.parents || [];
    if (!student.parents.find(p => p.equals(parentId))) {
        student.parents.push(parentId);
        await student.save();
    }
    return student;
};
