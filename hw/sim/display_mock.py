"""Mock-ups of the station's 0.91" 128 x 32 SSD1306 OLED (STEMMA QT, in the display pod) -> docs/display_mock.png.
These are what the firmware is specified to show (21 characters x 4 lines at 6 x 8 px); the numbers are from the simulations
(hw/sim, sim/geant4), not measurements.   Usage: python sim/display_mock.py"""
import os
import matplotlib
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = ImageFont.truetype(os.path.join(matplotlib.get_data_path(), "fonts", "ttf", "DejaVuSansMono.ttf"), 8)
S = 5   # pixel size in the render

def screen(lines, title):
    img = Image.new("1", (128, 32), 0); d = ImageDraw.Draw(img); d.fontmode = "1"
    for i, ln in enumerate(lines): d.text((0, i * 8 - 2), ln[:21], font=FONT, fill=1)
    big = img.resize((128 * S, 32 * S), Image.NEAREST).convert("RGB")
    px = Image.new("RGB", big.size, (5, 8, 18))
    for y in range(32):
        for x in range(128):
            if img.getpixel((x, y)):
                ImageDraw.Draw(px).rectangle([x * S, y * S, x * S + S - 2, y * S + S - 2], fill=(150, 215, 255))
    return px, title

SCREENS = [
    (["MUON3 REV C  FW 0.1", "HV 68.3V  I2C 4/4 OK", "INJ  4/4 CH   OK", "SELF-TEST  PASS"], "power-up self-test"),
    (["T0 20.9 T1 21.4 /s", "T2 19.8 T3 22.1 /s", "4x 0.031/s  1012hPa", "HV68.4 27C WIFI+ OK"], "live rates"),
    (["TILE1 CAL 1pe 5.8mV", "VOP 68.9V  VTH 29mV", "STEPS 7  EFF 90%", "SAVED"], "tile calibration"),
    (["CH2 NO PULSES", "INJ FAIL  3/4 CH", "CHECK J4 CABLE", "SELF-TEST  FAIL"], "a fault"),
]
tiles = [screen(*s) for s in SCREENS]
w, h = tiles[0][0].size
sheet = Image.new("RGB", (2 * w + 30, 2 * (h + 46) + 10), (236, 238, 242)); d = ImageDraw.Draw(sheet)
tf = ImageFont.truetype(os.path.join(matplotlib.get_data_path(), "fonts", "ttf", "DejaVuSans.ttf"), 20)
for i, (im, title) in enumerate(tiles):
    x, y = 10 + (i % 2) * (w + 10), 10 + (i // 2) * (h + 46)
    d.text((x, y), title, fill=(30, 34, 44), font=tf); sheet.paste(im, (x, y + 30))
sheet.save(os.path.join(HERE, "..", "docs", "display_mock.png"))
print("wrote docs/display_mock.png")
