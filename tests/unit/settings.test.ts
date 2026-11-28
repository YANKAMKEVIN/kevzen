import { describe, expect, test } from 'vitest';
import { KEY, LEGACY, SAVE_VERSION, defaults, parse, migrate, isValid, load, write, fromLegacy, save, persist } from '../../src/storage/settings';
import { memStore, blockedStore } from './helpers';

describe('réglages (lumière, son)', () => {
  test('les valeurs par défaut sont valides', () => expect(isValid(defaults())).toBe(true));

  test('aller-retour : ce qui est sauvé est relu à l\'identique', () => {
    const st = memStore();
    const d = { ...defaults(), mood: 'nuit' as const, sound: false };
    expect(write(st, d)).toBe(true);
    expect(load(st)).toEqual(d);
  });

  test('sauvegarde absente : valeurs par défaut', () => expect(load(memStore())).toEqual(defaults()));

  test('stockage bloqué (navigation privée) : le jardin s\'ouvre quand même', () => {
    expect(load(blockedStore)).toEqual(defaults());
    expect(write(blockedStore, defaults())).toBe(false);
    expect(load(null)).toEqual(defaults());
    expect(write(null, defaults())).toBe(false);
  });

  test('sous Node (pas de localStorage) : réglages par défaut, écriture refusée sans planter', () => {
    expect(save).toEqual(defaults());
    expect(persist()).toBe(false);
  });

  test('fichier abîmé : mis de côté, jamais écrasé en silence', () => {
    const bad = ['{pas du json', '[]', '"texte"', 'null', '{"version":1}', JSON.stringify({ ...defaults(), mood: 'minuit' }),
      JSON.stringify({ ...defaults(), sound: 'oui' }), JSON.stringify({ ...defaults(), intrus: 1 }), JSON.stringify({ ...defaults(), version: 0 })];
    for (const b of bad) {
      const st = memStore({ [KEY]: b });
      expect(load(st)).toEqual(defaults());
      expect(st.getItem(KEY + '.abimee')).toBe(b);
      expect(st.getItem(KEY)).toBeNull();
    }
  });

  test('sauvegarde d\'une version plus récente : refusée', () => {
    const d = { ...defaults(), version: SAVE_VERSION + 1 };
    expect(migrate(d)).toBeNull();
    expect(parse(JSON.stringify(d))).toBeNull();
    expect(parse(null)).toBeNull();
  });

  test('ancien format (clé « kevzen ») : repris une fois, puis effacé', () => {
    const st = memStore({ [LEGACY]: JSON.stringify({ mood: 'soir', sound: false }), autre: 'garde' });
    const d = load(st);
    expect(d.mood).toBe('soir'); expect(d.sound).toBe(false);
    expect(st.getItem(LEGACY)).toBeNull();
    expect(st.getItem('autre')).toBe('garde');
    expect(JSON.parse(st.getItem(KEY) as string)).toEqual(d);
  });

  test('ancien format abîmé : on garde ce qui est lisible', () => {
    expect(fromLegacy('{pas du json')).toEqual(defaults());
    expect(fromLegacy(null)).toEqual(defaults());
    expect(fromLegacy(JSON.stringify({ mood: 'minuit', sound: false }))).toEqual({ ...defaults(), sound: false });
    expect(fromLegacy(JSON.stringify({ mood: 'midi' }))).toEqual({ ...defaults(), mood: 'midi' });
  });

  test('ancien format avec stockage plein : repris quand même, ancienne clé gardée', () => {
    const st = memStore({ [LEGACY]: JSON.stringify({ mood: 'nuit' }) }, 20);
    expect(load(st).mood).toBe('nuit');
    expect(st.getItem(LEGACY)).not.toBeNull();
  });

  test('on n\'écrit jamais une sauvegarde invalide', () => {
    const st = memStore();
    expect(write(st, { ...defaults(), mood: 'x' } as never)).toBe(false);
    expect(st.getItem(KEY)).toBeNull();
  });
});
