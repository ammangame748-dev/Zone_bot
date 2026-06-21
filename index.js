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
        emojiPunishment: { type: String, default: 'none' },
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
    clanIndex: Number,
    clanName: String,
    leaderId: String,
    assistantIds: [String],
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
// 5️⃣ SVG Icons Helper
// ==========================================
const icons = {
    home: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
    ticket: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-2.16-2.66c-.44-.53-1.25-.58-1.78-.15-.53.44-.58 1.25-.15 1.78l3 3.67c.25.31.61.5 1.02.5.4 0 .77-.19 1.02-.5l3.83-4.96c.44-.53.39-1.34-.15-1.78-.53-.44-1.34-.39-1.78.15z"/></svg>',
    clan: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm8 0c1.66 0 2.99-1.34 2.99-3S25.66 5 24 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.64 2.2 1.56 2.97 2.95V16h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    welcome: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.21-.08.48.1.62l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.48-.12-.62l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    menu: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
};

// ==========================================
// 5️⃣ UI Engine (Redesigned with CSS)
// ==========================================
function ui(guild, active, content) {
    const showNav = guild.id ? 'flex' : 'none';
    const guildName = guild.name || 'VORTEX DASHBOARD';
    const guildIcon = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VORTEX - نظام إدارة السيرفرات</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            :root {
                --primary: #5865F2;
                --secondary: #404EED;
                --success: #57F287;
                --danger: #ED4245;
                --warning: #FFA500;
                --dark: #2C2F33;
                --darker: #23272A;
                --light: #99AAB5;
                --lighter: #ECEFF1;
                --accent: #7289DA;
            }

            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, var(--darker) 0%, #1a1d20 100%);
                color: #fff;
                min-height: 100vh;
            }

            .container {
                display: flex;
                min-height: 100vh;
            }

            /* ===== SIDEBAR ===== */
            .sidebar {
                width: 280px;
                background: rgba(44, 47, 51, 0.95);
                backdrop-filter: blur(10px);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                padding: 20px;
                overflow-y: auto;
                position: fixed;
                height: 100vh;
                right: 0;
                display: flex;
                flex-direction: column;
                z-index: 1000;
            }

            .sidebar-header {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .guild-icon {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid var(--primary);
            }

            .guild-info h2 {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 4px;
            }

            .guild-info p {
                font-size: 12px;
                color: var(--light);
            }

            .nav-menu {
                display: flex;
                flex-direction: column;
                gap: 8px;
                flex: 1;
            }

            .nav-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 15px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                color: var(--light);
                text-decoration: none;
                font-size: 14px;
                border: 1px solid transparent;
            }

            .nav-item:hover {
                background: rgba(88, 101, 242, 0.15);
                color: var(--primary);
                border-color: rgba(88, 101, 242, 0.3);
            }

            .nav-item.active {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
            }

            .nav-item svg {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            }

            /* ===== MAIN CONTENT ===== */
            .main {
                margin-right: 280px;
                flex: 1;
                padding: 40px;
                overflow-y: auto;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .header h1 {
                font-size: 32px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--primary), var(--accent));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .logout-btn {
                padding: 10px 20px;
                background: var(--danger);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.3s ease;
            }

            .logout-btn:hover {
                background: #c41e3a;
                transform: translateY(-2px);
            }

            /* ===== CARDS ===== */
            .card {
                background: rgba(44, 47, 51, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 25px;
                margin-bottom: 25px;
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
            }

            .card:hover {
                border-color: rgba(88, 101, 242, 0.3);
                background: rgba(44, 47, 51, 0.8);
                transform: translateY(-2px);
            }

            .card h3 {
                font-size: 20px;
                margin-bottom: 20px;
                color: var(--primary);
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .card h4 {
                font-size: 16px;
                margin: 20px 0 15px 0;
                color: var(--accent);
            }

            /* ===== FORMS ===== */
            form {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            label {
                font-size: 14px;
                font-weight: 600;
                color: var(--light);
                margin-bottom: 5px;
            }

            input, textarea, select {
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                padding: 12px 15px;
                color: white;
                font-size: 14px;
                transition: all 0.3s ease;
                font-family: inherit;
            }

            input:focus, textarea:focus, select:focus {
                outline: none;
                border-color: var(--primary);
                background: rgba(88, 101, 242, 0.1);
                box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.1);
            }

            textarea {
                resize: vertical;
                min-height: 100px;
            }

            /* ===== BUTTONS ===== */
            button, .btn-save, .btn-delete {
                padding: 12px 24px;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            button:hover, .btn-save:hover {
                background: var(--secondary);
                transform: translateY(-2px);
                box-shadow: 0 8px 16px rgba(88, 101, 242, 0.3);
            }

            .btn-delete {
                background: var(--danger);
            }

            .btn-delete:hover {
                background: #c41e3a;
            }

            /* ===== GRID ===== */
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 20px;
            }

            .grid-item {
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 15px;
                text-align: center;
            }

            .grid-item h4 {
                color: var(--light);
                font-size: 12px;
                margin-bottom: 10px;
                text-transform: uppercase;
            }

            .grid-item .value {
                font-size: 32px;
                font-weight: 700;
                color: var(--primary);
            }

            /* ===== SLIDER ===== */
            .servers-slider {
                display: flex;
                gap: 15px;
                overflow-x: auto;
                padding: 15px 0;
                margin-bottom: 30px;
                scroll-behavior: smooth;
            }

            .servers-slider::-webkit-scrollbar {
                height: 6px;
            }

            .servers-slider::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
            }

            .servers-slider::-webkit-scrollbar-thumb {
                background: var(--primary);
                border-radius: 10px;
            }

            .server-card {
                min-width: 200px;
                background: rgba(44, 47, 51, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                color: inherit;
            }

            .server-card:hover {
                border-color: var(--primary);
                background: rgba(88, 101, 242, 0.15);
                transform: translateY(-4px);
            }

            .server-icon {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                margin: 0 auto 15px;
                object-fit: cover;
                border: 2px solid var(--primary);
            }

            .server-card h4 {
                font-size: 16px;
                margin-bottom: 10px;
                color: white;
            }

            .server-card p {
                font-size: 12px;
                color: var(--light);
            }

            /* ===== RESPONSIVE ===== */
            @media (max-width: 768px) {
                .container {
                    flex-direction: column;
                }

                .sidebar {
                    width: 100%;
                    height: auto;
                    position: relative;
                    border-right: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    flex-direction: row;
                    overflow-x: auto;
                }

                .main {
                    margin-right: 0;
                    padding: 20px;
                }

                .nav-menu {
                    flex-direction: row;
                    gap: 10px;
                }

                .nav-item {
                    white-space: nowrap;
                }

                .header {
                    flex-direction: column;
                    gap: 15px;
                    align-items: flex-start;
                }

                .grid {
                    grid-template-columns: 1fr;
                }
            }

            /* ===== ANIMATIONS ===== */
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .card {
                animation: fadeIn 0.3s ease;
            }

            /* ===== UTILITY ===== */
            .text-center {
                text-align: center;
            }

            .mt-20 {
                margin-top: 20px;
            }

            .mb-20 {
                margin-bottom: 20px;
            }

            .text-success {
                color: var(--success);
            }

            .text-danger {
                color: var(--danger);
            }

            .text-warning {
                color: var(--warning);
            }

            .badge {
                display: inline-block;
                padding: 4px 12px;
                background: rgba(88, 101, 242, 0.2);
                border: 1px solid var(--primary);
                border-radius: 20px;
                font-size: 12px;
                color: var(--primary);
            }

            .badge.success {
                background: rgba(87, 242, 135, 0.2);
                border-color: var(--success);
                color: var(--success);
            }

            .badge.danger {
                background: rgba(237, 66, 69, 0.2);
                border-color: var(--danger);
                color: var(--danger);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- SIDEBAR -->
            <div class="sidebar" style="display: ${showNav}">
                <div class="sidebar-header">
                    <img src="${guildIcon}" alt="Guild Icon" class="guild-icon">
                    <div class="guild-info">
                        <h2>${guildName}</h2>
                        <p>نظام VORTEX</p>
                    </div>
                </div>

                <nav class="nav-menu">
                    <a href="/manage/${guild.id}/home" class="nav-item ${active === 'home' ? 'active' : ''}">${icons.home} الإحصائيات</a>
                    <a href="/manage/${guild.id}/kick" class="nav-item ${active === 'kick' ? 'active' : ''}">${icons.shield} تنبيهات Kick</a>
                    <a href="/manage/${guild.id}/security" class="nav-item ${active === 'security' ? 'active' : ''}">${icons.shield} الحماية</a>
                    <a href="/manage/${guild.id}/tickets" class="nav-item ${active === 'tickets' ? 'active' : ''}">${icons.ticket} التذاكر</a>
                    <a href="/manage/${guild.id}/welcome" class="nav-item ${active === 'welcome' ? 'active' : ''}">${icons.welcome} الترحيب</a>
                    <a href="/manage/${guild.id}/clans" class="nav-item ${active === 'clans' ? 'active' : ''}">${icons.clan} الكلانات</a>
                    <a href="/manage/${guild.id}/levels" class="nav-item ${active === 'levels' ? 'active' : ''}">${icons.menu} نظام الليفل</a>
                </nav>

                <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <a href="/logout" class="logout-btn" style="width: 100%; text-align: center; text-decoration: none;">تسجيل الخروج</a>
                </div>
            </div>

            <!-- MAIN CONTENT -->
            <div class="main">
                <div class="header">
                    <div>
                        <h1>VORTEX</h1>
                        <p style="color: var(--light); margin-top: 5px;">نظام إدارة السيرفرات المتطور</p>
                    </div>
                    ${guild.id ? `<a href="/dashboard" style="color: var(--light); text-decoration: none; font-size: 14px;">← العودة للسيرفرات</a>` : ''}
                </div>

                ${content}
            </div>
        </div>
    </body>
    </html>
    `;
}

// ==========================================
// 6️⃣ Routes & Logic
// ==========================================

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/login', (req, res) => res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VORTEX - تسجيل الدخول</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #23272A 0%, #2C2F33 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .login-container {
                background: rgba(44, 47, 51, 0.8);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 60px 40px;
                text-align: center;
                max-width: 400px;
                animation: fadeIn 0.5s ease;
            }
            h1 {
                font-size: 48px;
                margin-bottom: 10px;
                background: linear-gradient(135deg, #5865F2, #7289DA);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            p {
                color: #99AAB5;
                margin-bottom: 40px;
                font-size: 16px;
            }
            a {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                background: #5865F2;
                color: white;
                padding: 15px 40px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                transition: all 0.3s ease;
                font-size: 16px;
            }
            a:hover {
                background: #404EED;
                transform: translateY(-2px);
                box-shadow: 0 8px 16px rgba(88, 101, 242, 0.3);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h1>VORTEX</h1>
            <p>أقوى نظام لإدارة وحماية سيرفرات الديسكورد</p>
            <a href="/auth/discord">🔑 تسجيل الدخول عبر Discord</a>
        </div>
    </body>
    </html>
`));

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/login'));
});

