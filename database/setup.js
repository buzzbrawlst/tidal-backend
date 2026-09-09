const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users(
            id TEXT PRIMARY KEY,
            username TEXT,
            avatar TEXT,
            admin INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS news(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            image TEXT,
            category TEXT,
            date TEXT
        )
    `);

    // Tidal game accounts are kept separate from Discord identities so the
    // launcher and game services can share the same account layer later.
    db.run(`
        CREATE TABLE IF NOT EXISTS accounts(
            account_id TEXT PRIMARY KEY,
            discord_id TEXT UNIQUE,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL,
            banned INTEGER DEFAULT 0,
            matchmaking_id TEXT UNIQUE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS game_servers(
            server_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            address TEXT,
            port INTEGER,
            players INTEGER DEFAULT 0,
            status TEXT DEFAULT 'offline',
            playlist TEXT,
            updated_at TEXT
        )
    `);
});

module.exports = db;
