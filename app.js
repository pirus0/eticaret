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

  var TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.7 12a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.7-12"/></svg>';
  var IMAGE_PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="22" height="22"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M20 15l-4.5-4.5a1.5 1.5 0 0 0-2.12 0L4 19"/></svg>';

  var el = {};
  ['cost', 'sector', 'margin', 'carrier', 'desi', 'dimW', 'dimD', 'dimH', 'dimApply',
    'carrierNote', 'ads', 'amazonOverride', 'trendyolOverride', 'shopifyPlan', 'shopifyUnits',
    'etsyPayment', 'etsyOffsite', 'etsyOverThreshold', 'etsyThresholdWrap',
    'summary', 'summaryText', 'results', 'notesList', 'liveBar',
    'savedListBtn', 'savedCount', 'saveTrigger',
    'saveDialog', 'saveForm', 'saveDialogClose', 'saveDialogCancel',
    'saveName', 'savePlatform', 'saveImageInput', 'saveImageThumb', 'saveSnapshot',
    'savedPanel', 'savedPanelClose', 'savedEmpty', 'savedList'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  var cardRefs = {};       // platform key -> önceden oluşturulmuş DOM referansları
  var lastInput = null;    // en son readInput() çıktısı (kaydet anlık görüntüsü için)
  var lastResults = null;  // en son KH.computeAll() çıktısı
  var pendingImageDataUrl = null; // kaydet formunda seçilen (yeniden boyutlandırılmış) görsel

  function fmtTRY(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n);
  }

  function fmtDate(ts) {
    try {
      return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
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
        '<p class="muted sub"></p>' +
        '<ul class="breakdown"></ul>' +
        '<p class="error"></p>';
      el.results.appendChild(card);
      cardRefs[key] = {
        card: card,
        price: card.querySelector('.price'),
        pct: card.querySelector('.pct'),
        sub: card.querySelector('.sub'),
        breakdown: card.querySelector('.breakdown'),
        error: card.querySelector('.error')
      };
    });
  }

  function renderResults(results) {
    var valid = [];

    PLATFORM_ORDER.forEach(function (key) {
      var r = results[key];
      var meta = PLATFORM_META[key];
      var ref = cardRefs[key];

      if (r.unavailable || r.error) {
        ref.card.classList.add('is-unavailable');
        setText(ref.price, '', false);
        ref.pct.textContent = '';
        ref.sub.textContent = '';
        ref.breakdown.innerHTML = '';
        ref.error.textContent = r.unavailable ? r.reason : r.error;
        return;
      }

      ref.card.classList.remove('is-unavailable');
      valid.push({ key: key, label: meta.label, price: r.price });
      setText(ref.price, fmtTRY(r.price), true);
      ref.error.textContent = '';
      ref.pct.textContent = r.usedPct != null ? ('Kullanılan oran: %' + r.usedPct.toFixed(2).replace(/\.00$/, '')) : '';
      ref.sub.textContent = r.monthlySubTRY ? ('+ aylık abonelik payı: ' + fmtTRY(r.monthlySubTRY) + '/birim') : '';

      var bhtml = '<li><span>Maliyet + kargo + reklam + sabit ücretler</span><span>' + fmtTRY(r.fixedTRY) + '</span></li>';
      r.breakdown.forEach(function (b) {
        bhtml += '<li><span>' + b.label + '</span><span>' + fmtTRY(b.amount) + '</span></li>';
      });
      ref.breakdown.innerHTML = bhtml;
    });

    if (valid.length > 1) {
      valid.sort(function (a, b) { return a.price - b.price; });
      var cheapest = valid[0], priciest = valid[valid.length - 1];
      el.summaryText.innerHTML =
        '<strong>' + cheapest.label + '</strong> bu ürün için en düşük satış fiyatıyla aynı kâr marjına ulaşıyor (' + fmtTRY(cheapest.price) + ').' +
        (priciest.key !== cheapest.key ? ' En yüksek fiyat gerektiren: <strong>' + priciest.label + '</strong> (' + fmtTRY(priciest.price) + ').' : '');
    } else if (valid.length === 1) {
      el.summaryText.innerHTML = '<strong>' + valid[0].label + '</strong> için hesaplanan satış fiyatı: ' + fmtTRY(valid[0].price) + '.';
    } else {
      el.summaryText.textContent = '';
    }
    el.saveTrigger.disabled = valid.length === 0;
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

  // .layout-results'ın sticky "top" değeri ve #results'ın scroll-margin'i,
  // üstteki sabit şeridin (topbar + live-bar) GERÇEK yüksekliğine göre
  // ayarlanıyor — kaydırınca topbar küçüldüğü için bu deger de değişir.
  function updateStickyOffset() {
    var head = document.querySelector('.sticky-head');
    if (head) document.documentElement.style.setProperty('--sticky-head-h', head.offsetHeight + 'px');
  }

  function recalc() {
    lastInput = readInput();
    lastResults = KH.computeAll(lastInput);
    renderResults(lastResults);
    updateLiveBar(lastResults);
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
      'Trendyol oranları RESMİ DEĞİL — 4 bağımsız kaynaktan (en güncel Temmuz 2026) derlenen yaklaşık değerler. Komisyonun KDV dahil mi hariç mi fiyat üzerinden hesaplandığı kaynaklar arasında çelişkili; kesin oranı satıcı panelinizden teyit edip ilgili alana yazabilirsiniz.',
      'Shopify oranları resmi (shopify.com/pricing), USD cinsinden, ' + KH.FX.date + ' kuruyla (1 USD ≈ ' + KH.FX.USD_TRY + ' TL) TL\'ye çevrildi.',
      'Etsy: işlem komisyonu (%6,5) ve Türkiye düzenleyici işletim ücreti (%2,27) çoklu kaynaktan teyitli. Ödeme işleme oranı Türkiye için hiçbir kaynakta netleşmedi — %4 varsayımı tahminidir, değiştirilebilir. Offsite Ads ücreti sadece o satış Etsy\'nin site dışı reklamından geldiyse uygulanır (zorunlu, opt-out yok).',
      'Kur anlık görüntüsü ' + KH.FX.date + ' tarihli (doviz.com + xe.com çapraz kontrollü). Uzun vadede canlı bir kur API\'sine bağlanmalı.',
      'Reklam gideri kalemi araştırılmadı — kullanıcı tarafından girilir.',
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

  function resetSaveForm() {
    el.saveForm.reset();
    pendingImageDataUrl = null;
    el.saveImageThumb.innerHTML = IMAGE_PLACEHOLDER_SVG;
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
    resizeImageFile(file, 640, 0.82).then(function (dataUrl) {
      pendingImageDataUrl = dataUrl;
      el.saveImageThumb.innerHTML = '<img src="' + dataUrl + '" alt="" />';
    }).catch(function () {
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

  function openSavedPanel() {
    KHStore.getAll().then(function (items) {
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
    KHStore.deleteItem(id).then(function () {
      return KHStore.getAll();
    }).then(function (items) {
      renderSavedList(items);
      return refreshSavedCount();
    }).catch(function (err) {
      console.error('Silme başarısız:', err);
      btn.disabled = false;
    });
  }

  function init() {
    buildResultCards();
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
