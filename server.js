const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // لدعم رفع الصور الكبيرة (Avatar)

// إنشاء قاعدة البيانات المحلية
const db = new sqlite3.Database('./trading_platform.db', (err) => {
    if (err) console.error('خطأ في الاتصال بقاعدة البيانات', err.message);
    else console.log('تم الاتصال بقاعدة بيانات SQLite بنجاح.');
});

// إنشاء جدول المستخدمين
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    email TEXT UNIQUE,
    pass TEXT,
    avatar TEXT,
    balance REAL DEFAULT 0.00,
    banned INTEGER DEFAULT 0
)`);

// تسجيل الدخول أو إنشاء حساب
app.post('/api/auth', (req, res) => {
    const { username, email, pass, mode } = req.body;
    
    if (!email || !pass) {
        return res.json({ success: false, message: 'الرجاء إدخال البريد وكلمة السر' });
    }

    if (mode === 'register') {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
            if (row) {
                return res.json({ success: false, message: 'هذا البريد مسجل مسبقاً!' });
            }
            db.run(`INSERT INTO users (username, email, pass, avatar, balance, banned) VALUES (?, ?, ?, ?, 0.00, 0)`,
                [username || 'مستخدم', email, pass, ''], function(err) {
                    if (err) return res.json({ success: false, message: 'خطأ في إنشاء الحساب' });
                    db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (err, newUser) => {
                        res.json({ success: true, user: newUser });
                    });
                });
        });
    } else {
        db.get(`SELECT * FROM users WHERE email = ? AND pass = ?`, [email, pass], (err, user) => {
            if (!user) {
                return res.json({ success: false, message: 'البيانات غير صحيحة أو الحساب غير موجود!' });
            }
            if (user.banned === 1) {
                return res.json({ success: false, message: 'هذا الحساب محظور من الإدارة!' });
            }
            res.json({ success: true, user });
        });
    }
});

// تحديث بيانات المستخدم (مثل الصورة أو الرصيد الشخصي)
app.post('/api/update-user', (req, res) => {
    const { email, avatar, balance } = req.body;
    db.run(`UPDATE users SET avatar = COALESCE(?, avatar), balance = COALESCE(?, balance) WHERE email = ?`,
        [avatar, balance, email], function(err) {
            if (err) return res.json({ success: false });
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
                res.json({ success: true, user });
            });
        });
});

// جلب كل المستخدمين (خاص بلوحة الأدمن)
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT id, username, email, balance, banned FROM users`, [], (err, rows) => {
        if (err) return res.json({ success: false, users: [] });
        res.json({ success: true, users: rows });
    });
});

// تعديل رصيد المستخدم أو حظره من قبل الأدمن (عن بعد)
app.post('/api/admin/action', (req, res) => {
    const { userId, action, amount } = req.body;
    
    if (action === 'add_money') {
        db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, userId], function(err) {
            res.json({ success: !err });
        });
    } else if (action === 'toggle_ban') {
        db.get(`SELECT banned FROM users WHERE id = ?`, [userId], (err, row) => {
            if (row) {
                const newBanState = row.banned === 1 ? 0 : 1;
                db.run(`UPDATE users SET banned = ? WHERE id = ?`, [newBanState, userId], function(err) {
                    res.json({ success: !err });
                });
            } else {
                res.json({ success: false });
            }
        });
    }
});

app.listen(3000, () => {
    console.log('السيرفر يعمل على المنفذ 3000: http://localhost:3000');
});
