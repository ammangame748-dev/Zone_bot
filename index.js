// 1. استدعاء المكتبات أولاً
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const mongoose = require('mongoose'); // استدعاء المونجوس
const { createCanvas, loadImage } = require('canvas');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ms = require('ms');
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, AuditLogEvent, 
    AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelType, PermissionFlagsBits,
    ModalBuilder, TextInputBuilder, TextInputStyle // ضيف هذول هون
} = require('discord.js');
const KickConfig = mongoose.model('KickConfig', new mongoose.Schema({
    guildId: String,
    streamers: [{
        kickUsername: String,      // اسم المستخدم في كيك
        channelId: String,       // روم التنبيه
        roleId: String,          // الرتبة اللي يجيها منشن
        customMessage: String,   // الرسالة المخصصة
        isLive: { type: Boolean, default: false } // لحماية البوت من تكرار التنبيه
    }]
}));


// 2. الآن تعرّف الـ Models (بعد ما صار المونجوس معروف للكود)
const TicketData = mongoose.model('TicketData', new mongoose.Schema({ticketCount: { type: Number, default: 0 },
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
 
const app = express();
const PORT = process.env.PORT || 3000;
app.set('view engine', 'ejs');
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
        adminRoles: [String]
    }
}));


const JailData = mongoose.model('JailData', new mongoose.Schema({
    guildId: String,
    userId: String,
    oldRoles: [String], // مصفوفة لتخزين رتب العضو قبل السجن
    endAt: Date
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
// 1️⃣ أضف هذا التعريف في بداية الملف مع باقي الـ Schemas
const JailedUser = mongoose.model('JailedUser', new mongoose.Schema({
    guildId: String,
    userId: String,
    oldRoles: [String]
}));

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
    // 1️⃣ أضف هذا التعريف في بداية الملف مع باقي الـ Schemas

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
// 🛑 ضيف هذا الكود هنا بالضبط
const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
};
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/dashboard');
});

app.get('/manage/:guildId/kick', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');

    // جلب البيانات من الداتابيز أو وضع مصفوفة فارغة
    let s = await KickConfig.findOne({ guildId: g.id }) || { streamers: [] };

    // محتوى الصفحة (Content)
    const content = `
    <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>🟢 نظام تنبيهات Kick المطور</h3>
            <button onclick="toggleKickForm()" class="btn-save" style="width:auto; padding:10px 20px; background: #00E701; color:black;">➕ إضافة ستريمر</button>
        </div>

        <!-- فوروم الإضافة (مخفي ويظهر عند الضغط على الزر) -->
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

        <!-- جدول عرض الستريمرز المضافين -->
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
                    <td>
                        <a href="/delete-kick/${g.id}/${i}" style="color:var(--s); text-decoration:none;">🗑️ حذف</a>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        function toggleKickForm() {
            const form = document.getElementById('add-kick-form');
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
        }
    </script>
    `;

    // إرسال البيانات لدالة ui لعرضها في السايدبار المعتاد
    res.send(ui(g, 'kick', content));
});


