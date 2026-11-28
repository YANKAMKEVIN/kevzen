/** Le jardin sans DOM : état, grille de sable (champ de hauteur), masque des pierres.
 * Tout le modèle est pur : aucune dépendance au navigateur, testable sous Node.
 * Le rendu et le son écoutent les événements via `g.events`. */
import { TAU, C, SP, AMP, RINGS, rng } from './config';

/** Une pierre : forme irrégulière figée à sa création (jamais modifiée ensuite). */
export interface Stone {
  x: number; y: number; r: number; e: number; rot: number; kind: number; moss: boolean; seed: number;
  pts: [number, number][];
}

export interface Snapshot { h: Float32Array; st: Stone[] }

/** Événements vers le rendu et le son. */
export interface GardenEvents {
  stonePlaced(s: Stone, silent: boolean): void;
  stoneRemoved(s: Stone): void;
  /** annuler / rétablir / ouvrir un jardin : tout l'état a changé */
  restored(): void;
  newGarden(): void;
  /** le jardinier automatique joue une note */
  note(x: number, y: number): void;
}

export interface Gardener { x: number; y: number; a: number; left: number; pause: number; t: number; s: number; dx: number; dy: number; trav: number }

export interface Garden {
  /** taille en pixels d'écran */ vw: number; vh: number;
  /** taille de la grille de sable */ W: number; H: number;
  /** hauteur du sable */ hm: Float32Array;
  /** 1 là où une pierre impose ses cercles */ mask: Uint8Array;
  /** hauteur visée par les cercles */ ringT: Float32Array;
  stones: Stone[];
  undoS: Snapshot[];
  redoS: Snapshot[];
  grow: { s: Stone; p: number }[];
  sweep: { y: number } | null;
  /** zone à redessiner [x0,y0,x1,y1] */ dirty: [number, number, number, number] | null;
  tines: number;
  /** hasard du jardin (remplaçable par une graine) */ rand: () => number;
  events: GardenEvents;
  ag: Gardener;
}

export const silentEvents = (): GardenEvents => ({ stonePlaced() {}, stoneRemoved() {}, restored() {}, newGarden() {}, note() {} });

/** Jardin vide (grille 0×0) ; appeler allocate() pour lui donner une taille. */
export function createGarden(seed?: number): Garden {
  return {
    vw: 0, vh: 0, W: 0, H: 0, hm: new Float32Array(0), mask: new Uint8Array(0), ringT: new Float32Array(0),
    stones: [], undoS: [], redoS: [], grow: [], sweep: null, dirty: null, tines: 5,
    rand: seed ? rng(seed) : Math.random, events: silentEvents(),
    ag: { x: 0, y: 0, a: 0, left: 0, pause: 30, t: 0, s: 0, dx: 1, dy: 0, trav: 0 },
  };
}

/** Fixe la graine du hasard (tests, partie rejouable). */
export function seed(g: Garden, n: number): void { g.rand = rng(n); }

export function markDirty(g: Garden, x0: number, y0: number, x1: number, y1: number): void {
  x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(g.W - 1, Math.ceil(x1)); y1 = Math.min(g.H - 1, Math.ceil(y1));
  if (x1 < x0 || y1 < y0) return;
  const d = g.dirty;
  if (!d) g.dirty = [x0, y0, x1, y1];
  else { d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1); }
}
export const markAll = (g: Garden): void => markDirty(g, 0, 0, g.W, g.H);

/** Hauteur d'un sable ratissé droit, ligne y. */
export const flatRow = (y: number): number => -Math.cos(y * TAU / SP) * AMP;

/** Taille de grille pour un écran donné. */
export const gridSize = (vw: number, vh: number): [number, number] => [Math.ceil(vw / C) + 1, Math.ceil(vh / C) + 1];

/** Taille l'écran ; garde le sable déjà dessiné. Renvoie true si la grille a changé. */
export function allocate(g: Garden, vw: number, vh: number): boolean {
  const [nW, nH] = gridSize(vw, vh);
  g.vw = vw; g.vh = vh;
  if (nW === g.W && nH === g.H) return false;
  const nh = new Float32Array(nW * nH);
  for (let y = 0; y < nH; y++) { const v = flatRow(y); for (let x = 0; x < nW; x++) nh[y * nW + x] = v; }
  const { W, H, hm } = g;
  for (let y = 0; y < Math.min(H, nH); y++) for (let x = 0; x < Math.min(W, nW); x++) nh[y * nW + x] = hm[y * W + x];
  g.W = nW; g.H = nH; g.hm = nh;
  g.undoS = []; g.redoS = []; buildMask(g); markAll(g);
  return true;
}

/** Remet tout le sable ratissé droit, cercles compris. */
export function fillFlat(g: Garden): void {
  const { W, H, hm, mask, ringT } = g;
  for (let y = 0; y < H; y++) { const v = flatRow(y); for (let x = 0; x < W; x++) { const i = y * W + x; hm[i] = mask[i] ? ringT[i] : v; } }
  markAll(g);
}

/** Rayon de la pierre dans la grille de sable. */
export const ringR = (s: Stone): number => (s.r * s.e * 1.08 + 4) / C;

/** Recalcule le masque des pierres et la hauteur visée par leurs cercles. */
export function buildMask(g: Garden): void {
  const { W, H } = g;
  const mask = new Uint8Array(W * H), ringT = new Float32Array(W * H);
  for (const s of g.stones) {
    const cx = s.x / C, cy = s.y / C, R = ringR(s), Z = R + RINGS * SP;
    for (let y = Math.max(0, (cy - Z) | 0); y <= Math.min(H - 1, cy + Z); y++) for (let x = Math.max(0, (cx - Z) | 0); x <= Math.min(W - 1, cx + Z); x++) {
      const rr = Math.hypot(x - cx, y - cy); if (rr > Z) continue; const i = y * W + x;
      const v = rr < R ? .35 : -Math.cos((rr - R) * TAU / SP) * AMP;
      if (!mask[i] || rr < R) ringT[i] = v; mask[i] = 1;
    }
  }
  g.mask = mask; g.ringT = ringT;
}
