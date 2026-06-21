// ==========================================
// VORTEX SYSTEM BOT - Professional Version
// ==========================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const ms = require('ms');
const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent,
    AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelType, PermissionFlagsBits,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    REST, Routes, SlashCommandBuilder
} = require('discord.js');

// ==========================================
// 1️⃣ تعريف الـ Schemas (قاعدة البيانات)
// ==========================================

const KickConfig = mongoose.model('KickConfig', new mongoose.Schema({
    guildId: String,
    streamers: [{
        kickUsername: String,
        channelId: String,
        roleId: String,
        customMessage: String,
        isLive: { type: Boolean, default: false }
    }]
}));

const TicketData = mongoose.model('TicketData', new mongoose.Schema({
    ticketCount: { type: Number, default: 0 },
    guildId: String,
    channelId: String,
    ownerId: String,
    claimedBy: String,
    openedAt: Date,
    closedAt: Date,
    closedBy: String
}));

const UserLevel = mongoose.model('UserLevel', new mongoose.Schema({
    guildId: String,
    userId: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    msgCount: { type: Number, default: 0 },
    streakCount: { type: Number, default: 0 },
    dailyMsgs: { type: Number, default: 0 },
    lastMessageDate: { type: Date, default: Date.now },
    warned: { type: Boolean, default: false }
}));

const StreakConfig = mongoose.model('StreakConfig', new mongoose.Schema({
    guildId: String,
    requiredMessages: { type: Number, default: 60 },
    streakRole: String,
    rewardRole: String,
    streakChannel: String
}));

const ModConfig = mongoose.model('ModConfig', new mongoose.Schema({
    guildId: String,
    jail: {
        commandName: { type: String, default: 'jail' },
        unjailCommand: { type: String, default: 'unjail' },
        roleId: String,
        channelId: String,
        adminRoles: [String]
    }
}));

const JailData = mongoose.model('JailData', new mongoose.Schema({
    guildId: String,
    userId: String,
    oldRoles: [String],
    overwrites: [{
        channelId: String,
        deny: String,
        allow: String
    }],
    endAt: Date
}));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    autoReply: [{
        trigger: String,
        reply: String
    }],
    security: {
        antiLinks: Boolean,
        badWords: String,
        badEmojis: String,
        punishment: { type: String, default: 'none' },
        bypassRoles: [String]
    },
    levels: {
        enabled: Boolean,
        xpPerMessage: { type: Number, default: 10 },
        levelUpChannel: String,
        leaderboardCommand: { type: String, default: '!levels' }
    },
    rolesPanel: [{
        roleId: String,
        label: String,
        type: { type: String, default: 'button' }
    }],
    rolesChannel: String,
    logs: {
        messages: { channel: String, enabled: Boolean },
        moderation: { channel: String, enabled: Boolean },
        members: { channel: String, enabled: Boolean },
        channels: { channel: String, enabled: Boolean },
        roles: { channel: String, enabled: Boolean },
        voice: { channel: String, enabled: Boolean }
    },
    welcome: {
        enabled: { type: Boolean, default: false },
        channel: String,
        embedMessage: { type: String, default: "مرحباً بك {member} في سيرفر {guild}! ✨" },
        imagePath: String,
        avatarX: { type: Number, default: 50 },
        avatarY: { type: Number, default: 50 },
        avatarWidth: { type: Number, default: 150 },
        avatarHeight: { type: Number, default: 150 },
        aiPrompt: { type: String, default: "Anime style landscape, forest, sun light, high quality" },
        bannerURL: String
    },
}));

const Stats = mongoose.model('Stats', new mongoose.Schema({
    guildId: String,
    messages: {
        total: { type: Number, default: 0 },
        daily: { type: Number, default: 0 },
        weekly: { type: Number, default: 0 },
        monthly: { type: Number, default: 0 },
        lastUpdate: { type: Date, default: Date.now }
    },
    activeChannels: { type: Map, of: Number, default: {} },
    membersLog: {
        joined: [Date],
        left: [Date]
    },
    modActions: {
        bans: { type: Number, default: 0 },
        kicks: { type: Number, default: 0 },
        warns: { type: Number, default: 0 }
    }
}));

const Giveaway = mongoose.model('Giveaway', new mongoose.Schema({
    guildId: String,
    messageId: String,
    channelId: String,
    endAt: Date,
    winnersCount: Number,
    prize: String,
    description: String,
    ended: { type: Boolean, default: false }
}));

const Clan = mongoose.model('Clan', new mongoose.Schema({
    assistantIds: [String],
    guildId: String,
    clanIndex: Number,
    clanName: String,
    roleId: String,
    leaderId: String,
    points: { type: Number, default: 0 },
    applyChannel: String,
    applyMessage: String,
    textChannelId: String,
    voiceChannelId: String,
    resultsChannelId: String,
    members: [String],
    questions: { type: [String], default: ["ما هو اسمك؟", "كم عمرك؟", "لماذا تريد الانضمام؟"] }
}));

const TicketConfig = mongoose.model('TicketConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    title: String,
    description: String,
    color: { type: String, default: '#007bff' },
    adminRole: String,
    topImagePath: String,
    bottomImagePath: String,
    ticketCount: { type: Number, default: 0 },
    buttons: [{ label: String, emoji: String }],
    menuOptions: [{ label: String, emoji: String }]
}));

// ==========================================
// 2️⃣ Express App Setup
// ==========================================
const app = express();
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
app.set('view engine', 'ejs');

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// ==========================================
// 3️⃣ تعريف الـ Client (إعدادات البوت)
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember]
});

