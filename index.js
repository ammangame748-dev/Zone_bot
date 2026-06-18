// ==========================================
// ZONE SYSTEM BOT - Fixed & Improved Version
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
    endAt: Date
}));

// FIX: تم حذف نموذج JailedUser المكرر (كان مطابقاً لـ JailData)

// FIX: تم إضافة الحقول الناقصة (rolesPanel, rolesChannel, bannerURL) للـ Schema
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
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
    // FIX: إضافة rolesPanel و rolesChannel اللي كانوا ناقصين من الـ Schema
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
        avatarWidth: { type: Number, default: 150 },  // حقل العرض
        avatarHeight: { type: Number, default: 150 }, // حقل الطول
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
const clanSchema = new mongoose.Schema({
    guildId: String,
    clanName: String,
    clanIndex: Number,
    leaderId: String,
    roleId: String,
    resultsChannelId: String,
    members: [String], // 👈 تغييرها إلى مصفوفة نصوص لتخزين الـ IDs الخاصة بالأعضاء
    assistantIds: [String], // 👈 تغييرها إلى مصفوفة نصوص لتخزين الـ IDs الخاصة بالمساعدين
    questions: {
        type: [String],
        default: ["ما هو اسمك؟", "كم عمرك؟", "لماذا تريد الانضمام؟"]
    }
});
const Clan = mongoose.model('Clan', new mongoose.Schema({
    assistantIds: [String],
    guildId: String,
    clanIndex: Number,
    clanName: String,
    roleId: String,
    leaderId: String,
    assistantId: String,
    points: { type: Number, default: 0 },
    applyChannel: String,
    applyMessage: String,
    textChannelId: String,
    voiceChannelId: String,
    resultsChannelId: String,
    members: [String],
    // ✅ أضفنا حقل الأسئلة هون
    questions: { type: [String], default: [] }
}));

const TicketConfig = mongoose.model('TicketConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    title: String,
    description: String,
    color: String,
    adminRole: String,
    topImagePath: String,
    bottomImagePath: String,
    ticketCount: { type: Number, default: 0 },  // FIX: إضافة ticketCount اللي كانت ناقصة
    buttons: [{ label: String, emoji: String }],
    menuOptions: [{ label: String, emoji: String }]
}));
const ClanMember = mongoose.model('ClanMember', new mongoose.Schema({
    guildId: String,
    userId: String,
    clanIndex: Number,
    msgCountForPoints: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 }
}));
// ==========================================
// 2️⃣ Express App Setup
// ==========================================
const app = express();
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
    .then(() => console.log('✅ Connected to MongoDB Database'))
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

        const rolesToRestore = (jailData.oldRoles || []).filter(rId => guild.roles.cache.has(rId));

        if (modConfig?.jail?.roleId) {
            await member.roles.remove(modConfig.jail.roleId).catch(() => { });
        }

        for (const roleId of rolesToRestore) {
            await member.roles.add(roleId).catch(() => { });
        }

        await JailData.deleteOne({ guildId, userId: member.id });

        const jailChannel = guild.channels.cache.get(modConfig?.jail?.channelId);
        if (jailChannel) {
            jailChannel.send(`🔓 تم فك سجن <@${member.id}> ورجعت رتبته بنجاح.`);
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
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json());

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
    secret: process.env.SESSION_SECRET || 'zone-ultra-secret-123',  // FIX: استخدام متغير بيئة للـ secret
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
};

// FIX: تم حذف المسار المكرر /auth/discord (كان موجود مرتين)
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
        <style>
            body { background: #0f0c29; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: Arial; }
            .login-card { background: rgba(0,0,0,0.6); padding: 50px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
            h1 { color: #5865F2; margin-bottom: 20px; }
            a { background: #5865F2; color: white; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; }
            a:hover { background: #4752c4; }
        </style>
    </head>
    <body>
        <div class="login-card">
            <h1>ZONE SYSTEM</h1>
            <p style="color:#aaa; margin-bottom:30px;">سجل دخول عبر حساب ديسكورد</p>
            <a href="/auth/discord">🔑 تسجيل الدخول</a>
        </div>
    </body>
    </html>`);
});

app.get('/ping', (req, res) => {
    res.send('I am alive!');
});

app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// ==========================================
// 8️⃣ UI Helper Function
// ==========================================
function ui(guild, active, content) {
    const showNav = guild.id ? 'flex' : 'none';
    const guildName = guild.name || 'قائمة السيرفرات';

    return `
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
            :root { 
                --p: #5865F2; --s: #ff4757; --bg: radial-gradient(circle at center, #1a1a2e 0%, #05051a 100%); 
                --card-bg: rgba(0, 0, 0, 0.6); --accent: #00d2ff; 
            }
            body { 
                margin: 0; font-family: 'Changa', sans-serif; background: var(--bg); 
                background-attachment: fixed; color: white; display: flex; min-height: 100vh; direction: rtl; 
            }
            .sidebar { 
                width: 280px; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); 
                position: fixed; right: 0; height: 100vh; padding: 30px 15px; 
                border-left: 1px solid rgba(255, 255, 255, 0.1); z-index: 1000; 
                display: flex; flex-direction: column;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: var(--p) transparent;
            }
            .sidebar::-webkit-scrollbar { width: 6px; }
            .sidebar::-webkit-scrollbar-thumb { background: var(--p); border-radius: 10px; }
            .sidebar::-webkit-scrollbar-track { background: transparent; }
            .sidebar h2 { 
                background: linear-gradient(to left, var(--p), var(--s)); 
                -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
                text-align: center; font-size: 30px; margin-bottom: 40px; font-weight: 700; 
                flex-shrink: 0;
            }
            .nav { display: ${showNav}; flex-direction: column; gap: 10px; padding-bottom: 50px; }
            .nav a { 
                display: flex; align-items: center; padding: 14px 20px; border-radius: 15px; 
                color: #adb5bd; text-decoration: none; transition: 0.3s; gap: 15px; font-weight: 500;
            }
            .nav a:hover, .nav a.active { 
                background: rgba(88, 101, 242, 0.15); color: white; 
                border-right: 5px solid var(--p); transform: translateX(-5px); 
            }
            .main { margin-right: ${guild.id ? '280px' : '0'}; padding: 50px; width: 100%; transition: 0.3s; }
            .card { 
                position: relative; background: var(--card-bg); backdrop-filter: blur(15px); 
                padding: 30px; border-radius: 20px; margin-bottom: 30px; 
                border: 1px solid rgba(255, 255, 255, 0.05); 
            }
            .card::after { 
                content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 2px; 
                background: linear-gradient(90deg, transparent, var(--p), var(--accent), var(--s), transparent); 
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); 
                -webkit-mask-composite: xor; mask-composite: exclude; animation: moveBorder 4s linear infinite; 
                pointer-events: none; 
            }
            @keyframes moveBorder { 0% { filter: hue-rotate(0deg); opacity: 0.6; } 100% { filter: hue-rotate(360deg); opacity: 1; } }
            .btn-save { 
                background: linear-gradient(45deg, var(--p), var(--s)); color: white; border: none; 
                padding: 15px; border-radius: 15px; cursor: pointer; width: 100%; 
                font-weight: bold; transition: 0.4s; text-align: center; text-decoration: none; display: block; 
            }
            .btn-save:hover { filter: brightness(1.2); transform: scale(1.01); }
            input, select, textarea { 
                width: 100%; padding: 14px; border-radius: 12px; background: rgba(0, 0, 0, 0.4); 
                color: white; border: 1px solid #333; margin: 10px 0; font-family: 'Changa'; 
                box-sizing: border-box;
            }
            h3 { color: var(--accent); margin: 0; margin-bottom: 15px; }
            .guild-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .guild-card {
                background: var(--card-bg); border-radius: 20px; padding: 25px; text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.1); transition: 0.4s; width: 220px;
            }
            .guild-card:hover { transform: translateY(-10px); border-color: var(--p); }
            .guild-icon { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--p); margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <h2>ZONE SYSTEM</h2>
            <div class="nav">
                <a class="${active == 'home' ? 'active' : ''}" href="/manage/${guild.id}/home"> الإحصائيات</a>
                <a class="${active == 'security' ? 'active' : ''}" href="/manage/${guild.id}/security"> الحماية</a>
                <a class="${active == 'kick' ? 'active' : ''}" href="/manage/${guild.id}/kick"> تنبيهات Kick</a>
                <a class="${active == 'streaks' ? 'active' : ''}" href="/manage/${guild.id}/streaks"> الستريك المطور</a>
                <a class="${active == 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs"> اللوق</a>
                <a class="${active == 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets"> التذاكر</a>
                <a class="${active == 'autoreply' ? 'active' : ''}" href="/manage/${guild.id}/autoreply"> الرد الآلي</a>
                <a class="${active == 'levels' ? 'active' : ''}" href="/manage/${guild.id}/levels"> المستويات</a>
                <a class="${active == 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome"> الترحيب</a>
                <a class="${active == 'giveaway' ? 'active' : ''}" href="/manage/${guild.id}/giveaway"> القيف اواي</a>
                <a class="${active == 'roles' ? 'active' : ''}" href="/manage/${guild.id}/roles"> الرتب</a>
                <a class="${active == 'mod' ? 'active' : ''}" href="/manage/${guild.id}/mod"> أوامر الإشراف</a>
                <a class="${active == 'clans' ? 'active' : ''}" href="/manage/${guild.id}/clans"> نظام الكلانات</a>
            </div>
        </div>
        <div class="main">
            <h1 style="margin-bottom:30px; font-size: 28px;">📍 ${guildName}</h1>
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
    <div class="guild-card">
        <img src="${iconURL}" class="guild-icon">
        <h3 style="color:white; margin:10px 0;">${g.name}</h3>
        ${hasBot
            ? `<a href="/manage/${g.id}/home" style="color:#5865F2; text-decoration:none; font-weight:bold;">⚙️ الإعدادات</a>`
            : `<a href="${inviteLink}" style="color:#00d2ff; text-decoration:none; font-weight:bold;">➕ إضافة البوت</a>`
        }
    </div>`;
    }).join('');

    const content = `
<div style="width:100%; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding-top:40px;">
    <div style="font-size:40px; font-weight:bold; background: linear-gradient(45deg, #ff4d6d, #7b2ff7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom:30px;">ZONE SYSTEM</div>
    <div class="guild-grid">${cards}</div>
</div>`;

    res.send(ui({ id: null, name: 'قائمة السيرفرات' }, 'home', content));
});

// --- [ Home / Stats Page ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    // FIX: تم حذف سطر Stats.deleteOne الذي كان يمسح الإحصائيات في كل زيارة
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
        <h3> إحصائيات السيرفر</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px;">
            <div style="background: rgba(88,101,242,0.1); padding: 20px; border-radius: 15px; text-align: center;">
                <div style="font-size: 40px; font-weight: bold; color: var(--p);">${statsData.messages?.total || 0}</div>
                <div style="color: #aaa;">إجمالي الرسائل</div>
            </div>
            <div style="background: rgba(0,210,255,0.1); padding: 20px; border-radius: 15px; text-align: center;">
                <div style="font-size: 40px; font-weight: bold; color: var(--accent);">${g.memberCount}</div>
                <div style="color: #aaa;">عدد الأعضاء</div>
            </div>
            <div style="background: rgba(0,255,136,0.1); padding: 20px; border-radius: 15px; text-align: center;">
                <div style="font-size: 40px; font-weight: bold; color: #00ff88;">+${newMembersCount}</div>
                <div style="color: #aaa;">أعضاء جدد (7 أيام)</div>
            </div>
            <div style="background: rgba(255,71,87,0.1); padding: 20px; border-radius: 15px; text-align: center;">
                <div style="font-size: 40px; font-weight: bold; color: var(--s);">-${leftMembersCount}</div>
                <div style="color: #aaa;">أعضاء غادروا (7 أيام)</div>
            </div>
        </div>
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>🟢 نظام تنبيهات Kick المطور</h3>
            <button onclick="document.getElementById('add-kick-form').style.display = document.getElementById('add-kick-form').style.display === 'none' ? 'block' : 'none'" class="btn-save" style="width:auto; padding:10px 20px; background: #00E701; color:black;">➕ إضافة ستريمر</button>
        </div>

        <div id="add-kick-form" style="display:none; border: 1px solid #00E701; padding: 20px; border-radius: 15px; margin-bottom: 30px;">
            <form method="POST" action="/save/${g.id}/kick">
                <label>اسم المستخدم في Kick:</label>
                <input type="text" name="kickUser" placeholder="مثلاً: hook" required>
                <label>قناة التنبيه:</label>
                <select name="channelId">
                    ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                </select>
                <label>الرتبة المطلوب عمل منشن لها:</label>
                <select name="roleId">
                    <option value="">-- بدون منشن --</option>
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </select>
                <label>رسالة التنبيه:</label>
                <textarea name="msg" placeholder="استخدم %name% لاسم الستريمر..."></textarea>
                <button class="btn-save">💾 حفظ الإضافة</button>
            </form>
        </div>

        <table style="width:100%; color:white; border-collapse: collapse; text-align:right;">
            <thead>
                <tr style="border-bottom: 2px solid var(--p);">
                    <th style="padding:10px;">الستريمر</th>
                    <th>القناة</th>
                    <th>التحكم</th>
                </tr>
            </thead>
            <tbody>
                ${s.streamers.map((st, i) => `
                <tr style="border-bottom: 1px solid #222;">
                    <td style="padding:15px;">${st.kickUsername}</td>
                    <td>#${g.channels.cache.get(st.channelId)?.name || 'قناة محذوفة'}</td>
                    <td><a href="/delete-kick/${g.id}/${i}" style="color:var(--s); text-decoration:none;" onclick="return confirm('حذف؟')">🗑️ حذف</a></td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;

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
    <form method="POST" action="/save/${g.id}/streaks">
        <div class="card">
            <h3>🔥 إعدادات الستريك المطور</h3>
            <label>عدد الرسائل المطلوبة يومياً:</label>
            <input type="number" name="reqMsgs" value="${s.requiredMessages || 60}" min="1">
            <label>رتبة الستريك (الرتبة اللي يجب أن يملكها العضو):</label>
            <select name="streakRole">
                <option value="">-- لا يوجد --</option>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.streakRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            <label>قناة إعلانات الستريك:</label>
            <select name="streakChannel">
                <option value="">-- لا يوجد --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.streakChannel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save">💾 حفظ الإعدادات</button>
        </div>
    </form>
    <form method="POST" action="/reset-streaks/${g.id}" onsubmit="return confirm('هل أنت متأكد من تصفير كل الستريكات؟')">
        <button class="btn-save" style="background: linear-gradient(45deg, #ff4757, #c0392b);">🔄 تصفير كل الستريكات</button>
    </form>`;

    res.send(ui(g, 'streaks', content));
});

// FIX: تم حذف المسار المكرر /save/:guildId/streaks (كان موجود مرتين)
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
    const typeLabels = { messages: '💬 الرسائل', moderation: '⚖️ الإشراف', members: '👥 الأعضاء', channels: '📢 القنوات', roles: '🎭 الرتب', voice: '🎙️ الصوت' };

    let content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3>📜 نظام اللوق</h3>
            ${types.map(t => `
                <div style="display: flex; align-items: center; gap: 15px; margin: 15px 0; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 10px;">
                    <label style="width: 120px; color: var(--accent);">${typeLabels[t]}</label>
                    <input type="checkbox" name="${t}_st" ${s.logs?.[t]?.enabled ? 'checked' : ''} style="width: auto; margin: 0;">
                    <select name="${t}_ch" style="flex: 1; margin: 0;">
                        <option value="">-- اختر القناة --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c =>
                            `<option value="${c.id}" ${s.logs?.[t]?.channel == c.id ? 'selected' : ''}># ${c.name}</option>`
                        ).join('')}
                    </select>
                </div>
            `).join('')}
        </div>
        <button class="btn-save">💾 حفظ اللوق</button>
    </form>`;

    res.send(ui(g, 'logs', content));
});

