import jwt from "jsonwebtoken";

export const generateAccessToken = (user, jti) => {
    return jwt.sign(
        {
            userId: user._id,
            role: user.role,
            collegeId: user.collegeId || null,
            jti              
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m" }
    );
};


export const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};
