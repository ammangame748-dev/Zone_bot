// ==========================================
// VORTEX SYSTEM BOT - FULL COMPREHENSIVE VERSION
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
        aiPrompt: { type: String, default: "Anime style landscape, forest, sun light, high quality" }
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
    clanIndex: Number,
    points: { type: Number, default: 0 },
    members: [String],
    assistantIds: [String],
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
        GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember, Partials.Reaction]
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
// 5️⃣ UI Engine - Ultimate Design
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
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --p: #5865F2; --s: #ff4757; --accent: #00d2ff;
                --bg: radial-gradient(circle at center, #1a1a2e 0%, #05051a 100%);
                --card-bg: rgba(0, 0, 0, 0.65);
            }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: 'Changa', sans-serif; background: var(--bg); background-attachment: fixed; color: white; display: flex; min-height: 100vh; direction: rtl; overflow-x: hidden; }

            /* SIDEBAR SLIDER */
            .sidebar { width: 280px; background: rgba(0,0,0,0.95); backdrop-filter: blur(25px); position: fixed; right: 0; height: 100vh; padding: 25px 15px; border-left: 1px solid rgba(255,255,255,0.1); z-index: 1000; display: flex; flex-direction: column; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
            .sidebar.closed { transform: translateX(100%); }
            .toggle-btn { position: fixed; right: 290px; top: 20px; background: var(--p); color: white; border: none; width: 45px; height: 45px; border-radius: 12px; cursor: pointer; z-index: 1001; transition: 0.4s; display: flex; align-items: center; justify-content: center; font-size: 20px; }
            .sidebar.closed + .toggle-btn { right: 20px; }

            .sidebar-logo { text-align: center; margin-bottom: 30px; }
            .sidebar-logo h2 { background: linear-gradient(to left, var(--p), var(--s)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; font-weight: 700; margin: 0; }

            .nav { display: ${showNav}; flex-direction: column; gap: 8px; overflow-y: auto; padding-bottom: 30px; }
            .nav a { display: flex; align-items: center; padding: 14px 18px; border-radius: 14px; color: #b9bbbe; text-decoration: none; transition: 0.3s; gap: 15px; font-size: 15px; font-weight: 500; }
            .nav a:hover, .nav a.active { background: rgba(88,101,242,0.2); color: white; box-shadow: inset 4px 0 0 var(--p); }
            .nav a i { width: 25px; text-align: center; font-size: 18px; }

            .main { margin-right: ${guild.id ? '280px' : '0'}; padding: 40px; width: 100%; transition: 0.4s; }
            .sidebar.closed ~ .main { margin-right: 0; }

            .card { background: var(--card-bg); backdrop-filter: blur(15px); padding: 30px; border-radius: 20px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; }
            .card h3 { color: var(--accent); margin: 0 0 25px; display: flex; align-items: center; gap: 12px; font-size: 20px; }

            label { display: block; color: #ccc; font-size: 14px; margin-bottom: 8px; margin-top: 15px; }
            input, select, textarea { width: 100%; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.15); font-family: 'Changa', sans-serif; outline: none; transition: 0.3s; }
            input:focus, select:focus, textarea:focus { border-color: var(--p); background: rgba(0,0,0,0.7); }

            /* CHECKBOX SIGN STYLE */
            .check-container { display: flex; align-items: center; gap: 12px; cursor: pointer; user-select: none; margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid transparent; transition: 0.3s; }
            .check-container:hover { background: rgba(255,255,255,0.06); }
            .check-container input { display: none; }
            .checkmark { width: 24px; height: 24px; background: rgba(255,255,255,0.1); border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); transition: 0.3s; }
            .check-container input:checked + .checkmark { background: #00b894; border-color: #00b894; }
            .checkmark:after { content: '\\f00c'; font-family: 'Font Awesome 6 Free'; font-weight: 900; color: white; font-size: 14px; display: none; }
            .check-container input:checked + .checkmark:after { display: block; }

            .btn-save { background: linear-gradient(45deg, var(--p), #7b2ff7); color: white; border: none; padding: 15px; border-radius: 14px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 20px; transition: 0.3s; font-family: 'Changa', sans-serif; font-size: 16px; }
            .btn-save:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(88,101,242,0.4); }

            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }

            .preview-container { position: relative; border-radius: 15px; overflow: hidden; background: #000; width: 100%; aspect-ratio: 2/1; margin: 20px 0; border: 2px solid var(--p); }
            #previewAvatar { position: absolute; border: 4px solid #fff; border-radius: 50%; background-size: cover; cursor: move; box-shadow: 0 0 25px rgba(0,0,0,0.7); z-index: 5; }
            .resizer { width: 14px; height: 14px; background: var(--accent); position: absolute; border: 2px solid #fff; border-radius: 4px; z-index: 10; }
            .resizer.br { right: -7px; bottom: -7px; cursor: nwse-resize; }
            .resizer.tr { right: -7px; top: -7px; cursor: nesw-resize; }
            .resizer.bl { left: -7px; bottom: -7px; cursor: nesw-resize; }

            .guild-grid { display: flex; flex-wrap: wrap; gap: 25px; justify-content: center; padding: 20px; }
            .guild-card { background: var(--card-bg); border-radius: 25px; padding: 30px; text-align: center; border: 1px solid rgba(255,255,255,0.1); width: 240px; transition: 0.3s; }
            .guild-card:hover { transform: translateY(-12px); border-color: var(--p); box-shadow: 0 15px 35px rgba(88,101,242,0.3); }
            .guild-icon { width: 90px; height: 90px; border-radius: 50%; border: 4px solid var(--p); margin-bottom: 20px; }

            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-thumb { background: var(--p); border-radius: 10px; }
            ::-webkit-scrollbar-track { background: transparent; }
        </style>
    </head>
    <body>
        <div class="sidebar" id="sidebar">
            <div class="sidebar-logo"><h2>VORTEX</h2></div>
            <div class="nav">
                <a class="${active == 'home' ? 'active' : ''}" href="/manage/${guild.id}/home"><i class="fas fa-chart-line"></i> الإحصائيات</a>
                <a class="${active == 'security' ? 'active' : ''}" href="/manage/${guild.id}/security"><i class="fas fa-shield-halved"></i> الحماية</a>
                <a class="${active == 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome"><i class="fas fa-door-open"></i> الترحيب</a>
                <a class="${active == 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets"><i class="fas fa-ticket"></i> التذاكر</a>
                <a class="${active == 'clans' ? 'active' : ''}" href="/manage/${guild.id}/clans"><i class="fas fa-flag"></i> الكلانات</a>
                <a class="${active == 'levels' ? 'active' : ''}" href="/manage/${guild.id}/levels"><i class="fas fa-trophy"></i> المستويات</a>
                <a class="${active == 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs"><i class="fas fa-list-ul"></i> السجلات</a>
                <a href="/dashboard"><i class="fas fa-house"></i> السيرفرات</a>
            </div>
        </div>
        <button class="toggle-btn" onclick="document.getElementById('sidebar').classList.toggle('closed')"><i class="fas fa-bars"></i></button>
        <div class="main">
            <h1 style="margin-bottom:35px; font-size:32px;">${guildName}</h1>
            ${content}
        </div>
    </body>
    </html>`;
}

// ==========================================
// 6️⃣ Routes & Full Logic
// ==========================================

app.get('/login', (req, res) => res.send(`
    <html dir="rtl">
    <head><link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { background: radial-gradient(circle at center, #1a1a2e 0%, #05051a 100%); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Changa', sans-serif; }
        .login-card { background: rgba(0,0,0,0.8); padding: 60px; border-radius: 30px; text-align: center; border: 1px solid #5865F2; backdrop-filter: blur(20px); }
        h1 { font-size: 48px; background: linear-gradient(45deg, #5865F2, #ff4757); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
        a { background: #5865F2; color: white; padding: 18px 45px; border-radius: 15px; text-decoration: none; font-weight: bold; font-size: 18px; display: inline-block; transition: 0.3s; }
        a:hover { transform: scale(1.05); box-shadow: 0 0 30px rgba(88,101,242,0.5); }
    </style></head>
    <body><div class="login-card"><h1>VORTEX</h1><p style="color:#888; margin-bottom:40px;">نظام الإدارة المتكامل</p><a href="/auth/discord">دخول عبر Discord</a></div></body></html>
`));

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));
app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const cards = adminGuilds.map(g => {
        const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `<div class="guild-card"><img src="${icon}" class="guild-icon"><h3>${g.name}</h3><a href="/manage/${g.id}/home" style="color:var(--p); font-weight:bold; text-decoration:none;">⚙️ الإعدادات</a></div>`;
    }).join('');
    res.send(ui({ id: null }, 'home', `<div class="guild-grid">${cards}</div>`));
});

// --- [ Stats Page ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const stats = await Stats.findOne({ guildId: g.id }) || { messages: { total: 0 } };
    const content = `
    <div class="card">
        <h3>📊 إحصائيات السيرفر</h3>
        <div class="grid-3">
            <div style="text-align:center; padding:20px; background:rgba(88,101,242,0.1); border-radius:15px;">
                <h1 style="color:var(--p); font-size:48px; margin:0;">${stats.messages.total}</h1>
                <p style="color:#888; margin:5px 0 0;">إجمالي الرسائل</p>
            </div>
            <div style="text-align:center; padding:20px; background:rgba(0,210,255,0.1); border-radius:15px;">
                <h1 style="color:var(--accent); font-size:48px; margin:0;">${g.memberCount}</h1>
                <p style="color:#888; margin:5px 0 0;">عدد الأعضاء</p>
            </div>
            <div style="text-align:center; padding:20px; background:rgba(255,71,87,0.1); border-radius:15px;">
                <h1 style="color:var(--s); font-size:48px; margin:0;">${g.channels.cache.size}</h1>
                <p style="color:#888; margin:5px 0 0;">عدد القنوات</p>
            </div>
        </div>
    </div>`;
    res.send(ui(g, 'home', content));
});

// --- [ Security Page ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };
    const content = `
    <form method="POST" action="/save/${g.id}/security">
        <div class="card">
            <h3><i class="fas fa-shield-halved"></i> إعدادات الحماية</h3>
            <div class="grid-2">
                <div>
                    <label>منع الروابط:</label>
                    <select name="antiLinks">
                        <option value="true" ${s.security.antiLinks?'selected':''}>🟢 مفعّل</option>
                        <option value="false" ${!s.security.antiLinks?'selected':''}>🔴 معطّل</option>
                    </select>
                </div>
                <div>
                    <label>نوع العقوبة:</label>
                    <select name="punishment">
                        <option value="none" ${s.security.punishment==='none'?'selected':''}>حذف فقط</option>
                        <option value="warn" ${s.security.punishment==='warn'?'selected':''}>تحذير</option>
                        <option value="timeout" ${s.security.punishment==='timeout'?'selected':''}>إسكات (Timeout)</option>
                    </select>
                </div>
            </div>
            <label>الكلمات الممنوعة (فاصلة بين كل كلمة):</label>
            <textarea name="badWords" rows="4">${s.security.badWords||''}</textarea>
            
            <label>الأيموجيات الممنوعة (حماية الريأكشن والرسائل):</label>
            <input name="badEmojis" value="${s.security.badEmojis||''}" placeholder="مثال: 🤡, 💩">
            
            <label>رتب الاستثناء (Bypass):</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; padding:15px; background:rgba(0,0,0,0.3); border-radius:15px;">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `
                    <label class="check-container">
                        <input type="checkbox" name="bypassRoles" value="${r.id}" ${s.security.bypassRoles?.includes(r.id)?'checked':''}>
                        <span class="checkmark"></span>
                        <span style="font-size:13px;">${r.name}</span>
                    </label>
                `).join('')}
            </div>
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
            "security.badEmojis": b.badEmojis,
            "security.bypassRoles": Array.isArray(b.bypassRoles) ? b.bypassRoles : [b.bypassRoles].filter(x => x)
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Welcome Page ] ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };
    let img = s.welcome.imagePath || 'https://placehold.co/800x400?text=VORTEX+WELCOME';
    const content = `
    <form method="POST" action="/save/${g.id}/welcome" enctype="multipart/form-data">
        <div class="card">
            <h3><i class="fas fa-door-open"></i> نظام الترحيب</h3>
            <div class="grid-2">
                <div>
                    <label>القناة:</label>
                    <select name="channel">
                        ${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.welcome.channel===c.id?'selected':''}># ${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>الحالة:</label>
                    <select name="enabled">
                        <option value="on" ${s.welcome.enabled?'selected':''}>🟢 مشغّل</option>
                        <option value="off" ${!s.welcome.enabled?'selected':''}>🔴 معطّل</option>
                    </select>
                </div>
            </div>
            <label>رسالة الترحيب:</label>
            <textarea name="embedMessage" rows="4">${s.welcome.embedMessage||''}</textarea>
            
            <label>خلفية AI (أدخل الوصف):</label>
            <div style="display:flex; gap:10px;">
                <input id="aiPrompt" name="aiPrompt" value="${s.welcome.aiPrompt||''}" style="flex:1;">
                <button type="button" onclick="genAI()" class="btn-save" style="margin:0; width:150px;">🚀 توليد</button>
            </div>
            <input type="hidden" name="remoteBg" id="remoteBg">
            <label>أو ارفع خلفية مخصصة:</label>
            <input type="file" name="welcomeImage" accept="image/*">

            <div class="preview-container" id="co">
                <img src="${img}" id="previewBg" style="width:100%; height:100%; object-fit:cover;">
                <div id="av" style="width:${s.welcome.avatarWidth||150}px; height:${s.welcome.avatarHeight||150}px; left:${s.welcome.avatarX||50}%; top:${s.welcome.avatarY||50}%; transform:translate(-50%,-50%); position:absolute; border:4px solid white; border-radius:50%; background-image:url('${client.user.displayAvatarURL()}'); background-size:cover; cursor:move;">
                    <div class="resizer br"></div><div class="resizer tr"></div><div class="resizer bl"></div>
                </div>
            </div>
            <input type="hidden" name="avatarX" id="ax" value="${s.welcome.avatarX||50}">
            <input type="hidden" name="avatarY" id="ay" value="${s.welcome.avatarY||50}">
            <input type="hidden" name="avatarWidth" id="aw" value="${s.welcome.avatarWidth||150}">
            <input type="hidden" name="avatarHeight" id="ah" value="${s.welcome.avatarHeight||150}">
            <button class="btn-save">💾 حفظ إعدادات الترحيب</button>
        </div>
    </form>
    <script>
        const av = document.getElementById('av'); const co = document.getElementById('co');
        let drag = false, res = false, cur = null;
        av.onmousedown = (e) => { if(e.target.classList.contains('resizer')) return; drag = true; };
        window.onmousemove = (e) => {
            const r = co.getBoundingClientRect();
            if(drag) {
                let x = ((e.clientX - r.left)/r.width)*100; let y = ((e.clientY - r.top)/r.height)*100;
                av.style.left = x+'%'; av.style.top = y+'%';
                document.getElementById('ax').value = Math.round(x); document.getElementById('ay').value = Math.round(y);
            }
            if(res) {
                const ar = av.getBoundingClientRect();
                if(cur.classList.contains('br')) { av.style.width = (e.clientX-ar.left)+'px'; av.style.height = (e.clientY-ar.top)+'px'; }
                document.getElementById('aw').value = av.offsetWidth; document.getElementById('ah').value = av.offsetHeight;
            }
        };
        window.onmouseup = () => { drag = res = false; };
        document.querySelectorAll('.resizer').forEach(r => r.onmousedown = (e) => { res = true; cur = e.target; e.stopPropagation(); });
        async function genAI() {
            const p = document.getElementById('aiPrompt').value;
            const url = 'https://image.pollinations.ai/prompt/'+encodeURIComponent(p)+'?width=800&height=400&nologo=true&seed='+Date.now();
            document.getElementById('previewBg').src = url; document.getElementById('remoteBg').value = url;
        }
    </script>`;
    res.send(ui(g, 'welcome', content));
});

app.post('/save/:guildId/welcome', checkAuth, upload.single('welcomeImage'), async (req, res) => {
    const b = req.body;
    let data = {
        'welcome.enabled': b.enabled === 'on',
        'welcome.channel': b.channel,
        'welcome.embedMessage': b.embedMessage,
        'welcome.avatarX': b.avatarX,
        'welcome.avatarY': b.avatarY,
        'welcome.avatarWidth': b.avatarWidth,
        'welcome.avatarHeight': b.avatarHeight,
        'welcome.aiPrompt': b.aiPrompt
    };
    if (req.file) data['welcome.imagePath'] = req.file.path;
    else if (b.remoteBg) data['welcome.imagePath'] = b.remoteBg;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: data }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/welcome`);
});

// --- [ Tickets Page ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [] };
    const content = `
    <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3><i class="fas fa-ticket"></i> نظام التذاكر</h3>
            <div class="grid-2">
                <div><label>عنوان التذكرة:</label><input name="title" value="${s.title||''}"></div>
                <div><label>اللون (Hex):</label><input name="color" value="${s.color||'#5865F2'}"></div>
            </div>
            <label>وصف التذكرة:</label><textarea name="description">${s.description||''}</textarea>
            <label>رتبة الإدارة:</label>
            <select name="adminRole">
                <option value="">-- اختر --</option>
                ${g.roles.cache.filter(r=>r.name!=='@everyone').map(r=>`<option value="${r.id}" ${s.adminRole===r.id?'selected':''}>${r.name}</option>`).join('')}
            </select>
            <label>قناة الإرسال:</label>
            <select name="targetChannel">
                <option value="">-- لا ترسل --</option>
                ${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>
            <h4 style="margin-top:20px; color:var(--accent);">الأزرار (حتى 4):</h4>
            ${[0,1,2,3].map(i => `<div class="grid-2" style="margin-bottom:10px;"><input name="btn_label_${i}" value="${s.buttons?.[i]?.label||''}" placeholder="نص الزر ${i+1}"><input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji||''}" placeholder="إيموجي"></div>`).join('')}
            <button class="btn-save">💾 حفظ ونشر التذاكر</button>
        </div>
    </form>`;
    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{name:'top'},{name:'bottom'}]), async (req, res) => {
    const b = req.body;
    let buttons = [];
    for(let i=0; i<4; i++) { if(b[`btn_label_${i}`]) buttons.push({ label: b[`btn_label_${i}`], emoji: b[`btn_emoji_${i}`] }); }
    const config = await TicketConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { title: b.title, description: b.description, color: b.color, adminRole: b.adminRole, buttons } }, { upsert: true, new: true });
    if(b.targetChannel) {
        const ch = client.guilds.cache.get(req.params.guildId).channels.cache.get(b.targetChannel);
        if(ch) {
            const embed = new EmbedBuilder().setTitle(config.title||"Tickets").setDescription(config.description||"اضغط لفتح تذكرة").setColor(config.color||"#5865F2");
            const row = new ActionRowBuilder();
            if(buttons.length > 0) { buttons.forEach((btn, i) => row.addComponents(new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary).setEmoji(btn.emoji||'🎫'))); }
            else { row.addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Primary)); }
            ch.send({ embeds: [embed], components: [row] });
        }
    }
    res.redirect(`/manage/${req.params.guildId}/tickets`);
});

// --- [ Clans Page ] ---
app.get('/manage/:guildId/clans', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const clans = await Clan.find({ guildId: g.id });
    const content = `
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
            <h3><i class="fas fa-flag"></i> الكلانات</h3>
            <a href="/manage/${g.id}/clans/add" class="btn-save" style="margin:0; width:auto; padding:10px 20px;">➕ إضافة كلان</a>
        </div>
        ${clans.map(c => `<div style="padding:20px; background:rgba(255,255,255,0.05); border-radius:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <div><b>${c.clanName}</b><br><small>القائد: <@${c.leaderId}> | الأعضاء: ${c.members.length}</small></div>
            <a href="/delete-clan/${g.id}/${c._id}" style="color:var(--s);"><i class="fas fa-trash"></i></a>
        </div>`).join('')}
    </div>`;
    res.send(ui(g, 'clans', content));
});

app.get('/manage/:guildId/clans/add', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    res.send(ui(g, 'clans', `<form method="POST" action="/save/${g.id}/clans"><div class="card"><h3>إضافة كلان جديد</h3><label>اسم الكلان:</label><input name="clanName" required><label>ID القائد:</label><input name="leaderId" required><label>رتبة الكلان:</label><select name="roleId">${g.roles.cache.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select><button class="btn-save">💾 حفظ</button></div></form>`));
});

app.post('/save/:guildId/clans', checkAuth, async (req, res) => {
    const b = req.body;
    const count = await Clan.countDocuments({ guildId: req.params.guildId });
    await Clan.create({ ...b, guildId: req.params.guildId, clanIndex: count + 1, members: [], assistantIds: [] });
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

app.get('/delete-clan/:guildId/:id', checkAuth, async (req, res) => {
    await Clan.findByIdAndDelete(req.params.id);
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

// --- [ Levels Page ] ---
app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { levels: {} };
    const content = `
    <form method="POST" action="/save/${g.id}/levels">
        <div class="card">
            <h3><i class="fas fa-trophy"></i> نظام المستويات</h3>
            <div class="grid-2">
                <div><label>الحالة:</label><select name="enabled"><option value="true" ${s.levels.enabled?'selected':''}>🟢 مفعّل</option><option value="false" ${!s.levels.enabled?'selected':''}>🔴 معطّل</option></select></div>
                <div><label>XP لكل رسالة:</label><input type="number" name="xp" value="${s.levels.xpPerMessage||10}"></div>
            </div>
            <label>قناة إعلانات الترقي:</label>
            <select name="channel">
                <option value="">-- نفس قناة الرسالة --</option>
                ${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.levels.levelUpChannel===c.id?'selected':''}># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save">💾 حفظ إعدادات الليفل</button>
        </div>
    </form>`;
    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { "levels.enabled": b.enabled==='true', "levels.xpPerMessage": parseInt(b.xp), "levels.levelUpChannel": b.channel } }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Logs Page ] ---
app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { logs: {} };
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    const content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3><i class="fas fa-list-ul"></i> نظام السجلات</h3>
            ${types.map(t => `
            <div style="margin-bottom:15px; padding:15px; background:rgba(255,255,255,0.03); border-radius:12px;">
                <label>${t.toUpperCase()}:</label>
                <select name="${t}_ch">
                    <option value="">🔴 معطّل</option>
                    ${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.logs?.[t]?.channel===c.id?'selected':''}># ${c.name}</option>`).join('')}
                </select>
            </div>`).join('')}
            <button class="btn-save">💾 حفظ إعدادات السجلات</button>
        </div>
    </form>`;
    res.send(ui(g, 'logs', content));
});

app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
    const b = req.body;
    let logData = {};
    ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'].forEach(t => { logData[`logs.${t}`] = { enabled: !!b[`${t}_ch`], channel: b[`${t}_ch`] }; });
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: logData }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/logs`);
});

// ==========================================
// 7️⃣ Discord Bot Events & Logic
// ==========================================

client.on('ready', () => console.log(`🚀 VORTEX ONLINE: ${client.user.tag}`));

// --- [ Message Events: Security & Levels ] ---
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    const config = await GuildConfig.findOne({ guildId: message.guild.id });
    if (!config) return;

    // Security
    const isBypass = message.member.roles.cache.some(r => config.security?.bypassRoles?.includes(r.id));
    if (!isBypass && config.security) {
        let bad = false;
        if (config.security.antiLinks && /https?:\/\//.test(message.content)) bad = true;
        if (config.security.badWords?.split(',').some(w => message.content.includes(w.trim()))) bad = true;
        if (config.security.badEmojis?.split('').some(e => message.content.includes(e))) bad = true;
        if (bad) { 
            await message.delete().catch(()=>{}); 
            if(config.security.punishment === 'timeout') await message.member.timeout(ms('10m'), 'VORTEX Security Violation').catch(()=>{});
            return; 
        }
    }

    // Levels
    if (config.levels?.enabled) {
        let u = await UserLevel.findOne({ guildId: message.guild.id, userId: message.author.id });
        if (!u) u = new UserLevel({ guildId: message.guild.id, userId: message.author.id });
        u.xp += config.levels.xpPerMessage || 10;
        if (u.xp >= u.level * 100) { 
            u.level++; 
            const ch = message.guild.channels.cache.get(config.levels.levelUpChannel) || message.channel;
            ch.send(`✨ مبروك <@${message.author.id}> وصلت ليفل **${u.level}**!`); 
        }
        await u.save();
    }

    // Clan Control (تحكم)
    if (message.content === 'تحكم') {
        const clan = await Clan.findOne({ guildId: message.guild.id, $or: [{ leaderId: message.author.id }, { assistantIds: message.author.id }] });
        if (clan) {
            const isLeader = message.author.id === clan.leaderId;
            const options = [
                { label: 'إحصائيات الكلان', value: 'stats', emoji: '📊' },
                { label: 'إضافة عضو للكلان', value: 'add_mem', emoji: '➕' },
                { label: 'طرد عضو من الكلان', value: 'kick_mem', emoji: '❌' }
            ];
            if (isLeader) {
                options.push({ label: 'إضافة مساعد للكلان', value: 'add_assist', emoji: '🛡️' });
                options.push({ label: 'سحب رتبة مساعد', value: 'kick_assist', emoji: '🚫' });
            }
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`clan_ctrl:${clan._id}`).setPlaceholder('اختر إجراء...').addOptions(options));
            message.reply({ content: `🛠️ **لوحة تحكم كلان: ${clan.clanName}**`, components: [row] });
        }
    }
});

// --- [ Emoji Reaction Guard ] ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guild) return;
    const config = await GuildConfig.findOne({ guildId: reaction.message.guild.id });
    if (!config?.security?.badEmojis) return;
    const member = await reaction.message.guild.members.fetch(user.id);
    if (member.roles.cache.some(r => config.security.bypassRoles?.includes(r.id))) return;
    if (config.security.badEmojis.includes(reaction.emoji.name)) {
        await reaction.users.remove(user.id).catch(() => {});
        if (config.security.punishment === 'timeout') await member.timeout(ms('5m'), 'VORTEX Bad Emoji Reaction').catch(() => {});
    }
});

// --- [ Interaction Handling ] ---
client.on('interactionCreate', async (i) => {
    // Clan Control Menu
    if (i.isStringSelectMenu() && i.customId.startsWith('clan_ctrl:')) {
        const action = i.values[0];
        const clanId = i.customId.split(':')[1];
        const clan = await Clan.findById(clanId);
        if (action === 'stats') {
            const embed = new EmbedBuilder().setTitle(`📊 إحصائيات كلان: ${clan.clanName}`).setColor('#00d2ff').addFields({ name: '👥 الأعضاء', value: clan.members.map(id => `<@${id}>`).join(', ') || 'لا يوجد' }, { name: '🛡️ المساعدين', value: clan.assistantIds.map(id => `<@${id}>`).join(', ') || 'لا يوجد' }, { name: '🚩 النقاط', value: `${clan.points}`, inline: true });
            return i.reply({ embeds: [embed], ephemeral: true });
        }
        const modal = new ModalBuilder().setCustomId(`clan_modal:${action}:${clanId}`).setTitle('إجراء الكلان').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tid').setLabel('ايدي العضو المستهدف').setStyle(TextInputStyle.Short).setRequired(true)));
        await i.showModal(modal);
    }

    // Clan Modal Submit
    if (i.isModalSubmit() && i.customId.startsWith('clan_modal:')) {
        const [_, action, cid] = i.customId.split(':');
        const tid = i.fields.getTextInputValue('tid');
        const clan = await Clan.findById(cid);
        if (action === 'add_mem') clan.members.push(tid);
        if (action === 'kick_mem') clan.members = clan.members.filter(id => id !== tid);
        if (action === 'add_assist') clan.assistantIds.push(tid);
        if (action === 'kick_assist') clan.assistantIds = clan.assistantIds.filter(id => id !== tid);
        await clan.save();
        i.reply({ content: `✅ تم تنفيذ الإجراء بنجاح.`, ephemeral: true });
    }

    // Ticket Buttons
    if (i.isButton() && (i.customId === 'open_ticket' || i.customId.startsWith('ticket_btn_'))) {
        const tConfig = await TicketConfig.findOne({ guildId: i.guild.id });
        if (!tConfig) return i.reply({ content: "⚠️ إعدادات التذاكر غير متوفرة.", ephemeral: true });
        const updated = await TicketConfig.findOneAndUpdate({ guildId: i.guild.id }, { $inc: { ticketCount: 1 } }, { new: true });
        const channel = await i.guild.channels.create({
            name: `ticket-${updated.ticketCount}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...(tConfig.adminRole ? [{ id: tConfig.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
            ],
        });
        const embed = new EmbedBuilder().setTitle("🎫 تذكرة جديدة").setDescription(`مرحباً ${i.user}\nتم فتح تذكرتك بنجاح.`).setColor(tConfig.color||"#5865F2");
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة 🔒').setStyle(ButtonStyle.Danger));
        await channel.send({ content: `${i.user} | <@&${tConfig.adminRole}>`, embeds: [embed], components: [row] });
        i.reply({ content: `✅ تم فتح تذكرتك: ${channel}`, ephemeral: true });
    }

    // Close Ticket
    if (i.isButton() && i.customId === 'close_ticket') {
        await i.reply("🔒 سيتم إغلاق التذكرة وحذف القناة خلال 5 ثوانٍ...");
        setTimeout(() => i.channel.delete().catch(()=>{}), 5000);
    }
});

// --- [ Welcome Event Execution ] ---
client.on('guildMemberAdd', async (member) => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config?.welcome?.enabled || !config.welcome.channel) return;
    const ch = member.guild.channels.cache.get(config.welcome.channel);
    if (!ch) return;
    try {
        const canvas = createCanvas(800, 400); const ctx = canvas.getContext('2d');
        const bg = await loadImage(config.welcome.imagePath || 'https://placehold.co/800x400?text=Welcome');
        ctx.drawImage(bg, 0, 0, 800, 400);
        const avW = config.welcome.avatarWidth || 150, avH = config.welcome.avatarHeight || 150;
        const x = (config.welcome.avatarX / 100) * 800, y = (config.welcome.avatarY / 100) * 400;
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, avW / 2, 0, Math.PI * 2); ctx.clip();
        const avImg = await loadImage(member.user.displayAvatarURL({ extension: 'png' }));
        ctx.drawImage(avImg, x - avW / 2, y - avH / 2, avW, avH); ctx.restore();
        const att = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome.png' });
        const msg = config.welcome.embedMessage.replace(/{member}/g, `<@${member.id}>`).replace(/{guild}/g, member.guild.name).replace(/{count}/g, member.guild.memberCount);
        ch.send({ content: msg, files: [att] });
    } catch (e) { console.error(e); }
});

