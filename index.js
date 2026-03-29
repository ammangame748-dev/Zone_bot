require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent, AttachmentBuilder } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const backup = require('discord-backup'); // الميزانية الجديدة

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember]
});

// ===== 1. قاعدة البيانات (Schemas) =====
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ Connected to MongoDB Database'));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    backupId: String, 
    security: { 
        antiLinks: Boolean, 
        badWords: String, 
        badEmojis: String, 
        punishment: { type: String, default: 'none' }, 
        bypassRoles: [String] 
    },
    levels: { enabled: Boolean, xpPerMessage: Number, levelUpChannel: String },
    logs: {
        messages: { channel: String, enabled: Boolean },
        moderation: { channel: String, enabled: Boolean },
        members: { channel: String, enabled: Boolean }
    },
    welcome: {
        enabled: Boolean, channel: String, message: String, imagePath: String,
        customText: { type: String, default: 'Welcome' },
        textX: { type: Number, default: 250 }, 
        textY: { type: Number, default: 150 }, 
        fontSize: { type: Number, default: 40 }
    }
}));

const UserLevel = mongoose.model('UserLevel', new mongoose.Schema({
    guildId: String, userId: String, xp: { type: Number, default: 0 }, level: { type: Number, default: 1 }
}));

// ===== 2. إعدادات الرفع =====
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== 3. نظام التوثيق (Passport) =====
passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
passport.use(new Strategy({ 
    clientID: process.env.CLIENT_ID, 
    clientSecret: process.env.CLIENT_SECRET, 
    callbackURL: process.env.CALLBACK_URL, 
    scope: ['identify', 'guilds'] 
}, (a, r, p, d) => d(null, p)));

app.use(session({ secret: 'zone-ultra-secret-long-key-12345', resave: false, saveUninitialized: false }));
app.use(passport.initialize()); app.use(passport.session());
app.use(express.urlencoded({ extended: true, limit: '10mb' })); app.use(express.json());

const checkAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/login');

// ===== 4. دالة التصميم (النيون الفاقع) =====
function ui(guild, active, content) {
    const showNav = guild.id ? 'block' : 'none';
    return `
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com">
        <style>
            @import url('https://fonts.googleapis.com');
            :root { --p: #5865F2; --s: #ff007f; --accent: #00f2ff; --bg: #050608; --card: rgba(255,255,255,0.03); }
            body { margin: 0; font-family: 'Changa', sans-serif; background: var(--bg); color: white; display: flex; min-height: 100vh; }
            .sidebar { width: 280px; background: #0a0c12; position: fixed; right: 0; height: 100vh; padding: 30px 15px; border-left: 3px solid var(--s); box-shadow: -5px 0 25px rgba(255, 0, 127, 0.4); z-index: 1000; }
            .sidebar h2 { background: linear-gradient(to left, var(--p), var(--s)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; font-size: 30px; margin-bottom: 40px; filter: drop-shadow(0 0 10px var(--s)); }
            .nav a { display: flex; align-items: center; padding: 14px 20px; margin: 10px 0; border-radius: 15px; color: #8b949e; text-decoration: none; transition: 0.3s; gap: 15px; border: 1px solid transparent; }
            .nav a:hover, .nav a.active { background: rgba(255, 0, 127, 0.1); color: white; border: 1px solid var(--accent); box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); transform: translateX(-10px); }
            .main { margin-right: 280px; padding: 40px; width: calc(100% - 280px); background: radial-gradient(circle at center, #101218 0%, #050608 100%); }
            .card { background: var(--card); backdrop-filter: blur(12px); padding: 25px; border-radius: 20px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.1); transition: 0.3s; }
            .card:hover { border-color: var(--s); box-shadow: 0 0 30px rgba(255, 0, 127, 0.2); }
            .card h3 { color: var(--accent); margin-top: 0; text-shadow: 0 0 10px var(--accent); }
            .btn-save { background: linear-gradient(45deg, var(--p), var(--s)); color: white; border: none; padding: 18px; border-radius: 15px; cursor: pointer; width: 100%; font-weight: bold; font-size: 18px; box-shadow: 0 5px 20px rgba(255, 0, 127, 0.4); transition: 0.3s; }
            .btn-save:hover { transform: scale(1.03); filter: brightness(1.2); }
            .btn-backup { background: #00ff88; color: #000; font-weight: bold; }
            .btn-restore { background: #ff4757; margin-top: 10px; }
            input, select, textarea { width: 100%; padding: 14px; border-radius: 12px; background: #161b22; color: white; border: 1px solid #30363d; margin: 10px 0; outline: none; font-family: 'Changa'; }
            .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(255,255,255,0.02); border-radius: 12px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <h2>ZONE SYSTEM</h2>
            <div class="nav">
                <a class="${active=='home'?'active':''}" href="/dashboard"><i class="fas fa-server"></i> السيرفرات</a>
                <div style="display: ${showNav}">
                    <a class="${active=='security'?'active':''}" href="/manage/${guild.id}/security"><i class="fas fa-shield-halved"></i> الحماية القصوى</a>
                    <a class="${active=='backup'?'active':''}" href="/manage/${guild.id}/backup"><i class="fas fa-history"></i> النسخ الاحتياطي 🔐</a>
                    <a class="${active=='levels'?'active':''}" href="/manage/${guild.id}/levels"><i class="fas fa-medal"></i> نظام المستويات</a>
                    <a class="${active=='logs'?'active':''}" href="/manage/${guild.id}/logs"><i class="fas fa-list-check"></i> سجل اللوج</a>
                    <a class="${active=='welcome'?'active':''}" href="/manage/${guild.id}/welcome"><i class="fas fa-door-open"></i> الترحيب الجديد</a>
                </div>
            </div>
        </div>
        <div class="main">
            <h2 style="margin-bottom:30px; text-shadow: 0 0 15px var(--p)">⚡ ${guild.name || 'الرئيسية'}</h2>
            ${content}
        </div>
    </body></html>`;
}

