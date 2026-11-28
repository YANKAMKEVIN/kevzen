// Partie complète à la souris et au clavier : accueil (le jardinier ratisse tout seul) -> entrée
// -> coups de râteau -> râteau large et fin -> pierre posée puis retirée -> annuler -> rétablir (avec son)
// -> lisser -> nouveau jardin -> méditer -> rendu incrémental -> onglet caché.
import { test, check, sleep, snap, changed, changedCells, stones, pressed, drag, freeSpot, hide, SHOTS, URL_SEED } from './helpers';

test('partie complète : chaque outil, annuler, rétablir, nouveau, méditer, onglet caché', async ({ page }) => {
  await test.step('accueil', async () => {
    await page.goto(URL_SEED);
    check(/^v\d+\.\d+\.\d+$/.test(await page.locator('#ver').innerText()), 'numéro de version sur l\'accueil');
    await page.waitForFunction(() => __kz.art !== undefined, null, { timeout: 10000 });
    check(await page.evaluate(() => __kz.art) === 6, 'les 6 visuels peints sont chargés (titre, sable, 4 pierres)');
    check((await page.locator('#intro').evaluate(e => getComputedStyle(e).backgroundImage)).includes('titre.webp'), 'tableau peint sous l\'accueil');
    check(await page.locator('#resume').isHidden(), 'premier passage : pas de jardin à reprendre');
    const n0 = await stones(page);
    check(n0 >= 2 && n0 <= 7, `jardin composé (${n0} pierres)`);
    await snap(page); await sleep(2500);
    check(await changed(page) > 50, 'sur l\'accueil, le jardinier ratisse tout seul');
    await page.screenshot({ path: `${SHOTS}/partie-accueil.png` });
    await page.click('#go'); await sleep(1900);
    check(await page.locator('#intro').isHidden(), 'entrée dans le jardin');
    check(await page.evaluate(() => __kz.ui.entered && !__kz.ui.autoOn), 'le jardinier s\'arrête quand on entre');
  });

  await test.step('râteau', async () => {
    await snap(page); await sleep(300);
    check(await changed(page) < 1e-3, 'sans geste, le sable ne bouge pas');
    await drag(page, [[200, 640], [600, 560], [1000, 650], [1100, 300]]);
    const raked = await changed(page);
    check(raked > 300, `le râteau creuse le sable (${raked | 0})`);
    check(await page.evaluate(() => __kz.G.undoS.length) >= 1, 'le geste peut être annulé');
    await page.click('#tines');
    check(await page.evaluate(() => __kz.G.tines) === 8 && await page.locator('#tinesL').innerText() === 'Large', 'râteau large');
    await snap(page); await drag(page, [[150, 200], [400, 260]]);
    const wide = await changedCells(page);
    await page.click('#tines');
    check(await page.evaluate(() => __kz.G.tines) === 3, 'râteau fin');
    await snap(page); await drag(page, [[150, 200], [400, 260]]);
    const thin = await changedCells(page);
    check(wide > thin * 1.6, `le râteau large couvre plus de sable (${wide} contre ${thin})`);
    await page.click('#tines');
  });

  let before = 0;
  await test.step('pierre, annuler, rétablir', async () => {
    await page.keyboard.press('2');
    check(await pressed(page, '#t-stone') === 'true', 'outil pierre (touche 2)');
    const [sx, sy] = await freeSpot(page);
    before = await stones(page);
    await page.mouse.click(sx, sy); await sleep(1200);
    check(await stones(page) === before + 1, 'une pierre est posée là où on clique');
    check(await page.evaluate(([x, y]) => { const { G } = __kz, s = G.stones[G.stones.length - 1]; return Math.hypot(s.x - x, s.y - y) < 1 && G.grow.length === 0 && G.mask[Math.round(y / 2) * G.W + Math.round(x / 2)] === 1; }, [sx, sy]), 'ses cercles se sont tracés autour');
    await page.screenshot({ path: `${SHOTS}/partie-pierre.png` });
    await page.mouse.click(sx, sy); await sleep(200);
    check(await stones(page) === before, 'cliquer sur la pierre la retire');

    await page.click('#undo'); await sleep(200);
    check(await stones(page) === before + 1, 'Annuler remet la pierre');
    check(await page.evaluate(() => __kz.heard.last) === 'annuler', 'Annuler a son petit son');
    await page.keyboard.press('z'); await sleep(200);
    check(await stones(page) === before, 'Z annule la pose');

    check(await page.isEnabled('#redo'), 'Rétablir disponible après une annulation');
    const h0 = await page.evaluate(() => __kz.heard.count);
    await page.keyboard.press('Shift+Z'); await sleep(200);
    check(await stones(page) === before + 1, 'Maj+Z rétablit la pose');
    check(await page.evaluate(h0 => __kz.heard.last === 'retablir' && __kz.heard.count === h0 + 1, h0), 'Rétablir a son propre son, distinct d\'Annuler');
    await page.keyboard.press('Shift+Z'); await sleep(200);
    check(await stones(page) === before, 'Maj+Z rétablit le retrait');
    check(await page.isDisabled('#redo'), 'Rétablir grisé quand tout est rétabli');
    await page.keyboard.press('z'); await sleep(150);
    await page.keyboard.press('Control+y'); await sleep(200);
    check(await stones(page) === before && await page.isDisabled('#redo'), 'Ctrl+Y rétablit aussi');
    const h1 = await page.evaluate(() => __kz.heard.count);
    await page.keyboard.press('Shift+Z'); await sleep(150);
    check(await page.evaluate(h1 => __kz.heard.count === h1, h1), 'rien à rétablir : aucun son');
    await page.click('#undo'); await sleep(150);
    check(await stones(page) === before + 1, 'bouton Annuler');
    await page.click('#redo'); await sleep(150);
    check(await stones(page) === before && await page.evaluate(() => __kz.heard.last) === 'retablir', 'bouton Rétablir, avec son son');
  });

  await test.step('lisser, nouveau, méditer', async () => {
    await page.keyboard.press('3');
    check(await pressed(page, '#t-smooth') === 'true', 'outil lisser (touche 3)');
    const rough = (): Promise<number> => page.evaluate(() => { const { G } = __kz; let s = 0; for (let y = 270; y < 300; y++) for (let x = 250; x < 400; x++) s += Math.abs(G.hm[y * G.W + x]); return s; });
    const r0 = await rough();
    for (let k = 0; k < 4; k++) await drag(page, [[500, 540 + k * 8], [800, 540 + k * 8], [500, 560 + k * 8]]);
    const r1 = await rough();
    check(r1 < r0 * .7, `lisser efface les traces (${r0 | 0} -> ${r1 | 0})`);
    await page.keyboard.press('1');

    await snap(page);
    await page.click('#new'); await sleep(2500);
    check(await page.evaluate(() => __kz.G.sweep === null) && await changed(page) > 300, 'Nouveau : nouvelles pierres et sable repassé');

    await page.keyboard.press('m');
    check(await pressed(page, '#auto') === 'true', 'méditer (touche M)');
    await snap(page); await sleep(3000);
    check(await changed(page) > 50, 'le jardinier ratisse pour vous');
    await page.click('#auto');
    check(await pressed(page, '#auto') === 'false', 'arrêter de méditer');
  });

  await test.step('rendu incrémental et onglet caché', async () => {
    await sleep(600);
    const idle = await page.evaluate(() => new Promise<number[]>(res => { const a = { ...__kz.stats }; setTimeout(() => res([__kz.stats.frames - a.frames, __kz.stats.shaded - a.shaded]), 800); }));
    check(idle[0] > 3 && idle[1] === 0, `au repos : ${idle[0]} images, ${idle[1]} pixels de sable recalculés`);
    await snap(page); await drag(page, [[300, 300], [420, 330]]);
    check(await page.evaluate(() => __kz.stats.shaded) > 0, 'un geste recalcule le sable');

    await hide(page, true);
    const f0 = await page.evaluate(() => __kz.stats.frames); await sleep(600);
    check(await page.evaluate(() => !__kz.loop.running) && await page.evaluate(() => __kz.stats.frames) - f0 <= 1, 'onglet caché : plus aucune image dessinée');
    await hide(page, false); await sleep(1200);
    check(await page.evaluate(() => __kz.loop.running) && await page.evaluate(() => __kz.stats.frames) - f0 > 3, 'onglet revenu : le jardin repart');
  });
});