app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const sliderCards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `
            <a href="/manage/${g.id}/home" class="server-card">
                <img src="${icon}" alt="${g.name}" class="server-icon">
                <h4>${g.name}</h4>
                <p>${hasBot ? '✅ البوت مثبت' : '❌ البوت غير مثبت'}</p>
            </a>
        `;
    }).join('');

    const content = `
        <div class="card">
            <h3>${icons.home} اختر السيرفر الذي تود إدارته</h3>
            <div class="servers-slider">
                ${sliderCards}
            </div>
        </div>
    `;
    res.send(ui({ id: null }, 'home', content));
});

// --- [ Home Stats ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const stats = await Stats.findOne({ guildId: g.id }) || { messages: { total: 0 } };
    const content = `
        <div class="grid">
            <div class="grid-item">
                <h4>📊 إجمالي الرسائل</h4>
                <div class="value">${stats.messages.total}</div>
            </div>
            <div class="grid-item">
                <h4>👥 عدد الأعضاء</h4>
                <div class="value">${g.memberCount}</div>
            </div>
            <div class="grid-item">
                <h4>📢 عدد القنوات</h4>
                <div class="value">${g.channels.cache.size}</div>
            </div>
        </div>
    `;
    res.send(ui(g, 'home', content));
});

// --- [ Security Settings ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };
    const content = `
        <form method="POST" action="/save/${g.id}/security">
            <div class="card">
                <h3>${icons.shield} إعدادات الحماية والرقابة</h3>

                <h4>🔗 منع الروابط</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <label>
                        <input type="radio" name="antiLinks" value="true" ${s.security?.antiLinks ? 'checked' : ''}>
                        تشغيل
                    </label>
                    <label>
                        <input type="radio" name="antiLinks" value="false" ${!s.security?.antiLinks ? 'checked' : ''}>
                        إيقاف
                    </label>
                </div>

                <h4>⚠️ نوع العقوبة</h4>
                <select name="punishment">
                    <option value="none" ${s.security?.punishment === 'none' ? 'selected' : ''}>حذف الرسالة فقط</option>
                    <option value="warn" ${s.security?.punishment === 'warn' ? 'selected' : ''}>تحذير</option>
                    <option value="timeout" ${s.security?.punishment === 'timeout' ? 'selected' : ''}>إسكات (Timeout)</option>
                </select>

                <h4>🚫 الكلمات الممنوعة</h4>
                <textarea name="badWords" placeholder="افصل بفاصلة (,)">${s.security?.badWords || ''}</textarea>

                <h4>😢 الإيموجيات الممنوعة (حماية الإيموجي)</h4>
                <textarea name="badEmojis" placeholder="ضع الإيموجيات أو معرفاتها مفصولة بفاصلة">${s.security?.badEmojis || ''}</textarea>

                <h4>🛡️ رتب الاستثناء (Bypass)</h4>
                <select name="bypassRoles" multiple style="height: 120px;">
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => 
                        `<option value="${r.id}" ${s.security?.bypassRoles?.includes(r.id) ? 'selected' : ''}>${r.name}</option>`
                    ).join('')}
                </select>

                <button type="submit" class="btn-save mt-20">💾 حفظ إعدادات الحماية</button>
            </div>
        </form>
    `;
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

