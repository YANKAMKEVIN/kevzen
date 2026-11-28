/** Les pierres : peintes une fois chacune dans leur propre image (cache), puis simplement posées. */
import { TAU, KINDS, rng } from '../core/config';
import type { Garden, Stone } from '../core/garden';
import { art } from '../art';
import { ctx, mood, view } from './view';

interface Painted { cv: HTMLCanvasElement; half: number }
let cache = new WeakMap<Stone, Painted>();

/** Oublie les pierres peintes (changement de lumière, visuels arrivés, résolution changée). */
export function clearStoneCache(): void { cache = new WeakMap(); }

/** Peint une pierre dans sa propre image. */
export function paintStone(s: Stone): Painted {
  const dpr = view.dpr, m = mood(), k = KINDS[s.kind], R = s.r * s.e * 1.15, pad = s.r * .9 + 10, half = R + pad, size = Math.ceil(half * 2 * dpr);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d') as CanvasRenderingContext2D; g.scale(dpr, dpr); g.translate(half, half);
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
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = gr; g.fillRect(-half, -half, half * 2, half * 2);
    g.globalCompositeOperation = 'source-over';
  } else {
    g.fillStyle = gr; g.fillRect(-half, -half, half * 2, half * 2);
    for (let i = 0; i < s.r * 9; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.16)'; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r() * 1.3 + .3, 0, TAU); g.fill(); }
  }
  for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = .8; g.beginPath(); const a = r() * TAU; g.moveTo(Math.cos(a) * R, Math.sin(a) * R); g.quadraticCurveTo(r() * s.r - s.r / 2, r() * s.r - s.r / 2, -Math.cos(a) * R, -Math.sin(a) * R); g.stroke(); }
  if (s.moss) {
    for (let i = 0; i < 7; i++) {
      const mx = -s.r * .35 + (r() - .5) * s.r * .9, my = -s.r * .4 + (r() - .5) * s.r * .7, mr = s.r * (.18 + r() * .28);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr); mg.addColorStop(0, `rgba(${(96 + r() * 30) | 0},${(128 + r() * 30) | 0},${(58 + r() * 20) | 0},.85)`); mg.addColorStop(1, 'rgba(80,110,50,0)'); g.fillStyle = mg; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${(150 + r() * 50) | 0},${(180 + r() * 40) | 0},90,.35)`; const a = r() * TAU, d = r() * s.r * .5; g.fillRect(-s.r * .35 + Math.cos(a) * d, -s.r * .4 + Math.sin(a) * d, 1, 1); }
  }
  const lg = g.createLinearGradient(-R, -R, R, R); lg.addColorStop(0, 'rgba(255,255,255,.28)'); lg.addColorStop(.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.lineWidth = s.r * .22; g.strokeStyle = lg; g.stroke(p);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = m.tint; g.fillRect(-half, -half, half * 2, half * 2);
  g.restore();
  const out = { cv: c, half };
  cache.set(s, out);
  return out;
}

export function drawStones(g: Garden): void {
  const dpr = view.dpr;
  for (const s of g.stones) {
    const p = cache.get(s) ?? paintStone(s), sz = p.cv.width / dpr;
    ctx.drawImage(p.cv, s.x - p.half, s.y - p.half, sz, sz);
  }
}
