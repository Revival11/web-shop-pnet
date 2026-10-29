# Panduan Lengkap Deploy PlayNet SMP Store ke Vercel & Pasang Midtrans

Project ini sudah dikonfigurasi lengkap untuk **Vercel Serverless Functions** (`/api/create-transaction` & `/api/midtrans-webhook`) dengan tampilan **PlayNet SMP Store** yang dilengkapi fitur **Login Server Minecraft (`216.163.186.75`)** dan **Checkout Midtrans Snap**.

## 1. Cara Mengambil API Key di Dashboard Midtrans
1. Masuk ke akun **Midtrans Dashboard (MAP)** di https://dashboard.midtrans.com/
2. Di pojok kiri atas, pilih environment **Sandbox** (untuk uji coba/testing) atau **Production** (untuk transaksi uang asli).
3. Klik menu **Settings** -> **Access Keys**.
4. Salin 3 informasi penting berikut:
   - **Merchant ID**
   - **Client Key** (Contoh Sandbox: `SB-Mid-client-xxxxxxxx`, Production: `Mid-client-xxxxxxxx`)
   - **Server Key** (Contoh Sandbox: `SB-Mid-server-xxxxxxxx`, Production: `Mid-server-xxxxxxxx`)

## 2. Cara Deploy Project ke Vercel
1. Buat repository baru di GitHub, lalu upload seluruh isi folder project ini (`index.html`, `package.json`, `vercel.json`, dan folder `api/`).
2. Buka https://vercel.com/new lalu pilih **Import Git Repository** dari GitHub kamu.
3. Sebelum klik **Deploy**, buka bagian **Environment Variables** di Vercel, lalu tambahkan variabel berikut:
   - `MIDTRANS_SERVER_KEY` = *(Isi dengan Server Key Midtrans kamu)*
   - `MIDTRANS_CLIENT_KEY` = *(Isi dengan Client Key Midtrans kamu)*
   - `MIDTRANS_IS_PRODUCTION` = `false` *(Ubah menjadi `true` jika memakai kunci Production)*
4. (Opsional - Auto-Give Item ke Server Minecraft via RCON):
   Jika kamu ingin rank/kit/money otomatis masuk ke akun player di `mc.playnet.my.id` begitu mereka selesai bayar QRIS/GoPay/VA, tambahkan juga:
   - `RCON_ENABLED` = `true`
   - `RCON_HOST` = `216.163.186.75`
   - `RCON_PORT` = `12005` *(port RCON baru yang kamu berikan; harus sama dengan port yang dibuka hosting)*
   - `RCON_PASSWORD` = *(Password RCON di `server.properties`)*
5. Klik **Deploy** dan tunggu hingga website kamu aktif (misalnya `https://store.playnet.my.id` atau `https://playnet-store.vercel.app`).

## 3. Cara Mengatur Webhook Notification di Midtrans
Agar Midtrans memberitahu server Vercel kamu secara otomatis saat pemain sudah membayar:
1. Buka **Midtrans Dashboard** -> **Settings** -> **Configuration**.
2. Pada kolom **Payment Notification URL**, masukkan URL endpoint webhook Vercel kamu:
   `https://domain-vercel-kamu.vercel.app/api/midtrans-webhook`
   *(atau `https://store.playnet.my.id/api/midtrans-webhook` jika sudah memakai custom domain)*.
3. Klik **Save / Update**.
# web-shop-pnet
