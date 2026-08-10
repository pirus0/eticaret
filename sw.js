'use strict';

// Surum numarasini her rate/kur guncellemesinde artirin — bu, eski istemcilerin
// onbellegini temizleyip yeni verileri cekmesini saglar.
// v7: ayarlar paneli eklendi (settings.js) + calc.js'te kritik bir duzeltme
// (KH.N11_HIZMET_BEDELI_PCT / KH.TRENDYOL_HIZMET_BEDELI_TRY / KH.SHOPIFY_
// GATEWAY_DEFAULT_PCT artik dogrudan KH.X uzerinden okunuyor, boylece ayarlar
// panelinden yapilan degisiklikler hesaplamaya gercekten yansiyor) - eski
// onbellek settings.js'i hic sunmazdi ve calc.js'in eski (duzeltilmemis)
// surumunde ayarlar sessizce yok sayilirdi.
var CACHE_NAME = 'kar-hesap-v7';

var APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './calc.js',
  './storage.js',
  './settings.js',
  './app.js',
  './manifest.json',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// Kasıtlı olarak AG-ONCELIKLI (network-first): komisyon/kargo/kur verileri
// zamanla guncellenecek. Kullanici cevrimici oldugu surece her zaman en
// guncel calc.js/index.html'i gormeli; onbellek sadece cevrimdisi yedegi.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Sadece basarili (2xx) yanitlari onbellekle — aksi halde gecici bir
        // 404/500 onbellege yazilip cevrimdisi kullanicilara o bozuk yanit
        // sunulmaya devam ederdi. cache.put() reddi de (ör. kota dolu)
        // asil yaniti etkilemesin diye ayrica yakalaniyor.
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            return cache.put(event.request, copy);
          }).catch(function () { /* onbellek yazilamadi, asil yanit yine de donuyor */ });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
