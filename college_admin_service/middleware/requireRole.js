export default function requireRole(roles = []) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, message: "Unauthenticated" });
        if (!Array.isArray(roles)) roles = [roles];
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }
        next();
    };
}
