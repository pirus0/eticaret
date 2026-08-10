/*
 * Kayıtlı ürünler için IndexedDB katmanı.
 *
 * Backend yok (statik site) — bu yüzden "kaydet" özelliği tarayıcının kendi
 * veritabanında saklanıyor. Bu, kayıtların SADECE bu tarayıcıda/bu cihazda
 * durduğu, farklı bir tarayıcıdan veya cihazdan görünmeyeceği anlamına gelir.
 * localStorage değil IndexedDB kullanıldı çünkü görseller (data URL olarak,
 * yeniden boyutlandırılmış hâlde) saklanıyor — localStorage'ın ~5-10MB'lık
 * string sınırı görsellerle hızla dolar, IndexedDB için bu sorun değil.
 *
 * calc.js ile aynı çift-ortam (tarayıcı + Node) dışa aktarma deseni kullanıldı,
 * ama IndexedDB tarayıcıya özgü olduğu için Node tarafında gerçek testi yok —
 * bu dosya sadece tarayıcıda (Playwright ile) test edildi.
 */

(function (root) {
  'use strict';

  var DB_NAME = 'kar-hesap-db';
  var DB_VERSION = 1;
  var STORE = 'saved';

  // Bağlantı (açılış sözü) modül kapsamında önbelleğe alınıyor — önceden her
  // addItem/getAll/deleteItem/count çağrısı yeni bir indexedDB.open() tetikliyordu,
  // bu gereksiz yere yavaş ve (kısa süre için) birden fazla açık bağlantı
  // anlamına geliyordu. Açılış devam ederken gelen eşzamanlı çağrılar da aynı
  // sözü paylaşır (tekrar open() tetiklemez).
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in (root || {}))) {
        reject(new Error('Bu tarayıcı IndexedDB desteklemiyor, kayıt özelliği kullanılamaz.'));
        return;
      }
      var req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = function () {
        var db = req.result;
        // Başka bir sekme DB sürümünü değiştirirse bu bağlantı geçersiz
        // kalır — kapatıp önbelleği temizliyoruz ki bir sonraki çağrı
        // temiz bir bağlantı açsın.
        db.onversionchange = function () {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = function () {
        dbPromise = null; // başarısız açılışı önbelleğe alma, sonraki çağrı yeniden denesin
        reject(req.error);
      };
    });
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var result;
        try {
          result = fn(store);
        } catch (syncErr) {
          reject(syncErr);
          return;
        }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // record: { name, prioritySite, image (dataURL veya null), createdAt,
  //           input (readInput() çıktısı), results (KH.computeAll çıktısı) }
  function addItem(record) {
    return withStore('readwrite', function (store) {
      return reqToPromise(store.add(record));
    });
  }

  function getAll() {
    return withStore('readonly', function (store) {
      return reqToPromise(store.getAll());
    }).then(function (items) {
      return items.sort(function (a, b) { return b.createdAt - a.createdAt; });
    });
  }

  function deleteItem(id) {
    return withStore('readwrite', function (store) {
      return reqToPromise(store.delete(id));
    });
  }

  function count() {
    return withStore('readonly', function (store) {
      return reqToPromise(store.count());
    });
  }

  var KHStore = { addItem: addItem, getAll: getAll, deleteItem: deleteItem, count: count };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KHStore;
  } else {
    root.KHStore = KHStore;
  }
})(typeof window !== 'undefined' ? window : this);
