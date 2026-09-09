const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_PRIVATE_URL || process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح!'))
    .catch(err => console.error('خطأ الاتصال:', err));

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    balance: { type: Number, default: 0.00 },
    isBanned: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) return res.status(400).json({ success: false, message: 'البيانات غير صحيحة' });
        if (user.isBanned) return res.status(403).json({ success: false, message: 'هذا الحساب محظور!' });

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
});

// تحديث الصورة الشخصية
app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        const user = await User.findByIdAndUpdate(userId, { avatar }, { new: true });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'فشل تحديث الصورة' });
    }
});

// تحديث الرصيد بعد إغلاق الصفقة
app.post('/api/user/update-balance', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

        user.balance += parseFloat(amount);
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ success: false, message: 'فشل تحديث الرصيد' });
    }
});

// بيانات الأدمن
app.get('/api/admin/dashboard-data', async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: 'فشل جلب البيانات' });
    }
});

// إضافة رصيد حظر من الأدمن
app.post('/api/admin/add-balance', async (req, res) => {
    try {
        const { userId, amount } = req.body;
        const user = await User.findById(userId);
        user.balance += parseFloat(amount);
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/toggle-ban', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        user.isBanned = !user.isBanned;
        await user.save();
        res.json({ success: true, isBanned: user.isBanned });
    } catch (err) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`السيرفر يعمل على المنفذ: ${PORT}`));
