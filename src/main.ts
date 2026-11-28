/** Point d'entrée : relie le jardin (modèle pur), le rendu, le son, l'interface et la sauvegarde. */
import '../style.css';
import { VERSION, clamp } from './core/config';
import { seed } from './core/garden';
import { compose } from './core/compose';
import { fillFlat } from './core/garden';
import { serializeGarden } from './core/serialize';
import { save } from './storage/settings';
import { loadArt } from './art';
import { bindAudio, heard } from './audio';
import { resize, clampParts, clearStoneCache, stats, view } from './render';
import { garden as g, ui, $ } from './ui/state';
import { bindGestures } from './ui/gestures';
import { bindControls, setMood, setSound, setTool, refreshHistory } from './ui/controls';
import { bindGallery, openGallery } from './ui/gallery';
import { start, bindVisibility, loop } from './ui/loop';
import { bindAutosave, resumeAutosave, scheduleAutosave, autosave } from './ui/autosave';

const params = new URLSearchParams(location.search);
const graine = Number(params.get('graine'));
const seeded = Number.isInteger(graine) && graine > 0;
if (seeded) seed(g, graine);
g.ag.s = g.rand() * 99;
$('ver').textContent = 'v' + VERSION;

bindAudio(g);
bindControls(openGallery);
bindGallery();
bindGestures(() => { refreshHistory(); scheduleAutosave(); });
bindVisibility();
bindAutosave();
addEventListener('resize', () => { resize(g); clampParts(g); refreshHistory(); });

resize(g); compose(g); fillFlat(g);
// le jardin laissé la dernière fois revient (sauf avec ?graine=N, qui rejoue un jardin précis)
if (!seeded && resumeAutosave()) { ui.resumed = true; $('resume').hidden = false; }
setMood(save.mood); setSound(save.sound); setTool('rake'); refreshHistory();
start();

/** Accès pour les tests de bout en bout (lecture seule en pratique). */
const kz: Record<string, unknown> = { G: g, ui, save, clamp, stats, view, loop, serialize: () => serializeGarden(g), autosave, heard };
Object.assign(window, { __kz: kz });

// visuels peints (titre, sable, pierres) : le jeu démarre sans eux et les prend dès qu'ils arrivent
void loadArt().then(n => { clearStoneCache(); kz.art = n; });
