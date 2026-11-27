// @ts-check
/** Le jardin sans DOM : champ de hauteur du sable, râteau, pierres et leurs cercles,
 * annulation, nouveau jardin et jardinier automatique. Testable sous Node.
 * Le rendu (ui/render) s'abonne aux événements via `hooks`. */
import { TAU, C, SP, AMP, RINGS, KINDS, clamp, rng } from './config.js';

/** @typedef {{x:number,y:number,r:number,e:number,rot:number,kind:number,moss:boolean,seed:number,pts:[number,number][],cv?:any,half?:number}} Stone
 * @typedef {{h:Float32Array,st:Stone[]}} Snapshot */

/** État du jardin. vw/vh : taille en pixels d'écran ; W/H : taille de la grille de sable. */
export const G = {
  vw: 0, vh: 0, W: 0, H: 0,
  /** hauteur du sable */ hm: new Float32Array(0),
  /** 1 là où une pierre impose ses cercles */ mask: new Uint8Array(0),
  /** hauteur visée par les cercles */ ringT: new Float32Array(0),
  /** @type {Stone[]} */ stones: [],
  /** @type {Snapshot[]} */ undoS: [],
  /** @type {{s:Stone,p:number}[]} */ grow: [],
  /** @type {{y:number}|null} */ sweep: null,
  /** zone à redessiner [x0,y0,x1,y1] @type {number[]|null} */ dirty: null,
  tines: 5,
  /** hasard du jardin (remplaçable par une graine dans les tests) */ rand: Math.random,
};

/** Événements vers le rendu et le son. */
export const hooks = {
  /** @param {Stone} _s */ stoneMade(_s) {},
  /** @param {Stone} _s @param {boolean} _silent */ stonePlaced(_s, _silent) {},
  /** @param {Stone} _s */ stoneRemoved(_s) {},
  undone() {},
  newGarden() {},
  /** le jardinier automatique joue une note @param {number} _x @param {number} _y */ note(_x, _y) {},
};

/** Fixe la graine du hasard (tests, partie rejouable). @param {number} n */
export function seed(n) { G.rand = rng(n); }

/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
export function markDirty(x0, y0, x1, y1) {
  x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(G.W - 1, Math.ceil(x1)); y1 = Math.min(G.H - 1, Math.ceil(y1));
  if (x1 < x0 || y1 < y0) return;
  const d = G.dirty;
  if (!d) G.dirty = [x0, y0, x1, y1];
  else { d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1); }
}
export const markAll = () => markDirty(0, 0, G.W, G.H);

/** Hauteur d'un sable ratissé droit, ligne y. @param {number} y */
export const flatRow = y => -Math.cos(y * TAU / SP) * AMP;

/** Taille l'écran ; garde le sable déjà dessiné. Renvoie true si la grille a changé.
 * @param {number} vw @param {number} vh */
export function allocate(vw, vh) {
  const nW = Math.ceil(vw / C) + 1, nH = Math.ceil(vh / C) + 1;
  G.vw = vw; G.vh = vh;
  if (nW === G.W && nH === G.H) return false;
  const nh = new Float32Array(nW * nH);
  for (let y = 0; y < nH; y++) { const v = flatRow(y); for (let x = 0; x < nW; x++) nh[y * nW + x] = v; }
  const { W, H, hm } = G;
  for (let y = 0; y < Math.min(H, nH); y++) for (let x = 0; x < Math.min(W, nW); x++) nh[y * nW + x] = hm[y * W + x];
  G.W = nW; G.H = nH; G.hm = nh;
  G.undoS = []; buildMask(); markAll();
  return true;
}

/** Remet tout le sable ratissé droit, cercles compris. */
export function fillFlat() {
  const { W, H, hm, mask, ringT } = G;
  for (let y = 0; y < H; y++) { const v = flatRow(y); for (let x = 0; x < W; x++) { const i = y * W + x; hm[i] = mask[i] ? ringT[i] : v; } }
  markAll();
}

/** Un trait de râteau (coordonnées de la grille de sable).
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by */
export function rakeSeg(ax, ay, bx, by) {
  const { W, H, hm, mask } = G;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < .01) return;
  const ux = dx / len, uy = dy / len, half = G.tines * SP / 2, steps = Math.ceil(len / 1.5), sl = len / steps, r = half + 2;
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
  markDirty(Math.min(ax, bx) - half - 3, Math.min(ay, by) - half - 3, Math.max(ax, bx) + half + 3, Math.max(ay, by) + half + 3);
}

/** Lisse le sable autour d'un point. @param {number} cx @param {number} cy @param {number} r */
export function smoothAt(cx, cy, r) {
  const { W, H, hm, mask } = G;
  for (let y = Math.max(0, cy - r | 0); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, cx - r | 0); x <= Math.min(W - 1, cx + r); x++) {
    const i = y * W + x; if (mask[i]) continue; const d = Math.hypot(x - cx, y - cy); if (d > r) continue;
    hm[i] *= 1 - .2 * (1 - d / r);
  }
  markDirty(cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2);
}

/** Rayon de la pierre dans la grille de sable. @param {Stone} s */
export const ringR = s => (s.r * s.e * 1.08 + 4) / C;

