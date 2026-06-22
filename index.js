// ==========================================
// VORTEX SYSTEM BOT - Full Version
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
    ModalBuilder, TextInputBuilder, TextInputStyle, ActivityType,
    REST, Routes, SlashCommandBuilder, MessageFlags
} = require('discord.js');

// ==========================================
// 1. تعريف الـ Schemas (قاعدة البيانات)
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
    ticketType: { type: String, default: 'تذكرة دعم' },
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
        embedMessage: { type: String, default: "مرحباً بك {member} في سيرفر {guild}!" },
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
    questions: { type: [String], default: [] }
}));

const ClanMember = mongoose.model('ClanMember', new mongoose.Schema({
    guildId: String,
    userId: String,
    clanIndex: Number,
    points: { type: Number, default: 0 },
    msgCountForPoints: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 }
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
    ticketCount: { type: Number, default: 0 },
    buttons: [{ label: String, emoji: String }],
    menuOptions: [{ label: String, emoji: String }]
}));

// ==========================================
// 2. Express App Setup
// ==========================================
const app = express();
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json());
app.set('trust proxy', 1);
app.set('view engine', 'ejs');

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 3. تعريف الـ Client
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
// 4. اتصال قاعدة البيانات
// ==========================================
mongoose.connect(process.env.MONGO_CONNECTION_STRING)
    .then(() => console.log('[DB] Connected to MongoDB'))
    .catch(err => console.log('[DB] Connection Error:', err));

// ==========================================
// 5. الدوال المساعدة
// ==========================================
async function sendLog(guild, type, embed) {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config?.logs) return;
    const logChannelId = config.logs[type]?.channel;
    const enabled = config.logs[type]?.enabled;
    if (!enabled || !logChannelId) return;
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function getExecutor(guild, actionType) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 1, type: actionType });
        const entry = logs.entries.first();
        if (!entry) return 'غير معروف';
        return `<@${entry.executor.id}>`;
    } catch {
        return 'غير معروف';
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
            await member.roles.remove(modConfig.jail.roleId).catch(() => {});
        }

        for (const roleId of rolesToRestore) {
            await member.roles.add(roleId).catch(() => {});
        }

        await JailData.deleteOne({ guildId, userId: member.id });

        const jailChannel = guild.channels.cache.get(modConfig?.jail?.channelId);
        if (jailChannel) {
            const embed = new EmbedBuilder()
                .setTitle('فك السجن')
                .setDescription(`تم فك سجن <@${member.id}> وتم استرجاع رتبه بنجاح.`)
                .setColor(0x00ff88)
                .setTimestamp();
            jailChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[Unjail Error]', err);
    }
}

// ==========================================
// 6. Upload Setup
// ==========================================
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ==========================================
// 7. Auth Setup
// ==========================================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));


const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.CLIENT_SECRET || '').trim();
const CALLBACK_URL = (process.env.CALLBACK_URL || '').trim();

passport.use(new Strategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    proxy: true,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'vortex-ultra-secret-2024',
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
app.get('/callback', (req, res, next) => {
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            console.error('[OAuth Error Detail]:', err);
            return res.status(500).send(`
                <div dir='rtl' style='background:#111;color:#fff;padding:40px;font-family:sans-serif;text-align:center;'>
                    <h1 style='color:#ff4444;'>فشل استلام البيانات من ديسكورد</h1>
                    <p>هذا يعني أن الـ <b>Client Secret</b> أو الـ <b>Callback URL</b> غير صحيح في إعدادات Render.</p>
                    <div style='background:#222;padding:20px;border-radius:10px;text-align:left;display:inline-block;'>
                        <code>${JSON.stringify(err, null, 2)}</code>
                    </div>
                    <p><a href='/login' style='color:#1e90ff;'>الرجوع لمحاولة تسجيل الدخول</a></p>
                </div>
            `);
        }
        if (!user) return res.redirect('/login');
        req.logIn(user, (err) => {
            if (err) return next(err);
            res.redirect('/dashboard');
        });
    })(req, res, next);
});

app.get('/logout', (req, res) => {
    req.logout(() => { res.redirect('/login'); });
});

app.get('/login', (req, res) => {
    res.send(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VORTEX - تسجيل الدخول</title>
    <link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;500;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --blue: #1e90ff;
            --blue-dark: #0a6ecc;
            --red: #e63946;
            --red-light: #ff6b6b;
            --black: #050508;
            --dark: #0d0d18;
            --card: rgba(10, 10, 25, 0.85);
            --border: rgba(30, 144, 255, 0.25);
        }
        body {
            font-family: 'Changa', sans-serif;
            background: var(--black);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }
        .bg-particles {
            position: fixed; inset: 0; z-index: 0;
            background: radial-gradient(ellipse at 20% 50%, rgba(30,144,255,0.08) 0%, transparent 60%),
                        radial-gradient(ellipse at 80% 20%, rgba(230,57,70,0.06) 0%, transparent 50%),
                        radial-gradient(ellipse at 50% 80%, rgba(30,144,255,0.05) 0%, transparent 50%);
        }
        .grid-bg {
            position: fixed; inset: 0; z-index: 0;
            background-image: linear-gradient(rgba(30,144,255,0.04) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(30,144,255,0.04) 1px, transparent 1px);
            background-size: 50px 50px;
        }
        .login-wrapper {
            position: relative; z-index: 10;
            display: flex; flex-direction: column; align-items: center; gap: 30px;
        }
        .logo-area {
            text-align: center;
        }
        .logo-text {
            font-size: 64px; font-weight: 800; letter-spacing: 8px;
            background: linear-gradient(135deg, var(--blue), #ffffff, var(--red));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 30px rgba(30,144,255,0.4));
            animation: logoGlow 3s ease-in-out infinite alternate;
        }
        @keyframes logoGlow {
            from { filter: drop-shadow(0 0 20px rgba(30,144,255,0.3)); }
            to   { filter: drop-shadow(0 0 50px rgba(30,144,255,0.7)); }
        }
        .logo-sub {
            color: rgba(255,255,255,0.4); font-size: 14px; letter-spacing: 4px; margin-top: 5px;
        }
        .login-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 50px 60px;
            text-align: center;
            backdrop-filter: blur(30px);
            box-shadow: 0 0 60px rgba(30,144,255,0.1), 0 0 120px rgba(0,0,0,0.5);
            min-width: 380px;
            position: relative;
            overflow: hidden;
        }
        .login-card::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, var(--blue), var(--red), transparent);
            animation: scanLine 3s linear infinite;
        }
        @keyframes scanLine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .login-card h2 { color: white; font-size: 22px; margin-bottom: 8px; }
        .login-card p { color: rgba(255,255,255,0.45); font-size: 14px; margin-bottom: 35px; }
        .btn-discord {
            display: inline-flex; align-items: center; gap: 12px;
            background: linear-gradient(135deg, var(--blue), var(--blue-dark));
            color: white; padding: 16px 40px; border-radius: 14px;
            text-decoration: none; font-weight: 700; font-size: 16px;
            transition: all 0.3s; border: 1px solid rgba(30,144,255,0.3);
            box-shadow: 0 8px 30px rgba(30,144,255,0.3);
        }
        .btn-discord:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(30,144,255,0.5);
            filter: brightness(1.1);
        }
    </style>
</head>
<body>
    <div class="bg-particles"></div>
    <div class="grid-bg"></div>
    <div class="login-wrapper">
        <div class="logo-area">
            <div class="logo-text">VORTEX</div>
            <div class="logo-sub">DISCORD BOT SYSTEM</div>
        </div>
        <div class="login-card">
            <h2>مرحباً بك</h2>
            <p>سجل دخولك عبر حساب ديسكورد للوصول للداشبورد</p>
            <a href="/auth/discord" class="btn-discord">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                تسجيل الدخول بديسكورد
            </a>
        </div>
    </div>
