require('dotenv').config();
const axios = require('axios');
const moment = require('moment');
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🔥 ROLE-BASED ACCESS CONTROL (Kasta Super Admin vs Admin)
const SUPER_ADMIN = process.env.ADMIN_ID;
const isSuperAdmin = (ctx) => ctx.from.id.toString() === SUPER_ADMIN;
const checkAdmin = async (ctx) => {
    if (isSuperAdmin(ctx)) return true;
    return await db.isAdminId(ctx.from.id.toString());
};

// ================= CONFIG & CACHE =================
let productCache = [];
const loadProducts = async () => { productCache = await db.getProducts(); };
loadProducts();
setInterval(loadProducts, 30000);

const processedMutations = new Set();
const MAIN_MENU_TEXT = "✨ 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐕𝐈𝐏 𝐒𝐓𝐎𝐑𝐄 ✨\n\nSelamat datang di layanan otomatis kami. Proses instan, 24/7 tanpa ribet.\n\n👇 Pilih menu navigasi di bawah ini:";

const menu = () => Markup.keyboard([
    ['🛒 Katalog Produk', '📊 Status Pesanan'],
    ['🧾 Riwayat Transaksi']
]).resize();

bot.start(async ctx => {
    await db.addUser(ctx.from.id.toString());
    ctx.reply(MAIN_MENU_TEXT, menu());
});

bot.command('menu', async ctx => {
    await db.addUser(ctx.from.id.toString());
    ctx.reply(MAIN_MENU_TEXT, menu());
});

// ================= KASTA SUPER ADMIN (Hak Cipta Owner) =================
bot.command('addadmin', async ctx => {
    if (!isSuperAdmin(ctx)) return ctx.reply("❌ Cuma Owner yang bisa nambahin Admin!");
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Format: `/addadmin <ID_TELEGRAM>`", { parse_mode: 'Markdown' });
    await db.addAdmin(args[1]);
    ctx.reply(`✅ ID ${args[1]} resmi diangkat jadi Admin.`);
});

bot.command('removeadmin', async ctx => {
    if (!isSuperAdmin(ctx)) return ctx.reply("❌ Cuma Owner yang bisa mencabut akses Admin!");
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Format: `/removeadmin <ID_TELEGRAM>`", { parse_mode: 'Markdown' });
    await db.removeAdmin(args[1]);
    ctx.reply(`✅ Akses admin untuk ID ${args[1]} berhasil dicabut.`);
});

// ================= KASTA ADMIN (Manajemen Produk & Stok) =================
bot.command('admin', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    ctx.reply("🛠 **ADMIN PANEL**", Markup.inlineKeyboard([
        [Markup.button.callback('📦 Cek Semua Stok', 'ADM_CEKSTOK')],
        [Markup.button.callback('➕ Panduan Perintah', 'ADM_PANDUAN')]
    ]));
});

bot.action('ADM_CEKSTOK', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    let text = "📋 **LAPORAN STOK GUDANG:**\n\n";
    for (let p of productCache) {
        const s = await db.countStock(p.product_id);
        text += `🔹 **${p.product_id}** | Sisa: ${s} akun\n`;
    }
    ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('🔙 Kembali ke Panel', 'ADM_BACK')]]));
});

bot.action('ADM_PANDUAN', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    ctx.editMessageText(
        "📝 **PANDUAN ADMIN (V4 - PRO)**\n\n" +
        "1️⃣ **Produk Baru:** `/addproduct <ID> <HARGA> <NAMA>`\n" +
        "2️⃣ **Ubah Harga:** `/setprice <ID> <HARGA_BARU>`\n" +
        "3️⃣ **Deskripsi:** `/editdeskripsi <ID> <TEKS PANJANG>`\n" +
        "4️⃣ **Upload Stok (.txt):** Kirim file TXT, isi Caption dgn ID Produk. Sistem Anti-Duplikat otomatis aktif!\n" +
        "5️⃣ **Kirim Manual:** `/send <ID_PRODUK> <JUMLAH> <ID_USER>`\n" +
        "6️⃣ **Tarik Stok Gagal:** `/removestock <ID_PRODUK>`\n" +
        "7️⃣ **Broadcast:** `/broadcast <PESAN>`",
        { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard([[Markup.button.callback('🔙 Kembali ke Panel', 'ADM_BACK')]]).reply_markup }
    );
});

