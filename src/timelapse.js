'use strict';
/* Bot Island Time-lapse: deterministic frame renderer. renderFrame(i) must be called with i = 0, 1, 2, ... in order.
   Everything that moves is driven by real records in TL.events; ambient motion (water, flags, clouds) is decoration.
   On screen: bot names, routine names (money ones shown as "routine run") and event counts only. */
const SCH = TL.schedule, FR = SCH.frames, TF = TL.titleFrames, EF = TL.endFrames, M = FR.length, FPS = TL.fps;
const TOTAL_FRAMES = TF + M + EF;
const EV = TL.events;
const VIEW = {s: 0.93}; VIEW.ox = (VW - W * VIEW.s) / 2; VIEW.oy = (VH - H * VIEW.s) / 2 + 2;
const FONT = 'Inter, "Inter Tight", ui-sans-serif, system-ui, sans-serif';
const KINDS = ['run', 'msg', 'boyd', 'tool', 'output'];
const LABEL = {run: 'Routine runs', msg: 'Bot-to-bot messages', boyd: 'Messages from Boyd', tool: 'Tool events', output: 'Output files'};
const ICON = {run: '⏰', msg: '✉️', boyd: '📱', tool: '🧰', output: '📄'};
const KCOL = {run: '#fbbf24', msg: '#7dd3fc', boyd: '#c4b5fd', tool: '#86efac', output: '#fda4af'};

// ---------- bots + houses (same placement rule as Bot Island: alphabetical around the rim) ----------
S.bots = TL.bots.map(b => Object.assign({}, b, {x: 0, y: 0, state: 'sleep', holdT: 0, minFrame: -1, label: '', labelT: 0, labelFrame: -1, phase: (rng(b.id)() * 6.28), moving: false, dir: 1, glowUntil: -1}));
{
  const n = S.bots.length, order = [...S.bots].sort((a, b) => a.name.localeCompare(b.name));
  order.forEach((b, i) => { const a = -Math.PI / 2 + (i + 0.5) * (2 * Math.PI / n) + 0.12; const p = islePoint(a, 0.8); b.home = {x: p.x, y: p.y, a}; b.work = BUILDINGS[b.building] || BUILDINGS.commons; b.x = p.x; b.y = p.y + 4; });
}
const BYID = Object.fromEntries(S.bots.map(b => [b.id, b]));
const BOYD = {home: {x: 712, y: 352}};
function workOffset(b) { const mates = S.bots.filter(o => o.building === b.building); const i = mates.indexOf(b), n = mates.length; return n <= 1 ? {x: 0, y: 34} : {x: (i - (n - 1) / 2) * 26, y: 34}; }
const RUNS = EV.filter(e => e.k === 'run');

// ---------- state ----------
const counts = {run: 0, msg: 0, boyd: 0, tool: 0, output: 0};
let ptr = 0, lastI = -1, sparks = [], pings = [], pops = [], runLog = [], speedHist = [], jumpBanner = null, lastJump = -999;

function darknessAvg(t0, t1) { if (t1 <= t0) return darkness(t1); let s = 0; const n = 10; for (let k = 0; k < n; k++) s += darkness(t0 + (t1 - t0) * (k + 0.5) / n); return s / n; }
function isNight(t) { const p = etParts(t); return p.h >= 22 || p.h < 6; }

