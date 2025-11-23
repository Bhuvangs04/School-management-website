import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * Generate action token and tokenId (jti) for one-time actions.
 * Returns { token, tokenId }.
 * Validate via verifyActionToken.
 */

export function generateActionToken(payload, expiresIn = "1h") {
    // always include jti so you can persist it and mark used
    const tokenId = crypto.randomUUID();
    const token = jwt.sign({ ...payload, jti: tokenId }, process.env.ACTION_TOKEN_SECRET || (process.env.JWT_SECRET || "act_secret"), {
        expiresIn
    });
    return { token, tokenId };
}

export function verifyActionToken(token) {
    if (!token) throw new Error("Missing token");
    const payload = jwt.verify(token, process.env.ACTION_TOKEN_SECRET || (process.env.JWT_SECRET || "act_secret"));
    return payload;
}
