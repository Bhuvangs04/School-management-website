import College from "../models/College.model.js";

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
    return await College.findByIdAndDelete(id);
};
