/** Boutons, lumières, clavier et liaison du jardin avec le son et le rendu. */
import { MOODS, TINES, isMoodKey, type MoodKey } from '../core/config';
import { markAll } from '../core/garden';
import { undo, redo, canUndo, canRedo } from '../core/history';
import { newGarden } from '../core/compose';
import { save, persist } from '../storage/settings';
import { ensureAudio, tune, setVolume, pluck, bell, tok, note, panOf } from '../audio';
import { clearStoneCache, resetParts } from '../render';
import { garden as g, ui, $, type Tool } from './state';

const root = (): number => MOODS[save.mood].root;

// à la souris on clique, au doigt on touche
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const HINTS: Record<Tool | 'auto', string> = {
  rake: 'Glissez pour ratisser le sable',
  stone: FINE ? 'Cliquez pour poser une pierre, cliquez dessus pour la retirer' : 'Touchez pour poser une pierre, touchez-la pour la retirer',
  smooth: 'Glissez pour effacer les traces',
  auto: 'Le jardinier ratisse pour vous. Respirez.',
};
const setHint = (): void => { $('hint').textContent = ui.autoOn ? HINTS.auto : HINTS[ui.tool]; };

/** Met à jour l'état des boutons Annuler / Rétablir. */
export function refreshHistory(): void {
  $<HTMLButtonElement>('undo').disabled = !canUndo(g);
  $<HTMLButtonElement>('redo').disabled = !canRedo(g);
}

export function setTool(t: Tool): void {
  ui.tool = t;
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  setHint();
}

export function setMood(k: MoodKey): void {
  save.mood = k;
  document.querySelectorAll<HTMLElement>('[data-mood]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mood === k)));
  document.body.style.background = MOODS[k].bg;
  clearStoneCache(); markAll(g); resetParts(g); tune(); persist();
}

export function setAuto(on: boolean): void { ui.autoOn = on; $('auto').setAttribute('aria-pressed', String(on)); g.ag.pause = 20; setHint(); }

export function setSound(on: boolean): void {
  save.sound = on; $('snd').setAttribute('aria-pressed', String(on));
  $('sndw').setAttribute('d', on ? 'M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11' : 'M16 9.5l5 5M21 9.5l-5 5');
  setVolume(on); persist();
}

const doUndo = (): void => { undo(g); refreshHistory(); };
const doRedo = (): void => { redo(g); refreshHistory(); };
const doNew = (): void => { ensureAudio(); newGarden(g); refreshHistory(); };

/** Le jardin parle au son et au rendu. */
function bindEvents(): void {
  g.events = {
    stonePlaced: (s, silent) => { if (!silent) bell(root() / 2 * (s.r > 34 ? .75 : 1), s.x); },
    stoneRemoved: s => pluck(root() / 2, .12, panOf(s.x)),
    restored: () => pluck(root(), .08, 0),
    newGarden: () => tok(.6),
    note: (x, y) => note(x, y, .11),
  };
}

export function bindControls(openGallery: () => void): void {
  bindEvents();
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach(b => { b.onclick = () => { ensureAudio(); setTool(b.dataset.tool as Tool); }; });
  $('tines').onclick = () => {
    ui.tni = (ui.tni + 1) % TINES.length; const [n, name, d] = TINES[ui.tni];
    g.tines = n; $('tinesL').textContent = name; $('tic').setAttribute('d', d); setTool('rake');
  };
  $('moods').innerHTML = Object.entries(MOODS).map(([k, m]) => `<button class="sw" data-mood="${k}" title="${m.name}" aria-label="${m.name}" aria-pressed="false"><i style="background:${m.sw}"></i></button>`).join('');
  document.querySelectorAll<HTMLElement>('[data-mood]').forEach(b => { b.onclick = () => { ensureAudio(); if (isMoodKey(b.dataset.mood)) setMood(b.dataset.mood); pluck(root(), .12, 0); }; });
  $('undo').onclick = doUndo;
  $('redo').onclick = doRedo;
  $('new').onclick = doNew;
  $('auto').onclick = () => { ensureAudio(); setAuto(!ui.autoOn); };
  $('snd').onclick = () => { ensureAudio(); setSound(!save.sound); };
  $('gal').onclick = () => { ensureAudio(); openGallery(); };
  addEventListener('keydown', e => {
    if (!ui.entered || ui.panel) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if ((k === 'z' && e.shiftKey) || (k === 'y' && mod)) { e.preventDefault(); doRedo(); }
    else if (k === 'z') { e.preventDefault(); doUndo(); }
    else if (k === '1') setTool('rake'); else if (k === '2') setTool('stone'); else if (k === '3') setTool('smooth');
    else if (k === 'm') setAuto(!ui.autoOn); else if (k === 'n') doNew();
    else if (k === 'g') openGallery();
  });
  $('go').onclick = () => {
    ui.entered = true; ensureAudio(); $('intro').classList.add('gone'); document.body.classList.remove('pre'); setAuto(false);
    setTimeout(() => { $('intro').style.display = 'none'; }, 1700);
    if (save.sound) setTimeout(() => bell(root() / 2, g.vw / 2), 200);
  };
}
