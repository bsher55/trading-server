const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// السماح بالاتصال من أي تطبيق أو هاتف
app.use(cors()); 

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// حالة السوق الابتدائية مع سيولة النظام (1000 عملة)
let market = {
    currentPrice: 0.01,
    buyOrders: [],  
    sellOrders: [
        { socketId: 'system', amount: 1000, price: 0.01 }
    ]  
};

const usersWallets = {};

io.on('connection', (socket) => {
    // منح المستخدم رصيد البداية
    usersWallets[socket.id] = { usdt: 50.00, btc: 0.00 };

    socket.emit('balance_update', usersWallets[socket.id]);
    socket.emit('market_update', market);

    socket.on('new_order', (order) => {
        let wallet = usersWallets[socket.id];

        if (order.type === 'buy') {
            let totalCost = order.amount * order.price;
            if (wallet.usdt < totalCost) {
                socket.emit('notification', 'رصيدك USDT غير كافٍ!');
                return;
            }
            wallet.usdt -= totalCost;
            market.buyOrders.push({ socketId: socket.id, amount: order.amount, price: order.price });
            socket.emit('notification', 'تم وضع أمر الشراء');

        } else if (order.type === 'sell') {
            if (wallet.btc < order.amount) {
                socket.emit('notification', 'رصيدك BTC غير كافٍ للبيع!');
                return;
            }
            wallet.btc -= order.amount;
            market.sellOrders.push({ socketId: socket.id, amount: order.amount, price: order.price });
            socket.emit('notification', 'تم وضع أمر البيع');
        }

        socket.emit('balance_update', wallet);
        
        // تمرير نوع الطلب لتحديد لون شمعة الرينكو (أخضر للشراء، أحمر للبيع)
        matchOrders(order.type); 
        io.emit('market_update', market);
    });

    socket.on('disconnect', () => {
        market.buyOrders = market.buyOrders.filter(o => o.socketId !== socket.id);
        market.sellOrders = market.sellOrders.filter(o => o.socketId !== socket.id);
        delete usersWallets[socket.id];
        io.emit('market_update', market);
    });
});

function matchOrders(takerType) {
    market.buyOrders.sort((a, b) => b.price - a.price);
    market.sellOrders.sort((a, b) => a.price - b.price);

    while (market.buyOrders.length > 0 && market.sellOrders.length > 0) {
        let buy = market.buyOrders[0];
        let sell = market.sellOrders[0];

        if (buy.price >= sell.price) {
            let matchedAmount = Math.min(buy.amount, sell.amount);
            let executionPrice = sell.price; 
            
            // السعر يرتفع 0.02 عند الشراء، وينخفض عند البيع (لكل 10 عملات)
            if (matchedAmount >= 10) {
                let increments = Math.floor(matchedAmount / 10);
                if (takerType === 'buy') {
                    market.currentPrice = parseFloat((market.currentPrice + (increments * 0.02)).toFixed(4));
                } else {
                    market.currentPrice = parseFloat((Math.max(0.01, market.currentPrice - (increments * 0.02))).toFixed(4));
                }
            } else {
                market.currentPrice = executionPrice;
            }

            // إرسال تفاصيل المطابقة لرسم شموع الرينكو
            if (matchedAmount >= 10) {
                let renkoBlocks = Math.floor(matchedAmount / 10);
                io.emit('renko_chart_update', { type: takerType, blocks: renkoBlocks, price: market.currentPrice });
            }

            // تحديث محفظة المشتري
            if (usersWallets[buy.socketId]) {
                usersWallets[buy.socketId].btc += matchedAmount;
                let refund = (buy.price - executionPrice) * matchedAmount;
                usersWallets[buy.socketId].usdt += refund;
                io.to(buy.socketId).emit('balance_update', usersWallets[buy.socketId]);
            }

            // تحديث محفظة البائع (أو تحديث سعر النظام)
            if (sell.socketId === 'system') {
                sell.price = market.currentPrice;
            } else if (usersWallets[sell.socketId]) {
                usersWallets[sell.socketId].usdt += (matchedAmount * executionPrice);
                io.to(sell.socketId).emit('balance_update', usersWallets[sell.socketId]);
            }

            buy.amount -= matchedAmount;
            sell.amount -= matchedAmount;

            if (buy.amount === 0) market.buyOrders.shift();
            if (sell.amount === 0) market.sellOrders.shift();
            market.sellOrders.sort((a, b) => a.price - b.price);
        } else {
            break; 
        }
    }
}

// المنفذ (Port) مجهز ليعمل على Railway أو محلياً
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
