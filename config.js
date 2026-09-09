require("dotenv").config();

module.exports = {
    port: process.env.PORT,

    jwtSecret: process.env.JWT_SECRET,

    discord: {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        guildID: process.env.DISCORD_GUILD_ID,
        adminRole: process.env.ADMIN_ROLE_ID
    }
};