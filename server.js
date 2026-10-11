require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const QI_ACCOUNT = process.env.QI_ACCOUNT || '07701234567';

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

const upload = multer({ dest: 'uploads/' });
app.use(express.json());
app.use(express.static('public'));

const dbPath = process.env.DATABASE_PATH || './orders.sqlite';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        order_code TEXT UNIQUE, 
        phone TEXT UNIQUE, 
        tx_id TEXT UNIQUE, 
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('callback_query', (query) => {
    const action = query.data.split('_')[0]; 
    const orderCode = query.data.split('_')[1];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    db.run("UPDATE orders SET status = ? WHERE order_code = ?", [newStatus, orderCode], function(err) {
        if (!err) {
            bot.answerCallbackQuery(query.id, { text: `Order ${orderCode} ${newStatus}!` });
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
            bot.sendMessage(query.message.chat.id, `✅ Order ${orderCode} marked as ${newStatus}.`);
        }
    });
});

app.post('/api/login', (req, res) => {
    const { phone } = req.body;
    db.get("SELECT order_code, status FROM orders WHERE phone = ?", [phone], (err, row) => {
        if (row) {
            res.json({ exists: true, orderCode: row.order_code, status: row.status, qiAccount: QI_ACCOUNT });
        } else {
            const orderCode = 'QI-' + Math.floor(10000 + Math.random() * 90000);
            db.run("INSERT INTO orders (order_code, phone, status) VALUES (?, ?, 'pending')", [orderCode, phone], function(err) {
                res.json({ exists: false, orderCode, status: 'pending', qiAccount: QI_ACCOUNT });
            });
        }
    });
});

app.post('/api/submit-receipt', upload.single('receipt'), (req, res) => {
    const { orderCode, txId, phone } = req.body;
    const filePath = req.file.path;

    db.get("SELECT id FROM orders WHERE tx_id = ?", [txId], (err, row) => {
        if (row) {
            fs.unlinkSync(filePath); 
            return res.status(400).json({ error: 'Transaction ID already used.' });
        }
        db.run("UPDATE orders SET tx_id = ?, status = 'review' WHERE order_code = ?", [txId, orderCode], function(err) {
            bot.sendPhoto(ADMIN_CHAT_ID, fs.createReadStream(filePath), {
                caption: `🚨 New Order: ${orderCode}\n📱 Phone: ${phone}\n🧾 TX ID: ${txId}`,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Approve', callback_data: `approve_${orderCode}` },
                        { text: '❌ Reject', callback_data: `reject_${orderCode}` }
                    ]]
                }
            });
            res.json({ success: true, status: 'review' });
        });
    });
});

app.get('/api/status/:orderCode', (req, res) => {
    db.get("SELECT status FROM orders WHERE order_code = ?", [req.params.orderCode], (err, row) => {
        res.json({ status: row ? row.status : 'not_found' });
    });
});

// MASSIVE SECURE COURSE CONTENT
app.get('/api/course-data/:phone', (req, res) => {
    const phone = req.params.phone;
    db.get("SELECT status FROM orders WHERE phone = ? AND status = 'approved'", [phone], (err, row) => {
        if (row) {
            res.json({
                success: true,
                modules: [
                    {
                        title: "Module 1: The Algorithm & Niche Selection",
                        content: `<h3>Understanding the Game</h3><p>TikTok and YouTube Shorts algorithms reward one thing: <strong>Watch Time and Retention</strong>. If you can keep someone watching for 15 seconds, you will go viral.</p>
                        <h4>Step 1: Choose Your Niche</h4>
                        <p>Don't just clip random streamers. Focus on high-emotion categories:</p>
                        <ul>
                            <li><strong>Rage/Gaming:</strong> Streamers like IShowSpeed or Jynxzi. High energy, loud reactions.</li>
                            <li><strong>Podcasts/Alpha Male:</strong> Joe Rogan, Andrew Tate, Fresh & Fit. People love controversial opinions.</li>
                            <li><strong>Storytelling:</strong> True crime or weird internet mysteries.</li>
                        </ul>
                        <p><strong>Pro Tip:</strong> Do not just upload what everyone else is uploading. Find smaller, fast-growing streamers. If you are the first to clip a funny moment, you get all the views.</p>`
                    },
                    {
                        title: "Module 2: Sourcing & Downloading Content",
                        content: `<h3>Where to get the raw videos</h3><p>You need high-quality raw footage. Here are the best tools:</p>
                        <ul>
                            <li><strong>Twitch:</strong> Use <a href="https://twitchdownloader.com/" target="_blank" class="text-blue-400 underline">TwitchDownloader</a> to download VODs or specific clips.</li>
                            <li><strong>YouTube:</strong> Use <a href="https://yt5s.com/" target="_blank" class="text-blue-400 underline">YT5s</a> or 4K Video Downloader.</li>
                        </ul>
                        <p><strong>The "Double Screen" Strategy:</strong> A massively popular format right now is having the streamer on top, and satisfying footage (like GTA 5 car jumping or Minecraft parkour) on the bottom. You can download free satisfying gameplay footage from YouTube by searching "GTA 5 Parkour No Copyright gameplay".</p>`
                    },
                    {
                        title: "Module 3: Editing Hacks (The Viral Hook)",
                        content: `<h3>How to Edit Like a Pro</h3>
                        <p>You don't need expensive software. <a href="https://www.capcut.com/" target="_blank" class="text-blue-400 underline">CapCut (Free)</a> is the only tool you need.</p>
                        <h4>The 3-Second Hook</h4>
                        <p>If the first 3 seconds are boring, they will scroll. Start the video right at the exact moment someone screams, laughs, or says something crazy. Do NOT include the quiet build-up.</p>
                        <h4>Captions are Mandatory</h4>
                        <p>80% of people watch Shorts on mute or in loud places. Use CapCut's "Auto Captions" feature. Make the text bold, yellow, and put a black stroke around it so it's easy to read.</p>
                        <h4>AI Editing Tools (Speed up your workflow)</h4>
                        <p>If you don't want to edit manually, use <a href="https://www.opus.pro/" target="_blank" class="text-blue-400 underline">OpusClip</a>. You paste a YouTube link, and the AI automatically finds the best 10 clips and adds subtitles. It's a cheat code.</p>`
                    },
                    {
                        title: "Module 4: Monetization (Getting Paid in Iraq)",
                        content: `<h3>How to actually make money</h3>
                        <p>Because Iraq has some restrictions on the TikTok Creator Fund, here is how you bypass it and make thousands:</p>
                        <ol>
                            <li><strong>Sell High-Follower Accounts:</strong> Grow a page to 10k or 50k followers in a specific niche (like Gaming), then sell the account on websites like <a href="https://fameswap.com/" target="_blank" class="text-blue-400 underline">Fameswap</a> or via Telegram groups. A 50k follower page can sell for $200-$500.</li>
                            <li><strong>Affiliate Marketing:</strong> Put a Linktree in your bio. If you clip gaming streamers, put Amazon Affiliate links for gaming keyboards or energy drinks.</li>
                            <li><strong>YouTube Shorts Ad Revenue:</strong> YouTube pays creators globally. If you get 10 million views a month on Shorts, YouTube will pay you directly to your Iraqi bank account via Western Union or wire transfer.</li>
                            <li><strong>Promotions:</strong> Once your page hits 100k followers, smaller artists will pay you $20-$50 just to use their song in the background of your clips.</li>
                        </ol>`
                    }
                ]
            });
        } else {
            res.status(403).json({ error: 'Unauthorized.' });
        }
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});