// FIX: تم حذف المسار المكرر /save/:guildId/logs (كان موجود مرتين)
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
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };

    let img = s.welcome?.imagePath || 'https://placehold.co/800x400?text=No+Background';

    let content = `
    <style>
        .preview-container {
            position: relative; 
            border: 2px solid #5865F2; 
            border-radius: 10px; 
            overflow: hidden; 
            background: #000; 
            width: 100%;
            aspect-ratio: 2/1;
            user-select: none;
        }
        #previewAvatar {
            position: absolute; 
            border: 3px solid #fff; 
            border-radius: 50%; 
            background: url('${client.user.displayAvatarURL( )}'); 
            background-size: 100% 100%; 
            cursor: move;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
        }
        /* مقابض المط */
        .resizer {
            width: 12px;
            height: 12px;
            background: #5865F2;
            position: absolute;
            border: 2px solid #fff;
            border-radius: 2px;
        }
        .resizer.br { right: -6px; bottom: -6px; cursor: nwse-resize; }
        .resizer.tr { right: -6px; top: -6px; cursor: nesw-resize; }
        .resizer.bl { left: -6px; bottom: -6px; cursor: nesw-resize; }
    </style>

    <div class="card">
        <h3>الترحيب </h3>
    </div>


    <form method="POST" action="/save/${g.id}/welcome" enctype="multipart/form-data" id="mainForm">
        <div class="card">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <label>📍 قناة الترحيب:</label>
                    <select name="channel" required>
                        ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.welcome?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>🔔 الحالة:</label>
                    <select name="enabled">
                        <option value="on" ${s.welcome?.enabled ? 'selected' : ''}>🟢 مشغل</option>
                        <option value="off" ${!s.welcome?.enabled ? 'selected' : ''}>🔴 مطفأ</option>
                    </select>
                </div>
            </div>
<label>💬 رسالة الترحيب (نص الإيمباد):</label>
<textarea name="embedMessage" rows="5" placeholder="اكتب رسالة الترحيب هنا... يمكنك استخدام {member} و {guild} و {count}" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid #5865F2; color: white; padding: 10px; border-radius: 5px; margin-bottom: 20px;">${s.welcome?.embedMessage || ''}</textarea>

            <label>💬 وصف الـ AI للخلفية:</label>
            <div style="display: flex; gap: 10px; margin-bottom:20px;">
                <input type="text" id="aiPromptInput" name="aiPrompt" value="${s.welcome?.aiPrompt || ''}" placeholder="مثلاً: Galaxy background, blue stars" style="flex:1;">
                <button type="button" onclick="generateAIImage()" class="btn-save" style="width:auto; background:#7b2ff7;">🚀 توليد</button>
            </div>
            <input type="hidden" name="remoteBg" id="remoteBg">

            <div class="preview-container" id="container">
                <img src="${img}" id="previewBg" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; opacity: 0.7;">
                <div id="previewAvatar" style="
                    width: ${s.welcome?.avatarWidth || 150}px; 
                    height: ${s.welcome?.avatarHeight || 150}px; 
                    left: ${s.welcome?.avatarX || 50}%; 
                    top: ${s.welcome?.avatarY || 50}%; 
                    transform: translate(-50%, -50%);">
                    <div class="resizer br"></div>
                    <div class="resizer tr"></div>
                    <div class="resizer bl"></div>
                </div>
            </div>

            <p style="color: #aaa; font-size: 12px; margin-top: 10px; text-align: center;">
                💡 اسحب الصورة لتحريكها، واستخدم المربعات الزرقاء في الزوايا لمطها وتغيير حجمها.
            </p>

            <input type="hidden" name="avatarX" id="avatarX" value="${s.welcome?.avatarX || 50}">
            <input type="hidden" name="avatarY" id="avatarY" value="${s.welcome?.avatarY || 50}">
            <input type="hidden" name="avatarWidth" id="avatarWidth" value="${s.welcome?.avatarWidth || 150}">
            <input type="hidden" name="avatarHeight" id="avatarHeight" value="${s.welcome?.avatarHeight || 150}">


            <button type="submit" class="btn-save" style="margin-top: 20px;">💾 حفظ التصميم النهائي</button>
        </div>
    </form>

    <script>
        const avatar = document.getElementById('previewAvatar');
        const container = document.getElementById('container');
        let isDragging = false;
        let isResizing = false;
        let currentResizer = null;

        // --- نظام التحريك (Drag) ---
        avatar.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resizer')) return;
            isDragging = true;
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
                    const newWidth = e.clientX - avatarRect.left;
                    const newHeight = e.clientY - avatarRect.top;
                    avatar.style.width = newWidth + 'px';
                    avatar.style.height = newHeight + 'px';
                } else if (currentResizer.classList.contains('tr')) {
                    const newWidth = e.clientX - avatarRect.left;
                    const newHeight = avatarRect.bottom - e.clientY;
                    avatar.style.width = newWidth + 'px';
                    avatar.style.height = newHeight + 'px';
                } else if (currentResizer.classList.contains('bl')) {
                    const newWidth = avatarRect.right - e.clientX;
                    const newHeight = e.clientY - avatarRect.top;
                    avatar.style.width = newWidth + 'px';
                    avatar.style.height = newHeight + 'px';
                }
                document.getElementById('avatarWidth').value = Math.round(avatar.offsetWidth);
                document.getElementById('avatarHeight').value = Math.round(avatar.offsetHeight);
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
        });

        // --- نظام المط (Resize) ---
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
            if(!prompt) return alert('اكتب وصفاً!');
            const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ", no text, high quality" ) + '?width=800&height=400&nologo=true';
            document.getElementById('previewBg').src = url;
            document.getElementById('remoteBg').value = url;
        }
    </script>
    `;
    res.send(ui(g, 'welcome', content));
});



app.post('/save/:guildId/welcome', checkAuth, upload.single('welcomeImage'), async (req, res) => {
    try {
        const { guildId } = req.params;
        const b = req.body;

        // ✅ ركز هون: لازم نأخذ embedMessage من req.body
        let updateData = {
            'welcome.enabled': b.enabled === 'on',
            'welcome.channel': b.channel,
            'welcome.embedMessage': b.embedMessage, // هاض السطر اللي كان ناقص أو فيه مشكلة
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

        // تحديث قاعدة البيانات
        await GuildConfig.findOneAndUpdate(
            { guildId }, 
            { $set: updateData }, 
            { upsert: true, new: true }
        );

        res.redirect(`/manage/${guildId}/welcome`);
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).send("خطأ في حفظ الإعدادات");
    }
});
app.get('/manage/:guildId/autoreply', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await GuildConfig.findOne({ guildId: g.id }) || { autoReply: [] };
    
    // نجهز 5 حقول فارغة دائماً لسهولة الإضافة
    let content = `
    <form method="POST" action="/save/${g.id}/autoreply">
        <div class="card">
            <h3>🤖 نظام الرد الآلي</h3>
            <p style="color: #aaa; font-size: 13px;">ملاحظة: اترك الحقول فارغة لحذف الرد.</p>
            
            <div id="reply-list">
                ${[...Array(Math.max(s.autoReply.length + 2, 5))].map((_, i) => {
                    const data = s.autoReply && s.autoReply[i] ? s.autoReply[i] : { trigger: '', reply: '' };
                    return `
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px;">
                        <input name="trigger" value="${data.trigger}" placeholder="الكلمة (مثلاً: هلا)" style="flex: 1;">
                        <input name="reply" value="${data.reply}" placeholder="رد البوت (مثلاً: هلا بك نورت)" style="flex: 2;">
                    </div>`;
                }).join('')}
            </div>
            
            <button class="btn-save">💾 حفظ كل الردود</button>
        </div>
    </form>`;

    res.send(ui(g, 'autoreply', content));
});

