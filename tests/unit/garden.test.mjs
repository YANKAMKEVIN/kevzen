import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G, hooks, allocate, rakeSeg, smoothAt, placeStone, stoneAt, removeStone, stepGrow, compose, newGarden, stepSweep, pushUndo, undo, UNDO_MAX, autoStep, ag, ringR, flatRow, seed } from '../../src/garden.js';
import { C, SP, RINGS } from '../../src/config.js';
import { freshGarden, diff } from './helpers.mjs';

test('taille : la grille couvre l\'écran et part ratissée droit', () => {
  freshGarden(800, 600);
  assert.equal(G.W, 401); assert.equal(G.H, 301);
  assert.equal(G.hm.length, G.W * G.H);
  for (const y of [0, 7, 150]) assert.ok(Math.abs(G.hm[y * G.W + 33] - flatRow(y)) < 1e-6);
});

test('redimensionner garde le sable déjà dessiné', () => {
  freshGarden(400, 300);
  rakeSeg(20, 20, 120, 80);
  const v = G.hm[50 * G.W + 70];
  assert.equal(allocate(400, 300), false, 'même taille : rien ne bouge');
  allocate(600, 500);
  assert.equal(G.hm[50 * G.W + 70], v);
});

test('le râteau creuse des sillons sur son passage, et seulement là', () => {
  freshGarden();
  const before = G.hm.slice();
  rakeSeg(50, 100, 350, 200);
  assert.ok(diff(before, G.hm) > 100, 'le sable a changé');
  for (const [x, y] of [[200, 20], [200, 280], [10, 10]]) assert.equal(G.hm[y * G.W + x], before[y * G.W + x], `(${x},${y}) intact`);
  assert.ok(G.dirty, 'zone à redessiner marquée');
});

test('un râteau plus large marque une bande plus large', () => {
  const touched = tines => { freshGarden(); G.tines = tines; const b = G.hm.slice(); rakeSeg(100, 50, 300, 250); let n = 0; for (let i = 0; i < b.length; i++) if (b[i] !== G.hm[i]) n++; return n; };
  const fin = touched(3), large = touched(8);
  assert.ok(large > fin * 2, `${large} > 2×${fin}`);
});

test('lisser aplatit le sable', () => {
  freshGarden();
  const i = 150 * G.W + 200, v = Math.abs(G.hm[i]);
  for (let k = 0; k < 30; k++) smoothAt(200, 150, 13);
  assert.ok(Math.abs(G.hm[i]) < v * .01 + 1e-6);
});

test('pierre : cercles tracés peu à peu, protégés du râteau, retrait possible', () => {
  freshGarden();
  const placed = [], removed = [];
  hooks.stonePlaced = (s, silent) => placed.push(silent); hooks.stoneRemoved = s => removed.push(s);
  const s = placeStone(400, 300, 30);
  assert.deepEqual(placed, [false]);
  assert.equal(G.stones.length, 1);
  const cx = Math.round(s.x / C), cy = Math.round(s.y / C), ring = Math.round(ringR(s) + SP * 1.5);
  const i = cy * G.W + cx + ring;
  assert.equal(G.mask[i], 1, 'le cercle est dans le masque');
  for (let k = 0; k < 60 && G.grow.length; k++) stepGrow(1);
  assert.equal(G.grow.length, 0, 'les cercles ont fini de pousser');
  assert.ok(Math.abs(G.hm[i] - G.ringT[i]) < .05, 'le sable suit les cercles');
  const v = G.hm[i];
  rakeSeg(cx - 60, cy, cx + 60, cy);
  assert.equal(G.hm[i], v, 'le râteau contourne la pierre');
  assert.equal(stoneAt(400, 300), 0);
  assert.equal(stoneAt(10, 10), -1);
  removeStone(0);
  assert.equal(G.stones.length, 0); assert.equal(removed.length, 1);
  assert.equal(G.mask[i], 0);
  assert.ok(Math.abs(G.hm[i]) <= Math.abs(v) * .25 + 1e-6, 'les cercles s\'effacent');
});

