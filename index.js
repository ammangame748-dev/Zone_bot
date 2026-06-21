// ==========================================
// VORTEX SYSTEM BOT - FINAL COMPREHENSIVE VERSION
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
// 1️⃣ Database Schemas
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
    overwrites: [{ channelId: String, deny: String, allow: String }],
    endAt: Date
}));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    autoReply: [{ trigger: String, reply: String }],
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
    rolesPanel: [{ roleId: String, label: String, type: { type: String, default: 'button' } }],
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
    messages: { total: { type: Number, default: 0 }, daily: { type: Number, default: 0 } },
    membersLog: { joined: [Date], left: [Date] }
}));

const Clan = mongoose.model('Clan', new mongoose.Schema({
    guildId: String,
    clanName: String,
    leaderId: String,
    roleId: String,
    points: { type: Number, default: 0 },
    members: [String],
    questions: { type: [String], default: ["ما هو اسمك؟", "كم عمرك؟"] }
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
// 2️⃣ Web Dashboard Setup
// ==========================================
const app = express();
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
app.set('view engine', 'ejs');

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 3️⃣ Discord Bot Client
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildEmojisAndStickers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember]
});

// ==========================================
// 4️⃣ Authentication Logic
// ==========================================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    proxy: true,
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(session({ secret: process.env.SESSION_SECRET || 'vortex-mega-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const checkAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/login');

// ==========================================
// 5️⃣ UI Engine - Full CSS Design
// ==========================================
function ui(guild, active, content) {
    const showNav = guild.id ? 'flex' : 'none';
    const guildName = guild.name || 'VORTEX DASHBOARD';

    return `
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --p: #5865F2;
                --s: #ff4757;
                --bg: radial-gradient(circle at center, #1a1a2e 0%, #05051a 100%);
                --card-bg: rgba(0, 0, 0, 0.55);
                --accent: #00d2ff;
            }
            * { box-sizing: border-box; }
            body {
                margin: 0; font-family: 'Changa', sans-serif;
                background: var(--bg); background-attachment: fixed;
                color: white; display: flex; min-height: 100vh; direction: rtl;
            }

            /* ===== SIDEBAR ===== */
            .sidebar {
                width: 270px; background: rgba(0,0,0,0.85);
                backdrop-filter: blur(20px); position: fixed;
                right: 0; height: 100vh; padding: 25px 12px;
                border-left: 1px solid rgba(255,255,255,0.08);
                z-index: 1000; display: flex; flex-direction: column;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: var(--p) transparent;
            }
            .sidebar::-webkit-scrollbar { width: 5px; }
            .sidebar::-webkit-scrollbar-thumb { background: var(--p); border-radius: 10px; }
            .sidebar::-webkit-scrollbar-track { background: transparent; }

            .sidebar-logo {
                text-align: center; margin-bottom: 10px;
            }
            .sidebar-logo h2 {
                background: linear-gradient(to left, var(--p), var(--s));
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                font-size: 28px; font-weight: 700; margin: 0;
            }
            .sidebar-logo p {
                color: #666; font-size: 11px; margin: 4px 0 20px;
            }

            .nav { display: ${showNav}; flex-direction: column; gap: 6px; padding-bottom: 40px; }
            .nav a {
                display: flex; align-items: center; padding: 12px 16px;
                border-radius: 12px; color: #9aa3b0; text-decoration: none;
                transition: all 0.25s; gap: 12px; font-weight: 500; font-size: 14px;
            }
            .nav a:hover, .nav a.active {
                background: rgba(88,101,242,0.15); color: white;
                border-right: 4px solid var(--p); padding-right: 12px;
                transform: translateX(-3px);
            }
            .nav .nav-section {
                color: #444; font-size: 10px; text-transform: uppercase;
                letter-spacing: 1.5px; padding: 12px 16px 4px; font-weight: 700;
            }

            /* ===== MAIN CONTENT ===== */
            .main {
                margin-right: ${guild.id ? '270px' : '0'};
                padding: 40px; width: 100%; transition: 0.3s;
                min-height: 100vh;
            }
            .page-title {
                font-size: 26px; font-weight: 700; margin-bottom: 30px;
                display: flex; align-items: center; gap: 12px;
            }
            .page-title span {
                background: linear-gradient(45deg, var(--p), var(--accent));
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            }

            /* ===== CARDS ===== */
            .card {
                position: relative; background: var(--card-bg);
                backdrop-filter: blur(15px); padding: 28px;
                border-radius: 18px; margin-bottom: 24px;
                border: 1px solid rgba(255,255,255,0.06);
                overflow: hidden;
            }
            .card::before {
                content: ''; position: absolute; inset: 0; border-radius: 18px;
                padding: 1px;
                background: linear-gradient(135deg, rgba(88,101,242,0.4), rgba(0,210,255,0.2), rgba(255,71,87,0.2));
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor; mask-composite: exclude;
                pointer-events: none;
            }
            .card h3 {
                color: var(--accent); margin: 0 0 20px; font-size: 18px;
                display: flex; align-items: center; gap: 8px;
            }

            /* ===== FORM ELEMENTS ===== */
            label {
                display: block; color: #adb5bd; font-size: 13px;
                margin-bottom: 6px; margin-top: 14px; font-weight: 500;
            }
            label:first-child { margin-top: 0; }
            input[type="text"], input[type="number"], input[type="color"],
            input[type="email"], input[type="password"],
            select, textarea {
                width: 100%; padding: 12px 14px; border-radius: 10px;
                background: rgba(0,0,0,0.4); color: white;
                border: 1px solid rgba(255,255,255,0.1);
                font-family: 'Changa', sans-serif; font-size: 14px;
                transition: border-color 0.2s; outline: none;
                margin-bottom: 4px;
            }
            input:focus, select:focus, textarea:focus {
                border-color: var(--p);
                box-shadow: 0 0 0 3px rgba(88,101,242,0.15);
            }
            select option { background: #1a1a2e; }
            select[multiple] { height: 120px; }
            textarea { resize: vertical; min-height: 80px; }

            /* ===== GRID HELPERS ===== */
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
            @media (max-width: 768px) {
                .grid-2, .grid-3 { grid-template-columns: 1fr; }
                .main { padding: 20px; }
                .sidebar { width: 240px; }
                .main { margin-right: ${guild.id ? '240px' : '0'}; }
            }

            /* ===== BUTTONS ===== */
            .btn-save {
                background: linear-gradient(45deg, var(--p), #7b2ff7);
                color: white; border: none; padding: 13px 20px;
                border-radius: 12px; cursor: pointer; width: 100%;
                font-weight: bold; font-size: 14px; font-family: 'Changa', sans-serif;
                transition: all 0.3s; text-align: center;
                text-decoration: none; display: block; margin-top: 16px;
            }
            .btn-save:hover { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(88,101,242,0.35); }
            .btn-danger {
                background: linear-gradient(45deg, var(--s), #c0392b);
            }
            .btn-success {
                background: linear-gradient(45deg, #00b894, #00d2ff);
            }
            .btn-sm {
                padding: 8px 16px; width: auto; display: inline-block;
                border-radius: 8px; font-size: 13px; margin-top: 0;
            }

            /* ===== STATS BOXES ===== */
            .stat-box {
                background: rgba(88,101,242,0.08); padding: 20px;
                border-radius: 14px; text-align: center;
                border: 1px solid rgba(88,101,242,0.15);
                transition: transform 0.2s;
            }
            .stat-box:hover { transform: translateY(-3px); }
            .stat-box .stat-num { font-size: 36px; font-weight: 700; color: var(--p); }
            .stat-box .stat-label { color: #888; font-size: 13px; margin-top: 4px; }

            /* ===== GUILD CARDS ===== */
            .guild-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .guild-card {
                background: var(--card-bg); border-radius: 18px; padding: 24px;
                text-align: center; border: 1px solid rgba(255,255,255,0.08);
                transition: all 0.35s; width: 200px; cursor: pointer;
            }
            .guild-card:hover { transform: translateY(-8px); border-color: var(--p); box-shadow: 0 12px 30px rgba(88,101,242,0.2); }
            .guild-icon { width: 75px; height: 75px; border-radius: 50%; border: 3px solid var(--p); margin-bottom: 12px; }

            /* ===== TABLE ===== */
            table { width: 100%; border-collapse: collapse; color: white; }
            thead tr { border-bottom: 2px solid rgba(88,101,242,0.4); }
            th { padding: 10px 14px; color: var(--accent); font-size: 13px; text-align: right; }
            td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 14px; }
            tbody tr:hover { background: rgba(255,255,255,0.02); }

            /* ===== TOGGLE SWITCH ===== */
            .toggle-row {
                display: flex; align-items: center; gap: 14px;
                padding: 14px 16px; background: rgba(255,255,255,0.02);
                border-radius: 10px; margin-bottom: 10px;
                border: 1px solid rgba(255,255,255,0.04);
            }
            .toggle-label { flex: 1; color: var(--accent); font-size: 14px; }

            /* ===== WELCOME PREVIEW ===== */
            .preview-container {
                position: relative; border: 2px solid var(--p);
                border-radius: 12px; overflow: hidden;
                background: #000; width: 100%; aspect-ratio: 2/1;
                user-select: none; margin: 16px 0;
            }
            #previewAvatar {
                position: absolute; border: 3px solid #fff;
                border-radius: 50%; background-size: 100% 100%;
                cursor: move; box-shadow: 0 0 20px rgba(0,0,0,0.6);
            }
            .resizer {
                width: 12px; height: 12px; background: var(--p);
                position: absolute; border: 2px solid #fff; border-radius: 3px;
            }
            .resizer.br { right: -6px; bottom: -6px; cursor: nwse-resize; }
            .resizer.tr { right: -6px; top: -6px; cursor: nesw-resize; }
            .resizer.bl { left: -6px; bottom: -6px; cursor: nesw-resize; }

            /* ===== SCROLLBAR (global) ===== */
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-thumb { background: var(--p); border-radius: 10px; }
            ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
            * { scrollbar-width: thin; scrollbar-color: var(--p) transparent; }

            /* ===== BADGE ===== */
            .badge {
                display: inline-block; padding: 3px 10px; border-radius: 20px;
                font-size: 11px; font-weight: 700;
            }
            .badge-online { background: rgba(0,184,148,0.2); color: #00b894; }
            .badge-offline { background: rgba(255,71,87,0.2); color: var(--s); }

            /* ===== DIVIDER ===== */
            .divider {
                height: 1px; background: rgba(255,255,255,0.06);
                margin: 20px 0;
            }

            /* ===== HINT TEXT ===== */
            .hint { color: #666; font-size: 12px; margin-top: 4px; }

            /* ===== ANIMATION ===== */
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .card { animation: fadeIn 0.3s ease; }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <div class="sidebar-logo">
                <h2>VORTEX</h2>
                <p>نظام إدارة السيرفرات المتطور</p>
            </div>

            <div class="nav">
                <div class="nav-section">عام</div>
                <a class="${active == 'home' ? 'active' : ''}" href="/manage/${guild.id}/home">📊 الإحصائيات</a>
                <a class="${active == 'kick' ? 'active' : ''}" href="/manage/${guild.id}/kick">🟢 تنبيهات Kick</a>

                <div class="nav-section">الإعدادات</div>
                <a class="${active == 'security' ? 'active' : ''}" href="/manage/${guild.id}/security">🛡️ الحماية</a>
                <a class="${active == 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets">🎫 التذاكر</a>
                <a class="${active == 'mod' ? 'active' : ''}" href="/manage/${guild.id}/mod">⚖️ الإشراف</a>
                <a class="${active == 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs">📜 سجلات اللوق</a>
                <a class="${active == 'levels' ? 'active' : ''}" href="/manage/${guild.id}/levels">🏆 نظام الليفل</a>
                <a class="${active == 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome">👋 الترحيب</a>

                <div class="nav-section">أخرى</div>
                <a class="${active == 'clans' ? 'active' : ''}" href="/manage/${guild.id}/clans">🚩 الكلانات</a>
                <a href="/dashboard">🏠 قائمة السيرفرات</a>
            </div>
        </div>

        <div class="main">
            <div class="page-title"><span>${guildName}</span></div>
            ${content}
        </div>
    </body>
    </html>`;
}

// ==========================================
// 6️⃣ Routes & Logic
// ==========================================

app.get('/login', (req, res) => res.send(`
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { background: radial-gradient(circle at center, #1a1a2e 0%, #05051a 100%); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Changa', sans-serif; }
            .login-card { background: rgba(0,0,0,0.7); padding: 50px 60px; border-radius: 24px; text-align: center; border: 1px solid rgba(88,101,242,0.3); backdrop-filter: blur(20px); }
            h1 { background: linear-gradient(45deg, #5865F2, #ff4757); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 36px; margin-bottom: 8px; }
            p { color: #888; margin-bottom: 30px; }
            a { background: linear-gradient(45deg, #5865F2, #7b2ff7); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; transition: all 0.3s; display: inline-block; }
            a:hover { filter: brightness(1.2); transform: translateY(-2px); }
        </style>
    </head>
    <body>
        <div class="login-card">
            <h1>VORTEX</h1>
            <p>أقوى نظام لإدارة وحماية سيرفرات الديسكورد</p>
            <a href="/auth/discord">🔑 تسجيل الدخول عبر Discord</a>
        </div>
    </body>
    </html>
`));

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));
app.get('/logout', (req, res) => { req.logout(() => res.redirect('/login')); });
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
    const cards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `
        <div class="guild-card">
            <img src="${icon}" class="guild-icon">
            <h3 style="color:white; margin:8px 0; font-size:15px;">${g.name}</h3>
            ${hasBot
                ? `<a href="/manage/${g.id}/home" style="color:var(--p); text-decoration:none; font-weight:bold; font-size:13px;">⚙️ الإعدادات</a>`
                : `<a href="${inviteLink}" target="_blank" style="color:var(--accent); text-decoration:none; font-weight:bold; font-size:13px;">➕ إضافة البوت</a>`
            }
        </div>`;
    }).join('');

    res.send(ui({ id: null }, 'home', `
    <div style="text-align:center; padding-top:30px;">
        <div style="font-size:42px; font-weight:bold; background:linear-gradient(45deg,#ff4d6d,#7b2ff7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:10px;">VORTEX SYSTEM</div>
        <p style="color:#666; margin-bottom:40px;">اختر السيرفر الذي تود إدارته</p>
        <div class="guild-grid">${cards}</div>
    </div>`));
});

