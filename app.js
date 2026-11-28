/* ZPOS v4 — Logika UI (cermin V12) */
var DATA = { produk: [], transaksi: [], detail: [], pelanggan: [], pemasok: [], pembelian: [], pembelianDetail: [], pengeluaran: [], kas: [], pengaturan: {}, ringkasan: {}, bahan: [], resep: [], pengguna: [], retur: [], cabang: [], stokCabang: [], stokBatch: [], riwayatPoin: [], tier: [], utang: [], cicilanUtang: [], transaksiCepat: [], transaksiTertunda: [], meja: [], pesananDapur: [], promo: [], katalog: [], daftarTeks: [], grup: [], satuan: [], jenisBayar: [], itemPengeluaran: [], pegawai: [], logs: [], terjemahan: {}, opname: [], laporBos: [] };
var cart = []; var lastStruk = ''; var lastStrukData = null; var lastWaTelp = ''; var resepDraft = []; var beliItems = []; var currentUser = null; var promoTerpakai = []; var promoDiskon = 0; var poinDipakai = 0; var laporBosTeks = ''; var laporBosWa = '';
var rp = function (n) { return 'Rp ' + (Math.round(n || 0)).toLocaleString('id-ID'); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var escJS = function (s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
/* ---------- Format uang di input (pemisah ribuan otomatis, v4-21) ----------
   Semua isian uang memakai type="text" + inputmode="decimal" agar titik
   pemisah ribuan bisa tampil saat mengetik (12.000, 1.250.000). Yang
   tersimpan ke DB tetap angka biasa — semua tempat yang membaca nilai
   uang WAJIB memakai parseUang(), jangan Number(.value) langsung. */
function parseUang(v) {
  if (v == null) return 0;
  var s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  var neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  var bag = s.split(',');
  var bulat = bag[0].replace(/\./g, '');
  var des = bag.length > 1 ? bag.slice(1).join('') : '';
  var n = parseFloat(bulat + (des ? '.' + des : ''));
  if (isNaN(n)) return 0;
  return neg ? -n : n;
}
function fmtUang(n) { var v = parseUang(n); return v ? Math.round(v).toLocaleString('id-ID') : ''; }
function angkaUang(id) { var el = typeof id === 'string' ? document.getElementById(id) : id; return el ? parseUang(el.value) : 0; }
function setUang(id, n) { var el = typeof id === 'string' ? document.getElementById(id) : id; if (el) el.value = fmtUang(n); }
function formatUangInput(el) {
  if (!el) return;
  var d = String(el.value || '').replace(/[^\d]/g, '');
  el.value = d ? Number(d).toLocaleString('id-ID') : '';
}
/* Diskon total: format pemisah ribuan hanya saat jenis nominal; saat
   persen, nilainya persen (0-100) jadi tampilkan angka polos saja. */
function formatDiskonInput() {
  var el = document.getElementById('kasirDiskon'); if (!el) return;
  var jenis = document.getElementById('kasirDiskonJenis').value;
  if (jenis === 'persen') el.value = String(el.value || '').replace(/[^\d]/g, '');
  else formatUangInput(el);
  renderCart();
}
function diskonJenisGanti() {
  var el = document.getElementById('kasirDiskon'); if (!el) return;
  var jenis = document.getElementById('kasirDiskonJenis').value;
  if (jenis === 'persen') el.value = String(parseUang(el.value));
  else el.value = fmtUang(el.value);
  renderCart();
}
/* Nilai promo: hanya jenis nominal (DiskonNominal/HappyHour/Bundling) yang
   berupa uang; DiskonPersen berupa persen, BeliXGratisY tidak memakai nilai. */
function promoNilaiAdalahUang() { var j = document.getElementById('prmJenis'); return j && (j.value === 'DiskonNominal' || j.value === 'HappyHour' || j.value === 'Bundling'); }
function formatPromoNilaiInput() {
  var el = document.getElementById('prmNilai'); if (!el) return;
  if (promoNilaiAdalahUang()) formatUangInput(el);
  else el.value = String(el.value || '').replace(/[^\d]/g, '');
}
function promoJenisGanti() {
  var el = document.getElementById('prmNilai'); if (!el) return;
  el.value = promoNilaiAdalahUang() ? fmtUang(el.value) : String(parseUang(el.value));
}
function todayStr(d) { var x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
// tanggal dari database sering mentah ISO ("2026-11-24T00:00:00+00:00") —
// tampilkan sebagai dd-mm-yyyy seperti tanggal lain di aplikasi.
function fmtTanggalID(s) {
  if (s == null || s === '') return '—';
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return m[3] + '-' + m[2] + '-' + m[1];
}
function show(id, btn) {
  if (typeof sembunyiKartuKeluar === 'function') sembunyiKartuKeluar(); // pindah layar: kartu keluar tidak lagi relevan
  document.querySelectorAll('main section').forEach(function (s) { s.classList.remove('active'); });
  var el = document.getElementById(id); if (el) el.classList.add('active');
  document.querySelectorAll('nav button.menu').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('#bottomNav button').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var nb = document.querySelector('#bottomNav button[data-sec="' + id + '"]'); if (nb) nb.classList.add('active');
  var db = document.querySelector('nav button.menu[data-sec="' + id + '"]'); if (db) db.classList.add('active');
  tutupForm(id);
  if (id === 'kasir') langkahKasir(1);
  closeDrawer(); window.scrollTo(0, 0);
  if (typeof navSinkronSesudahShow === 'function') navSinkronSesudahShow(id);
  // v4-37: mendarat di dashboard dengan tumpukan kosong (mis. kembali tanpa
  // riwayat) — pastikan ada entri penjaga (pushState) supaya tombol kembali
  // berikutnya tertangkap.
  if (id === 'dashboard' && typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat();
}
/* ---------- KASIR 3 LANGKAH ala Griyo: 1) daftar produk, 2) keranjang, 3) pembayaran (#bayar) ---------- */
var langkahKasirAktif = 1;
function langkahKasir(n) {
  var s1 = document.getElementById('kasirLangkah1'), s2 = document.getElementById('kasirLangkah2');
  if (!s1 || !s2) return;
  langkahKasirAktif = n;
  s1.style.display = n === 1 ? '' : 'none';
  s2.style.display = n === 2 ? '' : 'none';
  renderCart();
  window.scrollTo(0, 0);
  if (typeof navSinkronSesudahLangkah === 'function') navSinkronSesudahLangkah(n);
}
function kembaliKeKeranjang() { kembali(); }
function toggleDrawer() { var n = document.getElementById('nav'); var b = document.getElementById('drawerBackdrop'); var open = n && !n.classList.contains('open'); if (n) n.classList.toggle('open', open); if (b) b.style.display = open ? 'block' : 'none'; }
function closeDrawer() { var n = document.getElementById('nav'); var b = document.getElementById('drawerBackdrop'); if (n) n.classList.remove('open'); if (b) b.style.display = 'none'; }

/* ---------- RIWAYAT NAVIGASI / TOMBOL KEMBALI ANDROID (v4-35, penjaga diperkuat v4-37) ----------
   Masalah: aplikasi pindah layar hanya dengan JavaScript (show/bukaForm/
   langkahKasir) tanpa History API — tombol kembali Android tidak punya
   "layar sebelumnya" dan langsung menutup aplikasi. Perbaikan: setiap
   pindah layar mencatat satu entri history.pushState; tombol kembali
   (popstate) mundur tepat satu layar: overlay ditutup dulu, form -> daftar,
   kasir mundur satu langkah (keranjang utuh), daftar/menu -> dashboard,
   dan di dashboard tekan pertama hanya kartu tengah, tekan kedua (<2 detik) baru
   keluar. Layar login TIDAK dicegat. v4-37: entri penjaga dashboard dipasang
   sejak awal (awal loadData) dan dipasang ulang tiap aplikasi kembali ke
   depan + saat mendarat di dashboard — penjaga v4-35/36 yang hanya dipasang
   sekali di akhir muat data membuat kembali di dashboard segar / setelah
   buka-lagi-dari-latar-belakang lolos tanpa kartu. */
var NAV = {
  siap: false,          // entri penjaga sudah dipasang (sekali per login)
  aktif: null,          // deskriptor layar saat ini {s, f, k, d}
  tumpuk: [],           // cermin tumpukan riwayat (hanya entri yang kita dorong; penjaga = [0])
  keluarDalam: 0,       // waktu (ms) tekan-kembali pertama di dashboard
  izinKeluar: false,    // popstate berikutnya dibiarkan keluar
  mundurProgram: false, // popstate dari history.back() programatik (tombol dlm aplikasi)
  tanpaRiwayat: false,  // render dari popstate: jangan catat riwayat lagi
};
// Deskriptor layar: s = section, f = form-view (bila form terbuka),
// k = langkah kasir (1/2, atau 3 untuk section bayar), d = id detail trx.
function layarBaru(s, f, k, d) { var L = { s: s }; if (f) L.f = f; if (k) L.k = k; if (d) L.d = d; return L; }
function samaLayar(a, b) {
  if (!a || !b) return a === b;
  return a.s === b.s && (a.f || null) === (b.f || null) && (a.k || null) === (b.k || null) && (a.d || null) === (b.d || null);
}
function layarDariState(st) {
  if (!st || !st.s) return { s: 'dashboard' };
  return layarBaru(st.s, st.f || null, st.k || null, st.d || null);
}
// Keputusan murni: status layar saat ini -> tindakan kembali.
// st: { sudahLogin, overlay, overlayTerkunci, layar, keluarDalamMs }
function keputusanKembali(st) {
  if (!st.sudahLogin) return { aksi: 'abaikan' };
  if (st.overlayTerkunci) return { aksi: 'telan' };
  if (st.overlay) return { aksi: 'tutupOverlay', overlay: st.overlay };
  var L = st.layar || { s: 'dashboard' };
  if (L.f) return { aksi: 'keDaftar', section: L.s };
  if (L.s === 'detailTrx') return { aksi: 'keDaftar', section: 'daftar' };
  if (L.s === 'bayar') return { aksi: 'mundurKasir', langkah: 2 };
  if (L.s === 'kasir' && L.k === 2) return { aksi: 'mundurKasir', langkah: 1 };
  if (L.s === 'dashboard') {
    if (st.keluarDalamMs != null && st.keluarDalamMs <= 2000) return { aksi: 'keluar' };
    return { aksi: 'toastKeluar' };
  }
  return { aksi: 'keDashboard' };
}
function sudahLoginRiwayat() {
  try {
    var lb = document.getElementById('loginBox');
    if (lb && lb.style.display === 'block') return false;
    if (document.body && document.body.classList && document.body.classList.contains && document.body.classList.contains('belum-login')) return false;
    var oa = document.getElementById('offlineAwal');
    if (oa && oa.style.display !== 'none') return false;
    return true;
  } catch (e) { return true; }
}
// Overlay mana yang sedang terbuka (paling atas dulu). Modal konfirmasi
// yang terkunci (impor CSV berjalan) tidak bisa ditutup — kembali ditelan.
function overlayTerbuka() {
  var el = function (id) { try { return document.getElementById(id); } catch (e) { return null; } };
  var sm = el('scanModal'); if (sm && sm.style.display === 'block') return { nama: 'scan' };
  var kb = el('konfirmBackdrop'); if (kb && kb.style.display === 'block') {
    if (typeof _imporBerjalan !== 'undefined' && _imporBerjalan) return { nama: 'konfirmasi', terkunci: true };
    return { nama: 'konfirmasi' };
  }
  var ib = el('infoBackdrop'); if (ib && ib.style.display === 'block') return { nama: 'info' };
  var np = el('notifPanel'); if (np && np.style.display === 'block') return { nama: 'notif' };
  var lb = el('lebihBackdrop'); if (lb && lb.style.display === 'block') return { nama: 'lebih' };
  var nav = el('nav'); if (nav && nav.classList && nav.classList.contains && nav.classList.contains('open')) return { nama: 'drawer' };
  var ml = el('menuLainnyaProduk'); if (ml && ml.style.display === 'block') return { nama: 'dropdown' };
  var dg = el('dropdownGrupProduk'); if (dg && dg.style.display === 'block') return { nama: 'dropdown' };
  return null;
}
function tutupOverlay(nama) {
  if (nama === 'scan') { if (typeof tutupScanKamera === 'function') tutupScanKamera(); }
  else if (nama === 'konfirmasi') { if (typeof jawabKonfirm === 'function') jawabKonfirm(false); }
  else if (nama === 'info') { if (typeof tutupInfoModal === 'function') tutupInfoModal(); }
  else if (nama === 'notif') { if (typeof toggleNotifPanel === 'function') toggleNotifPanel(); }
  else if (nama === 'lebih') { if (typeof tutupLebih === 'function') tutupLebih(); }
  else if (nama === 'drawer') { closeDrawer(); }
  else if (nama === 'dropdown') { if (typeof tutupDropdownGrup === 'function') tutupDropdownGrup(); if (typeof tutupMenuLainnyaProduk === 'function') tutupMenuLainnyaProduk(); }
}
function navDorong(L) {
  if (typeof NAV === 'undefined' || !NAV.siap) return false;
  var n = NAV.tumpuk.length;
  // (tanpa guard samaLayar di sini: pemanggil sudah memeriksanya, dan
  // jalur toast/overlay memang sengaja mendorong layar yang sama untuk
  // memulihkan entri yang baru saja ter-pop.)
  // Kembali ke layar tepat di bawah puncak via bukaForm (mis. simpan item
  // pembelian kembali ke formPembelian): jangan dorong duplikat, mundur
  // satu entri lewat history.back() — popstate-nya yang merender.
  if (n >= 2 && samaLayar(L, NAV.tumpuk[n - 2])) { navMundurProgram(); return true; }
  try {
    if (typeof history === 'undefined' || !history.pushState) return false;
    history.pushState(L, '');
  } catch (e) { return false; }
  NAV.aktif = L; NAV.tumpuk.push(L);
  NAV.izinKeluar = false; // v4-37: bendera basi dari keluar sebelumnya tidak boleh menelan popstate berikutnya
  return true;
}
function navGanti(L) {
  if (typeof NAV === 'undefined' || !NAV.siap) return false;
  try {
    if (typeof history === 'undefined' || !history.replaceState) return false;
    history.replaceState(L, '');
  } catch (e) { return false; }
  NAV.aktif = L;
  if (NAV.tumpuk.length) NAV.tumpuk[NAV.tumpuk.length - 1] = L;
  NAV.izinKeluar = false; // v4-37: seperti navDorong
  return true;
}
function navMundurProgram() {
  if (typeof NAV === 'undefined' || !NAV.siap || NAV.tumpuk.length < 1) return false;
  NAV.mundurProgram = true;
  try { history.back(); } catch (e) { NAV.mundurProgram = false; return false; }
  return true;
}
// Render layar tanpa menyentuh riwayat (dipakai popstate & kembali).
function terapkanLayar(L) {
  if (!L) L = { s: 'dashboard' };
  var s = L.s || 'dashboard';
  // v4-44: render dari popstate yang meninggalkan Pengaturan — target
  // kembali ke struk tidak berlaku lagi (navSinkronSesudahShow tidak
  // jalan di jalur ini, jadi dibersihkan di sini).
  if (s !== 'pengaturan' && typeof kembaliKeDetailDariPengaturan !== 'undefined') { kembaliKeDetailDariPengaturan = ''; kembaliKeDetailTabDariPengaturan = ''; }
  NAV.tanpaRiwayat = true;
  try {
    show(s, (typeof document !== 'undefined' && document.querySelector) ? document.querySelector('nav button.menu[data-sec="' + s + '"]') : null);
    if (L.f) bukaForm(s, L.f);
    if (s === 'kasir' && L.k) langkahKasir(L.k);
  } finally { NAV.tanpaRiwayat = false; }
  NAV.aktif = L;
  // v4-37: mendarat di dashboard dengan tumpukan kosong (popstate) —
  // pastikan penjaga ada (show() di atas melihat NAV.aktif lama, jadi
  // hook di sini yang menutup kasus ini).
  if (L.s === 'dashboard' && typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat();
}
// Tombol "← Kembali" di dalam aplikasi: lewat riwayat supaya tumpukan
// tetap konsisten dengan tombol kembali Android. Bila tidak ada entri
// riwayat (mis. layar dibuka sebelum penjaga dipasang), lakukan aksi
// kembali langsung tanpa riwayat.
function kembali() {
  if (typeof NAV !== 'undefined' && NAV.siap && NAV.tumpuk.length >= 1) { navMundurProgram(); return; }
  var L = (typeof NAV !== 'undefined' && NAV.aktif) || { s: 'dashboard' };
  if (L.f) { tutupForm(L.s); return; }
  if (L.s === 'detailTrx') { show('daftar', null); return; }
  if (L.s === 'bayar') { show('kasir', null); langkahKasir(2); return; }
  if (L.s === 'kasir' && L.k === 2) { langkahKasir(1); return; }
  if (L.s !== 'dashboard') { show('dashboard', null); return; }
}
// v4-44: tombol "← Kembali" di kartu Profil Toko. Bila Profil Toko dibuka
// dari detail transaksi (target tercatat), kembali langsung ke struk itu;
// bila tidak ada target (mis. dibuka dari drawer), pakai kembali() biasa.
function kembaliDariProfil() {
  var id = (typeof kembaliKeDetailDariPengaturan !== 'undefined' && kembaliKeDetailDariPengaturan) || '';
  var tab = (typeof kembaliKeDetailTabDariPengaturan !== 'undefined' && kembaliKeDetailTabDariPengaturan) || '';
  kembaliKeDetailDariPengaturan = '';
  kembaliKeDetailTabDariPengaturan = '';
  if (id) {
    var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
    if (t) { bukaDetailTrx(id, tab || 'detail'); return; }
  }
  kembali();
}
function saatPopstate(ev) {
  if (typeof NAV === 'undefined') return;
  if (NAV.izinKeluar) return;
  if (NAV.mundurProgram) {
    NAV.mundurProgram = false;
    NAV.tumpuk.pop();
    terapkanLayar(layarDariState(ev && ev.state));
    return;
  }
  if (!NAV.siap) return;
  NAV.tumpuk.pop(); // pop sudah terjadi: kita mundur satu entri
  var mendarat = layarDariState(ev && ev.state);
  var ov = overlayTerbuka();
  var st = {
    sudahLogin: sudahLoginRiwayat(),
    overlay: ov ? ov.nama : null,
    overlayTerkunci: !!(ov && ov.terkunci),
    layar: NAV.aktif || { s: 'dashboard' },
    keluarDalamMs: NAV.keluarDalam ? (Date.now() - NAV.keluarDalam) : null,
  };
  var kep = keputusanKembali(st);
  if (kep.aksi === 'abaikan') return;
  if (kep.aksi === 'telan') { navDorong(NAV.aktif); return; }
  if (kep.aksi === 'tutupOverlay') { tutupOverlay(kep.overlay); navDorong(NAV.aktif); return; }
  if (kep.aksi === 'toastKeluar') {
    NAV.keluarDalam = Date.now();
    tampilKartuKeluar();
    navDorong({ s: 'dashboard' });
    return;
  }
  if (kep.aksi === 'keluar') {
    NAV.izinKeluar = true;
    try { history.back(); } catch (e) {}
    return;
  }
  if (kep.aksi === 'keDaftar') {
    // Target idealnya entri tempat pop mendarat (mis. formPembelian di
    // bawah formBeliItem); bila tidak cocok dengan section-nya, ke daftar.
    var targetDaftar = (ev && ev.state && ev.state.s === kep.section) ? mendarat : layarBaru(kep.section);
    terapkanLayar(targetDaftar);
    if (!samaLayar(targetDaftar, mendarat)) navGanti(targetDaftar);
    return;
  }
  var target = kep.aksi === 'mundurKasir' ? layarBaru('kasir', null, kep.langkah)
    : { s: 'dashboard' };
  terapkanLayar(target);
  if (!samaLayar(target, mendarat)) navGanti(target);
}
// Pasang entri penjaga dashboard (v4-37: idempotent, boleh dipanggil
// berulang — bukan lagi sekali per muat halaman). Tanpa penjaga, kembali di
// dashboard tidak memicu popstate dan aplikasi langsung tertutup. Dipanggil:
// di awal loadData() (supaya tekan kembali saat loading pun tertangkap), di
// akhir selesaiMuatData(), saat mendarat di dashboard (show), dan tiap
// aplikasi kembali ke depan (pageshow / visibilitychange / focus) — menutup
// dua lubang v4-36: (a) penjaga hanya dipasang sekali di akhir muat data,
// (b) aplikasi yang dibuka lagi dari latar belakang tanpa reload tidak pernah
// dipasangi penjaga lagi, dan (c) NAV.izinKeluar yang diset true saat keluar
// 2x tidak pernah direset kecuali logout/reload, sehingga popstate berikutnya
// ditelan diam-diam. Pemasangan (ulang) juga mereset izinKeluar/keluarDalam.
function pasangPenjagaRiwayat() {
  if (typeof NAV === 'undefined') return;
  if (typeof history === 'undefined' || !history.pushState) return;
  // Hanya saat berada di dashboard dan sudah login (layar login tidak dicegat).
  var aktif = NAV.aktif || { s: 'dashboard' };
  if (aktif.s !== 'dashboard') return;
  if (typeof sudahLoginRiwayat === 'function' && !sudahLoginRiwayat()) return;
  // Jangan dorong ganda: puncak tumpukan sudah entri dashboard/penjaga.
  var atas = NAV.tumpuk.length ? NAV.tumpuk[NAV.tumpuk.length - 1] : null;
  if (atas && atas.s === 'dashboard') return;
  try {
    history.pushState({ s: 'dashboard', penjaga: true }, '');
  } catch (e) { return; }
  NAV.siap = true;
  NAV.aktif = { s: 'dashboard' };
  NAV.tumpuk.push({ s: 'dashboard', penjaga: true });
  NAV.keluarDalam = 0; NAV.izinKeluar = false; NAV.mundurProgram = false;
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('popstate', saatPopstate);
  // v4-37: pasang ulang penjaga tiap aplikasi kembali ke depan (PWA yang
  // dibuka lagi dari latar belakang tidak me-reload halaman, jadi tanpa ini
  // penjaga yang sudah terpakai tidak pernah kembali).
  window.addEventListener('pageshow', function () { if (typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat(); });
  window.addEventListener('focus', function () { if (typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat(); });
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function () { if (!document.hidden && typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat(); });
  }
}
// Sinkronisasi riwayat sesudah navigasi (dipanggil show/bukaForm/
// tutupForm/langkahKasir). Dijaga typeof supaya sim yang mengekstrak
// fungsi-fungsi itu saja tidak rusak.
function navSinkronSesudahShow(id) {
  if (typeof NAV === 'undefined' || NAV.tanpaRiwayat || NAV.mundurProgram) return;
  var d = (id === 'detailTrx' && typeof detailTrxId !== 'undefined') ? detailTrxId : undefined;
  var baru = layarBaru(id, null, id === 'kasir' ? 1 : (id === 'bayar' ? 3 : undefined), d);
  if (samaLayar(baru, NAV.aktif)) return;
  var lama = NAV.aktif;
  // v4-44: meninggalkan Pengaturan menuju layar lain — target kembali ke
  // struk yang dicatat saat tombol Pengaturan di detail ditekan sudah
  // tidak berlaku lagi (mencegah Kembali di Profil Toko melompat ke
  // struk lama yang sudah ditinggalkan).
  if (lama && lama.s === 'pengaturan' && id !== 'pengaturan' && typeof kembaliKeDetailDariPengaturan !== 'undefined') { kembaliKeDetailDariPengaturan = ''; kembaliKeDetailTabDariPengaturan = ''; }
  NAV.aktif = baru; // lacak layar saat ini walau penjaga belum dipasang
  if (!NAV.siap) return;
  if (id === 'dashboard') { navGanti(baru); return; }
  if (lama && (lama.f || lama.s === 'detailTrx')) { navGanti(baru); return; }
  navDorong(baru);
}
function navSinkronSesudahLangkah(n) {
  if (typeof NAV === 'undefined' || NAV.tanpaRiwayat || NAV.mundurProgram) return;
  var L = layarBaru('kasir', null, n);
  if (samaLayar(L, NAV.aktif)) return;
  NAV.aktif = L;
  if (!NAV.siap) return;
  navDorong(L);
}
function navSinkronSesudahBukaForm(secId, formId) {
  if (typeof NAV === 'undefined' || NAV.tanpaRiwayat || NAV.mundurProgram) return;
  var L = layarBaru(secId, formId || null);
  if (samaLayar(L, NAV.aktif)) return;
  NAV.aktif = L;
  if (!NAV.siap) return;
  navDorong(L);
}
function navSinkronSesudahTutupForm(secId) {
  if (typeof NAV === 'undefined' || NAV.tanpaRiwayat || NAV.mundurProgram) return;
  if (!NAV.aktif || !NAV.aktif.f || NAV.aktif.s !== secId) return;
  if (!NAV.siap) { NAV.aktif = layarBaru(secId); return; }
  navMundurProgram();
}

/* ---------- HALAMAN DAFTAR / DETAIL (pola Griyo: daftar + tombol +, isi di halaman sendiri) ----------
   Tiap menu master punya 2 tampilan: .list-view (daftar + tombol +) dan .form-view (isi detail).
   bukaForm menampilkan form-nya saja; tutupForm kembali ke daftar. */
function bukaForm(secId, formId) {
  var sec = document.getElementById(secId); if (!sec) return;
  sec.querySelectorAll('.list-view').forEach(function (el) { el.style.display = 'none'; });
  sec.querySelectorAll('.form-view').forEach(function (el) { el.style.display = 'none'; });
  var f = formId ? document.getElementById(formId) : sec.querySelector('.form-view');
  if (f) f.style.display = 'block';
  window.scrollTo(0, 0);
  if (typeof navSinkronSesudahBukaForm === 'function') navSinkronSesudahBukaForm(secId, f && f.id);
}
function tutupForm(secId) {
  var sec = document.getElementById(secId); if (!sec) return;
  sec.querySelectorAll('.form-view').forEach(function (el) { el.style.display = 'none'; });
  sec.querySelectorAll('.list-view').forEach(function (el) { el.style.display = ''; });
  window.scrollTo(0, 0);
  if (typeof navSinkronSesudahTutupForm === 'function') navSinkronSesudahTutupForm(secId);
}
/* Popup konfirmasi di dalam aplikasi (pengganti popup bawaan browser):
   konfirmasi(judul, pesan, labelYa, kelasYa) mengembalikan Promise<boolean> —
   true bila pengguna menekan tombol Ya, false bila Batal / ketuk luar popup.
   Dipakai semua aksi hapus / proses yang tidak bisa dibatalkan. */
var _konfirmJanji = null;
function konfirmasi(judul, pesan, labelYa, kelasYa) {
  return new Promise(function (selesai) {
    _konfirmJanji = selesai;
    document.getElementById('konfirmJudul').textContent = judul;
    document.getElementById('konfirmPesan').textContent = pesan;
    var ya = document.getElementById('konfirmYa');
    ya.textContent = labelYa || 'Ya, Hapus';
    ya.className = kelasYa === 'primary' ? 'primary' : 'danger';
    document.getElementById('konfirmBackdrop').style.display = 'block';
    document.getElementById('konfirmBox').style.display = 'block';
  });
}
function jawabKonfirm(ya) {
  // selama impor berjalan, modal dipakai sebagai layar progres —
  // tidak bisa ditutup (tombol disembunyikan, klik luar diabaikan).
  if (typeof _imporBerjalan !== 'undefined' && _imporBerjalan) return;
  document.getElementById('konfirmBackdrop').style.display = 'none';
  document.getElementById('konfirmBox').style.display = 'none';
  if (_konfirmJanji) { var s = _konfirmJanji; _konfirmJanji = null; s(!!ya); }
}
/* Popup info di dalam aplikasi (pengganti alert() untuk Bantuan/Tentang):
   tampilInfoModal(judul, pesan) membuka modal kartu putih yang sama dengan
   konfirmasi (backdrop + .konfirm-card); tutupInfoModal() menutupnya lewat
   tombol Tutup atau ketuk luar popup.
   Nama sengaja berbeda dari tampilInfo(msg) lama — itu helper toast sukses
   yang dipakai ~50 tempat; dua fungsi tampilInfo akan saling menimpa. */
function tampilInfoModal(judul, pesan) {
  document.getElementById('infoJudul').textContent = judul;
  document.getElementById('infoPesan').textContent = pesan;
  document.getElementById('infoBackdrop').style.display = 'block';
  document.getElementById('infoBox').style.display = 'block';
}
function tutupInfoModal() {
  document.getElementById('infoBackdrop').style.display = 'none';
  document.getElementById('infoBox').style.display = 'none';
}
/* ---------- PANEL NOTIFIKASI (lonceng) ---------- */
function toggleNotifPanel() {
  var p = document.getElementById('notifPanel'), b = document.getElementById('notifBackdrop');
  var buka = p && p.style.display !== 'block';
  if (p) p.style.display = buka ? 'block' : 'none';
  if (b) b.style.display = buka ? 'block' : 'none';
  if (buka) isiNotifPanel();
}
function isiNotifPanel() {
  var p = document.getElementById('notifPanel'); if (!p) return;
  var list = (DATA.produk || []).filter(function (x) { return milikCabangSesi(x) && produkAktif(x) && lacakStok(x) && stokProduk(x) <= Number(x.StokMinimum || 5); });
  p.innerHTML = '<div class="notif-card"><div class="notif-head"><b>' + ikon('bell', 18) + ' Notifikasi</b><button class="t-x" onclick="toggleNotifPanel()">✕</button></div>' + (list.length ? list.map(function (x) { return '<div class="notif-item"><span class="notif-ic">' + ikon('alert', 18) + '</span><div><b>' + esc(x.Nama) + '</b><span>Stok menipis — sisa ' + stokProduk(x) + ' ' + esc(x.Satuan || 'pcs') + ' (min. ' + (x.StokMinimum || 5) + ')</span></div></div>'; }).join('') : '<div class="notif-kosong">Semua stok aman. Tidak ada notifikasi.</div>') + '<button class="primary" style="width:100%;margin-top:10px" onclick="toggleNotifPanel();go(\'stok\')">Lihat Stok</button></div>';
}
function go(sec) { show(sec, document.querySelector('nav button.menu[data-sec="' + sec + '"]')); }
function terjemah(kata) { var t = DATA.terjemahan || {}; return t[kata] || kata; }
function cabangAktifId() { var p = DATA.pengaturan || {}; return p.CabangAktif || ((DATA.cabang || [])[0] && DATA.cabang[0].ID) || ''; }
/* v4-41: cabang sesi — HANYA Kasir yang dikunci ke satu cabang
   (currentUser.CabangID). Admin SELALU memakai Cabang Aktif global
   (cabangAktifId) walau data penggunanya punya CabangID — pemilik harus
   bisa ganti cabang bebas. Peran dibaca dari currentUser.peran (bentuk
   yang dikembalikan DB.login) dengan fallback currentUser.Peran.
   Baris tanpa CabangID dianggap milik cabang pertama (aturan legacy). */
function cabangSesiId() { var peran = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.peran || currentUser.Peran || '') : ''; if (peran === 'Admin') return cabangAktifId(); return (typeof currentUser !== 'undefined' && currentUser && currentUser.CabangID) ? currentUser.CabangID : cabangAktifId(); }
function cabangTerkunci() { var peran = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.peran || currentUser.Peran || '') : ''; return peran === 'Kasir' && !!(typeof currentUser !== 'undefined' && currentUser && currentUser.CabangID); }
function cabangPertamaId() { var c = (typeof DATA !== 'undefined' && DATA && DATA.cabang) || []; return (c[0] && c[0].ID) || ''; }
function milikCabangSesi(x) { return String((x && x.CabangID) || cabangPertamaId()) === String(cabangSesiId()); }
/* Baris cabang sesi (untuk alamat/telepon/target per cabang di struk & pengaturan). */
function cabangSesiData() { var id = cabangSesiId(); var list = (typeof DATA !== 'undefined' && DATA && DATA.cabang) || []; for (var i = 0; i < list.length; i++) { if (String(list[i].ID) === String(id)) return list[i]; } return null; }
function alamatStruk() { var c = cabangSesiData(); return (c && c.Alamat) ? c.Alamat : ((typeof DATA !== 'undefined' && DATA && DATA.pengaturan && DATA.pengaturan.AlamatToko) || ''); }
function teleponStruk() { var c = cabangSesiData(); return (c && c.Telepon) ? c.Telepon : ((typeof DATA !== 'undefined' && DATA && DATA.pengaturan && DATA.pengaturan.TeleponToko) || ''); }
function targetHarianEfektif() { var c = cabangSesiData(); var t = c ? Number(c.TargetHarian || 0) : 0; if (t > 0) return t; return Number((typeof DATA !== 'undefined' && DATA && DATA.pengaturan && DATA.pengaturan.TargetHarian) || 0); }
/* Utang tidak punya CabangID — cabangnya diturunkan dari pembelian via PembelianID. */
function cabangDariUtang(u) { var pb = null; try { pb = ((typeof DATA !== 'undefined' && DATA && DATA.pembelian) || []).find(function (p) { return String(p.ID) === String(u && u.PembelianID); }); } catch (e) { pb = null; } return (pb && pb.CabangID) || cabangPertamaId(); }
function milikCabangSesiUtang(u) { return String(cabangDariUtang(u)) === String(cabangSesiId()); }
/* Cabang efektif untuk laporan: pilihan eksplisit di dropdown dihormati,
   kecuali pengguna terkunci (dipaksa cabang sesi); tanpa pilihan = cabang sesi. */
function cabangLaporanEfektif(pilihan) { if (cabangTerkunci()) return cabangSesiId(); return pilihan || cabangSesiId() || undefined; }
/* ---------- PERINGATAN MIGRASI CABANG (v4-41) ----------
   DB.kolomCabangBelumAda (data layer) = true bila penulisan cabang_id
   pernah ditolak = migrasi-cabang-v441.sql belum dijalankan. Guard typeof
   supaya aman bila data layer lama belum punya flag itu. Toast hanya
   sekali per sesi; banner di Pengaturan tampil selama flag true. */
var TEKS_MIGRASI_CABANG = 'Migrasi cabang belum dijalankan — pelanggan/pemasok belum terpisah per cabang. Jalankan migrasi-cabang-v441.sql di SQL Editor Supabase.';
var _peringatanMigrasiSudah = false;
function migrasiCabangBelumAda() { try { return typeof DB !== 'undefined' && DB && typeof DB.kolomCabangBelumAda !== 'undefined' && !!DB.kolomCabangBelumAda; } catch (e) { return false; } }
function tampilkanBannerMigrasi() { var b = document.getElementById('bannerMigrasiCabang'); if (b) b.style.display = migrasiCabangBelumAda() ? '' : 'none'; }
function peringatkanMigrasiCabangSekali() {
  tampilkanBannerMigrasi();
  if (_peringatanMigrasiSudah) return false;
  if (!migrasiCabangBelumAda()) return false;
  _peringatanMigrasiSudah = true;
  tampilInfo(TEKS_MIGRASI_CABANG);
  return true;
}
function stokProduk(p) {
  var sc = (DATA.stokCabang || []).filter(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cabangSesiId()); });
  if (sc.length) return Number(sc[0].Stok || 0);
  return Number(p.Stok || 0);
}
// Produk aktif? Menangani boolean (database) dan 'YA'/'TIDAK' (Mode Contoh / V12).
// Produk nonaktif (mis. TES Kopi setelah dinonaktifkan) tidak tampil di kasir
// dan tidak dihitung di dashboard/laporan — tapi tetap ada di master & riwayat.
function produkAktif(p) { return p.Aktif !== false && String(p.Aktif == null ? 'YA' : p.Aktif).toUpperCase() !== 'TIDAK'; }
function lacakStok(p) { if (p.TermasukStok === false) return false; return String(p.TermasukStok == null ? 'YA' : p.TermasukStok).toUpperCase() !== 'TIDAK'; }
// Bendera umum (checkbox YA/TIDAK) yang tahan boolean maupun string.
function flagYa(v) { return v !== false && String(v == null ? 'YA' : v).toUpperCase() !== 'TIDAK'; }
function izinAktif(kunci) {
  if (!currentUser) return true;
  if (currentUser.peran === 'Admin') return true;
  try { var iz = JSON.parse(currentUser.IzinJSON || '{}'); return iz[kunci] !== false; } catch (e) { return true; }
}
function sembunyikanHPP() {
  if (!currentUser) return false;
  try { var iz = JSON.parse(currentUser.IzinJSON || '{}'); return !!iz.sembunyikanHPP; } catch (e) { return false; }
}
function hideLoading() { var l = document.getElementById('loading'); if (l) l.style.display = 'none'; }
/* ---------- IKON / FORMAT RINGKAS ---------- */
/* Ikon outline v4-26 (sistem sama seperti v4-25): viewBox 0 0 24 24,
   fill none, stroke currentColor, stroke-width 2, round caps/joins.
   ikon() SELALU menulis width/height eksplisit di tag SVG — ikon yang
   disuntik lewat innerHTML tidak boleh mengandalkan CSS saja (tanpa
   ukuran, SVG tampil 300x150 default). Aturan CSS per konteks di
   index.html hanya jaring pengaman kedua. */
var IKON = {
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
  chart: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  archive: '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  refresh: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  landmark: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2-9 5h18l-9-5z"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2"/><path d="M10 2v2"/><path d="M14 2v2"/>',
  glass: '<path d="M6 2h12l-1.5 19a2 2 0 0 1-2 1.7h-5a2 2 0 0 1-2-1.7L6 2z"/><path d="M6 8h12"/>',
  cup: '<path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L19 8"/><path d="M5 8h14"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/><path d="m12 8 1-6h2"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  filetext: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.2 3.9A2 2 0 0 0 7.52 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  barcode: '<path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  store: '<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
  out: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 9.5v4M10.2 11.8L12 13.5l1.8-1.7"/>'
};
function ikon(nama, px) {
  var p = IKON[nama] || IKON.box;
  var s = px || 20;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px">' + p + '</svg>';
}
var lastSyncAt = null;
function fmtK(n) { n = Number(n || 0); if (n >= 1000000) return (Math.round(n / 100000) / 10) + ' jt'; if (n >= 1000) return Math.round(n / 1000) + ' rb'; return String(n); }
function iconBayar(nama) {
  var n = String(nama || '').toLowerCase();
  if (n.indexOf('tunai') >= 0 || n.indexOf('cash') >= 0) return ikon('banknote', 20);
  if (n.indexOf('qris') >= 0) return ikon('phone', 20);
  if (n.indexOf('gopay') >= 0) return ikon('wallet', 20);
  if (n.indexOf('ovo') >= 0) return ikon('wallet', 20);
  if (n.indexOf('shopee') >= 0 || n.indexOf('dana') >= 0) return ikon('wallet', 20);
  if (n.indexOf('transfer') >= 0 || n.indexOf('bank') >= 0) return ikon('landmark', 20);
  if (n.indexOf('debit') >= 0 || n.indexOf('kartu') >= 0 || n.indexOf('visa') >= 0 || n.indexOf('master') >= 0) return ikon('card', 20);
  if (n.indexOf('e-money') >= 0 || n.indexOf('emoney') >= 0 || n.indexOf('flazz') >= 0) return ikon('card', 20);
  return ikon('card', 20);
}

function setModeLabel() {
  var contoh = DB.isSample;
  document.getElementById('modeLabel').textContent = contoh ? 'Mode Contoh (data demo)' : '';
  var mb = document.getElementById('modeBadge');
  mb.textContent = contoh ? 'Mode Contoh' : '';
  mb.style.display = contoh ? '' : 'none';
  var ds = document.getElementById('drawerSync');
  if (ds) {
    if (contoh) ds.innerHTML = '<b>Mode Contoh</b> — isi config.js untuk terhubung';
    else perbaruiIndikatorOffline(); // baris sync + status offline
  }
}

/* ---------- MUAT DATA / LOGIN / PERAN ---------- */
function withTimeout(promise, ms, msg) {
  return Promise.race([promise, new Promise(function (_, reject) { setTimeout(function () { reject(new Error(msg)); }, ms); })]);
}
/* ---------- POPUP NOTIF (toast modern) ----------
   Kartu notifikasi melayang di atas layar: ikon + judul + pesan, warna per jenis,
   muncul dengan animasi, hilang sendiri, ketuk ✕ untuk menutup. */
function tampilNotif(jenis, judul, pesan) {
  var wrap = document.getElementById('errBar'); if (!wrap) return;
  wrap.style.display = 'block';
  var t = document.createElement('div');
  t.className = 'toast ' + jenis;
  var ikonToast = jenis === 'error' ? '⚠' : (jenis === 'sukses' ? '✓' : 'ℹ');
  t.innerHTML = '<span class="t-ic">' + ikonToast + '</span><div class="t-body"><b>' + esc(judul) + '</b><span>' + esc(pesan) + '</span></div><button class="t-x" aria-label="Tutup" onclick="this.parentElement.remove()">✕</button>';
  wrap.appendChild(t);
  setTimeout(function () { if (t.isConnected) { t.classList.add('keluar'); setTimeout(function () { t.remove(); }, 300); } }, jenis === 'error' ? 8000 : 4500);
}
function tampilError(msg) { tampilNotif('error', 'Terjadi galat', msg); }
// Pesan info/sukses di popup notif — terlihat di layar, bukan hanya alert.
function tampilInfo(msg) { tampilNotif('sukses', 'Berhasil', msg); }
// Kartu peringatan keluar (v4-37): modal putih + ikon keluar merah + judul
// "Keluar Aplikasi?" + latar redup — bukan lagi pil teal v4-36. Hanya untuk
// keluar; toast lain tetap di atas. Kartu hilang sendiri dalam 2 detik
// (jendela tekan-kedua); pindah layar juga menyembunyikannya (show()
// memanggil sembunyiKartuKeluar).
var timerKartuKeluar = null;
function tampilKartuKeluar() {
  var k = document.getElementById('keluarCard'); if (!k) return;
  k.style.display = 'flex';
  if (timerKartuKeluar && typeof clearTimeout === 'function') { try { clearTimeout(timerKartuKeluar); } catch (e) {} }
  timerKartuKeluar = null;
  try { timerKartuKeluar = setTimeout(function () { sembunyiKartuKeluar(); }, 2000); } catch (e) {}
}
function sembunyiKartuKeluar() {
  if (timerKartuKeluar && typeof clearTimeout === 'function') { try { clearTimeout(timerKartuKeluar); } catch (e) {} }
  timerKartuKeluar = null;
  var k = document.getElementById('keluarCard'); if (k) k.style.display = 'none';
}
function sembunyiError() { var w = document.getElementById('errBar'); if (w) { w.innerHTML = ''; w.style.display = 'none'; } }
async function loadData() {
  // v4-37: pasang penjaga sejak awal (sebelum sesi/data selesai dimuat)
  // supaya tekan kembali saat loading pun tertangkap.
  if (typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat();
  try {
    // Mode Supabase: autentikasi DULU sebelum memuat data. Sebagai anon, RLS
    // menutup semua tabel (loadAll mengembalikan data kosong), jadi memuat data
    // sebelum login hanya menghasilkan layar kosong.
    if (DB.configured) {
      var sesi = null;
      try { sesi = await DB.getSessionUser(); } catch (e) { sesi = null; }
      // v4-45: sesi tersimpan kedaluwarsa — beri pesan jelas, bukan layar
      // login diam (lihat getSessionUser di supabase.js).
      if (sesi && sesi.ok === false && sesi.perluOnline) { tampilError('Sesi offline sudah kedaluwarsa — butuh internet sekali untuk perbarui sesi, lalu login kembali.'); sesi = null; }
      if (!sesi) {
        // offline tanpa sesi tersimpan — login pertama kali butuh
        // internet; beri tahu di layar login, bukan layar kosong.
        var sedangOfflineLogin = false;
        try { sedangOfflineLogin = navigator.onLine === false; } catch (e2) {}
        var ln = document.getElementById('loginOfflineNote'); if (ln) ln.style.display = sedangOfflineLogin ? '' : 'none';
        try { sessionStorage.removeItem('pos_user'); } catch (e) {}
        document.getElementById('loginBox').style.display = 'block';
        document.body.classList.add('belum-login');
        document.querySelectorAll('main section').forEach(function (s) { s.style.display = 'none'; });
        hideLoading();
        return;
      }
      currentUser = sesi;
      try { sessionStorage.setItem('pos_user', JSON.stringify(sesi)); } catch (e) {}
      document.getElementById('userLabel').textContent = '• ' + sesi.nama + (sesi.peran ? ' - ' + sesi.peran : '');
    }
    var d = await withTimeout(DB.loadAll(), 20000, 'Server tidak menjawab dalam 20 detik. Periksa koneksi internet, lalu muat ulang halaman.');
    DATA = Object.assign(DATA, d || {});
    return selesaiMuatData();
  } catch (e) {
    hideLoading();
    // belum pernah online di perangkat ini -> layar penjelasan,
    // bukan layar kosong / alert.
    if (String((e && e.message) || e) === 'OFFLINE_TANPA_SNAPSHOT') { tampilkanOfflineAwal(); return false; }
    // Timeout / koneksi putus di tengah jalan (loadAll sendiri sudah
    // mencoba snapshot) — coba sekali lagi dari salinan lokal.
    var snap = null;
    try { if (DB.muatDariSnapshot) snap = await DB.muatDariSnapshot(); } catch (e2) { snap = null; }
    if (snap) {
      DATA = Object.assign(DATA, snap);
      var okSnap = selesaiMuatData();
      if (okSnap) { tampilInfo('Mode offline — memakai salinan data terakhir di perangkat ini.'); perbaruiIndikatorOffline(); }
      return okSnap;
    }
    tampilError('Gagal memuat data: ' + e.message); return false;
  }
}
/* Layar penjelasan saat offline dan belum pernah ada snapshot. */
function tampilkanOfflineAwal() {
  var el = document.getElementById('offlineAwal'); if (el) el.style.display = '';
  var lb = document.getElementById('loginBox'); if (lb) lb.style.display = 'none';
  document.querySelectorAll('main section').forEach(function (s) { s.style.display = 'none'; });
  hideLoading();
}
/* Bagian akhir loadData (dipakai jalur online maupun snapshot offline). */
function selesaiMuatData() {
    // v4-41: kunci lapisan data ke cabang sesi + pastikan pelanggan Umum cabang sesi ada.
    // Admin tidak di-override (pakai Cabang Aktif global); hanya Kasir terkunci yang di-override.
    try { DB.setCabangSesi(cabangTerkunci() ? cabangSesiId() : cabangAktifId()); } catch (e) {}
    try { var pr = DB.pastikanUmumCabang(cabangSesiId()); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
    var p = DATA.pengaturan || {};
    document.getElementById('namaTokoHead').textContent = p.NamaToko || 'ZPOS';
    var nd = document.getElementById('namaTokoDrawer'); if (nd) nd.textContent = p.NamaToko || 'ZPOS';
    var ht = document.getElementById('heroToko'); if (ht) ht.textContent = p.NamaToko || 'ZPOS';
    document.body.classList.toggle('dark', p.ModeGelap === 'YA');
    lastSyncAt = new Date();
    setModeLabel();
    sembunyiError();
    isiPengaturanForm();
    var saved = null; try { saved = JSON.parse(sessionStorage.getItem('pos_user') || 'null'); } catch (e) { }
    // Login dilewati bila belum ada pengguna sama sekali — HANYA Mode Contoh.
    // Di Mode Supabase login selalu wajib (pengguna tidak bisa dibaca tanpa login).
    if (!DB.configured && (DATA.pengguna || []).length && !saved) {
      document.getElementById('loginBox').style.display = 'block';
      document.body.classList.add('belum-login');
      document.querySelectorAll('main section').forEach(function (s) { s.style.display = 'none'; });
      hideLoading();
      return;
    }
    currentUser = saved || currentUser;
    if (currentUser) document.getElementById('userLabel').textContent = '• ' + currentUser.nama + (currentUser.peran ? ' - ' + currentUser.peran : '');
    document.getElementById('loginBox').style.display = 'none';
    document.body.classList.remove('belum-login');
    var oa = document.getElementById('offlineAwal'); if (oa) oa.style.display = 'none';
    document.querySelectorAll('main section').forEach(function (s) { s.style.display = ''; });
    renderAll(); applyRole(); hideLoading();
    // v4-41: peringatan migrasi cabang — toast sekali per sesi (+ banner Pengaturan).
    try { peringatkanMigrasiCabangSekali(); } catch (e) {}
    // v4-35: pasang entri penjaga dashboard untuk tombol kembali Android
    // (sekali per login; panggil ulang aman karena dijaga NAV.siap).
    if (typeof pasangPenjagaRiwayat === 'function') pasangPenjagaRiwayat();
    // bila online dan ada antrean offline, sinkronkan otomatis.
    try { if (DB.configured) sinkronisasiOtomatis(); } catch (e) {}
    return true;
}
async function muatUlangManual() {
  var ok = await loadData();
  if (ok) tampilInfo('Data diperbarui • ' + (lastSyncAt ? lastSyncAt.toLocaleTimeString('id-ID') : ''));
}

/* ---------- STATUS OFFLINE + ANTREAN + SINKRONISASI OTOMATIS ----------
   Badge di header selalu menunjukkan status: "Online" (teal) atau
   "Offline — N menunggu diunggah" (kuning; merah bila ada yang gagal).
   Ketuk badge -> daftar antrean (jenis + waktu + ringkasan) dan, bila ada
   yang gagal, daftar "Gagal disinkronkan" + tombol "Coba lagi" per entri
   dan "Coba lagi semua". Sinkronisasi jalan otomatis saat event 'online'
   dan setiap kali aplikasi dibuka dalam keadaan online. */
async function perbaruiIndikatorOffline() {
  var badge = document.getElementById('offlineBadge'); if (!badge) return;
  var st = { offline: false, jumlah: 0, gagal: [] };
  try { if (DB.statusOffline) st = await DB.statusOffline(); } catch (e) {}
  var gagal = (st.gagal || []).length;
  if (st.offline) {
    badge.textContent = gagal > 0 ? ('Offline — ' + st.jumlah + ' menunggu • ' + gagal + ' gagal') : ('Offline — ' + st.jumlah + ' menunggu diunggah');
    badge.style.background = gagal > 0 ? '#dc2626' : '#d97706';
    badge.style.color = '#fff';
  } else if (st.jumlah > 0) {
    badge.textContent = 'Online — ' + st.jumlah + ' menunggu diunggah';
    badge.style.background = '#d97706';
    badge.style.color = '#fff';
  } else {
    badge.textContent = 'Online';
    badge.style.background = '';
    badge.style.color = '';
  }
  var ds = document.getElementById('drawerSync');
  if (ds && !DB.isSample) {
    ds.innerHTML = st.offline
      ? ('<b>Offline</b> — ' + st.jumlah + ' perubahan menunggu diunggah' + (gagal > 0 ? ' • ' + gagal + ' gagal' : ''))
      : ('Terhubung' + (lastSyncAt ? ' • Terakhir: ' + lastSyncAt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + (st.jumlah > 0 ? ' • ' + st.jumlah + ' menunggu diunggah' : ''));
  }
}
function fmtWaktuAntrean(iso) {
  try { var d = new Date(String(iso || '').replace(' ', 'T')); return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(iso || ''); }
}
async function tampilkanAntreanOffline() {
  var st = { offline: false, jumlah: 0, gagal: [], antrean: [] };
  try { if (DB.statusOffline) st = await DB.statusOffline(); } catch (e) {}
  var box = document.getElementById('antreanIsi'); if (!box) return;
  var antrean = st.antrean || [];
  var gagal = st.gagal || [];
  var html = '';
  if (!antrean.length) {
    html = '<p style="margin:0">' + (st.offline ? 'Sedang offline — belum ada perubahan yang menunggu diunggah.' : 'Semua perubahan sudah tersinkron ke server.') + '</p>';
  } else {
    html = '<p style="margin:0 0 4px"><b>' + antrean.length + ' perubahan menunggu diunggah</b>' + (st.offline ? ' (offline)' : '') + '</p>';
    html += antrean.map(function (e) {
      var baris = '<div style="padding:6px 0;border-top:1px solid #e2e8f0"><b>' + esc(e.ringkasan || e.jenis) + '</b><br><small style="color:#64748b">' + esc(fmtWaktuAntrean(e.dibuatPada)) + '</small>';
      if (e.galat) baris += '<br><small style="color:#dc2626">Gagal: ' + esc(e.galat) + '</small> <button class="secondary" onclick="cobaLagiSatuOffline(\'' + escJS(e.id) + '\')">Coba lagi</button>';
      return baris + '</div>';
    }).join('');
  }
  box.innerHTML = html;
  var btnSemua = document.getElementById('antreanCobaLagi');
  if (btnSemua) btnSemua.style.display = gagal.length ? '' : 'none';
  document.getElementById('antreanBackdrop').style.display = 'block';
  document.getElementById('antreanBox').style.display = 'block';
}
function tutupAntreanOffline() {
  document.getElementById('antreanBackdrop').style.display = 'none';
  document.getElementById('antreanBox').style.display = 'none';
}
async function cobaLagiSatuOffline(id) {
  try {
    var hasil = await DB.cobaLagiOutbox(id);
    if (hasil.ok) { await loadData(); tampilInfo('Sinkronisasi selesai: ' + hasil.diunggah + ' perubahan diunggah.'); tutupAntreanOffline(); }
    else tampilError('Sinkronisasi berhenti: ' + (hasil.galat || 'gagal') + ' — periksa daftar antrean.');
  } catch (e) { tampilError('Sinkronisasi gagal: ' + (e.message || e)); }
  perbaruiIndikatorOffline(); tampilkanAntreanOffline();
}
async function cobaLagiSemuaOffline() {
  try {
    var hasil = await DB.sinkronkanOutbox();
    if (hasil.ok) { await loadData(); tampilInfo('Sinkronisasi selesai: ' + hasil.diunggah + ' perubahan diunggah.'); tutupAntreanOffline(); }
    else tampilError('Sinkronisasi berhenti: ' + (hasil.galat || 'gagal') + ' — periksa daftar antrean.');
  } catch (e) { tampilError('Sinkronisasi gagal: ' + (e.message || e)); }
  perbaruiIndikatorOffline(); tampilkanAntreanOffline();
}
async function sinkronisasiOtomatis() {
  if (!currentUser) { perbaruiIndikatorOffline(); return; } // belum login: jangan sinkronkan tanpa sesi
  var st = null;
  try { if (!DB.statusOffline) return; st = await DB.statusOffline(); } catch (e) { return; }
  if (!st || !st.jumlah) { perbaruiIndikatorOffline(); return; }
  var mati = false; try { mati = navigator.onLine === false; } catch (e) {}
  if (mati) { perbaruiIndikatorOffline(); return; }
  var hasil = null;
  try { hasil = await DB.sinkronkanOutbox(); } catch (e) { tampilError('Sinkronisasi gagal: ' + (e.message || e)); perbaruiIndikatorOffline(); return; }
  if (hasil.ok) {
    await loadData();
    tampilInfo('Sinkronisasi selesai: ' + hasil.diunggah + ' perubahan diunggah.');
  } else if (hasil.galat && hasil.galat !== 'Masih offline.') {
    tampilError('Sinkronisasi berhenti: ' + hasil.galat + ' — ketuk badge status untuk melihat antrean.');
  }
  perbaruiIndikatorOffline();
}
async function doLogin() {
  var email = document.getElementById('loginEmail').value, kataSandi = document.getElementById('loginKataSandi').value;
  try {
    var res = await DB.login(email, kataSandi);
    if (!res.ok) return tampilError(res.error || 'Login gagal');
    sessionStorage.setItem('pos_user', JSON.stringify(res));
    currentUser = res;
    // v4-41: hanya Kasir yang di-override ke cabangnya; Admin override-nya
    // dikosongkan (setCabangSesi('')) supaya memakai Cabang Aktif global —
    // selesaiMuatData() nanti mengisinya dari cabangAktifId() setelah data dimuat.
    try { DB.setCabangSesi(cabangTerkunci() ? cabangSesiId() : ''); } catch (e) {}
    document.getElementById('userLabel').textContent = '• ' + res.nama + (res.peran ? ' - ' + res.peran : '');
    document.getElementById('loginBox').style.display = 'none';
    document.body.classList.remove('belum-login');
    document.querySelectorAll('main section').forEach(function (s) { s.style.display = ''; });
    // Data belum dimuat (boot berhenti di login) — muat sekarang dengan sesi Auth.
    await loadData();
  } catch (e) { tampilError('Login gagal: ' + e.message); }
}
async function logout() {
  try { await DB.logout(); } catch (e) {}
  sessionStorage.removeItem('pos_user'); currentUser = null;
  try { DB.setCabangSesi(''); } catch (e) {}
  cart = []; promoDiskon = 0; promoTerpakai = []; poinDipakai = 0; bayarManual = false;
  document.getElementById('userLabel').textContent = '';
  document.getElementById('loginEmail').value = ''; document.getElementById('loginKataSandi').value = '';
  var kb = document.getElementById('kasirBayar'); if (kb) kb.value = '';
  // v4-35: kembali ke dashboard supaya login berikutnya mulai bersih;
  // riwayat direset hanya bila layar login memang tampil (cabang demo
  // tetap di aplikasi dan penjaga riwayatnya dibiarkan aktif).
  try { show('dashboard', null); } catch (e) {}
  // Mode Supabase: login selalu wajib setelah keluar. Mode Contoh: login
  // dilewati bila belum ada pengguna sama sekali.
  if (DB.configured || (DATA.pengguna || []).length) {
    if (typeof NAV !== 'undefined') { NAV.siap = false; NAV.aktif = null; NAV.tumpuk = []; NAV.keluarDalam = 0; NAV.izinKeluar = false; NAV.mundurProgram = false; }
    document.getElementById('loginBox').style.display = 'block';
    document.body.classList.add('belum-login');
    document.querySelectorAll('main section').forEach(function (s) { s.style.display = 'none'; });
  } else {
    document.getElementById('loginBox').style.display = 'none';
    document.body.classList.remove('belum-login');
    document.querySelectorAll('main section').forEach(function (s) { s.style.display = ''; });
    renderAll(); applyRole();
  }
}
function applyRole() {
  document.querySelectorAll('nav button.menu').forEach(function (b) { b.style.display = ''; });
  ['cardPemilik', 'cardTarget', 'cardStokTipis'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; });
  terapkanModeMeja();
  terapkanKunciCabang();
  if (!currentUser || currentUser.peran === 'Admin') return;
  var allowed = ['dashboard', 'kasir', 'pelanggan'];
  document.querySelectorAll('nav button.menu').forEach(function (b) {
    var sec = b.getAttribute('data-sec') || '';
    if (!sec) return;
    if (allowed.indexOf(sec) < 0) b.style.display = 'none';
  });
  document.querySelectorAll('#bottomNav button').forEach(function (b) {
    var sec = b.getAttribute('data-sec') || '';
    if (sec && allowed.indexOf(sec) < 0) b.style.display = 'none';
  });
  // Kartu pemilik disembunyikan dari Kasir (Target Harian, Dashboard Pemilik, Stok Menipis).
  ['cardPemilik', 'cardTarget', 'cardStokTipis'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
  if (!izinAktif('diskon')) { var d = document.getElementById('kasirDiskon'); if (d) d.disabled = true; }
}
function isiPengaturanForm() {
  var p = DATA.pengaturan || {};
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); };
  set('sNama', p.NamaToko); set('sAlamat', p.AlamatToko); set('sTelp', p.TeleponToko); setUang('sTarget', targetHarianEfektif());
  set('sSlogan', p.SloganToko);
  set('sKota', p.KotaToko); set('sFooter', p.FooterStruk || 'Terima kasih');
  set('sWa', p.NomorPemilikWA); set('sJatuhTempo', p.JatuhTempoHari || 7); set('sPoinPer', p.PoinPerRupiah || 1000); set('sPoinRate', p.PoinTukarRate || 100);
  set('sPajakPersen', p.PajakPersen || 0); set('sBahasa', p.Bahasa || 'id'); set('sFormatTanggal', p.FormatTanggal || 'dd-mm-yyyy');
  set('sPoinAktif', p.PoinAktif || 'YA'); set('sPajakAktif', p.PajakAktif || 'TIDAK'); set('sGelap', p.ModeGelap || 'TIDAK');
  set('sPoinStruk', p.TampilkanPoinStruk || 'YA'); set('sWatermark', p.WatermarkStruk || 'TIDAK'); set('sKertas', p.StrukUkuranKertas || '58');
  set('sMeja', p.ModeMejaAktif || 'TIDAK'); set('sPromo', p.PromoAktif || 'YA'); set('sMultiCabang', p.MultiCabangAktif || 'YA');
  logoDataUrl = p.LogoToko || ''; logo2DataUrl = p.Logo2 || ''; watermarkDataUrl = p.Watermark || ''; tampilLogoPreview();
  terapkanModeMeja();
  var cb = document.getElementById('sCabangAktif');
  cb.innerHTML = (DATA.cabang || []).map(function (c) { return '<option value="' + esc(c.ID) + '"' + (String(c.ID) === String(cabangTerkunci() ? cabangSesiId() : p.CabangAktif) ? ' selected' : '') + '>' + esc(c.Nama) + '</option>'; }).join('');
  terapkanKunciCabang();
  tampilkanBannerMigrasi();
  pratinjauProfil();
}
/* v4-41: kunci cabang HANYA untuk Kasir (cabangTerkunci) — select
   #sCabangAktif di-disable + keterangan "Terkunci ke cabang Anda" hanya
   untuk Kasir terkunci. Admin selalu bisa mengganti Cabang Aktif. */
function terapkanKunciCabang() {
  var cb = document.getElementById('sCabangAktif');
  if (cb) cb.disabled = cabangTerkunci();
  var ket = document.getElementById('sCabangTerkunciKet');
  if (ket) ket.style.display = cabangTerkunci() ? '' : 'none';
}
/* Mode Meja: menu Meja & Dapur + pilihan meja di kasir hanya tampil bila ModeMejaAktif = YA (restoran). Toko kelontong (TIDAK) tidak melihatnya; restoran tinggal mengaktifkan di Pengaturan. */
function terapkanModeMeja() {
  var aktif = (DATA.pengaturan || {}).ModeMejaAktif === 'YA';
  var m = document.getElementById('menuMeja'); if (m) m.style.display = aktif ? '' : 'none';
  var k = document.getElementById('kasirMejaWrap'); if (k) k.style.display = aktif ? '' : 'none';
  if (!aktif) { var s = document.getElementById('meja'); if (s && s.classList.contains('active')) show('dashboard', document.querySelector('nav button.menu[data-sec="dashboard"]')); }
}
/* Pratinjau struk langsung dari isi Profil Toko — contoh transaksi, bukan data asli. */
function pratinjauProfil() {
  var el = document.getElementById('profilPreview');
  if (!el) return;
  var p = DATA.pengaturan || {};
  var d = {
    toko: document.getElementById('sNama').value || 'ZPOS',
    slogan: document.getElementById('sSlogan').value || '',
    alamat: document.getElementById('sAlamat').value || '',
    kota: document.getElementById('sKota').value || '',
    telepon: document.getElementById('sTelp').value || '',
    footer: document.getElementById('sFooter').value || 'Terima kasih',
    logo: logoDataUrl || p.LogoToko || '', logo2: logo2DataUrl || p.Logo2 || '', watermark: watermarkDataUrl || p.Watermark || '',
    tanggal: new Date(), nomor: 8, kode: 'ABCC9B', pelanggan: 'Shopee', kasir: 'Admin', metode: 'Tunai',
    items: [{ nama: 'Bakwan beku 250gr', qty: 1, harga: 1000, subtotal: 1000 }, { nama: 'Buku gambar', qty: 1, harga: 1000, subtotal: 1000 }, { nama: 'Buku tulis', qty: 1, harga: 1000, subtotal: 1000 }],
    rincian: [], total: 3000, bayar: 3000, kembali: 0, sisa: 0, status: 'Lunas', catatan: '', poin: '', rugi: false
  };
  el.innerHTML = strukHtml(d);
}

/* ---------- CODE39 (tanpa library) ---------- */
var CODE39 = { '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn', '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn' };
function gambarBarcode(canvas, teks) {
  var ctx = canvas.getContext('2d'); var s = '*' + String(teks || '').toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '') + '*';
  var x = 0; var i, j, ch, pat, w;
  for (i = 0; i < s.length; i++) { ch = s.charAt(i); pat = CODE39[ch] || CODE39['-']; for (j = 0; j < 9; j++) { w = (pat.charAt(j) === 'w') ? 6 : 2; if (j % 2 === 0) { ctx.fillStyle = '#000'; ctx.fillRect(x, 0, w, 50); } x += w + 1; } x += 3; }
  canvas.width = x; canvas.height = 50;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
  x = 0;
  for (i = 0; i < s.length; i++) { ch = s.charAt(i); pat = CODE39[ch] || CODE39['-']; for (j = 0; j < 9; j++) { w = (pat.charAt(j) === 'w') ? 6 : 2; if (j % 2 === 0) { ctx.fillRect(x, 0, w, 50); } x += w + 1; } x += 3; }
}

/* ---------- RENDER UTAMA ---------- */
/* 13 tombol pintas, dikelompokkan (dulu dua grid duplikat: Menu Utama + Jalan Pintas). */
var SHORTCUT_GROUPS = [
  ['Jualan', [['kasir', ikon('cart', 20) + ' Transaksi Baru', 'primary'], ['cepat', ikon('zap', 20) + ' Transaksi Cepat']]],
  ['Barang', [['produk', ikon('box', 20) + ' Produk'], ['stok', ikon('chart', 20) + ' Stok'], ['katalog', ikon('book', 20) + ' Katalog'], ['master', ikon('archive', 20) + ' Master']]],
  ['Uang', [['pembelian', ikon('bag', 20) + ' Pembelian'], ['pengeluaran', ikon('out', 20) + ' Pengeluaran'], ['aruskas', ikon('refresh', 20) + ' Arus Kas'], ['utang', ikon('card', 20) + ' Utang']]],
  ['Laporan', [['laporan', ikon('trend', 20) + ' Laporan'], ['pelanggan', ikon('users', 20) + ' Pelanggan'], ['pengaturan', ikon('gear', 20) + ' Pengaturan']]]
];
/* v4-41: kartu Stok Menipis ringkas — maks 5 paling kritis (stok menaik),
   ringkasan "X habis • Y menipis", badge jumlah, tombol Lihat semua bila > 5.
   Data (stokTipisList) tidak diubah; pengurutan hanya saat render. */
/* ---------- KARTU DASHBOARD PROFESIONAL (v4-41) ----------
   Pola sama seperti renderStokTipis: maks 5 baris, data & logika tidak
   diubah — hanya tampilan. Peringkat 1–5: badge teal untuk #1, netral
   untuk #2–5; nama kiri, nilai rata kanan; garis pemisah halus antar
   baris (CSS .rank-row di index.html). Target Harian: progress bar +
   persen + sisa target; bila belum ada target, tombol ke Pengaturan. */
function renderTerlaris(r) {
  var box = document.getElementById('terlaris'); if (!box) return;
  var list = (r.terlaris || []).slice(0, 5);
  if (!list.length) { box.innerHTML = '<div class="rank-kosong">Belum ada penjualan.</div>'; return; }
  box.innerHTML = list.map(function (x, i) {
    var rank = i + 1;
    return '<div class="rank-row"><span class="rank-badge' + (rank === 1 ? ' rank-1' : '') + '">' + rank + '</span><span class="rank-nama">' + esc(x.nama) + '</span><span class="rank-nilai">' + (x.qty || 0) + ' terjual</span></div>';
  }).join('');
}
function renderPelangganTop(r) {
  var box = document.getElementById('pelangganTop'); if (!box) return;
  var list = (r.pelangganTop || []).slice(0, 5);
  if (!list.length) { box.innerHTML = '<div class="rank-kosong">Belum ada data.</div>'; return; }
  box.innerHTML = list.map(function (x, i) {
    var rank = i + 1;
    return '<div class="rank-row"><span class="rank-badge' + (rank === 1 ? ' rank-1' : '') + '">' + rank + '</span><span class="rank-nama">' + esc(x.nama) + '</span><span class="rank-nilai">' + rp(x.total) + '</span></div>';
  }).join('');
}
function renderTargetHarian(r) {
  var box = document.getElementById('targetBox'); if (!box) return;
  var target = targetHarianEfektif();
  if (!(target > 0)) {
    box.innerHTML = '<div class="rank-kosong">Belum ada target harian.</div><button class="primary" style="width:100%;margin-top:10px" onclick="go(\'pengaturan\');setTimeout(function(){var el=document.getElementById(\'sTarget\');if(el)el.focus();},100)">Atur Target Omzet Harian</button>';
    return;
  }
  var tercapai = Number(r.omzetHariIni || 0);
  var pct = Math.round(tercapai / target * 100);
  var sisa = Math.max(0, target - tercapai);
  box.innerHTML = '<div class="target-angka"><span>Tercapai <b>' + rp(tercapai) + '</b> dari ' + rp(target) + '</span><b class="target-persen">' + pct + '%</b></div>'
    + '<div class="target-bar"><div class="target-isi" style="width:' + Math.min(100, pct) + '%"></div></div>'
    + '<div class="target-sisa">' + (sisa > 0 ? 'Kurang ' + rp(sisa) + ' lagi' : 'Target tercapai!') + '</div>';
}
function renderStokTipis(r) {
  var box = document.getElementById('stokTipis');
  var badge = document.getElementById('stokTipisBadge');
  var list = (r.stokTipisList || []).slice().sort(function (a, b) { return Number(a.stok || 0) - Number(b.stok || 0); });
  var total = list.length;
  if (badge) { badge.style.display = total > 0 ? 'inline-block' : 'none'; if (total > 0) badge.textContent = total + ' produk'; }
  if (!total) { box.innerHTML = 'Semua stok aman.'; return; }
  var habis = 0; list.forEach(function (p) { if (Number(p.stok || 0) <= 0) habis++; });
  var html = '<div style="font-size:13px;color:#64748b;margin-bottom:8px">' + habis + ' habis • ' + (total - habis) + ' menipis</div>';
  html += list.slice(0, 5).map(function (p) {
    var s = Number(p.stok || 0);
    var sisa = 'sisa ' + s + ' ' + (p.satuan || '');
    if (s <= 0) return esc(p.nama) + ' — ' + sisa + ' <b style="color:#dc2626">Habis</b>';
    return esc(p.nama) + ' — <span style="color:#b45309">' + sisa + '</span>';
  }).join('<br>');
  if (total > 5) html += '<button class="primary" style="width:100%;margin-top:10px" onclick="go(\'stok\')">Lihat semua (' + total + ' produk)</button>';
  box.innerHTML = html;
}
function renderAll() {
  var r = DATA.ringkasan || {};
  document.getElementById('heroOmzet').textContent = rp(r.omzetHariIni);
  var kem = Number(r.omzetKemarin || 0), kini = Number(r.omzetHariIni || 0);
  var pct = kem > 0 ? Math.round((kini - kem) / kem * 100) : (kini > 0 ? 100 : 0);
  var vsEl = document.getElementById('heroOmzetVs');
  vsEl.textContent = (pct >= 0 ? '+' : '') + pct + '% vs kemarin';
  vsEl.classList.toggle('down', pct < 0);
  document.getElementById('heroUser').textContent = currentUser ? ('Halo, ' + currentUser.nama + ' — selamat berjualan hari ini.') : 'Selamat berjualan hari ini.';
  var dr = document.getElementById('drawerStoreRole'); if (dr) dr.textContent = currentUser ? (currentUser.nama + ' • v4-46') : 'Kasir • v4-46';
  var bb = document.getElementById('bellBadge');
  if (bb) { var sm = Number(r.stokMenipis || 0); bb.style.display = sm > 0 ? 'flex' : 'none'; bb.textContent = sm > 99 ? '99+' : String(sm); }
  isiNotifPanel();
  document.getElementById('statTiles').innerHTML = [
    [ikon('cart', 20), 'Transaksi', r.jumlahTrxHariIni || 0], [ikon('box', 20), 'Produk', (DATA.produk || []).filter(function (p) { return produkAktif(p) && milikCabangSesi(p); }).length],
    [ikon('alert', 20), 'Stok Menipis', r.stokMenipis || 0], [ikon('users', 20), 'Pelanggan', (DATA.pelanggan || []).filter(milikCabangSesi).length]
  ].map(function (x) { return '<div class="tile"><span class="tile-ic">' + x[0] + '</span><span>' + x[1] + '</span><b>' + x[2] + '</b></div>'; }).join('');
  document.getElementById('menuKelompok').innerHTML = SHORTCUT_GROUPS.map(function (g) {
    return '<div class="shortcut-group"><h4 style="margin:12px 0 6px">' + esc(g[0]) + '</h4><div class="shortcut-grid">' + g[1].map(function (s) {
      return '<button class="' + (s[2] || 'secondary') + '" onclick="go(\'' + s[0] + '\')">' + s[1] + '</button>';
    }).join('') + '</div></div>';
  }).join('');
  document.getElementById('stats').innerHTML = [
    ['Omzet Hari Ini', rp(r.omzetHariIni)], ['Laba Hari Ini', rp(r.labaHariIni)],
    ['Dibayar Hari Ini', rp(r.dibayarHariIni)], ['Transaksi Hari Ini', r.jumlahTrxHariIni || 0],
    ['Piutang (Belum Lunas)', rp(r.piutang)], ['Hutang ke Pemasok', rp(r.hutang)],
    ['Saldo Kas', rp(r.saldoKas)], ['Stok Menipis', r.stokMenipis || 0]
  ].map(function (x) { return '<div class="card stat"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
  renderTerlaris(r);
  renderPelangganTop(r);
  renderStokTipis(r);
  document.getElementById('kedaluwarsaBox').innerHTML = ((r.kedaluwarsaList || []).map(function (b) { return esc(b.nama || b.NamaProduk || '') + ' — kedaluwarsa ' + (b.Kedaluwarsa || ''); }).join('<br>')) || 'Tidak ada batch mendekati kedaluwarsa.';
  renderTargetHarian(r);
  var a7 = r.analitik7 || {}, a28 = r.analitik28 || {};
  document.getElementById('analitikBox').innerHTML = '7 hari: omzet ' + rp(a7.omzet) + ' • laba ' + rp(a7.laba) + ' • ' + (a7.jumlah || 0) + ' transaksi<br>28 hari: omzet ' + rp(a28.omzet) + ' • laba ' + rp(a28.laba) + ' • ' + (a28.jumlah || 0) + ' transaksi';
  var perHari = a7.perHari || [];
  var max = 1; perHari.forEach(function (x) { if (x.omzet > max) max = x.omzet; });
  var cy = document.getElementById('chartY');
  if (cy) cy.innerHTML = '<span>' + fmtK(max) + '</span><span>' + fmtK(Math.round(max / 2)) + '</span><span>0</span>';
  document.getElementById('chart7').innerHTML = '<div class="chartbar">' + perHari.map(function (d) {
    var h = Math.max(3, Math.round(d.omzet / max * 100));
    return '<div class="chartcol"><div class="bar" style="height:' + h + '%"></div><small>' + esc(String(d.tanggal).slice(5)) + '</small></div>';
  }).join('') + '</div>';
  var cbSel = document.getElementById('cabangPilih');
  cbSel.innerHTML = '<option value="">Semua Cabang (gabungan)</option>' + (DATA.cabang || []).map(function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; }).join('');
  cbSel.value = cabangDashboardDipilih || '';
  var perCabangTampil = (r.perCabang || []).filter(function (c) { return !cabangDashboardDipilih || String(c.cabangId) === String(cabangDashboardDipilih); });
  document.getElementById('perCabangBox').innerHTML = perCabangTampil.map(function (c) {
    return '<div class="cart-item"><span><b>' + esc(c.nama) + '</b><br><small>' + (c.jumlahTrx || 0) + ' transaksi • Stok menipis ' + (c.stokMenipis || 0) + '</small></span><span style="text-align:right">Omzet <b>' + rp(c.omzetHariIni) + '</b><br><small>Laba ' + rp(c.labaHariIni) + '</small></span></div>';
  }).join('') || 'Belum ada cabang.';
  renderProdukKasir(); renderCart(); renderProdukTable(); renderTrx(); renderPelanggan(); renderPembelian(); renderKeuangan(); renderLaporan(); renderBahan(); renderPengguna(); renderCepat(); renderUtang(); renderMeja(); renderKatalog(); renderPromo(); renderMaster(); renderDapur(); renderWinback(); renderUlangTahun(); renderStok(); renderLaporanPremium();
  isiSelectKasir(); isiSelectLain();
}
// v4-45: pilihan cabang Dashboard Pemilik benar-benar memfilter rekap
// (dulu dropdown tidak dibaca — selalu tampil semua cabang).
var cabangDashboardDipilih = '';
function gantiCabangDashboard() { var s = document.getElementById('cabangPilih'); cabangDashboardDipilih = s ? (s.value || '') : ''; renderAll(); }
function isiSelectKasir() {
  var sel = document.getElementById('kasirPelanggan');
  sel.innerHTML = '<option>Umum</option>' + (DATA.pelanggan || []).filter(function (p) { return milikCabangSesi(p) && p.Nama !== 'Umum'; }).map(function (p) { return '<option value="' + esc(p.Nama) + '">' + esc(p.Nama) + ' (Poin ' + (p.Poin || 0) + ' • ' + (p.Tier || '—') + ')</option>'; }).join('');
  var mj = document.getElementById('kasirMeja');
  mj.innerHTML = '<option value="">— Tanpa meja —</option>' + (DATA.meja || []).filter(function (m) { return milikCabangSesi(m) && m.Status !== 'Terisi'; }).map(function (m) { return '<option>' + esc(m.Nama) + '</option>'; }).join('');
  var mt = document.getElementById('kasirMetode');
  var jb = (DATA.jenisBayar || []).filter(function (j) { return produkAktif(j); });
  mt.innerHTML = (jb.length ? jb : [{ Nama: 'Tunai' }]).map(function (j) { return '<option>' + esc(j.Nama) + '</option>'; }).join('');
  pelangganDipilih();
}
function isiSelectLain() {
  var opt = function (arr, fn) { return (arr || []).map(fn).join(''); };
  document.getElementById('resepProduk').innerHTML = opt((DATA.produk || []).filter(milikCabangSesi), function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + '</option>'; });
  document.getElementById('resepBahan').innerHTML = opt(DATA.bahan, function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + ' (' + (p.Satuan || '') + ')</option>'; });
  document.getElementById('pgKategori').innerHTML = opt(DATA.itemPengeluaran.length ? DATA.itemPengeluaran : [{ Nama: 'Lainnya' }], function (p) { return '<option>' + esc(p.Nama) + '</option>'; });
  document.getElementById('opProduk').innerHTML = opt((DATA.produk || []).filter(milikCabangSesi), function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + ' — stok sistem ' + stokProduk(p) + '</option>'; });
  document.getElementById('cicilUtangId').innerHTML = opt(DATA.utang.filter(function (u) { return u.Status !== 'Lunas' && milikCabangSesiUtang(u); }), function (u) { return '<option value="' + esc(u.ID) + '">' + esc(u.ID) + ' — ' + esc(u.Pemasok) + ' — sisa ' + rp(u.Sisa) + '</option>'; });
  document.getElementById('poinPelanggan').innerHTML = opt((DATA.pelanggan || []).filter(milikCabangSesi), function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + ' (Poin ' + (p.Poin || 0) + ')</option>'; });
  document.getElementById('tagihanPelanggan').innerHTML = opt((DATA.pelanggan || []).filter(milikCabangSesi), function (p) { return '<option>' + esc(p.Nama) + '</option>'; });
  document.getElementById('lapCabang').innerHTML = '<option value="">Semua cabang</option>' + opt(DATA.cabang, function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; });
  document.getElementById('lbCabang').innerHTML = '<option value="">Semua cabang</option>' + opt(DATA.cabang, function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; });
  document.getElementById('uCabang').innerHTML = '<option value="">— Semua cabang —</option>' + opt(DATA.cabang, function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; });
  document.getElementById('cabangTable').innerHTML = '<table><tr><th>Nama</th><th>Alamat</th><th></th></tr>' + opt(DATA.cabang, function (c) { return '<tr><td>' + esc(c.Nama) + '</td><td>' + esc(c.Alamat || '') + '</td><td>' + (cabangTerkunci() ? '' : '<button class="secondary" onclick="setCabangAktif(\'' + esc(c.ID) + '\')">Jadikan Aktif</button> ') + '<button class="danger" onclick="hapusCabang(\'' + esc(c.ID) + '\', this)">Hapus</button></td></tr>'; }) + '</table>';
  renderTerjemahanBox(); renderIzinBox(); renderLabelList();
}
function renderTerjemahanBox() {
  var istilah = ['Kasir', 'Pelanggan', 'Lunas', 'Kurang', 'Belum Dibayar', 'Total', 'Subtotal', 'Kembali', 'Proses', 'Selesai', 'Diambil', 'Antri'];
  document.getElementById('terjemahanBox').innerHTML = istilah.map(function (k) { var v = (DATA.terjemahan || {})[k] || k; return '<label>' + esc(k) + ' <input id="tr_' + esc(k.replace(/ /g, '_')) + '" value="' + esc(v) + '"></label>'; }).join('');
}
var IZIN_KEYS = [['diskon', 'Boleh memberi diskon'], ['ubahProduk', 'Boleh tambah/ubah produk'], ['sembunyikanHPP', 'Sembunyikan harga pokok'], ['ubahBahan', 'Boleh tambah/ubah bahan baku'], ['aksesPengeluaran', 'Boleh akses Pengeluaran'], ['aksesArusKas', 'Boleh akses Arus Kas'], ['aksesUtang', 'Boleh akses Utang'], ['aksesPembelian', 'Akses Pembelian'], ['tambahStok', 'Tambah stok'], ['kurangStok', 'Mengurangi stok'], ['barangMasuk', 'Akses barang masuk'], ['retur', 'Retur transaksi'], ['batalTransaksi', 'Membatalkan transaksi'], ['tambahItemLama', 'Tambah item di transaksi lama'], ['lapPenjualan', 'Laporan penjualan'], ['lapStok', 'Laporan stok'], ['lapPiutang', 'Laporan piutang'], ['lapPembayaran', 'Laporan pembayaran'], ['lapPengeluaran', 'Laporan pengeluaran'], ['laporBos', 'Lapor Bos']];
function renderIzinBox() {
  document.getElementById('izinBox').innerHTML = IZIN_KEYS.map(function (k) { return '<label class="checkrow"><input type="checkbox" id="iz_' + k[0] + '" checked> ' + k[1] + '</label>'; }).join('');
}
function renderLabelList() {
  document.getElementById('labelList').innerHTML = (DATA.produk || []).filter(milikCabangSesi).map(function (p) { return '<label class="checkrow"><input type="checkbox" class="labelChk" value="' + esc(p.ID) + '"> ' + esc(p.Nama) + ' (' + esc(p.SKU || p['SKU/Barcode'] || p.ID) + ')</label>'; }).join('');
}
function setModeKasir(mode) {
  document.getElementById('pillReguler').classList.toggle('active', mode === 'reguler');
  document.getElementById('pillCepat').classList.toggle('active', mode === 'cepat');
  document.getElementById('kasirReguler').style.display = mode === 'reguler' ? '' : 'none';
  document.getElementById('kasirCepat').style.display = mode === 'cepat' ? '' : 'none';
  if (mode === 'cepat') renderCepatKasir();
}
function renderCepatKasir() {
  document.getElementById('cepatListKasir').innerHTML = (DATA.transaksiCepat || []).filter(milikCabangSesi).map(function (c) {
    var items = []; try { items = JSON.parse(c.ItemsJSON || '[]'); } catch (e) { }
    return '<div class="cart-item"><span><b>' + esc(c.Nama) + '</b> — ' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '</span><span><button class="primary" onclick="muatCepat(\'' + esc(c.ID) + '\')">Muat ke Kasir</button></span></div>';
  }).join('') || 'Belum ada template Transaksi Cepat.';
}

