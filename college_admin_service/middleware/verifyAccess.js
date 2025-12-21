export default function verifyAccess(req, res, next) {
    // 🔒 Must come from gateway
    if (req.headers["x-trusted-request"] !== "true") {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }
    console.log("verifyAccess hit", req.headers["x-user-id"]);


    const userId = req.headers["x-user-id"];
    const role = req.headers["x-user-role"];
    const collegeId = req.headers["x-college-id"];

    if (!userId || !role) {
        return res.status(401).json({
            success: false,
            message: "Invalid auth headers"
        });
    }

    req.user = {
        id: userId,
        role,
        collegeId
    };

    next();
}