// --- [ Home Stats ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const stats = await Stats.findOne({ guildId: g.id }) || { messages: { total: 0 } };
    const content = `
    <div class="card">
        <h3>📊 إحصائيات السيرفر العامة</h3>
        <div class="grid-3">
            <div class="stat-box">
                <div class="stat-num">${stats.messages?.total || 0}</div>
                <div class="stat-label">إجمالي الرسائل</div>
            </div>
            <div class="stat-box" style="--p:#00d2ff;">
                <div class="stat-num" style="color:var(--accent);">${g.memberCount}</div>
                <div class="stat-label">عدد الأعضاء</div>
            </div>
            <div class="stat-box" style="background:rgba(0,184,148,0.08); border-color:rgba(0,184,148,0.15);">
                <div class="stat-num" style="color:#00b894;">${g.channels.cache.size}</div>
                <div class="stat-label">عدد القنوات</div>
            </div>
        </div>
    </div>`;
    res.send(ui(g, 'home', content));
});

// --- [ Kick Notifications ] ---
app.get('/manage/:guildId/kick', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await KickConfig.findOne({ guildId: g.id }) || { streamers: [] };
    const content = `
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0;">🟢 نظام تنبيهات Kick</h3>
            <button onclick="document.getElementById('add-form').style.display = document.getElementById('add-form').style.display==='none'?'block':'none'" class="btn-save btn-sm" style="background:linear-gradient(45deg,#00b894,#00d2ff);">➕ إضافة ستريمر</button>
        </div>

        <div id="add-form" style="display:none; border:1px solid rgba(0,183,74,0.3); padding:20px; border-radius:12px; margin-bottom:24px; background:rgba(0,183,74,0.05);">
            <form method="POST" action="/save/${g.id}/kick">
                <label>اسم المستخدم في Kick:</label>
                <input type="text" name="kickUser" placeholder="مثلاً: hook" required>
                <label>قناة التنبيه:</label>
                <select name="channelId">
                    ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                </select>
                <button class="btn-save btn-success">💾 إضافة</button>
            </form>
        </div>

        <table>
            <thead>
                <tr>
                    <th>الستريمر</th>
                    <th>القناة</th>
                    <th>الحالة</th>
                    <th>حذف</th>
                </tr>
            </thead>
            <tbody>
                ${s.streamers.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:#555; padding:30px;">لا يوجد ستريمرز مضافين بعد</td></tr>' : ''}
                ${s.streamers.map((st, i) => `
                <tr>
                    <td><b>${st.kickUsername}</b></td>
                    <td>#${g.channels.cache.get(st.channelId)?.name || 'محذوفة'}</td>
                    <td>${st.isLive ? '<span class="badge badge-online">🔴 مباشر</span>' : '<span class="badge badge-offline">⚫ غير مباشر</span>'}</td>
                    <td><a href="/delete-kick/${g.id}/${i}" style="color:var(--s); text-decoration:none;" onclick="return confirm('حذف؟')">🗑️</a></td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
    res.send(ui(g, 'kick', content));
});

