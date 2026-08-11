#!/usr/bin/env python3
"""index.html'i gercek bir tarayicida (Chromium/Playwright) acip uctan uca dogrular:
- temel hesaplama akisi (onceki surumden tasindi),
- yeni tasarim: gradyan yok, renk kodlama, kaydirinca beliren icerik, sabit
  seridin kaydirinca sikismasi,
- kopya duzeltmesi: "sen gireceksin" / "elle gir" gibi emir kipli metin kalmamis,
- kayit ozelligi: kaydet diyalogu, IndexedDB'ye yazma, kayitli urunler paneli,
  silme, rozet sayaci, gorsel yukleme.
Kullanim: python3 scripts/verify_ui.py (once `python3 -m http.server 8934` calisir olmali)
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8934"
failures = []


def check(name, cond, detail=""):
    status = "OK  " if cond else "FAIL"
    print(f"{status} {name}" + (f" -> {detail}" if detail else ""))
    if not cond:
        failures.append(name)


def main():
    console_errors = []
    failed_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 390, "height": 844})

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.on("response", lambda res: failed_requests.append((res.url, res.status)) if res.status >= 400 else None)

        page.goto(f"{BASE}/index.html", wait_until="networkidle")

        check("Konsol hatasi yok", len(console_errors) == 0, "; ".join(console_errors))
        check("Basarisiz agi istegi yok (>=400)", len(failed_requests) == 0, str(failed_requests))
        check("Sayfa basligi dogru", page.title() == "Kâr Marjı Hesaplayıcı")

        # ============== TEMEL HESAPLAMA AKISI (regresyon) ==============
        sector_options = page.eval_on_selector("#sector", "el => el.options.length")
        check("Sektor secenekleri yuklendi", sector_options > 5, f"{sector_options} secenek")

        cards = page.query_selector_all(".result-card")
        check("7 platform karti render edildi", len(cards) == 7, f"{len(cards)} kart")

        prices = page.eval_on_selector_all(".result-card .price", "els => els.map(e => e.textContent)")
        check("Tum kartlarda fiyat var", all(p.strip() not in ("", "—") for p in prices), str(prices))

        live_bar_text = page.eval_on_selector("#liveBar", "el => el.textContent")
        check("Live-bar dolu", len(live_bar_text.strip()) > 0, live_bar_text[:80])

        border_colors = page.eval_on_selector_all(".result-card", "els => els.map(e => getComputedStyle(e).borderTopColor)")
        check("7 kartin ust kenarligi 7 farkli renk", len(set(border_colors)) == 7, str(border_colors))

        group_classes = page.eval_on_selector_all(".platform-group", "els => els.map(e => e.className)")
        check("7 platform grubu var", len(group_classes) == 7, str(group_classes))

        old_price = page.eval_on_selector(".result-card .price", "e => e.textContent")
        cost_input = page.query_selector("#cost")
        cost_input.click(click_count=3)
        cost_input.type("500")
        page.wait_for_timeout(200)
        new_price = page.eval_on_selector(".result-card .price", "e => e.textContent")
        check("Maliyet degisince fiyat canli guncelleniyor", old_price != new_price, f"{old_price} -> {new_price}")

        pulse_class = page.eval_on_selector(".result-card .price", "e => e.className")
        check("Fiyat degisince pulse animasyon sinifi ekleniyor", "pulse" in pulse_class, pulse_class)

        carrier_note = page.eval_on_selector("#carrierNote", "el => el.textContent")
        check("Kargo notu dolduruldu", len(carrier_note.strip()) > 0, carrier_note)

        page.click("details.dims > summary")
        page.fill("#dimW", "40")
        page.fill("#dimD", "30")
        page.fill("#dimH", "20")
        page.click("#dimApply")
        page.wait_for_timeout(200)
        desi_val = page.eval_on_selector("#desi", "el => el.value")
        check("Desi, olculerden dogru hesaplandi (40*30*20/3000=8)", desi_val == "8", desi_val)

        wrap_display_before = page.eval_on_selector("#etsyThresholdWrap", "el => getComputedStyle(el).display")
        check("Esik alani basta gizli", wrap_display_before == "none", wrap_display_before)
        page.click("details.advanced > summary")
        page.check("#etsyOffsite")
        page.wait_for_timeout(100)
        wrap_display_after = page.eval_on_selector("#etsyThresholdWrap", "el => getComputedStyle(el).display")
        check("Offsite isaretlenince esik alani gorunuyor", wrap_display_after != "none", wrap_display_after)

        margin_input = page.query_selector("#margin")
        margin_input.click(click_count=3)
        margin_input.type("95")
        page.wait_for_timeout(200)
        error_texts = page.eval_on_selector_all(".result-card .error", "els => els.map(e => e.textContent).filter(t => t.trim())")
        check("Asiri yuksek kar hedefinde hata mesaji gosteriliyor", len(error_texts) > 0, str(error_texts))
        margin_input.click(click_count=3)
        margin_input.type("20")
        page.wait_for_timeout(200)

        # ============== KARGO: PLATFORM BAZLI MODEL (10 Agustos 2026 arastirmasi) ==============
        # details.advanced yukarida (Etsy offsite testi icin) zaten acildi.
        trendyol_price_before = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        amazon_price_before = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        page.fill("#trendyolKargoOverride", "500")
        page.wait_for_timeout(200)
        trendyol_price_after = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        amazon_price_after = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        check("Trendyol kargo override girilince Trendyol fiyati degisiyor",
              trendyol_price_before != trendyol_price_after, f"{trendyol_price_before} -> {trendyol_price_after}")
        check("Trendyol kargo override Amazon fiyatini ETKILEMIYOR (platform bazli izolasyon)",
              amazon_price_before == amazon_price_after, f"{amazon_price_before} -> {amazon_price_after}")
        page.fill("#trendyolKargoOverride", "")
        page.wait_for_timeout(200)

        # Etsy kendi kargo alanini kullanmali; paylasilan desi/tasiyici degisince fiyati ETKILENMEMELI.
        etsy_price_before_shared = page.eval_on_selector(".result-card.etsy .price", "e => e.textContent")
        desi_input = page.query_selector("#desi")
        desi_input.click(click_count=3)
        desi_input.type("25")
        page.wait_for_timeout(200)
        etsy_price_after_shared = page.eval_on_selector(".result-card.etsy .price", "e => e.textContent")
        check("Etsy fiyati paylasilan kargo/desi degisince ETKILENMIYOR (ayri alan kullanir)",
              etsy_price_before_shared == etsy_price_after_shared, f"{etsy_price_before_shared} -> {etsy_price_after_shared}")

        page.fill("#etsyKargo", "300")
        page.wait_for_timeout(200)
        etsy_price_after_own = page.eval_on_selector(".result-card.etsy .price", "e => e.textContent")
        check("Etsy kendi kargo alani doldurulunca Etsy fiyati degisiyor",
              etsy_price_after_shared != etsy_price_after_own, f"{etsy_price_after_shared} -> {etsy_price_after_own}")
        page.fill("#etsyKargo", "0")
        desi_input.click(click_count=3)
        desi_input.type("3")
        page.wait_for_timeout(200)

        # ============== GIDER KALEMLERI: 2. TUR (10 Agustos 2026 audit) ==============
        # Trendyol hizmet bedeli alani sadece Trendyol fiyatini etkilemeli.
        hizmet_trendyol_before = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        hizmet_amazon_before = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        page.fill("#trendyolHizmetBedeli", "50")
        page.wait_for_timeout(200)
        hizmet_trendyol_after = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        hizmet_amazon_after = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        check("Trendyol hizmet bedeli girilince Trendyol fiyati degisiyor",
              hizmet_trendyol_before != hizmet_trendyol_after, f"{hizmet_trendyol_before} -> {hizmet_trendyol_after}")
        check("Trendyol hizmet bedeli Amazon fiyatini ETKILEMIYOR (platform bazli izolasyon)",
              hizmet_amazon_before == hizmet_amazon_after, f"{hizmet_amazon_before} -> {hizmet_amazon_after}")
        page.fill("#trendyolHizmetBedeli", "")
        page.wait_for_timeout(200)

        # Shopify odeme saglayici alanlari (gateway % + sabit ucret) sadece Shopify fiyatini etkilemeli.
        shopify_before = page.eval_on_selector(".result-card.shopify .price", "e => e.textContent")
        trendyol_before_sf = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        gateway_pct_input = page.query_selector("#shopifyGatewayPct")
        gateway_pct_input.click(click_count=3)
        gateway_pct_input.type("6")
        page.fill("#shopifyGatewayFixedTRY", "20")
        page.wait_for_timeout(200)
        shopify_after = page.eval_on_selector(".result-card.shopify .price", "e => e.textContent")
        trendyol_after_sf = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        check("Shopify odeme saglayici alanlari girilince Shopify fiyati degisiyor",
              shopify_before != shopify_after, f"{shopify_before} -> {shopify_after}")
        check("Shopify odeme saglayici alanlari Trendyol fiyatini ETKILEMIYOR (platform bazli izolasyon)",
              trendyol_before_sf == trendyol_after_sf, f"{trendyol_before_sf} -> {trendyol_after_sf}")
        gateway_pct_input.click(click_count=3)
        gateway_pct_input.type("2.65")
        page.fill("#shopifyGatewayFixedTRY", "0")
        page.wait_for_timeout(200)

        # Iade (return) alanlari: Amazon/Trendyol/Shopify fiyatini ARTIRMALI, Etsy'yi ETKILEMEMELI (kapsam disi).
        amazon_before_iade = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        trendyol_before_iade = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        shopify_before_iade = page.eval_on_selector(".result-card.shopify .price", "e => e.textContent")
        etsy_before_iade = page.eval_on_selector(".result-card.etsy .price", "e => e.textContent")
        page.fill("#iadeOrani", "30")
        page.fill("#iadeMaliyet", "80")
        page.wait_for_timeout(200)
        amazon_after_iade = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        trendyol_after_iade = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        shopify_after_iade = page.eval_on_selector(".result-card.shopify .price", "e => e.textContent")
        etsy_after_iade = page.eval_on_selector(".result-card.etsy .price", "e => e.textContent")
        check("Iade orani/maliyeti girilince Amazon fiyati ARTIYOR",
              amazon_before_iade != amazon_after_iade, f"{amazon_before_iade} -> {amazon_after_iade}")
        check("Iade orani/maliyeti girilince Trendyol fiyati ARTIYOR",
              trendyol_before_iade != trendyol_after_iade, f"{trendyol_before_iade} -> {trendyol_after_iade}")
        check("Iade orani/maliyeti girilince Shopify fiyati ARTIYOR",
              shopify_before_iade != shopify_after_iade, f"{shopify_before_iade} -> {shopify_after_iade}")
        check("Iade orani/maliyeti Etsy fiyatini ETKILEMIYOR (kapsam disi — yurt disi satis)",
              etsy_before_iade == etsy_after_iade, f"{etsy_before_iade} -> {etsy_after_iade}")
        page.fill("#iadeOrani", "0")
        page.fill("#iadeMaliyet", "0")
        page.wait_for_timeout(200)

        # ============== YENI PAZARYERLERI: n11 / Shopier (3. tur, 10 Agustos 2026) ==============
        n11_before = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        shopier_before_n11 = page.eval_on_selector(".result-card.shopier .price", "e => e.textContent")
        page.fill("#n11Override", "15")
        page.wait_for_timeout(200)
        n11_after = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        shopier_after_n11 = page.eval_on_selector(".result-card.shopier .price", "e => e.textContent")
        check("n11 komisyon override girilince n11 fiyati degisiyor",
              n11_before != n11_after, f"{n11_before} -> {n11_after}")
        check("n11 komisyon override Shopier fiyatini ETKILEMIYOR (platform bazli izolasyon)",
              shopier_before_n11 == shopier_after_n11, f"{shopier_before_n11} -> {shopier_after_n11}")
        page.fill("#n11Override", "")
        page.wait_for_timeout(200)

        # n11 kargo override: n11'in kargo secimi ZORUNLU kapali bir liste
        # (Trendyol'la ayni desen) -- dokumantasyon yazilirken n11'in kendi
        # resmi destek sayfasiyla dogrulanip duzeltildi (ilk surumde "serbest"
        # saniliyordu, bkz. calc.js basi 3. tur notu). Girilirse paylasilan
        # kargoTRY yerine kullanilmali; Shopier'i (izole platform) ETKILEMEMELI.
        n11_kargo_before = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        shopier_before_n11kargo = page.eval_on_selector(".result-card.shopier .price", "e => e.textContent")
        page.fill("#n11KargoOverride", "500")
        page.wait_for_timeout(200)
        n11_kargo_after = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        shopier_after_n11kargo = page.eval_on_selector(".result-card.shopier .price", "e => e.textContent")
        check("n11 kargo override girilince n11 fiyati degisiyor",
              n11_kargo_before != n11_kargo_after, f"{n11_kargo_before} -> {n11_kargo_after}")
        check("n11 kargo override Shopier fiyatini ETKILEMIYOR (platform bazli izolasyon)",
              shopier_before_n11kargo == shopier_after_n11kargo, f"{shopier_before_n11kargo} -> {shopier_after_n11kargo}")
        page.fill("#n11KargoOverride", "")
        page.wait_for_timeout(200)

        shopier_before = page.eval_on_selector(".result-card.shopier .price", "e => e.textContent")
        n11_before_sh = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        page.fill("#shopierOverride", "8")
        page.wait_for_timeout(200)
        shopier_after = page.eval_on_selector(".result-card.shopier .price", "e => e.textContent")
        n11_after_sh = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        check("Shopier komisyon override girilince Shopier fiyati degisiyor",
              shopier_before != shopier_after, f"{shopier_before} -> {shopier_after}")
        check("Shopier komisyon override n11 fiyatini ETKILEMIYOR (platform bazli izolasyon)",
              n11_before_sh == n11_after_sh, f"{n11_before_sh} -> {n11_after_sh}")
        page.fill("#shopierOverride", "")
        page.wait_for_timeout(200)

        # n11 verisi olmayan bir sektorde (saat) karti "unavailable" gostermeli.
        page.select_option("#sector", "saat")
        page.wait_for_timeout(200)
        n11_unavailable = page.eval_on_selector(".result-card.n11", "el => el.classList.contains('is-unavailable')")
        check("n11 verisi olmayan sektorde n11 karti 'unavailable' isaretleniyor", n11_unavailable)
        page.select_option("#sector", "giyim")
        page.wait_for_timeout(200)

        # ============== SEKTOR ARAMA ==============
        # Arama, <select>'in secenek listesini degistirmeden ("filtrelemeden")
        # sadece ilk eslesen etikete atlamali (bkz. app.js handleSectorSearch) —
        # bu yuzden secenek sayisi once/sonra AYNI kalmali.
        sector_options_before_search = page.eval_on_selector("#sector", "el => el.options.length")
        page.fill("#sectorSearch", "ayakkab")
        page.wait_for_timeout(200)
        sector_value_after_search = page.eval_on_selector("#sector", "el => el.value")
        sector_options_after_search = page.eval_on_selector("#sector", "el => el.options.length")
        check("Sektor arama dogru sektore atliyor (ayakkab -> ayakkabi)", sector_value_after_search == "ayakkabi", sector_value_after_search)
        check("Sektor arama <select> secenek listesini DEGISTIRMIYOR", sector_options_after_search == sector_options_before_search,
              f"{sector_options_before_search} -> {sector_options_after_search}")
        page.fill("#sectorSearch", "")
        page.select_option("#sector", "giyim")
        page.wait_for_timeout(200)

        # ============== MOD GECISI: maliyetten fiyat <-> fiyattan kar ==============
        forward_active = page.eval_on_selector("#modeForwardBtn", "el => el.classList.contains('is-active')")
        check("Baslangicta 'Maliyetten fiyat' modu aktif", forward_active)
        # NOT: sadece el.hidden (IDL ozelligi) degil, GERCEK gorunurlugu
        # (computed display) de kontrol ediyoruz -- [hidden] ozniteligi
        # herhangi bir yazar CSS kurali tarafindan (ör. .field{display:flex})
        # sessizce ezilebilir; 10 Agustos 2026'da tam bu sekilde bir hata
        # yakalandi (ekran goruntusuyle, el.hidden testi GECIYORDU ama alan
        # GORUNUYORDU). Bkz. styles.css [hidden]{display:none !important}.
        margin_field_visible = page.eval_on_selector("#marginField", "el => !el.hidden && getComputedStyle(el).display !== 'none'")
        target_field_hidden = page.eval_on_selector("#targetPriceFieldWrap", "el => el.hidden && getComputedStyle(el).display === 'none'")
        check("Ileri modda hedef-kar alani GERCEKTEN gorunur, hedef-fiyat alani GERCEKTEN gizli",
              margin_field_visible and target_field_hidden)

        page.click("#modeReverseBtn")
        page.wait_for_timeout(200)
        reverse_active = page.eval_on_selector("#modeReverseBtn", "el => el.classList.contains('is-active')")
        reverse_aria = page.eval_on_selector("#modeReverseBtn", "el => el.getAttribute('aria-pressed')")
        check("'Fiyattan kar' moduna gecince buton aktifleniyor", reverse_active)
        check("'Fiyattan kar' modunda aria-pressed=true", reverse_aria == "true", reverse_aria)
        margin_field_hidden_rev = page.eval_on_selector("#marginField", "el => el.hidden && getComputedStyle(el).display === 'none'")
        target_field_visible_rev = page.eval_on_selector("#targetPriceFieldWrap", "el => !el.hidden && getComputedStyle(el).display !== 'none'")
        check("Ters modda hedef-fiyat alani GERCEKTEN gorunur, hedef-kar alani GERCEKTEN gizli",
              margin_field_hidden_rev and target_field_visible_rev)

        page.fill("#targetPrice", "500")
        page.wait_for_timeout(250)
        reverse_price_text = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        check("Ters modda kart yuzde (%) gosteriyor, para birimi degil", "%" in reverse_price_text, reverse_price_text)
        save_disabled_reverse = page.eval_on_selector("#saveTrigger", "el => el.disabled")
        check("Ters modda 'Kaydet' devre disi (kaydetme sablonu fiyat/breakdown varsayar)", save_disabled_reverse)

        # Zarar senaryosu: cok dusuk bir fiyat girilince negatif marj + .is-negative sinifi beklenir.
        page.fill("#targetPrice", "1")
        page.wait_for_timeout(250)
        loss_class = page.eval_on_selector(".result-card.amazon .price", "e => e.className")
        check("Ters modda zarar senaryosunda .is-negative sinifi ekleniyor", "is-negative" in loss_class, loss_class)

        page.click("#modeForwardBtn")
        page.wait_for_timeout(200)
        forward_active_again = page.eval_on_selector("#modeForwardBtn", "el => el.classList.contains('is-active')")
        forward_price_text = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        check("'Maliyetten fiyat' moduna geri donunce buton aktifleniyor", forward_active_again)
        check("Ileri moda donunce kart tekrar para birimi gosteriyor", "%" not in forward_price_text, forward_price_text)

        # ============== GUNCELLIK SERIDI (freshness banner) ==============
        freshness_text = page.eval_on_selector("#freshnessBanner", "el => el.textContent")
        check("Guncellik seridi dolu (kur/oran veri tarihini gosteriyor)", len(freshness_text.strip()) > 0, freshness_text)

        # ============== KARANLIK / ACIK TEMA ==============
        dark_before = page.evaluate("document.body.classList.contains('dark-theme')")
        check("Baslangicta karanlik tema KAPALI (sistem tercihi acik varsayildi)", not dark_before)
        bg_before = page.eval_on_selector("body", "el => getComputedStyle(el).backgroundColor")
        page.click("#themeToggleBtn")
        page.wait_for_timeout(350)  # renk geçiş animasyonunun bitmesini bekle
        dark_after = page.evaluate("document.body.classList.contains('dark-theme')")
        bg_after = page.eval_on_selector("body", "el => getComputedStyle(el).backgroundColor")
        check("Tema dugmesine tiklayinca karanlik tema ACILIYOR", dark_after)
        check("Karanlik temada sayfa arkaplan rengi degisiyor", bg_before != bg_after, f"{bg_before} -> {bg_after}")
        stored_theme = page.evaluate("localStorage.getItem('kh-theme')")
        check("Tema tercihi localStorage'a yaziliyor", stored_theme == "dark", stored_theme)
        topbar_bg_dark = page.eval_on_selector(".sticky-head", "el => getComputedStyle(el).backgroundColor")
        check("Karanlik temada ustteki chrome seridi HALA koyu (tema gecisine katilmiyor)",
              topbar_bg_dark == "rgb(23, 22, 15)", topbar_bg_dark)

        # Sayfa yenilenince tercih kalici olmali.
        page.reload(wait_until="networkidle")
        dark_after_reload = page.evaluate("document.body.classList.contains('dark-theme')")
        check("Sayfa yenilenince karanlik tema tercihi KALICI", dark_after_reload)

        # Tekrar acik temaya don (sonraki testler acik temayi varsayiyor).
        page.click("#themeToggleBtn")
        page.wait_for_timeout(350)
        dark_final = page.evaluate("document.body.classList.contains('dark-theme')")
        check("Tekrar tiklayinca acik temaya donuyor", not dark_final)

        # ============== YENI TASARIM ==============
        summary_bg_image = page.eval_on_selector("#summary", "el => getComputedStyle(el).backgroundImage")
        check("Ozet blogunda gradyan YOK", summary_bg_image == "none", summary_bg_image)
        topbar_bg_image = page.eval_on_selector(".topbar", "el => getComputedStyle(el).backgroundImage")
        check("Topbar'da gradyan YOK", topbar_bg_image == "none", topbar_bg_image)
        live_bar_bg_image = page.eval_on_selector(".live-bar", "el => getComputedStyle(el).backgroundImage")
        check("Live-bar'da gradyan YOK", live_bar_bg_image == "none", live_bar_bg_image)

        body_text = page.eval_on_selector("body", "el => el.innerText")
        check('Emir kipli "sen gireceksin" metni kalmamis', "sen gireceksin" not in body_text.lower())
        check('Emir kipli "elle gir" metni kalmamis', "elle gir" not in body_text.lower())
        opt_tags = page.eval_on_selector_all(".field-tag", "els => els.map(e => e.textContent)")
        check("Opsiyonel/Tahmini etiketleri var", len(opt_tags) >= 4, str(opt_tags))

        # Kaydirmadan once, asagida kalan bir eleman gorunmez olmali; kaydirinca gorunur olmali.
        page.evaluate("document.querySelector('#notesList').closest('[data-reveal]') && document.querySelector('#notesList').closest('[data-reveal]').scrollIntoView === undefined")
        reveal_before = page.eval_on_selector("details.notes", "el => getComputedStyle(el).opacity")
        check("Asagidaki data-reveal eleman kaydirilmadan once gizli/yari-saydam", float(reveal_before) < 1,
              f"opacity={reveal_before}")
        page.eval_on_selector("details.notes", "el => el.scrollIntoView({block:'center'})")
        page.wait_for_timeout(900)
        reveal_after = page.eval_on_selector("details.notes", "el => getComputedStyle(el).opacity")
        check("Kaydirinca data-reveal eleman gorunur oluyor", float(reveal_after) == 1, f"opacity={reveal_after}")

        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(200)
        is_scrolled_top = page.evaluate("document.body.classList.contains('is-scrolled')")
        check("Sayfa basinda is-scrolled YOK", not is_scrolled_top)
        brand_size_top = page.eval_on_selector(".brand", "el => parseFloat(getComputedStyle(el).fontSize)")
        page.evaluate("window.scrollTo(0, 900)")
        page.wait_for_timeout(300)
        is_scrolled_down = page.evaluate("document.body.classList.contains('is-scrolled')")
        brand_size_scrolled = page.eval_on_selector(".brand", "el => parseFloat(getComputedStyle(el).fontSize)")
        check("Kaydirinca is-scrolled ekleniyor", is_scrolled_down)
        check("Kaydirinca baslik kucgeneralliyor (sikisiyor)", brand_size_scrolled < brand_size_top,
              f"{brand_size_top} -> {brand_size_scrolled}")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        # ============== KAYIT OZELLIGI ==============
        save_disabled = page.eval_on_selector("#saveTrigger", "el => el.disabled")
        check("Kaydet ikonu gecerli hesaplamada aktif", save_disabled is False, save_disabled)

        page.click("#saveTrigger")
        page.wait_for_timeout(300)
        dialog_open = page.eval_on_selector("#saveDialog", "el => el.open")
        check("Kaydet diyalogu aciliyor", dialog_open)

        snapshot_text = page.eval_on_selector("#saveSnapshot", "el => el.textContent")
        check("Kaydet diyalogunda anlik gorunum dolu", len(snapshot_text.strip()) > 0, snapshot_text[:80])

        page.fill("#saveName", "Test Ürünü — Kışlık Kaban")
        page.select_option("#savePlatform", "shopify")

        # Kucuk bir test PNG'si olustur ve yukle (gorsel islenip kucuk resme donusuyor mu?)
        import base64, tempfile, os as _os
        png_1x1 = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
        tmp_png = _os.path.join(tempfile.gettempdir(), "kh_test_upload.png")
        with open(tmp_png, "wb") as f:
            f.write(png_1x1)
        page.set_input_files("#saveImageInput", tmp_png)
        page.wait_for_timeout(400)
        thumb_has_img = page.eval_on_selector("#saveImageThumb", "el => !!el.querySelector('img')")
        check("Gorsel secilince onizleme thumbnail'e islendi", thumb_has_img)

        count_before = page.eval_on_selector("#savedCount", "el => el.textContent")
        page.click("#saveDialog button[type=submit]")
        page.wait_for_timeout(500)
        dialog_closed = page.eval_on_selector("#saveDialog", "el => el.open")
        check("Kaydedince diyalog kapaniyor", dialog_closed is False)
        count_after = page.eval_on_selector("#savedCount", "el => el.textContent")
        check("Kaydedince rozet sayaci artiyor", count_before != count_after and count_after == "1",
              f"{count_before} -> {count_after}")
        badge_bg = page.eval_on_selector("#savedCount", "el => getComputedStyle(el).backgroundColor")
        check("Rozet rengi Trendyol turuncusu DEGIL (notr ink/paper temasi)", badge_bg != "rgb(235, 104, 52)", badge_bg)

        db_count = page.evaluate("() => KHStore.count()")
        check("IndexedDB'de gercekten 1 kayit var", db_count == 1, db_count)
        db_item = page.evaluate("() => KHStore.getAll().then(items => items[0])")
        check("Kayit adi dogru", db_item.get("name") == "Test Ürünü — Kışlık Kaban", db_item.get("name"))
        check("Kayit oncelikli platformu dogru", db_item.get("prioritySite") == "shopify", db_item.get("prioritySite"))
        check("Kayitta gorsel (data URL) var", bool(db_item.get("image")) and db_item["image"].startswith("data:image"),
              str(db_item.get("image"))[:40])
        check("Kayitta girdi/sonuc anlik goruntusu var",
              bool(db_item.get("input")) and bool(db_item.get("results")), "input/results eksik" if not (db_item.get("input") and db_item.get("results")) else "ok")

        # Kayitli urunler paneli
        page.click("#savedListBtn")
        page.wait_for_timeout(400)
        panel_open = page.eval_on_selector("#savedPanel", "el => el.open")
        check("Kayitli urunler paneli aciliyor", panel_open)
        saved_cards = page.query_selector_all(".saved-card")
        check("Panelde 1 kayitli kart gorunuyor", len(saved_cards) == 1, len(saved_cards))
        saved_name = page.eval_on_selector(".saved-card h4", "el => el.textContent")
        check("Kart basliginda urun adi dogru", saved_name == "Test Ürünü — Kışlık Kaban", saved_name)
        saved_thumb_img = page.eval_on_selector(".saved-card .saved-thumb", "el => !!el.querySelector('img')")
        check("Kayitli kartta gorsel gosteriliyor", saved_thumb_img)
        empty_hidden = page.eval_on_selector("#savedEmpty", "el => getComputedStyle(el).display")
        check("Bos-durum mesaji kayit varken gizli", empty_hidden == "none", empty_hidden)

        # ============== KAYITLI ÜRÜNLER PANOSU (özet + sıralama/filtre) ==============
        # Tek kayıtla (yukarıdaki UI akışıyla eklenen) anlamlı bir sıralama/filtre
        # testi yapılamaz — KHStore'a doğrudan (computeAll ile GERÇEK sonuçlar
        # üretilerek) 2 sentetik kayıt daha ekleniyor, farklı sektör + farklı
        # birim kâr sırası garanti edilecek şekilde. Testler bitince ikisi de
        # silinip panel orijinal (tek kayıtlı) haline döndürülüyor ki aşağıdaki
        # "Silme" testi (tek kart bekliyor) bozulmasın.
        panel_toolbar_hidden_before = page.eval_on_selector("#savedToolbar", "el => el.hidden")
        check("Tek kayitla panosu (toolbar) HENUZ gizli degil (1 kayit da gosterilir)", panel_toolbar_hidden_before is False, panel_toolbar_hidden_before)
        page.click("#savedPanelClose")
        page.wait_for_timeout(200)

        seed = page.evaluate("""
            () => {
              var specs = [
                { name: 'Test Panosu B', sectorId: 'telefon', costTRY: 200, marginPct: 15, prioritySite: 'trendyol' },
                { name: 'Test Panosu C', sectorId: 'ayakkabi', costTRY: 50, marginPct: 30, prioritySite: 'amazon' }
              ];
              var chain = Promise.resolve();
              var out = [];
              specs.forEach(function (spec) {
                var input = { costTRY: spec.costTRY, sectorId: spec.sectorId, marginPct: spec.marginPct,
                  kargoTRY: 30, reklamTRY: 0, shopifyPlanId: 'basic', etsyPaymentPct: 4,
                  etsyOffsiteAds: false, etsyOverThreshold: false, monthlyUnits: 0 };
                var results = KH.computeAll(input);
                var rec = { name: spec.name, prioritySite: spec.prioritySite, image: null,
                  createdAt: Date.now(), input: input, results: results };
                chain = chain.then(function () { return KHStore.addItem(rec); }).then(function (id) {
                  out.push({ id: id, name: spec.name, sectorId: spec.sectorId,
                    birimKarTRY: results[spec.prioritySite] ? results[spec.prioritySite].birimKarTRY : null });
                });
              });
              return chain.then(function () { return out; });
            }
        """)
        check("2 sentetik kayit KHStore'a eklendi", len(seed) == 2 and all(s["birimKarTRY"] is not None for s in seed), seed)

        record_a_sector = db_item["input"]["sectorId"]
        record_a_birim_kar = db_item["results"]["shopify"]["birimKarTRY"]
        by_name = {"Test Ürünü — Kışlık Kaban": record_a_birim_kar}
        for s in seed:
            by_name[s["name"]] = s["birimKarTRY"]
        expected_desc = [n for n, _ in sorted(by_name.items(), key=lambda kv: -kv[1])]
        expected_asc = list(reversed(expected_desc))

        page.click("#savedListBtn")
        page.wait_for_timeout(400)
        saved_cards_3 = page.query_selector_all(".saved-card")
        check("3 kayitla panelde 3 kart gorunuyor", len(saved_cards_3) == 3, len(saved_cards_3))

        toolbar_hidden_3 = page.eval_on_selector("#savedToolbar", "el => el.hidden")
        check("3 kayitla ozet panosu (toolbar) GORUNUYOR", toolbar_hidden_3 is False, toolbar_hidden_3)
        summary_count = page.eval_on_selector("#savedSummaryCount", "el => el.textContent")
        check("Ozet: toplam urun sayisi dogru", summary_count == "3", summary_count)
        summary_birimkar = page.eval_on_selector("#savedSummaryBirimKar", "el => el.textContent")
        check("Ozet: toplam birim kar bos/tire DEGIL (3 urunun 3'u de hesaplanabilir)", summary_birimkar != "—", summary_birimkar)
        rank_items = page.query_selector_all("#savedPlatformRank li")
        check("Platform siralamasinda en az 1 satir var ('hesaplanamiyor' fallback'i degil)",
              len(rank_items) > 0 and "saved-rank-empty" not in (page.eval_on_selector("#savedPlatformRank li", "el => el.className") or ""),
              len(rank_items))

        # Sirala: birim kar yuksek -> dusuk
        page.select_option("#savedSortSelect", "profit-desc")
        page.wait_for_timeout(200)
        names_desc = page.eval_on_selector_all(".saved-card h4", "els => els.map(e => e.textContent)")
        check("Sirala (birim kar yuksek->dusuk) dogru sirada", names_desc == expected_desc, f"{names_desc} beklenen {expected_desc}")

        # Sirala: birim kar dusuk -> yuksek (tersi)
        page.select_option("#savedSortSelect", "profit-asc")
        page.wait_for_timeout(200)
        names_asc = page.eval_on_selector_all(".saved-card h4", "els => els.map(e => e.textContent)")
        check("Sirala (birim kar dusuk->yuksek) onceki siranin TAM TERSI", names_asc == expected_asc, f"{names_asc} beklenen {expected_asc}")

        # Sektore gore filtrele: sadece orijinal (UI'dan kaydedilen) kaydin sektoru
        page.select_option("#savedSectorFilter", record_a_sector)
        page.wait_for_timeout(200)
        filtered_cards = page.query_selector_all(".saved-card")
        check("Sektor filtresi listeyi 1 karta daraltiyor", len(filtered_cards) == 1, len(filtered_cards))
        filtered_summary_count = page.eval_on_selector("#savedSummaryCount", "el => el.textContent")
        check("Sektor filtresi ozet sayisini da guncelliyor", filtered_summary_count == "1", filtered_summary_count)

        # Filtreyi kaldir -> 3'e geri donmeli
        page.select_option("#savedSectorFilter", "")
        page.wait_for_timeout(200)
        unfiltered_cards = page.query_selector_all(".saved-card")
        check("Filtre kaldirilinca 3 karta geri donuyor", len(unfiltered_cards) == 3, len(unfiltered_cards))

        # Hicbir kayitla eslesmeyen bir filtre (elle enjekte edilen sahte secenek) ->
        # "kayit yok" mesaji sektor-filtreli VARYANTI gostermeli (genel bos mesajdan FARKLI).
        empty_msg_none = page.eval_on_selector("#savedEmpty", "el => el.textContent")
        page.evaluate("""
            () => {
              var opt = document.createElement('option');
              opt.value = 'hic-boyle-bir-sektor-yok';
              opt.textContent = '(test)';
              document.getElementById('savedSectorFilter').appendChild(opt);
              document.getElementById('savedSectorFilter').value = 'hic-boyle-bir-sektor-yok';
              document.getElementById('savedSectorFilter').dispatchEvent(new Event('change'));
            }
        """)
        page.wait_for_timeout(200)
        zero_match_cards = page.query_selector_all(".saved-card")
        check("Eslesmeyen filtrede 0 kart kaliyor", len(zero_match_cards) == 0, len(zero_match_cards))
        zero_match_toolbar_hidden = page.eval_on_selector("#savedToolbar", "el => el.hidden")
        check("Eslesmeyen filtrede ozet panosu tekrar gizleniyor", zero_match_toolbar_hidden is True, zero_match_toolbar_hidden)
        empty_msg_filtered = page.eval_on_selector("#savedEmpty", "el => el.textContent")
        check("Eslesmeyen filtrede bos-durum mesaji GENEL mesajdan FARKLI (sektore ozel yonlendirme)",
              empty_msg_filtered != empty_msg_none and "sektörde" in empty_msg_filtered, empty_msg_filtered)

        # Temizlik: sentetik 2 kaydi sil, filtreyi sifirla — asagidaki "Silme" testi
        # tek (orijinal) kaydi bekliyor.
        page.evaluate("(ids) => Promise.all(ids.map(id => KHStore.deleteItem(id)))", [s["id"] for s in seed])
        page.click("#savedPanelClose")
        page.wait_for_timeout(200)
        page.click("#savedListBtn")
        page.wait_for_timeout(300)
        cleanup_cards = page.query_selector_all(".saved-card")
        check("Temizlik sonrasi tekrar 1 kayit kaldi (sonraki silme testi icin)", len(cleanup_cards) == 1, len(cleanup_cards))

        # Silme
        page.click(".saved-delete")
        page.wait_for_timeout(400)
        saved_cards_after = page.query_selector_all(".saved-card")
        check("Silince kart listeden kalkiyor", len(saved_cards_after) == 0, len(saved_cards_after))
        empty_shown = page.eval_on_selector("#savedEmpty", "el => getComputedStyle(el).display")
        check("Silince bos-durum mesaji tekrar gorunuyor", empty_shown != "none", empty_shown)
        count_after_delete = page.eval_on_selector("#savedCount", "el => el.textContent")
        check("Silince rozet sayaci sifirlaniyor", count_after_delete == "0", count_after_delete)
        db_count_after = page.evaluate("() => KHStore.count()")
        check("IndexedDB'de de kayit silinmis", db_count_after == 0, db_count_after)

        page.click("#savedPanelClose")
        page.wait_for_timeout(200)

        # ============== PWA / MANIFEST / SW (regresyon) ==============
        manifest = page.evaluate("() => fetch('manifest.json').then(r => r.json())")
        check("manifest.json JSON olarak parse edildi", isinstance(manifest, dict) and "icons" in manifest)
        icon_statuses = page.evaluate(
            "(srcs) => Promise.all(srcs.map(i => fetch(i).then(r => r.status)))",
            [ic["src"] for ic in manifest["icons"]],
        )
        check("Manifestteki tum ikonlar 200 donuyor", all(s == 200 for s in icon_statuses), str(icon_statuses))

        sw_state = page.evaluate("""
            () => new Promise(resolve => {
              if (!('serviceWorker' in navigator)) return resolve('unsupported');
              navigator.serviceWorker.ready.then(() => resolve('ready')).catch(e => resolve('error:' + e));
              setTimeout(() => resolve('timeout'), 5000);
            })
        """)
        check("Service worker kaydoldu", sw_state == "ready", sw_state)
        sw_precache = page.evaluate("() => fetch('storage.js').then(r => r.status)")
        check("storage.js sunucudan/onbellekten geliyor", sw_precache == 200, sw_precache)

        page.screenshot(path="verify_screenshot.png", full_page=True)

        # ============== TIERAMBIGUOUS UYARISI (kademeli komisyon salinim bandi) ==============
        # Taşıyıcı hep "auto", desi'yi de sabitliyoruz (=3 -> PTT en ucuz, kargoTRY=106)
        # ki bant hesaplaması önceki adımlardan kalan desi değerine bağlı kalmasın.
        # cost=560/margin=10/taki, bu sabit kargoTRY ile salınım bandına düşecek şekilde
        # calc.js üzerinden ayrıca doğrulandı (bkz. commit mesajı) — ham 650/10 (kargoTRY=0
        # varsayan test.js'teki saf birim testinden farklı olarak) burada kargo dahil.
        desi_input2 = page.query_selector("#desi")
        desi_input2.click(click_count=3)
        desi_input2.type("3")
        page.select_option("#sector", "taki")
        cost_input2 = page.query_selector("#cost")
        cost_input2.click(click_count=3)
        cost_input2.type("560")
        margin_input2 = page.query_selector("#margin")
        margin_input2.click(click_count=3)
        margin_input2.type("10")
        page.wait_for_timeout(250)
        amazon_warn = page.eval_on_selector(".result-card.amazon .warn", "el => el.textContent")
        check("Kademe salinim bandinda Amazon karti uyari gosteriyor (tierAmbiguous)", len(amazon_warn.strip()) > 0, amazon_warn)

        cost_input2.click(click_count=3)
        cost_input2.type("100")
        page.wait_for_timeout(250)
        amazon_warn_normal = page.eval_on_selector(".result-card.amazon .warn", "el => el.textContent")
        check("Normal durumda Amazon karti uyari GOSTERMIYOR", amazon_warn_normal.strip() == "", amazon_warn_normal)

        # ============== AYARLAR PANELI (10 Agustos 2026) ==============
        # Temiz bir baslangic: bilinen sektor/deger, panel kapali.
        page.select_option("#sector", "giyim")
        margin_input3 = page.query_selector("#margin")
        margin_input3.click(click_count=3)
        margin_input3.type("20")
        page.wait_for_timeout(200)

        panel_hidden_initially = page.eval_on_selector("#settingsPanel", "el => el.hidden")
        check("Ayarlar paneli baslangicta kapali", panel_hidden_initially)

        page.click("#settingsToggleBtn")
        page.wait_for_timeout(200)
        panel_open = page.eval_on_selector("#settingsPanel", "el => !el.hidden && getComputedStyle(el).display !== 'none'")
        aria_expanded = page.eval_on_selector("#settingsToggleBtn", "el => el.getAttribute('aria-expanded')")
        check("Ayarlar butonuna basinca panel GERCEKTEN aciliyor", panel_open)
        check("Panel acilinca aria-expanded=true", aria_expanded == "true", aria_expanded)

        sector_rows = page.eval_on_selector_all("#settingsSectorsBody tr", "els => els.length")
        check("Sektor tablosunda KH.SECTORS ile ayni sayida satir (31)", sector_rows == 31, sector_rows)

        sector_headers = page.eval_on_selector_all(".settings-table thead th", "els => els.map(e => e.textContent)")
        check("Sektor tablosunda 4. sutun Hepsiburada (%)", sector_headers == ["Sektör", "Amazon (%)", "Trendyol (%)", "n11 (%)", "Hepsiburada (%)"], sector_headers)

        giyim_hepsiburada_inputs = page.eval_on_selector_all("input[data-section='sectors'][data-key='giyim'][data-subkey='hepsiburada']", "els => els.length")
        check("Duz sektor (giyim) Hepsiburada hucresinde tek alan var", giyim_hepsiburada_inputs == 1, giyim_hepsiburada_inputs)

        diger_hepsiburada_placeholder = page.eval_on_selector("input[data-section='sectors'][data-key='diger'][data-subkey='hepsiburada']", "e => e.placeholder")
        check("Eslesmeyen sektorde (diger) Hepsiburada hucresi '-' placeholder gosteriyor (yine de duzenlenebilir)", diger_hepsiburada_placeholder == "—", diger_hepsiburada_placeholder)

        taki_amazon_inputs = page.eval_on_selector_all(
            "input[data-section='sectors'][data-key='taki'].settings-tiered, input[data-section='sectors'][data-key='taki'][data-subkey^='amazon']",
            "els => els.length")
        check("Kademeli sektor (taki) Amazon hucresinde 3 mini alan var", taki_amazon_inputs == 3, taki_amazon_inputs)
        giyim_amazon_inputs = page.eval_on_selector_all("input[data-section='sectors'][data-key='giyim'][data-subkey='amazon']", "els => els.length")
        check("Duz sektor (giyim) Amazon hucresinde tek alan var", giyim_amazon_inputs == 1, giyim_amazon_inputs)

        # --- Sektor override: giyim/Trendyol degistirince SADECE Trendyol karti etkilenmeli ---
        trendyol_before = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        amazon_before_sect = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        page.fill("input[data-section='sectors'][data-key='giyim'][data-subkey='trendyol']", "35")
        page.wait_for_timeout(200)
        trendyol_after = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        amazon_after_sect = page.eval_on_selector(".result-card.amazon .price", "e => e.textContent")
        check("Ayarlardan sektor Trendyol orani degistirince Trendyol fiyati degisiyor",
              trendyol_before != trendyol_after, f"{trendyol_before} -> {trendyol_after}")
        check("Ayarlardan sektor Trendyol orani Amazon fiyatini ETKILEMIYOR (izolasyon)",
              amazon_before_sect == amazon_after_sect, f"{amazon_before_sect} -> {amazon_after_sect}")

        # --- Sektor override: giyim/Hepsiburada degistirince SADECE Hepsiburada karti
        # etkilenmeli (11 Agustos 2026, 4. tur) ---
        hepsiburada_before = page.eval_on_selector(".result-card.hepsiburada .price", "e => e.textContent")
        n11_before_sect = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        page.fill("input[data-section='sectors'][data-key='giyim'][data-subkey='hepsiburada']", "40")
        page.wait_for_timeout(200)
        hepsiburada_after = page.eval_on_selector(".result-card.hepsiburada .price", "e => e.textContent")
        n11_after_sect = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        check("Ayarlardan sektor Hepsiburada orani degistirince Hepsiburada fiyati degisiyor",
              hepsiburada_before != hepsiburada_after, f"{hepsiburada_before} -> {hepsiburada_after}")
        check("Ayarlardan sektor Hepsiburada orani n11 fiyatini ETKILEMIYOR (izolasyon)",
              n11_before_sect == n11_after_sect, f"{n11_before_sect} -> {n11_after_sect}")
        page.fill("input[data-section='sectors'][data-key='giyim'][data-subkey='hepsiburada']", "")
        page.wait_for_timeout(200)

        sectors_badge_visible = page.eval_on_selector("[data-badge-section='sectors']", "el => !el.hidden")
        toggle_dot_visible = page.eval_on_selector("#settingsToggleDot", "el => !el.hidden")
        check("'Sektor komisyon oranlari' basligina degistirildi rozeti cikiyor", sectors_badge_visible)
        check("Ayarlar dugmesinde degisiklik noktasi cikiyor (panel kapaliyken de gorulur)", toggle_dot_visible)

        # --- Sabit hizmet bedeli override: n11/Trendyol hizmet bedeli KH.X uzerinden
        # OKUNUYOR MU (bkz. calc.js/settings.js 10 Agustos duzeltmesi -- bu satirlar
        # olmasaydi asagidaki iki kontrol de SESSIZCE gecerdi cunku deger hic
        # degismemis olurdu; once/sonra farkli olmasi gercek etkiyi kanitliyor). ---
        # 'Sektor komisyon oranlari' disindaki tum <details> gruplari varsayilan
        # KAPALI (bkz. index.html) -- native <details> kapaliyken icerigi
        # gorunmez/etkilesilemez sayiyor, bu yuzden once acmamiz gerekiyor.
        page.eval_on_selector("#settingsGroupFees", "el => { el.open = true; }")
        n11_before_fee = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        page.fill("input[data-section='fees'][data-key='n11HizmetBedeliPct']", "20")
        page.wait_for_timeout(200)
        n11_after_fee = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        check("Ayarlardan n11 hizmet bedeli degistirince n11 fiyati GERCEKTEN degisiyor (KH.N11_HIZMET_BEDELI_PCT canli okunuyor)",
              n11_before_fee != n11_after_fee, f"{n11_before_fee} -> {n11_after_fee}")

        trendyol_before_fee = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        page.fill("input[data-section='fees'][data-key='trendyolHizmetBedeliTRY']", "500")
        page.wait_for_timeout(200)
        trendyol_after_fee = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        check("Ayarlardan Trendyol hizmet bedeli degistirince Trendyol fiyati GERCEKTEN degisiyor (KH.TRENDYOL_HIZMET_BEDELI_TRY canli okunuyor)",
              trendyol_before_fee != trendyol_after_fee, f"{trendyol_before_fee} -> {trendyol_after_fee}")

        # --- Shopify varsayilan odeme saglayici orani: ana formdaki alan BOSALTILMADIKCA
        # bu varsayilan hic devreye girmiyor (bkz. calc.js: input.shopifyGatewayPct != null
        # ? ... : KH.SHOPIFY_GATEWAY_DEFAULT_PCT) -- once formu bosaltiyoruz. ---
        page.eval_on_selector("#settingsGroupShopify", "el => { el.open = true; }")
        # 'Platforma ozel ayarlar' (details.advanced), 331. satirdaki reload'dan
        # beri tekrar acilmadi -- #shopifyGatewayPct'a erismeden once acmali.
        page.eval_on_selector("details.advanced", "el => { el.open = true; }")
        page.fill("#shopifyGatewayPct", "")
        page.wait_for_timeout(200)
        shopify_before_gw = page.eval_on_selector(".result-card.shopify .price", "e => e.textContent")
        page.fill("input[data-section='shopify'][data-key='gatewayDefaultPct']", "12")
        page.wait_for_timeout(200)
        shopify_after_gw = page.eval_on_selector(".result-card.shopify .price", "e => e.textContent")
        check("Ana form alani bosken ayarlardaki Shopify varsayilan orani GERCEKTEN devreye giriyor (KH.SHOPIFY_GATEWAY_DEFAULT_PCT canli okunuyor)",
              shopify_before_gw != shopify_after_gw, f"{shopify_before_gw} -> {shopify_after_gw}")
        page.fill("#shopifyGatewayPct", "2.65")
        page.fill("input[data-section='shopify'][data-key='gatewayDefaultPct']", "")
        page.wait_for_timeout(200)

        # --- Kalicilik: sayfa yenilenince hem input degeri hem de HESAPLANAN
        # fiyat (panel hic acilmadan) korunmali. ---
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(200)
        persisted_sector_value = page.eval_on_selector("#sector", "el => el.value")
        check("Sayfa yenilenince secili sektor de (KHStore/son durum degil, tarayici varsayilani) korunuyor", persisted_sector_value == "giyim", persisted_sector_value)
        persisted_trendyol_price = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        # Reload anindan hemen once HEM sektor (%35 komisyon) HEM hizmet bedeli
        # (500 TRY) override'i birlikte aktifti -- beklenen deger trendyol_after
        # DEGIL (o sadece komisyon override'liyken alinmisti), ikisinin de
        # uygulandigi trendyol_after_fee.
        check("Sayfa yenilenince ayarlar OTOMATIK uygulaniyor (panel acilmadan Trendyol fiyati iki override'li)",
              persisted_trendyol_price == trendyol_after_fee, f"beklenen(iki override'li)={trendyol_after_fee} gelen={persisted_trendyol_price}")
        page.click("#settingsToggleBtn")
        page.wait_for_timeout(200)
        persisted_input_value = page.eval_on_selector("input[data-section='sectors'][data-key='giyim'][data-subkey='trendyol']", "el => el.value")
        check("Sayfa yenilenince ayarlar panelindeki input DEGERI de (localStorage'dan) geri geliyor", persisted_input_value == "35", persisted_input_value)
        # Reload sonrasi tum <details> gruplari HTML'deki varsayilan durumuna
        # (fees KAPALI) doner -- tekrar acmadan icindeki input'a erisilemez.
        page.eval_on_selector("#settingsGroupFees", "el => { el.open = true; }")
        n11_fee_input_persisted = page.eval_on_selector("input[data-section='fees'][data-key='n11HizmetBedeliPct']", "el => el.value")
        check("n11 hizmet bedeli override'i de kaliciliktan sonra input'ta gorunuyor", n11_fee_input_persisted == "20", n11_fee_input_persisted)

        # --- Bolum sifirlama: sadece 'sectors' sifirlanmali, 'fees' surmeli. ---
        page.click("button.settings-reset-section[data-reset-section='sectors']")
        page.wait_for_timeout(200)
        trendyol_after_section_reset = page.eval_on_selector(".result-card.trendyol .price", "e => e.textContent")
        # 'sectors' sifirlaninca SADECE komisyon fabrikaya doner -- 'fees'
        # bolumundeki hizmet bedeli override'i (500 TRY) HALA aktif, bu yuzden
        # fiyat trendyol_before'a (iki override de yokken) DEGIL, aradaki
        # farkli bir degere doner; iki bolumun BAGIMSIZ sifirlanabildigini
        # ispatlayan asil kanit iki yonlu karsilastirma.
        check("'Sektorleri sifirla' Trendyol fiyatini degistiriyor (sektor override kalkti)",
              trendyol_after_section_reset != trendyol_after_fee, f"{trendyol_after_fee} -> {trendyol_after_section_reset}")
        check("'Sektorleri sifirla' SONRASI da orijinal degere DONMUYOR (fees override'i hala etkili, bolumler bagimsiz)",
              trendyol_after_section_reset != trendyol_before, f"orijinal={trendyol_before} simdiki={trendyol_after_section_reset}")
        n11_fee_input_after_section_reset = page.eval_on_selector("input[data-section='fees'][data-key='n11HizmetBedeliPct']", "el => el.value")
        check("'Sektorleri sifirla' fees bolumune DOKUNMUYOR (n11 hizmet bedeli override'i hala 20)",
              n11_fee_input_after_section_reset == "20", n11_fee_input_after_section_reset)
        sectors_badge_after_section_reset = page.eval_on_selector("[data-badge-section='sectors']", "el => el.hidden")
        check("Bolum sifirlaninca 'degistirildi' rozeti kalkiyor", sectors_badge_after_section_reset)

        # --- Tumunu sifirla: hicbir override kalmamali. ---
        page.click("#settingsResetAllBtn")
        page.wait_for_timeout(200)
        n11_after_reset_all = page.eval_on_selector(".result-card.n11 .price", "e => e.textContent")
        check("'Tumunu sifirla' sonrasi n11 fiyati orijinal degere donuyor",
              n11_after_reset_all == n11_before_fee, f"beklenen={n11_before_fee} gelen={n11_after_reset_all}")
        toggle_dot_after_reset_all = page.eval_on_selector("#settingsToggleDot", "el => el.hidden")
        check("'Tumunu sifirla' sonrasi degisiklik noktasi kayboluyor", toggle_dot_after_reset_all)
        any_input_with_value = page.eval_on_selector_all(
            "#settingsPanel input[data-section]", "els => els.filter(e => e.value !== '').length")
        check("'Tumunu sifirla' sonrasi panelde DOLU input kalmiyor", any_input_with_value == 0, any_input_with_value)

        page.click("#settingsToggleBtn")
        page.wait_for_timeout(200)
        panel_closed_again = page.eval_on_selector("#settingsPanel", "el => el.hidden")
        check("Ayarlar butonu tekrar basinca panel kapaniyor", panel_closed_again)

        # Butun etkilesimli akis (mod gecisi, tema degisimi, sayfa yenileme dahil)
        # boyunca hic konsol hatasi birikmemis mi? (Ilk kontrol satir 39'da sadece
        # ilk sayfa yuklemesini kapsiyordu; page.on() dinleyicisi reload'lar dahil
        # butun oturum boyunca calismaya devam ediyor, bu yuzden burada TEKRAR
        # kontrol etmek reload/tema/mod gecisi gibi sonradan eklenen akislarda
        # sessizce biriken hatalari da yakalar.)
        check("Tum etkilesimli oturum boyunca konsol hatasi birikmedi", len(console_errors) == 0, "; ".join(console_errors))

        # Genis ekran: form|sonuc iki sutun + sonuc paneli sticky mi?
        wide = browser.new_page(viewport={"width": 1400, "height": 900})
        wide.goto(f"{BASE}/index.html", wait_until="networkidle")
        layout_display = wide.eval_on_selector(".layout", "el => getComputedStyle(el).display")
        check("1400px genislikte .layout grid'e geciyor", layout_display == "grid", layout_display)
        results_position = wide.eval_on_selector(".layout-results", "el => getComputedStyle(el).position")
        check("Sonuc paneli sticky", results_position == "sticky", results_position)
        col_count = wide.eval_on_selector("#results", "el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
        check("1400px genislikte 3 sonuc karti yan yana (7 kart, 3+3+1)", col_count == 3, col_count)
        page_width = wide.eval_on_selector(".page", "el => el.getBoundingClientRect().width")
        check("1400px genislikte .page 1180px sabitinden genisledi (3 sutuna yer acmak icin)", page_width > 1180, page_width)
        wide.screenshot(path="verify_screenshot_wide.png", full_page=True)

        # ============== TOPLU HESAPLAMA (11 Agustos 2026) ==============
        # Ayni 'wide' page uzerinde devam ediyor (temiz durum -- mobil sayfadaki
        # onceki testlerin biriktirdigi ayarlar/override'lardan etkilenmesin,
        # ama panel/CSV etkilesimi genis ekranda mobil'den daha dogal).
        import csv as _csv
        import io as _io
        import tempfile as _tempfile
        import os as _os2

        bulk_hidden_initially = wide.eval_on_selector("#bulkPanel", "el => el.hidden")
        check("Toplu hesaplama paneli baslangicta kapali", bulk_hidden_initially)
        wide.click("#bulkToggleBtn")
        wide.wait_for_timeout(200)
        bulk_open = wide.eval_on_selector("#bulkPanel", "el => !el.hidden && getComputedStyle(el).display !== 'none'")
        bulk_aria = wide.eval_on_selector("#bulkToggleBtn", "el => el.getAttribute('aria-expanded')")
        check("Toplu hesaplama butonuna basinca panel GERCEKTEN aciliyor", bulk_open)
        check("Panel acilinca aria-expanded=true", bulk_aria == "true", bulk_aria)

        # --- Sablon indirme: BOM'lu, basliklar dogru, virgullu sektor alani tirnaklanmis ---
        with wide.expect_download() as dl_info:
            wide.click("#bulkTemplateBtn")
        template_path = dl_info.value.path()
        with open(template_path, "rb") as f:
            template_bytes = f.read()
        check("Sablon CSV UTF-8 BOM ile basliyor", template_bytes[:3] == b"\xef\xbb\xbf")
        template_rows = list(_csv.reader(_io.StringIO(template_bytes.decode("utf-8-sig"))))
        check("Sablon basligi beklenen sutunlarla eslesiyor",
              template_rows[0] == ["Ürün Adı", "Maliyet (₺)", "Sektör", "Hedef Kâr (%)", "Kargo (₺)", "Reklam (₺)", "Aylık Adet"],
              template_rows[0])
        check("Sablonda ornek urun satirlari var (>=3)", len(template_rows) - 1 >= 3, len(template_rows) - 1)
        comma_sector_rows = [r for r in template_rows if len(r) > 2 and "," in r[2]]
        check("Virgul iceren sektor adi tek hucrede kaliyor (dogru tirnaklama/ayristirma)",
              len(comma_sector_rows) >= 1, comma_sector_rows)

        # --- Referans (oracle): ana formu sablonun 1. satiriyla (Kışlık Mont:
        # maliyet=450, sektor=giyim, marj=25, aylik=20; kargo/reklam sablonda
        # BOS -- ana formun O AN gecerli degerlerini miras almali) AYNI degerlere
        # getirip 7 platform fiyatini oku. Bulk motoru render'i DEGIL, ana formun
        # KENDI (zaten test edilmis) readInput()/computeAll() yolunu kullaniyor. ---
        wide.fill("#cost", "450")
        wide.select_option("#sector", "giyim")
        margin_wide = wide.query_selector("#margin")
        margin_wide.click(click_count=3)
        margin_wide.type("25")
        wide.fill("#monthlyUnits", "20")
        wide.wait_for_timeout(250)
        platforms = ["amazon", "trendyol", "n11", "hepsiburada", "shopify", "shopier", "etsy"]
        oracle_prices = {p: wide.eval_on_selector(f".result-card.{p} .price", "e => e.textContent") for p in platforms}

        # --- Sablonu geri yukle: 3 satir da hesaplanmali; 1. satir (Kışlık Mont)
        # yukaridaki referansla BIREBIR eslesmeli (ayni sirada, PLATFORM_ORDER). ---
        wide.set_input_files("#bulkFileInput", template_path)
        wide.wait_for_timeout(400)
        bulk_summary_1 = wide.eval_on_selector("#bulkResultsSummary", "el => el.textContent")
        check("3 satirlik gecerli sablonun ucu de hesaplandi", "3 ürün hesaplandı" in bulk_summary_1, bulk_summary_1)
        row0_cells = wide.eval_on_selector_all(
            "#bulkResultsBody tr:first-child td", "tds => tds.map(td => td.textContent)")
        row0_platform_prices = dict(zip(platforms, row0_cells[1:]))
        check("Toplu tablonun 1. satiri, ana formun BAGIMSIZ hesapladigi referansla 7 platformda da BIREBIR eslesiyor",
              row0_platform_prices == oracle_prices, f"beklenen={oracle_prices} gelen={row0_platform_prices}")

        cheapest_cells_row0 = wide.eval_on_selector_all(
            "#bulkResultsBody tr:first-child td.bulk-cheapest", "els => els.length")
        check("1. satirda tam olarak 1 hucre 'en ucuz' (bulk-cheapest) olarak isaretli", cheapest_cells_row0 == 1, cheapest_cells_row0)

        # --- Zorunlu sutun eksik: TUM dosya reddedilmeli, sonuc tablosu gizli kalmali. ---
        missing_col_path = _os2.path.join(_tempfile.gettempdir(), "kh_verify_bulk_missing.csv")
        with open(missing_col_path, "w", encoding="utf-8") as f:
            f.write("Ürün Adı,Maliyet (₺),Hedef Kâr (%)\nTest,100,20\n")
        wide.set_input_files("#bulkFileInput", missing_col_path)
        wide.wait_for_timeout(300)
        bulk_status_error = wide.eval_on_selector("#bulkStatus", "el => !el.hidden && el.classList.contains('is-error')")
        bulk_status_text = wide.eval_on_selector("#bulkStatus", "el => el.textContent")
        bulk_results_hidden_after_error = wide.eval_on_selector("#bulkResultsWrap", "el => el.hidden")
        check("Zorunlu sutun (sektor) eksik CSV'de hata mesaji gosteriliyor", bulk_status_error, bulk_status_text)
        check("Eksik sutunlu CSV'de sonuc tablosu gizli kaliyor", bulk_results_hidden_after_error)
        check("Hata mesaji eksik sutunun adini iceriyor",
              "sektör" in bulk_status_text.lower(), bulk_status_text)

        # --- Karisik gecerli/gecersiz satirlar: iyi satir hesaplanmali, kotu
        # satirlar KENDI hatasiyla isaretlenmeli, biri digerini ENGELLEMEMELI. ---
        mixed_path = _os2.path.join(_tempfile.gettempdir(), "kh_verify_bulk_mixed.csv")
        with open(mixed_path, "w", encoding="utf-8") as f:
            f.write(
                "Ürün Adı,Maliyet (₺),Sektör,Hedef Kâr (%),Kargo (₺),Reklam (₺),Aylık Adet\n"
                "İyi Ürün,200,Giyim,25,,,\n"
                "Kötü Maliyet,abc,Giyim,25,,,\n"
                "Kötü Sektör,150,Var Olmayan Sektör XYZ,25,,,\n"
            )
        wide.set_input_files("#bulkFileInput", mixed_path)
        wide.wait_for_timeout(300)
        mixed_summary = wide.eval_on_selector("#bulkResultsSummary", "el => el.textContent")
        check("Karisik dosyada ozet '1 hesaplandi, 2 hatali' diyor", "1 ürün hesaplandı" in mixed_summary and "2 satırda hata" in mixed_summary, mixed_summary)
        error_row_classes = wide.eval_on_selector_all("#bulkResultsBody tr", "trs => trs.map(tr => tr.className)")
        check("Karisik dosyada satir sirasi: iyi(bos)/hatali/hatali", error_row_classes == ["", "bulk-row-error", "bulk-row-error"], error_row_classes)
        bad_cost_error_text = wide.eval_on_selector("#bulkResultsBody tr:nth-child(2) td", "el => el.textContent")
        check("Gecersiz maliyet satirinda dogru hata metni gosteriliyor", "Maliyet geçersiz" in bad_cost_error_text, bad_cost_error_text)
        bad_sector_error_text = wide.eval_on_selector("#bulkResultsBody tr:nth-child(3) td", "el => el.textContent")
        check("Bulunamayan sektor satirinda dogru hata metni gosteriliyor", "Sektör bulunamadı" in bad_sector_error_text, bad_sector_error_text)

        # --- Noktali virgul ayracli + Turkce ondalikli ("120,50") CSV de dogru ayristirilmali. ---
        semi_path = _os2.path.join(_tempfile.gettempdir(), "kh_verify_bulk_semi.csv")
        with open(semi_path, "w", encoding="utf-8") as f:
            f.write(
                "Ürün Adı;Maliyet (₺);Sektör;Hedef Kâr (%);Kargo (₺);Reklam (₺);Aylık Adet\n"
                "Noktalı Virgül Testi;120,50;Giyim;22;;;\n"
            )
        wide.set_input_files("#bulkFileInput", semi_path)
        wide.wait_for_timeout(300)
        semi_summary = wide.eval_on_selector("#bulkResultsSummary", "el => el.textContent")
        check("Noktali virgul ayracli + Turkce ondalikli CSV basariyla hesaplaniyor", "1 ürün hesaplandı" in semi_summary, semi_summary)

        # --- Izolasyon: ana formdaki degisiklik otomatik yansimamali; 'Yeniden
        # hesapla' ELLE tetiklenince yansimali (bkz. #bulkPanel recalc-loop haric tutma). ---
        wide.set_input_files("#bulkFileInput", template_path)
        wide.wait_for_timeout(300)
        row0_amazon_before_ads = wide.eval_on_selector("#bulkResultsBody tr:first-child td:nth-child(3)", "el => el.textContent")
        ads_wide = wide.query_selector("#ads")
        ads_wide.click(click_count=3)
        ads_wide.type("500")
        wide.wait_for_timeout(200)
        row0_amazon_no_auto = wide.eval_on_selector("#bulkResultsBody tr:first-child td:nth-child(3)", "el => el.textContent")
        check("Ana formdaki degisiklik toplu tabloyu OTOMATIK guncellemiyor (izolasyon)",
              row0_amazon_no_auto == row0_amazon_before_ads, f"{row0_amazon_before_ads} -> {row0_amazon_no_auto}")
        wide.click("#bulkRecalcBtn")
        wide.wait_for_timeout(300)
        row0_amazon_after_recalc = wide.eval_on_selector("#bulkResultsBody tr:first-child td:nth-child(3)", "el => el.textContent")
        check("'Yeniden hesapla' ana formdaki degisikligi yansitiyor",
              row0_amazon_after_recalc != row0_amazon_before_ads, f"{row0_amazon_before_ads} -> {row0_amazon_after_recalc}")
        ads_wide.click(click_count=3)
        ads_wide.type("0")
        wide.wait_for_timeout(200)

        # --- Disa aktarma: indirilen CSV'de 'Hata' sutunu + hatali satirlarda
        # bos fiyat hucreleri + gecerli satirda dogru sayisal deger olmali. ---
        wide.set_input_files("#bulkFileInput", mixed_path)
        wide.wait_for_timeout(300)
        with wide.expect_download() as export_dl_info:
            wide.click("#bulkExportBtn")
        export_path = export_dl_info.value.path()
        with open(export_path, "rb") as f:
            export_bytes = f.read()
        check("Disa aktarilan CSV UTF-8 BOM ile basliyor", export_bytes[:3] == b"\xef\xbb\xbf")
        export_rows = list(_csv.reader(_io.StringIO(export_bytes.decode("utf-8-sig"))))
        check("Disa aktarilan CSV basliginda 'Hata' sutunu var", export_rows[0][-1] == "Hata", export_rows[0])
        check("Disa aktarilan CSV'de iyi satirin Amazon fiyati bos DEGIL", export_rows[1][2].strip() != "", export_rows[1])
        check("Disa aktarilan CSV'de hatali satirin Amazon fiyati BOS", export_rows[2][2].strip() == "", export_rows[2])
        check("Disa aktarilan CSV'de hatali satirin Hata sutunu dolu", export_rows[2][-1].strip() != "", export_rows[2][-1])

        wide.close()

        browser.close()

    print()
    if failures:
        print(f"{len(failures)} KONTROL BAŞARISIZ:", failures)
        sys.exit(1)
    else:
        print("TÜM UI KONTROLLERİ GEÇTİ")
        sys.exit(0)


if __name__ == "__main__":
    main()
