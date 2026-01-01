import DepartmentMember from "../models/DepartmentMember.model.js";

export const requireDepartmentPermission = (permission) => {
    return async (req, res, next) => {
        try {

            const { _id: userId, role } = req.user;
            const { departmentId } = req.params;

            if (["college_admin", "super_admin"].includes(role)) {
                return next();
            }

            const membership = await DepartmentMember.findOne({
                userId,
                departmentId,
                isActive: true
            });

            if (!membership)
                return res.status(403).json({
                    success: false,
                    message: "Not a department member"
                });

            if (!membership.permissions.includes(permission))
                return res.status(403).json({
                    success: false,
                    message: "Insufficient department permissions"
                });

            req.departmentAccess = membership;
            next();
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    };
};
