import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const allocator = createServer();
await new Promise(resolve => allocator.listen(0, '127.0.0.1', resolve));
const port = allocator.address().port;
await new Promise(resolve => allocator.close(resolve));
const base = `http://127.0.0.1:${port}`;
let server;
before(async () => {
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), IRIS_BASE_URL: 'http://127.0.0.1:52774', IRIS_USERNAME: 'test-user', IRIS_PASSWORD: 'private-test-value' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Server stopped: ${code}`))); });
});
after(() => server?.kill());
test('local interface serves real assets and exposes only connection metadata', async () => {
  const html = await fetch(base); assert.equal(html.status, 200); assert.match(await html.text(), /IRIS Change Atlas/);
  const metadata = await (await fetch(base + '/api/connection')).json(); assert.equal(metadata.configured, true); assert.ok(!JSON.stringify(metadata).includes('private-test-value'));
  assert.equal((await fetch(base + '/.local/iris.json')).status, 404);
});
test('cross-origin and unrecognized-host requests are rejected', async () => {
  assert.equal((await fetch(base + '/api/connection', { headers: { Origin: 'https://unrelated.example' } })).status, 403);
  // Node's built-in HTTP client permits an explicit Host for a local request.
  const { request } = await import('node:http');
  const status = await new Promise((resolve, reject) => { const req = request(base + '/api/connection', { headers: { Host: 'unrelated.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(status, 403);
});
test('malformed capture requests cannot reach the collector', async () => {
  assert.equal((await fetch(base + '/api/capture')).status, 405);
  assert.equal((await fetch(base + '/api/capture', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(base + '/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(base + '/api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'x'.repeat(101) }) })).status, 400);
});