</body>
</html>`);
});

app.get('/ping', (req, res) => res.send('I am alive!'));
app.get('/', (req, res) => res.redirect('/dashboard'));

// ==========================================
// 8. UI Helper Function
// ==========================================
function ui(guild, active, content) {
    const showNav = guild.id ? 'flex' : 'none';
    const guildName = guild.name || 'قائمة السيرفرات';

    const navItems = guild.id ? `
        <a class="${active === 'home' ? 'active' : ''}" href="/manage/${guild.id}/home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            الإحصائيات
        </a>
        <a class="${active === 'security' ? 'active' : ''}" href="/manage/${guild.id}/security">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            الحماية
        </a>
        <a class="${active === 'kick' ? 'active' : ''}" href="/manage/${guild.id}/kick">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="var(--dark)"/></svg>
            تنبيهات Kick
        </a>
        <a class="${active === 'streaks' ? 'active' : ''}" href="/manage/${guild.id}/streaks">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            الستريك
        </a>
        <a class="${active === 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            اللوق
        </a>
        <a class="${active === 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>
            التذاكر
        </a>
        <a class="${active === 'autoreply' ? 'active' : ''}" href="/manage/${guild.id}/autoreply">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            الرد الآلي
        </a>
        <a class="${active === 'levels' ? 'active' : ''}" href="/manage/${guild.id}/levels">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>
            المستويات
        </a>
        <a class="${active === 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            الترحيب
        </a>
        <a class="${active === 'giveaway' ? 'active' : ''}" href="/manage/${guild.id}/giveaway">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
            القيف اواي
        </a>
        <a class="${active === 'roles' ? 'active' : ''}" href="/manage/${guild.id}/roles">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            الرتب
        </a>
        <a class="${active === 'mod' ? 'active' : ''}" href="/manage/${guild.id}/mod">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            أوامر الإشراف
        </a>
        <a class="${active === 'clans' ? 'active' : ''}" href="/manage/${guild.id}/clans">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            نظام الكلانات
        </a>
    ` : '';

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VORTEX Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;500;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --blue: #1e90ff;
            --blue-dark: #0a6ecc;
            --blue-glow: rgba(30,144,255,0.15);
            --red: #e63946;
            --red-light: #ff6b6b;
            --red-glow: rgba(230,57,70,0.12);
            --black: #050508;
            --dark: #0a0a14;
            --darker: #07070f;
            --card: rgba(10,10,22,0.8);
            --card-hover: rgba(15,15,30,0.9);
            --border: rgba(30,144,255,0.18);
            --border-red: rgba(230,57,70,0.18);
            --text: #e8eaf6;
            --text-muted: rgba(255,255,255,0.45);
            --sidebar-w: 280px;
        }

        body {
            font-family: 'Changa', sans-serif;
            background: var(--black);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            direction: rtl;
        }

        /* ===== BACKGROUND ===== */
        body::before {
            content: '';
            position: fixed; inset: 0; z-index: -2;
            background:
                radial-gradient(ellipse at 10% 20%, rgba(30,144,255,0.07) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 80%, rgba(230,57,70,0.05) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(10,10,30,1) 0%, rgba(5,5,8,1) 100%);
        }
        body::after {
            content: '';
            position: fixed; inset: 0; z-index: -1;
            background-image:
                linear-gradient(rgba(30,144,255,0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(30,144,255,0.025) 1px, transparent 1px);
            background-size: 60px 60px;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
            width: var(--sidebar-w);
            background: rgba(7,7,15,0.95);
            border-left: 1px solid var(--border);
            position: fixed; right: 0; top: 0; height: 100vh;
            display: flex; flex-direction: column;
            z-index: 100;
            backdrop-filter: blur(20px);
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--blue) transparent;
        }
        .sidebar::-webkit-scrollbar { width: 4px; }
        .sidebar::-webkit-scrollbar-thumb { background: var(--blue); border-radius: 10px; }

        .sidebar-header {
            padding: 30px 20px 20px;
            border-bottom: 1px solid var(--border);
            text-align: center;
            flex-shrink: 0;
        }
        .sidebar-logo {
            font-size: 32px; font-weight: 800; letter-spacing: 5px;
            background: linear-gradient(135deg, var(--blue), #ffffff 50%, var(--red));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            display: block;
            animation: logoShimmer 4s ease-in-out infinite alternate;
        }
        @keyframes logoShimmer {
            from { filter: drop-shadow(0 0 8px rgba(30,144,255,0.4)); }
            to   { filter: drop-shadow(0 0 20px rgba(30,144,255,0.8)); }
        }
        .sidebar-tagline {
            font-size: 10px; letter-spacing: 3px; color: var(--text-muted);
            margin-top: 4px; text-transform: uppercase;
        }

        .nav {
            display: ${showNav};
            flex-direction: column;
            gap: 4px;
            padding: 20px 12px 30px;
            flex: 1;
        }
        .nav a {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 16px; border-radius: 12px;
            color: var(--text-muted); text-decoration: none;
            font-size: 14px; font-weight: 500;
            transition: all 0.25s ease;
            border: 1px solid transparent;
            position: relative; overflow: hidden;
        }
        .nav a svg { flex-shrink: 0; opacity: 0.6; transition: opacity 0.25s; }
        .nav a:hover {
            background: var(--blue-glow);
            color: white;
            border-color: var(--border);
        }
        .nav a:hover svg { opacity: 1; }
        .nav a.active {
            background: linear-gradient(135deg, rgba(30,144,255,0.2), rgba(30,144,255,0.08));
            color: var(--blue);
            border-color: rgba(30,144,255,0.35);
            font-weight: 700;
        }
        .nav a.active svg { opacity: 1; color: var(--blue); }
        .nav a.active::before {
            content: '';
            position: absolute; right: 0; top: 20%; bottom: 20%;
            width: 3px; background: var(--blue);
            border-radius: 3px 0 0 3px;
        }

        /* ===== MAIN CONTENT ===== */
        .main {
            margin-right: ${guild.id ? 'var(--sidebar-w)' : '0'};
            padding: 40px 50px;
            width: 100%;
            min-height: 100vh;
        }

        .page-header {
            display: flex; align-items: center; gap: 15px;
            margin-bottom: 35px; padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }
        .page-header h1 {
            font-size: 24px; font-weight: 700; color: white;
        }
        .page-header .badge {
            background: var(--blue-glow); border: 1px solid var(--border);
            color: var(--blue); padding: 4px 12px; border-radius: 20px; font-size: 12px;
        }

        /* ===== CARDS ===== */
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 28px;
            margin-bottom: 24px;
            backdrop-filter: blur(15px);
            transition: border-color 0.3s;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, var(--blue), transparent);
            opacity: 0.5;
        }
        .card:hover { border-color: rgba(30,144,255,0.35); }
        .card h3 {
            color: white; font-size: 17px; font-weight: 700;
            margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .card h3 svg { color: var(--blue); }

        /* ===== FORMS ===== */
        label {
            display: block; color: var(--text-muted); font-size: 13px;
            margin-bottom: 6px; margin-top: 16px; font-weight: 500;
        }
        input, select, textarea {
            width: 100%; padding: 12px 16px;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px; color: white;
            font-family: 'Changa', sans-serif; font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
            outline: none;
        }
        input:focus, select:focus, textarea:focus {
            border-color: var(--blue);
            box-shadow: 0 0 0 3px rgba(30,144,255,0.12);
        }
        select option { background: #0d0d1a; color: white; }
        textarea { resize: vertical; min-height: 100px; }

        /* ===== BUTTONS ===== */
        .btn-save {
            background: linear-gradient(135deg, var(--blue), var(--blue-dark));
            color: white; border: none; padding: 13px 24px;
            border-radius: 12px; cursor: pointer; font-weight: 700;
            font-size: 14px; font-family: 'Changa', sans-serif;
            transition: all 0.3s; display: inline-block; text-decoration: none;
            text-align: center; width: 100%;
            box-shadow: 0 4px 20px rgba(30,144,255,0.25);
        }
        .btn-save:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(30,144,255,0.4);
            filter: brightness(1.1);
        }
        .btn-danger {
            background: linear-gradient(135deg, var(--red), #c0392b);
            box-shadow: 0 4px 20px rgba(230,57,70,0.25);
        }
        .btn-danger:hover { box-shadow: 0 8px 30px rgba(230,57,70,0.4); }
        .btn-sm { padding: 8px 16px; font-size: 13px; width: auto; border-radius: 8px; }
        .btn-green {
            background: linear-gradient(135deg, #00c853, #00a040);
            box-shadow: 0 4px 20px rgba(0,200,83,0.25);
        }

        /* ===== STAT BOXES ===== */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px; margin-top: 16px;
        }
        .stat-box {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            border-radius: 14px; padding: 20px;
            text-align: center; transition: all 0.3s;
        }
        .stat-box:hover { border-color: var(--blue); transform: translateY(-3px); }
        .stat-box .stat-num { font-size: 36px; font-weight: 800; color: var(--blue); }
        .stat-box .stat-label { color: var(--text-muted); font-size: 13px; margin-top: 4px; }

        /* ===== GUILD GRID (Dashboard) ===== */
        .guild-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px; max-width: 1000px; margin: 0 auto;
        }
        .guild-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px; padding: 28px 20px;
            text-align: center; transition: all 0.35s;
            cursor: pointer;
        }
        .guild-card:hover {
            transform: translateY(-8px);
            border-color: var(--blue);
            box-shadow: 0 20px 50px rgba(30,144,255,0.15);
        }
        .guild-icon {
            width: 75px; height: 75px; border-radius: 50%;
            border: 2px solid var(--border); margin-bottom: 14px;
            transition: border-color 0.3s;
        }
        .guild-card:hover .guild-icon { border-color: var(--blue); }
        .guild-card h3 { color: white; font-size: 15px; margin-bottom: 12px; }
        .guild-card a { font-size: 13px; font-weight: 600; text-decoration: none; }

        /* ===== TABLE ===== */
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
            padding: 12px 16px; text-align: right;
            color: var(--text-muted); font-size: 12px; font-weight: 600;
            border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 1px;
        }
        .data-table td {
            padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
            font-size: 14px; color: var(--text);
        }
        .data-table tr:hover td { background: rgba(30,144,255,0.04); }

        /* ===== BADGE ===== */
        .tag {
            display: inline-block; padding: 3px 10px; border-radius: 20px;
            font-size: 11px; font-weight: 600;
        }
        .tag-blue { background: var(--blue-glow); color: var(--blue); border: 1px solid var(--border); }
        .tag-red { background: var(--red-glow); color: var(--red-light); border: 1px solid var(--border-red); }
        .tag-green { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }

        /* ===== DIVIDER ===== */
        .section-divider {
            height: 1px; background: var(--border);
            margin: 24px 0;
        }

        /* ===== TOGGLE SWITCH ===== */
        .toggle-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .toggle-row label { margin: 0; color: var(--text); font-size: 14px; }

        /* ===== ANIMATIONS ===== */
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .card { animation: fadeInUp 0.4s ease both; }
        .card:nth-child(2) { animation-delay: 0.05s; }
        .card:nth-child(3) { animation-delay: 0.1s; }
        .card:nth-child(4) { animation-delay: 0.15s; }

        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(30,144,255,0.3); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--blue); }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
            .sidebar { width: 240px; }
            .main { margin-right: 240px; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <span class="sidebar-logo">VORTEX</span>
            <div class="sidebar-tagline">Bot Dashboard</div>
        </div>
        <nav class="nav">
            ${navItems}
        </nav>
    </div>
    <div class="main">
        <div class="page-header">
            <h1>${guildName}</h1>
            ${guild.id ? `<span class="badge">مدير</span>` : ''}
        </div>
        ${content}
    </div>
</body>
</html>`;
}


// ==========================================
// 9. Dashboard Routes
// ==========================================

// --- [ Dashboard - Server List ] ---
app.get('/dashboard', checkAuth, (req, res) => {
    if (!req.user || !req.user.guilds) return res.redirect('/login');
    const adminGuilds = req.user.guilds.filter(g => {
        try {
            return (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8);
        } catch(e) { return false; }
    });
    const inviteLink = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

    const cards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const iconURL = g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';

        return `
        <div class="guild-card">
            <img src="${iconURL}" class="guild-icon" alt="${g.name}">
            <h3>${g.name}</h3>
            ${hasBot
                ? `<a href="/manage/${g.id}/home" style="color:var(--blue);">الإعدادات</a>`
                : `<a href="${inviteLink}" style="color:#00c853;">اضافة البوت</a>`
            }
        </div>`;
    }).join('');

    const content = `
    <div style="text-align:center; margin-bottom:40px;">
        <div style="font-size:48px; font-weight:800; letter-spacing:6px;
            background: linear-gradient(135deg, var(--blue), #fff, var(--red));
            -webkit-background-clip:text; -webkit-text-fill-color:transparent;
            margin-bottom:10px;">VORTEX</div>
        <p style="color:var(--text-muted); font-size:15px;">اختر السيرفر لإدارته</p>
    </div>
    <div class="guild-grid">${cards}</div>`;

    res.send(ui({ id: null, name: 'قائمة السيرفرات' }, 'home', content));
});

// --- [ Home / Stats ] ---
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
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/></svg>
            إحصائيات السيرفر
        </h3>
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-num">${statsData.messages?.total || 0}</div>
                <div class="stat-label">اجمالي الرسائل</div>
            </div>
            <div class="stat-box" style="--blue:#e63946;">
                <div class="stat-num" style="color:var(--blue);">${g.memberCount}</div>
                <div class="stat-label">عدد الاعضاء</div>
            </div>
            <div class="stat-box" style="--blue:#00c853;">
                <div class="stat-num" style="color:#00c853;">+${newMembersCount}</div>
                <div class="stat-label">اعضاء جدد (7 ايام)</div>
            </div>
            <div class="stat-box" style="--blue:#ff6b6b;">
                <div class="stat-num" style="color:#ff6b6b;">-${leftMembersCount}</div>
                <div class="stat-label">اعضاء غادروا (7 ايام)</div>
            </div>
            <div class="stat-box">
                <div class="stat-num">${statsData.messages?.daily || 0}</div>
                <div class="stat-label">رسائل اليوم</div>
            </div>
            <div class="stat-box">
                <div class="stat-num">${statsData.messages?.weekly || 0}</div>
                <div class="stat-label">رسائل الاسبوع</div>
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

    const streamerRows = s.streamers.map((st, i) => `
    <tr>
        <td><span class="tag tag-blue">${st.kickUsername}</span></td>
        <td style="color:var(--text-muted);">#${g.channels.cache.get(st.channelId)?.name || 'قناة محذوفة'}</td>
        <td>${st.roleId ? `<span class="tag tag-red">@${g.roles.cache.get(st.roleId)?.name || 'رتبة محذوفة'}</span>` : '<span class="tag" style="background:rgba(255,255,255,0.05);color:var(--text-muted);">بدون منشن</span>'}</td>
        <td>
            <a href="/delete-kick/${g.id}/${i}" class="btn-save btn-danger btn-sm" style="text-decoration:none;" onclick="return confirm('حذف الستريمر؟')">حذف</a>
        </td>
    </tr>`).join('');

    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="var(--dark)"/></svg>
            نظام تنبيهات Kick
        </h3>

        <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:14px; padding:24px; margin-bottom:24px;">
            <h4 style="color:var(--blue); margin-bottom:18px; font-size:15px;">اضافة ستريمر جديد</h4>
            <form method="POST" action="/save/${g.id}/kick">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div>
                        <label>اسم المستخدم في Kick</label>
                        <input type="text" name="kickUser" placeholder="مثلاً: username" required>
                    </div>
                    <div>
                        <label>قناة التنبيه</label>
                        <select name="channelId">
                            ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label>الرتبة للمنشن (اختياري)</label>
                        <select name="roleId">
                            <option value="">-- بدون منشن --</option>
                            ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label>رسالة مخصصة (استخدم %name% للاسم)</label>
                        <input type="text" name="msg" placeholder="%name% بدأ البث الآن!">
                    </div>
                </div>
                <button class="btn-save btn-green" style="margin-top:16px; width:auto; padding:12px 30px;">اضافة الستريمر</button>
            </form>
        </div>

        ${s.streamers.length > 0 ? `
        <table class="data-table">
            <thead>
                <tr>
                    <th>الستريمر</th>
                    <th>القناة</th>
                    <th>المنشن</th>
                    <th>الإجراء</th>
                </tr>
            </thead>
            <tbody>${streamerRows}</tbody>
        </table>` : `<p style="color:var(--text-muted); text-align:center; padding:30px 0;">لا يوجد ستريمرات مضافة بعد.</p>`}
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
        res.status(500).send('خطأ في إضافة الستريمر');
    }
});