const commands = [
    new SlashCommandBuilder().setName('setbanner').setDescription('رفع صورة الخط').addAttachmentOption(o => o.setName('image').setDescription('صورة البنر').setRequired(true)),
    new SlashCommandBuilder().setName('rename_panel').setDescription('لوحة تغيير الاسم').addStringOption(o => o.setName('name').setRequired(true).setDescription('الاسم')).addAttachmentOption(o => o.setName('image').setDescription('صورة اختيارية'))
].map(c => c.toJSON());

// ==========================================
// 4️⃣ اتصال قاعدة البيانات (MongoDB)
// ==========================================
mongoose.connect(process.env.MONGO_CONNECTION_STRING)
    .then(() => console.log('✅ Connected to VORTEX MongoDB Database'))
    .catch(err => console.log("❌ DB Connection Error:", err));

// ==========================================
// 5️⃣ الدوال المساعدة (Helper Functions)
// ==========================================
async function sendLog(guild, type, embed) {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config?.logs) return;
    const logChannelId = config.logs[type]?.channel;
    const enabled = config.logs[type]?.enabled;
    if (!enabled || !logChannelId) return;
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    logChannel.send({ embeds: [embed] }).catch(() => { });
}

async function getExecutor(guild, actionType) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 1, type: actionType });
        const entry = logs.entries.first();
        if (!entry) return "غير معروف";
        return `<@${entry.executor.id}>`;
    } catch {
        return "غير معروف";
    }
}

async function handleUnjail(member, guildId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild || !member) return;

        const jailData = await JailData.findOne({ guildId, userId: member.id });
        const modConfig = await ModConfig.findOne({ guildId });

        if (!jailData) return;

        // Restore roles
        const rolesToRestore = (jailData.oldRoles || []).filter(rId => guild.roles.cache.has(rId));
        if (modConfig?.jail?.roleId) {
            await member.roles.remove(modConfig.jail.roleId).catch(() => { });
        }
        for (const roleId of rolesToRestore) {
            await member.roles.add(roleId).catch(() => { });
        }

        // Restore channel permissions
        if (jailData.overwrites && jailData.overwrites.length > 0) {
            for (const ow of jailData.overwrites) {
                const channel = guild.channels.cache.get(ow.channelId);
                if (channel) {
                    await channel.permissionOverwrites.edit(member.id, {
                        ViewChannel: null
                    }).catch(() => { });
                }
            }
        }

        await JailData.deleteOne({ guildId, userId: member.id });

        const jailChannel = guild.channels.cache.get(modConfig?.jail?.channelId);
        if (jailChannel) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔓 فك سجن')
                .setDescription(`تم فك سجن <@${member.id}> وإعادة كافة صلاحياته ورتبه.`)
                .setTimestamp();
            jailChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("Unjail Error:", err);
    }
}

// ==========================================
// 6️⃣ Upload Setup
// ==========================================
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 7️⃣ Auth Setup
// ==========================================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    proxy: true,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(session({
    secret: process.env.SESSION_SECRET || 'vortex-ultra-secret-999',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
};

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.send(`
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>VORTEX | Login</title>
        <style>
            :root { --bg: #050505; --p: #007bff; --s: #ff4d4d; --card: #0f0f0f; }
            body { background: var(--bg); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: white; overflow: hidden; }
            .login-card { background: var(--card); padding: 60px; border-radius: 30px; text-align: center; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: fadeIn 1s ease-out; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            h1 { font-size: 48px; background: linear-gradient(45deg, var(--p), var(--s)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; letter-spacing: 5px; }
            p { color: #888; margin-bottom: 40px; font-size: 18px; }
            a { background: var(--p); color: white; padding: 18px 45px; border-radius: 15px; text-decoration: none; font-weight: bold; font-size: 20px; transition: 0.3s; display: inline-block; box-shadow: 0 10px 20px rgba(0,123,255,0.3); }
            a:hover { background: #0056b3; transform: scale(1.05); box-shadow: 0 15px 30px rgba(0,123,255,0.5); }
        </style>
    </head>
    <body>
        <div class="login-card">
            <h1>VORTEX</h1>
            <p>النظام الأقوى لإدارة سيرفرك باحترافية</p>
            <a href="/auth/discord">🔑 تسجيل الدخول عبر ديسكورد</a>
        </div>
    </body>
    </html>`);
});

app.get('/ping', (req, res) => {
    res.send('VORTEX is active!');
});

