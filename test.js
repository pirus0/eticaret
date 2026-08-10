// Node ile hızlı doğrulama testi. Çalıştırmak için: node test.js
var KH = require('./calc.js');

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

console.log('\n' + (failures === 0 ? 'TÜM TESTLER GEÇTİ' : failures + ' TEST BAŞARISIZ'));
process.exit(failures === 0 ? 0 : 1);
