import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";


const ACTION_SECRET = process.env.ACTION_SECRET ;

export function generateActionToken(payload) {
    const tokenId = uuidv4();

    const token = jwt.sign(
        { ...payload, tokenId },
        ACTION_SECRET,
        { expiresIn: "30m" }
    );

    return { token, tokenId };
}

export function verifyActionToken(token) {
    return jwt.verify(token, ACTION_SECRET);
}