app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// ==========================================
// 8️⃣ UI Helper Function (Redesigned)
// ==========================================
function ui(guild, active, content) {
    const showNav = guild.id ? 'flex' : 'none';
    const guildName = guild.name || 'VORTEX DASHBOARD';
    const guildIcon = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';

    return `
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>VORTEX | ${guildName}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            :root {
                --bg: #050505;
                --sidebar: #0a0a0a;
                --card: #0f0f0f;
                --p: #007bff;
                --s: #ff4d4d;
                --accent: #00d2ff;
                --text: #ffffff;
                --text-dim: #888;
                --border: rgba(255,255,255,0.05);
            }
            * { box-sizing: border-box; }
            body { 
                background: var(--bg); 
                color: var(--text); 
                margin: 0; 
                font-family: 'Inter', 'Segoe UI', sans-serif; 
                display: flex;
                min-height: 100vh;
            }
            .sidebar {
                width: 280px;
                background: var(--sidebar);
                border-left: 1px solid var(--border);
                display: ${showNav};
                flex-direction: column;
                padding: 20px;
                position: fixed;
                height: 100vh;
                right: 0;
                z-index: 100;
            }
            .sidebar-header {
                padding: 20px 10px;
                text-align: center;
                border-bottom: 1px solid var(--border);
                margin-bottom: 20px;
            }
            .sidebar-header img {
                width: 80px;
                height: 80px;
                border-radius: 20px;
                margin-bottom: 15px;
                border: 2px solid var(--p);
            }
            .sidebar-header h2 { font-size: 18px; margin: 0; color: var(--p); }
            
            .nav-links { flex: 1; overflow-y: auto; }
            .nav-links a {
                display: flex;
                align-items: center;
                padding: 14px 18px;
                color: var(--text-dim);
                text-decoration: none;
                border-radius: 12px;
                margin-bottom: 8px;
                transition: 0.3s;
                font-weight: 500;
            }
            .nav-links a i { margin-left: 15px; font-size: 18px; width: 20px; text-align: center; }
            .nav-links a:hover { background: rgba(255,255,255,0.03); color: white; }
            .nav-links a.active { background: var(--p); color: white; box-shadow: 0 10px 20px rgba(0,123,255,0.2); }
            
            .main {
                flex: 1;
                margin-right: ${guild.id ? '280px' : '0'};
                padding: 40px;
                max-width: 1200px;
                margin-left: auto;
                margin-right: auto;
                animation: fadeIn 0.5s ease-out;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            .card {
                background: var(--card);
                border-radius: 24px;
                padding: 30px;
                border: 1px solid var(--border);
                margin-bottom: 30px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                transition: 0.3s;
            }
            .card:hover { transform: translateY(-5px); border-color: rgba(0,123,255,0.2); }
            
            h1, h2, h3 { margin-top: 0; }
            label { display: block; margin-bottom: 10px; font-weight: bold; color: var(--text-dim); font-size: 14px; }
            input, select, textarea {
                width: 100%;
                background: #151515;
                border: 1px solid var(--border);
                padding: 15px;
                border-radius: 12px;
                color: white;
                margin-bottom: 20px;
                outline: none;
                transition: 0.3s;
            }
            input:focus, select:focus, textarea:focus { border-color: var(--p); background: #1a1a1a; }
            
            .btn-save {
                background: linear-gradient(45deg, var(--p), #00a2ff);
                color: white;
                border: none;
                padding: 16px 30px;
                border-radius: 14px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                font-size: 16px;
                transition: 0.3s;
                box-shadow: 0 10px 20px rgba(0,123,255,0.2);
            }
            .btn-save:hover { transform: scale(1.02); box-shadow: 0 15px 30px rgba(0,123,255,0.4); }
            
            .guild-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 25px;
                width: 100%;
            }
            .guild-card {
                background: var(--card);
                border-radius: 24px;
                padding: 25px;
                text-align: center;
                border: 1px solid var(--border);
                transition: 0.3s;
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }
            .guild-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; width: 100%; height: 5px;
                background: var(--p);
                opacity: 0; transition: 0.3s;
            }
            .guild-card:hover { transform: translateY(-10px); border-color: var(--p); }
            .guild-card:hover::before { opacity: 1; }
            .guild-icon { width: 90px; height: 90px; border-radius: 25px; margin-bottom: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
            
            /* Stats Widgets */
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
            .stat-box {
                padding: 25px;
                border-radius: 20px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            .stat-box i { font-size: 40px; opacity: 0.1; position: absolute; left: 10px; bottom: 10px; }
            .stat-val { font-size: 32px; font-weight: 800; margin-bottom: 5px; }
            .stat-label { color: var(--text-dim); font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }

            /* Animations */
            .pulse { animation: pulse-animation 2s infinite; }
            @keyframes pulse-animation { 0% { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0.4); } 100% { box-shadow: 0 0 0 20px rgba(0, 123, 255, 0); } }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <div class="sidebar-header">
                <img src="${guildIcon}" alt="Icon">
                <h2>${guildName}</h2>
                <div style="font-size: 12px; color: var(--text-dim); margin-top: 5px;">VORTEX v2.0</div>
            </div>
            <div class="nav-links">
                <a class="${active == 'home' ? 'active' : ''}" href="/manage/${guild.id}/home"><i class="fas fa-chart-line"></i> الإحصائيات</a>
                <a class="${active == 'kick' ? 'active' : ''}" href="/manage/${guild.id}/kick"><i class="fas fa-video"></i> تنبيهات Kick</a>
                <a class="${active == 'streaks' ? 'active' : ''}" href="/manage/${guild.id}/streaks"><i class="fas fa-fire"></i> نظام الستريك</a>
                <a class="${active == 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs"><i class="fas fa-history"></i> سجلات اللوق</a>
                <a class="${active == 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome"><i class="fas fa-door-open"></i> الترحيب</a>
                <a class="${active == 'security' ? 'active' : ''}" href="/manage/${guild.id}/security"><i class="fas fa-shield-alt"></i> الحماية</a>
                <a class="${active == 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets"><i class="fas fa-ticket-alt"></i> التذاكر</a>
                <a class="${active == 'mod' ? 'active' : ''}" href="/manage/${guild.id}/mod"><i class="fas fa-gavel"></i> الإشراف</a>
                <a class="${active == 'clans' ? 'active' : ''}" href="/manage/${guild.id}/clans"><i class="fas fa-users"></i> الكلانات</a>
                <a href="/dashboard" style="margin-top: 20px; color: var(--s);"><i class="fas fa-arrow-right"></i> خروج للسيرفرات</a>
            </div>
        </div>
        <div class="main">
            ${content}
        </div>
    </body>
    </html>`;
}

// ==========================================
// 9️⃣ Dashboard Routes
// ==========================================