app.post('/save/:guildId/kick', checkAuth, async (req, res) => {
    const { kickUser, channelId } = req.body;
    await KickConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $push: { streamers: { kickUsername: kickUser, channelId, isLive: false } } }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/kick`);
});

app.get('/delete-kick/:guildId/:index', checkAuth, async (req, res) => {
    const config = await KickConfig.findOne({ guildId: req.params.guildId });
    if (config) { config.streamers.splice(req.params.index, 1); await config.save(); }
    res.redirect(`/manage/${req.params.guildId}/kick`);
});

// --- [ Security Settings ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };
    const content = `
    <form method="POST" action="/save/${g.id}/security">
        <div class="card">
            <h3>🛡️ إعدادات الحماية والرقابة</h3>

            <div class="grid-2">
                <div>
                    <label>منع الروابط:</label>
                    <select name="antiLinks">
                        <option value="true" ${s.security?.antiLinks ? 'selected' : ''}>🟢 مفعّل</option>
                        <option value="false" ${!s.security?.antiLinks ? 'selected' : ''}>🔴 معطّل</option>
                    </select>
                </div>
                <div>
                    <label>نوع العقوبة:</label>
                    <select name="punishment">
                        <option value="none" ${s.security?.punishment === 'none' ? 'selected' : ''}>حذف الرسالة فقط</option>
                        <option value="warn" ${s.security?.punishment === 'warn' ? 'selected' : ''}>تحذير</option>
                        <option value="timeout" ${s.security?.punishment === 'timeout' ? 'selected' : ''}>إسكات (Timeout)</option>
                    </select>
                </div>
            </div>

            <label>الكلمات الممنوعة (افصل بفاصلة):</label>
            <textarea name="badWords" placeholder="كلمة1, كلمة2, كلمة3">${s.security?.badWords || ''}</textarea>
            <p class="hint">💡 سيتم حذف أي رسالة تحتوي على هذه الكلمات تلقائياً</p>

            <label>رتب الاستثناء (Bypass) - يمكن اختيار أكثر من رتبة:</label>
            <select name="bypassRoles" multiple>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
                    `<option value="${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>

            <button class="btn-save">💾 حفظ إعدادات الحماية</button>
        </div>
    </form>`;
    res.send(ui(g, 'security', content));
});

