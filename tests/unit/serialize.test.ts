import { describe, expect, test } from 'vitest';
import { createGarden } from '../../src/core/garden';
import { compose } from '../../src/core/compose';
import { rakeSeg, placeStone, stepGrow } from '../../src/core/tools';
import { canUndo, undo } from '../../src/core/history';
import {
  GARDEN_FORMAT, QUANT, encodeSand, decodeSand, bytesToBase64, base64ToBytes, serializeGarden, restoreGarden,
  isGardenData, migrateGarden, resample,
} from '../../src/core/serialize';
import { freshGarden, record } from './helpers';

/** Un jardin bien vivant : composé, ratissé, une pierre posée. */
function livedIn(vw = 800, vh = 600, s = 5) {
  const g = freshGarden(vw, vh, s);
  compose(g);
  rakeSeg(g, 20, 40, 380, 60); rakeSeg(g, 380, 60, 100, 250);
  placeStone(g, vw * .7, vh * .3, 22, true);
  while (g.grow.length) stepGrow(g, 1);
  g.tines = 8;
  return g;
}
const maxErr = (a: Float32Array, b: Float32Array): number => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

describe('sable compressé', () => {
  test('un sable jamais touché tient en quelques octets', () => {
    const g = freshGarden(1280, 800);
    const b = encodeSand(g.hm, g.W, g.H);
    expect(b.length).toBeLessThan(200);
    const back = decodeSand(b, g.W, g.H) as Float32Array;
    expect(maxErr(back, g.hm)).toBeLessThan(1e-6);
  });

  test('aller-retour à 1/QUANT près', () => {
    const g = livedIn();
    const back = decodeSand(encodeSand(g.hm, g.W, g.H), g.W, g.H) as Float32Array;
    expect(maxErr(back, g.hm)).toBeLessThanOrEqual(.5 / QUANT + 1e-6);
  });

  test('longues suites de zéros découpées (plus de 16 383 cases)', () => {
    const W = 300, H = 200, hm = decodeSand(Int8Array.from([]), 1, 1);
    expect(hm).toBeNull();
    const g = freshGarden(W * 2, H * 2);
    g.hm[g.hm.length - 1] += 1;
    const b = encodeSand(g.hm, g.W, g.H);
    const back = decodeSand(b, g.W, g.H) as Float32Array;
    expect(maxErr(back, g.hm)).toBeLessThan(.5 / QUANT + 1e-6);
  });

  test('données tronquées, trop longues ou d\'une autre taille : refusées', () => {
    const g = livedIn();
    const b = encodeSand(g.hm, g.W, g.H);
    expect(decodeSand(b.subarray(0, b.length - 3), g.W, g.H)).toBeNull();
    expect(decodeSand(Int8Array.from([...b, 5]), g.W, g.H)).toBeNull();
    expect(decodeSand(b, g.W + 1, g.H)).toBeNull();
    expect(decodeSand(Int8Array.from([-128, 0, 0]), 1, 1)).toBeNull();
  });

  test('base64 aller-retour, y compris les octets négatifs', () => {
    const b = Int8Array.from([-128, -1, 0, 1, 127, -64, 33]);
    expect(Array.from(base64ToBytes(bytesToBase64(b)) as Int8Array)).toEqual(Array.from(b));
    expect(base64ToBytes('@@pas du base64@@')).toBeNull();
  });
});

