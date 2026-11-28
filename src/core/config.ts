/** Constantes du jardin, lumières, pierres et petits outils sans DOM. */
import { version } from '../../package.json';

export const VERSION: string = version;
export const TAU = Math.PI * 2;
/** Taille d'un pixel de sable en pixels d'écran. */
export const C = 2;
/** Écart entre deux dents du râteau (en pixels de sable). */
export const SP = 5;
/** Profondeur des sillons. */
export const AMP = 1;
/** Nombre de cercles tracés autour d'une pierre. */
export const RINGS = 3;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RGB = [number, number, number];
export type ParticleKind = 'petal' | 'leaf' | 'fly';
export interface Mood {
  name: string; sh: RGB; mid: RGB; li: RGB; glow: string; gp: [number, number]; vig: string; tint: string;
  part: ParticleKind; root: number; scale: number[]; sw: string; bg: string;
}

export const MOOD_KEYS = ['aube', 'midi', 'soir', 'nuit'] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];
export const isMoodKey = (k: unknown): k is MoodKey => typeof k === 'string' && (MOOD_KEYS as readonly string[]).includes(k);

export const MOODS: Record<MoodKey, Mood> = {
  aube: { name: 'Aube', sh: [118, 98, 118], mid: [226, 204, 204], li: [255, 245, 240], glow: 'rgba(255,186,200,.6)', gp: [.12, .08], vig: 'rgba(70,30,60,.42)', tint: 'rgba(200,120,160,.16)', part: 'petal', root: 293.66, scale: [0, 1, 5, 7, 8], sw: 'linear-gradient(135deg,#ffe0e4,#b896ab)', bg: '#3a2c33' },
  midi: { name: 'Midi', sh: [146, 124, 92], mid: [233, 221, 197], li: [255, 252, 242], glow: 'rgba(255,246,214,.55)', gp: [.3, 0], vig: 'rgba(70,50,20,.32)', tint: 'rgba(0,0,0,0)', part: 'petal', root: 349.23, scale: [0, 2, 5, 7, 9], sw: 'linear-gradient(135deg,#fff7e4,#d2bb8e)', bg: '#3b3226' },
  soir: { name: 'Crépuscule', sh: [92, 52, 66], mid: [214, 156, 114], li: [255, 220, 168], glow: 'rgba(255,140,70,.6)', gp: [.92, .04], vig: 'rgba(60,18,34,.5)', tint: 'rgba(210,90,40,.22)', part: 'leaf', root: 261.63, scale: [0, 3, 5, 7, 10], sw: 'linear-gradient(135deg,#ffc388,#83465a)', bg: '#3a2220' },
  nuit: { name: 'Nuit', sh: [14, 22, 40], mid: [72, 88, 120], li: [190, 206, 234], glow: 'rgba(160,195,255,.4)', gp: [.84, .1], vig: 'rgba(0,4,22,.62)', tint: 'rgba(24,40,100,.5)', part: 'fly', root: 220, scale: [0, 2, 3, 7, 8], sw: 'linear-gradient(135deg,#a7badf,#18223a)', bg: '#121827' },
};

/** Couleurs des pierres : [base, lumière, ombre]. */
export const KINDS: readonly [string, string, string][] = [['#8b867f', '#d2cdc4', '#3f3c38'], ['#57534f', '#a29c94', '#211f1d'], ['#8e7965', '#d6c0a6', '#43352a'], ['#6d7470', '#b9c1bb', '#2d3330']];

/** Largeurs du râteau : [dents, nom, tracé de l'icône]. */
export const TINES: readonly [number, string, string][] = [[3, 'Fin', 'M9 6v12M15 6v12'], [5, 'Moyen', 'M7 6v12M12 6v12M17 6v12'], [8, 'Large', 'M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12']];
export const TINE_COUNTS = TINES.map(t => t[0]);
