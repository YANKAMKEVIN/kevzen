// Outils communs aux tests unitaires : le vrai modèle du jardin, sans navigateur.
import { type Garden, type GardenEvents, createGarden, allocate, fillFlat } from '../../src/core/garden';
import type { KVStore } from '../../src/storage/store';

/** localStorage en mémoire (avec key/length, comme le vrai). `quota` : taille maximale totale en caractères. */
export function memStore(init: Record<string, string> = {}, quota = Infinity): KVStore & { m: Map<string, string> } {
  const m = new Map(Object.entries(init));
  const size = (): number => { let n = 0; for (const [k, v] of m) n += k.length + v.length; return n; };
  return {
    getItem: k => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      const old = m.get(k); m.set(k, String(v));
      if (size() > quota) { if (old === undefined) m.delete(k); else m.set(k, old); throw new Error('QuotaExceededError'); }
    },
    removeItem: k => { m.delete(k); },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    m,
  };
}

/** Stockage qui refuse tout (navigation privée stricte). */
export const blockedStore: KVStore = {
  getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); }, removeItem() { throw new Error('bloqué'); },
  key() { throw new Error('bloqué'); }, get length(): number { throw new Error('bloqué'); },
};

/** Jardin neuf, vide, ratissé droit, d'une taille d'écran donnée, hasard fixé. */
export function freshGarden(vw = 800, vh = 600, s = 42): Garden {
  const g = createGarden(s);
  allocate(g, vw, vh); fillFlat(g); g.dirty = null;
  return g;
}

/** Enregistre les événements émis par le jardin. */
export function record(g: Garden): Record<keyof GardenEvents, unknown[][]> {
  const log: Record<keyof GardenEvents, unknown[][]> = { stonePlaced: [], stoneRemoved: [], restored: [], newGarden: [], note: [] };
  g.events = {
    stonePlaced: (...a) => { log.stonePlaced.push(a); }, stoneRemoved: (...a) => { log.stoneRemoved.push(a); },
    restored: () => { log.restored.push([]); }, newGarden: () => { log.newGarden.push([]); }, note: (...a) => { log.note.push(a); },
  };
  return log;
}

/** Somme des écarts absolus entre deux champs de hauteur. */
export const diff = (a: ArrayLike<number>, b: ArrayLike<number>): number => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d; };
/** Nombre de cases différentes. */
export const changedCells = (a: ArrayLike<number>, b: ArrayLike<number>): number => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
