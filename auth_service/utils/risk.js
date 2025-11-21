const SCORING = {
    COUNTRY_MISMATCH: 40,
    UA_MISMATCH: 10,
    IMPOSSIBLE_TRAVEL: 30,
    IP_MISMATCH_MAJOR: 20,
    IP_MISMATCH_MINOR: 5, 
    MAX_SCORE: 100,
    VELOCITY_WINDOW_HOURS: 1,
};

const getSubnet = (ip) => {
    if (!ip || typeof ip !== 'string') return null;
    const segments = ip.split('.');
    if (segments.length === 4) return segments.slice(0, 3).join('.');
    return ip;
};

export const computeRiskScore = ({ geo, userAgent, ip, lastSession }) => {
    if (!lastSession) return 0;

    let score = 0;
    const now = Date.now();

    const currentCountry = geo?.country;
    const lastCountry = lastSession.geo?.country;
    const lastUA = lastSession.userAgent;
    const lastLogin = lastSession.createdAt ? new Date(lastSession.createdAt).getTime() : null;

    const lastIp = lastSession.ip;

    const hasCountryChanged = currentCountry && lastCountry && currentCountry !== lastCountry;
    const hasIpChanged = ip && lastIp && ip !== lastIp;

    if (hasCountryChanged) score += SCORING.COUNTRY_MISMATCH;

    if (userAgent && lastUA && userAgent !== lastUA) {
        score += SCORING.UA_MISMATCH;
    }

    if (lastLogin && hasCountryChanged) {
        const hoursElapsed = (now - lastLogin) / 3_600_000;
        if (hoursElapsed < SCORING.VELOCITY_WINDOW_HOURS) {
            score += SCORING.IMPOSSIBLE_TRAVEL;
        }
    }

    if (hasIpChanged) {
        const currentSubnet = getSubnet(ip);
        const lastSubnet = getSubnet(lastIp);

        if (currentSubnet && lastSubnet && currentSubnet === lastSubnet) {
            score += SCORING.IP_MISMATCH_MINOR;
        } else {
            score += SCORING.IP_MISMATCH_MAJOR;
        }
    }

    return Math.min(score, SCORING.MAX_SCORE);
};