function hold(b, simUntil, frameUntil) { b.holdT = Math.max(b.holdT, simUntil); b.minFrame = Math.max(b.minFrame, frameUntil); }
function stepSim(i, k) {
  const t = FR[k].t, tp = k ? FR[k - 1].t : SCH.T0;
  const fresh = {run: 0, msg: 0, boyd: 0, tool: 0, output: 0};
  const pairBurst = {};
  while (ptr < EV.length && EV[ptr].t <= t) {
    const e = EV[ptr++]; counts[e.k]++; fresh[e.k]++;
    const b = BYID[e.bot]; if (!b) continue;
    if (e.k === 'run') { hold(b, e.end + 2 * MIN, i + 32); b.label = e.label; b.labelT = e.end + 2 * MIN; b.labelFrame = i + 34; pings.push({b, at: i, t: e.t, col: '#fbbf24'}); runLog.unshift({t: e.t, bot: b.name, label: e.label}); runLog.length = Math.min(runLog.length, 4); }
    else if (e.k === 'tool') { hold(b, e.t + 6 * MIN, i + 20); }
    else if (e.k === 'output') { hold(b, e.t + 10 * MIN, i + 24); pops.push({b, at: i, t: e.t}); }
    else if (e.k === 'msg' || e.k === 'boyd') {
      hold(b, e.t + 5 * MIN, i + 22);
      const key = (e.k === 'boyd' ? 'boyd' : e.from) + '>' + e.bot;
      if (pairBurst[key]) { pairBurst[key].n++; continue; }
      const sp = {t: e.t, from: e.k === 'boyd' ? 'boyd' : BYID[e.from], to: b, at: i + (Object.keys(pairBurst).length % 6) * 3, n: 1, boyd: e.k === 'boyd'};
      pairBurst[key] = sp; sparks.push(sp);
      if (e.k === 'boyd') pings.push({boyd: true, at: i, t: e.t, col: '#c4b5fd'});
    }
  }
  // routines that are still running keep their bot at work
  for (const r of RUNS) if (r.t <= t && r.end >= tp) { const b = BYID[r.bot]; if (b) { hold(b, r.end + 2 * MIN, -1); if (!(b.labelT >= t)) { b.label = r.label; b.labelT = r.end + 2 * MIN; } } }
  sparks = sparks.slice(-28);
  const night = isNight(t);
  for (const b of S.bots) {
    let tx, ty;
    if (b.holdT >= t || (b.minFrame >= i && t <= b.holdT + 2 * HOUR)) { b.state = 'work'; const o = workOffset(b); tx = b.work.x + o.x; ty = b.work.y + o.y; }
    else if (night) { b.state = 'sleep'; tx = b.home.x; ty = b.home.y + 4; }
    else { b.state = 'idle'; tx = b.home.x + Math.sin(i / 40 + b.phase) * 6; ty = b.home.y + 24; }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d > 0.6) { const step = Math.max(7, d / 12); const f = Math.min(1, step / d); b.x += dx * f; b.y += dy * f; b.moving = d > 2.5; if (Math.abs(dx) > 1) b.dir = dx < 0 ? -1 : 1; } else b.moving = false;
  }
  // playback speed readout (sim hours per real second, smoothed)
  speedHist.push(t - tp); if (speedHist.length > 18) speedHist.shift();
  if (FR[k].jump !== undefined) { const j = SCH.jumps[FR[k].jump]; jumpBanner = j; lastJump = i; }
  return {t, tp, fresh};
}