app.post('/save/:guildId/autoreply', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        let { trigger, reply } = req.body;

        // تحويل المدخلات إلى مصفوفة إذا كانت كلمة واحدة فقط
        if (!Array.isArray(trigger)) trigger = trigger ? [trigger] : [];
        if (!Array.isArray(reply)) reply = reply ? [reply] : [];

        let finalData = [];
        // دمج الكلمات مع ردودها وتصفية الحقول الفارغة
        for (let i = 0; i < trigger.length; i++) {
            const t = trigger[i]?.trim();
            const r = reply[i]?.trim();
            if (t && r) {
                finalData.push({ trigger: t, reply: r });
            }
        }

        // تحديث قاعدة البيانات
        await GuildConfig.findOneAndUpdate(
            { guildId }, 
            { $set: { autoReply: finalData } }, 
            { upsert: true }
        );

        res.redirect(`/manage/${guildId}/autoreply`);
    } catch (err) {
        console.error("❌ Error saving autoreply:", err);
        res.status(500).send("خطأ داخلي في حفظ البيانات");
    }
});


// --- [ Giveaway ] ---
app.get('/manage/:guildId/giveaway', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    const activeGiveaways = await Giveaway.find({ guildId: g.id, ended: false });

    const content = `
    <form method="POST" action="/save/${g.id}/giveaway">
        <div class="card">
            <h3>🎉 إنشاء قيف اواي جديد</h3>
            <input name="prize" placeholder="الجائزة" required>
            <textarea name="description" placeholder="الوصف (اختياري)"></textarea>
            <input name="duration" placeholder="المدة: 1d أو 1h أو 30m" required>
            <label>عدد الفائزين:</label>
            <input type="number" name="winners" value="1" min="1">
            <label>قناة الإرسال:</label>
            <select name="channel">
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}"># ${c.name}</option>`
                ).join('')}
            </select>
            <button class="btn-save">🚀 تشغيل القيف اواي</button>
        </div>
    </form>
    ${activeGiveaways.length > 0 ? `
    <div class="card">
        <h3>📋 القيف اوايات النشطة</h3>
        ${activeGiveaways.map(gw => `
        <div style="padding: 15px; background: rgba(255,255,255,0.03); border-radius: 10px; margin-bottom: 10px;">
            <b>${gw.prize}</b> — ينتهي <t:${Math.floor(gw.endAt / 1000)}:R> — ${gw.winnersCount} فائز
        </div>`).join('')}
    </div>` : ''}`;

    res.send(ui(g, 'giveaway', content));
});

// FIX: تم حذف المسار المكرر /save/:guildId/giveaway (كان موجود مرتين)
app.post('/save/:guildId/giveaway', checkAuth, async (req, res) => {
    const { prize, duration, winners, channel, description } = req.body;
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.status(404).send("السيرفر غير موجود");

    const timeMs = ms(duration);
    if (!timeMs) return res.send("❌ خطأ في صيغة الوقت! استخدم 1h أو 1d أو 30m");

    const endAt = new Date(Date.now() + timeMs);
    const targetCh = g.channels.cache.get(channel);
    if (!targetCh) return res.send("❌ الروم غير موجود");

    const embed = new EmbedBuilder()
        .setTitle(`🎉 قيف اواي: ${prize}`)
        .setDescription(`${description || 'لا يوجد وصف'}\n\n**ينتهي:** <t:${Math.floor(endAt / 1000)}:R>\n**عدد الفائزين:** ${winners}`)
        .setColor('#5865F2')
        .setFooter({ text: 'اضغط على 🎉 للاشتراك' });

    const giveawayMsg = await targetCh.send({ embeds: [embed] });
    await giveawayMsg.react('🎉');

    await Giveaway.create({
        guildId: g.id, messageId: giveawayMsg.id, channelId: channel,
        endAt, winnersCount: parseInt(winners), prize, description
    });
    res.redirect(`/manage/${g.id}/giveaway`);
});

// --- [ Tickets ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [], menuOptions: [] };
    let topImg = s.topImagePath ? `/uploads/${path.basename(s.topImagePath)}` : 'https://placehold.co/110x110?text=Top';
    let bottomImg = s.bottomImagePath ? `/uploads/${path.basename(s.bottomImagePath)}` : 'https://placehold.co/110x110?text=Bottom';

    let content = `
    <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3 style="text-align:center; color:var(--p)">🎫 إعداد نظام التذاكر المتطور</h3>
            
            <div style="display: flex; gap: 30px; justify-content: center; margin-bottom: 25px;">
                <div style="text-align: center;">
                    <label>الصورة العلوية:</label><br>
                    <img src="${topImg}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 15px; border: 2px solid var(--p);">
                    <label style="background: var(--p); padding: 5px; border-radius: 5px; cursor: pointer; display: block; margin-top: 5px; font-size:12px;">
                        🔄 تغيير <input type="file" name="topImage" style="display: none;">
                    </label>
                </div>
                <div style="text-align: center;">
                    <label>الصورة السفلية:</label><br>
                    <img src="${bottomImg}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 15px; border: 2px solid var(--p);">
                    <label style="background: var(--p); padding: 5px; border-radius: 5px; cursor: pointer; display: block; margin-top: 5px; font-size:12px;">
                        🔄 تغيير <input type="file" name="bottomImage" style="display: none;">
                    </label>
                </div>
            </div>

            <label>عنوان التذكرة:</label>
            <input name="title" value="${s.title || ''}" placeholder="عنوان نظام التذاكر">
            <label>الوصف:</label>
            <textarea name="description">${s.description || ''}</textarea>
            <label>اللون (Hex):</label>
            <input name="color" value="${s.color || '#5865F2'}" placeholder="#5865F2">
            <label>رتبة الإدارة:</label>
            <select name="adminRole">
                <option value="">-- اختر رتبة الإدارة --</option>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}" ${s.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>

            <h4 style="color: var(--accent); margin-top: 20px;">🔘 الأزرار (حتى 4):</h4>
            ${[0,1,2,3].map(i => `
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                <input name="btn_label_${i}" value="${s.buttons?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                <input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji || ''}" placeholder="إيموجي">
            </div>`).join('')}

            <h4 style="color: var(--accent); margin-top: 20px;">📋 خيارات المنيو (حتى 4):</h4>
            ${[0,1,2,3].map(i => `
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                <input name="menu_label_${i}" value="${s.menuOptions?.[i]?.label || ''}" placeholder="خيار المنيو ${i+1}">
                <input name="menu_emoji_${i}" value="${s.menuOptions?.[i]?.emoji || ''}" placeholder="إيموجي">
            </div>`).join('')}

            <label style="margin-top: 20px;">📢 قناة الإرسال (اختياري):</label>
            <select name="targetChannel">
                <option value="">-- لا ترسل الآن --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save" style="margin-top: 20px;">💾 حفظ وإرسال</button>
        </div>
    </form>`;

    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), async (req, res) => {
    try {
        const b = req.body;
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.status(404).send("Guild not found");

        let buttons = [];
        let menuOptions = [];

        for (let i = 0; i < 4; i++) {
            const btnLabel = b[`btn_label_${i}`]?.trim();
            const btnEmoji = b[`btn_emoji_${i}`]?.trim();
            const menuLabel = b[`menu_label_${i}`]?.trim();
            const menuEmoji = b[`menu_emoji_${i}`]?.trim();
            if (btnLabel) buttons.push({ label: btnLabel, emoji: btnEmoji || "" });
            if (menuLabel) menuOptions.push({ label: menuLabel, emoji: menuEmoji || "" });
        }

        let updateData = {
            title: b.title,
            description: b.description,
            color: b.color || "#5865F2",
            adminRole: b.adminRole,
            buttons,
            menuOptions
        };

        if (req.files?.topImage?.[0]) updateData.topImagePath = req.files.topImage[0].path;
        if (req.files?.bottomImage?.[0]) updateData.bottomImagePath = req.files.bottomImage[0].path;

        const config = await TicketConfig.findOneAndUpdate(
            { guildId: req.params.guildId }, { $set: updateData }, { upsert: true, new: true }
        );

        if (b.targetChannel) {
            const channel = g.channels.cache.get(b.targetChannel);
            if (channel) {
                const files = [];
                const embed = new EmbedBuilder()
                    .setTitle(config.title || "TICKETS")
                    .setDescription(config.description || "اضغط للفتح")
                    .setColor(config.color || "#5865F2");

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

                if (config.buttons?.length > 0) {
                    const btnRow = new ActionRowBuilder();
                    config.buttons.forEach((btn, i) => {
                        const button = new ButtonBuilder()
                            .setCustomId(`ticket_btn_${i}`)
                            .setLabel(btn.label)
                            .setStyle(ButtonStyle.Primary);
                        if (btn.emoji && btn.emoji.trim() !== "") {
                            const em = btn.emoji.trim();
                            try {
                                if (/^\d+$/.test(em)) button.setEmoji({ id: em });
                                else if (/^<a?:\w+:\d+>$/.test(em)) button.setEmoji(em);
                            } catch (e) { console.log("Emoji Error:", e.message); }
                        }
                        btnRow.addComponents(button);
                    });
                    if (btnRow.components.length > 0) components.push(btnRow);
                }

                if (config.menuOptions?.length > 0) {
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('ticket_menu')
                        .setPlaceholder('🔽 اختر من القائمة...');
                    config.menuOptions.forEach((opt, i) => {
                        const option = { label: opt.label, value: `ticket_opt_${i}` };
                        if (opt.emoji && opt.emoji.trim() !== "") {
                            const em = opt.emoji.trim();
                            try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) { }
                        }
                        select.addOptions(option);
                    });
                    components.push(new ActionRowBuilder().addComponents(select));
                }

                // FIX: إضافة زر افتراضي إذا ما في أزرار أو منيو
                if (components.length === 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Primary)
                    ));
                }

                await channel.send({ embeds: [embed], components, files }).catch(e => console.error("Discord Send Error:", e));
            }
        }
        res.redirect(`/manage/${req.params.guildId}/tickets`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Error");
    }
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
            <label>تشغيل النظام:</label>
            <select name="enabled">
                <option value="on" ${s.levels?.enabled ? 'selected' : ''}>🟢 مشغل</option>
                <option value="off" ${!s.levels?.enabled ? 'selected' : ''}>🔴 مطفأ</option>
            </select>
            <label>XP لكل رسالة:</label>
            <input type="number" name="xp" value="${s.levels?.xpPerMessage || 10}" min="1">
            <label>قناة إعلانات الترقي:</label>
            <select name="channel">
                <option value="">-- نفس قناة الرسالة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.levels?.levelUpChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <label>أمر قائمة المتصدرين:</label>
            <input name="leaderboardCommand" value="${s.levels?.leaderboardCommand || '!levels'}" placeholder="!levels">
            <button class="btn-save">💾 حفظ الإعدادات</button>
        </div>
    </form>
    <form method="POST" action="/reset-levels/${g.id}" onsubmit="return confirm('هل أنت متأكد من تصفير كل المستويات؟')">
        <button class="btn-save" style="background: linear-gradient(45deg, #ff4757, #c0392b);">🔄 تصفير كل المستويات</button>
    </form>`;

    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const b = req.body;
        await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: {
                "levels.enabled": b.enabled === 'on',
                "levels.xpPerMessage": Number(b.xp) || 10,
                "levels.levelUpChannel": b.channel,
                "levels.leaderboardCommand": b.leaderboardCommand || '!levels'
            }},
            { upsert: true }
        );
        res.redirect(`/manage/${guildId}/levels`);
    } catch (err) {
        console.error("❌ Level Save Error:", err);
        res.status(500).send("حدث خطأ أثناء حفظ إعدادات الليفل.");
    }
});

app.post('/reset-levels/:guildId', checkAuth, async (req, res) => {
    await UserLevel.updateMany({ guildId: req.params.guildId }, { $set: { xp: 0, level: 1, msgCount: 0 } });
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Security ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/security">
        <div class="card">
            <h3>🛡️ إعدادات الحماية</h3>
            <label>منع الروابط:</label>
            <select name="antiLinks">
                <option value="on" ${s.security?.antiLinks ? 'selected' : ''}>🟢 مفعل</option>
                <option value="off" ${!s.security?.antiLinks ? 'selected' : ''}>🔴 معطل</option>
            </select>
            <label>الكلمات الممنوعة (افصل بفاصلة):</label>
            <textarea name="badWords" placeholder="كلمة1, كلمة2, كلمة3">${s.security?.badWords || ''}</textarea>
            <label>الإيموجي الممنوع (افصل بفاصلة):</label>
            <input name="badEmojis" value="${s.security?.badEmojis || ''}" placeholder="😈, 💀">
            <label>رتب الاستثناء (Bypass):</label>
            <select name="bypassRoles" multiple style="height: 120px;">
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
                    `<option value="${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>
            <button class="btn-save">💾 حفظ الحماية</button>
        </div>
    </form>`;

    res.send(ui(g, 'security', content));
});