// ===== 5. المسارات (Routes) =====

app.get('/login', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    let content = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:25px">`;
    content += adminGuilds.map(g => `
        <a href="/manage/${g.id}/security" style="text-decoration:none; color:white">
            <div class="card" style="text-align:center">
                <div style="width:70px; height:70px; background:var(--p); border-radius:50%; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:20px; box-shadow: 0 0 20px var(--p)">${g.name}</div>
                <h4>${g.name}</h4>
                <span style="color:var(--accent)">إدارة السيرفر ⚡</span>
            </div>
        </a>`).join('');
    content += `</div>`;
    res.send(ui({name:"قائمة السيرفرات", id:""}, "home", content));
});

// --- النسخ الاحتياطي (Backup) ---
app.get('/manage/:guildId/backup', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect('/dashboard');
    const config = await GuildConfig.findOne({ guildId: guild.id });
    let content = `
    <div class="card">
        <h3>🔐 نظام النسخ والرجوع بالزمن</h3>
        <p>هذا النظام يحفظ (القنوات، الرتب، الصلاحيات، والشات) لضمان عدم ضياع السيرفر.</p>
        <form action="/manage/${guild.id}/backup/create" method="POST">
            <button class="btn-save btn-backup" type="submit">إنشاء نسخة احتياطية (SnapShot)</button>
        </form>
        ${config?.backupId ? `
        <div class="toggle-row" style="margin-top:20px; border-color:var(--accent)">
            <span>آيدي النسخة الحالية: <code style="color:var(--accent)">${config.backupId}</code></span>
        </div>
        <form action="/manage/${guild.id}/backup/restore" method="POST" onsubmit="return confirm('⚠️ تحذير: سيتم حذف القنوات الحالية واسترجاع النسخة. هل أنت متأكد؟')">
            <button class="btn-save btn-restore" type="submit">استرجاع السيرفر الآن</button>
        </form>` : `<p style="color:gray; margin-top:15px">لا توجد نسخ سابقة.</p>`}
    </div>`;
    res.send(ui(guild, "backup", content));
});

app.post('/manage/:guildId/backup/create', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    backup.create(guild, { jsonBeautify: true, saveImages: "base64" }).then(async (data) => {
        await GuildConfig.findOneAndUpdate({ guildId: guild.id }, { backupId: data.id }, { upsert: true });
        res.redirect('back');
    });
});

app.post('/manage/:guildId/backup/restore', checkAuth, async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    const guild = client.guilds.cache.get(req.params.guildId);
    if (config?.backupId) {
        backup.load(config.backupId, guild).catch(e => console.log(e));
        res.send("<h1 style='background:black; color:white; padding:50px; text-align:center;'>جاري الاسترجاع... السيرفر سيعود بعد قليل</h1>");
    }
});

// --- الحماية (Security) ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect('/dashboard');
    const config = await GuildConfig.findOne({ guildId: guild.id }) || { security: {} };
    let content = `
    <form action="/manage/${guild.id}/security" method="POST">
        <div class="card">
            <h3>🛡️ إعدادات الحماية القصوى</h3>
            <div class="toggle-row">
                <span>منع الروابط</span>
                <input type="checkbox" name="antiLinks" ${config.security.antiLinks ? 'checked' : ''}>
            </div>
            <label>الكلمات الممنوعة</label>
            <textarea name="badWords">${config.security.badWords || ''}</textarea>
            <label>العقوبة</label>
            <select name="punishment">
                <option value="none" ${config.security.punishment=='none'?'selected':''}>لا شيء</option>
                <option value="warn" ${config.security.punishment=='warn'?'selected':''}>تحذير</option>
                <option value="kick" ${config.security.punishment=='kick'?'selected':''}>طرد</option>
            </select>
            <button class="btn-save" type="submit">حفظ التعديلات</button>
        </div>
    </form>`;
    res.send(ui(guild, "security", content));
});

