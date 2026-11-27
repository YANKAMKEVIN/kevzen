// @ts-check
/** Toute la musique, créée en direct : koto (pluck), cloche, bambou (tok), nappe grave, vent et bruit du râteau. */
import { MOODS, clamp } from './config.js';
import { G } from './garden.js';
import { save } from './save.js';

/** @type {any} */
let A = null;
/** @type {any} */ let out, revIn, echoIn, swG, swF, droneG, windF, noiseBuf;
/** @type {{o:any,r:number}[]} */
const droneO = [];
/** Prochain « toc » du bambou (temps audio). */
export const clock = { tokAt: 0 };

/** Contexte audio, ou null avant le premier geste / si indisponible. */
export const audio = () => A;
const mood = () => MOODS[save.mood];

/** @param {number} sec @param {number} decay */
function impulse(sec, decay) {
  const n = A.sampleRate * sec, b = A.createBuffer(2, n, A.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}

/** Crée le contexte audio au premier geste (exigé par les navigateurs). */
export function ensureAudio() {
  if (A) { if (A.state === 'suspended' && save.sound) A.resume(); return; }
  const W = /** @type {any} */ (globalThis);
  try { A = new (W.AudioContext || W.webkitAudioContext)(); } catch { A = null; return; }
  const comp = A.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(A.destination);
  out = A.createGain(); out.gain.value = save.sound ? .85 : 0; out.connect(comp);
  const conv = A.createConvolver(); conv.buffer = impulse(5, 2.4); const rg = A.createGain(); rg.gain.value = .6; conv.connect(rg); rg.connect(out); revIn = conv;
  const dl = A.createDelay(1); dl.delayTime.value = .43; const fb = A.createGain(); fb.gain.value = .34; const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
  dl.connect(lp); lp.connect(fb); fb.connect(dl); const eg = A.createGain(); eg.gain.value = .3; lp.connect(eg); eg.connect(out); eg.connect(revIn); echoIn = A.createGain(); echoIn.gain.value = .5; echoIn.connect(dl);
  noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const wn = A.createBufferSource(); wn.buffer = noiseBuf; wn.loop = true; windF = A.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 450; windF.Q.value = .7;
  const wg = A.createGain(); wg.gain.value = .022; wn.connect(windF); windF.connect(wg); wg.connect(out); wg.connect(revIn); wn.start();
  const sn = A.createBufferSource(); sn.buffer = noiseBuf; sn.loop = true; swF = A.createBiquadFilter(); swF.type = 'bandpass'; swF.frequency.value = 3000; swF.Q.value = .9;
  swG = A.createGain(); swG.gain.value = 0; sn.connect(swF); swF.connect(swG); swG.connect(out); sn.start();
  droneG = A.createGain(); droneG.gain.value = 0; const dlp = A.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 650; droneG.connect(dlp); dlp.connect(out); dlp.connect(revIn);
  for (const r of [.5, 1, 1.5, 1.004]) { const o = A.createOscillator(); o.type = 'sine'; o.connect(droneG); o.start(); droneO.push({ o, r }); }
  const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = .06; lg.gain.value = .018; lfo.connect(lg); lg.connect(droneG.gain); lfo.start();
  droneG.gain.setTargetAtTime(.045, A.currentTime, 4); tune(); clock.tokAt = A.currentTime + 18;
}

/** Accorde la nappe grave sur la lumière choisie. */
export function tune() { if (!A) return; const f = mood().root / 2; droneO.forEach(d => d.o.frequency.setTargetAtTime(f * d.r, A.currentTime, 1.2)); }

/** Coupe ou rend le son en douceur. @param {boolean} on */
export function setVolume(on) { if (!A) return; out.gain.setTargetAtTime(on ? .85 : 0, A.currentTime, .2); if (on && A.state === 'suspended') A.resume(); }

/** @param {any} n @param {number} pan */
function voice(n, pan) {
  let x = n;
  if (A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); x = p; }
  x.connect(out); x.connect(revIn); return x;
}

/** Note de koto. @param {number} f @param {number} vel @param {number} pan */
export function pluck(f, vel, pan) {
  if (!A || !save.sound) return; const t = A.currentTime;
  const o = A.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + .06);
  const o2 = A.createOscillator(); o2.frequency.value = f * 2.003; const g2 = A.createGain(); g2.gain.value = .22;
  const fl = A.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.5; fl.frequency.setValueAtTime(5200, t); fl.frequency.exponentialRampToValueAtTime(650, t + .55);
  const g = A.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + 3);
  o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); voice(g, pan).connect(echoIn);
  o.start(t); o2.start(t); o.stop(t + 3.1); o2.stop(t + 3.1);
}

/** Cloche (pierre posée). @param {number} f @param {number} x */
export function bell(f, x) {
  if (!A || !save.sound) return; const t = A.currentTime, pan = x / G.vw * 1.4 - .7;
  for (const [r, a, d] of [[1, 1, 7], [2.76, .42, 4.5], [5.4, .22, 2.6], [8.93, .1, 1.4], [.5, .3, 8]]) {
    const o = A.createOscillator(); o.frequency.value = f * r; const g = A.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.11 * a, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); voice(g, pan); o.start(t); o.stop(t + d + .1);
  }
}

/** « Toc » du bambou. @param {number} [v] */
export function tok(v = 1) {
  if (!A || !save.sound) return; const t = A.currentTime;
  for (const [dt, f] of [[0, 640], [.11, 520]]) {
    const o = A.createOscillator(); o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * .5, t + dt + .09);
    const g = A.createGain(); g.gain.setValueAtTime(.0001, t + dt); g.gain.exponentialRampToValueAtTime(.22 * v, t + dt + .003); g.gain.exponentialRampToValueAtTime(.0001, t + dt + .22);
    o.connect(g); voice(g, .4); o.start(t + dt); o.stop(t + dt + .3);
  }
}

let lastK = -1, lastNoteT = 0;
/** Note de la gamme selon la hauteur à l'écran (plus aiguë en haut). @param {number} x @param {number} y @param {number} [vel] */
export function note(x, y, vel = .15) {
  if (!A || !save.sound) return; const now = performance.now(); if (now - lastNoteT < 110) return; lastNoteT = now;
  const m = mood(), sc = m.scale, N = sc.length * 2 + 1; let k = Math.round((1 - y / G.vh) * (N - 1));
  if (Math.random() < .3) k += Math.random() < .5 ? -1 : 1; k = clamp(k, 0, N - 1); if (k === lastK) k += k < N - 1 ? 1 : -1; lastK = k;
  const f = m.root * Math.pow(2, Math.floor(k / sc.length) - 1 + sc[k % sc.length] / 12);
  pluck(f, vel * (.6 + Math.random() * .4), x / G.vw * 1.4 - .7);
}

/** Bruit du râteau dans le sable. @param {number} speed @param {boolean} [low] */
export function swish(speed, low = false) {
  if (!A) return; const t = A.currentTime;
  swG.gain.setTargetAtTime(save.sound ? Math.min(.08, speed * .011) : 0, t, .06); swF.frequency.setTargetAtTime(low ? 1100 : 2600 + speed * 120, t, .1);
}

/** Le vent ondule et le bambou sonne de temps en temps. @param {number} t @param {boolean} entered */
export function ambience(t, entered) {
  if (!A) return;
  if (save.sound && entered && A.currentTime > clock.tokAt) { clock.tokAt = A.currentTime + 28 + Math.random() * 30; tok(.7); }
  if (windF) windF.frequency.setTargetAtTime(380 + Math.sin(t * .00013) * 160 + Math.sin(t * .00041) * 60, A.currentTime, .5);
}
