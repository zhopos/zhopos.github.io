# Zho POS v4 — Redesign + Supabase

> **Status: dibangun lokal, BELUM di-deploy.** Aplikasi live saat ini tetap **Zho POS V12 (Google Apps Script + Google Sheets)** — file itu tidak disentuh sama sekali. Semua file di folder ini (`v4-supabase/`) adalah versi baru yang masih menunggu Bos: proyek Supabase + repo GitHub.

## Arsitektur baru

```
GitHub Pages (frontend statis)  →  Supabase (Postgres + REST API)
  index.html / app.js /              37 tabel, RLS aktif
  supabase.js / config.js            anon key saja (v1)
```

- **Frontend** di-host di GitHub Pages (gratis, cepat, tanpa server).
- **Backend** Supabase Free ($0) — database Postgres beneran, jauh lebih cepat dari Apps Script (yang sekali panggil bisa 2–19 detik).
- **GitHub BUKAN database** — hanya tempat hosting file aplikasinya.

## File di folder ini

| File | Baris | Isi |
|---|---|---|
| `index.html` | 448 | Shell aplikasi: header gradient teal, drawer berkelompok, bottom nav, dashboard baru, kasir baru, view Pembayaran |
| `app.js` | 1.091 | Semua logika UI — cermin V12 (login, kasir, keranjang, checkout, laporan, semua menu) |
| `supabase.js` | 1.223 | Lapisan data `DB` + data contoh (mode demo) |
| `config.js` | 21 | Placeholder kosong `SUPABASE_URL` / `SUPABASE_ANON_KEY` — diisi Bos nanti |
| `supabase-schema.sql` | 823 | 37 tabel Postgres + RLS + seed (dijalankan sekali di SQL Editor) |
| `README.md` | — | File ini |

## Desain (sesuai mockup Bos, 21 Nov 2026)

- **Teal Klasik** (`#0f766e`) — pilihan Bos, dipertahankan dari V12.
- **Dashboard:** header gradient teal (☰, "Zho POS", badge Premium, lonceng), "Selamat Datang 👋" + nama toko dinamis, kartu Penjualan Hari Ini + % vs kemarin, 4 tile (Transaksi, Produk, Stok Menipis, Pelanggan), grafik 7 hari terakhir, grid Menu Utama 8 ikon + baris Jalan Pintas berisi **semua 13 shortcut V12**.
- **Transaksi Baru:** toggle Reguler/Cepat, search "Cari produk (nama / kode / barcode)", baris produk (thumbnail, nama, harga, "Stok: N" merah bila 0) + tombol + besar, baris di keranjang jadi − [qty] +, sticky cart bar teal ("N item | RpX.XXX ›").
- **Pembayaran** (view baru): Total Belanja besar teal, Sub Total / Diskon / Pajak / Total, grid metode 3 kolom (Tunai, Debit Card, QRIS, GoPay, OVO, ShopeePay, Transfer Bank, VISA, E-Money), Uang Tunai, Kembalian hijau, tombol "✓ Selesai".
- **Drawer:** header teal + mark "Z" + Premium (**tanpa logo custom** — logo dibuat nanti, kata Bos), kartu toko + "v4.0 Supabase", menu berkelompok (Dashboard / Transaksi / Master Data / Laporan / Keuangan / Lainnya), baris bawah status Supabase ("Supabase: Mode Contoh" / "Terhubung").
- **Semua 19 menu V12 tetap ada** (Home, Transaksi Baru, Transaksi Cepat, Daftar Transaksi, Produk, Stok, Pembelian, Pengeluaran, Arus Kas, Utang, Pelanggan & Piutang, Meja & Dapur, Master, Katalog, Promo & Member, Laporan, Lapor Bos, Pengguna & Peran, Pengaturan). Kasir hanya melihat Home, Transaksi Baru, Pelanggan & Piutang (sesuai peran).
- **Perilaku V12 dipertahankan:** login render di tempat tanpa reload (perbaikan V12 soal blank setelah login), Bayar auto-fill total kecuali kasir sudah mengetik manual, tombol jual tetap "Simpan & Cetak Struk" (kasir) / "✓ Selesai" (Pembayaran), "Simpan Transaksi Cepat" tetap hanya menyimpan template keranjang, **Lapor Bos tetap MANUAL** (pratinjau → wa.me/cetak, tanpa kirim otomatis), PIN hanya kunci peran di aplikasi.

## Mode Contoh (sebelum Supabase diisi)

Kalau `config.js` masih kosong, aplikasi jalan dengan **data contoh di dalam `supabase.js`** (diberi label jelas di kode) dan menampilkan badge **"Mode Contoh"**. Semua layar bisa diklik dan dicoba: login Admin (PIN kosong) → dashboard → kasir tambah TES Kopi → Bayar auto-fill → Selesai → struk + stok berkurang. Cukup buka `index.html` langsung di browser untuk mencoba — tanpa Supabase, tanpa GitHub.

**Data contoh (hanya ini):** Cabang Utama (CBG-UTAMA); 10 metode bayar; Admin (PIN kosong); NamaToko "Zho POS"; tier Silver/Gold; TES Kopi Rp10.000 stok 9; pelanggan "Umum"; transaksi contoh TRX-8250237222 (TES Kopi x1, Rp10.000, Lunas). **9 produk Griyo TIDAK di-seed** — harga Rp1.000-nya belum terkonfirmasi Bos, jadi bukan data beneran.

