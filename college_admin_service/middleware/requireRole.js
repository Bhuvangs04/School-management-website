export default function requireRole(roles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthenticated" });
        }

        if (!Array.isArray(roles)) roles = [roles];

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        next();
    };
}

export const requireCollegeAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Unauthenticated" });
    }

    if (req.user.role === "super_admin") return next();

    const { collegeId } = req.params;
    if (!collegeId) {
        return res.status(400).json({ success: false, message: "College ID missing in route" });
    }

    if (String(req.user.collegeId) !== String(collegeId)) { 
        return res.status(403).json({ success: false, message: "Forbidden: College access denied" });
    }

    next();
};
