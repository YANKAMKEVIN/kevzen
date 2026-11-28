// Démarre le serveur statique sur le jeu construit (dist/) sur un port libre, et attend qu'il réponde.
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function startServer() {
  if (!existsSync(ROOT + 'dist/index.html')) throw new Error('dist/ absent : lancez d\'abord npm run build');
  const port = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const proc = spawn(process.execPath, [ROOT + 'tools/serve.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise(res => { const c = connect(port, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
    if (ok) return { port, stop: () => proc.kill() };
    await sleep(100);
  }
  proc.kill();
  throw new Error('serveur local injoignable');
}
