/** Lumière du moment : halo, nuages qui passent, grain de pellicule, vignette ; et le curseur de l'outil.
 * Les dégradés ne dépendent que de la lumière et de la taille d'écran : ils sont gardés en cache. */
import { TAU, C, SP, clamp } from '../core/config';
import { type Garden } from '../core/garden';
import { stoneAt } from '../core/tools';
import { ctx, mood } from './view';

let noisePat: CanvasPattern | null = null;
function noise(): CanvasPattern {
  if (noisePat) return noisePat;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d') as CanvasRenderingContext2D, d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); noisePat = ctx.createPattern(c, 'repeat') as CanvasPattern;
  return noisePat;
}

interface Grads { key: string; glow: CanvasGradient; cloud: CanvasGradient; vig: CanvasGradient; M: number }
let grads: Grads | null = null;
function gradients(vw: number, vh: number): Grads {
  const m = mood(), key = `${m.name}|${vw}|${vh}`;
  if (grads && grads.key === key) return grads;
  const M = Math.max(vw, vh);
  const glow = ctx.createRadialGradient(m.gp[0] * vw, m.gp[1] * vh, 0, m.gp[0] * vw, m.gp[1] * vh, M * 1.15); glow.addColorStop(0, m.glow); glow.addColorStop(1, 'rgba(0,0,0,.3)');
  const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, M * .45); cloud.addColorStop(0, 'rgba(90,90,110,.1)'); cloud.addColorStop(1, 'rgba(90,90,110,0)');
  const vig = ctx.createRadialGradient(vw / 2, vh / 2, M * .32, vw / 2, vh / 2, M * .78); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, m.vig);
  grads = { key, glow, cloud, vig, M };
  return grads;
}

export function drawLight(g: Garden, t: number): void {
  const { vw, vh } = g, gr = gradients(vw, vh), M = gr.M;
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = gr.glow; ctx.fillRect(0, 0, vw, vh);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gr.cloud;
  for (let k = 0; k < 2; k++) {
    const cx = ((t * .006 * (k + 1) + k * vw * .6) % (vw + M)) - M / 2, cy = vh * (.3 + k * .4), r = M * .45;
    ctx.save(); ctx.translate(cx, cy); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .07; ctx.fillStyle = noise(); ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = gr.vig; ctx.fillRect(0, 0, vw, vh);
}

export interface Cursor { x: number; y: number; dx: number; dy: number; tool: string }

/** Curseur de l'outil. */
export function drawCursor(g: Garden, c: Cursor): void {
  const { tines, vw, vh } = g;
  ctx.save(); ctx.translate(c.x, c.y); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.lineWidth = 1.5;
  if (c.tool === 'rake') {
    const w = tines * SP * C / 2, px = -c.dy, py = c.dx; ctx.beginPath(); ctx.moveTo(-px * w, -py * w); ctx.lineTo(px * w, py * w); ctx.stroke();
    for (let k = 0; k < tines; k++) { const o = -w + SP * C * (k + .5); ctx.beginPath(); ctx.arc(px * o, py * o, 1.6, 0, TAU); ctx.fill(); }
  } else if (c.tool === 'smooth') { ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke(); }
  else { ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 0, stoneAt(g, c.x, c.y) >= 0 ? 8 : clamp(Math.min(vw, vh) * .045, 16, 34), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
