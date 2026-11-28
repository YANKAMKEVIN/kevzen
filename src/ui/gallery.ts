/** Panneau de la galerie : enregistrer le jardin, rouvrir, renommer ou effacer un jardin enregistré. */
import { MOODS } from '../core/config';
import { serializeGarden, restoreGarden } from '../core/serialize';
import { type GalleryItem, listGardens, saveGarden, loadGarden, removeGarden, renameGarden, MAX_GARDENS } from '../storage/gallery';
import { browserStore } from '../storage/store';
import { save } from '../storage/settings';
import { pluck, bell } from '../audio';
import { cv } from '../render';
import { cancelGesture } from './gestures';
import { garden as g, ui, $ } from './state';
import { setMood, refreshHistory } from './controls';

const dlg = (): HTMLDialogElement => $<HTMLDialogElement>('galerie');

const REASONS = {
  bloque: 'Ce navigateur refuse d\'enregistrer (navigation privée ?).',
  plein: 'Le stockage est plein : effacez un jardin pour faire de la place.',
  limite: `La galerie est pleine (${MAX_GARDENS} jardins) : effacez-en un.`,
  introuvable: 'Ce jardin n\'existe plus.',
} as const;

const say = (msg: string): void => { $('galMsg').textContent = msg; };
const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Petite vignette JPEG du jardin tel qu'il est à l'écran. */
function thumbnail(): string | undefined {
  try {
    const w = 160, h = Math.max(1, Math.round(w * cv.height / Math.max(1, cv.width)));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    (c.getContext('2d') as CanvasRenderingContext2D).drawImage(cv, 0, 0, w, h);
    return c.toDataURL('image/jpeg', .7);
  } catch { return undefined; }
}

function row(it: GalleryItem): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = it.id;
  if (it.id === ui.galleryId) li.classList.add('cur');
  const img = document.createElement('div'); img.className = 'th';
  if (it.thumb) img.style.backgroundImage = `url("${it.thumb}")`; else img.style.background = MOODS[it.mood].sw;
  const meta = document.createElement('div'); meta.className = 'meta';
  const name = document.createElement('input'); name.className = 'nm'; name.value = it.name; name.maxLength = 40; name.setAttribute('aria-label', 'Nom du jardin');
  name.onchange = () => { if (!renameGarden(browserStore(), it.id, name.value)) say('Impossible de renommer ce jardin.'); render(); };
  const sub = document.createElement('small'); sub.textContent = `${MOODS[it.mood].name} · ${it.stones} pierre${it.stones > 1 ? 's' : ''} · ${fmt.format(it.updatedAt)}`;
  meta.append(name, sub);
  const open = document.createElement('button'); open.className = 'open'; open.textContent = 'Ouvrir'; open.onclick = () => openGarden(it);
  const del = document.createElement('button'); del.className = 'del'; del.textContent = 'Effacer'; del.setAttribute('aria-label', `Effacer ${it.name}`);
  del.onclick = () => {
    if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Sûr ?'; return; }
    removeGarden(browserStore(), it.id); if (ui.galleryId === it.id) ui.galleryId = null; say(`« ${it.name} » effacé.`); render();
  };
  const act = document.createElement('div'); act.className = 'act'; act.append(open, del);
  li.append(img, meta, act);
  return li;
}

function render(): void {
  const items = listGardens(browserStore()), list = $('galList');
  list.replaceChildren(...items.map(row));
  $('galEmpty').hidden = items.length > 0;
  $('galCount').textContent = `${items.length} / ${MAX_GARDENS}`;
  $('galSave').textContent = ui.galleryId && items.some(i => i.id === ui.galleryId) ? 'Mettre à jour ce jardin' : 'Enregistrer ce jardin';
}

function saveCurrent(): void {
  const st = browserStore();
  const exists = ui.galleryId !== null && listGardens(st).some(i => i.id === ui.galleryId);
  const r = saveGarden(st, serializeGarden(g), { id: exists ? ui.galleryId ?? undefined : undefined, mood: save.mood, thumb: thumbnail() });
  if (r.ok) { ui.galleryId = r.item.id; say(`« ${r.item.name} » enregistré.`); pluck(MOODS[save.mood].root, .1, 0); }
  else say(REASONS[r.reason]);
  render();
}

function openGarden(it: GalleryItem): void {
  const data = loadGarden(browserStore(), it.id);
  if (!data || !restoreGarden(g, data)) { say(`« ${it.name} » est abîmé : il a été mis de côté.`); render(); return; }
  ui.galleryId = it.id;
  if (it.mood !== save.mood) setMood(it.mood);
  refreshHistory(); closeGallery();
  bell(MOODS[save.mood].root / 2, g.vw / 2);
}

export function openGallery(): void {
  if (!ui.entered || ui.panel) return;
  cancelGesture(); ui.panel = true; say(''); render();
  const d = dlg();
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}

export function closeGallery(): void {
  const d = dlg();
  if (d.open) d.close();
  ui.panel = false;
}

export function bindGallery(): void {
  $('galSave').onclick = saveCurrent;
  $('galClose').onclick = closeGallery;
  dlg().addEventListener('close', () => { ui.panel = false; });
  dlg().addEventListener('click', e => { if (e.target === dlg()) closeGallery(); });
}