// --- [ Ticket Settings ] ---
app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await TicketConfig.findOne({ guildId: g.id }) || {};
    const content = `
        <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
            <div class="card">
                <h3>${icons.ticket} إعداد نظام التذاكر المتطور</h3>

                <label>عنوان التذكرة:</label>
                <input name="title" value="${s.title || ''}" placeholder="عنوان نظام التذاكر">

                <label>الوصف:</label>
                <textarea name="description">${s.description || ''}</textarea>

                <label>اللون (Hex):</label>
                <input name="color" type="color" value="${s.color || '#5865F2'}">

                <label>رتبة الإدارة:</label>
                <select name="adminRole">
                    <option value="">-- اختر رتبة الإدارة --</option>
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => 
                        `<option value="${r.id}" ${s.adminRole === r.id ? 'selected' : ''}>${r.name}</option>`
                    ).join('')}
                </select>

                <h4>🔘 الأزرار (حتى 4):</h4>
                ${[0,1,2,3].map(i => `
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                        <input name="btn_label_${i}" value="${s.buttons?.[i]?.label || ''}" placeholder="نص الزر ${i+1}">
                        <input name="btn_emoji_${i}" value="${s.buttons?.[i]?.emoji || ''}" placeholder="إيموجي">
                    </div>
                `).join('')}

                <h4>📋 خيارات المنيو (حتى 4):</h4>
                ${[0,1,2,3].map(i => `
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                        <input name="menu_label_${i}" value="${s.menuOptions?.[i]?.label || ''}" placeholder="خيار المنيو ${i+1}">
                        <input name="menu_emoji_${i}" value="${s.menuOptions?.[i]?.emoji || ''}" placeholder="إيموجي">
                    </div>
                `).join('')}

                <label>📢 قناة الإرسال (اختياري):</label>
                <select name="targetChannel">
                    <option value="">-- لا ترسل الآن --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c => 
                        `<option value="${c.id}"># ${c.name}</option>`
                    ).join('')}
                </select>

                <button type="submit" class="btn-save mt-20">💾 حفظ وإرسال</button>
            </div>
        </form>
    `;
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

        const config = await TicketConfig.findOneAndUpdate(
            { guildId: req.params.guildId }, { $set: updateData }, { upsert: true, new: true }
        );

        if (b.targetChannel) {
            const channel = g.channels.cache.get(b.targetChannel);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle(config.title || "TICKETS")
                    .setDescription(config.description || "اضغط للفتح")
                    .setColor(config.color || "#5865F2");

                const components = [];

                if (config.buttons?.length > 0) {
                    const btnRow = new ActionRowBuilder();
                    config.buttons.forEach((btn, i) => {
                        const button = new ButtonBuilder()
                            .setCustomId(`ticket_btn_${i}`)
                            .setLabel(btn.label)
                            .setStyle(ButtonStyle.Primary);
                        if (btn.emoji && btn.emoji.trim() !== "") {
                            try { button.setEmoji(btn.emoji.trim()); } catch (e) { }
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
                            try { option.emoji = opt.emoji.trim(); } catch (e) { }
                        }
                        select.addOptions(option);
                    });
                    components.push(new ActionRowBuilder().addComponents(select));
                }

                if (components.length === 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Primary)
                    ));
                }

                await channel.send({ embeds: [embed], components }).catch(e => console.error("Discord Send Error:", e));
            }
        }
        res.redirect(`/manage/${req.params.guildId}/tickets`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Error");
    }
});

// --- [ Welcome Settings ] ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };
    const content = `
        <form method="POST" action="/save/${g.id}/welcome">
            <div class="card">
                <h3>${icons.welcome} إعدادات نظام الترحيب</h3>

                <h4>تفعيل النظام:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <label>
                        <input type="radio" name="enabled" value="true" ${s.welcome?.enabled ? 'checked' : ''}>
                        تشغيل
                    </label>
                    <label>
                        <input type="radio" name="enabled" value="false" ${!s.welcome?.enabled ? 'checked' : ''}>
                        إيقاف
                    </label>
                </div>

                <label>قناة الترحيب:</label>
                <select name="channel">
                    <option value="">-- اختر القناة --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c => 
                        `<option value="${c.id}" ${s.welcome?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`
                    ).join('')}
                </select>

                <label>رسالة الترحيب:</label>
                <textarea name="embedMessage">${s.welcome?.embedMessage || ''}</textarea>
                <small style="color: var(--light);">استخدم: {member} للعضو، {guild} لاسم السيرفر، {count} لعدد الأعضاء</small>

                <label>صورة الخلفية (URL):</label>
                <input name="imagePath" value="${s.welcome?.imagePath || ''}" placeholder="https://...">

                <label>موضع الصورة - X (%):</label>
                <input type="number" name="avatarX" value="${s.welcome?.avatarX || 50}" min="0" max="100">

                <label>موضع الصورة - Y (%):</label>
                <input type="number" name="avatarY" value="${s.welcome?.avatarY || 50}" min="0" max="100">

                <label>عرض الصورة (بكسل):</label>
                <input type="number" name="avatarWidth" value="${s.welcome?.avatarWidth || 150}" min="50" max="500">

                <label>ارتفاع الصورة (بكسل):</label>
                <input type="number" name="avatarHeight" value="${s.welcome?.avatarHeight || 150}" min="50" max="500">

                <button type="submit" class="btn-save mt-20">💾 حفظ إعدادات الترحيب</button>
            </div>
        </form>
    `;
    res.send(ui(g, 'welcome', content));
});

app.post('/save/:guildId/welcome', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        $set: {
            "welcome.enabled": b.enabled === 'true',
            "welcome.channel": b.channel,
            "welcome.embedMessage": b.embedMessage,
            "welcome.imagePath": b.imagePath,
            "welcome.avatarX": parseInt(b.avatarX) || 50,
            "welcome.avatarY": parseInt(b.avatarY) || 50,
            "welcome.avatarWidth": parseInt(b.avatarWidth) || 150,
            "welcome.avatarHeight": parseInt(b.avatarHeight) || 150
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/welcome`);
});

