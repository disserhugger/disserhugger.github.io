"""
Generates assets/jumpscare.png — the "Mr. Squeeze" rare-jumpscare mascot
(see CLAUDE.md "Chaos Update" > Rare jumpscare). An ORIGINAL character
invented for this game, not a reproduction of Five Nights at Freddy's
Foxy or any other existing copyrighted design.

This is a real, swappable ASSET now (js/core.js loads it via the usual
ASSETS/Sprites/loadSprite pattern, with the old procedural canvas
drawing kept as the fallback if the PNG fails to load — see
drawJumpscareOverlay() in js/render-helpers.js). To change how the
jumpscare looks:
  - Easiest: replace assets/jumpscare.png directly with your own image
    (any size works — it's drawn scaled to fit, same as player/bayat).
  - Or: edit the drawing calls below and re-run this script
    (`pip install Pillow` if needed, then `python gen_jumpscare.py`) to
    regenerate it proceduraly, matching how gen_icons.py/gen_assets.py
    already work for this project's other art.

Saved relative to this script's own location (assets/ next to it), not
a hardcoded absolute path — see CLAUDE.md bug history #14 for why that
matters.
"""
from PIL import Image, ImageDraw
import os

CELL = 64   # base pixel-art resolution
SCALE = 6   # upscale factor (nearest-neighbor) for crispness
outline = (10, 5, 16, 255)
body = (58, 16, 48, 255)
body_light = (90, 30, 76, 255)
eye_white = (255, 255, 255, 255)
eye_dark = (10, 5, 16, 255)
teeth = (255, 255, 255, 255)

img = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

cx, cy = CELL / 2, CELL / 2 + 2

# arms — reaching wide, "wants to hug you"
d.ellipse([cx - 40, cy - 4, cx - 14, cy + 16], fill=body, outline=outline, width=2)
d.ellipse([cx + 14, cy - 4, cx + 40, cy + 16], fill=body, outline=outline, width=2)

# body — big rounded blob, dark outline ring then lighter fill
d.ellipse([cx - 30, cy - 28, cx + 30, cy + 26], fill=outline)
d.ellipse([cx - 27, cy - 25, cx + 27, cy + 23], fill=body)
d.ellipse([cx - 20, cy - 18, cx - 4, cy - 2], fill=body_light)  # soft highlight

# eyes — huge, white, small dark pupils offset for an unsettling look
for side in (-1, 1):
    ex = cx + side * 12
    ey = cy - 8
    d.ellipse([ex - 9, ey - 10, ex + 9, ey + 10], fill=eye_white, outline=outline, width=1)
    px = ex + side * 2
    d.ellipse([px - 3, ey - 2, px + 3, ey + 4], fill=eye_dark)

# wide jagged grin
mx0, mx1, my = cx - 18, cx + 18, cy + 10
d.pieslice([mx0, my - 10, mx1, my + 14], start=10, end=170, fill=outline)
tooth_count = 7
for i in range(tooth_count):
    tx = mx0 + 4 + (i / (tooth_count - 1)) * (mx1 - mx0 - 8)
    d.polygon(
        [(tx - 2.4, my - 2), (tx + 2.4, my - 2), (tx, my + 6)],
        fill=teeth,
    )

big = img.resize((CELL * SCALE, CELL * SCALE), Image.NEAREST)
ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
out_path = os.path.join(ASSETS_DIR, "jumpscare.png")
big.save(out_path)
print("saved:", out_path, "size:", big.size)
