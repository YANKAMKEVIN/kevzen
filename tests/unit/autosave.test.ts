import { describe, expect, test } from 'vitest';
import { compose } from '../../src/core/compose';
import { createGarden } from '../../src/core/garden';
import { rakeSeg } from '../../src/core/tools';
import { serializeGarden, restoreGarden, GARDEN_FORMAT, type GardenData } from '../../src/core/serialize';
import { CURRENT_KEY, CURRENT_VERSION, writeCurrent, readCurrent, parseCurrent, clearCurrent } from '../../src/storage/autosave';
import { freshGarden, memStore, blockedStore } from './helpers';

function gardenData(s = 1): GardenData {
  const g = freshGarden(640, 400, s); compose(g); rakeSeg(g, 10, 10, 300, 180);
  return serializeGarden(g);
}

describe('sauvegarde automatique du jardin en cours', () => {
  test('rien de gardé au départ', () => {
    const st = memStore();
    expect(readCurrent(st)).toBeNull();
    expect(st.length).toBe(0);
  });

  test('écrire puis relire : le même jardin, rouvrable', () => {
    const st = memStore(), d = gardenData();
    expect(writeCurrent(st, d, { galleryId: null, now: 1234 })).toBe('ok');
    const e = readCurrent(st);
    expect(e).toEqual({ v: CURRENT_VERSION, savedAt: 1234, galleryId: null, garden: d });
    const g = createGarden();
    expect(restoreGarden(g, e?.garden)).toBe(true);
    expect(serializeGarden(g)).toEqual(d);
  });

  test('garde le jardin de la galerie dont il est la suite', () => {
    const st = memStore();
    writeCurrent(st, gardenData(), { galleryId: 'abcd1234' });
    expect(readCurrent(st)?.galleryId).toBe('abcd1234');
  });

  test('un identifiant de galerie invalide est oublié, pas écrit', () => {
    const st = memStore();
    writeCurrent(st, gardenData(), { galleryId: '../../x' });
    expect(readCurrent(st)?.galleryId).toBeNull();
  });

  test('une seule clé, réécrite à chaque fois (pas d\'accumulation)', () => {
    const st = memStore();
    for (let k = 1; k <= 5; k++) writeCurrent(st, gardenData(k), { galleryId: null, now: k });
    expect([...st.m.keys()]).toEqual([CURRENT_KEY]);
    expect(readCurrent(st)?.savedAt).toBe(5);
  });

  test('quelques kilo-octets seulement', () => {
    const st = memStore();
    writeCurrent(st, gardenData(), { galleryId: null });
    expect((st.m.get(CURRENT_KEY) as string).length).toBeLessThan(40000);
  });

  test('stockage plein : « plein », sans lever, la dernière sauvegarde reste intacte', () => {
    const d1 = gardenData(1), probe = memStore();
    writeCurrent(probe, d1, { galleryId: null, now: 1 });
    const size = CURRENT_KEY.length + (probe.m.get(CURRENT_KEY) as string).length;
    const st = memStore({}, size + 10);
    expect(writeCurrent(st, d1, { galleryId: null, now: 1 })).toBe('ok');
    // un jardin bien plus ratissé ne tient plus
    const g = freshGarden(640, 400, 9); compose(g);
    for (let y = 5; y < 190; y += 3) rakeSeg(g, 5, y, 315, y + 2);
    expect(() => writeCurrent(st, serializeGarden(g), { galleryId: null, now: 2 })).not.toThrow();
    expect(writeCurrent(st, serializeGarden(g), { galleryId: null, now: 2 })).toBe('plein');
    expect(readCurrent(st)).toMatchObject({ savedAt: 1, garden: d1 });
  });

  test('stockage plein dès le départ : rien d\'écrit à moitié', () => {
    const st = memStore({}, 10);
    expect(writeCurrent(st, gardenData(), { galleryId: null })).toBe('plein');
    expect(st.length).toBe(0);
  });

  test('stockage bloqué ou absent : « bloque », sans lever', () => {
    expect(writeCurrent(blockedStore, gardenData(), { galleryId: null })).toBe('bloque');
    expect(writeCurrent(null, gardenData(), { galleryId: null })).toBe('bloque');
    expect(readCurrent(blockedStore)).toBeNull();
    expect(readCurrent(null)).toBeNull();
    expect(() => clearCurrent(blockedStore)).not.toThrow();
  });

  const bad: [string, (e: Record<string, unknown>) => unknown][] = [
    ['JSON cassé', () => '{abîmé'],
    ['tableau', () => '[1,2]'],
    ['sans version', e => JSON.stringify({ ...e, v: undefined })],
    ['version 0', e => JSON.stringify({ ...e, v: 0 })],
    ['version future', e => JSON.stringify({ ...e, v: CURRENT_VERSION + 1 })],
    ['date négative', e => JSON.stringify({ ...e, savedAt: -5 })],
    ['date texte', e => JSON.stringify({ ...e, savedAt: 'hier' })],
    ['galerie invalide', e => JSON.stringify({ ...e, galleryId: 42 })],
    ['jardin manquant', e => JSON.stringify({ ...e, garden: null })],
    ['jardin d\'un format futur', e => JSON.stringify({ ...e, garden: { ...(e.garden as object), format: GARDEN_FORMAT + 1 } })],
    ['pierres abîmées', e => JSON.stringify({ ...e, garden: { ...(e.garden as object), stones: [{ x: 'a' }] } })],
  ];
  test.each(bad)('entrée abîmée (%s) : mise de côté, jamais devinée', (_, mk) => {
    const ok = memStore();
    writeCurrent(ok, gardenData(), { galleryId: null, now: 7 });
    const e = JSON.parse(ok.m.get(CURRENT_KEY) as string) as Record<string, unknown>;
    const text = mk(e) as string;
    const st = memStore({ [CURRENT_KEY]: text });
    expect(parseCurrent(text)).toBeNull();
    expect(readCurrent(st)).toBeNull();
    expect(st.m.get(CURRENT_KEY)).toBeUndefined();
    expect(st.m.get(CURRENT_KEY + '.abimee')).toBe(text);
  });

  test('clearCurrent efface, ou met de côté le texte donné', () => {
    const st = memStore();
    writeCurrent(st, gardenData(), { galleryId: null });
    clearCurrent(st); expect(st.length).toBe(0);
    writeCurrent(st, gardenData(), { galleryId: null });
    clearCurrent(st, 'texte'); expect(st.m.get(CURRENT_KEY + '.abimee')).toBe('texte'); expect(st.m.has(CURRENT_KEY)).toBe(false);
  });
});
