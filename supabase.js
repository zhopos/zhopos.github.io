/* ============================================================
   Zho POS v4 — Lapisan Data (Supabase + Mode Contoh)
   - Bila SUPABASE_URL / SUPABASE_ANON_KEY di config.js terisi,
     semua baca/tulis memakai Supabase (tabel snake_case).
   - Bila kosong, dipakai DATA CONTOH di bawah (in-memory) sehingga
     aplikasi tetap bisa dicoba penuh: tambah keranjang, checkout,
     stok berkurang, dsb. Data contoh hilang saat halaman dimuat ulang.
   - Baris Supabase (snake_case) dipetakan ke objek aplikasi
     (PascalCase, sama seperti V12) saat dibaca, dan sebaliknya
     saat ditulis.
   ============================================================ */
(function () {
  'use strict';

  var CONFIGURED = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) &&
                   (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY);
  var client = null;
  if (CONFIGURED && window.supabase && window.supabase.createClient) {
    try { client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { client = null; }
  }
  var MODE = (CONFIGURED && client) ? 'supabase' : 'contoh';

  /* ---------- util ---------- */
  function todayStr(d) {
    var x = d ? new Date(d) : new Date();
    var m = String(x.getMonth() + 1).padStart(2, '0'), dd = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + dd;
  }
  function nowISO() {
    var x = new Date();
    // Sertakan offset zona waktu lokal (+07:00 untuk WIB) supaya Postgres
    // tidak mengira waktu lokal sebagai UTC (sebelumnya jam tampil +7 jam).
    var off = -x.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
    var oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), om = String(Math.abs(off) % 60).padStart(2, '0');
    return todayStr(x) + ' ' + String(x.getHours()).padStart(2, '0') + ':' +
      String(x.getMinutes()).padStart(2, '0') + ':' + String(x.getSeconds()).padStart(2, '0') + sign + oh + ':' + om;
  }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(); }
  function kodeAcak() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function parseJSON(s, fb) { try { return JSON.parse(s || ''); } catch (e) { return fb; } }

  /* ---------- pemetaan snake_case <-> PascalCase ---------- */
  var SPECIAL = { id: 'ID', sku: 'SKU', json: 'JSON', wa: 'WA', url: 'URL', pin: 'PIN', hpp: 'HPP' };
  function snakeToPascal(s) {
    return s.split('_').map(function (p) {
      var low = p.toLowerCase();
      if (SPECIAL[low]) return SPECIAL[low];
      return low.charAt(0).toUpperCase() + low.slice(1);
    }).join('');
  }
  function pascalToSnake(s) {
    // Tangani akronim: ID, SKU, JSON, WA, URL, PIN, HPP
    var out = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2');
    return out.toLowerCase().replace(/_i_d$/, '_id');
  }
  function toPascal(row) {
    var o = {};
    Object.keys(row || {}).forEach(function (k) { o[snakeToPascal(k)] = row[k]; });
    return o;
  }
  function toSnake(obj) {
    var o = {};
    Object.keys(obj || {}).forEach(function (k) {
      if (k === 'SKU/Barcode') { o.sku = obj[k]; return; }
      o[pascalToSnake(k)] = obj[k];
    });
    return o;
  }

  /* Tabel Supabase -> kunci DATA (bentuk getData V12) */
  var TABLE_KEY = {
    cabang: 'cabang', produk: 'produk', transaksi: 'transaksi', transaksi_detail: 'detail',
    pelanggan: 'pelanggan', pemasok: 'pemasok', pembelian: 'pembelian', pembelian_detail: 'pembelianDetail',
    pengeluaran: 'pengeluaran', kas: 'kas', bahan_baku: 'bahan', resep: 'resep', pengguna: 'pengguna',
    retur: 'retur', stok_cabang: 'stokCabang', stok_batch: 'stokBatch', riwayat_poin: 'riwayatPoin',
    tier_member: 'tier', utang: 'utang', cicilan_utang: 'cicilanUtang', transaksi_cepat: 'transaksiCepat',
    transaksi_tertunda: 'transaksiTertunda', meja: 'meja', pesanan_dapur: 'pesananDapur', promo: 'promo',
    katalog: 'katalog', daftar_teks: 'daftarTeks', grup_produk: 'grup', satuan: 'satuan',
    jenis_pembayaran: 'jenisBayar', item_pengeluaran: 'itemPengeluaran', pegawai: 'pegawai',
    logs: 'logs', opname: 'opname', lapor_bos: 'laporBos'
  };
  var TABLES = Object.keys(TABLE_KEY);

  /* ---------- DATA CONTOH — hanya dipakai bila Supabase belum dikonfigurasi ---------- */
  var TGL = todayStr();            // tanggal "hari ini" agar dashboard contoh menampilkan omzet
  var JAM = '09:28:24';            // jam transaksi contoh (sesuai contoh V12)
  var SAMPLE_DATA = {
    cabang: [{ id: 'CBG-UTAMA', nama: 'Cabang Utama', alamat: '', telepon: '', aktif: 'YA' }],
    produk: [{ id: 'PRD-TESKOPI', nama: 'TES Kopi', kategori: 'Minuman', sku: 'TESKOPI', harga_jual: 10000, harga_modal: 5000, stok: 9, satuan: 'pcs', aktif: 'YA', stok_minimum: 5, grup: '', gambar_url: '', keterangan: 'Produk contoh', harga_bisa_diganti: 'YA', termasuk_stok: 'YA', harga_lain_json: '', harga_jumlah_json: '', varian_json: '', tampilkan_di_katalog: 'YA', cabang_id: 'CBG-UTAMA' }],
    transaksi: [{ id: 'TRX-8250237222', tanggal: TGL + ' ' + JAM, pelanggan: 'Umum', kasir: 'Admin', total: 10000, diskon: 0, bayar: 10000, sisa: 0, metode: 'Tunai', status_bayar: 'Lunas', status_pesanan: 'Selesai', catatan: '', cabang_id: 'CBG-UTAMA', ongkir: 0, diskon_persen: 0, poin_dipakai: 0, poin_didapat: 10, kode_alternatif: '3SNQKW', meja: '', catatan_struk: '', catatan_internal: '', laba: 5000, promo_id: '' }],
    transaksi_detail: [{ transaksi_id: 'TRX-8250237222', produk_id: 'PRD-TESKOPI', nama_produk: 'TES Kopi', qty: 1, harga: 10000, subtotal: 10000, modal: 5000, diskon_item: 0, laba: 5000, satuan_dipakai: '' }],
    pelanggan: [{ id: 'PLG-UMUM', nama: 'Umum', telepon: '', alamat: '', total_beli: 10000, piutang: 0, poin: 0, tier: '', tanggal_lahir: '', terakhir_beli: TGL }],
    pemasok: [], pembelian: [], pembelian_detail: [], pengeluaran: [],
    kas: [{ id: 'KAS-1', tanggal: TGL + ' ' + JAM, jenis: 'Masuk', keterangan: 'Penjualan TRX-8250237222', masuk: 10000, keluar: 0, saldo: 10000, cabang_id: 'CBG-UTAMA' }],
    bahan_baku: [], resep: [],
    pengguna: [{ id: 'USR-ADMIN', nama: 'Admin', pin: '', peran: 'Admin', aktif: 'YA', izin_json: '{}', akses_transaksi: 'Tidak dibatasi', cabang_id: '' }],
    retur: [], stok_cabang: [], stok_batch: [], riwayat_poin: [],
    tier_member: [
      { tier: 'Silver', min_total_beli: 500000, diskon_persen: 2, manfaat: 'Diskon 2%' },
      { tier: 'Gold', min_total_beli: 2000000, diskon_persen: 5, manfaat: 'Diskon 5%' }
    ],
    utang: [], cicilan_utang: [], transaksi_cepat: [], transaksi_tertunda: [], meja: [], pesanan_dapur: [],
    promo: [], katalog: [{ id: 'KTG-UTAMA', nama: 'Katalog Utama', tampilkan_gambar: 'YA', tampilkan_harga: 'YA', tampilkan_stok: 'TIDAK', sembunyikan_stok_kosong: 'TIDAK', tampilkan_keterangan: 'YA', footer: 'Terima kasih sudah berbelanja!', aktif: 'YA', cabang_id: 'CBG-UTAMA' }],
    daftar_teks: [], grup_produk: [], satuan: [],
    jenis_pembayaran: ['Tunai', 'Debit', 'GoPay', 'OVO', 'QRIS', 'Shopeepay', 'Transfer Bank', 'VISA', 'MasterCard', 'e-Money'].map(function (n, i) { return { id: 'JB-' + (i + 1), nama: n, aktif: 'YA' }; }),
    item_pengeluaran: ['Air', 'Gas', 'Listrik', 'Lainnya'].map(function (n, i) { return { id: 'IP-' + (i + 1), nama: n }; }),
    pegawai: [],
    logs: [{ id: 'LOG-1', tanggal: TGL + ' ' + JAM, pengguna: 'Admin', aksi: 'Login', detail: 'Admin masuk (Mode Contoh)', cabang_id: 'CBG-UTAMA' }],
    terjemahan: ['Kasir', 'Pelanggan', 'Lunas', 'Kurang', 'Belum Dibayar', 'Total', 'Subtotal', 'Kembali', 'Proses', 'Selesai', 'Diambil', 'Antri'].map(function (k) { return { istilah: k, terjemahan: k }; }),
    opname: [], lapor_bos: [],
    pengaturan: {
      nama_toko: 'Zho POS', alamat_toko: '', telepon_toko: '', target_harian: 0,
      cabang_aktif: 'CBG-UTAMA', nomor_pemilik_wa: '', jatuh_tempo_hari: 7,
      poin_aktif: 'YA', poin_per_rupiah: 1000, poin_tukar_rate: 100,
      pajak_aktif: 'TIDAK', pajak_persen: 0, bahasa: 'id', format_tanggal: 'dd-mm-yyyy',
      mode_gelap: 'TIDAK', tampilkan_poin_struk: 'YA', watermark_struk: 'TIDAK',
      struk_ukuran_kertas: '58', mode_meja_aktif: 'TIDAK', promo_aktif: 'YA', multi_cabang_aktif: 'YA'
    }
  };

  /* DATA adalah salinan kerja (in-memory). Mode contoh: dari SAMPLE_DATA.
     Mode Supabase: diisi loadAll() dari Supabase, lalu ditulis balik per baris. */
  var DATA = null;

  function emptyData() {
    var d = { pengaturan: {}, terjemahan: {}, ringkasan: {} };
    TABLES.forEach(function (t) { d[TABLE_KEY[t]] = []; });
    return d;
  }
  function sampleToData() {
    var d = emptyData();
    TABLES.forEach(function (t) {
      d[TABLE_KEY[t]] = (SAMPLE_DATA[t] || []).map(toPascal);
    });
    d.pengaturan = {};
    Object.keys(SAMPLE_DATA.pengaturan).forEach(function (k) { d.pengaturan[snakeToPascal(k)] = SAMPLE_DATA.pengaturan[k]; });
    d.terjemahan = {};
    (SAMPLE_DATA.terjemahan || []).forEach(function (r) { d.terjemahan[r.istilah] = r.terjemahan; });
    return d;
  }

  /* ---------- ringkasan (dihitung dari DATA, sama seperti V12) ---------- */
  function computeRingkasan(d) {
    var tgl = todayStr();
    var trxHariIni = (d.transaksi || []).filter(function (t) { return String(t.Tanggal || '').slice(0, 10) === tgl; });
    var lunasHariIni = trxHariIni.filter(function (t) { return t.StatusBayar === 'Lunas'; });
    var omzet = lunasHariIni.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
    var laba = lunasHariIni.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
    var dibayar = trxHariIni.reduce(function (a, t) { return a + Number(t.Bayar || 0); }, 0);
    var piutang = (d.transaksi || []).filter(function (t) { return t.StatusBayar !== 'Lunas'; })
      .reduce(function (a, t) { return a + Number(t.Sisa || 0); }, 0);
    var hutang = (d.utang || []).filter(function (u) { return u.Status !== 'Lunas'; })
      .reduce(function (a, u) { return a + Number(u.Sisa || 0); }, 0);
    var saldoKas = (d.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0);
    var stokTipisList = (d.produk || []).filter(function (p) {
      return stokOf(d, p) <= Number(p.StokMinimum == null ? 5 : p.StokMinimum);
    }).map(function (p) { return { nama: p.Nama, stok: stokOf(d, p), satuan: p.Satuan || '' }; });
    var kedaluwarsaList = (d.stokBatch || []).filter(function (b) {
      if (!b.Kedaluwarsa || Number(b.Qty) <= 0) return false;
      var diff = (new Date(b.Kedaluwarsa) - new Date(tgl)) / 86400000;
      return diff <= 7;
    }).map(function (b) {
      var p = (d.produk || []).find(function (x) { return x.ID === b.ProdukID; });
      return { nama: p ? p.Nama : (b.NamaProduk || ''), Kedaluwarsa: b.Kedaluwarsa, NamaProduk: p ? p.Nama : '' };
    });
    // analitik 7 & 28 hari
    function analitik(n) {
      var perHari = [], om = 0, lb = 0, jml = 0;
      for (var i = n - 1; i >= 0; i--) {
        var dt = new Date(); dt.setDate(dt.getDate() - i);
        var ds = todayStr(dt);
        var list = (d.transaksi || []).filter(function (t) { return String(t.Tanggal || '').slice(0, 10) === ds && t.StatusBayar === 'Lunas'; });
        var o = list.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
        var l = list.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
        perHari.push({ tanggal: ds, omzet: o, laba: l, jumlah: list.length });
        om += o; lb += l; jml += list.length;
      }
      return { omzet: om, laba: lb, jumlah: jml, perHari: perHari };
    }
    // terlaris & pelanggan top (semua waktu)
    var jual = {};
    (d.detail || []).forEach(function (x) { jual[x.NamaProduk] = (jual[x.NamaProduk] || 0) + Number(x.Qty || 0); });
    var terlaris = Object.keys(jual).map(function (k) { return { nama: k, qty: jual[k] }; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
    var pelangganTop = (d.pelanggan || []).filter(function (p) { return Number(p.TotalBeli || 0) > 0; })
      .map(function (p) { return { nama: p.Nama, total: Number(p.TotalBeli || 0) }; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
    var perCabang = (d.cabang || []).map(function (c) {
      var lt = (d.transaksi || []).filter(function (t) { return String(t.CabangID || '') === String(c.ID) && String(t.Tanggal || '').slice(0, 10) === tgl && t.StatusBayar === 'Lunas'; });
      return {
        cabangId: c.ID, nama: c.Nama,
        omzetHariIni: lt.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0),
        labaHariIni: lt.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0),
        jumlahTrx: lt.length, stokMenipis: stokTipisList.length
      };
    });
    var a7 = analitik(7), a28 = analitik(28);
    var kem = a7.perHari.length >= 2 ? a7.perHari[a7.perHari.length - 2].omzet : 0;
    return {
      omzetHariIni: omzet, labaHariIni: laba, dibayarHariIni: dibayar,
      jumlahTrxHariIni: trxHariIni.length, piutang: piutang, hutang: hutang,
      saldoKas: saldoKas, stokMenipis: stokTipisList.length, stokTipisList: stokTipisList,
      kedaluwarsaList: kedaluwarsaList, targetHarian: Number((d.pengaturan || {}).TargetHarian || 0),
      terlaris: terlaris, pelangganTop: pelangganTop, analitik7: a7, analitik28: a28,
      omzetKemarin: kem, perCabang: perCabang,
      poinAktif: (d.pengaturan || {}).PoinAktif !== 'TIDAK',
      modeMejaAktif: (d.pengaturan || {}).ModeMejaAktif === 'YA',
      promoAktif: (d.pengaturan || {}).PromoAktif !== 'TIDAK',
      pajakAktif: (d.pengaturan || {}).PajakAktif === 'YA'
    };
  }
  function cabangAktifId(d) {
    return (d.pengaturan || {}).CabangAktif || ((d.cabang || [])[0] && d.cabang[0].ID) || '';
  }
  function stokOf(d, p) {
    var sc = (d.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cabangAktifId(d)); });
    if (sc) return Number(sc.Stok || 0);
    return Number(p.Stok || 0);
  }
  function setStok(d, p, nilai) {
    var sc = (d.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cabangAktifId(d)); });
    if (sc) { sc.Stok = nilai; return sc; }
    p.Stok = nilai; return p;
  }
  function addLog(d, pengguna, aksi, detail) {
    var row = { ID: uid('LOG'), Tanggal: nowISO(), Pengguna: pengguna || '', Aksi: aksi, Detail: detail || '', CabangID: cabangAktifId(d) };
    d.logs.unshift(row);
    if (d.logs.length > 100) d.logs.length = 100;
    persist('logs', row);
    return row;
  }

  /* ---------- persistensi Supabase (no-op di Mode Contoh) ---------- */
  function tableOfKey(key) {
    for (var t in TABLE_KEY) if (TABLE_KEY[t] === key) return t;
    return null;
  }
  async function persist(table, pascalRow, conflictKey) {
    if (MODE !== 'supabase' || !client) return;
    var row = toSnake(pascalRow);
    // FK kosong ('') tidak valid di Postgres (23503) — ubah jadi null (tanpa referensi).
    Object.keys(row).forEach(function (k) {
      if (k.length > 2 && k.slice(-3) === '_id' && row[k] === '') row[k] = null;
    });
    var conflict = conflictKey || 'id';
    if (row[conflict] == null || row[conflict] === '') {
      // Baris tanpa kunci konflik (detail, resep, riwayat poin): insert biasa.
      var ins = await client.from(table).insert(row);
      if (ins.error) throw new Error(ins.error.message);
      return;
    }
    var res = await client.from(table).upsert(row, { onConflict: conflict });
    if (res.error) throw new Error(res.error.message);
  }
  async function removeRow(table, id) {
    if (MODE !== 'supabase' || !client) return;
    var res = await client.from(table).delete().eq('id', id);
    if (res.error) throw new Error(res.error.message);
  }
  async function persistPengaturan() {
    if (MODE !== 'supabase' || !client) return;
    var rows = Object.keys(DATA.pengaturan).map(function (k) {
      return { kunci: pascalToSnake(k), nilai: String(DATA.pengaturan[k] == null ? '' : DATA.pengaturan[k]) };
    });
    var res = await client.from('pengaturan').upsert(rows, { onConflict: 'kunci' });
    if (res.error) throw new Error(res.error.message);
  }
  async function persistTerjemahan() {
    if (MODE !== 'supabase' || !client) return;
    var rows = Object.keys(DATA.terjemahan).map(function (k) { return { istilah: k, terjemahan: DATA.terjemahan[k] }; });
    var res = await client.from('terjemahan').upsert(rows, { onConflict: 'istilah' });
    if (res.error) throw new Error(res.error.message);
  }

  /* ---------- loadAll ---------- */
  async function loadAll() {
    if (MODE === 'contoh') {
      DATA = sampleToData();
      DATA.ringkasan = computeRingkasan(DATA);
      return DATA;
    }
    var d = emptyData();
    // Muat semua tabel paralel (sebelumnya berurutan: 35x round-trip, puluhan detik).
    var results = await Promise.all(TABLES.map(function (t) { return client.from(t).select('*'); }));
    for (var i = 0; i < TABLES.length; i++) {
      var t = TABLES[i], res = results[i];
      if (res.error) throw new Error('Supabase: gagal memuat ' + t + ' — ' + res.error.message);
      d[TABLE_KEY[t]] = (res.data || []).map(toPascal);
    }
    // pengaturan: tabel kunci/nilai -> object
    var rp = await client.from('pengaturan').select('*');
    if (!rp.error) (rp.data || []).forEach(function (r) { d.pengaturan[snakeToPascal(r.kunci)] = r.nilai; });
    // terjemahan: tabel istilah/terjemahan -> object
    var rt = await client.from('terjemahan').select('*');
    if (!rt.error) (rt.data || []).forEach(function (r) { d.terjemahan[r.istilah] = r.terjemahan; });
    DATA = d;
    DATA.ringkasan = computeRingkasan(DATA);
    return DATA;
  }
  function refreshRingkasan() { if (DATA) DATA.ringkasan = computeRingkasan(DATA); }
  function getData() { return DATA; }

  /* ---------- login ---------- */
  async function login(nama, pin) {
    if (!DATA) await loadAll();
    var list = DATA.pengguna || [];
    if (!list.length) return { ok: true, nama: nama || 'Admin', peran: 'Admin', ID: '', IzinJSON: '{}' };
    var u = list.find(function (x) { return String(x.Nama).toLowerCase() === String(nama || '').trim().toLowerCase(); });
    if (!u) return { ok: false, error: 'Pengguna tidak ditemukan.' };
    if (String(u.PIN || '') !== String(pin || '')) return { ok: false, error: 'PIN salah.' };
    if (String(u.Aktif || 'YA').toUpperCase() === 'TIDAK') return { ok: false, error: 'Pengguna tidak aktif.' };
    addLog(DATA, u.Nama, 'Login', u.Nama + ' masuk');
    return { ok: true, nama: u.Nama, peran: u.Peran, ID: u.ID, CabangID: u.CabangID || '', IzinJSON: u.IzinJSON || '{}', AksesTransaksi: u.AksesTransaksi || 'Tidak dibatasi' };
  }

  /* ---------- promo ---------- */
  function hitungPromoSync(items, pelangganNama, total, cabangId) {
    var diskon = 0, terpakai = [];
    if ((DATA.pengaturan || {}).PromoAktif === 'TIDAK') return { diskon: 0, promoTerpakai: [] };
    var now = new Date();
    var hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()];
    (DATA.promo || []).forEach(function (p) {
      if (String(p.Aktif || 'YA').toUpperCase() === 'TIDAK') return;
      if (p.CabangID && cabangId && String(p.CabangID) !== String(cabangId)) return;
      if (p.Mulai && todayStr() < String(p.Mulai).slice(0, 10)) return;
      if (p.Selesai && todayStr() > String(p.Selesai).slice(0, 10)) return;
      if (p.Hari && String(p.Hari).indexOf(hariIni) < 0) return;
      if (p.JamMulai || p.JamSelesai) {
        var jam = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        if (p.JamMulai && jam < p.JamMulai) return;
        if (p.JamSelesai && jam > p.JamSelesai) return;
      }
      var syarat = parseJSON(p.SyaratJSON || '{}', {});
      var nilai = Number(p.Nilai || 0);
      if (p.Jenis === 'BeliXGratisY' && syarat.produkId) {
        var it = (items || []).find(function (x) { return String(x.id) === String(syarat.produkId); });
        if (it && Number(it.Qty) >= Number(syarat.beli || 2)) {
          var gratis = Math.floor(Number(it.Qty) / Number(syarat.beli || 2)) * Number(syarat.gratis || 1);
          diskon += gratis * Number(it.Harga || 0);
          terpakai.push({ id: p.ID, nama: p.Nama });
        }
      } else if (p.Jenis === 'DiskonPersen') {
        if (!syarat.minTotal || total >= Number(syarat.minTotal)) { diskon += Math.round(total * nilai / 100); terpakai.push({ id: p.ID, nama: p.Nama }); }
      } else if (p.Jenis === 'DiskonNominal' || p.Jenis === 'HappyHour' || p.Jenis === 'Bundling') {
        if (!syarat.minTotal || total >= Number(syarat.minTotal)) { diskon += nilai; terpakai.push({ id: p.ID, nama: p.Nama }); }
      }
    });
    return { diskon: diskon, promoTerpakai: terpakai };
  }
  async function hitungPromo(p) {
    if (!DATA) await loadAll();
    return hitungPromoSync(p.items || [], p.pelanggan || '', Number(p.total || 0), p.cabangId || cabangAktifId(DATA));
  }

  /* ---------- simpanTransaksi (aturan SCHEMA §2/§4) ---------- */
  async function saveTransaksi(payload) {
    if (!DATA) await loadAll();
    var items = payload.items || [];
    if (!items.length) throw new Error('Keranjang masih kosong.');
    var cabangId = payload.cabangId || cabangAktifId(DATA);
    var p = DATA.pengaturan || {};
    // 1. Hitung ulang dari item (jangan percaya total dari luar)
    var sub = 0, diskonItemTotal = 0;
    items.forEach(function (it) {
      var qty = Number(it.Qty || 0);
      sub += Number(it.Harga || 0) * qty;
      diskonItemTotal += Number(it.diskonItem || 0) * qty;
    });
    var setelahItem = Math.max(0, sub - diskonItemTotal);
    var diskonTotal = Number(payload.diskon || 0);
    if (Number(payload.diskonPersen || 0) > 0) diskonTotal = Math.round(setelahItem * Number(payload.diskonPersen) / 100);
    diskonTotal = Math.min(diskonTotal, setelahItem);
    var promo = hitungPromoSync(items, payload.pelanggan || 'Umum', setelahItem, cabangId);
    var promoDiskon = promo.diskon;
    var poinDipakai = Number(payload.poinDipakai || 0);
    var poinDiskon = poinDipakai > 0 ? Math.floor(poinDipakai / 100) * 1000 : 0;
    var ongkir = Number(payload.ongkir || 0);
    var pajak = 0;
    if (p.PajakAktif === 'YA') pajak = Math.round((setelahItem - diskonTotal) * Number(p.PajakPersen || 0) / 100);
    var total = Math.max(0, setelahItem - diskonTotal - promoDiskon - poinDiskon + pajak + ongkir);
    var bayar = Number(payload.bayar || 0);
    var sisa = Math.max(0, total - bayar);
    var statusBayar = sisa === 0 ? 'Lunas' : (bayar > 0 ? 'Kurang' : 'Belum Dibayar');
    // 2. Cek stok per cabang (lewati jasa / TermasukStok=TIDAK)
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var prod = DATA.produk.find(function (x) { return String(x.ID) === String(it.id); });
      if (!prod) continue;
      var termasuk = String(prod.TermasukStok == null ? 'YA' : prod.TermasukStok).toUpperCase() !== 'TIDAK';
      if (!termasuk) continue;
      var isi = 1;
      if (it.satuanDipakai) {
        var vr = parseJSON(prod.VarianJSON || '[]', []);
        var v = vr.find(function (x) { return x.label === it.satuanDipakai; });
        if (v) isi = Number(v.isi || 1);
      }
      var butuh = Number(it.Qty || 0) * isi;
      if (stokOf(DATA, prod) < butuh) throw new Error('Stok produk tidak mencukupi: ' + prod.Nama);
      // bahan baku via resep
      (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
        var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
        if (b && Number(b.Stok || 0) < Number(r.QtyPakai || 0) * butuh) throw new Error('Stok bahan tidak mencukupi: ' + b.Nama);
      });
    }
    // 3. Siapkan pengurangan stok (FEFO: batch paling cepat kedaluwarsa dulu) + bahan.
    //    HANYA dihitung di sini — diterapkan setelah transaksi tersimpan (langkah 4b),
    //    supaya bila simpan transaksi gagal, stok TIDAK ikut berkurang.
    var labaTotal = 0;
    var stokChanges = [];
    var bahanChanges = [];
    items.forEach(function (it) {
      var prod = DATA.produk.find(function (x) { return String(x.ID) === String(it.id); });
      if (!prod) return;
      var isi = 1;
      if (it.satuanDipakai) {
        var vr = parseJSON(prod.VarianJSON || '[]', []);
        var v = vr.find(function (x) { return x.label === it.satuanDipakai; });
        if (v) isi = Number(v.isi || 1);
      }
      var butuh = Number(it.Qty || 0) * isi;
      var termasuk = String(prod.TermasukStok == null ? 'YA' : prod.TermasukStok).toUpperCase() !== 'TIDAK';
      if (termasuk) {
        var sisaButuh = butuh;
        var batches = (DATA.stokBatch || []).filter(function (b) { return String(b.ProdukID) === String(prod.ID) && String(b.CabangID) === String(cabangId) && Number(b.Qty) > 0; })
          .sort(function (a, b) { return String(a.Kedaluwarsa || '9999') < String(b.Kedaluwarsa || '9999') ? -1 : 1; });
        var batchChanges = [];
        batches.forEach(function (b) {
          if (sisaButuh <= 0) return;
          var ambil = Math.min(Number(b.Qty), sisaButuh);
          batchChanges.push({ row: b, ambil: ambil });
          sisaButuh -= ambil;
        });
        var baru = stokOf(DATA, prod) - butuh;
        var sc = (DATA.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(prod.ID) && String(x.CabangID) === String(cabangId); });
        stokChanges.push({ prod: prod, baru: baru, batchChanges: batchChanges, sc: sc });
      }
      (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
        var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
        if (b) bahanChanges.push({ row: b, qty: Number(r.QtyPakai || 0) * butuh });
      });
      var modal = Number(it.modal != null ? it.modal : (prod ? prod.HargaModal || 0 : 0));
      it._laba = (Number(it.Harga || 0) - modal) * Number(it.Qty || 0) - Number(it.diskonItem || 0) * Number(it.Qty || 0);
      labaTotal += it._laba;
    });
    labaTotal -= diskonTotal + promoDiskon + poinDiskon;
    // 4. Simpan transaksi + detail
    var id = uid('TRX');
    var trx = {
      ID: id, Tanggal: nowISO(), Pelanggan: payload.pelanggan || 'Umum', Kasir: payload.kasir || '',
      Total: total, Diskon: diskonTotal, Bayar: bayar, Sisa: sisa, Metode: payload.metode || 'Tunai',
      StatusBayar: statusBayar, StatusPesanan: payload.statusPesanan || 'Selesai',
      Catatan: payload.catatan || '', CabangID: cabangId, Ongkir: ongkir,
      DiskonPersen: Number(payload.diskonPersen || 0), PoinDipakai: poinDipakai,
      PoinDidapat: 0, KodeAlternatif: payload.kodeAlternatif || kodeAcak(),
      Meja: payload.meja || '', CatatanStruk: payload.catatanStruk || '',
      CatatanInternal: payload.catatanInternal || '', Laba: labaTotal,
      PromoID: promo.promoTerpakai.length ? promo.promoTerpakai[0].id : (payload.promoId || null)
    };
    // Transaksi disimpan DULU; bila ini gagal (throw), tidak ada stok/bahan yang berubah.
    await persist('transaksi', trx);
    DATA.transaksi.unshift(trx);
    // 4b. Terapkan pengurangan stok + bahan (transaksi sudah tersimpan).
    stokChanges.forEach(function (c) {
      c.batchChanges.forEach(function (bc) { bc.row.Qty = Number(bc.row.Qty) - bc.ambil; persist('stok_batch', bc.row); });
      setStok(DATA, c.prod, c.baru);
      persist('produk', c.prod);
      if (c.sc) persist('stok_cabang', c.sc);
    });
    bahanChanges.forEach(function (bc) { bc.row.Stok = Number(bc.row.Stok || 0) - bc.qty; persist('bahan_baku', bc.row); });
    items.forEach(function (it) {
      var prod = DATA.produk.find(function (x) { return String(x.ID) === String(it.id); });
      var det = {
        TransaksiID: id, ProdukID: it.id, NamaProduk: it.nama || (prod ? prod.Nama : ''),
        Qty: Number(it.Qty || 0), Harga: Number(it.Harga || 0),
        Subtotal: Number(it.Harga || 0) * Number(it.Qty || 0),
        Modal: Number(it.modal != null ? it.modal : (prod ? prod.HargaModal || 0 : 0)),
        DiskonItem: Number(it.diskonItem || 0), Laba: it._laba || 0,
        SatuanDipakai: it.satuanDipakai || ''
      };
      DATA.detail.unshift(det);
      persist('transaksi_detail', det);
    });
    // 5. Pelanggan: TotalBeli / Piutang / Poin / Tier / TerakhirBeli
    var poinDidapat = 0;
    var pl = (DATA.pelanggan || []).find(function (x) { return x.Nama === trx.Pelanggan; });
    if (pl) {
      pl.TotalBeli = Number(pl.TotalBeli || 0) + total;
      pl.Piutang = Number(pl.Piutang || 0) + sisa;
      pl.TerakhirBeli = todayStr();
      if (poinDipakai > 0) {
        pl.Poin = Math.max(0, Number(pl.Poin || 0) - poinDipakai);
        DATA.riwayatPoin.unshift({ ID: uid('PNT'), Tanggal: nowISO(), PelangganID: pl.ID, Pelanggan: pl.Nama, Jenis: 'Tukar', Jumlah: -poinDipakai, Sisa: pl.Poin, Keterangan: 'Tukar poin di ' + id, TransaksiID: id });
        persist('riwayat_poin', DATA.riwayatPoin[0]);
      }
      if (p.PoinAktif !== 'TIDAK' && pl.Nama !== 'Umum' && statusBayar === 'Lunas' && poinDipakai === 0) {
        poinDidapat = Math.floor(total / Number(p.PoinPerRupiah || 1000));
        if (poinDidapat > 0) {
          pl.Poin = Number(pl.Poin || 0) + poinDidapat;
          DATA.riwayatPoin.unshift({ ID: uid('PNT'), Tanggal: nowISO(), PelangganID: pl.ID, Pelanggan: pl.Nama, Jenis: 'Dapat', Jumlah: poinDidapat, Sisa: pl.Poin, Keterangan: 'Poin dari ' + id, TransaksiID: id });
          persist('riwayat_poin', DATA.riwayatPoin[0]);
        }
      }
      // tier otomatis dari TotalBeli
      var tiers = (DATA.tier || []).slice().sort(function (a, b) { return Number(b.MinTotalBeli) - Number(a.MinTotalBeli); });
      for (var ti = 0; ti < tiers.length; ti++) {
        if (Number(pl.TotalBeli || 0) >= Number(tiers[ti].MinTotalBeli)) { pl.Tier = tiers[ti].Tier; break; }
      }
      trx.PoinDidapat = poinDidapat;
      await persist('pelanggan', pl);
      await persist('transaksi', trx);
    }
    // 6. Kas bila ada pembayaran
    if (bayar > 0) {
      var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) + bayar;
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Masuk', Keterangan: 'Penjualan ' + id, Masuk: bayar, Keluar: 0, Saldo: saldo, CabangID: cabangId };
      DATA.kas.push(kasRow);
      await persist('kas', kasRow);
    }
    // 7. Pesanan dapur bila mode meja aktif dan meja diisi
    if (p.ModeMejaAktif === 'YA' && trx.Meja) {
      var dapur = { ID: uid('DPR'), TransaksiID: id, Meja: trx.Meja, ItemsJSON: JSON.stringify(items.map(function (x) { return { nama: x.nama, Qty: x.Qty }; })), Status: 'Baru', Tanggal: nowISO(), CabangID: cabangId };
      DATA.pesananDapur.unshift(dapur);
      await persist('pesanan_dapur', dapur);
      var mj = (DATA.meja || []).find(function (m) { return m.Nama === trx.Meja; });
      if (mj) { mj.Status = 'Terisi'; mj.TransaksiID = id; await persist('meja', mj); }
    }
    addLog(DATA, trx.Kasir, 'Simpan Transaksi', id + ' — ' + trx.Pelanggan + ' — Total ' + total);
    refreshRingkasan();
    return { ok: true, id: id, total: total, sisa: sisa, statusBayar: statusBayar, poinDidapat: poinDidapat, laba: labaTotal, rugi: labaTotal < 0, kodeAlternatif: trx.KodeAlternatif };
  }

  /* ---------- helper upsert generik ---------- */
  function upsertInto(key, table, row, prefix, idField) {
    if (!DATA) throw new Error('Data belum dimuat.');
    var arr = DATA[key];
    var id = row[idField || 'ID'] || row.id;
    if (id) {
      var ex = arr.find(function (x) { return String(x.ID) === String(id); });
      if (ex) { Object.keys(row).forEach(function (k) { ex[k] = row[k]; }); persist(table, ex); refreshRingkasan(); return ex; }
    }
    row.ID = id || uid(prefix);
    arr.unshift(row);
    persist(table, row);
    refreshRingkasan();
    return row;
  }
  function hapusDari(key, table, id) {
    var arr = DATA[key];
    var i = arr.findIndex(function (x) { return String(x.ID) === String(id); });
    if (i >= 0) arr.splice(i, 1);
    removeRow(table, id);
    refreshRingkasan();
  }
  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'); }

  /* ---------- produk / pelanggan / pemasok ---------- */
  async function upsertProduk(payload) {
    if (!DATA) await loadAll();
    var row = {
      ID: payload.ID || '', Nama: payload.Nama, Kategori: payload.Kategori || '', Grup: payload.Grup || '',
      SKU: payload.SKU || '', HargaJual: Number(payload.HargaJual || 0), HargaModal: Number(payload.HargaModal || 0),
      Stok: Number(payload.Stok == null || payload.Stok === '' ? 0 : payload.Stok),
      Satuan: payload.Satuan || 'pcs', Aktif: 'YA', StokMinimum: Number(payload.StokMinimum || 5),
      GambarURL: payload.GambarURL || '', Keterangan: payload.Keterangan || '',
      HargaBisaDiganti: payload.HargaBisaDiganti || 'YA', TermasukStok: payload.TermasukStok || 'YA',
      HargaLainJSON: payload.HargaLainJSON || '', HargaJumlahJSON: payload.HargaJumlahJSON || '',
      VarianJSON: payload.VarianJSON || '', TampilkanDiKatalog: payload.TampilkanDiKatalog || 'YA',
      CabangID: payload.CabangID || cabangAktifId(DATA)
    };
    return upsertInto('produk', 'produk', row, 'PRD');
  }
  async function hapusProduk(id) { if (!DATA) await loadAll(); hapusDari('produk', 'produk', id); return { ok: true }; }
  async function upsertPelanggan(payload) {
    if (!DATA) await loadAll();
    var row = {
      ID: payload.ID || '', Nama: payload.Nama, Telepon: payload.Telepon || '', Alamat: payload.Alamat || '',
      TotalBeli: Number(payload.TotalBeli || 0), Piutang: Number(payload.Piutang || 0),
      Poin: Number(payload.Poin || 0), Tier: payload.Tier || '', TanggalLahir: payload.TanggalLahir || '',
      TerakhirBeli: payload.TerakhirBeli || ''
    };
    var ex = row.ID ? DATA.pelanggan.find(function (x) { return x.ID === row.ID; }) : null;
    if (ex) { row.TotalBeli = ex.TotalBeli; row.Piutang = ex.Piutang; row.Poin = ex.Poin; row.TerakhirBeli = ex.TerakhirBeli; }
    return upsertInto('pelanggan', 'pelanggan', row, 'PLG');
  }
  async function upsertPemasok(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, Telepon: payload.Telepon || '', Alamat: payload.Alamat || '', Hutang: Number(payload.Hutang || 0) };
    var ex = row.ID ? DATA.pemasok.find(function (x) { return x.ID === row.ID; }) : null;
    if (ex) row.Hutang = ex.Hutang;
    return upsertInto('pemasok', 'pemasok', row, 'PMS');
  }

  /* ---------- pengeluaran & kas ---------- */
  async function simpanPengeluaran(payload) {
    if (!DATA) await loadAll();
    var row = { ID: uid('PGL'), Tanggal: nowISO(), Kategori: payload.kategori || 'Lainnya', Keterangan: payload.keterangan || '', Nominal: Number(payload.nominal || 0), EfekLaba: payload.efekLaba || 'TidakMengurangi', CabangID: payload.cabangId || cabangAktifId(DATA) };
    DATA.pengeluaran.unshift(row); await persist('pengeluaran', row);
    var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) - row.Nominal;
    var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Pengeluaran: ' + row.Kategori + ' — ' + row.Keterangan, Masuk: 0, Keluar: row.Nominal, Saldo: saldo, CabangID: row.CabangID };
    DATA.kas.push(kasRow); await persist('kas', kasRow);
    addLog(DATA, '', 'Pengeluaran', row.Kategori + ' — ' + row.Nominal);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }
  async function simpanUangKas(payload) {
    if (!DATA) await loadAll();
    var nominal = Number(payload.nominal || 0);
    var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) + (payload.jenis === 'Keluar' ? -nominal : nominal);
    var row = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: payload.jenis || 'Masuk', Keterangan: payload.keterangan || '', Masuk: payload.jenis === 'Keluar' ? 0 : nominal, Keluar: payload.jenis === 'Keluar' ? nominal : 0, Saldo: saldo, CabangID: payload.cabangId || cabangAktifId(DATA) };
    DATA.kas.push(row); await persist('kas', row);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }

  /* ---------- pembelian & utang ---------- */
  async function simpanPembelian(payload) {
    if (!DATA) await loadAll();
    var id = uid('PBL');
    var total = Number(payload.total || 0);
    var row = { ID: id, Tanggal: nowISO(), Pemasok: payload.pemasok || '', Total: total, Bayar: Number(payload.bayar || 0), Sisa: total - Number(payload.bayar || 0), Status: 'Draft', Catatan: payload.catatan || '', CabangID: payload.cabangId || cabangAktifId(DATA), Diskon: Number(payload.diskon || 0), Pajak: Number(payload.pajak || 0), BiayaLain: Number(payload.biayaLain || 0), Diproses: 'TIDAK' };
    DATA.pembelian.unshift(row); await persist('pembelian', row);
    (payload.items || []).forEach(function (it) {
      var det = { PembelianID: id, ProdukID: it.id, NamaProduk: it.nama, Qty: Number(it.Qty || 0), HargaBeli: Number(it.HargaBeli || 0), Subtotal: Number(it.Qty || 0) * Number(it.HargaBeli || 0), Kedaluwarsa: it.Kedaluwarsa || '' };
      DATA.pembelianDetail.push(det); persist('pembelian_detail', det);
    });
    addLog(DATA, '', 'Pembelian Draft', id + ' — ' + row.Pemasok + ' — ' + total);
    refreshRingkasan(); return { ok: true, id: id };
  }
  async function prosesPembelian(payload) {
    if (!DATA) await loadAll();
    var id = payload.id || payload.ID;
    var p = DATA.pembelian.find(function (x) { return x.ID === id; });
    if (!p) throw new Error('Pembelian tidak ditemukan.');
    if (p.Diproses === 'YA') throw new Error('Pembelian sudah diproses.');
    var cabangId = p.CabangID || cabangAktifId(DATA);
    var items = DATA.pembelianDetail.filter(function (x) { return x.PembelianID === id; });
    items.forEach(function (it) {
      var prod = DATA.produk.find(function (x) { return x.ID === it.ProdukID; });
      if (prod) {
        prod.Stok = Number(prod.Stok || 0) + Number(it.Qty || 0);
        persist('produk', prod);
        if (it.Kedaluwarsa) {
          var batch = { ID: uid('BTH'), ProdukID: it.ProdukID, CabangID: cabangId, Qty: Number(it.Qty || 0), Kedaluwarsa: it.Kedaluwarsa, PembelianID: id, TanggalMasuk: todayStr() };
          DATA.stokBatch.push(batch); persist('stok_batch', batch);
        }
      }
    });
    p.Diproses = 'YA'; p.Status = 'Diproses';
    await persist('pembelian', p);
    // pengeluaran + kas keluar sebesar Bayar
    var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0);
    var pg = { ID: uid('PGL'), Tanggal: nowISO(), Kategori: 'Pembelian', Keterangan: 'Pembelian ' + id + ' — ' + p.Pemasok, Nominal: p.Total, EfekLaba: 'TidakMengurangi', CabangID: cabangId };
    DATA.pengeluaran.unshift(pg); await persist('pengeluaran', pg);
    if (Number(p.Bayar || 0) > 0) {
      saldo -= Number(p.Bayar);
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Pembelian ' + id, Masuk: 0, Keluar: Number(p.Bayar), Saldo: saldo, CabangID: cabangId };
      DATA.kas.push(kasRow); await persist('kas', kasRow);
    }
    if (Number(p.Sisa || 0) > 0) {
      var ut = { ID: uid('UTG'), Tanggal: nowISO(), PembelianID: id, Pemasok: p.Pemasok, Total: Number(p.Sisa), Dibayar: 0, Sisa: Number(p.Sisa), Status: 'Hutang' };
      DATA.utang.unshift(ut); await persist('utang', ut);
      var pm = DATA.pemasok.find(function (x) { return x.Nama === p.Pemasok; });
      if (pm) { pm.Hutang = Number(pm.Hutang || 0) + Number(p.Sisa); await persist('pemasok', pm); }
    }
    addLog(DATA, '', 'Pembelian Diproses', id + ' — stok bertambah, utang ' + (p.Sisa || 0));
    refreshRingkasan(); return { ok: true, id: id };
  }
  async function cicilUtang(payload) {
    if (!DATA) await loadAll();
    var u = DATA.utang.find(function (x) { return x.ID === (payload.utangId || payload.id); });
    if (!u) throw new Error('Utang tidak ditemukan.');
    var nominal = Number(payload.nominal || 0);
    if (nominal <= 0) throw new Error('Nominal cicilan wajib diisi.');
    if (nominal > Number(u.Sisa || 0)) throw new Error('Cicilan melebihi sisa utang.');
    u.Dibayar = Number(u.Dibayar || 0) + nominal;
    u.Sisa = Number(u.Sisa || 0) - nominal;
    if (u.Sisa === 0) u.Status = 'Lunas';
    await persist('utang', u);
    var cic = { ID: uid('CIC'), UtangID: u.ID, Tanggal: nowISO(), Nominal: nominal, Keterangan: payload.keterangan || '' };
    DATA.cicilanUtang.unshift(cic); await persist('cicilan_utang', cic);
    var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) - nominal;
    var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Cicil utang ' + u.ID + ' — ' + u.Pemasok, Masuk: 0, Keluar: nominal, Saldo: saldo, CabangID: cabangAktifId(DATA) };
    DATA.kas.push(kasRow); await persist('kas', kasRow);
    var pm = DATA.pemasok.find(function (x) { return x.Nama === u.Pemasok; });
    if (pm) { pm.Hutang = Math.max(0, Number(pm.Hutang || 0) - nominal); await persist('pemasok', pm); }
    refreshRingkasan(); return { ok: true };
  }

  /* ---------- retur / pembayaran transaksi ---------- */
  async function simpanRetur(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.transaksiId; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    var qty = Number(payload.qty || 1);
    var nominal = Number(payload.nominal || 0);
    var row = { ID: uid('RTR'), Tanggal: nowISO(), TransaksiID: trx.ID, Produk: payload.produk || '', Qty: qty, Nominal: nominal, Alasan: payload.alasan || '', CabangID: trx.CabangID || cabangAktifId(DATA) };
    DATA.retur.unshift(row); await persist('retur', row);
    var prod = DATA.produk.find(function (x) { return x.ID === payload.produkId || x.Nama === payload.produk; });
    if (prod) { prod.Stok = Number(prod.Stok || 0) + qty; await persist('produk', prod); }
    trx.Total = Math.max(0, Number(trx.Total || 0) - nominal);
    trx.Sisa = Math.max(0, Number(trx.Sisa || 0) - nominal);
    if (trx.Sisa === 0 && Number(trx.Bayar || 0) > 0) trx.StatusBayar = 'Lunas';
    await persist('transaksi', trx);
    if (nominal > 0) {
      var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) - nominal;
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Retur ' + trx.ID + ' — ' + row.Produk, Masuk: 0, Keluar: nominal, Saldo: saldo, CabangID: row.CabangID };
      DATA.kas.push(kasRow); await persist('kas', kasRow);
    }
    addLog(DATA, '', 'Retur', trx.ID + ' — ' + row.Produk + ' x' + qty);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }
  async function tambahPembayaran(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.id; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    var nominal = Number(payload.nominal || 0);
    trx.Bayar = Number(trx.Bayar || 0) + nominal;
    trx.Sisa = Math.max(0, Number(trx.Total || 0) - trx.Bayar);
    if (trx.Sisa === 0) trx.StatusBayar = 'Lunas'; else trx.StatusBayar = 'Kurang';
    await persist('transaksi', trx);
    var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) + nominal;
    var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Masuk', Keterangan: 'Pelunasan ' + trx.ID, Masuk: nominal, Keluar: 0, Saldo: saldo, CabangID: trx.CabangID || cabangAktifId(DATA) };
    DATA.kas.push(kasRow); await persist('kas', kasRow);
    var pl = DATA.pelanggan.find(function (x) { return x.Nama === trx.Pelanggan; });
    if (pl) { pl.Piutang = Math.max(0, Number(pl.Piutang || 0) - nominal); await persist('pelanggan', pl); }
    refreshRingkasan(); return { ok: true, sisa: trx.Sisa, statusBayar: trx.StatusBayar };
  }
  async function lunasiSemua(payload) {
    if (!DATA) await loadAll();
    var nama = payload.pelanggan || payload.nama;
    var list = DATA.transaksi.filter(function (t) { return t.Pelanggan === nama && t.StatusBayar !== 'Lunas'; });
    var total = 0;
    for (var i = 0; i < list.length; i++) {
      total += Number(list[i].Sisa || 0);
      await tambahPembayaran({ id: list[i].ID, nominal: Number(list[i].Sisa || 0) });
    }
    return { ok: true, jumlah: list.length, total: total };
  }
  async function ubahStatusPesanan(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.id; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    trx.StatusPesanan = payload.status;
    await persist('transaksi', trx);
    refreshRingkasan(); return { ok: true };
  }
  async function batalkanTransaksi(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.id; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    if (Number(trx.Bayar || 0) > 0 && Number(trx.Sisa || 0) === 0) throw new Error('Transaksi sudah Lunas — pakai Retur untuk mengembalikan item.');
    // kembalikan stok
    DATA.detail.filter(function (d) { return d.TransaksiID === trx.ID; }).forEach(function (d) {
      var prod = DATA.produk.find(function (x) { return x.ID === d.ProdukID; });
      if (prod) { prod.Stok = Number(prod.Stok || 0) + Number(d.Qty || 0); persist('produk', prod); }
    });
    var pl = DATA.pelanggan.find(function (x) { return x.Nama === trx.Pelanggan; });
    if (pl) { pl.Piutang = Math.max(0, Number(pl.Piutang || 0) - Number(trx.Sisa || 0)); pl.TotalBeli = Math.max(0, Number(pl.TotalBeli || 0) - Number(trx.Total || 0)); await persist('pelanggan', pl); }
    if (Number(trx.Bayar || 0) > 0) {
      var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) - Number(trx.Bayar);
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Batal transaksi ' + trx.ID + ' (uang kembali)', Masuk: 0, Keluar: Number(trx.Bayar), Saldo: saldo, CabangID: trx.CabangID || cabangAktifId(DATA) };
      DATA.kas.push(kasRow); await persist('kas', kasRow);
    }
    DATA.transaksi = DATA.transaksi.filter(function (x) { return x.ID !== trx.ID; });
    DATA.detail = DATA.detail.filter(function (x) { return x.TransaksiID !== trx.ID; });
    await removeRow('transaksi', trx.ID);
    addLog(DATA, '', 'Batal Transaksi', trx.ID + ' — ' + (payload.alasan || ''));
    refreshRingkasan(); return { ok: true };
  }

  /* ---------- transaksi cepat & tertunda ---------- */
  async function simpanCepat(payload) {
    if (!DATA) await loadAll();
    var row = { ID: uid('CEP'), Nama: payload.nama, Pelanggan: payload.pelanggan || 'Umum', ItemsJSON: JSON.stringify(payload.items || []), CabangID: payload.cabangId || cabangAktifId(DATA) };
    DATA.transaksiCepat.unshift(row); await persist('transaksi_cepat', row);
    return { ok: true, id: row.ID };
  }
  async function hapusCepat(payload) { if (!DATA) await loadAll(); hapusDari('transaksiCepat', 'transaksi_cepat', payload.id); return { ok: true }; }
  async function parkirTransaksi(payload) { return simpanTertunda(payload); }
  async function simpanTertunda(payload) {
    if (!DATA) await loadAll();
    var row = { ID: uid('TTD'), Tanggal: nowISO(), Pelanggan: payload.pelanggan || 'Umum', Kasir: payload.kasir || '', ItemsJSON: JSON.stringify(payload.items || []), Total: Number(payload.total || 0), CabangID: payload.cabangId || cabangAktifId(DATA), Meja: payload.meja || '', Catatan: payload.catatan || '' };
    DATA.transaksiTertunda.unshift(row); await persist('transaksi_tertunda', row);
    return { ok: true, id: row.ID };
  }
  async function muatTertunda(payload) {
    if (!DATA) await loadAll();
    var t = DATA.transaksiTertunda.find(function (x) { return x.ID === payload.id; });
    if (!t) throw new Error('Transaksi tertunda tidak ditemukan.');
    return { ok: true, items: parseJSON(t.ItemsJSON || '[]', []), pelanggan: t.Pelanggan, meja: t.Meja, total: t.Total };
  }
  async function hapusTertunda(payload) { if (!DATA) await loadAll(); hapusDari('transaksiTertunda', 'transaksi_tertunda', payload.id); return { ok: true }; }

  /* ---------- promo / tier / meja / dapur ---------- */
  async function upsertPromo(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, Jenis: payload.Jenis || 'DiskonPersen', SyaratJSON: payload.SyaratJSON || '', Nilai: Number(payload.Nilai || 0), Mulai: payload.Mulai || '', Selesai: payload.Selesai || '', JamMulai: payload.JamMulai || '', JamSelesai: payload.JamSelesai || '', Hari: payload.Hari || '', Aktif: payload.Aktif || 'YA', CabangID: payload.CabangID || '' };
    return upsertInto('promo', 'promo', row, 'PRM');
  }
  async function hapusPromo(payload) { if (!DATA) await loadAll(); hapusDari('promo', 'promo', payload.id); return { ok: true }; }
  async function upsertTier(payload) {
    if (!DATA) await loadAll();
    var row = { Tier: payload.tier || payload.Tier, MinTotalBeli: Number(payload.minTotalBeli || 0), DiskonPersen: Number(payload.diskonPersen || 0), Manfaat: payload.manfaat || '' };
    var ex = DATA.tier.find(function (x) { return x.Tier === row.Tier; });
    if (ex) { ex.MinTotalBeli = row.MinTotalBeli; ex.DiskonPersen = row.DiskonPersen; ex.Manfaat = row.Manfaat; await persist('tier_member', ex, 'tier'); }
    else { DATA.tier.push(row); await persist('tier_member', row, 'tier'); }
    refreshRingkasan(); return { ok: true };
  }
  async function upsertMeja(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, CabangID: payload.CabangID || cabangAktifId(DATA), Status: payload.Status || 'Kosong', TransaksiID: payload.TransaksiID || '' };
    return upsertInto('meja', 'meja', row, 'MJ');
  }
  async function hapusMeja(payload) { if (!DATA) await loadAll(); hapusDari('meja', 'meja', payload.id); return { ok: true }; }
  async function getDapur(payload) {
    if (!DATA) await loadAll();
    var cabangId = (payload && payload.cabangId) || cabangAktifId(DATA);
    var list = (DATA.pesananDapur || []).filter(function (d) { return !cabangId || String(d.CabangID) === String(cabangId); });
    return { pesanan: list };
  }
  async function updateStatusDapur(payload) {
    if (!DATA) await loadAll();
    var d = DATA.pesananDapur.find(function (x) { return x.ID === payload.id; });
    if (!d) throw new Error('Pesanan dapur tidak ditemukan.');
    d.Status = payload.status;
    await persist('pesanan_dapur', d);
    if (payload.status === 'Selesai') {
      var trx = DATA.transaksi.find(function (x) { return x.ID === d.TransaksiID; });
      if (trx) { trx.StatusPesanan = 'Selesai'; await persist('transaksi', trx); }
      var mj = DATA.meja.find(function (m) { return m.Nama === d.Meja; });
      if (mj) { mj.Status = 'Kosong'; mj.TransaksiID = ''; await persist('meja', mj); }
    }
    refreshRingkasan(); return { ok: true };
  }

  /* ---------- stok: opname, saran order, laporan stok ---------- */
  async function simpanOpname(payload) {
    if (!DATA) await loadAll();
    var prod = DATA.produk.find(function (x) { return x.ID === payload.produkId; });
    if (!prod) throw new Error('Produk tidak ditemukan.');
    var sistem = stokOf(DATA, prod);
    var fisik = Number(payload.stokFisik || 0);
    var row = { ID: uid('OPN'), Tanggal: nowISO(), ProdukID: prod.ID, NamaProduk: prod.Nama, StokSistem: sistem, StokFisik: fisik, Selisih: fisik - sistem, Keterangan: payload.keterangan || '', CabangID: payload.cabangId || cabangAktifId(DATA), Pengguna: '' };
    DATA.opname.unshift(row); await persist('opname', row);
    setStok(DATA, prod, fisik);
    await persist('produk', prod);
    var sc = (DATA.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(prod.ID) && String(x.CabangID) === String(row.CabangID); });
    if (sc) await persist('stok_cabang', sc);
    addLog(DATA, '', 'Opname', prod.Nama + ' — sistem ' + sistem + ' → fisik ' + fisik);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }
  async function saranOrder(payload) {
    if (!DATA) await loadAll();
    var list = (DATA.produk || []).map(function (p) {
      var terjual = (DATA.detail || []).filter(function (d) { return d.ProdukID === p.ID; }).reduce(function (a, d) { return a + Number(d.Qty || 0); }, 0);
      var perHari = terjual / 28;
      var stok = stokOf(DATA, p);
      var hariTersisa = perHari > 0 ? Math.floor(stok / perHari) : null;
      return { produkId: p.ID, nama: p.Nama, stok: stok, terjualPerHari: Math.round(perHari * 100) / 100, hariTersisa: hariTersisa, saranQty: perHari > 0 && (hariTersisa == null || hariTersisa < 7) ? Math.ceil(perHari * 14) : 0 };
    }).filter(function (s) { return s.saranQty > 0; });
    return { saran: list };
  }
  async function getLaporanStok(payload) {
    if (!DATA) await loadAll();
    var produk = (DATA.produk || []).map(function (p) { return { nama: p.Nama, stok: stokOf(DATA, p), modal: Number(p.HargaModal || 0), harga: Number(p.HargaJual || 0) }; });
    var bahan = (DATA.bahan || []).map(function (b) { return { nama: b.Nama, stok: Number(b.Stok || 0), satuan: b.Satuan || '' }; });
    return { produk: produk, bahan: bahan, kedaluwarsa: (DATA.ringkasan || {}).kedaluwarsaList || [] };
  }

  /* ---------- pengaturan / cabang / pengguna ---------- */
  async function simpanPengaturan(payload) {
    if (!DATA) await loadAll();
    Object.keys(payload || {}).forEach(function (k) { DATA.pengaturan[k] = payload[k]; });
    await persistPengaturan();
    refreshRingkasan(); return { ok: true };
  }
  async function upsertCabang(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, Alamat: payload.Alamat || '', Telepon: payload.Telepon || '', Aktif: 'YA' };
    return upsertInto('cabang', 'cabang', row, 'CBG');
  }
  async function hapusCabang(payload) { if (!DATA) await loadAll(); hapusDari('cabang', 'cabang', payload.id); return { ok: true }; }
  async function setCabangAktif(payload) {
    if (!DATA) await loadAll();
    DATA.pengaturan.CabangAktif = payload.id;
    await persistPengaturan();
    refreshRingkasan(); return { ok: true };
  }
  async function upsertPengguna(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, PIN: String(payload.PIN || ''), Peran: payload.Peran || 'Kasir', Aktif: 'YA', IzinJSON: payload.IzinJSON || '{}', AksesTransaksi: payload.AksesTransaksi || 'Tidak dibatasi', CabangID: payload.CabangID || '' };
    return upsertInto('pengguna', 'pengguna', row, 'USR');
  }
  async function hapusPengguna(payload) { if (!DATA) await loadAll(); hapusDari('pengguna', 'pengguna', payload.id); return { ok: true }; }

  /* ---------- poin ---------- */
  async function koreksiPoin(payload) {
    if (!DATA) await loadAll();
    var pl = DATA.pelanggan.find(function (x) { return x.ID === payload.pelangganId; });
    if (!pl) throw new Error('Pelanggan tidak ditemukan.');
    var jumlah = Number(payload.jumlah || 0);
    pl.Poin = Math.max(0, Number(pl.Poin || 0) + jumlah);
    await persist('pelanggan', pl);
    var row = { ID: uid('PNT'), Tanggal: nowISO(), PelangganID: pl.ID, Pelanggan: pl.Nama, Jenis: 'Koreksi', Jumlah: jumlah, Sisa: pl.Poin, Keterangan: payload.keterangan || 'Koreksi manual', TransaksiID: '' };
    DATA.riwayatPoin.unshift(row); await persist('riwayat_poin', row);
    refreshRingkasan(); return { ok: true, poin: pl.Poin };
  }
  async function getRiwayatPoin(payload) {
    if (!DATA) await loadAll();
    return { riwayat: (DATA.riwayatPoin || []).filter(function (r) { return String(r.PelangganID) === String(payload.pelangganId); }) };
  }

  /* ---------- master data ---------- */
  async function simpanTeks(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.id || payload.ID || '', Nama: payload.nama, Keterangan: payload.keterangan || '', Jenis: payload.jenis || 'Item' };
    return upsertInto('daftarTeks', 'daftar_teks', row, 'TEKS');
  }
  async function hapusTeks(payload) { if (!DATA) await loadAll(); hapusDari('daftarTeks', 'daftar_teks', payload.id); return { ok: true }; }
  async function upsertGrup(payload) {
    if (!DATA) await loadAll();
    return upsertInto('grup', 'grup_produk', { ID: payload.id || payload.ID || '', Nama: payload.nama }, 'GRP');
  }
  async function hapusGrup(payload) { if (!DATA) await loadAll(); hapusDari('grup', 'grup_produk', payload.id); return { ok: true }; }
  async function upsertSatuan(payload) {
    if (!DATA) await loadAll();
    return upsertInto('satuan', 'satuan', { ID: payload.id || payload.ID || '', Nama: payload.nama, Singkatan: payload.singkatan || '', Desimal: payload.desimal || 'TIDAK' }, 'STN');
  }
  async function hapusSatuan(payload) { if (!DATA) await loadAll(); hapusDari('satuan', 'satuan', payload.id); return { ok: true }; }
  async function upsertJenisBayar(payload) {
    if (!DATA) await loadAll();
    return upsertInto('jenisBayar', 'jenis_pembayaran', { ID: payload.id || payload.ID || '', Nama: payload.nama, Aktif: 'YA' }, 'JB');
  }
  async function hapusJenisBayar(payload) { if (!DATA) await loadAll(); hapusDari('jenisBayar', 'jenis_pembayaran', payload.id); return { ok: true }; }
  async function upsertItemPengeluaran(payload) {
    if (!DATA) await loadAll();
    return upsertInto('itemPengeluaran', 'item_pengeluaran', { ID: payload.id || payload.ID || '', Nama: payload.nama }, 'IP');
  }
  async function hapusItemPengeluaran(payload) { if (!DATA) await loadAll(); hapusDari('itemPengeluaran', 'item_pengeluaran', payload.id); return { ok: true }; }
  async function upsertPegawai(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.id || payload.ID || '', Nama: payload.nama, Telepon: payload.telepon || '', Jabatan: payload.jabatan || '', Target: Number(payload.target || 0), KomisiPersen: Number(payload.komisiPersen || 0), Aktif: 'YA' };
    return upsertInto('pegawai', 'pegawai', row, 'PGW');
  }
  async function hapusPegawai(payload) { if (!DATA) await loadAll(); hapusDari('pegawai', 'pegawai', payload.id); return { ok: true }; }
  async function upsertKatalog(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, TampilkanGambar: payload.TampilkanGambar || 'YA', TampilkanHarga: payload.TampilkanHarga || 'YA', TampilkanStok: payload.TampilkanStok || 'TIDAK', SembunyikanStokKosong: payload.SembunyikanStokKosong || 'TIDAK', TampilkanKeterangan: payload.TampilkanKeterangan || 'TIDAK', Footer: payload.Footer || '', Aktif: payload.Aktif || 'YA', CabangID: payload.CabangID || cabangAktifId(DATA) };
    return upsertInto('katalog', 'katalog', row, 'KTG');
  }

  /* ---------- bahan & resep / HPP ---------- */
  async function upsertBahan(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, Satuan: payload.Satuan || 'pcs', Stok: Number(payload.Stok || 0), HargaPerSatuan: Number(payload.HargaPerSatuan || 0), StokMinimum: Number(payload.StokMinimum || 5), CabangID: payload.CabangID || cabangAktifId(DATA) };
    return upsertInto('bahan', 'bahan_baku', row, 'BHN');
  }
  async function hapusBahan(payload) { if (!DATA) await loadAll(); hapusDari('bahan', 'bahan_baku', payload.id); return { ok: true }; }
  function hitungHPPSync(produkId) {
    var hpp = 0;
    (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(produkId); }).forEach(function (r) {
      var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
      if (b) hpp += Number(b.HargaPerSatuan || 0) * Number(r.QtyPakai || 0);
    });
    return hpp;
  }
  async function hitungHPP(payload) { if (!DATA) await loadAll(); return { hpp: hitungHPPSync(payload.produkId) }; }
  async function simpanResep(payload) {
    if (!DATA) await loadAll();
    var pid = payload.produkId;
    DATA.resep = DATA.resep.filter(function (r) { return String(r.ProdukID) !== String(pid); });
    (payload.items || []).forEach(function (it) {
      var b = DATA.bahan.find(function (x) { return x.ID === it.bahanId; });
      var row = { ProdukID: pid, BahanID: it.bahanId, NamaBahan: it.namaBahan || (b ? b.Nama : ''), QtyPakai: Number(it.qty || 0) };
      DATA.resep.push(row); persist('resep', row);
    });
    var hpp = hitungHPPSync(pid);
    var prod = DATA.produk.find(function (x) { return x.ID === pid; });
    if (prod) { prod.HargaModal = hpp; await persist('produk', prod); }
    refreshRingkasan(); return { ok: true, hpp: hpp };
  }

  /* ---------- piutang ---------- */
  async function pengingatPiutang() {
    if (!DATA) await loadAll();
    var batas = Number((DATA.pengaturan || {}).JatuhTempoHari || 7);
    var now = new Date();
    var daftar = [];
    (DATA.pelanggan || []).forEach(function (pl) {
      if (Number(pl.Piutang || 0) <= 0) return;
      var list = (DATA.transaksi || []).filter(function (t) { return t.Pelanggan === pl.Nama && t.StatusBayar !== 'Lunas'; });
      if (!list.length) return;
      var tertua = list.map(function (t) { return new Date(String(t.Tanggal || '').replace(' ', 'T')); }).sort(function (a, b) { return a - b; })[0];
      var hari = Math.floor((now - tertua) / 86400000);
      if (hari >= batas) {
        var teks = 'Halo ' + pl.Nama + ', ini pengingat dari ' + (DATA.pengaturan.NamaToko || 'Zho POS') + ': piutang Anda sebesar Rp' + Number(pl.Piutang).toLocaleString('id-ID') + ' sudah jatuh tempo (' + hari + ' hari). Mohon segera dilunasi. Terima kasih.';
        var telp = String(pl.Telepon || '').replace(/\D/g, '');
        daftar.push({ nama: pl.Nama, piutang: Number(pl.Piutang), jumlah: list.length, hariTertunggak: hari, waLink: telp ? 'https://wa.me/' + telp + '?text=' + encodeURIComponent(teks) : '' });
      }
    });
    return { batasHari: batas, daftar: daftar };
  }
  async function tagihanGabungan(payload) {
    if (!DATA) await loadAll();
    var nama = payload.pelanggan || payload.nama;
    var list = (DATA.transaksi || []).filter(function (t) { return t.Pelanggan === nama && t.StatusBayar !== 'Lunas'; });
    var lines = ['TAGIHAN — ' + (DATA.pengaturan.NamaToko || 'Zho POS'), 'Pelanggan: ' + nama, '------------------------------'];
    var total = 0;
    list.forEach(function (t) { lines.push(t.ID + ' — ' + String(t.Tanggal || '').slice(0, 10) + ' — Rp' + Number(t.Sisa || 0).toLocaleString('id-ID') + ' (' + t.StatusBayar + ')'); total += Number(t.Sisa || 0); });
    lines.push('------------------------------');
    lines.push('Total piutang: Rp' + total.toLocaleString('id-ID'));
    lines.push('Mohon segera dilunasi. Terima kasih.');
    return { teks: lines.join('\n'), total: total, jumlah: list.length };
  }

  /* ---------- laporan ---------- */
  function filterTrx(dari, sampai, cabangId) {
    return (DATA.transaksi || []).filter(function (t) {
      var tg = String(t.Tanggal || '').slice(0, 10);
      if (dari && tg < dari) return false;
      if (sampai && tg > sampai) return false;
      if (cabangId && String(t.CabangID || '') !== String(cabangId)) return false;
      return true;
    });
  }
  async function getLaporan(payload) {
    if (!DATA) await loadAll();
    var hari = Number((payload && payload.hari) || 7);
    var dari = new Date(); dari.setDate(dari.getDate() - (hari - 1));
    var list = filterTrx(todayStr(dari), todayStr(), (payload && payload.cabangId) || '');
    var lunas = list.filter(function (t) { return t.StatusBayar === 'Lunas'; });
    return {
      ringkasan: { omzet: lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0), laba: lunas.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0), jumlah: list.length },
      perCabang: (DATA.ringkasan || {}).perCabang || []
    };
  }
  async function getLaporanLengkap(payload) {
    if (!DATA) await loadAll();
    var jenis = payload.jenis || 'penjualan';
    var dari = payload.dari || '', sampai = payload.sampai || '', cabangId = payload.cabangId || '';
    var list = filterTrx(dari, sampai, cabangId);
    var lunas = list.filter(function (t) { return t.StatusBayar === 'Lunas'; });
    var ringkasan = {}, baris = [];
    if (jenis === 'penjualan') {
      ringkasan = { Penjualan: lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0), Transaksi: lunas.length, Item: (DATA.detail || []).filter(function (d) { return lunas.some(function (t) { return t.ID === d.TransaksiID; }); }).reduce(function (a, d) { return a + Number(d.Qty || 0); }, 0), Ongkir: lunas.reduce(function (a, t) { return a + Number(t.Ongkir || 0); }, 0), Diskon: lunas.reduce(function (a, t) { return a + Number(t.Diskon || 0); }, 0), Laba: lunas.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0) };
      baris = lunas.map(function (t) { return { ID: t.ID, Tanggal: t.Tanggal, Pelanggan: t.Pelanggan, Total: t.Total, Bayar: t.Bayar, Sisa: t.Sisa, Status: t.StatusBayar }; });
    } else if (jenis === 'pengeluaran') {
      var pg = (DATA.pengeluaran || []).filter(function (x) { var tg = String(x.Tanggal || '').slice(0, 10); return (!dari || tg >= dari) && (!sampai || tg <= sampai); });
      ringkasan = { Total: pg.reduce(function (a, x) { return a + Number(x.Nominal || 0); }, 0), Jumlah: pg.length };
      baris = pg.map(function (x) { return { Tanggal: x.Tanggal, Kategori: x.Kategori, Keterangan: x.Keterangan, Nominal: x.Nominal, EfekLaba: x.EfekLaba }; });
    } else if (jenis === 'piutang') {
      var bl = list.filter(function (t) { return t.StatusBayar !== 'Lunas'; });
      ringkasan = { Piutang: bl.reduce(function (a, t) { return a + Number(t.Sisa || 0); }, 0), Jumlah: bl.length };
      baris = bl.map(function (t) { return { ID: t.ID, Tanggal: t.Tanggal, Pelanggan: t.Pelanggan, Total: t.Total, Sisa: t.Sisa, Status: t.StatusBayar }; });
    } else if (jenis === 'pembayaran') {
      var byMetode = {};
      lunas.forEach(function (t) { byMetode[t.Metode] = (byMetode[t.Metode] || 0) + Number(t.Bayar || 0); });
      ringkasan = { Dibayar: lunas.reduce(function (a, t) { return a + Number(t.Bayar || 0); }, 0), Transaksi: lunas.length };
      baris = Object.keys(byMetode).map(function (m) { return { Metode: m, Total: byMetode[m] }; });
    } else if (jenis === 'stok') {
      ringkasan = { Produk: (DATA.produk || []).length, StokMenipis: (DATA.ringkasan || {}).stokMenipis || 0 };
      baris = (DATA.produk || []).map(function (p) { return { Produk: p.Nama, Stok: stokOf(DATA, p), HargaJual: p.HargaJual, HargaModal: p.HargaModal }; });
    } else if (jenis === 'labarugi') {
      var omzet = lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
      var labaKotor = lunas.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
      var keluar = (DATA.pengeluaran || []).filter(function (x) { var tg = String(x.Tanggal || '').slice(0, 10); return (!dari || tg >= dari) && (!sampai || tg <= sampai) && x.EfekLaba === 'MengurangiLaba'; }).reduce(function (a, x) { return a + Number(x.Nominal || 0); }, 0);
      ringkasan = { Omzet: omzet, LabaKotor: labaKotor, Pengeluaran: keluar, LabaBersih: labaKotor - keluar };
      baris = [{ Keterangan: 'Omzet (Lunas)', Nilai: omzet }, { Keterangan: 'Laba kotor', Nilai: labaKotor }, { Keterangan: 'Pengeluaran mengurangi laba', Nilai: keluar }, { Keterangan: 'Laba bersih', Nilai: labaKotor - keluar }];
    } else if (jenis === 'pajak') {
      var pajak = lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0) * Number((DATA.pengaturan || {}).PajakPersen || 0) / 100;
      ringkasan = { Omzet: lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0), PajakPersen: Number((DATA.pengaturan || {}).PajakPersen || 0), Pajak: Math.round(pajak) };
      baris = lunas.map(function (t) { return { ID: t.ID, Tanggal: t.Tanggal, Total: t.Total, Pajak: Math.round(Number(t.Total || 0) * Number((DATA.pengaturan || {}).PajakPersen || 0) / 100) }; });
    }
    return { ringkasan: ringkasan, baris: baris, total: ringkasan };
  }
  async function getTopKasir(payload) {
    if (!DATA) await loadAll();
    var list = filterTrx(payload.dari || '', payload.sampai || '', payload.cabangId || '');
    var per = {};
    list.filter(function (t) { return t.StatusBayar === 'Lunas'; }).forEach(function (t) {
      per[t.Kasir] = per[t.Kasir] || { kasir: t.Kasir || 'Kasir', omzet: 0, jumlah: 0 };
      per[t.Kasir].omzet += Number(t.Total || 0); per[t.Kasir].jumlah += 1;
    });
    var top = Object.keys(per).map(function (k) {
      var pgw = (DATA.pegawai || []).find(function (x) { return x.Nama === k; });
      var komisi = pgw ? Math.round(per[k].omzet * Number(pgw.KomisiPersen || 0) / 100) : 0;
      return { kasir: per[k].kasir, omzet: per[k].omzet, jumlah: per[k].jumlah, komisi: komisi };
    }).sort(function (a, b) { return b.omzet - a.omzet; });
    return { top: top };
  }
  async function getLogs(payload) {
    if (!DATA) await loadAll();
    return { logs: (DATA.logs || []).slice(0, Number((payload && payload.limit) || 100)) };
  }
  async function getStruk(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.transaksiId; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    var lines = [(DATA.pengaturan.NamaToko || 'Zho POS'), '------------------------------',
      'No: ' + trx.ID + (trx.KodeAlternatif ? ' (' + trx.KodeAlternatif + ')' : ''),
      'Tanggal: ' + trx.Tanggal, 'Kasir: ' + trx.Kasir, 'Pelanggan: ' + trx.Pelanggan, '------------------------------'];
    DATA.detail.filter(function (d) { return d.TransaksiID === trx.ID; }).forEach(function (d) {
      lines.push(d.NamaProduk + ' x' + d.Qty + '  Rp' + Number(d.Subtotal || 0).toLocaleString('id-ID'));
    });
    lines.push('------------------------------', 'Total: Rp' + Number(trx.Total || 0).toLocaleString('id-ID'),
      'Bayar: Rp' + Number(trx.Bayar || 0).toLocaleString('id-ID'),
      'Kembali: Rp' + Math.max(0, Number(trx.Bayar || 0) - Number(trx.Total || 0)).toLocaleString('id-ID'),
      'Status: ' + trx.StatusBayar, 'Terima kasih sudah berbelanja!');
    return { teks: lines.join('\n') };
  }

  /* ---------- Lapor Bos (MANUAL saja: pratinjau -> wa.me / cetak) ---------- */
  async function kirimLaporBos(payload) {
    if (!DATA) await loadAll();
    var tanggal = (payload && payload.tanggal) || todayStr();
    var cabangId = (payload && payload.cabangId) || '';
    var mode = (payload && payload.mode) || 'rekap';
    var list = (DATA.transaksi || []).filter(function (t) {
      if (String(t.Tanggal || '').slice(0, 10) !== tanggal) return false;
      if (cabangId && String(t.CabangID || '') !== String(cabangId)) return false;
      return true;
    });
    var lunas = list.filter(function (t) { return t.StatusBayar === 'Lunas'; });
    var omzet = lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
    var laba = lunas.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
    var lines = ['LAPOR BOS — ' + (DATA.pengaturan.NamaToko || 'Zho POS'), 'Tanggal: ' + tanggal,
      '------------------------------', 'Omzet: Rp' + omzet.toLocaleString('id-ID'),
      'Transaksi: ' + list.length + ' (Lunas: ' + lunas.length + ')',
      'Laba: Rp' + laba.toLocaleString('id-ID'), '------------------------------'];
    if (mode === 'detail') {
      list.forEach(function (t) { lines.push(t.ID + ' — ' + t.Pelanggan + ' — Rp' + Number(t.Total || 0).toLocaleString('id-ID') + ' (' + t.StatusBayar + ')'); });
      lines.push('------------------------------');
    } else {
      var perProduk = {};
      DATA.detail.filter(function (d) { return lunas.some(function (t) { return t.ID === d.TransaksiID; }); }).forEach(function (d) {
        perProduk[d.NamaProduk] = perProduk[d.NamaProduk] || { qty: 0, total: 0 };
        perProduk[d.NamaProduk].qty += Number(d.Qty || 0);
        perProduk[d.NamaProduk].total += Number(d.Subtotal || 0);
      });
      Object.keys(perProduk).forEach(function (k) { lines.push(k + ' x' + perProduk[k].qty + ' — Rp' + perProduk[k].total.toLocaleString('id-ID')); });
      lines.push('------------------------------');
    }
    var teks = lines.join('\n');
    return { teks: teks, waLink: 'https://wa.me/?text=' + encodeURIComponent(teks) };
  }
  async function catatLaporBos(payload) {
    if (!DATA) await loadAll();
    var row = { ID: uid('LB'), Tanggal: nowISO(), CabangID: (payload && payload.cabangId) || cabangAktifId(DATA), Isi: (payload && payload.teks) || '', Terkirim: 'YA', Cara: (payload && payload.cara) || 'WhatsApp' };
    DATA.laporBos = DATA.laporBos || [];
    DATA.laporBos.unshift(row);
    await persist('lapor_bos', row);
    return { ok: true, id: row.ID };
  }

  /* ---------- export / label / terjemahan ---------- */
  async function exportProdukCSV() {
    if (!DATA) await loadAll();
    var rows = [['ID', 'Nama', 'Kategori', 'SKU', 'HargaJual', 'HargaModal', 'Stok', 'Satuan']];
    (DATA.produk || []).forEach(function (p) { rows.push([p.ID, p.Nama, p.Kategori, p.SKU, p.HargaJual, p.HargaModal, p.Stok, p.Satuan]); });
    return { csv: toCSV(rows) };
  }
  async function exportLaporanExcel(payload) {
    var res = await getLaporanLengkap(payload || { jenis: 'penjualan' });
    if ((payload && payload.jenis) === 'penjualan') {
      // Format bulanan Griyo: Bulan, Penjualan, Transaksi, Item, Ongkos kirim, Diskon
      var perBulan = {};
      var list = filterTrx(payload.dari || '', payload.sampai || '', payload.cabangId || '').filter(function (t) { return t.StatusBayar === 'Lunas'; });
      list.forEach(function (t) {
        var b = String(t.Tanggal || '').slice(0, 7);
        perBulan[b] = perBulan[b] || { penjualan: 0, transaksi: 0, item: 0, ongkir: 0, diskon: 0 };
        perBulan[b].penjualan += Number(t.Total || 0);
        perBulan[b].transaksi += 1;
        perBulan[b].ongkir += Number(t.Ongkir || 0);
        perBulan[b].diskon += Number(t.Diskon || 0);
        perBulan[b].item += (DATA.detail || []).filter(function (d) { return d.TransaksiID === t.ID; }).reduce(function (a, d) { return a + Number(d.Qty || 0); }, 0);
      });
      var rows = [['Bulan', 'Penjualan', 'Transaksi', 'Item', 'Ongkos kirim', 'Diskon']];
      Object.keys(perBulan).sort().forEach(function (b) { var x = perBulan[b]; rows.push([b, x.penjualan, x.transaksi, x.item, x.ongkir, x.diskon]); });
      return { csv: toCSV(rows) };
    }
    var keys = (res.baris[0] ? Object.keys(res.baris[0]) : ['Keterangan', 'Nilai']);
    var rows = [keys];
    res.baris.forEach(function (b) { rows.push(keys.map(function (k) { return b[k]; })); });
    return { csv: toCSV(rows) };
  }
  async function cetakLabelBarcode(payload) {
    if (!DATA) await loadAll();
    var ids = (payload && payload.produkIds) || [];
    var label = (DATA.produk || []).filter(function (p) { return ids.indexOf(p.ID) >= 0; }).map(function (p) {
      return { id: p.ID, nama: p.Nama, harga: Number(p.HargaJual || 0), sku: p.SKU || p.ID };
    });
    return { label: label };
  }
  async function getTerjemahan() { if (!DATA) await loadAll(); return { peta: clone(DATA.terjemahan || {}) }; }
  async function simpanTerjemahan(payload) {
    if (!DATA) await loadAll();
    DATA.terjemahan = payload.peta || {};
    await persistTerjemahan();
    return { ok: true };
  }

  /* ---------- ekspor global ---------- */
  window.DB = {
    mode: MODE, configured: !!CONFIGURED, isSample: MODE === 'contoh',
    getData: getData, refreshRingkasan: refreshRingkasan,
    loadAll: loadAll, login: login, saveTransaksi: saveTransaksi,
    upsertProduk: upsertProduk, hapusProduk: hapusProduk,
    upsertPelanggan: upsertPelanggan, simpanPengeluaran: simpanPengeluaran,
    simpanUangKas: simpanUangKas, simpanPembelian: simpanPembelian,
    prosesPembelian: prosesPembelian, cicilUtang: cicilUtang, simpanRetur: simpanRetur,
    lunasiSemua: lunasiSemua, lunasiSemuaPelanggan: lunasiSemua,
    simpanCepat: simpanCepat, hapusCepat: hapusCepat,
    parkirTransaksi: parkirTransaksi, simpanTertunda: simpanTertunda,
    muatTertunda: muatTertunda, hapusTertunda: hapusTertunda,
    upsertPromo: upsertPromo, hapusPromo: hapusPromo, upsertTier: upsertTier,
    upsertMeja: upsertMeja, hapusMeja: hapusMeja, updateStatusDapur: updateStatusDapur,
    simpanOpname: simpanOpname, simpanPengaturan: simpanPengaturan,
    upsertPengguna: upsertPengguna, hapusPengguna: hapusPengguna,
    upsertCabang: upsertCabang, hapusCabang: hapusCabang, setCabangAktif: setCabangAktif,
    tambahPembayaran: tambahPembayaran, ubahStatusPesanan: ubahStatusPesanan,
    batalkanTransaksi: batalkanTransaksi, koreksiPoin: koreksiPoin,
    simpanTeks: simpanTeks, upsertTeks: simpanTeks, hapusTeks: hapusTeks,
    upsertGrup: upsertGrup, hapusGrup: hapusGrup,
    upsertSatuan: upsertSatuan, hapusSatuan: hapusSatuan,
    upsertJenisBayar: upsertJenisBayar, hapusJenisBayar: hapusJenisBayar,
    upsertItemPengeluaran: upsertItemPengeluaran, hapusItemPengeluaran: hapusItemPengeluaran,
    upsertPegawai: upsertPegawai, hapusPegawai: hapusPegawai,
    upsertKatalog: upsertKatalog, upsertPemasok: upsertPemasok,
    getLaporan: getLaporan, getLaporanLengkap: getLaporanLengkap,
    getLaporanStok: getLaporanStok, saranOrder: saranOrder, hitungPromo: hitungPromo,
    getRiwayatPoin: getRiwayatPoin, getStruk: getStruk, getDapur: getDapur,
    getTopKasir: getTopKasir, getLogs: getLogs,
    kirimLaporBos: kirimLaporBos, catatLaporBos: catatLaporBos,
    exportProdukCSV: exportProdukCSV, exportLaporanExcel: exportLaporanExcel,
    cetakLabelBarcode: cetakLabelBarcode, hitungHPP: hitungHPP, simpanResep: simpanResep,
    upsertBahan: upsertBahan, hapusBahan: hapusBahan,
    pengingatPiutang: pengingatPiutang, tagihanGabungan: tagihanGabungan,
    getTerjemahan: getTerjemahan, simpanTerjemahan: simpanTerjemahan
  };
})();
