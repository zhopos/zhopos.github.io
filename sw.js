// ============================================================
// Zho POS v4 — Service Worker (PWA)
// ============================================================
// - App shell (file lokal)  : cache-first, diperbarui di background.
// - API Supabase            : network-first, TIDAK PERNAH di-cache
//   (data harus selalu segar; request POST / auth tidak disentuh).
// - File lintas origin lain : dilewatkan ke network tanpa cache.
// - Naikkan CACHE_NAME setiap kali app shell berubah.
// ============================================================

var CACHE_NAME = 'zho-pos-v4-1';

var APP_SHELL = [
  './',
  'index.html',
  'app.js',
  'supabase.js',
  'config.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Satu file lambat/gagal tidak boleh menahan install (pernah membuat
      // install PWA di HP terasa lama): cache per-file, yang gagal dilewati —
      // file itu akan di-cache saat pertama dipakai (fetch handler).
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () { return null; });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf('zho-pos-') === 0 && key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  // Hanya request GET yang diproses; POST / PUT / DELETE (simpan data,
  // auth, dsb.) selalu diteruskan ke network tanpa campur tangan cache.
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // API Supabase: network-first, tidak pernah di-cache.
  if (url.hostname === 'supabase.co' || url.hostname.indexOf('.supabase.co') !== -1) {
    event.respondWith(fetch(event.request));
    return;
  }

  // File lintas origin lain (mis. CDN): network saja, tanpa cache.
  if (url.origin !== self.location.origin) return;

  // App shell (same-origin): cache-first + refresh di background.
  // Refresh pakai {cache:'reload'} supaya tidak kena HTTP cache GitHub
  // Pages (max-age 10 menit) — tanpa ini, file lama bisa bertahan di
  // cache meski server sudah menyajikan versi baru.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(event.request, { cache: 'reload' }).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      }).catch(function () { return null; });

      // Ada cache: tampilkan langsung, network hanya memperbarui cache.
      if (cached) return cached;

      // Tidak ada cache: tunggu network; kalau offline dan ini navigasi,
      // jatuhkan ke index.html dari cache.
      return network.then(function (res) {
        if (res) return res;
        if (event.request.mode === 'navigate') return caches.match('index.html');
        throw new Error('offline dan tidak ada cache');
      });
    })
  );
});
