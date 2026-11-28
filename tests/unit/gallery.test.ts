import { describe, expect, test } from 'vitest';
import { compose } from '../../src/core/compose';
import { rakeSeg } from '../../src/core/tools';
import { createGarden } from '../../src/core/garden';
import { serializeGarden, restoreGarden, type GardenData } from '../../src/core/serialize';
import {
  INDEX_KEY, GARDEN_PREFIX, MAX_GARDENS, listGardens, saveGarden, loadGarden, removeGarden, renameGarden, nextName, cleanName,
} from '../../src/storage/gallery';
import { keysWith, safeGet, safeSet, safeRemove, tryParse, quarantine } from '../../src/storage/store';
import { freshGarden, memStore, blockedStore } from './helpers';

const THUMB = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
function gardenData(s = 1): GardenData {
  const g = freshGarden(640, 400, s); compose(g); rakeSeg(g, 10, 10, 300, 180);
  return serializeGarden(g);
}
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { expect(r.ok).toBe(true); return r as Extract<T, { ok: true }>; };

describe('galerie : enregistrer et relire', () => {
  test('galerie vide au départ, sans rien écrire', () => {
    const st = memStore();
    expect(listGardens(st)).toEqual([]);
    expect(st.length).toBe(0);
  });

  test('enregistrer puis rouvrir un jardin identique', () => {
    const st = memStore();
    const d = gardenData();
    const { item } = ok(saveGarden(st, d, { mood: 'soir', thumb: THUMB, now: 1000 }));
    expect(item).toMatchObject({ name: 'Jardin 1', mood: 'soir', createdAt: 1000, updatedAt: 1000, stones: d.stones.length, thumb: THUMB });
    expect(listGardens(st)).toEqual([item]);
    expect(loadGarden(st, item.id)).toEqual(d);
    const g = createGarden();
    expect(restoreGarden(g, loadGarden(st, item.id))).toBe(true);
    expect(serializeGarden(g)).toEqual(d);
  });

  test('plusieurs jardins, du plus récent au plus ancien, noms numérotés', () => {
    const st = memStore();
    for (let k = 1; k <= 3; k++) ok(saveGarden(st, gardenData(k), { mood: 'aube', now: k * 10 }));
    const items = listGardens(st);
    expect(items.map(i => i.name)).toEqual(['Jardin 3', 'Jardin 2', 'Jardin 1']);
    expect(new Set(items.map(i => i.id)).size).toBe(3);
  });

  test('mettre à jour un jardin garde sa date de création et son nom', () => {
    const st = memStore();
    const { item } = ok(saveGarden(st, gardenData(1), { mood: 'aube', name: 'Mon jardin', now: 100 }));
    const d2 = gardenData(2);
    const { item: up } = ok(saveGarden(st, d2, { id: item.id, mood: 'nuit', now: 200 }));
    expect(up).toMatchObject({ id: item.id, name: 'Mon jardin', createdAt: 100, updatedAt: 200, mood: 'nuit' });
    expect(listGardens(st)).toHaveLength(1);
    expect(loadGarden(st, item.id)).toEqual(d2);
  });

  test('mettre à jour un jardin effacé entre-temps : refusé', () => {
    const st = memStore();
    expect(saveGarden(st, gardenData(), { id: 'zzzz1234', mood: 'aube' })).toEqual({ ok: false, reason: 'introuvable' });
  });

  test('galerie limitée à MAX_GARDENS', () => {
    const st = memStore();
    for (let k = 0; k < MAX_GARDENS; k++) ok(saveGarden(st, gardenData(1), { mood: 'aube', now: k }));
    expect(saveGarden(st, gardenData(1), { mood: 'aube' })).toEqual({ ok: false, reason: 'limite' });
    expect(listGardens(st)).toHaveLength(MAX_GARDENS);
  });

  test('renommer : nom nettoyé, vide refusé', () => {
    const st = memStore();
    const { item } = ok(saveGarden(st, gardenData(), { mood: 'aube' }));
    expect(renameGarden(st, item.id, '   Sous   la  lune  ')).toBe(true);
    expect(listGardens(st)[0].name).toBe('Sous la lune');
    expect(renameGarden(st, item.id, '   ')).toBe(false);
    expect(renameGarden(st, 'inconnu1', 'X')).toBe(false);
    expect(renameGarden(st, item.id, 'x'.repeat(100))).toBe(true);
    expect(listGardens(st)[0].name).toHaveLength(40);
  });

  test('effacer un jardin retire ses données', () => {
    const st = memStore();
    const { item } = ok(saveGarden(st, gardenData(1), { mood: 'aube' }));
    ok(saveGarden(st, gardenData(2), { mood: 'aube' }));
    expect(removeGarden(st, item.id)).toBe(true);
    expect(st.getItem(GARDEN_PREFIX + item.id)).toBeNull();
    expect(listGardens(st)).toHaveLength(1);
    expect(removeGarden(st, item.id)).toBe(false);
    expect(removeGarden(st, '../x')).toBe(false);
  });

  test('nextName saute les noms déjà pris', () => {
    const it = (name: string) => ({ id: 'abcd', name, createdAt: 0, updatedAt: 0, mood: 'aube' as const, stones: 0 });
    expect(nextName([])).toBe('Jardin 1');
    expect(nextName([it('Jardin 2')])).toBe('Jardin 3');
    expect(nextName([it('Jardin 2'), it('Jardin 3')])).toBe('Jardin 4');
    expect(cleanName(42)).toBe('');
  });
});

