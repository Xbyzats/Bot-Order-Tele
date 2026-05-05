const mongoose = require('mongoose');
const moment = require('moment');

// 🔥 Koneksi ke MongoDB Atlas (URL diambil dari file .env)
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ DATABASE MONGODB TERKONEKSI AMAN JAYA!'))
    .catch(err => console.error('❌ GAGAL KONEK KE MONGODB:', err));

// ================= SCHEMAS (Struktur Tabel MongoDB) =================
const adminSchema = new mongoose.Schema({ chat_id: { type: String, unique: true } });
const Admin = mongoose.model('Admin', adminSchema);

const userSchema = new mongoose.Schema({ chat_id: { type: String, unique: true } });
const User = mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
    product_id: { type: String, unique: true },
    name: String,
    price: Number,
    description: { type: String, default: 'Deskripsi belum diatur oleh admin.' }
});
const Product = mongoose.model('Product', productSchema);

const stockSchema = new mongoose.Schema({
    product_id: String,
    account_data: String,
    status: { type: String, default: 'AVAILABLE' }
});
const Stock = mongoose.model('Stock', stockSchema);

const orderSchema = new mongoose.Schema({
    order_id: { type: String, unique: true },
    chat_id: String,
    product_id: String,
    base_price: Number,
    unique_code: Number,
    total_price: Number,
    status: { type: String, default: 'PENDING' },
    qr_msg_id: Number,
    created_at: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// ================= ADMIN & USER CRUD =================
const addAdmin = async (chatId) => await Admin.updateOne({ chat_id: chatId }, { chat_id: chatId }, { upsert: true });
const removeAdmin = async (chatId) => await Admin.deleteOne({ chat_id: chatId });
const isAdminId = async (chatId) => !!(await Admin.findOne({ chat_id: chatId }).lean());

const addUser = async (chatId) => await User.updateOne({ chat_id: chatId }, { chat_id: chatId }, { upsert: true });
const getAllUsers = async () => await User.find({}, 'chat_id').lean();

// ================= PRODUCT CRUD =================
const addProduct = async (id, name, price) => await Product.updateOne({ product_id: id }, { product_id: id, name, price }, { upsert: true });
const getProducts = async () => await Product.find().lean();
const editProductDescription = async (id, desc) => await Product.updateOne({ product_id: id }, { description: desc });

// ================= STOCK CRUD (ANTI-DUPLIKAT & TARIK STOK) =================
const addStock = async (id, data) => {
    const exists = await Stock.findOne({ product_id: id, account_data: data });
    if (exists) return false; 
    await Stock.create({ product_id: id, account_data: data });
    return true; 
};
const pullUnsoldStock = async (id) => {
    const stocks = await Stock.find({ product_id: id, status: 'AVAILABLE' }).lean();
    await Stock.deleteMany({ product_id: id, status: 'AVAILABLE' });
    return stocks.map(s => s.account_data);
};

const deleteStock = async (id) => await Stock.findByIdAndDelete(id);
const countStock = async (productId) => await Stock.countDocuments({ product_id: productId, status: 'AVAILABLE' });
const getAvailableStock = async (id) => {
    const stock = await Stock.findOne({ product_id: id, status: 'AVAILABLE' }).lean();
    if (stock) stock.id = stock._id.toString(); 
    return stock;
};
const markStockSold = async (id) => await Stock.findByIdAndUpdate(id, { status: 'SOLD' });

// ================= ORDER & UTILS =================
const createOrder = async (orderId, chatId, productId, basePrice, uniqueCode, qrMsgId) => {
    const total = basePrice + uniqueCode;
    await Order.create({ order_id: orderId, chat_id: chatId, product_id: productId, base_price: basePrice, unique_code: uniqueCode, total_price: total, status: 'PENDING', qr_msg_id: qrMsgId });
    return total;
};

const getPendingOrders = async () => await Order.find({ status: 'PENDING' }).lean();
const updateStatus = async (id, status) => await Order.updateOne({ order_id: id }, { status });
const getUserOrders = async (chatId) => await Order.find({ chat_id: chatId }).sort({ created_at: -1 }).lean();
const getOrderById = async (id, chatId) => await Order.findOne({ order_id: id, chat_id: chatId }).lean();
const checkPending = async (chatId) => await Order.findOne({ chat_id: chatId, status: 'PENDING' }).lean();

const getUnique = async () => {
    const time = moment().subtract(7, 'days').toDate();
    const orders = await Order.find({ created_at: { $gte: time } }, 'unique_code').lean();
    let used = orders.map(r => r.unique_code);
    let code = 1;
    while (used.includes(code)) code++;
    return code;
};

const getRecentSalesCount = async () => {
    const time = moment().subtract(14, 'days').toDate();
    return await Order.countDocuments({ status: 'PAID', created_at: { $gte: time } });
};

module.exports = {
    addAdmin, removeAdmin, isAdminId,
    addUser, getAllUsers,
    addProduct, getProducts, editProductDescription,
    addStock, pullUnsoldStock, deleteStock, countStock, getAvailableStock, markStockSold,
    createOrder, getPendingOrders, updateStatus, getUserOrders, getOrderById, checkPending, 
    getUnique, getRecentSalesCount
};
