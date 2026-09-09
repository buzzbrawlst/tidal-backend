const { MongoClient } = require("mongodb");

let client;
let database;

async function getDb() {
    if (database) return database;

    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME || "tidal";

    if (!uri) {
        throw new Error("MONGODB_URI is not configured");
    }

    client = new MongoClient(uri);
    await client.connect();
    database = client.db(dbName);

    await database.collection("accounts").createIndex(
        { discordId: 1 },
        { unique: true }
    );

    return database;
}

module.exports = { getDb };
