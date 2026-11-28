/** Sauvegarde automatique du jardin en cours (une seule clé), relue au rechargement de la page.
 *
 * - Versionnée (CURRENT_VERSION) : une entrée abîmée ou d'une version plus récente est mise de côté
 *   (clé + '.abimee'), jamais écrasée en silence ni devinée.
 * - Stockage plein : l'écriture échoue sans lever, et la dernière sauvegarde réussie reste intacte.
 * - Stockage bloqué (navigation privée stricte) : on renonce sans bruit, le jardin reste jouable. */
import { type GardenData, migrateGarden } from '../core/serialize';
import { type KVStore, quarantine, safeGet, safeRemove, safeSet, tryParse } from './store';

export const CURRENT_KEY = 'kevzen.encours';
export const CURRENT_VERSION = 1;

export interface CurrentEntry {
  v: number;
  savedAt: number;
  /** jardin de la galerie dont il est la suite (Enregistrer le met à jour), ou null */
  galleryId: string | null;
  garden: GardenData;
}

export type WriteResult = 'ok' | 'plein' | 'bloque';

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isGalleryId = (v: unknown): v is string | null => v === null || (typeof v === 'string' && /^[a-z0-9]{4,24}$/.test(v));

/** Écrit le jardin en cours. */
export function writeCurrent(store: KVStore | null, garden: GardenData, meta: { galleryId: string | null; now?: number }): WriteResult {
  if (!store) return 'bloque';
  try { store.getItem(CURRENT_KEY); } catch { return 'bloque'; }
  const entry: CurrentEntry = { v: CURRENT_VERSION, savedAt: meta.now ?? Date.now(), galleryId: isGalleryId(meta.galleryId) ? meta.galleryId : null, garden };
  return safeSet(store, CURRENT_KEY, JSON.stringify(entry)) ? 'ok' : 'plein';
}

/** Texte -> entrée valide (migrée), ou null. */
export function parseCurrent(text: string | null): CurrentEntry | null {
  const o = tryParse(text);
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (!Number.isInteger(r.v) || (r.v as number) < 1 || (r.v as number) > CURRENT_VERSION) return null;
  // Étapes futures, à chaîner ici : if (r.v === 1) r = v1ToV2(r);
  if (!isTime(r.savedAt) || !isGalleryId(r.galleryId)) return null;
  const garden = migrateGarden(r.garden);
  return garden ? { v: CURRENT_VERSION, savedAt: r.savedAt, galleryId: r.galleryId, garden } : null;
}

/** Relit le jardin en cours ; une entrée illisible est mise de côté. */
export function readCurrent(store: KVStore | null): CurrentEntry | null {
  const text = safeGet(store, CURRENT_KEY);
  if (text == null) return null;
  const e = parseCurrent(text);
  if (!e) quarantine(store, CURRENT_KEY, text);
  return e;
}

/** Oublie le jardin en cours (une entrée qui ne s'ouvre pas, par exemple). */
export function clearCurrent(store: KVStore | null, quarantineText?: string): void {
  if (quarantineText !== undefined) quarantine(store, CURRENT_KEY, quarantineText);
  else safeRemove(store, CURRENT_KEY);
}
