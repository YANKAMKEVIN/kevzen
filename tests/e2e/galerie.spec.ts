// Galerie : enregistrer (avec son), changer de jardin, rouvrir, recharger la page, renommer,
// mettre à jour, jardin abîmé mis de côté, effacer avec confirmation, Échap.
import { test, check, sleep, drag, serialized, same, enter, pressed, SHOTS } from './helpers';

test('galerie : enregistrer, rouvrir, recharger, renommer, abîmé, effacer', async ({ page }) => {
  await enter(page);
  await drag(page, [[200, 640], [600, 560], [1000, 650]]);

  const saved = await serialized(page);
  await test.step('enregistrer, puis rouvrir', async () => {
    await page.keyboard.press('g'); await sleep(300);
    check(await page.locator('#galerie').isVisible(), 'la galerie s\'ouvre (touche G)');
    check(await page.locator('#galEmpty').isVisible(), 'galerie vide au départ');
    await page.click('#galSave'); await sleep(200);
    check(await page.locator('#galList li').count() === 1, 'le jardin est enregistré dans la galerie');
    check((await page.locator('#galMsg').innerText()).includes('enregistré'), 'message de confirmation');
    check(await page.evaluate(() => __kz.heard.last) === 'enregistrer', 'Enregistrer a son petit carillon');
    check(await page.evaluate(() => (localStorage.getItem('kevzen.galerie') || '').includes('data:image/jpeg')), 'avec sa vignette');
    await page.keyboard.press('1');
    check(await pressed(page, '#t-rake') === 'true' && await pressed(page, '#t-stone') === 'false', 'raccourcis du jardin suspendus quand la galerie est ouverte');
    await page.click('#galClose'); await sleep(200);
    check(!(await page.locator('#galerie').isVisible()), 'la galerie se ferme');
    await page.click('#new'); await sleep(2500);
    check(JSON.stringify((await serialized(page)).stones) !== JSON.stringify(saved.stones), 'un autre jardin à l\'écran');
    await page.click('#gal'); await sleep(200);
    await page.click('#galList li .open'); await sleep(300);
    check(same(await serialized(page), saved), 'Ouvrir rend le jardin enregistré, pierres et sable');
    check(!(await page.locator('#galerie').isVisible()), 'la galerie se referme à l\'ouverture d\'un jardin');
    await page.click('#undo'); await sleep(200);
    check(JSON.stringify((await serialized(page)).stones) !== JSON.stringify(saved.stones), 'ouvrir un jardin s\'annule');
    await page.click('#redo'); await sleep(200);
  });

  await test.step('après rechargement', async () => {
    await page.reload(); await sleep(400);
    await page.click('#go'); await sleep(1900);
    await page.click('#gal'); await sleep(200);
    check(await page.locator('#galList li').count() === 1, 'après rechargement, le jardin est toujours dans la galerie');
    await page.fill('#galList li .nm', 'Jardin du matin'); await page.press('#galList li .nm', 'Enter'); await sleep(200);
    check(await page.inputValue('#galList li .nm') === 'Jardin du matin', 'renommer un jardin');
    await page.click('#galList li .open'); await sleep(300);
    check(same(await serialized(page), saved), 'après rechargement, Ouvrir rend le même jardin');
    await page.screenshot({ path: `${SHOTS}/partie-galerie-rouvert.png` });
  });

  await test.step('mise à jour, jardin abîmé, effacer', async () => {
    await page.click('#gal'); await sleep(200);
    check(await page.innerText('#galSave') === 'Mettre à jour ce jardin', 'le jardin rouvert se met à jour');
    await page.click('#galSave'); await sleep(200);
    check(await page.locator('#galList li').count() === 1, 'mise à jour : pas de doublon');
    await page.click('#galClose'); await page.click('#new'); await sleep(300); await page.click('#gal'); await sleep(200);
    check(await page.innerText('#galSave') === 'Enregistrer ce jardin', 'après Nouveau, on enregistre un autre jardin');
    await page.click('#galSave'); await sleep(200);
    check(await page.locator('#galList li').count() === 2, 'deux jardins enregistrés');
    await page.screenshot({ path: `${SHOTS}/partie-galerie.png` });
    const badId = await page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('kevzen.jardin.') && !k.endsWith('.abimee')) as string; localStorage.setItem(k, '{abîmé'); return k.slice('kevzen.jardin.'.length); });
    await page.click('#galClose'); await page.click('#gal'); await sleep(200);
    await page.click(`#galList li[data-id="${badId}"] .open`); await sleep(300);
    check(await page.locator('#galerie').isVisible() && (await page.innerText('#galMsg')).includes('abîmé'), 'ouvrir un jardin abîmé : message, la galerie reste ouverte');
    check(await page.locator('#galList li').count() === 1, 'le jardin abîmé est retiré de la galerie, l\'autre reste');
    check(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('kevzen.jardin.') && k.endsWith('.abimee'))), 'le jardin abîmé est mis de côté');
    await page.locator('#galList li .del').click(); await sleep(100);
    check(await page.locator('#galList li .del').innerText() === 'Sûr ?', 'effacer demande confirmation');
    await page.locator('#galList li .del').click(); await sleep(200);
    check(await page.locator('#galList li').count() === 0, 'jardin effacé');
    await page.keyboard.press('Escape'); await sleep(200);
    check(!(await page.locator('#galerie').isVisible()) && !(await page.evaluate(() => __kz.ui.panel)), 'Échap ferme la galerie');
  });
});
