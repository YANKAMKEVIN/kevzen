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
  /** jardin de la galerie affiché (Enregistrer le met à jour) ; oublié au Nouveau jardin */ galleryId: null as string | null,
  /** nom du fichier importé, proposé à l'enregistrement dans la galerie */ importedName: null as string | null,
  /** le jardin gardé automatiquement a été repris au chargement (le jardinier de l'accueil n'y touche pas) */ resumed: false,
};

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
