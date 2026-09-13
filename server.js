const express = require('express');
const app = express();

// استخدام المنفذ الذي تخصصه منصة Railway تلقائياً، أو منفذ 8080 كخيار احتياطي محلياً
const PORT = process.env.PORT || 8080;

// إعدادات بسيطة (إذا كنت تستخدم ملفات ثابتة أو JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// مسار تجريبي للتأكد أن السيرفر يعمل
app.get('/', (req, res) => {
  res.send('السيرفر يعمل بنجاح!');
});

// تشغيل السيرفر وربطه بـ 0.0.0.0 ليعمل بشكل صحيح على المنصة
app.listen(PORT, '0.0.0.0', () => {
  console.log(`السيرفر يعمل على المنفذ: ${PORT}`);
});
