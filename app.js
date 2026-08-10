(function () {
  'use strict';

  // Renkler artik styles.css'teki --accent-* degiskenlerinden geliyor (tek
  // kaynak orada) — burada sadece platform anahtari -> etiket eslemesi var.
  // Kart/grup rengi CSS'te .amazon/.trendyol/.n11/.shopify/.shopier/.etsy
  // sinif adiyla uygulaniyor.
  var PLATFORM_META = {
    amazon: { label: 'Amazon.com.tr' },
    trendyol: { label: 'Trendyol' },
    n11: { label: 'n11' },
    shopify: { label: 'Shopify' },
    shopier: { label: 'Shopier' },
    etsy: { label: 'Etsy' }
  };
  var PLATFORM_ORDER = ['amazon', 'trendyol', 'n11', 'shopify', 'shopier', 'etsy'];

  var TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.7 12a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.7-12"/></svg>';
  var IMAGE_PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="22" height="22"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M20 15l-4.5-4.5a1.5 1.5 0 0 0-2.12 0L4 19"/></svg>';

  var el = {};
  ['cost', 'sector', 'sectorSearch', 'margin', 'carrier', 'desi', 'dimW', 'dimD', 'dimH', 'dimApply',
    'carrierNote', 'ads', 'iadeOrani', 'iadeMaliyet',
    'amazonOverride', 'trendyolOverride', 'trendyolKargoOverride', 'trendyolHizmetBedeli',
    'n11Override', 'n11KargoOverride',
    'shopifyPlan', 'shopifyGatewayPct', 'shopifyGatewayFixedTRY', 'shopifyUnits', 'etsyKargo',
    'shopierOverride',
    'etsyPayment', 'etsyOffsite', 'etsyOverThreshold', 'etsyThresholdWrap',
    'modeForwardBtn', 'modeReverseBtn', 'marginField', 'targetPriceFieldWrap', 'targetPrice',
    'monthlyUnits', 'monthlyUnitsField', 'freshnessBanner', 'themeToggleBtn', 'themeIcon',
    'summary', 'summaryText', 'results', 'notesList', 'liveBar',
    'savedListBtn', 'savedCount', 'saveTrigger',
    'saveDialog', 'saveForm', 'saveDialogClose', 'saveDialogCancel',
    'saveName', 'savePlatform', 'saveImageInput', 'saveImageThumb', 'saveSnapshot',
    'savedPanel', 'savedPanelClose', 'savedEmpty', 'savedList',
    'settingsToggleBtn', 'settingsToggleDot', 'settingsPanel', 'settingsResetAllBtn',
    'settingsSectorsBody', 'settingsFeesFields', 'settingsShopierFields',
    'settingsShopifyFields', 'settingsEtsyFields', 'settingsFxFields'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  var cardRefs = {};       // platform key -> önceden oluşturulmuş DOM referansları
  var lastInput = null;    // en son readInput() çıktısı (kaydet anlık görüntüsü için)
  var lastResults = null;  // en son KH.computeAll()/computeAllFromPrice() çıktısı
  var pendingImageDataUrl = null; // kaydet formunda seçilen (yeniden boyutlandırılmış) görsel
  var currentMode = 'forward'; // 'forward' (maliyet+kâr -> fiyat) | 'reverse' (fiyat -> kâr)

  // Intl formatter'lari modul kapsamina alindi — her cagrida yeniden
  // olusturmak (onceki hali) gereksiz maliyetliydi; sonuc degismez.
  var TRY_FORMATTER = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
  var DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function fmtTRY(n) {
    if (n == null || isNaN(n)) return '—';
    return TRY_FORMATTER.format(n);
  }

  function fmtDate(ts) {
    try {
      return DATE_FORMATTER.format(new Date(ts));
    } catch (e) {
      return '';
    }
  }

  function setText(node, text, animate) {
    if (node.textContent === text) return;
    node.textContent = text;
    if (animate) {
      node.classList.remove('pulse');
      void node.offsetWidth; // reflow'u zorla — animasyonu her değişimde yeniden başlatır
      node.classList.add('pulse');
    }
  }

  function populateSelects() {
    KH.SECTORS.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.label;
      el.sector.appendChild(opt);
    });
    el.sector.value = 'giyim';

    Object.keys(KH.CARGO).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = KH.CARGO[key].label;
      el.carrier.appendChild(opt);
    });

    KH.SHOPIFY_PLANS.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      el.shopifyPlan.appendChild(opt);
    });
  }

  // Sayısal alanlar için negatif olmayan okuma yardımcıları. HTML'deki min="0"
  // özniteliği JS tarafında hiçbir şeyi ENGELLEMİYOR — kullanıcı yine de "-50"
  // yazıp alandan çıkabilir. calc.js kendi tarafında da aynı kırpmayı yapıyor
  // (tek kaynaktan çağrılmadığı ihtimaline karşı savunma), ama BURADA da
  // kırpmazsak "Kaydet" anlık görüntüsü/kayıtlı ürün listesi gibi calc.js'i
  // atlayan görüntüleme yerlerinde negatif bir sayı görünüp kafa karıştırabilir
  // (10 Ağustos 2026 audit'inde tespit edildi).
  function numOrZero(el) {
    var n = parseFloat(el.value);
    return isNaN(n) ? 0 : Math.max(0, n);
  }
  function numOrNull(el) {
    if (el.value === '') return null;
    var n = parseFloat(el.value);
    return isNaN(n) ? null : Math.max(0, n);
  }

  function readInput() {
    var desi = numOrZero(el.desi);
    var carrierKey = el.carrier.value;
    var kargoTRY = 0;
    var carrierLabel = '';

    if (carrierKey === 'auto') {
      var best = KH.cheapestCargo(desi);
      if (best) { kargoTRY = best.price; carrierLabel = best.label + ' (en ucuz, ' + fmtTRY(best.price) + ')'; }
      else carrierLabel = 'Bu desi için hiçbir taşıyıcıda veri yok.';
    } else {
      var p = KH.cargoPrice(carrierKey, desi);
      if (p == null) { carrierLabel = KH.CARGO[carrierKey].label + ': bu desi için veri yok (örn. PTT 30-100 desi arası boşluk).'; }
      else { kargoTRY = p; carrierLabel = KH.CARGO[carrierKey].label + ' notu: ' + (KH.CARGO[carrierKey].notes || ''); }
    }
    el.carrierNote.textContent = carrierLabel;

    return {
      costTRY: numOrZero(el.cost),
      sectorId: el.sector.value,
      marginPct: numOrZero(el.margin),
      targetPriceTRY: numOrZero(el.targetPrice),
      monthlyUnits: numOrZero(el.monthlyUnits),
      kargoTRY: kargoTRY,
      reklamTRY: numOrZero(el.ads),
      iadeOraniPct: numOrZero(el.iadeOrani),
      iadeMaliyetTRY: numOrZero(el.iadeMaliyet),
      amazonOverridePct: numOrNull(el.amazonOverride),
      trendyolOverridePct: numOrNull(el.trendyolOverride),
      trendyolKargoOverrideTRY: numOrNull(el.trendyolKargoOverride),
      trendyolHizmetBedeliTRY: numOrNull(el.trendyolHizmetBedeli),
      n11OverridePct: numOrNull(el.n11Override),
      n11KargoOverrideTRY: numOrNull(el.n11KargoOverride),
      shopifyPlanId: el.shopifyPlan.value,
      shopifyGatewayPct: numOrNull(el.shopifyGatewayPct),
      shopifyGatewayFixedTRY: numOrZero(el.shopifyGatewayFixedTRY),
      shopifyMonthlyUnits: numOrZero(el.shopifyUnits),
      shopierOverridePct: numOrNull(el.shopierOverride),
      etsyKargoTRY: numOrZero(el.etsyKargo),
      etsyPaymentPct: numOrNull(el.etsyPayment),
      etsyOffsiteAds: el.etsyOffsite.checked,
      etsyOverThreshold: el.etsyOverThreshold.checked
    };
  }

  // Sonuç kartları SAYFA YÜKLENİRKEN BİR KEZ kuruluyor (bkz. buildResultCards).
  // Her tuş vuruşunda innerHTML'i yeniden yazmıyoruz — sadece metinleri
  // güncelliyoruz. Bunun iki nedeni var: (1) giriş animasyonu her keystroke'ta
  // yeniden oynamasın diye, (2) fiyat değiştiğinde kısa bir "pulse" ile
  // güncellemeyi hissettirebilelim.
  function buildResultCards() {
    PLATFORM_ORDER.forEach(function (key, i) {
      var meta = PLATFORM_META[key];
      var card = document.createElement('article');
      card.className = 'result-card ' + key;
      card.setAttribute('data-reveal', '');
      card.style.setProperty('--reveal-delay', (i * 70) + 'ms');
      card.innerHTML =
        '<h3>' + meta.label + '</h3>' +
        '<p class="price"></p>' +
        '<p class="muted pct"></p>' +
        '<p class="muted profit"></p>' +
        '<p class="muted sub"></p>' +
        '<p class="muted monthly"></p>' +
        '<p class="warn"></p>' +
        '<ul class="breakdown"></ul>' +
        '<p class="error"></p>';
      el.results.appendChild(card);
      cardRefs[key] = {
        card: card,
        price: card.querySelector('.price'),
        pct: card.querySelector('.pct'),
        profit: card.querySelector('.profit'),
        sub: card.querySelector('.sub'),
        monthly: card.querySelector('.monthly'),
        warn: card.querySelector('.warn'),
        breakdown: card.querySelector('.breakdown'),
        error: card.querySelector('.error')
      };
    });
  }

  // Hem ileri mod (maliyet+kâr -> fiyat) hem ters mod (fiyat -> kâr) AYNI kart
  // şablonunu paylaşıyor — .price alanı ileri modda fiyatı, ters modda kâr
  // marjı yüzdesini gösterir (ikisi de aynı büyük/serif stil, "bu kartın ana
  // sayısı" rolü aynı). Ayrı bir şablon kurmak yerine bu şekilde tek bir
  // render yolu korunuyor.
  function renderResults(results) {
    var valid = [];
    var reverse = currentMode === 'reverse';

    PLATFORM_ORDER.forEach(function (key) {
      var r = results[key];
      var meta = PLATFORM_META[key];
      var ref = cardRefs[key];

      if (!r || r.unavailable || r.error) {
        ref.card.classList.add('is-unavailable');
        setText(ref.price, '', false);
        ref.price.classList.remove('is-negative');
        ref.pct.textContent = '';
        ref.profit.textContent = '';
        ref.sub.textContent = '';
        ref.monthly.textContent = '';
        ref.warn.textContent = '';
        ref.breakdown.innerHTML = '';
        ref.error.textContent = r ? (r.unavailable ? r.reason : r.error) : '';
        return;
      }

      ref.card.classList.remove('is-unavailable');
      ref.error.textContent = '';
      ref.pct.textContent = r.usedPct != null ? ('Kullanılan oran: %' + r.usedPct.toFixed(2).replace(/\.00$/, '')) : '';

      if (reverse) {
        valid.push({ key: key, label: meta.label, sortVal: r.marginPct, marginPct: r.marginPct });
        setText(ref.price, r.marginPct.toFixed(1).replace(/\.0$/, '') + '%', true);
        ref.price.classList.toggle('is-negative', r.marginPct < 0);
        ref.profit.textContent = 'Kâr: ' + fmtTRY(r.profitTRY) + ' / birim' + (r.profitTRY < 0 ? ' (zarar)' : '');
        ref.sub.textContent = '';
        ref.monthly.textContent = '';
        ref.warn.textContent = '';
      } else {
        valid.push({ key: key, label: meta.label, sortVal: r.price, price: r.price });
        setText(ref.price, fmtTRY(r.price), true);
        ref.price.classList.remove('is-negative');
        ref.profit.textContent = r.birimKarTRY != null ? ('Birim kâr: ' + fmtTRY(r.birimKarTRY)) : '';
        ref.sub.textContent = r.monthlySubTRY ? ('+ aylık abonelik payı: ' + fmtTRY(r.monthlySubTRY) + '/birim') : '';
        ref.monthly.textContent = r.monthlyProfitTRY != null ? ('Aylık kâr projeksiyonu: ' + fmtTRY(r.monthlyProfitTRY)) : '';
        ref.warn.textContent = r.tierAmbiguous ? '⚠ Bu fiyat, komisyon kademesinin sınırına çok yakın bir bantta — kendiyle tam tutarlı değil, daha güvenli (yüksek) taraf seçildi. Amazon panelinizden gerçek oranı teyit edin.' : '';
      }

      var bhtml = '<li><span>Maliyet + kargo + reklam + sabit ücretler</span><span>' + fmtTRY(r.fixedTRY) + '</span></li>';
      r.breakdown.forEach(function (b) {
        bhtml += '<li><span>' + b.label + '</span><span>' + fmtTRY(b.amount) + '</span></li>';
      });
      ref.breakdown.innerHTML = bhtml;
    });

    if (reverse) {
      if (valid.length > 1) {
        valid.sort(function (a, b) { return b.sortVal - a.sortVal; }); // yüksek marj önce
        var best = valid[0], worst = valid[valid.length - 1];
        el.summaryText.innerHTML =
          'Girdiğiniz fiyatta en yüksek kâr marjı: <strong>' + best.label + '</strong> (%' + best.marginPct.toFixed(1) + ').' +
          (worst.key !== best.key ? ' En düşük: <strong>' + worst.label + '</strong> (%' + worst.marginPct.toFixed(1) + ').' : '');
      } else if (valid.length === 1) {
        el.summaryText.innerHTML = '<strong>' + valid[0].label + '</strong> için bu fiyatta kâr marjı: %' + valid[0].marginPct.toFixed(1) + '.';
      } else {
        el.summaryText.textContent = '';
      }
    } else {
      if (valid.length > 1) {
        valid.sort(function (a, b) { return a.sortVal - b.sortVal; });
        var cheapest = valid[0], priciest = valid[valid.length - 1];
        el.summaryText.innerHTML =
          '<strong>' + cheapest.label + '</strong> bu ürün için en düşük satış fiyatıyla aynı kâr marjına ulaşıyor (' + fmtTRY(cheapest.price) + ').' +
          (priciest.key !== cheapest.key ? ' En yüksek fiyat gerektiren: <strong>' + priciest.label + '</strong> (' + fmtTRY(priciest.price) + ').' : '');
      } else if (valid.length === 1) {
        el.summaryText.innerHTML = '<strong>' + valid[0].label + '</strong> için hesaplanan satış fiyatı: ' + fmtTRY(valid[0].price) + '.';
      } else {
        el.summaryText.textContent = '';
      }
    }
    // Ters modda "kaydet" kapalı — kaydedilen anlık görüntü fiyat/breakdown
    // varsayar (bkz. fillSaveSnapshot/renderSavedList), ters modun ürettiği
    // marj/kâr sonucu bu şablona uymuyor.
    el.saveTrigger.disabled = valid.length === 0 || reverse;
  }

  // Formun altında kalan sonuçlara her seferinde kaydırmadan da "en ucuz kaç
  // paraya satmam lazım" sorusuna anında cevap versin diye üstte sabit duran
  // şerit. Aynı hesaplamayı tekrar kullanıyor, ayrı bir mantık değil.
  function updateLiveBar(results) {
    var reverse = currentMode === 'reverse';
    var valid = PLATFORM_ORDER
      .map(function (key) { return { key: key, r: results[key] }; })
      .filter(function (x) { return x.r && !x.r.unavailable && !x.r.error; });

    if (!valid.length) {
      el.liveBar.innerHTML = '<span class="live-dot"></span><span>' +
        (reverse ? 'Hiçbir platform için kâr marjı hesaplanamadı — girdileri kontrol edin.' : 'Hiçbir platform için fiyat hesaplanamadı — girdileri kontrol edin.') +
        '</span>';
      return;
    }

    if (reverse) {
      valid.sort(function (a, b) { return b.r.marginPct - a.r.marginPct; }); // yüksek marj önce
      var mostProfitable = valid[0];
      el.liveBar.innerHTML =
        '<span class="live-dot ' + mostProfitable.key + '"></span>' +
        '<span>En kârlı: <strong>' + PLATFORM_META[mostProfitable.key].label + '</strong> — %' + mostProfitable.r.marginPct.toFixed(1) + '</span>';
      return;
    }

    valid.sort(function (a, b) { return a.r.price - b.r.price; });
    var best = valid[0];
    el.liveBar.innerHTML =
      '<span class="live-dot ' + best.key + '"></span>' +
      '<span>En ucuz: <strong>' + PLATFORM_META[best.key].label + '</strong> — ' + fmtTRY(best.r.price) + '</span>';
  }

  // .layout-results'ın sticky "top" değeri ve #results'ın scroll-margin'i,
  // üstteki sabit şeridin (topbar + live-bar) GERÇEK yüksekliğine göre
  // ayarlanıyor — kaydırınca topbar küçüldüğü için bu deger de değişir.
  function updateStickyOffset() {
    var head = document.querySelector('.sticky-head');
    if (head) document.documentElement.style.setProperty('--sticky-head-h', head.offsetHeight + 'px');
  }

  function recalc() {
    lastInput = readInput();
    lastResults = currentMode === 'reverse'
      ? KH.computeAllFromPrice(lastInput, lastInput.targetPriceTRY)
      : KH.computeAll(lastInput);
    renderResults(lastResults);
    updateLiveBar(lastResults);
  }

  // İleri mod (maliyet+kâr -> fiyat) / ters mod (fiyat -> kâr) arasında
  // geçiş. Hedef alan grubunda hangi girdinin görüneceğini değiştirir ve
  // hemen yeniden hesaplar — iki modun sonuç kartı şablonu ortak
  // (bkz. renderResults), sadece kartın "ana sayısı" değişiyor.
  function setMode(mode) {
    if (mode !== 'forward' && mode !== 'reverse') return;
    currentMode = mode;
    var reverse = mode === 'reverse';

    el.modeForwardBtn.classList.toggle('is-active', !reverse);
    el.modeForwardBtn.setAttribute('aria-pressed', String(!reverse));
    el.modeReverseBtn.classList.toggle('is-active', reverse);
    el.modeReverseBtn.setAttribute('aria-pressed', String(reverse));

    el.marginField.hidden = reverse;
    el.targetPriceFieldWrap.hidden = !reverse;
    if (el.monthlyUnitsField) el.monthlyUnitsField.hidden = reverse;

    recalc();
  }

  function applyDims() {
    var w = parseFloat(el.dimW.value) || 0, d = parseFloat(el.dimD.value) || 0, h = parseFloat(el.dimH.value) || 0;
    if (w > 0 && d > 0 && h > 0) {
      el.desi.value = KH.round2((w * d * h) / 3000);
      recalc();
    }
  }

  // Sektör arama: yazarken <select>'in seçenek listesini DEĞİŞTİRMİYORUZ —
  // sadece etiketi eşleşen ilk seçeneğe "atlıyoruz". Filtreleyip <option>
  // gizlemek yerine bilinçli olarak bu şekilde yapıldı, çünkü
  // scripts/verify_ui.py testleri page.select_option("#sector", ...) ile
  // doğrudan native <select> üzerinden çalışıyor — <option> listesini
  // değiştiren bir filtre bu testleri kırar. Türkçe küçük harfe çevirme
  // (İ/I → i/ı) locale'siz toLowerCase()'in yanlış sonuç vereceği bir konu,
  // bu yüzden toLocaleLowerCase('tr-TR') kullanılıyor.
  function handleSectorSearch() {
    var q = el.sectorSearch.value.trim().toLocaleLowerCase('tr-TR');
    if (!q) return;
    var match = KH.SECTORS.filter(function (s) {
      return s.label.toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
    })[0];
    if (match && el.sector.value !== match.id) {
      el.sector.value = match.id;
      recalc();
    }
  }

  // Üstte sabit duran şeritte kur/komisyon verisinin YAŞINI gösterir —
  // kullanıcı "bu oranlar hâlâ güncel mi" diye sormadan önce görsün diye.
  // KH.FX.date "YYYY-MM-DD" formatında (bkz. calc.js); gün farkı UTC gün
  // sınırına göre hesaplanıyor (yerel saat dilimi kaymasından etkilenmesin).
  // Veriler oturum boyunca değişmediği için sadece init()'te bir kez çağrılır.
  function renderFreshnessBanner() {
    var fxDate = new Date(KH.FX.date + 'T00:00:00Z');
    var now = new Date();
    var todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    var days = Math.round((todayUTC - fxDate) / 86400000);
    var dateLabel = fxDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    var ageText = days <= 0 ? 'bugün' : (days === 1 ? 'dün' : days + ' gün önce');
    el.freshnessBanner.textContent = 'Kur ve komisyon verileri ' + dateLabel + ' tarihli anlık görüntü (' + ageText + ').';
    el.freshnessBanner.classList.toggle('is-stale', days >= 30);
  }

  // --- Karanlık/açık tema ---
  // Tercih tarayıcının localStorage'ında tutulur (bu araç gerçekten kurulan
  // bir PWA — Claude.ai artifact'ı değil, dolayısıyla localStorage burada
  // uygundur). Kayıtlı bir tercih yoksa sistem tercihine (prefers-color-scheme)
  // bakılır. localStorage bazı gizli/kısıtlı tarayıcı modlarında erişilemez
  // olabileceğinden erişimler try/catch ile korunuyor.
  var THEME_KEY = 'kh-theme';
  var THEME_ICON_SUN = '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
  var THEME_ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>';

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    el.themeIcon.innerHTML = theme === 'dark' ? THEME_ICON_MOON : THEME_ICON_SUN;
    var label = theme === 'dark' ? 'Açık temaya geç' : 'Karanlık temaya geç';
    el.themeToggleBtn.setAttribute('aria-label', label);
    el.themeToggleBtn.setAttribute('title', label);
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* erişilemiyorsa sistem tercihine düş */ }
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
    applyTheme(theme);
  }

  function toggleTheme() {
    var next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* kalıcı olmasa da oturum içinde çalışmaya devam eder */ }
  }

  function renderNotes() {
    var notes = [
      'Kargo verisi Navlungo Domestic 2026 teklifinden — Aras Kargo kullanıcı isteğiyle listeden çıkarıldı. Tüm kargo fiyatlarına KDV+EPH dahildir. Bu tablo Amazon (satıcı-gönderimli), Shopify ve Trendyol\'un varsayılanı için kullanılır — Etsy\'de kullanılmaz (aşağıya bakın).',
      'Amazon.com.tr oranları resmi kaynaktan (satis.amazon.com.tr/ucretlendirme), 16 Nisan 2026 tarifesi. Komisyon üzerine ayrıca %20 KDV eklenir (hesaba dahil edildi). Kargo tutarı satıcı-gönderimli (kendi kargo firmanız) senaryoyu varsayar — resmi kaynağa göre bu serbest bir seçim; Amazon Lojistik (FBA) ve Amazon Kolay Gönderi\'nin farklı ücretlendirmesi kapsam dışıdır.',
      'Trendyol komisyon oranları RESMİ DEĞİL — 4 bağımsız kaynaktan (en güncel Temmuz 2026) derlenen yaklaşık değerler; kesin oranı satıcı panelinizden teyit edip ilgili alana yazabilirsiniz. (Komisyonun KDV hariç mi dahil mi tabana uygulandığı sorusu ÇÖZÜLDÜ — bkz. aşağıdaki ayrı not; mevcut hesaplama formülü doğru.)',
      'Trendyol kargo: satıcı, sözleşmesindeki KAPALI bir anlaşmalı kargo listesiyle sınırlı (developers.trendyol.com\'a göre 10 sabit firma; serbest taşıyıcı seçimi yok). Soldaki genel kargo tutarı burada varsayılan olarak kullanılıyor ama üç bağımsız kaynağın Trendyol tarifeleri aynı taşıyıcı/desi için birbirinden %35\'e varan farkla ayrıştığı için kesin değil — panelinizdeki gerçek tutarı "Trendyol → Kargo" alanına girebilirsiniz.',
      'Shopify oranları resmi (shopify.com/pricing), USD cinsinden, ' + KH.FX.date + ' kuruyla (1 USD ≈ ' + KH.FX.USD_TRY + ' TL) TL\'ye çevrildi. Kargo firması seçimi tamamen serbest (platform kısıtlaması yok), bu yüzden soldaki genel tablo doğrudan geçerli.',
      'Etsy: işlem komisyonu (%6,5) çoklu kaynaktan teyitli. Türkiye düzenleyici işletim ücreti için bkz. aşağıdaki ayrı not (kaynak çelişkisi çözüldü). Ödeme işleme oranı Türkiye için hiçbir kaynakta netleşmedi — %4 varsayımı tahminidir, değiştirilebilir. Offsite Ads ücreti sadece o satış Etsy\'nin site dışı reklamından geldiyse uygulanır (zorunlu, opt-out yok).',
      'Etsy kargo: satışlar genelde yurt dışına gittiği için soldaki yurt içi kargo tablosu Etsy\'ye HİÇ uygulanmıyor — Etsy kendi ayrı kargo alanını kullanır, boş/0 bırakılırsa fiyat olduğundan düşük çıkar. Taşıyıcı seçimi serbest (DHL/UPS/FedEx/PTT Yurtdışı/Navlungo vb.); tek bir güvenilir ortalama uluslararası tarife bulunamadığı için (hedef ülkeye, ağırlığa ve taşıyıcıya göre çok değişken) gerçek teklifinizi girmeniz gerekir.',
      'Kur anlık görüntüsü ' + KH.FX.date + ' tarihli (doviz.com + xe.com çapraz kontrollü). Uzun vadede canlı bir kur API\'sine bağlanmalı.',
      'Reklam gideri kalemi araştırılmadı — kullanıcı tarafından girilir.',
      'KOMİSYON/KDV TABANI SORUSU ÇÖZÜLDÜ (10 Ağustos 2026, 2. tur araştırma): Amazon komisyonu müşterinin ödediği TOPLAM (KDV dahil) tutar üzerinden hesaplanıp üzerine ayrıca %20 KDV ekleniyor (resmi kaynak: satis.amazon.com.tr/ucretlendirme) — mevcut "pct × 1,20" formülü zaten DOĞRUYMUŞ. Trendyol\'da ise komisyon KDV-hariç tabana uygulanıp üzerine KDV ekleniyor; bu matematiksel olarak brüt fiyatın doğrudan yüzdesine sadeleşiyor, yani Trendyol\'un mevcut formülü de zaten DOĞRUYMUŞ. İki platform farklı sözleşme tabanı kullanıyor ama ikisi de koda halihazırda doğru yansımış — bug yoktu.',
      'Trendyol\'un komisyondan AYRI, sipariş başına sabit bir "platform hizmet bedeli" var: pazarfiyat.com kaynaklı, 30 Ocak 2026 tarihli iki kademeli yapı — "Bugün Kargoda" statüsündeki satıcılarda 6,99₺+KDV, diğerlerinde 10,99₺+KDV (iade sevkiyatlarına uygulanmıyor). Varsayılan olarak yüksek/muhafazakâr kademe kullanıldı (₺13,19); "Trendyol → Hizmet bedeli" alanından değiştirilebilir.',
      'Shopify Payments Türkiye\'de kullanılamıyor (Shopify\'ın kendi TR blogu + ikinci bir kaynakla doğrulandı) — bu yüzden hesaplayıcı artık Shopify\'ın kendi kart oranı yerine, kullanıcının yerel ödeme sağlayıcısından (iyzico/PayTR/banka sanal POS vb.) girdiği oran + Shopify\'ın plana göre eklediği "dış sağlayıcı" ek ücretini (Basic %2 / Grow %1 / Advanced %0,6 — resmi kaynak) topluyor. Varsayılan oran (%2,65) bu aracın kullanıcısının kendi sağlayıcısından ekran görüntüsüyle bildirdiği gerçek rakam (15 gün valörlü) — genel bir piyasa tahmini değil.',
      'Etsy\'nin resmi "Currency Conversion Fee"si (%2,5) eklendi — help.etsy.com kaynaklı, YÜKSEK güven. Listeleme/ödeme para birimleri farklı olduğunda (bu araç Etsy fiyatlarını USD üzerinden TL\'ye çevirdiği için) uygulanır.',
      'İade (return) beklenen maliyeti: 1 Ocak 2026\'dan itibaren mesafeli satış sözleşmeleri yönetmeliğindeki değişiklikle, cayma hakkı kapsamındaki iade kargosu artık SATICIYA ait. "İade oranı% × iade başına maliyet" olarak beklenen değer formülüyle Amazon/Trendyol/Shopify\'ın fiyatına ekleniyor (Etsy hariç — satışları ağırlıkla yurt dışına gidiyor, farklı bir tüketici-hukuku kapsamına giriyor). Türkiye e-ticaretinde bunun için standart bir yüzde/sabit değer bulunamadı (kategoriye göre araştırmalarda %18-%70 arası rakamlar görüldü); bu yüzden ikisi de varsayılan 0 — kendi tahmininizi girmezseniz hesaba hiç girmez.',
      'Etsy\'nin Türkiye için düzenleyici işletim ücreti (regulatory operating fee) %2,27\'den %1,67\'ye DÜZELTİLDİ: resmi kaynağın (help.etsy.com) ülke bazlı tablosu doğrudan çekilip Türkiye satırı okundu (iki bağımsız çekimde de aynı sonuç). Rakip iki üçüncül kaynak hâlâ farklı değerler veriyor (%2,27 ve belirsiz bir "%0,32-%1,15" aralığı) ama ikisi de resmi sayfa değil; bu yüzden resmi kaynağa güvenildi. Kalan küçük belirsizlik: sayfa bir otomatik özetleme aracıyla okundu, ham HTML birebir teyit edilmedi — kesinlik için kendi Etsy satıcı panelinizden (Ödemeler → Ücretler) teyit edebilirsiniz.',
      'n11 EKLENDİ (3. tur araştırma, 10 Ağustos 2026): komisyon oranları kategori bazlı, 3 bağımsız ikincil kaynaktan derlendi — Amazon gibi resmi/tek bir oran sayfası bulunamadı, ORTA güven. Kategori kapsamı KASITLI OLARAK KISMİ: yalnızca 2+ kaynağın örtüştüğü ya da tek kaynağın çok spesifik olduğu ~8/31 sektör dolduruldu — Trendyol\'daki "veri yoksa boş bırak" deseninin aynısı; eksik sektörlerde "n11 → Komisyon" alanından kendi oranınızı girebilirsiniz. Komisyondan ayrı, tüm kategorilerde sabit bir "%1 pazarlama + %0,67 pazaryeri" hizmet bedeli de (KDV dahil edilerek) hesaba katıldı. Kargo: n11\'de taşıyıcı seçimi varsayılan olarak serbest (mağazalar kendi kargo firmasını belirler, sadece isteğe bağlı "Özel Kargo Kampanyası"na katılanlar kapalı listeyle sınırlı) — bu yüzden soldaki genel kargo tablosu Amazon/Shopify ile aynı şekilde doğrudan kullanılıyor.',
      'Shopier EKLENDİ (3. tur araştırma, 10 Ağustos 2026): komisyon sabit %2,99 + 0,49₺ (yurt içi) — biri Shopier\'in kendi resmi sayfası olmak üzere 2 bağımsız ve güncel (Kasım 2025 sonrası) kaynakla teyitli, YÜKSEK güven. Daha eski (Eylül 2025) bir üçüncü kaynak aylık satış hacmine göre kademeli bir oran öne sürüyordu; hem daha güncel hem birincil kaynak sabit oranı doğruladığı için kademeli yapı MODELLENMEDİ. Aylık üyelik veya listeleme ücreti yok, sadece satış üzerinden kesinti var. Kargo hizmeti Shopier üzerinden opsiyonel (zorunlu değil), bu yüzden soldaki genel kargo tablosu doğrudan kullanılıyor.',
      'GittiGidiyor ARAŞTIRILDI ama EKLENMEDİ (10 Ağustos 2026): platformun Temmuz 2022\'de tamamen kapanıp eBay bünyesine katıldığı doğrulandı (Hepsiburada\'ya değil) — artık aktif bir pazaryeri olmadığı için hesaba dahil edilmedi.',
      'Kayıtlı ürünler bu tarayıcının kendi cihaz-içi veritabanında (IndexedDB) tutulur — sunucuya gönderilmez, başka bir cihazdan/tarayıcıdan görünmez, tarayıcı verisi temizlenirse silinir.'
    ];
    el.notesList.innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
  }

  // --- Kaydırınca beliren içerik (data-reveal) ---
  var revealObserver = null;
  function observeReveals(root) {
    var items = (root || document).querySelectorAll('[data-reveal]:not(.is-visible)');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }
    items.forEach(function (n) { revealObserver.observe(n); });
  }

  // --- Kaydırma sırasında üst şeridin sıkışması (topbar başlığı küçülür) ---
  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      document.body.classList.toggle('is-scrolled', window.scrollY > 32);
      updateStickyOffset();
      scrollTicking = false;
    });
  }

  // --- Görsel seçimi: büyük fotoğrafları IndexedDB'yi şişirmeden önce
  // küçük bir canvas'a çizip JPEG olarak yeniden kodluyoruz. ---
  function resizeImageFile(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Görsel okunamadı')); };
        img.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var cw = Math.max(1, Math.round(img.width * scale));
          var ch = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Kullanıcı bir görsel seçip yeniden boyutlandırma bitmeden ikinci bir
  // görsel seçerse (veya formu kapatıp yeni bir kayıt için yeniden açarsa),
  // önceki resizeImageFile() sözü GEÇ dönebilir ve daha yeni seçimin üzerine
  // yazabilir. Nesil sayacı, sadece hâlâ güncel olan sonucun uygulanmasını sağlar.
  var imageGeneration = 0;

  function resetSaveForm() {
    el.saveForm.reset();
    pendingImageDataUrl = null;
    el.saveImageThumb.innerHTML = IMAGE_PLACEHOLDER_SVG;
    imageGeneration++;
  }

  function fillSaveSnapshot() {
    if (!lastInput || !lastResults) { el.saveSnapshot.textContent = ''; return; }
    var sector = KH.SECTORS.filter(function (s) { return s.id === lastInput.sectorId; })[0];
    var parts = [
      '<strong>' + (sector ? sector.label : lastInput.sectorId) + '</strong>',
      'Maliyet ' + fmtTRY(lastInput.costTRY),
      'Hedef kâr %' + lastInput.marginPct
    ];
    var priceLines = PLATFORM_ORDER.map(function (key) {
      var r = lastResults[key];
      var label = PLATFORM_META[key].label;
      if (!r || r.unavailable || r.error) return label + ': —';
      return label + ': ' + fmtTRY(r.price);
    });
    el.saveSnapshot.innerHTML = parts.join(' · ') + '<br>' + priceLines.join(' · ');
  }

  function openSaveDialog() {
    if (!lastResults) return;
    resetSaveForm();
    fillSaveSnapshot();
    el.saveDialog.showModal();
    el.saveName.focus();
  }

  function handleImageInputChange() {
    var file = el.saveImageInput.files && el.saveImageInput.files[0];
    if (!file) return;
    var gen = ++imageGeneration;
    resizeImageFile(file, 640, 0.82).then(function (dataUrl) {
      if (gen !== imageGeneration) return; // daha yeni bir seçim/reset oldu, bu sonuç artık geçersiz
      pendingImageDataUrl = dataUrl;
      el.saveImageThumb.innerHTML = '<img src="' + dataUrl + '" alt="" />';
    }).catch(function () {
      if (gen !== imageGeneration) return;
      pendingImageDataUrl = null;
      el.saveImageThumb.innerHTML = IMAGE_PLACEHOLDER_SVG;
    });
  }

  function handleSaveSubmit(e) {
    e.preventDefault();
    if (!lastInput || !lastResults) return;
    var name = el.saveName.value.trim();
    if (!name) { el.saveName.focus(); return; }

    var submitBtn = el.saveForm.querySelector('.btn-primary');
    submitBtn.disabled = true;

    var record = {
      name: name,
      prioritySite: el.savePlatform.value,
      image: pendingImageDataUrl,
      createdAt: Date.now(),
      input: lastInput,
      results: lastResults
    };

    KHStore.addItem(record).then(function () {
      el.saveDialog.close();
      resetSaveForm();
      return refreshSavedCount();
    }).catch(function (err) {
      console.error('Kaydetme başarısız:', err);
      alert('Kaydetme başarısız oldu: ' + (err && err.message ? err.message : err));
    }).then(function () {
      submitBtn.disabled = false;
    });
  }

  function refreshSavedCount() {
    return KHStore.count().then(function (n) {
      el.savedCount.textContent = n;
      el.savedCount.setAttribute('data-count', n);
    }).catch(function () { /* IndexedDB yoksa sessizce yut, rozet 0'da kalır */ });
  }

  function platformLabelFor(key) {
    if (PLATFORM_META[key]) return PLATFORM_META[key].label;
    return 'Diğer';
  }

  function renderSavedList(items) {
    // Eski kartları atmadan önce gözlemciden çıkar — aksi halde
    // revealObserver, artık DOM'da olmayan düğümleri sonsuza dek referans
    // olarak tutmaya devam eder (her panel açılışında büyüyen bir sızıntı).
    if (revealObserver) {
      el.savedList.querySelectorAll('[data-reveal]').forEach(function (n) { revealObserver.unobserve(n); });
    }
    el.savedEmpty.style.display = items.length ? 'none' : '';
    el.savedList.innerHTML = '';

    items.forEach(function (item, i) {
      var priorityLabel = platformLabelFor(item.prioritySite);
      var priorityResult = item.results ? item.results[item.prioritySite] : null;
      var priceText = (priorityResult && !priorityResult.unavailable && !priorityResult.error)
        ? fmtTRY(priorityResult.price) : '—';
      var dotClass = PLATFORM_META[item.prioritySite] ? item.prioritySite : '';

      var card = document.createElement('article');
      card.className = 'saved-card';
      card.setAttribute('data-reveal', '');
      card.style.setProperty('--reveal-delay', (Math.min(i, 6) * 55) + 'ms');

      var otherLines = PLATFORM_ORDER.filter(function (k) { return k !== item.prioritySite; }).map(function (k) {
        var r = item.results ? item.results[k] : null;
        var val = (r && !r.unavailable && !r.error) ? fmtTRY(r.price) : '—';
        return '<li><span>' + PLATFORM_META[k].label + '</span><span>' + val + '</span></li>';
      }).join('');

      card.innerHTML =
        '<div class="saved-thumb">' + (item.image ? '<img src="' + item.image + '" alt="" />' : IMAGE_PLACEHOLDER_SVG) + '</div>' +
        '<div class="saved-body">' +
        '<h4></h4>' +
        '<p class="saved-platform"><span class="live-dot ' + dotClass + '"></span><span></span></p>' +
        '<p class="saved-date"></p>' +
        '<details class="saved-detail"><summary>Diğer platformlar</summary><ul>' + otherLines + '</ul></details>' +
        '</div>' +
        '<button type="button" class="saved-delete" data-id="' + item.id + '" aria-label="Sil" title="Sil">' + TRASH_SVG + '</button>';

      card.querySelector('h4').textContent = item.name;
      card.querySelector('.saved-platform span:last-child').textContent = priorityLabel + ' — ' + priceText;
      card.querySelector('.saved-date').textContent = fmtDate(item.createdAt);

      el.savedList.appendChild(card);
    });

    observeReveals(el.savedList);
  }

  // İki asenkron zincir (ör. art arda iki hızlı silme, ya da silme + panel
  // yeniden açma) çakışırsa, yavaş kalan getAll() sonucu geriye dönüp daha
  // yeni bir renderSavedList() çağrısının üzerine yazabilir — silinen bir
  // kart geçici olarak yeniden görünür olur. Nesil sayacı bunu önler: sadece
  // hâlâ en güncel zincire ait sonuç render edilir.
  var savedListGeneration = 0;

  function openSavedPanel() {
    var gen = ++savedListGeneration;
    KHStore.getAll().then(function (items) {
      if (gen !== savedListGeneration) return;
      renderSavedList(items);
      el.savedPanel.showModal();
    }).catch(function (err) {
      console.error('Kayıtlar okunamadı:', err);
      alert('Kayıtlar okunamadı: ' + (err && err.message ? err.message : err));
    });
  }

  function handleSavedListClick(e) {
    var btn = e.target.closest('.saved-delete');
    if (!btn) return;
    var id = parseInt(btn.getAttribute('data-id'), 10);
    btn.disabled = true;
    var gen = ++savedListGeneration;
    KHStore.deleteItem(id).then(function () {
      return KHStore.getAll();
    }).then(function (items) {
      if (gen === savedListGeneration) renderSavedList(items);
      return refreshSavedCount();
    }).catch(function (err) {
      console.error('Silme başarısız:', err);
      btn.disabled = false;
    });
  }

  // --- Ayarlar paneli (KHSettings arayüzü) ---
  // Burada SADECE DOM inşası + KH/overrides'ı okuyup formu doldurma var —
  // hesaplama mantığına dair hiçbir şey yok. Bir alan değiştiğinde
  // KHSettings.setValue() çağrılıyor (KH'yi mutate edip localStorage'a
  // yazıyor), sonra recalc() zaten var olan genel hesaplama akışını tetikliyor.

  function fmtSettingsDefault(n) {
    if (n == null) return '—';
    return String(Math.round(n * 100) / 100);
  }

  function readSettingsOverride(section, key, subKey) {
    var ov = KHSettings.getOverrides();
    var bucket = ov[section];
    if (!bucket) return null;
    var v = subKey != null ? (bucket[key] != null ? bucket[key][subKey] : null) : bucket[key];
    return v == null ? null : v;
  }

  // Tek bir <input>: section/key/subKey data-özniteliklerine, varsayılanı
  // placeholder olarak, kayıtlı bir override varsa onu value olarak taşır.
  // subKey=null olan alanlar (fees/shopier/etsy/fx'in çoğu) düz section->key
  // yoluyla saklanır; sektör tablosu ve Shopify planları gibi 2 seviye
  // gerektirenler subKey kullanır (bkz. settings.js setValue).
  function createSettingsInput(section, key, subKey, defaultValue, opts) {
    opts = opts || {};
    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.min = '0';
    input.step = opts.step || '0.01';
    if (opts.max != null) input.max = String(opts.max);
    input.placeholder = fmtSettingsDefault(defaultValue);
    input.setAttribute('data-section', section);
    input.setAttribute('data-key', key);
    if (subKey != null) input.setAttribute('data-subkey', subKey);
    if (opts.ariaLabel) input.setAttribute('aria-label', opts.ariaLabel);
    var existing = readSettingsOverride(section, key, subKey);
    if (existing != null) input.value = existing;
    var handler = function () {
      KHSettings.setValue(KH, section, key, subKey, input.value);
      updateSettingsModifiedState();
      recalc();
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    return input;
  }

  // section->key->subKey'e karşılık gelen tam bir <div class="field"> (label +
  // input + opsiyonel ipucu) — sektör tablosu DIŞINDAKİ tüm ayar alanları bunu
  // kullanıyor (tablo hücreleri yer kısıtlı olduğu için doğrudan
  // createSettingsInput kullanıyor, kendi label'ı yok, sütun başlığı yeterli).
  function appendSettingsField(container, section, key, subKey, labelText, defaultValue, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var uid = 'set_' + section + '_' + key + (subKey ? '_' + subKey : '');
    var label = document.createElement('label');
    label.setAttribute('for', uid);
    label.textContent = labelText;
    wrap.appendChild(label);
    var input = createSettingsInput(section, key, subKey, defaultValue, opts);
    input.id = uid;
    wrap.appendChild(input);
    if (opts.hint) {
      var hint = document.createElement('p');
      hint.className = 'field-hint';
      hint.textContent = opts.hint;
      wrap.appendChild(hint);
    }
    container.appendChild(wrap);
    return input;
  }

  function renderSettingsSectorsTable() {
    var defaults = KHSettings.getDefaults();
    el.settingsSectorsBody.innerHTML = '';
    KH.SECTORS.forEach(function (s) {
      var d = defaults.sectors[s.id];
      var tr = document.createElement('tr');

      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = s.label;
      tr.appendChild(th);

      var tdAmazon = document.createElement('td');
      if (d.amazon && typeof d.amazon === 'object' && d.amazon.tiers) {
        var tiered = document.createElement('div');
        tiered.className = 'settings-tiered';
        tiered.appendChild(createSettingsInput('sectors', s.id, 'amazonThreshold', d.amazon.tiers[0][0],
          { step: '1', ariaLabel: s.label + ' Amazon eşik tutarı (₺)' }));
        tiered.appendChild(createSettingsInput('sectors', s.id, 'amazonLow', d.amazon.tiers[0][1],
          { step: '0.1', max: 90, ariaLabel: s.label + ' Amazon eşik altı oran (%)' }));
        tiered.appendChild(createSettingsInput('sectors', s.id, 'amazonHigh', d.amazon.tiers[1][1],
          { step: '0.1', max: 90, ariaLabel: s.label + ' Amazon eşik üstü oran (%)' }));
        tdAmazon.appendChild(tiered);
      } else {
        tdAmazon.appendChild(createSettingsInput('sectors', s.id, 'amazon', d.amazon,
          { step: '0.1', max: 90, ariaLabel: s.label + ' Amazon komisyonu (%)' }));
      }
      tr.appendChild(tdAmazon);

      var tdTrendyol = document.createElement('td');
      tdTrendyol.appendChild(createSettingsInput('sectors', s.id, 'trendyol', d.trendyol,
        { step: '0.1', max: 90, ariaLabel: s.label + ' Trendyol komisyonu (%)' }));
      tr.appendChild(tdTrendyol);

      var tdN11 = document.createElement('td');
      tdN11.appendChild(createSettingsInput('sectors', s.id, 'n11', d.n11,
        { step: '0.1', max: 90, ariaLabel: s.label + ' n11 komisyonu (%)' }));
      tr.appendChild(tdN11);

      el.settingsSectorsBody.appendChild(tr);
    });
  }

  function renderSettingsFeesFields() {
    var d = KHSettings.getDefaults().fees;
    el.settingsFeesFields.innerHTML = '';
    appendSettingsField(el.settingsFeesFields, 'fees', 'trendyolHizmetBedeliTRY', null,
      'Trendyol hizmet bedeli (₺)', d.trendyolHizmetBedeliTRY,
      { hint: 'Komisyondan ayrı, sipariş başına sabit ücret.' });
    appendSettingsField(el.settingsFeesFields, 'fees', 'n11HizmetBedeliPct', null,
      'n11 pazarlama + pazaryeri hizmet bedeli (%)', d.n11HizmetBedeliPct,
      { step: '0.01', hint: 'Komisyondan ayrı, tüm kategorilerde sabit oran.' });
  }

  function renderSettingsShopierFields() {
    var d = KHSettings.getDefaults().shopier;
    el.settingsShopierFields.innerHTML = '';
    appendSettingsField(el.settingsShopierFields, 'shopier', 'commissionPct', null,
      'Komisyon (%)', d.commissionPct,
      { hint: 'Aylık hacme göre kademeli — panelinizdeki gerçek oranı girin.' });
    appendSettingsField(el.settingsShopierFields, 'shopier', 'fixedTRY', null,
      'İşlem başına sabit ücret (₺)', d.fixedTRY);
  }

  function renderSettingsShopifyFields() {
    var d = KHSettings.getDefaults().shopify;
    el.settingsShopifyFields.innerHTML = '';
    appendSettingsField(el.settingsShopifyFields, 'shopify', 'gatewayDefaultPct', null,
      'Varsayılan ödeme sağlayıcı oranı (%)', d.gatewayDefaultPct,
      { hint: 'Ana formdaki alanın sayfa açılışındaki ilk değeri.' });
    KH.SHOPIFY_PLANS.forEach(function (p) {
      var dp = d.plans[p.id];
      var heading = document.createElement('div');
      heading.className = 'settings-plan-heading';
      heading.textContent = p.label;
      el.settingsShopifyFields.appendChild(heading);
      appendSettingsField(el.settingsShopifyFields, 'shopify', 'plan_' + p.id, 'monthlyUSD',
        'Aylık ücret ($)', dp.monthlyUSD, { step: '1' });
      appendSettingsField(el.settingsShopifyFields, 'shopify', 'plan_' + p.id, 'externalSurchargePct',
        'Dış sağlayıcı ek ücreti (%)', dp.externalSurchargePct, { step: '0.1' });
    });
  }

  function renderSettingsEtsyFields() {
    var d = KHSettings.getDefaults().etsy;
    el.settingsEtsyFields.innerHTML = '';
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'transactionPct', null, 'İşlem komisyonu (%)', d.transactionPct, { step: '0.1' });
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'listingFeeUSD', null, 'Liste ücreti ($)', d.listingFeeUSD);
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'regulatoryOperatingFeePct', null, 'Düzenleyici işletim ücreti — TR (%)', d.regulatoryOperatingFeePct);
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'defaultPaymentProcessingPct', null, 'Ödeme işleme (tahmini) (%)', d.defaultPaymentProcessingPct, { step: '0.1' });
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'currencyConversionPct', null, 'Para birimi çevrim ücreti (%)', d.currencyConversionPct, { step: '0.1' });
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'offsiteUnderPct', null, 'Offsite Ads — eşik altı (%)', d.offsiteUnderPct, { step: '0.1' });
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'offsiteOverPct', null, 'Offsite Ads — eşik üstü (%)', d.offsiteOverPct, { step: '0.1' });
    appendSettingsField(el.settingsEtsyFields, 'etsy', 'offsiteThresholdUSD', null, 'Offsite Ads eşiği ($/yıl)', d.offsiteThresholdUSD, { step: '1' });
  }

  function renderSettingsFxFields() {
    var d = KHSettings.getDefaults().fx;
    el.settingsFxFields.innerHTML = '';
    appendSettingsField(el.settingsFxFields, 'fx', 'USD_TRY', null, 'USD/TRY', d.USD_TRY);
    appendSettingsField(el.settingsFxFields, 'fx', 'EUR_TRY', null, 'EUR/TRY', d.EUR_TRY);
  }

  // Bir bölümü/tüm paneli sıfırladıktan sonra DOM'daki input değerlerini
  // (artık override kalmadığı için boş olmalılar) günceller — render*
  // fonksiyonlarını yeniden çağırmak (innerHTML'i sıfırdan kurmak) yerine
  // mevcut input'ları yerinde günceller, böylece <details> açık/kapalı
  // durumu ve odak/scroll konumu korunur.
  function refreshSettingsInputs(sectionFilter) {
    var inputs = el.settingsPanel.querySelectorAll('input[data-section]');
    inputs.forEach(function (input) {
      var section = input.getAttribute('data-section');
      if (sectionFilter && section !== sectionFilter) return;
      var key = input.getAttribute('data-key');
      var subKey = input.getAttribute('data-subkey');
      var v = readSettingsOverride(section, key, subKey);
      input.value = v == null ? '' : v;
    });
  }

  function updateSettingsModifiedState() {
    var inputs = el.settingsPanel.querySelectorAll('input[data-section]');
    inputs.forEach(function (input) {
      var section = input.getAttribute('data-section');
      var key = input.getAttribute('data-key');
      var subKey = input.getAttribute('data-subkey');
      var has = readSettingsOverride(section, key, subKey) != null;
      input.classList.toggle('is-modified', has);
      var fieldWrap = input.closest('.field');
      if (fieldWrap) fieldWrap.classList.toggle('is-modified', has);
    });
    el.settingsPanel.querySelectorAll('[data-badge-section]').forEach(function (badge) {
      badge.hidden = !KHSettings.sectionHasOverrides(badge.getAttribute('data-badge-section'));
    });
    el.settingsToggleDot.hidden = !KHSettings.hasAnyOverrides();
  }

  function toggleSettingsPanel() {
    var willOpen = el.settingsPanel.hidden;
    el.settingsPanel.hidden = !willOpen;
    el.settingsToggleBtn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) el.settingsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initSettingsPanel() {
    KHSettings.init(KH);
    renderSettingsSectorsTable();
    renderSettingsFeesFields();
    renderSettingsShopierFields();
    renderSettingsShopifyFields();
    renderSettingsEtsyFields();
    renderSettingsFxFields();
    updateSettingsModifiedState();

    el.settingsToggleBtn.addEventListener('click', toggleSettingsPanel);

    el.settingsResetAllBtn.addEventListener('click', function () {
      KHSettings.resetAll(KH);
      refreshSettingsInputs(null);
      updateSettingsModifiedState();
      recalc();
    });

    // Bölüm bazlı "Bu bölümü sıfırla" düğmeleri: her <details> kendi
    // düğmesini üretiyor, tek tek dinleyici eklemek yerine panel üzerinde
    // tek bir delegasyon yeterli.
    el.settingsPanel.addEventListener('click', function (e) {
      var btn = e.target.closest('.settings-reset-section');
      if (!btn) return;
      var section = btn.getAttribute('data-reset-section');
      KHSettings.resetSection(KH, section);
      refreshSettingsInputs(section);
      updateSettingsModifiedState();
      recalc();
    });
  }

  function init() {
    // Ayarlar panelinden ÖNCE hiçbir şey KH'yi okumamalı — KHSettings.init()
    // kullanıcının kayıtlı düzeltmelerini KH'nin canlı nesnelerine burada,
    // ilk hesaplamadan önce uyguluyor (bkz. settings.js başlık notu).
    initSettingsPanel();
    buildResultCards();
    populateSelects();
    renderNotes();
    initTheme();
    renderFreshnessBanner();
    el.etsyOffsite.addEventListener('change', function () {
      el.etsyThresholdWrap.style.display = el.etsyOffsite.checked ? '' : 'none';
      recalc();
    });
    el.etsyThresholdWrap.style.display = 'none';
    el.dimApply.addEventListener('click', applyDims);

    // #sectorSearch bilinçli olarak bu genel listeden HARİÇ tutuluyor:
    // readInput() onun değerini hiç okumuyor (sadece el.sector.value'yu
    // etkiliyor), bu yüzden buraya recalc bağlamak her tuş vuruşunda
    // gereksiz bir hesaplama daha yapar. Kendi işleyicisi aşağıda.
    // #settingsPanel içindeki input'lar da HARİÇ: bunlar KHSettings.setValue()
    // + recalc()'i KENDİ işleyicisinden (createSettingsInput) zaten çağırıyor;
    // burada da bağlarsak her tuş vuruşunda recalc() iki kez tetiklenirdi.
    var inputs = document.querySelectorAll('input, select');
    inputs.forEach(function (inp) {
      if (inp === el.sectorSearch) return;
      if (inp.closest('#settingsPanel')) return;
      inp.addEventListener('input', recalc);
      inp.addEventListener('change', recalc);
    });
    el.sectorSearch.addEventListener('input', handleSectorSearch);

    // Mod geçişi (maliyetten fiyat <-> fiyattan kâr)
    el.modeForwardBtn.addEventListener('click', function () { setMode('forward'); });
    el.modeReverseBtn.addEventListener('click', function () { setMode('reverse'); });

    // Tema geçişi
    el.themeToggleBtn.addEventListener('click', toggleTheme);

    el.liveBar.addEventListener('click', function () {
      el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    updateStickyOffset();
    window.addEventListener('resize', updateStickyOffset);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Kaydet akışı
    el.saveTrigger.addEventListener('click', openSaveDialog);
    el.saveDialogClose.addEventListener('click', function () { el.saveDialog.close(); });
    el.saveDialogCancel.addEventListener('click', function () { el.saveDialog.close(); });
    el.saveImageInput.addEventListener('change', handleImageInputChange);
    el.saveForm.addEventListener('submit', handleSaveSubmit);

    // Kayıtlı ürünler paneli
    el.savedListBtn.addEventListener('click', openSavedPanel);
    el.savedPanelClose.addEventListener('click', function () { el.savedPanel.close(); });
    el.savedList.addEventListener('click', handleSavedListClick);

    recalc();
    observeReveals(document);
    refreshSavedCount();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.error('Service worker kaydı başarısız:', err);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