app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        $set: {
            "security.antiLinks": b.antiLinks === 'true',
            "security.punishment": b.punishment,
            "security.badWords": b.badWords,
            "security.bypassRoles": Array.isArray(b.bypassRoles) ? b.bypassRoles : [b.bypassRoles].filter(x => x)
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Ticket Settings ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [], menuOptions: [] };
    let topImg = s.topImagePath ? `/uploads/${path.basename(s.topImagePath)}` : 'https://placehold.co/110x110?text=Top';
    let bottomImg = s.bottomImagePath ? `/uploads/${path.basename(s.bottomImagePath)}` : 'https://placehold.co/110x110?text=Bottom';

    const content = `
    <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3>🎫 إعداد نظام التذاكر المتطور</h3>

            <div style="display:flex; gap:30px; justify-content:center; margin-bottom:24px;">
                <div style="text-align:center;">
                    <p style="color:#aaa; font-size:12px; margin-bottom:8px;">الصورة العلوية</p>
                    <img src="${topImg}" style="width:110px; height:110px; object-fit:cover; border-radius:12px; border:2px solid var(--p);">
                    <label style="background:var(--p); padding:6px 12px; border-radius:8px; cursor:pointer; display:block; margin-top:8px; font-size:12px; text-align:center;">
                        🔄 تغيير <input type="file" name="topImage" accept="image/*" style="display:none;">
                    </label>
                </div>
                <div style="text-align:center;">
                    <p style="color:#aaa; font-size:12px; margin-bottom:8px;">الصورة السفلية</p>
                    <img src="${bottomImg}" style="width:110px; height:110px; object-fit:cover; border-radius:12px; border:2px solid var(--p);">
                    <label style="background:var(--p); padding:6px 12px; border-radius:8px; cursor:pointer; display:block; margin-top:8px; font-size:12px; text-align:center;">
                        🔄 تغيير <input type="file" name="bottomImage" accept="image/*" style="display:none;">
                    </label>
                </div>
            </div>

            <div class="grid-2">
                <div>
                    <label>عنوان التذكرة:</label>
                    <input name="title" value="${s.title || ''}" placeholder="الدعم الفني">
                </div>
                <div>
                    <label>لون الإيمباد (Hex):</label>
                    <input name="color" value="${s.color || '#5865F2'}" placeholder="#5865F2">
                </div>
            </div>

            <label>وصف التذكرة:</label>
            <textarea name="description">${s.description || 'اضغط لفتح تذكرة'}</textarea>

            <div class="grid-2">
                <div>
                    <label>رتبة الإدارة:</label>
                    <select name="adminRole">
                        <option value="">-- اختر رتبة الإدارة --</option>
                        ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
                            `<option value="${r.id}" ${s.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label>📢 قناة الإرسال:</label>
                    <select name="targetChannel">
                        <option value="">-- لا ترسل الآن --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c =>
                            `<option value="${c.id}"># ${c.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <div class="divider"></div>
            <h4 style="color:var(--accent); margin-bottom:12px;">🔘 الأزرار (حتى 4):</h4>
            ${[0,1,2,3].map(i => `
            <div class="grid-2" style="margin-bottom:8px;">
                <input name="btn_label_${i}" value="${s.buttons?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                <input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji || ''}" placeholder="إيموجي (اختياري)">
            </div>`).join('')}

            <button class="btn-save">💾 حفظ ونشر اللوحة</button>
        </div>
    </form>`;
    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), async (req, res) => {
    const b = req.body;
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.status(404).send("Guild not found");

    let buttons = [];
    for (let i = 0; i < 4; i++) {
        if (b[`btn_label_${i}`]?.trim()) buttons.push({ label: b[`btn_label_${i}`], emoji: b[`btn_emoji_${i}`] || "" });
    }

    let data = { title: b.title, description: b.description, color: b.color || '#5865F2', adminRole: b.adminRole, buttons };
    if (req.files?.topImage?.[0]) data.topImagePath = req.files.topImage[0].path;
    if (req.files?.bottomImage?.[0]) data.bottomImagePath = req.files.bottomImage[0].path;

    const config = await TicketConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: data }, { upsert: true, new: true });

    if (b.targetChannel) {
        const ch = g.channels.cache.get(b.targetChannel);
        if (ch) {
            const files = [];
            const embed = new EmbedBuilder().setTitle(data.title || "TICKETS").setDescription(data.description || "اضغط للفتح").setColor(data.color);

            if (config.topImagePath && fs.existsSync(config.topImagePath)) {
                const topName = path.basename(config.topImagePath);
                files.push(new AttachmentBuilder(config.topImagePath, { name: topName }));
                embed.setThumbnail(`attachment://${topName}`);
            }
            if (config.bottomImagePath && fs.existsSync(config.bottomImagePath)) {
                const bottomName = path.basename(config.bottomImagePath);
                files.push(new AttachmentBuilder(config.bottomImagePath, { name: bottomName }));
                embed.setImage(`attachment://${bottomName}`);
            }

            const components = [];
            if (buttons.length > 0) {
                const row = new ActionRowBuilder();
                buttons.forEach((btn, i) => {
                    const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary);
                    if (btn.emoji?.trim()) {
                        try { button.setEmoji(btn.emoji.trim()); } catch(e) {}
                    }
                    row.addComponents(button);
                });
                components.push(row);
            } else {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Primary)
                ));
            }
            ch.send({ embeds: [embed], components, files }).catch(e => console.error("Discord Send Error:", e));
        }
    }
    res.redirect(`/manage/${req.params.guildId}/tickets`);
});

