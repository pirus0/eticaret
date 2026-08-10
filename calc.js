/*
 * Kâr Marjı Hesaplayıcı - hesaplama mantığı ve veri tabloları.
 *
 * Bu dosya kasıtlı olarak DOM'a dokunmaz — hem tarayıcıda <script> ile hem de
 * Node ile (test için) çalışabilsin diye. Tüm veriler 10 Ağustos 2026'da
 * araştırılıp kaynak tarihleriyle çapraz kontrol edildi. Kaynaklar ve
 * güven seviyeleri için bkz. amazon-trendyol-shopify-komisyonlar.md ve
 * navlungo-kargo-fiyatlari.md.
 *
 * GENEL FORMÜL (tüm platformlarda aynı mantık):
 *   Satış Fiyatı (P) öyle seçilir ki:
 *     P = maliyet + kargo + reklam + sabit_ücretler + (yüzdesel_ücretler % × P) + (hedef_kâr % × P)
 *   Buradan:
 *     P = (maliyet + kargo + reklam + sabit_ücretler) / (1 - hedef_kâr% - Σ yüzdesel_ücretler%)
 *   "Kâr marjı", satış fiyatının (maliyet değil!) yüzdesi olarak tanımlanıyor —
 *   Türkiye'de "kâr marjı" genelde bu şekilde konuşulur (net kâr / satış fiyatı).
 *
 * KARGO MODELİ (platform bazlı — 10 Ağustos 2026'da araştırıldı, bkz.
 * research/platform-kargo-kisitlari.md):
 *   - Amazon ve Shopify'da satıcı kargo firmasını serbestçe seçebiliyor
 *     (Amazon için bu "satıcı-gönderimli/kendi kargonuz" senaryosu; FBA ve
 *     Amazon Kolay Gönderi farklı ücretlendirir, kapsam dışı) — bu yüzden
 *     paylaşılan `kargoTRY` (genel piyasa tablosu) doğrudan kullanılıyor.
 *   - Trendyol'da satıcı, sözleşmesindeki KAPALI bir anlaşmalı kargo
 *     listesiyle sınırlı (developers.trendyol.com'a göre 10 sabit firma).
 *     Paylaşılan `kargoTRY` varsayılan olarak kullanılıyor (yön gösterici)
 *     ama `trendyolKargoOverrideTRY` girilirse ona öncelik veriliyor —
 *     üç bağımsız kaynağın Trendyol tarifeleri arasında aynı taşıyıcı/desi
 *     için %35'e varan fark bulunduğundan tek bir sayı güvenilir değil.
 *   - Etsy satışları genelde YURT DIŞINA gider; yurt içi desi tablosu farklı
 *     bir maliyet sınıfı olduğu için hiç uygulanmıyor. Etsy kendi
 *     `etsyKargoTRY` alanını kullanıyor (girilmezse 0 — reklam gideri
 *     alanıyla aynı "kullanıcı doldurur" mantığı).
 *
 * GİDER KALEMLERİ — 2. TUR ARAŞTIRMA (10 Ağustos 2026, bkz.
 * research/ek-gider-kalemleri-2026.md):
 *   - KDV/komisyon tabanı ÇÖZÜLDÜ: Amazon komisyonu MÜŞTERİNİN ÖDEDİĞİ TOPLAM
 *     tutar (KDV+kargo dahil) üzerinden hesaplanıyor ve komisyona ayrıca KDV
 *     ekleniyor (resmi kaynak: satis.amazon.com.tr/ucretlendirme) — yani
 *     mevcut `pct * 1.20` mantığı DOĞRU, dokunulmadı. Trendyol'da ise komisyon
 *     KDV HARİÇ tabana uygulanıp üzerine KDV ekleniyor — matematiksel olarak
 *     (P/1.2)*pct*1.2 = P*pct'ye sadeleşiyor, yani mevcut "pct'yi doğrudan P'ye
 *     uygula" mantığı da zaten DOĞRU çıkıyor (iki platform farklı sözleşme
 *     tabanı kullanıyor ama ikisi de kodda halihazırda doğru modellenmiş).
 *   - Trendyol'un komisyondan AYRI, sabit bir "platform hizmet bedeli" var
 *     (siparişe göre değil, sipariş başına sabit) — `TRENDYOL_HIZMET_BEDELI_TRY`.
 *   - Shopify Payments Türkiye'de kullanılamıyor — `SHOPIFY_PLANS` artık kendi
 *     kartPct'i yerine (a) kullanıcının kendi yerel ödeme sağlayıcısından
 *     girdiği oran/sabit ücret ve (b) Shopify'ın "dış ödeme sağlayıcı" ek
 *     ücretini (plana göre) ayrı ayrı topluyor.
 *   - Etsy'nin resmi 2,5% "Currency Conversion Fee"si eklendi (`currencyConversionPct`).
 *   - Etsy'nin Türkiye için düzenleyici işletim ücreti %2,27'den %1,67'ye
 *     düzeltildi — resmi kaynağın (help.etsy.com) ülke bazlı tablosu doğrudan
 *     çekilip Türkiye satırı okundu (bkz. research, ORTA-YÜKSEK güven).
 *   - İade (return) beklenen maliyeti: 1 Ocak 2026'dan itibaren iade kargosu
 *     satıcıya ait (mevzuat değişikliği) — `iadeOraniPct` × `iadeMaliyetTRY`
 *     olarak Amazon/Trendyol/Shopify'ın sabit maliyetine ekleniyor. Etsy hariç
 *     (satışları ağırlıkla yurt dışına, farklı bir tüketici-hukuku kapsamına
 *     giriyor). İkisi de varsayılan 0 — güvenilir tek bir "tipik" iade oranı
 *     bulunamadı (kaynaklar %18-%70 arası, kategoriye göre çok değişken).
 */

