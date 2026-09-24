// Controlled integration fixture. Never points at a user-selected or remote instance.
// Only three disabled /atlas-fixture-* applications in our disposable container are changed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { capture, readConfig } from '../lib/iris-client.mjs';
import { compare, validateSnapshot } from '../public/atlas-core.mjs';
const container = 'xinmi-iris-change-atlas';
const check = spawnSync('docker', ['inspect', container, '--format', '{{index .Config.Labels "xinmi.project"}}'], { encoding: 'utf8' });
assert.equal(check.stdout.trim(), 'iris-change-atlas', 'Expected disposable project container');
const config = await readConfig();
assert.equal(config.baseUrl, 'http://127.0.0.1:52774', 'Integration fixture is restricted to the local contest instance');
function iris(program, expected) {
  const r = spawnSync('docker', ['exec', '-i', container, 'iris', 'session', 'IRIS', '-U', '%SYS'], { input: `${program}\nhalt\n`, encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0 || !r.stdout.includes(`ATLAS_FIXTURE=${expected}`)) throw new Error('IRIS fixture action failed; no raw terminal output published.');
}
const names = ['/atlas-fixture-orders', '/atlas-fixture-retired', '/atlas-fixture-reports'];
function create(name) {
  return `kill p\nset p("NameSpace")="USER",p("Enabled")=0,p("AutheEnabled")=32,p("DispatchClass")="%Api.DocDB"\nset sc=##class(Security.Applications).Create("${name}",.p)\nwrite !,"ATLAS_FIXTURE=",sc,!`;
}
// Refuse to overwrite a pre-existing fixture: the caller should inspect it first.
for (const name of names) iris(`write !,"ATLAS_FIXTURE=",##class(Security.Applications).Exists("${name}"),!`, 0);
const owned = [];
try {
  for (const name of names.slice(0, 2)) { iris(create(name), 1); owned.push(name); }
  const before = await capture(config, 'Before planned maintenance');
  iris('kill p\nset p("NameSpace")="%SYS"\nset sc=##class(Security.Applications).Modify("/atlas-fixture-orders",.p)\nwrite !,"ATLAS_FIXTURE=",sc,!', 1);
  iris(create(names[2]), 1); owned.push(names[2]);
  iris(`set sc=##class(Security.Applications).Delete("${names[1]}")\nwrite !,"ATLAS_FIXTURE=",sc,!`, 1); owned.splice(owned.indexOf(names[1]), 1);
  const after = await capture(config, 'After planned maintenance');
  const review = compare(before, after);
  assert.equal(review.gaps.length, 0);
  assert.deepEqual(review.changes.map(change => [change.name, change.type]), [
    ['/atlas-fixture-orders', 'changed'], ['/atlas-fixture-reports', 'added'], ['/atlas-fixture-retired', 'removed']
  ]);
  assert.deepEqual(review.changes[0].fields.map(field => field.field), ['Namespace']);
  assert.equal(review.changes[0].after.Enabled, false, 'Fixture application remains disabled');
  await mkdir('.local', { recursive: true }); await mkdir('qa', { recursive: true });
  await writeFile('.local/live-verification.json', JSON.stringify({ before, after }, null, 2));
  const snapshots = [before, after].map(snapshot => validateSnapshot({ ...snapshot, id: `recorded-${snapshot.id}`, source: { ...snapshot.source, id: 'recorded-community-2026.2', label: 'Recorded local Community Edition', kind: 'example' } }));
  await writeFile('public/example.json', JSON.stringify({ atlasBundle: 1, snapshots }, null, 2));
  const evidence = { verifiedAt: new Date().toISOString(), runtime: before.source.version, method: 'Actual Basic-authenticated GETs to an isolated local IRIS 2026.2 Community Edition. Fixture writes are confined to disabled named test applications; the application itself uses GET only.', comparedCollections: review.compared, changes: review.changes.map(({ name, type, fields }) => ({ name, type, fields: fields.map(field => field.field) })), unchanged: review.unchanged, beforeCounts: Object.fromEntries(Object.entries(before.sections).map(([key, value]) => [key, value.rows.length])), afterCounts: Object.fromEntries(Object.entries(after.sections).map(([key, value]) => [key, value.rows.length])) };
  await writeFile('qa/live-verification.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  for (const name of owned) iris(`set sc=##class(Security.Applications).Delete("${name}")\nwrite !,"ATLAS_FIXTURE=",sc,!`, 1);
}
