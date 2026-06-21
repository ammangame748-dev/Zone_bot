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
const upload = multer({ dest: './uploads/' });
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

app.use(session({ secret: 'vortex-mega-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const checkAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/login');

// ==========================================
// 5️⃣ UI Engine (Redesigned & Fixed)
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
                --bg: #020202;
                --sidebar: #080808;
                --card: #0c0c0c;
                --p: #007bff;
                --s: #ff4d4d;
                --accent: #00d2ff;
                --text: #ffffff;
                --text-dim: #999;
                --border: rgba(255,255,255,0.06);
            }
            * { box-sizing: border-box; transition: all 0.2s ease-in-out; }
            body { background: var(--bg); color: var(--text); margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; min-height: 100vh; overflow-x: hidden; }
            
            .sidebar { width: 280px; background: var(--sidebar); border-left: 1px solid var(--border); display: ${showNav}; flex-direction: column; position: fixed; height: 100vh; right: 0; z-index: 1000; box-shadow: -10px 0 30px rgba(0,0,0,0.5); }
            .sidebar-header { padding: 40px 20px; text-align: center; border-bottom: 1px solid var(--border); }
            .sidebar-header img { width: 80px; height: 80px; border-radius: 25px; border: 2px solid var(--p); margin-bottom: 15px; box-shadow: 0 0 20px rgba(0,123,255,0.3); }
            .sidebar-header h2 { font-size: 18px; margin: 0; color: var(--p); letter-spacing: 1px; }
            
            .nav-links { flex: 1; padding: 25px 15px; overflow-y: auto; }
            .nav-links a { display: flex; align-items: center; padding: 14px 18px; color: var(--text-dim); text-decoration: none; border-radius: 12px; margin-bottom: 8px; font-weight: 500; }
            .nav-links a i { margin-left: 15px; width: 20px; text-align: center; font-size: 18px; }
            .nav-links a:hover { background: rgba(255,255,255,0.03); color: white; }
            .nav-links a.active { background: var(--p); color: white; box-shadow: 0 10px 20px rgba(0,123,255,0.2); }
            
            .main { flex: 1; margin-right: ${guild.id ? '280px' : '0'}; padding: 50px; width: calc(100% - ${guild.id ? '280px' : '0px'}); animation: fadeIn 0.5s ease; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

            .card { background: var(--card); border-radius: 25px; padding: 35px; border: 1px solid var(--border); margin-bottom: 35px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); position: relative; overflow: hidden; }
            .card:hover { border-color: rgba(0,123,255,0.3); transform: translateY(-5px); }
            
            h2 { font-size: 26px; margin-bottom: 30px; display: flex; align-items: center; gap: 15px; color: white; }
            label { display: block; margin-bottom: 12px; font-weight: 600; color: #ccc; font-size: 14px; margin-top: 20px; }
            
            input, select, textarea { width: 100%; background: #050505; border: 1px solid var(--border); padding: 16px; border-radius: 12px; color: white; margin-bottom: 12px; font-size: 14px; outline: none; }
            input:focus, select:focus, textarea:focus { border-color: var(--p); box-shadow: 0 0 10px rgba(0,123,255,0.1); }
            
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
            
            .btn-save { background: linear-gradient(45deg, var(--p), #0056b3); color: white; border: none; padding: 18px; border-radius: 15px; font-weight: bold; cursor: pointer; width: 100%; font-size: 16px; box-shadow: 0 10px 20px rgba(0,123,255,0.2); margin-top: 25px; }
            .btn-save:hover { transform: scale(1.02); box-shadow: 0 15px 30px rgba(0,123,255,0.4); }

            .guild-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 25px; }
            .guild-card { background: var(--card); border-radius: 25px; padding: 30px; text-align: center; border: 1px solid var(--border); cursor: pointer; position: relative; }
            .guild-card:hover { border-color: var(--p); transform: translateY(-10px); }
            .guild-icon { width: 90px; height: 90px; border-radius: 25px; margin-bottom: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.4); }
            
            .badge { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge-p { background: rgba(0,123,255,0.1); color: var(--p); border: 1px solid var(--p); }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <div class="sidebar-header">
                <img src="${guildIcon}">
                <h2>VORTEX</h2>
                <div style="font-size: 11px; color: var(--text-dim); margin-top: 5px;">نظام إدارة السيرفرات المتطور</div>
            </div>
            <div class="nav-links">
                <a class="${active == 'home' ? 'active' : ''}" href="/manage/${guild.id}/home"><i class="fas fa-chart-line"></i> الإحصائيات</a>
                <a class="${active == 'kick' ? 'active' : ''}" href="/manage/${guild.id}/kick"><i class="fas fa-video"></i> تنبيهات Kick</a>
                <a class="${active == 'security' ? 'active' : ''}" href="/manage/${guild.id}/security"><i class="fas fa-shield-alt"></i> الحماية</a>
                <a class="${active == 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets"><i class="fas fa-ticket-alt"></i> التذاكر</a>
                <a class="${active == 'mod' ? 'active' : ''}" href="/manage/${guild.id}/mod"><i class="fas fa-gavel"></i> الإشراف</a>
                <a class="${active == 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs"><i class="fas fa-list-ul"></i> سجلات اللوق</a>
                <a class="${active == 'levels' ? 'active' : ''}" href="/manage/${guild.id}/levels"><i class="fas fa-medal"></i> نظام الليفل</a>
                <a class="${active == 'clans' ? 'active' : ''}" href="/manage/${guild.id}/clans"><i class="fas fa-users"></i> الكلانات</a>
                <a class="${active == 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome"><i class="fas fa-door-open"></i> الترحيب</a>
                <a href="/dashboard" style="color: var(--s); margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px;"><i class="fas fa-arrow-right"></i> قائمة السيرفرات</a>
            </div>
        </div>
        <div class="main">${content}</div>
    </body>
    </html>`;
}

// ==========================================
// 6️⃣ Routes & Logic
// ==========================================

app.get('/login', (req, res) => res.send(`
    <html dir="rtl"><body style="background:#020202; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; margin:0;">
    <div style="text-align:center; background:#0c0c0c; padding:60px; border-radius:40px; border:1px solid #1a1a1a; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
        <h1 style="color:#007bff; font-size:50px; margin-bottom:10px; letter-spacing:5px;">VORTEX</h1>
        <p style="color:#666; font-size:18px; margin-bottom:40px;">أقوى نظام لإدارة وحماية سيرفرات الديسكورد</p>
        <a href="/auth/discord" style="background:linear-gradient(45deg, #007bff, #00d2ff); color:white; padding:18px 45px; border-radius:15px; text-decoration:none; font-weight:bold; font-size:20px; box-shadow: 0 10px 20px rgba(0,123,255,0.3);">🔑 تسجيل الدخول</a>
    </div></body></html>`));

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const cards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `<div class="guild-card" onclick="location.href='${hasBot ? `/manage/${g.id}/home` : '#'}'">
            <img src="${icon}" class="guild-icon">
            <h3 style="margin:0; font-size:17px; color:white;">${g.name}</h3>
            <div style="margin-top:15px;"><span class="badge ${hasBot ? 'badge-p' : ''}">${hasBot ? '⚙️ إعدادات' : '➕ إضافة'}</span></div>
        </div>`;
    }).join('');
    res.send(ui({ id: null }, 'home', `<div style="text-align:center; margin-bottom:50px;"><h1>مرحباً بك في VORTEX</h1><p style="color:#666;">اختر السيرفر الذي تود إدارته</p></div><div class="guild-grid">${cards}</div>`));
});

// --- [ Home Stats ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const stats = await Stats.findOne({ guildId: g.id }) || { messages: { total: 0 } };
    const content = `
    <div class="card">
        <h2>📊 إحصائيات السيرفر العامة</h2>
        <div class="grid-2">
            <div style="background:#050505; padding:30px; border-radius:20px; text-align:center; border:1px solid #111;">
                <div style="font-size:40px; font-weight:bold; color:var(--p);">${stats.messages.total}</div>
                <div style="color:#666; margin-top:10px;">إجمالي الرسائل</div>
            </div>
            <div style="background:#050505; padding:30px; border-radius:20px; text-align:center; border:1px solid #111;">
                <div style="font-size:40px; font-weight:bold; color:var(--accent);">${g.memberCount}</div>
                <div style="color:#666; margin-top:10px;">عدد الأعضاء</div>
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
        <h2>🟢 تنبيهات Kick المباشرة</h2>
        <form method="POST" action="/save/${g.id}/kick">
            <label>اسم المستخدم في Kick:</label>
            <input name="kickUser" placeholder="مثلاً: hook" required>
            <label>قناة التنبيه:</label>
            <select name="channelId">
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save">➕ إضافة ستريمر جديد</button>
        </form>
        <div style="margin-top:30px;">
            <h3>الستريمرز المضافين:</h3>
            ${s.streamers.map((st, i) => `<div style="display:flex; justify-content:space-between; padding:15px; background:#050505; border-radius:10px; margin-bottom:10px;">
                <span>${st.kickUsername}</span>
                <a href="/delete-kick/${g.id}/${i}" style="color:var(--s); text-decoration:none;">🗑️ حذف</a>
            </div>`).join('')}
        </div>
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
    <div class="card">
        <h2>🛡️ إعدادات الحماية والرقابة</h2>
        <form method="POST" action="/save/${g.id}/security">
            <div class="grid-2">
                <div>
                    <label>منع الروابط:</label>
                    <select name="antiLinks">
                        <option value="true" ${s.security?.antiLinks ? 'selected' : ''}>تشغيل</option>
                        <option value="false" ${!s.security?.antiLinks ? 'selected' : ''}>إيقاف</option>
                    </select>
                </div>
                <div>
                    <label>نوع العقوبة:</label>
                    <select name="punishment">
                        <option value="none" ${s.security?.punishment == 'none' ? 'selected' : ''}>حذف الرسالة فقط</option>
                        <option value="warn" ${s.security?.punishment == 'warn' ? 'selected' : ''}>تحذير</option>
                        <option value="mute" ${s.security?.punishment == 'mute' ? 'selected' : ''}>إسكات (Timeout)</option>
                    </select>
                </div>
            </div>
            <label>الكلمات الممنوعة (افصل بفاصلة):</label>
            <textarea name="badWords" rows="4">${s.security?.badWords || ''}</textarea>
            <label>رتب الاستثناء (Bypass):</label>
            <select name="bypassRoles" multiple style="height:150px;">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            <button class="btn-save">💾 حفظ إعدادات الحماية</button>
        </form>
    </div>`;
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

// --- [ Ticket Settings - FULL ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await TicketConfig.findOne({ guildId: g.id }) || {};
    const content = `
    <div class="card">
        <h2>🎫 نظام التذاكر المتكامل</h2>
        <form method="POST" action="/save/${g.id}/tickets" enctype="multipart/form-data">
            <div class="grid-2">
                <div><label>عنوان التذكرة:</label><input name="title" value="${s.title || 'الدعم الفني'}"></div>
                <div><label>لون الإيمباد:</label><input type="color" name="color" value="${s.color || '#007bff'}"></div>
            </div>
            <label>وصف التذكرة:</label>
            <textarea name="description" rows="3">${s.description || 'اضغط لفتح تذكرة'}</textarea>
            <div class="grid-2">
                <div><label>رتبة الإدارة:</label><select name="adminRole">${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select></div>
                <div><label>قناة الإرسال:</label><select name="targetChannel"><option value="">-- اختر قناة --</option>${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}</select></div>
            </div>
            <h3 style="margin-top:30px;">🖼️ صور التذكرة</h3>
            <div class="grid-2">
                <div><label>الصورة العلوية:</label><input type="file" name="topImage"></div>
                <div><label>الصورة السفلية:</label><input type="file" name="bottomImage"></div>
            </div>
            <h3 style="margin-top:30px;">🔘 الأزرار (حتى 4)</h3>
            <div class="grid-2">
                ${[0,1,2,3].map(i => `<div><label>زر ${i+1}:</label><div style="display:flex; gap:5px;"><input name="btn_label_${i}" value="${s.buttons?.[i]?.label || ''}" placeholder="نص"><input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji || ''}" placeholder="إيموجي"></div></div>`).join('')}
            </div>
            <button class="btn-save">💾 حفظ ونشر اللوحة</button>
        </form>
    </div>`;
    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), async (req, res) => {
    const b = req.body;
    let buttons = [];
    for (let i = 0; i < 4; i++) { if (b[`btn_label_${i}`]) buttons.push({ label: b[`btn_label_${i}`], emoji: b[`btn_emoji_${i}`] }); }
    let data = { title: b.title, description: b.description, color: b.color, adminRole: b.adminRole, buttons };
    if (req.files?.topImage) data.topImagePath = req.files.topImage[0].path;
    if (req.files?.bottomImage) data.bottomImagePath = req.files.bottomImage[0].path;
    const config = await TicketConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: data }, { upsert: true, new: true });
    if (b.targetChannel) {
        const ch = client.guilds.cache.get(req.params.guildId).channels.cache.get(b.targetChannel);
        if (ch) {
            const embed = new EmbedBuilder().setTitle(data.title).setDescription(data.description).setColor(data.color);
            const row = new ActionRowBuilder();
            if (buttons.length > 0) { buttons.forEach((btn, i) => row.addComponents(new ButtonBuilder().setCustomId(`tkt_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary))); }
            else { row.addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary)); }
            ch.send({ embeds: [embed], components: [row] });
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
    <div class="card">
        <h2>⚖️ أوامر الإشراف والسجن</h2>
        <form method="POST" action="/save/${g.id}/mod">
            <label>رتبة السجن (Jail Role):</label>
            <select name="jailRole">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.jail?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            <label>قناة السجن:</label>
            <select name="jailChannel">
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.jail?.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>
            <label>رتب الإدارة المسموح لها بالسجن:</label>
            <select name="adminRoles" multiple style="height:120px;">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.jail?.adminRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            <button class="btn-save">💾 حفظ إعدادات الإشراف</button>
        </form>
    </div>`;
    res.send(ui(g, 'mod', content));
});

app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    const b = req.body;
    await ModConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        $set: {
            "jail.roleId": b.jailRole,
            "jail.channelId": b.jailChannel,
            "jail.adminRoles": Array.isArray(b.adminRoles) ? b.adminRoles : [b.adminRoles].filter(x => x)
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/mod`);
});

