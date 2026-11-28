import { describe, expect, test } from 'vitest';
import { C, SP, KINDS } from '../../src/core/config';
import { ringR } from '../../src/core/garden';
import { rakeSeg, smoothAt, makeStone, placeStone, stoneAt, removeStone, randomRadius, stepGrow } from '../../src/core/tools';
import { freshGarden, record, diff, changedCells } from './helpers';

describe('râteau', () => {
  test('creuse des sillons sur son passage, et seulement là', () => {
    const g = freshGarden();
    const before = g.hm.slice();
    rakeSeg(g, 50, 100, 350, 200);
    expect(diff(before, g.hm)).toBeGreaterThan(100);
    for (const [x, y] of [[200, 20], [200, 280], [10, 10]]) expect(g.hm[y * g.W + x]).toBe(before[y * g.W + x]);
    expect(g.dirty).not.toBeNull();
  });

  test('la zone à redessiner contient tout le sable modifié', () => {
    const g = freshGarden();
    const before = g.hm.slice();
    rakeSeg(g, 100, 80, 220, 160);
    const d = g.dirty as number[];
    for (let i = 0; i < g.hm.length; i++) if (g.hm[i] !== before[i]) {
      const x = i % g.W, y = (i / g.W) | 0;
      expect(x >= d[0] && x <= d[2] && y >= d[1] && y <= d[3]).toBe(true);
    }
  });

  test('un râteau plus large marque une bande plus large', () => {
    const touched = (tines: number): number => { const g = freshGarden(); g.tines = tines; const b = g.hm.slice(); rakeSeg(g, 100, 50, 300, 250); return changedCells(b, g.hm); };
    const fin = touched(3), moyen = touched(5), large = touched(8);
    expect(moyen).toBeGreaterThan(fin);
    expect(large).toBeGreaterThan(fin * 2);
  });

  test('un trait de longueur nulle ne fait rien', () => {
    const g = freshGarden();
    const b = g.hm.slice();
    rakeSeg(g, 100, 100, 100, 100);
    expect(diff(b, g.hm)).toBe(0);
    expect(g.dirty).toBeNull();
  });

  test('ratisser hors de l\'écran ne plante pas et ne touche rien', () => {
    const g = freshGarden(200, 200);
    const b = g.hm.slice();
    expect(() => rakeSeg(g, -500, -500, -300, -400)).not.toThrow();
    expect(diff(b, g.hm)).toBe(0);
  });

  test('ratisser deux fois au même endroit creuse des sillons stables (pas de dérive)', () => {
    const g = freshGarden();
    for (let k = 0; k < 40; k++) rakeSeg(g, 50, 150, 350, 150);
    let max = 0; for (const v of g.hm) max = Math.max(max, Math.abs(v));
    expect(max).toBeLessThanOrEqual(1.0001);
  });
});

describe('lisser', () => {
  test('aplatit le sable au centre', () => {
    const g = freshGarden();
    const i = 150 * g.W + 200, v = Math.abs(g.hm[i]);
    for (let k = 0; k < 30; k++) smoothAt(g, 200, 150, 13);
    expect(Math.abs(g.hm[i])).toBeLessThan(v * .01 + 1e-6);
  });

  test('ne touche pas au-delà de son rayon', () => {
    const g = freshGarden();
    const b = g.hm.slice();
    smoothAt(g, 200, 150, 13);
    expect(g.hm[150 * g.W + 230]).toBe(b[150 * g.W + 230]);
  });

  test('ne touche pas aux cercles des pierres', () => {
    const g = freshGarden();
    const s = placeStone(g, 400, 300, 30, true);
    for (let k = 0; k < 60 && g.grow.length; k++) stepGrow(g, 1);
    const i = Math.round(s.y / C) * g.W + Math.round(s.x / C) + Math.round(ringR(s) + SP);
    const v = g.hm[i];
    for (let k = 0; k < 10; k++) smoothAt(g, Math.round(s.x / C) + Math.round(ringR(s) + SP), Math.round(s.y / C), 13);
    expect(g.hm[i]).toBe(v);
  });
});

