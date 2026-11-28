/** Composition d'un jardin (3, 5 ou 7 pierres en groupes), nouveau jardin et balayage. */
import { TAU, C, SP, RINGS, clamp } from './config';
import { type Garden, type Stone, buildMask, flatRow, markDirty } from './garden';
import { makeStone } from './tools';
import { pushUndo } from './history';

/** Compose un jardin de 3, 5 ou 7 pierres, en groupes. Renvoie le nombre visé. */
export function compose(g: Garden): number {
  const R = g.rand, { vw, vh } = g, n = [3, 5, 5, 7][(R() * 4) | 0], m = Math.min(vw, vh);
  const stones: Stone[] = []; g.stones = stones;
  const big = clamp(m * .07, 26, 54); let tries = 0;
  while (stones.length < n && tries++ < 400) {
    const first = !stones.length, r = first ? big : big * (.35 + R() * .55);
    const x = vw * (.12 + R() * .76), y = vh * (.16 + R() * .6);
    if (stones.some(s => Math.hypot(s.x - x, s.y - y) < (s.r + r) * 1.4 + (R() < .5 ? RINGS * SP * C * 2 : 0))) continue;
    if (!first && R() < .6) {
      const a = stones[(R() * stones.length) | 0], ang = R() * TAU, d = (a.r + r) * 1.05;
      const s = makeStone(g, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, r);
      if (s.x > 20 && s.x < vw - 20 && s.y > 40 && s.y < vh - 90) stones.push(s);
      continue;
    }
    stones.push(makeStone(g, x, y, r));
  }
  buildMask(g);
  return n;
}

/** Nouveau jardin : nouvelles pierres, puis un coup de râteau balaie l'écran de haut en bas. */
export function newGarden(g: Garden): void { pushUndo(g); compose(g); g.sweep = { y: 0 }; g.events.newGarden(); }

/** Fait avancer le balayage du nouveau jardin. */
export function stepSweep(g: Garden, dt: number): void {
  const sw = g.sweep; if (!sw) return;
  const { W, H, hm, mask, ringT } = g;
  const rows = Math.max(3, H / 55 * dt), end = Math.min(H, sw.y + rows);
  for (let y = sw.y | 0; y < end; y++) { const v = flatRow(y); for (let x = 0; x < W; x++) { const i = y * W + x; hm[i] = mask[i] ? ringT[i] : v; } }
  markDirty(g, 0, sw.y - 1, W, end + 1); sw.y = end; if (end >= H) g.sweep = null;
}