// --- [ Jail / Mod Settings ] ---
app.get('/manage/:guildId/mod', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await ModConfig.findOne({ guildId: g.id }) || { jail: {} };
    const content = `
    <form method="POST" action="/save/${g.id}/mod">
        <div class="card">
            <h3>⚖️ إعدادات نظام السجن</h3>

            <div class="grid-2">
                <div>
                    <label>اسم أمر السجن:</label>
                    <input name="jailCmd" value="${s.jail?.commandName || 'jail'}" placeholder="jail">
                </div>
                <div>
                    <label>اسم أمر فك السجن:</label>
                    <input name="unjailCmd" value="${s.jail?.unjailCommand || 'unjail'}" placeholder="unjail">
                </div>
            </div>

            <label>رتبة السجن (Jail Role):</label>
            <select name="jailRole">
                <option value="">-- اختر رتبة السجن --</option>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
                    `<option value="${r.id}" ${s.jail?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>

            <label>قناة السجن:</label>
            <select name="jailChannel">
                <option value="">-- اختر قناة السجن --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.jail?.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>

            <label>رتب الإدارة المسموح لها بالسجن:</label>
            <select name="adminRoles" multiple>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
                    `<option value="${r.id}" ${s.jail?.adminRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>

            <button class="btn-save">💾 حفظ إعدادات الإشراف</button>
        </div>
    </form>`;
    res.send(ui(g, 'mod', content));
});

app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    const b = req.body;
    await ModConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        $set: {
            "jail.commandName": b.jailCmd || 'jail',
            "jail.unjailCommand": b.unjailCmd || 'unjail',
            "jail.roleId": b.jailRole,
            "jail.channelId": b.jailChannel,
            "jail.adminRoles": Array.isArray(b.adminRoles) ? b.adminRoles : [b.adminRoles].filter(x => x)
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/mod`);
});

// --- [ Logs ] ---
app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { logs: {} };
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    const typeLabels = {
        messages: '💬 الرسائل', moderation: '⚖️ الإشراف',
        members: '👥 الأعضاء', channels: '📢 القنوات',
        roles: '🎭 الرتب', voice: '🎙️ الصوت'
    };

    const content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3>📜 نظام اللوق</h3>
            ${types.map(t => `
            <div class="toggle-row">
                <span class="toggle-label">${typeLabels[t]}</span>
                <input type="checkbox" name="${t}_st" ${s.logs?.[t]?.enabled ? 'checked' : ''} style="width:auto; margin:0; cursor:pointer; width:18px; height:18px;">
                <select name="${t}_ch" style="flex:1; max-width:280px; margin:0;">
                    <option value="">-- اختر القناة --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c =>
                        `<option value="${c.id}" ${s.logs?.[t]?.channel == c.id ? 'selected' : ''}># ${c.name}</option>`
                    ).join('')}
                </select>
            </div>`).join('')}
            <button class="btn-save">💾 حفظ إعدادات اللوق</button>
        </div>
    </form>`;
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