app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const cards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const iconURL = g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        const inviteLink = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

        return `
    <div class="guild-card" onclick="location.href='${hasBot ? `/manage/${g.id}/home` : inviteLink}'">
        <img src="${iconURL}" class="guild-icon">
        <h3 style="color:white; margin:10px 0; font-size: 16px;">${g.name}</h3>
        <div style="font-size: 13px; font-weight: bold; color: ${hasBot ? 'var(--p)' : 'var(--accent)'}">
            ${hasBot ? '<i class="fas fa-cog"></i> الإعدادات' : '<i class="fas fa-plus"></i> إضافة البوت'}
        </div>
    </div>`;
    }).join('');

    const content = `
    <div style="text-align:center; margin-bottom: 50px;">
        <h1 style="font-size: 60px; font-weight: 900; background: linear-gradient(45deg, var(--p), var(--s)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 10px; margin-bottom: 10px;">VORTEX</h1>
        <p style="color: var(--text-dim); font-size: 18px;">اختر السيرفر الذي تريد إدارته</p>
    </div>
    <div class="guild-grid">${cards}</div>`;

    res.send(ui({ id: null, name: 'قائمة السيرفرات' }, 'home', content));
});

// --- [ Home / Stats Page ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    const statsData = await Stats.findOne({ guildId: g.id }) || {
        messages: { total: 0, daily: 0, weekly: 0, monthly: 0 },
        activeChannels: new Map(),
        membersLog: { joined: [], left: [] }
    };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMembersCount = (statsData.membersLog?.joined || []).filter(d => d > sevenDaysAgo).length;
    const leftMembersCount = (statsData.membersLog?.left || []).filter(d => d > sevenDaysAgo).length;

    const content = `
    <div class="card">
        <h2 style="margin-bottom: 30px;"><i class="fas fa-chart-pie" style="color: var(--p);"></i> نظرة عامة على النشاط</h2>
        <div class="stats-grid">
            <div class="stat-box" style="background: rgba(0,123,255,0.05); border: 1px solid rgba(0,123,255,0.1);">
                <i class="fas fa-envelope"></i>
                <div class="stat-val" style="color: var(--p);">${statsData.messages?.total || 0}</div>
                <div class="stat-label">إجمالي الرسائل</div>
            </div>
            <div class="stat-box" style="background: rgba(0,210,255,0.05); border: 1px solid rgba(0,210,255,0.1);">
                <i class="fas fa-users"></i>
                <div class="stat-val" style="color: var(--accent);">${g.memberCount}</div>
                <div class="stat-label">عدد الأعضاء</div>
            </div>
            <div class="stat-box" style="background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.1);">
                <i class="fas fa-user-plus"></i>
                <div class="stat-val" style="color: #00ff88;">+${newMembersCount}</div>
                <div class="stat-label">أعضاء جدد (أسبوع)</div>
            </div>
            <div class="stat-box" style="background: rgba(255,77,77,0.05); border: 1px solid rgba(255,77,77,0.1);">
                <i class="fas fa-user-minus"></i>
                <div class="stat-val" style="color: var(--s);">-${leftMembersCount}</div>
                <div class="stat-label">مغادرون (أسبوع)</div>
            </div>
        </div>
    </div>
    
    <div class="card">
        <h3><i class="fas fa-info-circle"></i> معلومات البوت في السيرفر</h3>
        <p style="color: var(--text-dim);">اسم البوت: <b>${client.user.username}</b></p>
        <p style="color: var(--text-dim);">تاريخ الإضافة: <b>${g.members.me.joinedAt.toLocaleDateString('ar-EG')}</b></p>
    </div>`;

    res.send(ui(g, 'home', content));
});

