// @ts-check
/** Dessin : sable ombré, pierres peintes, particules (pétales, feuilles, lucioles), lumière et curseur. */
import { TAU, C, SP, MOODS, KINDS, clamp, rng } from './config.js';
import { G, allocate, stoneAt } from './garden.js';
import { save } from './save.js';
import { art } from './art.js';

export const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('g'));
export const ctx = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
/** Résolution de l'écran (plafonnée à 2). */
export const view = { dpr: 1 };
/** @type {Float32Array} */ let grain = new Float32Array(0);
/** @type {HTMLCanvasElement} */ let sand;
/** @type {CanvasRenderingContext2D} */ let sctx;
/** @type {ImageData} */ let img;
const mood = () => MOODS[save.mood];

/** Adapte le jardin à la fenêtre. */
export function resize() {
  const nvw = innerWidth, nvh = innerHeight; view.dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(nvw * view.dpr); cv.height = Math.round(nvh * view.dpr);
  if (!allocate(nvw, nvh)) return;
  const { W, H } = G;
  grain = new Float32Array(W * H); const r = rng(7); for (let i = 0; i < grain.length; i++) grain[i] = r() - .5;
  sand = document.createElement('canvas'); sand.width = W; sand.height = H;
  sctx = /** @type {CanvasRenderingContext2D} */ (sand.getContext('2d')); img = sctx.createImageData(W, H);
}