describe('pierres', () => {
  test('forme irrégulière, fermée, déterministe avec la graine', () => {
    const a = makeStone(freshGarden(800, 600, 3), 100, 100, 30);
    const b = makeStone(freshGarden(800, 600, 3), 100, 100, 30);
    expect(a).toEqual(b);
    expect(a.pts).toHaveLength(16);
    expect(a.kind).toBeGreaterThanOrEqual(0); expect(a.kind).toBeLessThan(KINDS.length);
    for (const [px, py] of a.pts) { const d = Math.hypot(px, py); expect(d).toBeGreaterThan(30 * .7); expect(d).toBeLessThan(30 * 1.6); }
  });

  test('une forme imposée garde son type', () => {
    expect(makeStone(freshGarden(), 50, 50, 20, 2).kind).toBe(2);
  });

  test('cercles tracés peu à peu, protégés du râteau, retrait possible', () => {
    const g = freshGarden();
    const log = record(g);
    const s = placeStone(g, 400, 300, 30);
    expect(log.stonePlaced).toEqual([[s, false]]);
    expect(g.stones).toHaveLength(1);
    const cx = Math.round(s.x / C), cy = Math.round(s.y / C), ring = Math.round(ringR(s) + SP * 1.5);
    const i = cy * g.W + cx + ring;
    expect(g.mask[i]).toBe(1);
    let steps = 0;
    while (g.grow.length && steps < 100) { stepGrow(g, 1); steps++; }
    expect(g.grow).toHaveLength(0);
    expect(steps).toBeGreaterThan(10);
    expect(Math.abs(g.hm[i] - g.ringT[i])).toBeLessThan(.05);
    const v = g.hm[i];
    rakeSeg(g, cx - 60, cy, cx + 60, cy);
    expect(g.hm[i]).toBe(v);
    expect(stoneAt(g, 400, 300)).toBe(0);
    expect(stoneAt(g, 10, 10)).toBe(-1);
    removeStone(g, 0);
    expect(g.stones).toHaveLength(0);
    expect(log.stoneRemoved).toHaveLength(1);
    expect(g.mask[i]).toBe(0);
    expect(Math.abs(g.hm[i])).toBeLessThanOrEqual(Math.abs(v) * .25 + 1e-6);
  });

  test('pierre posée en silence par le jardinier', () => {
    const g = freshGarden();
    const log = record(g);
    placeStone(g, 100, 100, 20, true);
    expect(log.stonePlaced[0][1]).toBe(true);
  });

  test('stoneAt choisit la pierre du dessus quand deux se chevauchent', () => {
    const g = freshGarden();
    placeStone(g, 300, 300, 30); placeStone(g, 310, 300, 30);
    expect(stoneAt(g, 305, 300)).toBe(1);
  });

  test('retirer une pierre absente ne fait rien', () => {
    const g = freshGarden();
    const log = record(g);
    expect(() => removeStone(g, 5)).not.toThrow();
    expect(log.stoneRemoved).toHaveLength(0);
  });

  test('une pierre retirée pendant que ses cercles poussent arrête de pousser', () => {
    const g = freshGarden();
    placeStone(g, 300, 300, 30);
    removeStone(g, 0);
    stepGrow(g, 1);
    expect(g.grow).toHaveLength(0);
  });

  test('taille au hasard bornée entre 13 et 50 pixels', () => {
    for (const [w, h] of [[320, 568], [1280, 800], [3840, 2160]]) {
      const g = freshGarden(w, h, w);
      for (let k = 0; k < 50; k++) { const r = randomRadius(g); expect(r).toBeGreaterThanOrEqual(13); expect(r).toBeLessThanOrEqual(50); }
    }
  });
});
