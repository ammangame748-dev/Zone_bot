// ==========================================
// 1️⃣ استدعاء المكتبات (Requires)
// ==========================================
require('dotenv').config();
const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent,
    AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelType, PermissionFlagsBits
} = require('discord.js');

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ms = require('ms');

const app = express();
const PORT = process.env.PORT || 3000;

// التأكد من وجود مجلد الصور لضمان عدم توقف البوت
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// ==========================================
// 2️⃣ تعريف الـ Client (إعدادات البوت)
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
const ModConfig = mongoose.model('ModConfig', new mongoose.Schema({
    guildId: String,
    jail: {
        commandName: { type: String, default: 'jail' },
        unjailCommand: { type: String, default: 'unjail' }, // الخانة الجديدة لفك السجن
        roleId: String,
        channelId: String,
        logChannelId: String,
        adminRoles: [String]
    }
}));



// ملاحظة: احتفظ بباقي الـ Schemas (GuildConfig, Stats, UserLevel, Giveaway) كما هي بالأسفل


// ==========================================
// 3️⃣ اتصال قاعدة البيانات (MongoDB)
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Database'))
    .catch(err => console.log("❌ DB Connection Error:", err));

// ==========================================
// 4️⃣ تعريف الـ Schemas (قاعدة البيانات)
// ==========================================

// 4.1 إعدادات السيرفر العامة
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
        levelUpChannel: String
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
        enabled: Boolean,
        channel: String,
        message: String,
        imagePath: String,
        customText: { type: String, default: 'Welcome' },
        textX: { type: Number, default: 250 },
        textY: { type: Number, default: 150 },
        fontSize: { type: Number, default: 40 }
    },
    autoReply: [{ trigger: String, reply: String }]
}));

// 4.2 إحصائيات السيرفر المتطورة
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

// 4.3 مستويات المستخدمين
const UserLevel = mongoose.model('UserLevel', new mongoose.Schema({
    guildId: String,
    userId: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    msgCount: { type: Number, default: 0 }
}));

// 4.4 إعدادات القيف اواي
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

// 4.5 إعدادات نظام التذاكر النيون
const TicketConfig = mongoose.model('TicketConfig', new mongoose.Schema({
    guildId: String,
    channelId: String,
    title: String,
    description: String,
    color: String,
    adminRole: String,
    topImagePath: String,
    bottomImagePath: String,
    buttons: [{ label: String, emoji: String }],
    menuOptions: [{ label: String, emoji: String }]
}));

// ==========================================
// 5️⃣ الدوال المساعدة (Helper Functions)
// ==========================================
async function getExecutor(guild, eventType) {
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: eventType });
        const entry = auditLogs.entries.first();
        if (!entry) return "تلقائي / غير معروف";
        return `${entry.executor.tag}`;
    } catch (e) { return "صلاحيات ناقصة (Audit Log)"; }
}

// ✅ الآن يمكنك إكمال باقي الأكواد (client.on) والـ Express Routes بالأسفل


// ===== Upload =====
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

// ===== Auth =====
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(session({
    secret: 'zone-ultra-secret-123',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/dashboard');
});



const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
};

function ui(guild, active, content) {
    const showNav = guild.id ? 'flex' : 'none';
    const guildName = guild.name || 'قائمة السيرفرات';

    return `
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://googleapis.com" rel="stylesheet">
        <style>
            :root { 
                --p: #5865F2; --s: #ff4757; --bg: radial-gradient(circle at center, #1a1a2e 0%, #05051a 100%); 
                --card-bg: rgba(0, 0, 0, 0.6); --accent: #00d2ff; 
            }
            body { margin: 0; font-family: 'Changa', sans-serif; background: var(--bg); background-attachment: fixed; color: white; display: flex; min-height: 100vh; direction: rtl; }
            .sidebar { width: 280px; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); position: fixed; right: 0; height: 100vh; padding: 30px 15px; border-left: 1px solid rgba(255, 255, 255, 0.1); z-index: 1000; display: flex; flex-direction: column; }
            .sidebar h2 { background: linear-gradient(to left, var(--p), var(--s)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; font-size: 30px; margin-bottom: 40px; font-weight: 700; }
            .nav { display: ${showNav}; flex-direction: column; gap: 10px; }
            .nav a { display: flex; align-items: center; padding: 14px 20px; border-radius: 15px; color: #adb5bd; text-decoration: none; transition: 0.3s; gap: 15px; }
            .nav a:hover, .nav a.active { background: rgba(88, 101, 242, 0.15); color: white; border-right: 5px solid var(--p); transform: translateX(-5px); }
            .main { margin-right: ${guild.id ? '280px' : '0'}; padding: 50px; width: 100%; }
            
            /* --- [ تنسيق كروت السيرفرات الجديد ] --- */
            .guild-card {
                background: var(--card-bg); border-radius: 20px; padding: 25px; text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.1); transition: 0.4s; position: relative;
                overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 15px;
            }
            .guild-card:hover { transform: translateY(-10px); border-color: var(--p); box-shadow: 0 10px 30px rgba(88, 101, 242, 0.3); }
            .guild-icon { width: 90px; height: 90px; border-radius: 50%; border: 3px solid var(--p); box-shadow: 0 0 15px var(--p); object-fit: cover; }

            .card { position: relative; background: var(--card-bg); backdrop-filter: blur(15px); padding: 30px; border-radius: 20px; margin-bottom: 30px; border: 1px solid rgba(255, 255, 255, 0.05); overflow: hidden; }
            .card::after { content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 2px; background: linear-gradient(90deg, transparent, var(--p), var(--accent), var(--s), transparent); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: moveBorder 4s linear infinite; pointer-events: none; }
            @keyframes moveBorder { 0% { filter: hue-rotate(0deg); opacity: 0.6; } 100% { filter: hue-rotate(360deg); opacity: 1; } }

            .btn-save { background: linear-gradient(45deg, var(--p), var(--s)); color: white; border: none; padding: 15px; border-radius: 15px; cursor: pointer; width: 100%; font-weight: bold; transition: 0.4s; text-align: center; text-decoration: none; display: block; }
            .btn-save:hover { filter: brightness(1.2); transform: scale(1.02); }
            input, select, textarea { width: 100%; padding: 14px; border-radius: 12px; background: rgba(0, 0, 0, 0.4); color: white; border: 1px solid #333; margin: 10px 0; font-family: 'Changa'; }
            h3 { color: var(--accent); margin: 0; }
        </style>
    </head>
    <body>
        <div class="sidebar">
            <h2>ZONE SYSTEM</h2>
            <div class="nav">
                <a class="${active == 'home' ? 'active' : ''}" href="/dashboard">📊 الإحصائيات</a>
                <a class="${active == 'security' ? 'active' : ''}" href="/manage/${guild.id}/security">🛡️ الحماية</a>
                <a class="${active == 'logs' ? 'active' : ''}" href="/manage/${guild.id}/logs">📜 اللوج</a>
                <a class="${active == 'tickets' ? 'active' : ''}" href="/manage/${guild.id}/tickets">🎫 التذاكر</a>
                <a class="${active == 'autoreply' ? 'active' : ''}" href="/manage/${guild.id}/autoreply">💬 الرد الآلي</a>
                <a class="${active == 'levels' ? 'active' : ''}" href="/manage/${guild.id}/levels">🏆 المستويات</a>
                <a class="${active == 'welcome' ? 'active' : ''}" href="/manage/${guild.id}/welcome">👋 الترحيب</a>
                <a class="${active == 'giveaway' ? 'active' : ''}" href="/manage/${guild.id}/giveaway">🎉 القيف اواي</a>
                <a class="${active == 'mod' ? 'active' : ''}" href="/manage/${guild.id}/mod">🛡️ أوامر الإشراف</a>

            </div>
        </div>
        <div class="main">
            <h2 style="margin-bottom:30px">📍 ${guildName}</h2>
            ${content}
        </div>
    </body>
    </html>`;
}

// تحويل أي شخص يدخل الرابط الرئيسي للداشبورد فوراً
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});