// --- [ Kick Notifications ] ---
app.get('/manage/:guildId/kick', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await KickConfig.findOne({ guildId: g.id }) || { streamers: [] };

    const content = `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h2><i class="fas fa-video" style="color: #00E701;"></i> تنبيهات Kick المباشرة</h2>
            <button onclick="document.getElementById('add-kick-form').style.display = 'block'" class="btn-save" style="width:auto; padding:10px 25px; background: #00E701; color:black;">➕ إضافة ستريمر</button>
        </div>

        <div id="add-kick-form" style="display:none; background: rgba(0,231,1,0.05); border: 1px solid #00E701; padding: 25px; border-radius: 20px; margin-bottom: 30px; animation: slideDown 0.4s;">
            <form method="POST" action="/save/${g.id}/kick">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <label>رابط القناة أو اسم المستخدم:</label>
                        <input type="text" name="kickUser" placeholder="مثلاً: hook" required>
                    </div>
                    <div>
                        <label>قناة التنبيه:</label>
                        <select name="channelId">
                            ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <label>الرتبة المطلوب عمل منشن لها:</label>
                <select name="roleId">
                    <option value="">-- بدون منشن --</option>
                    <option value="@everyone">@everyone</option>
                    <option value="@here">@here</option>
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </select>
                <label>رسالة التنبيه المخصصة:</label>
                <textarea name="msg" placeholder="استخدم %name% لاسم الستريمر..."></textarea>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-save" style="background: #00E701; color: black;">💾 حفظ البيانات</button>
                    <button type="button" onclick="document.getElementById('add-kick-form').style.display='none'" class="btn-save" style="background: #333;">إلغاء</button>
                </div>
            </form>
        </div>

        <div style="overflow-x: auto;">
            <table style="width:100%; color:white; border-collapse: collapse; text-align:right;">
                <thead>
                    <tr style="border-bottom: 2px solid #222;">
                        <th style="padding:15px;">الستريمر</th>
                        <th>قناة الإشعار</th>
                        <th>المنشن</th>
                        <th>التحكم</th>
                    </tr>
                </thead>
                <tbody>
                    ${s.streamers.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:40px; color:#555;">لا يوجد ستريمرز مضافين حالياً</td></tr>' : ''}
                    ${s.streamers.map((st, i) => `
                    <tr style="border-bottom: 1px solid #111;">
                        <td style="padding:20px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:10px; height:10px; border-radius:50%; background: ${st.isLive ? '#00E701' : '#555'}"></div>
                                <b>${st.kickUsername}</b>
                            </div>
                        </td>
                        <td><span style="background:rgba(0,123,255,0.1); padding:5px 12px; border-radius:8px; color:var(--p);">#${g.channels.cache.get(st.channelId)?.name || 'محذوفة'}</span></td>
                        <td>${st.roleId ? (st.roleId.startsWith('@') ? st.roleId : g.roles.cache.get(st.roleId)?.name || 'رتبة محذوفة') : 'لا يوجد'}</td>
                        <td>
                            <a href="/delete-kick/${g.id}/${i}" style="color:var(--s); text-decoration:none; font-size: 18px;" onclick="return confirm('هل أنت متأكد من الحذف؟')"><i class="fas fa-trash"></i></a>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>
    <style>@keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }</style>`;

    res.send(ui(g, 'kick', content));
});

app.post('/save/:guildId/kick', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { kickUser, channelId, roleId, msg } = req.body;
        const username = kickUser.replace('https://kick.com', '').replace('/', '').trim();

        await KickConfig.findOneAndUpdate(
            { guildId },
            { $push: { streamers: { kickUsername: username, channelId, roleId, customMessage: msg, isLive: false } } },
            { upsert: true }
        );
        res.redirect(`/manage/${guildId}/kick`);
    } catch (err) {
        res.status(500).send("خطأ في إضافة الستريمر");
    }
});

app.get('/delete-kick/:guildId/:index', checkAuth, async (req, res) => {
    const { guildId, index } = req.params;
    const config = await KickConfig.findOne({ guildId });
    if (config) {
        config.streamers.splice(index, 1);
        await config.save();
    }
    res.redirect(`/manage/${guildId}/kick`);
});

// --- [ Streaks ] ---
app.get('/manage/:guildId/streaks', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    const s = await StreakConfig.findOne({ guildId: g.id }) || {};

    const content = `
    <div class="card">
        <h2><i class="fas fa-fire" style="color: #ff8c00;"></i> نظام الستريك (التفاعل اليومي)</h2>
        <form method="POST" action="/save/${g.id}/streaks">
            <label>عدد الرسائل المطلوبة يومياً للحفاظ على الستريك:</label>
            <input type="number" name="reqMsgs" value="${s.requiredMessages || 60}" min="1">
            
            <label>رتبة الستريك (تمنح للمتفاعلين):</label>
            <select name="streakRole">
                <option value="">-- لا يوجد --</option>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.streakRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            
            <label>قناة إعلانات الستريك:</label>
            <select name="streakChannel">
                <option value="">-- لا يوجد --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.streakChannel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>
            
            <button class="btn-save">💾 حفظ إعدادات الستريك</button>
        </form>
        
        <div style="margin-top: 30px; padding: 20px; background: rgba(255,71,87,0.05); border: 1px solid rgba(255,71,87,0.2); border-radius: 15px;">
            <h4 style="color: var(--s); margin-top: 0;">⚠️ منطقة الخطر</h4>
            <p style="font-size: 13px; color: var(--text-dim);">تصفير الستريكات سيقوم بمسح كافة الأرقام القياسية للأعضاء.</p>
            <form method="POST" action="/reset-streaks/${g.id}" onsubmit="return confirm('هل أنت متأكد من تصفير كل الستريكات؟')">
                <button class="btn-save" style="background: var(--s); width: auto;">🔄 تصفير كل الستريكات الآن</button>
            </form>
        </div>
    </div>`;

    res.send(ui(g, 'streaks', content));
});

app.post('/save/:guildId/streaks', checkAuth, async (req, res) => {
    await StreakConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { requiredMessages: Number(req.body.reqMsgs), streakRole: req.body.streakRole, streakChannel: req.body.streakChannel } },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/streaks`);
});

app.post('/reset-streaks/:guildId', checkAuth, async (req, res) => {
    await UserLevel.updateMany({ guildId: req.params.guildId }, { $set: { streakCount: 0, dailyMsgs: 0 } });
    res.redirect(`/manage/${req.params.guildId}/streaks`);
});

// --- [ Logs ] ---
app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { logs: {} };
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    const typeLabels = { 
        messages: '💬 الرسائل', 
        moderation: '⚖️ الإشراف', 
        members: '👥 الأعضاء', 
        channels: '📢 القنوات', 
        roles: '🎭 الرتب', 
        voice: '🎙️ الصوت' 
    };

    let content = `
    <div class="card">
        <h2><i class="fas fa-list-ul" style="color: var(--p);"></i> إعدادات سجلات اللوق</h2>
        <p style="color: var(--text-dim); margin-bottom: 30px;">فعل السجلات التي تريد مراقبتها واختر القناة المناسبة لكل نوع.</p>
        <form method="POST" action="/save/${g.id}/logs">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                ${types.map(t => `
                    <div style="background: #111; padding: 20px; border-radius: 18px; border: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <label style="margin:0; font-size: 16px; color: white;">${typeLabels[t]}</label>
                            <div class="switch-container">
                                <input type="checkbox" name="${t}_st" ${s.logs?.[t]?.enabled ? 'checked' : ''} style="width: 40px; height: 20px; margin: 0; cursor: pointer;">
                            </div>
                        </div>
                        <select name="${t}_ch" style="margin: 0;">
                            <option value="">-- اختر القناة --</option>
                            ${g.channels.cache.filter(c => c.type === 0).map(c =>
                                `<option value="${c.id}" ${s.logs?.[t]?.channel == c.id ? 'selected' : ''}># ${c.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                `).join('')}
            </div>
            <button class="btn-save" style="margin-top: 30px;">💾 حفظ كافة إعدادات اللوق</button>
        </form>
    </div>`;

    res.send(ui(g, 'logs', content));
});

app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
    const b = req.body;
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    let logData = {};
    types.forEach(t => {
        logData[`logs.${t}`] = { enabled: b[`${t}_st`] === 'on', channel: b[`${t}_ch`] };
    });
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: logData }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/logs`);
});

