import crypto from "crypto";

export const createRefreshToken = () => {
    return crypto.randomBytes(64).toString("hex");
};

export const hashToken = (token) =>{
    return crypto.createHash("sha256").update(token).digest("hex");
}

export const generateJTI = () => {
    return crypto.randomBytes(16).toString("hex");
}