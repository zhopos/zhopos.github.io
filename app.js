/* ZPOS v4 — Logika UI (cermin V12) */
var DATA = { produk: [], transaksi: [], detail: [], pelanggan: [], pemasok: [], pembelian: [], pembelianDetail: [], pengeluaran: [], kas: [], pengaturan: {}, ringkasan: {}, bahan: [], resep: [], pengguna: [], retur: [], cabang: [], stokCabang: [], stokBatch: [], riwayatPoin: [], tier: [], utang: [], cicilanUtang: [], transaksiCepat: [], transaksiTertunda: [], meja: [], pesananDapur: [], promo: [], katalog: [], daftarTeks: [], grup: [], satuan: [], jenisBayar: [], itemPengeluaran: [], pegawai: [], logs: [], terjemahan: {}, opname: [], laporBos: [] };
var cart = []; var lastStruk = ''; var lastStrukData = null; var lastWaTelp = ''; var resepDraft = []; var beliItems = []; var currentUser = null; var promoTerpakai = []; var promoDiskon = 0; var poinDipakai = 0; var laporBosTeks = ''; var laporBosWa = '';
var rp = function (n) { return 'Rp ' + (Math.round(n || 0)).toLocaleString('id-ID'); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
function todayStr(d) { var x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
function show(id, btn) {
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
}
function kembaliKeKeranjang() { show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]')); langkahKasir(2); }
function toggleDrawer() { var n = document.getElementById('nav'); var b = document.getElementById('drawerBackdrop'); var open = n && !n.classList.contains('open'); if (n) n.classList.toggle('open', open); if (b) b.style.display = open ? 'block' : 'none'; }
function closeDrawer() { var n = document.getElementById('nav'); var b = document.getElementById('drawerBackdrop'); if (n) n.classList.remove('open'); if (b) b.style.display = 'none'; }

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
}
function tutupForm(secId) {
  var sec = document.getElementById(secId); if (!sec) return;
  sec.querySelectorAll('.form-view').forEach(function (el) { el.style.display = 'none'; });
  sec.querySelectorAll('.list-view').forEach(function (el) { el.style.display = ''; });
  window.scrollTo(0, 0);
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
  document.getElementById('konfirmBackdrop').style.display = 'none';
  document.getElementById('konfirmBox').style.display = 'none';
  if (_konfirmJanji) { var s = _konfirmJanji; _konfirmJanji = null; s(!!ya); }
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
  var list = (DATA.produk || []).filter(function (x) { return produkAktif(x) && lacakStok(x) && stokProduk(x) <= Number(x.StokMinimum || 5); });
  p.innerHTML = '<div class="notif-card"><div class="notif-head"><b>🔔 Notifikasi</b><button class="t-x" onclick="toggleNotifPanel()">✕</button></div>' + (list.length ? list.map(function (x) { return '<div class="notif-item"><span class="notif-ic">⚠️</span><div><b>' + esc(x.Nama) + '</b><span>Stok menipis — sisa ' + stokProduk(x) + ' ' + esc(x.Satuan || 'pcs') + ' (min. ' + (x.StokMinimum || 5) + ')</span></div></div>'; }).join('') : '<div class="notif-kosong">Semua stok aman. Tidak ada notifikasi.</div>') + '<button class="primary" style="width:100%;margin-top:10px" onclick="toggleNotifPanel();go(\'stok\')">Lihat Stok</button></div>';
}
function go(sec) { show(sec, document.querySelector('nav button.menu[data-sec="' + sec + '"]')); }
function terjemah(kata) { var t = DATA.terjemahan || {}; return t[kata] || kata; }
function cabangAktifId() { var p = DATA.pengaturan || {}; return p.CabangAktif || ((DATA.cabang || [])[0] && DATA.cabang[0].ID) || ''; }
function stokProduk(p) {
  var sc = (DATA.stokCabang || []).filter(function (x) { return String(x.ProdukID) === String(p.ID) && String(x.CabangID) === String(cabangAktifId()); });
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
var lastSyncAt = null;
function fmtK(n) { n = Number(n || 0); if (n >= 1000000) return (Math.round(n / 100000) / 10) + ' jt'; if (n >= 1000) return Math.round(n / 1000) + ' rb'; return String(n); }
function iconBayar(nama) {
  var n = String(nama || '').toLowerCase();
  if (n.indexOf('tunai') >= 0 || n.indexOf('cash') >= 0) return '💵';
  if (n.indexOf('qris') >= 0) return '📱';
  if (n.indexOf('gopay') >= 0) return '🟢';
  if (n.indexOf('ovo') >= 0) return '🟣';
  if (n.indexOf('shopee') >= 0 || n.indexOf('dana') >= 0) return '🟠';
  if (n.indexOf('transfer') >= 0 || n.indexOf('bank') >= 0) return '🏦';
  if (n.indexOf('debit') >= 0 || n.indexOf('kartu') >= 0 || n.indexOf('visa') >= 0 || n.indexOf('master') >= 0) return '💳';
  if (n.indexOf('e-money') >= 0 || n.indexOf('emoney') >= 0 || n.indexOf('flazz') >= 0) return '💳';
  return '💳';
}

function setModeLabel() {
  var contoh = DB.isSample;
  document.getElementById('modeLabel').textContent = contoh ? 'Mode Contoh (data demo)' : '';
  var mb = document.getElementById('modeBadge');
  mb.textContent = contoh ? 'Mode Contoh' : '';
  mb.style.display = contoh ? '' : 'none';
  var ds = document.getElementById('drawerSync');
  if (ds) { ds.innerHTML = contoh ? '<b>Mode Contoh</b> — isi config.js untuk terhubung' : 'Terhubung' + (lastSyncAt ? ' • Terakhir: ' + lastSyncAt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''); }
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
  var ikon = jenis === 'error' ? '⚠' : (jenis === 'sukses' ? '✓' : 'ℹ');
  t.innerHTML = '<span class="t-ic">' + ikon + '</span><div class="t-body"><b>' + esc(judul) + '</b><span>' + esc(pesan) + '</span></div><button class="t-x" aria-label="Tutup" onclick="this.parentElement.remove()">✕</button>';
  wrap.appendChild(t);
  setTimeout(function () { if (t.isConnected) { t.classList.add('keluar'); setTimeout(function () { t.remove(); }, 300); } }, jenis === 'error' ? 8000 : 4500);
}
function tampilError(msg) { tampilNotif('error', 'Terjadi galat', msg); }
// Pesan info/sukses di popup notif — terlihat di layar, bukan hanya alert.
function tampilInfo(msg) { tampilNotif('sukses', 'Berhasil', msg); }
function sembunyiError() { var w = document.getElementById('errBar'); if (w) { w.innerHTML = ''; w.style.display = 'none'; } }
async function loadData() {
  try {
    var d = await withTimeout(DB.loadAll(), 20000, 'Server tidak menjawab dalam 20 detik. Periksa koneksi internet, lalu muat ulang halaman.');
    DATA = Object.assign(DATA, d || {});
    var p = DATA.pengaturan || {};
    document.getElementById('namaTokoHead').textContent = p.NamaToko || 'ZPOS';
    var nd = document.getElementById('namaTokoDrawer'); if (nd) nd.textContent = p.NamaToko || 'ZPOS';
    document.getElementById('heroToko').textContent = p.NamaToko || 'ZPOS';
    document.body.classList.toggle('dark', p.ModeGelap === 'YA');
    lastSyncAt = new Date();
    setModeLabel();
    sembunyiError();
    isiPengaturanForm();
    var saved = null; try { saved = JSON.parse(sessionStorage.getItem('pos_user') || 'null'); } catch (e) { }
    if ((DATA.pengguna || []).length && !saved) {
      document.getElementById('loginBox').style.display = 'block';
      document.body.classList.add('belum-login');
      document.querySelectorAll('main section').forEach(function (s) { s.style.display = 'none'; });
      hideLoading();
      return;
    }
    currentUser = saved;
    if (currentUser) document.getElementById('userLabel').textContent = '• ' + currentUser.nama + ' (' + currentUser.peran + ')';
    document.getElementById('loginBox').style.display = 'none';
    document.body.classList.remove('belum-login');
    document.querySelectorAll('main section').forEach(function (s) { s.style.display = ''; });
    renderAll(); applyRole(); hideLoading();
  } catch (e) { hideLoading(); tampilError('Gagal memuat data: ' + e.message); alert('Gagal memuat data: ' + e.message); }
}
async function doLogin() {
  var nama = document.getElementById('loginNama').value, pin = document.getElementById('loginPin').value;
  try {
    var res = await DB.login(nama, pin);
    if (!res.ok) return alert(res.error || 'Login gagal');
    sessionStorage.setItem('pos_user', JSON.stringify(res));
    currentUser = res;
    document.getElementById('userLabel').textContent = '• ' + res.nama + ' (' + res.peran + ')';
    document.getElementById('loginBox').style.display = 'none';
    document.body.classList.remove('belum-login');
    document.querySelectorAll('main section').forEach(function (s) { s.style.display = ''; });
    renderAll(); applyRole(); hideLoading();
  } catch (e) { alert('Login gagal: ' + e.message); }
}
function logout() {
  sessionStorage.removeItem('pos_user'); currentUser = null;
  cart = []; promoDiskon = 0; promoTerpakai = []; poinDipakai = 0; bayarManual = false;
  document.getElementById('userLabel').textContent = '';
  document.getElementById('loginNama').value = ''; document.getElementById('loginPin').value = '';
  var kb = document.getElementById('kasirBayar'); if (kb) kb.value = '';
  if ((DATA.pengguna || []).length) {
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
  terapkanModeMeja();
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
  if (!izinAktif('diskon')) { var d = document.getElementById('kasirDiskon'); if (d) d.disabled = true; }
}
function isiPengaturanForm() {
  var p = DATA.pengaturan || {};
  var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); };
  set('sNama', p.NamaToko); set('sAlamat', p.AlamatToko); set('sTelp', p.TeleponToko); set('sTarget', p.TargetHarian);
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
  cb.innerHTML = (DATA.cabang || []).map(function (c) { return '<option value="' + esc(c.ID) + '"' + (String(c.ID) === String(p.CabangAktif) ? ' selected' : '') + '>' + esc(c.Nama) + '</option>'; }).join('');
  pratinjauProfil();
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
var MENU_UTAMA = [
  ['kasir', '🛒', 'Transaksi'], ['produk', '📦', 'Produk'], ['pembelian', '🛍️', 'Pembelian'],
  ['pengeluaran', '💸', 'Pengeluaran'], ['pelanggan', '👥', 'Pelanggan'], ['laporan', '📈', 'Laporan'],
  ['aruskas', '💰', 'Arus Kas'], ['master', '🗂️', 'Lainnya']
];
var SHORTCUTS = [
  ['kasir', '🛒 Transaksi Baru', 'primary'], ['cepat', '⚡ Transaksi Cepat'], ['laporan', '📈 Laporan'],
  ['pembelian', '🛍️ Pembelian'], ['produk', '📦 Produk'], ['stok', '📊 Stok'],
  ['pelanggan', '👥 Pelanggan'], ['master', '🗂️ Master'], ['aruskas', '💰 Arus Kas'],
  ['pengeluaran', '💸 Pengeluaran'], ['utang', '🤝 Utang'], ['katalog', '📖 Katalog'], ['pengaturan', '⚙️ Pengaturan']
];
function renderAll() {
  var r = DATA.ringkasan || {};
  document.getElementById('heroOmzet').textContent = rp(r.omzetHariIni);
  var kem = Number(r.omzetKemarin || 0), kini = Number(r.omzetHariIni || 0);
  var pct = kem > 0 ? Math.round((kini - kem) / kem * 100) : (kini > 0 ? 100 : 0);
  var vsEl = document.getElementById('heroOmzetVs');
  vsEl.textContent = (pct >= 0 ? '+' : '') + pct + '% vs kemarin';
  vsEl.classList.toggle('down', pct < 0);
  document.getElementById('heroUser').textContent = currentUser ? ('Halo, ' + currentUser.nama + ' (' + currentUser.peran + ') — kasir siap melayani hari ini.') : 'Kasir siap melayani hari ini.';
  var dr = document.getElementById('drawerStoreRole'); if (dr) dr.textContent = currentUser ? (currentUser.nama + ' • ' + currentUser.peran) : 'Kasir • v4.0';
  var bb = document.getElementById('bellBadge');
  if (bb) { var sm = Number(r.stokMenipis || 0); bb.style.display = sm > 0 ? 'flex' : 'none'; bb.textContent = sm > 99 ? '99+' : String(sm); }
  isiNotifPanel();
  document.getElementById('statTiles').innerHTML = [
    ['🛒', 'Transaksi', r.jumlahTrxHariIni || 0], ['📦', 'Produk', (DATA.produk || []).filter(produkAktif).length],
    ['⚠️', 'Stok Menipis', r.stokMenipis || 0], ['👥', 'Pelanggan', (DATA.pelanggan || []).length]
  ].map(function (x) { return '<div class="tile"><span class="tile-ic">' + x[0] + '</span><span>' + x[1] + '</span><b>' + x[2] + '</b></div>'; }).join('');
  document.getElementById('menuUtama').innerHTML = MENU_UTAMA.map(function (m) {
    return '<div class="menu-item" onclick="go(\'' + m[0] + '\')"><span class="ic">' + m[1] + '</span>' + m[2] + '</div>';
  }).join('');
  document.getElementById('shortcutRow').innerHTML = SHORTCUTS.map(function (s) {
    return '<button class="' + (s[2] || 'secondary') + '" onclick="go(\'' + s[0] + '\')">' + s[1] + '</button>';
  }).join('');
  document.getElementById('stats').innerHTML = [
    ['Omzet Hari Ini', rp(r.omzetHariIni)], ['Laba Hari Ini', rp(r.labaHariIni)],
    ['Dibayar Hari Ini', rp(r.dibayarHariIni)], ['Transaksi Hari Ini', r.jumlahTrxHariIni || 0],
    ['Piutang (Belum Lunas)', rp(r.piutang)], ['Hutang ke Pemasok', rp(r.hutang)],
    ['Saldo Kas', rp(r.saldoKas)], ['Stok Menipis', r.stokMenipis || 0]
  ].map(function (x) { return '<div class="card stat"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
  document.getElementById('terlaris').innerHTML = (r.terlaris || []).map(function (x) { return esc(x.nama) + ' — ' + x.qty + ' terjual'; }).join('<br>') || 'Belum ada penjualan.';
  document.getElementById('pelangganTop').innerHTML = (r.pelangganTop || []).map(function (x) { return esc(x.nama) + ' — ' + rp(x.total); }).join('<br>') || 'Belum ada data.';
  document.getElementById('stokTipis').innerHTML = ((r.stokTipisList || []).map(function (p) { return esc(p.nama) + ' — sisa ' + p.stok + ' ' + (p.satuan || ''); }).join('<br>')) || 'Semua stok aman.';
  document.getElementById('kedaluwarsaBox').innerHTML = ((r.kedaluwarsaList || []).map(function (b) { return esc(b.nama || b.NamaProduk || '') + ' — kedaluwarsa ' + (b.Kedaluwarsa || ''); }).join('<br>')) || 'Tidak ada batch mendekati kedaluwarsa.';
  var target = Number(r.targetHarian || 0);
  document.getElementById('targetBox').innerHTML = target > 0 ? 'Target: ' + rp(target) + ' • Tercapai hari ini: ' + rp(r.omzetHariIni) + ' (' + Math.round((r.omzetHariIni || 0) / target * 100) + '%)<div style="background:#e2e8f0;height:12px;border-radius:999px;overflow:hidden;margin-top:8px"><div style="background:#0f766e;height:12px;width:' + Math.min(100, (r.omzetHariIni || 0) / target * 100) + '%"></div></div>' : 'Belum ada target harian. Atur di Pengaturan > Target Omzet Harian.';
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
  document.getElementById('perCabangBox').innerHTML = '<table><tr><th>Cabang</th><th>Omzet Hari Ini</th><th>Laba</th><th>Transaksi</th><th>Stok Menipis</th></tr>' + (r.perCabang || []).map(function (c) { return '<tr><td>' + esc(c.nama) + '</td><td>' + rp(c.omzetHariIni) + '</td><td>' + rp(c.labaHariIni) + '</td><td>' + (c.jumlahTrx || 0) + '</td><td>' + (c.stokMenipis || 0) + '</td></tr>'; }).join('') + '</table>';
  renderProdukKasir(); renderCart(); renderProdukTable(); renderTrx(); renderPelanggan(); renderPembelian(); renderKeuangan(); renderLaporan(); renderBahan(); renderPengguna(); renderRetur(); renderCepat(); renderUtang(); renderMeja(); renderKatalog(); renderPromo(); renderMaster(); renderDapur(); renderWinback(); renderUlangTahun(); renderStok(); renderLaporanPremium();
  isiSelectKasir(); isiSelectLain();
}
function gantiCabangDashboard() { renderAll(); }
function isiSelectKasir() {
  var sel = document.getElementById('kasirPelanggan');
  sel.innerHTML = '<option>Umum</option>' + (DATA.pelanggan || []).filter(function (p) { return p.Nama !== 'Umum'; }).map(function (p) { return '<option value="' + esc(p.Nama) + '">' + esc(p.Nama) + ' (Poin ' + (p.Poin || 0) + ' • ' + (p.Tier || '—') + ')</option>'; }).join('');
  var mj = document.getElementById('kasirMeja');
  mj.innerHTML = '<option value="">— Tanpa meja —</option>' + (DATA.meja || []).filter(function (m) { return m.Status !== 'Terisi'; }).map(function (m) { return '<option>' + esc(m.Nama) + '</option>'; }).join('');
  var mt = document.getElementById('kasirMetode');
  var jb = (DATA.jenisBayar || []).filter(function (j) { return produkAktif(j); });
  mt.innerHTML = (jb.length ? jb : [{ Nama: 'Tunai' }]).map(function (j) { return '<option>' + esc(j.Nama) + '</option>'; }).join('');
  pelangganDipilih();
}
function isiSelectLain() {
  var opt = function (arr, fn) { return (arr || []).map(fn).join(''); };
  document.getElementById('resepProduk').innerHTML = opt(DATA.produk, function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + '</option>'; });
  document.getElementById('resepBahan').innerHTML = opt(DATA.bahan, function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + ' (' + (p.Satuan || '') + ')</option>'; });
  document.getElementById('returTrx').innerHTML = opt(DATA.transaksi.slice(0, 100), function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.ID) + ' — ' + esc(p.Pelanggan) + ' — ' + rp(p.Total) + '</option>'; });
  document.getElementById('pgKategori').innerHTML = opt(DATA.itemPengeluaran.length ? DATA.itemPengeluaran : [{ Nama: 'Lainnya' }], function (p) { return '<option>' + esc(p.Nama) + '</option>'; });
  document.getElementById('opProduk').innerHTML = opt(DATA.produk, function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + ' — stok sistem ' + stokProduk(p) + '</option>'; });
  document.getElementById('cicilUtangId').innerHTML = opt(DATA.utang.filter(function (u) { return u.Status !== 'Lunas'; }), function (u) { return '<option value="' + esc(u.ID) + '">' + esc(u.ID) + ' — ' + esc(u.Pemasok) + ' — sisa ' + rp(u.Sisa) + '</option>'; });
  document.getElementById('poinPelanggan').innerHTML = opt(DATA.pelanggan, function (p) { return '<option value="' + esc(p.ID) + '">' + esc(p.Nama) + ' (Poin ' + (p.Poin || 0) + ')</option>'; });
  document.getElementById('tagihanPelanggan').innerHTML = opt(DATA.pelanggan, function (p) { return '<option>' + esc(p.Nama) + '</option>'; });
  document.getElementById('lapCabang').innerHTML = '<option value="">Semua cabang</option>' + opt(DATA.cabang, function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; });
  document.getElementById('lbCabang').innerHTML = '<option value="">Semua cabang</option>' + opt(DATA.cabang, function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; });
  document.getElementById('uCabang').innerHTML = '<option value="">— Semua cabang —</option>' + opt(DATA.cabang, function (c) { return '<option value="' + esc(c.ID) + '">' + esc(c.Nama) + '</option>'; });
  document.getElementById('cabangTable').innerHTML = '<table><tr><th>Nama</th><th>Alamat</th><th></th></tr>' + opt(DATA.cabang, function (c) { return '<tr><td>' + esc(c.Nama) + '</td><td>' + esc(c.Alamat || '') + '</td><td><button class="secondary" onclick="setCabangAktif(\'' + esc(c.ID) + '\')">Jadikan Aktif</button> <button class="danger" onclick="hapusCabang(\'' + esc(c.ID) + '\', this)">Hapus</button></td></tr>'; }) + '</table>';
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
  document.getElementById('labelList').innerHTML = (DATA.produk || []).map(function (p) { return '<label class="checkrow"><input type="checkbox" class="labelChk" value="' + esc(p.ID) + '"> ' + esc(p.Nama) + ' (' + esc(p.SKU || p['SKU/Barcode'] || p.ID) + ')</label>'; }).join('');
}
function setModeKasir(mode) {
  document.getElementById('pillReguler').classList.toggle('active', mode === 'reguler');
  document.getElementById('pillCepat').classList.toggle('active', mode === 'cepat');
  document.getElementById('kasirReguler').style.display = mode === 'reguler' ? '' : 'none';
  document.getElementById('kasirCepat').style.display = mode === 'cepat' ? '' : 'none';
  if (mode === 'cepat') renderCepatKasir();
}
function renderCepatKasir() {
  document.getElementById('cepatListKasir').innerHTML = (DATA.transaksiCepat || []).map(function (c) {
    var items = []; try { items = JSON.parse(c.ItemsJSON || '[]'); } catch (e) { }
    return '<div class="cart-item"><span><b>' + esc(c.Nama) + '</b> — ' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '</span><span><button class="primary" onclick="muatCepat(\'' + esc(c.ID) + '\')">Muat ke Kasir</button></span></div>';
  }).join('') || 'Belum ada template Transaksi Cepat.';
}

