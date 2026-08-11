#!/usr/bin/env python3
"""Gorsel inceleme icin ekran goruntuleri alir (otomatik testlerin GOZLEMLEYEMEDIGI
seyleri -- renk uyumu, hizalama, tasma -- kontrol etmek icin). Kullanim:
python3 scripts/capture_screenshots.py (once http.server 8934 calisir olmali)"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8934"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])

    # 1) Genis ekran, acik tema, ileri mod -- 6 kartin 3x2 duzeni
    wide = browser.new_page(viewport={"width": 1400, "height": 1000})
    wide.goto(f"{BASE}/index.html", wait_until="networkidle")
    wide.wait_for_timeout(500)
    wide.screenshot(path="shot_wide_light_forward.png", full_page=True)

    # 2) Genis ekran, karanlik tema
    wide.click("#themeToggleBtn")
    wide.wait_for_timeout(400)
    wide.screenshot(path="shot_wide_dark_forward.png", full_page=True)

    # 3) Genis ekran, karanlik tema, TERS mod (fiyattan kar)
    wide.click("#modeReverseBtn")
    wide.fill("#targetPrice", "450")
    wide.wait_for_timeout(400)
    wide.screenshot(path="shot_wide_dark_reverse.png", full_page=True)
    wide.close()

    # 4) Mobil, acik tema, ileri mod (varsayilan)
    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE}/index.html", wait_until="networkidle")
    mobile.wait_for_timeout(500)
    mobile.screenshot(path="shot_mobile_light_top.png")

    # 5) Mobil, sektor arama kullanimi (dropdown odakli, secim goster)
    mobile.fill("#sectorSearch", "elektronik")
    mobile.wait_for_timeout(200)
    mobile.screenshot(path="shot_mobile_sector_search.png")

    # 6) Mobil sonuc kartlari (asagi kaydirilmis)
    mobile.eval_on_selector("#sectorSearch", "el => el.value = ''")
    mobile.select_option("#sector", "giyim")
    mobile.wait_for_timeout(200)
    mobile.eval_on_selector("#results", "el => el.scrollIntoView({block:'start'})")
    mobile.wait_for_timeout(600)
    mobile.screenshot(path="shot_mobile_results.png")

    # 7) Mobil karanlik tema, sonuc kartlari
    mobile.click("#themeToggleBtn")
    mobile.wait_for_timeout(400)
    mobile.screenshot(path="shot_mobile_dark_results.png")
    mobile.click("#themeToggleBtn")  # sonraki senaryo icin acik temaya don
    mobile.wait_for_timeout(400)

    # 8) Mobil, ayarlar paneli (acik tema) -- sektor tablosu + kademeli (Takı) satiri
    mobile.click("#settingsToggleBtn")
    mobile.wait_for_timeout(300)
    mobile.eval_on_selector("#settingsPanel", "el => el.scrollIntoView({block:'start'})")
    mobile.screenshot(path="shot_settings_mobile_light.png", full_page=True)
    mobile.close()

    # 9) Genis ekran, karanlik tema, ayarlar paneli -- tum bolumler acik
    wide2 = browser.new_page(viewport={"width": 1400, "height": 1000})
    wide2.goto(f"{BASE}/index.html", wait_until="networkidle")
    wide2.click("#themeToggleBtn")
    wide2.wait_for_timeout(400)
    wide2.click("#settingsToggleBtn")
    wide2.wait_for_timeout(300)
    for gid in ("settingsGroupFees", "settingsGroupShopier", "settingsGroupShopify", "settingsGroupEtsy", "settingsGroupFx"):
        wide2.eval_on_selector(f"#{gid}", "el => { el.open = true; }")
    wide2.eval_on_selector("#settingsPanel", "el => el.scrollIntoView({block:'start'})")
    wide2.screenshot(path="shot_settings_wide_dark.png", full_page=True)
    wide2.close()

    # 10) Mobil, kayitli urunler panosu (ozet + siralama/filtre + kartlar) --
    # 3 sentetik kayit KHStore'a dogrudan eklenip panel aciliyor. NOT: <dialog>
    # bir "top layer" elemani oldugu icin full_page=True bu panelde guvenilir
    # calismiyor (Playwright/Chromium, dialog icerigini viewport'a gore degil
    # document'e gore kirpiyor) -- bu yuzden BILEREK normal (viewport) screenshot
    # kullaniliyor, tipki asagidaki gibi.
    dash = browser.new_page(viewport={"width": 420, "height": 900})
    dash.goto(f"{BASE}/index.html", wait_until="networkidle")
    dash.evaluate("""
        () => {
          var specs = [
            { name: 'Kışlık Kaban', sectorId: 'giyim', costTRY: 100, marginPct: 20, prioritySite: 'shopify' },
            { name: 'Akıllı Telefon Kılıfı', sectorId: 'telefon', costTRY: 200, marginPct: 15, prioritySite: 'trendyol' },
            { name: 'Deri Bot', sectorId: 'ayakkabi', costTRY: 50, marginPct: 30, prioritySite: 'amazon' }
          ];
          var chain = Promise.resolve();
          specs.forEach(function (spec) {
            var input = { costTRY: spec.costTRY, sectorId: spec.sectorId, marginPct: spec.marginPct,
              kargoTRY: 30, reklamTRY: 0, shopifyPlanId: 'basic', etsyPaymentPct: 4,
              etsyOffsiteAds: false, etsyOverThreshold: false, monthlyUnits: 10 };
            var results = KH.computeAll(input);
            var rec = { name: spec.name, prioritySite: spec.prioritySite, image: null,
              createdAt: Date.now(), input: input, results: results };
            chain = chain.then(function () { return KHStore.addItem(rec); });
          });
          return chain;
        }
    """)
    dash.click("#savedListBtn")
    dash.wait_for_timeout(500)
    dash.screenshot(path="shot_saved_dashboard_light.png")
    dash.close()

    # 11) Genis ekran, acik tema, toplu hesaplama -- gecerli bir CSV yuklenmis,
    # sonuc tablosu (7 platform sutunu + "en ucuz" kalin vurgusu) goruntude.
    import csv as _csv
    import tempfile, os
    valid_csv = os.path.join(tempfile.gettempdir(), "shot_bulk_valid.csv")
    with open(valid_csv, "w", encoding="utf-8-sig", newline="") as f:
        w = _csv.writer(f)
        w.writerow(["Ürün Adı", "Maliyet (₺)", "Sektör", "Hedef Kâr (%)", "Kargo (₺)", "Reklam (₺)", "Aylık Adet"])
        w.writerow(["Kışlık Mont", "450", "Giyim", "25", "", "", "20"])
        w.writerow(["Bluetooth Kulaklık", "180", "Elektronik Aksesuar", "30", "45", "10", "50"])
        w.writerow(["Deri Cüzdan", "90", "Çanta, Bavul, Seyahat", "35", "", "", ""])

    bulk = browser.new_page(viewport={"width": 1400, "height": 1000})
    bulk.goto(f"{BASE}/index.html", wait_until="networkidle")
    bulk.click("#bulkToggleBtn")
    bulk.wait_for_timeout(300)
    bulk.set_input_files("#bulkFileInput", valid_csv)
    bulk.wait_for_timeout(400)
    bulk.eval_on_selector("#bulkPanel", "el => el.scrollIntoView({block:'start'})")
    bulk.screenshot(path="shot_bulk_wide_light.png", full_page=True)

    # 12) Ayni panel, karanlik tema + kismi hata iceren CSV -- ".bulk-row-error"
    # vurgusu ve gecerli satirin BIRLIKTE dogru gorundugunu kontrol eder.
    mixed_csv = os.path.join(tempfile.gettempdir(), "shot_bulk_mixed.csv")
    with open(mixed_csv, "w", encoding="utf-8-sig", newline="") as f:
        w = _csv.writer(f)
        w.writerow(["Ürün Adı", "Maliyet (₺)", "Sektör", "Hedef Kâr (%)"])
        w.writerow(["İyi Ürün", "200", "Giyim", "25"])
        w.writerow(["Kötü Maliyet", "abc", "Giyim", "25"])
        w.writerow(["Kötü Sektör", "150", "Var Olmayan Sektör XYZ", "25"])

    bulk.click("#themeToggleBtn")
    bulk.wait_for_timeout(300)
    bulk.set_input_files("#bulkFileInput", mixed_csv)
    bulk.wait_for_timeout(400)
    bulk.eval_on_selector("#bulkPanel", "el => el.scrollIntoView({block:'start'})")
    bulk.screenshot(path="shot_bulk_wide_dark_errors.png", full_page=True)
    bulk.close()

    browser.close()

print("Ekran goruntuleri kaydedildi.")
