#!/usr/bin/env python3
"""index.html'i gercek bir tarayicida (Chromium/Playwright) acip:
- konsol hatasi olup olmadigini,
- tum statik varliklarin (css/js/manifest/icon) 200 donup donmedigini,
- ilk render'da 4 platform kartinin dolu geldigini,
- bir input degisince sonuclarin canli guncellendigini,
- Etsy offsite checkbox'inin esik alanini gosterip gizledigini
dogrular. Kullanim: python3 scripts/verify_ui.py (once `python3 -m http.server 8934` calisir olmali)
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

        title = page.title()
        check("Sayfa basligi dogru", title == "Kâr Marjı Hesaplayıcı", title)

        # Sektor dropdown'u calc.js'ten dolmus mu (populateSelects calisti mi)?
        sector_options = page.eval_on_selector("#sector", "el => el.options.length")
        check("Sektor secenekleri yuklendi", sector_options > 5, f"{sector_options} secenek")

        # Ilk render: 4 sonuc karti olmali
        cards = page.query_selector_all(".result-card")
        check("4 platform karti render edildi", len(cards) == 4, f"{len(cards)} kart")

        # Varsayilan girdilerle (maliyet=100, giyim, %20) fiyatlar bos olmamali
        prices = page.eval_on_selector_all(".result-card .price", "els => els.map(e => e.textContent)")
        print("   Varsayilan fiyatlar:", prices)
        check("Tum kartlarda fiyat var (bos/–  degil)", all(p.strip() not in ("", "—") for p in prices), str(prices))

        # Ozet banner dolmus mu?
        summary_text = page.eval_on_selector("#summary", "el => el.textContent")
        check("Ozet banner dolu", len(summary_text.strip()) > 0, summary_text[:80])

        # --- Sabit (sticky) canli-fiyat seridi dolu mu? ---
        live_bar_text = page.eval_on_selector("#liveBar", "el => el.textContent")
        check("Live-bar dolu", len(live_bar_text.strip()) > 0, live_bar_text[:80])

        # --- 4 kart birbirinden ayirt edilebilir renklerde mi (renk kodlama duzeltmesi)? ---
        card_classes = page.eval_on_selector_all(".result-card", "els => els.map(e => e.className)")
        expected_keys = ["amazon", "trendyol", "shopify", "etsy"]
        check("Her kart kendi platform sinifini tasiyor",
              all(k in " ".join(card_classes) for k in expected_keys), str(card_classes))
        border_colors = page.eval_on_selector_all(
            ".result-card", "els => els.map(e => getComputedStyle(e).borderTopColor)")
        check("4 kartin ust kenarligi 4 farkli renk (once 3'u ayni turuncuydu)",
              len(set(border_colors)) == 4, str(border_colors))

        # --- Gelismis ayarlar paneli platforma gore gruplanmis mi? ---
        group_classes = page.eval_on_selector_all(".platform-group", "els => els.map(e => e.className)")
        check("4 platform grubu var", len(group_classes) == 4, str(group_classes))

        # --- Canli guncelleme testi: maliyeti degistir, fiyatin VE live-bar'in degistigini dogrula ---
        old_price = page.eval_on_selector(".result-card .price", "e => e.textContent")
        cost_input = page.query_selector("#cost")
        cost_input.click(click_count=3)
        cost_input.type("500")
        cost_input.dispatch_event("input")
        page.wait_for_timeout(200)
        new_price = page.eval_on_selector(".result-card .price", "e => e.textContent")
        check("Maliyet degisince fiyat canli guncelleniyor", old_price != new_price, f"{old_price} -> {new_price}")
        new_live_bar_text = page.eval_on_selector("#liveBar", "el => el.textContent")
        check("Maliyet degisince live-bar da guncelleniyor", live_bar_text != new_live_bar_text,
              f"{live_bar_text} -> {new_live_bar_text}")

        # --- live-bar tiklaninca sonuclara kayiyor mu (sabit seridin altina, ustune degil) ---
        # Not: page.click() burada kasitli kullanilmadi — Playwright'in sticky/fixed
        # elemanlar icin devreye soktugu otomatik on-kaydirma sezgiseli, bizim
        # smooth scrollIntoView'imizla yarisa girip flaky sonuc veriyor (gercek bir
        # tarayicida parmakla/mouse'la tiklamak bu sorunu yasamiyor). Gercek DOM
        # click() API'sini native'e en yakin sekilde tetiklemek icin evaluate kullanildi.
        page.evaluate("document.getElementById('liveBar').click()")
        page.wait_for_timeout(1000)
        results_rect = page.eval_on_selector("#results", """el => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
        }""")
        sticky_h = page.eval_on_selector("#results", "el => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-head-h')) || 0")
        results_in_view = 0 <= results_rect["top"] < 900 and results_rect["top"] >= sticky_h - 5
        check("Live-bar'a tiklayinca sonuclara kayiyor (sabit seridin altinda)",
              results_in_view, f"top={results_rect['top']:.0f} sticky_h={sticky_h:.0f}")

        # --- --sticky-head-h CSS degiskeni JS tarafindan set edildi mi? ---
        sticky_var = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--sticky-head-h')")
        check("--sticky-head-h degiskeni set edildi", sticky_var.strip().endswith("px"), sticky_var)

        # --- Kargo notu dolduruluyor mu (auto carrier) ---
        carrier_note = page.eval_on_selector("#carrierNote", "el => el.textContent")
        check("Kargo notu dolduruldu", len(carrier_note.strip()) > 0, carrier_note)

        # --- Desi'den hesapla butonu ---
        page.click("summary")  # dims <details> ac (ilk summary elementi dims'e ait)
        page.fill("#dimW", "40")
        page.fill("#dimD", "30")
        page.fill("#dimH", "20")
        page.click("#dimApply")
        page.wait_for_timeout(200)
        desi_val = page.eval_on_selector("#desi", "el => el.value")
        check("Desi, olculerden dogru hesaplandi (40*30*20/3000=8)", desi_val == "8", desi_val)

        # --- Etsy offsite checkbox esik alanini gosteriyor mu ---
        wrap_display_before = page.eval_on_selector("#etsyThresholdWrap", "el => getComputedStyle(el).display")
        check("Esik alani basta gizli", wrap_display_before == "none", wrap_display_before)
        page.click("details.advanced > summary")  # "Platforma ozel ayarlar" panelini ac
        page.check("#etsyOffsite")
        page.wait_for_timeout(100)
        wrap_display_after = page.eval_on_selector("#etsyThresholdWrap", "el => getComputedStyle(el).display")
        check("Offsite isaretlenince esik alani gorunuyor", wrap_display_after != "none", wrap_display_after)

        # --- Asiri yuksek kar hedefi -> hata mesaji UI'da gorunuyor mu ---
        margin_input = page.query_selector("#margin")
        margin_input.click(click_count=3)
        margin_input.type("95")
        margin_input.dispatch_event("input")
        page.wait_for_timeout(200)
        error_texts = page.eval_on_selector_all(".result-card .error", "els => els.map(e => e.textContent)")
        check("Asiri yuksek kar hedefinde hata mesaji gosteriliyor", len(error_texts) > 0, str(error_texts))
        margin_input.click(click_count=3)
        margin_input.type("20")
        margin_input.dispatch_event("input")

        # --- Manifest icerigi geçerli JSON mu ve start_url/icons dogru cozuluyor mu ---
        manifest = page.evaluate("() => fetch('manifest.json').then(r => r.json())")
        check("manifest.json JSON olarak parse edildi", isinstance(manifest, dict) and "icons" in manifest)
        icon_statuses = page.evaluate(
            "(srcs) => Promise.all(srcs.map(i => fetch(i).then(r => r.status)))",
            [ic["src"] for ic in manifest["icons"]],
        )
        check("Manifestteki tum ikonlar 200 donuyor", all(s == 200 for s in icon_statuses), str(icon_statuses))

        # --- Service worker kaydi ---
        sw_state = page.evaluate("""
            () => new Promise(resolve => {
              if (!('serviceWorker' in navigator)) return resolve('unsupported');
              navigator.serviceWorker.ready.then(() => resolve('ready')).catch(e => resolve('error:' + e));
              setTimeout(() => resolve('timeout'), 5000);
            })
        """)
        check("Service worker kaydoldu", sw_state == "ready", sw_state)

        page.screenshot(path="verify_screenshot.png", full_page=True)

        # --- Genis ekran: form|sonuc iki sutun + sonuc paneli sticky mi? ---
        wide = browser.new_page(viewport={"width": 1400, "height": 900})
        wide.goto(f"{BASE}/index.html", wait_until="networkidle")
        layout_display = wide.eval_on_selector(".layout", "el => getComputedStyle(el).display")
        check("1400px genislikte .layout grid'e geciyor", layout_display == "grid", layout_display)
        results_position = wide.eval_on_selector(".layout-results", "el => getComputedStyle(el).position")
        check("Sonuc paneli sticky", results_position == "sticky", results_position)
        col_count = wide.eval_on_selector(
            "#results", "el => getComputedStyle(el).gridTemplateColumns.split(' ').length")
        check("1400px genislikte 4 sonuc karti yan yana", col_count == 4, col_count)
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
