import { computeRiskScore } from '../utils/risk'; 

describe('Risk Engine Scoring', () => {

    const generateUser = (overrides = {}) => ({
        lastGeo: { country: 'US' },
        lastUserAgent: 'Mozilla/5.0 (Macintosh)',
        lastIp: '192.168.1.50',
        lastLoginAt: Date.now() - (24 * 60 * 60 * 1000), 
        ...overrides,
    });

    test('returns 0 for a perfectly matching user (Low Risk)', () => {
        const user = generateUser();
        const input = {
            geo: { country: 'US' },
            userAgent: 'Mozilla/5.0 (Macintosh)',
            ip: '192.168.1.50',
            user,
        };

        expect(computeRiskScore(input)).toBe(0);
    });

    test('returns 0 if user object is missing (First time login)', () => {
        const input = { geo: {}, userAgent: 'test', ip: '1.1.1.1', user: null };
        expect(computeRiskScore(input)).toBe(0);
    });


    test('adds 40 points for Country Mismatch', () => {
        const user = generateUser({ lastGeo: { country: 'US' } });
        const input = {
            geo: { country: 'FR' }, 
            userAgent: user.lastUserAgent,
            ip: user.lastIp, 
            user,
        };

        expect(computeRiskScore(input)).toBe(40);
    });


    test('adds 10 points for User Agent Mismatch', () => {
        const user = generateUser({ lastUserAgent: 'Chrome/100' });
        const input = {
            geo: user.lastGeo,
            userAgent: 'Firefox/90', 
            ip: user.lastIp,
            user,
        };

        expect(computeRiskScore(input)).toBe(10);
    });


    test('adds 30 points (plus country score) for Impossible Travel', () => {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const user = generateUser({
            lastGeo: { country: 'US' },
            lastLoginAt: tenMinutesAgo
        });

        const input = {
            geo: { country: 'JP' }, 
            userAgent: user.lastUserAgent,
            ip: user.lastIp,
            user,
        };

        expect(computeRiskScore(input)).toBe(70);
    });


    test('adds 5 points for Minor IP Change (Same Subnet)', () => {
        const user = generateUser({ lastIp: '192.168.1.50' });
        const input = {
            geo: user.lastGeo,
            userAgent: user.lastUserAgent,
            ip: '192.168.1.120', 
            user,
        };

        expect(computeRiskScore(input)).toBe(5);
    });

    test('adds 20 points for Major IP Change (Different Subnet)', () => {
        const user = generateUser({ lastIp: '192.168.1.50' });
        const input = {
            geo: user.lastGeo,
            userAgent: user.lastUserAgent,
            ip: '10.0.0.5',
            user,
        };

        expect(computeRiskScore(input)).toBe(20);
    });


    test('Caps the score at 100 even if risk is extreme', () => {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);

        const user = generateUser({
            lastGeo: { country: 'US' },
            lastIp: '192.168.1.50',
            lastUserAgent: 'Chrome',
            lastLoginAt: tenMinutesAgo
        });

        const input = {
            geo: { country: 'RU' },   
            userAgent: 'Firefox',     
            ip: '200.200.200.200',    
            user,
        };

        expect(computeRiskScore(input)).toBe(100);
    });
});