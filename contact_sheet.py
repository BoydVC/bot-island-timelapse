#!/usr/bin/env python3
"""Contact sheet (out/contact-sheet.jpg): 20 evenly spaced frames with video time + on-screen ET date/time,
plus screenshots/00-best-*.png (busiest message moment) and a few stills."""
import json, os, shutil
from datetime import datetime
from zoneinfo import ZoneInfo
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ET = ZoneInfo("America/New_York")
log = [json.loads(l) for l in open(os.path.join(HERE, "data", "framelog.jsonl"))]
F = lambda i: os.path.join(HERE, "frames", f"f{i:05d}.jpg")
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
cols, rows, tw, th = 5, 4, 384, 216
picks = [int(k * (len(log) - 1) / (cols * rows - 1)) for k in range(cols * rows)]
sheet = Image.new("RGB", (cols * tw + (cols + 1) * 8, rows * (th + 26) + (rows + 1) * 8 + 44), "#0b1220")
d = ImageDraw.Draw(sheet)
d.text((10, 12), "Bot Island Time-lapse · contact sheet · 1280x720 · %.1f s · 24 fps" % (len(log) / 24), font=font, fill="#e2e8f0")
for n, i in enumerate(picks):
    c, r = n % cols, n // cols; x = 8 + c * (tw + 8); y = 44 + 8 + r * (th + 34)
    sheet.paste(Image.open(F(i)).resize((tw, th), Image.LANCZOS), (x, y))
    f = log[i]; when = datetime.fromtimestamp(f["t"] / 1000, ET).strftime("%a %b %d %I:%M %p ET") if f["phase"] == "main" else f["phase"] + " card"
    d.text((x, y + th + 5), f"{i / 24:5.1f}s · {when}", font=small, fill="#cbd5e1")
sheet.save(os.path.join(HERE, "out", "contact-sheet.jpg"), quality=88)
# stills
main = [f for f in log if f["phase"] == "main"]
from datetime import timezone
def near(iso):  # main frame closest to a moment (stills are picked at fixed real moments)
    t = datetime.fromisoformat(iso).timestamp() * 1000
    return min(main, key=lambda f: abs(f["t"] - t))["i"]
sd = os.path.join(HERE, "screenshots"); os.makedirs(sd, exist_ok=True)
for name, i in [("00-best-sep14-morning-rush", near("2026-09-14T08:36:00-04:00")), ("01-title", 60), ("02-sep11-messages", near("2026-09-11T15:28:00-04:00")),
                ("03-sep10-night", near("2026-09-10T22:39:00-04:00")), ("04-oct-outputs", near("2026-10-06T06:50:00-04:00")), ("05-end-card", len(log) - 30)]:
    Image.open(F(i)).save(os.path.join(sd, f"{name}.png"))
    print(name, i, datetime.fromtimestamp(log[i]["t"] / 1000, ET).strftime("%a %b %d %I:%M %p ET"))
print("out/contact-sheet.jpg")
