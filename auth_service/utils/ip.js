export function normalizeIP(rawIp) {
    if (!rawIp || typeof rawIp !== "string") return null;

    rawIp = rawIp.trim();

    if (rawIp === "::1" || rawIp === "0:0:0:0:0:0:0:1") {
        return "127.0.0.1";
    }

    if (rawIp.startsWith("::ffff:")) {
        return rawIp.replace("::ffff:", "");
    }

    const bracketIndex = rawIp.indexOf("%");
    if (bracketIndex !== -1) {
        rawIp = rawIp.slice(0, bracketIndex);
    }

    if (rawIp.includes(":") && !rawIp.includes(".")) {
        return null;
    }

    return rawIp;
}