describe('jardin sérialisé', () => {
  test('JSON valide, versionné, compact', () => {
    const g = livedIn(1280, 800);
    const d = serializeGarden(g);
    expect(d.format).toBe(GARDEN_FORMAT);
    expect(isGardenData(d)).toBe(true);
    const text = JSON.stringify(d);
    expect(isGardenData(JSON.parse(text))).toBe(true);
    expect(text.length).toBeLessThan(120_000);
  });

  test('aller-retour : pierres, largeur du râteau et sable retrouvés', () => {
    const g = livedIn();
    const d = JSON.parse(JSON.stringify(serializeGarden(g)));
    const h = createGarden();
    const log = record(h);
    expect(restoreGarden(h, d)).toBe(true);
    expect([h.vw, h.vh, h.W, h.H, h.tines]).toEqual([g.vw, g.vh, g.W, g.H, 8]);
    expect(h.stones).toHaveLength(g.stones.length);
    h.stones.forEach((s, i) => { expect(s.x).toBeCloseTo(g.stones[i].x, 1); expect(s.kind).toBe(g.stones[i].kind); expect(s.pts).toHaveLength(16); });
    expect(maxErr(h.hm, g.hm)).toBeLessThanOrEqual(.5 / QUANT + 1e-6);
    expect(log.restored).toEqual([['open']]);
    expect(h.dirty).toEqual([0, 0, h.W - 1, h.H - 1]);
  });

  test('sérialiser deux fois donne le même texte (stable)', () => {
    const g = livedIn();
    const a = JSON.stringify(serializeGarden(g));
    const h = createGarden(); restoreGarden(h, JSON.parse(a));
    expect(JSON.stringify(serializeGarden(h))).toBe(JSON.stringify(serializeGarden(h)));
    expect(serializeGarden(h).stones).toEqual(serializeGarden(g).stones);
  });

  test('ouvrir sur un écran d\'une autre taille : pierres replacées à l\'échelle', () => {
    const g = livedIn(1200, 800);
    const d = serializeGarden(g);
    const h = freshGarden(600, 400);
    expect(restoreGarden(h, d)).toBe(true);
    expect([h.vw, h.W]).toEqual([600, 301]);
    h.stones.forEach((s, i) => { expect(s.x).toBeCloseTo(g.stones[i].x / 2, 0); expect(s.y).toBeCloseTo(g.stones[i].y / 2, 0); });
    expect(h.hm.length).toBe(h.W * h.H);
    for (const s of h.stones) expect(h.mask[Math.round(s.y / 2) * h.W + Math.round(s.x / 2)]).toBe(1);
  });

  test('ouvrir un jardin dans un jardin en cours s\'annule', () => {
    const g = livedIn();
    const d = serializeGarden(g);
    const h = freshGarden(800, 600, 99); compose(h);
    const before = h.stones.slice();
    expect(restoreGarden(h, d)).toBe(true);
    expect(canUndo(h)).toBe(true);
    undo(h);
    expect(h.stones).toEqual(before);
  });

  test('données abîmées : refusées sans rien toucher', () => {
    const g = livedIn();
    const good = serializeGarden(g);
    const bad: unknown[] = [null, 3, 'texte', [], {}, { ...good, format: GARDEN_FORMAT + 1 }, { ...good, format: 0 },
      { ...good, tines: 4 }, { ...good, W: -1 }, { ...good, vw: Infinity }, { ...good, stones: 'non' },
      { ...good, stones: [{ ...good.stones[0], kind: 9 }] }, { ...good, stones: [{ ...good.stones[0], pts: [[0, 0]] }] },
      { ...good, stones: [{ ...good.stones[0], x: 'a' }] }, { ...good, sand: 42 }, { ...good, sand: '@@@' },
      { ...good, sand: bytesToBase64(Int8Array.from([1, 2, 3])) }];
    const h = freshGarden(800, 600, 1); compose(h);
    const snap = JSON.stringify(serializeGarden(h));
    for (const b of bad) {
      expect(restoreGarden(h, b)).toBe(false);
      expect(JSON.stringify(serializeGarden(h))).toBe(snap);
    }
    expect(h.undoS).toHaveLength(0);
  });

  test('migrateGarden : format courant accepté (copie), futur refusé', () => {
    const d = serializeGarden(livedIn());
    const m = migrateGarden(d);
    expect(m).toEqual(d);
    expect(m).not.toBe(d);
    expect(migrateGarden({ ...d, format: 2 })).toBeNull();
    expect(migrateGarden({ ...d, format: 1.5 })).toBeNull();
  });

  test('resample : même taille = même tableau ; sinon taille cible et sillons alignés', () => {
    const g = livedIn(400, 300);
    expect(resample(g.hm, g.W, g.H, g.W, g.H)).toBe(g.hm);
    const out = resample(g.hm, g.W, g.H, 51, 41);
    expect(out.length).toBe(51 * 41);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });
});
