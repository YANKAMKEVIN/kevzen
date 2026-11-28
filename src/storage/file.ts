/** Jardin en fichier : export et import, au format versionné et vérifié strictement.
 *
 * Un fichier importé vient de l'extérieur : rien n'est deviné. Il doit dire qu'il vient de KevZen,
 * avoir une version connue, et son jardin doit se décoder entièrement (taille de grille cohérente
 * avec l'écran d'origine, sable complet) avant que le jardin affiché ne soit touché. */
import { type MoodKey, isMoodKey } from '../core/config';
import { gridSize } from '../core/garden';
import { type GardenData, base64ToBytes, decodeSand, migrateGarden } from '../core/serialize';
import { cleanName } from './gallery';
import { tryParse } from './store';

export const FILE_APP = 'kevzen';
export const FILE_KIND = 'jardin';
export const FILE_VERSION = 1;
/** Un jardin pèse quelques kilo-octets ; au-delà de 2 Mo ce n'est pas un jardin. */
export const FILE_MAX_BYTES = 2_000_000;
/** Plafond de la grille (un écran 8K tient dedans) : refuse avant d'allouer. */
export const MAX_CELLS = 9_000_000;
export const FILE_EXT = '.kevzen.json';
export const DEFAULT_NAME = 'Jardin importé';

export interface GardenFile { app: typeof FILE_APP; kind: typeof FILE_KIND; version: number; name: string; mood: MoodKey; exportedAt: string; garden: GardenData }

export type ImportError = 'vide' | 'trop-gros' | 'illisible' | 'etranger' | 'trop-recent' | 'abime';
export type ImportResult = { ok: true; name: string; mood: MoodKey; garden: GardenData } | { ok: false; reason: ImportError };

/** Le texte du fichier à télécharger. */
export function exportGarden(garden: GardenData, meta: { name?: string; mood: MoodKey; now?: number }): string {
  const file: GardenFile = {
    app: FILE_APP, kind: FILE_KIND, version: FILE_VERSION, name: cleanName(meta.name) || 'Mon jardin', mood: meta.mood,
    exportedAt: new Date(meta.now ?? Date.now()).toISOString(), garden,
  };
  return JSON.stringify(file);
}

/** Nom de fichier lisible et sûr sur tous les systèmes : « jardin-du-matin.kevzen.json ». */
export function fileName(name: string): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return (slug || 'jardin') + FILE_EXT;
}

/** Le jardin se décode-t-il entièrement, à une taille raisonnable ? */
function decodes(d: GardenData): boolean {
  const [W, H] = gridSize(d.vw, d.vh);
  if (W !== d.W || H !== d.H || W * H > MAX_CELLS) return false;
  const bytes = base64ToBytes(d.sand);
  return bytes !== null && decodeSand(bytes, d.W, d.H) !== null;
}

/** Vérifie un fichier importé. Ne touche à rien : c'est à l'appelant d'ouvrir le jardin s'il est bon. */
export function parseGardenFile(text: unknown): ImportResult {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'vide' };
  if (text.length > FILE_MAX_BYTES) return { ok: false, reason: 'trop-gros' };
  const o = tryParse(text);
  if (o === undefined) return { ok: false, reason: 'illisible' };
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: 'etranger' };
  const r = o as Record<string, unknown>;
  if (r.app !== FILE_APP || r.kind !== FILE_KIND) return { ok: false, reason: 'etranger' };
  if (!Number.isInteger(r.version) || (r.version as number) < 1) return { ok: false, reason: 'abime' };
  if ((r.version as number) > FILE_VERSION) return { ok: false, reason: 'trop-recent' };
  // Étapes futures, à chaîner ici : if (r.version === 1) r = v1ToV2(r);
  if ((r.name !== undefined && typeof r.name !== 'string') || !isMoodKey(r.mood)) return { ok: false, reason: 'abime' };
  const garden = migrateGarden(r.garden);
  if (!garden || !decodes(garden)) return { ok: false, reason: 'abime' };
  return { ok: true, name: cleanName(r.name) || DEFAULT_NAME, mood: r.mood, garden };
}
