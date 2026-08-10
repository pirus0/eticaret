/*
 * Ayarlar (KHSettings) — kullanıcının komisyon oranlarını, hizmet bedellerini
 * ve platform varsayılanlarını KALICI olarak (tarayıcının localStorage'ında)
 * düzenlemesini sağlayan katman. 10 Ağustos 2026, kullanıcı isteğiyle eklendi
 * ("Trendyol hizmet ücretinden hangi sektöre ne kadar yüzdelik kesmesi kargo
 * ücretleri gibi her şeyi düzenleyebildiğim bir ayarlar sekmesi olsun").
 *
 * calc.js'in KENDİSİ DEĞİŞMEDİ ve DEĞİŞMEMELİ — bu dosya sadece calc.js'in
 * dışa aktardığı KH nesnesinin (SECTORS, TRENDYOL_HIZMET_BEDELI_TRY, vb.)
 * üzerine, sayfa yüklenirken BİR KEZ (init), kullanıcının kaydettiği
 * düzeltmeleri uyguluyor — doğrudan mutate ederek. computeAll()/
 * computeAllFromPrice() hiçbir değişiklik görmeden, zaten okuduğu tabloların
 * GÜNCEL halini okumuş oluyor. `node test.js` bu dosyayı hiç yüklemediği için
 * (tarayıcıya özel, `localStorage` kullanıyor) calc.js'in kendi testleri her
 * zaman GERÇEK fabrika varsayılanlarına karşı çalışmaya devam ediyor —
 * kullanıcının ayarları test sonuçlarını asla etkilemez.
 *
 * Kapsam (kasıtlı olarak kısmi — kullanıcıyla netleştirildi, 10 Ağustos 2026):
 * sektör komisyon oranları (Amazon/Trendyol/n11), Trendyol/n11 hizmet
 * bedelleri, Shopier/Shopify/Etsy varsayılanları, döviz kuru. Kargo taşıyıcı
 * fiyat tabloları (6 firma × onlarca desi dilimi) KAPSAM DIŞI — halihazırda
 * "taşıyıcı seç + otomatik hesapla" sistemiyle yönetiliyor; ~60+ ek alan
 * eklemek paneli kullanılamaz hale getirirdi (kullanıcı bu ayrımı onayladı).
 *
 * Depolama şekli KASITLI OLARAK SEYREK (sparse) — sadece kullanıcının
 * GERÇEKTEN değiştirdiği alanlar localStorage'a yazılıyor, her alanın tam bir
 * kopyası değil. Bu, calc.js'teki asıl veriler ileride (yeni bir araştırma
 * turunda) güncellenirse, kullanıcının HİÇ dokunmadığı alanların otomatik
 * olarak yeni varsayılanı almaya devam etmesini sağlıyor — dokunmadığı bir
 * alanda eski/donmuş bir kopyada kilitli kalmıyor.
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'kh-settings-v1';

  function clampPositive(rawValue) {
    if (rawValue === null || rawValue === '' || rawValue === undefined) return null;
    var n = parseFloat(rawValue);
    if (isNaN(n)) return null;
    return Math.max(0, n);
  }

  function isEmptyValue(rawValue) {
    return rawValue === null || rawValue === '' || rawValue === undefined ||
      (typeof rawValue === 'number' && isNaN(rawValue));
  }

  // Amazon'un `sector.amazon` alanı ya düz bir sayı ya da kademeli bir
  // `{tiers:[[esik,dusukOran],[Infinity,yuksekOran]]}` nesnesi olabiliyor.
  // JSON.stringify(Infinity) === 'null' olduğu için genel bir JSON tabanlı
  // deep-clone burada SESSİZCE VERİ BOZAR (Infinity kaybolur) — bu yüzden
  // bu alan için özel, Infinity'yi koruyan bir klon fonksiyonu kullanılıyor.
  function cloneAmazonRate(v) {
    if (v == null || typeof v === 'number') return v;
    if (v.tiers) {
      return { tiers: v.tiers.map(function (t) { return [t[0], t[1]]; }) };
    }
    return v;
  }

  function loadRaw() {
    if (typeof localStorage === 'undefined') return {};
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveRaw(obj) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      // Kota dolu vb. — sessizce yut; ayarlar sadece bu oturumda kalıcı olmaz,
      // hesaplama çökmemeli.
    }
  }

  // --- Modül kapsamında tutulan durum (bir sayfa yüklemesi boyunca) ---
  var defaults = null;   // calc.js'in HAM (override'sız) değerlerinin anlık görüntüsü
  var overrides = {};    // şu an localStorage'dan yüklü / kaydedilecek düzeltmeler

  function captureDefaults(KH) {
    var sectors = {};
    KH.SECTORS.forEach(function (s) {
      sectors[s.id] = { amazon: cloneAmazonRate(s.amazon), trendyol: s.trendyol, n11: s.n11 };
    });
    var plans = {};
    KH.SHOPIFY_PLANS.forEach(function (p) {
      plans[p.id] = { monthlyUSD: p.monthlyUSD, externalSurchargePct: p.externalSurchargePct };
    });
    return {
      sectors: sectors,
      fees: {
        trendyolHizmetBedeliTRY: KH.TRENDYOL_HIZMET_BEDELI_TRY,
        n11HizmetBedeliPct: KH.N11_HIZMET_BEDELI_PCT
      },
      shopier: { commissionPct: KH.SHOPIER.commissionPct, fixedTRY: KH.SHOPIER.fixedTRY },
      shopify: { gatewayDefaultPct: KH.SHOPIFY_GATEWAY_DEFAULT_PCT, plans: plans },
      etsy: {
        transactionPct: KH.ETSY.transactionPct,
        listingFeeUSD: KH.ETSY.listingFeeUSD,
        regulatoryOperatingFeePct: KH.ETSY.regulatoryOperatingFeePct,
        defaultPaymentProcessingPct: KH.ETSY.defaultPaymentProcessingPct,
        currencyConversionPct: KH.ETSY.currencyConversionPct,
        offsiteUnderPct: KH.ETSY.offsiteAds.underThresholdPct,
        offsiteOverPct: KH.ETSY.offsiteAds.overThresholdPct,
        offsiteThresholdUSD: KH.ETSY.offsiteAds.thresholdUSD
      },
      fx: { USD_TRY: KH.FX.USD_TRY, EUR_TRY: KH.FX.EUR_TRY }
    };
  }

  // overrides'daki (seyrek, sadece degistirilmis alanlar) degerleri KH'nin
  // CANLI nesnelerine dogrudan yaziyor (mutate). KH.SECTORS bir DIZI oldugu
  // icin id -> eleman eslemesi forEach ile yapiliyor.
  function applyOverrides(KH, ov) {
    if (!ov) return;
    if (ov.sectors) {
      KH.SECTORS.forEach(function (s) {
        var o = ov.sectors[s.id];
        if (!o) return;
        if (o.amazon != null) {
          if (typeof o.amazon === 'object') {
            var th = clampPositive(o.amazon.threshold);
            var lo = clampPositive(o.amazon.lowPct);
            var hi = clampPositive(o.amazon.highPct);
            if (th != null && lo != null && hi != null) {
              s.amazon = { tiers: [[th, lo], [Infinity, hi]] };
            }
          } else {
            var flat = clampPositive(o.amazon);
            if (flat != null) s.amazon = flat;
          }
        }
        if (o.trendyol != null) {
          var t = clampPositive(o.trendyol);
          if (t != null) s.trendyol = t;
        }
        if (o.n11 != null) {
          var n = clampPositive(o.n11);
          if (n != null) s.n11 = n;
        }
      });
    }
    if (ov.fees) {
      if (ov.fees.trendyolHizmetBedeliTRY != null) {
        var tf = clampPositive(ov.fees.trendyolHizmetBedeliTRY);
        if (tf != null) KH.TRENDYOL_HIZMET_BEDELI_TRY = tf;
      }
      if (ov.fees.n11HizmetBedeliPct != null) {
        var nf = clampPositive(ov.fees.n11HizmetBedeliPct);
        if (nf != null) KH.N11_HIZMET_BEDELI_PCT = nf;
      }
    }
    if (ov.shopier) {
      if (ov.shopier.commissionPct != null) {
        var sc = clampPositive(ov.shopier.commissionPct);
        if (sc != null) KH.SHOPIER.commissionPct = sc;
      }
      if (ov.shopier.fixedTRY != null) {
        var sfx = clampPositive(ov.shopier.fixedTRY);
        if (sfx != null) KH.SHOPIER.fixedTRY = sfx;
      }
    }
    if (ov.shopify) {
      if (ov.shopify.gatewayDefaultPct != null) {
        var gw = clampPositive(ov.shopify.gatewayDefaultPct);
        if (gw != null) KH.SHOPIFY_GATEWAY_DEFAULT_PCT = gw;
      }
      if (ov.shopify.plans) {
        KH.SHOPIFY_PLANS.forEach(function (p) {
          var po = ov.shopify.plans[p.id];
          if (!po) return;
          if (po.monthlyUSD != null) {
            var mu = clampPositive(po.monthlyUSD);
            if (mu != null) p.monthlyUSD = mu;
          }
          if (po.externalSurchargePct != null) {
            var es = clampPositive(po.externalSurchargePct);
            if (es != null) p.externalSurchargePct = es;
          }
        });
      }
    }
    if (ov.etsy) {
      var flatMap = {
        transactionPct: 'transactionPct',
        listingFeeUSD: 'listingFeeUSD',
        regulatoryOperatingFeePct: 'regulatoryOperatingFeePct',
        defaultPaymentProcessingPct: 'defaultPaymentProcessingPct',
        currencyConversionPct: 'currencyConversionPct'
      };
      Object.keys(flatMap).forEach(function (k) {
        if (ov.etsy[k] != null) {
          var v = clampPositive(ov.etsy[k]);
          if (v != null) KH.ETSY[flatMap[k]] = v;
        }
      });
      if (ov.etsy.offsiteUnderPct != null) {
        var ou = clampPositive(ov.etsy.offsiteUnderPct);
        if (ou != null) KH.ETSY.offsiteAds.underThresholdPct = ou;
      }
      if (ov.etsy.offsiteOverPct != null) {
        var oo = clampPositive(ov.etsy.offsiteOverPct);
        if (oo != null) KH.ETSY.offsiteAds.overThresholdPct = oo;
      }
      if (ov.etsy.offsiteThresholdUSD != null) {
        var ot = clampPositive(ov.etsy.offsiteThresholdUSD);
        if (ot != null) KH.ETSY.offsiteAds.thresholdUSD = ot;
      }
    }
    if (ov.fx) {
      if (ov.fx.USD_TRY != null) {
        var ux = clampPositive(ov.fx.USD_TRY);
        if (ux != null) KH.FX.USD_TRY = ux;
      }
      if (ov.fx.EUR_TRY != null) {
        var ex = clampPositive(ov.fx.EUR_TRY);
        if (ex != null) KH.FX.EUR_TRY = ex;
      }
    }
  }

  // KH'yi captureDefaults() ile alınan fabrika görüntüsüne geri yazar —
  // resetSection/resetAll'ın ilk adımı (sonra kalan override'lar varsa
  // applyOverrides ile tekrar uygulanır).
  function restoreFactory(KH) {
    if (!defaults) return;
    KH.SECTORS.forEach(function (s) {
      var d = defaults.sectors[s.id];
      if (!d) return;
      s.amazon = cloneAmazonRate(d.amazon);
      s.trendyol = d.trendyol;
      s.n11 = d.n11;
    });
    KH.TRENDYOL_HIZMET_BEDELI_TRY = defaults.fees.trendyolHizmetBedeliTRY;
    KH.N11_HIZMET_BEDELI_PCT = defaults.fees.n11HizmetBedeliPct;
    KH.SHOPIER.commissionPct = defaults.shopier.commissionPct;
    KH.SHOPIER.fixedTRY = defaults.shopier.fixedTRY;
    KH.SHOPIFY_GATEWAY_DEFAULT_PCT = defaults.shopify.gatewayDefaultPct;
    KH.SHOPIFY_PLANS.forEach(function (p) {
      var d = defaults.shopify.plans[p.id];
      if (!d) return;
      p.monthlyUSD = d.monthlyUSD;
      p.externalSurchargePct = d.externalSurchargePct;
    });
    KH.ETSY.transactionPct = defaults.etsy.transactionPct;
    KH.ETSY.listingFeeUSD = defaults.etsy.listingFeeUSD;
    KH.ETSY.regulatoryOperatingFeePct = defaults.etsy.regulatoryOperatingFeePct;
    KH.ETSY.defaultPaymentProcessingPct = defaults.etsy.defaultPaymentProcessingPct;
    KH.ETSY.currencyConversionPct = defaults.etsy.currencyConversionPct;
    KH.ETSY.offsiteAds.underThresholdPct = defaults.etsy.offsiteUnderPct;
    KH.ETSY.offsiteAds.overThresholdPct = defaults.etsy.offsiteOverPct;
    KH.ETSY.offsiteAds.thresholdUSD = defaults.etsy.offsiteThresholdUSD;
    KH.FX.USD_TRY = defaults.fx.USD_TRY;
    KH.FX.EUR_TRY = defaults.fx.EUR_TRY;
  }

  function init(KH) {
    defaults = captureDefaults(KH);
    overrides = loadRaw();
    applyOverrides(KH, overrides);
    return { defaults: defaults, overrides: overrides };
  }

  // Tek bir alanı günceller. rawValue boş/NaN ise o override SİLİNİR (alan
  // tekrar fabrika değerine döner) — "temizle = varsayılana dön" deseni,
  // her alan için ayrı bir sıfırlama düğmesi gerektirmeden.
  function setValue(KH, section, key, subKey, rawValue) {
    var bucket = overrides[section];
    var empty = isEmptyValue(rawValue);
    if (subKey != null) {
      if (empty) {
        if (bucket && bucket[key]) {
          delete bucket[key][subKey];
          if (Object.keys(bucket[key]).length === 0) delete bucket[key];
        }
      } else {
        if (!bucket) { bucket = {}; overrides[section] = bucket; }
        if (!bucket[key]) bucket[key] = {};
        bucket[key][subKey] = rawValue;
      }
    } else {
      if (empty) {
        if (bucket) delete bucket[key];
      } else {
        if (!bucket) { bucket = {}; overrides[section] = bucket; }
        bucket[key] = rawValue;
      }
    }
    if (overrides[section] && Object.keys(overrides[section]).length === 0) delete overrides[section];
    saveRaw(overrides);
    restoreFactory(KH);
    applyOverrides(KH, overrides);
  }

  function resetSection(KH, section) {
    delete overrides[section];
    saveRaw(overrides);
    restoreFactory(KH);
    applyOverrides(KH, overrides);
  }

  function resetAll(KH) {
    overrides = {};
    saveRaw(overrides);
    restoreFactory(KH);
  }

  function getDefaults() { return defaults; }
  function getOverrides() { return overrides; }
  function hasAnyOverrides() { return Object.keys(overrides).length > 0; }
  function sectionHasOverrides(section) {
    return !!(overrides[section] && Object.keys(overrides[section]).length > 0);
  }

  var KHSettings = {
    STORAGE_KEY: STORAGE_KEY,
    captureDefaults: captureDefaults,
    applyOverrides: applyOverrides,
    restoreFactory: restoreFactory,
    init: init,
    setValue: setValue,
    resetSection: resetSection,
    resetAll: resetAll,
    getDefaults: getDefaults,
    getOverrides: getOverrides,
    hasAnyOverrides: hasAnyOverrides,
    sectionHasOverrides: sectionHasOverrides
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KHSettings;
  } else {
    root.KHSettings = KHSettings;
  }
})(typeof window !== 'undefined' ? window : this);
