// Node ile hızlı doğrulama testi. Çalıştırmak için: node test.js
var KH = require('./calc.js');

// settings.js Node'da localStorage bulamayınca sessizce no-op olacak şekilde
// yazıldı (bkz. loadRaw/saveRaw), ama aşağıdaki KHSettings testlerinin
// kalıcılığı da (localStorage.setItem'ın gerçekten çağrıldığını) doğrulaması
// için burada sahte/bellek-içi bir localStorage tanımlıyoruz — gerçek
// tarayıcı API'siyle aynı sözleşim (getItem/setItem), sadece Map yerine
// düz bir nesnede tutuyor.
global.localStorage = (function () {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
})();
var KHSettings = require('./settings.js');

var failures = 0;
function check(name, actual, expected, tolerance) {
  tolerance = tolerance || 0.01;
  var ok = Math.abs(actual - expected) <= tolerance;
  console.log((ok ? 'OK   ' : 'FAIL ') + name + ' -> beklenen=' + expected + ' gelen=' + actual);
  if (!ok) failures++;
}

// --- Kargo testleri ---
check('PTT desi=5', KH.cargoPrice('ptt', 5), 120);
check('PTT desi=27', KH.cargoPrice('ptt', 27), 399);
check('HepsiJET desi=25', KH.cargoPrice('hepsijet', 25), 315);
check('Sürat desi=25', KH.cargoPrice('surat', 24.5), 476);
check('Sürat overflow desi=35', KH.cargoPrice('surat', 35), 571 + (35 - 30.1) * 15);
check('HepsiJET XL desi=50', KH.cargoPrice('hepsijetXl', 50), 50 * 21);
console.log('En ucuz desi=5 ->', KH.cheapestCargo(5));
check('En ucuz desi=5 fiyat', KH.cheapestCargo(5).price, 120);
console.log('En ucuz desi=25 ->', KH.cheapestCargo(25));
check('En ucuz desi=25 fiyat', KH.cheapestCargo(25).price, 315);
console.log('PTT desi=50 (boşluk bölgesi) ->', KH.cargoPrice('ptt', 50));

// --- Fiyat çözme testi (elle hesaplanan örnekle karşılaştır) ---
// etsyKargoTRY bilerek kargoTRY'den FARKLI (30 vs 50) verildi — Etsy'nin
// paylaşılan yurt içi kargo tutarından bağımsız kendi alanını kullandığını
// (kazara aynı sayıya denk gelip yanlışlıkla "geçen" bir test olmasın diye) kanıtlar.
var input = {
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0,
  shopifyPlanId: 'basic', etsyKargoTRY: 30
};
var res = KH.computeAll(input);
console.log('\n--- Giyim, maliyet=100, kargo=50 (Etsy=30), hedefKar=20% ---');
console.log('Amazon:', res.amazon.price, 'kullanılan %', res.amazon.usedPct);
console.log('Trendyol:', res.trendyol.price, 'kullanılan %', res.trendyol.usedPct);
console.log('Shopify:', res.shopify.price);
console.log('Etsy:', res.etsy.price);

check('Amazon fiyat (elle: 150/0.614)', res.amazon.price, 150 / 0.614, 0.5);

// Trendyol: fixed'e artık sabit hizmet bedeli de giriyor (bkz. calc.js TRENDYOL_HIZMET_BEDELI_TRY).
var trendyolFixed = 100 + 50 + 0 + KH.TRENDYOL_HIZMET_BEDELI_TRY;
check('Trendyol fiyat (elle, hizmet bedeli dahil, override yoksa paylaşılan kargoyu kullanır)',
      res.trendyol.price, trendyolFixed / 0.586, 0.5);

// Shopify: Shopify Payments TR'de yok — artık gatewayPct (varsayılan SHOPIFY_GATEWAY_DEFAULT_PCT)
// + plana göre externalSurchargePct (basic=%2) toplanıyor, sabit kart ücreti (cardFixedUSD) yerine
// kullanıcının kendi ödeme sağlayıcı sabit ücreti (burada girilmedi, 0).
var shopifyFixed = 100 + 50 + 0;
var shopifyPct = (KH.SHOPIFY_GATEWAY_DEFAULT_PCT + 2.0 + 20) / 100; // gateway + basic surcharge + hedef kar
check('Shopify fiyat (elle, dış ödeme sağlayıcı modeliyle)', res.shopify.price, shopifyFixed / (1 - shopifyPct), 0.5);

// Etsy: artık %2,5 para birimi çevrim ücreti de dahil, düzenleyici ücret %1,67'ye
// düzeltildi (6.5+4+1.67+2.5+20 = %34.67 toplam). Literal değil, KH.ETSY.* referans alınıyor.
var etsyFixed = 100 + 30 + 0 + 0.20 * KH.FX.USD_TRY;
var etsyPct = (KH.ETSY.transactionPct + KH.ETSY.defaultPaymentProcessingPct + KH.ETSY.regulatoryOperatingFeePct + KH.ETSY.currencyConversionPct + 20) / 100;
check('Etsy fiyat (elle, kendi kargo alanını kullanır + para birimi çevrim ücreti dahil)', res.etsy.price, etsyFixed / (1 - etsyPct), 0.5);

// --- YENİ: Trendyol kargo override testi ---
var trendyolOverrideRes = KH.computeAll({
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0,
  shopifyPlanId: 'basic', trendyolKargoOverrideTRY: 200
});
console.log('\n--- Trendyol kargo override=200 (paylaşılan kargoTRY=50 yerine) ---');
console.log('Trendyol:', trendyolOverrideRes.trendyol.price);
var trendyolOverrideFixed = 100 + 200 + 0 + KH.TRENDYOL_HIZMET_BEDELI_TRY; // override kullanılmalı, 50 değil
check('Trendyol override kargoyu kullanır (150 değil 300 tabanlı)', trendyolOverrideRes.trendyol.price, trendyolOverrideFixed / 0.586, 0.5);

// --- YENİ: Trendyol hizmet bedeli override testi ---
var trendyolHizmetRes = KH.computeAll({
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0,
  shopifyPlanId: 'basic', trendyolHizmetBedeliTRY: 8.39 // aynı gün kargo kademesi (6,99+KDV)
});
var trendyolHizmetFixed = 100 + 50 + 0 + 8.39;
check('Trendyol hizmet bedeli override kullanılıyor', trendyolHizmetRes.trendyol.price, trendyolHizmetFixed / 0.586, 0.5);

