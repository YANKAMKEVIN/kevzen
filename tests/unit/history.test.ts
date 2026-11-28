import { describe, expect, test } from 'vitest';
import { pushUndo, undo, redo, canUndo, canRedo, UNDO_MAX } from '../../src/core/history';
import { rakeSeg, placeStone, removeStone, smoothAt } from '../../src/core/tools';
import { freshGarden, record, diff } from './helpers';

describe('annuler / rétablir', () => {
  test('annuler revient exactement au geste précédent, pierres comprises', () => {
    const g = freshGarden();
    const log = record(g);
    const h0 = g.hm.slice();
    pushUndo(g); rakeSeg(g, 10, 10, 300, 200);
    pushUndo(g); placeStone(g, 500, 300, 25);
    expect(undo(g)).toBe(true); expect(g.stones).toHaveLength(0);
    expect(undo(g)).toBe(true); expect(diff(h0, g.hm)).toBe(0);
    expect(undo(g)).toBe(false);
    expect(log.restored).toHaveLength(2);
  });

  test('rétablir refait les gestes annulés, dans l\'ordre', () => {
    const g = freshGarden();
    pushUndo(g); rakeSeg(g, 10, 10, 300, 200);
    const h1 = g.hm.slice();
    pushUndo(g); placeStone(g, 500, 300, 25);
    const h2 = g.hm.slice(), st2 = g.stones.slice();
    undo(g); undo(g);
    expect(canRedo(g)).toBe(true);
    expect(redo(g)).toBe(true); expect(diff(h1, g.hm)).toBe(0); expect(g.stones).toHaveLength(0);
    expect(redo(g)).toBe(true); expect(diff(h2, g.hm)).toBe(0); expect(g.stones).toEqual(st2);
    expect(redo(g)).toBe(false);
  });

  test('un nouveau geste efface ce qui pouvait être rétabli', () => {
    const g = freshGarden();
    pushUndo(g); rakeSeg(g, 10, 10, 300, 200);
    undo(g);
    expect(canRedo(g)).toBe(true);
    pushUndo(g); smoothAt(g, 100, 100, 13);
    expect(canRedo(g)).toBe(false);
    expect(redo(g)).toBe(false);
  });

  test('annuler puis rétablir une pierre retirée', () => {
    const g = freshGarden();
    const s = placeStone(g, 300, 300, 30);
    pushUndo(g); removeStone(g, 0);
    undo(g); expect(g.stones).toEqual([s]); expect(g.mask[150 * g.W + 150]).toBe(1);
    redo(g); expect(g.stones).toHaveLength(0); expect(g.mask[150 * g.W + 150]).toBe(0);
  });

  test('l\'instantané ne bouge pas quand on continue à ratisser', () => {
    const g = freshGarden();
    pushUndo(g);
    const snap = g.undoS[0].h.slice();
    rakeSeg(g, 0, 0, 400, 300);
    expect(diff(snap, g.undoS[0].h)).toBe(0);
  });

  test('annuler et rétablir arrêtent les animations en cours', () => {
    const g = freshGarden();
    pushUndo(g); placeStone(g, 300, 300, 30);
    g.sweep = { y: 3 };
    undo(g);
    expect(g.grow).toHaveLength(0); expect(g.sweep).toBeNull();
    redo(g);
    expect(g.grow).toHaveLength(0);
    expect(g.dirty).toEqual([0, 0, g.W - 1, g.H - 1]);
  });

  test('historique limité aux derniers gestes, dans les deux sens', () => {
    const g = freshGarden();
    for (let k = 0; k < UNDO_MAX + 10; k++) pushUndo(g);
    expect(g.undoS).toHaveLength(UNDO_MAX);
    for (let k = 0; k < UNDO_MAX; k++) undo(g);
    expect(canUndo(g)).toBe(false);
    expect(g.redoS).toHaveLength(UNDO_MAX);
  });

  test('rien à faire sur un jardin neuf', () => {
    const g = freshGarden();
    expect(canUndo(g)).toBe(false); expect(canRedo(g)).toBe(false);
    expect(undo(g)).toBe(false); expect(redo(g)).toBe(false);
  });
});
