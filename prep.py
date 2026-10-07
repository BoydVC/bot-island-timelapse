#!/usr/bin/env python3
"""Bot Island Time-lapse: data prep. Reads Bot Island's data READ-ONLY and writes data/timeline.json + src/data.js.

Sources (never written): ../bot-island/data/fleet.json, ../bot-island/config.json, ../bot-island/web/app.js (layout).
Event classes (each is one real record in fleet.json; nothing is invented):
  run     routine run from a routine's runs list (start/end)       -> bot walks to work, bubble = routine name
  msg     agent_msg (bot -> bot)                                   -> spark flies sender -> recipient
  boyd    boyd_msg (Boyd -> bot)                                   -> purple spark from Boyd's Place
  tool    mcp_tool_call / shell_command / browser_navigation / computer_use_session -> bot at work (no details shown)
  output  dated_output / file_write / routine_touch (output-file signals) -> paper pop at the bot's building
Only bot names, routine names and counts are ever shown. Money-related routine names are replaced by "routine run".
"""
import json, os, re, math, collections
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
HERE = os.path.dirname(os.path.abspath(__file__))
BI = os.path.normpath(os.path.join(HERE, "..", "bot-island"))
FLEET = os.path.join(BI, "data", "fleet.json"); CONFIG = os.path.join(BI, "config.json"); APPJS = os.path.join(BI, "web", "app.js")
ET = ZoneInfo("America/New_York")
MONEY = re.compile(r"bill|financ|cash|money|statement|budget|pay|bank|invest|loan|\$", re.I)
TOOL_TYPES = {"mcp_tool_call", "shell_command", "browser_navigation", "computer_use_session"}
OUTPUT_TYPES = {"dated_output", "file_write", "routine_touch"}
FPS = 24
TITLE_FRAMES = 84     # 3.5 s
END_FRAMES = 120      # 5.0 s
MAIN_TARGET = 1716    # ~71.5 s of island time-lapse
BIN_MIN = 15
JUMP_HOURS = 16       # event-free stretches at least this long are jumped (and labelled)
JUMP_FRAMES = 14

def ro(p):
    with open(p, "r", encoding="utf-8") as f: return f.read()
def ms(ts): return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000)

def classify(e):
    t = e["type"]
    if t in TOOL_TYPES: return "tool"
    if t == "agent_msg": return "msg"
    if t == "boyd_msg": return "boyd"
    if t in OUTPUT_TYPES: return "output"
    return None

def load():
    fleet = json.loads(ro(FLEET)); cfg = json.loads(ro(CONFIG))
    hide = set(cfg.get("hide", []))
    bots = [b for b in fleet["bots"] if b["name"] not in hide]
    ids = {b["id"] for b in bots}
    return fleet, bots, ids

def source_events(fleet, bots, ids):
    """Every countable event, straight from fleet.json. Used by both prep and check."""
    out = []
    for e in fleet["events"]:
        k = classify(e)
        if not k or e.get("bot") not in ids: continue
        if k == "msg" and e.get("from") not in ids: continue
        out.append({"k": k, "t": ms(e["ts"]), "bot": e["bot"], "from": e.get("from"), "approx": bool(e.get("approx"))})
    for b in bots:
        for r in b.get("routines", []):
            for x in r.get("runs", []):
                s = ms(x["start"]); en = ms(x["end"]) if x.get("end") else s + 5 * 60000
                label = "routine run" if MONEY.search(r["name"]) else r["name"]
                out.append({"k": "run", "t": s, "end": en, "bot": b["id"], "label": label})
    out.sort(key=lambda e: (e["t"], e["k"]))
    return out

def layout():
    js = ro(APPJS)
    colors = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", re.search(r"const COLORS = \{(.*?)\};", js).group(1)))
    blk = re.search(r"const BUILDINGS = \{(.*?)\n\};", js, re.S).group(1)
    b = {}
    for m in re.finditer(r"(\w+):\s*\{x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*name:\s*(['\"])(.*?)\4,\s*emoji:\s*'(.*?)'(.*?)\}", blk):
        b[m.group(1)] = {"x": float(m.group(2)), "y": float(m.group(3)), "name": m.group(5), "emoji": m.group(6)}
    emo = dict(re.findall(r"'?([\w .()\-]+?)'?:\s*'([^']+)'", re.search(r"const EMOJI = \{(.*?)\};", js).group(1)))
    return colors, b, emo

