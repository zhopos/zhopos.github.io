/* ============================================================
   ZPOS v4 — Lapisan Data
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
  var SPECIAL = { id: 'ID', sku: 'SKU', json: 'JSON', wa: 'WA', url: 'URL', hpp: 'HPP' };
  function snakeToPascal(s) {
    return s.split('_').map(function (p) {
      var low = p.toLowerCase();
      if (SPECIAL[low]) return SPECIAL[low];
      return low.charAt(0).toUpperCase() + low.slice(1);
    }).join('');
  }
  function pascalToSnake(s) {
    // Tangani akronim: ID, SKU, JSON, WA, URL, HPP
    var out = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2');
    return out.toLowerCase().replace(/_i_d$/, '_id');
  }
  function toPascal(row) {
    var o = {};
    Object.keys(row || {}).forEach(function (k) { o[snakeToPascal(k)] = row[k]; });
    if (o.SKUBarcode != null) o.SKU = o.SKUBarcode;
    return o;
  }
  function toSnake(obj) {
    var o = {};
    Object.keys(obj || {}).forEach(function (k) {
      if (k === 'SKU/Barcode') { o.sku_barcode = obj[k]; return; }
      if (k === 'SKU') return; // alias baca saja — nilainya sudah ada di SKUBarcode; kolom 'sku' tidak ada di tabel
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
    produk: [{ id: 'PRD-TESKOPI', nama: 'TES Kopi', kategori: 'Minuman', sku_barcode: 'TESKOPI', harga_jual: 10000, harga_modal: 5000, stok: 9, satuan: 'pcs', aktif: 'YA', stok_minimum: 5, grup: '', gambar_url: '', keterangan: 'Produk contoh', harga_bisa_diganti: 'YA', termasuk_stok: 'YA', harga_lain_json: '', harga_jumlah_json: '', varian_json: '', tampilkan_di_katalog: 'YA', cabang_id: 'CBG-UTAMA' }],
    transaksi: [{ id: 'TRX-8250237222', tanggal: TGL + ' ' + JAM, pelanggan: 'Umum', kasir: 'Admin', total: 10000, diskon: 0, bayar: 10000, sisa: 0, metode: 'Tunai', status_bayar: 'Lunas', status_pesanan: 'Selesai', catatan: '', cabang_id: 'CBG-UTAMA', ongkir: 0, diskon_persen: 0, poin_dipakai: 0, poin_didapat: 10, kode_alternatif: '3SNQKW', meja: '', catatan_struk: '', catatan_internal: '', laba: 5000, promo_id: '' }],
    transaksi_detail: [{ transaksi_id: 'TRX-8250237222', produk_id: 'PRD-TESKOPI', nama_produk: 'TES Kopi', qty: 1, harga: 10000, subtotal: 10000, modal: 5000, diskon_item: 0, laba: 5000, satuan_dipakai: '' }],
    pelanggan: [{ id: 'PLG-UMUM', nama: 'Umum', telepon: '', alamat: '', total_beli: 10000, piutang: 0, poin: 0, tier: '', tanggal_lahir: '', terakhir_beli: TGL }],
    pemasok: [], pembelian: [], pembelian_detail: [], pengeluaran: [],
    kas: [{ id: 'KAS-1', tanggal: TGL + ' ' + JAM, jenis: 'Masuk', keterangan: 'Penjualan TRX-8250237222', masuk: 10000, keluar: 0, saldo: 10000, cabang_id: 'CBG-UTAMA' }],
    bahan_baku: [], resep: [],
    pengguna: [{ id: 'USR-ADMIN', nama: 'Admin', email: 'admin@zpos.local', peran: 'Admin', aktif: 'YA', izin_json: '{}', akses_transaksi: 'Tidak dibatasi', cabang_id: '' }],
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
      nama_toko: 'ZPOS', alamat_toko: '', kota_toko: '', telepon_toko: '', footer_struk: 'Terima kasih', target_harian: 0,
      logo_toko: '', logo_2: '', watermark: '',
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
      if (!produkAktif(p) || !lacakStok(p)) return false;
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
  // Sama seperti produkAktif/lacakStok di app.js (definisi ganda supaya tiap
  // file mandiri): produk nonaktif tidak dihitung; jasa tanpa stok (ONGKIR)
  // tidak masuk daftar stok menipis.
  function produkAktif(p) { return p.Aktif !== false && String(p.Aktif == null ? 'YA' : p.Aktif).toUpperCase() !== 'TIDAK'; }
  function lacakStok(p) { if (p.TermasukStok === false) return false; return String(p.TermasukStok == null ? 'YA' : p.TermasukStok).toUpperCase() !== 'TIDAK'; }
  // Normalisasi bendera boolean: DB menyimpan boolean, UI lama memakai 'YA'/'TIDAK'.
  // Jangan pakai `false || 'YA'` (menghasilkan 'YA') — pakai helper ini untuk nilai simpan.
  function boolFlag(v, def) { if (v === true || v === false) return v; if (typeof v === 'string') return v.toUpperCase() !== 'TIDAK'; return def; }
  function setStok(d, p, nilai) {
    var sc = (d.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cabangAktifId(d)); });
    if (sc) { sc.Stok = nilai; return sc; }
    p.Stok = nilai; return p;
  }
  function addLog(d, pengguna, aksi, detail) {
    var row = { ID: uid('LOG'), Tanggal: nowISO(), Pengguna: pengguna || '', Aksi: aksi, Detail: detail || '', CabangID: d ? cabangAktifId(d) : '' };
    // d boleh null (mis. saat login, sebelum loadAll): baris tetap ditulis ke DB,
    // hanya antrean in-memory yang dilewati. Kegagalan tulis log tidak boleh
    // menggagalkan aksi utama — ditelan diam-diam.
    if (d && d.logs) { d.logs.unshift(row); if (d.logs.length > 100) d.logs.length = 100; }
    try { var p = persist('logs', row); if (p && p.catch) p.catch(function () {}); } catch (e) {}
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
  // Hapus semua baris dengan kolom = nilai (mis. detail satu transaksi,
  // resep satu produk). No-op di Mode Contoh, seperti removeRow.
  async function hapusBarisWhere(table, kolom, nilai) {
    if (MODE !== 'supabase' || !client) return;
    var res = await client.from(table).delete().eq(kolom, nilai);
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
      if (res.error) throw new Error('Gagal memuat ' + t + ' — ' + res.error.message);
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
  /* ---------- katalog publik (tanpa login) ----------
     Katalog publik TIDAK memanggil loadAll() — sebagai anon, 34 tabel terkunci
     RLS dan loadAll akan gagal. Data diambil lewat fungsi RPC SECURITY DEFINER
     katalog_publik() yang hanya mengembalikan kolom aman (tanpa harga modal,
     tanpa data toko selain nama + telepon). Di Mode Contoh, dibentuk dari data
     lokal dengan bentuk yang sama (kunci PascalCase). */
  async function loadKatalogPublik(id) {
    if (MODE === 'contoh') {
      if (!DATA) await loadAll();
      var k = (DATA.katalog || []).find(function (x) { return String(x.ID) === String(id); }) || null;
      var p = DATA.pengaturan || {};
      var prods = (DATA.produk || []).filter(function (x) { return produkAktif(x) && flagYa(x.TampilkanDiKatalog); }).map(function (x) { var c = clone(x); c.Stok = stokOf(DATA, x); return c; });
      return { katalog: k ? clone(k) : null, produk: prods, toko: { NamaToko: p.NamaToko || 'ZPOS', TeleponToko: p.TeleponToko || '' } };
    }
    if (!client || !client.rpc) throw new Error('Katalog tidak tersedia.');
    var res = await client.rpc('katalog_publik', { p_id: String(id) });
    if (res.error) throw new Error(res.error.message);
    var d = res.data || {};
    return { katalog: d.katalog || null, produk: d.produk || [], toko: d.toko || {} };
  }
  function refreshRingkasan() { if (DATA) DATA.ringkasan = computeRingkasan(DATA); }
  function getData() { return DATA; }

  /* ---------- login (Supabase Auth) ----------
     Mode Supabase: masuk memakai akun Supabase Auth (email + kata sandi).
     PIN sudah tidak dipakai — kolom pin dihapus dari tabel pengguna, dan
     login TIDAK PERNAH lagi mengunduh daftar pengguna + PIN ke browser.
     Baris pengguna ditautkan ke akun Auth lewat auth_id; saat login pertama,
     penautan dilakukan otomatis bila email baris cocok dengan email akun.
     Mode Contoh: data lokal saja tanpa Supabase — cek PIN lokal seperti dulu.
     Baris contoh tidak menyimpan PIN; PIN kosong berarti tidak berkunci. */
  async function cariPenggunaAuth(authUser, tulisLog) {
    var uid = authUser.id, em = String(authUser.email || '').trim().toLowerCase();
    var row = null;
    var q1 = await client.from('pengguna').select('*').eq('auth_id', uid).maybeSingle();
    if (q1.error) return { ok: false, error: 'Gagal membaca data pengguna: ' + q1.error.message };
    row = q1.data || null;
    if (!row && em) {
      var q2 = await client.from('pengguna').select('*').eq('email', em).maybeSingle();
      if (q2.error) return { ok: false, error: 'Gagal membaca data pengguna: ' + q2.error.message };
      row = q2.data || null;
      if (row) {
        // Tautan otomatis saat login pertama: isi auth_id baris yang email-nya cocok.
        var up = await client.from('pengguna').update({ auth_id: uid }).eq('id', row.id);
        if (up.error) return { ok: false, error: 'Akun belum tertaut ke pengguna toko. Minta Admin menautkan lewat SQL Editor.' };
        row.auth_id = uid;
      }
    }
    if (!row) return { ok: false, error: 'Akun belum terdaftar sebagai pengguna toko.' };
    if (!boolFlag(row.aktif, true)) return { ok: false, error: 'Pengguna tidak aktif.' };
    var u = toPascal(row);
    if (tulisLog) { try { addLog(DATA, u.Nama, 'Login', u.Nama + ' masuk'); } catch (e) {} }
    return { ok: true, nama: u.Nama, peran: u.Peran, ID: u.ID, CabangID: u.CabangID || '', IzinJSON: u.IzinJSON || '{}', AksesTransaksi: u.AksesTransaksi || 'Tidak dibatasi', email: em };
  }
  async function login(email, kataSandi) {
    if (MODE === 'contoh') {
      if (!DATA) await loadAll();
      var list = DATA.pengguna || [];
      if (!list.length) return { ok: true, nama: 'Admin', peran: 'Admin', ID: '', IzinJSON: '{}' };
      var em = String(email || '').trim().toLowerCase();
      var u = list.find(function (x) { return String(x.Email || '').toLowerCase() === em; }) || list[0];
      var pinBenar = (u.Pin == null ? '' : String(u.Pin));
      if (pinBenar !== String(kataSandi || '')) return { ok: false, error: 'PIN salah.' };
      if (!boolFlag(u.Aktif, true)) return { ok: false, error: 'Pengguna tidak aktif.' };
      try { addLog(DATA, u.Nama, 'Login', u.Nama + ' masuk (Mode Contoh)'); } catch (e) {}
      return { ok: true, nama: u.Nama, peran: u.Peran, ID: u.ID, CabangID: u.CabangID || '', IzinJSON: u.IzinJSON || '{}', AksesTransaksi: u.AksesTransaksi || 'Tidak dibatasi' };
    }
    if (!client || !client.auth || !client.auth.signInWithPassword) return { ok: false, error: 'Login tidak tersedia (Auth tidak termuat). Muat ulang halaman.' };
    var emLogin = String(email || '').trim().toLowerCase();
    if (!emLogin || !kataSandi) return { ok: false, error: 'Isi email dan kata sandi.' };
    var res;
    try {
      res = await client.auth.signInWithPassword({ email: emLogin, password: String(kataSandi) });
    } catch (e) { return { ok: false, error: 'Login gagal: ' + (e.message || e) }; }
    if ((res && res.error) || !res || !res.data || !res.data.user) return { ok: false, error: 'Email atau kata sandi salah.' };
    var sesi = await cariPenggunaAuth(res.data.user, true);
    if (!sesi.ok) { try { await client.auth.signOut(); } catch (e) {} return sesi; }
    return sesi;
  }
  // Pulihkan sesi Auth yang tersimpan (mis. setelah muat ulang halaman).
  // Dipakai boot sebelum loadAll — TIDAK menulis log login (bukan login baru).
  async function getSessionUser() {
    if (MODE === 'contoh') return null;
    if (!client || !client.auth || !client.auth.getSession) return null;
    var res;
    try { res = await client.auth.getSession(); } catch (e) { return null; }
    var sessUser = res && res.data && res.data.session && res.data.session.user;
    if (!sessUser) return null;
    try {
      var sesi = await cariPenggunaAuth(sessUser, false);
      return sesi.ok ? sesi : null;
    } catch (e) { return null; }
  }
  async function logout() {
    if (MODE === 'supabase' && client && client.auth && client.auth.signOut) {
      try { await client.auth.signOut(); } catch (e) {}
    }
    return { ok: true };
  }

  /* ---------- promo ---------- */
  function hitungPromoSync(items, pelangganNama, total, cabangId) {
    var diskon = 0, terpakai = [];
    if ((DATA.pengaturan || {}).PromoAktif === 'TIDAK') return { diskon: 0, promoTerpakai: [] };
    var now = new Date();
    var hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()];
    (DATA.promo || []).forEach(function (p) {
      if (!boolFlag(p.Aktif, true)) return;
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
      var termasuk = lacakStok(prod);
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
      var termasuk = lacakStok(prod);
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
    // Semua persist DITUNGGU: kalau ada yang gagal, galatnya naik ke layar
    // (dulu fire-and-forget — transaksi tersimpan tapi stok/detail bisa
    // menyimpang diam-diam tanpa ada yang tahu).
    var janji4b = [];
    stokChanges.forEach(function (c) {
      c.batchChanges.forEach(function (bc) { bc.row.Qty = Number(bc.row.Qty) - bc.ambil; janji4b.push(persist('stok_batch', bc.row)); });
      setStok(DATA, c.prod, c.baru);
      janji4b.push(persist('produk', c.prod));
      if (c.sc) janji4b.push(persist('stok_cabang', c.sc));
    });
    bahanChanges.forEach(function (bc) { bc.row.Stok = Number(bc.row.Stok || 0) - bc.qty; janji4b.push(persist('bahan_baku', bc.row)); });
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
      janji4b.push(persist('transaksi_detail', det));
    });
    try { await Promise.all(janji4b); } catch (e) { throw new Error('Transaksi tersimpan, tapi stok/detail gagal diperbarui (' + (e.message || e) + '). Periksa stok sebelum menjual lagi.'); }
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
        await persist('riwayat_poin', DATA.riwayatPoin[0]);
      }
      if (p.PoinAktif !== 'TIDAK' && pl.Nama !== 'Umum' && statusBayar === 'Lunas' && poinDipakai === 0) {
        poinDidapat = Math.floor(total / Number(p.PoinPerRupiah || 1000));
        if (poinDidapat > 0) {
          pl.Poin = Number(pl.Poin || 0) + poinDidapat;
          DATA.riwayatPoin.unshift({ ID: uid('PNT'), Tanggal: nowISO(), PelangganID: pl.ID, Pelanggan: pl.Nama, Jenis: 'Dapat', Jumlah: poinDidapat, Sisa: pl.Poin, Keterangan: 'Poin dari ' + id, TransaksiID: id });
          await persist('riwayat_poin', DATA.riwayatPoin[0]);
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
  async function upsertInto(key, table, row, prefix, idField) {
    if (!DATA) throw new Error('Data belum dimuat.');
    var arr = DATA[key];
    var id = row[idField || 'ID'] || row.id;
    if (id) {
      var ex = arr.find(function (x) { return String(x.ID) === String(id); });
      if (ex) { Object.keys(row).forEach(function (k) { ex[k] = row[k]; }); await persist(table, ex); refreshRingkasan(); return ex; }
    }
    row.ID = id || uid(prefix);
    arr.unshift(row);
    await persist(table, row);
    refreshRingkasan();
    return row;
  }
  async function hapusDari(key, table, id) {
    var arr = DATA[key];
    var i = arr.findIndex(function (x) { return String(x.ID) === String(id); });
    if (i >= 0) arr.splice(i, 1);
    await removeRow(table, id);
    refreshRingkasan();
  }
  function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'); }

  /* ---------- produk / pelanggan / pemasok ---------- */
  async function upsertProduk(payload) {
    if (!DATA) await loadAll();
    // Edit produk JANGAN menghidupkan lagi produk yang dinonaktifkan
    // (dulu Aktif selalu true — produk pernah terjual muncul lagi di kasir).
    var exProd = payload.ID ? (DATA.produk || []).find(function (x) { return String(x.ID) === String(payload.ID); }) : null;
    var row = {
      ID: payload.ID || '', Nama: payload.Nama, Kategori: payload.Kategori || '', Grup: payload.Grup || '',
      SKUBarcode: payload.SKU || '', HargaJual: Number(payload.HargaJual || 0), HargaModal: Number(payload.HargaModal || 0),
      Stok: Number(payload.Stok == null || payload.Stok === '' ? 0 : payload.Stok),
      Satuan: payload.Satuan || 'pcs', Aktif: exProd ? exProd.Aktif : true, StokMinimum: Number(payload.StokMinimum || 5),
      GambarURL: payload.GambarURL || '', Keterangan: payload.Keterangan || '',
      HargaBisaDiganti: boolFlag(payload.HargaBisaDiganti, true), TermasukStok: boolFlag(payload.TermasukStok, true),
      HargaLainJSON: payload.HargaLainJSON || '', HargaJumlahJSON: payload.HargaJumlahJSON || '',
      VarianJSON: payload.VarianJSON || '', TampilkanDiKatalog: boolFlag(payload.TampilkanDiKatalog, true),
      CabangID: payload.CabangID || cabangAktifId(DATA)
    };
    return upsertInto('produk', 'produk', row, 'PRD');
  }
  async function hapusProduk(id) { if (!DATA) await loadAll(); await hapusDari('produk', 'produk', id); return { ok: true }; }
  // Nonaktifkan produk (dipakai bila produk sudah pernah terjual/dibeli dan
  // database menolak hapus). upsertProduk tidak bisa dipakai di sini karena
  // ia selalu menulis Aktif: true — jadi PATCH langsung kolom aktif saja.
  async function nonaktifkanProduk(id) {
    if (!DATA) await loadAll();
    var ex = DATA.produk.find(function (x) { return String(x.ID) === String(id); });
    if (ex) ex.Aktif = false;
    if (MODE !== 'supabase' || !client) return { ok: true };
    var res = await client.from('produk').update({ aktif: false }).eq('id', id);
    if (res.error) throw new Error(res.error.message);
    refreshRingkasan();
    return { ok: true };
  }
  async function updateProdukStokHarga(prod) {
    if (MODE !== 'supabase' || !client) return;
    var res = await client.from('produk').update({ stok: Number(prod.Stok || 0), harga_modal: Number(prod.HargaModal || 0), harga_jual: Number(prod.HargaJual || 0) }).eq('id', prod.ID);
    if (res.error) throw new Error(res.error.message);
  }
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
    var row = { ID: id, Tanggal: nowISO(), Pemasok: payload.pemasok || '', Total: total, Bayar: Number(payload.bayar || 0), Sisa: total - Number(payload.bayar || 0), Status: 'Draft', Catatan: payload.catatan || '', CabangID: payload.cabangId || cabangAktifId(DATA), Diskon: Number(payload.diskon || 0), Pajak: Number(payload.pajak || 0), BiayaLain: Number(payload.biayaLain || 0), Diproses: false };
    DATA.pembelian.unshift(row); await persist('pembelian', row);
    var dets = (payload.items || []).map(function (it) {
      var det = { PembelianID: id, ProdukID: it.id, NamaProduk: it.nama, Qty: Number(it.Qty || 0), HargaBeli: Number(it.HargaBeli || 0), HargaJual: Number(it.HargaJual || 0), Subtotal: Number(it.Qty || 0) * Number(it.HargaBeli || 0), Kedaluwarsa: it.Kedaluwarsa || null };
      DATA.pembelianDetail.push(det); return det;
    });
    // Detail WAJIB ditunggu (await): kalau insert gagal (mis. tanggal kosong),
    // galatnya harus sampai ke layar, bukan hilang diam-diam.
    for (var di = 0; di < dets.length; di++) await persist('pembelian_detail', dets[di]);
    addLog(DATA, '', 'Pembelian Draft', id + ' — ' + row.Pemasok + ' — ' + total);
    refreshRingkasan(); return { ok: true, id: id };
  }
  async function prosesPembelian(payload) {
    if (!DATA) await loadAll();
    var id = payload.id || payload.ID;
    var p = DATA.pembelian.find(function (x) { return x.ID === id; });
    if (!p) throw new Error('Pembelian tidak ditemukan.');
    if (p.Diproses === true || p.Diproses === 'YA') throw new Error('Pembelian sudah diproses.');
    var cabangId = p.CabangID || cabangAktifId(DATA);
    var items = DATA.pembelianDetail.filter(function (x) { return x.PembelianID === id; });
    if (!items.length) throw new Error('Pembelian ini tidak punya item — stok tidak bisa ditambah. Periksa detail pembelian.');
    await Promise.all(items.map(async function (it) {
      var prod = DATA.produk.find(function (x) { return x.ID === it.ProdukID; });
      if (!prod) return;
      prod.Stok = Number(prod.Stok || 0) + Number(it.Qty || 0);
      if (Number(it.HargaBeli || 0) > 0) prod.HargaModal = Number(it.HargaBeli);
      if (Number(it.HargaJual || 0) > 0) prod.HargaJual = Number(it.HargaJual);
      await updateProdukStokHarga(prod);
      if (it.Kedaluwarsa) {
        var batch = { ID: uid('BTH'), ProdukID: it.ProdukID, CabangID: cabangId, Qty: Number(it.Qty || 0), Kedaluwarsa: it.Kedaluwarsa, PembelianID: id, TanggalMasuk: todayStr() };
        DATA.stokBatch.push(batch); await persist('stok_batch', batch);
      }
    }));
    p.Diproses = true; p.Status = 'Diproses';
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
    // stokQty (opsional): jumlah yang kembali ke stok bisa berbeda dari qty
    // retur bila item dijual per varian (mis. 1 lsn = 12 pcs) — pakai pengali
    // varian seperti batalkanTransaksi, dan kembalikan ke cabang trx itu.
    var qtyStok = Number(payload.stokQty != null ? payload.stokQty : qty);
    if (prod) {
      var scRetur = (DATA.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(prod.ID) && String(x.CabangID) === String(trx.CabangID || cabangAktifId(DATA)); });
      setStok(DATA, prod, stokOf(DATA, prod) + qtyStok);
      await persist('produk', prod);
      if (scRetur) await persist('stok_cabang', scRetur);
    }
    var sisaLama = Number(trx.Sisa || 0);
    trx.Total = Math.max(0, Number(trx.Total || 0) - nominal);
    trx.Sisa = Math.max(0, sisaLama - nominal);
    if (trx.Sisa === 0 && Number(trx.Bayar || 0) > 0) trx.StatusBayar = 'Lunas';
    await persist('transaksi', trx);
    // Pelanggan: retur mengurangi TotalBeli sebesar nominal, dan piutang
    // sebesar berkurangnya sisa (simetris dengan tambahItemTrx yang
    // menambah keduanya). Tanpa ini piutang nyangkut seperti Rp2.000 di #7.
    var pl = DATA.pelanggan.find(function (x) { return x.Nama === trx.Pelanggan; });
    if (pl) {
      pl.TotalBeli = Math.max(0, Number(pl.TotalBeli || 0) - nominal);
      pl.Piutang = Math.max(0, Number(pl.Piutang || 0) - (sisaLama - trx.Sisa));
      await persist('pelanggan', pl);
    }
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
  /* Tambah 1 item ke transaksi lama (alur Griyo): item masuk ke detail,
     stok + bahan berkurang, Total/Sisa naik, trx jadi Belum Lunas sampai
     sisa dibayar. Dipakai dari Detail Transaksi (tombol ＋ Tambah Item). */
  async function tambahItemTrx(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.id; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    var prod = DATA.produk.find(function (x) { return x.ID === payload.produkId; });
    if (!prod) throw new Error('Produk tidak ditemukan.');
    var qty = Math.max(1, Number(payload.qty || 1));
    var harga = Number(payload.harga || 0);
    var satuan = payload.satuan || 'pcs';
    var isi = 1;
    if (satuan) { var vr = parseJSON(prod.VarianJSON || '[]', []); var v = vr.find(function (x) { return x.label === satuan; }); if (v) isi = Number(v.isi || 1); }
    var butuh = qty * isi;
    var cabangId = trx.CabangID || cabangAktifId(DATA);
    if (lacakStok(prod) && stokOf(DATA, prod) < butuh) throw new Error('Stok produk tidak mencukupi: ' + prod.Nama);
    (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
      var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
      if (b && Number(b.Stok || 0) < Number(r.QtyPakai || 0) * butuh) throw new Error('Stok bahan tidak mencukupi: ' + b.Nama);
    });
    var subtotal = harga * qty;
    var namaProduk = prod.Nama + (payload.note ? ' (' + String(payload.note).trim() + ')' : '');
    // PK detail (transaksi_id, produk_id): produk yang sudah ada di trx ini
    // digabung qty-nya, bukan insert baris kedua.
    var ex = (DATA.detail || []).find(function (d) { return String(d.TransaksiID) === String(trx.ID) && String(d.ProdukID) === String(prod.ID); });
    if (ex) {
      ex.Qty = Number(ex.Qty || 0) + qty;
      ex.Subtotal = Number(ex.Subtotal || 0) + subtotal;
      ex.Laba = Number(ex.Laba || 0) + (harga - Number(prod.HargaModal || 0)) * qty;
      if (MODE === 'supabase' && client) {
        var upd = await client.from('transaksi_detail').update({ qty: ex.Qty, subtotal: ex.Subtotal, laba: ex.Laba }).eq('transaksi_id', trx.ID).eq('produk_id', prod.ID);
        if (upd.error) throw new Error(upd.error.message);
      }
    } else {
      var det = {
        TransaksiID: trx.ID, ProdukID: prod.ID, NamaProduk: namaProduk,
        Qty: qty, Harga: harga, Subtotal: subtotal,
        Modal: Number(prod.HargaModal || 0), DiskonItem: 0,
        Laba: (harga - Number(prod.HargaModal || 0)) * qty,
        SatuanDipakai: satuan
      };
      DATA.detail.unshift(det);
      await persist('transaksi_detail', det);
    }
    // Kurangi stok (FEFO batch seperti saveTransaksi) + bahan.
    if (lacakStok(prod)) {
      var sisaButuh = butuh;
      var batches = (DATA.stokBatch || []).filter(function (b) { return String(b.ProdukID) === String(prod.ID) && String(b.CabangID) === String(cabangId) && Number(b.Qty) > 0; })
        .sort(function (a, b) { return String(a.Kedaluwarsa || '9999') < String(b.Kedaluwarsa || '9999') ? -1 : 1; });
      for (var bi = 0; bi < batches.length; bi++) {
        if (sisaButuh <= 0) break;
        var ambil = Math.min(Number(batches[bi].Qty), sisaButuh);
        batches[bi].Qty = Number(batches[bi].Qty) - ambil;
        await persist('stok_batch', batches[bi]);
        sisaButuh -= ambil;
      }
      var sc = (DATA.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(prod.ID) && String(x.CabangID) === String(cabangId); });
      setStok(DATA, prod, stokOf(DATA, prod) - butuh);
      await persist('produk', prod);
      if (sc) await persist('stok_cabang', sc);
    }
    var bahanUbah = [];
    (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
      var b2 = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
      if (b2) { b2.Stok = Number(b2.Stok || 0) - Number(r.QtyPakai || 0) * butuh; bahanUbah.push(b2); }
    });
    for (var ri = 0; ri < bahanUbah.length; ri++) await persist('bahan_baku', bahanUbah[ri]);
    trx.Total = Number(trx.Total || 0) + subtotal;
    trx.Sisa = Math.max(0, Number(trx.Total || 0) - Number(trx.Bayar || 0));
    trx.StatusBayar = trx.Sisa === 0 ? 'Lunas' : (Number(trx.Bayar || 0) > 0 ? 'Kurang' : 'Belum Dibayar');
    trx.Laba = Number(trx.Laba || 0) + (harga - Number(prod.HargaModal || 0)) * qty;
    await persist('transaksi', trx);
    var pl = DATA.pelanggan.find(function (x) { return x.Nama === trx.Pelanggan; });
    if (pl) {
      pl.TotalBeli = Number(pl.TotalBeli || 0) + subtotal;
      pl.Piutang = Number(pl.Piutang || 0) + subtotal;
      await persist('pelanggan', pl);
    }
    addLog(DATA, trx.Kasir, 'Tambah Item', trx.ID + ' — ' + prod.Nama + ' x' + qty);
    refreshRingkasan();
    return { ok: true, total: trx.Total, sisa: trx.Sisa, statusBayar: trx.StatusBayar };
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
    var dets = DATA.detail.filter(function (d) { return d.TransaksiID === trx.ID; });
    // Kembalikan stok (pakai pengali varian: 1 lsn = isi pcs) + bahan baku.
    // Stok dikembalikan ke cabang transaksi itu, bukan cabang aktif.
    var bahanKembali = {};
    for (var di = 0; di < dets.length; di++) {
      var d = dets[di];
      var prod = DATA.produk.find(function (x) { return x.ID === d.ProdukID; });
      if (!prod) continue;
      var isi = 1;
      if (d.SatuanDipakai) { var vr = parseJSON(prod.VarianJSON || '[]', []); var v = vr.find(function (x) { return x.label === d.SatuanDipakai; }); if (v) isi = Number(v.isi || 1); }
      var kembali = Number(d.Qty || 0) * isi;
      if (lacakStok(prod)) {
        var sc = (DATA.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(prod.ID) && String(x.CabangID) === String(trx.CabangID || cabangAktifId(DATA)); });
        if (sc) { sc.Stok = Number(sc.Stok || 0) + kembali; await persist('stok_cabang', sc); }
        else { prod.Stok = Number(prod.Stok || 0) + kembali; await persist('produk', prod); }
      }
      (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
        var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
        if (b) { b.Stok = Number(b.Stok || 0) + Number(r.QtyPakai || 0) * kembali; bahanKembali[b.ID] = b; }
      });
    }
    var daftarBahan = Object.keys(bahanKembali);
    for (var bi = 0; bi < daftarBahan.length; bi++) await persist('bahan_baku', bahanKembali[daftarBahan[bi]]);
    var pl = DATA.pelanggan.find(function (x) { return x.Nama === trx.Pelanggan; });
    if (pl) {
      pl.Piutang = Math.max(0, Number(pl.Piutang || 0) - Number(trx.Sisa || 0));
      pl.TotalBeli = Math.max(0, Number(pl.TotalBeli || 0) - Number(trx.Total || 0));
      // Balik poin: yang didapat ditarik, yang dipakai dikembalikan.
      if (Number(trx.PoinDidapat || 0) > 0) {
        pl.Poin = Math.max(0, Number(pl.Poin || 0) - Number(trx.PoinDidapat));
        DATA.riwayatPoin.unshift({ ID: uid('PNT'), Tanggal: nowISO(), PelangganID: pl.ID, Pelanggan: pl.Nama, Jenis: 'Batal', Jumlah: -Number(trx.PoinDidapat), Sisa: pl.Poin, Keterangan: 'Poin dibatalkan dari ' + trx.ID, TransaksiID: trx.ID });
        await persist('riwayat_poin', DATA.riwayatPoin[0]);
      }
      if (Number(trx.PoinDipakai || 0) > 0) {
        pl.Poin = Number(pl.Poin || 0) + Number(trx.PoinDipakai);
        DATA.riwayatPoin.unshift({ ID: uid('PNT'), Tanggal: nowISO(), PelangganID: pl.ID, Pelanggan: pl.Nama, Jenis: 'Kembali', Jumlah: Number(trx.PoinDipakai), Sisa: pl.Poin, Keterangan: 'Poin kembali dari ' + trx.ID, TransaksiID: trx.ID });
        await persist('riwayat_poin', DATA.riwayatPoin[0]);
      }
      await persist('pelanggan', pl);
    }
    if (Number(trx.Bayar || 0) > 0) {
      var saldo = (DATA.kas || []).reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0) - Number(trx.Bayar);
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Batal transaksi ' + trx.ID + ' (uang kembali)', Masuk: 0, Keluar: Number(trx.Bayar), Saldo: saldo, CabangID: trx.CabangID || cabangAktifId(DATA) };
      DATA.kas.push(kasRow); await persist('kas', kasRow);
    }
    DATA.transaksi = DATA.transaksi.filter(function (x) { return x.ID !== trx.ID; });
    DATA.detail = DATA.detail.filter(function (x) { return x.TransaksiID !== trx.ID; });
    // Hapus juga baris detail di DB (dulu hanya header yang dihapus —
    // detail jadi yatim dan menggelembungkan "Produk Terlaris").
    await hapusBarisWhere('transaksi_detail', 'transaksi_id', trx.ID);
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
    var row = { ID: payload.ID || '', Nama: payload.Nama, Jenis: payload.Jenis || 'DiskonPersen', SyaratJSON: payload.SyaratJSON || '', Nilai: Number(payload.Nilai || 0), Mulai: payload.Mulai || '', Selesai: payload.Selesai || '', JamMulai: payload.JamMulai || '', JamSelesai: payload.JamSelesai || '', Hari: payload.Hari || '', Aktif: boolFlag(payload.Aktif, true), CabangID: payload.CabangID || '' };
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
    var exCbg = payload.ID ? (DATA.cabang || []).find(function (x) { return String(x.ID) === String(payload.ID); }) : null;
    var row = { ID: payload.ID || '', Nama: payload.Nama, Alamat: payload.Alamat || '', Telepon: payload.Telepon || '', Aktif: exCbg ? exCbg.Aktif : true };
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
    var exPgn = payload.ID ? (DATA.pengguna || []).find(function (x) { return String(x.ID) === String(payload.ID); }) : null;
    // Email adalah kunci penautan ke akun Supabase Auth (login pertama menautkan
    // auth_id otomatis bila email cocok). Email kosong pada edit mempertahankan
    // email lama; auth_id tidak pernah ditulis dari form ini.
    var emailBaru = String(payload.Email || (exPgn ? exPgn.Email : '') || '').trim().toLowerCase();
    var row = { ID: payload.ID || '', Nama: payload.Nama, Email: emailBaru, Peran: payload.Peran || 'Kasir', Aktif: exPgn ? exPgn.Aktif : true, IzinJSON: payload.IzinJSON || '{}', AksesTransaksi: payload.AksesTransaksi || 'Tidak dibatasi', CabangID: payload.CabangID || '' };
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
    var idJB = payload.id || payload.ID || '';
    var exJB = idJB ? (DATA.jenisBayar || []).find(function (x) { return String(x.ID) === String(idJB); }) : null;
    return upsertInto('jenisBayar', 'jenis_pembayaran', { ID: idJB, Nama: payload.nama, Aktif: exJB ? exJB.Aktif : true }, 'JB');
  }
  async function hapusJenisBayar(payload) { if (!DATA) await loadAll(); hapusDari('jenisBayar', 'jenis_pembayaran', payload.id); return { ok: true }; }
  async function upsertItemPengeluaran(payload) {
    if (!DATA) await loadAll();
    return upsertInto('itemPengeluaran', 'item_pengeluaran', { ID: payload.id || payload.ID || '', Nama: payload.nama }, 'IP');
  }
  async function hapusItemPengeluaran(payload) { if (!DATA) await loadAll(); hapusDari('itemPengeluaran', 'item_pengeluaran', payload.id); return { ok: true }; }
  async function upsertPegawai(payload) {
    if (!DATA) await loadAll();
    var idPgw = payload.id || payload.ID || '';
    var exPgw = idPgw ? (DATA.pegawai || []).find(function (x) { return String(x.ID) === String(idPgw); }) : null;
    var row = { ID: idPgw, Nama: payload.nama, Telepon: payload.telepon || '', Jabatan: payload.jabatan || '', Target: Number(payload.target || 0), KomisiPersen: Number(payload.komisiPersen || 0), Aktif: exPgw ? exPgw.Aktif : true };
    return upsertInto('pegawai', 'pegawai', row, 'PGW');
  }
  async function hapusPegawai(payload) { if (!DATA) await loadAll(); hapusDari('pegawai', 'pegawai', payload.id); return { ok: true }; }
  async function upsertKatalog(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, TampilkanGambar: boolFlag(payload.TampilkanGambar, true), TampilkanHarga: boolFlag(payload.TampilkanHarga, true), TampilkanStok: boolFlag(payload.TampilkanStok, false), SembunyikanStokKosong: boolFlag(payload.SembunyikanStokKosong, false), TampilkanKeterangan: boolFlag(payload.TampilkanKeterangan, false), Footer: payload.Footer || '', Aktif: boolFlag(payload.Aktif, true), CabangID: payload.CabangID || cabangAktifId(DATA) };
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
    // Hapus dulu bahan lama di DB (dulu hanya difilter lokal — bahan yang
    // dihapus muncul lagi setelah muat ulang), lalu insert baru (dituggu).
    await hapusBarisWhere('resep', 'produk_id', pid);
    for (var ri = 0; ri < (payload.items || []).length; ri++) {
      var it = payload.items[ri];
      var b = DATA.bahan.find(function (x) { return x.ID === it.bahanId; });
      var row = { ProdukID: pid, BahanID: it.bahanId, NamaBahan: it.namaBahan || (b ? b.Nama : ''), QtyPakai: Number(it.qty || 0) };
      DATA.resep.push(row); await persist('resep', row);
    }
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
        var teks = 'Halo ' + pl.Nama + ', ini pengingat dari ' + (DATA.pengaturan.NamaToko || 'ZPOS') + ': piutang Anda sebesar Rp' + Number(pl.Piutang).toLocaleString('id-ID') + ' sudah jatuh tempo (' + hari + ' hari). Mohon segera dilunasi. Terima kasih.';
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
    var lines = ['TAGIHAN — ' + (DATA.pengaturan.NamaToko || 'ZPOS'), 'Pelanggan: ' + nama, '------------------------------'];
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
      ringkasan = { Produk: (DATA.produk || []).filter(produkAktif).length, StokMenipis: (DATA.ringkasan || {}).stokMenipis || 0 };
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
    var p = DATA.pengaturan || {};
    var d = new Date(trx.Tanggal);
    var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var tgl = d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var no = 0;
    DATA.transaksi.slice().sort(function (a, b) { return String(a.Tanggal || '') < String(b.Tanggal || '') ? -1 : 1; }).forEach(function (x, i) { if (x.ID === trx.ID) no = i + 1; });
    var W = 32;
    var tengah = function (s) { s = String(s || ''); if (s.length >= W) return s; return ' '.repeat(Math.floor((W - s.length) / 2)) + s; };
    var kanan = function (kiri, kan) { kiri = String(kiri); kan = String(kan); return kiri + ' '.repeat(Math.max(1, W - kiri.length - kan.length)) + kan; };
    var rpN = function (n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); };
    var angka = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
    var lines = [tengah(p.NamaToko || 'ZPOS')];
    if (p.SloganToko) lines.push(tengah(p.SloganToko));
    if (p.AlamatToko) lines.push(tengah(p.AlamatToko));
    if (p.KotaToko) lines.push(tengah(p.KotaToko));
    if (p.TeleponToko) lines.push(tengah(p.TeleponToko));
    lines.push('', tgl + (no ? '  #' + no : ''), 'Pelanggan: ' + trx.Pelanggan, '--------------------------------');
    DATA.detail.filter(function (x) { return x.TransaksiID === trx.ID; }).forEach(function (x) {
      lines.push(x.NamaProduk);
      var kiri = '  ' + x.Qty + ' x ' + angka(x.Harga);
      lines.push(kiri + ' '.repeat(Math.max(1, W - kiri.length - rpN(x.Subtotal).length)) + rpN(x.Subtotal));
    });
    lines.push('--------------------------------');
    if (Number(trx.Diskon || 0) > 0) lines.push(kanan('Diskon', '-' + rpN(trx.Diskon)));
    if (Number(trx.Ongkir || 0) > 0) lines.push(kanan('Ongkir', rpN(trx.Ongkir)));
    lines.push(kanan('Total', rpN(trx.Total)),
      kanan(trx.Metode || 'Tunai', rpN(trx.Bayar)),
      kanan('Kembali', rpN(Math.max(0, Number(trx.Bayar || 0) - Number(trx.Total || 0)))),
      '', tengah(p.FooterStruk || 'Terima kasih'));
    return { teks: lines.join('\n') };
  }

  /* ---------- UBAH TRANSAKSI (dari sheet "Lebih" di Detail) ---------- */
  async function ubahTransaksi(payload) {
    if (!DATA) await loadAll();
    var ex = (DATA.transaksi || []).find(function (x) { return String(x.ID) === String(payload.id); });
    if (!ex) throw new Error('Transaksi tidak ditemukan.');
    ['Tanggal', 'KodeAlternatif', 'Pelanggan', 'CatatanStruk', 'CatatanInternal'].forEach(function (k) {
      if (payload[k] != null) ex[k] = payload[k];
    });
    await persist('transaksi', ex);
    refreshRingkasan();
    return ex;
  }

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
    var lines = ['LAPOR BOS — ' + (DATA.pengaturan.NamaToko || 'ZPOS'), 'Tanggal: ' + tanggal,
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
    loadAll: loadAll, login: login, getSessionUser: getSessionUser, logout: logout,
    loadKatalogPublik: loadKatalogPublik, saveTransaksi: saveTransaksi,
    upsertProduk: upsertProduk, hapusProduk: hapusProduk, nonaktifkanProduk: nonaktifkanProduk,
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
    tambahPembayaran: tambahPembayaran, tambahItemTrx: tambahItemTrx, ubahStatusPesanan: ubahStatusPesanan,
    ubahTransaksi: ubahTransaksi,
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
