const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "..", "data", "accounts.json");

function readAccounts() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
        return [];
    }
}

function writeAccounts(accounts) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(accounts, null, 2) + "\n", "utf8");
    fs.renameSync(temp, DATA_FILE);
}

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

router.get("/", requireAdminSecret, (req, res) => {
    const accounts = readAccounts();
    const search = String(req.query.search || "").trim().toLowerCase();
    const filtered = search
        ? accounts.filter(a =>
            String(a.username).toLowerCase().includes(search) ||
            String(a.globalName || "").toLowerCase().includes(search) ||
            String(a.discordId).includes(search) ||
            String(a.accountId).toLowerCase().includes(search)
        )
        : accounts;

    res.json({ count: filtered.length, accounts: filtered.map(sanitize) });
});

router.get("/:identifier", requireAdminSecret, (req, res) => {
    const identifier = String(req.params.identifier).toLowerCase();
    const account = readAccounts().find(a =>
        String(a.accountId).toLowerCase() === identifier ||
        String(a.discordId) === req.params.identifier ||
        String(a.username).toLowerCase() === identifier
    );

    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json({ account: sanitize(account) });
});

router.post("/", requireAdminSecret, (req, res) => {
    const { discordId, username, globalName, avatar } = req.body || {};

    if (!discordId || !username) {
        return res.status(400).json({ error: "discordId and username are required" });
    }

    const accounts = readAccounts();
    let account = accounts.find(a => String(a.discordId) === String(discordId));

    if (account) {
        account.username = username;
        account.globalName = globalName || account.globalName || null;
        account.avatar = avatar || account.avatar || null;
        writeAccounts(accounts);
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

    accounts.push(account);
    writeAccounts(accounts);
    res.status(201).json({ created: true, account: sanitize(account) });
});

router.patch("/:identifier", requireAdminSecret, (req, res) => {
    const identifier = String(req.params.identifier).toLowerCase();
    const accounts = readAccounts();
    const account = accounts.find(a =>
        String(a.accountId).toLowerCase() === identifier ||
        String(a.discordId) === req.params.identifier ||
        String(a.username).toLowerCase() === identifier
    );

    if (!account) return res.status(404).json({ error: "Account not found" });

    const allowed = [
        "banned", "banReason", "banExpiresAt",
        "suspended", "suspensionReason", "suspensionExpiresAt",
        "admin", "level", "inventory", "username", "globalName", "avatar"
    ];

    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
            account[key] = req.body[key];
        }
    }

    writeAccounts(accounts);
    res.json({ account: sanitize(account) });
});

module.exports = router;