app.get('/dashboard', checkAuth, (req, res) => {
    // 1. فلترة السيرفرات اللي أنت فيها أدمن
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));

    // 2. تحويل السيرفرات لبطاقات (Cards)
    const cards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const iconURL = g.icon
            ? `https://discordapp.com{g.id}/${g.icon}.png?size=256`
            : 'https://placeholder.com';

        return `
        <div class="guild-card">
            <img src="${iconURL}" class="guild-icon">
            <h3 style="color:white; margin:10px 0;">${g.name}</h3>
            ${hasBot
                ? `<a href="/manage/${g.id}/home" class="btn-save" style="text-decoration:none;">⚙️ دخول الإعدادات</a>`
                : `<a href="https://discord.com{process.env.CLIENT_ID}&permissions=8&scope=bot&guild_id=${g.id}" class="btn-save" style="text-decoration:none; background:linear-gradient(45deg, #2ecc71, #27ae60);">➕ إضافة البوت</a>`
            }
        </div>`;
    }).join('');

    const content = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 25px;">${cards}</div>`;

    res.send(ui({ id: null, name: 'قائمة السيرفرات' }, 'home', content));
});



app.post('/save/:guildId/giveaway', checkAuth, async (req, res) => {
    const { prize, description, duration, winners, channel } = req.body;
    const g = client.guilds.cache.get(req.params.guildId);
    const targetChannel = g.channels.cache.get(channel);

    if (!targetChannel) return res.send("الروم غير موجود!");

    // تحويل الوقت باستخدام مكتبة ms اللي عندك
    const durationMs = ms(duration);
    if (!durationMs) return res.send("صيغة الوقت خطأ (مثال: 1h, 1d)");

    const endAt = new Date(Date.now() + durationMs);

    // إرسال الرسالة لديسكورد
    const embed = new EmbedBuilder()
        .setTitle(`🎉 قيف اواي جديد: ${prize}`)
        .setDescription(`${description || 'لا يوجد وصف'}\n\n**ينتهي في:** <t:${Math.floor(endAt / 1000)}:R>\n**عدد الفائزين:** ${winners}`)
        .setColor('#5865F2')
        .setFooter({ text: 'اضغط على 🎉 للاشتراك' });

    const msg = await targetChannel.send({ embeds: [embed] });
    await msg.react('🎉');

    // حفظ في الداتابيز عشان السيستم يعرف ينهيه بعدين
    await Giveaway.create({
        guildId: g.id,
        messageId: msg.id,
        channelId: channel,
        endAt: endAt,
        winnersCount: parseInt(winners),
        prize: prize
    });

    res.redirect(`/manage/${g.id}/giveaway`);
});


app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    // حط السطر هاد وشغل الصفحة مرة وحدة بس، وبعدين احذفه
    await Stats.deleteOne({ guildId: req.params.guildId });

    // 1. جلب البيانات من الداتابيز
    const statsData = await Stats.findOne({ guildId: g.id }) || {
        messages: { total: 0, daily: 0, weekly: 0, monthly: 0 },
        activeChannels: new Map(),
        membersLog: { joined: [], left: [] }
    };

    // 2. حساب إحصائيات الأعضاء (آخر 7 أيام)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMembersCount = (statsData.membersLog?.joined || []).filter(d => d > sevenDaysAgo).length;
    const leftMembersCount = (statsData.membersLog?.left || []).filter(d => d > sevenDaysAgo).length;

    // 3. جلب أكثر عضو متفاعل
    const topUserDoc = await UserLevel.findOne({ guildId: g.id }).sort({ msgCount: -1 });
    const topActiveUser = topUserDoc ? (client.users.cache.get(topUserDoc.userId)?.username || "عضو نشط") : 'لا يوجد';

    // 4. جلب أكثر قناة نشطة
    let mostActiveChannel = "لا يوجد";
    if (statsData.activeChannels && statsData.activeChannels.size > 0) {
        let maxMsgs = 0;
        for (let [chId, count] of statsData.activeChannels) {
            if (count > maxMsgs) {
                maxMsgs = count;
                mostActiveChannel = g.channels.cache.get(chId)?.name || "قناة مخفية";
            }
        }
    }

    // 5. حساب متوسط الرسائل لكل عضو
    const avgMsgs = (statsData.messages.total / (g.memberCount || 1)).toFixed(2);

    const content = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px;">
        
        <!-- بطاقة 1: إحصائيات الأعضاء -->
        <div class="card">
            <h3 style="color:var(--accent); margin-bottom:15px;">👥 إحصائيات الأعضاء</h3>
            <p>📊 إجمالي الأعضاء: <b style="font-size:18px;">${g.memberCount}</b></p>
            <p>✨ أعضاء جدد (آخر 7 أيام): <b style="color:#2ecc71">+${newMembersCount}</b></p>
            <p>🚪 غادروا (آخر 7 أيام): <b style="color:#ff4757">-${leftMembersCount}</b></p>
            <p>🤖 حالة البوت: <span style="color:#2ecc71">● متصل</span></p>
        </div>

        <!-- بطاقة 2: إحصائيات الرسائل والدردشة -->
        <div class="card">
            <h3 style="color:var(--p); margin-bottom:15px;">✉️ إحصائيات الرسائل</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <p>اليوم: <b>${statsData.messages.daily}</b></p>
                <p>أسبوعياً: <b>${statsData.messages.weekly}</b></p>
                <p>شهرياً: <b>${statsData.messages.monthly}</b></p>
                <p>الإجمالي: <b>${statsData.messages.total}</b></p>
            </div>
            <hr style="opacity:0.1; margin:10px 0;">
            <p>🔥 أكثر قناة نشاطاً: <span style="color:var(--accent)">#${mostActiveChannel}</span></p>
            <p>🏆 أكثر عضو نشط: <span style="color:var(--p)">${topActiveUser}</span></p>
        </div>

        <!-- بطاقة 3: تحليل التفاعل -->
        <div class="card">
            <h3 style="color:#f1c40f; margin-bottom:15px;">📈 تحليل التفاعل</h3>
            <p>📉 متوسط الرسائل لكل عضو: <b>${avgMsgs}</b></p>
            <p>📍 نشاط السيرفر العام: <b>${(newMembersCount > leftMembersCount ? 'متزايد 📈' : 'مستقر ⚖️')}</b></p>
            <p style="margin-top:20px; font-size:12px; color:#aaa;">🕒 آخر تحديث: ${new Date().toLocaleTimeString('ar-EG')}</p>
        </div>

    </div>
    `;

    res.send(ui(g, 'home', content));
});

app.get('/login', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Login</title>
            <style>
                body { display:flex; justify-content:center; align-items:center; height:100vh; background:#1a1a2e; color:white; font-family:sans-serif; }
                a { text-decoration:none; color:white; background:#5865F2; padding:15px 30px; border-radius:12px; font-weight:bold; }
                a:hover { filter:brightness(1.2); }
            </style>
        </head>
        <body>
            <a href="/auth/discord">Login with Discord</a>
        </body>
        </html>
    `);
});

app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };

    const roles = g.roles.cache.filter(r => r.name !== "@everyone");

    let content = `
    <form method="POST" action="/save/${g.id}/security">
        <div class="card">
            <h3>🛡️ الحماية</h3>

            <label>منع الروابط</label>
            <input type="checkbox" name="antiLinks" ${s.security?.antiLinks ? 'checked' : ''}>

            <label>كلمات ممنوعة</label>
            <textarea name="badWords">${s.security?.badWords || ''}</textarea>

            <label>إيموجي ممنوع</label>
            <textarea name="badEmojis">${s.security?.badEmojis || ''}</textarea>
        </div>

        <div class="card">
            <h3>🎭 الرتب المستثناة</h3>
            ${roles.map(r => `
                <div>
                    <label>${r.name}</label>
                    <input type="checkbox" name="bypassRoles" value="${r.id}"
                    ${s.security?.bypassRoles?.includes(r.id) ? 'checked' : ''}>
                </div>
            `).join('')}
        </div>

        <button class="btn-save">حفظ</button>
    </form>
    `;

    res.send(ui(g, 'security', content));
});

app.get('/manage/:guildId/levels', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    let s = await GuildConfig.findOne({ guildId: g.id }) || { levels: {} };

    let content = `
    <form method="POST" action="/save/${g.id}/levels">
        <div class="card">
            <h3>🏆 نظام الليفل</h3>

            <label>تفعيل</label>
            <input type="checkbox" name="enabled" ${s.levels?.enabled ? 'checked' : ''}>

            <label>XP لكل رسالة</label>
            <input type="number" name="xp" value="${s.levels?.xpPerMessage || 10}">

            <label>روم الترقية</label>
            <select name="channel">
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
        `<option value="${c.id}">${c.name}</option>`
    )}
            </select>
        </div>

        <button class="btn-save">حفظ</button>
    </form>
    `;

    res.send(ui(g, 'levels', content));
});