/* ---------- KASIR ---------- */
/* Thumbnail produk kasir/katalog: pemetaan kata kunci dipertahankan
   (kopi/teh/buku/pensil/baju/sabun/makan/minum/ongkir), hanya bentuknya
   yang berubah dari emoji menjadi SVG outline. */
function emojiProduk(nama) {
  var n = (nama || '').toLowerCase();
  if (n.indexOf('kopi') >= 0) return ikon('coffee', 20);
  if (n.indexOf('teh') >= 0) return ikon('glass', 20);
  if (n.indexOf('buku') >= 0) return ikon('book', 20);
  if (n.indexOf('pensil') >= 0 || n.indexOf('pulpen') >= 0) return ikon('pencil', 20);
  if (n.indexOf('baju') >= 0) return ikon('shirt', 20);
  if (n.indexOf('sabun') >= 0 || n.indexOf('deterjen') >= 0) return ikon('droplet', 20);
  if (n.indexOf('makan') >= 0 || n.indexOf('bakwan') >= 0 || n.indexOf('nasi') >= 0) return ikon('utensils', 20);
  if (n.indexOf('minum') >= 0 || n.indexOf('jus') >= 0) return ikon('cup', 20);
  if (n.indexOf('ongkir') >= 0) return ikon('truck', 20);
  return ikon('box', 20);
}
/* v4-38: foto produk — tampilkan gambar bila ada, ikon bila tidak/rusak.
   Dipakai kasir (.prod-thumb) dan katalog (inline kecil). */
