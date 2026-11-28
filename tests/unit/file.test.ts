import { describe, expect, test } from 'vitest';
import { compose } from '../../src/core/compose';
import { createGarden } from '../../src/core/garden';
import { rakeSeg } from '../../src/core/tools';
import { serializeGarden, restoreGarden, bytesToBase64, GARDEN_FORMAT, type GardenData } from '../../src/core/serialize';
import {
  exportGarden, parseGardenFile, fileName, FILE_APP, FILE_KIND, FILE_VERSION, FILE_MAX_BYTES, DEFAULT_NAME, MAX_CELLS,
} from '../../src/storage/file';
import { freshGarden } from './helpers';

function gardenData(s = 1): GardenData {
  const g = freshGarden(640, 400, s); compose(g); rakeSeg(g, 10, 10, 300, 180);
  return serializeGarden(g);
}
const good = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...JSON.parse(exportGarden(gardenData(), { name: 'Jardin du matin', mood: 'soir', now: 0 })), ...over });
const reason = (text: unknown): string => { const r = parseGardenFile(text); return r.ok ? 'ok' : r.reason; };

describe('export d\'un jardin en fichier', () => {
  test('format versionné, qui dit d\'où il vient', () => {
    const d = gardenData();
    const f = JSON.parse(exportGarden(d, { name: '  Jardin   du matin ', mood: 'nuit', now: Date.UTC(2026, 10, 28) }));
    expect(f).toEqual({ app: FILE_APP, kind: FILE_KIND, version: FILE_VERSION, name: 'Jardin du matin', mood: 'nuit', exportedAt: '2026-11-28T00:00:00.000Z', garden: d });
  });

  test('sans nom : « Mon jardin »', () => {
    expect(JSON.parse(exportGarden(gardenData(), { mood: 'aube' })).name).toBe('Mon jardin');
  });

  test('aller-retour : exporter puis importer rend le même jardin, la même lumière et le nom', () => {
    const d = gardenData(3);
    const r = parseGardenFile(exportGarden(d, { name: 'Pluie', mood: 'midi' }));
    expect(r).toEqual({ ok: true, name: 'Pluie', mood: 'midi', garden: d });
    const g = createGarden();
    expect(restoreGarden(g, r.ok ? r.garden : null)).toBe(true);
    expect(serializeGarden(g)).toEqual(d);
  });

  test('nom de fichier sûr : accents, espaces, signes', () => {
    expect(fileName('Jardin du matin')).toBe('jardin-du-matin.kevzen.json');
    expect(fileName('Été à Kyōto !')).toBe('ete-a-kyoto.kevzen.json');
    expect(fileName('../../etc/passwd')).toBe('etc-passwd.kevzen.json');
    expect(fileName('***')).toBe('jardin.kevzen.json');
    expect(fileName('x'.repeat(100)).length).toBeLessThanOrEqual(40 + '.kevzen.json'.length);
  });
});

describe('import : validation stricte', () => {
  test('un fichier exporté est accepté', () => { expect(reason(good())).toBe('ok'); });

  test('nom manquant ou vide : « Jardin importé » ; nom trop long : coupé', () => {
    const a = parseGardenFile(good({ name: undefined })), b = parseGardenFile(good({ name: '   ' })), c = parseGardenFile(good({ name: 'n'.repeat(90) }));
    expect(a.ok && a.name).toBe(DEFAULT_NAME); expect(b.ok && b.name).toBe(DEFAULT_NAME); expect(c.ok && c.name.length).toBe(40);
  });

  test('vide', () => {
    expect(reason('')).toBe('vide'); expect(reason('   \n')).toBe('vide');
    expect(reason(undefined)).toBe('vide'); expect(reason(42)).toBe('vide');
  });

  test('trop gros (avant même de lire le JSON)', () => { expect(reason(' '.repeat(10) + 'x'.repeat(FILE_MAX_BYTES))).toBe('trop-gros'); });

  test.each([['{abîmé'], ['{"app":"kevzen"'], ['<html></html>'], ['\u0000\u0001PNG']])('illisible : %j', t => { expect(reason(t)).toBe('illisible'); });

  test.each([
    ['nombre', '42'], ['texte', '"jardin"'], ['null', 'null'], ['tableau', '[1,2,3]'], ['objet quelconque', '{"a":1}'],
    ['autre appli', good({ app: 'kevzon' })], ['autre sorte', good({ kind: 'reglages' })], ['sans appli', good({ app: undefined })],
  ])('étranger : %s', (_, t) => { expect(reason(t)).toBe('etranger'); });

  test('version plus récente : refusée avec un message dédié', () => {
    expect(reason(good({ version: FILE_VERSION + 1 }))).toBe('trop-recent');
    expect(reason(good({ version: 99 }))).toBe('trop-recent');
  });

  const d = gardenData();
  test.each([
    ['version 0', { version: 0 }], ['version négative', { version: -1 }], ['version décimale', { version: 1.5 }], ['version texte', { version: '1' }],
    ['lumière inconnue', { mood: 'minuit' }], ['lumière absente', { mood: undefined }], ['nom non texte', { name: 12 }],
    ['jardin absent', { garden: undefined }], ['jardin tableau', { garden: [] }],
    ['jardin d\'un format futur', { garden: { ...d, format: GARDEN_FORMAT + 1 } }],
    ['pierre hors norme', { garden: { ...d, stones: [{ ...d.stones[0], r: 9999 }] } }],
    ['trop de pierres', { garden: { ...d, stones: Array(201).fill(d.stones[0]) } }],
    ['largeur de râteau inconnue', { garden: { ...d, tines: 4 } }],
    ['grille incohérente avec l\'écran', { garden: { ...d, W: d.W + 1 } }],
    ['écran géant (grille démesurée)', { garden: { ...d, vw: 19999, vh: 19999, W: 10001, H: 10001 } }],
    ['sable pas en base64', { garden: { ...d, sand: '%%%' } }],
    ['sable tronqué', { garden: { ...d, sand: d.sand.slice(0, 8) } }],
    ['sable trop long', { garden: { ...d, sand: bytesToBase64(Int8Array.from([...atobBytes(d.sand), 5, 5, 5])) } }],
    ['sable vide', { garden: { ...d, sand: '' } }],
    ['sable non texte', { garden: { ...d, sand: 5 } }],
  ])('abîmé : %s', (_, over) => { expect(reason(good(over as Record<string, unknown>))).toBe('abime'); });

  test('le plafond de grille couvre un écran 8K', () => { expect(MAX_CELLS).toBeGreaterThan(3841 * 2161); });

  test('importer ne touche pas au jardin affiché tant que tout n\'est pas vérifié', () => {
    const g = freshGarden(640, 400, 2); compose(g);
    const before = JSON.stringify(serializeGarden(g));
    parseGardenFile(good({ garden: { ...d, sand: d.sand.slice(0, 8) } }));
    expect(JSON.stringify(serializeGarden(g))).toBe(before);
  });
});

function atobBytes(s: string): number[] { return [...atob(s)].map(c => (c.charCodeAt(0) << 24) >> 24); }