/* ---------- KASIR ---------- */
function emojiProduk(nama) {
  var n = (nama || '').toLowerCase();
  if (n.indexOf('kopi') >= 0) return '☕';
  if (n.indexOf('teh') >= 0) return '🍵';
  if (n.indexOf('buku') >= 0) return '📖';
  if (n.indexOf('pensil') >= 0 || n.indexOf('pulpen') >= 0) return '✏️';
  if (n.indexOf('baju') >= 0) return '👕';
  if (n.indexOf('sabun') >= 0 || n.indexOf('deterjen') >= 0) return '🧼';
  if (n.indexOf('makan') >= 0 || n.indexOf('bakwan') >= 0 || n.indexOf('nasi') >= 0) return '🍽️';
  if (n.indexOf('minum') >= 0 || n.indexOf('jus') >= 0) return '🥤';
  if (n.indexOf('ongkir') >= 0) return '🚚';
  return '📦';
}
function renderProdukKasir() {
  var q = (document.getElementById('cariProduk').value || '').toLowerCase();
  document.getElementById('produkKasir').innerHTML = (DATA.produk || []).filter(function (p) { return produkAktif(p) && (!q || p.Nama.toLowerCase().indexOf(q) >= 0 || String(p.SKU || p['SKU/Barcode'] || '').toLowerCase().indexOf(q) >= 0); })
    .map(function (p) {
      var diKeranjang = 0; cart.forEach(function (x) { if (x.id === p.ID) diKeranjang += x.Qty; });
      var stok = stokProduk(p);
      var habis = lacakStok(p) && stok <= 0 && diKeranjang === 0;
      var kanan = habis
        ? '<span style="color:#94a3b8;font-size:13px;font-weight:600">Habis</span>'
        : diKeranjang > 0
        ? '<span class="qty-ctl"><button onclick="event.stopPropagation();ubahQtyKasir(\'' + esc(p.ID) + '\',-1)">−</button><b class="qty-badge">' + diKeranjang + '</b><button onclick="event.stopPropagation();ubahQtyKasir(\'' + esc(p.ID) + '\',1)">+</button></span>'
        : '<button class="qty-add" onclick="event.stopPropagation();addToCart(\'' + esc(p.ID) + '\')">+</button>';
      return '<div class="prod-row"' + (habis ? '' : ' onclick="addToCart(\'' + esc(p.ID) + '\')"') + '><span style="display:flex;gap:10px;align-items:center"><span class="prod-thumb">' + emojiProduk(p.Nama) + '</span><span><b>' + esc(p.Nama) + '</b><br><small class="price">' + rp(p.HargaJual) + '</small><br><small class="' + (stok <= 0 ? 'red' : '') + '">Stok: ' + stok + '</small></span></span>' + kanan + '</div>';
    }).join('') || 'Produk tidak ditemukan.';
}
function ubahQtyKasir(id, delta) {
  var it = cart.find(function (x) { return x.id === id && !x.satuanDipakai; });
  if (!it && delta > 0) { addToCart(id); return; }
  if (!it) return;
  if (delta > 0) {
    var p = DATA.produk.find(function (x) { return x.ID === id; });
    var termasukStok = p ? lacakStok(p) : false;
    if (p && termasukStok && stokProduk(p) - it.Qty <= 0) { return alert('Stok produk tidak mencukupi: ' + p.Nama); }
  }
  it.Qty += delta;
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
  if (termasukStok && stokProduk(p) - diKeranjang <= 0) { return alert('Stok produk tidak mencukupi: ' + p.Nama); }
  var it = cart.find(function (x) { return x.id === id && !x.satuanDipakai; });
  if (it && !satuanDipakai) { it.Qty++; }
  else {
    var harga = hargaOverride != null ? hargaOverride : Number(p.HargaJual);
    cart.push({ id: p.ID, nama: p.Nama, Harga: harga, modal: Number(p.HargaModal || 0), Qty: 1, diskonItem: 0, satuanDipakai: satuanDipakai || '', hargaLainLabel: '' });
  }
  var last = cart[cart.length - 1];
  if (last && last.id === id) { last.Harga = hargaJumlahOtomatis(p, last.Qty); }
  renderCart();
}
function pilihHargaLain(idx) {
  var it = cart[idx]; var p = DATA.produk.find(function (x) { return x.ID === it.id; }); if (!p) return;
  var hl = []; try { hl = JSON.parse(p.HargaLainJSON || '[]'); } catch (e) { hl = []; }
  if (!hl.length) return alert('Produk ini tidak punya Harga Lain.');
  var pilihan = hl.map(function (h, i) { return (i + 1) + '. ' + h.label + ' — ' + rp(h.harga); }).join('\n');
  var n = prompt('Pilih Harga Lain:\n' + pilihan + '\n\nKetik nomornya:', '1'); if (!n) return;
  var h = hl[Number(n) - 1]; if (!h) return;
  it.Harga = Number(h.harga); it.hargaLainLabel = h.label; renderCart();
}
function pilihVarian(idx) {
  var it = cart[idx]; var p = DATA.produk.find(function (x) { return x.ID === it.id; }); if (!p) return;
  var vr = []; try { vr = JSON.parse(p.VarianJSON || '[]'); } catch (e) { vr = []; }
  if (!vr.length) return alert('Produk ini tidak punya Satuan Varian.');
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
  var dIn = Number(document.getElementById('kasirDiskon').value || 0);
  var diskonTotal = jenis === 'persen' ? Math.round(setelahItem * dIn / 100) : dIn;
  diskonTotal = Math.min(diskonTotal, setelahItem);
  var ongkir = Number(document.getElementById('kasirOngkir').value || 0);
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
function renderCart() {
  var h = hitungCart();
  document.getElementById('cart').innerHTML = cart.map(function (it, i) {
    var subIt = it.Harga * it.Qty - (it.diskonItem || 0) * it.Qty;
    return '<div class="cart-item"><span><b>' + esc(it.nama) + '</b><br><small>' + rp(it.Harga) + (it.satuanDipakai ? ' / ' + esc(it.satuanDipakai) : '') + (it.hargaLainLabel ? ' [' + esc(it.hargaLainLabel) + ']' : '') + ' • Diskon item: ' + rp(it.diskonItem || 0) + '</small><br>'
      + '<button class="secondary" onclick="hapusCartItem(' + i + ')" style="color:#dc2626">✕ Hapus</button> <button class="secondary" onclick="ubahDiskonItem(' + i + ')">% Diskon</button> <button class="secondary" onclick="pilihHargaLain(' + i + ')">Harga Lain</button> <button class="secondary" onclick="pilihVarian(' + i + ')">Varian</button></span>'
      + '<span style="text-align:right"><span class="qty-ctl"><button onclick="cart[' + i + '].Qty--;if(cart[' + i + '].Qty<=0)cart.splice(' + i + ',1);renderCart()">−</button><b class="qty-badge">' + it.Qty + '</b><button onclick="cart[' + i + '].Qty++;renderCart()">+</button></span><br><b class="trx-biru">' + rp(subIt) + '</b></span></div>';
  }).join('') || 'Keranjang kosong.';
  renderTotalKasir();
  if (promoTimer) clearTimeout(promoTimer);
  promoTimer = setTimeout(cekPromo, 400);
  var bar = document.getElementById('cartBar');
  if (bar) {
    document.getElementById('cartBarCount').textContent = cart.reduce(function (a, x) { return a + x.Qty; }, 0);
    document.getElementById('cartBarTotal').textContent = cart.reduce(function (a, x) { return a + x.Qty; }, 0) + ' item | ' + rp(h.total);
    bar.style.display = (langkahKasirAktif === 1 && cart.length) ? 'flex' : 'none';
  }
  renderProdukKasir();
  if (document.getElementById('bayar').classList.contains('active')) renderBayar();
}
function kosongkanCart() { cart = []; promoDiskon = 0; promoTerpakai = []; poinDipakai = 0; bayarManual = false; document.getElementById('kasirBayar').value = ''; document.getElementById('promoBox').textContent = ''; renderCart(); }
function scanBarcode() {
  var code = (document.getElementById('scanBarcode').value || '').trim();
  var p = (DATA.produk || []).find(function (x) { return String(x.SKU || x['SKU/Barcode'] || '').trim() === code; });
  if (!p) return alert('Barcode / SKU tidak ditemukan: ' + code);
  addToCart(p.ID); document.getElementById('scanBarcode').value = '';
}
async function cekPromo() {
  if (!cart.length || (DATA.pengaturan || {}).PromoAktif === 'TIDAK') { promoDiskon = 0; promoTerpakai = []; document.getElementById('promoBox').textContent = ''; return; }
  try {
    var h = hitungCart();
    var res = await DB.hitungPromo({ items: cart, pelanggan: document.getElementById('kasirPelanggan').value, total: h.setelahItem, cabangId: cabangAktifId() });
    promoDiskon = Number(res.diskon || 0); promoTerpakai = res.promoTerpakai || [];
    document.getElementById('promoBox').textContent = promoTerpakai.length ? ('Promo otomatis: ' + promoTerpakai.map(function (x) { return x.nama || x; }).join(', ') + ' — hemat ' + rp(promoDiskon)) : 'Tidak ada promo yang memenuhi syarat.';
    renderTotalKasir();
  } catch (e) { /* promo gagal dihitung: transaksi tetap jalan tanpa promo */ }
}
function tukarPoin() {
  if ((DATA.pengaturan || {}).PoinAktif === 'TIDAK') return alert('Fitur poin sedang dimatikan di Pengaturan.');
  var nama = document.getElementById('kasirPelanggan').value;
  var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === nama; });
  if (!pl) return alert('Pilih pelanggan terdaftar dulu (bukan Umum).');
  if ((pl.Poin || 0) < 100) return alert('Poin pelanggan kurang dari 100 (saldo: ' + (pl.Poin || 0) + ').');
  var maks = Math.floor((pl.Poin || 0) / 100) * 100;
  var v = prompt('Tukar berapa poin? (kelipatan 100, maks ' + maks + ', 100 poin = Rp1.000)', String(Math.min(100, maks)));
  if (!v) return;
  var n = Math.floor(Number(v) / 100) * 100;
  if (n < 100 || n > maks) return alert('Jumlah tidak valid.');
  poinDipakai = n; renderCart(); alert('Poin ditukar: ' + n + ' poin = ' + rp(n / 100 * 1000) + ' diskon.');
}
/* ---------- PEMBAYARAN ---------- */
function goCheckout() {
  if (!cart.length) return alert('Keranjang masih kosong.');
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
    return '<div class="payopt' + (sel ? ' sel' : '') + '" onclick="pilihMetodeBayar(\'' + esc(j.Nama) + '\')"><span class="payopt-ic">' + iconBayar(j.Nama) + '</span>' + (sel ? '✓ ' : '') + esc(j.Nama) + '</div>';
  }).join('');
  var bt = document.getElementById('bayarTunai');
  if (!bayarManual) bt.value = h.total;
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
  var tunai = Number(document.getElementById('bayarTunai').value || 0);
  var el = document.getElementById('bayarKembalianVal');
  if (el) el.textContent = rp(Math.max(0, tunai - h.total));
  else document.getElementById('bayarKembalian').textContent = 'Kembalian: ' + rp(Math.max(0, tunai - h.total));
}
async function simpanTransaksi() {
  if (!cart.length) return alert('Keranjang masih kosong.');
  var h = hitungCart();
  var namaPelanggan = document.getElementById('kasirPelanggan').value;
  var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === namaPelanggan; });
  var payload = { pelanggan: namaPelanggan, kasir: currentUser ? currentUser.nama : 'Kasir', cabangId: cabangAktifId(), meja: document.getElementById('kasirMeja').value || '', items: cart, diskon: h.diskonTotal, diskonPersen: document.getElementById('kasirDiskonJenis').value === 'persen' ? Number(document.getElementById('kasirDiskon').value || 0) : 0, ongkir: h.ongkir, bayar: Number(document.getElementById('kasirBayar').value || 0), metode: document.getElementById('kasirMetode').value, statusPesanan: document.getElementById('kasirStatus').value, catatan: '', catatanStruk: document.getElementById('kasirCatatanStruk').value, catatanInternal: document.getElementById('kasirCatatanInternal').value, poinDipakai: poinDipakai, promoId: promoTerpakai.length ? (promoTerpakai[0].id || promoTerpakai[0].ID || '') : '', kodeAlternatif: '' };
  try {
    sembunyiError();
    var res = await withTimeout(DB.saveTransaksi(payload), 15000, 'Server tidak menjawab saat menyimpan (15 detik). Periksa koneksi internet, lalu coba lagi.');
    lastStruk = buatStruk(res, payload, h, pl);
    var el = document.getElementById('struk'); el.style.display = 'block'; el.innerHTML = strukKeHtml(lastStruk);
    document.getElementById('strukPrint').innerHTML = strukKeHtml(lastStruk);
    lastWaTelp = pl && pl.Telepon ? String(pl.Telepon).replace(/\D/g, '') : '';
    cart = []; promoDiskon = 0; promoTerpakai = []; poinDipakai = 0; bayarManual = false; document.getElementById('kasirBayar').value = '';
    await loadData();
    show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]'));
    langkahKasir(2);
    alert('Transaksi tersimpan. ID: ' + (res.id || '') + (res.rugi ? ' — RUGI (total di bawah HPP)' : ''));
  } catch (e) { var m = 'Gagal menyimpan: ' + (e && e.message ? e.message : e); tampilError(m); alert(m); }
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
    toko: p.NamaToko || 'ZPOS', slogan: p.SloganToko || '', alamat: p.AlamatToko || '', kota: p.KotaToko || '', telepon: p.TeleponToko || '', footer: p.FooterStruk || 'Terima kasih',
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
  lastStrukData = {
    id: res.id || '', kode: res.kodeAlternatif || '', nomor: (DATA.transaksi || []).length + 1,
    toko: p.NamaToko || 'ZPOS', slogan: p.SloganToko || '', alamat: p.AlamatToko || '', kota: p.KotaToko || '', telepon: p.TeleponToko || '', footer: p.FooterStruk || 'Terima kasih',
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
  if (!lastStruk) return alert('Belum ada struk. Simpan transaksi dulu.');
  var url = lastWaTelp ? ('https://wa.me/' + lastWaTelp + '?text=' + encodeURIComponent(lastStruk)) : ('https://wa.me/?text=' + encodeURIComponent(lastStruk));
  window.open(url, '_blank');
}
// Struk sebagai GAMBAR (PNG) untuk WhatsApp: wa.me hanya bisa mengirim teks,
// jadi gambar dibagikan lewat menu berbagi bawaan HP (pilih WhatsApp di sana).
// Bila HP/browser tidak mendukung berbagi file, gambar diunduh — lampirkan
// manual di WhatsApp. Jalan terakhir bila unduhan pun gagal: kirim teks.
async function kirimWAGambar() {
  if (!lastStruk) return alert('Belum ada struk. Simpan transaksi dulu.');
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
  var list = (DATA.transaksi || []).filter(function (t) {
    if (q && (String(t.ID).toLowerCase().indexOf(q) < 0 && String(t.Pelanggan || '').toLowerCase().indexOf(q) < 0)) return false;
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
async function lunasi(id) { var n = prompt('Nominal pembayaran (Rp):', ''); if (!n) return; await DB.tambahPembayaran({ id: id, nominal: Number(n) }); await loadData(); }
async function ubahStatus(id, status) { if (!status) return; await DB.ubahStatusPesanan({ id: id, status: status }); await loadData(); }
async function batalkanTransaksi(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (t && Number(t.Bayar) > 0 && Number(t.Sisa) === 0) return alert('Transaksi sudah Lunas — pakai Retur untuk mengembalikan item, bukan Batalkan.');
  var alasan = prompt('Alasan pembatalan:', ''); if (alasan === null) return;
  try { await DB.batalkanTransaksi({ id: id, alasan: alasan }); await loadData(); } catch (e) { alert(e.message); }
}
function strukUlang(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return alert('Transaksi tidak ditemukan.');
  lastStrukData = strukDataDariTrx(t);
  lastStruk = strukTeks(lastStrukData);
  var el = document.getElementById('struk'); el.style.display = 'block'; el.innerHTML = strukKeHtml(lastStruk);
  document.getElementById('strukPrint').innerHTML = strukKeHtml(lastStruk);
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]'));
  langkahKasir(2);
}
/* ---------- DETAIL TRANSAKSI ala Griyo (ketuk baris di Daftar) ---------- */
var detailTrxId = '', detailTab = 'detail';
function detailTersortir() {
  return (DATA.transaksi || []).slice().sort(function (a, b) { return String(b.Tanggal || '') < String(a.Tanggal || '') ? -1 : 1; });
}
async function bukaDetailTrx(id) {
  detailTrxId = id; detailTab = 'detail';
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
function detailTabKe(tab) { detailTab = tab; renderDetailTrx(); }
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
  var html = '<div class="dhead"><button class="dhead-btn" onclick="show(\'daftar\',document.querySelector(\'nav button.menu[data-sec=daftar]\'))">←</button><b>Transaksi #' + no + '</b><button class="dhead-btn" onclick="show(\'pengaturan\',document.querySelector(\'nav button.menu[data-sec=pengaturan]\'))">⚙</button></div>';
  if (detailTab === 'struk') {
    html += '<div class="struk-preview">' + (lastStruk ? '<div class="struk-box">' + strukKeHtml(lastStruk) + '</div>' : '<p style="color:#94a3b8;text-align:center">Struk tidak tersedia.</p>') + '</div>'
      + '<div class="detail-tabs"><button class="detail-tab" onclick="show(\'pengaturan\',document.querySelector(\'nav button.menu[data-sec=pengaturan]\'))"><span>⚙</span>Pengaturan</button><button class="detail-tab" onclick="window.print()"><span>🖨</span>Cetak</button><button class="detail-tab" onclick="kirimWAGambar()"><span>💬</span>WhatsApp</button></div>';
  } else if (detailTab === 'bayar') {
    html += '<div class="card" style="margin:12px"><h4 style="margin:0 0 8px">💵 Detil Pembayaran</h4>'
      + '<div class="drow"><span class="k">' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(d) + '</span><span>Total ' + rp(t.Total) + '</span></div>'
      + '<div class="drow"><span class="k">' + esc(t.Metode || 'Tunai') + '</span><b>' + rp(t.Bayar) + '</b></div>'
      + (Number(t.Sisa) > 0 ? '<div class="drow"><span class="k">Sisa</span><b>' + rp(t.Sisa) + '</b></div>' : '<div class="drow"><span class="k">Kembali</span><span>' + rp(kembali) + '</span></div>')
      + '<div class="drow"><span class="k">Status</span><span class="' + (t.StatusBayar === 'Lunas' ? 'trx-lunas' : 'trx-hutang') + '">' + esc(t.StatusBayar) + '</span></div>'
      + (Number(t.Sisa) > 0 ? '<div style="margin-top:12px"><button class="primary" onclick="lunasiDetail(\'' + esc(t.ID) + '\')">+ Bayar Sisa ' + rp(t.Sisa) + '</button></div>' : '')
      + '</div>'
      + '<div class="detail-tabs"><button class="detail-tab" onclick="bukaLebih(\'' + esc(t.ID) + '\')"><span>•••</span>Lebih</button><button class="detail-tab" onclick="detailTabKe(\'struk\')"><span>🧾</span>Struk</button><button class="detail-tab active"><span>💵</span>Pembayaran</button></div>';
  } else {
    var list = detailTersortir();
    var idx = -1; list.forEach(function (x, i) { if (x.ID === t.ID) idx = i; });
    var sblm = idx > 0 ? list[idx - 1].ID : '', ssdh = (idx >= 0 && idx < list.length - 1) ? list[idx + 1].ID : '';
    html += '<div class="dtop"><div><div class="dtop-total">' + rp(t.Total) + '</div><div style="margin-top:6px"><span class="dkode">' + esc(kode) + '</span></div></div>'
      + '<div style="text-align:right"><div>' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(d) + '</div><div style="margin-top:6px;font-size:16px">' + esc(t.Pelanggan || '') + '</div></div></div>'
      + '<div class="ditems">' + (items.length ? items.map(function (x) {
        return '<div class="ditem"><div><b>' + esc(x.NamaProduk) + '</b><div class="ditem-sub">' + x.Qty + ' x ' + rp(x.Harga) + '</div></div><b>' + rp(x.Subtotal) + '</b></div>';
      }).join('') : '<p style="color:#64748b">Tidak ada rincian item.</p>') + '</div>'
      + '<div class="dtotal"><span>Total</span><b>' + rp(t.Total) + '</b></div>'
      + '<div class="dtotal-lunas">' + esc(t.StatusBayar).toUpperCase() + '</div>'
      + '<div class="card" style="margin:12px 0"><h4 style="margin:0 0 8px">💵 Detil Pembayaran</h4>'
      + '<div class="drow"><span class="k">' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + jamMenit(d) + '</span><span>Total ' + rp(t.Total) + '</span></div>'
      + '<div class="drow"><span class="k">' + esc(t.Metode || 'Tunai') + '</span><b>' + rp(t.Bayar) + '</b></div></div>'
      + '<div style="text-align:right;color:#64748b;margin:0 4px">- ' + esc(t.Kasir || '') + '</div>'
      + '<div style="display:flex;justify-content:space-between;margin:14px 4px"><button class="nav-arrow" ' + (sblm ? 'onclick="bukaDetailTrx(\'' + esc(sblm) + '\')"' : 'disabled') + '>‹</button><button class="nav-arrow" ' + (ssdh ? 'onclick="bukaDetailTrx(\'' + esc(ssdh) + '\')"' : 'disabled') + '>›</button></div>'
      + '<div class="detail-tabs"><button class="detail-tab" onclick="bukaLebih(\'' + esc(t.ID) + '\')"><span>•••</span>Lebih</button><button class="detail-tab" onclick="detailTabKe(\'struk\')"><span>🧾</span>Struk</button><button class="detail-tab" onclick="detailTabKe(\'bayar\')"><span>💵</span>Pembayaran</button></div>';
  }
  el.innerHTML = html;
}
async function lunasiDetail(id) { await lunasi(id); renderTrx(); renderDetailTrx(); }
async function ubahStatusDetail(id, status) { if (!status) return; await ubahStatus(id, status); renderTrx(); renderDetailTrx(); }
async function batalkanDetail(id) { await batalkanTransaksi(id); renderTrx(); renderDetailTrx(); }
/* ---------- SHEET "LEBIH" di Detail Transaksi ---------- */
function bukaLebih(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var item = function (ikon, label, fn, merah) {
    return '<button class="lebih-item' + (merah ? ' merah' : '') + '" onclick="' + fn + '(\'' + esc(id) + '\')"><span class="lebih-ikon">' + ikon + '</span>' + label + '</button>';
  };
  document.getElementById('lebihItems').innerHTML =
    item('📅', 'Ganti Tanggal', 'lebihGantiTanggal')
    + item('🔤', 'Ganti Kode Transaksi', 'lebihGantiKode')
    + item('👤', 'Ganti Pelanggan', 'lebihGantiPelanggan')
    + item('🧾', 'Catatan Struk', 'lebihCatatanStruk')
    + item('📝', 'Catatan Internal', 'lebihCatatanInternal')
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
  try { await DB.ubahTransaksi({ id: id, Tanggal: nd.toISOString() }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { alert(e.message); }
}
async function lebihGantiKode(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Kode transaksi baru:', t.KodeAlternatif || '');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, KodeAlternatif: baru.trim() }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { alert(e.message); }
}
async function lebihGantiPelanggan(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Pelanggan baru:', t.Pelanggan || 'Umum');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, Pelanggan: baru.trim() || 'Umum' }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { alert(e.message); }
}
async function lebihCatatanStruk(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Catatan struk (tampil di struk):', t.CatatanStruk || '');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, CatatanStruk: baru }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { alert(e.message); }
}
async function lebihCatatanInternal(id) {
  var t = (DATA.transaksi || []).find(function (x) { return x.ID === id; });
  if (!t) return;
  var baru = prompt('Catatan internal (tidak tampil di struk):', t.CatatanInternal || '');
  if (baru === null) { tutupLebih(); return; }
  try { await DB.ubahTransaksi({ id: id, CatatanInternal: baru }); await loadData(); tutupLebih(); renderDetailTrx(); } catch (e) { alert(e.message); }
}
async function lebihBatalkan(id) { tutupLebih(); await batalkanDetail(id); }
function renderRetur() {
  document.getElementById('returTable').innerHTML = '<table><tr><th>Tanggal</th><th>Transaksi</th><th>Produk</th><th>Qty</th><th>Nominal</th><th>Alasan</th></tr>' + (DATA.retur || []).map(function (r) { return '<tr><td>' + new Date(r.Tanggal).toLocaleString('id-ID') + '</td><td>' + esc(r.TransaksiID) + '</td><td>' + esc(r.Produk) + '</td><td>' + r.Qty + '</td><td>' + rp(r.Nominal) + '</td><td>' + esc(r.Alasan || '') + '</td></tr>'; }).join('') + '</table>';
}
async function simpanRetur() {
  var trxId = document.getElementById('returTrx').value; if (!trxId) return alert('Pilih transaksi dulu.');
  var nama = document.getElementById('returProduk').value;
  var prod = (DATA.produk || []).find(function (x) { return x.Nama === nama; });
  try {
    await DB.simpanRetur({ transaksiId: trxId, produk: nama, produkId: prod ? prod.ID : '', qty: Number(document.getElementById('returQty').value || 1), nominal: Number(document.getElementById('returNominal').value || 0), alasan: document.getElementById('returAlasan').value });
    await loadData(); alert('Retur tersimpan, stok dikembalikan.');
  } catch (e) { alert(e.message); }
}

/* ---------- TRANSAKSI CEPAT & TERTUNDA ---------- */
function renderCepat() {
  document.getElementById('cepatList').innerHTML = (DATA.transaksiCepat || []).map(function (c) {
    var items = []; try { items = JSON.parse(c.ItemsJSON || '[]'); } catch (e) { }
    return '<div class="cart-item"><span><b>' + esc(c.Nama) + '</b> — ' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '</span><span><button class="primary" onclick="muatCepat(\'' + esc(c.ID) + '\')">Muat ke Kasir</button> <button class="danger" onclick="hapusCepat(\'' + esc(c.ID) + '\', this)">Hapus</button></span></div>';
  }).join('') || 'Belum ada template Transaksi Cepat.';
  document.getElementById('tertundaList').innerHTML = (DATA.transaksiTertunda || []).map(function (t) {
    return '<div class="cart-item"><span><b>' + esc(t.ID) + '</b> — ' + esc(t.Pelanggan) + ' — ' + rp(t.Total) + ' • ' + new Date(t.Tanggal).toLocaleString('id-ID') + '</span><span><button class="primary" onclick="lanjutkanTertunda(\'' + esc(t.ID) + '\')">Lanjutkan</button> <button class="danger" onclick="hapusTertunda(\'' + esc(t.ID) + '\', this)">Hapus</button></span></div>';
  }).join('') || 'Tidak ada transaksi tertunda.';
}
async function simpanCepatDariKasir() {
  if (!cart.length) return alert('Keranjang masih kosong.');
  var nama = prompt('Nama template Transaksi Cepat:', 'Transaksi Cepat ' + ((DATA.transaksiCepat || []).length + 1)); if (!nama) return;
  await DB.simpanCepat({ nama: nama, pelanggan: document.getElementById('kasirPelanggan').value, items: cart, cabangId: cabangAktifId() });
  await loadData(); alert('Template tersimpan: ' + nama);
}
function muatCepat(id) {
  var c = (DATA.transaksiCepat || []).find(function (x) { return x.ID === id; }); if (!c) return;
  try {
    var items = JSON.parse(c.ItemsJSON || '[]');
    cart = items.map(function (i) { return { id: i.id || i.ProdukID || '', nama: i.nama || i.Nama || '', Harga: Number(i.Harga || 0), modal: 0, Qty: Number(i.Qty || 1), diskonItem: 0, satuanDipakai: '', hargaLainLabel: '' }; });
  } catch (e) { return alert('Template rusak.'); }
  setModeKasir('reguler');
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]')); renderCart();
}
async function hapusCepat(id, el) { if (!await konfirmasi('Hapus template?', 'Template transaksi cepat ini akan dihapus.')) return; try { await DB.hapusCepat({ id: id }); await loadData(); tampilInfo('Template dihapus.'); } catch (e) { tampilError('Gagal menghapus template: ' + (e.message || e)); } }
async function parkirTransaksi() {
  if (!cart.length) return alert('Keranjang masih kosong.');
  var h = hitungCart();
  await DB.parkirTransaksi({ pelanggan: document.getElementById('kasirPelanggan').value, kasir: currentUser ? currentUser.nama : 'Kasir', items: cart, total: h.total, cabangId: cabangAktifId(), meja: document.getElementById('kasirMeja').value || '', catatan: document.getElementById('kasirCatatanInternal').value || '' });
  cart = []; bayarManual = false; document.getElementById('kasirBayar').value = ''; renderCart(); await loadData(); alert('Transaksi diparkir (Tertunda).');
}
async function lanjutkanTertunda(id) {
  var res = await DB.muatTertunda({ id: id });
  var items = res.items || [];
  cart = items.map(function (i) { return { id: i.id || i.ProdukID || '', nama: i.nama || i.Nama || '', Harga: Number(i.Harga || 0), modal: 0, Qty: Number(i.Qty || 1), diskonItem: 0, satuanDipakai: '', hargaLainLabel: '' }; });
  show('kasir', document.querySelector('nav button.menu[data-sec="kasir"]')); renderCart();
}
async function hapusTertunda(id, el) { if (!await konfirmasi('Hapus transaksi tertunda?', 'Transaksi tertunda ini akan dihapus.')) return; try { await DB.hapusTertunda({ id: id }); await loadData(); tampilInfo('Transaksi tertunda dihapus.'); } catch (e) { tampilError('Gagal menghapus transaksi tertunda: ' + (e.message || e)); } }

/* ---------- PRODUK ---------- */
function renderProdukTable() {
  var hideHPP = sembunyikanHPP();
  var list = (DATA.produk || []).filter(produkAktif);
  var totalStok = list.filter(lacakStok).reduce(function (a, p) { return a + stokProduk(p); }, 0);
  var c1 = document.getElementById('produkCount'); if (c1) c1.textContent = 'Produk: ' + list.length;
  var c2 = document.getElementById('produkStokCount'); if (c2) c2.textContent = 'Stok: ' + totalStok + ' pcs';
  document.getElementById('produkTable').innerHTML = list.length ? '<div class="plist">' + list.map(function (p) {
    var laba = Number(p.HargaJual) - Number(p.HargaModal || 0);
    return '<div class="prow" onclick="editProduk(\'' + esc(p.ID) + '\')"><div class="pinfo"><b>' + esc(p.Nama) + '</b><span>Stok: ' + stokProduk(p) + ' ' + esc(p.Satuan || 'pcs') + (p.SKU || p['SKU/Barcode'] ? ' • ' + esc(p.SKU || p['SKU/Barcode']) : '') + '</span></div><div class="pharga"><b>' + rp(p.HargaJual) + '</b>' + (hideHPP ? '' : '<span>Laba: ' + rp(laba) + '</span>') + '</div></div>';
  }).join('') + '</div>' : '<p style="color:#64748b">Belum ada produk. Ketuk tombol + untuk menambah.</p>';
}
function hitungLabaProduk() {
  var jual = Number(document.getElementById('pJual').value || 0), modal = Number(document.getElementById('pModal').value || 0);
  var el = document.getElementById('pLaba'); if (el) el.textContent = rp(jual - modal);
}
function tampilGambarProduk() {
  var url = document.getElementById('pGambar').value || '';
  var img = document.getElementById('pGambarPreview'); if (img) { img.src = url || ''; img.style.display = url ? 'block' : 'none'; }
  var box = document.getElementById('pGambarBox'); if (box) box.style.display = url ? 'none' : 'flex';
  var h = document.getElementById('pGambarHapusBtn'); if (h) h.style.display = url ? 'block' : 'none';
}
function pilihGambarProduk(input) {
  var f = input.files && input.files[0]; if (!f) return;
  if (!/^image\//.test(f.type || '')) { tampilError('Pilih file gambar (PNG/JPG).'); input.value = ''; return; }
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () { var url = kecilkanLogo(img, 512); if (url.length > 200000) url = kecilkanLogo(img, 256); document.getElementById('pGambar').value = url; tampilGambarProduk(); };
    img.onerror = function () { tampilError('File gambar tidak bisa dibaca.'); };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function hapusGambarProduk() { document.getElementById('pGambar').value = ''; var inp = document.getElementById('pGambarFile'); if (inp) inp.value = ''; tampilGambarProduk(); }
function editProduk(id) {
  var p = DATA.produk.find(function (x) { return x.ID === id; }); if (!p) return;
  document.getElementById('pId').value = p.ID; document.getElementById('pNama').value = p.Nama; document.getElementById('pKategori').value = p.Kategori || ''; document.getElementById('pGrup').value = p.Grup || ''; document.getElementById('pSKU').value = p.SKU || p['SKU/Barcode'] || ''; document.getElementById('pJual').value = p.HargaJual; document.getElementById('pModal').value = p.HargaModal; document.getElementById('pStok').value = p.Stok; document.getElementById('pStokMin').value = p.StokMinimum || 5; document.getElementById('pSatuan').value = p.Satuan || 'pcs';
  document.getElementById('pGambar').value = p.GambarURL || ''; document.getElementById('pKet').value = p.Keterangan || '';
  document.getElementById('pHargaGanti').checked = flagYa(p.HargaBisaDiganti);
  document.getElementById('pTidakStok').checked = !flagYa(p.TermasukStok);
  document.getElementById('pTampilKatalog').checked = flagYa(p.TampilkanDiKatalog);
  renderEditorHarga('pHargaLain', p.HargaLainJSON || ''); renderEditorHarga('pHargaJumlah', p.HargaJumlahJSON || ''); renderEditorHarga('pVarian', p.VarianJSON || '');
  tampilGambarProduk(); hitungLabaProduk();
  document.getElementById('produkFormJudul').textContent = 'Edit Produk';
  document.getElementById('produkHapusBtn').style.display = 'block';
  show('produk', document.querySelector('nav button.menu[data-sec="produk"]')); bukaForm('produk');
}
function resetProduk() { ['pId', 'pNama', 'pKategori', 'pGrup', 'pSKU', 'pJual', 'pModal', 'pStok', 'pGambar', 'pKet'].forEach(function (i) { document.getElementById(i).value = ''; }); document.getElementById('pSatuan').value = 'pcs'; document.getElementById('pStokMin').value = '5'; document.getElementById('pHargaGanti').checked = true; document.getElementById('pTidakStok').checked = false; document.getElementById('pTampilKatalog').checked = true; renderEditorHarga('pHargaLain', '[]'); renderEditorHarga('pHargaJumlah', '[]'); renderEditorHarga('pVarian', '[]'); tampilGambarProduk(); hitungLabaProduk(); var j = document.getElementById('produkFormJudul'); if (j) j.textContent = 'Tambah Produk'; var h = document.getElementById('produkHapusBtn'); if (h) h.style.display = 'none'; tutupForm('produk'); }
/* Editor baris Harga Lain / Harga Jumlah / Varian — ganti ketik JSON mentah.
   Disimpan tetap sebagai JSON string seperti dulu, jadi kasir & database tidak berubah. */
var LABEL_TAMBAH = { pHargaLain: '+ Tambah Harga Lain', pHargaJumlah: '+ Tambah Tingkat Harga', pVarian: '+ Tambah Varian' };
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
      var v = r[k] == null ? '' : r[k];
      var tipe = (k === 'label') ? 'text' : 'number';
      var ph = k === 'label' ? 'Nama' : (k === 'harga' ? 'Harga (Rp)' : (k === 'minQty' ? 'Min. qty' : 'Isi'));
      return '<input type="' + tipe + '" data-k="' + k + '" value="' + esc(String(v)) + '" placeholder="' + ph + '">';
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
      o[k] = (k === 'label') ? v : (v === '' ? 0 : Number(v));
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
async function simpanProduk() {
  var payload = { ID: document.getElementById('pId').value || '', Nama: document.getElementById('pNama').value, Kategori: document.getElementById('pKategori').value, Grup: document.getElementById('pGrup').value, SKU: document.getElementById('pSKU').value, HargaJual: document.getElementById('pJual').value, HargaModal: document.getElementById('pModal').value, Stok: document.getElementById('pStok').value, StokMinimum: document.getElementById('pStokMin').value, Satuan: document.getElementById('pSatuan').value, GambarURL: document.getElementById('pGambar').value, Keterangan: document.getElementById('pKet').value, HargaBisaDiganti: document.getElementById('pHargaGanti').checked, TermasukStok: !document.getElementById('pTidakStok').checked, TampilkanDiKatalog: document.getElementById('pTampilKatalog').checked, HargaLainJSON: kumpulEditorHarga('pHargaLain'), HargaJumlahJSON: kumpulEditorHarga('pHargaJumlah'), VarianJSON: kumpulEditorHarga('pVarian'), CabangID: cabangAktifId() };
  if (!payload.Nama || !payload.HargaJual) return alert('Nama dan harga jual wajib diisi.');
  try { JSON.parse(payload.HargaLainJSON || '[]'); JSON.parse(payload.HargaJumlahJSON || '[]'); JSON.parse(payload.VarianJSON || '[]'); } catch (e) { return alert('JSON Harga Lain / Harga Jumlah / Varian tidak valid.'); }
  try { await DB.upsertProduk(payload); } catch (e) { tampilError('Gagal menyimpan produk: ' + (e.message || e)); return; }
  await loadData(); resetProduk(); tampilInfo('Produk tersimpan.');
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
  try { var res = await DB.exportProdukCSV(); unduhFile('produk.csv', res.csv || '', 'text/csv'); } catch (e) { alert(e.message); }
}
function unduhFile(nama, isi, tipe) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], { type: tipe })); a.download = nama; a.click();
}

/* ---------- STOK ---------- */
function renderStok() {
  document.getElementById('stokTable').innerHTML = '<table><tr><th>Produk</th><th>Harga Jual</th><th>Stok (cabang aktif)</th><th>Stok Min.</th></tr>' + (DATA.produk || []).map(function (p) { var s = stokProduk(p); return '<tr><td>' + esc(p.Nama) + '</td><td>' + rp(p.HargaJual) + '</td><td>' + (s <= Number(p.StokMinimum || 5) ? '<span class="badge warn">' : '') + s + (s <= Number(p.StokMinimum || 5) ? '</span>' : '') + '</td><td>' + (p.StokMinimum || 5) + '</td></tr>'; }).join('') + '</table>';
  document.getElementById('opnameTable').innerHTML = '<table><tr><th>Tanggal</th><th>Produk</th><th>Sistem</th><th>Fisik</th><th>Selisih</th></tr>' + (DATA.opname || []).slice(0, 50).map(function (o) { return '<tr><td>' + esc(o.Tanggal || '') + '</td><td>' + esc(o.NamaProduk) + '</td><td>' + o.StokSistem + '</td><td>' + o.StokFisik + '</td><td>' + o.Selisih + '</td></tr>'; }).join('') + '</table>';
}
async function muatLaporanStok() {
  try {
    var res = await DB.getLaporanStok({ cabangId: cabangAktifId() });
    var html = '<h4>Stok Produk</h4><table><tr><th>Produk</th><th>Stok</th><th>Harga Pokok</th><th>Harga Jual</th></tr>' + (res.produk || []).map(function (p) { return '<tr><td>' + esc(p.nama || p.Nama) + '</td><td>' + (p.stok || p.Stok) + '</td><td>' + rp(p.modal || p.HargaModal || 0) + '</td><td>' + rp(p.harga || p.HargaJual || 0) + '</td></tr>'; }).join('') + '</table>';
    html += '<h4>Stok Bahan Baku</h4><table><tr><th>Bahan</th><th>Stok</th></tr>' + (res.bahan || []).map(function (b) { return '<tr><td>' + esc(b.nama || b.Nama) + '</td><td>' + (b.stok || b.Stok) + ' ' + (b.satuan || b.Satuan || '') + '</td></tr>'; }).join('') + '</table>';
    html += '<h4>Kedaluwarsa</h4>' + ((res.kedaluwarsa || []).map(function (b) { return esc(b.nama || b.NamaProduk || '') + ' — ' + (b.Kedaluwarsa || ''); }).join('<br>') || 'Tidak ada.');
    document.getElementById('lapStokBox').innerHTML = html;
  } catch (e) { alert(e.message); }
}
async function simpanOpname() {
  var pid = document.getElementById('opProduk').value; var fisik = Number(document.getElementById('opFisik').value);
  if (!pid || isNaN(fisik)) return alert('Pilih produk dan isi stok fisik.');
  await DB.simpanOpname({ produkId: pid, stokFisik: fisik, keterangan: document.getElementById('opKet').value, cabangId: cabangAktifId() });
  await loadData(); tampilInfo('Opname tersimpan, stok disesuaikan.');
}
async function muatSaranOrder() {
  try {
    var res = await DB.saranOrder({ cabangId: cabangAktifId() });
    var list = res.saran || res || [];
    document.getElementById('saranBox').innerHTML = '<table><tr><th>Produk</th><th>Stok</th><th>Terjual/hari</th><th>Hari tersisa</th><th>Saran order</th></tr>' + list.map(function (s) { return '<tr><td>' + esc(s.nama) + '</td><td>' + s.stok + '</td><td>' + (s.terjualPerHari || 0) + '</td><td>' + (s.hariTersisa == null ? '—' : s.hariTersisa) + '</td><td><b>' + (s.saranQty || 0) + '</b></td></tr>'; }).join('') + '</table>';
  } catch (e) { alert(e.message); }
}
function gambarLabel() {
  var ids = []; document.querySelectorAll('.labelChk:checked').forEach(function (c) { ids.push(c.value); });
  if (!ids.length) return alert('Pilih minimal 1 produk.');
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
  (DATA.pembelian || []).slice().sort(function (a, b) { return String(a.Tanggal || '') < String(b.Tanggal || '') ? -1 : 1; }).forEach(function (p, i) { pembelianNomor[p.ID] = i + 1; });
}
function fmtBulan(d) { return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }); }
function ringkasItemBeli(id) {
  return (DATA.pembelianDetail || []).filter(function (x) { return x.PembelianID === id; }).map(function (x) { return String(x.NamaProduk || '').slice(0, 10) + ':' + x.Qty; }).join(' ');
}
function renderPembelian() {
  var list = (DATA.pembelian || []).slice().sort(function (a, b) { return String(b.Tanggal || '') < String(a.Tanggal || '') ? -1 : 1; });
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
  document.getElementById('pemasokTable').innerHTML = '<table><tr><th>Nama</th><th>Telepon</th><th>Hutang</th></tr>' + (DATA.pemasok || []).map(function (p) { return '<tr><td>' + esc(p.Nama) + '</td><td>' + esc(p.Telepon || '') + '</td><td>' + rp(p.Hutang || 0) + '</td></tr>'; }).join('') + '</table>';
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
  var dis = Number(document.getElementById('beliDiskon').value || 0);
  var paj = Number(document.getElementById('beliPajak').value || 0);
  var bia = Number(document.getElementById('beliBiaya').value || 0);
  var tot = sub - dis + paj + bia;
  document.getElementById('beliTotalBox').innerHTML = '<div class="dtotal"><span>Subtotal</span><b>' + rp(sub) + '</b></div>'
    + '<div class="dtotal"><span>Total</span><b class="trx-biru">' + rp(tot) + '</b></div>';
  return tot;
}
async function simpanPembelian() {
  if (!beliItems.length) return tampilError('Tambahkan minimal 1 item pembelian.');
  var pemasok = document.getElementById('beliPemasok').value;
  if (!pemasok) return tampilError('Pilih pemasok dulu.');
  var total = hitungTotalBeli();
  try {
    await DB.simpanPembelian({ pemasok: pemasok, items: beliItems, total: total, diskon: Number(document.getElementById('beliDiskon').value || 0), pajak: Number(document.getElementById('beliPajak').value || 0), biayaLain: Number(document.getElementById('beliBiaya').value || 0), bayar: Number(document.getElementById('beliBayar').value || 0), catatan: document.getElementById('beliCatatan').value, cabangId: cabangAktifId() });
  } catch (e) { return tampilError('Gagal menyimpan pembelian: ' + (e.message || e)); }
  beliItems = []; renderBeliItems(); await loadData(); tutupForm('pembelian'); tampilInfo('DRAFT pembelian tersimpan. Tekan PROSES untuk menambah stok.');
}
async function prosesPembelian(id, el) {
  if (!await konfirmasi('Proses pembelian?', 'Stok bertambah, pengeluaran dan utang pemasok tercatat. Proses ini tidak bisa dibatalkan.', 'Ya, Proses', 'primary')) return;
  try { await DB.prosesPembelian({ id: id }); await loadData(); tampilInfo('Pembelian diproses. Stok bertambah.'); }
  catch (e) { tampilError('Gagal memproses pembelian: ' + (e.message || e)); }
}
async function prosesPembelianDetail(id) {
  await prosesPembelian(id, null);
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
  var list = (DATA.pemasok || []).filter(function (p) { return !q || String(p.Nama || '').toLowerCase().indexOf(q) >= 0; });
  document.getElementById('daftarPemasok').innerHTML = list.map(function (p) {
    return '<div class="prow" onclick="pilihPemasok(\'' + esc(p.Nama) + '\')"><div class="pinfo"><b>' + esc(p.Nama) + '</b><span>' + esc(p.Telepon || '') + '</span></div><span style="font-size:20px;color:#94a3b8">›</span></div>';
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
    await DB.upsertPemasok({ Nama: nama, Telepon: document.getElementById('pmBaruTelp').value });
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
  bukaForm('pembelian', pickerProdukDariItem ? 'formBeliItem' : 'formPembelian');
}
function renderPickerProduk() {
  var q = (document.getElementById('cariProdukBeli').value || '').toLowerCase();
  var list = (DATA.produk || []).filter(function (p) {
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
  document.getElementById('beliItemJual').value = Number(pr.HargaJual || 0);
  document.getElementById('beliItemKedaluwarsa').value = '';
  document.getElementById('beliItemHapusBtn').style.display = 'none';
  hitungItemBeli();
  bukaForm('pembelian', 'formBeliItem');
}
function hitungItemBeli() {
  var qty = Number(document.getElementById('beliItemQty').value || 0);
  var total = Number(document.getElementById('beliItemTotal').value || 0);
  var jual = Number(document.getElementById('beliItemJual').value || 0);
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
  var jual = Number(document.getElementById('beliItemJual').value || 0);
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
  document.getElementById('beliItemTotal').value = Number(it.Qty || 0) * Number(it.HargaBeli || 0);
  document.getElementById('beliItemJual').value = Number(it.HargaJual || (pr && pr.HargaJual) || 0);
  document.getElementById('beliItemKedaluwarsa').value = it.Kedaluwarsa || '';
  document.getElementById('beliItemHapusBtn').style.display = 'block';
  hitungItemBeli();
  bukaForm('pembelian', 'formBeliItem');
}
function hapusItemBeliList(i) { beliItems.splice(i, 1); renderBeliItems(); hitungTotalBeli(); }
async function hapusItemBeliForm() {
  if (beliItemIndex < 0) return;
  if (!await konfirmasi('Hapus item?', 'Item ini akan dihapus dari pembelian ini.')) return;
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
async function simpanPemasok() { var nama = document.getElementById('pmNama').value; if (!nama) return alert('Nama wajib diisi.'); await DB.upsertPemasok({ Nama: nama, Telepon: document.getElementById('pmTelp').value, Alamat: document.getElementById('pmAlamat').value }); ['pmNama', 'pmTelp', 'pmAlamat'].forEach(function (i) { document.getElementById(i).value = ''; }); await loadData(); tutupForm('pembelian'); tampilInfo('Pemasok tersimpan.'); }

/* ---------- PENGELUARAN & KAS ---------- */
async function simpanPengeluaran() {
  var nominal = Number(document.getElementById('pgNominal').value || 0); if (!nominal) return alert('Nominal wajib diisi.');
  await DB.simpanPengeluaran({ kategori: document.getElementById('pgKategori').value || 'Lainnya', keterangan: document.getElementById('pgKet').value, nominal: nominal, efekLaba: document.getElementById('pgEfek').value, cabangId: cabangAktifId() });
  document.getElementById('pgKet').value = ''; document.getElementById('pgNominal').value = ''; await loadData(); tutupForm('pengeluaran'); tampilInfo('Pengeluaran tersimpan.');
}
async function simpanUangKas() {
  var nominal = Number(document.getElementById('ukNominal').value || 0); if (!nominal) return alert('Nominal wajib diisi.');
  await DB.simpanUangKas({ jenis: document.getElementById('ukJenis').value, keterangan: document.getElementById('ukKet').value, nominal: nominal, cabangId: cabangAktifId() });
  document.getElementById('ukKet').value = ''; document.getElementById('ukNominal').value = ''; await loadData(); tutupForm('aruskas'); tampilInfo('Kas tersimpan.');
}
function renderKeuangan() {
  document.getElementById('kasTable').innerHTML = '<table><tr><th>Tanggal</th><th>Keterangan</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr>' + (DATA.kas || []).slice(-50).reverse().map(function (k) { return '<tr><td>' + new Date(k.Tanggal).toLocaleString('id-ID') + '</td><td>' + esc(k.Keterangan) + '</td><td>' + rp(k.Masuk) + '</td><td>' + rp(k.Keluar) + '</td><td>' + rp(k.Saldo) + '</td></tr>'; }).join('') + '</table>';
  document.getElementById('pengeluaranTable').innerHTML = '<table><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Nominal</th><th>Efek Laba</th></tr>' + (DATA.pengeluaran || []).slice(0, 100).map(function (p) { return '<tr><td>' + new Date(p.Tanggal).toLocaleString('id-ID') + '</td><td>' + esc(p.Kategori) + '</td><td>' + esc(p.Keterangan || '') + '</td><td>' + rp(p.Nominal) + '</td><td>' + esc(p.EfekLaba || '') + '</td></tr>'; }).join('') + '</table>';
  var r = DATA.ringkasan || {};
  var labaBersih = Number(r.labaHariIni || 0) - (DATA.pengeluaran || []).filter(function (p) { return p.EfekLaba === 'MengurangiLaba'; }).reduce(function (a, p) { return a + Number(p.Nominal || 0); }, 0);
  var ongkirMasuk = (DATA.kas || []).filter(function (k) { return String(k.Keterangan || '').indexOf('Ongkir') >= 0; }).reduce(function (a, k) { return a + Number(k.Masuk || 0); }, 0);
  var ongkirKeluar = (DATA.pengeluaran || []).filter(function (p) { return p.EfekLaba === 'MengurangiOngkir'; }).reduce(function (a, p) { return a + Number(p.Nominal || 0); }, 0);
  document.getElementById('kasSummary').innerHTML = 'Laba hari ini: <b>' + rp(r.labaHariIni) + '</b> • Laba bersih (setelah pengeluaran MengurangiLaba): <b>' + rp(labaBersih) + '</b><br>Ongkir masuk: <b>' + rp(ongkirMasuk) + '</b> • Pengeluaran ongkir: <b>' + rp(ongkirKeluar) + '</b> • Ongkir bersih: <b>' + rp(ongkirMasuk - ongkirKeluar) + '</b><br>Saldo kas: <b>' + rp(r.saldoKas) + '</b>';
}
function exportKasCSV() {
  var rows = [['Tanggal', 'Keterangan', 'Masuk', 'Keluar', 'Saldo']];
  (DATA.kas || []).forEach(function (k) { rows.push([k.Tanggal, k.Keterangan, k.Masuk, k.Keluar, k.Saldo]); });
  unduhFile('arus-kas.csv', rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv');
}

/* ---------- UTANG ---------- */
function renderUtang() {
  document.getElementById('utangTable').innerHTML = '<table><tr><th>ID</th><th>Pemasok</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr>' + (DATA.utang || []).map(function (u) { return '<tr><td>' + esc(u.ID) + '</td><td>' + esc(u.Pemasok) + '</td><td>' + rp(u.Total) + '</td><td>' + rp(u.Dibayar) + '</td><td>' + rp(u.Sisa) + '</td><td><span class="badge ' + (u.Status === 'Lunas' ? '' : 'warn') + '">' + esc(u.Status) + '</span></td></tr>'; }).join('') + '</table>';
}
async function cicilUtang() {
  var id = document.getElementById('cicilUtangId').value; var nominal = Number(document.getElementById('cicilNominal').value || 0);
  if (!id || !nominal) return alert('Pilih utang dan isi nominal cicilan.');
  try { await DB.cicilUtang({ utangId: id, nominal: nominal, keterangan: document.getElementById('cicilKet').value }); document.getElementById('cicilNominal').value = ''; document.getElementById('cicilKet').value = ''; await loadData(); tutupForm('utang'); tampilInfo('Cicilan tersimpan.'); } catch (e) { alert(e.message); }
}

/* ---------- PELANGGAN & PIUTANG ---------- */
function tierOtomatis(pl) {
  var tiers = (DATA.tier || []).slice().sort(function (a, b) { return Number(b.MinTotalBeli) - Number(a.MinTotalBeli); });
  for (var i = 0; i < tiers.length; i++) { if (Number(pl.TotalBeli || 0) >= Number(tiers[i].MinTotalBeli)) return tiers[i].Tier; }
  return pl.Tier || '—';
}
function renderPelanggan() {
  var hanyaPiutang = document.getElementById('plFilterPiutang').checked;
  var list = (DATA.pelanggan || []).filter(function (p) { return !hanyaPiutang || Number(p.Piutang || 0) > 0; });
  document.getElementById('pelangganTable').innerHTML = '<table><tr><th>Nama</th><th>Telepon</th><th>Tier</th><th>Poin</th><th>Piutang</th><th></th></tr>' + list.map(function (p) {
    return '<tr><td>' + esc(p.Nama) + '<br><small>Terakhir beli: ' + esc(p.TerakhirBeli || '—') + '</small></td><td>' + esc(p.Telepon || '') + '</td><td>' + esc(tierOtomatis(p)) + '</td><td>' + (p.Poin || 0) + '</td><td>' + rp(p.Piutang || 0) + '</td><td><button class="secondary" onclick="editPelanggan(\'' + esc(p.ID) + '\')">Edit</button> <button class="secondary" onclick="lunasiSemua(\'' + esc(p.Nama) + '\', this)">Lunasi Semua</button></td></tr>';
  }).join('') + '</table>';
}
function editPelanggan(id) {
  var p = DATA.pelanggan.find(function (x) { return x.ID === id; }); if (!p) return;
  document.getElementById('plId').value = p.ID; document.getElementById('plNama').value = p.Nama; document.getElementById('plTelp').value = p.Telepon || ''; document.getElementById('plAlamat').value = p.Alamat || ''; document.getElementById('plLahir').value = p.TanggalLahir || '';
  show('pelanggan', document.querySelector('nav button.menu[data-sec="pelanggan"]')); bukaForm('pelanggan');
}
function resetPelanggan() { ['plId', 'plNama', 'plTelp', 'plAlamat', 'plLahir'].forEach(function (i) { document.getElementById(i).value = ''; }); tutupForm('pelanggan'); }
async function muatPengingatPiutang() {
  try {
    var res = await DB.pengingatPiutang();
    var list = res.daftar || [];
    document.getElementById('pengingatBox').innerHTML = '<p>Batas jatuh tempo: <b>' + (res.batasHari || 7) + ' hari</b> • ' + list.length + ' pelanggan jatuh tempo.</p>' + (list.map(function (x) { return esc(x.nama) + ' — ' + rp(x.piutang) + ' • ' + x.jumlah + ' transaksi • tertunggak ' + x.hariTertunggak + ' hari ' + (x.waLink ? '<button class="secondary" onclick="window.open(\'' + x.waLink + '\',\'_blank\')">💬 Ingatkan via WA</button>' : '<small>(tanpa nomor WA)</small>'); }).join('<br>') || 'Tidak ada piutang jatuh tempo.');
  } catch (e) { alert(e.message); }
}
async function simpanPelanggan() {
  var nama = document.getElementById('plNama').value; if (!nama) return alert('Nama wajib diisi.');
  await DB.upsertPelanggan({ ID: document.getElementById('plId').value || '', Nama: nama, Telepon: document.getElementById('plTelp').value, Alamat: document.getElementById('plAlamat').value, TanggalLahir: document.getElementById('plLahir').value });
  await loadData(); resetPelanggan(); tampilInfo('Pelanggan tersimpan.');
}
async function lunasiSemua(nama, el) { if (!await konfirmasi('Lunasi semua piutang?', 'Semua piutang pelanggan ' + nama + ' akan ditandai lunas.')) return; try { var res = await DB.lunasiSemua({ pelanggan: nama }); tampilInfo('Dilunasi ' + (res.jumlah || 0) + ' transaksi, total ' + rp(res.total || 0)); await loadData(); } catch (e) { tampilError('Gagal melunasi: ' + (e.message || e)); } }
async function koreksiPoin() {
  if (currentUser && currentUser.peran !== 'Admin') return alert('Koreksi poin hanya untuk Admin.');
  var id = document.getElementById('poinPelanggan').value; var jumlah = Number(document.getElementById('poinJumlah').value || 0);
  if (!id || !jumlah) return alert('Pilih pelanggan dan isi jumlah poin.');
  await DB.koreksiPoin({ pelangganId: id, jumlah: jumlah, keterangan: document.getElementById('poinKet').value });
  await loadData(); tampilInfo('Poin dikoreksi.');
}
async function muatRiwayatPoin() {
  var id = document.getElementById('poinPelanggan').value; if (!id) return alert('Pilih pelanggan dulu.');
  try {
    var res = await DB.getRiwayatPoin({ pelangganId: id });
    var list = res.riwayat || res || [];
    document.getElementById('riwayatPoinBox').innerHTML = '<table><tr><th>Tanggal</th><th>Jenis</th><th>Jumlah</th><th>Sisa</th><th>Keterangan</th></tr>' + list.map(function (r) { return '<tr><td>' + esc(r.Tanggal || '') + '</td><td>' + esc(r.Jenis) + '</td><td>' + r.Jumlah + '</td><td>' + (r.Sisa || '') + '</td><td>' + esc(r.Keterangan || '') + '</td></tr>'; }).join('') + '</table>';
  } catch (e) { alert(e.message); }
}
async function tagihanGabungan() {
  var nama = document.getElementById('tagihanPelanggan').value;
  try {
    var res = await DB.tagihanGabungan({ pelanggan: nama });
    var teks = res.teks || '';
    var pl = (DATA.pelanggan || []).find(function (p) { return p.Nama === nama; });
    var telp = pl && pl.Telepon ? String(pl.Telepon).replace(/\D/g, '') : '';
    document.getElementById('tagihanBox').innerHTML = '<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">' + esc(teks) + '</pre><button class="secondary" onclick="window.open(\'https://wa.me/' + (telp || '') + '?text=' + encodeURIComponent(teks) + '\',\'_blank\')">💬 Kirim Tagihan via WhatsApp</button>';
  } catch (e) { alert(e.message); }
}
function renderWinback() {
  var batas = new Date(); batas.setDate(batas.getDate() - 30);
  var list = (DATA.pelanggan || []).filter(function (p) { if (!p.TerakhirBeli) return false; return new Date(p.TerakhirBeli) < batas; });
  document.getElementById('winbackBox').innerHTML = list.map(function (p) { return esc(p.Nama) + ' — terakhir beli ' + esc(p.TerakhirBeli) + ' • ' + (p.Telepon || 'tanpa nomor') + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + String(p.Telepon || '').replace(/\D/g, '') + '?text=' + encodeURIComponent('Halo ' + p.Nama + ', sudah lama tidak mampir ke ' + (DATA.pengaturan.NamaToko || 'toko kami') + '. Ada promo menanti!') + '\',\'_blank\')">💬 Sapa via WA</button>'; }).join('<br>') || 'Tidak ada pelanggan lama yang tidak datang.';
}

/* ---------- MEJA & DAPUR ---------- */
function renderMeja() {
  document.getElementById('mejaTable').innerHTML = '<table><tr><th>Meja</th><th>Status</th><th></th></tr>' + (DATA.meja || []).map(function (m) { return '<tr><td>' + esc(m.Nama) + '</td><td>' + esc(m.Status || 'Kosong') + '</td><td><button class="danger" onclick="hapusMeja(\'' + esc(m.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
}
async function simpanMeja() {
  var nama = document.getElementById('mjNama').value; if (!nama) return alert('Nama meja wajib diisi.');
  await DB.upsertMeja({ Nama: nama, CabangID: cabangAktifId() });
  document.getElementById('mjNama').value = ''; await loadData(); tutupForm('meja'); tampilInfo('Meja ditambah.');
}
async function hapusMeja(id, el) { if (!await konfirmasi('Hapus meja?', 'Meja ini akan dihapus dari daftar.')) return; try { await DB.hapusMeja({ id: id }); await loadData(); tampilInfo('Meja dihapus.'); } catch (e) { tampilError('Gagal menghapus meja: ' + (e.message || e)); } }
async function muatDapur() {
  try {
    var res = await DB.getDapur({ cabangId: cabangAktifId() });
    var list = res.pesanan || res || [];
    document.getElementById('dapurBox').innerHTML = list.map(function (d) {
      var items = []; try { items = JSON.parse(d.ItemsJSON || '[]'); } catch (e) { }
      return '<div class="card"><b>' + esc(d.Meja || '') + ' — ' + esc(d.TransaksiID || '') + '</b> <span class="badge ' + (d.Status === 'Selesai' ? '' : 'warn') + '">' + esc(d.Status) + '</span><br>' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '<br><button class="secondary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Dimasak\')">Dimasak</button> <button class="primary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Selesai\')">Selesai</button></div>';
    }).join('') || 'Tidak ada pesanan dapur.';
  } catch (e) { alert(e.message); }
}
function renderDapur() {
  document.getElementById('dapurBox').innerHTML = (DATA.pesananDapur || []).map(function (d) {
    var items = []; try { items = JSON.parse(d.ItemsJSON || '[]'); } catch (e) { }
    return '<div class="card"><b>' + esc(d.Meja || '') + ' — ' + esc(d.TransaksiID || '') + '</b> <span class="badge ' + (d.Status === 'Selesai' ? '' : 'warn') + '">' + esc(d.Status) + '</span><br>' + items.map(function (i) { return esc(i.nama || i.Nama) + ' x' + i.Qty; }).join(', ') + '<br><button class="secondary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Dimasak\')">Dimasak</button> <button class="primary" onclick="updateStatusDapur(\'' + esc(d.ID) + '\',\'Selesai\')">Selesai</button></div>';
  }).join('') || 'Tidak ada pesanan dapur.';
}
async function updateStatusDapur(id, status) { await DB.updateStatusDapur({ id: id, status: status }); await loadData(); }

/* ---------- KATALOG ---------- */
function renderKatalog() {
  document.getElementById('katalogTable').innerHTML = (DATA.katalog || []).map(function (k) {
    return '<div class="cart-item"><span><b>' + esc(k.Nama) + '</b> ' + (k.Aktif === 'TIDAK' ? '(nonaktif)' : '') + '</span><span><button class="secondary" onclick="editKatalog(\'' + esc(k.ID) + '\')">Edit</button> <button class="primary" onclick="bukaKatalog(\'' + esc(k.ID) + '\')">Buka Katalog</button> <button class="secondary" onclick="salinLinkKatalog(\'' + esc(k.ID) + '\')">Salin Link</button></span></div>';
  }).join('') || 'Belum ada katalog.';
  var k = (DATA.katalog || [])[0];
  if (k) {
    var prods = (DATA.produk || []).filter(function (p) { return flagYa(p.TampilkanDiKatalog); });
    document.getElementById('katalogPreview').innerHTML = '<h4>' + esc(k.Nama) + '</h4>' + prods.map(function (p) {
      return '<div class="cart-item"><span>' + (k.TampilkanGambar === 'YA' ? emojiProduk(p.Nama) + ' ' : '') + esc(p.Nama) + (k.TampilkanKeterangan === 'YA' && p.Keterangan ? '<br><small>' + esc(p.Keterangan) + '</small>' : '') + '</span><span>' + (k.TampilkanHarga === 'YA' ? rp(p.HargaJual) : '') + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + String((DATA.pengaturan.TeleponToko || '')).replace(/\D/g, '') + '?text=' + encodeURIComponent('Halo, saya mau pesan ' + p.Nama) + '\',\'_blank\')">💬 Pesan</button></span></div>';
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
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(link).then(function () { alert('Link katalog disalin:\n' + link); }); }
  else { prompt('Salin link katalog:', link); }
  document.getElementById('katalogLinkBox').innerHTML = 'Link katalog: <a href="' + esc(link) + '" target="_blank">' + esc(link) + '</a>';
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
  var nama = document.getElementById('ktgNama').value; if (!nama) return alert('Masukkan nama katalog');
  await DB.upsertKatalog({ ID: document.getElementById('ktgId').value || '', Nama: nama, TampilkanGambar: document.getElementById('ktgGambar').checked, TampilkanHarga: document.getElementById('ktgHarga').checked, TampilkanStok: document.getElementById('ktgStok').checked, SembunyikanStokKosong: document.getElementById('ktgSembunyiKosong').checked, TampilkanKeterangan: document.getElementById('ktgKet').checked, Footer: document.getElementById('ktgFooter').value, Aktif: true, CabangID: cabangAktifId() });
  await loadData(); resetKatalog(); tampilInfo('Katalog tersimpan.');
}

/* ---------- PROMO & MEMBER ---------- */
function renderPromo() {
  document.getElementById('promoTable').innerHTML = '<table><tr><th>Nama</th><th>Jenis</th><th>Nilai</th><th>Periode</th><th></th></tr>' + (DATA.promo || []).map(function (p) {
    return '<tr><td>' + esc(p.Nama) + '</td><td>' + esc(p.Jenis) + '</td><td>' + esc(p.Nilai) + '</td><td>' + esc(p.Mulai || '') + ' s/d ' + esc(p.Selesai || '') + '</td><td><button class="secondary" onclick="editPromo(\'' + esc(p.ID) + '\')">Edit</button> <button class="danger" onclick="hapusPromo(\'' + esc(p.ID) + '\', this)">Hapus</button></td></tr>';
  }).join('') + '</table>';
  document.getElementById('tierTable').innerHTML = '<table><tr><th>Tier</th><th>Min Total Beli</th><th>Diskon</th><th>Manfaat</th></tr>' + (DATA.tier || []).map(function (t) { return '<tr><td>' + esc(t.Tier) + '</td><td>' + rp(t.MinTotalBeli) + '</td><td>' + t.DiskonPersen + '%</td><td>' + esc(t.Manfaat || '') + '</td></tr>'; }).join('') + '</table>' || 'Belum ada tier.';
}
function editPromo(id) {
  var p = (DATA.promo || []).find(function (x) { return x.ID === id; }); if (!p) return;
  document.getElementById('prmId').value = p.ID; document.getElementById('prmNama').value = p.Nama; document.getElementById('prmJenis').value = p.Jenis; document.getElementById('prmNilai').value = p.Nilai; document.getElementById('prmSyarat').value = p.SyaratJSON || ''; document.getElementById('prmMulai').value = p.Mulai || ''; document.getElementById('prmSelesai').value = p.Selesai || ''; document.getElementById('prmJamMulai').value = p.JamMulai || ''; document.getElementById('prmJamSelesai').value = p.JamSelesai || ''; document.getElementById('prmHari').value = p.Hari || ''; document.getElementById('prmCabang').value = p.CabangID || '';
  bukaForm('promo');
}
function resetPromo() { ['prmId', 'prmNama', 'prmNilai', 'prmSyarat', 'prmMulai', 'prmSelesai', 'prmJamMulai', 'prmJamSelesai', 'prmHari', 'prmCabang'].forEach(function (i) { document.getElementById(i).value = ''; }); tutupForm('promo'); }
async function simpanPromo() {
  var nama = document.getElementById('prmNama').value; if (!nama) return alert('Nama promo wajib diisi.');
  var syarat = document.getElementById('prmSyarat').value;
  try { if (syarat) JSON.parse(syarat); } catch (e) { return alert('Syarat JSON tidak valid.'); }
  await DB.upsertPromo({ ID: document.getElementById('prmId').value || '', Nama: nama, Jenis: document.getElementById('prmJenis').value, Nilai: document.getElementById('prmNilai').value, SyaratJSON: syarat, Mulai: document.getElementById('prmMulai').value, Selesai: document.getElementById('prmSelesai').value, JamMulai: document.getElementById('prmJamMulai').value, JamSelesai: document.getElementById('prmJamSelesai').value, Hari: document.getElementById('prmHari').value, Aktif: true, CabangID: document.getElementById('prmCabang').value || cabangAktifId() });
  await loadData(); resetPromo(); tampilInfo('Promo tersimpan.');
}
async function hapusPromo(id, el) { if (!await konfirmasi('Hapus promo?', 'Promo ini akan dihapus.')) return; try { await DB.hapusPromo({ id: id }); await loadData(); tampilInfo('Promo dihapus.'); } catch (e) { tampilError('Gagal menghapus promo: ' + (e.message || e)); } }
async function catatTier() {
  var nama = document.getElementById('tierNama').value; if (!nama) return alert('Nama tier wajib diisi.');
  await DB.upsertTier({ tier: nama, minTotalBeli: document.getElementById('tierMin').value, diskonPersen: document.getElementById('tierDiskon').value, manfaat: document.getElementById('tierManfaat').value });
  await loadData(); tampilInfo('Tier tersimpan.');
}
function renderUlangTahun() {
  var bulan = new Date().getMonth() + 1;
  var list = (DATA.pelanggan || []).filter(function (p) { if (!p.TanggalLahir) return false; return Number(String(p.TanggalLahir).slice(5, 7)) === bulan; });
  document.getElementById('ulangTahunBox').innerHTML = list.map(function (p) { return esc(p.Nama) + ' — lahir ' + esc(p.TanggalLahir) + ' • Tier ' + esc(p.Tier || '—') + ' • Poin ' + (p.Poin || 0) + ' <button class="secondary" onclick="window.open(\'https://wa.me/' + String(p.Telepon || '').replace(/\D/g, '') + '?text=' + encodeURIComponent('Selamat ulang tahun, ' + p.Nama + '! Ada promo ulang tahun khusus untukmu di ' + (DATA.pengaturan.NamaToko || 'toko kami') + '.') + '\',\'_blank\')">💬 Kirim Ucapan + Promo</button>'; }).join('<br>') || 'Tidak ada pelanggan yang berulang tahun bulan ini.';
}

/* ---------- MASTER ---------- */
function renderMaster() {
  document.getElementById('grupTable').innerHTML = (DATA.grup || []).map(function (g) { return '<div class="cart-item"><span>' + esc(g.Nama) + '</span><span><button class="danger" onclick="hapusGrup(\'' + esc(g.ID) + '\', this)">Hapus</button></span></div>'; }).join('') || 'Belum ada grup.';
  document.getElementById('satuanTable').innerHTML = '<table><tr><th>Nama</th><th>Singkatan</th><th>Desimal</th><th></th></tr>' + (DATA.satuan || []).map(function (s) { return '<tr><td>' + esc(s.Nama) + '</td><td>' + esc(s.Singkatan || '') + '</td><td>' + esc(s.Desimal || 'TIDAK') + '</td><td><button class="danger" onclick="hapusSatuan(\'' + esc(s.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
  document.getElementById('jenisBayarTable').innerHTML = (DATA.jenisBayar || []).map(function (j) { return '<div class="cart-item"><span>' + esc(j.Nama) + '</span><span><button class="danger" onclick="hapusJenisBayar(\'' + esc(j.ID) + '\', this)">Hapus</button></span></div>'; }).join('') || 'Belum ada jenis pembayaran.';
  document.getElementById('itemPengeluaranTable').innerHTML = (DATA.itemPengeluaran || []).map(function (j) { return '<div class="cart-item"><span>' + esc(j.Nama) + '</span><span><button class="danger" onclick="hapusItemPengeluaran(\'' + esc(j.ID) + '\', this)">Hapus</button></span></div>'; }).join('') || 'Belum ada item pengeluaran.';
  document.getElementById('teksTable').innerHTML = '<table><tr><th>Nama</th><th>Keterangan</th><th>Jenis</th><th></th></tr>' + (DATA.daftarTeks || []).map(function (t) { return '<tr><td>' + esc(t.Nama) + '</td><td>' + esc(t.Keterangan || '') + '</td><td>' + esc(t.Jenis) + '</td><td><button class="danger" onclick="hapusTeks(\'' + esc(t.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
  document.getElementById('pegawaiTable').innerHTML = '<table><tr><th>Nama</th><th>Jabatan</th><th>Target</th><th>Komisi</th><th></th></tr>' + (DATA.pegawai || []).map(function (p) { return '<tr><td>' + esc(p.Nama) + '</td><td>' + esc(p.Jabatan || '') + '</td><td>' + rp(p.Target || 0) + '</td><td>' + (p.KomisiPersen || 0) + '%</td><td><button class="danger" onclick="hapusPegawai(\'' + esc(p.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
}
async function simpanGrup() { var n = document.getElementById('gNama').value; if (!n) return alert('Nama grup wajib diisi.'); await DB.upsertGrup({ id: document.getElementById('gId').value || '', nama: n }); document.getElementById('gNama').value = ''; await loadData(); tutupForm('master'); tampilInfo('Grup tersimpan.'); }
async function hapusGrup(id, el) { if (!await konfirmasi('Hapus grup?', 'Grup ini akan dihapus.')) return; try { await DB.hapusGrup({ id: id }); await loadData(); tampilInfo('Grup dihapus.'); } catch (e) { tampilError('Gagal menghapus grup: ' + (e.message || e)); } }
async function simpanSatuan() { var n = document.getElementById('stNama').value; if (!n) return alert('Nama satuan wajib diisi.'); await DB.upsertSatuan({ id: document.getElementById('stId').value || '', nama: n, singkatan: document.getElementById('stSingkat').value, desimal: document.getElementById('stDesimal').value }); document.getElementById('stNama').value = ''; document.getElementById('stSingkat').value = ''; await loadData(); tutupForm('master'); tampilInfo('Satuan tersimpan.'); }
async function hapusSatuan(id, el) { if (!await konfirmasi('Hapus satuan?', 'Satuan ini akan dihapus.')) return; try { await DB.hapusSatuan({ id: id }); await loadData(); tampilInfo('Satuan dihapus.'); } catch (e) { tampilError('Gagal menghapus satuan: ' + (e.message || e)); } }
async function simpanJenisBayar() { var n = document.getElementById('jbNama').value; if (!n) return alert('Nama wajib diisi.'); await DB.upsertJenisBayar({ id: document.getElementById('jbId').value || '', nama: n }); document.getElementById('jbNama').value = ''; await loadData(); tutupForm('master'); tampilInfo('Jenis bayar tersimpan.'); }
async function hapusJenisBayar(id, el) { if (!await konfirmasi('Hapus jenis bayar?', 'Jenis bayar ini akan dihapus.')) return; try { await DB.hapusJenisBayar({ id: id }); await loadData(); tampilInfo('Jenis bayar dihapus.'); } catch (e) { tampilError('Gagal menghapus jenis bayar: ' + (e.message || e)); } }
async function simpanItemPengeluaran() { var n = document.getElementById('ipNama').value; if (!n) return alert('Nama wajib diisi.'); await DB.upsertItemPengeluaran({ id: document.getElementById('ipId').value || '', nama: n }); document.getElementById('ipNama').value = ''; await loadData(); tutupForm('master'); tampilInfo('Item tersimpan.'); }
async function hapusItemPengeluaran(id, el) { if (!await konfirmasi('Hapus item pengeluaran?', 'Item ini akan dihapus.')) return; try { await DB.hapusItemPengeluaran({ id: id }); await loadData(); tampilInfo('Item dihapus.'); } catch (e) { tampilError('Gagal menghapus item: ' + (e.message || e)); } }
async function simpanTeks() { var n = document.getElementById('txNama').value; if (!n) return alert('Nama wajib diisi.'); await DB.simpanTeks({ id: document.getElementById('txId').value || '', nama: n, keterangan: document.getElementById('txKet').value, jenis: document.getElementById('txJenis').value }); document.getElementById('txNama').value = ''; document.getElementById('txKet').value = ''; await loadData(); tutupForm('master'); tampilInfo('Teks tersimpan.'); }
async function hapusTeks(id, el) { if (!await konfirmasi('Hapus teks?', 'Teks ini akan dihapus.')) return; try { await DB.hapusTeks({ id: id }); await loadData(); tampilInfo('Teks dihapus.'); } catch (e) { tampilError('Gagal menghapus teks: ' + (e.message || e)); } }
async function simpanPegawai() { var n = document.getElementById('pgwNama').value; if (!n) return alert('Nama wajib diisi.'); await DB.upsertPegawai({ id: document.getElementById('pgwId').value || '', nama: n, telepon: document.getElementById('pgwTelp').value, jabatan: document.getElementById('pgwJabatan').value, target: document.getElementById('pgwTarget').value, komisiPersen: document.getElementById('pgwKomisi').value }); ['pgwNama', 'pgwTelp', 'pgwJabatan', 'pgwTarget', 'pgwKomisi'].forEach(function (i) { document.getElementById(i).value = ''; }); await loadData(); tutupForm('master'); tampilInfo('Pegawai tersimpan.'); }
async function hapusPegawai(id, el) { if (!await konfirmasi('Hapus pegawai?', 'Pegawai ini akan dihapus.')) return; try { await DB.hapusPegawai({ id: id }); await loadData(); tampilInfo('Pegawai dihapus.'); } catch (e) { tampilError('Gagal menghapus pegawai: ' + (e.message || e)); } }

/* ---------- BAHAN & RESEP ---------- */
function renderBahan() {
  document.getElementById('bahanTable').innerHTML = '<table><tr><th>Nama</th><th>Stok</th><th>Harga/satuan</th><th>Min.</th><th></th></tr>' + (DATA.bahan || []).map(function (b) { return '<tr><td>' + esc(b.Nama) + '</td><td>' + b.Stok + ' ' + (b.Satuan || '') + '</td><td>' + rp(b.HargaPerSatuan) + '</td><td>' + (b.StokMinimum || 5) + '</td><td><button class="danger" onclick="hapusBahan(\'' + esc(b.ID) + '\', this)">Hapus</button></td></tr>'; }).join('') + '</table>';
  var pid = document.getElementById('resepProduk').value;
  var list = (DATA.resep || []).filter(function (r) { return String(r.ProdukID) === String(pid); });
  document.getElementById('resepList').innerHTML = list.map(function (r) { return esc(r.NamaBahan) + ' — ' + r.QtyPakai + ' per produk'; }).join('<br>') || 'Belum ada resep untuk produk ini.';
  var hpp = 0; list.forEach(function (r) { var b = (DATA.bahan || []).find(function (x) { return x.ID === r.BahanID; }); if (b) hpp += Number(b.HargaPerSatuan) * Number(r.QtyPakai); });
  document.getElementById('resepHpp').textContent = 'HPP dari resep: ' + rp(hpp);
}
async function simpanBahan() { var nama = document.getElementById('bNama').value; if (!nama) return alert('Nama bahan wajib diisi.'); await DB.upsertBahan({ Nama: nama, Satuan: document.getElementById('bSatuan').value, Stok: document.getElementById('bStok').value, HargaPerSatuan: document.getElementById('bHarga').value, StokMinimum: document.getElementById('bMin').value }); ['bNama', 'bSatuan', 'bStok', 'bHarga'].forEach(function (i) { document.getElementById(i).value = ''; }); await loadData(); tutupForm('master'); tampilInfo('Bahan tersimpan.'); }
async function hapusBahan(id, el) { if (!await konfirmasi('Hapus bahan?', 'Bahan ini akan dihapus.')) return; try { await DB.hapusBahan({ id: id }); await loadData(); tampilInfo('Bahan dihapus.'); } catch (e) { tampilError('Gagal menghapus bahan: ' + (e.message || e)); } }
function tambahResepRow() {
  var bid = document.getElementById('resepBahan').value; var b = (DATA.bahan || []).find(function (x) { return x.ID === bid; }); if (!b) return alert('Pilih bahan dulu.');
  resepDraft.push({ bahanId: bid, namaBahan: b.Nama, qty: Number(document.getElementById('resepQty').value || 0) });
  document.getElementById('resepList').innerHTML = resepDraft.map(function (r) { return esc(r.namaBahan) + ' — ' + r.qty; }).join('<br>');
}
async function simpanResep() {
  var pid = document.getElementById('resepProduk').value;
  if (!resepDraft.length) return alert('Tambahkan minimal 1 bahan ke resep dulu.');
  var res = await DB.simpanResep({ produkId: pid, items: resepDraft });
  resepDraft = []; alert('Resep tersimpan. HPP baru: ' + rp(res.hpp || 0)); await loadData();
}
async function hitungHPPProduk(id) { var res = await DB.hitungHPP({ produkId: id }); alert('HPP: ' + rp(res.hpp || 0)); }

/* ---------- LAPORAN ---------- */
function renderLaporan() {
  var total = (DATA.transaksi || []).reduce(function (a, t) { return a + Number(t.Total || 0); }, 0);
  var keluar = (DATA.pengeluaran || []).reduce(function (a, t) { return a + Number(t.Nominal || 0); }, 0);
  document.getElementById('laporanSummary').innerHTML = 'Total penjualan (semua): <b>' + rp(total) + '</b> • Total pengeluaran: <b>' + rp(keluar) + '</b> • Jumlah transaksi: <b>' + (DATA.transaksi || []).length + '</b><p style="color:#64748b;font-size:13px">Omzet laporan hanya menghitung transaksi Lunas; piutang tampil terpisah di Laporan Piutang.</p>';
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
    var res = await DB.getLaporanLengkap({ jenis: jenis, dari: dari, sampai: sampai, cabangId: cabang || undefined });
    var ring = res.ringkasan || {};
    var html = '<h4>Laporan ' + esc(jenis) + ' — ' + esc(dari || '—') + ' s/d ' + esc(sampai || '—') + '</h4>';
    html += '<p>' + Object.keys(ring).map(function (k) { return esc(k) + ': <b>' + (typeof ring[k] === 'number' ? rp(ring[k]) : esc(ring[k])) + '</b>'; }).join(' • ') + '</p>';
    var baris = res.baris || [];
    if (baris.length) {
      var keys = Object.keys(baris[0]);
      html += '<table><tr>' + keys.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr>' + baris.map(function (b) { return '<tr>' + keys.map(function (k) { return '<td>' + esc(b[k] == null ? '' : b[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
    } else html += '<p>Tidak ada data pada periode ini.</p>';
    document.getElementById('laporanBox').innerHTML = html;
    if (jenis === 'penjualan') renderPieTopProduct(baris);
    var tk = await DB.getTopKasir({ dari: dari, sampai: sampai, cabangId: cabang || undefined });
    var top = tk.top || tk || [];
    document.getElementById('topKasirBox').innerHTML = '<h4>Top Kasir</h4><table><tr><th>Kasir</th><th>Omzet</th><th>Jumlah</th><th>Komisi</th></tr>' + top.map(function (t) { return '<tr><td>' + esc(t.kasir) + '</td><td>' + rp(t.omzet) + '</td><td>' + (t.jumlah || 0) + '</td><td>' + rp(t.komisi || 0) + '</td></tr>'; }).join('') + '</table>';
  } catch (e) { alert(e.message); }
}
function renderPieTopProduct(baris) {
  var jual = {}; var totalQty = 0;
  (DATA.detail || []).forEach(function (x) { jual[x.NamaProduk] = (jual[x.NamaProduk] || 0) + Number(x.Qty); totalQty += Number(x.Qty); });
  var top = Object.keys(jual).map(function (k) { return { nama: k, qty: jual[k] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
  if (!top.length) { document.getElementById('pieBox').innerHTML = ''; return; }
  var warna = ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];
  var persen = top.map(function (t) { return Math.round(t.qty / totalQty * 100); });
  var sisa = 100 - persen.reduce(function (a, b) { return a + b; }, 0);
  persen[persen.length - 1] += sisa;
  var acc = 0; var stops = [];
  persen.forEach(function (p, i) { stops.push(warna[i % warna.length] + ' ' + acc + '% ' + (acc + p) + '%'); acc += p; });
  document.getElementById('pieBox').innerHTML = '<h4>Pie Chart — Top Product (total 100%)</h4><div class="pie" style="background:conic-gradient(' + stops.join(', ') + ')"></div>' + top.map(function (t, i) { return '<div><span style="display:inline-block;width:12px;height:12px;background:' + warna[i % warna.length] + '"></span> ' + esc(t.nama) + ' — ' + t.qty + ' (' + persen[i] + '%)</div>'; }).join('');
}
async function exportLaporan() {
  var jenis = document.getElementById('lapJenis').value;
  try {
    var res = await DB.exportLaporanExcel({ jenis: jenis, dari: document.getElementById('lapDari').value, sampai: document.getElementById('lapSampai').value, cabangId: document.getElementById('lapCabang').value || undefined });
    unduhFile('laporan-' + jenis + '.csv', res.csv || '', 'text/csv');
  } catch (e) { alert(e.message); }
}
function exportCSV() {
  var rows = [['ID', 'Tanggal', 'Pelanggan', 'Total', 'Bayar', 'Sisa', 'StatusBayar']];
  (DATA.transaksi || []).forEach(function (t) { rows.push([t.ID, t.Tanggal, t.Pelanggan, t.Total, t.Bayar, t.Sisa, t.StatusBayar]); });
  unduhFile('transaksi.csv', rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'text/csv');
}
function backupJSON() {
  unduhFile('backup-pos.json', JSON.stringify(DATA, null, 2), 'application/json');
}

/* ---------- LAPOR BOS (MANUAL) ---------- */
async function pratinjauLaporBos() {
  try {
    var res = await DB.kirimLaporBos({ tanggal: document.getElementById('lbTanggal').value || undefined, cabangId: document.getElementById('lbCabang').value || undefined, mode: document.getElementById('lbMode').value });
    laporBosTeks = res.teks || ''; laporBosWa = res.waLink || '';
    document.getElementById('lbPreview').textContent = laporBosTeks;
    document.getElementById('lbWaLink').innerHTML = laporBosWa ? '<a href="' + esc(laporBosWa) + '" target="_blank">Buka WhatsApp</a>' : '';
  } catch (e) { alert(e.message); }
}
function kirimLaporBosWA() {
  if (!laporBosTeks) return alert('Buat pratinjau laporan dulu.');
  var wa = (DATA.pengaturan || {}).NomorPemilikWA || '';
  var url = wa ? ('https://wa.me/' + wa + '?text=' + encodeURIComponent(laporBosTeks)) : (laporBosWa || ('https://wa.me/?text=' + encodeURIComponent(laporBosTeks)));
  window.open(url, '_blank');
  catatLaporBos('WhatsApp');
}
function cetakLaporBos() {
  if (!laporBosTeks) return alert('Buat pratinjau laporan dulu.');
  document.getElementById('strukPrint').textContent = laporBosTeks;
  catatLaporBos('Cetak');
  window.print();
}
async function catatLaporBos(cara) {
  if (!laporBosTeks) return;
  try { await DB.catatLaporBos({ teks: laporBosTeks, cara: cara, cabangId: document.getElementById('lbCabang').value || undefined }); } catch (e) { /* pencatatan gagal: laporan tetap terkirim/dicetak */ }
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
  document.getElementById('uId').value = u.ID; document.getElementById('uNama').value = u.Nama; document.getElementById('uPin').value = u.PIN || '';
  document.getElementById('uPeran').value = u.Peran; document.getElementById('uCabang').value = u.CabangID || ''; document.getElementById('uAkses').value = u.AksesTransaksi || 'Tidak dibatasi';
  try { var iz = JSON.parse(u.IzinJSON || '{}'); IZIN_KEYS.forEach(function (k) { var el = document.getElementById('iz_' + k[0]); if (el) el.checked = iz[k[0]] !== false; }); } catch (e) { }
  bukaForm('pengguna');
}
function resetPengguna() { ['uId', 'uNama', 'uPin'].forEach(function (i) { document.getElementById(i).value = ''; }); document.getElementById('uPeran').value = 'Kasir'; tutupForm('pengguna'); }
async function simpanPengguna() {
  var nama = document.getElementById('uNama').value, pin = document.getElementById('uPin').value;
  if (!nama || !pin) return alert('Nama dan PIN wajib diisi.');
  await DB.upsertPengguna({ ID: document.getElementById('uId').value || '', Nama: nama, PIN: pin, Peran: document.getElementById('uPeran').value, CabangID: document.getElementById('uCabang').value, AksesTransaksi: document.getElementById('uAkses').value, IzinJSON: JSON.stringify(bacaIzin()) });
  await loadData(); resetPengguna(); tampilInfo('Pengguna tersimpan.');
}
async function hapusPengguna(id, el) { if (!await konfirmasi('Hapus pengguna?', 'Pengguna ini tidak bisa lagi login ke aplikasi.')) return; try { await DB.hapusPengguna({ id: id }); await loadData(); tampilInfo('Pengguna dihapus.'); } catch (e) { tampilError('Gagal menghapus pengguna: ' + (e.message || e)); } }

/* ---------- LOGO STRUK (3 slot ala Griyo) ----------
   LogoToko  = Logo 1, Mode teks — logo utama di atas struk.
   Logo2     = Logo 2, Mode grafis & WhatsApp — logo di gambar struk (kanvas PNG).
               Kosong = pakai Logo 1.
   Watermark = logo samar di belakang isi struk (layar, cetak, gambar). */
var logoDataUrl = '', logo2DataUrl = '', watermarkDataUrl = '';
var LOGO_SLOT = {
  LogoToko: { get: function () { return logoDataUrl; }, set: function (v) { logoDataUrl = v; }, file: 'logoFile', img: 'logoPreview', hapus: 'logoHapusBtn' },
  Logo2: { get: function () { return logo2DataUrl; }, set: function (v) { logo2DataUrl = v; }, file: 'logo2File', img: 'logo2Preview', hapus: 'logo2HapusBtn' },
  Watermark: { get: function () { return watermarkDataUrl; }, set: function (v) { watermarkDataUrl = v; }, file: 'wmFile', img: 'wmPreview', hapus: 'wmHapusBtn' }
};
function tampilLogoPreview() {
  var p = DATA.pengaturan || {};
  Object.keys(LOGO_SLOT).forEach(function (k) {
    var s = LOGO_SLOT[k];
    var img = document.getElementById(s.img); if (!img) return;
    var src = s.get() || p[k] || '';
    img.src = src; img.style.display = src ? 'block' : 'none';
    var hb = document.getElementById(s.hapus); if (hb) hb.style.display = src ? '' : 'none';
  });
}
function pilihLogo(input, kunci) {
  kunci = kunci || 'LogoToko';
  var f = input.files && input.files[0]; if (!f) return;
  if (!/^image\//.test(f.type || '')) { alert('Pilih file gambar (PNG/JPG).'); input.value = ''; return; }
  var rd = new FileReader();
  rd.onload = function () {
    var img = new Image();
    img.onload = function () {
      var url = kecilkanLogo(img, 512);
      if (url.length > 200000) url = kecilkanLogo(img, 256);
      LOGO_SLOT[kunci].set(url); tampilLogoPreview(); pratinjauProfil();
    };
    img.onerror = function () { alert('File gambar tidak bisa dibaca.'); };
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
  var payload = { NamaToko: document.getElementById('sNama').value, AlamatToko: document.getElementById('sAlamat').value, KotaToko: document.getElementById('sKota').value, TeleponToko: document.getElementById('sTelp').value, FooterStruk: document.getElementById('sFooter').value, SloganToko: document.getElementById('sSlogan').value, TargetHarian: document.getElementById('sTarget').value, NomorPemilikWA: document.getElementById('sWa').value, JatuhTempoHari: document.getElementById('sJatuhTempo').value, PoinAktif: document.getElementById('sPoinAktif').value, PoinPerRupiah: document.getElementById('sPoinPer').value, PoinTukarRate: document.getElementById('sPoinRate').value, PajakAktif: document.getElementById('sPajakAktif').value, PajakPersen: document.getElementById('sPajakPersen').value, Bahasa: document.getElementById('sBahasa').value, FormatTanggal: document.getElementById('sFormatTanggal').value, ModeGelap: document.getElementById('sGelap').value, TampilkanPoinStruk: document.getElementById('sPoinStruk').value, WatermarkStruk: document.getElementById('sWatermark').value, StrukUkuranKertas: document.getElementById('sKertas').value, ModeMejaAktif: document.getElementById('sMeja').value, PromoAktif: document.getElementById('sPromo').value, MultiCabangAktif: document.getElementById('sMultiCabang').value, LogoToko: logoDataUrl, Logo2: logo2DataUrl, Watermark: watermarkDataUrl };
  await DB.simpanPengaturan(payload);
  document.body.classList.toggle('dark', payload.ModeGelap === 'YA');
  var cb = document.getElementById('sCabangAktif').value;
  if (cb && cb !== cabangAktifId()) { await DB.setCabangAktif({ id: cb }); }
  await loadData(); alert('Pengaturan tersimpan. Nama toko bisa diubah lagi kapan pun di sini.');
}
async function simpanCabang() {
  var nama = document.getElementById('cbNama').value; if (!nama) return alert('Nama cabang wajib diisi.');
  await DB.upsertCabang({ ID: document.getElementById('cbId').value || '', Nama: nama, Alamat: document.getElementById('cbAlamat').value, Telepon: document.getElementById('cbTelp').value });
  ['cbNama', 'cbAlamat', 'cbTelp'].forEach(function (i) { document.getElementById(i).value = ''; });
  await loadData(); tutupForm('pengaturan'); tampilInfo('Cabang tersimpan.');
}
async function hapusCabang(id, el) { if (!await konfirmasi('Hapus cabang?', 'Cabang ini akan dihapus.')) return; try { await DB.hapusCabang({ id: id }); await loadData(); tampilInfo('Cabang dihapus.'); } catch (e) { tampilError('Gagal menghapus cabang: ' + (e.message || e)); } }
async function setCabangAktif(id) { await DB.setCabangAktif({ id: id }); await loadData(); tampilInfo('Cabang aktif diganti.'); }
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
    document.getElementById('logsBox').innerHTML = '<table><tr><th>Tanggal</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr>' + list.map(function (l) { return '<tr><td>' + esc(l.Tanggal || '') + '</td><td>' + esc(l.Pengguna || '') + '</td><td>' + esc(l.Aksi || '') + '</td><td>' + esc(l.Detail || '') + '</td></tr>'; }).join('') + '</table>';
  } catch (e) { alert(e.message); }
}
loadData();
