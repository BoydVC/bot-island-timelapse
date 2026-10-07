#!/usr/bin/env python3
"""Synthesized soundtrack for the time-lapse (no samples, nothing copyrighted).
A soft pentatonic pad (darker at night) + a bell for each routine run, a pluck for bot-to-bot messages,
a two-note blip for Boyd's messages and a whoosh for every labelled jump. Timed from data/framelog.jsonl."""
import json, os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SR, FPS = 44100, 24
log = [json.loads(l) for l in open(os.path.join(HERE, "data", "framelog.jsonl"))]
N = len(log); dur = N / FPS; n = int(dur * SR) + SR
out = np.zeros(n)
t = np.arange(n) / SR
rng = np.random.default_rng(7)
def note(f): return 440.0 * 2 ** ((f - 69) / 12)

# --- pad: Cmaj9 / Am9 / Fmaj9 / G6sus, 4 s each, crossfaded ---
chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 64], [41, 48, 52, 55, 60], [43, 50, 55, 57, 62]]
dk = np.interp(t, np.arange(N) / FPS, [f["dk"] for f in log])
seg = 4.0
for ci in range(int(dur / seg) + 2):
    ch = chords[ci % 4]; s0 = ci * seg - 1.0; s1 = s0 + seg + 2.0
    a, b = int(max(0, s0) * SR), int(min(n / SR, s1) * SR)
    if a >= b: continue
    tt = t[a:b] - s0
    env = np.clip(tt / 1.2, 0, 1) * np.clip((s1 - s0 - tt) / 1.2, 0, 1)
    sig = np.zeros(b - a)
    for m in ch:
        f = note(m); ph = rng.random() * 6.28
        sig += np.sin(2 * np.pi * f * tt + ph) * 0.6
        sig += np.sin(2 * np.pi * f * 2.0 * tt + ph) * 0.18 * (1 - dk[a:b])          # brighter by day
        sig += np.sin(2 * np.pi * f * 0.5 * tt + ph) * 0.22 * dk[a:b]                 # warmer at night
    sig *= 1 + 0.15 * np.sin(2 * np.pi * 0.25 * tt)
    out[a:b] += sig * env * 0.045

def add(at, sig):
    a = int(at * SR); b = min(n, a + len(sig))
    if a < n: out[a:b] += sig[: b - a]
def bell(f, amp, d=1.6):
    tt = np.arange(int(d * SR)) / SR
    return amp * np.exp(-tt * 3.2) * (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 5))
def pluck(f, amp):
    tt = np.arange(int(0.35 * SR)) / SR
    return amp * np.exp(-tt * 14) * np.sin(2 * np.pi * f * tt) * (1 - np.exp(-tt * 400))
def whoosh(amp, d=0.6):
    m = int(d * SR); x = rng.standard_normal(m); y = np.zeros(m); a = 0.0
    for i in range(0, m, 64):                                  # crude swept low-pass
        k = 0.02 + 0.25 * np.sin(np.pi * i / m)
        for j in range(i, min(m, i + 64)): a += k * (x[j] - a); y[j] = a
    return amp * y * np.sin(np.pi * np.arange(m) / m)

PENTA = [72, 74, 76, 79, 81, 84, 86, 88]
last_msg = -9; last_run = -9; prev_jump = None
for f in log:
    i = f["i"]; at = i / FPS; fr = f["fresh"]
    if fr["run"] and i - last_run >= 2:
        for r in range(min(2, fr["run"])): add(at + r * 0.09, bell(note(PENTA[(i * 3 + r * 2) % len(PENTA)]), 0.11))
        last_run = i
    if fr["msg"] and i - last_msg >= 3:
        add(at, pluck(note(PENTA[(i * 5) % len(PENTA)] + 12), 0.06 + 0.01 * min(4, fr["msg"]))); last_msg = i
    if fr["boyd"]:
        add(at, pluck(note(79), 0.06)); add(at + 0.07, pluck(note(84), 0.05))
    if f.get("jump") is not None and f["jump"] != prev_jump: add(at, whoosh(0.5))
    prev_jump = f.get("jump")

# final chord on the end card
end_at = next(f["i"] for f in log if f["phase"] == "end") / FPS
for k, m in enumerate([60, 64, 67, 72, 76]): add(end_at + 0.12 * k, bell(note(m), 0.09, d=4.0))
# fades + normalize
fade = np.ones(n); fi = int(1.0 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo0 = int((dur - 2.0) * SR); fade[fo0:] = np.clip(np.linspace(1, 0, n - fo0) * 1.0, 0, 1); fade[int(dur * SR):] = 0
out *= fade
out = out[: int(dur * SR)]
out = np.concatenate([out, np.zeros(SR // 2)])   # 0.5 s of tail silence so the video (not the audio) sets the length
out /= max(1e-9, np.abs(out).max()) / 0.7
st = np.stack([out, np.roll(out, 220) * 0.92], axis=1)       # tiny stereo spread
pcm = (np.clip(st, -1, 1) * 32767).astype(np.int16)
with wave.open(os.path.join(HERE, "data", "soundtrack.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"soundtrack {dur:.2f}s -> data/soundtrack.wav")