// --- [ مسار حفظ إعدادات الليفل ] ---
app.post('/save/:guildId/levels', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const b = req.body;

        // تحديث قاعدة البيانات
        await GuildConfig.findOneAndUpdate(
            { guildId },
            {
                $set: {
                    "levels.enabled": b.enabled === 'on', // فحص إذا كان التفعيل شغّال
                    "levels.xpPerMessage": Number(b.xp) || 10, // تحويل الـ XP لرقم
                    "levels.levelUpChannel": b.channel // قناة الترقية
                }
            },
            { upsert: true }
        );

        // بعد الحفظ، يرجعه لنفس الصفحة عشان ما تطلع الشاشة البيضاء
        res.redirect(`/manage/${guildId}/levels`);

    } catch (err) {
        console.error("❌ Level Save Error:", err);
        res.status(500).send("حدث خطأ أثناء حفظ إعدادات الليفل.");
    }
});


app.get('/manage/:guildId/logs', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    let s = await GuildConfig.findOne({ guildId: g.id }) || { logs: {} };

    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];

    let content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3>📜 نظام اللوق</h3>

            ${types.map(t => `
                <label>${t}</label>
                <input type="checkbox" name="${t}_st" ${s.logs?.[t]?.enabled ? 'checked' : ''}>
                <select name="${t}_ch">
                    ${g.channels.cache.filter(c => c.type === 0).map(c =>
        `<option value="${c.id}" ${s.logs?.[t]?.channel == c.id ? 'selected' : ''}>${c.name}</option>`
    )}
                </select>
                <hr>
            `).join('')}
        </div>

        <button class="btn-save">حفظ اللوق</button>
    </form>
    `;

    res.send(ui(g, 'logs', content));
});

app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
    const b = req.body;
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    let logData = {};

    types.forEach(t => {
        logData[`logs.${t}`] = {
            enabled: b[`${t}_st`] === 'on',
            channel: b[`${t}_ch`]
        };
    });

    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: logData },
        { upsert: true }
    );

    res.redirect(`/manage/${req.params.guildId}/logs`);
});


app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await GuildConfig.findOne({ guildId: g.id }) || { welcome: {} };

    let img = s.welcome?.imagePath ? `/uploads/${path.basename(s.welcome.imagePath)}` : 'https://placeholder.com';

    let content = `
    <div class="card">
        <h3 style="text-align:center">🖼️ معاينة الترحيب الحية</h3>
        <div id="preview-container" style="position: relative; width: 100%; max-width: 800px; margin: 0 auto; border: 3px solid var(--p); border-radius: 20px; overflow: hidden; background: #000;">
            <img id="welcome-img" src="${img}" style="width: 100%; display: block;">
            <div id="welcome-text-preview" style="position: absolute; top: ${s.welcome?.textY || 150}px; left: ${s.welcome?.textX || 250}px; font-size: ${s.welcome?.fontSize || 40}px; color: white; white-space: nowrap; font-weight: bold; text-shadow: 2px 2px 8px #000; pointer-events: none;">
                ${s.welcome?.customText || 'Welcome Member'}
            </div>
        </div>
    </div>

    <form method="POST" action="/save/${g.id}/welcome" enctype="multipart/form-data">
        <div class="card">
            <h3>⚙️ إعدادات الإرسال</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <label>📍 قناة الترحيب:</label>
                    <select name="channel" required style="border: 1px solid var(--p);">
                        <option value="">-- اختر القناة --</option>
                        ${g.channels.cache.filter(c => c.type === 0).map(c =>
        `<option value="${c.id}" ${s.welcome?.channel === c.id ? 'selected' : ''}># ${c.name}</option>`
    ).join('')}
                    </select>
                </div>
                <div>
                    <label>🔔 تفعيل النظام:</label>
                    <div style="margin-top:10px">
                        <input type="checkbox" name="enabled" ${s.welcome?.enabled ? 'checked' : ''} style="width: 25px; height: 25px; cursor:pointer;">
                    </div>
                </div>
            </div>

            <label>💬 النص المكتوب (على الصورة):</label>
            <input type="text" id="text-input" name="customText" value="${s.welcome?.customText || 'Welcome'}" oninput="updatePreview()" placeholder="مثال: Welcome {user}">
            <small style="color: #aaa;">* استخدم {user} ليظهر اسم العضو تلقائياً.</small>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                <div>
                    <label>📏 حجم الخط:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button type="button" onclick="changeSize(-4)" class="btn-save" style="padding: 10px 20px; width: auto;">-</button>
                        <input type="number" id="font-size" name="fontSize" value="${s.welcome?.fontSize || 40}" readonly style="text-align: center; font-size: 20px;">
                        <button type="button" onclick="changeSize(4)" class="btn-save" style="padding: 10px 20px; width: auto;">+</button>
                    </div>
                </div>
        // ابحث عن الحقول في صفحة الـ welcome واستبدلها بهذا الجزء:
<div>
    <label>🎯 موقع النص (أفقي - عمودي):</label>
    <div style="display: flex; gap: 10px;">
        <!-- تأكد أن الـ name هو textX و textY -->
        <input type="number" id="posX" name="textX" value="${s.welcome?.textX || 250}" oninput="updatePreview()" placeholder="X">
        <input type="number" id="posY" name="textY" value="${s.welcome?.textY || 150}" oninput="updatePreview()" placeholder="Y">
    </div>
