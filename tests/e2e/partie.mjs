// Partie complète dans un vrai navigateur (Chromium), jouée à la souris puis au doigt :
// accueil (le jardinier ratisse tout seul) -> entrée -> coups de râteau -> râteau large -> pierre posée puis retirée
// -> annuler -> lisser -> nouveau jardin -> méditer -> lumière et son retenus après rechargement
// -> rétablir -> rendu incrémental -> galerie (enregistrer, rouvrir, recharger, renommer, abîmé, effacer)
// -> onglet caché -> ancien format repris -> sauvegarde abîmée mise de côté -> écran 3x. Puis le même jardin au doigt sur iPhone SE.
// Lancer : npm run partie
import { chromium, devices } from 'playwright';
import { startServer } from './server.mjs';
import { mkdirSync } from 'node:fs';

const server = await startServer();
const PORT = server.port;
const URL = `http://127.0.0.1:${PORT}/index.html?graine=5`;
const OUT = process.env.SMOKE_SHOTS || 'test-results';
const KEY = 'kevzen.sauvegarde';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${msg}`); if (!ok) fails.push(msg); };

/** Garde une copie du sable, puis mesure combien il a changé depuis. */
const snap = page => page.evaluate(() => { window.__h = __kz.G.hm.slice(); });
const changed = page => page.evaluate(() => { const a = window.__h, b = __kz.G.hm; let d = 0; for (let i = 0; i < b.length; i++) d += Math.abs(a[i] - b[i]); return d; });
const stones = page => page.evaluate(() => __kz.G.stones.length);
const pressed = (page, sel) => page.getAttribute(sel, 'aria-pressed');

/** Un geste de râteau à la souris, en plusieurs mouvements. */
async function drag(page, pts) {
  await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
  for (let k = 1; k < pts.length; k++) { await page.mouse.move(pts[k][0], pts[k][1], { steps: 12 }); await sleep(30); }
  await sleep(250); await page.mouse.up(); await sleep(100);
}

/** Un geste au doigt (vrais événements tactiles). */
async function swipe(page, cdp, pts) {
  const tp = ([x, y]) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    for (let s = 1; s <= 10; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([ax + (bx - ax) * s / 10, ay + (by - ay) * s / 10]) }); await sleep(16); }
  }
  await sleep(250);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100);
}

/** Un endroit libre (loin des pierres et de la barre d'outils). */
const freeSpot = page => page.evaluate(() => {
  const { G } = __kz;
  for (let y = G.vh * .25; y < G.vh * .7; y += 23) for (let x = G.vw * .15; x < G.vw * .85; x += 29)
    if (G.stones.every(s => Math.hypot(s.x - x, s.y - y) > s.r * 2 + 90)) return [Math.round(x), Math.round(y)];
  return [Math.round(G.vw / 2), Math.round(G.vh / 2)];
});

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const save = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);

  await page.goto(URL);
  check(/^v\d+\.\d+\.\d+$/.test(await page.locator('#ver').innerText()), 'numéro de version sur l\'accueil');
  await page.waitForFunction(() => __kz.art !== undefined, null, { timeout: 10000 });
  check(await page.evaluate(() => __kz.art) === 6, 'les 6 visuels peints sont chargés (titre, sable, 4 pierres)');
  check((await page.locator('#intro').evaluate(e => getComputedStyle(e).backgroundImage)).includes('titre.webp'), 'tableau peint sous l\'accueil');
  const n0 = await stones(page);
  check([3, 5, 7].some(n => n0 >= 2 && n0 <= n), `jardin composé (${n0} pierres)`);
  await snap(page); await sleep(2500);
  check(await changed(page) > 50, 'sur l\'accueil, le jardinier ratisse tout seul');
  await page.screenshot({ path: `${OUT}/partie-accueil.png` });

  await page.click('#go'); await sleep(1900);
  check(await page.locator('#intro').isHidden(), 'entrée dans le jardin');
  check(await page.evaluate(() => __kz.ui.entered && !__kz.ui.autoOn), 'le jardinier s\'arrête quand on entre');

  // coups de râteau
  await snap(page); await sleep(300);
  check(await changed(page) < 1e-3, 'sans geste, le sable ne bouge pas');
  await drag(page, [[200, 640], [600, 560], [1000, 650], [1100, 300]]);
  const raked = await changed(page);
  check(raked > 300, `le râteau creuse le sable (${raked | 0})`);
  check(await page.evaluate(() => __kz.G.undoS.length) >= 1, 'le geste peut être annulé');

  // râteau large : la bande marquée est plus large
  await page.click('#tines');
  check(await page.evaluate(() => __kz.G.tines) === 8 && await page.locator('#tinesL').innerText() === 'Large', 'râteau large');
  await snap(page); await drag(page, [[150, 200], [400, 260]]);
  const wide = await page.evaluate(() => { const a = window.__h, b = __kz.G.hm; let n = 0; for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) n++; return n; });
  await page.click('#tines');
  check(await page.evaluate(() => __kz.G.tines) === 3, 'râteau fin');
  await snap(page); await drag(page, [[150, 200], [400, 260]]);
  const thin = await page.evaluate(() => { const a = window.__h, b = __kz.G.hm; let n = 0; for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) n++; return n; });
  check(wide > thin * 1.6, `le râteau large couvre plus de sable (${wide} contre ${thin})`);
  await page.click('#tines');

  // pierre posée puis retirée
  await page.keyboard.press('2');
  check(await pressed(page, '#t-stone') === 'true', 'outil pierre (touche 2)');
  const [sx, sy] = await freeSpot(page);
  const before = await stones(page);
  await page.mouse.click(sx, sy); await sleep(1200);
  check(await stones(page) === before + 1, 'une pierre est posée là où on clique');
  check(await page.evaluate(([x, y]) => { const { G } = __kz, s = G.stones.at(-1); return Math.hypot(s.x - x, s.y - y) < 1 && G.grow.length === 0 && G.mask[Math.round(y / 2) * G.W + Math.round(x / 2)] === 1; }, [sx, sy]), 'ses cercles se sont tracés autour');
  await page.screenshot({ path: `${OUT}/partie-pierre.png` });
  await page.mouse.click(sx, sy); await sleep(200);
  check(await stones(page) === before, 'cliquer sur la pierre la retire');

  // annuler (bouton puis clavier)
  await page.click('#undo'); await sleep(200);
  check(await stones(page) === before + 1, 'Annuler remet la pierre');
  await page.keyboard.press('z'); await sleep(200);
  check(await stones(page) === before, 'Z annule la pose');

  // rétablir (clavier puis bouton), et Annuler/Rétablir grisés quand il n'y a rien à faire
  check(await page.isEnabled('#redo'), 'Rétablir disponible après une annulation');
  await page.keyboard.press('Shift+Z'); await sleep(200);
  check(await stones(page) === before + 1, 'Maj+Z rétablit la pose');
  await page.keyboard.press('Shift+Z'); await sleep(200);
  check(await stones(page) === before, 'Maj+Z rétablit le retrait');
  check(await page.isDisabled('#redo'), 'Rétablir grisé quand tout est rétabli');
  await page.click('#undo'); await sleep(150);
  check(await stones(page) === before + 1, 'bouton Annuler');
  await page.click('#redo'); await sleep(150);
  check(await stones(page) === before, 'bouton Rétablir');

  // lisser
  await page.keyboard.press('3');
  check(await pressed(page, '#t-smooth') === 'true', 'outil lisser (touche 3)');
  const rough = () => page.evaluate(() => { const { G } = __kz; let s = 0; for (let y = 270; y < 300; y++) for (let x = 250; x < 400; x++) s += Math.abs(G.hm[y * G.W + x]); return s; });
  const r0 = await rough(page);
  for (let k = 0; k < 4; k++) await drag(page, [[500, 540 + k * 8], [800, 540 + k * 8], [500, 560 + k * 8]]);
  const r1 = await rough(page);
  check(r1 < r0 * .7, `lisser efface les traces (${r0 | 0} -> ${r1 | 0})`);
  await page.keyboard.press('1');

  // nouveau jardin
  await snap(page);
  await page.click('#new'); await sleep(2500);
  check(await page.evaluate(() => __kz.G.sweep === null) && await changed(page) > 300, 'Nouveau : nouvelles pierres et sable repassé');

  // méditer
  await page.keyboard.press('m');
  check(await pressed(page, '#auto') === 'true', 'méditer (touche M)');
  await snap(page); await sleep(3000);
  check(await changed(page) > 50, 'le jardinier ratisse pour vous');
  await page.click('#auto');
  check(await pressed(page, '#auto') === 'false', 'arrêter de méditer');

  // rendu incrémental : au repos, plus aucun pixel de sable n'est recalculé
  await sleep(600);
  const idle = await page.evaluate(() => new Promise(res => { const a = { ...__kz.stats }; setTimeout(() => res([__kz.stats.frames - a.frames, __kz.stats.shaded - a.shaded]), 800); }));
  check(idle[0] > 3 && idle[1] === 0, `au repos : ${idle[0]} images, ${idle[1]} pixels de sable recalculés`);
  await snap(page); await drag(page, [[300, 300], [420, 330]]);
  const shadedOne = await page.evaluate(() => __kz.stats.shaded);
  check(shadedOne > 0, 'un geste recalcule le sable');

  // galerie : enregistrer, changer de jardin, rouvrir
  await page.keyboard.press('g'); await sleep(300);
  check(await page.locator('#galerie').isVisible(), 'la galerie s\'ouvre (touche G)');
  check(await page.locator('#galEmpty').isVisible(), 'galerie vide au départ');
  const saved = await page.evaluate(() => __kz.serialize());
  await page.click('#galSave'); await sleep(200);
  check(await page.locator('#galList li').count() === 1, 'le jardin est enregistré dans la galerie');
  check((await page.locator('#galMsg').innerText()).includes('enregistré'), 'message de confirmation');
  check(await page.evaluate(() => (localStorage.getItem('kevzen.galerie') || '').includes('data:image/jpeg')), 'avec sa vignette');
  await page.keyboard.press('1');
  check(await pressed(page, '#t-rake') === 'true' && await pressed(page, '#t-stone') === 'false', 'raccourcis du jardin suspendus quand la galerie est ouverte');
  await page.click('#galClose'); await sleep(200);
  check(!(await page.locator('#galerie').isVisible()), 'la galerie se ferme');
  await page.click('#new'); await sleep(2500);
  check(JSON.stringify(await page.evaluate(() => __kz.serialize().stones)) !== JSON.stringify(saved.stones), 'un autre jardin à l\'écran');
  await page.click('#gal'); await sleep(200);
  await page.click('#galList li .open'); await sleep(300);
  const back = await page.evaluate(() => __kz.serialize());
  check(JSON.stringify(back.stones) === JSON.stringify(saved.stones) && back.sand === saved.sand, 'Ouvrir rend le jardin enregistré, pierres et sable');
  check(!(await page.locator('#galerie').isVisible()), 'la galerie se referme à l\'ouverture d\'un jardin');
  await page.click('#undo'); await sleep(200);
  check(JSON.stringify(await page.evaluate(() => __kz.serialize().stones)) !== JSON.stringify(saved.stones), 'ouvrir un jardin s\'annule');
  await page.click('#redo'); await sleep(200);

  // le jardin enregistré survit au rechargement
  await page.reload(); await sleep(400);
  await page.click('#go'); await sleep(1900);
  await page.click('#gal'); await sleep(200);
  check(await page.locator('#galList li').count() === 1, 'après rechargement, le jardin est toujours dans la galerie');
  await page.fill('#galList li .nm', 'Jardin du matin'); await page.press('#galList li .nm', 'Enter'); await sleep(200);
  check(await page.inputValue('#galList li .nm') === 'Jardin du matin', 'renommer un jardin');
  await page.click('#galList li .open'); await sleep(300);
  const back2 = await page.evaluate(() => __kz.serialize());
  check(JSON.stringify(back2.stones) === JSON.stringify(saved.stones) && back2.sand === saved.sand, 'après rechargement, Ouvrir rend le même jardin');
  await page.screenshot({ path: `${OUT}/partie-galerie-rouvert.png` });

  // un jardin abîmé est mis de côté sans casser la galerie
  await page.click('#gal'); await sleep(200);
  check(await page.innerText('#galSave') === 'Mettre à jour ce jardin', 'le jardin rouvert se met à jour');
  await page.click('#galSave'); await sleep(200);
  check(await page.locator('#galList li').count() === 1, 'mise à jour : pas de doublon');
  await page.click('#galClose'); await page.click('#new'); await sleep(300); await page.click('#gal'); await sleep(200);
  check(await page.innerText('#galSave') === 'Enregistrer ce jardin', 'après Nouveau, on enregistre un autre jardin');
  await page.click('#galSave'); await sleep(200);
  check(await page.locator('#galList li').count() === 2, 'deux jardins enregistrés');
  await page.screenshot({ path: `${OUT}/partie-galerie.png` });
  const badId = await page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('kevzen.jardin.') && !k.endsWith('.abimee')); localStorage.setItem(k, '{abîmé'); return k.slice('kevzen.jardin.'.length); });
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

  // onglet caché : la boucle s'arrête, puis repart
  const hide = h => page.evaluate(h => { Object.defineProperty(document, 'hidden', { value: h, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await hide(true);
  const f0 = await page.evaluate(() => __kz.stats.frames); await sleep(600);
  check(await page.evaluate(() => !__kz.loop.running) && await page.evaluate(() => __kz.stats.frames) - f0 <= 1, 'onglet caché : plus aucune image dessinée');
  await hide(false); await sleep(1200);
  check(await page.evaluate(() => __kz.loop.running) && await page.evaluate(() => __kz.stats.frames) - f0 > 3, 'onglet revenu : le jardin repart');

  // lumière et son retenus
  await page.click('[data-mood="nuit"]'); await sleep(300);
  check(await pressed(page, '[data-mood="nuit"]') === 'true', 'lumière de nuit');
  await page.screenshot({ path: `${OUT}/partie-nuit.png` });
  await page.click('#snd');
  const sv = await save();
  check(sv && sv.version === 1 && sv.mood === 'nuit' && sv.sound === false, 'lumière et son sauvegardés');
  await page.reload(); await sleep(400);
  check(await pressed(page, '[data-mood="nuit"]') === 'true' && await pressed(page, '#snd') === 'false', 'après rechargement : nuit, son coupé');

  // ancien format
  await page.evaluate(k => { localStorage.removeItem(k); localStorage.setItem('kevzen', JSON.stringify({ mood: 'soir', sound: false })); }, KEY);
  await page.reload(); await sleep(400);
  const mig = await save();
  check(mig && mig.mood === 'soir' && mig.sound === false && await page.evaluate(() => localStorage.getItem('kevzen')) === null, 'ancien format repris, ancienne clé effacée');
  check(await pressed(page, '[data-mood="soir"]') === 'true', 'le crépuscule revient');

  // sauvegarde abîmée
  await page.evaluate(k => localStorage.setItem(k, '{abîmée'), KEY);
  await page.reload(); await sleep(400);
  check(await page.evaluate(k => localStorage.getItem(k + '.abimee'), KEY) === '{abîmée', 'sauvegarde abîmée mise de côté');
  check(await pressed(page, '[data-mood="aube"]') === 'true', 'le jardin repart de l\'aube');
  check(errors.length === 0, `aucune erreur (${errors.slice(0, 3).join(' | ')})`);
  await page.close();

  // écran très dense (3x) : la résolution est plafonnée à 2
  const dense = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const dp = await dense.newPage();
  await dp.goto(URL); await sleep(500);
  const dv = await dp.evaluate(() => [__kz.view.dpr, document.getElementById('g').width, innerWidth]);
  check(dv[0] === 2 && dv[1] === dv[2] * 2, `écran 3x : résolution plafonnée à 2 (${dv[1]} px pour ${dv[2]})`);
  await dense.close();

  // au doigt sur iPhone SE
  const ctx = await browser.newContext({ ...devices['iPhone SE'] });
  const tel = await ctx.newPage();
  const terr = [];
  tel.on('pageerror', e => terr.push(String(e)));
  await tel.goto(URL);
  await tel.tap('#go'); await sleep(1900);
  const cdp = await ctx.newCDPSession(tel);
  await snap(tel);
  await swipe(tel, cdp, [[40, 200], [200, 160], [290, 260]]);
  check(await changed(tel) > 100, 'iPhone SE : ratisser au doigt');
  await tel.tap('#t-stone');
  const [tx, ty] = await freeSpot(tel);
  const tb = await stones(tel);
  await tel.touchscreen.tap(tx, ty); await sleep(1200);
  check(await stones(tel) === tb + 1, 'iPhone SE : toucher pose une pierre');
  await tel.touchscreen.tap(tx, ty); await sleep(200);
  check(await stones(tel) === tb, 'iPhone SE : toucher la pierre la retire');
  const box = await tel.locator('#bar').boundingBox();
  check(box && box.x >= 0 && box.x + box.width <= 321, 'iPhone SE : barre d\'outils dans l\'écran');
  await tel.screenshot({ path: `${OUT}/partie-iphone.png` });
  await tel.tap('#gal'); await sleep(300);
  await tel.tap('#galSave'); await sleep(300);
  check(await tel.locator('#galList li').count() === 1, 'iPhone SE : enregistrer dans la galerie');
  const gb = await tel.locator('#galerie').boundingBox(), ob = await tel.locator('#galList li .open').boundingBox();
  check(gb && gb.x >= 0 && gb.x + gb.width <= 321 && ob && ob.x + ob.width <= 321, 'iPhone SE : galerie dans l\'écran');
  await tel.screenshot({ path: `${OUT}/partie-iphone-galerie.png` });
  await tel.tap('#galList li .open'); await sleep(300);
  check(!(await tel.locator('#galerie').isVisible()), 'iPhone SE : rouvrir un jardin');
  check(terr.length === 0, `iPhone SE : aucune erreur (${terr.slice(0, 3).join(' | ')})`);
  await ctx.close();
} finally {
  await browser.close();
  server.stop();
}
if (fails.length) { console.error(`\n${fails.length} échec(s)`); process.exit(1); }
console.log('\nPartie complète : tout est bon.');
