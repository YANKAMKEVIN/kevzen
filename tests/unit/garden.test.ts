import { describe, expect, test } from 'vitest';
import { createGarden, allocate, markDirty, markAll, flatRow, gridSize, fillFlat, buildMask, ringR, type Stone } from '../../src/core/garden';
import { C, SP, RINGS } from '../../src/core/config';
import { rakeSeg } from '../../src/core/tools';
import { freshGarden } from './helpers';

const stone = (x: number, y: number, r: number): Stone => ({ x, y, r, e: 1.1, rot: 0, kind: 0, moss: false, seed: 1, pts: [[0, 0], [1, 0], [0, 1]] });

describe('grille de sable', () => {
  test('la grille couvre l\'écran et part ratissée droit', () => {
    const g = freshGarden(800, 600);
    expect([g.W, g.H]).toEqual([401, 301]);
    expect(gridSize(800, 600)).toEqual([401, 301]);
    expect(g.hm.length).toBe(g.W * g.H);
    for (const y of [0, 7, 150]) expect(Math.abs(g.hm[y * g.W + 33] - flatRow(y))).toBeLessThan(1e-6);
  });

  test('un jardin neuf est vide et sans taille', () => {
    const g = createGarden();
    expect([g.W, g.H, g.stones.length, g.undoS.length, g.redoS.length]).toEqual([0, 0, 0, 0, 0]);
    expect(g.tines).toBe(5);
  });

  test('flatRow : des sillons réguliers de période SP', () => {
    for (let y = 0; y < 20; y++) expect(flatRow(y)).toBeCloseTo(flatRow(y + SP), 9);
    expect(flatRow(0)).toBeCloseTo(-1, 9);
  });

  test('redimensionner garde le sable déjà dessiné et vide l\'historique', () => {
    const g = freshGarden(400, 300);
    rakeSeg(g, 20, 20, 120, 80);
    const v = g.hm[50 * g.W + 70];
    g.undoS.push({ h: g.hm.slice(), st: [] });
    expect(allocate(g, 400, 300)).toBe(false);
    expect(g.undoS).toHaveLength(1);
    expect(allocate(g, 600, 500)).toBe(true);
    expect(g.hm[50 * g.W + 70]).toBe(v);
    expect(g.undoS).toHaveLength(0);
  });

  test('rétrécir garde le coin haut gauche', () => {
    const g = freshGarden(600, 400);
    rakeSeg(g, 10, 10, 60, 40);
    const v = g.hm[20 * g.W + 30];
    allocate(g, 200, 150);
    expect(g.W).toBe(101);
    expect(g.hm[20 * g.W + 30]).toBe(v);
  });

  test('zone à redessiner : union des rectangles, bornée à la grille', () => {
    const g = freshGarden(200, 200);
    markDirty(g, 10, 10, 20, 20);
    markDirty(g, 5, 15, 12, 40);
    expect(g.dirty).toEqual([5, 10, 20, 40]);
    markDirty(g, -50, -50, 1e4, 1e4);
    expect(g.dirty).toEqual([0, 0, g.W - 1, g.H - 1]);
    g.dirty = null; markDirty(g, 500, 500, 600, 600);
    expect(g.dirty).toBeNull();
    markAll(g); expect(g.dirty).toEqual([0, 0, g.W - 1, g.H - 1]);
  });

  test('le masque couvre la pierre et ses RINGS cercles, pas plus', () => {
    const g = freshGarden();
    g.stones = [stone(400, 300, 30)];
    buildMask(g);
    const s = g.stones[0], cx = s.x / C, cy = s.y / C, Z = ringR(s) + RINGS * SP;
    expect(g.mask[cy * g.W + cx]).toBe(1);
    expect(g.ringT[cy * g.W + cx]).toBeCloseTo(.35, 6);
    expect(g.mask[cy * g.W + cx + Math.floor(Z) - 1]).toBe(1);
    expect(g.mask[cy * g.W + cx + Math.ceil(Z) + 2]).toBe(0);
    let n = 0; for (const v of g.mask) n += v;
    expect(n).toBeGreaterThan(Math.PI * (Z - 1) ** 2 * .9);
    expect(n).toBeLessThan(Math.PI * (Z + 1) ** 2 * 1.1);
  });

  test('une pierre au bord de l\'écran ne déborde pas de la grille', () => {
    const g = freshGarden(300, 200);
    g.stones = [stone(2, 2, 40), stone(299, 199, 40)];
    expect(() => buildMask(g)).not.toThrow();
    expect(g.mask.length).toBe(g.W * g.H);
    expect(g.mask[0]).toBe(1);
  });

  test('fillFlat remet le sable droit et les cercles autour des pierres', () => {
    const g = freshGarden(400, 300);
    rakeSeg(g, 0, 0, 200, 150);
    g.stones = [stone(200, 150, 20)];
    buildMask(g); fillFlat(g);
    for (let i = 0; i < g.hm.length; i += 97) {
      const y = Math.floor(i / g.W);
      expect(g.hm[i]).toBeCloseTo(g.mask[i] ? g.ringT[i] : flatRow(y), 6);
    }
  });
});
