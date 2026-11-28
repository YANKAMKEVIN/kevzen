/** Sérialisation d'un jardin en JSON compact et versionné.
 *
 * Le sable est stocké comme l'écart au sable ratissé droit, quantifié sur un octet
 * (pas de 1/QUANT), puis compressé : les longues suites de zéros (sable jamais touché)
 * deviennent [ZERO_RUN, longueur]. Un jardin ratissé ici et là pèse quelques kilo-octets.
 *
 * Règle : toute modification du format incrémente GARDEN_FORMAT et ajoute une étape à
 * migrateGarden(). Un jardin d'une version inconnue ou abîmé est refusé (null), jamais deviné. */
import { KINDS, TINE_COUNTS, clamp } from './config';
import { type Garden, type Stone, allocate, buildMask, flatRow, markAll } from './garden';
import { pushUndo } from './history';

export const GARDEN_FORMAT = 1;
export const QUANT = 64;
const ZERO_RUN = -128;

export interface StoneData { x: number; y: number; r: number; e: number; rot: number; kind: number; moss: boolean; seed: number; pts: [number, number][] }
export interface GardenData {
  format: number;
  /** écran et grille d'origine */ vw: number; vh: number; W: number; H: number;
  tines: number;
  stones: StoneData[];
  /** sable compressé, en base64 */ sand: string;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Champ de hauteur -> octets signés compressés. */
export function encodeSand(hm: Float32Array, W: number, H: number): Int8Array {
  const out: number[] = [];
  let zeros = 0;
  const flush = (): void => {
    while (zeros > 0) {
      if (zeros < 3) { for (let k = 0; k < zeros; k++) out.push(0); zeros = 0; break; }
      const n = Math.min(zeros, 0x3fff); out.push(ZERO_RUN, n & 0x7f, n >> 7); zeros -= n;
    }
  };
  for (let y = 0; y < H; y++) {
    const f = flatRow(y);
    for (let x = 0; x < W; x++) {
      const q = clamp(Math.round((hm[y * W + x] - f) * QUANT), -127, 127);
      if (q === 0) { zeros++; continue; }
      flush(); out.push(q);
    }
  }
  flush();
  return Int8Array.from(out);
}

/** Octets compressés -> champ de hauteur ; null si les données ne collent pas à la taille. */
export function decodeSand(bytes: Int8Array, W: number, H: number): Float32Array | null {
  const n = W * H, hm = new Float32Array(n);
  let i = 0;
  for (let k = 0; k < bytes.length; k++) {
    const b = bytes[k];
    if (b === ZERO_RUN) {
      if (k + 2 >= bytes.length) return null;
      const run = (bytes[k + 1] & 0x7f) | ((bytes[k + 2] & 0x7f) << 7); k += 2;
      if (run <= 0 || i + run > n) return null;
      i += run;
    } else { if (i >= n) return null; hm[i++] = b / QUANT; }
  }
  if (i !== n) return null;
  for (let y = 0; y < H; y++) { const f = flatRow(y); for (let x = 0; x < W; x++) hm[y * W + x] += f; }
  return hm;
}

export function bytesToBase64(b: Int8Array): string {
  const u = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(s: string): Int8Array | null {
  let bin: string;
  try { bin = atob(s); } catch { return null; }
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Int8Array(u.buffer);
}

const stoneData = (s: Stone): StoneData => ({
  x: r2(s.x), y: r2(s.y), r: r2(s.r), e: r2(s.e), rot: r2(s.rot), kind: s.kind, moss: s.moss, seed: s.seed,
  pts: s.pts.map(([a, b]) => [r2(a), r2(b)] as [number, number]),
});

/** Photographie le jardin (sans l'historique ni les animations en cours). */
export function serializeGarden(g: Garden): GardenData {
  return { format: GARDEN_FORMAT, vw: g.vw, vh: g.vh, W: g.W, H: g.H, tines: g.tines, stones: g.stones.map(stoneData), sand: bytesToBase64(encodeSand(g.hm, g.W, g.H)) };
}

const num = (v: unknown, lo = -1e6, hi = 1e6): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && num(v, lo, hi);

function isStoneData(s: unknown): s is StoneData {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return num(o.x) && num(o.y) && num(o.r, 1, 500) && num(o.e, .5, 3) && num(o.rot) && int(o.kind, 0, KINDS.length - 1)
    && typeof o.moss === 'boolean' && int(o.seed, -(2 ** 31), 2 ** 32) && Array.isArray(o.pts) && o.pts.length >= 3 && o.pts.length <= 64
    && o.pts.every(p => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]));
}

/** Vérifie la forme d'un jardin sérialisé (à la version courante). */
export function isGardenData(d: unknown): d is GardenData {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  const o = d as Record<string, unknown>;
  return o.format === GARDEN_FORMAT && num(o.vw, 1, 20000) && num(o.vh, 1, 20000) && int(o.W, 1, 10001) && int(o.H, 1, 10001)
    && TINE_COUNTS.includes(o.tines as number) && Array.isArray(o.stones) && o.stones.length <= 200 && o.stones.every(isStoneData)
    && typeof o.sand === 'string';
}

/** Amène un jardin d'un format antérieur au format courant ; null si inconnu ou trop récent. */
export function migrateGarden(d: unknown): GardenData | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const f = (d as { format?: unknown }).format;
  if (!Number.isInteger(f) || (f as number) < 1 || (f as number) > GARDEN_FORMAT) return null;
  const out = structuredClone(d) as GardenData;
  // Étapes futures, à chaîner ici : if (out.format === 1) out = v1ToV2(out);
  return isGardenData(out) ? out : null;
}

/** Ré-échantillonne un champ de hauteur (plus proche voisin) vers une autre grille. */
export function resample(src: Float32Array, sW: number, sH: number, W: number, H: number): Float32Array {
  if (sW === W && sH === H) return src;
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(sH - 1, Math.round(y * (sH - 1) / Math.max(1, H - 1))), f = flatRow(y) - flatRow(sy);
    for (let x = 0; x < W; x++) out[y * W + x] = src[sy * sW + Math.min(sW - 1, Math.round(x * (sW - 1) / Math.max(1, W - 1)))] + f;
  }
  return out;
}

/** Ouvre un jardin sérialisé dans `g` (à la taille d'écran actuelle de g, ou à la sienne si g est vide).
 * L'ouverture s'annule comme un geste. Renvoie false (et ne touche à rien) si les données sont abîmées. */
export function restoreGarden(g: Garden, raw: unknown): boolean {
  const d = migrateGarden(raw); if (!d) return false;
  const bytes = base64ToBytes(d.sand); if (!bytes) return false;
  const src = decodeSand(bytes, d.W, d.H); if (!src) return false;
  if (g.W === 0) allocate(g, d.vw, d.vh);
  else pushUndo(g);
  const sx = g.vw / d.vw, sy = g.vh / d.vh;
  g.stones = d.stones.map(s => ({ ...s, x: s.x * sx, y: s.y * sy, pts: s.pts.map(([a, b]) => [a, b] as [number, number]) }));
  g.tines = d.tines;
  g.hm.set(resample(src, d.W, d.H, g.W, g.H));
  buildMask(g);
  for (let i = 0; i < g.hm.length; i++) if (g.mask[i]) g.hm[i] = g.ringT[i];
  g.grow = []; g.sweep = null; markAll(g);
  g.events.restored();
  return true;
}
