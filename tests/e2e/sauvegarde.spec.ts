// Sauvegarde : réglages retenus (et ancien format, sauvegarde abîmée), et sauvegarde automatique
// du jardin en cours (regroupée, écrite à la fermeture, reprise au rechargement, stockage plein ou bloqué).
import { test, check, sleep, drag, serialized, same, enter, pressed, snap, changed, hide, autosaved, URL_FREE, URL_SEED, SHOTS } from './helpers';

const KEY = 'kevzen.sauvegarde';
const CUR = 'kevzen.encours';

test('réglages : lumière et son retenus, ancien format repris, sauvegarde abîmée mise de côté', async ({ page }) => {
  const save = (): Promise<{ version: number; mood: string; sound: boolean } | null> => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  await enter(page);
  await page.click('[data-mood="nuit"]'); await sleep(300);
  check(await pressed(page, '[data-mood="nuit"]') === 'true', 'lumière de nuit');
  await page.screenshot({ path: `${SHOTS}/partie-nuit.png` });
  await page.click('#snd');
  const sv = await save();
  check(!!sv && sv.version === 1 && sv.mood === 'nuit' && sv.sound === false, 'lumière et son sauvegardés');
  await page.reload(); await sleep(400);
  check(await pressed(page, '[data-mood="nuit"]') === 'true' && await pressed(page, '#snd') === 'false', 'après rechargement : nuit, son coupé');

  await page.evaluate(k => { localStorage.removeItem(k); localStorage.setItem('kevzen', JSON.stringify({ mood: 'soir', sound: false })); }, KEY);
  await page.reload(); await sleep(400);
  const mig = await save();
  check(!!mig && mig.mood === 'soir' && mig.sound === false && await page.evaluate(() => localStorage.getItem('kevzen')) === null, 'ancien format repris, ancienne clé effacée');
  check(await pressed(page, '[data-mood="soir"]') === 'true', 'le crépuscule revient');

  await page.evaluate(k => localStorage.setItem(k, '{abîmée'), KEY);
  await page.reload(); await sleep(400);
  check(await page.evaluate(k => localStorage.getItem(k + '.abimee'), KEY) === '{abîmée', 'sauvegarde abîmée mise de côté');
  check(await pressed(page, '[data-mood="aube"]') === 'true', 'le jardin repart de l\'aube');
});

test('jardin en cours : gardé après un geste, repris tel quel au rechargement', async ({ page }) => {
  await enter(page, URL_FREE);
  check(await page.evaluate(k => localStorage.getItem(k), CUR) === null, 'rien n\'est écrit tant qu\'on ne touche à rien');
  await drag(page, [[200, 600], [700, 520], [1000, 640]]);
  check(await page.evaluate(() => __kz.autosave.writes) === 0, 'pas d\'écriture au milieu du geste (regroupée)');
  await autosaved(page);
  const g = await serialized(page);
  check(same(await page.evaluate(k => JSON.parse(localStorage.getItem(k) as string).garden, CUR), g), 'le jardin à l\'écran est gardé');
  check(await page.evaluate(() => __kz.autosave.last) === 'ok', 'écriture réussie');

  // plusieurs gestes rapprochés : une ou deux écritures, pas une par geste
  const w0 = await page.evaluate(() => __kz.autosave.writes);
  for (let k = 0; k < 4; k++) await drag(page, [[200, 300 + k * 30], [500, 320 + k * 30]]);
  await autosaved(page, w0 + 1); await sleep(1500);
  const w1 = await page.evaluate(() => __kz.autosave.writes);
  check(w1 - w0 <= 2, `4 gestes rapprochés : ${w1 - w0} écriture(s)`);

  const kept = await serialized(page);
  await page.reload();
  check(await page.locator('#resume').isVisible(), 'l\'accueil annonce le jardin retrouvé');
  check(await page.evaluate(() => __kz.autosave.resumed), 'jardin repris');
  check(same(await serialized(page), kept), 'le même jardin revient, pierres et sable');
  await snap(page); await sleep(1500);
  check(await changed(page) < 1e-3, 'le jardinier de l\'accueil ne ratisse pas par-dessus le jardin retrouvé');
  await page.screenshot({ path: `${SHOTS}/sauvegarde-reprise.png` });
  await page.click('#go'); await sleep(1900);
  check(await page.isDisabled('#undo') && await page.isDisabled('#redo'), 'rien à annuler dans un jardin repris');
  check(same(await serialized(page), kept), 'entrer ne change pas le jardin repris');

  // avec ?graine=N, on rejoue le jardin de la graine
  await page.goto(URL_SEED);
  check(!(await page.evaluate(() => __kz.autosave.resumed)) && await page.locator('#resume').isHidden(), '?graine : pas de reprise, jardin de la graine');
});

