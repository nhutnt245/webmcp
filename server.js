// A tiny static file server for the demo: `npm start`, then open http://127.0.0.1:4173
// It only serves the files in the public/ folder. There is no API and no database.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicFolder = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const requestedFile = resolve(publicFolder, `.${pathname === '/' ? '/index.html' : pathname}`);

  // Never serve anything outside the public/ folder.
  if (!requestedFile.startsWith(publicFolder.endsWith(sep) ? publicFolder : publicFolder + sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
    return;
  }

  try {
    const content = await readFile(requestedFile);
    const contentType = contentTypes[extname(requestedFile)] ?? 'application/octet-stream';
    // no-store: always load the latest files while you are editing the code.
    response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Demo flights: http://127.0.0.1:${port}`);
});
