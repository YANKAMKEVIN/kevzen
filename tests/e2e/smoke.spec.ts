// Fumée : charge le jeu sur ordinateur et téléphones, le lance, joue ~20 s avec de vraies entrées
// (clavier et souris, ou doigt par CDP) et échoue sur toute erreur, requête en échec, débordement,
// bouton inaccessible ou animation trop lente.
import { devices, type Page, type BrowserContextOptions } from '@playwright/test';
import { test, expect, sleep, SHOTS, watchErrors } from './helpers';

const PLAY_MS = Number(process.env.SMOKE_PLAY_MS || 20000);
const MIN_FPS = 8;
const strip = ({ defaultBrowserType: _, ...d }: (typeof devices)[string]): BrowserContextOptions => d;
const PROFILES: { name: string; ctx: BrowserContextOptions; touch: boolean }[] = [
  { name: 'ordinateur', ctx: { viewport: { width: 1280, height: 800 } }, touch: false },
  { name: 'iphone-se', ctx: strip(devices['iPhone SE']), touch: true },
  { name: 'pixel7-paysage', ctx: { ...strip(devices['Pixel 7']), viewport: { width: 915, height: 412 } }, touch: true },
];

/** Chaque bouton visible doit pouvoir être amené à l'écran (défilement compris) et y tenir. */
async function offscreen(page: Page): Promise<string[]> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, [role=button], a[href], input, select')) {
      const cs = getComputedStyle(el), r0 = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r0.width === 0 || r0.height === 0) continue;
      if (el.closest('[hidden], [aria-hidden=true], [inert]')) continue;
      // tiroir fermé, rangé hors écran par une transformation : ce n'est pas un bug
      let a: HTMLElement | null = el, moved = false;
      while ((a = a.parentElement)) if (getComputedStyle(a).transform !== 'none') { moved = true; break; }
      if (moved) continue;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1)
        out.push(`${el.id ? '#' + el.id : el.tagName.toLowerCase()} « ${(el.innerText || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').trim().slice(0, 30)} »`);
    }
    window.scrollTo(0, 0);
    return out;
  });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (ov > 2) bad.push(`la page déborde de ${ov} px à l'horizontale`);
  return bad;
}

const fps = (page: Page, ms = 2000): Promise<number> => page.evaluate(ms => new Promise<number>(res => {
  let n = 0; const t0 = performance.now();
  (function f(t: number) { n++; if (t - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (t - t0)); })(t0);
}), ms);

for (const prof of PROFILES) {
  test(`fumée : ${prof.name}`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext(prof.ctx);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    page.on('requestfailed', r => { if (r.url().startsWith(baseURL ?? '')) errors.push(`requête échouée ${r.url()}`); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.goto('index.html', { waitUntil: 'load' });
    await sleep(1500);
    expect.soft(await offscreen(page), 'accueil : boutons dans l\'écran').toEqual([]);
    await page.screenshot({ path: `${SHOTS}/${prof.name}-1-accueil.png` });
    const go = page.locator('#go');
    if (prof.touch) await go.tap(); else await go.click();
    await sleep(1600);
    if (!prof.touch) {
      const f = await fps(page);
      expect.soft(f, `${f.toFixed(1)} images/s, minimum ${MIN_FPS}`).toBeGreaterThanOrEqual(MIN_FPS);
    }
    const { width: w, height: h } = page.viewportSize() ?? { width: 0, height: 0 };
    const cdp = prof.touch ? await ctx.newCDPSession(page) : null;
    const keys = ['Digit1', 'Digit2'];
    const t0 = Date.now(); let i = 0;
    while (Date.now() - t0 < PLAY_MS) {
      i++;
      if (cdp) {
        // glissé dans la zone de jeu
        const x = w * (0.3 + 0.4 * Math.random()), y = h * (0.35 + 0.35 * Math.random());
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + k * 12 * (i % 2 ? 1 : -1), y: y + k * 4 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(250);
      } else {
        const k = keys[i % keys.length];
        await page.keyboard.down(k); await sleep(180 + (i % 3) * 120); await page.keyboard.up(k);
        if (i % 4 === 0) await page.mouse.click(w * (0.3 + 0.4 * Math.random()), h * (0.35 + 0.35 * Math.random()));
      }
    }
    await page.screenshot({ path: `${SHOTS}/${prof.name}-2-partie.png` });
    expect.soft(await offscreen(page), 'en jeu : boutons dans l\'écran').toEqual([]);
    expect(errors, 'aucune erreur ni requête en échec').toEqual([]);
    await ctx.close();
  });
}
