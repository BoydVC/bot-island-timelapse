#!/usr/bin/env python3
"""Check that the counts on screen match the source data. Read-only; exits non-zero on any failure.

1. Recomputes every count straight from ../bot-island/data/fleet.json (independent of prep.py) and compares it,
   frame by frame, with what the renderer drew (data/framelog.jsonl, written by render.mjs from the same variables
   it paints in the "Recorded so far" panel).
2. OCRs the counter panel on sampled rendered frames (tesseract) and compares the digits with the source counts.
3. Confirms every labelled jump skips only event-free time, and that the end card totals equal the source totals.
4. Privacy: no money routine names in the baked data; no message text fields exist or are baked.
5. Deliverables: MP4 is 1280x720, 60-90 s, < 20 MB; GIF < 12 MB."""
import json, os, re, subprocess, sys, bisect, glob
from datetime import datetime
HERE = os.path.dirname(os.path.abspath(__file__))
FLEET = os.path.normpath(os.path.join(HERE, "..", "bot-island", "data", "fleet.json"))
CONFIG = os.path.normpath(os.path.join(HERE, "..", "bot-island", "config.json"))
MONEY = re.compile(r"bill|financ|cash|money|statement|budget|pay|bank|invest|loan|\$", re.I)
fails = []
def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)
def ms(ts): return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000)

# ---- 1. independent recount from fleet.json ----
fleet = json.load(open(FLEET)); hide = set(json.load(open(CONFIG)).get("hide", []))
ids = {b["id"] for b in fleet["bots"] if b["name"] not in hide}
KIND = {"mcp_tool_call": "tool", "shell_command": "tool", "browser_navigation": "tool", "computer_use_session": "tool",
        "agent_msg": "msg", "boyd_msg": "boyd", "dated_output": "output", "file_write": "output", "routine_touch": "output"}
times = {k: [] for k in ("run", "msg", "boyd", "tool", "output")}
for e in fleet["events"]:
    k = KIND.get(e["type"])
    if not k or e.get("bot") not in ids or (k == "msg" and e.get("from") not in ids): continue
    times[k].append(ms(e["ts"]))
for b in fleet["bots"]:
    if b["id"] not in ids: continue
    for r in b.get("routines", []):
        for x in r.get("runs", []): times["run"].append(ms(x["start"]))
for v in times.values(): v.sort()
src_tot = {k: len(v) for k, v in times.items()}
print("source totals:", src_tot)
skipped_types = sorted({e["type"] for e in fleet["events"]} - set(KIND))
print("event types not counted (none expected):", skipped_types)
ok(not skipped_types, "every event type in fleet.json is counted in one of the five counters")

log = [json.loads(l) for l in open(os.path.join(HERE, "data", "framelog.jsonl"))]
tl = json.load(open(os.path.join(HERE, "data", "timeline.json")))
bad = 0
for f in log:
    if f["phase"] == "title": continue
    want = {k: bisect.bisect_right(v, f["t"]) for k, v in times.items()}
    if f["counts"] != want:
        bad += 1
        if bad <= 5: print("   mismatch frame", f["i"], f["counts"], want)
ok(bad == 0, f"on-screen counts match fleet.json at every one of {sum(1 for f in log if f['phase'] != 'title')} counter frames")
end = [f for f in log if f["phase"] == "end"]
ok(all(f["counts"] == src_tot for f in end), f"end card totals equal source totals ({len(end)} frames)")
ok(sum(sum(f["fresh"].values()) for f in log) == sum(src_tot.values()), "every source event triggers exactly once on screen")
main = [f for f in log if f["phase"] == "main"]
ok(all(a["t"] <= b["t"] for a, b in zip(main, main[1:])), "sim clock never runs backwards")
allt = sorted(t for v in times.values() for t in v)
ok(main[0]["t"] <= allt[0] and main[-1]["t"] >= allt[-1], "time-lapse covers the first and last recorded event")

# ---- 3. jumps skip only event-free time ----
jumps = tl["schedule"]["jumps"]
inside = sum(bisect.bisect_left(allt, j["to"]) - bisect.bisect_right(allt, j["from"]) for j in jumps)
ok(inside == 0, f"{len(jumps)} labelled jumps contain 0 recorded events")

# ---- 4. privacy ----
labels = {e.get("label") for e in tl["events"] if e.get("label")}
ok(not any(MONEY.search(l) for l in labels if l != "routine run"), f"no money routine names baked ({len(labels)} labels: {sorted(labels)})")
keys = {k for e in tl["events"] for k in e}
ok(keys <= {"k", "t", "end", "bot", "from", "label", "approx"}, f"baked events carry only who/when/kind/routine name ({sorted(keys)})")