describe('galerie : robustesse', () => {
  test('stockage bloqué : liste vide, enregistrement refusé proprement', () => {
    expect(listGardens(blockedStore)).toEqual([]);
    expect(listGardens(null)).toEqual([]);
    expect(saveGarden(blockedStore, gardenData(), { mood: 'aube' })).toEqual({ ok: false, reason: 'bloque' });
    expect(saveGarden(null, gardenData(), { mood: 'aube' })).toEqual({ ok: false, reason: 'bloque' });
    expect(loadGarden(blockedStore, 'abcd1234')).toBeNull();
    expect(removeGarden(blockedStore, 'abcd1234')).toBe(false);
  });

  test('stockage plein : on réessaie sans vignette', () => {
    const d = gardenData();
    const size = JSON.stringify(d).length;
    const st = memStore({}, size + 1500);
    const { item } = ok(saveGarden(st, d, { mood: 'aube', thumb: THUMB }));
    expect(item.thumb).toBeUndefined();
    expect(loadGarden(st, item.id)).toEqual(d);
  });

  test('stockage plein : rien n\'est à moitié écrit, l\'ancien jardin reste intact', () => {
    const st = memStore({}, 100);
    expect(saveGarden(st, gardenData(), { mood: 'aube' })).toEqual({ ok: false, reason: 'plein' });
    expect(st.length).toBe(0);
    const big = memStore();
    const { item } = ok(saveGarden(big, gardenData(1), { mood: 'aube' }));
    const before = new Map(big.m);
    // l'index ne peut plus grandir : la mise à jour est annulée
    const tight = memStore(Object.fromEntries(before), [...before].reduce((n, [k, v]) => n + k.length + v.length, 0) + 10);
    const res = saveGarden(tight, gardenData(1), { id: item.id, mood: 'nuit', name: 'Un nom bien plus long que le premier' });
    expect(res.ok).toBe(false);
    expect(new Map(tight.m)).toEqual(before);
  });

  test('index abîmé : mis de côté et reconstruit à partir des jardins', () => {
    const st = memStore();
    const a = ok(saveGarden(st, gardenData(1), { mood: 'midi', name: 'Alpha', thumb: THUMB, now: 5 })).item;
    const b = ok(saveGarden(st, gardenData(2), { mood: 'nuit', name: 'Beta', now: 9 })).item;
    for (const bad of ['{abîmé', '[]', '{"version":9,"items":[]}', '{"version":1,"items":[{"id":"x"}]}']) {
      st.setItem(INDEX_KEY, bad);
      const items = listGardens(st);
      expect(items.map(i => i.name)).toEqual(['Beta', 'Alpha']);
      expect(items.map(i => i.id)).toEqual([b.id, a.id]);
      expect(items[1].thumb).toBeUndefined();
      expect(st.getItem(INDEX_KEY + '.abimee')).toBe(bad);
      expect(tryParse(st.getItem(INDEX_KEY))).toMatchObject({ version: 1 });
    }
  });

  test('index perdu : reconstruit (les jardins ne disparaissent pas)', () => {
    const st = memStore();
    ok(saveGarden(st, gardenData(1), { mood: 'aube', name: 'Seul' }));
    st.removeItem(INDEX_KEY);
    expect(listGardens(st).map(i => i.name)).toEqual(['Seul']);
    expect(st.getItem(INDEX_KEY)).not.toBeNull();
  });

  test('jardin abîmé : mis de côté, retiré de la galerie, les autres intacts', () => {
    const st = memStore();
    const a = ok(saveGarden(st, gardenData(1), { mood: 'aube' })).item;
    const b = ok(saveGarden(st, gardenData(2), { mood: 'aube' })).item;
    st.setItem(GARDEN_PREFIX + a.id, '{"v":1,"name":"A","garden":{"format":1}}');
    expect(loadGarden(st, a.id)).toBeNull();
    expect(st.getItem(GARDEN_PREFIX + a.id + '.abimee')).toContain('"format":1');
    expect(listGardens(st).map(i => i.id)).toEqual([b.id]);
    expect(loadGarden(st, b.id)).not.toBeNull();
  });

  test('jardin d\'un format futur : refusé (jamais deviné)', () => {
    const st = memStore();
    const a = ok(saveGarden(st, gardenData(1), { mood: 'aube' })).item;
    const e = JSON.parse(st.getItem(GARDEN_PREFIX + a.id) as string);
    e.garden.format = 99;
    st.setItem(GARDEN_PREFIX + a.id, JSON.stringify(e));
    expect(loadGarden(st, a.id)).toBeNull();
  });

  test('entrée d\'index dont le jardin a disparu : oubliée', () => {
    const st = memStore();
    const a = ok(saveGarden(st, gardenData(1), { mood: 'aube' })).item;
    ok(saveGarden(st, gardenData(2), { mood: 'aube' }));
    st.removeItem(GARDEN_PREFIX + a.id);
    expect(listGardens(st)).toHaveLength(1);
    expect(loadGarden(st, a.id)).toBeNull();
  });

  test('identifiant douteux : jamais utilisé comme clé', () => {
    const st = memStore({ [GARDEN_PREFIX + 'A B']: '{}' });
    expect(loadGarden(st, 'A B')).toBeNull();
    expect(listGardens(st)).toEqual([]);
  });
});

describe('stockage prudent', () => {
  test('les accès bloqués ne lèvent jamais', () => {
    expect(safeGet(blockedStore, 'a')).toBeNull();
    expect(safeSet(blockedStore, 'a', 'b')).toBe(false);
    expect(() => safeRemove(blockedStore, 'a')).not.toThrow();
    expect(keysWith(blockedStore, 'k')).toEqual([]);
    expect(() => quarantine(blockedStore, 'a', 'b')).not.toThrow();
    expect(safeGet(null, 'a')).toBeNull();
  });

  test('keysWith filtre par préfixe ; tryParse renvoie undefined sur du texte illisible', () => {
    const st = memStore({ 'kevzen.jardin.a': '1', 'kevzen.jardin.b': '2', autre: '3' });
    expect(keysWith(st, 'kevzen.jardin.').sort()).toEqual(['kevzen.jardin.a', 'kevzen.jardin.b']);
    expect(tryParse('{x')).toBeUndefined();
    expect(tryParse(null)).toBeUndefined();
    expect(tryParse('{"a":1}')).toEqual({ a: 1 });
  });
});