bot.action('ADM_BACK', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    ctx.editMessageText("🛠 **ADMIN PANEL**", Markup.inlineKeyboard([
        [Markup.button.callback('📦 Cek Semua Stok', 'ADM_CEKSTOK')],
        [Markup.button.callback('➕ Panduan Perintah', 'ADM_PANDUAN')]
    ]));
});

bot.command(['addproduct', 'addproduk'], async ctx => {
    if (!(await checkAdmin(ctx))) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 4) return ctx.reply("Format: `/addproduct <ID> <HARGA> <NAMA>`", { parse_mode: 'Markdown' });
    await db.addProduct(args[1], args.slice(3).join(' '), parseInt(args[2]));
    await loadProducts();
    ctx.reply(`✅ **Produk ditambahkan!** Jangan lupa set deskripsi pakai /editdeskripsi`);
});

bot.command(['setprice', 'editharga'], async ctx => {
    if (!(await checkAdmin(ctx))) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Format: `/setprice <ID> <HARGA_BARU>`", { parse_mode: 'Markdown' });
    const p = productCache.find(x => x.product_id === args[1]);
    if (!p) return ctx.reply("❌ Produk tidak ditemukan.");
    await db.addProduct(args[1], p.name, parseInt(args[2]));
    await loadProducts();
    ctx.reply(`✅ **Harga diubah menjadi Rp${args[2]}!**`);
});

bot.command('editdeskripsi', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Format: `/editdeskripsi <ID> <Deskripsi panjang lu...>`", { parse_mode: 'Markdown' });
    const id = args[1];
    const desc = args.slice(2).join(' ');
    const p = productCache.find(x => x.product_id === id);
    if (!p) return ctx.reply("❌ Produk tidak ditemukan.");
    
    await db.editProductDescription(id, desc);
    await loadProducts();
    ctx.reply(`✅ **Deskripsi untuk ${p.name} berhasil diubah!**`);
});

// 🔥 EKSEKUTOR MANUAL & PENGIRIMAN FILE (.TXT)
bot.command('send', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 4) return ctx.reply("Format: `/send <ID_PRODUK> <JUMLAH> <ID_USER>`", { parse_mode: 'Markdown' });
    
    const pId = args[1];
    const qty = parseInt(args[2]);
    const targetUser = args[3];

    if (isNaN(qty) || qty < 1) return ctx.reply("⚠️ Jumlah harus angka valid.");
    const p = productCache.find(x => x.product_id === pId);
    if (!p) return ctx.reply("❌ Produk tidak ditemukan di Katalog.");

    const stockCount = await db.countStock(pId);
    if (stockCount < qty) return ctx.reply(`❌ Stok tidak cukup! Sisa stok gudang: **${stockCount}**`, { parse_mode: 'Markdown' });

    ctx.reply(`⏳ Sedang membungkus ${qty} akun untuk dikirim...`);

    let accountsText = "";
    for(let i=0; i < qty; i++) {
        const currentStock = await db.getAvailableStock(pId);
        if(currentStock) {
            await db.markStockSold(currentStock.id); // 🔥 Atomic safety via Mongoose ID Update
            accountsText += `${currentStock.account_data}\n`;
        }
    }

    try {
        const buffer = Buffer.from(accountsText, 'utf-8');
        // Kirim file ke Pembeli
        await bot.telegram.sendDocument(targetUser, 
            { source: buffer, filename: `VIP_ORDER_${pId}.txt` }, 
            { caption: `🎉 **PESANAN BERHASIL (MANUAL)**\n\n📦 Produk: ${p.name}\n🔢 Jumlah: ${qty} Akun\n\n_Buka file di atas untuk melihat detail akun kamu._\nTerima kasih telah berbelanja!`, parse_mode: 'Markdown' }
        );
        
        ctx.reply(`✅ Berhasil mengirim file stok ke pembeli (ID: ${targetUser})`);

        // CC Histori ke Super Owner kalau yang ngirim adalah Sub-Admin
        if (!isSuperAdmin(ctx)) {
            bot.telegram.sendDocument(SUPER_ADMIN, 
                { source: buffer, filename: `BACKUP_SEND_${pId}.txt` }, 
                { caption: `🚨 **LOG MANUAL SEND**\nAdmin ID: \`${ctx.from.id}\`\nMengirim ${qty} ${p.name} ke User: \`${targetUser}\``, parse_mode: 'Markdown' }
            ).catch(()=>{});
        }
    } catch (e) {
        ctx.reply(`❌ GAGAL MENGIRIM! Pastikan ID Pembeli valid dan pembeli tidak memblokir bot ini.`);
    }
});

