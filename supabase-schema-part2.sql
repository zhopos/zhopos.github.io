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
