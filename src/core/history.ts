/** Annuler / rétablir : instantanés du sable et de la liste des pierres (les pierres sont immuables). */
import { type Garden, type Snapshot, buildMask, markAll } from './garden';

export const UNDO_MAX = 25;

const snapshot = (g: Garden): Snapshot => ({ h: g.hm.slice(), st: g.stones.slice() });

function apply(g: Garden, s: Snapshot): void {
  if (s.h.length === g.hm.length) g.hm.set(s.h);
  g.stones = s.st.slice(); g.grow = []; g.sweep = null; buildMask(g); markAll(g);
  g.events.restored();
}

/** Mémorise l'état avant un geste. Un nouveau geste efface ce qui pouvait être rétabli. */
export function pushUndo(g: Garden): void {
  g.undoS.push(snapshot(g)); if (g.undoS.length > UNDO_MAX) g.undoS.shift();
  g.redoS.length = 0;
}

/** Revient au geste précédent ; false s'il n'y a rien à annuler. */
export function undo(g: Garden): boolean {
  const u = g.undoS.pop(); if (!u) return false;
  g.redoS.push(snapshot(g)); if (g.redoS.length > UNDO_MAX) g.redoS.shift();
  apply(g, u);
  return true;
}

/** Refait le geste annulé ; false s'il n'y a rien à rétablir. */
export function redo(g: Garden): boolean {
  const r = g.redoS.pop(); if (!r) return false;
  g.undoS.push(snapshot(g)); if (g.undoS.length > UNDO_MAX) g.undoS.shift();
  apply(g, r);
  return true;
}

export const canUndo = (g: Garden): boolean => g.undoS.length > 0;
export const canRedo = (g: Garden): boolean => g.redoS.length > 0;