// --- [ صفحة عرض إعدادات الستريك ] ---
app.get('/manage/:guildId/streaks', checkAuth, async (req, res) => {
    try {
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.redirect('/dashboard'); 

        let s = await StreakConfig.findOne({ guildId: g.id }) || {};
        
        const roles = g.roles.cache.filter(r => r.name !== "@everyone");
        const channels = g.channels.cache.filter(c => c.type === 0);

        let content = `
        <div class="card">
            <h3>🔥 إعدادات نظام الستريك المطور</h3>
            <form method="POST" action="/save/${g.id}/streaks">
                <label>🎯 عدد الرسائل المطلوبة يومياً:</label>
                <input type="number" name="reqMsgs" value="${s.requiredMessages || 60}">

                <label>🎭 الرتبة المسموح لها بالستريك:</label>
                <select name="streakRole">
                    <option value="">-- اختر الرتبة --</option>
                    ${roles.map(r => `<option value="${r.id}" ${s.streakRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                </select>

                <label>📍 روم إشعارات الستريك:</label>
                <select name="streakChannel">
                    <option value="">-- اختر الروم --</option>
                    ${channels.map(c => `<option value="${c.id}" ${s.streakChannel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
                </select>

                <button class="btn-save">💾 حفظ الإعدادات</button>
            </form>
        </div>

        <!-- 🖼️ هاد هو مرسل الايمباد المخصص -->
        <div class="card" style="margin-top: 30px; border-top: 2px solid var(--accent);">
            <h3>🖼️ مرسل إيمباد (Embed Sender)</h3>
            <form method="POST" action="/send-custom-embed/${g.id}">
                <label>📍 اختر الروم:</label>
                <select name="targetChannel" required>
                    ${channels.map(c => `<option value="${c.id}"># ${c.name}</option>`).join('')}
                </select>

                <label>📝 عنوان الإيمباد (Title):</label>
                <input type="text" name="embedTitle" placeholder="اكتب العنوان هنا..." required>

                <label>📄 محتوى الإيمباد (Description):</label>
                <textarea name="embedDesc" rows="4" placeholder="اكتب الوصف هنا..." required></textarea>

                <label>🎨 لون الإيمباد:</label>
                <input type="color" name="embedColor" value="#5865f2">

                <button class="btn-save" style="background: var(--accent); margin-top: 15px;">🚀 إرسال الإيمباد الآن</button>
            </form>
        </div>

        <div class="card" style="border: 1px solid var(--s); margin-top: 20px;">
            <h3 style="color: var(--s);">⚠️ منطقة الخطر</h3>
            <form method="POST" action="/reset-streaks/${g.id}" onsubmit="return confirm('متأكد؟')">
                <button class="btn-save" style="background: var(--s);">🔥 تصفير ستريك الجميع</button>
            </form>
        </div>`;

        res.send(ui(g, 'streaks', content));
    } catch (err) {
        res.status(500).send("خطأ في تحميل صفحة الستريك");
    }
});

app.post('/send-custom-embed/:guildId', checkAuth, async (req, res) => {
    try {
        const { targetChannel, embedTitle, embedDesc, embedColor } = req.body;
        
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).send("❌ السيرفر غير موجود في ذاكرة البوت.");
        
        let channel = guild.channels.cache.get(targetChannel);
        if (!channel) channel = await guild.channels.fetch(targetChannel).catch(() => null);

        if (!channel) return res.send("⚠️ لم يتم العثور على القناة، تأكد من اختيار قناة نصية.");

        // بناء الإيمباد بالأساسيات فقط
        const customEmbed = new EmbedBuilder()
            .setTitle(embedTitle || "Zone System") 
            .setDescription(embedDesc || " ")
            .setColor(embedColor || '#5865f2')
            .setTimestamp();

        // إرسال الإيمباد
        await channel.send({ embeds: [customEmbed] });
        
        // إعادة التوجيه لصفحة الستريك بعد النجاح
        res.redirect(`/manage/${req.params.guildId}/streaks`);

    } catch (err) {
        console.error("❌ Embed Send Error:", err);
        res.status(500).send(`حدث خطأ أثناء الإرسال: ${err.message}`);
    }
});

app.post('/save/:guildId/kick', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { kickUser, channelId, roleId, msg } = req.body;

        // تنظيف اسم المستخدم (إزالة الرابط إذا وضعه المستخدم)
        const username = kickUser.replace('https://kick.com', '').replace('/', '').trim();

        await KickConfig.findOneAndUpdate(
            { guildId },
            { 
                $push: { 
                    streamers: { 
                        kickUsername: username, 
                        channelId, 
                        roleId, 
                        customMessage: msg,
                        isLive: false 
                    } 
                } 
            },
            { upsert: true }
        );

        res.redirect(`/manage/${guildId}/kick`);
    } catch (err) {
        res.status(500).send("خطأ في إضافة الستريمر");
    }
});

// مسار الحذف
app.get('/delete-kick/:guildId/:index', checkAuth, async (req, res) => {
    const { guildId, index } = req.params;
    const config = await KickConfig.findOne({ guildId });
    if (config) {
        config.streamers.splice(index, 1);
        await config.save();
    }
    res.redirect(`/manage/${guildId}/kick`);
});



// --- [ رابط حفظ الإعدادات ] ---
app.post('/save/:guildId/streaks', checkAuth, async (req, res) => {
    await StreakConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        {
            $set: {
                requiredMessages: Number(req.body.reqMsgs),
                streakRole: req.body.streakRole,
                streakChannel: req.body.streakChannel
            }
        },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/streaks`);
});

// --- [ رابط تصفير الستريك ] ---
app.post('/reset-streaks/:guildId', checkAuth, async (req, res) => {
    await UserLevel.updateMany({ guildId: req.params.guildId }, { $set: { streakCount: 0, dailyMsgs: 0 } });
    res.redirect(`/manage/${req.params.guildId}/streaks`);
});




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
            body { 
                margin: 0; font-family: 'Changa', sans-serif; background: var(--bg); 
                background-attachment: fixed; color: white; display: flex; min-height: 100vh; direction: rtl; 
            }

            /* --- [ القائمة الجانبية مع خاصية التمرير ] --- */
            .sidebar { 
                width: 280px; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); 
                position: fixed; right: 0; height: 100vh; padding: 30px 15px; 
                border-left: 1px solid rgba(255, 255, 255, 0.1); z-index: 1000; 
                display: flex; flex-direction: column;
                
                /* تفعيل التمرير */
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: var(--p) transparent;
            }

            /* تخصيص شكل السكرول بار للمتصفحات */
            .sidebar::-webkit-scrollbar { width: 6px; }
            .sidebar::-webkit-scrollbar-thumb { background: var(--p); border-radius: 10px; }
            .sidebar::-webkit-scrollbar-track { background: transparent; }

            .sidebar h2 { 
                background: linear-gradient(to left, var(--p), var(--s)); 
                -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
                text-align: center; font-size: 30px; margin-bottom: 40px; font-weight: 700; 
                flex-shrink: 0; /* منع العنوان من الاختفاء عند التمرير */
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
            
            /* --- [ كروت المحتوى ] --- */
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
            }
            h3 { color: var(--accent); margin: 0; margin-bottom: 15px; }

            /* كروت السيرفرات في الصفحة الرئيسية */
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
                <a class="${active=='home'?'active':''}" href="/dashboard">📊 الإحصائيات</a>
                <a class="${active=='security'?'active':''}" href="/manage/${guild.id}/security">🛡️ الحماية</a>
                // أضف هذا السطر مع باقي الروابط في دالة ui
<a class="${active=='kick'?'active':''}" href="/manage/${guild.id}/kick">🟢 تنبيهات Kick</a>
                <a class="${active=='streaks'?'active':''}" href="/manage/${guild.id}/streaks">🔥 الستريك المطور</a>
                <a class="${active=='logs'?'active':''}" href="/manage/${guild.id}/logs">📜 اللوج</a>
                <a class="${active=='tickets'?'active':''}" href="/manage/${guild.id}/tickets">🎫 التذاكر</a>
                <a class="${active=='autoreply'?'active':''}" href="/manage/${guild.id}/autoreply">💬 الرد الآلي</a>
                <a class="${active=='levels'?'active':''}" href="/manage/${guild.id}/levels">🏆 المستويات</a>
                <a class="${active=='welcome'?'active':''}" href="/manage/${guild.id}/welcome">👋 الترحيب</a>
                <a class="${active=='giveaway'?'active':''}" href="/manage/${guild.id}/giveaway">🎉 القيف اواي</a>
                <a class="${active=='roles'?'active':''}" href="/manage/${guild.id}/roles">🎭 الرتب</a>
                <a class="${active=='mod'?'active':''}" href="/manage/${guild.id}/mod">🛡️ أوامر الإشراف</a>
            </div>
        </div>
        <div class="main">
            <h1 style="margin-bottom:30px; font-size: 28px;">📍 ${guildName}</h1>
            ${content}
        </div>
    </body>
    </html>`;
}


// تحويل أي شخص يدخل الرابط الرئيسي للداشبورد فوراً
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});


app.get('/ping', (req, res) => {
  res.send('I am alive!');
});

app.post('/save/:guildId/streaks', checkAuth, async (req, res) => {
    await StreakConfig.findOneAndUpdate(
        { guildId: req.params.guildId },
        {
            $set: {
                requiredMessages: Number(req.body.reqMsgs),
                streakRole: req.body.streakRole,
                streakChannel: req.body.streakChannel
            }
        },
        { upsert: true }
    );
    res.redirect(`/manage/${req.params.guildId}/streaks`);
});


// إرسال الايمباد
app.post('/send-embed/:guildId', checkAuth, async (req, res) => {
    const { chId, title, desc, color } = req.body;
    const channel = client.channels.cache.get(chId);
    if(channel) {
        const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color || '#5865F2');
        channel.send({ embeds: [embed] }).catch(()=>{});
    }
    res.redirect(`/manage/${req.params.guildId}/streaks`);
});

app.get('/dashboard', checkAuth, (req, res) => {
    // 1. فلترة السيرفرات التي يمتلك فيها المستخدم صلاحية Administrator (0x8)
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
        <h3>${g.name}</h3>

        ${hasBot
            ? `<a href="/manage/${g.id}/home">⚙️ الإعدادات</a>`
            : `<a href="${inviteLink}">➕ إضافة البوت</a>`
        }
    </div>`;
}).join('');

