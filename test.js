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
var input = {
  costTRY: 100, sectorId: 'giyim', marginPct: 20, kargoTRY: 50, reklamTRY: 0,
  shopifyPlanId: 'basic'
};
var res = KH.computeAll(input);
console.log('\n--- Giyim, maliyet=100, kargo=50, hedefKar=20% ---');
console.log('Amazon:', res.amazon.price, 'kullanılan %', res.amazon.usedPct);
console.log('Trendyol:', res.trendyol.price, 'kullanılan %', res.trendyol.usedPct);
console.log('Shopify:', res.shopify.price);
console.log('Etsy:', res.etsy.price);

check('Amazon fiyat (elle: 150/0.614)', res.amazon.price, 150 / 0.614, 0.5);
check('Trendyol fiyat (elle: 150/0.586)', res.trendyol.price, 150 / 0.586, 0.5);

var shopifyFixed = 100 + 50 + 0 + 0.30 * KH.FX.USD_TRY;
check('Shopify fiyat (elle)', res.shopify.price, shopifyFixed / (1 - 0.229), 0.5);

var etsyFixed = 100 + 50 + 0 + 0.20 * KH.FX.USD_TRY;
check('Etsy fiyat (elle)', res.etsy.price, etsyFixed / (1 - 0.3277), 0.5);

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

console.log('\n' + (failures === 0 ? 'TÜM TESTLER GEÇTİ' : failures + ' TEST BAŞARISIZ'));
process.exit(failures === 0 ? 0 : 1);
