// Téléphones : écran très dense (résolution plafonnée), puis un jardin joué au doigt sur iPhone SE
// avec de vrais événements tactiles envoyés par CDP : ratisser, poser et retirer une pierre, galerie,
// export/import à portée de pouce, jardin gardé et repris, second doigt ignoré.
import { devices, type BrowserContextOptions } from '@playwright/test';
import { test, check, sleep, snap, changed, stones, freeSpot, swipe, touchTap, touchEl, serialized, same, watchErrors, expect, SHOTS, URL_SEED, URL_FREE } from './helpers';

const strip = ({ defaultBrowserType: _, ...d }: (typeof devices)[string]): BrowserContextOptions => d;

test('écran 3x : résolution plafonnée à 2', async ({ browser }) => {
  const dense = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const dp = await dense.newPage();
  await dp.goto(URL_SEED); await sleep(500);
  const dv = await dp.evaluate(() => [__kz.view.dpr, (document.getElementById('g') as HTMLCanvasElement).width, innerWidth]);
  check(dv[0] === 2 && dv[1] === dv[2] * 2, `écran 3x : résolution plafonnée à 2 (${dv[1]} px pour ${dv[2]})`);
  await dense.close();
});

test('iPhone SE au doigt : ratisser, pierre, galerie, fichier, reprise', async ({ browser }) => {
  const ctx = await browser.newContext(strip(devices['iPhone SE']));
  const tel = await ctx.newPage();
  const terr = watchErrors(tel);
  const cdp = await ctx.newCDPSession(tel);
  await tel.goto(URL_SEED);
  await touchEl(tel, cdp, '#go'); await sleep(1900);
  check(await tel.locator('#intro').isHidden(), 'iPhone SE : entrer au doigt');

  await snap(tel);
  await swipe(cdp, [[40, 200], [200, 160], [290, 260]]);
  check(await changed(tel) > 100, 'iPhone SE : ratisser au doigt');
  await touchEl(tel, cdp, '#t-stone');
  check(await tel.getAttribute('#t-stone', 'aria-pressed') === 'true', 'iPhone SE : outil pierre au doigt');
  const [tx, ty] = await freeSpot(tel);
  const tb = await stones(tel);
  await touchTap(cdp, tx, ty); await sleep(1200);
  check(await stones(tel) === tb + 1, 'iPhone SE : toucher pose une pierre');
  await touchTap(cdp, tx, ty); await sleep(200);
  check(await stones(tel) === tb, 'iPhone SE : toucher la pierre la retire');
  await tel.tap('#t-stone'); await tel.touchscreen.tap(tx, ty); await sleep(1200);
  check(await stones(tel) === tb + 1, 'iPhone SE : toucher (API tactile Playwright) pose aussi une pierre');
  await touchEl(tel, cdp, '#undo'); await sleep(200);
  check(await stones(tel) === tb, 'iPhone SE : Annuler au doigt');
  await touchEl(tel, cdp, '#redo'); await sleep(200);
  check(await stones(tel) === tb + 1, 'iPhone SE : Rétablir au doigt');
  await touchEl(tel, cdp, '#t-rake');

  // un second doigt posé pendant le geste est ignoré (un seul pointeur à la fois)
  // une bande libre de pierres ; geste en biais (un geste horizontal refait les sillons droits d'origine)
  const ly = await tel.evaluate(() => { for (let y = 150; y < 450; y += 10) if (__kz.G.stones.every(s => Math.abs(s.y - y) > s.r * 2 + 50)) return y; return 300; });
  await snap(tel);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 40, y: ly, id: 1 }] });
  for (let s = 1; s <= 14; s++) {
    await cdp.send('Input.dispatchTouchEvent', { type: s === 4 ? 'touchStart' : 'touchMove', touchPoints: [{ x: 40 + s * 16, y: ly + s * 5, id: 1 }, ...(s >= 4 ? [{ x: 250, y: 100, id: 2 }] : [])] });
    await sleep(16);
  }
  await sleep(250);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(150);
  check(await changed(tel) > 50, 'iPhone SE : deux doigts, le premier ratisse toujours');
  check(!(await tel.evaluate(() => document.body.classList.contains('quiet'))), 'iPhone SE : geste bien terminé après deux doigts');

  const box = await tel.locator('#bar').boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= 321, 'iPhone SE : barre d\'outils dans l\'écran');
  await tel.screenshot({ path: `${SHOTS}/partie-iphone.png` });

  await touchEl(tel, cdp, '#gal'); await sleep(400);
  await touchEl(tel, cdp, '#galSave'); await sleep(300);
  check(await tel.locator('#galList li').count() === 1, 'iPhone SE : enregistrer dans la galerie');
  const gb = await tel.locator('#galerie').boundingBox(), ob = await tel.locator('#galList li .open').boundingBox();
  check(!!gb && gb.x >= 0 && gb.x + gb.width <= 321 && !!ob && ob.x + ob.width <= 321, 'iPhone SE : galerie dans l\'écran');
  for (const sel of ['#galExport', '#galImport']) {
    const b = await tel.locator(sel).boundingBox();
    check(!!b && b.x >= 0 && b.x + b.width <= 321 && b.height >= 44, `iPhone SE : ${sel} dans l'écran, assez grand pour le pouce`);
  }
  const [dl] = await Promise.all([tel.waitForEvent('download'), touchEl(tel, cdp, '#galExport')]);
  check(dl.suggestedFilename().endsWith('.kevzen.json'), 'iPhone SE : exporter au doigt');
  await tel.screenshot({ path: `${SHOTS}/partie-iphone-galerie.png` });
  await touchEl(tel, cdp, '#galList li .open'); await sleep(400);
  check(!(await tel.locator('#galerie').isVisible()), 'iPhone SE : rouvrir un jardin');

  // le jardin joué au doigt est gardé, et revient au rechargement
  await swipe(cdp, [[60, 380], [260, 420]]);
  await tel.waitForFunction(() => __kz.autosave.writes > 0 && __kz.autosave.last === 'ok', null, { timeout: 10000 });
  await sleep(1500);
  const kept = await serialized(tel);
  await tel.goto(URL_FREE);
  check(same(await serialized(tel), kept), 'iPhone SE : le jardin revient après rechargement');
  check(await tel.locator('#resume').isVisible(), 'iPhone SE : l\'accueil annonce le jardin retrouvé');
  expect(terr, 'iPhone SE : aucune erreur').toEqual([]);
  await ctx.close();
});