app.get('/delete-kick/:guildId/:index', checkAuth, async (req, res) => {
    const { guildId, index } = req.params;
    const config = await KickConfig.findOne({ guildId });
    if (config) { config.streamers.splice(index, 1); await config.save(); }
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
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                إعدادات الستريك
            </h3>
            <label>عدد الرسائل المطلوبة يومياً</label>
            <input type="number" name="reqMsgs" value="${s.requiredMessages || 60}" min="1">
            <label>رتبة الستريك (الرتبة اللي يجب أن يملكها العضو)</label>
            <select name="streakRole">
                <option value="">-- لا يوجد --</option>
                ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}" ${s.streakRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
            <label>قناة إعلانات الستريك</label>
            <select name="streakChannel">
                <option value="">-- لا يوجد --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.streakChannel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>
    <form method="POST" action="/reset-streaks/${g.id}" onsubmit="return confirm('هل أنت متأكد من تصفير كل الستريكات؟')">
        <button class="btn-save btn-danger">تصفير كل الستريكات</button>
    </form>`;

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
        messages: 'الرسائل',
        moderation: 'الإشراف',
        members: 'الأعضاء',
        channels: 'القنوات',
        roles: 'الرتب',
        voice: 'الصوت'
    };

    const content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                نظام اللوق
            </h3>
            ${types.map(t => `
            <div class="toggle-row">
                <div style="display:flex; align-items:center; gap:12px;">
                    <input type="checkbox" name="${t}_st" id="chk_${t}" ${s.logs?.[t]?.enabled ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:var(--blue);">
                    <label for="chk_${t}" style="margin:0; color:white; cursor:pointer;">${typeLabels[t]}</label>
                </div>
                <select name="${t}_ch" style="width:250px; margin:0;">
                    <option value="">-- اختر القناة --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c =>
                        `<option value="${c.id}" ${s.logs?.[t]?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`
                    ).join('')}
                </select>
            </div>`).join('')}
            <button class="btn-save" style="margin-top:20px;">حفظ اللوق</button>
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


// --- [ Welcome ] ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };
    let img = s.welcome?.imagePath || 'https://placehold.co/800x400?text=No+Background';

    const content = `
    <style>
        .preview-container { position:relative; border:1px solid var(--border); border-radius:14px; overflow:hidden; background:#000; width:100%; aspect-ratio:2/1; user-select:none; }
        #previewAvatar { position:absolute; border:3px solid #fff; border-radius:50%; background-size:100% 100%; cursor:move; box-shadow:0 0 15px rgba(0,0,0,0.5); }
        .resizer { width:12px; height:12px; background:var(--blue); position:absolute; border-radius:50%; cursor:se-resize; }
        .resizer.br { bottom:-6px; right:-6px; }
    </style>
    <form method="POST" action="/save/${g.id}/welcome" enctype="multipart/form-data">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                إعدادات الترحيب
            </h3>

            <div class="toggle-row">
                <label style="color:white; margin:0;">تفعيل نظام الترحيب</label>
                <input type="checkbox" name="enabled" ${s.welcome?.enabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--blue); cursor:pointer;">
            </div>

            <label>قناة الترحيب</label>
            <select name="channel">
                <option value="">-- اختر القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.welcome?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>

            <label>رسالة الترحيب (استخدم {member} {guild} {count})</label>
            <textarea name="embedMessage">${s.welcome?.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!'}</textarea>

            <label>صورة الخلفية</label>
            <input type="file" name="bgImage" accept="image/*" style="padding:10px;">

            <div class="preview-container" id="previewContainer">
                <img src="${img}" id="bgPreview" style="width:100%; height:100%; object-fit:cover; position:absolute;">
                <div id="previewAvatar" style="width:${s.welcome?.avatarWidth || 150}px; height:${s.welcome?.avatarHeight || 150}px; left:${(s.welcome?.avatarX || 50) - (s.welcome?.avatarWidth || 150) / 2 / 8}%; top:${(s.welcome?.avatarY || 50) - (s.welcome?.avatarHeight || 150) / 2 / 4}%; background-image:url('${client.user?.displayAvatarURL() || ''}');">
                    <div class="resizer br" id="resizer"></div>
                </div>
            </div>
            <input type="hidden" name="avatarX" id="avatarX" value="${s.welcome?.avatarX || 50}">
            <input type="hidden" name="avatarY" id="avatarY" value="${s.welcome?.avatarY || 50}">
            <input type="hidden" name="avatarWidth" id="avatarWidth" value="${s.welcome?.avatarWidth || 150}">
            <input type="hidden" name="avatarHeight" id="avatarHeight" value="${s.welcome?.avatarHeight || 150}">

            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>
    <script>
        const container = document.getElementById('previewContainer');
        const avatar = document.getElementById('previewAvatar');
        const bgPreview = document.getElementById('bgPreview');
        let dragging = false, resizing = false, startX, startY, startW, startH, startLeft, startTop;

        avatar.addEventListener('mousedown', e => { if (e.target.id === 'resizer') return; dragging = true; startX = e.clientX - avatar.offsetLeft; startY = e.clientY - avatar.offsetTop; e.preventDefault(); });
        document.getElementById('resizer').addEventListener('mousedown', e => { resizing = true; startX = e.clientX; startY = e.clientY; startW = avatar.offsetWidth; startH = avatar.offsetHeight; e.preventDefault(); e.stopPropagation(); });
        document.addEventListener('mousemove', e => {
            if (dragging) {
                let newLeft = Math.max(0, Math.min(e.clientX - startX, container.offsetWidth - avatar.offsetWidth));
                let newTop = Math.max(0, Math.min(e.clientY - startY, container.offsetHeight - avatar.offsetHeight));
                avatar.style.left = newLeft + 'px'; avatar.style.top = newTop + 'px';
                document.getElementById('avatarX').value = Math.round(((newLeft + avatar.offsetWidth/2) / container.offsetWidth) * 100);
                document.getElementById('avatarY').value = Math.round(((newTop + avatar.offsetHeight/2) / container.offsetHeight) * 100);
            }
            if (resizing) {
                let newW = Math.max(50, startW + (e.clientX - startX)); let newH = Math.max(50, startH + (e.clientY - startY));
                avatar.style.width = newW + 'px'; avatar.style.height = newH + 'px';
                document.getElementById('avatarWidth').value = newW; document.getElementById('avatarHeight').value = newH;
            }
        });
        document.addEventListener('mouseup', () => { dragging = false; resizing = false; });
        document.querySelector('input[name="bgImage"]').addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader(); reader.onload = ev => { bgPreview.src = ev.target.result; }; reader.readAsDataURL(file);
        });
    </script>`;

    res.send(ui(g, 'welcome', content));
});

app.post('/save/:guildId/welcome', checkAuth, upload.single('bgImage'), async (req, res) => {
    const b = req.body;
    let updateData = {
        'welcome.enabled': b.enabled === 'on',
        'welcome.channel': b.channel,
        'welcome.embedMessage': b.embedMessage,
        'welcome.avatarX': Number(b.avatarX),
        'welcome.avatarY': Number(b.avatarY),
        'welcome.avatarWidth': Number(b.avatarWidth),
        'welcome.avatarHeight': Number(b.avatarHeight)
    };
    if (req.file) updateData['welcome.imagePath'] = `${process.env.BASE_URL || ''}/uploads/${req.file.filename}`;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: updateData }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/welcome`);
});

// --- [ Security ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/security">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                إعدادات الحماية
            </h3>
            <div class="toggle-row">
                <label style="color:white; margin:0;">حظر الروابط</label>
                <input type="checkbox" name="antiLinks" ${s.security?.antiLinks ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--blue); cursor:pointer;">
            </div>
            <label>الكلمات المحظورة (افصل بفاصلة)</label>
            <input type="text" name="badWords" value="${s.security?.badWords || ''}" placeholder="كلمة1, كلمة2, ...">
            <label>الإيموجيات المحظورة (افصل بفاصلة)</label>
            <input type="text" name="badEmojis" value="${s.security?.badEmojis || ''}" placeholder="إيموجي1, إيموجي2, ...">
            <label>رتب الاستثناء (لن تطبق عليهم الحماية)</label>
            ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `
            <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
                <input type="checkbox" name="bypassRoles" value="${r.id}" id="bypass_${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--blue);">
                <label for="bypass_${r.id}" style="margin:0; color:var(--text); cursor:pointer;">${r.name}</label>
            </div>`).join('')}
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'security', content));
});

