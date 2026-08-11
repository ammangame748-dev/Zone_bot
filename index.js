
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
    REST, Routes, SlashCommandBuilder
} = require('discord.js');

// ==========================================
// 1. تعريف الـ Schemas (قاعدة البيانات)
// ==========================================


const AdminCmdConfig = mongoose.model('AdminCmdConfig', new mongoose.Schema({
    guildId: String,
    adminRoles: { type: [String], default: [] },
    settings: {
        lock: { shortcut: { type: String, default: '-ق' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        unlock: { shortcut: { type: String, default: '-ف' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        timeout: { shortcut: { type: String, default: '-ت' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        untimeout: { shortcut: { type: String, default: '-فت' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        ban: { shortcut: { type: String, default: '-ب' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        unban: { shortcut: { type: String, default: '-فب' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } },
        kick: { shortcut: { type: String, default: '-ك' }, delUser: { type: Boolean, default: false }, delBot: { type: Boolean, default: false } }
    }
}));

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
    msgCount: { type: Number, default: 0 }
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

const Warn = mongoose.model('Warn', new mongoose.Schema({
    guildId: String,
    userId: String,
    reason: String,
    moderatorId: String,
    createdAt: { type: Date, default: Date.now }
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

const SuggestionConfig = mongoose.model('SuggestionConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    imagePath: String,
    emoji1: String,
    emoji2: String
}));

const Suggestion = mongoose.model('Suggestion', new mongoose.Schema({
    guildId: String,
    messageId: String,
    channelId: String,
    authorId: String,
    content: String,
    status: { type: String, default: 'pending' },
    votes1: { type: [String], default: [] },
    votes2: { type: [String], default: [] },
    replyThreadId: String,
    createdAt: { type: Date, default: Date.now }
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
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember, Partials.Reaction]
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

function getEmojiDisplay(guild, emojiId) {
    if (!emojiId) return '❓';
    const em = guild.emojis.cache.get(emojiId);
    return em ? em.toString() : `<:v:${emojiId}>`;
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

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    proxy: true,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(session({
    secret: process.env.SESSION_SECRET || 'VORTEX -secret-key-2026',
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
    req.logout(() => { res.redirect('/login'); });
});

app.get('/login', (req, res) => {
    res.send(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VORTEX  - تسجيل الدخول</title>
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
            <div class="logo-text">VORTEX </div>
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
        <a class="${active === 'admincmds' ? 'active' : ''}" href="/manage/${guild.id}/admincmds">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            الأوامر الإدارية
        </a>
        <a class="${active === 'suggestions' ? 'active' : ''}" href="/manage/${guild.id}/suggestions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
            الاقتراحات
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
    ` : '';

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title> VORTEX  | Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Changa:wght@400;500;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --blue: #1e90ff;
            --blue-dark: #0a6ecc;
            --blue-glow: rgba(30,144,255,0.15);
            --gold: #ffb703;
            --gold-glow: rgba(255,183,3,0.15);
            --red: #e63946;
            --red-light: #ff6b6b;
            --red-glow: rgba(230,57,70,0.12);
            --black: #050508;
            --dark: #0a0a14;
            --darker: #07070f;
            --card: rgba(12,12,24,0.75);
            --card-hover: rgba(18,18,34,0.9);
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
            flex-direction: row-reverse;
            direction: rtl;
            animation: pageFadeIn 0.5s ease both;
        }
        @keyframes pageFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ===== BACKGROUND ===== */
        body::before {
            content: '';
            position: fixed; inset: 0; z-index: -3;
            background:
                radial-gradient(ellipse at 10% 20%, rgba(30,144,255,0.09) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 80%, rgba(230,57,70,0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 60% 10%, rgba(255,183,3,0.05) 0%, transparent 45%),
                radial-gradient(ellipse at 50% 50%, rgba(10,10,30,1) 0%, rgba(5,5,8,1) 100%);
        }
        body::after {
            content: '';
            position: fixed; inset: 0; z-index: -2;
            background-image:
                linear-gradient(rgba(30,144,255,0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(30,144,255,0.025) 1px, transparent 1px);
            background-size: 60px 60px;
        }
        .orb {
            position: fixed; z-index: -1; border-radius: 50%;
            filter: blur(60px); opacity: 0.35; pointer-events: none;
            animation: floatOrb 14s ease-in-out infinite;
        }
        .orb-1 { width: 320px; height: 320px; background: var(--blue); top: -80px; right: -60px; animation-delay: 0s; }
        .orb-2 { width: 260px; height: 260px; background: var(--red); bottom: -60px; left: -40px; animation-delay: 3s; }
        .orb-3 { width: 200px; height: 200px; background: var(--gold); top: 40%; left: 30%; animation-delay: 6s; opacity: 0.15; }
        @keyframes floatOrb {
            0%, 100% { transform: translate(0,0) scale(1); }
            50% { transform: translate(30px,-30px) scale(1.12); }
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
            width: var(--sidebar-w);
            background: rgba(7,7,15,0.95);
            border-left: 1px solid var(--border);
            position: relative;
            display: flex; flex-direction: column;
            z-index: 100;
            backdrop-filter: blur(20px);
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--blue) transparent;
            flex-shrink: 0;
            height: 100vh;
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
            font-size: 27px; font-weight: 800; letter-spacing: 3px;
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
            transition: all 0.25s cubic-bezier(.2,.9,.3,1.2);
            border: 1px solid transparent;
            position: relative; overflow: hidden;
        }
        .nav a svg { flex-shrink: 0; opacity: 0.6; transition: opacity 0.25s; }
        .nav a:hover {
            background: var(--blue-glow);
            color: white;
            border-color: var(--border);
            transform: translateX(-4px);
        }
        .nav a:hover svg { opacity: 1; }
        .nav a.active {
            background: linear-gradient(135deg, rgba(30,144,255,0.22), rgba(30,144,255,0.08));
            color: var(--blue);
            border-color: rgba(30,144,255,0.4);
            font-weight: 700;
            box-shadow: 0 0 18px rgba(30,144,255,0.18) inset;
        }
        .nav a.active svg { opacity: 1; color: var(--blue); }
        .nav a.active::before {
            content: '';
            position: absolute; right: 0; top: 20%; bottom: 20%;
            width: 3px; background: linear-gradient(var(--blue), var(--gold));
            border-radius: 3px 0 0 3px;
            animation: pulseBar 1.6s ease-in-out infinite;
        }
        @keyframes pulseBar { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ===== MAIN CONTENT ===== */
        .main {
            margin-right: 0;
            padding: 40px 50px;
            flex: 1;
            min-height: 100vh;
            overflow-y: auto;
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
            transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, var(--blue), var(--gold), transparent);
            opacity: 0.5;
        }
        .card:hover {
            border-color: rgba(30,144,255,0.4);
            transform: translateY(-3px);
            box-shadow: 0 20px 50px rgba(0,0,0,0.35), 0 0 30px rgba(30,144,255,0.08);
        }
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
            position: relative; overflow: hidden;
        }
        .btn-save::after {
            content: ''; position: absolute; top: 0; left: -60%;
            width: 40%; height: 100%;
            background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
            transform: skewX(-20deg);
            transition: left 0.6s ease;
        }
        .btn-save:hover::after { left: 130%; }
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
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="sidebar">
        <div class="sidebar-header">
            <span class="sidebar-logo">VORTEX 
 <span style="-webkit-text-fill-color:var(--gold); background:none;">SYSTEM</span></span>
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


// --- [ Dashboard - Admin Commands ] ---
app.get('/manage/:guildId/admincmds', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    let config = await AdminCmdConfig.findOne({ guildId: g.id }) || new AdminCmdConfig({ guildId: g.id });

    const classes = [
        { title: 'إدارة الشات', keys: ['lock', 'unlock'] },
        { title: 'نظام الكتم', keys: ['timeout', 'untimeout'] },
        { title: 'نظام الحظر', keys: ['ban', 'unban'] },
        { title: 'نظام الطرد', keys: ['kick'] }
    ];

    let classesHtml = '';
    classes.forEach(cls => {
        classesHtml += `<div class="card" style="border-right: 4px solid var(--blue);"><h4 style="color:var(--blue); margin-bottom:15px;">${cls.title}</h4><div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">`;
        cls.keys.forEach(k => {
            const s = config.settings[k];
            const label = k === 'lock' ? 'قفل الشات' : k === 'unlock' ? 'فتح الشات' : k === 'timeout' ? 'كتم' : k === 'untimeout' ? 'فك الكتم' : k === 'ban' ? 'باند' : k === 'unban' ? 'فك باند' : 'كيك';
            classesHtml += `
                <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="font-weight:800; font-size:14px; margin-bottom:10px;">${label}</div>
                    <label style="font-size:11px; color:#888;">الاختصار</label>
                    <input type="text" name="${k}_shortcut" value="${s.shortcut}" style="margin-top:5px; margin-bottom:10px;">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                            <input type="checkbox" name="${k}_delUser" ${s.delUser ? 'checked' : ''} style="width:16px; height:16px; margin:0;"> حذف رسالة العضو
                        </label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                            <input type="checkbox" name="${k}_delBot" ${s.delBot ? 'checked' : ''} style="width:16px; height:16px; margin:0;"> حذف رد البوت
                        </label>
                    </div>
                </div>
            `;
        });
        classesHtml += `</div></div>`;
    });

    const content = `
        <div class="card">
            <h2 style="margin-bottom:10px;">الأوامر الإدارية المتقدمة</h2>
            <p style="color:#666; font-size:13px; margin-bottom:30px;">تحكم في اختصارات الأوامر وطريقة تفاعل البوت معها في السيرفر.</p>
            <form method="POST" action="/save/${g.id}/admincmds">
                <div class="card" style="background:rgba(30,144,255,0.05); border:1px dashed var(--blue);">
                    <label style="font-weight:800;">الرتب المسموح لها (IDs مفصولة بفاصلة)</label>
                    <input type="text" name="adminRoles" value="${config.adminRoles.join(',')}" placeholder="مثلاً: 123456789,987654321">
                </div>
                ${classesHtml}
                <button type="submit" class="btn-save" style="font-size:16px; padding:15px;">حفظ كافة التغييرات</button>
            </form>
        </div>
    `;
    res.send(ui(g, 'admincmds', content));
});

app.post('/save/:guildId/admincmds', checkAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const b = req.body;
    const roles = b.adminRoles.split(',').map(r => r.trim()).filter(Boolean);
    const update = {
        adminRoles: roles,
        settings: {
            lock: { shortcut: b.lock_shortcut, delUser: !!b.lock_delUser, delBot: !!b.lock_delBot },
            unlock: { shortcut: b.unlock_shortcut, delUser: !!b.unlock_delUser, delBot: !!b.unlock_delBot },
            timeout: { shortcut: b.timeout_shortcut, delUser: !!b.timeout_delUser, delBot: !!b.timeout_delBot },
            untimeout: { shortcut: b.untimeout_shortcut, delUser: !!b.untimeout_delUser, delBot: !!b.untimeout_delBot },
            ban: { shortcut: b.ban_shortcut, delUser: !!b.ban_delUser, delBot: !!b.ban_delBot },
            unban: { shortcut: b.unban_shortcut, delUser: !!b.unban_delUser, delBot: !!b.unban_delBot },
            kick: { shortcut: b.kick_shortcut, delUser: !!b.kick_delUser, delBot: !!b.kick_delBot }
        }
    };
    await AdminCmdConfig.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });
    res.redirect(`/manage/${guildId}/admincmds`);
});

// --- [ Dashboard - Server List ] ---
app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => {
        const p = BigInt(g.permissions);
        return (p & 8n) === 8n || (p & 32n) === 32n;
    });
    const inviteLink = 'https://discord.com/oauth2/authorize?client_id=' + process.env.CLIENT_ID + '&permissions=8&scope=bot%20applications.commands';

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
            margin-bottom:10px;">VORTEX </div>
        <p style="color:var(--text-muted); font-size:15px;">اختر السيرفر لإدارته</p>
        <div style="margin-top:20px; max-width:400px; margin-left:auto; margin-right:auto;">
            <input type="text" id="guildSearch" placeholder="ابحث عن سيرفر..." onkeyup="filterGuilds()" style="text-align:center; border-radius:20px; background:rgba(30,144,255,0.05); border:1px solid var(--border);">
        </div>
    </div>
    <div class="guild-grid" id="guildGrid">${cards}</div>
    <script>
        function filterGuilds() {
            const input = document.getElementById('guildSearch');
            const filter = input.value.toLowerCase();
            const grid = document.getElementById('guildGrid');
            const cards = grid.getElementsByClassName('guild-card');
            for (let i = 0; i < cards.length; i++) {
                const h3 = cards[i].getElementsByTagName('h3')[0];
                const txtValue = h3.textContent || h3.innerText;
                if (txtValue.toLowerCase().indexOf(filter) > -1) {
                    cards[i].style.display = "";
                } else {
                    cards[i].style.display = "none";
                }
            }
        }
    </script>`;

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

// --- [ Suggestions ] ---
app.get('/manage/:guildId/suggestions', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await SuggestionConfig.findOne({ guildId: g.id }) || {};

    const content = `
    <form method="POST" action="/save/${g.id}/suggestions" enctype="multipart/form-data">
        <div class="card">
            <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
                نظام الاقتراحات
            </h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
                حدد روم الاقتراحات، ارفع صورة تظهر داخل كل اقتراح، وحدد إيموجيين (بالـ ID) يستخدمان للتصويت.
            </p>
            <label>روم الاقتراحات</label>
            <select name="channelId" required>
                <option value="">-- اختر الروم --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${s.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
            </select>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label>ID الإيموجي الأول</label>
                    <input type="text" name="emoji1" value="${s.emoji1 || ''}" placeholder="مثلاً: 123456789012345678">
                </div>
                <div>
                    <label>ID الإيموجي الثاني</label>
                    <input type="text" name="emoji2" value="${s.emoji2 || ''}" placeholder="مثلاً: 123456789012345678">
                </div>
            </div>
            <label>صورة الاقتراح (تظهر داخل كل ايمبد اقتراح)</label>
            <input type="file" name="suggestImage" accept="image/*">
            ${s.imagePath ? `<div style="margin-top:12px;"><img src="/${s.imagePath.replace(/^\.\//,'')}" style="max-width:220px; border-radius:12px; border:1px solid var(--border);"></div>` : ''}
            <button class="btn-save" style="margin-top:20px;">حفظ إعدادات الاقتراحات</button>
        </div>
    </form>`;

    res.send(ui(g, 'suggestions', content));
});

app.post('/save/:guildId/suggestions', checkAuth, upload.single('suggestImage'), async (req, res) => {
    const { guildId } = req.params;
    const { channelId, emoji1, emoji2 } = req.body;
    const update = { channelId, emoji1: (emoji1 || '').trim(), emoji2: (emoji2 || '').trim() };
    if (req.file) update.imagePath = req.file.path;
    await SuggestionConfig.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });
    res.redirect(`/manage/${guildId}/suggestions`);
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
                <div id="previewAvatar" style="width:${s.welcome?.avatarWidth || 150}px; height:${s.welcome?.avatarHeight || 150}px; left:calc(${(s.welcome?.avatarX || 50)}% - ${(s.welcome?.avatarWidth || 150) / 2}px); top:calc(${(s.welcome?.avatarY || 50)}% - ${(s.welcome?.avatarHeight || 150) / 2}px); background-image:url('${client.user?.displayAvatarURL() || ''}'); background-size: cover; background-position: center;">
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

        avatar.addEventListener('mousedown', e => { if (e.target.id === 'resizer') return; dragging = true; startX = e.clientX - avatar.getBoundingClientRect().left; startY = e.clientY - avatar.getBoundingClientRect().top; e.preventDefault(); });
        document.getElementById('resizer').addEventListener('mousedown', e => { resizing = true; startX = e.clientX; startY = e.clientY; startW = avatar.offsetWidth; startH = avatar.offsetHeight; e.preventDefault(); e.stopPropagation(); });
        document.addEventListener('mousemove', e => {
            if (dragging) {
                const rect = container.getBoundingClientRect();
                let newLeft = Math.max(0, Math.min(e.clientX - rect.left - startX, container.offsetWidth - avatar.offsetWidth));
                let newTop = Math.max(0, Math.min(e.clientY - rect.top - startY, container.offsetHeight - avatar.offsetHeight));
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
   if (req.file) updateData['welcome.imagePath'] = `/uploads/${req.file.filename}`;
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
                const dashboardUrl = process.env.RENDER_EXTERNAL_URL || '';
                if (attachmentImg) {
                    embed.setImage(attachmentImg.url);
                } else if (sugCfg.imagePath && fs.existsSync(sugCfg.imagePath)) {
                    const imgName = path.basename(sugCfg.imagePath);
                    if (dashboardUrl) {
                        embed.setImage(`${dashboardUrl.replace(/\/$/, '')}/uploads/${imgName}`);
                    } else {
                        files.push(new AttachmentBuilder(sugCfg.imagePath, { name: imgName }));
                        embed.setImage(`attachment://${imgName}`);
                    }
                }


                const menu = new StringSelectMenuBuilder()
                    .setCustomId('suggestion_menu')
                    .setPlaceholder('إجراءات الإدارة على الاقتراح')
                    .addOptions(
                        { label: 'الرد على الاقتراح', value: 'reply', emoji: '💬' },
                        { label: 'قبول الاقتراح', value: 'accept', emoji: '✅' },
                        { label: 'حذف الاقتراح', value: 'delete', emoji: '🗑️' }
                    );

                const sentMsg = await msg.channel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(menu)],
                    files
                });

                await Suggestion.create({
                    guildId: msg.guild.id,
                    messageId: sentMsg.id,
                    channelId: msg.channel.id,
                    authorId: msg.author.id,
                    content: content || ''
                });

                const emojiObj1 = msg.guild.emojis.cache.get(sugCfg.emoji1);
                const emojiObj2 = msg.guild.emojis.cache.get(sugCfg.emoji2);
                if (sugCfg.emoji1) await sentMsg.react(emojiObj1 || sugCfg.emoji1).catch(() => {});
                if (sugCfg.emoji2) await sentMsg.react(emojiObj2 || sugCfg.emoji2).catch(() => {});
            }
            return;
        }
    } catch (err) {
        console.error('[Suggestion Error]', err);
    }

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

        const uData = await UserLevel.findOne({ guildId: msg.guild.id, userId: target.id }) || { level: 1, xp: 0, msgCount: 0 };

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
        ctx.fillStyle = '#1e90ff';
        ctx.fillText(`XP: ${uData.xp || 0}`, 270, 175);

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
        drawStatBox(305, 300, 'XP', uData.xp || 0);
        drawStatBox(560, 300, 'MESSAGES', uData.msgCount || 0);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'aboud-profile.png' });
        msg.reply({ files: [attachment] });
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

// --- [ تصويت الاقتراحات ] ---
async function updateSuggestionVotes(reaction, user, isAdd) {
    try {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
        const message = reaction.message;
        if (!message.guild) return;

        const suggestion = await Suggestion.findOne({ guildId: message.guild.id, messageId: message.id });
        if (!suggestion || suggestion.status !== 'pending') return;

        const sugCfg = await SuggestionConfig.findOne({ guildId: message.guild.id });
        if (!sugCfg) return;

        const emojiId = reaction.emoji.id || reaction.emoji.name;
        let field, otherField;
        if (emojiId === sugCfg.emoji1) { field = 'votes1'; otherField = 'votes2'; }
        else if (emojiId === sugCfg.emoji2) { field = 'votes2'; otherField = 'votes1'; }
        else return;

        if (isAdd) {
            if (!suggestion[field].includes(user.id)) suggestion[field].push(user.id);
            suggestion[otherField] = suggestion[otherField].filter(id => id !== user.id);
        } else {
            suggestion[field] = suggestion[field].filter(id => id !== user.id);
        }
        await suggestion.save();

        const embed = EmbedBuilder.from(message.embeds[0]);
        embed.setFields(
            { name: getEmojiDisplay(message.guild, sugCfg.emoji1), value: `${suggestion.votes1.length}`, inline: true },
            { name: getEmojiDisplay(message.guild, sugCfg.emoji2), value: `${suggestion.votes2.length}`, inline: true }
        );
        await message.edit({ embeds: [embed] }).catch(() => {});
    } catch (err) {
        console.error('[Suggestion Vote Error]', err);
    }
}

client.on('messageReactionAdd', (reaction, user) => updateSuggestionVotes(reaction, user, true));
client.on('messageReactionRemove', (reaction, user) => updateSuggestionVotes(reaction, user, false));

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
    try {
        // إحصائيات
        await Stats.findOneAndUpdate(
            { guildId: member.guild.id },
            { $push: { 'membersLog.joined': new Date() } },
            { upsert: true }
        ).catch(() => {});

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

        const welcomeChannel = await member.guild.channels.fetch(config.welcome.channel).catch(() => null);
        if (!welcomeChannel) return;

        const welcomeMsg = (config.welcome.embedMessage || 'مرحباً بك {member} في سيرفر {guild}!')
            .replace(/{member}/g, `<@${member.id}>`)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('عضو جديد انضم إلينا')
            .setDescription(welcomeMsg)
            .setColor(0x1e90ff)
            .setTimestamp()
            .setFooter({ text: `VORTEX  - العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });

        try {
            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext('2d');

            let bgUrl = config.welcome.imagePath;
if (!bgUrl) bgUrl = 'https://placehold.co/800x400/050510/1e90ff?text=Welcome';
if (!bgUrl.startsWith('http' )) bgUrl = `${process.env.BASE_URL || 'http://localhost:3000'}${bgUrl}`;
const background = await loadImage(bgUrl ).catch(() => loadImage('https://placehold.co/800x400/050510/1e90ff?text=Welcome' ));

            ctx.drawImage(background, 0, 0, 800, 400);

            const avW = parseFloat(config.welcome.avatarWidth) || 150;
            const avH = parseFloat(config.welcome.avatarHeight) || 150;
            const x = (parseFloat(config.welcome.avatarX) || 50) / 100 * 800;
            const y = (parseFloat(config.welcome.avatarY) || 50) / 100 * 400;

            ctx.save();
            ctx.beginPath();
            ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 })).catch(() => null);
            if (avatar) ctx.drawImage(avatar, x - (avW / 2), y - (avH / 2), avW, avH);
            ctx.restore();

            ctx.strokeStyle = '#1e90ff';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(x, y, avW / 2, avH / 2, 0, 0, Math.PI * 2);
            ctx.stroke();

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
            welcomeEmbed.setImage('attachment://welcome-image.png');
            await welcomeChannel.send({ embeds: [welcomeEmbed], files: [attachment] });
        } catch (canvasErr) {
            console.error('[Canvas Welcome Error]', canvasErr);
            await welcomeChannel.send({ embeds: [welcomeEmbed] });
        }
    } catch (err) {
        console.error('[General Welcome Error]', err);
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
                return interaction.reply({ content: 'تم حفظ البنر بنجاح!', ephemeral: true });
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
                return interaction.reply({ content: 'تم إرسال اللوحة!', ephemeral: true });
            }

            // ===== أوامر الإشراف =====
            if (interaction.commandName === 'ban') {
                const target = interaction.options.getUser('عضو');
                const reason = interaction.options.getString('سبب') || 'بدون سبب';
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (member && !member.bannable) return interaction.reply({ content: 'لا يمكنني حظر هذا العضو (رتبته أعلى مني).', ephemeral: true });
                await interaction.guild.members.ban(target.id, { reason }).catch(() => {});
                const embed = new EmbedBuilder().setTitle('تم الحظر').setColor(0xe63946)
                    .addFields({ name: 'العضو', value: `${target.tag}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'unban') {
                const id = interaction.options.getString('id');
                const reason = interaction.options.getString('سبب') || 'بدون سبب';
                await interaction.guild.members.unban(id, reason).catch(() => {
                    return interaction.reply({ content: 'تعذر فك الحظر، تأكد من صحة الـ ID.', ephemeral: true });
                });
                const embed = new EmbedBuilder().setTitle('تم فك الحظر').setColor(0x00c853)
                    .addFields({ name: 'العضو', value: `<@${id}>`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'kick') {
                const target = interaction.options.getUser('عضو');
                const reason = interaction.options.getString('سبب') || 'بدون سبب';
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                if (!member.kickable) return interaction.reply({ content: 'لا يمكنني طرد هذا العضو (رتبته أعلى مني).', ephemeral: true });
                await member.kick(reason).catch(() => {});
                const embed = new EmbedBuilder().setTitle('تم الطرد').setColor(0xe63946)
                    .addFields({ name: 'العضو', value: `${target.tag}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'timeout') {
                const target = interaction.options.getUser('عضو');
                const minutes = interaction.options.getInteger('دقائق');
                const reason = interaction.options.getString('سبب') || 'بدون سبب';
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                if (!member.moderatable) return interaction.reply({ content: 'لا يمكنني كتم هذا العضو (رتبته أعلى مني).', ephemeral: true });
                await member.timeout(minutes * 60 * 1000, reason).catch(() => {});
                const embed = new EmbedBuilder().setTitle('تم الكتم (Timeout)').setColor(0xffac33)
                    .addFields({ name: 'العضو', value: `${target}`, inline: true }, { name: 'المدة', value: `${minutes} دقيقة`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'untimeout') {
                const target = interaction.options.getUser('عضو');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.timeout(null).catch(() => {});
                return interaction.reply({ content: `تم فك الكتم عن ${target}.` });
            }

            if (interaction.commandName === 'warn') {
                const target = interaction.options.getUser('عضو');
                const reason = interaction.options.getString('سبب');
                await Warn.create({ guildId: interaction.guild.id, userId: target.id, reason, moderatorId: interaction.user.id });
                const embed = new EmbedBuilder().setTitle('تم توجيه تحذير').setColor(0xffac33)
                    .addFields({ name: 'العضو', value: `${target}`, inline: true }, { name: 'بواسطة', value: `${interaction.user}`, inline: true }, { name: 'السبب', value: reason })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
                target.send(`تم توجيه تحذير لك في سيرفر **${interaction.guild.name}**\nالسبب: ${reason}`).catch(() => {});
                return;
            }

            if (interaction.commandName === 'warnings') {
                const target = interaction.options.getUser('عضو');
                const warns = await Warn.find({ guildId: interaction.guild.id, userId: target.id }).sort({ createdAt: -1 }).limit(15);
                if (warns.length === 0) return interaction.reply({ content: `${target} لا يملك أي تحذيرات.`, ephemeral: true });
                const embed = new EmbedBuilder().setTitle(`تحذيرات ${target.username}`).setColor(0xffac33)
                    .setDescription(warns.map((w, i) => `**${i + 1}.** ${w.reason} — بواسطة <@${w.moderatorId}> <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join('\n'))
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (interaction.commandName === 'clearwarns') {
                const target = interaction.options.getUser('عضو');
                await Warn.deleteMany({ guildId: interaction.guild.id, userId: target.id });
                return interaction.reply({ content: `تم مسح جميع تحذيرات ${target}.` });
            }

            if (interaction.commandName === 'purge') {
                const amount = interaction.options.getInteger('عدد');
                if (amount < 1 || amount > 100) return interaction.reply({ content: 'العدد يجب أن يكون بين 1 و 100.', ephemeral: true });
                const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
                return interaction.reply({ content: `تم حذف ${deleted?.size || 0} رسالة.`, ephemeral: true });
            }

            if (interaction.commandName === 'lock') {
                await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }).catch(() => {});
                return interaction.reply({ content: '🔒 تم قفل الروم.' });
            }

            if (interaction.commandName === 'unlock') {
                await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }).catch(() => {});
                return interaction.reply({ content: '🔓 تم فتح الروم.' });
            }

            if (interaction.commandName === 'slowmode') {
                const seconds = interaction.options.getInteger('ثواني');
                await interaction.channel.setRateLimitPerUser(seconds).catch(() => {});
                return interaction.reply({ content: seconds > 0 ? `تم ضبط وضع البطء على ${seconds} ثانية.` : 'تم إيقاف وضع البطء.' });
            }

            if (interaction.commandName === 'nickname') {
                const target = interaction.options.getUser('عضو');
                const newName = interaction.options.getString('اسم');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.setNickname(newName || null).catch(() => {});
                return interaction.reply({ content: newName ? `تم تغيير اسم ${target} إلى **${newName}**.` : `تم إرجاع اسم ${target} الأصلي.` });
            }

            if (interaction.commandName === 'addrole') {
                const target = interaction.options.getUser('عضو');
                const role = interaction.options.getRole('رتبة');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.roles.add(role).catch(() => {});
                return interaction.reply({ content: `تم إعطاء رتبة **${role.name}** لـ ${target}.` });
            }

            if (interaction.commandName === 'removerole') {
                const target = interaction.options.getUser('عضو');
                const role = interaction.options.getRole('رتبة');
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                if (!member) return interaction.reply({ content: 'العضو غير موجود بالسيرفر.', ephemeral: true });
                await member.roles.remove(role).catch(() => {});
                return interaction.reply({ content: `تم سحب رتبة **${role.name}** من ${target}.` });
            }

            if (interaction.commandName === 'announce') {
                const title = interaction.options.getString('عنوان');
                const text = interaction.options.getString('نص');
                const channel = interaction.options.getChannel('روم');
                const role = interaction.options.getRole('منشن_رتبة');
                const image = interaction.options.getAttachment('صورة');

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(text)
                    .setColor(0x1e90ff)
                    .setFooter({ text: `VORTEX  - إعلان رسمي بواسطة ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
                if (image) embed.setImage(image.url);

                await channel.send({ content: role ? `${role}` : undefined, embeds: [embed] }).catch(() => {
                    return interaction.reply({ content: 'تعذر إرسال الإعلان بهذا الروم.', ephemeral: true });
                });
                return interaction.reply({ content: `تم نشر الإعلان في ${channel}.`, ephemeral: true });
            }

            if (interaction.commandName === 'say') {
                const text = interaction.options.getString('نص');
                const channel = interaction.options.getChannel('روم') || interaction.channel;
                await channel.send({ content: text }).catch(() => {});
                return interaction.reply({ content: `تم إرسال الرسالة في ${channel}.`, ephemeral: true });
            }

            if (interaction.commandName === 'userinfo') {
                const target = interaction.options.getUser('عضو') || interaction.user;
                const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                const embed = new EmbedBuilder()
                    .setTitle(`معلومات ${target.username}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor(0x1e90ff)
                    .addFields(
                        { name: 'الاسم الكامل', value: target.tag, inline: true },
                        { name: 'ID', value: target.id, inline: true },
                        { name: 'تاريخ إنشاء الحساب', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
                    );
                if (member) {
                    embed.addFields(
                        { name: 'تاريخ الانضمام', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
                        { name: 'عدد الرتب', value: `${member.roles.cache.size - 1}`, inline: true }
                    );
                }
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'serverinfo') {
                const g = interaction.guild;
                const embed = new EmbedBuilder()
                    .setTitle(g.name)
                    .setThumbnail(g.iconURL({ dynamic: true }))
                    .setColor(0x1e90ff)
                    .addFields(
                        { name: 'المالك', value: `<@${g.ownerId}>`, inline: true },
                        { name: 'عدد الأعضاء', value: `${g.memberCount}`, inline: true },
                        { name: 'عدد الرومات', value: `${g.channels.cache.size}`, inline: true },
                        { name: 'عدد الرتب', value: `${g.roles.cache.size}`, inline: true },
                        { name: 'تاريخ الإنشاء', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
                    )
                    .setFooter({ text: 'VORTEX ' })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            if (interaction.commandName === 'avatar') {
                const target = interaction.options.getUser('عضو') || interaction.user;
                const embed = new EmbedBuilder()
                    .setTitle(`صورة ${target.username}`)
                    .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                    .setColor(0x1e90ff);
                return interaction.reply({ embeds: [embed] });
            }
        }

        // --- [ Self Roles ] ---
        if (interaction.isButton() && interaction.customId.startsWith('role_')) {
            try {
                const roleId = interaction.customId.replace('role_', '');
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: 'الرتبة غير موجودة.', ephemeral: true });

                const guildData = await GuildConfig.findOne({ guildId: interaction.guild.id });
                const allPanelRoles = (guildData?.rolesPanel || []).map(r => r.roleId);

                if (interaction.member.roles.cache.has(roleId)) {
                    await interaction.member.roles.remove(roleId).catch(() => {});
                    return interaction.reply({ content: `تم سحب رتبة **${role.name}** منك.`, ephemeral: true });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return interaction.reply({ content: 'رتبة البوت أقل من الرتبة المطلوبة.', ephemeral: true });
                }

                if (allPanelRoles.length > 0) {
                    const rolesToRemove = interaction.member.roles.cache.filter(r => allPanelRoles.includes(r.id));
                    if (rolesToRemove.size > 0) await interaction.member.roles.remove(rolesToRemove).catch(() => {});
                }

                await interaction.member.roles.add(roleId);
                return interaction.reply({ content: `تم إعطاؤك رتبة **${role.name}**.`, ephemeral: true });
            } catch (err) {
                console.error('[Role Error]', err);
                if (!interaction.replied) interaction.reply({ content: 'حدث خطأ، جرب مرة أخرى.', ephemeral: true });
            }
        }

        // --- [ Rename Buttons ] ---
        if (interaction.isButton() && interaction.customId.startsWith('rename_user:')) {
            const newName = interaction.customId.split(':')[1];
            const setResult = await interaction.member.setNickname(newName).catch(() => null);
            if (!setResult) return interaction.reply({ content: 'ما بقدر أغير الاسم (تأكد من صلاحياتي)', ephemeral: true });
            return interaction.reply({ content: `تم تغيير اسمك إلى: ${newName}`, ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId === 'reset_name') {
            const setResult = await interaction.member.setNickname(null).catch(() => null);
            if (!setResult) return interaction.reply({ content: 'ما بقدر أرجع الاسم', ephemeral: true });
            return interaction.reply({ content: 'تم ارجاع اسمك الأصلي', ephemeral: true });
        }

        // --- [ Ticket Control Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_menu') {
            const selected = interaction.values[0];
            const ticketData = await TicketData.findOne({ channelId: interaction.channelId });
            if (!ticketData) return interaction.reply({ content: 'لم يتم العثور على بيانات التكت.', ephemeral: true });

            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            const adminRole = tConfig?.adminRole;
            const isAdmin = adminRole && interaction.member.roles.cache.has(adminRole);
            const isOwner = ticketData.ownerId === interaction.user.id;

            if (selected === 'claim_ticket') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم استلام التكت.', ephemeral: true });
                ticketData.claimedBy = interaction.user.id;
                await ticketData.save();
                return interaction.reply({ content: `تم استلام التكت بواسطة ${interaction.user}.`, ephemeral: false });
            }

            if (selected === 'close_ticket') {
                if (!isAdmin && !isOwner) return interaction.reply({ content: 'ليس لديك صلاحية لإغلاق التكت.', ephemeral: true });
                ticketData.closedAt = new Date();
                ticketData.closedBy = interaction.user.id;
                await ticketData.save();
                await interaction.reply({ content: 'سيتم حذف التكت خلال 5 ثوان...', ephemeral: false });
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
                return;
            }

            if (selected === 'add_member') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم إضافة أعضاء.', ephemeral: true });
                const modal = new ModalBuilder().setCustomId('ticket_add_member').setTitle('إضافة عضو للتكت');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('member_id').setLabel('ID العضو').setStyle(TextInputStyle.Short).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (selected === 'remove_member') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم إزالة أعضاء.', ephemeral: true });
                const modal = new ModalBuilder().setCustomId('ticket_remove_member').setTitle('إزالة عضو من التكت');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('member_id').setLabel('ID العضو').setStyle(TextInputStyle.Short).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (selected === 'summon_member') {
                if (!isAdmin) return interaction.reply({ content: 'فقط الإدارة يمكنهم استدعاء الأعضاء.', ephemeral: true });
                await interaction.reply({ content: `<@${ticketData.ownerId}> تم استدعاؤك!`, ephemeral: false });
                return;
            }
        }

        // --- [ Ticket Modals ] ---
        if (interaction.isModalSubmit() && (interaction.customId === 'ticket_add_member' || interaction.customId === 'ticket_remove_member')) {
            const memberId = interaction.fields.getTextInputValue('member_id').trim();
            const member = await interaction.guild.members.fetch(memberId).catch(() => null);
            if (!member) return interaction.reply({ content: 'العضو غير موجود.', ephemeral: true });

            if (interaction.customId === 'ticket_add_member') {
                await interaction.channel.permissionOverwrites.create(memberId, { ViewChannel: true, SendMessages: true }).catch(() => {});
                return interaction.reply({ content: `تم إضافة ${member.user.tag} للتكت.`, ephemeral: true });
            } else {
                await interaction.channel.permissionOverwrites.delete(memberId).catch(() => {});
                return interaction.reply({ content: `تم إزالة ${member.user.tag} من التكت.`, ephemeral: true });
            }
        }
// --- [ Ticket Panel Select Menu ] ---
if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
    const selected = interaction.values[0];
    const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
    if (!tConfig) return interaction.reply({ content: 'لم يتم العثور على إعدادات التذاكر.', ephemeral: true });

    // استخراج رقم الخيار من الـ value (مثلاً ticket_opt_0 → 0)
    const optIndex = parseInt(selected.replace('ticket_opt_', ''));
    let ticketType = 'تذكرة دعم';
    if (tConfig.menuOptions?.[optIndex]) {
        ticketType = tConfig.menuOptions[optIndex].label;
    }

    await openTicket(interaction, tConfig, ticketType);
    return;
}

        // --- [ Ticket Buttons ] ---
        if (interaction.isButton() && (interaction.customId === 'open_ticket' || interaction.customId.startsWith('ticket_btn_'))) {
            const tConfig = await TicketConfig.findOne({ guildId: interaction.guild.id });
            if (!tConfig) return interaction.reply({ content: 'لم يتم العثور على إعدادات التذاكر.', ephemeral: true });

            let ticketType = 'تذكرة دعم';
            if (interaction.customId.startsWith('ticket_btn_')) {
                const btnIndex = parseInt(interaction.customId.replace('ticket_btn_', ''));
                if (tConfig.buttons?.[btnIndex]) ticketType = tConfig.buttons[btnIndex].label;
            }
            await openTicket(interaction, tConfig, ticketType);
        }
        // --- [ Suggestion Menu ] ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'suggestion_menu') {
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isStaff) return interaction.reply({ content: 'هذا الإجراء مخصص للإدارة فقط.', ephemeral: true });

            const suggestion = await Suggestion.findOne({ guildId: interaction.guild.id, messageId: interaction.message.id });
            if (!suggestion) return interaction.reply({ content: 'لم يتم العثور على بيانات الاقتراح.', ephemeral: true });

            const selected = interaction.values[0];

            if (selected === 'reply') {
                const modal = new ModalBuilder()
                    .setCustomId(`suggestion_reply_modal:${interaction.message.id}`)
                    .setTitle('الرد على الاقتراح');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('reply_text').setLabel('نص رد الإدارة').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (selected === 'accept') {
                suggestion.status = 'accepted';
                await suggestion.save();
                await interaction.message.reactions.removeAll().catch(() => {});
                const embed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(
                    `${interaction.message.embeds[0].description || ''}\n\n**✅ تمت الموافقة على الاقتراح.**`
                );
                await interaction.update({ embeds: [embed], components: [] });
                return;
            }

            if (selected === 'delete') {
                await Suggestion.deleteOne({ _id: suggestion._id });
                await interaction.message.delete().catch(() => {});
                return interaction.reply({ content: 'تم حذف الاقتراح.', ephemeral: true });
            }
        }

        // --- [ Suggestion Reply Modal ] ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('suggestion_reply_modal:')) {
            const messageId = interaction.customId.split(':')[1];
            const suggestion = await Suggestion.findOne({ guildId: interaction.guild.id, messageId });
            if (!suggestion) return interaction.reply({ content: 'لم يتم العثور على بيانات الاقتراح.', ephemeral: true });

            const replyText = interaction.fields.getTextInputValue('reply_text');
            const channel = interaction.channel;

            let thread = suggestion.replyThreadId ? await channel.threads.fetch(suggestion.replyThreadId).catch(() => null) : null;

            if (!thread) {
                const suggestionMsg = await channel.messages.fetch(messageId).catch(() => null);
                if (!suggestionMsg) return interaction.reply({ content: 'لم يتم العثور على رسالة الاقتراح.', ephemeral: true });

                thread = await suggestionMsg.startThread({
                    name: `رد-الإدارة-${interaction.user.username}`,
                    autoArchiveDuration: 1440,
                    type: ChannelType.PrivateThread
                }).catch(async () => {
                    return await suggestionMsg.startThread({
                        name: `رد-الإدارة-${interaction.user.username}`,
                        autoArchiveDuration: 1440
                    }).catch(() => null);
                });

                if (!thread) return interaction.reply({ content: 'تعذر إنشاء الثريد الخاص بالرد.', ephemeral: true });
                suggestion.replyThreadId = thread.id;
                await suggestion.save();

                const suggestionEmbed = EmbedBuilder.from(suggestionMsg.embeds[0]);
                const existingComponents = suggestionMsg.components.map(row => ActionRowBuilder.from(row));
                const viewBtnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`view_admin_reply:${messageId}`).setLabel('عرض رد الإدارة').setStyle(ButtonStyle.Secondary).setEmoji('💬')
                );
                await suggestionMsg.edit({ embeds: [suggestionEmbed], components: [...existingComponents, viewBtnRow] }).catch(() => {});
            }

            const replyEmbed = new EmbedBuilder()
                .setAuthor({ name: `رد الإدارة - ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(replyText)
                .setColor(0x1e90ff)
                .setTimestamp();
            await thread.send({ embeds: [replyEmbed] });

            return interaction.reply({ content: 'تم إرسال ردك بنجاح.', ephemeral: true });
        }

        // --- [ View Admin Reply Button ] ---
        if (interaction.isButton() && interaction.customId.startsWith('view_admin_reply:')) {
            const messageId = interaction.customId.split(':')[1];
            const suggestion = await Suggestion.findOne({ guildId: interaction.guild.id, messageId });
            if (!suggestion?.replyThreadId) return interaction.reply({ content: 'لا يوجد رد من الإدارة على هذا الاقتراح بعد.', ephemeral: true });

            const thread = await interaction.channel.threads.fetch(suggestion.replyThreadId).catch(() => null);
            if (!thread) return interaction.reply({ content: 'الثريد غير موجود.', ephemeral: true });

            await thread.members.add(interaction.user.id).catch(() => {});
            return interaction.reply({ content: `تمت إضافتك لثريد رد الإدارة: ${thread}`, ephemeral: true });
        }
    } catch (err) {
        console.error('[Interaction Error]', err);
    }
});


// ==========================================
// 13. Helper Functions
// ==========================================

async function openTicket(interaction, tConfig, ticketType) {
    try {
        const existingTicket = await TicketData.findOne({ guildId: interaction.guild.id, ownerId: interaction.user.id, closedAt: null });
        if (existingTicket) {
            return interaction.reply({ content: `لديك تكت مفتوح بالفعل: <#${existingTicket.channelId}>`, ephemeral: true });
        }

        const ticketCount = await TicketData.countDocuments({ guildId: interaction.guild.id }) + 1;
        const channelName = `ticket-${ticketCount}-${interaction.user.username}`.substring(0, 100);

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

        if (!ticketChannel) return interaction.reply({ content: 'فشل إنشاء قناة التكت.', ephemeral: true });

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
            .setFooter({ text: 'VORTEX  - Tickets' });

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

        return interaction.reply({ content: `تم فتح تكتك: ${ticketChannel}`, ephemeral: true });
    } catch (err) {
        console.error('[Ticket Error]', err);
        return interaction.reply({ content: 'حدث خطأ عند فتح التكت.', ephemeral: true });
    }
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
                    let data = null;
                    const response = await fetch(`https://kick.com/api/v2/channels/${streamer.kickUsername}`, {
                        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                    });
                    if (response.ok) data = await response.json();
                    else {
                        const resV1 = await fetch(`https://kick.com/api/v1/channels/${streamer.kickUsername}`, {
                            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                        });
                        if (resV1.ok) data = await resV1.json();
                    }
                    if (!data) continue;
                    const livestream = data?.livestream || data?.data?.livestream;
                    const isLive = livestream !== null && livestream !== undefined;
                    if (isLive && !streamer.isLive) {
                        config.streamers[i].isLive = true;
                        config.markModified('streamers'); await config.save();
                        const channel = guild.channels.cache.get(streamer.channelId);
                        if (!channel) continue;
                        const embed = new EmbedBuilder()
                            .setTitle(`${streamer.kickUsername} بدأ البث المباشر`)
                            .setDescription((streamer.customMessage || '%name% بدأ البث الآن!').replace(/%name%/g, streamer.kickUsername))
                            .setURL(`https://kick.com/${streamer.kickUsername}`)
                            .setColor(0x53fc18)
                            .addFields(
                                { name: 'عنوان البث', value: livestream.session_title || 'بث مباشر', inline: true },
                                { name: 'المشاهدون', value: `${livestream.viewer_count || 0}`, inline: true }
                            ).setTimestamp();
                        const thumb = data.user?.profile_pic || livestream.thumbnail?.url;
                        if (thumb) embed.setThumbnail(thumb);
                        const mention = streamer.roleId ? `<@&${streamer.roleId}>` : '';
                        await channel.send({ content: mention || undefined, embeds: [embed] });
                    } else if (!isLive && streamer.isLive) {
                        config.streamers[i].isLive = false;
                        config.markModified('streamers'); await config.save();
                    }
                } catch (err) {}
            }
        }
    } catch (err) {}
}
setInterval(checkKickLive, 25000);


