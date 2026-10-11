require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
// Railway dynamic port assignment via environment variables
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const QI_ACCOUNT = process.env.QI_ACCOUNT || '07701234567';

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error("❌ CRITICAL: Missing BOT_TOKEN or ADMIN_CHAT_ID");
    process.exit(1);
}

// Ensure uploads folder exists so server doesn't crash on Railway restarts
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: 'uploads/' });
app.use(express.json());
app.use(express.static('public'));

// Database Setup (Point this to a Railway Volume in production)
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

// Telegram Bot Setup
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('callback_query', (query) => {
    const action = query.data.split('_')[0]; 
    const orderCode = query.data.split('_')[1];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    db.run("UPDATE orders SET status = ? WHERE order_code = ?", [newStatus, orderCode], function(err) {
        if (!err) {
            bot.answerCallbackQuery(query.id, { text: `Order ${orderCode} ${newStatus}!` });
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { 
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            });
            bot.sendMessage(query.message.chat.id, `✅ Order ${orderCode} marked as ${newStatus}.`);
        }
    });
});

// --- API ROUTES ---

// 1. Auth / Login Route
app.post('/api/login', (req, res) => {
    const { phone } = req.body;
    db.get("SELECT order_code, status FROM orders WHERE phone = ?", [phone], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        if (row) {
            // User exists, return their saved state
            res.json({ exists: true, orderCode: row.order_code, status: row.status, qiAccount: QI_ACCOUNT });
        } else {
            // New user, create fresh pending order
            const orderCode = 'QI-' + Math.floor(10000 + Math.random() * 90000);
            db.run("INSERT INTO orders (order_code, phone, status) VALUES (?, ?, 'pending')", [orderCode, phone], function(err) {
                if (err) return res.status(500).json({ error: 'Could not create order' });
                res.json({ exists: false, orderCode, status: 'pending', qiAccount: QI_ACCOUNT });
            });
        }
    });
});

// 2. Submit Qi Receipt
app.post('/api/submit-receipt', upload.single('receipt'), (req, res) => {
    const { orderCode, txId, phone } = req.body;
    const filePath = req.file.path;

    if (!txId || !req.file) return res.status(400).json({ error: 'Missing data' });

    db.get("SELECT id FROM orders WHERE tx_id = ?", [txId], (err, row) => {
        if (row) {
            fs.unlinkSync(filePath); // Delete duplicate image to save space
            return res.status(400).json({ error: 'Transaction ID already used.' });
        }

        db.run("UPDATE orders SET tx_id = ?, status = 'review' WHERE order_code = ?", [txId, orderCode], function(err) {
            if (err) return res.status(500).json({ error: 'Database update failed' });

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

// 3. Polling endpoint for frontend
app.get('/api/status/:orderCode', (req, res) => {
    db.get("SELECT status FROM orders WHERE order_code = ?", [req.params.orderCode], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Not found' });
        res.json({ status: row.status });
    });
});

// 4. Secure Course Content Endpoint
app.get('/api/course-data/:phone', (req, res) => {
    const phone = req.params.phone;
    db.get("SELECT status FROM orders WHERE phone = ? AND status = 'approved'", [phone], (err, row) => {
        if (row) {
            res.json({
                success: true,
                title: "Advanced E-Commerce Masterclass",
                videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
                modules: [
                    { id: 1, title: "Module 1: Introduction" },
                    { id: 2, title: "Module 2: Core Strategy" },
                    { id: 3, title: "Module 3: Scaling" }
                ],
                content: "Welcome to the private masterclass. Ensure you complete Module 1 before downloading the attached PDF guides below."
            });
        } else {
            res.status(403).json({ error: 'Unauthorized. Pay wall active.' });
        }
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});