// 🔥 PENARIKAN STOK GUDANG 
bot.command('removestock', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Format: `/removestock <ID_PRODUK>`", { parse_mode: 'Markdown' });
    
    const pId = args[1];
    ctx.reply(`⏳ Menarik semua stok AVAILABLE untuk ${pId}...`);
    
    const data = await db.pullUnsoldStock(pId);
    if (data.length === 0) return ctx.reply(`⚠️ Tidak ada stok tersedia untuk ${pId} saat ini.`);

    const buffer = Buffer.from(data.join('\n'), 'utf-8');
    await ctx.replyWithDocument(
        { source: buffer, filename: `RECOVERY_${pId}.txt` }, 
        { caption: `✅ **TARIK STOK BERHASIL**\nBerhasil menarik dan menghapus **${data.length}** baris stok dari database.`, parse_mode: 'Markdown' }
    );
});

bot.command('broadcast', async ctx => {
    if (!(await checkAdmin(ctx))) return;
    const message = ctx.message.text.substring(10).trim(); 
    if (!message) return ctx.reply("⚠️ Format: `/broadcast <Pesan promo lu...>`", { parse_mode: 'Markdown' });

    const users = await db.getAllUsers();
    if (users.length === 0) return ctx.reply("❌ Belum ada user yang tersimpan di database.");

    ctx.reply(`⏳ Sedang mengirim pesan broadcast ke **${users.length}** pengguna...`, { parse_mode: 'Markdown' });
    let success = 0, failed = 0;

    for (let u of users) {
        try {
            await bot.telegram.sendMessage(u.chat_id, `📢 **INFO VIP STORE**\n\n${message}`, { parse_mode: 'Markdown' });
            success++;
        } catch (e) { failed++; }
        await new Promise(r => setTimeout(r, 100)); 
    }
    ctx.reply(`✅ **Broadcast Selesai!**\nBerhasil terkirim: ${success} user\nGagal (Block/Hapus Akun): ${failed} user`, { parse_mode: 'Markdown' });
});

