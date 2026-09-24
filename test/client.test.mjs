import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capture, readEndpoint, COLLECTION_LIMIT } from '../lib/iris-client.mjs';
const config = { baseUrl: 'http://127.0.0.1:52774', username: 'test', password: 'test', label: 'Fixture' };
const response = value => new Response(JSON.stringify({ status: { errors: [] }, result: value }), { headers: { 'Content-Type': 'application/json' } });
function reader(overrides = {}, calls = []) { return async (url, options) => { calls.push({ url, options }); const path = new URL(url).pathname; if (overrides[path]) return overrides[path](); return response(path.endsWith('/info') ? { apiVersion: 2, serverVersion: 'IRIS 2026.2' } : path.endsWith('/main') ? {} : []); }; }
test('capture only calls five allowlisted GET endpoints and omits credentials', async () => {
  const calls = [], result = await capture(config, 'Before', reader({}, calls));
  assert.equal(calls.length, 5); assert.ok(calls.every(call => call.options.method === 'GET')); assert.ok(calls.every(call => call.options.headers['Accept-Language'] === 'en'));
  assert.ok(!JSON.stringify(result).includes('Authorization')); assert.equal(result.sections.tasks.status, 'ok');
});
test('a denied collection preserves the other two', async () => {
  const result = await capture(config, 'After', reader({ '/api/admin/v2/web-apps': () => new Response('', { status: 403 }) }));
  assert.equal(result.sections.webapps.status, 'unavailable'); assert.equal(result.sections.tasks.status, 'ok'); assert.match(result.sections.webapps.reason, /403/);
});
test('authentication failure stops capture before collecting misleading evidence', async () => {
  await assert.rejects(() => capture(config, 'x', () => new Response('', { status: 401 })), /Authentication/);
});
test('API v1 has an actionable version error', async () => {
  await assert.rejects(() => capture(config, 'x', () => response({ apiVersion: 1, serverVersion: 'IRIS 2026.1' })), /2026.2/);
});
test('row limit marks capture partial instead of complete', async () => {
  const result = await capture(config, 'x', reader({ '/api/admin/v2/tasks': () => response(Array.from({ length: COLLECTION_LIMIT }, (_, Id) => ({ Id, Name: `Task ${Id}` }))) }));
  assert.equal(result.sections.tasks.status, 'partial');
});
test('HTTP 200 with application error is unavailable', async () => {
  const result = await capture(config, 'x', reader({ '/api/admin/v2/tasks': () => new Response(JSON.stringify({ status: { errors: ['failed'] }, result: [] })) }));
  assert.equal(result.sections.tasks.status, 'unavailable');
});
test('duplicate IDs fail the collection without affecting other evidence', async () => {
  const result = await capture(config, 'x', reader({ '/api/admin/v2/tasks': () => response([{ Id: 1 }, { Id: 1 }]) })); assert.equal(result.sections.tasks.status, 'unavailable');
});
test('unsupported endpoints are never fetched', async () => {
  let called = false; await assert.rejects(() => readEndpoint(config, 'delete', () => { called = true; }), /Unsupported/); assert.equal(called, false);
});
test('oversized or invalid bodies are rejected', async () => {
  await assert.rejects(() => readEndpoint(config, 'info', () => new Response('x'.repeat(4 * 1024 * 1024 + 1))), /4 MiB/);
  await assert.rejects(() => readEndpoint(config, 'info', () => new Response('<html>error</html>')), /JSON/);
});