function adaGambarProduk(p) { var u = (p && p.GambarURL) || ''; return typeof u === 'string' && u.trim() !== ''; }
function gagalGambar(el, nama) { // onerror: ganti <img> rusak dengan ikon
  try { var s = document.createElement('span'); s.innerHTML = emojiProduk(nama); var ic = s.firstChild; if (ic && el.parentNode) el.parentNode.replaceChild(ic, el); } catch (e) { if (el) el.style.display = 'none'; }
}
function imgProduk(p, kelas) {
  return '<img src="' + esc(p.GambarURL) + '" class="' + (kelas || 'prod-img') + '" alt="" onerror="gagalGambar(this,\'' + escJS(p.Nama) + '\')">';
}
function thumbProduk(p) { return adaGambarProduk(p) ? imgProduk(p, 'prod-img') : emojiProduk(p.Nama); }
function ikonAtauGambarKatalog(p) { return adaGambarProduk(p) ? imgProduk(p, 'kat-thumb') : emojiProduk(p.Nama); }
function renderProdukKasir() {
  var q = (document.getElementById('cariProduk').value || '').toLowerCase();
  document.getElementById('produkKasir').innerHTML = (DATA.produk || []).filter(function (p) { return milikCabangSesi(p) && produkAktif(p) && (!q || (p.Nama || '').toLowerCase().indexOf(q) >= 0 || String(p.SKU || p['SKU/Barcode'] || '').toLowerCase().indexOf(q) >= 0); })
    .map(function (p) {
      var diKeranjang = 0; cart.forEach(function (x) { if (x.id === p.ID) diKeranjang += x.Qty; });
      var stok = stokProduk(p);
      var habis = lacakStok(p) && stok <= 0 && diKeranjang === 0;
      var kanan = habis
        ? '<span style="color:#94a3b8;font-size:13px;font-weight:600">Habis</span>'
        : diKeranjang > 0
        ? '<span class="qty-ctl"><button onclick="event.stopPropagation();ubahQtyKasir(\'' + esc(p.ID) + '\',-1)">−</button><b class="qty-badge">' + fmtQty(diKeranjang) + '</b><button onclick="event.stopPropagation();ubahQtyKasir(\'' + esc(p.ID) + '\',1)">+</button></span>'
        : '<button class="qty-add" onclick="event.stopPropagation();addToCart(\'' + esc(p.ID) + '\')">+</button>';
      return '<div class="prod-row"' + (habis ? '' : ' onclick="addToCart(\'' + esc(p.ID) + '\')"') + '><span style="display:flex;gap:10px;align-items:center"><span class="prod-thumb">' + thumbProduk(p) + '</span><span><b>' + esc(p.Nama) + '</b><br><small class="price">' + rp(p.HargaJual) + '</small><br><small class="' + (stok <= 0 ? 'red' : '') + '">Stok: ' + stok + '</small></span></span>' + kanan + '</div>';
    }).join('') || 'Produk tidak ditemukan.';
}
// v4-45: satuan desimal — qty pecahan di kasir (0,1 per ketuk).
// Satuan produk dicocokkan ke master Satuan lewat Nama/Singkatan.
function satuanDesimal(namaSatuan) {
  var s = String(namaSatuan || '').trim().toLowerCase();
  if (!s) return false;
  return (DATA.satuan || []).some(function (x) {
    if (!(x.Desimal === true || x.Desimal === 'YA')) return false;
    return String(x.Nama || '').trim().toLowerCase() === s || String(x.Singkatan || '').trim().toLowerCase() === s;
  });
}
function langkahQtyProduk(p) { return (p && satuanDesimal(p.Satuan)) ? 0.1 : 1; }
function fmtQty(q) { return String(Math.round(Number(q || 0) * 10) / 10); }
function ubahQtyKasir(id, delta) {
  var it = cart.find(function (x) { return x.id === id && !x.satuanDipakai; });
  if (!it && delta > 0) { addToCart(id); return; }
  if (!it) return;
  var p0 = DATA.produk.find(function (x) { return x.ID === id; });
  var langkah = langkahQtyProduk(p0);
  if (delta > 0) {
    var p = p0;
    var termasukStok = p ? lacakStok(p) : false;
    if (p && termasukStok && stokProduk(p) - it.Qty < langkah) { return tampilError('Stok produk tidak mencukupi: ' + p.Nama); }
  }
  it.Qty = Math.round((it.Qty + delta * langkah) * 10) / 10;
  // Hitung ulang harga tier (dulu tidak dihitung ulang di sini).
  var pp = DATA.produk.find(function (x) { return x.ID === id; });
  if (pp && !it.hargaLainLabel) it.Harga = hargaJumlahOtomatis(pp, it.Qty);
  if (it.Qty <= 0) cart.splice(cart.indexOf(it), 1);
  renderCart();
}
function hargaJumlahOtomatis(p, qty) {
  var hj = []; try { hj = JSON.parse(p.HargaJumlahJSON || '[]'); } catch (e) { hj = []; }
  var harga = Number(p.HargaJual); var cocok = null;
  hj.forEach(function (h) { if (qty >= Number(h.minQty)) cocok = h; });
  if (cocok) return Number(cocok.harga) / Number(cocok.minQty);
  return harga;
}
function addToCart(id, hargaOverride, satuanDipakai) {
  var p = DATA.produk.find(function (x) { return x.ID === id; }); if (!p) return;
  var termasukStok = lacakStok(p);
  var diKeranjang = 0; cart.forEach(function (x) { if (x.id === id) diKeranjang += x.Qty; });
  var langkahTambah = langkahQtyProduk(p);
  if (termasukStok && stokProduk(p) - diKeranjang < langkahTambah) { return tampilError('Stok produk tidak mencukupi: ' + p.Nama); }
  var it = cart.find(function (x) { return x.id === id && !x.satuanDipakai; });
  if (it && !satuanDipakai) { it.Qty = Math.round((it.Qty + langkahTambah) * 10) / 10; it.Harga = hargaJumlahOtomatis(p, it.Qty); }
  else {
    var harga = hargaOverride != null ? hargaOverride : Number(p.HargaJual);
    cart.push({ id: p.ID, nama: p.Nama, Harga: harga, modal: Number(p.HargaModal || 0), Qty: 1, diskonItem: 0, satuanDipakai: satuanDipakai || '', hargaLainLabel: '' });
    // Harga tier diterapkan ke baris yang BARU ditambah (dulu ke baris
    // terakhir keranjang — item lama yang bukan terakhir tidak pernah kena tier).
    var nb = cart[cart.length - 1];
    if (nb && nb.id === id) nb.Harga = hargaJumlahOtomatis(p, nb.Qty);
  }
  renderCart();
}
function pilihHargaLain(idx) {
  var it = cart[idx]; var p = DATA.produk.find(function (x) { return x.ID === it.id; }); if (!p) return;
  var hl = []; try { hl = JSON.parse(p.HargaLainJSON || '[]'); } catch (e) { hl = []; }
  if (!hl.length) return tampilError('Produk ini tidak punya Harga Lain.');
  var pilihan = hl.map(function (h, i) { return (i + 1) + '. ' + h.label + ' — ' + rp(h.harga); }).join('\n');
  var n = prompt('Pilih Harga Lain:\n' + pilihan + '\n\nKetik nomornya:', '1'); if (!n) return;
  var h = hl[Number(n) - 1]; if (!h) return;
  it.Harga = Number(h.harga); it.hargaLainLabel = h.label; renderCart();
}
function pilihVarian(idx) {
  var it = cart[idx]; var p = DATA.produk.find(function (x) { return x.ID === it.id; }); if (!p) return;
  var vr = []; try { vr = JSON.parse(p.VarianJSON || '[]'); } catch (e) { vr = []; }
  if (!vr.length) return tampilError('Produk ini tidak punya Satuan Varian.');
  var pilihan = vr.map(function (v, i) { return (i + 1) + '. 1 ' + v.label + ' = ' + v.isi + ' pcs — ' + rp(v.harga); }).join('\n');
  var n = prompt('Pilih Satuan Varian:\n' + pilihan + '\n\nKetik nomornya:', '1'); if (!n) return;
  var v = vr[Number(n) - 1]; if (!v) return;
  it.Harga = Number(v.harga) / Number(v.isi); it.satuanDipakai = v.label; it.nama = p.Nama + ' (' + v.label + ')'; renderCart();
}
function ubahDiskonItem(idx) {
  var it = cart[idx]; var v = prompt('Diskon per item (Rp) untuk ' + it.nama + ':', String(it.diskonItem || 0)); if (v === null) return;
  it.diskonItem = Math.max(0, Number(v) || 0); renderCart();
}
function pelangganDipilih() {
  var nama = document.getElementById('kasirPelanggan').value;
  var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === nama; });
  var info = document.getElementById('kasirPelangganInfo');
  if (!pl) { info.textContent = ''; document.getElementById('poinBox').textContent = ''; return; }
  var tier = (DATA.tier || []).find(function (t) { return t.Tier === (pl.Tier || ''); });
  info.textContent = 'Poin: ' + (pl.Poin || 0) + ' • Tier: ' + (pl.Tier || '—') + (tier ? ' (diskon ' + tier.DiskonPersen + '%)' : '') + ' • Total beli: ' + rp(pl.TotalBeli || 0) + ' • Piutang: ' + rp(pl.Piutang || 0);
  if ((DATA.pengaturan || {}).PoinAktif !== 'TIDAK') document.getElementById('poinBox').textContent = 'Poin pelanggan: ' + (pl.Poin || 0) + ' — tombol Tukar Poin: 100 poin = Rp1.000 (min. 100 poin).';
  else document.getElementById('poinBox').textContent = '';
}
function hitungCart() {
  var sub = 0, diskonItemTotal = 0;
  cart.forEach(function (it) { sub += it.Harga * it.Qty; diskonItemTotal += (it.diskonItem || 0) * it.Qty; });
  var setelahItem = Math.max(0, sub - diskonItemTotal);
  var jenis = document.getElementById('kasirDiskonJenis').value;
  var dIn = parseUang(document.getElementById('kasirDiskon').value);
  var diskonTotal = jenis === 'persen' ? Math.round(setelahItem * dIn / 100) : dIn;
  diskonTotal = Math.min(diskonTotal, setelahItem);
  var ongkir = parseUang(document.getElementById('kasirOngkir').value);
  var pajak = 0;
  if ((DATA.pengaturan || {}).PajakAktif === 'YA') { pajak = Math.round((setelahItem - diskonTotal) * Number((DATA.pengaturan || {}).PajakPersen || 0) / 100); }
  var poinDiskon = poinDipakai > 0 ? Math.floor(poinDipakai / 100) * 1000 : 0;
  var total = Math.max(0, setelahItem - diskonTotal - promoDiskon - poinDiskon + pajak + ongkir);
  return { sub: sub, diskonItemTotal: diskonItemTotal, setelahItem: setelahItem, diskonTotal: diskonTotal, ongkir: ongkir, pajak: pajak, poinDiskon: poinDiskon, total: total };
}
var promoTimer = null; var bayarManual = false;
function renderTotalKasir() {
  var h = hitungCart();
  var nProduk = cart.length, nItem = cart.reduce(function (a, x) { return a + x.Qty; }, 0);
  document.getElementById('cartTotal').innerHTML =
    '<div class="cart-item"><span>Subtotal</span><b>' + rp(h.sub) + '</b></div>' +
    (h.diskonItemTotal ? '<div class="cart-item"><span>Diskon item</span><b>−' + rp(h.diskonItemTotal) + '</b></div>' : '') +
    (h.diskonTotal ? '<div class="cart-item"><span>Diskon total</span><b>−' + rp(h.diskonTotal) + '</b></div>' : '') +
    (promoDiskon ? '<div class="cart-item"><span>Promo</span><b>−' + rp(promoDiskon) + '</b></div>' : '') +
    (h.poinDiskon ? '<div class="cart-item"><span>Tukar poin</span><b>−' + rp(h.poinDiskon) + '</b></div>' : '') +
    (h.pajak ? '<div class="cart-item"><span>Pajak</span><b>' + rp(h.pajak) + '</b></div>' : '') +
    (h.ongkir ? '<div class="cart-item"><span>Ongkir</span><b>' + rp(h.ongkir) + '</b></div>' : '') +
    '<div class="cart-item"><span><b>Total</b></span><b class="trx-biru" style="font-size:20px">' + rp(h.total) + '</b></div>' +
    '<div style="color:#64748b;font-size:14px">Produk: ' + nProduk + ' • Jumlah item: ' + nItem + '</div>';
  if (!bayarManual) document.getElementById('kasirBayar').value = h.total;
}
function hapusCartItem(i) { cart.splice(i, 1); renderCart(); }
// Tombol −/+ di baris keranjang: dulu mengubah Qty langsung tanpa cek stok
// dan tanpa hitung ulang harga tier — sekarang lewat sini.
function ubahQtyCart(i, delta) {
  var it = cart[i]; if (!it) return;
  var p = DATA.produk.find(function (x) { return x.ID === it.id; });
  var langkah = langkahQtyProduk(p);
  if (delta > 0) {
    if (p && lacakStok(p)) {
      var diKeranjang = 0; cart.forEach(function (x) { if (x.id === it.id) diKeranjang += x.Qty; });
      if (stokProduk(p) - diKeranjang < langkah) return tampilError('Stok produk tidak mencukupi: ' + p.Nama);
    }
    it.Qty = Math.round((it.Qty + langkah) * 10) / 10;
  } else {
    it.Qty = Math.round((it.Qty - langkah) * 10) / 10;
    if (it.Qty <= 0) { cart.splice(i, 1); renderCart(); return; }
  }
  var pp = DATA.produk.find(function (x) { return x.ID === it.id; });
  if (pp && !it.satuanDipakai && !it.hargaLainLabel) it.Harga = hargaJumlahOtomatis(pp, it.Qty);
  renderCart();
}
function renderCart() {
  var h = hitungCart();
  document.getElementById('cart').innerHTML = cart.map(function (it, i) {
    var subIt = it.Harga * it.Qty - (it.diskonItem || 0) * it.Qty;
    return '<div class="cart-item"><span><b>' + esc(it.nama) + '</b><br><small>' + rp(it.Harga) + (it.satuanDipakai ? ' / ' + esc(it.satuanDipakai) : '') + (it.hargaLainLabel ? ' [' + esc(it.hargaLainLabel) + ']' : '') + ' • Diskon item: ' + rp(it.diskonItem || 0) + '</small><br>'
      + '<button class="secondary" onclick="hapusCartItem(' + i + ')" style="color:#dc2626">✕ Hapus</button> <button class="secondary" onclick="ubahDiskonItem(' + i + ')">% Diskon</button> <button class="secondary" onclick="pilihHargaLain(' + i + ')">Harga Lain</button> <button class="secondary" onclick="pilihVarian(' + i + ')">Varian</button></span>'
      + '<span style="text-align:right"><span class="qty-ctl"><button onclick="ubahQtyCart(' + i + ',-1)">−</button><b class="qty-badge">' + fmtQty(it.Qty) + '</b><button onclick="ubahQtyCart(' + i + ',1)">+</button></span><br><b class="trx-biru">' + rp(subIt) + '</b></span></div>';
  }).join('') || 'Keranjang kosong.';
  renderTotalKasir();
  if (promoTimer) clearTimeout(promoTimer);
  promoTimer = setTimeout(cekPromo, 400);
  var bar = document.getElementById('cartBar');
  if (bar) {
    document.getElementById('cartBarCount').textContent = fmtQty(cart.reduce(function (a, x) { return a + x.Qty; }, 0));
    document.getElementById('cartBarTotal').textContent = fmtQty(cart.reduce(function (a, x) { return a + x.Qty; }, 0)) + ' item | ' + rp(h.total);
    bar.style.display = (langkahKasirAktif === 1 && cart.length) ? 'flex' : 'none';
  }
  renderProdukKasir();
  if (document.getElementById('bayar').classList.contains('active')) renderBayar();
}
function kosongkanCart() { cart = []; promoDiskon = 0; promoTerpakai = []; poinDipakai = 0; bayarManual = false; document.getElementById('kasirBayar').value = ''; document.getElementById('promoBox').textContent = ''; renderCart(); }
async function tanyaKosongkanCart() {
  if (!await konfirmasi('Kosongkan keranjang?', 'Semua item di keranjang akan dihapus.', 'Ya, Kosongkan')) return;
  kosongkanCart();
}
function scanBarcode() {
  // Kolom scan digabung ke baris cari kasir: Enter di #cariProduk mencoba
  // cocok persis dengan SKU/barcode dulu; kalau tidak cocok dan teksnya juga
  // bukan bagian dari nama produk mana pun, beri tahu (kemungkinan scan gagal).
  var inp = document.getElementById('cariProduk');
  // v4-43: bersihkan awalan AIM (mis. ]C1) bila kode ditempel dari hasil scan.
  var code = bersihkanKodeScan(inp.value);
  if (inp) inp.value = code;
  if (!code) return;
  var p = (DATA.produk || []).find(function (x) { return String(x.SKU || x['SKU/Barcode'] || '').trim() === code; });
  if (p) {
    if (!milikCabangSesi(p)) { tampilError('Produk ini milik cabang lain dan tidak bisa dijual di cabang ini.'); return; }
    addToCart(p.ID); inp.value = ''; renderProdukKasir(); return;
  }
  var mirip = (DATA.produk || []).some(function (x) { return String(x.Nama || '').toLowerCase().indexOf(code.toLowerCase()) >= 0; });
  if (!mirip) tampilError('Barcode / SKU tidak ditemukan: ' + code);
}

/* ---------- SCAN BARCODE KAMERA (v4-34) ---------- */
// Pustaka html5-qrcode dimuat via CDN di index.html (global Html5Qrcode).
// Scan online-only (pustaka + izin kamera butuh internet); cari ketik
// tetap jalan offline. Kamera belakang (facingMode environment).
// v4-43: target 'form' mengisi kolom SKU di form Tambah/Edit Produk;
// hasil scan dibersihkan dari awalan AIM (lihat bersihkanKodeScan).
var scanAktif = null; // { target: 'produk'|'kasir'|'form', qr: Html5Qrcode }
var scanTarget = 'produk';

// v4-43: buang awalan AIM identifier yang ditambahkan pustaka scan di
// depan kode barcode (mis. ]C1 = Code 128, ]E0 = EAN-13, ]Q3 = QR) —
// awalan itu bukan bagian dari barcode, jadi pencocokan SKU harus
// tanpa awalan. Kode polos tanpa awalan dikembalikan apa adanya.
function bersihkanKodeScan(kode) {
  return String(kode || '').trim().replace(/^\][A-Za-z][0-9]/, '').trim();
}

function scanButuhOnline() {
  try {
    if (navigator.onLine === false) return true;
    if (typeof DB !== 'undefined' && DB && DB.sedangOffline && DB.sedangOffline()) return true;
  } catch (e) {}
  return false;
}

async function bukaScanKamera(target) {
  if (scanButuhOnline()) return tampilError('Scan kamera butuh internet.');
  if (typeof Html5Qrcode === 'undefined') return tampilError('Pustaka scan belum termuat — periksa internet lalu coba lagi.');
  var modal = document.getElementById('scanModal');
  var box = document.getElementById('scanReader');
  if (!modal || !box) return tampilError('Layar scan tidak tersedia.');
  await hentikanScan();
  scanTarget = (target === 'kasir' || target === 'form' || target === 'beli') ? target : 'produk';
  modal.style.display = 'block';
  var qr = new Html5Qrcode('scanReader');
  scanAktif = { target: scanTarget, qr: qr };
  try {
    await qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 150 } },
      function (kode) { if (!scanAktif) return; terapkanHasilScan(scanTarget, kode); },
      function () { /* abaikan galat tiap frame (tidak ada kode di frame) */ });
  } catch (e) {
    await hentikanScan();
    var ditolak = (e && e.name === 'NotAllowedError') || String((e && e.message) || e).indexOf('Permission') >= 0;
    tampilError(ditolak
      ? 'Izin kamera ditolak — izinkan kamera di pengaturan browser lalu coba lagi.'
      : 'Kamera tidak bisa dipakai — pastikan perangkat punya kamera dan tidak dipakai aplikasi lain.');
  }
}

async function hentikanScan() {
  if (scanAktif && scanAktif.qr) {
    try { await scanAktif.qr.stop(); } catch (e) {}
    try { await scanAktif.qr.clear(); } catch (e) {}
  }
  scanAktif = null;
  var modal = document.getElementById('scanModal');
  if (modal) modal.style.display = 'none';
}
async function tutupScanKamera() { await hentikanScan(); }

// Cari produk dari kode hasil scan: cocok persis SKU/barcode dulu,
// kalau tidak ada, cocok substring nama. Kembalikan daftar cocok.
function cariProdukDariKode(kode) {
  var k = String(kode || '').trim();
  if (!k) return [];
  var semua = (DATA.produk || []).filter(function (p) { return produkAktif(p) && milikCabangSesi(p); });
  var pas = semua.filter(function (p) { return String(p.SKU || p['SKU/Barcode'] || '').trim() === k; });
  if (pas.length) return pas;
  var kl = (k || '').toLowerCase();
  return semua.filter(function (p) { return String(p.Nama || '').toLowerCase().indexOf(kl) >= 0; });
}