app.post('/manage/:guildId/security', checkAuth, async (req, res) => {
    const { antiLinks, badWords, punishment } = req.body;
    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { "security.antiLinks": !!antiLinks, "security.badWords": badWords, "security.punishment": punishment },
        { upsert: true }
    );
    res.redirect('back');
});

// --- الترحيب (Welcome) - بكل التفاصيل ---
app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { welcome: {} };
    let content = `
    <form action="/manage/${guild.id}/welcome" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3>👋 إعدادات الترحيب والكانفس</h3>
            <div class="toggle-row">
                <span>تفعيل النظام</span>
                <input type="checkbox" name="enabled" ${config.welcome.enabled ? 'checked' : ''}>
            </div>
            <label>روم الترحيب</label>
            <select name="channel">
                ${guild.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${config.welcome.channel==c.id?'selected':''}>#${c.name}</option>`).join('')}
            </select>
            <label>نص الترحيب</label>
            <textarea name="message">${config.welcome.message || ''}</textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                <div><label>إحداثيات X</label><input type="number" name="textX" value="${config.welcome.textX || 250}"></div>
                <div><label>إحداثيات Y</label><input type="number" name="textY" value="${config.welcome.textY || 150}"></div>
            </div>
            <label>حجم الخط</label>
            <input type="number" name="fontSize" value="${config.welcome.fontSize || 40}">
            <label>تغيير الصورة</label>
            <input type="file" name="image">
            <button class="btn-save" type="submit">حفظ الترحيب</button>
        </div>
    </form>`;
    res.send(ui(guild, "welcome", content));
});

app.post('/manage/:guildId/welcome', checkAuth, upload.single('image'), async (req, res) => {
    const { enabled, channel, message, textX, textY, fontSize } = req.body;
    const update = { 
        "welcome.enabled": !!enabled, "welcome.channel": channel, "welcome.message": message,
        "welcome.textX": parseInt(textX), "welcome.textY": parseInt(textY), "welcome.fontSize": parseInt(fontSize)
    };
    if (req.file) update["welcome.imagePath"] = req.file.path;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, update, { upsert: true });
    res.redirect('back');
});

// --- سجل اللوج (Logs) ---
app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { logs: { messages: {}, moderation: {}, members: {} } };
    let content = `
    <form action="/manage/${guild.id}/logs" method="POST">
        <div class="card">
            <h3>📜 سجلات السيرفر (Logs)</h3>
            <div class="toggle-row"><span>لوج الرسائل</span><input type="checkbox" name="msgEnabled" ${config.logs.messages.enabled?'checked':''}></div>
            <select name="msgChannel">
                ${guild.channels.cache.filter(c => c.type === 0).map(c => `<option value="${c.id}" ${config.logs.messages.channel==c.id?'selected':''}>#${c.name}</option>`).join('')}
            </select>
            <button class="btn-save" type="submit">حفظ اللوج</button>
        </div>
    </form>`;
    res.send(ui(guild, "logs", content));
});

app.post('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const { msgEnabled, msgChannel } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        "logs.messages.enabled": !!msgEnabled, "logs.messages.channel": msgChannel
    }, { upsert: true });
    res.redirect('back');
});

// --- المستويات (Levels) ---
app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || { levels: {} };
    let content = `
    <form action="/manage/${guild.id}/levels" method="POST">
        <div class="card">
            <h3>📈 نظام المستويات</h3>
            <div class="toggle-row"><span>تفعيل المستويات</span><input type="checkbox" name="lvlEnabled" ${config.levels.enabled?'checked':''}></div>
            <label>XP لكل رسالة</label>
            <input type="number" name="xpPerMessage" value="${config.levels.xpPerMessage || 10}">
            <button class="btn-save" type="submit">حفظ الإعدادات</button>
        </div>
    </form>`;
    res.send(ui(guild, "levels", content));
});

app.post('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const { lvlEnabled, xpPerMessage } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, {
        "levels.enabled": !!lvlEnabled, "levels.xpPerMessage": parseInt(xpPerMessage)
    }, { upsert: true });
    res.redirect('back');
});

client.login(process.env.TOKEN);
app.listen(3000, () => console.log('🚀 Server is running on http://localhost:3000'));