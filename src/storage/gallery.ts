/** Galerie locale : plusieurs jardins enregistrés dans localStorage, de façon versionnée et robuste.
 *
 * - Un index léger (INDEX_KEY) liste les jardins (nom, dates, vignette).
 * - Chaque jardin vit sous sa propre clé (GARDEN_PREFIX + id) : un jardin abîmé n'emporte pas les autres.
 * - Chaque entrée garde aussi son nom et ses dates : si l'index est abîmé, on le reconstruit.
 * - Une donnée illisible est mise de côté (clé + '.abimee'), jamais écrasée en silence.
 * - Stockage plein : on réessaie sans vignette, puis on renonce proprement (rien n'est à moitié écrit). */
import { type MoodKey, isMoodKey } from '../core/config';
import { type GardenData, migrateGarden } from '../core/serialize';
import { type KVStore, keysWith, quarantine, safeGet, safeRemove, safeSet, tryParse } from './store';

export const INDEX_KEY = 'kevzen.galerie';
export const GARDEN_PREFIX = 'kevzen.jardin.';
export const GALLERY_VERSION = 1;
export const MAX_GARDENS = 12;
export const NAME_MAX = 40;

export interface GalleryItem { id: string; name: string; createdAt: number; updatedAt: number; mood: MoodKey; stones: number; thumb?: string }
interface GalleryIndex { version: number; items: GalleryItem[] }
interface Entry { v: number; name: string; mood: MoodKey; createdAt: number; updatedAt: number; garden: GardenData }

export type SaveResult = { ok: true; item: GalleryItem } | { ok: false; reason: 'bloque' | 'plein' | 'limite' | 'introuvable' };

const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{4,24}$/.test(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export const cleanName = (n: unknown): string => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '');

function isItem(o: unknown): o is GalleryItem {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  return isId(r.id) && typeof r.name === 'string' && r.name.length > 0 && r.name.length <= NAME_MAX && isTime(r.createdAt) && isTime(r.updatedAt)
    && isMoodKey(r.mood) && Number.isInteger(r.stones) && (r.thumb === undefined || (typeof r.thumb === 'string' && r.thumb.startsWith('data:image/')));
}

function parseEntry(text: string | null): Entry | null {
  const o = tryParse(text);
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (r.v !== GALLERY_VERSION || !cleanName(r.name) || !isMoodKey(r.mood) || !isTime(r.createdAt) || !isTime(r.updatedAt)) return null;
  const garden = migrateGarden(r.garden);
  return garden ? { v: GALLERY_VERSION, name: cleanName(r.name), mood: r.mood, createdAt: r.createdAt, updatedAt: r.updatedAt, garden } : null;
}

const itemOf = (id: string, e: Entry, thumb?: string): GalleryItem =>
  ({ id, name: e.name, createdAt: e.createdAt, updatedAt: e.updatedAt, mood: e.mood, stones: e.garden.stones.length, ...(thumb ? { thumb } : {}) });

/** Reconstruit l'index à partir des jardins encore lisibles (vignettes perdues). */
function rebuild(store: KVStore): GalleryItem[] {
  const items: GalleryItem[] = [];
  for (const k of keysWith(store, GARDEN_PREFIX)) {
    const id = k.slice(GARDEN_PREFIX.length);
    if (!isId(id)) continue;
    const e = parseEntry(safeGet(store, k));
    if (e) items.push(itemOf(id, e));
  }
  return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_GARDENS);
}

function writeIndex(store: KVStore, items: GalleryItem[]): boolean {
  const idx: GalleryIndex = { version: GALLERY_VERSION, items };
  return safeSet(store, INDEX_KEY, JSON.stringify(idx));
}