</div>

            </div>

            <label style="margin-top: 20px;">🖼️ تحميل صورة الترحيب:</label>
            <input type="file" name="welcomeImage" onchange="previewImage(this)" style="background: rgba(88, 101, 242, 0.1); border: 1px dashed var(--p);">
            
            <button type="submit" class="btn-save" style="margin-top: 30px; font-size: 18px;">💾 حفظ الإعدادات والبدء</button>
        </div>
    </form>

    <script>
        function updatePreview() {
            const text = document.getElementById('text-input').value;
            const x = document.getElementById('posX').value;
            const y = document.getElementById('posY').value;
            const size = document.getElementById('font-size').value;
            
            const preview = document.getElementById('welcome-text-preview');
            preview.innerText = text;
            preview.style.left = x + 'px'; // استخدمنا left للسهولة في المعاينة
            preview.style.top = y + 'px';
            preview.style.fontSize = size + 'px';
        }

        function changeSize(amt) {
            const input = document.getElementById('font-size');
            let newSize = parseInt(input.value) + amt;
            if(newSize < 10) newSize = 10;
            input.value = newSize;
            updatePreview();
        }

        function previewImage(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('welcome-img').src = e.target.result;
                }
                reader.readAsDataURL(input.files[0]);
            }
        }
    </script>
    `;

    res.send(ui(g, 'welcome', content));
});

app.get('/manage/:guildId/autoreply', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await GuildConfig.findOne({ guildId: g.id }) || { autoReply: [] };

    let rows = '';
    for (let i = 0; i < 15; i++) {
        const data = s.autoReply && s.autoReply[i] ? s.autoReply[i] : { trigger: '', reply: '' };
        rows += `
        <div class="card" style="margin-bottom:10px;">
            <h4>الرد #${i + 1}</h4>
            <input type="text" name="trigger" value="${data.trigger || ''}" placeholder="الكلمة (Trigger)">
            <textarea name="reply" placeholder="رد البوت (Reply)">${data.reply || ''}</textarea>
        </div>`;
    }

    const content = `
    <form method="POST" action="/save/${g.id}/autoreply">
        <h3>💬 إعدادات الرد الآلي</h3>
        ${rows}
        <button class="btn-save">💾 حفظ الردود</button>
    </form>`;

    res.send(ui(g, 'autoreply', content));
});

app.post('/save/:guildId/welcome', checkAuth, upload.single('welcomeImage'), async (req, res) => {
    try {
        const { guildId } = req.params;
        const b = req.body;

        // تجهيز البيانات مع تحويلها لأرقام (Number) لضمان عمل الـ Canvas
        let updateData = {
            'welcome.enabled': b.enabled === 'on',
            'welcome.channel': b.channel,
            'welcome.customText': b.customText || 'Welcome {user}',
            'welcome.textX': Number(b.textX) || 250, // تحويل لـ Number
            'welcome.textY': Number(b.textY) || 150, // تحويل لـ Number
            'welcome.fontSize': Number(b.fontSize) || 40, // تحويل لـ Number
            'welcome.message': b.message || ''
        };

        // تحديث مسار الصورة إذا تم رفع ملف جديد
        if (req.file) {
            updateData['welcome.imagePath'] = req.file.path;
        }

        // الحفظ في قاعدة البيانات
        await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: updateData },
            { upsert: true, new: true }
        );

        console.log(`✅ Welcome settings updated for ${guildId}: X=${b.textX}, Y=${b.textY}`);

        res.redirect(`/manage/${guildId}/welcome`);

    } catch (err) {
        console.error("❌ Welcome Save Error:", err);
        res.status(500).send("خطأ في حفظ إعدادات الترحيب");
    }
});



app.post('/save/:guildId/autoreply', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        let { trigger, reply } = req.body;

        // تحويل البيانات لمصفوفة لضمان عمل الـ Loop حتى لو كان هناك رد واحد فقط
        if (!Array.isArray(trigger)) trigger = trigger ? [trigger] : [];
        if (!Array.isArray(reply)) reply = reply ? [reply] : [];

        let finalData = [];

        // دمج البيانات وحفظ فقط الحقول التي تحتوي على كلمة ورد معاً
        for (let i = 0; i < trigger.length; i++) {
            const t = trigger[i]?.trim();
            const r = reply[i]?.trim();

            if (t && r) {
                finalData.push({
                    trigger: t,
                    reply: r
                });
            }
        }

        // تحديث قاعدة البيانات وحذف الردود القديمة واستبدالها بالجديدة
        await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: { autoReply: finalData } },
            { upsert: true }
        );

        res.redirect(`/manage/${guildId}/autoreply`);
    } catch (err) {
        console.error("Error saving autoreply:", err);
        res.status(500).send("خطأ داخلي في حفظ البيانات");
    }
});


app.get('/manage/:guildId/giveaway', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);

    let content = `
    <form method="POST" action="/save/${g.id}/giveaway">
        <div class="card">
            <input name="prize" placeholder="الجائزة" required>
            <textarea name="description" placeholder="الوصف"></textarea>
            <input name="duration" placeholder="1d أو 1h" required>
            <input type="number" name="winners" value="1">

            <select name="channel">
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
        `<option value="${c.id}">${c.name}</option>`
    )}
            </select>
        </div>

        <button class="btn-save">تشغيل</button>
    </form>
    `;

    res.send(ui(g, 'giveaway', content));
});

app.get('/manage/:guildId/tickets', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    let s = await TicketConfig.findOne({ guildId: g.id }) || { buttons: [], menuOptions: [] };

    let topImg = s.topImagePath ? `/uploads/${path.basename(s.topImagePath)}` : 'https://via.placeholder.com';
    let bottomImg = s.bottomImagePath ? `/uploads/${path.basename(s.bottomImagePath)}` : 'https://via.placeholder.com';

    let content = `
    <form action="/save/${g.id}/tickets" method="POST" enctype="multipart/form-data">
        <div class="card">
            <h3 style="text-align:center; color:var(--p)">🎫 إعداد نظام التذاكر المتطور</h3>
            
            <div style="display: flex; gap: 30px; justify-content: center; margin-bottom: 25px;">
                <div style="text-align: center;">
                    <label>الصورة العلوية:</label><br>
                    <img src="${topImg}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 15px; border: 2px solid var(--p);">
                    <label class="custom-file-label" style="background: var(--p); padding: 5px; border-radius: 5px; cursor: pointer; display: block; margin-top: 5px; font-size:12px;">
                        🔄 تغيير <input type="file" name="topImage" onchange="this.form.submit()" style="display: none;">
                    </label>
                </div>
                <div style="text-align: center;">
                    <label>الصورة السفلية:</label><br>
                    <img src="${bottomImg}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 15px; border: 2px solid var(--p);">
                    <label class="custom-file-label" style="background: var(--p); padding: 5px; border-radius: 5px; cursor: pointer; display: block; margin-top: 5px; font-size:12px;">
                        🔄 تغيير <input type="file" name="bottomImage" onchange="this.form.submit()" style="display: none;">
                    </label>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <label>عنوان التكت:</label>
                    <input type="text" name="title" value="${s.title || ''}" placeholder="مثلاً: ZONE SUPPORT">
                </div>
                <div>
                    <label>رتبة الإدارة (التي ستظهر لها التذكرة):</label>
                    <select name="adminRole">
                        <option value="">-- اختر الرتبة --</option>
                        ${g.roles.cache.map(r => `<option value="${r.id}" ${s.adminRole == r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <label>وصف التكت:</label>
            <textarea name="description" rows="2">${s.description || ''}</textarea>

            <hr style="opacity:0.1; margin:20px 0;">

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <!-- قسم الأزرار -->
                <div>
                    <h4 style="color:var(--accent)">🔘 الأزرار (أقصى حد 4)</h4>
                    ${[0, 1, 2, 3].map(i => `
                        <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05)">
                            <input name="btn_label_${i}" placeholder="اسم الزر ${i + 1}" value="${s.buttons?.[i]?.label || ''}" style="margin:2px 0; font-size:13px;">
                            <input name="btn_emoji_${i}" placeholder="ID الإيموجي" value="${s.buttons?.[i]?.emoji || ''}" style="margin:2px 0; font-size:13px;">
                        </div>
                    `).join('')}
                </div>

                <!-- قسم المنيو -->
                <div>
                    <h4 style="color:var(--s)">🔽 خيارات المنيو (أقصى حد 4)</h4>
                    ${[0, 1, 2, 3].map(i => `
                        <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05)">
                            <input name="menu_label_${i}" placeholder="خيار المنيو ${i + 1}" value="${s.menuOptions?.[i]?.label || ''}" style="margin:2px 0; font-size:13px;">
                            <input name="menu_emoji_${i}" placeholder="ID الإيموجي" value="${s.menuOptions?.[i]?.emoji || ''}" style="margin:2px 0; font-size:13px;">
                        </div>
                    `).join('')}
                </div>
            </div>

            <hr style="opacity:0.1; margin:20px 0;">

            <label>📍 قناة إرسال التكت:</label>
            <select name="targetChannel" style="border: 1px solid var(--p);">
                <option value="">-- حفظ الإعدادات فقط --</option>
                ${g.channels.cache.filter(c => c.type === 0).map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('')}
            </select>

            <button type="submit" class="btn-save" style="margin-top:20px; letter-spacing:1px;">💾 حفظ وإرسال التكت نيون</button>
        </div>
    </form>`;

    res.send(ui(g, 'tickets', content));
});


app.get('/manage/:guildId/mod', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    // جلب الإعدادات أو وضع قيم افتراضية
    let s = await ModConfig.findOne({ guildId: g.id }) || { jail: { commandName: 'سجن', unjailCommand: 'فك' } };

    let content = `
    <form method="POST" action="/save/${g.id}/mod">
        <div class="card">
            <h3 style="color:var(--s)">🛡️ إعدادات أوامر الإشراف</h3>
            <p style="color:#aaa; font-size:13px;">هنا يمكنك تخصيص اختصارات أوامر السجن والفك وتحديد الصلاحيات.</p>

            <!-- خانة أمر السجن -->
            <label>💬 اسم أمر السجن (الاختصار):</label>
            <input type="text" name="commandName" value="${s.jail?.commandName || 'سجن'}" required>
            <small style="color:#777; display:block; margin-bottom:15px;">* اكتب الاسم بدون بريفكس (مثلاً: سجن)</small>

            <!-- خانة أمر فك السجن (تم نقلها هنا داخل الكارد) -->
            <label>🔓 اسم أمر فك السجن (الاختصار):</label>
            <input type="text" name="unjailCommand" value="${s.jail?.unjailCommand || 'فك'}" required>
            <small style="color:#777; display:block; margin-bottom:15px;">* اكتب الاسم بدون بريفكس (مثلاً: فك)</small>
<div style="margin-top:20px;">
    <label>📜 روم لوق السجن:</label>
    <select name="logChannelId" required>
        <option value="">-- اختر الروم --</option>
        ${g.channels.cache.filter(c => c.type === 0).map(c =>
            `<option value="${c.id}" ${s.jail?.logChannelId === c.id ? 'selected' : ''}># ${c.name}</option>`
        ).join('')}
    </select>
