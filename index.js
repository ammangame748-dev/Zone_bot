// ==========================================
// VORTEX SYSTEM BOT - ULTIMATE COMPREHENSIVE VERSION
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
                --card-bg: rgba(0, 0, 0, 0.6);
            }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: 'Changa', sans-serif; background: var(--bg); background-attachment: fixed; color: white; display: flex; min-height: 100vh; direction: rtl; overflow-x: hidden; }

            .sidebar { width: 280px; background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); position: fixed; right: 0; height: 100vh; padding: 25px 15px; border-left: 1px solid rgba(255,255,255,0.1); z-index: 1000; display: flex; flex-direction: column; transition: 0.4s; }
            .sidebar.closed { transform: translateX(100%); }
            .toggle-btn { position: fixed; right: 290px; top: 20px; background: var(--p); color: white; border: none; width: 45px; height: 45px; border-radius: 12px; cursor: pointer; z-index: 1001; transition: 0.4s; display: flex; align-items: center; justify-content: center; font-size: 20px; }
            .sidebar.closed + .toggle-btn { right: 20px; }

            .nav { display: ${showNav}; flex-direction: column; gap: 8px; overflow-y: auto; }
            .nav a { display: flex; align-items: center; padding: 14px 18px; border-radius: 14px; color: #b9bbbe; text-decoration: none; transition: 0.3s; gap: 15px; font-size: 15px; }
            .nav a:hover, .nav a.active { background: rgba(88,101,242,0.2); color: white; box-shadow: inset 4px 0 0 var(--p); }
            .nav a i { width: 25px; text-align: center; }

            .main { margin-right: ${guild.id ? '280px' : '0'}; padding: 40px; width: 100%; transition: 0.4s; }
            .sidebar.closed ~ .main { margin-right: 0; }

            .card { background: var(--card-bg); backdrop-filter: blur(15px); padding: 30px; border-radius: 20px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.08); }
            .card h3 { color: var(--accent); margin: 0 0 25px; display: flex; align-items: center; gap: 12px; }

            input, select, textarea { width: 100%; padding: 12px 15px; border-radius: 12px; background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.15); font-family: 'Changa', sans-serif; outline: none; }
            input:focus, select:focus { border-color: var(--p); }

            .check-container { display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 10px 0; }
            .check-container input { display: none; }
            .checkmark { width: 24px; height: 24px; background: rgba(255,255,255,0.1); border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); }
            .check-container input:checked + .checkmark { background: #00b894; border-color: #00b894; }
            .check-container input:checked + .checkmark:after { content: '\\f00c'; font-family: 'Font Awesome 6 Free'; font-weight: 900; color: white; }

            .btn-save { background: linear-gradient(45deg, var(--p), #7b2ff7); color: white; border: none; padding: 15px; border-radius: 14px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 20px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

            .preview-container { position: relative; border-radius: 15px; overflow: hidden; background: #000; width: 100%; aspect-ratio: 2/1; margin: 20px 0; }
            #previewAvatar { position: absolute; border: 4px solid #fff; border-radius: 50%; background-size: cover; cursor: move; }
            .resizer { width: 14px; height: 14px; background: var(--accent); position: absolute; border-radius: 4px; }
            .resizer.br { right: -7px; bottom: -7px; cursor: nwse-resize; }

            .guild-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .guild-card { background: var(--card-bg); border-radius: 20px; padding: 25px; text-align: center; border: 1px solid rgba(255,255,255,0.1); width: 220px; }
            .guild-icon { width: 85px; height: 85px; border-radius: 50%; border: 3px solid var(--p); margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="sidebar" id="sidebar">
            <h2 style="text-align:center; color:var(--p);">VORTEX</h2>
            <div class="nav">
                <a class="${active == 'home' ? 'active' : ''}" href="/manage/${guild.id}/home"><i class="fas fa-chart-pie"></i> الإحصائيات</a>
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
        <div class="main"><h1>${guildName}</h1>${content}</div>
    </body>
    </html>`;
}

// ==========================================
// 6️⃣ Routes
// ==========================================

app.get('/login', (req, res) => res.send(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;700&display=swap" rel="stylesheet"></head><body style="background:#05051a; color:white; display:flex; justify-content:center; align-items:center; height:100vh;"><div style="text-align:center; padding:50px; border:1px solid #5865F2; border-radius:20px;"><h1>VORTEX</h1><a href="/auth/discord" style="background:#5865F2; color:white; padding:15px 30px; border-radius:10px; text-decoration:none; font-weight:bold;">دخول عبر Discord</a></div></body></html>`));
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));
app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const cards = adminGuilds.map(g => `<div class="guild-card"><img src="${g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" class="guild-icon"><h3>${g.name}</h3><a href="/manage/${g.id}/home" style="color:var(--p);">⚙️ الإعدادات</a></div>`).join('');
    res.send(ui({ id: null }, 'home', `<div class="guild-grid">${cards}</div>`));
});

