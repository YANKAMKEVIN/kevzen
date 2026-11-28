/** État partagé de l'interface : le jardin en cours et ce que fait le joueur. */
import { createGarden } from '../core/garden';

export type Tool = 'rake' | 'stone' | 'smooth';

/** Le jardin affiché. */
export const garden = createGarden();

export const ui = {
  tool: 'rake' as Tool,
  autoOn: false,
  entered: false,
  /** indice dans TINES */ tni: 1,
  lastAct: 0,
  /** la galerie est ouverte (les gestes et raccourcis du jardin sont suspendus) */ panel: false,
};

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
