/** Boucle d'animation. Elle s'arrête quand l'onglet est caché (batterie, processeur) et le son se tait. */
import { autoStep } from '../core/gardener';
import { stepSweep } from '../core/compose';
import { stepGrow } from '../core/tools';
import { ambience, pauseAudio } from '../audio';
import { draw, stepParts, pushParts, type Cursor } from '../render';
import { garden as g, ui } from './state';
import { scheduleAutosave } from './autosave';
import { stepGesture, playerCursor, cancelGesture, isDrawing } from './gestures';

let last = 0;
let raf = 0;
/** Réutilisé à chaque image : aucune allocation dans la boucle. */
const cursor: Cursor = { x: 0, y: 0, dx: 1, dy: 0, tool: 'rake' };
export const loop = { running: false, pauses: 0 };

function frame(t: number): void {
  const dt = Math.min(3, Math.max(0, (t - last) / 16.67)); last = t;
  stepGesture(dt);
  const autoActive = (ui.autoOn || (!ui.entered && !ui.resumed)) && autoStep(g, dt, ui.entered);
  if (autoActive) { pushParts(g.ag.x, g.ag.y, g.ag.dx * 2, g.ag.dy * 2); if (ui.entered) scheduleAutosave(); }
  if (ui.autoOn && !isDrawing()) document.body.classList.toggle('quiet', t - ui.lastAct > 4000);
  stepSweep(g, dt); stepGrow(g, dt); stepParts(g, dt); ambience(t, ui.entered);
  let c: Cursor | null = null;
  if (autoActive && ui.entered && !ui.panel) { cursor.x = g.ag.x; cursor.y = g.ag.y; cursor.dx = g.ag.dx; cursor.dy = g.ag.dy; cursor.tool = 'rake'; c = cursor; }
  else if (playerCursor(cursor)) c = cursor;
  draw(g, t, c);
  raf = requestAnimationFrame(frame);
}

export function start(): void {
  if (loop.running) return;
  loop.running = true; last = performance.now();
  raf = requestAnimationFrame(frame);
}

export function stop(): void {
  if (!loop.running) return;
  loop.running = false; loop.pauses++;
  cancelAnimationFrame(raf);
}

/** Pause automatique quand l'onglet est caché. */
export function bindVisibility(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelGesture(); stop(); pauseAudio(true); }
    else { pauseAudio(false); start(); }
  });
}
