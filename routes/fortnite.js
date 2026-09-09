const router = require("express").Router();
const jwt = require("jsonwebtoken");

const TIDAL_VERSION = process.env.TIDAL_FORTNITE_VERSION || "12.41";
const BUILD_UNIQUE_ID = process.env.TIDAL_BUILD_UNIQUE_ID || "1:Tidal:12.41";

// Runtime state. The real game-server layer will replace these values when servers are added.
const state = {
    online: true,
    players: 0,
    servers: 0,
    matchmaking: true,
    lastHeartbeat: null
};

router.get("/api/version", (req, res) => {
    res.json({
        app: "Fortnite",
        service: "Tidal",
        version: TIDAL_VERSION,
        buildUniqueId: BUILD_UNIQUE_ID
    });
});

router.get("/api/game/status", (req, res) => {
    res.json({
        online: state.online,
        players: state.players,
        servers: state.servers,
        matchmaking: state.matchmaking,
        version: TIDAL_VERSION,
        buildUniqueId: BUILD_UNIQUE_ID,
        lastHeartbeat: state.lastHeartbeat
    });
});

router.get("/api/game/v2/enabled", (req, res) => {
    res.json({
        bEnabled: state.online
    });
});

router.get("/lightswitch/api/service/bulk/status", (req, res) => {
    res.json([
        {
            serviceInstanceId: "fortnite",
            status: state.online ? "UP" : "DOWN",
            message: state.online ? "Tidal Fortnite services are online." : "Tidal Fortnite services are offline.",
            maintenanceUri: null,
            allowedActions: state.online ? ["PLAY"] : [],
            banned: false
        }
    ]);
});

router.get("/api/matchmaking/status", (req, res) => {
    res.json({
        enabled: state.matchmaking,
        players: state.players,
        servers: state.servers
    });
});

// Lightweight server heartbeat endpoint for Tidal game-server nodes.
router.post("/api/game/heartbeat", (req, res) => {
    const secret = process.env.GAME_SERVER_SECRET;

    if (secret && req.headers["x-game-server-secret"] !== secret) {
        return res.status(401).json({ error: "Invalid game server secret" });
    }

    const players = Number(req.body.players);
    const servers = Number(req.body.servers);

    if (!Number.isInteger(players) || players < 0 || players > 100000) {
        return res.status(400).json({ error: "players must be a non-negative integer" });
    }

    if (!Number.isInteger(servers) || servers < 0 || servers > 1000) {
        return res.status(400).json({ error: "servers must be a non-negative integer" });
    }

    state.online = req.body.online !== false;
    state.matchmaking = req.body.matchmaking !== false;
    state.players = players;
    state.servers = servers;
    state.lastHeartbeat = new Date().toISOString();

    res.json({ success: true, ...state });
});

// Protected diagnostic endpoint. Uses the existing Tidal JWT, not an Epic credential.
router.get("/api/account/me", (req, res) => {
    const secret = process.env.JWT_SECRET;
    const header = req.headers.authorization || "";

    if (!secret || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing Tidal authorization" });
    }

    try {
        const payload = jwt.verify(header.slice(7), secret);
        res.json({
            id: payload.discordId || null,
            username: payload.username || null,
            authenticated: true
        });
    } catch {
        res.status(401).json({ error: "Invalid or expired Tidal token" });
    }
});

module.exports = router;
