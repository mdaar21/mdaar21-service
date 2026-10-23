import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Readable } from 'node:stream';
import handler from '../netlify/functions/ai.mjs';
import sessionHandler from '../netlify/functions/session.mjs';

// Local static server/function adapter. No Netlify authentication or routing emulation.
const root = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf','.webmanifest':'application/manifest+json'};
const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (['/api/ai','/api/session'].includes(url.pathname)) {
      const request = new Request(`http://127.0.0.1:${port}${url.pathname}`, {
        method:req.method, headers:req.headers,
        ...(['GET','HEAD'].includes(req.method) ? {} : {body:Readable.toWeb(req),duplex:'half'})
      });
      const response = await (url.pathname === '/api/session' ? sessionHandler : handler)(request, {ip:req.socket.remoteAddress});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const filename = await realpath(path.resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`));
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const content = await readFile(filename);
    res.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    res.writeHead(error?.code === 'ENOENT' ? 404 : 400, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Request unavailable');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Mdaar local development server listening on port ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