/** Ombre le sable d'après la pente du champ de hauteur. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
function shade(x0, y0, x1, y1) {
  const m = mood(), d = img.data, sh = m.sh, mi = m.mid, li = m.li, { W, H, hm } = G;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    const nx = hm[x > 0 ? i - 1 : i] - hm[x < W - 1 ? i + 1 : i], ny = hm[y > 0 ? i - W : i] - hm[y < H - 1 ? i + W : i];
    const t = clamp(.56 + (nx * -.62 + ny * -.74) * .2 + hm[i] * .05 + grain[i] * .09, 0, 1);
    let a, b, u; if (t < .5) { a = sh; b = mi; u = t * 2; } else { a = mi; b = li; u = (t - .5) * 2; }
    const o = i * 4; d[o] = a[0] + (b[0] - a[0]) * u; d[o + 1] = a[1] + (b[1] - a[1]) * u; d[o + 2] = a[2] + (b[2] - a[2]) * u; d[o + 3] = 255;
  }
  sctx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

/** Peint une pierre (une fois, dans sa propre image). @param {import('./garden.js').Stone} s */
export function renderStone(s) {
  const dpr = view.dpr, m = mood(), k = KINDS[s.kind], R = s.r * s.e * 1.15, pad = s.r * .9 + 10, half = R + pad, size = Math.ceil(half * 2 * dpr);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')); g.scale(dpr, dpr); g.translate(half, half);
  const p = new Path2D(), P = s.pts, n = P.length;
  p.moveTo((P[0][0] + P[n - 1][0]) / 2, (P[0][1] + P[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  g.save(); g.shadowColor = 'rgba(25,12,0,.55)'; g.shadowBlur = s.r * .55 * dpr; g.shadowOffsetX = s.r * .22 * dpr; g.shadowOffsetY = s.r * .3 * dpr; g.fillStyle = k[0]; g.fill(p); g.restore();
  g.save(); g.clip(p);
  const gr = g.createRadialGradient(-s.r * .4, -s.r * .45, s.r * .05, 0, 0, R * 1.05); gr.addColorStop(0, k[1]); gr.addColorStop(.5, k[0]); gr.addColorStop(1, k[2]);
  const r = rng(s.seed), tex = art('pierre_' + (s.kind + 1));
  if (tex) {
    // pierre peinte : sa texture, tournée au hasard, puis le modelé (lumière en haut à gauche) par-dessus
    g.save(); g.rotate(r() * TAU); g.drawImage(tex, -R * 1.1, -R * 1.1, R * 2.2, R * 2.2); g.restore();
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(-half, -half, half * 2, half * 2);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  } else { g.fillStyle = gr; g.fillRect(-half, -half, half * 2, half * 2); }
  if (!tex) for (let i = 0; i < s.r * 9; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.16)'; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r() * 1.3 + .3, 0, TAU); g.fill(); }
  for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = .8; g.beginPath(); const a = r() * TAU; g.moveTo(Math.cos(a) * R, Math.sin(a) * R); g.quadraticCurveTo(r() * s.r - s.r / 2, r() * s.r - s.r / 2, -Math.cos(a) * R, -Math.sin(a) * R); g.stroke(); }
  if (s.moss) {
    for (let i = 0; i < 7; i++) {
      const mx = -s.r * .35 + (r() - .5) * s.r * .9, my = -s.r * .4 + (r() - .5) * s.r * .7, mr = s.r * (.18 + r() * .28);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr); mg.addColorStop(0, `rgba(${96 + r() * 30 | 0},${128 + r() * 30 | 0},${58 + r() * 20 | 0},.85)`); mg.addColorStop(1, 'rgba(80,110,50,0)'); g.fillStyle = mg; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${150 + r() * 50 | 0},${180 + r() * 40 | 0},90,.35)`; const a = r() * TAU, d = r() * s.r * .5; g.fillRect(-s.r * .35 + Math.cos(a) * d, -s.r * .4 + Math.sin(a) * d, 1, 1); }
  }
  const lg = g.createLinearGradient(-R, -R, R, R); lg.addColorStop(0, 'rgba(255,255,255,.28)'); lg.addColorStop(.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.lineWidth = s.r * .22; g.strokeStyle = lg; g.stroke(p);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = m.tint; g.fillRect(-half, -half, half * 2, half * 2);
  g.restore(); s.cv = c; s.half = half;
}

/* ---------- particules ---------- */
/** @typedef {{k:string,x:number,y:number,z:number,rot:number,vr:number,ph:number,vx:number,vy:number,a:number,c:string}} Part */
/** @type {Part[]} */
let parts = [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** @param {any} p @param {boolean} init @returns {Part} */
function spawn(p, init) {
  const { vw, vh } = G;
  p.k = mood().part; p.z = .55 + Math.random() * .75; p.rot = Math.random() * TAU; p.vr = (Math.random() - .5) * .04; p.ph = Math.random() * TAU; p.vx = 0; p.vy = 0;
  if (p.k === 'fly') { p.x = Math.random() * vw; p.y = Math.random() * vh; p.a = Math.random() * TAU; }
  else { p.x = init ? Math.random() * vw : -20 - Math.random() * vw * .3; p.y = init ? Math.random() * vh : Math.random() * vh * .7 - 30; }
  const pal = p.k === 'leaf' ? ['#d9542b', '#e88a2e', '#b8322a', '#f0b040'] : ['#ffd3dc', '#f6b5c4', '#fde6ea', '#eea2b6']; p.c = pal[Math.random() * pal.length | 0]; return p;
}
export function resetParts() { const k = mood().part, n = reduce ? 8 : (k === 'fly' ? 34 : k === 'leaf' ? 16 : 24); parts = []; for (let i = 0; i < n; i++) parts.push(spawn({}, true)); }
/** Garde les particules dans l'écran après un redimensionnement. */
export function clampParts() { for (const p of parts) { p.x = Math.min(p.x, G.vw); p.y = Math.min(p.y, G.vh); } }
/** @param {number} dt */
export function stepParts(dt) {
  const { vw, vh } = G;
  for (const p of parts) {
    if (p.k === 'fly') { p.a += (Math.random() - .5) * .25; p.x += Math.cos(p.a) * .35 * dt + p.vx; p.y += Math.sin(p.a) * .35 * dt + p.vy; if (p.x < -10) p.x = vw + 10; if (p.x > vw + 10) p.x = -10; if (p.y < -10) p.y = vh + 10; if (p.y > vh + 10) p.y = -10; }
    else { p.ph += .014 * dt; p.x += ((Math.sin(p.ph) * .5 + .45) * p.z) * dt + p.vx; p.y += ((.22 + .3 * p.z) + Math.cos(p.ph * 1.3) * .15) * dt + p.vy; p.rot += p.vr * dt; if (p.y > vh + 30 || p.x > vw + 30) spawn(p, false); }
    p.vx *= .94; p.vy *= .94;
  }
}
/** Le râteau pousse les pétales. @param {number} x @param {number} y @param {number} vx @param {number} vy */
export function pushParts(x, y, vx, vy) { for (const p of parts) { const d = Math.hypot(p.x - x, p.y - y); if (d < 46) { const f = (1 - d / 46) * .35; p.vx += vx * f; p.vy += vy * f; p.vr += (Math.random() - .5) * .02; } } }
/** @param {Part} p */
function petal(p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); const s = p.z * (p.k === 'leaf' ? 1.25 : 1); ctx.scale(s, s * (.75 + .25 * Math.sin(p.ph * 2)));
  const path = new Path2D();
  if (p.k === 'leaf') { path.moveTo(0, -8); path.bezierCurveTo(5, -5, 5, 4, 0, 8); path.bezierCurveTo(-5, 4, -5, -5, 0, -8); }
  else { path.moveTo(0, -5.4); path.lineTo(1.6, -7); path.bezierCurveTo(5.5, -5, 5, 3, 0, 6.5); path.bezierCurveTo(-5, 3, -5.5, -5, -1.6, -7); path.closePath(); }
  ctx.translate(2.5, 3.5); ctx.fillStyle = 'rgba(40,20,10,.14)'; ctx.fill(path); ctx.translate(-2.5, -3.5);
  ctx.fillStyle = p.c; ctx.fill(path); if (p.k === 'leaf') { ctx.strokeStyle = 'rgba(90,30,10,.5)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 10); ctx.stroke(); }
  ctx.restore();
}
/** @param {number} t */
function drawParts(t) {
  for (const p of parts) {
    if (p.k === 'fly') {
      const a = .35 + .65 * Math.max(0, Math.sin(t * .002 + p.ph * 3)); const r = 10 * p.z; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(235,255,170,${a})`); g.addColorStop(.25, `rgba(200,255,120,${a * .5})`); g.addColorStop(1, 'rgba(160,255,100,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    } else petal(p);
  }
}

/* ---------- lumière ---------- */
const noisePat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')), d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return /** @type {CanvasPattern} */ (ctx.createPattern(c, 'repeat'));
})();
/** @param {number} t */
function drawLight(t) {
  const m = mood(), { vw, vh } = G, M = Math.max(vw, vh);
  ctx.globalCompositeOperation = 'soft-light';
  let g = ctx.createRadialGradient(m.gp[0] * vw, m.gp[1] * vh, 0, m.gp[0] * vw, m.gp[1] * vh, M * 1.15); g.addColorStop(0, m.glow); g.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  ctx.globalCompositeOperation = 'multiply';
  for (let k = 0; k < 2; k++) { const cx = ((t * .006 * (k + 1) + k * vw * .6) % (vw + M)) - M / 2, cy = vh * (.3 + k * .4), r = M * .45; g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(90,90,110,.1)'); g.addColorStop(1, 'rgba(90,90,110,0)'); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .07; ctx.fillStyle = noisePat; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  g = ctx.createRadialGradient(vw / 2, vh / 2, M * .32, vw / 2, vh / 2, M * .78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, m.vig); ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
}

/** Curseur de l'outil. @param {number} x @param {number} y @param {number} dx @param {number} dy @param {string} tool */
function drawCursor(x, y, dx, dy, tool) {
  const { tines, vw, vh } = G;
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.lineWidth = 1.5;
  if (tool === 'rake') {
    const w = tines * SP * C / 2, px = -dy, py = dx; ctx.beginPath(); ctx.moveTo(-px * w, -py * w); ctx.lineTo(px * w, py * w); ctx.stroke();
    for (let k = 0; k < tines; k++) { const o = -w + SP * C * (k + .5); ctx.beginPath(); ctx.arc(px * o, py * o, 1.6, 0, TAU); ctx.fill(); }
  } else if (tool === 'smooth') { ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke(); }
  else { ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 0, stoneAt(x, y) >= 0 ? 8 : clamp(Math.min(vw, vh) * .045, 16, 34), 0, TAU); ctx.stroke(); }
  ctx.restore();
}

