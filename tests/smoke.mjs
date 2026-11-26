// Test de fumée : charge le jeu sur ordinateur et téléphones, le lance, joue ~20 s
// avec de vraies entrées et échoue sur toute erreur console, débordement ou bouton
// inaccessible. Réglages propres au jeu : tests/smoke.config.mjs.
// Lancer : npm test   (serveur local démarré automatiquement)
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import cfg from './smoke.config.mjs';

// port libre choisi par le système (plusieurs jeux peuvent tourner en même temps)
const PORT = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const BASE = `http://127.0.0.1:${PORT}/${cfg.page || 'index.html'}`;
const SHOTS = process.env.SMOKE_SHOTS || 'test-results';
const PLAY_MS = Number(process.env.SMOKE_PLAY_MS || cfg.playMs || 20000);
const PROFILES = [
  { name: 'ordinateur', ctx: { viewport: { width: 1280, height: 800 } }, touch: false },
  { name: 'iphone-se', ctx: { ...devices['iPhone SE'] }, touch: true },
  { name: 'pixel7-paysage', ctx: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } }, touch: true },
];
const only = process.env.SMOKE_ONLY;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const failures = [];
const fail = (p, msg) => { failures.push(`[${p}] ${msg}`); console.log(`  ÉCHEC ${msg}`); };
const ignored = t => (cfg.ignoreErrors || []).some(re => re.test(t));

// attend que le serveur local accepte les connexions (simple essai TCP)
async function waitServer() {
  const { connect } = await import('node:net');
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise(res => { const c = connect(PORT, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
    if (ok) return;
    await sleep(100);
  }
  throw new Error('serveur local injoignable');
}

// Chaque bouton visible doit pouvoir être amené à l'écran (défilement compris) et y tenir.
async function checkButtons(page, p, step) {
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, [role=button], a[href], input, select')) {
      const cs = getComputedStyle(el), r0 = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r0.width === 0 || r0.height === 0) continue;
      if (el.closest('[hidden], [aria-hidden=true], [inert]')) continue;
      // tiroir fermé, rangé hors écran par une transformation : ce n'est pas un bug
      let a = el, moved = false;
      while ((a = a.parentElement)) if (getComputedStyle(a).transform !== 'none') { moved = true; break; }
      if (moved) continue;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1)
        out.push(`${el.id ? '#' + el.id : el.tagName.toLowerCase()} « ${(el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 30)} »`);
    }
    window.scrollTo(0, 0);
    return out;
  });
  for (const b of bad) fail(p, `${step} : bouton hors écran et inaccessible : ${b}`);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (ov > 2) fail(p, `${step} : la page déborde de ${ov} px à l'horizontale`);
}

async function act(page, touch, sel) {
  const el = page.locator(sel).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  if (touch) await el.tap({ timeout: 8000 }); else await el.click({ timeout: 8000 });
  await sleep(600);
}

async function play(page, touch, cdp) {
  const { width: w, height: h } = page.viewportSize();
  const keys = cfg.keys || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < PLAY_MS) {
    i++;
    if (touch) {
      // glissé puis toucher, dans la zone de jeu
      const x = w * (0.3 + 0.4 * Math.random()), y = h * (0.35 + 0.35 * Math.random());
      const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      await tp('touchStart', [{ x, y }]);
      for (let k = 1; k <= 6; k++) await tp('touchMove', [{ x: x + k * 12 * (i % 2 ? 1 : -1), y: y + k * 4 }]);
      await tp('touchEnd', []);
      await sleep(250);
    } else {
      const k = keys[i % keys.length];
      await page.keyboard.down(k); await sleep(180 + (i % 3) * 120); await page.keyboard.up(k);
      if (cfg.mouse && i % 4 === 0) await page.mouse.click(w * (0.3 + 0.4 * Math.random()), h * (0.35 + 0.35 * Math.random()));
    }
  }
}

async function fps(page, ms = 2000) {
  return page.evaluate(ms => new Promise(res => { let n = 0; const t0 = performance.now();
    (function f(t) { n++; if (t - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (t - t0)); })(t0); }), ms);
}

try {
  await waitServer();
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const prof of PROFILES) {
    if (only && !prof.name.includes(only)) continue;
    console.log(`▶ ${prof.name}`);
    const ctx = await browser.newContext(prof.ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { const t = `${m.text()} ${m.location()?.url || ''}`; if (m.type() === 'error' && !ignored(t)) errors.push(t.trim()); });
    page.on('pageerror', e => { if (!ignored(e.message)) errors.push(e.message); });
    page.on('requestfailed', r => { if (r.url().startsWith(`http://127.0.0.1:${PORT}`) && !ignored(r.url())) errors.push(`requête échouée ${r.url()}`); });
    page.on('response', r => { if (r.status() >= 400 && !ignored(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.goto(BASE, { waitUntil: 'load' });
    await sleep(1500);
    await checkButtons(page, prof.name, 'accueil');
    await page.screenshot({ path: `${SHOTS}/${prof.name}-1-accueil.png` });
    for (const sel of (prof.touch ? cfg.startTouch || cfg.start : cfg.start) || []) {
      try { await act(page, prof.touch, sel); } catch (e) { fail(prof.name, `impossible d'actionner ${sel} : ${e.message.split('\n')[0]}`); }
    }
    await sleep(1000);
    // éléments qui doivent être visibles une fois le jeu lancé (ex. bouton d'export)
    for (const sel of cfg.mustSee || []) {
      const ok = await page.locator(sel).first().isVisible().catch(() => false);
      if (!ok) fail(prof.name, `${sel} devrait être visible après le lancement`);
    }
    if (!prof.touch && cfg.minFps) {
      const f = await fps(page);
      console.log(`  ${f.toFixed(1)} images/s`);
      if (f < cfg.minFps) fail(prof.name, `${f.toFixed(1)} images/s, minimum ${cfg.minFps}`);
    }
    const cdp = prof.touch ? await ctx.newCDPSession(page) : null;
    await play(page, prof.touch, cdp);
    await page.screenshot({ path: `${SHOTS}/${prof.name}-2-partie.png` });
    if (cfg.checkInGame !== false) await checkButtons(page, prof.name, 'en jeu');
    for (const e of errors) fail(prof.name, `erreur console : ${e.slice(0, 200)}`);
    if (!failures.some(f => f.startsWith(`[${prof.name}]`))) console.log('  OK');
    await ctx.close();
  }
  await browser.close();
} catch (e) {
  failures.push(`erreur du test : ${e.stack || e}`);
} finally {
  server.kill();
}
if (failures.length) { console.log(`\n${failures.length} échec(s) :\n` + failures.join('\n')); process.exit(1); }
console.log('\nTest de fumée réussi.');
