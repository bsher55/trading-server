const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// قاعدة البيانات الموقعة في الذاكرة
let users = [];
let depositRequests = []; // مصفوفة طلبات الإيداع

// 1. مسار تسجيل الدخول / إنشاء حساب
app.post('/api/auth', (req, res) => {
    const { isRegister, username, email, pass } = req.body;

    if (!username || !email || !pass) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (!email.endsWith('@gmail.com')) {
        return res.status(400).json({ error: 'يجب أن ينتهي البريد بـ @gmail.com' });
    }

    let user = users.find(u => u.email === email);

    if (isRegister) {
        if (user) {
            return res.status(400).json({ error: 'المستخدم موجود بالفعل' });
        }
        user = { username, email, pass, balance: 0, avatar: '', banned: false };
        users.push(user);
    } else {
        if (!user || user.pass !== pass) {
            return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
        }
        if (user.banned) {
            return res.status(403).json({ error: 'هذا الحساب محظور من قبل الإدارة' });
        }
    }

    res.json({ success: true, user });
});

// 2. تحديث بيانات المستخدم (الرصيد / الصور)
app.post('/api/user/update', (req, res) => {
    const { email, balance, avatar } = req.body;
    let user = users.find(u => u.email === email);
    if (user) {
        if (balance !== undefined) user.balance = parseFloat(balance);
        if (avatar !== undefined) user.avatar = avatar;
        return res.json({ success: true, user });
    }
    res.status(404).json({ error: 'المستخدم غير موجود' });
});

// 3. استقبال طلب إيداع تلقائياً وحفظه في السيرفر
app.post('/api/deposit-request', (req, res) => {
    const { username, email, amount } = req.body;

    if (!username || !amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'مبلغ الإيداع غير صالح' });
    }

    const newRequest = {
        id: Date.now(),
        username,
        email,
        amount: parseFloat(amount),
        status: 'pending',
        time: new Date().toLocaleString('ar-EG')
    };

    depositRequests.push(newRequest);

    res.json({ success: true, message: 'تم إرسال الطلب بنجاح إلى لوحة التحكم' });
});

// 4. لوحة الأدمن: جلب بيانات الأدمن الشاملة (المستخدمين + إجمالي أموال المنصة + طلبات الإيداع)
app.get('/api/admin/data', (req, res) => {
    // حساب إجمالي أموال المنصة كلياً
    const totalPlatformMoney = users.reduce((sum, u) => sum + (parseFloat(u.balance) || 0), 0);
    
    res.json({
        users,
        depositRequests,
        totalPlatformMoney
    });
});

// 5. لوحة الأدمن: المعالجة المباشرة لطلب الإيداع (قبول أو رفض)
app.post('/api/admin/handle-deposit', (req, res) => {
    const { requestId, action } = req.body; // action: 'approve' or 'reject'
    
    const requestIndex = depositRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    const request = depositRequests[requestIndex];

    if (action === 'approve') {
        let user = users.find(u => u.email === request.email);
        if (user) {
            user.balance = (parseFloat(user.balance) || 0) + parseFloat(request.amount);
        }
        depositRequests.splice(requestIndex, 1); // حذف الطلب بعد الموافقة
        return res.json({ success: true, message: 'تمت الموافقة وإضافة الرصيد للمستخدم' });
    } else if (action === 'reject') {
        depositRequests.splice(requestIndex, 1); // حذف الطلب عند الرفض
        return res.json({ success: true, message: 'تم رفض الطلب' });
    }

    res.status(400).json({ error: 'جراء غير صالح' });
});

// 6. لوحة الأدمن: إضافة رصيد يدوياً
app.post('/api/admin/add-money', (req, res) => {
    const { email, amount } = req.body;
    let user = users.find(u => u.email === email);
    if (user) {
        user.balance = (parseFloat(user.balance) || 0) + parseFloat(amount);
        return res.json({ success: true, user });
    }
    res.status(404).json({ error: 'المستخدم غير موجود' });
});

// 7. لوحة الأدمن: حظر / فك حظر
app.post('/api/admin/toggle-ban', (req, res) => {
    const { email } = req.body;
    let user = users.find(u => u.email === email);
    if (user) {
        user.banned = !user.banned;
        return res.json({ success: true, user });
    }
    res.status(404).json({ error: 'المستخدم غير موجود' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل بنجاح على البورت ${PORT}`));
