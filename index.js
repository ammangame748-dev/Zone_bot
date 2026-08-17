require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const app = express();
// راندر بيعطي بورت تلقائي، وإذا مش موجود بيشتغل على 3000
const PORT = process.env.PORT || 3000; 

// 1. تشغيل بوت ديسكورد
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.login(process.env.TOKEN);

client.once('ready', () => {
    console.log(`🤖 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// 2. إعداد الجلسات وحفظها في قاعدة بيانات المونجو (عشان راندر ما يضيع تسجيل الدخول)
app.use(session({
    secret: 'render-dashboard-secure-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_CONNECTION_STRING })
}));

app.use(express.json());

// قالب التصميم المرتب (HTML + CSS)
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>لوحة تحكم البوت للتجارب</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a1a; color: #fff; margin: 0; padding: 20px; text-align: center; }
        .container { max-width: 800px; margin: 40px auto; background: #2a2a2a; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        h1 { color: #5865F2; }
        .btn { background-color: #5865F2; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; transition: 0.3s; font-weight: bold; }
        .btn:hover { background-color: #4752c4; }
        .btn-danger { background-color: #ed4245; }
        .btn-danger:hover { background-color: #c93b3e; }
        .server-card { background: #3a3a3a; padding: 15px; margin: 15px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #4a4a4a; }
        .countdown { font-size: 24px; color: #fee75c; font-weight: bold; margin-top: 20px; background: rgba(254, 231, 92, 0.1); padding: 10px; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">${content}</div>
</body>
</html>
`;

// الصفحة الرئيسية لتسجيل الدخول
app.get('/', (req, res) => {
    if (!req.session.user) {
        const loginUrl = `https://discord.com{process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.CALLBACK_URL)}&response_type=code&scope=identify%20guilds`;
        return res.send(htmlTemplate(`
            <h1>مرحباً بك في لوحة التحكم 🛠️</h1>
            <p>سجل دخولك لتجربة تنظيف قنوات ورتب السيرفرات بلمسة واحدة.</p>
            <br>
            <a class="btn" href="${loginUrl}">تسجيل الدخول عبر ديسكورد</a>
        `));
    }
    res.redirect('/dashboard');
});

// رابط استقبال البيانات بعد تسجيل الدخول (Callback)
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('فشل تسجيل الدخول التلقائي');

    try {
        const tokenResponse = await axios.post('https://discord.com', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.CALLBACK_URL,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userResponse = await axios.get('https://discord.com', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        const guildsResponse = await axios.get('https://discord.com/guilds', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        req.session.user = userResponse.data;
        req.session.guilds = guildsResponse.data;
        res.redirect('/dashboard');
    } catch (error) {
        res.send('حدث خطأ في الاتصال بسيرفرات ديسكورد، تأكد من صحة الـ CLIENT_SECRET و CALLBACK_URL');
    }
});

// عرض السيرفرات المشتركة بين البوت والمسؤول
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');

    // فلترة السيرفرات اللي إنت فيها أدمن (صلاحية 0x8) والبوت موجود فيها بنفس الوقت
    const adminGuilds = req.session.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    const commonGuilds = adminGuilds.filter(g => client.guilds.cache.has(g.id));

    let listHtml = '<h1>اختر سيرفر التجربة ⚙️</h1>';
    if (commonGuilds.length === 0) {
        listHtml += '<p>لم يتم العثور على سيرفرات مشتركة تمتلك فيها صلاحية مدير والبوت متواجد بها.</p>';
    } else {
        commonGuilds.forEach(guild => {
            listHtml += `
                <div class="server-card">
                    <span><strong>${guild.name}</strong></span>
                    <a class="btn btn-danger" href="/manage/${guild.id}">تنظيف السيرفر</a>
                </div>
            `;
        });
    }
    res.send(htmlTemplate(listHtml));
});

// صفحة تأكيد الحذف وبدء العد التنازلي (10 ثواني)
app.get('/manage/:guildId', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.send('البوت غير مضاف في هذا السيرفر حالياً');

    res.send(htmlTemplate(`
        <h1>تطهير السيرفر: ${guild.name} ⚠️</h1>
        <p>عند الضغط على الزر، سيبدأ عد تنازلي مدته 10 ثوانٍ، بعدها سيتم <strong>حذف كل القنوات والرتب الأقل من البوت</strong> بالكامل!</p>
        <br>
        <button class="btn btn-danger" id="startBtn" onclick="startDestruction()">ابدأ الحذف الشامل</button>
        <div class="countdown" id="timer" style="display:none;"></div>

        <script>
            function startDestruction() {
                document.getElementById('startBtn').style.display = 'none';
                const timerDiv = document.getElementById('timer');
                timerDiv.style.display = 'block';
                
                let timeLeft = 10;
                timerDiv.innerText = "سيتم تدمير القنوات والرتب خلال: " + timeLeft + " ثوانٍ";
                
                const interval = setInterval(async () => {
                    timeLeft--;
                    if (timeLeft <= 0) {
                        clearInterval(interval);
                        timerDiv.innerText = "جاري الحذف والتطهير الآن... يرجى الانتظار";
                        
                        // إرسال طلب الحذف للخلفية
                        const response = await fetch('/api/nuke/${guildId}', { method: 'POST' });
                        const result = await response.json();
                        alert(result.message);
                        window.location.href = '/dashboard';
                    } else {
                        timerDiv.innerText = "سيتم تدمير القنوات والرتب خلال: " + timeLeft + " ثوانٍ";
                    }
                }, 1000);
            }
        </script>
    `));
});

// الـ API الفعلي المسؤول عن مسح القنوات والرتب
app.post('/api/nuke/:guildId', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'غير مصرح لك' });

    const guildId = req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ message: 'السيرفر غير موجود' });

    try {
        // 1. حذف جميع القنوات بالكامل
        const channels = await guild.channels.fetch();
        for (const [id, channel] of channels) {
            if (channel) await channel.delete().catch(() => {});
        }

        // 2. حذف جميع الرتب التي تقع تحت رتبة البوت
        const roles = await guild.roles.fetch();
        const botMember = await guild.members.fetch(client.user.id);
        const botHighestRole = botMember.roles.highest;

        for (const [id, role] of roles) {
            // تخطي رتبة @everyone، رتبة البوت نفسه، والرتب الأعلى منه
            if (role.id !== guild.id && role.comparePositionTo(botHighestRole) < 0 && !role.managed) {
                await role.delete().catch(() => {});
            }
        }

        res.json({ message: 'تم مسح وتطهير جميع القنوات والرتب للتجربة بنجاح! 👍' });
    } catch (err) {
        res.json({ message: 'حدث خطأ أثناء محاولة المسح، تأكد من صلاحيات البوت' });
    }
});

// تشغيل سيرفر الويب على راندر
app.listen(PORT, () => {
    console.log(`🌐 لوحة التحكم تعمل وتستمع على البورت: ${PORT}`);
});