const content = `
<div class="main-wrapper">

    <div class="title">ZONE SYSTEM</div>

    <div class="guild-grid">
        ${cards}
    </div>

</div>

<style>
.main-wrapper{
    width:100%;
    min-height:100vh;
    display:flex;
    flex-direction:column;
    align-items:center;
    padding-top:40px;
}

/* العنوان */
.title{
    font-size:40px;
    font-weight:bold;
    background: linear-gradient(45deg, #ff4d6d, #7b2ff7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom:30px;
}

/* السيرفرات */
.guild-grid{
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:20px;
    width:100%;
    padding:20px;
}

/* كرت السيرفر */
.guild-card{
    width:200px;
    background:#1e1e2e;
    padding:15px;
    border-radius:20px;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:10px;
    transition:0.2s;
}

.guild-card:hover{
    transform:scale(1.05);
}

.guild-icon{
    width:70px;
    height:70px;
    border-radius:50%;
    object-fit:cover;
    border:2px solid #7b2ff7;
}
</style>
`;

res.send(ui({id:null, name:'قائمة السيرفرات'}, 'home', content));
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
app.get('/manage/:guildId/roles', checkAuth, async (req, res) => {
    try {
        const g = client.guilds.cache.get(req.params.guildId);
        if (!g) return res.redirect('/dashboard');

        let config = await GuildConfig.findOne({ guildId: g.id }) || { rolesPanel: [] };
        const channels = g.channels.cache.filter(c => c.type === 0);

        let rolesHtml = '';
        // إنشاء 8 خانات للرتب كما في المنطق السابق
        for (let i = 0; i < 8; i++) {
            const rData = config.rolesPanel && config.rolesPanel[i] ? config.rolesPanel[i] : {};
            rolesHtml += `
            <div class="card" style="margin-bottom:15px; border-right: 4px solid var(--p);">
                <h4>🎭 رتبة #${i + 1}</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <select name="role_${i}">
                        <option value="">-- اختر الرتبة --</option>
                        ${g.roles.cache.filter(r => r.name !== "@everyone").map(role => 
                            `<option value="${role.id}" ${rData.roleId === role.id ? 'selected' : ''}>${role.name}</option>`
                        ).join('')}
                    </select>
                    <input type="text" name="label_${i}" value="${rData.label || ''}" placeholder="اسم الزر (مثلاً: رتبة 1)">
                </div>
            </div>`;
        }

        const content = `
        <form method="POST" action="/save/${g.id}/roles">
            <div class="card">
                <h3>🎭 إعدادات لوحة الرتب الذاتية</h3>
                <label>📍 قناة إرسال اللوحة:</label>
                <select name="channel" required>
                    <option value="">-- اختر الروم --</option>
                    ${channels.map(c => `<option value="${c.id}" ${config.rolesChannel === c.id ? 'selected' : ''}># ${c.name}</option>`).join('')}
                </select>
            </div>
            ${rolesHtml}
            <button class="btn-save">💾 حفظ إعدادات الرتب</button>
        </form>
        `;

        res.send(ui(g, 'roles', content));
    } catch (err) {
        console.error(err);
        res.status(500).send("خطأ في تحميل صفحة الرتب");
    }
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

    const types = ['messages','moderation','members','channels','roles','voice'];

    let content = `
    <form method="POST" action="/save/${g.id}/logs">
        <div class="card">
            <h3>📜 نظام اللوق</h3>

            ${types.map(t => `
                <label>${t}</label>
                <input type="checkbox" name="${t}_st" ${s.logs?.[t]?.enabled ? 'checked' : ''}>
                <select name="${t}_ch">
                    ${g.channels.cache.filter(c=>c.type===0).map(c =>
                        `<option value="${c.id}" ${s.logs?.[t]?.channel==c.id?'selected':''}>${c.name}</option>`
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
    const types = ['messages','moderation','members','channels','roles','voice'];
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
            <h4>الرد #${i+1}</h4>
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
                ${g.channels.cache.filter(c=>c.type===0).map(c =>
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
                        ${g.roles.cache.map(r => `<option value="${r.id}" ${s.adminRole==r.id?'selected':''}>${r.name}</option>`).join('')}
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
                    ${[0,1,2,3].map(i => `
                        <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05)">
                            <input name="btn_label_${i}" placeholder="اسم الزر ${i+1}" value="${s.buttons?.[i]?.label || ''}" style="margin:2px 0; font-size:13px;">
                            <input name="btn_emoji_${i}" placeholder="ID الإيموجي" value="${s.buttons?.[i]?.emoji || ''}" style="margin:2px 0; font-size:13px;">
                        </div>
                    `).join('')}
                </div>

                <!-- قسم المنيو -->
                <div>
                    <h4 style="color:var(--s)">🔽 خيارات المنيو (أقصى حد 4)</h4>
                    ${[0,1,2,3].map(i => `
                        <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05)">
                            <input name="menu_label_${i}" placeholder="خيار المنيو ${i+1}" value="${s.menuOptions?.[i]?.label || ''}" style="margin:2px 0; font-size:13px;">
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
                    "jail.channelId": req.body.channelId
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
                    .setColor(config.color || "#5865F2")

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
        if (/^\d+$/.test(em)) {
            button.setEmoji({ id: em });
        } else if (/^<a?:\w+:\d+>$/.test(em)) {
            button.setEmoji(em);
        }
    } catch (e) {
        console.log("Emoji Error:", e.message);
    }
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
    // 1. التحقق الأساسي
    if (!msg.guild || msg.author.bot) return;

    // 2. جلب إعدادات السيرفر (s)
    const s = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (!s) return;

    // 3. جلب بيانات العضو (u)
    let u = await UserLevel.findOne({ guildId: msg.guild.id, userId: msg.author.id });
    if (!u) {
        u = new UserLevel({ guildId: msg.guild.id, userId: msg.author.id });
    }

    // 4. تسجيل إحصائيات الرسائل
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
    ).catch(() => {});

    // 5. فحص الحماية
    const hasBypass = msg.member.roles.cache.some(role => s.security?.bypassRoles?.includes(role.id));

    if (!hasBypass) {
        // --- [ نظام الإيموجي الممنوع ] ---
        if (s.security?.badEmojis && s.security.badEmojis.trim().length > 0) {
            const forbiddenEmojis = s.security.badEmojis.split(',').map(e => e.trim());
            const hasBadEmoji = forbiddenEmojis.some(emoji => emoji !== "" && msg.content.includes(emoji));

            if (hasBadEmoji) {
                await msg.delete().catch(() => {});
                try {
                    await msg.member.timeout(5 * 60 * 1000, 'استخدام إيموجي ممنوع');
                    return msg.channel.send(`⚠️ ${msg.author}، هذا الإيموجي غير مسموح به هنا!`);
                } catch (e) { console.log("خطأ في التايم آوت"); }
                return;
            }
        }

        // --- [ نظام منع الروابط ] ---
        if (s.security?.antiLinks && /(https?:\/\/)/.test(msg.content)) {
            await msg.delete().catch(() => {});
            return msg.channel.send(`⚠️ ${msg.author}، الروابط ممنوعة هنا!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    } // إغلاق شرط hasBypass
if (msg.content === '!rolespanel') {

    const config = await GuildConfig.findOne({ guildId: msg.guild.id });
    if (!config?.rolesPanel?.length) return msg.reply("❌ ما في رتب مضافة");

    const channel = msg.guild.channels.cache.get(config.rolesChannel);
    if (!channel) return msg.reply("❌ الروم غير موجود");

    const rows = [];
    let row = new ActionRowBuilder();

    for (const r of config.rolesPanel) {

        if (r.type === "button") {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`role_${r.roleId}`)
                    .setLabel(r.label)
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        if (row.components.length === 5) {
            rows.push(row);
            row = new ActionRowBuilder();
        }
    }

    if (row.components.length > 0) rows.push(row);

    channel.send({
        content: "🎭 نظام الرتب",
        components: rows
    });

    msg.reply("✅ تم إرسال لوحة الرتب");
}



    // 6. نظام الستريك المطور
    const sConf = await StreakConfig.findOne({ guildId: msg.guild.id });
    if (sConf && msg.member.roles.cache.has(sConf.streakRole)) {
        const now = new Date();
        const isSameDay = u.lastMessageDate && u.lastMessageDate.toDateString() === now.toDateString();

        if (!isSameDay) {
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
                   // البحث عن السطر اللي بيبدأ بـ const embed = new EmbedBuilder() وتغييره لهذا:
const embed = new EmbedBuilder()
    .setAuthor({ name: `إحصائيات الستريك لـ ${msg.author.username}`, iconURL: msg.author.displayAvatarURL() })
    .setDescription(`🔥 **عدد الأيام**\n${u.streakCount} يوم\n\n💬 **رسائل اليوم**\n${u.dailyMsgs} رسالة\n\n⌛ **ينتهي خلال**\n<t:${Math.floor((new Date(u.lastMessageDate).getTime() + 86400000) / 1000)}:R>`)
    .setThumbnail(msg.author.displayAvatarURL({ dynamic: true }))
    .setColor('#FFAC33') // لون برتقالي نار
    .setFooter({ text: 'Zone System • استمر ولا تقطع | !' })
    .setTimestamp();

logCh.send({ content: `${msg.author}`, embeds: [embed] });

                }
            }
        }
        await u.save();
    }

 // --- [ أمر !ستريكي و !ستريك المطور بالإيمباد ] ---
if (msg.content.startsWith('!ستريك')) {
    const target = msg.mentions.members.first() || msg.member;
    const userData = await UserLevel.findOne({ guildId: msg.guild.id, userId: target.id });
    
    if (!userData) return msg.reply("❌ هذا العضو ليس لديه سجلات تفاعل بعد.");

    const streakCount = userData.streakCount || 0;
    const dailyMsgs = userData.dailyMsgs || 0;
    const lastActive = userData.lastMessageDate || new Date();

    // حساب الوقت المتبقي (24 ساعة من آخر رسالة)
    const expiresAt = Math.floor((new Date(lastActive).getTime() + 86400000) / 1000);

    const embed = new EmbedBuilder()
        .setAuthor({ name: `إحصائيات الستريك لـ ${target.user.username}`, iconURL: target.user.displayAvatarURL() })
        .setDescription(`
🔥 **عدد الأيام**
${streakCount} يوم

💬 **رسائل اليوم**
${dailyMsgs} رسالة

⌛ **ينتهي خلال**
<t:${expiresAt}:R>
        `)
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .setColor('#FFAC33') // لون برتقالي ناري
        .setFooter({ text: 'Zone System • استمر ولا تقطع | !' })
        .setTimestamp();

    msg.reply({ embeds: [embed] });
}
// --- [ أمر توب الستريك !top-streak ] ---
if (msg.content.startsWith ('!توب') || msg.content.startsWith('!top-streak')) {
    // جلب أعلى 10 مستخدمين مرتبين حسب streakCount من الأكبر للأصغر
    const topUsers = await UserLevel.find({ guildId: msg.guild.id, streakCount: { $gt: 0 } })
        .sort({ streakCount: -1 })
        .limit(10);

    if (topUsers.length === 0) return msg.reply("❌ لا يوجد متصدرين في نظام الستريك بعد.");

    const embed = new EmbedBuilder()
        .setTitle(`🏆 قائمة متصدري الستريك في ${msg.guild.name}`)
        .setColor('#FFAC33')
        .setThumbnail(msg.guild.iconURL())
        .setTimestamp();

    let description = "";

    for (let i = 0; i < topUsers.length; i++) {
        const uData = topUsers[i];
        
        // استخدام المنشن مباشرة بدلاً من الاسم
        const userTag = `<@${uData.userId}>`;
        
        let medal = "";
        if (i === 0) medal = "🥇";
        else if (i === 1) medal = "🥈";
        else if (i === 2) medal = "🥉";
        else medal = `**#${i + 1}**`;

        description += `${medal} | ${userTag} — \`${uData.streakCount} يوم\`\n`;
    }


    embed.setDescription(description);
    embed.setFooter({ text: "Zone System • المنافسة مشتعلة! 🔥" });

    msg.reply({ embeds: [embed] });
}


    // 8. 🤖 الرد الآلي
    const r = s.autoReply?.find(x => x.trigger && msg.content.toLowerCase() === x.trigger.toLowerCase());
    if (r) return msg.reply(r.reply).catch(() => {});

    // 9. 🏆 نظام المستويات (Levels)
    if (s.levels?.enabled) {
        u.xp += s.levels.xpPerMessage || 10;
        u.msgCount++;
        if (u.xp >= u.level * u.level * 100) {
            u.level++;
            const lvChannel = msg.guild.channels.cache.get(s.levels.levelUpChannel) || msg.channel;
            lvChannel.send(`🎉 مبروك ${msg.author}! صرت لفل **${u.level}**`).catch(() => {});
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
                    try { button.setEmoji(/^\d+$/.test(em) ? { id: em } : em); } catch (e) {}
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
                    try { option.emoji = /^\d+$/.test(em) ? { id: em } : em; } catch (e) {}
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
if (command === modConfig.jail.commandName.toLowerCase()) {
    // 1. فحص الصلاحيات الأساسية
    if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return msg.reply("❌ عذراً، هذا الأمر مخصص للإدارة العليا فقط!");

    const target = msg.mentions.members.first();
    const timeInput = args.find(arg => /[smhdw]/.test(arg));

    // 2. التحقق من المدخلات
    if (!target || !timeInput) return msg.reply(`⚠️ الاستخدام الصحيح: \`!${command} @user 1h\``);
    if (target.id === msg.author.id) return msg.reply("❌ لا يمكنك سجن نفسك!");
    if (target.user.bot) return msg.reply("❌ لا يمكنك سجن البوتات!");

    // 3. 🛡️ حماية الرتب العليا (أهم جزء)
    // المالك يقدر يسجن الكل، لكن الإداري ما يقدر يسجن رتبة أعلى منه أو تساويه
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
        // 4. حفظ الرتب الأصلية في الداتابيز
        const currentRoles = target.roles.cache.filter(r => r.id !== msg.guild.id).map(r => r.id);

        await JailData.findOneAndUpdate(
            { guildId: msg.guild.id, userId: target.id },
            { oldRoles: currentRoles, endAt: new Date(Date.now() + durationMs) },
            { upsert: true }
        );

        // 5. التنفيذ: سحب الكل وإعطاء رتبة السجن فقط
        // ملاحظة: تأكد أن رتبة البوت أعلى من الجميع
        await target.roles.set([jailRole.id]).catch(err => {
            return msg.reply("❌ فشل سحب الرتب، تأكد أن رتبة البوت أعلى من رتبة العضو.");
        });

        msg.channel.send(`🔒 تم سجن ${target} لمدة **${timeInput}** بنجاح واستبدال كافة رتبه برتبة السجن.`);

        // 6. المؤقت التلقائي لفك السجن
        setTimeout(async () => {
            await handleUnjail(target, msg.guild.id);
        }, durationMs);

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

            const jailChannel = msg.guild.channels.cache.get(modConfig.jail.channelId);
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
app.post('/save/:guildId/roles', checkAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const g = client.guilds.cache.get(guildId);
        if (!g) return res.status(404).send("السيرفر غير موجود");

        const rolesPanel = [];
        // 1. تجميع البيانات من الفورم
        for (let i = 0; i < 8; i++) {
            if (req.body[`role_${i}`]) {
                rolesPanel.push({
                    roleId: req.body[`role_${i}`],
                    label: req.body[`label_${i}`] || "رتبة",
                    type: "button"
                });
            }
        }

        // 2. حفظ البيانات في الداتابيز
        await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: { rolesPanel, rolesChannel: req.body.channel } },
            { upsert: true }
        );

        // 3. بناء وإرسال اللوحة فوراً لـ ديسكورد
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

                // كل 5 أزرار في سطر واحد (قوانين ديسكورد)
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

// حفظ إعدادات اللوق
app.post('/save/:guildId/logs', checkAuth, async (req, res) => {
    const b = req.body;
    const types = ['messages','moderation','members','channels','roles','voice'];
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
        .setDescription(`${description}\n\n**ينتهي:** <t:${Math.floor(endAt/1000)}:R>\n**الفائزين:** ${winners}`)
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
    if (logCh) logCh.send({ embeds: [embed] }).catch(() => {});
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
       



const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId('ticket_menu')
        .setPlaceholder('اختر نوع التكت')
        .addOptions([
            { label: 'Support', value: 'support' },
            { label: 'Report', value: 'report' },
            { label: 'Other', value: 'other' }
        ])
);
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
    if (logCh) logCh.send({ embeds: [embed] }).catch(() => {});
});
         logCh.send({ embeds: [logEmbed] }).catch(() => {});
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
        await welcomeCh.send({ content: `✨ حياك الله ${member} في سيرفرنا!`, files: [attachment] }).catch(() => {});
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
async function handleUnjail(member, guildId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild || !member) return;

        const jailData = await JailData.findOne({ guildId, userId: member.id });
        const modConfig = await ModConfig.findOne({ guildId });

        if (!jailData) return;

        // 1. فلترة الرتب الموجودة فقط بالسيرفر
        const rolesToRestore = (jailData.oldRoles || [])
            .filter(rId => guild.roles.cache.has(rId));

        // 2. إزالة رتبة السجن أولاً
        if (modConfig?.jail?.roleId) {
            await member.roles.remove(modConfig.jail.roleId).catch(() => {});
        }

        // 3. إضافة الرتب القديمة وحدة وحدة (أكثر استقرار من set)
        for (const roleId of rolesToRestore) {
            await member.roles.add(roleId).catch(() => {});
        }

        // 4. حذف بيانات السجن
        await JailData.deleteOne({ guildId, userId: member.id });

        // 5. لوق
        const jailChannel = guild.channels.cache.get(modConfig?.jail?.channelId);
        if (jailChannel) {
            jailChannel.send(`🔓 تم فك سجن <@${member.id}> ورجعت رتبته بنجاح.`);
        }

    } catch (err) {
        console.error("Unjail Error:", err);
    }
}


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

// تأكد من وجود كلمة async هنا
client.on('interactionCreate', async (interaction) => { 

    try {
        if (!interaction.guild) return;
        const config = await TicketConfig.findOne({ guildId: interaction.guild.id });
        if (!config) return;

        // --- 1. فتح التكت (من الأزرار أو المنيو الرئيسية) ---
        if ((interaction.isButton() && (interaction.customId === 'open_ticket' || interaction.customId.startsWith('ticket_btn_'))) || 
            (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu')) {
            const type = interaction.isStringSelectMenu() ? interaction.values[0] : "عام";
            return openTicket(interaction, config, type);
        }

// --- [ 🎭 نظام الرتب الذاتية - رتبة واحدة فقط ] ---
if (interaction.isButton() && interaction.customId.startsWith('role_')) {
    try {
        const roleId = interaction.customId.replace('role_', '');
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) return interaction.reply({ content: "❌ الرتبة غير موجودة بالسيرفر.", ephemeral: true });

        // 1. جلب إعدادات السيرفر والتأكد من وجود مصفوفة الرتب
        const guildData = await GuildConfig.findOne({ guildId: interaction.guild.id });
        const allPanelRoles = (guildData && guildData.rolesPanel) ? guildData.rolesPanel.map(r => r.roleId) : [];

        // 2. إذا العضو ضغط على رتبة هي معه أصلاً -> يسحبها منه
        if (interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.remove(roleId).catch(() => {});
            return interaction.reply({ content: `❌ تم سحب رتبة **${role.name}** منك.`, ephemeral: true });
        }

        // 3. التأكد من صلاحية البوت
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({ content: "⚠️ رتبة البوت أقل من الرتبة المطلوبة، ارفع رتبة البوت.", ephemeral: true });
        }

        // 4. إزالة أي رتبة أخرى تابعة للوحة (إذا كانت موجودة في الداتابيز)
        if (allPanelRoles.length > 0) {
            const rolesToRemove = interaction.member.roles.cache.filter(r => allPanelRoles.includes(r.id));
            if (rolesToRemove.size > 0) {
                await interaction.member.roles.remove(rolesToRemove).catch(() => {});
            }
        }

        // 5. إعطاء الرتبة الجديدة
        await interaction.member.roles.add(roleId);
        return interaction.reply({ 
            content: `✅ تم إعطاؤك رتبة **${role.name}** (وتبديل الرتب الأخرى إن وجدت).`, 
            ephemeral: true 
        });

    } catch (err) {
        console.error("Role Error:", err);
        if (!interaction.replied) interaction.reply({ content: "❌ حدث خطأ، جرب مرة أخرى.", ephemeral: true });
    }
}

        // --- 3. أزرار التحكم داخل التكت ---
        if (interaction.isButton()) {
            const ticket = await TicketData.findOne({ channelId: interaction.channel.id });
            if (!ticket) return;

            const isAdmin = interaction.member.roles.cache.has(config.adminRole);
            const adminPermissions = ['claim_ticket', 'close_ticket', 'add_member', 'remove_member', 'summon_member'];
            
            if (!isAdmin && adminPermissions.includes(interaction.customId)) {
                return interaction.reply({ content: "❌ هذه الأزرار مخصصة للإدارة فقط!", ephemeral: true });
            }

            // [ زر الاستلام ]
            if (interaction.customId === 'claim_ticket') {
                if (ticket.claimedBy) return interaction.reply({ content: "⚠️ التكت مستلم بالفعل!", ephemeral: true });
                ticket.claimedBy = interaction.user.id;
                await ticket.save();
                return interaction.reply({ content: `✅ تم استلام التكت بواسطة: ${interaction.user}\n👤 صاحب التكت: <@${ticket.ownerId}>` });
            }

            // [ زر الاستدعاء ]
            if (interaction.customId === 'summon_member') {
                return interaction.channel.send(`📣 <@${ticket.ownerId}>، تعال الإداري ${interaction.user} يحتاجك هنا!`);
            }

            // [ زر إضافة عضو ]
            if (interaction.customId === 'add_member') {
                const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_menu').setPlaceholder('اختر الشخص المراد إضافته').setMaxValues(1);
                return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
            }

            // [ زر إزالة عضو ]
            if (interaction.customId === 'remove_member') {
                const userSelect = new UserSelectMenuBuilder().setCustomId('remove_user_menu').setPlaceholder('اختر الشخص المراد إزالته').setMaxValues(1);
                return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
            }

            // [ زر حذف التكت مع إرسال الفاتورة ]
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
                            { name: '⏰ وقت الفتح:', value: `<t:${Math.floor(ticket.openedAt / 1000)}:F>`, inline: false },
                            { name: '⌛ وقت الإغلاق:', value: `<t:${Math.floor(ticket.closedAt / 1000)}:F>`, inline: false }
                        )
                        .setFooter({ text: 'Zone System Stats' });
                    await owner.send({ embeds: [statsEmbed] }).catch(() => {});
                }

                await interaction.reply("🔒 تم تسجيل البيانات، سيتم حذف الروم خلال 5 ثوانٍ...");
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }
        }

        // --- 4. معالجة منيو اختيار الأعضاء (إضافة/إزالة) ---
        if (interaction.isUserSelectMenu()) {
            const targetId = interaction.values[0];
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!targetMember) return interaction.reply({ content: "❌ لم يتم العثور على العضو.", ephemeral: true });

            if (interaction.customId === 'add_user_menu') {
                await interaction.channel.permissionOverwrites.edit(targetMember, { ViewChannel: true, SendMessages: true });
                return interaction.update({ content: `✅ تم إضافة ${targetMember} للتكت.`, components: [], ephemeral: true });
            }

            if (interaction.customId === 'remove_user_menu') {
                await interaction.channel.permissionOverwrites.edit(targetMember, { ViewChannel: false });
                return interaction.update({ content: `❌ تم إزالة ${targetMember} من التكت.`, components: [], ephemeral: true });
            }
        }

    } catch (err) { console.error("❌ Interaction Error:", err); }

});

