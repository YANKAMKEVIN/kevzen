/** Garde le jardin en cours tout seul : quelques instants après chaque geste, et tout de suite quand
 * la page est cachée ou fermée. Au rechargement, le jardin revient tel qu'on l'a laissé. */
import { serializeGarden, restoreGarden } from '../core/serialize';
import { readCurrent, writeCurrent, clearCurrent, CURRENT_KEY, type WriteResult } from '../storage/autosave';
import { debounce } from '../storage/debounce';
import { browserStore, safeGet } from '../storage/store';
import { garden as g, ui, $ } from './state';
import { isDrawing } from './gestures';

/** Attente après le dernier changement, et attente maximale pendant un changement continu (méditer). */
export const AUTOSAVE_WAIT = 1200;
export const AUTOSAVE_MAX_WAIT = 6000;

/** Lu par les tests de bout en bout. */
export const autosave = { writes: 0, last: '' as WriteResult | '', resumed: false };

let warned = false;

/** Écrit maintenant. `force` : même au milieu d'un geste ou d'une animation (page qui se ferme). */
export function saveNow(force = false): WriteResult | null {
  if (!force && (isDrawing() || g.sweep || g.grow.length)) { timer.schedule(); return null; }
  if (g.W === 0) return null;
  const r = writeCurrent(browserStore(), serializeGarden(g), { galleryId: ui.galleryId });
  autosave.writes++; autosave.last = r;
  // une seule fois tant que ça dure : le jardin reste jouable, seul l'enregistrement automatique s'arrête
  if (r === 'plein' && !warned) { warned = true; $('hint').textContent = 'Stockage plein : le jardin en cours n\'est plus gardé automatiquement.'; }
  if (r === 'ok') warned = false;
  return r;
}

const timer = debounce(() => { saveNow(); }, AUTOSAVE_WAIT, AUTOSAVE_MAX_WAIT);

/** Le jardin a changé : il sera gardé dans un instant. Sans allocation (appelable à chaque image). */
export function scheduleAutosave(): void { timer.schedule(); }

/** Écrit tout de suite ce qui attendait. */
export function flushAutosave(): void { if (timer.pending) { timer.cancel(); saveNow(true); } }

/** Rouvre le jardin gardé, s'il y en a un. Renvoie true si le jardin a été repris. */
export function resumeAutosave(): boolean {
  const st = browserStore(), e = readCurrent(st);
  if (!e) return false;
  if (!restoreGarden(g, e.garden)) { clearCurrent(st, safeGet(st, CURRENT_KEY) ?? ''); return false; }
  // le jardin repris est un point de départ : rien à annuler
  g.undoS.length = 0; g.redoS.length = 0;
  ui.galleryId = e.galleryId;
  autosave.resumed = true;
  return true;
}

export function bindAutosave(): void {
  addEventListener('pagehide', flushAutosave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAutosave(); });
}