// --- [ Stats ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const stats = await Stats.findOne({ guildId: g.id }) || { messages: { total: 0 } };
    res.send(ui(g, 'home', `<div class="card"><h3>إحصائيات</h3><div class="grid-2"><div style="text-align:center;"><h1>${stats.messages.total}</h1><p>رسالة</p></div><div style="text-align:center;"><h1>${g.memberCount}</h1><p>عضو</p></div></div></div>`));
});

// --- [ Security ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    const s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };
    res.send(ui(g, 'security', `<form method="POST" action="/save/${g.id}/security"><div class="card"><h3>الحماية</h3><label>منع الروابط:</label><select name="antiLinks"><option value="true" ${s.security.antiLinks?'selected':''}>مفعل</option><option value="false" ${!s.security.antiLinks?'selected':''}>معطل</option></select><label>الكلمات الممنوعة:</label><textarea name="badWords">${s.security.badWords||''}</textarea><label>الأيموجيات الممنوعة:</label><input name="badEmojis" value="${s.security.badEmojis||''}"><label>رتب الاستثناء:</label><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">${g.roles.cache.filter(r=>r.name!=='@everyone').map(r=>`<label class="check-container"><input type="checkbox" name="bypassRoles" value="${r.id}" ${s.security.bypassRoles?.includes(r.id)?'checked':''}> <span class="checkmark"></span> ${r.name}</label>`).join('')}</div><button class="btn-save">حفظ</button></div></form>`));
});
app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { "security.antiLinks": b.antiLinks==='true', "security.badWords": b.badWords, "security.badEmojis": b.badEmojis, "security.bypassRoles": Array.isArray(b.bypassRoles)?b.bypassRoles:[b.bypassRoles].filter(x=>x) } }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Welcome ] ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    const s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };
    res.send(ui(g, 'welcome', `<form method="POST" action="/save/${g.id}/welcome" enctype="multipart/form-data"><div class="card"><h3>الترحيب</h3><label>القناة:</label><select name="channel">${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.welcome.channel===c.id?'selected':''}># ${c.name}</option>`).join('')}</select><label>رسالة الترحيب:</label><textarea name="embedMessage">${s.welcome.embedMessage||''}</textarea><label>خلفية AI:</label><input id="aiPrompt" name="aiPrompt" value="${s.welcome.aiPrompt||''}"><button type="button" onclick="const p=document.getElementById('aiPrompt').value; document.getElementById('previewBg').src='https://image.pollinations.ai/prompt/'+encodeURIComponent(p)+'?width=800&height=400&nologo=true&seed='+Date.now(); document.getElementById('remoteBg').value=document.getElementById('previewBg').src;">توليد</button><input type="hidden" name="remoteBg" id="remoteBg"><div class="preview-container" id="co"><img src="${s.welcome.imagePath||''}" id="previewBg" style="width:100%; height:100%; object-fit:cover;"><div id="av" style="width:${s.welcome.avatarWidth||150}px; height:${s.welcome.avatarHeight||150}px; left:${s.welcome.avatarX||50}%; top:${s.welcome.avatarY||50}%; transform:translate(-50%,-50%); position:absolute; border:4px solid white; border-radius:50%;"></div></div><input type="hidden" name="avatarX" id="ax" value="${s.welcome.avatarX||50}"><input type="hidden" name="avatarY" id="ay" value="${s.welcome.avatarY||50}"><button class="btn-save">حفظ</button></div></form>`));
});
app.post('/save/:guildId/welcome', checkAuth, upload.single('welcomeImage'), async (req, res) => {
    const b = req.body;
    let data = { 'welcome.channel': b.channel, 'welcome.embedMessage': b.embedMessage, 'welcome.avatarX': b.avatarX, 'welcome.avatarY': b.avatarY, 'welcome.aiPrompt': b.aiPrompt };
    if (req.file) data['welcome.imagePath'] = req.file.path; else if (b.remoteBg) data['welcome.imagePath'] = b.remoteBg;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: data }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/welcome`);
});

