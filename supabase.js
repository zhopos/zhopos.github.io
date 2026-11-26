/* ============================================================
   ZPOS v4-45 — Lapisan Data
   - Bila SUPABASE_URL / SUPABASE_ANON_KEY di config.js terisi,
     semua baca/tulis memakai Supabase (tabel snake_case).
   - Bila kosong, dipakai DATA CONTOH di bawah (in-memory) sehingga
     aplikasi tetap bisa dicoba penuh: tambah keranjang, checkout,
     stok berkurang, dsb. Data contoh hilang saat halaman dimuat ulang.
   - Baris Supabase (snake_case) dipetakan ke objek aplikasi
     (PascalCase, sama seperti V12) saat dibaca, dan sebaliknya
     saat ditulis.
   - v4-41: upsert pelanggan/pemasok toleran terhadap kolom cabang_id
     yang belum ada (migrasi v441 belum jalan), checkout memastikan
     Umum cabang dulu (anti transaksi hantu), salin produk bisa
     memilih ids, hapus cabang menolak bila masih ada riwayat.
   - v4-42: hapus cabang menghitung NET kas (Σ Masuk − Σ Keluar),
     bukan jumlah baris kas — kas net 0 boleh dihapus dan baris kas
     cabang ikut terhapus; kas net ≠ 0 tetap menolak.
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

  /* ---------- STATUS OFFLINE (v4-32) ----------
     offlineMode = true bila DATA berasal dari snapshot IndexedDB (bukan
     dari server). Selama offline, persist()/removeRow() menjadi no-op
     (seperti Mode Contoh) sehingga semua metode tulis tetap berjalan
     in-memory, lalu dicatat ke outbox untuk diunggah saat online.
     _replay = true selama sinkronisasi (cek stok dilewati supaya
     penjualan offline yang diulang tidak ditolak karena stok menipis). */
  var offlineMode = false;
  var _replay = false;
  /* Cabang sesi (v4-40): diisi app.js dari pengguna.CabangID saat login.
     Mengalahkan CabangAktif global, tapi TIDAK PERNAH ditulis ke
     DATA.pengaturan — jadi tidak bocor ke DB lewat persistPengaturan(). */
  var cabangSesiOverride = '';

  /* ---------- toleransi migrasi cabang (v4-41) ----------
     v4-40 selalu mengirim CabangID saat menyimpan pelanggan/pemasok,
     tetapi kedua tabel itu BELUM punya kolom cabang_id di DB live
     sebelum migrasi-cabang-v441.sql dijalankan — checkout di cabang
     baru gagal total ("Could not find the 'cabang_id' column ... in
     the schema cache"). Flag di bawah mengingat penolakan itu supaya
     percobaan berikutnya langsung tanpa kolom (jangan coba-gagal tiap
     kali). Aplikasi harus jalan BENAR baik sebelum maupun sesudah
     migrasi: baris in-memory TETAP membawa CabangID (pemisahan per
     cabang di memori jalan terus); yang dihilangkan hanya kunci
     cabang_id pada salinan yang dikirim ke DB. Flag kembali true
     setelah halaman dimuat ulang (dan migrasi sudah jalan). */
  var kolomCabangPelangganAda = true;
  var kolomCabangPemasokAda = true;
  function galatKolomCabangTidakAda(e) {
    return String((e && e.message) || e || '').indexOf("Could not find the 'cabang_id' column") > -1;
  }
  function tanpaCabangID(row) {
    var o = {};
    Object.keys(row || {}).forEach(function (k) { if (k !== 'CabangID') o[k] = row[k]; });
    return o;
  }
  // Tulis baris pelanggan/pemasok: coba DENGAN CabangID dulu; bila DB
  // menolak karena kolom belum ada, ulangi sekali TANPA CabangID dan
  // set flag supaya berikutnya langsung tanpa kolom. Galat lain (mis.
  // jaringan) dilempar apa adanya — jangan pernah ditelan di sini.
  async function persistCabangToleran(table, row) {
    var jenis = table === 'pelanggan' ? 'pelanggan' : (table === 'pemasok' ? 'pemasok' : null);
    if (!jenis) return persist(table, row);
    var ada = jenis === 'pelanggan' ? kolomCabangPelangganAda : kolomCabangPemasokAda;
    if (!ada) return persist(table, tanpaCabangID(row));
    try { await persist(table, row); }
    catch (e) {
      if (!galatKolomCabangTidakAda(e)) throw e;
      if (jenis === 'pelanggan') kolomCabangPelangganAda = false; else kolomCabangPemasokAda = false;
      await persist(table, tanpaCabangID(row));
    }
  }
  // true bila salah satu kolom cabang_id pernah ditolak = migrasi
  // migrasi-cabang-v441.sql belum dijalankan. Diekspos ke UI sebagai
  // DB.kolomCabangBelumAda (getter) + DB.migrasiCabangBelumJalan().
  function migrasiCabangBelumJalan() { return !kolomCabangPelangganAda || !kolomCabangPemasokAda; }
  // v4-45: probe proaktif — cek keberadaan kolom cabang_id saat data
  // dimuat, supaya banner kuning tampil sejak awal sesi (dulu flag baru
  // berubah setelah ada tulis pelanggan/pemasok yang ditolak server).
  async function probeKolomCabang() {
    if (MODE !== 'supabase' || !client || offlineMode) return;
    try {
      var r1 = await client.from('pelanggan').select('cabang_id').limit(1);
      if (r1 && r1.error && galatKolomCabangTidakAda(r1.error)) kolomCabangPelangganAda = false;
    } catch (e) { if (galatKolomCabangTidakAda(e)) kolomCabangPelangganAda = false; }
    try {
      var r2 = await client.from('pemasok').select('cabang_id').limit(1);
      if (r2 && r2.error && galatKolomCabangTidakAda(r2.error)) kolomCabangPemasokAda = false;
    } catch (e) { if (galatKolomCabangTidakAda(e)) kolomCabangPemasokAda = false; }
  }

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
  // Offline (v4-32): navigator.onLine saja tidak bisa dipercaya (bisa true
  // padahal koneksi mati) — galat jaringan dikenali dari pesannya.
  function jaringanMati() { try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch (e) { return false; } }
  function galatJaringan(e) {
    var m = String((e && e.message) || e || '');
    return /failed to fetch|network|load failed|networkerror|network request failed|offline/i.test(m);
  }
  // localStorage (dijaga: tidak ada di Node/sim, bisa diblokir di privat).
  function lsGet(k) { try { if (typeof localStorage === 'undefined' || !localStorage) return null; return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (typeof localStorage === 'undefined' || !localStorage) return; localStorage.setItem(k, v); } catch (e) {} }
  function lsHapus(k) { try { if (typeof localStorage === 'undefined' || !localStorage) return; localStorage.removeItem(k); } catch (e) {} }

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
    // v4-40: semua agregat UTAMA dibatasi ke cabang efektif (override sesi
    // login bila ada, else CabangAktif global). perCabang tetap semua cabang.
    var cabangEfektif = cabangAktifId(d);
    var trxCabang = (d.transaksi || []).filter(function (t) { return milikCabang(d, t, cabangEfektif); });
    var trxHariIni = trxCabang.filter(function (t) { return String(t.Tanggal || '').slice(0, 10) === tgl; });
    var lunasHariIni = trxHariIni.filter(function (t) { return t.StatusBayar === 'Lunas'; });
    var omzet = lunasHariIni.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
    var laba = lunasHariIni.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
    var dibayar = trxHariIni.reduce(function (a, t) { return a + Number(t.Bayar || 0); }, 0);
    var piutang = trxCabang.filter(function (t) { return t.StatusBayar !== 'Lunas'; })
      .reduce(function (a, t) { return a + Number(t.Sisa || 0); }, 0);
    // Utang tidak punya CabangID: cabangnya diturunkan dari pembelian
    // (via PembelianID); bila pembelian tidak ketemu, cabang pertama.
    var hutang = (d.utang || []).filter(function (u) {
      if (u.Status === 'Lunas') return false;
      return !cabangEfektif || cabangUtang(d, u) === String(cabangEfektif);
    }).reduce(function (a, u) { return a + Number(u.Sisa || 0); }, 0);
    var saldoKas = saldoKasCabang(d, cabangEfektif);
    var stokTipisList = (d.produk || []).filter(function (p) {
      if (!produkAktif(p) || !lacakStok(p)) return false;
      if (!milikCabang(d, p, cabangEfektif)) return false;
      return stokOf(d, p) <= Number(p.StokMinimum == null ? 5 : p.StokMinimum);
    }).map(function (p) { return { nama: p.Nama, stok: stokOf(d, p), satuan: p.Satuan || '' }; });
    var kedaluwarsaList = (d.stokBatch || []).filter(function (b) {
      if (!b.Kedaluwarsa || Number(b.Qty) <= 0) return false;
      if (!milikCabang(d, b, cabangEfektif)) return false;
      var diff = (new Date(b.Kedaluwarsa) - new Date(tgl)) / 86400000;
      return diff <= 7;
    }).map(function (b) {
      var p = (d.produk || []).find(function (x) { return x.ID === b.ProdukID; });
      return { nama: p ? p.Nama : (b.NamaProduk || ''), Kedaluwarsa: b.Kedaluwarsa, NamaProduk: p ? p.Nama : '' };
    });
    // analitik 7 & 28 hari (cabang efektif saja)
    function analitik(n) {
      var perHari = [], om = 0, lb = 0, jml = 0;
      for (var i = n - 1; i >= 0; i--) {
        var dt = new Date(); dt.setDate(dt.getDate() - i);
        var ds = todayStr(dt);
        var list = trxCabang.filter(function (t) { return String(t.Tanggal || '').slice(0, 10) === ds && t.StatusBayar === 'Lunas'; });
        var o = list.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
        var l = list.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
        perHari.push({ tanggal: ds, omzet: o, laba: l, jumlah: list.length });
        om += o; lb += l; jml += list.length;
      }
      return { omzet: om, laba: lb, jumlah: jml, perHari: perHari };
    }
    // terlaris & pelanggan top (cabang efektif saja; detail tidak punya
    // CabangID, jadi difilter lewat Set ID transaksi cabang itu)
    // v4-45: terlaris hanya dari transaksi Lunas, net retur — konsisten
    // dengan pie chart laporan (dulu semua transaksi incl. Belum Lunas
    // dan mengabaikan retur, jadi dua tampilan "terlaris" bisa berbeda).
    var idTrxLunas = {};
    trxCabang.forEach(function (t) { if (t.StatusBayar === 'Lunas') idTrxLunas[t.ID] = true; });
    var jual = {};
    (d.detail || []).forEach(function (x) { if (!idTrxLunas[x.TransaksiID]) return; jual[x.NamaProduk] = (jual[x.NamaProduk] || 0) + Number(x.Qty || 0); });
    (d.retur || []).forEach(function (r) { if (!idTrxLunas[r.TransaksiID]) return; jual[r.Produk] = Math.max(0, (jual[r.Produk] || 0) - Number(r.Qty || 0)); });
    var terlaris = Object.keys(jual).map(function (k) { return { nama: k, qty: jual[k] }; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
    var pelangganTop = (d.pelanggan || []).filter(function (p) { return Number(p.TotalBeli || 0) > 0 && milikCabang(d, p, cabangEfektif); })
      .map(function (p) { return { nama: p.Nama, total: Number(p.TotalBeli || 0) }; })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
    var perCabang = (d.cabang || []).map(function (c) {
      var lt = (d.transaksi || []).filter(function (t) { return String(t.CabangID || '') === String(c.ID) && String(t.Tanggal || '').slice(0, 10) === tgl && t.StatusBayar === 'Lunas'; });
      // v4-40: stokMenipis dihitung PER cabang ini (dulu memakai jumlah
      // global stokTipisList untuk semua cabang).
      var tipis = (d.produk || []).filter(function (p) {
        if (!produkAktif(p) || !lacakStok(p)) return false;
        if (!milikCabang(d, p, c.ID)) return false;
        return stokOfCabang(d, p, c.ID) <= Number(p.StokMinimum == null ? 5 : p.StokMinimum);
      }).length;
      return {
        cabangId: c.ID, nama: c.Nama,
        omzetHariIni: lt.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0),
        labaHariIni: lt.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0),
        jumlahTrx: lt.length, stokMenipis: tipis
      };
    });
    var a7 = analitik(7), a28 = analitik(28);
    var kem = a7.perHari.length >= 2 ? a7.perHari[a7.perHari.length - 2].omzet : 0;
    // Target: TargetHarian cabang efektif bila > 0, else TargetHarian global.
    var targetCabang = 0;
    var rowCbg = (d.cabang || []).find(function (c) { return String(c.ID) === String(cabangEfektif); });
    if (rowCbg) targetCabang = Number(rowCbg.TargetHarian || 0);
    return {
      cabangEfektifId: cabangEfektif,
      omzetHariIni: omzet, labaHariIni: laba, dibayarHariIni: dibayar,
      jumlahTrxHariIni: trxHariIni.length, piutang: piutang, hutang: hutang,
      saldoKas: saldoKas, stokMenipis: stokTipisList.length, stokTipisList: stokTipisList,
      kedaluwarsaList: kedaluwarsaList, targetHarian: targetCabang > 0 ? targetCabang : Number((d.pengaturan || {}).TargetHarian || 0),
      terlaris: terlaris, pelangganTop: pelangganTop, analitik7: a7, analitik28: a28,
      omzetKemarin: kem, perCabang: perCabang,
      poinAktif: (d.pengaturan || {}).PoinAktif !== 'TIDAK',
      modeMejaAktif: (d.pengaturan || {}).ModeMejaAktif === 'YA',
      promoAktif: (d.pengaturan || {}).PromoAktif !== 'TIDAK',
      pajakAktif: (d.pengaturan || {}).PajakAktif === 'YA'
    };
  }
  /* ---------- cabang & stok per cabang (v4-40) ---------- */
  // Baris tanpa CabangID dianggap milik cabang PERTAMA (aturan legacy).
  function cabangPertamaId(d) { var c = (d.cabang || [])[0]; return (c && c.ID) || ''; }
  // Bila cabangId kosong (tidak ada konteks cabang), semua baris cocok —
  // menjaga perilaku lama saat daftar cabang kosong.
  function milikCabang(d, row, cabangId) {
    if (!cabangId) return true;
    var cid = String((row && row.CabangID) || '') || String(cabangPertamaId(d));
    return cid === String(cabangId);
  }
  // Cabang sebuah utang diturunkan dari pembeliannya (utang tidak punya
  // CabangID sendiri); bila pembelian tidak ketemu, cabang pertama.
  function cabangUtang(d, u) {
    var pb = (d.pembelian || []).find(function (x) { return String(x.ID) === String(u.PembelianID); });
    if (pb) return String(pb.CabangID || '') || String(cabangPertamaId(d));
    return String(cabangPertamaId(d));
  }
  function setCabangSesi(id) { cabangSesiOverride = String(id || ''); if (DATA) refreshRingkasan(); }
  function cabangAktifId(d) {
    return cabangSesiOverride || (d.pengaturan || {}).CabangAktif || ((d.cabang || [])[0] && d.cabang[0].ID) || '';
  }
  function stokOfCabang(d, p, cabangId) {
    var sc = (d.stokCabang || []).find(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cabangId); });
    if (sc) return Number(sc.Stok || 0);
    return Number(p.Stok || 0);
  }
  function stokOf(d, p) {
    return stokOfCabang(d, p, cabangAktifId(d));
  }
  function saldoKasCabang(d, cabangId) {
    return (d.kas || []).reduce(function (a, k) {
      if (!milikCabang(d, k, cabangId)) return a;
      return a + Number(k.Masuk || 0) - Number(k.Keluar || 0);
    }, 0);
  }
  // v4-41: kecocokan cabang PERSIS diutamakan — bila ada baris dengan
  // nama sama di cabang itu DAN baris legacy tanpa CabangID, yang
  // persis yang dipakai (dulu milikCabang mengembalikan yang pertama
  // ketemu menurut urutan array). Lalu fallback ke baris legacy tanpa
  // CabangID — baris itu milik cabang PERTAMA (aturan milikCabang +
  // backfill migrasi v441), jadi fallback hanya dipakai bila cabang
  // yang dicari memang cabang pertama; cabang lain TIDAK memakai
  // baris legacy (supaya pastikanUmumCabang tetap membuat Umum
  // sendiri per cabang, dan penjualan cabang lain tidak mengotori
  // TotalBeli/Piutang pelanggan cabang pertama). Tanpa konteks cabang
  // (cabangId kosong), perilaku lama: baris pertama dengan nama itu.
  function cariPelangganCabang(d, nama, cabangId) {
    var list = d.pelanggan || [], i, x;
    if (cabangId) {
      for (i = 0; i < list.length; i++) { x = list[i]; if (x.Nama === nama && String(x.CabangID || '') === String(cabangId)) return x; }
      if (String(cabangId) === String(cabangPertamaId(d))) {
        for (i = 0; i < list.length; i++) { x = list[i]; if (x.Nama === nama && !x.CabangID) return x; }
      }
      return null;
    }
    for (i = 0; i < list.length; i++) { x = list[i]; if (x.Nama === nama) return x; }
    return null;
  }
  function cariPemasokCabang(d, nama, cabangId) {
    var list = d.pemasok || [], i, x;
    if (cabangId) {
      for (i = 0; i < list.length; i++) { x = list[i]; if (x.Nama === nama && String(x.CabangID || '') === String(cabangId)) return x; }
      if (String(cabangId) === String(cabangPertamaId(d))) {
        for (i = 0; i < list.length; i++) { x = list[i]; if (x.Nama === nama && !x.CabangID) return x; }
      }
      return null;
    }
    for (i = 0; i < list.length; i++) { x = list[i]; if (x.Nama === nama) return x; }
    return null;
  }
  // Sama seperti produkAktif/lacakStok di app.js (definisi ganda supaya tiap
  // file mandiri): produk nonaktif tidak dihitung; jasa tanpa stok (ONGKIR)
  // tidak masuk daftar stok menipis.
  function produkAktif(p) { return p.Aktif !== false && String(p.Aktif == null ? 'YA' : p.Aktif).toUpperCase() !== 'TIDAK'; }
  function lacakStok(p) { if (p.TermasukStok === false) return false; return String(p.TermasukStok == null ? 'YA' : p.TermasukStok).toUpperCase() !== 'TIDAK'; }
  // Normalisasi bendera boolean: DB menyimpan boolean, UI lama memakai 'YA'/'TIDAK'.
  // Jangan pakai `false || 'YA'` (menghasilkan 'YA') — pakai helper ini untuk nilai simpan.
  function boolFlag(v, def) { if (v === true || v === false) return v; if (typeof v === 'string') return v.toUpperCase() !== 'TIDAK'; return def; }
  // v4-40: stok HANYA ditulis ke baris stok_cabang (dibuat bila belum ada).
  // prod.Stok TIDAK lagi ditulis — ia hanya fallback baca (legacy) bila
  // baris stok_cabang belum ada. Mengembalikan baris stok_cabang itu.
  function setStok(d, p, nilai, cabangId) {
    var cb = cabangId || cabangAktifId(d);
    if (!d.stokCabang) d.stokCabang = [];
    var sc = d.stokCabang.find(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cb); });
    if (sc) { sc.Stok = nilai; return sc; }
    sc = { CabangID: cb, ProdukID: p.ID, NamaProduk: p.Nama, Stok: nilai, StokMinimum: p.StokMinimum == null ? 0 : p.StokMinimum };
    d.stokCabang.push(sc);
    return sc;
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
    if (offlineMode) return; // v4-32: tulis offline hanya in-memory + outbox
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
    if (offlineMode) return; // v4-32: hapus offline hanya in-memory + outbox
    var res = await client.from(table).delete().eq('id', id);
    if (res.error) throw new Error(res.error.message);
  }
  // Hapus semua baris dengan kolom = nilai (mis. detail satu transaksi,
  // resep satu produk). No-op di Mode Contoh, seperti removeRow.
  async function hapusBarisWhere(table, kolom, nilai) {
    if (MODE !== 'supabase' || !client) return;
    if (offlineMode) return; // v4-32: hapus offline hanya in-memory + outbox
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
  // Tarik semua data dari server (tanpa menyentuh DATA / snapshot) —
  // dipakai loadAll online dan sinkronkanOutbox (replay butuh data server
  // segar supaya nilai yang dihitung tidak ganda dengan perubahan offline).
  async function muatDariServer() {
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
    return d;
  }
  async function loadAll() {
    if (MODE === 'contoh') {
      DATA = sampleToData();
      DATA.ringkasan = computeRingkasan(DATA);
      return DATA;
    }
    // v4-32: offline -> salinan terakhir dari IndexedDB (bukan galat).
    if (jaringanMati()) {
      var snap0 = await muatDariSnapshot();
      if (snap0) return snap0;
      throw new Error('OFFLINE_TANPA_SNAPSHOT');
    }
    var d;
    try { d = await muatDariServer(); }
    catch (e) {
      if (galatJaringan(e)) {
        var snap = await muatDariSnapshot();
        if (snap) return snap;
        throw new Error('OFFLINE_TANPA_SNAPSHOT');
      }
      throw e;
    }
    DATA = d;
    DATA.ringkasan = computeRingkasan(DATA);
    offlineMode = false;
    // v4-45: probe proaktif keberadaan kolom cabang_id (lihat atas).
    try { await probeKolomCabang(); } catch (e) {}
    // v4-32: snapshot HANYA ditimpa bila tidak ada antrean yang belum
    // diunggah — bila ada, snapshot lama (yang berisi perubahan offline)
    // dipertahankan supaya sinkronisasi yang gagal masih bisa
    // mengembalikan tampilan ke keadaan offline.
    try { if ((await bacaOutbox()).length === 0) await tulisSnapshot(); } catch (e) {}
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
      // v4-40: katalog hanya menampilkan produk cabangnya (produk tanpa
      // CabangID dianggap cabang pertama); bila katalog tanpa CabangID,
      // tanpa filter. Stok dibaca per cabang katalog itu.
      var katCabang = k && k.CabangID ? String(k.CabangID) : '';
      var prods = (DATA.produk || []).filter(function (x) {
        if (!produkAktif(x) || !flagYa(x.TampilkanDiKatalog)) return false;
        if (!katCabang) return true;
        return milikCabang(DATA, x, katCabang);
      }).map(function (x) { var c = clone(x); c.Stok = katCabang ? stokOfCabang(DATA, x, katCabang) : stokOf(DATA, x); return c; });
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
    // v4-32: galat jaringan dilempar (bukan {ok:false}) supaya getSessionUser
    // bisa membedakan "offline" dari "akun memang tidak terdaftar".
    if (q1.error) { if (galatJaringan(q1.error)) throw new Error(q1.error.message || 'Gagal memuat pengguna'); return { ok: false, error: 'Gagal membaca data pengguna: ' + q1.error.message }; }
    row = q1.data || null;
    if (!row && em) {
      var q2 = await client.from('pengguna').select('*').eq('email', em).maybeSingle();
      if (q2.error) { if (galatJaringan(q2.error)) throw new Error(q2.error.message || 'Gagal memuat pengguna'); return { ok: false, error: 'Gagal membaca data pengguna: ' + q2.error.message }; }
      row = q2.data || null;
      if (row) {
        // Tautan otomatis saat login pertama: isi auth_id baris yang email-nya cocok.
        var up = await client.from('pengguna').update({ auth_id: uid }).eq('id', row.id);
        if (up.error) { if (galatJaringan(up.error)) throw new Error(up.error.message || 'Gagal menautkan akun'); return { ok: false, error: 'Akun belum tertaut ke pengguna toko. Minta Admin menautkan lewat SQL Editor.' }; }
        row.auth_id = uid;
      }
    }
    if (!row) return { ok: false, error: 'Akun belum terdaftar sebagai pengguna toko.' };
    if (!boolFlag(row.aktif, true)) return { ok: false, error: 'Pengguna tidak aktif.' };
    var u = toPascal(row);
    // v4-32: simpan salinan pengguna terakhir di perangkat — dipakai
    // getSessionUser saat offline (tanpa ini, sesi Auth yang tersimpan
    // tidak bisa dipulihkan offline karena cariPenggunaAuth butuh network).
    // v4-45: catat waktu simpan — dipakai getSessionUser untuk menilai
    // apakah salinan sesi masih segar saat login offline.
    lsSet('zpos_sesi_pengguna', JSON.stringify({ auth_id: uid, nama: u.Nama, peran: u.Peran, ID: u.ID, CabangID: u.CabangID || '', IzinJSON: u.IzinJSON || '{}', AksesTransaksi: u.AksesTransaksi || 'Tidak dibatasi', email: em, disimpan: Date.now() }));
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
    var sesi;
    try { sesi = await cariPenggunaAuth(res.data.user, true); }
    catch (e) { try { await client.auth.signOut(); } catch (e2) {} return { ok: false, error: 'Tidak bisa memeriksa akun — periksa koneksi internet.' }; }
    if (!sesi.ok) { try { await client.auth.signOut(); } catch (e) {} return sesi; }
    return sesi;
  }
  // Pulihkan sesi Auth yang tersimpan (mis. setelah muat ulang halaman).
  // Dipakai boot sebelum loadAll — TIDAK menulis log login (bukan login baru).
  // v4-45: login offline tetap bisa dipakai selama salinan sesi tersimpan
  // masih segar (<=7 hari sejak login) — dulu getSession() yang gagal
  // (token JWT kedaluwarsa +-1 jam + offline) langsung mengembalikan null
  // dan fallback localStorage tidak pernah tercapai. Bila salinan pun
  // kedaluwarsa (atau dari sebelum v4-45, tanpa stempel waktu), kembalikan
  // {ok:false, perluOnline:true} supaya UI memberi pesan jelas, bukan
  // layar login diam.
  var MASA_SESI_TERSIMPAN_MS = 7 * 24 * 60 * 60 * 1000;
  function sesiTersimpanSegar() {
    try {
      var c = JSON.parse(lsGet('zpos_sesi_pengguna') || 'null');
      if (!c || !c.nama) return null;
      if (!c.disimpan || Date.now() - Number(c.disimpan) > MASA_SESI_TERSIMPAN_MS) return { kedaluwarsa: true, sesi: c };
      return { kedaluwarsa: false, sesi: c };
    } catch (e) { return null; }
  }
  async function getSessionUser() {
    if (MODE === 'contoh') return null;
    if (!client || !client.auth || !client.auth.getSession) return null;
    var res = null;
    try { res = await client.auth.getSession(); } catch (e) { res = null; }
    var sessUser = res && res.data && res.data.session && res.data.session.user;
    if (sessUser) {
      try {
        var sesi = await cariPenggunaAuth(sessUser, false);
        return sesi.ok ? sesi : null;
      } catch (e) {
        // v4-32: offline — cariPenggunaAuth butuh network. Jatuh ke
        // fallback sesi tersimpan di bawah (bila auth_id cocok).
        if (!galatJaringan(e)) return null;
      }
    }
    var tersimpan = sesiTersimpanSegar();
    if (tersimpan && !tersimpan.kedaluwarsa) {
      var c = tersimpan.sesi;
      if (!sessUser || String(c.auth_id || '') === String(sessUser.id)) {
        return { ok: true, nama: c.nama, peran: c.peran, ID: c.ID, CabangID: c.CabangID || '', IzinJSON: c.IzinJSON || '{}', AksesTransaksi: c.AksesTransaksi || 'Tidak dibatasi', email: c.email || '' };
      }
    }
    if (tersimpan && tersimpan.kedaluwarsa) return { ok: false, perluOnline: true };
    return null;
  }
  async function logout() {
    lsHapus('zpos_sesi_pengguna');
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
    // v4-41: pastikan pelanggan Umum cabang ini ADA dulu, SEBELUM ada
    // baris transaksi/detail/kas yang ditulis. Bila gagal karena
    // alasan selain kolom (mis. jaringan), checkout batal di sini —
    // tidak ada lagi transaksi hantu. Bila gagal karena kolom
    // cabang_id belum ada, upsert toleran (v4-41) yang menangani:
    // Umum tetap dibuat, tanpa cabang_id di DB.
    await pastikanUmumCabang(cabangId);
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
      // v4-32: penjualan offline SELALU diizinkan (aturan Bos) — cek stok
      // dilewati saat offline maupun saat mengulang antrean (replay);
      // stok yang jadi negatif ditandai "Stok Minus — cek" di halaman Stok.
      if (!offlineMode && !_replay && stokOfCabang(DATA, prod, cabangId) < butuh) throw new Error('Stok produk tidak mencukupi: ' + prod.Nama);
      // bahan baku via resep
      (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
        var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
        if (!offlineMode && !_replay && b && Number(b.Stok || 0) < Number(r.QtyPakai || 0) * butuh) throw new Error('Stok bahan tidak mencukupi: ' + b.Nama);
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
        var baru = stokOfCabang(DATA, prod, cabangId) - butuh;
        stokChanges.push({ prod: prod, baru: baru, batchChanges: batchChanges });
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
    // v4-32: id boleh dibawa dari payload (transaksi yang dibuat offline
    // memakai id ini; saat diulang ke server, id yang sama dipakai lagi
    // supaya operasi berikutnya yang merujuk id itu — bayar, batal, retur
    // — tetap menemukan transaksinya).
    var id = payload.id || payload.ID || uid('TRX');
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
      // v4-40: setStok mengembalikan baris stok_cabang (dibuat bila belum
      // ada) — baris itulah yang dipersist, bukan tangkapan sc lama.
      var scBaru = setStok(DATA, c.prod, c.baru, cabangId);
      janji4b.push(persist('produk', c.prod));
      janji4b.push(persist('stok_cabang', scBaru));
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
    var pl = cariPelangganCabang(DATA, trx.Pelanggan, cabangId);
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
      await persistCabangToleran('pelanggan', pl);
      await persist('transaksi', trx);
    } else {
      // v4-41: pelanggan tidak ditemukan (mis. nama pelanggan dari
      // cabang lain / belum dibuat di cabang ini) — JANGAN diam-diam
      // melewati: catat di log, lalu lanjutkan dengan aman (transaksi
      // + kas tetap tersimpan; TotalBeli/Piutang/Poin tidak diperbarui).
      try { addLog(DATA, trx.Kasir, 'Pelanggan Tidak Ditemukan', trx.ID + ' — pelanggan "' + trx.Pelanggan + '" tidak ditemukan di cabang ' + cabangId + ' — TotalBeli/Piutang/Poin tidak diperbarui'); } catch (e) {}
    }
    // 6. Kas bila ada pembayaran
    if (bayar > 0) {
      var saldo = saldoKasCabang(DATA, cabangId) + bayar;
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
  // pakaiToleran (v4-41): bila true, tulis memakai persistCabangToleran
  // (coba dengan CabangID, ulangi tanpa bila kolom belum ada) — hanya
  // untuk pelanggan/pemasok; tabel lain tetap memakai persist biasa.
  async function upsertInto(key, table, row, prefix, idField, pakaiToleran) {
    if (!DATA) throw new Error('Data belum dimuat.');
    var tulis = pakaiToleran ? persistCabangToleran : persist;
    var arr = DATA[key];
    var id = row[idField || 'ID'] || row.id;
    if (id) {
      var ex = arr.find(function (x) { return String(x.ID) === String(id); });
      if (ex) {
        // v4-41: simpan dulu salinan baris — bila tulis gagal, kembalikan
        // DATA seperti semula supaya percobaan ulang tidak menemukan
        // baris setengah-jadi (checkout ulangan tetap atomik).
        var cadangan = {};
        Object.keys(ex).forEach(function (k) { cadangan[k] = ex[k]; });
        Object.keys(row).forEach(function (k) { ex[k] = row[k]; });
        try { await tulis(table, ex); } catch (e) {
          Object.keys(ex).forEach(function (k) { delete ex[k]; });
          Object.keys(cadangan).forEach(function (k) { ex[k] = cadangan[k]; });
          throw e;
        }
        refreshRingkasan(); return ex;
      }
    }
    row.ID = id || uid(prefix);
    arr.unshift(row);
    // v4-41: baris baru masuk DATA dulu, tapi bila tulis gagal baris itu
    // dikeluarkan lagi — jangan biarkan baris yang tidak tersimpan di DB
    // tertinggal di memori (mis. Umum cabang baru saat checkout gagal).
    try { await tulis(table, row); } catch (e) {
      var idxBaru = arr.indexOf(row);
      if (idxBaru >= 0) arr.splice(idxBaru, 1);
      throw e;
    }
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
    var hasilProduk = await upsertInto('produk', 'produk', row, 'PRD');
    // v4-45: edit Stok harus mengubah stok yang dipakai kasir — bila baris
    // stok_cabang produk ini sudah ada di cabang produk, tulis juga ke sana
    // (dulu hanya produk.Stok yang berubah, kasir tetap membaca nilai lama).
    if (exProd && payload.Stok != null && payload.Stok !== '') {
      var cbStok = row.CabangID || cabangAktifId(DATA);
      var adaSc = (DATA.stokCabang || []).some(function (x) { return String(x.ProdukID) === String(hasilProduk.ID) && String(x.CabangID) === String(cbStok); });
      if (adaSc) {
        var scBaru = setStok(DATA, hasilProduk, Number(payload.Stok), cbStok);
        await persist('stok_cabang', scBaru);
      }
    }
    return hasilProduk;
  }
  async function hapusProduk(id) { if (!DATA) await loadAll(); await hapusDari('produk', 'produk', id); return { ok: true }; }
  async function hapusPelanggan(id) { if (!DATA) await loadAll(); await hapusDari('pelanggan', 'pelanggan', id); return { ok: true }; }
  // Nonaktifkan produk (dipakai bila produk sudah pernah terjual/dibeli dan
  // database menolak hapus). upsertProduk tidak bisa dipakai di sini karena
  // ia selalu menulis Aktif: true — jadi PATCH langsung kolom aktif saja.
  async function nonaktifkanProduk(id) {
    if (!DATA) await loadAll();
    var ex = DATA.produk.find(function (x) { return String(x.ID) === String(id); });
    if (ex) ex.Aktif = false;
    if (MODE !== 'supabase' || !client || offlineMode) { refreshRingkasan(); return { ok: true }; }
    var res = await client.from('produk').update({ aktif: false }).eq('id', id);
    if (res.error) throw new Error(res.error.message);
    refreshRingkasan();
    return { ok: true };
  }
  async function updateProdukStokHarga(prod) {
    if (MODE !== 'supabase' || !client || offlineMode) return;
    // v4-40: HANYA harga yang ditulis ke baris produk — stok kini hidup di
    // stok_cabang (ditulis setStok + persist('stok_cabang')).
    var res = await client.from('produk').update({ harga_modal: Number(prod.HargaModal || 0), harga_jual: Number(prod.HargaJual || 0) }).eq('id', prod.ID);
    if (res.error) throw new Error(res.error.message);
  }
  async function upsertPelanggan(payload) {
    if (!DATA) await loadAll();
    var row = {
      ID: payload.ID || '', Nama: payload.Nama, Telepon: payload.Telepon || '', Alamat: payload.Alamat || '',
      TotalBeli: Number(payload.TotalBeli || 0), Piutang: Number(payload.Piutang || 0),
      Poin: Number(payload.Poin || 0), Tier: payload.Tier || '', TanggalLahir: payload.TanggalLahir || null,
      TerakhirBeli: payload.TerakhirBeli || null,
      CabangID: payload.CabangID || cabangAktifId(DATA)
    };
    var ex = row.ID ? DATA.pelanggan.find(function (x) { return x.ID === row.ID; }) : null;
    if (ex) { row.TotalBeli = ex.TotalBeli; row.Piutang = ex.Piutang; row.Poin = ex.Poin; row.TerakhirBeli = ex.TerakhirBeli; }
    // v4-41: tulis toleran — bila kolom cabang_id belum ada di DB,
    // persistCabangToleran mengulang tanpa kolom dan mengingatnya.
    return upsertInto('pelanggan', 'pelanggan', row, 'PLG', undefined, true);
  }
  async function upsertPemasok(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.ID || '', Nama: payload.Nama, Telepon: payload.Telepon || '', Alamat: payload.Alamat || '', Hutang: Number(payload.Hutang || 0), CabangID: payload.CabangID || cabangAktifId(DATA) };
    var ex = row.ID ? DATA.pemasok.find(function (x) { return x.ID === row.ID; }) : null;
    if (ex) row.Hutang = ex.Hutang;
    // v4-41: tulis toleran — sama seperti upsertPelanggan di atas.
    return upsertInto('pemasok', 'pemasok', row, 'PMS', undefined, true);
  }
  // v4-33: pemasok akhirnya bisa dihapus (dulu tabel pemasok tanpa aksi).
  // Guard seperti produk: pemasok yang sudah dipakai di pembelian tidak
  // boleh dihapus — riwayat pembelian + utang merujuk namanya.
  async function hapusPemasok(payload) {
    if (!DATA) await loadAll();
    var id = typeof payload === 'string' ? payload : (payload.id || payload.ID || '');
    var pm = (DATA.pemasok || []).find(function (x) { return String(x.ID) === String(id); });
    if (!pm) throw new Error('Pemasok tidak ditemukan.');
    // v4-40: guard per cabang — pembelian cabang lain dengan nama pemasok
    // yang sama tidak menghalangi hapus.
    var cabPm = String(pm.CabangID || '') || String(cabangPertamaId(DATA));
    var dipakai = (DATA.pembelian || []).some(function (p) { return String(p.Pemasok || '') === String(pm.Nama) && milikCabang(DATA, p, cabPm); });
    if (dipakai) throw new Error('Pemasok "' + pm.Nama + '" sudah pernah dipakai di pembelian, jadi tidak bisa dihapus.');
    await hapusDari('pemasok', 'pemasok', id);
    return { ok: true };
  }

  /* ---------- pengeluaran & kas ---------- */
  async function simpanPengeluaran(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.id || payload.ID || uid('PGL'), Tanggal: nowISO(), Kategori: payload.kategori || 'Lainnya', Keterangan: payload.keterangan || '', Nominal: Number(payload.nominal || 0), EfekLaba: payload.efekLaba || 'TidakMengurangi', CabangID: payload.cabangId || cabangAktifId(DATA) };
    DATA.pengeluaran.unshift(row); await persist('pengeluaran', row);
    var saldo = saldoKasCabang(DATA, row.CabangID) - row.Nominal;
    var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Pengeluaran: ' + row.Kategori + ' — ' + row.Keterangan, Masuk: 0, Keluar: row.Nominal, Saldo: saldo, CabangID: row.CabangID };
    DATA.kas.push(kasRow); await persist('kas', kasRow);
    addLog(DATA, '', 'Pengeluaran', row.Kategori + ' — ' + row.Nominal);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }
  async function simpanUangKas(payload) {
    if (!DATA) await loadAll();
    var nominal = Number(payload.nominal || 0);
    var cbKas = payload.cabangId || cabangAktifId(DATA);
    var saldo = saldoKasCabang(DATA, cbKas) + (payload.jenis === 'Keluar' ? -nominal : nominal);
    var row = { ID: payload.id || payload.ID || uid('KAS'), Tanggal: nowISO(), Jenis: payload.jenis || 'Masuk', Keterangan: payload.keterangan || '', Masuk: payload.jenis === 'Keluar' ? 0 : nominal, Keluar: payload.jenis === 'Keluar' ? nominal : 0, Saldo: saldo, CabangID: cbKas };
    DATA.kas.push(row); await persist('kas', row);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }

  /* ---------- pembelian & utang ---------- */
  async function simpanPembelian(payload) {
    if (!DATA) await loadAll();
    // v4-32: id dari payload dipakai lagi saat replay (lihat saveTransaksi).
    var id = payload.id || payload.ID || uid('PBL');
    var total = Number(payload.total || 0);
    // v4-45: tolak Bayar > Total — dulu tersimpan dengan Sisa negatif dan
    // kas Keluar melebihi total pembelian.
    if (Number(payload.bayar || 0) > total) throw new Error('Bayar (Rp' + Number(payload.bayar || 0).toLocaleString('id-ID') + ') melebihi total pembelian (Rp' + total.toLocaleString('id-ID') + ').');
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
  // v4-45: peta item pembelian yang sudah terproses per pembelian
  // (lihat prosesPembelian — sengaja di luar baris supaya tidak ter-persist).
  var _prosesBeliSelesai = {};
  async function prosesPembelian(payload) {
    if (!DATA) await loadAll();
    var id = payload.id || payload.ID;
    var p = DATA.pembelian.find(function (x) { return x.ID === id; });
    if (!p) throw new Error('Pembelian tidak ditemukan.');
    if (p.Diproses === true || p.Diproses === 'YA') throw new Error('Pembelian sudah diproses.');
    var cabangId = p.CabangID || cabangAktifId(DATA);
    var items = DATA.pembelianDetail.filter(function (x) { return x.PembelianID === id; });
    if (!items.length) throw new Error('Pembelian ini tidak punya item — stok tidak bisa ditambah. Periksa detail pembelian.');
    // v4-45: proses item BERURUTAN (bukan Promise.all) + tiap item yang
    // berhasil ditandai di _prosesBeliSelesai — retry melewati item yang
    // sudah terproses sehingga stok tidak ganda. Bila gagal di tengah,
    // galat menyebut item mana yang sudah terproses dan mana yang belum.
    var selesai = _prosesBeliSelesai[id] || (_prosesBeliSelesai[id] = {});
    for (var ii = 0; ii < items.length; ii++) {
      var it = items[ii];
      if (selesai[it.ProdukID]) continue;
      // v4-45: simpan keadaan sebelum item ini diproses — bila gagal di
      // tengah, mutasi in-memory dikembalikan supaya retry tidak
      // menggandakan stok (setStok mengubah DATA SEBELUM persist).
      var prodAwal = null, stokAwal = 0, modalAwal = 0, jualAwal = 0, stokTersimpan = false;
      try {
        var prod = DATA.produk.find(function (x) { return x.ID === it.ProdukID; });
        if (!prod) { selesai[it.ProdukID] = true; continue; }
        prodAwal = prod;
        stokAwal = stokOfCabang(DATA, prod, cabangId);
        modalAwal = prod.HargaModal; jualAwal = prod.HargaJual;
        // v4-40: stok bertambah di CABANG pembelian (stok_cabang), bukan di
        // prod.Stok; updateProdukStokHarga kini hanya menulis harga.
        var scBeli = setStok(DATA, prod, stokAwal + Number(it.Qty || 0), cabangId);
        if (Number(it.HargaBeli || 0) > 0) prod.HargaModal = Number(it.HargaBeli);
        if (Number(it.HargaJual || 0) > 0) prod.HargaJual = Number(it.HargaJual);
        await updateProdukStokHarga(prod);
        await persist('stok_cabang', scBeli);
        stokTersimpan = true;
        if (it.Kedaluwarsa) {
          var batch = { ID: uid('BTH'), ProdukID: it.ProdukID, CabangID: cabangId, Qty: Number(it.Qty || 0), Kedaluwarsa: it.Kedaluwarsa, PembelianID: id, TanggalMasuk: todayStr() };
          DATA.stokBatch.push(batch); await persist('stok_batch', batch);
        }
        selesai[it.ProdukID] = true;
      } catch (e) {
        // Rollback hanya bila stok BELUM tersimpan di server — bila stok
        // sudah tersimpan tapi batch gagal, stok in-memory dibiarkan
        // (sudah sama dengan server) supaya retry tidak mengurangi.
        if (prodAwal && !stokTersimpan) {
          setStok(DATA, prodAwal, stokAwal, cabangId);
          prodAwal.HargaModal = modalAwal; prodAwal.HargaJual = jualAwal;
        }
        var sudahN = Object.keys(selesai).length;
        throw new Error('Pembelian gagal di item "' + (it.NamaProduk || it.ProdukID) + '": ' + (e.message || e) + ' (' + sudahN + ' dari ' + items.length + ' item sudah terproses — tekan PROSES lagi untuk melanjutkan sisanya.)');
      }
    }
    delete _prosesBeliSelesai[id];
    p.Diproses = true; p.Status = 'Diproses';
    await persist('pembelian', p);
    // pengeluaran + kas keluar sebesar Bayar
    var saldo = saldoKasCabang(DATA, cabangId);
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
      var pm = cariPemasokCabang(DATA, p.Pemasok, cabangId);
      if (pm) { pm.Hutang = Number(pm.Hutang || 0) + Number(p.Sisa); await persistCabangToleran('pemasok', pm); }
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
    // v4-40: cicilan dibayar dari kas CABANG utang itu (diturunkan dari
    // pembelian), bukan cabang aktif.
    var cabUtang = cabangUtang(DATA, u);
    var saldo = saldoKasCabang(DATA, cabUtang) - nominal;
    var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Cicil utang ' + u.ID + ' — ' + u.Pemasok, Masuk: 0, Keluar: nominal, Saldo: saldo, CabangID: cabUtang };
    DATA.kas.push(kasRow); await persist('kas', kasRow);
    var pm = cariPemasokCabang(DATA, u.Pemasok, cabUtang);
    if (pm) { pm.Hutang = Math.max(0, Number(pm.Hutang || 0) - nominal); await persistCabangToleran('pemasok', pm); }
    refreshRingkasan(); return { ok: true };
  }

  /* ---------- retur / pembayaran transaksi ---------- */
  async function simpanRetur(payload) {
    if (!DATA) await loadAll();
    var trx = DATA.transaksi.find(function (x) { return x.ID === payload.transaksiId; });
    if (!trx) throw new Error('Transaksi tidak ditemukan.');
    var qty = Number(payload.qty || 1);
    var nominal = Number(payload.nominal || 0);
    var row = { ID: payload.id || payload.ID || uid('RTR'), Tanggal: nowISO(), TransaksiID: trx.ID, Produk: payload.produk || '', Qty: qty, Nominal: nominal, Alasan: payload.alasan || '', CabangID: trx.CabangID || cabangAktifId(DATA) };
    DATA.retur.unshift(row); await persist('retur', row);
    var prod = DATA.produk.find(function (x) { return x.ID === payload.produkId || x.Nama === payload.produk; });
    // stokQty (opsional): jumlah yang kembali ke stok bisa berbeda dari qty
    // retur bila item dijual per varian (mis. 1 lsn = 12 pcs) — pakai pengali
    // varian seperti batalkanTransaksi, dan kembalikan ke cabang trx itu.
    var qtyStok = Number(payload.stokQty != null ? payload.stokQty : qty);
    if (prod) {
      var cabRetur = trx.CabangID || cabangAktifId(DATA);
      var scRetur = setStok(DATA, prod, stokOfCabang(DATA, prod, cabRetur) + qtyStok, cabRetur);
      await persist('produk', prod);
      await persist('stok_cabang', scRetur);
    }
    var sisaLama = Number(trx.Sisa || 0);
    // v4-33: uang hanya kembali sebesar yang SUDAH dibayar. Retur item yang
    // belum dibayar (hanya menambah Sisa/piutang) tidak boleh memotong kas —
    // dulu selalu menulis kas Keluar sebesar nominal, sehingga kas jadi
    // kurang saat transaksi itu akhirnya dibatalkan.
    var returKasLama = (DATA.kas || []).filter(function (k) {
      return k.Jenis === 'Keluar' && String(k.Keterangan || '').indexOf('Retur ' + trx.ID + ' —') === 0;
    }).reduce(function (a, k) { return a + Number(k.Keluar || 0); }, 0);
    var kasKeluar = Math.max(0, Math.min(nominal, Number(trx.Bayar || 0) - returKasLama));
    trx.Total = Math.max(0, Number(trx.Total || 0) - nominal);
    trx.Sisa = Math.max(0, sisaLama - nominal);
    // v4-45: retur penuh pada transaksi yang belum dibayar (Bayar 0,
    // Total jadi 0) juga berarti Lunas — dulu status tertinggal
    // 'Belum Dibayar' Rp0 padahal tidak ada yang perlu dibayar.
    if (trx.Sisa === 0 && (Number(trx.Bayar || 0) > 0 || Number(trx.Total || 0) === 0)) trx.StatusBayar = 'Lunas';
    // v4-33: laba berkurang sebesar laba item yang diretur (simetris dengan
    // tambahItemTrx yang menambah Laba). Laba per unit diambil dari baris
    // detail; bila detail tidak ditemukan, pakai nominal − modal×qty.
    var labaRetur = 0;
    var detRetur = (DATA.detail || []).find(function (x) { return String(x.TransaksiID) === String(trx.ID) && (String(x.ProdukID) === String(prod ? prod.ID : '') || String(x.NamaProduk) === String(row.Produk)); });
    if (detRetur && Number(detRetur.Qty || 0) > 0) {
      var labaPerUnit = Number(detRetur.Laba || 0) / Number(detRetur.Qty || 0);
      labaRetur = labaPerUnit * qty;
      if (labaPerUnit >= 0) labaRetur = Math.min(labaRetur, Number(detRetur.Laba || 0));
    }
    else if (prod) labaRetur = Math.max(0, nominal - Number(prod.HargaModal || 0) * qty);
    trx.Laba = Math.max(0, Number(trx.Laba || 0) - labaRetur);
    await persist('transaksi', trx);
    // Pelanggan: retur mengurangi TotalBeli sebesar nominal, dan piutang
    // sebesar berkurangnya sisa (simetris dengan tambahItemTrx yang
    // menambah keduanya). Tanpa ini piutang nyangkut seperti Rp2.000 di #7.
    var pl = cariPelangganCabang(DATA, trx.Pelanggan, trx.CabangID || cabangAktifId(DATA));
    if (pl) {
      pl.TotalBeli = Math.max(0, Number(pl.TotalBeli || 0) - nominal);
      pl.Piutang = Math.max(0, Number(pl.Piutang || 0) - (sisaLama - trx.Sisa));
      await persistCabangToleran('pelanggan', pl);
    }
    // v4-33: kas Keluar hanya sebesar kasKeluar (porsi yang sudah dibayar) —
    // sisanya hanya mengurangi Sisa/piutang, tanpa menyentuh kas.
    if (kasKeluar > 0) {
      var saldo = saldoKasCabang(DATA, row.CabangID) - kasKeluar;
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Retur ' + trx.ID + ' — ' + row.Produk, Masuk: 0, Keluar: kasKeluar, Saldo: saldo, CabangID: row.CabangID };
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
    var saldo = saldoKasCabang(DATA, trx.CabangID || cabangAktifId(DATA)) + nominal;
    var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Masuk', Keterangan: 'Pelunasan ' + trx.ID, Masuk: nominal, Keluar: 0, Saldo: saldo, CabangID: trx.CabangID || cabangAktifId(DATA) };
    DATA.kas.push(kasRow); await persist('kas', kasRow);
    var pl = cariPelangganCabang(DATA, trx.Pelanggan, trx.CabangID || cabangAktifId(DATA));
    if (pl) { pl.Piutang = Math.max(0, Number(pl.Piutang || 0) - nominal); await persistCabangToleran('pelanggan', pl); }
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
    // v4-32: seperti saveTransaksi — tambah item offline/replay tidak
    // boleh ditolak karena stok (kasir tidak boleh macet).
    if (!offlineMode && !_replay && lacakStok(prod) && stokOfCabang(DATA, prod, cabangId) < butuh) throw new Error('Stok produk tidak mencukupi: ' + prod.Nama);
    (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
      var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
      if (!offlineMode && !_replay && b && Number(b.Stok || 0) < Number(r.QtyPakai || 0) * butuh) throw new Error('Stok bahan tidak mencukupi: ' + b.Nama);
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
      if (MODE === 'supabase' && client && !offlineMode) {
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
      var sc = setStok(DATA, prod, stokOfCabang(DATA, prod, cabangId) - butuh, cabangId);
      await persist('produk', prod);
      await persist('stok_cabang', sc);
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
    var pl = cariPelangganCabang(DATA, trx.Pelanggan, trx.CabangID || cabangAktifId(DATA));
    if (pl) {
      pl.TotalBeli = Number(pl.TotalBeli || 0) + subtotal;
      pl.Piutang = Number(pl.Piutang || 0) + subtotal;
      await persistCabangToleran('pelanggan', pl);
    }
    addLog(DATA, trx.Kasir, 'Tambah Item', trx.ID + ' — ' + prod.Nama + ' x' + qty);
    refreshRingkasan();
    return { ok: true, total: trx.Total, sisa: trx.Sisa, statusBayar: trx.StatusBayar };
  }
  async function lunasiSemua(payload) {
    if (!DATA) await loadAll();
    var nama = payload.pelanggan || payload.nama;
    var cabLunas = payload.cabangId || cabangAktifId(DATA);
    var list = DATA.transaksi.filter(function (t) { return t.Pelanggan === nama && t.StatusBayar !== 'Lunas' && milikCabang(DATA, t, cabLunas); });
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
    // v4-33: retur yang sudah dilakukan mengurangi stok yang dikembalikan
    // (dulu SEMUA baris detail dikembalikan — item yang sudah diretur
    // kembali 2x ke stok) dan mengurangi uang yang dikembalikan (uang
    // retur item yang sudah dibayar tidak boleh dikembalikan 2x).
    var returTrx = (DATA.retur || []).filter(function (r) { return String(r.TransaksiID) === String(trx.ID); });
    var returKas = (DATA.kas || []).filter(function (k) {
      return k.Jenis === 'Keluar' && String(k.Keterangan || '').indexOf('Retur ' + trx.ID + ' —') === 0;
    }).reduce(function (a, k) { return a + Number(k.Keluar || 0); }, 0);
    // Kembalikan stok (pakai pengali varian: 1 lsn = isi pcs) + bahan baku.
    // Stok dikembalikan ke cabang transaksi itu, bukan cabang aktif.
    var bahanKembali = {};
    for (var di = 0; di < dets.length; di++) {
      var d = dets[di];
      var prod = DATA.produk.find(function (x) { return x.ID === d.ProdukID; });
      if (!prod) continue;
      var isi = 1;
      if (d.SatuanDipakai) { var vr = parseJSON(prod.VarianJSON || '[]', []); var v = vr.find(function (x) { return x.label === d.SatuanDipakai; }); if (v) isi = Number(v.isi || 1); }
      // Qty yang sudah diretur untuk produk ini (baris retur cocok lewat
      // nama produk di detail; stokQty retur sudah dalam satuan pcs).
      var qtyRetur = 0;
      returTrx.forEach(function (r) { if (String(r.Produk || '') === String(d.NamaProduk) || String(r.Produk || '') === String(prod.Nama)) qtyRetur += Number(r.Qty || 0); });
      var kembali = Math.max(0, Number(d.Qty || 0) - qtyRetur) * isi;
      if (lacakStok(prod)) {
        // v4-40: stok kembali ke cabang transaksi itu lewat setStok
        // (membuat baris stok_cabang bila belum ada); prod.Stok tak ditulis.
        var cabBatal = trx.CabangID || cabangAktifId(DATA);
        var scBaru = setStok(DATA, prod, stokOfCabang(DATA, prod, cabBatal) + kembali, cabBatal);
        await persist('stok_cabang', scBaru);
        await persist('produk', prod);
      }
      (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(prod.ID); }).forEach(function (r) {
        var b = DATA.bahan.find(function (x) { return x.ID === r.BahanID; });
        if (b) { b.Stok = Number(b.Stok || 0) + Number(r.QtyPakai || 0) * kembali; bahanKembali[b.ID] = b; }
      });
    }
    var daftarBahan = Object.keys(bahanKembali);
    for (var bi = 0; bi < daftarBahan.length; bi++) await persist('bahan_baku', bahanKembali[daftarBahan[bi]]);
    var pl = cariPelangganCabang(DATA, trx.Pelanggan, trx.CabangID || cabangAktifId(DATA));
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
      await persistCabangToleran('pelanggan', pl);
    }
    // v4-33: kembalikan yang dibayar, dikurangi uang yang SUDAH kembali
    // lewat retur — bila tidak, pelanggan menerima uang retur 2x.
    var kembaliKas = Math.max(0, Number(trx.Bayar || 0) - returKas);
    if (kembaliKas > 0) {
      var saldo = saldoKasCabang(DATA, trx.CabangID || cabangAktifId(DATA)) - kembaliKas;
      var kasRow = { ID: uid('KAS'), Tanggal: nowISO(), Jenis: 'Keluar', Keterangan: 'Batal transaksi ' + trx.ID + ' (uang kembali)', Masuk: 0, Keluar: kembaliKas, Saldo: saldo, CabangID: trx.CabangID || cabangAktifId(DATA) };
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
    var row = { ID: payload.id || payload.ID || uid('CEP'), Nama: payload.nama, Pelanggan: payload.pelanggan || 'Umum', ItemsJSON: JSON.stringify(payload.items || []), CabangID: payload.cabangId || cabangAktifId(DATA) };
    DATA.transaksiCepat.unshift(row); await persist('transaksi_cepat', row);
    return { ok: true, id: row.ID };
  }
  async function hapusCepat(payload) { if (!DATA) await loadAll(); hapusDari('transaksiCepat', 'transaksi_cepat', payload.id); return { ok: true }; }
  async function parkirTransaksi(payload) { return simpanTertunda(payload); }
  async function simpanTertunda(payload) {
    if (!DATA) await loadAll();
    var row = { ID: payload.id || payload.ID || uid('TTD'), Tanggal: nowISO(), Pelanggan: payload.pelanggan || 'Umum', Kasir: payload.kasir || '', ItemsJSON: JSON.stringify(payload.items || []), Total: Number(payload.total || 0), CabangID: payload.cabangId || cabangAktifId(DATA), Meja: payload.meja || '', Catatan: payload.catatan || '' };
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
    var row = { ID: payload.ID || '', Nama: payload.Nama, Jenis: payload.Jenis || 'DiskonPersen', SyaratJSON: payload.SyaratJSON || '', Nilai: Number(payload.Nilai || 0), Mulai: payload.Mulai || null, Selesai: payload.Selesai || null, JamMulai: payload.JamMulai || null, JamSelesai: payload.JamSelesai || null, Hari: payload.Hari || '', Aktif: boolFlag(payload.Aktif, true), CabangID: payload.CabangID || '' };
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
    var cabOpname = payload.cabangId || cabangAktifId(DATA);
    var sistem = stokOfCabang(DATA, prod, cabOpname);
    var fisik = Number(payload.stokFisik || 0);
    var row = { ID: payload.id || payload.ID || uid('OPN'), Tanggal: nowISO(), ProdukID: prod.ID, NamaProduk: prod.Nama, StokSistem: sistem, StokFisik: fisik, Selisih: fisik - sistem, Keterangan: payload.keterangan || '', CabangID: cabOpname, Pengguna: '' };
    DATA.opname.unshift(row); await persist('opname', row);
    var sc = setStok(DATA, prod, fisik, row.CabangID);
    await persist('produk', prod);
    await persist('stok_cabang', sc);
    addLog(DATA, '', 'Opname', prod.Nama + ' — sistem ' + sistem + ' → fisik ' + fisik);
    refreshRingkasan(); return { ok: true, id: row.ID };
  }
  async function saranOrder(payload) {
    if (!DATA) await loadAll();
    // v4-40: hanya produk cabang itu; terjual dihitung dari detail
    // transaksi cabang itu saja.
    var cabSaran = (payload && payload.cabangId) || cabangAktifId(DATA);
    var idTrxSaran = {};
    (DATA.transaksi || []).forEach(function (t) { if (milikCabang(DATA, t, cabSaran)) idTrxSaran[t.ID] = true; });
    var list = (DATA.produk || []).filter(function (p) { return milikCabang(DATA, p, cabSaran); }).map(function (p) {
      var terjual = (DATA.detail || []).filter(function (d) { return d.ProdukID === p.ID && idTrxSaran[d.TransaksiID]; }).reduce(function (a, d) { return a + Number(d.Qty || 0); }, 0);
      var perHari = terjual / 28;
      var stok = stokOfCabang(DATA, p, cabSaran);
      var hariTersisa = perHari > 0 ? Math.floor(stok / perHari) : null;
      return { produkId: p.ID, nama: p.Nama, stok: stok, terjualPerHari: Math.round(perHari * 100) / 100, hariTersisa: hariTersisa, saranQty: perHari > 0 && (hariTersisa == null || hariTersisa < 7) ? Math.ceil(perHari * 14) : 0 };
    }).filter(function (s) { return s.saranQty > 0; });
    return { saran: list };
  }
  async function getLaporanStok(payload) {
    if (!DATA) await loadAll();
    // v4-40: hanya produk cabang itu (payload.cabangId || cabang aktif);
    // bahan tetap global (bahan_baku di luar lingkup v4-40).
    var cabLapStok = (payload && payload.cabangId) || cabangAktifId(DATA);
    var produk = (DATA.produk || []).filter(function (p) { return milikCabang(DATA, p, cabLapStok); }).map(function (p) { return { nama: p.Nama, stok: stokOfCabang(DATA, p, cabLapStok), modal: Number(p.HargaModal || 0), harga: Number(p.HargaJual || 0) }; });
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
    var target = payload.TargetHarian != null ? Number(payload.TargetHarian) : (exCbg && exCbg.TargetHarian != null ? Number(exCbg.TargetHarian) : 0);
    var row = { ID: payload.ID || '', Nama: payload.Nama, Alamat: payload.Alamat || '', Telepon: payload.Telepon || '', Aktif: exCbg ? exCbg.Aktif : true };
    // v4-40: TargetHarian TIDAK ikut ke upsertInto — kolom target_harian
    // belum ada di DB live, bila terkirim upsert gagal. Target disimpan
    // in-memory pada baris hasil + tulisTargetCabang (best-effort).
    // exCbg lama yang sudah membawa TargetHarian disingkirkan dulu dari
    // objeknya supaya persist() di upsertInto tidak ikut mengirimnya.
    if (exCbg) delete exCbg.TargetHarian;
    var hasil = await upsertInto('cabang', 'cabang', row, 'CBG');
    hasil.TargetHarian = target;
    await tulisTargetCabang(hasil.ID, target);
    return hasil;
  }
  // v4-40: tulis target_harian cabang ke DB bila kolomnya sudah ada
  // (migrasi v4-40); bila kolom belum ada, galat ditelan diam-diam.
  // Baris in-memory selalu diperbarui + ringkasan dihitung ulang.
  async function tulisTargetCabang(cabangId, nilai) {
    if (DATA) {
      var c = (DATA.cabang || []).find(function (x) { return String(x.ID) === String(cabangId); });
      if (c) c.TargetHarian = Number(nilai || 0);
    }
    if (MODE !== 'supabase' || !client || offlineMode) { if (DATA) refreshRingkasan(); return; }
    try {
      var res = await client.from('cabang').update({ target_harian: Number(nilai || 0) }).eq('id', cabangId);
      if (res && res.error) { /* kolom belum ada — telan */ }
    } catch (e) { /* telan */ }
    if (DATA) refreshRingkasan();
  }
  /* ---------- v4-40: salin produk antar cabang & Umum per cabang ----------
     v4-41: salinProdukAntarCabang menerima ids (array ID produk,
     opsional) — bila diberikan, HANYA produk itu yang disalin; bila
     tidak diberikan, perilaku lama (salin semua produk aktif sumber). */
  function normalNama(s) { return String(s || '').trim().toLowerCase(); }
  async function salinProdukAntarCabang(payload) {
    if (!DATA) await loadAll();
    var dari = payload.dariCabangId, ke = payload.keCabangId;
    if (!dari || !ke) throw new Error('Cabang sumber dan tujuan wajib diisi.');
    if (String(dari) === String(ke)) return { ok: true, disalin: 0, dilewati: 0, dilewatiNama: [] };
    var filterIds = Array.isArray(payload.ids) ? payload.ids : null;
    var sumber = (DATA.produk || []).filter(function (p) {
      if (!produkAktif(p) || !milikCabang(DATA, p, dari)) return false;
      if (filterIds) return filterIds.some(function (id) { return String(id) === String(p.ID); });
      return true;
    });
    var adaNama = {};
    (DATA.produk || []).forEach(function (p) { if (milikCabang(DATA, p, ke)) adaNama[normalNama(p.Nama)] = true; });
    var disalin = 0, dilewatiNama = [];
    for (var i = 0; i < sumber.length; i++) {
      var p = sumber[i];
      if (adaNama[normalNama(p.Nama)]) { dilewatiNama.push(p.Nama); continue; }
      var row = {
        ID: uid('PRD'), Nama: p.Nama, Kategori: p.Kategori || '', Grup: p.Grup || '',
        SKUBarcode: p.SKUBarcode || p.SKU || '', HargaJual: Number(p.HargaJual || 0), HargaModal: Number(p.HargaModal || 0),
        Stok: 0, Satuan: p.Satuan || 'pcs', Aktif: true, StokMinimum: Number(p.StokMinimum == null ? 5 : p.StokMinimum),
        GambarURL: p.GambarURL || '', Keterangan: p.Keterangan || '',
        HargaBisaDiganti: p.HargaBisaDiganti, TermasukStok: p.TermasukStok,
        HargaLainJSON: p.HargaLainJSON || '', HargaJumlahJSON: p.HargaJumlahJSON || '',
        VarianJSON: p.VarianJSON || '', TampilkanDiKatalog: p.TampilkanDiKatalog,
        CabangID: ke
      };
      DATA.produk.unshift(row);
      await persist('produk', row);
      adaNama[normalNama(p.Nama)] = true;
      disalin++;
    }
    refreshRingkasan();
    return { ok: true, disalin: disalin, dilewati: dilewatiNama.length, dilewatiNama: dilewatiNama };
  }
  async function pastikanUmumCabang(cabangId) {
    if (!DATA) await loadAll();
    var cb = cabangId || cabangAktifId(DATA);
    var ex = cariPelangganCabang(DATA, 'Umum', cb);
    if (ex) return ex;
    return upsertPelanggan({ Nama: 'Umum', CabangID: cb });
  }
  // v4-42: hapus cabang AMAN — menolak bila cabang masih punya riwayat
  // (transaksi/pembelian dengan CabangID persis cabang itu, ATAU kas
  // dengan NET ≠ 0). Kas adalah buku besar permanen: penjualan yang
  // dibatalkan meninggalkan 2 baris kas (+Masuk dan −Keluar, net 0),
  // dan baris kas tidak pernah dihapus dari UI — jadi menghitung
  // JUMLAH baris kas (aturan v4-41) membuat cabang yang pernah
  // berjualan lalu membatalkan semua transaksinya tidak bisa dihapus
  // selamanya (kasus "TES Cabang 2", uji live v4-41). Yang dihitung
  // kini net kas = Σ Masuk − Σ Keluar dari baris kas cabang itu;
  // net 0 berarti kas sudah lunas dan cabang boleh dihapus — baris
  // kasnya ikut terhapus eksplisit bersama produk/pelanggan/pemasok.
  // Baris legacy tanpa CabangID TIDAK dihitung dan TIDAK dihapus.
  // Bila tanpa riwayat: hapus dulu semua produk cabang itu
  // (eksplisit — produk.cabang_id memakai ON DELETE SET NULL, jadi
  // tanpa hapus eksplisit produk jadi yatim), lalu pelanggan &
  // pemasok cabang itu yang tanpa riwayat, lalu cabangnya.
  // stok_cabang ikut terhapus oleh DB (ON DELETE CASCADE) dan
  // dibersihkan juga dari DATA in-memory.
  async function hapusCabang(payload) {
    if (!DATA) await loadAll();
    var id = (payload && (payload.id || payload.ID)) || '';
    var cb = (DATA.cabang || []).find(function (c) { return String(c.ID) === String(id); });
    if (!cb) throw new Error('Cabang tidak ditemukan.');
    var jmlTrx = (DATA.transaksi || []).filter(function (t) { return String(t.CabangID || '') === String(id); }).length;
    var jmlBeli = (DATA.pembelian || []).filter(function (p) { return String(p.CabangID || '') === String(id); }).length;
    var kasCabang = (DATA.kas || []).filter(function (k) { return String(k.CabangID || '') === String(id); });
    var jmlKas = kasCabang.length;
    // v4-42: net kas — baris in-memory selalu PascalCase (toPascal di
    // loadAll; kode tulis memakai Masuk/Keluar), seperti saldoKasCabang.
    var kasNet = kasCabang.reduce(function (a, k) { return a + Number(k.Masuk || 0) - Number(k.Keluar || 0); }, 0);
    if (jmlTrx > 0 || jmlBeli > 0 || kasNet !== 0) {
      return { ok: false, alasan: 'Cabang "' + (cb.Nama || id) + '" masih punya riwayat dan tidak bisa dihapus.', jumlah: { transaksi: jmlTrx, pembelian: jmlBeli, kas: jmlKas, kasNet: kasNet } };
    }
    // Tanpa riwayat: pelanggan/pemasok cabang ini otomatis tanpa
    // riwayat juga (riwayat pelanggan = transaksi, riwayat pemasok =
    // pembelian — keduanya sudah 0 di cabang ini). Yang dihapus hanya
    // baris dengan CabangID persis cabang ini; baris legacy tanpa
    // CabangID bukan milik cabang ini (milik cabang pertama).
    // v4-45: hapus berurutan dengan guard — bila satu langkah gagal,
    // JANGAN lanjutkan; pulihkan DATA dari server (hapusDari sudah memotong
    // DATA in-memory sebelum removeRow) lalu lempar galat jelas.
    // v4-45: transaksi tertunda + riwayat poin cabang ini ikut terhapus
    // (tertunda difilter CabangID; riwayat poin mengikuti pelanggan cabang
    // ini karena barisnya hanya membawa PelangganID).
    var produkHapus = (DATA.produk || []).filter(function (p) { return String(p.CabangID || '') === String(id); });
    var pelangganHapus = (DATA.pelanggan || []).filter(function (x) { return String(x.CabangID || '') === String(id); });
    var pemasokHapus = (DATA.pemasok || []).filter(function (x) { return String(x.CabangID || '') === String(id); });
    var tertundaHapus = (DATA.transaksiTertunda || []).filter(function (x) { return String(x.CabangID || '') === String(id); });
    var idPelangganHapus = {};
    pelangganHapus.forEach(function (x) { idPelangganHapus[String(x.ID)] = true; });
    var poinHapus = (DATA.riwayatPoin || []).filter(function (r) { return !!idPelangganHapus[String(r.PelangganID)]; });
    var kasHapus = kasCabang.length;
    try {
      for (var i = 0; i < produkHapus.length; i++) {
        await hapusDari('produk', 'produk', produkHapus[i].ID);
        // Baris stok_cabang produk ini ikut terhapus di DB (CASCADE);
        // bersihkan juga dari DATA in-memory + hapus eksplisit di DB
        // supaya tidak ada sisa bila CASCADE belum terpasang.
        DATA.stokCabang = (DATA.stokCabang || []).filter(function (s) { return String(s.ProdukID) !== String(produkHapus[i].ID); });
        await hapusBarisWhere('stok_cabang', 'produk_id', produkHapus[i].ID);
      }
      for (var j = 0; j < pelangganHapus.length; j++) await hapusDari('pelanggan', 'pelanggan', pelangganHapus[j].ID);
      for (var k = 0; k < pemasokHapus.length; k++) await hapusDari('pemasok', 'pemasok', pemasokHapus[k].ID);
      // v4-42: kas net 0 — hapus juga baris kas cabang ini (eksplisit
      // dari DB + DATA in-memory, seperti produk; baris legacy tanpa
      // CabangID bukan milik cabang ini dan tetap ada).
      DATA.kas = (DATA.kas || []).filter(function (x) { return String(x.CabangID || '') !== String(id); });
      await hapusBarisWhere('kas', 'cabang_id', id);
      DATA.transaksiTertunda = (DATA.transaksiTertunda || []).filter(function (x) { return String(x.CabangID || '') !== String(id); });
      DATA.riwayatPoin = (DATA.riwayatPoin || []).filter(function (r) { return !idPelangganHapus[String(r.PelangganID)]; });
      await hapusBarisWhere('transaksi_tertunda', 'cabang_id', id);
      for (var m = 0; m < pelangganHapus.length; m++) await hapusBarisWhere('riwayat_poin', 'pelanggan_id', pelangganHapus[m].ID);
      await hapusDari('cabang', 'cabang', id);
    } catch (e) {
      try { await loadAll(); } catch (e2) {}
      throw new Error('Hapus cabang tidak selesai: ' + (e.message || e) + ' — tidak ada yang terhapus, silakan coba lagi.');
    }
    return { ok: true, dihapus: { produk: produkHapus.length, pelanggan: pelangganHapus.length, pemasok: pemasokHapus.length, kas: kasHapus, tertunda: tertundaHapus.length, riwayatPoin: poinHapus.length } };
  }
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
    await persistCabangToleran('pelanggan', pl);
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
    // v4-45: Desimal WAJIB boolean — dulu string 'YA'/'TIDAK' dikirim ke
    // kolom boolean dan PostgREST menolaknya (simpan satuan gagal diam-diam).
    return upsertInto('satuan', 'satuan', { ID: payload.id || payload.ID || '', Nama: payload.nama, Singkatan: payload.singkatan || '', Desimal: boolFlag(payload.desimal, false) }, 'STN');
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
    // v4-40: hanya pelanggan + transaksi cabang efektif.
    var cabIngat = cabangAktifId(DATA);
    (DATA.pelanggan || []).forEach(function (pl) {
      if (Number(pl.Piutang || 0) <= 0) return;
      if (!milikCabang(DATA, pl, cabIngat)) return;
      var list = (DATA.transaksi || []).filter(function (t) { return t.Pelanggan === pl.Nama && t.StatusBayar !== 'Lunas' && milikCabang(DATA, t, cabIngat); });
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
    // v4-40: hanya transaksi cabang efektif.
    var list = (DATA.transaksi || []).filter(function (t) { return t.Pelanggan === nama && t.StatusBayar !== 'Lunas' && milikCabang(DATA, t, cabangAktifId(DATA)); });
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
      // v4-45: pengeluaran ikut filter cabang (dulu hanya tanggal).
      var pg = (DATA.pengeluaran || []).filter(function (x) { var tg = String(x.Tanggal || '').slice(0, 10); return (!dari || tg >= dari) && (!sampai || tg <= sampai) && (!cabangId || String(x.CabangID || '') === String(cabangId)); });
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
      // v4-40: hanya produk cabang laporan itu (cabangId || cabang aktif).
      var cabLapStok2 = cabangId || cabangAktifId(DATA);
      baris = (DATA.produk || []).filter(function (p) { return milikCabang(DATA, p, cabLapStok2); }).map(function (p) { return { Produk: p.Nama, Stok: stokOfCabang(DATA, p, cabLapStok2), HargaJual: p.HargaJual, HargaModal: p.HargaModal }; });
    } else if (jenis === 'labarugi') {
      var omzet = lunas.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
      var labaKotor = lunas.reduce(function (a, t) { return a + Number(t.Laba || 0); }, 0);
      // v4-45: bagian pengeluaran labarugi ikut filter cabang.
      var keluar = (DATA.pengeluaran || []).filter(function (x) { var tg = String(x.Tanggal || '').slice(0, 10); return (!dari || tg >= dari) && (!sampai || tg <= sampai) && (!cabangId || String(x.CabangID || '') === String(cabangId)) && x.EfekLaba === 'MengurangiLaba'; }).reduce(function (a, x) { return a + Number(x.Nominal || 0); }, 0);
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
    // v4-40: struk memakai alamat + telepon cabang transaksi (fallback ke
    // pengaturan global bila kosong). Cabang tidak punya kolom kota — kota
    // tetap dari pengaturan. Nama toko + slogan + footer tetap brand global.
    var cb = (DATA.cabang || []).find(function (c) { return String(c.ID) === String(trx.CabangID || ''); }) || (DATA.cabang || [])[0] || {};
    var alamatStruk = (cb.Alamat && String(cb.Alamat).trim()) ? cb.Alamat : p.AlamatToko;
    var telpStruk = (cb.Telepon && String(cb.Telepon).trim()) ? cb.Telepon : p.TeleponToko;
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
    if (alamatStruk) lines.push(tengah(alamatStruk));
    if (p.KotaToko) lines.push(tengah(p.KotaToko));
    if (telpStruk) lines.push(tengah(telpStruk));
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
    var row = { ID: (payload && (payload.id || payload.ID)) || uid('LB'), Tanggal: nowISO(), CabangID: (payload && payload.cabangId) || cabangAktifId(DATA), Isi: (payload && payload.teks) || '', Terkirim: 'YA', Cara: (payload && payload.cara) || 'WhatsApp' };
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

  /* ============================================================
     OFFLINE (v4-32) — IndexedDB + outbox + sinkronisasi
     - snapshot: salinan DATA terakhir yang berhasil dimuat online,
       ditulis setiap loadAll online berhasil dan setiap tulis berhasil.
     - outbox: antrean perubahan offline {id, dibuatPada, seq, jenis,
       args, ringkasan, galat}, diunggah FIFO saat online.
     - Replay memakai DATA SERVER SEGAR (bukan DATA offline) supaya
       nilai yang dihitung (stok, total, piutang) tidak ganda dengan
       perubahan yang sudah diterapkan offline. Bila replay gagal di
       tengah jalan, DATA dikembalikan ke keadaan offline.
     - Bila IndexedDB tidak tersedia, dipakai fallback memori (offline
       tetap jalan selama halaman tidak dimuat ulang).
     ============================================================ */
  var IDB_NAMA = 'zpos-offline', IDB_VERSI = 1;
  var _idbDb = null, _idbGagal = false;
  var _memSnapshot = null, _memOutbox = [];
  var _outboxSeq = 0;
  var onOutboxBerubah = null;
  function idbGlobal() {
    try { if (typeof indexedDB !== 'undefined' && indexedDB) return indexedDB; } catch (e) {}
    try { if (typeof global !== 'undefined' && global.indexedDB) return global.indexedDB; } catch (e) {}
    return null;
  }
  function idbMinta(req) {
    return new Promise(function (res, rej) {
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error || new Error('IndexedDB gagal')); };
    });
  }
  function idbBuka() {
    if (_idbGagal) return Promise.resolve(null);
    if (_idbDb) return Promise.resolve(_idbDb);
    var idb = idbGlobal();
    if (!idb) { _idbGagal = true; return Promise.resolve(null); }
    return new Promise(function (res) {
      var req;
      try { req = idb.open(IDB_NAMA, IDB_VERSI); } catch (e) { _idbGagal = true; return res(null); }
      req.onupgradeneeded = function () {
        var db = req.result;
        try {
          if (!db.objectStoreNames.contains('snapshot')) db.createObjectStore('snapshot', { keyPath: 'kunci' });
          if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
        } catch (e) {}
      };
      req.onsuccess = function () { _idbDb = req.result; res(_idbDb); };
      req.onerror = function () { _idbGagal = true; res(null); };
    });
  }
  async function idbTulis(store, nilai) {
    var db = await idbBuka();
    if (!db) {
      if (store === 'snapshot') { _memSnapshot = clone(nilai); return; }
      var i = _memOutbox.findIndex(function (x) { return x.id === nilai.id; });
      if (i >= 0) _memOutbox[i] = clone(nilai); else _memOutbox.push(clone(nilai));
      return;
    }
    var tx = db.transaction(store, 'readwrite');
    await idbMinta(tx.objectStore(store).put(nilai));
  }
  async function idbBaca(store, kunci) {
    var db = await idbBuka();
    if (!db) {
      if (store === 'snapshot') return _memSnapshot ? clone(_memSnapshot) : null;
      var f = _memOutbox.find(function (x) { return x.id === kunci; });
      return f ? clone(f) : null;
    }
    var tx = db.transaction(store, 'readonly');
    var hasil = await idbMinta(tx.objectStore(store).get(kunci));
    return hasil == null ? null : hasil;
  }
  async function idbBacaSemua(store) {
    var db = await idbBuka();
    if (!db) {
      if (store === 'snapshot') return _memSnapshot ? [clone(_memSnapshot)] : [];
      return _memOutbox.map(function (x) { return clone(x); });
    }
    var tx = db.transaction(store, 'readonly');
    var hasil = await idbMinta(tx.objectStore(store).getAll());
    return hasil || [];
  }
  async function idbHapus(store, kunci) {
    var db = await idbBuka();
    if (!db) {
      if (store === 'snapshot') { if (_memSnapshot && _memSnapshot.kunci === kunci) _memSnapshot = null; }
      else _memOutbox = _memOutbox.filter(function (x) { return x.id !== kunci; });
      return;
    }
    var tx = db.transaction(store, 'readwrite');
    await idbMinta(tx.objectStore(store).delete(kunci));
  }
  async function tulisSnapshot() {
    if (MODE !== 'supabase' || !DATA) return;
    var salinan = clone(DATA);
    delete salinan.ringkasan; // dihitung ulang saat dibaca
    await idbTulis('snapshot', { kunci: 'data', data: salinan, disimpanPada: nowISO() });
  }
  async function bacaSnapshot() {
    var rek = await idbBaca('snapshot', 'data');
    if (!rek || !rek.data) return null;
    return rek.data;
  }
  // Muat snapshot ke DATA + masuk MODE OFFLINE. Dipakai loadAll saat
  // offline dan app.js saat loadData gagal karena koneksi putus.
  async function muatDariSnapshot() {
    var snap = null;
    try { snap = await bacaSnapshot(); } catch (e) { snap = null; }
    if (!snap) return null;
    offlineMode = true;
    DATA = snap;
    DATA.ringkasan = computeRingkasan(DATA);
    return DATA;
  }
  async function tambahOutbox(jenis, args, ringkasan) {
    var entri = { id: uid('OUT'), dibuatPada: nowISO(), seq: Date.now() * 1000 + (_outboxSeq++ % 1000), jenis: jenis, args: clone(args || []), ringkasan: ringkasan || '', galat: '' };
    await idbTulis('outbox', entri);
    return entri;
  }
  async function bacaOutbox() {
    var semua = await idbBacaSemua('outbox');
    semua.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0) || (String(a.dibuatPada || '') < String(b.dibuatPada || '') ? -1 : 1); });
    return semua;
  }
  async function hapusOutbox(id) { await idbHapus('outbox', id); }
  async function tandaiGagalOutbox(id, galat) {
    var e = await idbBaca('outbox', id);
    if (!e) return;
    e.galat = galat;
    await idbTulis('outbox', e);
  }
  function rp0(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }
  // Ringkasan satu baris untuk daftar antrean (dihitung SEBELUM tulis,
  // karena hapus memakai nama yang sudah tidak ada sesudahnya).
  function ringkasTulis(nama, args) {
    var p = args[0] || {};
    var cariNama = function (arr, id) { var x = (DATA[arr] || []).find(function (r) { return String(r.ID) === String(id); }); return x ? (x.Nama || '') : ''; };
    switch (nama) {
      case 'saveTransaksi': {
        var tot = 0; (p.items || []).forEach(function (it) { tot += Number(it.Harga || 0) * Number(it.Qty || 0); });
        return 'Transaksi ' + rp0(tot) + ' — ' + (p.pelanggan || 'Umum') + ' (' + (p.items || []).length + ' item)';
      }
      case 'tambahItemTrx': return 'Tambah item ke ' + (p.id || '') + ' — ' + cariNama('produk', p.produkId) + ' x' + (p.qty || 1);
      case 'tambahPembayaran': return 'Bayar ' + rp0(p.nominal) + ' — ' + (p.id || '');
      case 'batalkanTransaksi': return 'Batalkan transaksi ' + (p.id || '');
      case 'simpanRetur': return 'Retur ' + (p.produk || '') + ' — ' + (p.transaksiId || '');
      case 'lunasiSemua': return 'Lunasi semua piutang ' + (p.pelanggan || p.nama || '');
      case 'upsertProduk': return 'Produk: ' + (p.Nama || '');
      case 'hapusProduk': return 'Hapus produk: ' + (typeof p === 'string' ? cariNama('produk', p) : (p.Nama || p.id || ''));
      case 'nonaktifkanProduk': return 'Nonaktifkan produk: ' + (typeof p === 'string' ? cariNama('produk', p) : (p.id || ''));
      case 'upsertPelanggan': return 'Pelanggan: ' + (p.Nama || '');
      case 'hapusPelanggan': return 'Hapus pelanggan: ' + (typeof p === 'string' ? cariNama('pelanggan', p) : (p.Nama || p.id || ''));
      case 'upsertPromo': return 'Promo: ' + (p.Nama || '');
      case 'hapusPromo': return 'Hapus promo: ' + (p.id || '');
      case 'simpanPengeluaran': return 'Pengeluaran ' + rp0(p.nominal) + ' — ' + (p.kategori || 'Lainnya');
      case 'simpanUangKas': return 'Kas ' + (p.jenis || '') + ' ' + rp0(p.nominal);
      case 'simpanPembelian': return 'Pembelian ' + rp0(p.total) + ' — ' + (p.pemasok || '');
      case 'prosesPembelian': return 'Proses pembelian ' + (p.id || p.ID || '');
      case 'cicilUtang': return 'Cicil utang ' + rp0(p.nominal);
      case 'simpanOpname': return 'Opname: ' + cariNama('produk', p.produkId);
      case 'simpanCepat': return 'Transaksi cepat: ' + (p.nama || '');
      case 'hapusCepat': return 'Hapus transaksi cepat';
      case 'simpanTertunda': return 'Parkir transaksi ' + rp0(p.total) + ' — ' + (p.pelanggan || 'Umum');
      case 'hapusTertunda': return 'Hapus transaksi tertunda';
      case 'upsertPengguna': return 'Pengguna: ' + (p.Nama || '');
      case 'hapusPengguna': return 'Hapus pengguna: ' + (p.id || '');
      case 'upsertCabang': return 'Cabang: ' + (p.Nama || '');
      case 'hapusCabang': return 'Hapus cabang: ' + (p.id || '');
      case 'setCabangAktif': return 'Ganti cabang aktif';
      case 'ubahStatusPesanan': return 'Ubah status pesanan ' + (p.id || '');
      case 'ubahTransaksi': return 'Ubah transaksi ' + (p.id || '');
      case 'koreksiPoin': return 'Koreksi poin ' + (p.pelangganId || '');
      case 'simpanTeks': return 'Teks: ' + (p.nama || '');
      case 'hapusTeks': return 'Hapus teks: ' + (p.id || '');
      case 'upsertGrup': return 'Grup: ' + (p.nama || '');
      case 'hapusGrup': return 'Hapus grup: ' + (p.id || '');
      case 'upsertSatuan': return 'Satuan: ' + (p.nama || '');
      case 'hapusSatuan': return 'Hapus satuan: ' + (p.id || '');
      case 'upsertJenisBayar': return 'Jenis bayar: ' + (p.nama || '');
      case 'hapusJenisBayar': return 'Hapus jenis bayar: ' + (p.id || '');
      case 'upsertItemPengeluaran': return 'Item pengeluaran: ' + (p.nama || '');
      case 'hapusItemPengeluaran': return 'Hapus item pengeluaran: ' + (p.id || '');
      case 'upsertPegawai': return 'Pegawai: ' + (p.nama || '');
      case 'hapusPegawai': return 'Hapus pegawai: ' + (p.id || '');
      case 'upsertKatalog': return 'Katalog: ' + (p.Nama || '');
      case 'upsertPemasok': return 'Pemasok: ' + (p.Nama || '');
      case 'hapusPemasok': return 'Hapus pemasok: ' + (typeof p === 'string' ? cariNama('pemasok', p) : (p.Nama || p.id || ''));
      case 'simpanResep': return 'Resep produk';
      case 'upsertBahan': return 'Bahan: ' + (p.Nama || '');
      case 'hapusBahan': return 'Hapus bahan: ' + (p.id || '');
      case 'catatLaporBos': return 'Lapor Bos';
      case 'simpanTerjemahan': return 'Terjemahan';
      case 'upsertTier': return 'Tier: ' + (p.tier || p.Tier || '');
      case 'upsertMeja': return 'Meja: ' + (p.Nama || '');
      case 'hapusMeja': return 'Hapus meja: ' + (p.id || '');
      case 'updateStatusDapur': return 'Dapur: ' + (p.id || '') + ' → ' + (p.status || '');
      default: return nama;
    }
  }
  // Semua metode tulis (dipakai replay + pembungkus ekspor). Metode baca
  // tidak ada di sini — tidak pernah diantrekan.
  var METODE_TULIS = {
    saveTransaksi: saveTransaksi, tambahItemTrx: tambahItemTrx, tambahPembayaran: tambahPembayaran,
    batalkanTransaksi: batalkanTransaksi, simpanRetur: simpanRetur, lunasiSemua: lunasiSemua,
    upsertProduk: upsertProduk, hapusProduk: hapusProduk, nonaktifkanProduk: nonaktifkanProduk,
    upsertPelanggan: upsertPelanggan, hapusPelanggan: hapusPelanggan,
    upsertPromo: upsertPromo, hapusPromo: hapusPromo, upsertTier: upsertTier,
    upsertMeja: upsertMeja, hapusMeja: hapusMeja, updateStatusDapur: updateStatusDapur,
    simpanPengeluaran: simpanPengeluaran, simpanUangKas: simpanUangKas,
    simpanPembelian: simpanPembelian, prosesPembelian: prosesPembelian, cicilUtang: cicilUtang,
    simpanCepat: simpanCepat, hapusCepat: hapusCepat, parkirTransaksi: parkirTransaksi,
    simpanTertunda: simpanTertunda, hapusTertunda: hapusTertunda,
    simpanOpname: simpanOpname, simpanPengaturan: simpanPengaturan,
    upsertPengguna: upsertPengguna, hapusPengguna: hapusPengguna,
    upsertCabang: upsertCabang, hapusCabang: hapusCabang, setCabangAktif: setCabangAktif,
    salinProdukAntarCabang: salinProdukAntarCabang, pastikanUmumCabang: pastikanUmumCabang,
    tulisTargetCabang: tulisTargetCabang,
    ubahStatusPesanan: ubahStatusPesanan, ubahTransaksi: ubahTransaksi,
    koreksiPoin: koreksiPoin, simpanTeks: simpanTeks, hapusTeks: hapusTeks,
    upsertGrup: upsertGrup, hapusGrup: hapusGrup, upsertSatuan: upsertSatuan, hapusSatuan: hapusSatuan,
    upsertJenisBayar: upsertJenisBayar, hapusJenisBayar: hapusJenisBayar,
    upsertItemPengeluaran: upsertItemPengeluaran, hapusItemPengeluaran: hapusItemPengeluaran,
    upsertPegawai: upsertPegawai, hapusPegawai: hapusPegawai,
    upsertKatalog: upsertKatalog, upsertPemasok: upsertPemasok, hapusPemasok: hapusPemasok,
    simpanResep: simpanResep, upsertBahan: upsertBahan, hapusBahan: hapusBahan,
    catatLaporBos: catatLaporBos, simpanTerjemahan: simpanTerjemahan
  };
  var _tulisDalam = false;
  // Pembungkus semua metode tulis yang diekspor: online -> jalan biasa
  // (+ snapshot diperbarui); offline -> jalan in-memory, lalu satu entri
  // outbox + snapshot baru. Panggilan bersarang (mis. lunasiSemua yang
  // memanggil tambahPembayaran di dalam) hanya dicatat sekali oleh
  // pemanggil terluar. Bila tulis gagal (validasi dsb.), tidak dicatat.
  function bungkusTulis(nama, fn) {
    return async function () {
      var args = Array.prototype.slice.call(arguments);
      // Tambah pengguna BARU butuh Auth admin di server — tetap online.
      // Edit pengguna yang sudah ada boleh diantrekan (hanya baris tabel).
      if (nama === 'upsertPengguna' && offlineMode) {
        var p0 = args[0] || {};
        var ada = p0.ID && (DATA.pengguna || []).some(function (x) { return String(x.ID) === String(p0.ID); });
        if (!ada) throw new Error('Tambah pengguna baru butuh internet (akun login dibuat di server).');
      }
      if (!offlineMode) {
        var hasilOnline = await fn.apply(null, args);
        try { if ((await bacaOutbox()).length === 0) await tulisSnapshot(); } catch (e) {}
        return hasilOnline;
      }
      if (_tulisDalam) return fn.apply(null, args);
      var ringkasan = '';
      try { ringkasan = ringkasTulis(nama, args); } catch (e) { ringkasan = nama; }
      _tulisDalam = true;
      try {
        var hasil = await fn.apply(null, args);
        var argsSimpan = clone(args);
        // Id yang dibuat di client saat offline disimpan ke payload antrean
        // supaya replay memakai id yang sama (lihat saveTransaksi).
        var nid = hasil && (hasil.id || hasil.ID);
        if (nid && argsSimpan[0] && typeof argsSimpan[0] === 'object') {
          if (!argsSimpan[0].id) argsSimpan[0].id = nid;
          if (!argsSimpan[0].ID) argsSimpan[0].ID = nid;
        }
        if (hasil && hasil.kodeAlternatif && argsSimpan[0] && typeof argsSimpan[0] === 'object' && !argsSimpan[0].kodeAlternatif) argsSimpan[0].kodeAlternatif = hasil.kodeAlternatif;
        await tambahOutbox(nama, argsSimpan, ringkasan);
        await tulisSnapshot();
        if (typeof onOutboxBerubah === 'function') { try { onOutboxBerubah(); } catch (e) {} }
        return hasil;
      } finally { _tulisDalam = false; }
    };
  }
  var DB_EKSPOR_TULIS = {};
  Object.keys(METODE_TULIS).forEach(function (nama) { DB_EKSPOR_TULIS[nama] = bungkusTulis(nama, METODE_TULIS[nama]); });
  // Kembalikan DATA ke keadaan offline bila sinkronisasi gagal di tengah
  // jalan — utamanya dari snapshot (berisi perubahan offline), bila tidak
  // ada snapshot pakai DATA sebelum sinkronisasi.
  async function pulihkanDataOffline(dataOffline, modeOffline) {
    var snap = null;
    try { snap = await bacaSnapshot(); } catch (e) { snap = null; }
    if (snap) { DATA = snap; DATA.ringkasan = computeRingkasan(DATA); }
    else if (dataOffline) { DATA = dataOffline; }
    offlineMode = !!modeOffline;
  }
  // Unggah antrean SATU PER SATU sesuai urutan (FIFO) lewat metode DB
  // yang sudah ada, terhadap DATA SERVER SEGAR. Berhasil -> hapus dari
  // outbox. Gagal -> BERHENTI di entri itu (jangan loncat), tandai galat,
  // kembalikan DATA ke keadaan offline. Galat jaringan bukan salah entri:
  // antrean tetap menunggu, tanpa tanda gagal.
  async function sinkronkanOutbox() {
    var antrean = await bacaOutbox();
    if (!antrean.length) return { ok: true, diunggah: 0, gagal: 0 };
    if (jaringanMati()) return { ok: false, diunggah: 0, gagal: antrean.length, galat: 'Masih offline.' };
    var dataOffline = DATA;
    var offlineDulu = offlineMode;
    var dataServer;
    try { dataServer = await muatDariServer(); }
    catch (e) {
      if (galatJaringan(e)) return { ok: false, diunggah: 0, gagal: antrean.length, galat: 'Masih offline.' };
      return { ok: false, diunggah: 0, gagal: antrean.length, galat: (e && e.message) || String(e) };
    }
    DATA = dataServer;
    DATA.ringkasan = computeRingkasan(DATA);
    offlineMode = false;
    _replay = true;
    var diunggah = 0;
    try {
      for (var i = 0; i < antrean.length; i++) {
        var e = antrean[i];
        var fn = METODE_TULIS[e.jenis];
        if (!fn) {
          await tandaiGagalOutbox(e.id, 'Jenis antrean tidak dikenal: ' + e.jenis);
          await pulihkanDataOffline(dataOffline, offlineDulu);
          return { ok: false, diunggah: diunggah, gagal: 1, galat: 'Jenis antrean tidak dikenal: ' + e.jenis, entriGagal: e };
        }
        try {
          var hasilReplay = await fn.apply(null, e.args || []);
          // v4-45: metode yang menolak TANPA throw ({ok:false}, mis.
          // hapusCabang bila cabang keburu punya riwayat) JANGAN dihitung
          // sukses — entri dipertahankan sebagai gagal supaya tidak hilang
          // diam-diam dan toast menjelaskan penolakannya.
          if (hasilReplay && hasilReplay.ok === false) {
            var pesanTolak = hasilReplay.alasan || hasilReplay.error || 'Ditolak server saat sinkronisasi.';
            await tandaiGagalOutbox(e.id, pesanTolak);
            await pulihkanDataOffline(dataOffline, offlineDulu);
            return { ok: false, diunggah: diunggah, gagal: 1, galat: pesanTolak, entriGagal: e };
          }
          await hapusOutbox(e.id);
          diunggah++;
        } catch (err) {
          var pesan = (err && err.message) || String(err);
          if (galatJaringan(err)) {
            await pulihkanDataOffline(dataOffline, true);
            return { ok: false, diunggah: diunggah, gagal: 1, galat: 'Koneksi putus saat sinkronisasi.', entriGagal: e };
          }
          await tandaiGagalOutbox(e.id, pesan);
          await pulihkanDataOffline(dataOffline, offlineDulu);
          return { ok: false, diunggah: diunggah, gagal: 1, galat: pesan, entriGagal: e };
        }
      }
    } finally { _replay = false; }
    try { await tulisSnapshot(); } catch (e) {}
    if (typeof onOutboxBerubah === 'function') { try { onOutboxBerubah(); } catch (e) {} }
    return { ok: true, diunggah: diunggah, gagal: 0 };
  }
  // Coba lagi satu entri yang gagal: hapus tanda gagalnya lalu jalankan
  // sinkronisasi dari depan (entri gagal selalu yang tertua, jadi antrean
  // dimulai dari situ). "Coba lagi semua" = sinkronkanOutbox().
  async function cobaLagiOutbox(id) {
    var antrean = await bacaOutbox();
    var e = null;
    for (var i = 0; i < antrean.length; i++) if (String(antrean[i].id) === String(id)) { e = antrean[i]; break; }
    if (!e) return { ok: false, diunggah: 0, gagal: 0, galat: 'Antrean tidak ditemukan.' };
    if (e.galat) { e.galat = ''; await idbTulis('outbox', e); }
    return sinkronkanOutbox();
  }
  async function statusOffline() {
    var antrean = await bacaOutbox();
    var gagal = antrean.filter(function (x) { return x.galat; });
    return { offline: offlineMode, jumlah: antrean.length, gagal: gagal, antrean: antrean };
  }
  function sedangOffline() { return offlineMode; }

  /* ---------- ekspor global ---------- */
  /* Metode tulis diekspor lewat bungkusTulis (v4-32: antrean offline);
     metode baca diekspor langsung. */
  window.DB = Object.assign({
    mode: MODE, configured: !!CONFIGURED, isSample: MODE === 'contoh',
    getData: getData, refreshRingkasan: refreshRingkasan, setCabangSesi: setCabangSesi,
    loadAll: loadAll, login: login, getSessionUser: getSessionUser, logout: logout,
    loadKatalogPublik: loadKatalogPublik,
    muatDariSnapshot: muatDariSnapshot, sedangOffline: sedangOffline,
    statusOffline: statusOffline, sinkronkanOutbox: sinkronkanOutbox,
    cobaLagiOutbox: cobaLagiOutbox,
    setOnOutboxBerubah: function (fn) { onOutboxBerubah = fn; },
    muatTertunda: muatTertunda,
    getLaporan: getLaporan, getLaporanLengkap: getLaporanLengkap,
    getLaporanStok: getLaporanStok, saranOrder: saranOrder, hitungPromo: hitungPromo,
    getRiwayatPoin: getRiwayatPoin, getStruk: getStruk, getDapur: getDapur,
    getTopKasir: getTopKasir, getLogs: getLogs,
    kirimLaporBos: kirimLaporBos,
    exportProdukCSV: exportProdukCSV, exportLaporanExcel: exportLaporanExcel,
    cetakLabelBarcode: cetakLabelBarcode, hitungHPP: hitungHPP,
    pengingatPiutang: pengingatPiutang, tagihanGabungan: tagihanGabungan,
    getTerjemahan: getTerjemahan
  }, DB_EKSPOR_TULIS, {
    lunasiSemuaPelanggan: DB_EKSPOR_TULIS.lunasiSemua,
    upsertTeks: DB_EKSPOR_TULIS.simpanTeks
  });
  /* v4-41: status migrasi cabang untuk UI (app.js: banner + toast).
     Getter — nilainya dibaca saat diakses, bukan saat file dimuat,
     supaya perubahan flag setelah penolakan kolom langsung terlihat. */
  Object.defineProperty(window.DB, 'kolomCabangBelumAda', {
    get: function () { return migrasiCabangBelumJalan(); },
    configurable: true, enumerable: true
  });
  window.DB.migrasiCabangBelumJalan = migrasiCabangBelumJalan;
})();
