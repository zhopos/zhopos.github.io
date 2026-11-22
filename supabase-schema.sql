-- ============================================================================
-- Zho POS v4 — Supabase Postgres schema
-- ============================================================================
-- Source of truth: ~/workspace/zho-pos/SCHEMA.md (v3, 37 Sheet tabs).
-- This file translates ALL 37 tabs into Postgres tables (snake_case).
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   It is RE-RUNNABLE: `create table if not exists`, `drop policy if
--   exists`, and `on conflict do nothing` on all seed inserts.
--
-- RLS (v1): every table has Row Level Security enabled with one permissive
--   policy for the `anon` role (`using (true) with check (true)`), because
--   the v4 app uses only the Supabase anon key for now.
--   !!! Proper per-user auth (authenticated role + policies by cabang /
--   peran) is a LATER step and is NOT in this file. Do not treat this
--   open v1 policy as production security.
--
-- NOTES / MAPPING DECISIONS (see also comments on individual tables):
--   * IDs stay TEXT primary keys with the v3 prefixes (PRD-, TRX-, PLG-,
--     PMS-, PBL-, KAS-, BHN-, USR-, RTR-, CBG-, PNT-, PRM-, MJ-, DPR-,
--     KTG-, UTG-, OPN-, LB-, CEP-, TTD-). No uuid for these; the app
--     generates prefixed text IDs.
--   * Money / whole quantities are bigint (whole rupiah). Only
--     bahan_baku.harga_per_satuan is numeric(15,2); percents
--     (diskon_persen, komisi_persen, promo.nilai) are numeric so a
--     fractional percent is possible.
--   * timestamptz for Tanggal columns; date for pure dates
--     (tanggal_lahir, kedaluwarsa, promo.mulai/selesai).
--   * JSON columns (HargaLainJSON etc.) are jsonb.
--   * YA/TIDAK columns are boolean (Aktif default true).
--   * Detail tables with NO id column in v3 (transaksi_detail,
--     pembelian_detail, resep, stok_cabang) use a composite primary key
--     instead of an invented surrogate id.
--   * Prefixes NOT defined in SCHEMA.md section 19 were chosen for v4 and
--     are marked "v4 choice" below: STB- (stok_batch), CIC- (cicilan_utang),
--     DTX- (daftar_teks), GRP- (grup_produk), SAT- (satuan),
--     IPG- (item_pengeluaran), LOG- (logs).
--   * FK rule: detail/child rows CASCADE with their parent
--     (transaksi_detail, pembelian_detail, cicilan_utang, pesanan_dapur,
--     stok_cabang, stok_batch, resep); master references are
--     ON DELETE SET NULL (history survives) or RESTRICT where the
--     referencing column is part of a composite PK and cannot be nulled
--     (transaksi_detail.produk_id, pembelian_detail.produk_id) — a product
--     with sales/purchase history cannot be deleted, use Aktif=false.
--   * Do NOT touch the live GAS V12 backend. This file is
--     local-only; nothing is deployed by running it except in Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Master: cabang, grup_produk, satuan, jenis_pembayaran, tier_member,
--    item_pengeluaran, daftar_teks
-- ----------------------------------------------------------------------------

