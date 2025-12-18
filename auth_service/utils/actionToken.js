import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";


function getActionSecret() {
    const secret = process.env.ACTION_SECRET;
    if (!secret) {
        throw new Error("ACTION_SECRET is missing");
    }
    return secret;
}

export function generateActionToken(payload) {
    const tokenId = uuidv4();

    const token = jwt.sign(
        { ...payload, tokenId },
        getActionSecret(),
        { expiresIn: "30m" }
    );

    return { token, tokenId };
}

export function verifyActionToken(token) {
    return jwt.verify(token, getActionSecret());
}
