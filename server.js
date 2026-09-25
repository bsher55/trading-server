const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// بيانات السوق الابتدائية
let market = {
    currentPrice: 0.01,
    totalBought: 0,
    buyOrders: [],  // طلبات الشراء الحقيقية
    sellOrders: []  // طلبات البيع الحقيقية
};

// تخزين أرصدة المستخدمين المتصلين حسب معرف السوكيت (لأغراض العرض التوضيحي الحقيقي)
const usersWallets = {};

io.on('connection', (socket) => {
    // إعطاء كل مستخدم جديد محفظة فيها 50 USDT
    usersWallets[socket.id] = { usdt: 50.00, btc: 0.00 };

    // إرسال حالة السوق الحالية للمستخدم الجديد
    socket.emit('market_update', market);

    // استقبال طلب جديد (شراء أو بيع)
    socket.on('new_order', (order) => {
        let wallet = usersWallets[socket.id];

        if (order.type === 'buy') {
            let totalCost = order.amount * order.price;
            if (wallet.usdt < totalCost) {
                socket.emit('error_msg', 'رصيدك لا يكفي!');
                return;
            }

            // خصم الرصيد مؤقتاً أو إضافته لدفتر الأوامر للمطابقة
            wallet.usdt -= totalCost;
            market.buyOrders.push({ socketId: socket.id, amount: order.amount, price: order.price });
            
        } else if (order.type === 'sell') {
            if (wallet.btc < order.amount) {
                socket.emit('error_msg', 'لا تملك رصيد كافي من العملة للبيع!');
                return;
            }

            wallet.btc -= order.amount;
            market.sellOrders.push({ socketId: socket.id, amount: order.amount, price: order.price });
        }

        // محرك المطابقة الحقيقي (Matching Engine)
        matchOrders();

        // تحديث الجميع بحالة السوق وأدفتر الأوامر
        io.emit('market_update', market);
        
        // تحديث محفظة المستخدم الحالي
        socket.emit('trade_executed', {
            type: order.type,
            amount: order.amount,
            newUsdt: wallet.usdt,
            newBtc: wallet.btc
        });
    });

    socket.on('disconnect', () => {
        delete usersWallets[socket.id];
    });
});

// دالة المطابقة الحقيقية بين أوامر الشراء والبيع
function matchOrders() {
    // ترتيب الطلبات (الأعلى سعراً للشراء والأقل سعراً للبيع)
    market.buyOrders.sort((a, b) => b.price - a.price);
    market.sellOrders.sort((a, b) => a.price - b.price);

    while (market.buyOrders.length > 0 && market.sellOrders.length > 0) {
        let buy = market.buyOrders[0];
        let sell = market.sellOrders[0];

        // إذا توافق سعر الشراء مع البيع (أو زاد عنه) تتم الصفقة
        if (buy.price >= sell.price) {
            let matchedAmount = Math.min(buy.amount, sell.amount);

            // تطبيق شرط الشراء المذكور: كل عملية شراء 10 عملات ترتفع بنسبة 0.02
            if (matchedAmount >= 10) {
                let increments = Math.floor(matchedAmount / 10);
                market.currentPrice = parseFloat((market.currentPrice + (increments * 0.02)).toFixed(4));
                market.totalBought += matchedAmount;
            }

            // تحديث أرصدة الأطراف الحقيقية المشاركة في الصفقة
            if (usersWallets[buy.socketId]) {
                usersWallets[buy.socketId].btc += matchedAmount;
            }
            if (usersWallets[sell.socketId]) {
                usersWallets[sell.socketId].usdt += (matchedAmount * sell.price);
            }

            // خصم الكميات أو مسح الطلبات المكتملة
            buy.amount -= matchedAmount;
            sell.amount -= matchedAmount;

            if (buy.amount === 0) market.buyOrders.shift();
            if (sell.amount === 0) market.sellOrders.shift();
        } else {
            break; // لا يوجد تطابق بالأسعار
        }
    }
}

server.listen(3000, () => {
    console.log('المنصة شغالة الآن على الرابط: http://localhost:3000');
});
