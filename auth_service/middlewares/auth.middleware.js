
export const authenticate = (req, res, next) => {
    const trusted = req.headers["x-trusted-request"];

    if (trusted !== "true") {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    const userId = req.headers["x-user-id"];
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    req.user = {
        id: userId,
        role: req.headers["x-user-role"],
        collegeId: req.headers["x-college-id"]
    };

    next();
};
