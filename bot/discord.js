require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const BACKEND_URL = (process.env.BACKEND_URL || "https://tidal-backend-klp9.onrender.com").replace(/\/$/, "");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const commands = [
    new SlashCommandBuilder()
        .setName("backend")
        .setDescription("Show Tidal backend status"),
    new SlashCommandBuilder()
        .setName("players")
        .setDescription("Show current Tidal player/server status"),
    new SlashCommandBuilder()
        .setName("news")
        .setDescription("Publish a Tidal news post")
        .addStringOption(o => o.setName("title").setDescription("News title").setRequired(true))
        .addStringOption(o => o.setName("description").setDescription("News description").setRequired(true))
        .addStringOption(o => o.setName("category").setDescription("News category").setRequired(true))
        .addStringOption(o => o.setName("image").setDescription("Optional image URL").setRequired(false))
].map(command => command.toJSON());

function isAdmin(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (ADMIN_ROLE_ID && interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID)) return true;
    return false;
}

function readNews() {
    const file = path.join(__dirname, "..", "news", "news.json");
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return [];
    }
}

function writeNews(news) {
    const file = path.join(__dirname, "..", "news", "news.json");
    fs.writeFileSync(file, JSON.stringify(news, null, 2) + "\n", "utf8");
}

async function registerCommands() {
    if (!TOKEN || !CLIENT_ID) {
        console.log("⚠️ Discord bot is not configured. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID.");
        return false;
    }

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    try {
        if (GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
            console.log("🌊 Tidal Discord commands registered in the configured server.");
        } else {
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            console.log("🌊 Tidal Discord global commands registered.");
        }
        return true;
    } catch (error) {
        console.error("Discord command registration failed:", error.message);
        return false;
    }
}

client.once("ready", () => {
    console.log(`🤖 Tidal bot online as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: "Tidal Backend 🌊", type: 3 }],
        status: "online"
    });
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        if (interaction.commandName === "backend") {
            await interaction.deferReply();

            try {
                const response = await axios.get(`${BACKEND_URL}/status`, { timeout: 8000 });
                const data = response.data;

                const embed = new EmbedBuilder()
                    .setTitle("🌊 Tidal Backend")
                    .setDescription("Backend is responding normally.")
                    .addFields(
                        { name: "Status", value: data.online ? "🟢 Online" : "🔴 Offline", inline: true },
                        { name: "Version", value: String(data.version || "Unknown"), inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch {
                await interaction.editReply("🔴 Tidal backend is currently unreachable.");
            }
            return;
        }

        if (interaction.commandName === "players") {
            await interaction.deferReply();

            try {
                const response = await axios.get(`${BACKEND_URL}/fortnite/api/game/status`, { timeout: 8000 });
                const data = response.data;

                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle("🎮 Tidal Game Status")
                        .addFields(
                            { name: "Game", value: data.online ? "🟢 Online" : "🔴 Offline", inline: true },
                            { name: "Players", value: String(data.players ?? 0), inline: true },
                            { name: "Servers", value: String(data.servers ?? 0), inline: true }
                        )
                        .setTimestamp()]
                });
            } catch {
                await interaction.editReply("🔴 Game status endpoint is unavailable.");
            }
            return;
        }

        if (interaction.commandName === "news") {
            if (!isAdmin(interaction)) {
                await interaction.reply({ content: "❌ You do not have permission to publish Tidal news.", ephemeral: true });
                return;
            }

            const title = interaction.options.getString("title", true);
            const description = interaction.options.getString("description", true);
            const category = interaction.options.getString("category", true);
            const image = interaction.options.getString("image") || "";

            const news = readNews();
            news.unshift({
                title,
                date: new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Europe/London"
                }),
                category,
                description,
                image
            });

            writeNews(news);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle("📰 News Published")
                    .setDescription(`**${title}** has been added to the Tidal news feed.`)
                    .addFields({ name: "Category", value: category, inline: true })
                    .setTimestamp()]
            });
        }
    } catch (error) {
        console.error("Discord interaction error:", error);
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply("❌ Something went wrong while processing that command.").catch(() => {});
        } else {
            await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
        }
    }
});

async function startDiscordBot() {
    if (!TOKEN || !CLIENT_ID) return false;
    await registerCommands();
    await client.login(TOKEN);
    return true;
}

module.exports = { startDiscordBot, client };