// --- [ Welcome ] ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };

    let content = `
    <div class="card">
        <h2><i class="fas fa-door-open" style="color: var(--accent);"></i> إعدادات الترحيب</h2>
        <form method="POST" action="/save/${g.id}/welcome">
            <label>حالة الترحيب:</label>
            <select name="enabled">
                <option value="true" ${s.welcome?.enabled ? 'selected' : ''}>مفعل</option>
                <option value="false" ${!s.welcome?.enabled ? 'selected' : ''}>معطل</option>
            </select>

            <label>قناة الترحيب:</label>
            <select name="channel">
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.welcome?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>

            <label>رسالة الترحيب (Embed):</label>
            <textarea name="msg" rows="4">${s.welcome?.embedMessage || "مرحباً بك {member} في سيرفر {guild}! ✨"}</textarea>
            
            <p style="font-size: 12px; color: var(--text-dim);">استخدم: {member} للمنشن، {guild} لاسم السيرفر، {count} لعدد الأعضاء.</p>
            
            <button class="btn-save">💾 حفظ إعدادات الترحيب</button>
        </form>
    </div>`;

    res.send(ui(g, 'welcome', content));
});

app.post('/save/:guildId/welcome', checkAuth, async (req, res) => {
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { 
            $set: { 
                "welcome.enabled": req.body.enabled === 'true',
                "welcome.channel": req.body.channel,
                "welcome.embedMessage": req.body.msg
            } 
        },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/welcome`);
});

// --- [ Security ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };

    const content = `
    <div class="card">
        <h2><i class="fas fa-shield-alt" style="color: var(--s);"></i> نظام الحماية التلقائي</h2>
        <form method="POST" action="/save/${g.id}/security">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div>
                    <label>منع الروابط:</label>
                    <select name="antiLinks">
                        <option value="true" ${s.security?.antiLinks ? 'selected' : ''}>مفعل</option>
                        <option value="false" ${!s.security?.antiLinks ? 'selected' : ''}>معطل</option>
                    </select>
                </div>
                <div>
                    <label>نوع العقوبة:</label>
                    <select name="punishment">
                        <option value="none" ${s.security?.punishment === 'none' ? 'selected' : ''}>حذف الرسالة فقط</option>
                        <option value="warn" ${s.security?.punishment === 'warn' ? 'selected' : ''}>تحذير</option>
                        <option value="mute" ${s.security?.punishment === 'mute' ? 'selected' : ''}>إسكات (Timeout)</option>
                    </select>
                </div>
            </div>

            <label>الكلمات الممنوعة (افصل بينها بفاصلة):</label>
            <textarea name="badWords" placeholder="مثال: كلمة1, كلمة2, كلمة3">${s.security?.badWords || ''}</textarea>

            <label>رتب الاستثناء (Bypass):</label>
            <select name="bypassRoles" multiple style="height: 120px;">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            
            <button class="btn-save">💾 حفظ إعدادات الحماية</button>
        </form>
    </div>`;

    res.send(ui(g, 'security', content));
});

app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { 
            $set: { 
                "security.antiLinks": req.body.antiLinks === 'true',
                "security.punishment": req.body.punishment,
                "security.badWords": req.body.badWords,
                "security.bypassRoles": Array.isArray(req.body.bypassRoles) ? req.body.bypassRoles : [req.body.bypassRoles].filter(x => x)
            } 
        },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Tickets ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await TicketConfig.findOne({ guildId: g.id }) || {};

    const content = `
    <div class="card">
        <h2><i class="fas fa-ticket-alt" style="color: #ff4d6d;"></i> نظام التذاكر المطور</h2>
        <form method="POST" action="/save/${g.id}/tickets">
            <label>عنوان التذكرة:</label>
            <input type="text" name="title" value="${s.title || 'الدعم الفني'}" required>
            
            <label>وصف التذكرة:</label>
            <textarea name="desc">${s.description || 'اضغط على الزر لفتح تذكرة جديدة'}</textarea>

            <label>لون الايمباد (Embed Color):</label>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <input type="color" name="color" value="${s.color || '#007bff'}" style="width: 80px; height: 50px; padding: 5px;">
                <span style="align-self: center; color: var(--text-dim);">اختر اللون المناسب لتصميم سيرفرك</span>
            </div>

            <label>رتبة الإدارة (التي ترى التذاكر):</label>
            <select name="adminRole">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>

            <label>قناة لوحة التذاكر:</label>
            <select name="channelId">
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>

            <button class="btn-save">💾 حفظ ونشر لوحة التذاكر</button>
        </form>
    </div>`;

    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    const { title, desc, color, adminRole, channelId } = req.body;

    const config = await TicketConfig.findOneAndUpdate(
        { guildId },
        { $set: { title, description: desc, color, adminRole, channelId } },
        { upsert: true, new: true }
    );

    // Send the ticket panel to the channel
    const channel = client.guilds.cache.get(guildId).channels.cache.get(channelId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .setColor(color)
            .setFooter({ text: 'VORTEX Ticket System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('فتح تذكرة')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Primary)
        );

        channel.send({ embeds: [embed], components: [row] }).catch(() => { });
    }

    res.redirect(`/manage/${guildId}/tickets`);
});

// --- [ Moderation ] ---
app.get('/manage/:guildId/mod', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await ModConfig.findOne({ guildId: g.id }) || { jail: {} };

    const content = `
    <div class="card">
        <h2><i class="fas fa-gavel" style="color: var(--s);"></i> إعدادات نظام الإشراف</h2>
        <form method="POST" action="/save/${g.id}/mod">
            <h3 style="color: var(--p); border-bottom: 1px solid #222; padding-bottom: 10px;">🛡️ نظام السجن المطور</h3>
            <p style="font-size: 13px; color: var(--text-dim);">عند سجن شخص، سيتم إخفاء كافة الرومات عنه تلقائياً.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>رتبة السجن:</label>
                    <select name="jailRole">
                        <option value="">-- اختر الرتبة --</option>
                        ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.jail?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>قناة السجن (حيث يتحدث المسجون):</label>
                    <select name="jailChannel">
                        <option value="">-- اختر القناة --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.jail?.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <label>رتب الإدارة المسموح لها بالسجن:</label>
            <select name="adminRoles" multiple style="height: 100px;">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.jail?.adminRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>

            <button class="btn-save">💾 حفظ إعدادات الإشراف</button>
        </form>
    </div>`;

    res.send(ui(g, 'mod', content));
});

app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    const { jailRole, jailChannel, adminRoles } = req.body;
    await ModConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { 
            $set: { 
                "jail.roleId": jailRole,
                "jail.channelId": jailChannel,
                "jail.adminRoles": Array.isArray(adminRoles) ? adminRoles : [adminRoles].filter(x => x)
            } 
        },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/mod`);
});

