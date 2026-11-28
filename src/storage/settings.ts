/** Réglages versionnés (lumière choisie, son) dans localStorage.
 *
 * Règle : toute modification du format incrémente SAVE_VERSION et ajoute une étape
 * à migrate(). Une sauvegarde abîmée ou plus récente que le jeu n'est jamais
 * écrasée en silence : elle est mise de côté sous KEY + '.abimee' et le jeu repart
 * des valeurs par défaut. L'ancien format (clé « kevzen ») est repris une fois puis effacé. */
import { type MoodKey, MOOD_KEYS, isMoodKey } from '../core/config';
import { type KVStore, browserStore, quarantine, safeRemove, safeSet, tryParse } from './store';

export const KEY = 'kevzen.sauvegarde';
export const LEGACY = 'kevzen';
export const SAVE_VERSION = 1;
export { MOOD_KEYS };

export interface SaveData { version: number; mood: MoodKey; sound: boolean }

export function defaults(): SaveData { return { version: SAVE_VERSION, mood: 'aube', sound: true }; }

/** Amène une sauvegarde d'une version antérieure à SAVE_VERSION ; null si inconnue ou trop récente. */
export function migrate(d: unknown): Record<string, unknown> | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const v = (d as { version?: unknown }).version;
  if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > SAVE_VERSION) return null;
  const out = structuredClone(d) as Record<string, unknown>;
  // Étapes futures, à chaîner ici : if (out.version === 1) out = v1ToV2(out);
  return out;
}

export function isValid(d: unknown): d is SaveData {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return o.version === SAVE_VERSION && isMoodKey(o.mood) && typeof o.sound === 'boolean' && Object.keys(o).length === 3;
}

/** Texte -> sauvegarde valide, ou null. */
export function parse(text: string | null): SaveData | null {
  if (text == null) return null;
  const raw = tryParse(text);
  if (raw === undefined) return null;
  const d = migrate(raw);
  return isValid(d) ? d : null;
}

/** Ancien format {mood, sound} -> format actuel ; on garde ce qui est lisible. */
export function fromLegacy(text: string | null): SaveData {
  const d = defaults();
  const o = tryParse(text || '{}');
  if (o && typeof o === 'object') {
    const r = o as Record<string, unknown>;
    if (isMoodKey(r.mood)) d.mood = r.mood;
    if (r.sound === false) d.sound = false;
  }
  return d;
}

/** Lit la sauvegarde ; reprend l'ancien format ; repart des valeurs par défaut si elle manque ou est abîmée. */
export function load(store: KVStore | null): SaveData {
  if (!store) return defaults();
  let text: string | null, old: string | null = null;
  try { text = store.getItem(KEY); if (text == null) old = store.getItem(LEGACY); } catch { return defaults(); }
  if (text == null) {
    if (old == null) return defaults();
    const d = fromLegacy(old);
    if (write(store, d)) safeRemove(store, LEGACY);
    return d;
  }
  const d = parse(text);
  if (d) return d;
  quarantine(store, KEY, text);
  return defaults();
}

export function write(store: KVStore | null, d: SaveData): boolean {
  if (!store || !isValid(d)) return false;
  return safeSet(store, KEY, JSON.stringify(d));
}

/** Réglages en cours (modifiés sur place, jamais remplacés). */
export const save: SaveData = load(browserStore());
/** Écrit les réglages en cours. */
export function persist(): boolean { return write(browserStore(), save); }
