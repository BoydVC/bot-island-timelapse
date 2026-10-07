/* Time-lapse copy of ../bot-island-arcade/src/art.js (fuel gauge removed). Drawing code originally copied verbatim (read-only reuse) from ../bot-island/web/app.js (Bot Island 2D):
   rng/islandRadius/ISLE/islePoint (lines 78-81), buildTerrain (269-308), darkness..botShape (310-534). Not modified there. */
function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function islandRadius(a) { return 1 + 0.06 * Math.sin(a * 3 + 0.7) + 0.045 * Math.sin(a * 5 + 2.1) + 0.03 * Math.sin(a * 9 + 1.3); }
const ISLE = {cx: 600, cy: 395, rx: 545, ry: 330};
function islePoint(a, k) { const r = islandRadius(a) * k; return {x: ISLE.cx + Math.cos(a) * ISLE.rx * r, y: ISLE.cy + Math.sin(a) * ISLE.ry * r}; }
function buildTerrain() {
  const c = document.createElement('canvas'); c.width = W * 3; c.height = H * 3;
  const g = c.getContext('2d'); g.scale(3, 3);
  const blob = (k) => { g.beginPath(); for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; const p = islePoint(a, k); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.closePath(); };
  // shallow water halo
  blob(1.08); g.fillStyle = 'rgba(94,234,212,.18)'; g.fill();
  blob(1.04); g.fillStyle = 'rgba(94,234,212,.25)'; g.fill();
  // sand
  blob(1.0); const sg = g.createRadialGradient(600, 395, 200, 600, 395, 600); sg.addColorStop(0, '#f6e7b8'); sg.addColorStop(1, '#e9d08f'); g.fillStyle = sg; g.fill();
  // grass
  blob(0.925); const gg = g.createRadialGradient(560, 340, 40, 600, 395, 560); gg.addColorStop(0, '#7ccf6a'); gg.addColorStop(.7, '#5fb257'); gg.addColorStop(1, '#4c9a49'); g.fillStyle = gg; g.fill();
  g.save(); blob(0.925); g.clip();
  const r = rng('grass');
  for (let i = 0; i < 2600; i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,60,0,.07)'; g.fillRect(x, y, 2, 2); }
  for (let i = 0; i < 18; i++) { const x = 150 + r() * 900, y = 120 + r() * 520; g.fillStyle = 'rgba(30,90,30,.10)'; g.beginPath(); g.ellipse(x, y, 30 + r() * 60, 14 + r() * 30, r() * 3, 0, 7); g.fill(); }
  // paths
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pathTo = (b) => { g.beginPath(); g.moveTo(PLAZA.x, PLAZA.y); const mx = (PLAZA.x + b.x) / 2 + (b.y - PLAZA.y) * 0.12, my = (PLAZA.y + b.y) / 2 - (b.x - PLAZA.x) * 0.12; g.quadraticCurveTo(mx, my, b.x, b.y + 22); g.stroke(); };
  for (const pass of [[16, '#c9ad73'], [11, '#e4cf98']]) { g.lineWidth = pass[0]; g.strokeStyle = pass[1]; for (const [k, b] of Object.entries(BUILDINGS)) if (k !== 'commons') pathTo(b); }
  // ring road to houses
  for (const pass of [[9, '#c9ad73'], [5, '#e4cf98']]) { g.lineWidth = pass[0]; g.strokeStyle = pass[1]; g.beginPath(); for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; const p = islePoint(a, 0.8); const q = {x: p.x, y: p.y + 24}; i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); } g.stroke(); }
  // plaza
  g.fillStyle = '#d9c28a'; g.beginPath(); g.ellipse(PLAZA.x, PLAZA.y + 8, 86, 48, 0, 0, 7); g.fill();
  g.fillStyle = '#e8d6a6'; g.beginPath(); g.ellipse(PLAZA.x, PLAZA.y + 8, 78, 42, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(160,130,80,.35)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(PLAZA.x, PLAZA.y + 8, 78 - k * 16, 42 - k * 9, 0, 0, 7); g.stroke(); }
  g.restore();
  terrain = c;
  // trees
  trees = []; const tr = rng('trees');
  const blockers = () => [...Object.values(BUILDINGS).map(b => ({x: b.x, y: b.y, r: b === BUILDINGS.stadium ? 90 : 62})), ...S.bots.map(b => ({x: b.home.x, y: b.home.y, r: 40})), {x: PLAZA.x, y: PLAZA.y, r: 100}];
  const bl = blockers();
  for (let i = 0; i < 900 && trees.length < 95; i++) {
    const a = tr() * Math.PI * 2, k = Math.sqrt(tr()) * 0.95;
    const p = islePoint(a, k);
    if (bl.some(o => Math.hypot(o.x - p.x, (o.y - p.y) * 1.3) < o.r)) continue;
    if (trees.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 22)) continue;
    trees.push({x: p.x, y: p.y, s: 0.75 + tr() * 0.6, palm: k > 0.86, hue: tr()});
  }
  stars = []; const st = rng('stars'); for (let i = 0; i < 220; i++) stars.push({x: st() * W, y: st() * H, r: st() * 1.3 + .3, tw: st() * 6});
}