app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: {
            "security.antiLinks": b.antiLinks === 'on',
            "security.badWords": b.badWords,
            "security.badEmojis": b.badEmojis,
            "security.bypassRoles": Array.isArray(b.bypassRoles) ? b.bypassRoles : (b.bypassRoles ? [b.bypassRoles] : [])
        }},
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Roles Panel ] ---
app.get('/manage/:guildId/roles', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { rolesPanel: [] };

    const content = `
    <form method="POST" action="/save/${g.id}/roles">
        <div class="card">
            <h3>🎭 لوحة الرتب الذاتية</h3>
            <label>قناة الإرسال:</label>
            <select name="channel">
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.rolesChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            ${[0,1,2,3,4,5,6,7].map(i => `
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-top: 10px;">
                <select name="role_${i}">
                    <option value="">-- اختر رتبة ${i+1} --</option>
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
                        `<option value="${r.id}" ${s.rolesPanel?.[i]?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                    ).join('')}
                </select>
                <input name="label_${i}" value="${s.rolesPanel?.[i]?.label || ''}" placeholder="نص الزر">
            </div>`).join('')}
            <button class="btn-save" style="margin-top: 20px;">💾 حفظ وإرسال اللوحة</button>
        </div>
    </form>`;

    res.send(ui(g, 'roles', content));
});

app.post('/save/:guildId/roles', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const g = client.guilds.cache.get(guildId);
        if (!g) return res.status(404).send("السيرفر غير موجود");

        const rolesPanel = [];
        for (let i = 0; i < 8; i++) {
            if (req.body[`role_${i}`]) {
                rolesPanel.push({ roleId: req.body[`role_${i}`], label: req.body[`label_${i}`] || "رتبة", type: "button" });
            }
        }

        await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: { rolesPanel, rolesChannel: req.body.channel } },
            { upsert: true }
        );

        const channel = g.channels.cache.get(req.body.channel);
        if (channel && rolesPanel.length > 0) {
            const rows = [];
            let currentRow = new ActionRowBuilder();

            rolesPanel.forEach((r, index) => {
                const button = new ButtonBuilder()
                    .setCustomId(`role_${r.roleId}`)
                    .setLabel(r.label)
                    .setStyle(ButtonStyle.Secondary);
                currentRow.addComponents(button);
                if (currentRow.components.length === 5 || index === rolesPanel.length - 1) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
            });

            const embed = new EmbedBuilder()
                .setTitle("🎭 لوحة اختيار الرتب الذاتية")
                .setDescription("اضغط على الأزرار أدناه للحصول على الرتبة أو إزالتها.")
                .setColor("#5865F2")
                .setFooter({ text: "Zone System • Self Roles" });

            await channel.send({ embeds: [embed], components: rows });
        }

        res.redirect(`/manage/${guildId}/roles`);
    } catch (err) {
        console.error("Save Roles Error:", err);
        res.status(500).send("حدث خطأ أثناء حفظ وإرسال الرتب.");
    }
});

// --- [ Mod Config ] ---
app.get('/manage/:guildId/mod', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await ModConfig.findOne({ guildId: g.id }) || { jail: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/mod">
        <div class="card">
            <h3>⚖️ إعدادات نظام السجن</h3>
            <label>اسم أمر السجن:</label>
            <input name="jailCmd" value="${s.jail?.commandName || 'jail'}" placeholder="jail">
            <label>اسم أمر فك السجن:</label>
            <input name="unjailCmd" value="${s.jail?.unjailCommand || 'unjail'}" placeholder="unjail">
            <label>رتبة السجن:</label>
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
            <button class="btn-save">💾 حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'mod', content));
});

app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    await ModConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: {
            "jail.commandName": req.body.jailCmd || 'jail',
            "jail.unjailCommand": req.body.unjailCmd || 'unjail',
            "jail.roleId": req.body.jailRole,
            "jail.channelId": req.body.jailChannel
        }},
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/mod`);
});

// --- [ Clans ] ---
app.get('/manage/:guildId/clans', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const clans = await Clan.find({ guildId: g.id }).sort({ clanIndex: 1 });

    const content = `
    <div class="card">
        <h3>🚩 نظام الكلانات</h3>
        <a href="/manage/${g.id}/clans/add" class="btn-save" style="display:inline-block; width:auto; padding:10px 20px; margin-bottom:20px;">➕ إضافة كلان</a>
        ${clans.length === 0 ? '<p style="color:#aaa;">لا يوجد كلانات بعد.</p>' : ''}
        ${clans.map(clan => `
        <div style="padding: 20px; background: rgba(255,255,255,0.03); border-radius: 15px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="color: var(--accent); margin: 0;">${clan.clanName || 'كلان بدون اسم'}</h4>
                <span style="color: #f1c40f;">🏆 ${clan.points} نقطة</span>
            </div>
            <p style="color: #aaa; margin: 5px 0;">القائد: <@${clan.leaderId}> | الأعضاء: ${clan.members?.length || 0}/10</p>
            <a href="/manage/${g.id}/clans/edit/${clan.clanIndex}" style="color: var(--p); text-decoration: none;">✏️ تعديل</a>
            <a href="/manage/${g.id}/clans/delete/${clan.clanIndex}" style="color: var(--s); text-decoration: none; margin-right: 15px;" onclick="return confirm('حذف الكلان؟')">🗑️ حذف</a>
        </div>`).join('')}
    </div>`;

    res.send(ui(g, 'clans', content));
});
app.post('/save/:guildId/clans', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { clanName, leaderId, roleId, resultsChannelId, clanIndex, questions, applyChannelId } = req.body;

        // 1. تجهيز الأسئلة
        const questionsArray = questions ? questions.split('\n').filter(q => q.trim() !== "") : [];

        // 2. إنشاء الكلان في قاعدة البيانات
        const newClan = await Clan.create({ 
            guildId, 
            clanName, 
            leaderId, 
            roleId, 
            resultsChannelId, 
            clanIndex: parseInt(clanIndex), 
            questions: questionsArray,
            members: [], 
            assistantIds: [] 
        });

        // 3. إرسال لوحة التقديم تلقائياً (إذا تم اختيار قناة)
        // ملاحظة: تأكد أنك أضفت حقل applyChannelId في صفحة الـ HTML (سأعطيك الكود أدناه)
        const targetChannel = client.channels.cache.get(resultsChannelId); // أو استخدم قناة مخصصة للتقديم
        if (targetChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ نظام التقديم | ${clanName}`)
                .setDescription("اضغط على الزر أدناه لفتح تذكرة تقديم والإجابة على الأسئلة.")
                .setColor('#5865F2')
                .setFooter({ text: 'Zone System • Clans Management' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`apply_clan_${newClan._id}`) // استخدام الـ ID الحقيقي من قاعدة البيانات
                    .setLabel('تقديم الآن')
                    .setStyle(ButtonStyle.Success)
            );

            await targetChannel.send({ embeds: [embed], components: [row] }).catch(e => console.error("Error sending clan embed:", e));
        }

        res.redirect(`/manage/${guildId}/clans`);
    } catch (err) {
        console.error("❌ Clan Save Error:", err);
        res.status(500).send("خطأ في إضافة الكلان");
    }
});
app.get('/manage/:guildId/clans/add', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    const lastClan = await Clan.findOne({ guildId: g.id }).sort({ clanIndex: -1 });
    const nextIndex = lastClan ? lastClan.clanIndex + 1 : 0;

    const content = `
    <form method="POST" action="/save/${g.id}/clans">
        <div class="card">
            <h3 style="color: var(--accent); margin-bottom: 20px;">🚩 إضافة كلان جديد</h3>
            <input type="hidden" name="clanIndex" value="${nextIndex}">
            
            <label>اسم الكلان:</label>
            <input name="clanName" required placeholder="مثلاً: ZONE TEAM">
            
            <label>القائد (ID):</label>
            <input name="leaderId" required placeholder="ايدي صاحب الكلان">
            
            <label>رتبة الكلان:</label>
            <select name="roleId">
                <option value="">-- بدون رتبة --</option>
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>

            <label>📢 قناة إرسال "لوحة التقديم":</label>
            <select name="applyChannelId" required>
                <option value="">-- اختر القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>

            <label>📥 قناة وصول "نتائج التقديم":</label>
            <select name="resultsChannelId" required>
                <option value="">-- اختر القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>

            <div style="margin-top: 20px; padding: 15px; background: rgba(88, 101, 242, 0.05); border-radius: 10px; border: 1px solid rgba(88, 101, 242, 0.2);">
                <label style="display:block; margin-bottom: 10px; font-weight: bold; color: #00d2ff;">📝 أسئلة التقديم (سؤال في كل سطر):</label>
                <textarea name="questions" rows="5" placeholder="ما هو اسمك؟&#10;كم عمرك؟" style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid #5865F2; color: white; padding: 10px; border-radius: 5px;"></textarea>
            </div>

            <button type="submit" class="btn-save" style="margin-top: 20px;">💾 حفظ وإرسال التقديم</button>
        </div>
    </form>`;

    res.send(ui(g, 'clans', content));
});
app.post('/save/:guildId/clans', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { clanName, leaderId, roleId, resultsChannelId, applyChannelId, clanIndex, questions } = req.body;

        const questionsArray = questions ? questions.split('\n').filter(q => q.trim() !== "") : [];

        // 1. حفظ الكلان مع قناة النتائج
        const newClan = await Clan.create({ 
            guildId, 
            clanName, 
            leaderId, 
            roleId, 
            resultsChannelId, 
            clanIndex: parseInt(clanIndex), 
            questions: questionsArray,
            members: [], 
            assistantIds: [] 
        });

        // 2. إرسال لوحة التقديم في "قناة التقديم" المخصصة
        const applyChannel = client.channels.cache.get(applyChannelId);
        if (applyChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ نظام التقديم | ${clanName}`)
                .setDescription("اضغط على الزر أدناه لفتح تذكرة تقديم والإجابة على الأسئلة.\n\nسيتم مراجعة طلبك من قبل الإدارة.")
                .setColor('#00ff88')
                .setThumbnail(applyChannel.guild.iconURL())
                .setFooter({ text: 'Zone System • Clans' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`apply_clan_${newClan._id}`)
                    .setLabel('تقديم الآن 📝')
                    .setStyle(ButtonStyle.Success)
            );

            await applyChannel.send({ embeds: [embed], components: [row] });
        }

        res.redirect(`/manage/${guildId}/clans`);
    } catch (err) {
        console.error("❌ Clan Save Error:", err);
        res.status(500).send("خطأ في إضافة الكلان");
    }
});



app.get('/manage/:guildId/clans/delete/:index', checkAuth, async (req, res) => {
    await Clan.deleteOne({ guildId: req.params.guildId, clanIndex: parseInt(req.params.index) });
    res.redirect(`/manage/${req.params.guildId}/clans`);
});

// --- [ Embed Sender ] ---
app.post('/send-embed/:guildId', checkAuth, async (req, res) => {
    try {
        const { chId, title, desc, color } = req.body;
        const channel = client.channels.cache.get(chId);
        if (channel) {
            const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color || '#5865F2');
            await channel.send({ embeds: [embed] });
        }
        res.redirect(`/manage/${req.params.guildId}/home`);
    } catch (err) {
        console.error("❌ Embed Send Error:", err);
        res.status(500).send(`حدث خطأ: ${err.message}`);
    }
});