// --- [ Clans ] ---
app.get('/manage/:guildId/clans', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let clans = await Clan.find({ guildId: g.id });

    const content = `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h2><i class="fas fa-shield-alt" style="color: #ffd700;"></i> إدارة الكلانات</h2>
            <button onclick="document.getElementById('add-clan-form').style.display='block'" class="btn-save" style="width:auto; padding:10px 25px; background: #ffd700; color:black;">➕ إنشاء كلان جديد</button>
        </div>

        <div id="add-clan-form" style="display:none; background: rgba(255,215,0,0.05); border: 1px solid #ffd700; padding: 25px; border-radius: 20px; margin-bottom: 30px;">
            <form method="POST" action="/save/${g.id}/clans">
                <label>اسم الكلان:</label>
                <input type="text" name="clanName" required>
                
                <label>قائد الكلان (ID):</label>
                <input type="text" name="leaderId" required>
                
                <label>رتبة الكلان:</label>
                <select name="roleId">
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </select>

                <button class="btn-save" style="background: #ffd700; color: black;">✅ إنشاء الكلان</button>
            </form>
        </div>

        <div class="guild-grid">
            ${clans.map(c => `
                <div class="guild-card" style="border-color: rgba(255,215,0,0.2);">
                    <div style="font-size: 40px; margin-bottom: 10px;">🛡️</div>
                    <h3 style="margin:0;">${c.clanName}</h3>
                    <p style="font-size: 12px; color: var(--text-dim);">القائد: <@${c.leaderId}></p>
                    <div style="margin: 15px 0; font-weight: bold; color: #ffd700;">${c.points} نقطة</div>
                    <a href="/delete-clan/${g.id}/${c._id}" style="color: var(--s); text-decoration:none;" onclick="return confirm('حذف الكلان؟')">🗑️ حذف</a>
                </div>
            `).join('')}
        </div>
    </div>`;

    res.send(ui(g, 'clans', content));
});

app.post('/save/:guildId/clans', checkAuth, async (req, res) => {
    const { clanName, leaderId, roleId } = req.body;
    const count = await Clan.countDocuments({ guildId: req.params.guildId });
    await new Clan({
        guildId: req.params.guildId,
        clanName,
        leaderId,
        roleId,
        clanIndex: count + 1,
        members: [leaderId]
    }).save();
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

app.get('/delete-clan/:guildId/:id', checkAuth, async (req, res) => {
    await Clan.deleteOne({ _id: req.params.id });
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

// ==========================================
// 🔟 Bot Logic (Discord Events)
// ==========================================

client.on('ready', async () => {
    console.log(`🚀 VORTEX is ready as ${client.user.tag}`);
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (e) { console.error(e); }
});

// --- [ Kick Monitoring Loop ] ---
setInterval(async () => {
    const configs = await KickConfig.find();
    for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;

        for (const streamer of config.streamers) {
            try {
                // Use a proper user-agent to avoid blocks
                const response = await axios.get(`https://kick.com/api/v1/channels/${streamer.kickUsername}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' }
                });

                const data = response.data;
                const isLiveNow = data.livestream !== null;

                if (isLiveNow && !streamer.isLive) {
                    const channel = guild.channels.cache.get(streamer.channelId);
                    if (channel) {
                        const mention = streamer.roleId ? (streamer.roleId.startsWith('@') ? streamer.roleId : `<@&${streamer.roleId}> `) : '';
                        const msgText = (streamer.customMessage || '🔴 **%name%** بدأ البث الآن!').replace('%name%', streamer.kickUsername);
                        
                        const embed = new EmbedBuilder()
                            .setTitle(`🔴 ${streamer.kickUsername} بدأت البث الآن على Kick!`)
                            .setURL(`https://kick.com/${streamer.kickUsername}`)
                            .setDescription(data.livestream.session_title || 'لا يوجد عنوان')
                            .addFields(
                                { name: 'الفئة', value: data.recent_categories?.[0]?.name || 'غير محدد', inline: true },
                                { name: 'المشاهدين', value: `${data.livestream.viewer_count || 0}`, inline: true }
                            )
                            .setImage(data.livestream.thumbnail?.url || data.user.banner_image?.url)
                            .setThumbnail(data.user.profile_pic)
                            .setColor('#00E701')
                            .setTimestamp();

                        channel.send({ content: mention, embeds: [embed] });
                    }
                    streamer.isLive = true;
                } else if (!isLiveNow && streamer.isLive) {
                    streamer.isLive = false;
                }
            } catch (err) {
                // Kick API is often protected, handle errors silently
            }
        }
        await config.save();
    }
}, 60000); // Check every minute

// --- [ Message Events: Levels & Auto-Reply ] ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Auto Reply
    const config = await GuildConfig.findOne({ guildId: message.guild.id });
    if (config?.autoReply) {
        const ar = config.autoReply.find(r => r.trigger === message.content);
        if (ar) return message.reply(ar.reply);
    }

    // Levels & Stats
    const stats = await Stats.findOneAndUpdate(
        { guildId: message.guild.id },
        { $inc: { 'messages.total': 1, 'messages.daily': 1 } },
        { upsert: true, new: true }
    );

    const userLevel = await UserLevel.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        { $inc: { xp: 10, msgCount: 1, dailyMsgs: 1 } },
        { upsert: true, new: true }
    );

    // Level Up logic
    const neededXP = userLevel.level * 500;
    if (userLevel.xp >= neededXP) {
        userLevel.level += 1;
        userLevel.xp = 0;
        await userLevel.save();
        
        if (config?.levels?.enabled) {
            const lvChannel = message.guild.channels.cache.get(config.levels.levelUpChannel);
            if (lvChannel) lvChannel.send(`مبروك <@${message.author.id}>! لقد وصلت للمستوى **${userLevel.level}** 🎉`);
        }
    }
});

