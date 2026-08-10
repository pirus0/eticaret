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

    browser.close()

print("Ekran goruntuleri kaydedildi.")
