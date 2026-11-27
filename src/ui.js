// @ts-check
/** Interface : outils, lumières, boutons, clavier, gestes au doigt et à la souris, boucle d'animation. */
import { C, MOODS, TINES, VERSION, clamp } from './config.js';
import { G, hooks, ag, rakeSeg, smoothAt, placeStone, stoneAt, removeStone, randomRadius, stepGrow, compose, newGarden, stepSweep, pushUndo, undo, fillFlat, autoStep, seed } from './garden.js';
import { save, persist } from './save.js';
import { ensureAudio, tune, setVolume, pluck, bell, tok, note, swish, ambience, audio } from './audio.js';
import { cv, resize, renderStone, resetParts, clampParts, stepParts, pushParts, draw } from './render.js';

/** @param {string} id @returns {any} */
const $ = id => document.getElementById(id);
const root = () => MOODS[save.mood].root;

/* ---------- le jardin parle au son et au rendu ---------- */
Object.assign(hooks, {
  /** @param {any} s */ stoneMade: s => renderStone(s),
  /** @param {any} s @param {boolean} silent */ stonePlaced: (s, silent) => { if (!silent) bell(root() / 2 * (s.r > 34 ? .75 : 1), s.x); },
  /** @param {any} s */ stoneRemoved: s => pluck(root() / 2, .12, s.x / G.vw * 1.4 - .7),
  undone: () => { G.stones.forEach(renderStone); pluck(root(), .08, 0); },
  newGarden: () => tok(.6),
  /** @param {number} x @param {number} y */ note: (x, y) => note(x, y, .11),
});

/* ---------- état de l'interface ---------- */
const ui = { tool: 'rake', autoOn: false, entered: false, tni: 1, lastAct: 0 };
/** @type {number|null} */ let down = null;
const ptr = { x: -99, y: -99, in: false, mouse: false };
/** @type {{x:number,y:number}|null} */ let pen = null;
const dir = { x: 1, y: 0 };
let travel = 0;

// à la souris on clique, au doigt on touche
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
/** @type {Record<string,string>} */
const HINTS = { rake: 'Glissez pour ratisser le sable', stone: FINE ? 'Cliquez pour poser une pierre, cliquez dessus pour la retirer' : 'Touchez pour poser une pierre, touchez-la pour la retirer', smooth: 'Glissez pour effacer les traces', auto: 'Le jardinier ratisse pour vous. Respirez.' };
const setHint = () => { $('hint').textContent = ui.autoOn ? HINTS.auto : HINTS[ui.tool]; };

/** @param {string} t */
function setTool(t) { ui.tool = t; document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.tool === t))); setHint(); }

/** Applique l'outil sur un bout de geste (pixels d'écran). @param {number} ax @param {number} ay @param {number} bx @param {number} by @param {number} speed */
function applyTool(ax, ay, bx, by, speed) {
  if (ui.tool === 'rake') { rakeSeg(ax / C, ay / C, bx / C, by / C); swish(speed); }
  else { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6)); for (let i = 1; i <= n; i++) smoothAt((ax + (bx - ax) * i / n) / C, (ay + (by - ay) * i / n) / C, 13); swish(speed * .6, true); }
}

/** @param {string} k */
function setMood(k) {
  save.mood = k; document.querySelectorAll('[data-mood]').forEach(b => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.mood === k))); document.body.style.background = MOODS[k].bg;
  G.stones.forEach(renderStone); G.dirty = [0, 0, G.W - 1, G.H - 1]; resetParts(); tune(); persist();
}
/** @param {boolean} on */
function setAuto(on) { ui.autoOn = on; $('auto').setAttribute('aria-pressed', String(on)); ag.pause = 20; setHint(); }
/** @param {boolean} on */
function setSound(on) {
  save.sound = on; $('snd').setAttribute('aria-pressed', String(on)); $('sndw').setAttribute('d', on ? 'M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11' : 'M16 9.5l5 5M21 9.5l-5 5');
  setVolume(on); persist();
}

/* ---------- gestes ---------- */
cv.addEventListener('pointerdown', e => {
  if (down !== null || !ui.entered) return; ensureAudio(); ui.lastAct = performance.now();
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.mouse = e.pointerType === 'mouse';
  if (ui.tool === 'stone') { pushUndo(); const i = stoneAt(ptr.x, ptr.y); if (i >= 0) removeStone(i); else placeStone(ptr.x, ptr.y, randomRadius()); return; }
  try { cv.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
  down = e.pointerId; pushUndo(); pen = { x: ptr.x, y: ptr.y }; travel = 0; document.body.classList.add('quiet');
});
cv.addEventListener('pointermove', e => { if (down !== null && e.pointerId !== down) return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true; ptr.mouse = e.pointerType === 'mouse'; ui.lastAct = performance.now(); });
/** @param {PointerEvent} e */
const up = e => { if (e.pointerId !== down) return; down = null; pen = null; swish(0); document.body.classList.remove('quiet'); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ptr.in = false; });