// 🔥 SMART UPLOAD (.TXT) DENGAN FILTER DUPLIKAT
bot.on('document', async (ctx) => {
    if (!(await checkAdmin(ctx))) return;
    const doc = ctx.message.document;
    const caption = ctx.message.caption; 
    if (!caption) return ctx.reply("⚠️ Isi caption dengan ID Produk.");
    if (!doc.file_name.endsWith('.txt')) return ctx.reply("⚠️ Hanya menerima file .txt");

    try {
        ctx.reply(`⏳ Mengekstrak & Memfilter duplikat untuk **${caption}**...`, { parse_mode: 'Markdown' });
        const fileUrl = await ctx.telegram.getFileLink(doc.file_id);
        const res = await axios.get(fileUrl.href);
        const lines = res.data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let countNew = 0;
        let countDup = 0;
        
        for (let line of lines) { 
            const isAdded = await db.addStock(caption, line); 
            if (isAdded) countNew++; else countDup++;
        }
        
        ctx.reply(`✅ **INVENTARIS DIPERBARUI!**\n\n📦 Produk: ${caption}\n🟢 Stok Baru Masuk: **${countNew}**\n🔴 Ditolak (Duplikat): **${countDup}**`, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply("❌ Gagal membaca file dari server Telegram."); }
});

// ================= UI PAGINATION KATALOG =================
bot.action('IGNORE', async ctx => { await ctx.answerCbQuery().catch(()=>{}); });

const showCatalog = async (ctx, page = 1) => {
    try {
        if (productCache.length === 0) {
            if (ctx.updateType === 'callback_query') return await ctx.editMessageText("😔 Belum ada produk.");
            return await ctx.reply("😔 Belum ada produk.");
        }

        const itemsPerPage = 5;
        const totalPages = Math.ceil(productCache.length / itemsPerPage);
        const currentPage = page > totalPages ? totalPages : page < 1 ? 1 : page;

        const start = (currentPage - 1) * itemsPerPage;
        const currentProducts = productCache.slice(start, start + itemsPerPage);

        const btn = currentProducts.map(p => [Markup.button.callback(`🛍️ ${p.name} - Rp${p.price.toLocaleString('id-ID')}`, `DETAIL_${p.product_id}`)]);

        const navButtons = [];
        if (currentPage > 1) navButtons.push(Markup.button.callback('⬅️ Prev', `PAGE_${currentPage - 1}`));
        navButtons.push(Markup.button.callback(`Hal ${currentPage}/${totalPages}`, 'IGNORE'));
        if (currentPage < totalPages) navButtons.push(Markup.button.callback('Next ➡️', `PAGE_${currentPage + 1}`));
        if (navButtons.length > 0) btn.push(navButtons);

        const soldCount = await db.getRecentSalesCount();
        const text = `🛒 **KATALOG PRODUK**\n🔥 _Dipercaya! Terjual **${soldCount}** pesanan dalam 2 minggu terakhir._\n\nSilakan pilih produk:`;

        if (ctx.updateType === 'callback_query') {
            await ctx.editMessageText(text, { reply_markup: { inline_keyboard: btn }, parse_mode: 'Markdown' });
        } else {
            await ctx.reply(text, { reply_markup: { inline_keyboard: btn }, parse_mode: 'Markdown' });
        }
    } catch (e) {
        if (e.description && e.description.includes('message is not modified')) await ctx.answerCbQuery().catch(() => {});
    }
};

bot.hears('🛒 Katalog Produk', ctx => showCatalog(ctx, 1));
bot.action(/PAGE_(\d+)/, ctx => showCatalog(ctx, parseInt(ctx.match[1])));
bot.action('BACK_KATALOG', ctx => showCatalog(ctx, 1));

// ================= UI DETAIL & CART =================
bot.action(/DETAIL_(.+)/, async ctx => {
    const id = ctx.match[1];
    const p = productCache.find(x => x.product_id === id);
    if (!p) return ctx.answerCbQuery("Produk tidak ditemukan!", { show_alert: true });

    const stockCount = await db.countStock(id);
    
    try {
        await ctx.editMessageText(
            `📦 **INFORMASI PRODUK**\n\n` +
            `🔹 **Nama:** ${p.name}\n` +
            `💸 **Harga:** Rp${p.price.toLocaleString('id-ID')}\n` +
            `📊 **Sisa Stok:** ${stockCount} akun\n\n` +
            `📝 **Deskripsi:**\n${p.description}\n\n` +
            `_Lanjut ke kasir? 👇_`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🛒 Lanjut Pembelian', `CART_${id}_1`)],
                [Markup.button.callback('🔙 Kembali ke Katalog', 'BACK_KATALOG')]
            ]), { parse_mode: 'Markdown' }
        );
    } catch (e) {
        if (e.description && e.description.includes('message is not modified')) await ctx.answerCbQuery().catch(() => {});
    }
});

