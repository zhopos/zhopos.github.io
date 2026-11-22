-- 12. Seed data
-- ----------------------------------------------------------------------------
-- Seeds are the same as the V12 live seed + the one real test transaction
-- (TRX-8250237222, 17 Nov 2026). The 9 Griyo products are DELIBERATELY NOT
-- seeded here: their Rp1.000 prices are unconfirmed placeholders, and the
-- real prices still have to come from Bos.
-- All inserts use `on conflict do nothing` so re-runs never error.

-- Cabang utama
insert into cabang (id, nama, alamat, telepon, aktif)
values ('CBG-UTAMA', 'Cabang Utama', '', '', true)
on conflict (id) do nothing;

-- Jenis pembayaran (10, all aktif) — JBY-1..JBY-10 in v3 default order
insert into jenis_pembayaran (id, nama, aktif) values
  ('JBY-1', 'Tunai', true),
  ('JBY-2', 'Debit', true),
  ('JBY-3', 'GoPay', true),
  ('JBY-4', 'OVO', true),
  ('JBY-5', 'QRIS', true),
  ('JBY-6', 'Shopeepay', true),
  ('JBY-7', 'Transfer Bank', true),
  ('JBY-8', 'VISA', true),
  ('JBY-9', 'MasterCard', true),
  ('JBY-10', 'e-Money', true)
on conflict (id) do nothing;

-- Admin user (empty PIN — PIN is only an in-app role lock)
insert into pengguna (id, nama, pin, peran, aktif, akses_transaksi, cabang_id)
values ('USR-ADMIN', 'Admin', '', 'Admin', true, 'Tidak dibatasi', 'CBG-UTAMA')
on conflict (id) do nothing;

-- Pengaturan (16 keys)
insert into pengaturan (kunci, nilai) values
  ('NamaToko', 'Zho POS'),
  ('CabangAktif', 'CBG-UTAMA'),
  ('TargetHarian', '0'),
  ('PoinAktif', 'YA'),
  ('PoinPerRupiah', '1000'),
  ('PoinTukarRate', '100'),
  ('PajakAktif', 'TIDAK'),
  ('PajakPersen', '0'),
  ('Bahasa', 'id'),
  ('FormatTanggal', 'dd-mm-yyyy'),
  ('ModeGelap', 'TIDAK'),
  ('ModeMejaAktif', 'TIDAK'),
  ('PromoAktif', 'YA'),
  ('MultiCabangAktif', 'YA'),
  ('JatuhTempoHari', '7'),
  ('KotaToko', ''),
  ('FooterStruk', 'Terima kasih'),
  ('Logo2', ''),
  ('Watermark', ''),
  ('StrukUkuranKertas', '58')
on conflict (kunci) do nothing;

-- Tier member
insert into tier_member (tier, min_total_beli, diskon_persen, manfaat) values
  ('Silver', 500000, 2, 'Diskon 2%'),
  ('Gold', 2000000, 5, 'Diskon 5%')
on conflict (tier) do nothing;

-- Satuan (desimal true only for kg / liter)
insert into satuan (id, nama, singkatan, desimal) values
  ('SAT-PCS', 'pcs', 'pcs', false),
  ('SAT-LUSIN', 'lusin', 'lsn', false),
  ('SAT-DUS', 'dus', 'dus', false),
  ('SAT-KG', 'kg', 'kg', true),
  ('SAT-LITER', 'liter', 'L', true)
on conflict (id) do nothing;

-- Item pengeluaran
insert into item_pengeluaran (id, nama) values
  ('IPG-AIR', 'Air'),
  ('IPG-GAS', 'Gas'),
  ('IPG-LISTRIK', 'Listrik'),
  ('IPG-LAINNYA', 'Lainnya')
on conflict (id) do nothing;

-- Terjemahan: the 12 default terms, each mapped to itself in Indonesian
insert into terjemahan (istilah, terjemahan) values
  ('Kasir', 'Kasir'),
  ('Pelanggan', 'Pelanggan'),
  ('Lunas', 'Lunas'),
  ('Kurang', 'Kurang'),
  ('Belum Dibayar', 'Belum Dibayar'),
  ('Total', 'Total'),
  ('Subtotal', 'Subtotal'),
  ('Kembali', 'Kembali'),
  ('Proses', 'Proses'),
  ('Selesai', 'Selesai'),
  ('Diambil', 'Diambil'),
  ('Antri', 'Antri')
on conflict (istilah) do nothing;

-- Default customer for the cashier
insert into pelanggan (id, nama)
values ('PLG-UMUM', 'Umum')
on conflict (id) do nothing;

-- Test product only (mirrors live V12: stock 9 after the 17 Nov test sale)
insert into produk (id, nama, harga_jual, harga_modal, stok, satuan, aktif, termasuk_stok, cabang_id)
values ('PRD-TESKOPI', 'TES Kopi', 10000, 0, 9, 'pcs', true, true, 'CBG-UTAMA')
on conflict (id) do nothing;

-- The one real V12 test transaction (17 Nov 2026, TES Kopi x1 Tunai Rp10.000)
insert into transaksi (id, tanggal, pelanggan, kasir, total, diskon, bayar, sisa, metode, status_bayar, status_pesanan, cabang_id, kode_alternatif, laba)
values ('TRX-8250237222', '2026-11-17 09:28:24+07', 'Umum', 'Admin', 10000, 0, 10000, 0, 'Tunai', 'Lunas', 'Selesai', 'CBG-UTAMA', '3SNQKW', 10000)
on conflict (id) do nothing;

insert into transaksi_detail (transaksi_id, produk_id, nama_produk, qty, harga, subtotal, modal, laba, satuan_dipakai)
values ('TRX-8250237222', 'PRD-TESKOPI', 'TES Kopi', 1, 10000, 10000, 0, 10000, 'pcs')
on conflict (transaksi_id, produk_id) do nothing;

-- Hak akses peran anon (perbaikan 42501): RLS saja tidak cukup — peran anon
-- butuh GRANT atas tabel, kalau tidak REST mengembalikan "permission denied".
-- Tanpa blok ini, setup toko baru dari file ini akan gagal di langkah pertama.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

-- End of schema. Re-run safe.
