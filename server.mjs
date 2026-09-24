import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { capture, readConfig } from './lib/iris-client.mjs';
const port = Number(process.env.PORT || 4177);
const files = new Map([
  ['/', ['public/index.html', 'text/html']], ['/app.mjs', ['public/app.mjs', 'text/javascript']],
  ['/atlas-core.mjs', ['public/atlas-core.mjs', 'text/javascript']], ['/styles.css', ['public/styles.css', 'text/css']],
  ['/example.json', ['public/example.json', 'application/json']],
  ['/responsive-check.html', ['public/responsive-check.html', 'text/html']],
  ['/responsive-check.css', ['public/responsive-check.css', 'text/css']]
]);
const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
let busy = false;
const server = http.createServer(async (req, res) => {
  const send = (status, data, type = 'application/json') => { res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` }); res.end(type === 'application/json' ? JSON.stringify(data) : data); };
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
  if (!origins.has(`http://${req.headers.host}`)) return send(403, { error: 'Unrecognized host.' });
  if (req.headers.origin && !origins.has(req.headers.origin)) return send(403, { error: 'Same-origin requests only.' });
  if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Same-origin requests only.' });
  const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  try {
    if (path === '/api/connection' && req.method === 'GET') {
      try { const config = await readConfig(); return send(200, { configured: true, label: config.label }); }
      catch (error) { return send(200, { configured: false, message: error.message }); }
    }
    if (path === '/api/capture') {
      if (req.method !== 'POST') return send(405, { error: 'Use POST to request a local capture. IRIS receives GET requests only.' });
      if (busy) return send(409, { error: 'A capture is already running. Please wait.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required.' });
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) return send(413, { error: 'Request too large.' }); }
      let input; try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON.' }); }
      if (typeof input?.label !== 'string' || input.label.length > 100) return send(400, { error: 'A capture label of up to 100 characters is required.' });
      busy = true;
      try { return send(200, await capture(await readConfig(), input.label)); }
      catch (error) { return send(502, { error: error.message === 'fetch failed' ? 'Could not reach IRIS. Check the local connection.' : error.message }); }
      finally { busy = false; }
    }
    if (req.method !== 'GET' || !files.has(path)) return send(404, { error: 'Not found.' });
    const [file, type] = files.get(path);
    const content = await readFile(new URL(file, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(content);
  } catch { if (!res.headersSent) send(500, { error: 'Local request failed.' }); else res.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`IRIS Change Atlas: http://127.0.0.1:${port} (local only)`));
