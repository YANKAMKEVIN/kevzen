/** Particules : pétales (aube, midi), feuilles d'érable (crépuscule), lucioles (nuit).
 * Rien n'est alloué par image : formes et halo des lucioles sont préparés une fois. */
import { TAU, type ParticleKind } from '../core/config';
import type { Garden } from '../core/garden';
import { ctx, mood } from './view';

interface Part { k: ParticleKind; x: number; y: number; z: number; rot: number; vr: number; ph: number; vx: number; vy: number; a: number; c: string }

let parts: Part[] = [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PETALS = ['#ffd3dc', '#f6b5c4', '#fde6ea', '#eea2b6'], LEAVES = ['#d9542b', '#e88a2e', '#b8322a', '#f0b040'];

let petalPath: Path2D | null = null, leafPath: Path2D | null = null, flySprite: HTMLCanvasElement | null = null;
const FLY_R = 13;
function shapes(): void {
  if (petalPath) return;
  petalPath = new Path2D(); petalPath.moveTo(0, -5.4); petalPath.lineTo(1.6, -7); petalPath.bezierCurveTo(5.5, -5, 5, 3, 0, 6.5); petalPath.bezierCurveTo(-5, 3, -5.5, -5, -1.6, -7); petalPath.closePath();
  leafPath = new Path2D(); leafPath.moveTo(0, -8); leafPath.bezierCurveTo(5, -5, 5, 4, 0, 8); leafPath.bezierCurveTo(-5, 4, -5, -5, 0, -8);
  flySprite = document.createElement('canvas'); flySprite.width = flySprite.height = FLY_R * 4;
  const g = flySprite.getContext('2d') as CanvasRenderingContext2D, c = FLY_R * 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
  gr.addColorStop(0, 'rgba(235,255,170,1)'); gr.addColorStop(.25, 'rgba(200,255,120,.5)'); gr.addColorStop(1, 'rgba(160,255,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, c * 2, c * 2);
}

function spawn(g: Garden, p: Part, init: boolean): Part {
  const { vw, vh } = g;
  p.k = mood().part; p.z = .55 + Math.random() * .75; p.rot = Math.random() * TAU; p.vr = (Math.random() - .5) * .04; p.ph = Math.random() * TAU; p.vx = 0; p.vy = 0;
  if (p.k === 'fly') { p.x = Math.random() * vw; p.y = Math.random() * vh; p.a = Math.random() * TAU; }
  else { p.x = init ? Math.random() * vw : -20 - Math.random() * vw * .3; p.y = init ? Math.random() * vh : Math.random() * vh * .7 - 30; }
  const pal = p.k === 'leaf' ? LEAVES : PETALS; p.c = pal[(Math.random() * pal.length) | 0];
  return p;
}
const blank = (): Part => ({ k: 'petal', x: 0, y: 0, z: 1, rot: 0, vr: 0, ph: 0, vx: 0, vy: 0, a: 0, c: '' });

export function resetParts(g: Garden): void {
  const k = mood().part, n = reduce ? 8 : k === 'fly' ? 34 : k === 'leaf' ? 16 : 24;
  parts = []; for (let i = 0; i < n; i++) parts.push(spawn(g, blank(), true));
}
export const partCount = (): number => parts.length;
/** Garde les particules dans l'écran après un redimensionnement. */
export function clampParts(g: Garden): void { for (const p of parts) { p.x = Math.min(p.x, g.vw); p.y = Math.min(p.y, g.vh); } }

export function stepParts(g: Garden, dt: number): void {
  const { vw, vh } = g;
  for (const p of parts) {
    if (p.k === 'fly') { p.a += (Math.random() - .5) * .25; p.x += Math.cos(p.a) * .35 * dt + p.vx; p.y += Math.sin(p.a) * .35 * dt + p.vy; if (p.x < -10) p.x = vw + 10; if (p.x > vw + 10) p.x = -10; if (p.y < -10) p.y = vh + 10; if (p.y > vh + 10) p.y = -10; }
    else { p.ph += .014 * dt; p.x += ((Math.sin(p.ph) * .5 + .45) * p.z) * dt + p.vx; p.y += ((.22 + .3 * p.z) + Math.cos(p.ph * 1.3) * .15) * dt + p.vy; p.rot += p.vr * dt; if (p.y > vh + 30 || p.x > vw + 30) spawn(g, p, false); }
    p.vx *= .94; p.vy *= .94;
  }
}

/** Le râteau pousse les pétales. */
export function pushParts(x: number, y: number, vx: number, vy: number): void {
  for (const p of parts) { const d = Math.hypot(p.x - x, p.y - y); if (d < 46) { const f = (1 - d / 46) * .35; p.vx += vx * f; p.vy += vy * f; p.vr += (Math.random() - .5) * .02; } }
}

function petal(p: Part): void {
  const path = (p.k === 'leaf' ? leafPath : petalPath) as Path2D, s = p.z * (p.k === 'leaf' ? 1.25 : 1);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(s, s * (.75 + .25 * Math.sin(p.ph * 2)));
  ctx.translate(2.5, 3.5); ctx.fillStyle = 'rgba(40,20,10,.14)'; ctx.fill(path); ctx.translate(-2.5, -3.5);
  ctx.fillStyle = p.c; ctx.fill(path);
  if (p.k === 'leaf') { ctx.strokeStyle = 'rgba(90,30,10,.5)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 10); ctx.stroke(); }
  ctx.restore();
}

export function drawParts(t: number): void {
  shapes();
  const fly = flySprite as HTMLCanvasElement;
  for (const p of parts) {
    if (p.k === 'fly') {
      const r = 10 * p.z;
      ctx.globalAlpha = .35 + .65 * Math.max(0, Math.sin(t * .002 + p.ph * 3));
      ctx.drawImage(fly, 0, 0, fly.width, fly.height, p.x - r, p.y - r, r * 2, r * 2);
    } else petal(p);
  }
  ctx.globalAlpha = 1;
}
