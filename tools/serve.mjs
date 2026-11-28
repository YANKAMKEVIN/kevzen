// Petit serveur statique pour le jeu construit (dist/) : npm run build && npm run preview
// Utilisé aussi par les tests de bout en bout. PORT et SERVE_DIR peuvent être changés.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.env.SERVE_DIR || fileURLToPath(new URL('../dist', import.meta.url)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const PORT = Number(process.env.PORT || 8000);

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url || '/', 'http://x').pathname));
  const file = join(ROOT, path.endsWith('/') || path.endsWith(sep) ? path + 'index.html' : path);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('introuvable'); }
}).listen(PORT, '127.0.0.1', () => console.log(`KEVZEN : http://localhost:${PORT}`));