bot.action(/CART_(.+)_(.+)/, async ctx => {
    const id = ctx.match[1];
    let qty = parseInt(ctx.match[2]);
    const p = productCache.find(x => x.product_id === id);
    if (!p) return ctx.answerCbQuery("Produk tidak ditemukan!", { show_alert: true });

    const stockCount = await db.countStock(id);
    if (qty < 1) { qty = 1; await ctx.answerCbQuery("⚠️ Minimal 1", { show_alert: false }); } 
    else if (qty > stockCount) { qty = stockCount; await ctx.answerCbQuery("⚠️ Melebihi sisa stok!", { show_alert: false }); }

    if (stockCount === 0) return ctx.answerCbQuery("❌ Maaf, stok habis!", { show_alert: true });

    try {
        await ctx.editMessageText(
            `🛒 **KERANJANG BELANJA**\n\n📦 **Produk:** ${p.name}\n💸 **Harga Satuan:** Rp${p.price.toLocaleString('id-ID')}\n🔢 **Jumlah Beli:** ${qty}\n========================\n💰 **TOTAL BAYAR: Rp${(p.price * qty).toLocaleString('id-ID')}**\n\n_Atur jumlah barang di bawah ini:_`,
            Markup.inlineKeyboard([
                [Markup.button.callback('➖ 1', `CART_${id}_${qty - 1}`), Markup.button.callback(`${qty} PCS`, 'IGNORE'), Markup.button.callback('➕ 1', `CART_${id}_${qty + 1}`)],
                [Markup.button.callback('✅ BAYAR DENGAN QRIS', `PAY_${id}_${qty}`)],
                [Markup.button.callback('🔙 Batal', `DETAIL_${id}`)]
            ]), { parse_mode: 'Markdown' }
        );
    } catch (e) {
        if (e.description && e.description.includes('message is not modified')) await ctx.answerCbQuery().catch(() => {});
    }
});

// ================= PAYMENT GATEWAY =================
bot.action(/PAY_(.+)_(.+)/, async ctx => {
    const id = ctx.match[1];
    const qty = parseInt(ctx.match[2]);
    const chatId = ctx.from.id.toString();

    const product = productCache.find(p => p.product_id === id);
    const stockCount = await db.countStock(id);

    if (!product || stockCount < qty) return ctx.answerCbQuery("❌ Stok tidak mencukupi!", { show_alert: true });
    
    const pending = await db.checkPending(chatId);
    if (pending) return ctx.answerCbQuery("⚠️ Selesaikan atau Batalkan pesanan sebelumnya!", { show_alert: true });

    await ctx.answerCbQuery().catch(() => {});
    await ctx.editMessageText(`⏳ _Mempersiapkan QRIS..._`, { parse_mode: 'Markdown' }).catch(() => {});

    const unique = await db.getUnique();
    const orderId = `INV-${Date.now()}`;
    const baseTotalPrice = product.price * qty; 
    const finalNominal = baseTotalPrice + unique;

    try {
        const res = await axios.post('https://eqris.com/api/qr-orkut-v2', {
            username_orkut: process.env.ORKUT_USERNAME,
            token_orkut: process.env.ORKUT_TOKEN,
            nominal: finalNominal
        }, { headers: { tokenKey: process.env.EQRIS_API_KEY } });

        const buffer = Buffer.from(res.data.qris.split(',')[1], 'base64');
        
        const msg = await ctx.replyWithPhoto({ source: buffer }, {
            caption: `🧾 **INVOICE PESANAN**\n\n📦 **Produk:** ${product.name}\n🔢 **Jumlah:** ${qty} akun\n💳 **Total Bayar: Rp${finalNominal.toLocaleString('id-ID')}**\n\n⚠️ _Transfer HARUS PAS hingga 3 digit terakhir._\n⏳ Hangus dalam **3 menit**.`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('❌ Batalkan Pesanan', `CANCEL_ORD_${orderId}`)]
                ]
            }
        });

        await db.createOrder(orderId, chatId, id, baseTotalPrice, unique, msg.message_id);
        bot.telegram.sendMessage(SUPER_ADMIN, `🆕 **ORDER MASUK**\nID: \`${orderId}\`\nQty: ${qty}`, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply("❌ Gagal membuat QRIS."); }
});

