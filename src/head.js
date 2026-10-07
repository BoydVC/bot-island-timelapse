'use strict';
/* Shared globals + shims the copied Bot Island drawing code (art.js) expects. */
const TZ = 'America/New_York';
const W = 1200, H = 760, VW = 1280, VH = 720;
const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
const fmtParts = new Intl.DateTimeFormat('en-US', {timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'});
function etParts(ms) {
  const o = {};
  for (const p of fmtParts.formatToParts(new Date(ms))) o[p.type] = p.value;
  const wd = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6}[o.weekday];
  return {y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd};
}
function hm(ms) { const p = etParts(ms); const h12 = (p.h % 12) || 12; return `${h12}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`; }
function dayLabel(ms) { return new Date(ms).toLocaleDateString('en-US', {timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'}); }
const BUILDINGS = {}; for (const [k, b] of Object.entries(TL.buildings)) BUILDINGS[k] = b;
const PLAZA = {x: 600, y: 420};
const S = {data: {eggs: TL.eggs || [], tokenFuel: null}, bots: [], game: null, launchAt: null, t: TL.schedule.T0};
const cv = document.getElementById('cv'); let ctx = cv.getContext('2d');
let terrain = null, trees = [], stars = [];