// ==========================================
// 15. Slash Commands Registration
// ==========================================

async function registerSlashCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('setbanner')
            .setDescription('ضبط بنر الترحيب')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addAttachmentOption(opt => opt.setName('image').setDescription('صورة البنر').setRequired(true)),
        new SlashCommandBuilder()
            .setName('rename_panel')
            .setDescription('إرسال لوحة تغيير الاسم')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(opt => opt.setName('name').setDescription('الاسم الجديد').setRequired(true))
            .addAttachmentOption(opt => opt.setName('image').setDescription('صورة اللوحة').setRequired(false)),

        // ===== 20 أمر إشراف قوية =====
        new SlashCommandBuilder().setName('ban').setDescription('حظر عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب حظره').setRequired(true))
            .addStringOption(o => o.setName('سبب').setDescription('سبب الحظر').setRequired(false)),

        new SlashCommandBuilder().setName('unban').setDescription('فك حظر عضو عبر الـ ID')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addStringOption(o => o.setName('id').setDescription('ID العضو').setRequired(true))
            .addStringOption(o => o.setName('سبب').setDescription('سبب فك الحظر').setRequired(false)),

        new SlashCommandBuilder().setName('kick').setDescription('طرد عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب طرده').setRequired(true))
            .addStringOption(o => o.setName('سبب').setDescription('سبب الطرد').setRequired(false)),

        new SlashCommandBuilder().setName('timeout').setDescription('كتم عضو (تايم اوت) لفترة محددة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب كتمه').setRequired(true))
            .addIntegerOption(o => o.setName('دقائق').setDescription('مدة الكتم بالدقائق').setRequired(true))
            .addStringOption(o => o.setName('سبب').setDescription('سبب الكتم').setRequired(false)),

        new SlashCommandBuilder().setName('untimeout').setDescription('فك الكتم عن عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب فك كتمه').setRequired(true)),

        new SlashCommandBuilder().setName('warn').setDescription('توجيه تحذير لعضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب تحذيره').setRequired(true))
            .addStringOption(o => o.setName('سبب').setDescription('سبب التحذير').setRequired(true)),

        new SlashCommandBuilder().setName('warnings').setDescription('عرض تحذيرات عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب عرض تحذيراته').setRequired(true)),

        new SlashCommandBuilder().setName('clearwarns').setDescription('مسح كل تحذيرات عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب مسح تحذيراته').setRequired(true)),

        new SlashCommandBuilder().setName('purge').setDescription('حذف عدد من الرسائل من الروم')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addIntegerOption(o => o.setName('عدد').setDescription('عدد الرسائل (1-100)').setRequired(true)),

        new SlashCommandBuilder().setName('lock').setDescription('قفل الروم الحالي عن الأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

        new SlashCommandBuilder().setName('unlock').setDescription('فتح الروم الحالي للأعضاء')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

        new SlashCommandBuilder().setName('slowmode').setDescription('ضبط وضع البطء بالروم الحالي')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addIntegerOption(o => o.setName('ثواني').setDescription('عدد الثواني (0 للإيقاف)').setRequired(true)),

        new SlashCommandBuilder().setName('nickname').setDescription('تغيير اسم عضو داخل السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب').setRequired(true))
            .addStringOption(o => o.setName('اسم').setDescription('الاسم الجديد (اتركه فاضي للإرجاع)').setRequired(false)),

        new SlashCommandBuilder().setName('addrole').setDescription('إعطاء رتبة لعضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب').setRequired(true))
            .addRoleOption(o => o.setName('رتبة').setDescription('الرتبة المطلوب إعطاؤها').setRequired(true)),

        new SlashCommandBuilder().setName('removerole').setDescription('سحب رتبة من عضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب').setRequired(true))
            .addRoleOption(o => o.setName('رتبة').setDescription('الرتبة المطلوب سحبها').setRequired(true)),

        new SlashCommandBuilder().setName('announce').setDescription('نشر إعلان رسمي بالسيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(o => o.setName('عنوان').setDescription('عنوان الإعلان').setRequired(true))
            .addStringOption(o => o.setName('نص').setDescription('نص الإعلان').setRequired(true))
            .addChannelOption(o => o.setName('روم').setDescription('روم النشر').setRequired(true))
            .addRoleOption(o => o.setName('منشن_رتبة').setDescription('الرتبة المطلوب منشنها').setRequired(false))
            .addAttachmentOption(o => o.setName('صورة').setDescription('صورة الإعلان').setRequired(false)),

        new SlashCommandBuilder().setName('say').setDescription('إرسال رسالة من البوت لروم محدد')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(o => o.setName('نص').setDescription('نص الرسالة').setRequired(true))
            .addChannelOption(o => o.setName('روم').setDescription('روم الإرسال').setRequired(false)),

        new SlashCommandBuilder().setName('userinfo').setDescription('عرض معلومات عن عضو')
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب').setRequired(false)),

        new SlashCommandBuilder().setName('serverinfo').setDescription('عرض معلومات عن السيرفر'),

        new SlashCommandBuilder().setName('avatar').setDescription('عرض صورة عضو')
            .addUserOption(o => o.setName('عضو').setDescription('العضو المطلوب').setRequired(false)),
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('[VORTEX ] Slash commands registered.');
    } catch (err) {
        console.error('[Slash Register Error]', err);
    }
}

// ==========================================
// 16. Client Ready
// ==========================================

client.once('ready', async () => {
    console.log(`[VORTEX ] Bot is online as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'VORTEX ', type: ActivityType.Watching }],
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
    console.log(`[VORTEX ] Dashboard running on port ${PORT}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('[VORTEX ] Login failed:', err);
    process.exit(1);
});
