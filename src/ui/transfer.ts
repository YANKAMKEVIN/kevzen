/** Exporter le jardin en fichier, et importer un fichier de jardin (depuis la galerie). */
import { MOODS } from '../core/config';
import { serializeGarden, restoreGarden } from '../core/serialize';
import { exportGarden, fileName, parseGardenFile, FILE_MAX_BYTES, type ImportError } from '../storage/file';
import { listGardens } from '../storage/gallery';
import { browserStore } from '../storage/store';
import { save } from '../storage/settings';
import { bell, saveSound } from '../audio';
import { garden as g, ui, $ } from './state';
import { setMood, refreshHistory } from './controls';
import { scheduleAutosave } from './autosave';

export const IMPORT_ERRORS: Record<ImportError, string> = {
  vide: 'Ce fichier est vide : aucun jardin à ouvrir.',
  'trop-gros': 'Ce fichier est bien trop gros pour être un jardin KevZen.',
  illisible: 'Ce fichier est illisible : ce n\'est pas un jardin KevZen.',
  etranger: 'Ce fichier ne vient pas de KevZen : choisissez un fichier .kevzen.json.',
  'trop-recent': 'Ce jardin vient d\'une version plus récente de KevZen : rechargez la page pour la mettre à jour.',
  abime: 'Ce jardin est abîmé : il n\'a pas été ouvert, votre jardin n\'a pas bougé.',
};

/** Nom du jardin affiché : celui de la galerie, du fichier importé, sinon un nom par défaut. */
function currentName(): string {
  const it = ui.galleryId ? listGardens(browserStore()).find(i => i.id === ui.galleryId) : undefined;
  return it?.name ?? ui.importedName ?? 'Mon jardin';
}

function exportCurrent(say: (m: string) => void): void {
  const name = currentName(), file = fileName(name);
  try {
    const blob = new Blob([exportGarden(serializeGarden(g), { name, mood: save.mood })], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = file; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say(`« ${name} » exporté dans le fichier ${file}.`); saveSound();
  } catch { say('Ce navigateur refuse de créer le fichier.'); }
}

/** Ouvre le texte d'un fichier ; renvoie le message à afficher, ou null si le jardin est ouvert. */
export function importText(text: string): string | null {
  const r = parseGardenFile(text);
  if (!r.ok) return IMPORT_ERRORS[r.reason];
  if (!restoreGarden(g, r.garden)) return IMPORT_ERRORS.abime;
  ui.galleryId = null; ui.importedName = r.name;
  if (r.mood !== save.mood) setMood(r.mood);
  refreshHistory(); scheduleAutosave();
  bell(MOODS[save.mood].root / 2, g.vw / 2);
  return null;
}

export function bindTransfer(say: (m: string) => void, close: () => void): void {
  const input = $<HTMLInputElement>('galFile');
  $('galExport').onclick = () => exportCurrent(say);
  $('galImport').onclick = () => input.click();
  input.onchange = async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > FILE_MAX_BYTES) { say(IMPORT_ERRORS['trop-gros']); return; }
    let text: string;
    try { text = await f.text(); } catch { say('Impossible de lire ce fichier.'); return; }
    const err = importText(text);
    if (err) { say(err); return; }
    close();
  };
}
