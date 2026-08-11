(function () {
  'use strict';

  // Renkler artik styles.css'teki --accent-* degiskenlerinden geliyor (tek
  // kaynak orada) — burada sadece platform anahtari -> etiket eslemesi var.
  // Kart/grup rengi CSS'te .amazon/.trendyol/.n11/.hepsiburada/.shopify/
  // .shopier sinif adiyla uygulaniyor.
  var PLATFORM_META = {
    amazon: { label: 'Amazon.com.tr' },
    trendyol: { label: 'Trendyol' },
    n11: { label: 'n11' },
    hepsiburada: { label: 'Hepsiburada' },
    shopify: { label: 'Shopify' },
    shopier: { label: 'Shopier' }
  };
  var PLATFORM_ORDER = ['amazon', 'trendyol', 'n11', 'hepsiburada', 'shopify', 'shopier'];

  var TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.7 12a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.7-12"/></svg>';
  var IMAGE_PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="22" height="22"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M20 15l-4.5-4.5a1.5 1.5 0 0 0-2.12 0L4 19"/></svg>';

  var el = {};
  ['cost', 'sector', 'sectorSearch', 'margin', 'carrier', 'desi', 'dimW', 'dimD', 'dimH', 'dimApply',
    'carrierNote', 'ads', 'iadeOrani', 'iadeMaliyet',
    'amazonOverride', 'trendyolOverride', 'trendyolKargoOverride', 'trendyolHizmetBedeli',
    'n11Override', 'n11KargoOverride', 'hepsiburadaOverride', 'hepsiburadaKargoOverride',
    'shopifyPlan', 'shopifyGatewayPct', 'shopifyGatewayFixedTRY', 'shopifyUnits',
    'shopierOverride',
    'modeForwardBtn', 'modeReverseBtn', 'marginField', 'targetPriceFieldWrap', 'targetPrice',
    'monthlyUnits', 'monthlyUnitsField', 'freshnessBanner', 'themeToggleBtn', 'themeIcon',
    'summary', 'summaryText', 'results', 'notesList', 'liveBar',
    'savedListBtn', 'savedCount', 'saveTrigger',
    'saveDialog', 'saveForm', 'saveDialogClose', 'saveDialogCancel',
    'saveName', 'savePlatform', 'saveImageInput', 'saveImageThumb', 'saveSnapshot',
    'savedPanel', 'savedPanelClose', 'savedEmpty', 'savedList',
    'savedToolbar', 'savedSummaryCount', 'savedSummaryBirimKar', 'savedSummaryMonthlyWrap',
    'savedSummaryMonthly', 'savedPlatformRank', 'savedSortSelect', 'savedSectorFilter',
    'settingsToggleBtn', 'settingsToggleDot', 'settingsPanel', 'settingsResetAllBtn',
    'settingsSectorsBody', 'settingsFeesFields', 'settingsShopierFields',
    'settingsShopifyFields', 'settingsFxFields',
    'bulkToggleBtn', 'bulkPanel', 'bulkTemplateBtn', 'bulkFileInput', 'bulkStatus',
    'bulkResultsWrap', 'bulkResultsSummary', 'bulkRecalcBtn', 'bulkExportBtn',
    'bulkResultsHead', 'bulkResultsBody'].forEach(function (id) {
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

  var HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return HTML_ESCAPE_MAP[ch];
    });
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
      hepsiburadaOverridePct: numOrNull(el.hepsiburadaOverride),
      hepsiburadaKargoOverrideTRY: numOrNull(el.hepsiburadaKargoOverride),
      shopifyPlanId: el.shopifyPlan.value,
      shopifyGatewayPct: numOrNull(el.shopifyGatewayPct),
      shopifyGatewayFixedTRY: numOrZero(el.shopifyGatewayFixedTRY),
      shopifyMonthlyUnits: numOrZero(el.shopifyUnits),
      shopierOverridePct: numOrNull(el.shopierOverride)
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
      if (r.usedPct != null) {
        var pctText = 'Kullanılan oran: %' + r.usedPct.toFixed(2).replace(/\.00$/, '');
        if (r.estimatedRate) {
          // sector.n11Estimated'dan gelen bir tahmini oran (bkz. calc.js SECTORS
          // başlık notu) — kullanıcı override girerse computeAll/computeAllFromPrice
          // bu bayrağı zaten false yapıyor, o yüzden burada ekstra kontrol gerekmiyor.
          ref.pct.innerHTML = pctText + ' <span class="field-tag" title="n11 için bu oran doğrudan kaynaklanmadı — diğer pazaryerlerinden tahmin edildi. Gerçek oranı satıcı panelinizden teyit edip Ayarlar bölümünden girebilirsiniz.">tahmini</span>';
        } else {
          ref.pct.textContent = pctText;
        }
      } else {
        ref.pct.textContent = '';
      }

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
      'Kargo verisi Navlungo Domestic 2026 teklifinden — Aras Kargo kullanıcı isteğiyle listeden çıkarıldı. Tüm kargo fiyatlarına KDV+EPH dahildir. Bu tablo Amazon (satıcı-gönderimli), Shopify ve Trendyol\'un varsayılanı için kullanılır.',
      'Amazon.com.tr oranları resmi kaynaktan (satis.amazon.com.tr/ucretlendirme), 16 Nisan 2026 tarifesi. Komisyon üzerine ayrıca %20 KDV eklenir (hesaba dahil edildi). Kargo tutarı satıcı-gönderimli (kendi kargo firmanız) senaryoyu varsayar — resmi kaynağa göre bu serbest bir seçim; Amazon Lojistik (FBA) ve Amazon Kolay Gönderi\'nin farklı ücretlendirmesi kapsam dışıdır.',
      'Trendyol komisyon oranları RESMİ DEĞİL — 4 bağımsız kaynaktan (en güncel Temmuz 2026) derlenen yaklaşık değerler; kesin oranı satıcı panelinizden teyit edip ilgili alana yazabilirsiniz. (Komisyonun KDV hariç mi dahil mi tabana uygulandığı sorusu ÇÖZÜLDÜ — bkz. aşağıdaki ayrı not; mevcut hesaplama formülü doğru.)',
      'Trendyol kargo: satıcı, sözleşmesindeki KAPALI bir anlaşmalı kargo listesiyle sınırlı (developers.trendyol.com\'a göre 10 sabit firma; serbest taşıyıcı seçimi yok). Soldaki genel kargo tutarı burada varsayılan olarak kullanılıyor ama üç bağımsız kaynağın Trendyol tarifeleri aynı taşıyıcı/desi için birbirinden %35\'e varan farkla ayrıştığı için kesin değil — panelinizdeki gerçek tutarı "Trendyol → Kargo" alanına girebilirsiniz.',
      'Shopify oranları resmi (shopify.com/pricing), USD cinsinden, ' + KH.FX.date + ' kuruyla (1 USD ≈ ' + KH.FX.USD_TRY + ' TL) TL\'ye çevrildi. Kargo firması seçimi tamamen serbest (platform kısıtlaması yok), bu yüzden soldaki genel tablo doğrudan geçerli.',
      'Kur anlık görüntüsü ' + KH.FX.date + ' tarihli (doviz.com + xe.com çapraz kontrollü). Uzun vadede canlı bir kur API\'sine bağlanmalı.',
      'Reklam gideri kalemi araştırılmadı — kullanıcı tarafından girilir.',
      'KOMİSYON/KDV TABANI SORUSU ÇÖZÜLDÜ (10 Ağustos 2026, 2. tur araştırma): Amazon komisyonu müşterinin ödediği TOPLAM (KDV dahil) tutar üzerinden hesaplanıp üzerine ayrıca %20 KDV ekleniyor (resmi kaynak: satis.amazon.com.tr/ucretlendirme) — mevcut "pct × 1,20" formülü zaten DOĞRUYMUŞ. Trendyol\'da ise komisyon KDV-hariç tabana uygulanıp üzerine KDV ekleniyor; bu matematiksel olarak brüt fiyatın doğrudan yüzdesine sadeleşiyor, yani Trendyol\'un mevcut formülü de zaten DOĞRUYMUŞ. İki platform farklı sözleşme tabanı kullanıyor ama ikisi de koda halihazırda doğru yansımış — bug yoktu.',
      'Trendyol\'un komisyondan AYRI, sipariş başına sabit bir "platform hizmet bedeli" var: pazarfiyat.com kaynaklı, 30 Ocak 2026 tarihli iki kademeli yapı — "Bugün Kargoda" statüsündeki satıcılarda 6,99₺+KDV, diğerlerinde 10,99₺+KDV (iade sevkiyatlarına uygulanmıyor). Varsayılan olarak yüksek/muhafazakâr kademe kullanıldı (₺13,19); "Trendyol → Hizmet bedeli" alanından değiştirilebilir.',
      'Shopify Payments Türkiye\'de kullanılamıyor (Shopify\'ın kendi TR blogu + ikinci bir kaynakla doğrulandı) — bu yüzden hesaplayıcı artık Shopify\'ın kendi kart oranı yerine, kullanıcının yerel ödeme sağlayıcısından (iyzico/PayTR/banka sanal POS vb.) girdiği oran + Shopify\'ın plana göre eklediği "dış sağlayıcı" ek ücretini (Basic %2 / Grow %1 / Advanced %0,6 — resmi kaynak) topluyor. Varsayılan oran (%2,65) bu aracın kullanıcısının kendi sağlayıcısından ekran görüntüsüyle bildirdiği gerçek rakam (15 gün valörlü) — genel bir piyasa tahmini değil.',
      'İade (return) beklenen maliyeti: 1 Ocak 2026\'dan itibaren mesafeli satış sözleşmeleri yönetmeliğindeki değişiklikle, cayma hakkı kapsamındaki iade kargosu artık SATICIYA ait. "İade oranı% × iade başına maliyet" olarak beklenen değer formülüyle Amazon/Trendyol/Shopify\'ın fiyatına ekleniyor. Türkiye e-ticaretinde bunun için standart bir yüzde/sabit değer bulunamadı (kategoriye göre araştırmalarda %18-%70 arası rakamlar görüldü); bu yüzden ikisi de varsayılan 0 — kendi tahmininizi girmezseniz hesaba hiç girmez.',
      'n11 EKLENDİ (3. tur araştırma, 10 Ağustos 2026): komisyon oranları kategori bazlı, 3 bağımsız ikincil kaynaktan derlendi — Amazon gibi resmi/tek bir oran sayfası bulunamadı, ORTA güven. Kategori kapsamı KASITLI OLARAK KISMİ: yalnızca 2+ kaynağın örtüştüğü ya da tek kaynağın çok spesifik olduğu ~8/31 sektör dolduruldu — Trendyol\'daki "veri yoksa boş bırak" deseninin aynısı; eksik sektörlerde "n11 → Komisyon" alanından kendi oranınızı girebilirsiniz. Komisyondan ayrı, tüm kategorilerde sabit bir "%1 pazarlama + %0,67 pazaryeri" hizmet bedeli de (KDV dahil edilerek) hesaba katıldı. Kargo: n11\'de taşıyıcı seçimi varsayılan olarak serbest (mağazalar kendi kargo firmasını belirler, sadece isteğe bağlı "Özel Kargo Kampanyası"na katılanlar kapalı listeyle sınırlı) — bu yüzden soldaki genel kargo tablosu Amazon/Shopify ile aynı şekilde doğrudan kullanılıyor.',
      'Shopier EKLENDİ (3. tur araştırma, 10 Ağustos 2026): komisyon sabit %2,99 + 0,49₺ (yurt içi) — biri Shopier\'in kendi resmi sayfası olmak üzere 2 bağımsız ve güncel (Kasım 2025 sonrası) kaynakla teyitli, YÜKSEK güven. Daha eski (Eylül 2025) bir üçüncü kaynak aylık satış hacmine göre kademeli bir oran öne sürüyordu; hem daha güncel hem birincil kaynak sabit oranı doğruladığı için kademeli yapı MODELLENMEDİ. Aylık üyelik veya listeleme ücreti yok, sadece satış üzerinden kesinti var. Kargo hizmeti Shopier üzerinden opsiyonel (zorunlu değil), bu yüzden soldaki genel kargo tablosu doğrudan kullanılıyor.',
      'GittiGidiyor ARAŞTIRILDI ama EKLENMEDİ (10 Ağustos 2026): platformun Temmuz 2022\'de tamamen kapanıp eBay bünyesine katıldığı doğrulandı (Hepsiburada\'ya değil) — artık aktif bir pazaryeri olmadığı için hesaba dahil edilmedi.',
      'Kayıtlı ürünler bu tarayıcının kendi cihaz-içi veritabanında (IndexedDB) tutulur — sunucuya gönderilmez, başka bir cihazdan/tarayıcıdan görünmez, tarayıcı verisi temizlenirse silinir.',
      'Hepsiburada EKLENDİ (4. tur araştırma, 11 Ağustos 2026): komisyon oranları resmi kaynaktan (Hepsiburada\'nın kendi kategori-bazlı komisyon oranları PDF\'i, 70+ alt kategori) — kaynağın kendisi YÜKSEK güven ama 31 sektöre eşlenirken (bazı sektörlerde birden fazla alt kategori tek orana indirgendi) eşleme ORTA güven; özellikle Otomotiv\'de dikkatli olun (14 alt kategori, %9-18 arası geniş bir aralık — override şiddetle önerilir). Komisyonun KDV tabanı sorusu, resmi PDF\'in kendi dipnotu tek başına belirsiz kaldığı için ikincil bir kaynaktaki somut bir örnekle çözüldü: Trendyol/n11 ile aynı desen (oran doğrudan fiyata uygulanıyor, Amazon\'un ×1,20 çarpanı YOK). Komisyondan ayrı bir sabit "hizmet bedeli" birden fazla kaynakta ima edildi ama hiçbirinde somut bir ₺ rakamı yoktu — bu yüzden BİLİNÇLİ OLARAK modellenmedi (uydurma bir sayı eklemek yerine). Kargo: Hepsiburada da kapalı/yarı-kapalı bir anlaşmalı taşıyıcı listesiyle çalışıyor (11 kayıtlı firma, HepsiJET tercih ediliyor ama zorunlu değil) — Trendyol/n11 ile aynı desen, soldaki genel kargo tutarı varsayılan olarak kullanılıyor ama "Hepsiburada → Kargo" alanından değiştirilebilir. Detaylı kaynak listesi ve sektör-eşleme tablosu için bkz. research/hepsiburada-arastirmasi.md.',
      'N11 SEKTÖR GENİŞLETMESİ — TAHMİNİ ORANLAR (5. tur araştırma, 11 Ağustos 2026): Yukarıdaki n11 notunda kasıtlı olarak boş bırakılan ~23 sektörün 21\'ine, kullanıcının açık isteğiyle ("küçük komisyon şaşmalarının olduğu durumda sorun yok, tahmini fiyatı görmek istiyorum") TAHMİNİ bir oran eklendi — kaynaklardan doğrulanmadılar; aynı sektördeki Amazon/Trendyol/Hepsiburada oranlarının ortalaması kullanıldı (Amazon kademeliyse muhafazakâr/yüksek kademesiyle). İki istisna: Saat, n11\'in kendi Takı oranını (%21) doğrudan kullanıyor; Otomotiv, Sentos\'un n11\'e özgü aralığının ortasını (~%12,3) kullanıyor. Hediye Kartı ve Diğer hâlâ boş bırakıldı — ortalamaya girecek güvenilir bir referans yoktu. Bu 21 sektörün güveni yukarıdaki ~8 sektöre göre DAHA DÜŞÜK (ikinci dereceden bir tahmin, doğrudan kaynak değil); arayüzde sonuç kartında "tahmini" etiketiyle ve Ayarlar panelinde noktalı kenarlıklı bir ipucuyla ayrıca işaretleniyor, kullanıcı kendi oranını girerse (override) etiket otomatik kayboluyor.',
      'Etsy KALDIRILDI (11 Ağustos 2026, 6. tur, kullanıcı isteğiyle): Etsy\'nin kendi kargo alanı doldurulmadığında 0 kabul edildiği ve iade beklenen maliyeti kalemi Etsy\'ye hiç uygulanmadığı için hesaplanan fiyat diğer platformlarla karşılaştırılamayacak kadar düşük/yanıltıcı çıkıyordu; ayrıca ödeme işleme oranı (%4) Türkiye için hiçbir kaynakta doğrulanamamıştı. Bu yüzden Etsy sonuç kartı, Ayarlar paneli ve toplu hesaplama sütunundan tamamen çıkarıldı. Komisyon/kargo/ücret verileri ve gerekçeleri git geçmişinde duruyor.'
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

  // Panel her açıldığında/silme sonrasında KHStore.getAll()'un HAM (filtresiz)
  // çıktısı burada tutuluyor — sektör filtresi <select>'inin seçenek listesini
  // (hangi sektörler hiç kayıtlıysa) hep TAM kümeden kurmak için gerekiyor;
  // filtre uygulanınca seçenekler daralmamalı, sadece görünen liste daralmalı.
  var savedItemsCache = [];

  var SAVED_EMPTY_NONE = 'Henüz kayıtlı ürün yok. Beğendiğin bir hesaplamada özet şeridindeki kaydet ikonuna basarak buraya ekleyebilirsin.';
  var SAVED_EMPTY_FILTERED = 'Bu sektörde kayıtlı ürün yok. Filtreyi "Tüm sektörler"e çevirerek diğer kayıtları görebilirsin.';

  // item.results[item.prioritySite].birimKarTRY zaten calc.js'te hesaplanmış
  // tek bir TL kâr rakamı (computeAll() sırasında "Hedef kâr" satırından
  // türetiliyor) — burada YENİ bir hesap yapılmıyor, sadece kayıtlı ürünler
  // genelinde toplanıp/sıralanıyor. Hedef kâr YÜZDESİ ileri modda her platform
  // için aynı girdi olduğundan (kullanıcı tek bir hedef % giriyor, her platform
  // o hedefi tutturacak fiyatı kendi tabanına göre çözüyor) "ortalama marj"
  // yerine TL bazlı birim kâr karşılaştırması anlamlı olan gerçek eksen.
  function savedItemBirimKar(item) {
    var pr = item.results ? item.results[item.prioritySite] : null;
    return (pr && !pr.unavailable && !pr.error && typeof pr.birimKarTRY === 'number') ? pr.birimKarTRY : null;
  }

  function computeSavedSummary(items) {
    var totalBirimKar = 0, birimKarCount = 0;
    var totalMonthlyProfit = 0, monthlyProfitCount = 0;
    var platformStats = {};
    PLATFORM_ORDER.forEach(function (k) { platformStats[k] = { sum: 0, count: 0 }; });

    items.forEach(function (item) {
      var bk = savedItemBirimKar(item);
      if (bk != null) { totalBirimKar += bk; birimKarCount++; }
      var pr = item.results ? item.results[item.prioritySite] : null;
      if (pr && typeof pr.monthlyProfitTRY === 'number') {
        totalMonthlyProfit += pr.monthlyProfitTRY;
        monthlyProfitCount++;
      }
      // Portföy genelinde "hangi platform en kârlı" sorusuna cevap için — SADECE
      // öncelikli platform değil, her ürünün HER platformdaki (hesaplanabiliyorsa)
      // birim kârı toplanıyor.
      PLATFORM_ORDER.forEach(function (k) {
        var r = item.results ? item.results[k] : null;
        if (r && !r.unavailable && !r.error && typeof r.birimKarTRY === 'number') {
          platformStats[k].sum += r.birimKarTRY;
          platformStats[k].count++;
        }
      });
    });

    var platformRanking = PLATFORM_ORDER
      .map(function (k) {
        var st = platformStats[k];
        return { key: k, count: st.count, avg: st.count ? st.sum / st.count : null };
      })
      .filter(function (p) { return p.count > 0; })
      .sort(function (a, b) { return b.avg - a.avg; });

    return {
      count: items.length,
      totalBirimKar: totalBirimKar,
      birimKarCount: birimKarCount,
      totalMonthlyProfit: totalMonthlyProfit,
      monthlyProfitCount: monthlyProfitCount,
      platformRanking: platformRanking
    };
  }

  function renderSavedSummary(items) {
    if (!items.length) {
      el.savedToolbar.hidden = true;
      return;
    }
    el.savedToolbar.hidden = false;
    var s = computeSavedSummary(items);

    el.savedSummaryCount.textContent = s.count;
    el.savedSummaryBirimKar.textContent = s.birimKarCount ? fmtTRY(s.totalBirimKar) : '—';

    if (s.monthlyProfitCount > 0) {
      el.savedSummaryMonthlyWrap.hidden = false;
      el.savedSummaryMonthly.textContent = fmtTRY(s.totalMonthlyProfit) + ' (' + s.monthlyProfitCount + ' üründe aylık adet girilmiş)';
    } else {
      el.savedSummaryMonthlyWrap.hidden = true;
    }

    el.savedPlatformRank.innerHTML = s.platformRanking.length
      ? s.platformRanking.map(function (p) {
        var dotClass = PLATFORM_META[p.key] ? p.key : '';
        return '<li><span class="live-dot ' + dotClass + '"></span><span>' + platformLabelFor(p.key) + '</span>' +
          '<span>' + fmtTRY(p.avg) + ' ort. · ' + p.count + ' üründe</span></li>';
      }).join('')
      : '<li class="saved-rank-empty">Hesaplanabilir platform yok</li>';
  }

  function sortSavedItems(items, mode) {
    var arr = items.slice();
    if (mode === 'profit-desc' || mode === 'profit-asc') {
      var dir = mode === 'profit-desc' ? -1 : 1;
      arr.sort(function (a, b) {
        var av = savedItemBirimKar(a), bv = savedItemBirimKar(b);
        // Hesaplanamayan (öncelikli platformu unavailable/error) ürünler her
        // iki sıralama yönünde de sona atılıyor — "en kârlı" listesinin
        // başında ya da sonunda anlamsız bir null görünmesin diye.
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return dir * (av - bv);
      });
    } else if (mode === 'name-asc') {
      arr.sort(function (a, b) { return a.name.localeCompare(b.name, 'tr-TR'); });
    } else {
      arr.sort(function (a, b) { return b.createdAt - a.createdAt; }); // 'date-desc' (varsayılan)
    }
    return arr;
  }

  function populateSavedSectorFilter(items) {
    var current = el.savedSectorFilter.value;
    var sectorIds = [];
    items.forEach(function (item) {
      var sid = item.input && item.input.sectorId;
      if (sid && sectorIds.indexOf(sid) === -1) sectorIds.push(sid);
    });
    el.savedSectorFilter.innerHTML = '<option value="">Tüm sektörler</option>';
    sectorIds.forEach(function (sid) {
      var sector = KH.SECTORS.filter(function (s) { return s.id === sid; })[0];
      var opt = document.createElement('option');
      opt.value = sid;
      opt.textContent = sector ? sector.label : sid;
      el.savedSectorFilter.appendChild(opt);
    });
    if (sectorIds.indexOf(current) !== -1) el.savedSectorFilter.value = current;
  }

  function applySavedFiltersAndRender() {
    var sectorFilter = el.savedSectorFilter.value;
    var filtered = sectorFilter
      ? savedItemsCache.filter(function (item) { return item.input && item.input.sectorId === sectorFilter; })
      : savedItemsCache.slice();
    // Mesaj SADECE "aktif bir filtre var mı"ya bağlı, kaydedilmiş toplam ürün
    // sayısına DEĞİL — filtre yokken (ya da eşleşme varken) el.savedEmpty zaten
    // gizli kalıyor (bkz. renderSavedList), bu yüzden metin sadece filtre
    // GERÇEKTEN 0 sonuca daralttığında görünür oluyor.
    el.savedEmpty.textContent = sectorFilter ? SAVED_EMPTY_FILTERED : SAVED_EMPTY_NONE;
    renderSavedSummary(filtered);
    renderSavedList(sortSavedItems(filtered, el.savedSortSelect.value));
  }

  function openSavedPanel() {
    var gen = ++savedListGeneration;
    KHStore.getAll().then(function (items) {
      if (gen !== savedListGeneration) return;
      savedItemsCache = items;
      populateSavedSectorFilter(items);
      applySavedFiltersAndRender();
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
      if (gen === savedListGeneration) {
        savedItemsCache = items;
        populateSavedSectorFilter(items);
        applySavedFiltersAndRender();
      }
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
  // subKey=null olan alanlar (fees/shopier/fx'in çoğu) düz section->key
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
    if (opts.title) {
      input.title = opts.title;
      input.classList.add('has-title-hint');
    }
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
      var n11Opts = { step: '0.1', max: 90, ariaLabel: s.label + ' n11 komisyonu (%)' };
      if (s.n11Estimated) {
        // Bu varsayılan doğrudan n11'den kaynaklanmadı, diğer pazaryerlerinden
        // tahmin edildi (bkz. calc.js SECTORS başlık notu) — kesikli kenarlık +
        // title ipucuyla ayırt ediliyor.
        n11Opts.title = 'Bu varsayılan n11\'den doğrudan kaynaklanmadı — Amazon/Trendyol/Hepsiburada oranlarından tahmin edildi. Kesin oranı satıcı panelinizden görüp buraya kalıcı olarak girebilirsiniz.';
      }
      tdN11.appendChild(createSettingsInput('sectors', s.id, 'n11', d.n11, n11Opts));
      tr.appendChild(tdN11);

      // d.hepsiburada bazı sektörlerde null (hediyeKarti, diger — resmi PDF'te
      // uygun bir eşleşme yok, bkz. calc.js SECTORS yorumu). createSettingsInput
      // null'ı zaten "—" placeholder'ına çeviriyor (fmtSettingsDefault) ve
      // input yine de DÜZENLENEBİLİR kalıyor — kullanıcı kendi panelinden
      // gerçek oranı öğrenirse buraya kalıcı bir varsayılan olarak girebilir.
      var tdHepsiburada = document.createElement('td');
      tdHepsiburada.appendChild(createSettingsInput('sectors', s.id, 'hepsiburada', d.hepsiburada,
        { step: '0.1', max: 90, ariaLabel: s.label + ' Hepsiburada komisyonu (%)' }));
      tr.appendChild(tdHepsiburada);

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

  // ============== TOPLU HESAPLAMA (CSV, 11 Ağustos 2026) ==============
  // Tasarım: CSV'de sadece ÜRÜN BAŞINA değişen alanlar var (ad/maliyet/
  // sektör/hedef kâr, + opsiyonel kargo/reklam/aylık adet). Platforma özel
  // oranlar/ayarlar (Ayarlar paneli override'ları + ana formdaki "Platforma
  // özel ayarlar") CSV'de YOK — o an ana formda girili olan/etkin olan
  // değerler TÜM satırlara aynı şekilde uygulanıyor (bkz. readInput()).
  // Bağımlılıksız: harici bir CSV kütüphanesi kullanılmıyor (sitenin genel
  // sıfır-bağımlılık ilkesiyle tutarlı, bkz. README "Nasıl çalıştırılır").

  var BULK_COLUMNS = [
    { key: 'name', required: false, aliases: ['ürün adı', 'urun adi', 'ürün', 'urun', 'ad', 'isim'] },
    { key: 'cost', required: true, aliases: ['maliyet (₺)', 'maliyet (try)', 'maliyet (tl)', 'maliyet', 'ürün maliyeti', 'urun maliyeti'] },
    { key: 'sector', required: true, aliases: ['sektör', 'sektor', 'kategori'] },
    { key: 'margin', required: true, aliases: ['hedef kâr (%)', 'hedef kar (%)', 'hedef kâr oranı (%)', 'hedef kar orani (%)', 'hedef kâr', 'hedef kar', 'kâr', 'kar', 'marj'] },
    { key: 'kargo', required: false, aliases: ['kargo (₺)', 'kargo (try)', 'kargo (tl)', 'kargo'] },
    { key: 'reklam', required: false, aliases: ['reklam (₺)', 'reklam (try)', 'reklam (tl)', 'reklam', 'reklam gideri', 'reklam gideri (₺)'] },
    { key: 'monthlyUnits', required: false, aliases: ['aylık adet', 'aylik adet', 'aylık satış adedi', 'aylik satis adedi', 'aylık tahmini satış adedi', 'adet'] }
  ];
  var bulkParsedRows = null;   // en son başarıyla ayrıştırılan satırlar ("Yeniden hesapla" için önbellek)
  var bulkComputed = null;     // en son hesaplanan sonuçlar (dışa aktarma için önbellek)

  // ',' VEYA ';' ayraçlı dosyaları otomatik algılar (Türkçe Excel "CSV" dışa
  // aktarımı genelde ';' kullanır) — sadece BAŞLIK satırına bakıyor, tırnaklı
  // alan İÇİNDE yanlışlıkla sayılan bir ayraç ihtimaline karşı yeterli (başlık
  // satırı normalde tırnak/iç içe ayraç içermez).
  function bulkDetectDelimiter(text) {
    var firstLine = text.split(/\r\n|\r|\n/, 1)[0] || '';
    var commas = (firstLine.match(/,/g) || []).length;
    var semis = (firstLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
  }

  function csvEscapeField(v) {
    var s = v == null ? '' : String(v);
    if (/["\r\n,;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function csvStringify(rows) {
    return rows.map(function (row) { return row.map(csvEscapeField).join(','); }).join('\r\n');
  }

  // RFC4180'e yakın bir ayrıştırıcı: tırnaklı alan içindeki ayraç/yeni satır/
  // kaçışlı çift tırnak (`""`) doğru işlenir. text -> [[hücre, ...], ...].
  function csvParseText(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // Excel'in UTF-8 CSV'lerine eklediği BOM
    var delim = bulkDetectDelimiter(text);
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === delim) {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    // Tamamen boş satırları at (Excel dışa aktarımları genelde sonda bir tane bırakır).
    return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
  }

  // Hem "25.5" / "1,234.56" (uluslararası) HEM "25,5" / "1.234,56" (Türkçe)
  // biçimini kabul eder — hücre içeriğine bakarak karar verir (dosya ayracına
  // göre DEĞİL, bir hücre yanlışlıkla ters biçimde girilmiş olsa bile çalışır).
  function bulkParseNumber(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().replace(/\s/g, '');
    if (s === '') return null;
    if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(s) || /^-?\d+,\d+$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.'); // Türkçe: '.' binlik, ',' ondalık
    } else {
      s = s.replace(/,/g, ''); // uluslararası: olası ',' binlik ayracını sil, '.' zaten ondalık
    }
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // Ana formdaki #sectorSearch ile AYNI eşleme mantığı (bkz. handleSectorSearch):
  // önce id, sonra etiketle birebir, sonra etiket İÇİNDE geçme — üçü de
  // Türkçe locale'e duyarlı küçük harfe çevirmeyle (İ/I -> i/ı doğru).
  function bulkMatchSector(raw) {
    var s = (raw || '').trim();
    if (!s) return null;
    var sLower = s.toLocaleLowerCase('tr-TR');
    var byId = KH.SECTORS.filter(function (sec) { return sec.id.toLocaleLowerCase('tr-TR') === sLower; })[0];
    if (byId) return byId;
    var byLabel = KH.SECTORS.filter(function (sec) { return sec.label.toLocaleLowerCase('tr-TR') === sLower; })[0];
    if (byLabel) return byLabel;
    var bySubstr = KH.SECTORS.filter(function (sec) { return sec.label.toLocaleLowerCase('tr-TR').indexOf(sLower) !== -1; })[0];
    return bySubstr || null;
  }

  function bulkMapHeaders(headerRow) {
    var normalized = headerRow.map(function (h) { return (h || '').trim().toLocaleLowerCase('tr-TR'); });
    var map = {};
    BULK_COLUMNS.forEach(function (col) {
      for (var i = 0; i < normalized.length; i++) {
        if (col.aliases.indexOf(normalized[i]) !== -1) { map[col.key] = i; return; }
      }
    });
    return map;
  }

  function bulkMergeInput(base, overrides) {
    var merged = {};
    Object.keys(base).forEach(function (k) { merged[k] = base[k]; });
    Object.keys(overrides).forEach(function (k) { if (overrides[k] !== undefined) merged[k] = overrides[k]; });
    return merged;
  }

  // text -> { error } (tüm dosya reddedildi, ör. zorunlu sütun eksik) VEYA
  // { rows } (satır satır, her biri kendi hatalarını taşıyabilir — bir
  // satırdaki hata diğerlerinin hesaplanmasını ENGELLEMEZ).
  function parseBulkRows(text) {
    var table = csvParseText(text);
    if (!table.length) return { error: 'CSV dosyası boş görünüyor.' };
    var headerMap = bulkMapHeaders(table[0]);
    var missing = BULK_COLUMNS.filter(function (c) { return c.required && headerMap[c.key] == null; });
    if (missing.length) {
      var missingLabels = missing.map(function (c) { return BULK_COLUMNS.filter(function (b) { return b.key === c.key; })[0].aliases[0]; });
      return { error: 'CSV\'de şu zorunlu sütun(lar) bulunamadı: ' + missingLabels.join(', ') + '. Şablonu indirip sütun başlıklarını değiştirmeden doldurmanız önerilir.' };
    }
    var rows = [];
    table.slice(1).forEach(function (cells, idx) {
      var rowNum = idx + 2; // 1. satır başlık; kullanıcıya gösterilen satır no dosyadaki gerçek konumla eşleşsin diye +2
      var get = function (key) { return headerMap[key] != null ? (cells[headerMap[key]] || '') : ''; };
      var name = get('name').trim() || ('Satır ' + rowNum);
      var costRaw = get('cost'), cost = bulkParseNumber(costRaw);
      var sectorRaw = get('sector'), sector = bulkMatchSector(sectorRaw);
      var marginRaw = get('margin'), margin = bulkParseNumber(marginRaw);
      var errors = [];
      if (cost == null || cost < 0) errors.push('Maliyet geçersiz: "' + costRaw + '"');
      if (!sector) errors.push('Sektör bulunamadı: "' + sectorRaw + '"');
      if (margin == null) errors.push('Hedef kâr geçersiz: "' + marginRaw + '"');

      var optionalNum = function (key, label) {
        var raw = get(key);
        if (raw.trim() === '') return null;
        var n = bulkParseNumber(raw);
        if (n == null) errors.push(label + ' geçersiz: "' + raw + '"');
        return n;
      };
      var kargo = optionalNum('kargo', 'Kargo');
      var reklam = optionalNum('reklam', 'Reklam gideri');
      var monthlyUnits = optionalNum('monthlyUnits', 'Aylık adet');

      rows.push({
        rowNum: rowNum, name: name, cost: cost, sector: sector, margin: margin,
        kargo: kargo, reklam: reklam, monthlyUnits: monthlyUnits, errors: errors
      });
    });
    return { rows: rows };
  }

  function computeBulkRow(row, baseInput) {
    var input = bulkMergeInput(baseInput, {
      costTRY: row.cost,
      sectorId: row.sector.id,
      marginPct: row.margin,
      kargoTRY: row.kargo != null ? row.kargo : baseInput.kargoTRY,
      reklamTRY: row.reklam != null ? row.reklam : baseInput.reklamTRY,
      monthlyUnits: row.monthlyUnits != null ? row.monthlyUnits : baseInput.monthlyUnits
    });
    return KH.computeAll(input);
  }

  function downloadTextFile(filename, content, mime) {
    var blob = new Blob(['﻿' + content], { type: mime + ';charset=utf-8' }); // BOM: Excel Türkçe karakterleri dogru gostersin
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadBulkTemplate() {
    var rows = [
      ['Ürün Adı', 'Maliyet (₺)', 'Sektör', 'Hedef Kâr (%)', 'Kargo (₺)', 'Reklam (₺)', 'Aylık Adet'],
      ['Kışlık Mont', '450', 'Giyim', '25', '', '', '20'],
      ['Bluetooth Kulaklık', '180', 'Elektronik Aksesuar', '30', '45', '10', '50'],
      ['Deri Cüzdan', '90', 'Çanta, Bavul, Seyahat', '35', '', '', '']
    ];
    downloadTextFile('kar-hesap-toplu-sablon.csv', csvStringify(rows), 'text/csv');
  }

  function renderBulkResults(rows) {
    var baseInput = readInput();
    var computed = rows.map(function (row) {
      if (row.errors.length) return { row: row, results: null, prices: null };
      var results = computeBulkRow(row, baseInput);
      var prices = {};
      var minKey = null, minVal = Infinity;
      PLATFORM_ORDER.forEach(function (key) {
        var r = results[key];
        var price = (r && !r.unavailable && !r.error) ? r.price : null;
        prices[key] = price;
        if (price != null && price < minVal) { minVal = price; minKey = key; }
      });
      return { row: row, results: results, prices: prices, cheapestKey: minKey };
    });
    bulkComputed = computed;

    var okCount = computed.filter(function (c) { return c.prices; }).length;
    var errCount = computed.length - okCount;
    el.bulkResultsSummary.textContent = okCount + ' ürün hesaplandı' + (errCount ? ', ' + errCount + ' satırda hata var (aşağıda kırmızıyla işaretli)' : '') + '.';

    var headHtml = '<th>Ürün Adı</th><th>Sektör</th>';
    PLATFORM_ORDER.forEach(function (key) { headHtml += '<th>' + PLATFORM_META[key].label + '</th>'; });
    el.bulkResultsHead.innerHTML = headHtml;

    var colCount = 2 + PLATFORM_ORDER.length;
    var bodyHtml = computed.map(function (c) {
      var name = '<th scope="row">' + escapeHtml(c.row.name) + '</th>';
      if (!c.prices) {
        return '<tr class="bulk-row-error">' + name + '<td colspan="' + (colCount - 1) + '">' + escapeHtml(c.row.errors.join('; ')) + '</td></tr>';
      }
      var cells = '<td>' + escapeHtml(c.row.sector.label) + '</td>';
      PLATFORM_ORDER.forEach(function (key) {
        var cls = key === c.cheapestKey ? ' class="bulk-cheapest"' : '';
        cells += '<td' + cls + '>' + fmtTRY(c.prices[key]) + '</td>';
      });
      return '<tr>' + name + cells + '</tr>';
    }).join('');
    el.bulkResultsBody.innerHTML = bodyHtml;

    el.bulkResultsWrap.hidden = false;
  }

  function exportBulkResults() {
    if (!bulkComputed) return;
    var header = ['Ürün Adı', 'Sektör'].concat(PLATFORM_ORDER.map(function (key) { return PLATFORM_META[key].label; })).concat(['Hata']);
    var rows = [header];
    bulkComputed.forEach(function (c) {
      var row = [c.row.name];
      if (!c.prices) {
        row.push(c.row.sector ? c.row.sector.label : '');
        PLATFORM_ORDER.forEach(function () { row.push(''); });
        row.push(c.row.errors.join('; '));
      } else {
        row.push(c.row.sector.label);
        PLATFORM_ORDER.forEach(function (key) {
          var p = c.prices[key];
          row.push(p == null ? '' : p.toFixed(2));
        });
        row.push('');
      }
      rows.push(row);
    });
    downloadTextFile('kar-hesap-toplu-sonuc.csv', csvStringify(rows), 'text/csv');
  }

  function setBulkStatus(message, isError) {
    if (!message) { el.bulkStatus.hidden = true; el.bulkStatus.textContent = ''; return; }
    el.bulkStatus.hidden = false;
    el.bulkStatus.textContent = message;
    el.bulkStatus.classList.toggle('is-error', !!isError);
  }

  function handleBulkFileChange() {
    var file = el.bulkFileInput.files && el.bulkFileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = parseBulkRows(String(reader.result));
      if (parsed.error) {
        setBulkStatus(parsed.error, true);
        el.bulkResultsWrap.hidden = true;
        bulkParsedRows = null;
        bulkComputed = null;
        return;
      }
      setBulkStatus('');
      bulkParsedRows = parsed.rows;
      renderBulkResults(parsed.rows);
    };
    reader.onerror = function () {
      setBulkStatus('Dosya okunamadı — tekrar deneyin.', true);
    };
    reader.readAsText(file, 'UTF-8');
    el.bulkFileInput.value = ''; // ayni dosya tekrar secilirse de 'change' tetiklensin
  }

  function toggleBulkPanel() {
    var willOpen = el.bulkPanel.hidden;
    el.bulkPanel.hidden = !willOpen;
    el.bulkToggleBtn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) el.bulkPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Bilgi butonu (i) + popover: native Popover API kullanır (bkz. styles.css
  // .info-btn/.info-popover yorumu) -- açma/kapama/dış-tıklama/Esc tarayıcı
  // tarafından otomatik yönetiliyor, burada sadece butonun hemen altına
  // konumlandırma + ekran taşması düzeltmesi yapılıyor.
  function initInfoPopovers() {
    var MARGIN = 8;
    var MAX_WIDTH = 300;
    document.querySelectorAll('.info-btn[popovertarget]').forEach(function (btn) {
      var pop = document.getElementById(btn.getAttribute('popovertarget'));
      if (!pop) return;
      btn.addEventListener('click', function () {
        var r = btn.getBoundingClientRect();
        // ONEMLI: UA stil sayfasi [popover] icin varsayilan olarak inset:0
        // uyguluyor -- SADECE left/top ayarlarsak (genislik/yukseklik auto
        // kalirsa) tarayici shrink-to-fit genisligini "left ile viewport
        // kenari arasi kalan bosluk" ile SINIRLAR -- max-width'imiz devreye
        // bile girmeden kutu cok dar cikar (butonu sag tarafa yakinken
        // dogrulandi: buton left=297px, viewport=390px -> popover sadece
        // ~93px genislige sikisiyordu). Genisligi ACIKCA vererek bu
        // belirsizligi tamamen ortadan kaldiriyoruz.
        var width = Math.min(MAX_WIDTH, window.innerWidth - MARGIN * 2);
        pop.style.width = width + 'px';
        pop.style.left = Math.min(r.left, window.innerWidth - width - MARGIN) + 'px';
        pop.style.top = (r.bottom + MARGIN) + 'px';
      });
      pop.addEventListener('toggle', function (e) {
        if (e.newState !== 'open') return;
        // Genislik/soldaki konum yukarida zaten viewport'a sigacak sekilde
        // hesaplandi -- burada sadece YUKSEKLIK (icerik uzunlugu onceden
        // bilinemedigi icin) tasarsa butonun USTUNE almak gerekiyor.
        var pr = pop.getBoundingClientRect();
        if (pr.bottom > window.innerHeight - MARGIN) {
          var br = btn.getBoundingClientRect();
          pop.style.top = Math.max(MARGIN, br.top - pr.height - MARGIN) + 'px';
        }
      });
    });
  }

  // <details>/<summary> acilis-kapanisi varsayilan olarak ANINDA ("cat diye")
  // oluyor -- kullanici bunu rahatsiz edici/anlasilmaz buldugunu bildirdi.
  // Web Animations API ile YUKSEKLIGI (height) somut px degerleri arasinda
  // animasyonluyoruz (WAAPI 'auto' degerini interpolate EDEMEZ, bu yuzden
  // offsetHeight/scrollHeight ile olculmus somut px'ler kullaniliyor).
  // Native davranisi bilerek EZIYORUZ (preventDefault + kendi .open atamamiz)
  // ki hem acilista hem kapanista ayni animasyon calissin.
  // ONEMLI: styles.css'teki @media (prefers-reduced-motion: reduce) blogu
  // sadece CSS transition/[data-reveal] icin -- JS-tetiklemeli bu WAAPI
  // animasyonunu YAKALAMAZ, bu yuzden burada AYRICA kontrol ediliyor.
  function initDetailsAnimation() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var DURATION = 200;
    var EASING = 'ease-out';

    document.querySelectorAll('details').forEach(function (details) {
      var summary = details.querySelector('summary');
      if (!summary) return;
      var anim = null;
      var closing = false;
      var expanding = false;

      summary.addEventListener('click', function (e) {
        e.preventDefault();
        details.style.overflow = 'hidden';
        if (closing || !details.open) {
          expand();
        } else if (expanding || details.open) {
          collapse();
        }
      });

      function expand() {
        expanding = true;
        // Kapali yuksekligi ANINDA sabitleyip open=true YAPIYORUZ ki icerik
        // DOM'a girsin (olculebilsin) ama bir sonraki kareye kadar GORSEL
        // olarak hala kapali yukseklikte kalsin (aksi halde tam yukseklige
        // "zip" diye atlayip animasyon anca ONDAN SONRA baslar -- kisa bir
        // cirkin flash olurdu).
        details.style.height = details.offsetHeight + 'px';
        details.open = true;
        window.requestAnimationFrame(function () {
          var startHeight = details.offsetHeight;
          var endHeight = details.scrollHeight;
          if (anim) anim.cancel();
          anim = details.animate(
            { height: [startHeight + 'px', endHeight + 'px'] },
            { duration: DURATION, easing: EASING }
          );
          anim.onfinish = function () { finish(true); };
          anim.oncancel = function () { expanding = false; };
        });
      }

      function collapse() {
        closing = true;
        var startHeight = details.offsetHeight;
        var endHeight = summary.offsetHeight;
        if (anim) anim.cancel();
        anim = details.animate(
          { height: [startHeight + 'px', endHeight + 'px'] },
          { duration: DURATION, easing: EASING }
        );
        anim.onfinish = function () { finish(false); };
        anim.oncancel = function () { closing = false; };
      }

      function finish(isOpen) {
        details.open = isOpen;
        anim = null;
        closing = false;
        expanding = false;
        details.style.height = '';
        details.style.overflow = '';
      }
    });
  }

  function initBulkPanel() {
    el.bulkToggleBtn.addEventListener('click', toggleBulkPanel);
    el.bulkTemplateBtn.addEventListener('click', downloadBulkTemplate);
    el.bulkFileInput.addEventListener('change', handleBulkFileChange);
    el.bulkExportBtn.addEventListener('click', exportBulkResults);
    el.bulkRecalcBtn.addEventListener('click', function () {
      if (bulkParsedRows) renderBulkResults(bulkParsedRows);
    });
  }

  function init() {
    // Ayarlar panelinden ÖNCE hiçbir şey KH'yi okumamalı — KHSettings.init()
    // kullanıcının kayıtlı düzeltmelerini KH'nin canlı nesnelerine burada,
    // ilk hesaplamadan önce uyguluyor (bkz. settings.js başlık notu).
    initSettingsPanel();
    initBulkPanel();
    initInfoPopovers();
    initDetailsAnimation();
    buildResultCards();
    populateSelects();
    renderNotes();
    initTheme();
    renderFreshnessBanner();
    el.dimApply.addEventListener('click', applyDims);

    // #sectorSearch bilinçli olarak bu genel listeden HARİÇ tutuluyor:
    // readInput() onun değerini hiç okumuyor (sadece el.sector.value'yu
    // etkiliyor), bu yüzden buraya recalc bağlamak her tuş vuruşunda
    // gereksiz bir hesaplama daha yapar. Kendi işleyicisi aşağıda.
    // #settingsPanel içindeki input'lar da HARİÇ: bunlar KHSettings.setValue()
    // + recalc()'i KENDİ işleyicisinden (createSettingsInput) zaten çağırıyor;
    // burada da bağlarsak her tuş vuruşunda recalc() iki kez tetiklenirdi.
    // #savedPanel içindeki sırala/sektör filtresi de HARİÇ: bunlar ana formla
    // ilgisiz, kendi işleyicisi (applySavedFiltersAndRender) zaten bağlı.
    var inputs = document.querySelectorAll('input, select');
    inputs.forEach(function (inp) {
      if (inp === el.sectorSearch) return;
      if (inp.closest('#settingsPanel')) return;
      if (inp.closest('#savedPanel')) return;
      if (inp.closest('#bulkPanel')) return;
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
    el.savedSortSelect.addEventListener('change', applySavedFiltersAndRender);
    el.savedSectorFilter.addEventListener('change', applySavedFiltersAndRender);

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
