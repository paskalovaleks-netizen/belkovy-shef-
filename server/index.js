import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { createPhotoHandler } from './food-photo.js';
import { createAssistantHandler } from './assistant.js';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json; charset=utf-8' };
const assistant = createAssistantHandler();
const photo = createPhotoHandler();
const server = createServer((req, res) => assistant(req, res, () => photo(req, res, async () => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(path);
    const headers = { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    if (extname(path) === '.html' || pathname === '/sw.js') headers['Cache-Control'] = 'no-cache';
    if (pathname === '/belkovy-shef.html') headers['Content-Disposition'] = 'attachment; filename="belkovy-shef.html"';
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
})));
server.listen(Number(process.env.PORT || 5173), '0.0.0.0', () => console.log('Белковый шеф: сервер готов.'));