app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    const b = req.body;
    const bypassRoles = Array.isArray(b.bypassRoles) ? b.bypassRoles : (b.bypassRoles ? [b.bypassRoles] : []);
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { security: { antiLinks: b.antiLinks === 'on', badWords: b.badWords, badEmojis: b.badEmojis, bypassRoles } } },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/security`);
});

// --- [ Auto Reply ] ---
app.get('/manage/:guildId/autoreply', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { autoReply: [] };

    const rows = Array.from({ length: 15 }, (_, i) => `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; padding:14px; background:rgba(0,0,0,0.2); border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
        <input name="trigger_${i}" value="${s.autoReply?.[i]?.trigger || ''}" placeholder="الكلمة المحفزة ${i + 1}">
        <input name="reply_${i}" value="${s.autoReply?.[i]?.reply || ''}" placeholder="الرد التلقائي ${i + 1}">
    </div>`).join('');

    const content = `
    <form method="POST" action="/save/${g.id}/autoreply">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                الرد الآلي (حتى 15 رد)
            </h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 12px; margin-bottom:8px; padding:0 14px;">
                <span style="color:var(--text-muted); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">الكلمة المحفزة</span>
                <span style="color:var(--text-muted); font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">الرد</span>
            </div>
            ${rows}
            <button class="btn-save" style="margin-top:8px;">حفظ الردود</button>
        </div>
    </form>`;

    res.send(ui(g, 'autoreply', content));
});

app.post('/save/:guildId/autoreply', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const finalData = [];
        for (let i = 0; i < 15; i++) {
            const t = req.body[`trigger_${i}`]?.trim();
            const r = req.body[`reply_${i}`]?.trim();
            if (t && r) finalData.push({ trigger: t, reply: r });
        }
        await GuildConfig.findOneAndUpdate({ guildId }, { $set: { autoReply: finalData } }, { upsert: true, new: true });
        res.redirect(`/manage/${guildId}/autoreply`);
    } catch (err) {
        console.error('[AutoReply Save Error]', err);
        res.status(500).send('خطأ في حفظ الردود');
    }
});

// --- [ Giveaway ] ---
app.get('/manage/:guildId/giveaway', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const activeGiveaways = await Giveaway.find({ guildId: g.id, ended: false });

    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/></svg>
            إنشاء قيف اواي جديد
        </h3>
        <form method="POST" action="/save/${g.id}/giveaway">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>الجائزة</label>
                    <input name="prize" placeholder="اسم الجائزة" required>
                </div>
                <div>
                    <label>المدة (مثال: 1d أو 1h أو 30m)</label>
                    <input name="duration" placeholder="1h" required>
                </div>
                <div>
                    <label>عدد الفائزين</label>
                    <input type="number" name="winners" value="1" min="1">
                </div>
                <div>
                    <label>قناة الإرسال</label>
                    <select name="channel">
                        ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <label>الوصف (اختياري)</label>
            <textarea name="description" placeholder="وصف الجائزة..."></textarea>
            <button class="btn-save btn-green" style="margin-top:16px;">تشغيل القيف اواي</button>
        </form>
    </div>
    ${activeGiveaways.length > 0 ? `
    <div class="card">
        <h3>القيف اوايات النشطة</h3>
        ${activeGiveaways.map(gw => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:rgba(0,0,0,0.2); border-radius:10px; margin-bottom:10px; border:1px solid var(--border);">
            <div>
                <span style="color:white; font-weight:700;">${gw.prize}</span>
                <span class="tag tag-blue" style="margin-right:10px;">${gw.winnersCount} فائز</span>
            </div>
            <span style="color:var(--text-muted); font-size:13px;">ينتهي <t:${Math.floor(gw.endAt / 1000)}:R></span>
        </div>`).join('')}
    </div>` : ''}`;

    res.send(ui(g, 'giveaway', content));
});

app.post('/save/:guildId/giveaway', checkAuth, async (req, res) => {
    const { prize, duration, winners, channel, description } = req.body;
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.status(404).send('السيرفر غير موجود');
    const timeMs = ms(duration);
    if (!timeMs) return res.send('خطأ في صيغة الوقت! استخدم 1h أو 1d أو 30m');
    const endAt = new Date(Date.now() + timeMs);
    const targetCh = g.channels.cache.get(channel);
    if (!targetCh) return res.send('الروم غير موجود');

    const embed = new EmbedBuilder()
        .setTitle(`قيف اواي: ${prize}`)
        .setDescription(`${description || 'لا يوجد وصف'}\n\nينتهي: <t:${Math.floor(endAt / 1000)}:R>\nعدد الفائزين: ${winners}`)
        .setColor(0x1e90ff)
        .setFooter({ text: 'اضغط على رد فعل للاشتراك' });

    const giveawayMsg = await targetCh.send({ embeds: [embed] });
    await giveawayMsg.react('🎉');
    await Giveaway.create({ guildId: g.id, messageId: giveawayMsg.id, channelId: channel, endAt, winnersCount: parseInt(winners), prize, description });
    res.redirect(`/manage/${g.id}/giveaway`);
});

// --- [ Tickets ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [], menuOptions: [] };
    let topImg = s.topImagePath ? `/uploads/${path.basename(s.topImagePath)}` : 'https://placehold.co/110x110?text=Top';
    let bottomImg = s.bottomImagePath ? `/uploads/${path.basename(s.bottomImagePath)}` : 'https://placehold.co/110x110?text=Bottom';

    const content = `
    <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>
                إعداد نظام التذاكر
            </h3>

            <div style="display:flex; gap:30px; justify-content:center; margin-bottom:24px;">
                <div style="text-align:center;">
                    <div style="color:var(--text-muted); font-size:12px; margin-bottom:8px;">الصورة العلوية</div>
                    <img src="${topImg}" style="width:100px; height:100px; object-fit:cover; border-radius:12px; border:1px solid var(--border);">
                    <label style="display:block; margin-top:8px; background:var(--blue-glow); border:1px solid var(--border); color:var(--blue); padding:6px 14px; border-radius:8px; cursor:pointer; font-size:12px;">
                        تغيير <input type="file" name="topImage" style="display:none;" accept="image/*">
                    </label>
                </div>
                <div style="text-align:center;">
                    <div style="color:var(--text-muted); font-size:12px; margin-bottom:8px;">الصورة السفلية</div>
                    <img src="${bottomImg}" style="width:100px; height:100px; object-fit:cover; border-radius:12px; border:1px solid var(--border);">
                    <label style="display:block; margin-top:8px; background:var(--blue-glow); border:1px solid var(--border); color:var(--blue); padding:6px 14px; border-radius:8px; cursor:pointer; font-size:12px;">
                        تغيير <input type="file" name="bottomImage" style="display:none;" accept="image/*">
                    </label>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>عنوان التذكرة</label>
                    <input name="title" value="${s.title || ''}" placeholder="عنوان نظام التذاكر">
                </div>
                <div>
                    <label>رتبة الإدارة</label>
                    <select name="adminRole">
                        <option value="">-- اختر رتبة الإدارة --</option>
                        ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}" ${s.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <label>الوصف</label>
            <textarea name="description">${s.description || ''}</textarea>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:16px;">
                <div>
                    <div style="color:var(--blue); font-size:13px; font-weight:700; margin-bottom:10px;">الازرار (حتى 4)</div>
                    ${[0,1,2,3].map(i => `
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px; margin-bottom:8px;">
                        <input name="btn_label_${i}" value="${s.buttons?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                        <input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji || ''}" placeholder="ID الإيموجي">
                    </div>`).join('')}
                </div>
                <div>
                    <div style="color:var(--blue); font-size:13px; font-weight:700; margin-bottom:10px;">خيارات المنيو (حتى 4)</div>
                    ${[0,1,2,3].map(i => `
                    <div style="display:grid; grid-template-columns:2fr 1fr; gap:8px; margin-bottom:8px;">
                        <input name="menu_label_${i}" value="${s.menuOptions?.[i]?.label || ''}" placeholder="خيار ${i+1}">
                        <input name="menu_emoji_${i}" value="${s.menuOptions?.[i]?.emoji || ''}" placeholder="ID الإيموجي">
                    </div>`).join('')}
                </div>
            </div>

            <label style="margin-top:16px;">قناة الإرسال (اختياري)</label>
            <select name="targetChannel">
                <option value="">-- لا ترسل الآن --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ وإرسال</button>
        </div>
    </form>`;

    res.send(ui(g, 'tickets', content));
});

app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), async (req, res) => {
    try {
        const b = req.body;
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.status(404).send('Guild not found');

        let buttons = [], menuOptions = [];
        for (let i = 0; i < 4; i++) {
            const btnLabel = b[`btn_label_${i}`]?.trim();
            const btnEmoji = b[`btn_emoji_${i}`]?.trim();
            const menuLabel = b[`menu_label_${i}`]?.trim();
            const menuEmoji = b[`menu_emoji_${i}`]?.trim();
            if (btnLabel) buttons.push({ label: btnLabel, emoji: btnEmoji || '' });
            if (menuLabel) menuOptions.push({ label: menuLabel, emoji: menuEmoji || '' });
        }

        let updateData = { title: b.title, description: b.description, color: b.color || '#1e90ff', adminRole: b.adminRole, buttons, menuOptions };
        if (req.files?.topImage?.[0]) updateData.topImagePath = req.files.topImage[0].path;
        if (req.files?.bottomImage?.[0]) updateData.bottomImagePath = req.files.bottomImage[0].path;

        const config = await TicketConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: updateData }, { upsert: true, new: true });

        if (b.targetChannel) {
            const channel = g.channels.cache.get(b.targetChannel);
            if (channel) {
                const files = [];
                const embed = new EmbedBuilder()
                    .setTitle(config.title || 'نظام التذاكر')
                    .setDescription(config.description || 'اضغط للفتح')
                    .setColor(parseInt((config.color || '#1e90ff').replace('#', ''), 16));

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
                        const button = new ButtonBuilder().setCustomId(`ticket_btn_${i}`).setLabel(btn.label).setStyle(ButtonStyle.Primary);
                        if (btn.emoji && btn.emoji.trim() !== '') {
                            const em = btn.emoji.trim();
                            try {
                                if (/^\d+$/.test(em)) button.setEmoji({ id: em });
                                else if (/^<a?:\w+:\d+>$/.test(em)) button.setEmoji(em);
                            } catch (e) {}
                        }
                        btnRow.addComponents(button);
                    });
                    if (btnRow.components.length > 0) components.push(btnRow);
                }
                if (config.menuOptions?.length > 0) {
                    const select = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('اختر من القائمة...');
                    config.menuOptions.forEach((opt, i) => {
                        const option = { label: opt.label, value: `ticket_opt_${i}` };
                        if (opt.emoji && opt.emoji.trim() !== '') {
                            const em = opt.emoji.trim();
                            try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) {}
                        }
                        select.addOptions(option);
                    });
                    components.push(new ActionRowBuilder().addComponents(select));
                }
                if (components.length === 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary)
                    ));
                }
                await channel.send({ embeds: [embed], components, files }).catch(e => console.error('[Ticket Send Error]', e));
            }
        }
        res.redirect(`/manage/${req.params.guildId}/tickets`);
    } catch (error) {
        console.error('[Ticket Save Error]', error);
        res.status(500).send('Internal Error');
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
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/></svg>
                إعدادات المستويات
            </h3>
            <div class="toggle-row">
                <label style="color:white; margin:0;">تفعيل نظام المستويات</label>
                <input type="checkbox" name="enabled" ${s.levels?.enabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--blue); cursor:pointer;">
            </div>
            <label>XP لكل رسالة</label>
            <input type="number" name="xpPerMessage" value="${s.levels?.xpPerMessage || 10}" min="1">
            <label>قناة رسائل الترقية</label>
            <select name="levelUpChannel">
                <option value="">-- نفس القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.levels?.levelUpChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <label>أمر قائمة المتصدرين</label>
            <input name="leaderboardCommand" value="${s.levels?.leaderboardCommand || '!levels'}" placeholder="!levels">
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { levels: { enabled: b.enabled === 'on', xpPerMessage: Number(b.xpPerMessage) || 10, levelUpChannel: b.levelUpChannel, leaderboardCommand: b.leaderboardCommand || '!levels' } } },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Roles Panel ] ---
app.get('/manage/:guildId/roles', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await GuildConfig.findOne({ guildId: g.id }) || { rolesPanel: [] };

    const content = `
    <div class="card">
        <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            لوحة الرتب الذاتية
        </h3>
        <form method="POST" action="/save/${g.id}/roles">
            <label>قناة إرسال اللوحة</label>
            <select name="rolesChannel">
                <option value="">-- اختر القناة --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.rolesChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <div style="margin-top:20px;">
                <div style="color:var(--blue); font-size:13px; font-weight:700; margin-bottom:12px;">الرتب (حتى 10)</div>
                ${Array.from({ length: 10 }, (_, i) => `
                <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
                    <select name="role_id_${i}">
                        <option value="">-- اختر رتبة --</option>
                        ${g.roles.cache.filter(r => r.name !== '@everyone').map(r =>
                            `<option value="${r.id}" ${s.rolesPanel?.[i]?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                        ).join('')}
                    </select>
                    <input name="role_label_${i}" value="${s.rolesPanel?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                </div>`).join('')}
            </div>
            <button class="btn-save" style="margin-top:12px;">حفظ اللوحة</button>
        </form>
    </div>`;

    res.send(ui(g, 'roles', content));
});
app.post('/save/:guildId/roles', checkAuth, async (req, res) => {
    const b = req.body;
    const rolesPanel = [];
    for (let i = 0; i < 10; i++) {
        const roleId = b[`role_id_${i}`];
        const label = b[`role_label_${i}`]?.trim();
        if (roleId && label) rolesPanel.push({ roleId, label, type: 'button' });
    }
    
    const config = await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: { rolesPanel, rolesChannel: b.rolesChannel } },
        { upsert: true, new: true }
    );

    // إرسال اللوحة تلقائياً للروم
    const g = client.guilds.cache.get(req.params.guildId);
    if (g && b.rolesChannel && rolesPanel.length > 0) {
        const channel = g.channels.cache.get(b.rolesChannel);
        if (channel) {
            const rows = [];
            let row = new ActionRowBuilder();
            for (const r of rolesPanel) {
                row.addComponents(new ButtonBuilder().setCustomId(`role_${r.roleId}`).setLabel(r.label).setStyle(ButtonStyle.Secondary));
                if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
            }
            if (row.components.length > 0) rows.push(row);
            
            await channel.send({ 
                embeds: [new EmbedBuilder().setTitle('لوحة الرتب الذاتية').setDescription('اضغط على الزر للحصول على الرتبة أو إزالتها').setColor(0x1e90ff)],
                components: rows 
            }).catch(() => {});
        }
    }

    res.redirect(`/manage/${req.params.guildId}/roles`);
});


// --- [ Mod / Jail Config ] ---
app.get('/manage/:guildId/mod', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let s = await ModConfig.findOne({ guildId: g.id }) || { jail: {} };

    const content = `
    <form method="POST" action="/save/${g.id}/mod">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                إعدادات نظام السجن
            </h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
                عند سجن شخص، يتم سحب جميع رتبه تلقائياً ويُعطى رتبة السجن فقط، ولن يستطيع رؤية أي روم سوى روم السجن.
            </p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>أمر السجن</label>
                    <input name="jailCmd" value="${s.jail?.commandName || 'jail'}" placeholder="jail">
                </div>
                <div>
                    <label>أمر فك السجن</label>
                    <input name="unjailCmd" value="${s.jail?.unjailCommand || 'unjail'}" placeholder="unjail">
                </div>
            </div>
            <label>رتبة السجن</label>
            <select name="jailRole">
                <option value="">-- اختر رتبة السجن --</option>
                ${g.roles.cache.filter(r => r.name !== '@everyone').map(r =>
                    `<option value="${r.id}" ${s.jail?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                ).join('')}
            </select>
            <label>روم السجن (الروم الوحيد الذي يراه المسجون)</label>
            <select name="jailChannel">
                <option value="">-- اختر روم السجن --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
                    `<option value="${c.id}" ${s.jail?.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`
                ).join('')}
            </select>
            <button class="btn-save" style="margin-top:20px;">حفظ الإعدادات</button>
        </div>
    </form>`;

    res.send(ui(g, 'mod', content));
});

app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    await ModConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: {
            'jail.commandName': req.body.jailCmd || 'jail',
            'jail.unjailCommand': req.body.unjailCmd || 'unjail',
            'jail.roleId': req.body.jailRole,
            'jail.channelId': req.body.jailChannel
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

    const clanCards = clans.map(clan => `
    <div style="padding:20px; background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
            <div style="font-weight:700; color:white; font-size:15px; margin-bottom:4px;">${clan.clanName || 'كلان بدون اسم'}</div>
            <div style="color:var(--text-muted); font-size:13px;">
                القائد: <@${clan.leaderId}> &nbsp;|&nbsp; الأعضاء: ${clan.members?.length || 0}/10 &nbsp;|&nbsp; النقاط: ${clan.points || 0}
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <a href="/manage/${g.id}/clans/edit/${clan.clanIndex}" class="btn-save btn-sm" style="text-decoration:none; background:var(--blue-glow); color:var(--blue); border:1px solid var(--border);">تعديل</a>
            <a href="/manage/${g.id}/clans/delete/${clan.clanIndex}" class="btn-save btn-danger btn-sm" style="text-decoration:none;" onclick="return confirm('حذف الكلان؟')">حذف</a>
        </div>
    </div>`).join('');

    const content = `
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                نظام الكلانات
            </h3>
            <a href="/manage/${g.id}/clans/add" class="btn-save btn-sm btn-green" style="text-decoration:none; width:auto;">اضافة كلان</a>
        </div>
        ${clans.length === 0 ? '<p style="color:var(--text-muted); text-align:center; padding:30px 0;">لا يوجد كلانات بعد.</p>' : clanCards}
    </div>`;

    res.send(ui(g, 'clans', content));
});

app.get('/manage/:guildId/clans/add', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const lastClan = await Clan.findOne({ guildId: g.id }).sort({ clanIndex: -1 });
    const nextIndex = lastClan ? lastClan.clanIndex + 1 : 0;

    const content = `
    <form method="POST" action="/save/${g.id}/clans">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                اضافة كلان جديد
            </h3>
            <input type="hidden" name="clanIndex" value="${nextIndex}">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>اسم الكلان</label>
                    <input name="clanName" required placeholder="مثلاً: VORTEX TEAM">
                </div>
                <div>
                    <label>ID القائد</label>
                    <input name="leaderId" required placeholder="ID صاحب الكلان">
                </div>
                <div>
                    <label>رتبة الكلان</label>
                    <select name="roleId">
                        <option value="">-- بدون رتبة --</option>
                        ${g.roles.cache.filter(r => r.name !== '@everyone').map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>قناة إرسال لوحة التقديم</label>
                    <select name="applyChannelId" required>
                        <option value="">-- اختر القناة --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label>قناة وصول نتائج التقديم</label>
                    <select name="resultsChannelId" required>
                        <option value="">-- اختر القناة --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <label style="margin-top:16px;">أسئلة التقديم (سؤال في كل سطر)</label>
            <textarea name="questions" rows="5" placeholder="ما هو اسمك؟&#10;كم عمرك؟&#10;لماذا تريد الانضمام؟"></textarea>
            <button type="submit" class="btn-save btn-green" style="margin-top:20px;">حفظ وإرسال لوحة التقديم</button>
        </div>
    </form>`;

    res.send(ui(g, 'clans', content));
});

