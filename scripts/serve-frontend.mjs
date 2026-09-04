import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const preferredPort = Number(process.env.PORT || 5174);
const hasExplicitPort = Boolean(process.env.PORT);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost`).pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = normalize(join(root, requestedPath));
  const relativePath = relative(root, filePath);

  if (relativePath.startsWith('..') || relativePath === '') {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    return join(filePath, 'index.html');
  }

  return filePath;
}

function getContentType(filePath) {
  return contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url);

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': getContentType(filePath),
  });

  createReadStream(filePath).pipe(response);
});

function listen(port, attemptsLeft = 20) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && !hasExplicitPort && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }

    console.error(`Could not start Lebanon Hockey on port ${port}: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Lebanon Hockey: http://127.0.0.1:${port}`);
  });
}

listen(preferredPort);
