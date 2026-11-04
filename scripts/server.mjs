import { createServer } from 'node:http';
import { flightsFor, validateSearch } from '../public/shared/flights.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
export function createDemoServer() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const url = new URL(req.url, 'http://localhost');
      if (pathname === '/api/flights') {
        let payload;
        let status = 200;
        try {
          const search = validateSearch(Object.fromEntries(url.searchParams));
          payload = { search, flights: flightsFor(url.searchParams.get('seed') || 'demo', search) };
        } catch (error) { status = 400; payload = { error: error.message }; }
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(payload));
        return;
      }
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8` });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const status = error instanceof URIError ? 400 : 404;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(status === 400 ? 'Bad path' : 'Not found');
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const server = createDemoServer();
  server.listen(port, '127.0.0.1', () => console.log(`Demo: http://127.0.0.1:${server.address().port}`));
}