function darkness(t) {
  const p = etParts(t); const h = p.h + p.mi / 60;
  const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  return Math.max(1 - sm(6.4, 7.6, h), sm(18.3, 19.6, h));
}

function drawWater(now, dk) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#1e6fb8', '#071233', dk)); g.addColorStop(1, mix('#0e4f8f', '#040b22', dk));
  ctx.fillStyle = g; ctx.fillRect(-400, -400, W + 800, H + 800);
  if (dk > 0.3) for (const s of stars) { ctx.globalAlpha = (dk - .3) * (0.5 + 0.5 * Math.sin(now / 700 + s.tw)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `rgba(255,255,255,${0.16 - dk * 0.08})`; ctx.lineWidth = 1.4;
  for (let ring = 0; ring < 3; ring++) {
    const k = 1.1 + ring * 0.07 + 0.012 * Math.sin(now / 900 + ring * 2);
    ctx.setLineDash([14, 22]); ctx.lineDashOffset = -now / 60 * (ring % 2 ? 1 : -1);
    ctx.beginPath(); for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2; const p = islePoint(a, k); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
  }
  ctx.setLineDash([]);
}
function mix(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; }
function shade(hex, k) { const p = parseInt(hex.slice(1), 16); const f = (s) => Math.max(0, Math.min(255, Math.round(((p >> s) & 255) * k))); return `rgb(${f(16)},${f(8)},${f(0)})`; }

function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function shadow(x, y, w, h) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, 7); ctx.fill(); }
function box(x, y, w, h, wall, roof, roofH = 14) {
  shadow(x, y + 2, w * 0.62, 9);
  ctx.fillStyle = wall; rr(x - w / 2, y - h, w, h, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + w / 2 - 6, y - h + 2, 6, h - 2);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w / 2 - 5, y - h + 1); ctx.lineTo(x, y - h - roofH); ctx.lineTo(x + w / 2 + 5, y - h + 1); ctx.closePath(); ctx.fill();
}
function windows(x, y, w, h, rows, cols, lit, seed) {
  const r = rng(seed);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const wx = x - w / 2 + (j + 0.5) * (w / cols) - 3, wy = y - h + 6 + i * ((h - 10) / rows);
    ctx.fillStyle = lit && r() > 0.25 ? '#ffd970' : 'rgba(30,50,80,.55)'; ctx.fillRect(wx, wy, 6, 6);
  }
}
function flag(x, y, color, now, c2) {
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 22); ctx.stroke();
  const wv = Math.sin(now / 300 + x) * 2;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.quadraticCurveTo(x + 7, y - 24 + wv, x + 14, y - 20 + wv); ctx.lineTo(x + 14, y - 13 + wv); ctx.quadraticCurveTo(x + 7, y - 17 + wv, x, y - 14); ctx.fill();
  if (c2) { ctx.fillStyle = c2; ctx.fillRect(x + 1, y - 19 + wv / 2, 12, 2); }
}