// --- [ Levels ] ---
app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { levels: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/levels">
        <div class="card">
            <h3>🏆 إعدادات نظام المستويات</h3>
            <div class="grid-2">
                <div>
                    <label>تشغيل النظام:</label>
                    <select name="enabled">
                        <option value="on" ${s.levels?.enabled ? 'selected' : ''}>🟢 مشغّل</option>
                        <option value="off" ${!s.levels?.enabled ? 'selected' : ''}>🔴 مطفأ</option>
                    </select>
                </div>
                <div>
                    <label>XP لكل رسالة:</label>
                    <input type="number" name="xp" value="${s.levels?.xpPerMessage || 10}" min="1">
                </div>
            </div>
            <label>قناة إعلانات الترقي:</label>
            <select name="channel">
                <option value="">-- نفس قناة الرسالة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.levels?.levelUpChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <label>أمر قائمة المتصدرين:</label>
            <input name="leaderboardCommand" value="${s.levels?.leaderboardCommand || '!levels'}" placeholder="!levels">
            <button class="btn-save">💾 حفظ إعدادات الليفل</button>
        </div>
    </form>`;
    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        $set: {
            "levels.enabled": b.enabled === 'on',
            "levels.xpPerMessage": Number(b.xp) || 10,
            "levels.levelUpChannel": b.channel,
            "levels.leaderboardCommand": b.leaderboardCommand || '!levels'
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Clans ] ---
app.get('/manage/:guildId/clans', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const clans = await Clan.find({ guildId: g.id });

    const content = `
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0;">🚩 نظام الكلانات</h3>
            <a href="/manage/${g.id}/clans/add" class="btn-save btn-sm">➕ إضافة كلان</a>
        </div>
        ${clans.length === 0 ? '<p style="color:#555; text-align:center; padding:30px;">لا يوجد كلانات بعد</p>' : ''}
        ${clans.map((clan, i) => `
        <div style="padding:18px; background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <b style="color:var(--accent);">${clan.clanName}</b>
                <p style="color:#666; margin:4px 0 0; font-size:13px;">الأعضاء: ${clan.members?.length || 0} | النقاط: ${clan.points}</p>
            </div>
            <a href="/delete-clan/${g.id}/${clan._id}" style="color:var(--s); text-decoration:none;" onclick="return confirm('حذف الكلان؟')">🗑️ حذف</a>
        </div>`).join('')}
    </div>`;
    res.send(ui(g, 'clans', content));
});

app.get('/manage/:guildId/clans/add', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const content = `
    <form method="POST" action="/save/${g.id}/clans">
        <div class="card">
            <h3>🚩 إضافة كلان جديد</h3>
            <label>اسم الكلان:</label>
            <input name="clanName" required placeholder="مثلاً: VORTEX TEAM">
            <label>ID القائد:</label>
            <input name="leaderId" required placeholder="ايدي صاحب الكلان">
            <label>رتبة الكلان:</label>
            <select name="roleId">
                <option value="">-- بدون رتبة --</option>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>
            <label>📝 أسئلة التقديم (سؤال في كل سطر):</label>
            <textarea name="questions" rows="4" placeholder="ما هو اسمك؟&#10;كم عمرك؟"></textarea>
            <button class="btn-save">💾 حفظ الكلان</button>
        </div>
    </form>`;
    res.send(ui(g, 'clans', content));
});

app.post('/save/:guildId/clans', checkAuth, async (req, res) => {
    const { clanName, leaderId, roleId, questions } = req.body;
    const questionsArray = questions ? questions.split('\n').filter(q => q.trim() !== "") : [];
    await Clan.create({ guildId: req.params.guildId, clanName, leaderId, roleId, questions: questionsArray, members: [] });
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

app.get('/delete-clan/:guildId/:clanId', checkAuth, async (req, res) => {
    await Clan.findByIdAndDelete(req.params.clanId);
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

// ==========================================
// 7️⃣ Welcome System (Full - From File 2)
// ==========================================
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };

    let img = s.welcome?.imagePath || 'https://placehold.co/800x400?text=No+Background';

    const content = `
    <style>
        .preview-container {
            position: relative; border: 2px solid var(--p);
            border-radius: 12px; overflow: hidden;
            background: #000; width: 100%; aspect-ratio: 2/1;
            user-select: none; margin: 16px 0;
        }
        #previewAvatar {
            position: absolute; border: 3px solid #fff;
            border-radius: 50%; background-size: 100% 100%;
            cursor: move; box-shadow: 0 0 20px rgba(0,0,0,0.6);
        }
        .resizer {
            width: 12px; height: 12px; background: var(--p);
            position: absolute; border: 2px solid #fff; border-radius: 3px;
        }
        .resizer.br { right: -6px; bottom: -6px; cursor: nwse-resize; }
        .resizer.tr { right: -6px; top: -6px; cursor: nesw-resize; }
        .resizer.bl { left: -6px; bottom: -6px; cursor: nesw-resize; }
    </style>

    <div class="card">
        <h3>👋 إعدادات نظام الترحيب</h3>
        <div class="grid-2">
            <div>
                <p style="color:#aaa; font-size:13px; margin:0;">الحالة الحالية:</p>
                <p style="margin:4px 0 0;">${s.welcome?.enabled
                    ? '<span class="badge badge-online">🟢 مشغّل</span>'
                    : '<span class="badge badge-offline">🔴 مطفأ</span>'
                }</p>
            </div>
            <div>
                <p style="color:#aaa; font-size:13px; margin:0;">القناة:</p>
                <p style="margin:4px 0 0; color:white;">${s.welcome?.channel ? `<#${s.welcome.channel}>` : 'لم تُحدد'}</p>
            </div>
        </div>
    </div>

    <form method="POST" action="/save/${g.id}/welcome" enctype="multipart/form-data" id="mainForm">
        <div class="card">
            <h3>⚙️ الإعدادات الأساسية</h3>
            <div class="grid-2">
                <div>
                    <label>📍 قناة الترحيب:</label>
                    <select name="channel" required>
                        ${g.channels.cache.filter(c => c.type === 0).map(c =>
                            `<option value="${c.id}" ${s.welcome?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label>🔔 الحالة:</label>
                    <select name="enabled">
                        <option value="on" ${s.welcome?.enabled ? 'selected' : ''}>🟢 مشغّل</option>
                        <option value="off" ${!s.welcome?.enabled ? 'selected' : ''}>🔴 مطفأ</option>
                    </select>
                </div>
            </div>

            <label>💬 رسالة الترحيب (نص الإيمباد):</label>
            <textarea name="embedMessage" rows="4" placeholder="اكتب رسالة الترحيب... يمكنك استخدام {member} و {guild} و {count}">${s.welcome?.embedMessage || ''}</textarea>
            <p class="hint">💡 المتغيرات المتاحة: {member} = منشن العضو | {guild} = اسم السيرفر | {count} = عدد الأعضاء</p>
        </div>

        <div class="card">
            <h3>🖼️ خلفية صورة الترحيب</h3>

            <label>🤖 توليد خلفية بالذكاء الاصطناعي:</label>
            <div style="display:flex; gap:10px; margin-bottom:16px;">
                <input type="text" id="aiPromptInput" name="aiPrompt"
                    value="${s.welcome?.aiPrompt || ''}"
                    placeholder="مثلاً: Galaxy background, blue stars, high quality"
                    style="flex:1;">
                <button type="button" onclick="generateAIImage()" class="btn-save btn-sm" style="background:linear-gradient(45deg,#7b2ff7,var(--accent)); margin-top:0; white-space:nowrap;">
                    🚀 توليد AI
                </button>
            </div>
            <input type="hidden" name="remoteBg" id="remoteBg">

            <label>📁 أو ارفع صورة خلفية مخصصة:</label>
            <input type="file" name="welcomeImage" accept="image/*" style="padding:10px; cursor:pointer;">
            <p class="hint">💡 الصورة المرفوعة ستلغي الخلفية المولّدة بالذكاء الاصطناعي</p>

            <div class="preview-container" id="container">
                <img src="${img}" id="previewBg" style="width:100%; height:100%; object-fit:cover; pointer-events:none; opacity:0.75;">
                <div id="previewAvatar" style="
                    width: ${s.welcome?.avatarWidth || 150}px;
                    height: ${s.welcome?.avatarHeight || 150}px;
                    left: ${s.welcome?.avatarX || 50}%;
                    top: ${s.welcome?.avatarY || 50}%;
                    transform: translate(-50%, -50%);
                    background-image: url('${client.user?.displayAvatarURL() || ''}');
                ">
                    <div class="resizer br"></div>
                    <div class="resizer tr"></div>
                    <div class="resizer bl"></div>
                </div>
            </div>

            <p style="color:#666; font-size:12px; text-align:center; margin-top:8px;">
                💡 اسحب الصورة لتحريكها، واستخدم المربعات الزرقاء في الزوايا لتغيير الحجم
            </p>

            <input type="hidden" name="avatarX" id="avatarX" value="${s.welcome?.avatarX || 50}">
            <input type="hidden" name="avatarY" id="avatarY" value="${s.welcome?.avatarY || 50}">
            <input type="hidden" name="avatarWidth" id="avatarWidth" value="${s.welcome?.avatarWidth || 150}">
            <input type="hidden" name="avatarHeight" id="avatarHeight" value="${s.welcome?.avatarHeight || 150}">

            <button type="submit" class="btn-save">💾 حفظ إعدادات الترحيب</button>
        </div>
    </form>

    <script>
        const avatar = document.getElementById('previewAvatar');
        const container = document.getElementById('container');
        let isDragging = false, isResizing = false, currentResizer = null;

        avatar.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resizer')) return;
            isDragging = true;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            if (isDragging) {
                let x = ((e.clientX - rect.left) / rect.width) * 100;
                let y = ((e.clientY - rect.top) / rect.height) * 100;
                x = Math.max(0, Math.min(100, x));
                y = Math.max(0, Math.min(100, y));
                avatar.style.left = x + '%';
                avatar.style.top = y + '%';
                document.getElementById('avatarX').value = Math.round(x);
                document.getElementById('avatarY').value = Math.round(y);
            }
            if (isResizing) {
                const avatarRect = avatar.getBoundingClientRect();
                if (currentResizer.classList.contains('br')) {
                    avatar.style.width = (e.clientX - avatarRect.left) + 'px';
                    avatar.style.height = (e.clientY - avatarRect.top) + 'px';
                } else if (currentResizer.classList.contains('tr')) {
                    avatar.style.width = (e.clientX - avatarRect.left) + 'px';
                    avatar.style.height = (avatarRect.bottom - e.clientY) + 'px';
                } else if (currentResizer.classList.contains('bl')) {
                    avatar.style.width = (avatarRect.right - e.clientX) + 'px';
                    avatar.style.height = (e.clientY - avatarRect.top) + 'px';
                }
                document.getElementById('avatarWidth').value = Math.round(avatar.offsetWidth);
                document.getElementById('avatarHeight').value = Math.round(avatar.offsetHeight);
            }
        });

        window.addEventListener('mouseup', () => { isDragging = false; isResizing = false; });

        document.querySelectorAll('.resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentResizer = e.target;
                e.stopPropagation();
                e.preventDefault();
            });
        });

        async function generateAIImage() {
            const prompt = document.getElementById('aiPromptInput').value;
            if (!prompt) return alert('اكتب وصفاً للخلفية أولاً!');
            const btn = event.target;
            btn.textContent = '⏳ جاري التوليد...';
            btn.disabled = true;
            const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ", no text, high quality, wide landscape") + '?width=800&height=400&nologo=true&seed=' + Date.now();
            document.getElementById('previewBg').src = url;
            document.getElementById('remoteBg').value = url;
            document.getElementById('previewBg').onload = () => {
                btn.textContent = '✅ تم التوليد';
                setTimeout(() => { btn.textContent = '🚀 توليد AI'; btn.disabled = false; }, 2000);
            };
        }
    </script>
    `;
    res.send(ui(g, 'welcome', content));
});