// ---------- drawing ----------
function tucked(b) { return b.state === 'sleep' && Math.hypot(b.x - b.home.x, b.y - b.home.y - 4) < 4; }
function botPos(b) { return tucked(b) ? {x: b.home.x, y: b.home.y - 14} : {x: b.x, y: b.y}; }
function shortName(n) { return n.replace('Boyd Family Times', 'Family Times').replace(' (archive)', ' ‹arch›'); }
function drawBot(b, now) {
  if (tucked(b)) return;
  const bob = b.moving ? Math.abs(Math.sin(now / 110 + b.phase)) * 3 : Math.sin(now / 600 + b.phase) * 0.8;
  const x = b.x, y = b.y - bob;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 9, 8, 3, 0, 0, 7); ctx.fill();
  if (b.state === 'work') { ctx.fillStyle = 'rgba(74,222,128,.28)'; ctx.beginPath(); ctx.arc(x, y, 15 + Math.sin(now / 300) * 2, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; const sw = b.moving ? Math.sin(now / 90 + b.phase) * 3 : 0;
  ctx.beginPath(); ctx.moveTo(x - 3, y + 6); ctx.lineTo(x - 3 + sw, y + 10); ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + 3 - sw, y + 10); ctx.stroke();
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = b.hex; botShape(b.shape, 9); ctx.fill(); ctx.strokeStyle = shade(b.hex, 0.6); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -14); ctx.stroke();
  ctx.fillStyle = b.state === 'work' ? (Math.floor(now / 250) % 2 ? '#4ade80' : '#bbf7d0') : '#fca5a5'; ctx.beginPath(); ctx.arc(0, -15, 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#0f172a'; rr(-6, -4, 12, 7, 3); ctx.fill();
  ctx.fillStyle = '#7dd3fc'; const ex = b.dir; ctx.fillRect(-4 + ex, -2.5, 2.5, 3.5); ctx.fillRect(1.5 + ex, -2.5, 2.5, 3.5);
  ctx.restore();
  ctx.font = `600 10px ${FONT}`; ctx.textAlign = 'center';
  const nm = shortName(b.name), tw = ctx.measureText(nm).width + 8;
  ctx.fillStyle = 'rgba(15,23,42,.74)'; rr(x - tw / 2, y + 12, tw, 13, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(nm, x, y + 22);
}
function drawSign(b, key) {
  ctx.font = `600 10.5px ${FONT}`; ctx.textAlign = 'center';
  const t = `${b.emoji} ${b.name}`; const w = ctx.measureText(t).width + 10;
  const busy = S.bots.some(o => o.building === key && o.state === 'work');
  ctx.fillStyle = busy ? 'rgba(20,83,45,.9)' : 'rgba(15,23,42,.62)'; rr(b.x - w / 2, b.y + 6, w, 15, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(t, b.x, b.y + 17);
}
function drawClouds(now, dk) {
  for (let i = 0; i < 5; i++) {
    const x = ((now / (60 + i * 17) + i * 300) % (W + 400)) - 200, y = 80 + i * 130 % 600;
    ctx.fillStyle = `rgba(0,0,0,${0.06 * (1 - dk)})`; ctx.beginPath(); ctx.ellipse(x + 30, y + 60, 60, 18, 0, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.35 - dk * 0.25})`;
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 26], [50, 2, 20], [26, 8, 22]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fill(); }
  }
}
function drawBoydHouse(now, dk, asleep) {
  const {x, y} = BOYD.home;
  shadow(x, y + 3, 30, 8);
  ctx.fillStyle = '#f5f5f4'; rr(x - 24, y - 26, 48, 26, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + 16, y - 25, 8, 25);
  ctx.fillStyle = '#4c1d95'; ctx.beginPath(); ctx.moveTo(x - 29, y - 25); ctx.lineTo(x, y - 46); ctx.lineTo(x + 29, y - 25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7c2d12'; ctx.fillRect(x - 4, y - 13, 8, 13);
  ctx.fillStyle = dk > .35 && !asleep ? '#ffd970' : 'rgba(30,50,80,.5)'; for (const wx of [-17, -10, 6, 13]) ctx.fillRect(x + wx - 2, y - 20, 5, 6);
  flag(x + 26, y - 2, '#4c1d95', now, '#facc15');
  ctx.font = `600 10.5px ${FONT}`; ctx.textAlign = 'center';
  const t = "🏠 Boyd's Place", w = ctx.measureText(t).width + 10; ctx.fillStyle = 'rgba(76,29,149,.85)'; rr(x - w / 2, y + 6, w, 15, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 17);
}
function drawBubble(x, y, txt, border) {
  ctx.font = `600 11px ${FONT}`;
  let t2 = txt; while (ctx.measureText(t2).width > 220 && t2.length > 4) t2 = t2.slice(0, -2);
  if (t2 !== txt) t2 = t2.slice(0, -1) + '…';
  const w = ctx.measureText(t2).width + 16, h = 20, bx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
  ctx.fillStyle = 'rgba(255,251,235,.97)'; rr(bx - w / 2, y - h, w, h, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x + 4, y); ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 1.2; rr(bx - w / 2, y - h, w, h, 8); ctx.stroke();
  ctx.fillStyle = '#1c1917'; ctx.textAlign = 'center'; ctx.fillText(t2, bx, y - 6);
  return {x: bx, y, w};
}
function drawSparks(i) {
  const DUR = 30;
  sparks = sparks.filter(p => i - p.at < DUR && !(i - p.at > 12 && S.t > p.t + 2 * HOUR));
  for (const p of sparks) {
    if (i < p.at) continue;
    const k = (i - p.at) / DUR, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const a = p.from === 'boyd' ? {x: BOYD.home.x, y: BOYD.home.y - 30} : botPos(p.from), z = botPos(p.to);
    const mx = (a.x + z.x) / 2, my = Math.min(a.y, z.y) - 50 - Math.hypot(z.x - a.x, z.y - a.y) * 0.18;
    const q = (u) => ({x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * z.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * z.y});
    const col = p.boyd ? '196,181,253' : '125,211,252';
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < 14; s++) { const u = Math.max(0, e - s * 0.02); const pt = q(u); ctx.fillStyle = `rgba(${col},${(1 - s / 14) * 0.55 * (1 - k * 0.4)})`; ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.2 - s * 0.25, 0, 7); ctx.fill(); }
    const pt = q(e); const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 14); g.addColorStop(0, `rgba(255,255,255,.95)`); g.addColorStop(.35, `rgba(${col},.8)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, pt.y, 14, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (p.n > 1) { ctx.font = `700 10px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('×' + p.n, pt.x + 9, pt.y - 7); }
    if (k > 0.85) { const kk = (k - 0.85) / 0.15; ctx.strokeStyle = `rgba(${col},${1 - kk})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, 6 + kk * 18, 0, 7); ctx.stroke(); }
  }
}
function drawPings(i) {
  const fresh = (p, n) => i - p.at < n && !(i - p.at > 10 && S.t > p.t + 2 * HOUR);  // in fast stretches, effects end 2 sim-hours after the event
  pings = pings.filter(p => fresh(p, 40));
  for (const p of pings) {
    const k = (i - p.at) / 40; const c = p.boyd ? {x: BOYD.home.x, y: BOYD.home.y - 20} : {x: p.b.work.x, y: p.b.work.y - 30};
    ctx.strokeStyle = p.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y, 10 + k * 46, 0, 7); ctx.stroke();
    if (!p.boyd) { ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⏰', c.x, c.y - 44 - k * 14); }
    else { ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📱', c.x + 20, c.y - 22 - k * 12); }
    ctx.globalAlpha = 1;
  }
  pops = pops.filter(p => fresh(p, 34));
  for (const p of pops) { const k = Math.min(1, (i - p.at) / 34); ctx.globalAlpha = 1 - k * k; ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📄', p.b.work.x - 26 + Math.sin(k * 6) * 3, p.b.work.y - 40 - k * 34); ctx.globalAlpha = 1; }
}
function drawZs(now, dk) {
  for (const b of S.bots) if (tucked(b)) {
    const {x, y} = b.home;
    for (let i = 0; i < 3; i++) { const k = ((now / 2200 + i / 3 + b.phase) % 1); ctx.globalAlpha = (1 - k) * 0.95; ctx.fillStyle = '#e9d5ff'; ctx.font = `bold ${10 + k * 6}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('z', x + 12 + k * 12, y - 34 - k * 24); }
    ctx.globalAlpha = 1;
    if (dk > 0.45) { ctx.font = `600 9.5px ${FONT}`; const nm = shortName(b.name); const tw = ctx.measureText(nm).width + 8; ctx.fillStyle = 'rgba(46,16,101,.8)'; rr(x - tw / 2, y + 3, tw, 12, 6); ctx.fill(); ctx.fillStyle = '#ede9fe'; ctx.textAlign = 'center'; ctx.fillText(nm, x, y + 12); }
  }
}
function drawWorld(i, t, dk) {
  const now = i * 1000 / FPS;
  S.t = t;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#06101f'; ctx.fillRect(0, 0, VW, VH);
  ctx.setTransform(VIEW.s, 0, 0, VIEW.s, VIEW.ox, VIEW.oy);
  drawWater(now, dk);
  if (!terrain) buildTerrain();
  ctx.drawImage(terrain, 0, 0, W, H);
  const items = [];
  for (const tr of trees) items.push({y: tr.y, f: () => drawTree(tr, now)});
  for (const [k, b] of Object.entries(BUILDINGS)) {
    const busy = S.bots.some(o => o.building === k && o.state === 'work' && Math.hypot(o.x - (o.work.x + workOffset(o).x), o.y - (o.work.y + 34)) < 8);
    items.push({y: b.y, f: () => drawBuilding(k, b, now, dk > 0.35, busy)});
  }
  for (const b of S.bots) { items.push({y: b.home.y, f: () => drawHouse(b, now, dk)}); items.push({y: b.y + 8, f: () => drawBot(b, now)}); }
  items.push({y: BOYD.home.y, f: () => drawBoydHouse(now, dk, isNight(t))});
  items.sort((a, b) => a.y - b.y).forEach(o => o.f());
  drawClouds(now, dk);
  if (dk > 0) {
    ctx.fillStyle = `rgba(8,16,48,${dk * 0.55})`; ctx.fillRect(-400, -400, W + 800, H + 800);
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,210,120,${a})`); g.addColorStop(1, 'rgba(255,210,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
    for (const [k, b] of Object.entries(BUILDINGS)) { const busy = S.bots.some(o => o.building === k && o.state === 'work'); glow(b.x, b.y - 20, busy ? 70 : 34, (busy ? .35 : .12) * dk); }
    for (const b of S.bots) if (b.state !== 'sleep') glow(b.x, b.y, 16, .25 * dk);
    const L = BUILDINGS.lighthouse, a = now / 1400;
    ctx.fillStyle = `rgba(255,250,200,${0.18 * dk})`; ctx.beginPath(); ctx.moveTo(L.x, L.y - 82); ctx.arc(L.x, L.y - 82, 330, a - 0.12, a + 0.12); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const [k, b] of Object.entries(BUILDINGS)) drawSign(b, k);
  drawZs(now, dk);
  drawPings(i);
  drawSparks(i);
  // routine-name bubbles (only routine names are ever shown)
  const placed = [];
  for (const b of S.bots) if ((b.labelT >= S.t || (b.labelFrame >= i && S.t <= b.labelT + 2 * HOUR)) && b.state === 'work') {
    let y = b.y - 28; for (let s = 0; s < 5 && placed.some(p => Math.abs(p.x - b.x) < 120 && Math.abs(p.y - y) < 22); s++) y -= 23;
    placed.push({x: b.x, y}); drawBubble(b.x, y, '⏰ ' + b.label, '#f59e0b');
  }
}

// ---------- HUD (screen space) ----------
function pill(x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function fmtN(n) { return n.toLocaleString('en-US'); }
function fmtDur(ms) { const h = Math.round(ms / HOUR); const d = Math.floor(h / 24), hh = h % 24; return d ? `${d} day${d > 1 ? 's' : ''}${hh ? ` ${hh} h` : ''}` : `${hh} h`; }
function speedText() {
  const avg = speedHist.reduce((a, b) => a + b, 0) / Math.max(1, speedHist.length);  // sim ms per frame
  const perSec = avg * FPS;
  if (perSec >= DAY * 0.95) return `⏩ 1 s ≈ ${(perSec / DAY).toFixed(1)} days`;
  if (perSec >= HOUR) return `⏩ 1 s ≈ ${(perSec / HOUR).toFixed(perSec < 10 * HOUR ? 1 : 0)} h`;
  return `▶ 1 s ≈ ${Math.max(1, Math.round(perSec / MIN))} min`;
}
function drawHud(i, t, dk) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // date / time card
  pill(16, 14, 280, 92, 14, 'rgba(8,15,32,.80)');
  ctx.textAlign = 'left'; ctx.fillStyle = '#93c5fd'; ctx.font = `700 13px ${FONT}`; ctx.fillText('BOT ISLAND TIME-LAPSE', 30, 36);
  ctx.fillStyle = '#fff'; ctx.font = `800 21px ${FONT}`; ctx.fillText(dayLabel(t), 30, 62);
  ctx.font = `700 19px ${FONT}`; ctx.fillStyle = dk > 0.5 ? '#c4b5fd' : '#fde68a'; ctx.fillText(`${dk > 0.5 ? '🌙' : '☀️'} ${hm(t)} ET`, 30, 90);
  if (speedHist.length) { ctx.font = `600 12px ${FONT}`; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'right'; ctx.fillText(speedText(), 284, 36); }
  // counters card
  const cx = VW - 16 - 250, cy = 14;
  pill(cx, cy, 250, 30 + KINDS.length * 25, 14, 'rgba(8,15,32,.80)');
  ctx.textAlign = 'left'; ctx.fillStyle = '#93c5fd'; ctx.font = `700 13px ${FONT}`; ctx.fillText('RECORDED SO FAR', cx + 14, cy + 22);
  KINDS.forEach((k, j) => {
    const y = cy + 46 + j * 25;
    ctx.font = `14px sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(ICON[k], cx + 14, y);
    ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#cbd5e1'; ctx.fillText(LABEL[k], cx + 38, y);
    ctx.font = `800 16px ${FONT}`; ctx.fillStyle = KCOL[k]; ctx.textAlign = 'right'; ctx.fillText(fmtN(counts[k]), cx + 236, y + 1);
  });
  // routine log (bottom-left): time · bot · routine name
  if (runLog.length) {
    const lx = 16, ly = VH - 40 - runLog.length * 19 - 26;
    pill(lx, ly, 300, 24 + runLog.length * 19, 12, 'rgba(8,15,32,.72)');
    ctx.textAlign = 'left'; ctx.font = `700 11px ${FONT}`; ctx.fillStyle = '#fbbf24'; ctx.fillText('⏰ LATEST ROUTINE RUNS', lx + 12, ly + 17);
    runLog.forEach((r, j) => {
      const y = ly + 36 + j * 19; ctx.globalAlpha = 1 - j * 0.18;
      ctx.font = `600 11px ${FONT}`; ctx.fillStyle = '#94a3b8'; ctx.fillText(new Date(r.t).toLocaleDateString('en-US', {timeZone: TZ, month: 'short', day: 'numeric'}) + ' ' + hm(r.t), lx + 12, y);
      ctx.fillStyle = '#fff'; let s = `${shortName(r.bot)} · ${r.label}`; while (ctx.measureText(s).width > 180 && s.length > 4) s = s.slice(0, -2); if (s !== `${shortName(r.bot)} · ${r.label}`) s = s.slice(0, -1) + '…';
      ctx.fillText(s, lx + 106, y); ctx.globalAlpha = 1;
    });
  }
  // era note once the local logs end
  if (t > TL.logsEnd) {
    const msg = t < Date.parse('2026-10-04T04:00:00Z') ? 'Local logs end Sep 16 · from here, only daily output files are on record (times approx.)' : 'Oct 4–7 · output files on the restored box (real file times)';
    ctx.font = `600 12.5px ${FONT}`; const w = ctx.measureText(msg).width + 26; pill(VW / 2 - w / 2, 14, w, 26, 13, 'rgba(251,191,36,.92)'); ctx.fillStyle = '#1f1300'; ctx.textAlign = 'center'; ctx.fillText(msg, VW / 2, 31);
  }
  // jump banner
  if (jumpBanner && i - lastJump < 16) {
    const a = Math.min(1, (16 - (i - lastJump)) / 6);
    const msg = `⏩ Skipped ${fmtDur(jumpBanner.to - jumpBanner.from)} with no recorded events`;
    ctx.globalAlpha = a; ctx.font = `700 15px ${FONT}`; const w = ctx.measureText(msg).width + 30; pill(VW / 2 - w / 2, VH - 76, w, 32, 16, 'rgba(37,99,235,.94)'); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(msg, VW / 2, VH - 55); ctx.globalAlpha = 1;
  }
  // timeline bar
  const x0 = 340, x1 = VW - 340, by = VH - 22, T0 = SCH.T0, T1 = SCH.T1, X = (tt) => x0 + (x1 - x0) * (tt - T0) / (T1 - T0);
  pill(x0 - 12, by - 14, x1 - x0 + 24, 30, 12, 'rgba(8,15,32,.72)');
  ctx.fillStyle = 'rgba(148,163,184,.35)'; ctx.fillRect(x0, by - 2, x1 - x0, 4);
  for (const j of SCH.jumps) { ctx.fillStyle = 'rgba(96,165,250,.55)'; ctx.fillRect(X(j.from), by - 2, Math.max(1, X(j.to) - X(j.from)), 4); }
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(x0, by - 2, X(t) - x0, 4);
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'center';
  for (const [lab, iso] of [['Aug 24', '2026-08-24T04:00:00Z'], ['Sep 1', '2026-09-01T04:00:00Z'], ['Sep 8', '2026-09-08T04:00:00Z'], ['Sep 15', '2026-09-15T04:00:00Z'], ['Sep 22', '2026-09-22T04:00:00Z'], ['Oct 1', '2026-10-01T04:00:00Z']]) { const xx = X(Date.parse(iso)); ctx.fillRect(xx - 0.5, by - 5, 1, 3); ctx.fillText(lab, xx, by + 12); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(t), by, 5, 0, 7); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8'; ctx.fillText('Aug 20', x0 - 2, by - 6); ctx.textAlign = 'right'; ctx.fillText('Oct 7', x1 + 2, by - 6);
}

// ---------- title + end cards ----------
function card(alpha, lines) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(4,8,22,${0.62 * alpha})`; ctx.fillRect(0, 0, VW, VH);
  ctx.globalAlpha = alpha; ctx.textAlign = 'center';
  for (const l of lines) { ctx.font = l.f; ctx.fillStyle = l.c; ctx.fillText(l.t, VW / 2, l.y); }
  ctx.globalAlpha = 1;
}
const END_LABEL = {run: 'routine runs', msg: 'bot-to-bot messages', boyd: 'messages from Boyd', tool: 'tool events', output: 'output files'};
const fmtTotals = () => KINDS.map(k => `${ICON[k]} ${fmtN(counts[k])} ${END_LABEL[k]}`);
function renderFrame(i) {
  if (i !== lastI + 1) throw new Error(`frames must be rendered in order (got ${i} after ${lastI})`);
  lastI = i;
  let phase, t, dk, fresh = {run: 0, msg: 0, boyd: 0, tool: 0, output: 0};
  if (i < TF) {
    phase = 'title'; t = SCH.T0; dk = darkness(t);
    // bots settle at their opening positions during the title
    for (const b of S.bots) { const night = isNight(t); b.state = night ? 'sleep' : 'idle'; b.x = b.home.x; b.y = b.home.y + (night ? 4 : 24); }
    drawWorld(i, t, dk);
    const a = Math.min(1, i / 14), out = i > TF - 12 ? (TF - i) / 12 : 1;
    card(a * out, [
      {t: '🏝️', f: '64px sans-serif', c: '#fff', y: 268},
      {t: 'Bot Island, Aug–Oct 2026', f: `800 54px ${FONT}`, c: '#fff', y: 342},
      {t: "Every recorded routine run and message of Boyd's Grok Bot fleet, replayed", f: `600 21px ${FONT}`, c: '#bfdbfe', y: 386},
      {t: 'Aug 20 – Oct 7, 2026 · Eastern time · quiet stretches skipped and labelled', f: `500 16px ${FONT}`, c: '#94a3b8', y: 418},
    ]);
  } else if (i < TF + M) {
    phase = 'main'; const k = i - TF;
    const r = stepSim(i, k); t = r.t; fresh = r.fresh; dk = darknessAvg(r.tp, r.t);
    drawWorld(i, t, dk); drawHud(i, t, dk);
  } else {
    phase = 'end'; t = SCH.T1; dk = darkness(t);
    speedHist = [];
    stepSim(i, M - 1 >= 0 ? M - 1 : 0); // no new events remain; bots keep walking home
    drawWorld(i, t, dk); drawHud(i, t, dk);
    const e = i - TF - M, a = Math.min(1, e / 14);
    const tot = fmtTotals();
    card(a, [
      {t: 'Bot Island, Aug 20 – Oct 7, 2026', f: `800 40px ${FONT}`, c: '#fff', y: 222},
      {t: `${S.bots.length} bots · ${SCH.jumps.length} quiet stretches skipped · every count straight from the records`, f: `500 16px ${FONT}`, c: '#94a3b8', y: 256},
      {t: tot[0] + '   ·   ' + tot[1] + '   ·   ' + tot[2], f: `700 20px ${FONT}`, c: '#e2e8f0', y: 318},
      {t: tot[3] + '   ·   ' + tot[4], f: `700 20px ${FONT}`, c: '#e2e8f0', y: 352},
      {t: 'Built by TokenMax on Oct 7', f: `800 44px ${FONT}`, c: '#f0abfc', y: 448},
      {t: '🚀 using Grok Bot usage that would otherwise have reset unused', f: `500 17px ${FONT}`, c: '#cbd5e1', y: 486},
    ]);
  }
  return {i, phase, t, dk: +dk.toFixed(3), counts: Object.assign({}, counts), fresh, jump: (phase === 'main' && FR[i - TF].jump !== undefined) ? FR[i - TF].jump : null};
}
window.renderFrame = renderFrame; window.TOTAL_FRAMES = TOTAL_FRAMES;
