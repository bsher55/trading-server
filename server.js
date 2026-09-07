const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ربط مباشر بقاعدة البيانات داخل شبكة Railway لتفادي أي خطأ
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_PRIVATE_URL || process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح!'))
    .catch(err => console.error('خطأ الاتصال:', err));

// --- الهياكل (Schemas) ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: null },
    balance: { type: Number, default: 0.00 }
});

const depositRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userEmail: String,
    amount: Number,
    receiptImage: String,
    status: { type: String, default: 'قيد الانتظار' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);

// --- المسارات (Routes) ---

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email.endsWith('@gmail.com')) {
            return res.status(400).json({ message: 'يجب استخدام بريد ينتهي بـ @gmail.com' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً' });
        }
        const newUser = new User({ name, email, password });
        await newUser.save();
        res.status(201).json({ success: true, message: 'تم إنشاء الحساب بنجاح' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (!user) {
            return res.status(400).json({ message: 'البيانات غير صحيحة أو الحساب غير موجود' });
        }
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                balance: user.balance
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        await User.findByIdAndUpdate(userId, { avatar });
        res.json({ success: true, message: 'تم تحديث الصورة' });
    } catch (err) {
        res.status(500).json({ message: 'فشل تحديث الصورة' });
    }
});

app.post('/api/deposit/request', async (req, res) => {
    try {
        const { userId, userName, userEmail, amount, receiptImage } = req.body;
        const newRequest = new DepositRequest({
            userId, userName, userEmail, amount: parseFloat(amount), receiptImage
        });
        await newRequest.save();
        res.json({ success: true, message: 'تم تسجيل طلب الشحن' });
    } catch (err) {
        res.status(500).json({ message: 'فشل تسجيل الطلب' });
    }
});

app.get('/api/admin/dashboard-data', async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        const requests = await DepositRequest.find().sort({ createdAt: -1 });
        res.json({ users, requests });
    } catch (err) {
        res.status(500).json({ message: 'فشل جلب بيانات اللوحة' });
    }
});

app.post('/api/admin/update-balance', async (req, res) => {
    try {
        const { userId, amountToAdd } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
        user.balance += parseFloat(amountToAdd);
        await user.save();
        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ message: 'فشل تحديث الرصيد' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ: ${PORT}`);
});