// --- [ Interaction: Tickets & Mod ] ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!config) return interaction.reply({ content: 'نظام التذاكر غير مهيأ.', ephemeral: true });

            config.ticketCount++;
            await config.save();

            const channel = await interaction.guild.channels.create({
                name: `ticket-${config.ticketCount}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: config.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`تذكرة رقم ${config.ticketCount}`)
                .setDescription(`أهلاً بك <@${interaction.user.id}>، سيقوم فريق الدعم بالرد عليك قريباً.`)
                .setColor(config.color || '#007bff');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️')
            );

            await channel.send({ content: `<@&${config.adminRole}>`, embeds: [embed], components: [row] });
            interaction.reply({ content: `تم فتح تذكرتك بنجاح: ${channel}`, ephemeral: true });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('سيتم إغلاق التذكرة خلال 5 ثوانٍ...');
            setTimeout(() => interaction.channel.delete(), 5000);
        }
        
        if (interaction.customId === 'claim_ticket') {
            interaction.reply({ content: `تم استلام التذكرة بواسطة <@${interaction.user.id}>` });
        }
    }

    // --- [ Slash Commands ] ---
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'jail') {
            // Check permissions
            const modConfig = await ModConfig.findOne({ guildId: interaction.guild.id });
            const hasRole = interaction.member.roles.cache.some(r => modConfig?.jail?.adminRoles?.includes(r.id));
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !hasRole) {
                return interaction.reply({ content: 'ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
            }

            const target = interaction.options.getMember('user');
            if (!target) return interaction.reply('لم يتم العثور على العضو.');

            // Save old roles and hide channels
            const oldRoles = target.roles.cache.map(r => r.id);
            const overwrites = [];

            // Loop through all channels to hide them
            for (const [id, channel] of interaction.guild.channels.cache) {
                if (channel.id === modConfig?.jail?.channelId) continue; // Don't hide jail channel
                
                try {
                    const currentOw = channel.permissionOverwrites.cache.get(target.id);
                    overwrites.push({
                        channelId: channel.id,
                        deny: currentOw?.deny.bitfield.toString() || '0',
                        allow: currentOw?.allow.bitfield.toString() || '0'
                    });

                    await channel.permissionOverwrites.edit(target.id, {
                        ViewChannel: false
                    });
                } catch (e) {}
            }

            await JailData.create({
                guildId: interaction.guild.id,
                userId: target.id,
                oldRoles,
                overwrites
            });

            // Give jail role
            if (modConfig?.jail?.roleId) {
                await target.roles.set([modConfig.jail.roleId]).catch(() => {});
            } else {
                await target.roles.set([]).catch(() => {});
            }

            interaction.reply(`✅ تم سجن <@${target.id}> وإخفاء كافة الرومات عنه.`);
        }
    }
});

// --- [ Log Events ] ---
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    const embed = new EmbedBuilder()
        .setTitle('🗑️ رسالة محذوفة')
        .setColor('#ff4d4d')
        .addFields(
            { name: 'المرسل', value: `<@${message.author.id}>`, inline: true },
            { name: 'القناة', value: `<#${message.channel.id}>`, inline: true },
            { name: 'المحتوى', value: message.content || 'صورة/ملف' }
        )
        .setTimestamp();
    sendLog(message.guild, 'messages', embed);
});

// ==========================================
// 1️⃣1️⃣ Start Everything
// ==========================================
client.login(process.env.TOKEN);
app.listen(PORT, () => console.log(`🌐 VORTEX Web Dashboard running on port ${PORT}`));

// ==========================================
// 1️⃣2️⃣ Cleaning & Optimization
// ==========================================
// This is a simplified professional version of VORTEX
// Total lines: ~1000 (Expandable to 3500+ with more modules)
// Features: Advanced UI, Kick Notifications with Embeds, Auto-Hide Jail, etc.
