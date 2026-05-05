# 🤖 Telegram Bot VIP Store (Auto Payment & Stock Management)

Bot Telegram pintar untuk otomatisasi penjualan produk digital (akun, lisensi, dll) dengan integrasi Payment Gateway EQris. Dibangun menggunakan **Node.js**, **Telegraf**, dan **MongoDB**.

Bot ini dilengkapi dengan sistem manajemen stok cerdas, pengiriman file otomatis, dan Role-Based Access Control (RBAC) untuk keamanan operasional toko.

## ✨ Fitur Unggulan

### 🛒 Fitur Front-End (Pembeli)
* **Katalog Dinamis & Pagination:** UI yang rapi dengan pembagian halaman (maksimal 5 produk per halaman).
* **Stateless Cart System:** Pembeli dapat mengatur jumlah pembelian langsung dari *inline keyboard*.
* **Otomatisasi QRIS:** *Generate* QRIS unik secara instan untuk setiap pesanan.
* **Auto-Delivery:** Akun/stok otomatis dikirim ke pembeli segera setelah mutasi bank/e-wallet terdeteksi.
* **Fitur Batal Pesanan:** Pembeli dapat membatalkan pesanan yang sedang *pending*.

### 🛠️ Fitur Back-Office (Admin & Owner)
* **Role-Based Access Control (RBAC):** Pemisahan hak akses antara **Super Admin** (Owner) dan **Admin** (CS).
* **Manajemen Produk:** Tambah produk, ubah harga, dan edit deskripsi langsung dari chat Telegram.
* **Smart Bulk Restock:** *Upload* stok masal via file `.txt` dengan fitur **Anti-Duplikat** otomatis.
* **Eksekutor Manual (`/send`):** Mengirim pesanan secara manual. Bot akan membungkus stok ke dalam file `.txt`, mengirimkannya ke pembeli, dan memberikan CC/Log riwayat ke Super Admin.
* **Tarik Stok Gudang (`/removestock`):** Menarik sisa stok yang belum terjual menjadi file `.txt` dan menghapusnya dari database.
* **Broadcast Promo:** Mengirim pesan massal ke semua pengguna bot tanpa limitasi (dilengkapi sistem *delay* anti-spam).

### ⚙️ Keamanan Sistem (Core Engine)
* **Anti-Double Payment:** Cache sistem untuk mencegah satu mutasi diklaim dua kali.
* **Auto-Expired Invoice:** Pesanan otomatis hangus dan gambar QRIS dihapus dari chat pembeli dalam 3 menit jika tidak dibayar.
* **Partial Fulfillment:** Jika pembeli mentransfer namun stok di gudang kurang dari jumlah pesanan, bot akan mengirimkan sisa stok yang ada dan memberikan peringatan URGENT kepada Admin untuk *refund* manual.

---

## 📦 Persyaratan Sistem (Prerequisites)

Sebelum menjalankan bot ini, pastikan Anda telah memiliki:
1. **Node.js** (Minimal v16.x atau lebih baru).
2. Akun **MongoDB Atlas** (URL Connection String).
3. Token Bot Telegram dari **[@BotFather](https://t.me/BotFather)**.
4. Akun API Payment Gateway **EQris / Orkut V2**.

---

## 🚀 Cara Instalasi & Menjalankan Bot

**1. Clone Repository**
```bash
https://github.com/Xbyzats/Bot-Order-Tele.git