/** Recalcule le masque des pierres et la hauteur visée par leurs cercles. */
export function buildMask() {
  const { W, H } = G;
  const mask = new Uint8Array(W * H), ringT = new Float32Array(W * H);
  for (const s of G.stones) {
    const cx = s.x / C, cy = s.y / C, R = ringR(s), Z = R + RINGS * SP;
    for (let y = Math.max(0, cy - Z | 0); y <= Math.min(H - 1, cy + Z); y++) for (let x = Math.max(0, cx - Z | 0); x <= Math.min(W - 1, cx + Z); x++) {
      const rr = Math.hypot(x - cx, y - cy); if (rr > Z) continue; const i = y * W + x;
      const v = rr < R ? .35 : -Math.cos((rr - R) * TAU / SP) * AMP;
      if (!mask[i] || rr < R) ringT[i] = v; mask[i] = 1;
    }
  }
  G.mask = mask; G.ringT = ringT;
}

/** Crée une pierre (forme irrégulière tirée au hasard). @param {number} x @param {number} y @param {number} r @param {number} [kind] @returns {Stone} */
export function makeStone(x, y, r, kind) {
  const R = rng(G.rand() * 1e9 | 0);
  /** @type {Stone} */
  const s = { x, y, r, e: 1 + R() * .3, rot: R() * Math.PI, kind: kind ?? (R() * KINDS.length | 0), moss: R() < .55, seed: R() * 1e9 | 0, pts: [] };
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, rad = r * (1 + .1 * Math.sin(a * 2 + s.seed) + .08 * (R() - .5)); const px = Math.cos(a) * rad * s.e, py = Math.sin(a) * rad;
    s.pts.push([px * Math.cos(s.rot) - py * Math.sin(s.rot), px * Math.sin(s.rot) + py * Math.cos(s.rot)]);
  }
  hooks.stoneMade(s);
  return s;
}

/** Pose une pierre ; ses cercles se tracent peu à peu (stepGrow). @param {number} x @param {number} y @param {number} r @param {boolean} [silent] */
export function placeStone(x, y, r, silent = false) {
  const s = makeStone(x, y, r); G.stones.push(s); buildMask(); G.grow.push({ s, p: 0 });
  hooks.stonePlaced(s, silent);
  return s;
}

/** Indice de la pierre sous (x, y) en pixels d'écran, ou -1. @param {number} x @param {number} y */
export function stoneAt(x, y) {
  for (let i = G.stones.length - 1; i >= 0; i--) { const s = G.stones[i]; if (Math.hypot(x - s.x, y - s.y) < s.r * s.e) return i; }
  return -1;
}

/** Retire une pierre ; ses cercles s'effacent à moitié. @param {number} i */
export function removeStone(i) {
  const s = G.stones.splice(i, 1)[0]; const cx = s.x / C, cy = s.y / C, Z = ringR(s) + RINGS * SP; buildMask();
  const { W, H, hm, mask } = G;
  for (let y = Math.max(0, cy - Z | 0); y <= Math.min(H - 1, cy + Z); y++) for (let x = Math.max(0, cx - Z | 0); x <= Math.min(W - 1, cx + Z); x++) {
    const j = y * W + x; if (!mask[j] && Math.hypot(x - cx, y - cy) <= Z) hm[j] *= .25;
  }
  markDirty(cx - Z - 2, cy - Z - 2, cx + Z + 2, cy + Z + 2);
  hooks.stoneRemoved(s);
}

/** Taille de pierre au hasard pour l'écran. */
export const randomRadius = () => clamp(Math.min(G.vw, G.vh) * (.025 + G.rand() * .04), 13, 50);

/** Fait pousser les cercles des pierres fraîchement posées. @param {number} dt */
export function stepGrow(dt) {
  const { grow, stones } = G;
  for (let j = grow.length - 1; j >= 0; j--) {
    const q = grow[j], s = q.s; q.p = Math.min(1, q.p + .035 * dt);
    if (!stones.includes(s)) { grow.splice(j, 1); continue; }
    const { W, H, hm, mask, ringT } = G;
    const cx = s.x / C, cy = s.y / C, Z = ringR(s) + RINGS * SP, lim = Z * q.p;
    for (let y = Math.max(0, cy - lim | 0); y <= Math.min(H - 1, cy + lim); y++) for (let x = Math.max(0, cx - lim | 0); x <= Math.min(W - 1, cx + lim); x++) {
      const i = y * W + x; if (mask[i] && Math.hypot(x - cx, y - cy) <= lim) hm[i] += (ringT[i] - hm[i]) * .5;
    }
    markDirty(cx - lim - 2, cy - lim - 2, cx + lim + 2, cy + lim + 2); if (q.p >= 1) grow.splice(j, 1);
  }
}