/** @type {CanvasPattern|null} */ let sandPat = null;
/** Motif du sable peint (tuile de 512 px), une fois l'image chargée. */
function sandPattern() {
  if (sandPat) return sandPat;
  const im = art('sable'); if (!im) return null;
  sandPat = ctx.createPattern(im, 'repeat');
  if (sandPat) sandPat.setTransform(new DOMMatrix().scale(.5));
  return sandPat;
}
/** Les visuels viennent d'arriver : on repeint les pierres déjà posées. */
export function artReady() { for (const s of G.stones) s.cv = undefined; }

/** Dessine une image complète. @param {number} t @param {{x:number,y:number,dx:number,dy:number,tool:string}|null} cursor */
export function draw(t, cursor) {
  const d = G.dirty;
  if (d) { G.dirty = null; shade(d[0], d[1], d[2], d[3]); }
  const dpr = view.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sand, 0, 0, G.W * C, G.H * C);
  const grainPat = sandPattern();
  if (grainPat) {
    // grain du sable peint, en surimpression douce sur le relief ombré
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .55; ctx.fillStyle = grainPat; ctx.fillRect(0, 0, G.W * C, G.H * C);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  for (const s of G.stones) { if (!s.cv) renderStone(s); const sz = s.cv.width / dpr, h = /** @type {number} */ (s.half); ctx.drawImage(s.cv, s.x - h, s.y - h, sz, sz); }
  drawLight(t); drawParts(t);
  if (cursor) drawCursor(cursor.x, cursor.y, cursor.dx, cursor.dy, cursor.tool);
}
