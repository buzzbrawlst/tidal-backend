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

const DATA_DIR = path.join(__dirname, "..", "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const NEWS_FILE = path.join(__dirname, "..", "news", "news.json");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder().setName("backend").setDescription("Show Tidal backend status"),
    new SlashCommandBuilder().setName("players").setDescription("Show current Tidal player/server status"),
    new SlashCommandBuilder().setName("server").setDescription("Show Tidal game server status"),
    new SlashCommandBuilder().setName("news").setDescription("Show the latest Tidal news"),

    new SlashCommandBuilder().setName("userinfo").setDescription("View a Tidal user's account information")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true)),
    new SlashCommandBuilder().setName("lookup").setDescription("Find a Tidal account by username")
        .addStringOption(o => o.setName("username").setDescription("Tidal username").setRequired(true)),
    new SlashCommandBuilder().setName("users").setDescription("Show Tidal account count"),

    new SlashCommandBuilder().setName("ban").setDescription("Ban a Tidal account")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration, e.g. 7d, 12h, permanent").setRequired(false)),
    new SlashCommandBuilder().setName("unban").setDescription("Unban a Tidal account")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true)),
    new SlashCommandBuilder().setName("suspend").setDescription("Suspend a Tidal account")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration, e.g. 7d, 12h").setRequired(true)),
    new SlashCommandBuilder().setName("unsuspend").setDescription("Remove a Tidal suspension")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true)),

    new SlashCommandBuilder().setName("give").setDescription("Give an item to a Tidal account")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
        .addStringOption(o => o.setName("item").setDescription("Item ID or name").setRequired(true))
        .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100000).setRequired(true)),
    new SlashCommandBuilder().setName("remove").setDescription("Remove an item from a Tidal account")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
        .addStringOption(o => o.setName("item").setDescription("Item ID or name").setRequired(true))
        .addIntegerOption(o => o.setName("amount").setDescription("Amount").setMinValue(1).setMaxValue(100000).setRequired(true)),
    new SlashCommandBuilder().setName("inventory").setDescription("View a Tidal user's inventory")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true)),
    new SlashCommandBuilder().setName("set-level").setDescription("Set a Tidal user's level")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true))
        .addIntegerOption(o => o.setName("level").setDescription("New level").setMinValue(0).setMaxValue(10000).setRequired(true)),
    new SlashCommandBuilder().setName("set-admin").setDescription("Make a Tidal account an admin")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true)),
    new SlashCommandBuilder().setName("remove-admin").setDescription("Remove Tidal admin status")
        .addUserOption(o => o.setName("user").setDescription("Discord user").setRequired(true)),

    new SlashCommandBuilder().setName("publish-news").setDescription("Publish a Tidal news post")
        .addStringOption(o => o.setName("title").setDescription("News title").setRequired(true))
        .addStringOption(o => o.setName("description").setDescription("News description").setRequired(true))
        .addStringOption(o => o.setName("category").setDescription("News category").setRequired(true))
        .addStringOption(o => o.setName("image").setDescription("Optional image URL").setRequired(false))
].map(command => command.toJSON());

function isAdmin(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    return Boolean(ADMIN_ROLE_ID && interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID));
}

function requireAdmin(interaction) {
    if (isAdmin(interaction)) return true;
    interaction.reply({ content: "❌ You do not have permission to use this Tidal admin command.", ephemeral: true }).catch(() => {});
    return false;
}

function ensureDataFiles() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, "[]\n", "utf8");
}