</div>
            <div style="margin-top:20px;">
                <label>⛓️ رتبة السجن (التي ستعطى للمخالف):</label>
                <select name="roleId" required>
                    <option value="">-- اختر الرتبة --</option>
                    ${g.roles.cache.filter(r => r.name !== "@everyone").map(r =>
        `<option value="${r.id}" ${s.jail?.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('')}
                </select>
            </div>

            <div style="margin-top:20px;">
                <label>📍 روم السجن (المخصص للمسجونين):</label>
                <select name="channelId" required>
                    <option value="">-- اختر الروم --</option>
                    ${g.channels.cache.filter(c => c.type === 0).map(c =>
        `<option value="${c.id}" ${s.jail?.channelId === c.id ? 'selected' : ''}># ${c.name}</option>`
    ).join('')}
                </select>
            </div>
            
            <!-- زر الحفظ في مكانه الصحيح بالأسفل -->
            <button type="submit" class="btn-save" style="margin-top:30px;">💾 حفظ إعدادات الإشراف</button>
        </div>
    </form>
    `;

    res.send(ui(g, 'mod', content));
});


app.post('/save/:guildId/mod', checkAuth, async (req, res) => {
    try {
        // تأمين المدخلات: نستخدم قيمة افتراضية إذا كانت الخانة فارغة لمنع خطأ toLowerCase
        const cmdName = (req.body.commandName || 'jail').toLowerCase().trim();
        const unjailCmd = (req.body.unjailCommand || 'unjail').toLowerCase().trim();

        await ModConfig.findOneAndUpdate(
            { guildId: req.params.guildId },
            {
              $set: {
    "jail.commandName": cmdName,
    "jail.unjailCommand": unjailCmd,
    "jail.roleId": req.body.roleId,
    "jail.channelId": req.body.channelId,
    "jail.logChannelId": req.body.logChannelId
}
            },
            { upsert: true, new: true }
        );
        res.redirect(`/manage/${req.params.guildId}/mod`);
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).send("حدث خطأ أثناء الحفظ، تأكد من ملء جميع الخانات.");
    }
});





app.post('/save/:guildId/tickets', checkAuth, upload.fields([{ name: 'topImage' }, { name: 'bottomImage' }]), async (req, res) => {
    try {
        const b = req.body;
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.status(404).send("Guild not found");

        let buttons = [];
        let menuOptions = [];

        // 1. تجميع الأزرار والمنيو من الفورم (نسخة مصححة)
        for (let i = 0; i < 4; i++) {

            const btnLabel = b[`btn_label_${i}`]?.trim();
            const btnEmoji = b[`btn_emoji_${i}`]?.trim();

            const menuLabel = b[`menu_label_${i}`]?.trim();
            const menuEmoji = b[`menu_emoji_${i}`]?.trim();

            if (btnLabel) {
                buttons.push({
                    label: btnLabel,
                    emoji: btnEmoji || ""
                });
            }

            if (menuLabel) {
                menuOptions.push({
                    label: menuLabel,
                    emoji: menuEmoji || ""
                });
            }
        }

        // 2. تحضير البيانات للتحديث
        let updateData = {
            title: b.title,
            description: b.description,
            color: b.color || "#5865F2",
            adminRole: b.adminRole,
            buttons: buttons,
            menuOptions: menuOptions
        };

        // تصحيح مسارات الصور المرفوعة
        if (req.files?.topImage?.[0]) updateData.topImagePath = req.files.topImage[0].path;
        if (req.files?.bottomImage?.[0]) updateData.bottomImagePath = req.files.bottomImage[0].path;

        const config = await TicketConfig.findOneAndUpdate(
            { guildId: req.params.guildId }, { $set: updateData }, { upsert: true, new: true }
        );

        // 3. الإرسال للقناة المحددة
        if (b.targetChannel) {
            const channel = g.channels.cache.get(b.targetChannel);
            if (channel) {
                const files = [];
                const embed = new EmbedBuilder()
                    .setTitle(config.title || "TICKETS")
                    .setDescription(config.description || "اضغط للفتح")
                    .setColor(config.color || "#5865F2");

                // إرفاق الصور
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

                // بناء صف الأزرار مع حماية ضد أخطاء الإيموجي
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
                                button.setEmoji(/^\d+$/.test(em) ? { id: em } : em);
                            } catch (e) { console.log("Emoji Error on Button", i); }
                        }
                        btnRow.addComponents(button);
                    });
                    if (btnRow.components.length > 0) components.push(btnRow);
                }

                // بناء المنيو
                if (config.menuOptions?.length > 0) {
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('ticket_menu')
                        .setPlaceholder('🔽 اختر من القائمة...');

                    config.menuOptions.forEach((opt, i) => {
                        const option = { label: opt.label, value: `ticket_opt_${i}` };
                        if (opt.emoji && opt.emoji.trim() !== "") {
                            const em = opt.emoji.trim();
                            try {
                                option.emoji = /^\d+$/.test(em) ? { id: em } : em;
                            } catch (e) { console.log("Emoji Error on Menu", i); }
                        }
                        select.addOptions(option);
                    });
                    components.push(new ActionRowBuilder().addComponents(select));
                }

                await channel.send({
                    embeds: [embed],
                    components: components,
                    files: files
                }).catch(e => console.error("Discord Send Error:", e));
            }
        }
        res.redirect(`/manage/${req.params.guildId}/tickets`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Error");
    }
});

client.on('messageCreate', async (msg) => {
    // 1. التحقق الأساسي (تجاهل البوتات والرسائل الخاصة)
    if (!msg.guild || msg.author.bot) return;

    // --- [ تسجيل إحصائيات الرسائل والقنوات ] ---
    await Stats.findOneAndUpdate(
        { guildId: msg.guild.id },
        {
            $inc: {
                "messages.total": 1,
                "messages.daily": 1,
                "messages.weekly": 1,
                "messages.monthly": 1,
                [`activeChannels.${msg.channel.id}`]: 1
            }
        },
        { upsert: true }
    ).catch(e => console.log("Stats Save Error:", e));


    // 2. جلب إعدادات السيرفر من الداتابيز
    const s = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (!s) return;

    // 3. 🛡️ فحص الرتب المستثناة (Bypass Roles)
    const hasBypass = msg.member.roles.cache.some(role => s.security?.bypassRoles?.includes(role.id));

    if (!hasBypass) {
        // --- [ نظام الكلمات الممنوعة ] ---
        if (s.security?.badWords && s.security.badWords.trim().length > 0) {
            const forbidden = s.security.badWords.split(',').map(w => w.trim().toLowerCase());
            const hasBadWord = forbidden.some(word => word !== "" && msg.content.toLowerCase().includes(word));

            if (hasBadWord) {
                await msg.delete().catch(() => { });
                try {
                    await msg.member.timeout(5 * 60 * 1000, 'استخدام كلمات ممنوعة');
                    return msg.channel.send(`⚠️ ${msg.author}، ممنوع استخدام الكلمات الممنوعة!`);
                } catch (e) { console.log("خطأ في صلاحيات التايم آوت"); }
                return;
            }
        }

        // --- [ نظام الإيموجي الممنوع ] ---
        if (s.security?.badEmojis && s.security.badEmojis.trim().length > 0) {
            const forbiddenEmojis = s.security.badEmojis.split(',').map(e => e.trim());
            const hasBadEmoji = forbiddenEmojis.some(emoji => emoji !== "" && msg.content.includes(emoji));

            if (hasBadEmoji) {
                await msg.delete().catch(() => { });
                try {
                    await msg.member.timeout(5 * 60 * 1000, 'استخدام إيموجي ممنوع');
                    return msg.channel.send(`⚠️ ${msg.author}، هذا الإيموجي غير مسموح به هنا!`);
                } catch (e) { console.log("خطأ في صلاحيات التايم آوت"); }
                return;
            }
        }

        // --- [ نظام منع الروابط ] ---
        if (s.security?.antiLinks && /(https?:\/\/)/.test(msg.content)) {
            await msg.delete().catch(() => { });
            return msg.channel.send(`⚠️ ${msg.author}، الروابط ممنوعة هنا!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // 4. 🤖 الرد الآلي (Auto Reply)
    const r = s.autoReply?.find(x => x.trigger && msg.content.toLowerCase() === x.trigger.toLowerCase());
    if (r) return msg.reply(r.reply).catch(() => { });

    // 5. 🏆 نظام المستويات (Levels)
    if (s.levels?.enabled) {
        let u = await UserLevel.findOne({ guildId: msg.guild.id, userId: msg.author.id });
        if (!u) {
            u = new UserLevel({ guildId: msg.guild.id, userId: msg.author.id, xp: 0, level: 1, msgCount: 0 });
        }
        u.xp += s.levels.xpPerMessage || 10;
        u.msgCount++;
        if (u.xp >= u.level * u.level * 100) {
            u.level++;
            const lvChannel = msg.guild.channels.cache.get(s.levels.levelUpChannel) || msg.channel;
            lvChannel.send(`🎉 مبروك ${msg.author}! صرت لفل **${u.level}**`).catch(() => { });
        }
        await u.save();
    }

    // 6. 🎫 أمر إرسال بانل التذاكر (!setup)
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
        // بناء الأزرار
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

        // بناء المنيو
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

        // زر افتراضي
        if (components.length === 0) {
            components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Primary)));
        }

        return msg.channel.send({ embeds: [embed], components: components, files: files });
    }
    // ==========================================
    // 🛡️ نظام السجن المطور (للأدمن فقط)
    // ==========================================
    const modConfig = await ModConfig.findOne({ guildId: msg.guild.id });

    if (modConfig && modConfig.jail) {
        const prefix = "!";
        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 🛑 [1] أمر السجن (للأدمن فقط)
        if (command === modConfig.jail.commandName.toLowerCase()) {
            // فحص صارم: فقط من لديه صلاحية Administrator يمكنه السجن
            if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return msg.reply("❌ عذراً، هذا الأمر مخصص للإدارة العليا فقط!");
            }

            const target = msg.mentions.members.first();
            const timeInput = args.find(arg => /[smhdw]/.test(arg));

            if (!target || !timeInput) return msg.reply(`⚠️ الاستخدام: \`${prefix}${command} @user 1h\``);
            if (target.id === msg.author.id) return msg.reply("❌ لا يمكنك سجن نفسك!");

            const durationMs = ms(timeInput);
            if (!durationMs) return msg.reply("❌ صيغة الوقت غير صحيحة (مثال: 1h, 30m).");

            const jailRole = msg.guild.roles.cache.get(modConfig.jail.roleId);
            const jailChannel = msg.guild.channels.cache.get(modConfig.jail.channelId);

            if (!jailRole) return msg.reply("❌ رتبة السجن غير مضبوطة في الداشبورد!");

            try {
                // حفظ الرتب القديمة قبل سحبها
               const currentRoles = target.roles.cache
    .filter(r => r.id !== msg.guild.id && r.id !== modConfig.jail.roleId)
    .map(r => r.id);


                // 📩 إرسال رسالة خاصة (DM) للعضو المسجون
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚖️ لقد تم سجنك!')
                    .setThumbnail(msg.guild.iconURL())
                    .setDescription(`مرحباً ${target.user.username}، تم سجنك في سيرفر **${msg.guild.name}**.`)
                    .addFields(
                        { name: '⏳ المدة:', value: timeInput, inline: true },
                        { name: '📍 الروم المخصص:', value: `<#${modConfig.jail.channelId}>`, inline: true },
                        { name: '🛡️ المسؤول:', value: `${msg.author.tag}`, inline: true }
                    )
                    .setColor('Red').setTimestamp();

                await target.send({ embeds: [dmEmbed] }).catch(() => console.log("خاص العضو مغلق"));

                // سحب الرتب وإعطاء رتبة السجن
               await target.roles.add(jailRole);
                msg.channel.send(`🔒 تم سجن ${target} بنجاح وإرسال التفاصيل له بالخاص.`);
const logChannel = msg.guild.channels.cache.get(modConfig.jail.logChannelId);

if (logChannel) {
    const logEmbed = new EmbedBuilder()
        .setTitle('🔒 سجن عضو')
        .setColor('Red')
        .addFields(
            { name: '👤 العضو:', value: `${target.user.tag} (${target.id})`, inline: true },
            { name: '🛡️ بواسطة:', value: `${msg.author.tag}`, inline: true },
            { name: '⏳ المدة:', value: timeInput, inline: true }
        )
        .setTimestamp();

    logChannel.send({ embeds: [logEmbed] }).catch(() => {});
}

                // فك السجن تلقائياً بعد انتهاء الوقت
                setTimeout(async () => { await handleUnjail(target, msg.guild.id, jailChannel); }, durationMs);
            } catch (e) { console.error(e); }
        }

        // 🔓 [2] أمر فك السجن (تحته مباشرة - للأدمن فقط)
        if (command === (modConfig.jail.unjailCommand || 'unjail').toLowerCase()) {
            if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return msg.reply("❌ عذراً، لا تملك صلاحيات الأدمن لفك السجن!");
            }

            const target = msg.mentions.members.first();
            if (!target) return msg.reply("⚠️ يرجى منشن العضو لفك سجنه!");

            if (!jailChannel) return msg.reply("❌ روم السجن غير موجود");
            await handleUnjail(target, msg.guild.id, jailChannel);
            msg.channel.send(`✅ تم فك سجن ${target} واسترجاع رتبه كاملة.`);
        }
    }


}); // إغلاق حدث messageCreate بشكل صحيح



