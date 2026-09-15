const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_FILE = path.join(__dirname, 'users.json');

// قراءة بيانات المستخدمين
function getUsers() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// حفظ بيانات المستخدمين
function saveUsers(users) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
}

// 1. تسجيل / دخول
app.post('/api/auth', (req, res) => {
    const { isRegister, username, email, pass } = req.body;
    let users = getUsers();

    if (isRegister) {
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'البريد مسجل مسبقاً!' });
        }
        const newUser = { username, email, pass, avatar: '', balance: 0.00, banned: false };
        users.push(newUser);
        saveUsers(users);
        return res.json({ success: true, user: newUser });
    } else {
        const user = users.find(u => u.email === email && u.pass === pass);
        if (!user) return res.status(400).json({ error: 'البيانات غير صحيحة!' });
        if (user.banned) return res.status(403).json({ error: 'هذا الحساب محظور!' });
        return res.json({ success: true, user });
    }
});

// 2. تحديث صورة أو بيانات الملف الشخصي
app.post('/api/user/update', (req, res) => {
    const { email, avatar, balance } = req.body;
    let users = getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx !== -1) {
        if (avatar !== undefined) users[idx].avatar = avatar;
        if (balance !== undefined) users[idx].balance = balance;
        saveUsers(users);
        return res.json({ success: true, user: users[idx] });
    }
    res.status(404).json({ error: 'المستخدم غير موجود' });
});

// 3. جلب جميع المستخدمين للأدمن
app.get('/api/admin/users', (req, res) => {
    res.json(getUsers());
});

// 4. إضافة رصيد عن بعد (من الأدمن)
app.post('/api/admin/add-money', (req, res) => {
    const { email, amount } = req.body;
    let users = getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx !== -1) {
        users[idx].balance += parseFloat(amount);
        saveUsers(users);
        return res.json({ success: true, users });
    }
    res.status(404).json({ error: 'المستخدم غير موجود' });
});

// 5. حظر / فك حظر من الأدمن
app.post('/api/admin/toggle-ban', (req, res) => {
    const { email } = req.body;
    let users = getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx !== -1) {
        users[idx].banned = !users[idx].banned;
        saveUsers(users);
        return res.json({ success: true, users });
    }
    res.status(404).json({ error: 'المستخدم غير موجود' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