/** Les jardins enregistrés, du plus récent au plus ancien. Répare l'index au besoin. */
export function listGardens(store: KVStore | null): GalleryItem[] {
  if (!store) return [];
  const text = safeGet(store, INDEX_KEY);
  const raw = tryParse(text) as Partial<GalleryIndex> | undefined;
  if (text == null) {
    const items = rebuild(store);
    if (items.length) writeIndex(store, items);
    return items;
  }
  if (!raw || typeof raw !== 'object' || raw.version !== GALLERY_VERSION || !Array.isArray(raw.items) || !raw.items.every(isItem)) {
    quarantine(store, INDEX_KEY, text);
    const items = rebuild(store);
    writeIndex(store, items);
    return items;
  }
  // une entrée dont le jardin a disparu est oubliée
  const alive = raw.items.filter(it => safeGet(store, GARDEN_PREFIX + it.id) != null);
  if (alive.length !== raw.items.length) writeIndex(store, alive);
  return alive.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Un nom libre : « Jardin 1 », « Jardin 2 »… */
export function nextName(items: GalleryItem[]): string {
  const used = new Set(items.map(i => i.name));
  for (let n = items.length + 1; ; n++) if (!used.has(`Jardin ${n}`)) return `Jardin ${n}`;
}

/** Le stockage répond-il (lecture) ? Un stockage plein répond, un stockage bloqué lève. */
function usable(store: KVStore): boolean {
  try { store.getItem(INDEX_KEY); return true; } catch { return false; }
}

let counter = 0;
const newId = (now: number): string => (now.toString(36) + (counter++ % 1296).toString(36).padStart(2, '0') + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')).slice(0, 24);

export interface SaveMeta { id?: string; name?: string; mood: MoodKey; thumb?: string; now?: number }

/** Enregistre un jardin (nouveau, ou par-dessus `meta.id`). */
export function saveGarden(store: KVStore | null, garden: GardenData, meta: SaveMeta): SaveResult {
  if (!store || !usable(store)) return { ok: false, reason: 'bloque' };
  const items = listGardens(store), now = meta.now ?? Date.now();
  const prev = meta.id ? items.find(i => i.id === meta.id) : undefined;
  if (meta.id && !prev) return { ok: false, reason: 'introuvable' };
  if (!prev && items.length >= MAX_GARDENS) return { ok: false, reason: 'limite' };
  const id = prev ? prev.id : newId(now);
  const entry: Entry = { v: GALLERY_VERSION, name: cleanName(meta.name) || prev?.name || nextName(items), mood: meta.mood, createdAt: prev?.createdAt ?? now, updatedAt: now, garden };
  const key = GARDEN_PREFIX + id, before = safeGet(store, key);
  if (!safeSet(store, key, JSON.stringify(entry))) return { ok: false, reason: 'plein' };
  const others = items.filter(i => i.id !== id);
  for (const thumb of meta.thumb ? [meta.thumb, undefined] : [undefined]) {
    const item = itemOf(id, entry, thumb);
    if (writeIndex(store, [item, ...others])) return { ok: true, item };
  }
  // l'index n'a pas pu être écrit : on remet le jardin comme avant
  if (before == null) safeRemove(store, key); else safeSet(store, key, before);
  return { ok: false, reason: 'plein' };
}

/** Relit un jardin ; s'il est abîmé, il est mis de côté et retiré de la galerie. */
export function loadGarden(store: KVStore | null, id: string): GardenData | null {
  if (!store || !isId(id)) return null;
  const key = GARDEN_PREFIX + id, text = safeGet(store, key);
  if (text == null) return null;
  const e = parseEntry(text);
  if (e) return e.garden;
  quarantine(store, key, text);
  writeIndex(store, listGardens(store).filter(i => i.id !== id));
  return null;
}

export function removeGarden(store: KVStore | null, id: string): boolean {
  if (!store || !isId(id)) return false;
  const items = listGardens(store);
  if (!items.some(i => i.id === id)) return false;
  safeRemove(store, GARDEN_PREFIX + id);
  return writeIndex(store, items.filter(i => i.id !== id));
}

export function renameGarden(store: KVStore | null, id: string, name: string): boolean {
  const n = cleanName(name);
  if (!store || !n || !isId(id)) return false;
  const key = GARDEN_PREFIX + id, e = parseEntry(safeGet(store, key));
  if (!e) return false;
  e.name = n;
  if (!safeSet(store, key, JSON.stringify(e))) return false;
  return writeIndex(store, listGardens(store).map(i => (i.id === id ? { ...i, name: n } : i)));
}
