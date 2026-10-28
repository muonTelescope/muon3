# 2 x 2 sheet of the four copper layer renders with their names (called by render_board.py).
#   python3 hw/case/bench/compose_layers.py <outdir> L1.png L2.png L3.png L4.png
import os, sys
from PIL import Image, ImageDraw, ImageFont

out, files = sys.argv[1], sys.argv[2:6]
NAMES = ["L1  SIGNAL + PARTS (TOP VIEW)", "L2  SOLID GND (TOP VIEW)", "L3  SIGNAL / POWER (TOP VIEW)", "L4  SIGNAL (BOTTOM VIEW)"]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
band = int(h * 0.09)
sheet = Image.new("RGB", (2 * w, 2 * (h + band)), "white")
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", int(band * 0.55))
except OSError: font = ImageFont.load_default()
d = ImageDraw.Draw(sheet)
for i, (im, name) in enumerate(zip(ims, NAMES)):
    x, y = (i % 2) * w, (i // 2) * (h + band)
    d.text((x + int(w * 0.03), y + int(band * 0.2)), name, fill=(30, 30, 30), font=font)
    sheet.paste(im, (x, y + band))
sheet.save(os.path.join(out, "bench_copper.png"))
print("wrote", os.path.join(out, "bench_copper.png"))