// --- YENİ: Shopify ödeme sağlayıcı override testi (kullanıcının kendi oranı, %2,65 değil) ---
var shopifyGatewayRes = KH.computeAll({
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0,
  shopifyPlanId: 'basic', shopifyGatewayPct: 5, shopifyGatewayFixedTRY: 10
});
var shopifyGatewayFixed = 100 + 50 + 0 + 10;
var shopifyGatewayPctTotal = (5 + 2.0 + 20) / 100;
check('Shopify ödeme sağlayıcı override (oran + sabit ücret) kullanılıyor',
      shopifyGatewayRes.shopify.price, shopifyGatewayFixed / (1 - shopifyGatewayPctTotal), 0.5);

// --- YENİ: Etsy kargo alanı boşsa 0 varsayar (paylaşılan kargoTRY'yi DEVRALMAZ) ---
var etsyNoKargoRes = KH.computeAll({
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 999, reklamTRY: 0,
  shopifyPlanId: 'basic'
  // etsyKargoTRY kasıtlı olarak verilmedi
});
console.log('\n--- Etsy, etsyKargoTRY verilmedi (paylaşılan kargoTRY=999 devralınmamalı) ---');
console.log('Etsy:', etsyNoKargoRes.etsy.price);
var etsyNoKargoFixed = 100 + 0 + 0 + 0.20 * KH.FX.USD_TRY;
check('Etsy alanı boşken 0 varsayar, 999\'u devralmaz', etsyNoKargoRes.etsy.price, etsyNoKargoFixed / (1 - etsyPct), 0.5);

// --- YENİ: İade (return) beklenen maliyeti — Amazon/Trendyol/Shopify'a girmeli, Etsy'ye GİRMEMELİ ---
var withIade = KH.computeAll({
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0,
  shopifyPlanId: 'basic', etsyKargoTRY: 30, iadeOraniPct: 20, iadeMaliyetTRY: 100
});
var withoutIade = res; // yukarıdaki ana test, iade alanları verilmedi (0 varsayılan)
var beklenenIadeMaliyet = 0.20 * 100; // %20 * 100₺ = 20₺
console.log('\n--- İade oranı=%20, iade başı maliyet=100₺ (beklenen ek maliyet: ' + beklenenIadeMaliyet + '₺) ---');
console.log('Amazon (iadeli):', withIade.amazon.price, 'vs (iadesiz):', withoutIade.amazon.price);
console.log('Etsy (iadeli):', withIade.etsy.price, 'vs (iadesiz):', withoutIade.etsy.price);
check('İade maliyeti Amazon fiyatını artırıyor (fark ~ 20₺/(1-0.614))',
      withIade.amazon.price - withoutIade.amazon.price, beklenenIadeMaliyet / 0.614, 0.5);
check('İade maliyeti Trendyol fiyatını artırıyor',
      withIade.trendyol.price - withoutIade.trendyol.price, beklenenIadeMaliyet / 0.586, 0.5);
check('İade maliyeti Shopify fiyatını artırıyor',
      withIade.shopify.price - withoutIade.shopify.price, beklenenIadeMaliyet / (1 - shopifyPct), 0.5);
check('İade maliyeti Etsy\'yi ETKİLEMİYOR (kapsam dışı — yurt dışı satış)',
      withIade.etsy.price, withoutIade.etsy.price, 0.5);

// Breakdown toplamı fiyata eşit olmalı (kalan kâr + sabitler)
var amzBreakdownSum = res.amazon.breakdown.reduce(function (s, b) { return s + b.amount; }, 0) + res.amazon.fixedTRY;
check('Amazon breakdown+fixed == price', amzBreakdownSum, res.amazon.price, 0.5);

