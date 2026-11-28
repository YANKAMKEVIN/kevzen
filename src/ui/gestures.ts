/** Gestes au doigt et à la souris : un seul pointeur à la fois, lissé image par image. */
import { C } from '../core/config';
import { pushUndo } from '../core/history';
import { rakeSeg, smoothAt, placeStone, stoneAt, removeStone, randomRadius } from '../core/tools';
import { ensureAudio, note, swish } from '../audio';
import { cv, pushParts, type Cursor } from '../render';
import { garden as g, ui } from './state';

let down: number | null = null;
const ptr = { x: -99, y: -99, in: false, mouse: false };
const pen = { x: 0, y: 0, on: false };
const dir = { x: 1, y: 0 };
let travel = 0;

export const isDrawing = (): boolean => down !== null;

/** Applique l'outil sur un bout de geste (pixels d'écran). */
function applyTool(ax: number, ay: number, bx: number, by: number, speed: number): void {
  if (ui.tool === 'rake') { rakeSeg(g, ax / C, ay / C, bx / C, by / C); swish(speed); }
  else { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6)); for (let i = 1; i <= n; i++) smoothAt(g, (ax + (bx - ax) * i / n) / C, (ay + (by - ay) * i / n) / C, 13); swish(speed * .6, true); }
}

/** Interrompt le geste en cours (onglet caché, galerie ouverte). */
export function cancelGesture(): void { if (down === null) return; down = null; pen.on = false; swish(0); document.body.classList.remove('quiet'); }

export function bindGestures(onChange: () => void): void {
  cv.addEventListener('pointerdown', e => {
    if (down !== null || !ui.entered || ui.panel) return; ensureAudio(); ui.lastAct = performance.now();
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.mouse = e.pointerType === 'mouse';
    if (ui.tool === 'stone') { pushUndo(g); const i = stoneAt(g, ptr.x, ptr.y); if (i >= 0) removeStone(g, i); else placeStone(g, ptr.x, ptr.y, randomRadius(g)); onChange(); return; }
    try { cv.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    down = e.pointerId; pushUndo(g); pen.x = ptr.x; pen.y = ptr.y; pen.on = true; travel = 0; document.body.classList.add('quiet'); onChange();
  });
  cv.addEventListener('pointermove', e => { if (down !== null && e.pointerId !== down) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true; ptr.mouse = e.pointerType === 'mouse'; ui.lastAct = performance.now(); });
  const up = (e: PointerEvent): void => { if (e.pointerId === down) cancelGesture(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ptr.in = false; });
}

/** Fait avancer le geste d'une image : le « stylo » rattrape le doigt en douceur. */
export function stepGesture(dt: number): void {
  if (down === null || !pen.on) return;
  const k = .38 * Math.min(dt, 2), nx = pen.x + (ptr.x - pen.x) * k, ny = pen.y + (ptr.y - pen.y) * k, dx = nx - pen.x, dy = ny - pen.y, d = Math.hypot(dx, dy);
  if (d <= .25) { swish(0); return; }
  applyTool(pen.x, pen.y, nx, ny, d / dt); dir.x += (dx / d - dir.x) * .3; dir.y += (dy / d - dir.y) * .3; const L = Math.hypot(dir.x, dir.y) || 1; dir.x /= L; dir.y /= L;
  pushParts(nx, ny, dx, dy); travel += d; if (ui.tool === 'rake' && travel > 44) { travel = 0; note(nx, ny); } pen.x = nx; pen.y = ny;
}

/** Remplit `c` avec le curseur du joueur ; false s'il n'y en a pas à montrer. */
export function playerCursor(c: Cursor): boolean {
  if (!ui.entered || ui.panel || !(down !== null || (ptr.in && ptr.mouse))) return false;
  const p = down !== null && pen.on ? pen : ptr;
  c.x = p.x; c.y = p.y; c.dx = dir.x; c.dy = dir.y; c.tool = ui.tool;
  return true;
}