// v4-45: awalan form produk yang sedang terbuka ('pe' = edit, 'pt' = tambah).
function prefFormProdukAktif() {
  var ed = document.getElementById('formProdukEdit');
  if (ed && ed.style && ed.style.display && ed.style.display !== 'none') return 'pe';
  return 'pt';
}
async function terapkanHasilScan(target, kode) {
  await hentikanScan();
  // v4-43: bersihkan awalan AIM dulu — ini satu-satunya pintu masuk
  // hasil kamera, jadi kasir + master + form ikut beres.
  var k = bersihkanKodeScan(kode);
  if (!k) return;
  if (target === 'kasir') {
    var inp = document.getElementById('cariProduk');
    if (inp) inp.value = k;
    scanBarcode();
    return;
  }
  // v4-43: target 'form' — isi kolom SKU di form Tambah/Edit Produk.
  // Bila kode sudah dipakai produk LAIN, beri peringatan tapi tetap isi
  // kolomnya (Bos yang putuskan).
  if (target === 'form') {
    // v4-45: form produk terpisah — isi kolom SKU di form yang sedang
    // terbuka (edit bila formProdukEdit tampil, kalau tidak form tambah).
    var prefF = prefFormProdukAktif();
    var inpF = document.getElementById(prefF + 'SKU');
    if (inpF) inpF.value = k;
    var idEdit = document.getElementById(prefF + 'Id') ? document.getElementById(prefF + 'Id').value : '';
    var duplikat = (DATA.produk || []).find(function (x) { return String(x.SKU || x['SKU/Barcode'] || '').trim() === k && String(x.ID) !== String(idEdit); });
    if (duplikat) return tampilError('Barcode sudah dipakai produk: ' + duplikat.Nama);
    tampilInfo('Barcode terisi: ' + k);
    return;
  }
  // v4-45: target 'beli' — isi kotak cari picker pembelian; bila tepat satu
  // produk cocok persis SKU-nya, langsung pilih produk itu.
  if (target === 'beli') {
    var inpB = document.getElementById('cariProdukBeli');
    if (inpB) inpB.value = k;
    renderPickerProduk();
    var cocokBeli = cariProdukDariKode(k).filter(function (p) { return String(p.SKU || p['SKU/Barcode'] || '').trim() === k; });
    if (cocokBeli.length === 1) { pilihProdukBeli(cocokBeli[0].ID); return; }
    if (!cocokBeli.length) return tampilError('Barcode ' + k + ' tidak ditemukan');
    tampilInfo('Ditemukan: ' + cocokBeli.length + ' produk — pilih dari daftar');
    return;
  }
  cariProdukTeks = k;
  var inp2 = document.getElementById('cariProdukMaster');
  if (inp2) inp2.value = k;
  filterGrupProduk = 'Semua';
  renderProdukTable();
  var cocok = cariProdukDariKode(k);
  if (!cocok.length) return tampilError('Barcode ' + k + ' tidak ditemukan');
  if (cocok.length === 1) return tampilInfo('Ditemukan: ' + cocok[0].Nama);
  tampilInfo('Ditemukan: ' + cocok.length + ' produk');
}
async function cekPromo() {
  if (!cart.length || (DATA.pengaturan || {}).PromoAktif === 'TIDAK') { promoDiskon = 0; promoTerpakai = []; document.getElementById('promoBox').textContent = ''; return; }
  try {
    var h = hitungCart();
    var res = await DB.hitungPromo({ items: cart, pelanggan: document.getElementById('kasirPelanggan').value, total: h.setelahItem, cabangId: cabangSesiId() });
    promoDiskon = Number(res.diskon || 0); promoTerpakai = res.promoTerpakai || [];
    document.getElementById('promoBox').textContent = promoTerpakai.length ? ('Promo otomatis: ' + promoTerpakai.map(function (x) { return x.nama || x; }).join(', ') + ' — hemat ' + rp(promoDiskon)) : 'Tidak ada promo yang memenuhi syarat.';
    renderTotalKasir();
  } catch (e) { /* promo gagal dihitung: transaksi tetap jalan tanpa promo */ }
}
function tukarPoin() {
  if ((DATA.pengaturan || {}).PoinAktif === 'TIDAK') return tampilError('Fitur poin sedang dimatikan di Pengaturan.');
  var nama = document.getElementById('kasirPelanggan').value;
  var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === nama; });
  if (!pl) return tampilError('Pilih pelanggan terdaftar dulu (bukan Umum).');
  // beri pesan jelas lewat toast (dulu alert() — tidak terlihat di
  // browser penguji dan tidak memberi tahu kenapa tombol diam).
  if ((pl.Poin || 0) < 100) return tampilError('Poin belum cukup — butuh min. 100 poin, poin kamu ' + (pl.Poin || 0) + '.');
  var maks = Math.floor((pl.Poin || 0) / 100) * 100;
  var v = prompt('Tukar berapa poin? (kelipatan 100, maks ' + maks + ', 100 poin = Rp1.000)', String(Math.min(100, maks)));
  if (!v) return;
  var n = Math.floor(Number(v) / 100) * 100;
  if (n < 100 || n > maks) return tampilError('Jumlah tidak valid.');
  poinDipakai = n; renderCart(); tampilInfo('Poin ditukar: ' + n + ' poin = ' + rp(n / 100 * 1000) + ' diskon.');
}
/* ---------- PEMBAYARAN ---------- */
function goCheckout() {
  if (!cart.length) return tampilError('Keranjang masih kosong.');
  show('bayar', null);
  renderBayar();
}
function renderBayar() {
  var h = hitungCart();
  document.getElementById('bayarTotal').textContent = rp(h.total);
  document.getElementById('bayarRincian').innerHTML =
    '<div class="cart-item"><span>Sub Total</span><b>' + rp(h.sub) + '</b></div>' +
    (h.diskonItemTotal ? '<div class="cart-item"><span>Diskon Item</span><b>−' + rp(h.diskonItemTotal) + '</b></div>' : '') +
    (h.diskonTotal ? '<div class="cart-item"><span>Diskon</span><b>−' + rp(h.diskonTotal) + '</b></div>' : '') +
    (promoDiskon ? '<div class="cart-item"><span>Promo</span><b>−' + rp(promoDiskon) + '</b></div>' : '') +
    (h.poinDiskon ? '<div class="cart-item"><span>Tukar Poin</span><b>−' + rp(h.poinDiskon) + '</b></div>' : '') +
    (h.pajak ? '<div class="cart-item"><span>Pajak</span><b>' + rp(h.pajak) + '</b></div>' : '') +
    (h.ongkir ? '<div class="cart-item"><span>Ongkir</span><b>' + rp(h.ongkir) + '</b></div>' : '') +
    '<div class="cart-item"><span><b>Total</b></span><b>' + rp(h.total) + '</b></div>';
  var metode = document.getElementById('kasirMetode').value || 'Tunai';
  var jb = (DATA.jenisBayar || []).filter(function (j) { return produkAktif(j); });
  if (!jb.length) jb = [{ Nama: 'Tunai' }];
  document.getElementById('bayarMetodeGrid').innerHTML = jb.map(function (j) {
    var sel = j.Nama === metode;
    return '<div class="payopt' + (sel ? ' sel' : '') + '" onclick="pilihMetodeBayar(\'' + escJS(j.Nama) + '\')"><span class="payopt-ic">' + iconBayar(j.Nama) + '</span>' + (sel ? '✓ ' : '') + esc(j.Nama) + '</div>';
  }).join('');
  var bt = document.getElementById('bayarTunai');
  if (!bayarManual) setUang(bt, h.total);
  updateKembalian();
}
function pilihMetodeBayar(nama) {
  document.getElementById('kasirMetode').value = nama;
  renderBayar();
}
function bayarTunaiInput() {
  bayarManual = true;
  document.getElementById('kasirBayar').value = document.getElementById('bayarTunai').value;
  updateKembalian();
}
function updateKembalian() {
  var h = hitungCart();
  var tunai = parseUang(document.getElementById('bayarTunai').value);
  var el = document.getElementById('bayarKembalianVal');
  if (el) el.textContent = rp(Math.max(0, tunai - h.total));
  else document.getElementById('bayarKembalian').textContent = 'Kembalian: ' + rp(Math.max(0, tunai - h.total));
  // Tampilkan sisa bila bayar kurang dari total (dulu halaman pembayaran
  // tidak menunjukkan status Kurang sebelum disimpan).
  var sisa = Math.max(0, h.total - tunai);
  var sEl = document.getElementById('bayarSisa');
  if (sEl) { sEl.style.display = sisa > 0 ? '' : 'none'; var sv = document.getElementById('bayarSisaVal'); if (sv) sv.textContent = rp(sisa); }
}
var sedangMenyimpan = false;
async function simpanTransaksi() {
  // Guard double-submit: ketuk Selesai dua kali / ketuk ulang saat koneksi
  // lambat tidak boleh membuat transaksi ganda.
  if (sedangMenyimpan) return;
  if (!cart.length) return tampilError('Keranjang masih kosong.');
  sedangMenyimpan = true;
  var btnSelesai = document.getElementById('btnSelesai'); if (btnSelesai) btnSelesai.disabled = true;
  var teksSelesai = btnSelesai ? btnSelesai.textContent : '';
  try {
    sembunyiError();
    // Promo harus segar sebelum total dihitung (cekPromo di-debounce 400 ms —
    // tanpa await ini, struk bisa memakai total tanpa promo).
    await cekPromo();
    // umpan balik instan — tombol "Menyimpan…" + toast, supaya ketuk
    // tidak terasa diam selama simpan + loadData berjalan.
    if (btnSelesai) btnSelesai.textContent = 'Menyimpan…';
    tampilInfo('Menyimpan…');
    var h = hitungCart();
    var namaPelanggan = document.getElementById('kasirPelanggan').value;
    var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === namaPelanggan; });
    var payload = { pelanggan: namaPelanggan, kasir: currentUser ? currentUser.nama : 'Kasir', cabangId: cabangSesiId(), meja: document.getElementById('kasirMeja').value || '', items: cart, diskon: h.diskonTotal, diskonPersen: document.getElementById('kasirDiskonJenis').value === 'persen' ? parseUang(document.getElementById('kasirDiskon').value) : 0, ongkir: h.ongkir, bayar: parseUang(document.getElementById('kasirBayar').value), metode: document.getElementById('kasirMetode').value, statusPesanan: document.getElementById('kasirStatus').value, catatan: '', catatanStruk: document.getElementById('kasirCatatanStruk').value, catatanInternal: document.getElementById('kasirCatatanInternal').value, poinDipakai: poinDipakai, promoId: promoTerpakai.length ? (promoTerpakai[0].id || promoTerpakai[0].ID || '') : '', kodeAlternatif: '' };
    var janjiSimpan = DB.saveTransaksi(payload);
    // Buka kunci hanya saat simpan benar-benar selesai — timeout 15 detik
    // TIDAK membatalkan simpan yang sedang jalan di latar belakang.
    janjiSimpan.then(function () { sedangMenyimpan = false; if (btnSelesai) { btnSelesai.disabled = false; btnSelesai.textContent = teksSelesai; } }, function () { sedangMenyimpan = false; if (btnSelesai) { btnSelesai.disabled = false; btnSelesai.textContent = teksSelesai; } });
    var res = await withTimeout(janjiSimpan, 15000, 'Server tidak menjawab saat menyimpan (15 detik). Periksa koneksi internet, lalu coba lagi.');
    lastStruk = buatStruk(res, payload, h, pl);
    var el = document.getElementById('struk'); el.style.display = 'block'; el.innerHTML = strukKeHtml(lastStruk);
    document.getElementById('strukPrint').innerHTML = strukKeHtml(lastStruk);
    lastWaTelp = pl && pl.Telepon ? String(pl.Telepon).replace(/\D/g, '') : '';
    cart = []; promoDiskon = 0; promoTerpakai = []; poinDipakai = 0; bayarManual = false; document.getElementById('kasirBayar').value = '';
    // Struk versi buatStruk (lengkap: promo/poin) dipertahankan — bukaDetailTrx
    // di bawah menghitung ulang struk dari trx (tanpa rincian promo/poin).
    var strukBaru = lastStruk, strukDataBaru = lastStrukData, waBaru = lastWaTelp;
    await loadData();
    bukaDetailTrx(res.id);
    lastStruk = strukBaru; lastStrukData = strukDataBaru; lastWaTelp = waBaru;
    document.getElementById('strukPrint').innerHTML = strukKeHtml(lastStruk);
    tampilInfo('Transaksi tersimpan. ID: ' + (res.id || '') + (res.rugi ? ' — RUGI (total di bawah HPP)' : ''));
  } catch (e) {
    var m = 'Gagal menyimpan: ' + (e && e.message ? e.message : e);
    if (sedangMenyimpan) m += ' Transaksi mungkin masih diproses di latar belakang — jangan ketuk Simpan lagi, cek Daftar Transaksi sebentar lagi.';
    tampilError(m);
  }
}
/* ---------- STRUK ala Griyo: satu model, tiga tampilan (teks / HTML / gambar) ---------- */
var BLN_PDK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtTglStruk(d) { d = new Date(d); return d.getDate() + ' ' + BLN_PDK[d.getMonth()] + ' ' + d.getFullYear() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function angka(n) { return Number(n || 0).toLocaleString('id-ID'); }
function strukDataDariTrx(t) {
  var p = DATA.pengaturan || {};
  if (!trxNomor[t.ID]) hitungNomorTrx();
  var items = (DATA.detail || []).filter(function (x) { return x.TransaksiID === t.ID; }).map(function (x) {
    return { nama: x.NamaProduk, qty: Number(x.Qty), harga: Number(x.Harga), subtotal: Number(x.Subtotal) };
  });
  var rincian = [];
  if (Number(t.Diskon || 0) > 0) rincian.push({ label: 'Diskon', nilai: '-' + rp(t.Diskon) });
  if (Number(t.Ongkir || 0) > 0) rincian.push({ label: 'Ongkir', nilai: rp(t.Ongkir) });
  return {
    id: t.ID, kode: t.KodeAlternatif || '', nomor: trxNomor[t.ID] || '',
    toko: p.NamaToko || 'ZPOS', slogan: p.SloganToko || '', alamat: alamatStruk(), kota: p.KotaToko || '', telepon: teleponStruk(), footer: p.FooterStruk || 'Terima kasih',
    logo: p.LogoToko || logoDataUrl || '', logo2: p.Logo2 || logo2DataUrl || '', watermark: p.Watermark || watermarkDataUrl || '', tanggal: new Date(t.Tanggal), pelanggan: t.Pelanggan || 'Umum', kasir: t.Kasir || '',
    metode: t.Metode || 'Tunai', items: items, rincian: rincian, total: Number(t.Total || 0), bayar: Number(t.Bayar || 0),
    kembali: Math.max(0, Number(t.Bayar || 0) - Number(t.Total || 0)), sisa: Number(t.Sisa || 0),
    status: t.StatusBayar || '', catatan: t.CatatanStruk || '', poin: '', rugi: false
  };
}
function strukTeks(d) {
  var W = 32;
  var tengah = function (s) { s = String(s || ''); if (s.length >= W) return s; return ' '.repeat(Math.floor((W - s.length) / 2)) + s; };
  var kanan = function (kiri, kan) { kiri = String(kiri); kan = String(kan); return kiri + ' '.repeat(Math.max(1, W - kiri.length - kan.length)) + kan; };
  var L = [tengah(d.toko)];
  if (d.slogan) L.push(tengah(d.slogan));
  if (d.alamat) L.push(tengah(d.alamat));
  if (d.kota) L.push(tengah(d.kota));
  if (d.telepon) L.push(tengah(d.telepon));
  L.push('');
  L.push(fmtTglStruk(d.tanggal) + (d.nomor ? '  #' + d.nomor : ''));
  L.push(d.pelanggan);
  L.push('--------------------------------');
  d.items.forEach(function (it) {
    L.push(it.nama);
    var kiri = '  ' + it.qty + ' x ' + angka(it.harga);
    L.push(kiri + ' '.repeat(Math.max(1, W - kiri.length - rp(it.subtotal).length)) + rp(it.subtotal));
  });
  L.push('--------------------------------');
  (d.rincian || []).forEach(function (r) { L.push(kanan(r.label, r.nilai)); });
  L.push(kanan('Total', rp(d.total)));
  L.push(kanan(d.metode, rp(d.bayar)));
  if (d.kembali > 0) L.push(kanan('Kembali', rp(d.kembali)));
  if (d.sisa > 0) L.push(kanan('Sisa', rp(d.sisa)));
  if (d.rugi) L.push('** RUGI **');
  if (d.poin) L.push(d.poin);
  if (d.catatan) L.push('Catatan: ' + d.catatan);
  L.push('', tengah(d.footer || 'Terima kasih'));
  return L.join('\n');
}
function strukHtml(d) {
  var h = '<div class="struk">';
  if (d.watermark) h += '<div class="struk-wm"><img src="' + d.watermark + '" alt=""></div>';
  h += '<div class="struk-isi">';
  var logoAtas = logoGrafis(d);
  if (logoAtas) h += '<div style="text-align:center;margin-bottom:6px"><img src="' + logoAtas + '" style="max-width:120px;max-height:120px"></div>';
  h += '<div class="struk-nama">' + esc(d.toko) + '</div>';
  if (d.slogan) h += '<div class="struk-info">' + esc(d.slogan) + '</div>';
  if (d.alamat) h += '<div class="struk-info">' + esc(d.alamat) + '</div>';
  if (d.kota) h += '<div class="struk-info">' + esc(d.kota) + '</div>';
  if (d.telepon) h += '<div class="struk-info">' + esc(d.telepon) + '</div>';
  h += '<div class="struk-bar"><span>' + fmtTglStruk(d.tanggal) + '</span><span>#' + (d.nomor || '') + '</span></div>';
  h += '<div class="struk-plg">' + esc(d.pelanggan) + '</div>';
  h += '<hr class="struk-hr">';
  d.items.forEach(function (it) {
    h += '<div class="struk-item"><div><b>' + esc(it.nama) + '</b><div class="struk-qty">' + it.qty + ' x ' + angka(it.harga) + '</div></div><b>' + angka(it.subtotal) + '</b></div>';
  });
  h += '<hr class="struk-hr">';
  (d.rincian || []).forEach(function (r) { h += '<div class="struk-tot"><span>' + esc(r.label) + '</span><span>' + esc(r.nilai) + '</span></div>'; });
  h += '<div class="struk-tot"><span>Total</span><b>' + rp(d.total) + '</b></div>';
  h += '<div class="struk-tot"><span>' + esc(d.metode) + '</span><span>' + rp(d.bayar) + '</span></div>';
  if (d.kembali > 0) h += '<div class="struk-tot"><span>Kembali</span><span>' + rp(d.kembali) + '</span></div>';
  if (d.sisa > 0) h += '<div class="struk-tot"><span>Sisa</span><b>' + rp(d.sisa) + '</b></div>';
  if (d.rugi) h += '<div class="struk-info" style="color:#c5221f;font-weight:700;margin-top:6px">** RUGI **</div>';
  if (d.poin) h += '<div class="struk-info" style="margin-top:6px">' + esc(d.poin) + '</div>';
  if (d.catatan) h += '<div class="struk-info" style="margin-top:6px">Catatan: ' + esc(d.catatan) + '</div>';
  h += '<div class="struk-thanks">' + esc(d.footer || 'Terima kasih') + '</div>';
  h += '</div></div>';
  return h;
}
function buatStruk(res, payload, h, pl) {
  var p = DATA.pengaturan || {};
  var rincian = [];
  rincian.push({ label: 'Subtotal', nilai: rp(h.sub) });
  if (h.diskonItemTotal) rincian.push({ label: 'Diskon item', nilai: '-' + rp(h.diskonItemTotal) });
  if (h.diskonTotal) rincian.push({ label: 'Diskon', nilai: '-' + rp(h.diskonTotal) });
  if (promoDiskon) rincian.push({ label: 'Promo', nilai: '-' + rp(promoDiskon) });
  if (h.poinDiskon) rincian.push({ label: 'Tukar poin', nilai: '-' + rp(h.poinDiskon) });
  if (h.pajak) rincian.push({ label: 'Pajak', nilai: rp(h.pajak) });
  if (h.ongkir) rincian.push({ label: 'Ongkir', nilai: rp(h.ongkir) });
  var sisa = res.sisa != null ? res.sisa : Math.max(0, h.total - payload.bayar);
  // Nomor struk harus sama dengan nomor di Daftar Transaksi (hitungNomorTrx
  // mengurutkan kronologis) — dulu length+1, padahal transaksi baru sudah
  // masuk DATA, jadi struk selalu kelebihan 1 (#7 padahal daftar #6).
  if (!trxNomor[res.id]) hitungNomorTrx();
  lastStrukData = {
    id: res.id || '', kode: res.kodeAlternatif || '', nomor: trxNomor[res.id] || '',
    toko: p.NamaToko || 'ZPOS', slogan: p.SloganToko || '', alamat: alamatStruk(), kota: p.KotaToko || '', telepon: teleponStruk(), footer: p.FooterStruk || 'Terima kasih',
    logo: p.LogoToko || logoDataUrl || '', logo2: p.Logo2 || logo2DataUrl || '', watermark: p.Watermark || watermarkDataUrl || '', tanggal: new Date(), pelanggan: payload.pelanggan, kasir: payload.kasir || '',
    metode: payload.metode || 'Tunai',
    items: payload.items.map(function (it) { return { nama: it.nama, qty: it.Qty, harga: it.Harga - (it.diskonItem || 0), subtotal: it.Harga * it.Qty - (it.diskonItem || 0) * it.Qty }; }),
    rincian: rincian, total: h.total, bayar: payload.bayar,
    kembali: Math.max(0, payload.bayar - h.total), sisa: sisa,
    status: sisa === 0 ? 'Lunas' : 'Kurang', catatan: payload.catatanStruk || '',
    poin: (p.TampilkanPoinStruk !== 'TIDAK' && pl) ? ('Poin: ' + (pl.Poin || 0) + (res.poinDidapat ? ' (+' + res.poinDidapat + ' baru)' : '')) : '',
    rugi: !!res.rugi
  };
  var teks = strukTeks(lastStrukData);
  if (p.WatermarkStruk === 'YA') teks = '~~~ ' + lastStrukData.toko + ' ~~~\n' + teks;
  if (promoTerpakai.length) teks += '\nPromo dipakai: ' + promoTerpakai.map(function (x) { return x.nama || x; }).join(', ');
  return teks;
}
function kirimWA() {
  if (!lastStruk) return tampilError('Belum ada struk. Simpan transaksi dulu.');
  var url = lastWaTelp ? ('https://wa.me/' + lastWaTelp + '?text=' + encodeURIComponent(lastStruk)) : ('https://wa.me/?text=' + encodeURIComponent(lastStruk));
  window.open(url, '_blank');
}
// Struk sebagai GAMBAR (PNG) untuk WhatsApp: wa.me hanya bisa mengirim teks,
// jadi gambar dibagikan lewat menu berbagi bawaan HP (pilih WhatsApp di sana).
// Bila HP/browser tidak mendukung berbagi file, gambar diunduh — lampirkan
// manual di WhatsApp. Jalan terakhir bila unduhan pun gagal: kirim teks.
async function kirimWAGambar() {
  if (!lastStruk) return tampilError('Belum ada struk. Simpan transaksi dulu.');
  try {
    var blob = await gambarStruk();
    var nama = 'struk-' + (lastStrukData && lastStrukData.id ? lastStrukData.id : ((lastStruk.match(/No:\s*(\S+)/) || [])[1] || 'zho-pos')) + '.png';
    var file = new File([blob], nama, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Struk ZPOS' });
      tampilInfo('Struk dibagikan. Pilih WhatsApp di menu berbagi.');
      return;
    }
    unduhBlob(blob, nama);
    tampilInfo('Gambar struk sudah diunduh (' + nama + '). Buka WhatsApp, pilih kontak, lalu lampirkan gambar itu.');
  } catch (e) {
    // Pengguna membatalkan menu berbagi: jangan kirim teks tiba-tiba.
    if (e && e.name === 'AbortError') return;
    tampilError('Gagal membuat gambar struk (' + (e && e.message ? e.message : e) + '). Mengirim struk teks…');
    kirimWA();
  }
}
function unduhBlob(blob, nama) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nama;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// Gambar struk di kanvas ala Griyo: nama toko besar di tengah, tanggal + #nomor,
// item "nama / qty x harga / subtotal kanan", Total dan metode di kanan bawah.
function gambarStruk() {
  return new Promise(function (selesai, gagal) {
    var d = lastStrukData;
    if (!d) return gambarStrukTeks().then(selesai, gagal);
    // Muat 2 gambar sekaligus: logo atas (Logo 2 bila ada, kalau tidak Logo 1)
    // dan watermark. Yang kosong dilewati.
    var muatSatu = function (src, cb) {
      if (!src) return cb(null);
      var img = new Image();
      img.onload = function () { cb(img); };
      img.onerror = function () { cb(null); };
      img.src = src;
    };
    var gambarSemua = function (g) {
      var imgLogo = g.atas;
      try {
        var W = 576, pad = 28, lh = 38;
        // Susun baris dulu agar tinggi kanvas pas.
        var baris = [];
        if (imgLogo) baris.push({ logo: imgLogo });
        baris.push({ t: d.toko, a: 'c', b: 1, s: 36 });
        if (d.slogan) baris.push({ t: d.slogan, a: 'c', s: 24, w: '#555' });
        if (d.alamat) baris.push({ t: d.alamat, a: 'c', s: 24, w: '#333' });
        if (d.kota) baris.push({ t: d.kota, a: 'c', s: 24, w: '#333' });
        if (d.telepon) baris.push({ t: d.telepon, a: 'c', s: 24, w: '#333' });
        baris.push({ sp: 8 });
        baris.push({ t: fmtTglStruk(d.tanggal), k: d.nomor ? '#' + d.nomor : '', s: 26 });
        baris.push({ t: d.pelanggan, s: 26 });
        baris.push({ hr: 1 });
        d.items.forEach(function (it) {
          baris.push({ t: it.nama, k: angka(it.subtotal), b: 1, s: 26 });
          baris.push({ t: '  ' + it.qty + ' x ' + angka(it.harga), s: 24, w: '#333' });
        });
        baris.push({ hr: 1 });
        (d.rincian || []).forEach(function (r) { baris.push({ t: r.label, k: r.nilai, s: 26 }); });
        baris.push({ t: 'Total', k: rp(d.total), b: 1, s: 28 });
        baris.push({ t: d.metode, k: rp(d.bayar), s: 26 });
        if (d.kembali > 0) baris.push({ t: 'Kembali', k: rp(d.kembali), s: 26 });
        if (d.sisa > 0) baris.push({ t: 'Sisa', k: rp(d.sisa), b: 1, s: 26 });
        if (d.rugi) baris.push({ t: '** RUGI **', a: 'c', s: 26, w: '#c5221f' });
        if (d.poin) baris.push({ t: d.poin, a: 'c', s: 24, w: '#333' });
        if (d.catatan) baris.push({ t: 'Catatan: ' + d.catatan, a: 'c', s: 24, w: '#333' });
        baris.push({ sp: 8 });
        baris.push({ t: d.footer || 'Terima kasih', a: 'c', s: 26 });
        var tinggi = pad * 2;
        baris.forEach(function (r) {
          if (r.logo) { var sk = Math.min(1, 220 / r.logo.width, 160 / r.logo.height); tinggi += Math.round(r.logo.height * sk) + 16; }
          else if (r.hr) tinggi += 22;
          else if (r.sp) tinggi += r.sp;
          else tinggi += lh;
        });
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = tinggi;
        var c = cv.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, W, tinggi);
        if (g.wm) {
          var wsk = Math.min(1, 440 / g.wm.width, (tinggi * 0.7) / g.wm.height);
          var ww = Math.round(g.wm.width * wsk), wh = Math.round(g.wm.height * wsk);
          c.save(); c.globalAlpha = 0.13;
          c.drawImage(g.wm, (W - ww) / 2, (tinggi - wh) / 2, ww, wh);
          c.restore();
        }
        c.fillStyle = '#111'; c.textBaseline = 'top';
        var y = pad;
        baris.forEach(function (r) {
          if (r.logo) {
            var sk2 = Math.min(1, 220 / r.logo.width, 160 / r.logo.height);
            var lw = Math.round(r.logo.width * sk2), lhh = Math.round(r.logo.height * sk2);
            c.drawImage(r.logo, (W - lw) / 2, y, lw, lhh); y += lhh + 16;
          } else if (r.hr) {
            c.strokeStyle = '#666'; c.setLineDash([8, 6]); c.lineWidth = 2;
            c.beginPath(); c.moveTo(pad, y + 10); c.lineTo(W - pad, y + 10); c.stroke();
            c.setLineDash([]); y += 22;
          } else if (r.sp) { y += r.sp; }
          else {
            c.font = (r.b ? 'bold ' : '') + (r.s || 26) + 'px Arial, sans-serif';
            c.fillStyle = r.w || '#111';
            if (r.a === 'c') { c.textAlign = 'center'; c.fillText(r.t, W / 2, y); }
            else {
              c.textAlign = 'left'; c.fillText(r.t, pad, y);
              if (r.k) { c.textAlign = 'right'; c.fillText(r.k, W - pad, y); }
            }
            y += lh;
          }
        });
        cv.toBlob(function (b) { b ? selesai(b) : gagal(new Error('gagal membuat gambar')); }, 'image/png');
      } catch (e) { gagal(e); }
    };
    var gambar = {}, tinggal = 2;
    var siap = function () { if (--tinggal === 0) gambarSemua(gambar); };
    muatSatu(logoGrafis(d), function (im) { gambar.atas = im; siap(); });
    muatSatu(d.watermark || '', function (im) { gambar.wm = im; siap(); });
  });
}
// Jalan darurat: struk lama tanpa data terstruktur, gambar apa adanya dari teks.
function gambarStrukTeks() {
  return new Promise(function (selesai, gagal) {
    var logo = (DATA.pengaturan || {}).LogoToko || logoDataUrl || '';
    var muatLogo = function (cb) {
      if (!logo) return cb(null);
      var img = new Image();
      img.onload = function () { cb(img); };
      img.onerror = function () { cb(null); };
      img.src = logo;
    };
    muatLogo(function (imgLogo) {
      try {
        var W = 576, pad = 28, fs = 28, lh = 38;
        var ctx2 = document.createElement('canvas').getContext('2d');
        ctx2.font = 'bold ' + fs + 'px monospace';
        var maksKar = Math.floor((W - pad * 2) / (fs * 0.6));
        var baris = [];
        lastStruk.split('\n').forEach(function (ln) {
          var sisa = ln;
          while (sisa.length > maksKar) {
            var pot = sisa.slice(0, maksKar), sp = pot.lastIndexOf(' ');
            if (sp > 8) { baris.push(pot.slice(0, sp)); sisa = sisa.slice(sp + 1); }
            else { baris.push(pot); sisa = sisa.slice(maksKar); }
          }
          baris.push(sisa);
        });
        var logoH = 0;
        if (imgLogo) { var sk = Math.min(1, 220 / imgLogo.width, 160 / imgLogo.height); logoH = Math.round(imgLogo.height * sk) + 16; }
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = pad * 2 + logoH + baris.length * lh;
        var c = cv.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
        c.fillStyle = '#111'; c.textBaseline = 'top';
        var y = pad;
        if (imgLogo) {
          var sk2 = Math.min(1, 220 / imgLogo.width, 160 / imgLogo.height);
          var lw = Math.round(imgLogo.width * sk2), lhh = Math.round(imgLogo.height * sk2);
          c.drawImage(imgLogo, (W - lw) / 2, y, lw, lhh); y += lhh + 16;
        }
        baris.forEach(function (ln, i) {
          var tengah = (i === 0) || /terima kasih/i.test(ln) || (i <= 3 && /^(telp|alamat)/i.test(ln));
          c.font = (i === 0 ? 'bold ' : '') + fs + 'px monospace';
          c.textAlign = tengah ? 'center' : 'left';
          c.fillText(ln || ' ', tengah ? W / 2 : pad, y + i * lh);
        });
        cv.toBlob(function (b) { b ? selesai(b) : gagal(new Error('gagal membuat gambar')); }, 'image/png');
      } catch (e) { gagal(e); }
    });
  });
}