def schedule(events):
    t_first = min(e["t"] for e in events); t_last = max(e["t"] for e in events)
    B = BIN_MIN * 60000
    T0 = (t_first // B) * B - 4 * B           # start one hour before the first record
    T1 = (t_last // B + 1) * B + 4 * B        # end one hour after the last record
    nb = (T1 - T0) // B
    w = [0.0] * nb
    for e in events:
        i = (e["t"] - T0) // B
        w[i] += {"run": 3.0, "msg": 1.2, "boyd": 1.2, "output": 0.8, "tool": 0.12}[e["k"]]
    # bins covered by a running routine count as active too
    for e in events:
        if e["k"] == "run":
            for i in range((e["t"] - T0) // B, min(nb, (e["end"] - T0) // B + 1)): w[i] = max(w[i], 1.0)
    # find jumps: runs of empty bins >= JUMP_HOURS
    jumps = []; i = 0
    while i < nb:
        if w[i] == 0:
            j = i
            while j < nb and w[j] == 0: j += 1
            if (j - i) * BIN_MIN >= JUMP_HOURS * 60:
                # keep 1 h of lead-out / lead-in so bots visibly settle
                a, b = i + 4, j - 4
                jumps.append((a, b))
            i = j
        else: i += 1
    in_jump = [None] * nb
    for ji, (a, b) in enumerate(jumps):
        for k in range(a, b): in_jump[k] = ji
    BASE = 0.2    # frames per quiet 15-min bin (~0.8 frames per quiet hour)
    def total(kf):
        tot = len(jumps) * JUMP_FRAMES
        for i in range(nb):
            if in_jump[i] is None: tot += BASE + kf * math.sqrt(w[i])
        return tot
    lo, hi = 0.0, 50.0
    for _ in range(60):
        mid = (lo + hi) / 2
        (lo, hi) = (mid, hi) if total(mid) < MAIN_TARGET else (lo, mid)
    kf = lo
    # emit per-frame sim times by integrating a fractional frame budget
    frames = []; acc = 0.0; i = 0
    jump_meta = []
    while i < nb:
        if in_jump[i] is not None:
            a, b = jumps[in_jump[i]]
            ta, tb = T0 + a * B, T0 + b * B
            jump_meta.append({"from": ta, "to": tb, "frame": len(frames)})
            for f in range(1, JUMP_FRAMES + 1):
                u = f / JUMP_FRAMES; u = u * u * (3 - 2 * u)
                frames.append({"t": int(ta + (tb - ta) * u), "jump": len(jump_meta) - 1})
            i = b; continue
        n = BASE + kf * math.sqrt(w[i])
        start = acc; acc += n
        k0, k1 = math.ceil(start - 1e-9), math.ceil(acc - 1e-9)
        for f in range(k0, k1):
            u = (f - start) / n if n else 0
            frames.append({"t": int(T0 + i * B + u * B)})
        i += 1
    # guarantee the last frame reaches T1
    frames.append({"t": T1})
    return {"T0": T0, "T1": T1, "frames": frames, "jumps": jump_meta, "kf": kf}

def main():
    fleet, bots, ids = load()
    events = source_events(fleet, bots, ids)
    colors, buildings, emo = layout()
    sch = schedule(events)
    tl = {
        "builtFrom": os.path.relpath(FLEET, HERE), "fleetGeneratedAt": fleet.get("generatedAt"),
        "fps": FPS, "titleFrames": TITLE_FRAMES, "endFrames": END_FRAMES,
        "buildings": buildings, "palette": colors,
        "bots": [{"id": b["id"], "name": b["name"], "hex": colors.get(b.get("color"), "#94a3b8"), "shape": b.get("shape"),
                  "building": b.get("building") or "commons", "emoji": emo.get(b["name"], "🤖")} for b in bots],
        "eggs": fleet.get("eggs", []),
        "events": events, "schedule": sch,
        "totals": dict(collections.Counter(e["k"] for e in events)),
        "logsEnd": ms(fleet["sources"]["auditNewest"]),
    }
    with open(os.path.join(HERE, "data", "timeline.json"), "w") as f: json.dump(tl, f)
    with open(os.path.join(HERE, "src", "data.js"), "w") as f: f.write("window.TL = " + json.dumps(tl) + ";\n")
    main_frames = len(sch["frames"])
    print(f"events={len(events)} totals={tl['totals']} main_frames={main_frames} jumps={len(sch['jumps'])} kf={sch['kf']:.3f}")
    print(f"video frames={TITLE_FRAMES + main_frames + END_FRAMES} -> {(TITLE_FRAMES + main_frames + END_FRAMES) / FPS:.1f}s")
    for j in sch["jumps"]:
        a = datetime.fromtimestamp(j["from"] / 1000, ET); b = datetime.fromtimestamp(j["to"] / 1000, ET)
        print("  jump", a.strftime("%b %d %I:%M %p"), "->", b.strftime("%b %d %I:%M %p"), f"{(j['to'] - j['from']) / 3600000:.1f} h")

if __name__ == "__main__": main()