// ==========================================
// 🔟 Discord Event Handlers
// ==========================================

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;

    const s = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (!s) return;

    // --- [ أمر قائمة المتصدرين المخصص ] ---
    if (s.levels?.enabled && s.levels.leaderboardCommand) {
        if (msg.content.trim() === s.levels.leaderboardCommand.trim()) {
            const topLevels = await UserLevel.find({ guildId: msg.guild.id }).sort({ level: -1, xp: -1 }).limit(15);
            if (topLevels.length === 0) return msg.reply("❌ لا توجد بيانات مستويات.");

            const embed = new EmbedBuilder()
                .setTitle(`🏆 أعلى 15 ليفل في السيرفر`)
                .setColor('#f1c40f')
                .setThumbnail(msg.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            let desc = topLevels.map((u, i) => {
                let medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**#${i + 1}**`;
                return `${medal} | <@${u.userId}> — ليفل: \`${u.level}\` (رسائل: \`${u.msgCount || 0}\`)`;
            }).join('\n');

            embed.setDescription(desc);
            return msg.reply({ embeds: [embed] });
        }
    }

    // --- [ أمر -خط ] ---
    if (msg.content === '-خط') {
        const sConfig = await GuildConfig.findOne({ guildId: msg.guild.id });
        const savedBanner = sConfig?.welcome?.bannerURL;
        if (!savedBanner) return msg.reply("⚠️ لم يتم ضبط بنر لهذا السيرفر بعد. استخدم `/setbanner` أولاً.");
        await msg.delete().catch(() => {});
        return msg.channel.send({ files: [savedBanner] });
    }

    // --- [ نظام نقاط الكلان التلقائي ] ---
    const memberClan = await Clan.findOne({ guildId: msg.guild.id, members: msg.author.id });
    if (memberClan) {
        let mData = await ClanMember.findOne({ guildId: msg.guild.id, userId: msg.author.id, clanIndex: memberClan.clanIndex });
        if (!mData) mData = new ClanMember({ guildId: msg.guild.id, userId: msg.author.id, clanIndex: memberClan.clanIndex });

        mData.msgCountForPoints++;
        if (mData.msgCountForPoints >= 30) {
            mData.msgCountForPoints = 0;
            mData.points += 20;
            memberClan.points += 20;
            await memberClan.save();
        }
        await mData.save();
    }

    // --- [ جلب بيانات العضو ] ---
    let u = await UserLevel.findOne({ guildId: msg.guild.id, userId: msg.author.id });
    if (!u) u = new UserLevel({ guildId: msg.guild.id, userId: msg.author.id });

    // --- [ تسجيل إحصائيات الرسائل ] ---
    await Stats.findOneAndUpdate(
        { guildId: msg.guild.id },
        { $inc: {
            "messages.total": 1,
            "messages.daily": 1,
            "messages.weekly": 1,
            "messages.monthly": 1,
            [`activeChannels.${msg.channel.id}`]: 1
        }},
        { upsert: true }
    ).catch(() => { });

    // --- [ نظام الحماية ] ---
    const hasBypass = msg.member.roles.cache.some(role => s.security?.bypassRoles?.includes(role.id));

    if (!hasBypass) {
        if (s.security?.badWords && s.security.badWords.trim().length > 0) {
            const forbiddenWords = s.security.badWords.split(',').map(w => w.trim());
            const hasBadWord = forbiddenWords.some(word => {
                if (word === "") return false;
                const regex = new RegExp(`(?<=^|[^أ-يa-zA-Z0-9])${word}(?=[^أ-يa-zA-Z0-9]|$)`, 'iu');
                return regex.test(msg.content);
            });
            if (hasBadWord) {
                await msg.delete().catch(() => { });
                return msg.channel.send(`⚠️ ${msg.author}، ممنوع استخدام هذه الكلمة!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        if (s.security?.badEmojis && s.security.badEmojis.trim().length > 0) {
            const forbiddenEmojis = s.security.badEmojis.split(',').map(e => e.trim());
            const hasBadEmoji = forbiddenEmojis.some(emoji => emoji !== "" && msg.content.includes(emoji));
            if (hasBadEmoji) {
                await msg.delete().catch(() => { });
                return msg.channel.send(`⚠️ ${msg.author}، هذا الإيموجي ممنوع!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        if (s.security?.antiLinks && /(https?:\/\/)/.test(msg.content)) {
            await msg.delete().catch(() => { });
            return msg.channel.send(`⚠️ ${msg.author}، الروابط ممنوعة هنا!`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }
    }

    // --- [ أمر !rolespanel ] ---
    if (msg.content === '!rolespanel') {
        const config = await GuildConfig.findOne({ guildId: msg.guild.id });
        if (!config?.rolesPanel?.length) return msg.reply("❌ ما في رتب مضافة");
        const channel = msg.guild.channels.cache.get(config.rolesChannel);
        if (!channel) return msg.reply("❌ الروم غير موجود");

        const rows = [];
        let row = new ActionRowBuilder();
        for (const r of config.rolesPanel) {
            if (r.type === "button") {
                row.addComponents(new ButtonBuilder().setCustomId(`role_${r.roleId}`).setLabel(r.label).setStyle(ButtonStyle.Secondary));
            }
            if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
        }
        if (row.components.length > 0) rows.push(row);
        channel.send({ content: "🎭 نظام الرتب", components: rows });
        msg.reply("✅ تم إرسال لوحة الرتب");
    }

    // --- [ نظام الستريك ] ---
    const sConf = await StreakConfig.findOne({ guildId: msg.guild.id });
    if (sConf && msg.member.roles.cache.has(sConf.streakRole)) {
        const now = new Date();
        const isSameDay = u.lastMessageDate && u.lastMessageDate.toDateString() === now.toDateString();

        if (!isSameDay) {
            if (u.dailyMsgs < sConf.requiredMessages) u.streakCount = 0;
            u.dailyMsgs = 0;
            u.warned = false;
        }

        if (u.dailyMsgs < sConf.requiredMessages) {
            u.dailyMsgs++;
            u.lastMessageDate = now;

            if (u.dailyMsgs === sConf.requiredMessages) {
                u.streakCount++;
                const logCh = msg.guild.channels.cache.get(sConf.streakChannel);
                if (logCh) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: `إحصائيات الستريك لـ ${msg.author.username}`, iconURL: msg.author.displayAvatarURL() })
                        .setDescription(`🔥 **عدد الأيام**\n${u.streakCount} يوم\n\n💬 **رسائل اليوم**\n${u.dailyMsgs} رسالة\n\n⌛ **ينتهي خلال**\n<t:${Math.floor((new Date(u.lastMessageDate).getTime() + 86400000) / 1000)}:R>`)
                        .setThumbnail(msg.author.displayAvatarURL({ dynamic: true }))
                        .setColor('#FFAC33')
                        .setFooter({ text: 'Zone System • استمر ولا تقطع!' })
                        .setTimestamp();
                    logCh.send({ content: `${msg.author}`, embeds: [embed] });
                }
            }
        }
        await u.save();
    }

    // --- [ أمر !ستريك ] ---
    if (msg.content.startsWith('!ستريك')) {
        const target = msg.mentions.members.first() || msg.member;
        const userData = await UserLevel.findOne({ guildId: msg.guild.id, userId: target.id });
        if (!userData) return msg.reply("❌ هذا العضو ليس لديه سجلات تفاعل بعد.");

        const expiresAt = Math.floor((new Date(userData.lastMessageDate || Date.now()).getTime() + 86400000) / 1000);
        const embed = new EmbedBuilder()
            .setAuthor({ name: `إحصائيات الستريك لـ ${target.user.username}`, iconURL: target.user.displayAvatarURL() })
            .setDescription(`🔥 **عدد الأيام**\n${userData.streakCount || 0} يوم\n\n💬 **رسائل اليوم**\n${userData.dailyMsgs || 0} رسالة\n\n⌛ **ينتهي خلال**\n<t:${expiresAt}:R>`)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .setColor('#FFAC33')
            .setFooter({ text: 'Zone System • استمر ولا تقطع!' })
            .setTimestamp();
        msg.reply({ embeds: [embed] });
    }

    // --- [ أمر !توب-ستريك ] ---
    if (msg.content.startsWith('!توب') || msg.content.startsWith('!top-streak')) {
        const topUsers = await UserLevel.find({ guildId: msg.guild.id, streakCount: { $gt: 0 } }).sort({ streakCount: -1 }).limit(10);
        if (topUsers.length === 0) return msg.reply("❌ لا يوجد متصدرين في نظام الستريك بعد.");

        const embed = new EmbedBuilder()
            .setTitle(`🏆 قائمة متصدري الستريك في ${msg.guild.name}`)
            .setColor('#FFAC33')
            .setThumbnail(msg.guild.iconURL())
            .setTimestamp();

        let description = "";
        for (let i = 0; i < topUsers.length; i++) {
            const uData = topUsers[i];
            let medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**#${i + 1}**`;
            description += `${medal} | <@${uData.userId}> — \`${uData.streakCount} يوم\`\n`;
        }

        embed.setDescription(description).setFooter({ text: "Zone System • المنافسة مشتعلة! 🔥" });
        msg.reply({ embeds: [embed] });
    }

    // --- [ الرد الآلي ] ---
    const r = s.autoReply?.find(x => x.trigger && msg.content.toLowerCase() === x.trigger.toLowerCase());
    if (r) return msg.reply(r.reply).catch(() => { });

    // --- [ نظام المستويات ] ---
    if (s.levels?.enabled) {
        u.xp += s.levels.xpPerMessage || 10;
        u.msgCount++;
        if (u.xp >= u.level * u.level * 100) {
            u.level++;
            const lvChannel = msg.guild.channels.cache.get(s.levels.levelUpChannel) || msg.channel;
            lvChannel.send(`🎉 مبروك ${msg.author}! صرت لفل **${u.level}**`).catch(() => { });
        }
        await u.save();
    }

    // --- [ أمر !setup لبانل التذاكر ] ---
    if (msg.content === '!setup' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const tConfig = await TicketConfig.findOne({ guildId: msg.guild.id });
        if (!tConfig) return msg.reply("⚠️ اضبط الإعدادات من الداشبورد أولاً!");

        const embed = new EmbedBuilder()
            .setTitle(tConfig.title || "الدعم الفني")
            .setDescription(tConfig.description || "اضغط أدناه لفتح تذكرة")
            .setColor(tConfig.color || "#5865F2");

        const files = [];
        if (tConfig.topImagePath && fs.existsSync(tConfig.topImagePath)) {
            const topName = path.basename(tConfig.topImagePath);
            files.push(new AttachmentBuilder(tConfig.topImagePath, { name: topName }));
            embed.setThumbnail(`attachment://${topName}`);
        }
        if (tConfig.bottomImagePath && fs.existsSync(tConfig.bottomImagePath)) {
            const bottomName = path.basename(tConfig.bottomImagePath);
            files.push(new AttachmentBuilder(tConfig.bottomImagePath, { name: bottomName }));
            embed.setImage(`attachment://${bottomName}`);
        }

        const components = [];
        if (Array.isArray(tConfig.buttons) && tConfig.buttons.length > 0) {
            const btnRow = new ActionRowBuilder();
            tConfig.buttons.forEach((btn, i) => {
                if (!btn.label) return;
                const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary);
                if (btn.emoji) {
                    const em = btn.emoji.trim();
                    try { button.setEmoji(/^\d+$/.test(em) ? { id: em } : em); } catch (e) { }
                }
                btnRow.addComponents(button);
            });
            if (btnRow.components.length > 0) components.push(btnRow);
        }

        if (Array.isArray(tConfig.menuOptions) && tConfig.menuOptions.length > 0) {
            const select = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('🔽 اختر من القائمة...');
            tConfig.menuOptions.forEach((opt, i) => {
                if (!opt.label) return;
                const option = { label: opt.label, value: `ticket_opt_${i}` };
                if (opt.emoji) {
                    const em = opt.emoji.trim();
                    try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) { }
                }
                select.addOptions(option);
            });
            if (select.options.length > 0) components.push(new ActionRowBuilder().addComponents(select));
        }

        if (components.length === 0) {
            components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Primary)));
        }

        return msg.channel.send({ embeds: [embed], components, files });
    }

    // --- [ أمر !profile ] ---
    if (msg.content.startsWith('!profile')) {
        const target = msg.mentions.users.first() || msg.author;
        await msg.channel.sendTyping();

        const uData = await UserLevel.findOne({ guildId: msg.guild.id, userId: target.id }) || { level: 1, xp: 0, streakCount: 0 };
        const clanData = await Clan.findOne({ guildId: msg.guild.id, members: target.id });

        const canvas = createCanvas(850, 500);
        const ctx = canvas.getContext('2d');

        const bgGradient = ctx.createLinearGradient(0, 0, 850, 500);
        bgGradient.addColorStop(0, '#0f0c29');
        bgGradient.addColorStop(0.5, '#302b63');
        bgGradient.addColorStop(1, '#24243e');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, 850, 500);

        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 830, 480);

        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 150, 90, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.clip();
        const avatar = await loadImage(target.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.drawImage(avatar, 60, 60, 180, 180);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 45px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(target.username, 270, 130);

        ctx.font = '30px Arial';
        if (clanData) {
            ctx.fillStyle = '#00ff88';
            ctx.fillText(`Clan: ${clanData.clanName}`, 270, 180);
        } else {
            ctx.fillStyle = '#ff4757';
            ctx.fillText(`No Clan Joined`, 270, 180);
        }

        function drawStatBox(x, y, label, value) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(x, y, 240, 160, 20);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 210, 255, 0.3)';
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00d2ff';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(label, x + 120, y + 50);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 50px Arial';
            ctx.fillText(value, x + 120, y + 120);
        }

        drawStatBox(50, 300, 'LEVEL', uData.level);
        drawStatBox(305, 300, 'STREAK', uData.streakCount);
        drawStatBox(560, 300, 'MESSAGES', uData.msgCount || 0);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'zone-profile.png' });
        msg.reply({ files: [attachment] });
    }

    // --- [ نظام السجن ] ---
    const modConfig = await ModConfig.findOne({ guildId: msg.guild.id });
    if (modConfig && modConfig.jail) {
        const prefix = "!";
        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === modConfig.jail.commandName.toLowerCase()) {
            if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return msg.reply("❌ عذراً، هذا الأمر مخصص للإدارة العليا فقط!");

            const target = msg.mentions.members.first();
            const timeInput = args.find(arg => /[smhdw]/.test(arg));

            if (!target || !timeInput) return msg.reply(`⚠️ الاستخدام الصحيح: \`!${command} @user 1h\``);
            if (target.id === msg.author.id) return msg.reply("❌ لا يمكنك سجن نفسك!");
            if (target.user.bot) return msg.reply("❌ لا يمكنك سجن البوتات!");

            if (msg.author.id !== msg.guild.ownerId) {
                if (target.roles.highest.position >= msg.member.roles.highest.position) {
                    return msg.reply("❌ لا يمكنك سجن شخص رتبته أعلى منك أو مساوية لرتبتك!");
                }
            }

            const durationMs = ms(timeInput);
            if (!durationMs) return msg.reply("❌ صيغة الوقت غير صحيحة (مثال: 10m, 1h, 1d)");

            const jailRole = msg.guild.roles.cache.get(modConfig.jail.roleId);
            if (!jailRole) return msg.reply("❌ رتبة السجن غير مضبوطة في الداشبورد!");

            try {
                const currentRoles = target.roles.cache.filter(r => r.id !== msg.guild.id).map(r => r.id);
                await JailData.findOneAndUpdate(
                    { guildId: msg.guild.id, userId: target.id },
                    { oldRoles: currentRoles, endAt: new Date(Date.now() + durationMs) },
                    { upsert: true }
                );

                await target.roles.set([jailRole.id]).catch(() => {
                    return msg.reply("❌ فشل سحب الرتب، تأكد أن رتبة البوت أعلى من رتبة العضو.");
                });

                msg.channel.send(`🔒 تم سجن ${target} لمدة **${timeInput}** بنجاح.`);
                setTimeout(async () => { await handleUnjail(target, msg.guild.id); }, durationMs);
            } catch (e) {
                console.error("Jail Error:", e);
                msg.reply("❌ حدث خطأ فني أثناء محاولة السجن.");
            }
        }

        if (command === (modConfig.jail.unjailCommand || 'unjail').toLowerCase()) {
            if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return msg.reply("❌ عذراً، لا تملك صلاحيات الأدمن لفك السجن!");
            }
            const target = msg.mentions.members.first();
            if (!target) return msg.reply("⚠️ يرجى منشن العضو لفك سجنه!");
            await handleUnjail(target, msg.guild.id);
            msg.channel.send(`✅ تم فك سجن ${target} واسترجاع رتبه كاملة.`);
        }
    }

    // --- [ أمر تحكم (الكلانات) ] ---
    if (msg.content === 'تحكم') {
        const myClan = await Clan.findOne({
            guildId: msg.guild.id,
            $or: [{ leaderId: msg.author.id }, { assistantIds: msg.author.id }]
        });
        if (!myClan) return msg.reply("❌ هذا الأمر مخصص لقادة الكلان ومساعديهم فقط.");

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`clan_control_${myClan.clanIndex}`)
            .setPlaceholder('⚙️ لوحة إدارة الكلان')
            .addOptions([
                { label: 'إضافة عضو', value: 'add_mem' },
                { label: 'طرد عضو', value: 'kick_mem' },
                { label: 'إضافة مساعد', value: 'add_assist' },
                { label: 'إحصائيات الكلان', value: 'show_stats' },
                { label: 'نقاط الأعضاء', value: 'show_points' }
            ]);

        msg.reply({ components: [new ActionRowBuilder().addComponents(menu)] });
    }
});