bot.action(/CANCEL_ORD_(.+)/, async ctx => {
    const orderId = ctx.match[1];
    await ctx.answerCbQuery("Pesanan Dibatalkan", { show_alert: true }).catch(()=>{});
    
    await db.updateStatus(orderId, 'CANCELLED');
    await ctx.deleteMessage().catch(()=>{}); 
    ctx.reply("❌ Pesanan telah dibatalkan secara sistem.");
});

// ================= STATUS & HISTORY =================
bot.hears('📊 Status Pesanan', async ctx => {
    const rows = await db.getUserOrders(ctx.from.id.toString());
    if (!rows.length) return ctx.reply("Belum ada pesanan.");
    const btn = rows.slice(0, 5).map(o => [Markup.button.callback(`🔍 ${o.order_id} (${o.status})`, `CHECK_${o.order_id}`)]);
    btn.push([Markup.button.callback('🔙 Tutup', 'CLOSE_MENU')]);
    ctx.reply("📊 **STATUS PESANAN:**", Markup.inlineKeyboard(btn));
});

bot.action(/CHECK_(.+)/, async ctx => {
    const id = ctx.match[1];
    const o = await db.getOrderById(id, ctx.from.id.toString());
    if (!o) return ctx.answerCbQuery("Data tidak ditemukan");
    const sisa = Math.max(0, 3 - moment.utc().diff(moment.utc(o.created_at), 'minutes'));
    let ikon = o.status === 'PAID' ? '✅' : o.status === 'EXPIRED' || o.status === 'CANCELLED' ? '❌' : '⏳';
    
    try {
        ctx.editMessageText(`🔍 **DETAIL INVOICE**\n\n📄 **ID:** \`${o.order_id}\`\n${ikon} **Status:** ${o.status}\n💵 **Total:** Rp${o.total_price.toLocaleString('id-ID')}\n⏱️ **Sisa Waktu:** ${o.status === 'PENDING' ? sisa + ' menit' : '-'}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Kembali ke List', 'BACK_STATUS')]]), { parse_mode: 'Markdown' });
    } catch(e) { if(e.description && e.description.includes('message is not modified')) ctx.answerCbQuery().catch(()=>{}); }
});

bot.action('BACK_STATUS', async ctx => {
    const rows = await db.getUserOrders(ctx.from.id.toString());
    const btn = rows.slice(0, 5).map(o => [Markup.button.callback(`🔍 ${o.order_id} (${o.status})`, `CHECK_${o.order_id}`)]);
    btn.push([Markup.button.callback('🔙 Tutup', 'CLOSE_MENU')]);
    try { ctx.editMessageText("📊 **STATUS PESANAN:**", Markup.inlineKeyboard(btn)); } catch(e){}
});

bot.hears('🧾 Riwayat Transaksi', async ctx => {
    const rows = await db.getUserOrders(ctx.from.id.toString());
    if (!rows.length) return ctx.reply("Belum ada riwayat transaksi.");
    let text = "🧾 **RIWAYAT TRANSAKSI:**\n\n";
    rows.slice(0, 10).forEach(o => { 
        let ikon = o.status === 'PAID' ? '✅' : (o.status === 'EXPIRED' || o.status === 'CANCELLED') ? '❌' : '⏳';
        text += `${ikon} \`${o.order_id}\` | Rp${o.total_price}\n`; 
    });
    ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.action('CLOSE_MENU', ctx => ctx.deleteMessage());

// ================= PAYMENT LOOP (MUTLAK ANTI-BUG) =================
setInterval(async () => {
    const orders = (await db.getPendingOrders()).slice(0, 20);
    if (!orders.length) return;

    try {
        const res = await axios.post('https://eqris.com/api/mutasi-orkut-v2', {
            username_orkut: process.env.ORKUT_USERNAME,
            token_orkut: process.env.ORKUT_TOKEN
        }, { headers: { tokenKey: process.env.EQRIS_API_KEY } });

        let mutasi = res.data.data || [];
        const now = moment.utc();

        for (let o of orders) {
            const diff = now.diff(moment.utc(o.created_at), 'minutes');

            if (diff >= 3) {
                await db.updateStatus(o.order_id, 'EXPIRED');
                if (o.qr_msg_id) { try { await bot.telegram.deleteMessage(o.chat_id, o.qr_msg_id); } catch {} }
                bot.telegram.sendMessage(o.chat_id, `❌ Waktu pembayaran **${o.order_id}** habis. QRIS dihapus.`, { parse_mode: 'Markdown' });
                continue;
            }

            const idx = mutasi.findIndex(m => {
                const isAmountMatch = parseInt(m.amount) === o.total_price;
                const mutasiId = `${m.amount}_${m.date || m.created_at}`; 
                return isAmountMatch && !processedMutations.has(mutasiId);
            });

            if (idx !== -1) {
                const matchedMutasi = mutasi[idx];
                processedMutations.add(`${matchedMutasi.amount}_${matchedMutasi.date || matchedMutasi.created_at}`);
                mutasi.splice(idx, 1); 
                
                if (o.qr_msg_id) { try { await bot.telegram.deleteMessage(o.chat_id, o.qr_msg_id); } catch (err) {} }

                const productObj = productCache.find(p => p.product_id === o.product_id);
                let qtyBought = 1;
                if (productObj && productObj.price > 0) {
                    qtyBought = Math.round(o.base_price / productObj.price);
                }

                let accountsText = "";
                let fetchedQty = 0;
                for(let i=0; i < qtyBought; i++) {
                    const currentStock = await db.getAvailableStock(o.product_id);
                    if(currentStock) {
                        await db.markStockSold(currentStock.id);
                        accountsText += `${currentStock.account_data}\n`;
                        fetchedQty++;
                    }
                }

                if (fetchedQty > 0) {
                    await db.updateStatus(o.order_id, 'PAID');
                    bot.telegram.sendMessage(o.chat_id, `🎉 **PEMBAYARAN BERHASIL!**\n\nBerikut pesananmu:\n\`\`\`\n${accountsText}\`\`\`\nTerima kasih!`, { parse_mode: 'Markdown' });
                    bot.telegram.sendMessage(SUPER_ADMIN, `💰 **SOLD OUT**\nID: \`${o.order_id}\`\nData:\n\`${accountsText}\``, { parse_mode: 'Markdown' });
                    
                    if (fetchedQty < qtyBought) {
                        bot.telegram.sendMessage(o.chat_id, `⚠️ Stok hanya tersedia ${fetchedQty} dari ${qtyBought}. Harap hubungi Admin untuk refund sisanya!`);
                        bot.telegram.sendMessage(SUPER_ADMIN, `🚨 **PARTIAL STOCK OUT**\nOrder \`${o.order_id}\` kurang ${qtyBought - fetchedQty} akun!`);
                    }
                } else {
                    await db.updateStatus(o.order_id, 'PAID');
                    bot.telegram.sendMessage(o.chat_id, `⚠️ Pembayaran diterima, tapi stok kosong. Harap hubungi Admin untuk refund/restock!`);
                    bot.telegram.sendMessage(SUPER_ADMIN, `🚨 **URGENT: STOK HABIS**\nOrder \`${o.order_id}\` dibayar tapi gudang kosong!`, { parse_mode: 'Markdown' });
                }
            }
        }
    } catch (error) {}
}, 15000);

bot.launch().then(() => console.log("🤖 Bot VIP (Enterprise Edition) Aktif!"));
