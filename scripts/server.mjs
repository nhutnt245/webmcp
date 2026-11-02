import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['../demo/index.html', 'text/html']],
  ['/app.js', ['../demo/app.js', 'text/javascript']],
  ['/style.css', ['../demo/style.css', 'text/css']],
  ['/webmcp/register.js', ['../webmcp/register.js', 'text/javascript']],
]);
export function startServer(port = Number(process.env.PORT ?? 3000)) {
  const server = http.createServer(async (req, res) => {
    const route = files.get(new URL(req.url, 'http://localhost').pathname);
    if (!route) { res.writeHead(404).end('Not found'); return; }
    try {
      const body = await readFile(new URL(route[0], import.meta.url));
      res.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(500).end('Unable to load demo'); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const server = await startServer();
  console.log(`Demo: http://127.0.0.1:${server.address().port}`);
}