// --- [ Audit Log Events ] ---
client.on('messageDelete', async (message) => {
    if (!message.guild || !message.author) return;
    const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete }).catch(() => { });
    const executor = logs?.entries.first()?.executor;

    const embed = new EmbedBuilder()
        .setTitle("🗑️ رسالة محذوفة")
        .setColor("Red")
        .addFields(
            { name: "👤 صاحب الرسالة", value: `<@${message.author.id}>`, inline: true },
            { name: "🛡️ حذفها", value: executor ? `<@${executor.id}>` : "غير معروف", inline: true },
            { name: "📢 القناة", value: `<#${message.channel.id}>`, inline: true },
            { name: "💬 المحتوى", value: message.content || "*(لا يوجد نص)*" }
        )
        .setTimestamp();

    await sendLog(message.guild, 'messages', embed);
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const embed = new EmbedBuilder()
        .setTitle("✏️ رسالة معدلة")
        .setColor("Yellow")
        .addFields(
            { name: "👤 العضو", value: `<@${oldMsg.author.id}>`, inline: true },
            { name: "📢 القناة", value: `<#${oldMsg.channel.id}>`, inline: true },
            { name: "📝 قبل", value: oldMsg.content || "*(فارغ)*" },
            { name: "📝 بعد", value: newMsg.content || "*(فارغ)*" }
        )
        .setTimestamp();

    await sendLog(oldMsg.guild, 'messages', embed);
});
client.on('guildMemberAdd', async (member) => {
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config?.welcome?.enabled || !config.welcome.channel) return;

    const welcomeChannel = member.guild.channels.cache.get(config.welcome.channel);
    if (!welcomeChannel) return;

    try {
        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext('2d');

        // تحميل الخلفية
        let bgUrl = config.welcome.imagePath || 'https://placehold.co/800x400?text=Welcome';
        const background = await loadImage(bgUrl );
        ctx.drawImage(background, 0, 0, 800, 400);

        // إحداثيات وأبعاد صورة العضو
        const avW = config.welcome.avatarWidth || 150;
        const avH = config.welcome.avatarHeight || 150;
        const x = (config.welcome.avatarX / 100) * 800;
        const y = (config.welcome.avatarY / 100) * 400;

        ctx.save();
        ctx.beginPath();
        // استخدام ellipse لرسم شكل بيضاوي (يدعم المط)
        ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.drawImage(avatar, x - (avW / 2), y - (avH / 2), avW, avH);
        ctx.restore();

        // إطار الشكل
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // تحويل الصورة لـ Attachment
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
        
        
        // 1. تجهيز النص (تأكد إن هاد السطر موجود فوق الـ Embed)
        const welcomeMsg = (config.welcome.embedMessage || "مرحباً {member} في سيرفرنا!")
            .replace(/{member}/g, `<@${member.id}>`)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

        // 2. إنشاء الـ Embed (اللي أنت لقيته)
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`✨ عضو جديد انضم إلينا!`)
            .setDescription(welcomeMsg) // ✅ هسا صار يقرأ من المتغير اللي فوق
            .setColor('#5865F2')
            .setImage('attachment://welcome-image.png') 
            .setTimestamp()
            .setFooter({ text: `Zone System • العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });


        // إرسال الإيمباد مع الصورة
        welcomeChannel.send({ embeds: [welcomeEmbed], files: [attachment] });

    } catch (err) {
        console.error("Welcome Error:", err);
    }
});



client.on('guildMemberRemove', async (member) => {
    const embed = new EmbedBuilder()
        .setTitle("❌ عضو غادر")
        .setColor("Red")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields({ name: "👤 العضو", value: `${member.user.tag} (<@${member.id}>)`, inline: true })
        .setTimestamp();
    await sendLog(member.guild, 'members', embed);
    await Stats.findOneAndUpdate({ guildId: member.guild.id }, { $push: { "membersLog.left": new Date() } }, { upsert: true });
});

client.on('guildBanAdd', async (ban) => {
    const executor = await getExecutor(ban.guild, AuditLogEvent.MemberBan);
    const embed = new EmbedBuilder()
        .setTitle("🔨 عضو محظور")
        .setColor("DarkRed")
        .addFields(
            { name: "👤 العضو", value: `${ban.user.tag}`, inline: true },
            { name: "🛡️ بواسطة", value: executor, inline: true }
        )
        .setTimestamp();
    await sendLog(ban.guild, 'moderation', embed);
    await Stats.findOneAndUpdate({ guildId: ban.guild.id }, { $inc: { "modActions.bans": 1 } }, { upsert: true });
});

client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle("📢 قناة جديدة")
        .setColor("Blue")
        .addFields({ name: "القناة", value: `${channel.name} (<#${channel.id}>)` })
        .setTimestamp();
    await sendLog(channel.guild, 'channels', embed);
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle("🗑️ قناة محذوفة")
        .setColor("DarkRed")
        .addFields({ name: "القناة", value: channel.name })
        .setTimestamp();
    await sendLog(channel.guild, 'channels', embed);
});

client.on('roleCreate', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle("🎭 رتبة جديدة")
        .setColor("Green")
        .addFields({ name: "الرتبة", value: role.name })
        .setTimestamp();
    await sendLog(role.guild, 'roles', embed);
});

client.on('roleDelete', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle("🗑️ رتبة محذوفة")
        .setColor("Red")
        .addFields({ name: "الرتبة", value: role.name })
        .setTimestamp();
    await sendLog(role.guild, 'roles', embed);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = oldState.guild || newState.guild;
    if (!guild) return;

    let embed;
    if (!oldState.channel && newState.channel) {
        embed = new EmbedBuilder().setTitle("🎙️ دخل روم صوتي").setColor("Green")
            .addFields({ name: "👤 العضو", value: `<@${newState.member.id}>`, inline: true }, { name: "📢 الروم", value: newState.channel.name, inline: true })
            .setTimestamp();
    } else if (oldState.channel && !newState.channel) {
        embed = new EmbedBuilder().setTitle("🔇 غادر روم صوتي").setColor("Red")
            .addFields({ name: "👤 العضو", value: `<@${oldState.member.id}>`, inline: true }, { name: "📢 الروم", value: oldState.channel.name, inline: true })
            .setTimestamp();
    }

    if (embed) await sendLog(guild, 'voice', embed);
});