// --- [ Clans Management ] ---
app.get('/manage/:guildId/clans', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const clans = await Clan.find({ guildId: g.id }) || [];

    const clansHtml = clans.map((clan, idx) => `
        <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4>${clan.clanName}</h4>
                    <p style="color: var(--light); font-size: 12px;">القائد: <@${clan.leaderId}></p>
                    <p style="color: var(--light); font-size: 12px;">الأعضاء: ${clan.members?.length || 0}</p>
                    <p style="color: var(--success); font-size: 12px;">النقاط: ${clan.points}</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <a href="/manage/${g.id}/clan/${clan._id}/edit" class="btn-save" style="text-decoration: none;">✏️ تعديل</a>
                    <a href="/manage/${g.id}/clan/${clan._id}/delete" class="btn-delete" style="text-decoration: none;">🗑️ حذف</a>
                </div>
            </div>
        </div>
    `).join('');

    const content = `
        <form method="POST" action="/save/${g.id}/clan/create">
            <div class="card">
                <h3>${icons.clan} إنشاء كلان جديد</h3>

                <label>اسم الكلان:</label>
                <input name="clanName" placeholder="اسم الكلان" required>

                <label>القائد:</label>
                <select name="leaderId" required>
                    <option value="">-- اختر القائد --</option>
                    ${g.members.cache.map(m => 
                        `<option value="${m.id}">${m.user.username}</option>`
                    ).join('')}
                </select>

                <label>الرتبة المرتبطة:</label>
                <select name="roleId">
                    <option value="">-- اختر الرتبة (اختياري) --</option>
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => 
                        `<option value="${r.id}">${r.name}</option>`
                    ).join('')}
                </select>

                <button type="submit" class="btn-save mt-20">➕ إنشاء الكلان</button>
            </div>
        </form>

        <div style="margin-top: 30px;">
            <h3 style="color: var(--primary); margin-bottom: 20px;">${icons.clan} الكلانات الموجودة</h3>
            ${clansHtml || '<p style="color: var(--light);">لا توجد كلانات حالياً</p>'}
        </div>
    `;
    res.send(ui(g, 'clans', content));
});

