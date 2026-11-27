// Outils communs aux tests unitaires : le vrai jardin (src/garden.js), sans navigateur.
import { G, hooks, allocate, fillFlat, seed } from '../../src/garden.js';

/** localStorage en mémoire (avec key/length, comme le vrai). */
export function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, m,
  };
}

/** Jardin neuf, vide, ratissé droit, d'une taille d'écran donnée, hasard fixé. */
export function freshGarden(vw = 800, vh = 600, s = 42) {
  G.W = 0; G.H = 0; G.hm = new Float32Array(0); G.stones = []; G.grow = []; G.sweep = null; G.tines = 5;
  for (const k of Object.keys(hooks)) hooks[k] = () => {};
  seed(s); allocate(vw, vh); fillFlat(); G.dirty = null;
  return G;
}

/** Somme des écarts absolus entre deux champs de hauteur. */
export const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d; };
