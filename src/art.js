// @ts-check
/**
 * Visuels peints avec Codex (dossier art/, prompts dans tools/art/prompts.json).
 * Le jeu reste jouable sans eux : tant qu'une image n'est pas chargée, le dessin
 * procédural d'origine prend le relais.
 */

export const ART_FILES = /** @type {const} */ ([
  'titre', 'sable', 'pierre_1', 'pierre_2', 'pierre_3', 'pierre_4',
]);

/** @type {Map<string, HTMLImageElement>} */
const loaded = new Map();

/**
 * Charge tous les visuels. Se résout quand tout est chargé, ou au bout de `maxMs`
 * (une image lente ou absente ne bloque jamais le jeu).
 * @param {number} [maxMs]
 * @returns {Promise<number>} nombre d'images prêtes
 */
export function loadArt(maxMs = 4000) {
  const all = ART_FILES.map(name => new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { loaded.set(name, im); res(true); };
    im.onerror = () => res(false);
    im.src = `art/${name}.webp`;
  }));
  return Promise.race([
    Promise.all(all),
    new Promise(res => setTimeout(res, maxMs)),
  ]).then(() => loaded.size);
}

/**
 * L'image si elle est prête, sinon null.
 * @param {string} name
 * @returns {HTMLImageElement|null}
 */
export function art(name) { return loaded.get(name) || null; }
