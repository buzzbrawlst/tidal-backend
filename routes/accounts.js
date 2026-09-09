const router = require("express").Router();
const crypto = require("crypto");
const { getDb } = require("../db/mongo.js");

function requireAdminSecret(req, res, next) {
    const secret = process.env.BACKEND_ADMIN_SECRET;
    if (!secret || req.headers["x-tidal-admin-secret"] !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

function sanitize(account) {
    if (!account) return null;
    return {
        accountId: account.accountId,
        discordId: account.discordId,
        username: account.username,
        globalName: account.globalName || null,
        avatar: account.avatar || null,
        createdAt: account.createdAt,
        banned: Boolean(account.banned),
        banReason: account.banReason || null,
        banExpiresAt: account.banExpiresAt || null,
        suspended: Boolean(account.suspended),
        suspensionReason: account.suspensionReason || null,
        suspensionExpiresAt: account.suspensionExpiresAt || null,
        admin: Boolean(account.admin),
        level: Number(account.level || 1),
        inventory: account.inventory || {}
    };
}

async function findAccount(collection, identifier) {
    const value = String(identifier);
    const lower = value.toLowerCase();
    return collection.findOne({
        $or: [
            { accountId: lower },
            { discordId: value },
            { username: { $regex: `^${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
        ]
    });
}

router.get("/", requireAdminSecret, async (req, res) => {
    try {
        const db = await getDb();
        const search = String(req.query.search || "").trim();
        const filter = search
            ? {
                $or: [
                    { username: { $regex: search, $options: "i" } },
                    { globalName: { $regex: search, $options: "i" } },
                    { discordId: search },
                    { accountId: { $regex: search, $options: "i" } }
                ]
            }
            : {};

        const accounts = await db.collection("accounts").find(filter).toArray();
        res.json({ count: accounts.length, accounts: accounts.map(sanitize) });
    } catch (error) {
        console.error("Account list error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

router.get("/:identifier", requireAdminSecret, async (req, res) => {
    try {
        const db = await getDb();
        const account = await findAccount(db.collection("accounts"), req.params.identifier);

        if (!account) return res.status(404).json({ error: "Account not found" });
        res.json({ account: sanitize(account) });
    } catch (error) {
        console.error("Account lookup error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

router.post("/", requireAdminSecret, async (req, res) => {
    const { discordId, username, globalName, avatar } = req.body || {};

    if (!discordId || !username) {
        return res.status(400).json({ error: "discordId and username are required" });
    }

    try {
        const db = await getDb();
        const collection = db.collection("accounts");
        let account = await collection.findOne({ discordId: String(discordId) });

        if (account) {
            await collection.updateOne(
                { _id: account._id },
                {
                    $set: {
                        username,
                        globalName: globalName || account.globalName || null,
                        avatar: avatar || account.avatar || null,
                        updatedAt: new Date().toISOString()
                    }
                }
            );

            account = await collection.findOne({ _id: account._id });
            return res.json({ created: false, account: sanitize(account) });
        }

        account = {
            accountId: crypto.randomUUID(),
            discordId: String(discordId),
            username,
            globalName: globalName || null,
            avatar: avatar || null,
            createdAt: new Date().toISOString(),
            banned: false,
            banReason: null,
            banExpiresAt: null,
            suspended: false,
            suspensionReason: null,
            suspensionExpiresAt: null,
            admin: false,
            level: 1,
            inventory: {}
        };

        await collection.insertOne(account);
        res.status(201).json({ created: true, account: sanitize(account) });
    } catch (error) {
        console.error("Account creation error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

router.patch("/:identifier", requireAdminSecret, async (req, res) => {
    try {
        const db = await getDb();
        const collection = db.collection("accounts");
        const account = await findAccount(collection, req.params.identifier);

        if (!account) return res.status(404).json({ error: "Account not found" });

        const allowed = [
            "banned", "banReason", "banExpiresAt",
            "suspended", "suspensionReason", "suspensionExpiresAt",
            "admin", "level", "inventory", "username", "globalName", "avatar"
        ];

        const updates = {};
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
                updates[key] = req.body[key];
            }
        }

        updates.updatedAt = new Date().toISOString();
        await collection.updateOne({ _id: account._id }, { $set: updates });

        const updated = await collection.findOne({ _id: account._id });
        res.json({ account: sanitize(updated) });
    } catch (error) {
        console.error("Account update error:", error);
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;