app.post('/save/:guildId/clans', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { clanName, leaderId, roleId, resultsChannelId, applyChannelId, clanIndex, questions } = req.body;
        const questionsArray = questions ? questions.split('\n').filter(q => q.trim() !== '') : [];

        const newClan = await Clan.create({
            guildId, clanName, leaderId, roleId, resultsChannelId,
            clanIndex: parseInt(clanIndex),
            questions: questionsArray,
            members: [], assistantIds: []
        });

        const applyChannel = client.channels.cache.get(applyChannelId);
        if (applyChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`نظام التقديم | ${clanName}`)
                .setDescription('اضغط على الزر أدناه لفتح تذكرة تقديم والإجابة على الأسئلة.\n\nسيتم مراجعة طلبك من قبل الإدارة.')
                .setColor(0x1e90ff)
                .setThumbnail(applyChannel.guild.iconURL())
                .setFooter({ text: 'VORTEX System - Clans' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`apply_clan_${newClan._id}`)
                    .setLabel('تقديم الآن')
                    .setStyle(ButtonStyle.Success)
            );
            await applyChannel.send({ embeds: [embed], components: [row] });
        }

        res.redirect(`/manage/${guildId}/clans`);
    } catch (err) {
        console.error('[Clan Save Error]', err);
        res.status(500).send('خطأ في إضافة الكلان');
    }
});

app.get('/manage/:guildId/clans/delete/:index', checkAuth, async (req, res) => {
    const clanIdx = parseInt(req.params.index);
    
    // التأكد من أن الـ Index رقم صحيح قبل محاولة الحذف
    if (isNaN(clanIdx)) {
        return res.redirect(`/manage/${req.params.guildId}/clans`);
    }

    await Clan.deleteOne({ 
        guildId: req.params.guildId, 
        clanIndex: clanIdx 
    });
    
    res.redirect(`/manage/${req.params.guildId}/clans`);
});


app.get('/manage/:guildId/clans/edit/:index', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const clan = await Clan.findOne({ guildId: g.id, clanIndex: parseInt(req.params.index) });
    if (!clan) return res.redirect(`/manage/${g.id}/clans`);

    const content = `
    <form method="POST" action="/update/${g.id}/clans/${clan.clanIndex}">
        <div class="card">
            <h3>تعديل كلان: ${clan.clanName}</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>اسم الكلان</label>
                    <input name="clanName" value="${clan.clanName}" required>
                </div>
                <div>
                    <label>ID القائد</label>
                    <input name="leaderId" value="${clan.leaderId}" required>
                </div>
                <div>
                    <label>رتبة الكلان</label>
                    <select name="roleId">
                        <option value="">-- بدون رتبة --</option>
                        ${g.roles.cache.filter(r => r.name !== '@everyone').map(r =>
                            `<option value="${r.id}" ${clan.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label>قناة نتائج التقديم</label>
                    <select name="resultsChannelId">
                        <option value="">-- اختر القناة --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c =>
                            `<option value="${c.id}" ${clan.resultsChannelId === c.id ? 'selected' : ''}># ${c.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <label>أسئلة التقديم</label>
            <textarea name="questions" rows="5">${(clan.questions || []).join('\n')}</textarea>
            <button type="submit" class="btn-save" style="margin-top:20px;">حفظ التعديلات</button>
        </div>
    </form>`;

    res.send(ui(g, 'clans', content));
});

app.post('/update/:guildId/clans/:index', checkAuth, async (req, res) => {
    const { clanName, leaderId, roleId, resultsChannelId, questions } = req.body;
    const questionsArray = questions ? questions.split('\n').filter(q => q.trim() !== '') : [];
    await Clan.findOneAndUpdate(
        { guildId: req.params.guildId, clanIndex: parseInt(req.params.index) },
        { $set: { clanName, leaderId, roleId, resultsChannelId, questions: questionsArray } }
    );
    res.redirect(`/manage/${req.params.guildId}/clans`);
});


