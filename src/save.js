// @ts-check
/** Sauvegarde versionnée (lumière choisie, son) dans localStorage.
 *
 * Règle : toute modification du format incrémente SAVE_VERSION et ajoute une étape
 * à migrate(). Une sauvegarde abîmée ou plus récente que le jeu n'est jamais
 * écrasée en silence : elle est mise de côté sous KEY + '.abimee' et le jeu repart
 * des valeurs par défaut. L'ancien format (clé « kevzen ») est repris une fois puis effacé. */

export const KEY = 'kevzen.sauvegarde';
export const LEGACY = 'kevzen';
export const SAVE_VERSION = 1;
export const MOOD_KEYS = ['aube', 'midi', 'soir', 'nuit'];

/** @typedef {{version:number,mood:string,sound:boolean}} SaveData */

/** @returns {SaveData} */
export function defaults() { return { version: SAVE_VERSION, mood: 'aube', sound: true }; }

/** Amène une sauvegarde d'une version antérieure à SAVE_VERSION ; null si inconnue ou trop récente.
 * @param {any} d @returns {any} */
export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const v = d.version;
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  const out = structuredClone(d);
  // Étapes futures, à chaîner ici :
  // if (out.version === 1) { out = v1ToV2(out); }
  return out;
}

/** @param {any} d @returns {d is SaveData} */
export function isValid(d) {
  return !!d && d.version === SAVE_VERSION && MOOD_KEYS.includes(d.mood) && typeof d.sound === 'boolean' && Object.keys(d).length === 3;
}

/** Texte -> sauvegarde valide, ou null.
 * @param {string|null} text */
export function parse(text) {
  if (text == null) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  const d = migrate(raw);
  return isValid(d) ? d : null;
}

/** Ancien format {mood, sound} -> format actuel ; on garde ce qui est lisible.
 * @param {string|null} text @returns {SaveData} */
export function fromLegacy(text) {
  const d = defaults();
  let o = null;
  try { o = JSON.parse(text || '{}'); } catch { /* illisible : valeurs par défaut */ }
  if (o && typeof o === 'object') {
    if (MOOD_KEYS.includes(o.mood)) d.mood = o.mood;
    if (o.sound === false) d.sound = false;
  }
  return d;
}

/** Lit la sauvegarde ; reprend l'ancien format ; repart des valeurs par défaut si elle manque ou est abîmée.
 * @param {Storage|null} store @returns {SaveData} */
export function load(store) {
  if (!store) return defaults();
  let text = null, old = null;
  try { text = store.getItem(KEY); if (text == null) old = store.getItem(LEGACY); } catch { return defaults(); }
  if (text == null) {
    if (old == null) return defaults();
    const d = fromLegacy(old);
    if (write(store, d)) { try { store.removeItem(LEGACY); } catch { /* bloqué */ } }
    return d;
  }
  const d = parse(text);
  if (d) return d;
  try { store.setItem(KEY + '.abimee', text); store.removeItem(KEY); } catch { /* stockage plein ou bloqué */ }
  return defaults();
}

/** @param {Storage|null} store @param {SaveData} d @returns {boolean} */
export function write(store, d) {
  if (!store || !isValid(d)) return false;
  try { store.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; }
}

/** Le stockage du navigateur, ou null s'il est bloqué (navigation privée, iframe…). */
export function browserStore() {
  try { const s = globalThis.localStorage; s.getItem(KEY); return s; } catch { return null; }
}

/** Sauvegarde en cours (modifiée sur place, jamais remplacée). */
export const save = load(browserStore());
/** Écrit la sauvegarde en cours. */
export function persist() { return write(browserStore(), save); }