app.post('/save/:guildId/security', checkAuth, async (req, res) => {
    const b = req.body;

    await GuildConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        {
            $set: {
                "security.antiLinks": b.antiLinks === 'on',
                "security.badWords": b.badWords,
                "security.badEmojis": b.badEmojis,
                "security.bypassRoles": Array.isArray(b.bypassRoles)
                    ? b.bypassRoles
                    : (b.bypassRoles ? [b.bypassRoles] : [])
            }
        },
        { upsert: true }
    );

    res.redirect(`/manage/${req.params.guildId}/security`);
});

// حفظ إعدادات اللوق
app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
    const b = req.body;
    const types = ['messages', 'moderation', 'members', 'channels', 'roles', 'voice'];
    let updateData = {};
    types.forEach(t => {
        updateData[`logs.${t}`] = { enabled: b[`${t}_st`] === 'on', channel: b[`${t}_ch`] };
    });
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $set: updateData }, { upsert: true });
    res.redirect(`/manage/${req.params.guildId}/logs`);
});

// تشغيل القيف اواي
app.post('/save/:guildId/giveaway', checkAuth, async (req, res) => {
    const { prize, duration, winners, channel, description } = req.body;
    const g = client.guilds.cache.get(req.params.guildId);
    const timeMs = ms(duration);
    if (!timeMs) return res.send("خطأ في صيغة الوقت! استخدم 1h أو 1d");

    const endAt = new Date(Date.now() + timeMs);
    const targetCh = g.channels.cache.get(channel);

    const embed = new EmbedBuilder()
        .setTitle(`🎉 قيف اواي: ${prize}`)
        .setDescription(`${description}\n\n**ينتهي:** <t:${Math.floor(endAt / 1000)}:R>\n**الفائزين:** ${winners}`)
        .setColor('Blue');

    const giveawayMsg = await targetCh.send({ embeds: [embed] });
    await giveawayMsg.react('🎉');

    await Giveaway.create({
        guildId: g.id, messageId: giveawayMsg.id, channelId: channel,
        endAt, winnersCount: parseInt(winners), prize
    });
    res.redirect(`/manage/${g.id}/giveaway`);
});

// 🕒 نظام إنهاء القيف اواي التلقائي
setInterval(async () => {
    const now = new Date();
    // البحث عن القيف اوايات اللي خلص وقتها وما انتهت لسه
    const activeGiveaways = await Giveaway.find({ endAt: { $lte: now }, ended: false });

    for (const giveaway of activeGiveaways) {
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) continue;

        try {
            const msg = await channel.messages.fetch(giveaway.messageId);
            const reaction = msg.reactions.cache.get('🎉');
            if (!reaction) continue;

            const users = await reaction.users.fetch();
            const entries = users.filter(u => !u.bot).map(u => u.id);

            let winners = [];
            if (entries.length > 0) {
                // اختيار فائزين عشوائيين حسب العدد المطلوب
                for (let i = 0; i < giveaway.winnersCount && entries.length > 0; i++) {
                    const rIndex = Math.floor(Math.random() * entries.length);
                    winners.push(`<@${entries.splice(rIndex, 1)}>`);
                }
            }

            const winEmbed = new EmbedBuilder()
                .setTitle(`🎊 انتهى القيف اواي!`)
                .setDescription(`**الجائزة:** ${giveaway.prize}\n**الفائزين:** ${winners.length > 0 ? winners.join(', ') : 'لا يوجد مشاركين'}`)
                .setColor('Gold')
                .setTimestamp();

            await msg.edit({ embeds: [winEmbed] });
            if (winners.length > 0) {
                channel.send(`🎉 مبروك ${winners.join(', ')}! لقد فزتم بـ **${giveaway.prize}**`);
            } else {
                channel.send(`⚠️ انتهى القيف اواي على **${giveaway.prize}** لكن لا يوجد مشاركين.`);
            }

        } catch (err) {
            console.error("خطأ في إنهاء القيف اواي:", err);
        }

        // تحديث الحالة في الداتابيز عشان ما يختار فائز مرتين
        giveaway.ended = true;
        await giveaway.save();
    }
}, 60000); // يتأكد كل 60 ثانية (دقيقة)

