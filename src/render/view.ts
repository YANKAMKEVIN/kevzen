/** La toile de l'écran et sa résolution. */
import { MOODS, type Mood } from '../core/config';
import { save } from '../storage/settings';

export const cv = document.getElementById('g') as HTMLCanvasElement;
export const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
/** Résolution plafonnée : au-delà de 2, l'écran ne gagne rien de visible et le téléphone chauffe. */
export const MAX_DPR = 2;
export const view = { dpr: 1 };
export const mood = (): Mood => MOODS[save.mood];

/** Adapte la toile à la fenêtre. */
export function sizeCanvas(vw: number, vh: number): void {
  view.dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
  cv.width = Math.round(vw * view.dpr); cv.height = Math.round(vh * view.dpr);
}