function drawBuilding(key, b, now, lit, busy) {
  const {x, y} = b;
  ctx.save();
  switch (key) {
    case 'hq':
      shadow(x, y + 3, 44, 11);
      ctx.fillStyle = '#e5e7eb'; rr(x - 28, y - 70, 56, 70, 3); ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x + 20, y - 68, 8, 68);
      windows(x, y, 56, 70, 5, 4, lit, 'hq');
      ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(x - 32, y - 70); ctx.lineTo(x, y - 90); ctx.lineTo(x + 32, y - 70); ctx.fill();
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y - 78, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#7c2d12'; rr(x - 7, y - 16, 14, 16, 2); ctx.fill();
      flag(x - 20, y - 70, '#f97316', now, '#111'); flag(x + 8, y - 72, '#4c1d95', now, '#facc15');
      break;
    case 'library':
      box(x, y, 78, 40, '#f1e4c8', '#1d4ed8', 16);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - 33 + i * 15, y - 36, 5, 34); }
      windows(x, y, 78, 40, 1, 4, lit, 'lib');
      break;
    case 'observatory':
      box(x, y, 46, 30, '#e2e8f0', '#e2e8f0', 0);
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(x, y - 30, 23, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#334155'; ctx.save(); ctx.translate(x, y - 34); ctx.rotate(-0.6 + Math.sin(now / 4000) * 0.3); ctx.fillRect(-3, -26, 7, 22); ctx.restore();
      windows(x, y, 46, 30, 1, 2, lit, 'obs');
      break;
    case 'bank':
      box(x, y, 74, 42, '#f8fafc', '#15803d', 18);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x - 28 + i * 18, y - 38, 6, 36); }
      ctx.fillStyle = '#fde047'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', x, y - 46);
      break;
    case 'clubhouse':
      box(x, y, 64, 36, '#fde68a', '#0e7490', 20);
      ctx.fillStyle = '#7c2d12'; ctx.fillRect(x + 14, y - 62, 8, 14);
      if (lit) smoke(x + 18, y - 64, now, '#ddd', 3);
      windows(x, y, 64, 36, 1, 3, lit, 'club');
      flag(x - 30, y - 36, '#1d4ed8', now, '#fff');
      break;
    case 'school':
      box(x, y, 70, 38, '#dc2626', '#7f1d1d', 16);
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(x - 6, y - 70, 12, 16); ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.moveTo(x - 9, y - 70); ctx.lineTo(x, y - 80); ctx.lineTo(x + 9, y - 70); ctx.fill();
      ctx.fillStyle = '#ca8a04'; ctx.beginPath(); ctx.arc(x, y - 62, 3, 0, 7); ctx.fill();
      windows(x, y, 70, 38, 1, 4, lit, 'sch');
      break;
    case 'press':
      box(x, y, 72, 38, '#b45309', '#44403c', 10);
      ctx.fillStyle = '#57534e'; ctx.fillRect(x + 18, y - 66, 10, 22);
      if (busy) smoke(x + 23, y - 68, now, '#cbd5e1', 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 30, y - 30, 24, 16); ctx.fillStyle = '#111'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 28, y - 27 + i * 3.5, 20 - (i % 2) * 6, 1.4);
      windows(x + 12, y, 36, 38, 1, 2, lit, 'pr');
      break;
    case 'radio': {
      shadow(x, y + 2, 24, 7);
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x, y - 88); ctx.lineTo(x + 16, y); ctx.stroke();
      for (let i = 1; i < 6; i++) { const yy = y - i * 15, w = 16 * (1 - i * 15 / 88); ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      ctx.fillStyle = (Math.floor(now / 600) % 2) ? '#ff3b3b' : '#7f1d1d'; ctx.beginPath(); ctx.arc(x, y - 90, 3.5, 0, 7); ctx.fill();
      if (busy) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 3; k++) { const rr2 = ((now / 18 + k * 20) % 60); ctx.globalAlpha = 1 - rr2 / 60; ctx.beginPath(); ctx.arc(x, y - 90, rr2, -2.4, -0.7); ctx.stroke(); } ctx.globalAlpha = 1; }
      box(x + 26, y, 26, 18, '#f1f5f9', '#ef4444', 8);
      break; }
    case 'postoffice':
      box(x, y, 54, 30, '#dbeafe', '#1e40af', 12);
      ctx.fillStyle = '#1e40af'; rr(x - 22, y - 14, 10, 14, 3); ctx.fill();
      windows(x + 8, y, 30, 30, 1, 2, lit, 'po');
      break;
    case 'workshop':
      box(x, y, 62, 34, '#a8a29e', '#facc15', 12);
      ctx.save(); ctx.translate(x + 18, y - 54); ctx.rotate(now / (busy ? 300 : 2000)); ctx.fillStyle = '#57534e';
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -10, 4, 5); } ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#1c1917'; ctx.fillRect(x - 22, y - 22, 20, 22);
      if (busy && Math.floor(now / 120) % 3 === 0) { ctx.fillStyle = '#fde047'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + Math.random() * 8, y - 14 + Math.random() * 8, 2, 2); }
      break;
    case 'hatchery': {
      shadow(x, y + 2, 34, 9);
      ctx.fillStyle = 'rgba(186,230,253,.55)'; ctx.beginPath(); ctx.arc(x, y - 4, 32, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#e0f2fe'; ctx.fillRect(x - 34, y - 6, 68, 8);
      const eggs = 1 + (S.data?.eggs?.length || 0) + 2;
      for (let i = 0; i < eggs; i++) { const ex = x - 18 + i * (36 / Math.max(1, eggs - 1)), wob = busy ? Math.sin(now / 120 + i) * 0.25 : Math.sin(now / 900 + i) * 0.05; ctx.save(); ctx.translate(ex, y - 12); ctx.rotate(wob); ctx.fillStyle = ['#fef3c7', '#fde68a', '#fbcfe8', '#ddd6fe'][i % 4]; ctx.beginPath(); ctx.ellipse(0, 0, 6, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(-4, 1, 8, 1.5); ctx.restore(); }
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(x - 14, y - 26, 6, 3, -0.6, 0, 7); ctx.fill();
      break; }
    case 'lighthouse': {
      shadow(x, y + 2, 18, 6);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#dc2626'; const w0 = 13 - i * 1.2; ctx.fillRect(x - w0, y - (i + 1) * 15, w0 * 2, 15.5); }
      ctx.fillStyle = '#fef08a'; ctx.fillRect(x - 8, y - 88, 16, 12); ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.moveTo(x - 11, y - 88); ctx.lineTo(x, y - 98); ctx.lineTo(x + 11, y - 88); ctx.fill();
      break; }
    case 'launchpad': drawRocket(x, y, now, busy); break;
    case 'stadium': {
      shadow(x, y + 4, 78, 18);
      ctx.fillStyle = '#4c1d95'; ctx.beginPath(); ctx.ellipse(x, y - 8, 74, 36, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6d28d9'; ctx.beginPath(); ctx.ellipse(x, y - 12, 66, 30, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(x, y - 12, 50, 20, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * 10, y - 28); ctx.lineTo(x + i * 10, y + 4); ctx.stroke(); }
      ctx.fillStyle = '#facc15'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BAL', x - 38, y - 9); ctx.fillText('BAL', x + 38, y - 9);
      flag(x - 60, y - 34, '#4c1d95', now, '#facc15'); flag(x + 50, y - 34, '#f97316', now, '#111'); flag(x - 10, y - 46, '#034694', now, '#fff'); flag(x + 18, y - 46, '#e21833', now, '#ffd200');
      if (S.game) { ctx.fillStyle = '#0f172a'; rr(x - 46, y - 74, 92, 18, 3); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.font = 'bold 9px ui-monospace,monospace'; ctx.fillText(S.game.label.slice(0, 22), x, y - 62); for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; ctx.fillStyle = S.game.colors[i % 2]; ctx.fillRect(x + Math.cos(a) * 70 - 1, y - 8 + Math.sin(a) * 33 - 1 - (Math.floor(now / 200 + i) % 5 === 0 ? 2 : 0), 3, 3); } }
      if (darkness(S.t) > .4 || S.game) { ctx.fillStyle = 'rgba(255,255,220,.9)'; for (const s of [-1, 1]) { ctx.fillRect(x + s * 70 - 2, y - 52, 4, 30); ctx.fillRect(x + s * 70 - 6, y - 56, 12, 5); } }
      break; }
    case 'commons': {
      ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.ellipse(x, y + 8, 22, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.ellipse(x, y + 7, 18, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x - 3, y - 14, 6, 20);
      for (let i = 0; i < 10; i++) { const k = ((now / 600 + i / 10) % 1); const a = i / 10 * Math.PI * 2; ctx.fillStyle = `rgba(186,230,253,${1 - k})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * k * 14, y - 16 + k * k * 22 - k * 10 + Math.sin(a) * k * 4, 1.6, 0, 7); ctx.fill(); }
      break; }
  }
  ctx.restore();
}
function smoke(x, y, now, col, n) {
  for (let i = 0; i < n; i++) { const k = ((now / 1600 + i / n) % 1); ctx.fillStyle = col; ctx.globalAlpha = (1 - k) * 0.55; ctx.beginPath(); ctx.arc(x + Math.sin(k * 6 + i) * 4 + k * 8, y - k * 30, 3 + k * 6, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function fuelLeft() { const f = S.data?.tokenFuel; return f ? Math.round(Math.max(0, 100 - (f.usedPct || 0))) : 0; }
function drawRocket(x, y, now, busy) {
  shadow(x, y + 4, 46, 12);
  ctx.fillStyle = '#6b7280'; rr(x - 42, y - 10, 84, 14, 4); ctx.fill();
  ctx.fillStyle = '#9ca3af'; rr(x - 38, y - 12, 76, 6, 3); ctx.fill();
  // tower
  ctx.strokeStyle = '#374151'; ctx.lineWidth = 2; ctx.strokeRect(x + 20, y - 100, 10, 90);
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x + 20, y - 10 - i * 10); ctx.lineTo(x + 30, y - 20 - i * 10); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x + 20, y - 82); ctx.lineTo(x + 8, y - 82); ctx.stroke();
  // rocket body (stainless, Starship-ish)
  const lift = S.launchAt ? Math.min(400, Math.pow((performance.now() - S.launchAt) / 1000, 2) * 40) : 0;
  const ry = y - 12 - lift;
  const bg = ctx.createLinearGradient(x - 9, 0, x + 9, 0); bg.addColorStop(0, '#9ca3af'); bg.addColorStop(.45, '#f3f4f6'); bg.addColorStop(1, '#6b7280');
  ctx.fillStyle = bg; rr(x - 9, ry - 92, 18, 92, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 9, ry - 90); ctx.quadraticCurveTo(x - 9, ry - 116, x, ry - 122); ctx.quadraticCurveTo(x + 9, ry - 116, x + 9, ry - 90); ctx.fill();
  ctx.fillStyle = '#4b5563'; ctx.beginPath(); ctx.moveTo(x - 9, ry - 100); ctx.lineTo(x - 15, ry - 92); ctx.lineTo(x - 9, ry - 88); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 9, ry - 100); ctx.lineTo(x + 15, ry - 92); ctx.lineTo(x + 9, ry - 88); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 9, ry - 14); ctx.lineTo(x - 16, ry); ctx.lineTo(x - 9, ry); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 9, ry - 14); ctx.lineTo(x + 16, ry); ctx.lineTo(x + 9, ry); ctx.fill();
  ctx.fillStyle = '#111827'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.save(); ctx.translate(x + 2, ry - 46); ctx.rotate(-Math.PI / 2); ctx.fillText('TOKENMAX', 0, 0); ctx.restore();
  // (fuel gauge removed in the time-lapse copy: today's usage number would be wrong for a historical replay)
  if (busy || lift) { for (let i = 0; i < 9; i++) { const k = ((now / 400 + i / 9) % 1); ctx.fillStyle = `rgba(${255},${150 + k * 100},${60},${(1 - k) * 0.8})`; ctx.beginPath(); ctx.arc(x + (Math.random() - .5) * 6, ry + 4 + k * (lift ? 50 : 10), 3 + k * (lift ? 12 : 4), 0, 7); ctx.fill(); } }
}

function drawTree(tr, now) {
  const {x, y, s} = tr;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 9 * s, 4 * s, 0, 0, 7); ctx.fill();
  if (tr.palm) {
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * s, y - 12 * s, x + 2 * s, y - 24 * s); ctx.stroke();
    const sw = Math.sin(now / 1200 + x) * 0.08;
    ctx.fillStyle = '#16a34a'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(x + 2 * s, y - 24 * s); ctx.rotate(i / 5 * Math.PI * 2 + sw); ctx.beginPath(); ctx.ellipse(8 * s, 0, 9 * s, 2.6 * s, 0.3, 0, 7); ctx.fill(); ctx.restore(); }
  } else {
    ctx.fillStyle = '#78350f'; ctx.fillRect(x - 1.5 * s, y - 8 * s, 3 * s, 8 * s);
    ctx.fillStyle = tr.hue < .5 ? '#15803d' : '#166534'; ctx.beginPath(); ctx.arc(x, y - 14 * s, 9 * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x - 3 * s, y - 17 * s, 4 * s, 0, 7); ctx.fill();
  }
}

function drawHouse(b, now, dk) {
  const {x, y} = b.home; const home = b.state === 'sleep';
  shadow(x, y + 2, 20, 6);
  ctx.fillStyle = '#fffbeb'; rr(x - 15, y - 20, 30, 20, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + 9, y - 19, 6, 19);
  ctx.fillStyle = shade(b.hex, 0.9); ctx.beginPath(); ctx.moveTo(x - 19, y - 19); ctx.lineTo(x, y - 34); ctx.lineTo(x + 19, y - 19); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7c2d12'; ctx.fillRect(x - 3, y - 10, 6, 10);
  const lit = dk > 0.35 && !home && b.state !== 'sleep';
  ctx.fillStyle = home ? 'rgba(30,40,70,.85)' : (dk > 0.35 ? '#ffd970' : 'rgba(30,50,80,.5)'); ctx.fillRect(x - 12, y - 16, 6, 5); ctx.fillRect(x + 6, y - 16, 6, 5);
  void lit;
  ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.emoji, x, y - 22);
  if (etParts(S.t).mo === 10) { ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.ellipse(x + 13, y - 1, 4, 3.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#166534'; ctx.fillRect(x + 12.5, y - 5.5, 1.5, 2.5); if (dk > .4) { ctx.fillStyle = '#fde047'; ctx.fillRect(x + 11.5, y - 2, 1, 1); ctx.fillRect(x + 14, y - 2, 1, 1); } }

}

function botShape(shape, r) {
  ctx.beginPath();
  switch (shape) {
    case 'hex': for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); break;
    case 'squircle': case 'tablet': ctx.roundRect(-r, -r * (shape === 'tablet' ? 1.15 : 1), r * 2, r * (shape === 'tablet' ? 2.3 : 2), r * 0.55); break;
    case 'teardrop': ctx.moveTo(0, -r * 1.35); ctx.quadraticCurveTo(r * 1.15, -r * 0.2, r, r * 0.25); ctx.arc(0, r * 0.25, r, 0, Math.PI); ctx.quadraticCurveTo(-r * 1.15, -r * 0.2, 0, -r * 1.35); break;
    case 'wedge': ctx.moveTo(-r, r); ctx.lineTo(r, r); ctx.lineTo(r * 0.6, -r); ctx.lineTo(-r * 0.6, -r); ctx.closePath(); break;
    case 'cloud': ctx.arc(-r * .45, r * .1, r * .7, 0, 7); ctx.arc(r * .45, r * .1, r * .7, 0, 7); ctx.arc(0, -r * .35, r * .75, 0, 7); break;
    case 'sparkle': for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr2 = i % 2 ? r * 0.72 : r * 1.12; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); break;
    case 'pebble': ctx.ellipse(0, 0, r * 1.15, r * 0.9, 0.2, 0, 7); break;
    case 'blob': for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr2 = r * (1 + 0.12 * Math.sin(a * 3)); ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); break;
    default: ctx.arc(0, 0, r, 0, 7);
  }
}
