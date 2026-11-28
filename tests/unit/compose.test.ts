import { describe, expect, test } from 'vitest';
import { flatRow } from '../../src/core/garden';
import { compose, newGarden, stepSweep } from '../../src/core/compose';
import { undo } from '../../src/core/history';
import { rakeSeg } from '../../src/core/tools';
import { autoStep } from '../../src/core/gardener';
import { freshGarden, record, diff } from './helpers';

describe('composition', () => {
  test('3, 5 ou 7 pierres, dans l\'écran, rejouable avec la même graine', () => {
    const sizes = new Set<number>();
    for (let s = 1; s <= 40; s++) {
      const g = freshGarden(1280, 800, s);
      const n = compose(g);
      expect([3, 5, 7]).toContain(n);
      expect(g.stones.length).toBeGreaterThanOrEqual(2);
      expect(g.stones.length).toBeLessThanOrEqual(n);
      for (const st of g.stones) { expect(st.x).toBeGreaterThan(0); expect(st.x).toBeLessThan(1280); expect(st.y).toBeGreaterThan(0); expect(st.y).toBeLessThan(800); }
      sizes.add(n);
    }
    expect([...sizes].sort()).toEqual([3, 5, 7]);
    const key = (s: number): string => { const g = freshGarden(1280, 800, s); compose(g); return JSON.stringify(g.stones); };
    expect(key(9)).toBe(key(9));
    expect(key(9)).not.toBe(key(10));
  });

  test('aussi sur un petit téléphone', () => {
    for (let s = 1; s <= 20; s++) {
      const g = freshGarden(320, 568, s);
      compose(g);
      expect(g.stones.length).toBeGreaterThanOrEqual(1);
      for (const st of g.stones) { expect(st.x).toBeGreaterThan(0); expect(st.x).toBeLessThan(320); }
    }
  });

  test('la première pierre est la plus grande', () => {
    for (let s = 1; s <= 20; s++) {
      const g = freshGarden(1000, 700, s);
      compose(g);
      const r0 = g.stones[0].r;
      for (const st of g.stones) expect(st.r).toBeLessThanOrEqual(r0);
    }
  });
});

describe('nouveau jardin', () => {
  test('le balayage repasse tout le sable puis s\'arrête', () => {
    const g = freshGarden();
    const log = record(g);
    rakeSeg(g, 10, 10, 390, 290);
    newGarden(g);
    expect(log.newGarden).toHaveLength(1);
    expect(g.sweep).not.toBeNull();
    let k = 0; while (g.sweep && k++ < 1000) stepSweep(g, 1);
    expect(g.sweep).toBeNull();
    expect(k).toBeGreaterThan(10);
    for (let y = 0; y < g.H; y += 37) for (let x = 0; x < g.W; x += 41) {
      const i = y * g.W + x; expect(Math.abs(g.hm[i] - (g.mask[i] ? g.ringT[i] : flatRow(y)))).toBeLessThan(1e-6);
    }
  });

  test('s\'annule : on retrouve les pierres et le sable d\'avant, et le balayage s\'arrête', () => {
    const g = freshGarden();
    compose(g); rakeSeg(g, 10, 10, 390, 290);
    const stones = g.stones.slice(), h = g.hm.slice();
    newGarden(g);
    stepSweep(g, 5);
    expect(undo(g)).toBe(true);
    expect(g.sweep).toBeNull();
    expect(g.stones).toEqual(stones);
    expect(diff(h, g.hm)).toBe(0);
  });

  test('balayage plus rapide quand l\'image est plus longue (dt)', () => {
    const run = (dt: number): number => { const g = freshGarden(); newGarden(g); let n = 0; while (g.sweep && n < 1000) { stepSweep(g, dt); n++; } return n; };
    expect(run(3)).toBeLessThan(run(1));
  });
});

describe('jardinier automatique', () => {
  test('ratisse, joue des notes, reste dans l\'écran, évite les pierres', () => {
    const g = freshGarden(1000, 700, 3);
    compose(g);
    const log = record(g);
    const h0 = g.hm.slice();
    Object.assign(g.ag, { pause: 1, t: 0, s: 5, trav: 0 });
    let moving = 0;
    for (let k = 0; k < 4000; k++) {
      if (autoStep(g, 1, true)) moving++;
      expect(g.ag.x > -40 && g.ag.x < 1040 && g.ag.y > -40 && g.ag.y < 740).toBe(true);
    }
    expect(moving).toBeGreaterThan(1000);
    expect(log.note.length).toBeGreaterThan(20);
    expect(diff(h0, g.hm)).toBeGreaterThan(1000);
    for (const s of g.stones) expect(g.mask[Math.round(s.y / 2) * g.W + Math.round(s.x / 2)]).toBe(1);
  });

  test('déterministe avec une graine', () => {
    const run = (): number[] => {
      const g = freshGarden(900, 600, 11); compose(g);
      Object.assign(g.ag, { pause: 1, t: 0, s: 2, trav: 0, x: 0, y: 0, a: 0 });
      for (let k = 0; k < 1500; k++) autoStep(g, 1, false);
      return [g.ag.x, g.ag.y, g.stones.length, g.hm.reduce((a, b) => a + b, 0)];
    };
    expect(run()).toEqual(run());
  });

  test('pose parfois une pierre, en silence tant qu\'on n\'est pas entré, jamais plus de 6', () => {
    const g = freshGarden(1000, 700, 4);
    const log = record(g);
    Object.assign(g.ag, { pause: 1, t: 0, s: 1 });
    for (let k = 0; k < 40000; k++) autoStep(g, 3, false);
    expect(log.stonePlaced.length).toBeGreaterThan(0);
    expect(log.stonePlaced.every(a => a[1] === true)).toBe(true);
    expect(g.stones.length).toBeLessThanOrEqual(6);
  });

  test('en pause, il ne ratisse pas', () => {
    const g = freshGarden();
    const h = g.hm.slice();
    g.ag.pause = 100;
    expect(autoStep(g, 1, true)).toBe(false);
    expect(diff(h, g.hm)).toBe(0);
  });
});