async function openTicket(interaction, config, type) {
    try {
        if (!interaction.deferred) await interaction.deferReply({ ephemeral: true });

        // 1. تحديث عداد التذاكر
        const ticketNumber = (config.ticketCount || 0) + 1;
        await TicketConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { $inc: { ticketCount: 1 } });

        // 2. إنشاء الروم وتحديد الصلاحيات
        const channel = await interaction.guild.channels.create({
            name: `ticket-${ticketNumber}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: config.adminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ],
        });

        // 3. بناء الإيمباد (النيون)
        const embed = new EmbedBuilder()
            .setTitle("🎫 تذكرتك الجديدة")
            .setDescription(`مرحباً ${interaction.user}\nتم فتح التكت بنجاح\n\n📌 النوع: **${type}**`)
            .setColor(config.color || "#5865F2")
            .setTimestamp();

        // 4. أزرار التحكم (استلام، إغلاق، إضافة، استدعاء)
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('📌 استلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('add_member').setLabel('➕ إضافة').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('summon_member').setLabel('📣 استدعاء').setStyle(ButtonStyle.Secondary)
        );

        // 5. الإرسال في الروم مع منشن الإدارة وصاحب التكت
        await channel.send({ 
            content: `${interaction.user} | <@&${config.adminRole}>`, 
            embeds: [embed], 
            components: [controlRow] 
        });
        
        // 6. حفظ بيانات التكت في الداتابيز (ضروري للأزرار)
        await TicketData.create({
            guildId: interaction.guild.id,
            channelId: channel.id,
            ownerId: interaction.user.id,
            openedAt: new Date()
        });

        await interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح: ${channel}` });

    } catch (err) {
        console.error("❌ Error in openTicket:", err);
        if (interaction.deferred) await interaction.editReply("❌ حدث خطأ تقني أثناء فتح التكت.");
    }
}


