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
    
    
        
        
        
        
    
    
        

            

                
                
VORTEX

                
نظام إدارة السيرفرات المتطور

            

            

                 الإحصائيات
                 تنبيهات Kick
                 الحماية
                 التذاكر
                 الإشراف
                 سجلات اللوق
                 نظام الليفل
                 الكلانات
                 الترحيب
                 قائمة السيرفرات
            

        

        
${content}

    
    `;
}

// ==========================================
// 6️⃣ Routes & Logic
// ==========================================

app.get('/login', (req, res) => res.send(`
    
    

        
VORTEX

        
أقوى نظام لإدارة وحماية سيرفرات الديسكورد

        🔑 تسجيل الدخول
    
`));

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));
    const cards = adminGuilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        return `

            
            
${g.name}

            
${hasBot ? '⚙️ إعدادات' : '➕ إضافة'}

        
`;
    }).join('');
    res.send(ui({ id: null }, 'home', `
مرحباً بك في VORTEX
اختر السيرفر الذي تود إدارته
${cards}
`));
});

// --- [ Home Stats ] ---
app.get('/manage/:guildId/home', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const stats = await Stats.findOne({ guildId: g.id }) || { messages: { total: 0 } };
    const content = `
    

        
📊 إحصائيات السيرفر العامة

        

            

                
${stats.messages.total}

                
إجمالي الرسائل

            

            

                
${g.memberCount}

                
عدد الأعضاء

            

        

    
`;
    res.send(ui(g, 'home', content));
});

// --- [ Kick Notifications ] ---
app.get('/manage/:guildId/kick', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await KickConfig.findOne({ guildId: g.id }) || { streamers: [] };
    const content = `
    

        
🟢 تنبيهات Kick المباشرة

        

            اسم المستخدم في Kick:
             
            قناة التنبيه:
            
                ${g.channels.cache.filter(c => c.type === 0).map(c => `# ${c.name}`).join('')}
            
            ➕ إضافة ستريمر جديد
        

        

            
الستريمرز المضافين:

            ${s.streamers.map((st, i) => `

                ${st.kickUsername}
                🗑️ حذف
            
`).join('')}
        

    
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

// --- [ Security Settings ] ---
app.get('/manage/:guildId/security', checkAuth, async (req, res) => {
    const g = client.guilds.cache.get(req.params.guildId);
    if (!g) return res.redirect('/dashboard');
    const s = await GuildConfig.findOne({ guildId: g.id }) || { security: {} };
    const content = `
    

        
🛡️ إعدادات الحماية والرقابة

        

            

                

                    منع الروابط:
                    
                        تشغيل
                        إيقاف
                    
                

                

                    نوع العقوبة:
                    
                        حذف الرسالة فقط
                        تحذير
                        إسكات (Timeout)
                    
                

            

            الكلمات الممنوعة (افصل بفاصلة):
            ${s.security?.badWords || ''}
            رتب الاستثناء (Bypass):
            
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `${r.name}`).join('')}
            
            💾 حفظ إعدادات الحماية
        

    
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
    

        
🎫 نظام التذاكر المتكامل

        

            

                
عنوان التذكرة:${s.title || 'الدعم الفني'} 

                
لون الإيمباد:${s.color || '#007bff'} 

            

            وصف التذكرة:
            ${s.description || 'اضغط لفتح تذكرة'}
            

                
رتبة الإدارة:${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `${r.name}`).join('')}

                
قناة الإرسال:-- اختر قناة --${g.channels.cache.filter(c => c.type === 0).map(c => `# ${c.name}`).join('')}

            

            
🖼️ صور التذكرة

            

                
الصورة العلوية: 

                
الصورة السفلية: 

            

            
🔘 الأزرار (حتى 4)

            

                ${[0,1,2,3].map(i => `
زر ${i+1}:
${s.buttons?.[i]?.label || ''} ${s.buttons?.[i]?.emoji || ''} 
`).join('')}
            

            💾 حفظ ونشر اللوحة
        

    
`;
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
    

        
⚖️ أوامر الإشراف والسجن

        

            رتبة السجن (Jail Role):
            
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `${r.name}`).join('')}
            
            قناة السجن:
            
                ${g.channels.cache.filter(c => c.type === 0).map(c => `# ${c.name}`).join('')}
            
            رتب الإدارة المسموح لها بالسجن:
            
                ${g.roles.cache.filter(r => r.name !== "@everyone").map(r => `${r.name}`).join('')}
            
            💾 حفظ إعدادات الإشراف
        

    
`;
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
