#!/usr/bin/env python3
"""Genera los iconos de la PWA (Turno 3x4)."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")

BG = (22, 35, 31, 255)       # verde carbón
SHEET = (244, 242, 237, 255) # off-white
STRIP = (217, 123, 74, 255)  # ámbar
DOT = (31, 111, 92, 255)     # verde trabajo


def draw_icon(size, maskable=False):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    if maskable:
        d.rectangle((0, 0, size, size), fill=BG)
    else:
        d.rounded_rectangle((0, 0, size, size), radius=int(size * 0.18), fill=BG)

    s = size / 512.0

    def R(vals):
        return tuple(int(v * s) for v in vals)

    sheet = R((126, 96, 386, 416))
    d.rounded_rectangle(sheet, radius=int(26 * s), fill=SHEET)

    strip = R((126, 96, 386, 150))
    d.rounded_rectangle(strip, radius=int(22 * s), fill=STRIP)

    for cx in (196, 316):
        x, y, r = int(cx * s), int((96 + 123) * s / 2), int(7 * s)
        d.ellipse((x - r, y - r, x + r, y + r), fill=BG)

    work_dots = (172, 228, 284, 340)
    for cx in work_dots:
        x, y = cx * s, 240 * s
        r = 15 * s
        d.ellipse((x - r, y - r, x + r, y + r), fill=DOT)

    rest_dots = (190, 256, 322)
    for cx in rest_dots:
        x, y = cx * s, 332 * s
        r = 13 * s
        d.ellipse((x - r, y - r, x + r, y + r), outline=DOT, width=max(2, int(6 * s)))

    return canvas


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (192,):
        draw_icon(size).resize((size, size), Image.LANCZOS).save(
            os.path.join(OUT, f"icon-{size}.png"))
    draw_icon(512).save(os.path.join(OUT, "icon-512.png"))
    draw_icon(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
    draw_icon(180).resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "icon-180.png"))
    draw_icon(32).resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, "icon-32.png"))
    print("Iconos generados en", OUT)


if __name__ == "__main__":
    main()