app.post('/save/:guildId/clan/create', checkAuth, async (req, res) => {
    try {
        const { clanName, leaderId, roleId } = req.body;
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.status(404).send("Guild not found");

        const clanCount = await Clan.countDocuments({ guildId: req.params.guildId });

        await Clan.create({
            guildId: req.params.guildId,
            clanIndex: clanCount + 1,
            clanName,
            leaderId,
            roleId: roleId || null,
            assistantIds: [],
            members: [leaderId],
            points: 0
        });

        res.redirect(`/manage/${req.params.guildId}/clans`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Error");
    }
});

// --- [ Levels ] ---
app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { levels: {} };

    const content = `
        <form method="POST" action="/save/${g.id}/levels">
            <div class="card">
                <h3>🏆 إعدادات نظام المستويات</h3>

                <h4>تفعيل النظام:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <label>
                        <input type="radio" name="enabled" value="true" ${s.levels?.enabled ? 'checked' : ''}>
                        تشغيل
                    </label>
                    <label>
                        <input type="radio" name="enabled" value="false" ${!s.levels?.enabled ? 'checked' : ''}>
                        إيقاف
                    </label>
                </div>

                <label>نقاط XP لكل رسالة:</label>
                <input type="number" name="xpPerMessage" value="${s.levels?.xpPerMessage || 10}" min="1" max="100">

                <label>قناة الترقية:</label>
                <select name="levelUpChannel">
                    <option value="">-- اختر القناة --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c => 
                        `<option value="${c.id}" ${s.levels?.levelUpChannel === c.id ? 'selected' : ''}># ${c.name}</option>`
                    ).join('')}
                </select>

                <button type="submit" class="btn-save mt-20">💾 حفظ إعدادات المستويات</button>
            </div>
        </form>
    `;
    res.send(ui(g, 'levels', content));
});

app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    const b = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        $set: {
            "levels.enabled": b.enabled === 'true',
            "levels.xpPerMessage": parseInt(b.xpPerMessage) || 10,
            "levels.levelUpChannel": b.levelUpChannel
        }
    }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/levels`);
});