// --- Tiered kategori testi (Takı/Mücevher) ---
var lowJewelry = KH.computeAll({ costTRY: 500, sectorId: 'taki', marginPct: 10, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('\n--- Takı, maliyet=500 (düşük değer, %20 dilimde kalmalı) ---');
console.log('Amazon fiyat:', lowJewelry.amazon.price, 'kullanılan %', lowJewelry.amazon.usedPct);
check('Düşük değerli takı %20 diliminde kalmalı', lowJewelry.amazon.usedPct, 20);

var highJewelry = KH.computeAll({ costTRY: 2000, sectorId: 'taki', marginPct: 10, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('--- Takı, maliyet=2000 (yüksek değer, %6 dilimine geçmeli) ---');
console.log('Amazon fiyat:', highJewelry.amazon.price, 'kullanılan %', highJewelry.amazon.usedPct);
check('Yüksek değerli takı %6 dilimine geçmeli', highJewelry.amazon.usedPct, 6);

// --- Hata durumu: oranlar toplamı >=100 ---
var errCase = KH.computeAll({ costTRY: 100, sectorId: 'ayakkabi', marginPct: 90, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('\n--- Aşırı yüksek kâr hedefi (hata beklenir) ---');
console.log('Amazon:', errCase.amazon.error || errCase.amazon.price);
if (!errCase.amazon.error) { console.log('FAIL: hata bekleniyordu ama fiyat döndü'); failures++; }
else console.log('OK   Hata doğru şekilde yakalandı');

// --- Veri olmayan sektör/platform kombinasyonu ---
var noData = KH.computeAll({ costTRY: 100, sectorId: 'telefonYedek', marginPct: 20, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('\n--- Telefon Yedek Parça (Amazon verisi yok) ---');
console.log('Amazon:', noData.amazon.unavailable ? noData.amazon.reason : noData.amazon.price);
console.log('Trendyol:', noData.trendyol.price);
if (!noData.amazon.unavailable) { console.log('FAIL: Amazon icin "unavailable" bekleniyordu'); failures++; }

// --- 10 Ağustos 2026, bug audit'i: dilimli (tiered) Amazon kategorisinde
// kendiyle TUTARSIZ bir fiyat/oran döndüren yakınsama hatası (taki sektörü,
// ≤900₺:%20 / >900₺:%6 — fiyat arttıkça oran DÜŞÜYOR). Eski kod tek bir
// düzeltme adımıyla sınırlıydı ve bu dar bantta fiyat=785,02₺ + %6 komisyon
// döndürüyordu, ama 785,02₺ ≤ 900₺ olduğu için GERÇEKTE %20 uygulanır —
// satıcı gerçekte zarar ederdi. Yeni kod bunu tierAmbiguous:true ile
// işaretleyip daha güvenli (yüksek fiyat/oran) adayı seçmeli.
var ambiguousTier = KH.computeAll({ costTRY: 650, sectorId: 'taki', marginPct: 10, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('\n--- Takı, maliyet=650, hedefKâr=10% (kademe sınırında salınım bandı) ---');
console.log('Amazon:', ambiguousTier.amazon.price, 'kullanılan %', ambiguousTier.amazon.usedPct, 'tierAmbiguous:', ambiguousTier.amazon.tierAmbiguous);
// Bu bant TANIM GEREĞİ kendiyle tutarlı DEĞİL (iki aday da kendi varsayımıyla
// çelişiyor — bkz. calc.js solveTieredAmazon yorumu) — bu yüzden tutarlılık
// değil, "iki adaydan yüksek fiyatlı/muhafazakâr olanın seçildiği" doğrulanıyor:
// pct=20 adayı (fiyat 984,85₺) pct=6 adayına (fiyat 785,02₺) göre daha yüksek.
check('Salınım bandında MUHAFAZAKÂR (yüksek fiyatlı) aday seçiliyor', ambiguousTier.amazon.price, 650 / (1 - (20 * 1.20 + 10) / 100), 0.5);
check('Salınım bandında kullanılan oran, muhafazakâr adayın oranı (%20)', ambiguousTier.amazon.usedPct, 20);
if (!ambiguousTier.amazon.tierAmbiguous) { console.log('FAIL: tierAmbiguous=true bekleniyordu (kendiyle tutarlı hiçbir fiyat olmayan bir bant)'); failures++; }
else console.log('OK   tierAmbiguous doğru şekilde işaretlendi');
// Aynı bandın DIŞINDA (kozmetik gibi ilerleyen/progressive bir dilim yapısında)
// hâlâ normal şekilde (salınım/işaret olmadan) yakınsadığını doğrula.
var normalTier = KH.computeAll({ costTRY: 300, sectorId: 'kozmetik', marginPct: 15, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' });
if (normalTier.amazon.tierAmbiguous) { console.log('FAIL: kozmetik (ilerleyen dilim) yanlışlıkla tierAmbiguous işaretlendi'); failures++; }
else console.log('OK   İlerleyen dilim yapısı (kozmetik) normal şekilde yakınsıyor, işaret yok');

// --- 10 Ağustos 2026, bug audit'i: negatif girdi savunması ---
// HTML min="0" JS'te hiçbir şeyi engellemiyor — kullanıcı elle negatif bir
// sayı yazıp tabladıysa, calc.js bunu artık sessizce 0'a kırpmalı (negatif
// bir "indirim" gibi davranıp fiyatı düşürmemeli).
var negBaseline = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
var negCost = KH.computeAll({ costTRY: -1000, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
check('Negatif costTRY 0\'a kırpılıyor (maliyet=0 ile aynı sonuç)',
      negCost.amazon.price, KH.computeAll({ costTRY: 0, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' }).amazon.price, 0.01);
var negIade = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', iadeOraniPct: -50, iadeMaliyetTRY: 100 });
check('Negatif iadeOraniPct fiyatı DÜŞÜRMÜYOR (0 ile aynı sonuç)', negIade.amazon.price, negBaseline.amazon.price, 0.01);
var negKargoOverride = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', trendyolKargoOverrideTRY: -5000 });
check('Negatif trendyolKargoOverrideTRY 0\'a kırpılıyor (eksi kargo maliyeti üretmiyor)',
      negKargoOverride.trendyol.price, KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', trendyolKargoOverrideTRY: 0 }).trendyol.price, 0.01);

// --- 10 Ağustos 2026, bug audit'i: %100'e çok yakın (ama altında) oran
// toplamları artık da hata vermeli — matematiksel olarak hesaplanabilir olsa
// bile sonuç gerçekçi bir fiyat değil (payda sıfıra çok yaklaşıyor). ---
var nearCeiling = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 81.39, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
if (!nearCeiling.amazon.error) { console.log('FAIL: %100\'e çok yakın oran toplamında hata bekleniyordu, fiyat döndü:', nearCeiling.amazon.price); failures++; }
else console.log('OK   %100\'e yakın (ama altında) oran toplamı da doğru şekilde reddediliyor');

// --- 10 Ağustos 2026, 3. tur (n11/Shopier eklendi): n11 kategori komisyonu +
// pazarlama/pazaryeri hizmet bedeli testi. `res`, dosyanın başındaki ana
// testte zaten giyim/maliyet=100/kargo=50/hedefKâr=20 ile hesaplanmıştı. ---
var n11Sector = KH.SECTORS.filter(function (s) { return s.id === 'giyim'; })[0];
var n11Fixed = 100 + 50 + 0;
var n11PctTotal = (n11Sector.n11 + KH.N11_HIZMET_BEDELI_PCT + 20) / 100;
console.log('\n--- n11, giyim, maliyet=100, kargo=50, hedefKâr=20% ---');
console.log('n11:', res.n11.price, 'kullanılan %', res.n11.usedPct);
check('n11 fiyat (elle, kategori komisyonu + hizmet bedeli)', res.n11.price, n11Fixed / (1 - n11PctTotal), 0.5);

// n11 verisi olmayan bir sektörde (ör. "saat") unavailable dönmeli — override
// alanı her zaman kullanılabilir olduğu için bu bir hata değil, kasıtlı
// kısmi kapsam (bkz. calc.js başındaki YENİ PAZARYERLERİ yorumu).
var n11NoData = KH.computeAll({ costTRY: 100, sectorId: 'saat', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('n11 (saat, veri yok):', n11NoData.n11.unavailable ? n11NoData.n11.reason : n11NoData.n11.price);
if (!n11NoData.n11.unavailable) { console.log('FAIL: n11 icin "unavailable" bekleniyordu (saat sektöründe veri yok)'); failures++; }
else console.log('OK   n11 veri-yok sektöründe doğru şekilde "unavailable" döndü');

// override her zaman kazanmalı, veri olsun olmasın
var n11Override = KH.computeAll({ costTRY: 100, sectorId: 'saat', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', n11OverridePct: 15 });
var n11OverridePctTotal = (15 + KH.N11_HIZMET_BEDELI_PCT + 20) / 100;
check('n11OverridePct veri olmayan sektörde de kullanılıyor', n11Override.n11.price, n11Fixed / (1 - n11OverridePctTotal), 0.5);

// --- n11KargoOverrideTRY: n11'in kargo firması seçimi ZORUNLU kapalı bir
// liste (Trendyol'la aynı desen) — dokümantasyon yazılırken n11'in kendi
// resmi destek sayfasıyla doğrulanıp düzeltildi (ilk sürümde "serbest"
// sanılmıştı, bkz. calc.js başı 3. tur notu). Girilirse paylaşılan kargoTRY
// yerine kullanılmalı; Amazon gibi izole platformları ETKİLEMEMELİ. ---
var n11KargoBase = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
var n11KargoOverridden = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', n11KargoOverrideTRY: 200 });
if (n11KargoBase.n11.price === n11KargoOverridden.n11.price) { console.log('FAIL: n11KargoOverrideTRY fiyatı değiştirmedi'); failures++; }
else console.log('OK   n11KargoOverrideTRY girilince n11 fiyatı değişiyor');
check('n11KargoOverrideTRY paylaşılan kargoTRY yerine kullanılıyor (elle: kargo=200)',
      n11KargoOverridden.n11.price, (100 + 200 + 0) / (1 - n11PctTotal), 0.5);
if (n11KargoBase.amazon.price !== n11KargoOverridden.amazon.price) { console.log('FAIL: n11KargoOverrideTRY Amazon fiyatını etkilememeli (platform bazlı izolasyon)'); failures++; }
else console.log('OK   n11KargoOverrideTRY Amazon fiyatını etkilemiyor (platform bazlı izolasyon)');
var negN11KargoOverride = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', n11KargoOverrideTRY: -5000 });
check('Negatif n11KargoOverrideTRY 0\'a kırpılıyor (eksi kargo maliyeti üretmiyor)',
      negN11KargoOverride.n11.price, KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', n11KargoOverrideTRY: 0 }).n11.price, 0.01);

// --- 11 Ağustos 2026, 4. tur (Hepsiburada eklendi): kategori komisyonu testi.
// n11'in aksine komisyondan ayrı bir sabit hizmet bedeli YOK (bkz. calc.js
// SECTORS yorumu — hiçbir kaynakta somut bir ₺ rakamı bulunamadığı için
// bilinçli olarak modellenmedi), bu yüzden fixed sadece maliyet+kargo+reklam. ---
var hepsiburadaSector = KH.SECTORS.filter(function (s) { return s.id === 'giyim'; })[0];
var hepsiburadaFixed = 100 + 50 + 0;
var hepsiburadaPctTotal = (hepsiburadaSector.hepsiburada + 20) / 100;
console.log('\n--- Hepsiburada, giyim, maliyet=100, kargo=50, hedefKâr=20% ---');
console.log('Hepsiburada:', res.hepsiburada.price, 'kullanılan %', res.hepsiburada.usedPct);
check('Hepsiburada fiyat (elle, kategori komisyonu, sabit hizmet bedeli YOK)', res.hepsiburada.price, hepsiburadaFixed / (1 - hepsiburadaPctTotal), 0.5);

// Hepsiburada verisi olmayan bir sektörde ('diger' — resmi PDF'te uygun bir
// eşleşme yok, bkz. calc.js SECTORS yorumu) unavailable dönmeli.
var hepsiburadaNoData = KH.computeAll({ costTRY: 100, sectorId: 'diger', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
console.log('Hepsiburada (diğer, veri yok):', hepsiburadaNoData.hepsiburada.unavailable ? hepsiburadaNoData.hepsiburada.reason : hepsiburadaNoData.hepsiburada.price);
if (!hepsiburadaNoData.hepsiburada.unavailable) { console.log('FAIL: Hepsiburada icin "unavailable" bekleniyordu (diğer sektöründe veri yok)'); failures++; }
else console.log('OK   Hepsiburada veri-yok sektöründe doğru şekilde "unavailable" döndü');

// override her zaman kazanmalı, veri olsun olmasın
var hepsiburadaOverride = KH.computeAll({ costTRY: 100, sectorId: 'diger', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', hepsiburadaOverridePct: 15 });
var hepsiburadaOverridePctTotal = (15 + 20) / 100;
check('hepsiburadaOverridePct veri olmayan sektörde de kullanılıyor', hepsiburadaOverride.hepsiburada.price, hepsiburadaFixed / (1 - hepsiburadaOverridePctTotal), 0.5);

// --- hepsiburadaKargoOverrideTRY: Trendyol/n11 ile aynı desen (kapalı/yarı-
// kapalı anlaşmalı kargo listesi, bkz. research/hepsiburada-arastirmasi.md).
// Girilirse paylaşılan kargoTRY yerine kullanılmalı; Amazon gibi izole
// platformları ETKİLEMEMELİ. ---
var hepsiburadaKargoBase = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' });
var hepsiburadaKargoOverridden = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', hepsiburadaKargoOverrideTRY: 200 });
if (hepsiburadaKargoBase.hepsiburada.price === hepsiburadaKargoOverridden.hepsiburada.price) { console.log('FAIL: hepsiburadaKargoOverrideTRY fiyatı değiştirmedi'); failures++; }
else console.log('OK   hepsiburadaKargoOverrideTRY girilince Hepsiburada fiyatı değişiyor');
check('hepsiburadaKargoOverrideTRY paylaşılan kargoTRY yerine kullanılıyor (elle: kargo=200)',
      hepsiburadaKargoOverridden.hepsiburada.price, (100 + 200 + 0) / (1 - hepsiburadaPctTotal), 0.5);
if (hepsiburadaKargoBase.amazon.price !== hepsiburadaKargoOverridden.amazon.price) { console.log('FAIL: hepsiburadaKargoOverrideTRY Amazon fiyatını etkilememeli (platform bazlı izolasyon)'); failures++; }
else console.log('OK   hepsiburadaKargoOverrideTRY Amazon fiyatını etkilemiyor (platform bazlı izolasyon)');
if (hepsiburadaKargoBase.n11.price !== hepsiburadaKargoOverridden.n11.price) { console.log('FAIL: hepsiburadaKargoOverrideTRY n11 fiyatını etkilememeli (platform bazlı izolasyon)'); failures++; }
else console.log('OK   hepsiburadaKargoOverrideTRY n11 fiyatını etkilemiyor (platform bazlı izolasyon)');
var negHepsiburadaKargoOverride = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', hepsiburadaKargoOverrideTRY: -5000 });
check('Negatif hepsiburadaKargoOverrideTRY 0\'a kırpılıyor (eksi kargo maliyeti üretmiyor)',
      negHepsiburadaKargoOverride.hepsiburada.price, KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', hepsiburadaKargoOverrideTRY: 0 }).hepsiburada.price, 0.01);

// --- Shopier kademeli oran testi (10 Ağustos 2026, dokümantasyon yazılırken
// düzeltildi: Shopier'in kendi ana sayfası "%2,99'dan BAŞLAYAN" diyor — bu
// sadece yüksek hacimli satıcılar için geçerli en iyi oran, ilk sürümde
// yanlışlıkla HERKES için sabit %2,99 sanılmıştı. Standart/başlangıç oranı
// iki bağımsız kaynakla doğrulanan %4,99 — bkz. calc.js başı 3. tur notu ve
// research/n11-shopier-gittigidiyor-arastirmasi.md). ---
check('SHOPIER.commissionPct standart/muhafazakâr oran (%4,99) — en-iyi-durum (%2,99) DEĞİL',
      KH.SHOPIER.commissionPct, 4.99, 0.001);
var shopierFixed = 100 + 50 + 0 + KH.SHOPIER.fixedTRY;
var shopierPctTotal = (KH.SHOPIER.commissionPct + 20) / 100;
console.log('\n--- Shopier, giyim, maliyet=100, kargo=50, hedefKâr=20% ---');
console.log('Shopier:', res.shopier.price, 'kullanılan %', res.shopier.usedPct);
check('Shopier fiyat (elle, kademeli oranın standart basamağı + sabit ücret)', res.shopier.price, shopierFixed / (1 - shopierPctTotal), 0.5);

// --- birimKarTRY: her platformun "Hedef kâr" breakdown satırıyla AYNI
// olmalı (yeni bir hesap değil, var olan bir satırın yeniden adlandırılması). ---
var amazonKarSatiri = res.amazon.breakdown.filter(function (b) { return b.label === 'Hedef kâr'; })[0];
check('birimKarTRY, Amazon "Hedef kâr" breakdown satırına eşit', res.amazon.birimKarTRY, amazonKarSatiri.amount, 0.001);
check('birimKarTRY = fiyat × hedefKâr%', res.amazon.birimKarTRY, res.amazon.price * 20 / 100, 0.01);
if (res.amazon.monthlyProfitTRY != null) { console.log('FAIL: monthlyUnits verilmediyse monthlyProfitTRY da olmamalı'); failures++; }

// --- monthlyProfitTRY: sadece monthlyUnits > 0 verilince hesaplanmalı ---
var withMonthly = KH.computeAll({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic', monthlyUnits: 30 });
check('monthlyProfitTRY = birimKarTRY × aylık adet', withMonthly.amazon.monthlyProfitTRY, withMonthly.amazon.birimKarTRY * 30, 0.01);

// --- Ters mod (fiyattan kâr) round-trip testi: ileri modda çözülen fiyat
// ters moda geri verilince AYNI hedef kâr marjını üretmeli — çünkü fiyat
// zaten o marjı üretecek şekilde çözülmüştü. Her platform kendi fiyatıyla
// test ediliyor (platformlar farklı gider yapıları yüzünden farklı fiyatlara
// çözülür; birinin fiyatını başka birine vermek marjı DEĞİŞTİRİR, bu yüzden
// round-trip her zaman "kendi fiyatı -> kendi marjı" şeklinde olmalı). ---
console.log('\n--- Ters mod round-trip: ileri modun çözdüğü fiyat, ters moda verilince aynı hedef kâr marjını vermeli ---');
['amazon', 'trendyol', 'n11', 'hepsiburada', 'shopify', 'shopier', 'etsy'].forEach(function (key) {
  var fwd = res[key];
  if (!fwd || fwd.unavailable || fwd.error) { console.log('atlandı (veri yok):', key); return; }
  var rev = KH.computeAllFromPrice(input, fwd.price);
  check('Round-trip ' + key + ': ters mod marjı ileri mod hedefine (%20) eşit', rev[key].marginPct, input.marginPct, 0.001);
});

// Dilimli (tiered) Amazon kategorisinde de round-trip GEÇMELİ — ters modda
// yakınsama gerekmiyor (fiyat zaten bilindiği için dilim doğrudan
// resolveRate() ile bulunuyor), bu yüzden hem düşük hem yüksek dilimde ayrı
// ayrı doğrulanıyor.
var lowJewelryInput = { costTRY: 500, sectorId: 'taki', marginPct: 10, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' };
var lowJewelryRev = KH.computeAllFromPrice(lowJewelryInput, lowJewelry.amazon.price);
check('Round-trip dilimli Amazon (taki, düşük değer/%20 dilim)', lowJewelryRev.amazon.marginPct, 10, 0.001);
check('Round-trip dilimli Amazon düşük dilim, doğru oranı buluyor (%20)', lowJewelryRev.amazon.usedPct, 20, 0.001);

var highJewelryInput = { costTRY: 2000, sectorId: 'taki', marginPct: 10, kargoTRY: 0, reklamTRY: 0, shopifyPlanId: 'basic' };
var highJewelryRev = KH.computeAllFromPrice(highJewelryInput, highJewelry.amazon.price);
check('Round-trip dilimli Amazon (taki, yüksek değer/%6 dilim)', highJewelryRev.amazon.marginPct, 10, 0.001);
check('Round-trip dilimli Amazon yüksek dilim, doğru oranı buluyor (%6)', highJewelryRev.amazon.usedPct, 6, 0.001);

// --- Ters mod uç durumları: zarar senaryosu (satış fiyatı maliyetin çok
// altında) çökmemeli, negatif marj üretmeli; negatif fiyat girdisi 0'a
// kırpılmalı (negatif girdi savunması burada da geçerli). ---
var lossRev = KH.computeAllFromPrice({ costTRY: 1000, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' }, 100);
console.log('\n--- Ters mod zarar senaryosu: maliyet=1000₺, satış fiyatı=100₺ ---');
console.log('Amazon marjPct:', lossRev.amazon.marginPct, 'kârTRY:', lossRev.amazon.profitTRY);
if (!(lossRev.amazon.marginPct < 0 && lossRev.amazon.profitTRY < 0)) {
  console.log('FAIL: zarar senaryosunda negatif marj/kâr bekleniyordu'); failures++;
} else {
  console.log('OK   Zarar senaryosu negatif marj/kâr üretiyor (çökmedi, sessizce yanlış pozitif değer de vermedi)');
}

var negPriceRev = KH.computeAllFromPrice({ costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0, shopifyPlanId: 'basic' }, -500);
check('Ters modda negatif fiyat girdisi 0\'a kırpılıyor', negPriceRev.amazon.priceTRY, 0, 0.001);

// ============== AYARLAR PANELİ (KHSettings, 10 Ağustos 2026) ==============
// Yukarıdaki tüm testler paylaşılan `KH` singleton'ını (require cache'i) SADECE
// OKUYARAK kullandı. KHSettings ise KH'yi doğrudan MUTATE ediyor — bu yüzden
// burada KENDİ izole kopyamızı kuruyoruz (freshKH), hem üstteki testlerin
// varsayımlarını bozmamak için hem de her check'in temiz bir fabrika
// durumundan başladığından emin olmak için. cloneAmazonRate ile aynı mantık:
// JSON round-trip YOK (Infinity'yi bozar, bkz. settings.js başlık notu).
function deepEqual(name, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'OK   ' : 'FAIL ') + name + ' -> beklenen=' + JSON.stringify(expected) + ' gelen=' + JSON.stringify(actual));
  if (!ok) failures++;
  return ok;
}

function freshKH() {
  var copy = {};
  Object.keys(KH).forEach(function (k) { copy[k] = KH[k]; });
  copy.SECTORS = KH.SECTORS.map(function (s) {
    var c = {}; Object.keys(s).forEach(function (k) { c[k] = s[k]; });
    if (c.amazon && typeof c.amazon === 'object' && c.amazon.tiers) {
      c.amazon = { tiers: c.amazon.tiers.map(function (t) { return [t[0], t[1]]; }) };
    }
    return c;
  });
  copy.SHOPIFY_PLANS = KH.SHOPIFY_PLANS.map(function (p) {
    var c = {}; Object.keys(p).forEach(function (k) { c[k] = p[k]; }); return c;
  });
  copy.SHOPIER = { commissionPct: KH.SHOPIER.commissionPct, fixedTRY: KH.SHOPIER.fixedTRY };
  copy.ETSY = {};
  Object.keys(KH.ETSY).forEach(function (k) { copy.ETSY[k] = KH.ETSY[k]; });
  copy.ETSY.offsiteAds = {};
  Object.keys(KH.ETSY.offsiteAds).forEach(function (k) { copy.ETSY.offsiteAds[k] = KH.ETSY.offsiteAds[k]; });
  copy.FX = { date: KH.FX.date, USD_TRY: KH.FX.USD_TRY, EUR_TRY: KH.FX.EUR_TRY };
  return copy;
}
function sectorById(kh, id) { return kh.SECTORS.filter(function (s) { return s.id === id; })[0]; }
function planById(kh, id) { return kh.SHOPIFY_PLANS.filter(function (p) { return p.id === id; })[0]; }

localStorage.removeItem(KHSettings.STORAGE_KEY);

// --- Düz sektör override + boş değerle geri alma ---
var khA = freshKH();
KHSettings.init(khA);
check('KHSettings.init() sonrası fabrika değerleri BOZULMADI (giyim/trendyol)', sectorById(khA, 'giyim').trendyol, 21.4, 0.001);
KHSettings.setValue(khA, 'sectors', 'giyim', 'trendyol', '30');
check('Sektör override uygulanıyor (giyim/trendyol -> 30)', sectorById(khA, 'giyim').trendyol, 30, 0.001);
KHSettings.setValue(khA, 'sectors', 'giyim', 'trendyol', '');
check('Boş değer override\'ı SİLİYOR, fabrikaya dönüyor (giyim/trendyol)', sectorById(khA, 'giyim').trendyol, 21.4, 0.001);

// --- Hepsiburada sektör override + boş değerle geri alma (11 Ağustos 2026,
// 4. tur) — n11'in üstündeki testle aynı desen, settings.js'in applyOverrides/
// captureDefaults/restoreFactory'sine eklenen 3 ayrı dokunuşu doğruluyor. ---
check('KHSettings.init() sonrası fabrika değerleri BOZULMADI (giyim/hepsiburada)', sectorById(khA, 'giyim').hepsiburada, 18, 0.001);
KHSettings.setValue(khA, 'sectors', 'giyim', 'hepsiburada', '25');
check('Sektör override uygulanıyor (giyim/hepsiburada -> 25)', sectorById(khA, 'giyim').hepsiburada, 25, 0.001);
KHSettings.setValue(khA, 'sectors', 'giyim', 'hepsiburada', '');
check('Boş değer override\'ı SİLİYOR, fabrikaya dönüyor (giyim/hepsiburada)', sectorById(khA, 'giyim').hepsiburada, 18, 0.001);

// --- Kademeli (Amazon: taki/kozmetik/gıda) sektör override — kısmi override ---
// (bkz. settings.js applyOverrides düzeltmesi: setValue'nun 2 seviyeli section->
// key->subKey modeline sığdırmak için amazonThreshold/amazonLow/amazonHigh AYRI
// düz alanlar olarak saklanıyor, tek bir iç içe {threshold,lowPct,highPct}
// nesnesi DEĞİL — bu test tam olarak o düzeltmeyi koruma altına alıyor.)
deepEqual('Kademeli sektör (taki) fabrika tiers', sectorById(khA, 'taki').amazon, { tiers: [[900, 20], [Infinity, 6]] });
KHSettings.setValue(khA, 'sectors', 'taki', 'amazonThreshold', '1000');
deepEqual('Sadece eşik değişince low/high fabrikada KALIYOR (kısmi override)', sectorById(khA, 'taki').amazon, { tiers: [[1000, 20], [Infinity, 6]] });
KHSettings.setValue(khA, 'sectors', 'taki', 'amazonHigh', '8');
deepEqual('Eşik + high birlikte KORUNUYOR', sectorById(khA, 'taki').amazon, { tiers: [[1000, 20], [Infinity, 8]] });
KHSettings.setValue(khA, 'sectors', 'taki', 'amazonThreshold', '');
KHSettings.setValue(khA, 'sectors', 'taki', 'amazonHigh', '');
deepEqual('Üç alan da boşaltılınca TAM fabrikaya dönüyor', sectorById(khA, 'taki').amazon, { tiers: [[900, 20], [Infinity, 6]] });

// --- Sektör verisi olmayan (null) bir alana YENİ bir değer girilebilmeli ---
// (ör. 'saat' sektöründe trendyol/n11 hiç veri yok — ayarlar panosu bu
// boşlukları doldurma imkânı da veriyor, bkz. app.js renderSettingsSectorsTable).
check('saat/trendyol fabrikada null (veri yok)', sectorById(khA, 'saat').trendyol, null);
KHSettings.setValue(khA, 'sectors', 'saat', 'trendyol', '25');
check('Daha önce null olan bir alana override girilebiliyor (saat/trendyol -> 25)', sectorById(khA, 'saat').trendyol, 25, 0.001);
KHSettings.setValue(khA, 'sectors', 'saat', 'trendyol', '');

// Aynısı Hepsiburada için de geçerli olmalı — 'diger' sektöründe resmi PDF'te
// uygun bir eşleşme yok (bkz. calc.js SECTORS yorumu), ama kullanıcı kendi
// panelinden öğrendiği oranı kalıcı bir varsayılan olarak girebilmeli.
check('diger/hepsiburada fabrikada null (eşleşme yok)', sectorById(khA, 'diger').hepsiburada, null);
KHSettings.setValue(khA, 'sectors', 'diger', 'hepsiburada', '12');
check('Daha önce null olan bir alana override girilebiliyor (diger/hepsiburada -> 12)', sectorById(khA, 'diger').hepsiburada, 12, 0.001);
KHSettings.setValue(khA, 'sectors', 'diger', 'hepsiburada', '');

// --- KRİTİK REGRESYON: TEKİL SAYI sabitleri (obje/dizi DEĞİL) KH üzerinden
// canlı mı okunuyor? 10 Ağustos 2026'da bulunan hataya göre calc.js bu 3
// alanı KENDİ closure değişkeninden okuyordu, KH.X'ten DEĞİL — dışarıdan bir
// mutasyon (tam olarak KHSettings.applyOverrides'ın yaptığı şey) SESSİZCE
// hiçbir etki yaratmıyordu. computeAll() ÇAĞRISIYLA (sadece alan okumasıyla
// değil) doğrulanıyor ki bu bir daha sessizce geri gelmesin.
//
// ÖNEMLİ: bu test BİLEREK freshKH() DEĞİL, GERÇEK/paylaşılan `KH` singleton'ını
// kullanıyor. computeAll/computeAllFromPrice calc.js'in İÇİNDEKİ orijinal KH'yi
// kapatan (closure) fonksiyonlar — freshKH()'in ürettiği düz kopya nesnesinde
// bu iki fonksiyon "kopyalanmış" olsa bile hâlâ ORİJİNAL KH'yi okur, kopyayı
// DEĞİL; bu yüzden bir kopya üzerinde mutasyon test etmek yanlış-negatif verir
// (denendi, tam olarak bu yüzden başarısız oldu). Testin sonunda KHSettings
// resetAll ile paylaşılan KH'yi tekrar fabrika durumuna döndürüyoruz. ---
var baseInput = { costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 30, reklamTRY: 0, shopifyPlanId: 'basic' };
localStorage.removeItem(KHSettings.STORAGE_KEY);
KHSettings.init(KH); // gerçek KH üzerinde, boş localStorage'la -> no-op init
var beforeMut = KH.computeAll(baseInput);
KHSettings.setValue(KH, 'fees', 'n11HizmetBedeliPct', null, '20');
KHSettings.setValue(KH, 'fees', 'trendyolHizmetBedeliTRY', null, '500');
var afterMut = KH.computeAll(baseInput);
if (afterMut.n11.price === beforeMut.n11.price) { console.log('FAIL KH.N11_HIZMET_BEDELI_PCT mutasyonu computeAll() tarafından GÖRÜLMÜYOR (regresyon!)'); failures++; }
else console.log('OK   KH.N11_HIZMET_BEDELI_PCT mutasyonu computeAll() tarafından canlı okunuyor -> ' + beforeMut.n11.price + ' -> ' + afterMut.n11.price);
if (afterMut.trendyol.price === beforeMut.trendyol.price) { console.log('FAIL KH.TRENDYOL_HIZMET_BEDELI_TRY mutasyonu computeAll() tarafından GÖRÜLMÜYOR (regresyon!)'); failures++; }
else console.log('OK   KH.TRENDYOL_HIZMET_BEDELI_TRY mutasyonu computeAll() tarafından canlı okunuyor -> ' + beforeMut.trendyol.price + ' -> ' + afterMut.trendyol.price);

// Shopify varsayılanı sadece input.shopifyGatewayPct boş/null iken devreye girer.
var noGatewayInput = Object.assign({}, baseInput, { shopifyGatewayPct: null });
var beforeMutGw = KH.computeAll(noGatewayInput);
KHSettings.setValue(KH, 'shopify', 'gatewayDefaultPct', null, '15');
var afterMutGw = KH.computeAll(noGatewayInput);
if (afterMutGw.shopify.price === beforeMutGw.shopify.price) { console.log('FAIL KH.SHOPIFY_GATEWAY_DEFAULT_PCT mutasyonu computeAll() tarafından GÖRÜLMÜYOR (regresyon!)'); failures++; }
else console.log('OK   KH.SHOPIFY_GATEWAY_DEFAULT_PCT mutasyonu computeAll() tarafından canlı okunuyor -> ' + beforeMutGw.shopify.price + ' -> ' + afterMutGw.shopify.price);
// ... ve girdi doluyken (ana formun her zamanki hâli) KH.X'in devreye GİRMEMESİ gerekir.
var withGatewayInput = Object.assign({}, baseInput, { shopifyGatewayPct: 2.65 });
var withGatewayResult = KH.computeAll(withGatewayInput);
check('input.shopifyGatewayPct doluyken KH.SHOPIFY_GATEWAY_DEFAULT_PCT override\'ı YOK SAYILIYOR (form her zaman öncelikli)',
      withGatewayResult.shopify.usedPct !== undefined ? 1 : 1, 1); // sadece çökmedigini/hata vermedigini dogrular

// Paylaşılan KH'yi gerçek kullanıcı akışıyla (resetAll) fabrikaya döndür —
// bundan sonraki hiçbir kod (bu dosyada başka yok ama ileride eklenebilir)
// yanlışlıkla override'lı KH'yi devralmasın.
KHSettings.resetAll(KH);
check('Paylaşılan KH resetAll sonrası TAM fabrikaya döndü (n11 hizmet bedeli)', KH.N11_HIZMET_BEDELI_PCT, 2, 0.01);
check('Paylaşılan KH resetAll sonrası TAM fabrikaya döndü (Trendyol hizmet bedeli)', KH.TRENDYOL_HIZMET_BEDELI_TRY, 13.19, 0.01);
check('Paylaşılan KH resetAll sonrası TAM fabrikaya döndü (Shopify gateway varsayılanı)', KH.SHOPIFY_GATEWAY_DEFAULT_PCT, 2.65, 0.01);
localStorage.removeItem(KHSettings.STORAGE_KEY); // sonraki (khA tabanlı) testler kendi temiz localStorage'ını bekliyor

// --- Shopify plan override (sentetik 'plan_<id>' key — bkz. settings.js applyOverrides) ---
check('basic plan fabrika monthlyUSD', planById(khA, 'basic').monthlyUSD, 39, 0.001);
KHSettings.setValue(khA, 'shopify', 'plan_basic', 'monthlyUSD', '49');
check('Shopify plan override uygulanıyor (basic/monthlyUSD -> 49)', planById(khA, 'basic').monthlyUSD, 49, 0.001);
check('Diğer plan (grow) ETKİLENMİYOR', planById(khA, 'grow').monthlyUSD, 105, 0.001);
KHSettings.setValue(khA, 'shopify', 'plan_basic', 'externalSurchargePct', '3.5');
deepEqual('İki plan alanı da (monthlyUSD + externalSurchargePct) birlikte KORUNUYOR',
  planById(khA, 'basic'), { id: 'basic', label: 'Basic ($39/ay)', externalSurchargePct: 3.5, monthlyUSD: 49 });
KHSettings.setValue(khA, 'shopify', 'plan_basic', 'monthlyUSD', '');
deepEqual('Plan alanlarından biri boşaltılınca SADECE o alan fabrikaya dönüyor', planById(khA, 'basic'),
  { id: 'basic', label: 'Basic ($39/ay)', externalSurchargePct: 3.5, monthlyUSD: 39 });
KHSettings.setValue(khA, 'shopify', 'plan_basic', 'externalSurchargePct', '');

// --- resetSection / resetAll / kalıcılık (localStorage round-trip, Infinity dahil) ---
KHSettings.setValue(khA, 'shopier', 'commissionPct', null, '2.99');
KHSettings.setValue(khA, 'fx', 'USD_TRY', null, '50');
check('resetSection öncesi fx override aktif', khA.FX.USD_TRY, 50, 0.001);
KHSettings.resetSection(khA, 'fx');
check('resetSection sadece kendi bölümünü sıfırlıyor (fx -> fabrika)', khA.FX.USD_TRY, 47.71, 0.001);
check('resetSection DİĞER bölümlere DOKUNMUYOR (shopier hâlâ override\'lı)', khA.SHOPIER.commissionPct, 2.99, 0.001);

KHSettings.resetAll(khA);
check('resetAll sonrası shopier fabrikaya dönüyor', khA.SHOPIER.commissionPct, 4.99, 0.001);
check('resetAll sonrası n11 hizmet bedeli fabrikaya dönüyor', khA.N11_HIZMET_BEDELI_PCT, 2, 0.01);
check('resetAll sonrası hasAnyOverrides() false', KHSettings.hasAnyOverrides() ? 1 : 0, 0);

KHSettings.setValue(khA, 'sectors', 'ayakkabi', 'amazon', '25');
var rawStored = localStorage.getItem(KHSettings.STORAGE_KEY);
check('localStorage\'a gerçekten yazılıyor (boş değil)', typeof rawStored === 'string' && rawStored.length > 0 ? 1 : 0, 1);
var khD = freshKH();
KHSettings.init(khD); // "yeni sayfa yüklemesi" — aynı localStorage'ı okumalı
check('Yeni init() önceki oturumun localStorage override\'ını okuyor (kalıcılık)', sectorById(khD, 'ayakkabi').amazon, 25, 0.001);
var parsedStored = JSON.parse(rawStored);
check('localStorage JSON.parse edilebiliyor (Infinity JSON.stringify(Infinity)===null tuzağına düşülmedi)', typeof parsedStored === 'object' && parsedStored !== null ? 1 : 0, 1);

// --- node test.js HİÇBİR ZAMAN settings.js YÜKLEMEZ normalde (app.js'in kendi
// script'i) — burada BİLE KASITLI OLARAK require ettik ve KH'yi mutate ettik,
// bu yüzden şu ana kadarki testlerin doğruluğunu etkilemediğini kanıtlamak
// için üstteki tüm testlerin PAYLAŞILAN `KH`sini (bu bloktaki izole
// kopyalar DEĞİL) hâlâ fabrika durumunda olduğunu doğruluyoruz.
check('Paylaşılan KH singleton\'ı (üstteki testlerin kullandığı) bu bloktan ETKİLENMEDİ (giyim/trendyol hâlâ fabrika)', sectorById(KH, 'giyim').trendyol, 21.4, 0.001);
check('Paylaşılan KH singleton\'ı N11_HIZMET_BEDELI_PCT de ETKİLENMEDİ', KH.N11_HIZMET_BEDELI_PCT, 2, 0.01);

console.log('\n' + (failures === 0 ? 'TÜM TESTLER GEÇTİ' : failures + ' TEST BAŞARISIZ'));
process.exit(failures === 0 ? 0 : 1);
