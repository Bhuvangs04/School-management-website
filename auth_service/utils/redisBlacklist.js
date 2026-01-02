import { connection } from "../lib/redis.js";

export async function blacklistJTI(jti, expiresAt = null) {
    if (!jti) return;
    try {
        const key = `bl_jti:${jti}`;
        if (expiresAt) {
            const ttl = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
            if (ttl <= 0) {
                await connection.set(key, "1", "EX", 60);
            } else {
                await connection.set(key, "1", "EX", ttl);
            }
        } else {
            await connection.set(key, "1", "EX", 7 * 24 * 3600);
        }
    } catch (err) {
        console.error("[REDIS] blacklistJTI error", err);
    }
}


export async function isJtiBlacklisted(jti) {
    if (!jti) return false;
    try {
        const key = `bl_jti:${jti}`;
        const v = await connection.get(key);
        console.log(v);
        return !!v;
    } catch (err) {
        console.error("[REDIS] isJtiBlacklisted error", err);
        return false;
    }
}