// ==========================================
// 10. Discord Event Handlers
// ==========================================

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;

    const s = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (!s) return;

    // --- [ أمر قائمة المتصدرين ] ---
    if (s.levels?.enabled && s.levels.leaderboardCommand) {
        if (msg.content.trim() === s.levels.leaderboardCommand.trim()) {
            const topLevels = await UserLevel.find({ guildId: msg.guild.id }).sort({ level: -1, xp: -1 }).limit(15);
            if (topLevels.length === 0) return msg.reply('لا توجد بيانات مستويات.');

            const embed = new EmbedBuilder()
                .setTitle(`اعلى 15 ليفل في السيرفر`)
                .setColor(0x1e90ff)
                .setThumbnail(msg.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            let desc = topLevels.map((u, i) => {
                const medal = i === 0 ? '(1)' : i === 1 ? '(2)' : i === 2 ? '(3)' : `#${i + 1}`;
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
        if (!savedBanner) return msg.reply('لم يتم ضبط بنر لهذا السيرفر بعد. استخدم /setbanner أولاً.');
        await msg.delete().catch(() => {});
        return msg.channel.send({ files: [savedBanner] });
    }

    // --- [ نظام نقاط الكلان التلقائي (الرسائل) ] ---
    const memberClan = await Clan.findOne({ guildId: msg.guild.id, members: msg.author.id });
    if (memberClan) {
        let mData = await ClanMember.findOne({ guildId: msg.guild.id, userId: msg.author.id, clanIndex: memberClan.clanIndex });
        if (!mData) mData = new ClanMember({ guildId: msg.guild.id, userId: msg.author.id, clanIndex: memberClan.clanIndex });
        mData.msgCountForPoints = (mData.msgCountForPoints || 0) + 1;
        if (mData.msgCountForPoints >= 30) {
            mData.msgCountForPoints = 0;
            mData.points = (mData.points || 0) + 20;
            memberClan.points = (memberClan.points || 0) + 20;
            await memberClan.save();
        }
        await mData.save();
    }

    // --- [ جلب بيانات العضو ] ---
    let u = await UserLevel.findOne({ guildId: msg.guild.id, userId: msg.author.id });
    if (!u) u = new UserLevel({ guildId: msg.guild.id, userId: msg.author.id });

    // --- [ إحصائيات الرسائل ] ---
    await Stats.findOneAndUpdate(
        { guildId: msg.guild.id },
        { $inc: {
            'messages.total': 1,
            'messages.daily': 1,
            'messages.weekly': 1,
            'messages.monthly': 1,
            [`activeChannels.${msg.channel.id}`]: 1
        }},
        { upsert: true }
    ).catch(() => {});

    // --- [ نظام الحماية ] ---
    const hasBypass = msg.member.roles.cache.some(role => s.security?.bypassRoles?.includes(role.id));
    if (!hasBypass) {
        if (s.security?.badWords && s.security.badWords.trim().length > 0) {
            const forbiddenWords = s.security.badWords.split(',').map(w => w.trim()).filter(Boolean);
            const hasBadWord = forbiddenWords.some(word => {
                try {
                    const regex = new RegExp(`(?<=^|[^أ-يa-zA-Z0-9])${word}(?=[^أ-يa-zA-Z0-9]|$)`, 'iu');
                    return regex.test(msg.content);
                } catch { return msg.content.includes(word); }
            });
            if (hasBadWord) {
                await msg.delete().catch(() => {});
                return msg.channel.send(`${msg.author}، ممنوع استخدام هذه الكلمة!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        if (s.security?.badEmojis && s.security.badEmojis.trim().length > 0) {
            const forbiddenEmojis = s.security.badEmojis.split(',').map(e => e.trim()).filter(Boolean);
            const hasBadEmoji = forbiddenEmojis.some(emoji => msg.content.includes(emoji));
            if (hasBadEmoji) {
                await msg.delete().catch(() => {});
                return msg.channel.send(`${msg.author}، هذا الإيموجي ممنوع!`)
                    .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }

        if (s.security?.antiLinks && /(https?:\/\/)/.test(msg.content)) {
            await msg.delete().catch(() => {});
            return msg.channel.send(`${msg.author}، الروابط ممنوعة هنا!`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        }
    }

    // --- [ أمر !rolespanel ] ---
    if (msg.content === '!rolespanel') {
        const config = await GuildConfig.findOne({ guildId: msg.guild.id });
        if (!config?.rolesPanel?.length) return msg.reply('ما في رتب مضافة');
        const channel = msg.guild.channels.cache.get(config.rolesChannel);
        if (!channel) return msg.reply('الروم غير موجود');

        const rows = [];
        let row = new ActionRowBuilder();
        for (const r of config.rolesPanel) {
            if (r.type === 'button') {
                row.addComponents(new ButtonBuilder().setCustomId(`role_${r.roleId}`).setLabel(r.label).setStyle(ButtonStyle.Secondary));
            }
            if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); }
        }
        if (row.components.length > 0) rows.push(row);
        channel.send({ content: 'نظام الرتب', components: rows });
        msg.reply('تم إرسال لوحة الرتب');
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
                        .setDescription(`عدد الأيام: ${u.streakCount} يوم\n\nرسائل اليوم: ${u.dailyMsgs} رسالة\n\nينتهي خلال: <t:${Math.floor((new Date(u.lastMessageDate).getTime() + 86400000) / 1000)}:R>`)
                        .setThumbnail(msg.author.displayAvatarURL({ dynamic: true }))
                        .setColor(0xffac33)
                        .setFooter({ text: 'VORTEX System - استمر ولا تقطع!' })
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
        if (!userData) return msg.reply('هذا العضو ليس لديه سجلات تفاعل بعد.');

        const expiresAt = Math.floor((new Date(userData.lastMessageDate || Date.now()).getTime() + 86400000) / 1000);
        const embed = new EmbedBuilder()
            .setAuthor({ name: `إحصائيات الستريك لـ ${target.user.username}`, iconURL: target.user.displayAvatarURL() })
            .setDescription(`عدد الأيام: ${userData.streakCount || 0} يوم\n\nرسائل اليوم: ${userData.dailyMsgs || 0} رسالة\n\nينتهي خلال: <t:${expiresAt}:R>`)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .setColor(0xffac33)
            .setFooter({ text: 'VORTEX System - استمر ولا تقطع!' })
            .setTimestamp();
        msg.reply({ embeds: [embed] });
    }

    // --- [ أمر !توب-ستريك ] ---
    if (msg.content.startsWith('!توب') || msg.content.startsWith('!top-streak')) {
        const topUsers = await UserLevel.find({ guildId: msg.guild.id, streakCount: { $gt: 0 } }).sort({ streakCount: -1 }).limit(10);
        if (topUsers.length === 0) return msg.reply('لا يوجد متصدرين في نظام الستريك بعد.');

        const embed = new EmbedBuilder()
            .setTitle(`قائمة متصدري الستريك في ${msg.guild.name}`)
            .setColor(0xffac33)
            .setThumbnail(msg.guild.iconURL())
            .setTimestamp();

        let description = '';
        for (let i = 0; i < topUsers.length; i++) {
            const uData = topUsers[i];
            const medal = i === 0 ? '(1)' : i === 1 ? '(2)' : i === 2 ? '(3)' : `#${i + 1}`;
            description += `${medal} | <@${uData.userId}> — \`${uData.streakCount} يوم\`\n`;
        }
        embed.setDescription(description).setFooter({ text: 'VORTEX System - المنافسة مشتعلة!' });
        msg.reply({ embeds: [embed] });
    }

    // --- [ الرد الآلي ] ---
    const r = s.autoReply?.find(x => x.trigger && msg.content.toLowerCase() === x.trigger.toLowerCase());
    if (r) return msg.reply(r.reply).catch(() => {});

    // --- [ نظام المستويات ] ---
    if (s.levels?.enabled) {
        u.xp += s.levels.xpPerMessage || 10;
        u.msgCount++;
        if (u.xp >= u.level * u.level * 100) {
            u.level++;
            const lvChannel = msg.guild.channels.cache.get(s.levels.levelUpChannel) || msg.channel;
            lvChannel.send(`مبروك ${msg.author}! وصلت للمستوى **${u.level}**`).catch(() => {});
        }
        await u.save();
    }

    // --- [ أمر !setup لبانل التذاكر ] ---
    if (msg.content === '!setup' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const tConfig = await TicketConfig.findOne({ guildId: msg.guild.id });
        if (!tConfig) return msg.reply('اضبط الإعدادات من الداشبورد أولاً!');

        const embed = new EmbedBuilder()
            .setTitle(tConfig.title || 'الدعم الفني')
            .setDescription(tConfig.description || 'اضغط أدناه لفتح تذكرة')
            .setColor(parseInt((tConfig.color || '#1e90ff').replace('#', ''), 16));

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
                    try { button.setEmoji(/^\d+$/.test(em) ? { id: em } : em); } catch (e) {}
                }
                btnRow.addComponents(button);
            });
            if (btnRow.components.length > 0) components.push(btnRow);
        }
        if (Array.isArray(tConfig.menuOptions) && tConfig.menuOptions.length > 0) {
            const select = new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('اختر من القائمة...');
            tConfig.menuOptions.forEach((opt, i) => {
                if (!opt.label) return;
                const option = { label: opt.label, value: `ticket_opt_${i}` };
                if (opt.emoji) {
                    const em = opt.emoji.trim();
                    try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) {}
                }
                select.addOptions(option);
            });
            if (select.options.length > 0) components.push(new ActionRowBuilder().addComponents(select));
        }
        if (components.length === 0) {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setStyle(ButtonStyle.Primary)
            ));
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
        bgGradient.addColorStop(0, '#050510');
        bgGradient.addColorStop(0.5, '#0a0a20');
        bgGradient.addColorStop(1, '#050510');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, 850, 500);

        ctx.strokeStyle = '#1e90ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, 834, 484);

        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 150, 90, 0, Math.PI * 2);
        ctx.strokeStyle = '#1e90ff';
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

        ctx.font = '28px Arial';
        if (clanData) {
            ctx.fillStyle = '#1e90ff';
            ctx.fillText(`Clan: ${clanData.clanName}`, 270, 175);
        } else {
            ctx.fillStyle = '#e63946';
            ctx.fillText('No Clan Joined', 270, 175);
        }

        function drawStatBox(x, y, label, value) {
            ctx.fillStyle = 'rgba(30, 144, 255, 0.08)';
            ctx.beginPath();
            ctx.roundRect(x, y, 240, 160, 16);
            ctx.fill();
            ctx.strokeStyle = 'rgba(30, 144, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1e90ff';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(label, x + 120, y + 48);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(value, x + 120, y + 118);
        }

        drawStatBox(50, 300, 'LEVEL', uData.level);
        drawStatBox(305, 300, 'STREAK', uData.streakCount);
        drawStatBox(560, 300, 'MESSAGES', uData.msgCount || 0);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'vortex-profile.png' });
        msg.reply({ files: [attachment] });
    }

    // --- [ أمر تحكم (الكلانات) - يجب أن يكون قبل فحص السجن ] ---
    if (msg.content === 'تحكم') {
        const myClan = await Clan.findOne({
            guildId: msg.guild.id,
            $or: [{ leaderId: msg.author.id }, { assistantIds: msg.author.id }]
        });
        if (!myClan) return msg.reply('هذا الأمر مخصص لقادة الكلان ومساعديهم فقط.');

        const isLeader = myClan.leaderId === msg.author.id;

        const options = [
            { label: 'اضافة عضو', value: 'add_mem', description: 'اضافة عضو جديد للكلان' },
            { label: 'طرد عضو', value: 'kick_mem', description: 'طرد عضو من الكلان' },
            { label: 'إحصائيات الكلان', value: 'show_stats', description: 'عرض معلومات وإحصائيات الكلان' },
        ];

        if (isLeader) {
            options.push({ label: 'اضافة مساعد', value: 'add_assist', description: 'ترقية عضو لمساعد' });
            options.push({ label: 'سحب رتبة مساعد', value: 'remove_assist', description: 'سحب رتبة المساعد (لا يطرده من الكلان)' });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`clan_control_${myClan.clanIndex}`)
            .setPlaceholder('لوحة إدارة الكلان')
            .addOptions(options);

        const embed = new EmbedBuilder()
            .setTitle(`لوحة تحكم كلان ${myClan.clanName}`)
            .setDescription(`مرحباً ${msg.author}، اختر الإجراء المطلوب من القائمة أدناه.`)
            .setColor(0x1e90ff)
            .setFooter({ text: 'VORTEX System - Clans Control' });

        return msg.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    }

    // --- [ نظام السجن ] ---
    const modConfig = await ModConfig.findOne({ guildId: msg.guild.id });
    if (modConfig && modConfig.jail && msg.content.startsWith('!')) {
        const prefix = '!';
        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // أمر السجن
        if (command === modConfig.jail.commandName.toLowerCase()) {
            const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
            const hasAdminRole = modConfig.jail.adminRoles?.some(rId => msg.member.roles.cache.has(rId));
            if (!isAdmin && !hasAdminRole) return msg.reply('عذراً، هذا الأمر مخصص للإدارة فقط!');

            const target = msg.mentions.members.first();
            const timeInput = args.find(arg => /\d+[smhdw]/.test(arg));

            if (!target || !timeInput) return msg.reply(`الاستخدام الصحيح: \`!${command} @user 1h\``);
            if (target.id === msg.author.id) return msg.reply('لا يمكنك سجن نفسك!');
            if (target.user.bot) return msg.reply('لا يمكنك سجن البوتات!');

            if (msg.author.id !== msg.guild.ownerId) {
                if (target.roles.highest.position >= msg.member.roles.highest.position) {
                    return msg.reply('لا يمكنك سجن شخص رتبته أعلى منك أو مساوية لرتبتك!');
                }
            }

            const durationMs = ms(timeInput);
            if (!durationMs) return msg.reply('صيغة الوقت غير صحيحة (مثال: 10m, 1h, 1d)');

            const jailRole = msg.guild.roles.cache.get(modConfig.jail.roleId);
            if (!jailRole) return msg.reply('رتبة السجن غير مضبوطة في الداشبورد!');

            try {
                const currentRoles = target.roles.cache.filter(r => r.id !== msg.guild.id).map(r => r.id);
                await JailData.findOneAndUpdate(
                    { guildId: msg.guild.id, userId: target.id },
                    { oldRoles: currentRoles, endAt: new Date(Date.now() + durationMs) },
                    { upsert: true }
                );

                // سحب كل الرتب وإعطاء رتبة السجن فقط
                await target.roles.set([jailRole.id]).catch(() => {
                    return msg.reply('فشل سحب الرتب، تأكد أن رتبة البوت أعلى من رتبة العضو.');
                });

                // إخفاء كل الرومات عن المسجون (تلقائي عبر رتبة السجن)
                // يجب أن تكون رتبة السجن تمنع ViewChannel في كل الرومات
                const jailChannel = msg.guild.channels.cache.get(modConfig.jail.channelId);
                if (jailChannel) {
                    // السماح للمسجون برؤية روم السجن فقط
                    await jailChannel.permissionOverwrites.edit(target.id, {
                        ViewChannel: true,
                        SendMessages: true
                    }).catch(() => {});
                }

                const embed = new EmbedBuilder()
                    .setTitle('تم السجن')
                    .setDescription(`تم سجن ${target} لمدة **${timeInput}**`)
                    .setColor(0xe63946)
                    .addFields(
                        { name: 'العضو', value: `${target}`, inline: true },
                        { name: 'بواسطة', value: `${msg.author}`, inline: true },
                        { name: 'المدة', value: timeInput, inline: true }
                    )
                    .setTimestamp();

                msg.channel.send({ embeds: [embed] });
                setTimeout(async () => { await handleUnjail(target, msg.guild.id); }, durationMs);
            } catch (e) {
                console.error('[Jail Error]', e);
                msg.reply('حدث خطأ فني أثناء محاولة السجن.');
            }
        }

        // أمر فك السجن
        if (command === (modConfig.jail.unjailCommand || 'unjail').toLowerCase()) {
            const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
            const hasAdminRole = modConfig.jail.adminRoles?.some(rId => msg.member.roles.cache.has(rId));
            if (!isAdmin && !hasAdminRole) return msg.reply('عذراً، لا تملك صلاحيات لفك السجن!');

            const target = msg.mentions.members.first();
            if (!target) return msg.reply('يرجى منشن العضو لفك سجنه!');
            await handleUnjail(target, msg.guild.id);

            const embed = new EmbedBuilder()
                .setTitle('فك السجن')
                .setDescription(`تم فك سجن ${target} واسترجاع رتبه كاملة.`)
                .setColor(0x00c853)
                .setTimestamp();
            msg.channel.send({ embeds: [embed] });
        }
    }

});
// (clan control block moved above jail block)

// ==========================================
// 11. Audit Log Events (بدون إيموجي في اللوق)
// ==========================================

client.on('messageDelete', async (message) => {
    if (!message.guild || !message.author) return;
    const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete }).catch(() => {});
    const executor = logs?.entries.first()?.executor;

    const embed = new EmbedBuilder()
        .setTitle('رسالة محذوفة')
        .setColor(0xe63946)
        .addFields(
            { name: 'صاحب الرسالة', value: `<@${message.author.id}>`, inline: true },
            { name: 'حذفها', value: executor ? `<@${executor.id}>` : 'غير معروف', inline: true },
            { name: 'القناة', value: `<#${message.channel.id}>`, inline: true },
            { name: 'المحتوى', value: message.content || '(لا يوجد نص)' }
        )
        .setTimestamp();

    await sendLog(message.guild, 'messages', embed);
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;

    const embed = new EmbedBuilder()
        .setTitle('رسالة معدلة')
        .setColor(0xf39c12)
        .addFields(
            { name: 'العضو', value: `<@${oldMsg.author.id}>`, inline: true },
            { name: 'القناة', value: `<#${oldMsg.channel.id}>`, inline: true },
            { name: 'قبل', value: oldMsg.content || '(فارغ)' },
            { name: 'بعد', value: newMsg.content || '(فارغ)' }
        )
        .setTimestamp();

    await sendLog(oldMsg.guild, 'messages', embed);
});