Catatan: di mode Contoh, tanggal transaksi contoh dibuat dinamis ke "hari ini" supaya dashboard menampilkan omzet Rp10.000 saat dicoba kapan pun. Di Supabase (data beneran), tanggalnya tercatat apa adanya.

## Cara menghidupkan (yang perlu Bos)

### 1. Buat proyek Supabase (gratis, ~5 menit)
1. Buka https://supabase.com → Sign up / login (pakai akun Google Bos) → **New project**.
2. Isi nama (mis. `zho-pos`), pilih region **Singapore** (paling dekat), buat password database (simpan baik-baik).
3. Tunggu proyek jadi (1–2 menit). **Paket Free $0** — cukup untuk tahap ini.

### 2. Buat tabel (sekali saja)
1. Di dashboard Supabase → **SQL Editor** → **New query**.
2. Buka file `supabase-schema.sql` dari folder ini, salin seluruh isinya, tempel, tekan **Run**.
3. File ini boleh dijalankan ulang (aman — pakai `if not exists` / `on conflict do nothing`).

### 3. Isi `config.js`
1. Di Supabase → **Project Settings → API**.
2. Salin **Project URL** → tempel ke `SUPABASE_URL` di `config.js`.
3. Salin **anon public key** → tempel ke `SUPABASE_ANON_KEY` di `config.js`.
4. Jangan pakai `service_role` key di sini — itu kunci rahasia server, tidak boleh masuk ke aplikasi.

### 4. Taruh halaman di GitHub (GitHub Pages)
1. Buat repo baru di GitHub (mis. `zho-pos`), upload semua file folder ini ke repo.
2. **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, folder `/ (root)` → Save.
3. Tunggu 1–2 menit, buka URL-nya (mis. `https://<username>.github.io/zho-pos/`).
4. Login **Admin, PIN kosong**, lalu uji kasir seperti di V12.

### 5. Uji sebelum dipakai jualan
- Login Admin → dashboard (omzet Rp10.000 dari transaksi contoh) → Transaksi Baru → tambah TES Kopi → Bayar auto-fill Rp10.000 → Lanjut ke Pembayaran → Tunai → ✓ Selesai → struk muncul, stok TES Kopi 9 → 8.
- Setelah yakin, hapus transaksi contoh dari Supabase (tabel `transaksi` + `transaksi_detail`) atau biarkan sebagai riwayat tes.

## Yang sudah selesai vs yang masih perlu Bos

**Selesai (lokal, terverifikasi):**
- Redesign 4 layar mockup + semua 19 menu + 13 shortcut.
- Lapisan data Supabase lengkap (semua aksi V12: transaksi, produk, pembelian, utang, poin, promo, meja/dapur, opname, laporan, Lapor Bos manual, dll.) + mode Contoh yang sepenuhnya bisa diklik.
- Skema 37 tabel + RLS + seed.
- `node --check` lolos untuk `config.js`, `supabase.js`, `app.js`; HTML tervalidasi (tidak ada tag tak tertutup); alur inti diuji headless 20+ assertion (login, stok, checkout, poin, opname, Lapor Bos, export).
- Live V12 (GAS + Sheets) **tidak disentuh** — tetap jalan seperti biasa sampai v4 terverifikasi.

**Masih perlu Bos:**
- [ ] Proyek Supabase Free + jalankan `supabase-schema.sql` + isi `config.js` (URL + anon key).
- [ ] Repo GitHub + aktifkan GitHub Pages (GitHub belum terhubung).
- [ ] Harga asli 9 produk Griyo (masih Rp1.000 placeholder — jangan diimpor sebelum Bos konfirmasi).
- [ ] Cek visual di HP sungguhan (tampilan + klik end-to-end di browser belum diuji — hanya headless).
- [ ] Setelah live: hapus data contoh bila tidak mau dipakai, dan ganti TES Kopi dengan produk asli toko.

**Diketahui / ditunda (bukan bug):**
- RLS v1 **permissive** (anon boleh semua) — sengaja untuk v1; auth per-pengguna + kebijakan per cabang/peran adalah tahap berikutnya.
- Katalog publik: pratinjau ada di dalam aplikasi + link `?katalog=ID`; halaman katalog publik mandiri (tanpa login) belum dibuat — perlu diputuskan jadi file terpisah di GitHub Pages atau tidak.
- QRIS otomatis (gateway) dan integrasi marketplace tetap **ditunda**, sama seperti keputusan v3.
- Tabel detail (`transaksi_detail`, `pembelian_detail`, `resep`, `stok_cabang`) memakai composite primary key (tanpa kolom `id` sendiri) — lapisan data sudah menanganinya (gabungkan baris produk yang sama dalam satu transaksi).
- ID prefix baru pilihan v4 (ditandai di SQL): `STB-` (stok_batch), `CIC-` (cicilan_utang), `DTX-` (daftar_teks), `GRP-` (grup_produk), `SAT-` (satuan), `IPG-` (item_pengeluaran), `LOG-` (logs).

## Keputusan desain yang dicatat

- Warna Teal Klasik `#0f766e` (pilihan Bos 16 Nov 2026). Tanpa logo custom — mark "Z" saja, logo nanti.
- Mockup 21 Nov 2026 menggantikan keputusan lama "tampilan persis Griyo Pos" — desain baru ini yang dipakai ke depan.
- Database GitHub **tidak dipakai** — GitHub hanya hosting halaman; database tetap Supabase (penjelasan lengkap sudah disampaikan ke Bos 21 Nov 2026).
- V12 GAS tetap live sampai v4 (Supabase) terverifikasi di tangan Bos.
