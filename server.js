require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Initialize the local database schema before routes use it.
require("./database/setup.js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Tidal website/news API
app.use("/news", require("./routes/news.js"));

// Tidal / Discord authentication
app.use("/auth", require("./routes/auth.js"));

// Fortnite-compatible service/status layer used by the Tidal game infrastructure.
app.use("/fortnite", require("./routes/fortnite.js"));

app.get("/", (req, res) => {
    res.json({
        name: "Tidal Backend",
        status: "Online 🌊",
        version: "1.1.0",
        services: {
            news: true,
            discordAuth: true,
            fortnite: true,
            discordBot: Boolean(process.env.DISCORD_BOT_TOKEN)
        }
    });
});

app.get("/status", (req, res) => {
    res.json({
        online: true,
        backend: "Tidal Backend",
        version: "1.1.0",
        environment: process.env.RENDER ? "render" : "local",
        services: {
            news: true,
            discordAuth: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI),
            fortnite: true,
            discordBot: Boolean(process.env.DISCORD_BOT_TOKEN)
        }
    });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
    console.log(`🌊 Tidal Backend running on port ${PORT}`);

    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) {
        try {
            const { startDiscordBot } = require("./bot/discord.js");
            await startDiscordBot();
        } catch (error) {
            console.error("🤖 Discord bot failed to start:", error.message);
        }
    } else {
        console.log("🤖 Discord bot waiting for DISCORD_BOT_TOKEN + DISCORD_CLIENT_ID.");
    }
});

module.exports = { app, server };