// ==========================================
// 7️⃣ Discord Events Logic
// ==========================================

client.on('ready', () => console.log(`🚀 VORTEX SYSTEM ONLINE: ${client.user.tag}`));

// --- [ Jail Logic: Auto-Hide Channels ] ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'jail') {
        const modConfig = await ModConfig.findOne({ guildId: interaction.guild.id });
        const target = interaction.options.getMember('user');
        
        // Hide all channels
        for (const [id, channel] of interaction.guild.channels.cache) {
            if (channel.id === modConfig?.jail?.channelId) continue;
            await channel.permissionOverwrites.edit(target.id, { ViewChannel: false }).catch(() => {});
        }
        
        // Give jail role
        await target.roles.set([modConfig.jail.roleId]).catch(() => {});
        interaction.reply(`✅ تم سجن <@${target.id}> وإخفاء كافة الرومات عنه.`);
    }
});

// --- [ Kick Monitoring ] ---
setInterval(async () => {
    const configs = await KickConfig.find();
    for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;
        for (const streamer of config.streamers) {
            try {
                const res = await axios.get(`https://kick.com/api/v1/channels/${streamer.kickUsername}`);
                const isLive = res.data.livestream !== null;
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
// 8️⃣ Start Server
// ==========================================
client.login(process.env.TOKEN);
app.listen(PORT, () => console.log(`🌐 VORTEX Dashboard Running on Port ${PORT}`));
