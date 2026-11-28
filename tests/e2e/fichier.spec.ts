// Jardin en fichier : exporter (téléchargement réel), réimporter, et refuser proprement les fichiers
// vides, illisibles, étrangers, trop récents, abîmés ou trop gros, sans toucher au jardin affiché.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, check, sleep, drag, serialized, same, enter, autosaved, URL_FREE, SHOTS } from './helpers';

async function exportFile(page: Page): Promise<{ name: string; text: string; path: string }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#galExport')]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), text: readFileSync(path, 'utf8'), path };
}
const importBuffer = (page: Page, name: string, text: string | Buffer): Promise<void> =>
  page.setInputFiles('#galFile', { name, mimeType: 'application/json', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) });

test('exporter puis réimporter un jardin', async ({ page }) => {
  await enter(page);
  await page.click('[data-mood="soir"]');
  await drag(page, [[200, 640], [600, 560], [1000, 650]]);
  const g = await serialized(page);
  await page.click('#gal');
  check(await page.locator('#galExport').isVisible() && await page.locator('#galImport').isVisible(), 'boutons Exporter et Importer dans la galerie');
  const f = await exportFile(page);
  check(f.name === 'mon-jardin.kevzen.json', `nom du fichier (${f.name})`);
  const data = JSON.parse(f.text);
  check(data.app === 'kevzen' && data.kind === 'jardin' && data.version === 1 && data.mood === 'soir' && data.name === 'Mon jardin', 'fichier versionné : appli, sorte, version, lumière, nom');
  check(same(data.garden, g), 'le fichier contient le jardin à l\'écran');
  check(f.text.length < 60000, `fichier léger (${(f.text.length / 1024).toFixed(1)} Ko)`);
  check((await page.innerText('#galMsg')).includes('exporté'), 'message de confirmation');
  check(await page.evaluate(() => __kz.heard.last) === 'enregistrer', 'l\'export sonne comme un enregistrement');
  await page.screenshot({ path: `${SHOTS}/fichier-export.png` });

  // un autre jardin, une autre lumière, puis on réimporte
  await page.click('#galClose');
  await page.click('[data-mood="midi"]'); await page.click('#new'); await sleep(2600);
  check(!same(await serialized(page), g), 'un autre jardin à l\'écran');
  await page.click('#gal');
  await page.setInputFiles('#galFile', f.path);
  await sleep(300);
  check(!(await page.locator('#galerie').isVisible()), 'importer un bon fichier ouvre le jardin et ferme la galerie');
  check(same(await serialized(page), g), 'le jardin importé est identique, pierres et sable');
  check(await page.getAttribute('[data-mood="soir"]', 'aria-pressed') === 'true', 'sa lumière revient');
  await page.click('#undo'); await sleep(200);
  check(!same(await serialized(page), g), 'importer s\'annule comme un geste');
  await page.click('#redo'); await sleep(200);
  check(same(await serialized(page), g), 'et se rétablit');

  // enregistré dans la galerie sous le nom du fichier, et exporté sous le nom de la galerie
  await page.click('#gal'); await page.click('#galSave');
  check(await page.inputValue('#galList li .nm') === 'Mon jardin', 'enregistré sous le nom du fichier importé');
  await page.fill('#galList li .nm', 'Jardin du matin'); await page.press('#galList li .nm', 'Enter'); await sleep(150);
  check((await exportFile(page)).name === 'jardin-du-matin.kevzen.json', 'exporter un jardin de la galerie garde son nom');

  // le jardin importé est gardé automatiquement
  await page.click('#galClose');
  await page.goto(URL_FREE); await page.click('#go'); await sleep(1900);
  await drag(page, [[300, 300], [500, 330]]); await autosaved(page);
  const now = await serialized(page);
  await page.click('#gal'); await page.setInputFiles('#galFile', f.path); await sleep(300);
  await autosaved(page, 2); await sleep(300);
  await page.reload();
  check(same(await serialized(page), g) && !same(now, g), 'après rechargement, le jardin importé revient');
});

test('fichiers invalides : message clair, jardin intact, galerie ouverte', async ({ page }) => {
  await enter(page);
  await drag(page, [[200, 640], [600, 560]]);
  await page.click('#gal');
  const good = JSON.parse((await exportFile(page)).text);
  const before = await serialized(page);
  const cases: [string, string | Buffer, string][] = [
    ['vide.kevzen.json', '', 'vide'],
    ['blancs.kevzen.json', '   \n  ', 'vide'],
    ['casse.kevzen.json', '{"app":"kevzen", "kind": "jar', 'illisible'],
    ['image.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), 'illisible'],
    ['autre.json', JSON.stringify({ name: 'facture', total: 12 }), 'ne vient pas de KevZen'],
    ['tableau.json', '[1,2,3]', 'ne vient pas de KevZen'],
    ['futur.kevzen.json', JSON.stringify({ ...good, version: 2 }), 'plus récente'],
    ['sable.kevzen.json', JSON.stringify({ ...good, garden: { ...good.garden, sand: good.garden.sand.slice(0, 12) } }), 'abîmé'],
    ['pierres.kevzen.json', JSON.stringify({ ...good, garden: { ...good.garden, stones: [{ x: 'a' }] } }), 'abîmé'],
    ['grille.kevzen.json', JSON.stringify({ ...good, garden: { ...good.garden, W: 99999 } }), 'abîmé'],
    ['lumiere.kevzen.json', JSON.stringify({ ...good, mood: 'minuit' }), 'abîmé'],
    ['enorme.kevzen.json', Buffer.alloc(2_100_000, 32), 'trop gros'],
  ];
  for (const [name, content, msg] of cases) {
    await page.locator('#galMsg').evaluate(e => { e.textContent = ''; });
    await importBuffer(page, name, content);
    await page.waitForFunction(() => (document.getElementById('galMsg')?.textContent ?? '') !== '', null, { timeout: 4000 });
    const shown = await page.innerText('#galMsg');
    check(shown.includes(msg), `${name} : « ${shown} »`);
    check(await page.locator('#galerie').isVisible(), `${name} : la galerie reste ouverte`);
  }
  await page.screenshot({ path: `${SHOTS}/fichier-invalide.png` });
  check(same(await serialized(page), before), 'aucun fichier invalide n\'a touché au jardin');
  check(await page.evaluate(() => __kz.G.undoS.length) === 1, 'ni à l\'historique');
  // le même fichier choisi deux fois de suite est relu
  await importBuffer(page, 'vide.kevzen.json', '');
  await page.locator('#galMsg').evaluate(e => { e.textContent = ''; });
  await importBuffer(page, 'vide.kevzen.json', '');
  await sleep(300);
  check((await page.innerText('#galMsg')).includes('vide'), 'le même fichier choisi deux fois est relu');
});
