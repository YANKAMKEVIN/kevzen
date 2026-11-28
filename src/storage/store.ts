/** Accès prudent au stockage du navigateur : tout peut échouer (navigation privée,
 * iframe, quota plein, données abîmées) et rien ne doit faire tomber le jardin. */

/** Le sous-ensemble de Storage dont on a besoin (localStorage, ou un faux en mémoire dans les tests). */
export interface KVStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
}

/** Le stockage du navigateur, ou null s'il est bloqué. */
export function browserStore(): KVStore | null {
  try { const s = globalThis.localStorage; s.getItem('kevzen.sonde'); return s; } catch { return null; }
}

export function safeGet(store: KVStore | null, k: string): string | null {
  if (!store) return null;
  try { return store.getItem(k); } catch { return null; }
}

/** Écrit ; false si le stockage refuse (bloqué ou plein). */
export function safeSet(store: KVStore | null, k: string, v: string): boolean {
  if (!store) return false;
  try { store.setItem(k, v); return true; } catch { return false; }
}

export function safeRemove(store: KVStore | null, k: string): void {
  if (!store) return;
  try { store.removeItem(k); } catch { /* bloqué */ }
}

/** Toutes les clés qui commencent par `prefix`. */
export function keysWith(store: KVStore | null, prefix: string): string[] {
  const out: string[] = [];
  if (!store) return out;
  try { for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch { /* bloqué */ }
  return out;
}

/** Met une valeur abîmée de côté (sous k + '.abimee') au lieu de l'écraser en silence. */
export function quarantine(store: KVStore | null, k: string, text: string): void {
  safeSet(store, k + '.abimee', text);
  safeRemove(store, k);
}

/** JSON.parse qui renvoie undefined au lieu de lever. */
export function tryParse(text: string | null): unknown {
  if (text == null) return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}
