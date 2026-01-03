import logger from "./logger.js";

const GEO_TIMEOUT_MS = 3000;

export const lookupGeo = async (ip) => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

        const res = await fetch(
            `https://ipwho.is/${encodeURIComponent(ip)}`,
            { signal: controller.signal }
        );

        clearTimeout(timeout);

        if (!res.ok) {
            logger.warn("Geo lookup HTTP failed", {
                category: "geo",
                ip,
                statusCode: res.status
            });

            return { country: null, region: null, city: null };
        }

        const data = await res.json();

        if (!data.success) {
            logger.warn("Geo lookup API returned failure", {
                category: "geo",
                ip,
                reason: data.message
            });

            return { country: null, region: null, city: null };
        }

        // DO NOT log on success (too noisy)
        return {
            country: data.country || null,
            region: data.region || null,
            city: data.city || null
        };

    } catch (err) {
        logger.error("Geo lookup exception", {
            category: "geo",
            ip,
            message: err.message,
            stack: err.stack
        });

        return { country: null, region: null, city: null };
    }
};
