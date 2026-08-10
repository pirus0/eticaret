#!/usr/bin/env python3
"""PWA ikonlarini uretir: indigo (#4338CA) zemin + beyaz '%' glifi.
Kullanim: python3 scripts/gen_icons.py  (kar-hesap/ klasorunden calistirin)
"""
import os
from PIL import Image, ImageDraw, ImageFont

BRAND = (67, 56, 202, 255)   # #4338CA
WHITE = (255, 255, 255, 255)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def draw_percent(size, glyph_ratio, bg=BRAND, fg=WHITE, corner_ratio=0.0):
    """size x size'lik bir kare ikon, ortalanmis '%' harfi ile ciz."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if corner_ratio > 0:
        radius = int(size * corner_ratio)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg)
    else:
        draw.rectangle([0, 0, size - 1, size - 1], fill=bg)

    target_h = size * glyph_ratio
    font_size = int(target_h)
    font = ImageFont.truetype(FONT_PATH, font_size)
    text = "%"

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Kucult/buyut, gercek glif yuksekligi hedefe otursun
    scale = target_h / text_h if text_h > 0 else 1
    font = ImageFont.truetype(FONT_PATH, int(font_size * scale))
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fg)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Favicon'lar (dis hatlari yumusatmak icin 4x supersample)
    for size in (16, 32):
        big = draw_percent(size * 4, glyph_ratio=0.66, corner_ratio=0.18)
        icon = big.resize((size, size), Image.LANCZOS)
        icon.save(os.path.join(OUT_DIR, f"favicon-{size}.png"))

    # Apple touch icon: iOS kendi kose yuvarlatmasini uyguluyor, tam kare + opak zemin ister
    apple = draw_percent(180 * 2, glyph_ratio=0.6, corner_ratio=0.0)
    apple = apple.convert("RGB").resize((180, 180), Image.LANCZOS)
    apple.save(os.path.join(OUT_DIR, "apple-touch-icon.png"))

    # "any" amacli PWA ikonlari (192 / 512)
    for size in (192, 512):
        icon = draw_percent(size, glyph_ratio=0.6, corner_ratio=0.22)
        icon.save(os.path.join(OUT_DIR, f"icon-{size}.png"))

    # "maskable" ikonlar: OS disariyi daireye kirpabilir, glif guvenli bolgede (merkez %80) kalmali
    for size in (192, 512):
        icon = draw_percent(size, glyph_ratio=0.42, corner_ratio=0.0)
        icon.save(os.path.join(OUT_DIR, f"icon-{size}-maskable.png"))

    print("Ikonlar olusturuldu:", os.listdir(OUT_DIR))


if __name__ == "__main__":
    main()
