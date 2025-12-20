import axios from "axios";

export default async function verifyAccess(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: "Missing Authorization" });

        const token = authHeader;
        console.log(token)
        const resp = await axios.post(`${process.env.AUTH_SERVICE_URL}/auth/verify`, { token }, {
            timeout: 5000,
            headers: {
                Authorization: `${token}`
            }
        });
        console.log(resp)
        if (!resp.data?.success) return res.status(401).json({ success: false, message: "Unauthorized" });
        req.user = resp.data.user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
}
