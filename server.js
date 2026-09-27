const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

// قواعد البيانات المؤقتة في الذاكرة (يمكن استبدالها بقاعدة بيانات لاحقاً مثل MongoDB أو PostgreSQL)
let db = {
    users: [],
    deposits: []
};

// جلب كافة البيانات (المستخدمين والطلبات)
app.get('/api/data', (req, res) => {
    res.json(db);
});

// مزامنة وتحديث البيانات بالكامل من العميل أو حفظها
app.post('/api/sync', (req, res) => {
    const { users, deposits } = req.body;
    if (users) db.users = users;
    if (deposits) db.deposits = deposits;
    res.json({ success: true, message: 'تم تحديث البيانات وحفظها على السيرفر بنجاح', db });
});

// نقطة اختبار للتحقق من عمل السيرفر
app.get('/', (req, res) => {
    res.send('Box Lite Trading Server is running successfully! 🚀');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
