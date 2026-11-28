// Outils communs aux tests de bout en bout : gestes à la souris et au doigt (vrais événements tactiles
// envoyés par CDP), mesures sur le jardin, et une vérification « aucune erreur » sur chaque test.
import { test as base, expect, type Page, type CDPSession } from '@playwright/test';
import { existsSync } from 'node:fs';

/** Le jardin vu par les tests (exposé par src/main.ts sous window.__kz). */
interface Kz {
  G: { hm: Float32Array; vw: number; vh: number; W: number; mask: Uint8Array; tines: number; undoS: unknown[]; redoS: unknown[]; grow: unknown[]; sweep: unknown; stones: { x: number; y: number; r: number }[] };
  ui: { entered: boolean; autoOn: boolean; panel: boolean; galleryId: string | null; resumed: boolean };
  stats: { frames: number; shaded: number };
  view: { dpr: number };
  loop: { running: boolean };
  art?: number;
  serialize(): Garden;
  autosave: { writes: number; last: string; resumed: boolean };
  heard: { last: string; count: number };
}
export interface Garden { stones: unknown[]; sand: string; tines: number; vw: number; vh: number }
declare global {
  const __kz: Kz;
  interface Window { __h: Float32Array }
}

if (!existsSync('dist/index.html')) throw new Error('dist/ absent : lancez d\'abord npm run build');

export const URL_SEED = 'index.html?graine=5';
export const URL_FREE = 'index.html';
export const SHOTS = 'test-results/captures';
export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/** Une vérification qui n'arrête pas le test (comme l'ancienne partie : toutes les vérifications sont faites). */
export const check = (ok: boolean, msg: string): void => { expect.soft(ok, msg).toBe(true); };

/** Relève les erreurs de la page (console, exceptions). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

/** Chaque test vérifie à la fin que sa page principale n'a montré aucune erreur. */
export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors = watchErrors(page);
    await use(errors);
    expect(errors, 'aucune erreur dans la page').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** Ouvre le jardin et entre (accueil passé). */
export async function enter(page: Page, url = URL_SEED): Promise<void> {
  await page.goto(url);
  await page.click('#go');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 4000 });
}

/** Garde une copie du sable, puis mesure combien il a changé depuis. */
export const snap = (page: Page): Promise<void> => page.evaluate(() => { window.__h = __kz.G.hm.slice(); });
export const changed = (page: Page): Promise<number> => page.evaluate(() => { const a = window.__h, b = __kz.G.hm; let d = 0; for (let i = 0; i < b.length; i++) d += Math.abs(a[i] - b[i]); return d; });
export const changedCells = (page: Page): Promise<number> => page.evaluate(() => { const a = window.__h, b = __kz.G.hm; let n = 0; for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) n++; return n; });
export const stones = (page: Page): Promise<number> => page.evaluate(() => __kz.G.stones.length);
export const pressed = (page: Page, sel: string): Promise<string | null> => page.getAttribute(sel, 'aria-pressed');
export const serialized = (page: Page): Promise<Garden> => page.evaluate(() => __kz.serialize());
/** Même jardin : mêmes pierres et même sable. */
export const same = (a: Garden, b: Garden): boolean => JSON.stringify(a.stones) === JSON.stringify(b.stones) && a.sand === b.sand;

/** Un geste de râteau à la souris, en plusieurs mouvements. */
export async function drag(page: Page, pts: [number, number][]): Promise<void> {
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (let k = 1; k < pts.length; k++) { await page.mouse.move(pts[k][0], pts[k][1], { steps: 12 }); await sleep(30); }
  await sleep(250); await page.mouse.up(); await sleep(100);
}

/** Un geste au doigt : vrais événements tactiles (Input.dispatchTouchEvent). */
export async function swipe(cdp: CDPSession, pts: [number, number][]): Promise<void> {
  const tp = ([x, y]: [number, number]): { x: number; y: number; id: number }[] => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    for (let s = 1; s <= 10; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([ax + (bx - ax) * s / 10, ay + (by - ay) * s / 10]) }); await sleep(16); }
  }
  await sleep(250);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100);
}

/** Un toucher bref au doigt, par CDP. */
export async function touchTap(cdp: CDPSession, x: number, y: number): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(60);
}

/** Toucher le centre d'un élément au doigt, par CDP. */
export async function touchEl(page: Page, cdp: CDPSession, sel: string): Promise<void> {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`${sel} invisible`);
  await touchTap(cdp, b.x + b.width / 2, b.y + b.height / 2);
}

/** Un endroit libre (loin des pierres et de la barre d'outils). */
export const freeSpot = (page: Page): Promise<[number, number]> => page.evaluate(() => {
  const { G } = __kz;
  for (let y = G.vh * .25; y < G.vh * .7; y += 23) for (let x = G.vw * .15; x < G.vw * .85; x += 29)
    if (G.stones.every(s => Math.hypot(s.x - x, s.y - y) > s.r * 2 + 90)) return [Math.round(x), Math.round(y)] as [number, number];
  return [Math.round(G.vw / 2), Math.round(G.vh / 2)] as [number, number];
});

/** Onglet caché ou revenu (simulé : Chromium sans écran ne cache jamais l'onglet). */
export const hide = (page: Page, h: boolean): Promise<void> => page.evaluate(h => {
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, h);

/** Attend que la sauvegarde automatique ait écrit au moins `n` fois. */
export async function autosaved(page: Page, n = 1): Promise<void> {
  await page.waitForFunction(n => __kz.autosave.writes >= n, n, { timeout: 10_000 });
}
