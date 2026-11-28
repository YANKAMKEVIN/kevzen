/** Visuels peints (dossier public/art/, prompts dans tools/art/prompts.json).
 * Le jeu reste jouable sans eux : tant qu'une image n'est pas chargée, le dessin
 * procédural d'origine prend le relais. */

export const ART_FILES = ['titre', 'sable', 'pierre_1', 'pierre_2', 'pierre_3', 'pierre_4'] as const;

const loaded = new Map<string, HTMLImageElement>();

/** Charge tous les visuels. Se résout quand tout est chargé, ou au bout de `maxMs`
 * (une image lente ou absente ne bloque jamais le jeu). Renvoie le nombre d'images prêtes. */
export function loadArt(maxMs = 4000): Promise<number> {
  const all = ART_FILES.map(name => new Promise<boolean>(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { loaded.set(name, im); res(true); };
    im.onerror = () => res(false);
    im.src = `art/${name}.webp`;
  }));
  return Promise.race([Promise.all(all), new Promise(res => setTimeout(res, maxMs))]).then(() => loaded.size);
}

/** L'image si elle est prête, sinon null. */
export function art(name: string): HTMLImageElement | null { return loaded.get(name) || null; }
