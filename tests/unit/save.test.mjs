import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY, LEGACY, SAVE_VERSION, defaults, parse, migrate, isValid, load, write, fromLegacy } from '../../src/save.js';
import { memStore } from './helpers.mjs';

test('les valeurs par défaut sont valides', () => assert.ok(isValid(defaults())));

test('aller-retour : ce qui est sauvé est relu à l\'identique', () => {
  const st = memStore(); const d = { ...defaults(), mood: 'nuit', sound: false };
  assert.ok(write(st, d));
  assert.deepEqual(load(st), d);
});

test('sauvegarde absente : valeurs par défaut', () => assert.deepEqual(load(memStore()), defaults()));

test('stockage bloqué (navigation privée) : le jardin s\'ouvre quand même', () => {
  const blocked = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); }, removeItem() {}, key() { throw new Error('bloqué'); }, length: 0 };
  assert.deepEqual(load(blocked), defaults());
  assert.equal(write(blocked, defaults()), false);
  assert.deepEqual(load(null), defaults());
});

test('fichier abîmé : mis de côté, jamais écrasé en silence', () => {
  const bad = ['{pas du json', '[]', '"texte"', '{"version":1}', JSON.stringify({ ...defaults(), mood: 'minuit' }),
    JSON.stringify({ ...defaults(), sound: 'oui' }), JSON.stringify({ ...defaults(), intrus: 1 })];
  for (const b of bad) {
    const st = memStore({ [KEY]: b });
    assert.deepEqual(load(st), defaults(), b);
    assert.equal(st.getItem(KEY + '.abimee'), b);
    assert.equal(st.getItem(KEY), null);
  }
});

test('sauvegarde d\'une version plus récente : refusée', () => {
  const d = { ...defaults(), version: SAVE_VERSION + 1 };
  assert.equal(migrate(d), null);
  assert.equal(parse(JSON.stringify(d)), null);
});

test('ancien format (clé « kevzen ») : repris une fois, puis effacé', () => {
  const st = memStore({ [LEGACY]: JSON.stringify({ mood: 'soir', sound: false }), autre: 'garde' });
  const d = load(st);
  assert.equal(d.mood, 'soir'); assert.equal(d.sound, false);
  assert.equal(st.getItem(LEGACY), null);
  assert.equal(st.getItem('autre'), 'garde');
  assert.deepEqual(JSON.parse(st.getItem(KEY)), d);
});

test('ancien format abîmé : on garde ce qui est lisible', () => {
  assert.deepEqual(fromLegacy('{pas du json'), defaults());
  assert.deepEqual(fromLegacy(JSON.stringify({ mood: 'minuit', sound: false })), { ...defaults(), sound: false });
  assert.deepEqual(fromLegacy(JSON.stringify({ mood: 'midi' })), { ...defaults(), mood: 'midi' });
});

test('on n\'écrit jamais une sauvegarde invalide', () => {
  const st = memStore();
  assert.equal(write(st, { ...defaults(), mood: 'x' }), false);
  assert.equal(st.getItem(KEY), null);
});
