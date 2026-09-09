const router = require("express").Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");

const DISCORD_API = "https://discord.com/api/v10";

function getConfig() {
    return {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI,
        jwtSecret: process.env.JWT_SECRET
    };
}

function requireConfig(config) {
    return config.clientId && config.clientSecret && config.redirectUri && config.jwtSecret;
}

router.get("/discord", (req, res) => {
    const config = getConfig();

    if (!requireConfig(config)) {
        return res.status(500).json({
            error: "Discord OAuth is not configured",
            missing: [
                ["DISCORD_CLIENT_ID", config.clientId],
                ["DISCORD_CLIENT_SECRET", config.clientSecret],
                ["DISCORD_REDIRECT_URI", config.redirectUri],
                ["JWT_SECRET", config.jwtSecret]
            ].filter(([, value]) => !value).map(([name]) => name)
        });
    }

    const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: "code",
        redirect_uri: config.redirectUri,
        scope: "identify email"
    });

    res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
    const config = getConfig();
    const { code } = req.query;

    if (!code) return res.status(400).json({ error: "Missing Discord authorization code" });
    if (!requireConfig(config)) return res.status(500).json({ error: "Discord OAuth is not configured" });

    try {
        const tokenResponse = await axios.post(
            `${DISCORD_API}/oauth2/token`,
            new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: "authorization_code",
                code,
                redirect_uri: config.redirectUri
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const discordAccessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${discordAccessToken}` }
        });
        const user = userResponse.data;

        const token = jwt.sign(
            { discordId: user.id, username: user.username },
            config.jwtSecret,
            { expiresIn: "7d" }
        );

        // Account creation/update is kept behind the internal admin secret.
        // This is temporary until MongoDB becomes the persistent database.
        if (process.env.BACKEND_ADMIN_SECRET) {
            try {
                await axios.post(
                    `http://127.0.0.1:${process.env.PORT || 3000}/auth/accounts`,
                    {
                        discordId: user.id,
                        username: user.username,
                        globalName: user.global_name || null,
                        avatar: user.avatar || null
                    },
                    { headers: { "x-tidal-admin-secret": process.env.BACKEND_ADMIN_SECRET } }
                );
            } catch (accountError) {
                console.error("Tidal account sync failed:", accountError.message);
            }
        }

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                globalName: user.global_name || null,
                avatar: user.avatar || null,
                email: user.email || null
            }
        });
    } catch (error) {
        console.error("Discord OAuth error:", error.response?.data || error.message);
        res.status(401).json({ error: "Discord authentication failed" });
    }
});

// Account/admin API is mounted here temporarily so server.js stays compatible.
router.use("/accounts", require("./accounts.js"));

router.get("/me", (req, res) => {
    const config = getConfig();
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Missing Bearer token" });
    if (!config.jwtSecret) return res.status(500).json({ error: "JWT_SECRET is not configured" });

    try {
        const payload = jwt.verify(auth.slice(7), config.jwtSecret);
        res.json({ authenticated: true, user: payload });
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
});

module.exports = router;