// --- [ Kick Notifications ] ---
app.get('/manage/:guildId/kick', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await KickConfig.findOne({ guildId: g.id }) || { streamers: [] };
    const content = `
        <form method="POST" action="/save/${g.id}/kick">
            <div class="card">
                <h3>${icons.shield} تنبيهات Kick المباشرة</h3>

                <label>اسم المستخدم في Kick:</label>
                <input name="kickUser" placeholder="اسم المستخدم">

                <label>قناة التنبيه:</label>
                <select name="channelId">
                    ${g.channels.cache.filter(c => c.type === 0).map(c => 
                        `<option value="${c.id}"># ${c.name}</option>`
                    ).join('')}
                </select>

                <button type="submit" class="btn-save mt-20">➕ إضافة ستريمر جديد</button>
            </div>
        </form>

        ${s.streamers.length > 0 ? `
        <div class="card" style="margin-top: 20px;">
            <h3>الستريمرز المضافين:</h3>
            ${s.streamers.map((st, i) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 10px;">
                    <span>${st.kickUsername}</span>
                    <a href="/delete-kick/${g.id}/${i}" class="btn-delete" style="text-decoration: none;">🗑️ حذف</a>
                </div>
            `).join('')}
        </div>` : ''}
    `;
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

// ==========================================
// 7️⃣ Discord Bot Events
// ==========================================