test('jardin en cours : écrit tout de suite si l\'onglet est caché ou la page rechargée', async ({ page }) => {
  await enter(page, URL_FREE);
  await drag(page, [[200, 600], [700, 520]]);
  await hide(page, true);
  check(await page.evaluate(() => __kz.autosave.writes) === 1, 'onglet caché : écrit sans attendre');
  await hide(page, false);
  await drag(page, [[300, 300], [900, 350]]);
  const g = await serialized(page);
  await page.reload();
  check(same(await serialized(page), g), 'rechargé juste après un geste : le geste n\'est pas perdu');
});

test('jardin en cours : nouveau jardin, annuler, rétablir et méditer sont gardés', async ({ page }) => {
  await enter(page, URL_FREE);
  await page.click('#new'); await sleep(2600);
  await autosaved(page);
  const fresh = await serialized(page);
  check(same(await page.evaluate(k => JSON.parse(localStorage.getItem(k) as string).garden, CUR), fresh), 'Nouveau : le nouveau jardin est gardé une fois le sable repassé');
  await page.click('#undo'); await sleep(1600);
  check(same(await page.evaluate(k => JSON.parse(localStorage.getItem(k) as string).garden, CUR), await serialized(page)), 'Annuler est gardé');
  await page.click('#redo'); await sleep(1600);
  check(same(await page.evaluate(k => JSON.parse(localStorage.getItem(k) as string).garden, CUR), fresh), 'Rétablir est gardé');
  const w = await page.evaluate(() => __kz.autosave.writes);
  await page.keyboard.press('m'); await sleep(7500);
  check(await page.evaluate(w => __kz.autosave.writes > w, w), 'en méditant, le jardin est gardé même sans pause');
  await page.keyboard.press('m');
});

test('jardin en cours : la suite d\'un jardin de la galerie le reste après rechargement', async ({ page }) => {
  await enter(page, URL_FREE);
  await page.click('#gal'); await page.click('#galSave'); await page.click('#galClose');
  await drag(page, [[200, 600], [700, 520]]);
  await autosaved(page);
  await page.reload(); await page.click('#go'); await sleep(1900);
  await page.click('#gal');
  check(await page.innerText('#galSave') === 'Mettre à jour ce jardin', 'Enregistrer met à jour le jardin de la galerie');
});

test('jardin en cours abîmé : mis de côté, un jardin neuf s\'ouvre', async ({ page }) => {
  await page.addInitScript(k => { if (!sessionStorage.getItem('fait')) { sessionStorage.setItem('fait', '1'); localStorage.setItem(k, '{"v":1,"savedAt":3,"galleryId":null,"garden":{"format":1}}'); } }, CUR);
  await page.goto(URL_FREE);
  check(!(await page.evaluate(() => __kz.autosave.resumed)), 'pas de reprise');
  check(await page.evaluate(k => localStorage.getItem(k + '.abimee'), CUR) !== null && await page.evaluate(k => localStorage.getItem(k), CUR) === null, 'entrée abîmée mise de côté');
  check(await page.evaluate(() => __kz.G.stones.length) >= 2, 'un jardin composé s\'ouvre');
  await page.goto(URL_FREE);
  check(await page.evaluate(k => localStorage.getItem(k + '.abimee'), CUR) !== null, 'la copie mise de côté n\'est pas écrasée');
});

test('stockage plein : le jardin reste jouable, un message le dit, l\'ancienne sauvegarde reste', async ({ page }) => {
  await enter(page, URL_FREE);
  await drag(page, [[200, 600], [700, 520]]);
  await autosaved(page);
  const first = await serialized(page);
  // le stockage refuse désormais toute écriture, comme un quota dépassé
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await drag(page, [[200, 300], [900, 360], [300, 420]]);
  await autosaved(page, 2);
  check(await page.evaluate(() => __kz.autosave.last) === 'plein', 'écriture refusée : « plein »');
  check((await page.innerText('#hint')).includes('Stockage plein'), 'un message discret le dit');
  await snap(page); await drag(page, [[400, 500], [800, 520]]);
  check(await changed(page) > 100, 'on continue à ratisser');
  check(same(await page.evaluate(k => JSON.parse(localStorage.getItem(k) as string).garden, CUR), first), 'la dernière sauvegarde réussie est intacte');
  await page.click('#gal'); await page.click('#galSave');
  check((await page.innerText('#galMsg')).includes('plein'), 'la galerie dit aussi que le stockage est plein');
});

test('stockage bloqué (navigation privée stricte) : le jardin marche quand même', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqué', 'SecurityError'); } }); });
  await enter(page, URL_FREE);
  await snap(page);
  await drag(page, [[200, 600], [700, 520]]);
  check(await changed(page) > 100, 'on ratisse');
  await autosaved(page);
  check(await page.evaluate(() => __kz.autosave.last) === 'bloque', 'sauvegarde automatique : « bloque », sans erreur');
  await page.click('#gal'); await page.click('#galSave');
  check((await page.innerText('#galMsg')).includes('refuse'), 'la galerie explique qu\'elle ne peut pas enregistrer');
});