-- Cabang (Sheet: Cabang — ID, Nama, Alamat, Telepon, Aktif)
create table if not exists cabang (
  id text primary key,
  nama text not null,
  alamat text not null default '',
  telepon text not null default '',
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- GrupProduk (Sheet: GrupProduk — ID, Nama)
create table if not exists grup_produk (
  id text primary key, -- v4 choice: GRP- prefix (no v3 prefix defined)
  nama text not null
);

-- Satuan (Sheet: Satuan — ID, Nama, Singkatan, Desimal)
create table if not exists satuan (
  id text primary key, -- v4 choice: SAT- prefix (no v3 prefix defined)
  nama text not null,
  singkatan text not null default '',
  desimal boolean not null default false
);

-- JenisPembayaran (Sheet: JenisPembayaran — ID, Nama, Aktif)
create table if not exists jenis_pembayaran (
  id text primary key,
  nama text not null,
  aktif boolean not null default true
);

-- TierMember (Sheet: TierMember — Tier, MinTotalBeli, DiskonPersen, Manfaat)
-- PK is the tier name itself (no ID column in v3).
create table if not exists tier_member (
  tier text primary key,
  min_total_beli bigint not null default 0,
  diskon_persen numeric(5,2) not null default 0,
  manfaat text not null default ''
);

-- ItemPengeluaran (Sheet: ItemPengeluaran — ID, Nama)
create table if not exists item_pengeluaran (
  id text primary key, -- v4 choice: IPG- prefix (no v3 prefix defined)
  nama text not null
);

-- DaftarTeks (Sheet: DaftarTeks — ID, Nama, Keterangan, Jenis)
-- Jenis: Item / Struk.
create table if not exists daftar_teks (
  id text primary key, -- v4 choice: DTX- prefix (no v3 prefix defined)
  nama text not null,
  keterangan text not null default '',
  jenis text not null default 'Item'
);

-- ----------------------------------------------------------------------------
-- 2. Key-value tables: pengaturan, terjemahan
-- ----------------------------------------------------------------------------

-- Pengaturan (Sheet: Pengaturan — Kunci, Nilai)
create table if not exists pengaturan (
  kunci text primary key,
  nilai text not null default ''
);

-- Terjemahan (Sheet: Terjemahan — Istilah, Terjemahan)
create table if not exists terjemahan (
  istilah text primary key,
  terjemahan text not null default ''
);

-- ----------------------------------------------------------------------------
-- 3. Produk & pelanggan & pemasok & pengguna & bahan_baku
-- ----------------------------------------------------------------------------

-- Produk (Sheet: Produk)
-- SKU/Barcode -> sku_barcode; HargaLainJSON/HargaJumlahJSON/VarianJSON -> jsonb.
create table if not exists produk (
  id text primary key,
  nama text not null,
  kategori text not null default '',
  sku_barcode text not null default '',
  harga_jual bigint not null default 0,
  harga_modal bigint not null default 0,
  stok bigint not null default 0,
  satuan text not null default 'pcs',
  aktif boolean not null default true,
  stok_minimum bigint not null default 0,
  grup text not null default '',
  gambar_url text not null default '',
  keterangan text not null default '',
  harga_bisa_diganti boolean not null default false,
  termasuk_stok boolean not null default true,
  harga_lain_json jsonb not null default '[]'::jsonb,
  harga_jumlah_json jsonb not null default '[]'::jsonb,
  varian_json jsonb not null default '[]'::jsonb,
  tampilkan_di_katalog boolean not null default true,
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Pelanggan (Sheet: Pelanggan — ID, Nama, Telepon, Alamat, TotalBeli,
-- Piutang, Poin, Tier, TanggalLahir, TerakhirBeli)
create table if not exists pelanggan (
  id text primary key,
  nama text not null,
  telepon text not null default '',
  alamat text not null default '',
  total_beli bigint not null default 0,
  piutang bigint not null default 0,
  poin bigint not null default 0,
  tier text not null default '',
  tanggal_lahir date,
  terakhir_beli timestamptz,
  created_at timestamptz not null default now()
);

-- Pemasok (Sheet: Pemasok — ID, Nama, Telepon, Alamat, Hutang)
create table if not exists pemasok (
  id text primary key,
  nama text not null,
  telepon text not null default '',
  alamat text not null default '',
  hutang bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Pengguna (Sheet: Pengguna — ID, Nama, PIN, Peran, Aktif, IzinJSON,
-- AksesTransaksi, CabangID)
-- PIN is only an in-app role lock (empty PIN allowed for Admin in v1 seed).
-- AksesTransaksi: '1 Jam' / '3 Jam' / 'Hari ini' / '7 Hari' / '30 Hari' /
-- 'Tidak dibatasi'.
create table if not exists pengguna (
  id text primary key,
  nama text not null,
  pin text not null default '',
  peran text not null default 'Kasir',
  aktif boolean not null default true,
  izin_json jsonb not null default '{}'::jsonb,
  akses_transaksi text not null default 'Tidak dibatasi',
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- BahanBaku (Sheet: BahanBaku — ID, Nama, Satuan, Stok, HargaPerSatuan,
-- StokMinimum, CabangID)
-- HargaPerSatuan is the one genuinely decimal column: numeric(15,2).
create table if not exists bahan_baku (
  id text primary key,
  nama text not null,
  satuan text not null default '',
  stok bigint not null default 0,
  harga_per_satuan numeric(15,2) not null default 0,
  stok_minimum bigint not null default 0,
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Promo
-- ----------------------------------------------------------------------------

-- Promo (Sheet: Promo — ID, Nama, Jenis, SyaratJSON, Nilai, Mulai, Selesai,
-- JamMulai, JamSelesai, Hari, Aktif, CabangID)
-- Jenis: BeliXGratisY / DiskonPersen / DiskonNominal / HappyHour / Bundling.
-- Nilai is numeric so it can hold either a percent or a nominal amount.
create table if not exists promo (
  id text primary key,
  nama text not null,
  jenis text not null default 'DiskonPersen',
  syarat_json jsonb not null default '{}'::jsonb,
  nilai numeric(15,2) not null default 0,
  mulai date,
  selesai date,
  jam_mulai time,
  jam_selesai time,
  hari text not null default '',
  aktif boolean not null default true,
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. Transaksi & detail
-- ----------------------------------------------------------------------------

-- Transaksi (Sheet: Transaksi)
-- Pelanggan/Kasir/Meja are stored as name text, as in v3 (not FKs).
-- StatusBayar: Lunas / Kurang / Belum Dibayar. StatusPesanan:
-- Antri / Proses / Selesai / Diambil. Metode: name from jenis_pembayaran.
create table if not exists transaksi (
  id text primary key,
  tanggal timestamptz not null default now(),
  pelanggan text not null default 'Umum',
  kasir text not null default '',
  total bigint not null default 0,
  diskon bigint not null default 0,
  bayar bigint not null default 0,
  sisa bigint not null default 0,
  metode text not null default 'Tunai',
  status_bayar text not null default 'Belum Dibayar',
  status_pesanan text not null default 'Antri',
  catatan text not null default '',
  cabang_id text references cabang (id) on delete set null,
  ongkir bigint not null default 0,
  diskon_persen numeric(5,2) not null default 0,
  poin_dipakai bigint not null default 0,
  poin_didapat bigint not null default 0,
  kode_alternatif text not null default '',
  meja text not null default '',
  catatan_struk text not null default '',
  catatan_internal text not null default '',
  laba bigint not null default 0,
  promo_id text references promo (id) on delete set null,
  created_at timestamptz not null default now()
);

-- TransaksiDetail (Sheet: TransaksiDetail — no ID column in v3)
-- Composite PK (transaksi_id, produk_id). Deleting a transaksi cascades;
-- deleting a produk is RESTRICTed while history exists (use Aktif=false).
create table if not exists transaksi_detail (
  transaksi_id text not null references transaksi (id) on delete cascade,
  produk_id text not null references produk (id) on delete restrict,
  nama_produk text not null default '',
  qty bigint not null default 0,
  harga bigint not null default 0,
  subtotal bigint not null default 0,
  modal bigint not null default 0,
  diskon_item bigint not null default 0,
  laba bigint not null default 0,
  satuan_dipakai text not null default 'pcs',
  primary key (transaksi_id, produk_id)
);

-- ----------------------------------------------------------------------------
-- 6. Pembelian & detail, pengeluaran, kas
-- ----------------------------------------------------------------------------

-- Pembelian (Sheet: Pembelian — ID, Tanggal, Pemasok, Total, Bayar, Sisa,
-- Status, Catatan, CabangID, Diskon, Pajak, BiayaLain, Diproses)
-- Pemasok is a name string as in v3. Diproses=false means DRAFT: stock and
-- cash have NOT moved yet (see SCHEMA.md rule 8).
create table if not exists pembelian (
  id text primary key,
  tanggal timestamptz not null default now(),
  pemasok text not null default '',
  total bigint not null default 0,
  bayar bigint not null default 0,
  sisa bigint not null default 0,
  status text not null default 'Belum Dibayar',
  catatan text not null default '',
  cabang_id text references cabang (id) on delete set null,
  diskon bigint not null default 0,
  pajak bigint not null default 0,
  biaya_lain bigint not null default 0,
  diproses boolean not null default false,
  created_at timestamptz not null default now()
);

-- PembelianDetail (Sheet: PembelianDetail — no ID column in v3)
-- Composite PK (pembelian_id, produk_id); same FK rule as transaksi_detail.
create table if not exists pembelian_detail (
  pembelian_id text not null references pembelian (id) on delete cascade,
  produk_id text not null references produk (id) on delete restrict,
  nama_produk text not null default '',
  qty bigint not null default 0,
  harga_beli bigint not null default 0,
  harga_jual bigint not null default 0,
  subtotal bigint not null default 0,
  kedaluwarsa date,
  primary key (pembelian_id, produk_id)
);

-- Pengeluaran (Sheet: Pengeluaran — ID, Tanggal, Kategori, Keterangan,
-- Nominal, EfekLaba, CabangID)
-- EfekLaba: TidakMengurangi / MengurangiLaba / MengurangiOngkir.
create table if not exists pengeluaran (
  id text primary key,
  tanggal timestamptz not null default now(),
  kategori text not null default '',
  keterangan text not null default '',
  nominal bigint not null default 0,
  efek_laba text not null default 'MengurangiLaba',
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Kas (Sheet: Kas — ID, Tanggal, Jenis, Keterangan, Masuk, Keluar, Saldo,
-- CabangID). Jenis: Masuk / Keluar.
create table if not exists kas (
  id text primary key,
  tanggal timestamptz not null default now(),
  jenis text not null default 'Masuk',
  keterangan text not null default '',
  masuk bigint not null default 0,
  keluar bigint not null default 0,
  saldo bigint not null default 0,
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. Resep, retur, stok per cabang & batch
-- ----------------------------------------------------------------------------

-- Resep (Sheet: Resep — ProdukID, BahanID, NamaBahan, QtyPakai)
-- No ID column in v3; composite PK (produk_id, bahan_id). QtyPakai can be
-- fractional (e.g. 0.5 kg), so numeric.
create table if not exists resep (
  produk_id text not null references produk (id) on delete cascade,
  bahan_id text not null references bahan_baku (id) on delete cascade,
  nama_bahan text not null default '',
  qty_pakai numeric(15,2) not null default 0,
  primary key (produk_id, bahan_id)
);

-- Retur (Sheet: Retur — ID, Tanggal, TransaksiID, Produk, Qty, Nominal,
-- Alasan, CabangID). Produk is a name string as in v3.
create table if not exists retur (
  id text primary key,
  tanggal timestamptz not null default now(),
  transaksi_id text references transaksi (id) on delete set null,
  produk text not null default '',
  qty bigint not null default 0,
  nominal bigint not null default 0,
  alasan text not null default '',
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- StokCabang (Sheet: StokCabang — CabangID, ProdukID, NamaProduk, Stok,
-- StokMinimum). No ID column in v3; composite PK (cabang_id, produk_id).
-- Cabang Utama uses produk.stok and needs no row here.
create table if not exists stok_cabang (
  cabang_id text not null references cabang (id) on delete cascade,
  produk_id text not null references produk (id) on delete cascade,
  nama_produk text not null default '',
  stok bigint not null default 0,
  stok_minimum bigint not null default 0,
  primary key (cabang_id, produk_id)
);

-- StokBatch (Sheet: StokBatch — ID, ProdukID, CabangID, Qty, Kedaluwarsa,
-- PembelianID, TanggalMasuk). Batches for FEFO + expiry warnings.
create table if not exists stok_batch (
  id text primary key, -- v4 choice: STB- prefix (no v3 prefix defined)
  produk_id text not null references produk (id) on delete cascade,
  cabang_id text references cabang (id) on delete cascade,
  qty bigint not null default 0,
  kedaluwarsa date,
  pembelian_id text references pembelian (id) on delete set null,
  tanggal_masuk timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. Poin, utang, transaksi cepat/tertunda, meja & dapur
-- ----------------------------------------------------------------------------

-- RiwayatPoin (Sheet: RiwayatPoin — ID, Tanggal, PelangganID, Pelanggan,
-- Jenis, Jumlah, Sisa, Keterangan, TransaksiID)
-- Jenis: Dapat / Tukar / Koreksi.
create table if not exists riwayat_poin (
  id text primary key,
  tanggal timestamptz not null default now(),
  pelanggan_id text references pelanggan (id) on delete cascade,
  pelanggan text not null default '',
  jenis text not null default 'Dapat',
  jumlah bigint not null default 0,
  sisa bigint not null default 0,
  keterangan text not null default '',
  transaksi_id text references transaksi (id) on delete set null
);

-- Utang (Sheet: Utang — ID, Tanggal, PembelianID, Pemasok, Total, Dibayar,
-- Sisa, Status). Status: Hutang / Lunas. Created automatically when a
-- processed pembelian has Sisa > 0.
create table if not exists utang (
  id text primary key,
  tanggal timestamptz not null default now(),
  pembelian_id text references pembelian (id) on delete set null,
  pemasok text not null default '',
  total bigint not null default 0,
  dibayar bigint not null default 0,
  sisa bigint not null default 0,
  status text not null default 'Hutang',
  created_at timestamptz not null default now()
);

-- CicilanUtang (Sheet: CicilanUtang — ID, UtangID, Tanggal, Nominal,
-- Keterangan)
create table if not exists cicilan_utang (
  id text primary key, -- v4 choice: CIC- prefix (no v3 prefix defined)
  utang_id text not null references utang (id) on delete cascade,
  tanggal timestamptz not null default now(),
  nominal bigint not null default 0,
  keterangan text not null default ''
);

-- TransaksiCepat (Sheet: TransaksiCepat — ID, Nama, Pelanggan, ItemsJSON,
-- CabangID). Named cart template; ItemsJSON e.g.
-- [{"id":"PRD-..","nama":"..","Harga":1000,"Qty":1}].
create table if not exists transaksi_cepat (
  id text primary key,
  nama text not null,
  pelanggan text not null default 'Umum',
  items_json jsonb not null default '[]'::jsonb,
  cabang_id text references cabang (id) on delete set null
);

-- TransaksiTertunda (Sheet: TransaksiTertunda — ID, Tanggal, Pelanggan,
-- Kasir, ItemsJSON, Total, CabangID, Meja, Catatan). Parked, unpaid sale.
create table if not exists transaksi_tertunda (
  id text primary key,
  tanggal timestamptz not null default now(),
  pelanggan text not null default 'Umum',
  kasir text not null default '',
  items_json jsonb not null default '[]'::jsonb,
  total bigint not null default 0,
  cabang_id text references cabang (id) on delete set null,
  meja text not null default '',
  catatan text not null default ''
);

-- Meja (Sheet: Meja — ID, Nama, CabangID, Status, TransaksiID)
-- Status: Kosong / Terisi / PerluDibersihkan.
create table if not exists meja (
  id text primary key,
  nama text not null,
  cabang_id text references cabang (id) on delete cascade,
  status text not null default 'Kosong',
  transaksi_id text references transaksi (id) on delete set null
);

-- PesananDapur (Sheet: PesananDapur — ID, TransaksiID, Meja, ItemsJSON,
-- Status, Tanggal, CabangID). Status: Baru / Dimasak / Selesai.
create table if not exists pesanan_dapur (
  id text primary key,
  transaksi_id text references transaksi (id) on delete cascade,
  meja text not null default '',
  items_json jsonb not null default '[]'::jsonb,
  status text not null default 'Baru',
  tanggal timestamptz not null default now(),
  cabang_id text references cabang (id) on delete set null
);

-- ----------------------------------------------------------------------------
-- 9. Katalog, pegawai, logs, opname, lapor_bos
-- ----------------------------------------------------------------------------

-- Katalog (Sheet: Katalog — ID, Nama, TampilkanGambar, TampilkanHarga,
-- TampilkanStok, SembunyikanStokKosong, TampilkanKeterangan, Footer, Aktif,
-- CabangID). One active katalog per cabang (default: the first).
create table if not exists katalog (
  id text primary key,
  nama text not null,
  tampilkan_gambar boolean not null default true,
  tampilkan_harga boolean not null default true,
  tampilkan_stok boolean not null default true,
  sembunyikan_stok_kosong boolean not null default false,
  tampilkan_keterangan boolean not null default true,
  footer text not null default '',
  aktif boolean not null default true,
  cabang_id text references cabang (id) on delete set null
);

-- Pegawai (Sheet: Pegawai — ID, Nama, Telepon, Jabatan, Target,
-- KomisiPersen, Aktif). For cashier targets & commission.
create table if not exists pegawai (
  id text primary key,
  nama text not null,
  telepon text not null default '',
  jabatan text not null default '',
  target bigint not null default 0,
  komisi_persen numeric(5,2) not null default 0,
  aktif boolean not null default true
);

-- Logs (Sheet: Logs — ID, Tanggal, Pengguna, Aksi, Detail, CabangID)
-- Audit trail of important actions.
create table if not exists logs (
  id text primary key, -- v4 choice: LOG- prefix (no v3 prefix defined)
  tanggal timestamptz not null default now(),
  pengguna text not null default '',
  aksi text not null default '',
  detail text not null default '',
  cabang_id text references cabang (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Opname (Sheet: Opname — ID, Tanggal, ProdukID, NamaProduk, StokSistem,
-- StokFisik, Selisih, Keterangan, CabangID, Pengguna)
create table if not exists opname (
  id text primary key,
  tanggal timestamptz not null default now(),
  produk_id text references produk (id) on delete set null,
  nama_produk text not null default '',
  stok_sistem bigint not null default 0,
  stok_fisik bigint not null default 0,
  selisih bigint not null default 0,
  keterangan text not null default '',
  cabang_id text references cabang (id) on delete set null,
  pengguna text not null default '',
  created_at timestamptz not null default now()
);

-- LaporBos (Sheet: LaporBos — ID, Tanggal, CabangID, Isi, Terkirim, Cara)
-- MANUAL ONLY (Bos decision 15 Nov 2026): only reports already sent by hand
-- are recorded here. Cara: WhatsApp / Cetak.
create table if not exists lapor_bos (
  id text primary key,
  tanggal timestamptz not null default now(),
  cabang_id text references cabang (id) on delete set null,
  isi text not null default '',
  terkirim boolean not null default false,
  cara text not null default 'WhatsApp',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. Helpful indexes (safe to re-run)
-- ----------------------------------------------------------------------------

create index if not exists idx_transaksi_tanggal on transaksi (tanggal);
create index if not exists idx_transaksi_cabang on transaksi (cabang_id);
create index if not exists idx_transaksi_detail_transaksi on transaksi_detail (transaksi_id);
create index if not exists idx_transaksi_detail_produk on transaksi_detail (produk_id);
create index if not exists idx_pembelian_detail_pembelian on pembelian_detail (pembelian_id);
create index if not exists idx_stok_batch_kedaluwarsa on stok_batch (kedaluwarsa);
create index if not exists idx_stok_batch_produk on stok_batch (produk_id);
create index if not exists idx_logs_tanggal on logs (tanggal);
create index if not exists idx_riwayat_poin_pelanggan on riwayat_poin (pelanggan_id);
create index if not exists idx_produk_cabang on produk (cabang_id);
create index if not exists idx_produk_aktif on produk (aktif);

-- ----------------------------------------------------------------------------
-- 11. Row Level Security — PERMISSIVE FOR v1 ONLY
-- ----------------------------------------------------------------------------
-- !!! WARNING: the policies below intentionally allow the `anon` role full
-- access to every table, because the v4 app uses only the Supabase anon key
-- for now. This is a v1 convenience, NOT production security.
-- Proper per-user auth is a LATER step: switch the app to the
-- `authenticated` role and replace these policies with per-cabang / per-peran
-- policies (e.g. kasir sees only their CabangAktif, admin sees all).
-- Do not ship this open policy to real multi-user production use as-is.

alter table cabang enable row level security;
alter table produk enable row level security;
alter table transaksi enable row level security;
alter table transaksi_detail enable row level security;
alter table pelanggan enable row level security;
alter table pemasok enable row level security;
alter table pembelian enable row level security;
alter table pembelian_detail enable row level security;
alter table pengeluaran enable row level security;
alter table kas enable row level security;
alter table pengaturan enable row level security;
alter table bahan_baku enable row level security;
alter table resep enable row level security;
alter table pengguna enable row level security;
alter table retur enable row level security;
alter table stok_cabang enable row level security;
alter table stok_batch enable row level security;
alter table riwayat_poin enable row level security;
alter table tier_member enable row level security;
alter table utang enable row level security;
alter table cicilan_utang enable row level security;
alter table transaksi_cepat enable row level security;
alter table transaksi_tertunda enable row level security;
alter table meja enable row level security;
alter table pesanan_dapur enable row level security;
alter table promo enable row level security;
alter table katalog enable row level security;
alter table daftar_teks enable row level security;
alter table grup_produk enable row level security;
alter table satuan enable row level security;
alter table jenis_pembayaran enable row level security;
alter table item_pengeluaran enable row level security;
alter table pegawai enable row level security;
alter table logs enable row level security;
alter table terjemahan enable row level security;
alter table opname enable row level security;
alter table lapor_bos enable row level security;

drop policy if exists "v1 anon all" on cabang;
create policy "v1 anon all" on cabang for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on produk;
create policy "v1 anon all" on produk for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on transaksi;
create policy "v1 anon all" on transaksi for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on transaksi_detail;
create policy "v1 anon all" on transaksi_detail for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pelanggan;
create policy "v1 anon all" on pelanggan for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pemasok;
create policy "v1 anon all" on pemasok for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pembelian;
create policy "v1 anon all" on pembelian for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pembelian_detail;
create policy "v1 anon all" on pembelian_detail for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pengeluaran;
create policy "v1 anon all" on pengeluaran for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on kas;
create policy "v1 anon all" on kas for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pengaturan;
create policy "v1 anon all" on pengaturan for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on bahan_baku;
create policy "v1 anon all" on bahan_baku for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on resep;
create policy "v1 anon all" on resep for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pengguna;
create policy "v1 anon all" on pengguna for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on retur;
create policy "v1 anon all" on retur for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on stok_cabang;
create policy "v1 anon all" on stok_cabang for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on stok_batch;
create policy "v1 anon all" on stok_batch for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on riwayat_poin;
create policy "v1 anon all" on riwayat_poin for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on tier_member;
create policy "v1 anon all" on tier_member for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on utang;
create policy "v1 anon all" on utang for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on cicilan_utang;
create policy "v1 anon all" on cicilan_utang for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on transaksi_cepat;
create policy "v1 anon all" on transaksi_cepat for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on transaksi_tertunda;
create policy "v1 anon all" on transaksi_tertunda for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on meja;
create policy "v1 anon all" on meja for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pesanan_dapur;
create policy "v1 anon all" on pesanan_dapur for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on promo;
create policy "v1 anon all" on promo for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on katalog;
create policy "v1 anon all" on katalog for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on daftar_teks;
create policy "v1 anon all" on daftar_teks for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on grup_produk;
create policy "v1 anon all" on grup_produk for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on satuan;
create policy "v1 anon all" on satuan for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on jenis_pembayaran;
create policy "v1 anon all" on jenis_pembayaran for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on item_pengeluaran;
create policy "v1 anon all" on item_pengeluaran for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on pegawai;
create policy "v1 anon all" on pegawai for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on logs;
create policy "v1 anon all" on logs for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on terjemahan;
create policy "v1 anon all" on terjemahan for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on opname;
create policy "v1 anon all" on opname for all to anon using (true) with check (true);
drop policy if exists "v1 anon all" on lapor_bos;
create policy "v1 anon all" on lapor_bos for all to anon using (true) with check (true);

-- ----------------------------------------------------------------------------
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

-- Pengaturan (18 keys)
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