const axios = require('axios');

setInterval(async () => {
    const allConfigs = await KickConfig.find({});
    for (const config of allConfigs) {
        for (const streamer of config.streamers) {
            try {
                // فحص حالة البث عبر API وسيط أو مباشرة
                const response = await axios.get(`https://kick.com{streamer.kickUsername}`);
                const data = response.data;
                const isCurrentlyLive = data.livestream !== null;

                if (isCurrentlyLive && !streamer.isLive) {
                    // الشخص فتح بث الآن!
                    const guild = client.guilds.cache.get(config.guildId);
                    const channel = guild?.channels.cache.get(streamer.channelId);
                    if (channel) {
                        const mention = streamer.roleId ? `<@&${streamer.roleId}>` : "";
                        const embed = new EmbedBuilder()
                            .setTitle(data.user.username)
                            .setURL(`https://kick.com{streamer.kickUsername}`)
                            .setDescription(streamer.customMessage.replace('%name%', data.user.username) || `${data.user.username} بدأ بثاً مباشراً الآن!`)
                            .addFields({ name: 'العنوان', value: data.livestream.session_title })
                            .setImage(data.livestream.thumbnail.url)
                            .setColor('#00E701'); // لون كيك الأخضر

                        channel.send({ content: mention, embeds: [embed] });
                    }
                    streamer.isLive = true; // تحديث الحالة لمنع تكرار الإرسال
                } else if (!isCurrentlyLive) {
                    streamer.isLive = false; // إعادة الضبط عند إغلاق البث
                }
            } catch (e) { /* معالجة أخطاء الفحص */ }
        }
        await config.save();
    }
}, 60000); // يفحص كل دقيقة


app.listen(3000, () => {
    console.log('🚀 Dashboard: http://localhost:3000');
});
client.login(process.env.TOKEN);
