import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path"

const PRIVATE_KEY = fs.readFileSync(
    path.join(process.cwd(), "jwt_private.pem"),
    "utf8"
);

export const generateAccessToken = (user, jti) => {
    return jwt.sign(
        {
            sub: user._id.toString(),
            role: user.role,
            email: user.email,
            collegeId: user.collegeId ?? null,
            jti
        },
        PRIVATE_KEY,
        {
            algorithm: "RS256",
            expiresIn: "15m",
            issuer: "auth-service",
            audience: "api-gateway"
        }
    );
};


export const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};