app.post('/save/:guildId/welcome', checkAuth, upload.single('welcomeImage'), async (req, res) => {
    try {
        const { guildId } = req.params;
        const b = req.body;

        let updateData = {
            'welcome.enabled': b.enabled === 'on',
            'welcome.channel': b.channel,
            'welcome.embedMessage': b.embedMessage,
            'welcome.avatarX': parseInt(b.avatarX) || 50,
            'welcome.avatarY': parseInt(b.avatarY) || 50,
            'welcome.avatarWidth': parseInt(b.avatarWidth) || 150,
            'welcome.avatarHeight': parseInt(b.avatarHeight) || 150,
            'welcome.aiPrompt': b.aiPrompt
        };

        if (req.file) {
            updateData['welcome.imagePath'] = req.file.path;
        } else if (b.remoteBg) {
            updateData['welcome.imagePath'] = b.remoteBg;
        }

        await GuildConfig.findOneAndUpdate({ guildId }, { $set: updateData }, { upsert: true, new: true });
        res.redirect(`/manage/${guildId}/welcome`);
    } catch (err) {
        console.error("Welcome Save Error:", err);
        res.status(500).send("خطأ في حفظ الإعدادات");
    }
});

// ==========================================
// 8️⃣ Discord Events Logic
// ==========================================

client.on('ready', () => console.log(`🚀 VORTEX SYSTEM ONLINE: ${client.user.tag}`));