/* ---------- boutons et clavier ---------- */
document.querySelectorAll('[data-tool]').forEach(b => { /** @type {HTMLElement} */ (b).onclick = () => { ensureAudio(); setTool(/** @type {string} */ (/** @type {HTMLElement} */ (b).dataset.tool)); }; });
$('tines').onclick = () => { ui.tni = (ui.tni + 1) % 3; const [n, name, d] = TINES[ui.tni]; G.tines = n; $('tinesL').textContent = name; $('tic').setAttribute('d', d); setTool('rake'); };
$('moods').innerHTML = Object.entries(MOODS).map(([k, m]) => `<button class="sw" data-mood="${k}" title="${m.name}" aria-label="${m.name}" aria-pressed="false"><i style="background:${m.sw}"></i></button>`).join('');
document.querySelectorAll('[data-mood]').forEach(b => { /** @type {HTMLElement} */ (b).onclick = () => { ensureAudio(); setMood(/** @type {string} */ (/** @type {HTMLElement} */ (b).dataset.mood)); pluck(root(), .12, 0); }; });
$('undo').onclick = () => undo();
$('new').onclick = () => { ensureAudio(); newGarden(); };
$('auto').onclick = () => { ensureAudio(); setAuto(!ui.autoOn); };
$('snd').onclick = () => { ensureAudio(); setSound(!save.sound); };
addEventListener('keydown', e => {
  if (!ui.entered) return; const k = e.key.toLowerCase();
  if (k === 'z' && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); undo(); }
  else if (k === '1') setTool('rake'); else if (k === '2') setTool('stone'); else if (k === '3') setTool('smooth');
  else if (k === 'm') setAuto(!ui.autoOn); else if (k === 'n') newGarden();
});
$('go').onclick = () => {
  ui.entered = true; ensureAudio(); $('intro').classList.add('gone'); document.body.classList.remove('pre'); setAuto(false);
  setTimeout(() => { $('intro').style.display = 'none'; }, 1700);
  if (audio() && save.sound) setTimeout(() => bell(root() / 2, G.vw / 2), 200);
};
addEventListener('resize', () => { resize(); clampParts(); });

/* ---------- boucle ---------- */
let last = performance.now();
/** @param {number} t */
function frame(t) {
  const dt = Math.min(3, (t - last) / 16.67); last = t;
  if (down !== null && pen) {
    const nx = pen.x + (ptr.x - pen.x) * .38 * Math.min(dt, 2), ny = pen.y + (ptr.y - pen.y) * .38 * Math.min(dt, 2), dx = nx - pen.x, dy = ny - pen.y, d = Math.hypot(dx, dy);
    if (d > .25) {
      applyTool(pen.x, pen.y, nx, ny, d / dt); dir.x += (dx / d - dir.x) * .3; dir.y += (dy / d - dir.y) * .3; const L = Math.hypot(dir.x, dir.y) || 1; dir.x /= L; dir.y /= L;
      pushParts(nx, ny, dx, dy); travel += d; if (ui.tool === 'rake' && travel > 44) { travel = 0; note(nx, ny); } pen.x = nx; pen.y = ny;
    } else swish(0);
  }
  const autoActive = (ui.autoOn || !ui.entered) && autoStep(dt, ui.entered);
  if (autoActive) pushParts(ag.x, ag.y, ag.dx * 2, ag.dy * 2);
  if (ui.autoOn && down === null) document.body.classList.toggle('quiet', t - ui.lastAct > 4000);
  stepSweep(dt); stepGrow(dt); stepParts(dt); ambience(t, ui.entered);
  let cursor = null;
  if (autoActive && ui.entered) cursor = { x: ag.x, y: ag.y, dx: ag.dx, dy: ag.dy, tool: 'rake' };
  else if (ui.entered && (down !== null || (ptr.in && ptr.mouse))) { const p = down !== null && pen ? pen : ptr; cursor = { x: p.x, y: p.y, dx: dir.x, dy: dir.y, tool: ui.tool }; }
  draw(t, cursor);
  requestAnimationFrame(frame);
}

/* ---------- démarrage ---------- */
const params = new URLSearchParams(location.search);
const g = Number(params.get('graine'));
if (Number.isInteger(g) && g > 0) seed(g);
ag.s = G.rand() * 99;
$('ver').textContent = 'v' + VERSION;
resize(); compose(); fillFlat();
setMood(save.mood); setSound(save.sound); setTool('rake');
requestAnimationFrame(frame);

/** Accès pour les tests de bout en bout (lecture seule en pratique). */
Object.assign(window, { __kz: { G, ui, save, clamp } });
