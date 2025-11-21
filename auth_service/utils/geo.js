export const lookupGeo = async (ip) => {
    try {
        const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);

        if (!res.ok) {
            console.log("Geo lookup failed:", res.status);
            return { country: null, region: null, city: null };
        }

        const data = await res.json();

        console.log("IP ->", ip);
        console.log("Data IP ->", data);

        if (!data.success) {
            return { country: null, region: null, city: null };
        }

        return {
            country: data.country || null,
            region: data.region || null,
            city: data.city || null,
        };

    } catch (error) {
        console.log("Geo lookup error:", error);
        return { country: null, region: null, city: null };
    }
};