client.on('guildMemberAdd', async (member) => {
    // إحصائيات
    await Stats.findOneAndUpdate(
        { guildId: member.guild.id },
        { $push: { 'membersLog.joined': new Date() } },
        { upsert: true }
    );

    // لوق الأعضاء
    const logEmbed = new EmbedBuilder()
        .setTitle('عضو جديد انضم')
        .setColor(0x00c853)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields({ name: 'العضو', value: `${member.user.tag} (<@${member.id}>)`, inline: true })
        .setTimestamp();
    await sendLog(member.guild, 'members', logEmbed);

    // نظام الترحيب
    const config = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!config?.welcome?.enabled || !config.welcome.channel) return;

    const welcomeChannel = member.guild.channels.cache.get(config.welcome.channel);
    if (!welcomeChannel) return;

    try {
        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext('2d');

        const bgUrl = config.welcome.imagePath || 'https://placehold.co/800x400/050510/1e90ff?text=Welcome';
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
        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.drawImage(avatar, x - (avW / 2), y - (avH / 2), avW, avH);
        ctx.restore();

        ctx.strokeStyle = '#1e90ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });

        const welcomeMsg = (config.welcome.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!')
            .replace(/{member}/g, `<@${member.id}>`)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('عضو جديد انضم إلينا')
            .setDescription(welcomeMsg)
            .setColor(0x1e90ff)
            .setImage('attachment://welcome-image.png')
            .setTimestamp()
            .setFooter({ text: `VORTEX System - العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });

        welcomeChannel.send({ embeds: [welcomeEmbed], files: [attachment] });
    } catch (err) {
        console.error('[Welcome Error]', err);
    }
});

client.on('guildMemberRemove', async (member) => {
    const embed = new EmbedBuilder()
        .setTitle('عضو غادر')
        .setColor(0xe63946)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields({ name: 'العضو', value: `${member.user.tag} (<@${member.id}>)`, inline: true })
        .setTimestamp();
    await sendLog(member.guild, 'members', embed);
    await Stats.findOneAndUpdate({ guildId: member.guild.id }, { $push: { 'membersLog.left': new Date() } }, { upsert: true });
});

client.on('guildBanAdd', async (ban) => {
    const executor = await getExecutor(ban.guild, AuditLogEvent.MemberBan);
    const embed = new EmbedBuilder()
        .setTitle('عضو محظور')
        .setColor(0x8b0000)
        .addFields(
            { name: 'العضو', value: `${ban.user.tag}`, inline: true },
            { name: 'بواسطة', value: executor, inline: true }
        )
        .setTimestamp();
    await sendLog(ban.guild, 'moderation', embed);
    await Stats.findOneAndUpdate({ guildId: ban.guild.id }, { $inc: { 'modActions.bans': 1 } }, { upsert: true });
});

client.on('guildBanRemove', async (ban) => {
    const executor = await getExecutor(ban.guild, AuditLogEvent.MemberUnban);
    const embed = new EmbedBuilder()
        .setTitle('رُفع الحظر عن عضو')
        .setColor(0x00c853)
        .addFields(
            { name: 'العضو', value: `${ban.user.tag}`, inline: true },
            { name: 'بواسطة', value: executor, inline: true }
        )
        .setTimestamp();
    await sendLog(ban.guild, 'moderation', embed);
});

client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('قناة جديدة')
        .setColor(0x1e90ff)
        .addFields({ name: 'القناة', value: `${channel.name} (<#${channel.id}>)` })
        .setTimestamp();
    await sendLog(channel.guild, 'channels', embed);
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const embed = new EmbedBuilder()
        .setTitle('قناة محذوفة')
        .setColor(0xe63946)
        .addFields({ name: 'القناة', value: channel.name })
        .setTimestamp();
    await sendLog(channel.guild, 'channels', embed);
});

client.on('roleCreate', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle('رتبة جديدة')
        .setColor(0x00c853)
        .addFields({ name: 'الرتبة', value: role.name })
        .setTimestamp();
    await sendLog(role.guild, 'roles', embed);
});

client.on('roleDelete', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle('رتبة محذوفة')
        .setColor(0xe63946)
        .addFields({ name: 'الرتبة', value: role.name })
        .setTimestamp();
    await sendLog(role.guild, 'roles', embed);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = oldState.guild || newState.guild;
    if (!guild) return;

    let embed;
    if (!oldState.channel && newState.channel) {
        embed = new EmbedBuilder()
            .setTitle('دخل روم صوتي')
            .setColor(0x00c853)
            .addFields(
                { name: 'العضو', value: `<@${newState.member.id}>`, inline: true },
                { name: 'الروم', value: newState.channel.name, inline: true }
            )
            .setTimestamp();
    } else if (oldState.channel && !newState.channel) {
        embed = new EmbedBuilder()
            .setTitle('غادر روم صوتي')
            .setColor(0xe63946)
            .addFields(
                { name: 'العضو', value: `<@${oldState.member.id}>`, inline: true },
                { name: 'الروم', value: oldState.channel.name, inline: true }
            )
            .setTimestamp();
    }
    if (embed) await sendLog(guild, 'voice', embed);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.guild) return;

        // --- [ Slash Commands ] ---
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setbanner') {
                const image = interaction.options.getAttachment('image');
                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { $set: { 'welcome.bannerURL': image.url } },
                    { upsert: true }
                );
                return interaction.reply({ content: 'تم حفظ البنر بنجاح!', flags: [MessageFlags.Ephemeral] });
            }

            if (interaction.commandName === 'rename_panel') {
                const name = interaction.options.getString('name');
                const image = interaction.options.getAttachment('image');

                const embed = new EmbedBuilder()
                    .setTitle('لوحة تغيير الاسم')
                    .setDescription(`اضغط على الزر لتغيير اسمك إلى: **${name}**`)
                    .setColor(0x1e90ff);
                if (image) embed.setImage(image.url);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`rename_user:${name}`).setLabel(`تغيير الاسم إلى ${name}`).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('reset_name').setLabel('إرجاع الاسم الأصلي').setStyle(ButtonStyle.Secondary)
                );
                await interaction.channel.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: 'تم إرسال اللوحة!', flags: [MessageFlags.Ephemeral] });
            }
        }

        // --- [ Clan Apply Button ] ---
        if (interaction.isButton() && interaction.customId.startsWith('apply_clan_')) {
            const clanId = interaction.customId.replace('apply_clan_', '');
            const clan = await Clan.findById(clanId).catch(() => null);
            if (!clan) return interaction.reply({ content: 'الكلان غير موجود.', flags: [MessageFlags.Ephemeral] });

            const thread = await interaction.channel.threads.create({
                name: `تقديم-${clan.clanName}-${interaction.user.username}`,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
            }).catch(async () => {
                return await interaction.channel.threads.create({
                    name: `تقديم-${clan.clanName}-${interaction.user.username}`,
                    autoArchiveDuration: 60,
                    type: ChannelType.PublicThread,
                }).catch(() => null);
            });

            if (!thread) return interaction.reply({ content: 'فشل إنشاء قناة التقديم.', flags: [MessageFlags.Ephemeral] });

            await thread.members.add(interaction.user.id);
            await interaction.reply({ content: `تم فتح قناة التقديم: ${thread}`, flags: [MessageFlags.Ephemeral] });
            await askNextQuestion(thread, interaction.user, clan, 0, interaction.guild);
            return;
        }

        // --- [ Clan Application Confirmation Buttons ] ---
        if (interaction.isButton() && interaction.customId.startsWith('conf_')) {
            const parts = interaction.customId.split('_');
            const status = parts[1];
            const clanId = parts[2];
            const qIndex = parseInt(parts[3]);
            const clan = await Clan.findById(clanId).catch(() => null);
            if (!clan) return interaction.reply({ content: 'الكلان غير موجود.', flags: [MessageFlags.Ephemeral] });

            await interaction.message.delete().catch(() => {});
            if (status === 'yes') {
                await askNextQuestion(interaction.channel, interaction.user, clan, qIndex + 1, interaction.guild);
            } else {
                await askNextQuestion(interaction.channel, interaction.user, clan, qIndex, interaction.guild);
            }
            return;
        }

        // --- [ Accept / Reject Clan Member ] ---
        if (interaction.isButton() && (interaction.customId.startsWith('accept_member:') || interaction.customId.startsWith('reject_member:'))) {
            const parts = interaction.customId.split(':');
            const action = parts[0];
            const targetId = parts[1];
            
            // تحقق صارم من وجود القيمة وتحويلها
            if (!parts[2] || isNaN(parseInt(parts[2]))) {
                return interaction.reply({ content: '❌ خطأ: لم يتم العثور على رقم الكلان في هذا الزر.', flags: [MessageFlags.Ephemeral] });
            }
            const clanIdx = parseInt(parts[2]);

            const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: clanIdx });
            if (!clan) return interaction.reply({ content: 'الكلان غير موجود.', flags: [MessageFlags.Ephemeral] });

            if (interaction.user.id !== clan.leaderId) {
                return interaction.reply({ content: 'أنت لست قائد هذا الكلان!', flags: [MessageFlags.Ephemeral] });
            }

            await interaction.deferUpdate();
            const targetUser = await client.users.fetch(targetId).catch(() => null);

            if (action === 'accept_member') {
                if (clan.members.length >= 10) return interaction.followUp({ content: 'الكلان ممتلئ (10 أعضاء كحد أقصى)!', flags: [MessageFlags.Ephemeral] });
                if (!clan.members.includes(targetId)) {
                    clan.members.push(targetId);
                    await clan.save();
                }
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (member && clan.roleId) await member.roles.add(clan.roleId).catch(() => {});
                if (targetUser) targetUser.send(`مبروك! تم قبولك في كلان **${clan.clanName}**`).catch(() => {});
                await interaction.editReply({ content: `تم قبول <@${targetId}> بنجاح.`, components: [], embeds: interaction.message.embeds });
            } else if (action === 'reject_member') {
                if (targetUser) targetUser.send(`للأسف، تم رفض طلب انضمامك لكلان **${clan.clanName}**`).catch(() => {});
                await interaction.editReply({ content: `تم رفض <@${targetId}>.`, components: [], embeds: interaction.message.embeds });
            }
            return;
        }

          // --- [ Clan Control Select Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('clan_control_')) {
            // استخراج الأرقام فقط من الـ customId لمنع خطأ NaN نهائياً
            const cleanNumbers = interaction.customId.replace(/[^0-9]/g, '');
            const clanIdx = parseInt(cleanNumbers);

            if (isNaN(clanIdx)) {
                return interaction.reply({ content: '❌ خطأ: لم يتم التعرف على رقم الكلان بشكل صحيح.', flags: ['Ephemeral'] });
            }

            const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: clanIdx });
            if (!clan) return interaction.reply({ content: 'الكلان غير موجود.', flags: ['Ephemeral'] });

            const isLeader = clan.leaderId === interaction.user.id;
            const isAssistant = clan.assistantIds?.includes(interaction.user.id);
            if (!isLeader && !isAssistant) return interaction.reply({ content: 'ليس لديك صلاحية.', flags: ['Ephemeral'] });

            const selected = interaction.values[0];

            if (selected === 'show_stats') {
                const membersList = clan.members.length > 0 ? clan.members.map(id => `<@${id}>`).join(', ') : 'لا يوجد أعضاء';
                const assistantsList = clan.assistantIds?.length > 0 ? clan.assistantIds.map(id => `<@${id}>`).join(', ') : 'لا يوجد مساعدين';

                const embed = new EmbedBuilder()
                    .setTitle(`إحصائيات كلان ${clan.clanName}`)
                    .setColor(0x1e90ff)
                    .addFields(
                        { name: 'القائد', value: `<@${clan.leaderId}>`, inline: true },
                        { name: 'عدد الأعضاء', value: `${clan.members.length}/10`, inline: true },
                        { name: 'النقاط', value: `${clan.points || 0}`, inline: true },
                        { name: 'الأعضاء', value: membersList },
                        { name: 'المساعدون', value: assistantsList }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'VORTEX System - Clans' });

                return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
            }

            const modalTitle = {
                'add_mem': 'اضافة عضو للكلان',
                'kick_mem': 'طرد عضو من الكلان',
                'add_assist': 'اضافة مساعد',
                'remove_assist': 'سحب رتبة مساعد'
            }[selected];

            if (modalTitle) {
                if ((selected === 'add_assist' || selected === 'remove_assist') && !isLeader) {
                    return interaction.reply({ content: 'هذا الخيار للقائد فقط.', flags: ['Ephemeral'] });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`clmod_${selected}_${clanIdx}`)
                    .setTitle(modalTitle);
                
                const input = new TextInputBuilder()
                    .setCustomId('member_id')
                    .setLabel('ID العضو / المساعد')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('ادخل الـ ID هنا...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }
        }

        // --- [ Clan Control Modals ] ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('clmod_')) {
            const parts = interaction.customId.split('_');
            const action = parts[1];
            
            if (!parts[2] || isNaN(parseInt(parts[2]))) {
                return interaction.reply({ content: 'خطأ في معالجة بيانات رقم الكلان من النموذج.', flags: [MessageFlags.Ephemeral] });
            }
            const clanIdx = parseInt(parts[2]);
            const memberId = interaction.fields.getTextInputValue('member_id').trim();

            const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex: clanIdx });
            if (!clan) return interaction.reply({ content: 'الكلان غير موجود.', flags: [MessageFlags.Ephemeral] });

            if (action === 'add_mem') {
                if (clan.members.length >= 10) return interaction.reply({ content: 'الكلان ممتلئ!', flags: [MessageFlags.Ephemeral] });
                if (clan.members.includes(memberId)) return interaction.reply({ content: 'العضو موجود مسبقاً.', flags: [MessageFlags.Ephemeral] });
                clan.members.push(memberId);
                await clan.save();
                const mem = await interaction.guild.members.fetch(memberId).catch(() => null);
                if (mem && clan.roleId) await mem.roles.add(clan.roleId).catch(() => {});
                return interaction.reply({ content: `تمت إضافة <@${memberId}> للكلان بنجاح.`, flags: [MessageFlags.Ephemeral] });
            }
            
            if (action === 'kick_mem') {
                clan.members = clan.members.filter(id => id !== memberId);
                clan.assistantIds = (clan.assistantIds || []).filter(id => id !== memberId);
                await clan.save();
                const mem = await interaction.guild.members.fetch(memberId).catch(() => null);
                if (mem && clan.roleId) await mem.roles.remove(clan.roleId).catch(() => {});
                return interaction.reply({ content: `تم طرد <@${memberId}> من الكلان.`, flags: [MessageFlags.Ephemeral] });
            }

            if (action === 'add_assist') {
                if (!clan.members.includes(memberId)) return interaction.reply({ content: 'العضو ليس في الكلان، أضفه أولاً.', flags: [MessageFlags.Ephemeral] });
                if (!clan.assistantIds) clan.assistantIds = [];
                if (!clan.assistantIds.includes(memberId)) clan.assistantIds.push(memberId);
                await clan.save();
                return interaction.reply({ content: `تمت ترقية <@${memberId}> لمساعد بنجاح.`, flags: [MessageFlags.Ephemeral] });
            }

            if (action === 'remove_assist') {
                clan.assistantIds = (clan.assistantIds || []).filter(id => id !== memberId);
                await clan.save();
                return interaction.reply({ content: `تم سحب رتبة المساعد من <@${memberId}>.`, flags: [MessageFlags.Ephemeral] });
            }
        }

        // --- [ Self Roles ] ---
        if (interaction.isButton() && interaction.customId.startsWith('role_')) {
            try {
                const roleId = interaction.customId.replace('role_', '');
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: 'الرتبة غير موجودة.', flags: [MessageFlags.Ephemeral] });

                const guildData = await GuildConfig.findOne({ guildId: interaction.guild.id });
                const allPanelRoles = (guildData?.rolesPanel || []).map(r => r.roleId);

                if (interaction.member.roles.cache.has(roleId)) {
                    await interaction.member.roles.remove(roleId).catch(() => {});
                    return interaction.reply({ content: `تم سحب رتبة **${role.name}** منك.`, flags: [MessageFlags.Ephemeral] });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({ content: 'رتبة البوت أقل من الرتبة المطلوبة.', flags: [MessageFlags.Ephemeral] });
                }

                if (allPanelRoles.length > 0) {
                    const rolesToRemove = interaction.member.roles.cache.filter(r => allPanelRoles.includes(r.id));
                    if (rolesToRemove.size > 0) await interaction.member.roles.remove(rolesToRemove).catch(() => {});
                }

                await interaction.member.roles.add(roleId);
                return interaction.reply({ content: `تم إعطاؤك رتبة **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
            } catch (err) {
                console.error('[Role Error]', err);
                if (!interaction.replied) interaction.reply({ content: 'حدث خطأ، جرب مرة أخرى.', flags: [MessageFlags.Ephemeral] });
            }
        }

        // --- [ Rename Buttons ] ---
        if (interaction.isButton() && interaction.customId.startsWith('rename_user:')) {
            const newName = interaction.customId.split(':')[1];
            const setResult = await interaction.member.setNickname(newName).catch(() => null);
            if (!setResult) return interaction.reply({ content: 'ما بقدر أغير الاسم (تأكد من صلاحياتي)', flags: [MessageFlags.Ephemeral] });
            return interaction.reply({ content: `تم تغيير اسمك إلى: ${newName}`, flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.isButton() && interaction.customId === 'reset_name') {
            const setResult = await interaction.member.setNickname(null).catch(() => null);
            if (!setResult) return interaction.reply({ content: 'ما بقدر أرجع الاسم', flags: [MessageFlags.Ephemeral] });
            return interaction.reply({ content: 'تم ارجاع اسمك الأصلي', flags: [MessageFlags.Ephemeral] });
        }

        // --- [ Ticket Buttons ] ---
        if (interaction.isButton() && (interaction.customId === 'open_ticket' || interaction.customId.startsWith('ticket_btn_'))) {
            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return interaction.reply({ content: 'لم يتم العثور على إعدادات التذاكر.', flags: [MessageFlags.Ephemeral] });

            let ticketType = 'تذكرة دعم';
            if (interaction.customId.startsWith('ticket_btn_')) {
                const btnIndex = parseInt(interaction.customId.replace('ticket_btn_', ''));
                if (tConfig.buttons?.[btnIndex]) ticketType = tConfig.buttons[btnIndex].label;
            }
            await openTicket(interaction, tConfig, ticketType);
        }
    } catch (err) {
        console.error('[Interaction Error]', err);
    }
});


async function openTicket(interaction, tConfig, ticketType) {
    const existingTicket = await TicketData.findOne({ guildId: interaction.guild.id, ownerId: interaction.user.id, closedAt: null });
    if (existingTicket) {
        return interaction.reply({ content: `لديك تكت مفتوح بالفعل: <#${existingTicket.channelId}>`, flags: [MessageFlags.Ephemeral] });
    }

    const ticketCount = await TicketData.countDocuments({ guildId: interaction.guild.id }) + 1;
    const channelName = `ticket-${ticketCount}-${interaction.user.username}`;

    const permOverwrites = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ];
    if (tConfig.adminRole) {
        permOverwrites.push({ id: tConfig.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
    }

    const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: permOverwrites
    }).catch(() => null);

    if (!ticketChannel) return interaction.reply({ content: 'فشل إنشاء قناة التكت.', flags: [MessageFlags.Ephemeral] });

    const ticketDoc = await TicketData.create({
        guildId: interaction.guild.id,
        channelId: ticketChannel.id,
        ownerId: interaction.user.id,
        ticketType,
        openedAt: new Date()
    });

    const files = [];
    const embed = new EmbedBuilder()
        .setTitle(`تكت ${ticketType} | #${ticketCount}`)
        .setDescription(`مرحباً ${interaction.user}!\n\nالإدارة ستتواصل معك قريباً. يرجى شرح مشكلتك بالتفصيل.`)
        .setColor(0x1e90ff)
        .addFields(
            { name: 'صاحب التكت', value: `${interaction.user}`, inline: true },
            { name: 'النوع', value: ticketType, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'VORTEX System - Tickets' });

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

    const controlMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_control_menu')
        .setPlaceholder('لوحة التحكم بالتكت')
        .addOptions([
            { label: 'استلام التكت', value: 'claim_ticket', description: 'استلام التكت للمعالجة' },
            { label: 'اغلاق التكت', value: 'close_ticket', description: 'اغلاق وحذف التكت' },
            { label: 'اضافة شخص', value: 'add_member', description: 'اضافة شخص للتكت' },
            { label: 'ازالة شخص', value: 'remove_member', description: 'ازالة شخص من التكت' },
            { label: 'استدعاء صاحب التكت', value: 'summon_member', description: 'منشن صاحب التكت' }
        ]);

    await ticketChannel.send({
        content: `${interaction.user} ${tConfig.adminRole ? `<@&${tConfig.adminRole}>` : ''}`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(controlMenu)],
        files
    }).catch(e => console.error('[Ticket Channel Send Error]', e));

    return interaction.reply({ content: `تم فتح تكتك: ${ticketChannel}`, flags: [MessageFlags.Ephemeral] });
}