// --- [ Log Events Implementation ] ---
client.on('messageDelete', async (m) => {
    if (!m.guild || m.author?.bot) return;
    const c = await GuildConfig.findOne({ guildId: m.guild.id });
    const logCh = m.guild.channels.cache.get(c?.logs?.messages?.channel);
    if (logCh) {
        const embed = new EmbedBuilder().setTitle('🗑️ رسالة محذوفة').addFields({ name: 'المؤلف', value: `${m.author}`, inline: true }, { name: 'القناة', value: `${m.channel}`, inline: true }, { name: 'المحتوى', value: m.content || 'لا يوجد نص' }).setColor('Red').setTimestamp();
        logCh.send({ embeds: [embed] });
    }
});

client.on('messageUpdate', async (oldM, newM) => {
    if (!oldM.guild || oldM.author?.bot || oldM.content === newM.content) return;
    const c = await GuildConfig.findOne({ guildId: oldM.guild.id });
    const logCh = oldM.guild.channels.cache.get(c?.logs?.messages?.channel);
    if (logCh) {
        const embed = new EmbedBuilder().setTitle('📝 رسالة معدلة').addFields({ name: 'المؤلف', value: `${oldM.author}`, inline: true }, { name: 'قبل', value: oldM.content || 'لا يوجد' }, { name: 'بعد', value: newM.content || 'لا يوجد' }).setColor('Yellow').setTimestamp();
        logCh.send({ embeds: [embed] });
    }
});

client.on('guildMemberAdd', async (m) => {
    const c = await GuildConfig.findOne({ guildId: m.guild.id });
    const logCh = m.guild.channels.cache.get(c?.logs?.members?.channel);
    if (logCh) {
        const embed = new EmbedBuilder().setTitle('📥 عضو جديد').setDescription(`انضم ${m} للسيرفر`).setColor('Green').setTimestamp();
        logCh.send({ embeds: [embed] });
    }
});

client.on('guildMemberRemove', async (m) => {
    const c = await GuildConfig.findOne({ guildId: m.guild.id });
    const logCh = m.guild.channels.cache.get(c?.logs?.members?.channel);
    if (logCh) {
        const embed = new EmbedBuilder().setTitle('📤 غادر عضو').setDescription(`غادر ${m} السيرفر`).setColor('Orange').setTimestamp();
        logCh.send({ embeds: [embed] });
    }
});

// ==========================================
// 8️⃣ Startup
// ==========================================
mongoose.connect(process.env.MONGO_CONNECTION_STRING).then(() => console.log('✅ DATABASE CONNECTED'));
client.login(process.env.TOKEN);
app.listen(PORT, () => console.log(`🌐 DASHBOARD ON PORT ${PORT}`));
