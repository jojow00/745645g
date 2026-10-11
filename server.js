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

// MASSIVE EXPANDED COURSE CONTENT
app.get('/api/course-data/:phone', (req, res) => {
    const phone = req.params.phone;
    db.get("SELECT status FROM orders WHERE phone = ? AND status = 'approved'", [phone], (err, row) => {
        if (row) {
            res.json({
                success: true,
                launchpad: {
                    title: "🚀 Zero to First Upload (Step-by-Step Action Plan)",
                    content: `
                        <img src="https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=1200" class="w-full h-64 object-cover rounded-xl mb-6 shadow-lg" alt="Social Media Launch">
                        <h2>The 14-Day Viral Blueprint</h2>
                        <p>This is your exact daily workflow. If you skip these steps, you risk getting shadowbanned by the algorithm. <i class="fab fa-tiktok text-pink-500"></i> TikTok and <i class="fab fa-youtube text-red-500"></i> YouTube are highly suspicious of new accounts that upload immediately. You must act like a real human consumer before you become a creator.</p>
                        
                        <h3>Step 1: The Account "Warm-Up" Phase (Days 1-3)</h3>
                        <p>When you create a brand new <i class="fab fa-tiktok text-pink-500"></i> TikTok, <i class="fab fa-youtube text-red-500"></i> YouTube Shorts, or <i class="fab fa-instagram text-purple-500"></i> Instagram Reels account, you are placed in a "sandbox." The algorithm is watching to see if you are a spam bot.</p>
                        <ul>
                            <li><strong>Day 1:</strong> Create the accounts using a fresh Gmail address. Do not upload a profile picture yet. Spend 30 minutes scrolling the "For You" page. When you see a video in your chosen niche (e.g., Gaming or Podcasts), watch it all the way through, like it, and leave a genuine comment. </li>
                            <li><strong>Day 2:</strong> Log in again. Scroll for another 20 minutes. Follow 5-10 large creators in your niche (e.g., IShowSpeed, Kai Cenat, Joe Rogan). Like their recent videos. This tells the algorithm exactly what category your account belongs to.</li>
                            <li><strong>Day 3:</strong> Profile Setup. Upload a high-quality profile picture. Write a keyword-optimized bio (e.g., "Daily Streamer Moments 🎬 | Best <i class="fab fa-twitch text-purple-500"></i> Twitch & <i class="fab fa-kickstarter text-green-500"></i> Kick Clips"). Link your Instagram to your TikTok. You are now ready to post.</li>
                        </ul>

                        <h3>Step 2: Tool Setup & Workflow Preparation</h3>
                        <p>Efficiency is how you win. You need to be able to produce 3-5 videos a day without burning out. Install your arsenal:</p>
                        <ul>
                            <li><strong>Desktop Editing:</strong> Download CapCut for PC. It is free, incredibly powerful, and has the best auto-captioning engine.</li>
                            <li><strong>Mobile Editing:</strong> If you only have a phone, download CapCut Mobile and VN Video Editor.</li>
                            <li><strong>Downloading:</strong> Bookmark TwitchDownloader for <i class="fab fa-twitch text-purple-500"></i> Twitch VODs, and Cobalt.tools for <i class="fab fa-youtube text-red-500"></i> YouTube.</li>
                        </ul>

                        <h3>Step 3: Finding Your First Clip (The Goldmine Strategy)</h3>
                        <p>Do not just screen-record a random moment. Go to <i class="fab fa-twitch text-purple-500"></i> Twitch or <i class="fab fa-kickstarter text-green-500"></i> Kick. Look at the "Top Clips" of the week for a mid-sized streamer (someone with 2,000 - 5,000 viewers). You want to find a moment of extreme emotion: a massive rage quit, an uncontrollable laughing fit, or a highly controversial statement. Download the 60-second segment surrounding that exact moment.</p>

                        <h3>Step 4: The 15-Minute Edit Masterclass</h3>
                        <p>Open CapCut. Your goal is to make the video impossible to scroll past.</p>
                        <ol>
                            <li><strong>The Brutal Cut:</strong> Trim the video so it starts the <em>exact microsecond</em> the streamer starts speaking or reacting. No silent intros. No "hey guys." Cut the fat.</li>
                            <li><strong>The 9:16 Format:</strong> Change the aspect ratio to vertical. Place the streamer's face cam at the top center, and the gameplay or visual context at the bottom.</li>
                            <li><strong>Auto-Captions (Mandatory):</strong> Click "Text" -> "Auto Captions". Change the font to 'Bangers', 'Proxima Nova', or 'The Bold Font'. Make the text bright yellow or white. Add a thick black stroke and a drop shadow so it pops off the screen. <em>Never have more than 3 words on screen at once.</em></li>
                            <li><strong>Audio Enhancement:</strong> Add a subtle "whoosh" sound effect when the video starts, and a "pop" sound effect when important text appears.</li>
                        </ol>

                        <h3>Step 5: SEO and Posting Strategy (Iraq/MENA Timing)</h3>
                        <p>When you hit publish, the algorithm needs data to categorize your video.</p>
                        <ul>
                            <li><strong>The Hook Caption:</strong> Keep it short and create a "curiosity gap." Examples: "Wait for his reaction at the end... 💀" or "I can't believe he actually said this."</li>
                            <li><strong>Hashtags:</strong> Use 4-5 targeted tags. #fyp #gaming #streamerclips #viral. Do not spam 30 hashtags; it confuses the algorithm.</li>
                            <li><strong>Golden Posting Times (Baghdad Time):</strong> The algorithm pushes content when people are most active. Post at <strong>3:00 PM</strong> (after school/work), <strong>6:00 PM</strong>, and <strong>9:00 PM</strong>. Consistency is key. Post 2-3 times every single day.</li>
                        </ul>
                    `
                },
                modules: [
                    {
                        title: "Module 1: The Psychology of Virality & Algorithm Secrets",
                        content: `
                        <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200" class="w-full h-64 object-cover rounded-xl mb-6 shadow-lg" alt="Analytics and Growth">
                        <h3>Decoding the Algorithm Matrix</h3>
                        <p>Many beginners think going viral is luck. It is not. <i class="fab fa-tiktok text-pink-500"></i> TikTok, <i class="fab fa-youtube text-red-500"></i> YouTube Shorts, and <i class="fab fa-instagram text-purple-500"></i> Reels are run by highly advanced machine learning algorithms. These algorithms do not care about how many followers you have, how nice your video looks, or how much effort you put in. They only care about two mathematical metrics: <strong>Retention Rate</strong> and <strong>Engagement Rate</strong>.</p>
                        
                        <h4>1. Retention Rate (The Holy Grail)</h4>
                        <p>Retention Rate is the percentage of your video that people actually watch. If your video is 30 seconds long, and people swipe away after 3 seconds, your retention is terrible (10%), and the algorithm will kill the video at 200 views. If people watch for 25 seconds, your retention is excellent (83%), and the algorithm will push your video to millions.</p>
                        <p><strong>The 3-Second Hook:</strong> The human attention span on short-form content is brutally short. You have exactly 3 seconds to convince the brain not to scroll. You achieve this by starting the video at the climax of the action. If you are clipping a <i class="fab fa-twitch text-purple-500"></i> Twitch streamer raging at a game, do not show the 10 seconds of him playing quietly before the rage. Start the video the exact second he screams and slams his desk. Immediate action equals immediate retention.</p>

                        <h4>2. Engagement Rate (The Viral Multiplier)</h4>
                        <p>Engagement means Likes, Comments, Shares, and Saves. Comments and Shares are the most powerful. When someone clicks "Share -> Copy Link" or sends it to a friend, the algorithm sees this as a massive positive signal.</p>

                        <h4>Niche Selection: Where the Money Resides</h4>
                        <p>You cannot clip random, boring content and expect to go viral. You must choose a niche that triggers strong human emotions (laughter, anger, shock, or curiosity). Here are the most dominant niches right now:</p>
                        <ul>
                            <li><strong>High-Energy Gaming & Rage:</strong> Streamers like IShowSpeed, Jynxzi, Sketch, and CaseOh. Their audiences are young, highly active, and share videos constantly. Their reactions are explosive, which guarantees a strong 3-second hook.</li>
                            <li><strong>Alpha Male & Controversial Podcasts:</strong> Clips from Joe Rogan, Andrew Tate, Fresh & Fit, or Piers Morgan. These clips work because they divide people. Half the viewers will agree, half will disagree, and they will fight in the comments section. <strong>Arguing in the comments takes time. While they type, your video loops in the background, skyrocketing your retention rate.</strong></li>
                            <li><strong>True Crime & Storytelling:</strong> A streamer reacting to a scary video, a mystery, or a police interrogation. The viewer's natural curiosity forces them to stay until the end of the video to find out what happens. This results in the highest completion rates on the platform.</li>
                        </ul>
                        <p><strong>The "Blue Ocean" Strategy:</strong> Do not just clip the top 5 biggest streamers in the world. Thousands of people are already doing that. Find a <i class="fab fa-kickstarter text-green-500"></i> Kick or Twitch streamer who averages 1,000 to 5,000 viewers. They are funny and entertaining, but no one is clipping them yet. You become their main "plug" channel and capture 100% of the audience for that specific person.</p>`
                    },
                    {
                        title: "Module 2: Advanced Sourcing & The 'Double Screen' Format",
                        content: `
                        <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200" class="w-full h-64 object-cover rounded-xl mb-6 shadow-lg" alt="Gaming Setup">
                        <h3>Mastering Content Sourcing</h3>
                        <p>Your final product is entirely dependent on the quality of your raw footage. Never screen-record a video from your phone; it destroys the resolution, drops the frame rate, and the algorithms actively suppress low-quality uploads.</p>
                        
                        <h4>The Professional Download Arsenal</h4>
                        <ul>
                            <li><a href="https://twitchdownloader.com/" target="_blank" class="text-yellow-400 font-bold underline"><i class="fab fa-twitch text-purple-500"></i> TwitchDownloader:</a> This is an essential, free PC program. Instead of downloading a massive 8-hour stream, you paste the VOD link, input the exact timestamps you want (e.g., 04:15:20 to 04:17:00), and download just that 2-minute section in crystal clear 1080p 60FPS.</li>
                            <li><a href="https://cobalt.tools/" target="_blank" class="text-yellow-400 font-bold underline"><i class="fab fa-youtube text-red-500"></i> Cobalt.tools:</a> The absolute best ad-free, ultra-fast downloader for YouTube, Twitter, Instagram, and Reddit. It strips away all metadata and gives you the raw MP4 file instantly.</li>
                            <li><a href="https://yt5s.com/" target="_blank" class="text-yellow-400 font-bold underline">YT5s & 4K Video Downloader:</a> Excellent backup tools for pulling massive, multi-hour podcast files directly from YouTube for offline editing.</li>
                        </ul>

                        <h4>The "Double Screen" Strategy (The Retention Hack)</h4>
                        <p>Have you noticed videos where a <i class="fab fa-youtube text-red-500"></i> YouTube podcast is playing on the top half of the screen, and someone is playing GTA 5, Minecraft Parkour, or cutting kinetic sand on the bottom half? This is not an accident. This is a scientifically proven retention tactic known as <strong>Sludge Content or Overstimulation Content</strong>.</p>
                        <p>Modern audiences, especially on <i class="fab fa-tiktok text-pink-500"></i> TikTok, have severely depleted dopamine receptors. If a podcast clip consists only of two men sitting in chairs talking, the viewer's brain gets bored visually within 5 seconds, even if the conversation is interesting. By placing highly satisfying, continuous motion (gameplay) on the bottom half of the screen, the viewer's brain gets visually distracted. They watch the gameplay while passively listening to the podcast. This artificially inflates your Watch Time and forces the algorithm to push your video.</p>
                        
                        <h5>How to Source the Bottom Half Footage for Free:</h5>
                        <p>You do not need to record the gameplay yourself. Go to YouTube and search for exactly these terms:</p>
                        <ul>
                            <li><em>"GTA 5 Parkour No Copyright Gameplay 1080p"</em></li>
                            <li><em>"Satisfying ASMR Kinetic Sand No Copyright"</em></li>
                            <li><em>"Subway Surfers No Copyright Background Footage"</em></li>
                            <li><em>"Minecraft Parkour Background Video Free to Use"</em></li>
                        </ul>
                        <p>Download 5 or 6 of these 1-hour long videos and save them to a dedicated folder on your computer. When you are editing in CapCut, simply import your streamer clip, place it at the top of the 9:16 frame, import your gameplay video, and place it at the bottom. Sync them up, and you instantly have a high-retention video format.</p>`
                    },
                    {
                        title: "Module 3: AI Automation & Editing Mastery",
                        content: `
                        <img src="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=1200" class="w-full h-64 object-cover rounded-xl mb-6 shadow-lg" alt="Video Editing">
                        <h3>The Art of the Edit: Transforming Raw Footage into Gold</h3>
                        <p>Editing is what separates the amateurs getting 200 views from the professionals generating millions. You have two distinct paths: The Automated AI Path (fast, requires a small budget) and the Manual Masterclass (free, highly customizable, creates the best results).</p>

                        <h4>The AI Workflow (The 5-Minute Setup)</h4>
                        <p>If you want to produce 20 videos a day with minimal effort, AI tools are now advanced enough to do 90% of the heavy lifting. They analyze audio spikes and visual changes to find the most viral moments automatically.</p>
                        <ul>
                            <li><a href="https://www.opus.pro/" target="_blank" class="text-yellow-400 font-bold underline">OpusClip (Opus.pro):</a> The undisputed king of AI clipping for podcasts and talking heads. You paste a 2-hour <i class="fab fa-youtube text-red-500"></i> YouTube link into the dashboard. The AI watches the entire video, identifies the 10 most viral moments based on keyword analysis, cuts them into a vertical 9:16 format, adds dynamic tracking captions (with emojis), and even scores them on a "Viral Likelihood" scale of 1-100. It turns hours of work into 5 minutes.</li>
                            <li><a href="https://katto.video/" target="_blank" class="text-yellow-400 font-bold underline">Katto.video & Vizard.ai:</a> These are exceptional for gaming content. They use facial recognition to automatically track the streamer's face cam, crop it perfectly, place it at the top of the screen, and frame the gameplay beneath it.</li>
                        </ul>

                        <h4>The Manual Masterclass (CapCut Free)</h4>
                        <p>If you have zero budget or want total creative control, CapCut (Desktop or Mobile) is the ultimate tool. Here is the professional editing framework:</p>
                        <ol>
                            <li><strong>Dynamic Captions:</strong> Click "Text" -> "Auto Captions". The default settings are terrible. You must customize them. Use bold, impactful fonts. <strong>The Golden Rule of Captions:</strong> Never have more than 3 to 4 words on the screen at once. If a whole sentence pops up, the viewer feels overwhelmed and won't read it. The words should pop up dynamically exactly as the streamer speaks them, keeping the viewer's eyes locked to the center of the screen.</li>
                            <li><strong>The Jump Cut Philosophy:</strong> Dead air is the enemy of retention. If the streamer pauses to breathe for 1.5 seconds, cut it out. Every 3 to 4 seconds, the video must visually change. Zoom in on the streamer's face during a punchline by 15%. Pan the camera slightly. The human eye needs constant motion to stay engaged.</li>
                            <li><strong>Sound Design and B-Roll:</strong> When the streamer mentions a specific person, place a picture of that person on screen with a "pop" or "whoosh" sound effect. Adding subtle background music (lo-fi or intense suspense music, depending on the mood) underneath the main audio track instantly elevates the production value from amateur to professional.</li>
                            <li><strong>J-Cuts and L-Cuts:</strong> A professional editing technique where the audio of the next clip starts playing a fraction of a second before the video cuts to the next scene. It creates a seamless, addictive flow that stops people from swiping.</li>
                        </ol>`
                    },
                    {
                        title: "Module 4: Global Monetization (Bypassing Regional Restrictions)",
                        content: `
                        <img src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=1200" class="w-full h-64 object-cover rounded-xl mb-6 shadow-lg" alt="Making Money">
                        <h3>Extracting Cash from Your Views</h3>
                        <p>This is the most critical module of the entire masterclass. Generating 10 million views is a fun vanity metric, but it is completely useless if you do not know how to convert those views into hard currency—especially when navigating the banking and platform restrictions present in Iraq and the broader MENA region. Here is exactly how to cash out.</p>

                        <h4>1. The YouTube Partner Program (The Most Reliable Income)</h4>
                        <p>Unlike <i class="fab fa-tiktok text-pink-500"></i> TikTok, which restricts its Creator Rewards Program to a few Western countries, <i class="fab fa-youtube text-red-500"></i> YouTube monetizes creators globally, including the Middle East. This is your primary goal.</p>
                        <ul>
                            <li><strong>The Requirements:</strong> You need 1,000 subscribers and 10 million Shorts views in a 90-day period. With consistent, high-retention clipping, hitting 10 million views is very achievable within 2-3 months.</li>
                            <li><strong>The Payout:</strong> Once accepted, YouTube pays you a portion of the ad revenue generated between your Shorts. They pay via Google AdSense. You can link AdSense directly to a local Iraqi bank account (like Trade Bank of Iraq, Bank of Baghdad, or First Iraqi Bank) via Wire Transfer, or use Western Union in supported setups. This provides stable, monthly US Dollar income.</li>
                        </ul>

                        <h4>2. Snapchat Spotlight (The Hidden Regional Goldmine)</h4>
                        <p>Snapchat is unbelievably popular in Iraq, Saudi Arabia, and the Gulf States. Snapchat has a feature called "Spotlight" (their version of TikTok), and they pay massive monthly bonuses for viral videos to encourage creators to post there.</p>
                        <p>If you clip Arabic streamers (like BanderitaX or Abu Falah) or use AI tools like WhisperX to accurately translate and caption English streamers into Arabic, you can completely dominate Snapchat Spotlight. Snapchat pays directly in "Crystals," which can be converted to cash and withdrawn to regional accounts or Hyperpay.</p>

                        <h4>3. Flipping "US TikTok Accounts" (Fast Cash)</h4>
                        <p>Because you cannot officially join the <i class="fab fa-tiktok text-pink-500"></i> TikTok Creator Rewards Program with an Iraqi IP address or phone number, you use the "Flipping" method. You are building digital real estate.</p>
                        <ul>
                            <li>You grow a niche account (e.g., a dedicated Jynxzi clips page) to 10,000, 50,000, or 100,000 followers. You do not monetize it yourself.</li>
                            <li>You go to marketplace websites like <a href="https://fameswap.com/" target="_blank" class="text-yellow-400 font-bold underline">Fameswap</a>, Swapd, or trusted Telegram escrow communities.</li>
                            <li>You sell the entire account to a buyer in the US or UK who <em>can</em> monetize it. A highly active gaming clip account with 50,000 real followers can easily sell for $300 to $800 USD.</li>
                            <li><strong>The Cashout:</strong> You get paid in Crypto (USDT on the TRC20 network) or via wallets like Payeer/Perfect Money. You can then easily cash out this USDT into physical USD or Iraqi Dinars at any local exchange office (ZainCash agents often facilitate this) in Baghdad, Erbil, or Basra within minutes.</li>
                        </ul>

                        <h4>4. Affiliate Marketing & Sponsorships (Day 1 Revenue)</h4>
                        <p>You do not need to wait for millions of views or 10,000 followers to start making money. You can start monetizing on Day 1 using Affiliate Marketing.</p>
                        <ul>
                            <li>Create a free Linktree and put the link in your bio on all platforms.</li>
                            <li>If you are posting gaming clips, sign up for the Amazon Associates program (or local tech store affiliate programs if available). Put affiliate links to gaming mice, LED lights, or keyboards in your Linktree. Every time a viewer clicks your link and buys, you receive a 5-10% commission.</li>
                            <li><strong>Sound Promotions:</strong> Once your page hits a decent size (e.g., 50k followers), independent music artists will DM you. They will pay you $20-$50 per video simply to use their song as the quiet background music under your streamer clip. You accept the payment via USDT or direct transfer, post the clip as usual, and get paid instantly.</li>
                        </ul>`
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
