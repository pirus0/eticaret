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
        check("4 platform karti render edildi", len(cards) == 4, f"{len(cards)} kart")

        prices = page.eval_on_selector_all(".result-card .price", "els => els.map(e => e.textContent)")
        check("Tum kartlarda fiyat var", all(p.strip() not in ("", "—") for p in prices), str(prices))

        live_bar_text = page.eval_on_selector("#liveBar", "el => el.textContent")
        check("Live-bar dolu", len(live_bar_text.strip()) > 0, live_bar_text[:80])

        border_colors = page.eval_on_selector_all(".result-card", "els => els.map(e => getComputedStyle(e).borderTopColor)")
        check("4 kartin ust kenarligi 4 farkli renk", len(set(border_colors)) == 4, str(border_colors))

        group_classes = page.eval_on_selector_all(".platform-group", "els => els.map(e => e.className)")
        check("4 platform grubu var", len(group_classes) == 4, str(group_classes))

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

        # Genis ekran: form|sonuc iki sutun + sonuc paneli sticky mi?
        wide = browser.new_page(viewport={"width": 1400, "height": 900})
        wide.goto(f"{BASE}/index.html", wait_until="networkidle")
        layout_display = wide.eval_on_selector(".layout", "el => getComputedStyle(el).display")
        check("1400px genislikte .layout grid'e geciyor", layout_display == "grid", layout_display)
        results_position = wide.eval_on_selector(".layout-results", "el => getComputedStyle(el).position")
        check("Sonuc paneli sticky", results_position == "sticky", results_position)
        col_count = wide.eval_on_selector("#results", "el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
        check("1400px genislikte 4 sonuc karti yan yana", col_count == 4, col_count)
        page_width = wide.eval_on_selector(".page", "el => el.getBoundingClientRect().width")
        check("1400px genislikte .page 1180px sabitinden genisledi (4 sutuna yer acmak icin)", page_width > 1180, page_width)
        wide.screenshot(path="verify_screenshot_wide.png", full_page=True)
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
