import UploadJob from "../models/UploadJob.model.js";
import Student from "../models/Student.model.js";
import College from "../models/College.model.js"
import DepartmentMember from "../models/DepartmentMember.model.js";
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

export const addDepartment = async (collegeId, departmentData) => {
    const college = await College.findById(collegeId);
    if (!college) throw new Error("College not found");

    const exists = college.departments.some(
        d => d.name.toLowerCase() === departmentData.name.toLowerCase()
    );
    if (exists) throw new Error("Department already exists");

    const department = {
        name: departmentData.name,
        courses: departmentData.courses || []
    };

    college.departments.push(department);
    await college.save();

    return department;
};


export const getDepartmentsWithHod = async (collegeId) => {
    //  Get departments
    const college = await College.findById(collegeId)
        .select("departments._id departments.name")
        .lean();

    if (!college) {
        throw new Error("College not found");
    }

    //  Get all active HODs for this college
    const hods = await DepartmentMember.find({
        collegeId,
        role: "HOD",
        isActive: true
    })
        .populate("userId", "name email")
        .lean();

    // Map departmentId → HOD
    const hodMap = {};
    for (const hod of hods) {
        hodMap[hod.departmentId.toString()] = hod.userId;
    }

    // Merge
    return college.departments.map(dep => ({
        id: dep._id,
        name: dep.name,
        hod: hodMap[dep._id.toString()]
            ? {
                id: hodMap[dep._id.toString()]._id,
                name: hodMap[dep._id.toString()].name,
                email: hodMap[dep._id.toString()].email
            }
            : null
    }));
};

export const updateDepartment = async (collegeId, departmentId, updateData) => {
    const college = await College.findById(collegeId);
    if (!college) throw new Error("College not found");

    const department = college.departments.id(departmentId);
    if (!department) throw new Error("Department not found");

    if (updateData.name !== undefined) department.name = updateData.name;
    if (updateData.hod !== undefined) department.hod = updateData.hod;
    if (updateData.courses !== undefined) department.courses = updateData.courses;

    await college.save();
    return department;
};

export const deleteDepartment = async (collegeId, departmentId) => {
    const college = await College.findById(collegeId);
    if (!college) throw new Error("College not found");

    const department = college.departments.id(departmentId);
    if (!department) throw new Error("Department not found");

    department.deleteOne();
    await college.save();

    return true;
};