// --- [ Levels ] ---
app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    const s = await GuildConfig.findOne({ guildId: g.id }) || { levels: {} };
    res.send(ui(g, 'levels', `<form method="POST" action="/save/${g.id}/levels"><div class="card"><h3>نظام الليفل</h3><label>تشغيل:</label><select name="enabled"><option value="true" ${s.levels.enabled?'selected':''}>مفعل</option><option value="false" ${!s.levels.enabled?'selected':''}>معطل</option></select><label>XP لكل رسالة:</label><input type="number" name="xp" value="${s.levels.xpPerMessage||10}"><button class="btn-save">حفظ</button></div></form>`));
});
app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: { "levels.enabled": b.enabled==='true', "levels.xpPerMessage": parseInt(b.xp) } }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Logs ] ---
app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    const s = await GuildConfig.findOne({ guildId: g.id }) || { logs: {} };
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    res.send(ui(g, 'logs', `<form method="POST" action="/save/${g.id}/logs"><div class="card"><h3>السجلات (Logs)</h3>${types.map(t=>`<div style="margin-bottom:15px;"><label>${t}:</label><select name="${t}_ch"><option value="">معطل</option>${g.channels.cache.filter(c=>c.type===0).map(c=>`<option value="${c.id}" ${s.logs?.[t]?.channel===c.id?'selected':''}># ${c.name}</option>`).join('')}</select></div>`).join('')}<button class="btn-save">حفظ</button></div></form>`));
});
app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
    const b = req.body;
    let logData = {};
    ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'].forEach(t => { logData[`logs.${t}`] = { enabled: !!b[`${t}_ch`], channel: b[`${t}_ch`] }; });
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: logData }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/logs`);
});

// --- [ Clans ] ---
app.get('/manage/:guildId/clans', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    const clans = await Clan.find({ guildId: g.id });
    res.send(ui(g, 'clans', `<div class="card"><h3>الكلانات</h3><a href="/manage/${g.id}/clans/add">إضافة كلان</a><br><br>${clans.map(c=>`<div><b>${c.clanName}</b> - <a href="/delete-clan/${g.id}/${c._id}">حذف</a></div>`).join('')}</div>`));
});
app.get('/manage/:guildId/clans/add', checkAuth, async (req, res) => { res.send(ui(client.guilds.cache.get(req.params.guildId), 'clans', `<form method="POST" action="/save/${req.params.guildId}/clans"><div class="card"><label>الاسم:</label><input name="clanName" required><label>القائد (ID):</label><input name="leaderId" required><button class="btn-save">حفظ</button></div></form>`)); });
app.post('/save/:guildId/clans', checkAuth, async (req, res) => { await Clan.create({ ...req.body, guildId: req.params.guildId, members: [], assistantIds: [] }); res.redirect(`/manage/${req.params.guildId}/clans`); });
app.get('/delete-clan/:guildId/:id', checkAuth, async (req, res) => { await Clan.findByIdAndDelete(req.params.id); res.redirect(`/manage/${req.params.guildId}/clans`); });

// ==========================================
// 7️⃣ Bot Logic
// ==========================================

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
        if (bad) { message.delete().catch(()=>{}); return; }
    }

    // Levels
    if (config.levels?.enabled) {
        let u = await UserLevel.findOne({ guildId: message.guild.id, userId: message.author.id });
        if (!u) u = new UserLevel({ guildId: message.guild.id, userId: message.author.id });
        u.xp += config.levels.xpPerMessage || 10;
        if (u.xp >= u.level * 100) { u.level++; message.channel.send(`مبروك <@${message.author.id}> وصلت ليفل ${u.level}!`); }
        await u.save();
    }

    // Clan Control
    if (message.content === 'تحكم') {
        const clan = await Clan.findOne({ guildId: message.guild.id, $or: [{ leaderId: message.author.id }, { assistantIds: message.author.id }] });
        if (clan) {
            const options = [{ label: 'إحصائيات', value: 'stats' }, { label: 'إضافة عضو', value: 'add_mem' }, { label: 'طرد عضو', value: 'kick_mem' }];
            if (message.author.id === clan.leaderId) options.push({ label: 'إضافة مساعد', value: 'add_assist' }, { label: 'طرد مساعد', value: 'kick_assist' });
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`clan_ctrl:${clan._id}`).addOptions(options));
            message.reply({ content: `لوحة تحكم كلان ${clan.clanName}`, components: [row] });
        }
    }
});

// Log Events
client.on('messageDelete', async (m) => {
    if (!m.guild) return;
    const c = await GuildConfig.findOne({ guildId: m.guild.id });
    const logCh = m.guild.channels.cache.get(c?.logs?.messages?.channel);
    if (logCh) logCh.send({ embeds: [new EmbedBuilder().setTitle('رسالة محذوفة').setDescription(`المؤلف: ${m.author}\nالمحتوى: ${m.content}`).setColor('Red')] });
});

// Interaction Handling
client.on('interactionCreate', async (i) => {
    if (i.isStringSelectMenu() && i.customId.startsWith('clan_ctrl:')) {
        const action = i.values[0];
        const clanId = i.customId.split(':')[1];
        const clan = await Clan.findById(clanId);
        if (action === 'stats') return i.reply({ content: `النقاط: ${clan.points}\nالأعضاء: ${clan.members.length}`, ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`clan_modal:${action}:${clanId}`).setTitle('إجراء الكلان').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tid').setLabel('ايدي العضو').setStyle(TextInputStyle.Short)));
        await i.showModal(modal);
    }
    if (i.isModalSubmit() && i.customId.startsWith('clan_modal:')) {
        const [_, action, cid] = i.customId.split(':');
        const tid = i.fields.getTextInputValue('tid');
        const clan = await Clan.findById(cid);
        if (action === 'add_mem') clan.members.push(tid);
        if (action === 'kick_mem') clan.members = clan.members.filter(id => id !== tid);
        if (action === 'add_assist') clan.assistantIds.push(tid);
        if (action === 'kick_assist') clan.assistantIds = clan.assistantIds.filter(id => id !== tid);
        await clan.save();
        i.reply(`تم الإجراء بنجاح.`);
    }
});

mongoose.connect(process.env.MONGO_CONNECTION_STRING).then(() => console.log('DB OK'));
client.login(process.env.TOKEN);
app.listen(PORT, () => console.log(`PORT ${PORT}`));