// ==========================================
// 1️⃣1️⃣ Interaction Handler
// ==========================================
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.guild) return;

        // --- [ Slash Commands ] ---
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setbanner') {
                const image = interaction.options.getAttachment('image');
                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { $set: { "welcome.bannerURL": image.url } },
                    { upsert: true }
                );
                return interaction.reply({ content: '✅ تم حفظ البنر بنجاح في قاعدة البيانات', ephemeral: true });
            }

            if (interaction.commandName === 'rename_panel') {
                const name = interaction.options.getString('name');
                const image = interaction.options.getAttachment('image');
                const embed = new EmbedBuilder()
                    .setTitle('📌 تغيير الاسم')
                    .setDescription(`اضغط على الزر لتغيير اسمك إلى: **${name}**`)
                    .setColor('#5865F2');
                if (image) embed.setImage(image.url);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rename_user:${name}`).setLabel('✏️ تغيير الاسم').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('reset_name').setLabel('🔄 ارجاع الاسم').setStyle(ButtonStyle.Secondary)
                );

                await interaction.channel.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: "✅ تم إرسال اللوحة", ephemeral: true });
            }
        }

        // --- [ Ticket Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return interaction.reply({ content: "⚠️ لم يتم العثور على إعدادات التذاكر.", ephemeral: true });
            await openTicket(interaction, tConfig, interaction.values[0]);
            return;
        }

        // --- [ Clan Control Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('clan_control_')) {
            const clanIdx = parseInt(interaction.customId.split('_')[2]);
            const action = interaction.values[0];
            const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: clanIdx });
            if (!clan) return interaction.reply({ content: "❌ لم يتم العثور على الكلان.", ephemeral: true });

            if (action === 'show_stats' || action === 'show_points') {
                await interaction.deferReply({ ephemeral: true });
                if (action === 'show_stats') {
                    const assistants = clan.assistantIds?.map(id => `<@${id}>`).join(', ') || 'لا يوجد';
                    const members = clan.members?.map(id => `<@${id}>`).join(', ') || 'لا يوجد';
                    const embed = new EmbedBuilder()
                        .setTitle(`🚩 إحصائيات كلان: ${clan.clanName}`)
                        .setColor('#00d2ff')
                        .addFields(
                            { name: '👑 القائد', value: `<@${clan.leaderId}>`, inline: true },
                            { name: '🥈 المساعدين', value: assistants, inline: false },
                            { name: '👥 الأعضاء', value: `${clan.members?.length || 0}/10`, inline: true },
                            { name: '📍 قائمة المنشن', value: members }
                        );
                    return interaction.editReply({ embeds: [embed] });
                }
                if (action === 'show_points') {
                    const membersData = await ClanMember.find({ guildId: interaction.guild.id, clanIndex: clanIdx }).sort({ points: -1 });
                    let list = membersData.map((m, i) => `**#${i + 1}** <@${m.userId}> — \`${m.points}\` نقطة`).join('\n') || 'لا توجد نقاط.';
                    const embed = new EmbedBuilder()
                        .setTitle(`🏆 ترتيب نقاط: ${clan.clanName}`)
                        .setDescription(`**إجمالي النقاط:** \`${clan.points}\`\n\n${list}`)
                        .setColor('Gold');
                    return interaction.editReply({ embeds: [embed] });
                }
            }

            const modal = new ModalBuilder().setCustomId(`modal_clan:${action}:${clanIdx}`).setTitle('إدارة الكلان');
            const idInput = new TextInputBuilder().setCustomId('user_id').setLabel('أدخل ID العضو:').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(idInput));
            return interaction.showModal(modal);
        }

        // --- [ Clan Modal Submit ] ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_clan:')) {
            try {
                await interaction.deferReply({ ephemeral: true });
                const [_, action, clanIdx] = interaction.customId.split(':');
                const targetId = interaction.fields.getTextInputValue('user_id')?.trim();
                const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: parseInt(clanIdx) });
                if (!clan) return interaction.editReply("❌ الكلان غير موجود.");

                if (!Array.isArray(clan.members)) clan.members = [];
                if (!Array.isArray(clan.assistantIds)) clan.assistantIds = [];

                if (action === 'add_mem') {
                    if (clan.members.length >= 10) return interaction.editReply("❌ الكلان ممتلئ.");
                    if (clan.members.includes(targetId)) return interaction.editReply("⚠️ العضو موجود بالفعل.");
                    clan.members.push(targetId);
                    await clan.save();
                    return interaction.editReply(`✅ تمت إضافة <@${targetId}> للكلان.`);
                }
                if (action === 'kick_mem') {
                    clan.members = clan.members.filter(id => id !== targetId);
                    await clan.save();
                    return interaction.editReply(`❌ تم طرد <@${targetId}> من الكلان.`);
                }
                if (action === 'add_assist') {
                    if (clan.assistantIds.length >=
 3) return interaction.editReply("❌ الحد الأقصى 3 مساعدين.");
                    if (clan.assistantIds.includes(targetId)) return interaction.editReply("⚠️ العضو مساعد بالفعل.");
                    clan.assistantIds.push(targetId);
                    await clan.save();
                    return interaction.editReply(`✅ تم تعيين <@${targetId}> كمساعد للكلان.`);
                }
            } catch (err) {
                console.error(err);
                return interaction.editReply("❌ حدث خطأ فني، تأكد من صحة البيانات.");
            }
        }

        // --- [ Clan Apply Button ] ---
        if (interaction.isButton() && interaction.customId.startsWith('apply_clan_')) {
            const clanIdx = parseInt(interaction.customId.split('_')[2]);

            const thread = await interaction.channel.threads.create({
                name: `مقابلة-${interaction.user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                reason: 'تقديم كلان بنظام المقابلة التلقائي',
            });

            await thread.members.add(interaction.user.id);
            await interaction.reply({ content: `✅ أهلاً بك! تم فتح غرفة المقابلة الخاصة بك هنا: ${thread}`, ephemeral: true });

            const questions = [
                "ما هو اسمك وعمرك؟",
                "كم ساعة تقريباً تتواجد في الرومات الصوتية يومياً؟",
                "كم مدة تواجدك في السيرفر؟"
            ];

            let answers = [];
            let currentStep = 0;
            const currentClanIdx = clanIdx;

            await thread.send(`مرحباً ${interaction.user}، بدأت المقابلة.\n\n**السؤال الأول:** ${questions[currentStep]}`);

            const collector = thread.createMessageCollector({
                filter: m => m.author.id === interaction.user.id,
                time: 600000
            });

            collector.on('collect', async m => {
                answers.push(m.content);
                currentStep++;
                if (currentStep < questions.length) {
                    await thread.send(`**السؤال التالي:** ${questions[currentStep]}`);
                } else {
                    collector.stop('finished');
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'finished') {
                    try {
                        await thread.send("✅ **يعطيك العافية، انتهت المقابلة. جارٍ إرسال طلبك وإغلاق الروم...**");

                        const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: currentClanIdx });
                        if (clan && clan.resultsChannelId) {
                            const resChannel = interaction.guild.channels.cache.get(clan.resultsChannelId) ||
                                await interaction.guild.channels.fetch(clan.resultsChannelId).catch(() => null);

                            if (resChannel) {
                                const embed = new EmbedBuilder()
                                    .setTitle(`📩 طلب انضمام جديد - كلان: ${clan.clanName || 'غير محدد'}`)
                                    .setColor('#00d2ff')
                                    .setThumbnail(interaction.user.displayAvatarURL())
                                    .addFields(
                                        { name: '👤 المتقدم', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                        { name: '📝 الأجوبة', value: answers.map((a, i) => `**${i + 1}-** ${a}`).join('\n') }
                                    )
                                    .setTimestamp();

                                const row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`accept_member:${interaction.user.id}:${currentClanIdx}`)
                                        .setLabel('✅ قبول')
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId(`reject_member:${interaction.user.id}:${currentClanIdx}`)
                                        .setLabel('❌ رفض')
                                        .setStyle(ButtonStyle.Danger)
                                );

                                await resChannel.send({
                                    content: `🔔 تقديم جديد للقائد: <@${clan.leaderId}>`,
                                    embeds: [embed],
                                    components: [row]
                                });
                            }
                        }

                        setTimeout(() => { thread.delete().catch(() => { }); }, 3000);
                    } catch (err) {
                        console.error("❌ Error sending clan application:", err);
                    }
                } else if (reason === 'time') {
                    await thread.send("⚠️ انتهى الوقت المخصص للمقابلة، سيتم إغلاق الروم.");
                    setTimeout(() => thread.delete().catch(() => { }), 5000);
                }
            });

            return;
        }

        // --- [ Accept / Reject Clan Member ] ---
        if (interaction.isButton() && (interaction.customId.startsWith('accept_member:') || interaction.customId.startsWith('reject_member:'))) {
            const [action, targetId, clanIdx] = interaction.customId.split(':');
            const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: parseInt(clanIdx) });
            if (!clan) return interaction.reply({ content: "❌ الكلان غير موجود.", ephemeral: true });

            if (interaction.user.id !== clan.leaderId) {
                return interaction.reply({ content: "❌ أنت لست قائد هذا الكلان!", ephemeral: true });
            }

            await interaction.deferUpdate();
            const targetUser = await client.users.fetch(targetId).catch(() => null);

            if (action === 'accept_member') {
                if (clan.members.length >= 10) return interaction.followUp({ content: "❌ الكلان ممتلئ!", ephemeral: true });
                if (!clan.members.includes(targetId)) {
                    clan.members.push(targetId);
                    await clan.save();
                }
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (member && clan.roleId) await member.roles.add(clan.roleId).catch(() => { });
                if (targetUser) targetUser.send(`✅ مبروك! تم قبولك في كلان **${clan.clanName}**`).catch(() => { });
                await interaction.editReply({ content: `✅ تم قبول <@${targetId}> بنجاح.`, components: [], embeds: interaction.message.embeds });
            } else if (action === 'reject_member') {
                if (targetUser) targetUser.send(`❌ للأسف، تم رفض طلب انضمامك لكلان **${clan.clanName}**`).catch(() => { });
                await interaction.editReply({ content: `❌ تم رفض <@${targetId}>.`, components: [], embeds: interaction.message.embeds });
            }
            return;
        }

        // --- [ Self Roles ] ---
        if (interaction.isButton() && interaction.customId.startsWith('role_')) {
            try {
                const roleId = interaction.customId.replace('role_', '');
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: "❌ الرتبة غير موجودة.", ephemeral: true });

                const guildData = await GuildConfig.findOne({ guildId: interaction.guild.id });
                const allPanelRoles = (guildData?.rolesPanel || []).map(r => r.roleId);

                if (interaction.member.roles.cache.has(roleId)) {
                    await interaction.member.roles.remove(roleId).catch(() => { });
                    return interaction.reply({ content: `❌ تم سحب رتبة **${role.name}** منك.`, ephemeral: true });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({ content: "⚠️ رتبة البوت أقل من الرتبة المطلوبة.", ephemeral: true });
                }

                if (allPanelRoles.length > 0) {
                    const rolesToRemove = interaction.member.roles.cache.filter(r => allPanelRoles.includes(r.id));
                    if (rolesToRemove.size > 0) await interaction.member.roles.remove(rolesToRemove).catch(() => { });
                }

                await interaction.member.roles.add(roleId);
                return interaction.reply({ content: `✅ تم إعطاؤك رتبة **${role.name}**.`, ephemeral: true });
            } catch (err) {
                console.error("Role Error:", err);
                if (!interaction.replied) interaction.reply({ content: "❌ حدث خطأ، جرب مرة أخرى.", ephemeral: true });
            }
        }

        // --- [ Rename Buttons ] ---
        if (interaction.isButton() && interaction.customId.startsWith('rename_user:')) {
            const newName = interaction.customId.split(':')[1];
            const setResult = await interaction.member.setNickname(newName).catch(() => null);
            if (!setResult) return interaction.reply({ content: "❌ ما بقدر أغير الاسم (تأكد من صلاحياتي)", ephemeral: true });
            return interaction.reply({ content: `✅ تم تغيير اسمك إلى: ${newName}`, ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId === 'reset_name') {
            const setResult = await interaction.member.setNickname(null).catch(() => null);
            if (!setResult) return interaction.reply({ content: "❌ ما بقدر أرجع الاسم", ephemeral: true });
            return interaction.reply({ content: "🔄 تم ارجاع اسمك", ephemeral: true });
        }

        // --- [ Ticket Buttons (open_ticket / ticket_btn_*) ] ---
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

        // --- [ Ticket Control Buttons (close/claim) ] ---
        if (interaction.isButton() && ['close_ticket', 'claim_ticket'].includes(interaction.customId)) {
            const ticket = await TicketData.findOne({ channelId: interaction.channel.id });
            if (!ticket) return;

            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return;

            const isAdmin = interaction.member.roles.cache.has(tConfig.adminRole);
            if (!isAdmin) return interaction.reply({ content: "❌ هذه الأزرار مخصصة للإدارة فقط!", ephemeral: true });

            if (interaction.customId === 'close_ticket') {
                ticket.closedAt = new Date();
                ticket.closedBy = interaction.user.id;
                await ticket.save();

                const owner = await client.users.fetch(ticket.ownerId).catch(() => null);
                if (owner) {
                    const statsEmbed = new EmbedBuilder()
                        .setTitle('📊 سجل إغلاق التذكرة')
                        .setColor('#ff4757')
                        .setThumbnail(interaction.guild.iconURL())
                        .addFields(
                            { name: '👤 صاحب التكت:', value: `<@${ticket.ownerId}>`, inline: true },
                            { name: '📌 المُستلم:', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'لم تُستلم', inline: true },
                            { name: '🔒 أُغلقت بواسطة:', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '⏰ وقت الفتح:', value: `<t:${Math.floor(new Date(ticket.openedAt).getTime() / 1000)}:F>`, inline: false },
                            { name: '⌛ وقت الإغلاق:', value: `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:F>`, inline: false }
                        )
                        .setFooter({ text: 'Zone System Stats' });
                    await owner.send({ embeds: [statsEmbed] }).catch(() => { });
                }

                await interaction.reply("🔒 تم تسجيل البيانات، سيتم حذف الروم خلال 5 ثوانٍ...");
                setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
            }
        }

        // --- [ Ticket Control Select Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_menu') {
            const selected = interaction.values[0];
            const ticket = await TicketData.findOne({ channelId: interaction.channel.id });
            if (!ticket) return interaction.reply({ content: "❌ لم يتم العثور على بيانات التكت.", ephemeral: true });

            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return;

            const isAdmin = interaction.member.roles.cache.has(tConfig.adminRole);
            const adminPermissions = ['claim_ticket', 'close_ticket', 'add_member', 'remove_member', 'summon_member'];

            if (!isAdmin && adminPermissions.includes(selected)) {
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
                setTimeout(() => { interaction.channel.delete().catch(() => { }); }, 5000);
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

        // --- [ User Select Menus (Add/Remove from Ticket) ] ---
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

    } catch (err) {
        console.error("❌ Interaction Error:", err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: "❌ حدث خطأ غير متوقع.", ephemeral: true }).catch(() => { });
        }
    }
});

// ==========================================
// 1️⃣2️⃣ openTicket Helper Function
// ==========================================
async function openTicket(interaction, config, type) {
    try {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

        // FIX: استخدام $inc لتحديث عداد التذاكر بشكل صحيح
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

// 1. تجهيز وتنظيف كود اللون أولاً
let embedColor = config.color || "#5865F2";
if (typeof embedColor === 'string') {
    embedColor = embedColor.trim();
    // إصلاح مشكلة الهاشتاج إذا كان في النهاية
    if (embedColor.endsWith('#')) embedColor = '#' + embedColor.slice(0, -1);
    // التأكد أن اللون يبدأ بهاشتاج واحد فقط
    if (!embedColor.startsWith('#')) embedColor = '#' + embedColor;
}

// 2. بناء الإيمباد باستخدام اللون الجاهز
const embed = new EmbedBuilder()
    .setTitle("🎫 تذكرتك الجديدة")
    .setDescription(`مرحباً ${interaction.user}\nتم فتح التكت بنجاح\n\n📌 النوع: **${type}**`)
    .setColor(embedColor) // استخدام اللون بعد تنظيفه
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
            await interaction.editReply("❌ حدث خطأ تقني أثناء فتح التكت.").catch(() => { });
        }
    }
}

// ==========================================
// 1️⃣3️⃣ Slash Commands Registration
// ==========================================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Slash commands registered globally.');
    } catch (err) {
        console.error('❌ Error registering slash commands:', err);
    }
});

// ==========================================
// 1️⃣4️⃣ Kick.com Live Checker (Polling)
// ==========================================
setInterval(async () => {
    const allConfigs = await KickConfig.find({});
    for (const config of allConfigs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;

        for (const streamer of config.streamers) {
            try {
                const response = await axios.get(`https://kick.com/api/v1/channels/${streamer.kickUsername}`, {
                    headers: { 'Accept': 'application/json' },
                    timeout: 5000
                });
                const isLive = response.data?.livestream !== null && response.data?.livestream !== undefined;

                if (isLive && !streamer.isLive) {
                    streamer.isLive = true;
                    const channel = guild.channels.cache.get(streamer.channelId);
                    if (channel) {
                        const msg = (streamer.customMessage || '🔴 **%name%** بدأ البث الآن!').replace('%name%', streamer.kickUsername);
                        const mention = streamer.roleId ? `<@&${streamer.roleId}> ` : '';
                        channel.send(`${mention}${msg}\nhttps://kick.com/${streamer.kickUsername}`);
                    }
                } else if (!isLive && streamer.isLive) {
                    streamer.isLive = false;
                }
            } catch (e) {
                // Silently handle API errors
            }
        }
        await config.save();
    }
}, 60000);

