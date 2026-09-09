require("dotenv").config();

module.exports = {
    port: process.env.PORT,
    backendUrl: process.env.BACKEND_URL || "https://tidal-backend-klp9.onrender.com",
    fortnite: {
        version: process.env.TIDAL_FORTNITE_VERSION || "12.41",
        buildUniqueId: process.env.TIDAL_BUILD_UNIQUE_ID || "1:Tidal:12.41"
    },
    jwtSecret: process.env.JWT_SECRET,
    gameServerSecret: process.env.GAME_SERVER_SECRET,
    discord: {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        botToken: process.env.DISCORD_BOT_TOKEN,
        guildID: process.env.DISCORD_GUILD_ID,
        adminRole: process.env.ADMIN_ROLE_ID
    }
};
