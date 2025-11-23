import crypto from "crypto";
import bcrypt from "bcrypt";

export function makeTempPassword() {
    return crypto.randomBytes(8).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

export async function hashPassword(plain) {
    return await bcrypt.hash(plain, 10);
}