# ---- 2. OCR the counter panel on sampled frames ----
frames = sorted(glob.glob(os.path.join(HERE, "frames", "f*.jpg")))
if frames and subprocess.run(["which", "tesseract"], capture_output=True).returncode == 0:
    from PIL import Image, ImageOps
    byi = {f["i"]: f for f in log}
    picks = [f["i"] for f in log if f["phase"] == "main"]
    picks = [picks[int(k * (len(picks) - 1) / 13)] for k in range(14)] + [next(f["i"] for f in log if f["phase"] == "end")]
    def tess(path, psm):
        return re.sub(r"[^0-9]", "", subprocess.run(["tesseract", path, "-", "--psm", str(psm), "-c", "tessedit_char_whitelist=0123456789,"], capture_output=True, text=True).stdout)
    okn = wrong_total = unread_total = 0
    for i in picks:
        frame = Image.open(frames[i]).convert("L"); nums = []
        for j in range(5):                       # one OCR pass per counter row (right-aligned numbers)
            y = 14 + 46 + j * 25
            im = ImageOps.autocontrast(frame.crop((1188, y - 16, 1256, y + 6)))
            im = ImageOps.invert(im).resize((68 * 5 // 2, 22 * 5 // 2), Image.LANCZOS).point(lambda p: 0 if p < 140 else 255)
            tmp = f"/tmp/bitl-ocr-{i}-{j}.png"; ImageOps.expand(im, 20, fill=255).save(tmp)
            dig = tess(tmp, 7)
            if len(dig) <= 1:
                # tesseract is unreliable on a lone glyph: tile the glyph 3x ("000") and accept only a consistent triple
                bbox = ImageOps.invert(im).getbbox()
                if bbox:
                    g = im.crop((max(0, bbox[0] - 6), 0, min(im.width, bbox[2] + 6), im.height))
                    strip = Image.new("L", (g.width * 3, g.height), 255)
                    for r in range(3): strip.paste(g, (r * g.width, 0))
                    ImageOps.expand(strip, 20, fill=255).save(tmp)
                    tri = tess(tmp, 7)
                    dig = tri[0] if len(tri) == 3 and len(set(tri)) == 1 else ""
            nums.append(int(dig) if dig else None)
        want = [byi[i]["counts"][k] for k in ("run", "msg", "boyd", "tool", "output")]
        wrong = sum(1 for a2, b2 in zip(nums, want) if a2 is not None and a2 != b2); unread = nums.count(None)
        okn += nums == want; wrong_total += wrong; unread_total += unread
        print(f"   OCR frame {i:5d} ({byi[i]['phase']}): read {nums} expected {want} {'ok' if nums == want else ('WRONG' if wrong else 'unread digit')}")
    ok(wrong_total == 0 and okn >= len(picks) - 2, f"OCR of the on-screen counter panel: {okn}/{len(picks)} sampled frames read back exactly; "
                         f"{wrong_total} numbers read differently from the source, {unread_total} unreadable")
else:
    print("SKIP OCR (no frames/ or no tesseract)")

# ---- 5. deliverables ----
mp4 = os.path.join(HERE, "out", "bot-island-timelapse.mp4"); gif = os.path.join(HERE, "out", "bot-island-timelapse.gif")
if os.path.exists(mp4):
    p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4], capture_output=True, text=True).stdout)
    v = next(s for s in p["streams"] if s["codec_type"] == "video"); d = float(p["format"]["duration"]); sz = os.path.getsize(mp4)
    ok(v["width"] == 1280 and v["height"] == 720, f"MP4 is {v['width']}x{v['height']}")
    ok(60 <= d <= 90, f"MP4 duration {d:.2f} s")
    ok(sz < 20e6, f"MP4 size {sz / 1e6:.2f} MB")
    ok(int(v.get("nb_frames", len(log))) == len(log), f"MP4 has {v.get('nb_frames')} frames = {len(log)} rendered")
    ok(any(s["codec_type"] == "audio" for s in p["streams"]), "MP4 has the synthesized soundtrack")
else: ok(False, "MP4 exists")
if os.path.exists(gif): ok(os.path.getsize(gif) < 12e6, f"GIF size {os.path.getsize(gif) / 1e6:.2f} MB")
else: ok(False, "GIF exists")

print("\nTotals shown on screen at the end:", ", ".join(f"{k}={v:,}" for k, v in src_tot.items()))
print("ALL CHECKS PASSED" if not fails else f"{len(fails)} CHECK(S) FAILED")
sys.exit(1 if fails else 0)
