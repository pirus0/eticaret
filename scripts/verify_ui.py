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

        # --- Canli guncelleme testi: maliyeti degistir, fiyatin degistigini dogrula ---
        old_price = page.eval_on_selector(".result-card .price", "e => e.textContent")
        cost_input = page.query_selector("#cost")
        cost_input.click(click_count=3)
        cost_input.type("500")
        cost_input.dispatch_event("input")
        page.wait_for_timeout(200)
        new_price = page.eval_on_selector(".result-card .price", "e => e.textContent")
        check("Maliyet degisince fiyat canli guncelleniyor", old_price != new_price, f"{old_price} -> {new_price}")

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