test('annuler revient exactement au geste précédent, pierres comprises', () => {
  freshGarden();
  let undone = 0; hooks.undone = () => undone++;
  const h0 = G.hm.slice();
  pushUndo(); rakeSeg(10, 10, 300, 200);
  pushUndo(); placeStone(500, 300, 25);
  assert.equal(undo(), true); assert.equal(G.stones.length, 0);
  assert.equal(undo(), true); assert.equal(diff(h0, G.hm), 0);
  assert.equal(undo(), false, 'plus rien à annuler');
  assert.equal(undone, 2);
});

test('annulation limitée aux derniers gestes', () => {
  freshGarden();
  for (let k = 0; k < UNDO_MAX + 10; k++) pushUndo();
  assert.equal(G.undoS.length, UNDO_MAX);
});

test('composition : 3, 5 ou 7 pierres bien séparées, dans l\'écran, rejouable avec la même graine', () => {
  const sizes = new Set();
  for (let g = 1; g <= 40; g++) {
    freshGarden(1280, 800, g);
    const n = compose();
    assert.ok([3, 5, 7].includes(n));
    assert.ok(G.stones.length >= 2 && G.stones.length <= n, `graine ${g} : ${G.stones.length}/${n}`);
    for (const s of G.stones) assert.ok(s.x > 0 && s.x < 1280 && s.y > 0 && s.y < 800);
    sizes.add(n);
  }
  assert.deepEqual([...sizes].sort(), [3, 5, 7]);
  freshGarden(1280, 800, 9); compose(); const a = JSON.stringify(G.stones.map(s => [s.x, s.y, s.r, s.kind]));
  freshGarden(1280, 800, 9); compose(); const b = JSON.stringify(G.stones.map(s => [s.x, s.y, s.r, s.kind]));
  assert.equal(a, b);
});

test('nouveau jardin : le balayage repasse tout le sable puis s\'arrête', () => {
  freshGarden();
  rakeSeg(10, 10, 390, 290);
  let called = 0; hooks.newGarden = () => called++;
  newGarden();
  assert.equal(called, 1); assert.ok(G.sweep);
  let k = 0; while (G.sweep && k++ < 1000) stepSweep(1);
  assert.equal(G.sweep, null);
  for (let y = 0; y < G.H; y += 37) for (let x = 0; x < G.W; x += 41) {
    const i = y * G.W + x; assert.ok(Math.abs(G.hm[i] - (G.mask[i] ? G.ringT[i] : flatRow(y))) < 1e-6);
  }
  undo(); assert.equal(G.sweep, null, 'annuler arrête le balayage');
});

test('jardinier automatique : ratisse, joue des notes, reste dans l\'écran, évite les pierres', () => {
  freshGarden(1000, 700, 3);
  compose();
  let notes = 0; hooks.note = () => notes++;
  const h0 = G.hm.slice();
  Object.assign(ag, { pause: 1, t: 0, s: 5, trav: 0 });
  let moving = 0;
  for (let k = 0; k < 4000; k++) { if (autoStep(1, true)) moving++; assert.ok(ag.x > -40 && ag.x < 1040 && ag.y > -40 && ag.y < 740, `pas ${k} : (${ag.x|0},${ag.y|0})`); }
  assert.ok(moving > 1000, 'il ratisse la plupart du temps');
  assert.ok(notes > 20, `${notes} notes`);
  assert.ok(diff(h0, G.hm) > 1000, 'le sable a été ratissé');
  for (const s of G.stones) { const i = Math.round(s.y / C) * G.W + Math.round(s.x / C); assert.equal(G.mask[i], 1); }
});

test('jardinier déterministe avec une graine', () => {
  const run = () => { freshGarden(900, 600, 11); compose(); Object.assign(ag, { pause: 1, t: 0, s: 2, trav: 0, x: 0, y: 0, a: 0 }); for (let k = 0; k < 1500; k++) autoStep(1, false); return [ag.x, ag.y, G.stones.length, G.hm.reduce((a, b) => a + b, 0)]; };
  assert.deepEqual(run(), run());
});

test('RINGS et SP donnent des cercles de la bonne largeur', () => {
  freshGarden(); seed(1);
  const s = placeStone(400, 300, 30, true);
  const cx = Math.round(s.x / C), cy = Math.round(s.y / C), Z = ringR(s) + RINGS * SP;
  assert.equal(G.mask[cy * G.W + cx + Math.floor(Z) - 1], 1);
  assert.equal(G.mask[cy * G.W + cx + Math.ceil(Z) + 2], 0);
});