// 1. الرابط الذي يوجه المستخدم لصفحة تسجيل دخول ديسكورد
app.get('/auth/discord', passport.authenticate('discord'));

// 2. الرابط الذي يستقبل المستخدم بعد موافقته في ديسكورد
app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/login' // إذا فشل يرجعه لصفحة اللوجن
}), (req, res) => {
    res.redirect('/dashboard'); // إذا نجح يوديه للداشبورد
});

// 3. رابط تسجيل الخروج
app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/login');
    });
});

// --- [ 2. لوق تعديل الرسائل ] ---
client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
    const s = await GuildConfig.findOne({ guildId: oldMsg.guild.id });
    if (!s?.logs?.messages?.enabled || !s.logs.messages.channel) return;

    const logCh = oldMsg.guild.channels.cache.get(s.logs.messages.channel);
    const embed = new EmbedBuilder()
        .setAuthor({ name: '📝 تعديل رسالة' })
        .setColor('#ffa502')
        .addFields(
            { name: '👤 الكاتب:', value: `<@${oldMsg.author.id}>`, inline: true },
            { name: '📍 القناة:', value: `<#${oldMsg.channel.id}>`, inline: true },
            { name: '⬅️ قبل:', value: oldMsg.content || 'فارغ' },
            { name: '➡️ بعد:', value: newMsg.content || 'فارغ' }
        ).setTimestamp();
    if (logCh) logCh.send({ embeds: [embed] }).catch(() => { });
});


// --- [ 4. لوق دخول الأعضاء ] ---
client.on('guildMemberAdd', async (member) => {
    const s = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!s?.logs?.members?.enabled || !s.logs.members.channel) return;
    const logCh = member.guild.channels.cache.get(s.logs.members.channel);
    const embed = new EmbedBuilder()
        .setAuthor({ name: '📥 دخول عضو' })
        .setColor('#2ed573')
        .setDescription(`**العضو:** <@${member.id}>\n**الأيدي:** ${member.id}`)
        .setTimestamp();
    if (logCh) logCh.send({ embeds: [embed] });
});


client.on('guildMemberAdd', async (member) => {
    try {
        // 1. جلب إعدادات السيرفر من الداتابيز
        const s = await GuildConfig.findOne({ guildId: member.guild.id });
        if (!s) return;

        // --- [ أولاً: نظام اللوق (Logs) ] ---
        if (s.logs?.members?.enabled && s.logs.members.channel) {
            const logCh = member.guild.channels.cache.get(s.logs.members.channel);
            if (logCh) {
                const logEmbed = new EmbedBuilder()
                    .setAuthor({ name: '📥 عضو دخل السيرفر' })
                    .setColor('#2ed573')
                    .setDescription(`**العضو:** ${member.user.tag}\n**الأيدي:** ${member.id}`)
                    .setTimestamp();


               

                // --- [ دالة كشف المسؤول عن الفعل ] ---
                async function getExecutor(guild, eventType) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 1500)); // انتظار بسيط لضمان تسجيل الحدث
                        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: eventType });
                        const entry = auditLogs.entries.first();
                        if (!entry) return "غير معروف (تلقائي)";
                        return `${entry.executor.tag}`;
                    } catch (e) { return "صلاحيات ناقصة"; }
                }
                // --- [ 1. لوق حذف الرسائل ] ---
                client.on('messageDelete', async (message) => {
                    if (!message.guild || message.author?.bot) return;
                    const s = await GuildConfig.findOne({ guildId: message.guild.id });
                    if (!s?.logs?.messages?.enabled || !s.logs.messages.channel) return;

                    const logCh = message.guild.channels.cache.get(s.logs.messages.channel);
                    const executor = await getExecutor(message.guild, AuditLogEvent.MessageDelete);

                    const embed = new EmbedBuilder()
                        .setAuthor({ name: '🗑️ حذف رسالة' })
                        .setColor('#ff4757')
                        .addFields(
                            { name: '👤 صاحب الرسالة:', value: `<@${message.author.id}>`, inline: true },
                            { name: '🛡️ الحاذف:', value: executor.includes('(') ? `<@${executor.split('(')[1].split(')')[0]}>` : executor, inline: true },
                            { name: '📍 القناة:', value: `<#${message.channel.id}>`, inline: false },
                            { name: '📄 المحتوى:', value: message.content || 'صورة/ملف' }
                        ).setTimestamp();
                    if (logCh) logCh.send({ embeds: [embed] }).catch(() => { });
                });
                logCh.send({ embeds: [logEmbed] }).catch(() => { });
            }
        }


        // --- ---
        // --- [ داخل نظام الترحيب بالصورة ] ---
        if (s.welcome?.enabled && s.welcome.channel) {
            const welcomeCh = member.guild.channels.cache.get(s.welcome.channel);
            if (welcomeCh) {
                // 1. إنشاء الكانفاس بنفس أبعاد المعاينة
                const canvas = createCanvas(800, 400);
                const ctx = canvas.getContext('2d');

                // 2. تحميل الصورة الخلفية
                if (s.welcome.imagePath && fs.existsSync(s.welcome.imagePath)) {
                    const background = await loadImage(s.welcome.imagePath);
                    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                } else {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                // 3. جلب الإعدادات "المحفوظة" من الداتابيز
                const fontSize = parseInt(s.welcome.fontSize) || 40;
                const posX = parseInt(s.welcome.textX) || 250; // القيمة المحفوظة لـ X
                const posY = parseInt(s.welcome.textY) || 150; // القيمة المحفوظة لـ Y

                // 4. إعدادات الخط
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = "black";

                // 5. معالجة النص
                let welcomeText = s.welcome.customText || 'Welcome {user}';
                welcomeText = welcomeText.replace('{user}', member.user.username);

                // 6. الرسم في المكان الدقيق
                // ملاحظة: تأكد أن posX و posY هما نفس القيم التي تظهر في المعاينة بالداشبورد
                ctx.fillText(welcomeText, posX, posY);

                const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome.png' });
                await welcomeCh.send({ content: `✨ حياك الله ${member} في سيرفرنا!`, files: [attachment] }).catch(() => { });
            }
        }


    } catch (error) {
        console.error("❌ خطأ في حدث دخول العضو:", error);
    }
});


// --- [ 4. لوق خروج الأعضاء ] ---
client.on('guildMemberRemove', async (member) => {
    const s = await GuildConfig.findOne({ guildId: member.guild.id });
    if (!s?.logs?.members?.enabled || !s.logs.members.channel) return;
    const logCh = member.guild.channels.cache.get(s.logs.members.channel);
    const embed = new EmbedBuilder().setAuthor({ name: '📤 عضو خرج/طُرد' }).setColor('#ff4757')
        .setDescription(`**العضو:** ${member.user.tag}`).setTimestamp();
    if (logCh) logCh.send({ embeds: [embed] });
});

// --- 📂 لوق حذف الرومات ---
client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const s = await GuildConfig.findOne({ guildId: channel.guild.id });
    if (!s?.logs?.channels?.enabled || !s.logs.channels.channel) return;

    const logCh = channel.guild.channels.cache.get(s.logs.channels.channel);
    const executor = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete);

    const embed = new EmbedBuilder()
        .setAuthor({ name: '🗑️ حذف قناة' })
        .setColor('#ff4757')
        .addFields(
            { name: '📍 اسم القناة:', value: channel.name, inline: true },
            { name: '🛡️ المسؤول عن الحذف:', value: executor, inline: true }
        ).setTimestamp();
    if (logCh) logCh.send({ embeds: [embed] }).catch(e => console.log("Error sending log:", e));
});

// --- 🛡️ لوق حذف وتعديل الرتب ---
client.on('roleDelete', async (role) => {
    const s = await GuildConfig.findOne({ guildId: role.guild.id });
    if (!s?.logs?.roles?.enabled || !s.logs.roles.channel) return;

    const logCh = role.guild.channels.cache.get(s.logs.roles.channel);
    const executor = await getExecutor(role.guild, AuditLogEvent.RoleDelete);

    const embed = new EmbedBuilder()
        .setAuthor({ name: '🗑️ حذف رتبة' })
        .setColor('#ff4757')
        .addFields(
            { name: '📛 اسم الرتبة:', value: role.name, inline: true },
            { name: '🛡️ المسؤول:', value: executor, inline: true }
        ).setTimestamp();
    if (logCh) logCh.send({ embeds: [embed] }).catch(e => console.log("Error sending log:", e));
});