// --- [ Welcome Event ] ---
client.on('guildMemberAdd', async (member) => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config?.welcome?.enabled || !config.welcome.channel) return;

    const welcomeChannel = member.guild.channels.cache.get(config.welcome.channel);
    if (!welcomeChannel) return;

    try {
        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext('2d');

        let bgUrl = config.welcome.imagePath || 'https://placehold.co/800x400?text=Welcome';
        const background = await loadImage(bgUrl);
        ctx.drawImage(background, 0, 0, 800, 400);

        const avW = config.welcome.avatarWidth || 150;
        const avH = config.welcome.avatarHeight || 150;
        const x = (config.welcome.avatarX / 100) * 800;
        const y = (config.welcome.avatarY / 100) * 400;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const avatarImg = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.drawImage(avatarImg, x - (avW / 2), y - (avH / 2), avW, avH);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });

        const welcomeMsg = (config.welcome.embedMessage || "مرحباً {member} في سيرفرنا!")
            .replace(/{member}/g, `<@${member.id}>`)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`✨ عضو جديد انضم إلينا!`)
            .setDescription(welcomeMsg)
            .setColor('#5865F2')
            .setImage('attachment://welcome-image.png')
            .setTimestamp()
            .setFooter({ text: `VORTEX System • العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });

        welcomeChannel.send({ embeds: [welcomeEmbed], files: [attachment] });

    } catch (err) {
        console.error("Welcome Error:", err);
    }
});

// --- [ Jail Logic ] ---
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.guild) return;

        // Ticket Buttons
        if (interaction.isButton() && (interaction.customId === 'open_ticket' || interaction.customId.startsWith('ticket_btn_'))) {
            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return interaction.reply({ content: "⚠️ لم يتم العثور على إعدادات التذاكر.", ephemeral: true });
            let ticketType = "تذكرة دعم";
            if (interaction.customId.startsWith('ticket_btn_')) {
                const btnIndex = parseInt(interaction.customId.replace('ticket_btn_', ''));
                if (tConfig.buttons?.[btnIndex]) ticketType = tConfig.buttons[btnIndex].label;
            }
            await openTicket(interaction, tConfig, ticketType);
            return;
        }

        // Ticket Control Select Menu
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_menu') {
            const selected = interaction.values[0];
            const ticket = await TicketData.findOne({ channelId: interaction.channel.id });
            if (!ticket) return interaction.reply({ content: "❌ لم يتم العثور على بيانات التكت.", ephemeral: true });

            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return;

            const isAdmin = interaction.member.roles.cache.has(tConfig.adminRole);
            const adminActions = ['claim_ticket', 'close_ticket', 'add_member', 'remove_member', 'summon_member'];
            if (!isAdmin && adminActions.includes(selected)) {
                return interaction.reply({ content: "❌ هذه القائمة للإدارة فقط!", ephemeral: true });
            }

            if (selected === 'claim_ticket') {
                if (ticket.claimedBy) return interaction.reply({ content: "⚠️ التكت مستلم بالفعل!", ephemeral: true });
                ticket.claimedBy = interaction.user.id;
                await ticket.save();
                return interaction.reply({ content: `📌 تم استلام التكت بواسطة ${interaction.user}` });
            }

            if (selected === 'close_ticket') {
                ticket.closedAt = new Date();
                ticket.closedBy = interaction.user.id;
                await ticket.save();
                await interaction.reply({ content: "🔒 سيتم حذف التكت خلال 5 ثوانٍ..." });
                setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
                return;
            }

            if (selected === 'add_member') {
                const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_menu').setPlaceholder('اختر الشخص').setMaxValues(1);
                return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
            }

            if (selected === 'remove_member') {
                const userSelect = new UserSelectMenuBuilder().setCustomId('remove_user_menu').setPlaceholder('اختر الشخص').setMaxValues(1);
                return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
            }

            if (selected === 'summon_member') {
                return interaction.channel.send(`🔔 <@${ticket.ownerId}> الأدمن ${interaction.user} يستدعيك!`);
            }
        }

        // User Select Menus (Add/Remove from Ticket)
        if (interaction.isUserSelectMenu()) {
            const targetId = interaction.values[0];
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!targetMember) return interaction.reply({ content: "❌ لم يتم العثور على العضو.", ephemeral: true });

            if (interaction.customId === 'add_user_menu') {
                await interaction.channel.permissionOverwrites.edit(targetMember, { ViewChannel: true, SendMessages: true });
                return interaction.update({ content: `✅ تم إضافة ${targetMember} للتكت.`, components: [] });
            }

            if (interaction.customId === 'remove_user_menu') {
                await interaction.channel.permissionOverwrites.edit(targetMember, { ViewChannel: false });
                return interaction.update({ content: `❌ تم إزالة ${targetMember} من التكت.`, components: [] });
            }
        }

        // Slash Commands
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'jail') {
                const modConfig = await ModConfig.findOne({ guildId: interaction.guild.id });
                const target = interaction.options.getMember('user');
                for (const [id, channel] of interaction.guild.channels.cache) {
                    if (channel.id === modConfig?.jail?.channelId) continue;
                    await channel.permissionOverwrites.edit(target.id, { ViewChannel: false }).catch(() => {});
                }
                await target.roles.set([modConfig.jail.roleId]).catch(() => {});
                interaction.reply(`✅ تم سجن <@${target.id}> وإخفاء كافة الرومات عنه.`);
            }
        }

    } catch (err) {
        console.error("❌ Interaction Error:", err);
        if (interaction.isRepliable && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "❌ حدث خطأ غير متوقع.", ephemeral: true }).catch(() => {});
        }
    }
});

// ==========================================
// 9️⃣ openTicket Helper
// ==========================================
async function openTicket(interaction, config, type) {
    try {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

        const updatedConfig = await TicketConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { $inc: { ticketCount: 1 } },
            { new: true }
        );
        const ticketNumber = updatedConfig?.ticketCount || 1;

        const channel = await interaction.guild.channels.create({
            name: `ticket-${ticketNumber}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...(config.adminRole ? [{ id: config.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle("🎫 تذكرتك الجديدة")
            .setDescription(`مرحباً ${interaction.user}\nتم فتح التكت بنجاح\n\n📌 النوع: **${type}**`)
            .setColor(config.color || "#5865F2")
            .setTimestamp();

        const controlRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_control_menu')
                .setPlaceholder('🎫 اختر إجراء التكت')
                .addOptions([
                    { label: 'استلام التكت', value: 'claim_ticket', emoji: '📌' },
                    { label: 'إغلاق التكت', value: 'close_ticket', emoji: '🔒' },
                    { label: 'إضافة عضو', value: 'add_member', emoji: '➕' },
                    { label: 'إزالة عضو', value: 'remove_member', emoji: '➖' },
                    { label: 'استدعاء صاحب التكت', value: 'summon_member', emoji: '🔔' }
                ])
        );

        await channel.send({
            content: `${interaction.user}${config.adminRole ? ` | <@&${config.adminRole}>` : ''}`,
            embeds: [embed],
            components: [controlRow]
        });

        await TicketData.create({
            guildId: interaction.guild.id,
            channelId: channel.id,
            ownerId: interaction.user.id,
            openedAt: new Date()
        });

        await interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح: ${channel}` });

    } catch (err) {
        console.error("❌ Error in openTicket:", err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply("❌ حدث خطأ تقني أثناء فتح التكت.").catch(() => {});
        }
    }
}

// --- [ Kick Monitoring ] ---
setInterval(async () => {
    const configs = await KickConfig.find();
    for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;
        for (const streamer of config.streamers) {
            try {
                const res = await axios.get(`https://kick.com/api/v1/channels/${streamer.kickUsername}`, {
                    headers: { 'Accept': 'application/json' }, timeout: 5000
                });
                const isLive = res.data?.livestream !== null && res.data?.livestream !== undefined;
                if (isLive && !streamer.isLive) {
                    const ch = guild.channels.cache.get(streamer.channelId);
                    if (ch) {
                        const embed = new EmbedBuilder()
                            .setTitle(`🔴 ${streamer.kickUsername} بدأ البث الآن!`)
                            .setURL(`https://kick.com/${streamer.kickUsername}`)
                            .setColor('#00E701').setTimestamp();
                        ch.send({ embeds: [embed] });
                    }
                    streamer.isLive = true;
                } else if (!isLive) { streamer.isLive = false; }
            } catch (e) {}
        }
        await config.save();
    }
}, 60000);

// ==========================================
// 🔟 Start Server
// ==========================================
process.on('unhandledRejection', err => console.error("❌ Unhandled Rejection:", err));
process.on('uncaughtException', err => console.error("❌ Uncaught Exception:", err));

mongoose.connect(process.env.MONGO_CONNECTION_STRING)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error("❌ DB Error:", err));

client.login(process.env.TOKEN);
app.listen(PORT, () => console.log(`🌐 VORTEX Dashboard Running on Port ${PORT}`));
