import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { VERSION, MOODS, MOOD_KEYS, KINDS, TINES, TINE_COUNTS, clamp, rng, isMoodKey } from '../../src/core/config';

describe('config', () => {
  test('la version affichée suit package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('clamp borne dans les deux sens', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(13, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
  });

  test('rng : déterministe, dans [0, 1), et deux graines donnent deux suites', () => {
    const a = rng(7), b = rng(7), c = rng(8);
    const sa = Array.from({ length: 200 }, a), sb = Array.from({ length: 200 }, b), sc = Array.from({ length: 200 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    const mean = sa.reduce((x, y) => x + y, 0) / sa.length;
    expect(mean).toBeGreaterThan(.4); expect(mean).toBeLessThan(.6);
  });

  test('chaque lumière est complète et sa gamme reste dans l\'octave', () => {
    expect(Object.keys(MOODS)).toEqual([...MOOD_KEYS]);
    for (const k of MOOD_KEYS) {
      const m = MOODS[k];
      for (const c of [m.sh, m.mid, m.li]) for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255); }
      expect(m.scale[0]).toBe(0);
      expect(m.scale.every(s => s >= 0 && s < 12)).toBe(true);
      expect(m.root).toBeGreaterThan(100);
      expect(['petal', 'leaf', 'fly']).toContain(m.part);
    }
  });

  test('isMoodKey ne reconnaît que les quatre lumières', () => {
    for (const k of MOOD_KEYS) expect(isMoodKey(k)).toBe(true);
    for (const k of ['minuit', '', null, 3, 'constructor']) expect(isMoodKey(k)).toBe(false);
  });

  test('pierres et largeurs de râteau', () => {
    expect(KINDS).toHaveLength(4);
    for (const k of KINDS) for (const c of k) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(TINE_COUNTS).toEqual([3, 5, 8]);
    expect(TINES.map(t => t[1])).toEqual(['Fin', 'Moyen', 'Large']);
  });
});
