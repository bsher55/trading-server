const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// قاعدة بيانات مؤقتة في الذاكرة (تتحدث وتعمل مع الواجهة)
let users = [];

// 1. تسجيل حساب جديد
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'جميع الحقول مطلوبة!' });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً!' });
    }

    const newUser = {
        username,
        email,
        password,
        externalBalance: 0,
        hasPackage: false,
        monthlyYield: 0,
        miningStatus: 'none', // none, pending, approved
        miningStartTime: null,
        pendingDeposit: false
    };

    users.push(newUser);
    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح' });
});

// 2. تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ message: 'البريد أو كلمة المرور غير صحيحة!' });
    }

    res.json({ message: 'تم تسجيل الدخول بنجاح', user });
});

// 3. طلب إيداع جديد
app.post('/api/user/deposit-request', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
        user.pendingDeposit = true;
        return res.json({ message: 'تم إرسال طلب الإيداع' });
    }
    res.status(404).json({ message: 'المستخدم غير موجود' });
});

// 4. شراء باقة تعدين
app.post('/api/user/buy-package', (req, res) => {
    const { email, externalBalance, hasPackage, monthlyYield } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
        user.externalBalance = externalBalance;
        user.hasPackage = hasPackage;
        user.monthlyYield = monthlyYield;
        return res.json({ message: 'تم تحديث الباقة بنجاح' });
    }
    res.status(404).json({ message: 'المستخدم غير موجود' });
});

// 5. طلب تشغيل التعدين
app.post('/api/user/mining-request', (req, res) => {
    const { email, miningStatus } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
        user.miningStatus = miningStatus;
        return res.json({ message: 'تم إرسال طلب التعدين' });
    }
    res.status(404).json({ message: 'المستخدم غير موجود' });
});

// --- لوحة التحكم (الأدمن) ---

// جلب جميع المستخدمين للأدمن
app.get('/api/admin/users', (req, res) => {
    res.json(users);
});

// الموافقة على شحن رصيد الإيداع
app.post('/api/admin/deposit', (req, res) => {
    const { email, amount } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
        user.externalBalance = (user.externalBalance || 0) + amount;
        user.pendingDeposit = false;
        return res.json({ message: 'تم شحن الرصيد بنجاح' });
    }
    res.status(404).json({ message: 'المستخدم غير موجود' });
});

// الموافقة على تشغيل التعدين
app.post('/api/admin/approve-mining', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (user) {
        user.miningStatus = 'approved';
        user.miningStartTime = Date.now();
        return res.json({ message: 'تمت الموافقة على التعدين' });
    }
    res.status(404).json({ message: 'المستخدم غير موجود' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