async function askNextQuestion(thread, user, clan, questionIndex, guild) {
    if (questionIndex >= clan.questions.length) {
        // جمع الإجابات من سجل الثريد
        const messages = await thread.messages.fetch({ limit: 100 }).catch(() => new Map());
        const answers = [];
        messages.forEach(m => {
            if (!m.author.bot && m.content) answers.unshift(m.content);
        });

        const resultsChannel = guild.channels.cache.get(clan.resultsChannelId);
        if (resultsChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`طلب انضمام جديد - ${clan.clanName}`)
                .setColor(0x1e90ff)
                .setThumbnail(user.displayAvatarURL())
                .addFields({ name: 'المتقدم', value: `${user} (${user.tag})`, inline: false })
                .setTimestamp()
                .setFooter({ text: 'VORTEX System - Clans' });

            clan.questions.forEach((q, i) => {
                embed.addFields({ name: `السؤال ${i + 1}: ${q}`, value: answers[i] || 'لم يجب' });
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_member:${user.id}:${clan.clanIndex}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reject_member:${user.id}:${clan.clanIndex}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
            );

            await resultsChannel.send({ embeds: [embed], components: [row] });
        }

        await thread.send('شكراً! تم إرسال طلبك للإدارة. سيتم إخطارك بالنتيجة قريباً.');
        setTimeout(() => thread.delete().catch(() => {}), 5000);
        return;
    }

    const embed = new EmbedBuilder()
        .setDescription(`**السؤال ${questionIndex + 1}/${clan.questions.length}:**\n${clan.questions[questionIndex]}`)
        .setColor(0x1e90ff)
        .setFooter({ text: `VORTEX System - ${clan.clanName}` });

    await thread.send({ embeds: [embed] });

    const filter = m => m.author.id === user.id;
    const collector = thread.createMessageCollector({ filter, max: 1, time: 120000 });

    collector.on('collect', async (m) => {
        await askNextQuestion(thread, user, clan, questionIndex + 1, guild);
    });

    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            await thread.send('انتهى الوقت! تم إلغاء التقديم.');
            setTimeout(() => thread.delete().catch(() => {}), 3000);
        }
    });
}

// ==========================================
// 14. Kick Live Checker
// ==========================================

async function checkKickLive() {
    try {
        const allConfigs = await KickConfig.find({});
        for (const config of allConfigs) {
            if (!config.streamers || config.streamers.length === 0) continue;

            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;

            for (let i = 0; i < config.streamers.length; i++) {
                const streamer = config.streamers[i];
                if (!streamer.kickUsername) continue;

                try {
                    const response = await fetch(`https://kick.com/api/v1/channels/${streamer.kickUsername}`, {
                        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                    });

                    if (!response.ok) continue;
                    const data = await response.json();
                    const isLive = data?.livestream !== null && data?.livestream !== undefined;

                    if (isLive && !streamer.isLive) {
                        config.streamers[i].isLive = true;
                        config.markModified('streamers');
                        await config.save();

                        const channel = guild.channels.cache.get(streamer.channelId);
                        if (!channel) continue;

                        const streamTitle = data.livestream?.session_title || 'بث مباشر';
                        const streamCategory = data.livestream?.categories?.[0]?.name || 'غير محدد';
                        const thumbnailUrl = data.user?.profile_pic || '';
                        const viewers = data.livestream?.viewer_count || 0;

                        const embed = new EmbedBuilder()
                            .setTitle(`${streamer.kickUsername} بدأ البث المباشر`)
                            .setDescription(
                                (streamer.customMessage || '%name% بدأ البث الآن!').replace(/%name%/g, streamer.kickUsername)
                            )
                            .setURL(`https://kick.com/${streamer.kickUsername}`)
                            .setColor(0x53fc18)
                            .addFields(
                                { name: 'عنوان البث', value: streamTitle, inline: true },
                                { name: 'الفئة', value: streamCategory, inline: true },
                                { name: 'المشاهدون', value: `${viewers}`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'VORTEX System - Kick Notifications' });

                        if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

                        const mentionContent = streamer.roleId ? `<@&${streamer.roleId}>` : '';
                        await channel.send({ content: mentionContent || undefined, embeds: [embed] });

                    } else if (!isLive && streamer.isLive) {
                        config.streamers[i].isLive = false;
                        config.markModified('streamers');
                        await config.save();
                    }
                } catch (err) {
                    // تجاهل أخطاء API كيك الفردية
                }
            }
        }
    } catch (err) {
        console.error('[Kick Checker Error]', err);
    }
}

setInterval(checkKickLive, 60000);

// ==========================================
// 15. Slash Commands Registration
// ==========================================

async function registerSlashCommands() {
    const commands = [
        new SlashCommandBuilder, MessageFlags()
            .setName('setbanner')
            .setDescription('ضبط بنر الترحيب')
            .addAttachmentOption(opt => opt.setName('image').setDescription('صورة البنر').setRequired(true)),
        new SlashCommandBuilder, MessageFlags()
            .setName('rename_panel')
            .setDescription('إرسال لوحة تغيير الاسم')
            .addStringOption(opt => opt.setName('name').setDescription('الاسم الجديد').setRequired(true))
            .addAttachmentOption(opt => opt.setName('image').setDescription('صورة اللوحة').setRequired(false)),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('[VORTEX] Slash commands registered.');
    } catch (err) {
        console.error('[Slash Register Error]', err);
    }
}

// ==========================================
// 16. Client Ready
// ==========================================

client.once('ready', async () => {
    console.log(`[VORTEX] Bot is online as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'VORTEX System', type: ActivityType.Watching }],
        status: 'online'
    });

    // استئناف السجون المنتهية
    try {
        const now = new Date();
        const expiredJails = await JailData.find({ endAt: { $lte: now } });
        for (const jailEntry of expiredJails) {
            const guild = client.guilds.cache.get(jailEntry.guildId);
            if (!guild) continue;
            const member = await guild.members.fetch(jailEntry.userId).catch(() => null);
            if (member) await handleUnjail(member, jailEntry.guildId);
        }
    } catch (err) {
        console.error('[Jail Resume Error]', err);
    }

    await registerSlashCommands();
    checkKickLive();
});

// ==========================================
// 17. Start Server & Login
// ==========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[VORTEX] Dashboard running on port ${PORT}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('[VORTEX] Login failed:', err);
    process.exit(1);
});