client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    // --- [ Security System ] ---
    const config = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (config?.security) {
        const isBypass = msg.member?.roles.cache.some(r => config.security.bypassRoles?.includes(r.id));
        if (!isBypass) {
            // Check bad words
            if (config.security.badWords) {
                const badWords = config.security.badWords.split(',').map(w => w.trim().toLowerCase());
                if (badWords.some(w => msg.content.toLowerCase().includes(w))) {
                    if (config.security.punishment === 'none') {
                        await msg.delete().catch(() => {});
                    } else if (config.security.punishment === 'warn') {
                        await msg.reply('⚠️ تم تحذيرك لاستخدام كلمات ممنوعة').then(m => setTimeout(() => m.delete(), 5000));
                    } else if (config.security.punishment === 'timeout') {
                        await msg.member?.timeout(60000, 'استخدام كلمات ممنوعة').catch(() => {});
                    }
                    return;
                }
            }

            // Check bad emojis
            if (config.security.badEmojis) {
                const badEmojis = config.security.badEmojis.split(',').map(e => e.trim());
                if (badEmojis.some(e => msg.content.includes(e))) {
                    if (config.security.emojiPunishment === 'none') {
                        await msg.delete().catch(() => {});
                    } else if (config.security.emojiPunishment === 'warn') {
                        await msg.reply('⚠️ تم تحذيرك لاستخدام إيموجيات ممنوعة').then(m => setTimeout(() => m.delete(), 5000));
                    } else if (config.security.emojiPunishment === 'timeout') {
                        await msg.member?.timeout(60000, 'استخدام إيموجيات ممنوعة').catch(() => {});
                    }
                    return;
                }
            }

            // Check links
            if (config.security.antiLinks && /https?:\/\//.test(msg.content)) {
                if (config.security.punishment === 'none') {
                    await msg.delete().catch(() => {});
                } else if (config.security.punishment === 'warn') {
                    await msg.reply('⚠️ الروابط ممنوعة في هذا السيرفر').then(m => setTimeout(() => m.delete(), 5000));
                } else if (config.security.punishment === 'timeout') {
                    await msg.member?.timeout(60000, 'إرسال رابط').catch(() => {});
                }
                return;
            }
        }
    }

    // --- [ Clan Control Command ] ---
    if (msg.content === 'تحكم') {
        const myClan = await Clan.findOne({
            guildId: msg.guild.id,
            $or: [{ leaderId: msg.author.id }, { assistantIds: msg.author.id }]
        });
        if (!myClan) return msg.reply("❌ هذا الأمر مخصص لقادة الكلان ومساعديهم فقط.");

        const isLeader = myClan.leaderId === msg.author.id;
        const isAssistant = myClan.assistantIds?.includes(msg.author.id);

        const options = [
            { label: 'إضافة عضو', value: 'add_mem' },
            { label: 'طرد عضو', value: 'kick_mem' },
            { label: 'إحصائيات الكلان', value: 'show_stats' }
        ];

        if (isLeader) {
            options.push({ label: 'إضافة مساعد', value: 'add_assist' });
            options.push({ label: 'طرد مساعد', value: 'remove_assist' });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`clan_control_${myClan.clanIndex}`)
            .setPlaceholder('⚙️ لوحة إدارة الكلان')
            .addOptions(options);

        msg.reply({ components: [new ActionRowBuilder().addComponents(menu)] });
    }

    // --- [ XP System ] ---
    if (config?.levels?.enabled) {
        const userLevel = await UserLevel.findOne({ guildId: msg.guild.id, userId: msg.author.id }) || 
            new UserLevel({ guildId: msg.guild.id, userId: msg.author.id });
        
        userLevel.xp += config.levels.xpPerMessage || 10;
        userLevel.msgCount = (userLevel.msgCount || 0) + 1;
        
        const xpPerLevel = 100;
        const newLevel = Math.floor(userLevel.xp / xpPerLevel) + 1;
        
        if (newLevel > userLevel.level) {
            userLevel.level = newLevel;
            if (config.levels.levelUpChannel) {
                const channel = msg.guild.channels.cache.get(config.levels.levelUpChannel);
                if (channel) {
                    channel.send(`🎉 تهانينا <@${msg.author.id}>! وصلت للمستوى **${newLevel}**`);
                }
            }
        }
        
        await userLevel.save();
    }
});

// --- [ Welcome Message ] ---
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

        const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.drawImage(avatar, x - (avW / 2), y - (avH / 2), avW, avH);
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
            .setFooter({ text: `VORTEX • العضو رقم ${member.guild.memberCount}`, iconURL: member.guild.iconURL() });

        welcomeChannel.send({ embeds: [welcomeEmbed], files: [attachment] });
    } catch (err) {
        console.error("Welcome Error:", err);
    }
});