(function (root) {
  'use strict';

  // 10 Ağustos 2026 anlık görüntü (doviz.com + xe.com çapraz kontrollü).
  // Canlıya alırken bir kur API'sine bağlanıp periyodik güncellemek gerekir.
  var FX = {
    date: '2026-08-10',
    USD_TRY: 47.71,
    EUR_TRY: 55.12
  };

  // --- KARGO (Navlungo Domestic 2026 teklifi, Aras Kargo kullanıcı isteğiyle çıkarıldı) ---
  // Her taşıyıcı: desi aralık dilimleri + üst sınır sonrası "her ek desi için +X".
  // Tüm fiyatlara KDV (%20) ve EPH (%2,35) dahildir, üzerine eklenmez.
  var CARGO = {
    ptt: {
      label: 'PTT Kargo',
      // Tekli desi 1-30 arası net veri var; 30-100 arası kaynakta YOK (boşluk).
      brackets: [
        [1, 1, 99], [2, 2, 99], [3, 3, 106], [4, 4, 106], [5, 5, 120],
        [6, 10, 149], [11, 15, 225], [16, 20, 299], [21, 25, 349], [26, 30, 399]
      ],
      overflow: null, // 30-100 arası tanımsız
      heavy: { minDesi: 100, price: 4700 },
      notes: 'Kapıda ödeme HENÜZ AKTİF DEĞİL (Coming Soon). Toplama başlangıcı ~1 hafta (yavaş).'
    },
    hepsijet: {
      label: 'HepsiJET',
      brackets: [
        [0, 2.1, 109], [2.1, 4.1, 110], [4.1, 10.1, 155],
        [10.1, 20.1, 233], [20.1, 30.1, 315], [30.1, 41, 420]
      ],
      overflow: null, // 41 desi üstünde HepsiJET XL tarifesine geçilir (bkz. hepsijetXl)
      heavy: null,
      notes: '41 desi üstünde otomatik HepsiJET XL tarifesi uygulanır. Kapıda ödeme sadece nakit.'
    },
    hepsijetXl: {
      label: 'HepsiJET XL',
      perDesi: 21, // 41+ desi, desi başına düz ücret
      minDesi: 41,
      heavy: null,
      notes: 'Kapıda ödeme seçeneği YOK.'
    },
    surat: {
      label: 'Sürat Kargo',
      brackets: [
        [0, 3.1, 127], [3.1, 5.1, 161], [5.1, 10.1, 205], [10.1, 11.1, 266],
        [11.1, 12.1, 287], [12.1, 13.1, 303], [13.1, 14.1, 311], [14.1, 15.1, 319],
        [15.1, 16.1, 363], [16.1, 17.1, 370], [17.1, 18.1, 377], [18.1, 19.1, 384],
        [19.1, 20.1, 390], [20.1, 21.1, 403], [21.1, 22.1, 419], [22.1, 23.1, 438],
        [23.1, 24.1, 457], [24.1, 25.1, 476], [25.1, 26.1, 495], [26.1, 27.1, 514],
        [27.1, 28.1, 533], [28.1, 29.1, 552], [29.1, 30.1, 571]
      ],
      overflow: { after: 30.1, base: 571, perDesi: 15 },
      heavy: { minDesi: 100, price: 5940 },
      notes: 'Kapıda ödeme nakit+kart (kartta +%4.5 POS komisyonu ayrıca eklenir).'
    },
    kolayGelsin: {
      label: 'Kolay Gelsin',
      brackets: [
        [0, 3.1, 150], [3.1, 6.1, 176], [6.1, 10.1, 213], [10.1, 20.1, 313], [20.1, 30.1, 489]
      ],
      overflow: { after: 30.1, base: 489, perDesi: 14 },
      heavy: null,
      notes: 'Kapıda ödeme YOK. Ağır kargo desteği YOK.'
    },
    yurtici: {
      label: 'Yurtiçi Kargo',
      brackets: [
        [0, 1.1, 175], [1.1, 3.1, 219], [3.1, 5.1, 252], [5.1, 10.1, 327],
        [10.1, 15.1, 447], [15.1, 20.1, 535], [20.1, 25.1, 665], [25.1, 30.1, 738]
      ],
      overflow: { after: 30.1, base: 738, perDesi: 18 },
      heavy: { minDesi: 100, price: 7062 },
      notes: 'Kapıda ödeme YOK. İade özelliği aktif değil.'
    }
  };

  function cargoPrice(carrierKey, desi) {
    var c = CARGO[carrierKey];
    if (!c) return null;
    if (carrierKey === 'hepsijetXl') {
      if (desi < c.minDesi) return null;
      return desi * c.perDesi;
    }
    if (c.heavy && desi >= c.heavy.minDesi) return c.heavy.price;
    for (var i = 0; i < c.brackets.length; i++) {
      var b = c.brackets[i];
      if (desi >= b[0] && desi <= b[1]) return b[2];
    }
    if (c.overflow && desi > c.overflow.after) {
      return c.overflow.base + (desi - c.overflow.after) * c.overflow.perDesi;
    }
    return null; // veri yok (örn. PTT 30-100 arası boşluğu)
  }

  function cheapestCargo(desi) {
    var best = null;
    Object.keys(CARGO).forEach(function (key) {
      var price = cargoPrice(key, desi);
      if (price != null && (best === null || price < best.price)) {
        best = { key: key, label: CARGO[key].label, price: price };
      }
    });
    // 41+ desi'de HepsiJET XL ayrıca denenir (HepsiJET normal tablosunda yok).
    if (desi >= 41) {
      var xl = cargoPrice('hepsijetXl', desi);
      if (xl != null && (best === null || xl < best.price)) {
        best = { key: 'hepsijetXl', label: CARGO.hepsijetXl.label, price: xl };
      }
    }
    return best;
  }

  // --- SEKTÖR / KOMİSYON TABLOSU (Amazon resmi + Trendyol yaklaşık) ---
  // amazon: sayı (düz %) veya {tiers:[[üstSınır,%], ..., [Infinity,%]]}
  // trendyol: sayı (yaklaşık nokta tahmini) veya null (veri yok)
  var SECTORS = [
    { id: 'giyim', label: 'Giyim', amazon: 15.5, trendyol: 21.4 },
    { id: 'ayakkabi', label: 'Ayakkabı', amazon: 17, trendyol: 23 },
    { id: 'canta', label: 'Çanta, Bavul, Seyahat', amazon: 16, trendyol: 21.4 },
    { id: 'taki', label: 'Takı, Mücevher, Bijuteri', amazon: { tiers: [[900, 20], [Infinity, 6]] }, trendyol: 22.25 },
    { id: 'saat', label: 'Kol Saati', amazon: 15.5, trendyol: null },
    { id: 'telefon', label: 'Cep Telefonu', amazon: 8, trendyol: 6 },
    { id: 'bilgisayar', label: 'Bilgisayar', amazon: 7, trendyol: null },
    { id: 'elektronikAksesuar', label: 'Elektronik Aksesuar', amazon: 11, trendyol: null },
    { id: 'tv', label: 'TV, Ev Eğlence Sistemleri', amazon: 11.5, trendyol: 8.5 },
    { id: 'beyazEsya', label: 'Beyaz Eşya', amazon: 7, trendyol: 10 },
    { id: 'kucukEvAleti', label: 'Küçük Ev Aletleri', amazon: 11, trendyol: null },
    { id: 'mutfak', label: 'Mutfak & Dekorasyon', amazon: 15, trendyol: 19.32 },
    { id: 'mobilya', label: 'Mobilya, Ev Tekstili', amazon: 14.5, trendyol: 21 },
    { id: 'bahce', label: 'Bahçe, Elektrikli El Aletleri', amazon: 14, trendyol: 16 },
    { id: 'yapiMarket', label: 'Yapı Market, Banyo', amazon: 12.7, trendyol: 16.75 },
    { id: 'kozmetik', label: 'Kozmetik, Parfüm', amazon: { tiers: [[500, 9], [Infinity, 14]] }, trendyol: 18.5 },
    { id: 'kisiselBakimCihaz', label: 'Kişisel Bakım Cihazları', amazon: 13.6, trendyol: null },
    { id: 'saglik', label: 'Sağlık & Kişisel Bakım', amazon: 13.5, trendyol: null },
    { id: 'gida', label: 'Gıda, Süpermarket', amazon: { tiers: [[500, 9], [Infinity, 13]] }, trendyol: 12.5 },
    { id: 'oyuncak', label: 'Oyuncak & Oyun', amazon: 13, trendyol: 17.25 },
    { id: 'kitap', label: 'Kitap', amazon: 10.2, trendyol: null },
    { id: 'anneBebek', label: 'Anne & Bebek', amazon: 11.5, trendyol: 16.5 },
    { id: 'ofis', label: 'Ofis, Kırtasiye', amazon: 13, trendyol: 16.5 },
    { id: 'spor', label: 'Spor, Outdoor', amazon: 10, trendyol: 15.5 },
    { id: 'oyunKonsol', label: 'Video Oyun Konsolu', amazon: 8.5, trendyol: null },
    { id: 'videoOyun', label: 'Video Oyunları', amazon: 10, trendyol: null },
    { id: 'otomotiv', label: 'Otomotiv & Motosiklet', amazon: 12.5, trendyol: null },
    { id: 'petshop', label: 'Evcil Hayvan (Petshop)', amazon: 13.5, trendyol: 16.6 },
    { id: 'telefonYedek', label: 'Telefon Yedek Parça', amazon: null, trendyol: 26 },
    { id: 'hediyeKarti', label: 'Dijital Hediye Kartı', amazon: null, trendyol: 5 },
    { id: 'diger', label: 'Diğer', amazon: 10, trendyol: null }
  ];

  function resolveRate(rate, priceTRY) {
    if (rate == null) return null;
    if (typeof rate === 'number') return rate;
    if (rate.tiers) {
      for (var i = 0; i < rate.tiers.length; i++) {
        if (priceTRY <= rate.tiers[i][0]) return rate.tiers[i][1];
      }
    }
    return null;
  }

  // --- SHOPIFY (resmi shopify.com/pricing için aylık ücret; Shopify Payments
  // Türkiye'de KULLANILAMADIĞI için kart oranı artık burada değil — kullanıcının
  // kendi yerel ödeme sağlayıcısından girdiği oranla + aşağıdaki externalSurchargePct
  // ile hesaplanıyor, bkz. computeAll) ---
  var SHOPIFY_PLANS = [
    // externalSurchargePct: Shopify Payments DIŞI bir sağlayıcı kullanan mağazalara
    // Shopify'ın kendisinin plana göre kestiği ek yüzde (resmi shopify.com/tr/blog kaynağı).
    { id: 'basic', label: 'Basic ($39/ay)', externalSurchargePct: 2.0, monthlyUSD: 39 },
    { id: 'grow', label: 'Grow ($105/ay)', externalSurchargePct: 1.0, monthlyUSD: 105 },
    { id: 'advanced', label: 'Advanced ($399/ay)', externalSurchargePct: 0.6, monthlyUSD: 399 }
  ];
  // Kullanıcının kendi dış ödeme sağlayıcısından bildirdiği gerçek oran (15 gün
  // valörlü, ekran görüntüsüyle doğrulandı) — genel bir piyasa tahmini değil,
  // bu aracın asıl kullanıcısının kendi sağlayıcısından gelen gerçek rakam.
  // Farklı bir sağlayıcı/valör kullanan biri için değişebilir, bu yüzden index.html'de
  // düzenlenebilir bir alan (varsayılan bu değer).
  var SHOPIFY_GATEWAY_DEFAULT_PCT = 2.65;

  // Trendyol'un komisyondan AYRI, sipariş başına sabit "platform hizmet bedeli"
  // (30 Ocak 2026 itibarıyla iki kademe: aynı gün kargo statüsü 6,99₺+KDV,
  // diğerleri 10,99₺+KDV — bkz. research). Muhafazakâr/varsayılan olarak
  // yüksek kademe kullanılıyor; index.html'de düzenlenebilir.
  var TRENDYOL_HIZMET_BEDELI_TRY = round2(10.99 * 1.20);

  // --- ETSY (resmi sayfa çekilemedi; çoklu 2026 kaynağı ile derlendi) ---
  var ETSY = {
    transactionPct: 6.5,
    listingFeeUSD: 0.20,
    // 10 Ağustos 2026, 2. tur: resmi kaynak (help.etsy.com/Regulatory Operating Fee)
    // doğrudan çekildi — ülke bazlı tabloda Türkiye %1,67 olarak listeleniyor.
    // Bu, önceki %2,27 değerini (üçüncül/resmi olmayan bir kaynaktan) değiştiriyor.
    // Kalan belirsizlik: sayfa bir özetleme aracıyla çekildi (ham HTML birebir
    // teyit edilmedi) — bkz. research, ORTA-YÜKSEK güven.
    regulatoryOperatingFeePct: 1.67,
    defaultPaymentProcessingPct: 4, // TR'ye özel oran doğrulanamadı; "diğer ülkeler" tahmini
    currencyConversionPct: 2.5, // Resmi kaynak (help.etsy.com/Currency Conversion Fees) — YÜKSEK güven
    offsiteAds: { underThresholdPct: 15, overThresholdPct: 12, thresholdUSD: 10000 }
  };

  // --- ANA HESAPLAMA ---
  // fixedTRY: sabit TL maliyetler toplamı (maliyet+kargo+reklam+platforma özel sabit ücretler)
  // percentages: [{label, pct}] yüzdesel kesintiler (komisyon, işlem ücreti, hedef kâr dahil)
  function solvePrice(fixedTRY, percentages) {
    var totalPct = percentages.reduce(function (sum, p) { return sum + p.pct; }, 0);
    if (totalPct >= 100) {
      return { error: 'Girilen oranların toplamı (%' + totalPct.toFixed(1) + ') %100\'ü geçiyor veya eşitliyor — bu maliyet ve kâr hedefiyle hiçbir satış fiyatı bu oranları karşılayamaz.' };
    }
    var price = fixedTRY / (1 - totalPct / 100);
    var breakdown = percentages.map(function (p) {
      return { label: p.label, amount: price * (p.pct / 100) };
    });
    return { price: price, breakdown: breakdown, fixedTRY: fixedTRY };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function computeAll(input) {
    // input: { costTRY, sectorId, marginPct, kargoTRY, reklamTRY, shopifyPlanId,
    //   etsyPaymentPct, etsyOffsiteAds, etsyOverThreshold, trendyolOverridePct,
    //   amazonOverridePct, trendyolKargoOverrideTRY, etsyKargoTRY,
    //   trendyolHizmetBedeliTRY, shopifyGatewayPct, shopifyGatewayFixedTRY,
    //   iadeOraniPct, iadeMaliyetTRY }
    // kargoTRY: Amazon (satıcı-gönderimli) + Shopify + Trendyol'un varsayılanı.
    // trendyolKargoOverrideTRY: verilirse Trendyol için kargoTRY yerine kullanılır.
    // etsyKargoTRY: Etsy'ye özel, kargoTRY'den bağımsız (bkz. dosya başındaki not).
    // iadeOraniPct/iadeMaliyetTRY: Amazon/Trendyol/Shopify'a uygulanan beklenen
    // iade maliyeti (oran% × maliyet); Etsy'ye UYGULANMAZ (bkz. dosya başı notu).
    var sector = SECTORS.filter(function (s) { return s.id === input.sectorId; })[0];
    var results = {};
    var iadeBeklenenMaliyetTRY = ((input.iadeOraniPct || 0) / 100) * (input.iadeMaliyetTRY || 0);

    // --- AMAZON ---
    (function () {
      var basePct = input.amazonOverridePct != null ? input.amazonOverridePct : (sector ? resolveRate(sector.amazon, 9999) : null);
      // Not: tiered kategoriler için basePct'i P bilinmeden tam çözemeyiz (P'ye bağlı).
      // Pratik çözüm: önce üst dilim oranıyla dene, çıkan fiyat dilim sınırının altında
      // kalırsa alt dilim oranıyla yeniden hesapla (iteratif/2 adımlı çözüm yeterli).
      if (!sector || sector.amazon == null) {
        results.amazon = { unavailable: true, reason: 'Bu sektör için Amazon oranı bulunamadı.' };
        return;
      }
      var pct = input.amazonOverridePct != null ? input.amazonOverridePct : resolveTieredWithFeedback(sector.amazon);
      // Amazon komisyonu MÜŞTERİNİN ÖDEDİĞİ TOPLAM (KDV dahil) tutar üzerinden
      // hesaplanıyor, üzerine ayrıca %20 KDV ekleniyor — resmi kaynakla doğrulandı
      // (satis.amazon.com.tr/ucretlendirme, 10 Ağustos 2026). Bu yüzden P'ye
      // doğrudan pct*1.20 uygulamak DOĞRU (Trendyol'daki KDV-hariç-taban mantığıyla
      // KARIŞTIRILMAMALI — iki platformun sözleşme tabanı farklı, bkz. dosya başı notu).
      var effectivePct = pct * 1.20;
      // kargoTRY burada satıcı-gönderimli (kendi kargo firmanız) senaryoyu
      // varsayıyor — Amazon bunu serbest bırakıyor. FBA/Kolay Gönderi kapsam dışı.
      var fixed = input.costTRY + input.kargoTRY + input.reklamTRY + iadeBeklenenMaliyetTRY;
      var r = solvePrice(fixed, [
        { label: 'Komisyon (+KDV)', pct: effectivePct },
        { label: 'Hedef kâr', pct: input.marginPct }
      ]);
      // Tiered kategori ise gerçek fiyata göre oranı tekrar kontrol et.
      if (!r.error && sector.amazon && sector.amazon.tiers && input.amazonOverridePct == null) {
        var realPct = resolveRate(sector.amazon, r.price);
        if (realPct !== pct) {
          var effectivePct2 = realPct * 1.20;
          r = solvePrice(fixed, [
            { label: 'Komisyon (+KDV)', pct: effectivePct2 },
            { label: 'Hedef kâr', pct: input.marginPct }
          ]);
          pct = realPct;
        }
      }
      r.usedPct = pct;
      results.amazon = r;

      function resolveTieredWithFeedback(rate) {
        if (typeof rate === 'number') return rate;
        // İlk tahmin için en düşük dilim sınırındaki oranı kullan (çoğu ürün için makul başlangıç).
        return rate.tiers[0][1];
      }
    })();

    // --- TRENDYOL ---
    (function () {
      var pct = input.trendyolOverridePct != null ? input.trendyolOverridePct : (sector ? sector.trendyol : null);
      if (pct == null) {
        results.trendyol = { unavailable: true, reason: 'Bu sektör için Trendyol oranı yok — satıcı panelinizden kontrol edip ilgili alana yazabilirsiniz.' };
        return;
      }
      // Trendyol kapalı bir anlaşmalı kargo listesi kullanır; satıcı panelindeki
      // gerçek tutar biliniyorsa trendyolKargoOverrideTRY ona öncelik verir,
      // yoksa paylaşılan (genel piyasa) kargoTRY yön gösterici olarak kullanılır.
      var trendyolKargo = input.trendyolKargoOverrideTRY != null ? input.trendyolKargoOverrideTRY : input.kargoTRY;
      // Komisyondan AYRI, sipariş başına sabit "platform hizmet bedeli" (bkz. dosya başı notu).
      var hizmetBedeli = input.trendyolHizmetBedeliTRY != null ? input.trendyolHizmetBedeliTRY : TRENDYOL_HIZMET_BEDELI_TRY;
      var fixed = input.costTRY + trendyolKargo + input.reklamTRY + hizmetBedeli + iadeBeklenenMaliyetTRY;
      var r = solvePrice(fixed, [
        { label: 'Komisyon (yaklaşık)', pct: pct },
        { label: 'Hedef kâr', pct: input.marginPct }
      ]);
      r.usedPct = pct;
      results.trendyol = r;
    })();

    // --- SHOPIFY ---
    (function () {
      var plan = SHOPIFY_PLANS.filter(function (p) { return p.id === input.shopifyPlanId; })[0] || SHOPIFY_PLANS[0];
      // Shopify Payments Türkiye'de yok — bunun yerine kullanıcının kendi yerel
      // ödeme sağlayıcısının oranı + Shopify'ın "dış sağlayıcı" ek ücreti toplanıyor.
      var gatewayPct = input.shopifyGatewayPct != null ? input.shopifyGatewayPct : SHOPIFY_GATEWAY_DEFAULT_PCT;
      var gatewayFixedTRY = input.shopifyGatewayFixedTRY || 0;
      var monthlySubTRY = 0;
      if (input.shopifyMonthlyUnits && input.shopifyMonthlyUnits > 0) {
        monthlySubTRY = (plan.monthlyUSD * FX.USD_TRY) / input.shopifyMonthlyUnits;
      }
      var fixed = input.costTRY + input.kargoTRY + input.reklamTRY + gatewayFixedTRY + monthlySubTRY + iadeBeklenenMaliyetTRY;
      var r = solvePrice(fixed, [
        { label: 'Ödeme sağlayıcı komisyonu', pct: gatewayPct },
        { label: 'Shopify dış sağlayıcı ek ücreti', pct: plan.externalSurchargePct },
        { label: 'Hedef kâr', pct: input.marginPct }
      ]);
      r.usedPct = round2(gatewayPct + plan.externalSurchargePct);
      r.monthlySubTRY = monthlySubTRY;
      r.plan = plan;
      results.shopify = r;
    })();

    // --- ETSY ---
    (function () {
      var paymentPct = input.etsyPaymentPct != null ? input.etsyPaymentPct : ETSY.defaultPaymentProcessingPct;
      var listingFeeTRY = ETSY.listingFeeUSD * FX.USD_TRY;
      var pcts = [
        { label: 'İşlem komisyonu', pct: ETSY.transactionPct },
        { label: 'Ödeme işleme (tahmini)', pct: paymentPct },
        { label: 'Düzenleyici işletim ücreti (TR)', pct: ETSY.regulatoryOperatingFeePct },
        { label: 'Para birimi çevrim ücreti', pct: ETSY.currencyConversionPct },
        { label: 'Hedef kâr', pct: input.marginPct }
      ];
      if (input.etsyOffsiteAds) {
        var adsPct = input.etsyOverThreshold ? ETSY.offsiteAds.overThresholdPct : ETSY.offsiteAds.underThresholdPct;
        pcts.splice(4, 0, { label: 'Offsite Ads (zorunlu)', pct: adsPct });
      }
      // Etsy, paylaşılan yurt içi kargo tablosunu KULLANMAZ (satışlar genelde
      // yurt dışına gider — farklı bir maliyet sınıfı). Kendi alanı girilmezse 0.
      var etsyKargo = input.etsyKargoTRY != null ? input.etsyKargoTRY : 0;
      var fixed = input.costTRY + etsyKargo + input.reklamTRY + listingFeeTRY;
      var r = solvePrice(fixed, pcts);
      results.etsy = r;
    })();

    return results;
  }

  var KH = {
    FX: FX,
    CARGO: CARGO,
    SECTORS: SECTORS,
    SHOPIFY_PLANS: SHOPIFY_PLANS,
    SHOPIFY_GATEWAY_DEFAULT_PCT: SHOPIFY_GATEWAY_DEFAULT_PCT,
    TRENDYOL_HIZMET_BEDELI_TRY: TRENDYOL_HIZMET_BEDELI_TRY,
    ETSY: ETSY,
    cargoPrice: cargoPrice,
    cheapestCargo: cheapestCargo,
    resolveRate: resolveRate,
    solvePrice: solvePrice,
    computeAll: computeAll,
    round2: round2
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KH;
  } else {
    root.KH = KH;
  }
})(typeof window !== 'undefined' ? window : this);