function readAccounts() {
    ensureDataFiles();
    try {
        const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function writeAccounts(accounts) {
    ensureDataFiles();
    const temp = `${ACCOUNTS_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(accounts, null, 2) + "\n", "utf8");
    fs.renameSync(temp, ACCOUNTS_FILE);
}

function getOrCreateAccount(discordUser) {
    const accounts = readAccounts();
    let account = accounts.find(a => a.discordId === discordUser.id);

    if (!account) {
        account = {
            accountId: `tidal-${discordUser.id}`,
            discordId: discordUser.id,
            username: discordUser.username,
            globalName: discordUser.globalName || null,
            createdAt: new Date().toISOString(),
            banned: false,
            banReason: null,
            banExpiresAt: null,
            suspended: false,
            suspensionReason: null,
            suspensionExpiresAt: null,
            admin: false,
            level: 0,
            inventory: {}
        };
        accounts.push(account);
        writeAccounts(accounts);
    } else if (account.username !== discordUser.username || account.globalName !== (discordUser.globalName || null)) {
        account.username = discordUser.username;
        account.globalName = discordUser.globalName || null;
        writeAccounts(accounts);
    }

    return { accounts, account };
}

function findAccount(discordUser) {
    const { account } = getOrCreateAccount(discordUser);
    return account;
}

function parseDuration(value) {
    if (!value || value.toLowerCase() === "permanent" || value.toLowerCase() === "perm") return null;
    const match = value.trim().toLowerCase().match(/^(\d+)\s*(m|h|d|w)$/);
    if (!match) return undefined;
    const amount = Number(match[1]);
    const units = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000 };
    return new Date(Date.now() + amount * units[match[2]]).toISOString();
}

function refreshTemporaryStatus(account) {
    let changed = false;
    if (account.banned && account.banExpiresAt && Date.parse(account.banExpiresAt) <= Date.now()) {
        account.banned = false;
        account.banReason = null;
        account.banExpiresAt = null;
        changed = true;
    }
    if (account.suspended && account.suspensionExpiresAt && Date.parse(account.suspensionExpiresAt) <= Date.now()) {
        account.suspended = false;
        account.suspensionReason = null;
        account.suspensionExpiresAt = null;
        changed = true;
    }
    return changed;
}

function saveAccount(account) {
    const accounts = readAccounts();
    const index = accounts.findIndex(a => a.accountId === account.accountId);
    if (index === -1) accounts.push(account);
    else accounts[index] = account;
    writeAccounts(accounts);
}

function formatExpiry(value) {
    if (!value) return "Permanent";
    return `<t:${Math.floor(new Date(value).getTime() / 1000)}:R>`;
}

function readNews() {
    try {
        const news = JSON.parse(fs.readFileSync(NEWS_FILE, "utf8"));
        return Array.isArray(news) ? news : [];
    } catch {
        return [];
    }
}

function writeNews(news) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2) + "\n", "utf8");
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
        const name = interaction.commandName;

        if (name === "backend") {
            await interaction.deferReply();
            try {
                const response = await axios.get(`${BACKEND_URL}/status`, { timeout: 8000 });
                const data = response.data;
                await interaction.editReply({ embeds: [new EmbedBuilder()
                    .setTitle("🌊 Tidal Backend")
                    .setDescription(data.online ? "Backend is responding normally." : "Backend reports offline.")
                    .addFields(
                        { name: "Status", value: data.online ? "🟢 Online" : "🔴 Offline", inline: true },
                        { name: "Version", value: String(data.version || "Unknown"), inline: true },
                        { name: "Fortnite", value: data.services?.fortnite ? "🟢 Ready" : "🔴 Offline", inline: true }
                    ).setTimestamp()] });
            } catch {
                await interaction.editReply("🔴 Tidal backend is currently unreachable.");
            }
            return;
        }

        if (name === "players" || name === "server") {
            await interaction.deferReply();
            try {
                const response = await axios.get(`${BACKEND_URL}/fortnite/api/game/status`, { timeout: 8000 });
                const data = response.data;
                await interaction.editReply({ embeds: [new EmbedBuilder()
                    .setTitle(name === "players" ? "🎮 Tidal Players" : "🖥️ Tidal Servers")
                    .addFields(
                        { name: "Game", value: data.online ? "🟢 Online" : "🔴 Offline", inline: true },
                        { name: "Players", value: String(data.players ?? 0), inline: true },
                        { name: "Servers", value: String(data.servers ?? 0), inline: true },
                        { name: "Matchmaking", value: data.matchmaking ? "🟢 Enabled" : "🔴 Disabled", inline: true },
                        { name: "Version", value: String(data.version || "Unknown"), inline: true }
                    ).setTimestamp()] });
            } catch {
                await interaction.editReply("🔴 Tidal game status endpoint is unavailable.");
            }
            return;
        }

        if (name === "news") {
            const news = readNews().slice(0, 5);
            if (!news.length) return interaction.reply("📰 No Tidal news posts yet.");
            const description = news.map((post, index) => `**${index + 1}. ${post.title}**\n${post.category || "News"} • ${post.date}\n${post.description}`).join("\n\n");
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📰 Latest Tidal News").setDescription(description.slice(0, 3900)).setTimestamp()] });
            return;
        }

        if (name === "userinfo") {
            if (!requireAdmin(interaction)) return;
            const user = interaction.options.getUser("user", true);
            const account = findAccount(user);
            if (refreshTemporaryStatus(account)) saveAccount(account);
            const inventory = Object.entries(account.inventory || {}).map(([item, amount]) => `${item}: **${amount}**`).join("\n") || "Empty";
            await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
                .setTitle(`👤 Tidal User — ${account.username}`)
                .addFields(
                    { name: "Username", value: account.username || "Unknown", inline: true },
                    { name: "Discord", value: `<@${account.discordId}>`, inline: true },
                    { name: "Account ID", value: account.accountId, inline: true },
                    { name: "Created", value: `<t:${Math.floor(new Date(account.createdAt).getTime() / 1000)}:F>`, inline: true },
                    { name: "Level", value: String(account.level ?? 0), inline: true },
                    { name: "Admin", value: account.admin ? "Yes" : "No", inline: true },
                    { name: "Status", value: account.banned ? `🔨 Banned (${formatExpiry(account.banExpiresAt)})` : account.suspended ? `⏸️ Suspended (${formatExpiry(account.suspensionExpiresAt)})` : "🟢 Active", inline: false },
                    { name: "Inventory", value: inventory.slice(0, 1024), inline: false }
                ).setTimestamp()] });
            return;
        }

        if (name === "lookup") {
            if (!requireAdmin(interaction)) return;
            const query = interaction.options.getString("username", true).toLowerCase();
            const accounts = readAccounts().filter(a => String(a.username || "").toLowerCase().includes(query)).slice(0, 10);
            if (!accounts.length) return interaction.reply({ content: "❌ No matching Tidal accounts found.", ephemeral: true });
            await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
                .setTitle("🔎 Tidal Account Lookup")
                .setDescription(accounts.map(a => `**${a.username}** — \`${a.accountId}\` — ${a.banned ? "🔨 Banned" : a.suspended ? "⏸️ Suspended" : "🟢 Active"}`).join("\n"))] });
            return;
        }

        if (name === "users") {
            if (!requireAdmin(interaction)) return;
            const accounts = readAccounts();
            const banned = accounts.filter(a => a.banned).length;
            const suspended = accounts.filter(a => a.suspended).length;
            await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle("👥 Tidal Accounts").addFields(
                { name: "Total", value: String(accounts.length), inline: true },
                { name: "Banned", value: String(banned), inline: true },
                { name: "Suspended", value: String(suspended), inline: true }
            ).setTimestamp()] });
            return;
        }

        if (["ban", "unban", "suspend", "unsuspend", "give", "remove", "inventory", "set-level", "set-admin", "remove-admin"].includes(name)) {
            if (!requireAdmin(interaction)) return;
            const user = interaction.options.getUser("user", true);
            const account = findAccount(user);
            refreshTemporaryStatus(account);

            if (name === "ban") {
                const reason = interaction.options.getString("reason", true);
                const duration = interaction.options.getString("duration") || "permanent";
                const expires = parseDuration(duration);
                if (expires === undefined) return interaction.reply({ content: "❌ Invalid duration. Use values like `30m`, `12h`, `7d`, `2w`, or `permanent`.", ephemeral: true });
                account.banned = true;
                account.banReason = reason;
                account.banExpiresAt = expires;
                saveAccount(account);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🔨 Tidal Account Banned").setDescription(`**${account.username}** has been banned.`).addFields({ name: "Reason", value: reason }, { name: "Duration", value: formatExpiry(expires) }).setTimestamp()] });
                return;
            }

            if (name === "unban") {
                account.banned = false;
                account.banReason = null;
                account.banExpiresAt = null;
                saveAccount(account);
                return interaction.reply(`✅ **${account.username}** has been unbanned.`);
            }

            if (name === "suspend") {
                const reason = interaction.options.getString("reason", true);
                const duration = interaction.options.getString("duration", true);
                const expires = parseDuration(duration);
                if (!expires) return interaction.reply({ content: "❌ Suspension duration must be temporary, e.g. `1h`, `7d`, or `2w`.", ephemeral: true });
                if (expires === undefined) return interaction.reply({ content: "❌ Invalid duration. Use `30m`, `12h`, `7d`, or `2w`.", ephemeral: true });
                account.suspended = true;
                account.suspensionReason = reason;
                account.suspensionExpiresAt = expires;
                saveAccount(account);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏸️ Tidal Account Suspended").setDescription(`**${account.username}** has been suspended.`).addFields({ name: "Reason", value: reason }, { name: "Expires", value: formatExpiry(expires) }).setTimestamp()] });
                return;
            }

            if (name === "unsuspend") {
                account.suspended = false;
                account.suspensionReason = null;
                account.suspensionExpiresAt = null;
                saveAccount(account);
                return interaction.reply(`✅ **${account.username}** has been unsuspended.`);
            }

            if (name === "give" || name === "remove") {
                const item = interaction.options.getString("item", true);
                const amount = interaction.options.getInteger("amount", true);
                account.inventory = account.inventory || {};
                const current = Number(account.inventory[item] || 0);
                if (name === "give") account.inventory[item] = current + amount;
                else {
                    const next = Math.max(0, current - amount);
                    if (next === 0) delete account.inventory[item];
                    else account.inventory[item] = next;
                }
                saveAccount(account);
                return interaction.reply(`✅ ${name === "give" ? "Gave" : "Removed"} **${amount}x ${item}** ${name === "give" ? "to" : "from"} **${account.username}**.`);
            }

            if (name === "inventory") {
                const inventory = Object.entries(account.inventory || {}).map(([item, amount]) => `**${item}** × ${amount}`).join("\n") || "Empty";
                return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle(`🎒 ${account.username}'s Inventory`).setDescription(inventory.slice(0, 3900))] });
            }

            if (name === "set-level") {
                account.level = interaction.options.getInteger("level", true);
                saveAccount(account);
                return interaction.reply(`✅ Set **${account.username}** to level **${account.level}**.`);
            }

            if (name === "set-admin" || name === "remove-admin") {
                account.admin = name === "set-admin";
                saveAccount(account);
                return interaction.reply(`✅ **${account.username}** is now ${account.admin ? "a Tidal admin" : "no longer a Tidal admin"}.`);
            }
        }

        if (name === "publish-news") {
            if (!requireAdmin(interaction)) return;
            const title = interaction.options.getString("title", true);
            const description = interaction.options.getString("description", true);
            const category = interaction.options.getString("category", true);
            const image = interaction.options.getString("image") || "";
            const news = readNews();
            news.unshift({
                title,
                date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }),
                category,
                description,
                image
            });
            writeNews(news);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📰 News Published").setDescription(`**${title}** has been added to the Tidal news feed.`).addFields({ name: "Category", value: category }).setTimestamp()] });
        }
    } catch (error) {
        console.error("Discord interaction error:", error.message);
        if (interaction.replied || interaction.deferred) await interaction.editReply("❌ Something went wrong while processing that command.").catch(() => {});
        else await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
    }
});

async function startDiscordBot() {
    if (!TOKEN || !CLIENT_ID) return false;
    await registerCommands();
    await client.login(TOKEN);
    return true;
}

module.exports = { startDiscordBot, client };
