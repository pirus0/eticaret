(function () {
  'use strict';

  // Renkler artik styles.css'teki --accent-* degiskenlerinden geliyor (tek
  // kaynak orada) — burada sadece platform anahtari -> etiket eslemesi var.
  // Kart/grup rengi CSS'te .amazon/.trendyol/.shopify/.etsy sinif adiyla uygulaniyor.
  var PLATFORM_META = {
    amazon: { label: 'Amazon.com.tr' },
    trendyol: { label: 'Trendyol' },
    shopify: { label: 'Shopify' },
    etsy: { label: 'Etsy' }
  };
  var PLATFORM_ORDER = ['amazon', 'trendyol', 'shopify', 'etsy'];

  var el = {};
  ['cost', 'sector', 'margin', 'carrier', 'desi', 'dimW', 'dimD', 'dimH', 'dimApply',
    'carrierNote', 'ads', 'amazonOverride', 'trendyolOverride', 'shopifyPlan', 'shopifyUnits',
    'etsyPayment', 'etsyOffsite', 'etsyOverThreshold', 'etsyThresholdWrap',
    'summary', 'results', 'notesList', 'liveBar'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  function fmtTRY(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n);
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

  function readInput() {
    var desi = parseFloat(el.desi.value) || 0;
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
      costTRY: parseFloat(el.cost.value) || 0,
      sectorId: el.sector.value,
      marginPct: parseFloat(el.margin.value) || 0,
      kargoTRY: kargoTRY,
      reklamTRY: parseFloat(el.ads.value) || 0,
      amazonOverridePct: el.amazonOverride.value === '' ? null : parseFloat(el.amazonOverride.value),
      trendyolOverridePct: el.trendyolOverride.value === '' ? null : parseFloat(el.trendyolOverride.value),
      shopifyPlanId: el.shopifyPlan.value,
      shopifyMonthlyUnits: parseFloat(el.shopifyUnits.value) || 0,
      etsyPaymentPct: el.etsyPayment.value === '' ? null : parseFloat(el.etsyPayment.value),
      etsyOffsiteAds: el.etsyOffsite.checked,
      etsyOverThreshold: el.etsyOverThreshold.checked
    };
  }

  function renderResults(results) {
    el.results.innerHTML = '';
    var valid = [];

    PLATFORM_ORDER.forEach(function (key) {
      var r = results[key];
      var meta = PLATFORM_META[key];
      var card = document.createElement('article');
      card.className = 'result-card ' + key;

      var html = '<h3>' + meta.label + '</h3>';

      if (r.unavailable) {
        html += '<p class="muted">' + r.reason + '</p>';
      } else if (r.error) {
        html += '<p class="error">' + r.error + '</p>';
      } else {
        valid.push({ key: key, label: meta.label, price: r.price });
        html += '<p class="price">' + fmtTRY(r.price) + '</p>';
        if (r.usedPct != null) {
          html += '<p class="muted">Kullanılan oran: %' + r.usedPct.toFixed(2).replace(/\.00$/, '') + '</p>';
        }
        if (r.monthlySubTRY) {
          html += '<p class="muted">+ aylık abonelik payı: ' + fmtTRY(r.monthlySubTRY) + '/birim</p>';
        }
        html += '<ul class="breakdown">';
        html += '<li><span>Maliyet + kargo + reklam + sabit ücretler</span><span>' + fmtTRY(r.fixedTRY) + '</span></li>';
        r.breakdown.forEach(function (b) {
          html += '<li><span>' + b.label + '</span><span>' + fmtTRY(b.amount) + '</span></li>';
        });
        html += '</ul>';
      }
      card.innerHTML = html;
      el.results.appendChild(card);
    });

    if (valid.length > 1) {
      valid.sort(function (a, b) { return a.price - b.price; });
      var cheapest = valid[0], priciest = valid[valid.length - 1];
      el.summary.innerHTML =
        '<p><strong>' + cheapest.label + '</strong> bu ürün için en düşük satış fiyatıyla aynı kâr marjına ulaşıyor (' + fmtTRY(cheapest.price) + ').' +
        (priciest.key !== cheapest.key ? ' En yüksek fiyat gerektiren: <strong>' + priciest.label + '</strong> (' + fmtTRY(priciest.price) + ').' : '') +
        '</p>';
    } else {
      el.summary.innerHTML = '';
    }
  }

  // Formun altında kalan sonuçlara her seferinde kaydırmadan da "en ucuz kaç
  // paraya satmam lazım" sorusuna anında cevap versin diye üstte sabit duran
  // şerit. Aynı hesaplamayı tekrar kullanıyor, ayrı bir mantık değil.
  function updateLiveBar(results) {
    var valid = PLATFORM_ORDER
      .map(function (key) { return { key: key, r: results[key] }; })
      .filter(function (x) { return x.r && !x.r.unavailable && !x.r.error; });

    if (!valid.length) {
      el.liveBar.innerHTML = '<span class="live-dot"></span><span>Hiçbir platform için fiyat hesaplanamadı — girdileri kontrol edin.</span>';
      return;
    }
    valid.sort(function (a, b) { return a.r.price - b.r.price; });
    var best = valid[0];
    el.liveBar.innerHTML =
      '<span class="live-dot ' + best.key + '"></span>' +
      '<span>En ucuz: <strong>' + PLATFORM_META[best.key].label + '</strong> — ' + fmtTRY(best.r.price) + '</span>';
  }

  // .layout-results'ın sticky "top" değeri, üstteki sabit şeridin (topbar +
  // live-bar) gerçek yüksekliğine göre ayarlanıyor — sabit piksel yazmak yerine.
  function updateStickyOffset() {
    var head = document.querySelector('.sticky-head');
    if (head) document.documentElement.style.setProperty('--sticky-head-h', head.offsetHeight + 'px');
  }

  function recalc() {
    var input = readInput();
    var results = KH.computeAll(input);
    renderResults(results);
    updateLiveBar(results);
    updateStickyOffset();
  }

  function applyDims() {
    var w = parseFloat(el.dimW.value) || 0, d = parseFloat(el.dimD.value) || 0, h = parseFloat(el.dimH.value) || 0;
    if (w > 0 && d > 0 && h > 0) {
      el.desi.value = KH.round2((w * d * h) / 3000);
      recalc();
    }
  }

  function renderNotes() {
    var notes = [
      'Kargo verisi Navlungo Domestic 2026 teklifinden — Aras Kargo kullanıcı isteğiyle listeden çıkarıldı. Tüm kargo fiyatlarına KDV+EPH dahildir.',
      'Amazon.com.tr oranları resmi kaynaktan (satis.amazon.com.tr/ucretlendirme), 16 Nisan 2026 tarifesi. Komisyon üzerine ayrıca %20 KDV eklenir (hesaba dahil edildi).',
      'Trendyol oranları RESMİ DEĞİL — 4 bağımsız kaynaktan (en güncel Temmuz 2026) derlenen yaklaşık değerler. Komisyonun KDV dahil mi hariç mi fiyat üzerinden hesaplandığı kaynaklar arasında çelişkili; kesin oranı satıcı panelinizden teyit edin ve "elle gir" alanına yazın.',
      'Shopify oranları resmi (shopify.com/pricing), USD cinsinden, ' + KH.FX.date + ' kuruyla (1 USD ≈ ' + KH.FX.USD_TRY + ' TL) TL\'ye çevrildi.',
      'Etsy: işlem komisyonu (%6,5) ve Türkiye düzenleyici işletim ücreti (%2,27) çoklu kaynaktan teyitli. Ödeme işleme oranı Türkiye için hiçbir kaynakta netleşmedi — %4 varsayımı tahminidir, elle düzeltilebilir. Offsite Ads ücreti sadece o satış Etsy\'nin site dışı reklamından geldiyse uygulanır (zorunlu, opt-out yok).',
      'Kur anlık görüntüsü ' + KH.FX.date + ' tarihli (doviz.com + xe.com çapraz kontrollü). Uzun vadede canlı bir kur API\'sine bağlanmalı.',
      'Reklam gideri kalemi araştırılmadı — kullanıcı tarafından manuel girilir.'
    ];
    el.notesList.innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
  }

  function init() {
    populateSelects();
    renderNotes();
    el.etsyOffsite.addEventListener('change', function () {
      el.etsyThresholdWrap.style.display = el.etsyOffsite.checked ? '' : 'none';
      recalc();
    });
    el.etsyThresholdWrap.style.display = 'none';
    el.dimApply.addEventListener('click', applyDims);

    var inputs = document.querySelectorAll('input, select');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', recalc);
      inp.addEventListener('change', recalc);
    });

    el.liveBar.addEventListener('click', function () {
      el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.addEventListener('resize', updateStickyOffset);

    recalc();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.error('Service worker kaydı başarısız:', err);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
