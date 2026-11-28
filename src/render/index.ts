/** Dessin d'une image : sable (incrémental), pierres, lumière, particules, curseur. */
import { type Garden, allocate } from '../core/garden';
import { ctx, view, sizeCanvas } from './view';
import { allocSand, drawSand } from './sand';
import { drawStones, clearStoneCache } from './stones';
import { drawLight, drawCursor, type Cursor } from './light';
import { drawParts } from './particles';

export { clearStoneCache, type Cursor };
export { resetParts, clampParts, stepParts, pushParts, partCount } from './particles';
export { cv, view, MAX_DPR } from './view';

/** Statistiques de rendu (lues par les tests de bout en bout). */
export const stats = { frames: 0, shaded: 0 };

/** Adapte le jardin et la toile à la fenêtre. */
export function resize(g: Garden): void {
  const before = view.dpr;
  sizeCanvas(innerWidth, innerHeight);
  if (view.dpr !== before) clearStoneCache();
  if (allocate(g, innerWidth, innerHeight)) allocSand(g);
}

/** Dessine une image complète. */
export function draw(g: Garden, t: number, cursor: Cursor | null): void {
  const dpr = view.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stats.shaded += drawSand(g); stats.frames++;
  drawStones(g);
  drawLight(g, t); drawParts(t);
  if (cursor) drawCursor(g, cursor);
}
