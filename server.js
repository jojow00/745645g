require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Load separate bilingual course files
const launchpad = require('./courses/launchpad');
const module1 = require('./courses/module1-algorithm');
const module2 = require('./courses/module2-sourcing');
const module3 = require('./courses/module3-editing');
const module4 = require('./courses/module4-whop');
const module5 = require('./courses/module5-iraq-cashout');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const QI_ACCOUNT = process.env.QI_ACCOUNT || '910114941305';

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

// Normalize Iraqi phone numbers (handles Arabic digits, +964, 00964, and missing leading 0)
function normalizeIraqiPhone(input) {
    if (!input) return '';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    let str = String(input).replace(/[٠-٩]/g, d => arabicDigits.indexOf(d));
    str = str.replace(/\D/g, '');
    if (str.startsWith('00964')) str = str.slice(5);
    else if (str.startsWith('964') && str.length > 10) str = str.slice(3);
    if (str.length === 10 && str.startsWith('7')) str = '0' + str;
    return str;
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('callback_query', (query) => {
    const parts = query.data.split('_');
    const action = parts[0];
    const orderCode = parts[1];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    db.run("UPDATE orders SET status = ? WHERE order_code = ?", [newStatus, orderCode], function(err) {
        if (!err) {
            bot.answerCallbackQuery(query.id, { text: `Order ${orderCode} ${newStatus}!` });
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
            bot.sendMessage(query.message.chat.id, `✅ Order ${orderCode} marked as ${newStatus}.`);
        }
    });
});

// 1. Login / Check Approved Status
app.post('/api/login', (req, res) => {
    const rawPhone = (req.body.phone || '').trim();
    const cleanPhone = normalizeIraqiPhone(rawPhone);
    const withoutZero = cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone;

    if (!cleanPhone || cleanPhone.length < 9) {
        return res.status(400).json({ error: 'Invalid phone number' });
    }

    db.get(
        "SELECT phone, order_code, status FROM orders WHERE phone IN (?, ?, ?)",
        [cleanPhone, rawPhone, withoutZero],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (row) {
                return res.json({
                    exists: true,
                    phone: row.phone,
                    orderCode: row.order_code,
                    status: row.status,
                    qiAccount: QI_ACCOUNT
                });
            } else {
                const orderCode = 'QI-' + Math.floor(10000 + Math.random() * 90000);
                db.run(
                    "INSERT INTO orders (order_code, phone, status) VALUES (?, ?, 'pending')",
                    [orderCode, cleanPhone],
                    function(insertErr) {
                        if (insertErr) return res.status(500).json({ error: 'Could not create order' });
                        res.json({
                            exists: false,
                            phone: cleanPhone,
                            orderCode,
                            status: 'pending',
                            qiAccount: QI_ACCOUNT
                        });
                    }
                );
            }
        }
    );
});

// 2. Submit Qi Receipt
app.post('/api/submit-receipt', upload.single('receipt'), (req, res) => {
    const { orderCode, txId, phone } = req.body;
    if (!txId || !req.file) return res.status(400).json({ error: 'Missing transaction ID or screenshot' });

    const filePath = req.file.path;

    db.get("SELECT id FROM orders WHERE tx_id = ?", [txId.trim()], (err, row) => {
        if (row) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Transaction ID already used.' });
        }
        db.run("UPDATE orders SET tx_id = ?, status = 'review' WHERE order_code = ?", [txId.trim(), orderCode], function(updateErr) {
            if (updateErr) return res.status(500).json({ error: 'Database update failed' });

            bot.sendPhoto(ADMIN_CHAT_ID, fs.createReadStream(filePath), {
                caption: `🚨 طلب تفعيل جديد\n🔖 الكود: ${orderCode}\n📱 الهاتف: ${phone}\n🧾 رقم العملية: ${txId}`,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Approve (تفعيل)', callback_data: `approve_${orderCode}` },
                        { text: '❌ Reject (رفض)', callback_data: `reject_${orderCode}` }
                    ]]
                }
            });
            res.json({ success: true, status: 'review' });
        });
    });
});

// 3. Status Polling
app.get('/api/status/:orderCode', (req, res) => {
    db.get("SELECT status FROM orders WHERE order_code = ?", [req.params.orderCode], (err, row) => {
        res.json({ status: row ? row.status : 'not_found' });
    });
});

// 4. Load Bilingual Modular Course Content
app.get('/api/course-data/:phone', (req, res) => {
    const rawPhone = (req.params.phone || '').trim();
    const cleanPhone = normalizeIraqiPhone(rawPhone);
    const withoutZero = cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone;

    db.get(
        "SELECT status FROM orders WHERE phone IN (?, ?, ?) AND status = 'approved'",
        [cleanPhone, rawPhone, withoutZero],
        (err, row) => {
            if (row) {
                res.json({
                    success: true,
                    launchpad: launchpad,
                    modules: [module1, module2, module3, module4, module5]
                });
            } else {
                res.status(403).json({ error: 'Unauthorized.' });
            }
        }
    );
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});
