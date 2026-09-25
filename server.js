const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// حالة السوق الابتدائية مع سيولة النظام (1000 عملة)
let market = {
    currentPrice: 0.01,
    buyOrders: [],  
    sellOrders: [
        // النظام يضع 1000 عملة كبائع أولي لتوفير السيولة
        { socketId: 'system', amount: 1000, price: 0.01 }
    ]  
};

const usersWallets = {};

io.on('connection', (socket) => {
    // منح المستخدم رصيد البداية
    usersWallets[socket.id] = { usdt: 50.00, btc: 0.00 };

    // إرسال الرصيد وحالة السوق للمتصل الجديد
    socket.emit('balance_update', usersWallets[socket.id]);
    socket.emit('market_update', market);

    // استقبال الطلبات
    socket.on('new_order', (order) => {
        let wallet = usersWallets[socket.id];

        if (order.type === 'buy') {
            let totalCost = order.amount * order.price;
            if (wallet.usdt < totalCost) {
                socket.emit('notification', 'رصيدك USDT غير كافٍ!');
                return;
            }
            // تجميد الرصيد
            wallet.usdt -= totalCost;
            market.buyOrders.push({ socketId: socket.id, amount: order.amount, price: order.price });
            socket.emit('notification', 'تم وضع أمر الشراء في السوق');

        } else if (order.type === 'sell') {
            if (wallet.btc < order.amount) {
                socket.emit('notification', 'رصيدك BTC غير كافٍ للبيع!');
                return;
            }
            // تجميد العملة
            wallet.btc -= order.amount;
            market.sellOrders.push({ socketId: socket.id, amount: order.amount, price: order.price });
            socket.emit('notification', 'تم وضع أمر البيع بانتظار مشتري حقيقي');
        }

        // إرسال تحديث الرصيد بعد التجميد
        socket.emit('balance_update', wallet);

        // محاولة المطابقة
        matchOrders();

        // تحديث السوق للجميع
        io.emit('market_update', market);
    });

    socket.on('disconnect', () => {
        // تنظيف أوامر المستخدم عند الخروج
        market.buyOrders = market.buyOrders.filter(o => o.socketId !== socket.id);
        market.sellOrders = market.sellOrders.filter(o => o.socketId !== socket.id);
        delete usersWallets[socket.id];
        io.emit('market_update', market);
    });
});

function matchOrders() {
    market.buyOrders.sort((a, b) => b.price - a.price); // الأعلى سعراً أولاً
    market.sellOrders.sort((a, b) => a.price - b.price); // الأقل سعراً أولاً

    while (market.buyOrders.length > 0 && market.sellOrders.length > 0) {
        let buy = market.buyOrders[0];
        let sell = market.sellOrders[0];

        // هل السعر متطابق؟ (المشتري يدفع مساوٍ أو أكثر من البائع)
        if (buy.price >= sell.price) {
            let matchedAmount = Math.min(buy.amount, sell.amount);
            let executionPrice = sell.price; 
            
            // القاعدة: السعر يرتفع 0.02 لكل 10 عملات مباعة
            if (matchedAmount >= 10) {
                let increments = Math.floor(matchedAmount / 10);
                market.currentPrice = parseFloat((market.currentPrice + (increments * 0.02)).toFixed(4));
            } else {
                market.currentPrice = executionPrice;
            }

            // تحديث رصيد المشتري الحقيقي
            if (usersWallets[buy.socketId]) {
                usersWallets[buy.socketId].btc += matchedAmount;
                // إعادة الفائض من الـ USDT للمشتري إن كان سعر التنفيذ أقل مما طلبه
                let refund = (buy.price - executionPrice) * matchedAmount;
                usersWallets[buy.socketId].usdt += refund;
                
                io.to(buy.socketId).emit('balance_update', usersWallets[buy.socketId]);
                io.to(buy.socketId).emit('notification', `اكتمل شراء ${matchedAmount} BTC!`);
            }

            // تحديث البائع (سواء كان النظام أو مستخدم حقيقي)
            if (sell.socketId === 'system') {
                // إذا كان البائع هو النظام، نُحدث سعر الكمية المتبقية لديه لتواكب ارتفاع السوق
                sell.price = market.currentPrice;
            } else if (usersWallets[sell.socketId]) {
                usersWallets[sell.socketId].usdt += (matchedAmount * executionPrice);
                io.to(sell.socketId).emit('balance_update', usersWallets[sell.socketId]);
                io.to(sell.socketId).emit('notification', `اكتمل بيع ${matchedAmount} BTC!`);
            }

            // تحديث الرسم البياني لدى الجميع
            io.emit('trade_executed_chart', { price: market.currentPrice, amount: matchedAmount });

            buy.amount -= matchedAmount;
            sell.amount -= matchedAmount;

            // إزالة الأوامر المكتملة
            if (buy.amount === 0) market.buyOrders.shift();
            if (sell.amount === 0) market.sellOrders.shift();

            // إعادة ترتيب دفتر البيع في حال تغير سعر النظام
            market.sellOrders.sort((a, b) => a.price - b.price);
        } else {
            break; // لا يوجد تطابق بالأسعار
        }
    }
}

server.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on port 3000');
});
