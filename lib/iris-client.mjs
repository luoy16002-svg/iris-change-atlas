import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SCHEMA, SECTIONS, normalizeRows, projectRuntime } from '../public/atlas-core.mjs';

export const COLLECTION_LIMIT = 10000;
export const ROUTES = Object.freeze({
  info: '/api/admin/info',
  webapps: `/api/admin/v2/web-apps?maxRows=${COLLECTION_LIMIT}`,
  tasks: `/api/admin/v2/tasks?maxRows=${COLLECTION_LIMIT}`,
  namespaces: `/api/admin/v2/namespaces?maxRows=${COLLECTION_LIMIT}`,
  runtime: '/api/admin/v2/monitor/dashboard/main'
});
export async function readConfig() {
  let config = {};
  try { config = JSON.parse(await readFile('.local/iris.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('The local connection file could not be read.'); }
  config = {
    baseUrl: process.env.IRIS_BASE_URL || config.baseUrl,
    username: process.env.IRIS_USERNAME || config.username,
    password: process.env.IRIS_PASSWORD || config.password,
    label: process.env.IRIS_LABEL || config.label || 'Local IRIS Community Edition'
  };
  if (!config.baseUrl || !config.username || !config.password) throw new Error('Connection not configured. See README: local setup.');
  const url = new URL(config.baseUrl);
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol) || url.pathname !== '/') throw new Error('Use an IRIS server origin without credentials, query, or path.');
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Remote IRIS connections require HTTPS.');
  config.baseUrl = url.origin;
  return config;
}

export async function readEndpoint(config, name, fetcher = fetch) {
  if (!Object.hasOwn(ROUTES, name)) throw new Error('Unsupported read operation.');
  const response = await fetcher(config.baseUrl + ROUTES[name], {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`, Accept: 'application/json', 'Accept-Language': 'en' }
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(response.status === 401 ? 'Authentication failed (401).' : response.status === 403 ? 'Permission denied (403).' : response.status === 404 ? 'API unavailable (404). IRIS 2026.2 or later is required.' : `IRIS returned HTTP ${response.status}.`);
  }
  let bytes = 0; const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > 4 * 1024 * 1024) throw new Error('Response exceeds 4 MiB; collection is unavailable.');
    chunks.push(Buffer.from(chunk));
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('IRIS did not return a JSON response.'); }
  if (!body.status || !Array.isArray(body.status.errors) || body.status.errors.length || !Object.hasOwn(body, 'result')) throw new Error('IRIS reported an error or an incomplete response envelope.');
  return body.result;
}
function safeFailure(error) {
  return /^(Authentication failed|Permission denied|API unavailable|IRIS |Response exceeds|Expected |Invalid |An object|A task|Duplicate |Unexpected |Field |Collection )/.test(error.message) ? error.message : 'Read failed or timed out. Check the local IRIS connection.';
}
export async function capture(config, label = '', fetcher = fetch) {
  const info = await readEndpoint(config, 'info', fetcher);
  if (Number(info?.apiVersion) < 2 || !info?.serverVersion) throw new Error('This instance does not advertise management API v2. Use IRIS 2026.2 or later.');
  const snapshot = {
    schema: SCHEMA, id: randomUUID(), capturedAt: new Date().toISOString(), label: String(label).trim().slice(0, 100) || 'Untitled capture',
    source: { id: createHash('sha256').update(config.baseUrl).digest('hex').slice(0, 24), label: config.label, version: info.serverVersion, kind: 'live' },
    sections: {}, runtime: null
  };
  // Sequential requests stay within the Community Edition connection limit.
  for (const section of SECTIONS) {
    const capturedAt = new Date().toISOString();
    try {
      const result = await readEndpoint(config, section, fetcher);
      const rows = normalizeRows(section, result);
      snapshot.sections[section] = { status: rows.length >= COLLECTION_LIMIT ? 'partial' : 'ok', rows, reason: rows.length >= COLLECTION_LIMIT ? `Reached ${COLLECTION_LIMIT}-row limit. Completeness is unknown.` : '', capturedAt };
    } catch (error) { snapshot.sections[section] = { status: 'unavailable', rows: [], reason: safeFailure(error), capturedAt }; }
  }
  try { snapshot.runtime = { status: 'ok', data: projectRuntime(await readEndpoint(config, 'runtime', fetcher)) }; }
  catch (error) { snapshot.runtime = { status: 'unavailable', reason: safeFailure(error) }; }
  snapshot.completedAt = new Date().toISOString();
  return snapshot;
}