/* ---------- RIWAYAT TRANSAKSI & RETUR ---------- */
/* ---------- DAFTAR TRANSAKSI ala Griyo: kelompok per tanggal ---------- */
var trxNomor = {};
var BULAN_ID = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
function fmtTglGrup(d) { return d.getDate() + ' ' + BULAN_ID[d.getMonth()] + ' ' + d.getFullYear(); }
function jamMenit(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function hitungNomorTrx() {
  trxNomor = {};
  (DATA.transaksi || []).slice().sort(function (a, b) { return String(a.Tanggal || '') < String(b.Tanggal || '') ? -1 : 1; }).forEach(function (t, i) { trxNomor[t.ID] = i + 1; });
}
function ringkasItem(id) {
  return (DATA.detail || []).filter(function (d) { return d.TransaksiID === id; }).map(function (d) { return String(d.NamaProduk || '').slice(0, 10) + ':' + d.Qty; }).join(' ');
}
function renderTrx() {
  var q = (document.getElementById('trxCari').value || '').toLowerCase();
  var dari = document.getElementById('trxDari').value, sampai = document.getElementById('trxSampai').value;
  // v4-45: peta nama produk per transaksi — pencarian juga mencocokkan
  // nama produk (dulu hanya ID + pelanggan, padahal placeholder menjanjikan
  // produk — ketik "De" tidak menemukan transaksi berisi Deterjen).
  var namaPerTrx = {};
  (DATA.detail || []).forEach(function (d) { namaPerTrx[d.TransaksiID] = ((namaPerTrx[d.TransaksiID] || '') + ' ' + (d.NamaProduk || '')).toLowerCase(); });
  var list = (DATA.transaksi || []).filter(function (t) {
    if (!milikCabangSesi(t)) return false;
    if (q && String(t.ID).toLowerCase().indexOf(q) < 0 && String(t.Pelanggan || '').toLowerCase().indexOf(q) < 0 && (namaPerTrx[t.ID] || '').indexOf(q) < 0) return false;
    var tg = String(t.Tanggal || '').slice(0, 10);
    if (dari && tg < dari) return false;
    if (sampai && tg > sampai) return false;
    return true;
  }).sort(function (a, b) { return String(b.Tanggal || '') < String(a.Tanggal || '') ? -1 : 1; }).slice(0, 100);
  hitungNomorTrx();
  var html = '', grupTerakhir = '';
  list.forEach(function (t) {
    var d = new Date(t.Tanggal);
    var kunci = String(t.Tanggal || '').slice(0, 10);
    if (kunci !== grupTerakhir) {
      grupTerakhir = kunci;
      var hariIni = list.filter(function (x) { return String(x.Tanggal || '').slice(0, 10) === kunci; });
      var totalHari = hariIni.reduce(function (s, x) { return s + Number(x.Total || 0); }, 0);
      html += '<div class="trx-grup"><span>' + fmtTglGrup(d) + '</span><span class="trx-grup-total">' + rp(totalHari) + '</span><span>' + hariIni.length + '</span></div>';
    }
    var rugi = (t.Laba != null && Number(t.Laba) < 0);
    html += '<div class="trx-row" onclick="bukaDetailTrx(\'' + esc(t.ID) + '\')">'
      + '<div class="trx-r1"><b class="trx-biru">' + rp(t.Total) + '</b><span>' + jamMenit(d) + '</span><span>#' + (trxNomor[t.ID] || '') + '</span></div>'
      + '<div class="trx-r2"><span>' + esc(t.Pelanggan || '') + '</span><span class="trx-ringkas">' + esc(ringkasItem(t.ID)) + '</span></div>'
      + '<div class="trx-r3">' + (rugi ? '<span class="trx-rugi">Rugi</span>' : '<span></span>') + '<span class="' + (t.StatusBayar === 'Lunas' ? 'trx-lunas' : 'trx-hutang') + '">' + esc(t.StatusBayar) + '</span></div>'
      + '</div>';
  });
  html = html || '<p style="color:#64748b">Belum ada transaksi.</p>';
  document.getElementById('trxTable').innerHTML = html;
  document.getElementById('laporanTable').innerHTML = html;
}
async function lunasi(id, nominal) {
  var _btn = null, _teksBtn = '';
  try { _btn = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _btn = null; }
  var trx = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!trx) return;
  var sisa = Number(trx.Sisa || 0);
  var n = nominal != null ? Number(nominal) : sisa;
  if (!(n > 0)) return;
  if (n > sisa) n = sisa;
  if (!await konfirmasi('Bayar sisa ' + rp(n) + '?', 'Pembayaran dicatat sebagai pelunasan ' + (trx.Pelanggan || 'transaksi') + ' (' + (trx.KodeAlternatif || trx.ID) + ').', 'Ya, Bayar', 'primary')) return;
  // umpan balik instan — tombol "Menyimpan…" + toast.
  if (_btn) { _teksBtn = _btn.textContent; _btn.disabled = true; _btn.textContent = 'Menyimpan…'; }
  tampilInfo('Menyimpan…');
  try { await DB.tambahPembayaran({ id: id, nominal: n }); await loadData(); tampilInfo('Pembayaran ' + rp(n) + ' tercatat.'); } catch (e) { tampilError('Gagal mencatat pembayaran: ' + (e.message || e)); } finally { if (_btn) { _btn.disabled = false; _btn.textContent = _teksBtn; } }
}
// struk yang tersimpan di memori (lastStruk) harus dibersihkan bila
// transaksinya sudah dibatalkan/dihapus — pratinjau struk di Kasir jangan
// menampilkan struk basi dari transaksi yang sudah tidak ada.
function bersihkanStrukBilaTerhapus(id) {
  if (lastStrukData && String(lastStrukData.id || '') === String(id)) {
    lastStruk = ''; lastStrukData = null; lastWaTelp = '';
    var el = document.getElementById('struk'); if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    var sp = document.getElementById('strukPrint'); if (sp) sp.innerHTML = '';
  }
}
async function batalkanTransaksi(id) {
  var _btn = null, _teksBtn = '';
  try { _btn = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _btn = null; }
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  // Batalkan BOLEH untuk trx Lunas (Bos 12:33 WIB) — hanya dari detail trx
  // (Detail → ••• Lebih → Batalkan Transaksi). Uang yang sudah dibayar
  // dikembalikan ke pelanggan: kas Keluar mengimbangi kas Masuk.
  var pesan = 'Stok dikembalikan, piutang dan kas disesuaikan. Transaksi dan detailnya dihapus.'
    + (Number(t.Bayar || 0) > 0 ? ' Uang ' + rp(t.Bayar) + ' dikembalikan ke pelanggan.' : '');
  // Jangan pakai prompt() untuk alasan: di browser penguji prompt ditelan
  // diam-diam (kembali null) sehingga tombol Batalkan tampak tidak berfungsi.
  // Pakai modal konfirmasi dalam aplikasi, seperti semua aksi hapus lainnya.
  if (!await konfirmasi('Batalkan transaksi ini?', pesan, 'Ya, Batalkan')) return;
  // umpan balik instan — tombol "Membatalkan…" + toast.
  if (_btn) { _teksBtn = _btn.textContent; _btn.disabled = true; _btn.textContent = 'Membatalkan…'; }
  tampilInfo('Membatalkan…');
  try { await DB.batalkanTransaksi({ id: id, alasan: '' }); bersihkanStrukBilaTerhapus(id); await loadData(); tampilInfo('Transaksi dibatalkan. Stok dikembalikan.'); } catch (e) { tampilError('Gagal membatalkan: ' + (e.message || e)); } finally { if (_btn) { _btn.disabled = false; _btn.textContent = _teksBtn; } }
}
function strukUlang(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return tampilError('Transaksi tidak ditemukan.');
  lastStrukData = strukDataDariTrx(t);
  lastStruk = strukTeks(lastStrukData);
  var el = document.getElementById('struk'); el.style.display = 'block'; el.innerHTML = strukKeHtml(lastStruk);
  document.getElementById('strukPrint').innerHTML = strukKeHtml(lastStruk);
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]'));
  langkahKasir(2);
}
/* ---------- DETAIL TRANSAKSI ala Griyo (ketuk baris di Daftar) ---------- */
var detailTrxId = '', detailTab = 'detail';
// v4-44: struk asal yang dicatat saat tombol Pengaturan di detail transaksi
// ditekan — dipakai tombol Kembali di Profil Toko. '' = tidak ada target.
var kembaliKeDetailDariPengaturan = '';
// v4-45: tab detail yang ditinggalkan (detail/struk/retur/...) — dipulihkan saat kembali.
var kembaliKeDetailTabDariPengaturan = '';
function detailTersortir() {
  return (DATA.transaksi || []).slice().sort(function (a, b) { return String(b.Tanggal || '') < String(a.Tanggal || '') ? -1 : 1; });
}
async function bukaDetailTrx(id, tabAwal) {
  detailTrxId = id;
  // v4-45: tab awal boleh ditentukan pemanggil (kembali dari Profil Toko
  // memulihkan tab yang ditinggalkan, bukan selalu 'detail').
  detailTab = (tabAwal === 'struk' || tabAwal === 'retur' || tabAwal === 'tambah' || tabAwal === 'bayar') ? tabAwal : 'detail';
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  // Struk transaksi lama: nomor WA pelanggan tidak tersimpan, jadi kosongkan
  // agar kirim teks membuka wa.me dan Bos memilih sendiri kontaknya.
  lastWaTelp = '';
  lastStrukData = strukDataDariTrx(t);
  lastStruk = strukTeks(lastStrukData);
  document.getElementById('strukPrint').innerHTML = strukKeHtml(lastStruk);
  renderDetailTrx();
  show('detailTrx');
}
// v4-44: tombol Pengaturan di detail transaksi — catat struk asal sebelum
// pindah ke Pengaturan, supaya tombol Kembali di Profil Toko bisa balik
// ke struk yang sama (entri detail diganti navGanti saat pindah section,
// jadi riwayat saja tidak cukup untuk kembali ke struk).
function bukaPengaturanDariDetail() {
  kembaliKeDetailDariPengaturan = detailTrxId || '';
  kembaliKeDetailTabDariPengaturan = detailTab || 'detail';
  show('pengaturan', document.querySelector('nav button.menu[data-sec="pengaturan"]'));
}
function detailTabKe(tab) {
  detailTab = tab;
  if (tab === 'tambah') tambahProdukId = '';
  renderDetailTrx();
}
function renderDetailTrx() {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === detailTrxId; });
  var el = document.getElementById('detailTrxBody');
  if (!t) { el.innerHTML = '<p style="color:#64748b">Transaksi tidak ditemukan.</p>'; return; }
  if (!trxNomor[t.ID]) hitungNomorTrx();
  var d = new Date(t.Tanggal);
  var kembali = Math.max(0, Number(t.Bayar || 0) - Number(t.Total || 0));
  var items = (DATA.detail || []).filter(function (x) { return x.TransaksiID === t.ID; });
  var no = trxNomor[t.ID] || '';
  var kode = t.KodeAlternatif || String(t.ID).slice(-6);
  var html = '<div class="dhead"><button class="dhead-btn" onclick="kembali()">←</button><b>Transaksi #' + no + '</b><button class="dhead-btn" onclick="bukaPengaturanDariDetail()">' + ikon('gear', 17) + '</button></div>';
  if (detailTab === 'retur') {
    html += '<div class="card" style="margin:12px"><h4 style="margin:0 0 4px">↩ Retur Item</h4>'
      + '<div style="font-size:13px;color:#64748b;margin-bottom:10px">Stok dikembalikan, total transaksi dikurangi. Centang item yang dikembalikan, atur jumlahnya — nominal dihitung otomatis ((harga − diskon item) × jumlah).</div>'
      + (items.length ? items.map(function (x, i) {
        return '<div class="cart-item"><span><label class="checkrow"><input type="checkbox" class="returChk" data-i="' + i + '" onchange="returHitung()"> ' + esc(x.NamaProduk) + '</label><br><small>' + x.Qty + ' x ' + rp(x.Harga) + ' • maks ' + x.Qty + '</small></span>'
          + '<span style="text-align:right"><span class="qty-ctl"><button onclick="returQtyUbah(' + i + ',-1)">−</button><b class="qty-badge" id="returQty' + i + '">0</b><button onclick="returQtyUbah(' + i + ',1)">+</button></span><br><b id="returNom' + i + '">Rp0</b></span></div>';
      }).join('') : '<p style="color:#64748b">Tidak ada rincian item.</p>')
      + '<label style="margin-top:10px">Alasan (opsional) <input id="returAlasanDetail" placeholder="Mis. barang rusak"></label>'
      + '<div style="font-weight:700;margin:10px 0">Total kembali: <span id="returTotalNom">Rp0</span></div>'
      + '<div class="flex noprint"><button class="primary" style="flex:1" onclick="simpanReturDetail()">Simpan Retur</button><button class="secondary" onclick="detailTabKe(\'detail\')">Batal</button></div></div>';
  } else if (detailTab === 'tambah') {
    var prods = (DATA.produk || []).filter(produkAktif);
    html += '<div class="card" style="margin:12px"><h4 style="margin:0 0 8px">＋ Item Transaksi</h4>'
      + '<label>Cari produk / barcode <input id="tambahCari" list="tambahDatalist" placeholder="Ketik nama atau scan barcode…" oninput="tambahPilihProduk()"><datalist id="tambahDatalist">' + prods.map(function (p) { return '<option value="' + esc(p.Nama) + '">' + esc(p.Nama) + ' — ' + rp(p.HargaJual) + '</option>'; }).join('') + '</datalist></label>'
      + '<div id="tambahInfo" style="font-size:13px;color:#64748b;margin:6px 0">Pilih produk dulu.</div>'
      + '<div class="flex"><label>Jumlah <input id="tambahQty" type="number" value="1" min="0.1" step="0.1" oninput="tambahHitungTotal()"></label><label>Satuan <input id="tambahSatuan" value="pcs"></label></div>'
      + '<label>Item note (opsional) <input id="tambahNote" placeholder="Mis. tanpa gula"></label>'
      + '<div style="font-weight:700;margin:10px 0">Total: <span id="tambahTotal">Rp0</span></div>'
      + '<div class="flex noprint"><button class="primary" style="flex:1" onclick="simpanTambahItem()">SIMPAN</button><button class="secondary" onclick="detailTabKe(\'detail\')">Batal</button></div></div>';
  } else if (detailTab === 'struk') {
    html += '<div class="struk-preview">' + (lastStruk ? '<div class="struk-box">' + strukKeHtml(lastStruk) + '</div>' : '<p style="color:#94a3b8;text-align:center">Struk tidak tersedia.</p>') + '</div>'
      + '<div class="detail-tabs"><button class="detail-tab" onclick="bukaPengaturanDariDetail()"><span>' + ikon('gear', 17) + '</span>Pengaturan</button><button class="detail-tab" onclick="window.print()"><span>' + ikon('printer', 17) + '</span>Cetak</button><button class="detail-tab" onclick="kirimWAGambar()"><span>' + ikon('chat', 17) + '</span>WhatsApp</button></div>';
  } else if (detailTab === 'bayar') {
    html += '<div class="card" style="margin:12px"><h4 style="margin:0 0 8px">' + ikon('banknote', 18) + ' Detil Pembayaran</h4>'
      + '<div class="drow"><span class="k">' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(d) + '</span><span>Total ' + rp(t.Total) + '</span></div>'
      + htmlRiwayatBayar(t)
      + (Number(t.Sisa) > 0 ? '<div class="drow"><span class="k">Sisa</span><b>' + rp(t.Sisa) + '</b></div>' : '<div class="drow"><span class="k">Kembali</span><span>' + rp(kembali) + '</span></div>')
      + '<div class="drow"><span class="k">Status</span><span class="' + (t.StatusBayar === 'Lunas' ? 'trx-lunas' : 'trx-hutang') + '">' + esc(t.StatusBayar) + '</span></div>'
      + (Number(t.Sisa) > 0 ? '<div style="margin-top:12px"><button class="primary" onclick="lunasiDetail(\'' + esc(t.ID) + '\')">+ Bayar Sisa ' + rp(t.Sisa) + '</button></div>' : '')
      + '</div>'
      + '<div class="detail-tabs"><button class="detail-tab" onclick="bukaLebih(\'' + esc(t.ID) + '\')"><span>•••</span>Lebih</button><button class="detail-tab" onclick="detailTabKe(\'struk\')"><span>' + ikon('receipt', 17) + '</span>Struk</button><button class="detail-tab active"><span>' + ikon('banknote', 17) + '</span>Pembayaran</button></div>';
  } else {
    var list = detailTersortir();
    var idx = -1; list.forEach(function (x, i) { if (x.ID === t.ID) idx = i; });
    // daftar terurut terbaru dulu — sblm (idx-1) = LEBIH BARU,
    // ssdh (idx+1) = LEBIH LAMA. Jadi ‹ ke yang lebih lama (ssdh) dan
    // › ke yang lebih baru (sblm); dulu terbalik.
    var sblm = idx > 0 ? list[idx - 1].ID : '', ssdh = (idx >= 0 && idx < list.length - 1) ? list[idx + 1].ID : '';
    html += '<div class="dtop"><div><div class="dtop-total">' + rp(t.Total) + '</div><div style="margin-top:6px"><span class="dkode">' + esc(kode) + '</span></div></div>'
      + '<div style="text-align:right"><div>' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(d) + '</div><div style="margin-top:6px;font-size:16px">' + esc(t.Pelanggan || '') + '</div></div></div>'
      + (t.StatusBayar !== 'Lunas' ? '<div class="banner-belum-lunas">Transaksi belum lunas. Anda masih bisa melakukan perubahan.</div>' : '')
      + '<div class="ditems">' + (items.length ? items.map(function (x) {
        return '<div class="ditem"><div><b>' + esc(x.NamaProduk) + '</b><div class="ditem-sub">' + x.Qty + ' x ' + rp(x.Harga) + '</div></div><b>' + rp(x.Subtotal) + '</b></div>';
      }).join('') : '<p style="color:#64748b">Tidak ada rincian item.</p>') + '</div>'
      + '<div style="display:flex;gap:8px;margin:10px 0">'
      + (izinAktif('tambahItemLama') ? '<button class="secondary" style="flex:1" onclick="detailTabKe(\'tambah\')">＋ Tambah Item</button>' : '')
      + (izinAktif('retur') ? '<button class="secondary" style="flex:1" onclick="detailTabKe(\'retur\')">↩ Retur Item</button>' : '')
      + '</div>'
      + '<div class="dtotal"><span>Total</span><b>' + rp(t.Total) + '</b></div>'
      + (Number(t.Sisa) > 0 ? '<div class="dtotal"><span>Kurang</span><b style="color:#dc2626">' + rp(t.Sisa) + '</b></div>' : '')
      + '<div class="dtotal-lunas">' + esc(t.StatusBayar).toUpperCase() + '</div>'
      + '<div class="card" style="margin:12px 0"><h4 style="margin:0 0 8px">' + ikon('banknote', 18) + ' Detil Pembayaran</h4>'
      + '<div class="drow"><span class="k">' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(d) + '</span><span>Total ' + rp(t.Total) + '</span></div>'
      + htmlRiwayatBayar(t) + '</div>'
      + htmlRiwayatRetur(t)
      + '<div style="text-align:right;color:#64748b;margin:0 4px">- ' + esc(t.Kasir || '') + '</div>'
      + '<button class="primary" style="width:100%;margin:12px 0 0" onclick="transaksiBaruDariDetail()">＋ Transaksi Baru</button>'
      + '<div style="display:flex;justify-content:space-between;margin:14px 4px"><button class="nav-arrow" ' + (ssdh ? 'onclick="bukaDetailTrx(\'' + esc(ssdh) + '\')"' : 'disabled') + '>‹</button><button class="nav-arrow" ' + (sblm ? 'onclick="bukaDetailTrx(\'' + esc(sblm) + '\')"' : 'disabled') + '>›</button></div>'
      + '<div class="detail-tabs"><button class="detail-tab" onclick="bukaLebih(\'' + esc(t.ID) + '\')"><span>•••</span>Lebih</button><button class="detail-tab" onclick="detailTabKe(\'struk\')"><span>' + ikon('receipt', 17) + '</span>Struk</button><button class="detail-tab" onclick="detailTabKe(\'bayar\')"><span>' + ikon('banknote', 17) + '</span>Pembayaran</button></div>';
  }
  el.innerHTML = html;
}
async function lunasiDetail(id) { await lunasi(id); renderTrx(); renderDetailTrx(); }
// v4-45: ubahStatus/ubahStatusDetail DIHAPUS — dead code: tidak ada UI yang
// memanggilnya (kasir selalu kirim status 'Selesai'). DB.ubahStatusPesanan
// di supabase.js tetap ada bila suatu saat dibutuhkan.
async function batalkanDetail(id) {
  await batalkanTransaksi(id);
  renderTrx();
  // Bila batal berhasil, trx sudah hilang — kembali ke Daftar, jangan
  // menampilkan detail kosong ("Transaksi tidak ditemukan.").
  var masihAda = (DATA.transaksi || []).some(function (x) { return x.ID === id; });
  if (masihAda) renderDetailTrx(); else show('daftar', document.querySelector('nav button.menu[data-sec="daftar"]'));
}
/* ---------- RIWAYAT BAYAR & RETUR per transaksi (Detail) ---------- */
// Pembayaran dicatat di kas: 'Penjualan TRX-…' (bayar pertama) dan
// 'Pelunasan TRX-…' (bayar sisa) — keduanya dibaca dari sini supaya Detil
// Pembayaran menampung lebih dari satu catatan bayar.
function riwayatBayarTrx(t) {
  return (DATA.kas || []).filter(function (k) {
    return k.Jenis === 'Masuk' && String(k.Keterangan || '').indexOf(t.ID) >= 0;
  }).sort(function (a, b) { return String(a.Tanggal || '') < String(b.Tanggal || '') ? -1 : 1; });
}
function htmlRiwayatBayar(t) {
  var rows = riwayatBayarTrx(t);
  if (!rows.length) return '<div class="drow"><span class="k">' + esc(t.Metode || 'Tunai') + '</span><b>' + rp(t.Bayar) + '</b></div>';
  return rows.map(function (k) {
    var dk = new Date(k.Tanggal);
    var label = String(k.Keterangan || '').indexOf('Pelunasan') === 0 ? 'Pelunasan' : esc(t.Metode || 'Tunai');
    return '<div class="drow"><span class="k">' + dk.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(dk) + ' • ' + label + '</span><b>' + rp(k.Masuk) + '</b></div>';
  }).join('');
}
function htmlRiwayatRetur(t) {
  var list = (DATA.retur || []).filter(function (r) { return String(r.TransaksiID) === String(t.ID); });
  if (!list.length) return '';
  return '<div class="card" style="margin:12px 0"><h4 style="margin:0 0 8px">↩ Retur</h4>' + list.map(function (r) {
    return '<div class="drow"><span class="k">' + new Date(r.Tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' • ' + esc(r.Produk) + ' x' + r.Qty + (r.Alasan ? ' (' + esc(r.Alasan) + ')' : '') + '</span><b>−' + rp(r.Nominal) + '</b></div>';
  }).join('') + '</div>';
}
function transaksiBaruDariDetail() {
  kosongkanCart();
  var sel = document.getElementById('kasirPelanggan'); if (sel) { sel.value = 'Umum'; pelangganDipilih(); }
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]'));
}
function bukaProfilToko() {
  closeDrawer();
  show('pengaturan', document.querySelector('nav button.menu[data-sec="pengaturan"]'));
  var el = document.getElementById('profilTokoCard');
  if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
}
/* ---------- RETUR ITEM dari Detail Transaksi ---------- */
function returQtyUbah(i, delta) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === detailTrxId; }); if (!t) return;
  var items = (DATA.detail || []).filter(function (x) { return x.TransaksiID === t.ID; });
  var it = items[i]; if (!it) return;
  var badge = document.getElementById('returQty' + i); if (!badge) return;
  var q = Math.max(0, Math.min(Number(it.Qty || 0), Number(badge.textContent || 0) + delta));
  badge.textContent = q;
  var chk = document.querySelector('.returChk[data-i="' + i + '"]'); if (chk) chk.checked = q > 0;
  returHitung();
}
// v4-45: nominal kembali per item memakai harga SETELAH diskon item.
function hargaNetItem(x) { return Math.max(0, Number(x.Harga || 0) - Number(x.DiskonItem || 0)); }
function returHitung() {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === detailTrxId; }); if (!t) return;
  var items = (DATA.detail || []).filter(function (x) { return x.TransaksiID === t.ID; });
  var total = 0;
  items.forEach(function (x, i) {
    var badge = document.getElementById('returQty' + i);
    var chk = document.querySelector('.returChk[data-i="' + i + '"]');
    var q = (chk && chk.checked && badge) ? Number(badge.textContent || 0) : 0;
    var nom = hargaNetItem(x) * q;
    var el = document.getElementById('returNom' + i); if (el) el.textContent = rp(nom);
    total += nom;
  });
  var tt = document.getElementById('returTotalNom'); if (tt) tt.textContent = rp(total);
}
async function simpanReturDetail() {
  var _btn = null, _teksBtn = '';
  try { _btn = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _btn = null; }
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === detailTrxId; }); if (!t) return;
  var items = (DATA.detail || []).filter(function (x) { return x.TransaksiID === t.ID; });
  var pilih = [];
  items.forEach(function (x, i) {
    var chk = document.querySelector('.returChk[data-i="' + i + '"]');
    var badge = document.getElementById('returQty' + i);
    var q = (chk && chk.checked && badge) ? Number(badge.textContent || 0) : 0;
    if (q > 0) pilih.push({ item: x, qty: Math.min(q, Number(x.Qty || 0)) });
  });
  if (!pilih.length) return tampilError('Pilih minimal 1 item untuk diretur.');
  var alasan = (document.getElementById('returAlasanDetail') || {}).value || '';
  var totalNom = pilih.reduce(function (a, p) { return a + hargaNetItem(p.item) * p.qty; }, 0);
  if (!await konfirmasi('Simpan retur?', pilih.length + ' item dikembalikan, total kembali ' + rp(totalNom) + '. Stok dikembalikan dan total transaksi dikurangi.', 'Ya, Simpan Retur', 'primary')) return;
  // umpan balik instan — tombol "Menyimpan…" + toast.
  if (_btn) { _teksBtn = _btn.textContent; _btn.disabled = true; _btn.textContent = 'Menyimpan…'; }
  tampilInfo('Menyimpan…');
  try {
    for (var k = 0; k < pilih.length; k++) {
      var p = pilih[k];
      var isi = 1;
      if (p.item.SatuanDipakai) {
        var prod = (DATA.produk || []).find(function (x) { return String(x.ID) === String(p.item.ProdukID); });
        if (prod) { var vr = []; try { vr = JSON.parse(prod.VarianJSON || '[]'); } catch (e) { } var v = vr.find(function (z) { return z.label === p.item.SatuanDipakai; }); if (v) isi = Number(v.isi || 1); }
      }
      await DB.simpanRetur({ transaksiId: t.ID, produk: p.item.NamaProduk, produkId: p.item.ProdukID || '', qty: p.qty, stokQty: p.qty * isi, nominal: hargaNetItem(p.item) * p.qty, alasan: alasan });
    }
    await loadData();
    detailTab = 'detail'; renderDetailTrx();
    tampilInfo('Retur tersimpan. Stok dikembalikan, total kembali ' + rp(totalNom) + '.');
  } catch (e) { tampilError('Gagal menyimpan retur: ' + (e.message || e)); } finally { if (_btn) { _btn.disabled = false; _btn.textContent = _teksBtn; } }
}
/* ---------- TAMBAH ITEM ke Transaksi Lama (alur Griyo) ---------- */
var tambahProdukId = '';
function tambahPilihProduk() {
  var inp = document.getElementById('tambahCari'); if (!inp) return;
  var v = (inp.value || '').trim();
  var p = (DATA.produk || []).find(function (x) { return x.Nama === v; })
    || (DATA.produk || []).find(function (x) { return String(x.SKU || x['SKU/Barcode'] || '').trim() === v; });
  var info = document.getElementById('tambahInfo');
  if (p) {
    tambahProdukId = p.ID;
    if (inp.value !== p.Nama) inp.value = p.Nama;
    if (info) info.textContent = p.Nama + ' — ' + rp(p.HargaJual) + ' • Stok: ' + stokProduk(p);
  } else {
    tambahProdukId = '';
    if (info) info.textContent = v ? 'Produk tidak ditemukan — pilih dari daftar.' : 'Pilih produk dulu.';
  }
  tambahHitungTotal();
}
function tambahHitungTotal() {
  var el = document.getElementById('tambahTotal'); if (!el) return;
  var p = (DATA.produk || []).find(function (x) { return x.ID === tambahProdukId; });
  if (!p) { el.textContent = 'Rp0'; return; }
  var qty = Math.max(0.1, Number((document.getElementById('tambahQty') || {}).value || 1));
  el.textContent = rp(Number(p.HargaJual || 0) * qty);
}
async function simpanTambahItem() {
  var _btn = null, _teksBtn = '';
  try { _btn = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _btn = null; }
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === detailTrxId; }); if (!t) return;
  if (!tambahProdukId) return tampilError('Pilih produk dulu.');
  var p = (DATA.produk || []).find(function (x) { return x.ID === tambahProdukId; }); if (!p) return tampilError('Produk tidak ditemukan.');
  var qty = Math.max(0.1, Number((document.getElementById('tambahQty') || {}).value || 1));
  // v4-45: produk bersatuan bulat tetap dibulatkan (qty pecahan hanya
  // untuk satuan Desimal=YA).
  if (!satuanDesimal(p.Satuan)) qty = Math.round(qty);
  var satuan = ((document.getElementById('tambahSatuan') || {}).value || 'pcs').trim() || 'pcs';
  var note = ((document.getElementById('tambahNote') || {}).value || '').trim();
  if (t.StatusBayar === 'Lunas') {
    if (!await konfirmasi('Transaksi sudah lunas, anda ingin menambah item baru?', 'Item ditambahkan dan transaksi menjadi belum lunas sampai sisa dibayar.', 'Ya', 'primary')) return;
  }
  // umpan balik instan — tombol "Menyimpan…" + toast.
  if (_btn) { _teksBtn = _btn.textContent; _btn.disabled = true; _btn.textContent = 'Menyimpan…'; }
  tampilInfo('Menyimpan…');
  try {
    var res = await DB.tambahItemTrx({ id: t.ID, produkId: p.ID, qty: qty, harga: Number(p.HargaJual || 0), satuan: satuan, note: note });
    await loadData();
    detailTab = 'detail'; renderDetailTrx();
    tampilInfo('Item ditambahkan. Total ' + rp(res.total || 0) + ' • Kurang ' + rp(res.sisa || 0) + '.');
  } catch (e) { tampilError('Gagal menambah item: ' + (e.message || e)); } finally { if (_btn) { _btn.disabled = false; _btn.textContent = _teksBtn; } }
}
/* ---------- SHEET "LEBIH" di Detail Transaksi ---------- */
function bukaLebih(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var item = function (ikonSvg, label, fn, merah) {
    return '<button class="lebih-item' + (merah ? ' merah' : '') + '" onclick="' + fn + '(\'' + esc(id) + '\')"><span class="lebih-ikon">' + ikonSvg + '</span>' + label + '</button>';
  };
  document.getElementById('lebihItems').innerHTML =
    item(ikon('calendar', 20), 'Ganti Tanggal', 'lebihGantiTanggal')
    + item(ikon('type', 20), 'Ganti Kode Transaksi', 'lebihGantiKode')
    + item(ikon('user', 20), 'Ganti Pelanggan', 'lebihGantiPelanggan')
    + item(ikon('receipt', 20), 'Catatan Struk', 'lebihCatatanStruk')
    + item(ikon('filetext', 20), 'Catatan Internal', 'lebihCatatanInternal')
    + item('↩', 'Retur Item', 'lebihRetur')
    + item('✕', 'Batalkan Transaksi', 'lebihBatalkan', true);
  document.getElementById('lebihBackdrop').style.display = 'block';
  document.getElementById('lebihSheet').style.display = 'block';
}
function tutupLebih() {
  document.getElementById('lebihBackdrop').style.display = 'none';
  document.getElementById('lebihSheet').style.display = 'none';
}
function pad2(n) { return String(n).padStart(2, '0'); }
async function lebihGantiTanggal(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var d = new Date(t.Tanggal);
  var awal = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  var baru = prompt('Tanggal baru (YYYY-MM-DD):', awal);
  if (!baru || !/^\d{4}-\d{2}-\d{2}$/.test(baru)) { tutupLebih(); return; }
  var nd = new Date(baru + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()));
  // Simpan dalam format lokal yang sama seperti nowISO() — toISOString()
  // (UTC) membuat transaksi pindah hari (22 Nov 00:30 WIB jadi 21 Nov).
  var off = -nd.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
  var oh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), om = String(Math.abs(off) % 60).padStart(2, '0');
  var lokal = baru + ' ' + pad2(nd.getHours()) + ':' + pad2(nd.getMinutes()) + ':' + pad2(nd.getSeconds()) + sign + oh + ':' + om;
  try { await DB.ubahTransaksi({ id: id, Tanggal: lokal }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { tampilError(e.message); }
}
async function lebihGantiKode(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Kode transaksi baru:', t.KodeAlternatif || '');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, KodeAlternatif: baru.trim() }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { tampilError(e.message); }
}
async function lebihGantiPelanggan(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Pelanggan baru:', t.Pelanggan || 'Umum');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, Pelanggan: baru.trim() || 'Umum' }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { tampilError(e.message); }
}
async function lebihCatatanStruk(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Catatan struk (tampil di struk):', t.CatatanStruk || '');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, CatatanStruk: baru }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { tampilError(e.message); }
}
async function lebihCatatanInternal(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Catatan internal (tidak tampil di struk):', t.CatatanInternal || '');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, CatatanInternal: baru }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { tampilError(e.message); }
}
async function lebihBatalkan(id) { tutupLebih(); await batalkanDetail(id); }
function lebihRetur(id) { tutupLebih(); detailTabKe('retur'); }
/* ---------- TRANSAKSI CEPAT & TERTUNDA ---------- */
function renderCepat() {
  document.getElementById('cepatList').innerHTML = (DATA.transaksiCepat || []).filter(milikCabangSesi).map(function (c) {
    var items = []; try { items = JSON.parse(c.ItemsJSON || '[]'); } catch (e) { }
    return '<div class="cart-item"><span><b>' + esc(c.Nama) + '</b> — ' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '</span><span><button class="primary" onclick="muatCepat(\'' + esc(c.ID) + '\')">Muat ke Kasir</button> <button class="danger" onclick="hapusCepat(\'' + esc(c.ID) + '\', this)">Hapus</button></span></div>';
  }).join('') || 'Belum ada template Transaksi Cepat.';
  document.getElementById('tertundaList').innerHTML = (DATA.transaksiTertunda || []).filter(milikCabangSesi).map(function (t) {
    return '<div class="cart-item"><span><b>' + esc(t.ID) + '</b> — ' + esc(t.Pelanggan) + ' — ' + rp(t.Total) + ' • ' + new Date(t.Tanggal).toLocaleString('id-ID') + '</span><span><button class="primary" onclick="lanjutkanTertunda(\'' + esc(t.ID) + '\')">Lanjutkan</button> <button class="danger" onclick="hapusTertunda(\'' + esc(t.ID) + '\', this)">Hapus</button></span></div>';
  }).join('') || 'Tidak ada transaksi tertunda.';
}
async function simpanCepatDariKasir() {
  if (!cart.length) return tampilError('Keranjang masih kosong.');
  var nama = prompt('Nama template Transaksi Cepat:', 'Transaksi Cepat ' + ((DATA.transaksiCepat || []).length + 1)); if (!nama) return;
  await DB.simpanCepat({ nama: nama, pelanggan: document.getElementById('kasirPelanggan').value, items: cart, cabangId: cabangSesiId() });
  await loadData(); tampilInfo('Template tersimpan: ' + nama);
}
function muatCepat(id) {
  var c = (DATA.transaksiCepat || []).find(function (x) { return x.ID === id; }); if (!c) return;
  try {
    var items = JSON.parse(c.ItemsJSON || '[]');
    cart = items.map(function (i) { return { id: i.id || i.ProdukID || '', nama: i.nama || i.Nama || '', Harga: Number(i.Harga || 0), modal: 0, Qty: Number(i.Qty || 1), diskonItem: 0, satuanDipakai: '', hargaLainLabel: '' }; });
  } catch (e) { return tampilError('Template rusak.'); }
  setModeKasir('reguler');
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]')); renderCart();
}
async function hapusCepat(id, el) { if (!await konfirmasi('Hapus template?', 'Template transaksi cepat ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusCepat({ id: id }); await loadData(); tampilInfo('Template dihapus.'); } catch (e) { tampilError('Gagal menghapus template: ' + (e.message || e)); } }
async function parkirTransaksi() {
  if (!cart.length) return tampilError('Keranjang masih kosong.');
  var h = hitungCart();
  await DB.parkirTransaksi({ pelanggan: document.getElementById('kasirPelanggan').value, kasir: currentUser ? currentUser.nama : 'Kasir', items: cart, total: h.total, cabangId: cabangSesiId(), meja: document.getElementById('kasirMeja').value || '', catatan: document.getElementById('kasirCatatanInternal').value || '' });
  cart = []; bayarManual = false; document.getElementById('kasirBayar').value = ''; renderCart(); await loadData(); tampilInfo('Transaksi diparkir (Tertunda).');
}
async function lanjutkanTertunda(id) {
  var res = await DB.muatTertunda({ id: id });
  var items = res.items || [];
  cart = items.map(function (i) { return { id: i.id || i.ProdukID || '', nama: i.nama || i.Nama || '', Harga: Number(i.Harga || 0), modal: 0, Qty: Number(i.Qty || 1), diskonItem: 0, satuanDipakai: '', hargaLainLabel: '' }; });
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]')); renderCart();
}
async function hapusTertunda(id, el) { if (!await konfirmasi('Hapus transaksi tertunda?', 'Transaksi tertunda ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusTertunda({ id: id }); await loadData(); tampilInfo('Transaksi tertunda dihapus.'); } catch (e) { tampilError('Gagal menghapus transaksi tertunda: ' + (e.message || e)); } }

/* ---------- PRODUK ---------- */
/* v4-34: status filter halaman Produk. Disimpan di variabel (bukan hanya
   nilai input) supaya renderProdukTable() konsisten saat dipanggil ulang
   oleh loadData(), dan supaya sim bisa mengujinya tanpa DOM penuh. */
var filterGrupProduk = 'Semua';
var cariProdukTeks = '';

// Daftar grup dari produk aktif, lengkap dengan hitungan produk per grup.
// Produk tanpa Grup masuk "Tanpa grup" (paling akhir); sisanya diurutkan
// dari grup dengan produk terbanyak.
function daftarGrupProduk(list) {
  var hitung = {};
  (list || []).forEach(function (p) {
    var g = String(p.Grup || '').trim() || 'Tanpa grup';
    hitung[g] = (hitung[g] || 0) + 1;
  });
  var semua = Object.keys(hitung).map(function (g) { return { nama: g, jumlah: hitung[g] }; });
  semua.sort(function (a, b) {
    if (a.nama === 'Tanpa grup') return 1;
    if (b.nama === 'Tanpa grup') return -1;
    return b.jumlah - a.jumlah;
  });
  return semua;
}

// Saring daftar produk master: grup dulu, lalu teks cari (Nama ATAU
// SKU/barcode, case-insensitive, substring). 'Semua' = tanpa filter grup.
function saringProdukMaster(list, grup, q) {
  var teks = String(q || '').trim().toLowerCase();
  return (list || []).filter(function (p) {
    if (!milikCabangSesi(p)) return false;
    if (grup && grup !== 'Semua') {
      var g = String(p.Grup || '').trim() || 'Tanpa grup';
      if (g !== grup) return false;
    }
    if (teks) {
      var nama = String(p.Nama || '').toLowerCase();
      var sku = String(p.SKU || p['SKU/Barcode'] || '').toLowerCase();
      if (nama.indexOf(teks) < 0 && sku.indexOf(teks) < 0) return false;
    }
    return true;
  });
}

// Total Modal/Jual/Laba atas daftar yang sedang ditampilkan. Hanya produk
// yang termasuk stok (lacakStok) yang dihitung; HargaModal 0 ditampilkan
// apa adanya (tidak disembunyikan, tidak ada peringatan).
function hitungTotalProduk(list) {
  var t = { modal: 0, jual: 0, laba: 0, produk: 0, stok: 0 };
  (list || []).forEach(function (p) {
    if (!milikCabangSesi(p)) return;
    t.produk++;
    if (!lacakStok(p)) return;
    var stok = stokProduk(p);
    t.stok += stok;
    t.modal += stok * Number(p.HargaModal || 0);
    t.jual += stok * Number(p.HargaJual || 0);
  });
  t.laba = t.jual - t.modal;
  return t;
}

function renderProdukTable() {
  var hideHPP = sembunyikanHPP();
  // v4-34: baca teks cari dari input bila ada (input ditambahkan bersama
  // header baru; bila belum ada, pakai status variabel).
  var inp = document.getElementById('cariProdukMaster');
  if (inp) cariProdukTeks = inp.value || '';
  var list = saringProdukMaster((DATA.produk || []).filter(function (p) { return produkAktif(p) && milikCabangSesi(p); }), filterGrupProduk, cariProdukTeks);
  var tot = hitungTotalProduk(list);
  var c1 = document.getElementById('produkCount'); if (c1) c1.textContent = 'Produk: ' + tot.produk;
  var c2 = document.getElementById('produkStokCount'); if (c2) c2.textContent = 'Stok: ' + tot.stok + ' pcs';
  var m = document.getElementById('produkTotalModal'); if (m) m.textContent = rp(tot.modal);
  var j = document.getElementById('produkTotalJual'); if (j) j.textContent = rp(tot.jual);
  var l = document.getElementById('produkTotalLaba'); if (l) l.textContent = rp(tot.laba);
  var hapus = document.getElementById('btnHapusCariProduk'); if (hapus) hapus.style.display = cariProdukTeks ? '' : 'none';
  var fb = document.getElementById('filterGrupLabel'); if (fb) fb.textContent = filterGrupProduk;
  renderDropdownGrup();
  document.getElementById('produkTable').innerHTML = list.length ? '<div class="plist">' + list.map(function (p) {
    var laba = Number(p.HargaJual) - Number(p.HargaModal || 0);
    return '<div class="prow" onclick="editProduk(\'' + esc(p.ID) + '\')"><div class="pinfo"><b>' + esc(p.Nama) + '</b><span>Stok: ' + stokProduk(p) + ' ' + esc(p.Satuan || 'pcs') + (p.SKU || p['SKU/Barcode'] ? ' • ' + esc(p.SKU || p['SKU/Barcode']) : '') + '</span></div><div class="pharga"><b>' + rp(p.HargaJual) + '</b>' + (hideHPP ? '' : '<span>Laba: ' + rp(laba) + '</span>') + '</div></div>';
  }).join('') + '</div>' : '<p style="color:#64748b">Belum ada produk. Ketuk tombol + untuk menambah.</p>';
}

// Isi panel dropdown filter grup (dipanggil tiap render supaya hitungan
// selalu segar). Panelnya sendiri ditampilkan/disembunyikan oleh
// toggleDropdownGrup(); elemen belum ada = tidak apa-apa (header baru).
function renderDropdownGrup() {
  var d = document.getElementById('dropdownGrupProduk');
  if (!d) return;
  var aktif = (DATA.produk || []).filter(function (p) { return produkAktif(p) && milikCabangSesi(p); });
  var grups = daftarGrupProduk(aktif);
  var html = '<div class="drop-item' + (filterGrupProduk === 'Semua' ? ' aktif' : '') + '" onclick="pilihGrupProduk(\'Semua\')">Semua (' + aktif.length + ')' + (filterGrupProduk === 'Semua' ? ' ✓' : '') + '</div>';
  grups.forEach(function (g) {
    html += '<div class="drop-item' + (filterGrupProduk === g.nama ? ' aktif' : '') + '" onclick="pilihGrupProduk(\'' + escJS(g.nama) + '\')">' + esc(g.nama) + ' (' + g.jumlah + ')' + (filterGrupProduk === g.nama ? ' ✓' : '') + '</div>';
  });
  d.innerHTML = html;
}
function pilihGrupProduk(grup) {
  filterGrupProduk = grup || 'Semua';
  tutupDropdownGrup();
  renderProdukTable();
}
function toggleDropdownGrup() {
  var d = document.getElementById('dropdownGrupProduk');
  if (!d) return;
  if (d.style.display === 'block') { d.style.display = 'none'; return; }
  renderDropdownGrup();
  d.style.display = 'block';
}
function tutupDropdownGrup() {
  var d = document.getElementById('dropdownGrupProduk');
  if (d) d.style.display = 'none';
}
function toggleMenuLainnyaProduk() {
  var d = document.getElementById('menuLainnyaProduk');
  if (!d) return;
  d.style.display = d.style.display === 'block' ? 'none' : 'block';
}
function tutupMenuLainnyaProduk() {
  var d = document.getElementById('menuLainnyaProduk');
  if (d) d.style.display = 'none';
}
function bersihkanCariProduk() {
  cariProdukTeks = '';
  var inp = document.getElementById('cariProdukMaster');
  if (inp) inp.value = '';
  renderProdukTable();
}

// v4-34: ketuk di luar panel dropdown (filter grup / menu Lainnya)
// menutup panel. closest() menjaga ketuk di dalam panel/tombolnya.
// Guard typeof: sim headless (sim-beban dkk.) memakai document tiruan
// tanpa addEventListener — di sana listener ini dilewati.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', function (ev) {
    var t = (ev && ev.target) || {};
    var diDalam = (t.closest && t.closest('#dropdownGrupProduk,#btnFilterGrup,#menuLainnyaProduk,#btnLainnyaProduk')) || null;
    if (!diDalam) { tutupDropdownGrup(); tutupMenuLainnyaProduk(); }
  });
}
// v4-45: form Tambah dan Edit produk DIPISAH (aturan Bos) — semua helper
// form produk memakai awalan id: 'pt' (tambah) atau 'pe' (edit).
function hitungLabaProduk(pref) {
  pref = pref || 'pt';
  var jual = parseUang(document.getElementById(pref + 'Jual').value), modal = parseUang(document.getElementById(pref + 'Modal').value);
  var el = document.getElementById(pref + 'Laba'); if (el) el.textContent = rp(jual - modal);
}
function tampilGambarProduk(pref) {
  pref = pref || 'pt';
  var url = document.getElementById(pref + 'Gambar').value || '';
  var img = document.getElementById(pref + 'GambarPreview'); if (img) { img.src = url || ''; img.style.display = url ? 'block' : 'none'; }
  var box = document.getElementById(pref + 'GambarBox'); if (box) box.style.display = url ? 'none' : 'flex';
  var h = document.getElementById(pref + 'GambarHapusBtn'); if (h) h.style.display = url ? 'block' : 'none';
}
function pilihGambarProduk(input, pref) {
  pref = pref || 'pt';
  var f = input.files && input.files[0]; if (!f) return;
  if (!/^image\//.test(f.type || '')) { tampilError('Pilih file gambar (PNG/JPG).'); input.value = ''; return; }
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () { var url = kecilkanLogo(img, 512); if (url.length > 200000) url = kecilkanLogo(img, 256); document.getElementById(pref + 'Gambar').value = url; tampilGambarProduk(pref); };
    img.onerror = function () { tampilError('File gambar tidak bisa dibaca.'); };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function hapusGambarProduk(pref) { pref = pref || 'pt'; document.getElementById(pref + 'Gambar').value = ''; var inp = document.getElementById(pref + 'GambarFile'); if (inp) inp.value = ''; tampilGambarProduk(pref); }
function editProduk(id) {
  var p = DATA.produk.find(function (x) { return x.ID === id; }); if (!p) return;
  // v4-45: form EDIT terpisah (awalan 'pe') + Stok diisi dari stokProduk
  // (stok cabang efektif), bukan p.Stok (lihat perbaikan 3).
  document.getElementById('peId').value = p.ID; document.getElementById('peNama').value = p.Nama; document.getElementById('peKategori').value = p.Kategori || ''; document.getElementById('peGrup').value = p.Grup || ''; document.getElementById('peSKU').value = p.SKU || p['SKU/Barcode'] || ''; setUang('peJual', p.HargaJual); setUang('peModal', p.HargaModal); document.getElementById('peStok').value = stokProduk(p); document.getElementById('peStokMin').value = p.StokMinimum || 5; document.getElementById('peSatuan').value = p.Satuan || 'pcs';
  document.getElementById('peGambar').value = p.GambarURL || ''; document.getElementById('peKet').value = p.Keterangan || '';
  document.getElementById('peHargaGanti').checked = flagYa(p.HargaBisaDiganti);
  document.getElementById('peTidakStok').checked = !flagYa(p.TermasukStok);
  document.getElementById('peTampilKatalog').checked = flagYa(p.TampilkanDiKatalog);
  renderEditorHarga('peHargaLain', p.HargaLainJSON || ''); renderEditorHarga('peHargaJumlah', p.HargaJumlahJSON || ''); renderEditorHarga('peVarian', p.VarianJSON || '');
  tampilGambarProduk('pe'); hitungLabaProduk('pe');
  show('produk', document.querySelector('nav button.menu[data-sec="produk"]')); bukaForm('produk', 'formProdukEdit');
}
// v4-45: resetProduk mengosongkan form TAMBAH (awalan 'pt') + menutup form.
function resetProduk() { ['ptId', 'ptNama', 'ptKategori', 'ptGrup', 'ptSKU', 'ptJual', 'ptModal', 'ptStok', 'ptGambar', 'ptKet'].forEach(function (i) { document.getElementById(i).value = ''; }); document.getElementById('ptSatuan').value = 'pcs'; document.getElementById('ptStokMin').value = '5'; document.getElementById('ptHargaGanti').checked = true; document.getElementById('ptTidakStok').checked = false; document.getElementById('ptTampilKatalog').checked = true; renderEditorHarga('ptHargaLain', '[]'); renderEditorHarga('ptHargaJumlah', '[]'); renderEditorHarga('ptVarian', '[]'); tampilGambarProduk('pt'); hitungLabaProduk('pt'); tutupForm('produk'); }
function bukaFormProdukTambah() { resetProduk(); bukaForm('produk', 'formProdukTambah'); }
/* Editor baris Harga Lain / Harga Jumlah / Varian — ganti ketik JSON mentah.
   Disimpan tetap sebagai JSON string seperti dulu, jadi kasir & database tidak berubah. */
var LABEL_TAMBAH = { pHargaLain: '+ Tambah Harga Lain', pHargaJumlah: '+ Tambah Tingkat Harga', pVarian: '+ Tambah Varian', ptHargaLain: '+ Tambah Harga Lain', ptHargaJumlah: '+ Tambah Tingkat Harga', ptVarian: '+ Tambah Varian', peHargaLain: '+ Tambah Harga Lain', peHargaJumlah: '+ Tambah Tingkat Harga', peVarian: '+ Tambah Varian' };
function kolomEditor(id) { var w = document.getElementById(id); return (w && w.dataset.kolom) ? w.dataset.kolom.split(',') : []; }
function renderEditorHarga(id, jsonStr) {
  var wadah = document.getElementById(id); if (!wadah) return;
  var kolom = kolomEditor(id);
  var rows = [];
  if (Array.isArray(jsonStr)) rows = jsonStr;
  else { try { rows = JSON.parse(jsonStr || '[]'); } catch (e) { rows = []; } }
  if (!Array.isArray(rows)) rows = [];
  wadah.innerHTML = rows.map(function (r, i) {
    return '<div class="hr-row">' + kolom.map(function (k) {
      var v = r[k] == null ? '' : (k === 'harga' ? fmtUang(r[k]) : r[k]);
      var tipe = (k === 'label' || k === 'harga') ? 'text' : 'number';
      var ph = k === 'label' ? 'Nama' : (k === 'harga' ? 'Harga (Rp)' : (k === 'minQty' ? 'Min. qty' : 'Isi'));
      return '<input type="' + tipe + '"' + (k === 'harga' ? ' inputmode="decimal" oninput="formatUangInput(this)"' : '') + ' data-k="' + k + '" value="' + esc(String(v)) + '" placeholder="' + ph + '">';
    }).join('') + '<button type="button" class="secondary hr-x" onclick="hapusBarisHarga(\'' + id + '\',' + i + ')">✕</button></div>';
  }).join('') + '<button type="button" class="secondary" onclick="tambahBarisHarga(\'' + id + '\')">' + (LABEL_TAMBAH[id] || '+ Tambah') + '</button>';
}
function kumpulEditorHarga(id) {
  var wadah = document.getElementById(id); if (!wadah) return '[]';
  var rows = [];
  wadah.querySelectorAll('.hr-row').forEach(function (row) {
    var o = {}; var kosong = true;
    row.querySelectorAll('input').forEach(function (inp) {
      var k = inp.getAttribute('data-k'); var v = inp.value;
      if (v !== '' && v != null) kosong = false;
      o[k] = (k === 'label') ? v : (k === 'harga' ? parseUang(v) : (v === '' ? 0 : Number(v)));
    });
    if (!kosong) rows.push(o);
  });
  return JSON.stringify(rows);
}
function tambahBarisHarga(id) {
  var rows = [];
  try { rows = JSON.parse(kumpulEditorHarga(id)); } catch (e) { rows = []; }
  rows.push({});
  renderEditorHarga(id, JSON.stringify(rows));
}
function hapusBarisHarga(id, i) {
  var rows = [];
  try { rows = JSON.parse(kumpulEditorHarga(id)); } catch (e) { rows = []; }
  rows.splice(i, 1);
  renderEditorHarga(id, JSON.stringify(rows));
}
// v4-45: simpan produk dipisah per form — 'pt' (Tambah) dan 'pe' (Edit).
// v4-45 (19): tolak bila SKU/barcode sudah dipakai produk lain.
async function simpanProdukDengan(pref) {
  pref = pref || 'pt';
  var g = function (s) { return document.getElementById(pref + s); };
  var payload = { ID: g('Id').value || '', Nama: g('Nama').value, Kategori: g('Kategori').value, Grup: g('Grup').value, SKU: g('SKU').value, HargaJual: parseUang(g('Jual').value), HargaModal: parseUang(g('Modal').value), Stok: g('Stok').value, StokMinimum: g('StokMin').value, Satuan: g('Satuan').value, GambarURL: g('Gambar').value, Keterangan: g('Ket').value, HargaBisaDiganti: g('HargaGanti').checked, TermasukStok: !g('TidakStok').checked, TampilkanDiKatalog: g('TampilKatalog').checked, HargaLainJSON: kumpulEditorHarga(pref + 'HargaLain'), HargaJumlahJSON: kumpulEditorHarga(pref + 'HargaJumlah'), VarianJSON: kumpulEditorHarga(pref + 'Varian'), CabangID: cabangSesiId() };
  if (!payload.Nama || !payload.HargaJual) return tampilError('Nama dan harga jual wajib diisi.');
  try { JSON.parse(payload.HargaLainJSON || '[]'); JSON.parse(payload.HargaJumlahJSON || '[]'); JSON.parse(payload.VarianJSON || '[]'); } catch (e) { return tampilError('JSON Harga Lain / Harga Jumlah / Varian tidak valid.'); }
  var skuCek = String(payload.SKU || '').trim().toLowerCase();
  if (skuCek) {
    var duplikatSku = (DATA.produk || []).find(function (x) { return String(x.SKU || x['SKU/Barcode'] || '').trim().toLowerCase() === skuCek && String(x.ID) !== String(payload.ID || ''); });
    if (duplikatSku) return tampilError('SKU/barcode sudah dipakai produk: ' + duplikatSku.Nama);
  }
  try { await DB.upsertProduk(payload); } catch (e) { tampilError('Gagal menyimpan produk: ' + (e.message || e)); return; }
  await loadData(); resetProduk(); tampilInfo('Produk tersimpan.');
}
async function simpanProdukTambah() { return simpanProdukDengan('pt'); }
async function simpanProdukEdit() { return simpanProdukDengan('pe'); }
/* ---------- SALIN PRODUK ANTAR CABANG (v4-41) ----------
   Menyalin data master produk dari cabang lain ke cabang sesi TANPA stok
   (stok di cabang tujuan mulai 0); nama yang sudah ada di tujuan dilewati.
   v4-41: (a) modal sumber DITUTUP dulu sebelum konfirmasi dibuka, dan
   z-index konfirmasi (96) di atas modal salin (91) — konfirmasi tidak
   lagi ter-render di bawah dialog sumber; bila batal, modal sumber
   dibuka lagi dengan pilihan dicentang seperti semula. (b) daftar centang
   produk sumber (default semua tercentang) + "Pilih semua / Hapus semua
   pilihan" — hanya yang dicentang yang disalin (ids ke DB); bila data
   layer lama belum kenal ids (galat menyebut ids), fallback salin semua. */
function produkCabang(id) { return (DATA.produk || []).filter(function (p) { return String((p && p.CabangID) || cabangPertamaId()) === String(id); }); }
function isiDaftarSalinProduk(dariId) {
  var box = document.getElementById('salinDaftar'); var jml = document.getElementById('salinJumlah');
  if (!box) return;
  var list = dariId ? produkCabang(dariId).filter(produkAktif) : [];
  if (jml) jml.textContent = list.length ? list.length + ' produk di cabang sumber — centang yang mau disalin.' : 'Belum ada produk di cabang sumber.';
  box.innerHTML = list.length ? list.map(function (p) { return '<label class="checkrow" style="padding:8px 0"><input type="checkbox" class="salinChk" value="' + esc(p.ID) + '" checked> ' + esc(p.Nama) + ' <span style="color:#64748b;font-size:13px">• ' + rp(p.HargaJual || 0) + '</span></label>'; }).join('') : '<div style="color:#64748b;font-size:13px;padding:6px 0">Tidak ada produk untuk disalin.</div>';
}
function aturSemuaSalin(ya) { document.querySelectorAll('.salinChk').forEach(function (c) { c.checked = !!ya; }); }
function salinProdukTerpilih() { var ids = []; document.querySelectorAll('.salinChk').forEach(function (c) { if (c.checked) ids.push(c.value); }); return ids; }
function bukaSalinProduk() {
  var sel = document.getElementById('salinCabangSumber');
  var lain = (DATA.cabang || []).filter(function (c) { return String(c.ID) !== String(cabangSesiId()); });
  if (sel) { sel.innerHTML = lain.map(function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; }).join(''); if (!sel.value && lain.length) sel.value = lain[0].ID; }
  if (typeof isiDaftarSalinProduk === 'function') isiDaftarSalinProduk(sel && sel.value ? sel.value : (lain[0] && lain[0].ID) || '');
  var m = document.getElementById('salinModal'); if (m) m.style.display = 'block';
  var b = document.getElementById('salinBackdrop'); if (b) b.style.display = 'block';
}
function tutupSalinProduk() {
  var m = document.getElementById('salinModal'); if (m) m.style.display = 'none';
  var b = document.getElementById('salinBackdrop'); if (b) b.style.display = 'none';
}
async function jalankanSalinProduk() {
  var sel = document.getElementById('salinCabangSumber');
  var dari = sel ? sel.value : '';
  if (!dari) return tampilError('Pilih cabang sumber dulu.');
  var sumber = (DATA.cabang || []).find(function (c) { return String(c.ID) === String(dari); });
  var namaSumber = sumber ? sumber.Nama : dari;
  // Daftar centang (bila ada): hanya yang dicentang yang disalin.
  var adaDaftar = false, ids = [];
  if (typeof salinProdukTerpilih === 'function') {
    try { adaDaftar = document.querySelectorAll('.salinChk').length > 0; ids = salinProdukTerpilih(); } catch (e) { adaDaftar = false; ids = []; }
  }
  if (adaDaftar && !ids.length) return tampilError('Pilih minimal satu produk untuk disalin.');
  var pesan = 'Data master produk disalin TANPA stok (stok di cabang ini mulai 0). Produk yang namanya sudah ada di cabang ini dilewati.';
  if (adaDaftar) pesan = ids.length + ' produk dipilih dari ' + namaSumber + '. ' + pesan;
  // Tutup dialog sumber DULU supaya konfirmasi tampil di atas (bukan di bawah).
  tutupSalinProduk();
  if (!await konfirmasi('Salin produk dari ' + namaSumber + '?', pesan, 'Ya, Salin', 'primary')) {
    // Batal: buka lagi dialog sumber dengan pilihan seperti semula.
    bukaSalinProduk();
    if (sel) sel.value = dari;
    if (typeof isiDaftarSalinProduk === 'function') isiDaftarSalinProduk(dari);
    if (adaDaftar) { try { document.querySelectorAll('.salinChk').forEach(function (c) { c.checked = ids.indexOf(c.value) > -1; }); } catch (e) {} }
    return;
  }
  try {
    var res;
    var fallbackSalinSemua = false;
    try {
      var args = { dariCabangId: dari, keCabangId: cabangSesiId() };
      if (ids.length) args.ids = ids;
      res = await DB.salinProdukAntarCabang(args);
    } catch (e) {
      // v4-45: fallback tanpa ids HANYA bila galatnya spesifik
      // ketidakcocokan skema (dulu regex /ids/i yang luas bisa memicu
      // salin massal dari galat lain yang kebetulan mengandung "ids").
      var pesanGalat = String((e && e.message) || e || '');
      if (ids.length && (pesanGalat.indexOf('cabang_id') > -1 || pesanGalat.indexOf('column') > -1)) {
        res = await DB.salinProdukAntarCabang({ dariCabangId: dari, keCabangId: cabangSesiId() });
        fallbackSalinSemua = true;
      } else throw e;
    }
    await loadData();
    var teks = 'Disalin ' + (res.disalin || 0) + ' produk, ' + (res.dilewati || 0) + ' dilewati.';
    if (fallbackSalinSemua) teks += ' (Semua produk disalin — pilihan centang tidak berlaku karena data lama belum mendukung pilihan.)';
    if (res.dilewatiNama && res.dilewatiNama.length) teks += ' Dilewati: ' + res.dilewatiNama.slice(0, 5).join(', ') + (res.dilewatiNama.length > 5 ? ', …' : '');
    tampilInfo(teks);
  } catch (e) { tampilError('Gagal menyalin produk: ' + (e.message || e)); }
}
async function hapusProduk(id, el) {
  var pr = (DATA.produk || []).find(function (x) { return String(x.ID) === String(id); });
  var nama = pr ? pr.Nama : 'produk ini';
  // Produk yang sudah masuk riwayat transaksi / pembelian tidak bisa dihapus
  // (database menolak: transaksi_detail.produk_id ON DELETE RESTRICT).
  var pernahDipakai = (DATA.detail || []).some(function (d) { return String(d.ProdukID) === String(id); }) || (DATA.pembelianDetail || []).some(function (d) { return String(d.ProdukID) === String(id); });
  if (pernahDipakai) {
    var nonaktifkan = await konfirmasi('Tidak bisa dihapus', 'Produk "' + nama + '" sudah pernah terjual atau dibeli, jadi tidak bisa dihapus supaya riwayat transaksi tetap benar. Nonaktifkan saja supaya tidak muncul lagi di kasir?', 'Nonaktifkan produk', 'primary');
    if (!nonaktifkan) return;
    try { await DB.nonaktifkanProduk(id); await loadData(); tutupForm('produk'); tampilInfo('Produk dinonaktifkan. Tidak muncul lagi di kasir.'); }
    catch (e) { tampilError('Gagal menonaktifkan produk: ' + (e.message || e)); }
    return;
  }
  if (!await konfirmasi('Hapus produk?', 'Produk "' + nama + '" akan dihapus permanen.', 'Ya, Hapus', 'danger')) return;
  try { await DB.hapusProduk(id); await loadData(); tutupForm('produk'); tampilInfo('Produk dihapus.'); }
  catch (e) { tampilError('Gagal menghapus produk: ' + (e.message || e)); }
}
async function exportProduk() {
  try { var res = await DB.exportProdukCSV(); unduhFile('produk.csv', res.csv || '', 'text/csv'); } catch (e) { tampilError(e.message); }
}
function unduhFile(nama, isi, tipe) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click();
}

/* ---------- IMPOR PRODUK DARI CSV (progres + ringkasan akhir) ----------
   Alur: pilih file -> analisis (parse + petakan header + validasi) ->
   pratinjau di modal konfirmasi -> impor berurutan lewat DB.upsertProduk.
   Baris bermasalah DILEWATI (bukan menggagalkan impor) dan dilaporkan
   dengan nomor baris + alasan. Produk tanpa nama TIDAK PERNAH diimpor
   (satu baris nama kosong pernah melumpuhkan seluruh aplikasi, v4-28).
   Duplikat nama (trim + lowercase) terhadap produk yang sudah ada maupun
   yang sudah lolos di file yang sama DILEWATI, tidak di-update. */
function csvSelImpor(v) { var s = String(v == null ? '' : v); return '"' + s.replace(/"/g, '""') + '"'; }
function templateImporCSV() {
  var header = ['Nama', 'Kategori', 'SKU/Barcode', 'Harga Jual', 'Harga Modal', 'Stok', 'Satuan', 'Stok Minimum', 'Grup', 'Termasuk Stok', 'Harga Bisa Diganti', 'Tampilkan di Katalog', 'Keterangan'];
  var contoh = [
    ['Kabel Data USB', 'Kabel', '899100000001', '15000', '10000', '20', 'pcs', '5', 'Kabel', 'YA', 'YA', 'YA', 'Kabel data 1 meter'],
    ['Tempered Glass 9H', 'Tempered Glass', '899100000002', '25000', '15000', '10', 'pcs', '5', 'Tempered Glass', 'YA', 'YA', 'YA', 'Anti gores 9H']
  ];
  return [header].concat(contoh).map(function (r) { return r.map(csvSelImpor).join(','); }).join('\n');
}
function unduhTemplateImpor() { unduhFile('template-impor-produk.csv', templateImporCSV(), 'text/csv'); }
/* Parser CSV tanpa dependensi: field ber-quote (boleh berisi koma / baris
   baru, "" = satu tanda kutip), CRLF dan LF, BOM di awal file, pemisah
   koma ATAU titik-koma (dideteksi dari baris header — file ekspor Excel
   Indonesia sering bertitik-koma). Baris kosong dipertahankan supaya
   nomor baris laporan sama dengan nomor baris di file. */
function parseCSVImpor(teks) {
  var t = String(teks == null ? '' : teks);
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  var nl = t.indexOf('\n');
  var barisPertama = nl === -1 ? t : t.slice(0, nl);
  var nKoma = 0, nTikom = 0, dalamKutip = false;
  for (var i = 0; i < barisPertama.length; i++) {
    var c = barisPertama[i];
    if (c === '"') dalamKutip = !dalamKutip;
    else if (!dalamKutip) { if (c === ',') nKoma++; else if (c === ';') nTikom++; }
  }
  var delim = nTikom > nKoma ? ';' : ',';
  var rows = [], row = [], field = '', inQ = false;
  for (var j = 0; j < t.length; j++) {
    var ch = t[j];
    if (inQ) {
      if (ch === '"') { if (t[j + 1] === '"') { field += '"'; j++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"' && field === '') inQ = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\r') { /* CRLF: \n yang memutus baris */ }
    else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
/* Pemetaan header (case-insensitive, spasi di-trim): header ZPOS + alias
   format ekspor Griyo. Header yang tidak dikenal diabaikan. 'Kode Produk'
   hanya mengisi SKU bila 'Barcode' kosong (ditangani di analisis).
   'Non Stok' (kolom ekspor Griyo) dibaca terbalik: YA -> Termasuk Stok
   TIDAK. */
function petakanHeaderImpor(headers) {
  var ALIAS = {
    'nama': 'Nama', 'produk': 'Nama',
    'kategori': 'Kategori',
    'sku/barcode': 'SKU', 'sku': 'SKU', 'barcode': 'SKU', 'kode produk': 'SKU',
    'harga jual': 'HargaJual',
    'harga modal': 'HargaModal', 'harga pokok': 'HargaModal',
    'stok': 'Stok', 'satuan': 'Satuan',
    'stok minimum': 'StokMinimum', 'stok min': 'StokMinimum',
    'grup': 'Grup', 'grup produk': 'Grup',
    'termasuk stok': 'TermasukStok', 'non stok': 'NonStok',
    'harga bisa diganti': 'HargaBisaDiganti',
    'tampilkan di katalog': 'TampilkanDiKatalog',
    'keterangan': 'Keterangan'
  };
  var map = {}, punyaNama = false;
  headers.forEach(function (h, i) {
    var k = (String(h == null ? '' : h).trim() || '').toLowerCase().replace(/\s+/g, ' ');
    var f = ALIAS[k];
    if (f) { map[i] = f; if (f === 'Nama') punyaNama = true; }
  });
  return { map: map, punyaNama: punyaNama };
}
/* Angka format Indonesia: "12.000" -> 12000, "Rp12.000" -> 12000,
   "12,5" -> 13 (dibulatkan). Kosong -> 0 (boleh). Bukan angka atau
   negatif -> tidak ok. */
function angkaImpor(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return { ok: true, nilai: 0 };
  s = s.replace(/^Rp\s*/i, '').replace(/\s/g, '').replace(/\./g, '');
  if (s.indexOf(',') > -1) s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, nilai: 0 };
  var n = Math.round(parseFloat(s));
  if (isNaN(n) || n < 0) return { ok: false, nilai: 0 };
  return { ok: true, nilai: n };
}
function yaTidakImpor(v, def) {
  var s = (String(v == null ? '' : v).trim() || '').toLowerCase();
  if (s === '') return !!def;
  if (s === 'ya' || s === 'true' || s === '1') return true;
  if (s === 'tidak' || s === 'false' || s === '0') return false;
  return false;
}
/* Validasi satu baris (sudah dipetakan). Mengembalikan { ok, payload }
   atau { ok:false, alasan }. Payload mengikuti persis bentuk yang
   dikirim simpanProduk ke DB.upsertProduk. */
function validasiBarisImpor(obj, noBaris, namaAda) {
  var nama = String(obj.Nama == null ? '' : obj.Nama).trim();
  if (!nama) return { ok: false, alasan: 'Nama kosong' };
  if (namaAda[(nama || '').toLowerCase()]) return { ok: false, alasan: 'sudah ada' };
  var jual = angkaImpor(obj.HargaJual);
  if (!jual.ok) return { ok: false, alasan: 'Harga Jual bukan angka' };
  var modal = angkaImpor(obj.HargaModal);
  if (!modal.ok) return { ok: false, alasan: 'Harga Modal bukan angka' };
  var stok = angkaImpor(obj.Stok);
  if (!stok.ok) return { ok: false, alasan: 'Stok bukan angka' };
  var stokMin = angkaImpor(obj.StokMinimum);
  if (!stokMin.ok) return { ok: false, alasan: 'Stok Minimum bukan angka' };
  var termasukStok;
  if (obj.NonStok != null && String(obj.NonStok).trim() !== '') termasukStok = !yaTidakImpor(obj.NonStok, false);
  else termasukStok = yaTidakImpor(obj.TermasukStok, true);
  return { ok: true, payload: {
    ID: '', Nama: nama,
    Kategori: String(obj.Kategori == null ? '' : obj.Kategori).trim(),
    Grup: String(obj.Grup == null ? '' : obj.Grup).trim(),
    SKU: String(obj.SKU == null ? '' : obj.SKU).trim(),
    HargaJual: jual.nilai, HargaModal: modal.nilai, Stok: stok.nilai, StokMinimum: stokMin.nilai,
    Satuan: String(obj.Satuan == null ? '' : obj.Satuan).trim() || 'pcs',
    GambarURL: '', Keterangan: String(obj.Keterangan == null ? '' : obj.Keterangan).trim(),
    HargaBisaDiganti: yaTidakImpor(obj.HargaBisaDiganti, false),
    TermasukStok: termasukStok,
    TampilkanDiKatalog: yaTidakImpor(obj.TampilkanDiKatalog, true),
    HargaLainJSON: '[]', HargaJumlahJSON: '[]', VarianJSON: '[]',
    CabangID: cabangSesiId()
  } };
}
/* Analisis isi file CSV: { punyaNama, siap:[payload], masalah:[{baris,
   alasan}], duplikat } — masalah mencakup duplikat (alasan 'sudah ada').
   Nomor baris = nomor baris di file (baris 1 = header). */
function analisisCSVImpor(teks) {
  var baris = parseCSVImpor(teks);
  var hasil = { punyaNama: false, siap: [], masalah: [], duplikat: 0 };
  if (!baris.length) return hasil;
  var peta = petakanHeaderImpor(baris[0]);
  if (!peta.punyaNama) return hasil;
  hasil.punyaNama = true;
  var namaAda = {};
  (DATA.produk || []).filter(milikCabangSesi).forEach(function (p) { namaAda[String(p.Nama || '').trim().toLowerCase()] = true; });
  for (var i = 1; i < baris.length; i++) {
    var r = baris[i];
    var kosong = r.every(function (c) { return String(c).trim() === ''; });
    if (kosong) continue;
    var obj = {};
    for (var c = 0; c < r.length; c++) {
      var f = peta.map[c]; if (!f) continue;
      var v = r[c];
      if (f === 'SKU') { if (obj.SKU == null || String(obj.SKU).trim() === '') obj.SKU = v; continue; }
      obj[f] = v;
    }
    var cek = validasiBarisImpor(obj, i + 1, namaAda);
    if (!cek.ok) {
      hasil.masalah.push({ baris: i + 1, alasan: cek.alasan });
      if (cek.alasan === 'sudah ada') hasil.duplikat++;
      continue;
    }
    namaAda[(String(cek.payload.Nama).trim() || '').toLowerCase()] = true;
    hasil.siap.push(cek.payload);
  }
  return hasil;
}
/* Pratinjau + konfirmasi + eksekusi impor dari teks CSV (dipisah dari
   pemilih file supaya bisa diuji). */
async function prosesTeksCSVImpor(teks) {
  var hasil = analisisCSVImpor(teks);
  if (!hasil.punyaNama) { tampilError('File CSV tidak punya kolom Nama/Produk.'); return; }
  var siap = hasil.siap.length;
  var dilewati = hasil.masalah.length - hasil.duplikat;
  var ringkas = 'Ringkasan impor:\n' + siap + ' produk siap diimpor\n' + dilewati + ' baris bermasalah dilewati\n' + hasil.duplikat + ' duplikat dilewati';
  if (hasil.masalah.length) {
    ringkas += '\n\nBaris bermasalah:';
    hasil.masalah.slice(0, 10).forEach(function (m) { ringkas += '\nBaris ' + m.baris + ': ' + m.alasan; });
    if (hasil.masalah.length > 10) ringkas += '\n…dan ' + (hasil.masalah.length - 10) + ' lagi';
  }
  if (siap === 0) {
    await konfirmasi('Tidak ada produk yang bisa diimpor.', ringkas, 'Mengerti', 'primary');
    return;
  }
  var setuju = await konfirmasi('Impor produk?', ringkas, 'Ya, Impor ' + siap + ' produk', 'primary');
  if (!setuju) return;
  await jalankanImporProduk(hasil);
}
/* Progres impor (temuan uji live impor CSV): modal konfirmasi dipakai
   ulang sebagai layar progres — tombol disembunyikan selama impor supaya
   tidak tertutup tanpa sengaja, dan jawabKonfirm() menolak menutup selama
   _imporBerjalan true. */
var _imporBerjalan = false;
function tampilProgresImpor(teks) {
  _imporBerjalan = true;
  document.getElementById('konfirmJudul').textContent = 'Mengimpor produk…';
  document.getElementById('konfirmPesan').textContent = teks;
  var tombol = document.querySelector('#konfirmBox .konfirm-tombol'); if (tombol) tombol.style.display = 'none';
  document.getElementById('konfirmBackdrop').style.display = 'block';
  document.getElementById('konfirmBox').style.display = 'block';
}
function sembunyiProgresImpor() {
  _imporBerjalan = false;
  var tombol = document.querySelector('#konfirmBox .konfirm-tombol'); if (tombol) tombol.style.display = '';
  document.getElementById('konfirmBackdrop').style.display = 'none';
  document.getElementById('konfirmBox').style.display = 'none';
}
/* Simpan tiap baris valid berurutan lewat jalur yang sama dengan
   simpanProduk. Satu baris gagal tidak menghentikan impor — dicatat dan
   dilaporkan di akhir. loadData() dipanggil SEKALI setelah semua selesai.
   progres "Mengimpor N/M produk..." terlihat selama impor +
   ringkasan akhir di modal (bukan hanya toast singkat). */
async function jalankanImporProduk(hasil) {
  var berhasil = 0, gagal = 0, pesanGagal = '';
  var total = hasil.siap.length;
  try {
    tampilProgresImpor('Mengimpor 0/' + total + ' produk...\nJangan tutup atau muat ulang halaman selama impor berjalan.');
    for (var i = 0; i < total; i++) {
      try { await DB.upsertProduk(hasil.siap[i]); berhasil++; }
      catch (e) { gagal++; if (!pesanGagal) pesanGagal = (e && e.message) || String(e); }
      if ((i + 1) % 5 === 0 || i === total - 1) tampilProgresImpor('Mengimpor ' + (i + 1) + '/' + total + ' produk...\nJangan tutup atau muat ulang halaman selama impor berjalan.');
    }
  } finally {
    sembunyiProgresImpor();
  }
  await loadData();
  var dilewati = hasil.masalah.length - hasil.duplikat;
  var ringkas = 'Impor selesai: ' + berhasil + ' produk ditambahkan, ' + dilewati + ' dilewati, ' + hasil.duplikat + ' duplikat.';
  if (gagal > 0) ringkas += '\n' + gagal + ' gagal: ' + pesanGagal;
  await konfirmasi('Impor selesai', ringkas, 'Mengerti', 'primary');
}
function imporProdukDariCSV() {
  // impor butuh cek duplikat ke server — tolak saat offline.
  var sedangOffline = false;
  try { sedangOffline = navigator.onLine === false || (DB.sedangOffline && DB.sedangOffline()); } catch (e) {}
  if (sedangOffline) { tampilError('Impor CSV butuh internet.'); return; }
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv';
  inp.onchange = function () {
    var f = inp.files && inp.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      prosesTeksCSVImpor(String(rd.result || '')).catch(function (e) { tampilError('Impor gagal: ' + (e.message || e)); });
    };
    rd.onerror = function () { tampilError('File CSV tidak bisa dibaca.'); };
    rd.readAsText(f);
  };
  inp.click();
}

/* ---------- STOK ---------- */
function renderStok() {
  // stok negatif (dua perangkat offline menjual barang terakhir
  // yang sama) ditandai jelas "Stok Minus — cek", jangan diam-diam.
  document.getElementById('stokTable').innerHTML = (DATA.produk || []).filter(milikCabangSesi).map(function (p) { var s = stokProduk(p); var tipis = s <= Number(p.StokMinimum || 5); var minus = s < 0; return '<div class="cart-item"><span><b>' + esc(p.Nama) + '</b><br><small>' + rp(p.HargaJual) + ' • Stok min. ' + (p.StokMinimum || 5) + '</small></span>' + (minus ? '<span class="badge bad">Stok Minus — cek (' + s + ')</span>' : (tipis ? '<span class="badge warn">Stok ' + s + '</span>' : '<b>Stok ' + s + '</b>')) + '</div>'; }).join('') || 'Belum ada produk.';
  document.getElementById('opnameTable').innerHTML = (DATA.opname || []).filter(milikCabangSesi).slice(0, 50).map(function (o) { return '<div class="cart-item"><span><b>' + esc(o.NamaProduk) + '</b><br><small>' + fmtTanggalID(o.Tanggal) + ' • Sistem ' + o.StokSistem + ' • Fisik ' + o.StokFisik + '</small></span><b>Selisih ' + o.Selisih + '</b></div>'; }).join('') || 'Belum ada opname.';
}
async function muatLaporanStok() {
  try {
    var res = await DB.getLaporanStok({ cabangId: cabangSesiId() });
    var html = '<h4>Stok Produk</h4><table><tr><th>Produk</th><th>Stok</th><th>Harga Pokok</th><th>Harga Jual</th></tr>' + (res.produk || []).map(function (p) { return '<tr><td>' + esc(p.nama || p.Nama) + '</td><td>' + (p.stok || p.Stok) + '</td><td>' + rp(p.modal || p.HargaModal || 0) + '</td><td>' + rp(p.harga || p.HargaJual || 0) + '</td></tr>'; }).join('') + '</table>';
    html += '<h4>Stok Bahan Baku</h4><table><tr><th>Bahan</th><th>Stok</th></tr>' + (res.bahan || []).map(function (b) { return '<tr><td>' + esc(b.nama || b.Nama) + '</td><td>' + (b.stok || b.Stok) + ' ' + (b.satuan || b.Satuan || '') + '</td></tr>'; }).join('') + '</table>';
    html += '<h4>Kedaluwarsa</h4>' + ((res.kedaluwarsa || []).map(function (b) { return esc(b.nama || b.NamaProduk || '') + ' — ' + (b.Kedaluwarsa || ''); }).join('<br>') || 'Tidak ada.');
    document.getElementById('lapStokBox').innerHTML = html;
  } catch (e) { tampilError(e.message); }
}
async function simpanOpname() {
  var pid = document.getElementById('opProduk').value; var fisik = Number(document.getElementById('opFisik').value);
  if (!pid || isNaN(fisik)) return tampilError('Pilih produk dan isi stok fisik.');
  await DB.simpanOpname({ produkId: pid, stokFisik: fisik, keterangan: document.getElementById('opKet').value, cabangId: cabangSesiId() });
  await loadData(); tampilInfo('Opname tersimpan, stok disesuaikan.');
}
async function muatSaranOrder() {
  try {
    var res = await DB.saranOrder({ cabangId: cabangSesiId() });
    var list = res.saran || res || [];
    document.getElementById('saranBox').innerHTML = list.map(function (s) { return '<div class="cart-item"><span><b>' + esc(s.nama) + '</b><br><small>Stok ' + s.stok + ' • Terjual/hari ' + (s.terjualPerHari || 0) + ' • Hari tersisa ' + (s.hariTersisa == null ? '—' : s.hariTersisa) + '</small></span><b>Saran order ' + (s.saranQty || 0) + '</b></div>'; }).join('') || 'Tidak ada saran order.';
  } catch (e) { tampilError(e.message); }
}
function gambarLabel() {
  var ids = []; document.querySelectorAll('.labelChk:checked').forEach(function (c) { ids.push(c.value); });
  if (!ids.length) return tampilError('Pilih minimal 1 produk.');
  var box = document.getElementById('labelBox'); box.innerHTML = '';
  ids.forEach(function (id) {
    var p = DATA.produk.find(function (x) { return x.ID === id; }); if (!p) return;
    var div = document.createElement('div'); div.style.cssText = 'display:inline-block;border:1px solid #94a3b8;padding:8px;margin:6px;text-align:center;background:#fff';
    var nama = document.createElement('div'); nama.textContent = p.Nama; div.appendChild(nama);
    var cv = document.createElement('canvas'); div.appendChild(cv);
    var kode = document.createElement('div'); kode.textContent = p.SKU || p['SKU/Barcode'] || p.ID; div.appendChild(kode);
    var harga = document.createElement('div'); harga.textContent = rp(p.HargaJual); div.appendChild(harga);
    box.appendChild(div);
    gambarBarcode(cv, p.SKU || p['SKU/Barcode'] || p.ID);
  });
}

/* ---------- PEMBELIAN ---------- */
/* ---------- PEMBELIAN ala Griyo: daftar per bulan + form + picker cari ---------- */
var beliItemIndex = -1, beliItemProdukId = '', pickerProdukDariItem = false, pembelianNomor = {}, detailPembelianId = '';
function hitungNomorPembelian() {
  pembelianNomor = {};
  (DATA.pembelian || []).filter(milikCabangSesi).slice().sort(function (a, b) { return String(a.Tanggal || '') < String(b.Tanggal || '') ? -1 : 1; }).forEach(function (p, i) { pembelianNomor[p.ID] = i + 1; });
}
function fmtBulan(d) { return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }); }
function ringkasItemBeli(id) {
  return (DATA.pembelianDetail || []).filter(function (x) { return x.PembelianID === id; }).map(function (x) { return String(x.NamaProduk || '').slice(0, 10) + ':' + x.Qty; }).join(' ');
}
function renderPembelian() {
  var list = (DATA.pembelian || []).filter(milikCabangSesi).slice().sort(function (a, b) { return String(b.Tanggal || '') < String(a.Tanggal || '') ? -1 : 1; });
  hitungNomorPembelian();
  var html = '', grupTerakhir = '';
  list.forEach(function (p) {
    var d = new Date(p.Tanggal);
    var kunci = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (kunci !== grupTerakhir) {
      grupTerakhir = kunci;
      var bln = list.filter(function (x) { var dd = new Date(x.Tanggal); return dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') === kunci; });
      var totalBln = bln.reduce(function (s, x) { return s + Number(x.Total || 0); }, 0);
      html += '<div class="trx-grup"><span>' + fmtBulan(d) + '</span><span class="trx-grup-total">' + rp(totalBln) + '</span><span>' + bln.length + '</span></div>';
    }
    var diproses = p.Diproses === true || p.Diproses === 'YA' || p.Status === 'Diproses' || p.Status === 'Sudah diproses';
    html += '<div class="trx-row" onclick="bukaDetailPembelian(\'' + esc(p.ID) + '\')">'
      + '<div class="trx-r1"><b class="trx-biru">' + rp(p.Total) + '</b><span>' + d.getDate() + ' ' + BULAN_ID[d.getMonth()] + ' ' + d.getFullYear() + '</span><span>#' + (pembelianNomor[p.ID] || '') + '</span></div>'
      + '<div class="trx-r2"><span>' + esc(p.Pemasok || '') + '</span><span class="trx-ringkas">' + esc(ringkasItemBeli(p.ID)) + '</span></div>'
      + '<div class="trx-r3"><span></span><span class="badge' + (diproses ? '' : ' warn') + '">' + (diproses ? 'Diproses' : 'Belum diproses') + '</span></div>'
      + '</div>';
  });
  html = html || '<p style="color:#64748b">Belum ada pembelian.</p>';
  document.getElementById('pembelianTable').innerHTML = html;
  document.getElementById('pemasokTable').innerHTML = '<table><tr><th>Nama</th><th>Telepon</th><th>Hutang</th><th></th></tr>' + (DATA.pemasok || []).filter(milikCabangSesi).map(function (p) { return '<tr><td>' + esc(p.Nama) + '</td><td>' + esc(p.Telepon || '') + '</td><td>' + rp(p.Hutang || 0) + '</td><td><button class="secondary" onclick="editPemasok(\'' + esc(p.ID) + '\')">Edit</button> <button class="danger" onclick="hapusPemasok(\'' + esc(p.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
}
// pemasok akhirnya bisa diedit/dihapus (dulu tabel tanpa aksi).
function editPemasok(id) {
  var p = (DATA.pemasok || []).find(function (x) { return String(x.ID) === String(id); }); if (!p) return;
  document.getElementById('pmId').value = p.ID; document.getElementById('pmNama').value = p.Nama;
  document.getElementById('pmTelp').value = p.Telepon || ''; document.getElementById('pmAlamat').value = p.Alamat || '';
  var judul = document.querySelector('#formPemasok h3'); if (judul) judul.textContent = 'Edit Pemasok';
  bukaForm('pembelian', 'formPemasok');
}
async function hapusPemasok(id, el) {
  var p = (DATA.pemasok || []).find(function (x) { return String(x.ID) === String(id); });
  var nama = p ? p.Nama : 'pemasok ini';
  // Guard di sisi aplikasi (seperti hapus pelanggan "Umum"): beri tahu dulu
  // sebelum konfirmasi hapus — guard yang sama juga ada di DB.hapusPemasok.
  // v4-45: cek riwayat per cabang (lihat hapusPelanggan).
  var dipakai = (DATA.pembelian || []).some(function (x) { return String(x.Pemasok || '') === String(nama) && String(x.CabangID || cabangPertamaId()) === String(p.CabangID || cabangPertamaId()); });
  if (dipakai) {
    await konfirmasi('Tidak bisa dihapus', 'Pemasok "' + nama + '" sudah pernah dipakai di pembelian, jadi tidak bisa dihapus.', 'Mengerti', 'primary');
    return;
  }
  if (!await konfirmasi('Hapus pemasok?', 'Pemasok "' + nama + '" akan dihapus.', 'Ya, Hapus', 'danger')) return;
  try { await DB.hapusPemasok({ id: id }); await loadData(); tampilInfo('Pemasok dihapus.'); } catch (e) { tampilError('Gagal menghapus pemasok: ' + (e.message || e)); }
}
function baruPembelian() {
  beliItems = []; beliItemIndex = -1; beliItemProdukId = '';
  document.getElementById('beliPemasok').value = '';
  document.getElementById('beliPemasokLabel').textContent = 'Pilih pemasok…';
  ['beliDiskon', 'beliPajak', 'beliBiaya'].forEach(function (i) { document.getElementById(i).value = '0'; });
  document.getElementById('beliBayar').value = '0';
  document.getElementById('beliCatatan').value = '';
  renderBeliItems(); hitungTotalBeli();
  bukaForm('pembelian', 'formPembelian');
}
function renderBeliItems() {
  document.getElementById('beliItems').innerHTML = beliItems.map(function (it, i) {
    return '<div class="cart-item" onclick="editItemBeli(' + i + ')"><span>' + esc(it.nama) + ' × ' + it.Qty + ' @ ' + rp(it.HargaBeli) + (it.Kedaluwarsa ? ' • exp ' + esc(it.Kedaluwarsa) : '') + '</span><span>' + rp(it.Qty * it.HargaBeli) + ' <button class="secondary" onclick="event.stopPropagation();hapusItemBeliList(' + i + ')">✕</button></span></div>';
  }).join('') || 'Belum ada item. Ketuk "+ Tambah Produk".';
}
function hitungTotalBeli() {
  var sub = beliItems.reduce(function (a, i) { return a + Number(i.Qty || 0) * Number(i.HargaBeli || 0); }, 0);
  var dis = parseUang(document.getElementById('beliDiskon').value);
  var paj = parseUang(document.getElementById('beliPajak').value);
  var bia = parseUang(document.getElementById('beliBiaya').value);
  var tot = sub - dis + paj + bia;
  document.getElementById('beliTotalBox').innerHTML = '<div class="dtotal"><span>Subtotal</span><b>' + rp(sub) + '</b></div>'
    + '<div class="dtotal"><span>Total</span><b class="trx-biru">' + rp(tot) + '</b></div>';
  return tot;
}
async function simpanPembelian() {
  var _btn = null, _teksBtn = '';
  try { _btn = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _btn = null; }
  if (!beliItems.length) return tampilError('Tambahkan minimal 1 item pembelian.');
  var pemasok = document.getElementById('beliPemasok').value;
  if (!pemasok) return tampilError('Pilih pemasok dulu.');
  var total = hitungTotalBeli();
  // v4-45: tolak Bayar > Total di UI juga (DB ikut menolak — lihat supabase.js).
  var bayarAwal = parseUang(document.getElementById('beliBayar').value);
  if (bayarAwal > total) return tampilError('Bayar melebihi total pembelian — maksimal ' + rp(total) + '.');
  // umpan balik instan — tombol "Menyimpan…" + toast.
  if (_btn) { _teksBtn = _btn.textContent; _btn.disabled = true; _btn.textContent = 'Menyimpan…'; }
  tampilInfo('Menyimpan…');
  try {
    await DB.simpanPembelian({ pemasok: pemasok, items: beliItems, total: total, diskon: parseUang(document.getElementById('beliDiskon').value), pajak: parseUang(document.getElementById('beliPajak').value), biayaLain: parseUang(document.getElementById('beliBiaya').value), bayar: parseUang(document.getElementById('beliBayar').value), catatan: document.getElementById('beliCatatan').value, cabangId: cabangSesiId() });
  } catch (e) { return tampilError('Gagal menyimpan pembelian: ' + (e.message || e)); } finally { if (_btn) { _btn.disabled = false; _btn.textContent = _teksBtn; } }
  beliItems = []; renderBeliItems(); await loadData(); tutupForm('pembelian'); tampilInfo('DRAFT pembelian tersimpan. Tekan PROSES untuk menambah stok.');
}
var sedangProsesBeli = false;
async function prosesPembelian(id, el) {
  if (sedangProsesBeli) return; // cegah dua ketuk PROSES bersamaan
  if (!await konfirmasi('Proses pembelian?', 'Stok bertambah, pengeluaran dan utang pemasok tercatat. Proses ini tidak bisa dibatalkan.', 'Ya, Proses', 'primary')) return;
  sedangProsesBeli = true;
  // umpan balik instan — tombol "Memproses…" + toast.
  var _teksBeli = el ? el.textContent : '';
  if (el) { el.disabled = true; el.textContent = 'Memproses…'; }
  tampilInfo('Memproses…');
  try { await DB.prosesPembelian({ id: id }); await loadData(); tampilInfo('Pembelian diproses. Stok bertambah.'); }
  catch (e) { tampilError('Gagal memproses pembelian: ' + (e.message || e)); }
  finally { sedangProsesBeli = false; if (el) { el.disabled = false; el.textContent = _teksBeli; } }
}
async function prosesPembelianDetail(id) {
  var _el = null;
  try { _el = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _el = null; }
  await prosesPembelian(id, _el);
  if (detailPembelianId) renderDetailPembelian();
}
/* --- Picker pemasok (ketik untuk cari) --- */
function bukaPickerPemasok() {
  document.getElementById('cariPemasok').value = '';
  document.getElementById('formPemasokBaru').style.display = 'none';
  renderPickerPemasok();
  bukaForm('pembelian', 'pickerPemasok');
}
function renderPickerPemasok() {
  var q = (document.getElementById('cariPemasok').value || '').toLowerCase();
  var list = (DATA.pemasok || []).filter(function (p) { return milikCabangSesi(p) && (!q || String(p.Nama || '').toLowerCase().indexOf(q) >= 0); });
  document.getElementById('daftarPemasok').innerHTML = list.map(function (p) {
    return '<div class="prow" onclick="pilihPemasok(\'' + escJS(p.Nama) + '\')"><div class="pinfo"><b>' + esc(p.Nama) + '</b><span>' + esc(p.Telepon || '') + '</span></div><span style="font-size:20px;color:#94a3b8">›</span></div>';
  }).join('') || '<p style="color:#64748b">Tidak ada pemasok yang cocok.</p>';
}
function pilihPemasok(nama) {
  document.getElementById('beliPemasok').value = nama;
  document.getElementById('beliPemasokLabel').textContent = nama;
  bukaForm('pembelian', 'formPembelian');
}
function tampilFormPemasokBaru() { document.getElementById('formPemasokBaru').style.display = 'block'; document.getElementById('pmBaruNama').focus(); }
async function simpanPemasokBaru() {
  var nama = document.getElementById('pmBaruNama').value.trim();
  if (!nama) return tampilError('Nama pemasok wajib diisi.');
  try {
    await DB.upsertPemasok({ Nama: nama, Telepon: document.getElementById('pmBaruTelp').value, CabangID: cabangSesiId() });
    await loadData();
    document.getElementById('pmBaruNama').value = ''; document.getElementById('pmBaruTelp').value = '';
    document.getElementById('formPemasokBaru').style.display = 'none';
    renderPickerPemasok(); tampilInfo('Pemasok tersimpan.');
  } catch (e) { tampilError('Gagal menyimpan pemasok: ' + (e.message || e)); }
}
/* --- Picker produk (ketik nama / SKU, tidak perlu scroll jauh) --- */
function bukaPickerProduk(dariItem) {
  pickerProdukDariItem = !!dariItem;
  document.getElementById('cariProdukBeli').value = '';
  renderPickerProduk();
  bukaForm('pembelian', 'pickerProduk');
}
function kembaliDariPickerProduk() {
  kembali();
}
function renderPickerProduk() {
  var q = (document.getElementById('cariProdukBeli').value || '').toLowerCase();
  var list = (DATA.produk || []).filter(function (p) {
    if (!milikCabangSesi(p)) return false;
    if (!produkAktif(p)) return false;
    if (!q) return true;
    return String(p.Nama || '').toLowerCase().indexOf(q) >= 0 || String(p.SKUBarcode || p.SKU || '').toLowerCase().indexOf(q) >= 0;
  });
  document.getElementById('daftarProduk').innerHTML = list.map(function (p) {
    return '<div class="prow" onclick="pilihProdukBeli(\'' + esc(p.ID) + '\')"><div class="pinfo"><b>' + esc(p.Nama) + '</b><span>Stok: ' + stokProduk(p) + ' ' + esc(p.Satuan || 'pcs') + '</span></div><div class="pharga"><b>' + rp(p.HargaJual) + '</b></div></div>';
  }).join('') || '<p style="color:#64748b">Tidak ada produk yang cocok.</p>';
}
function pilihProdukBeli(id) {
  var pr = (DATA.produk || []).find(function (x) { return String(x.ID) === String(id); });
  if (!pr) return;
  // Produk yang sama tidak boleh dua baris (PK pembelian_detail) — edit baris yang ada.
  var ada = beliItems.findIndex(function (it) { return String(it.id) === String(id); });
  if (ada >= 0) { editItemBeli(ada); return; }
  beliItemIndex = -1; beliItemProdukId = id;
  document.getElementById('beliItemProdukId').value = id;
  document.getElementById('beliItemProdukLabel').textContent = pr.Nama;
  document.getElementById('beliItemQty').value = '1';
  document.getElementById('beliItemSatuan').value = pr.Satuan || 'pcs';
  document.getElementById('beliItemTotal').value = '';
  setUang('beliItemJual', pr.HargaJual || 0);
  document.getElementById('beliItemKedaluwarsa').value = '';
  document.getElementById('beliItemHapusBtn').style.display = 'none';
  hitungItemBeli();
  bukaForm('pembelian', 'formBeliItem');
}
function hitungItemBeli() {
  var qty = Number(document.getElementById('beliItemQty').value || 0);
  var total = parseUang(document.getElementById('beliItemTotal').value);
  var jual = parseUang(document.getElementById('beliItemJual').value);
  var perItem = qty > 0 ? Math.round(total / qty) : 0;
  document.getElementById('beliItemPerItem').value = perItem ? perItem.toLocaleString('id-ID') : '';
  document.getElementById('beliItemLaba').value = (jual - perItem) ? (jual - perItem).toLocaleString('id-ID') : '0';
  return perItem;
}
function simpanItemBeli() {
  var id = beliItemProdukId || document.getElementById('beliItemProdukId').value;
  var pr = (DATA.produk || []).find(function (x) { return String(x.ID) === String(id); });
  if (!pr) return tampilError('Pilih produk dulu.');
  var qty = Number(document.getElementById('beliItemQty').value || 0);
  if (qty < 1) return tampilError('Jumlah minimal 1.');
  var totalStr = document.getElementById('beliItemTotal').value;
  if (totalStr === '' || totalStr == null) return tampilError('Isi Harga beli (total).');
  var perItem = hitungItemBeli();
  var jual = parseUang(document.getElementById('beliItemJual').value);
  var item = { id: id, nama: pr.Nama, Qty: qty, HargaBeli: perItem, HargaJual: jual, Satuan: document.getElementById('beliItemSatuan').value || pr.Satuan || 'pcs', Kedaluwarsa: document.getElementById('beliItemKedaluwarsa').value || '' };
  if (beliItemIndex >= 0) beliItems[beliItemIndex] = item; else beliItems.push(item);
  beliItemIndex = -1;
  renderBeliItems(); hitungTotalBeli();
  bukaForm('pembelian', 'formPembelian');
}
function editItemBeli(i) {
  var it = beliItems[i]; if (!it) return;
  beliItemIndex = i; beliItemProdukId = it.id;
  var pr = (DATA.produk || []).find(function (x) { return String(x.ID) === String(it.id); });
  document.getElementById('beliItemProdukId').value = it.id;
  document.getElementById('beliItemProdukLabel').textContent = it.nama;
  document.getElementById('beliItemQty').value = it.Qty;
  document.getElementById('beliItemSatuan').value = it.Satuan || (pr && pr.Satuan) || 'pcs';
  setUang('beliItemTotal', Number(it.Qty || 0) * Number(it.HargaBeli || 0));
  setUang('beliItemJual', Number(it.HargaJual || (pr && pr.HargaJual) || 0));
  document.getElementById('beliItemKedaluwarsa').value = it.Kedaluwarsa || '';
  document.getElementById('beliItemHapusBtn').style.display = 'block';
  hitungItemBeli();
  bukaForm('pembelian', 'formBeliItem');
}
function hapusItemBeliList(i) { beliItems.splice(i, 1); renderBeliItems(); hitungTotalBeli(); }
async function hapusItemBeliForm() {
  if (beliItemIndex < 0) return;
  if (!await konfirmasi('Hapus item?', 'Item ini akan dihapus dari pembelian ini.', 'Ya, Hapus', 'danger')) return;
  beliItems.splice(beliItemIndex, 1); beliItemIndex = -1;
  renderBeliItems(); hitungTotalBeli();
  bukaForm('pembelian', 'formPembelian');
}
/* --- Detail pembelian (ketuk baris di daftar) --- */
function bukaDetailPembelian(id) {
  detailPembelianId = id;
  renderDetailPembelian();
  bukaForm('pembelian', 'detailPembelian');
}
function renderDetailPembelian() {
  var p = (DATA.pembelian || []).find(function (x) { return x.ID === detailPembelianId; });
  var box = document.getElementById('detailPembelianBody');
  if (!p) { box.innerHTML = '<p style="color:#64748b">Pembelian tidak ditemukan.</p>'; return; }
  var d = new Date(p.Tanggal);
  var diproses = p.Diproses === true || p.Diproses === 'YA' || p.Status === 'Diproses' || p.Status === 'Sudah diproses';
  var items = (DATA.pembelianDetail || []).filter(function (x) { return x.PembelianID === p.ID; });
  document.getElementById('detailPembelianJudul').textContent = 'Pembelian #' + (pembelianNomor[p.ID] || '');
  var sub = items.reduce(function (a, x) { return a + Number(x.Subtotal || 0); }, 0);
  box.innerHTML = '<div class="dhead"><b>' + rp(p.Total) + '</b><span class="badge' + (diproses ? '' : ' warn') + '">' + (diproses ? 'Diproses' : 'Belum diproses') + '</span></div>'
    + '<div class="ditem"><span>Pemasok</span><b>' + esc(p.Pemasok || '') + '</b></div>'
    + '<div class="ditem"><span>Tanggal</span><b>' + d.getDate() + ' ' + BULAN_ID[d.getMonth()] + ' ' + d.getFullYear() + ' ' + jamMenit(d) + '</b></div>'
    + items.map(function (x) { return '<div class="ditem"><span>' + esc(x.NamaProduk) + '<br><span class="ditem-sub">' + x.Qty + ' × ' + rp(x.HargaBeli) + (x.Kedaluwarsa ? ' • exp ' + esc(x.Kedaluwarsa) : '') + '</span></span><b>' + rp(x.Subtotal) + '</b></div>'; }).join('')
    + '<div class="dtotal"><span>Subtotal</span><b>' + rp(sub) + '</b></div>'
    + '<div class="dtotal"><span>Diskon</span><b>− ' + rp(p.Diskon || 0) + '</b></div>'
    + '<div class="dtotal"><span>Pajak</span><b>' + rp(p.Pajak || 0) + '</b></div>'
    + '<div class="dtotal"><span>Biaya lain</span><b>' + rp(p.BiayaLain || 0) + '</b></div>'
    + '<div class="dtotal"><span>Total</span><b class="trx-biru">' + rp(p.Total) + '</b></div>'
    + '<div class="dtotal"><span>Bayar</span><b>' + rp(p.Bayar || 0) + '</b></div>'
    + '<div class="dtotal"><span>Sisa</span><b>' + rp(p.Sisa || 0) + '</b></div>'
    + (p.Catatan ? '<div class="ditem"><span>Catatan</span><b>' + esc(p.Catatan) + '</b></div>' : '')
    + (diproses ? '' : '<button class="primary" style="width:100%;padding:13px;margin-top:12px" onclick="prosesPembelianDetail(\'' + esc(p.ID) + '\')">PROSES — Tambah Stok</button>');
}
async function simpanPemasok() { var nama = document.getElementById('pmNama').value; if (!nama) return tampilError('Nama wajib diisi.'); await DB.upsertPemasok({ ID: document.getElementById('pmId').value || '', Nama: nama, Telepon: document.getElementById('pmTelp').value, Alamat: document.getElementById('pmAlamat').value, CabangID: cabangSesiId() }); ['pmId', 'pmNama', 'pmTelp', 'pmAlamat'].forEach(function (i) { document.getElementById(i).value = ''; }); await loadData(); tutupForm('pembelian'); tampilInfo('Pemasok tersimpan.'); }

/* ---------- PENGELUARAN & KAS ---------- */
async function simpanPengeluaran() {
  var nominal = parseUang(document.getElementById('pgNominal').value); if (!nominal) return tampilError('Nominal wajib diisi.');
  await DB.simpanPengeluaran({ kategori: document.getElementById('pgKategori').value || 'Lainnya', keterangan: document.getElementById('pgKet').value, nominal: nominal, efekLaba: document.getElementById('pgEfek').value, cabangId: cabangSesiId() });
  document.getElementById('pgKet').value = ''; document.getElementById('pgNominal').value = ''; await loadData(); tutupForm('pengeluaran'); tampilInfo('Pengeluaran tersimpan.');
}
async function simpanUangKas() {
  var nominal = parseUang(document.getElementById('ukNominal').value); if (!nominal) return tampilError('Nominal wajib diisi.');
  await DB.simpanUangKas({ jenis: document.getElementById('ukJenis').value, keterangan: document.getElementById('ukKet').value, nominal: nominal, cabangId: cabangSesiId() });
  document.getElementById('ukKet').value = ''; document.getElementById('ukNominal').value = ''; await loadData(); tutupForm('aruskas'); tampilInfo('Kas tersimpan.');
}
function renderKeuangan() {
  document.getElementById('kasTable').innerHTML = (DATA.kas || []).filter(milikCabangSesi).slice(-50).reverse().map(function (k) {
    var masuk = Number(k.Masuk || 0), keluar = Number(k.Keluar || 0);
    return '<div class="cart-item"><span><b>' + esc(k.Keterangan) + '</b><br><small>' + new Date(k.Tanggal).toLocaleString('id-ID') + '</small></span><span style="text-align:right">' + (masuk > 0 ? '<b style="color:#16a34a">+' + rp(masuk) + '</b>' : '<b style="color:#dc2626">−' + rp(keluar) + '</b>') + '<br><small>Saldo ' + rp(k.Saldo) + '</small></span></div>';
  }).join('') || 'Belum ada arus kas.';
  document.getElementById('pengeluaranTable').innerHTML = (DATA.pengeluaran || []).filter(milikCabangSesi).slice(0, 100).map(function (p) {
    return '<div class="cart-item"><span><b>' + esc(p.Keterangan || p.Kategori) + '</b><br><small>' + new Date(p.Tanggal).toLocaleString('id-ID') + ' • ' + esc(p.Kategori) + (p.EfekLaba ? ' • ' + esc(p.EfekLaba) : '') + '</small></span><b>' + rp(p.Nominal) + '</b></div>';
  }).join('') || 'Belum ada pengeluaran.';
  var r = DATA.ringkasan || {};
  var labaBersih = Number(r.labaHariIni || 0) - (DATA.pengeluaran || []).filter(function (p) { return milikCabangSesi(p) && p.EfekLaba === 'MengurangiLaba'; }).reduce(function (a, p) { return a + Number(p.Nominal || 0); }, 0);
  var ongkirMasuk = (DATA.kas || []).filter(function (k) { return milikCabangSesi(k) && String(k.Keterangan || '').indexOf('Ongkir') >= 0; }).reduce(function (a, k) { return a + Number(k.Masuk || 0); }, 0);
  var ongkirKeluar = (DATA.pengeluaran || []).filter(function (p) { return milikCabangSesi(p) && p.EfekLaba === 'MengurangiOngkir'; }).reduce(function (a, p) { return a + Number(p.Nominal || 0); }, 0);
  document.getElementById('kasSummary').innerHTML = 'Laba hari ini: <b>' + rp(r.labaHariIni) + '</b> • Laba bersih (setelah pengeluaran MengurangiLaba): <b>' + rp(labaBersih) + '</b><br>Ongkir masuk: <b>' + rp(ongkirMasuk) + '</b> • Pengeluaran ongkir: <b>' + rp(ongkirKeluar) + '</b> • Ongkir bersih: <b>' + rp(ongkirMasuk - ongkirKeluar) + '</b><br>Saldo kas: <b>' + rp(r.saldoKas) + '</b>';
}
function exportKasCSV() {
  var rows = [['Tanggal', 'Keterangan', 'Masuk', 'Keluar', 'Saldo']];
  (DATA.kas || []).filter(milikCabangSesi).forEach(function (k) { rows.push([k.Tanggal, k.Keterangan, k.Masuk, k.Keluar, k.Saldo]); });
  unduhFile('arus-kas.csv', rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv');
}

/* ---------- UTANG ---------- */
function renderUtang() {
  document.getElementById('utangTable').innerHTML = (DATA.utang || []).filter(milikCabangSesiUtang).map(function (u) {
    return '<div class="cart-item"><span><b>' + esc(u.Pemasok) + '</b> <span class="badge ' + (u.Status === 'Lunas' ? '' : 'warn') + '">' + esc(u.Status) + '</span><br><small>' + esc(u.ID) + ' • Total ' + rp(u.Total) + ' • Dibayar ' + rp(u.Dibayar) + '</small></span><b>Sisa ' + rp(u.Sisa) + '</b></div>';
  }).join('') || 'Tidak ada utang.';
}
async function cicilUtang() {
  var id = document.getElementById('cicilUtangId').value; var nominal = parseUang(document.getElementById('cicilNominal').value);
  if (!id || !nominal) return tampilError('Pilih utang dan isi nominal cicilan.');
  try { await DB.cicilUtang({ utangId: id, nominal: nominal, keterangan: document.getElementById('cicilKet').value }); document.getElementById('cicilNominal').value = ''; document.getElementById('cicilKet').value = ''; await loadData(); tutupForm('utang'); tampilInfo('Cicilan tersimpan.'); } catch (e) { tampilError(e.message); }
}

/* ---------- PELANGGAN & PIUTANG ---------- */
function tierOtomatis(pl) {
  var tiers = (DATA.tier || []).slice().sort(function (a, b) { return Number(b.MinTotalBeli) - Number(a.MinTotalBeli); });
  for (var i = 0; i < tiers.length; i++) { if (Number(pl.TotalBeli || 0) >= Number(tiers[i].MinTotalBeli)) return tiers[i].Tier; }
  return pl.Tier || '—';
}
function renderPelanggan() {
  var hanyaPiutang = document.getElementById('plFilterPiutang').checked;
  var list = (DATA.pelanggan || []).filter(function (p) { return milikCabangSesi(p) && (!hanyaPiutang || Number(p.Piutang || 0) > 0); });
  document.getElementById('pelangganTable').innerHTML = list.map(function (p) {
    return '<div class="cart-item"><span><b>' + esc(p.Nama) + '</b><br><small>' + esc(p.Telepon || '') + ' • ' + esc(tierOtomatis(p)) + ' • Poin ' + (p.Poin || 0) + ' • Piutang ' + rp(p.Piutang || 0) + '<br>Terakhir beli: ' + fmtTanggalID(p.TerakhirBeli) + '</small></span><span><button class="secondary" onclick="editPelanggan(\'' + esc(p.ID) + '\')">Edit</button> <button class="secondary" onclick="lunasiSemua(\'' + escJS(p.Nama) + '\', this)">Lunasi Semua</button> <button class="danger" onclick="hapusPelanggan(\'' + esc(p.ID) + '\', this)">Hapus</button></span></div>';
  }).join('') || 'Belum ada pelanggan.';
}
function editPelanggan(id) {
  var p = DATA.pelanggan.find(function (x) { return x.ID === id; }); if (!p) return;
  document.getElementById('plId').value = p.ID; document.getElementById('plNama').value = p.Nama; document.getElementById('plTelp').value = p.Telepon || ''; document.getElementById('plAlamat').value = p.Alamat || ''; document.getElementById('plLahir').value = p.TanggalLahir || '';
  show('pelanggan', document.querySelector('nav button.menu[data-sec="pelanggan"]')); bukaForm('pelanggan');
}
function resetPelanggan() { ['plId', 'plNama', 'plTelp', 'plAlamat', 'plLahir'].forEach(function (i) { document.getElementById(i).value = ''; }); tutupForm('pelanggan'); }
async function hapusPelanggan(id, el) {
  var pl = (DATA.pelanggan || []).find(function (x) { return String(x.ID) === String(id); });
  var nama = pl ? pl.Nama : 'pelanggan ini';
  // Pelanggan bawaan "Umum" dipakai semua transaksi tanpa pelanggan — tidak boleh dihapus.
  if (pl && pl.Nama === 'Umum') {
    await konfirmasi('Tidak bisa dihapus', 'Pelanggan "Umum" adalah pelanggan bawaan yang dipakai untuk transaksi tanpa pelanggan, jadi tidak bisa dihapus.', 'Mengerti', 'primary');
    return;
  }
  // Pelanggan yang sudah punya riwayat transaksi tidak bisa dihapus supaya
  // riwayat transaksi tetap benar (transaksi menyimpan nama pelanggan sebagai
  // teks; riwayat poin pelanggan_id ON DELETE CASCADE ikut terhapus).
  // v4-45: riwayat dihitung per cabang (dulu lintas cabang — pelanggan
  // "Budi" di Cabang 1 terhalang transaksi "Budi" di Cabang 2).
  var jmlTrx = (DATA.transaksi || []).filter(function (t) { return pl && t.Pelanggan === pl.Nama && String(t.CabangID || cabangPertamaId()) === String(pl.CabangID || cabangPertamaId()); }).length;
  var pernahTransaksi = jmlTrx > 0 || Number(pl ? pl.TotalBeli || 0 : 0) > 0 || Number(pl ? pl.Piutang || 0 : 0) > 0;
  if (pernahTransaksi) {
    await konfirmasi('Tidak bisa dihapus', 'Pelanggan "' + nama + '" sudah pernah bertransaksi (' + jmlTrx + ' transaksi, total beli ' + rp(pl.TotalBeli || 0) + '), jadi tidak bisa dihapus supaya riwayat transaksi tetap benar.', 'Mengerti', 'primary');
    return;
  }
  if (!await konfirmasi('Hapus pelanggan?', 'Pelanggan "' + nama + '" akan dihapus permanen.', 'Ya, Hapus', 'danger')) return;
  try { await DB.hapusPelanggan(id); await loadData(); tutupForm('pelanggan'); tampilInfo('Pelanggan dihapus.'); }
  catch (e) { tampilError('Gagal menghapus pelanggan: ' + (e.message || e)); }
}
async function muatPengingatPiutang() {
  try {
    var res = await DB.pengingatPiutang();
    var list = res.daftar || [];
    document.getElementById('pengingatBox').innerHTML = '<p>Batas jatuh tempo: <b>' + (res.batasHari || 7) + ' hari</b> • ' + list.length + ' pelanggan jatuh tempo.</p>' + (list.map(function (x) { return esc(x.nama) + ' — ' + rp(x.piutang) + ' • ' + x.jumlah + ' transaksi • tertunggak ' + x.hariTertunggak + ' hari ' + (x.waLink ? '<button class="secondary" onclick="window.open(\'' + x.waLink + '\',\'_blank\')">' + ikon('chat', 16) + ' Ingatkan via WA</button>' : '<small>(tanpa nomor WA)</small>'); }).join('<br>') || 'Tidak ada piutang jatuh tempo.');
  } catch (e) { tampilError(e.message); }
}
async function simpanPelanggan() {
  var nama = document.getElementById('plNama').value; if (!nama) return tampilError('Nama wajib diisi.');
  try {
    await DB.upsertPelanggan({ ID: document.getElementById('plId').value || '', Nama: nama, Telepon: document.getElementById('plTelp').value, Alamat: document.getElementById('plAlamat').value, TanggalLahir: document.getElementById('plLahir').value, CabangID: cabangSesiId() });
    await loadData(); resetPelanggan(); tampilInfo('Pelanggan tersimpan.');
  } catch (e) { tampilError('Gagal menyimpan pelanggan: ' + (e.message || e)); }
}
async function lunasiSemua(nama, el) { if (!await konfirmasi('Lunasi semua piutang?', 'Semua piutang pelanggan ' + nama + ' akan ditandai lunas.', 'Ya, Lunasi', 'primary')) return; try { var res = await DB.lunasiSemua({ pelanggan: nama }); tampilInfo('Dilunasi ' + (res.jumlah || 0) + ' transaksi, total ' + rp(res.total || 0)); await loadData(); } catch (e) { tampilError('Gagal melunasi: ' + (e.message || e)); } }
async function koreksiPoin() {
  if (currentUser && currentUser.peran !== 'Admin') return tampilError('Koreksi poin hanya untuk Admin.');
  var id = document.getElementById('poinPelanggan').value; var jumlah = Number(document.getElementById('poinJumlah').value || 0);
  if (!id || !jumlah) return tampilError('Pilih pelanggan dan isi jumlah poin.');
  await DB.koreksiPoin({ pelangganId: id, jumlah: jumlah, keterangan: document.getElementById('poinKet').value });
  await loadData(); tampilInfo('Poin dikoreksi.');
}
async function muatRiwayatPoin() {
  var id = document.getElementById('poinPelanggan').value; if (!id) return tampilError('Pilih pelanggan dulu.');
  try {
    var res = await DB.getRiwayatPoin({ pelangganId: id });
    var list = res.riwayat || res || [];
    document.getElementById('riwayatPoinBox').innerHTML = '<table><tr><th>Tanggal</th><th>Jenis</th><th>Jumlah</th><th>Sisa</th><th>Keterangan</th></tr>' + list.map(function (r) { return '<tr><td>' + fmtTanggalID(r.Tanggal) + '</td><td>' + esc(r.Jenis) + '</td><td>' + r.Jumlah + '</td><td>' + (r.Sisa || '') + '</td><td>' + esc(r.Keterangan || '') + '</td></tr>'; }).join('') + '</table>';
  } catch (e) { tampilError(e.message); }
}
async function tagihanGabungan() {
  var nama = document.getElementById('tagihanPelanggan').value;
  try {
    var res = await DB.tagihanGabungan({ pelanggan: nama });
    var teks = res.teks || '';
    var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === nama; });
    var telp = pl && pl.Telepon ? String(pl.Telepon).replace(/\D/g, '') : '';
    document.getElementById('tagihanBox').innerHTML = '<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">' + esc(teks) + '</pre><button class="secondary" onclick="window.open(\'https://wa.me/' + (telp || '') + '?text=' + encodeURIComponent(teks) + '\',\'_blank\')">' + ikon('chat', 16) + ' Kirim Tagihan via WhatsApp</button>';
  } catch (e) { tampilError(e.message); }
}
function renderWinback() {
  var batas = new Date(); batas.setDate(batas.getDate() - 30);
  var list = (DATA.pelanggan || []).filter(function (p) { if (!milikCabangSesi(p) || !p.TerakhirBeli) return false; return new Date(p.TerakhirBeli) < batas; });
  document.getElementById('winbackBox').innerHTML = list.map(function (p) { return esc(p.Nama) + ' — terakhir beli ' + fmtTanggalID(p.TerakhirBeli) + ' • ' + (p.Telepon || 'tanpa nomor') + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + String(p.Telepon || '').replace(/\D/g, '') + '?text=' + encodeURIComponent('Halo ' + p.Nama + ', sudah lama tidak mampir ke ' + (DATA.pengaturan.NamaToko || 'toko kami') + '. Ada promo menanti!') + '\',\'_blank\')">' + ikon('chat', 16) + ' Sapa via WA</button>'; }).join('<br>') || 'Tidak ada pelanggan lama yang tidak datang.';
}

/* ---------- MEJA & DAPUR ---------- */
function renderMeja() {
  document.getElementById('mejaTable').innerHTML = '<table><tr><th>Meja</th><th>Status</th><th></th></tr>' + (DATA.meja || []).filter(milikCabangSesi).map(function (m) { return '<tr><td>' + esc(m.Nama) + '</td><td>' + esc(m.Status || 'Kosong') + '</td><td><button class="danger" onclick="hapusMeja(\'' + esc(m.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
}
async function simpanMeja() {
  var nama = document.getElementById('mjNama').value; if (!nama) return tampilError('Nama meja wajib diisi.');
  await DB.upsertMeja({ Nama: nama, CabangID: cabangSesiId() });
  document.getElementById('mjNama').value = ''; await loadData(); tutupForm('meja'); tampilInfo('Meja ditambah.');
}
async function hapusMeja(id, el) { if (!await konfirmasi('Hapus meja?', 'Meja ini akan dihapus dari daftar.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusMeja({ id: id }); await loadData(); tampilInfo('Meja dihapus.'); } catch (e) { tampilError('Gagal menghapus meja: ' + (e.message || e)); } }
async function muatDapur() {
  try {
    var res = await DB.getDapur({ cabangId: cabangSesiId() });
    var list = res.pesanan || res || [];
    document.getElementById('dapurBox').innerHTML = list.map(function (d) {
      var items = []; try { items = JSON.parse(d.ItemsJSON || '[]'); } catch (e) { }
      return '<div class="card"><b>' + esc(d.Meja || '') + ' — ' + esc(d.TransaksiID || '') + '</b> <span class="badge ' + (d.Status === 'Selesai' ? '' : 'warn') + '">' + esc(d.Status) + '</span><br>' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '<br><button class="secondary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Dimasak\')">Dimasak</button> <button class="primary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Selesai\')">Selesai</button></div>';
    }).join('') || 'Tidak ada pesanan dapur.';
  } catch (e) { tampilError(e.message); }
}
function renderDapur() {
  document.getElementById('dapurBox').innerHTML = (DATA.pesananDapur || []).filter(milikCabangSesi).map(function (d) {
    var items = []; try { items = JSON.parse(d.ItemsJSON || '[]'); } catch (e) { }
    return '<div class="card"><b>' + esc(d.Meja || '') + ' — ' + esc(d.TransaksiID || '') + '</b> <span class="badge ' + (d.Status === 'Selesai' ? '' : 'warn') + '">' + esc(d.Status) + '</span><br>' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '<br><button class="secondary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Dimasak\')">Dimasak</button> <button class="primary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Selesai\')">Selesai</button></div>';
  }).join('') || 'Tidak ada pesanan dapur.';
}
async function updateStatusDapur(id, status) { await DB.updateStatusDapur({ id: id, status: status }); await loadData(); }

/* ---------- KATALOG ---------- */
function renderKatalog() {
  document.getElementById('katalogTable').innerHTML = (DATA.katalog || []).filter(milikCabangSesi).map(function (k) {
    return '<div class="cart-item"><span><b>' + esc(k.Nama) + '</b> ' + (k.Aktif === 'TIDAK' ? '(nonaktif)' : '') + '</span><span><button class="secondary" onclick="editKatalog(\'' + esc(k.ID) + '\')">Edit</button> <button class="primary" onclick="bukaKatalog(\'' + esc(k.ID) + '\')">Buka Katalog</button> <button class="secondary" onclick="salinLinkKatalog(\'' + esc(k.ID) + '\')">Salin Link</button></span></div>';
  }).join('') || 'Belum ada katalog.';
  var k = (DATA.katalog || []).filter(milikCabangSesi)[0];
  if (k) {
    // pratinjau memakai filter yang SAMA dengan katalog publik
    // (loadKatalogPublik: aktif DAN tampilkan_di_katalog) — dulu produk
    // nonaktif seperti TES Kopi ikut tampil di pratinjau (99 vs 98).
    var prods = (DATA.produk || []).filter(function (p) { return produkAktif(p) && flagYa(p.TampilkanDiKatalog) && milikCabangSesi(p); });
    document.getElementById('katalogPreview').innerHTML = '<h4>' + esc(k.Nama) + '</h4>' + prods.map(function (p) {
      return '<div class="cart-item"><span>' + (k.TampilkanGambar === 'YA' ? ikonAtauGambarKatalog(p) + ' ' : '') + esc(p.Nama) + (k.TampilkanKeterangan === 'YA' && p.Keterangan ? '<br><small>' + esc(p.Keterangan) + '</small>' : '') + '</span><span>' + (k.TampilkanHarga === 'YA' ? rp(p.HargaJual) : '') + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + String((DATA.pengaturan.TeleponToko || '')).replace(/\D/g, '') + '?text=' + encodeURIComponent('Halo, saya mau pesan ' + p.Nama) + '\',\'_blank\')">' + ikon('chat', 16) + ' Pesan</button></span></div>';
    }).join('') + (k.Footer ? '<p style="color:#64748b;font-size:13px">' + esc(k.Footer) + '</p>' : '');
  } else {
    document.getElementById('katalogPreview').innerHTML = 'Belum ada katalog.';
  }
}
function linkKatalog(id) {
  var base = window.location.href.split('?')[0].split('#')[0];
  return base + '?katalog=' + encodeURIComponent(id || '');
}
function bukaKatalog(id) { window.open(linkKatalog(id), '_blank'); }
function salinLinkKatalog(id) {
  var link = linkKatalog(id);
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(link).then(function () { tampilInfo('Link katalog disalin:\n' + link); }); }
  else { prompt('Salin link katalog:', link); }
  document.getElementById('katalogLinkBox').innerHTML = 'Link katalog: <a href="' + esc(link) + '" target="_blank">' + esc(link) + '</a>';
}
/* ---------- KATALOG PUBLIK (?katalog=ID): tampil tanpa login ---------- */
async function tampilKatalogPublik(id) {
  document.body.classList.add('katalog-publik');
  ['loading', 'loginBox'].forEach(function (x) { var el = document.getElementById(x); if (el) el.style.display = 'none'; });
  document.querySelectorAll('main section').forEach(function (s) { s.style.display = 'none'; });
  var kp = document.getElementById('katalogPublik'); if (kp) kp.style.display = 'block';
  var body = document.getElementById('katalogPublikBody');
  try {
    // Tanpa login: hanya RPC katalog_publik (katalog + produk + nama/telepon toko).
    // loadAll() TIDAK dipakai di sini — sebagai anon, RLS menutup semua tabel.
    var res = await DB.loadKatalogPublik(id);
    var k = res.katalog;
    if (!k) { body.innerHTML = '<p style="color:#64748b">Katalog tidak ditemukan.</p>'; return; }
    var p = res.toko || {};
    var prods = (res.produk || []).slice();
    if (flagYa(k.SembunyikanStokKosong)) prods = prods.filter(function (x) { return Number(x.Stok || 0) > 0; });
    var wa = String(p.TeleponToko || '').replace(/\D/g, '');
    body.innerHTML = '<h3>' + esc(p.NamaToko || 'ZPOS') + '</h3><h4>' + esc(k.Nama) + '</h4>' + prods.map(function (x) {
      return '<div class="cart-item"><span>' + (flagYa(k.TampilkanGambar) ? ikonAtauGambarKatalog(x) + ' ' : '') + esc(x.Nama) + (flagYa(k.TampilkanKeterangan) && x.Keterangan ? '<br><small>' + esc(x.Keterangan) + '</small>' : '') + (flagYa(k.TampilkanStok) ? '<br><small>Stok: ' + Number(x.Stok || 0) + '</small>' : '') + '</span><span>' + (flagYa(k.TampilkanHarga) ? rp(x.HargaJual) : '') + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + wa + '?text=' + encodeURIComponent('Halo, saya mau pesan ' + x.Nama) + '\',\'_blank\')">' + ikon('chat', 16) + ' Pesan</button></span></div>';
    }).join('') + (k.Footer ? '<p style="color:#64748b;font-size:13px">' + esc(k.Footer) + '</p>' : '');
  } catch (e) { body.innerHTML = '<p style="color:#64748b">Gagal memuat katalog: ' + esc(e.message || e) + '</p>'; }
}
function editKatalog(id) {
  var k = (DATA.katalog || []).find(function (x) { return x.ID === id; }); if (!k) return;
  document.getElementById('ktgId').value = k.ID; document.getElementById('ktgNama').value = k.Nama;
  document.getElementById('ktgGambar').checked = flagYa(k.TampilkanGambar); document.getElementById('ktgHarga').checked = flagYa(k.TampilkanHarga);
  document.getElementById('ktgStok').checked = flagYa(k.TampilkanStok); document.getElementById('ktgSembunyiKosong').checked = flagYa(k.SembunyikanStokKosong);
  document.getElementById('ktgKet').checked = flagYa(k.TampilkanKeterangan); document.getElementById('ktgFooter').value = k.Footer || '';
  bukaForm('katalog');
}
function resetKatalog() { ['ktgId', 'ktgNama', 'ktgFooter'].forEach(function (i) { document.getElementById(i).value = ''; }); tutupForm('katalog'); }
async function simpanKatalog() {
  var nama = document.getElementById('ktgNama').value; if (!nama) return tampilError('Masukkan nama katalog');
  await DB.upsertKatalog({ ID: document.getElementById('ktgId').value || '', Nama: nama, TampilkanGambar: document.getElementById('ktgGambar').checked, TampilkanHarga: document.getElementById('ktgHarga').checked, TampilkanStok: document.getElementById('ktgStok').checked, SembunyikanStokKosong: document.getElementById('ktgSembunyiKosong').checked, TampilkanKeterangan: document.getElementById('ktgKet').checked, Footer: document.getElementById('ktgFooter').value, Aktif: true, CabangID: cabangSesiId() });
  await loadData(); resetKatalog(); tampilInfo('Katalog tersimpan.');
}

/* ---------- PROMO & MEMBER ---------- */
function renderPromo() {
  document.getElementById('promoTable').innerHTML = '<table><tr><th>Nama</th><th>Jenis</th><th>Nilai</th><th>Periode</th><th></th></tr>' + (DATA.promo || []).filter(function (p) { return !p.CabangID || String(p.CabangID) === String(cabangSesiId()); }).map(function (p) {
    return '<tr><td>' + esc(p.Nama) + '</td><td>' + esc(p.Jenis) + '</td><td>' + esc(p.Nilai) + '</td><td>' + esc(p.Mulai || '') + ' s/d ' + esc(p.Selesai || '') + '</td><td><button class="secondary" onclick="editPromo(\'' + esc(p.ID) + '\')">Edit</button> <button class="danger" onclick="hapusPromo(\'' + esc(p.ID) + '\', this)">Hapus</button></td></tr>';
  }).join('') + '</table>';
  document.getElementById('tierTable').innerHTML = '<table><tr><th>Tier</th><th>Min Total Beli</th><th>Diskon</th><th>Manfaat</th></tr>' + (DATA.tier || []).map(function (t) { return '<tr><td>' + esc(t.Tier) + '</td><td>' + rp(t.MinTotalBeli) + '</td><td>' + t.DiskonPersen + '%</td><td>' + esc(t.Manfaat || '') + '</td></tr>'; }).join('') + '</table>' || 'Belum ada tier.';
}
function editPromo(id) {
  var p = (DATA.promo || []).find(function (x) { return x.ID === id; }); if (!p) return;
  document.getElementById('prmId').value = p.ID; document.getElementById('prmNama').value = p.Nama; document.getElementById('prmJenis').value = p.Jenis; document.getElementById('prmNilai').value = p.Nilai; promoJenisGanti(); document.getElementById('prmSyarat').value = p.SyaratJSON || ''; document.getElementById('prmMulai').value = p.Mulai || ''; document.getElementById('prmSelesai').value = p.Selesai || ''; document.getElementById('prmJamMulai').value = p.JamMulai || ''; document.getElementById('prmJamSelesai').value = p.JamSelesai || ''; document.getElementById('prmHari').value = p.Hari || ''; document.getElementById('prmCabang').value = p.CabangID || '';
  bukaForm('promo');
}
function resetPromo() { ['prmId', 'prmNama', 'prmNilai', 'prmSyarat', 'prmMulai', 'prmSelesai', 'prmJamMulai', 'prmJamSelesai', 'prmHari', 'prmCabang'].forEach(function (i) { document.getElementById(i).value = ''; }); tutupForm('promo'); }
async function simpanPromo() {
  var _btn = null, _teksBtn = '';
  try { _btn = (typeof event !== 'undefined' && event && event.target) || null; } catch (e) { _btn = null; }
  var nama = document.getElementById('prmNama').value; if (!nama) return tampilError('Nama promo wajib diisi.');
  var syarat = document.getElementById('prmSyarat').value;
  try { if (syarat) JSON.parse(syarat); } catch (e) { return tampilError('Syarat JSON tidak valid.'); }
  // umpan balik instan — tombol "Menyimpan…" + toast.
  if (_btn) { _teksBtn = _btn.textContent; _btn.disabled = true; _btn.textContent = 'Menyimpan…'; }
  tampilInfo('Menyimpan…');
  try {
    await DB.upsertPromo({ ID: document.getElementById('prmId').value || '', Nama: nama, Jenis: document.getElementById('prmJenis').value, Nilai: parseUang(document.getElementById('prmNilai').value), SyaratJSON: syarat, Mulai: document.getElementById('prmMulai').value, Selesai: document.getElementById('prmSelesai').value, JamMulai: document.getElementById('prmJamMulai').value, JamSelesai: document.getElementById('prmJamSelesai').value, Hari: document.getElementById('prmHari').value, Aktif: true, CabangID: document.getElementById('prmCabang').value || cabangSesiId() });
    await loadData(); resetPromo(); tampilInfo('Promo tersimpan.');
  } catch (e) { tampilError('Gagal menyimpan promo: ' + (e.message || e)); } finally { if (_btn) { _btn.disabled = false; _btn.textContent = _teksBtn; } }
}
async function hapusPromo(id, el) { if (!await konfirmasi('Hapus promo?', 'Promo ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusPromo({ id: id }); await loadData(); tampilInfo('Promo dihapus.'); } catch (e) { tampilError('Gagal menghapus promo: ' + (e.message || e)); } }
async function catatTier() {
  var nama = document.getElementById('tierNama').value; if (!nama) return tampilError('Nama tier wajib diisi.');
  await DB.upsertTier({ tier: nama, minTotalBeli: parseUang(document.getElementById('tierMin').value), diskonPersen: document.getElementById('tierDiskon').value, manfaat: document.getElementById('tierManfaat').value });
  await loadData(); tampilInfo('Tier tersimpan.');
}
function renderUlangTahun() {
  var bulan = new Date().getMonth() + 1;
  var list = (DATA.pelanggan || []).filter(function (p) { if (!milikCabangSesi(p) || !p.TanggalLahir) return false; return Number(String(p.TanggalLahir).slice(5, 7)) === bulan; });
  document.getElementById('ulangTahunBox').innerHTML = list.map(function (p) { return esc(p.Nama) + ' — lahir ' + fmtTanggalID(p.TanggalLahir) + ' • Tier ' + esc(p.Tier || '—') + ' • Poin ' + (p.Poin || 0) + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + String(p.Telepon || '').replace(/\D/g, '') + '?text=' + encodeURIComponent('Selamat ulang tahun, ' + p.Nama + '! Ada promo ulang tahun khusus untukmu di ' + (DATA.pengaturan.NamaToko || 'toko kami') + '.') + '\',\'_blank\')">' + ikon('chat', 16) + ' Kirim Ucapan + Promo</button>'; }).join('<br>') || 'Tidak ada pelanggan yang berulang tahun bulan ini.';
}

/* ---------- MASTER ---------- */
function renderMaster() {
  document.getElementById('grupTable').innerHTML = (DATA.grup || []).map(function (g) { return '<div class="cart-item"><span>' + esc(g.Nama) + '</span><span><button class="danger" onclick="hapusGrup(\'' + esc(g.ID) + '\', this)">Hapus</button></span></div>'; }).join('') || 'Belum ada grup.';
  document.getElementById('satuanTable').innerHTML = '<table><tr><th>Nama</th><th>Singkatan</th><th>Desimal</th><th></th></tr>' + (DATA.satuan || []).map(function (s) { return '<tr><td>' + esc(s.Nama) + '</td><td>' + esc(s.Singkatan || '') + '</td><td>' + (s.Desimal === true || s.Desimal === 'YA' ? 'YA' : 'TIDAK') + '</td><td><button class="danger" onclick="hapusSatuan(\'' + esc(s.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
  document.getElementById('jenisBayarTable').innerHTML = (DATA.jenisBayar || []).map(function (j) { return '<div class="cart-item"><span>' + esc(j.Nama) + '</span><span><button class="danger" onclick="hapusJenisBayar(\'' + esc(j.ID) + '\', this)">Hapus</button></span></div>'; }).join('') || 'Belum ada jenis pembayaran.';
  document.getElementById('itemPengeluaranTable').innerHTML = (DATA.itemPengeluaran || []).map(function (j) { return '<div class="cart-item"><span>' + esc(j.Nama) + '</span><span><button class="danger" onclick="hapusItemPengeluaran(\'' + esc(j.ID) + '\', this)">Hapus</button></span></div>'; }).join('') || 'Belum ada item pengeluaran.';
  document.getElementById('teksTable').innerHTML = '<table><tr><th>Nama</th><th>Keterangan</th><th>Jenis</th><th></th></tr>' + (DATA.daftarTeks || []).map(function (t) { return '<tr><td>' + esc(t.Nama) + '</td><td>' + esc(t.Keterangan || '') + '</td><td>' + esc(t.Jenis) + '</td><td><button class="danger" onclick="hapusTeks(\'' + esc(t.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
  document.getElementById('pegawaiTable').innerHTML = '<table><tr><th>Nama</th><th>Jabatan</th><th>Target</th><th>Komisi</th><th></th></tr>' + (DATA.pegawai || []).map(function (p) { return '<tr><td>' + esc(p.Nama) + '</td><td>' + esc(p.Jabatan || '') + '</td><td>' + rp(p.Target || 0) + '</td><td>' + (p.KomisiPersen || 0) + '%</td><td><button class="danger" onclick="hapusPegawai(\'' + esc(p.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
}
async function simpanGrup() { var n = document.getElementById('gNama').value; if (!n) return tampilError('Nama grup wajib diisi.'); await DB.upsertGrup({ id: document.getElementById('gId').value || '', nama: n }); document.getElementById('gNama').value = ''; await loadData(); tutupForm('master'); tampilInfo('Grup tersimpan.'); }
async function hapusGrup(id, el) { if (!await konfirmasi('Hapus grup?', 'Grup ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusGrup({ id: id }); await loadData(); tampilInfo('Grup dihapus.'); } catch (e) { tampilError('Gagal menghapus grup: ' + (e.message || e)); } }
async function simpanSatuan() { var n = document.getElementById('stNama').value; if (!n) return tampilError('Nama satuan wajib diisi.'); try { await DB.upsertSatuan({ id: document.getElementById('stId').value || '', nama: n, singkatan: document.getElementById('stSingkat').value, desimal: document.getElementById('stDesimal').value }); } catch (e) { return tampilError('Gagal menyimpan satuan: ' + (e.message || e)); } document.getElementById('stNama').value = ''; document.getElementById('stSingkat').value = ''; await loadData(); tutupForm('master'); tampilInfo('Satuan tersimpan.'); }
async function hapusSatuan(id, el) { if (!await konfirmasi('Hapus satuan?', 'Satuan ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusSatuan({ id: id }); await loadData(); tampilInfo('Satuan dihapus.'); } catch (e) { tampilError('Gagal menghapus satuan: ' + (e.message || e)); } }
async function simpanJenisBayar() { var n = document.getElementById('jbNama').value; if (!n) return tampilError('Nama wajib diisi.'); await DB.upsertJenisBayar({ id: document.getElementById('jbId').value || '', nama: n }); document.getElementById('jbNama').value = ''; await loadData(); tutupForm('master'); tampilInfo('Jenis bayar tersimpan.'); }
async function hapusJenisBayar(id, el) { if (!await konfirmasi('Hapus jenis bayar?', 'Jenis bayar ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusJenisBayar({ id: id }); await loadData(); tampilInfo('Jenis bayar dihapus.'); } catch (e) { tampilError('Gagal menghapus jenis bayar: ' + (e.message || e)); } }
async function simpanItemPengeluaran() { var n = document.getElementById('ipNama').value; if (!n) return tampilError('Nama wajib diisi.'); await DB.upsertItemPengeluaran({ id: document.getElementById('ipId').value || '', nama: n }); document.getElementById('ipNama').value = ''; await loadData(); tutupForm('master'); tampilInfo('Item tersimpan.'); }
async function hapusItemPengeluaran(id, el) { if (!await konfirmasi('Hapus item pengeluaran?', 'Item ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusItemPengeluaran({ id: id }); await loadData(); tampilInfo('Item dihapus.'); } catch (e) { tampilError('Gagal menghapus item: ' + (e.message || e)); } }
async function simpanTeks() { var n = document.getElementById('txNama').value; if (!n) return tampilError('Nama wajib diisi.'); await DB.simpanTeks({ id: document.getElementById('txId').value || '', nama: n, keterangan: document.getElementById('txKet').value, jenis: document.getElementById('txJenis').value }); document.getElementById('txNama').value = ''; document.getElementById('txKet').value = ''; await loadData(); tutupForm('master'); tampilInfo('Teks tersimpan.'); }
async function hapusTeks(id, el) { if (!await konfirmasi('Hapus teks?', 'Teks ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusTeks({ id: id }); await loadData(); tampilInfo('Teks dihapus.'); } catch (e) { tampilError('Gagal menghapus teks: ' + (e.message || e)); } }
async function simpanPegawai() { var n = document.getElementById('pgwNama').value; if (!n) return tampilError('Nama wajib diisi.'); await DB.upsertPegawai({ id: document.getElementById('pgwId').value || '', nama: n, telepon: document.getElementById('pgwTelp').value, jabatan: document.getElementById('pgwJabatan').value, target: parseUang(document.getElementById('pgwTarget').value), komisiPersen: document.getElementById('pgwKomisi').value }); ['pgwNama', 'pgwTelp', 'pgwJabatan', 'pgwTarget', 'pgwKomisi'].forEach(function (i) { document.getElementById(i).value = ''; }); await loadData(); tutupForm('master'); tampilInfo('Pegawai tersimpan.'); }
async function hapusPegawai(id, el) { if (!await konfirmasi('Hapus pegawai?', 'Pegawai ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusPegawai({ id: id }); await loadData(); tampilInfo('Pegawai dihapus.'); } catch (e) { tampilError('Gagal menghapus pegawai: ' + (e.message || e)); } }

/* ---------- BAHAN & RESEP ---------- */
function renderBahan() {
  document.getElementById('bahanTable').innerHTML = '<table><tr><th>Nama</th><th>Stok</th><th>Harga/satuan</th><th>Min.</th><th></th></tr>' + (DATA.bahan || []).map(function (b) { return '<tr><td>' + esc(b.Nama) + '</td><td>' + b.Stok + ' ' + (b.Satuan || '') + '</td><td>' + rp(b.HargaPerSatuan) + '</td><td>' + (b.StokMinimum || 5) + '</td><td><button class="danger" onclick="hapusBahan(\'' + esc(b.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
  var pid = document.getElementById('resepProduk').value;
  var list = (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(pid); });
  document.getElementById('resepList').innerHTML = list.map(function (r) { return esc(r.NamaBahan) + ' — ' + r.QtyPakai + ' per produk'; }).join('<br>') || 'Belum ada resep untuk produk ini.';
  var hpp = 0; list.forEach(function (r) { var b = (DATA.bahan || []).find(function (x) { return x.ID === r.BahanID; }); if (b) hpp += Number(b.HargaPerSatuan) * Number(r.QtyPakai); });
  document.getElementById('resepHpp').textContent = 'HPP dari resep: ' + rp(hpp);
}
async function simpanBahan() { var nama = document.getElementById('bNama').value; if (!nama) return tampilError('Nama bahan wajib diisi.'); await DB.upsertBahan({ Nama: nama, Satuan: document.getElementById('bSatuan').value, Stok: document.getElementById('bStok').value, HargaPerSatuan: parseUang(document.getElementById('bHarga').value), StokMinimum: document.getElementById('bMin').value }); ['bNama', 'bSatuan', 'bStok', 'bHarga'].forEach(function (i) { document.getElementById(i).value = ''; }); await loadData(); tutupForm('master'); tampilInfo('Bahan tersimpan.'); }
async function hapusBahan(id, el) { if (!await konfirmasi('Hapus bahan?', 'Bahan ini akan dihapus.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusBahan({ id: id }); await loadData(); tampilInfo('Bahan dihapus.'); } catch (e) { tampilError('Gagal menghapus bahan: ' + (e.message || e)); } }
function tambahResepRow() {
  var bid = document.getElementById('resepBahan').value; var b = (DATA.bahan || []).find(function (x) { return x.ID === bid; }); if (!b) return tampilError('Pilih bahan dulu.');
  resepDraft.push({ bahanId: bid, namaBahan: b.Nama, qty: Number(document.getElementById('resepQty').value || 0) });
  document.getElementById('resepList').innerHTML = resepDraft.map(function (r) { return esc(r.namaBahan) + ' — ' + r.qty; }).join('<br>');
}
async function simpanResep() {
  var pid = document.getElementById('resepProduk').value;
  if (!resepDraft.length) return tampilError('Tambahkan minimal 1 bahan ke resep dulu.');
  var res = await DB.simpanResep({ produkId: pid, items: resepDraft });
  resepDraft = []; tampilInfo('Resep tersimpan. HPP baru: ' + rp(res.hpp || 0)); await loadData();
}
async function hitungHPPProduk(id) { var res = await DB.hitungHPP({ produkId: id }); tampilInfo('HPP: ' + rp(res.hpp || 0)); }

/* ---------- LAPORAN ---------- */
function renderLaporan() {
  // v4-45: ringkasan hanya menghitung transaksi Lunas — dulu semua
  // transaksi incl. Belum Lunas, bertentangan dengan catatan di bawahnya
  // dan dengan laporan detail.
  var lunasList = (DATA.transaksi || []).filter(function (t) { return milikCabangSesi(t) && t.StatusBayar === 'Lunas'; });
  var total = lunasList.reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
  var keluar = (DATA.pengeluaran || []).filter(milikCabangSesi).reduce(function (a, t) { return a + Number(t.Nominal || 0); }, 0);
  document.getElementById('laporanSummary').innerHTML = 'Total penjualan (Lunas): <b>' + rp(total) + '</b> • Total pengeluaran: <b>' + rp(keluar) + '</b> • Jumlah transaksi: <b>' + lunasList.length + '</b><p style="color:#64748b;font-size:13px">Omzet laporan hanya menghitung transaksi Lunas; piutang tampil terpisah di Laporan Piutang.</p>';
}
function renderLaporanPremium() {
  var a = (DATA.ringkasan || {}).analitik7 || {};
  var el = document.getElementById('laporanPremium');
  if (el) el.textContent = '7 hari terakhir: omzet ' + rp(a.omzet) + ' • laba ' + rp(a.laba) + ' • ' + (a.jumlah || 0) + ' transaksi';
}
async function muatLaporan() {
  var jenis = document.getElementById('lapJenis').value;
  var dari = document.getElementById('lapDari').value, sampai = document.getElementById('lapSampai').value;
  var cabang = document.getElementById('lapCabang').value;
  try {
    var res = await DB.getLaporanLengkap({ jenis: jenis, dari: dari, sampai: sampai, cabangId: cabangLaporanEfektif(cabang) });
    var ring = res.ringkasan || {};
    var html = '<h4>Laporan ' + esc(jenis) + ' — ' + esc(dari || '—') + ' s/d ' + esc(sampai || '—') + '</h4>';
    // hanya nilai UANG yang dibungkus rp() — hitungan (Transaksi,
    // Item, Jumlah, Produk, StokMenipis) tampil sebagai angka polos, dan
    // PajakPersen sebagai persen (dulu "Transaksi: Rp 2").
    var HITUNGAN_LAPORAN = ['Transaksi', 'Item', 'Jumlah', 'Produk', 'StokMenipis'];
    html += '<p>' + Object.keys(ring).map(function (k) {
      var v = ring[k];
      var teks = (typeof v === 'number' && HITUNGAN_LAPORAN.indexOf(k) > -1) ? String(v)
        : (k === 'PajakPersen' ? String(v) + '%' : (typeof v === 'number' ? rp(v) : esc(v)));
      return esc(k) + ': <b>' + teks + '</b>';
    }).join(' • ') + '</p>';
    var baris = res.baris || [];
    if (baris.length) {
      var keys = Object.keys(baris[0]);
      html += '<table><tr>' + keys.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr>' + baris.map(function (b) { return '<tr>' + keys.map(function (k) { return '<td>' + esc(b[k] == null ? '' : b[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
    } else html += '<p>Tidak ada data pada periode ini.</p>';
    document.getElementById('laporanBox').innerHTML = html;
    if (jenis === 'penjualan') renderPieTopProduct(baris, dari, sampai);
    var tk = await DB.getTopKasir({ dari: dari, sampai: sampai, cabangId: cabangLaporanEfektif(cabang) });
    var top = tk.top || tk || [];
    document.getElementById('topKasirBox').innerHTML = '<h4>Top Kasir</h4><table><tr><th>Kasir</th><th>Omzet</th><th>Jumlah</th><th>Komisi</th></tr>' + top.map(function (t) { return '<tr><td>' + esc(t.kasir) + '</td><td>' + rp(t.omzet) + '</td><td>' + (t.jumlah || 0) + '</td><td>' + rp(t.komisi || 0) + '</td></tr>'; }).join('') + '</table>';
  } catch (e) { tampilError(e.message); }
}
function renderPieTopProduct(baris, dari, sampai) {
  // agregasi HANYA dari transaksi Lunas dalam rentang filter
  // (dulu DATA.detail semua waktu — pie tidak mengikuti filter tanggal),
  // dengan qty bersih (detail dikurangi retur untuk transaksi yang sama).
  // ID transaksi diambil dari baris laporan yang sudah terfilter; bila
  // baris kosong, filter DATA.transaksi sendiri dari dari/sampai.
  var trxIds = {};
  if (baris && baris.length) {
    baris.forEach(function (b) { if (b.ID) trxIds[b.ID] = true; });
  } else {
    (DATA.transaksi || []).forEach(function (t) {
      if (!milikCabangSesi(t)) return;
      if (t.StatusBayar !== 'Lunas') return;
      var tg = String(t.Tanggal || '').slice(0, 10);
      if (dari && tg < dari) return;
      if (sampai && tg > sampai) return;
      trxIds[t.ID] = true;
    });
  }
  var returQty = {};
  (DATA.retur || []).forEach(function (r) {
    if (!trxIds[r.TransaksiID]) return;
    var kunci = r.TransaksiID + '|' + (r.Produk || '');
    returQty[kunci] = (returQty[kunci] || 0) + Number(r.Qty || 0);
  });
  var jual = {}; var totalQty = 0;
  (DATA.detail || []).forEach(function (x) {
    if (!trxIds[x.TransaksiID]) return;
    var q = Number(x.Qty || 0) - (returQty[x.TransaksiID + '|' + (x.NamaProduk || '')] || 0);
    if (q <= 0) return;
    jual[x.NamaProduk] = (jual[x.NamaProduk] || 0) + q; totalQty += q;
  });
  var semua = Object.keys(jual).map(function (k) { return { nama: k, qty: jual[k] }; }).sort(function (a, b) { return b.qty - a.qty; });
  var top = semua.slice(0, 5);
  if (!top.length || totalQty <= 0) { document.getElementById('pieBox').innerHTML = ''; return; }
  // Sisa produk di luar 5 besar ditampilkan sebagai irisan "Lainnya"
  // supaya pie tetap genap 100% (dulu sisa pembulatan dilempar ke item
  // terakhir — ONGKIR 1/13 jadi 32%).
  var sisaQty = totalQty - top.reduce(function (a, t) { return a + t.qty; }, 0);
  if (sisaQty > 0) top.push({ nama: 'Lainnya', qty: sisaQty });
  var warna = ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#94a3b8'];
  // Largest-remainder: bagi sisa pembulatan ke item dengan sisa desimal
  // terbesar, bukan ke item terakhir — total tepat 100%.
  var mentah = top.map(function (t) { return t.qty / totalQty * 100; });
  var persen = mentah.map(function (v) { return Math.floor(v); });
  var sisa = 100 - persen.reduce(function (a, b) { return a + b; }, 0);
  var urutan = mentah.map(function (v, i) { return { i: i, sisaDes: v - Math.floor(v) }; }).sort(function (a, b) { return b.sisaDes - a.sisaDes; });
  for (var k = 0; k < sisa; k++) persen[urutan[k % urutan.length].i]++;
  var acc = 0; var stops = [];
  persen.forEach(function (p, i) { stops.push(warna[i % warna.length] + ' ' + acc + '% ' + (acc + p) + '%'); acc += p; });
  document.getElementById('pieBox').innerHTML = '<h4>Pie Chart — Top Product (total 100%)</h4><div class="pie" style="background:conic-gradient(' + stops.join(', ') + ')"></div>' + top.map(function (t, i) { return '<div><span style="display:inline-block;width:12px;height:12px;background:' + warna[i % warna.length] + '"></span> ' + esc(t.nama) + ' — ' + t.qty + ' (' + persen[i] + '%)</div>'; }).join('');
}
async function exportLaporan() {
  var jenis = document.getElementById('lapJenis').value;
  try {
    var res = await DB.exportLaporanExcel({ jenis: jenis, dari: document.getElementById('lapDari').value, sampai: document.getElementById('lapSampai').value, cabangId: cabangLaporanEfektif(document.getElementById('lapCabang').value) });
    unduhFile('laporan-' + jenis + '.csv', res.csv || '', 'text/csv');
  } catch (e) { tampilError(e.message); }
}
function exportCSV() {
  var rows = [['ID', 'Tanggal', 'Pelanggan', 'Total', 'Bayar', 'Sisa', 'StatusBayar']];
  (DATA.transaksi || []).filter(milikCabangSesi).forEach(function (t) { rows.push([t.ID, t.Tanggal, t.Pelanggan, t.Total, t.Bayar, t.Sisa, t.StatusBayar]); });
  unduhFile('transaksi.csv', rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv');
}
function backupJSON() {
  unduhFile('backup-pos.json', JSON.stringify(DATA, null, 2), 'application/json');
}

/* ---------- LAPOR BOS (MANUAL) ---------- */
async function pratinjauLaporBos() {
  try {
    var res = await DB.kirimLaporBos({ tanggal: document.getElementById('lbTanggal').value || undefined, cabangId: cabangLaporanEfektif(document.getElementById('lbCabang').value), mode: document.getElementById('lbMode').value });
    laporBosTeks = res.teks || ''; laporBosWa = res.waLink || '';
    document.getElementById('lbPreview').textContent = laporBosTeks;
    document.getElementById('lbWaLink').innerHTML = laporBosWa ? '<a href="' + esc(laporBosWa) + '" target="_blank">Buka WhatsApp</a>' : '';
  } catch (e) { tampilError(e.message); }
}
function kirimLaporBosWA() {
  if (!laporBosTeks) return tampilError('Buat pratinjau laporan dulu.');
  var wa = (DATA.pengaturan || {}).NomorPemilikWA || '';
  var url = wa ? ('https://wa.me/' + wa + '?text=' + encodeURIComponent(laporBosTeks)) : (laporBosWa || ('https://wa.me/?text=' + encodeURIComponent(laporBosTeks)));
  window.open(url, '_blank');
  catatLaporBos('WhatsApp');
}
function cetakLaporBos() {
  if (!laporBosTeks) return tampilError('Buat pratinjau laporan dulu.');
  document.getElementById('strukPrint').textContent = laporBosTeks;
  catatLaporBos('Cetak');
  window.print();
}
async function catatLaporBos(cara) {
  if (!laporBosTeks) return;
  try { await DB.catatLaporBos({ teks: laporBosTeks, cara: cara, cabangId: cabangLaporanEfektif(document.getElementById('lbCabang').value) }); } catch (e) { /* pencatatan gagal: laporan tetap terkirim/dicetak */ }
}

/* ---------- PENGGUNA ---------- */
function renderPengguna() {
  document.getElementById('penggunaTable').innerHTML = '<table><tr><th>Nama</th><th>Peran</th><th>Cabang</th><th>Akses Transaksi</th><th></th></tr>' + (DATA.pengguna || []).map(function (u) { return '<tr><td>' + esc(u.Nama) + '</td><td>' + esc(u.Peran) + '</td><td>' + esc(u.CabangID || '—') + '</td><td>' + esc(u.AksesTransaksi || 'Tidak dibatasi') + '</td><td><button class="secondary" onclick="editPengguna(\'' + esc(u.ID) + '\')">Edit</button> <button class="danger" onclick="hapusPengguna(\'' + esc(u.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
}
function bacaIzin() {
  var iz = {};
  IZIN_KEYS.forEach(function (k) { var el = document.getElementById('iz_' + k[0]); if (el) iz[k[0]] = el.checked; });
  return iz;
}
function editPengguna(id) {
  var u = (DATA.pengguna || []).find(function (x) { return x.ID === id; }); if (!u) return;
  document.getElementById('uId').value = u.ID; document.getElementById('uNama').value = u.Nama; document.getElementById('uEmail').value = u.Email || '';
  document.getElementById('uPeran').value = u.Peran; document.getElementById('uCabang').value = u.CabangID || ''; document.getElementById('uAkses').value = u.AksesTransaksi || 'Tidak dibatasi';
  try { var iz = JSON.parse(u.IzinJSON || '{}'); IZIN_KEYS.forEach(function (k) { var el = document.getElementById('iz_' + k[0]); if (el) el.checked = iz[k[0]] !== false; }); } catch (e) { }
  bukaForm('pengguna');
}
function resetPengguna() { ['uId', 'uNama', 'uEmail'].forEach(function (i) { document.getElementById(i).value = ''; }); document.getElementById('uPeran').value = 'Kasir'; tutupForm('pengguna'); }
async function simpanPengguna() {
  var nama = document.getElementById('uNama').value, email = document.getElementById('uEmail').value;
  if (!nama || !email || email.indexOf('@') < 0) return tampilError('Nama dan email yang valid wajib diisi.');
  await DB.upsertPengguna({ ID: document.getElementById('uId').value || '', Nama: nama, Email: email, Peran: document.getElementById('uPeran').value, CabangID: document.getElementById('uCabang').value, AksesTransaksi: document.getElementById('uAkses').value, IzinJSON: JSON.stringify(bacaIzin()) });
  await loadData(); resetPengguna(); tampilInfo('Pengguna tersimpan.');
}
async function hapusPengguna(id, el) { if (!await konfirmasi('Hapus pengguna?', 'Pengguna ini tidak bisa lagi login ke aplikasi.', 'Ya, Hapus', 'danger')) return; try { await DB.hapusPengguna({ id: id }); await loadData(); tampilInfo('Pengguna dihapus.'); } catch (e) { tampilError('Gagal menghapus pengguna: ' + (e.message || e)); } }

/* ---------- LOGO STRUK (3 slot ala Griyo) ----------
   LogoToko  = Logo 1, Mode teks — logo utama di atas struk.
   Logo2     = Logo 2, Mode grafis & WhatsApp — logo di gambar struk (kanvas PNG).
               Kosong = pakai Logo 1.
   Watermark = logo samar di belakang isi struk (layar, cetak, gambar). */
var logoDataUrl = '', logo2DataUrl = '', watermarkDataUrl = '';
var LOGO_SLOT = {
  LogoToko: { get: function () { return logoDataUrl; }, set: function (v) { logoDataUrl = v; }, file: 'logoFile', img: 'logoPreview', hapus: 'logoHapusBtn', nama: 'logoNama' },
  Logo2: { get: function () { return logo2DataUrl; }, set: function (v) { logo2DataUrl = v; }, file: 'logo2File', img: 'logo2Preview', hapus: 'logo2HapusBtn', nama: 'logo2Nama' },
  Watermark: { get: function () { return watermarkDataUrl; }, set: function (v) { watermarkDataUrl = v; }, file: 'wmFile', img: 'wmPreview', hapus: 'wmHapusBtn', nama: 'wmNama' }
};
function tampilLogoPreview() {
  var p = DATA.pengaturan || {};
  Object.keys(LOGO_SLOT).forEach(function (k) {
    var s = LOGO_SLOT[k];
    var img = document.getElementById(s.img); if (!img) return;
    var src = s.get() || p[k] || '';
    img.src = src; img.style.display = src ? 'block' : 'none';
    var hb = document.getElementById(s.hapus); if (hb) hb.style.display = src ? '' : 'none';
    var nm = document.getElementById(s.nama); if (nm && !nm.dataset.dipilih) nm.textContent = src ? 'Logo sudah tersimpan' : 'Belum ada file';
  });
}
function pilihLogo(input, kunci) {
  kunci = kunci || 'LogoToko';
  var f = input.files && input.files[0]; if (!f) return;
  if (!/^image\//.test(f.type || '')) { tampilError('Pilih file gambar (PNG/JPG).'); input.value = ''; return; }
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () {
      var url = kecilkanLogo(img, 512);
      if (url.length > 200000) url = kecilkanLogo(img, 256);
      LOGO_SLOT[kunci].set(url);
      var nm = document.getElementById(LOGO_SLOT[kunci].nama); if (nm) { nm.textContent = f.name; nm.dataset.dipilih = '1'; }
      tampilLogoPreview(); pratinjauProfil();
    };
    img.onerror = function () { tampilError('File gambar tidak bisa dibaca.'); };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function kecilkanLogo(img, maks) {
  var sk = Math.min(1, maks / Math.max(img.width, img.height));
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.width * sk)); cv.height = Math.max(1, Math.round(img.height * sk));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/png');
}
function hapusLogo(kunci) {
  kunci = kunci || 'LogoToko';
  LOGO_SLOT[kunci].set(''); tampilLogoPreview(); pratinjauProfil();
  var inp = document.getElementById(LOGO_SLOT[kunci].file); if (inp) inp.value = '';
  var nm = document.getElementById(LOGO_SLOT[kunci].nama); if (nm) { nm.textContent = 'Belum ada file'; delete nm.dataset.dipilih; }
}
/* Logo atas untuk tampilan grafis (layar/cetak/gambar WA): Logo 2 bila ada, kalau tidak Logo 1. */
function logoGrafis(d) { return (d && d.logo2) || (d && d.logo) || ''; }
// Struk teks -> HTML untuk layar & cetak: logo (bila ada) di atas, lalu isi struk.
function strukKeHtml(teks) {
  if (lastStrukData) return strukHtml(lastStrukData);
  var logo = (DATA.pengaturan || {}).LogoToko || logoDataUrl || '';
  var html = esc(teks).replace(/\n/g, '<br>');
  if (logo) html = '<div style="text-align:center;margin-bottom:6px"><img src="' + logo + '" style="max-width:120px;max-height:120px"></div>' + html;
  return html;
}

/* ---------- PENGATURAN / CABANG / LOGS ---------- */
async function simpanPengaturan() {
  var payload = { NamaToko: document.getElementById('sNama').value, AlamatToko: document.getElementById('sAlamat').value, KotaToko: document.getElementById('sKota').value, TeleponToko: document.getElementById('sTelp').value, FooterStruk: document.getElementById('sFooter').value, SloganToko: document.getElementById('sSlogan').value, TargetHarian: parseUang(document.getElementById('sTarget').value), NomorPemilikWA: document.getElementById('sWa').value, JatuhTempoHari: document.getElementById('sJatuhTempo').value, PoinAktif: document.getElementById('sPoinAktif').value, PoinPerRupiah: document.getElementById('sPoinPer').value, PoinTukarRate: document.getElementById('sPoinRate').value, PajakAktif: document.getElementById('sPajakAktif').value, PajakPersen: document.getElementById('sPajakPersen').value, Bahasa: document.getElementById('sBahasa').value, FormatTanggal: document.getElementById('sFormatTanggal').value, ModeGelap: document.getElementById('sGelap').value, TampilkanPoinStruk: document.getElementById('sPoinStruk').value, WatermarkStruk: document.getElementById('sWatermark').value, StrukUkuranKertas: document.getElementById('sKertas').value, ModeMejaAktif: document.getElementById('sMeja').value, PromoAktif: document.getElementById('sPromo').value, MultiCabangAktif: document.getElementById('sMultiCabang').value, LogoToko: logoDataUrl, Logo2: logo2DataUrl, Watermark: watermarkDataUrl };
  await DB.simpanPengaturan(payload);
  // v4-41: target harian per cabang (best-effort; TargetHarian global di payload tetap jadi fallback).
  try { if (typeof DB !== 'undefined' && DB && typeof DB.tulisTargetCabang === 'function') { var _tt = DB.tulisTargetCabang(cabangSesiId(), parseUang(document.getElementById('sTarget').value)); if (_tt && _tt.catch) _tt.catch(function () {}); } } catch (e) {}
  document.body.classList.toggle('dark', payload.ModeGelap === 'YA');
  var cb = document.getElementById('sCabangAktif').value;
  if (!cabangTerkunci() && cb && cb !== cabangAktifId()) { await DB.setCabangAktif({ id: cb }); }
  await loadData(); tampilInfo('Pengaturan tersimpan. Nama toko bisa diubah lagi kapan pun di sini.');
}
async function simpanCabang() {
  var nama = document.getElementById('cbNama').value; if (!nama) return tampilError('Nama cabang wajib diisi.');
  await DB.upsertCabang({ ID: document.getElementById('cbId').value || '', Nama: nama, Alamat: document.getElementById('cbAlamat').value, Telepon: document.getElementById('cbTelp').value });
  ['cbNama', 'cbAlamat', 'cbTelp'].forEach(function (i) { document.getElementById(i).value = ''; });
  await loadData(); tutupForm('pengaturan'); tampilInfo('Cabang tersimpan.');
}
/* v4-42: hapus cabang memakai hasil DB.hapusCabang — bila ditolak karena
   riwayat ({ok:false, alasan, jumlah:{transaksi, pembelian, kas, kasNet}}),
   tampilkan alasannya + "kas net Rp X" bila kasNet ≠ 0; bila berhasil
   dengan rincian {dihapus:{produk, pelanggan, pemasok, kas}}, sebutkan
   yang ikut terhapus (kas hanya bila > 0); bila kembalian lama
   (hanya {ok:true}), toast berhasil biasa. */
async function hapusCabang(id, el) {
  if (!await konfirmasi('Hapus cabang?', 'Cabang ini akan dihapus.', 'Ya, Hapus', 'danger')) return;
  try {
    var res = await DB.hapusCabang({ id: id });
    if (res && res.ok === false) {
      var j = res.jumlah || {};
      var rincian = ((j.transaksi || 0) || (j.pembelian || 0) || (j.kas || 0)) ? ' (' + (j.transaksi || 0) + ' transaksi, ' + (j.pembelian || 0) + ' pembelian, ' + (j.kas || 0) + ' kas' + (((j.kasNet || 0) !== 0) ? ', kas net ' + rp(j.kasNet) : '') + ')' : '';
      tampilError('Cabang tidak bisa dihapus: ' + (res.alasan || 'masih ada riwayat.') + rincian);
      return;
    }
    await loadData();
    if (res && res.dihapus) tampilInfo('Cabang dihapus. (' + (res.dihapus.produk || 0) + ' produk, ' + (res.dihapus.pelanggan || 0) + ' pelanggan, ' + (res.dihapus.pemasok || 0) + ' pemasok' + ((res.dihapus.kas || 0) > 0 ? ', ' + (res.dihapus.kas || 0) + ' entri kas' : '') + ((res.dihapus.tertunda || 0) > 0 ? ', ' + (res.dihapus.tertunda || 0) + ' transaksi tertunda' : '') + ((res.dihapus.riwayatPoin || 0) > 0 ? ', ' + (res.dihapus.riwayatPoin || 0) + ' riwayat poin' : '') + ' ikut terhapus.)');
    else tampilInfo('Cabang dihapus.');
  } catch (e) { tampilError('Gagal menghapus cabang: ' + (e.message || e)); }
}
/* v4-41: guard kunci hanya menolak Kasir terkunci — Admin selalu lolos. */
async function setCabangAktif(id) { if (cabangTerkunci()) { tampilError('Cabang Anda terkunci oleh Admin.'); return; } await DB.setCabangAktif({ id: id }); await loadData(); tampilInfo('Cabang aktif diganti.'); }
async function simpanTerjemahan() {
  var istilah = ['Kasir', 'Pelanggan', 'Lunas', 'Kurang', 'Belum Dibayar', 'Total', 'Subtotal', 'Kembali', 'Proses', 'Selesai', 'Diambil', 'Antri'];
  var peta = {};
  istilah.forEach(function (k) { var el = document.getElementById('tr_' + k.replace(/ /g, '_')); if (el) peta[k] = el.value; });
  await DB.simpanTerjemahan({ peta: peta });
  DATA.terjemahan = peta;
  tampilInfo('Terjemahan tersimpan dan diterapkan ke struk.');
}
async function muatLogs() {
  try {
    var res = await DB.getLogs({ limit: 100 });
    var list = res.logs || DATA.logs || [];
    document.getElementById('logsBox').innerHTML = '<table><tr><th>Tanggal</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr>' + list.map(function (l) { return '<tr><td>' + fmtTanggalID(l.Tanggal) + '</td><td>' + esc(l.Pengguna || '') + '</td><td>' + esc(l.Aksi || '') + '</td><td>' + esc(l.Detail || '') + '</td></tr>'; }).join('') + '</table>';
  } catch (e) { tampilError(e.message); }
}
// Boot: tautan katalog publik (?katalog=ID) dibuka tanpa login.
(function () {
  // kembali online -> sinkronkan antrean otomatis; offline ->
  // perbarui badge. Setiap tulis offline berhasil -> badge diperbarui.
  try {
    if (DB.setOnOutboxBerubah) DB.setOnOutboxBerubah(perbaruiIndikatorOffline);
    window.addEventListener('online', function () { sinkronisasiOtomatis(); });
    window.addEventListener('offline', function () { perbaruiIndikatorOffline(); });
  } catch (e) {}
  var katId = '';
  try { var q = new URLSearchParams(window.location.search); katId = q.get('katalog') || ''; } catch (e) { katId = ''; }
  if (katId) tampilKatalogPublik(katId); else loadData();
})();
