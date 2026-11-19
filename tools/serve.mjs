// Tiny static dev server with correct MIME types (Windows' registry can break .js).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

export function mimeFor(path) {
  return TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

export function startServer(port = 5173, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(ROOT, path));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if (!(await stat(file)).isFile()) throw new Error('not a file');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': mimeFor(file), 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
    }
  });
  server.listen(port, host, () => {
    console.log(`Esquadrão Z em http://localhost:${port}/`);
    if (host === '0.0.0.0') {
      for (const list of Object.values(networkInterfaces())) for (const n of list ?? []) {
        if (n.family === 'IPv4' && !n.internal) console.log(`Na rede: http://${n.address}:${port}/`);
      }
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lan = process.argv.includes('--lan');
  startServer(Number(process.env.PORT) || 5173, lan ? '0.0.0.0' : '127.0.0.1');
}
