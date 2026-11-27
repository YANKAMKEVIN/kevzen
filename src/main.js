// @ts-check
/** Point d'entrée : l'interface importe tout le reste (jardin, son, rendu, sauvegarde). */
import './ui.js';
import { loadArt } from './art.js';
import { artReady } from './render.js';

// visuels peints (titre, sable, pierres) : le jeu démarre sans eux et les prend dès qu'ils arrivent
loadArt().then(n => { artReady(); /** @type {any} */ (window).__kz.art = n; });