// --- [ Interaction Handler ] ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('clan_control_')) {
            const clanIndex = parseInt(interaction.customId.split('_')[2]);
            const clan = await Clan.findOne({ guildId: interaction.guild.id, clanIndex });
            if (!clan) return interaction.reply({ content: '❌ الكلان غير موجود', ephemeral: true });

            const isLeader = clan.leaderId === interaction.user.id;
            const isAssistant = clan.assistantIds?.includes(interaction.user.id);

            if (!isLeader && !isAssistant) {
                return interaction.reply({ content: '❌ ليس لديك صلاحيات', ephemeral: true });
            }

            const action = interaction.values[0];

            if (action === 'add_mem') {
                const modal = new ModalBuilder()
                    .setCustomId(`add_member_${clan._id}`)
                    .setTitle('إضافة عضو للكلان')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('member_id')
                                .setLabel('معرف العضو (ID)')
                                .setStyle(TextInputStyle.Short)
                        )
                    );
                await interaction.showModal(modal);
            } else if (action === 'kick_mem') {
                const modal = new ModalBuilder()
                    .setCustomId(`kick_member_${clan._id}`)
                    .setTitle('طرد عضو من الكلان')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('member_id')
                                .setLabel('معرف العضو (ID)')
                                .setStyle(TextInputStyle.Short)
                        )
                    );
                await interaction.showModal(modal);
            } else if (action === 'show_stats') {
                const statsEmbed = new EmbedBuilder()
                    .setTitle(`📊 إحصائيات كلان ${clan.clanName}`)
                    .addFields(
                        { name: '👑 القائد', value: `<@${clan.leaderId}>`, inline: true },
                        { name: '👥 عدد الأعضاء', value: clan.members?.length.toString() || '0', inline: true },
                        { name: '⭐ النقاط', value: clan.points.toString(), inline: true },
                        { name: '🤝 المساعدين', value: clan.assistantIds?.length > 0 ? clan.assistantIds.map(id => `<@${id}>`).join(', ') : 'لا يوجد', inline: false },
                        { name: '👨‍👩‍👧‍👦 الأعضاء', value: clan.members?.length > 0 ? clan.members.map(id => `<@${id}>`).join(', ') : 'لا يوجد', inline: false }
                    )
                    .setColor('#5865F2');
                await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
            } else if (action === 'add_assist' && isLeader) {
                const modal = new ModalBuilder()
                    .setCustomId(`add_assist_${clan._id}`)
                    .setTitle('إضافة مساعد للكلان')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('member_id')
                                .setLabel('معرف العضو (ID)')
                                .setStyle(TextInputStyle.Short)
                        )
                    );
                await interaction.showModal(modal);
            } else if (action === 'remove_assist' && isLeader) {
                const modal = new ModalBuilder()
                    .setCustomId(`remove_assist_${clan._id}`)
                    .setTitle('طرد مساعد من الكلان')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('member_id')
                                .setLabel('معرف المساعد (ID)')
                                .setStyle(TextInputStyle.Short)
                        )
                    );
                await interaction.showModal(modal);
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('add_member_')) {
            const clanId = interaction.customId.split('_')[2];
            const memberId = interaction.fields.getTextInputValue('member_id');
            const clan = await Clan.findById(clanId);
            if (!clan) return interaction.reply({ content: '❌ الكلان غير موجود', ephemeral: true });

            if (clan.members?.includes(memberId)) {
                return interaction.reply({ content: '❌ العضو موجود بالفعل في الكلان', ephemeral: true });
            }

            clan.members.push(memberId);
            await clan.save();
            interaction.reply({ content: `✅ تمت إضافة <@${memberId}> للكلان`, ephemeral: true });
        } else if (interaction.customId.startsWith('kick_member_')) {
            const clanId = interaction.customId.split('_')[2];
            const memberId = interaction.fields.getTextInputValue('member_id');
            const clan = await Clan.findById(clanId);
            if (!clan) return interaction.reply({ content: '❌ الكلان غير موجود', ephemeral: true });

            clan.members = clan.members?.filter(id => id !== memberId) || [];
            await clan.save();
            interaction.reply({ content: `✅ تم طرد <@${memberId}> من الكلان`, ephemeral: true });
        } else if (interaction.customId.startsWith('add_assist_')) {
            const clanId = interaction.customId.split('_')[2];
            const memberId = interaction.fields.getTextInputValue('member_id');
            const clan = await Clan.findById(clanId);
            if (!clan) return interaction.reply({ content: '❌ الكلان غير موجود', ephemeral: true });

            if (clan.assistantIds?.includes(memberId)) {
                return interaction.reply({ content: '❌ هذا العضو مساعد بالفعل', ephemeral: true });
            }

            clan.assistantIds.push(memberId);
            await clan.save();
            interaction.reply({ content: `✅ تمت ترقية <@${memberId}> لمساعد`, ephemeral: true });
        } else if (interaction.customId.startsWith('remove_assist_')) {
            const clanId = interaction.customId.split('_')[2];
            const memberId = interaction.fields.getTextInputValue('member_id');
            const clan = await Clan.findById(clanId);
            if (!clan) return interaction.reply({ content: '❌ الكلان غير موجود', ephemeral: true });

            clan.assistantIds = clan.assistantIds?.filter(id => id !== memberId) || [];
            await clan.save();
            interaction.reply({ content: `✅ تم سحب رتبة المساعد من <@${memberId}>`, ephemeral: true });
        }
    }
});

// ==========================================
// 8️⃣ Database Connection & Server Start
// ==========================================

mongoose.connect(process.env.MONGO_CONNECTION_STRING)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Error:', err));

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);

app.listen(PORT, () => {
    console.log(`🚀 Dashboard running on http://localhost:${PORT}`);
});