// --- 🎭 لوق إعطاء/إزالة رتبة من عضو ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const s = await GuildConfig.findOne({ guildId: newMember.guild.id });
    if (!s?.logs?.roles?.enabled || !s.logs.roles.channel) return;
    const logCh = newMember.guild.channels.cache.get(s.logs.roles.channel);

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
        const executor = await getExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate);
        const embed = new EmbedBuilder().setAuthor({ name: '🎭 تحديث رتب العضو' }).setTimestamp();

        if (addedRoles.size > 0) {
            embed.setColor('#2ed573').addFields({ name: '➕ رتب أضيفت:', value: addedRoles.map(r => r.name).join(', ') });
        } else {
            embed.setColor('#ff4757').addFields({ name: '➖ رتب أزيلت:', value: removedRoles.map(r => r.name).join(', ') });
        }
        embed.addFields({ name: '👤 المستلم:', value: `${newMember.user.tag}` }, { name: '🛡️ المسؤول:', value: executor });
        if (logCh) logCh.send({ embeds: [embed] }).catch(e => console.log("Error sending log:", e));
    }
});



// --- 📂 لوق تعديل الرومات (اسم، وصف، نوع) ---
client.on('channelUpdate', async (oldChannel, newChannel) => {
    // 1. التحقق من السيرفر والإعدادات
    if (!newChannel.guild) return;
    const s = await GuildConfig.findOne({ guildId: newChannel.guild.id });
    if (!s?.logs?.channels?.enabled || !s.logs.channels.channel) return;

    const logCh = newChannel.guild.channels.cache.get(s.logs.channels.channel);
    if (!logCh) return;

    // 2. تحديد نوع التغيير (الاسم أو الوصف أو النوع)
    let changeType = "";
    let before = "";
    let after = "";

    if (oldChannel.name !== newChannel.name) {
        changeType = "📝 تعديل اسم القناة";
        before = oldChannel.name;
        after = newChannel.name;
    } else if (oldChannel.topic !== newChannel.topic) {
        changeType = "📝 تعديل وصف القناة (Topic)";
        before = oldChannel.topic || "لا يوجد وصف";
        after = newChannel.topic || "لا يوجد وصف";
    } else if (oldChannel.type !== newChannel.type) {
        changeType = "📝 تعديل نوع القناة";
        before = `Type: ${oldChannel.type}`;
        after = `Type: ${newChannel.type}`;
    }

    // إذا لم يكن التغيير من الأشياء التي نراقبها، نتوقف هنا
    if (!changeType) return;

    // 3. جلب المسؤول عن التعديل
    const executor = await getExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate);

    const embed = new EmbedBuilder()
        .setAuthor({ name: changeType })
        .setColor('#ffa502')
        .addFields(
            { name: '📍 القناة:', value: `${newChannel} (${newChannel.id})`, inline: false },
            { name: '⬅️ قبل:', value: before, inline: true },
            { name: '➡️ بعد:', value: after, inline: true },
            { name: '🛡️ بواسطة:', value: executor, inline: false }
        )
        .setTimestamp();

    logCh.send({ embeds: [embed] }).catch(e => console.log("Log Error:", e));
});

 client.on('interactionCreate', async (interaction) => {
                    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu()) return;

                    // جلب الإعدادات
                    const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
                    if (!config) return;

                    // --- 1. جزء إنشاء التذكرة (عند الضغط على البانل الرئيسي) ---
                    if (interaction.customId.startsWith('ticket_btn_') || interaction.customId === 'ticket_menu') {
                        let ticketType = "عامة";
                        if (interaction.isButton()) {
                            const btnIndex = interaction.customId.replace('ticket_btn_', '');
                            ticketType = config.buttons[btnIndex]?.label || "دعم";
                        } else {
                            const optIndex = interaction.values[0].replace('ticket_opt_', '');
                            ticketType = config.menuOptions[optIndex]?.label || "دعم";
                        }

                        try {
                            const channel = await interaction.guild.channels.create({
                                name: `ticket-${interaction.user.username}`,
                                type: ChannelType.GuildText,
                                permissionOverwrites: [
                                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                                    { id: config.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                                ],
                            });

                            const embed = new EmbedBuilder()
                                .setTitle(`🎫 إدارة التذكرة | ${ticketType}`)
                                .setDescription(`مرحباً ${interaction.user}\nنوع التذكرة: **${ticketType}**\n\n**أدوات الإدارة:** استخدم الأزرار والمنيو أدناه للتحكم.`)
                                .setColor(config.color || "#5865F2");

                            // الأزرار: استدعاء (لأدمن فقط)
                            const adminButtons = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('call_owner').setLabel('استدعاء أونر 👑').setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder().setCustomId('call_admin').setLabel('استدعاء أدمن 🛡️').setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder().setCustomId('call_user').setLabel('استدعاء العضو 👤').setStyle(ButtonStyle.Success),
                                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق 🔒').setStyle(ButtonStyle.Danger)
                            );

                            // منيو الإدارة: إضافة/إزالة أعضاء
                            const adminMenu = new ActionRowBuilder().addComponents(
                                new UserSelectMenuBuilder()
                                    .setCustomId('manage_members')
                                    .setPlaceholder('➕ إضافة أو إزالة عضو من التذكرة...')
                                    .setMinValues(1)
                                    .setMaxValues(1)
                            );

                            await channel.send({
                                content: `<@&${config.adminRole}> | ${interaction.user}`,
                                embeds: [embed],
                                components: [adminButtons, adminMenu]
                            });

                            return interaction.reply({ content: `✅ تم فتح تذكرتك: ${channel}`, ephemeral: true });
                        } catch (e) { console.error(e); }
                    }

                    // --- 2. جزء أدوات الإدارة (داخل التذكرة المفتوحة) ---
                    const isAdmin = interaction.member.roles.cache.has(config.adminRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                    // منع غير الإداريين من استخدام أدوات الإدارة
                    const adminToolsIds = ['call_owner', 'call_admin', 'call_user', 'manage_members'];
                    if (adminToolsIds.includes(interaction.customId) && !isAdmin) {
                        return interaction.reply({ content: "⚠️ هذه الأدوات مخصصة للإدارة فقط!", ephemeral: true });
                    }

                    // تنفيذ عمليات الأزرار
                    if (interaction.customId === 'call_owner') {
                        return interaction.reply({ content: `📢 تم إرسال نداء لـ **صاحب السيرفر** 👑` });
                    }

                    if (interaction.customId === 'call_admin') {
                        return interaction.reply({ content: `📢 نداء للإدارة: <@&${config.adminRole}> مطلوب حضوركم فوراً.` });
                    }

                    if (interaction.customId === 'call_user') {
                        // البحث عن صاحب التذكرة من اسم الروم (تقريبي) أو المنشن الأول
                        const ticketOwnerName = interaction.channel.name.split('-')[1];
                        return interaction.reply({ content: `📢 يا صاحب التذكرة، الإدارة بانتظارك! 👤` });
                    }

                    // تنفيذ عمليات المنيو (إضافة/إزالة عضو)
                    if (interaction.customId === 'manage_members') {
                        const targetUser = interaction.users.first();
                        const hasAccess = interaction.channel.permissionsFor(targetUser).has(PermissionFlagsBits.ViewChannel);

                        if (hasAccess) {
                            // إذا كان عنده صلاحية، نقوم بإزالتها
                            await interaction.channel.permissionOverwrites.delete(targetUser.id);
                            return interaction.reply({ content: `❌ تم إزالة ${targetUser} من التذكرة.`, ephemeral: true });
                        } else {
                            // إذا ما عنده، نقوم بإضافتها
                            await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                                ViewChannel: true,
                                SendMessages: true,
                                AttachFiles: true
                            });
                            return interaction.reply({ content: `✅ تم إضافة ${targetUser} للتذكرة.`, ephemeral: true });
                        }
                    }

                    // إغلاق التذكرة
                    if (interaction.customId === 'close_ticket') {
                        await interaction.reply("🔒 سيتم حذف التذكرة خلال 5 ثوانٍ...");
                        setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
                    }
                });


app.listen(3000, () => {
    console.log('🚀 Dashboard: http://localhost:3000');
});
client.login(process.env.TOKEN);
