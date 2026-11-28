/** Les outils : râteau, lissage, pierres (pose, retrait, cercles qui poussent). */
import { TAU, C, SP, AMP, RINGS, KINDS, clamp, rng } from './config';
import { type Garden, type Stone, markDirty, buildMask, ringR } from './garden';

/** Un trait de râteau (coordonnées de la grille de sable). */
export function rakeSeg(g: Garden, ax: number, ay: number, bx: number, by: number): void {
  const { W, H, hm, mask } = g;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < .01) return;
  const ux = dx / len, uy = dy / len, half = g.tines * SP / 2, steps = Math.ceil(len / 1.5), sl = len / steps, r = half + 2;
  for (let s = 0; s < steps; s++) {
    const px = ax + dx * s / steps, py = ay + dy * s / steps, qx = px + ux * sl, qy = py + uy * sl;
    const x0 = Math.max(0, Math.floor(Math.min(px, qx) - r)), x1 = Math.min(W - 1, Math.ceil(Math.max(px, qx) + r));
    const y0 = Math.max(0, Math.floor(Math.min(py, qy) - r)), y1 = Math.min(H - 1, Math.ceil(Math.max(py, qy) + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (mask[i]) continue;
      const rx = x - px, ry = y - py, t = rx * ux + ry * uy; if (t < -1 || t > sl + 1) continue;
      const d = -rx * uy + ry * ux, ad = Math.abs(d); if (ad > half) continue;
      const w = Math.min(1, (half - ad) / (SP * .55));
      const tg = -Math.cos((d + half - SP / 2) * TAU / SP) * AMP;
      hm[i] += (tg - hm[i]) * .42 * w;
    }
  }
  markDirty(g, Math.min(ax, bx) - half - 3, Math.min(ay, by) - half - 3, Math.max(ax, bx) + half + 3, Math.max(ay, by) + half + 3);
}

/** Lisse le sable autour d'un point (grille de sable). */
export function smoothAt(g: Garden, cx: number, cy: number, r: number): void {
  const { W, H, hm, mask } = g;
  for (let y = Math.max(0, (cy - r) | 0); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, (cx - r) | 0); x <= Math.min(W - 1, cx + r); x++) {
    const i = y * W + x; if (mask[i]) continue; const d = Math.hypot(x - cx, y - cy); if (d > r) continue;
    hm[i] *= 1 - .2 * (1 - d / r);
  }
  markDirty(g, cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2);
}

/** Crée une pierre (forme irrégulière tirée au hasard), en pixels d'écran. */
export function makeStone(g: Garden, x: number, y: number, r: number, kind?: number): Stone {
  const R = rng((g.rand() * 1e9) | 0);
  const s: Stone = { x, y, r, e: 1 + R() * .3, rot: R() * Math.PI, kind: kind ?? ((R() * KINDS.length) | 0), moss: R() < .55, seed: (R() * 1e9) | 0, pts: [] };
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, rad = r * (1 + .1 * Math.sin(a * 2 + s.seed) + .08 * (R() - .5)); const px = Math.cos(a) * rad * s.e, py = Math.sin(a) * rad;
    s.pts.push([px * Math.cos(s.rot) - py * Math.sin(s.rot), px * Math.sin(s.rot) + py * Math.cos(s.rot)]);
  }
  return s;
}

/** Pose une pierre ; ses cercles se tracent peu à peu (stepGrow). */
export function placeStone(g: Garden, x: number, y: number, r: number, silent = false): Stone {
  const s = makeStone(g, x, y, r); g.stones.push(s); buildMask(g); g.grow.push({ s, p: 0 });
  g.events.stonePlaced(s, silent);
  return s;
}

/** Indice de la pierre sous (x, y) en pixels d'écran, ou -1. */
export function stoneAt(g: Garden, x: number, y: number): number {
  for (let i = g.stones.length - 1; i >= 0; i--) { const s = g.stones[i]; if (Math.hypot(x - s.x, y - s.y) < s.r * s.e) return i; }
  return -1;
}

/** Retire une pierre ; ses cercles s'effacent à moitié. */
export function removeStone(g: Garden, i: number): void {
  const s = g.stones.splice(i, 1)[0]; if (!s) return;
  const cx = s.x / C, cy = s.y / C, Z = ringR(s) + RINGS * SP; buildMask(g);
  const { W, H, hm, mask } = g;
  for (let y = Math.max(0, (cy - Z) | 0); y <= Math.min(H - 1, cy + Z); y++) for (let x = Math.max(0, (cx - Z) | 0); x <= Math.min(W - 1, cx + Z); x++) {
    const j = y * W + x; if (!mask[j] && Math.hypot(x - cx, y - cy) <= Z) hm[j] *= .25;
  }
  markDirty(g, cx - Z - 2, cy - Z - 2, cx + Z + 2, cy + Z + 2);
  g.events.stoneRemoved(s);
}

/** Taille de pierre au hasard pour l'écran. */
export const randomRadius = (g: Garden): number => clamp(Math.min(g.vw, g.vh) * (.025 + g.rand() * .04), 13, 50);

/** Fait pousser les cercles des pierres fraîchement posées. */
export function stepGrow(g: Garden, dt: number): void {
  const { grow, stones } = g;
  for (let j = grow.length - 1; j >= 0; j--) {
    const q = grow[j], s = q.s; q.p = Math.min(1, q.p + .035 * dt);
    if (!stones.includes(s)) { grow.splice(j, 1); continue; }
    const { W, H, hm, mask, ringT } = g;
    const cx = s.x / C, cy = s.y / C, Z = ringR(s) + RINGS * SP, lim = Z * q.p;
    for (let y = Math.max(0, (cy - lim) | 0); y <= Math.min(H - 1, cy + lim); y++) for (let x = Math.max(0, (cx - lim) | 0); x <= Math.min(W - 1, cx + lim); x++) {
      const i = y * W + x; if (mask[i] && Math.hypot(x - cx, y - cy) <= lim) hm[i] += (ringT[i] - hm[i]) * .5;
    }
    markDirty(g, cx - lim - 2, cy - lim - 2, cx + lim + 2, cy + lim + 2); if (q.p >= 1) grow.splice(j, 1);
  }
}