/** Compose un jardin de 3, 5 ou 7 pierres, en groupes. */
export function compose() {
  const R = G.rand, { vw, vh } = G, n = [3, 5, 5, 7][R() * 4 | 0], m = Math.min(vw, vh);
  /** @type {Stone[]} */
  const stones = []; G.stones = stones;
  const big = clamp(m * .07, 26, 54); let tries = 0;
  while (stones.length < n && tries++ < 400) {
    const first = !stones.length, r = first ? big : big * (.35 + R() * .55);
    const x = vw * (.12 + R() * .76), y = vh * (.16 + R() * .6);
    if (stones.some(s => Math.hypot(s.x - x, s.y - y) < (s.r + r) * 1.4 + (R() < .5 ? RINGS * SP * C * 2 : 0))) continue;
    if (!first && R() < .6) {
      const a = stones[R() * stones.length | 0], ang = R() * TAU, d = (a.r + r) * 1.05;
      const s = makeStone(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, r);
      if (s.x > 20 && s.x < vw - 20 && s.y > 40 && s.y < vh - 90) stones.push(s);
      continue;
    }
    stones.push(makeStone(x, y, r));
  }
  buildMask();
  return n;
}

/** Nouveau jardin : nouvelles pierres, puis un coup de râteau balaie l'écran de haut en bas. */
export function newGarden() { pushUndo(); compose(); G.sweep = { y: 0 }; hooks.newGarden(); }

/** @param {number} dt */
export function stepSweep(dt) {
  const sw = G.sweep; if (!sw) return;
  const { W, H, hm, mask, ringT } = G;
  const rows = Math.max(3, H / 55 * dt), end = Math.min(H, sw.y + rows);
  for (let y = sw.y | 0; y < end; y++) { const v = flatRow(y); for (let x = 0; x < W; x++) { const i = y * W + x; hm[i] = mask[i] ? ringT[i] : v; } }
  markDirty(0, sw.y - 1, W, end + 1); sw.y = end; if (end >= H) G.sweep = null;
}

export const UNDO_MAX = 25;
export function pushUndo() { G.undoS.push({ h: G.hm.slice(), st: G.stones.slice() }); if (G.undoS.length > UNDO_MAX) G.undoS.shift(); }
/** Revient au geste précédent ; false s'il n'y a rien à annuler. */
export function undo() {
  const u = G.undoS.pop(); if (!u) return false;
  if (u.h.length === G.hm.length) G.hm.set(u.h);
  G.stones = u.st; G.grow = []; G.sweep = null; buildMask(); markAll();
  hooks.undone();
  return true;
}

/* ---------- jardinier automatique ---------- */
export const ag = { x: 0, y: 0, a: 0, left: 0, pause: 30, t: 0, s: 0, dx: 1, dy: 0, trav: 0 };

/** Un pas du jardinier ; renvoie true s'il ratisse, false s'il fait une pause.
 * @param {number} dt @param {boolean} entered le joueur est entré (sinon, pierres posées sans bruit) */
export function autoStep(dt, entered) {
  const R = G.rand, { vw, vh } = G;
  if (ag.pause > 0) {
    ag.pause -= dt;
    if (ag.pause <= 0) { ag.x = vw * (.1 + R() * .8); ag.y = vh * (.12 + R() * .7); ag.a = R() * TAU; ag.left = Math.min(vw, vh) * (.8 + R() * 1.4); }
    return false;
  }
  ag.t += dt; ag.a += (Math.sin(ag.t * .011 + ag.s) * .6 + Math.sin(ag.t * .027 + ag.s * 2) * .4) * .02 * dt;
  const mg = 70, cx = vw / 2 - ag.x, cy = vh / 2 - ag.y;
  if (ag.x < mg || ag.x > vw - mg || ag.y < mg || ag.y > vh - mg - 60) { let da = Math.atan2(cy, cx) - ag.a; da = Math.atan2(Math.sin(da), Math.cos(da)); ag.a += da * .05 * dt; }
  for (const s of G.stones) {
    const z = ringR(s) * C + RINGS * SP * C + G.tines * SP * C / 2 + 14, dx = ag.x - s.x, dy = ag.y - s.y, d = Math.hypot(dx, dy);
    if (d < z + 30) {
      const away = Math.atan2(dy, dx); const tan = away + (Math.sin(ag.a - away) > 0 ? Math.PI / 2 : -Math.PI / 2);
      let da = tan - ag.a; da = Math.atan2(Math.sin(da), Math.cos(da)); ag.a += da * .12 * dt * clamp(1 - (d - z) / 30, 0, 1);
    }
  }
  const sp = 1.5 * dt, ox = ag.x, oy = ag.y; ag.x += Math.cos(ag.a) * sp; ag.y += Math.sin(ag.a) * sp; ag.dx = Math.cos(ag.a); ag.dy = Math.sin(ag.a);
  rakeSeg(ox / C, oy / C, ag.x / C, ag.y / C);
  ag.left -= sp; ag.trav += sp; if (ag.trav > 52) { ag.trav = 0; hooks.note(ag.x, ag.y); }
  if (ag.left <= 0) {
    ag.pause = 50 + R() * 90;
    if (G.stones.length < 6 && R() < .3) { const x = vw * (.15 + R() * .7), y = vh * (.18 + R() * .55); if (stoneAt(x, y) < 0) placeStone(x, y, randomRadius(), !entered); }
  }
  return true;
}
