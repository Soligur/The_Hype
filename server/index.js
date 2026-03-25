const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { SymbolService } = require('./services/symbols');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');

const symbolService = new SymbolService();
symbolService.start();

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function writeJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(reqPath, res) {
  const cleanedPath = reqPath === '/' ? '/index.html' : reqPath;
  const candidate = path.resolve(ROOT_DIR, `.${cleanedPath}`);

  if (!candidate.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(candidate, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeByExt[ext] || 'application/octet-stream',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/stocks/search' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Number(url.searchParams.get('limit') || 20);
    const results = symbolService.search(q, Number.isFinite(limit) ? Math.min(limit, 50) : 20);

    writeJson(res, 200, {
      query: q,
      results,
      meta: symbolService.getMeta(),
    });
    return;
  }

  if (url.pathname === '/api/stocks/health' && req.method === 'GET') {
    writeJson(res, 200, {
      status: 'ok',
      symbols: symbolService.getMeta(),
    });
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`The Hype server listening on http://localhost:${PORT}`);
});
