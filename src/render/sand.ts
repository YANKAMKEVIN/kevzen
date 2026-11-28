/** Le sable : ombré d'après la pente du champ de hauteur, seulement là où il a changé
 * (rendu incrémental : g.dirty), puis le grain peint en surimpression. */
import { C, clamp, rng } from '../core/config';
import type { Garden } from '../core/garden';
import { art } from '../art';
import { ctx, mood } from './view';

let grain = new Float32Array(0);
let sand: HTMLCanvasElement | null = null;
let sctx: CanvasRenderingContext2D | null = null;
let img: ImageData | null = null;
let sandPat: CanvasPattern | null = null;

/** Prépare les tampons du sable pour la taille de grille actuelle. */
export function allocSand(g: Garden): void {
  const { W, H } = g;
  grain = new Float32Array(W * H); const r = rng(7); for (let i = 0; i < grain.length; i++) grain[i] = r() - .5;
  sand = document.createElement('canvas'); sand.width = W; sand.height = H;
  sctx = sand.getContext('2d') as CanvasRenderingContext2D; img = sctx.createImageData(W, H);
}

/** Ombre le sable d'après la pente du champ de hauteur, dans le rectangle donné (grille). */
function shade(g: Garden, x0: number, y0: number, x1: number, y1: number): void {
  if (!img || !sctx) return;
  const m = mood(), d = img.data, sh = m.sh, mi = m.mid, li = m.li, { W, H, hm } = g;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    const nx = hm[x > 0 ? i - 1 : i] - hm[x < W - 1 ? i + 1 : i], ny = hm[y > 0 ? i - W : i] - hm[y < H - 1 ? i + W : i];
    const t = clamp(.56 + (nx * -.62 + ny * -.74) * .2 + hm[i] * .05 + grain[i] * .09, 0, 1);
    let a, b, u; if (t < .5) { a = sh; b = mi; u = t * 2; } else { a = mi; b = li; u = (t - .5) * 2; }
    const o = i * 4; d[o] = a[0] + (b[0] - a[0]) * u; d[o + 1] = a[1] + (b[1] - a[1]) * u; d[o + 2] = a[2] + (b[2] - a[2]) * u; d[o + 3] = 255;
  }
  sctx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

/** Motif du sable peint (tuile de 512 px), une fois l'image chargée. */
function sandPattern(): CanvasPattern | null {
  if (sandPat) return sandPat;
  const im = art('sable'); if (!im) return null;
  sandPat = ctx.createPattern(im, 'repeat');
  if (sandPat) sandPat.setTransform(new DOMMatrix().scale(.5));
  return sandPat;
}

/** Repeint la zone modifiée puis pose le sable à l'écran. Renvoie le nombre de pixels de sable ombrés. */
export function drawSand(g: Garden): number {
  const d = g.dirty;
  let n = 0;
  if (d) { g.dirty = null; shade(g, d[0], d[1], d[2], d[3]); n = (d[2] - d[0] + 1) * (d[3] - d[1] + 1); }
  if (!sand) return n;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sand, 0, 0, g.W * C, g.H * C);
  const pat = sandPattern();
  if (pat) {
    // grain du sable peint, en surimpression douce sur le relief ombré
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .55; ctx.fillStyle = pat; ctx.fillRect(0, 0, g.W * C, g.H * C);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  return n;
}