// ==========================================
// 1️⃣5️⃣ Giveaway Checker
// ==========================================
setInterval(async () => {
    const now = new Date();
    const endedGiveaways = await Giveaway.find({ ended: false, endAt: { $lte: now } });

    for (const gw of endedGiveaways) {
        try {
            const guild = client.guilds.cache.get(gw.guildId);
            if (!guild) continue;

            const channel = guild.channels.cache.get(gw.channelId);
            if (!channel) continue;

            const message = await channel.messages.fetch(gw.messageId).catch(() => null);
            if (!message) continue;

            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) continue;

            const users = await reaction.users.fetch();
            const eligible = users.filter(u => !u.bot).map(u => u.id);

            if (eligible.length === 0) {
                channel.send(`🎉 القيف اواي انتهى ولكن لم يشترك أحد! **${gw.prize}**`);
            } else {
                const winners = [];
                const shuffled = eligible.sort(() => Math.random() - 0.5);
                for (let i = 0; i < Math.min(gw.winnersCount, shuffled.length); i++) {
                    winners.push(`<@${shuffled[i]}>`);
                }
                channel.send(`🎉 **انتهى القيف اواي!**\nالجائزة: **${gw.prize}**\nالفائزون: ${winners.join(', ')}`);
            }

            gw.ended = true;
            await gw.save();
        } catch (err) {
            console.error("Giveaway Error:", err);
        }
    }
}, 30000);

// ==========================================
// 1️⃣6️⃣ Streak Warning & Reset (Daily Check)
// ==========================================
setInterval(async () => {
    const allUsers = await UserLevel.find({});
    for (const u of allUsers) {
        if (!u.lastMessageDate) continue;

        const now = Date.now();
        const last = new Date(u.lastMessageDate).getTime();
        const diff = now - last;
        const fullDay = 24 * 60 * 60 * 1000;
        const warnTime = 17 * 60 * 60 * 1000;

        if (diff >= warnTime && diff < fullDay && !u.warned) {
            const guild = client.guilds.cache.get(u.guildId);
            if (!guild) continue;

            try {
                const member = await guild.members.fetch(u.userId).catch(() => null);
                if (member) {
                    const embed = new EmbedBuilder()
                        .setTitle("⏰ تنبيه التفاعل اليومي")
                        .setDescription(`أهلاً بك! متبقي **7 ساعات** فقط لتجديد تفاعلك اليومي.\n\n🔥 الستريك الحالي: **${u.streakCount}** يوم.\n\n💬 اكتب رسالة الآن للحفاظ على نشاطك!`)
                        .setColor('#5865F2')
                        .setFooter({ text: 'نظام التفاعل التلقائي • Zone System' })
                        .setTimestamp();

                    await member.send({ embeds: [embed] }).catch(() => { });
                    u.warned = true;
                    await u.save();
                }
            } catch (e) {
                console.error("Warning Error:", e.message);
            }
        }

        if (diff >= fullDay) {
            u.streakCount = 0;
            u.dailyMsgs = 0;
            u.warned = false;
            await u.save();
        }
    }
}, 60000);

// ==========================================
// 1️⃣7️⃣ Voice Points for Clans
// ==========================================
setInterval(async () => {
    client.guilds.cache.forEach(async (guild) => {
        guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).forEach(async (channel) => {
            channel.members.forEach(async (member) => {
                if (member.user.bot || member.voice.selfDeaf || member.voice.serverDeaf) return;

                const memberClan = await Clan.findOne({ guildId: guild.id, members: { $in: [member.id] } });
                if (memberClan) {
                    let mData = await ClanMember.findOne({ guildId: guild.id, userId: member.id, clanIndex: memberClan.clanIndex });
                    if (!mData) mData = new ClanMember({ guildId: guild.id, userId: member.id, clanIndex: memberClan.clanIndex });

                    mData.voiceMinutes = (mData.voiceMinutes || 0) + 1;

                    if (mData.voiceMinutes >= 30) {
                        mData.voiceMinutes = 0;
                        mData.points += 20;
                        memberClan.points += 20;
                        await memberClan.save();
                    }
                    await mData.save();
                }
            });
        });
    });
}, 60000);
async function sendClanApplyEmbed(channel, clan) {
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ نظام التقديم | ${clan.clanName}`)
        .setDescription("اضغط على الزر أدناه لفتح تذكرة تقديم والإجابة على الأسئلة.")
        .setColor('#5865F2');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`apply_clan_${clan._id}`).setLabel('تقديم الآن').setStyle(ButtonStyle.Success)
    );
    await channel.send({ embeds: [embed], components: [row] });
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('apply_clan_')) {
        const clanId = interaction.customId.replace('apply_clan_', '');
        const clan = await Clan.findById(clanId);
        const thread = await interaction.channel.threads.create({
            name: `تقديم-${clan.clanName}-${interaction.user.username}`,
            autoArchiveDuration: 60,
            type: 11,
        });
        await thread.members.add(interaction.user.id);
        await interaction.reply({ content: `تم فتح قناة التقديم: ${thread}`, ephemeral: true });
        askNextQuestion(thread, interaction.user, clan, 0);
    }
    if (interaction.customId.startsWith('conf_')) {
        const [_, status, clanId, qIndex] = interaction.customId.split('_');
        const clan = await Clan.findById(clanId);
        await interaction.message.delete();
        if (status === 'yes') askNextQuestion(interaction.channel, interaction.user, clan, parseInt(qIndex) + 1);
        else askNextQuestion(interaction.channel, interaction.user, clan, parseInt(qIndex));
    }
});

async function askNextQuestion(thread, user, clan, index) {
    if (index >= clan.questions.length) return thread.send(`✅ تم الانتهاء!`);
    await thread.send(`**السؤال (${index + 1}):** ${clan.questions[index]}`);
    const collector = thread.createMessageCollector({ filter: m => m.author.id === user.id, max: 1, time: 300000 });
    collector.on('collect', async m => {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`conf_yes_${clan._id}_${index}`).setLabel('✅ تأكيد').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`conf_no_${clan._id}_${index}`).setLabel('❌ إعادة').setStyle(ButtonStyle.Danger)
        );
        await thread.send({ content: `إجابتك: **${m.content}**\nهل تريد التأكيد؟`, components: [row] });
    });
}

// ==========================================
// 1️⃣8️⃣ Startup
// ==========================================
process.on('unhandledRejection', err => console.error("❌ Unhandled Rejection:", err));
process.on('uncaughtException', err => console.error("❌ Uncaught Exception:", err));

app.listen(PORT, () => {
    console.log(`🚀 Dashboard running at http://localhost:${PORT}`);
});

client.login(process.env.TOKEN);
